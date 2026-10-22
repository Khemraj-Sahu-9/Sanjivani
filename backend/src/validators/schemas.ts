import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(1, 'Full name is required').max(100),
  phone: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const createFamilySchema = z.object({
  name: z.string().trim().min(2, 'Family name must be at least 2 characters').max(100),
});

export const updateFamilySchema = z.object({
  name: z.string().trim().min(2, 'Family name must be at least 2 characters').max(100),
});

export const addMembershipSchema = z.object({
  email: z.string().email('Invalid user email address'),
  role: z.enum(['adult', 'caregiver', 'guardian']),
});

export const updateMembershipRoleSchema = z.object({
  role: z.enum(['owner', 'adult', 'caregiver', 'guardian']),
});

export const createPatientProfileSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required').max(100),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be YYYY-MM-DD').optional().nullable(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional().nullable(),
  relationshipToCreator: z.string().max(50).optional().nullable(),
  category: z.enum(['child', 'adult', 'elderly']),
  avatarUrl: z.string().url().optional().nullable(),
});

export const updatePatientProfileSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required').max(100).optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be YYYY-MM-DD').optional().nullable(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional().nullable(),
  relationshipToCreator: z.string().max(50).optional().nullable(),
  category: z.enum(['child', 'adult', 'elderly']).optional(),
  avatarUrl: z.string().url().optional().nullable(),
  status: z.enum(['active', 'archived']).optional(),
});

// -----------------------------------------------------------------------------
// Phase 2: Document Management & Review Validation Schemas
// -----------------------------------------------------------------------------

export const documentCategorySchema = z.enum([
  'prescription',
  'laboratory_report',
  'diagnostic_imaging_report',
  'discharge_summary',
  'hospital_record',
  'vaccination_record',
  'other',
]);

export const uploadDocumentMetadataSchema = z.object({
  patientProfileId: z.string().uuid('Invalid patient profile ID'),
  category: documentCategorySchema,
  title: z.string().trim().min(1, 'Document title is required').max(150),
  documentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Document date must be YYYY-MM-DD').optional().nullable(),
});

export const updateDocumentMetadataSchema = z.object({
  title: z.string().trim().min(1, 'Document title is required').max(150).optional(),
  category: documentCategorySchema.optional(),
  documentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Document date must be YYYY-MM-DD').optional().nullable(),
});

export const saveReviewSchema = z.object({
  confirmedFields: z.record(z.string(), z.unknown()),
  markConfirmed: z.boolean().optional(),
});

// -----------------------------------------------------------------------------
// Phase 3: AI Health Memory & Doctor Summary Schemas
// -----------------------------------------------------------------------------

export const askMemorySchema = z.object({
  patientProfileId: z.string().uuid('Invalid patient profile ID'),
  question: z.string().trim().min(2, 'Question must be at least 2 characters').max(1000),
  conversationId: z.string().uuid().optional(),
});

export const doctorSummaryOptionsSchema = z.object({
  patientProfileId: z.string().uuid('Invalid patient profile ID'),
  title: z.string().trim().max(150).optional(),
  selectedDocumentIds: z.array(z.string().uuid()).min(1, 'Please select at least one document to include'),
  includedSections: z.array(
    z.enum(['patient_info', 'medical_history', 'allergies', 'lab_results', 'prescriptions', 'source_documents'])
  ).min(1, 'Please select at least one summary section'),
  doctorName: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(1000).optional(),
});

// -----------------------------------------------------------------------------
// Phase 4: Medication Management, Appointments & Notifications Schemas
// -----------------------------------------------------------------------------

export const medicationFrequencyEnum = z.enum([
  'once_daily',
  'twice_daily',
  'thrice_daily',
  'every_12_hours',
  'as_needed',
  'custom',
]);

const timeFormatRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

