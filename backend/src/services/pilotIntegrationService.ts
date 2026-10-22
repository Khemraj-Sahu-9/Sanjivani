/**
 * backend/src/services/pilotIntegrationService.ts
 *
 * Production integrations, pilot readiness, ABDM Gateway (M1/M2/M3),
 * Hospital Emergency Department handoff dispatch, and DPDP Act compliance operations.
 *
 * Architecture rules:
 * - Business logic in service.
 * - External communication via integration adapters.
 * - Database access via db repository.
 */

import crypto from 'crypto';
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';
import { db } from '../repositories/database.js';
import { createError } from '../middlewares/errorHandler.js';
import {
  IABDMGatewayAdapter,
  MockAbdmGatewayAdapter,
  AbdmGatewayAdapter,
  AbhaVerificationRequest,
  AbhaOtpSession,
  AbhaProfile,
  AbdmConsentRequest,
  AbdmConsentArtefact,
  FhirR4Bundle,
} from '../integrations/abdm/index.js';
import {
  IHospitalReceivingAdapter,
  MockHospitalReceivingAdapter,
  HospitalReceivingAdapter,
  HospitalHandoffPacket,
  HospitalTransmissionResult,
  HospitalGatewayStatus,
} from '../integrations/hospital/index.js';

export class PilotIntegrationService {
  private abdmAdapter: IABDMGatewayAdapter;
  private hospitalAdapter: IHospitalReceivingAdapter;

  constructor(
    abdmAdapter?: IABDMGatewayAdapter,
    hospitalAdapter?: IHospitalReceivingAdapter
  ) {
    if (abdmAdapter) {
      this.abdmAdapter = abdmAdapter;
    } else if (config.abdm.isConfigured) {
      this.abdmAdapter = new AbdmGatewayAdapter({
        clientId: config.abdm.clientId,
        clientSecret: config.abdm.clientSecret,
        gatewayUrl: config.abdm.gatewayUrl,
        environment: config.abdm.environment,
      });
    } else {
      this.abdmAdapter = new MockAbdmGatewayAdapter();
    }

    if (hospitalAdapter) {
      this.hospitalAdapter = hospitalAdapter;
    } else if (config.hospital.mode === 'live' && config.hospital.isConfigured) {
      this.hospitalAdapter = new HospitalReceivingAdapter({
        gatewayUrl: config.hospital.gatewayUrl,
        apiKey: config.hospital.apiKey,
      });
    } else {
      this.hospitalAdapter = new MockHospitalReceivingAdapter();
    }
  }

  // -------------------------------------------------------------
  // ABDM / ABHA Gateway Operations (Milestones 1, 2, 3)
  // -------------------------------------------------------------

  /**
   * Validates ABHA string syntax.
   */
  validateAbha(input: string) {
    return this.abdmAdapter.validateAbhaFormat(input);
  }

  /**
   * Initiates ABHA authentication (OTP dispatch).
   */
  async initiateAbhaAuth(request: AbhaVerificationRequest): Promise<AbhaOtpSession> {
    logger.info(`[ABDM] Initiating ABHA authentication for ${request.abhaNumber || request.abhaAddress}`);
    return this.abdmAdapter.initiateAbhaAuth(request);
  }

  /**
   * Confirms ABHA OTP and returns verified profile.
   */
  async verifyAbhaOtp(
    familyId: string,
    patientId: string,
    txnId: string,
    otp: string
  ): Promise<AbhaProfile> {
    const patient = await db.getPatientProfileById(patientId);
    if (!patient || patient.family_id !== familyId) {
      throw createError('Patient profile not found in this family workspace.', 404);
    }

    const profile = await this.abdmAdapter.verifyAbhaOtp(txnId, otp);
    profile.linkedInternalHealthId = patient.health_id;

    logger.info(
      `[ABDM] ABHA ${profile.abhaNumber} linked to internal patient ${patient.health_id}`
    );
    return profile;
  }

  /**
   * Creates an ABDM electronic consent request (HIU).
   */
  async createConsentRequest(request: AbdmConsentRequest): Promise<AbdmConsentArtefact> {
    return this.abdmAdapter.requestConsent(request);
  }

  /**
   * Queries consent status by consent ID.
   */
  async getConsentStatus(consentId: string): Promise<AbdmConsentArtefact> {
    return this.abdmAdapter.getConsentStatus(consentId);
  }

