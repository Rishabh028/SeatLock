const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ApiOptions {
  method?: string;
  body?: unknown;
  token?: string;
  headers?: Record<string, string>;
}

class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public requestId?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function api<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, token, headers = {} } = options;

  const fetchHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (token) {
    fetchHeaders['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: fetchHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const errorData = data as { error?: { code?: string; message?: string; requestId?: string } } | null;
    throw new ApiError(
      res.status,
      errorData?.error?.code || 'UNKNOWN_ERROR',
      errorData?.error?.message || `Request failed with status ${res.status}`,
      errorData?.error?.requestId
    );
  }

  return data as T;
}

// ─── Auth ─────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export async function register(email: string, password: string, name: string) {
  return api<{ token: string; user: AuthUser }>('/auth/register', {
    method: 'POST',
    body: { email, password, name },
  });
}

export async function login(email: string, password: string) {
  return api<{ token: string; user: AuthUser }>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

// ─── Events ───────────────────────────────────────────────────────────────

export interface Event {
  id: string;
  name: string;
  description: string;
  venue: string;
  image_url: string | null;
  starts_at: string;
  sales_open_at: string;
  sales_close_at: string | null;
  created_at: string;
  availability?: {
    total: number;
    available: number;
    held: number;
    booked: number;
    byTier: Array<{ tier: string; total: number; available: number; min_price: number; max_price: number }>;
  };
}

export interface Seat {
  id: string;
  event_id: string;
  label: string;
  section: string;
  row: string;
  number: number;
  tier: string;
  price_minor: number;
  status: 'AVAILABLE' | 'HELD' | 'BOOKED';
}

export async function getEvents() {
  return api<{ data: Event[] }>('/events');
}

export async function getEvent(id: string) {
  return api<{ data: Event }>(`/events/${id}`);
}

export async function getEventSeats(eventId: string) {
  return api<{ data: Seat[] }>(`/events/${eventId}/seats`);
}

// ─── Holds ────────────────────────────────────────────────────────────────

export interface Hold {
  holdId: string;
  seatId: string;
  expiresAt: string;
  status: string;
}

export async function createHold(eventId: string, seatId: string, token: string) {
  return api<{ data: Hold }>(`/events/${eventId}/holds`, {
    method: 'POST',
    body: { seatId },
    token,
  });
}

export async function releaseHold(holdId: string, token: string) {
  return api(`/holds/${holdId}`, { method: 'DELETE', token });
}

export async function getMyHolds(token: string) {
  return api<{ data: Hold[] }>('/holds', { token });
}

// ─── Bookings ─────────────────────────────────────────────────────────────

export interface BookingResult {
  bookingId: string;
  paymentId: string;
  status: string;
  paymentStatus: string;
  isIdempotentReplay: boolean;
}

export interface BookingDetail {
  id: string;
  event_id: string;
  seat_id: string;
  user_id: string;
  status: string;
  created_at: string;
  event_name: string;
  venue: string;
  starts_at: string;
  seat_label: string;
  tier: string;
  price_minor: number;
  section: string;
  payment_id: string;
  payment_status: string;
  payment_amount: number;
}

export async function createBooking(
  eventId: string,
  seatId: string,
  holdId: string,
  idempotencyKey: string,
  token: string
) {
  return api<{ data: BookingResult }>('/bookings', {
    method: 'POST',
    body: { eventId, seatId, holdId },
    token,
    headers: { 'Idempotency-Key': idempotencyKey },
  });
}

export async function getMyBookings(token: string) {
  return api<{ data: BookingDetail[] }>('/bookings', { token });
}

export async function getBooking(id: string, token: string) {
  return api<{ data: BookingDetail }>(`/bookings/${id}`, { token });
}

// ─── Admin ────────────────────────────────────────────────────────────────

export async function getAdminStats(token: string) {
  return api<{ data: Record<string, string> }>('/admin/stats', { token });
}

export async function getAdminBookings(token: string, page = 1) {
  return api<{ data: Record<string, unknown>[]; total: number }>(`/admin/bookings?page=${page}`, { token });
}

export async function getAdminPayments(token: string, page = 1) {
  return api<{ data: Record<string, unknown>[]; total: number }>(`/admin/payments?page=${page}`, { token });
}

export async function getAdminWebhooks(token: string, page = 1) {
  return api<{ data: Record<string, unknown>[]; total: number }>(`/admin/webhooks?page=${page}`, { token });
}

export async function getAdminEvents(token: string) {
  return api<{ data: Event[] }>('/admin/events', { token });
}

export { ApiError };
