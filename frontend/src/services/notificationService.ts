/**
 * frontend/src/services/notificationService.ts
 *
 * Frontend API client for Notifications, In-App Inbox, Preferences, and Caregiver Escalation Policies.
 */

import { apiClient, ApiResponse } from '../lib/apiClient';
import {
  Notification,
  NotificationPreference,
  CaregiverReminderPolicy,
} from '../types/notification';

export const notificationApiService = {
  async listNotifications(
    familyId: string,
    params?: {
      category?: string;
      status?: string;
      patientProfileId?: string;
    }
  ): Promise<ApiResponse<Notification[]>> {
    const q = new URLSearchParams();
    if (params?.category) q.append('category', params.category);
    if (params?.status) q.append('status', params.status);
    if (params?.patientProfileId) q.append('patientProfileId', params.patientProfileId);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return apiClient.get<Notification[]>(`/api/families/${familyId}/notifications${qs}`);
  },

  async markAsRead(familyId: string, notificationId: string): Promise<ApiResponse<Notification>> {
    return apiClient.patch<Notification>(`/api/families/${familyId}/notifications/${notificationId}/read`, {});
  },

  async acknowledgeNotification(familyId: string, notificationId: string): Promise<ApiResponse<Notification>> {
    return apiClient.patch<Notification>(`/api/families/${familyId}/notifications/${notificationId}/acknowledge`, {});
  },

  async getPreferences(familyId: string): Promise<ApiResponse<NotificationPreference>> {
    return apiClient.get<NotificationPreference>(`/api/families/${familyId}/notifications/preferences`);
  },

  async updatePreferences(
    familyId: string,
    payload: Partial<NotificationPreference>
  ): Promise<ApiResponse<NotificationPreference>> {
    return apiClient.put<NotificationPreference>(`/api/families/${familyId}/notifications/preferences`, payload);
  },

  async getCaregiverPolicies(familyId: string): Promise<ApiResponse<CaregiverReminderPolicy[]>> {
    return apiClient.get<CaregiverReminderPolicy[]>(`/api/families/${familyId}/notifications/caregiver-policies`);
  },

  async setCaregiverPolicy(
    familyId: string,
    payload: {
      patientProfileId: string;
      caregiverUserId: string;
      escalateUnacknowledgedMeds?: boolean;
      escalationDelayMinutes?: number;
      quietHoursOverrideForUrgent?: boolean;
    }
  ): Promise<ApiResponse<CaregiverReminderPolicy>> {
    return apiClient.post<CaregiverReminderPolicy>(`/api/families/${familyId}/notifications/caregiver-policies`, payload);
  },

  async triggerTestDispatch(familyId: string): Promise<ApiResponse<{ processed: number }>> {
    return apiClient.post<{ processed: number }>(`/api/families/${familyId}/notifications/test-dispatch`, {});
  },
};
