/**
 * frontend/src/features/community/CommunityDashboard.tsx
 *
 * Primary responsive dashboard for Phase 8:
 * - Community Group switcher & discovery.
 * - Non-emergency elderly assistance coordination & volunteer tracking.
 * - Blood donor requests & donor interest with clinical screening disclaimers.
 * - Member management, invitations, and join request reviews.
 * - Community moderation dashboard for authorized owners and moderators.
 * - Strict healthcare privacy boundaries (Zero PHI sharing with community).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { communityService } from '../../services/communityService';
import {
  CommunityGroup,
  CommunityMembership,
  CommunityInvitation,
  CommunityJoinRequest,
  AssistanceRequest,
  BloodDonorRequest,
  CommunityReport,
} from '../../types/community';
import { CommunityRulesModal } from './CommunityRulesModal';
import { CreateGroupModal } from './CreateGroupModal';
import { CreateAssistanceModal } from './CreateAssistanceModal';
import { AssistanceDetailModal } from './AssistanceDetailModal';
import { CreateBloodDonorModal } from './CreateBloodDonorModal';
import { BloodDonorDetailModal } from './BloodDonorDetailModal';
import { ReportModal } from './ReportModal';

interface Props {
  currentUserId: string;
}

export type CommunityTab = 'assistance' | 'blood' | 'members' | 'moderation' | 'browse' | 'invitations';

export const CommunityDashboard: React.FC<Props> = ({ currentUserId }) => {
  const [myGroups, setMyGroups] = useState<CommunityGroup[]>([]);
  const [activeGroup, setActiveGroup] = useState<CommunityGroup | null>(null);
  const [myMembership, setMyMembership] = useState<CommunityMembership | null>(null);
  const [members, setMembers] = useState<CommunityMembership[]>([]);
  const [joinRequests, setJoinRequests] = useState<CommunityJoinRequest[]>([]);
  const [myInvitations, setMyInvitations] = useState<CommunityInvitation[]>([]);

  // Active Tab
  const [activeTab, setActiveTab] = useState<CommunityTab>('assistance');

  // Feeds
  const [assistanceRequests, setAssistanceRequests] = useState<AssistanceRequest[]>([]);
  const [bloodRequests, setBloodRequests] = useState<BloodDonorRequest[]>([]);
  const [publicGroups, setPublicGroups] = useState<CommunityGroup[]>([]);
  const [moderationReports, setModerationReports] = useState<CommunityReport[]>([]);

  // Filter states
  const [assistanceCategoryFilter, setAssistanceCategoryFilter] = useState('');
  const [bloodGroupFilter, setBloodGroupFilter] = useState('');
  const [localitySearch, setLocalitySearch] = useState('');

  // Modals
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showCreateAssistanceModal, setShowCreateAssistanceModal] = useState(false);
  const [showCreateBloodModal, setShowCreateBloodModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTargetId, setReportTargetId] = useState('');

  // Detail View Modals
  const [selectedAssistanceId, setSelectedAssistanceId] = useState<string | null>(null);
  const [selectedBloodReqId, setSelectedBloodReqId] = useState<string | null>(null);

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');

  // Loading & Feedback
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const isOwner = myMembership?.role === 'owner';
  const isModerator = myMembership?.role === 'owner' || myMembership?.role === 'moderator';

  // Load Groups and Invitations
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const groups = await communityService.listMyGroups();
      setMyGroups(groups);
      if (groups.length > 0) {
        // Set first group as active if none selected
        setActiveGroup((prev) => prev || groups[0]);
      }

      const invites = await communityService.listMyInvitations();
      setMyInvitations(invites);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load community groups' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Load Active Group Details
  const loadGroupDetails = useCallback(async (communityId: string) => {
    try {
      const details = await communityService.getGroup(communityId);
      setMyMembership(details.myMembership || null);

      if (details.myMembership && details.myMembership.status === 'active') {
        const mems = await communityService.listMembers(communityId);
        setMembers(mems);

        if (details.myMembership.role === 'owner' || details.myMembership.role === 'moderator') {
          const reqs = await communityService.listJoinRequests(communityId, 'pending');
          setJoinRequests(reqs);

          const reports = await communityService.listReports(communityId);
          setModerationReports(reports);
        }

        const assist = await communityService.listAssistanceRequests(communityId, {
          category: assistanceCategoryFilter || undefined,
        });
        setAssistanceRequests(assist);

        const blood = await communityService.listBloodDonorRequests(communityId, {
          bloodGroup: bloodGroupFilter || undefined,
        });
        setBloodRequests(blood);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load community data' });
    }
  }, [assistanceCategoryFilter, bloodGroupFilter]);

  useEffect(() => {
    if (activeGroup) {
      loadGroupDetails(activeGroup.id);
    }
  }, [activeGroup, loadGroupDetails]);

  // Handle invitation actions
  const handleAcceptInvite = async (inviteCode: string) => {
    try {
      await communityService.acceptInvitation(inviteCode);
      setFeedback({ type: 'success', message: 'Invitation accepted! You are now a community member.' });
      loadInitialData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to accept invitation' });
    }
  };

  const handleDeclineInvite = async (inviteCode: string) => {
    try {
      await communityService.declineInvitation(inviteCode);
      setFeedback({ type: 'success', message: 'Invitation declined.' });
      loadInitialData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to decline invitation' });
    }
  };

  // Browse Public Groups
  const handleSearchPublicGroups = async () => {
    try {
      const results = await communityService.listPublicGroups(localitySearch.trim() || undefined);
      setPublicGroups(results);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to discover groups' });
    }
  };

  const handleJoinGroup = async (group: CommunityGroup) => {
    try {
      const res = await communityService.requestJoin(group.id);
      if (res.membership) {
        setFeedback({ type: 'success', message: `Successfully joined ${group.name}!` });
        loadInitialData();
      } else {
        setFeedback({ type: 'success', message: 'Join request submitted! A community administrator will review it.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to join group' });
    }
  };

  const handleReviewJoin = async (requestId: string, action: 'approve' | 'reject') => {
    if (!activeGroup) return;
    try {
      await communityService.reviewJoinRequest(activeGroup.id, requestId, action);
      setFeedback({ type: 'success', message: `Join request ${action}d.` });
      loadGroupDetails(activeGroup.id);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to review join request' });
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGroup || !inviteEmail.trim()) return;
    try {
      await communityService.inviteMember(activeGroup.id, inviteEmail.trim());
      setFeedback({ type: 'success', message: `Invitation sent to ${inviteEmail}!` });
      setShowInviteModal(false);
      setInviteEmail('');
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to send invitation' });
    }
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Top Banner / Privacy Disclaimer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.85rem 1.25rem',
          backgroundColor: '#f0f9ff',
          borderRadius: '10px',
          border: '1px solid #bae6fd',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.5rem' }}>🛡️</span>
          <div>
            <strong style={{ fontSize: '0.9rem', color: '#0369a1' }}>
              Healthcare Privacy Guaranteed
            </strong>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#0284c7' }}>
              Your private medical documents, AI Health Memory, and doctor summaries are never shared with community groups.
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowRulesModal(true)}
          style={{
            padding: '0.45rem 0.85rem',
            backgroundColor: '#ffffff',
            border: '1px solid #0284c7',
            color: '#0284c7',
            borderRadius: '6px',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          View Community Safety Rules
        </button>
      </div>

      {feedback && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            marginBottom: '1rem',
            backgroundColor: feedback.type === 'success' ? '#f0fdf4' : '#fef2f2',
            color: feedback.type === 'success' ? '#16a34a' : '#dc2626',
            fontSize: '0.875rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{feedback.message}</span>
          <button
            onClick={() => setFeedback(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 700 }}
          >
            ×
          </button>
        </div>
      )}

      {/* Main Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            🏘️ Health Community
          </h1>
          {myGroups.length > 0 && (
            <select
              aria-label="Select Community Group"
              value={activeGroup?.id || ''}
              onChange={(e) => {
                const found = myGroups.find((g) => g.id === e.target.value);
                if (found) setActiveGroup(found);
              }}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.9rem',
                fontWeight: 600,
                color: '#1e293b',
              }}
            >
              {myGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.approximate_locality})
                </option>
              ))}
            </select>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {myInvitations.length > 0 && (
            <button
              onClick={() => setActiveTab('invitations')}
              style={{
                padding: '0.5rem 0.85rem',
                backgroundColor: '#fef3c7',
                color: '#b45309',
                border: '1px solid #fde68a',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              📬 Invitations ({myInvitations.length})
            </button>
          )}
          <button
            onClick={() => {
              setActiveTab('browse');
              handleSearchPublicGroups();
            }}
            style={{
              padding: '0.5rem 0.85rem',
              backgroundColor: '#f1f5f9',
              color: '#334155',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            🔍 Browse Groups
          </button>
          <button
            onClick={() => setShowCreateGroupModal(true)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + Create Group
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Loading community network...</div>
      ) : myGroups.length === 0 && activeTab !== 'browse' && activeTab !== 'invitations' ? (
        /* Empty State */
        <div
          style={{
            textAlign: 'center',
            padding: '3rem 1.5rem',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px dashed #cbd5e1',
          }}
        >
          <span style={{ fontSize: '3rem' }}>🏘️</span>
          <h3 style={{ fontSize: '1.25rem', color: '#1e293b', marginTop: '1rem' }}>You Haven&apos;t Joined Any Communities Yet</h3>
          <p style={{ color: '#64748b', maxWidth: '450px', margin: '0.5rem auto 1.5rem auto', fontSize: '0.9rem' }}>
            Join your residential society, apartment building, or neighborhood circle to request non-emergency elderly help, blood donors, or volunteer with neighbors.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
            <button
              onClick={() => {
                setActiveTab('browse');
                handleSearchPublicGroups();
              }}
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
              Discover Local Groups
            </button>
            <button
              onClick={() => setShowCreateGroupModal(true)}
              style={{
                padding: '0.65rem 1.25rem',
                backgroundColor: '#f1f5f9',
                color: '#334155',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Create New Group
            </button>
          </div>
        </div>
      ) : (
        /* Main Dashboard View */
        <div>
          {/* Tabs Navigation */}
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              borderBottom: '1px solid #e2e8f0',
              paddingBottom: '0.25rem',
              marginBottom: '1.5rem',
              overflowX: 'auto',
            }}
          >
            <button
              onClick={() => setActiveTab('assistance')}
              style={{
                padding: '0.65rem 1rem',
                border: 'none',
                borderBottom: activeTab === 'assistance' ? '3px solid #0284c7' : '3px solid transparent',
                backgroundColor: 'transparent',
                color: activeTab === 'assistance' ? '#0284c7' : '#64748b',
                fontWeight: activeTab === 'assistance' ? 700 : 500,
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              🤝 Elderly & Mutual Assistance
            </button>
            <button
              onClick={() => setActiveTab('blood')}
              style={{
                padding: '0.65rem 1rem',
                border: 'none',
                borderBottom: activeTab === 'blood' ? '3px solid #dc2626' : '3px solid transparent',
                backgroundColor: 'transparent',
                color: activeTab === 'blood' ? '#dc2626' : '#64748b',
                fontWeight: activeTab === 'blood' ? 700 : 500,
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              🩸 Blood-Donor Requests
            </button>
            <button
              onClick={() => setActiveTab('members')}
              style={{
                padding: '0.65rem 1rem',
                border: 'none',
                borderBottom: activeTab === 'members' ? '3px solid #0284c7' : '3px solid transparent',
                backgroundColor: 'transparent',
                color: activeTab === 'members' ? '#0284c7' : '#64748b',
                fontWeight: activeTab === 'members' ? 700 : 500,
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              👥 Members & Join Requests {joinRequests.length > 0 && `(${joinRequests.length})`}
            </button>
            {isModerator && (
              <button
                onClick={() => setActiveTab('moderation')}
                style={{
                  padding: '0.65rem 1rem',
                  border: 'none',
                  borderBottom: activeTab === 'moderation' ? '3px solid #b91c1c' : '3px solid transparent',
                  backgroundColor: 'transparent',
                  color: activeTab === 'moderation' ? '#b91c1c' : '#64748b',
                  fontWeight: activeTab === 'moderation' ? 700 : 500,
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                🛡️ Moderation {moderationReports.length > 0 && `(${moderationReports.length})`}
              </button>
            )}
            <button
              onClick={() => {
                setActiveTab('browse');
                handleSearchPublicGroups();
              }}
              style={{
                padding: '0.65rem 1rem',
                border: 'none',
                borderBottom: activeTab === 'browse' ? '3px solid #0284c7' : '3px solid transparent',
                backgroundColor: 'transparent',
                color: activeTab === 'browse' ? '#0284c7' : '#64748b',
                fontWeight: activeTab === 'browse' ? 700 : 500,
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              🔍 Browse Directory
            </button>
            {myInvitations.length > 0 && (
              <button
                onClick={() => setActiveTab('invitations')}
                style={{
                  padding: '0.65rem 1rem',
                  border: 'none',
                  borderBottom: activeTab === 'invitations' ? '3px solid #d97706' : '3px solid transparent',
                  backgroundColor: 'transparent',
                  color: activeTab === 'invitations' ? '#d97706' : '#64748b',
                  fontWeight: activeTab === 'invitations' ? 700 : 500,
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                📬 Pending Invites ({myInvitations.length})
              </button>
            )}
          </div>

          {/* TAB 1: ASSISTANCE REQUESTS */}
          {activeTab === 'assistance' && activeGroup && (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>Filter:</span>
                  <select
                    value={assistanceCategoryFilter}
                    onChange={(e) => setAssistanceCategoryFilter(e.target.value)}
                    style={{ padding: '0.4rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  >
                    <option value="">All Categories</option>
                    <option value="grocery_supplies">Grocery & Supplies</option>
                    <option value="appointment_accompaniment">Clinic Accompaniment</option>
                    <option value="transport_assistance">Transport Assistance</option>
                    <option value="errands">Errands & Pharmacy</option>
                    <option value="welfare_check">Welfare Check</option>
                    <option value="caregiver_contact">Caregiver Contact</option>
                    <option value="other_support">Other Support</option>
                  </select>
                </div>

                <button
                  onClick={() => setShowCreateAssistanceModal(true)}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  + Request Assistance
                </button>
              </div>

              {assistanceRequests.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '2rem' }}>🤝</span>
                  <h4 style={{ margin: '0.5rem 0 0.25rem 0', color: '#334155' }}>No Active Assistance Requests</h4>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                    Need grocery delivery, clinic accompaniment, or senior assistance? Post a request for your neighbors.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                  {assistanceRequests.map((req) => (
                    <div
                      key={req.id}
                      onClick={() => setSelectedAssistanceId(req.id)}
                      style={{
                        padding: '1.25rem',
                        backgroundColor: '#ffffff',
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <span
                            style={{
                              padding: '0.2rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              backgroundColor: req.priority === 'high' ? '#fee2e2' : '#f1f5f9',
                              color: req.priority === 'high' ? '#dc2626' : '#475569',
                            }}
                          >
                            {req.priority.toUpperCase()}
                          </span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: req.status === 'completed' ? '#16a34a' : '#0284c7' }}>
                            {req.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>

                        <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '1rem', color: '#0f172a' }}>{req.title}</h4>
                        <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: '#64748b', lineHeight: '1.4' }}>
                          {req.description.length > 120 ? `${req.description.slice(0, 120)}...` : req.description}
                        </p>
                      </div>

                      <div style={{ paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9', fontSize: '0.8rem', color: '#475569', display: 'flex', justifyContent: 'space-between' }}>
                        <span>📍 {req.approximate_locality}</span>
                        <span>🕒 {req.preferred_date_time || 'Flexible'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: BLOOD DONOR REQUESTS */}
          {activeTab === 'blood' && activeGroup && (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>Blood Group:</span>
                  <select
                    value={bloodGroupFilter}
                    onChange={(e) => setBloodGroupFilter(e.target.value)}
                    style={{ padding: '0.4rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  >
                    <option value="">All Blood Groups</option>
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

                <button
                  onClick={() => setShowCreateBloodModal(true)}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  + Post Blood Request
                </button>
              </div>

              {bloodRequests.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '2rem' }}>🩸</span>
                  <h4 style={{ margin: '0.5rem 0 0.25rem 0', color: '#334155' }}>No Active Blood Requests</h4>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                    Blood donor requests for community hospital surgeries or emergency transfusions will appear here.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                  {bloodRequests.map((req) => (
                    <div
                      key={req.id}
                      onClick={() => setSelectedBloodReqId(req.id)}
                      style={{
                        padding: '1.25rem',
                        backgroundColor: '#ffffff',
                        borderRadius: '10px',
                        border: '1px solid #fee2e2',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <span
                            style={{
                              padding: '0.25rem 0.65rem',
                              borderRadius: '4px',
                              fontSize: '0.85rem',
                              fontWeight: 800,
                              backgroundColor: '#fee2e2',
                              color: '#b91c1c',
                            }}
                          >
                            GROUP {req.blood_group} ({req.units_needed} {req.units_needed === 1 ? 'Unit' : 'Units'})
                          </span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: req.status === 'fulfilled' ? '#16a34a' : '#dc2626' }}>
                            {req.status.toUpperCase()}
                          </span>
                        </div>

                        <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', color: '#0f172a' }}>
                          {req.hospital_name || 'Hospital blood bank'}
                        </h4>
                        <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: '#64748b' }}>
                          📍 {req.approximate_locality}
                        </p>
                      </div>

                      <div style={{ paddingTop: '0.75rem', borderTop: '1px solid #fee2e2', fontSize: '0.75rem', color: '#7f1d1d', display: 'flex', justifyContent: 'space-between' }}>
                        <span>🕒 {req.requested_date_time || 'Immediate'}</span>
                        <span style={{ textDecoration: 'underline' }}>View & Respond →</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MEMBERS & JOIN REQUESTS */}
          {activeTab === 'members' && activeGroup && (
            <div>
              {/* Header with Invite Member */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>
                  Community Members ({members.length})
                </h3>
                {isModerator && (
                  <button
                    onClick={() => setShowInviteModal(true)}
                    style={{
                      padding: '0.45rem 0.85rem',
                      backgroundColor: '#0284c7',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    + Invite Resident
                  </button>
                )}
              </div>

              {/* Join Requests if moderator/owner */}
              {isModerator && joinRequests.length > 0 && (
                <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#fef3c7', borderRadius: '8px', border: '1px solid #fde68a' }}>
                  <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', color: '#92400e' }}>
                    Pending Join Requests ({joinRequests.length})
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {joinRequests.map((req) => (
                      <div
                        key={req.id}
                        style={{
                          padding: '0.75rem',
                          backgroundColor: '#ffffff',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: '0.85rem', color: '#1e293b' }}>
                            User ID: {req.user_id.slice(0, 8)}...
                          </strong>
                          {req.notes && <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>&ldquo;{req.notes}&rdquo;</p>}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            onClick={() => handleReviewJoin(req.id, 'approve')}
                            style={{ padding: '0.35rem 0.75rem', backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReviewJoin(req.id, 'reject')}
                            style={{ padding: '0.35rem 0.75rem', backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Members List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {members.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      padding: '0.75rem 1rem',
                      backgroundColor: '#ffffff',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e293b' }}>
                        Member ({m.user_id === currentUserId ? 'You' : m.user_id.slice(0, 8)})
                      </span>
                      <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#64748b' }}>
                        Joined {new Date(m.joined_at).toLocaleDateString()}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span
                        style={{
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          backgroundColor: m.role === 'owner' ? '#fef3c7' : m.role === 'moderator' ? '#e0f2fe' : '#f1f5f9',
                          color: m.role === 'owner' ? '#b45309' : m.role === 'moderator' ? '#0369a1' : '#475569',
                        }}
                      >
                        {m.role.toUpperCase()}
                      </span>

                      {isOwner && m.role !== 'owner' && (
                        <button
                          onClick={async () => {
                            const newRole = m.role === 'moderator' ? 'member' : 'moderator';
                            await communityService.updateMemberRole(activeGroup.id, m.user_id, newRole);
                            loadGroupDetails(activeGroup.id);
                          }}
                          style={{
                            padding: '0.25rem 0.5rem',
                            backgroundColor: 'transparent',
                            border: '1px solid #cbd5e1',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            cursor: 'pointer',
                          }}
                        >
                          {m.role === 'moderator' ? 'Demote to Member' : 'Promote to Moderator'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: MODERATION REPORTS */}
          {activeTab === 'moderation' && isModerator && activeGroup && (
            <div>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#0f172a' }}>
                Moderation & Safety Center ({moderationReports.length})
              </h3>
              {moderationReports.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                  <span style={{ fontSize: '2rem' }}>🛡️</span>
                  <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0.5rem 0 0 0' }}>Zero moderation reports pending in this community.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {moderationReports.map((rep) => (
                    <div
                      key={rep.id}
                      style={{
                        padding: '1rem',
                        backgroundColor: '#ffffff',
                        borderRadius: '8px',
                        border: '1px solid #fee2e2',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, backgroundColor: '#fee2e2', color: '#b91c1c' }}>
                          REASON: {rep.reason_category.toUpperCase()}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          Status: <strong>{rep.status.toUpperCase()}</strong>
                        </span>
                      </div>
                      <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#334155' }}>{rep.details}</p>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        Target: {rep.target_type} ({rep.target_id.slice(0, 8)})
                      </div>
                      {rep.status === 'submitted' && (
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                          <button
                            onClick={async () => {
                              await communityService.resolveReport(activeGroup.id, rep.id, {
                                status: 'resolved',
                                decisionNotes: 'Dismissed by moderator as safe activity.',
                                actionTaken: 'dismissed',
                              });
                              loadGroupDetails(activeGroup.id);
                            }}
                            style={{ padding: '0.35rem 0.75rem', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}
                          >
                            Dismiss Report
                          </button>
                          <button
                            onClick={async () => {
                              await communityService.resolveReport(activeGroup.id, rep.id, {
                                status: 'resolved',
                                decisionNotes: 'Content hidden due to community rule violation.',
                                actionTaken: 'content_hidden',
                              });
                              loadGroupDetails(activeGroup.id);
                            }}
                            style={{ padding: '0.35rem 0.75rem', backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                          >
                            Hide Content
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: BROWSE DIRECTORY */}
          {activeTab === 'browse' && (
            <div>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <input
                  type="text"
                  placeholder="Filter by locality or neighborhood (e.g. Indiranagar, Bangalore)"
                  value={localitySearch}
                  onChange={(e) => setLocalitySearch(e.target.value)}
                  style={{ flex: 1, padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                />
                <button
                  onClick={handleSearchPublicGroups}
                  style={{ padding: '0.65rem 1.25rem', backgroundColor: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Search
                </button>
              </div>

              {publicGroups.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No groups found matching search query.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                  {publicGroups.map((g) => {
                    const isAlreadyMember = myGroups.some((mg) => mg.id === g.id);
                    return (
                      <div
                        key={g.id}
                        style={{
                          padding: '1.25rem',
                          backgroundColor: '#ffffff',
                          borderRadius: '10px',
                          border: '1px solid #e2e8f0',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, backgroundColor: '#f1f5f9', color: '#475569' }}>
                              {g.group_type.replace('_', ' ').toUpperCase()}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              Policy: {g.membership_policy}
                            </span>
                          </div>
                          <h4 style={{ margin: '0 0 0.35rem 0', fontSize: '1.05rem', color: '#0f172a' }}>{g.name}</h4>
                          <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: '#64748b' }}>{g.description}</p>
                          <span style={{ fontSize: '0.8rem', color: '#1e293b' }}>📍 {g.approximate_locality}</span>
                        </div>

                        <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
                          {isAlreadyMember ? (
                            <button
                              disabled
                              style={{ width: '100%', padding: '0.5rem', backgroundColor: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '6px', fontSize: '0.85rem' }}
                            >
                              ✓ Already a Member
                            </button>
                          ) : (
                            <button
                              onClick={() => handleJoinGroup(g)}
                              style={{
                                width: '100%',
                                padding: '0.5rem',
                                backgroundColor: '#0284c7',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '6px',
                                fontWeight: 600,
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                              }}
                            >
                              {g.membership_policy === 'approval_required' ? 'Request to Join' : 'Join Group'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: PENDING INVITATIONS */}
          {activeTab === 'invitations' && (
            <div>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#0f172a' }}>
                Your Pending Community Invitations ({myInvitations.length})
              </h3>
              {myInvitations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No pending invitations.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {myInvitations.map((inv) => (
                    <div
                      key={inv.id}
                      style={{
                        padding: '1rem',
                        backgroundColor: '#ffffff',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>Community Invitation</strong>
                        <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                          Invited to group ID: {inv.community_id.slice(0, 8)}... (Expires: {new Date(inv.expires_at).toLocaleDateString()})
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => handleAcceptInvite(inv.invite_code)}
                          style={{ padding: '0.45rem 0.85rem', backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleDeclineInvite(inv.invite_code)}
                          style={{ padding: '0.45rem 0.85rem', backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer' }}
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODALS */}
      <CommunityRulesModal isOpen={showRulesModal} onClose={() => setShowRulesModal(false)} />

      <CreateGroupModal
        isOpen={showCreateGroupModal}
        onClose={() => setShowCreateGroupModal(false)}
        onCreated={(group) => {
          setMyGroups((prev) => [...prev, group]);
          setActiveGroup(group);
          setFeedback({ type: 'success', message: `Community group "${group.name}" created successfully!` });
        }}
      />

      {activeGroup && (
        <CreateAssistanceModal
          isOpen={showCreateAssistanceModal}
          communityId={activeGroup.id}
          onClose={() => setShowCreateAssistanceModal(false)}
          onCreated={(req) => {
            setAssistanceRequests((prev) => [req, ...prev]);
            setFeedback({ type: 'success', message: 'Assistance request posted to community!' });
          }}
        />
      )}

      {activeGroup && (
        <CreateBloodDonorModal
          isOpen={showCreateBloodModal}
          communityId={activeGroup.id}
          onClose={() => setShowCreateBloodModal(false)}
          onCreated={(req) => {
            setBloodRequests((prev) => [req, ...prev]);
            setFeedback({ type: 'success', message: 'Blood-donor request posted with clinical disclaimer!' });
          }}
        />
      )}

      {activeGroup && selectedAssistanceId && (
        <AssistanceDetailModal
          isOpen={Boolean(selectedAssistanceId)}
          communityId={activeGroup.id}
          requestId={selectedAssistanceId}
          currentUserId={currentUserId}
          onClose={() => setSelectedAssistanceId(null)}
          onUpdated={(updated) => {
            setAssistanceRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
          }}
          onReportClick={(targetId) => {
            setReportTargetId(targetId);
            setShowReportModal(true);
          }}
        />
      )}

      {activeGroup && selectedBloodReqId && (
        <BloodDonorDetailModal
          isOpen={Boolean(selectedBloodReqId)}
          communityId={activeGroup.id}
          requestId={selectedBloodReqId}
          currentUserId={currentUserId}
          onClose={() => setSelectedBloodReqId(null)}
          onUpdated={(updated) => {
            setBloodRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
          }}
          onReportClick={(targetId) => {
            setReportTargetId(targetId);
            setShowReportModal(true);
          }}
        />
      )}

      {activeGroup && showReportModal && (
        <ReportModal
          isOpen={showReportModal}
          communityId={activeGroup.id}
          targetId={reportTargetId}
          onClose={() => {
            setShowReportModal(false);
            setReportTargetId('');
          }}
        />
      )}

      {/* Quick Invite Modal */}
      {activeGroup && showInviteModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="invite-modal-title"
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
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', maxWidth: '440px', width: '100%', padding: '2rem' }}>
            <h3 id="invite-modal-title" style={{ margin: '0 0 1rem 0', color: '#0f172a' }}>Invite Resident to {activeGroup.name}</h3>
            <form onSubmit={handleSendInvite}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                Resident Email Address *
              </label>
              <input
                type="email"
                required
                placeholder="neighbor@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '1.25rem' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  style={{ padding: '0.5rem 1rem', backgroundColor: '#f1f5f9', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '0.5rem 1rem', backgroundColor: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