export const createMedicationScheduleSchema = z.object({
  patientProfileId: z.string().uuid('Invalid patient profile ID'),
  sourceDocumentId: z.string().uuid().optional().nullable(),
  sourceMedicineName: z.string().trim().max(100).optional().nullable(),
  medicineName: z.string().trim().min(1, 'Medicine name is required').max(100),
  strength: z.string().trim().max(50).optional().nullable(),
  dosageInstruction: z.string().trim().min(1, 'Dosage instruction is required').max(255),
  route: z.string().trim().max(50).optional().nullable(),
  frequency: medicationFrequencyEnum,
  scheduledTimes: z.array(z.string().regex(timeFormatRegex, 'Time must be in HH:MM 24-hour format')).min(1, 'At least one scheduled time required'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD').optional().nullable(),
  prescriberName: z.string().trim().max(100).optional().nullable(),
  instructions: z.string().trim().max(500).optional().nullable(),
  isDraftPendingConfirmation: z.boolean().optional(),
});

export const updateMedicationScheduleSchema = z.object({
  medicineName: z.string().trim().min(1).max(100).optional(),
  strength: z.string().trim().max(50).optional().nullable(),
  dosageInstruction: z.string().trim().min(1).max(255).optional(),
  route: z.string().trim().max(50).optional().nullable(),
  frequency: medicationFrequencyEnum.optional(),
  scheduledTimes: z.array(z.string().regex(timeFormatRegex, 'Time must be in HH:MM format')).min(1).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  prescriberName: z.string().trim().max(100).optional().nullable(),
  instructions: z.string().trim().max(500).optional().nullable(),
  status: z.enum(['active', 'paused', 'discontinued', 'completed']).optional(),
});

export const recordDoseOccurrenceStatusSchema = z.object({
  status: z.enum(['scheduled', 'taken', 'skipped', 'missed', 'unconfirmed']),
  note: z.string().trim().max(255).optional().nullable(),
});

export const createAppointmentSchema = z.object({
  patientProfileId: z.string().uuid('Invalid patient profile ID'),
  title: z.string().trim().min(1, 'Appointment title is required').max(150),
  doctorName: z.string().trim().max(100).optional().nullable(),
  facilityName: z.string().trim().max(100).optional().nullable(),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Appointment date must be YYYY-MM-DD'),
  appointmentTime: z.string().regex(timeFormatRegex, 'Time must be in HH:MM format').optional().nullable(),
  timezone: z.string().trim().max(50).default('Asia/Kolkata'),
  location: z.string().trim().max(200).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  sourceDocumentId: z.string().uuid().optional().nullable(),
  reminderHoursBefore: z.array(z.number().int().min(1).max(168)).optional(),
});

export const updateAppointmentSchema = z.object({
  title: z.string().trim().min(1).max(150).optional(),
  doctorName: z.string().trim().max(100).optional().nullable(),
  facilityName: z.string().trim().max(100).optional().nullable(),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  appointmentTime: z.string().regex(timeFormatRegex, 'Time must be in HH:MM format').optional().nullable(),
  timezone: z.string().trim().max(50).optional(),
  location: z.string().trim().max(200).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  status: z.enum(['scheduled', 'completed', 'cancelled', 'rescheduled']).optional(),
  reminderHoursBefore: z.array(z.number().int().min(1).max(168)).optional(),
});

export const updateNotificationPreferencesSchema = z.object({
  enableInApp: z.boolean().optional(),
  enable_in_app: z.boolean().optional(),
  enableBrowser: z.boolean().optional(),
  enable_browser: z.boolean().optional(),
  enableEmail: z.boolean().optional(),
  enable_email: z.boolean().optional(),
  enableSms: z.boolean().optional(),
  enable_sms: z.boolean().optional(),
  medicationReminders: z.boolean().optional(),
  medication_reminders: z.boolean().optional(),
  appointmentReminders: z.boolean().optional(),
  appointment_reminders: z.boolean().optional(),
  caregiverEscalations: z.boolean().optional(),
  caregiver_escalations: z.boolean().optional(),
  quietHoursEnabled: z.boolean().optional(),
  quiet_hours_enabled: z.boolean().optional(),
  quietHoursStart: z.string().regex(timeFormatRegex).optional(),
  quiet_hours_start: z.string().regex(timeFormatRegex).optional(),
  quietHoursEnd: z.string().regex(timeFormatRegex).optional(),
  quiet_hours_end: z.string().regex(timeFormatRegex).optional(),
  preferredLanguage: z.string().trim().max(10).optional(),
  preferred_language: z.string().trim().max(10).optional(),
});

export const upsertCaregiverPolicySchema = z.object({
  caregiverUserId: z.string().uuid('Invalid caregiver user ID'),
  escalateUnacknowledgedMeds: z.boolean().default(true),
  medEscalationGraceMinutes: z.number().int().min(5).max(240).default(30),
  escalateUpcomingAppointments: z.boolean().default(true),
});

// ============================================================================
// Phase 5: SOS Emergency Simulation Schemas
// ============================================================================

export const triggerSosSchema = z.object({
  patientProfileId: z.string().uuid('Invalid patient profile ID').optional(),
  patient_profile_id: z.string().uuid('Invalid patient profile ID').optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('CRITICAL'),
  locationNote: z.string().max(500).optional(),
  location_note: z.string().max(500).optional(),
});

export const contactAcknowledgementSchema = z.object({
  action: z.string().min(1, 'Acknowledgement action is required'),
  note: z.string().max(500).optional(),
});

export const caregiverAcknowledgementSchema = z.object({
  action: z.string().min(1, 'Caregiver action is required'),
  note: z.string().max(500).optional(),
});

export const hospitalDeskAcknowledgementSchema = z.object({
  receivingStaffName: z.string().min(1, 'Receiving staff name is required').max(100).optional(),
  receiving_staff_name: z.string().min(1).max(100).optional(),
  receivingNotes: z.string().max(1000).optional(),
  receiving_notes: z.string().max(1000).optional(),
});

export const emergencyContactSchema = z.object({
  patientProfileId: z.string().uuid().optional(),
  patient_profile_id: z.string().uuid().optional(),
  name: z.string().min(1, 'Name is required').max(100),
  relationship: z.string().min(1, 'Relationship is required').max(100),
  phoneNumber: z.string().max(50).optional(),
  phone_number: z.string().max(50).optional(),
  role: z.enum(['primary_family', 'secondary_family', 'caregiver', 'doctor']).default('primary_family'),
  priority: z.number().int().min(1).max(10).default(1),
});

export const emergencyEscalationPolicySchema = z.object({
  patientProfileId: z.string().uuid().optional(),
  patient_profile_id: z.string().uuid().optional(),
  familyResponseTimeoutSeconds: z.number().int().min(5).max(300).optional(),
  family_response_timeout_seconds: z.number().int().min(5).max(300).optional(),
  caregiverResponseTimeoutSeconds: z.number().int().min(5).max(300).optional(),
  caregiver_response_timeout_seconds: z.number().int().min(5).max(300).optional(),
  advanceToHospitalOnTimeout: z.boolean().optional(),
  advance_to_hospital_on_timeout: z.boolean().optional(),
  hospitalName: z.string().max(200).optional(),
  hospital_name: z.string().max(200).optional(),
  hospitalDepartment: z.string().max(200).optional(),
  hospital_department: z.string().max(200).optional(),
});

export const cancelIncidentSchema = z.object({
  reason: z.string().min(1, 'Cancellation reason is required').max(500),
});

export const resolveIncidentSchema = z.object({
  resolutionNote: z.string().min(1, 'Resolution note is required').max(500).optional(),
  resolution_note: z.string().min(1).max(500).optional(),
});

// ============================================================================
// Phase 6: Live Test Mode Schemas
// ============================================================================

export const addLiveTestRecipientSchema = z.object({
  displayName: z.string().min(1, 'Display name is required').max(100).optional(),
  display_name: z.string().min(1).max(100).optional(),
  phoneNumber: z.string().min(1, 'Valid phone number is required').max(50).optional(),
  phone_number: z.string().min(1).max(50).optional(),
  permittedChannel: z.enum(['SMS', 'VOICE', 'BOTH']).default('SMS').optional(),
  permitted_channel: z.enum(['SMS', 'VOICE', 'BOTH']).optional(),
  allowedPurpose: z.string().max(200).optional(),
  allowed_purpose: z.string().max(200).optional(),
  consentNotes: z.string().max(500).optional(),
  consent_notes: z.string().max(500).optional(),
  verified: z.boolean().optional(),
});

export const updateLiveTestConsentSchema = z.object({
  consentStatus: z.enum(['CONSENT_GRANTED', 'CONSENT_REVOKED']).optional(),
  consent_status: z.enum(['CONSENT_GRANTED', 'CONSENT_REVOKED']).optional(),
  notes: z.string().max(500).optional(),
});

export const verifyLiveTestRecipientSchema = z.object({
  status: z.enum(['VERIFIED', 'REJECTED', 'PENDING', 'UNVERIFIED']).default('VERIFIED'),
  notes: z.string().max(500).optional(),
});

export const dispatchLiveTestSchema = z.object({
  incidentId: z.string().uuid().optional(),
  incident_id: z.string().uuid().optional(),
  recipientIds: z.array(z.string().uuid()).min(1, 'At least one recipient ID is required').optional(),
  recipient_ids: z.array(z.string().uuid()).min(1).optional(),
  channel: z.enum(['SMS', 'VOICE']),
  operatorConfirmed: z.boolean().optional(),
  operator_confirmed: z.boolean().optional(),
  idempotencyKey: z.string().max(100).optional(),
  idempotency_key: z.string().max(100).optional(),
});

export const acknowledgeLiveTestSchema = z.object({
  note: z.string().max(500).optional(),
});

// ============================================================================
// Phase 7: Offline Sync Schemas
// ============================================================================

export const syncOperationItemSchema = z.object({
  clientOperationId: z.string().min(1, 'clientOperationId is required'),
  idempotencyKey: z.string().min(1, 'idempotencyKey is required'),
  patientProfileId: z.string().uuid().optional(),
  operationType: z.enum([
    'PATIENT_UPDATE',
    'APPOINTMENT_CREATE',
    'APPOINTMENT_UPDATE',
    'MEDICATION_DOSE_RECORD',
    'MEDICATION_SCHEDULE_CREATE',
    'DOCUMENT_UPLOAD',
  ]),
  payload: z.record(z.string(), z.unknown()),
  baseRevision: z.string().optional(),
  clientTimestamp: z.string().min(1, 'clientTimestamp is required'),
  retryCount: z.number().int().min(0).optional(),
});

export const syncBatchSchema = z.object({
  operations: z.array(syncOperationItemSchema).min(1, 'At least one sync operation is required'),
});

export const resolveConflictSchema = z.object({
  resolution: z.enum(['resolved_client', 'resolved_server', 'resolved_merged']),
  resolvedValue: z.record(z.string(), z.unknown()).optional(),
});

export const syncDeltaQuerySchema = z.object({
  since: z.string().optional(),
  patientProfileId: z.string().uuid().optional(),
});

// ============================================================================
// Phase 8: Community Groups, Assistance & Moderation Schemas
// ============================================================================

export const createCommunityGroupSchema = z.object({
  name: z.string().min(3, 'Group name must be at least 3 characters').max(100),
  groupType: z.enum(['residential_society', 'apartment_building', 'neighborhood', 'other_local']),
  description: z.string().min(5, 'Description must be at least 5 characters').max(1000),
  approximateLocality: z.string().min(2, 'Approximate locality is required').max(100),
  organizationOrBuildingName: z.string().max(100).optional().nullable(),
  membershipPolicy: z.enum(['open', 'approval_required', 'invite_only']).default('open'),
  moderationPolicy: z.enum(['standard', 'strict']).default('standard'),
});

export const updateCommunityGroupSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  description: z.string().min(5).max(1000).optional(),
  approximateLocality: z.string().min(2).max(100).optional(),
  organizationOrBuildingName: z.string().max(100).optional().nullable(),
  membershipPolicy: z.enum(['open', 'approval_required', 'invite_only']).optional(),
  moderationPolicy: z.enum(['standard', 'strict']).optional(),
  status: z.enum(['active', 'closed', 'suspended']).optional(),
});

