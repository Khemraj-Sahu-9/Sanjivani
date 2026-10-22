/**
 * frontend/src/services/appointmentService.ts
 *
 * Frontend API client for Doctor Appointments.
 */

import { apiClient, ApiResponse } from '../lib/apiClient';
import {
  Appointment,
  CreateAppointmentPayload,
  UpdateAppointmentPayload,
} from '../types/appointment';

export const appointmentApiService = {
  async listAppointments(
    familyId: string,
    params?: { patientProfileId?: string; status?: string; upcomingOnly?: boolean }
  ): Promise<ApiResponse<Appointment[]>> {
    const q = new URLSearchParams();
    if (params?.patientProfileId) q.append('patientProfileId', params.patientProfileId);
    if (params?.status) q.append('status', params.status);
    if (params?.upcomingOnly !== undefined) q.append('upcomingOnly', String(params.upcomingOnly));
    const qs = q.toString() ? `?${q.toString()}` : '';
    return apiClient.get<Appointment[]>(`/api/families/${familyId}/appointments${qs}`);
  },

  async createAppointment(
    familyId: string,
    payload: CreateAppointmentPayload
  ): Promise<ApiResponse<Appointment>> {
    return apiClient.post<Appointment>(`/api/families/${familyId}/appointments`, payload);
  },

  async getAppointment(familyId: string, appointmentId: string): Promise<ApiResponse<Appointment>> {
    return apiClient.get<Appointment>(`/api/families/${familyId}/appointments/${appointmentId}`);
  },

  async updateAppointment(
    familyId: string,
    appointmentId: string,
    payload: UpdateAppointmentPayload
  ): Promise<ApiResponse<Appointment>> {
    return apiClient.put<Appointment>(`/api/families/${familyId}/appointments/${appointmentId}`, payload);
  },

  async cancelAppointment(
    familyId: string,
    appointmentId: string,
    reason?: string
  ): Promise<ApiResponse<Appointment>> {
    return apiClient.post<Appointment>(`/api/families/${familyId}/appointments/${appointmentId}/cancel`, { reason });
  },

  async completeAppointment(
    familyId: string,
    appointmentId: string,
    notes?: string
  ): Promise<ApiResponse<Appointment>> {
    return apiClient.post<Appointment>(`/api/families/${familyId}/appointments/${appointmentId}/complete`, { notes });
  },
};
