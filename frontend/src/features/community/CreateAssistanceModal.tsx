/**
 * frontend/src/features/community/CreateAssistanceModal.tsx
 *
 * Form modal to request voluntary, non-emergency assistance for elderly or neighbors.
 */

import React, { useState } from 'react';
import { communityService } from '../../services/communityService';
import { AssistanceCategory, AssistancePriority, AssistanceRequest } from '../../types/community';

interface Props {
  isOpen: boolean;
  communityId: string;
  onClose: () => void;
  onCreated: (request: AssistanceRequest) => void;
}

export const CreateAssistanceModal: React.FC<Props> = ({ isOpen, communityId, onClose, onCreated }) => {
  const [requestCategory, setRequestCategory] = useState<AssistanceCategory>('grocery_supplies');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<AssistancePriority>('medium');
  const [intendedRecipientName, setIntendedRecipientName] = useState('');
  const [approximateLocality, setApproximateLocality] = useState('');
  const [preferredDateTime, setPreferredDateTime] = useState('');
  const [expiryHours, setExpiryHours] = useState(48);
  const [contactSharingConsent, setContactSharingConsent] = useState(false);
  const [contactPhone, setContactPhone] = useState('');
  const [contactAddress, setContactAddress] = useState('');
  const [nonEmergencyConfirmed, setNonEmergencyConfirmed] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nonEmergencyConfirmed) {
      setError('You must confirm that this is a non-emergency assistance request.');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const request = await communityService.createAssistanceRequest(communityId, {
        requestCategory,
        title,
        description,
        priority,
        intendedRecipientName: intendedRecipientName.trim() || undefined,
        approximateLocality,
        preferredDateTime: preferredDateTime.trim() || undefined,
        expiryHours,
        contactSharingConsent,
        contactPhone: contactSharingConsent ? contactPhone.trim() : undefined,
        contactAddress: contactSharingConsent ? contactAddress.trim() : undefined,
      });

      onCreated(request);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit assistance request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-assistance-title"
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
          maxWidth: '580px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '2rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 id="create-assistance-title" style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
            🤝 Request Non-Emergency Assistance
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

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ padding: '0.75rem', backgroundColor: '#fef2f2', borderRadius: '8px', borderLeft: '4px solid #ef4444' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: '#991b1b', fontWeight: 600 }}>
              <input
                type="checkbox"
                required
                checked={nonEmergencyConfirmed}
                onChange={(e) => setNonEmergencyConfirmed(e.target.checked)}
                style={{ marginTop: '0.2rem' }}
              />
              <span>I confirm this is for non-emergency neighborly help. (For acute medical emergencies, call 112 / Ambulance immediately).</span>
            </label>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
              Category *
            </label>
            <select
              value={requestCategory}
              onChange={(e) => setRequestCategory(e.target.value as AssistanceCategory)}
              style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            >
              <option value="grocery_supplies">Grocery & Essential Supplies</option>
              <option value="appointment_accompaniment">Accompaniment for Planned Clinic Visit</option>
              <option value="transport_assistance">Help Arranging Scheduled Transport</option>
              <option value="errands">Basic Errands & Pharmacy Pickup</option>
              <option value="welfare_check">Wellness / Welfare Check</option>
              <option value="caregiver_contact">Help Contacting Family Caregiver</option>
              <option value="other_support">Other Non-Emergency Support</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
              Title / Summary *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Milk & bread delivery for elderly resident"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as AssistancePriority)}
                style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              >
                <option value="low">Low (Flexible timing)</option>
                <option value="medium">Medium (Standard)</option>
                <option value="high">High (Needed today)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                Recipient Name (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Mrs. Rao (Senior)"
                value={intendedRecipientName}
                onChange={(e) => setIntendedRecipientName(e.target.value)}
                style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
              Approximate Locality / Wing * (Visible in feed)
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Wing B, 3rd Floor or North Gate Area"
              value={approximateLocality}
              onChange={(e) => setApproximateLocality(e.target.value)}
              style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                Preferred Date / Time
              </label>
              <input
                type="text"
                placeholder="e.g. Tomorrow 10:00 AM"
                value={preferredDateTime}
                onChange={(e) => setPreferredDateTime(e.target.value)}
                style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                Expiry Window
              </label>
              <select
                value={expiryHours}
                onChange={(e) => setExpiryHours(Number(e.target.value))}
                style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              >
                <option value={24}>24 Hours</option>
                <option value={48}>48 Hours (2 Days)</option>
                <option value={72}>72 Hours (3 Days)</option>
                <option value={168}>1 Week</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
              Details & Instructions *
            </label>
            <textarea
              required
              rows={3}
              placeholder="Describe what help is needed. Do NOT include sensitive medical history or diagnoses."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </div>

          {/* Contact Details Privacy Card */}
          <div style={{ padding: '0.85rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: '#1e293b', fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={contactSharingConsent}
                onChange={(e) => setContactSharingConsent(e.target.checked)}
              />
              <span>Share contact details with the assigned volunteer only (Privacy Protected)</span>
            </label>
            <p style={{ margin: '0.25rem 0 0.5rem 1.5rem', fontSize: '0.75rem', color: '#64748b' }}>
              Phone number and exact apartment address will be masked from general members and revealed only when you explicitly assign a volunteer.
            </p>

            {contactSharingConsent && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.2rem' }}>
                    Contact Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.2rem' }}>
                    Exact Flat / Address
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Flat 304, Tower B"
                    value={contactAddress}
                    onChange={(e) => setContactAddress(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </div>
              </div>
            )}
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
              style={{ padding: '0.65rem 1.25rem', backgroundColor: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
            >
              {loading ? 'Submitting...' : 'Post Assistance Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
