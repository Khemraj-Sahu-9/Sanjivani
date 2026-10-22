/**
 * backend/src/services/medicationService.ts
 *
 * Core service layer for Medication Management:
 * - Schedule creation and confirmation workflows
 * - Prescription-derived schedule prefilling with explicit confirmation requirement
 * - Idempotent dose occurrence generation
 * - Taken, skipped, missed, and unconfirmed dose tracking with correction audit trail
 * - Schedule change history and cancellation of obsolete reminders
 */

import { db } from '../repositories/database.js';
import { createError } from '../middlewares/errorHandler.js';
import {
  MedicationSchedule,
  MedicationDoseOccurrence,
  DoseOccurrenceStatus,
} from '../types/models.js';

export interface CreateScheduleInput {
  patientProfileId: string;
  sourceDocumentId?: string | null;
  sourceMedicineName?: string | null;
  medicineName: string;
  strength?: string | null;
  dosageInstruction: string;
  route?: string | null;
  frequency: string;
  scheduledTimes: string[];
  startDate: string;
  endDate?: string | null;
  prescriberName?: string | null;
  instructions?: string | null;
  isDraftPendingConfirmation?: boolean;
}

export interface PrefilledMedicineCandidate {
  medicineName: string;
  strength?: string;
  dosageInstruction: string;
  frequency: string;
  suggestedTimes: string[];
  doctorName?: string;
  instructions?: string;
  sourceDocumentId: string;
  sourceDocumentTitle: string;
  documentDate?: string | null;
  needsConfirmation: boolean;
}

export class MedicationService {
  /**
   * Creates a medication schedule.
   * If isDraftPendingConfirmation is true, creates a draft that requires explicit user confirmation.
   */
  async createSchedule(
    familyId: string,
    userId: string,
    input: CreateScheduleInput
  ): Promise<MedicationSchedule> {
    const patient = await db.getPatientProfileById(input.patientProfileId);
    if (!patient || patient.family_id !== familyId) {
      throw createError('Patient profile does not belong to this family workspace', 400);
    }

    if (input.sourceDocumentId) {
      const doc = await db.getDocumentById(input.sourceDocumentId);
      if (!doc || doc.family_id !== familyId || doc.patient_profile_id !== input.patientProfileId) {
        throw createError('Referenced source prescription not found for this patient', 400);
      }
    }

    const initialStatus = input.isDraftPendingConfirmation ? 'draft_pending_confirmation' : 'active';

    const schedule = await db.createMedicationSchedule({
      family_id: familyId,
      patient_profile_id: input.patientProfileId,
      source_document_id: input.sourceDocumentId || null,
      source_medicine_name: input.sourceMedicineName || null,
      medicine_name: input.medicineName,
      strength: input.strength || null,
      dosage_instruction: input.dosageInstruction,
      route: input.route || 'oral',
      frequency: input.frequency,
      scheduled_times: input.scheduledTimes,
      start_date: input.startDate,
      end_date: input.endDate || null,
      prescriber_name: input.prescriberName || null,
      instructions: input.instructions || null,
      status: initialStatus,
      created_by: userId,
      confirmed_by: initialStatus === 'active' ? userId : null,
      confirmed_at: initialStatus === 'active' ? new Date().toISOString() : null,
    });

    // Record schedule history
    await db.recordMedicationScheduleHistory({
      schedule_id: schedule.id,
      changed_by: userId,
      action: 'created',
      change_summary: initialStatus === 'active' ? 'Created and confirmed active schedule' : 'Created draft pending review confirmation',
      previous_data: null,
    });

    // If active, generate initial dose occurrences and enqueue reminder jobs
    if (schedule.status === 'active') {
      await this.generateDoseOccurrencesForSchedule(schedule, 7);
    }

    return schedule;
  }

