import { FastifyInstance } from 'fastify';
import { WebhookService } from '../services/webhook.service.js';

export function webhookRoutes(app: FastifyInstance, webhookService: WebhookService) {
  app.post('/payments/webhook', {
    config: {
      rawBody: true,
    },
  }, async (request, reply) => {
    const signature = (request.headers['x-webhook-signature'] as string) || '';
    const rawBody = typeof request.body === 'string'
      ? request.body
      : JSON.stringify(request.body);

    const result = await webhookService.processWebhook(rawBody, signature);

    return reply.status(200).send({
      received: true,
      duplicate: result.duplicate,
    });
  });
}
