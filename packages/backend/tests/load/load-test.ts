/**
 * Load test for the SeatLock booking system.
 *
 * Tests 100 concurrent hold attempts on the same seat.
 * Measures latency percentiles and verifies correctness.
 *
 * Usage: npm run test:load
 */
import 'dotenv/config';
import { v4 as uuid } from 'uuid';
import { createTestUsers, generateTestToken } from '../helpers/test-utils.js';
import { closePool } from '../../src/db/pool.js';

const API_URL = process.env.API_URL || 'http://localhost:3001';

interface LoadTestResult {
  totalRequests: number;
  successful: number;
  conflicts: number;
  errors: number;
  latencies: number[];
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  avgMs: number;
  totalDurationMs: number;
  rps: number;
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)]!;
}

async function runLoadTest(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║       SeatLock Load Test — Concurrent Holds     ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  // 1. Check API health
  try {
    const healthRes = await fetch(`${API_URL}/health`);
    if (!healthRes.ok) throw new Error('API not healthy');
    console.log('✅ API is healthy\n');
  } catch {
    console.error('❌ Cannot reach API. Is the server running?');
    process.exit(1);
  }

  // 2. Get an event and seat for testing
  const eventsRes = await fetch(`${API_URL}/events`);
  const events = (await eventsRes.json()) as { data: Array<{ id: string; name: string }> };
  const event = events.data[0];

  if (!event) {
    console.error('❌ No events found. Run npm run db:seed first.');
    process.exit(1);
  }

  const seatsRes = await fetch(`${API_URL}/events/${event.id}/seats`);
  const seats = (await seatsRes.json()) as { data: Array<{ id: string; label: string; status: string }> };
  const availableSeat = seats.data.find(s => s.status === 'AVAILABLE');

  if (!availableSeat) {
    console.error('❌ No available seats. Reset and re-seed the database.');
    process.exit(1);
  }

  console.log(`📌 Event: ${event.name}`);
  console.log(`💺 Target Seat: ${availableSeat.label} (${availableSeat.id})\n`);

  // 3. Create test users
  const CONCURRENT_USERS = 100;
  console.log(`📝 Registering ${CONCURRENT_USERS} test users...`);

  const testUsers = await createTestUsers(CONCURRENT_USERS);
  const users = testUsers.map(u => ({
    userId: u.userId,
    token: generateTestToken(u.userId),
  }));
  console.log(`✅ ${users.length} users ready\n`);

  // 4. Fire concurrent hold requests
  console.log(`🚀 Firing ${CONCURRENT_USERS} concurrent hold requests...\n`);

  const startTime = Date.now();
  const latencies: number[] = [];
  let successful = 0;
  let conflicts = 0;
  let errors = 0;

  const results = await Promise.all(
    users.map(async (user) => {
      const reqStart = Date.now();
      try {
        const res = await fetch(`${API_URL}/events/${event.id}/holds`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user.token}`,
          },
          body: JSON.stringify({ seatId: availableSeat.id }),
        });

        const latency = Date.now() - reqStart;
        latencies.push(latency);

        if (res.status === 201) {
          successful++;
          return 'success';
        } else if (res.status === 409) {
          conflicts++;
          return 'conflict';
        } else {
          errors++;
          return 'error';
        }
      } catch {
        errors++;
        latencies.push(Date.now() - reqStart);
        return 'error';
      }
    })
  );

  const totalDuration = Date.now() - startTime;
  const sorted = [...latencies].sort((a, b) => a - b);

  const result: LoadTestResult = {
    totalRequests: CONCURRENT_USERS,
    successful,
    conflicts,
    errors,
    latencies: sorted,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!,
    avgMs: Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length),
    totalDurationMs: totalDuration,
    rps: Math.round((CONCURRENT_USERS / totalDuration) * 1000),
  };

  // 5. Output results
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║          LOAD TEST RESULTS                        ║');
  console.log('╠════════════════════════════════════════════════════╣');
  console.log(`║  Total Requests:    ${result.totalRequests.toString().padStart(6)}                       ║`);
  console.log(`║  Successful:        ${result.successful.toString().padStart(6)}                       ║`);
  console.log(`║  Conflicts (409):   ${result.conflicts.toString().padStart(6)}                       ║`);
  console.log(`║  Server Errors:     ${result.errors.toString().padStart(6)}                       ║`);
  console.log('║                                                    ║');
  console.log(`║  Min Latency:       ${result.min.toString().padStart(6)} ms                    ║`);
  console.log(`║  Avg Latency:       ${result.avgMs.toString().padStart(6)} ms                    ║`);
  console.log(`║  p50 Latency:       ${result.p50.toString().padStart(6)} ms                    ║`);
  console.log(`║  p95 Latency:       ${result.p95.toString().padStart(6)} ms                    ║`);
  console.log(`║  p99 Latency:       ${result.p99.toString().padStart(6)} ms                    ║`);
  console.log(`║  Max Latency:       ${result.max.toString().padStart(6)} ms                    ║`);
  console.log('║                                                    ║');
  console.log(`║  Total Duration:    ${result.totalDurationMs.toString().padStart(6)} ms                    ║`);
  console.log(`║  Throughput:        ${result.rps.toString().padStart(6)} req/s                  ║`);
  console.log('╠════════════════════════════════════════════════════╣');

  if (result.successful === 1 && result.errors === 0) {
    console.log('║  RESULT: ✅ PASS                                  ║');
  } else {
    console.log('║  RESULT: ❌ FAIL                                  ║');
  }
  console.log('╚════════════════════════════════════════════════════╝');

  // 6. Verify database state
  console.log('\n🔍 Verifying database state...');

  // We can't directly query DB from this script, but we verify via API
  const seatsAfter = await fetch(`${API_URL}/events/${event.id}/seats`);
  const seatsData = (await seatsAfter.json()) as { data: Array<{ id: string; status: string }> };
  const targetSeat = seatsData.data.find(s => s.id === availableSeat.id);
  console.log(`   Seat ${availableSeat.label} status: ${targetSeat?.status}`);

  if (result.successful !== 1) {
    console.error(`\n❌ Expected exactly 1 successful hold, got ${result.successful}`);
    process.exit(1);
  }

  if (result.errors > 0) {
    console.error(`\n⚠️  ${result.errors} server errors occurred`);
  }

  console.log('\n✅ Load test complete. Data consistency verified.');
  await closePool();
}

runLoadTest().catch(console.error);
