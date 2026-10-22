/**
 * backend/src/services/appointmentService.ts
 *
 * Core service layer for Doctor & Clinic Appointment Management:
 * - Appointment creation, updates, rescheduling, completion, and cancellation
 * - Automated server-side reminder scheduling with configurable intervals
 * - Obsolete reminder cancellation on rescheduling or cancellation
 */

import { db } from '../repositories/database.js';
import { createError } from '../middlewares/errorHandler.js';
import { Appointment } from '../types/models.js';

export interface CreateAppointmentInput {
  patientProfileId: string;
  title: string;
  doctorName?: string | null;
  facilityName?: string | null;
  appointmentDate: string;
  appointmentTime?: string | null;
  timezone?: string;
  location?: string | null;
  notes?: string | null;
  sourceDocumentId?: string | null;
  reminderHoursBefore?: number[];
}

export class AppointmentService {
  /**
   * Creates an appointment and schedules reminders.
   */
  async createAppointment(
    familyId: string,
    userId: string,
    input: CreateAppointmentInput
  ): Promise<Appointment> {
    const patient = await db.getPatientProfileById(input.patientProfileId);
    if (!patient || patient.family_id !== familyId) {
      throw createError('Patient profile not found in this family workspace.', 404);
    }

    const apptDatetime = input.appointmentTime
      ? `${input.appointmentDate}T${input.appointmentTime}:00.000Z`
      : `${input.appointmentDate}T09:00:00.000Z`;

    const appt = await db.createAppointment({
      family_id: familyId,
      patient_profile_id: input.patientProfileId,
      title: input.title,
      doctor_name: input.doctorName || null,
      facility_name: input.facilityName || null,
      appointment_date: input.appointmentDate,
      appointment_time: input.appointmentTime || null,
      appointment_datetime: apptDatetime,
      timezone: input.timezone || 'Asia/Kolkata',
      location: input.location || null,
      notes: input.notes || null,
      source_document_id: input.sourceDocumentId || null,
      status: 'scheduled',
      created_by: userId,
    });

    // Schedule reminder jobs (e.g. 24 hours and 2 hours before)
    const reminderHours = input.reminderHoursBefore || [24, 2];
    await this.scheduleAppointmentReminders(appt, reminderHours);

    return appt;
  }

  /**
   * Updates an appointment.
   * If appointment date/time changes, cancels previous reminders and re-schedules.
   */
  async updateAppointment(
    familyId: string,
    appointmentId: string,
    updates: Partial<CreateAppointmentInput> & { status?: Appointment['status'] }
  ): Promise<Appointment> {
    const existing = await db.getAppointmentById(appointmentId);
    if (!existing || existing.family_id !== familyId) {
      throw createError('Appointment not found in this family workspace.', 404);
    }

    const patch: Partial<Appointment> = {};
    if (updates.title) patch.title = updates.title;
    if (updates.doctorName !== undefined) patch.doctor_name = updates.doctorName;
    if (updates.facilityName !== undefined) patch.facility_name = updates.facilityName;
    if (updates.appointmentDate) patch.appointment_date = updates.appointmentDate;
    if (updates.appointmentTime !== undefined) patch.appointment_time = updates.appointmentTime;
    if (updates.timezone) patch.timezone = updates.timezone;
    if (updates.location !== undefined) patch.location = updates.location;
    if (updates.notes !== undefined) patch.notes = updates.notes;
    if (updates.status) patch.status = updates.status;

    if (updates.appointmentDate || updates.appointmentTime) {
      const date = updates.appointmentDate || existing.appointment_date;
      const time = updates.appointmentTime !== undefined ? updates.appointmentTime : existing.appointment_time;
      patch.appointment_datetime = time ? `${date}T${time}:00.000Z` : `${date}T09:00:00.000Z`;
      if (!updates.status) {
        patch.status = 'rescheduled';
      }
    }

    const updated = await db.updateAppointment(appointmentId, patch);

    // If cancelled, completed, or rescheduled, cancel previous pending reminder jobs
    await db.cancelScheduledJobsByReference(appointmentId);

    // If still scheduled or rescheduled, schedule new reminders
    if (updated.status === 'scheduled' || updated.status === 'rescheduled') {
      const reminderHours = updates.reminderHoursBefore || [24, 2];
      await this.scheduleAppointmentReminders(updated, reminderHours);
    }

    return updated;
  }

  /**
   * Cancels an appointment.
   */
  async cancelAppointment(familyId: string, appointmentId: string, reason?: string): Promise<Appointment> {
    return this.updateAppointment(familyId, appointmentId, {
      status: 'cancelled',
      notes: reason ? `Cancelled: ${reason}` : undefined,
    });
  }

  /**
   * Marks an appointment as completed.
   */
  async completeAppointment(familyId: string, appointmentId: string, notes?: string): Promise<Appointment> {
    return this.updateAppointment(familyId, appointmentId, {
      status: 'completed',
      notes: notes || undefined,
    });
  }

  /**
   * Lists appointments for a patient or all patients in family.
   */
  async listAppointments(familyId: string, patientProfileId?: string, status?: string): Promise<Appointment[]> {
    if (patientProfileId) {
      const patient = await db.getPatientProfileById(patientProfileId);
      if (!patient || patient.family_id !== familyId) {
        throw createError('Patient profile not found in this family workspace.', 404);
      }
      return db.listAppointmentsByPatient(patientProfileId, status);
    }
    const patients = await db.getFamilyPatientProfiles(familyId);
    let all: Appointment[] = [];
    for (const p of patients) {
      const appts = await db.listAppointmentsByPatient(p.id, status);
      all = all.concat(appts);
    }
    return all;
  }

  /**
   * Schedules reminder jobs before the appointment datetime.
   */
  private async scheduleAppointmentReminders(appt: Appointment, hoursBeforeList: number[]): Promise<void> {
    if (!appt.appointment_datetime) return;
    const apptTimeMs = new Date(appt.appointment_datetime).getTime();

    for (const h of hoursBeforeList) {
      const reminderTimeMs = apptTimeMs - h * 60 * 60 * 1000;
      if (reminderTimeMs > Date.now()) {
        await db.enqueueScheduledJob({
          job_type: 'appointment_reminder',
          reference_id: appt.id,
          scheduled_at: new Date(reminderTimeMs).toISOString(),
          status: 'pending',
          retry_count: 0,
          max_retries: 3,
          payload: {
            appointmentId: appt.id,
            patientProfileId: appt.patient_profile_id,
            familyId: appt.family_id,
            hoursBefore: h,
          },
        });
      }
    }
  }
}

export const appointmentService = new AppointmentService();
