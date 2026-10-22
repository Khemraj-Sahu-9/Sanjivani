/**
 * frontend/src/hooks/useConnectivity.ts
 *
 * Custom React hook managing real-time connectivity status, backend reachability probes,
 * pending operation counts, and synchronization triggers.
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/apiClient.ts';
import { offlineStorage } from '../lib/offlineStorage.ts';
import { syncEngine } from '../services/syncEngine.ts';
import { ConnectivityState } from '../types/sync.ts';

export function useConnectivity(userId?: string, familyId?: string) {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isBackendReachable, setIsBackendReachable] = useState<boolean>(true);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [conflictCount, setConflictCount] = useState<number>(0);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Probe backend health to distinguish true internet reachability
  const probeBackend = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsBackendReachable(false);
      return false;
    }

    try {
      const res = await apiClient.get<{ status: string }>('/api/health');
      const reachable = res.status === 200 && res.data?.status === 'ok';
      setIsBackendReachable(reachable);
      return reachable;
    } catch {
      setIsBackendReachable(false);
      return false;
    }
  }, []);

  const refreshQueueStats = useCallback(async () => {
    if (!userId) return;
    const ops = await offlineStorage.listAllUserOperations(userId, familyId);
    const pending = ops.filter((o) => ['waiting_to_sync', 'syncing', 'saved_on_device'].includes(o.status));
    const conflicts = ops.filter((o) => o.status === 'conflict');

    setPendingCount(pending.length);
    setConflictCount(conflicts.length);
    setLastSyncTime(syncEngine.getLastSyncTimestamp());
  }, [userId, familyId]);

  // Sync Engine subscription
  useEffect(() => {
    const unsubscribe = syncEngine.subscribe(() => {
      refreshQueueStats();
    });
    return unsubscribe;
  }, [refreshQueueStats]);

  // Window online/offline events
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      const reachable = await probeBackend();
      if (reachable && userId && familyId) {
        syncEngine.triggerSync(familyId, userId).catch(() => {});
      }
      refreshQueueStats();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsBackendReachable(false);
      refreshQueueStats();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial probe and stats
    probeBackend();
    refreshQueueStats();

    // Periodic heartbeat probe every 30 seconds
    const interval = setInterval(() => {
      probeBackend();
      refreshQueueStats();
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [probeBackend, refreshQueueStats, userId, familyId]);

  const triggerManualSync = useCallback(async () => {
    if (!userId || !familyId) return;
    await probeBackend();
    return syncEngine.triggerSync(familyId, userId);
  }, [userId, familyId, probeBackend]);

  // Compute derived connectivity state
  let connectivityState: ConnectivityState = 'online_synced';
  if (!isOnline) {
    connectivityState = 'offline';
  } else if (!isBackendReachable) {
    connectivityState = 'backend_unreachable';
  } else if (syncEngine.isCurrentlySyncing()) {
    connectivityState = 'online_syncing';
  } else if (conflictCount > 0) {
    connectivityState = 'sync_error';
  } else if (pendingCount > 0) {
    connectivityState = 'online_pending';
  }

  return {
    isOnline,
    isBackendReachable,
    connectivityState,
    pendingCount,
    conflictCount,
    lastSyncTime,
    triggerManualSync,
    refreshQueueStats,
  };
}
