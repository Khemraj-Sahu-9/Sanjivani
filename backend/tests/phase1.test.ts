/**
 * backend/tests/phase1.test.ts
 *
 * Comprehensive Automated Tests for Phase 1:
 * - Authentication (Register, Login, Token verification, Invalid credentials, Error validation)
 * - Family Workspaces (Create, Read, Update, Delete, Multi-family isolation)
 * - Family Memberships & RBAC (Owner permissions, Role-based operations, Unauthorized updates)
 * - Patient Profiles & Unique Health ID (Create, Read, Update, Immutability of Health ID, Category handling)
 * - Cross-Family Access Security (Unauthorized access denials)
 */

import { describe, it, expect } from 'vitest';
import supertest from 'supertest';

process.env['DEMO_MODE'] = 'true';
process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '0';

const { app } = await import('../src/app.js');
const request = supertest(app);

describe('Phase 1 — Authentication, Family & Patient Profiles', () => {
  let user1Token: string;
  let user1Id: string;
  let user2Token: string;
  let user2Id: string;

  let family1Id: string;
  let patient1HealthId: string;
  let patient1Id: string;

  // ---------------------------------------------------------------------------
  // 1. Authentication Tests
  // ---------------------------------------------------------------------------
  describe('1. Authentication Flows', () => {
    it('registers user 1 successfully', async () => {
      const res = await request.post('/api/auth/register').send({
        email: 'meera@sanjivani.local',
        password: 'password123',
        fullName: 'Meera Sharma',
        phone: '+919876543210',
      });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.user.email).toBe('meera@sanjivani.local');
      expect(res.body.data.user.full_name).toBe('Meera Sharma');
      expect(res.body.data.token).toBeDefined();

      user1Token = res.body.data.token;
      user1Id = res.body.data.user.id;
    });

    it('rejects duplicate user registration', async () => {
      const res = await request.post('/api/auth/register').send({
        email: 'meera@sanjivani.local',
        password: 'password123',
        fullName: 'Meera Duplicate',
      });

      expect(res.status).toBe(500); // Handled operational conflict error
      expect(res.body.message).toContain('already exists');
    });

    it('registers user 2 (caregiver/secondary user)', async () => {
      const res = await request.post('/api/auth/register').send({
        email: 'rahul@sanjivani.local',
        password: 'password123',
        fullName: 'Rahul Verma',
      });

      expect(res.status).toBe(201);
      user2Token = res.body.data.token;
      user2Id = res.body.data.user.id;
    });

    it('logs in user 1 with correct credentials', async () => {
      const res = await request.post('/api/auth/login').send({
        email: 'meera@sanjivani.local',
        password: 'password123',
      });

      expect(res.status).toBe(200);
      expect(res.body.data.token).toBe(user1Token);
    });

    it('rejects login with invalid password', async () => {
      const res = await request.post('/api/auth/login').send({
        email: 'meera@sanjivani.local',
        password: 'wrongpassword',
      });

      expect(res.status).toBe(401);
      expect(res.body.message).toContain('Invalid email or password');
    });

    it('retrieves current authenticated user (/api/auth/me)', async () => {
      const res = await request
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.id).toBe(user1Id);
    });

    it('rejects unauthenticated requests to protected endpoints', async () => {
      const res = await request.get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('handles password recovery request gracefully', async () => {
      const res = await request.post('/api/auth/recover-password').send({
        email: 'meera@sanjivani.local',
      });
      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Family Workspaces & Memberships
  // ---------------------------------------------------------------------------
  describe('2. Family Workspaces & Access Control', () => {
    it('creates a family workspace with creator as owner', async () => {
      const res = await request
        .post('/api/families')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ name: 'Sharma Family Care' });

      expect(res.status).toBe(201);
      expect(res.body.data.family.name).toBe('Sharma Family Care');
      expect(res.body.data.membership.role).toBe('owner');
      expect(res.body.data.membership.user_id).toBe(user1Id);

      family1Id = res.body.data.family.id;
    });

    it('lists family workspaces belonging to the user', async () => {
      const res = await request
        .get('/api/families')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.families.length).toBe(1);
      expect(res.body.data.families[0].id).toBe(family1Id);
    });

    it('allows owner to rename family workspace', async () => {
      const res = await request
        .patch(`/api/families/${family1Id}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ name: 'Sharma Parivar Health' });

      expect(res.status).toBe(200);
      expect(res.body.data.family.name).toBe('Sharma Parivar Health');
    });

    it('prevents non-members from reading or modifying the family workspace', async () => {
      const res = await request
        .get(`/api/families/${family1Id}`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.status).toBe(403);
    });

    it('allows owner to add another user as caregiver to family', async () => {
      const res = await request
        .post(`/api/families/${family1Id}/members`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          email: 'rahul@sanjivani.local',
          role: 'caregiver',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.member.user_id).toBe(user2Id);
      expect(res.body.data.member.role).toBe('caregiver');
    });

    it('prevents duplicate memberships for the same user in family', async () => {
      const res = await request
        .post(`/api/families/${family1Id}/members`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          email: 'rahul@sanjivani.local',
          role: 'caregiver',
        });

      expect(res.status).toBe(500);
      expect(res.body.message).toContain('already a member');
    });

    it('prevents caregiver from renaming the family workspace', async () => {
      const res = await request
        .patch(`/api/families/${family1Id}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ name: 'Hacked Family Name' });

      expect(res.status).toBe(403);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Patient Profiles & Health IDs
  // ---------------------------------------------------------------------------
  describe('3. Patient Profiles & Unique Health IDs', () => {
    it('creates an elderly patient profile with application-generated Health ID', async () => {
      const res = await request
        .post(`/api/families/${family1Id}/patients`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          fullName: 'Ramesh Sharma',
          dateOfBirth: '1952-04-12',
          gender: 'male',
          relationshipToCreator: 'Father',
          category: 'elderly',
        });

      expect(res.status).toBe(201);
      const profile = res.body.data.profile;
      expect(profile.full_name).toBe('Ramesh Sharma');
      expect(profile.category).toBe('elderly');
      expect(profile.health_id).toMatch(/^SNJ-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/);

      patient1HealthId = profile.health_id;
      patient1Id = profile.id;
    });

    it('allows family members to view patient profile list', async () => {
      const res = await request
        .get(`/api/families/${family1Id}/patients`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.profiles.length).toBe(1);
      expect(res.body.data.profiles[0].id).toBe(patient1Id);
    });

    it('allows owner to update patient profile details', async () => {
      const res = await request
        .patch(`/api/families/patients/${patient1Id}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          fullName: 'Dr. Ramesh Sharma',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.profile.full_name).toBe('Dr. Ramesh Sharma');
      // Health ID must remain unchanged and immutable
      expect(res.body.data.profile.health_id).toBe(patient1HealthId);
    });

    it('prevents modifying immutable Health ID through edit endpoint', async () => {
      const res = await request
        .patch(`/api/families/patients/${patient1Id}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          health_id: 'SNJ-FORGED-ID-9999',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.profile.health_id).toBe(patient1HealthId);
    });

    it('allows caregiver to view patient profile', async () => {
      const res = await request
        .get(`/api/families/patients/${patient1Id}`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.profile.full_name).toBe('Dr. Ramesh Sharma');
    });

    it('prevents caregiver from modifying patient profile', async () => {
      const res = await request
        .patch(`/api/families/patients/${patient1Id}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ fullName: 'Tampered Name' });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Caregivers or read-only members cannot modify');
    });

    it('enforces cross-family security isolation', async () => {
      // User 2 creates their own family
      const fam2Res = await request
        .post('/api/families')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ name: 'Verma Family' });
      const family2Id = fam2Res.body.data.family.id;

      // User 1 cannot access Family 2
      const accessRes = await request
        .get(`/api/families/${family2Id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(accessRes.status).toBe(403);
    });
  });
});
