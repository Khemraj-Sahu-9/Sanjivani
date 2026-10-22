/**
 * backend/src/services/communityService.ts
 *
 * Core domain service for Phase 8:
 * - Residential society, apartment & neighborhood group management.
 * - Community memberships, secure invitations, and join requests.
 * - Non-emergency elderly assistance request coordination & volunteer assignments.
 * - Blood donor requests and interest logging with medical disclaimers.
 * - Privacy-first contact sharing grants & location anonymization.
 * - Community moderation, abuse reporting, and audit trails.
 */

import crypto from 'crypto';
import { db } from '../repositories/database.js';
import { logger } from '../config/logger.js';
import { createError } from '../middlewares/errorHandler.js';
import { NotificationService } from './notificationService.js';
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
} from '../types/models.js';

export class CommunityService {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  // ---------------------------------------------------------------------------
  // Authorization Helpers
  // ---------------------------------------------------------------------------
  async requireMembership(communityId: string, userId: string): Promise<CommunityMembership> {
    const mem = await db.getCommunityMembership(communityId, userId);
    if (!mem || mem.status !== 'active') {
      throw createError('Access denied: Active community membership required', 403);
    }
    return mem;
  }

  async requireModeratorOrOwner(communityId: string, userId: string): Promise<CommunityMembership> {
    const mem = await this.requireMembership(communityId, userId);
    if (mem.role !== 'owner' && mem.role !== 'moderator') {
      throw createError('Access denied: Community moderator or owner privileges required', 403);
    }
    return mem;
  }

  async requireOwner(communityId: string, userId: string): Promise<CommunityMembership> {
    const mem = await this.requireMembership(communityId, userId);
    if (mem.role !== 'owner') {
      throw createError('Access denied: Community owner privileges required', 403);
    }
    return mem;
  }

  // ---------------------------------------------------------------------------
  // Feature A: Group Management
  // ---------------------------------------------------------------------------
  async createGroup(
    userId: string,
    input: {
      name: string;
      groupType: CommunityGroupType;
      description: string;
      approximateLocality: string;
      organizationOrBuildingName?: string | null;
      membershipPolicy?: CommunityMembershipPolicy;
      moderationPolicy?: CommunityModerationPolicy;
    }
  ): Promise<{ group: CommunityGroup; membership: CommunityMembership }> {
    const group = await db.createCommunityGroup({
      name: input.name,
      group_type: input.groupType,
      description: input.description,
      approximate_locality: input.approximateLocality,
      organization_or_building_name: input.organizationOrBuildingName || null,
      creator_user_id: userId,
      membership_policy: input.membershipPolicy || 'open',
      moderation_policy: input.moderationPolicy || 'standard',
      status: 'active',
    });

    // Creator is automatically registered as the Owner
    const membership = await db.createCommunityMembership({
      community_id: group.id,
      user_id: userId,
      role: 'owner',
      status: 'active',
    });

    logger.info(`[Community] Group created: "${group.name}" (${group.id}) by owner ${userId}`);
    return { group, membership };
  }

  async getGroup(communityId: string, userId?: string): Promise<{ group: CommunityGroup; myMembership?: CommunityMembership | null }> {
    const group = await db.getCommunityGroupById(communityId);
    if (!group) throw createError('Community group not found', 404);

    let myMembership: CommunityMembership | null = null;
    if (userId) {
      myMembership = await db.getCommunityMembership(communityId, userId);
    }

    return { group, myMembership };
  }

  async listMyGroups(userId: string): Promise<CommunityGroup[]> {
    return db.listCommunityGroupsForUser(userId);
  }

  async listPublicGroups(locality?: string): Promise<CommunityGroup[]> {
    return db.listPublicCommunityGroups(locality);
  }

