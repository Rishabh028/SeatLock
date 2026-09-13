# Payments

## Payment Architecture

```
BookingService
    │
    ▼
PaymentProvider (interface)
    │
    ├── MockPaymentProvider (dev/test)
    │   ├── Success (default)
    │   ├── Failure (key prefix: fail-*)
    │   └── Timeout (key prefix: timeout-*)
    │
    └── (Future) StripePaymentProvider
```

## Payment Lifecycle

```
PENDING → PROCESSING → SUCCEEDED
                    └→ FAILED
```

1. **PENDING**: Payment record created in database
2. **PROCESSING**: Payment sent to provider
3. **SUCCEEDED**: Provider confirmed payment
4. **FAILED**: Provider rejected payment

## Webhook Flow

```
Provider → POST /payments/webhook
    │
    ├── Verify signature
    ├── Check for duplicate (provider_event_id)
    │   ├── Duplicate → return 200, no-op
    │   └── New → process
    │       ├── Insert into webhook_events
    │       ├── Update payment status
    │       ├── Update booking status
    │       └── Mark webhook as processed
    └── Return 200
```

## Mock Payment Provider

The mock provider simulates real payment provider behavior:

| Idempotency Key Prefix | Behavior |
|------------------------|----------|
| `fail-*` | Returns payment failure |
| `timeout-*` | Throws timeout error after 100ms |
| (default) | Returns success after 10ms delay |

The mock also tracks processed idempotency keys, so retries with the same key return the same result.

## Webhook Signature Verification

In production, webhooks are verified using HMAC-SHA256:
```
signature = HMAC-SHA256(webhook_secret, raw_payload)
```

In development, the signature `test` is accepted without verification.

## Safety Guarantees

1. **No double charging**: Idempotency key + UNIQUE constraint
2. **No lost payments**: Webhook can update payment status after timeout
3. **No duplicate effects**: Webhook deduplication via provider_event_id
4. **Transaction safety**: Booking + payment created in same transaction
