import { useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../auth/AuthContext.tsx';
import styles from './HomePage.module.css';

const PRODUCT_CAPABILITIES = [
  {
    icon: '📄',
    title: 'Smart Health Records & OCR',
    description: 'Upload prescriptions, discharge summaries, and lab reports. Instant text extraction with human confirmation.',
  },
  {
    icon: '🤖',
    title: 'AI Health Memory',
    description: 'Ask clinical questions grounded strictly in verified records. Zero hallucination with interactive citations and doctor-ready PDF dossiers.',
  },
  {
    icon: '💊',
    title: 'Medication & Clinic Tracking',
    description: 'Scheduled dose occurrences, real-time adherence scores, and automated clinic appointment alerts.',
  },
  {
    icon: '🚨',
    title: 'Multi-Tier SOS Emergency',
    description: 'Instant family notifications, timed caregiver escalation, and emergency health packets with allergy & medication profiles.',
  },
  {
    icon: '📡',
    title: 'Offline-First Synchronization',
    description: 'Local IndexedDB persistence ensures critical health memory and emergency records are accessible even without internet.',
  },
  {
    icon: '👥',
    title: 'Community Society Network',
    description: 'Residential society assistance coordination and volunteer blood-donor matching with complete clinical privacy.',
  },
];

export function HomePage() {
  const auth = useContext(AuthContext);
  const user = auth?.user;

  return (
    <div className={styles.page}>
      {/* Hero section */}
      <section className={styles.hero}>
        <div className={styles.heroBadge}>AI Health Memory Platform</div>
        <h1 className={styles.heroTitle}>Sanjivani</h1>
        <p className={styles.heroSubtitle}>
          The Intelligent Health Memory Agent & Family Emergency Guardian
        </p>
        <p className={styles.heroDescription}>
          Unifying fragmented medical records, medication schedules, grounded AI intelligence, and multi-tier emergency response for patients and their families.
        </p>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem' }}>
          {user ? (
            <Link
              to="/dashboard"
              style={{
                backgroundColor: 'var(--color-primary)',
                color: '#fff',
                padding: '0.75rem 1.75rem',
                borderRadius: '8px',
                fontWeight: 600,
                textDecoration: 'none',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
            >
              Open Family Dashboard →
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: '#fff',
                  padding: '0.75rem 1.75rem',
                  borderRadius: '8px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
              >
                Sign In to Workspace
              </Link>
              <Link
                to="/register"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border)',
                  padding: '0.75rem 1.75rem',
                  borderRadius: '8px',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Create Account
              </Link>
            </>
          )}
        </div>
      </section>

      {/* System Operational Status */}
      <section className={styles.statusSection}>
        <div className={styles.statusCard}>
          <div className={styles.statusHeader}>
            <span className={styles.statusDot} aria-hidden="true" />
            <span className={styles.statusLabel}>System Operational Status</span>
          </div>
          <ul className={styles.statusList}>
            <StatusItem label="Web Application & Family Workspace" status="operational" />
            <StatusItem label="Grounded AI Health Memory Engine" status="operational" />
            <StatusItem label="Medical OCR & Human Extraction Review" status="operational" />
            <StatusItem label="Multi-Tier Emergency Escalation Engine" status="operational" />
            <StatusItem label="Offline IndexedDB Local Storage & Sync" status="operational" />
            <StatusItem label="Residential Society Mutual Aid Network" status="operational" />
          </ul>
        </div>
      </section>

      {/* Product Capabilities Grid */}
      <section className={styles.roadmapSection}>
        <h2 className={styles.sectionTitle}>Complete Platform Capabilities</h2>
        <div className={styles.phaseGrid}>
          {PRODUCT_CAPABILITIES.map(({ icon, title, description }) => (
            <div key={title} className={styles.phaseCard}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{icon}</div>
              <h3 className={styles.phaseTitle}>{title}</h3>
              <p className={styles.phaseDescription}>{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Security & Compliance Footer */}
      <section className={styles.devNote}>
        <p>
          <strong>Security & Privacy:</strong> Sanjivani implements strict Role-Based Access Control (RBAC), end-to-end cryptographic file deduplication (SHA-256), and row-level security isolation. Medical records are never exposed to community networks.
        </p>
      </section>
    </div>
  );
}

interface StatusItemProps {
  label: string;
  status: 'operational' | 'pending' | 'planned';
}

function StatusItem({ label, status }: StatusItemProps) {
  const statusConfig = {
    operational: { icon: '✅', text: 'Operational', className: styles.statusOperational },
    pending: { icon: '⚙️', text: 'Connecting', className: styles.statusPending },
    planned: { icon: '🔜', text: 'Planned', className: styles.statusPlanned },
  };

  const { icon, text, className } = statusConfig[status];

  return (
    <li className={styles.statusItem}>
      <span className={styles.statusItemLabel}>{label}</span>
      <span className={`${styles.statusBadge} ${className}`}>
        <span aria-hidden="true">{icon}</span>
        <span>{text}</span>
      </span>
    </li>
  );
}