  /**
   * Explicit confirmation step for prescription-derived schedules.
   */
  async confirmSchedule(
    familyId: string,
    userId: string,
    scheduleId: string,
    overrides?: Partial<CreateScheduleInput>
  ): Promise<MedicationSchedule> {
    const existing = await db.getMedicationScheduleById(scheduleId);
    if (!existing || existing.family_id !== familyId) {
      throw createError('Medication schedule not found in this family workspace.', 404);
    }

    const patch: Partial<MedicationSchedule> = {
      status: 'active',
      confirmed_by: userId,
      confirmed_at: new Date().toISOString(),
    };

    if (overrides) {
      if (overrides.medicineName) patch.medicine_name = overrides.medicineName;
      if (overrides.strength !== undefined) patch.strength = overrides.strength;
      if (overrides.dosageInstruction) patch.dosage_instruction = overrides.dosageInstruction;
      if (overrides.route !== undefined) patch.route = overrides.route;
      if (overrides.frequency) patch.frequency = overrides.frequency;
      if (overrides.scheduledTimes) patch.scheduled_times = overrides.scheduledTimes;
      if (overrides.startDate) patch.start_date = overrides.startDate;
      if (overrides.endDate !== undefined) patch.end_date = overrides.endDate;
      if (overrides.prescriberName !== undefined) patch.prescriber_name = overrides.prescriberName;
      if (overrides.instructions !== undefined) patch.instructions = overrides.instructions;
    }

    const updated = await db.updateMedicationSchedule(scheduleId, patch);

    await db.recordMedicationScheduleHistory({
      schedule_id: scheduleId,
      changed_by: userId,
      action: 'confirmed',
      change_summary: 'Confirmed and activated prescription schedule after human verification',
      previous_data: existing as unknown as Record<string, unknown>,
    });

    // Generate dose occurrences and reminder jobs for the newly activated schedule
    await this.generateDoseOccurrencesForSchedule(updated, 7);

    return updated;
  }

  /**
   * Updates an existing medication schedule.
   * If dates or times change, cancels future obsolete occurrences and recalculates.
   */
  async updateSchedule(
    familyId: string,
    userId: string,
    scheduleId: string,
    updates: Partial<CreateScheduleInput> & { status?: MedicationSchedule['status'] }
  ): Promise<MedicationSchedule> {
    const existing = await db.getMedicationScheduleById(scheduleId);
    if (!existing || existing.family_id !== familyId) {
      throw createError('Medication schedule not found in this family workspace.', 404);
    }

    const patch: Partial<MedicationSchedule> = {};
    if (updates.medicineName) patch.medicine_name = updates.medicineName;
    if (updates.strength !== undefined) patch.strength = updates.strength;
    if (updates.dosageInstruction) patch.dosage_instruction = updates.dosageInstruction;
    if (updates.route !== undefined) patch.route = updates.route;
    if (updates.frequency) patch.frequency = updates.frequency;
    if (updates.scheduledTimes) patch.scheduled_times = updates.scheduledTimes;
    if (updates.startDate) patch.start_date = updates.startDate;
    if (updates.endDate !== undefined) patch.end_date = updates.endDate;
    if (updates.prescriberName !== undefined) patch.prescriber_name = updates.prescriberName;
    if (updates.instructions !== undefined) patch.instructions = updates.instructions;
    if (updates.status) patch.status = updates.status;

    const updated = await db.updateMedicationSchedule(scheduleId, patch);

    const isEndingOrPausing = updates.status && ['paused', 'discontinued', 'completed'].includes(updates.status);
    const todayStr = new Date().toISOString().split('T')[0]!;

    if (isEndingOrPausing) {
      // Cancel future unacknowledged occurrences
      await db.cancelFutureDoseOccurrences(scheduleId, todayStr);
      await db.cancelScheduledJobsByReference(scheduleId);
    } else if (updated.status === 'active') {
      // Recalculate future occurrences
      await db.cancelFutureDoseOccurrences(scheduleId, todayStr);
      await this.generateDoseOccurrencesForSchedule(updated, 7);
    }

    await db.recordMedicationScheduleHistory({
      schedule_id: scheduleId,
      changed_by: userId,
      action: isEndingOrPausing ? (updates.status as any) : 'updated',
      change_summary: `Updated schedule parameters (${Object.keys(updates).join(', ')})`,
      previous_data: existing as unknown as Record<string, unknown>,
    });

    return updated;
  }

