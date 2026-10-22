-- ============================================================================
-- Migration: 20261022000008_phase8_community_groups_assistance_schema.sql
-- Description: Phase 8 Schema - Residential Society Groups, Community Assistance,
--              Volunteer Coordination, Blood Donor Requests, Contact Sharing Grants,
--              and Community Moderation.
-- ============================================================================

-- 1. COMMUNITY_GROUPS
CREATE TABLE IF NOT EXISTS public.community_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    group_type TEXT NOT NULL CHECK (group_type IN ('residential_society', 'apartment_building', 'neighborhood', 'other_local')),
    description TEXT NOT NULL,
    approximate_locality TEXT NOT NULL,
    organization_or_building_name TEXT,
    creator_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    membership_policy TEXT NOT NULL DEFAULT 'open' CHECK (membership_policy IN ('open', 'approval_required', 'invite_only')),
    moderation_policy TEXT NOT NULL DEFAULT 'standard' CHECK (moderation_policy IN ('standard', 'strict')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_comm_groups_creator ON public.community_groups(creator_user_id);
CREATE INDEX IF NOT EXISTS idx_comm_groups_locality ON public.community_groups(approximate_locality);
CREATE INDEX IF NOT EXISTS idx_comm_groups_status ON public.community_groups(status);

ALTER TABLE public.community_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active public or restricted groups for discovery"
    ON public.community_groups FOR SELECT
    USING (status = 'active');

CREATE POLICY "Authenticated users can create community groups"
    ON public.community_groups FOR INSERT
    WITH CHECK (auth.uid() = creator_user_id);

CREATE POLICY "Group creators/owners can update community groups"
    ON public.community_groups FOR UPDATE
    USING (auth.uid() = creator_user_id);

-- 2. COMMUNITY_MEMBERSHIPS
CREATE TABLE IF NOT EXISTS public.community_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES public.community_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'moderator', 'member')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'removed', 'left')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_comm_membership UNIQUE (community_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comm_members_comm ON public.community_memberships(community_id);
CREATE INDEX IF NOT EXISTS idx_comm_members_user ON public.community_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_comm_members_role ON public.community_memberships(role);

ALTER TABLE public.community_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view memberships of their community"
    ON public.community_memberships FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.community_memberships cm
            WHERE cm.community_id = community_memberships.community_id
              AND cm.user_id = auth.uid()
              AND cm.status = 'active'
        )
    );

CREATE POLICY "Users can insert their own membership or owners/moderators can add"
    ON public.community_memberships FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own membership status or owners can update"
    ON public.community_memberships FOR UPDATE
    USING (
        auth.uid() = user_id OR
        EXISTS (
            SELECT 1 FROM public.community_memberships cm
            WHERE cm.community_id = community_memberships.community_id
              AND cm.user_id = auth.uid()
              AND cm.role = 'owner'
              AND cm.status = 'active'
        )
    );

-- 3. COMMUNITY_INVITATIONS
CREATE TABLE IF NOT EXISTS public.community_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES public.community_groups(id) ON DELETE CASCADE,
    inviter_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    invitee_email TEXT NOT NULL,
    invite_code TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'revoked', 'expired')),
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_comm_invites_comm ON public.community_invitations(community_id);
CREATE INDEX IF NOT EXISTS idx_comm_invites_email ON public.community_invitations(invitee_email);
CREATE INDEX IF NOT EXISTS idx_comm_invites_code ON public.community_invitations(invite_code);

ALTER TABLE public.community_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Inviter or invitee can view invitation"
    ON public.community_invitations FOR SELECT
    USING (
        auth.uid() = inviter_user_id OR
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND lower(p.email) = lower(community_invitations.invitee_email)
        )
    );

-- 4. COMMUNITY_JOIN_REQUESTS
CREATE TABLE IF NOT EXISTS public.community_join_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES public.community_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_comm_join_request UNIQUE (community_id, user_id, status)
);

CREATE INDEX IF NOT EXISTS idx_comm_join_comm ON public.community_join_requests(community_id);
CREATE INDEX IF NOT EXISTS idx_comm_join_user ON public.community_join_requests(user_id);

ALTER TABLE public.community_join_requests ENABLE ROW LEVEL SECURITY;

-- 5. ASSISTANCE_REQUESTS (Non-emergency Elderly & Community Assistance)
CREATE TABLE IF NOT EXISTS public.assistance_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES public.community_groups(id) ON DELETE CASCADE,
    request_category TEXT NOT NULL CHECK (
        request_category IN (
            'grocery_supplies',
            'appointment_accompaniment',
            'transport_assistance',
            'errands',
            'welfare_check',
            'caregiver_contact',
            'other_support'
        )
    ),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    creator_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    intended_recipient_name TEXT,
    approximate_locality TEXT NOT NULL,
    preferred_date_time TEXT,
    expiry_time TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (
        status IN ('open', 'interest_received', 'assigned', 'in_progress', 'completed', 'cancelled', 'expired')
    ),
    assigned_volunteer_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    contact_sharing_consent BOOLEAN NOT NULL DEFAULT FALSE,
    contact_phone TEXT,
    contact_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_assist_comm ON public.assistance_requests(community_id);
CREATE INDEX IF NOT EXISTS idx_assist_creator ON public.assistance_requests(creator_user_id);
CREATE INDEX IF NOT EXISTS idx_assist_status ON public.assistance_requests(status);
CREATE INDEX IF NOT EXISTS idx_assist_category ON public.assistance_requests(request_category);

