/**
 * frontend/src/services/syncService.ts
 *
 * Frontend API client service for Phase 7 synchronization endpoints.
 */

import { apiClient } from '../lib/apiClient.ts';
import {
  SyncOperationItem,
  SyncBatchResponse,
  SyncConflict,
  SyncStatusOverview,
} from '../types/sync.ts';

export const syncApiService = {
  /**
   * Submit a batch of offline-queued operations to backend.
   */
  async submitBatch(
    familyId: string,
    operations: SyncOperationItem[]
  ): Promise<{ data: SyncBatchResponse | null; error: string | null }> {
    const res = await apiClient.post<SyncBatchResponse>(`/api/families/${familyId}/sync/batch`, {
      operations,
    });
    return { data: res.data, error: res.error };
  },

  /**
   * Retrieve authoritative delta changes since client's last sync timestamp.
   */
  async getDelta(
    familyId: string,
    sinceIso?: string,
    patientProfileId?: string
  ): Promise<{
    data: {
      patients: unknown[];
      documents: unknown[];
      medications: unknown[];
      appointments: unknown[];
      conflicts: SyncConflict[];
      serverTimestamp: string;
    } | null;
    error: string | null;
  }> {
    let url = `/api/families/${familyId}/sync/delta`;
    const params = new URLSearchParams();
    if (sinceIso) params.set('since', sinceIso);
    if (patientProfileId) params.set('patientProfileId', patientProfileId);
    if (params.toString()) url += `?${params.toString()}`;

    const res = await apiClient.get<{
      patients: unknown[];
      documents: unknown[];
      medications: unknown[];
      appointments: unknown[];
      conflicts: SyncConflict[];
      serverTimestamp: string;
    }>(url);

    return { data: res.data, error: res.error };
  },

  /**
   * Get sync status and conflict counts.
   */
  async getStatus(familyId: string): Promise<{ data: SyncStatusOverview | null; error: string | null }> {
    const res = await apiClient.get<SyncStatusOverview>(`/api/families/${familyId}/sync/status`);
    return { data: res.data, error: res.error };
  },

  /**
   * Resolve an outstanding conflict.
   */
  async resolveConflict(
    familyId: string,
    conflictId: string,
    resolution: 'resolved_client' | 'resolved_server' | 'resolved_merged',
    resolvedValue?: Record<string, unknown>
  ): Promise<{ data: { conflict: SyncConflict } | null; error: string | null }> {
    const res = await apiClient.post<{ conflict: SyncConflict }>(
      `/api/families/${familyId}/sync/conflicts/${conflictId}/resolve`,
      { resolution, resolvedValue }
    );
    return { data: res.data, error: res.error };
  },

  /**
   * Upload an offline-captured document with idempotency key.
   */
  async uploadSyncedDocument(
    familyId: string,
    patientProfileId: string,
    file: Blob,
    fileName: string,
    idempotencyKey: string,
    title?: string,
    category?: string
  ): Promise<{ data: unknown | null; error: string | null }> {
    const formData = new FormData();
    formData.append('file', file, fileName);
    formData.append('patientProfileId', patientProfileId);
    formData.append('idempotencyKey', idempotencyKey);
    if (title) formData.append('title', title);
    if (category) formData.append('category', category);

    const res = await apiClient.upload<unknown>(`/api/families/${familyId}/documents/upload`, formData);
    return { data: res.data, error: res.error };
  },
};
