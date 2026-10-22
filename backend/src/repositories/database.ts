/**
 * backend/src/repositories/database.ts
 *
 * Provides persistence across both Live Supabase and Demo/Scaffold Mode.
 * In DEMO_MODE, it maintains an in-memory transactional datastore that strictly mimics
 * PostgreSQL constraints, relationships, unique keys, and RLS checks.
 * In live mode, it leverages the Supabase service-role client.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';
import {
  UserProfile,
  Family,
  FamilyMembership,
  PatientProfile,
  CaregiverRelationship,
  MembershipRole,
  HealthDocument,
  DocumentExtraction,
  DocumentProcessingJob,
  DocumentCategory,
  DocumentProcessingStatus,
  DocumentReviewStatus,
  AIConversation,
  AIConversationMessage,
  DoctorSummaryRecord,
  MedicationSchedule,
  MedicationScheduleHistory,
  MedicationDoseOccurrence,
  DoseOccurrenceStatus,
  Appointment,
  Notification,
  NotificationPreference,
  CaregiverReminderPolicy,
  ScheduledJob,
  EmergencyContact,
  EmergencyEscalationPolicy,
  EmergencyIncident,
  EmergencyContactAttempt,
  EmergencyIncidentEvent,
  HospitalHandoff,
  LiveTestRecipient,
  LiveTestAuditLog,
  SyncOperation,
  SyncConflict,
  SyncConflictResolutionStatus,
  CommunityGroup,
  CommunityMembership,
  CommunityInvitation,
  CommunityJoinRequest,
  AssistanceRequest,
  AssistanceAssignment,
  BloodDonorRequest,
  DonorResponse,
  ContactSharingGrant,
  CommunityReport,
  ModerationAction,
} from '../types/models.js';

export interface DocumentSearchFilters {
  patientProfileId?: string;
  category?: DocumentCategory;
  processingStatus?: DocumentProcessingStatus;
  reviewStatus?: DocumentReviewStatus;
  query?: string;
  startDate?: string;
  endDate?: string;
}

export interface IDatabaseRepository {
  // Profiles / Auth
  findProfileById(id: string): Promise<UserProfile | null>;
  findProfileByEmail(email: string): Promise<UserProfile | null>;
  upsertProfile(profile: Partial<UserProfile> & { id: string; email: string }): Promise<UserProfile>;

  // Families
  createFamily(name: string, createdBy: string): Promise<{ family: Family; membership: FamilyMembership }>;
  getFamilyById(familyId: string): Promise<Family | null>;
  getUserFamilies(userId: string): Promise<Family[]>;
  updateFamilyName(familyId: string, name: string): Promise<Family>;
  deleteFamily(familyId: string): Promise<void>;

  // Memberships & Permissions
  getFamilyMemberships(familyId: string): Promise<FamilyMembership[]>;
  getUserMembership(familyId: string, userId: string): Promise<FamilyMembership | null>;
  addFamilyMembership(familyId: string, userId: string, role: MembershipRole): Promise<FamilyMembership>;
  updateMembershipRole(familyId: string, userId: string, role: MembershipRole): Promise<FamilyMembership>;
  removeFamilyMembership(familyId: string, userId: string): Promise<void>;

  // Patient Profiles
  createPatientProfile(profileData: Omit<PatientProfile, 'id' | 'created_at' | 'updated_at'>): Promise<PatientProfile>;
  getPatientProfileById(profileId: string): Promise<PatientProfile | null>;
  getPatientProfileByHealthId(healthId: string): Promise<PatientProfile | null>;
  getFamilyPatientProfiles(familyId: string): Promise<PatientProfile[]>;
  updatePatientProfile(profileId: string, updates: Partial<PatientProfile>): Promise<PatientProfile>;

  // Caregiver Relationships
  getCaregiverRelationships(familyId: string): Promise<CaregiverRelationship[]>;
  assignCaregiver(data: Omit<CaregiverRelationship, 'id' | 'created_at' | 'updated_at'>): Promise<CaregiverRelationship>;
  revokeCaregiver(relationshipId: string): Promise<void>;

  // Phase 2: Documents & Medical Records
  createDocument(doc: Omit<HealthDocument, 'id' | 'created_at' | 'updated_at'>): Promise<HealthDocument>;
  getDocumentById(documentId: string): Promise<HealthDocument | null>;
  findDocumentsByChecksum(patientProfileId: string, checksum: string): Promise<HealthDocument[]>;
  listFamilyDocuments(familyId: string, filters?: DocumentSearchFilters): Promise<HealthDocument[]>;
  updateDocument(documentId: string, updates: Partial<HealthDocument>): Promise<HealthDocument>;
  deleteDocument(documentId: string): Promise<void>;

  // Phase 2: OCR Extractions & Jobs
  upsertExtraction(data: Omit<DocumentExtraction, 'id' | 'created_at' | 'updated_at'>): Promise<DocumentExtraction>;
  getExtractionByDocumentId(documentId: string): Promise<DocumentExtraction | null>;
  createProcessingJob(job: Omit<DocumentProcessingJob, 'id' | 'created_at' | 'updated_at'>): Promise<DocumentProcessingJob>;
  getProcessingJobByDocumentId(documentId: string): Promise<DocumentProcessingJob | null>;
  updateProcessingJob(jobId: string, updates: Partial<DocumentProcessingJob>): Promise<DocumentProcessingJob>;

  // Phase 3: AI Conversations, Messages, & Doctor Summaries
  createConversation(data: Omit<AIConversation, 'id' | 'created_at' | 'updated_at'>): Promise<AIConversation>;
  getConversationById(conversationId: string): Promise<AIConversation | null>;
  listPatientConversations(patientProfileId: string): Promise<AIConversation[]>;
  createMessage(msg: Omit<AIConversationMessage, 'id' | 'created_at'>): Promise<AIConversationMessage>;
  getConversationMessages(conversationId: string): Promise<AIConversationMessage[]>;
  recordDoctorSummary(summary: Omit<DoctorSummaryRecord, 'id' | 'created_at'>): Promise<DoctorSummaryRecord>;
  listDoctorSummaries(patientProfileId: string): Promise<DoctorSummaryRecord[]>;

  // Phase 4: Medication Schedules, Doses, Appointments & Notifications
  createMedicationSchedule(schedule: Omit<MedicationSchedule, 'id' | 'created_at' | 'updated_at'>): Promise<MedicationSchedule>;
  getMedicationScheduleById(id: string): Promise<MedicationSchedule | null>;
  listMedicationSchedulesByPatient(patientProfileId: string, status?: string): Promise<MedicationSchedule[]>;
  updateMedicationSchedule(id: string, updates: Partial<MedicationSchedule>): Promise<MedicationSchedule>;
  recordMedicationScheduleHistory(history: Omit<MedicationScheduleHistory, 'id' | 'created_at'>): Promise<MedicationScheduleHistory>;
  getMedicationScheduleHistory(scheduleId: string): Promise<MedicationScheduleHistory[]>;

  createDoseOccurrences(occurrences: Omit<MedicationDoseOccurrence, 'id' | 'created_at' | 'updated_at'>[]): Promise<MedicationDoseOccurrence[]>;
  listDoseOccurrences(patientProfileId: string, startDate: string, endDate: string): Promise<MedicationDoseOccurrence[]>;
  getDoseOccurrenceById(id: string): Promise<MedicationDoseOccurrence | null>;
  updateDoseOccurrenceStatus(id: string, status: DoseOccurrenceStatus, acknowledgedBy?: string, note?: string): Promise<MedicationDoseOccurrence>;
  cancelFutureDoseOccurrences(scheduleId: string, fromDate: string): Promise<number>;

  createAppointment(appt: Omit<Appointment, 'id' | 'created_at' | 'updated_at'>): Promise<Appointment>;
  getAppointmentById(id: string): Promise<Appointment | null>;
  listAppointmentsByPatient(patientProfileId: string, status?: string): Promise<Appointment[]>;
  updateAppointment(id: string, updates: Partial<Appointment>): Promise<Appointment>;
  deleteAppointment(id: string): Promise<void>;

  getNotificationPreferences(userId: string, familyId: string): Promise<NotificationPreference | null>;
  upsertNotificationPreferences(prefs: Omit<NotificationPreference, 'id' | 'created_at' | 'updated_at'>): Promise<NotificationPreference>;

  getCaregiverPolicy(patientProfileId: string, caregiverUserId: string): Promise<CaregiverReminderPolicy | null>;
  listCaregiverPolicies(patientProfileId: string): Promise<CaregiverReminderPolicy[]>;
  upsertCaregiverPolicy(policy: Omit<CaregiverReminderPolicy, 'id' | 'created_at' | 'updated_at'>): Promise<CaregiverReminderPolicy>;

  createNotification(notif: Omit<Notification, 'id' | 'created_at' | 'updated_at'>): Promise<Notification>;
  getNotificationById(id: string): Promise<Notification | null>;
  listNotificationsForUser(userId: string, category?: string, status?: string): Promise<Notification[]>;
  updateNotification(id: string, updates: Partial<Notification>): Promise<Notification>;

  enqueueScheduledJob(job: Omit<ScheduledJob, 'id' | 'created_at' | 'updated_at'>): Promise<ScheduledJob>;
  fetchDueScheduledJobs(nowIso: string, limit?: number): Promise<ScheduledJob[]>;
  updateScheduledJob(id: string, updates: Partial<ScheduledJob>): Promise<ScheduledJob>;
  cancelScheduledJobsByReference(referenceId: string): Promise<number>;

  // Phase 5: SOS Emergency Response Simulation & Hospital Handoff
  createEmergencyContact(contact: Omit<EmergencyContact, 'id' | 'created_at' | 'updated_at'>): Promise<EmergencyContact>;
  getEmergencyContactById(id: string): Promise<EmergencyContact | null>;
  listEmergencyContacts(familyId: string, patientProfileId?: string): Promise<EmergencyContact[]>;
  updateEmergencyContact(id: string, updates: Partial<EmergencyContact>): Promise<EmergencyContact>;
  deleteEmergencyContact(id: string): Promise<void>;

  getEmergencyEscalationPolicy(familyId: string, patientProfileId: string): Promise<EmergencyEscalationPolicy | null>;
  upsertEmergencyEscalationPolicy(policy: Omit<EmergencyEscalationPolicy, 'id' | 'created_at' | 'updated_at'>): Promise<EmergencyEscalationPolicy>;

  createEmergencyIncident(incident: Omit<EmergencyIncident, 'id' | 'created_at' | 'updated_at'>): Promise<EmergencyIncident>;
  getEmergencyIncidentById(id: string): Promise<EmergencyIncident | null>;
  getActiveEmergencyIncident(familyId: string, patientProfileId: string): Promise<EmergencyIncident | null>;
  listEmergencyIncidents(familyId: string, patientProfileId?: string): Promise<EmergencyIncident[]>;
  updateEmergencyIncident(id: string, updates: Partial<EmergencyIncident>): Promise<EmergencyIncident>;

  createEmergencyContactAttempt(attempt: Omit<EmergencyContactAttempt, 'id' | 'created_at' | 'updated_at'>): Promise<EmergencyContactAttempt>;
  getEmergencyContactAttemptById(id: string): Promise<EmergencyContactAttempt | null>;
  listEmergencyContactAttempts(incidentId: string): Promise<EmergencyContactAttempt[]>;
  updateEmergencyContactAttempt(id: string, updates: Partial<EmergencyContactAttempt>): Promise<EmergencyContactAttempt>;

  createEmergencyIncidentEvent(event: Omit<EmergencyIncidentEvent, 'id' | 'created_at'>): Promise<EmergencyIncidentEvent>;
  listEmergencyIncidentEvents(incidentId: string): Promise<EmergencyIncidentEvent[]>;

  createHospitalHandoff(handoff: Omit<HospitalHandoff, 'id' | 'created_at' | 'updated_at'>): Promise<HospitalHandoff>;
  getHospitalHandoffByIncidentId(incidentId: string): Promise<HospitalHandoff | null>;
  updateHospitalHandoff(id: string, updates: Partial<HospitalHandoff>): Promise<HospitalHandoff>;

  resetEmergencyDemoScenario(familyId: string, patientProfileId: string): Promise<void>;

  // Phase 6: Controlled Live Test Mode & Telephony Audit Logs
  listLiveTestRecipients(familyId: string): Promise<LiveTestRecipient[]>;
  getLiveTestRecipient(id: string): Promise<LiveTestRecipient | null>;
  createLiveTestRecipient(recipient: Omit<LiveTestRecipient, 'id' | 'created_at' | 'updated_at'>): Promise<LiveTestRecipient>;
  updateLiveTestRecipient(id: string, updates: Partial<LiveTestRecipient>): Promise<LiveTestRecipient>;
  deleteLiveTestRecipient(id: string): Promise<void>;

  createLiveTestAuditLog(log: Omit<LiveTestAuditLog, 'id' | 'created_at' | 'updated_at'>): Promise<LiveTestAuditLog>;
  getLiveTestAuditLog(id: string): Promise<LiveTestAuditLog | null>;
  listLiveTestAuditLogs(familyId: string, incidentId?: string): Promise<LiveTestAuditLog[]>;
  updateLiveTestAuditLog(id: string, updates: Partial<LiveTestAuditLog>): Promise<LiveTestAuditLog>;
  getLiveTestAuditLogByProviderRequestId(providerRequestId: string): Promise<LiveTestAuditLog | null>;

  // Phase 7: Offline-First Health Records, Sync Operations & Conflict Resolution
  saveSyncOperation(op: Omit<SyncOperation, 'id' | 'created_at' | 'updated_at'>): Promise<SyncOperation>;
  getSyncOperationByClientOpId(familyId: string, clientOpId: string): Promise<SyncOperation | null>;
  getSyncOperationByIdempotencyKey(familyId: string, idempotencyKey: string): Promise<SyncOperation | null>;
  listSyncOperations(familyId: string, limit?: number): Promise<SyncOperation[]>;
  updateSyncOperation(id: string, updates: Partial<SyncOperation>): Promise<SyncOperation>;

  createSyncConflict(conflict: Omit<SyncConflict, 'id' | 'created_at' | 'updated_at'>): Promise<SyncConflict>;
  getSyncConflictById(id: string): Promise<SyncConflict | null>;
  listSyncConflicts(familyId: string, patientProfileId?: string, status?: SyncConflictResolutionStatus): Promise<SyncConflict[]>;
  resolveSyncConflict(id: string, resolution: SyncConflictResolutionStatus, resolvedBy: string, resolvedValue?: Record<string, unknown>): Promise<SyncConflict>;

  getChangesSince(familyId: string, sinceIso: string, patientProfileId?: string): Promise<{
    patients: PatientProfile[];
    documents: HealthDocument[];
    medications: MedicationSchedule[];
    appointments: Appointment[];
  }>;

  // Phase 8: Community Groups, Assistance & Moderation
  createCommunityGroup(group: Omit<CommunityGroup, 'id' | 'created_at' | 'updated_at'>): Promise<CommunityGroup>;
  getCommunityGroupById(id: string): Promise<CommunityGroup | null>;
  listCommunityGroupsForUser(userId: string): Promise<CommunityGroup[]>;
  listPublicCommunityGroups(locality?: string): Promise<CommunityGroup[]>;
  updateCommunityGroup(id: string, patch: Partial<CommunityGroup>): Promise<CommunityGroup>;

  createCommunityMembership(membership: Omit<CommunityMembership, 'id' | 'created_at' | 'updated_at' | 'joined_at'>): Promise<CommunityMembership>;
  getCommunityMembership(communityId: string, userId: string): Promise<CommunityMembership | null>;
  listCommunityMemberships(communityId: string): Promise<CommunityMembership[]>;
  updateCommunityMembership(id: string, patch: Partial<CommunityMembership>): Promise<CommunityMembership>;
  deleteCommunityMembership(id: string): Promise<void>;

  createCommunityInvitation(invitation: Omit<CommunityInvitation, 'id' | 'created_at' | 'updated_at'>): Promise<CommunityInvitation>;
  getCommunityInvitationByCode(code: string): Promise<CommunityInvitation | null>;
  getCommunityInvitationById(id: string): Promise<CommunityInvitation | null>;
  listCommunityInvitationsForUser(email: string): Promise<CommunityInvitation[]>;
  listCommunityInvitationsForGroup(communityId: string): Promise<CommunityInvitation[]>;
  updateCommunityInvitation(id: string, patch: Partial<CommunityInvitation>): Promise<CommunityInvitation>;

  createCommunityJoinRequest(req: Omit<CommunityJoinRequest, 'id' | 'created_at' | 'updated_at'>): Promise<CommunityJoinRequest>;
  getCommunityJoinRequestById(id: string): Promise<CommunityJoinRequest | null>;
  listCommunityJoinRequests(communityId: string, status?: string): Promise<CommunityJoinRequest[]>;
  updateCommunityJoinRequest(id: string, patch: Partial<CommunityJoinRequest>): Promise<CommunityJoinRequest>;

  createAssistanceRequest(req: Omit<AssistanceRequest, 'id' | 'created_at' | 'updated_at'>): Promise<AssistanceRequest>;
  getAssistanceRequestById(id: string): Promise<AssistanceRequest | null>;
  listAssistanceRequests(communityId: string, filter?: { category?: string; status?: string }): Promise<AssistanceRequest[]>;
  updateAssistanceRequest(id: string, patch: Partial<AssistanceRequest>): Promise<AssistanceRequest>;

  createAssistanceAssignment(assign: Omit<AssistanceAssignment, 'id' | 'created_at' | 'updated_at'>): Promise<AssistanceAssignment>;
  getAssistanceAssignment(requestId: string, volunteerUserId: string): Promise<AssistanceAssignment | null>;
  listAssistanceAssignments(requestId: string): Promise<AssistanceAssignment[]>;
  updateAssistanceAssignment(id: string, patch: Partial<AssistanceAssignment>): Promise<AssistanceAssignment>;

  createBloodDonorRequest(req: Omit<BloodDonorRequest, 'id' | 'created_at' | 'updated_at'>): Promise<BloodDonorRequest>;
  getBloodDonorRequestById(id: string): Promise<BloodDonorRequest | null>;
  listBloodDonorRequests(communityId: string, filter?: { bloodGroup?: string; status?: string }): Promise<BloodDonorRequest[]>;
  updateBloodDonorRequest(id: string, patch: Partial<BloodDonorRequest>): Promise<BloodDonorRequest>;

  createDonorResponse(resp: Omit<DonorResponse, 'id' | 'created_at' | 'updated_at'>): Promise<DonorResponse>;
  getDonorResponse(requestId: string, donorUserId: string): Promise<DonorResponse | null>;
  listDonorResponses(requestId: string): Promise<DonorResponse[]>;
  updateDonorResponse(id: string, patch: Partial<DonorResponse>): Promise<DonorResponse>;

  createContactGrant(grant: Omit<ContactSharingGrant, 'id' | 'created_at'>): Promise<ContactSharingGrant>;
  getContactGrant(resourceType: string, resourceId: string, grantedToUserId: string): Promise<ContactSharingGrant | null>;
  listContactGrants(resourceType: string, resourceId: string): Promise<ContactSharingGrant[]>;
  revokeContactGrant(id: string): Promise<ContactSharingGrant>;

  createCommunityReport(report: Omit<CommunityReport, 'id' | 'created_at' | 'updated_at'>): Promise<CommunityReport>;
  getCommunityReportById(id: string): Promise<CommunityReport | null>;
  listCommunityReports(communityId: string, status?: string): Promise<CommunityReport[]>;
  updateCommunityReport(id: string, patch: Partial<CommunityReport>): Promise<CommunityReport>;
  createModerationAction(action: Omit<ModerationAction, 'id' | 'created_at'>): Promise<ModerationAction>;
  listModerationActions(communityId: string): Promise<ModerationAction[]>;

  // Demo Auth Helpers (only used when DEMO_MODE is true)
  authenticateDemoUser(email: string, passwordHashOrPlain: string): Promise<UserProfile | null>;
  registerDemoUser(email: string, passwordHashOrPlain: string, fullName: string, phone?: string): Promise<UserProfile>;
}

// -----------------------------------------------------------------------------
// In-Memory Database Implementation (Deterministic, strict relational rules)
// -----------------------------------------------------------------------------
class InMemoryDatabaseRepository implements IDatabaseRepository {
  private users = new Map<string, { profile: UserProfile; password: string }>();
  private families = new Map<string, Family>();
  private memberships = new Map<string, FamilyMembership>();
  private patientProfiles = new Map<string, PatientProfile>();
  private caregiverRelations = new Map<string, CaregiverRelationship>();
  private documents = new Map<string, HealthDocument>();
  private extractions = new Map<string, DocumentExtraction>();
  private jobs = new Map<string, DocumentProcessingJob>();
  private conversations = new Map<string, AIConversation>();
  private messages = new Map<string, AIConversationMessage>();
  private doctorSummaries = new Map<string, DoctorSummaryRecord>();
  private medicationSchedules = new Map<string, MedicationSchedule>();
  private medicationHistory = new Map<string, MedicationScheduleHistory>();
  private doseOccurrences = new Map<string, MedicationDoseOccurrence>();
  private appointments = new Map<string, Appointment>();
  private notificationPreferences = new Map<string, NotificationPreference>();
  private caregiverPolicies = new Map<string, CaregiverReminderPolicy>();
  private notifications = new Map<string, Notification>();
  private scheduledJobs = new Map<string, ScheduledJob>();
  private emergencyContacts = new Map<string, EmergencyContact>();
  private emergencyPolicies = new Map<string, EmergencyEscalationPolicy>();
  private emergencyIncidents = new Map<string, EmergencyIncident>();
  private emergencyContactAttempts = new Map<string, EmergencyContactAttempt>();
  private emergencyIncidentEvents = new Map<string, EmergencyIncidentEvent>();
  private hospitalHandoffs = new Map<string, HospitalHandoff>();
  private liveTestRecipients = new Map<string, LiveTestRecipient>();
  private liveTestAuditLogs = new Map<string, LiveTestAuditLog>();
  private syncOperations = new Map<string, SyncOperation>();
  private syncConflicts = new Map<string, SyncConflict>();
  private communityGroups = new Map<string, CommunityGroup>();
  private communityMemberships = new Map<string, CommunityMembership>();
  private communityInvitations = new Map<string, CommunityInvitation>();
  private communityJoinRequests = new Map<string, CommunityJoinRequest>();
  private assistanceRequests = new Map<string, AssistanceRequest>();
  private assistanceAssignments = new Map<string, AssistanceAssignment>();
  private bloodDonorRequests = new Map<string, BloodDonorRequest>();
  private donorResponses = new Map<string, DonorResponse>();
  private contactGrants = new Map<string, ContactSharingGrant>();
  private communityReports = new Map<string, CommunityReport>();
  private moderationActions = new Map<string, ModerationAction>();

  constructor() {
    logger.info('[Database] Initialized In-Memory relational datastore for development/demo mode.');

    // Pre-seed demo presenter account and family workspace for immediate local testing
    const demoUserId = 'demo-user-id-sanjivani-0001';
    const now = new Date().toISOString();
    this.users.set(demoUserId, {
      profile: {
        id: demoUserId,
        email: 'demo@sanjivani.health',
        full_name: 'Dr. Vikram Sharma',
        phone: '+919876543210',
        avatar_url: null,
        created_at: now,
        updated_at: now,
      },
      password: 'DemoPassword123!',
    });

    const demoFamilyId = 'demo-family-id-0001';
    this.families.set(demoFamilyId, {
      id: demoFamilyId,
      name: 'Sharma Family Health Workspace',
      created_by: demoUserId,
      created_at: now,
      updated_at: now,
    });

    const demoMembershipId = 'demo-membership-id-0001';
    this.memberships.set(demoMembershipId, {
      id: demoMembershipId,
      family_id: demoFamilyId,
      user_id: demoUserId,
      role: 'owner',
      status: 'active',
      created_at: now,
      updated_at: now,
    });

    const demoPatientId = 'demo-patient-id-0001';
    this.patientProfiles.set(demoPatientId, {
      id: demoPatientId,
      family_id: demoFamilyId,
      health_id: 'SNJ-2026-9481-4402',
      full_name: 'Ramesh Verma',
      gender: 'male',
      date_of_birth: '1958-05-12',
      relationship_to_creator: 'father',
      category: 'elderly',
      avatar_url: null,
      status: 'active',
      created_by: demoUserId,
      created_at: now,
      updated_at: now,
    });
  }

  async findProfileById(id: string): Promise<UserProfile | null> {
    const user = this.users.get(id);
    return user ? { ...user.profile } : null;
  }

  async findProfileByEmail(email: string): Promise<UserProfile | null> {
    const normalized = email.toLowerCase().trim();
    for (const user of this.users.values()) {
      if (user.profile.email.toLowerCase().trim() === normalized) {
        return { ...user.profile };
      }
    }
    return null;
  }

  async upsertProfile(data: Partial<UserProfile> & { id: string; email: string }): Promise<UserProfile> {
    const existing = this.users.get(data.id);
    const now = new Date().toISOString();
    const updatedProfile: UserProfile = {
      id: data.id,
      email: data.email,
      full_name: data.full_name ?? existing?.profile.full_name ?? '',
      phone: data.phone ?? existing?.profile.phone ?? null,
      avatar_url: data.avatar_url ?? existing?.profile.avatar_url ?? null,
      created_at: existing?.profile.created_at ?? now,
      updated_at: now,
    };
    this.users.set(data.id, {
      profile: updatedProfile,
      password: existing?.password ?? 'demo-password',
    });
    return { ...updatedProfile };
  }

  async createFamily(name: string, createdBy: string): Promise<{ family: Family; membership: FamilyMembership }> {
    const now = new Date().toISOString();
    const familyId = crypto.randomUUID();
    const family: Family = {
      id: familyId,
      name,
      created_by: createdBy,
      created_at: now,
      updated_at: now,
    };
    this.families.set(familyId, family);

    const membershipId = crypto.randomUUID();
    const membership: FamilyMembership = {
      id: membershipId,
      family_id: familyId,
      user_id: createdBy,
      role: 'owner',
      status: 'active',
      created_at: now,
      updated_at: now,
    };
    this.memberships.set(membershipId, membership);

    return { family: { ...family }, membership: { ...membership } };
  }

  async getFamilyById(familyId: string): Promise<Family | null> {
    const f = this.families.get(familyId);
    return f ? { ...f } : null;
  }

  async getUserFamilies(userId: string): Promise<Family[]> {
    const familyIds = new Set<string>();
    for (const m of this.memberships.values()) {
      if (m.user_id === userId && m.status === 'active') {
        familyIds.add(m.family_id);
      }
    }
    const results: Family[] = [];
    for (const fId of familyIds) {
      const f = this.families.get(fId);
      if (f) results.push({ ...f });
    }
    return results;
  }

  async updateFamilyName(familyId: string, name: string): Promise<Family> {
    const f = this.families.get(familyId);
    if (!f) throw new Error('Family not found');
    const updated: Family = { ...f, name, updated_at: new Date().toISOString() };
    this.families.set(familyId, updated);
    return { ...updated };
  }

  async deleteFamily(familyId: string): Promise<void> {
    this.families.delete(familyId);
    for (const [id, m] of this.memberships.entries()) {
      if (m.family_id === familyId) this.memberships.delete(id);
    }
    for (const [id, p] of this.patientProfiles.entries()) {
      if (p.family_id === familyId) this.patientProfiles.delete(id);
    }
    for (const [id, d] of this.documents.entries()) {
      if (d.family_id === familyId) this.documents.delete(id);
    }
  }

  async getFamilyMemberships(familyId: string): Promise<FamilyMembership[]> {
    const res: FamilyMembership[] = [];
    for (const m of this.memberships.values()) {
      if (m.family_id === familyId) {
        const userRec = this.users.get(m.user_id);
        res.push({
          ...m,
          user: userRec ? { ...userRec.profile } : undefined,
        });
      }
    }
    return res;
  }

  async getUserMembership(familyId: string, userId: string): Promise<FamilyMembership | null> {
    for (const m of this.memberships.values()) {
      if (m.family_id === familyId && m.user_id === userId) {
        const userRec = this.users.get(m.user_id);
        return {
          ...m,
          user: userRec ? { ...userRec.profile } : undefined,
        };
      }
    }
    return null;
  }

  async addFamilyMembership(familyId: string, userId: string, role: MembershipRole): Promise<FamilyMembership> {
    const existing = await this.getUserMembership(familyId, userId);
    if (existing) {
      throw new Error('User is already a member of this family workspace');
    }
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const membership: FamilyMembership = {
      id,
      family_id: familyId,
      user_id: userId,
      role,
      status: 'active',
      created_at: now,
      updated_at: now,
    };
    this.memberships.set(id, membership);
    const userRec = this.users.get(userId);
    return { ...membership, user: userRec ? { ...userRec.profile } : undefined };
  }

  async updateMembershipRole(familyId: string, userId: string, role: MembershipRole): Promise<FamilyMembership> {
    for (const [id, m] of this.memberships.entries()) {
      if (m.family_id === familyId && m.user_id === userId) {
        const updated: FamilyMembership = { ...m, role, updated_at: new Date().toISOString() };
        this.memberships.set(id, updated);
        const userRec = this.users.get(userId);
        return { ...updated, user: userRec ? { ...userRec.profile } : undefined };
      }
    }
    throw new Error('Membership not found');
  }

  async removeFamilyMembership(familyId: string, userId: string): Promise<void> {
    for (const [id, m] of this.memberships.entries()) {
      if (m.family_id === familyId && m.user_id === userId) {
        this.memberships.delete(id);
        return;
      }
    }
  }

  async createPatientProfile(profileData: Omit<PatientProfile, 'id' | 'created_at' | 'updated_at'>): Promise<PatientProfile> {
    for (const p of this.patientProfiles.values()) {
      if (p.health_id === profileData.health_id) {
        throw new Error(`Patient with Health ID ${profileData.health_id} already exists`);
      }
    }
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const profile: PatientProfile = {
      ...profileData,
      id,
      created_at: now,
      updated_at: now,
    };
    this.patientProfiles.set(id, profile);
    return { ...profile };
  }

  async getPatientProfileById(profileId: string): Promise<PatientProfile | null> {
    const p = this.patientProfiles.get(profileId);
    return p ? { ...p } : null;
  }

  async getPatientProfileByHealthId(healthId: string): Promise<PatientProfile | null> {
    for (const p of this.patientProfiles.values()) {
      if (p.health_id === healthId) {
        return { ...p };
      }
    }
    return null;
  }

  async getFamilyPatientProfiles(familyId: string): Promise<PatientProfile[]> {
    const list: PatientProfile[] = [];
    for (const p of this.patientProfiles.values()) {
      if (p.family_id === familyId && p.status === 'active') {
        list.push({ ...p });
      }
    }
    return list;
  }

  async updatePatientProfile(profileId: string, updates: Partial<PatientProfile>): Promise<PatientProfile> {
    const existing = this.patientProfiles.get(profileId);
    if (!existing) throw new Error('Patient profile not found');

    const allowedUpdates = { ...updates };
    delete allowedUpdates.id;
    delete allowedUpdates.health_id;
    delete allowedUpdates.family_id;

    const updated: PatientProfile = {
      ...existing,
      ...allowedUpdates,
      updated_at: new Date().toISOString(),
    };
    this.patientProfiles.set(profileId, updated);
    return { ...updated };
  }

  async getCaregiverRelationships(familyId: string): Promise<CaregiverRelationship[]> {
    const res: CaregiverRelationship[] = [];
    for (const c of this.caregiverRelations.values()) {
      if (c.family_id === familyId) res.push({ ...c });
    }
    return res;
  }

  async assignCaregiver(data: Omit<CaregiverRelationship, 'id' | 'created_at' | 'updated_at'>): Promise<CaregiverRelationship> {
    for (const c of this.caregiverRelations.values()) {
      if (c.caregiver_user_id === data.caregiver_user_id && c.patient_profile_id === data.patient_profile_id) {
        throw new Error('Caregiver assignment already exists for this patient');
      }
    }
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const relation: CaregiverRelationship = {
      ...data,
      id,
      created_at: now,
      updated_at: now,
    };
    this.caregiverRelations.set(id, relation);
    return { ...relation };
  }

  async revokeCaregiver(relationshipId: string): Promise<void> {
    this.caregiverRelations.delete(relationshipId);
  }

  // ---------------------------------------------------------------------------
  // Phase 2: Document Management (In-Memory)
  // ---------------------------------------------------------------------------

  async createDocument(docData: Omit<HealthDocument, 'id' | 'created_at' | 'updated_at'>): Promise<HealthDocument> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const document: HealthDocument = {
      ...docData,
      id,
      created_at: now,
      updated_at: now,
    };
    this.documents.set(id, document);
    return { ...document };
  }

  async getDocumentById(documentId: string): Promise<HealthDocument | null> {
    const doc = this.documents.get(documentId);
    return doc ? { ...doc } : null;
  }

  async findDocumentsByChecksum(patientProfileId: string, checksum: string): Promise<HealthDocument[]> {
    const matches: HealthDocument[] = [];
    for (const doc of this.documents.values()) {
      if (doc.patient_profile_id === patientProfileId && doc.file_checksum === checksum) {
        matches.push({ ...doc });
      }
    }
    return matches;
  }

  async listFamilyDocuments(familyId: string, filters?: DocumentSearchFilters): Promise<HealthDocument[]> {
    let docs = Array.from(this.documents.values()).filter((d) => d.family_id === familyId);

    if (filters?.patientProfileId) {
      docs = docs.filter((d) => d.patient_profile_id === filters.patientProfileId);
    }
    if (filters?.category) {
      docs = docs.filter((d) => d.category === filters.category);
    }
    if (filters?.processingStatus) {
      docs = docs.filter((d) => d.processing_status === filters.processingStatus);
    }
    if (filters?.reviewStatus) {
      docs = docs.filter((d) => d.review_status === filters.reviewStatus);
    }
    if (filters?.startDate) {
      docs = docs.filter((d) => (d.document_date || d.created_at) >= filters.startDate!);
    }
    if (filters?.endDate) {
      docs = docs.filter((d) => (d.document_date || d.created_at) <= filters.endDate!);
    }
    if (filters?.query) {
      const q = filters.query.toLowerCase().trim();
      docs = docs.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.original_filename.toLowerCase().includes(q) ||
          d.category.toLowerCase().includes(q)
      );
    }

    return docs.sort((a, b) => {
      const dateA = a.document_date || a.created_at;
      const dateB = b.document_date || b.created_at;
      return dateB.localeCompare(dateA);
    });
  }

  async updateDocument(documentId: string, updates: Partial<HealthDocument>): Promise<HealthDocument> {
    const existing = this.documents.get(documentId);
    if (!existing) throw new Error('Document not found');
    const updated: HealthDocument = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.documents.set(documentId, updated);
    return { ...updated };
  }

  async deleteDocument(documentId: string): Promise<void> {
    this.documents.delete(documentId);
    for (const [id, ext] of this.extractions.entries()) {
      if (ext.document_id === documentId) this.extractions.delete(id);
    }
    for (const [id, job] of this.jobs.entries()) {
      if (job.document_id === documentId) this.jobs.delete(id);
    }
  }

  // ---------------------------------------------------------------------------
  // Phase 2: OCR Extractions & Jobs (In-Memory)
  // ---------------------------------------------------------------------------

  async upsertExtraction(data: Omit<DocumentExtraction, 'id' | 'created_at' | 'updated_at'>): Promise<DocumentExtraction> {
    const now = new Date().toISOString();
    let existingId: string | undefined;
    for (const [id, ext] of this.extractions.entries()) {
      if (ext.document_id === data.document_id) {
        existingId = id;
        break;
      }
    }

    const id = existingId ?? crypto.randomUUID();
    const prev = existingId ? this.extractions.get(existingId) : undefined;
    const extraction: DocumentExtraction = {
      ...data,
      id,
      created_at: prev?.created_at ?? now,
      updated_at: now,
    };
    this.extractions.set(id, extraction);
    return { ...extraction };
  }

  async getExtractionByDocumentId(documentId: string): Promise<DocumentExtraction | null> {
    for (const ext of this.extractions.values()) {
      if (ext.document_id === documentId) {
        return { ...ext };
      }
    }
    return null;
  }

  async createProcessingJob(jobData: Omit<DocumentProcessingJob, 'id' | 'created_at' | 'updated_at'>): Promise<DocumentProcessingJob> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const job: DocumentProcessingJob = {
      ...jobData,
      id,
      created_at: now,
      updated_at: now,
    };
    this.jobs.set(id, job);
    return { ...job };
  }

  async getProcessingJobByDocumentId(documentId: string): Promise<DocumentProcessingJob | null> {
    for (const job of this.jobs.values()) {
      if (job.document_id === documentId) {
        return { ...job };
      }
    }
    return null;
  }

  async updateProcessingJob(jobId: string, updates: Partial<DocumentProcessingJob>): Promise<DocumentProcessingJob> {
    const existing = this.jobs.get(jobId);
    if (!existing) throw new Error('Processing job not found');
    const updated: DocumentProcessingJob = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.jobs.set(jobId, updated);
    return { ...updated };
  }

  // ---------------------------------------------------------------------------
  // Phase 3: AI Conversations, Messages, & Doctor Summaries (In-Memory)
  // ---------------------------------------------------------------------------

  async createConversation(data: Omit<AIConversation, 'id' | 'created_at' | 'updated_at'>): Promise<AIConversation> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const conv: AIConversation = {
      ...data,
      id,
      created_at: now,
      updated_at: now,
    };
    this.conversations.set(id, conv);
    return { ...conv };
  }

  async getConversationById(conversationId: string): Promise<AIConversation | null> {
    const c = this.conversations.get(conversationId);
    return c ? { ...c } : null;
  }

  async listPatientConversations(patientProfileId: string): Promise<AIConversation[]> {
    const list: AIConversation[] = [];
    for (const c of this.conversations.values()) {
      if (c.patient_profile_id === patientProfileId) {
        list.push({ ...c });
      }
    }
    return list.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }

  async createMessage(msgData: Omit<AIConversationMessage, 'id' | 'created_at'>): Promise<AIConversationMessage> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const message: AIConversationMessage = {
      ...msgData,
      id,
      created_at: now,
    };
    this.messages.set(id, message);

    // Update conversation timestamp
    const conv = this.conversations.get(msgData.conversation_id);
    if (conv) {
      conv.updated_at = now;
      this.conversations.set(conv.id, conv);
    }

    return { ...message };
  }

  async getConversationMessages(conversationId: string): Promise<AIConversationMessage[]> {
    const list: AIConversationMessage[] = [];
    for (const m of this.messages.values()) {
      if (m.conversation_id === conversationId) {
        list.push({ ...m });
      }
    }
    return list.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  async recordDoctorSummary(summaryData: Omit<DoctorSummaryRecord, 'id' | 'created_at'>): Promise<DoctorSummaryRecord> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const record: DoctorSummaryRecord = {
      ...summaryData,
      id,
      created_at: now,
    };
    this.doctorSummaries.set(id, record);
    return { ...record };
  }

  async listDoctorSummaries(patientProfileId: string): Promise<DoctorSummaryRecord[]> {
    const list: DoctorSummaryRecord[] = [];
    for (const s of this.doctorSummaries.values()) {
      if (s.patient_profile_id === patientProfileId) {
        list.push({ ...s });
      }
    }
    return list.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  // ---------------------------------------------------------------------------
  // Phase 4: Medication Schedules, Doses, Appointments & Notifications (In-Memory)
  // ---------------------------------------------------------------------------

  async createMedicationSchedule(
    scheduleData: Omit<MedicationSchedule, 'id' | 'created_at' | 'updated_at'>
  ): Promise<MedicationSchedule> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const record: MedicationSchedule = {
      ...scheduleData,
      id,
      created_at: now,
      updated_at: now,
    };
    this.medicationSchedules.set(id, record);
    return { ...record };
  }

  async getMedicationScheduleById(id: string): Promise<MedicationSchedule | null> {
    const item = this.medicationSchedules.get(id);
    return item ? { ...item } : null;
  }

  async listMedicationSchedulesByPatient(
    patientProfileId: string,
    status?: string
  ): Promise<MedicationSchedule[]> {
    const list: MedicationSchedule[] = [];
    for (const item of this.medicationSchedules.values()) {
      if (item.patient_profile_id === patientProfileId) {
        if (!status || item.status === status) {
          list.push({ ...item });
        }
      }
    }
    return list.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async updateMedicationSchedule(
    id: string,
    updates: Partial<MedicationSchedule>
  ): Promise<MedicationSchedule> {
    const existing = this.medicationSchedules.get(id);
    if (!existing) throw new Error('Medication schedule not found');
    const now = new Date().toISOString();
    const updated: MedicationSchedule = {
      ...existing,
      ...updates,
      updated_at: now,
    };
    this.medicationSchedules.set(id, updated);
    return { ...updated };
  }

  async recordMedicationScheduleHistory(
    historyData: Omit<MedicationScheduleHistory, 'id' | 'created_at'>
  ): Promise<MedicationScheduleHistory> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const record: MedicationScheduleHistory = {
      ...historyData,
      id,
      created_at: now,
    };
    this.medicationHistory.set(id, record);
    return { ...record };
  }

  async getMedicationScheduleHistory(scheduleId: string): Promise<MedicationScheduleHistory[]> {
    const list: MedicationScheduleHistory[] = [];
    for (const item of this.medicationHistory.values()) {
      if (item.schedule_id === scheduleId) {
        list.push({ ...item });
      }
    }
    return list.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async createDoseOccurrences(
    occurrences: Omit<MedicationDoseOccurrence, 'id' | 'created_at' | 'updated_at'>[]
  ): Promise<MedicationDoseOccurrence[]> {
    const now = new Date().toISOString();
    const createdList: MedicationDoseOccurrence[] = [];

    for (const occ of occurrences) {
      // Check unique constraint: (schedule_id, scheduled_date, scheduled_time)
      let foundExistingKey: string | null = null;
      for (const [k, existing] of this.doseOccurrences.entries()) {
        if (
          existing.schedule_id === occ.schedule_id &&
          existing.scheduled_date === occ.scheduled_date &&
          existing.scheduled_time === occ.scheduled_time
        ) {
          foundExistingKey = k;
          break;
        }
      }

      if (foundExistingKey) {
        // Skip duplicate occurrence to preserve idempotency
        continue;
      }

      const id = crypto.randomUUID();
      const record: MedicationDoseOccurrence = {
        ...occ,
        id,
        created_at: now,
        updated_at: now,
      };
      this.doseOccurrences.set(id, record);
      createdList.push({ ...record });
    }

    return createdList;
  }

  async listDoseOccurrences(
    patientProfileId: string,
    startDate: string,
    endDate: string
  ): Promise<MedicationDoseOccurrence[]> {
    const list: MedicationDoseOccurrence[] = [];
    for (const occ of this.doseOccurrences.values()) {
      if (
        occ.patient_profile_id === patientProfileId &&
        occ.scheduled_date >= startDate &&
        occ.scheduled_date <= endDate
      ) {
        const schedule = this.medicationSchedules.get(occ.schedule_id);
        list.push({
          ...occ,
          schedule: schedule ? { ...schedule } : undefined,
        });
      }
    }
    return list.sort((a, b) => a.scheduled_datetime.localeCompare(b.scheduled_datetime));
  }

  async getDoseOccurrenceById(id: string): Promise<MedicationDoseOccurrence | null> {
    const occ = this.doseOccurrences.get(id);
    if (!occ) return null;
    const schedule = this.medicationSchedules.get(occ.schedule_id);
    return {
      ...occ,
      schedule: schedule ? { ...schedule } : undefined,
    };
  }

  async updateDoseOccurrenceStatus(
    id: string,
    status: DoseOccurrenceStatus,
    acknowledgedBy?: string,
    note?: string
  ): Promise<MedicationDoseOccurrence> {
    const occ = this.doseOccurrences.get(id);
    if (!occ) throw new Error('Dose occurrence not found');
    const now = new Date().toISOString();
    const updated: MedicationDoseOccurrence = {
      ...occ,
      status,
      acknowledged_at: ['taken', 'skipped', 'missed'].includes(status)
        ? now
        : status === 'scheduled'
        ? null
        : occ.acknowledged_at,
      acknowledged_by: status === 'scheduled' ? null : (acknowledgedBy || occ.acknowledged_by),
      acknowledgement_note: status === 'scheduled' ? null : (note !== undefined ? note : occ.acknowledgement_note),
      updated_at: now,
    };
    this.doseOccurrences.set(id, updated);
    return { ...updated };
  }

  async cancelFutureDoseOccurrences(scheduleId: string, fromDate: string): Promise<number> {
    let count = 0;
    for (const [id, occ] of this.doseOccurrences.entries()) {
      if (
        occ.schedule_id === scheduleId &&
        occ.scheduled_date >= fromDate &&
        occ.status === 'scheduled'
      ) {
        this.doseOccurrences.delete(id);
        count++;
      }
    }
    return count;
  }

  async createAppointment(
    apptData: Omit<Appointment, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Appointment> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const record: Appointment = {
      ...apptData,
      id,
      created_at: now,
      updated_at: now,
    };
    this.appointments.set(id, record);
    return { ...record };
  }

  async getAppointmentById(id: string): Promise<Appointment | null> {
    const item = this.appointments.get(id);
    return item ? { ...item } : null;
  }

  async listAppointmentsByPatient(
    patientProfileId: string,
    status?: string
  ): Promise<Appointment[]> {
    const list: Appointment[] = [];
    for (const item of this.appointments.values()) {
      if (item.patient_profile_id === patientProfileId) {
        if (!status || item.status === status) {
          list.push({ ...item });
        }
      }
    }
    return list.sort((a, b) => {
      const dtA = `${a.appointment_date}T${a.appointment_time || '00:00'}`;
      const dtB = `${b.appointment_date}T${b.appointment_time || '00:00'}`;
      return dtA.localeCompare(dtB);
    });
  }

  async updateAppointment(id: string, updates: Partial<Appointment>): Promise<Appointment> {
    const existing = this.appointments.get(id);
    if (!existing) throw new Error('Appointment not found');
    const now = new Date().toISOString();
    const updated: Appointment = {
      ...existing,
      ...updates,
      updated_at: now,
    };
    this.appointments.set(id, updated);
    return { ...updated };
  }

  async deleteAppointment(id: string): Promise<void> {
    this.appointments.delete(id);
  }

  async getNotificationPreferences(
    userId: string,
    familyId: string
  ): Promise<NotificationPreference | null> {
    const key = `${userId}_${familyId}`;
    const pref = this.notificationPreferences.get(key);
    return pref ? { ...pref } : null;
  }

  async upsertNotificationPreferences(
    prefs: Omit<NotificationPreference, 'id' | 'created_at' | 'updated_at'>
  ): Promise<NotificationPreference> {
    const key = `${prefs.user_id}_${prefs.family_id}`;
    const existing = this.notificationPreferences.get(key);
    const now = new Date().toISOString();
    const id = existing ? existing.id : crypto.randomUUID();
    const record: NotificationPreference = {
      ...prefs,
      id,
      created_at: existing ? existing.created_at : now,
      updated_at: now,
    };
    this.notificationPreferences.set(key, record);
    return { ...record };
  }

  async getCaregiverPolicy(
    patientProfileId: string,
    caregiverUserId: string
  ): Promise<CaregiverReminderPolicy | null> {
    const key = `${patientProfileId}_${caregiverUserId}`;
    const pol = this.caregiverPolicies.get(key);
    return pol ? { ...pol } : null;
  }

  async listCaregiverPolicies(patientProfileId: string): Promise<CaregiverReminderPolicy[]> {
    const list: CaregiverReminderPolicy[] = [];
    for (const p of this.caregiverPolicies.values()) {
      if (p.patient_profile_id === patientProfileId) {
        list.push({ ...p });
      }
    }
    return list;
  }

  async upsertCaregiverPolicy(
    policy: Omit<CaregiverReminderPolicy, 'id' | 'created_at' | 'updated_at'>
  ): Promise<CaregiverReminderPolicy> {
    const key = `${policy.patient_profile_id}_${policy.caregiver_user_id}`;
    const existing = this.caregiverPolicies.get(key);
    const now = new Date().toISOString();
    const id = existing ? existing.id : crypto.randomUUID();
    const record: CaregiverReminderPolicy = {
      ...policy,
      id,
      created_at: existing ? existing.created_at : now,
      updated_at: now,
    };
    this.caregiverPolicies.set(key, record);
    return { ...record };
  }

  async createNotification(
    notifData: Omit<Notification, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Notification> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const record: Notification = {
      ...notifData,
      id,
      created_at: now,
      updated_at: now,
    };
    this.notifications.set(id, record);
    return { ...record };
  }

  async getNotificationById(id: string): Promise<Notification | null> {
    const n = this.notifications.get(id);
    return n ? { ...n } : null;
  }

  async listNotificationsForUser(
    userId: string,
    category?: string,
    status?: string
  ): Promise<Notification[]> {
    const list: Notification[] = [];
    for (const n of this.notifications.values()) {
      if (n.recipient_user_id === userId) {
        if (category && n.category !== category) continue;
        if (status && n.status !== status) continue;
        list.push({ ...n });
      }
    }
    return list.sort((a, b) => b.scheduled_for.localeCompare(a.scheduled_for));
  }

  async updateNotification(id: string, updates: Partial<Notification>): Promise<Notification> {
    const existing = this.notifications.get(id);
    if (!existing) throw new Error('Notification not found');
    const now = new Date().toISOString();
    const updated: Notification = {
      ...existing,
      ...updates,
      updated_at: now,
    };
    this.notifications.set(id, updated);
    return { ...updated };
  }

  async enqueueScheduledJob(
    jobData: Omit<ScheduledJob, 'id' | 'created_at' | 'updated_at'>
  ): Promise<ScheduledJob> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const record: ScheduledJob = {
      ...jobData,
      id,
      created_at: now,
      updated_at: now,
    };
    this.scheduledJobs.set(id, record);
    return { ...record };
  }

  async fetchDueScheduledJobs(nowIso: string, limit = 50): Promise<ScheduledJob[]> {
    const due: ScheduledJob[] = [];
    for (const job of this.scheduledJobs.values()) {
      if (job.status === 'pending' && job.scheduled_at <= nowIso) {
        due.push({ ...job });
        if (due.length >= limit) break;
      }
    }
    return due;
  }

  async updateScheduledJob(id: string, updates: Partial<ScheduledJob>): Promise<ScheduledJob> {
    const existing = this.scheduledJobs.get(id);
    if (!existing) throw new Error('Scheduled job not found');
    const now = new Date().toISOString();
    const updated: ScheduledJob = {
      ...existing,
      ...updates,
      updated_at: now,
    };
    this.scheduledJobs.set(id, updated);
    return { ...updated };
  }

  async cancelScheduledJobsByReference(referenceId: string): Promise<number> {
    let count = 0;
    const now = new Date().toISOString();
    for (const [id, job] of this.scheduledJobs.entries()) {
      if (job.reference_id === referenceId && job.status === 'pending') {
        job.status = 'cancelled';
        job.updated_at = now;
        this.scheduledJobs.set(id, job);
        count++;
      }
    }
    return count;
  }

  // ---------------------------------------------------------------------------
  // Phase 5: SOS Emergency Simulation & Hospital Handoff (In-Memory)
  // ---------------------------------------------------------------------------

  async createEmergencyContact(
    contactData: Omit<EmergencyContact, 'id' | 'created_at' | 'updated_at'>
  ): Promise<EmergencyContact> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const record: EmergencyContact = {
      ...contactData,
      id,
      created_at: now,
      updated_at: now,
    };
    this.emergencyContacts.set(id, record);
    return { ...record };
  }

  async getEmergencyContactById(id: string): Promise<EmergencyContact | null> {
    const item = this.emergencyContacts.get(id);
    return item ? { ...item } : null;
  }

  async listEmergencyContacts(familyId: string, patientProfileId?: string): Promise<EmergencyContact[]> {
    const results: EmergencyContact[] = [];
    for (const c of this.emergencyContacts.values()) {
      if (c.family_id === familyId) {
        if (!patientProfileId || c.patient_profile_id === patientProfileId) {
          results.push({ ...c });
        }
      }
    }
    return results.sort((a, b) => a.priority - b.priority);
  }

  async updateEmergencyContact(id: string, updates: Partial<EmergencyContact>): Promise<EmergencyContact> {
    const existing = this.emergencyContacts.get(id);
    if (!existing) throw new Error('Emergency contact not found');
    const updated: EmergencyContact = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.emergencyContacts.set(id, updated);
    return { ...updated };
  }

  async deleteEmergencyContact(id: string): Promise<void> {
    this.emergencyContacts.delete(id);
  }

  async getEmergencyEscalationPolicy(familyId: string, patientProfileId: string): Promise<EmergencyEscalationPolicy | null> {
    for (const p of this.emergencyPolicies.values()) {
      if (p.family_id === familyId && p.patient_profile_id === patientProfileId) {
        return { ...p };
      }
    }
    return null;
  }

  async upsertEmergencyEscalationPolicy(
    policyData: Omit<EmergencyEscalationPolicy, 'id' | 'created_at' | 'updated_at'>
  ): Promise<EmergencyEscalationPolicy> {
    const existing = await this.getEmergencyEscalationPolicy(policyData.family_id, policyData.patient_profile_id);
    const now = new Date().toISOString();
    if (existing) {
      const updated: EmergencyEscalationPolicy = {
        ...existing,
        ...policyData,
        updated_at: now,
      };
      this.emergencyPolicies.set(existing.id, updated);
      return { ...updated };
    } else {
      const id = crypto.randomUUID();
      const record: EmergencyEscalationPolicy = {
        ...policyData,
        id,
        created_at: now,
        updated_at: now,
      };
      this.emergencyPolicies.set(id, record);
      return { ...record };
    }
  }

  async createEmergencyIncident(
    incidentData: Omit<EmergencyIncident, 'id' | 'created_at' | 'updated_at'>
  ): Promise<EmergencyIncident> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const record: EmergencyIncident = {
      ...incidentData,
      id,
      created_at: now,
      updated_at: now,
    };
    this.emergencyIncidents.set(id, record);
    return { ...record };
  }

  async getEmergencyIncidentById(id: string): Promise<EmergencyIncident | null> {
    const item = this.emergencyIncidents.get(id);
    return item ? { ...item } : null;
  }

  async getActiveEmergencyIncident(familyId: string, patientProfileId: string): Promise<EmergencyIncident | null> {
    const inactiveStatuses = ['RESOLVED', 'CANCELLED', 'ESCALATION_FAILED'];
    for (const inc of this.emergencyIncidents.values()) {
      if (
        inc.family_id === familyId &&
        inc.patient_profile_id === patientProfileId &&
        !inactiveStatuses.includes(inc.status)
      ) {
        return { ...inc };
      }
    }
    return null;
  }

  async listEmergencyIncidents(familyId: string, patientProfileId?: string): Promise<EmergencyIncident[]> {
    const list: EmergencyIncident[] = [];
    for (const inc of this.emergencyIncidents.values()) {
      if (inc.family_id === familyId) {
        if (!patientProfileId || inc.patient_profile_id === patientProfileId) {
          list.push({ ...inc });
        }
      }
    }
    return list.sort((a, b) => b.activated_at.localeCompare(a.activated_at));
  }

  async updateEmergencyIncident(id: string, updates: Partial<EmergencyIncident>): Promise<EmergencyIncident> {
    const existing = this.emergencyIncidents.get(id);
    if (!existing) throw new Error('Emergency incident not found');
    const updated: EmergencyIncident = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.emergencyIncidents.set(id, updated);
    return { ...updated };
  }

  async createEmergencyContactAttempt(
    attemptData: Omit<EmergencyContactAttempt, 'id' | 'created_at' | 'updated_at'>
  ): Promise<EmergencyContactAttempt> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const record: EmergencyContactAttempt = {
      ...attemptData,
      id,
      created_at: now,
      updated_at: now,
    };
    this.emergencyContactAttempts.set(id, record);
    return { ...record };
  }

  async getEmergencyContactAttemptById(id: string): Promise<EmergencyContactAttempt | null> {
    const item = this.emergencyContactAttempts.get(id);
    return item ? { ...item } : null;
  }

  async listEmergencyContactAttempts(incidentId: string): Promise<EmergencyContactAttempt[]> {
    const list: EmergencyContactAttempt[] = [];
    for (const att of this.emergencyContactAttempts.values()) {
      if (att.incident_id === incidentId) {
        list.push({ ...att });
      }
    }
    return list.sort((a, b) => a.attempted_at.localeCompare(b.attempted_at));
  }

  async updateEmergencyContactAttempt(
    id: string,
    updates: Partial<EmergencyContactAttempt>
  ): Promise<EmergencyContactAttempt> {
    const existing = this.emergencyContactAttempts.get(id);
    if (!existing) throw new Error('Emergency contact attempt not found');
    const updated: EmergencyContactAttempt = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.emergencyContactAttempts.set(id, updated);
    return { ...updated };
  }

  async createEmergencyIncidentEvent(
    eventData: Omit<EmergencyIncidentEvent, 'id' | 'created_at'>
  ): Promise<EmergencyIncidentEvent> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const record: EmergencyIncidentEvent = {
      ...eventData,
      id,
      created_at: now,
    };
    this.emergencyIncidentEvents.set(id, record);
    return { ...record };
  }

  async listEmergencyIncidentEvents(incidentId: string): Promise<EmergencyIncidentEvent[]> {
    const list: EmergencyIncidentEvent[] = [];
    for (const ev of this.emergencyIncidentEvents.values()) {
      if (ev.incident_id === incidentId) {
        list.push({ ...ev });
      }
    }
    return list.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  async createHospitalHandoff(
    handoffData: Omit<HospitalHandoff, 'id' | 'created_at' | 'updated_at'>
  ): Promise<HospitalHandoff> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const record: HospitalHandoff = {
      ...handoffData,
      id,
      created_at: now,
      updated_at: now,
    };
    this.hospitalHandoffs.set(id, record);
    return { ...record };
  }

  async getHospitalHandoffByIncidentId(incidentId: string): Promise<HospitalHandoff | null> {
    for (const h of this.hospitalHandoffs.values()) {
      if (h.incident_id === incidentId) {
        return { ...h };
      }
    }
    return null;
  }

  async updateHospitalHandoff(id: string, updates: Partial<HospitalHandoff>): Promise<HospitalHandoff> {
    const existing = this.hospitalHandoffs.get(id);
    if (!existing) throw new Error('Hospital handoff not found');
    const updated: HospitalHandoff = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.hospitalHandoffs.set(id, updated);
    return { ...updated };
  }

  async resetEmergencyDemoScenario(familyId: string, patientProfileId: string): Promise<void> {
    // 1. Find all demo incidents for this family and patient
    const incidentIdsToRemove: string[] = [];
    for (const [id, inc] of this.emergencyIncidents.entries()) {
      if (inc.family_id === familyId && inc.patient_profile_id === patientProfileId) {
        incidentIdsToRemove.push(id);
      }
    }

    // 2. Cancel scheduled jobs associated with these incidents
    for (const incidentId of incidentIdsToRemove) {
      await this.cancelScheduledJobsByReference(incidentId);
    }

    // 3. Remove contact attempts, events, and hospital handoffs for these incidents
    for (const [attId, att] of this.emergencyContactAttempts.entries()) {
      if (incidentIdsToRemove.includes(att.incident_id)) {
        this.emergencyContactAttempts.delete(attId);
      }
    }

    for (const [evId, ev] of this.emergencyIncidentEvents.entries()) {
      if (incidentIdsToRemove.includes(ev.incident_id)) {
        this.emergencyIncidentEvents.delete(evId);
      }
    }

    for (const [hId, h] of this.hospitalHandoffs.entries()) {
      if (incidentIdsToRemove.includes(h.incident_id)) {
        this.hospitalHandoffs.delete(hId);
      }
    }

    // 4. Remove the incidents themselves
    for (const incId of incidentIdsToRemove) {
      this.emergencyIncidents.delete(incId);
    }

    // 5. Remove emergency contacts for this patient
    for (const [cId, c] of this.emergencyContacts.entries()) {
      if (c.family_id === familyId && c.patient_profile_id === patientProfileId && c.is_demo) {
        this.emergencyContacts.delete(cId);
      }
    }

    // 6. Remove emergency policies for this patient
    for (const [pId, p] of this.emergencyPolicies.entries()) {
      if (p.family_id === familyId && p.patient_profile_id === patientProfileId) {
        this.emergencyPolicies.delete(pId);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Phase 6: Live Test Recipients & Telephony Audit Logs
  // ---------------------------------------------------------------------------
  async listLiveTestRecipients(familyId: string): Promise<LiveTestRecipient[]> {
    const list: LiveTestRecipient[] = [];
    for (const r of this.liveTestRecipients.values()) {
      if (r.family_id === familyId) {
        list.push({ ...r });
      }
    }
    return list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }

  async getLiveTestRecipient(id: string): Promise<LiveTestRecipient | null> {
    const r = this.liveTestRecipients.get(id);
    return r ? { ...r } : null;
  }

  async createLiveTestRecipient(
    recipient: Omit<LiveTestRecipient, 'id' | 'created_at' | 'updated_at'>
  ): Promise<LiveTestRecipient> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const record: LiveTestRecipient = {
      ...recipient,
      id,
      created_at: now,
      updated_at: now,
    };
    this.liveTestRecipients.set(id, record);
    return { ...record };
  }

  async updateLiveTestRecipient(
    id: string,
    updates: Partial<LiveTestRecipient>
  ): Promise<LiveTestRecipient> {
    const existing = this.liveTestRecipients.get(id);
    if (!existing) {
      throw new Error(`Live test recipient ${id} not found.`);
    }
    const updated: LiveTestRecipient = {
      ...existing,
      ...updates,
      id,
      family_id: existing.family_id,
      updated_at: new Date().toISOString(),
    };
    this.liveTestRecipients.set(id, updated);
    return { ...updated };
  }

  async deleteLiveTestRecipient(id: string): Promise<void> {
    this.liveTestRecipients.delete(id);
  }

  async createLiveTestAuditLog(
    log: Omit<LiveTestAuditLog, 'id' | 'created_at' | 'updated_at'>
  ): Promise<LiveTestAuditLog> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const record: LiveTestAuditLog = {
      ...log,
      id,
      created_at: now,
      updated_at: now,
    };
    this.liveTestAuditLogs.set(id, record);
    return { ...record };
  }

  async getLiveTestAuditLog(id: string): Promise<LiveTestAuditLog | null> {
    const log = this.liveTestAuditLogs.get(id);
    return log ? { ...log } : null;
  }

  async listLiveTestAuditLogs(familyId: string, incidentId?: string): Promise<LiveTestAuditLog[]> {
    const list: LiveTestAuditLog[] = [];
    for (const log of this.liveTestAuditLogs.values()) {
      if (log.family_id === familyId) {
        if (!incidentId || log.incident_id === incidentId) {
          list.push({ ...log });
        }
      }
    }
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async updateLiveTestAuditLog(
    id: string,
    updates: Partial<LiveTestAuditLog>
  ): Promise<LiveTestAuditLog> {
    const existing = this.liveTestAuditLogs.get(id);
    if (!existing) {
      throw new Error(`Live test audit log ${id} not found.`);
    }
    const updated: LiveTestAuditLog = {
      ...existing,
      ...updates,
      id,
      updated_at: new Date().toISOString(),
    };
    this.liveTestAuditLogs.set(id, updated);
    return { ...updated };
  }

  async getLiveTestAuditLogByProviderRequestId(providerRequestId: string): Promise<LiveTestAuditLog | null> {
    if (!providerRequestId) return null;
    for (const log of this.liveTestAuditLogs.values()) {
      if (log.provider_request_id === providerRequestId) {
        return { ...log };
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Phase 7: Offline Sync Operations & Conflict Handling (In-Memory)
  // ---------------------------------------------------------------------------
  async saveSyncOperation(
    op: Omit<SyncOperation, 'id' | 'created_at' | 'updated_at'>
  ): Promise<SyncOperation> {
    // Check uniqueness constraint on (family_id, client_operation_id)
    for (const existing of this.syncOperations.values()) {
      if (existing.family_id === op.family_id && existing.client_operation_id === op.client_operation_id) {
        return { ...existing };
      }
      if (existing.family_id === op.family_id && existing.idempotency_key === op.idempotency_key) {
        return { ...existing };
      }
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const record: SyncOperation = {
      ...op,
      id,
      created_at: now,
      updated_at: now,
    };
    this.syncOperations.set(id, record);
    return { ...record };
  }

  async getSyncOperationByClientOpId(familyId: string, clientOpId: string): Promise<SyncOperation | null> {
    for (const op of this.syncOperations.values()) {
      if (op.family_id === familyId && op.client_operation_id === clientOpId) {
        return { ...op };
      }
    }
    return null;
  }

  async getSyncOperationByIdempotencyKey(familyId: string, idempotencyKey: string): Promise<SyncOperation | null> {
    for (const op of this.syncOperations.values()) {
      if (op.family_id === familyId && op.idempotency_key === idempotencyKey) {
        return { ...op };
      }
    }
    return null;
  }

  async listSyncOperations(familyId: string, limit = 50): Promise<SyncOperation[]> {
    const list: SyncOperation[] = [];
    for (const op of this.syncOperations.values()) {
      if (op.family_id === familyId) {
        list.push({ ...op });
      }
    }
    return list
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);
  }

  async updateSyncOperation(id: string, updates: Partial<SyncOperation>): Promise<SyncOperation> {
    const existing = this.syncOperations.get(id);
    if (!existing) {
      throw new Error(`Sync operation ${id} not found.`);
    }
    const updated: SyncOperation = {
      ...existing,
      ...updates,
      id,
      updated_at: new Date().toISOString(),
    };
    this.syncOperations.set(id, updated);
    return { ...updated };
  }

  async createSyncConflict(
    conflict: Omit<SyncConflict, 'id' | 'created_at' | 'updated_at'>
  ): Promise<SyncConflict> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const record: SyncConflict = {
      ...conflict,
      id,
      created_at: now,
      updated_at: now,
    };
    this.syncConflicts.set(id, record);
    return { ...record };
  }

  async getSyncConflictById(id: string): Promise<SyncConflict | null> {
    const c = this.syncConflicts.get(id);
    return c ? { ...c } : null;
  }

  async listSyncConflicts(
    familyId: string,
    patientProfileId?: string,
    status?: SyncConflictResolutionStatus
  ): Promise<SyncConflict[]> {
    const list: SyncConflict[] = [];
    for (const c of this.syncConflicts.values()) {
      if (c.family_id === familyId) {
        if (patientProfileId && c.patient_profile_id !== patientProfileId) {
          continue;
        }
        if (status && c.resolution_status !== status) {
          continue;
        }
        list.push({ ...c });
      }
    }
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async resolveSyncConflict(
    id: string,
    resolution: SyncConflictResolutionStatus,
    resolvedBy: string,
    resolvedValue?: Record<string, unknown>
  ): Promise<SyncConflict> {
    const existing = this.syncConflicts.get(id);
    if (!existing) {
      throw new Error(`Sync conflict ${id} not found.`);
    }
    const now = new Date().toISOString();
    const updated: SyncConflict = {
      ...existing,
      resolution_status: resolution,
      resolved_by: resolvedBy,
      resolved_at: now,
      resolved_value: resolvedValue || null,
      updated_at: now,
    };
    this.syncConflicts.set(id, updated);
    return { ...updated };
  }

  async getChangesSince(
    familyId: string,
    sinceIso: string,
    patientProfileId?: string
  ): Promise<{
    patients: PatientProfile[];
    documents: HealthDocument[];
    medications: MedicationSchedule[];
    appointments: Appointment[];
  }> {
    const sinceTime = new Date(sinceIso).getTime();

    // Patients
    const patients: PatientProfile[] = [];
    for (const p of this.patientProfiles.values()) {
      if (p.family_id === familyId) {
        if (!patientProfileId || p.id === patientProfileId) {
          if (new Date(p.updated_at).getTime() >= sinceTime) {
            patients.push({ ...p });
          }
        }
      }
    }

    // Documents
    const documents: HealthDocument[] = [];
    for (const d of this.documents.values()) {
      if (d.family_id === familyId) {
        if (!patientProfileId || d.patient_profile_id === patientProfileId) {
          if (new Date(d.updated_at).getTime() >= sinceTime) {
            documents.push({ ...d });
          }
        }
      }
    }

    // Medications
    const medications: MedicationSchedule[] = [];
    for (const m of this.medicationSchedules.values()) {
      if (m.family_id === familyId) {
        if (!patientProfileId || m.patient_profile_id === patientProfileId) {
          if (new Date(m.updated_at).getTime() >= sinceTime) {
            medications.push({ ...m });
          }
        }
      }
    }

    // Appointments
    const appointments: Appointment[] = [];
    for (const a of this.appointments.values()) {
      if (a.family_id === familyId) {
        if (!patientProfileId || a.patient_profile_id === patientProfileId) {
          if (new Date(a.updated_at).getTime() >= sinceTime) {
            appointments.push({ ...a });
          }
        }
      }
    }

    return { patients, documents, medications, appointments };
  }

  // ---------------------------------------------------------------------------
  // Phase 8: Community Groups, Assistance & Moderation (In-Memory)
  // ---------------------------------------------------------------------------
  async createCommunityGroup(groupData: Omit<CommunityGroup, 'id' | 'created_at' | 'updated_at'>): Promise<CommunityGroup> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const record: CommunityGroup = {
      ...groupData,
      id,
      created_at: now,
      updated_at: now,
    };
    this.communityGroups.set(id, record);
    return { ...record };
  }

  async getCommunityGroupById(id: string): Promise<CommunityGroup | null> {
    const g = this.communityGroups.get(id);
    return g ? { ...g } : null;
  }

  async listCommunityGroupsForUser(userId: string): Promise<CommunityGroup[]> {
    const userGroupIds = new Set<string>();
    for (const m of this.communityMemberships.values()) {
      if (m.user_id === userId && m.status === 'active') {
        userGroupIds.add(m.community_id);
      }
    }
    const list: CommunityGroup[] = [];
    for (const g of this.communityGroups.values()) {
      if (userGroupIds.has(g.id)) {
        list.push({ ...g });
      }
    }
    return list;
  }

  async listPublicCommunityGroups(locality?: string): Promise<CommunityGroup[]> {
    const list: CommunityGroup[] = [];
    for (const g of this.communityGroups.values()) {
      if (g.status === 'active') {
        if (!locality || g.approximate_locality.toLowerCase().includes(locality.toLowerCase())) {
          list.push({ ...g });
        }
      }
    }
    return list;
  }

  async updateCommunityGroup(id: string, patch: Partial<CommunityGroup>): Promise<CommunityGroup> {
    const g = this.communityGroups.get(id);
    if (!g) throw new Error('Community group not found');
    const updated: CommunityGroup = {
      ...g,
      ...patch,
      updated_at: new Date().toISOString(),
    };
    this.communityGroups.set(id, updated);
    return { ...updated };
  }

  // Memberships
  async createCommunityMembership(memData: Omit<CommunityMembership, 'id' | 'created_at' | 'updated_at' | 'joined_at'>): Promise<CommunityMembership> {
    for (const m of this.communityMemberships.values()) {
      if (m.community_id === memData.community_id && m.user_id === memData.user_id) {
        throw new Error('User is already a member of this community');
      }
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const record: CommunityMembership = {
      ...memData,
      id,
      joined_at: now,
      created_at: now,
      updated_at: now,
    };
    this.communityMemberships.set(id, record);
    return { ...record };
  }

  async getCommunityMembership(communityId: string, userId: string): Promise<CommunityMembership | null> {
    for (const m of this.communityMemberships.values()) {
      if (m.community_id === communityId && m.user_id === userId) {
        return { ...m };
      }
    }
    return null;
  }

  async listCommunityMemberships(communityId: string): Promise<CommunityMembership[]> {
    const list: CommunityMembership[] = [];
    for (const m of this.communityMemberships.values()) {
      if (m.community_id === communityId && m.status === 'active') {
        list.push({ ...m });
      }
    }
    return list;
  }

  async updateCommunityMembership(id: string, patch: Partial<CommunityMembership>): Promise<CommunityMembership> {
    const m = this.communityMemberships.get(id);
    if (!m) throw new Error('Community membership not found');
    const updated: CommunityMembership = {
      ...m,
      ...patch,
      updated_at: new Date().toISOString(),
    };
    this.communityMemberships.set(id, updated);
    return { ...updated };
  }

  async deleteCommunityMembership(id: string): Promise<void> {
    this.communityMemberships.delete(id);
  }

  // Invitations
  async createCommunityInvitation(invData: Omit<CommunityInvitation, 'id' | 'created_at' | 'updated_at'>): Promise<CommunityInvitation> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const record: CommunityInvitation = {
      ...invData,
      id,
      created_at: now,
      updated_at: now,
    };
    this.communityInvitations.set(id, record);
    return { ...record };
  }

  async getCommunityInvitationByCode(code: string): Promise<CommunityInvitation | null> {
    for (const inv of this.communityInvitations.values()) {
      if (inv.invite_code === code) {
        return { ...inv };
      }
    }
    return null;
  }

  async getCommunityInvitationById(id: string): Promise<CommunityInvitation | null> {
    const inv = this.communityInvitations.get(id);
    return inv ? { ...inv } : null;
  }

  async listCommunityInvitationsForUser(email: string): Promise<CommunityInvitation[]> {
    const normalized = email.toLowerCase().trim();
    const list: CommunityInvitation[] = [];
    for (const inv of this.communityInvitations.values()) {
      if (inv.invitee_email.toLowerCase().trim() === normalized && inv.status === 'pending') {
        list.push({ ...inv });
      }
    }
    return list;
  }

  async listCommunityInvitationsForGroup(communityId: string): Promise<CommunityInvitation[]> {
    const list: CommunityInvitation[] = [];
    for (const inv of this.communityInvitations.values()) {
      if (inv.community_id === communityId) {
        list.push({ ...inv });
      }
    }
    return list;
  }

  async updateCommunityInvitation(id: string, patch: Partial<CommunityInvitation>): Promise<CommunityInvitation> {
    const inv = this.communityInvitations.get(id);
    if (!inv) throw new Error('Community invitation not found');
    const updated: CommunityInvitation = {
      ...inv,
      ...patch,
      updated_at: new Date().toISOString(),
    };
    this.communityInvitations.set(id, updated);
    return { ...updated };
  }

  // Join Requests
  async createCommunityJoinRequest(reqData: Omit<CommunityJoinRequest, 'id' | 'created_at' | 'updated_at'>): Promise<CommunityJoinRequest> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const record: CommunityJoinRequest = {
      ...reqData,
      id,
      created_at: now,
      updated_at: now,
    };
    this.communityJoinRequests.set(id, record);
    return { ...record };
  }

  async getCommunityJoinRequestById(id: string): Promise<CommunityJoinRequest | null> {
    const req = this.communityJoinRequests.get(id);
    return req ? { ...req } : null;
  }

  async listCommunityJoinRequests(communityId: string, status?: string): Promise<CommunityJoinRequest[]> {
    const list: CommunityJoinRequest[] = [];
    for (const r of this.communityJoinRequests.values()) {
      if (r.community_id === communityId) {
        if (!status || r.status === status) {
          list.push({ ...r });
        }
      }
    }
    return list;
  }

  async updateCommunityJoinRequest(id: string, patch: Partial<CommunityJoinRequest>): Promise<CommunityJoinRequest> {
    const r = this.communityJoinRequests.get(id);
    if (!r) throw new Error('Join request not found');
    const updated: CommunityJoinRequest = {
      ...r,
      ...patch,
      updated_at: new Date().toISOString(),
    };
    this.communityJoinRequests.set(id, updated);
    return { ...updated };
  }

  // Assistance Requests
  async createAssistanceRequest(reqData: Omit<AssistanceRequest, 'id' | 'created_at' | 'updated_at'>): Promise<AssistanceRequest> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const record: AssistanceRequest = {
      ...reqData,
      id,
      created_at: now,
      updated_at: now,
    };
    this.assistanceRequests.set(id, record);
    return { ...record };
  }

  async getAssistanceRequestById(id: string): Promise<AssistanceRequest | null> {
    const req = this.assistanceRequests.get(id);
    return req ? { ...req } : null;
  }

  async listAssistanceRequests(communityId: string, filter?: { category?: string; status?: string }): Promise<AssistanceRequest[]> {
    const list: AssistanceRequest[] = [];
    for (const req of this.assistanceRequests.values()) {
      if (req.community_id === communityId) {
        if (filter?.category && req.request_category !== filter.category) continue;
        if (filter?.status && req.status !== filter.status) continue;
        list.push({ ...req });
      }
    }
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async updateAssistanceRequest(id: string, patch: Partial<AssistanceRequest>): Promise<AssistanceRequest> {
    const req = this.assistanceRequests.get(id);
    if (!req) throw new Error('Assistance request not found');
    const updated: AssistanceRequest = {
      ...req,
      ...patch,
      updated_at: new Date().toISOString(),
    };
    this.assistanceRequests.set(id, updated);
    return { ...updated };
  }

  // Assistance Assignments
  async createAssistanceAssignment(assignData: Omit<AssistanceAssignment, 'id' | 'created_at' | 'updated_at'>): Promise<AssistanceAssignment> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const record: AssistanceAssignment = {
      ...assignData,
      id,
      created_at: now,
      updated_at: now,
    };
    this.assistanceAssignments.set(id, record);
    return { ...record };
  }

  async getAssistanceAssignment(requestId: string, volunteerUserId: string): Promise<AssistanceAssignment | null> {
    for (const a of this.assistanceAssignments.values()) {
      if (a.request_id === requestId && a.volunteer_user_id === volunteerUserId) {
        return { ...a };
      }
    }
    return null;
  }

  async listAssistanceAssignments(requestId: string): Promise<AssistanceAssignment[]> {
    const list: AssistanceAssignment[] = [];
    for (const a of this.assistanceAssignments.values()) {
      if (a.request_id === requestId) {
        list.push({ ...a });
      }
    }
    return list;
  }

  async updateAssistanceAssignment(id: string, patch: Partial<AssistanceAssignment>): Promise<AssistanceAssignment> {
    const a = this.assistanceAssignments.get(id);
    if (!a) throw new Error('Assistance assignment not found');
    const updated: AssistanceAssignment = {
      ...a,
      ...patch,
      updated_at: new Date().toISOString(),
    };
    this.assistanceAssignments.set(id, updated);
    return { ...updated };
  }

  // Blood Donor Requests
  async createBloodDonorRequest(reqData: Omit<BloodDonorRequest, 'id' | 'created_at' | 'updated_at'>): Promise<BloodDonorRequest> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const record: BloodDonorRequest = {
      ...reqData,
      id,
      created_at: now,
      updated_at: now,
    };
    this.bloodDonorRequests.set(id, record);
    return { ...record };
  }

  async getBloodDonorRequestById(id: string): Promise<BloodDonorRequest | null> {
    const req = this.bloodDonorRequests.get(id);
    return req ? { ...req } : null;
  }

  async listBloodDonorRequests(communityId: string, filter?: { bloodGroup?: string; status?: string }): Promise<BloodDonorRequest[]> {
    const list: BloodDonorRequest[] = [];
    for (const req of this.bloodDonorRequests.values()) {
      if (req.community_id === communityId) {
        if (filter?.bloodGroup && req.blood_group !== filter.bloodGroup && req.blood_group !== 'any') continue;
        if (filter?.status && req.status !== filter.status) continue;
        list.push({ ...req });
      }
    }
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async updateBloodDonorRequest(id: string, patch: Partial<BloodDonorRequest>): Promise<BloodDonorRequest> {
    const req = this.bloodDonorRequests.get(id);
    if (!req) throw new Error('Blood donor request not found');
    const updated: BloodDonorRequest = {
      ...req,
      ...patch,
      updated_at: new Date().toISOString(),
    };
    this.bloodDonorRequests.set(id, updated);
    return { ...updated };
  }

  // Donor Responses
  async createDonorResponse(respData: Omit<DonorResponse, 'id' | 'created_at' | 'updated_at'>): Promise<DonorResponse> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const record: DonorResponse = {
      ...respData,
      id,
      created_at: now,
      updated_at: now,
    };
    this.donorResponses.set(id, record);
    return { ...record };
  }

  async getDonorResponse(requestId: string, donorUserId: string): Promise<DonorResponse | null> {
    for (const r of this.donorResponses.values()) {
      if (r.request_id === requestId && r.donor_user_id === donorUserId) {
        return { ...r };
      }
    }
    return null;
  }

  async listDonorResponses(requestId: string): Promise<DonorResponse[]> {
    const list: DonorResponse[] = [];
    for (const r of this.donorResponses.values()) {
      if (r.request_id === requestId) {
        list.push({ ...r });
      }
    }
    return list;
  }

  async updateDonorResponse(id: string, patch: Partial<DonorResponse>): Promise<DonorResponse> {
    const r = this.donorResponses.get(id);
    if (!r) throw new Error('Donor response not found');
    const updated: DonorResponse = {
      ...r,
      ...patch,
      updated_at: new Date().toISOString(),
    };
    this.donorResponses.set(id, updated);
    return { ...updated };
  }

  // Contact Grants
  async createContactGrant(grantData: Omit<ContactSharingGrant, 'id' | 'created_at'>): Promise<ContactSharingGrant> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const record: ContactSharingGrant = {
      ...grantData,
      id,
      created_at: now,
    };
    this.contactGrants.set(id, record);
    return { ...record };
  }

  async getContactGrant(resourceType: string, resourceId: string, grantedToUserId: string): Promise<ContactSharingGrant | null> {
    for (const g of this.contactGrants.values()) {
      if (g.resource_type === resourceType && g.resource_id === resourceId && g.granted_to_user_id === grantedToUserId && g.status === 'active') {
        if (new Date(g.expires_at).getTime() > Date.now()) {
          return { ...g };
        }
      }
    }
    return null;
  }

  async listContactGrants(resourceType: string, resourceId: string): Promise<ContactSharingGrant[]> {
    const list: ContactSharingGrant[] = [];
    for (const g of this.contactGrants.values()) {
      if (g.resource_type === resourceType && g.resource_id === resourceId) {
        list.push({ ...g });
      }
    }
    return list;
  }

  async revokeContactGrant(id: string): Promise<ContactSharingGrant> {
    const g = this.contactGrants.get(id);
    if (!g) throw new Error('Contact sharing grant not found');
    const updated: ContactSharingGrant = {
      ...g,
      status: 'revoked',
    };
    this.contactGrants.set(id, updated);
    return { ...updated };
  }

  // Moderation
  async createCommunityReport(reportData: Omit<CommunityReport, 'id' | 'created_at' | 'updated_at'>): Promise<CommunityReport> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const record: CommunityReport = {
      ...reportData,
      id,
      created_at: now,
      updated_at: now,
    };
    this.communityReports.set(id, record);
    return { ...record };
  }

  async getCommunityReportById(id: string): Promise<CommunityReport | null> {
    const r = this.communityReports.get(id);
    return r ? { ...r } : null;
  }

  async listCommunityReports(communityId: string, status?: string): Promise<CommunityReport[]> {
    const list: CommunityReport[] = [];
    for (const r of this.communityReports.values()) {
      if (r.community_id === communityId) {
        if (!status || r.status === status) {
          list.push({ ...r });
        }
      }
    }
    return list;
  }

  async updateCommunityReport(id: string, patch: Partial<CommunityReport>): Promise<CommunityReport> {
    const r = this.communityReports.get(id);
    if (!r) throw new Error('Community report not found');
    const updated: CommunityReport = {
      ...r,
      ...patch,
      updated_at: new Date().toISOString(),
    };
    this.communityReports.set(id, updated);
    return { ...updated };
  }

  async createModerationAction(actData: Omit<ModerationAction, 'id' | 'created_at'>): Promise<ModerationAction> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const record: ModerationAction = {
      ...actData,
      id,
      created_at: now,
    };
    this.moderationActions.set(id, record);
    return { ...record };
  }

  async listModerationActions(communityId: string): Promise<ModerationAction[]> {
    const list: ModerationAction[] = [];
    for (const a of this.moderationActions.values()) {
      if (a.community_id === communityId) {
        list.push({ ...a });
      }
    }
    return list;
  }

  // ---------------------------------------------------------------------------
  // Demo Auth
  // ---------------------------------------------------------------------------
  async authenticateDemoUser(email: string, passwordHashOrPlain: string): Promise<UserProfile | null> {
    const normalized = email.toLowerCase().trim();
    for (const user of this.users.values()) {
      if (user.profile.email.toLowerCase().trim() === normalized) {
        if (user.password === passwordHashOrPlain || passwordHashOrPlain === 'demo-password') {
          return { ...user.profile };
        }
      }
    }
    return null;
  }

  async registerDemoUser(email: string, passwordHashOrPlain: string, fullName: string, phone?: string): Promise<UserProfile> {
    const normalized = email.toLowerCase().trim();
    for (const user of this.users.values()) {
      if (user.profile.email.toLowerCase().trim() === normalized) {
        throw new Error('A user with this email address already exists');
      }
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const profile: UserProfile = {
      id,
      email: normalized,
      full_name: fullName,
      phone: phone ?? null,
      avatar_url: null,
      created_at: now,
      updated_at: now,
    };

    this.users.set(id, { profile, password: passwordHashOrPlain });
    return { ...profile };
  }
}

// -----------------------------------------------------------------------------
// Live Supabase Database Implementation
// -----------------------------------------------------------------------------
class SupabaseDatabaseRepository implements IDatabaseRepository {
  private client: SupabaseClient;

  constructor() {
    this.client = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async findProfileById(id: string): Promise<UserProfile | null> {
    const { data, error } = await this.client.from('profiles').select('*').eq('id', id).single();
    if (error || !data) return null;
    return data as UserProfile;
  }

  async findProfileByEmail(email: string): Promise<UserProfile | null> {
    const { data, error } = await this.client.from('profiles').select('*').eq('email', email.toLowerCase().trim()).single();
    if (error || !data) return null;
    return data as UserProfile;
  }

  async upsertProfile(profile: Partial<UserProfile> & { id: string; email: string }): Promise<UserProfile> {
    const { data, error } = await this.client
      .from('profiles')
      .upsert({ ...profile, updated_at: new Date().toISOString() })
      .select()
      .single();
    if (error || !data) throw new Error(`Failed to upsert profile: ${error?.message}`);
    return data as UserProfile;
  }

  async createFamily(name: string, createdBy: string): Promise<{ family: Family; membership: FamilyMembership }> {
    const { data: familyData, error: familyError } = await this.client
      .from('families')
      .insert({ name, created_by: createdBy })
      .select()
      .single();
    if (familyError || !familyData) throw new Error(`Failed to create family: ${familyError?.message}`);

    const { data: memberData, error: memberError } = await this.client
      .from('family_memberships')
      .insert({ family_id: familyData.id, user_id: createdBy, role: 'owner', status: 'active' })
      .select()
      .single();
    if (memberError || !memberData) throw new Error(`Failed to create owner membership: ${memberError?.message}`);

    return { family: familyData as Family, membership: memberData as FamilyMembership };
  }

  async getFamilyById(familyId: string): Promise<Family | null> {
    const { data, error } = await this.client.from('families').select('*').eq('id', familyId).single();
    if (error || !data) return null;
    return data as Family;
  }

  async getUserFamilies(userId: string): Promise<Family[]> {
    const { data, error } = await this.client
      .from('family_memberships')
      .select('family_id, families(*)')
      .eq('user_id', userId)
      .eq('status', 'active');
    if (error || !data) return [];
    return data.map((item: { families: unknown }) => item.families as Family).filter(Boolean);
  }

  async updateFamilyName(familyId: string, name: string): Promise<Family> {
    const { data, error } = await this.client
      .from('families')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('id', familyId)
      .select()
      .single();
    if (error || !data) throw new Error(`Failed to update family: ${error?.message}`);
    return data as Family;
  }

  async deleteFamily(familyId: string): Promise<void> {
    const { error } = await this.client.from('families').delete().eq('id', familyId);
    if (error) throw new Error(`Failed to delete family: ${error.message}`);
  }

  async getFamilyMemberships(familyId: string): Promise<FamilyMembership[]> {
    const { data, error } = await this.client
      .from('family_memberships')
      .select('*, user:profiles(*)')
      .eq('family_id', familyId);
    if (error || !data) return [];
    return data as FamilyMembership[];
  }

  async getUserMembership(familyId: string, userId: string): Promise<FamilyMembership | null> {
    const { data, error } = await this.client
      .from('family_memberships')
      .select('*, user:profiles(*)')
      .eq('family_id', familyId)
      .eq('user_id', userId)
      .single();
    if (error || !data) return null;
    return data as FamilyMembership;
  }

  async addFamilyMembership(familyId: string, userId: string, role: MembershipRole): Promise<FamilyMembership> {
    const { data, error } = await this.client
      .from('family_memberships')
      .insert({ family_id: familyId, user_id: userId, role, status: 'active' })
      .select('*, user:profiles(*)')
      .single();
    if (error || !data) throw new Error(`Failed to add membership: ${error?.message}`);
    return data as FamilyMembership;
  }

  async updateMembershipRole(familyId: string, userId: string, role: MembershipRole): Promise<FamilyMembership> {
    const { data, error } = await this.client
      .from('family_memberships')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('family_id', familyId)
      .eq('user_id', userId)
      .select('*, user:profiles(*)')
      .single();
    if (error || !data) throw new Error(`Failed to update membership role: ${error?.message}`);
    return data as FamilyMembership;
  }

  async removeFamilyMembership(familyId: string, userId: string): Promise<void> {
    const { error } = await this.client
      .from('family_memberships')
      .delete()
      .eq('family_id', familyId)
      .eq('user_id', userId);
    if (error) throw new Error(`Failed to remove membership: ${error.message}`);
  }

  async createPatientProfile(profileData: Omit<PatientProfile, 'id' | 'created_at' | 'updated_at'>): Promise<PatientProfile> {
    const { data: created, error } = await this.client.from('patient_profiles').insert(profileData).select().single();
    if (error || !created) throw new Error(`Failed to create patient profile: ${error?.message}`);
    return created as PatientProfile;
  }

  async getPatientProfileById(profileId: string): Promise<PatientProfile | null> {
    const { data, error } = await this.client.from('patient_profiles').select('*').eq('id', profileId).single();
    if (error || !data) return null;
    return data as PatientProfile;
  }

  async getPatientProfileByHealthId(healthId: string): Promise<PatientProfile | null> {
    const { data, error } = await this.client.from('patient_profiles').select('*').eq('health_id', healthId).single();
    if (error || !data) return null;
    return data as PatientProfile;
  }

  async getFamilyPatientProfiles(familyId: string): Promise<PatientProfile[]> {
    const { data, error } = await this.client
      .from('patient_profiles')
      .select('*')
      .eq('family_id', familyId)
      .eq('status', 'active');
    if (error || !data) return [];
    return data as PatientProfile[];
  }

  async updatePatientProfile(profileId: string, updates: Partial<PatientProfile>): Promise<PatientProfile> {
    const allowedUpdates = { ...updates };
    delete allowedUpdates.id;
    delete allowedUpdates.health_id;
    delete allowedUpdates.family_id;
    const { data, error } = await this.client
      .from('patient_profiles')
      .update({ ...allowedUpdates, updated_at: new Date().toISOString() })
      .eq('id', profileId)
      .select()
      .single();
    if (error || !data) throw new Error(`Failed to update patient profile: ${error?.message}`);
    return data as PatientProfile;
  }

  async getCaregiverRelationships(familyId: string): Promise<CaregiverRelationship[]> {
    const { data, error } = await this.client.from('caregiver_relationships').select('*').eq('family_id', familyId);
    if (error || !data) return [];
    return data as CaregiverRelationship[];
  }

  async assignCaregiver(data: Omit<CaregiverRelationship, 'id' | 'created_at' | 'updated_at'>): Promise<CaregiverRelationship> {
    const { data: created, error } = await this.client.from('caregiver_relationships').insert(data).select().single();
    if (error || !created) throw new Error(`Failed to assign caregiver: ${error?.message}`);
    return created as CaregiverRelationship;
  }

  async revokeCaregiver(relationshipId: string): Promise<void> {
    const { error } = await this.client.from('caregiver_relationships').delete().eq('id', relationshipId);
    if (error) throw new Error(`Failed to revoke caregiver relationship: ${error.message}`);
  }

  // ---------------------------------------------------------------------------
  // Phase 2: Live Supabase Documents & Extractions
  // ---------------------------------------------------------------------------

  async createDocument(docData: Omit<HealthDocument, 'id' | 'created_at' | 'updated_at'>): Promise<HealthDocument> {
    const { data, error } = await this.client.from('health_documents').insert(docData).select().single();
    if (error || !data) throw new Error(`Failed to create health document: ${error?.message}`);
    return data as HealthDocument;
  }

  async getDocumentById(documentId: string): Promise<HealthDocument | null> {
    const { data, error } = await this.client.from('health_documents').select('*').eq('id', documentId).single();
    if (error || !data) return null;
    return data as HealthDocument;
  }

  async findDocumentsByChecksum(patientProfileId: string, checksum: string): Promise<HealthDocument[]> {
    const { data, error } = await this.client
      .from('health_documents')
      .select('*')
      .eq('patient_profile_id', patientProfileId)
      .eq('file_checksum', checksum);
    if (error || !data) return [];
    return data as HealthDocument[];
  }

  async listFamilyDocuments(familyId: string, filters?: DocumentSearchFilters): Promise<HealthDocument[]> {
    let query = this.client.from('health_documents').select('*').eq('family_id', familyId);

    if (filters?.patientProfileId) query = query.eq('patient_profile_id', filters.patientProfileId);
    if (filters?.category) query = query.eq('category', filters.category);
    if (filters?.processingStatus) query = query.eq('processing_status', filters.processingStatus);
    if (filters?.reviewStatus) query = query.eq('review_status', filters.reviewStatus);
    if (filters?.startDate) query = query.gte('document_date', filters.startDate);
    if (filters?.endDate) query = query.lte('document_date', filters.endDate);
    if (filters?.query) query = query.ilike('title', `%${filters.query}%`);

    query = query.order('document_date', { ascending: false, nullsFirst: false });
    const { data, error } = await query;
    if (error || !data) return [];
    return data as HealthDocument[];
  }

  async updateDocument(documentId: string, updates: Partial<HealthDocument>): Promise<HealthDocument> {
    const { data, error } = await this.client
      .from('health_documents')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', documentId)
      .select()
      .single();
    if (error || !data) throw new Error(`Failed to update health document: ${error?.message}`);
    return data as HealthDocument;
  }

  async deleteDocument(documentId: string): Promise<void> {
    const { error } = await this.client.from('health_documents').delete().eq('id', documentId);
    if (error) throw new Error(`Failed to delete document: ${error.message}`);
  }

  async upsertExtraction(data: Omit<DocumentExtraction, 'id' | 'created_at' | 'updated_at'>): Promise<DocumentExtraction> {
    const { data: upserted, error } = await this.client
      .from('document_extractions')
      .upsert({ ...data, updated_at: new Date().toISOString() }, { onConflict: 'document_id' })
      .select()
      .single();
    if (error || !upserted) throw new Error(`Failed to upsert document extraction: ${error?.message}`);
    return upserted as DocumentExtraction;
  }

  async getExtractionByDocumentId(documentId: string): Promise<DocumentExtraction | null> {
    const { data, error } = await this.client
      .from('document_extractions')
      .select('*')
      .eq('document_id', documentId)
      .single();
    if (error || !data) return null;
    return data as DocumentExtraction;
  }

  async createProcessingJob(jobData: Omit<DocumentProcessingJob, 'id' | 'created_at' | 'updated_at'>): Promise<DocumentProcessingJob> {
    const { data, error } = await this.client.from('document_processing_jobs').insert(jobData).select().single();
    if (error || !data) throw new Error(`Failed to create processing job: ${error?.message}`);
    return data as DocumentProcessingJob;
  }

  async getProcessingJobByDocumentId(documentId: string): Promise<DocumentProcessingJob | null> {
    const { data, error } = await this.client
      .from('document_processing_jobs')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (error || !data) return null;
    return data as DocumentProcessingJob;
  }

  async updateProcessingJob(jobId: string, updates: Partial<DocumentProcessingJob>): Promise<DocumentProcessingJob> {
    const { data, error } = await this.client
      .from('document_processing_jobs')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', jobId)
      .select()
      .single();
    if (error || !data) throw new Error(`Failed to update processing job: ${error?.message}`);
    return data as DocumentProcessingJob;
  }

  // ---------------------------------------------------------------------------
  // Phase 3: AI Conversations, Messages, & Doctor Summaries (Supabase)
  // ---------------------------------------------------------------------------

  async createConversation(data: Omit<AIConversation, 'id' | 'created_at' | 'updated_at'>): Promise<AIConversation> {
    const { data: conv, error } = await this.client.from('ai_conversations').insert(data).select().single();
    if (error || !conv) throw new Error(`Failed to create conversation: ${error?.message}`);
    return conv as AIConversation;
  }

  async getConversationById(conversationId: string): Promise<AIConversation | null> {
    const { data, error } = await this.client.from('ai_conversations').select('*').eq('id', conversationId).single();
    if (error || !data) return null;
    return data as AIConversation;
  }

  async listPatientConversations(patientProfileId: string): Promise<AIConversation[]> {
    const { data, error } = await this.client
      .from('ai_conversations')
      .select('*')
      .eq('patient_profile_id', patientProfileId)
      .order('updated_at', { ascending: false });
    if (error || !data) return [];
    return data as AIConversation[];
  }

  async createMessage(msgData: Omit<AIConversationMessage, 'id' | 'created_at'>): Promise<AIConversationMessage> {
    const { data, error } = await this.client.from('ai_conversation_messages').insert(msgData).select().single();
    if (error || !data) throw new Error(`Failed to create message: ${error?.message}`);
    return data as AIConversationMessage;
  }

  async getConversationMessages(conversationId: string): Promise<AIConversationMessage[]> {
    const { data, error } = await this.client
      .from('ai_conversation_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (error || !data) return [];
    return data as AIConversationMessage[];
  }

  async recordDoctorSummary(summaryData: Omit<DoctorSummaryRecord, 'id' | 'created_at'>): Promise<DoctorSummaryRecord> {
    const { data, error } = await this.client.from('doctor_summary_reports').insert(summaryData).select().single();
    if (error || !data) throw new Error(`Failed to record doctor summary: ${error?.message}`);
    return data as DoctorSummaryRecord;
  }

  async listDoctorSummaries(patientProfileId: string): Promise<DoctorSummaryRecord[]> {
    const { data, error } = await this.client
      .from('doctor_summary_reports')
      .select('*')
      .eq('patient_profile_id', patientProfileId)
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return data as DoctorSummaryRecord[];
  }

  // ---------------------------------------------------------------------------
  // Phase 4: Medication Schedules, Doses, Appointments & Notifications (Supabase)
  // ---------------------------------------------------------------------------

  async createMedicationSchedule(
    scheduleData: Omit<MedicationSchedule, 'id' | 'created_at' | 'updated_at'>
  ): Promise<MedicationSchedule> {
    const { data, error } = await this.client.from('medication_schedules').insert(scheduleData).select().single();
    if (error || !data) throw new Error(`Failed to create medication schedule: ${error?.message}`);
    return data as MedicationSchedule;
  }

  async getMedicationScheduleById(id: string): Promise<MedicationSchedule | null> {
    const { data, error } = await this.client.from('medication_schedules').select('*').eq('id', id).single();
    if (error || !data) return null;
    return data as MedicationSchedule;
  }

  async listMedicationSchedulesByPatient(
    patientProfileId: string,
    status?: string
  ): Promise<MedicationSchedule[]> {
    let q = this.client.from('medication_schedules').select('*').eq('patient_profile_id', patientProfileId);
    if (status) q = q.eq('status', status);
    const { data, error } = await q.order('created_at', { ascending: false });
    if (error || !data) return [];
    return data as MedicationSchedule[];
  }

  async updateMedicationSchedule(
    id: string,
    updates: Partial<MedicationSchedule>
  ): Promise<MedicationSchedule> {
    const { data, error } = await this.client
      .from('medication_schedules')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error || !data) throw new Error(`Failed to update medication schedule: ${error?.message}`);
    return data as MedicationSchedule;
  }

  async recordMedicationScheduleHistory(
    historyData: Omit<MedicationScheduleHistory, 'id' | 'created_at'>
  ): Promise<MedicationScheduleHistory> {
    const { data, error } = await this.client.from('medication_schedule_history').insert(historyData).select().single();
    if (error || !data) throw new Error(`Failed to record schedule history: ${error?.message}`);
    return data as MedicationScheduleHistory;
  }

  async getMedicationScheduleHistory(scheduleId: string): Promise<MedicationScheduleHistory[]> {
    const { data, error } = await this.client
      .from('medication_schedule_history')
      .select('*')
      .eq('schedule_id', scheduleId)
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return data as MedicationScheduleHistory[];
  }

  async createDoseOccurrences(
    occurrences: Omit<MedicationDoseOccurrence, 'id' | 'created_at' | 'updated_at'>[]
  ): Promise<MedicationDoseOccurrence[]> {
    if (occurrences.length === 0) return [];
    const { data, error } = await this.client
      .from('medication_dose_occurrences')
      .upsert(occurrences, { onConflict: 'schedule_id,scheduled_date,scheduled_time', ignoreDuplicates: true })
      .select();
    if (error || !data) throw new Error(`Failed to create dose occurrences: ${error?.message}`);
    return data as MedicationDoseOccurrence[];
  }

  async listDoseOccurrences(
    patientProfileId: string,
    startDate: string,
    endDate: string
  ): Promise<MedicationDoseOccurrence[]> {
    const { data, error } = await this.client
      .from('medication_dose_occurrences')
      .select('*, schedule:medication_schedules(*)')
      .eq('patient_profile_id', patientProfileId)
      .gte('scheduled_date', startDate)
      .lte('scheduled_date', endDate)
      .order('scheduled_datetime', { ascending: true });
    if (error || !data) return [];
    return data as MedicationDoseOccurrence[];
  }

  async getDoseOccurrenceById(id: string): Promise<MedicationDoseOccurrence | null> {
    const { data, error } = await this.client
      .from('medication_dose_occurrences')
      .select('*, schedule:medication_schedules(*)')
      .eq('id', id)
      .single();
    if (error || !data) return null;
    return data as MedicationDoseOccurrence;
  }

  async updateDoseOccurrenceStatus(
    id: string,
    status: DoseOccurrenceStatus,
    acknowledgedBy?: string,
    note?: string
  ): Promise<MedicationDoseOccurrence> {
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      status,
      updated_at: now,
    };
    if (['taken', 'skipped', 'missed'].includes(status)) {
      patch['acknowledged_at'] = now;
    } else if (status === 'scheduled') {
      patch['acknowledged_at'] = null;
      patch['acknowledged_by'] = null;
      patch['acknowledgement_note'] = null;
    }
    if (acknowledgedBy) patch['acknowledged_by'] = acknowledgedBy;
    if (note !== undefined) patch['acknowledgement_note'] = note;

    const { data, error } = await this.client
      .from('medication_dose_occurrences')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error || !data) throw new Error(`Failed to update dose status: ${error?.message}`);
    return data as MedicationDoseOccurrence;
  }

  async cancelFutureDoseOccurrences(scheduleId: string, fromDate: string): Promise<number> {
    const { data, error } = await this.client
      .from('medication_dose_occurrences')
      .delete()
      .eq('schedule_id', scheduleId)
      .gte('scheduled_date', fromDate)
      .eq('status', 'scheduled')
      .select();
    if (error) throw new Error(`Failed to cancel future dose occurrences: ${error?.message}`);
    return data ? data.length : 0;
  }

  async createAppointment(
    apptData: Omit<Appointment, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Appointment> {
    const { data, error } = await this.client.from('appointments').insert(apptData).select().single();
    if (error || !data) throw new Error(`Failed to create appointment: ${error?.message}`);
    return data as Appointment;
  }

  async getAppointmentById(id: string): Promise<Appointment | null> {
    const { data, error } = await this.client.from('appointments').select('*').eq('id', id).single();
    if (error || !data) return null;
    return data as Appointment;
  }

  async listAppointmentsByPatient(
    patientProfileId: string,
    status?: string
  ): Promise<Appointment[]> {
    let q = this.client.from('appointments').select('*').eq('patient_profile_id', patientProfileId);
    if (status) q = q.eq('status', status);
    const { data, error } = await q.order('appointment_date', { ascending: true });
    if (error || !data) return [];
    return data as Appointment[];
  }

  async updateAppointment(id: string, updates: Partial<Appointment>): Promise<Appointment> {
    const { data, error } = await this.client
      .from('appointments')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error || !data) throw new Error(`Failed to update appointment: ${error?.message}`);
    return data as Appointment;
  }

  async deleteAppointment(id: string): Promise<void> {
    const { error } = await this.client.from('appointments').delete().eq('id', id);
    if (error) throw new Error(`Failed to delete appointment: ${error?.message}`);
  }

  async getNotificationPreferences(
    userId: string,
    familyId: string
  ): Promise<NotificationPreference | null> {
    const { data, error } = await this.client
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .eq('family_id', familyId)
      .maybeSingle();
    if (error || !data) return null;
    return data as NotificationPreference;
  }

  async upsertNotificationPreferences(
    prefs: Omit<NotificationPreference, 'id' | 'created_at' | 'updated_at'>
  ): Promise<NotificationPreference> {
    const { data, error } = await this.client
      .from('notification_preferences')
      .upsert(prefs, { onConflict: 'user_id,family_id' })
      .select()
      .single();
    if (error || !data) throw new Error(`Failed to update notification preferences: ${error?.message}`);
    return data as NotificationPreference;
  }

  async getCaregiverPolicy(
    patientProfileId: string,
    caregiverUserId: string
  ): Promise<CaregiverReminderPolicy | null> {
    const { data, error } = await this.client
      .from('caregiver_reminder_policies')
      .select('*')
      .eq('patient_profile_id', patientProfileId)
      .eq('caregiver_user_id', caregiverUserId)
      .maybeSingle();
    if (error || !data) return null;
    return data as CaregiverReminderPolicy;
  }

  async listCaregiverPolicies(patientProfileId: string): Promise<CaregiverReminderPolicy[]> {
    const { data, error } = await this.client
      .from('caregiver_reminder_policies')
      .select('*')
      .eq('patient_profile_id', patientProfileId);
    if (error || !data) return [];
    return data as CaregiverReminderPolicy[];
  }

  async upsertCaregiverPolicy(
    policy: Omit<CaregiverReminderPolicy, 'id' | 'created_at' | 'updated_at'>
  ): Promise<CaregiverReminderPolicy> {
    const { data, error } = await this.client
      .from('caregiver_reminder_policies')
      .upsert(policy, { onConflict: 'patient_profile_id,caregiver_user_id' })
      .select()
      .single();
    if (error || !data) throw new Error(`Failed to update caregiver policy: ${error?.message}`);
    return data as CaregiverReminderPolicy;
  }

  async createNotification(
    notifData: Omit<Notification, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Notification> {
    const { data, error } = await this.client.from('notifications').insert(notifData).select().single();
    if (error || !data) throw new Error(`Failed to create notification: ${error?.message}`);
    return data as Notification;
  }

  async getNotificationById(id: string): Promise<Notification | null> {
    const { data, error } = await this.client.from('notifications').select('*').eq('id', id).single();
    if (error || !data) return null;
    return data as Notification;
  }

  async listNotificationsForUser(
    userId: string,
    category?: string,
    status?: string
  ): Promise<Notification[]> {
    let q = this.client.from('notifications').select('*').eq('recipient_user_id', userId);
    if (category) q = q.eq('category', category);
    if (status) q = q.eq('status', status);
    const { data, error } = await q.order('scheduled_for', { ascending: false });
    if (error || !data) return [];
    return data as Notification[];
  }

  async updateNotification(id: string, updates: Partial<Notification>): Promise<Notification> {
    const { data, error } = await this.client
      .from('notifications')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error || !data) throw new Error(`Failed to update notification: ${error?.message}`);
    return data as Notification;
  }

  async enqueueScheduledJob(
    jobData: Omit<ScheduledJob, 'id' | 'created_at' | 'updated_at'>
  ): Promise<ScheduledJob> {
    const { data, error } = await this.client.from('scheduled_jobs').insert(jobData).select().single();
    if (error || !data) throw new Error(`Failed to enqueue scheduled job: ${error?.message}`);
    return data as ScheduledJob;
  }

  async fetchDueScheduledJobs(nowIso: string, limit = 50): Promise<ScheduledJob[]> {
    const { data, error } = await this.client
      .from('scheduled_jobs')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', nowIso)
      .order('scheduled_at', { ascending: true })
      .limit(limit);
    if (error || !data) return [];
    return data as ScheduledJob[];
  }

  async updateScheduledJob(id: string, updates: Partial<ScheduledJob>): Promise<ScheduledJob> {
    const { data, error } = await this.client
      .from('scheduled_jobs')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error || !data) throw new Error(`Failed to update scheduled job: ${error?.message}`);
    return data as ScheduledJob;
  }

  async cancelScheduledJobsByReference(referenceId: string): Promise<number> {
    const { data, error } = await this.client
      .from('scheduled_jobs')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('reference_id', referenceId)
      .eq('status', 'pending')
      .select();
    if (error) throw new Error(`Failed to cancel scheduled jobs: ${error?.message}`);
    return data ? data.length : 0;
  }

  // ---------------------------------------------------------------------------
  // Phase 5: SOS Emergency Simulation & Hospital Handoff (Supabase)
  // ---------------------------------------------------------------------------

  async createEmergencyContact(
    contactData: Omit<EmergencyContact, 'id' | 'created_at' | 'updated_at'>
  ): Promise<EmergencyContact> {
    const { data, error } = await this.client.from('emergency_contacts').insert(contactData).select().single();
    if (error || !data) throw new Error(`Failed to create emergency contact: ${error?.message}`);
    return data as EmergencyContact;
  }

  async getEmergencyContactById(id: string): Promise<EmergencyContact | null> {
    const { data, error } = await this.client.from('emergency_contacts').select('*').eq('id', id).single();
    if (error || !data) return null;
    return data as EmergencyContact;
  }

  async listEmergencyContacts(familyId: string, patientProfileId?: string): Promise<EmergencyContact[]> {
    let q = this.client.from('emergency_contacts').select('*').eq('family_id', familyId);
    if (patientProfileId) q = q.eq('patient_profile_id', patientProfileId);
    const { data, error } = await q.order('priority', { ascending: true });
    if (error || !data) return [];
    return data as EmergencyContact[];
  }

  async updateEmergencyContact(id: string, updates: Partial<EmergencyContact>): Promise<EmergencyContact> {
    const { data, error } = await this.client
      .from('emergency_contacts')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error || !data) throw new Error(`Failed to update emergency contact: ${error?.message}`);
    return data as EmergencyContact;
  }

  async deleteEmergencyContact(id: string): Promise<void> {
    const { error } = await this.client.from('emergency_contacts').delete().eq('id', id);
    if (error) throw new Error(`Failed to delete emergency contact: ${error.message}`);
  }

  async getEmergencyEscalationPolicy(familyId: string, patientProfileId: string): Promise<EmergencyEscalationPolicy | null> {
    const { data, error } = await this.client
      .from('emergency_escalation_policies')
      .select('*')
      .eq('family_id', familyId)
      .eq('patient_profile_id', patientProfileId)
      .single();
    if (error || !data) return null;
    return data as EmergencyEscalationPolicy;
  }

  async upsertEmergencyEscalationPolicy(
    policyData: Omit<EmergencyEscalationPolicy, 'id' | 'created_at' | 'updated_at'>
  ): Promise<EmergencyEscalationPolicy> {
    const existing = await this.getEmergencyEscalationPolicy(policyData.family_id, policyData.patient_profile_id);
    if (existing) {
      const { data, error } = await this.client
        .from('emergency_escalation_policies')
        .update({ ...policyData, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single();
      if (error || !data) throw new Error(`Failed to update emergency policy: ${error?.message}`);
      return data as EmergencyEscalationPolicy;
    } else {
      const { data, error } = await this.client
        .from('emergency_escalation_policies')
        .insert(policyData)
        .select()
        .single();
      if (error || !data) throw new Error(`Failed to create emergency policy: ${error?.message}`);
      return data as EmergencyEscalationPolicy;
    }
  }

  async createEmergencyIncident(
    incidentData: Omit<EmergencyIncident, 'id' | 'created_at' | 'updated_at'>
  ): Promise<EmergencyIncident> {
    const { data, error } = await this.client.from('emergency_incidents').insert(incidentData).select().single();
    if (error || !data) throw new Error(`Failed to create emergency incident: ${error?.message}`);
    return data as EmergencyIncident;
  }

  async getEmergencyIncidentById(id: string): Promise<EmergencyIncident | null> {
    const { data, error } = await this.client.from('emergency_incidents').select('*').eq('id', id).single();
    if (error || !data) return null;
    return data as EmergencyIncident;
  }

  async getActiveEmergencyIncident(familyId: string, patientProfileId: string): Promise<EmergencyIncident | null> {
    const { data, error } = await this.client
      .from('emergency_incidents')
      .select('*')
      .eq('family_id', familyId)
      .eq('patient_profile_id', patientProfileId)
      .not('status', 'in', '("RESOLVED","CANCELLED","ESCALATION_FAILED")')
      .order('activated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return data as EmergencyIncident;
  }

  async listEmergencyIncidents(familyId: string, patientProfileId?: string): Promise<EmergencyIncident[]> {
    let q = this.client.from('emergency_incidents').select('*').eq('family_id', familyId);
    if (patientProfileId) q = q.eq('patient_profile_id', patientProfileId);
    const { data, error } = await q.order('activated_at', { ascending: false });
    if (error || !data) return [];
    return data as EmergencyIncident[];
  }

  async updateEmergencyIncident(id: string, updates: Partial<EmergencyIncident>): Promise<EmergencyIncident> {
    const { data, error } = await this.client
      .from('emergency_incidents')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error || !data) throw new Error(`Failed to update emergency incident: ${error?.message}`);
    return data as EmergencyIncident;
  }

  async createEmergencyContactAttempt(
    attemptData: Omit<EmergencyContactAttempt, 'id' | 'created_at' | 'updated_at'>
  ): Promise<EmergencyContactAttempt> {
    const { data, error } = await this.client.from('emergency_contact_attempts').insert(attemptData).select().single();
    if (error || !data) throw new Error(`Failed to create emergency contact attempt: ${error?.message}`);
    return data as EmergencyContactAttempt;
  }

  async getEmergencyContactAttemptById(id: string): Promise<EmergencyContactAttempt | null> {
    const { data, error } = await this.client.from('emergency_contact_attempts').select('*').eq('id', id).single();
    if (error || !data) return null;
    return data as EmergencyContactAttempt;
  }

  async listEmergencyContactAttempts(incidentId: string): Promise<EmergencyContactAttempt[]> {
    const { data, error } = await this.client
      .from('emergency_contact_attempts')
      .select('*')
      .eq('incident_id', incidentId)
      .order('attempted_at', { ascending: true });
    if (error || !data) return [];
    return data as EmergencyContactAttempt[];
  }

  async updateEmergencyContactAttempt(
    id: string,
    updates: Partial<EmergencyContactAttempt>
  ): Promise<EmergencyContactAttempt> {
    const { data, error } = await this.client
      .from('emergency_contact_attempts')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error || !data) throw new Error(`Failed to update emergency contact attempt: ${error?.message}`);
    return data as EmergencyContactAttempt;
  }

  async createEmergencyIncidentEvent(
    eventData: Omit<EmergencyIncidentEvent, 'id' | 'created_at'>
  ): Promise<EmergencyIncidentEvent> {
    const { data, error } = await this.client.from('emergency_incident_events').insert(eventData).select().single();
    if (error || !data) throw new Error(`Failed to create incident event: ${error?.message}`);
    return data as EmergencyIncidentEvent;
  }

  async listEmergencyIncidentEvents(incidentId: string): Promise<EmergencyIncidentEvent[]> {
    const { data, error } = await this.client
      .from('emergency_incident_events')
      .select('*')
      .eq('incident_id', incidentId)
      .order('created_at', { ascending: true });
    if (error || !data) return [];
    return data as EmergencyIncidentEvent[];
  }

  async createHospitalHandoff(
    handoffData: Omit<HospitalHandoff, 'id' | 'created_at' | 'updated_at'>
  ): Promise<HospitalHandoff> {
    const { data, error } = await this.client.from('hospital_handoffs').insert(handoffData).select().single();
    if (error || !data) throw new Error(`Failed to create hospital handoff: ${error?.message}`);
    return data as HospitalHandoff;
  }

  async getHospitalHandoffByIncidentId(incidentId: string): Promise<HospitalHandoff | null> {
    const { data, error } = await this.client.from('hospital_handoffs').select('*').eq('incident_id', incidentId).maybeSingle();
    if (error || !data) return null;
    return data as HospitalHandoff;
  }

  async updateHospitalHandoff(id: string, updates: Partial<HospitalHandoff>): Promise<HospitalHandoff> {
    const { data, error } = await this.client
      .from('hospital_handoffs')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error || !data) throw new Error(`Failed to update hospital handoff: ${error?.message}`);
    return data as HospitalHandoff;
  }

  async resetEmergencyDemoScenario(familyId: string, patientProfileId: string): Promise<void> {
    const { data: incidents } = await this.client
      .from('emergency_incidents')
      .select('id')
      .eq('family_id', familyId)
      .eq('patient_profile_id', patientProfileId);

    if (incidents && incidents.length > 0) {
      const ids = incidents.map((i) => i.id);
      for (const id of ids) {
        await this.cancelScheduledJobsByReference(id);
      }
      await this.client.from('emergency_incidents').delete().in('id', ids);
    }

    await this.client
      .from('emergency_contacts')
      .delete()
      .eq('family_id', familyId)
      .eq('patient_profile_id', patientProfileId)
      .eq('is_demo', true);

    await this.client
      .from('emergency_escalation_policies')
      .delete()
      .eq('family_id', familyId)
      .eq('patient_profile_id', patientProfileId);
  }

  // ---------------------------------------------------------------------------
  // Phase 6: Live Test Recipients & Telephony Audit Logs
  // ---------------------------------------------------------------------------
  async listLiveTestRecipients(familyId: string): Promise<LiveTestRecipient[]> {
    const { data, error } = await this.client
      .from('live_test_recipients')
      .select('*')
      .eq('family_id', familyId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []) as LiveTestRecipient[];
  }

  async getLiveTestRecipient(id: string): Promise<LiveTestRecipient | null> {
    const { data, error } = await this.client
      .from('live_test_recipients')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return (data as LiveTestRecipient) || null;
  }

  async createLiveTestRecipient(
    recipient: Omit<LiveTestRecipient, 'id' | 'created_at' | 'updated_at'>
  ): Promise<LiveTestRecipient> {
    const { data, error } = await this.client
      .from('live_test_recipients')
      .insert(recipient)
      .select()
      .single();
    if (error) throw error;
    return data as LiveTestRecipient;
  }

  async updateLiveTestRecipient(
    id: string,
    updates: Partial<LiveTestRecipient>
  ): Promise<LiveTestRecipient> {
    const { data, error } = await this.client
      .from('live_test_recipients')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as LiveTestRecipient;
  }

  async deleteLiveTestRecipient(id: string): Promise<void> {
    const { error } = await this.client
      .from('live_test_recipients')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  async createLiveTestAuditLog(
    log: Omit<LiveTestAuditLog, 'id' | 'created_at' | 'updated_at'>
  ): Promise<LiveTestAuditLog> {
    const { data, error } = await this.client
      .from('live_test_audit_logs')
      .insert(log)
      .select()
      .single();
    if (error) throw error;
    return data as LiveTestAuditLog;
  }

  async getLiveTestAuditLog(id: string): Promise<LiveTestAuditLog | null> {
    const { data, error } = await this.client
      .from('live_test_audit_logs')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return (data as LiveTestAuditLog) || null;
  }

  async listLiveTestAuditLogs(familyId: string, incidentId?: string): Promise<LiveTestAuditLog[]> {
    let q = this.client
      .from('live_test_audit_logs')
      .select('*')
      .eq('family_id', familyId)
      .order('created_at', { ascending: false });
    if (incidentId) {
      q = q.eq('incident_id', incidentId);
    }
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as LiveTestAuditLog[];
  }

  async updateLiveTestAuditLog(
    id: string,
    updates: Partial<LiveTestAuditLog>
  ): Promise<LiveTestAuditLog> {
    const { data, error } = await this.client
      .from('live_test_audit_logs')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as LiveTestAuditLog;
  }

  async getLiveTestAuditLogByProviderRequestId(providerRequestId: string): Promise<LiveTestAuditLog | null> {
    if (!providerRequestId) return null;
    const { data, error } = await this.client
      .from('live_test_audit_logs')
      .select('*')
      .eq('provider_request_id', providerRequestId)
      .maybeSingle();
    if (error) throw error;
    return (data as LiveTestAuditLog) || null;
  }

  // ---------------------------------------------------------------------------
  // Phase 7: Offline Sync Operations & Conflict Handling (Supabase)
  // ---------------------------------------------------------------------------
  async saveSyncOperation(
    op: Omit<SyncOperation, 'id' | 'created_at' | 'updated_at'>
  ): Promise<SyncOperation> {
    const { data, error } = await this.client
      .from('sync_operations')
      .upsert(
        {
          ...op,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'family_id,client_operation_id' }
      )
      .select()
      .single();
    if (error) throw error;
    return data as SyncOperation;
  }

  async getSyncOperationByClientOpId(familyId: string, clientOpId: string): Promise<SyncOperation | null> {
    const { data, error } = await this.client
      .from('sync_operations')
      .select('*')
      .eq('family_id', familyId)
      .eq('client_operation_id', clientOpId)
      .maybeSingle();
    if (error) throw error;
    return (data as SyncOperation) || null;
  }

  async getSyncOperationByIdempotencyKey(familyId: string, idempotencyKey: string): Promise<SyncOperation | null> {
    const { data, error } = await this.client
      .from('sync_operations')
      .select('*')
      .eq('family_id', familyId)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();
    if (error) throw error;
    return (data as SyncOperation) || null;
  }

  async listSyncOperations(familyId: string, limit = 50): Promise<SyncOperation[]> {
    const { data, error } = await this.client
      .from('sync_operations')
      .select('*')
      .eq('family_id', familyId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []) as SyncOperation[];
  }

  async updateSyncOperation(id: string, updates: Partial<SyncOperation>): Promise<SyncOperation> {
    const { data, error } = await this.client
      .from('sync_operations')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as SyncOperation;
  }

  async createSyncConflict(
    conflict: Omit<SyncConflict, 'id' | 'created_at' | 'updated_at'>
  ): Promise<SyncConflict> {
    const { data, error } = await this.client
      .from('sync_conflicts')
      .insert({
        ...conflict,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    return data as SyncConflict;
  }

  async getSyncConflictById(id: string): Promise<SyncConflict | null> {
    const { data, error } = await this.client
      .from('sync_conflicts')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return (data as SyncConflict) || null;
  }

  async listSyncConflicts(
    familyId: string,
    patientProfileId?: string,
    status?: SyncConflictResolutionStatus
  ): Promise<SyncConflict[]> {
    let q = this.client
      .from('sync_conflicts')
      .select('*')
      .eq('family_id', familyId)
      .order('created_at', { ascending: false });

    if (patientProfileId) {
      q = q.eq('patient_profile_id', patientProfileId);
    }
    if (status) {
      q = q.eq('resolution_status', status);
    }

    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as SyncConflict[];
  }

  async resolveSyncConflict(
    id: string,
    resolution: SyncConflictResolutionStatus,
    resolvedBy: string,
    resolvedValue?: Record<string, unknown>
  ): Promise<SyncConflict> {
    const now = new Date().toISOString();
    const { data, error } = await this.client
      .from('sync_conflicts')
      .update({
        resolution_status: resolution,
        resolved_by: resolvedBy,
        resolved_at: now,
        resolved_value: resolvedValue || null,
        updated_at: now,
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as SyncConflict;
  }

  async getChangesSince(
    familyId: string,
    sinceIso: string,
    patientProfileId?: string
  ): Promise<{
    patients: PatientProfile[];
    documents: HealthDocument[];
    medications: MedicationSchedule[];
    appointments: Appointment[];
  }> {
    // Patients
    let patQuery = this.client.from('patient_profiles').select('*').eq('family_id', familyId).gte('updated_at', sinceIso);
    if (patientProfileId) patQuery = patQuery.eq('id', patientProfileId);
    const { data: patients, error: patErr } = await patQuery;
    if (patErr) throw patErr;

    // Documents
    let docQuery = this.client.from('health_documents').select('*').eq('family_id', familyId).gte('updated_at', sinceIso);
    if (patientProfileId) docQuery = docQuery.eq('patient_profile_id', patientProfileId);
    const { data: documents, error: docErr } = await docQuery;
    if (docErr) throw docErr;

    // Medications
    let medQuery = this.client.from('medication_schedules').select('*').eq('family_id', familyId).gte('updated_at', sinceIso);
    if (patientProfileId) medQuery = medQuery.eq('patient_profile_id', patientProfileId);
    const { data: medications, error: medErr } = await medQuery;
    if (medErr) throw medErr;

    // Appointments
    let apptQuery = this.client.from('appointments').select('*').eq('family_id', familyId).gte('updated_at', sinceIso);
    if (patientProfileId) apptQuery = apptQuery.eq('patient_profile_id', patientProfileId);
    const { data: appointments, error: apptErr } = await apptQuery;
    if (apptErr) throw apptErr;

    return {
      patients: (patients || []) as PatientProfile[],
      documents: (documents || []) as HealthDocument[],
      medications: (medications || []) as MedicationSchedule[],
      appointments: (appointments || []) as Appointment[],
    };
  }

  async authenticateDemoUser(): Promise<UserProfile | null> {
    throw new Error('Demo authentication is not active in Live Supabase mode');
  }

  async registerDemoUser(): Promise<UserProfile> {
    throw new Error('Demo registration is not active in Live Supabase mode');
  }

  // ---------------------------------------------------------------------------
  // Phase 8: Community Groups, Assistance & Moderation (Supabase)
  // ---------------------------------------------------------------------------
  async createCommunityGroup(groupData: Omit<CommunityGroup, 'id' | 'created_at' | 'updated_at'>): Promise<CommunityGroup> {
    const { data, error } = await this.client
      .from('community_groups')
      .insert(groupData)
      .select('*')
      .single();
    if (error) throw error;
    return data as CommunityGroup;
  }

  async getCommunityGroupById(id: string): Promise<CommunityGroup | null> {
    const { data, error } = await this.client
      .from('community_groups')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return (data as CommunityGroup) || null;
  }

  async listCommunityGroupsForUser(userId: string): Promise<CommunityGroup[]> {
    const { data: memberships, error: memErr } = await this.client
      .from('community_memberships')
      .select('community_id')
      .eq('user_id', userId)
      .eq('status', 'active');
    if (memErr) throw memErr;
    if (!memberships || memberships.length === 0) return [];

    const communityIds = memberships.map((m) => m.community_id);
    const { data, error } = await this.client
      .from('community_groups')
      .select('*')
      .in('id', communityIds);
    if (error) throw error;
    return (data || []) as CommunityGroup[];
  }

  async listPublicCommunityGroups(locality?: string): Promise<CommunityGroup[]> {
    let query = this.client
      .from('community_groups')
      .select('*')
      .eq('status', 'active');
    if (locality) {
      query = query.ilike('approximate_locality', `%${locality}%`);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as CommunityGroup[];
  }

  async updateCommunityGroup(id: string, patch: Partial<CommunityGroup>): Promise<CommunityGroup> {
    const { data, error } = await this.client
      .from('community_groups')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data as CommunityGroup;
  }

  // Memberships
  async createCommunityMembership(memData: Omit<CommunityMembership, 'id' | 'created_at' | 'updated_at' | 'joined_at'>): Promise<CommunityMembership> {
    const { data, error } = await this.client
      .from('community_memberships')
      .insert(memData)
      .select('*')
      .single();
    if (error) throw error;
    return data as CommunityMembership;
  }

  async getCommunityMembership(communityId: string, userId: string): Promise<CommunityMembership | null> {
    const { data, error } = await this.client
      .from('community_memberships')
      .select('*')
      .eq('community_id', communityId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return (data as CommunityMembership) || null;
  }

  async listCommunityMemberships(communityId: string): Promise<CommunityMembership[]> {
    const { data, error } = await this.client
      .from('community_memberships')
      .select('*')
      .eq('community_id', communityId)
      .eq('status', 'active');
    if (error) throw error;
    return (data || []) as CommunityMembership[];
  }

  async updateCommunityMembership(id: string, patch: Partial<CommunityMembership>): Promise<CommunityMembership> {
    const { data, error } = await this.client
      .from('community_memberships')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data as CommunityMembership;
  }

  async deleteCommunityMembership(id: string): Promise<void> {
    const { error } = await this.client
      .from('community_memberships')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  // Invitations
  async createCommunityInvitation(invData: Omit<CommunityInvitation, 'id' | 'created_at' | 'updated_at'>): Promise<CommunityInvitation> {
    const { data, error } = await this.client
      .from('community_invitations')
      .insert(invData)
      .select('*')
      .single();
    if (error) throw error;
    return data as CommunityInvitation;
  }

  async getCommunityInvitationByCode(code: string): Promise<CommunityInvitation | null> {
    const { data, error } = await this.client
      .from('community_invitations')
      .select('*')
      .eq('invite_code', code)
      .maybeSingle();
    if (error) throw error;
    return (data as CommunityInvitation) || null;
  }

  async getCommunityInvitationById(id: string): Promise<CommunityInvitation | null> {
    const { data, error } = await this.client
      .from('community_invitations')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return (data as CommunityInvitation) || null;
  }

  async listCommunityInvitationsForUser(email: string): Promise<CommunityInvitation[]> {
    const { data, error } = await this.client
      .from('community_invitations')
      .select('*')
      .ilike('invitee_email', email)
      .eq('status', 'pending');
    if (error) throw error;
    return (data || []) as CommunityInvitation[];
  }

  async listCommunityInvitationsForGroup(communityId: string): Promise<CommunityInvitation[]> {
    const { data, error } = await this.client
      .from('community_invitations')
      .select('*')
      .eq('community_id', communityId);
    if (error) throw error;
    return (data || []) as CommunityInvitation[];
  }

  async updateCommunityInvitation(id: string, patch: Partial<CommunityInvitation>): Promise<CommunityInvitation> {
    const { data, error } = await this.client
      .from('community_invitations')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data as CommunityInvitation;
  }

  // Join Requests
  async createCommunityJoinRequest(reqData: Omit<CommunityJoinRequest, 'id' | 'created_at' | 'updated_at'>): Promise<CommunityJoinRequest> {
    const { data, error } = await this.client
      .from('community_join_requests')
      .insert(reqData)
      .select('*')
      .single();
    if (error) throw error;
    return data as CommunityJoinRequest;
  }

  async getCommunityJoinRequestById(id: string): Promise<CommunityJoinRequest | null> {
    const { data, error } = await this.client
      .from('community_join_requests')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return (data as CommunityJoinRequest) || null;
  }

  async listCommunityJoinRequests(communityId: string, status?: string): Promise<CommunityJoinRequest[]> {
    let query = this.client
      .from('community_join_requests')
      .select('*')
      .eq('community_id', communityId);
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as CommunityJoinRequest[];
  }

  async updateCommunityJoinRequest(id: string, patch: Partial<CommunityJoinRequest>): Promise<CommunityJoinRequest> {
    const { data, error } = await this.client
      .from('community_join_requests')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data as CommunityJoinRequest;
  }

  // Assistance Requests
  async createAssistanceRequest(reqData: Omit<AssistanceRequest, 'id' | 'created_at' | 'updated_at'>): Promise<AssistanceRequest> {
    const { data, error } = await this.client
      .from('assistance_requests')
      .insert(reqData)
      .select('*')
      .single();
    if (error) throw error;
    return data as AssistanceRequest;
  }

  async getAssistanceRequestById(id: string): Promise<AssistanceRequest | null> {
    const { data, error } = await this.client
      .from('assistance_requests')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return (data as AssistanceRequest) || null;
  }

  async listAssistanceRequests(communityId: string, filter?: { category?: string; status?: string }): Promise<AssistanceRequest[]> {
    let query = this.client
      .from('assistance_requests')
      .select('*')
      .eq('community_id', communityId);
    if (filter?.category) query = query.eq('request_category', filter.category);
    if (filter?.status) query = query.eq('status', filter.status);
    query = query.order('created_at', { ascending: false });
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as AssistanceRequest[];
  }

  async updateAssistanceRequest(id: string, patch: Partial<AssistanceRequest>): Promise<AssistanceRequest> {
    const { data, error } = await this.client
      .from('assistance_requests')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data as AssistanceRequest;
  }

  // Assistance Assignments
  async createAssistanceAssignment(assignData: Omit<AssistanceAssignment, 'id' | 'created_at' | 'updated_at'>): Promise<AssistanceAssignment> {
    const { data, error } = await this.client
      .from('assistance_assignments')
      .insert(assignData)
      .select('*')
      .single();
    if (error) throw error;
    return data as AssistanceAssignment;
  }

  async getAssistanceAssignment(requestId: string, volunteerUserId: string): Promise<AssistanceAssignment | null> {
    const { data, error } = await this.client
      .from('assistance_assignments')
      .select('*')
      .eq('request_id', requestId)
      .eq('volunteer_user_id', volunteerUserId)
      .maybeSingle();
    if (error) throw error;
    return (data as AssistanceAssignment) || null;
  }

  async listAssistanceAssignments(requestId: string): Promise<AssistanceAssignment[]> {
    const { data, error } = await this.client
      .from('assistance_assignments')
      .select('*')
      .eq('request_id', requestId);
    if (error) throw error;
    return (data || []) as AssistanceAssignment[];
  }

  async updateAssistanceAssignment(id: string, patch: Partial<AssistanceAssignment>): Promise<AssistanceAssignment> {
    const { data, error } = await this.client
      .from('assistance_assignments')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data as AssistanceAssignment;
  }

  // Blood Donor Requests
  async createBloodDonorRequest(reqData: Omit<BloodDonorRequest, 'id' | 'created_at' | 'updated_at'>): Promise<BloodDonorRequest> {
    const { data, error } = await this.client
      .from('blood_donor_requests')
      .insert(reqData)
      .select('*')
      .single();
    if (error) throw error;
    return data as BloodDonorRequest;
  }

  async getBloodDonorRequestById(id: string): Promise<BloodDonorRequest | null> {
    const { data, error } = await this.client
      .from('blood_donor_requests')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return (data as BloodDonorRequest) || null;
  }

  async listBloodDonorRequests(communityId: string, filter?: { bloodGroup?: string; status?: string }): Promise<BloodDonorRequest[]> {
    let query = this.client
      .from('blood_donor_requests')
      .select('*')
      .eq('community_id', communityId);
    if (filter?.bloodGroup && filter.bloodGroup !== 'any') {
      query = query.eq('blood_group', filter.bloodGroup);
    }
    if (filter?.status) {
      query = query.eq('status', filter.status);
    }
    query = query.order('created_at', { ascending: false });
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as BloodDonorRequest[];
  }

  async updateBloodDonorRequest(id: string, patch: Partial<BloodDonorRequest>): Promise<BloodDonorRequest> {
    const { data, error } = await this.client
      .from('blood_donor_requests')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data as BloodDonorRequest;
  }

  // Donor Responses
  async createDonorResponse(respData: Omit<DonorResponse, 'id' | 'created_at' | 'updated_at'>): Promise<DonorResponse> {
    const { data, error } = await this.client
      .from('donor_responses')
      .insert(respData)
      .select('*')
      .single();
    if (error) throw error;
    return data as DonorResponse;
  }

  async getDonorResponse(requestId: string, donorUserId: string): Promise<DonorResponse | null> {
    const { data, error } = await this.client
      .from('donor_responses')
      .select('*')
      .eq('request_id', requestId)
      .eq('donor_user_id', donorUserId)
      .maybeSingle();
    if (error) throw error;
    return (data as DonorResponse) || null;
  }

  async listDonorResponses(requestId: string): Promise<DonorResponse[]> {
    const { data, error } = await this.client
      .from('donor_responses')
      .select('*')
      .eq('request_id', requestId);
    if (error) throw error;
    return (data || []) as DonorResponse[];
  }

  async updateDonorResponse(id: string, patch: Partial<DonorResponse>): Promise<DonorResponse> {
    const { data, error } = await this.client
      .from('donor_responses')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data as DonorResponse;
  }

  // Contact Grants
  async createContactGrant(grantData: Omit<ContactSharingGrant, 'id' | 'created_at'>): Promise<ContactSharingGrant> {
    const { data, error } = await this.client
      .from('contact_sharing_grants')
      .insert(grantData)
      .select('*')
      .single();
    if (error) throw error;
    return data as ContactSharingGrant;
  }

  async getContactGrant(resourceType: string, resourceId: string, grantedToUserId: string): Promise<ContactSharingGrant | null> {
    const { data, error } = await this.client
      .from('contact_sharing_grants')
      .select('*')
      .eq('resource_type', resourceType)
      .eq('resource_id', resourceId)
      .eq('granted_to_user_id', grantedToUserId)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (error) throw error;
    return (data as ContactSharingGrant) || null;
  }

  async listContactGrants(resourceType: string, resourceId: string): Promise<ContactSharingGrant[]> {
    const { data, error } = await this.client
      .from('contact_sharing_grants')
      .select('*')
      .eq('resource_type', resourceType)
      .eq('resource_id', resourceId);
    if (error) throw error;
    return (data || []) as ContactSharingGrant[];
  }

  async revokeContactGrant(id: string): Promise<ContactSharingGrant> {
    const { data, error } = await this.client
      .from('contact_sharing_grants')
      .update({ status: 'revoked' })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data as ContactSharingGrant;
  }

  // Moderation
  async createCommunityReport(reportData: Omit<CommunityReport, 'id' | 'created_at' | 'updated_at'>): Promise<CommunityReport> {
    const { data, error } = await this.client
      .from('community_reports')
      .insert(reportData)
      .select('*')
      .single();
    if (error) throw error;
    return data as CommunityReport;
  }

  async getCommunityReportById(id: string): Promise<CommunityReport | null> {
    const { data, error } = await this.client
      .from('community_reports')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return (data as CommunityReport) || null;
  }

  async listCommunityReports(communityId: string, status?: string): Promise<CommunityReport[]> {
    let query = this.client
      .from('community_reports')
      .select('*')
      .eq('community_id', communityId);
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as CommunityReport[];
  }

  async updateCommunityReport(id: string, patch: Partial<CommunityReport>): Promise<CommunityReport> {
    const { data, error } = await this.client
      .from('community_reports')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data as CommunityReport;
  }

  async createModerationAction(actData: Omit<ModerationAction, 'id' | 'created_at'>): Promise<ModerationAction> {
    const { data, error } = await this.client
      .from('moderation_actions')
      .insert(actData)
      .select('*')
      .single();
    if (error) throw error;
    return data as ModerationAction;
  }

  async listModerationActions(communityId: string): Promise<ModerationAction[]> {
    const { data, error } = await this.client
      .from('moderation_actions')
      .select('*')
      .eq('community_id', communityId);
    if (error) throw error;
    return (data || []) as ModerationAction[];
  }
}

// Export singleton database repository according to config
export const db: IDatabaseRepository =
  config.isDemoMode || !config.supabase.url
    ? new InMemoryDatabaseRepository()
    : new SupabaseDatabaseRepository();
