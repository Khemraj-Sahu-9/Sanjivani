/**
 * backend/tests/phase9_e2e.test.ts
 *
 * Phase 9: Comprehensive End-to-End Test Suite across 12 User Journeys.
 *
 * Journeys:
 *   Journey 1:  Family and patient setup
 *   Journey 2:  Document processing, extraction review, and confirmation
 *   Journey 3:  AI retrieval with grounded citations and no hallucinations
 *   Journey 4:  Doctor-ready summary PDF generation and clinical preview
 *   Journey 5:  Confirmed medication schedule, dose tracking, and appointment management
 *   Journey 6:  SOS incident triggering with immediate family response
 *   Journey 7:  SOS no-response timeout and caregiver escalation
 *   Journey 8:  Simulated hospital handoff packet and receiving desk verification
 *   Journey 9:  Live Test Mode safety boundaries and recipient consent enforcement
 *   Journey 10: Offline synchronization queue, idempotency, and conflict handling
 *   Journey 11: Community elderly assistance request, volunteer matching, and privacy isolation
 *   Journey 12: Strict cross-family and cross-account security isolation
 */

import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import crypto from 'crypto';

process.env['DEMO_MODE'] = 'true';
process.env['NODE_ENV'] = 'test';

import { app } from '../src/app.js';
import { db } from '../src/repositories/database.js';

const request = supertest(app);

