/**
 * backend/src/middlewares/requestLogger.ts
 *
 * Logs incoming requests and their response status codes.
 *
 * Security rules:
 * - Does NOT log request bodies (may contain sensitive data).
 * - Does NOT log Authorization headers.
 * - Logs: method, path, status code, response time.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger.js';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path} → ${res.statusCode}`, {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: duration,
    });
  });

  next();
}
