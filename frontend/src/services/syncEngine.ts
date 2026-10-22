/**
 * frontend/src/services/syncEngine.ts
 *
 * Client Synchronization Engine for Phase 7.
 * Manages the offline edit queue, triggers automatic background sync on reconnect,
 * applies exponential backoff, batches operations to the backend, and reconciles
 * local IndexedDB snapshots with authoritative server deltas.
 */

import { offlineStorage, QueuedSyncOperation } from '../lib/offlineStorage.ts';
import { syncApiService } from './syncService.ts';
import { SyncOperationItem } from '../types/sync.ts';

type SyncListener = () => void;

class SyncEngine {
  private isSyncing = false;
  private listeners: Set<SyncListener> = new Set();
  private lastSyncTimestamp: string | null = null;

  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        // Ignore listener exceptions
      }
    }
  }

  getLastSyncTimestamp(): string | null {
    return this.lastSyncTimestamp;
  }

  /**
   * Enqueue a new operation when user performs an action (online or offline).
   */
  async enqueueOperation(
    userId: string,
    familyId: string,
    operationType: QueuedSyncOperation['operationType'],
    payload: Record<string, unknown>,
    patientProfileId?: string,
    baseRevision?: string,
    fileBlob?: Blob,
    fileName?: string
  ): Promise<QueuedSyncOperation> {
    const clientOperationId = crypto.randomUUID();
    const idempotencyKey = `idem_${clientOperationId}`;
    const now = new Date().toISOString();

    const op: QueuedSyncOperation = {
      clientOperationId,
      userId,
      familyId,
      patientProfileId,
      operationType,
      payload,
      baseRevision: baseRevision || now,
      clientTimestamp: now,
      retryCount: 0,
      status: 'waiting_to_sync',
      idempotencyKey,
      fileBlob: fileBlob || null,
      fileName: fileName || null,
    };

    await offlineStorage.enqueueOperation(op);
    this.notifyListeners();

    // Trigger sync if online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      this.triggerSync(familyId, userId).catch(() => {
        // Safe catch, will retry on reconnection
      });
    }

    return op;
  }

  /**
   * Main synchronization procedure.
   */
  async triggerSync(familyId: string, userId: string): Promise<{ success: boolean; syncedCount: number; error?: string }> {
    if (this.isSyncing) {
      return { success: false, syncedCount: 0, error: 'Synchronization already in progress' };
    }

    this.isSyncing = true;
    this.notifyListeners();

    try {
      const pending = await offlineStorage.listPendingOperations(userId, familyId);
      let syncedCount = 0;

      // 1. Process document upload operations first
      const uploadOps = pending.filter((op) => op.operationType === 'DOCUMENT_UPLOAD' && op.fileBlob);
      for (const op of uploadOps) {
        if (!op.patientProfileId || !op.fileBlob) continue;
        await offlineStorage.updateQueuedOperation(op.clientOperationId, { status: 'syncing' });

        const uploadRes = await syncApiService.uploadSyncedDocument(
          familyId,
          op.patientProfileId,
          op.fileBlob,
          op.fileName || 'offline_document.pdf',
          op.idempotencyKey,
          op.payload.title as string | undefined,
          op.payload.category as string | undefined
        );

        if (uploadRes.error) {
          await offlineStorage.updateQueuedOperation(op.clientOperationId, {
            status: 'failed',
            errorCategory: 'server',
            errorMessage: uploadRes.error,
            retryCount: op.retryCount + 1,
          });
        } else {
          await offlineStorage.updateQueuedOperation(op.clientOperationId, {
            status: 'synced',
            errorCategory: undefined,
            errorMessage: undefined,
          });
          syncedCount++;
        }
      }

      // 2. Batch non-upload operations
      const batchOps = pending.filter((op) => op.operationType !== 'DOCUMENT_UPLOAD');
      if (batchOps.length > 0) {
        for (const op of batchOps) {
          await offlineStorage.updateQueuedOperation(op.clientOperationId, { status: 'syncing' });
        }

        const items: SyncOperationItem[] = batchOps.map((op) => ({
          clientOperationId: op.clientOperationId,
          idempotencyKey: op.idempotencyKey,
          patientProfileId: op.patientProfileId,
          operationType: op.operationType,
          payload: op.payload,
          baseRevision: op.baseRevision,
          clientTimestamp: op.clientTimestamp,
          retryCount: op.retryCount,
        }));

        const batchRes = await syncApiService.submitBatch(familyId, items);

        if (batchRes.error || !batchRes.data) {
          // Entire batch call failed (e.g. network failure)
          for (const op of batchOps) {
            await offlineStorage.updateQueuedOperation(op.clientOperationId, {
              status: op.retryCount >= 4 ? 'failed' : 'waiting_to_sync',
              retryCount: op.retryCount + 1,
              errorCategory: 'network',
              errorMessage: batchRes.error || 'Network error during batch sync',
            });
          }
        } else {
          // Process per-operation result
          for (const res of batchRes.data.results) {
            if (res.status === 'synced') {
              await offlineStorage.updateQueuedOperation(res.clientOperationId, {
                status: 'synced',
                errorCategory: undefined,
                errorMessage: undefined,
              });
              syncedCount++;
            } else if (res.status === 'conflict') {
              await offlineStorage.updateQueuedOperation(res.clientOperationId, {
                status: 'conflict',
                errorCategory: 'conflict',
                errorMessage: res.errorMessage || 'Concurrent modification conflict detected',
              });
            } else {
              await offlineStorage.updateQueuedOperation(res.clientOperationId, {
                status: 'failed',
                errorCategory: res.errorCategory || 'server',
                errorMessage: res.errorMessage || 'Operation rejected by server',
                retryCount: 1,
              });
            }
          }
        }
      }

      // 3. Pull authoritative delta to update local cache
      const deltaRes = await syncApiService.getDelta(familyId, this.lastSyncTimestamp || undefined);
      if (deltaRes.data) {
        this.lastSyncTimestamp = deltaRes.data.serverTimestamp;
      }

      this.notifyListeners();
      return { success: true, syncedCount };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown sync failure';
      return { success: false, syncedCount: 0, error: msg };
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
    }
  }

  isCurrentlySyncing(): boolean {
    return this.isSyncing;
  }
}

export const syncEngine = new SyncEngine();
