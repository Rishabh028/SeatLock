import { withTransaction } from '../db/pool.js';
import { WebhookRepository } from '../repositories/webhook.repository.js';
import { PaymentRepository } from '../repositories/payment.repository.js';
import { BookingRepository } from '../repositories/booking.repository.js';
import { SeatRepository } from '../repositories/seat.repository.js';
import { PaymentProvider, PaymentStatus, BookingStatus, SeatStatus } from '../types/index.js';
import { logger } from '../lib/logger.js';

export class WebhookService {
  constructor(
    private webhookRepo: WebhookRepository,
    private paymentRepo: PaymentRepository,
    private bookingRepo: BookingRepository,
    private seatRepo: SeatRepository,
    private paymentProvider: PaymentProvider
  ) {}

  /**
   * Process a payment webhook.
   *
   * Deduplication strategy:
   * 1. Verify the webhook signature (in production)
   * 2. Extract the provider_event_id from the payload
   * 3. Attempt to INSERT into webhook_events
   *    - If the UNIQUE constraint on provider_event_id rejects it,
   *      this is a duplicate → return 200 with no side effects
   *    - If the INSERT succeeds, process the event
   * 4. Update payment and booking status based on the webhook event type
   *
   * This guarantees:
   *   Webhook #1 → process
   *   Webhook #2 → no-op (UNIQUE constraint catches it)
   *   Webhook #3 → no-op
   */
  async processWebhook(rawPayload: string, signature: string): Promise<{ duplicate: boolean }> {
    // Step 1: Verify signature
    let webhookData;
    try {
      webhookData = this.paymentProvider.verifyWebhook(rawPayload, signature);
    } catch (err) {
      logger.warn({ err }, 'webhook_signature_invalid');
      throw err;
    }

    logger.info({
      providerEventId: webhookData.provider_event_id,
      eventType: webhookData.event_type,
    }, 'webhook_received');

    // Step 3: Attempt deduplication insert
    const webhookEvent = await this.webhookRepo.insertIfNotExists({
      provider_event_id: webhookData.provider_event_id,
      event_type: webhookData.event_type,
      payload: JSON.parse(rawPayload),
    });

    if (!webhookEvent) {
      // Duplicate — return 200 but don't process
      logger.info({ providerEventId: webhookData.provider_event_id }, 'webhook_duplicate');
      return { duplicate: true };
    }

    // Step 4: Process the event
    try {
      await this.processWebhookEvent(webhookData);
      await this.webhookRepo.markProcessed(webhookEvent.id);
    } catch (err) {
      logger.error({ err, providerEventId: webhookData.provider_event_id }, 'webhook_processing_error');
      throw err;
    }

    return { duplicate: false };
  }

  private async processWebhookEvent(data: {
    provider_event_id: string;
    event_type: string;
    payment_ref: string;
    status: 'succeeded' | 'failed';
  }) {
    const payment = await this.paymentRepo.findByProviderRef(data.payment_ref);
    if (!payment) {
      logger.warn({ providerRef: data.payment_ref }, 'webhook_payment_not_found');
      return;
    }

    if (data.status === 'succeeded') {
      await this.paymentRepo.updateStatus(payment.id, PaymentStatus.SUCCEEDED);
      await this.bookingRepo.updateStatus(payment.booking_id, BookingStatus.CONFIRMED);
      logger.info({ paymentId: payment.id, bookingId: payment.booking_id }, 'payment_succeeded_via_webhook');
    } else if (data.status === 'failed') {
      await this.paymentRepo.updateStatus(payment.id, PaymentStatus.FAILED);
      // Don't cancel the booking immediately — allow retry
      logger.info({ paymentId: payment.id, bookingId: payment.booking_id }, 'payment_failed_via_webhook');
    }
  }
}
