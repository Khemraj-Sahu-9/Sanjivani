/**
 * backend/src/services/familyService.ts
 *
 * Business logic for Family workspaces, memberships, and patient profiles.
 */

import { db } from '../repositories/database.js';
import { generateHealthId } from '../utils/healthId.js';
import { createError } from '../middlewares/errorHandler.js';
import {
  Family,
  FamilyMembership,
  PatientProfile,
  CaregiverRelationship,
  MembershipRole,
} from '../types/models.js';

export class FamilyService {
  async createFamily(name: string, userId: string): Promise<{ family: Family; membership: FamilyMembership }> {
    return db.createFamily(name, userId);
  }

  async getUserFamilies(userId: string): Promise<Family[]> {
    return db.getUserFamilies(userId);
  }

  async getFamily(familyId: string, userId: string): Promise<{ family: Family; role: MembershipRole }> {
    const membership = await db.getUserMembership(familyId, userId);
    if (!membership || membership.status !== 'active') {
      throw createError('Access denied. You are not a member of this family workspace.', 403);
    }
    const family = await db.getFamilyById(familyId);
    if (!family) throw createError('Family workspace not found.', 404);
    return { family, role: membership.role };
  }

  async updateFamilyName(familyId: string, name: string, userId: string): Promise<Family> {
    const membership = await db.getUserMembership(familyId, userId);
    if (!membership || membership.role !== 'owner') {
      throw createError('Only family owners can rename a workspace.', 403);
    }
    return db.updateFamilyName(familyId, name);
  }

  async getFamilyMembers(familyId: string, userId: string): Promise<FamilyMembership[]> {
    const membership = await db.getUserMembership(familyId, userId);
    if (!membership || membership.status !== 'active') {
      throw createError('Access denied. You are not a member of this family workspace.', 403);
    }
    return db.getFamilyMemberships(familyId);
  }

  async addMember(
    familyId: string,
    targetEmail: string,
    role: MembershipRole,
    requestingUserId: string
  ): Promise<FamilyMembership> {
    const requestingMembership = await db.getUserMembership(familyId, requestingUserId);
    if (!requestingMembership || requestingMembership.role !== 'owner') {
      throw createError('Only workspace owners can add or invite members.', 403);
    }

    const targetUser = await db.findProfileByEmail(targetEmail);
    if (!targetUser) {
      throw createError(`No user found with email ${targetEmail}. They must create an account first.`, 404);
    }

    return db.addFamilyMembership(familyId, targetUser.id, role);
  }

  async updateMemberRole(
    familyId: string,
    targetUserId: string,
    role: MembershipRole,
    requestingUserId: string
  ): Promise<FamilyMembership> {
    const requestingMembership = await db.getUserMembership(familyId, requestingUserId);
    if (!requestingMembership || requestingMembership.role !== 'owner') {
      throw createError('Only workspace owners can modify member roles.', 403);
    }

    if (targetUserId === requestingUserId && role !== 'owner') {
      throw createError('An owner cannot demote themselves directly without transferring ownership.', 409);
    }

    return db.updateMembershipRole(familyId, targetUserId, role);
  }

  async removeMember(familyId: string, targetUserId: string, requestingUserId: string): Promise<void> {
    const requestingMembership = await db.getUserMembership(familyId, requestingUserId);
    if (!requestingMembership) {
      throw createError('Access denied. You are not a member of this family workspace.', 403);
    }

    // Owner removing someone, or user leaving voluntarily
    const isOwner = requestingMembership.role === 'owner';
    const isSelf = requestingUserId === targetUserId;

    if (!isOwner && !isSelf) {
      throw createError('Only family owners can remove members, or members can leave voluntarily.', 403);
    }

    if (isOwner && isSelf) {
      const allMembers = await db.getFamilyMemberships(familyId);
      const otherOwners = allMembers.filter((m) => m.role === 'owner' && m.user_id !== targetUserId);
      if (otherOwners.length === 0 && allMembers.length > 1) {
        throw createError('Please assign another owner before leaving the family workspace.', 409);
      }
    }

    await db.removeFamilyMembership(familyId, targetUserId);
  }

  // ---------------------------------------------------------------------------
  // Patient Profiles
  // ---------------------------------------------------------------------------
  async createPatientProfile(
    familyId: string,
    profileData: Omit<PatientProfile, 'id' | 'family_id' | 'health_id' | 'created_by' | 'created_at' | 'updated_at'>,
    userId: string
  ): Promise<PatientProfile> {
    const membership = await db.getUserMembership(familyId, userId);
    if (!membership || !['owner', 'adult', 'guardian'].includes(membership.role)) {
      throw createError('Only family owners, adults, or guardians can create patient profiles.', 403);
    }

    const healthId = generateHealthId();

    return db.createPatientProfile({
      ...profileData,
      family_id: familyId,
      health_id: healthId,
      created_by: userId,
    });
  }

  async getFamilyPatientProfiles(familyId: string, userId: string): Promise<PatientProfile[]> {
    const membership = await db.getUserMembership(familyId, userId);
    if (!membership || membership.status !== 'active') {
      throw createError('Access denied. You are not a member of this family workspace.', 403);
    }
    return db.getFamilyPatientProfiles(familyId);
  }

  async getPatientProfile(profileId: string, userId: string): Promise<PatientProfile> {
    const profile = await db.getPatientProfileById(profileId);
    if (!profile) throw createError('Patient profile not found.', 404);

    const membership = await db.getUserMembership(profile.family_id, userId);
    if (!membership || membership.status !== 'active') {
      throw createError('Access denied. You are not authorized to view this patient profile.', 403);
    }

    return profile;
  }

  async updatePatientProfile(
    profileId: string,
    updates: Partial<PatientProfile>,
    userId: string
  ): Promise<PatientProfile> {
    const profile = await db.getPatientProfileById(profileId);
    if (!profile) throw createError('Patient profile not found.', 404);

    const membership = await db.getUserMembership(profile.family_id, userId);
    if (!membership || !['owner', 'adult', 'guardian'].includes(membership.role)) {
      throw createError('Caregivers or read-only members cannot modify patient profile details.', 403);
    }

    return db.updatePatientProfile(profileId, updates);
  }

  // ---------------------------------------------------------------------------
  // Caregiver Relationships
  // ---------------------------------------------------------------------------
  async assignCaregiver(
    familyId: string,
    caregiverUserId: string,
    patientProfileId: string,
    requestingUserId: string
  ): Promise<CaregiverRelationship> {
    const membership = await db.getUserMembership(familyId, requestingUserId);
    if (!membership || membership.role !== 'owner') {
      throw createError('Only family owners can establish caregiver access.', 403);
    }

    const patient = await db.getPatientProfileById(patientProfileId);
    if (!patient || patient.family_id !== familyId) {
      throw createError('Patient profile not found in this family.', 404);
    }

    return db.assignCaregiver({
      family_id: familyId,
      caregiver_user_id: caregiverUserId,
      patient_profile_id: patientProfileId,
      permissions: { view_records: true, view_medications: true },
      created_by: requestingUserId,
    });
  }

  async getCaregivers(familyId: string, userId: string): Promise<CaregiverRelationship[]> {
    const membership = await db.getUserMembership(familyId, userId);
    if (!membership || membership.status !== 'active') {
      throw createError('Access denied. You are not a member of this family workspace.', 403);
    }
    return db.getCaregiverRelationships(familyId);
  }
}

export const familyService = new FamilyService();
