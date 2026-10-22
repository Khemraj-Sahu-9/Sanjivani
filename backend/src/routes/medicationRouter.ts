/**
 * backend/src/routes/medicationRouter.ts
 *
 * Router registration for Medication Schedules, Doses, and Prescription Prefill.
 */

import { Router } from 'express';
import { requireAuth, requireFamilyRole } from '../middlewares/auth.js';
import * as medicationController from '../controllers/medicationController.js';

export const medicationRouter = Router({ mergeParams: true });

// Read operations: all family members (owner, adult, caregiver, guardian)
medicationRouter.get(
  '/prefill-candidates',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  medicationController.prefillFromPrescription
);

medicationRouter.get(
  '/patients/:patientProfileId/prefill/:documentId',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  medicationController.prefillFromPrescription
);

medicationRouter.get(
  '/doses',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  medicationController.listDoseOccurrences
);

medicationRouter.get(
  '/patients/:patientProfileId/doses',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  medicationController.listDoseOccurrences
);

medicationRouter.post(
  '/doses/generate',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'guardian']),
  medicationController.generateDoses
);

medicationRouter.post(
  '/doses/:occurrenceId/status',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  medicationController.recordDoseStatus
);

medicationRouter.patch(
  '/doses/:occurrenceId/status',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  medicationController.recordDoseStatus
);

medicationRouter.get(
  '/patients/:patientProfileId',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  medicationController.listSchedules
);

medicationRouter.get(
  '/details/:scheduleId',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  medicationController.getSchedule
);

medicationRouter.get(
  '/:scheduleId/history',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  medicationController.getScheduleHistory
);

medicationRouter.get(
  '/:scheduleId',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  medicationController.getSchedule
);

medicationRouter.get(
  '/',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  medicationController.listSchedules
);

// Schedule mutations: owner, adult, guardian
medicationRouter.post(
  '/:scheduleId/confirm',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'guardian']),
  medicationController.confirmSchedule
);

medicationRouter.post(
  '/:scheduleId/pause',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'guardian']),
  medicationController.pauseSchedule
);

medicationRouter.post(
  '/:scheduleId/resume',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'guardian']),
  medicationController.resumeSchedule
);

medicationRouter.post(
  '/:scheduleId/discontinue',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'guardian']),
  medicationController.discontinueSchedule
);

medicationRouter.put(
  '/:scheduleId',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'guardian']),
  medicationController.updateSchedule
);

medicationRouter.patch(
  '/:scheduleId',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'guardian']),
  medicationController.updateSchedule
);

medicationRouter.post(
  '/',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'guardian']),
  medicationController.createSchedule
);
