import { withTransaction } from '../db/pool.js';
import { OutboxRepository } from '../repositories/outbox.repository.js';
import { logger } from '../lib/logger.js';

/**
 * Outbox processor — processes unpublished outbox events.
 * In a production system, this would publish to a message broker.
 * Here it simply marks events as published (logged for observability).
 */
export async function processOutbox(): Promise<number> {
  const outboxRepo = new OutboxRepository();

  try {
    const processed = await withTransaction(async (client) => {
      const events = await outboxRepo.fetchUnpublished(50, client);

      if (events.length === 0) return 0;

      for (const event of events) {
        // In production: publish to Kafka/SQS/etc.
        // Here we just log it for observability
        logger.debug({ topic: event.topic, eventId: event.id }, 'outbox_event_published');
      }

      await outboxRepo.markPublished(
        events.map(e => e.id),
        client
      );

      return events.length;
    });

    if (processed > 0) {
      logger.info({ count: processed }, 'outbox_events_processed');
    }

    return processed;
  } catch (err) {
    logger.error({ err }, 'outbox_processing_error');
    return 0;
  }
}

export function startOutboxProcessor(intervalMs: number = 5000): NodeJS.Timeout {
  logger.info({ intervalMs }, 'outbox_processor_started');

  const timer = setInterval(async () => {
    await processOutbox();
  }, intervalMs);

  processOutbox();
  return timer;
}
