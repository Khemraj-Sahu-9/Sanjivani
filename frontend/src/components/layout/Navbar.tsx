/**
 * frontend/src/components/layout/Navbar.tsx
 *
 * Top navigation bar with authentic user state and logout.
 */

import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext.tsx';
import { useConnectivity } from '../../hooks/useConnectivity.ts';
import { SyncDashboardModal } from '../sync/SyncDashboardModal.tsx';
import styles from './Navbar.module.css';

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showSyncModal, setShowSyncModal] = useState(false);
  const { isOnline, isBackendReachable, connectivityState, pendingCount } = useConnectivity(user?.id);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  let syncBadgeText = 'Online';
  let syncBadgeColor = '#16a34a';
  let syncBadgeBg = '#f0fdf4';

  if (!isOnline) {
    syncBadgeText = 'Offline';
    syncBadgeColor = '#dc2626';
    syncBadgeBg = '#fef2f2';
  } else if (!isBackendReachable) {
    syncBadgeText = 'Server Unreachable';
    syncBadgeColor = '#ea580c';
    syncBadgeBg = '#fff7ed';
  } else if (connectivityState === 'online_syncing') {
    syncBadgeText = 'Syncing...';
    syncBadgeColor = '#0284c7';
    syncBadgeBg = '#f0f9ff';
  } else if (pendingCount > 0) {
    syncBadgeText = `${pendingCount} Pending`;
    syncBadgeColor = '#d97706';
    syncBadgeBg = '#fffbeb';
  }

  return (
    <header className={styles.header}>
      <nav className={styles.nav} aria-label="Main navigation">
        <NavLink to={user ? '/dashboard' : '/'} className={styles.brand}>
          <span className={styles.brandIcon} aria-hidden="true">🩺</span>
          <span className={styles.brandName}>Sanjivani</span>
        </NavLink>

        <ul className={styles.links} role="list">
          {user && (
            <li>
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  isActive ? `${styles.link} ${styles.linkActive}` : styles.link
                }
              >
                Dashboard
              </NavLink>
            </li>
          )}
          <li>
            <NavLink
              to="/"
              className={({ isActive }) =>
                isActive ? `${styles.link} ${styles.linkActive}` : styles.link
              }
            >
              Overview
            </NavLink>
          </li>
        </ul>

        <div className={styles.actions}>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                onClick={() => setShowSyncModal(true)}
                title="Open Offline & Synchronization Center"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  backgroundColor: syncBadgeBg,
                  color: syncBadgeColor,
                  border: `1px solid ${syncBadgeColor}40`,
                  borderRadius: '12px',
                  padding: '3px 8px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: '8px' }}>●</span>
                <span>{syncBadgeText}</span>
              </button>
              <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{user.full_name}</span>
              <button
                onClick={handleLogout}
                style={{
                  background: 'none',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '4px 8px',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  color: 'var(--color-text-secondary)',
                }}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <NavLink
                to="/login"
                className={styles.link}
                style={{ border: '1px solid var(--color-border)', padding: '4px 10px' }}
              >
                Sign In
              </NavLink>
              <NavLink
                to="/register"
                className={styles.link}
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-text-inverse)',
                  padding: '4px 10px',
                }}
              >
                Register
              </NavLink>
            </div>
          )}
        </div>
      </nav>
      {user && (
        <SyncDashboardModal
          isOpen={showSyncModal}
          onClose={() => setShowSyncModal(false)}
        />
      )}
    </header>
  );
}
