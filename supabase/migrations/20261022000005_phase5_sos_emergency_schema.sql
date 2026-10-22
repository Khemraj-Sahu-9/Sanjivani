-- ============================================================================
-- Migration: 20261022000005_phase5_sos_emergency_schema.sql
-- Description: Phase 5 Schema - SOS Emergency Simulation, Escalation Policies,
--              Simulated Contact Attempts, Incident Event Timeline, and Hospital Handoffs.
-- ============================================================================

-- 1. EMERGENCY_CONTACTS
CREATE TABLE IF NOT EXISTS public.emergency_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    patient_profile_id UUID NOT NULL REFERENCES public.patient_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    relationship TEXT NOT NULL,
    phone_number TEXT NOT NULL DEFAULT '+91-000-000-0000 (Simulated)',
    role TEXT NOT NULL DEFAULT 'primary_family' CHECK (role IN ('primary_family', 'secondary_family', 'caregiver', 'doctor')),
    priority INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_demo BOOLEAN NOT NULL DEFAULT true,
    simulation_provenance TEXT NOT NULL DEFAULT 'DEMO_SIMULATION_ONLY',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_emg_contacts_patient ON public.emergency_contacts(patient_profile_id);
CREATE INDEX IF NOT EXISTS idx_emg_contacts_family ON public.emergency_contacts(family_id);

ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Family members can view emergency contacts"
    ON public.emergency_contacts FOR SELECT
    USING (public.is_family_member(family_id));

CREATE POLICY "Authorized family members can insert emergency contacts"
    ON public.emergency_contacts FOR INSERT
    WITH CHECK (public.is_family_member(family_id));

CREATE POLICY "Authorized family members can update emergency contacts"
    ON public.emergency_contacts FOR UPDATE
    USING (public.is_family_member(family_id));

CREATE POLICY "Authorized family members can delete emergency contacts"
    ON public.emergency_contacts FOR DELETE
    USING (public.is_family_member(family_id));

-- 2. EMERGENCY_ESCALATION_POLICIES
CREATE TABLE IF NOT EXISTS public.emergency_escalation_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    patient_profile_id UUID NOT NULL REFERENCES public.patient_profiles(id) ON DELETE CASCADE,
    family_response_timeout_seconds INTEGER NOT NULL DEFAULT 15 CHECK (family_response_timeout_seconds >= 5),
    caregiver_response_timeout_seconds INTEGER NOT NULL DEFAULT 15 CHECK (caregiver_response_timeout_seconds >= 5),
    advance_to_hospital_on_timeout BOOLEAN NOT NULL DEFAULT true,
    hospital_name TEXT NOT NULL DEFAULT 'Apollo Indraprastha Fictional Hospital (Demo Desk)',
    hospital_department TEXT NOT NULL DEFAULT 'Emergency Receiving Desk (Simulated)',
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_demo BOOLEAN NOT NULL DEFAULT true,
    simulation_provenance TEXT NOT NULL DEFAULT 'DEMO_SIMULATION_ONLY',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_emergency_policy_patient UNIQUE (patient_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_emg_policy_family ON public.emergency_escalation_policies(family_id);

ALTER TABLE public.emergency_escalation_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Family members can view emergency escalation policy"
    ON public.emergency_escalation_policies FOR SELECT
    USING (public.is_family_member(family_id));

CREATE POLICY "Authorized family members can insert emergency escalation policy"
    ON public.emergency_escalation_policies FOR INSERT
    WITH CHECK (public.is_family_member(family_id));

CREATE POLICY "Authorized family members can update emergency escalation policy"
    ON public.emergency_escalation_policies FOR UPDATE
    USING (public.is_family_member(family_id));

-- 3. EMERGENCY_INCIDENTS
CREATE TABLE IF NOT EXISTS public.emergency_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_number TEXT UNIQUE NOT NULL,
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    patient_profile_id UUID NOT NULL REFERENCES public.patient_profiles(id) ON DELETE CASCADE,
    initiated_by_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'CREATED' CHECK (
        status IN (
            'CREATED',
            'CONTACTING_FAMILY',
            'AWAITING_FAMILY_RESPONSE',
            'FAMILY_RESPONDED',
            'ESCALATING_CAREGIVER',
            'AWAITING_CAREGIVER_RESPONSE',
            'CAREGIVER_RESPONDED',
            'HOSPITAL_HANDOFF_PENDING',
            'HOSPITAL_HANDOFF_SIMULATED',
            'RESOLVED',
            'CANCELLED',
            'ESCALATION_FAILED'
        )
    ),
    current_stage TEXT NOT NULL DEFAULT 'FAMILY_CONTACT' CHECK (
        current_stage IN ('FAMILY_CONTACT', 'CAREGIVER_ESCALATION', 'HOSPITAL_HANDOFF', 'RESOLVED', 'CANCELLED')
    ),
    severity TEXT NOT NULL DEFAULT 'CRITICAL' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    location_note TEXT NOT NULL DEFAULT 'Home (Coordinates unavailable in demo)',
    is_demo BOOLEAN NOT NULL DEFAULT true,
    simulation_provenance TEXT NOT NULL DEFAULT 'DEMO_SIMULATION_ONLY',
    activated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    response_deadline TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    resolution_note TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_emg_incidents_patient ON public.emergency_incidents(patient_profile_id);
CREATE INDEX IF NOT EXISTS idx_emg_incidents_family ON public.emergency_incidents(family_id);
CREATE INDEX IF NOT EXISTS idx_emg_incidents_status ON public.emergency_incidents(status);
CREATE INDEX IF NOT EXISTS idx_emg_incidents_number ON public.emergency_incidents(incident_number);

ALTER TABLE public.emergency_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Family members can view emergency incidents"
    ON public.emergency_incidents FOR SELECT
    USING (public.is_family_member(family_id));

CREATE POLICY "Authorized family members can insert emergency incidents"
    ON public.emergency_incidents FOR INSERT
    WITH CHECK (
        public.is_family_member(family_id) AND
        auth.uid() = initiated_by_user_id
    );

CREATE POLICY "Authorized family members can update emergency incidents"
    ON public.emergency_incidents FOR UPDATE
    USING (public.is_family_member(family_id));

-- 4. EMERGENCY_CONTACT_ATTEMPTS
CREATE TABLE IF NOT EXISTS public.emergency_contact_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES public.emergency_incidents(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.emergency_contacts(id) ON DELETE SET NULL,
    contact_name TEXT NOT NULL,
    contact_role TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'SIMULATED_VOICE_SMS',
    stage TEXT NOT NULL DEFAULT 'FAMILY_CONTACT' CHECK (stage IN ('FAMILY_CONTACT', 'CAREGIVER_ESCALATION')),
    status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (
        status IN (
            'QUEUED',
            'SENT_SIMULATED',
            'AWAITING_RESPONSE',
            'ACKNOWLEDGED',
            'TIMEOUT_NO_RESPONSE',
            'FAILED_SIMULATED',
            'CANCELLED'
        )
    ),
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    acknowledged_at TIMESTAMPTZ,
    acknowledgement_action TEXT,
    acknowledgement_note TEXT,
    is_demo BOOLEAN NOT NULL DEFAULT true,
    simulation_provenance TEXT NOT NULL DEFAULT 'DEMO_SIMULATION_ONLY',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_emg_attempts_incident ON public.emergency_contact_attempts(incident_id);

ALTER TABLE public.emergency_contact_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Family members can view emergency contact attempts"
    ON public.emergency_contact_attempts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.emergency_incidents ei
            WHERE ei.id = emergency_contact_attempts.incident_id
            AND public.is_family_member(ei.family_id)
        )
    );

