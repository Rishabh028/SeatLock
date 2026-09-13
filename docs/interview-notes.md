# Interview Notes

## The 60-Second Story

> "I built an event booking system where the core engineering challenge is: hundreds of users may attempt to book the same seat simultaneously. The system guarantees that exactly one confirmed booking exists per seat.
>
> The naive implementation has a check-then-act race: two requests both read the seat as available, both insert bookings. I prevent this with three layers: PostgreSQL row-level locks (SELECT FOR UPDATE) serialize concurrent access to the same seat, a partial unique index makes double booking physically impossible at the database level, and idempotency keys prevent duplicate charges from payment retries.
>
> I proved this works with 100 concurrent requests where exactly 1 succeeds and 99 get 409 Conflict. The database constraint catches anything the application logic misses."

---

## Architecture Questions

### 1. Walk me through your architecture.
Browser → Next.js frontend → Fastify API → Service layer (BookingService, HoldService, etc.) → Repository layer → PostgreSQL. Background workers handle hold expiration and outbox processing. Payment goes through an abstracted PaymentProvider interface.

### 2. Why PostgreSQL?
The core invariant requires transactional guarantees (BEGIN/COMMIT/ROLLBACK), row-level locking (SELECT FOR UPDATE), and database-enforced constraints (partial unique index). These are PostgreSQL strengths. MongoDB can't enforce a partial unique index the same way. Redis can't guarantee transactional consistency with durable state.

### 3. Why not MongoDB?
MongoDB supports transactions but not partial unique indexes in the same way. The booking invariant needs `UNIQUE(event_id, seat_id) WHERE status = 'CONFIRMED'`. MongoDB's unique indexes don't support WHERE clauses. You'd have to rely entirely on application logic, which defeats the purpose.

### 4. What is the source of truth?
PostgreSQL. The seat status field is a convenience cache; the actual truth is the combination of holds, bookings, and their timestamps/statuses.

### 5. Where is the business logic?
In the service layer (BookingService, HoldService). Route handlers are thin — they validate input, call services, and format responses. Business rules live in services. Database access lives in repositories.

---

## Concurrency Questions

### 6. What happens if 100 users book the same seat?
All 100 transactions attempt `SELECT ... FOR UPDATE` on the same seat row. They queue up. The first to acquire the lock creates the hold/booking. When it commits, the next transaction acquires the lock, sees the seat is taken, and returns 409. This is verified by the concurrency test.

### 7. Why use FOR UPDATE?
It converts the SELECT into an exclusive row lock. Without it, two transactions could both read AVAILABLE and both attempt to insert. The lock serializes access.

### 8. What does the row lock actually protect?
It protects the gap between reading the seat state and writing the booking. Without the lock, this gap is where the race condition lives.

### 9. Why not Redis locks?
Redis locks work but add a dependency and a failure mode (what if Redis goes down?). PostgreSQL row locks are:
- Built into the same database we're already using
- Automatically released on crash/disconnect
- Deadlock-detected
- No additional infrastructure

### 10. Why not an application mutex?
An application mutex only works on a single server. With multiple API servers (horizontal scaling), the mutex is useless. PostgreSQL locks work across all connections from all servers.

### 11. What happens if the server crashes while holding a transaction?
PostgreSQL rolls back uncommitted transactions when a connection drops. No corrupted state.

### 12. Can two different seats be booked concurrently?
Yes. The lock is on the individual seat row. Seat A and Seat B have independent locks. Verified by TEST 11.

---

## Database Questions

### 13. Why the partial unique index?
It's the database-level guarantee. Even if every line of application code is wrong, PostgreSQL prevents two CONFIRMED bookings for the same seat. It's a safety net that doesn't depend on application correctness.

### 14. What happens if application code has a bug?
The partial unique index catches it. The INSERT fails with a unique constraint violation (PostgreSQL error 23505), which the error handler converts to a 409 response.

### 15. Which indexes did you add?
- `idx_seats_event_id` — seat lookup by event
- `idx_holds_seat_id` — active hold lookup
- `idx_holds_expires_at` — expired hold sweep
- `idx_bookings_event_seat` — booking lookup for invariant check
- `idx_bookings_user_id` — user's booking history
- `idx_payments_booking_id` — payment lookup
- `idx_webhook_events_provider_event_id` — webhook deduplication

### 16. What isolation level?
PostgreSQL default: Read Committed. This is sufficient because the row-level lock provides the necessary serialization for the critical path.

