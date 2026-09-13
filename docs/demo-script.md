# Demo Script (60-90 seconds)

## Setup
1. Start the application: `docker compose up -d && npm run dev`
2. Open two browser windows side by side
3. Navigate to an event page in both windows

## Demo Flow

### 1. Normal Booking Flow (15s)
- Open an event page
- Point out the seat map with color-coded availability
- Click an available seat → show the hold creation
- Point out the countdown timer
- Proceed to checkout → show booking confirmation

### 2. Concurrent Race (20s)
- In browser A: Select an available seat, create hold
- In browser B: Attempt the same seat
- Show the 409 Conflict error in browser B
- "The row-level lock serialized these requests. Only one succeeded."

### 3. Concurrency Test (15s)
- Switch to terminal
- Run `npm run test:concurrency`
- Point to the output:
  ```
  Requests:     100
  Successful:     1
  Conflicts:     99
  Server Errors:  0
  ```
- "100 concurrent requests, exactly 1 winner. The database constraint is the guarantee."

### 4. Idempotency Demo (10s)
- Point to TEST 3 results in the test output
- "Same idempotency key sent 3 times → 1 booking, 1 payment"

### 5. Webhook Deduplication (10s)
- Point to TEST 5 results
- "Same webhook delivered 3 times → processed once, no duplicate effects"

### 6. Architecture Overview (15s)
- Open the README or architecture diagram
- Point to the three layers: row lock → partial unique index → application check
- "Even if my application code has a bug, the database prevents double booking"

## Key Talking Points
- "The database is the source of truth, not the application"
- "SELECT FOR UPDATE serializes contention for individual seats"
- "The partial unique index is the last line of defense"
- "Every safety mechanism is tested, not just claimed"

## What NOT to Demo
- Don't spend time on the UI aesthetics
- Don't demo basic CRUD
- Focus on the concurrent scenario and the test results
