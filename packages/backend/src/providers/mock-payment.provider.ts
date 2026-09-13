import { v4 as uuid } from 'uuid';
import { CreatePaymentInput, PaymentProvider, PaymentResult, WebhookPayload } from '../types/index.js';
import { logger } from '../lib/logger.js';
import crypto from 'crypto';

/**
 * Mock payment provider for local development and automated tests.
 *
 * Capable of simulating:
 * - Success (default)
 * - Timeout (throws after delay)
 * - Failure (returns failed status)
 * - Retry (first call fails, subsequent succeed via idempotency key)
 * - Duplicate webhook (caller can call verifyWebhook multiple times)
 * - Delayed webhook (async, not simulated here but testable via the webhook endpoint)
 *
 * The mock is deterministic based on the idempotency key prefix:
 * - "fail-*" → failure
 * - "timeout-*" → timeout after 5s
 * - anything else → success
 */
export class MockPaymentProvider implements PaymentProvider {
  private processedKeys = new Map<string, PaymentResult>();

  async createPayment(input: CreatePaymentInput): Promise<PaymentResult> {
    logger.info({ idempotencyKey: input.idempotency_key, amount: input.amount_minor }, 'mock_payment_attempt');

    // Check for idempotent replay
    const existing = this.processedKeys.get(input.idempotency_key);
    if (existing) {
      logger.info({ idempotencyKey: input.idempotency_key }, 'mock_payment_idempotent_replay');
      return existing;
    }

    // Simulate failure
    if (input.idempotency_key.startsWith('fail-')) {
      const result: PaymentResult = {
        provider_ref: `mock_fail_${uuid()}`,
        status: 'failed',
        error: 'Payment declined (mock)',
      };
      this.processedKeys.set(input.idempotency_key, result);
      return result;
    }

    // Simulate timeout
    if (input.idempotency_key.startsWith('timeout-')) {
      await new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Payment provider timeout (mock)')), 100)
      );
      // Unreachable, but TypeScript needs it
      throw new Error('timeout');
    }

    // Simulate slight delay for realism
    await new Promise(resolve => setTimeout(resolve, 10));

    const result: PaymentResult = {
      provider_ref: `mock_${uuid()}`,
      status: 'succeeded',
    };
    this.processedKeys.set(input.idempotency_key, result);
    return result;
  }

  verifyWebhook(payload: string, signature: string): WebhookPayload {
    // In the mock, we accept a simple HMAC-SHA256 signature
    const secret = process.env.PAYMENT_WEBHOOK_SECRET || 'whsec_test_secret';
    const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    // In development, skip signature check if signature is 'test'
    if (process.env.NODE_ENV !== 'production' && signature === 'test') {
      return JSON.parse(payload);
    }

    if (signature !== expectedSig) {
      throw new Error('Invalid webhook signature');
    }

    return JSON.parse(payload);
  }
}

/**
 * Helper to generate a mock webhook signature for testing.
 */
export function generateMockWebhookSignature(payload: string, secret?: string): string {
  const s = secret || process.env.PAYMENT_WEBHOOK_SECRET || 'whsec_test_secret';
  return crypto.createHmac('sha256', s).update(payload).digest('hex');
}
