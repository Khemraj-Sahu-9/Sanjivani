/**
 * frontend/src/services/medicationService.ts
 *
 * Frontend API client for Medication Schedules, Doses, and Prescription Prefill.
 */

import { apiClient, ApiResponse } from '../lib/apiClient';
import {
  MedicationSchedule,
  MedicationDoseOccurrence,
  MedicationScheduleHistory,
  PrefilledMedicineCandidate,
  CreateMedicationSchedulePayload,
  UpdateMedicationSchedulePayload,
  DoseOccurrenceStatus,
} from '../types/medication';

export const medicationApiService = {
  async listSchedules(
    familyId: string,
    params?: { patientProfileId?: string; status?: string }
  ): Promise<ApiResponse<MedicationSchedule[]>> {
    const q = new URLSearchParams();
    if (params?.patientProfileId) q.append('patientProfileId', params.patientProfileId);
    if (params?.status) q.append('status', params.status);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return apiClient.get<MedicationSchedule[]>(`/api/families/${familyId}/medications${qs}`);
  },

  async createSchedule(
    familyId: string,
    payload: CreateMedicationSchedulePayload
  ): Promise<ApiResponse<MedicationSchedule>> {
    return apiClient.post<MedicationSchedule>(`/api/families/${familyId}/medications`, payload);
  },

  async getSchedule(familyId: string, scheduleId: string): Promise<ApiResponse<MedicationSchedule>> {
    return apiClient.get<MedicationSchedule>(`/api/families/${familyId}/medications/${scheduleId}`);
  },

  async updateSchedule(
    familyId: string,
    scheduleId: string,
    payload: UpdateMedicationSchedulePayload
  ): Promise<ApiResponse<MedicationSchedule>> {
    return apiClient.put<MedicationSchedule>(`/api/families/${familyId}/medications/${scheduleId}`, payload);
  },

  async confirmDraft(
    familyId: string,
    scheduleId: string,
    payload?: { scheduledTimes?: string[]; startDate?: string; endDate?: string }
  ): Promise<ApiResponse<MedicationSchedule>> {
    return apiClient.post<MedicationSchedule>(`/api/families/${familyId}/medications/${scheduleId}/confirm`, payload || {});
  },

  async pauseSchedule(
    familyId: string,
    scheduleId: string,
    reason?: string
  ): Promise<ApiResponse<MedicationSchedule>> {
    return apiClient.post<MedicationSchedule>(`/api/families/${familyId}/medications/${scheduleId}/pause`, { reason });
  },

  async resumeSchedule(familyId: string, scheduleId: string): Promise<ApiResponse<MedicationSchedule>> {
    return apiClient.post<MedicationSchedule>(`/api/families/${familyId}/medications/${scheduleId}/resume`, {});
  },

  async discontinueSchedule(
    familyId: string,
    scheduleId: string,
    reason?: string
  ): Promise<ApiResponse<MedicationSchedule>> {
    return apiClient.post<MedicationSchedule>(`/api/families/${familyId}/medications/${scheduleId}/discontinue`, { reason });
  },

  async getScheduleHistory(
    familyId: string,
    scheduleId: string
  ): Promise<ApiResponse<MedicationScheduleHistory[]>> {
    return apiClient.get<MedicationScheduleHistory[]>(`/api/families/${familyId}/medications/${scheduleId}/history`);
  },

  async getPrefillCandidates(
    familyId: string,
    documentId: string,
    patientProfileId: string
  ): Promise<ApiResponse<PrefilledMedicineCandidate[]>> {
    const q = new URLSearchParams({ documentId, patientProfileId });
    return apiClient.get<PrefilledMedicineCandidate[]>(`/api/families/${familyId}/medications/prefill-candidates?${q.toString()}`);
  },

  async listDoses(
    familyId: string,
    params?: {
      patientProfileId?: string;
      startDate?: string;
      endDate?: string;
      status?: string;
    }
  ): Promise<ApiResponse<MedicationDoseOccurrence[]>> {
    const q = new URLSearchParams();
    if (params?.patientProfileId) q.append('patientProfileId', params.patientProfileId);
    if (params?.startDate) q.append('startDate', params.startDate);
    if (params?.endDate) q.append('endDate', params.endDate);
    if (params?.status) q.append('status', params.status);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return apiClient.get<MedicationDoseOccurrence[]>(`/api/families/${familyId}/medications/doses${qs}`);
  },

  async updateDoseStatus(
    familyId: string,
    doseId: string,
    status: DoseOccurrenceStatus,
    note?: string
  ): Promise<ApiResponse<MedicationDoseOccurrence>> {
    return apiClient.patch<MedicationDoseOccurrence>(`/api/families/${familyId}/medications/doses/${doseId}/status`, {
      status,
      note,
    });
  },

  async generateDoses(
    familyId: string,
    patientProfileId: string,
    daysAhead = 7
  ): Promise<ApiResponse<{ generatedCount: number }>> {
    return apiClient.post<{ generatedCount: number }>(`/api/families/${familyId}/medications/doses/generate`, {
      patientProfileId,
      daysAhead,
    });
  },
};
