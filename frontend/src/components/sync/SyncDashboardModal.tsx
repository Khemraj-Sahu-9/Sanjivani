/**
 * frontend/src/components/sync/SyncDashboardModal.tsx
 *
 * Full-featured Synchronization and Local Storage Management Center for Phase 7.
 * Provides real-time connectivity diagnostics, queue inspection, conflict resolution,
 * manual synchronization triggers, and local storage quota management.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../features/auth/AuthContext.tsx';
import { offlineStorage, QueuedSyncOperation } from '../../lib/offlineStorage.ts';
import { syncApiService } from '../../services/syncService.ts';
import { useConnectivity } from '../../hooks/useConnectivity.ts';
import { SyncConflict } from '../../types/sync.ts';

interface SyncDashboardModalProps {
  familyId?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function SyncDashboardModal({ familyId, isOpen, onClose }: SyncDashboardModalProps) {
  const { user } = useAuth();
  const {
    isOnline,
    isBackendReachable,
    triggerManualSync,
    lastSyncTime,
  } = useConnectivity(user?.id, familyId);

  const [queue, setQueue] = useState<QueuedSyncOperation[]>([]);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [storageEstimate, setStorageEstimate] = useState<{
    usageBytes: number;
    quotaBytes: number;
    percentUsed: number;
  }>({ usageBytes: 0, quotaBytes: 0, percentUsed: 0 });
  const [isProcessingSync, setIsProcessingSync] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    const ops = await offlineStorage.listAllUserOperations(user.id, familyId);
    setQueue(ops);

    const est = await offlineStorage.getStorageEstimate();
    setStorageEstimate(est);

    if (familyId && isOnline && isBackendReachable) {
      const deltaRes = await syncApiService.getDelta(familyId);
      if (deltaRes.data?.conflicts) {
        setConflicts(deltaRes.data.conflicts.filter((c) => c.resolution_status === 'pending'));
      }
    }
  }, [user, familyId, isOnline, isBackendReachable]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  if (!isOpen) return null;

  const handleSyncNow = async () => {
    setFeedback(null);
    setIsProcessingSync(true);
    try {
      const res = await triggerManualSync();
      if (res?.success) {
        setFeedback({ type: 'success', message: `Sync completed: ${res.syncedCount} item(s) synchronized.` });
      } else {
        setFeedback({ type: 'error', message: res?.error || 'Synchronization failed or was interrupted.' });
      }
      await loadData();
    } finally {
      setIsProcessingSync(false);
    }
  };

  const handleResolveConflict = async (
    conflictId: string,
    resolution: 'resolved_client' | 'resolved_server'
  ) => {
    if (!familyId) return;
    setFeedback(null);
    const res = await syncApiService.resolveConflict(familyId, conflictId, resolution);
    if (res.error) {
      setFeedback({ type: 'error', message: res.error });
    } else {
      setFeedback({ type: 'success', message: `Conflict resolved using ${resolution.replace('resolved_', '')} version.` });
      await loadData();
    }
  };

  const handleDiscardOperation = async (clientOperationId: string) => {
    await offlineStorage.removeQueuedOperation(clientOperationId);
    await loadData();
  };

  const handleClearCache = async () => {
    if (!user) return;
    if (window.confirm('Clear all cached medical data from this device? Unsynced drafts will be discarded.')) {
      await offlineStorage.clearUserData(user.id);
      await loadData();
      setFeedback({ type: 'success', message: 'Local health records cache has been cleared on this device.' });
    }
  };

  return (
    <div
      role="dialog"
      aria-labelledby="sync-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          width: '100%',
          maxWidth: '800px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h2 id="sync-modal-title" style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>
              🔄 Offline & Synchronization Center
            </h2>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              Inspect device storage, pending operation queue, and reconcile data conflicts.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.25rem',
              cursor: 'pointer',
              color: '#64748b',
            }}
          >
            ✕
          </button>
        </div>

        {/* Content body */}
        <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {feedback && (
            <div
              style={{
                padding: '0.6rem 0.85rem',
                borderRadius: '6px',
                fontSize: '0.85rem',
                backgroundColor: feedback.type === 'error' ? '#fee2e2' : '#dcfce7',
                color: feedback.type === 'error' ? '#991b1b' : '#166534',
                border: `1px solid ${feedback.type === 'error' ? '#fecaca' : '#bbf7d0'}`,
              }}
            >
              {feedback.message}
            </div>
          )}

          {/* Diagnostic Status Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>BROWSER NETWORK</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: isOnline ? '#16a34a' : '#dc2626', marginTop: '4px' }}>
                {isOnline ? '● Online' : '○ Offline'}
              </div>
            </div>

            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>BACKEND SERVICE</div>
              <div
                style={{
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: isBackendReachable ? '#16a34a' : '#ea580c',
                  marginTop: '4px',
                }}
              >
                {isBackendReachable ? '● Reachable' : '○ Unreachable'}
              </div>
            </div>

            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>LAST SYNCHRONIZED</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginTop: '4px' }}>
                {lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString() : 'Never this session'}
              </div>
            </div>
          </div>

          {/* Device Storage Quota */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>Device Storage Quota</span>
                <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '0.5rem' }}>
                  ({(storageEstimate.usageBytes / (1024 * 1024)).toFixed(2)} MB of{' '}
                  {(storageEstimate.quotaBytes / (1024 * 1024)).toFixed(0)} MB used)
                </span>
              </div>
              <button
                onClick={handleClearCache}
                style={{
                  background: 'none',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  padding: '3px 8px',
                  fontSize: '0.75rem',
                  color: '#dc2626',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Clear Local Cache
              </button>
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', marginTop: '6px' }}>
              <div
                style={{
                  width: `${Math.max(storageEstimate.percentUsed, 2)}%`,
                  height: '100%',
                  backgroundColor: storageEstimate.percentUsed > 80 ? '#dc2626' : '#0284c7',
                  borderRadius: '4px',
                }}
              />
            </div>
          </div>

          {/* Conflicts Section (if any) */}
          {conflicts.length > 0 && (
            <div style={{ border: '1px solid #fecaca', borderRadius: '8px', padding: '0.85rem', backgroundColor: '#fff5f5' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', color: '#991b1b' }}>
                🚨 Conflicts Requiring Review ({conflicts.length})
              </h3>
              <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.8rem', color: '#7f1d1d' }}>
                The authoritative server record was updated concurrently with your local changes. Choose which version
                to retain.
              </p>

              {conflicts.map((conflict) => (
                <div
                  key={conflict.id}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #fed7aa',
                    borderRadius: '6px',
                    padding: '0.75rem',
                    marginBottom: '0.5rem',
                  }}
                >
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#9a3412', marginBottom: '0.35rem' }}>
                    Entity: {conflict.entity_type.toUpperCase()} | Field: {conflict.field_name || 'Multiple'}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.75rem' }}>
                    <div style={{ backgroundColor: '#f8fafc', padding: '0.5rem', borderRadius: '4px' }}>
                      <strong>Your Local Device:</strong>
                      <pre style={{ margin: '4px 0 0 0', whiteSpace: 'pre-wrap', color: '#0369a1' }}>
                        {JSON.stringify(conflict.local_value, null, 2)}
                      </pre>
                    </div>
                    <div style={{ backgroundColor: '#f8fafc', padding: '0.5rem', borderRadius: '4px' }}>
                      <strong>Authoritative Server:</strong>
                      <pre style={{ margin: '4px 0 0 0', whiteSpace: 'pre-wrap', color: '#166534' }}>
                        {JSON.stringify(conflict.server_value, null, 2)}
                      </pre>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button
                      onClick={() => handleResolveConflict(conflict.id, 'resolved_client')}
                      style={{
                        padding: '4px 8px',
                        fontSize: '0.75rem',
                        backgroundColor: '#0284c7',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      Keep Device Version
                    </button>
                    <button
                      onClick={() => handleResolveConflict(conflict.id, 'resolved_server')}
                      style={{
                        padding: '4px 8px',
                        fontSize: '0.75rem',
                        backgroundColor: '#475569',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      Keep Server Version
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Persistent Queue Inspection Table */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#1e293b' }}>
                Local Operations Queue ({queue.length})
              </h3>
            </div>

            {queue.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                ✨ No pending operations. All local actions are fully synchronized with the server.
              </div>
            ) : (
              <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                  <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <tr>
                      <th style={{ padding: '6px 8px' }}>Operation</th>
                      <th style={{ padding: '6px 8px' }}>Created</th>
                      <th style={{ padding: '6px 8px' }}>Status</th>
                      <th style={{ padding: '6px 8px' }}>Retries</th>
                      <th style={{ padding: '6px 8px' }}>Details</th>
                      <th style={{ padding: '6px 8px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.map((op) => (
                      <tr key={op.clientOperationId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '6px 8px', fontWeight: 600 }}>{op.operationType}</td>
                        <td style={{ padding: '6px 8px', color: '#64748b' }}>
                          {new Date(op.clientTimestamp).toLocaleTimeString()}
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <span
                            style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontWeight: 600,
                              backgroundColor:
                                op.status === 'synced'
                                  ? '#dcfce7'
                                  : op.status === 'syncing'
                                  ? '#e0f2fe'
                                  : op.status === 'conflict'
                                  ? '#fee2e2'
                                  : op.status === 'failed'
                                  ? '#fee2e2'
                                  : '#fef3c7',
                              color:
                                op.status === 'synced'
                                  ? '#166534'
                                  : op.status === 'syncing'
                                  ? '#0369a1'
                                  : op.status === 'conflict'
                                  ? '#991b1b'
                                  : op.status === 'failed'
                                  ? '#991b1b'
                                  : '#92400e',
                            }}
                          >
                            {op.status}
                          </span>
                        </td>
                        <td style={{ padding: '6px 8px' }}>{op.retryCount}</td>
                        <td style={{ padding: '6px 8px', color: op.errorMessage ? '#dc2626' : '#64748b' }}>
                          {op.errorMessage || op.fileName || 'Pending execution'}
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          {['failed', 'saved_on_device', 'waiting_to_sync'].includes(op.status) && (
                            <button
                              onClick={() => handleDiscardOperation(op.clientOperationId)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#dc2626',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                              }}
                            >
                              Discard
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '0.85rem 1.25rem',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.5rem',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#fff',
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            Close
          </button>
          <button
            onClick={handleSyncNow}
            disabled={isProcessingSync || !isOnline}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: isOnline ? '#0284c7' : '#94a3b8',
              color: '#fff',
              fontWeight: 600,
              cursor: isOnline && !isProcessingSync ? 'pointer' : 'not-allowed',
              fontSize: '0.85rem',
            }}
          >
            {isProcessingSync ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      </div>
    </div>
  );
}
