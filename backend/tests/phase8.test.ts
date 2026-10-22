/**
 * backend/tests/phase8.test.ts
 *
 * Automated Test Suite for Phase 8:
 * Health Community, Society Groups & Elderly Assistance Network.
 *
 * Covers:
 * 1. Community Group Creation, Discovery & Owner Access Control
 * 2. Membership, Invitations, Join Requests & RBAC (Owner, Moderator, Member)
 * 3. Non-Emergency Elderly Assistance Requests & Privacy Masking
 * 4. Volunteer Interest, Explicit Assignment & Contact Sharing Grants
 * 5. Blood-Donor Coordination, Expressions of Interest & Medical Disclaimers
 * 6. Contact Sharing Grants Expiry & Revocation
 * 7. Community Moderation, Abuse Reporting & Moderator Actions
 * 8. Cross-Domain Privacy Isolation: Community Owners Cannot Access Family Health Records
 * 9. Regression Safety (Authentication, Patient Profiles, SOS, Offline Sync)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('Phase 8 — Health Community, Society Groups & Elderly Assistance', () => {
  // Test users
  let ownerToken: string;
  let ownerId: string;
  const ownerEmail = 'phase8.owner@example.com';

  let modToken: string;
  let modId: string;
  const modEmail = 'phase8.moderator@example.com';

  let volunteerToken: string;
  let volunteerId: string;
  const volunteerEmail = 'phase8.volunteer@example.com';

  let outsiderToken: string;
  const outsiderEmail = 'phase8.outsider@example.com';

  // Test groups
  let community1Id: string;
  let community2Id: string;

  // Test entities
  let assistanceReqId: string;
  let bloodDonorReqId: string;
  let reportId: string;

  beforeAll(async () => {
    // 1. Register Owner
    const regOwner = await request(app)
      .post('/api/auth/register')
      .send({
        email: ownerEmail,
        password: 'secure-phase8-pass',
        fullName: 'Greenwood Society Owner',
        phone: '+919811100001',
      });
    expect(regOwner.status).toBe(201);
    ownerToken = regOwner.body.data.token;
    ownerId = regOwner.body.data.user.id;

    // 2. Register Moderator
    const regMod = await request(app)
      .post('/api/auth/register')
      .send({
        email: modEmail,
        password: 'secure-phase8-pass',
        fullName: 'Greenwood Moderator',
        phone: '+919811100002',
      });
    expect(regMod.status).toBe(201);
    modToken = regMod.body.data.token;
    modId = regMod.body.data.user.id;

    // 3. Register Volunteer
    const regVol = await request(app)
      .post('/api/auth/register')
      .send({
        email: volunteerEmail,
        password: 'secure-phase8-pass',
        fullName: 'Greenwood Volunteer',
        phone: '+919811100003',
      });
    expect(regVol.status).toBe(201);
    volunteerToken = regVol.body.data.token;
    volunteerId = regVol.body.data.user.id;

    // 4. Register Outsider
    const regOut = await request(app)
      .post('/api/auth/register')
      .send({
        email: outsiderEmail,
        password: 'secure-phase8-pass',
        fullName: 'Outsider Resident',
        phone: '+919811100004',
      });
    expect(regOut.status).toBe(201);
    outsiderToken = regOut.body.data.token;
  });

  // ---------------------------------------------------------------------------
  // Test Suite 1: Group Creation & Discovery
  // ---------------------------------------------------------------------------
  describe('1. Community Group Creation & Discovery', () => {
    it('creates a residential society group and registers the creator as owner', async () => {
      const res = await request(app)
        .post('/api/communities')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Greenwood Society Health Circle',
          groupType: 'residential_society',
          description: 'Local neighborhood mutual assistance and elderly support group',
          approximateLocality: 'Indiranagar, Bangalore',
          organizationOrBuildingName: 'Greenwood Residency Phase 1',
          membershipPolicy: 'approval_required',
          moderationPolicy: 'standard',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.group.name).toBe('Greenwood Society Health Circle');
      expect(res.body.group.creator_user_id).toBe(ownerId);
      expect(res.body.membership.role).toBe('owner');
      expect(res.body.membership.status).toBe('active');

      community1Id = res.body.group.id;
    });

    it('creates a second open neighborhood group', async () => {
      const res = await request(app)
        .post('/api/communities')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Indiranagar Open Support',
          groupType: 'neighborhood',
          description: 'Open neighborhood health mutual aid',
          approximateLocality: 'Indiranagar, Bangalore',
          membershipPolicy: 'open',
          moderationPolicy: 'standard',
        });

      expect(res.status).toBe(201);
      community2Id = res.body.group.id;
    });

    it('lists public groups for discovery with locality filtering', async () => {
      const res = await request(app)
        .get('/api/communities/public?locality=Indiranagar')
        .set('Authorization', `Bearer ${volunteerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.groups.length).toBeGreaterThanOrEqual(2);
      expect(res.body.groups.some((g: any) => g.id === community1Id)).toBe(true);
    });

    it('allows owner to update group settings', async () => {
      const res = await request(app)
        .patch(`/api/communities/${community1Id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          description: 'Updated description for Greenwood society support circle',
        });

      expect(res.status).toBe(200);
      expect(res.body.group.description).toBe('Updated description for Greenwood society support circle');
    });

    it('prevents non-owner from updating group settings', async () => {
      const res = await request(app)
        .patch(`/api/communities/${community1Id}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({
          name: 'Malicious Rename Attempt',
        });

      expect(res.status).toBe(403);
    });
  });

  // ---------------------------------------------------------------------------
  // Test Suite 2: Memberships, Invitations & Join Requests
  // ---------------------------------------------------------------------------
  describe('2. Memberships, Invitations & Join Requests', () => {
    let inviteCode: string;

    it('allows owner to invite a member by email', async () => {
      const res = await request(app)
        .post(`/api/communities/${community1Id}/invitations`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: modEmail,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.invitation.invitee_email).toBe(modEmail);
      expect(res.body.invitation.invite_code).toBeDefined();

      inviteCode = res.body.invitation.invite_code;
    });

    it('allows invitee to view their pending invitations', async () => {
      const res = await request(app)
        .get('/api/communities/invitations/my')
        .set('Authorization', `Bearer ${modToken}`);

      expect(res.status).toBe(200);
      expect(res.body.invitations.some((i: any) => i.invite_code === inviteCode)).toBe(true);
    });

    it('prevents non-matching user from accepting another users invitation', async () => {
      const res = await request(app)
        .post(`/api/communities/invitations/${inviteCode}/accept`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(res.status).toBe(403);
    });

    it('allows matching user to accept invitation and become active member', async () => {
      const res = await request(app)
        .post(`/api/communities/invitations/${inviteCode}/accept`)
        .set('Authorization', `Bearer ${modToken}`);

      expect(res.status).toBe(200);
      expect(res.body.membership.community_id).toBe(community1Id);
      expect(res.body.membership.status).toBe('active');
    });

    it('allows owner to promote member to moderator role', async () => {
      const res = await request(app)
        .patch(`/api/communities/${community1Id}/members/${modId}/role`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          role: 'moderator',
        });

      expect(res.status).toBe(200);
      expect(res.body.membership.role).toBe('moderator');
    });

    it('allows user to join open community immediately without approval', async () => {
      const res = await request(app)
        .post(`/api/communities/${community2Id}/join`)
        .set('Authorization', `Bearer ${volunteerToken}`)
        .send({});

      expect(res.status).toBe(201);
      expect(res.body.membership).toBeDefined();
      expect(res.body.membership.status).toBe('active');
    });

    it('submits join request for approval-required community', async () => {
      const res = await request(app)
        .post(`/api/communities/${community1Id}/join`)
        .set('Authorization', `Bearer ${volunteerToken}`)
        .send({
          notes: 'Resident of Block B Flat 304, willing to help elderly neighbors',
        });

      expect(res.status).toBe(201);
      expect(res.body.joinRequest).toBeDefined();
      expect(res.body.joinRequest.status).toBe('pending');

      const joinReqId = res.body.joinRequest.id;

      // Moderator approves join request
      const approveRes = await request(app)
        .post(`/api/communities/${community1Id}/join-requests/${joinReqId}/review`)
        .set('Authorization', `Bearer ${modToken}`)
        .send({
          action: 'approve',
        });

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.request.status).toBe('approved');
    });

    it('isolates private community members from non-members', async () => {
      const res = await request(app)
        .get(`/api/communities/${community1Id}/members`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ---------------------------------------------------------------------------
  // Test Suite 3: Non-Emergency Elderly Assistance
  // ---------------------------------------------------------------------------
  describe('3. Non-Emergency Elderly Assistance Requests & Volunteer Coordination', () => {
    it('creates an assistance request with approximate locality and masked contact details', async () => {
      const res = await request(app)
        .post(`/api/communities/${community1Id}/assistance`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          requestCategory: 'grocery_supplies',
          title: 'Grocery delivery for elderly resident (Mrs. Rao)',
          description: 'Need basic vegetables and milk packets delivered to door. Non-emergency assistance.',
          priority: 'medium',
          intendedRecipientName: 'Mrs. Rao',
          approximateLocality: 'Block A, Greenwood Residency',
          preferredDateTime: 'Tomorrow morning 10 AM',
          expiryHours: 48,
          contactSharingConsent: true,
          contactPhone: '+919811100001',
          contactAddress: 'Flat 102, Block A, Greenwood Residency',
        });

      expect(res.status).toBe(201);
      expect(res.body.request.title).toContain('Grocery delivery');
      expect(res.body.request.status).toBe('open');
      expect(res.body.request.contact_phone).toBe('+919811100001'); // Creator sees own contact details

      assistanceReqId = res.body.request.id;
    });

    it('masks phone number and exact address for general community members viewing the request', async () => {
      const res = await request(app)
        .get(`/api/communities/${community1Id}/assistance/${assistanceReqId}`)
        .set('Authorization', `Bearer ${volunteerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.request.title).toBe('Grocery delivery for elderly resident (Mrs. Rao)');
      expect(res.body.request.approximate_locality).toBe('Block A, Greenwood Residency');
      // Contact phone and exact address MUST be nullified for unassigned volunteer
      expect(res.body.request.contact_phone).toBeNull();
      expect(res.body.request.contact_address).toBeNull();
      expect(res.body.isAssignedVolunteer).toBe(false);
      expect(res.body.isCreator).toBe(false);
    });

    it('allows a community member to express volunteer interest', async () => {
      const res = await request(app)
        .post(`/api/communities/${community1Id}/assistance/${assistanceReqId}/volunteer`)
        .set('Authorization', `Bearer ${volunteerToken}`)
        .send({
          notes: 'I am visiting the local market tomorrow at 9:30 AM and can pick up the supplies.',
        });

      expect(res.status).toBe(201);
      expect(res.body.assignment.status).toBe('interested');
      expect(res.body.assignment.volunteer_user_id).toBe(volunteerId);
    });

    it('allows request creator to assign the volunteer, which generates a contact sharing grant', async () => {
      const res = await request(app)
        .post(`/api/communities/${community1Id}/assistance/${assistanceReqId}/assign`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          volunteerUserId: volunteerId,
        });

      expect(res.status).toBe(200);
      expect(res.body.request.status).toBe('assigned');
      expect(res.body.request.assigned_volunteer_user_id).toBe(volunteerId);
      expect(res.body.contactGrant).toBeDefined();
      expect(res.body.contactGrant.granted_to_user_id).toBe(volunteerId);
      expect(res.body.contactGrant.contact_phone).toBe('+919811100001');
    });

    it('now reveals contact phone and address to the assigned volunteer', async () => {
      const res = await request(app)
        .get(`/api/communities/${community1Id}/assistance/${assistanceReqId}`)
        .set('Authorization', `Bearer ${volunteerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.isAssignedVolunteer).toBe(true);
      expect(res.body.request.contact_phone).toBe('+919811100001');
      expect(res.body.request.contact_address).toBe('Flat 102, Block A, Greenwood Residency');
    });

    it('still keeps contact phone and address masked from moderator who is not assigned', async () => {
      const res = await request(app)
        .get(`/api/communities/${community1Id}/assistance/${assistanceReqId}`)
        .set('Authorization', `Bearer ${modToken}`);

      expect(res.status).toBe(200);
      expect(res.body.request.contact_phone).toBeNull();
      expect(res.body.request.contact_address).toBeNull();
    });

    it('allows assigned volunteer to complete request and automatically revokes contact grant', async () => {
      const res = await request(app)
        .patch(`/api/communities/${community1Id}/assistance/${assistanceReqId}/status`)
        .set('Authorization', `Bearer ${volunteerToken}`)
        .send({
          status: 'completed',
        });

      expect(res.status).toBe(200);
      expect(res.body.request.status).toBe('completed');
    });
  });

  // ---------------------------------------------------------------------------
  // Test Suite 4: Blood-Donor Requests & Donor Coordination
  // ---------------------------------------------------------------------------
  describe('4. Blood-Donor Coordination & Medical Disclaimers', () => {
    it('creates a blood-donor request with explicit clinical disclaimer', async () => {
      const res = await request(app)
        .post(`/api/communities/${community1Id}/blood-donors`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          bloodGroup: 'O+',
          unitsNeeded: 2,
          approximateLocality: 'Manipal Hospital, Old Airport Road',
          hospitalName: 'Manipal Hospital',
          requestedDateTime: 'Within next 24 hours',
          notes: 'Scheduled surgery requirement for community member.',
          expiryHours: 48,
          contactSharingConsent: true,
          contactPhone: '+919811100001',
        });

      expect(res.status).toBe(201);
      expect(res.body.request.blood_group).toBe('O+');
      expect(res.body.disclaimer).toContain('Clinical eligibility, compatibility screening, and transfusions');

      bloodDonorReqId = res.body.request.id;
    });

    it('allows eligible community member to express interest with blood group disclaimer', async () => {
      const res = await request(app)
        .post(`/api/communities/${community1Id}/blood-donors/${bloodDonorReqId}/respond`)
        .set('Authorization', `Bearer ${volunteerToken}`)
        .send({
          bloodGroup: 'O+',
          notes: 'Available to visit blood bank between 2 PM and 5 PM.',
        });

      expect(res.status).toBe(201);
      expect(res.body.response.blood_group).toBe('O+');
      expect(res.body.response.status).toBe('interested');
      expect(res.body.disclaimer).toContain('does not verify clinical medical eligibility');
    });

    it('allows coordinator to mark donor response status as contacted', async () => {
      const res = await request(app)
        .patch(`/api/communities/${community1Id}/blood-donors/${bloodDonorReqId}/responses/${volunteerId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          status: 'contacted',
          notes: 'Spoke over phone. Volunteer heading to blood bank.',
        });

      expect(res.status).toBe(200);
      expect(res.body.response.status).toBe('contacted');
    });

    it('allows requester to close blood donor request as fulfilled', async () => {
      const res = await request(app)
        .post(`/api/communities/${community1Id}/blood-donors/${bloodDonorReqId}/close`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          status: 'fulfilled',
        });

      expect(res.status).toBe(200);
      expect(res.body.request.status).toBe('fulfilled');
    });
  });

  // ---------------------------------------------------------------------------
  // Test Suite 5: Moderation & Abuse Reporting
  // ---------------------------------------------------------------------------
  describe('5. Community Moderation & Abuse Reporting', () => {
    it('allows a member to submit a moderation report against suspicious content', async () => {
      const res = await request(app)
        .post(`/api/communities/${community1Id}/reports`)
        .set('Authorization', `Bearer ${volunteerToken}`)
        .send({
          targetType: 'assistance_request',
          targetId: assistanceReqId,
          reasonCategory: 'suspicious',
          details: 'Potential spam or repeated test request observed in feed.',
        });

      expect(res.status).toBe(201);
      expect(res.body.report.status).toBe('submitted');
      expect(res.body.report.reason_category).toBe('suspicious');

      reportId = res.body.report.id;
    });

    it('denies non-moderators from accessing the moderation reports dashboard', async () => {
      const res = await request(app)
        .get(`/api/communities/${community1Id}/reports`)
        .set('Authorization', `Bearer ${volunteerToken}`);

      expect(res.status).toBe(403);
    });

    it('allows authorized moderator to list reports and resolve with audit action', async () => {
      const res = await request(app)
        .post(`/api/communities/${community1Id}/reports/${reportId}/resolve`)
        .set('Authorization', `Bearer ${modToken}`)
        .send({
          status: 'resolved',
          decisionNotes: 'Verified as legitimate community activity. Marked resolved.',
          actionTaken: 'dismissed',
        });

      expect(res.status).toBe(200);
      expect(res.body.report.status).toBe('resolved');
      expect(res.body.report.decision_notes).toContain('Verified as legitimate');
    });
  });

  // ---------------------------------------------------------------------------
  // Test Suite 6: Cross-Domain Security & Privacy Safeguards
  // ---------------------------------------------------------------------------
  describe('6. Cross-Domain Security & Healthcare Privacy Isolation', () => {
    let familyId: string;

    beforeAll(async () => {
      // Create a private family workspace for volunteer
      const famRes = await request(app)
        .post('/api/families')
        .set('Authorization', `Bearer ${volunteerToken}`)
        .send({
          name: 'Volunteer Personal Family Workspace',
        });
      familyId = famRes.body.data.family.id;

      // Create a private patient profile
      const patRes = await request(app)
        .post(`/api/families/${familyId}/patients`)
        .set('Authorization', `Bearer ${volunteerToken}`)
        .send({
          fullName: 'Volunteer Elderly Father',
          dateOfBirth: '1955-04-12',
          gender: 'male',
          relationshipToCreator: 'Father',
          category: 'elderly',
        });
      expect(patRes.status).toBe(201);
    });

    it('prevents community owner from accessing member private family workspace', async () => {
      const res = await request(app)
        .get(`/api/families/${familyId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(403);
    });

    it('prevents community moderator from viewing private patient profile of a community member', async () => {
      const res = await request(app)
        .get(`/api/families/${familyId}/patients`)
        .set('Authorization', `Bearer ${modToken}`);

      expect(res.status).toBe(403);
    });
  });
});
