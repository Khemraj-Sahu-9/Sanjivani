/**
 * frontend/src/types/community.ts
 *
 * TypeScript types for Phase 8: Health Community, Society Groups & Elderly Assistance.
 */

export type CommunityGroupType =
  | 'residential_society'
  | 'apartment_building'
  | 'neighborhood'
  | 'other_local';

export type CommunityMembershipPolicy = 'open' | 'approval_required' | 'invite_only';
export type CommunityModerationPolicy = 'standard' | 'strict';
export type CommunityStatus = 'active' | 'closed' | 'suspended';

export interface CommunityGroup {
  id: string;
  name: string;
  group_type: CommunityGroupType;
  description: string;
  approximate_locality: string;
  organization_or_building_name?: string | null;
  creator_user_id: string;
  membership_policy: CommunityMembershipPolicy;
  moderation_policy: CommunityModerationPolicy;
  status: CommunityStatus;
  created_at: string;
  updated_at: string;
}

export type CommunityRole = 'owner' | 'moderator' | 'member';
export type CommunityMembershipStatus = 'active' | 'suspended' | 'removed' | 'left';

export interface CommunityMembership {
  id: string;
  community_id: string;
  user_id: string;
  role: CommunityRole;
  status: CommunityMembershipStatus;
  joined_at: string;
  created_at: string;
  updated_at: string;
}

export type CommunityInvitationStatus = 'pending' | 'accepted' | 'declined' | 'revoked' | 'expired';

export interface CommunityInvitation {
  id: string;
  community_id: string;
  inviter_user_id: string;
  invitee_email: string;
  invite_code: string;
  status: CommunityInvitationStatus;
  expires_at: string;
  accepted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type CommunityJoinRequestStatus = 'pending' | 'approved' | 'rejected';

export interface CommunityJoinRequest {
  id: string;
  community_id: string;
  user_id: string;
  notes?: string | null;
  status: CommunityJoinRequestStatus;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type AssistanceCategory =
  | 'grocery_supplies'
  | 'appointment_accompaniment'
  | 'transport_assistance'
  | 'errands'
  | 'welfare_check'
  | 'caregiver_contact'
  | 'other_support';

export type AssistancePriority = 'low' | 'medium' | 'high';

export type AssistanceStatus =
  | 'open'
  | 'interest_received'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'expired';

export interface AssistanceRequest {
  id: string;
  community_id: string;
  request_category: AssistanceCategory;
  title: string;
  description: string;
  priority: AssistancePriority;
  creator_user_id: string;
  intended_recipient_name?: string | null;
  approximate_locality: string;
  preferred_date_time?: string | null;
  expiry_time: string;
  status: AssistanceStatus;
  assigned_volunteer_user_id?: string | null;
  contact_sharing_consent: boolean;
  contact_phone?: string | null;
  contact_address?: string | null;
  created_at: string;
  updated_at: string;
}

export type AssistanceAssignmentStatus =
  | 'interested'
  | 'assigned'
  | 'declined'
  | 'withdrawn'
  | 'completed';

export interface AssistanceAssignment {
  id: string;
  request_id: string;
  volunteer_user_id: string;
  status: AssistanceAssignmentStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'any';

export type BloodDonorRequestStatus = 'open' | 'fulfilled' | 'cancelled' | 'expired';

export interface BloodDonorRequest {
  id: string;
  community_id: string;
  blood_group: BloodGroup;
  units_needed: number;
  approximate_locality: string;
  hospital_name?: string | null;
  requested_date_time?: string | null;
  creator_user_id: string;
  notes?: string | null;
  status: BloodDonorRequestStatus;
  expiry_time: string;
  contact_phone?: string | null;
  contact_sharing_consent: boolean;
  created_at: string;
  updated_at: string;
}

export type DonorResponseStatus =
  | 'interested'
  | 'contacted'
  | 'unavailable'
  | 'referred_to_screening';

export interface DonorResponse {
  id: string;
  request_id: string;
  donor_user_id: string;
  blood_group: BloodGroup;
  status: DonorResponseStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactSharingGrant {
  id: string;
  resource_type: 'assistance_request' | 'blood_donor_request';
  resource_id: string;
  granted_by_user_id: string;
  granted_to_user_id: string;
  contact_phone: string;
  contact_address?: string | null;
  contact_notes?: string | null;
  status: 'active' | 'revoked';
  expires_at: string;
  created_at: string;
}

export type CommunityReportTargetType = 'assistance_request' | 'blood_donor_request' | 'member';

export type CommunityReportReason =
  | 'suspicious'
  | 'spam'
  | 'harassment'
  | 'impersonation'
  | 'inappropriate_content'
  | 'unauthorized_phi'
  | 'fraud'
  | 'other';

export type CommunityReportStatus =
  | 'submitted'
  | 'under_review'
  | 'action_required'
  | 'resolved'
  | 'dismissed';

export interface CommunityReport {
  id: string;
  community_id: string;
  reporter_user_id: string;
  target_type: CommunityReportTargetType;
  target_id: string;
  reason_category: CommunityReportReason;
  details: string;
  status: CommunityReportStatus;
  decision_notes?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type ModerationActionType =
  | 'content_hidden'
  | 'member_warned'
  | 'member_suspended'
  | 'member_removed'
  | 'dismissed';

export interface ModerationAction {
  id: string;
  report_id?: string | null;
  community_id: string;
  moderator_user_id: string;
  action_taken: ModerationActionType;
  notes: string;
  created_at: string;
}
