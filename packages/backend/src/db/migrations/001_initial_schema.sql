-- Migration 001: Initial Schema
-- Creates all core tables for the event booking system.
-- The most important constraint is the partial unique index on bookings
-- which guarantees at most one CONFIRMED booking per (event_id, seat_id).

-- ─── Users ──────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE user_role AS ENUM ('USER', 'ADMIN');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'USER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Events ─────────────────────────────────────────────────────────────────

CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(500) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  venue VARCHAR(500) NOT NULL,
  image_url TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  sales_open_at TIMESTAMPTZ NOT NULL,
  sales_close_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_starts_at ON events(starts_at);

-- ─── Seats ──────────────────────────────────────────────────────────────────

CREATE TYPE seat_status AS ENUM ('AVAILABLE', 'HELD', 'BOOKED');

CREATE TABLE seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  label VARCHAR(50) NOT NULL,
  section VARCHAR(50) NOT NULL DEFAULT 'General',
  "row" VARCHAR(10) NOT NULL DEFAULT 'A',
  number INT NOT NULL DEFAULT 1,
  tier VARCHAR(50) NOT NULL DEFAULT 'Standard',
  price_minor INT NOT NULL,
  status seat_status NOT NULL DEFAULT 'AVAILABLE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seat labels must be unique within an event
CREATE UNIQUE INDEX idx_seats_event_label ON seats(event_id, label);
CREATE INDEX idx_seats_event_id ON seats(event_id);

-- ─── Holds ──────────────────────────────────────────────────────────────────

CREATE TABLE holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seat_id UUID NOT NULL REFERENCES seats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_holds_seat_id ON holds(seat_id);
CREATE INDEX idx_holds_expires_at ON holds(expires_at);
CREATE INDEX idx_holds_user_id ON holds(user_id);

-- ─── Bookings ───────────────────────────────────────────────────────────────

CREATE TYPE booking_status AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED');

CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  seat_id UUID NOT NULL REFERENCES seats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hold_id UUID REFERENCES holds(id),
  status booking_status NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ CRITICAL INVARIANT: At most one CONFIRMED booking per (event, seat).   ║
-- ║ This partial unique index is the DATABASE-LEVEL guarantee.             ║
-- ║ Even if application logic has a bug, two servers race, or a worker     ║
-- ║ misbehaves, PostgreSQL will reject the second confirmed booking.       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
CREATE UNIQUE INDEX one_booking_per_seat
  ON bookings(event_id, seat_id)
  WHERE status = 'CONFIRMED';

CREATE INDEX idx_bookings_event_seat ON bookings(event_id, seat_id);
CREATE INDEX idx_bookings_user_id ON bookings(user_id);

-- ─── Payments ───────────────────────────────────────────────────────────────

CREATE TYPE payment_status AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'REFUNDED');

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  idempotency_key VARCHAR(255) NOT NULL UNIQUE,
  provider_ref VARCHAR(255),
  amount_minor INT NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  status payment_status NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_booking_id ON payments(booking_id);

-- ─── Webhook Events (Deduplication) ─────────────────────────────────────────

CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_event_id VARCHAR(255) NOT NULL UNIQUE,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhook_events_provider_event_id ON webhook_events(provider_event_id);

-- ─── Outbox ─────────────────────────────────────────────────────────────────

CREATE TABLE outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_outbox_unpublished ON outbox(created_at) WHERE published_at IS NULL;

-- ─── Idempotency Keys ───────────────────────────────────────────────────────

CREATE TABLE idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(255) NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES users(id),
  response_status INT NOT NULL,
  response_body JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Updated-at trigger ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_seats_updated_at BEFORE UPDATE ON seats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_holds_updated_at BEFORE UPDATE ON holds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
