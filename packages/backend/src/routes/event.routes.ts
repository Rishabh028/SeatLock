import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { EventRepository } from '../repositories/event.repository.js';
import { SeatRepository } from '../repositories/seat.repository.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { AuthService } from '../services/auth.service.js';
import { NotFoundError } from '../lib/errors.js';

const createEventSchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().default(''),
  venue: z.string().min(1).max(500),
  image_url: z.string().optional(),
  starts_at: z.string().datetime(),
  sales_open_at: z.string().datetime(),
  sales_close_at: z.string().datetime().optional(),
});

const updateEventSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  venue: z.string().min(1).max(500).optional(),
  image_url: z.string().optional(),
  starts_at: z.string().datetime().optional(),
  sales_open_at: z.string().datetime().optional(),
  sales_close_at: z.string().datetime().nullable().optional(),
});

export function eventRoutes(
  app: FastifyInstance,
  eventRepo: EventRepository,
  seatRepo: SeatRepository,
  authService: AuthService
) {
  // Public routes
  app.get('/events', async (request, reply) => {
    const events = await eventRepo.findAll();
    return reply.send({ data: events });
  });

  app.get('/events/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const event = await eventRepo.findById(id);
    if (!event) throw new NotFoundError('Event', id);

    const availability = await seatRepo.getAvailabilitySummary(id);
    return reply.send({ data: { ...event, availability } });
  });

  app.get('/events/:id/seats', async (request, reply) => {
    const { id } = request.params as { id: string };
    const event = await eventRepo.findById(id);
    if (!event) throw new NotFoundError('Event', id);

    const seats = await seatRepo.findByEventId(id);
    return reply.send({ data: seats });
  });

  // Admin routes
  app.post('/events', {
    preHandler: [authMiddleware(authService), adminMiddleware()],
  }, async (request, reply) => {
    const body = createEventSchema.parse(request.body);
    const event = await eventRepo.create({
      ...body,
      starts_at: new Date(body.starts_at),
      sales_open_at: new Date(body.sales_open_at),
      sales_close_at: body.sales_close_at ? new Date(body.sales_close_at) : undefined,
    });
    return reply.status(201).send({ data: event });
  });

  app.patch('/events/:id', {
    preHandler: [authMiddleware(authService), adminMiddleware()],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateEventSchema.parse(request.body);
    const update: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined) {
        update[key] = (key.endsWith('_at') && value) ? new Date(value as string) : value;
      }
    }

    const event = await eventRepo.update(id, update);
    if (!event) throw new NotFoundError('Event', id);
    return reply.send({ data: event });
  });

  app.delete('/events/:id', {
    preHandler: [authMiddleware(authService), adminMiddleware()],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = await eventRepo.delete(id);
    if (!deleted) throw new NotFoundError('Event', id);
    return reply.status(204).send();
  });
}
