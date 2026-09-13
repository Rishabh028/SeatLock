import { withTransaction } from '../db/pool.js';
import { HoldRepository } from '../repositories/hold.repository.js';
import { SeatRepository } from '../repositories/seat.repository.js';
import { BookingRepository } from '../repositories/booking.repository.js';
import { EventRepository } from '../repositories/event.repository.js';
import { OutboxRepository } from '../repositories/outbox.repository.js';
import { Hold, SeatStatus } from '../types/index.js';
import { SeatUnavailableError, NotFoundError, SalesNotOpenError, ForbiddenError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export class HoldService {
  constructor(
    private holdRepo: HoldRepository,
    private seatRepo: SeatRepository,
    private bookingRepo: BookingRepository,
    private eventRepo: EventRepository,
    private outboxRepo: OutboxRepository,
    private holdDurationSeconds: number
  ) {}

  /**
   * Create a hold on a seat.
   *
   * This is the first critical concurrency operation. The flow is:
   * 1. BEGIN TRANSACTION
   * 2. SELECT seat FOR UPDATE — acquires row lock, serializing concurrent attempts
   * 3. Verify event sales are open
   * 4. Check for active (unexpired) hold
   * 5. Check for confirmed booking
   * 6. If seat is unavailable, return 409
   * 7. Create hold with expiration timestamp
   * 8. Update seat status to HELD
   * 9. Insert outbox event
   * 10. COMMIT
   *
   * The row lock at step 2 is what prevents the check-then-act race:
   * without it, two requests could both see AVAILABLE and both create holds.
   */
  async createHold(eventId: string, seatId: string, userId: string): Promise<Hold> {
    return withTransaction(async (client) => {
      // Step 2: Lock the seat row — concurrent requests queue here
      const seat = await this.seatRepo.findByIdForUpdate(seatId, client);
      if (!seat) {
        throw new NotFoundError('Seat', seatId);
      }

      if (seat.event_id !== eventId) {
        throw new NotFoundError('Seat', seatId);
      }

      // Step 3: Verify sales are open
      const salesOpen = await this.eventRepo.areSalesOpen(eventId, client);
      if (!salesOpen) {
        throw new SalesNotOpenError();
      }

      // Step 4: Check for active hold (point-of-use expiration check)
      const activeHold = await this.holdRepo.findActiveHoldForSeat(seatId, client);
      if (activeHold) {
        logger.info({ seatId, holdId: activeHold.id, userId: activeHold.user_id }, 'seat_held_by_another_user');
        throw new SeatUnavailableError();
      }

      // Step 5: Check for confirmed booking
      const hasBooking = await this.bookingRepo.hasConfirmedBooking(eventId, seatId, client);
      if (hasBooking) {
        logger.info({ seatId, eventId }, 'seat_already_booked');
        throw new SeatUnavailableError();
      }

      // Step 7-8: Create hold and update seat status
      const expiresAt = new Date(Date.now() + this.holdDurationSeconds * 1000);
      const hold = await this.holdRepo.create(
        { seat_id: seatId, user_id: userId, expires_at: expiresAt },
        client
      );

      await this.seatRepo.updateStatus(seatId, SeatStatus.HELD, client);

      // Step 9: Outbox event for potential downstream consumers
      await this.outboxRepo.insert(
        {
          topic: 'hold.created',
          payload: { holdId: hold.id, seatId, eventId, userId, expiresAt: expiresAt.toISOString() },
        },
        client
      );

      logger.info({ holdId: hold.id, seatId, eventId, userId, expiresAt }, 'hold_created');
      return hold;
    });
  }

  /**
   * Release a hold. Only the hold owner can release it.
   */
  async releaseHold(holdId: string, userId: string): Promise<void> {
    return withTransaction(async (client) => {
      const hold = await this.holdRepo.findById(holdId, client);
      if (!hold) {
        throw new NotFoundError('Hold', holdId);
      }

      if (hold.user_id !== userId) {
        throw new ForbiddenError('You can only release your own holds.');
      }

      if (hold.released_at) {
        return; // Already released — idempotent
      }

      await this.holdRepo.release(holdId, client);

      // Only reset seat to AVAILABLE if no confirmed booking exists
      const seat = await this.seatRepo.findByIdForUpdate(hold.seat_id, client);
      if (seat) {
        const hasBooking = await this.bookingRepo.hasConfirmedBooking(seat.event_id, seat.id, client);
        if (!hasBooking) {
          await this.seatRepo.updateStatus(hold.seat_id, SeatStatus.AVAILABLE, client);
        }
      }

      await this.outboxRepo.insert(
        { topic: 'hold.released', payload: { holdId, seatId: hold.seat_id, userId } },
        client
      );

      logger.info({ holdId, seatId: hold.seat_id, userId }, 'hold_released');
    });
  }

  async getActiveHoldsForUser(userId: string): Promise<Hold[]> {
    return this.holdRepo.findByUserId(userId);
  }
}
