/**
 * backend/src/controllers/syncController.ts
 *
 * Thin request/response controller for Phase 7 Offline Synchronization.
 * Validates inputs using schemas and delegates business logic to syncService.
 */

import { Request, Response, NextFunction } from 'express';
import { syncService } from '../services/syncService.js';
import {
  syncBatchSchema,
  resolveConflictSchema,
  syncDeltaQuerySchema,
} from '../validators/schemas.js';

export class SyncController {
  async processBatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const familyId = req.params.familyId as string;
      const userId = req.user!.id;
      const validated = syncBatchSchema.parse(req.body);

      const batchResult = await syncService.processBatch(familyId, userId, validated.operations);
      res.status(200).json({ success: true, ...batchResult });
    } catch (err) {
      next(err);
    }
  }

  async getSyncStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const familyId = req.params.familyId as string;
      const userId = req.user!.id;

      const status = await syncService.getSyncStatus(familyId, userId);
      res.status(200).json({ success: true, ...status });
    } catch (err) {
      next(err);
    }
  }

  async getSyncDelta(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const familyId = req.params.familyId as string;
      const userId = req.user!.id;
      const query = syncDeltaQuerySchema.parse(req.query);

      const sinceIso = query.since || '1970-01-01T00:00:00.000Z';
      const delta = await syncService.getSyncDelta(familyId, userId, sinceIso, query.patientProfileId);

      res.status(200).json({ success: true, ...delta });
    } catch (err) {
      next(err);
    }
  }

  async resolveConflict(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const familyId = req.params.familyId as string;
      const conflictId = req.params.conflictId as string;
      const userId = req.user!.id;
      const validated = resolveConflictSchema.parse(req.body);

      const resolved = await syncService.resolveConflict(
        familyId,
        userId,
        conflictId,
        validated.resolution,
        validated.resolvedValue
      );

      res.status(200).json({ success: true, conflict: resolved });
    } catch (err) {
      next(err);
    }
  }
}

export const syncController = new SyncController();