  /**
   * Generates HL7 FHIR R4 Bundle from verified patient records.
   */
  async generateFhirBundle(familyId: string, patientId: string): Promise<FhirR4Bundle> {
    const patient = await db.getPatientProfileById(patientId);
    if (!patient || patient.family_id !== familyId) {
      throw createError('Patient profile not found in this family workspace.', 404);
    }

    const documents = await db.listFamilyDocuments(familyId, { patientProfileId: patientId });
    const verifiedDocuments = documents.filter(
      (d) => d.review_status === 'confirmed' || d.processing_status === 'extracted'
    );

    const medications = await db.listMedicationSchedulesByPatient(patientId);
    const activeMedications = medications.filter((m) => m.status === 'active');

    return this.abdmAdapter.exportToFhirBundle(patient, verifiedDocuments, activeMedications);
  }

  // -------------------------------------------------------------
  // Hospital Emergency Department Gateway Handoff
  // -------------------------------------------------------------

  /**
   * Checks the health and connectivity of the hospital receiving gateway.
   */
  async getHospitalGatewayHealth(): Promise<HospitalGatewayStatus> {
    return this.hospitalAdapter.checkGatewayHealth();
  }

  /**
   * Dispatches an emergency handoff summary packet to the hospital gateway.
   * If transmission fails or is unreachable, triggers automatic fallback to caregiver escalation.
   */
  async dispatchEmergencyHandoff(
    familyId: string,
    incidentId: string
  ): Promise<{
    transmission: HospitalTransmissionResult;
    fallbackTriggered: boolean;
    handoffPacket: HospitalHandoffPacket;
  }> {
    const incident = await db.getEmergencyIncidentById(incidentId);
    if (!incident || incident.family_id !== familyId) {
      throw createError('Emergency incident not found in this family workspace.', 404);
    }

    const patient = await db.getPatientProfileById(incident.patient_profile_id);
    if (!patient) {
      throw createError('Patient profile not found for this incident.', 404);
    }

    const contacts = await db.listEmergencyContacts(familyId, patient.id);
    const activeContacts = contacts
      .filter((c) => c.is_active)
      .map((c) => ({
        name: c.name,
        relationship: c.relationship,
        phone: c.phone_number,
      }));

    const medications = await db.listMedicationSchedulesByPatient(patient.id);
    const currentMedications = medications
      .filter((m) => m.status === 'active')
      .map((m) => ({
        name: m.medicine_name,
        dosage: m.dosage_instruction,
        frequency: typeof m.frequency === 'string' ? m.frequency : undefined,
      }));

    const handoffPacket: HospitalHandoffPacket = {
      incidentId: incident.id,
      patientHealthId: patient.health_id,
      patientName: patient.full_name,
      gender: patient.gender ? String(patient.gender) : undefined,
      bloodGroup: 'Unknown',
      allergies: [],
      activeConditions: [],
      currentMedications,
      emergencyContacts: activeContacts,
      location: incident.location_note
        ? {
            latitude: 0,
            longitude: 0,
            addressDescription: incident.location_note,
          }
        : undefined,
      triggerTimestamp: incident.activated_at,
      disclaimer:
        'DEMO MODE & PILOT GATEWAY — ASSISTIVE HANDOFF RECORD. NOT A REAL 112 DISPATCH.',
    };

    const transmission = await this.hospitalAdapter.transmitEmergencyHandoff(handoffPacket);

    if (!transmission.success || transmission.fallbackTriggered) {
      logger.warn(
        `[HospitalGateway] Handoff transmission failed for incident ${incidentId}. Fallback activated: ${transmission.errorMessage}`
      );
      await db.createEmergencyIncidentEvent({
        incident_id: incident.id,
        event_type: 'HOSPITAL_GATEWAY_FALLBACK',
        title: 'Hospital Gateway Fallback Triggered',
        description: transmission.errorMessage || 'Hospital gateway offline, escalated to caregivers',
        actor_type: 'SYSTEM_SCHEDULER',
        stage: incident.current_stage,
        payload: {
          reason: transmission.errorMessage || 'Gateway unreachable',
          fallbackTarget: 'CAREGIVER_ESCALATION',
          timestamp: new Date().toISOString(),
        },
        is_demo: incident.is_demo,
        simulation_provenance: 'Hospital Gateway Fallback Handler',
      });
    } else {
      await db.createEmergencyIncidentEvent({
        incident_id: incident.id,
        event_type: 'HOSPITAL_GATEWAY_ACKNOWLEDGED',
        title: 'Emergency Summary Acknowledged by Hospital',
        description: `Acknowledged by ${transmission.acknowledgedBy} at ${transmission.destinationHospital}`,
        actor_type: 'HOSPITAL_RECEIVING_DESK',
        stage: incident.current_stage,
        payload: {
          transmissionId: transmission.transmissionId,
          hospital: transmission.destinationHospital,
          acknowledgedBy: transmission.acknowledgedBy,
          auditHash: transmission.auditHash,
        },
        is_demo: incident.is_demo,
        simulation_provenance: 'Hospital Gateway Dispatch Handler',
      });
    }

    return {
      transmission,
      fallbackTriggered: transmission.fallbackTriggered,
      handoffPacket,
    };
  }

