/**
 * backend/src/routes/syncRouter.ts
 *
 * Express Router for Phase 7 Offline Synchronization & Conflict Handling.
 * Mounted at `/api/families/:familyId/sync`.
 */

import { Router } from 'express';
import { requireAuth, requireFamilyRole } from '../middlewares/auth.js';
import { syncController } from '../controllers/syncController.js';

export const syncRouter = Router({ mergeParams: true });

// Batch submit queued offline operations
syncRouter.post(
  '/batch',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  syncController.processBatch
);

// Get synchronization status & pending conflicts
syncRouter.get(
  '/status',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  syncController.getSyncStatus
);

// Retrieve authoritative delta changes since client's last sync timestamp
syncRouter.get(
  '/delta',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  syncController.getSyncDelta
);

// Resolve an outstanding sync conflict
syncRouter.post(
  '/conflicts/:conflictId/resolve',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'guardian']),
  syncController.resolveConflict
);
