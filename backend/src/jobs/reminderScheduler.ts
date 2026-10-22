/**
 * backend/src/jobs/reminderScheduler.ts
 *
 * Server-controlled scheduled reminder processor:
 * - Processes due background jobs from durable database queue
 * - Dispatches medication dose reminders
 * - Escalates unconfirmed doses to designated caregivers
 * - Dispatches doctor appointment reminders
 * - Applies retry policy for transient failures and cancels obsolete work
 */

import { db } from '../repositories/database.js';
import { notificationService } from '../services/notificationService.js';
import { sosService } from '../services/sosService.js';
import { logger } from '../config/logger.js';

export class ReminderScheduler {
  /**
   * Processes all due scheduled jobs up to now (alias for compatibility).
   */
  async processPendingJobs(): Promise<{ processed: number; processedCount: number; failedCount: number }> {
    const res = await this.processDueJobs();
    return { processed: res.processedCount, ...res };
  }

  /**
   * Processes all due scheduled jobs up to now.
   */
  async processDueJobs(): Promise<{ processedCount: number; failedCount: number }> {
    const nowIso = new Date().toISOString();
    const dueJobs = await db.fetchDueScheduledJobs(nowIso, 50);

    let processedCount = 0;
    let failedCount = 0;

    for (const job of dueJobs) {
      try {
        await db.updateScheduledJob(job.id, { status: 'processing' });

        if (job.job_type === 'dose_reminder') {
          await this.processDoseReminder(job.payload as any);
        } else if (job.job_type === 'caregiver_escalation') {
          await this.processCaregiverEscalation(job.payload as any);
        } else if (job.job_type === 'appointment_reminder') {
          await this.processAppointmentReminder(job.payload as any);
        } else if (job.job_type === 'sos_family_timeout') {
          await sosService.handleFamilyTimeout(job.payload as any);
        } else if (job.job_type === 'sos_caregiver_timeout') {
          await sosService.handleCaregiverTimeout(job.payload as any);
        }

        await db.updateScheduledJob(job.id, { status: 'completed' });
        processedCount++;
      } catch (err: any) {
        failedCount++;
        const newRetryCount = job.retry_count + 1;
        const isPermanent = newRetryCount >= job.max_retries;

        logger.error(`[Scheduler] Job ${job.id} (${job.job_type}) failed: ${err.message}`);

        await db.updateScheduledJob(job.id, {
          status: isPermanent ? 'failed' : 'pending',
          retry_count: newRetryCount,
          last_error: err.message || 'Unknown execution error',
        });
      }
    }

    return { processedCount, failedCount };
  }

  private async processDoseReminder(payload: {
    doseOccurrenceId: string;
    scheduleId: string;
    patientProfileId: string;
    familyId: string;
  }): Promise<void> {
    const occ = await db.getDoseOccurrenceById(payload.doseOccurrenceId);
    if (!occ || occ.status !== 'scheduled') {
      // Dose already acknowledged, skipped, or cancelled — no reminder needed
      return;
    }

    const patient = await db.getPatientProfileById(payload.patientProfileId);
    const patientName = patient?.full_name || 'Family Member';

    // Find family members who should receive this reminder (e.g. family owner or patient creator)
    const members = await db.getFamilyMemberships(payload.familyId);
    const recipient = members[0]?.user_id;

    if (recipient) {
      await notificationService.sendNotification({
        familyId: payload.familyId,
        patientProfileId: payload.patientProfileId,
        recipientUserId: recipient,
        category: 'medication_reminder',
        title: 'Medication Reminder',
        message: `It is time for ${patientName}'s scheduled dose: ${occ.dose_instruction}`,
        detailsPayload: {
          doseOccurrenceId: occ.id,
          scheduleId: occ.schedule_id,
          patientProfileId: occ.patient_profile_id,
          scheduledTime: occ.scheduled_time,
        },
      });

      // Update occurrence reminder timestamp
      await db.updateDoseOccurrenceStatus(occ.id, occ.status);
    }

    // Schedule caregiver escalation job after grace period (e.g. 30 minutes)
    const escalationTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    await db.enqueueScheduledJob({
      job_type: 'caregiver_escalation',
      reference_id: occ.id,
      scheduled_at: escalationTime,
      status: 'pending',
      retry_count: 0,
      max_retries: 3,
      payload: {
        doseOccurrenceId: occ.id,
        patientProfileId: occ.patient_profile_id,
        familyId: occ.family_id,
      },
    });
  }

  private async processCaregiverEscalation(payload: {
    doseOccurrenceId: string;
    patientProfileId: string;
    familyId: string;
  }): Promise<void> {
    const occ = await db.getDoseOccurrenceById(payload.doseOccurrenceId);
    if (!occ || occ.status !== 'scheduled') {
      // Dose already acknowledged or taken — no escalation needed
      return;
    }

    const patient = await db.getPatientProfileById(payload.patientProfileId);
    const patientName = patient?.full_name || 'Family Member';

    await notificationService.escalateToCaregivers(occ, patientName);
  }

  private async processAppointmentReminder(payload: {
    appointmentId: string;
    patientProfileId: string;
    familyId: string;
    hoursBefore: number;
  }): Promise<void> {
    const appt = await db.getAppointmentById(payload.appointmentId);
    if (!appt || appt.status !== 'scheduled') {
      // Appointment cancelled or completed
      return;
    }

    const patient = await db.getPatientProfileById(payload.patientProfileId);
    const patientName = patient?.full_name || 'Family Member';
    const members = await db.getFamilyMemberships(payload.familyId);
    const recipient = members[0]?.user_id;

    if (recipient) {
      const timeNote = appt.appointment_time ? ` at ${appt.appointment_time}` : '';
      await notificationService.sendNotification({
        familyId: payload.familyId,
        patientProfileId: payload.patientProfileId,
        recipientUserId: recipient,
        category: 'appointment_reminder',
        title: 'Upcoming Appointment Reminder',
        message: `Reminder: ${patientName} has an appointment with ${appt.doctor_name || appt.title} on ${appt.appointment_date}${timeNote}.`,
        detailsPayload: {
          appointmentId: appt.id,
          patientProfileId: appt.patient_profile_id,
          appointmentDate: appt.appointment_date,
        },
      });
    }
  }
}

export const reminderScheduler = new ReminderScheduler();
