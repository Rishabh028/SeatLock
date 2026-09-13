// ─── Domain Types ───────────────────────────────────────────────────────────
// These types represent the core domain model. They are used across services,
// repositories, and routes. Enums are string-based to match PostgreSQL enum values.

export enum SeatStatus {
  AVAILABLE = 'AVAILABLE',
  HELD = 'HELD',
  BOOKED = 'BOOKED',
}

export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

// ─── Entity Types ───────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: UserRole;
  created_at: Date;
  updated_at: Date;
}

export interface Event {
  id: string;
  name: string;
  description: string;
  venue: string;
  image_url: string | null;
  starts_at: Date;
  sales_open_at: Date;
  sales_close_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Seat {
  id: string;
  event_id: string;
  label: string;
  section: string;
  row: string;
  number: number;
  tier: string;
  price_minor: number; // Price in minor units (cents)
  status: SeatStatus;
  created_at: Date;
  updated_at: Date;
}

export interface Hold {
  id: string;
  seat_id: string;
  user_id: string;
  expires_at: Date;
  released_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Booking {
  id: string;
  event_id: string;
  seat_id: string;
  user_id: string;
  hold_id: string | null;
  status: BookingStatus;
  created_at: Date;
  updated_at: Date;
}

export interface Payment {
  id: string;
  booking_id: string;
  idempotency_key: string;
  provider_ref: string | null;
  amount_minor: number;
  currency: string;
  status: PaymentStatus;
  created_at: Date;
  updated_at: Date;
}

export interface WebhookEvent {
  id: string;
  provider_event_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  processed_at: Date | null;
  created_at: Date;
}

export interface OutboxEvent {
  id: string;
  topic: string;
  payload: Record<string, unknown>;
  published_at: Date | null;
  created_at: Date;
}

export interface IdempotencyRecord {
  id: string;
  key: string;
  response_status: number;
  response_body: Record<string, unknown>;
  created_at: Date;
}

// ─── API Types ──────────────────────────────────────────────────────────────

export interface ApiError {
  error: {
    code: string;
    message: string;
    requestId?: string;
  };
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ─── Payment Provider Types ─────────────────────────────────────────────────

export interface CreatePaymentInput {
  amount_minor: number;
  currency: string;
  idempotency_key: string;
  metadata?: Record<string, string>;
}

export interface PaymentResult {
  provider_ref: string;
  status: 'succeeded' | 'failed' | 'pending';
  error?: string;
}

export interface WebhookPayload {
  provider_event_id: string;
  event_type: string;
  payment_ref: string;
  status: 'succeeded' | 'failed';
  metadata?: Record<string, string>;
}

export interface PaymentProvider {
  createPayment(input: CreatePaymentInput): Promise<PaymentResult>;
  verifyWebhook(payload: string, signature: string): WebhookPayload;
}
