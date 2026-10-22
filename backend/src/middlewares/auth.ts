/**
 * backend/src/middlewares/auth.ts
 *
 * Express authentication & authorization middlewares.
 * Validates incoming Bearer tokens and checks family workspace permissions.
 */

import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService.js';
import { db } from '../repositories/database.js';
import { createError } from './errorHandler.js';
import { MembershipRole } from '../types/models.js';

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(createError('Authentication required. Missing or malformed Authorization header.', 401));
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return next(createError('Authentication token missing.', 401));
  }

  try {
    const user = await authService.verifyToken(token);
    if (!user) {
      return next(createError('Invalid or expired authentication session.', 401));
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware factory to enforce family membership and allowed roles.
 */
export function requireFamilyRole(allowedRoles: MembershipRole[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      return next(createError('Authentication required.', 401));
    }

    const familyId = req.params['familyId'] || req.body?.familyId;
    if (!familyId) {
      return next(createError('familyId parameter is required.', 400));
    }

    try {
      const membership = await db.getUserMembership(familyId, req.user.id);
      if (!membership || membership.status !== 'active') {
        return next(createError('Access denied. You are not a member of this family workspace.', 403));
      }

      if (!allowedRoles.includes(membership.role)) {
        return next(
          createError(
            `Access denied. Role '${membership.role}' lacks permission for this action (requires: ${allowedRoles.join(', ')}).`,
            403
          )
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
