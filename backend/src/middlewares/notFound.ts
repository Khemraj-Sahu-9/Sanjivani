/**
 * backend/src/middlewares/notFound.ts
 *
 * 404 handler for routes that do not match any registered route.
 * Must be registered AFTER all routes, BEFORE the error handler.
 */

import { Request, Response, NextFunction } from 'express';
import { createError } from './errorHandler.js';

export function notFound(req: Request, _res: Response, next: NextFunction): void {
  next(createError(`Route not found: ${req.method} ${req.path}`, 404));
}
