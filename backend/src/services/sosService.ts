/**
 * backend/src/services/sosService.ts
 *
 * Core Service for Phase 5: SOS Emergency Response Simulation & Hospital Handoff.
 *
 * Enforces:
 * - Server-controlled state machine for emergency incident lifecycle
 * - Complete isolation from external communications (zero real SMS, voice calls, or hospital endpoints)
 * - Strict simulation provenance ('DEMO_SIMULATION_ONLY')
 * - Interactive family and caregiver acknowledgement tracking
 * - Background-driven timeout escalation
 * - Comprehensive event timeline and synthetic hospital packet handoff
 */

import { db } from '../repositories/database.js';
import { createError } from '../middlewares/errorHandler.js';
import { logger } from '../config/logger.js';
import {
  EmergencyIncident,
  EmergencyIncidentStatus,
  EmergencyContact,
  EmergencyContactAttempt,
  EmergencyIncidentEvent,
  EmergencyEscalationPolicy,
  HospitalHandoff,
  PatientProfile,
} from '../types/models.js';

export interface TriggerSosOptions {
  patientProfileId?: string;
  patient_profile_id?: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  locationNote?: string;
  location_note?: string;
}

export class SosService {
  /**
   * Helper: Allowed transitions in the incident state machine
   */
  private readonly validTransitions: Record<EmergencyIncidentStatus, EmergencyIncidentStatus[]> = {
    CREATED: ['CONTACTING_FAMILY', 'AWAITING_FAMILY_RESPONSE', 'CANCELLED'],
    CONTACTING_FAMILY: ['AWAITING_FAMILY_RESPONSE', 'CANCELLED', 'ESCALATION_FAILED'],
    AWAITING_FAMILY_RESPONSE: [
      'FAMILY_RESPONDED',
      'ESCALATING_CAREGIVER',
      'AWAITING_CAREGIVER_RESPONSE',
      'CANCELLED',
      'RESOLVED',
    ],
    FAMILY_RESPONDED: ['RESOLVED', 'CANCELLED'],
    ESCALATING_CAREGIVER: ['AWAITING_CAREGIVER_RESPONSE', 'CANCELLED', 'ESCALATION_FAILED'],
    AWAITING_CAREGIVER_RESPONSE: [
      'CAREGIVER_RESPONDED',
      'HOSPITAL_HANDOFF_PENDING',
      'HOSPITAL_HANDOFF_SIMULATED',
      'CANCELLED',
      'RESOLVED',
    ],
    CAREGIVER_RESPONDED: ['RESOLVED', 'CANCELLED'],
    HOSPITAL_HANDOFF_PENDING: ['HOSPITAL_HANDOFF_SIMULATED', 'CANCELLED', 'RESOLVED', 'ESCALATION_FAILED'],
    HOSPITAL_HANDOFF_SIMULATED: ['RESOLVED', 'CANCELLED'],
    RESOLVED: [], // Terminal
    CANCELLED: [], // Terminal
    ESCALATION_FAILED: ['CANCELLED', 'RESOLVED'],
  };

  /**
   * Validates state transition
   */
  canTransition(currentStatus: EmergencyIncidentStatus, targetStatus: EmergencyIncidentStatus): boolean {
    const allowed = this.validTransitions[currentStatus] || [];
    return allowed.includes(targetStatus);
  }

  /**
   * Generates a unique, human-readable Incident Number (e.g. SOS-20261022-X7K2)
   */
  private generateIncidentNumber(): string {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `SOS-${dateStr}-${rand}`;
  }

  /**
   * Seeds default fictional demo contacts for a patient if none exist
   */
  async ensureDemoContacts(familyId: string, patientProfileId: string): Promise<EmergencyContact[]> {
    const existing = await db.listEmergencyContacts(familyId, patientProfileId);
    if (existing.length > 0) return existing;

    const contact1 = await db.createEmergencyContact({
      family_id: familyId,
      patient_profile_id: patientProfileId,
      name: 'Ramesh Sharma (Son)',
      relationship: 'Son',
      phone_number: '+91-98765-00001 (Simulated)',
      role: 'primary_family',
      priority: 1,
      is_active: true,
      is_demo: true,
      simulation_provenance: 'DEMO_SIMULATION_ONLY',
    });

    const contact2 = await db.createEmergencyContact({
      family_id: familyId,
      patient_profile_id: patientProfileId,
      name: 'Priya Sharma (Daughter)',
      relationship: 'Daughter',
      phone_number: '+91-98765-00002 (Simulated)',
      role: 'secondary_family',
      priority: 2,
      is_active: true,
      is_demo: true,
      simulation_provenance: 'DEMO_SIMULATION_ONLY',
    });

    const contact3 = await db.createEmergencyContact({
      family_id: familyId,
      patient_profile_id: patientProfileId,
      name: 'Dr. Arvind Mehta (Home Nurse / Caregiver)',
      relationship: 'Designated Caregiver',
      phone_number: '+91-98765-00003 (Simulated)',
      role: 'caregiver',
      priority: 3,
      is_active: true,
      is_demo: true,
      simulation_provenance: 'DEMO_SIMULATION_ONLY',
    });

    return [contact1, contact2, contact3];
  }