-- 5. EMERGENCY_INCIDENT_EVENTS
CREATE TABLE IF NOT EXISTS public.emergency_incident_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES public.emergency_incidents(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    actor_type TEXT NOT NULL DEFAULT 'SYSTEM_SCHEDULER' CHECK (
        actor_type IN ('PATIENT', 'USER', 'SYSTEM_SCHEDULER', 'CONTACT', 'CAREGIVER', 'HOSPITAL_RECEIVING_DESK', 'DEMO_OPERATOR')
    ),
    actor_id TEXT,
    stage TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_demo BOOLEAN NOT NULL DEFAULT true,
    simulation_provenance TEXT NOT NULL DEFAULT 'DEMO_SIMULATION_ONLY',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_emg_events_incident ON public.emergency_incident_events(incident_id);
CREATE INDEX IF NOT EXISTS idx_emg_events_created ON public.emergency_incident_events(created_at);

ALTER TABLE public.emergency_incident_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Family members can view emergency incident events"
    ON public.emergency_incident_events FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.emergency_incidents ei
            WHERE ei.id = emergency_incident_events.incident_id
            AND public.is_family_member(ei.family_id)
        )
    );

-- 6. HOSPITAL_HANDOFFS
CREATE TABLE IF NOT EXISTS public.hospital_handoffs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES public.emergency_incidents(id) ON DELETE CASCADE,
    hospital_name TEXT NOT NULL DEFAULT 'Apollo Indraprastha Fictional Hospital (Demo Desk)',
    department TEXT NOT NULL DEFAULT 'Emergency Receiving Desk (Simulated)',
    status TEXT NOT NULL DEFAULT 'PENDING_SIMULATED' CHECK (
        status IN ('PENDING_SIMULATED', 'ACKNOWLEDGED_SIMULATED', 'FAILED_SIMULATED', 'CANCELLED')
    ),
    patient_summary_packet JSONB NOT NULL DEFAULT '{}'::jsonb,
    handoff_prepared_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    acknowledged_at TIMESTAMPTZ,
    receiving_staff_name TEXT,
    receiving_notes TEXT,
    is_demo BOOLEAN NOT NULL DEFAULT true,
    simulation_provenance TEXT NOT NULL DEFAULT 'DEMO_SIMULATION_ONLY',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_hospital_handoff_incident UNIQUE (incident_id)
);

CREATE INDEX IF NOT EXISTS idx_hospital_handoffs_incident ON public.hospital_handoffs(incident_id);

ALTER TABLE public.hospital_handoffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Family members can view hospital handoffs"
    ON public.hospital_handoffs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.emergency_incidents ei
            WHERE ei.id = hospital_handoffs.incident_id
            AND public.is_family_member(ei.family_id)
        )
    );
