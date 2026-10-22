-- ============================================================================
-- Migration: 20261022000001_phase1_auth_family_patient_schema.sql
-- Description: Phase 1 Schema - Profiles, Families, Memberships, Patient Profiles, Caregivers
-- ============================================================================

-- Ensure pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. PROFILES (Extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL DEFAULT '',
    phone TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles RLS: users can read and update their own profile
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- 2. FAMILIES (Family Workspaces)
CREATE TABLE IF NOT EXISTS public.families (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (char_length(trim(name)) >= 2),
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

-- 3. FAMILY_MEMBERSHIPS (Associates Users with Families)
-- Roles: 'owner', 'adult', 'caregiver', 'guardian'
CREATE TABLE IF NOT EXISTS public.family_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'adult', 'caregiver', 'guardian')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_family_user UNIQUE(family_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON public.family_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_family_id ON public.family_memberships(family_id);

ALTER TABLE public.family_memberships ENABLE ROW LEVEL SECURITY;

-- Helper security function: Check if current user is an active member of a family
CREATE OR REPLACE FUNCTION public.is_family_member(f_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.family_memberships
    WHERE family_id = f_id
      AND user_id = auth.uid()
      AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper security function: Check if current user is an owner of a family
CREATE OR REPLACE FUNCTION public.is_family_owner(f_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.family_memberships
    WHERE family_id = f_id
      AND user_id = auth.uid()
      AND role = 'owner'
      AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Families RLS Policies
CREATE POLICY "Members can view family workspace"
    ON public.families FOR SELECT
    USING (public.is_family_member(id));

CREATE POLICY "Authenticated users can create family workspace"
    ON public.families FOR INSERT
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owners can update family workspace"
    ON public.families FOR UPDATE
    USING (public.is_family_owner(id));

CREATE POLICY "Owners can delete family workspace"
    ON public.families FOR DELETE
    USING (public.is_family_owner(id));

-- Family Memberships RLS Policies
CREATE POLICY "Members can view family memberships"
    ON public.family_memberships FOR SELECT
    USING (public.is_family_member(family_id));

CREATE POLICY "Owners can insert memberships"
    ON public.family_memberships FOR INSERT
    WITH CHECK (public.is_family_owner(family_id) OR auth.uid() = user_id);

CREATE POLICY "Owners can update memberships"
    ON public.family_memberships FOR UPDATE
    USING (public.is_family_owner(family_id));

CREATE POLICY "Owners can delete memberships or user can leave"
    ON public.family_memberships FOR DELETE
    USING (public.is_family_owner(family_id) OR auth.uid() = user_id);

-- 4. PATIENT_PROFILES (Individual healthcare memory identity)
-- Category: 'child', 'adult', 'elderly'
CREATE TABLE IF NOT EXISTS public.patient_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    health_id TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL CHECK (char_length(trim(full_name)) >= 1),
    date_of_birth DATE,
    gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
    relationship_to_creator TEXT,
    category TEXT NOT NULL CHECK (category IN ('child', 'adult', 'elderly')),
    avatar_url TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_patient_profiles_family_id ON public.patient_profiles(family_id);
CREATE INDEX IF NOT EXISTS idx_patient_profiles_health_id ON public.patient_profiles(health_id);

ALTER TABLE public.patient_profiles ENABLE ROW LEVEL SECURITY;

-- Patient Profiles RLS Policies
CREATE POLICY "Family members can view patient profiles"
    ON public.patient_profiles FOR SELECT
    USING (public.is_family_member(family_id));

CREATE POLICY "Owners, adults, guardians can create patient profiles"
    ON public.patient_profiles FOR INSERT
    WITH CHECK (
        public.is_family_member(family_id) AND
        EXISTS (
            SELECT 1 FROM public.family_memberships
            WHERE family_id = patient_profiles.family_id
              AND user_id = auth.uid()
              AND role IN ('owner', 'adult', 'guardian')
              AND status = 'active'
        )
    );

CREATE POLICY "Owners, adults, guardians can update patient profiles"
    ON public.patient_profiles FOR UPDATE
    USING (
        public.is_family_member(family_id) AND
        EXISTS (
            SELECT 1 FROM public.family_memberships
            WHERE family_id = patient_profiles.family_id
              AND user_id = auth.uid()
              AND role IN ('owner', 'adult', 'guardian')
              AND status = 'active'
        )
    );

-- 5. CAREGIVER_RELATIONSHIPS (Caregiver explicit access links)
CREATE TABLE IF NOT EXISTS public.caregiver_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    caregiver_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    patient_profile_id UUID NOT NULL REFERENCES public.patient_profiles(id) ON DELETE CASCADE,
    permissions JSONB NOT NULL DEFAULT '{"view_records": true, "view_medications": true}'::jsonb,
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_caregiver_patient UNIQUE(caregiver_user_id, patient_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_caregivers_patient_id ON public.caregiver_relationships(patient_profile_id);
CREATE INDEX IF NOT EXISTS idx_caregivers_user_id ON public.caregiver_relationships(caregiver_user_id);

ALTER TABLE public.caregiver_relationships ENABLE ROW LEVEL SECURITY;

-- Caregiver RLS Policies
CREATE POLICY "Caregiver can view own assigned relationships"
    ON public.caregiver_relationships FOR SELECT
    USING (
        auth.uid() = caregiver_user_id OR
        public.is_family_owner(family_id)
    );

CREATE POLICY "Owners can manage caregiver relationships"
    ON public.caregiver_relationships FOR ALL
    USING (public.is_family_owner(family_id));

-- Trigger: Automatically create public.profiles entry upon auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
-- ============================================================================
-- Migration: 20261022000002_phase2_health_documents_ocr_schema.sql
-- Description: Phase 2 Schema - Health Documents, Storage, OCR Extractions, Processing Jobs & Audits
-- ============================================================================

-- 1. HEALTH_DOCUMENTS
CREATE TABLE IF NOT EXISTS public.health_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    patient_profile_id UUID NOT NULL REFERENCES public.patient_profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (char_length(trim(title)) >= 1),
    category TEXT NOT NULL CHECK (category IN (
        'prescription',
        'laboratory_report',
        'diagnostic_imaging_report',
        'discharge_summary',
        'hospital_record',
        'vaccination_record',
        'other'
    )),
    document_date DATE,
    original_filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0),
    file_checksum TEXT NOT NULL,
    processing_status TEXT NOT NULL DEFAULT 'uploaded' CHECK (processing_status IN (
        'uploaded',
        'queued',
        'processing',
        'extracted',
        'failed'
    )),
    review_status TEXT NOT NULL DEFAULT 'needs_review' CHECK (review_status IN (
        'needs_review',
        'in_review',
        'confirmed',
        'rejected'
    )),
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_health_documents_patient_id ON public.health_documents(patient_profile_id);
CREATE INDEX IF NOT EXISTS idx_health_documents_family_id ON public.health_documents(family_id);
CREATE INDEX IF NOT EXISTS idx_health_documents_checksum ON public.health_documents(file_checksum);
CREATE INDEX IF NOT EXISTS idx_health_documents_processing_status ON public.health_documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_health_documents_review_status ON public.health_documents(review_status);

ALTER TABLE public.health_documents ENABLE ROW LEVEL SECURITY;

-- Health Documents RLS Policies
CREATE POLICY "Family members can view health documents"
    ON public.health_documents FOR SELECT
    USING (public.is_family_member(family_id));

CREATE POLICY "Owners, adults, and caregivers can upload health documents"
    ON public.health_documents FOR INSERT
    WITH CHECK (
        public.is_family_member(family_id) AND
        EXISTS (
            SELECT 1 FROM public.family_memberships
            WHERE family_id = health_documents.family_id
              AND user_id = auth.uid()
              AND role IN ('owner', 'adult', 'caregiver', 'guardian')
              AND status = 'active'
        )
    );

CREATE POLICY "Owners, adults, and caregivers can update health documents"
    ON public.health_documents FOR UPDATE
    USING (
        public.is_family_member(family_id) AND
        EXISTS (
            SELECT 1 FROM public.family_memberships
            WHERE family_id = health_documents.family_id
              AND user_id = auth.uid()
              AND role IN ('owner', 'adult', 'caregiver', 'guardian')
              AND status = 'active'
        )
    );

CREATE POLICY "Owners, adults, and guardians can delete health documents"
    ON public.health_documents FOR DELETE
    USING (
        public.is_family_member(family_id) AND
        EXISTS (
            SELECT 1 FROM public.family_memberships
            WHERE family_id = health_documents.family_id
              AND user_id = auth.uid()
              AND role IN ('owner', 'adult', 'guardian')
              AND status = 'active'
        )
    );

-- 2. DOCUMENT_EXTRACTIONS
CREATE TABLE IF NOT EXISTS public.document_extractions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.health_documents(id) ON DELETE CASCADE,
    extraction_version INT NOT NULL DEFAULT 1,
    extracted_text TEXT NOT NULL DEFAULT '',
    extraction_method TEXT NOT NULL CHECK (extraction_method IN ('pdf_text_parser', 'tesseract_ocr', 'hybrid', 'manual')),
    ocr_provider TEXT NOT NULL DEFAULT 'local',
    confidence NUMERIC(5,2),
    proposed_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
    confirmed_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
    extraction_status TEXT NOT NULL DEFAULT 'completed' CHECK (extraction_status IN ('completed', 'failed', 'empty')),
    error_classification TEXT,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_document_extractions_doc_id ON public.document_extractions(document_id);

ALTER TABLE public.document_extractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Family members can view document extractions"
    ON public.document_extractions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.health_documents hd
            WHERE hd.id = document_extractions.document_id
              AND public.is_family_member(hd.family_id)
        )
    );

CREATE POLICY "Family members can update document extractions"
    ON public.document_extractions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.health_documents hd
            WHERE hd.id = document_extractions.document_id
              AND public.is_family_member(hd.family_id)
        )
    );

