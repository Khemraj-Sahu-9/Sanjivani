/**
 * frontend/src/features/community/BloodDonorDetailModal.tsx
 *
 * Inspects a blood donor request, enables community members to express interest
 * with medical screening disclaimers, and lets coordinators update response statuses.
 */

import React, { useState, useEffect } from 'react';
import { communityService } from '../../services/communityService';
import { BloodDonorRequest, DonorResponse, BloodGroup } from '../../types/community';

interface Props {
  isOpen: boolean;
  communityId: string;
  requestId: string;
  currentUserId: string;
  onClose: () => void;
  onUpdated: (req: BloodDonorRequest) => void;
  onReportClick: (targetId: string) => void;
}

export const BloodDonorDetailModal: React.FC<Props> = ({
  isOpen,
  communityId,
  requestId,
  currentUserId,
  onClose,
  onUpdated,
  onReportClick,
}) => {
  const [request, setRequest] = useState<BloodDonorRequest | null>(null);
  const [responses, setResponses] = useState<DonorResponse[]>([]);
  const [isCreator, setIsCreator] = useState(false);
  const [donorBloodGroup, setDonorBloodGroup] = useState<BloodGroup>('O+');
  const [donorNotes, setDonorNotes] = useState('');
  const [screeningAcknowledged, setScreeningAcknowledged] = useState(false);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !requestId) return;

    let isMounted = true;
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await communityService.getBloodDonorRequest(communityId, requestId);
        if (isMounted) {
          setRequest(res.request);
          setIsCreator(res.isCreator);
        }

        const respList = await communityService.listDonorResponses(communityId, requestId);
        if (isMounted) {
          setResponses(respList);
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Failed to load blood request');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, [isOpen, communityId, requestId]);

  if (!isOpen) return null;

  const handleExpressInterest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!screeningAcknowledged) {
      setError('You must acknowledge that registering interest does not confirm medical eligibility.');
      return;
    }
    setActionLoading(true);
    setError(null);

    try {
      await communityService.expressDonorInterest(communityId, requestId, {
        bloodGroup: donorBloodGroup,
        notes: donorNotes.trim() || undefined,
      });

      setSuccessMsg('Thank you! Your interest has been shared with the coordinator. Hospital staff will handle clinical screening.');
      const respList = await communityService.listDonorResponses(communityId, requestId);
      setResponses(respList);
    } catch (err: any) {
      setError(err.message || 'Failed to register interest');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateStatus = async (donorUserId: string, status: 'interested' | 'contacted' | 'unavailable' | 'referred_to_screening') => {
    setActionLoading(true);
    setError(null);
    try {
      await communityService.updateDonorResponseStatus(communityId, requestId, donorUserId, status);
      const respList = await communityService.listDonorResponses(communityId, requestId);
      setResponses(respList);
      setSuccessMsg(`Donor status marked as "${status.replace('_', ' ')}"`);
    } catch (err: any) {
      setError(err.message || 'Failed to update donor status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCloseRequest = async (status: 'fulfilled' | 'cancelled') => {
    setActionLoading(true);
    setError(null);
    try {
      const closed = await communityService.closeBloodDonorRequest(communityId, requestId, status);
      setRequest(closed);
      setSuccessMsg(`Blood donor request marked as ${status}`);
      onUpdated(closed);
    } catch (err: any) {
      setError(err.message || 'Failed to close request');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="blood-detail-title"
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
          maxWidth: '620px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '2rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 id="blood-detail-title" style={{ fontSize: '1.25rem', fontWeight: 700, color: '#dc2626', margin: 0 }}>
            🩸 Blood-Donor Request
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>
            ×
          </button>
        </div>

        {error && (
          <div style={{ padding: '0.75rem', backgroundColor: '#fef2f2', color: '#dc2626', borderRadius: '8px', fontSize: '0.875rem', marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        {successMsg && (
          <div style={{ padding: '0.75rem', backgroundColor: '#f0fdf4', color: '#16a34a', borderRadius: '8px', fontSize: '0.875rem', marginBottom: '1rem' }}>
            {successMsg}
          </div>
        )}

        {loading || !request ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Loading blood request...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Header badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span
                style={{
                  padding: '0.35rem 0.85rem',
                  borderRadius: '9999px',
                  fontSize: '0.9rem',
                  fontWeight: 800,
                  backgroundColor: '#fee2e2',
                  color: '#b91c1c',
                }}
              >
                BLOOD GROUP: {request.blood_group} ({request.units_needed} {request.units_needed === 1 ? 'Unit' : 'Units'})
              </span>
              <span
                style={{
                  padding: '0.25rem 0.65rem',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: request.status === 'fulfilled' ? '#dcfce7' : request.status === 'cancelled' ? '#f1f5f9' : '#fffbeb',
                  color: request.status === 'fulfilled' ? '#15803d' : request.status === 'cancelled' ? '#475569' : '#b45309',
                }}
              >
                {request.status.toUpperCase()}
              </span>
              <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: 'auto' }}>
                Expires: {new Date(request.expiry_time).toLocaleDateString()}
              </span>
            </div>

            {/* Hospital & Location */}
            <div style={{ padding: '0.85rem', backgroundColor: '#f8fafc', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ fontSize: '0.9rem', color: '#1e293b' }}>
                <strong>🏥 Hospital / Facility:</strong> {request.hospital_name || 'Hospital blood bank'}
              </div>
              <div style={{ fontSize: '0.9rem', color: '#1e293b' }}>
                <strong>📍 Locality / Area:</strong> {request.approximate_locality}
              </div>
              {request.requested_date_time && (
                <div style={{ fontSize: '0.9rem', color: '#1e293b' }}>
                  <strong>🕒 Timing:</strong> {request.requested_date_time}
                </div>
              )}
              {request.notes && (
                <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '0.25rem' }}>
                  <strong>Notes:</strong> {request.notes}
                </div>
              )}
              {isCreator && request.contact_phone && (
                <div style={{ fontSize: '0.85rem', color: '#15803d', marginTop: '0.25rem' }}>
                  <strong>Coordinator Phone:</strong> {request.contact_phone}
                </div>
              )}
            </div>

            {/* Medical Screening Disclaimer Box */}
            <div style={{ padding: '0.75rem', backgroundColor: '#fff7ed', borderRadius: '8px', borderLeft: '4px solid #ea580c' }}>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#9a3412', lineHeight: '1.4' }}>
                ⚠️ <strong>Clinical Disclaimer:</strong> Sanjivani is for voluntary mutual coordination. Hospital medical personnel conduct hemoglobin screening, weight checks, infection tests, and compatibility cross-matching before any blood collection.
              </p>
            </div>

            {/* Potential Donors List */}
            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.5rem' }}>
                Potential Donors Interested ({responses.length})
              </h4>
              {responses.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>No donors have registered interest yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {responses.map((resp) => (
                    <div
                      key={resp.id}
                      style={{
                        padding: '0.65rem 0.85rem',
                        backgroundColor: '#f8fafc',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>
                          Donor ({resp.donor_user_id === currentUserId ? 'You' : resp.donor_user_id.slice(0, 8)}) — Group: <strong style={{ color: '#dc2626' }}>{resp.blood_group}</strong>
                        </span>
                        {resp.notes && <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>&ldquo;{resp.notes}&rdquo;</p>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: resp.status === 'contacted' ? '#16a34a' : '#64748b' }}>
                          {resp.status.toUpperCase()}
                        </span>
                        {isCreator && resp.status === 'interested' && (
                          <button
                            onClick={() => handleUpdateStatus(resp.donor_user_id, 'contacted')}
                            disabled={actionLoading}
                            style={{
                              padding: '0.35rem 0.65rem',
                              backgroundColor: '#0284c7',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                            }}
                          >
                            Mark Contacted
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Express Interest Form for Non-Creators */}
            {!isCreator && request.status === 'open' && (
              <form onSubmit={handleExpressInterest} style={{ padding: '1rem', backgroundColor: '#f1f5f9', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#1e293b' }}>Can you donate blood?</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.2rem' }}>
                      Your Blood Group
                    </label>
                    <select
                      value={donorBloodGroup}
                      onChange={(e) => setDonorBloodGroup(e.target.value as BloodGroup)}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    >
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.2rem' }}>
                      Notes / Availability
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Free after 3 PM today"
                      value={donorNotes}
                      onChange={(e) => setDonorNotes(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer', fontSize: '0.75rem', color: '#475569' }}>
                  <input
                    type="checkbox"
                    required
                    checked={screeningAcknowledged}
                    onChange={(e) => setScreeningAcknowledged(e.target.checked)}
                    style={{ marginTop: '0.15rem' }}
                  />
                  <span>I understand that registering interest does not confirm medical eligibility. Clinical eligibility is determined solely by the hospital/blood bank.</span>
                </label>

                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{
                    padding: '0.6rem 1rem',
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    alignSelf: 'flex-start',
                  }}
                >
                  Register as Potential Donor
                </button>
              </form>
            )}

            {/* Creator Actions to Close Request */}
            {isCreator && request.status === 'open' && (
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  onClick={() => handleCloseRequest('fulfilled')}
                  disabled={actionLoading}
                  style={{ padding: '0.5rem 1rem', backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                >
                  ✓ Mark Request Fulfilled
                </button>
                <button
                  onClick={() => handleCloseRequest('cancelled')}
                  disabled={actionLoading}
                  style={{ padding: '0.5rem 1rem', backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancel Request
                </button>
              </div>
            )}

            {/* Footer with Report Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
              <button
                onClick={() => onReportClick(request.id)}
                style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}
              >
                🚩 Report Suspicious Request
              </button>
              <button
                onClick={onClose}
                style={{ padding: '0.5rem 1.25rem', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
