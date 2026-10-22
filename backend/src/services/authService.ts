/**
 * backend/src/services/authService.ts
 *
 * Handles User registration, authentication, token verification, and password recovery.
 * Coordinates with Supabase Auth or In-Memory Demo Auth.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';
import { db } from '../repositories/database.js';
import { createError } from '../middlewares/errorHandler.js';
import { UserProfile } from '../types/models.js';

export interface AuthResult {
  user: UserProfile;
  token: string;
}

export class AuthService {
  private supabaseAuth: SupabaseClient | null = null;

  constructor() {
    if (!config.isDemoMode && config.supabase.url && config.supabase.anonKey) {
      this.supabaseAuth = createClient(config.supabase.url, config.supabase.anonKey);
    }
  }

  async register(email: string, password: string, fullName: string, phone?: string): Promise<AuthResult> {
    const cleanEmail = email.toLowerCase().trim();

    if (config.isDemoMode || !this.supabaseAuth) {
      const user = await db.registerDemoUser(cleanEmail, password, fullName, phone);
      // In demo mode, token is an opaque user session identifier
      const token = `demo-token-${user.id}`;
      return { user, token };
    }

    // Live Supabase Auth
    const { data, error } = await this.supabaseAuth.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          phone: phone?.trim(),
        },
      },
    });

    if (error || !data.user) {
      throw createError(error?.message ?? 'Registration failed with Supabase Auth', 400);
    }

    // Upsert to public.profiles
    const profile = await db.upsertProfile({
      id: data.user.id,
      email: cleanEmail,
      full_name: fullName.trim(),
      phone: phone?.trim() ?? null,
    });

    return {
      user: profile,
      token: data.session?.access_token ?? `pending-verification-${profile.id}`,
    };
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const cleanEmail = email.toLowerCase().trim();

    if (config.isDemoMode || !this.supabaseAuth) {
      const user = await db.authenticateDemoUser(cleanEmail, password);
      if (!user) {
        throw createError('Invalid email or password', 401);
      }
      return {
        user,
        token: `demo-token-${user.id}`,
      };
    }

    // Live Supabase Auth
    const { data, error } = await this.supabaseAuth.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error || !data.user || !data.session) {
      throw createError(error?.message ?? 'Invalid email or password', 401);
    }

    const profile = await db.findProfileById(data.user.id);
    if (!profile) {
      // Sync profile if missing
      const newProfile = await db.upsertProfile({
        id: data.user.id,
        email: cleanEmail,
        full_name: data.user.user_metadata?.full_name ?? '',
      });
      return { user: newProfile, token: data.session.access_token };
    }

    return { user: profile, token: data.session.access_token };
  }

  async verifyToken(token: string): Promise<UserProfile | null> {
    if (!token) return null;

    if (config.isDemoMode || token.startsWith('demo-token-')) {
      const userId = token.replace('demo-token-', '');
      return db.findProfileById(userId);
    }

    if (!this.supabaseAuth) return null;

    try {
      const { data, error } = await this.supabaseAuth.auth.getUser(token);
      if (error || !data.user) return null;
      return db.findProfileById(data.user.id);
    } catch (err) {
      logger.error('Error verifying Supabase token', err);
      return null;
    }
  }

  async requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    const cleanEmail = email.toLowerCase().trim();

    if (config.isDemoMode || !this.supabaseAuth) {
      logger.info(`[Demo Auth] Password reset requested for ${cleanEmail}`);
      return {
        success: true,
        message: 'Password reset link sent (simulated demo notification).',
      };
    }

    const { error } = await this.supabaseAuth.auth.resetPasswordForEmail(cleanEmail);
    if (error) {
      throw createError(error.message, 400);
    }

    return {
      success: true,
      message: 'Password recovery email sent if the account exists.',
    };
  }
}

export const authService = new AuthService();
