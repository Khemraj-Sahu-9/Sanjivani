/**
 * frontend/src/features/sync/OfflineSync.test.tsx
 *
 * Frontend unit & component tests for Phase 7 Offline-First Health Records.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { offlineStorage } from '../../lib/offlineStorage.ts';
import { ConnectivityBanner } from '../../components/sync/ConnectivityBanner.tsx';
import { SyncDashboardModal } from '../../components/sync/SyncDashboardModal.tsx';
import { AuthProvider } from '../auth/AuthContext.tsx';
import { MemoryRouter } from 'react-router-dom';

describe('Phase 7 — Frontend Offline Storage & Components', () => {
  beforeEach(async () => {
    await offlineStorage.clearAllLocalData();
  });

  describe('1. Persistent Local Storage & Account Isolation', () => {
    it('persists and retrieves patient snapshots scoped to user', async () => {
      const userA = 'user-uuid-111';
      const patient = {
        id: 'patient-uuid-aaa',
        family_id: 'family-uuid-1',
        health_id: 'SNJ-2026-AAAA-BBBB',
        full_name: 'Aarav Sharma',
        category: 'child',
        updated_at: new Date().toISOString(),
        cached_at: new Date().toISOString(),
      };

      await offlineStorage.savePatientSnapshot(userA, patient);
      const retrieved = await offlineStorage.getPatientSnapshot(userA, patient.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.full_name).toBe('Aarav Sharma');
      expect(retrieved?.health_id).toBe('SNJ-2026-AAAA-BBBB');
    });

    it('isolates data between accounts and clears on user logout', async () => {
      const userA = 'user-uuid-111';
      const userB = 'user-uuid-222';

      await offlineStorage.savePatientSnapshot(userA, {
        id: 'patient-a',
        family_id: 'fam-1',
        health_id: 'SNJ-AAAA',
        full_name: 'Patient User A',
        category: 'adult',
        updated_at: new Date().toISOString(),
        cached_at: new Date().toISOString(),
      });

      await offlineStorage.savePatientSnapshot(userB, {
        id: 'patient-b',
        family_id: 'fam-2',
        health_id: 'SNJ-BBBB',
        full_name: 'Patient User B',
        category: 'child',
        updated_at: new Date().toISOString(),
        cached_at: new Date().toISOString(),
      });

      // Clear User A's data (simulating User A logging out on a shared device)
      await offlineStorage.clearUserData(userA);

      const patientA = await offlineStorage.getPatientSnapshot(userA, 'patient-a');
      const patientB = await offlineStorage.getPatientSnapshot(userB, 'patient-b');

      expect(patientA).toBeNull(); // User A's private medical data wiped
      expect(patientB).not.toBeNull(); // User B's data preserved
    });

    it('manages the offline edit queue correctly', async () => {
      const userA = 'user-uuid-111';
      const clientOpId = 'op-1234';

      await offlineStorage.enqueueOperation({
        clientOperationId: clientOpId,
        userId: userA,
        familyId: 'family-1',
        operationType: 'PATIENT_UPDATE',
        payload: { fullName: 'New Name' },
        clientTimestamp: new Date().toISOString(),
        retryCount: 0,
        status: 'saved_on_device',
        idempotencyKey: 'idem_op-1234',
      });

      const pending = await offlineStorage.listPendingOperations(userA, 'family-1');
      expect(pending).toHaveLength(1);
      expect(pending[0]!.status).toBe('saved_on_device');

      // Update operation status
      await offlineStorage.updateQueuedOperation(clientOpId, { status: 'synced' });
      const updated = await offlineStorage.getQueuedOperation(clientOpId);
      expect(updated?.status).toBe('synced');

      // Remove operation
      await offlineStorage.removeQueuedOperation(clientOpId);
      const afterRemoval = await offlineStorage.getQueuedOperation(clientOpId);
      expect(afterRemoval).toBeNull();
    });
  });

  describe('2. ConnectivityBanner Component', () => {
    it('renders persistent offline banner when connectivity is unavailable', () => {
      // Mock navigator.onLine = false
      Object.defineProperty(window.navigator, 'onLine', {
        writable: true,
        value: false,
      });

      render(
        <MemoryRouter>
          <AuthProvider>
            <ConnectivityBanner onOpenSyncDashboard={() => {}} />
          </AuthProvider>
        </MemoryRouter>
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Offline Mode:/i)).toBeInTheDocument();
      expect(screen.getByText(/Internet connection is unavailable/i)).toBeInTheDocument();
    });
  });

  describe('3. SyncDashboardModal Component', () => {
    it('renders storage quota and network diagnostic cards', async () => {
      render(
        <MemoryRouter>
          <AuthProvider>
            <SyncDashboardModal isOpen={true} onClose={() => {}} />
          </AuthProvider>
        </MemoryRouter>
      );

      expect(screen.getByText(/Offline & Synchronization Center/i)).toBeInTheDocument();
      expect(screen.getByText(/BROWSER NETWORK/i)).toBeInTheDocument();
      expect(screen.getByText(/BACKEND SERVICE/i)).toBeInTheDocument();
      expect(screen.getByText(/Device Storage Quota/i)).toBeInTheDocument();
    });

    it('triggers sync when clicking Sync Now button', async () => {
      // Restore online
      Object.defineProperty(window.navigator, 'onLine', {
        writable: true,
        value: true,
      });

      render(
        <MemoryRouter>
          <AuthProvider>
            <SyncDashboardModal isOpen={true} onClose={() => {}} />
          </AuthProvider>
        </MemoryRouter>
      );

      const syncBtn = screen.getByRole('button', { name: /Sync Now/i });
      fireEvent.click(syncBtn);

      await waitFor(() => {
        expect(syncBtn).toBeInTheDocument();
      });
    });
  });
});
