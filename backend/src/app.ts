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
const allowedOrigins = config.frontendUrl
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const isAllowedOrigin = (origin: string | undefined): boolean => {
  // Allow non-browser requests (health checks, server-to-server, curl)
  if (!origin) return true;
  const normalized = origin.trim().replace(/\/+$/, '');
  if (allowedOrigins.includes(normalized)) return true;

  // In non-production environments, allow localhost / 127.0.0.1
  if (!config.isProduction && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalized)) {
    return true;
  }

  // If any allowed origin contains .vercel.app, permit Vercel preview deployments
  if (
    allowedOrigins.some((ao) => ao.includes('.vercel.app')) &&
    /^https:\/\/[a-zA-Z0-9_.-]+\.vercel\.app$/.test(normalized)
  ) {
    return true;
  }

  return false;
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        logger.warn(`[CORS] Blocked request from unauthorized origin: ${origin}`);
        callback(null, false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  })
);

// ── Root & Deployment Health Verification ─────────────────────────
app.get('/', (_req, res) => {
  res.status(200).json({
    name: 'Sanjivani — AI Health Memory Agent API',
    status: 'ok',
    version: '0.0.1',
    environment: config.nodeEnv,
    demo_mode: config.isDemoMode,
    health: '/api/health',
  });
});

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    demo_mode: config.isDemoMode,
  });
});

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
