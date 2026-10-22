/**
 * backend/tests/phase7.test.ts
 *
 * Automated Test Suite for Phase 7:
 * Offline-First Health Records, Local Storage & Reliable Synchronization.
 *
 * Covers:
 * 1. Batch Synchronization & Strict Server-Side Idempotency
 * 2. Optimistic Concurrency, Diffing & Conflict Detection
 * 3. User Conflict Resolution (Client Wins, Server Wins)
 * 4. Discrete Medication Dose Acknowledgements (No Schedule Clobbering)
 * 5. Appointment Cancellation Safeguards (No Silent Re-creation)
 * 6. Server-Side Authorization Revalidation & Revocation Rejection
 * 7. Delta Change Retrieval & Synchronization Status
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { db } from '../src/repositories/database.js';

describe('Phase 7 — Offline-First Health Records & Synchronization', () => {
  let user1Token: string;
  let user2Token: string;

  let family1Id: string;
  let family2Id: string;
  let patient1Id: string;
  let patient2Id: string;

  let schedule1Id: string;
  let appointment1Id: string;
  let cancelledApptId: string;

  beforeAll(async () => {
    // 1. Register User 1
    const reg1 = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'phase7.owner@example.com',
        password: 'secure-phase7-pass',
        fullName: 'Phase 7 Workspace Owner',
        phone: '+919999900001',
      });
    expect(reg1.status).toBe(201);
    user1Token = reg1.body.data.token;

    // 2. Register User 2 (External / Separate Family)
    const reg2 = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'phase7.stranger@example.com',
        password: 'secure-phase7-pass',
        fullName: 'Phase 7 Stranger',
        phone: '+919999900002',
      });
    expect(reg2.status).toBe(201);
    user2Token = reg2.body.data.token;

    // 3. User 1 creates Family 1
    const fam1 = await request(app)
      .post('/api/families')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ name: 'Phase 7 Primary Family' });
    expect(fam1.status).toBe(201);
    family1Id = fam1.body.data.family.id;

    // 4. User 2 creates Family 2
    const fam2 = await request(app)
      .post('/api/families')
      .set('Authorization', `Bearer ${user2Token}`)
      .send({ name: 'Phase 7 Isolated Family' });
    expect(fam2.status).toBe(201);
    family2Id = fam2.body.data.family.id;

    // 5. User 1 creates Patient 1 in Family 1
    const pat1 = await request(app)
      .post(`/api/families/${family1Id}/patients`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        fullName: 'Aarav Sharma',
        category: 'child',
        relationshipToCreator: 'Son',
        dateOfBirth: '2018-05-12',
        gender: 'male',
      });
    expect(pat1.status).toBe(201);
    patient1Id = pat1.body.data.profile.id;

    // 6. User 2 creates Patient 2 in Family 2
    const pat2 = await request(app)
      .post(`/api/families/${family2Id}/patients`)
      .set('Authorization', `Bearer ${user2Token}`)
      .send({
        fullName: 'Meera Iyer',
        category: 'adult',
        relationshipToCreator: 'Self',
        dateOfBirth: '1992-09-20',
        gender: 'female',
      });
    expect(pat2.status).toBe(201);
    patient2Id = pat2.body.data.profile.id;

    // 7. Seed active Medication Schedule for Patient 1
    const medRes = await request(app)
      .post(`/api/families/${family1Id}/medications`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        patientProfileId: patient1Id,
        medicineName: 'Amoxicillin Oral Suspension',
        dosageInstruction: '250mg / 5ml',
        frequency: 'twice_daily',
        scheduledTimes: ['08:00', '20:00'],
        startDate: '2026-10-22',
        endDate: '2026-10-30',
        instructions: 'Take after meals',
      });
    expect(medRes.status).toBe(201);
    schedule1Id = medRes.body.data.id;

    // 8. Seed active Appointment and a cancelled Appointment for Patient 1
    const apptRes = await request(app)
      .post(`/api/families/${family1Id}/appointments`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        patientProfileId: patient1Id,
        title: 'Pediatric Checkup',
        doctorName: 'Dr. Priya Desai',
        facilityName: 'Fortis Hospital',
        appointmentDate: '2026-11-05',
        appointmentTime: '10:30',
        timezone: 'Asia/Kolkata',
      });
    expect(apptRes.status).toBe(201);
    appointment1Id = apptRes.body.data.id;

    const cancelRes = await request(app)
      .post(`/api/families/${family1Id}/appointments`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        patientProfileId: patient1Id,
        title: 'Orthopedic Consultation (Old)',
        doctorName: 'Dr. Ramesh Rao',
        appointmentDate: '2026-10-20',
        appointmentTime: '14:00',
        timezone: 'Asia/Kolkata',
      });
    expect(cancelRes.status).toBe(201);
    cancelledApptId = cancelRes.body.data.id;

    // Mark it cancelled
    await db.updateAppointment(cancelledApptId, { status: 'cancelled' });
  });

  // ---------------------------------------------------------------------------
  // 1. Batch Synchronization & Server-Side Idempotency
  // ---------------------------------------------------------------------------
  describe('1. Batch Synchronization & Server-Side Idempotency', () => {
    it('processes a batch of offline-queued operations successfully', async () => {
      const clientOpId = crypto.randomUUID();
      const idempotencyKey = `idem_${clientOpId}`;

      const res = await request(app)
        .post(`/api/families/${family1Id}/sync/batch`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          operations: [
            {
              clientOperationId: clientOpId,
              idempotencyKey,
              patientProfileId: patient1Id,
              operationType: 'PATIENT_UPDATE',
              payload: {
                patientId: patient1Id,
                updates: {
                  relationshipToCreator: 'Elder Son',
                },
              },
              clientTimestamp: new Date().toISOString(),
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.results).toHaveLength(1);
      expect(res.body.results[0].status).toBe('synced');
      expect(res.body.results[0].clientOperationId).toBe(clientOpId);

      // Verify the patient record was actually updated
      const updatedPat = await db.getPatientProfileById(patient1Id);
      expect(updatedPat?.relationship_to_creator).toBe('Elder Son');
    });

    it('returns cached result and prevents duplicate writes on identical idempotencyKey', async () => {
      const clientOpId = crypto.randomUUID();
      const idempotencyKey = `idem_unique_${Date.now()}`;

      // First submission: create an appointment via sync batch
      const res1 = await request(app)
        .post(`/api/families/${family1Id}/sync/batch`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          operations: [
            {
              clientOperationId: clientOpId,
              idempotencyKey,
              patientProfileId: patient1Id,
              operationType: 'APPOINTMENT_CREATE',
              payload: {
                patientProfileId: patient1Id,
                title: 'Dental Screening',
                doctorName: 'Dr. Sunita Mehta',
                scheduledAt: '2026-11-12T11:00:00.000Z',
              },
              clientTimestamp: new Date().toISOString(),
            },
          ],
        });

      expect(res1.status).toBe(200);
      expect(res1.body.results[0].status).toBe('synced');
      const createdApptId = res1.body.results[0].serverEntityId;
      expect(createdApptId).toBeDefined();

      // Immediate re-submission with identical idempotencyKey (e.g. simulated network retry)
      const res2 = await request(app)
        .post(`/api/families/${family1Id}/sync/batch`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          operations: [
            {
              clientOperationId: clientOpId,
              idempotencyKey,
              patientProfileId: patient1Id,
              operationType: 'APPOINTMENT_CREATE',
              payload: {
                patientProfileId: patient1Id,
                title: 'Dental Screening',
                doctorName: 'Dr. Sunita Mehta',
                scheduledAt: '2026-11-12T11:00:00.000Z',
              },
              clientTimestamp: new Date().toISOString(),
            },
          ],
        });

      expect(res2.status).toBe(200);
      expect(res2.body.results[0].status).toBe('synced');
      // Must not create a second appointment in the database
      const appts = await db.listAppointmentsByPatient(patient1Id);
      const matching = appts.filter((a) => a.title === 'Dental Screening');
      expect(matching).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Optimistic Concurrency, Diffing & Conflict Detection
  // ---------------------------------------------------------------------------
  describe('2. Optimistic Concurrency & Conflict Detection', () => {
    it('detects concurrent edits on the same field and generates a SyncConflict record', async () => {
      // 1. User records a base snapshot timestamp
      const baseRevision = new Date(Date.now() - 60000).toISOString();

      // 2. Server patient was updated after baseRevision
      await db.updatePatientProfile(patient1Id, {
        full_name: 'Aarav Sharma (Server Updated)',
      });

      // 3. Client submits offline edit with baseRevision that touches full_name differently
      const clientOpId = crypto.randomUUID();
      const res = await request(app)
        .post(`/api/families/${family1Id}/sync/batch`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          operations: [
            {
              clientOperationId: clientOpId,
              idempotencyKey: `idem_${clientOpId}`,
              patientProfileId: patient1Id,
              operationType: 'PATIENT_UPDATE',
              payload: {
                patientId: patient1Id,
                updates: {
                  full_name: 'Aarav Sharma (Client Offline Edit)',
                },
              },
              baseRevision,
              clientTimestamp: new Date().toISOString(),
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.results[0].status).toBe('conflict');
      expect(res.body.results[0].conflict).toBeDefined();
      expect(res.body.results[0].conflict.entity_type).toBe('patient_profile');
      expect(res.body.results[0].conflict.resolution_status).toBe('pending');

      // Verify the patient record was preserved and NOT silently overwritten
      const currentPatient = await db.getPatientProfileById(patient1Id);
      expect(currentPatient?.full_name).toBe('Aarav Sharma (Server Updated)');
    });

    it('resolves an outstanding conflict using the client chosen version', async () => {
      // Get the pending conflict for family1
      const conflicts = await db.listSyncConflicts(family1Id, patient1Id, 'pending');
      expect(conflicts.length).toBeGreaterThan(0);
      const conflictId = conflicts[0]!.id;

      const res = await request(app)
        .post(`/api/families/${family1Id}/sync/conflicts/${conflictId}/resolve`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          resolution: 'resolved_client',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.conflict.resolution_status).toBe('resolved_client');

      // The patient profile now takes the local client value
      const patient = await db.getPatientProfileById(patient1Id);
      expect(patient?.full_name).toBe('Aarav Sharma (Client Offline Edit)');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Discrete Medication Dose Acknowledgement
  // ---------------------------------------------------------------------------
  describe('3. Discrete Medication Dose Acknowledgement', () => {
    it('records a dose acknowledgement without clobbering the medication schedule', async () => {
      const clientOpId = crypto.randomUUID();
      const scheduledTime = '2026-10-23T08:00:00.000Z';

      const res = await request(app)
        .post(`/api/families/${family1Id}/sync/batch`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          operations: [
            {
              clientOperationId: clientOpId,
              idempotencyKey: `idem_${clientOpId}`,
              patientProfileId: patient1Id,
              operationType: 'MEDICATION_DOSE_RECORD',
              payload: {
                scheduleId: schedule1Id,
                scheduledTime,
                status: 'taken',
                notes: 'Taken on time with milk',
                takenAt: '2026-10-23T08:05:00.000Z',
              },
              clientTimestamp: new Date().toISOString(),
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.results[0].status).toBe('synced');

      // Verify schedule remains active
      const sched = await db.getMedicationScheduleById(schedule1Id);
      expect(sched?.status).toBe('active');
      expect(sched?.medicine_name).toBe('Amoxicillin Oral Suspension');
    });

    it('rejects recording a dose for a discontinued medication schedule', async () => {
      // Discontinue schedule
      await db.updateMedicationSchedule(schedule1Id, { status: 'discontinued' });

      const clientOpId = crypto.randomUUID();
      const res = await request(app)
        .post(`/api/families/${family1Id}/sync/batch`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          operations: [
            {
              clientOperationId: clientOpId,
              idempotencyKey: `idem_${clientOpId}`,
              patientProfileId: patient1Id,
              operationType: 'MEDICATION_DOSE_RECORD',
              payload: {
                scheduleId: schedule1Id,
                scheduledTime: '2026-10-24T08:00:00.000Z',
                status: 'taken',
              },
              clientTimestamp: new Date().toISOString(),
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.results[0].status).toBe('failed');
      expect(res.body.results[0].errorCategory).toBe('conflict');
      expect(res.body.results[0].errorMessage).toContain('discontinued');

      // Re-activate for subsequent tests
      await db.updateMedicationSchedule(schedule1Id, { status: 'active' });
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Appointment Safeguards
  // ---------------------------------------------------------------------------
  describe('4. Appointment Safeguards', () => {
    it('prevents an offline edit from reviving or modifying a cancelled appointment', async () => {
      const clientOpId = crypto.randomUUID();

      const res = await request(app)
        .post(`/api/families/${family1Id}/sync/batch`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          operations: [
            {
              clientOperationId: clientOpId,
              idempotencyKey: `idem_${clientOpId}`,
              patientProfileId: patient1Id,
              operationType: 'APPOINTMENT_UPDATE',
              payload: {
                appointmentId: cancelledApptId,
                updates: {
                  notes: 'Attempting to revive old cancelled appointment',
                },
              },
              clientTimestamp: new Date().toISOString(),
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.results[0].status).toBe('failed');
      expect(res.body.results[0].errorCategory).toBe('conflict');
      expect(res.body.results[0].errorMessage).toContain('cancelled');

      // Verify the appointment remains cancelled on server
      const appt = await db.getAppointmentById(cancelledApptId);
      expect(appt?.status).toBe('cancelled');
    });

    it('updates an active appointment normally', async () => {
      const clientOpId = crypto.randomUUID();

      const res = await request(app)
        .post(`/api/families/${family1Id}/sync/batch`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          operations: [
            {
              clientOperationId: clientOpId,
              idempotencyKey: `idem_${clientOpId}`,
              patientProfileId: patient1Id,
              operationType: 'APPOINTMENT_UPDATE',
              payload: {
                appointmentId: appointment1Id,
                updates: {
                  notes: 'Bring vaccination chart and previous blood test reports',
                },
              },
              clientTimestamp: new Date().toISOString(),
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.results[0].status).toBe('synced');

      const updatedAppt = await db.getAppointmentById(appointment1Id);
      expect(updatedAppt?.notes).toBe('Bring vaccination chart and previous blood test reports');
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Server-Side Authorization & Revocation Safeguards
  // ---------------------------------------------------------------------------
  describe('5. Server-Side Authorization Revalidation', () => {
    it('rejects batch sync if user is not a member of the family workspace (HTTP 403)', async () => {
      const clientOpId = crypto.randomUUID();

      // User 2 tries to sync into Family 1
      const res = await request(app)
        .post(`/api/families/${family1Id}/sync/batch`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          operations: [
            {
              clientOperationId: clientOpId,
              idempotencyKey: `idem_${clientOpId}`,
              patientProfileId: patient1Id,
              operationType: 'PATIENT_UPDATE',
              payload: {
                patientId: patient1Id,
                updates: { fullName: 'Hacked Name' },
              },
              clientTimestamp: new Date().toISOString(),
            },
          ],
        });

      expect(res.status).toBe(403);
    });

    it('rejects sync operation targeting a patient from a different family workspace', async () => {
      const clientOpId = crypto.randomUUID();

      // User 1 tries to update Patient 2 (which belongs to Family 2) within Family 1's batch
      const res = await request(app)
        .post(`/api/families/${family1Id}/sync/batch`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          operations: [
            {
              clientOperationId: clientOpId,
              idempotencyKey: `idem_${clientOpId}`,
              patientProfileId: patient2Id,
              operationType: 'PATIENT_UPDATE',
              payload: {
                patientId: patient2Id,
                updates: { fullName: 'Malicious Name' },
              },
              clientTimestamp: new Date().toISOString(),
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.results[0].status).toBe('failed');
      expect(res.body.results[0].errorCategory).toBe('auth');
      expect(res.body.results[0].errorMessage).toContain('revoked');
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Delta Queries & Status
  // ---------------------------------------------------------------------------
  describe('6. Delta Change Retrieval & Sync Status', () => {
    it('retrieves authoritative delta changes since client timestamp', async () => {
      const pastTime = new Date(Date.now() - 3600000).toISOString();

      const res = await request(app)
        .get(`/api/families/${family1Id}/sync/delta?since=${encodeURIComponent(pastTime)}&patientProfileId=${patient1Id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.patients)).toBe(true);
      expect(Array.isArray(res.body.medications)).toBe(true);
      expect(Array.isArray(res.body.appointments)).toBe(true);
      expect(res.body.serverTimestamp).toBeDefined();
    });

    it('returns synchronization status overview for family workspace', async () => {
      const res = await request(app)
        .get(`/api/families/${family1Id}/sync/status`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.familyId).toBe(family1Id);
      expect(typeof res.body.pendingConflictsCount).toBe('number');
      expect(Array.isArray(res.body.recentOperations)).toBe(true);
    });
  });
});
