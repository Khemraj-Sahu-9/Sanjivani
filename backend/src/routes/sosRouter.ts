/**
 * backend/src/routes/sosRouter.ts
 *
 * Express Router for Phase 5: SOS Emergency Simulation & Hospital Handoff.
 */

import { Router } from 'express';
import { requireAuth, requireFamilyRole } from '../middlewares/auth.js';
import { sosController } from '../controllers/sosController.js';
import { liveTestRouter } from './liveTestRouter.js';

export const sosRouter = Router({ mergeParams: true });

// Phase 6: Controlled Live Test Mode nested under /sos/live-test
sosRouter.use('/live-test', liveTestRouter);

// Read operations: all family roles
sosRouter.get(
  '/active',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  sosController.getActiveIncident
);

sosRouter.get(
  '/incidents',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  sosController.listIncidents
);

sosRouter.get(
  '/incidents/:incidentId',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  sosController.getIncident
);

sosRouter.get(
  '/contacts',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  sosController.listContacts
);

sosRouter.get(
  '/policy',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  sosController.getPolicy
);

// Trigger SOS: owner, adult, caregiver, guardian
sosRouter.post(
  '/trigger',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  sosController.triggerSos
);

// Acknowledgements (Simulated)
sosRouter.post(
  '/incidents/:incidentId/attempts/:attemptId/acknowledge',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  sosController.acknowledgeContact
);

sosRouter.post(
  '/incidents/:incidentId/caregiver/acknowledge',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  sosController.acknowledgeCaregiver
);

sosRouter.post(
  '/incidents/:incidentId/hospital/acknowledge',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  sosController.acknowledgeHospitalDesk
);

// Demo Controls: advance timeout
sosRouter.post(
  '/incidents/:incidentId/advance',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  sosController.advanceTimeout
);

// Resolve & Cancel
sosRouter.post(
  '/incidents/:incidentId/resolve',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  sosController.resolveIncident
);

sosRouter.post(
  '/incidents/:incidentId/cancel',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  sosController.cancelIncident
);

// Demo Seed & Reset
sosRouter.post(
  '/demo/reset',
  requireAuth,
  requireFamilyRole(['owner', 'adult']),
  sosController.resetDemo
);

sosRouter.post(
  '/demo/seed',
  requireAuth,
  requireFamilyRole(['owner', 'adult']),
  sosController.seedDemo
);

// Contacts management
sosRouter.post(
  '/contacts',
  requireAuth,
  requireFamilyRole(['owner', 'adult']),
  sosController.createContact
);

sosRouter.put(
  '/contacts/:contactId',
  requireAuth,
  requireFamilyRole(['owner', 'adult']),
  sosController.updateContact
);

sosRouter.delete(
  '/contacts/:contactId',
  requireAuth,
  requireFamilyRole(['owner', 'adult']),
  sosController.deleteContact
);

// Policy management
sosRouter.post(
  '/policy',
  requireAuth,
  requireFamilyRole(['owner', 'adult']),
  sosController.upsertPolicy
);
