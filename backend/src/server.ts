/**
 * backend/src/server.ts
 *
 * Application entry point.
 * Starts the HTTP server after environment validation.
 *
 * This file is kept intentionally minimal:
 * - Validate environment (done by importing config)
 * - Import the configured app
 * - Start listening
 */

import { app } from './app.js';
import { config } from './config/env.js';
import { logger } from './config/logger.js';

logger.info('Health Memory Agent backend starting...');
logger.info(`Environment: ${config.nodeEnv}`);

if (config.isDemoMode) {
  logger.warn(
    'DEMO_MODE is enabled. Supabase credentials are not validated. ' +
      'Database operations will not be available.'
  );
}

const server = app.listen(config.port, () => {
  logger.info(`Server running on http://localhost:${config.port}`);
  logger.info(`Health check: http://localhost:${config.port}/api/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed.');
    process.exit(0);
  });
});
