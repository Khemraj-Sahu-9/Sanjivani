/**
 * backend/src/middlewares/errorHandler.ts
 *
 * Centralized Express error handling middleware.
 *
 * Rules:
 * - This must be the LAST middleware registered in app.ts.
 * - Stack traces are only included in non-production responses.
 * - Client-facing error messages are sanitized in production.
 * - All errors are logged server-side with full context.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger.js';
import { config } from '../config/env.js';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export function createError(message: string, statusCode: number): AppError {
  const error: AppError = new Error(message);
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
}

// Express error handler — must have 4 parameters to be recognized as error middleware
export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  let statusCode = err.statusCode ?? 500;
  let message = err.message;

  if (err.name === 'ZodError') {
    statusCode = 400;
    message = (err as any).errors?.map((e: any) => e.message).join(', ') || err.message;
  }

  const isServerError = statusCode >= 500;

  // Always log the full error server-side
  if (isServerError) {
    logger.error('Unhandled server error', err);
  } else {
    logger.warn('Client error', { message, statusCode });
  }

  // Sanitize response for production
  const clientMessage =
    isServerError && config.isProduction
      ? 'An internal server error occurred. Please try again later.'
      : message;

  const responseBody: Record<string, unknown> = {
    status: 'error',
    message: clientMessage,
    error: clientMessage,
    ...(statusCode >= 400 && statusCode < 500 ? { code: statusCode } : {}),
  };

  // Include stack trace only in development
  if (!config.isProduction && err.stack) {
    responseBody['stack'] = err.stack;
  }

  res.status(statusCode).json(responseBody);
}
