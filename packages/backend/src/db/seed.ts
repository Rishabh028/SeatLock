import pg from 'pg';
import bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';
import 'dotenv/config';

async function seed() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('🌱 Seeding database...\n');

    // ─── Users ────────────────────────────────────────────────────────────
    const adminPassword = await bcrypt.hash('admin123', 10);
    const userPassword = await bcrypt.hash('user123', 10);

    const adminId = uuid();
    const user1Id = uuid();
    const user2Id = uuid();
    const user3Id = uuid();

    await pool.query(`
      INSERT INTO users (id, email, password_hash, name, role) VALUES
        ($1, 'admin@seatlock.dev', $5, 'Admin User', 'ADMIN'),
        ($2, 'alice@example.com', $6, 'Alice Johnson', 'USER'),
        ($3, 'bob@example.com', $6, 'Bob Smith', 'USER'),
        ($4, 'carol@example.com', $6, 'Carol Williams', 'USER')
      ON CONFLICT (email) DO NOTHING
    `, [adminId, user1Id, user2Id, user3Id, adminPassword, userPassword]);

    console.log('  ✅ Users created (admin@seatlock.dev / admin123, alice@example.com / user123)');

    // ─── Events ───────────────────────────────────────────────────────────
    const event1Id = uuid();
    const event2Id = uuid();
    const event3Id = uuid();
    const event4Id = uuid();

    const now = new Date();
    const inOneWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const inTwoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const inThreeWeeks = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000);
    const inFourWeeks = new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    await pool.query(`
      INSERT INTO events (id, name, description, venue, image_url, starts_at, sales_open_at) VALUES
        ($1, 'TechConf 2026', 'The premier technology conference featuring keynotes from industry leaders, hands-on workshops, and cutting-edge demos. Join 500+ developers for two days of learning and networking.', 'Grand Convention Center', '/images/techconf.jpg', $5, $9),
        ($2, 'Summer Music Festival', 'An unforgettable outdoor music experience featuring 20+ artists across 3 stages. Food trucks, art installations, and late-night DJ sets included.', 'Riverside Amphitheater', '/images/musicfest.jpg', $6, $9),
        ($3, 'Comedy Night Live', 'Stand-up comedy showcase featuring 5 headline comedians and 3 rising stars. Dinner and drinks available. Ages 18+.', 'Downtown Comedy Club', '/images/comedy.jpg', $7, $9),
        ($4, 'Startup Pitch Night', 'Watch 10 hand-picked startups pitch to a panel of top VCs. Network with founders, investors, and fellow tech enthusiasts. Light refreshments provided.', 'Innovation Hub', '/images/startup.jpg', $8, $9)
      ON CONFLICT DO NOTHING
    `, [event1Id, event2Id, event3Id, event4Id, inOneWeek, inTwoWeeks, inThreeWeeks, inFourWeeks, yesterday]);

    console.log('  ✅ 4 events created');

    // ─── Seats ────────────────────────────────────────────────────────────
    // Event 1 (TechConf): 200 seats — Front VIP, Middle Standard, Back Economy
    const seatValues: string[] = [];
    const seatParams: unknown[] = [];
    let paramIdx = 1;

    function addSeats(
      eventId: string,
      section: string,
      rowLabels: string[],
      seatsPerRow: number,
      tier: string,
      priceCents: number
    ) {
      for (const row of rowLabels) {
        for (let num = 1; num <= seatsPerRow; num++) {
          const label = `${row}${num}`;
          seatValues.push(
            `($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`
          );
          seatParams.push(uuid(), eventId, label, section, row, num, tier, priceCents);
        }
      }
    }

    // Event 1: 200 seats
    addSeats(event1Id, 'Front', ['A', 'B', 'C'], 10, 'VIP', 29900);          // 30 VIP
    addSeats(event1Id, 'Middle', ['D', 'E', 'F', 'G', 'H'], 15, 'Standard', 14900); // 75 Standard
    addSeats(event1Id, 'Back', ['J', 'K', 'L', 'M', 'N'], 19, 'Economy', 4900);     // 95 Economy

    // Event 2: 150 seats
    addSeats(event2Id, 'Floor', ['A', 'B', 'C', 'D'], 10, 'Floor', 19900);    // 40 Floor
    addSeats(event2Id, 'Stands', ['E', 'F', 'G', 'H', 'J'], 15, 'Stands', 9900); // 75 Stands
    addSeats(event2Id, 'Lawn', ['K', 'L'], 18, 'Lawn', 3900);                // 36 Lawn (total: 151)

    // Event 3: 80 seats
    addSeats(event3Id, 'Front Row', ['A', 'B'], 10, 'Premium', 7900);        // 20 Premium
    addSeats(event3Id, 'Main', ['C', 'D', 'E', 'F'], 15, 'Standard', 4900); // 60 Standard

    // Event 4: 60 seats
    addSeats(event4Id, 'Floor', ['A', 'B', 'C'], 10, 'General', 2900);      // 30 General
    addSeats(event4Id, 'Balcony', ['D', 'E', 'F'], 10, 'General', 1900);    // 30 General

    // Batch insert seats
    if (seatValues.length > 0) {
      await pool.query(
        `INSERT INTO seats (id, event_id, label, section, "row", number, tier, price_minor) VALUES ${seatValues.join(', ')} ON CONFLICT DO NOTHING`,
        seatParams
      );
    }

    console.log(`  ✅ ${seatValues.length} seats created across 4 events`);

    // ─── Pre-book some seats to make the demo interesting ─────────────────
    // Book a few seats for Alice (user1) on Event 1
    const { rows: aliceSeats } = await pool.query(
      `SELECT id, event_id, price_minor FROM seats WHERE event_id = $1 ORDER BY random() LIMIT 3`,
      [event1Id]
    );

    for (const seat of aliceSeats) {
      const bookingId = uuid();
      const paymentId = uuid();
      const idempKey = `seed-${bookingId}`;

      await pool.query(`
        INSERT INTO bookings (id, event_id, seat_id, user_id, status) VALUES ($1, $2, $3, $4, 'CONFIRMED')
      `, [bookingId, seat.event_id, seat.id, user1Id]);

      await pool.query(`
        UPDATE seats SET status = 'BOOKED' WHERE id = $1
      `, [seat.id]);

      await pool.query(`
        INSERT INTO payments (id, booking_id, idempotency_key, provider_ref, amount_minor, status)
        VALUES ($1, $2, $3, $4, $5, 'SUCCEEDED')
      `, [paymentId, bookingId, idempKey, `mock_${paymentId}`, seat.price_minor]);
    }

    console.log(`  ✅ ${aliceSeats.length} sample bookings created for Alice`);

    // ─── Summary ──────────────────────────────────────────────────────────
    const { rows: [stats] } = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM users) as users,
        (SELECT COUNT(*) FROM events) as events,
        (SELECT COUNT(*) FROM seats) as seats,
        (SELECT COUNT(*) FROM seats WHERE status = 'AVAILABLE') as available_seats,
        (SELECT COUNT(*) FROM bookings) as bookings,
        (SELECT COUNT(*) FROM payments) as payments
    `);

    console.log('\n📊 Database Summary:');
    console.log(`  Users:     ${stats.users}`);
    console.log(`  Events:    ${stats.events}`);
    console.log(`  Seats:     ${stats.seats} (${stats.available_seats} available)`);
    console.log(`  Bookings:  ${stats.bookings}`);
    console.log(`  Payments:  ${stats.payments}`);
    console.log('\n✅ Seed complete!');

  } finally {
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
