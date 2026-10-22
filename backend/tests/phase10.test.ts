/**
 * backend/tests/phase10.test.ts
 *
 * Automated Test Suite for Phase 10:
 * Production Integrations, Deployment Hardening, ABDM Gateway (M1/M2/M3),
 * Hospital Emergency Gateway Handoff with Fallback, and DPDP Act 2023 Compliance.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import {
  MockAbdmGatewayAdapter,
  MockHospitalReceivingAdapter,
  HospitalReceivingAdapter,
} from '../src/integrations/index.js';
import { PilotIntegrationService } from '../src/services/pilotIntegrationService.js';

describe('Phase 10 — Production Integrations, Deployment Hardening & Pilot Readiness', () => {
  let user1Token: string;
  let user2Token: string;
  let familyId: string;
  let patientProfileId: string;
  let incidentId: string;
  let pilotService: PilotIntegrationService;
  let mockAbdm: MockAbdmGatewayAdapter;
  let mockHospital: MockHospitalReceivingAdapter;

  beforeAll(async () => {
    mockAbdm = new MockAbdmGatewayAdapter();
    mockHospital = new MockHospitalReceivingAdapter();
    pilotService = new PilotIntegrationService(mockAbdm, mockHospital);

    // 1. Register User 1 (Family Owner)
    const u1Res = await request(app).post('/api/auth/register').send({
      email: 'phase10.owner@sanjivani.local',
      password: 'DemoPassword123!',
      fullName: 'Siddharth Rao',
      phone: '+919876543210',
    });
    expect(u1Res.status).toBe(201);
    user1Token = u1Res.body.data?.token || u1Res.body.token;

    // 2. Register User 2 (External user)
    const u2Res = await request(app).post('/api/auth/register').send({
      email: 'phase10.external@sanjivani.local',
      password: 'DemoPassword123!',
      fullName: 'External Doctor',
      phone: '+919876543211',
    });
    expect(u2Res.status).toBe(201);
    user2Token = u2Res.body.data?.token || u2Res.body.token;

    // 3. Create Family Workspace
    const fRes = await request(app)
      .post('/api/families')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ name: 'Rao Family Healthcare' });
    expect(fRes.status).toBe(201);
    familyId = fRes.body.data?.family?.id || fRes.body.family?.id;

    // 4. Create Patient Profile
    const pRes = await request(app)
      .post(`/api/families/${familyId}/patients`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        fullName: 'Devendra Rao',
        gender: 'male',
        dateOfBirth: '1954-04-12',
        relationshipToCreator: 'father',
        category: 'elderly',
      });
    expect(pRes.status).toBe(201);
    patientProfileId =
      pRes.body.data?.profile?.id ||
      pRes.body.profile?.id ||
      pRes.body.data?.patient?.id ||
      pRes.body.patient?.id;

    // 5. Add Emergency Contact
    await request(app)
      .post(`/api/families/${familyId}/sos/contacts`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        patientProfileId,
        name: 'Anita Rao',
        relationship: 'Daughter',
        phoneNumber: '+919876543212',
        priorityOrder: 1,
        canEscalateToHospital: true,
      });

    // 6. Trigger Simulated SOS Incident
    const sosRes = await request(app)
      .post(`/api/families/${familyId}/sos/trigger`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        patientProfileId,
        locationNote: 'Sector 14 Residence, Living Room',
      });
    expect(sosRes.status).toBe(201);
    incidentId = sosRes.body.data?.incident?.id || sosRes.body.incident?.id;
  });

  // -------------------------------------------------------------
  // 1. ABDM / ABHA Syntax Validation & Verification
  // -------------------------------------------------------------
  describe('1. ABDM Gateway Syntax & Validation', () => {
    it('validates 14-digit hyphenated ABHA number format', () => {
      const res = mockAbdm.validateAbhaFormat('14-1234-5678-9012');
      expect(res.valid).toBe(true);
      expect(res.type).toBe('NUMBER');
      expect(res.formatted).toBe('14-1234-5678-9012');
    });

    it('validates unhyphenated 14 digits and formats properly', () => {
      const res = mockAbdm.validateAbhaFormat('91482910294821');
      expect(res.valid).toBe(true);
      expect(res.type).toBe('NUMBER');
      expect(res.formatted).toBe('91-4829-1029-4821');
    });

    it('validates ABHA address handles (@abdm and @sbx)', () => {
      const res1 = mockAbdm.validateAbhaFormat('rameshwar.sharma@abdm');
      expect(res1.valid).toBe(true);
      expect(res1.type).toBe('ADDRESS');

      const res2 = mockAbdm.validateAbhaFormat('test_user@sbx');
      expect(res2.valid).toBe(true);
      expect(res2.type).toBe('ADDRESS');
    });

    it('rejects invalid ABHA syntax with helpful error message', () => {
      const res1 = mockAbdm.validateAbhaFormat('12345'); // too short
      expect(res1.valid).toBe(false);
      expect(res1.type).toBe('INVALID');

      const res2 = mockAbdm.validateAbhaFormat('invalid@gmail.com'); // wrong domain
      expect(res2.valid).toBe(false);
      expect(res2.type).toBe('INVALID');
    });
  });

  // -------------------------------------------------------------
  // 2. ABDM Milestone 1 Auth & Profile Verification
  // -------------------------------------------------------------
  describe('2. ABDM Milestone 1 Auth & OTP Verification', () => {
    let activeTxnId: string;

    it('initiates ABHA OTP authentication session', async () => {
      const session = await mockAbdm.initiateAbhaAuth({
        abhaNumber: '14-1234-5678-9012',
        authMethod: 'OTP',
      });
      expect(session.txnId).toMatch(/^TXN-SBX-/);
      expect(session.authMethod).toBe('OTP');
      expect(session.expiresInSeconds).toBe(300);
      activeTxnId = session.txnId;
    });

    it('rejects OTP initiation with invalid ABHA format', async () => {
      await expect(
        mockAbdm.initiateAbhaAuth({
          abhaNumber: 'invalid-number',
          authMethod: 'OTP',
        })
      ).rejects.toThrow(/ABDM Validation Failed/);
    });

    it('verifies 6-digit OTP and returns KYC-verified ABHA profile', async () => {
      const profile = await mockAbdm.verifyAbhaOtp(activeTxnId, '123456');
      expect(profile.abhaNumber).toBe('14-1234-5678-9012');
      expect(profile.fullName).toBe('Rameshwar Sharma');
      expect(profile.kycVerified).toBe(true);
      expect(profile.status).toBe('ACTIVE');
    });

    it('rejects malformed or simulated incorrect OTP', async () => {
      const session = await mockAbdm.initiateAbhaAuth({
        abhaAddress: 'rameshwar@abdm',
        authMethod: 'OTP',
      });

      // Wrong length
      await expect(mockAbdm.verifyAbhaOtp(session.txnId, '12')).rejects.toThrow(
        /Invalid OTP format/
      );

      // Incorrect OTP code
      await expect(mockAbdm.verifyAbhaOtp(session.txnId, '000000')).rejects.toThrow(
        /Incorrect OTP/
      );
    });
  });

  // -------------------------------------------------------------
  // 3. ABDM Milestone 2 & 3: Consent & FHIR R4 Bundle Export
  // -------------------------------------------------------------
  describe('3. ABDM Milestone 2 & 3: Consent & FHIR R4 Export', () => {
    it('creates an electronic consent artefact with 30-day validity', async () => {
      const artefact = await mockAbdm.requestConsent({
        patientAbhaAddress: 'patient.rao@abdm',
        purpose: { code: 'CAREMGT', text: 'Care Management & Clinical Review' },
        hiTypes: ['DiagnosticReport', 'Prescription'],
        dateRange: { from: '2026-01-01', to: '2026-10-22' },
        dataEraseAt: '2026-11-22T00:00:00Z',
      });

      expect(artefact.consentId).toMatch(/^CONSENT-/);
      expect(artefact.status).toBe('GRANTED');
      expect(artefact.patientAbhaAddress).toBe('patient.rao@abdm');
    });

    it('transforms internal records into HL7 FHIR R4 Bundle', async () => {
      const patient = {
        id: patientProfileId,
        healthId: 'SNJ-2026-9A82-4C1F',
        fullName: 'Devendra Rao',
        gender: 'male',
        dateOfBirth: '1954-04-12',
      };

      const records = [
        {
          id: 'doc-1',
          title: 'Complete Blood Count (CBC)',
          category: 'LAB',
          documentDate: '2026-09-15',
          summary: 'Normal hemoglobin, platelets within normal limits.',
        },
      ];

      const medications = [
        {
          id: 'med-1',
          name: 'Amlodipine 5mg',
          dosage: '1 tablet',
          frequency: 'Once Daily',
          status: 'active',
        },
      ];

      const bundle = mockAbdm.exportToFhirBundle(patient, records, medications);

      expect(bundle.resourceType).toBe('Bundle');
      expect(bundle.type).toBe('document');
      expect(bundle.entry.length).toBe(3); // Patient + DiagnosticReport + MedicationRequest

      const patientEntry = bundle.entry.find((e) => e.resource.resourceType === 'Patient');
      expect(patientEntry?.resource.name[0].text).toBe('Devendra Rao');

      const labEntry = bundle.entry.find((e) => e.resource.resourceType === 'DiagnosticReport');
      expect(labEntry?.resource.code.text).toBe('Complete Blood Count (CBC)');

      const medEntry = bundle.entry.find((e) => e.resource.resourceType === 'MedicationRequest');
      expect(medEntry?.resource.medicationCodeableConcept.text).toBe('Amlodipine 5mg');
    });
  });

  // -------------------------------------------------------------
  // 4. Hospital Emergency Gateway Integration & Fallback
  // -------------------------------------------------------------
  describe('4. Hospital Emergency Department Handoff & Fallback', () => {
    it('reports gateway health and connectivity in simulated mode', async () => {
      const health = await mockHospital.checkGatewayHealth();
      expect(health.isConfigured).toBe(true);
      expect(health.mode).toBe('simulated');
      expect(health.connected).toBe(true);
    });

    it('transmits emergency handoff packet with cryptographic audit hash', async () => {
      const result = await pilotService.dispatchEmergencyHandoff(familyId, incidentId);

      expect(result.transmission.success).toBe(true);
      expect(result.transmission.mode).toBe('simulated');
      expect(result.transmission.acknowledgedBy).toContain('Nurse Priya Desai');
      expect(result.transmission.auditHash).toHaveLength(64); // SHA-256
      expect(result.fallbackTriggered).toBe(false);
      expect(result.handoffPacket.disclaimer).toContain('DEMO MODE');
    });

    it('triggers automatic fallback to caregiver escalation when gateway fails', async () => {
      mockHospital.simulateFailureOnNextCall('Receiving desk gateway network timeout');

      const result = await pilotService.dispatchEmergencyHandoff(familyId, incidentId);

      expect(result.transmission.success).toBe(false);
      expect(result.fallbackTriggered).toBe(true);
      expect(result.transmission.errorMessage).toContain('Receiving desk gateway network timeout');
    });

    it('enforces safety: requires simulation or pilot disclaimer on handoff', async () => {
      await expect(
        mockHospital.transmitEmergencyHandoff({
          incidentId: 'inc-99',
          patientHealthId: 'SNJ-2026-0001',
          patientName: 'Test Patient',
          allergies: [],
          activeConditions: [],
          currentMedications: [],
          emergencyContacts: [],
          triggerTimestamp: new Date().toISOString(),
          disclaimer: 'REAL LIVE EMERGENCY DISPATCH', // unsafe disclaimer
        })
      ).rejects.toThrow(/Safety violation/);
    });

    it('live hospital adapter handles missing URL gracefully with fallback', async () => {
      const liveAdapter = new HospitalReceivingAdapter({ gatewayUrl: '' });
      const res = await liveAdapter.transmitEmergencyHandoff({
        incidentId: 'inc-100',
        patientHealthId: 'SNJ-2026-0001',
        patientName: 'Live Test',
        allergies: [],
        activeConditions: [],
        currentMedications: [],
        emergencyContacts: [],
        triggerTimestamp: new Date().toISOString(),
        disclaimer: 'PILOT DEMO',
      });

      expect(res.success).toBe(false);
      expect(res.fallbackTriggered).toBe(true);
      expect(res.errorMessage).toContain('not configured');
    });
  });

  // -------------------------------------------------------------
  // 5. DPDP Act 2023 Compliance: Export & Erasure Operations
  // -------------------------------------------------------------
  describe('5. DPDP Act 2023 Data Portability & Right to Erasure', () => {
    it('exports all user health data in machine-readable JSON format (Section 11)', async () => {
      const exportRes = await request(app)
        .post('/api/pilot/privacy/export-data')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(exportRes.status).toBe(200);
      expect(exportRes.body.success).toBe(true);
      expect(exportRes.body.export.profile.email).toBe('phase10.owner@sanjivani.local');
      expect(exportRes.body.export.families.length).toBeGreaterThan(0);
      expect(exportRes.body.export.complianceNotice).toContain('DPDP Act 2023 Section 11');
    });

    it('permanently deletes user account and returns signed deletion certificate (Section 12)', async () => {
      // Create a temporary user to test deletion without breaking subsequent tests
      const tempRes = await request(app).post('/api/auth/register').send({
        email: 'phase10.temp@sanjivani.local',
        password: 'DemoPassword123!',
        fullName: 'Temporary User',
      });
      const tempToken = tempRes.body.data?.token || tempRes.body.token;

      const delRes = await request(app)
        .post('/api/pilot/privacy/delete-account')
        .set('Authorization', `Bearer ${tempToken}`)
        .send({ reason: 'Exercising DPDP Act Section 12 Right to Erasure' });

      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);
      expect(delRes.body.certificate.deletionCertificateId).toMatch(/^DEL-CERT-/);
      expect(delRes.body.certificate.digitalSignature).toHaveLength(64);
      expect(delRes.body.certificate.purgedEntities.userProfile).toBe(true);
    });
  });

  // -------------------------------------------------------------
  // 6. HTTP API Endpoint Verification & RBAC
  // -------------------------------------------------------------
  describe('6. HTTP API Endpoints & RBAC Enforcement', () => {
    it('GET /api/pilot/hospital/health returns gateway status without auth', async () => {
      const res = await request(app).get('/api/pilot/hospital/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.health.mode).toBeDefined();
    });

    it('POST /api/pilot/abdm/validate-abha validates format without auth', async () => {
      const res = await request(app)
        .post('/api/pilot/abdm/validate-abha')
        .send({ abha: '14-1234-5678-9012' });

      expect(res.status).toBe(200);
      expect(res.body.result.valid).toBe(true);
      expect(res.body.result.type).toBe('NUMBER');
    });

    it('rejects unauthenticated requests to protected ABDM and privacy routes', async () => {
      const res1 = await request(app).post('/api/pilot/abdm/auth/init').send({});
      expect(res1.status).toBe(401);

      const res2 = await request(app).post('/api/pilot/privacy/export-data').send({});
      expect(res2.status).toBe(401);
    });

    it('prevents user from another family from accessing patient FHIR bundle', async () => {
      const res = await request(app)
        .get(`/api/pilot/families/${familyId}/patients/${patientProfileId}/fhir-bundle`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.status).toBe(403);
    });
  });
});
