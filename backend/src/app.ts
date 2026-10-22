/**
 * backend/src/app.ts
 *
 * Express application setup.
 * This file configures middleware, routes, and error handling.
 * It exports the `app` instance for use by server.ts and tests.
 *
 * Middleware order (important — do not reorder):
 *   1. Security headers (helmet)
 *   2. CORS
 *   3. Body parsers
 *   4. Request logger
 *   5. API routes
 *   6. 404 handler
 *   7. Centralized error handler (must be last)
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/env.js';
import { logger } from './config/logger.js';
import { apiRouter } from './routes/index.js';
import { requestLogger } from './middlewares/requestLogger.js';
import { notFound } from './middlewares/notFound.js';
import { errorHandler } from './middlewares/errorHandler.js';

export const app = express();

// ── Security headers ──────────────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────
app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ── Body parsers ──────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Request logger ────────────────────────────────────────────────
app.use(requestLogger);

// ── API routes ────────────────────────────────────────────────────
app.use('/api', apiRouter);

// ── 404 handler ───────────────────────────────────────────────────
app.use(notFound);

// ── Centralized error handler (must be last) ──────────────────────
app.use(errorHandler);

logger.debug('Express application configured');
