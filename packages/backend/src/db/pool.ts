import pg from 'pg';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    const isCloud = config.DATABASE_URL.includes('neon.tech') || config.DATABASE_URL.includes('sslmode=require');
    pool = new Pool({
      connectionString: config.DATABASE_URL,
      max: 75,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 30000,
      ssl: isCloud ? { rejectUnauthorized: false } : undefined,
    });

    pool.on('error', (err) => {
      logger.error({ err }, 'Unexpected PostgreSQL pool error');
    });
  }
  return pool;
}

/**
 * Execute a function within a database transaction.
 * The transaction is automatically committed on success and rolled back on error.
 * The client is passed to the function so repositories can use it for transactional queries.
 */
export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Simple query helper for non-transactional reads.
 */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  return getPool().query<T>(text, params);
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export type { pg };
export type DbClient = pg.PoolClient | pg.Pool;
