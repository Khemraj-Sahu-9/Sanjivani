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