-- 3. DOCUMENT_PROCESSING_JOBS
CREATE TABLE IF NOT EXISTS public.document_processing_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.health_documents(id) ON DELETE CASCADE,
    job_type TEXT NOT NULL DEFAULT 'ocr_and_extract' CHECK (job_type IN ('ocr_and_extract', 'pdf_text_extract', 'reprocess')),
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
    attempt_count INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    last_error TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_processing_jobs_doc_id ON public.document_processing_jobs(document_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_status ON public.document_processing_jobs(status);

ALTER TABLE public.document_processing_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Family members can view processing jobs"
    ON public.document_processing_jobs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.health_documents hd
            WHERE hd.id = document_processing_jobs.document_id
              AND public.is_family_member(hd.family_id)
        )
    );

-- 4. Supabase Storage Bucket Initialization (Private bucket: medical-records)
-- Ensures the storage bucket is configured if supabase storage extensions exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'medical-records',
    'medical-records',
    FALSE,
    26214400, -- 25MB limit
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = FALSE,
    file_size_limit = 26214400,
    allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
-- ============================================================================
-- Migration: 20261022000003_phase3_health_memory_summary_schema.sql
-- Description: Phase 3 Schema - AI Health Memory Conversations, Messages, & Doctor Summary Audits
-- ============================================================================

