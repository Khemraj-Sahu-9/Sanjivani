/**
 * backend/src/services/emergencyContactService.ts
 *
 * Manages Emergency Contacts & Escalation Policies for Family Workspaces.
 */

import { db } from '../repositories/database.js';
import { createError } from '../middlewares/errorHandler.js';
import { EmergencyContact, EmergencyEscalationPolicy } from '../types/models.js';

export class EmergencyContactService {
  async listContacts(familyId: string, patientProfileId?: string): Promise<EmergencyContact[]> {
    return await db.listEmergencyContacts(familyId, patientProfileId);
  }

  async getContact(familyId: string, contactId: string): Promise<EmergencyContact> {
    const contact = await db.getEmergencyContactById(contactId);
    if (!contact || contact.family_id !== familyId) {
      throw createError('Emergency contact not found', 404);
    }
    return contact;
  }

  async createContact(
    familyId: string,
    data: {
      patientProfileId?: string;
      patient_profile_id?: string;
      name: string;
      relationship: string;
      phoneNumber?: string;
      phone_number?: string;
      role?: 'primary_family' | 'secondary_family' | 'caregiver' | 'doctor';
      priority?: number;
    }
  ): Promise<EmergencyContact> {
    const patientProfileId = data.patientProfileId || data.patient_profile_id;
    if (!patientProfileId) {
      throw createError('Patient profile ID is required', 400);
    }

    const patient = await db.getPatientProfileById(patientProfileId);
    if (!patient || patient.family_id !== familyId) {
      throw createError('Patient profile not found in this family', 404);
    }

    const phone = data.phoneNumber || data.phone_number || '+91-000-000-0000 (Simulated)';

    return await db.createEmergencyContact({
      family_id: familyId,
      patient_profile_id: patientProfileId,
      name: data.name,
      relationship: data.relationship,
      phone_number: phone,
      role: data.role || 'primary_family',
      priority: data.priority ?? 1,
      is_active: true,
      is_demo: true,
      simulation_provenance: 'DEMO_SIMULATION_ONLY',
    });
  }

  async updateContact(
    familyId: string,
    contactId: string,
    updates: Partial<EmergencyContact>
  ): Promise<EmergencyContact> {
    const contact = await this.getContact(familyId, contactId);
    return await db.updateEmergencyContact(contact.id, updates);
  }

  async deleteContact(familyId: string, contactId: string): Promise<void> {
    const contact = await this.getContact(familyId, contactId);
    await db.deleteEmergencyContact(contact.id);
  }

  async getPolicy(familyId: string, patientProfileId: string): Promise<EmergencyEscalationPolicy | null> {
    return await db.getEmergencyEscalationPolicy(familyId, patientProfileId);
  }

  async upsertPolicy(
    familyId: string,
    data: {
      patientProfileId?: string;
      patient_profile_id?: string;
      familyResponseTimeoutSeconds?: number;
      family_response_timeout_seconds?: number;
      caregiverResponseTimeoutSeconds?: number;
      caregiver_response_timeout_seconds?: number;
      advanceToHospitalOnTimeout?: boolean;
      advance_to_hospital_on_timeout?: boolean;
      hospitalName?: string;
      hospital_name?: string;
      hospitalDepartment?: string;
      hospital_department?: string;
    }
  ): Promise<EmergencyEscalationPolicy> {
    const patientProfileId = data.patientProfileId || data.patient_profile_id;
    if (!patientProfileId) {
      throw createError('Patient profile ID is required', 400);
    }

    const patient = await db.getPatientProfileById(patientProfileId);
    if (!patient || patient.family_id !== familyId) {
      throw createError('Patient profile not found in this family', 404);
    }

    const famSec =
      data.familyResponseTimeoutSeconds ?? data.family_response_timeout_seconds ?? 15;
    const cgSec =
      data.caregiverResponseTimeoutSeconds ?? data.caregiver_response_timeout_seconds ?? 15;
    const advHosp =
      data.advanceToHospitalOnTimeout ?? data.advance_to_hospital_on_timeout ?? true;
    const hospName =
      data.hospitalName || data.hospital_name || 'Apollo Indraprastha Fictional Hospital (Demo Desk)';
    const hospDept =
      data.hospitalDepartment || data.hospital_department || 'Emergency Receiving Desk (Simulated)';

    return await db.upsertEmergencyEscalationPolicy({
      family_id: familyId,
      patient_profile_id: patientProfileId,
      family_response_timeout_seconds: famSec,
      caregiver_response_timeout_seconds: cgSec,
      advance_to_hospital_on_timeout: advHosp,
      hospital_name: hospName,
      hospital_department: hospDept,
      is_active: true,
      is_demo: true,
      simulation_provenance: 'DEMO_SIMULATION_ONLY',
    });
  }
}

export const emergencyContactService = new EmergencyContactService();
