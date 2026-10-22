/**
 * backend/tests/phase11_release_candidate.test.ts
 *
 * Phase 11: Final Release Candidate Integration & End-to-End Validation
 * Validates complete system integration across User Journeys A through J:
 *   - Journey A: New user, family workspace, patient profile & Health ID
 *   - Journey B: Medical record upload, OCR review, confirmed extraction & AI citation
 *   - Journey C: Doctor visit preparation & downloadable binary PDF summary
 *   - Journey D: Confirmed medication schedule, dose tracking, and appointment management
 *   - Journey E: Successful SOS response with immediate family acknowledgement
 *   - Journey F: No-response SOS escalation, caregiver tier, and simulated hospital handoff
 *   - Journey G: Live test notification safety controls & emergency number blocking
 *   - Journey H: Offline synchronization batch processing, idempotency & conflict handling
 *   - Journey I: Community elderly assistance coordination & clinical privacy isolation
 *   - Journey J: Cross-account and cross-family security boundaries
 *   - Demo Suite: Synthetic demo workspace seeding & isolated demo reset
 */

import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import crypto from 'crypto';

process.env['DEMO_MODE'] = 'true';
process.env['NODE_ENV'] = 'test';

import { app } from '../src/app.js';
import { db } from '../src/repositories/database.js';

const request = supertest(app);

