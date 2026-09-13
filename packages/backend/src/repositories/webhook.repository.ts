import { DbClient } from '../db/pool.js';
import { WebhookEvent } from '../types/index.js';

export class WebhookRepository {
  /**
   * Attempt to insert a webhook event. If the provider_event_id already exists,
   * the UNIQUE constraint causes a conflict and we return null — indicating
   * this is a duplicate/replay. This is the deduplication mechanism.
   */
  async insertIfNotExists(
    data: { provider_event_id: string; event_type: string; payload: Record<string, unknown> },
    client?: DbClient
  ): Promise<WebhookEvent | null> {
    const db = client || (await import('../db/pool.js')).getPool();
    try {
      const { rows } = await db.query(
        `INSERT INTO webhook_events (provider_event_id, event_type, payload)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [data.provider_event_id, data.event_type, JSON.stringify(data.payload)]
      );
      return rows[0]!;
    } catch (err: unknown) {
      // Unique constraint violation = duplicate webhook
      if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
        return null;
      }
      throw err;
    }
  }

  async markProcessed(id: string, client?: DbClient): Promise<void> {
    const db = client || (await import('../db/pool.js')).getPool();
    await db.query(
      'UPDATE webhook_events SET processed_at = NOW() WHERE id = $1',
      [id]
    );
  }

  async findAll(
    page: number = 1,
    pageSize: number = 50,
    client?: DbClient
  ): Promise<{ data: WebhookEvent[]; total: number }> {
    const db = client || (await import('../db/pool.js')).getPool();
    const offset = (page - 1) * pageSize;

    const [{ rows }, { rows: [countRow] }] = await Promise.all([
      db.query(
        'SELECT * FROM webhook_events ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [pageSize, offset]
      ),
      db.query('SELECT COUNT(*) FROM webhook_events'),
    ]);

    return { data: rows, total: parseInt(countRow.count) };
  }
}
