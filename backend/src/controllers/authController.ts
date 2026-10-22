/**
 * backend/src/controllers/authController.ts
 *
 * Thin controller for authentication endpoints.
 */

import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService.js';
import { registerSchema, loginSchema, passwordResetRequestSchema } from '../validators/schemas.js';

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const validated = registerSchema.parse(req.body);
    const result = await authService.register(
      validated.email,
      validated.password,
      validated.fullName,
      validated.phone
    );
    res.status(201).json({
      status: 'success',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const validated = loginSchema.parse(req.body);
    const result = await authService.login(validated.email, validated.password);
    res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function getCurrentUser(req: Request, res: Response): Promise<void> {
  res.status(200).json({
    status: 'success',
    data: { user: req.user },
  });
}

export async function requestPasswordReset(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const validated = passwordResetRequestSchema.parse(req.body);
    const result = await authService.requestPasswordReset(validated.email);
    res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}