  /**
   * Retrieves a schedule with source document reference and change history.
   */
  async getScheduleDetails(familyId: string, scheduleId: string) {
    const schedule = await db.getMedicationScheduleById(scheduleId);
    if (!schedule || schedule.family_id !== familyId) {
      throw createError('Medication schedule not found.', 404);
    }

    const history = await db.getMedicationScheduleHistory(scheduleId);
    let sourceDoc = null;
    if (schedule.source_document_id) {
      sourceDoc = await db.getDocumentById(schedule.source_document_id);
    }

    return {
      schedule,
      history,
      sourceDocument: sourceDoc,
    };
  }

  /**
   * Lists medication schedules for a patient or all patients in family.
   */
  async listPatientSchedules(familyId: string, patientProfileId?: string, status?: string): Promise<MedicationSchedule[]> {
    if (patientProfileId) {
      const patient = await db.getPatientProfileById(patientProfileId);
      if (!patient || patient.family_id !== familyId) {
        throw createError('Patient profile not found in this family workspace', 404);
      }
      return db.listMedicationSchedulesByPatient(patientProfileId, status);
    }
    const patients = await db.getFamilyPatientProfiles(familyId);
    let allSchedules: MedicationSchedule[] = [];
    for (const p of patients) {
      const s = await db.listMedicationSchedulesByPatient(p.id, status);
      allSchedules = allSchedules.concat(s);
    }
    return allSchedules;
  }

  async getScheduleHistory(familyId: string, scheduleId: string) {
    const schedule = await db.getMedicationScheduleById(scheduleId);
    if (!schedule || schedule.family_id !== familyId) {
      throw createError('Medication schedule not found', 404);
    }
    return db.getMedicationScheduleHistory(scheduleId);
  }

  async generateDosesForPatient(familyId: string, patientProfileId: string, daysAhead = 7): Promise<number> {
    const patient = await db.getPatientProfileById(patientProfileId);
    if (!patient || patient.family_id !== familyId) {
      throw createError('Patient profile not found in this family workspace', 400);
    }
    const schedules = await db.listMedicationSchedulesByPatient(patientProfileId, 'active');
    let total = 0;
    for (const s of schedules) {
      const count = await this.generateDoseOccurrencesForSchedule(s, daysAhead);
      total += count;
    }
    return total;
  }

  /**
   * Records dose status (taken, skipped, missed, unconfirmed).
   */
  async recordDoseStatus(
    familyId: string,
    userId: string,
    doseOccurrenceId: string,
    status: DoseOccurrenceStatus,
    note?: string
  ): Promise<MedicationDoseOccurrence> {
    const occ = await db.getDoseOccurrenceById(doseOccurrenceId);
    if (!occ || occ.family_id !== familyId) {
      throw createError('Dose occurrence not found in this family workspace.', 404);
    }

    return db.updateDoseOccurrenceStatus(doseOccurrenceId, status, userId, note);
  }

  /**
   * Lists dose occurrences for a date range (e.g., today's doses).
   */
  async listDoseOccurrences(
    familyId: string,
    patientProfileId: string,
    startDate: string,
    endDate: string
  ): Promise<MedicationDoseOccurrence[]> {
    const patient = await db.getPatientProfileById(patientProfileId);
    if (!patient || patient.family_id !== familyId) {
      throw createError('Patient profile not found in this family workspace.', 404);
    }

    // Auto-generate missing dose occurrences for active schedules
    const activeSchedules = await db.listMedicationSchedulesByPatient(patientProfileId, 'active');
    for (const s of activeSchedules) {
      await this.generateDoseOccurrencesForSchedule(s, 3);
    }

    return db.listDoseOccurrences(patientProfileId, startDate, endDate);
  }

