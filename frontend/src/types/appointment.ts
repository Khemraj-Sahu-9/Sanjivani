/**
 * frontend/src/types/appointment.ts
 *
 * Types for Doctor Appointments and Scheduling.
 */

export type AppointmentStatus =
  | 'scheduled'
  | 'completed'
  | 'cancelled'
  | 'rescheduled';

export interface Appointment {
  id: string;
  family_id: string;
  patient_profile_id: string;
  title: string;
  doctor_name?: string | null;
  facility_name?: string | null;
  appointment_date: string;
  appointment_time?: string | null;
  appointment_datetime?: string | null;
  timezone: string;
  location?: string | null;
  notes?: string | null;
  source_document_id?: string | null;
  status: AppointmentStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateAppointmentPayload {
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
  reminderIntervalsHours?: number[];
}

export interface UpdateAppointmentPayload {
  title?: string;
  doctorName?: string | null;
  facilityName?: string | null;
  appointmentDate?: string;
  appointmentTime?: string | null;
  timezone?: string;
  location?: string | null;
  notes?: string | null;
  status?: AppointmentStatus;
  reminderIntervalsHours?: number[];
}
