-- ============================================================================
-- Migration: 20261022000004_phase4_medication_appointments_notifications_schema.sql
-- Description: Phase 4 Schema - Medication Schedules, Dose Occurrences, Appointments,
--              Notification Center, Preferences, Caregiver Policies, and Background Jobs.
-- ============================================================================

-- 1. MEDICATION_SCHEDULES
CREATE TABLE IF NOT EXISTS public.medication_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    patient_profile_id UUID NOT NULL REFERENCES public.patient_profiles(id) ON DELETE CASCADE,
    source_document_id UUID REFERENCES public.health_documents(id) ON DELETE SET NULL,
    source_medicine_name TEXT,
    medicine_name TEXT NOT NULL,
    strength TEXT,
    dosage_instruction TEXT NOT NULL,
    route TEXT DEFAULT 'oral',
    frequency TEXT NOT NULL DEFAULT 'once_daily',
    scheduled_times JSONB NOT NULL DEFAULT '["08:00"]'::jsonb,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    prescriber_name TEXT,
    instructions TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft_pending_confirmation', 'paused', 'discontinued', 'completed')),
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    confirmed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_med_sched_patient ON public.medication_schedules(patient_profile_id);
CREATE INDEX IF NOT EXISTS idx_med_sched_family ON public.medication_schedules(family_id);
CREATE INDEX IF NOT EXISTS idx_med_sched_status ON public.medication_schedules(status);

ALTER TABLE public.medication_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Family members can view medication schedules"
    ON public.medication_schedules FOR SELECT
    USING (public.is_family_member(family_id));

CREATE POLICY "Authorized family members can insert medication schedules"
    ON public.medication_schedules FOR INSERT
    WITH CHECK (
        public.is_family_member(family_id) AND
        auth.uid() = created_by
    );

CREATE POLICY "Authorized family members can update medication schedules"
    ON public.medication_schedules FOR UPDATE
    USING (public.is_family_member(family_id));

CREATE POLICY "Family owners can delete medication schedules"
    ON public.medication_schedules FOR DELETE
    USING (public.is_family_owner(family_id));

-- 2. MEDICATION_SCHEDULE_HISTORY
CREATE TABLE IF NOT EXISTS public.medication_schedule_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES public.medication_schedules(id) ON DELETE CASCADE,
    changed_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('created', 'confirmed', 'updated', 'paused', 'resumed', 'discontinued')),
    change_summary TEXT NOT NULL,
    previous_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_med_history_sched ON public.medication_schedule_history(schedule_id);

ALTER TABLE public.medication_schedule_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Family members can view medication history"
    ON public.medication_schedule_history FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.medication_schedules s
            WHERE s.id = schedule_id AND public.is_family_member(s.family_id)
        )
    );

-- 3. MEDICATION_DOSE_OCCURRENCES
CREATE TABLE IF NOT EXISTS public.medication_dose_occurrences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES public.medication_schedules(id) ON DELETE CASCADE,
    patient_profile_id UUID NOT NULL REFERENCES public.patient_profiles(id) ON DELETE CASCADE,
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    scheduled_date DATE NOT NULL,
    scheduled_time TEXT NOT NULL,
    scheduled_datetime TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'taken', 'skipped', 'missed', 'unconfirmed')),
    dose_instruction TEXT NOT NULL,
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    acknowledgement_note TEXT,
    reminder_sent_at TIMESTAMPTZ,
    escalated_to_caregiver_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_dose_occurrence UNIQUE (schedule_id, scheduled_date, scheduled_time)
);

CREATE INDEX IF NOT EXISTS idx_dose_occ_patient ON public.medication_dose_occurrences(patient_profile_id);
CREATE INDEX IF NOT EXISTS idx_dose_occ_date ON public.medication_dose_occurrences(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_dose_occ_status ON public.medication_dose_occurrences(status);

ALTER TABLE public.medication_dose_occurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Family members can view dose occurrences"
    ON public.medication_dose_occurrences FOR SELECT
    USING (public.is_family_member(family_id));

CREATE POLICY "Family members can update dose occurrences"
    ON public.medication_dose_occurrences FOR UPDATE
    USING (public.is_family_member(family_id));

-- 4. APPOINTMENTS
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    patient_profile_id UUID NOT NULL REFERENCES public.patient_profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    doctor_name TEXT,
    facility_name TEXT,
    appointment_date DATE NOT NULL,
    appointment_time TEXT,
    appointment_datetime TIMESTAMPTZ,
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    location TEXT,
    notes TEXT,
    source_document_id UUID REFERENCES public.health_documents(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'rescheduled')),
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_appts_patient ON public.appointments(patient_profile_id);
CREATE INDEX IF NOT EXISTS idx_appts_date ON public.appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appts_status ON public.appointments(status);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Family members can view appointments"
    ON public.appointments FOR SELECT
    USING (public.is_family_member(family_id));

