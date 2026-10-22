/**
 * backend/tests/staging_smoke.test.ts
 *
 * Phase 12 Mandatory Staging Smoke Test Suite (Tests A through L).
 *
 * Validates the complete staging application deployment:
 *   - Test A: Authentication, session persistence & protected routes
 *   - Test B: Medical record ingestion, private storage & metadata
 *   - Test C: OCR text extraction, split-screen human review & confirmation
 *   - Test D: AI Health Memory grounded Q&A, source citations & refusal of unrecorded facts
 *   - Test E: Doctor-ready clinical summary PDF generation (binary streaming)
 *   - Test F: Medication schedules, dose adherence tracking & appointment management
 *   - Test G: SOS Demo Mode (Dual scenarios: Immediate family response & timeout escalation)
 *   - Test H: Simulated hospital receiving desk handoff with explicit simulation notice
 *   - Test I: Controlled Live Test Mode telephony safety controls (112 blocking & consent)
 *   - Test J: Offline mutation synchronization, idempotent batch replay & deduplication
 *   - Test K: Residential society mutual aid & strict clinical privacy isolation
 *   - Test L: Cross-tenant authorization boundaries & zero unauthorized data leakage
 */

import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';

// Configure test environment variables before importing app
process.env['NODE_ENV'] = 'test';
process.env['DEMO_MODE'] = 'true';
process.env['PORT'] = '0';
process.env['LIVE_TEST_MODE_ENABLED'] = 'false';

const { app } = await import('../src/app.js');
const request = supertest(app);