export const inviteCommunityMemberSchema = z.object({
  email: z.string().email('Valid email address is required'),
});

export const joinCommunityRequestSchema = z.object({
  notes: z.string().max(500).optional(),
});

export const reviewJoinRequestSchema = z.object({
  action: z.enum(['approve', 'reject']),
});

export const updateCommunityMemberRoleSchema = z.object({
  role: z.enum(['moderator', 'member']),
});

export const createAssistanceRequestSchema = z.object({
  requestCategory: z.enum([
    'grocery_supplies',
    'appointment_accompaniment',
    'transport_assistance',
    'errands',
    'welfare_check',
    'caregiver_contact',
    'other_support',
  ]),
  title: z.string().min(3, 'Title is required').max(150),
  description: z.string().min(5, 'Description is required').max(2000),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  intendedRecipientName: z.string().max(100).optional().nullable(),
  approximateLocality: z.string().min(2, 'Approximate locality is required').max(100),
  preferredDateTime: z.string().max(100).optional().nullable(),
  expiryHours: z.number().int().min(1).max(720).default(72),
  contactSharingConsent: z.boolean().default(false),
  contactPhone: z.string().max(30).optional().nullable(),
  contactAddress: z.string().max(255).optional().nullable(),
});

export const updateAssistanceStatusSchema = z.object({
  status: z.enum(['open', 'in_progress', 'completed', 'cancelled']),
});