-- 1. AI_CONVERSATIONS
CREATE TABLE IF NOT EXISTS public.ai_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    patient_profile_id UUID NOT NULL REFERENCES public.patient_profiles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Health Memory Discussion',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_ai_conv_patient ON public.ai_conversations(patient_profile_id);
CREATE INDEX IF NOT EXISTS idx_ai_conv_user ON public.ai_conversations(user_id);

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Family members can view AI conversations"
    ON public.ai_conversations FOR SELECT
    USING (public.is_family_member(family_id));

CREATE POLICY "Family members can create AI conversations"
    ON public.ai_conversations FOR INSERT
    WITH CHECK (
        public.is_family_member(family_id) AND
        auth.uid() = user_id
    );

CREATE POLICY "Users can delete own AI conversations"
    ON public.ai_conversations FOR DELETE
    USING (auth.uid() = user_id OR public.is_family_owner(family_id));

-- 2. AI_CONVERSATION_MESSAGES
CREATE TABLE IF NOT EXISTS public.ai_conversation_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
    sender TEXT NOT NULL CHECK (sender IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    sources JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_grounded BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conv ON public.ai_conversation_messages(conversation_id);

ALTER TABLE public.ai_conversation_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Family members can view conversation messages"
    ON public.ai_conversation_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.ai_conversations c
            WHERE c.id = ai_conversation_messages.conversation_id
              AND public.is_family_member(c.family_id)
        )
    );

CREATE POLICY "Family members can insert conversation messages"
    ON public.ai_conversation_messages FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.ai_conversations c
            WHERE c.id = ai_conversation_messages.conversation_id
              AND public.is_family_member(c.family_id)
        )
    );

-- 3. DOCTOR_SUMMARY_REPORTS (Audit and tracking of generated summaries)
CREATE TABLE IF NOT EXISTS public.doctor_summary_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    patient_profile_id UUID NOT NULL REFERENCES public.patient_profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    selected_document_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    included_sections JSONB NOT NULL DEFAULT '[]'::jsonb,
    doctor_name TEXT,
    notes TEXT,
    generated_by UUID NOT NULL REFERENCES public.profiles(id),
    file_size_bytes BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_doc_summaries_patient ON public.doctor_summary_reports(patient_profile_id);