  async updateGroup(
    communityId: string,
    userId: string,
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
    await this.requireOwner(communityId, userId);

    const updatePayload: Partial<CommunityGroup> = {};
    if (patch.name) updatePayload.name = patch.name;
    if (patch.description) updatePayload.description = patch.description;
    if (patch.approximateLocality) updatePayload.approximate_locality = patch.approximateLocality;
    if (patch.organizationOrBuildingName !== undefined) updatePayload.organization_or_building_name = patch.organizationOrBuildingName;
    if (patch.membershipPolicy) updatePayload.membership_policy = patch.membershipPolicy;
    if (patch.moderationPolicy) updatePayload.moderation_policy = patch.moderationPolicy;
    if (patch.status) updatePayload.status = patch.status;

    return db.updateCommunityGroup(communityId, updatePayload);
  }

  // ---------------------------------------------------------------------------
  // Feature B: Memberships, Invitations & Join Requests
  // ---------------------------------------------------------------------------
  async listMembers(communityId: string, userId: string): Promise<CommunityMembership[]> {
    await this.requireMembership(communityId, userId);
    return db.listCommunityMemberships(communityId);
  }

  async inviteMember(
    communityId: string,
    inviterUserId: string,
    inviteeEmail: string
  ): Promise<CommunityInvitation> {
    await this.requireModeratorOrOwner(communityId, inviterUserId);
    const group = await db.getCommunityGroupById(communityId);
    if (!group) throw createError('Community group not found', 404);

    const inviteCode = crypto.randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    const invitation = await db.createCommunityInvitation({
      community_id: communityId,
      inviter_user_id: inviterUserId,
      invitee_email: inviteeEmail.toLowerCase().trim(),
      invite_code: inviteCode,
      status: 'pending',
      expires_at: expiresAt,
      accepted_at: null,
    });

    // Notify registered user if email matches
    const targetProfile = await db.findProfileByEmail(inviteeEmail);
    if (targetProfile) {
      await this.notificationService.sendNotification({
        communityId,
        recipientUserId: targetProfile.id,
        category: 'community_invitation',
        title: 'Community Group Invitation',
        message: `You have been invited to join "${group.name}".`,
        detailsPayload: { communityId, inviteCode, groupName: group.name },
      });
    }

    logger.info(`[Community] Invitation created for ${inviteeEmail} to group ${communityId}`);
    return invitation;
  }

  async listInvitationsForGroup(communityId: string, userId: string): Promise<CommunityInvitation[]> {
    await this.requireModeratorOrOwner(communityId, userId);
    return db.listCommunityInvitationsForGroup(communityId);
  }

  async listMyInvitations(userEmail: string): Promise<CommunityInvitation[]> {
    return db.listCommunityInvitationsForUser(userEmail);
  }

  async acceptInvitation(
    inviteCode: string,
    userId: string,
    userEmail: string
  ): Promise<CommunityMembership> {
    const invite = await db.getCommunityInvitationByCode(inviteCode);
    if (!invite) throw createError('Invalid invitation code', 404);
    if (invite.status !== 'pending') throw createError(`Invitation is already ${invite.status}`, 400);
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      await db.updateCommunityInvitation(invite.id, { status: 'expired' });
      throw createError('Invitation has expired', 400);
    }
    if (invite.invitee_email.toLowerCase().trim() !== userEmail.toLowerCase().trim()) {
      throw createError('Invitation email does not match authenticated user account', 403);
    }

    // Check existing membership
    const existing = await db.getCommunityMembership(invite.community_id, userId);
    let membership: CommunityMembership;
    if (existing) {
      if (existing.status === 'active') {
        throw createError('You are already an active member of this community', 400);
      }
      membership = await db.updateCommunityMembership(existing.id, {
        status: 'active',
        role: existing.role || 'member',
      });
    } else {
      membership = await db.createCommunityMembership({
        community_id: invite.community_id,
        user_id: userId,
        role: 'member',
        status: 'active',
      });
    }

    await db.updateCommunityInvitation(invite.id, {
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    });

