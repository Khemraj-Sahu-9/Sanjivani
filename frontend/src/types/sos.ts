/**
 * frontend/src/types/sos.ts
 *
 * Types for Phase 5: SOS Emergency Simulation & Hospital Handoff.
 */

export type EmergencyIncidentStatus =
  | 'CREATED'
  | 'CONTACTING_FAMILY'
  | 'AWAITING_FAMILY_RESPONSE'
  | 'FAMILY_RESPONDED'
  | 'ESCALATING_CAREGIVER'
  | 'AWAITING_CAREGIVER_RESPONSE'
  | 'CAREGIVER_RESPONDED'
  | 'HOSPITAL_HANDOFF_PENDING'
  | 'HOSPITAL_HANDOFF_SIMULATED'
  | 'RESOLVED'
  | 'CANCELLED'
  | 'ESCALATION_FAILED';

export type EmergencyIncidentStage =
  | 'FAMILY_CONTACT'
  | 'CAREGIVER_ESCALATION'
  | 'HOSPITAL_HANDOFF'
  | 'RESOLVED'
  | 'CANCELLED';

export interface EmergencyContact {
  id: string;
  family_id: string;
  patient_profile_id: string;
  name: string;
  relationship: string;
  phone_number: string;
  role: 'primary_family' | 'secondary_family' | 'caregiver' | 'doctor';
  priority: number;
  is_active: boolean;
  is_demo: boolean;
  simulation_provenance: string;
  created_at: string;
  updated_at: string;
}

export interface EmergencyEscalationPolicy {
  id: string;
  family_id: string;
  patient_profile_id: string;
  family_response_timeout_seconds: number;
  caregiver_response_timeout_seconds: number;
  advance_to_hospital_on_timeout: boolean;
  hospital_name: string;
  hospital_department: string;
  is_active: boolean;
  is_demo: boolean;
  simulation_provenance: string;
  created_at: string;
  updated_at: string;
}

export interface EmergencyIncident {
  id: string;
  incident_number: string;
  family_id: string;
  patient_profile_id: string;
  initiated_by_user_id: string;
  status: EmergencyIncidentStatus;
  current_stage: EmergencyIncidentStage;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  location_note: string;
  is_demo: boolean;
  simulation_provenance: string;
  activated_at: string;
  response_deadline?: string | null;
  resolved_at?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  resolution_note?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface EmergencyContactAttempt {
  id: string;
  incident_id: string;
  contact_id?: string | null;
  contact_name: string;
  contact_role: string;
  channel: string;
  stage: 'FAMILY_CONTACT' | 'CAREGIVER_ESCALATION';
  status:
    | 'QUEUED'
    | 'SENT_SIMULATED'
    | 'AWAITING_RESPONSE'
    | 'ACKNOWLEDGED'
    | 'TIMEOUT_NO_RESPONSE'
    | 'FAILED_SIMULATED'
    | 'CANCELLED';
  attempted_at: string;
  acknowledged_at?: string | null;
  acknowledgement_action?: string | null;
  acknowledgement_note?: string | null;
  is_demo: boolean;
  simulation_provenance: string;
}

export interface EmergencyIncidentEvent {
  id: string;
  incident_id: string;
  event_type: string;
  title: string;
  description: string;
  actor_type: string;
  actor_id?: string | null;
  stage: string;
  payload?: Record<string, unknown>;
  is_demo: boolean;
  simulation_provenance: string;
  created_at: string;
}

export interface HospitalHandoff {
  id: string;
  incident_id: string;
  hospital_name: string;
  department: string;
  status: 'PENDING_SIMULATED' | 'ACKNOWLEDGED_SIMULATED' | 'FAILED_SIMULATED' | 'CANCELLED';
  patient_summary_packet: {
    incidentNumber?: string;
    activatedAt?: string;
    severity?: string;
    locationNote?: string;
    patient?: {
      id?: string;
      fullName?: string;
      healthId?: string;
      category?: string;
      gender?: string;
      dateOfBirth?: string;
    };
    criticalConditions?: string[];
    knownAllergies?: string[];
    activeMedications?: Array<{
      name: string;
      dosage: string;
      frequency: string;
      scheduledTimes?: string[];
    }>;
    recentReports?: Array<{
      documentId: string;
      title: string;
      category: string;
      documentDate?: string;
      status?: string;
    }>;
    verificationNotice?: string;
    preparedAt?: string;
  };
  handoff_prepared_at: string;
  acknowledged_at?: string | null;
  receiving_staff_name?: string | null;
  receiving_notes?: string | null;
  is_demo: boolean;
  simulation_provenance: string;
}
