/**
 * backend/tests/phase5.test.ts
 *
 * Comprehensive Automated Test Suite for Phase 5:
 * Complete SOS Emergency Response Demo Mode & Fictional Hospital Handoff.
 *
 * Test A: Successful family response stops escalation
 * Test B: No-response timeout & Caregiver Escalation workflow
 * Test C: Simulated hospital handoff packet generation and receiving desk acknowledgement
 * Test D: State machine validity, duplicate protection, and invalid transition rejection
 * Test E: Restart recovery & background scheduler execution
 * Test F: Cross-family authorization isolation and security
 * Test G: Safety boundary & external communication isolation
 */

import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { app } from '../src/app.js';
import { reminderScheduler } from '../src/jobs/reminderScheduler.js';
import { db } from '../src/repositories/database.js';

const request = supertest(app);

describe('Phase 5 — Complete SOS Emergency Response Demo Mode', () => {
  let user1Token: string;
  let user2Token: string;
  let family1Id: string;
  let family2Id: string;
  let patient1Id: string;
  let patient2Id: string;

  beforeAll(async () => {
    // 1. Setup User 1 & Family 1
    const reg1 = await request.post('/api/auth/register').send({
      email: 'phase5_user1@example.com',
      password: 'password123',
      fullName: 'Vikram Sharma',
    });
    user1Token = reg1.body.data.token;

    const fam1 = await request
      .post('/api/families')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ name: 'Sharma Family Workspace' });
    family1Id = fam1.body.data.family.id;

    // Create Elderly Patient for Family 1
    const pat1 = await request
      .post(`/api/families/${family1Id}/patients`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        fullName: 'Om Prakash Sharma',
        category: 'elderly',
        dateOfBirth: '1948-03-12',
        gender: 'male',
        relationshipToCreator: 'Father',
      });
    patient1Id = pat1.body.data.profile.id;

    // 2. Setup User 2 & Family 2 (for cross-family isolation tests)
    const reg2 = await request.post('/api/auth/register').send({
      email: 'phase5_user2@example.com',
      password: 'password123',
      fullName: 'Anita Roy',
    });
    user2Token = reg2.body.data.token;

    const fam2 = await request
      .post('/api/families')
      .set('Authorization', `Bearer ${user2Token}`)
      .send({ name: 'Roy Family Workspace' });
    family2Id = fam2.body.data.family.id;

    const pat2 = await request
      .post(`/api/families/${family2Id}/patients`)
      .set('Authorization', `Bearer ${user2Token}`)
      .send({
        fullName: 'Anita Roy',
        category: 'adult',
        relationshipToCreator: 'Self',
      });
    patient2Id = pat2.body.data.profile.id;
    expect(patient2Id).toBeDefined();
  });

  describe('Test A — Successful Family Response Workflow', () => {
    let incidentId: string;
    let attemptId: string;

    it('creates an emergency incident with unique ID and simulated attempts', async () => {
      const res = await request
        .post(`/api/families/${family1Id}/sos/trigger`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          patientProfileId: patient1Id,
          severity: 'CRITICAL',
          locationNote: 'Master Bedroom (Ground Floor)',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.incident).toBeDefined();
      expect(res.body.incident.incident_number).toMatch(/^SOS-\d{8}-[A-Z0-9]{4}$/);
      expect(res.body.incident.status).toBe('AWAITING_FAMILY_RESPONSE');
      expect(res.body.incident.current_stage).toBe('FAMILY_CONTACT');
      expect(res.body.incident.is_demo).toBe(true);
      expect(res.body.incident.simulation_provenance).toBe('DEMO_SIMULATION_ONLY');
      expect(res.body.attempts.length).toBeGreaterThanOrEqual(1);

      incidentId = res.body.incident.id;
      attemptId = res.body.attempts[0].id;
    });

    it('retrieves the active incident for the patient', async () => {
      const res = await request
        .get(`/api/families/${family1Id}/sos/active?patientProfileId=${patient1Id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.incident).toBeDefined();
      expect(res.body.incident.id).toBe(incidentId);
      expect(res.body.incident.status).toBe('AWAITING_FAMILY_RESPONSE');
    });

    it('allows a simulated family contact to acknowledge ("I am responding")', async () => {
      const res = await request
        .post(`/api/families/${family1Id}/sos/incidents/${incidentId}/attempts/${attemptId}/acknowledge`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          action: 'I am responding',
          note: 'Heading home immediately. 5 minutes away.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.attempt.status).toBe('ACKNOWLEDGED');
      expect(res.body.attempt.acknowledgement_action).toBe('I am responding');
      expect(res.body.incident.status).toBe('FAMILY_RESPONDED');
      expect(res.body.incident.response_deadline).toBeNull();
    });

    it('records audit events in the incident timeline', async () => {
      const res = await request
        .get(`/api/families/${family1Id}/sos/incidents/${incidentId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.events.length).toBeGreaterThanOrEqual(2);

      const eventTypes = res.body.events.map((e: any) => e.event_type);
      expect(eventTypes).toContain('INCIDENT_CREATED');
      expect(eventTypes).toContain('FAMILY_ALERT_DISPATCHED');
      expect(eventTypes).toContain('FAMILY_ALERT_ACKNOWLEDGED');
    });

    it('allows resolving the acknowledged incident', async () => {
      const res = await request
        .post(`/api/families/${family1Id}/sos/incidents/${incidentId}/resolve`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          resolutionNote: 'Family arrived home. Patient is safe and conscious.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.incident.status).toBe('RESOLVED');
      expect(res.body.incident.current_stage).toBe('RESOLVED');
      expect(res.body.incident.resolved_at).toBeDefined();
    });
  });

  describe('Test B — No-Response Escalation to Caregiver', () => {
    let incidentId: string;

    it('triggers a fresh SOS incident for escalation testing', async () => {
      const res = await request
        .post(`/api/families/${family1Id}/sos/trigger`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          patientProfileId: patient1Id,
          severity: 'HIGH',
        });

      expect(res.status).toBe(201);
      incidentId = res.body.incident.id;
    });

    it('advances family timeout to caregiver escalation via Demo Control', async () => {
      const res = await request
        .post(`/api/families/${family1Id}/sos/incidents/${incidentId}/advance`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.advancedStage).toBe('CAREGIVER_ESCALATION');
      expect(res.body.incident.status).toBe('AWAITING_CAREGIVER_RESPONSE');
      expect(res.body.incident.current_stage).toBe('CAREGIVER_ESCALATION');
      expect(res.body.incident.response_deadline).toBeDefined();
    });

    it('verifies that caregiver attempt was created and previous family attempts marked timeout', async () => {
      const res = await request
        .get(`/api/families/${family1Id}/sos/incidents/${incidentId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);

      // Previous family attempts should be timeout
      const familyAttempts = res.body.attempts.filter((a: any) => a.stage === 'FAMILY_CONTACT');
      expect(familyAttempts.every((a: any) => a.status === 'TIMEOUT_NO_RESPONSE')).toBe(true);

      // Caregiver attempt should be awaiting response
      const caregiverAttempt = res.body.attempts.find((a: any) => a.stage === 'CAREGIVER_ESCALATION');
      expect(caregiverAttempt).toBeDefined();
      expect(caregiverAttempt.status).toBe('AWAITING_RESPONSE');

      // Timeline should contain timeout and escalation events
      const eventTypes = res.body.events.map((e: any) => e.event_type);
      expect(eventTypes).toContain('FAMILY_TIMEOUT');
      expect(eventTypes).toContain('CAREGIVER_ESCALATED');
    });

    it('allows caregiver to acknowledge ("I am taking responsibility")', async () => {
      const details = await request
        .get(`/api/families/${family1Id}/sos/incidents/${incidentId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      const caregiverAttempt = details.body.attempts.find((a: any) => a.stage === 'CAREGIVER_ESCALATION');

      const res = await request
        .post(`/api/families/${family1Id}/sos/incidents/${incidentId}/caregiver/acknowledge`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          attemptId: caregiverAttempt.id,
          action: 'I am taking responsibility',
          note: 'Nurse dispatched to patient residence.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.incident.status).toBe('CAREGIVER_RESPONDED');
      expect(res.body.attempt.status).toBe('ACKNOWLEDGED');
      expect(res.body.attempt.acknowledgement_action).toBe('I am taking responsibility');
    });

    it('cancels the incident cleanly', async () => {
      const res = await request
        .post(`/api/families/${family1Id}/sos/incidents/${incidentId}/cancel`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          reason: 'Caregiver verified false alarm, patient is stable.',
        });

      expect(res.status).toBe(200);
      expect(res.body.incident.status).toBe('CANCELLED');
    });
  });

  describe('Test C — Simulated Hospital Handoff Workflow', () => {
    let incidentId: string;

    it('triggers incident and advances through family and caregiver timeouts to hospital handoff', async () => {
      // 1. Trigger
      const startRes = await request
        .post(`/api/families/${family1Id}/sos/trigger`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ patientProfileId: patient1Id, severity: 'CRITICAL' });
      incidentId = startRes.body.incident.id;

      // 2. Advance past family timeout
      await request
        .post(`/api/families/${family1Id}/sos/incidents/${incidentId}/advance`)
        .set('Authorization', `Bearer ${user1Token}`);

      // 3. Advance past caregiver timeout
      const handoffRes = await request
        .post(`/api/families/${family1Id}/sos/incidents/${incidentId}/advance`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(handoffRes.status).toBe(200);
      expect(handoffRes.body.incident.status).toBe('HOSPITAL_HANDOFF_SIMULATED');
      expect(handoffRes.body.incident.current_stage).toBe('HOSPITAL_HANDOFF');
    });

    it('verifies that synthetic emergency health summary packet was generated for hospital handoff', async () => {
      const res = await request
        .get(`/api/families/${family1Id}/sos/incidents/${incidentId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.handoff).toBeDefined();
      expect(res.body.handoff.status).toBe('PENDING_SIMULATED');
      expect(res.body.handoff.is_demo).toBe(true);
      expect(res.body.handoff.simulation_provenance).toBe('DEMO_SIMULATION_ONLY');

      const packet = res.body.handoff.patient_summary_packet;
      expect(packet).toBeDefined();
      expect(packet.patient.fullName).toBe('Om Prakash Sharma');
      expect(packet.patient.healthId).toBeDefined();
      expect(packet.criticalConditions.length).toBeGreaterThan(0);
      expect(packet.knownAllergies.length).toBeGreaterThan(0);
      expect(packet.verificationNotice).toContain('DEMO MODE ONLY');
    });

    it('allows simulated hospital receiving desk to acknowledge packet receipt', async () => {
      const res = await request
        .post(`/api/families/${family1Id}/sos/incidents/${incidentId}/hospital/acknowledge`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          receivingStaffName: 'Nurse Priya Desai (Emergency Desk, Simulated)',
          receivingNotes: 'Trauma triage bed allocated. Emergency physician notified.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.handoff.status).toBe('ACKNOWLEDGED_SIMULATED');
      expect(res.body.handoff.receiving_staff_name).toContain('Nurse Priya Desai');
      expect(res.body.handoff.acknowledged_at).toBeDefined();
    });

    it('verifies timeline includes handoff preparation and acknowledgement', async () => {
      const res = await request
        .get(`/api/families/${family1Id}/sos/incidents/${incidentId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      const eventTypes = res.body.events.map((e: any) => e.event_type);
      expect(eventTypes).toContain('HOSPITAL_HANDOFF_PREPARED');
      expect(eventTypes).toContain('HOSPITAL_HANDOFF_ACKNOWLEDGED');

      // Resolve incident to finish test
      await request
        .post(`/api/families/${family1Id}/sos/incidents/${incidentId}/resolve`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ resolutionNote: 'Hospital handoff simulation test complete' });
    });
  });

  describe('Test D — State Machine Validity, Duplicate Protection & Invalid Transitions', () => {
    let incidentId: string;

    it('prevents creating duplicate active incidents for the same patient', async () => {
      // 1. Create first incident
      const first = await request
        .post(`/api/families/${family1Id}/sos/trigger`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ patientProfileId: patient1Id });
      expect(first.status).toBe(201);
      incidentId = first.body.incident.id;

      // 2. Attempt duplicate while active -> 409 Conflict
      const duplicate = await request
        .post(`/api/families/${family1Id}/sos/trigger`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ patientProfileId: patient1Id });

      expect(duplicate.status).toBe(409);
      expect(duplicate.body.message).toContain('active emergency incident is already in progress');
    });

    it('rejects invalid state transitions on a resolved incident', async () => {
      // Resolve the incident
      await request
        .post(`/api/families/${family1Id}/sos/incidents/${incidentId}/resolve`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ resolutionNote: 'Resolved for transition testing' });

      // Attempting to cancel an already resolved incident should be rejected
      const cancelRes = await request
        .post(`/api/families/${family1Id}/sos/incidents/${incidentId}/cancel`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ reason: 'Try to cancel resolved' });

      expect(cancelRes.status).toBe(400);
      expect(cancelRes.body.message).toContain('Cannot transition incident from RESOLVED to CANCELLED');

      // Attempting to advance a resolved incident should be rejected
      const advanceRes = await request
        .post(`/api/families/${family1Id}/sos/incidents/${incidentId}/advance`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({});

      expect(advanceRes.status).toBe(400);
      expect(advanceRes.body.message).toContain('Cannot advance resolved incident');
    });
  });

  describe('Test E — Restart Recovery & Background Scheduler Processing', () => {
    it('processes due timeout jobs automatically via reminderScheduler.processDueJobs()', async () => {
      // 1. Configure very short policy (5 seconds)
      await request
        .post(`/api/families/${family1Id}/sos/policy`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          patientProfileId: patient1Id,
          familyResponseTimeoutSeconds: 5,
          caregiverResponseTimeoutSeconds: 5,
        });

      // 2. Trigger SOS
      const startRes = await request
        .post(`/api/families/${family1Id}/sos/trigger`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ patientProfileId: patient1Id });
      expect(startRes.status).toBe(201);
      const incId = startRes.body.incident.id;

      // 3. Fast-forward the scheduled job to be due now
      const dueJobs = await db.fetchDueScheduledJobs(new Date(Date.now() + 10000).toISOString());
      const familyJob = dueJobs.find((j) => j.reference_id === incId && j.job_type === 'sos_family_timeout');
      expect(familyJob).toBeDefined();

      // Update its scheduled_at to past
      await db.updateScheduledJob(familyJob!.id, {
        scheduled_at: new Date(Date.now() - 1000).toISOString(),
      });

      // 4. Run scheduler
      const schedulerRes = await reminderScheduler.processDueJobs();
      expect(schedulerRes.processedCount).toBeGreaterThanOrEqual(1);

      // 5. Verify incident transitioned to AWAITING_CAREGIVER_RESPONSE
      const updated = await db.getEmergencyIncidentById(incId);
      expect(updated?.status).toBe('AWAITING_CAREGIVER_RESPONSE');
      expect(updated?.current_stage).toBe('CAREGIVER_ESCALATION');

      // Clean up by resolving
      await request
        .post(`/api/families/${family1Id}/sos/incidents/${incId}/resolve`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ resolutionNote: 'Scheduler test complete' });
    });
  });

  describe('Test F — Cross-Family Isolation & Authorization', () => {
    let family1IncidentId: string;

    beforeAll(async () => {
      const res = await request
        .post(`/api/families/${family1Id}/sos/trigger`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ patientProfileId: patient1Id });
      family1IncidentId = res.body.incident.id;
    });

    it('prevents User 2 from triggering SOS for User 1 patient', async () => {
      const res = await request
        .post(`/api/families/${family2Id}/sos/trigger`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ patientProfileId: patient1Id });

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Patient profile not found in this family workspace');
    });

    it('prevents User 2 from accessing Family 1 incidents', async () => {
      const res = await request
        .get(`/api/families/${family1Id}/sos/incidents/${family1IncidentId}`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.status).toBe(403);
    });

    it('prevents User 2 from cancelling or acknowledging Family 1 incidents', async () => {
      const res = await request
        .post(`/api/families/${family1Id}/sos/incidents/${family1IncidentId}/cancel`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ reason: 'Malicious cancel attempt' });

      expect(res.status).toBe(403);
    });

    it('prevents User 2 from reading or modifying Family 1 emergency contacts', async () => {
      const res = await request
        .get(`/api/families/${family1Id}/sos/contacts`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.status).toBe(403);
    });

    it('cleans up Family 1 incident for subsequent tests', async () => {
      await request
        .post(`/api/families/${family1Id}/sos/incidents/${family1IncidentId}/resolve`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ resolutionNote: 'Isolation test complete' });
    });
  });

  describe('Test G — External Communication Isolation & Safe Demo Reset', () => {
    it('verifies that all contacts and attempts have explicit simulation markers', async () => {
      const res = await request
        .get(`/api/families/${family1Id}/sos/contacts?patientProfileId=${patient1Id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.contacts.length).toBeGreaterThan(0);
      for (const contact of res.body.contacts) {
        expect(contact.is_demo).toBe(true);
        expect(contact.simulation_provenance).toBe('DEMO_SIMULATION_ONLY');
        expect(contact.phone_number).toContain('(Simulated)');
      }
    });

    it('safely resets the demo scenario without affecting other families', async () => {
      // 1. Reset Family 1 demo scenario
      const resetRes = await request
        .post(`/api/families/${family1Id}/sos/demo/reset`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ patientProfileId: patient1Id });

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.success).toBe(true);
      expect(resetRes.body.message).toContain('Demo scenario reset successfully');

      // 2. Verify no active incidents remain
      const activeRes = await request
        .get(`/api/families/${family1Id}/sos/active?patientProfileId=${patient1Id}`)
        .set('Authorization', `Bearer ${user1Token}`);
      expect(activeRes.body.incident).toBeNull();

      // 3. Verify clean contacts restored
      const contactsRes = await request
        .get(`/api/families/${family1Id}/sos/contacts?patientProfileId=${patient1Id}`)
        .set('Authorization', `Bearer ${user1Token}`);
      expect(contactsRes.body.contacts.length).toBe(3);

      // 4. Verify Family 2 data was not touched
      const fam2Patients = await request
        .get(`/api/families/${family2Id}/patients`)
        .set('Authorization', `Bearer ${user2Token}`);
      expect(fam2Patients.status).toBe(200);
      expect(fam2Patients.body.data.profiles.length).toBe(1);
    });
  });
});
