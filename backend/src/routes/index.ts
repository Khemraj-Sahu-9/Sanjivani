/**
 * backend/src/routes/index.ts
 *
 * Root API router. Registers all sub-routers under /api.
 */

import { Router } from 'express';
import { healthRouter } from './healthRouter.js';
import { authRouter } from './authRouter.js';
import { familyRouter } from './familyRouter.js';
import { telephonyRouter } from './telephonyRouter.js';
import { communityRouter } from './communityRouter.js';
import { pilotIntegrationRouter } from './pilotIntegrationRoutes.js';
import { demoEnvironmentRouter } from './demoEnvironmentRouter.js';

export const apiRouter = Router();

// Health check
apiRouter.use('/health', healthRouter);

// Phase 1: Authentication & Family Workspaces
apiRouter.use('/auth', authRouter);
apiRouter.use('/families', familyRouter);

// Phase 8: Health Community, Society Groups & Assistance
apiRouter.use('/communities', communityRouter);

// Phase 6: Public Telephony Callbacks
apiRouter.use('/telephony', telephonyRouter);
apiRouter.use('/v1/telephony', telephonyRouter);

// Phase 10: Pilot Integrations, Hospital Gateway, ABDM & DPDP Act
apiRouter.use('/pilot', pilotIntegrationRouter);

// Phase 11: Release Candidate Synthetic Demonstration Environment
apiRouter.use('/demo', demoEnvironmentRouter);
