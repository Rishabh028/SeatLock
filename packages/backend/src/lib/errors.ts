import { ApiError } from '../types/index.js';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'AppError';
  }

  toResponse(requestId?: string): ApiError {
    return {
      error: {
        code: this.code,
        message: this.message,
        requestId,
      },
    };
  }
}

// ─── Specific Error Types ───────────────────────────────────────────────────

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(404, `${resource.toUpperCase()}_NOT_FOUND`, `${resource} not found${id ? `: ${id}` : ''}`);
  }
}

export class ConflictError extends AppError {
  constructor(code: string, message: string) {
    super(409, code, message);
  }
}

export class SeatUnavailableError extends ConflictError {
  constructor() {
    super('SEAT_UNAVAILABLE', 'The selected seat is no longer available.');
  }
}

export class HoldExpiredError extends ConflictError {
  constructor() {
    super('HOLD_EXPIRED', 'Your hold on this seat has expired. Please select a new seat.');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required.') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action.') {
    super(403, 'FORBIDDEN', message);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(422, 'VALIDATION_ERROR', message);
  }
}

export class RateLimitError extends AppError {
  constructor() {
    super(429, 'RATE_LIMITED', 'Too many requests. Please try again later.');
  }
}

export class IdempotencyConflictError extends AppError {
  constructor() {
    super(409, 'IDEMPOTENCY_CONFLICT', 'A request with a different payload but the same idempotency key is already being processed.');
  }
}

export class SalesNotOpenError extends AppError {
  constructor() {
    super(400, 'SALES_NOT_OPEN', 'Ticket sales are not currently open for this event.');
  }
}
