import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { v4 as uuid } from 'uuid';
import { ZodError } from 'zod';

import { config } from './config.js';
import { logger } from './lib/logger.js';
import { AppError } from './lib/errors.js';
import { getPool, query, closePool } from './db/pool.js';

// Repositories
import { EventRepository } from './repositories/event.repository.js';
import { SeatRepository } from './repositories/seat.repository.js';
import { HoldRepository } from './repositories/hold.repository.js';
import { BookingRepository } from './repositories/booking.repository.js';
import { PaymentRepository } from './repositories/payment.repository.js';
import { WebhookRepository } from './repositories/webhook.repository.js';
import { UserRepository } from './repositories/user.repository.js';
import { OutboxRepository } from './repositories/outbox.repository.js';

// Services
import { AuthService } from './services/auth.service.js';
import { HoldService } from './services/hold.service.js';
import { BookingService } from './services/booking.service.js';
import { WebhookService } from './services/webhook.service.js';

// Providers
import { MockPaymentProvider } from './providers/mock-payment.provider.js';
import { StripePaymentProvider } from './providers/stripe-payment.provider.js';

// Routes
import { authRoutes } from './routes/auth.routes.js';
import { eventRoutes } from './routes/event.routes.js';
import { holdRoutes } from './routes/hold.routes.js';
import { bookingRoutes } from './routes/booking.routes.js';
import { webhookRoutes } from './routes/webhook.routes.js';
import { adminRoutes } from './routes/admin.routes.js';

// Workers
import { startHoldSweeper } from './workers/hold-sweeper.js';
import { startOutboxProcessor } from './workers/outbox-processor.js';

export async function buildApp() {
  const app = Fastify({
    logger: false, // We use our own pino logger
    genReqId: () => uuid(),
    bodyLimit: 1048576, // 1MB
  });

  // ─── CORS ───────────────────────────────────────────────────────────────
  await app.register(cors, {
    origin: [config.APP_URL, 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Webhook-Signature'],
  });

  // ─── Rate Limiting ──────────────────────────────────────────────────────
  await app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX_REQUESTS,
    timeWindow: config.RATE_LIMIT_WINDOW_MS,
    keyGenerator: (request) => {
      return request.headers.authorization || request.ip;
    },
  });

  // ─── Request Logging ───────────────────────────────────────────────────
  app.addHook('onRequest', (request, reply, done) => {
    (request as unknown as Record<string, unknown>).__startTime = Date.now();
    logger.info({ requestId: request.id, method: request.method, path: request.url }, 'request_start');
    done();
  });

  app.addHook('onResponse', (request, reply, done) => {
    const duration = Date.now() - ((request as unknown as Record<string, unknown>).__startTime as number || 0);
    logger.info({
      requestId: request.id,
      method: request.method,
      path: request.url,
      status: reply.statusCode,
      duration,
    }, 'request_end');
    done();
  });

  // ─── Error Handler ──────────────────────────────────────────────────────
  app.setErrorHandler((error: any, request, reply) => {
    // Known application errors
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send(error.toResponse(request.id));
    }

    // Zod validation errors
    if (error instanceof ZodError) {
      return reply.status(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
          requestId: request.id,
        },
      });
    }

    // PostgreSQL unique constraint violation (safety net for double booking)
    if (error?.code === '23505') {
      logger.warn({ err: error, requestId: request.id }, 'unique_constraint_violation');
      return reply.status(409).send({
        error: {
          code: 'CONFLICT',
          message: 'This operation conflicts with an existing record.',
          requestId: request.id,
        },
      });
    }

    // Rate limit errors
    if (error?.statusCode === 429) {
      return reply.status(429).send({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please try again later.',
          requestId: request.id,
        },
      });
    }

    // Unknown errors — don't leak details
    logger.error({ err: error, requestId: request.id }, 'unhandled_error');
    return reply.status(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.',
        requestId: request.id,
      },
    });
  });

  // ─── Dependency Injection ──────────────────────────────────────────────
  const eventRepo = new EventRepository();
  const seatRepo = new SeatRepository();
  const holdRepo = new HoldRepository();
  const bookingRepo = new BookingRepository();
  const paymentRepo = new PaymentRepository();
  const webhookRepo = new WebhookRepository();
  const userRepo = new UserRepository();
  const outboxRepo = new OutboxRepository();

  const paymentProvider = config.PAYMENT_PROVIDER === 'stripe'
    ? new StripePaymentProvider(config.STRIPE_SECRET_KEY, config.STRIPE_WEBHOOK_SECRET)
    : new MockPaymentProvider();
  const authService = new AuthService(userRepo, config.JWT_SECRET, config.JWT_EXPIRES_IN, config.GOOGLE_CLIENT_ID);

  const holdService = new HoldService(
    holdRepo, seatRepo, bookingRepo, eventRepo, outboxRepo, config.HOLD_DURATION_SECONDS
  );
  const bookingService = new BookingService(
    bookingRepo, holdRepo, seatRepo, paymentRepo, eventRepo, outboxRepo, paymentProvider
  );
  const webhookService = new WebhookService(
    webhookRepo, paymentRepo, bookingRepo, seatRepo, paymentProvider
  );

  // ─── Health Check ──────────────────────────────────────────────────────
  app.get('/health', async (request, reply) => {
    try {
      await query('SELECT 1');
      return reply.send({
        status: 'ok',
        database: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    } catch {
      return reply.status(503).send({
        status: 'unhealthy',
        database: 'error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ─── Register Routes ──────────────────────────────────────────────────
  authRoutes(app, authService);
  eventRoutes(app, eventRepo, seatRepo, authService);
  holdRoutes(app, holdService, authService);
  bookingRoutes(app, bookingService, authService, paymentProvider);
  webhookRoutes(app, webhookService);
  adminRoutes(app, authService, bookingRepo, paymentRepo, webhookRepo, eventRepo, seatRepo, holdRepo);

  return { app, holdService, bookingService, webhookService, authService };
}

// ─── Start Server ──────────────────────────────────────────────────────────
async function main() {
  const { app } = await buildApp();

  // Start background workers
  const holdSweeperTimer = startHoldSweeper(30000);
  const outboxTimer = startOutboxProcessor(5000);

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
    clearInterval(holdSweeperTimer);
    clearInterval(outboxTimer);
    await app.close();
    await closePool();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  try {
    await app.listen({ port: config.API_PORT, host: '0.0.0.0' });
    logger.info({ port: config.API_PORT }, `🚀 SeatLock API running at http://localhost:${config.API_PORT}`);
  } catch (err) {
    logger.error(err, 'Failed to start server');
    process.exit(1);
  }
}

// Only start the server if this file is the entry point
const isMainModule = process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js');
if (isMainModule) {
  main();
}
