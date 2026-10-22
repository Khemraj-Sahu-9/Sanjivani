/**
 * frontend/src/components/layout/AppShell.tsx
 *
 * Main application shell layout.
 * Wraps page content with the top navigation bar.
 */

import { useState, type ReactNode } from 'react';
import { Navbar } from './Navbar.tsx';
import { ConnectivityBanner } from '../sync/ConnectivityBanner.tsx';
import { SyncDashboardModal } from '../sync/SyncDashboardModal.tsx';
import styles from './AppShell.module.css';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [showSyncModal, setShowSyncModal] = useState(false);

  return (
    <div className={styles.shell}>
      <Navbar />
      <ConnectivityBanner onOpenSyncDashboard={() => setShowSyncModal(true)} />
      <main className={styles.main}>
        <div className={styles.content}>{children}</div>
      </main>
      <SyncDashboardModal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
      />
    </div>
  );
}
