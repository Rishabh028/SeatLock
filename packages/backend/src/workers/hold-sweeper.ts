import { withTransaction } from '../db/pool.js';
import { HoldRepository } from '../repositories/hold.repository.js';
import { SeatRepository } from '../repositories/seat.repository.js';
import { BookingRepository } from '../repositories/booking.repository.js';
import { SeatStatus } from '../types/index.js';
import { logger } from '../lib/logger.js';

/**
 * Hold expiration sweeper.
 *
 * This is Mechanism B for hold expiration. It periodically scans for
 * expired-but-unreleased holds and cleans them up.
 *
 * Mechanism A (point-of-use validation) ensures correctness even if
 * this sweeper is temporarily unavailable. The sweeper is responsible
 * for eventual cleanup so that the seat status column reflects reality.
 *
 * Why both mechanisms?
 * - Mechanism A: Guarantees an expired hold never blocks a booking attempt.
 *   Even with a stopped sweeper, the system remains correct.
 * - Mechanism B: Keeps the seat.status field accurate so the UI shows
 *   correct availability without needing to cross-reference holds.
 */
export async function sweepExpiredHolds(): Promise<number> {
  const holdRepo = new HoldRepository();
  const seatRepo = new SeatRepository();
  const bookingRepo = new BookingRepository();

  try {
    const released = await withTransaction(async (client) => {
      const seatIds = await holdRepo.releaseExpiredHolds(client);

      // For each released hold's seat, check if there's a confirmed booking.
      // If not, set status back to AVAILABLE.
      for (const seatId of seatIds) {
        const seat = await seatRepo.findById(seatId, client);
        if (seat && seat.status === SeatStatus.HELD) {
          const hasBooking = await bookingRepo.hasConfirmedBooking(seat.event_id, seatId, client);
          if (!hasBooking) {
            await seatRepo.updateStatus(seatId, SeatStatus.AVAILABLE, client);
          }
        }
      }

      return seatIds.length;
    });

    if (released > 0) {
      logger.info({ count: released }, 'holds_expired_and_released');
    }

    return released;
  } catch (err) {
    logger.error({ err }, 'hold_sweep_error');
    return 0;
  }
}

/**
 * Start the hold sweeper as a simple interval-based worker.
 * Runs every 30 seconds by default.
 */
export function startHoldSweeper(intervalMs: number = 30000): NodeJS.Timeout {
  logger.info({ intervalMs }, 'hold_sweeper_started');

  const timer = setInterval(async () => {
    await sweepExpiredHolds();
  }, intervalMs);

  // Run immediately on start
  sweepExpiredHolds();

  return timer;
}
