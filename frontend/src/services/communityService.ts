/**
 * frontend/src/services/communityService.ts
 *
 * Frontend HTTP client for Phase 8 Health Community, Society Groups & Assistance.
 */

import { apiClient } from '../lib/apiClient';
import {
  CommunityGroup,
  CommunityMembership,
  CommunityInvitation,
  CommunityJoinRequest,
  AssistanceRequest,
  AssistanceAssignment,
  BloodDonorRequest,
  DonorResponse,
  ContactSharingGrant,
  CommunityReport,
  ModerationAction,
  CommunityGroupType,
  CommunityMembershipPolicy,
  CommunityModerationPolicy,
  AssistanceCategory,
  AssistancePriority,
  BloodGroup,
} from '../types/community';

export const communityService = {
  // Groups
  async createGroup(input: {
    name: string;
    groupType: CommunityGroupType;
    description: string;
    approximateLocality: string;
    organizationOrBuildingName?: string | null;
    membershipPolicy?: CommunityMembershipPolicy;
    moderationPolicy?: CommunityModerationPolicy;
  }): Promise<{ group: CommunityGroup; membership: CommunityMembership }> {
    const res = await apiClient.post<{ success: boolean; group: CommunityGroup; membership: CommunityMembership }>(
      '/api/communities',
      input
    );
    if (res.error || !res.data) throw new Error(res.error || 'Failed to create group');
    return res.data;
  },

  async listMyGroups(): Promise<CommunityGroup[]> {
    const res = await apiClient.get<{ success: boolean; groups: CommunityGroup[] }>('/api/communities/my');
    if (res.error || !res.data) throw new Error(res.error || 'Failed to list user groups');
    return res.data.groups;
  },

  async listPublicGroups(locality?: string): Promise<CommunityGroup[]> {
    const query = locality ? `?locality=${encodeURIComponent(locality)}` : '';
    const res = await apiClient.get<{ success: boolean; groups: CommunityGroup[] }>(`/api/communities/public${query}`);
    if (res.error || !res.data) throw new Error(res.error || 'Failed to list public groups');
    return res.data.groups;
  },

  async getGroup(communityId: string): Promise<{ group: CommunityGroup; myMembership?: CommunityMembership | null }> {
    const res = await apiClient.get<{ success: boolean; group: CommunityGroup; myMembership?: CommunityMembership | null }>(
      `/api/communities/${communityId}`
    );
    if (res.error || !res.data) throw new Error(res.error || 'Failed to load group details');
    return res.data;
  },

  async updateGroup(
    communityId: string,
    patch: {
      name?: string;
      description?: string;
      approximateLocality?: string;
      organizationOrBuildingName?: string | null;
      membershipPolicy?: CommunityMembershipPolicy;
      moderationPolicy?: CommunityModerationPolicy;
      status?: 'active' | 'closed' | 'suspended';
    }
  ): Promise<CommunityGroup> {
    const res = await apiClient.patch<{ success: boolean; group: CommunityGroup }>(
      `/api/communities/${communityId}`,
      patch
    );
    if (res.error || !res.data) throw new Error(res.error || 'Failed to update group');
    return res.data.group;
  },

  // Members & Invitations
  async listMembers(communityId: string): Promise<CommunityMembership[]> {
    const res = await apiClient.get<{ success: boolean; members: CommunityMembership[] }>(
      `/api/communities/${communityId}/members`
    );
    if (res.error || !res.data) throw new Error(res.error || 'Failed to list members');
    return res.data.members;
  },

  async inviteMember(communityId: string, email: string): Promise<CommunityInvitation> {
    const res = await apiClient.post<{ success: boolean; invitation: CommunityInvitation }>(
      `/api/communities/${communityId}/invitations`,
      { email }
    );
    if (res.error || !res.data) throw new Error(res.error || 'Failed to send invitation');
    return res.data.invitation;
  },

  async listGroupInvitations(communityId: string): Promise<CommunityInvitation[]> {
    const res = await apiClient.get<{ success: boolean; invitations: CommunityInvitation[] }>(
      `/api/communities/${communityId}/invitations`
    );
    if (res.error || !res.data) throw new Error(res.error || 'Failed to list group invitations');
    return res.data.invitations;
  },

  async listMyInvitations(): Promise<CommunityInvitation[]> {
    const res = await apiClient.get<{ success: boolean; invitations: CommunityInvitation[] }>(
      '/api/communities/invitations/my'
    );
    if (res.error || !res.data) throw new Error(res.error || 'Failed to list personal invitations');
    return res.data.invitations;
  },

  async acceptInvitation(inviteCode: string): Promise<CommunityMembership> {
    const res = await apiClient.post<{ success: boolean; membership: CommunityMembership }>(
      `/api/communities/invitations/${inviteCode}/accept`,
      {}
    );
    if (res.error || !res.data) throw new Error(res.error || 'Failed to accept invitation');
    return res.data.membership;
  },

  async declineInvitation(inviteCode: string): Promise<CommunityInvitation> {
    const res = await apiClient.post<{ success: boolean; invitation: CommunityInvitation }>(
      `/api/communities/invitations/${inviteCode}/decline`,
      {}
    );
    if (res.error || !res.data) throw new Error(res.error || 'Failed to decline invitation');
    return res.data.invitation;
  },

  async requestJoin(
    communityId: string,
    notes?: string
  ): Promise<{ membership?: CommunityMembership; joinRequest?: CommunityJoinRequest }> {
    const res = await apiClient.post<{ success: boolean; membership?: CommunityMembership; joinRequest?: CommunityJoinRequest }>(
      `/api/communities/${communityId}/join`,
      { notes }
    );
    if (res.error || !res.data) throw new Error(res.error || 'Failed to request membership');
    return res.data;
  },

  async listJoinRequests(communityId: string, status?: string): Promise<CommunityJoinRequest[]> {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    const res = await apiClient.get<{ success: boolean; requests: CommunityJoinRequest[] }>(
      `/api/communities/${communityId}/join-requests${query}`
    );
    if (res.error || !res.data) throw new Error(res.error || 'Failed to list join requests');
    return res.data.requests;
  },

  async reviewJoinRequest(
    communityId: string,
    requestId: string,
    action: 'approve' | 'reject'
  ): Promise<CommunityJoinRequest> {
    const res = await apiClient.post<{ success: boolean; request: CommunityJoinRequest }>(
      `/api/communities/${communityId}/join-requests/${requestId}/review`,
      { action }
    );
    if (res.error || !res.data) throw new Error(res.error || 'Failed to review join request');
    return res.data.request;
  },

  async leaveGroup(communityId: string): Promise<CommunityMembership> {
    const res = await apiClient.post<{ success: boolean; membership: CommunityMembership }>(
      `/api/communities/${communityId}/leave`,
      {}
    );
    if (res.error || !res.data) throw new Error(res.error || 'Failed to leave community');
    return res.data.membership;
  },

  async updateMemberRole(
    communityId: string,
    targetUserId: string,
    role: 'moderator' | 'member'
  ): Promise<CommunityMembership> {
    const res = await apiClient.patch<{ success: boolean; membership: CommunityMembership }>(
      `/api/communities/${communityId}/members/${targetUserId}/role`,
      { role }
    );
    if (res.error || !res.data) throw new Error(res.error || 'Failed to update member role');
    return res.data.membership;
  },

  async removeMember(communityId: string, targetUserId: string): Promise<CommunityMembership> {
    const res = await apiClient.delete<{ success: boolean; membership: CommunityMembership }>(
      `/api/communities/${communityId}/members/${targetUserId}`
    );
    if (res.error || !res.data) throw new Error(res.error || 'Failed to remove member');
    return res.data.membership;
  },

  // Assistance Requests
  async createAssistanceRequest(
    communityId: string,
    input: {
      requestCategory: AssistanceCategory;
      title: string;
      description: string;
      priority?: AssistancePriority;
      intendedRecipientName?: string | null;
      approximateLocality: string;
      preferredDateTime?: string | null;
      expiryHours?: number;
      contactSharingConsent?: boolean;
      contactPhone?: string | null;
      contactAddress?: string | null;
    }
  ): Promise<AssistanceRequest> {
    const res = await apiClient.post<{ success: boolean; request: AssistanceRequest }>(
      `/api/communities/${communityId}/assistance`,
      input
    );
    if (res.error || !res.data) throw new Error(res.error || 'Failed to create assistance request');
    return res.data.request;
  },

  async listAssistanceRequests(
    communityId: string,
    filter?: { category?: string; status?: string }
  ): Promise<AssistanceRequest[]> {
    const params = new URLSearchParams();
    if (filter?.category) params.set('category', filter.category);
    if (filter?.status) params.set('status', filter.status);
    const query = params.toString() ? `?${params.toString()}` : '';

    const res = await apiClient.get<{ success: boolean; requests: AssistanceRequest[] }>(
      `/api/communities/${communityId}/assistance${query}`
    );
    if (res.error || !res.data) throw new Error(res.error || 'Failed to list assistance requests');
    return res.data.requests;
  },

  async getAssistanceRequest(
    communityId: string,
    requestId: string
  ): Promise<{ request: AssistanceRequest; isAssignedVolunteer: boolean; isCreator: boolean }> {
    const res = await apiClient.get<{
      success: boolean;
      request: AssistanceRequest;
      isAssignedVolunteer: boolean;
      isCreator: boolean;
    }>(`/api/communities/${communityId}/assistance/${requestId}`);
    if (res.error || !res.data) throw new Error(res.error || 'Failed to load assistance request');
    return res.data;
  },

  async expressVolunteerInterest(
    communityId: string,
    requestId: string,
    notes?: string
  ): Promise<AssistanceAssignment> {
    const res = await apiClient.post<{ success: boolean; assignment: AssistanceAssignment }>(
      `/api/communities/${communityId}/assistance/${requestId}/volunteer`,
      { notes }
    );
    if (res.error || !res.data) throw new Error(res.error || 'Failed to express volunteer interest');
    return res.data.assignment;
  },

  async listVolunteersForRequest(communityId: string, requestId: string): Promise<AssistanceAssignment[]> {
    const res = await apiClient.get<{ success: boolean; volunteers: AssistanceAssignment[] }>(
      `/api/communities/${communityId}/assistance/${requestId}/volunteers`
    );
    if (res.error || !res.data) throw new Error(res.error || 'Failed to list volunteers');
    return res.data.volunteers;
  },

  async assignVolunteer(
    communityId: string,
    requestId: string,
    volunteerUserId: string
  ): Promise<{ request: AssistanceRequest; assignment: AssistanceAssignment; contactGrant?: ContactSharingGrant }> {
    const res = await apiClient.post<{
      success: boolean;
      request: AssistanceRequest;
      assignment: AssistanceAssignment;
      contactGrant?: ContactSharingGrant;
    }>(`/api/communities/${communityId}/assistance/${requestId}/assign`, { volunteerUserId });
    if (res.error || !res.data) throw new Error(res.error || 'Failed to assign volunteer');
    return res.data;
  },

  async updateAssistanceStatus(
    communityId: string,
    requestId: string,
    status: 'open' | 'in_progress' | 'completed' | 'cancelled'
  ): Promise<AssistanceRequest> {
    const res = await apiClient.patch<{ success: boolean; request: AssistanceRequest }>(
      `/api/communities/${communityId}/assistance/${requestId}/status`,
      { status }
    );
    if (res.error || !res.data) throw new Error(res.error || 'Failed to update assistance status');
    return res.data.request;
  },

  // Blood Donor Requests
  async createBloodDonorRequest(
    communityId: string,
    input: {
      bloodGroup: BloodGroup;
      unitsNeeded?: number;
      approximateLocality: string;
      hospitalName?: string | null;
      requestedDateTime?: string | null;
      notes?: string | null;
      expiryHours?: number;
      contactPhone?: string | null;
      contactSharingConsent?: boolean;
    }
  ): Promise<{ request: BloodDonorRequest; disclaimer: string }> {
    const res = await apiClient.post<{ success: boolean; request: BloodDonorRequest; disclaimer: string }>(
      `/api/communities/${communityId}/blood-donors`,
      input
    );
    if (res.error || !res.data) throw new Error(res.error || 'Failed to create blood donor request');
    return res.data;
  },

  async listBloodDonorRequests(
    communityId: string,
    filter?: { bloodGroup?: string; status?: string }
  ): Promise<BloodDonorRequest[]> {
    const params = new URLSearchParams();
    if (filter?.bloodGroup) params.set('bloodGroup', filter.bloodGroup);
    if (filter?.status) params.set('status', filter.status);
    const query = params.toString() ? `?${params.toString()}` : '';

    const res = await apiClient.get<{ success: boolean; requests: BloodDonorRequest[] }>(
      `/api/communities/${communityId}/blood-donors${query}`
    );
    if (res.error || !res.data) throw new Error(res.error || 'Failed to list blood donor requests');
    return res.data.requests;
  },

  async getBloodDonorRequest(
    communityId: string,
    requestId: string
  ): Promise<{ request: BloodDonorRequest; isCreator: boolean }> {
    const res = await apiClient.get<{ success: boolean; request: BloodDonorRequest; isCreator: boolean }>(
      `/api/communities/${communityId}/blood-donors/${requestId}`
    );
    if (res.error || !res.data) throw new Error(res.error || 'Failed to load blood donor request');
    return res.data;
  },

  async expressDonorInterest(
    communityId: string,
    requestId: string,
    input: { bloodGroup: BloodGroup; notes?: string | null }
  ): Promise<{ response: DonorResponse; disclaimer: string }> {
    const res = await apiClient.post<{ success: boolean; response: DonorResponse; disclaimer: string }>(
      `/api/communities/${communityId}/blood-donors/${requestId}/respond`,
      input
    );
    if (res.error || !res.data) throw new Error(res.error || 'Failed to express donor interest');
    return res.data;
  },

  async listDonorResponses(communityId: string, requestId: string): Promise<DonorResponse[]> {
    const res = await apiClient.get<{ success: boolean; responses: DonorResponse[] }>(
      `/api/communities/${communityId}/blood-donors/${requestId}/responses`
    );
    if (res.error || !res.data) throw new Error(res.error || 'Failed to list donor responses');
    return res.data.responses;
  },

  async updateDonorResponseStatus(
    communityId: string,
    requestId: string,
    donorUserId: string,
    status: 'interested' | 'contacted' | 'unavailable' | 'referred_to_screening',
    notes?: string
  ): Promise<DonorResponse> {
    const res = await apiClient.patch<{ success: boolean; response: DonorResponse }>(
      `/api/communities/${communityId}/blood-donors/${requestId}/responses/${donorUserId}`,
      { status, notes }
    );
    if (res.error || !res.data) throw new Error(res.error || 'Failed to update donor status');
    return res.data.response;
  },

  async closeBloodDonorRequest(
    communityId: string,
    requestId: string,
    status: 'fulfilled' | 'cancelled'
  ): Promise<BloodDonorRequest> {
    const res = await apiClient.post<{ success: boolean; request: BloodDonorRequest }>(
      `/api/communities/${communityId}/blood-donors/${requestId}/close`,
      { status }
    );
    if (res.error || !res.data) throw new Error(res.error || 'Failed to close blood donor request');
    return res.data.request;
  },

  // Moderation
  async submitReport(
    communityId: string,
    input: {
      targetType: 'assistance_request' | 'blood_donor_request' | 'member';
      targetId: string;
      reasonCategory: string;
      details: string;
    }
  ): Promise<CommunityReport> {
    const res = await apiClient.post<{ success: boolean; report: CommunityReport }>(
      `/api/communities/${communityId}/reports`,
      input
    );
    if (res.error || !res.data) throw new Error(res.error || 'Failed to submit report');
    return res.data.report;
  },

  async listReports(communityId: string, status?: string): Promise<CommunityReport[]> {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    const res = await apiClient.get<{ success: boolean; reports: CommunityReport[] }>(
      `/api/communities/${communityId}/reports${query}`
    );
    if (res.error || !res.data) throw new Error(res.error || 'Failed to list reports');
    return res.data.reports;
  },

  async resolveReport(
    communityId: string,
    reportId: string,
    input: {
      status: 'under_review' | 'action_required' | 'resolved' | 'dismissed';
      decisionNotes?: string | null;
      actionTaken?: 'content_hidden' | 'member_warned' | 'member_suspended' | 'member_removed' | 'dismissed';
    }
  ): Promise<{ report: CommunityReport; action?: ModerationAction }> {
    const res = await apiClient.post<{ success: boolean; report: CommunityReport; action?: ModerationAction }>(
      `/api/communities/${communityId}/reports/${reportId}/resolve`,
      input
    );
    if (res.error || !res.data) throw new Error(res.error || 'Failed to resolve report');
    return res.data;
  },

  async listModerationActions(communityId: string): Promise<ModerationAction[]> {
    const res = await apiClient.get<{ success: boolean; actions: ModerationAction[] }>(
      `/api/communities/${communityId}/moderation-actions`
    );
    if (res.error || !res.data) throw new Error(res.error || 'Failed to list moderation actions');
    return res.data.actions;
  },
};

export const communityApiService = communityService;