export const assignVolunteerSchema = z.object({
  volunteerUserId: z.string().uuid('Valid volunteer user ID is required'),
});

export const createBloodDonorRequestSchema = z.object({
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'any']),
  unitsNeeded: z.number().int().min(1).max(20).default(1),
  approximateLocality: z.string().min(2, 'Approximate locality is required').max(100),
  hospitalName: z.string().max(150).optional().nullable(),
  requestedDateTime: z.string().max(100).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  expiryHours: z.number().int().min(1).max(168).default(48),
  contactPhone: z.string().max(30).optional().nullable(),
  contactSharingConsent: z.boolean().default(false),
});

export const createDonorResponseSchema = z.object({
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
  notes: z.string().max(500).optional().nullable(),
});

export const updateDonorResponseStatusSchema = z.object({
  status: z.enum(['interested', 'contacted', 'unavailable', 'referred_to_screening']),
  notes: z.string().max(500).optional().nullable(),
});

export const createCommunityReportSchema = z.object({
  targetType: z.enum(['assistance_request', 'blood_donor_request', 'member']),
  targetId: z.string().uuid('Valid target ID is required'),
  reasonCategory: z.enum([
    'suspicious',
    'spam',
    'harassment',
    'impersonation',
    'inappropriate_content',
    'unauthorized_phi',
    'fraud',
    'other',
  ]),
  details: z.string().min(5, 'Details are required').max(2000),
});

export const resolveCommunityReportSchema = z.object({
  status: z.enum(['under_review', 'action_required', 'resolved', 'dismissed']),
  decisionNotes: z.string().max(1000).optional().nullable(),
  actionTaken: z.enum(['content_hidden', 'member_warned', 'member_suspended', 'member_removed', 'dismissed']).optional(),
});



