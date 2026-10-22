/**
 * backend/src/routes/communityRouter.ts
 *
 * Express Router for Phase 8: Health Community, Society Groups & Elderly Assistance Network.
 * Mounted at /api/communities.
 */

import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { CommunityController } from '../controllers/communityController.js';

export const communityRouter = Router();
const controller = new CommunityController();

// Enforce authentication for all community operations
communityRouter.use(requireAuth);

// -----------------------------------------------------------------------------
// Group Lifecycle & Discovery
// -----------------------------------------------------------------------------
communityRouter.post('/', (req, res, next) => controller.createGroup(req, res, next));
communityRouter.get('/my', (req, res, next) => controller.listMyGroups(req, res, next));
communityRouter.get('/public', (req, res, next) => controller.listPublicGroups(req, res, next));
communityRouter.get('/invitations/my', (req, res, next) => controller.listMyInvitations(req, res, next));
communityRouter.post('/invitations/:inviteCode/accept', (req, res, next) => controller.acceptInvitation(req, res, next));
communityRouter.post('/invitations/:inviteCode/decline', (req, res, next) => controller.declineInvitation(req, res, next));

communityRouter.get('/:communityId', (req, res, next) => controller.getGroup(req, res, next));
communityRouter.patch('/:communityId', (req, res, next) => controller.updateGroup(req, res, next));

// -----------------------------------------------------------------------------
// Membership, Invitations & Join Requests
// -----------------------------------------------------------------------------
communityRouter.get('/:communityId/members', (req, res, next) => controller.listMembers(req, res, next));
communityRouter.post('/:communityId/invitations', (req, res, next) => controller.inviteMember(req, res, next));
communityRouter.get('/:communityId/invitations', (req, res, next) => controller.listGroupInvitations(req, res, next));
communityRouter.post('/:communityId/join', (req, res, next) => controller.requestJoin(req, res, next));
communityRouter.get('/:communityId/join-requests', (req, res, next) => controller.listJoinRequests(req, res, next));
communityRouter.post('/:communityId/join-requests/:requestId/review', (req, res, next) => controller.reviewJoinRequest(req, res, next));
communityRouter.post('/:communityId/leave', (req, res, next) => controller.leaveGroup(req, res, next));
communityRouter.patch('/:communityId/members/:targetUserId/role', (req, res, next) => controller.updateMemberRole(req, res, next));
communityRouter.delete('/:communityId/members/:targetUserId', (req, res, next) => controller.removeMember(req, res, next));

// -----------------------------------------------------------------------------
// Non-Emergency Assistance Requests & Volunteer Coordination
// -----------------------------------------------------------------------------
communityRouter.post('/:communityId/assistance', (req, res, next) => controller.createAssistanceRequest(req, res, next));
communityRouter.get('/:communityId/assistance', (req, res, next) => controller.listAssistanceRequests(req, res, next));
communityRouter.get('/:communityId/assistance/:requestId', (req, res, next) => controller.getAssistanceRequest(req, res, next));
communityRouter.post('/:communityId/assistance/:requestId/volunteer', (req, res, next) => controller.expressVolunteerInterest(req, res, next));
communityRouter.get('/:communityId/assistance/:requestId/volunteers', (req, res, next) => controller.listVolunteersForRequest(req, res, next));
communityRouter.post('/:communityId/assistance/:requestId/assign', (req, res, next) => controller.assignVolunteer(req, res, next));
communityRouter.patch('/:communityId/assistance/:requestId/status', (req, res, next) => controller.updateAssistanceStatus(req, res, next));

// -----------------------------------------------------------------------------
// Blood Donor Requests & Donor Responses
// -----------------------------------------------------------------------------
communityRouter.post('/:communityId/blood-donors', (req, res, next) => controller.createBloodDonorRequest(req, res, next));
communityRouter.get('/:communityId/blood-donors', (req, res, next) => controller.listBloodDonorRequests(req, res, next));
communityRouter.get('/:communityId/blood-donors/:requestId', (req, res, next) => controller.getBloodDonorRequest(req, res, next));
communityRouter.post('/:communityId/blood-donors/:requestId/respond', (req, res, next) => controller.expressDonorInterest(req, res, next));
communityRouter.get('/:communityId/blood-donors/:requestId/responses', (req, res, next) => controller.listDonorResponses(req, res, next));
communityRouter.patch('/:communityId/blood-donors/:requestId/responses/:donorUserId', (req, res, next) => controller.updateDonorResponseStatus(req, res, next));
communityRouter.post('/:communityId/blood-donors/:requestId/close', (req, res, next) => controller.closeBloodDonorRequest(req, res, next));

// -----------------------------------------------------------------------------
// Moderation & Abuse Reporting
// -----------------------------------------------------------------------------
communityRouter.post('/:communityId/reports', (req, res, next) => controller.submitReport(req, res, next));
communityRouter.get('/:communityId/reports', (req, res, next) => controller.listReports(req, res, next));
communityRouter.post('/:communityId/reports/:reportId/resolve', (req, res, next) => controller.resolveReport(req, res, next));
communityRouter.get('/:communityId/moderation-actions', (req, res, next) => controller.listModerationActions(req, res, next));
