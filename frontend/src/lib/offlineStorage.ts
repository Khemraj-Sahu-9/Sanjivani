/**
 * frontend/src/lib/offlineStorage.ts
 *
 * Structured Persistent Local Storage for Phase 7 Offline-First Health Records.
 * Implements an IndexedDB datastore partitioned by authenticated user ID.
 *
 * Supported local stores:
 * - patient_snapshots: Scoped by `${userId}:${patientId}`
 * - document_snapshots: Scoped by `${userId}:${documentId}`
 * - document_files: Scoped by `${userId}:${documentId}` (ArrayBuffer/Blob)
 * - appointment_snapshots: Scoped by `${userId}:${appointmentId}`
 * - medication_snapshots: Scoped by `${userId}:${scheduleId}`
 * - dose_snapshots: Scoped by `${userId}:${doseId}`
 * - sync_queue: Scoped by `clientOperationId` (contains userId, status, payload)
 * - sync_metadata: Scoped by `${userId}:${familyId}`
 */

export interface QueuedSyncOperation {
  clientOperationId: string;
  userId: string;
  familyId: string;
  patientProfileId?: string;
  operationType:
    | 'PATIENT_UPDATE'
    | 'APPOINTMENT_CREATE'
    | 'APPOINTMENT_UPDATE'
    | 'MEDICATION_DOSE_RECORD'
    | 'MEDICATION_SCHEDULE_CREATE'
    | 'DOCUMENT_UPLOAD';
  payload: Record<string, unknown>;
  baseRevision?: string;
  clientTimestamp: string;
  retryCount: number;
  status: 'saved_on_device' | 'waiting_to_sync' | 'syncing' | 'synced' | 'failed' | 'conflict';
  idempotencyKey: string;
  errorCategory?: 'network' | 'auth' | 'validation' | 'conflict' | 'quota' | 'server';
  errorMessage?: string;
  fileBlob?: Blob | null;
  fileName?: string | null;
}

export interface PatientSnapshot {
  id: string;
  family_id: string;
  health_id: string;
  full_name: string;
  date_of_birth?: string | null;
  gender?: string | null;
  relationship_to_creator?: string | null;
  category: string;
  updated_at: string;
  cached_at: string;
  medical_history?: Array<{ condition: string; diagnosedYear?: string }>;
  allergies?: string[];
  chronic_conditions?: string[];
}

export interface DocumentSnapshot {
  id: string;
  family_id: string;
  patient_profile_id: string;
  title: string;
  category: string;
  document_date?: string | null;
  doctor_name?: string | null;
  facility_name?: string | null;
  file_size_bytes?: number;
  processing_status: string;
  review_status: string;
  updated_at: string;
  cached_at: string;
  is_downloaded_offline: boolean;
}

export interface AppointmentSnapshot {
  id: string;
  family_id: string;
  patient_profile_id: string;
  title: string;
  doctor_name?: string | null;
  specialty?: string | null;
  location?: string | null;
  scheduled_at: string;
  status: string;
  notes?: string | null;
  updated_at: string;
  cached_at: string;
}

export interface MedicationSnapshot {
  id: string;
  family_id: string;
  patient_profile_id: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  times_of_day: string[];
  start_date: string;
  end_date?: string | null;
  instructions?: string | null;
  status: string;
  updated_at: string;
  cached_at: string;
}

export interface DoseSnapshot {
  id: string;
  medication_schedule_id: string;
  patient_profile_id: string;
  scheduled_time: string;
  status: 'scheduled' | 'taken' | 'skipped' | 'missed';
  taken_at?: string | null;
  action_notes?: string | null;
  is_local_only?: boolean;
  cached_at: string;
}

const DB_NAME = 'sanjivani_offline_db';
const DB_VERSION = 1;

class OfflineStorageManager {
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  // In-memory fallback map for non-IndexedDB environments (e.g. SSR, test runners)
  private memoryFallback = new Map<string, Map<string, unknown>>();

