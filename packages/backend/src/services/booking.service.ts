import { withTransaction } from '../db/pool.js';
import { BookingRepository } from '../repositories/booking.repository.js';
import { HoldRepository } from '../repositories/hold.repository.js';
import { SeatRepository } from '../repositories/seat.repository.js';
import { PaymentRepository } from '../repositories/payment.repository.js';
import { EventRepository } from '../repositories/event.repository.js';
import { OutboxRepository } from '../repositories/outbox.repository.js';
import { BookingStatus, PaymentStatus, SeatStatus, PaymentProvider } from '../types/index.js';
import {
  SeatUnavailableError,
  HoldExpiredError,
  NotFoundError,
  ForbiddenError,
  ValidationError,
} from '../lib/errors.js';
import { logger } from '../lib/logger.js';

interface CreateBookingInput {
  eventId: string;
  seatId: string;
  holdId: string;
  userId: string;
  idempotencyKey: string;
}

interface BookingResult {
  bookingId: string;
  paymentId: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  isIdempotentReplay: boolean;
}

export class BookingService {
  constructor(
    private bookingRepo: BookingRepository,
    private holdRepo: HoldRepository,
    private seatRepo: SeatRepository,
    private paymentRepo: PaymentRepository,
    private eventRepo: EventRepository,
    private outboxRepo: OutboxRepository,
    private paymentProvider: PaymentProvider
  ) {}

  /**
   * Confirm a booking. This is the most critical operation in the system.
   *
   * The flow:
   * 1. Check idempotency key — if we've seen this key before, return the cached result
   * 2. BEGIN TRANSACTION
   * 3. Lock the seat row (FOR UPDATE)
   * 4. Verify the hold exists, belongs to this user, and hasn't expired
   * 5. Verify no confirmed booking exists for this seat
   * 6. Create booking (status = CONFIRMED)
   * 7. Create payment record
   * 8. Process payment via provider
   * 9. Update payment status
   * 10. Update seat status to BOOKED
   * 11. Release the hold
   * 12. Insert outbox event
   * 13. Save idempotency result
   * 14. COMMIT
   *
   * Safety layers:
   * - Row-level lock prevents concurrent booking of the same seat
   * - Partial unique index (one_booking_per_seat) prevents duplicate CONFIRMED bookings
   *   even if application logic has a bug
   * - Idempotency key prevents duplicate bookings from retried requests
   * - Hold ownership check prevents user B from using user A's hold
   * - Point-of-use expiration check prevents booking with an expired hold
   */
  async createBooking(input: CreateBookingInput): Promise<BookingResult> {
    // Step 1: Idempotency check — return cached result if this key was already processed
    const existingPayment = await this.paymentRepo.findByIdempotencyKey(input.idempotencyKey);
    if (existingPayment) {
      const existingBooking = await this.bookingRepo.findById(existingPayment.booking_id);
      logger.info({ idempotencyKey: input.idempotencyKey, bookingId: existingPayment.booking_id }, 'idempotent_replay');
      return {
        bookingId: existingPayment.booking_id,
        paymentId: existingPayment.id,
        status: existingBooking?.status || BookingStatus.CONFIRMED,
        paymentStatus: existingPayment.status,
        isIdempotentReplay: true,
      };
    }

    return withTransaction(async (client) => {
      // Step 3: Lock the seat row
      const seat = await this.seatRepo.findByIdForUpdate(input.seatId, client);
      if (!seat) {
        throw new NotFoundError('Seat', input.seatId);
      }

      if (seat.event_id !== input.eventId) {
        throw new ValidationError('Seat does not belong to this event.');
      }

      // Step 4: Verify hold
      const hold = await this.holdRepo.findById(input.holdId, client);
      if (!hold) {
        throw new NotFoundError('Hold', input.holdId);
      }

      if (hold.user_id !== input.userId) {
        throw new ForbiddenError('This hold belongs to another user.');
      }

      if (hold.seat_id !== input.seatId) {
        throw new ValidationError('Hold does not match the requested seat.');
      }

      // Point-of-use expiration check
      if (hold.released_at || new Date(hold.expires_at) <= new Date()) {
        throw new HoldExpiredError();
      }

      // Step 5: Check for existing confirmed booking (app-level fast path)
      const hasConfirmed = await this.bookingRepo.hasConfirmedBooking(input.eventId, input.seatId, client);
      if (hasConfirmed) {
        throw new SeatUnavailableError();
      }

      // Step 6: Create booking
      // If this somehow races past the app check, the partial unique index catches it
      const booking = await this.bookingRepo.create(
        {
          event_id: input.eventId,
          seat_id: input.seatId,
          user_id: input.userId,
          hold_id: input.holdId,
          status: BookingStatus.CONFIRMED,
        },
        client
      );

      logger.info({ bookingId: booking.id, seatId: input.seatId, eventId: input.eventId }, 'booking_created');

      // Step 7: Create payment record
      const payment = await this.paymentRepo.create(
        {
          booking_id: booking.id,
          idempotency_key: input.idempotencyKey,
          amount_minor: seat.price_minor,
          status: PaymentStatus.PROCESSING,
        },
        client
      );

      // Step 8-9: Process payment
      try {
        const paymentResult = await this.paymentProvider.createPayment({
          amount_minor: seat.price_minor,
          currency: 'USD',
          idempotency_key: input.idempotencyKey,
          metadata: { bookingId: booking.id, seatId: input.seatId },
        });

        const paymentStatus = paymentResult.status === 'succeeded'
          ? PaymentStatus.SUCCEEDED
          : paymentResult.status === 'failed'
            ? PaymentStatus.FAILED
            : PaymentStatus.PENDING;

        await this.paymentRepo.updateStatus(payment.id, paymentStatus, paymentResult.provider_ref, client);

        logger.info({ paymentId: payment.id, status: paymentStatus, providerRef: paymentResult.provider_ref }, 'payment_processed');
      } catch (err) {
        // Payment provider error — mark payment as failed but keep booking
        // The webhook can still confirm payment later
        await this.paymentRepo.updateStatus(payment.id, PaymentStatus.FAILED, undefined, client);
        logger.error({ err, paymentId: payment.id }, 'payment_provider_error');
      }

      // Step 10: Update seat status
      await this.seatRepo.updateStatus(input.seatId, SeatStatus.BOOKED, client);

      // Step 11: Release the hold
      await this.holdRepo.release(input.holdId, client);

      // Step 12: Outbox
      await this.outboxRepo.insert(
        {
          topic: 'booking.confirmed',
          payload: {
            bookingId: booking.id,
            eventId: input.eventId,
            seatId: input.seatId,
            userId: input.userId,
            amount: seat.price_minor,
          },
        },
        client
      );

      return {
        bookingId: booking.id,
        paymentId: payment.id,
        status: booking.status,
        paymentStatus: PaymentStatus.SUCCEEDED,
        isIdempotentReplay: false,
      };
    });
  }

  async getBookingById(bookingId: string, userId: string) {
    const booking = await this.bookingRepo.findByIdWithDetails(bookingId);
    if (!booking) {
      throw new NotFoundError('Booking', bookingId);
    }
    // Users can only see their own bookings
    if (booking.user_id !== userId) {
      throw new ForbiddenError('You can only view your own bookings.');
    }
    return booking;
  }

  async getUserBookings(userId: string) {
    return this.bookingRepo.findByUserId(userId);
  }
}
