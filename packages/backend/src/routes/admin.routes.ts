import { FastifyInstance } from 'fastify';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { AuthService } from '../services/auth.service.js';
import { BookingRepository } from '../repositories/booking.repository.js';
import { PaymentRepository } from '../repositories/payment.repository.js';
import { WebhookRepository } from '../repositories/webhook.repository.js';
import { EventRepository } from '../repositories/event.repository.js';
import { SeatRepository } from '../repositories/seat.repository.js';
import { HoldRepository } from '../repositories/hold.repository.js';
import { query } from '../db/pool.js';

export function adminRoutes(
  app: FastifyInstance,
  authService: AuthService,
  bookingRepo: BookingRepository,
  paymentRepo: PaymentRepository,
  webhookRepo: WebhookRepository,
  eventRepo: EventRepository,
  seatRepo: SeatRepository,
  holdRepo: HoldRepository
) {
  const preHandler = [authMiddleware(authService), adminMiddleware()];

  app.get('/admin/stats', { preHandler }, async (request, reply) => {
    const { rows: [stats] } = await query(`
      SELECT
        (SELECT COUNT(*) FROM events) as total_events,
        (SELECT COUNT(*) FROM seats) as total_seats,
        (SELECT COUNT(*) FROM seats WHERE status = 'AVAILABLE') as available_seats,
        (SELECT COUNT(*) FROM seats WHERE status = 'HELD') as held_seats,
        (SELECT COUNT(*) FROM seats WHERE status = 'BOOKED') as booked_seats,
        (SELECT COUNT(*) FROM holds WHERE released_at IS NULL AND expires_at > NOW()) as active_holds,
        (SELECT COUNT(*) FROM holds WHERE released_at IS NOT NULL OR expires_at <= NOW()) as expired_holds,
        (SELECT COUNT(*) FROM bookings) as total_bookings,
        (SELECT COUNT(*) FROM bookings WHERE status = 'CONFIRMED') as confirmed_bookings,
        (SELECT COUNT(*) FROM bookings WHERE status = 'CANCELLED') as cancelled_bookings,
        (SELECT COUNT(*) FROM payments) as total_payments,
        (SELECT COUNT(*) FROM payments WHERE status = 'SUCCEEDED') as successful_payments,
        (SELECT COUNT(*) FROM payments WHERE status = 'FAILED') as failed_payments,
        (SELECT COUNT(*) FROM webhook_events) as total_webhooks,
        (SELECT COUNT(*) FROM webhook_events WHERE processed_at IS NOT NULL) as processed_webhooks
    `);

    return reply.send({ data: stats });
  });

  app.get('/admin/bookings', { preHandler }, async (request, reply) => {
    const { page = '1', pageSize = '50' } = request.query as { page?: string; pageSize?: string };
    const result = await bookingRepo.findAll(parseInt(page), parseInt(pageSize));
    return reply.send({
      data: result.data,
      total: result.total,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
    });
  });

  app.get('/admin/payments', { preHandler }, async (request, reply) => {
    const { page = '1', pageSize = '50' } = request.query as { page?: string; pageSize?: string };
    const result = await paymentRepo.findAll(parseInt(page), parseInt(pageSize));
    return reply.send({
      data: result.data,
      total: result.total,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
    });
  });

  app.get('/admin/webhooks', { preHandler }, async (request, reply) => {
    const { page = '1', pageSize = '50' } = request.query as { page?: string; pageSize?: string };
    const result = await webhookRepo.findAll(parseInt(page), parseInt(pageSize));
    return reply.send({
      data: result.data,
      total: result.total,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
    });
  });

  app.get('/admin/events', { preHandler }, async (request, reply) => {
    const events = await eventRepo.findAll();
    const eventsWithStats = await Promise.all(
      events.map(async (event) => {
        const availability = await seatRepo.getAvailabilitySummary(event.id);
        return { ...event, availability };
      })
    );
    return reply.send({ data: eventsWithStats });
  });
}
