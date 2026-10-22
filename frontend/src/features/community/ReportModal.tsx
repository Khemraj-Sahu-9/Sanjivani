/**
 * frontend/src/features/community/ReportModal.tsx
 *
 * Form modal to submit abuse, spam, harassment, or unauthorized PHI reports.
 */

import React, { useState } from 'react';
import { communityService } from '../../services/communityService';

interface Props {
  isOpen: boolean;
  communityId: string;
  targetId: string;
  targetType?: 'assistance_request' | 'blood_donor_request' | 'member';
  onClose: () => void;
  onSubmitted?: () => void;
}

export const ReportModal: React.FC<Props> = ({
  isOpen,
  communityId,
  targetId,
  targetType = 'assistance_request',
  onClose,
  onSubmitted,
}) => {
  const [reasonCategory, setReasonCategory] = useState('suspicious');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await communityService.submitReport(communityId, {
        targetType,
        targetId,
        reasonCategory,
        details: details.trim(),
      });
      setSuccess(true);
      if (onSubmitted) onSubmitted();
    } catch (err: any) {
      setError(err.message || 'Failed to submit report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '1rem',
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          maxWidth: '480px',
          width: '100%',
          padding: '2rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 id="report-modal-title" style={{ fontSize: '1.2rem', fontWeight: 700, color: '#b91c1c', margin: 0 }}>
            🚩 Report Community Content
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>
            ×
          </button>
        </div>

        {success ? (
          <div>
            <div style={{ padding: '1rem', backgroundColor: '#f0fdf4', color: '#16a34a', borderRadius: '8px', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
              ✓ Thank you for keeping our community safe. Your report has been submitted to authorized community moderators for review.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={onClose}
                style={{ padding: '0.65rem 1.25rem', backgroundColor: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {error && (
              <div style={{ padding: '0.75rem', backgroundColor: '#fef2f2', color: '#dc2626', borderRadius: '8px', fontSize: '0.85rem' }}>
                {error}
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                Reason for Report *
              </label>
              <select
                value={reasonCategory}
                onChange={(e) => setReasonCategory(e.target.value)}
                style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              >
                <option value="suspicious">Suspicious / Fake Request</option>
                <option value="spam">Spam / Commercial Solicitation</option>
                <option value="unauthorized_phi">Unauthorized Sharing of Medical Details / PHI</option>
                <option value="harassment">Harassment or Abuse</option>
                <option value="impersonation">Impersonation of Resident</option>
                <option value="fraud">Fraudulent Blood / Financial Claim</option>
                <option value="other">Other Community Rule Violation</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                Explanation & Details *
              </label>
              <textarea
                required
                rows={3}
                placeholder="Please describe why this content should be reviewed by moderators."
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
              />
            </div>

            <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
              Reports are treated confidentially. Community moderators review reports in accordance with safety guidelines.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={onClose}
                style={{ padding: '0.65rem 1.25rem', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{ padding: '0.65rem 1.25rem', backgroundColor: '#dc2626', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
              >
                {loading ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