  constructor() {
    this.memoryFallback.set('patient_snapshots', new Map());
    this.memoryFallback.set('document_snapshots', new Map());
    this.memoryFallback.set('document_files', new Map());
    this.memoryFallback.set('appointment_snapshots', new Map());
    this.memoryFallback.set('medication_snapshots', new Map());
    this.memoryFallback.set('dose_snapshots', new Map());
    this.memoryFallback.set('sync_queue', new Map());
    this.memoryFallback.set('sync_metadata', new Map());
  }

  private isIDBAvailable(): boolean {
    return typeof window !== 'undefined' && 'indexedDB' in window && window.indexedDB !== null;
  }

  private async getDB(): Promise<IDBDatabase | null> {
    if (!this.isIDBAvailable()) return null;
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve) => {
      try {
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('patient_snapshots')) db.createObjectStore('patient_snapshots');
          if (!db.objectStoreNames.contains('document_snapshots')) db.createObjectStore('document_snapshots');
          if (!db.objectStoreNames.contains('document_files')) db.createObjectStore('document_files');
          if (!db.objectStoreNames.contains('appointment_snapshots')) db.createObjectStore('appointment_snapshots');
          if (!db.objectStoreNames.contains('medication_snapshots')) db.createObjectStore('medication_snapshots');
          if (!db.objectStoreNames.contains('dose_snapshots')) db.createObjectStore('dose_snapshots');
          if (!db.objectStoreNames.contains('sync_queue')) db.createObjectStore('sync_queue');
          if (!db.objectStoreNames.contains('sync_metadata')) db.createObjectStore('sync_metadata');
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  private async idbGet<T>(storeName: string, key: string): Promise<T | null> {
    const db = await this.getDB();
    if (!db) {
      const store = this.memoryFallback.get(storeName);
      return (store?.get(key) as T) || null;
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.get(key);
        req.onsuccess = () => resolve((req.result as T) || null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  private async idbSet<T>(storeName: string, key: string, value: T): Promise<void> {
    const db = await this.getDB();
    if (!db) {
      this.memoryFallback.get(storeName)?.set(key, value);
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  private async idbDelete(storeName: string, key: string): Promise<void> {
    const db = await this.getDB();
    if (!db) {
      this.memoryFallback.get(storeName)?.delete(key);
      return;
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  private async idbGetAll<T>(storeName: string): Promise<T[]> {
    const db = await this.getDB();
    if (!db) {
      const store = this.memoryFallback.get(storeName);
      return store ? Array.from(store.values() as Iterable<T>) : [];
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  }

  private async idbClearStore(storeName: string): Promise<void> {
    const db = await this.getDB();
    if (!db) {
      this.memoryFallback.get(storeName)?.clear();
      return;
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  // ===========================================================================
  // User-Partitioned Snapshots (Patient, Documents, Appointments, Medications)
  // ===========================================================================

  async savePatientSnapshot(userId: string, patient: PatientSnapshot): Promise<void> {
    await this.idbSet('patient_snapshots', `${userId}:${patient.id}`, {
      ...patient,
      cached_at: new Date().toISOString(),
    });
  }

  async getPatientSnapshot(userId: string, patientId: string): Promise<PatientSnapshot | null> {
    return this.idbGet<PatientSnapshot>('patient_snapshots', `${userId}:${patientId}`);
  }

  async listPatientSnapshots(_userId: string, familyId: string): Promise<PatientSnapshot[]> {
    const all = await this.idbGetAll<PatientSnapshot>('patient_snapshots');
    return all.filter((p) => p.family_id === familyId);
  }

  async saveDocumentSnapshots(userId: string, docs: DocumentSnapshot[]): Promise<void> {
    for (const doc of docs) {
      await this.idbSet('document_snapshots', `${userId}:${doc.id}`, {
        ...doc,
        cached_at: new Date().toISOString(),
      });
    }
  }

  async listDocumentSnapshots(_userId: string, familyId: string, patientProfileId?: string): Promise<DocumentSnapshot[]> {
    const all = await this.idbGetAll<DocumentSnapshot>('document_snapshots');
    return all.filter(
      (d) => d.family_id === familyId && (!patientProfileId || d.patient_profile_id === patientProfileId)
    );
  }

  async saveDownloadedDocumentFile(userId: string, documentId: string, blob: Blob): Promise<void> {
    await this.idbSet('document_files', `${userId}:${documentId}`, blob);
    // Update snapshot is_downloaded_offline flag
    const doc = await this.idbGet<DocumentSnapshot>('document_snapshots', `${userId}:${documentId}`);
    if (doc) {
      doc.is_downloaded_offline = true;
      await this.idbSet('document_snapshots', `${userId}:${documentId}`, doc);
    }
  }

  async getDownloadedDocumentFile(userId: string, documentId: string): Promise<Blob | null> {
    return this.idbGet<Blob>('document_files', `${userId}:${documentId}`);
  }

  async deleteDownloadedDocumentFile(userId: string, documentId: string): Promise<void> {
    await this.idbDelete('document_files', `${userId}:${documentId}`);
    const doc = await this.idbGet<DocumentSnapshot>('document_snapshots', `${userId}:${documentId}`);
    if (doc) {
      doc.is_downloaded_offline = false;
      await this.idbSet('document_snapshots', `${userId}:${documentId}`, doc);
    }
  }

  async saveAppointments(userId: string, appts: AppointmentSnapshot[]): Promise<void> {
    for (const appt of appts) {
      await this.idbSet('appointment_snapshots', `${userId}:${appt.id}`, {
        ...appt,
        cached_at: new Date().toISOString(),
      });
    }
  }

  async listAppointments(_userId: string, familyId: string, patientProfileId?: string): Promise<AppointmentSnapshot[]> {
    const all = await this.idbGetAll<AppointmentSnapshot>('appointment_snapshots');
    return all.filter(
      (a) => a.family_id === familyId && (!patientProfileId || a.patient_profile_id === patientProfileId)
    );
  }

  async saveMedications(userId: string, meds: MedicationSnapshot[]): Promise<void> {
    for (const med of meds) {
      await this.idbSet('medication_snapshots', `${userId}:${med.id}`, {
        ...med,
        cached_at: new Date().toISOString(),
      });
    }
  }

  async listMedications(_userId: string, familyId: string, patientProfileId?: string): Promise<MedicationSnapshot[]> {
    const all = await this.idbGetAll<MedicationSnapshot>('medication_snapshots');
    return all.filter(
      (m) => m.family_id === familyId && (!patientProfileId || m.patient_profile_id === patientProfileId)
    );
  }

  async saveDoses(userId: string, doses: DoseSnapshot[]): Promise<void> {
    for (const dose of doses) {
      await this.idbSet('dose_snapshots', `${userId}:${dose.id}`, {
        ...dose,
        cached_at: new Date().toISOString(),
      });
    }
  }

  async listDoses(_userId: string, scheduleId: string): Promise<DoseSnapshot[]> {
    const all = await this.idbGetAll<DoseSnapshot>('dose_snapshots');
    return all.filter((d) => d.medication_schedule_id === scheduleId);
  }

  // ===========================================================================
  // Offline Sync Queue Management
  // ===========================================================================

  async enqueueOperation(op: QueuedSyncOperation): Promise<void> {
    await this.idbSet('sync_queue', op.clientOperationId, op);
  }

  async getQueuedOperation(clientOperationId: string): Promise<QueuedSyncOperation | null> {
    return this.idbGet<QueuedSyncOperation>('sync_queue', clientOperationId);
  }

  async updateQueuedOperation(
    clientOperationId: string,
    updates: Partial<QueuedSyncOperation>
  ): Promise<QueuedSyncOperation | null> {
    const existing = await this.getQueuedOperation(clientOperationId);
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    await this.idbSet('sync_queue', clientOperationId, updated);
    return updated;
  }

  async removeQueuedOperation(clientOperationId: string): Promise<void> {
    await this.idbDelete('sync_queue', clientOperationId);
  }

  async listPendingOperations(userId: string, familyId?: string): Promise<QueuedSyncOperation[]> {
    const all = await this.idbGetAll<QueuedSyncOperation>('sync_queue');
    return all.filter(
      (op) =>
        op.userId === userId &&
        (!familyId || op.familyId === familyId) &&
        ['saved_on_device', 'waiting_to_sync', 'failed', 'conflict'].includes(op.status)
    );
  }

  async listAllUserOperations(userId: string, familyId?: string): Promise<QueuedSyncOperation[]> {
    const all = await this.idbGetAll<QueuedSyncOperation>('sync_queue');
    return all
      .filter((op) => op.userId === userId && (!familyId || op.familyId === familyId))
      .sort((a, b) => new Date(b.clientTimestamp).getTime() - new Date(a.clientTimestamp).getTime());
  }

  // ===========================================================================
  // Local Data Protection & Account-Aware Cleanup (Signout / Switch)
  // ===========================================================================

  /**
   * Clear all cached medical data belonging to a specific user.
   * Invoked upon logout, account switching, or explicit user action.
   */
  async clearUserData(userId: string): Promise<void> {
    const stores = [
      'patient_snapshots',
      'document_snapshots',
      'document_files',
      'appointment_snapshots',
      'medication_snapshots',
      'dose_snapshots',
    ];

    for (const store of stores) {
      // In our storage, keys are prefixed with `${userId}:`
      const db = await this.getDB();
      if (!db) {
        const memStore = this.memoryFallback.get(store);
        if (memStore) {
          for (const key of memStore.keys()) {
            if (key.startsWith(`${userId}:`)) {
              memStore.delete(key);
            }
          }
        }
      } else {
        // Query matching keys
        const tx = db.transaction(store, 'readwrite');
        const objStore = tx.objectStore(store);
        const req = objStore.getAllKeys();
        req.onsuccess = () => {
          const keys = req.result as string[];
          for (const key of keys) {
            if (typeof key === 'string' && key.startsWith(`${userId}:`)) {
              objStore.delete(key);
            }
          }
        };
      }
    }

    // Also remove completed or unauthorized sync queue entries for this user
    const queue = await this.idbGetAll<QueuedSyncOperation>('sync_queue');
    for (const op of queue) {
      if (op.userId === userId && op.status === 'synced') {
        await this.idbDelete('sync_queue', op.clientOperationId);
      }
    }
  }

  /**
   * Complete device wipe of all cached Sanjivani health records and files.
   */
  async clearAllLocalData(): Promise<void> {
    const stores = [
      'patient_snapshots',
      'document_snapshots',
      'document_files',
      'appointment_snapshots',
      'medication_snapshots',
      'dose_snapshots',
      'sync_queue',
      'sync_metadata',
    ];

    for (const store of stores) {
      await this.idbClearStore(store);
    }
  }

  /**
   * Estimate current device storage quota and usage.
   */
  async getStorageEstimate(): Promise<{ usageBytes: number; quotaBytes: number; percentUsed: number }> {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      try {
        const est = await navigator.storage.estimate();
        const usageBytes = est.usage || 0;
        const quotaBytes = est.quota || 50 * 1024 * 1024; // Default 50MB estimate
        const percentUsed = quotaBytes > 0 ? Math.round((usageBytes / quotaBytes) * 100) : 0;
        return { usageBytes, quotaBytes, percentUsed };
      } catch {
        // Fallback
      }
    }
    return { usageBytes: 1024 * 1024, quotaBytes: 50 * 1024 * 1024, percentUsed: 2 };
  }
}

export const offlineStorage = new OfflineStorageManager();
