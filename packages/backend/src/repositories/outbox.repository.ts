import { DbClient } from '../db/pool.js';
import { OutboxEvent } from '../types/index.js';

export class OutboxRepository {
  async insert(
    data: { topic: string; payload: Record<string, unknown> },
    client?: DbClient
  ): Promise<OutboxEvent> {
    const db = client || (await import('../db/pool.js')).getPool();
    const { rows } = await db.query(
      `INSERT INTO outbox (topic, payload) VALUES ($1, $2) RETURNING *`,
      [data.topic, JSON.stringify(data.payload)]
    );
    return rows[0]!;
  }

  /**
   * Fetch unpublished outbox events for processing.
   * Uses FOR UPDATE SKIP LOCKED so multiple workers don't process the same event.
   */
  async fetchUnpublished(limit: number = 50, client?: DbClient): Promise<OutboxEvent[]> {
    const db = client || (await import('../db/pool.js')).getPool();
    const { rows } = await db.query(
      `SELECT * FROM outbox
       WHERE published_at IS NULL
       ORDER BY created_at ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED`,
      [limit]
    );
    return rows;
  }

  async markPublished(ids: string[], client?: DbClient): Promise<void> {
    const db = client || (await import('../db/pool.js')).getPool();
    if (ids.length === 0) return;
    await db.query(
      `UPDATE outbox SET published_at = NOW() WHERE id = ANY($1)`,
      [ids]
    );
  }
}

export { EventRepository } from './event.repository.js';
export { SeatRepository } from './seat.repository.js';
export { HoldRepository } from './hold.repository.js';
export { BookingRepository } from './booking.repository.js';
export { PaymentRepository } from './payment.repository.js';
export { WebhookRepository } from './webhook.repository.js';
export { UserRepository } from './user.repository.js';
