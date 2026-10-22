/**
 * frontend/src/features/community/CommunityRulesModal.tsx
 *
 * Displays community rules, healthcare privacy boundaries, non-emergency assistance limits,
 * and blood donation screening disclaimers.
 */

import React from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const CommunityRulesModal: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="community-rules-title"
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
          borderRadius: '12px',
          maxWidth: '650px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '2rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 id="community-rules-title" style={{ fontSize: '1.35rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
            🛡️ Sanjivani Community Safety & Privacy Rules
          </h2>
          <button
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#64748b',
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', color: '#334155', fontSize: '0.925rem', lineHeight: '1.5' }}>
          <div style={{ padding: '0.85rem', backgroundColor: '#f0fdf4', borderRadius: '8px', borderLeft: '4px solid #16a34a' }}>
            <h4 style={{ margin: '0 0 0.35rem 0', color: '#15803d', fontWeight: 600 }}>
              1. Voluntary Mutual Assistance Only
            </h4>
            <p style={{ margin: 0 }}>
              Community requests are for mutual neighborly aid such as grocery delivery, errand assistance, appointment accompaniment, or welfare checks. Community volunteers are not medical professionals and must not provide clinical diagnoses.
            </p>
          </div>

          <div style={{ padding: '0.85rem', backgroundColor: '#fef2f2', borderRadius: '8px', borderLeft: '4px solid #dc2626' }}>
            <h4 style={{ margin: '0 0 0.35rem 0', color: '#b91c1c', fontWeight: 600 }}>
              2. Strict Non-Emergency Boundary
            </h4>
            <p style={{ margin: 0 }}>
              Community assistance is <strong>NOT</strong> an emergency dispatch service. For life-threatening emergencies, cardiac incidents, or acute trauma, always call emergency medical services (112 / Ambulance) immediately.
            </p>
          </div>

          <div style={{ padding: '0.85rem', backgroundColor: '#eff6ff', borderRadius: '8px', borderLeft: '4px solid #2563eb' }}>
            <h4 style={{ margin: '0 0 0.35rem 0', color: '#1d4ed8', fontWeight: 600 }}>
              3. Complete Medical Record Privacy (Zero PHI Disclosure)
            </h4>
            <p style={{ margin: 0 }}>
              Your private medical documents, prescriptions, lab results, and AI Health Memory are strictly confidential to your family workspace. <strong>Community owners, moderators, and volunteers have zero access to your medical records.</strong>
            </p>
          </div>

          <div style={{ padding: '0.85rem', backgroundColor: '#fffbeb', borderRadius: '8px', borderLeft: '4px solid #d97706' }}>
            <h4 style={{ margin: '0 0 0.35rem 0', color: '#b45309', fontWeight: 600 }}>
              4. Blood Donor Disclaimers & Hospital Screening
            </h4>
            <p style={{ margin: 0 }}>
              Blood donor requests connect volunteers who are willing to donate. Sanjivani does <strong>NOT</strong> verify clinical eligibility, antibody compatibility, or infectious disease screening. All screening, blood cross-matching, and collection remain exclusively with licensed hospitals and authorized blood banks.
            </p>
          </div>

          <div style={{ padding: '0.85rem', backgroundColor: '#faf5ff', borderRadius: '8px', borderLeft: '4px solid #9333ea' }}>
            <h4 style={{ margin: '0 0 0.35rem 0', color: '#7e22ce', fontWeight: 600 }}>
              5. Contact & Location Privacy
            </h4>
            <p style={{ margin: 0 }}>
              Exact residential addresses and phone numbers are hidden from general members. Phone numbers are only shared when you explicitly assign a volunteer or confirm donor contact via an authorized, time-bound contact grant.
            </p>
          </div>
        </div>

        <div style={{ marginTop: '1.75rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.65rem 1.25rem',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            I Understand & Agree
          </button>
        </div>
      </div>
    </div>
  );
};
