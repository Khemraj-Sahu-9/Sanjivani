/**
 * backend/src/routes/telephonyRouter.ts
 *
 * Public webhook router for provider delivery and call status callbacks.
 * Signature validation is performed inside the service layer.
 */

import { Router } from 'express';
import { liveTestController } from '../controllers/liveTestController.js';

export const telephonyRouter = Router();

// Provider callback endpoint (e.g. /api/telephony/callbacks/twilio, /api/telephony/callbacks/exotel)
telephonyRouter.post('/callbacks/:provider', liveTestController.handleWebhook);
