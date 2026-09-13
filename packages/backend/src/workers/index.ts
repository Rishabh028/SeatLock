import 'dotenv/config';
import { startHoldSweeper } from './hold-sweeper.js';
import { startOutboxProcessor } from './outbox-processor.js';
import { logger } from '../lib/logger.js';
import { closePool } from '../db/pool.js';

logger.info('Starting SeatLock background workers...');

const sweeperTimer = startHoldSweeper(15000); // Check every 15s
const outboxTimer = startOutboxProcessor(5000); // Check every 5s

logger.info('Background workers running.');

async function shutdown() {
  logger.info('Shutting down background workers...');
  clearInterval(sweeperTimer);
  clearInterval(outboxTimer);
  await closePool();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
