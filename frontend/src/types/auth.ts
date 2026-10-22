/**
 * frontend/src/types/auth.ts
 *
 * Types for user authentication, families, and patient profiles.
 */

export type MembershipRole = 'owner' | 'adult' | 'caregiver' | 'guardian';
export type MembershipStatus = 'active' | 'invited' | 'suspended';
export type PatientCategory = 'child' | 'adult' | 'elderly';
export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone?: string | null;
  avatar_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Family {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface FamilyMembership {
  id: string;
  family_id: string;
  user_id: string;
  role: MembershipRole;
  status: MembershipStatus;
  created_at: string;
  updated_at: string;
  user?: UserProfile;
}

export interface PatientProfile {
  id: string;
  family_id: string;
  health_id: string;
  full_name: string;
  date_of_birth?: string | null;
  gender?: Gender | null;
  relationship_to_creator?: string | null;
  category: PatientCategory;
  avatar_url?: string | null;
  status: 'active' | 'archived';
  created_by: string;
  created_at: string;
  updated_at: string;
}
