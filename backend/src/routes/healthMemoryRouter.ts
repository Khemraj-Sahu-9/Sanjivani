/**
 * backend/src/routes/healthMemoryRouter.ts
 *
 * Router for AI Health Memory query, patient timeline,
 * lab trend analysis, and doctor summary generation.
 */

import { Router } from 'express';
import { requireAuth, requireFamilyRole } from '../middlewares/auth.js';
import * as healthMemoryController from '../controllers/healthMemoryController.js';

export const healthMemoryRouter = Router({ mergeParams: true });

// All routes require authenticated user and family role
healthMemoryRouter.use(requireAuth);

// Ask AI Health Memory question grounded in patient records
healthMemoryRouter.post(
  '/ask',
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  healthMemoryController.askHealthMemory
);

// Get Patient Chronological Medical History Timeline
healthMemoryRouter.get(
  '/patients/:patientProfileId/timeline',
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  healthMemoryController.getPatientTimeline
);

// Get Historical Laboratory Trend series
healthMemoryRouter.get(
  '/patients/:patientProfileId/lab-trends',
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  healthMemoryController.getLaboratoryTrends
);

// Preview Doctor Summary
healthMemoryRouter.post(
  '/doctor-summary/preview',
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  healthMemoryController.previewDoctorSummary
);

// Generate & Download Doctor Summary PDF
healthMemoryRouter.post(
  '/doctor-summary/pdf',
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  healthMemoryController.generateDoctorSummaryPdf
);

// List patient conversations
healthMemoryRouter.get(
  '/patients/:patientProfileId/conversations',
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  healthMemoryController.listPatientConversations
);

// Get conversation messages
healthMemoryRouter.get(
  '/conversations/:conversationId/messages',
  healthMemoryController.getConversationMessages
);