  /**
   * Prefills candidate medicines from a confirmed OCR prescription report.
   */
  async prefillFromPrescription(
    familyId: string,
    patientProfileId: string,
    documentId: string
  ): Promise<PrefilledMedicineCandidate[]> {
    const doc = await db.getDocumentById(documentId);
    if (!doc || doc.family_id !== familyId || doc.patient_profile_id !== patientProfileId) {
      throw createError('Prescription document not found for this patient.', 404);
    }

    const extraction = await db.getExtractionByDocumentId(documentId);
    const fields = (
      extraction?.confirmed_fields && Object.keys(extraction.confirmed_fields).length > 0
        ? extraction.confirmed_fields
        : extraction?.proposed_fields
    ) as Record<string, any> | undefined;
    const medicines: any[] = Array.isArray(fields?.prescription_medicines)
      ? fields!.prescription_medicines
      : Array.isArray(fields?.medicines)
      ? fields!.medicines
      : [];

    const candidates: PrefilledMedicineCandidate[] = [];

    for (const m of medicines) {
      if (!m.name) continue;

      let freq = 'once_daily';
      let suggestedTimes = ['08:00'];

      const rawFreq = (m.frequency || m.dosage || '').toLowerCase();
      if (/1-0-1|twice|bid|2\s*times|every\s*12/i.test(rawFreq)) {
        freq = 'twice_daily';
        suggestedTimes = ['08:00', '20:00'];
      } else if (/1-1-1|thrice|tid|3\s*times/i.test(rawFreq)) {
        freq = 'thrice_daily';
        suggestedTimes = ['08:00', '14:00', '20:00'];
      } else if (/prn|as\s*needed|sos/i.test(rawFreq)) {
        freq = 'as_needed';
        suggestedTimes = ['08:00'];
      }

      candidates.push({
        medicineName: m.name,
        strength: m.strength || undefined,
        dosageInstruction: m.instructions || m.dosage || 'Take as prescribed',
        frequency: freq,
        suggestedTimes,
        doctorName: fields?.doctor_name || undefined,
        instructions: m.instructions || undefined,
        sourceDocumentId: doc.id,
        sourceDocumentTitle: doc.title,
        documentDate: doc.document_date,
        needsConfirmation: true,
      });
    }

    return candidates;
  }

  /**
   * Generates idempotent dose occurrences for a schedule.
   */
  private async generateDoseOccurrencesForSchedule(
    schedule: MedicationSchedule,
    daysAhead = 7
  ): Promise<number> {
    if (schedule.status !== 'active') return 0;

    const occurrencesToCreate: Array<Omit<MedicationDoseOccurrence, 'id' | 'created_at' | 'updated_at'>> = [];
    const today = new Date();

    for (let i = 0; i < daysAhead; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + i);
      const dateStr = targetDate.toISOString().split('T')[0]!;

      // Check date bounds
      if (dateStr < schedule.start_date) continue;
      if (schedule.end_date && dateStr > schedule.end_date) continue;

      for (const timeStr of schedule.scheduled_times) {
        const scheduledDatetime = `${dateStr}T${timeStr}:00.000Z`;

        occurrencesToCreate.push({
          schedule_id: schedule.id,
          patient_profile_id: schedule.patient_profile_id,
          family_id: schedule.family_id,
          scheduled_date: dateStr,
          scheduled_time: timeStr,
          scheduled_datetime: scheduledDatetime,
          status: 'scheduled',
          dose_instruction: `${schedule.medicine_name} ${schedule.strength || ''} - ${schedule.dosage_instruction}`.trim(),
        });
      }
    }

    const createdOccurrences = await db.createDoseOccurrences(occurrencesToCreate);

    // Enqueue server-side scheduled reminder jobs for newly created occurrences
    for (const occ of createdOccurrences) {
      if (occ.status === 'scheduled') {
        await db.enqueueScheduledJob({
          job_type: 'dose_reminder',
          reference_id: occ.id,
          scheduled_at: occ.scheduled_datetime,
          status: 'pending',
          retry_count: 0,
          max_retries: 3,
          payload: {
            doseOccurrenceId: occ.id,
            scheduleId: occ.schedule_id,
            patientProfileId: occ.patient_profile_id,
            familyId: occ.family_id,
          },
        });
      }
    }

    return createdOccurrences.length;
  }
}

export const medicationService = new MedicationService();
