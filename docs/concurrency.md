# Concurrency Control

## The Core Problem

```
Request A → SELECT seat → AVAILABLE
Request B → SELECT seat → AVAILABLE
Request A → INSERT booking
Request B → INSERT booking   ← DOUBLE BOOKING!
```

This is the **check-then-act race condition**. Between checking availability and creating the booking, another request can observe the same state and create a conflicting booking.

## Our Solution: Three Layers of Protection

### Layer 1: Row-Level Locking (SELECT ... FOR UPDATE)

```sql
BEGIN TRANSACTION;

-- This acquires an exclusive lock on the seat row.
-- Any concurrent transaction attempting to lock the same row
-- will WAIT here until this transaction commits or rolls back.
SELECT * FROM seats WHERE id = $1 FOR UPDATE;

-- Now we're guaranteed to be the only transaction
-- that can read and modify this seat.
-- Check availability, create hold/booking...

COMMIT; -- Lock is released
```

**Why this prevents the race:**
- Request A acquires the lock
- Request B attempts `SELECT ... FOR UPDATE` → WAITS
- Request A creates the booking and commits
- Request B's lock is acquired, it reads the updated state
- Request B sees the seat is now booked → returns 409

### Layer 2: Partial Unique Index

```sql
CREATE UNIQUE INDEX one_booking_per_seat
  ON bookings(event_id, seat_id)
  WHERE status = 'CONFIRMED';
```

This is the **database-level guarantee**. Even if:
- Application logic has a bug
- Two API servers race
- A background worker misbehaves
- Someone runs a manual INSERT

PostgreSQL will reject any attempt to create a second CONFIRMED booking for the same (event_id, seat_id).

### Layer 3: Application-Level Check

```typescript
const hasConfirmed = await bookingRepo.hasConfirmedBooking(eventId, seatId, client);
if (hasConfirmed) throw new SeatUnavailableError();
```

This is the **fast path**. It provides a clear error message before hitting the constraint, but it is NOT relied upon for correctness.

## Transaction Boundaries

### Operations That Must Be Atomic

| Operation | Why |
|-----------|-----|
| Hold creation | Lock seat → check availability → create hold → update seat status |
| Booking confirmation | Lock seat → verify hold → create booking → create payment → update seat → release hold |
| Hold release | Update hold → check bookings → update seat status |
| Webhook processing | Insert webhook event → update payment → update booking |
| Hold sweep | Release all expired holds → update seat statuses |

### Operations That May Happen Asynchronously

| Operation | Why |
|-----------|-----|
| Outbox event publishing | Best-effort; eventual consistency is acceptable |
| Payment provider call | External service; may timeout or fail |
| Email notifications | Not implemented but would be async |

### Operations That Require Idempotency

| Operation | Mechanism |
|-----------|-----------|
| Booking creation | `idempotency_key` in payments table (UNIQUE constraint) |
| Payment processing | Mock provider tracks processed keys |
| Webhook handling | `provider_event_id` in webhook_events (UNIQUE constraint) |

## Lock Scoping

The row-level lock is scoped to the **individual seat row**. This means:

```
Seat A → Transaction 1 (locks row A)
Seat B → Transaction 2 (locks row B)  ← NOT blocked by Transaction 1
Seat C → Transaction 3 (locks row C)  ← NOT blocked
```

Only transactions competing for the **same seat** are serialized. Unrelated seats proceed concurrently.

This is verified by TEST 11 in the test suite.

## What Happens If...

### The server crashes while holding a transaction?
PostgreSQL automatically rolls back uncommitted transactions when a connection drops. No state is corrupted.

### Two database connections attempt the same lock?
The second connection waits until the first commits or rolls back. PostgreSQL detects and resolves deadlocks.

### The row lock is held too long?
Transaction timeout should be configured. In our system, transactions are short (< 100ms typically).

### I remove the row lock from the code?
TEST 1 (100 concurrent requests) would show multiple successful holds instead of exactly 1. This is the failure the lock prevents.

### I remove the partial unique index?
A bug in application logic could allow double confirmed bookings. The index is the last line of defense.
