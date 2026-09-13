import { DbClient } from '../db/pool.js';
import { Payment, PaymentStatus } from '../types/index.js';

export class PaymentRepository {
  async findById(id: string, client?: DbClient): Promise<Payment | null> {
    const db = client || (await import('../db/pool.js')).getPool();
    const { rows } = await db.query('SELECT * FROM payments WHERE id = $1', [id]);
    return rows[0] || null;
  }

  async findByBookingId(bookingId: string, client?: DbClient): Promise<Payment | null> {
    const db = client || (await import('../db/pool.js')).getPool();
    const { rows } = await db.query(
      'SELECT * FROM payments WHERE booking_id = $1 ORDER BY created_at DESC LIMIT 1',
      [bookingId]
    );
    return rows[0] || null;
  }

  async findByIdempotencyKey(key: string, client?: DbClient): Promise<Payment | null> {
    const db = client || (await import('../db/pool.js')).getPool();
    const { rows } = await db.query(
      'SELECT * FROM payments WHERE idempotency_key = $1',
      [key]
    );
    return rows[0] || null;
  }

  async findByProviderRef(providerRef: string, client?: DbClient): Promise<Payment | null> {
    const db = client || (await import('../db/pool.js')).getPool();
    const { rows } = await db.query(
      'SELECT * FROM payments WHERE provider_ref = $1',
      [providerRef]
    );
    return rows[0] || null;
  }

  async create(
    data: {
      booking_id: string;
      idempotency_key: string;
      amount_minor: number;
      currency?: string;
      status?: PaymentStatus;
      provider_ref?: string;
    },
    client?: DbClient
  ): Promise<Payment> {
    const db = client || (await import('../db/pool.js')).getPool();
    const { rows } = await db.query(
      `INSERT INTO payments (booking_id, idempotency_key, amount_minor, currency, status, provider_ref)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        data.booking_id,
        data.idempotency_key,
        data.amount_minor,
        data.currency || 'USD',
        data.status || 'PENDING',
        data.provider_ref || null,
      ]
    );
    return rows[0]!;
  }

  async updateStatus(
    id: string,
    status: PaymentStatus,
    providerRef?: string,
    client?: DbClient
  ): Promise<Payment | null> {
    const db = client || (await import('../db/pool.js')).getPool();
    const { rows } = await db.query(
      `UPDATE payments SET status = $1, provider_ref = COALESCE($2, provider_ref) WHERE id = $3 RETURNING *`,
      [status, providerRef || null, id]
    );
    return rows[0] || null;
  }

  /**
   * Admin: list all payments with pagination.
   */
  async findAll(
    page: number = 1,
    pageSize: number = 50,
    client?: DbClient
  ): Promise<{ data: Record<string, unknown>[]; total: number }> {
    const db = client || (await import('../db/pool.js')).getPool();
    const offset = (page - 1) * pageSize;

    const [{ rows }, { rows: [countRow] }] = await Promise.all([
      db.query(`
        SELECT
          p.*,
          b.event_id, b.seat_id, b.user_id, b.status as booking_status,
          e.name as event_name,
          s.label as seat_label,
          u.name as user_name, u.email as user_email
        FROM payments p
        JOIN bookings b ON p.booking_id = b.id
        JOIN events e ON b.event_id = e.id
        JOIN seats s ON b.seat_id = s.id
        JOIN users u ON b.user_id = u.id
        ORDER BY p.created_at DESC
        LIMIT $1 OFFSET $2
      `, [pageSize, offset]),
      db.query('SELECT COUNT(*) FROM payments'),
    ]);

    return { data: rows, total: parseInt(countRow.count) };
  }
}
