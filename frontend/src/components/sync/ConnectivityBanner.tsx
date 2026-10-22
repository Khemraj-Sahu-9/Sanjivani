/**
 * frontend/src/components/sync/ConnectivityBanner.tsx
 *
 * Persistent connectivity and synchronization banner.
 * Displays accurate connection state, pending queues, and triggers the sync modal.
 */

import React from 'react';
import { useConnectivity } from '../../hooks/useConnectivity.ts';
import { useAuth } from '../../features/auth/AuthContext.tsx';

interface ConnectivityBannerProps {
  familyId?: string;
  onOpenSyncDashboard: () => void;
}

export function ConnectivityBanner({ familyId, onOpenSyncDashboard }: ConnectivityBannerProps) {
  const { user } = useAuth();
  const {
    connectivityState,
    pendingCount,
    conflictCount,
    isOnline,
    isBackendReachable,
    triggerManualSync,
  } = useConnectivity(user?.id, familyId);

  // If online, backend reachable, and everything is clean and idle, render nothing intrusive
  if (connectivityState === 'online_synced') {
    return null;
  }

  const handleSyncClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await triggerManualSync();
  };

  if (!isOnline) {
    return (
      <div
        role="alert"
        style={{
          backgroundColor: '#fef3c7',
          color: '#92400e',
          borderBottom: '1px solid #fde68a',
          padding: '0.6rem 1rem',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontWeight: 500,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>📡</span>
          <span>
            <strong>Offline Mode:</strong> Internet connection is unavailable. You are viewing cached health
            records. New updates will be saved locally on this device.
          </span>
        </div>
        <button
          onClick={onOpenSyncDashboard}
          style={{
            background: '#ffffff',
            border: '1px solid #d97706',
            color: '#92400e',
            borderRadius: '4px',
            padding: '3px 8px',
            fontSize: '0.75rem',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          View Sync Queue ({pendingCount})
        </button>
      </div>
    );
  }

  if (!isBackendReachable) {
    return (
      <div
        role="alert"
        style={{
          backgroundColor: '#ffedd5',
          color: '#9a3412',
          borderBottom: '1px solid #fed7aa',
          padding: '0.6rem 1rem',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontWeight: 500,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>⚠️</span>
          <span>
            <strong>Server Unreachable:</strong> Browser is online, but the Sanjivani backend server is currently
            unreachable. Working locally.
          </span>
        </div>
        <button
          onClick={onOpenSyncDashboard}
          style={{
            background: '#ffffff',
            border: '1px solid #ea580c',
            color: '#9a3412',
            borderRadius: '4px',
            padding: '3px 8px',
            fontSize: '0.75rem',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Inspect Sync Status
        </button>
      </div>
    );
  }

  if (connectivityState === 'online_syncing') {
    return (
      <div
        role="status"
        style={{
          backgroundColor: '#e0f2fe',
          color: '#0369a1',
          borderBottom: '1px solid #bae6fd',
          padding: '0.6rem 1rem',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontWeight: 500,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span>
          <span>
            <strong>Synchronizing Records:</strong> Uploading local changes and reconciling with server...
          </span>
        </div>
      </div>
    );
  }

  if (conflictCount > 0) {
    return (
      <div
        role="alert"
        style={{
          backgroundColor: '#fee2e2',
          color: '#991b1b',
          borderBottom: '1px solid #fecaca',
          padding: '0.6rem 1rem',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontWeight: 500,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>🚨</span>
          <span>
            <strong>{conflictCount} Sync Conflict(s) Require Review:</strong> Concurrent edits detected between
            your device and the server.
          </span>
        </div>
        <button
          onClick={onOpenSyncDashboard}
          style={{
            background: '#dc2626',
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            padding: '4px 10px',
            fontSize: '0.75rem',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Resolve Conflicts
        </button>
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <div
        role="status"
        style={{
          backgroundColor: '#fef9c3',
          color: '#854d0e',
          borderBottom: '1px solid #fef08a',
          padding: '0.6rem 1rem',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontWeight: 500,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>⚡</span>
          <span>
            <strong>{pendingCount} Pending Change(s):</strong> Saved locally on this device waiting to sync.
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={handleSyncClick}
            style={{
              background: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              padding: '3px 8px',
              fontSize: '0.75rem',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Sync Now
          </button>
          <button
            onClick={onOpenSyncDashboard}
            style={{
              background: '#ffffff',
              border: '1px solid #ca8a04',
              color: '#854d0e',
              borderRadius: '4px',
              padding: '3px 8px',
              fontSize: '0.75rem',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Details
          </button>
        </div>
      </div>
    );
  }

  return null;
}
