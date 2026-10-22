/**
 * backend/src/routes/healthRouter.ts
 *
 * Registers routes for the /api/health endpoint.
 *
 * Architecture rule: Routes register handlers only — no business logic here.
 */

import { Router } from 'express';
import { getHealth, getReady } from '../controllers/healthController.js';

export const healthRouter = Router();

healthRouter.get('/', getHealth);
healthRouter.get('/ready', getReady);
