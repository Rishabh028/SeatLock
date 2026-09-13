import { DbClient, query } from '../db/pool.js';
import { Event } from '../types/index.js';

export class EventRepository {
  async findAll(client?: DbClient): Promise<Event[]> {
    const db = client || (await import('../db/pool.js')).getPool();
    const { rows } = await db.query(
      `SELECT * FROM events ORDER BY starts_at ASC`
    );
    return rows;
  }

  async findById(id: string, client?: DbClient): Promise<Event | null> {
    const db = client || (await import('../db/pool.js')).getPool();
    const { rows } = await db.query('SELECT * FROM events WHERE id = $1', [id]);
    return rows[0] || null;
  }

  async create(
    data: { name: string; description: string; venue: string; image_url?: string; starts_at: Date; sales_open_at: Date; sales_close_at?: Date },
    client?: DbClient
  ): Promise<Event> {
    const db = client || (await import('../db/pool.js')).getPool();
    const { rows } = await db.query(
      `INSERT INTO events (name, description, venue, image_url, starts_at, sales_open_at, sales_close_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [data.name, data.description, data.venue, data.image_url || null, data.starts_at, data.sales_open_at, data.sales_close_at || null]
    );
    return rows[0]!;
  }

  async update(
    id: string,
    data: Partial<{ name: string; description: string; venue: string; image_url: string; starts_at: Date; sales_open_at: Date; sales_close_at: Date | null }>,
    client?: DbClient
  ): Promise<Event | null> {
    const db = client || (await import('../db/pool.js')).getPool();
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        fields.push(`${key === 'sales_close_at' ? 'sales_close_at' : key} = $${idx++}`);
        values.push(value);
      }
    }

    if (fields.length === 0) return this.findById(id, client);

    values.push(id);
    const { rows } = await db.query(
      `UPDATE events SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return rows[0] || null;
  }

  async delete(id: string, client?: DbClient): Promise<boolean> {
    const db = client || (await import('../db/pool.js')).getPool();
    const { rowCount } = await db.query('DELETE FROM events WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  }

  /**
   * Check if sales are currently open for an event.
   * Used during hold/booking validation.
   */
  async areSalesOpen(eventId: string, client?: DbClient): Promise<boolean> {
    const db = client || (await import('../db/pool.js')).getPool();
    const { rows } = await db.query(
      `SELECT id FROM events
       WHERE id = $1
         AND sales_open_at <= NOW()
         AND (sales_close_at IS NULL OR sales_close_at > NOW())
         AND starts_at > NOW()`,
      [eventId]
    );
    return rows.length > 0;
  }
}
