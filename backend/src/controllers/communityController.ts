/**
 * backend/src/controllers/communityController.ts
 *
 * Thin request/response controller for Phase 8 Health Community & Assistance.
 * Performs request validation using Zod schemas and delegates to communityService.
 */

import { Request, Response, NextFunction } from 'express';
import { CommunityService } from '../services/communityService.js';
import {
  createCommunityGroupSchema,
  updateCommunityGroupSchema,
  inviteCommunityMemberSchema,
  joinCommunityRequestSchema,
  reviewJoinRequestSchema,
  updateCommunityMemberRoleSchema,
  createAssistanceRequestSchema,
  updateAssistanceStatusSchema,
  assignVolunteerSchema,
  createBloodDonorRequestSchema,
  createDonorResponseSchema,
  updateDonorResponseStatusSchema,
  createCommunityReportSchema,
  resolveCommunityReportSchema,
} from '../validators/schemas.js';

export const communityService = new CommunityService();

export class CommunityController {
  // ---------------------------------------------------------------------------
  // Groups
  // ---------------------------------------------------------------------------
  async createGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const validated = createCommunityGroupSchema.parse(req.body);
      const result = await communityService.createGroup(userId, validated);
      res.status(201).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async listMyGroups(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const groups = await communityService.listMyGroups(userId);
      res.status(200).json({ success: true, groups });
    } catch (err) {
      next(err);
    }
  }

  async listPublicGroups(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const locality = req.query.locality as string | undefined;
      const groups = await communityService.listPublicGroups(locality);
      res.status(200).json({ success: true, groups });
    } catch (err) {
      next(err);
    }
  }

  async getGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const communityId = req.params.communityId as string;
      const userId = req.user?.id;
      const result = await communityService.getGroup(communityId, userId);
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async updateGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const communityId = req.params.communityId as string;
      const userId = req.user!.id;
      const validated = updateCommunityGroupSchema.parse(req.body);
      const group = await communityService.updateGroup(communityId, userId, validated);
      res.status(200).json({ success: true, group });
    } catch (err) {
      next(err);
    }
  }

  // ---------------------------------------------------------------------------
  // Members & Invitations
  // ---------------------------------------------------------------------------
  async listMembers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const communityId = req.params.communityId as string;
      const userId = req.user!.id;
      const members = await communityService.listMembers(communityId, userId);
      res.status(200).json({ success: true, members });
    } catch (err) {
      next(err);
    }
  }

  async inviteMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const communityId = req.params.communityId as string;
      const userId = req.user!.id;
      const validated = inviteCommunityMemberSchema.parse(req.body);
      const invitation = await communityService.inviteMember(communityId, userId, validated.email);
      res.status(201).json({ success: true, invitation });
    } catch (err) {
      next(err);
    }
  }

  async listGroupInvitations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const communityId = req.params.communityId as string;
      const userId = req.user!.id;
      const invitations = await communityService.listInvitationsForGroup(communityId, userId);
      res.status(200).json({ success: true, invitations });
    } catch (err) {
      next(err);
    }
  }

  async listMyInvitations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const email = req.user!.email;
      const invitations = await communityService.listMyInvitations(email);
      res.status(200).json({ success: true, invitations });
    } catch (err) {
      next(err);
    }
  }

  async acceptInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const inviteCode = req.params.inviteCode as string;
      const userId = req.user!.id;
      const email = req.user!.email;
      const membership = await communityService.acceptInvitation(inviteCode, userId, email);
      res.status(200).json({ success: true, membership });
    } catch (err) {
      next(err);
    }
  }

  async declineInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const inviteCode = req.params.inviteCode as string;
      const email = req.user!.email;
      const invitation = await communityService.declineInvitation(inviteCode, email);
      res.status(200).json({ success: true, invitation });
    } catch (err) {
      next(err);
    }
  }

  async requestJoin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const communityId = req.params.communityId as string;
      const userId = req.user!.id;
      const validated = joinCommunityRequestSchema.parse(req.body);
      const result = await communityService.requestJoin(communityId, userId, validated.notes);
      res.status(201).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async listJoinRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const communityId = req.params.communityId as string;
      const userId = req.user!.id;
      const status = req.query.status as string | undefined;
      const requests = await communityService.listJoinRequests(communityId, userId, status);
      res.status(200).json({ success: true, requests });
    } catch (err) {
      next(err);
    }
  }

  async reviewJoinRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const communityId = req.params.communityId as string;
      const requestId = req.params.requestId as string;
      const userId = req.user!.id;
      const validated = reviewJoinRequestSchema.parse(req.body);
      const request = await communityService.reviewJoinRequest(communityId, requestId, userId, validated.action);
      res.status(200).json({ success: true, request });
    } catch (err) {
      next(err);
    }
  }

  async leaveGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const communityId = req.params.communityId as string;
      const userId = req.user!.id;
      const membership = await communityService.leaveGroup(communityId, userId);
      res.status(200).json({ success: true, membership });
    } catch (err) {
      next(err);
    }
  }

  async updateMemberRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const communityId = req.params.communityId as string;
      const targetUserId = req.params.targetUserId as string;
      const userId = req.user!.id;
      const validated = updateCommunityMemberRoleSchema.parse(req.body);
      const membership = await communityService.updateMemberRole(communityId, userId, targetUserId, validated.role);
      res.status(200).json({ success: true, membership });
    } catch (err) {
      next(err);
    }
  }

  async removeMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const communityId = req.params.communityId as string;
      const targetUserId = req.params.targetUserId as string;
      const userId = req.user!.id;
      const membership = await communityService.removeMember(communityId, userId, targetUserId);
      res.status(200).json({ success: true, membership });
    } catch (err) {
      next(err);
    }
  }

  // ---------------------------------------------------------------------------
  // Assistance Requests
  // ---------------------------------------------------------------------------
  async createAssistanceRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const communityId = req.params.communityId as string;
      const userId = req.user!.id;
      const validated = createAssistanceRequestSchema.parse(req.body);
      const request = await communityService.createAssistanceRequest(communityId, userId, validated);
      res.status(201).json({ success: true, request });
    } catch (err) {
      next(err);
    }
  }

  async listAssistanceRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const communityId = req.params.communityId as string;
      const userId = req.user!.id;
      const category = req.query.category as string | undefined;
      const status = req.query.status as string | undefined;
      const requests = await communityService.listAssistanceRequests(communityId, userId, { category, status });
      res.status(200).json({ success: true, requests });
    } catch (err) {
      next(err);
    }
  }

  async getAssistanceRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const communityId = req.params.communityId as string;
      const requestId = req.params.requestId as string;
      const userId = req.user!.id;
      const result = await communityService.getAssistanceRequest(communityId, requestId, userId);
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async expressVolunteerInterest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const communityId = req.params.communityId as string;
      const requestId = req.params.requestId as string;
      const userId = req.user!.id;
      const notes = req.body.notes as string | undefined;
      const assignment = await communityService.expressVolunteerInterest(communityId, requestId, userId, notes);
      res.status(201).json({ success: true, assignment });
    } catch (err) {
      next(err);
    }
  }

  async listVolunteersForRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const communityId = req.params.communityId as string;
      const requestId = req.params.requestId as string;
      const userId = req.user!.id;
      const volunteers = await communityService.listVolunteersForRequest(communityId, requestId, userId);
      res.status(200).json({ success: true, volunteers });
    } catch (err) {
      next(err);
    }
  }

  async assignVolunteer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const communityId = req.params.communityId as string;
      const requestId = req.params.requestId as string;
      const userId = req.user!.id;
      const validated = assignVolunteerSchema.parse(req.body);
      const result = await communityService.assignVolunteer(communityId, requestId, userId, validated.volunteerUserId);
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async updateAssistanceStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const communityId = req.params.communityId as string;
      const requestId = req.params.requestId as string;
      const userId = req.user!.id;
      const validated = updateAssistanceStatusSchema.parse(req.body);
      const request = await communityService.updateAssistanceStatus(communityId, requestId, userId, validated.status);
      res.status(200).json({ success: true, request });
    } catch (err) {
      next(err);
    }
  }

  // ---------------------------------------------------------------------------
  // Blood Donor Requests
  // ---------------------------------------------------------------------------
  async createBloodDonorRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const communityId = req.params.communityId as string;
      const userId = req.user!.id;
      const validated = createBloodDonorRequestSchema.parse(req.body);
      const request = await communityService.createBloodDonorRequest(communityId, userId, validated);
      res.status(201).json({
        success: true,
        request,
        disclaimer: 'Blood donor requests facilitate voluntary contact only. Clinical eligibility, compatibility screening, and transfusions must be performed by authorized healthcare providers.',
      });
    } catch (err) {
      next(err);
    }
  }

  async listBloodDonorRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const communityId = req.params.communityId as string;
      const userId = req.user!.id;
      const bloodGroup = req.query.bloodGroup as string | undefined;
      const status = req.query.status as string | undefined;
      const requests = await communityService.listBloodDonorRequests(communityId, userId, { bloodGroup, status });
      res.status(200).json({ success: true, requests });
    } catch (err) {
      next(err);
    }
  }

  async getBloodDonorRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const communityId = req.params.communityId as string;
      const requestId = req.params.requestId as string;
      const userId = req.user!.id;
      const result = await communityService.getBloodDonorRequest(communityId, requestId, userId);
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async expressDonorInterest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const communityId = req.params.communityId as string;
      const requestId = req.params.requestId as string;
      const userId = req.user!.id;
      const validated = createDonorResponseSchema.parse(req.body);
      const response = await communityService.expressDonorInterest(communityId, requestId, userId, validated);
      res.status(201).json({
        success: true,
        response,
        disclaimer: 'Registering interest does not verify clinical medical eligibility. Hospital or blood-bank personnel perform all clinical screening before donation.',
      });
    } catch (err) {
      next(err);
    }
  }

  async listDonorResponses(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const communityId = req.params.communityId as string;
      const requestId = req.params.requestId as string;
      const userId = req.user!.id;
      const responses = await communityService.listDonorResponses(communityId, requestId, userId);
      res.status(200).json({ success: true, responses });
    } catch (err) {
      next(err);
    }
  }

  async updateDonorResponseStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const communityId = req.params.communityId as string;
      const requestId = req.params.requestId as string;
      const donorUserId = req.params.donorUserId as string;
      const userId = req.user!.id;
      const validated = updateDonorResponseStatusSchema.parse(req.body);
      const response = await communityService.updateDonorResponseStatus(
        communityId,
        requestId,
        userId,
        donorUserId,
        validated.status,
        validated.notes || undefined
      );
      res.status(200).json({ success: true, response });
    } catch (err) {
      next(err);
    }
  }

  async closeBloodDonorRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const communityId = req.params.communityId as string;
      const requestId = req.params.requestId as string;
      const userId = req.user!.id;
      const status = req.body.status === 'cancelled' ? 'cancelled' : 'fulfilled';
      const request = await communityService.closeBloodDonorRequest(communityId, requestId, userId, status);
      res.status(200).json({ success: true, request });
    } catch (err) {
      next(err);
    }
  }

  // ---------------------------------------------------------------------------
  // Moderation & Reports
  // ---------------------------------------------------------------------------
  async submitReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const communityId = req.params.communityId as string;
      const userId = req.user!.id;
      const validated = createCommunityReportSchema.parse(req.body);
      const report = await communityService.submitReport(communityId, userId, validated);
      res.status(201).json({ success: true, report });
    } catch (err) {
      next(err);
    }
  }

  async listReports(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const communityId = req.params.communityId as string;
      const userId = req.user!.id;
      const status = req.query.status as string | undefined;
      const reports = await communityService.listReports(communityId, userId, status);
      res.status(200).json({ success: true, reports });
    } catch (err) {
      next(err);
    }
  }

  async resolveReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const communityId = req.params.communityId as string;
      const reportId = req.params.reportId as string;
      const userId = req.user!.id;
      const validated = resolveCommunityReportSchema.parse(req.body);
      const result = await communityService.resolveReport(communityId, reportId, userId, validated);
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async listModerationActions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const communityId = req.params.communityId as string;
      const userId = req.user!.id;
      const actions = await communityService.listModerationActions(communityId, userId);
      res.status(200).json({ success: true, actions });
    } catch (err) {
      next(err);
    }
  }
}
