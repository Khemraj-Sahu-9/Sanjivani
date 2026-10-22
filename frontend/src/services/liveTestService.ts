/**
 * frontend/src/services/liveTestService.ts
 *
 * Frontend API client for Phase 6 Live Test Mode & Telephony Integration.
 */

import { apiClient, ApiResponse } from '../lib/apiClient';
import {
  LiveTestAuditLog,
  LiveTestChannel,
  LiveTestConsentStatus,
  LiveTestDispatchRequest,
  LiveTestDispatchResult,
  LiveTestPreflightResponse,
  LiveTestRecipient,
  LiveTestVerificationStatus,
  TelephonyProviderHealth,
} from '../types/liveTest';

export interface AddRecipientPayload {
  displayName: string;
  phoneNumber: string;
  permittedChannel: LiveTestChannel;
  allowedPurpose?: string;
  consentNotes?: string;
  verified?: boolean;
}

export const liveTestApiService = {
  async getProviderHealth(
    familyId: string
  ): Promise<ApiResponse<{ health: TelephonyProviderHealth }>> {
    return apiClient.get(`/api/families/${familyId}/sos/live-test/health`);
  },

  async listRecipients(
    familyId: string
  ): Promise<ApiResponse<{ recipients: LiveTestRecipient[] }>> {
    return apiClient.get(`/api/families/${familyId}/sos/live-test/recipients`);
  },

  async addRecipient(
    familyId: string,
    payload: AddRecipientPayload
  ): Promise<ApiResponse<{ recipient: LiveTestRecipient }>> {
    return apiClient.post(`/api/families/${familyId}/sos/live-test/recipients`, payload);
  },

  async verifyRecipient(
    familyId: string,
    recipientId: string,
    status: LiveTestVerificationStatus = 'VERIFIED',
    notes?: string
  ): Promise<ApiResponse<{ recipient: LiveTestRecipient }>> {
    return apiClient.post(`/api/families/${familyId}/sos/live-test/recipients/${recipientId}/verify`, {
      status,
      notes,
    });
  },

  async updateConsent(
    familyId: string,
    recipientId: string,
    consentStatus: LiveTestConsentStatus,
    notes?: string
  ): Promise<ApiResponse<{ recipient: LiveTestRecipient }>> {
    return apiClient.post(`/api/families/${familyId}/sos/live-test/recipients/${recipientId}/consent`, {
      consentStatus,
      notes,
    });
  },

  async deleteRecipient(
    familyId: string,
    recipientId: string
  ): Promise<ApiResponse<{ message: string }>> {
    return apiClient.delete(`/api/families/${familyId}/sos/live-test/recipients/${recipientId}`);
  },

  async getPreflight(
    familyId: string,
    incidentId: string
  ): Promise<ApiResponse<{ preflight: LiveTestPreflightResponse }>> {
    return apiClient.get(`/api/families/${familyId}/sos/live-test/preflight/${incidentId}`);
  },

  async dispatchLiveTest(
    familyId: string,
    payload: LiveTestDispatchRequest
  ): Promise<ApiResponse<{ result: LiveTestDispatchResult }>> {
    return apiClient.post(`/api/families/${familyId}/sos/live-test/dispatch`, payload);
  },

  async recordHumanAcknowledgement(
    familyId: string,
    auditLogId: string,
    note?: string
  ): Promise<ApiResponse<{ auditLog: LiveTestAuditLog }>> {
    return apiClient.post(`/api/families/${familyId}/sos/live-test/acknowledge/${auditLogId}`, {
      note,
    });
  },

  async listAuditLogs(
    familyId: string,
    incidentId?: string
  ): Promise<ApiResponse<{ logs: LiveTestAuditLog[] }>> {
    const url = incidentId
      ? `/api/families/${familyId}/sos/live-test/logs?incidentId=${incidentId}`
      : `/api/families/${familyId}/sos/live-test/logs`;
    return apiClient.get(url);
  },
};