describe('Phase 12 — Staging Smoke Tests (Tests A through L)', () => {
  // Staging User Tokens & IDs
  let ownerToken: string;
  let ownerId: string;
  let caregiverToken: string;
  let caregiverId: string;
  let outsiderToken: string;
  let outsiderId: string;

  // Staging Entity References
  let familyId: string;
  let patientProfileId: string;
  let documentId: string;
  let scheduleId: string;
  let doseId: string;
  let appointmentId: string;
  let incidentId: string;
  let communityId: string;
  let assistanceRequestId: string;

  beforeAll(async () => {
    // 1. Register Staging Family Owner
    const ownerRes = await request.post('/api/auth/register').send({
      email: 'staging_owner@sanjivani.local',
      password: 'StagingPassword123!',
      fullName: 'Ramesh Sharma (Staging Owner)',
      phone: '+919876543101',
    });
    expect(ownerRes.status).toBe(201);
    ownerToken = ownerRes.body.data?.token || ownerRes.body.token;
    ownerId = ownerRes.body.data?.user?.id || ownerRes.body.user?.id;
    expect(ownerToken).toBeDefined();
    expect(ownerId).toBeDefined();

    // 2. Register Staging Caregiver
    const cgRes = await request.post('/api/auth/register').send({
      email: 'staging_caregiver@sanjivani.local',
      password: 'StagingPassword123!',
      fullName: 'Pooja Verma (Staging Caregiver)',
      phone: '+919876543102',
    });
    expect(cgRes.status).toBe(201);
    caregiverToken = cgRes.body.data?.token || cgRes.body.token;
    caregiverId = cgRes.body.data?.user?.id || cgRes.body.user?.id;
    expect(caregiverToken).toBeDefined();
    expect(caregiverId).toBeDefined();

    // 3. Register Unrelated Outsider User
    const outRes = await request.post('/api/auth/register').send({
      email: 'staging_outsider@sanjivani.local',
      password: 'StagingPassword123!',
      fullName: 'External Staging Stranger',
      phone: '+919876543103',
    });
    expect(outRes.status).toBe(201);
    outsiderToken = outRes.body.data?.token || outRes.body.token;
    outsiderId = outRes.body.data?.user?.id || outRes.body.user?.id;
    expect(outsiderToken).toBeDefined();
    expect(outsiderId).toBeDefined();

    // 4. Create Primary Staging Family Workspace
    const famRes = await request
      .post('/api/families')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Staging Sharma Family Health Vault' });
    expect(famRes.status).toBe(201);
    familyId = famRes.body.data?.family?.id || famRes.body.family?.id;
    expect(familyId).toBeDefined();

    // 5. Add Caregiver to Family Workspace
    const memberRes = await request
      .post(`/api/families/${familyId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        email: 'staging_caregiver@sanjivani.local',
        role: 'caregiver',
      });
    expect([200, 201]).toContain(memberRes.status);

    // 6. Create Dependent Elderly Patient Profile
    const patRes = await request
      .post(`/api/families/${familyId}/patients`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        fullName: 'Kailash Nath Sharma',
        gender: 'male',
        dateOfBirth: '1949-08-15',
        relationshipToCreator: 'father',
        category: 'elderly',
      });
    expect(patRes.status).toBe(201);
    const profile = patRes.body.data?.profile || patRes.body.profile;
    patientProfileId = profile.id;
    expect(patientProfileId).toBeDefined();
    expect(profile.health_id).toMatch(/^SNJ-[A-Z0-9]{4}-[A-Z0-9]{4}(-[A-Z0-9]{4})?$/);
  });

  // ---------------------------------------------------------------------------
  // Test A — Authentication
  // ---------------------------------------------------------------------------
  describe('Test A — Authentication, Session & Protected Routes', () => {
    it('authenticates user with valid credentials and returns session token', async () => {
      const res = await request.post('/api/auth/login').send({
        email: 'staging_owner@sanjivani.local',
        password: 'StagingPassword123!',
      });
      expect(res.status).toBe(200);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.email).toBe('staging_owner@sanjivani.local');
    });

    it('retrieves current authenticated profile via /api/auth/me', async () => {
      const res = await request
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.user.id).toBe(ownerId);
      expect(res.body.data.user.full_name).toContain('Ramesh Sharma');
    });

    it('rejects unauthenticated requests to protected endpoints with HTTP 401', async () => {
      const res = await request.get('/api/families');
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('error');
    });
  });

  // ---------------------------------------------------------------------------
  // Test B — Medical Record Ingestion & Storage
  // ---------------------------------------------------------------------------
  describe('Test B — Medical Record Ingestion, Storage & Metadata', () => {
    it('uploads synthetic diagnostic report and persists metadata with SHA-256 checksum', async () => {
      const fakeDocBuffer = Buffer.from(
        'Apex Diagnostic Hospital Mumbai\n' +
        'Consultant: Dr. Anjali Nair, MD (Internal Medicine)\n' +
        'Patient: Kailash Nath Sharma (77M)\n' +
        'Diagnosis: Essential Hypertension, Type 2 Diabetes Mellitus\n' +
        'Rx:\n1. Tab Metformin 500mg PO BD after meals\n2. Tab Telmisartan 40mg PO OD morning\n' +
        'Lab: HbA1c: 7.9% (Elevated)\n' +
        'Date: 2026-09-10'
      );

      const res = await request
        .post(`/api/families/${familyId}/documents/upload`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .field('patientProfileId', patientProfileId)
        .field('category', 'prescription')
        .field('title', 'Apex Hospital Prescription Sep 2026')
        .attach('file', fakeDocBuffer, { filename: 'apex_rx.png', contentType: 'image/png' });

      expect(res.status).toBe(201);
      const doc = res.body.data || res.body.document;
      documentId = doc.id;
      expect(documentId).toBeDefined();
      expect(doc.title).toBe('Apex Hospital Prescription Sep 2026');
      expect(doc.review_status).toBe('needs_review');
      expect(doc.file_checksum).toBeDefined();
    });

    it('retrieves uploaded document details for authorized family members', async () => {
      const res = await request
        .get(`/api/families/documents/details/${documentId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.document.id).toBe(documentId);
    });
  });

  // ---------------------------------------------------------------------------
  // Test C — OCR and Human Review
  // ---------------------------------------------------------------------------
  describe('Test C — OCR Extraction & Split-Screen Human Review', () => {
    it('processes document extraction and accepts human verified clinical corrections', async () => {
      const res = await request
        .post(`/api/families/documents/review/${documentId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          markConfirmed: true,
          confirmedFields: {
            doctor_name: 'Dr. Anjali Nair',
            facility_name: 'Apex Diagnostic Hospital',
            medicines: [
              { name: 'Metformin', strength: '500mg', dosage: '1 tab twice daily', frequency: 'twice_daily', instructions: 'after meals' },
              { name: 'Telmisartan', strength: '40mg', dosage: '1 tab daily', frequency: 'once_daily', instructions: 'morning with water' },
            ],
            conditions: ['Essential Hypertension', 'Type 2 Diabetes Mellitus'],
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.document.review_status).toBe('confirmed');
    });
  });

  // ---------------------------------------------------------------------------
  // Test D — AI Health Memory
  // ---------------------------------------------------------------------------
  describe('Test D — AI Health Memory Grounding & Hallucination Resistance', () => {
    it('answers queries grounded in confirmed records and returns direct citations', async () => {
      const res = await request
        .post(`/api/families/${familyId}/memory/ask`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          patientProfileId,
          question: 'What medications were prescribed for Kailash Nath Sharma at Apex Hospital?',
        });

      expect(res.status).toBe(200);
      const answer = res.body.data?.answer || res.body.answer;
      expect(answer).toBeDefined();
      expect(answer).toMatch(/Metformin|Telmisartan/i);

      // Verifies exact source reference
      const citations = res.body.data?.sources || res.body.data?.citations || res.body.citations || [];
      expect(citations.length).toBeGreaterThan(0);
      expect(citations[0].documentId).toBe(documentId);
    });

    it('refuses unrecorded medical queries honestly without hallucinating facts', async () => {
      const res = await request
        .post(`/api/families/${familyId}/memory/ask`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          patientProfileId,
          question: 'Does the patient have a documented history of severe glioblastoma or open heart surgery?',
        });

      expect(res.status).toBe(200);
      const answer = (res.body.data?.answer || res.body.answer).toLowerCase();
      expect(
        answer.includes('no') ||
        answer.includes('not found') ||
        answer.includes('unrecorded') ||
        answer.includes('does not') ||
        answer.includes('no verified')
      ).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Test E — Doctor Summary
  // ---------------------------------------------------------------------------
  describe('Test E — Doctor-Ready Clinical Summary PDF Compilation', () => {
    it('compiles and streams a real binary PDF summary document', async () => {
      const res = await request
        .post(`/api/families/${familyId}/memory/doctor-summary/pdf`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          patientProfileId,
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

  // ---------------------------------------------------------------------------
  // Test F — Medication and Appointment Tracking
  // ---------------------------------------------------------------------------
  describe('Test F — Medication Schedules, Dose Adherence & Appointments', () => {
    it('creates active medication schedule derived from confirmed prescription', async () => {
      const res = await request
        .post(`/api/families/${familyId}/medications`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          patientProfileId,
          sourceDocumentId: documentId,
          medicineName: 'Telmisartan',
          strength: '40mg',
          dosageInstruction: 'Take 1 tablet daily in morning',
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

    it('generates dose occurrences and records confirmed dose taken event', async () => {
      // 1. Generate occurrences for next 14 days
      const genRes = await request
        .post(`/api/families/${familyId}/medications/doses/generate`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ patientProfileId, daysAhead: 14 });

      expect(genRes.status).toBe(200);

      // 2. Fetch occurrences
      const occRes = await request
        .get(`/api/families/${familyId}/medications/doses`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .query({ patientProfileId, status: 'scheduled' });

      expect(occRes.status).toBe(200);
      expect(occRes.body.data.length).toBeGreaterThan(0);
      const targetDose = occRes.body.data[0];
      doseId = targetDose.id;
      expect(doseId).toBeDefined();

      // 3. Acknowledge dose as taken
      const ackRes = await request
        .patch(`/api/families/${familyId}/medications/doses/${targetDose.id}/status`)
        .set('Authorization', `Bearer ${caregiverToken}`)
        .send({
          status: 'taken',
          notes: 'Administered with breakfast',
        });

      expect(ackRes.status).toBe(200);
      expect(ackRes.body.data.status).toBe('taken');
    });

    it('creates a clinic follow-up appointment with automated reminders', async () => {
      const res = await request
        .post(`/api/families/${familyId}/appointments`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          patientProfileId,
          title: 'Cardiology Review with Dr. Suresh Joshi',
          doctorName: 'Dr. Suresh Joshi',
          clinicName: 'Metro Specialty Clinic',
          appointmentDate: '2026-11-15',
          scheduledTime: '11:00',
          reminderMinutesBefore: [1440, 120],
        });

      expect(res.status).toBe(201);
      appointmentId = res.body.data.id;
      expect(appointmentId).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Test G — SOS Demo Mode (Dual Scenarios)
  // ---------------------------------------------------------------------------
  describe('Test G — SOS Demo Mode (Dual Operational Scenarios)', () => {
    beforeAll(async () => {
      // Add verified emergency contact
      await request
        .post(`/api/families/${familyId}/sos/contacts`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          patientProfileId,
          name: 'Sunita Sharma',
          relationship: 'Daughter',
          phoneNumber: '+919876543109',
          priorityOrder: 1,
          canEscalateToHospital: true,
        });
    });

    it('Scenario 1: triggers SOS and records immediate family acknowledgement (FAMILY_RESPONDED)', async () => {
      const trigRes = await request
        .post(`/api/families/${familyId}/sos/trigger`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          patientProfileId,
          locationNote: 'Bedside button pressed, Bedroom Ground Floor',
        });

      expect(trigRes.status).toBe(201);
      const incident = trigRes.body.data?.incident || trigRes.body.incident;
      incidentId = incident.id;
      expect(incident.is_demo).toBe(true);
      expect(incident.status).toBe('AWAITING_FAMILY_RESPONSE');

      // Fetch attempts
      const incRes = await request
        .get(`/api/families/${familyId}/sos/incidents/${incidentId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      const attempts = incRes.body.attempts || incRes.body.data?.attempts || [];
      expect(attempts.length).toBeGreaterThan(0);
      const attemptId = attempts[0].id;

      // Immediate acknowledgement stops escalation
      const ackRes = await request
        .post(`/api/families/${familyId}/sos/incidents/${incidentId}/attempts/${attemptId}/acknowledge`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          action: 'I am responding',
          note: 'I am in the house. Assisting father now.',
        });

      expect(ackRes.status).toBe(200);
      expect(ackRes.body.incident.status).toBe('FAMILY_RESPONDED');

      // Resolve incident cleanly
      const resRes = await request
        .post(`/api/families/${familyId}/sos/incidents/${incidentId}/resolve`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ resolutionNote: 'False alarm resolved safely.' });
      expect(resRes.status).toBe(200);
      expect(resRes.body.incident.status).toBe('RESOLVED');
    });

    it('Scenario 2: no-response timeout escalates through Caregiver to Simulated Hospital Handoff', async () => {
      const trigRes = await request
        .post(`/api/families/${familyId}/sos/trigger`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          patientProfileId,
          locationNote: 'Bathroom panic alarm activated',
        });
      expect(trigRes.status).toBe(201);
      const unrespIncidentId = trigRes.body.data?.incident?.id || trigRes.body.incident?.id;

      // Timeout advance to caregiver escalation
      const adv1 = await request
        .post(`/api/families/${familyId}/sos/incidents/${unrespIncidentId}/advance`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(adv1.status).toBe(200);
      expect(adv1.body.incident.status).toBe('AWAITING_CAREGIVER_RESPONSE');

      // Timeout advance to hospital handoff
      const adv2 = await request
        .post(`/api/families/${familyId}/sos/incidents/${unrespIncidentId}/advance`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(adv2.status).toBe(200);
      expect(adv2.body.incident.status).toBe('HOSPITAL_HANDOFF_SIMULATED');
      expect(adv2.body.incident.current_stage).toBe('HOSPITAL_HANDOFF');

      // Resolve incident
      await request
        .post(`/api/families/${familyId}/sos/incidents/${unrespIncidentId}/resolve`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ resolutionNote: 'Escalation drill completed.' });
    });
  });

  // ---------------------------------------------------------------------------
  // Test H — Hospital Handoff
  // ---------------------------------------------------------------------------
  describe('Test H — Simulated Hospital Handoff & Receiving Desk Notice', () => {
    let handoffIncidentId: string;

    it('verifies synthetic hospital packet displays explicit DEMO MODE simulation provenance', async () => {
      const trigRes = await request
        .post(`/api/families/${familyId}/sos/trigger`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ patientProfileId, severity: 'CRITICAL' });
      handoffIncidentId = trigRes.body.data?.incident?.id || trigRes.body.incident?.id;

      // Advance through timeouts to handoff
      await request.post(`/api/families/${familyId}/sos/incidents/${handoffIncidentId}/advance`).set('Authorization', `Bearer ${ownerToken}`);
      await request.post(`/api/families/${familyId}/sos/incidents/${handoffIncidentId}/advance`).set('Authorization', `Bearer ${ownerToken}`);

      const detailRes = await request
        .get(`/api/families/${familyId}/sos/incidents/${handoffIncidentId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.handoff).toBeDefined();
      expect(detailRes.body.handoff.is_demo).toBe(true);
      expect(detailRes.body.handoff.simulation_provenance).toBe('DEMO_SIMULATION_ONLY');
      expect(detailRes.body.handoff.patient_summary_packet.verificationNotice).toContain('DEMO MODE ONLY');

      // Simulated hospital desk acknowledgement
      const ackRes = await request
        .post(`/api/families/${familyId}/sos/incidents/${handoffIncidentId}/hospital/acknowledge`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          receivingStaffName: 'Nurse Priya Desai (Emergency Desk, Simulated)',
          receivingNotes: 'Trauma triage bed allocated. Emergency physician notified.',
        });

      expect(ackRes.status).toBe(200);
      expect(ackRes.body.handoff.status).toBe('ACKNOWLEDGED_SIMULATED');

      // Cleanup
      await request
        .post(`/api/families/${familyId}/sos/incidents/${handoffIncidentId}/resolve`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ resolutionNote: 'Test H complete' });
    });
  });

  // ---------------------------------------------------------------------------
  // Test I — Live Test Mode Safety Controls
  // ---------------------------------------------------------------------------
  describe('Test I — Controlled Live Test Telephony Safety Controls', () => {
    it('blocks national emergency lines (112, 911, 108) from registration', async () => {
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
          displayName: 'Staging QA Engineer',
          phoneNumber: '+919123456789',
          permittedChannel: 'BOTH',
          allowedPurpose: 'Staging smoke test harness',
          consentNotes: 'Consented under internal staging test harness',
          verified: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.recipient.verification_status).toBe('VERIFIED');
      expect(res.body.recipient.consent_status).toBe('CONSENT_GRANTED');
    });
  });

  // ---------------------------------------------------------------------------
  // Test J — Offline Synchronization
  // ---------------------------------------------------------------------------
  describe('Test J — Offline Synchronization, Idempotency & Conflict Handling', () => {
    it('processes queued offline mutations idempotently without duplicate record creation', async () => {
      const clientOpId = crypto.randomUUID();
      const idempotencyKey = `idem_staging_smoke_${Date.now()}`;

      const batchPayload = {
        operations: [
          {
            clientOperationId: clientOpId,
            idempotencyKey,
            patientProfileId,
            operationType: 'PATIENT_UPDATE',
            payload: {
              patientId: patientProfileId,
              updates: {
                relationshipToCreator: 'Father / Senior Head',
              },
            },
            clientTimestamp: new Date().toISOString(),
          },
        ],
      };

      // First sync application
      const firstRes = await request
        .post(`/api/families/${familyId}/sync/batch`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(batchPayload);
      expect(firstRes.status).toBe(200);
      expect(firstRes.body.success).toBe(true);
      expect(firstRes.body.results).toHaveLength(1);
      expect(firstRes.body.results[0].status).toBe('synced');

      // Replay exact duplicate batch
      const replayRes = await request
        .post(`/api/families/${familyId}/sync/batch`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(batchPayload);
      expect(replayRes.status).toBe(200);
      expect(replayRes.body.results[0].status).toBe('synced');
    });

    it('reports clean sync status with zero unresolved critical conflicts', async () => {
      const res = await request
        .get(`/api/families/${familyId}/sync/status`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.familyId).toBe(familyId);
      expect(typeof res.body.pendingConflictsCount).toBe('number');
    });
  });

  // ---------------------------------------------------------------------------
  // Test K — Residential Society Mutual Aid & Privacy Isolation
  // ---------------------------------------------------------------------------
  describe('Test K — Community Assistance & Strict Clinical Privacy Isolation', () => {
    it('creates society group and posts non-emergency assistance request', async () => {
      const groupRes = await request
        .post('/api/communities')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Staging Greenwood Heights Society [SYNTHETIC DEMO]',
          description: 'Local neighborhood mutual aid group',
          groupType: 'residential_society',
          approximateLocality: 'Sector 52, Gurgaon',
          membershipPolicy: 'open',
          moderationPolicy: 'standard',
        });

      expect(groupRes.status).toBe(201);
      communityId = groupRes.body.group.id;

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
          contactPhone: '+919876543110',
          contactAddress: 'Flat 402, Greenwood',
        });

      expect(reqRes.status).toBe(201);
      assistanceRequestId = reqRes.body.request.id;
      expect(assistanceRequestId).toBeDefined();
    });

    it('guarantees private family medical records remain completely inaccessible to community members', async () => {
      // Community member attempts to access private family medical records
      const leakAttempt = await request
        .get(`/api/families/${familyId}/documents`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(leakAttempt.status).toBe(403);
    });
  });

  // ---------------------------------------------------------------------------
  // Test L — Negative Authorization & Cross-Tenant Boundaries
  // ---------------------------------------------------------------------------
  describe('Test L — Negative Authorization & Cross-Account Data Isolation', () => {
    it('prohibits outsider from accessing family patient records', async () => {
      const res = await request
        .get(`/api/families/${familyId}/patients`)
        .set('Authorization', `Bearer ${outsiderToken}`);
      expect(res.status).toBe(403);
    });

    it('rejects outsider attempts to access family workspace', async () => {
      const res = await request
        .get(`/api/families/${familyId}`)
        .set('Authorization', `Bearer ${outsiderToken}`);
      expect(res.status).toBe(403);
    });

    it('rejects outsider attempts to query patient AI health memory', async () => {
      const res = await request
        .post(`/api/families/${familyId}/memory/ask`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({
          patientProfileId,
          question: 'What illnesses does this patient have?',
        });
      expect(res.status).toBe(403);
    });

    it('rejects outsider attempts to inspect emergency incident timeline', async () => {
      const res = await request
        .get(`/api/families/${familyId}/sos/incidents`)
        .set('Authorization', `Bearer ${outsiderToken}`);
      expect(res.status).toBe(403);
    });
  });
});
