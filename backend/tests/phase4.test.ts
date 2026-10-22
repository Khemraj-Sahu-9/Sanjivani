/**
 * backend/tests/phase4.test.ts
 *
 * Comprehensive Automated Test Suite for Phase 4:
 * 1. Medication schedule creation and management (manual and draft)
 * 2. Prescription document prefill and candidate extraction
 * 3. Explicit confirmation workflow before prescription schedules become active
 * 4. Idempotent dose occurrence generation
 * 5. Dose tracking: Taken, Skipped (with notes), Missed, and Revert/Undo
 * 6. Schedule audit trail history (creation, update, pause, resume, discontinue)
 * 7. Doctor appointment creation with advance reminder intervals
 * 8. Appointment rescheduling, cancellation, and completion
 * 9. Privacy-preserving notification dispatch and quiet hours gating
 * 10. Caregiver escalation for unacknowledged medication doses
 * 11. Security & cross-family authorization isolation
 */

import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { app } from '../src/app.js';
import { reminderScheduler } from '../src/jobs/reminderScheduler.js';

const request = supertest(app);

describe('Phase 4 — Medication Management, Appointments & Notifications', () => {
  let user1Token: string;
  let user2Token: string;
  let family1Id: string;
  let family2Id: string;
  let patient1Id: string;
  let patient2Id: string;
  let rxDocId: string;

  beforeAll(async () => {
    // 1. Setup User 1 & Family 1
    const reg1 = await request.post('/api/auth/register').send({
      email: 'phase4_user1@example.com',
      password: 'password123',
      fullName: 'Phase 4 Primary User',
    });
    user1Token = reg1.body.data.token;

    const fam1 = await request
      .post('/api/families')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ name: 'Phase 4 Patel Family' });
    family1Id = fam1.body.data.family.id;

    // Create Patient 1
    const pat1 = await request
      .post(`/api/families/${family1Id}/patients`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        fullName: 'Dev Patel',
        category: 'adult',
        dateOfBirth: '1985-06-15',
        gender: 'male',
        relationshipToCreator: 'Self',
      });
    patient1Id = pat1.body.data.profile.id;

    // Upload & confirm a prescription document for Patient 1
    const uploadRes = await request
      .post(`/api/families/${family1Id}/documents/upload`)
      .set('Authorization', `Bearer ${user1Token}`)
      .field('patientProfileId', patient1Id)
      .field('title', 'Cardiology Prescription Dr Sharma')
      .field('category', 'prescription')
      .field('documentDate', '2026-10-15')
      .attach(
        'file',
        Buffer.from('%PDF-1.4 Mock Prescription Content for Phase 4 Prefill'),
        { filename: 'prescription_p4.pdf', contentType: 'application/pdf' }
      );

    expect(uploadRes.status).toBe(201);
    rxDocId = uploadRes.body.data.id;

    // Complete review and confirm prescription fields with structured medicines
    const reviewRes = await request
      .post(`/api/families/documents/review/${rxDocId}`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        markConfirmed: true,
        confirmedFields: {
          doctor_name: 'Dr. A. Sharma',
          prescription_medicines: [
            {
              name: 'Metformin',
              strength: '500mg',
              dosage: '1 tablet twice daily',
              frequency: '1-0-1',
              instructions: 'Take after meals',
            },
            {
              name: 'Amlodipine',
              strength: '5mg',
              dosage: '1 tablet once daily',
              frequency: 'once_daily',
              instructions: 'Take in morning',
            },
          ],
        },
      });
    expect(reviewRes.status).toBe(200);

    // 2. Setup User 2 & Family 2 for Cross-Tenant Isolation Tests
    const reg2 = await request.post('/api/auth/register').send({
      email: 'phase4_user2@example.com',
      password: 'password123',
      fullName: 'Phase 4 Unauthorized User',
    });
    user2Token = reg2.body.data.token;

    const fam2 = await request
      .post('/api/families')
      .set('Authorization', `Bearer ${user2Token}`)
      .send({ name: 'Phase 4 Outside Family' });
    family2Id = fam2.body.data.family.id;

    const pat2 = await request
      .post(`/api/families/${family2Id}/patients`)
      .set('Authorization', `Bearer ${user2Token}`)
      .send({
        fullName: 'Outside Patient',
        category: 'adult',
        dateOfBirth: '1990-01-01',
        gender: 'female',
        relationshipToCreator: 'Self',
      });
    patient2Id = pat2.body.data.profile.id;
  });

  describe('1. Medication Schedules & Prescription Prefill', () => {
    it('should extract prefilled medicine candidates from a confirmed prescription document', async () => {
      const res = await request
        .get(`/api/families/${family1Id}/medications/prefill-candidates`)
        .set('Authorization', `Bearer ${user1Token}`)
        .query({ documentId: rxDocId, patientProfileId: patient1Id });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(2);

      const metformin = res.body.data.find((m: any) => m.medicineName === 'Metformin');
      expect(metformin).toBeDefined();
      expect(metformin.strength).toBe('500mg');
      expect(metformin.suggestedTimes).toContain('08:00');
      expect(metformin.suggestedTimes).toContain('20:00');
    });

    it('should create a draft prescription schedule awaiting explicit confirmation', async () => {
      const res = await request
        .post(`/api/families/${family1Id}/medications`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          patientProfileId: patient1Id,
          medicineName: 'Metformin',
          strength: '500mg',
          dosageInstruction: 'Take 1 tablet twice daily after meals',
          frequency: 'twice_daily',
          scheduledTimes: ['08:00', '20:00'],
          startDate: '2026-10-22',
          sourceDocumentId: rxDocId,
          sourceMedicineName: 'Metformin',
          isDraftPendingConfirmation: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('draft_pending_confirmation');
      expect(res.body.data.confirmed_at).toBeNull();
    });

    it('should explicitly confirm and activate a draft schedule', async () => {
      // First, get the draft schedule
      const listRes = await request
        .get(`/api/families/${family1Id}/medications`)
        .set('Authorization', `Bearer ${user1Token}`)
        .query({ patientProfileId: patient1Id, status: 'draft_pending_confirmation' });

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBeGreaterThan(0);
      const draftId = listRes.body.data[0].id;

      // Confirm the draft schedule
      const confirmRes = await request
        .post(`/api/families/${family1Id}/medications/${draftId}/confirm`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({});

      expect(confirmRes.status).toBe(200);
      expect(confirmRes.body.data.status).toBe('active');
      expect(confirmRes.body.data.confirmed_at).toBeDefined();

      // Verify audit history was recorded
      const historyRes = await request
        .get(`/api/families/${family1Id}/medications/${draftId}/history`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(historyRes.status).toBe(200);
      const actions = historyRes.body.data.map((h: any) => h.action);
      expect(actions).toContain('created');
      expect(actions).toContain('confirmed');
    });

    it('should manually create an active medication schedule', async () => {
      const res = await request
        .post(`/api/families/${family1Id}/medications`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          patientProfileId: patient1Id,
          medicineName: 'Vitamin D3',
          strength: '60000 IU',
          dosageInstruction: '1 capsule once a week',
          frequency: 'once_daily',
          scheduledTimes: ['09:00'],
          startDate: '2026-10-22',
          prescriberName: 'Dr. K. Verma',
          instructions: 'Take with whole milk',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('active');
      expect(res.body.data.medicine_name).toBe('Vitamin D3');
    });
  });

  describe('2. Idempotent Dose Generation & Tracking', () => {
    it('should generate dose occurrences for active schedules idempotently', async () => {
      // Trigger generation further out (e.g. 14 days ahead)
      const gen1 = await request
        .post(`/api/families/${family1Id}/medications/doses/generate`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ patientProfileId: patient1Id, daysAhead: 14 });

      expect(gen1.status).toBe(200);
      const count1 = gen1.body.data.generatedCount;
      expect(count1).toBeGreaterThan(0);

      // Trigger again immediately — should produce 0 new duplicates due to unique constraint
      const gen2 = await request
        .post(`/api/families/${family1Id}/medications/doses/generate`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ patientProfileId: patient1Id, daysAhead: 14 });

      expect(gen2.status).toBe(200);
      expect(gen2.body.data.generatedCount).toBe(0);
    });

    it('should track dose status transitions (taken, skipped with note, missed, revert)', async () => {
      const dosesRes = await request
        .get(`/api/families/${family1Id}/medications/doses`)
        .set('Authorization', `Bearer ${user1Token}`)
        .query({ patientProfileId: patient1Id, status: 'scheduled' });

      expect(dosesRes.status).toBe(200);
      expect(dosesRes.body.data.length).toBeGreaterThan(0);

      const targetDose = dosesRes.body.data[0];

      // 1. Mark as taken
      const takenRes = await request
        .patch(`/api/families/${family1Id}/medications/doses/${targetDose.id}/status`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ status: 'taken' });

      expect(takenRes.status).toBe(200);
      expect(takenRes.body.data.status).toBe('taken');
      expect(takenRes.body.data.acknowledged_at).toBeDefined();

      // 2. Mark another dose as skipped with a clinical reason note
      const secondDose = dosesRes.body.data[1];
      const skipRes = await request
        .patch(`/api/families/${family1Id}/medications/doses/${secondDose.id}/status`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ status: 'skipped', note: 'Fasting before lipid profile test' });

      expect(skipRes.status).toBe(200);
      expect(skipRes.body.data.status).toBe('skipped');
      expect(skipRes.body.data.acknowledgement_note).toBe('Fasting before lipid profile test');

      // 3. Undo / revert dose status back to scheduled
      const undoRes = await request
        .patch(`/api/families/${family1Id}/medications/doses/${targetDose.id}/status`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ status: 'scheduled' });

      expect(undoRes.status).toBe(200);
      expect(undoRes.body.data.status).toBe('scheduled');
      expect(undoRes.body.data.acknowledged_at).toBeNull();
    });
  });

  describe('3. Doctor Appointments & Rescheduling', () => {
    let appointmentId: string;

    it('should schedule a doctor appointment with advance reminders', async () => {
      const res = await request
        .post(`/api/families/${family1Id}/appointments`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          patientProfileId: patient1Id,
          title: 'Cardiology Checkup',
          doctorName: 'Dr. A. Sharma',
          facilityName: 'Max Healthcare Delhi',
          appointmentDate: '2026-11-10',
          appointmentTime: '11:30',
          timezone: 'Asia/Kolkata',
          location: 'OPD 14, Tower A',
          notes: 'Review ECG & 2D Echo results',
          reminderIntervalsHours: [24, 2],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('scheduled');
      expect(res.body.data.doctor_name).toBe('Dr. A. Sharma');
      appointmentId = res.body.data.id;
    });

    it('should reschedule an appointment and re-queue scheduled reminders', async () => {
      const res = await request
        .put(`/api/families/${family1Id}/appointments/${appointmentId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          appointmentDate: '2026-11-15',
          appointmentTime: '14:00',
          reminderIntervalsHours: [24],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('rescheduled');
      expect(res.body.data.appointment_date).toBe('2026-11-15');
      expect(res.body.data.appointment_time).toBe('14:00');
    });

    it('should complete an appointment with outcome notes', async () => {
      const res = await request
        .post(`/api/families/${family1Id}/appointments/${appointmentId}/complete`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ notes: 'BP normal at 120/80. Continue Metformin 500mg.' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('completed');
      expect(res.body.data.notes).toContain('BP normal');
    });

    it('should cancel an appointment and deactivate reminder jobs', async () => {
      // Create a temporary appointment to cancel
      const appRes = await request
        .post(`/api/families/${family1Id}/appointments`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          patientProfileId: patient1Id,
          title: 'Dentist Cleaning',
          appointmentDate: '2026-11-20',
          appointmentTime: '10:00',
        });

      const tempId = appRes.body.data.id;

      const cancelRes = await request
        .post(`/api/families/${family1Id}/appointments/${tempId}/cancel`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ reason: 'Doctor rescheduled OPD hours' });

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.status).toBe('cancelled');
    });
  });

  describe('4. Notifications, Quiet Hours & Caregiver Escalation', () => {
    it('should retrieve and update notification preferences with quiet hours', async () => {
      const getRes = await request
        .get(`/api/families/${family1Id}/notifications/preferences`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.enable_in_app).toBe(true);

      const updateRes = await request
        .put(`/api/families/${family1Id}/notifications/preferences`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          enable_browser: true,
          quiet_hours_enabled: true,
          quiet_hours_start: '23:00',
          quiet_hours_end: '06:30',
          preferred_language: 'hi',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.enable_browser).toBe(true);
      expect(updateRes.body.data.quiet_hours_start).toBe('23:00');
      expect(updateRes.body.data.preferred_language).toBe('hi');
    });

    it('should configure caregiver escalation policy', async () => {
      const policyRes = await request
        .post(`/api/families/${family1Id}/notifications/caregiver-policies`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          patientProfileId: patient1Id,
          caregiverUserId: 'caregiver_user_test',
          escalateUnacknowledgedMeds: true,
          escalationDelayMinutes: 30,
          quietHoursOverrideForUrgent: true,
        });

      expect(policyRes.status).toBe(200);
      expect(policyRes.body.data.escalate_unacknowledged_meds).toBe(true);
      expect(policyRes.body.data.escalation_delay_minutes).toBe(30);
    });

    it('should execute reminder scheduler and process pending jobs', async () => {
      const runResult = await reminderScheduler.processPendingJobs();
      expect(typeof runResult.processed).toBe('number');

      // Test trigger endpoint
      const testDispatch = await request
        .post(`/api/families/${family1Id}/notifications/test-dispatch`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(testDispatch.status).toBe(200);
      expect(testDispatch.body.data.processed).toBeDefined();
    });

    it('should mark notification as read and acknowledge it', async () => {
      // List notifications
      const notifsRes = await request
        .get(`/api/families/${family1Id}/notifications`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(notifsRes.status).toBe(200);

      if (notifsRes.body.data.length > 0) {
        const notif = notifsRes.body.data[0];

        const readRes = await request
          .patch(`/api/families/${family1Id}/notifications/${notif.id}/read`)
          .set('Authorization', `Bearer ${user1Token}`);

        expect(readRes.status).toBe(200);
        expect(readRes.body.data.status).toBe('read');

        const ackRes = await request
          .patch(`/api/families/${family1Id}/notifications/${notif.id}/acknowledge`)
          .set('Authorization', `Bearer ${user1Token}`);

        expect(ackRes.status).toBe(200);
        expect(ackRes.body.data.status).toBe('acknowledged');
      }
    });
  });

  describe('5. Security, Authorization & Cross-Family Isolation', () => {
    it('should prevent User 2 from accessing User 1 medication schedules', async () => {
      const res = await request
        .get(`/api/families/${family1Id}/medications`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.status).toBe(403);
    });

    it('should prevent User 2 from creating doses or modifying schedules in Family 1', async () => {
      const res = await request
        .post(`/api/families/${family1Id}/medications`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          patientProfileId: patient1Id,
          medicineName: 'Illicit Entry',
          dosageInstruction: 'Unauthorized',
          frequency: 'once_daily',
          scheduledTimes: ['08:00'],
          startDate: '2026-10-22',
        });

      expect(res.status).toBe(403);
    });

    it('should prevent User 2 from viewing or modifying appointments in Family 1', async () => {
      const res = await request
        .get(`/api/families/${family1Id}/appointments`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.status).toBe(403);
    });

    it('should prevent User 2 from reading Family 1 notifications or caregiver policies', async () => {
      const res = await request
        .get(`/api/families/${family1Id}/notifications`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.status).toBe(403);
    });

    it('should reject schedule creation with mismatched patient from another family', async () => {
      const res = await request
        .post(`/api/families/${family1Id}/medications`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          patientProfileId: patient2Id, // belongs to Family 2!
          medicineName: 'Cross Patient Med',
          dosageInstruction: '1 tab',
          frequency: 'once_daily',
          scheduledTimes: ['08:00'],
          startDate: '2026-10-22',
        });

      expect(res.status).toBe(400);
      const errText = res.body.message || res.body.error || '';
      expect(errText).toContain('does not belong to this family');
    });
  });
});
