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
