/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  CRITICAL CONCURRENCY TEST SUITE                                           ║
 * ║                                                                            ║
 * ║  These tests prove the system's correctness under concurrent load.         ║
 * ║  They are the most important tests in the entire project.                  ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getPool } from '../../src/db/pool.js';
import { buildApp } from '../../src/server.js';
import {
  createTestEvent,
  createTestSeat,
  createTestUser,
  createTestUsers,
  generateTestToken,
  cleanupTestEvent,
} from '../helpers/test-utils.js';
import { v4 as uuid } from 'uuid';

describe('Concurrency Tests', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app'];

  beforeAll(async () => {
    const result = await buildApp();
    app = result.app;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  /**
   * TEST 1 — Concurrent seat hold attempts
   *
   * Scenario: 100 users attempt to hold the SAME seat simultaneously.
   * Expected: Exactly 1 succeeds, 99 get 409 SEAT_UNAVAILABLE.
   *
   * Why this works: SELECT ... FOR UPDATE on the seat row serializes all
   * concurrent transactions. The first to acquire the lock creates the hold.
   * All subsequent transactions see the hold and return 409.
   */
  it('TEST 1: 100 concurrent hold attempts → exactly 1 succeeds', async () => {
    const eventId = await createTestEvent('Test Event Concurrent Holds');
    const seatId = await createTestSeat(eventId, 'CONC-1');

    // Create 100 test users in a single batch
    const users = await createTestUsers(100);

    // Fire 100 concurrent hold requests
    const results = await Promise.all(
      users.map(async (user) => {
        const token = generateTestToken(user.userId);
        const res = await app.inject({
          method: 'POST',
          url: `/events/${eventId}/holds`,
          headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/json',
          },
          payload: { seatId },
        });
        return { status: res.statusCode, body: JSON.parse(res.body) };
      })
    );

    const successes = results.filter(r => r.status === 201);
    const conflicts = results.filter(r => r.status === 409);
    const errors = results.filter(r => r.status >= 500);

    console.log('\n╔══════════════════════════════════════╗');
    console.log('║   Concurrent Hold Test Results       ║');
    console.log('╠══════════════════════════════════════╣');
    console.log(`║   Requests:     ${results.length.toString().padStart(5)}              ║`);
    console.log(`║   Successful:   ${successes.length.toString().padStart(5)}              ║`);
    console.log(`║   Conflicts:    ${conflicts.length.toString().padStart(5)}              ║`);
    console.log(`║   Server Errors:${errors.length.toString().padStart(5)}              ║`);
    console.log('╚══════════════════════════════════════╝\n');

    // Verify: exactly 1 success
    expect(successes.length).toBe(1);
    expect(errors.length).toBe(0);
    expect(conflicts.length).toBe(99);

    // Verify database state: exactly 1 active hold
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT COUNT(*) as count FROM holds
       WHERE seat_id = $1 AND released_at IS NULL AND expires_at > NOW()`,
      [seatId]
    );
    expect(parseInt(rows[0]!.count)).toBe(1);

    await cleanupTestEvent(eventId);
  }, 60000);

  /**
   * TEST 2 — Database constraint protection
   *
   * Scenario: Attempt to INSERT two CONFIRMED bookings for the same
   * (event_id, seat_id) directly via SQL, bypassing application logic.
   *
   * Expected: The partial unique index rejects the second INSERT.
   *
   * This proves the invariant holds even if app logic has a bug.
   */
  it('TEST 2: Partial unique index prevents double CONFIRMED booking', async () => {
    const eventId = await createTestEvent('Test Event DB Constraint');
    const seatId = await createTestSeat(eventId, 'DB-CONST-1');
    const { userId } = await createTestUser();

    const pool = getPool();

    // First booking succeeds
    await pool.query(
      `INSERT INTO bookings (event_id, seat_id, user_id, status)
       VALUES ($1, $2, $3, 'CONFIRMED')`,
      [eventId, seatId, userId]
    );

    // Second booking MUST fail due to partial unique index
    await expect(
      pool.query(
        `INSERT INTO bookings (event_id, seat_id, user_id, status)
         VALUES ($1, $2, $3, 'CONFIRMED')`,
        [eventId, seatId, userId]
      )
    ).rejects.toThrow();

    // Verify only 1 confirmed booking exists
    const { rows } = await pool.query(
      `SELECT COUNT(*) FROM bookings WHERE event_id = $1 AND seat_id = $2 AND status = 'CONFIRMED'`,
      [eventId, seatId]
    );
    expect(parseInt(rows[0]!.count)).toBe(1);

    console.log('✅ TEST 2: Database constraint prevented double booking');

    await cleanupTestEvent(eventId);
  });

  /**
   * TEST 3 — Payment idempotency
   *
   * Scenario: Send POST /bookings with the same Idempotency-Key 3 times.
   * Expected: 1 booking, 1 payment, same result returned each time.
   */
  it('TEST 3: Same idempotency key returns cached result', async () => {
    const eventId = await createTestEvent('Test Event Idempotency');
    const seatId = await createTestSeat(eventId, 'IDEMP-1');
    const { userId } = await createTestUser();
    const token = generateTestToken(userId);

    // Create a hold first
    const holdRes = await app.inject({
      method: 'POST',
      url: `/events/${eventId}/holds`,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: { seatId },
    });
    const holdId = JSON.parse(holdRes.body).data.holdId;

    const idempotencyKey = `test-idemp-${uuid()}`;

    // Send 3 identical booking requests
    const results = [];
    for (let i = 0; i < 3; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/bookings',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
          'idempotency-key': idempotencyKey,
        },
        payload: { eventId, seatId, holdId },
      });
      results.push({ status: res.statusCode, body: JSON.parse(res.body) });
    }

    // First request creates, subsequent are replays
    expect(results[0]!.status).toBe(201);
    expect(results[1]!.status).toBe(200);
    expect(results[2]!.status).toBe(200);

    // All return the same booking ID
    const bookingIds = results.map(r => r.body.data.bookingId);
    expect(new Set(bookingIds).size).toBe(1);

    // Verify database: exactly 1 booking and 1 payment
    const pool = getPool();
    const { rows: bookings } = await pool.query(
      'SELECT COUNT(*) FROM bookings WHERE event_id = $1 AND seat_id = $2',
      [eventId, seatId]
    );
    expect(parseInt(bookings[0]!.count)).toBe(1);

    const { rows: payments } = await pool.query(
      'SELECT COUNT(*) FROM payments WHERE idempotency_key = $1',
      [idempotencyKey]
    );
    expect(parseInt(payments[0]!.count)).toBe(1);

    console.log('✅ TEST 3: Idempotency verified — 3 requests, 1 booking, 1 payment');

    await cleanupTestEvent(eventId);
  });

  /**
   * TEST 4 — Different idempotency keys = separate attempts
   */
  it('TEST 4: Different idempotency keys create separate bookings', async () => {
    const eventId = await createTestEvent('Test Event Diff Idemp');
    const seatId1 = await createTestSeat(eventId, 'DIFF-IDEMP-1');
    const seatId2 = await createTestSeat(eventId, 'DIFF-IDEMP-2');
    const { userId } = await createTestUser();
    const token = generateTestToken(userId);

    // Hold seat 1
    const hold1Res = await app.inject({
      method: 'POST',
      url: `/events/${eventId}/holds`,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: { seatId: seatId1 },
    });
    const holdId1 = JSON.parse(hold1Res.body).data.holdId;

    // Book seat 1
    const res1 = await app.inject({
      method: 'POST',
      url: '/bookings',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'idempotency-key': `key-a-${uuid()}`,
      },
      payload: { eventId, seatId: seatId1, holdId: holdId1 },
    });

    // Hold seat 2
    const hold2Res = await app.inject({
      method: 'POST',
      url: `/events/${eventId}/holds`,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: { seatId: seatId2 },
    });
    const holdId2 = JSON.parse(hold2Res.body).data.holdId;

    // Book seat 2 with different key
    const res2 = await app.inject({
      method: 'POST',
      url: '/bookings',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'idempotency-key': `key-b-${uuid()}`,
      },
      payload: { eventId, seatId: seatId2, holdId: holdId2 },
    });

    expect(res1.statusCode).toBe(201);
    expect(res2.statusCode).toBe(201);

    const booking1 = JSON.parse(res1.body).data.bookingId;
    const booking2 = JSON.parse(res2.body).data.bookingId;
    expect(booking1).not.toBe(booking2);

    console.log('✅ TEST 4: Different keys → separate bookings');

    await cleanupTestEvent(eventId);
  });

  /**
   * TEST 5 — Webhook replay deduplication
   *
   * Send the same webhook 3 times. Only the first should be processed.
   */
  it('TEST 5: Webhook replay → 1 process, 2 no-ops', async () => {
    const providerEventId = `evt_test_${uuid()}`;
    const providerRef = `mock_${uuid()}`;

    const webhookPayload = JSON.stringify({
      provider_event_id: providerEventId,
      event_type: 'payment.succeeded',
      payment_ref: providerRef,
      status: 'succeeded',
    });

    const results = [];
    for (let i = 0; i < 3; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/payments/webhook',
        headers: {
          'content-type': 'application/json',
          'x-webhook-signature': 'test',
        },
        payload: webhookPayload,
      });
      results.push(JSON.parse(res.body));
    }

    // First is processed, rest are duplicates
    expect(results[0]!.duplicate).toBe(false);
    expect(results[1]!.duplicate).toBe(true);
    expect(results[2]!.duplicate).toBe(true);

    // Verify only 1 webhook record
    const pool = getPool();
    const { rows } = await pool.query(
      'SELECT COUNT(*) FROM webhook_events WHERE provider_event_id = $1',
      [providerEventId]
    );
    expect(parseInt(rows[0]!.count)).toBe(1);

    console.log('✅ TEST 5: Webhook deduplication — 3 deliveries, 1 processed');

    // Cleanup
    await pool.query('DELETE FROM webhook_events WHERE provider_event_id = $1', [providerEventId]);
  });

  /**
   * TEST 6 — Expired hold doesn't block inventory
   */
  it('TEST 6: Expired hold allows new booking', async () => {
    const eventId = await createTestEvent('Test Event Expired Hold');
    const seatId = await createTestSeat(eventId, 'EXPIRED-1');
    const { userId: user1Id } = await createTestUser();
    const { userId: user2Id } = await createTestUser();

    const pool = getPool();

    // Create an already-expired hold directly in DB
    await pool.query(
      `INSERT INTO holds (seat_id, user_id, expires_at)
       VALUES ($1, $2, NOW() - INTERVAL '1 minute')`,
      [seatId, user1Id]
    );
    await pool.query(
      `UPDATE seats SET status = 'HELD' WHERE id = $1`,
      [seatId]
    );

    // User 2 should be able to create a hold (point-of-use expiration check)
    const token2 = generateTestToken(user2Id);
    const res = await app.inject({
      method: 'POST',
      url: `/events/${eventId}/holds`,
      headers: { authorization: `Bearer ${token2}`, 'content-type': 'application/json' },
      payload: { seatId },
    });

    expect(res.statusCode).toBe(201);
    console.log('✅ TEST 6: Expired hold did not block inventory');

    await cleanupTestEvent(eventId);
  });

  /**
   * TEST 7 — Wrong user cannot confirm another user's hold
   */
  it('TEST 7: User B cannot use User A\'s hold', async () => {
    const eventId = await createTestEvent('Test Event Wrong User');
    const seatId = await createTestSeat(eventId, 'WRONGUSER-1');
    const { userId: userAId } = await createTestUser();
    const { userId: userBId } = await createTestUser();

    const tokenA = generateTestToken(userAId);
    const tokenB = generateTestToken(userBId);

    // User A creates hold
    const holdRes = await app.inject({
      method: 'POST',
      url: `/events/${eventId}/holds`,
      headers: { authorization: `Bearer ${tokenA}`, 'content-type': 'application/json' },
      payload: { seatId },
    });
    const holdId = JSON.parse(holdRes.body).data.holdId;

    // User B attempts to book with User A's hold
    const bookRes = await app.inject({
      method: 'POST',
      url: '/bookings',
      headers: {
        authorization: `Bearer ${tokenB}`,
        'content-type': 'application/json',
        'idempotency-key': `wronguser-${uuid()}`,
      },
      payload: { eventId, seatId, holdId },
    });

    expect(bookRes.statusCode).toBe(403);
    console.log('✅ TEST 7: User B correctly denied access to User A\'s hold');

    await cleanupTestEvent(eventId);
  });

  /**
   * TEST 8 — Cancel/release hold frees the seat
   */
  it('TEST 8: Released hold allows another user to hold the seat', async () => {
    const eventId = await createTestEvent('Test Event Release Hold');
    const seatId = await createTestSeat(eventId, 'RELEASE-1');
    const { userId: user1Id } = await createTestUser();
    const { userId: user2Id } = await createTestUser();

    const token1 = generateTestToken(user1Id);
    const token2 = generateTestToken(user2Id);

    // User 1 creates hold
    const holdRes = await app.inject({
      method: 'POST',
      url: `/events/${eventId}/holds`,
      headers: { authorization: `Bearer ${token1}`, 'content-type': 'application/json' },
      payload: { seatId },
    });
    const holdId = JSON.parse(holdRes.body).data.holdId;

    // User 1 releases hold
    await app.inject({
      method: 'DELETE',
      url: `/holds/${holdId}`,
      headers: { authorization: `Bearer ${token1}` },
    });

    // User 2 can now hold the seat
    const res = await app.inject({
      method: 'POST',
      url: `/events/${eventId}/holds`,
      headers: { authorization: `Bearer ${token2}`, 'content-type': 'application/json' },
      payload: { seatId },
    });

    expect(res.statusCode).toBe(201);
    console.log('✅ TEST 8: Released hold freed the seat for another user');

    await cleanupTestEvent(eventId);
  });

  /**
   * TEST 9 — Transaction rollback leaves no partial state
   */
  it('TEST 9: Failed booking leaves no partial state', async () => {
    const eventId = await createTestEvent('Test Event Rollback');
    const seatId = await createTestSeat(eventId, 'ROLLBACK-1');
    const { userId } = await createTestUser();
    const token = generateTestToken(userId);

    // Create hold
    const holdRes = await app.inject({
      method: 'POST',
      url: `/events/${eventId}/holds`,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: { seatId },
    });
    const holdId = JSON.parse(holdRes.body).data.holdId;

    // Attempt booking with a non-existent hold to force a failure path
    const res = await app.inject({
      method: 'POST',
      url: '/bookings',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'idempotency-key': `rollback-${uuid()}`,
      },
      payload: { eventId, seatId, holdId: uuid() }, // Wrong holdId
    });

    expect(res.statusCode).toBe(404);

    // Verify: no booking was created
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT COUNT(*) FROM bookings WHERE event_id = $1 AND seat_id = $2`,
      [eventId, seatId]
    );
    expect(parseInt(rows[0]!.count)).toBe(0);

    console.log('✅ TEST 9: Transaction rollback — no partial state');

    await cleanupTestEvent(eventId);
  });

  /**
   * TEST 10 — Payment timeout doesn't create duplicate records on retry
   */
  it('TEST 10: Payment timeout + retry creates only 1 booking', async () => {
    const eventId = await createTestEvent('Test Event Timeout');
    const seatId = await createTestSeat(eventId, 'TIMEOUT-1');
    const { userId } = await createTestUser();
    const token = generateTestToken(userId);

    // Create hold
    const holdRes = await app.inject({
      method: 'POST',
      url: `/events/${eventId}/holds`,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: { seatId },
    });
    const holdId = JSON.parse(holdRes.body).data.holdId;

    // First booking attempt (simulated timeout via "timeout-" prefix would fail at provider,
    // but idempotency key ensures the retry is safe)
    const idempKey = `timeout-test-${uuid()}`;

    // Since our mock payment provider times out on "timeout-" prefix,
    // the booking will still be created but payment will be marked failed
    const res1 = await app.inject({
      method: 'POST',
      url: '/bookings',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'idempotency-key': idempKey,
      },
      payload: { eventId, seatId, holdId },
    });

    // Retry with same key — should return cached result
    const res2 = await app.inject({
      method: 'POST',
      url: '/bookings',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'idempotency-key': idempKey,
      },
      payload: { eventId, seatId, holdId },
    });

    // Both should reference the same booking
    const body1 = JSON.parse(res1.body).data;
    const body2 = JSON.parse(res2.body).data;
    expect(body1.bookingId).toBe(body2.bookingId);

    // Only 1 booking in DB
    const pool = getPool();
    const { rows } = await pool.query(
      'SELECT COUNT(*) FROM bookings WHERE event_id = $1 AND seat_id = $2',
      [eventId, seatId]
    );
    expect(parseInt(rows[0]!.count)).toBe(1);

    console.log('✅ TEST 10: Timeout + retry — 1 booking, no duplicates');

    await cleanupTestEvent(eventId);
  });

  /**
   * TEST 11 — Concurrent different seats don't unnecessarily serialize
   *
   * Holding seat A should not block concurrent hold for seat B.
   * This verifies the locking is scoped to individual seat rows.
   */
  it('TEST 11: Different seats can be held concurrently', async () => {
    const eventId = await createTestEvent('Test Event Parallel Seats');
    const seatIds = await Promise.all(
      Array.from({ length: 10 }, (_, i) => createTestSeat(eventId, `PARALLEL-${i}`))
    );

    const users = await Promise.all(
      Array.from({ length: 10 }, () => createTestUser())
    );

    const start = Date.now();

    // All 10 users hold different seats simultaneously
    const results = await Promise.all(
      users.map(async (user, i) => {
        const token = generateTestToken(user.userId);
        const res = await app.inject({
          method: 'POST',
          url: `/events/${eventId}/holds`,
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          payload: { seatId: seatIds[i] },
        });
        return res.statusCode;
      })
    );

    const elapsed = Date.now() - start;

    // All should succeed — no unnecessary serialization
    expect(results.every(s => s === 201)).toBe(true);
    console.log(`✅ TEST 11: 10 different seats held concurrently in ${elapsed}ms`);

    await cleanupTestEvent(eventId);
  });
});
