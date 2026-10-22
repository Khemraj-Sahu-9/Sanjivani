/**
 * backend/src/routes/familyRouter.ts
 *
 * Family workspace, memberships, patient profiles, documents,
 * AI health memory, timeline, and doctor summary routes.
 */

import { Router } from 'express';
import {
  createFamily,
  getUserFamilies,
  getFamily,
  updateFamily,
  getFamilyMembers,
  addMember,
  updateMemberRole,
  removeMember,
  createPatientProfile,
  getFamilyPatientProfiles,
  getPatientProfile,
  updatePatientProfile,
} from '../controllers/familyController.js';
import { requireAuth, requireFamilyRole } from '../middlewares/auth.js';
import { documentRouter } from './documentRouter.js';
import { healthMemoryRouter } from './healthMemoryRouter.js';
import { medicationRouter } from './medicationRouter.js';
import { appointmentRouter } from './appointmentRouter.js';
import { notificationRouter } from './notificationRouter.js';
import { sosRouter } from './sosRouter.js';
import { syncRouter } from './syncRouter.js';

export const familyRouter = Router();

// All family routes require authenticated user
familyRouter.use(requireAuth);

// Family workspace collection
familyRouter.get('/', getUserFamilies);
familyRouter.post('/', createFamily);

// Specific Family workspace
familyRouter.get('/:familyId', requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']), getFamily);
familyRouter.patch('/:familyId', requireFamilyRole(['owner']), updateFamily);

// Membership management
familyRouter.get('/:familyId/members', requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']), getFamilyMembers);
familyRouter.post('/:familyId/members', requireFamilyRole(['owner']), addMember);
familyRouter.patch('/:familyId/members/:userId', requireFamilyRole(['owner']), updateMemberRole);
familyRouter.delete('/:familyId/members/:userId', removeMember); // Owner or self can leave

// Patient Profiles within family
familyRouter.get(
  '/:familyId/patients',
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  getFamilyPatientProfiles
);
familyRouter.post(
  '/:familyId/patients',
  requireFamilyRole(['owner', 'adult', 'guardian']),
  createPatientProfile
);
familyRouter.get('/patients/:profileId', getPatientProfile);
familyRouter.patch('/patients/:profileId', updatePatientProfile);

// Phase 2: Medical Documents nested under family
familyRouter.use('/:familyId/documents', documentRouter);
familyRouter.use('/documents', documentRouter);

// Phase 3: AI Health Memory, Timeline, Lab Trends & Doctor Summary nested under family
familyRouter.use('/:familyId/memory', healthMemoryRouter);
familyRouter.use('/memory', healthMemoryRouter);

// Phase 4: Medication Schedules & Dose Tracking nested under family
familyRouter.use('/:familyId/medications', medicationRouter);
familyRouter.use('/medications', medicationRouter);

// Phase 4: Doctor Appointments nested under family
familyRouter.use('/:familyId/appointments', appointmentRouter);
familyRouter.use('/appointments', appointmentRouter);

// Phase 4: Notifications & Preferences nested under family
familyRouter.use('/:familyId/notifications', notificationRouter);
familyRouter.use('/notifications', notificationRouter);

// Phase 5: SOS Emergency Simulation & Hospital Handoff nested under family
familyRouter.use('/:familyId/sos', sosRouter);
familyRouter.use('/sos', sosRouter);

// Phase 7: Offline-First Synchronization & Conflicts nested under family
familyRouter.use('/:familyId/sync', syncRouter);
familyRouter.use('/sync', syncRouter);
