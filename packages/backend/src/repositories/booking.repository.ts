import { DbClient } from '../db/pool.js';
import { Booking, BookingStatus } from '../types/index.js';

export class BookingRepository {
  async findById(id: string, client?: DbClient): Promise<Booking | null> {
    const db = client || (await import('../db/pool.js')).getPool();
    const { rows } = await db.query('SELECT * FROM bookings WHERE id = $1', [id]);
    return rows[0] || null;
  }

  async findByIdWithDetails(id: string, client?: DbClient): Promise<Record<string, unknown> | null> {
    const db = client || (await import('../db/pool.js')).getPool();
    const { rows } = await db.query(`
      SELECT
        b.*,
        e.name as event_name, e.venue, e.starts_at,
        s.label as seat_label, s.tier, s.price_minor, s.section,
        p.id as payment_id, p.status as payment_status, p.provider_ref, p.amount_minor as payment_amount
      FROM bookings b
      JOIN events e ON b.event_id = e.id
      JOIN seats s ON b.seat_id = s.id
      LEFT JOIN payments p ON p.booking_id = b.id
      WHERE b.id = $1
    `, [id]);
    return rows[0] || null;
  }

  async findByUserId(userId: string, client?: DbClient): Promise<Record<string, unknown>[]> {
    const db = client || (await import('../db/pool.js')).getPool();
    const { rows } = await db.query(`
      SELECT
        b.*,
        e.name as event_name, e.venue, e.starts_at,
        s.label as seat_label, s.tier, s.price_minor,
        p.status as payment_status
      FROM bookings b
      JOIN events e ON b.event_id = e.id
      JOIN seats s ON b.seat_id = s.id
      LEFT JOIN payments p ON p.booking_id = b.id
      WHERE b.user_id = $1
      ORDER BY b.created_at DESC
    `, [userId]);
    return rows;
  }

  /**
   * Check if a confirmed booking already exists for this seat.
   * The partial unique index provides the hard guarantee,
   * but this check provides a fast path for the application logic.
   */
  async hasConfirmedBooking(eventId: string, seatId: string, client?: DbClient): Promise<boolean> {
    const db = client || (await import('../db/pool.js')).getPool();
    const { rows } = await db.query(
      `SELECT id FROM bookings
       WHERE event_id = $1 AND seat_id = $2 AND status = 'CONFIRMED'
       LIMIT 1`,
      [eventId, seatId]
    );
    return rows.length > 0;
  }

  async create(
    data: { event_id: string; seat_id: string; user_id: string; hold_id?: string; status: BookingStatus },
    client?: DbClient
  ): Promise<Booking> {
    const db = client || (await import('../db/pool.js')).getPool();
    const { rows } = await db.query(
      `INSERT INTO bookings (event_id, seat_id, user_id, hold_id, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [data.event_id, data.seat_id, data.user_id, data.hold_id || null, data.status]
    );
    return rows[0]!;
  }

  async updateStatus(id: string, status: BookingStatus, client?: DbClient): Promise<Booking | null> {
    const db = client || (await import('../db/pool.js')).getPool();
    const { rows } = await db.query(
      `UPDATE bookings SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );
    return rows[0] || null;
  }

  /**
   * Admin: list all bookings with pagination.
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
          b.*,
          e.name as event_name,
          s.label as seat_label, s.tier,
          u.name as user_name, u.email as user_email,
          p.status as payment_status, p.amount_minor as payment_amount
        FROM bookings b
        JOIN events e ON b.event_id = e.id
        JOIN seats s ON b.seat_id = s.id
        JOIN users u ON b.user_id = u.id
        LEFT JOIN payments p ON p.booking_id = b.id
        ORDER BY b.created_at DESC
        LIMIT $1 OFFSET $2
      `, [pageSize, offset]),
      db.query('SELECT COUNT(*) FROM bookings'),
    ]);

    return { data: rows, total: parseInt(countRow.count) };
  }
}
