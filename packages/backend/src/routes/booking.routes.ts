import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { BookingService } from '../services/booking.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { AuthService } from '../services/auth.service.js';
import { ValidationError } from '../lib/errors.js';
import { PaymentProvider } from '../types/index.js';
import { StripePaymentProvider } from '../providers/stripe-payment.provider.js';

const createBookingSchema = z.object({
  eventId: z.string().uuid(),
  seatId: z.string().uuid(),
  holdId: z.string().uuid(),
});

export function bookingRoutes(
  app: FastifyInstance,
  bookingService: BookingService,
  authService: AuthService,
  paymentProvider?: PaymentProvider
) {
  app.post('/bookings', {
    preHandler: [authMiddleware(authService)],
  }, async (request, reply) => {
    // Idempotency key is REQUIRED
    const idempotencyKey = request.headers['idempotency-key'] as string | undefined;
    if (!idempotencyKey) {
      throw new ValidationError('Idempotency-Key header is required.');
    }

    const body = createBookingSchema.parse(request.body);

    const result = await bookingService.createBooking({
      eventId: body.eventId,
      seatId: body.seatId,
      holdId: body.holdId,
      userId: request.userId!,
      idempotencyKey,
    });

    const statusCode = result.isIdempotentReplay ? 200 : 201;
    return reply.status(statusCode).send({ data: result });
  });

  app.post('/payments/create-intent', {
    preHandler: [authMiddleware(authService)],
  }, async (request, reply) => {
    const idempotencyKey = (request.headers['idempotency-key'] as string) || `ik_${Date.now()}`;
    const body = z.object({
      amountMinor: z.number().int().positive(),
      currency: z.string().default('usd'),
      metadata: z.record(z.string()).optional(),
    }).parse(request.body);

    let clientSecret = `pi_mock_${request.userId?.slice(0, 8)}_secret_demo`;
    let paymentIntentId = `pi_mock_${request.userId?.slice(0, 8)}`;

    if (paymentProvider instanceof StripePaymentProvider) {
      const intent = await paymentProvider.createPaymentIntentSecret(
        body.amountMinor,
        body.currency,
        idempotencyKey,
        body.metadata
      );
      clientSecret = intent.clientSecret;
      paymentIntentId = intent.paymentIntentId;
    }

    return reply.send({ data: { clientSecret, paymentIntentId } });
  });

  app.get('/bookings', {
    preHandler: [authMiddleware(authService)],
  }, async (request, reply) => {
    const bookings = await bookingService.getUserBookings(request.userId!);
    return reply.send({ data: bookings });
  });

  app.get('/bookings/:id', {
    preHandler: [authMiddleware(authService)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const booking = await bookingService.getBookingById(id, request.userId!);
    return reply.send({ data: booking });
  });
}
