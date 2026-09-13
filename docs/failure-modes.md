# Failure Modes

## Failure 1: Check-Then-Act Race

**What breaks:** Two requests both read the seat as AVAILABLE, then both create bookings.

**Why it happens:** Without locking, the SELECT and INSERT are separate, non-atomic operations.

**How we reproduce it:** Remove the `FOR UPDATE` clause from `SeatRepository.findByIdForUpdate()` and run the concurrent hold test (TEST 1).

**How the system prevents it:** `SELECT ... FOR UPDATE` acquires an exclusive row lock. The second transaction waits until the first commits.

**Which layer guarantees correctness:** PostgreSQL row-level locks.

---

## Failure 2: Double Booking

**What breaks:** Two CONFIRMED bookings exist for the same (event_id, seat_id).

**Why it happens:** Application-level checks can race or have bugs.

**How we reproduce it:** Attempt two direct `INSERT INTO bookings ... status = 'CONFIRMED'` with the same event_id and seat_id (TEST 2).

**How the system prevents it:** The partial unique index `one_booking_per_seat` causes PostgreSQL to reject the second INSERT.

**Which layer guarantees correctness:** PostgreSQL partial unique index.

---

## Failure 3: Double Payment

**What breaks:** Customer is charged twice for the same booking.

**Why it happens:** Client retries a payment request after a timeout. Without idempotency, each request creates a new payment.

**How we reproduce it:** Send `POST /bookings` with the same `Idempotency-Key` multiple times (TEST 3).

**How the system prevents it:** The `idempotency_key` column has a UNIQUE constraint. The service checks for existing payments with the same key before processing.

**Which layer guarantees correctness:** Application-level idempotency check + database UNIQUE constraint on `payments.idempotency_key`.

---

## Failure 4: Replayed Webhook

**What breaks:** A payment webhook is processed multiple times, causing duplicate state transitions.

**Why it happens:** Payment providers guarantee at-least-once delivery. Webhooks may be replayed due to retries, network issues, or provider bugs.

**How we reproduce it:** Send the same webhook payload 3 times (TEST 5).

**How the system prevents it:** The `provider_event_id` in `webhook_events` has a UNIQUE constraint. The INSERT-or-conflict pattern detects duplicates.

**Which layer guarantees correctness:** PostgreSQL UNIQUE constraint on `webhook_events.provider_event_id`.

---

## Failure 5: Expired Hold Blocking Inventory

**What breaks:** A seat remains permanently HELD because the hold expired but was never cleaned up.

**Why it happens:** If the background sweeper stops, expired holds aren't released. If availability checks only look at `seat.status`, the seat appears unavailable.

**How we reproduce it:** Create a hold with an expired timestamp, stop the sweeper, attempt to book (TEST 6).

**How the system prevents it:** Two mechanisms:
1. **Point-of-use validation:** Every hold check includes `expires_at > NOW()`. An expired hold is treated as if it doesn't exist.
2. **Background sweeper:** Periodically releases expired holds and updates seat status.

**Which layer guarantees correctness:** Application-level point-of-use validation (mechanism A) + background cleanup (mechanism B).

---

## Failure 6: Sweeper Failure

**What breaks:** Seat statuses become stale (showing HELD when the hold has expired).

**Why it happens:** The sweeper process crashes or stops.

**How the system prevents it:** The sweeper only maintains the seat `status` column for UI accuracy. The **hold validity is always rechecked at point-of-use**. A stopped sweeper makes the UI slightly stale but does NOT prevent correct booking behavior.

**Which layer guarantees correctness:** Application-level point-of-use validation.

---

## Failure 7: Transaction Rollback

**What breaks:** A partial booking exists (booking created but payment not created, or hold not released).

**Why it happens:** An error occurs mid-transaction.

**How we reproduce it:** Pass an invalid holdId to the booking endpoint (TEST 9). The transaction rolls back entirely.

**How the system prevents it:** All critical operations use `withTransaction()`. On any error, the entire transaction rolls back atomically.

**Which layer guarantees correctness:** PostgreSQL transactions (BEGIN/COMMIT/ROLLBACK).

---

## Failure 8: Concurrent Different-Seat Operations

**What breaks (if poorly designed):** Booking seat A unnecessarily blocks booking seat B.

**Why it would happen:** Using a global mutex or table-level lock instead of row-level locks.

**How we verify:** Hold 10 different seats concurrently (TEST 11). All should succeed without queuing.

**How the system prevents it:** `SELECT ... FOR UPDATE` locks the **individual seat row**, not the entire table. Unrelated seats are not affected.

**Which layer guarantees correctness:** PostgreSQL row-level locks (scoped to individual rows).

---

## Failure 9: Duplicate Idempotency Request

**What breaks:** Two different booking attempts collapse into one because they accidentally share an idempotency key.

**How we reproduce it:** TEST 4 verifies that different keys produce separate bookings.

**How the system prevents it:** The client generates unique idempotency keys per booking attempt. The system matches on the exact key, not on the booking parameters.

---

## Failure 10: Payment Provider Timeout

**What breaks:** Client doesn't know if payment succeeded. Retrying might create a duplicate charge.

**How we reproduce it:** Use the `timeout-*` idempotency key prefix to trigger a mock timeout (TEST 10).

**How the system prevents it:** The booking and payment are created inside the same transaction. Even if the payment provider times out, the idempotency key ensures retries don't create duplicates. A webhook from the provider can later update the payment status.

**Which layer guarantees correctness:** Idempotency key + UNIQUE constraint + transactional booking creation.
