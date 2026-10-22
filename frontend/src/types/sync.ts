/**
 * frontend/src/types/sync.ts
 *
 * TypeScript types for Phase 7 Offline Synchronization & Conflicts.
 */

export type SyncOperationType =
  | 'PATIENT_UPDATE'
  | 'APPOINTMENT_CREATE'
  | 'APPOINTMENT_UPDATE'
  | 'MEDICATION_DOSE_RECORD'
  | 'MEDICATION_SCHEDULE_CREATE'
  | 'DOCUMENT_UPLOAD';

export type SyncOperationStatus =
  | 'saved_on_device'
  | 'waiting_to_sync'
  | 'syncing'
  | 'synced'
  | 'failed'
  | 'conflict';

export type SyncErrorCategory =
  | 'network'
  | 'auth'
  | 'validation'
  | 'conflict'
  | 'quota'
  | 'server';

export interface SyncOperationItem {
  clientOperationId: string;
  idempotencyKey: string;
  patientProfileId?: string;
  operationType: SyncOperationType;
  payload: Record<string, unknown>;
  baseRevision?: string;
  clientTimestamp: string;
  retryCount?: number;
}

export interface SyncConflict {
  id: string;
  family_id: string;
  patient_profile_id?: string | null;
  client_operation_id: string;
  entity_type: 'patient_profile' | 'appointment' | 'medication_schedule';
  entity_id: string;
  field_name?: string | null;
  local_value: Record<string, unknown>;
  server_value: Record<string, unknown>;
  base_value?: Record<string, unknown> | null;
  resolution_status: 'pending' | 'resolved_client' | 'resolved_server' | 'resolved_merged';
  resolved_by?: string | null;
  resolved_at?: string | null;
  resolved_value?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface SyncBatchResponse {
  results: Array<{
    clientOperationId: string;
    status: 'synced' | 'failed' | 'conflict';
    serverEntityId?: string;
    resultPayload?: Record<string, unknown>;
    errorCategory?: SyncErrorCategory;
    errorMessage?: string;
    conflict?: SyncConflict;
  }>;
  serverTimestamp: string;
  pendingConflictsCount: number;
}

export interface SyncStatusOverview {
  familyId: string;
  pendingConflictsCount: number;
  recentOperations: unknown[];
  serverTimestamp: string;
}

export type ConnectivityState =
  | 'online_synced'
  | 'online_syncing'
  | 'online_pending'
  | 'offline'
  | 'backend_unreachable'
  | 'sync_error';
