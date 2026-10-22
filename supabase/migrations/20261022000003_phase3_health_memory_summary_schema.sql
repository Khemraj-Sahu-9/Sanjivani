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
