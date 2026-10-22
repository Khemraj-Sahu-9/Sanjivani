/**
 * backend/src/routes/liveTestRouter.ts
 *
 * Express Router for Phase 6: Controlled Live Test Mode & Telephony Integration.
 */

import { Router } from 'express';
import { requireAuth, requireFamilyRole } from '../middlewares/auth.js';
import { liveTestController } from '../controllers/liveTestController.js';

export const liveTestRouter = Router({ mergeParams: true });

// Provider diagnostic health
liveTestRouter.get(
  '/health',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  liveTestController.getProviderHealth
);

// Recipients management
liveTestRouter.get(
  '/recipients',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  liveTestController.listRecipients
);

liveTestRouter.post(
  '/recipients',
  requireAuth,
  requireFamilyRole(['owner', 'adult']),
  liveTestController.addRecipient
);

liveTestRouter.post(
  '/recipients/:recipientId/verify',
  requireAuth,
  requireFamilyRole(['owner', 'adult']),
  liveTestController.verifyRecipient
);

liveTestRouter.post(
  '/recipients/:recipientId/consent',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  liveTestController.updateConsent
);

liveTestRouter.delete(
  '/recipients/:recipientId',
  requireAuth,
  requireFamilyRole(['owner', 'adult']),
  liveTestController.deleteRecipient
);

// Preflight preview inspection
liveTestRouter.get(
  '/preflight/:incidentId',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  liveTestController.getPreflight
);

// Live test dispatch
liveTestRouter.post(
  '/dispatch',
  requireAuth,
  requireFamilyRole(['owner', 'adult']),
  liveTestController.dispatchLiveTest
);

// Human acknowledgement
liveTestRouter.post(
  '/acknowledge/:auditLogId',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  liveTestController.recordHumanAcknowledgement
);

// Audit logs
liveTestRouter.get(
  '/logs',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  liveTestController.listAuditLogs
);
