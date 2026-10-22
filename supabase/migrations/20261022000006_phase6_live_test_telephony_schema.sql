-- ============================================================================
-- Migration: 20261022000006_phase6_live_test_telephony_schema.sql
-- Description: Phase 6 Schema - Controlled Live Test Mode for SMS and Voice Calls,
--              Verified Recipient Allowlist, Consent Records, and Telephony Audit Logs.
-- ============================================================================

-- 1. LIVE_TEST_RECIPIENTS
CREATE TABLE IF NOT EXISTS public.live_test_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    permitted_channel TEXT NOT NULL DEFAULT 'SMS' CHECK (permitted_channel IN ('SMS', 'VOICE', 'BOTH')),
    verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED' CHECK (verification_status IN ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED')),
    verification_notes TEXT,
    verified_at TIMESTAMPTZ,
    verified_by_user_id UUID,
    consent_status TEXT NOT NULL DEFAULT 'CONSENT_GRANTED' CHECK (consent_status IN ('CONSENT_GRANTED', 'CONSENT_REVOKED')),
    consent_recorded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    consent_notes TEXT NOT NULL DEFAULT 'Explicit consent granted for demonstration test communications',
    is_active BOOLEAN NOT NULL DEFAULT true,
    allowed_purpose TEXT NOT NULL DEFAULT 'Sanjivani Product Demo & Live Telephony Testing',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_live_test_recipients_family ON public.live_test_recipients(family_id);
CREATE INDEX IF NOT EXISTS idx_live_test_recipients_phone ON public.live_test_recipients(phone_number);

ALTER TABLE public.live_test_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Family members can view live test recipients"
    ON public.live_test_recipients FOR SELECT
    USING (public.is_family_member(family_id));

CREATE POLICY "Authorized family members can insert live test recipients"
    ON public.live_test_recipients FOR INSERT
    WITH CHECK (public.is_family_member(family_id));

CREATE POLICY "Authorized family members can update live test recipients"
    ON public.live_test_recipients FOR UPDATE
    USING (public.is_family_member(family_id));

CREATE POLICY "Authorized family members can delete live test recipients"
    ON public.live_test_recipients FOR DELETE
    USING (public.is_family_member(family_id));


-- 2. LIVE_TEST_AUDIT_LOGS
CREATE TABLE IF NOT EXISTS public.live_test_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    incident_id UUID NOT NULL REFERENCES public.emergency_incidents(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES public.live_test_recipients(id) ON DELETE CASCADE,
    channel TEXT NOT NULL CHECK (channel IN ('SMS', 'VOICE')),
    provider_name TEXT NOT NULL,
    provider_request_id TEXT,
    destination_phone_masked TEXT NOT NULL,
    message_payload_preview TEXT NOT NULL,
    dispatch_status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (dispatch_status IN ('QUEUED', 'SENDING', 'ACCEPTED', 'DELIVERED', 'FAILED', 'UNKNOWN')),
    delivery_evidence_at TIMESTAMPTZ,
    delivery_evidence_status TEXT,
    human_acknowledged BOOLEAN NOT NULL DEFAULT false,
    human_acknowledged_at TIMESTAMPTZ,
    human_acknowledgement_note TEXT,
    error_code TEXT,
    error_message TEXT,
    raw_provider_response JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_live_test_logs_family ON public.live_test_audit_logs(family_id);
CREATE INDEX IF NOT EXISTS idx_live_test_logs_incident ON public.live_test_audit_logs(incident_id);
CREATE INDEX IF NOT EXISTS idx_live_test_logs_recipient ON public.live_test_audit_logs(recipient_id);
CREATE INDEX IF NOT EXISTS idx_live_test_logs_provider_req ON public.live_test_audit_logs(provider_request_id);

ALTER TABLE public.live_test_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Family members can view live test audit logs"
    ON public.live_test_audit_logs FOR SELECT
    USING (public.is_family_member(family_id));

CREATE POLICY "Authorized family members can insert live test audit logs"
    ON public.live_test_audit_logs FOR INSERT
    WITH CHECK (public.is_family_member(family_id));

CREATE POLICY "Authorized family members can update live test audit logs"
    ON public.live_test_audit_logs FOR UPDATE
    USING (public.is_family_member(family_id));

CREATE POLICY "Authorized family members can delete live test audit logs"
    ON public.live_test_audit_logs FOR DELETE
    USING (public.is_family_member(family_id));