CREATE POLICY "Family members can insert appointments"
    ON public.appointments FOR INSERT
    WITH CHECK (
        public.is_family_member(family_id) AND
        auth.uid() = created_by
    );

CREATE POLICY "Family members can update appointments"
    ON public.appointments FOR UPDATE
    USING (public.is_family_member(family_id));

CREATE POLICY "Family owners can delete appointments"
    ON public.appointments FOR DELETE
    USING (public.is_family_owner(family_id));

-- 5. NOTIFICATION_PREFERENCES
CREATE TABLE IF NOT EXISTS public.notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    enable_in_app BOOLEAN NOT NULL DEFAULT TRUE,
    enable_browser BOOLEAN NOT NULL DEFAULT TRUE,
    enable_email BOOLEAN NOT NULL DEFAULT FALSE,
    enable_sms BOOLEAN NOT NULL DEFAULT FALSE,
    medication_reminders BOOLEAN NOT NULL DEFAULT TRUE,
    appointment_reminders BOOLEAN NOT NULL DEFAULT TRUE,
    caregiver_escalations BOOLEAN NOT NULL DEFAULT TRUE,
    quiet_hours_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    quiet_hours_start TEXT DEFAULT '22:00',
    quiet_hours_end TEXT DEFAULT '07:00',
    preferred_language TEXT NOT NULL DEFAULT 'en',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_user_family_pref UNIQUE (user_id, family_id)
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification preferences"
    ON public.notification_preferences FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own notification preferences"
    ON public.notification_preferences FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 6. CAREGIVER_REMINDER_POLICIES
CREATE TABLE IF NOT EXISTS public.caregiver_reminder_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    patient_profile_id UUID NOT NULL REFERENCES public.patient_profiles(id) ON DELETE CASCADE,
    caregiver_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    escalate_unacknowledged_meds BOOLEAN NOT NULL DEFAULT TRUE,
    med_escalation_grace_minutes INTEGER NOT NULL DEFAULT 30,
    escalate_upcoming_appointments BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_caregiver_policy UNIQUE (patient_profile_id, caregiver_user_id)
);

ALTER TABLE public.caregiver_reminder_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Family members can view caregiver reminder policies"
    ON public.caregiver_reminder_policies FOR SELECT
    USING (public.is_family_member(family_id));

CREATE POLICY "Family owners can manage caregiver reminder policies"
    ON public.caregiver_reminder_policies FOR ALL
    USING (public.is_family_owner(family_id))
    WITH CHECK (public.is_family_owner(family_id));

-- 7. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    patient_profile_id UUID REFERENCES public.patient_profiles(id) ON DELETE CASCADE,
    recipient_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('medication_reminder', 'medication_escalation', 'appointment_reminder', 'general')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    details_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    channel TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app', 'browser', 'email', 'sms')),
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'queued', 'attempted', 'delivered', 'failed', 'cancelled', 'read', 'acknowledged')),
    scheduled_for TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    attempt_count INTEGER NOT NULL DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    failure_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_notif_recipient ON public.notifications(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_notif_status ON public.notifications(status);
CREATE INDEX IF NOT EXISTS idx_notif_scheduled ON public.notifications(scheduled_for);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recipients can view own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = recipient_user_id);

CREATE POLICY "Recipients can update own notifications"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = recipient_user_id);

-- 8. SCHEDULED_JOBS (Server-side durable task queue)
CREATE TABLE IF NOT EXISTS public.scheduled_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type TEXT NOT NULL CHECK (job_type IN ('dose_reminder', 'caregiver_escalation', 'appointment_reminder', 'generate_daily_doses')),
    reference_id TEXT NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    last_error TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_jobs_status_scheduled ON public.scheduled_jobs(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_jobs_ref ON public.scheduled_jobs(reference_id);

ALTER TABLE public.scheduled_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage scheduled jobs"
    ON public.scheduled_jobs FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