ALTER TABLE public.doctor_summary_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Family members can view generated doctor summaries"
    ON public.doctor_summary_reports FOR SELECT
    USING (public.is_family_member(family_id));

CREATE POLICY "Family members can record doctor summary generation"
    ON public.doctor_summary_reports FOR INSERT
    WITH CHECK (
        public.is_family_member(family_id) AND
        auth.uid() = generated_by
    );
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
-- ============================================================================
-- Migration: 20261022000007_phase7_offline_sync_schema.sql
-- Description: Phase 7 Schema - Offline-First Health Records, Local Storage,
--              Sync Operations, Idempotency Tracking, and Conflict Resolution.
-- ============================================================================

-- 1. SYNC_OPERATIONS
-- Logs queued client operations, idempotency keys, execution statuses, and server response payloads.
CREATE TABLE IF NOT EXISTS public.sync_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    patient_profile_id UUID REFERENCES public.patient_profiles(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_operation_id TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    operation_type TEXT NOT NULL CHECK (
        operation_type IN (
            'PATIENT_UPDATE',
            'APPOINTMENT_CREATE',
            'APPOINTMENT_UPDATE',
            'MEDICATION_DOSE_RECORD',
            'MEDICATION_SCHEDULE_CREATE',
            'DOCUMENT_UPLOAD'
        )
    ),
    payload JSONB NOT NULL,
    base_revision TEXT,
    client_timestamp TIMESTAMPTZ NOT NULL,
    server_received_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    status TEXT NOT NULL DEFAULT 'synced' CHECK (
        status IN ('pending', 'syncing', 'synced', 'failed', 'conflict')
    ),
    result_payload JSONB,
    error_category TEXT CHECK (
        error_category IN ('network', 'auth', 'validation', 'conflict', 'quota', 'server')
    ),
    error_message TEXT,
    retry_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_sync_ops_client_op UNIQUE (family_id, client_operation_id),
    CONSTRAINT uq_sync_ops_idempotency UNIQUE (family_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_sync_operations_family ON public.sync_operations(family_id);
CREATE INDEX IF NOT EXISTS idx_sync_operations_patient ON public.sync_operations(patient_profile_id);
CREATE INDEX IF NOT EXISTS idx_sync_operations_user ON public.sync_operations(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_operations_status ON public.sync_operations(status);

ALTER TABLE public.sync_operations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Family members can view sync operations"
    ON public.sync_operations FOR SELECT
    USING (public.is_family_member(family_id));

CREATE POLICY "Authorized family members can insert sync operations"
    ON public.sync_operations FOR INSERT
    WITH CHECK (public.is_family_member(family_id));

CREATE POLICY "Authorized family members can update sync operations"
    ON public.sync_operations FOR UPDATE
    USING (public.is_family_member(family_id));


-- 2. SYNC_CONFLICTS
-- Tracks detected data conflicts between local offline edits and authoritative server updates.
CREATE TABLE IF NOT EXISTS public.sync_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    patient_profile_id UUID REFERENCES public.patient_profiles(id) ON DELETE SET NULL,
    client_operation_id TEXT NOT NULL,
    entity_type TEXT NOT NULL CHECK (
        entity_type IN ('patient_profile', 'appointment', 'medication_schedule')
    ),
    entity_id TEXT NOT NULL,
    field_name TEXT,
    local_value JSONB NOT NULL,
    server_value JSONB NOT NULL,
    base_value JSONB,
    resolution_status TEXT NOT NULL DEFAULT 'pending' CHECK (
        resolution_status IN ('pending', 'resolved_client', 'resolved_server', 'resolved_merged')
    ),
    resolved_by UUID REFERENCES auth.users(id),
    resolved_at TIMESTAMPTZ,
    resolved_value JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_sync_conflicts_family ON public.sync_conflicts(family_id);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_patient ON public.sync_conflicts(patient_profile_id);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_status ON public.sync_conflicts(resolution_status);

ALTER TABLE public.sync_conflicts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Family members can view sync conflicts"
    ON public.sync_conflicts FOR SELECT
    USING (public.is_family_member(family_id));

CREATE POLICY "Authorized family members can resolve sync conflicts"
    ON public.sync_conflicts FOR UPDATE
    USING (public.is_family_member(family_id));

CREATE POLICY "Authorized family members can insert sync conflicts"
    ON public.sync_conflicts FOR INSERT
    WITH CHECK (public.is_family_member(family_id));
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
