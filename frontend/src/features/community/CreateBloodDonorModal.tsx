/**
 * frontend/src/features/community/CreateBloodDonorModal.tsx
 *
 * Form modal to post a voluntary blood-donor coordination request.
 */

import React, { useState } from 'react';
import { communityService } from '../../services/communityService';
import { BloodGroup, BloodDonorRequest } from '../../types/community';

interface Props {
  isOpen: boolean;
  communityId: string;
  onClose: () => void;
  onCreated: (request: BloodDonorRequest) => void;
}

export const CreateBloodDonorModal: React.FC<Props> = ({ isOpen, communityId, onClose, onCreated }) => {
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>('O+');
  const [unitsNeeded, setUnitsNeeded] = useState(1);
  const [approximateLocality, setApproximateLocality] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [requestedDateTime, setRequestedDateTime] = useState('');
  const [notes, setNotes] = useState('');
  const [expiryHours, setExpiryHours] = useState(48);
  const [contactPhone, setContactPhone] = useState('');
  const [contactSharingConsent, setContactSharingConsent] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disclaimerAccepted) {
      setError('You must acknowledge that all medical screening and blood transfusion decisions are handled by licensed healthcare professionals.');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const res = await communityService.createBloodDonorRequest(communityId, {
        bloodGroup,
        unitsNeeded,
        approximateLocality,
        hospitalName: hospitalName.trim() || undefined,
        requestedDateTime: requestedDateTime.trim() || undefined,
        notes: notes.trim() || undefined,
        expiryHours,
        contactPhone: contactSharingConsent ? contactPhone.trim() : undefined,
        contactSharingConsent,
      });

      onCreated(res.request);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit blood donor request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-blood-title"
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
          maxWidth: '560px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '2rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 id="create-blood-title" style={{ fontSize: '1.25rem', fontWeight: 700, color: '#dc2626', margin: 0 }}>
            🩸 Post Blood-Donor Request
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

        <div style={{ padding: '0.85rem', backgroundColor: '#fff7ed', borderRadius: '8px', borderLeft: '4px solid #ea580c', marginBottom: '1.25rem' }}>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#9a3412', lineHeight: '1.4' }}>
            ⚠️ <strong>Medical Disclaimer:</strong> This portal facilitates voluntary contact coordination only. Sanjivani does NOT test blood, check antibodies, or verify clinical donor eligibility. All medical screening, infectious disease testing, and collection remain exclusively with authorized blood banks and hospitals.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                Blood Group Needed *
              </label>
              <select
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value as BloodGroup)}
                style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 600 }}
              >
                <option value="O+">O Positive (O+)</option>
                <option value="O-">O Negative (O-)</option>
                <option value="A+">A Positive (A+)</option>
                <option value="A-">A Negative (A-)</option>
                <option value="B+">B Positive (B+)</option>
                <option value="B-">B Negative (B-)</option>
                <option value="AB+">AB Positive (AB+)</option>
                <option value="AB-">AB Negative (AB-)</option>
                <option value="any">Any / Universal</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                Units Needed (1 - 20)
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={unitsNeeded}
                onChange={(e) => setUnitsNeeded(Number(e.target.value))}
                style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
              Hospital or Blood Bank Facility *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Manipal Hospital Blood Bank, HAL Airport Road"
              value={hospitalName}
              onChange={(e) => setHospitalName(e.target.value)}
              style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
              Approximate Locality / City Area *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Indiranagar / Old Airport Road, Bangalore"
              value={approximateLocality}
              onChange={(e) => setApproximateLocality(e.target.value)}
              style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                Date / Time Window
              </label>
              <input
                type="text"
                placeholder="e.g. Needed within 24 hours"
                value={requestedDateTime}
                onChange={(e) => setRequestedDateTime(e.target.value)}
                style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                Request Expiry
              </label>
              <select
                value={expiryHours}
                onChange={(e) => setExpiryHours(Number(e.target.value))}
                style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              >
                <option value={24}>24 Hours</option>
                <option value={48}>48 Hours (2 Days)</option>
                <option value={72}>72 Hours (3 Days)</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
              Coordinator Notes (No private medical records)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Scheduled surgery requirement. Direct donation at hospital blood counter."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </div>

          {/* Privacy Controlled Phone Sharing */}
          <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: '#1e293b', fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={contactSharingConsent}
                onChange={(e) => setContactSharingConsent(e.target.checked)}
              />
              <span>Provide contact phone for interested donors</span>
            </label>
            {contactSharingConsent && (
              <div style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>
            )}
          </div>

          {/* Mandatory Disclaimer Checkbox */}
          <div style={{ padding: '0.75rem', backgroundColor: '#fef2f2', borderRadius: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', color: '#991b1b', fontWeight: 600 }}>
              <input
                type="checkbox"
                required
                checked={disclaimerAccepted}
                onChange={(e) => setDisclaimerAccepted(e.target.checked)}
                style={{ marginTop: '0.15rem' }}
              />
              <span>I acknowledge that Sanjivani is for voluntary coordination only and does not verify donor medical eligibility.</span>
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
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
              {loading ? 'Posting...' : 'Post Blood Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
