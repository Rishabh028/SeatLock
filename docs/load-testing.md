# Load Testing

## Strategy

The load test targets the most contentious operation: 100 concurrent hold attempts on the same seat.

### What We Measure
- **Successful holds**: Should be exactly 1
- **Conflict responses (409)**: Should be 99
- **Server errors (5xx)**: Should be 0
- **Latency percentiles**: p50, p95, p99
- **Total throughput**: Requests per second

### How to Run

```bash
# Ensure the API is running
npm run dev:backend

# In another terminal
npm run test:load
```

### Expected Output

```
╔════════════════════════════════════════════════════╗
║          LOAD TEST RESULTS                        ║
╠════════════════════════════════════════════════════╣
║  Total Requests:       100                       ║
║  Successful:             1                       ║
║  Conflicts (409):       99                       ║
║  Server Errors:          0                       ║
║                                                  ║
║  Min Latency:          XXX ms                    ║
║  p50 Latency:          XXX ms                    ║
║  p95 Latency:          XXX ms                    ║
║  p99 Latency:          XXX ms                    ║
║  Max Latency:          XXX ms                    ║
║                                                  ║
║  RESULT: ✅ PASS                                 ║
╚════════════════════════════════════════════════════╝
```

## Why These Numbers Matter

- **1 success / 99 conflicts** proves the row-level lock serializes correctly
- **0 server errors** proves no unhandled edge cases
- **Low p95** indicates the serialization doesn't cause excessive waiting

## Bottleneck Analysis

The bottleneck under same-seat contention is the PostgreSQL row-level lock. All 100 transactions queue on `SELECT ... FOR UPDATE` for the same seat row. This is **by design** — the lock IS the correctness mechanism.

For different seats, there is no contention and requests proceed independently (verified by TEST 11).

## What Would Improve Performance

1. **Connection pooling** (PgBouncer) — reduces connection overhead
2. **Queue-based booking** — instead of 100 concurrent transactions, enqueue requests and process serially per seat
3. **Caching** — cache event/seat data to reduce read load on PostgreSQL
