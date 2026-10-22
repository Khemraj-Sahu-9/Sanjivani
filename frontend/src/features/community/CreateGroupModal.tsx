/**
 * frontend/src/features/community/CreateGroupModal.tsx
 *
 * Form modal to create a residential society, apartment building, or neighborhood group.
 */

import React, { useState } from 'react';
import { communityService } from '../../services/communityService';
import { CommunityGroup, CommunityGroupType, CommunityMembershipPolicy } from '../../types/community';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (group: CommunityGroup) => void;
}

export const CreateGroupModal: React.FC<Props> = ({ isOpen, onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [groupType, setGroupType] = useState<CommunityGroupType>('residential_society');
  const [description, setDescription] = useState('');
  const [approximateLocality, setApproximateLocality] = useState('');
  const [organizationOrBuildingName, setOrganizationOrBuildingName] = useState('');
  const [membershipPolicy, setMembershipPolicy] = useState<CommunityMembershipPolicy>('open');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await communityService.createGroup({
        name,
        groupType,
        description,
        approximateLocality,
        organizationOrBuildingName: organizationOrBuildingName.trim() || undefined,
        membershipPolicy,
        moderationPolicy: 'standard',
      });
      onCreated(res.group);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create community group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-group-title"
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
          maxWidth: '550px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '2rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 id="create-group-title" style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
            🏘️ Create Community Group
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
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
              Group Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Greenwood Residency Health Circle"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
              Group Type *
            </label>
            <select
              value={groupType}
              onChange={(e) => setGroupType(e.target.value as CommunityGroupType)}
              style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            >
              <option value="residential_society">Residential Society</option>
              <option value="apartment_building">Apartment Building</option>
              <option value="neighborhood">Neighborhood / Ward</option>
              <option value="other_local">Other Local Community</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
              Approximate Locality / Area * (No exact street address needed)
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Indiranagar, Bangalore"
              value={approximateLocality}
              onChange={(e) => setApproximateLocality(e.target.value)}
              style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
              Society or Building Name (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Greenwood Residency Phase 1"
              value={organizationOrBuildingName}
              onChange={(e) => setOrganizationOrBuildingName(e.target.value)}
              style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
              Membership Policy *
            </label>
            <select
              value={membershipPolicy}
              onChange={(e) => setMembershipPolicy(e.target.value as CommunityMembershipPolicy)}
              style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            >
              <option value="open">Open (Anyone in neighborhood can join)</option>
              <option value="approval_required">Approval Required (Admin verifies resident request)</option>
              <option value="invite_only">Invite Only (Invitation code required)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
              Description *
            </label>
            <textarea
              required
              rows={3}
              placeholder="Describe your community purpose, e.g. neighborly support, senior citizen assistance, and health aid."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
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
              {loading ? 'Creating...' : 'Create Community'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
