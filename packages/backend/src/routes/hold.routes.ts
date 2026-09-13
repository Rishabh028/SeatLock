import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { HoldService } from '../services/hold.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { AuthService } from '../services/auth.service.js';

const createHoldSchema = z.object({
  seatId: z.string().uuid(),
});

export function holdRoutes(
  app: FastifyInstance,
  holdService: HoldService,
  authService: AuthService
) {
  app.post('/events/:id/holds', {
    preHandler: [authMiddleware(authService)],
  }, async (request, reply) => {
    const { id: eventId } = request.params as { id: string };
    const { seatId } = createHoldSchema.parse(request.body);

    const hold = await holdService.createHold(eventId, seatId, request.userId!);

    return reply.status(201).send({
      data: {
        holdId: hold.id,
        seatId: hold.seat_id,
        expiresAt: hold.expires_at,
        status: 'HELD',
      },
    });
  });

  app.delete('/holds/:id', {
    preHandler: [authMiddleware(authService)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await holdService.releaseHold(id, request.userId!);
    return reply.status(204).send();
  });

  app.get('/holds', {
    preHandler: [authMiddleware(authService)],
  }, async (request, reply) => {
    const holds = await holdService.getActiveHoldsForUser(request.userId!);
    return reply.send({ data: holds });
  });
}
