/**
 * backend/src/routes/demoEnvironmentRouter.ts
 *
 * Dedicated router for synthetic demonstration environment management.
 */

import { Router } from 'express';
import { requireAuth, requireFamilyRole } from '../middlewares/auth.js';
import {
  getDemoStatus,
  seedDemoEnvironment,
  resetDemoEnvironment,
} from '../controllers/demoEnvironmentController.js';

export const demoEnvironmentRouter = Router();

// Public demo status check
demoEnvironmentRouter.get('/status', getDemoStatus);

// Authenticated demonstration seeding & reset
demoEnvironmentRouter.post('/seed', requireAuth, seedDemoEnvironment);
demoEnvironmentRouter.post(
  '/families/:familyId/patients/:patientId/reset',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'guardian']),
  resetDemoEnvironment
);
