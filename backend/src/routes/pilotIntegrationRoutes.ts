/**
 * backend/src/routes/pilotIntegrationRoutes.ts
 *
 * Routes for Phase 10: Pilot Integrations, Hospital Gateway, ABDM,
 * and DPDP Act Privacy Operations.
 */

import { Router } from 'express';
import { requireAuth, requireFamilyRole } from '../middlewares/auth.js';
import {
  getHospitalGatewayHealth,
  dispatchEmergencyHandoff,
  validateAbha,
  initiateAbhaAuth,
  verifyAbhaOtp,
  generateFhirBundle,
  requestConsent,
  getConsentStatus,
  exportUserData,
  deleteUserAccount,
} from '../controllers/pilotIntegrationController.js';

export const pilotIntegrationRouter = Router();

// Gateway Health & Public ABHA Syntax Check
pilotIntegrationRouter.get('/hospital/health', getHospitalGatewayHealth);
pilotIntegrationRouter.post('/abdm/validate-abha', validateAbha);

// Authenticated operations
pilotIntegrationRouter.use(requireAuth);

// ABDM Milestone 1 Authentication & Linking
pilotIntegrationRouter.post('/abdm/auth/init', initiateAbhaAuth);
pilotIntegrationRouter.post(
  '/families/:familyId/patients/:patientId/abdm/auth/confirm',
  requireFamilyRole(['owner', 'adult', 'guardian']),
  verifyAbhaOtp
);

// ABDM Milestone 2 & 3: FHIR R4 Bundle Export & Consent Management
pilotIntegrationRouter.get(
  '/families/:familyId/patients/:patientId/fhir-bundle',
  requireFamilyRole(['owner', 'adult', 'guardian', 'caregiver']),
  generateFhirBundle
);
pilotIntegrationRouter.post('/abdm/consent/request', requestConsent);
pilotIntegrationRouter.get('/abdm/consent/:consentId', getConsentStatus);

// Hospital Emergency Department Dispatch
pilotIntegrationRouter.post(
  '/families/:familyId/incidents/:incidentId/dispatch-hospital',
  requireFamilyRole(['owner', 'adult', 'guardian', 'caregiver']),
  dispatchEmergencyHandoff
);

// DPDP Act 2023: Data Portability & Right to Erasure
pilotIntegrationRouter.post('/privacy/export-data', exportUserData);
pilotIntegrationRouter.post('/privacy/delete-account', deleteUserAccount);
