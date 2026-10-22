# Database Schema — Health Memory Agent

**Version:** 0.1 (Phase 0 — Documentation Only)  
**Last Updated:** Phase 0

> **Note:** No application tables are created in Phase 0. This document describes the **planned** schema to be implemented incrementally across phases. All schema changes must be version-controlled migrations in `supabase/migrations/`.

---

## Design Principles

1. **Single PostgreSQL database** via Supabase — no secondary databases.
2. **Row Level Security (RLS)** enabled on every table from creation.
3. **UUIDs** as primary keys (Supabase default via `gen_random_uuid()`).
4. **Timestamps** on every table: `created_at`, `updated_at` (managed by triggers).
5. **Soft deletes** where data loss risk is high (medical records, profiles).
6. **Audit logging** for sensitive operations (Phase 9).

---

## Phase 1 Tables (Authentication & Profiles)

### `profiles`
Extends Supabase Auth `auth.users`. One row per registered user.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | FK → `auth.users.id`, PK |
| `display_name` | `text` | User's chosen name |
| `avatar_url` | `text nullable` | Profile photo URL |
| `phone` | `text nullable` | For future SMS notifications |
| `date_of_birth` | `date nullable` | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

**RLS:** Users can read/update their own row only.

---

### `families`
A family group that multiple users can belong to.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `name` | `text` | Family name |
| `created_by` | `uuid` | FK → `profiles.id` |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

---

### `family_members`
Many-to-many: users in families with roles.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `family_id` | `uuid` | FK → `families.id` |
| `user_id` | `uuid` | FK → `profiles.id` |
| `role` | `text` | `owner`, `family_member`, `caregiver`, `read_only` |
| `invited_by` | `uuid nullable` | FK → `profiles.id` |
| `joined_at` | `timestamptz nullable` | |
| `created_at` | `timestamptz` | |

**RLS:** Users can see family memberships for families they belong to.

---

## Phase 2 Tables (Health Records & Documents)

### `health_records`
Top-level health record for a family member.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `family_id` | `uuid` | FK → `families.id` |
| `patient_profile_id` | `uuid` | FK → `profiles.id` (whose record) |
| `title` | `text` | |
| `record_type` | `text` | `prescription`, `lab_result`, `discharge_summary`, `vaccination`, `other` |
| `date_of_record` | `date nullable` | |
| `notes` | `text nullable` | |
| `deleted_at` | `timestamptz nullable` | Soft delete |
| `created_by` | `uuid` | FK → `profiles.id` |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

### `documents`
Files associated with health records, stored in Supabase Storage.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `health_record_id` | `uuid` | FK → `health_records.id` |
| `storage_path` | `text` | Path in Supabase Storage bucket |
| `file_name` | `text` | Original file name |
| `mime_type` | `text` | |
| `file_size_bytes` | `bigint` | |
| `ocr_status` | `text` | `pending`, `processing`, `completed`, `failed` |
| `ocr_extracted_text` | `text nullable` | Raw OCR output |
| `created_by` | `uuid` | |
| `created_at` | `timestamptz` | |

---

## Phase 4 Tables (Medications & Appointments)

### `medications`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `patient_profile_id` | `uuid` | |
| `family_id` | `uuid` | |
| `name` | `text` | |
| `dosage` | `text nullable` | |
| `frequency` | `text nullable` | |
| `start_date` | `date nullable` | |
| `end_date` | `date nullable` | |
| `notes` | `text nullable` | |
| `deleted_at` | `timestamptz nullable` | Soft delete |
| `created_at` | `timestamptz` | |

### `appointments`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `patient_profile_id` | `uuid` | |
| `family_id` | `uuid` | |
| `title` | `text` | |
| `doctor_name` | `text nullable` | |
| `location` | `text nullable` | |
| `scheduled_at` | `timestamptz` | |
| `notes` | `text nullable` | |
| `reminder_sent` | `boolean` | Default false |
| `deleted_at` | `timestamptz nullable` | |
| `created_at` | `timestamptz` | |

---

## Phase 5 Tables (Emergency Contacts & SOS Demo)

### `emergency_contacts`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `family_id` | `uuid` | |
| `profile_id` | `uuid` | The person this contact is for |
| `name` | `text` | |
| `relationship` | `text` | |
| `phone` | `text nullable` | |
| `email` | `text nullable` | |
| `is_primary` | `boolean` | |
| `created_at` | `timestamptz` | |

---

## Migration Naming Convention

```
YYYYMMDDHHMMSS_<short_description>.sql

Examples:
20260101000001_create_profiles_table.sql
20260101000002_create_families_tables.sql
20260201000001_create_health_records_tables.sql
```

---

## Supabase Storage Buckets (Phase 2+)

| Bucket | Access | Purpose |
|--------|--------|---------|
| `medical-documents` | Private | Uploaded prescriptions, lab results, discharge summaries |
| `profile-avatars` | Private | User profile photos |

All buckets are private — files are accessed via signed URLs generated by the backend, never direct public URLs.

---

## Authorization Summary

| Table | RLS Policy Summary |
|-------|--------------------|
| `profiles` | User reads/edits own row |
| `families` | Family members read; owner edits |
| `family_members` | Family members see their own family's rows |
| `health_records` | Family members with appropriate role |
| `documents` | Same as health_records |
| `medications` | Family members with appropriate role |
| `appointments` | Family members with appropriate role |
| `emergency_contacts` | Family members with appropriate role |

Detailed RLS policies will be defined in each migration file.