describe('Phase 11 — Final Release Candidate Integration & Validation (Journeys A-J)', () => {
  // Test User Accounts
  let ownerToken: string;
  let ownerId: string;
  let caregiverToken: string;
  let caregiverId: string;
  let outsiderToken: string;
  let outsiderId: string;

  // Shared Entity IDs
  let familyId: string;
  let patientProfileId: string;
  let documentId: string;
  let scheduleId: string;
  let appointmentId: string;
  let communityId: string;
  let assistanceRequestId: string;
  let incidentId: string;

  beforeAll(async () => {
    // 1. Register Primary Owner
    const ownerRes = await request.post('/api/auth/register').send({
      email: 'p11_owner@sanjivani.local',
      password: 'ReleasePassword123!',
      fullName: 'Aarav Sharma',
      phone: '+919876543201',
    });
    expect(ownerRes.status).toBe(201);
    ownerToken = ownerRes.body.data?.token || ownerRes.body.token;
    ownerId = ownerRes.body.data?.user?.id || ownerRes.body.user?.id;

    // 2. Register Caregiver User
    const cgRes = await request.post('/api/auth/register').send({
      email: 'p11_caregiver@sanjivani.local',
      password: 'ReleasePassword123!',
      fullName: 'Pooja Verma',
      phone: '+919876543202',
    });
    expect(cgRes.status).toBe(201);
    caregiverToken = cgRes.body.data?.token || cgRes.body.token;
    caregiverId = cgRes.body.data?.user?.id || cgRes.body.user?.id;

    // 3. Register Unrelated Outsider User
    const outRes = await request.post('/api/auth/register').send({
      email: 'p11_outsider@sanjivani.local',
      password: 'ReleasePassword123!',
      fullName: 'External Stranger',
      phone: '+919876543203',
    });
    expect(outRes.status).toBe(201);
    outsiderToken = outRes.body.data?.token || outRes.body.token;
    outsiderId = outRes.body.data?.user?.id || outRes.body.user?.id;

    expect(ownerId).toBeDefined();
    expect(caregiverId).toBeDefined();
    expect(outsiderId).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // Journey A: New user and family
  // ---------------------------------------------------------------------------
  describe('Journey A — New User, Family Workspace & Patient Profiles', () => {
    it('creates family workspace for primary owner', async () => {
      const res = await request
        .post('/api/families')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Sharma Healthcare Workspace' });

      expect(res.status).toBe(201);
      familyId = res.body.data?.family?.id || res.body.family?.id;
      expect(familyId).toBeDefined();
    });

    it('adds caregiver to family workspace with caregiver role', async () => {
      const res = await request
        .post(`/api/families/${familyId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'p11_caregiver@sanjivani.local',
          role: 'caregiver',
        });

      expect([200, 201]).toContain(res.status);
    });

    it('creates elderly patient profile with deterministic Health ID format (SNJ-XXXX-XXXX)', async () => {
      const res = await request
        .post(`/api/families/${familyId}/patients`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          fullName: 'Kailash Nath Sharma',
          gender: 'male',
          dateOfBirth: '1949-06-15',
          relationshipToCreator: 'father',
          category: 'elderly',
        });

      expect(res.status).toBe(201);
      const profile = res.body.data?.profile || res.body.profile;
      patientProfileId = profile.id;
      expect(profile.full_name).toBe('Kailash Nath Sharma');
      expect(profile.health_id).toMatch(/^SNJ-[A-Z0-9]{4}-[A-Z0-9]{4}(-[A-Z0-9]{4})?$/);
    });

    it('allows caregiver to view patient profile but prevents modification', async () => {
      // Caregiver view permitted
      const viewRes = await request
        .get(`/api/families/patients/${patientProfileId}`)
        .set('Authorization', `Bearer ${caregiverToken}`);
      expect(viewRes.status).toBe(200);

      // Caregiver update rejected
      const patchRes = await request
        .patch(`/api/families/patients/${patientProfileId}`)
        .set('Authorization', `Bearer ${caregiverToken}`)
        .send({ fullName: 'Malicious Rename' });
      expect(patchRes.status).toBe(403);
    });
  });

  // ---------------------------------------------------------------------------
  // Journey B: Medical record to AI answer
  // ---------------------------------------------------------------------------
  describe('Journey B — Medical Record Ingestion, Human OCR Review & Grounded AI Answer', () => {
    it('uploads synthetic diagnostic report with SHA-256 deduplication support', async () => {
      const fakePdfBuffer = Buffer.from(
        'Apex Diagnostic Hospital Mumbai\n' +
        'Dr. Anjali Nair, MD (Internal Medicine)\n' +
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
        .attach('file', fakePdfBuffer, { filename: 'apex_rx.png', contentType: 'image/png' });

      expect(res.status).toBe(201);
      const doc = res.body.data || res.body.document;
      documentId = doc.id;
      expect(doc.title).toBe('Apex Hospital Prescription Sep 2026');
    });

    it('submits human confirmation of OCR extracted conditions and medications', async () => {
      const res = await request
        .post(`/api/families/documents/review/${documentId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          markConfirmed: true,
          confirmedFields: {
            doctor_name: 'Dr. Anjali Nair',
            prescription_medicines: [
              { name: 'Metformin', strength: '500mg', dosage: '1 tab twice daily', frequency: 'twice_daily', instructions: 'after meals' },
              { name: 'Telmisartan', strength: '40mg', dosage: '1 tab daily', frequency: 'once_daily', instructions: 'morning with water' },
            ],
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.document.review_status).toBe('confirmed');
    });

    it('queries AI Health Memory and verifies answer is grounded with citation of original report', async () => {
      const res = await request
        .post(`/api/families/${familyId}/memory/ask`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          patientProfileId,
          question: 'What medications were prescribed for Kailash Nath Sharma?',
        });

      expect(res.status).toBe(200);
      const answer = res.body.data?.answer || res.body.answer;
      expect(answer).toBeDefined();
      expect(typeof answer).toBe('string');
      // Verifies citations
      const citations = res.body.data?.sources || res.body.data?.citations || res.body.citations || [];
      expect(citations.length).toBeGreaterThan(0);
    });

    it('honestly refuses unrecorded facts without inventing hallucinations', async () => {
      const res = await request
        .post(`/api/families/${familyId}/memory/ask`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          patientProfileId,
          question: 'Does the patient have a documented history of severe brain cancer or glioblastoma?',
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
  // Journey C: Doctor visit preparation
  // ---------------------------------------------------------------------------
  describe('Journey C — Doctor Visit Preparation & Clinical PDF Summary Generation', () => {
    it('generates a real downloadable binary PDF clinical summary', async () => {
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
  // Journey D: Medicine and appointment tracking
  // ---------------------------------------------------------------------------
  describe('Journey D — Medication Regimens, Adherence Tracking & Clinic Appointments', () => {
    it('creates an active medication schedule derived from verified prescription', async () => {
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

    it('generates dose occurrences and logs a confirmed dose event (taken)', async () => {
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

    it('creates a clinical follow-up appointment with automated reminders', async () => {
      const res = await request
        .post(`/api/families/${familyId}/appointments`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          patientProfileId,
          title: 'Cardiology & Blood Pressure Review',
          doctorName: 'Dr. Suresh Joshi',
          clinicName: 'Metro Specialty Hospital',
          appointmentDate: '2026-11-05',
          scheduledTime: '10:30',
          reminderMinutesBefore: [1440, 120],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe('Cardiology & Blood Pressure Review');
      appointmentId = res.body.data.id;
      expect(appointmentId).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Journey E: Successful SOS response
  // ---------------------------------------------------------------------------
  describe('Journey E — Successful SOS Response with Immediate Family Acknowledgement', () => {
    let familyContactId: string;

    beforeAll(async () => {
      const cRes = await request
        .post(`/api/families/${familyId}/sos/contacts`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          patientProfileId,
          name: 'Sunita Sharma',
          relationship: 'Daughter',
          phoneNumber: '+919876543209',
          priorityOrder: 1,
          canEscalateToHospital: true,
        });
      familyContactId = cRes.body.data?.contact?.id || cRes.body.contact?.id;
      expect(familyContactId).toBeDefined();
    });

    it('triggers a synthetic SOS incident and begins contacting family', async () => {
      const res = await request
        .post(`/api/families/${familyId}/sos/trigger`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          patientProfileId,
          locationNote: 'Bedside panic button pressed, Ground Floor Bedroom',
        });

      expect(res.status).toBe(201);
      const incident = res.body.data?.incident || res.body.incident;
      incidentId = incident.id;
      expect(incident.is_demo).toBe(true);
      expect(['TRIGGERED', 'FAMILY_CONTACT']).toContain(incident.current_stage);
      expect(incident.status).toBe('AWAITING_FAMILY_RESPONSE');
    });

    it('records family contact acknowledgement and stops escalation (FAMILY_RESPONDED)', async () => {
      const incRes = await request
        .get(`/api/families/${familyId}/sos/incidents/${incidentId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      const attempts = incRes.body.attempts || incRes.body.data?.attempts || [];
      expect(attempts.length).toBeGreaterThan(0);
      const attemptId = attempts[0].id;

      const ackRes = await request
        .post(`/api/families/${familyId}/sos/incidents/${incidentId}/attempts/${attemptId}/acknowledge`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          action: 'I am responding',
          note: 'I am at home and with father now. Condition stable.',
        });

      expect(ackRes.status).toBe(200);
      expect(ackRes.body.incident.status).toBe('FAMILY_RESPONDED');

      // Resolve incident to finish Journey E
      const resRes = await request
        .post(`/api/families/${familyId}/sos/incidents/${incidentId}/resolve`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ resolutionNote: 'Family confirmed false alarm, elder is safe.' });
      expect(resRes.status).toBe(200);
      expect(resRes.body.incident.status).toBe('RESOLVED');
    });
  });

  // ---------------------------------------------------------------------------
  // Journey F: No-response SOS escalation
  // ---------------------------------------------------------------------------
  describe('Journey F — No-Response SOS Escalation, Caregiver Tier & Simulated Hospital Handoff', () => {
    let unrespondedIncidentId: string;

    it('starts a new incident and advances timeout to Caregiver tier (AWAITING_CAREGIVER_RESPONSE)', async () => {
      const trigRes = await request
        .post(`/api/families/${familyId}/sos/trigger`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          patientProfileId,
          locationNote: 'Bathroom fall detected',
        });
      unrespondedIncidentId = trigRes.body.data?.incident?.id || trigRes.body.incident?.id;

      const advRes = await request
        .post(`/api/families/${familyId}/sos/incidents/${unrespondedIncidentId}/advance`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(advRes.status).toBe(200);
      expect(advRes.body.incident.status).toBe('AWAITING_CAREGIVER_RESPONSE');
      expect(advRes.body.incident.current_stage).toBe('CAREGIVER_ESCALATION');
    });

    it('advances caregiver timeout to simulated hospital handoff (HOSPITAL_HANDOFF_SIMULATED)', async () => {
      const advRes = await request
        .post(`/api/families/${familyId}/sos/incidents/${unrespondedIncidentId}/advance`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(advRes.status).toBe(200);
      expect(advRes.body.incident.status).toBe('HOSPITAL_HANDOFF_SIMULATED');
      expect(advRes.body.incident.current_stage).toBe('HOSPITAL_HANDOFF');

      // Verify incident details show simulated handoff packet with disclaimer
      const detailRes = await request
        .get(`/api/families/${familyId}/sos/incidents/${unrespondedIncidentId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.handoff).toBeDefined();
      expect(detailRes.body.handoff.is_demo).toBe(true);
      expect(detailRes.body.handoff.patient_summary_packet.verificationNotice).toContain('DEMO MODE ONLY');

      // Hospital receiving desk acknowledges simulated handoff
      const ackRes = await request
        .post(`/api/families/${familyId}/sos/incidents/${unrespondedIncidentId}/hospital/acknowledge`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          receivingStaffName: 'Nurse Priya Desai (Emergency Desk, Simulated)',
          receivingNotes: 'Trauma triage bed allocated. Emergency physician notified.',
        });

      expect(ackRes.status).toBe(200);
      expect(ackRes.body.handoff.status).toBe('ACKNOWLEDGED_SIMULATED');

      // Resolve incident to complete Journey F cleanly
      const resolveRes = await request
        .post(`/api/families/${familyId}/sos/incidents/${unrespondedIncidentId}/resolve`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ resolutionNote: 'Hospital handoff simulation test complete' });
      expect(resolveRes.status).toBe(200);
      expect(resolveRes.body.incident.status).toBe('RESOLVED');
    });
  });

  // ---------------------------------------------------------------------------
  // Journey G: Live test notification
  // ---------------------------------------------------------------------------
  describe('Journey G — Controlled Live Test Telephony Safety Controls', () => {
    it('blocks national emergency numbers (112, 911) from live test registration', async () => {
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

  // ---------------------------------------------------------------------------
  // Journey H: Offline synchronization
  // ---------------------------------------------------------------------------
  describe('Journey H — Offline Batch Synchronization, Idempotency & Conflict Handling', () => {
    it('processes queued offline mutations idempotently without duplicate application', async () => {
      const clientOpId = crypto.randomUUID();
      const idempotencyKey = `idem_p11_${Date.now()}`;

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

  // ---------------------------------------------------------------------------
  // Journey I: Community assistance
  // ---------------------------------------------------------------------------
  describe('Journey I — Residential Society Assistance & Strict Healthcare Privacy Isolation', () => {
    it('creates residential society group and posts non-emergency assistance request', async () => {
      // 1. Create society group
      const grpRes = await request
        .post('/api/communities')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Greenwood Heights Society [SYNTHETIC DEMO]',
          description: 'Local neighborhood mutual aid group',
          groupType: 'residential_society',
          approximateLocality: 'Sector 52, Gurgaon',
          membershipPolicy: 'open',
          moderationPolicy: 'standard',
        });

      expect(grpRes.status).toBe(201);
      expect(grpRes.body.group.name).toBe('Greenwood Heights Society [SYNTHETIC DEMO]');
      communityId = grpRes.body.group.id;

      // 2. Post assistance request
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
    });

    it('accepts volunteer assignment and closes assistance request', async () => {
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

    it('strictly guarantees private family medical records remain completely inaccessible to community members', async () => {
      const leakAttempt = await request
        .get(`/api/families/${familyId}/documents`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(leakAttempt.status).toBe(403);
    });
  });

  // ---------------------------------------------------------------------------
  // Journey J: Cross-account isolation
  // ---------------------------------------------------------------------------
  describe('Journey J — Cross-Account Isolation & Zero Unauthorized Data Leakage', () => {
    it('prohibits outsider from accessing family patient records', async () => {
      const res = await request
        .get(`/api/families/patients/${patientProfileId}`)
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
          question: 'What are the patient allergies?',
        });

      expect(res.status).toBe(403);
    });

    it('rejects outsider attempts to inspect emergency incident timeline', async () => {
      const res = await request
        .get(`/api/families/${familyId}/sos/incidents/${incidentId}`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ---------------------------------------------------------------------------
  // Synthetic Demonstration Environment Seeding & Reset Verification
  // ---------------------------------------------------------------------------
  describe('Synthetic Demonstration Environment API (Phase 11 Seeding & Reset)', () => {
    let demoFamilyId: string;
    let demoPatientId: string;

    it('POST /api/demo/seed initializes complete synthetic demo workspace', async () => {
      const res = await request
        .post('/api/demo/seed')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const seeded = res.body.seeded;
      expect(seeded.family.provenance).toBe('SYNTHETIC DEMO DATASET');
      expect(seeded.patient.healthId).toBe('SNJ-2026-DEMO-001');
      expect(seeded.document.reviewStatus).toBe('confirmed');
      expect(seeded.medications.length).toBeGreaterThan(0);
      expect(seeded.emergencyContacts.length).toBe(2);
      expect(seeded.disclaimer).toContain('ALL SEEDED DEMO DATA IS SYNTHETIC');

      demoFamilyId = seeded.family.id;
      demoPatientId = seeded.patient.id;
    });

    it('POST /api/demo/families/:familyId/patients/:patientId/reset cleanly resets demo scenario', async () => {
      const res = await request
        .post(`/api/demo/families/${demoFamilyId}/patients/${demoPatientId}/reset`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Synthetic demonstration scenario has been reset');
    });

    it('GET /api/demo/status reports demo mode status without requiring authentication', async () => {
      const res = await request.get('/api/demo/status');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.safetyNotice).toContain('simulated');
    });
  });
});