    logger.info(`[Community] User ${userId} accepted invitation for community ${invite.community_id}`);
    return membership;
  }

  async declineInvitation(inviteCode: string, userEmail: string): Promise<CommunityInvitation> {
    const invite = await db.getCommunityInvitationByCode(inviteCode);
    if (!invite) throw createError('Invalid invitation code', 404);
    if (invite.status !== 'pending') throw createError(`Invitation is already ${invite.status}`, 400);
    if (invite.invitee_email.toLowerCase().trim() !== userEmail.toLowerCase().trim()) {
      throw createError('Invitation email does not match authenticated user', 403);
    }

    return db.updateCommunityInvitation(invite.id, { status: 'declined' });
  }

  async requestJoin(
    communityId: string,
    userId: string,
    notes?: string
  ): Promise<{ membership?: CommunityMembership; joinRequest?: CommunityJoinRequest }> {
    const group = await db.getCommunityGroupById(communityId);
    if (!group) throw createError('Community group not found', 404);
    if (group.status !== 'active') throw createError('Community group is closed or suspended', 400);

    const existingMem = await db.getCommunityMembership(communityId, userId);
    if (existingMem && existingMem.status === 'active') {
      throw createError('You are already an active member of this community', 400);
    }

    if (group.membership_policy === 'invite_only') {
      throw createError('This community is invite-only. Please request an invitation code from a group administrator.', 403);
    }

    if (group.membership_policy === 'open') {
      let membership: CommunityMembership;
      if (existingMem) {
        membership = await db.updateCommunityMembership(existingMem.id, { status: 'active' });
      } else {
        membership = await db.createCommunityMembership({
          community_id: communityId,
          user_id: userId,
          role: 'member',
          status: 'active',
        });
      }
      logger.info(`[Community] User ${userId} joined open group ${communityId}`);
      return { membership };
    }

    // approval_required policy:
    const joinReq = await db.createCommunityJoinRequest({
      community_id: communityId,
      user_id: userId,
      notes: notes || null,
      status: 'pending',
      reviewed_by: null,
      reviewed_at: null,
    });

    // Notify owner
    await this.notificationService.sendNotification({
      communityId,
      recipientUserId: group.creator_user_id,
      category: 'community_join_decision',
      title: 'Community Join Request',
      message: `A new member has requested to join "${group.name}".`,
      detailsPayload: { communityId, joinRequestId: joinReq.id, applicantUserId: userId },
    });

    logger.info(`[Community] User ${userId} submitted join request for group ${communityId}`);
    return { joinRequest: joinReq };
  }

  async listJoinRequests(communityId: string, userId: string, status?: string): Promise<CommunityJoinRequest[]> {
    await this.requireModeratorOrOwner(communityId, userId);
    return db.listCommunityJoinRequests(communityId, status);
  }

  async reviewJoinRequest(
    communityId: string,
    requestId: string,
    reviewerUserId: string,
    action: 'approve' | 'reject'
  ): Promise<CommunityJoinRequest> {
    await this.requireModeratorOrOwner(communityId, reviewerUserId);

    const req = await db.getCommunityJoinRequestById(requestId);
    if (!req || req.community_id !== communityId) throw createError('Join request not found', 404);
    if (req.status !== 'pending') throw createError(`Join request is already ${req.status}`, 400);

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const updated = await db.updateCommunityJoinRequest(requestId, {
      status: newStatus,
      reviewed_by: reviewerUserId,
      reviewed_at: new Date().toISOString(),
    });

    if (action === 'approve') {
      const existing = await db.getCommunityMembership(communityId, req.user_id);
      if (existing) {
        await db.updateCommunityMembership(existing.id, { status: 'active', role: 'member' });
      } else {
        await db.createCommunityMembership({
          community_id: communityId,
          user_id: req.user_id,
          role: 'member',
          status: 'active',
        });
      }
    }

    const group = await db.getCommunityGroupById(communityId);
    await this.notificationService.sendNotification({
      communityId,
      recipientUserId: req.user_id,
      category: 'community_join_decision',
      title: action === 'approve' ? 'Community Request Approved' : 'Community Request Update',
      message:
        action === 'approve'
          ? `Your request to join "${group?.name || 'the community'}" has been approved!`
          : `Your request to join "${group?.name || 'the community'}" was declined by an administrator.`,
      detailsPayload: { communityId, action },
    });

    return updated;
  }

  async leaveGroup(communityId: string, userId: string): Promise<CommunityMembership> {
    const mem = await this.requireMembership(communityId, userId);
    if (mem.role === 'owner') {
      const members = await db.listCommunityMemberships(communityId);
      const otherOwners = members.filter((m) => m.role === 'owner' && m.user_id !== userId);
      if (otherOwners.length === 0) {
        throw createError('As the sole owner, you must assign another owner before leaving or close the group.', 400);
      }
    }

    return db.updateCommunityMembership(mem.id, { status: 'left' });
  }

  async updateMemberRole(
    communityId: string,
    ownerUserId: string,
    targetUserId: string,
    newRole: 'moderator' | 'member'
  ): Promise<CommunityMembership> {
    await this.requireOwner(communityId, ownerUserId);
    const targetMem = await db.getCommunityMembership(communityId, targetUserId);
    if (!targetMem || targetMem.status !== 'active') throw createError('Target user is not an active member', 404);
    if (targetMem.role === 'owner') throw createError('Cannot change the role of a group owner', 400);

    return db.updateCommunityMembership(targetMem.id, { role: newRole });
  }

  async removeMember(
    communityId: string,
    actingUserId: string,
    targetUserId: string
  ): Promise<CommunityMembership> {
    const actingMem = await this.requireModeratorOrOwner(communityId, actingUserId);
    const targetMem = await db.getCommunityMembership(communityId, targetUserId);
    if (!targetMem) throw createError('Member not found', 404);
    if (targetMem.role === 'owner') throw createError('Cannot remove a community group owner', 400);
    if (actingMem.role === 'moderator' && targetMem.role === 'moderator') {
      throw createError('Moderators cannot remove other moderators. Group owner required.', 403);
    }

    return db.updateCommunityMembership(targetMem.id, { status: 'removed' });
  }

  // ---------------------------------------------------------------------------
  // Feature D: Non-Emergency Elderly Assistance Requests
  // ---------------------------------------------------------------------------
  async createAssistanceRequest(
    communityId: string,
    creatorUserId: string,
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
    await this.requireMembership(communityId, creatorUserId);

    const expiryHours = input.expiryHours || 72;
    const expiryTime = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();

    const request = await db.createAssistanceRequest({
      community_id: communityId,
      request_category: input.requestCategory,
      title: input.title,
      description: input.description,
      priority: input.priority || 'medium',
      creator_user_id: creatorUserId,
      intended_recipient_name: input.intendedRecipientName || null,
      approximate_locality: input.approximateLocality,
      preferred_date_time: input.preferredDateTime || null,
      expiry_time: expiryTime,
      status: 'open',
      assigned_volunteer_user_id: null,
      contact_sharing_consent: Boolean(input.contactSharingConsent),
      contact_phone: input.contactPhone || null,
      contact_address: input.contactAddress || null,
    });

    logger.info(`[Community] Assistance request ${request.id} created in group ${communityId}`);
    return request;
  }

  async listAssistanceRequests(
    communityId: string,
    userId: string,
    filter?: { category?: string; status?: string }
  ): Promise<AssistanceRequest[]> {
    await this.requireMembership(communityId, userId);
    const requests = await db.listAssistanceRequests(communityId, filter);

    // Apply strict privacy masking: only creator or explicitly assigned volunteer sees contact details
    return requests.map((req) => this.maskAssistanceRequest(req, userId));
  }

  async getAssistanceRequest(
    communityId: string,
    requestId: string,
    userId: string
  ): Promise<{ request: AssistanceRequest; isAssignedVolunteer: boolean; isCreator: boolean }> {
    await this.requireMembership(communityId, userId);
    const req = await db.getAssistanceRequestById(requestId);
    if (!req || req.community_id !== communityId) throw createError('Assistance request not found', 404);

    const isCreator = req.creator_user_id === userId;
    const isAssignedVolunteer = req.assigned_volunteer_user_id === userId;

    return {
      request: this.maskAssistanceRequest(req, userId),
      isAssignedVolunteer,
      isCreator,
    };
  }

  private maskAssistanceRequest(req: AssistanceRequest, viewingUserId: string): AssistanceRequest {
    const isAuthorized = req.creator_user_id === viewingUserId || req.assigned_volunteer_user_id === viewingUserId;
    if (isAuthorized) return req;

    return {
      ...req,
      contact_phone: null,
      contact_address: null,
    };
  }

  // ---------------------------------------------------------------------------
  // Feature E: Volunteer Coordination & Assignments
  // ---------------------------------------------------------------------------
  async expressVolunteerInterest(
    communityId: string,
    requestId: string,
    volunteerUserId: string,
    notes?: string
  ): Promise<AssistanceAssignment> {
    await this.requireMembership(communityId, volunteerUserId);
    const req = await db.getAssistanceRequestById(requestId);
    if (!req || req.community_id !== communityId) throw createError('Assistance request not found', 404);

    if (req.creator_user_id === volunteerUserId) {
      throw createError('You cannot volunteer for your own assistance request', 400);
    }
    if (req.status === 'cancelled' || req.status === 'completed' || req.status === 'expired') {
      throw createError(`Cannot volunteer: request is already ${req.status}`, 400);
    }
    if (new Date(req.expiry_time).getTime() < Date.now()) {
      await db.updateAssistanceRequest(req.id, { status: 'expired' });
      throw createError('Cannot volunteer: request has expired', 400);
    }

    const existingAssign = await db.getAssistanceAssignment(requestId, volunteerUserId);
    if (existingAssign) {
      if (existingAssign.status === 'interested' || existingAssign.status === 'assigned') {
        throw createError('You have already expressed interest or are assigned to this request', 400);
      }
      const updated = await db.updateAssistanceAssignment(existingAssign.id, {
        status: 'interested',
        notes: notes || null,
      });
      return updated;
    }

    const assignment = await db.createAssistanceAssignment({
      request_id: requestId,
      volunteer_user_id: volunteerUserId,
      status: 'interested',
      notes: notes || null,
    });

    if (req.status === 'open') {
      await db.updateAssistanceRequest(requestId, { status: 'interest_received' });
    }

    // Notify requester
    await this.notificationService.sendNotification({
      communityId,
      recipientUserId: req.creator_user_id,
      category: 'volunteer_interest_or_assignment',
      title: 'Volunteer Interest Received',
      message: `A community member has volunteered to assist with "${req.title}".`,
      detailsPayload: { requestId, volunteerUserId },
    });

    logger.info(`[Community] Volunteer ${volunteerUserId} expressed interest in request ${requestId}`);
    return assignment;
  }

  async listVolunteersForRequest(
    communityId: string,
    requestId: string,
    userId: string
  ): Promise<AssistanceAssignment[]> {
    await this.requireMembership(communityId, userId);
    const req = await db.getAssistanceRequestById(requestId);
    if (!req || req.community_id !== communityId) throw createError('Assistance request not found', 404);

    return db.listAssistanceAssignments(requestId);
  }

  async assignVolunteer(
    communityId: string,
    requestId: string,
    assignerUserId: string,
    volunteerUserId: string
  ): Promise<{ request: AssistanceRequest; assignment: AssistanceAssignment; contactGrant?: ContactSharingGrant }> {
    await this.requireMembership(communityId, assignerUserId);
    const req = await db.getAssistanceRequestById(requestId);
    if (!req || req.community_id !== communityId) throw createError('Assistance request not found', 404);

    const isCreator = req.creator_user_id === assignerUserId;
    if (!isCreator) {
      await this.requireModeratorOrOwner(communityId, assignerUserId);
    }

    if (req.status === 'completed' || req.status === 'cancelled' || req.status === 'expired') {
      throw createError(`Cannot assign volunteer: request is already ${req.status}`, 400);
    }

    // Verify volunteer interest
    let assignment = await db.getAssistanceAssignment(requestId, volunteerUserId);
    if (!assignment) {
      assignment = await db.createAssistanceAssignment({
        request_id: requestId,
        volunteer_user_id: volunteerUserId,
        status: 'assigned',
        notes: 'Directly assigned by coordinator',
      });
    } else {
      assignment = await db.updateAssistanceAssignment(assignment.id, { status: 'assigned' });
    }

    const updatedReq = await db.updateAssistanceRequest(requestId, {
      assigned_volunteer_user_id: volunteerUserId,
      status: 'assigned',
    });

    // Create explicit contact grant if phone sharing consent was provided
    let contactGrant: ContactSharingGrant | undefined;
    if (req.contact_sharing_consent && req.contact_phone) {
      contactGrant = await db.createContactGrant({
        resource_type: 'assistance_request',
        resource_id: requestId,
        granted_by_user_id: req.creator_user_id,
        granted_to_user_id: volunteerUserId,
        contact_phone: req.contact_phone,
        contact_address: req.contact_address || null,
        contact_notes: 'Granted for community assistance coordination',
        status: 'active',
        expires_at: req.expiry_time,
      });
    }

    // Notify volunteer
    await this.notificationService.sendNotification({
      communityId,
      recipientUserId: volunteerUserId,
      category: 'volunteer_interest_or_assignment',
      title: 'Volunteer Assignment Confirmed',
      message: `You have been confirmed as the volunteer for "${req.title}". Contact details are now accessible.`,
      detailsPayload: { requestId, assignedBy: assignerUserId },
    });

    logger.info(`[Community] Volunteer ${volunteerUserId} assigned to request ${requestId}`);
    return { request: updatedReq, assignment, contactGrant };
  }

  async updateAssistanceStatus(
    communityId: string,
    requestId: string,
    userId: string,
    status: 'open' | 'in_progress' | 'completed' | 'cancelled'
  ): Promise<AssistanceRequest> {
    await this.requireMembership(communityId, userId);
    const req = await db.getAssistanceRequestById(requestId);
    if (!req || req.community_id !== communityId) throw createError('Assistance request not found', 404);

    const isCreator = req.creator_user_id === userId;
    const isAssignedVolunteer = req.assigned_volunteer_user_id === userId;

    if (!isCreator && !isAssignedVolunteer) {
      await this.requireModeratorOrOwner(communityId, userId);
    }

    const updated = await db.updateAssistanceRequest(requestId, { status });

    // Revoke contact grants when request reaches terminal state
    if (status === 'completed' || status === 'cancelled') {
      const grants = await db.listContactGrants('assistance_request', requestId);
      for (const g of grants) {
        if (g.status === 'active') {
          await db.revokeContactGrant(g.id);
        }
      }
    }

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Feature F: Blood-Donor Requests & Donor Coordination
  // ---------------------------------------------------------------------------
  async createBloodDonorRequest(
    communityId: string,
    creatorUserId: string,
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
  ): Promise<BloodDonorRequest> {
    await this.requireMembership(communityId, creatorUserId);

    const expiryHours = input.expiryHours || 48;
    const expiryTime = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();

    const request = await db.createBloodDonorRequest({
      community_id: communityId,
      blood_group: input.bloodGroup,
      units_needed: input.unitsNeeded || 1,
      approximate_locality: input.approximateLocality,
      hospital_name: input.hospitalName || null,
      requested_date_time: input.requestedDateTime || null,
      creator_user_id: creatorUserId,
      notes: input.notes || null,
      status: 'open',
      expiry_time: expiryTime,
      contact_phone: input.contactPhone || null,
      contact_sharing_consent: Boolean(input.contactSharingConsent),
    });

    logger.info(`[Community] Blood donor request ${request.id} created for group ${communityId}`);
    return request;
  }

  async listBloodDonorRequests(
    communityId: string,
    userId: string,
    filter?: { bloodGroup?: string; status?: string }
  ): Promise<BloodDonorRequest[]> {
    await this.requireMembership(communityId, userId);
    const requests = await db.listBloodDonorRequests(communityId, filter);

    // Mask phone number for members other than the creator
    return requests.map((req) => (req.creator_user_id === userId ? req : { ...req, contact_phone: null }));
  }

  async getBloodDonorRequest(
    communityId: string,
    requestId: string,
    userId: string
  ): Promise<{ request: BloodDonorRequest; isCreator: boolean }> {
    await this.requireMembership(communityId, userId);
    const req = await db.getBloodDonorRequestById(requestId);
    if (!req || req.community_id !== communityId) throw createError('Blood donor request not found', 404);

    const isCreator = req.creator_user_id === userId;
    return {
      request: isCreator ? req : { ...req, contact_phone: null },
      isCreator,
    };
  }

  async expressDonorInterest(
    communityId: string,
    requestId: string,
    donorUserId: string,
    input: { bloodGroup: BloodGroup; notes?: string | null }
  ): Promise<DonorResponse> {
    await this.requireMembership(communityId, donorUserId);
    const req = await db.getBloodDonorRequestById(requestId);
    if (!req || req.community_id !== communityId) throw createError('Blood donor request not found', 404);

    if (req.creator_user_id === donorUserId) {
      throw createError('You cannot volunteer as a donor for your own request', 400);
    }
    if (req.status !== 'open') {
      throw createError(`Cannot register interest: request is ${req.status}`, 400);
    }
    if (new Date(req.expiry_time).getTime() < Date.now()) {
      await db.updateBloodDonorRequest(req.id, { status: 'expired' });
      throw createError('Cannot register interest: request has expired', 400);
    }

    const existing = await db.getDonorResponse(requestId, donorUserId);
    if (existing) {
      return db.updateDonorResponse(existing.id, {
        blood_group: input.bloodGroup,
        notes: input.notes || null,
        status: 'interested',
      });
    }

    const response = await db.createDonorResponse({
      request_id: requestId,
      donor_user_id: donorUserId,
      blood_group: input.bloodGroup,
      status: 'interested',
      notes: input.notes || null,
    });

    // Notify requester
    await this.notificationService.sendNotification({
      communityId,
      recipientUserId: req.creator_user_id,
      category: 'blood_donor_response',
      title: 'Potential Blood Donor Registered',
      message: `A community member with blood group ${input.bloodGroup} expressed willingness to be contacted.`,
      detailsPayload: { requestId, donorUserId, bloodGroup: input.bloodGroup },
    });

    return response;
  }

  async listDonorResponses(
    communityId: string,
    requestId: string,
    userId: string
  ): Promise<DonorResponse[]> {
    await this.requireMembership(communityId, userId);
    const req = await db.getBloodDonorRequestById(requestId);
    if (!req || req.community_id !== communityId) throw createError('Blood donor request not found', 404);

    return db.listDonorResponses(requestId);
  }

  async updateDonorResponseStatus(
    communityId: string,
    requestId: string,
    requesterUserId: string,
    donorUserId: string,
    status: 'interested' | 'contacted' | 'unavailable' | 'referred_to_screening',
    notes?: string
  ): Promise<DonorResponse> {
    await this.requireMembership(communityId, requesterUserId);
    const req = await db.getBloodDonorRequestById(requestId);
    if (!req || req.community_id !== communityId) throw createError('Blood donor request not found', 404);

    const isCreator = req.creator_user_id === requesterUserId;
    if (!isCreator) {
      await this.requireModeratorOrOwner(communityId, requesterUserId);
    }

    const response = await db.getDonorResponse(requestId, donorUserId);
    if (!response) throw createError('Donor response not found', 404);

    return db.updateDonorResponse(response.id, {
      status,
      notes: notes !== undefined ? notes : response.notes,
    });
  }

  async closeBloodDonorRequest(
    communityId: string,
    requestId: string,
    userId: string,
    status: 'fulfilled' | 'cancelled'
  ): Promise<BloodDonorRequest> {
    await this.requireMembership(communityId, userId);
    const req = await db.getBloodDonorRequestById(requestId);
    if (!req || req.community_id !== communityId) throw createError('Blood donor request not found', 404);

    const isCreator = req.creator_user_id === userId;
    if (!isCreator) {
      await this.requireModeratorOrOwner(communityId, userId);
    }

    return db.updateBloodDonorRequest(requestId, { status });
  }

  // ---------------------------------------------------------------------------
  // Feature I: Moderation & Abuse Reporting
  // ---------------------------------------------------------------------------
  async submitReport(
    communityId: string,
    reporterUserId: string,
    input: {
      targetType: 'assistance_request' | 'blood_donor_request' | 'member';
      targetId: string;
      reasonCategory:
        | 'suspicious'
        | 'spam'
        | 'harassment'
        | 'impersonation'
        | 'inappropriate_content'
        | 'unauthorized_phi'
        | 'fraud'
        | 'other';
      details: string;
    }
  ): Promise<CommunityReport> {
    await this.requireMembership(communityId, reporterUserId);

    const report = await db.createCommunityReport({
      community_id: communityId,
      reporter_user_id: reporterUserId,
      target_type: input.targetType,
      target_id: input.targetId,
      reason_category: input.reasonCategory,
      details: input.details,
      status: 'submitted',
      decision_notes: null,
      reviewed_by: null,
      reviewed_at: null,
    });

    // Notify moderators/owners
    const members = await db.listCommunityMemberships(communityId);
    const mods = members.filter((m) => m.role === 'owner' || m.role === 'moderator');
    for (const mod of mods) {
      await this.notificationService.sendNotification({
        communityId,
        recipientUserId: mod.user_id,
        category: 'community_report_submitted',
        title: 'New Moderation Report Submitted',
        message: `A report has been submitted regarding a ${input.targetType} in the community.`,
        detailsPayload: { reportId: report.id, reasonCategory: input.reasonCategory },
      });
    }

    logger.info(`[Community] Moderation report submitted in community ${communityId} by ${reporterUserId}`);
    return report;
  }

  async listReports(
    communityId: string,
    moderatorUserId: string,
    status?: string
  ): Promise<CommunityReport[]> {
    await this.requireModeratorOrOwner(communityId, moderatorUserId);
    return db.listCommunityReports(communityId, status);
  }

  async resolveReport(
    communityId: string,
    reportId: string,
    moderatorUserId: string,
    input: {
      status: 'under_review' | 'action_required' | 'resolved' | 'dismissed';
      decisionNotes?: string | null;
      actionTaken?: 'content_hidden' | 'member_warned' | 'member_suspended' | 'member_removed' | 'dismissed';
    }
  ): Promise<{ report: CommunityReport; action?: ModerationAction }> {
    await this.requireModeratorOrOwner(communityId, moderatorUserId);

    const report = await db.getCommunityReportById(reportId);
    if (!report || report.community_id !== communityId) throw createError('Report not found', 404);

    const updatedReport = await db.updateCommunityReport(reportId, {
      status: input.status,
      decision_notes: input.decisionNotes || null,
      reviewed_by: moderatorUserId,
      reviewed_at: new Date().toISOString(),
    });

    let action: ModerationAction | undefined;
    if (input.actionTaken && input.actionTaken !== 'dismissed') {
      action = await db.createModerationAction({
        report_id: reportId,
        community_id: communityId,
        moderator_user_id: moderatorUserId,
        action_taken: input.actionTaken,
        notes: input.decisionNotes || 'Action recorded by moderator',
      });

      // Apply content or member action
      if (input.actionTaken === 'content_hidden') {
        if (report.target_type === 'assistance_request') {
          await db.updateAssistanceRequest(report.target_id, { status: 'cancelled' });
        } else if (report.target_type === 'blood_donor_request') {
          await db.updateBloodDonorRequest(report.target_id, { status: 'cancelled' });
        }
      } else if (input.actionTaken === 'member_suspended' && report.target_type === 'member') {
        const mem = await db.getCommunityMembership(communityId, report.target_id);
        if (mem && mem.role !== 'owner') {
          await db.updateCommunityMembership(mem.id, { status: 'suspended' });
        }
      } else if (input.actionTaken === 'member_removed' && report.target_type === 'member') {
        const mem = await db.getCommunityMembership(communityId, report.target_id);
        if (mem && mem.role !== 'owner') {
          await db.updateCommunityMembership(mem.id, { status: 'removed' });
        }
      }
    }

    // Notify reporter that the report was reviewed
    await this.notificationService.sendNotification({
      communityId,
      recipientUserId: report.reporter_user_id,
      category: 'moderation_action',
      title: 'Community Report Update',
      message: `Your report has been reviewed and updated to status "${input.status}".`,
      detailsPayload: { reportId, status: input.status },
    });

    return { report: updatedReport, action };
  }

  async listModerationActions(communityId: string, moderatorUserId: string): Promise<ModerationAction[]> {
    await this.requireModeratorOrOwner(communityId, moderatorUserId);
    return db.listModerationActions(communityId);
  }
}