### 17. What are your transaction boundaries?
Hold creation, booking confirmation, and hold release are each wrapped in a single transaction. The transaction includes all reads (with locking), writes, and outbox inserts.

---

## Payment Questions

### 18. What happens if payment times out?
The booking is created with payment status PROCESSING or FAILED. The idempotency key prevents duplicate bookings on retry. The payment provider's webhook can later update the payment status.

### 19. How do you prevent double charging?
Idempotency key. Each booking attempt has a unique key. The payment table has a UNIQUE constraint on this key. Same key = same payment, even if the request is sent 100 times.

### 20. What is an idempotency key?
A client-generated unique identifier for a specific operation. If the same key appears again, the system returns the previously computed result instead of processing again.

### 21. What happens if the same webhook arrives three times?
First delivery: INSERT into webhook_events succeeds → process the event. Second and third: INSERT fails (UNIQUE constraint on provider_event_id) → return 200 with no side effects.

### 22. Why store webhook event IDs?
To detect replays. Without storing the ID, we can't distinguish a new event from a replay.

---

## Scaling Questions

### 23. How would you scale to millions of bookings?
- Connection pooling (PgBouncer)
- Read replicas for event/seat listing
- Caching event data in Redis
- Sharding by event_id if necessary
- Queue-based booking with optimistic locking

### 24. What is your bottleneck?
The row-level lock on the seat. Under extreme contention (thousands of concurrent requests for the same seat), all transactions serialize on that one row. This is by design — the lock IS the correctness mechanism.

### 25. Would row locks become a bottleneck?
Yes, for the same seat under extreme load. But this is inherent to the problem: exactly one person can book a seat. The serialization IS the solution. For different seats, there's no contention.

### 26. How would you partition the workload?
By event_id. Each event's seats are independent, so events can be served by different database partitions or even different PostgreSQL instances.

### 27. How would you handle multiple API instances?
They already work correctly because PostgreSQL row locks coordinate across all connections. No changes needed.

### 28. What would Redis be useful for?
- Caching event listings (read-heavy, rarely changing)
- Rate limiting across multiple API instances
- Session storage
- NOT for the booking lock (PostgreSQL handles that)

### 29. What would you cache?
Event details (changes rarely), seat map layout (changes only when events are created), availability summaries (invalidate on booking).

### 30. What would you change at 10x traffic?
Add PgBouncer, Redis caching, read replicas. At 100x, consider sharding by event and a queue-based booking flow where requests are enqueued and processed serially per seat.

---

## Reliability Questions

### 31. What happens if the hold sweeper dies?
Seats show as HELD in the UI, but point-of-use validation still works. New bookings correctly treat expired holds as if they don't exist. The UI is slightly stale, but correctness is maintained.

### 32. What happens if the payment worker dies?
Payments stay in PROCESSING or PENDING status. The webhook from the payment provider can still update the status. A recovery worker could retry failed payments.

### 33. What happens if the database goes down?
The application returns 503. No data corruption. When the database comes back, all state is intact because PostgreSQL is ACID-compliant.

### 34. How do you recover?
Restart the service. All state is durable in PostgreSQL. No in-memory state is critical.

### 35. How do you observe failures?
Structured logging with pino. Every important event is logged: booking_attempt, seat_locked, hold_created, booking_created, payment_succeeded, payment_failed, webhook_received, webhook_duplicate, hold_expired.

---

## Tradeoff Questions

### 41. What would you change if you had another month?
- Real payment integration (Stripe)
- WebSocket for real-time seat updates
- Queue-based booking for extreme scale
- Monitoring dashboard (Grafana)
- Distributed rate limiting with Redis
- Email notifications via outbox

### 42. What did you deliberately NOT build?
- Real payment integration (mock is sufficient for demonstrating the pattern)
- WebSockets (polling is simpler and the backend remains authoritative)
- Kubernetes deployment (Docker Compose is sufficient for demo)
- Custom OAuth (JWT with bcrypt is sufficient)

### 43. What part would you replace at scale?
The synchronous booking flow. At very high scale, I'd use a queue per seat, where booking requests are enqueued and a consumer processes them serially. This removes the row-lock contention but adds latency.

### 44. What is currently the weakest part?
In-memory rate limiting. It doesn't work across multiple API instances. Redis-backed rate limiting would fix this.

### 45. What technical debt remains?
- No real payment provider
- No email notifications
- No monitoring/alerting
- In-memory rate limiting
- Test data cleanup could be more thorough
