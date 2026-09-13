# Idempotency

## The Problem

```
Client → POST /bookings → Server processes → Network timeout → Client doesn't know the result
Client → POST /bookings (retry) → Without idempotency, this creates a SECOND booking
```

## How It Works

Every booking request requires an `Idempotency-Key` header:

```http
POST /bookings
Idempotency-Key: booking-abc123-attempt-1
Content-Type: application/json

{
  "eventId": "...",
  "seatId": "...",
  "holdId": "..."
}
```

### First Request (new key)
1. Check `payments` table for existing record with this idempotency key
2. No match → proceed with booking
3. Create booking, payment record (with idempotency key), and outbox event in one transaction
4. Return 201 Created

### Subsequent Requests (same key)
1. Check `payments` table for existing record with this idempotency key
2. Match found → return the existing booking result
3. Return 200 OK (not 201, indicating this is a replay)

### Database Safety Net
```sql
-- payments table
idempotency_key VARCHAR(255) NOT NULL UNIQUE
```

Even if the application-level check races, the UNIQUE constraint prevents a duplicate payment record.

## Key Design Decisions

1. **Client generates the key** — The client knows whether it's retrying. The server just checks.
2. **Key is tied to payment, not request** — Different users can't accidentally collide.
3. **Replay returns 200, not 201** — The caller can distinguish new creation from replay.
4. **No request body comparison** — We don't verify the body matches. Same key = same operation.