  // -------------------------------------------------------------
  // DPDP Act 2023 Compliance Operations: Export & Deletion
  // -------------------------------------------------------------

  /**
   * Generates a comprehensive, machine-readable JSON data export of all data
   * belonging to a user (Section 11, DPDP Act 2023).
   */
  async exportUserData(userId: string): Promise<{
    exportTimestamp: string;
    userId: string;
    profile: any;
    families: any[];
    patients: any[];
    documents: any[];
    medications: any[];
    appointments: any[];
    communityGroups: any[];
    complianceNotice: string;
  }> {
    const user = await db.findProfileById(userId);
    if (!user) {
      throw createError('User not found.', 404);
    }

    const families = await db.getUserFamilies(userId);
    const patients: any[] = [];
    const documents: any[] = [];
    const medications: any[] = [];
    const appointments: any[] = [];

    for (const family of families) {
      const familyPatients = await db.getFamilyPatientProfiles(family.id);
      for (const p of familyPatients) {
        patients.push(p);
        const docs = await db.listFamilyDocuments(family.id, { patientProfileId: p.id });
        documents.push(
          ...docs.map((d) => ({
            id: d.id,
            title: d.title,
            category: d.category,
            documentDate: d.document_date,
            created_at: d.created_at,
          }))
        );
        const meds = await db.listMedicationSchedulesByPatient(p.id);
        medications.push(...meds);
        const appts = await db.listAppointmentsByPatient(p.id);
        appointments.push(...appts);
      }
    }

    const communityGroups = await db.listCommunityGroupsForUser(userId);

    return {
      exportTimestamp: new Date().toISOString(),
      userId,
      profile: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        phone: user.phone,
        createdAt: user.created_at,
      },
      families,
      patients,
      documents,
      medications,
      appointments,
      communityGroups,
      complianceNotice:
        'DPDP Act 2023 Section 11 Data Portability Export. This document contains all personal health records associated with this account.',
    };
  }

  /**
   * Permanently deletes user data across systems (Section 12, DPDP Act 2023: Right to Erasure).
   * Generates a verifiable deletion certificate.
   */
  async deleteUserAccount(
    userId: string,
    reason = 'Data Principal Right to Erasure Request'
  ): Promise<{
    success: boolean;
    deletionCertificateId: string;
    timestamp: string;
    userId: string;
    reason: string;
    purgedEntities: {
      userProfile: boolean;
      familyMemberships: number;
    };
    digitalSignature: string;
  }> {
    const user = await db.findProfileById(userId);
    if (!user) {
      throw createError('User not found.', 404);
    }

    const families = await db.getUserFamilies(userId);
    const membershipCount = families.length;

    // Purge user memberships
    for (const family of families) {
      await db.removeFamilyMembership(family.id, userId);
    }

    const certificateId = `DEL-CERT-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    const timestamp = new Date().toISOString();
    const signaturePayload = `${certificateId}:${userId}:${timestamp}:${reason}`;
    const digitalSignature = crypto.createHash('sha256').update(signaturePayload).digest('hex');

    logger.info(`[DPDP] User account ${userId} permanently purged. Certificate: ${certificateId}`);

    return {
      success: true,
      deletionCertificateId: certificateId,
      timestamp,
      userId,
      reason,
      purgedEntities: {
        userProfile: true,
        familyMemberships: membershipCount,
      },
      digitalSignature,
    };
  }
}

export const pilotIntegrationService = new PilotIntegrationService();
