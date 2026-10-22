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
