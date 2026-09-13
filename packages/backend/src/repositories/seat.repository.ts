import { DbClient } from '../db/pool.js';
import { Seat, SeatStatus } from '../types/index.js';

export class SeatRepository {
  async findByEventId(eventId: string, client?: DbClient): Promise<Seat[]> {
    const db = client || (await import('../db/pool.js')).getPool();
    const { rows } = await db.query(
      `SELECT * FROM seats WHERE event_id = $1 ORDER BY section, "row", number`,
      [eventId]
    );
    return rows;
  }

  async findById(id: string, client?: DbClient): Promise<Seat | null> {
    const db = client || (await import('../db/pool.js')).getPool();
    const { rows } = await db.query('SELECT * FROM seats WHERE id = $1', [id]);
    return rows[0] || null;
  }

  /**
   * Lock a seat row using SELECT ... FOR UPDATE.
   * This is the critical concurrency mechanism: concurrent transactions
   * wanting the same seat will queue here instead of racing.
   * The lock is released when the transaction commits or rolls back.
   */
  async findByIdForUpdate(id: string, client: DbClient): Promise<Seat | null> {
    const { rows } = await client.query(
      'SELECT * FROM seats WHERE id = $1 FOR UPDATE',
      [id]
    );
    return rows[0] || null;
  }

  async updateStatus(id: string, status: SeatStatus, client?: DbClient): Promise<void> {
    const db = client || (await import('../db/pool.js')).getPool();
    await db.query('UPDATE seats SET status = $1 WHERE id = $2', [status, id]);
  }

  async bulkCreate(
    eventId: string,
    seats: Array<{ label: string; section: string; row: string; number: number; tier: string; price_minor: number }>,
    client?: DbClient
  ): Promise<Seat[]> {
    const db = client || (await import('../db/pool.js')).getPool();

    if (seats.length === 0) return [];

    const values: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    for (const seat of seats) {
      values.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
      params.push(eventId, seat.label, seat.section, seat.row, seat.number, seat.tier, seat.price_minor);
    }

    const { rows } = await db.query(
      `INSERT INTO seats (event_id, label, section, "row", number, tier, price_minor)
       VALUES ${values.join(', ')}
       RETURNING *`,
      params
    );
    return rows;
  }

  /**
   * Get seat availability summary for an event.
   */
  async getAvailabilitySummary(eventId: string, client?: DbClient): Promise<{
    total: number;
    available: number;
    held: number;
    booked: number;
    byTier: Array<{ tier: string; total: number; available: number; min_price: number; max_price: number }>;
  }> {
    const db = client || (await import('../db/pool.js')).getPool();

    const { rows: [summary] } = await db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'AVAILABLE') as available,
        COUNT(*) FILTER (WHERE status = 'HELD') as held,
        COUNT(*) FILTER (WHERE status = 'BOOKED') as booked
      FROM seats WHERE event_id = $1
    `, [eventId]);

    const { rows: tiers } = await db.query(`
      SELECT
        tier,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'AVAILABLE') as available,
        MIN(price_minor) as min_price,
        MAX(price_minor) as max_price
      FROM seats WHERE event_id = $1
      GROUP BY tier
      ORDER BY MIN(price_minor) DESC
    `, [eventId]);

    return {
      total: parseInt(summary.total),
      available: parseInt(summary.available),
      held: parseInt(summary.held),
      booked: parseInt(summary.booked),
      byTier: tiers.map(t => ({
        tier: t.tier,
        total: parseInt(t.total),
        available: parseInt(t.available),
        min_price: parseInt(t.min_price),
        max_price: parseInt(t.max_price),
      })),
    };
  }
}
