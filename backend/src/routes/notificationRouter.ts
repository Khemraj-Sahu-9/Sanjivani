/**
 * backend/src/routes/notificationRouter.ts
 *
 * Router registration for Notifications, Preferences, Caregiver Policies, and Background Scheduling.
 */

import { Router } from 'express';
import { requireAuth, requireFamilyRole } from '../middlewares/auth.js';
import * as notificationController from '../controllers/notificationController.js';

export const notificationRouter = Router({ mergeParams: true });

// User notification center (protected by family membership)
notificationRouter.get(
  '/',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  notificationController.listUserNotifications
);

notificationRouter.post(
  '/:notificationId/read',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  notificationController.markAsRead
);

notificationRouter.patch(
  '/:notificationId/read',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  notificationController.markAsRead
);

notificationRouter.post(
  '/:notificationId/acknowledge',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  notificationController.acknowledgeCaregiverAlert
);

notificationRouter.patch(
  '/:notificationId/acknowledge',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  notificationController.acknowledgeCaregiverAlert
);

// Notification preferences
notificationRouter.get(
  '/preferences',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  notificationController.getPreferences
);

notificationRouter.put(
  '/preferences',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  notificationController.updatePreferences
);

// Caregiver reminder policies
notificationRouter.get(
  '/caregiver-policies',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  notificationController.listCaregiverPolicies
);

notificationRouter.post(
  '/caregiver-policies',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'guardian']),
  notificationController.upsertCaregiverPolicy
);

notificationRouter.get(
  '/patients/:patientProfileId/caregivers',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  notificationController.listCaregiverPolicies
);

notificationRouter.post(
  '/patients/:patientProfileId/caregivers',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'guardian']),
  notificationController.upsertCaregiverPolicy
);

// Trigger scheduled jobs check (for background worker / test dispatcher)
notificationRouter.post(
  '/test-dispatch',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  notificationController.triggerSchedulerCheck
);

notificationRouter.post(
  '/scheduler/process-due',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  notificationController.triggerSchedulerCheck
);
