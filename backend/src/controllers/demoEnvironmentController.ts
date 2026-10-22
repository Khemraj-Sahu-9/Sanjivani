/**
 * backend/src/controllers/demoEnvironmentController.ts
 *
 * Controller for synthetic demonstration environment seeding and reset.
 */

import { Request, Response, NextFunction } from 'express';
import { demoEnvironmentService } from '../services/demoEnvironmentService.js';
import { config } from '../config/env.js';

export async function getDemoStatus(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    res.status(200).json({
      success: true,
      demoMode: config.isDemoMode,
      environment: config.nodeEnv,
      safetyNotice:
        'All synthetic demonstration workflows are isolated. Emergency responses and hospital handoffs are strictly simulated.',
    });
  } catch (err) {
    next(err);
  }
}

export async function seedDemoEnvironment(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    const seeded = await demoEnvironmentService.seedDemoEnvironment(userId);
    res.status(201).json({ success: true, seeded });
  } catch (err) {
    next(err);
  }
}

export async function resetDemoEnvironment(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    const familyId = req.params.familyId as string;
    const patientId = req.params.patientId as string;
    const result = await demoEnvironmentService.resetDemoEnvironment(
      userId,
      familyId,
      patientId
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