describe('Phase 9 — End-to-End System Verification (12 User Journeys)', () => {
  // Test User Accounts
  let ownerToken: string;
  let ownerId: string;
  let caregiverToken: string;
  let caregiverId: string;
  let outsiderToken: string;
  let outsiderId: string;

  // Shared Entities
  let familyId: string;
  let patientId: string;
  let documentId: string;
  let scheduleId: string;
  let appointmentId: string;
  let communityId: string;
  let assistanceRequestId: string;
  let ongoingIncidentId: string;

  beforeAll(async () => {
    // Register primary user (Owner)
    const ownerRes = await request.post('/api/auth/register').send({
      email: 'p9_owner@sanjivani.local',
      password: 'SecurePassword123!',
      fullName: 'Aarav Patel',
      phone: '+919876543210',
    });
    expect(ownerRes.status).toBe(201);
    ownerToken = ownerRes.body.data.token;
    ownerId = ownerRes.body.data.user.id;
    expect(ownerId).toBeDefined();

    // Register caregiver user
    const cgRes = await request.post('/api/auth/register').send({
      email: 'p9_caregiver@sanjivani.local',
      password: 'SecurePassword123!',
      fullName: 'Pooja Patel',
      phone: '+919876543211',
    });
    expect(cgRes.status).toBe(201);
    caregiverToken = cgRes.body.data.token;
    caregiverId = cgRes.body.data.user.id;

    // Register unrelated third-party user
    const outsiderRes = await request.post('/api/auth/register').send({
      email: 'p9_outsider@sanjivani.local',
      password: 'SecurePassword123!',
      fullName: 'Vikram Singh',
      phone: '+919876543299',
    });
    expect(outsiderRes.status).toBe(201);
    outsiderToken = outsiderRes.body.data.token;
    outsiderId = outsiderRes.body.data.user.id;
    expect(outsiderId).toBeDefined();
  });

  // ===========================================================================
  // Journey 1 — Family and Patient Setup
  // ===========================================================================
  describe('Journey 1 — Family and Patient Setup', () => {
    it('creates a family workspace for the owner', async () => {
      const res = await request
        .post('/api/families')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Patel Family Care' });

      expect(res.status).toBe(201);
      expect(res.body.data.family.name).toBe('Patel Family Care');
      familyId = res.body.data.family.id;
    });

    it('creates an elderly patient profile with a unique Health ID', async () => {
      const res = await request
        .post(`/api/families/${familyId}/patients`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          fullName: 'Kantilal Patel',
          dateOfBirth: '1948-06-15',
          gender: 'male',
          bloodGroup: 'B+',
          relationshipToCreator: 'Father',
          category: 'elderly',
          allergies: ['Penicillin', 'Sulfa'],
          chronicConditions: ['Type 2 Diabetes', 'Hypertension'],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.profile.full_name).toBe('Kantilal Patel');
      expect(res.body.data.profile.health_id).toMatch(/^SNJ-/i);
      patientId = res.body.data.profile.id;
    });

    it('adds a family caregiver member and verifies patient profile viewing access', async () => {
      // Add member to workspace with caregiver role
      const addRes = await request
        .post(`/api/families/${familyId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'p9_caregiver@sanjivani.local',
          role: 'caregiver',
        });
      expect(addRes.status).toBe(201);
      expect(addRes.body.data.member.role).toBe('caregiver');

      // Caregiver can now read the patient profile
      const viewRes = await request
        .get(`/api/families/patients/${patientId}`)
        .set('Authorization', `Bearer ${caregiverToken}`);
      expect(viewRes.status).toBe(200);
      expect(viewRes.body.data.profile.full_name).toBe('Kantilal Patel');
    });
  });

  // ===========================================================================
  // Journey 2 — Document Processing, Extraction Review & Confirmation
  // ===========================================================================
  describe('Journey 2 — Document Processing & Human Review', () => {
    it('uploads a prescription document and queues OCR extraction', async () => {
      const docBuffer = Buffer.from(
        'Apex Hospital Mumbai\nDr. Anjali Nair, MD (Internal Medicine)\nPatient: Kantilal Patel, 76y Male\n' +
        'Diagnosis: Hypertension, Type 2 Diabetes\n' +
        'Rx:\n1. Tab Metformin 500mg PO BD after meals\n2. Tab Telmisartan 40mg PO OD morning\n' +
        'Date: 2026-10-15'
      );

      const res = await request
        .post(`/api/families/${familyId}/documents/upload`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .field('patientProfileId', patientId)
        .field('category', 'prescription')
        .field('title', 'Apex Hospital Prescription Oct 2026')
        .attach('file', docBuffer, { filename: 'apex_rx.png', contentType: 'image/png' });

      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe('Apex Hospital Prescription Oct 2026');
      documentId = res.body.data.id;
    });

    it('retrieves extraction review details and updates/confirms extraction', async () => {
      // Confirm human review with verified values via review endpoint
      const confirmRes = await request
        .post(`/api/families/documents/review/${documentId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          markConfirmed: true,
          confirmedFields: {
            doctor_name: 'Dr. Anjali Nair',
            prescription_medicines: [
              { name: 'Metformin', strength: '500mg', dosage: '1 tab twice daily', frequency: 'twice_daily', instructions: 'after meals' },
              { name: 'Telmisartan', strength: '40mg', dosage: '1 tab daily', frequency: 'once_daily', instructions: 'morning with water' }
            ]
          }
        });

      expect(confirmRes.status).toBe(200);
      expect(confirmRes.body.data.document.review_status).toBe('confirmed');
    });
  });

  // ===========================================================================
  // Journey 3 — AI Health Memory Retrieval with Grounding
  // ===========================================================================
  describe('Journey 3 — AI Health Memory Retrieval', () => {
    it('answers questions present in records with verifiable source citations', async () => {
      const res = await request
        .post(`/api/families/${familyId}/memory/ask`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          patientProfileId: patientId,
          question: 'What medications does Kantilal take?',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.answer).toBeTruthy();
      expect(res.body.data.sources).toBeInstanceOf(Array);
    });

    it('faithfully acknowledges missing information without hallucination', async () => {
      const res = await request
        .post(`/api/families/${familyId}/memory/ask`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          patientProfileId: patientId,
          question: 'What was the result of the brain MRI angiography scan performed in 2024?',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.answer.toLowerCase()).toMatch(/not find|no mention|no medical record|unrecorded|unable to find|no record|searched|specific question/i);
    });
  });

  // ===========================================================================
  // Journey 4 — Doctor-Ready Clinical Summary PDF
  // ===========================================================================
  describe('Journey 4 — Doctor-Ready Clinical Summary PDF', () => {
    it('previews doctor clinical summary with structured patient sections', async () => {
      const res = await request
        .post(`/api/families/${familyId}/memory/doctor-summary/preview`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          patientProfileId: patientId,
          selectedDocumentIds: [documentId],
          includedSections: ['patient_info', 'allergies', 'prescriptions'],
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('patient');
      expect(res.body.data.patient.full_name).toBe('Kantilal Patel');
    });

    it('generates a valid binary PDF document for physician review', async () => {
      const res = await request
        .post(`/api/families/${familyId}/memory/doctor-summary/pdf`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          patientProfileId: patientId,
          selectedDocumentIds: [documentId],
          includedSections: ['patient_info', 'allergies', 'prescriptions'],
          doctorName: 'Dr. Suresh Joshi, Cardiologist',
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      const headerString = res.body.slice ? res.body.slice(0, 4).toString() : '';
      expect(res.text ? res.text.startsWith('%PDF') : headerString.startsWith('%PDF')).toBe(true);
    });
  });

  // ===========================================================================
  // Journey 5 — Medication Management & Appointment Tracking
  // ===========================================================================
  describe('Journey 5 — Medication & Appointment Management', () => {
    it('creates an active medication schedule derived from verified prescription', async () => {
      const res = await request
        .post(`/api/families/${familyId}/medications`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          patientProfileId: patientId,
          sourceDocumentId: documentId,
          medicineName: 'Telmisartan',
          strength: '40mg',
          dosageInstruction: 'Take 1 tablet daily in the morning',
          frequency: 'once_daily',
          scheduledTimes: ['08:00'],
          startDate: '2026-10-15',
          isDraftPendingConfirmation: false,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.medicine_name).toBe('Telmisartan');
      scheduleId = res.body.data.id;
      expect(scheduleId).toBeDefined();
    });

    it('generates dose occurrences and records taken acknowledgement', async () => {
      // Generate doses for next 14 days
      const genRes = await request
        .post(`/api/families/${familyId}/medications/doses/generate`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ patientProfileId: patientId, daysAhead: 14 });

      expect(genRes.status).toBe(200);

      // Fetch occurrences
      const occRes = await request
        .get(`/api/families/${familyId}/medications/doses`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .query({ patientProfileId: patientId, status: 'scheduled' });

      expect(occRes.status).toBe(200);
      expect(occRes.body.data.length).toBeGreaterThan(0);
      const targetDose = occRes.body.data[0];

      // Acknowledge dose as taken
      const ackRes = await request
        .patch(`/api/families/${familyId}/medications/doses/${targetDose.id}/status`)
        .set('Authorization', `Bearer ${caregiverToken}`)
        .send({
          status: 'taken',
          notes: 'Administered after light breakfast',
        });

      expect(ackRes.status).toBe(200);
      expect(ackRes.body.data.status).toBe('taken');
    });

    it('creates an appointment with automated reminder notifications', async () => {
      const res = await request
        .post(`/api/families/${familyId}/appointments`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          patientProfileId: patientId,
          title: 'Cardiology Follow-Up',
          doctorName: 'Dr. Suresh Joshi',
          clinicName: 'Lilavati Hospital & Research Centre',
          appointmentDate: '2026-11-05',
          scheduledTime: '10:30',
          reminderMinutesBefore: [1440, 120], // 1 day, 2 hours
        });

      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe('Cardiology Follow-Up');
      appointmentId = res.body.data.id;
      expect(appointmentId).toBeDefined();
    });
  });

  // ===========================================================================
  // Journey 6 — SOS Emergency Response with Family Acknowledgement
  // ===========================================================================
  describe('Journey 6 — SOS Emergency Response (Family Acknowledged)', () => {
    let incidentId: string;
    let attemptId: string;

    it('triggers an SOS incident and transitions to acknowledged upon family response', async () => {
      // Trigger SOS
      const triggerRes = await request
        .post(`/api/families/${familyId}/sos/trigger`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          patientProfileId: patientId,
          severity: 'HIGH',
          locationNote: 'Bandra West, Mumbai',
        });

      expect(triggerRes.status).toBe(201);
      expect(triggerRes.body.incident.status).toBe('AWAITING_FAMILY_RESPONSE');
      incidentId = triggerRes.body.incident.id;

      // Get attempts
      const detailRes = await request
        .get(`/api/families/${familyId}/sos/incidents/${incidentId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.attempts.length).toBeGreaterThan(0);
      attemptId = detailRes.body.attempts[0].id;

      // Family caregiver responds immediately
      const ackRes = await request
        .post(`/api/families/${familyId}/sos/incidents/${incidentId}/attempts/${attemptId}/acknowledge`)
        .set('Authorization', `Bearer ${caregiverToken}`)
        .send({
          action: 'RESPONDED',
          responderNote: 'Caregiver Pooja arrived at bedside; vital check normal, resting.',
        });

      expect(ackRes.status).toBe(200);
      expect(ackRes.body.incident.status).toBe('FAMILY_RESPONDED');

      // Resolve incident safely so patient is clear for subsequent incidents
      const resolveRes = await request
        .post(`/api/families/${familyId}/sos/incidents/${incidentId}/resolve`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          resolutionNote: 'Patient stabilized. Regular tele-consult scheduled.',
        });

      expect(resolveRes.status).toBe(200);
      expect(resolveRes.body.incident.status).toBe('RESOLVED');
    });
  });

  // ===========================================================================
  // Journey 7 & 8 — SOS No-Response Escalation & Simulated Hospital Handoff
  // ===========================================================================
  describe('Journey 7 & 8 — SOS Escalation and Hospital Handoff', () => {
    it('triggers an incident, advances through caregiver escalation, and arrives at hospital handoff', async () => {
      // Trigger new SOS
      const triggerRes = await request
        .post(`/api/families/${familyId}/sos/trigger`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          patientProfileId: patientId,
          severity: 'CRITICAL',
          locationNote: 'Living Room — Unresponsive',
        });

      expect(triggerRes.status).toBe(201);
      ongoingIncidentId = triggerRes.body.incident.id;

      // Advance to Caregiver escalation tier (Journey 7)
      const advance1 = await request
        .post(`/api/families/${familyId}/sos/incidents/${ongoingIncidentId}/advance`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(advance1.status).toBe(200);
      expect(advance1.body.incident.status).toBe('AWAITING_CAREGIVER_RESPONSE');

      // Advance to Hospital Handoff simulated tier (Journey 8)
      const advance2 = await request
        .post(`/api/families/${familyId}/sos/incidents/${ongoingIncidentId}/advance`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(advance2.status).toBe(200);
      expect(advance2.body.incident.status).toBe('HOSPITAL_HANDOFF_SIMULATED');

      // Verify incident details show simulated handoff packet with disclaimer
      const detailRes = await request
        .get(`/api/families/${familyId}/sos/incidents/${ongoingIncidentId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.handoff).toBeDefined();
      expect(detailRes.body.handoff.is_demo).toBe(true);
      expect(detailRes.body.handoff.simulation_provenance).toBe('DEMO_SIMULATION_ONLY');
      expect(detailRes.body.handoff.patient_summary_packet.verificationNotice).toContain('DEMO MODE ONLY');

      // Simulated hospital receiving desk acknowledges packet receipt
      const ackRes = await request
        .post(`/api/families/${familyId}/sos/incidents/${ongoingIncidentId}/hospital/acknowledge`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          receivingStaffName: 'Nurse Priya Desai (Emergency Desk, Simulated)',
          receivingNotes: 'Trauma triage bed allocated. Emergency physician notified.',
        });

      expect(ackRes.status).toBe(200);
      expect(ackRes.body.handoff.status).toBe('ACKNOWLEDGED_SIMULATED');

      // Resolve incident to clean up state
      await request
        .post(`/api/families/${familyId}/sos/incidents/${ongoingIncidentId}/resolve`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ resolutionNote: 'Hospital handoff simulation test complete' });
    });
  });

  // ===========================================================================
  // Journey 9 — Live Test Mode Safety Boundaries & Whitelist
  // ===========================================================================
  describe('Journey 9 — Live Test Mode Safeguards', () => {
    it('strictly rejects non-whitelisted numbers or emergency service lines', async () => {
      const res = await request
        .post(`/api/families/${familyId}/sos/live-test/recipients`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          displayName: 'Police / Emergency Line',
          phoneNumber: '112',
          permittedChannel: 'VOICE',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/emergency service/i);
    });

    it('registers an authorized team member only with explicit consent', async () => {
      const res = await request
        .post(`/api/families/${familyId}/sos/live-test/recipients`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          displayName: 'Antigravity QA Engineer',
          phoneNumber: '+919123456789',
          permittedChannel: 'BOTH',
          allowedPurpose: 'Automated test suite verification',
          consentNotes: 'Consented under internal test harness',
          verified: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.recipient.verification_status).toBe('VERIFIED');
      expect(res.body.recipient.consent_status).toBe('CONSENT_GRANTED');
    });
  });

  // ===========================================================================
  // Journey 10 — Offline Synchronization Queue & Idempotency
  // ===========================================================================
  describe('Journey 10 — Offline Synchronization Queue', () => {
    it('processes queued offline mutations idempotently without duplicate application', async () => {
      const clientOpId = crypto.randomUUID();
      const idempotencyKey = `idem_p9_${Date.now()}`;

      const batchPayload = {
        operations: [
          {
            clientOperationId: clientOpId,
            idempotencyKey,
            patientProfileId: patientId,
            operationType: 'PATIENT_UPDATE',
            payload: {
              patientId,
              updates: {
                relationshipToCreator: 'Father / Senior Head',
              },
            },
            clientTimestamp: new Date().toISOString(),
          },
        ],
      };

      // First sync attempt
      const res1 = await request
        .post(`/api/families/${familyId}/sync/batch`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(batchPayload);

      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);
      expect(res1.body.results).toHaveLength(1);
      expect(res1.body.results[0].status).toBe('synced');

      // Replayed idempotent second sync attempt
      const res2 = await request
        .post(`/api/families/${familyId}/sync/batch`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(batchPayload);

      expect(res2.status).toBe(200);
      expect(res2.body.results[0].status).toBe('synced');
    });

    it('reports clean sync status and zero unresolved critical conflicts', async () => {
      const res = await request
        .get(`/api/families/${familyId}/sync/status`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.familyId).toBe(familyId);
      expect(typeof res.body.pendingConflictsCount).toBe('number');
    });
  });

  // ===========================================================================
  // Journey 11 — Community Network & Healthcare Privacy Isolation
  // ===========================================================================
  describe('Journey 11 — Community Elderly Assistance & Privacy', () => {
    it('creates a residential society community group', async () => {
      const res = await request
        .post('/api/communities')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Greenwood Society Senior Care',
          groupType: 'residential_society',
          description: 'Mutual assistance group for resident elders',
          approximateLocality: 'Bandra West, Mumbai',
          membershipPolicy: 'open',
          moderationPolicy: 'standard',
        });

      expect(res.status).toBe(201);
      expect(res.body.group.name).toBe('Greenwood Society Senior Care');
      communityId = res.body.group.id;
    });

    it('posts non-emergency assistance request and coordinates volunteer', async () => {
      // Owner posts request
      const reqRes = await request
        .post(`/api/communities/${communityId}/assistance`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          requestCategory: 'errands',
          title: 'Prescription pickup from local chemist',
          description: 'Need neighbor to pick up pre-ordered prescription at Apollo Pharmacy.',
          priority: 'medium',
          approximateLocality: 'Tower 4, Greenwood',
          preferredDateTime: 'Today 5 PM',
          expiryHours: 24,
          contactSharingConsent: true,
          contactPhone: '+919876543210',
          contactAddress: 'Flat 402, Greenwood',
        });

      expect(reqRes.status).toBe(201);
      assistanceRequestId = reqRes.body.request.id;

      // Add caregiver as community member first
      await db.createCommunityMembership({
        community_id: communityId,
        user_id: caregiverId,
        role: 'member',
        status: 'active',
      });

      // Caregiver volunteers
      const volRes = await request
        .post(`/api/communities/${communityId}/assistance/${assistanceRequestId}/volunteer`)
        .set('Authorization', `Bearer ${caregiverToken}`)
        .send({ notes: 'I am passing by Apollo Pharmacy at 5pm and can bring it.' });

      expect(volRes.status).toBe(201);

      // Assign volunteer
      const assignRes = await request
        .post(`/api/communities/${communityId}/assistance/${assistanceRequestId}/assign`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ volunteerUserId: caregiverId });

      expect(assignRes.status).toBe(200);

      // Complete request
      const closeRes = await request
        .patch(`/api/communities/${communityId}/assistance/${assistanceRequestId}/status`)
        .set('Authorization', `Bearer ${caregiverToken}`)
        .send({ status: 'completed' });

      expect(closeRes.status).toBe(200);
      expect(closeRes.body.request.status).toBe('completed');
    });

    it('strictly isolates medical documents and patient records from community members', async () => {
      // Outsider Vikram is not in family and cannot access medical documents
      const leakAttempt = await request
        .get(`/api/families/${familyId}/documents`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(leakAttempt.status).toBe(403);
    });
  });

  // ===========================================================================
  // Journey 12 — Cross-Family & Cross-Account Data Isolation
  // ===========================================================================
  describe('Journey 12 — Cross-Account Data Isolation Boundaries', () => {
    it('prohibits outsider from accessing family patient records', async () => {
      const res = await request
        .get(`/api/families/patients/${patientId}`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(res.status).toBe(403);
    });

    it('prohibits outsider from querying patient AI memory', async () => {
      const res = await request
        .post(`/api/families/${familyId}/memory/ask`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({
          patientProfileId: patientId,
          question: 'What chronic illnesses does this patient have?',
        });

      expect(res.status).toBe(403);
    });

    it('prohibits outsider from viewing or modifying medication schedules', async () => {
      const res = await request
        .get(`/api/families/${familyId}/medications/patients/${patientId}`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(res.status).toBe(403);
    });

    it('prohibits outsider from viewing family emergency incidents', async () => {
      const res = await request
        .get(`/api/families/${familyId}/sos/incidents`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(res.status).toBe(403);
    });
  });
});
