/**
 * frontend/src/services/healthMemoryService.ts
 *
 * Frontend service layer for AI Health Memory query, patient timeline,
 * laboratory trend analysis, and doctor summary generation.
 */

import { apiClient, ApiResponse, getStoredAuthToken } from '../lib/apiClient';
import {
  AIMemoryQueryResponse,
  TimelineEvent,
  LabTrendSeries,
  DoctorSummaryOptions,
} from '../types/memory';

const RAW_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';
const BASE_URL = RAW_BASE_URL.replace(/\/+$/, '');

export const healthMemoryApiService = {
  async askMemory(
    familyId: string,
    patientProfileId: string,
    question: string,
    conversationId?: string
  ): Promise<ApiResponse<AIMemoryQueryResponse>> {
    return apiClient.post<AIMemoryQueryResponse>(`/api/families/${familyId}/memory/ask`, {
      patientProfileId,
      question,
      conversationId,
    });
  },

  async getTimeline(familyId: string, patientProfileId: string): Promise<ApiResponse<TimelineEvent[]>> {
    return apiClient.get<TimelineEvent[]>(`/api/families/${familyId}/memory/patients/${patientProfileId}/timeline`);
  },

  async getLabTrends(familyId: string, patientProfileId: string): Promise<ApiResponse<LabTrendSeries[]>> {
    return apiClient.get<LabTrendSeries[]>(`/api/families/${familyId}/memory/patients/${patientProfileId}/lab-trends`);
  },

  async previewDoctorSummary(
    familyId: string,
    options: DoctorSummaryOptions
  ): Promise<ApiResponse<{ patient: any; selectedDocs: any[]; includedSections: string[] }>> {
    return apiClient.post<{ patient: any; selectedDocs: any[]; includedSections: string[] }>(
      `/api/families/${familyId}/memory/doctor-summary/preview`,
      options
    );
  },

  async downloadDoctorSummaryPdf(familyId: string, options: DoctorSummaryOptions): Promise<void> {
    const token = getStoredAuthToken();
    const response = await fetch(`${BASE_URL}/api/families/${familyId}/memory/doctor-summary/pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(options),
    });

    if (!response.ok) {
      throw new Error(`PDF generation failed with status ${response.status}`);
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `Doctor_Summary_${Date.now()}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
  },
};
