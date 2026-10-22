/**
 * frontend/src/services/sosService.ts
 *
 * Frontend API client for Phase 5: SOS Emergency Simulation & Hospital Handoff.
 */

import { apiClient, ApiResponse } from '../lib/apiClient';
import {
  EmergencyIncident,
  EmergencyContact,
  EmergencyContactAttempt,
  EmergencyIncidentEvent,
  EmergencyEscalationPolicy,
  HospitalHandoff,
} from '../types/sos';

export interface TriggerSosPayload {
  patientProfileId: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  locationNote?: string;
}

export interface IncidentDetailsResponse {
  incident: EmergencyIncident;
  patient: Record<string, unknown> | null;
  attempts: EmergencyContactAttempt[];
  events: EmergencyIncidentEvent[];
  policy: EmergencyEscalationPolicy | null;
  handoff: HospitalHandoff | null;
}

export const sosApiService = {
  async triggerSos(
    familyId: string,
    payload: TriggerSosPayload
  ): Promise<ApiResponse<{ incident: EmergencyIncident; attempts: EmergencyContactAttempt[] }>> {
    return apiClient.post(`/api/families/${familyId}/sos/trigger`, payload);
  },

  async getActiveIncident(
    familyId: string,
    patientProfileId: string
  ): Promise<ApiResponse<{ incident: EmergencyIncident | null }>> {
    return apiClient.get(`/api/families/${familyId}/sos/active?patientProfileId=${patientProfileId}`);
  },

  async listIncidents(
    familyId: string,
    patientProfileId?: string
  ): Promise<ApiResponse<{ incidents: EmergencyIncident[] }>> {
    const q = patientProfileId ? `?patientProfileId=${patientProfileId}` : '';
    return apiClient.get(`/api/families/${familyId}/sos/incidents${q}`);
  },

  async getIncidentDetails(
    familyId: string,
    incidentId: string
  ): Promise<ApiResponse<IncidentDetailsResponse>> {
    return apiClient.get(`/api/families/${familyId}/sos/incidents/${incidentId}`);
  },

  async acknowledgeContactAttempt(
    familyId: string,
    incidentId: string,
    attemptId: string,
    action: string,
    note?: string
  ): Promise<ApiResponse<{ incident: EmergencyIncident; attempt: EmergencyContactAttempt }>> {
    return apiClient.post(
      `/api/families/${familyId}/sos/incidents/${incidentId}/attempts/${attemptId}/acknowledge`,
      { action, note }
    );
  },

  async acknowledgeCaregiver(
    familyId: string,
    incidentId: string,
    attemptId: string,
    action: string,
    note?: string
  ): Promise<ApiResponse<{ incident: EmergencyIncident; attempt: EmergencyContactAttempt }>> {
    return apiClient.post(
      `/api/families/${familyId}/sos/incidents/${incidentId}/caregiver/acknowledge`,
      { attemptId, action, note }
    );
  },

  async acknowledgeHospitalDesk(
    familyId: string,
    incidentId: string,
    receivingStaffName?: string,
    receivingNotes?: string
  ): Promise<ApiResponse<{ incident: EmergencyIncident; handoff: HospitalHandoff }>> {
    return apiClient.post(
      `/api/families/${familyId}/sos/incidents/${incidentId}/hospital/acknowledge`,
      { receivingStaffName, receivingNotes }
    );
  },

  async advanceTimeout(
    familyId: string,
    incidentId: string
  ): Promise<ApiResponse<{ incident: EmergencyIncident; advancedStage: string }>> {
    return apiClient.post(`/api/families/${familyId}/sos/incidents/${incidentId}/advance`, {});
  },

  async resolveIncident(
    familyId: string,
    incidentId: string,
    resolutionNote?: string
  ): Promise<ApiResponse<{ incident: EmergencyIncident }>> {
    return apiClient.post(`/api/families/${familyId}/sos/incidents/${incidentId}/resolve`, {
      resolutionNote,
    });
  },

  async cancelIncident(
    familyId: string,
    incidentId: string,
    reason: string
  ): Promise<ApiResponse<{ incident: EmergencyIncident }>> {
    return apiClient.post(`/api/families/${familyId}/sos/incidents/${incidentId}/cancel`, {
      reason,
    });
  },

  async resetDemoScenario(
    familyId: string,
    patientProfileId: string
  ): Promise<ApiResponse<{ message: string; patientProfileId: string }>> {
    return apiClient.post(`/api/families/${familyId}/sos/demo/reset`, {
      patientProfileId,
    });
  },

  async seedDemo(
    familyId: string,
    patientProfileId: string
  ): Promise<ApiResponse<{ contacts: EmergencyContact[]; policy: EmergencyEscalationPolicy }>> {
    return apiClient.post(`/api/families/${familyId}/sos/demo/seed`, {
      patientProfileId,
    });
  },

  async listContacts(
    familyId: string,
    patientProfileId?: string
  ): Promise<ApiResponse<{ contacts: EmergencyContact[] }>> {
    const q = patientProfileId ? `?patientProfileId=${patientProfileId}` : '';
    return apiClient.get(`/api/families/${familyId}/sos/contacts${q}`);
  },

  async getPolicy(
    familyId: string,
    patientProfileId: string
  ): Promise<ApiResponse<{ policy: EmergencyEscalationPolicy | null }>> {
    return apiClient.get(`/api/families/${familyId}/sos/policy?patientProfileId=${patientProfileId}`);
  },

  async upsertPolicy(
    familyId: string,
    policy: Partial<EmergencyEscalationPolicy>
  ): Promise<ApiResponse<{ policy: EmergencyEscalationPolicy }>> {
    return apiClient.post(`/api/families/${familyId}/sos/policy`, policy);
  },
};
