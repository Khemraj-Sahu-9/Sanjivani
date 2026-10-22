/**
 * backend/src/controllers/familyController.ts
 *
 * Thin controller for Family workspaces, memberships, and patient profiles.
 */

import { Request, Response, NextFunction } from 'express';
import { familyService } from '../services/familyService.js';
import {
  createFamilySchema,
  updateFamilySchema,
  addMembershipSchema,
  updateMembershipRoleSchema,
  createPatientProfileSchema,
  updatePatientProfileSchema,
} from '../validators/schemas.js';

function getParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] ?? '';
  return param ?? '';
}

export async function createFamily(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const validated = createFamilySchema.parse(req.body);
    const result = await familyService.createFamily(validated.name, req.user!.id);
    res.status(201).json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
}

export async function getUserFamilies(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const families = await familyService.getUserFamilies(req.user!.id);
    res.status(200).json({ status: 'success', data: { families } });
  } catch (err) {
    next(err);
  }
}

export async function getFamily(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const familyId = getParam(req.params['familyId']);
    const result = await familyService.getFamily(familyId, req.user!.id);
    res.status(200).json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
}

export async function updateFamily(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const familyId = getParam(req.params['familyId']);
    const validated = updateFamilySchema.parse(req.body);
    const updated = await familyService.updateFamilyName(familyId, validated.name, req.user!.id);
    res.status(200).json({ status: 'success', data: { family: updated } });
  } catch (err) {
    next(err);
  }
}

export async function getFamilyMembers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const familyId = getParam(req.params['familyId']);
    const members = await familyService.getFamilyMembers(familyId, req.user!.id);
    res.status(200).json({ status: 'success', data: { members } });
  } catch (err) {
    next(err);
  }
}

export async function addMember(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const familyId = getParam(req.params['familyId']);
    const validated = addMembershipSchema.parse(req.body);
    const member = await familyService.addMember(familyId, validated.email, validated.role, req.user!.id);
    res.status(201).json({ status: 'success', data: { member } });
  } catch (err) {
    next(err);
  }
}

export async function updateMemberRole(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const familyId = getParam(req.params['familyId']);
    const userId = getParam(req.params['userId']);
    const validated = updateMembershipRoleSchema.parse(req.body);
    const updated = await familyService.updateMemberRole(familyId, userId, validated.role, req.user!.id);
    res.status(200).json({ status: 'success', data: { member: updated } });
  } catch (err) {
    next(err);
  }
}

export async function removeMember(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const familyId = getParam(req.params['familyId']);
    const userId = getParam(req.params['userId']);
    await familyService.removeMember(familyId, userId, req.user!.id);
    res.status(200).json({ status: 'success', message: 'Member removed successfully' });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Patient Profiles
// ---------------------------------------------------------------------------
export async function createPatientProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const familyId = getParam(req.params['familyId']);
    const validated = createPatientProfileSchema.parse(req.body);
    const profile = await familyService.createPatientProfile(
      familyId,
      {
        full_name: validated.fullName,
        date_of_birth: validated.dateOfBirth,
        gender: validated.gender,
        relationship_to_creator: validated.relationshipToCreator,
        category: validated.category,
        avatar_url: validated.avatarUrl,
        status: 'active',
      },
      req.user!.id
    );
    res.status(201).json({ status: 'success', data: { profile } });
  } catch (err) {
    next(err);
  }
}

export async function getFamilyPatientProfiles(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const familyId = getParam(req.params['familyId']);
    const profiles = await familyService.getFamilyPatientProfiles(familyId, req.user!.id);
    res.status(200).json({ status: 'success', data: { profiles } });
  } catch (err) {
    next(err);
  }
}

export async function getPatientProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const profileId = getParam(req.params['profileId']);
    const profile = await familyService.getPatientProfile(profileId, req.user!.id);
    res.status(200).json({ status: 'success', data: { profile } });
  } catch (err) {
    next(err);
  }
}

export async function updatePatientProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const profileId = getParam(req.params['profileId']);
    const validated = updatePatientProfileSchema.parse(req.body);
    const updated = await familyService.updatePatientProfile(
      profileId,
      {
        ...(validated.fullName ? { full_name: validated.fullName } : {}),
        ...(validated.dateOfBirth !== undefined ? { date_of_birth: validated.dateOfBirth } : {}),
        ...(validated.gender !== undefined ? { gender: validated.gender } : {}),
        ...(validated.relationshipToCreator !== undefined ? { relationship_to_creator: validated.relationshipToCreator } : {}),
        ...(validated.category ? { category: validated.category } : {}),
        ...(validated.avatarUrl !== undefined ? { avatar_url: validated.avatarUrl } : {}),
        ...(validated.status ? { status: validated.status } : {}),
      },
      req.user!.id
    );
    res.status(200).json({ status: 'success', data: { profile: updated } });
  } catch (err) {
    next(err);
  }
}
