/**
 * backend/src/types/models.ts
 *
 * Core Domain Models for Phase 1, Phase 2, & Phase 3.
 */

export type MembershipRole = 'owner' | 'adult' | 'caregiver' | 'guardian';
export type MembershipStatus = 'active' | 'invited' | 'suspended';
export type PatientCategory = 'child' | 'adult' | 'elderly';
export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone?: string | null;
  avatar_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Family {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface FamilyMembership {
  id: string;
  family_id: string;
  user_id: string;
  role: MembershipRole;
  status: MembershipStatus;
  created_at: string;
  updated_at: string;
  user?: UserProfile;
}

export interface PatientProfile {
  id: string;
  family_id: string;
  health_id: string;
  full_name: string;
  date_of_birth?: string | null;
  gender?: Gender | null;
  relationship_to_creator?: string | null;
  category: PatientCategory;
  avatar_url?: string | null;
  status: 'active' | 'archived';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CaregiverRelationship {
  id: string;
  family_id: string;
  caregiver_user_id: string;
  patient_profile_id: string;
  permissions: {
    view_records: boolean;
    view_medications: boolean;
    [key: string]: boolean;
  };
  created_by: string;
  created_at: string;
  updated_at: string;
}

// -----------------------------------------------------------------------------
// Phase 2: Medical Records, Documents & OCR Models
// -----------------------------------------------------------------------------

export type DocumentCategory =
  | 'prescription'
  | 'laboratory_report'
  | 'diagnostic_imaging_report'
  | 'discharge_summary'
  | 'hospital_record'
  | 'vaccination_record'
  | 'other';

export type DocumentProcessingStatus =
  | 'uploaded'
  | 'queued'
  | 'processing'
  | 'extracted'
  | 'failed';

export type DocumentReviewStatus =
  | 'needs_review'
  | 'in_review'
  | 'confirmed'
  | 'rejected';

export type ExtractionMethod =
  | 'pdf_text_parser'
  | 'tesseract_ocr'
  | 'hybrid'
  | 'manual';

export interface HealthDocument {
  id: string;
  family_id: string;
  patient_profile_id: string;
  title: string;
  category: DocumentCategory;
  document_date?: string | null;
  original_filename: string;
  storage_path: string;
  mime_type: string;
  file_size_bytes: number;
  file_checksum: string;
  processing_status: DocumentProcessingStatus;
  review_status: DocumentReviewStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PrescriptionMedicineField {
  name: string;
  dosage?: string;
  strength?: string;
  route?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
}

export interface LabResultField {
  test_name: string;
  result_value: string;
  unit?: string;
  reference_range?: string;
  interpretation?: string;
}

export interface StructuredMedicalFields {
  patient_name?: string;
  document_type?: string;
  document_date?: string;
  doctor_name?: string;
  facility_name?: string;
  report_title?: string;
  follow_up_instructions?: string;
  allergies?: string[];
  clinical_notes?: string;
  medicines?: PrescriptionMedicineField[];
  lab_results?: LabResultField[];
  [key: string]: unknown;
}

export interface DocumentExtraction {
  id: string;
  document_id: string;
  extraction_version: number;
  extracted_text: string;
  extraction_method: ExtractionMethod;
  ocr_provider: string;
  confidence?: number | null;
  proposed_fields: StructuredMedicalFields;
  confirmed_fields: StructuredMedicalFields;
  extraction_status: 'completed' | 'failed' | 'empty';
  error_classification?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentProcessingJob {
  id: string;
  document_id: string;
  job_type: 'ocr_and_extract' | 'pdf_text_extract' | 'reprocess';
  status: 'queued' | 'processing' | 'completed' | 'failed';
  attempt_count: number;
  max_attempts: number;
  last_error?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

// -----------------------------------------------------------------------------
// Phase 3: AI Health Memory, Grounding, Timeline & Doctor Summary Models
// -----------------------------------------------------------------------------

export interface GroundedSourceReference {
  documentId: string;
  documentTitle: string;
  category: DocumentCategory;
  documentDate?: string | null;
  field?: string;
  snippet?: string;
  isVerified: boolean;
}

export interface AIMemoryQueryResponse {
  answer: string;
  sources: GroundedSourceReference[];
  isGrounded: boolean;
  confidenceNote?: string;
}

export interface AIConversation {
  id: string;
  family_id: string;
  patient_profile_id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface AIConversationMessage {
  id: string;
  conversation_id: string;
  sender: 'user' | 'assistant' | 'system';
  content: string;
  sources: GroundedSourceReference[];
  is_grounded: boolean;
  created_at: string;
}

export interface TimelineEvent {
  id: string;
  eventType: 'document_uploaded' | 'prescription' | 'lab_report' | 'hospital_visit' | 'imaging' | 'vaccination' | 'other';
  date: string;
  isDateConfirmed: boolean;
  title: string;
  description: string;
  documentId: string;
  category: DocumentCategory;
  isVerified: boolean;
  highlights?: string[];
}

export interface LabResultDataPoint {
  id: string;
  testName: string;
  normalizedTestName: string;
  value: number;
  rawResultValue: string;
  unit: string;
  referenceRange?: string;
  date: string;
  documentId: string;
  documentTitle: string;
  isVerified: boolean;
}

export interface LabTrendSeries {
  testName: string;
  unit: string;
  dataPoints: LabResultDataPoint[];
}

export interface DoctorSummaryOptions {
  patientProfileId: string;
  title?: string;
  selectedDocumentIds: string[];
  includedSections: ('patient_info' | 'medical_history' | 'allergies' | 'lab_results' | 'prescriptions' | 'source_documents')[];
  doctorName?: string;
  notes?: string;
}

export interface DoctorSummaryRecord {
  id: string;
  family_id: string;
  patient_profile_id: string;
  title: string;
  selected_document_ids: string[];
  included_sections: string[];
  doctor_name?: string | null;
  notes?: string | null;
  generated_by: string;
  file_size_bytes: number;
  created_at: string;
}

// ============================================================================
// Phase 4 Models: Medication Management, Appointments & Notifications
// ============================================================================

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

export interface MedicationScheduleHistory {
  id: string;
  schedule_id: string;
  changed_by: string;
  action: 'created' | 'confirmed' | 'updated' | 'paused' | 'resumed' | 'discontinued';
  change_summary: string;
  previous_data?: Record<string, unknown> | null;
  created_at: string;
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

export type NotificationCategory =
  | 'medication_reminder'
  | 'medication_escalation'
  | 'appointment_reminder'
  | 'general'
  | 'community_invitation'
  | 'community_join_decision'
  | 'community_request_new'
  | 'volunteer_interest_or_assignment'
  | 'community_request_status'
  | 'blood_donor_response'
  | 'community_request_expiry'
  | 'moderation_action'
  | 'community_report_submitted';

export type NotificationChannel =
  | 'in_app'
  | 'browser'
  | 'email'
  | 'sms';

export type NotificationStatus =
  | 'scheduled'
  | 'queued'
  | 'attempted'
  | 'delivered'
  | 'failed'
  | 'cancelled'
  | 'read'
  | 'acknowledged';

export interface Notification {
  id: string;
  family_id?: string | null;
  community_id?: string | null;
  patient_profile_id?: string | null;
  recipient_user_id: string;
  category: NotificationCategory;
  title: string;
  message: string;
  details_payload: Record<string, unknown>;
  channel: NotificationChannel;
  status: NotificationStatus;
  scheduled_for: string;
  attempt_count: number;
  last_attempt_at?: string | null;
  delivered_at?: string | null;
  read_at?: string | null;
  acknowledged_at?: string | null;
  acknowledged_by?: string | null;
  failure_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreference {
  id: string;
  user_id: string;
  family_id: string;
  enable_in_app: boolean;
  enable_browser: boolean;
  enable_email: boolean;
  enable_sms: boolean;
  medication_reminders: boolean;
  appointment_reminders: boolean;
  caregiver_escalations: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  preferred_language: string;
  created_at: string;
  updated_at: string;
}

export interface CaregiverReminderPolicy {
  id: string;
  family_id: string;
  patient_profile_id: string;
  caregiver_user_id: string;
  escalate_unacknowledged_meds: boolean;
  med_escalation_grace_minutes: number;
  escalate_upcoming_appointments: boolean;
  created_at: string;
  updated_at: string;
}

export type ScheduledJobType =
  | 'dose_reminder'
  | 'caregiver_escalation'
  | 'appointment_reminder'
  | 'generate_daily_doses'
  | 'sos_family_timeout'
  | 'sos_caregiver_timeout';

export type ScheduledJobStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface ScheduledJob {
  id: string;
  job_type: ScheduledJobType;
  reference_id: string;
  scheduled_at: string;
  status: ScheduledJobStatus;
  retry_count: number;
  max_retries: number;
  last_error?: string | null;
  payload: Record<string, unknown>;
  locked_until?: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Phase 5 Models: Emergency SOS Simulation & Hospital Handoff
// ============================================================================

export type EmergencyContactRole = 'primary_family' | 'secondary_family' | 'caregiver' | 'doctor';

export interface EmergencyContact {
  id: string;
  family_id: string;
  patient_profile_id: string;
  name: string;
  relationship: string;
  phone_number: string;
  role: EmergencyContactRole;
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
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type EmergencyAttemptStatus =
  | 'QUEUED'
  | 'SENT_SIMULATED'
  | 'AWAITING_RESPONSE'
  | 'ACKNOWLEDGED'
  | 'TIMEOUT_NO_RESPONSE'
  | 'FAILED_SIMULATED'
  | 'CANCELLED';

export interface EmergencyContactAttempt {
  id: string;
  incident_id: string;
  contact_id?: string | null;
  contact_name: string;
  contact_role: string;
  channel: string;
  stage: 'FAMILY_CONTACT' | 'CAREGIVER_ESCALATION';
  status: EmergencyAttemptStatus;
  attempted_at: string;
  acknowledged_at?: string | null;
  acknowledgement_action?: string | null;
  acknowledgement_note?: string | null;
  is_demo: boolean;
  simulation_provenance: string;
  created_at: string;
  updated_at: string;
}

export type EmergencyActorType =
  | 'PATIENT'
  | 'USER'
  | 'SYSTEM_SCHEDULER'
  | 'CONTACT'
  | 'CAREGIVER'
  | 'HOSPITAL_RECEIVING_DESK'
  | 'DEMO_OPERATOR';

export interface EmergencyIncidentEvent {
  id: string;
  incident_id: string;
  event_type: string;
  title: string;
  description: string;
  actor_type: EmergencyActorType;
  actor_id?: string | null;
  stage: string;
  payload: Record<string, unknown>;
  is_demo: boolean;
  simulation_provenance: string;
  created_at: string;
}

export type HospitalHandoffStatus =
  | 'PENDING_SIMULATED'
  | 'ACKNOWLEDGED_SIMULATED'
  | 'FAILED_SIMULATED'
  | 'CANCELLED';

export interface HospitalHandoff {
  id: string;
  incident_id: string;
  hospital_name: string;
  department: string;
  status: HospitalHandoffStatus;
  patient_summary_packet: Record<string, unknown>;
  handoff_prepared_at: string;
  acknowledged_at?: string | null;
  receiving_staff_name?: string | null;
  receiving_notes?: string | null;
  is_demo: boolean;
  simulation_provenance: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Phase 6: Controlled Live Test Mode & Telephony Integration Models
// ============================================================================

export type LiveTestChannel = 'SMS' | 'VOICE' | 'BOTH';
export type LiveTestVerificationStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
export type LiveTestConsentStatus = 'CONSENT_GRANTED' | 'CONSENT_REVOKED';
export type LiveTestDispatchStatus = 'QUEUED' | 'SENDING' | 'ACCEPTED' | 'DELIVERED' | 'FAILED' | 'UNKNOWN';

export interface LiveTestRecipient {
  id: string;
  family_id: string;
  display_name: string;
  phone_number: string;
  permitted_channel: LiveTestChannel;
  verification_status: LiveTestVerificationStatus;
  verification_notes?: string | null;
  verified_at?: string | null;
  verified_by_user_id?: string | null;
  consent_status: LiveTestConsentStatus;
  consent_recorded_at: string;
  consent_notes: string;
  is_active: boolean;
  allowed_purpose: string;
  created_at: string;
  updated_at: string;
}

export interface LiveTestAuditLog {
  id: string;
  family_id: string;
  incident_id: string;
  recipient_id: string;
  channel: 'SMS' | 'VOICE';
  provider_name: string;
  provider_request_id?: string | null;
  destination_phone_masked: string;
  message_payload_preview: string;
  dispatch_status: LiveTestDispatchStatus;
  delivery_evidence_at?: string | null;
  delivery_evidence_status?: string | null;
  human_acknowledged: boolean;
  human_acknowledged_at?: string | null;
  human_acknowledgement_note?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  raw_provider_response?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface TelephonyProviderHealth {
  provider: 'twilio' | 'exotel' | 'mock' | 'none';
  isConfigured: boolean;
  liveTestModeEnabled: boolean;
  supportedChannels: ('SMS' | 'VOICE')[];
  maxRecipients: number;
  cooldownSeconds: number;
  statusMessage: string;
}

export interface LiveTestPreflightResponse {
  incidentId: string;
  patientName: string;
  healthId: string;
  liveModeWarning: string;
  simulatedEscalationNotice: string;
  providerHealth: TelephonyProviderHealth;
  eligibleRecipients: Array<{
    id: string;
    displayName: string;
    maskedPhone: string;
    permittedChannel: LiveTestChannel;
    verificationStatus: LiveTestVerificationStatus;
    consentStatus: LiveTestConsentStatus;
  }>;
  ineligibleRecipients: Array<{
    id: string;
    displayName: string;
    reason: string;
  }>;
  smsPreviewText: string;
  voicePreviewScript: string;
}

export interface LiveTestDispatchRequest {
  incidentId: string;
  recipientIds: string[];
  channel: 'SMS' | 'VOICE';
  operatorConfirmed: boolean;
  idempotencyKey?: string;
}

export interface LiveTestDispatchResult {
  incidentId: string;
  channel: 'SMS' | 'VOICE';
  providerName: string;
  dispatchedCount: number;
  failedCount: number;
  results: Array<{
    recipientId: string;
    displayName: string;
    maskedPhone: string;
    status: LiveTestDispatchStatus;
    providerRequestId?: string | null;
    auditLogId: string;
    error?: string | null;
  }>;
  simulationNotice: string;
}

// -----------------------------------------------------------------------------
// Phase 7: Offline-First Health Records, Sync Operations & Conflict Models
// -----------------------------------------------------------------------------

export type SyncOperationType =
  | 'PATIENT_UPDATE'
  | 'APPOINTMENT_CREATE'
  | 'APPOINTMENT_UPDATE'
  | 'MEDICATION_DOSE_RECORD'
  | 'MEDICATION_SCHEDULE_CREATE'
  | 'DOCUMENT_UPLOAD';

export type SyncOperationStatus =
  | 'pending'
  | 'syncing'
  | 'synced'
  | 'failed'
  | 'conflict';

export type SyncErrorCategory =
  | 'network'
  | 'auth'
  | 'validation'
  | 'conflict'
  | 'quota'
  | 'server';

export type SyncConflictResolutionStatus =
  | 'pending'
  | 'resolved_client'
  | 'resolved_server'
  | 'resolved_merged';

export interface SyncOperation {
  id: string;
  family_id: string;
  patient_profile_id?: string | null;
  user_id: string;
  client_operation_id: string;
  idempotency_key: string;
  operation_type: SyncOperationType;
  payload: Record<string, unknown>;
  base_revision?: string | null;
  client_timestamp: string;
  server_received_at: string;
  status: SyncOperationStatus;
  result_payload?: Record<string, unknown> | null;
  error_category?: SyncErrorCategory | null;
  error_message?: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

export interface SyncConflict {
  id: string;
  family_id: string;
  patient_profile_id?: string | null;
  client_operation_id: string;
  entity_type: 'patient_profile' | 'appointment' | 'medication_schedule';
  entity_id: string;
  field_name?: string | null;
  local_value: Record<string, unknown>;
  server_value: Record<string, unknown>;
  base_value?: Record<string, unknown> | null;
  resolution_status: SyncConflictResolutionStatus;
  resolved_by?: string | null;
  resolved_at?: string | null;
  resolved_value?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface SyncOperationItem {
  clientOperationId: string;
  idempotencyKey: string;
  patientProfileId?: string;
  operationType: SyncOperationType;
  payload: Record<string, unknown>;
  baseRevision?: string;
  clientTimestamp: string;
  retryCount?: number;
}

export interface SyncBatchRequest {
  operations: SyncOperationItem[];
}

export interface SyncOperationResult {
  clientOperationId: string;
  status: SyncOperationStatus;
  serverEntityId?: string;
  resultPayload?: Record<string, unknown>;
  errorCategory?: SyncErrorCategory;
  errorMessage?: string;
  conflict?: SyncConflict;
}

export interface SyncBatchResponse {
  results: SyncOperationResult[];
  serverTimestamp: string;
  pendingConflictsCount: number;
}

export interface SyncDeltaResponse {
  patients: PatientProfile[];
  documents: HealthDocument[];
  medications: MedicationSchedule[];
  appointments: Appointment[];
  conflicts: SyncConflict[];
  serverTimestamp: string;
}

// ============================================================================
// Phase 8 Models: Health Community, Society Groups & Elderly Assistance Network
// ============================================================================

export type CommunityGroupType =
  | 'residential_society'
  | 'apartment_building'
  | 'neighborhood'
  | 'other_local';

export type CommunityMembershipPolicy = 'open' | 'approval_required' | 'invite_only';
export type CommunityModerationPolicy = 'standard' | 'strict';
export type CommunityStatus = 'active' | 'closed' | 'suspended';

export interface CommunityGroup {
  id: string;
  name: string;
  group_type: CommunityGroupType;
  description: string;
  approximate_locality: string;
  organization_or_building_name?: string | null;
  creator_user_id: string;
  membership_policy: CommunityMembershipPolicy;
  moderation_policy: CommunityModerationPolicy;
  status: CommunityStatus;
  created_at: string;
  updated_at: string;
}

export type CommunityRole = 'owner' | 'moderator' | 'member';
export type CommunityMembershipStatus = 'active' | 'suspended' | 'removed' | 'left';

export interface CommunityMembership {
  id: string;
  community_id: string;
  user_id: string;
  role: CommunityRole;
  status: CommunityMembershipStatus;
  joined_at: string;
  created_at: string;
  updated_at: string;
}

export type CommunityInvitationStatus = 'pending' | 'accepted' | 'declined' | 'revoked' | 'expired';

export interface CommunityInvitation {
  id: string;
  community_id: string;
  inviter_user_id: string;
  invitee_email: string;
  invite_code: string;
  status: CommunityInvitationStatus;
  expires_at: string;
  accepted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type CommunityJoinRequestStatus = 'pending' | 'approved' | 'rejected';

export interface CommunityJoinRequest {
  id: string;
  community_id: string;
  user_id: string;
  notes?: string | null;
  status: CommunityJoinRequestStatus;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type AssistanceCategory =
  | 'grocery_supplies'
  | 'appointment_accompaniment'
  | 'transport_assistance'
  | 'errands'
  | 'welfare_check'
  | 'caregiver_contact'
  | 'other_support';

export type AssistancePriority = 'low' | 'medium' | 'high';

export type AssistanceStatus =
  | 'open'
  | 'interest_received'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'expired';

export interface AssistanceRequest {
  id: string;
  community_id: string;
  request_category: AssistanceCategory;
  title: string;
  description: string;
  priority: AssistancePriority;
  creator_user_id: string;
  intended_recipient_name?: string | null;
  approximate_locality: string;
  preferred_date_time?: string | null;
  expiry_time: string;
  status: AssistanceStatus;
  assigned_volunteer_user_id?: string | null;
  contact_sharing_consent: boolean;
  contact_phone?: string | null;
  contact_address?: string | null;
  created_at: string;
  updated_at: string;
}

export type AssistanceAssignmentStatus =
  | 'interested'
  | 'assigned'
  | 'declined'
  | 'withdrawn'
  | 'completed';

export interface AssistanceAssignment {
  id: string;
  request_id: string;
  volunteer_user_id: string;
  status: AssistanceAssignmentStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'any';

export type BloodDonorRequestStatus = 'open' | 'fulfilled' | 'cancelled' | 'expired';

export interface BloodDonorRequest {
  id: string;
  community_id: string;
  blood_group: BloodGroup;
  units_needed: number;
  approximate_locality: string;
  hospital_name?: string | null;
  requested_date_time?: string | null;
  creator_user_id: string;
  notes?: string | null;
  status: BloodDonorRequestStatus;
  expiry_time: string;
  contact_phone?: string | null;
  contact_sharing_consent: boolean;
  created_at: string;
  updated_at: string;
}

export type DonorResponseStatus =
  | 'interested'
  | 'contacted'
  | 'unavailable'
  | 'referred_to_screening';

export interface DonorResponse {
  id: string;
  request_id: string;
  donor_user_id: string;
  blood_group: BloodGroup;
  status: DonorResponseStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactSharingGrant {
  id: string;
  resource_type: 'assistance_request' | 'blood_donor_request';
  resource_id: string;
  granted_by_user_id: string;
  granted_to_user_id: string;
  contact_phone: string;
  contact_address?: string | null;
  contact_notes?: string | null;
  status: 'active' | 'revoked';
  expires_at: string;
  created_at: string;
}

export type CommunityReportTargetType = 'assistance_request' | 'blood_donor_request' | 'member';

export type CommunityReportReason =
  | 'suspicious'
  | 'spam'
  | 'harassment'
  | 'impersonation'
  | 'inappropriate_content'
  | 'unauthorized_phi'
  | 'fraud'
  | 'other';

export type CommunityReportStatus =
  | 'submitted'
  | 'under_review'
  | 'action_required'
  | 'resolved'
  | 'dismissed';

export interface CommunityReport {
  id: string;
  community_id: string;
  reporter_user_id: string;
  target_type: CommunityReportTargetType;
  target_id: string;
  reason_category: CommunityReportReason;
  details: string;
  status: CommunityReportStatus;
  decision_notes?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type ModerationActionType =
  | 'content_hidden'
  | 'member_warned'
  | 'member_suspended'
  | 'member_removed'
  | 'dismissed';

export interface ModerationAction {
  id: string;
  report_id?: string | null;
  community_id: string;
  moderator_user_id: string;
  action_taken: ModerationActionType;
  notes: string;
  created_at: string;
}