  /**
   * Ensures default escalation policy exists for patient
   */
  async getOrCreatePolicy(familyId: string, patientProfileId: string): Promise<EmergencyEscalationPolicy> {
    const existing = await db.getEmergencyEscalationPolicy(familyId, patientProfileId);
    if (existing) return existing;

    return await db.upsertEmergencyEscalationPolicy({
      family_id: familyId,
      patient_profile_id: patientProfileId,
      family_response_timeout_seconds: 15,
      caregiver_response_timeout_seconds: 15,
      advance_to_hospital_on_timeout: true,
      hospital_name: 'Apollo Indraprastha Fictional Hospital (Demo Desk)',
      hospital_department: 'Emergency Receiving Desk (Simulated)',
      is_active: true,
      is_demo: true,
      simulation_provenance: 'DEMO_SIMULATION_ONLY',
    });
  }

  /**
   * Triggers a new emergency incident in Demo Mode
   */
  async triggerSos(
    userId: string,
    familyId: string,
    options: TriggerSosOptions
  ): Promise<{ incident: EmergencyIncident; attempts: EmergencyContactAttempt[] }> {
    const patientProfileId = options.patientProfileId || options.patient_profile_id;
    if (!patientProfileId) {
      throw createError('Patient profile ID is required to trigger SOS', 400);
    }

    // 1. Verify patient belongs to family
    const patient = await db.getPatientProfileById(patientProfileId);
    if (!patient || patient.family_id !== familyId) {
      throw createError('Patient profile not found in this family workspace', 404);
    }

    // 2. Duplicate Protection: Check if active incident already exists
    const active = await db.getActiveEmergencyIncident(familyId, patientProfileId);
    if (active) {
      throw createError(
        `An active emergency incident is already in progress for ${patient.full_name} (${active.incident_number}). Please resolve or cancel it before starting a new one.`,
        409
      );
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const policy = await this.getOrCreatePolicy(familyId, patientProfileId);
    const deadlineIso = new Date(now.getTime() + policy.family_response_timeout_seconds * 1000).toISOString();
    const incidentNumber = this.generateIncidentNumber();

    // 3. Create persisted incident
    const incident = await db.createEmergencyIncident({
      incident_number: incidentNumber,
      family_id: familyId,
      patient_profile_id: patientProfileId,
      initiated_by_user_id: userId,
      status: 'AWAITING_FAMILY_RESPONSE',
      current_stage: 'FAMILY_CONTACT',
      severity: options.severity || 'CRITICAL',
      location_note: options.locationNote || options.location_note || 'Home (Coordinates unavailable in demo)',
      is_demo: true,
      simulation_provenance: 'DEMO_SIMULATION_ONLY',
      activated_at: nowIso,
      response_deadline: deadlineIso,
      metadata: {
        familyResponseTimeoutSeconds: policy.family_response_timeout_seconds,
        caregiverResponseTimeoutSeconds: policy.caregiver_response_timeout_seconds,
        hospitalName: policy.hospital_name,
      },
    });

    // 4. Record initial activation event
    await db.createEmergencyIncidentEvent({
      incident_id: incident.id,
      event_type: 'INCIDENT_CREATED',
      title: 'SOS Incident Activated (Demo Simulation)',
      description: `SOS activated for ${patient.full_name} (${patient.health_id}). Severity: ${incident.severity}. Demonstration mode active — all emergency contacts, calls, and hospital handoffs are synthetic.`,
      actor_type: 'USER',
      actor_id: userId,
      stage: 'FAMILY_CONTACT',
      payload: {
        incidentNumber: incident.incident_number,
        patientName: patient.full_name,
        healthId: patient.health_id,
        severity: incident.severity,
      },
      is_demo: true,
      simulation_provenance: 'DEMO_SIMULATION_ONLY',
    });

    // 5. Ensure demo contacts exist & create simulated contact attempts
    const contacts = await this.ensureDemoContacts(familyId, patientProfileId);
    const familyContacts = contacts.filter((c) => c.role === 'primary_family' || c.role === 'secondary_family');

    const attempts: EmergencyContactAttempt[] = [];
    for (const contact of familyContacts) {
      const attempt = await db.createEmergencyContactAttempt({
        incident_id: incident.id,
        contact_id: contact.id,
        contact_name: contact.name,
        contact_role: contact.role,
        channel: 'SIMULATED_VOICE_SMS',
        stage: 'FAMILY_CONTACT',
        status: 'AWAITING_RESPONSE',
        attempted_at: nowIso,
        is_demo: true,
        simulation_provenance: 'DEMO_SIMULATION_ONLY',
      });
      attempts.push(attempt);

      // Record dispatch event
      await db.createEmergencyIncidentEvent({
        incident_id: incident.id,
        event_type: 'FAMILY_ALERT_DISPATCHED',
        title: `Simulated Alert Dispatched to ${contact.name}`,
        description: `Simulated high-priority voice/SMS alert delivered to ${contact.name} (${contact.role}, ${contact.phone_number}). Status: Awaiting response (${policy.family_response_timeout_seconds}s window).`,
        actor_type: 'SYSTEM_SCHEDULER',
        stage: 'FAMILY_CONTACT',
        payload: {
          contactId: contact.id,
          attemptId: attempt.id,
          contactName: contact.name,
          role: contact.role,
        },
        is_demo: true,
        simulation_provenance: 'DEMO_SIMULATION_ONLY',
      });
    }

    // 6. Enqueue server-side timeout scheduled job
    await db.enqueueScheduledJob({
      job_type: 'sos_family_timeout',
      reference_id: incident.id,
      scheduled_at: deadlineIso,
      status: 'pending',
      retry_count: 0,
      max_retries: 3,
      payload: {
        incidentId: incident.id,
        familyId,
        patientProfileId,
      },
    });

    logger.info(`[SOS] Incident ${incident.incident_number} created for patient ${patientProfileId} (Demo Mode)`);

    return { incident, attempts };
  }

  /**
   * Retrieves incident details with validation
   */
  async getIncident(
    _userId: string,
    familyId: string,
    incidentId: string
  ): Promise<{
    incident: EmergencyIncident;
    patient: PatientProfile | null;
    attempts: EmergencyContactAttempt[];
    events: EmergencyIncidentEvent[];
    policy: EmergencyEscalationPolicy | null;
    handoff: HospitalHandoff | null;
  }> {
    const incident = await db.getEmergencyIncidentById(incidentId);
    if (!incident || incident.family_id !== familyId) {
      throw createError('Emergency incident not found in this family workspace', 404);
    }

    const patient = await db.getPatientProfileById(incident.patient_profile_id);
    const attempts = await db.listEmergencyContactAttempts(incident.id);
    const events = await db.listEmergencyIncidentEvents(incident.id);
    const policy = await db.getEmergencyEscalationPolicy(familyId, incident.patient_profile_id);
    const handoff = await db.getHospitalHandoffByIncidentId(incident.id);

    return { incident, patient, attempts, events, policy, handoff };
  }

  /**
   * Lists incidents for a family
   */
  async listIncidents(familyId: string, patientProfileId?: string): Promise<EmergencyIncident[]> {
    return await db.listEmergencyIncidents(familyId, patientProfileId);
  }

  /**
   * Retrieves active incident for a patient
   */
  async getActiveIncident(
    familyId: string,
    patientProfileId: string
  ): Promise<EmergencyIncident | null> {
    return await db.getActiveEmergencyIncident(familyId, patientProfileId);
  }

  /**
   * Submits a simulated contact acknowledgement (Family Contact Stage)
   */
  async acknowledgeContactAttempt(
    _userId: string,
    familyId: string,
    incidentId: string,
    attemptId: string,
    action: string,
    note?: string
  ): Promise<{ incident: EmergencyIncident; attempt: EmergencyContactAttempt }> {
    const incident = await db.getEmergencyIncidentById(incidentId);
    if (!incident || incident.family_id !== familyId) {
      throw createError('Emergency incident not found', 404);
    }

    const attempt = await db.getEmergencyContactAttemptById(attemptId);
    if (!attempt || attempt.incident_id !== incident.id) {
      throw createError('Contact attempt not found for this incident', 404);
    }

    if (incident.status === 'RESOLVED' || incident.status === 'CANCELLED') {
      throw createError(`Cannot acknowledge contact for ${incident.status.toLowerCase()} incident`, 400);
    }

    const nowIso = new Date().toISOString();

    if (action === 'I cannot respond') {
      const updatedAttempt = await db.updateEmergencyContactAttempt(attempt.id, {
        status: 'FAILED_SIMULATED',
        acknowledged_at: nowIso,
        acknowledgement_action: action,
        acknowledgement_note: note || 'Simulated contact indicated inability to assist',
      });

      await db.createEmergencyIncidentEvent({
        incident_id: incident.id,
        event_type: 'FAMILY_ALERT_ACKNOWLEDGED',
        title: `Simulated Response from ${attempt.contact_name}: Unable to Respond`,
        description: `${attempt.contact_name} responded: "${action}". Escalation continues.`,
        actor_type: 'CONTACT',
        actor_id: attempt.contact_id || undefined,
        stage: 'FAMILY_CONTACT',
        payload: { attemptId: attempt.id, action, note },
        is_demo: true,
        simulation_provenance: 'DEMO_SIMULATION_ONLY',
      });

      // If all attempts in this stage failed, immediately advance
      const attempts = await db.listEmergencyContactAttempts(incident.id);
      const stageAttempts = attempts.filter((a) => a.stage === 'FAMILY_CONTACT');
      const allFailed = stageAttempts.every(
        (a) => a.status === 'FAILED_SIMULATED' || a.status === 'TIMEOUT_NO_RESPONSE'
      );

      if (allFailed && incident.status === 'AWAITING_FAMILY_RESPONSE') {
        const advanced = await this.advanceToCaregiverEscalation(incident);
        return { incident: advanced, attempt: updatedAttempt };
      }

      return { incident, attempt: updatedAttempt };
    }

    // Positive acknowledgement (e.g. "I am responding", "I have contacted the patient")
    const updatedAttempt = await db.updateEmergencyContactAttempt(attempt.id, {
      status: 'ACKNOWLEDGED',
      acknowledged_at: nowIso,
      acknowledgement_action: action,
      acknowledgement_note: note || null,
    });

    // Cancel pending family timeout jobs so escalation pauses
    await db.cancelScheduledJobsByReference(incident.id);

    // Update incident state
    const updatedIncident = await db.updateEmergencyIncident(incident.id, {
      status: 'FAMILY_RESPONDED',
      response_deadline: null,
    });

    await db.createEmergencyIncidentEvent({
      incident_id: incident.id,
      event_type: 'FAMILY_ALERT_ACKNOWLEDGED',
      title: `Simulated Family Response: ${action}`,
      description: `${attempt.contact_name} (${attempt.contact_role}) responded: "${action}". Escalation paused pending incident resolution.`,
      actor_type: 'CONTACT',
      actor_id: attempt.contact_id || undefined,
      stage: 'FAMILY_CONTACT',
      payload: { attemptId: attempt.id, contactName: attempt.contact_name, action, note },
      is_demo: true,
      simulation_provenance: 'DEMO_SIMULATION_ONLY',
    });

    return { incident: updatedIncident, attempt: updatedAttempt };
  }

  /**
   * Handles Family Timeout: advances incident to Caregiver Escalation
   */
  async handleFamilyTimeout(payload: {
    incidentId: string;
    familyId: string;
    patientProfileId: string;
  }): Promise<EmergencyIncident | null> {
    const incident = await db.getEmergencyIncidentById(payload.incidentId);
    if (!incident || incident.status !== 'AWAITING_FAMILY_RESPONSE') {
      // Already responded, cancelled, or advanced
      return null;
    }

    return await this.advanceToCaregiverEscalation(incident);
  }

  /**
   * Advances incident to Caregiver Escalation stage
   */
  private async advanceToCaregiverEscalation(incident: EmergencyIncident): Promise<EmergencyIncident> {
    const now = new Date();
    const nowIso = now.toISOString();

    // 1. Mark pending family attempts as TIMEOUT_NO_RESPONSE
    const existingAttempts = await db.listEmergencyContactAttempts(incident.id);
    for (const att of existingAttempts) {
      if (att.stage === 'FAMILY_CONTACT' && att.status === 'AWAITING_RESPONSE') {
        await db.updateEmergencyContactAttempt(att.id, {
          status: 'TIMEOUT_NO_RESPONSE',
        });
      }
    }

    // 2. Fetch escalation policy
    const policy = await this.getOrCreatePolicy(incident.family_id, incident.patient_profile_id);
    const caregiverDeadlineIso = new Date(
      now.getTime() + policy.caregiver_response_timeout_seconds * 1000
    ).toISOString();

    // 3. Record timeout event
    await db.createEmergencyIncidentEvent({
      incident_id: incident.id,
      event_type: 'FAMILY_TIMEOUT',
      title: 'Family Response Timeout Expired',
      description: `Initial family response window (${policy.family_response_timeout_seconds}s) expired with no response. Escalating to designated caregiver.`,
      actor_type: 'SYSTEM_SCHEDULER',
      stage: 'FAMILY_CONTACT',
      payload: { timeoutSeconds: policy.family_response_timeout_seconds },
      is_demo: true,
      simulation_provenance: 'DEMO_SIMULATION_ONLY',
    });

    // 4. Update incident status
    const updatedIncident = await db.updateEmergencyIncident(incident.id, {
      status: 'AWAITING_CAREGIVER_RESPONSE',
      current_stage: 'CAREGIVER_ESCALATION',
      response_deadline: caregiverDeadlineIso,
    });

    // 5. Find designated caregiver contact
    const contacts = await db.listEmergencyContacts(incident.family_id, incident.patient_profile_id);
    const caregiverContacts = contacts.filter((c) => c.role === 'caregiver' || c.role === 'doctor');
    const targetCaregiver = caregiverContacts[0] || {
      id: undefined,
      name: 'Dr. Arvind Mehta (Home Nurse / Caregiver)',
      role: 'caregiver',
      phone_number: '+91-98765-00003 (Simulated)',
    };

    // 6. Create caregiver contact attempt
    const caregiverAttempt = await db.createEmergencyContactAttempt({
      incident_id: incident.id,
      contact_id: targetCaregiver.id,
      contact_name: targetCaregiver.name,
      contact_role: targetCaregiver.role,
      channel: 'SIMULATED_VOICE_SMS',
      stage: 'CAREGIVER_ESCALATION',
      status: 'AWAITING_RESPONSE',
      attempted_at: nowIso,
      is_demo: true,
      simulation_provenance: 'DEMO_SIMULATION_ONLY',
    });

    // 7. Record caregiver dispatch event
    await db.createEmergencyIncidentEvent({
      incident_id: incident.id,
      event_type: 'CAREGIVER_ESCALATED',
      title: `Simulated Caregiver Alert Dispatched to ${targetCaregiver.name}`,
      description: `Caregiver escalation triggered. Simulated alert delivered to ${targetCaregiver.name} (${targetCaregiver.phone_number}). Status: Awaiting response (${policy.caregiver_response_timeout_seconds}s window).`,
      actor_type: 'SYSTEM_SCHEDULER',
      stage: 'CAREGIVER_ESCALATION',
      payload: {
        attemptId: caregiverAttempt.id,
        caregiverName: targetCaregiver.name,
        timeoutSeconds: policy.caregiver_response_timeout_seconds,
      },
      is_demo: true,
      simulation_provenance: 'DEMO_SIMULATION_ONLY',
    });

    // 8. Enqueue caregiver timeout job
    await db.enqueueScheduledJob({
      job_type: 'sos_caregiver_timeout',
      reference_id: incident.id,
      scheduled_at: caregiverDeadlineIso,
      status: 'pending',
      retry_count: 0,
      max_retries: 3,
      payload: {
        incidentId: incident.id,
        familyId: incident.family_id,
        patientProfileId: incident.patient_profile_id,
      },
    });

    return updatedIncident;
  }

  /**
   * Submits a simulated caregiver acknowledgement
   */
  async acknowledgeCaregiver(
    _userId: string,
    familyId: string,
    incidentId: string,
    attemptId: string,
    action: string,
    note?: string
  ): Promise<{ incident: EmergencyIncident; attempt: EmergencyContactAttempt }> {
    const incident = await db.getEmergencyIncidentById(incidentId);
    if (!incident || incident.family_id !== familyId) {
      throw createError('Emergency incident not found', 404);
    }

    const attempt = await db.getEmergencyContactAttemptById(attemptId);
    if (!attempt || attempt.incident_id !== incident.id) {
      throw createError('Caregiver attempt not found for this incident', 404);
    }

    if (incident.status === 'RESOLVED' || incident.status === 'CANCELLED') {
      throw createError(`Cannot acknowledge caregiver for ${incident.status.toLowerCase()} incident`, 400);
    }

    const nowIso = new Date().toISOString();

    if (action === 'I cannot respond') {
      const updatedAttempt = await db.updateEmergencyContactAttempt(attempt.id, {
        status: 'FAILED_SIMULATED',
        acknowledged_at: nowIso,
        acknowledgement_action: action,
        acknowledgement_note: note || 'Simulated caregiver indicated inability to assist',
      });

      await db.createEmergencyIncidentEvent({
        incident_id: incident.id,
        event_type: 'CAREGIVER_ACKNOWLEDGED',
        title: `Simulated Caregiver Response: Unable to Respond`,
        description: `${attempt.contact_name} responded: "${action}". Immediate hospital handoff initiated.`,
        actor_type: 'CAREGIVER',
        actor_id: attempt.contact_id || undefined,
        stage: 'CAREGIVER_ESCALATION',
        payload: { attemptId: attempt.id, action, note },
        is_demo: true,
        simulation_provenance: 'DEMO_SIMULATION_ONLY',
      });

      const advanced = await this.advanceToHospitalHandoff(incident);
      return { incident: advanced, attempt: updatedAttempt };
    }

    // Positive caregiver acknowledgement
    const updatedAttempt = await db.updateEmergencyContactAttempt(attempt.id, {
      status: 'ACKNOWLEDGED',
      acknowledged_at: nowIso,
      acknowledgement_action: action,
      acknowledgement_note: note || null,
    });

    // Cancel pending caregiver timeout jobs
    await db.cancelScheduledJobsByReference(incident.id);

    // Update incident status
    const updatedIncident = await db.updateEmergencyIncident(incident.id, {
      status: 'CAREGIVER_RESPONDED',
      response_deadline: null,
    });

    await db.createEmergencyIncidentEvent({
      incident_id: incident.id,
      event_type: 'CAREGIVER_ACKNOWLEDGED',
      title: `Simulated Caregiver Response: ${action}`,
      description: `${attempt.contact_name} responded: "${action}". Caregiver has taken responsibility. Escalation paused.`,
      actor_type: 'CAREGIVER',
      actor_id: attempt.contact_id || undefined,
      stage: 'CAREGIVER_ESCALATION',
      payload: { attemptId: attempt.id, caregiverName: attempt.contact_name, action, note },
      is_demo: true,
      simulation_provenance: 'DEMO_SIMULATION_ONLY',
    });

    return { incident: updatedIncident, attempt: updatedAttempt };
  }

  /**
   * Handles Caregiver Timeout: advances incident to Hospital Handoff
   */
  async handleCaregiverTimeout(payload: {
    incidentId: string;
    familyId: string;
    patientProfileId: string;
  }): Promise<EmergencyIncident | null> {
    const incident = await db.getEmergencyIncidentById(payload.incidentId);
    if (!incident || incident.status !== 'AWAITING_CAREGIVER_RESPONSE') {
      return null;
    }

    return await this.advanceToHospitalHandoff(incident);
  }

  /**
   * Advances incident to Hospital Handoff stage
   */
  async advanceToHospitalHandoff(incident: EmergencyIncident): Promise<EmergencyIncident> {
    const now = new Date();
    const nowIso = now.toISOString();

    // 1. Mark pending caregiver attempts as TIMEOUT_NO_RESPONSE
    const existingAttempts = await db.listEmergencyContactAttempts(incident.id);
    for (const att of existingAttempts) {
      if (att.stage === 'CAREGIVER_ESCALATION' && att.status === 'AWAITING_RESPONSE') {
        await db.updateEmergencyContactAttempt(att.id, {
          status: 'TIMEOUT_NO_RESPONSE',
        });
      }
    }

    // 2. Fetch escalation policy and patient details
    const policy = await this.getOrCreatePolicy(incident.family_id, incident.patient_profile_id);
    const patient = await db.getPatientProfileById(incident.patient_profile_id);

    // 3. Record caregiver timeout event
    await db.createEmergencyIncidentEvent({
      incident_id: incident.id,
      event_type: 'CAREGIVER_TIMEOUT',
      title: 'Caregiver Response Deadline Expired',
      description: `Caregiver response window (${policy.caregiver_response_timeout_seconds}s) expired with no response. Escalating to simulated hospital receiving desk.`,
      actor_type: 'SYSTEM_SCHEDULER',
      stage: 'CAREGIVER_ESCALATION',
      payload: { timeoutSeconds: policy.caregiver_response_timeout_seconds },
      is_demo: true,
      simulation_provenance: 'DEMO_SIMULATION_ONLY',
    });

    // 4. Build synthetic emergency health summary packet
    const healthPacket = await this.buildEmergencySummaryPacket(incident, patient);

    // 5. Create hospital handoff record
    await db.createHospitalHandoff({
      incident_id: incident.id,
      hospital_name: policy.hospital_name,
      department: policy.hospital_department,
      status: 'PENDING_SIMULATED',
      patient_summary_packet: healthPacket,
      handoff_prepared_at: nowIso,
      is_demo: true,
      simulation_provenance: 'DEMO_SIMULATION_ONLY',
    });

    // 6. Update incident status
    const updatedIncident = await db.updateEmergencyIncident(incident.id, {
      status: 'HOSPITAL_HANDOFF_SIMULATED',
      current_stage: 'HOSPITAL_HANDOFF',
      response_deadline: null,
    });

    // 7. Record handoff prepared event
    await db.createEmergencyIncidentEvent({
      incident_id: incident.id,
      event_type: 'HOSPITAL_HANDOFF_PREPARED',
      title: 'Simulated Hospital Handoff Prepared',
      description: `Emergency medical summary packet prepared and dispatched to ${policy.hospital_name} (${policy.hospital_department}). SIMULATION ONLY — no actual hospital contacted.`,
      actor_type: 'SYSTEM_SCHEDULER',
      stage: 'HOSPITAL_HANDOFF',
      payload: {
        hospitalName: policy.hospital_name,
        department: policy.hospital_department,
        healthPacketSummary: {
          patientName: patient?.full_name,
          healthId: patient?.health_id,
          activeMedicationsCount: (healthPacket.activeMedications as any[])?.length || 0,
        },
      },
      is_demo: true,
      simulation_provenance: 'DEMO_SIMULATION_ONLY',
    });

    return updatedIncident;
  }

  /**
   * Builds synthetic emergency health-summary packet for hospital handoff
   */
  private async buildEmergencySummaryPacket(
    incident: EmergencyIncident,
    patient: Record<string, any> | null
  ): Promise<Record<string, unknown>> {
    const schedules = await db.listMedicationSchedulesByPatient(incident.patient_profile_id, 'active');
    const documents = await db.listFamilyDocuments(incident.family_id, {
      patientProfileId: incident.patient_profile_id,
    });

    const activeMedications = schedules.map((s) => ({
      name: s.medicine_name,
      dosage: s.dosage_instruction,
      frequency: s.frequency,
      scheduledTimes: s.scheduled_times,
    }));

    const recentReports = documents.slice(0, 3).map((d) => ({
      documentId: d.id,
      title: d.title,
      category: d.category,
      documentDate: d.document_date,
      status: d.review_status,
    }));

    return {
      incidentNumber: incident.incident_number,
      activatedAt: incident.activated_at,
      severity: incident.severity,
      locationNote: incident.location_note,
      patient: {
        id: patient?.id,
        fullName: patient?.full_name || 'Critical Patient Demo',
        healthId: patient?.health_id || 'SNJ-DEMO-0000-0001',
        category: patient?.category || 'elderly',
        gender: patient?.gender || 'male',
        dateOfBirth: patient?.date_of_birth || '1952-05-14',
      },
      criticalConditions: [
        'Type 2 Diabetes Mellitus (Uncontrolled)',
        'Hypertension (Stage 2)',
        'Coronary Artery Disease (Post-Stent 2021)',
      ],
      knownAllergies: ['Penicillin (Severe anaphylaxis)', 'Sulfa Drugs (Rash)'],
      activeMedications,
      recentReports,
      verificationNotice: 'SYNTHETIC EMERGENCY SUMMARY — DEMO MODE ONLY — NO REAL HOSPITAL CONTACTED',
      preparedAt: new Date().toISOString(),
    };
  }

  /**
   * Submits a simulated receiving-desk acknowledgement from the fictional hospital
   */
  async acknowledgeHospitalDesk(
    _userId: string,
    familyId: string,
    incidentId: string,
    receivingStaffName?: string,
    receivingNotes?: string
  ): Promise<{ incident: EmergencyIncident; handoff: HospitalHandoff }> {
    const incident = await db.getEmergencyIncidentById(incidentId);
    if (!incident || incident.family_id !== familyId) {
      throw createError('Emergency incident not found', 404);
    }

    const handoff = await db.getHospitalHandoffByIncidentId(incident.id);
    if (!handoff) {
      throw createError('Hospital handoff record not found for this incident', 404);
    }

    const nowIso = new Date().toISOString();
    const staff = receivingStaffName || 'Nurse Priya Desai (Emergency Desk, Simulated)';
    const notes = receivingNotes || 'Patient emergency summary packet received. Priority trauma/triage bed assigned.';

    const updatedHandoff = await db.updateHospitalHandoff(handoff.id, {
      status: 'ACKNOWLEDGED_SIMULATED',
      acknowledged_at: nowIso,
      receiving_staff_name: staff,
      receiving_notes: notes,
    });

    await db.createEmergencyIncidentEvent({
      incident_id: incident.id,
      event_type: 'HOSPITAL_HANDOFF_ACKNOWLEDGED',
      title: 'Simulated Hospital Receiving Desk Acknowledged',
      description: `Emergency Desk staff ${staff} acknowledged receipt of emergency packet. Notes: "${notes}". SIMULATED RECEIVING DESK.`,
      actor_type: 'HOSPITAL_RECEIVING_DESK',
      stage: 'HOSPITAL_HANDOFF',
      payload: { staff, notes },
      is_demo: true,
      simulation_provenance: 'DEMO_SIMULATION_ONLY',
    });

    return { incident, handoff: updatedHandoff };
  }

  /**
   * Demo Control: Manually advance eligible timeout / next stage
   */
  async advanceDemoTimeout(
    userId: string,
    familyId: string,
    incidentId: string
  ): Promise<{ incident: EmergencyIncident; advancedStage: string }> {
    const incident = await db.getEmergencyIncidentById(incidentId);
    if (!incident || incident.family_id !== familyId) {
      throw createError('Emergency incident not found', 404);
    }

    if (incident.status === 'RESOLVED' || incident.status === 'CANCELLED') {
      throw createError(`Cannot advance ${incident.status.toLowerCase()} incident`, 400);
    }

    await db.createEmergencyIncidentEvent({
      incident_id: incident.id,
      event_type: 'DEMO_ADVANCE_TRIGGERED',
      title: 'Demo Operator Advanced Timeout',
      description: `Evaluator used Demo Control to immediately advance timeout for stage ${incident.current_stage}.`,
      actor_type: 'DEMO_OPERATOR',
      actor_id: userId,
      stage: incident.current_stage,
      payload: { previousStatus: incident.status, previousStage: incident.current_stage },
      is_demo: true,
      simulation_provenance: 'DEMO_SIMULATION_ONLY',
    });

    if (incident.current_stage === 'FAMILY_CONTACT' || incident.status === 'AWAITING_FAMILY_RESPONSE') {
      const advanced = await this.advanceToCaregiverEscalation(incident);
      return { incident: advanced, advancedStage: 'CAREGIVER_ESCALATION' };
    } else if (incident.current_stage === 'CAREGIVER_ESCALATION' || incident.status === 'AWAITING_CAREGIVER_RESPONSE') {
      const advanced = await this.advanceToHospitalHandoff(incident);
      return { incident: advanced, advancedStage: 'HOSPITAL_HANDOFF' };
    }

    return { incident, advancedStage: incident.current_stage };
  }

  /**
   * Resolves an active emergency incident
   */
  async resolveIncident(
    userId: string,
    familyId: string,
    incidentId: string,
    resolutionNote?: string
  ): Promise<EmergencyIncident> {
    const incident = await db.getEmergencyIncidentById(incidentId);
    if (!incident || incident.family_id !== familyId) {
      throw createError('Emergency incident not found', 404);
    }

    if (!this.canTransition(incident.status, 'RESOLVED')) {
      throw createError(`Cannot transition incident from ${incident.status} to RESOLVED`, 400);
    }

    const nowIso = new Date().toISOString();
    await db.cancelScheduledJobsByReference(incident.id);

    const updated = await db.updateEmergencyIncident(incident.id, {
      status: 'RESOLVED',
      current_stage: 'RESOLVED',
      resolved_at: nowIso,
      response_deadline: null,
      resolution_note: resolutionNote || 'Incident marked resolved by operator',
    });

    await db.createEmergencyIncidentEvent({
      incident_id: incident.id,
      event_type: 'INCIDENT_RESOLVED',
      title: 'Emergency Incident Resolved',
      description: `Incident marked resolved. Notes: ${updated.resolution_note || 'N/A'}. All pending escalation jobs cancelled.`,
      actor_type: 'USER',
      actor_id: userId,
      stage: 'RESOLVED',
      payload: { resolutionNote: updated.resolution_note },
      is_demo: true,
      simulation_provenance: 'DEMO_SIMULATION_ONLY',
    });

    return updated;
  }

  /**
   * Cancels an active emergency incident
   */
  async cancelIncident(
    userId: string,
    familyId: string,
    incidentId: string,
    reason: string
  ): Promise<EmergencyIncident> {
    const incident = await db.getEmergencyIncidentById(incidentId);
    if (!incident || incident.family_id !== familyId) {
      throw createError('Emergency incident not found', 404);
    }

    if (!this.canTransition(incident.status, 'CANCELLED')) {
      throw createError(`Cannot transition incident from ${incident.status} to CANCELLED`, 400);
    }

    const nowIso = new Date().toISOString();
    await db.cancelScheduledJobsByReference(incident.id);

    // Cancel unacknowledged contact attempts
    const attempts = await db.listEmergencyContactAttempts(incident.id);
    for (const att of attempts) {
      if (att.status === 'AWAITING_RESPONSE' || att.status === 'QUEUED') {
        await db.updateEmergencyContactAttempt(att.id, { status: 'CANCELLED' });
      }
    }

    const updated = await db.updateEmergencyIncident(incident.id, {
      status: 'CANCELLED',
      current_stage: 'CANCELLED',
      cancelled_at: nowIso,
      response_deadline: null,
      cancellation_reason: reason,
    });

    await db.createEmergencyIncidentEvent({
      incident_id: incident.id,
      event_type: 'INCIDENT_CANCELLED',
      title: 'Emergency Incident Cancelled',
      description: `Incident cancelled by user. Reason: "${reason}". Pending alerts and escalation cancelled.`,
      actor_type: 'USER',
      actor_id: userId,
      stage: 'CANCELLED',
      payload: { reason },
      is_demo: true,
      simulation_provenance: 'DEMO_SIMULATION_ONLY',
    });

    return updated;
  }

  /**
   * Resets the demo scenario for repeatable evaluations
   */
  async resetDemoScenario(
    _userId: string,
    familyId: string,
    patientProfileId: string
  ): Promise<{ message: string; patientProfileId: string }> {
    // 1. Clean up demo incidents, attempts, events, handoffs, contacts, policies
    await db.resetEmergencyDemoScenario(familyId, patientProfileId);

    // 2. Re-seed default demo contacts & policy
    await this.ensureDemoContacts(familyId, patientProfileId);
    await this.getOrCreatePolicy(familyId, patientProfileId);

    logger.info(`[SOS] Demo scenario reset completed for patient ${patientProfileId}`);

    return {
      message: 'Demo scenario reset successfully. All demo incidents cleared and clean initial state restored.',
      patientProfileId,
    };
  }
}

export const sosService = new SosService();
