import { DbClient } from '../db/pool.js';
import { Hold } from '../types/index.js';

export class HoldRepository {
  /**
   * Find the currently active hold for a seat.
   * A hold is active if it has not been released AND has not expired.
   * This is point-of-use expiration validation — even if the sweeper
   * hasn't cleaned up an expired hold, this query correctly excludes it.
   */
  async findActiveHoldForSeat(seatId: string, client?: DbClient): Promise<Hold | null> {
    const db = client || (await import('../db/pool.js')).getPool();
    const { rows } = await db.query(
      `SELECT * FROM holds
       WHERE seat_id = $1
         AND released_at IS NULL
         AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [seatId]
    );
    return rows[0] || null;
  }

  async findById(id: string, client?: DbClient): Promise<Hold | null> {
    const db = client || (await import('../db/pool.js')).getPool();
    const { rows } = await db.query('SELECT * FROM holds WHERE id = $1', [id]);
    return rows[0] || null;
  }

  async findByUserId(userId: string, client?: DbClient): Promise<Hold[]> {
    const db = client || (await import('../db/pool.js')).getPool();
    const { rows } = await db.query(
      `SELECT h.*, s.label as seat_label, s.tier, s.price_minor, s.event_id,
              e.name as event_name
       FROM holds h
       JOIN seats s ON h.seat_id = s.id
       JOIN events e ON s.event_id = e.id
       WHERE h.user_id = $1
         AND h.released_at IS NULL
         AND h.expires_at > NOW()
       ORDER BY h.created_at DESC`,
      [userId]
    );
    return rows;
  }

  async create(
    data: { seat_id: string; user_id: string; expires_at: Date },
    client?: DbClient
  ): Promise<Hold> {
    const db = client || (await import('../db/pool.js')).getPool();
    const { rows } = await db.query(
      `INSERT INTO holds (seat_id, user_id, expires_at)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [data.seat_id, data.user_id, data.expires_at]
    );
    return rows[0]!;
  }

  async release(id: string, client?: DbClient): Promise<Hold | null> {
    const db = client || (await import('../db/pool.js')).getPool();
    const { rows } = await db.query(
      `UPDATE holds SET released_at = NOW() WHERE id = $1 AND released_at IS NULL RETURNING *`,
      [id]
    );
    return rows[0] || null;
  }

  /**
   * Find all expired but unreleased holds — used by the background sweeper.
   */
  async findExpiredUnreleasedHolds(limit: number = 100, client?: DbClient): Promise<Hold[]> {
    const db = client || (await import('../db/pool.js')).getPool();
    const { rows } = await db.query(
      `SELECT * FROM holds
       WHERE released_at IS NULL
         AND expires_at <= NOW()
       ORDER BY expires_at ASC
       LIMIT $1`,
      [limit]
    );
    return rows;
  }

  /**
   * Release all expired holds and return their seat IDs for status update.
   * This runs inside the sweeper's transaction.
   */
  async releaseExpiredHolds(client: DbClient): Promise<string[]> {
    const { rows } = await client.query(
      `UPDATE holds
       SET released_at = NOW()
       WHERE released_at IS NULL AND expires_at <= NOW()
       RETURNING seat_id`
    );
    return rows.map(r => r.seat_id);
  }
}
