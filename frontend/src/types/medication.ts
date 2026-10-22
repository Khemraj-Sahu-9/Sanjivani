/**
 * frontend/src/types/medication.ts
 *
 * Types for Medication Management: schedules, doses, prescription prefill candidates.
 */

export type MedicationScheduleStatus =
  | 'active'
  | 'draft_pending_confirmation'
  | 'paused'
  | 'discontinued'
  | 'completed';

export type MedicationScheduleFrequency =
  | 'once_daily'
  | 'twice_daily'
  | 'thrice_daily'
  | 'every_12_hours'
  | 'as_needed'
  | 'custom';

export interface MedicationSchedule {
  id: string;
  family_id: string;
  patient_profile_id: string;
  source_document_id?: string | null;
  source_medicine_name?: string | null;
  medicine_name: string;
  strength?: string | null;
  dosage_instruction: string;
  route?: string | null;
  frequency: MedicationScheduleFrequency | string;
  scheduled_times: string[];
  start_date: string;
  end_date?: string | null;
  prescriber_name?: string | null;
  instructions?: string | null;
  status: MedicationScheduleStatus;
  created_by: string;
  confirmed_by?: string | null;
  confirmed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type DoseOccurrenceStatus =
  | 'scheduled'
  | 'taken'
  | 'skipped'
  | 'missed'
  | 'unconfirmed';

export interface MedicationDoseOccurrence {
  id: string;
  schedule_id: string;
  patient_profile_id: string;
  family_id: string;
  scheduled_date: string;
  scheduled_time: string;
  scheduled_datetime: string;
  status: DoseOccurrenceStatus;
  dose_instruction: string;
  acknowledged_at?: string | null;
  acknowledged_by?: string | null;
  acknowledgement_note?: string | null;
  reminder_sent_at?: string | null;
  escalated_to_caregiver_at?: string | null;
  created_at: string;
  updated_at: string;
  schedule?: MedicationSchedule;
}

export interface MedicationScheduleHistory {
  id: string;
  schedule_id: string;
  changed_by: string;
  action: 'created' | 'confirmed' | 'updated' | 'paused' | 'resumed' | 'discontinued';
  change_summary: string;
  previous_data?: Record<string, unknown> | null;
  created_at: string;
}

export interface PrefilledMedicineCandidate {
  medicineName: string;
  strength?: string;
  dosageInstruction: string;
  frequency: string;
  suggestedTimes: string[];
  route?: string;
  prescriberName?: string;
  sourceDocumentId: string;
  sourceMedicineName: string;
}

export interface CreateMedicationSchedulePayload {
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

export interface UpdateMedicationSchedulePayload {
  dosageInstruction?: string;
  frequency?: string;
  scheduledTimes?: string[];
  endDate?: string | null;
  instructions?: string | null;
  status?: MedicationScheduleStatus;
  reason?: string;
}