ALTER TABLE public.assistance_requests ENABLE ROW LEVEL SECURITY;

-- 6. ASSISTANCE_ASSIGNMENTS (Volunteer response tracking)
CREATE TABLE IF NOT EXISTS public.assistance_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES public.assistance_requests(id) ON DELETE CASCADE,
    volunteer_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'interested' CHECK (status IN ('interested', 'assigned', 'declined', 'withdrawn', 'completed')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_assist_assignment UNIQUE (request_id, volunteer_user_id)
);

CREATE INDEX IF NOT EXISTS idx_assist_assign_req ON public.assistance_assignments(request_id);
CREATE INDEX IF NOT EXISTS idx_assist_assign_vol ON public.assistance_assignments(volunteer_user_id);

ALTER TABLE public.assistance_assignments ENABLE ROW LEVEL SECURITY;

-- 7. BLOOD_DONOR_REQUESTS
CREATE TABLE IF NOT EXISTS public.blood_donor_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES public.community_groups(id) ON DELETE CASCADE,
    blood_group TEXT NOT NULL CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'any')),
    units_needed INTEGER NOT NULL DEFAULT 1,
    approximate_locality TEXT NOT NULL,
    hospital_name TEXT,
    requested_date_time TEXT,
    creator_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'fulfilled', 'cancelled', 'expired')),
    expiry_time TIMESTAMPTZ NOT NULL,
    contact_phone TEXT,
    contact_sharing_consent BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_blood_comm ON public.blood_donor_requests(community_id);
CREATE INDEX IF NOT EXISTS idx_blood_group ON public.blood_donor_requests(blood_group);
CREATE INDEX IF NOT EXISTS idx_blood_status ON public.blood_donor_requests(status);

ALTER TABLE public.blood_donor_requests ENABLE ROW LEVEL SECURITY;

-- 8. DONOR_RESPONSES (Interested blood donor coordination)
CREATE TABLE IF NOT EXISTS public.donor_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES public.blood_donor_requests(id) ON DELETE CASCADE,
    donor_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    blood_group TEXT NOT NULL CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
    status TEXT NOT NULL DEFAULT 'interested' CHECK (status IN ('interested', 'contacted', 'unavailable', 'referred_to_screening')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_donor_response UNIQUE (request_id, donor_user_id)
);

CREATE INDEX IF NOT EXISTS idx_donor_resp_req ON public.donor_responses(request_id);
CREATE INDEX IF NOT EXISTS idx_donor_resp_donor ON public.donor_responses(donor_user_id);

ALTER TABLE public.donor_responses ENABLE ROW LEVEL SECURITY;

-- 9. CONTACT_SHARING_GRANTS (Explicit, time-bound contact disclosures)
CREATE TABLE IF NOT EXISTS public.contact_sharing_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_type TEXT NOT NULL CHECK (resource_type IN ('assistance_request', 'blood_donor_request')),
    resource_id UUID NOT NULL,
    granted_by_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    granted_to_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    contact_phone TEXT NOT NULL,
    contact_address TEXT,
    contact_notes TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_contact_grant_res ON public.contact_sharing_grants(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_contact_grant_user ON public.contact_sharing_grants(granted_to_user_id);

ALTER TABLE public.contact_sharing_grants ENABLE ROW LEVEL SECURITY;

-- 10. COMMUNITY_REPORTS & MODERATION_ACTIONS
CREATE TABLE IF NOT EXISTS public.community_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES public.community_groups(id) ON DELETE CASCADE,
    reporter_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL CHECK (target_type IN ('assistance_request', 'blood_donor_request', 'member')),
    target_id UUID NOT NULL,
    reason_category TEXT NOT NULL CHECK (
        reason_category IN (
            'suspicious',
            'spam',
            'harassment',
            'impersonation',
            'inappropriate_content',
            'unauthorized_phi',
            'fraud',
            'other'
        )
    ),
    details TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (
        status IN ('submitted', 'under_review', 'action_required', 'resolved', 'dismissed')
    ),
    decision_notes TEXT,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_comm_reports_comm ON public.community_reports(community_id);
CREATE INDEX IF NOT EXISTS idx_comm_reports_status ON public.community_reports(status);

ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.moderation_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID REFERENCES public.community_reports(id) ON DELETE SET NULL,
    community_id UUID NOT NULL REFERENCES public.community_groups(id) ON DELETE CASCADE,
    moderator_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    action_taken TEXT NOT NULL CHECK (
        action_taken IN ('content_hidden', 'member_warned', 'member_suspended', 'member_removed', 'dismissed')
    ),
    notes TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_mod_actions_comm ON public.moderation_actions(community_id);
CREATE INDEX IF NOT EXISTS idx_mod_actions_mod ON public.moderation_actions(moderator_user_id);

ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;

-- 11. UPDATE NOTIFICATIONS FOR COMMUNITY INTEGRATION
ALTER TABLE public.notifications ALTER COLUMN family_id DROP NOT NULL;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS community_id UUID REFERENCES public.community_groups(id) ON DELETE CASCADE;

-- Drop and replace notification category constraint to include community categories
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_category_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_category_check CHECK (
    category IN (
        'medication_reminder',
        'medication_escalation',
        'appointment_reminder',
        'general',
        'community_invitation',
        'community_join_decision',
        'community_request_new',
        'volunteer_interest_or_assignment',
        'community_request_status',
        'blood_donor_response',
        'community_request_expiry',
        'moderation_action',
        'community_report_submitted'
    )
);
