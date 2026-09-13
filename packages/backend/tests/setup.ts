import 'dotenv/config';
import { beforeAll, afterAll } from 'vitest';
import { getPool, closePool } from '../src/db/pool.js';

beforeAll(async () => {
  // Verify database connectivity
  const pool = getPool();
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    console.error('❌ Cannot connect to database. Is Docker running?');
    console.error('Run: docker compose up -d && npm run db:migrate');
    throw err;
  }
});

afterAll(async () => {
  await closePool();
});
