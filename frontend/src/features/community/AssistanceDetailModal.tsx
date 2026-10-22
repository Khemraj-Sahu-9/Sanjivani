/**
 * frontend/src/features/community/AssistanceDetailModal.tsx
 *
 * Inspects an assistance request, displays volunteer interest list, assigns volunteer,
 * and reveals privacy-protected contact details if authorized.
 */

import React, { useState, useEffect } from 'react';
import { communityService } from '../../services/communityService';
import { AssistanceRequest, AssistanceAssignment } from '../../types/community';

interface Props {
  isOpen: boolean;
  communityId: string;
  requestId: string;
  currentUserId: string;
  onClose: () => void;
  onUpdated: (req: AssistanceRequest) => void;
  onReportClick: (targetId: string) => void;
}

export const AssistanceDetailModal: React.FC<Props> = ({
  isOpen,
  communityId,
  requestId,
  currentUserId,
  onClose,
  onUpdated,
  onReportClick,
}) => {
  const [request, setRequest] = useState<AssistanceRequest | null>(null);
  const [volunteers, setVolunteers] = useState<AssistanceAssignment[]>([]);
  const [isCreator, setIsCreator] = useState(false);
  const [isAssignedVolunteer, setIsAssignedVolunteer] = useState(false);
  const [volunteerNote, setVolunteerNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !requestId) return;

    let isMounted = true;
    const loadDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await communityService.getAssistanceRequest(communityId, requestId);
        if (isMounted) {
          setRequest(res.request);
          setIsCreator(res.isCreator);
          setIsAssignedVolunteer(res.isAssignedVolunteer);
        }

        const volRes = await communityService.listVolunteersForRequest(communityId, requestId);
        if (isMounted) {
          setVolunteers(volRes);
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Failed to load request');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadDetails();
    return () => {
      isMounted = false;
    };
  }, [isOpen, communityId, requestId]);

  if (!isOpen) return null;

  const handleVolunteer = async () => {
    setActionLoading(true);
    setError(null);
    try {
      await communityService.expressVolunteerInterest(communityId, requestId, volunteerNote.trim() || undefined);
      setSuccessMsg('You have registered interest as a volunteer! The coordinator has been notified.');
      // Reload
      const res = await communityService.getAssistanceRequest(communityId, requestId);
      setRequest(res.request);
      const volRes = await communityService.listVolunteersForRequest(communityId, requestId);
      setVolunteers(volRes);
      onUpdated(res.request);
    } catch (err: any) {
      setError(err.message || 'Failed to express volunteer interest');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssign = async (volUserId: string) => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await communityService.assignVolunteer(communityId, requestId, volUserId);
      setRequest(res.request);
      setSuccessMsg('Volunteer assigned successfully! Contact details are now shared with them.');
      const volRes = await communityService.listVolunteersForRequest(communityId, requestId);
      setVolunteers(volRes);
      onUpdated(res.request);
    } catch (err: any) {
      setError(err.message || 'Failed to assign volunteer');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: 'open' | 'in_progress' | 'completed' | 'cancelled') => {
    setActionLoading(true);
    setError(null);
    try {
      const updated = await communityService.updateAssistanceStatus(communityId, requestId, newStatus);
      setRequest(updated);
      setSuccessMsg(`Status updated to "${newStatus}"`);
      onUpdated(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="assistance-detail-title"
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
          <h2 id="assistance-detail-title" style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
            🤝 Assistance Request Details
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
          <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Loading request details...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Header badges */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
              <span
                style={{
                  padding: '0.25rem 0.65rem',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: request.priority === 'high' ? '#fee2e2' : '#e0f2fe',
                  color: request.priority === 'high' ? '#dc2626' : '#0369a1',
                }}
              >
                {request.priority.toUpperCase()} PRIORITY
              </span>
              <span
                style={{
                  padding: '0.25rem 0.65rem',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: request.status === 'completed' ? '#dcfce7' : request.status === 'assigned' ? '#fef3c7' : '#f1f5f9',
                  color: request.status === 'completed' ? '#15803d' : request.status === 'assigned' ? '#b45309' : '#475569',
                }}
              >
                {request.status.replace('_', ' ').toUpperCase()}
              </span>
              <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: 'auto' }}>
                Expires: {new Date(request.expiry_time).toLocaleDateString()}
              </span>
            </div>

            {/* Title & Description */}
            <div>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.15rem', color: '#0f172a' }}>{request.title}</h3>
              <p style={{ margin: 0, color: '#334155', fontSize: '0.925rem', whiteSpace: 'pre-wrap' }}>
                {request.description}
              </p>
            </div>

            {/* Approximate Locality & Timing */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', padding: '0.85rem', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Locality / Area</span>
                <strong style={{ fontSize: '0.875rem', color: '#1e293b' }}>📍 {request.approximate_locality}</strong>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Preferred Time</span>
                <strong style={{ fontSize: '0.875rem', color: '#1e293b' }}>🕒 {request.preferred_date_time || 'Flexible'}</strong>
              </div>
            </div>

            {/* Contact Sharing Grant Section */}
            {(isCreator || isAssignedVolunteer) && (request.contact_phone || request.contact_address) && (
              <div style={{ padding: '0.85rem', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                <h4 style={{ margin: '0 0 0.35rem 0', color: '#166534', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  🔒 Private Contact Details (Revealed to Authorized Volunteer)
                </h4>
                {request.contact_phone && (
                  <p style={{ margin: '0.2rem 0', fontSize: '0.85rem', color: '#14532d' }}>
                    <strong>Phone:</strong> {request.contact_phone}
                  </p>
                )}
                {request.contact_address && (
                  <p style={{ margin: '0.2rem 0', fontSize: '0.85rem', color: '#14532d' }}>
                    <strong>Flat / Address:</strong> {request.contact_address}
                  </p>
                )}
              </div>
            )}

            {/* Volunteers Section */}
            <div style={{ marginTop: '0.5rem' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.5rem' }}>
                Volunteers Interested ({volunteers.length})
              </h4>
              {volunteers.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>No community members have volunteered yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {volunteers.map((vol) => (
                    <div
                      key={vol.id}
                      style={{
                        padding: '0.65rem 0.85rem',
                        backgroundColor: vol.status === 'assigned' ? '#f0fdf4' : '#f8fafc',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>
                          Volunteer ({vol.volunteer_user_id === currentUserId ? 'You' : vol.volunteer_user_id.slice(0, 8)})
                        </span>
                        {vol.notes && <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>&ldquo;{vol.notes}&rdquo;</p>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: vol.status === 'assigned' ? '#16a34a' : '#64748b' }}>
                          {vol.status.toUpperCase()}
                        </span>
                        {isCreator && vol.status !== 'assigned' && request.status !== 'completed' && request.status !== 'cancelled' && (
                          <button
                            onClick={() => handleAssign(vol.volunteer_user_id)}
                            disabled={actionLoading}
                            style={{
                              padding: '0.35rem 0.75rem',
                              backgroundColor: '#0284c7',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Assign
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions for Volunteers */}
            {!isCreator && request.status !== 'completed' && request.status !== 'cancelled' && (
              <div style={{ padding: '1rem', backgroundColor: '#f1f5f9', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#1e293b' }}>Want to help?</h4>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder="Optional message (e.g. I am free between 10-12)"
                    value={volunteerNote}
                    onChange={(e) => setVolunteerNote(e.target.value)}
                    style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                  <button
                    onClick={handleVolunteer}
                    disabled={actionLoading}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#16a34a',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Volunteer to Help
                  </button>
                </div>
              </div>
            )}

            {/* Status Change Controls for Creator or Assigned Volunteer */}
            {(isCreator || isAssignedVolunteer) && request.status !== 'completed' && request.status !== 'cancelled' && (
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                {request.status !== 'in_progress' && (
                  <button
                    onClick={() => handleStatusChange('in_progress')}
                    disabled={actionLoading}
                    style={{ padding: '0.5rem 1rem', backgroundColor: '#e2e8f0', color: '#1e293b', border: 'none', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer' }}
                  >
                    Mark In Progress
                  </button>
                )}
                <button
                  onClick={() => handleStatusChange('completed')}
                  disabled={actionLoading}
                  style={{ padding: '0.5rem 1rem', backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  ✓ Mark Help Completed
                </button>
                {isCreator && (
                  <button
                    onClick={() => handleStatusChange('cancelled')}
                    disabled={actionLoading}
                    style={{ padding: '0.5rem 1rem', backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer' }}
                  >
                    Cancel Request
                  </button>
                )}
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
