/**
 * Test helper — creates isolated test data and provides cleanup.
 * Each test gets its own event, seats, and users to avoid cross-contamination.
 */
import { getPool } from '../../src/db/pool.js';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export async function createTestEvent(name?: string) {
  const pool = getPool();
  const eventId = uuid();
  const now = new Date();
  const startsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const salesOpenAt = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Already open

  await pool.query(
    `INSERT INTO events (id, name, description, venue, starts_at, sales_open_at)
     VALUES ($1, $2, 'Test event', 'Test Venue', $3, $4)`,
    [eventId, name || `Test Event ${eventId.slice(0, 8)}`, startsAt, salesOpenAt]
  );

  return eventId;
}

export async function createTestSeat(eventId: string, label?: string) {
  const pool = getPool();
  const seatId = uuid();
  const seatLabel = label || `S${Math.floor(Math.random() * 10000)}`;

  await pool.query(
    `INSERT INTO seats (id, event_id, label, section, "row", number, tier, price_minor)
     VALUES ($1, $2, $3, 'Test', 'A', 1, 'Standard', 9900)`,
    [seatId, eventId, seatLabel]
  );

  return seatId;
}

let cachedPasswordHash: string | null = null;

async function getTestPasswordHash(): Promise<string> {
  if (!cachedPasswordHash) {
    cachedPasswordHash = await bcrypt.hash('testpass123', 10);
  }
  return cachedPasswordHash;
}

export async function createTestUser(email?: string, role: 'USER' | 'ADMIN' = 'USER') {
  const pool = getPool();
  const userId = uuid();
  const userEmail = email || `test-${uuid().slice(0, 8)}@test.com`;
  const passwordHash = await getTestPasswordHash();

  await pool.query(
    `INSERT INTO users (id, email, password_hash, name, role)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, userEmail, passwordHash, `Test User ${userId.slice(0, 8)}`, role]
  );

  return { userId, email: userEmail };
}

export async function createTestUsers(count: number, role: 'USER' | 'ADMIN' = 'USER') {
  const pool = getPool();
  const passwordHash = await getTestPasswordHash();
  const users = Array.from({ length: count }, (_, i) => {
    const userId = uuid();
    const email = `conc-hold-${i}-${uuid().slice(0, 8)}@test.com`;
    return { userId, email, name: `Test User ${userId.slice(0, 8)}` };
  });

  const valueClauses = users.map((_, i) =>
    `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`
  ).join(', ');

  const flatParams = users.flatMap(u => [u.userId, u.email, passwordHash, u.name, role]);

  await pool.query(
    `INSERT INTO users (id, email, password_hash, name, role)
     VALUES ${valueClauses}`,
    flatParams
  );

  return users.map(u => ({ userId: u.userId, email: u.email }));
}

export function generateTestToken(userId: string, role: string = 'USER') {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET || 'change-me-in-production-use-a-64-char-random-string',
    { expiresIn: '1h' }
  );
}

/**
 * Cleanup test data for a specific event (cascades to seats, bookings, etc.)
 */
export async function cleanupTestEvent(eventId: string) {
  const pool = getPool();
  await pool.query('DELETE FROM events WHERE id = $1', [eventId]);
}

/**
 * Cleanup all test data (use sparingly)
 */
export async function cleanupAllTestData() {
  const pool = getPool();
  await pool.query(`DELETE FROM outbox`);
  await pool.query(`DELETE FROM webhook_events`);
  await pool.query(`DELETE FROM payments`);
  await pool.query(`DELETE FROM bookings`);
  await pool.query(`DELETE FROM holds`);
  await pool.query(`DELETE FROM seats`);
  await pool.query(`DELETE FROM events WHERE name LIKE 'Test Event%'`);
  await pool.query(`DELETE FROM idempotency_keys`);
  await pool.query(`DELETE FROM users WHERE email LIKE 'test-%@test.com'`);
}
