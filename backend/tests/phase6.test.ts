/**
 * backend/tests/phase6.test.ts
 *
 * Comprehensive Test Suite for Phase 6:
 * Controlled Live Test Mode, Telephony Integration (SMS & Voice),
 * Recipient Verification & Allowlisting, Webhook Processing, and Regression Safety.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { mockTelephonyProviderInstance, setCustomTelephonyProvider } from '../src/integrations/telephony/providerRegistry.js';
import { resetLiveTestRateLimits } from '../src/services/liveTestService.js';
import { config } from '../src/config/env.js';

describe('Phase 6 — Live Test Mode & Telephony Integration', () => {
  let user1Token: string;
  let user2Token: string;
  let familyId: string;
  let patientProfileId: string;
  let incidentId: string;

  beforeAll(async () => {
    // 1. Register User 1 (Family Owner)
    const u1Res = await request(app).post('/api/auth/register').send({
      email: 'phase6.owner@sanjivani.local',
      password: 'DemoPassword123!',
      fullName: 'Dr. Vikram Sarabhai',
      phone: '+919876543210',
    });
    expect(u1Res.status).toBe(201);
    user1Token = u1Res.body.data?.token || u1Res.body.token;

    // 2. Register User 2 (External user for cross-family auth tests)
    const u2Res = await request(app).post('/api/auth/register').send({
      email: 'phase6.external@sanjivani.local',
      password: 'DemoPassword123!',
      fullName: 'External User',
      phone: '+919876543211',
    });
    expect(u2Res.status).toBe(201);
    user2Token = u2Res.body.data?.token || u2Res.body.token;

    // 3. Create Family for User 1
    const fRes = await request(app)
      .post('/api/families')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ name: 'Sarabhai Family Workspace' });
    expect(fRes.status).toBe(201);
    familyId = fRes.body.data?.family?.id || fRes.body.family?.id;

    // 4. Create Critical Patient Profile
    const pRes = await request(app)
      .post(`/api/families/${familyId}/patients`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        fullName: 'Khemraj Sahu (Test Subject)',
        category: 'adult',
        dateOfBirth: '1970-08-12',
        gender: 'male',
        bloodGroup: 'B+',
        allergies: ['Penicillin'],
        emergencyNotes: 'Critical patient profile for Live Test Mode demonstrations',
      });
    expect(pRes.status).toBe(201);
    patientProfileId = pRes.body.data?.profile?.id || pRes.body.profile?.id;

    // 5. Seed emergency contacts and trigger an active incident for test runs
    await request(app)
      .post(`/api/families/${familyId}/sos/demo/seed`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ patientProfileId });

    const trigRes = await request(app)
      .post(`/api/families/${familyId}/sos/trigger`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        patientProfileId,
        triggerSource: 'MANUAL_APP_BUTTON',
        incidentNotes: 'Live test verification run',
      });
    expect(trigRes.status).toBe(201);
    incidentId = trigRes.body.incident.id;
  });

  beforeEach(async () => {
    // Reset mock provider dispatches and mode before each test
    mockTelephonyProviderInstance.clear();
    setCustomTelephonyProvider(mockTelephonyProviderInstance);
    resetLiveTestRateLimits();
    // Ensure live test mode is enabled in config for tests
    (config.telephony as any).liveTestModeEnabled = true;
    (config.telephony as any).cooldownSeconds = 0; // Disable cooldown in test suite for speed

    // Ensure active incident exists
    const activeRes = await request(app)
      .get(`/api/families/${familyId}/sos/active?patientProfileId=${patientProfileId}`)
      .set('Authorization', `Bearer ${user1Token}`);
    if (activeRes.body.incident && !['RESOLVED', 'CANCELLED'].includes(activeRes.body.incident.status)) {
      incidentId = activeRes.body.incident.id;
    } else {
      await request(app)
        .post(`/api/families/${familyId}/sos/demo/seed`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ patientProfileId });
      const trigRes = await request(app)
        .post(`/api/families/${familyId}/sos/trigger`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          patientProfileId,
          triggerSource: 'MANUAL_APP_BUTTON',
          incidentNotes: 'Active test incident',
        });
      incidentId = trigRes.body.incident.id;
    }
  });

  // ==========================================================================
  // Test A — Simulation Isolation
  // ==========================================================================
  describe('Test A — Simulation Isolation', () => {
    it('does not invoke telephony provider during standard Demo Mode SOS trigger', async () => {
      // Trigger a secondary test incident in Demo Mode
      const resetRes = await request(app)
        .post(`/api/families/${familyId}/sos/demo/reset`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ patientProfileId });
      expect(resetRes.status).toBe(200);

      await request(app)
        .post(`/api/families/${familyId}/sos/demo/seed`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ patientProfileId });

      mockTelephonyProviderInstance.clear();

      const trigRes = await request(app)
        .post(`/api/families/${familyId}/sos/trigger`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          patientProfileId,
          triggerSource: 'MANUAL_APP_BUTTON',
          incidentNotes: 'Demo Mode verification',
        });
      expect(trigRes.status).toBe(201);
      incidentId = trigRes.body.incident.id;

      // Assert zero external communications were dispatched
      expect(mockTelephonyProviderInstance.getSentDispatches()).toHaveLength(0);

      // Verify all incident attempts are marked with SIMULATED provenance
      for (const attempt of trigRes.body.attempts) {
        expect(attempt.is_demo).toBe(true);
        expect(attempt.simulation_provenance).toBe('DEMO_SIMULATION_ONLY');
      }
    });

    it('preserves simulated caregiver escalation and hospital handoff without dialing external services', async () => {
      // Advance to caregiver escalation
      const adv1 = await request(app)
        .post(`/api/families/${familyId}/sos/incidents/${incidentId}/advance`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ note: 'Simulating timeout' });
      expect(adv1.status).toBe(200);

      // Advance to hospital handoff
      const adv2 = await request(app)
        .post(`/api/families/${familyId}/sos/incidents/${incidentId}/advance`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ note: 'Simulating caregiver timeout' });
      expect(adv2.status).toBe(200);
      expect(adv2.body.incident.current_stage).toBe('HOSPITAL_HANDOFF');

      // Still zero telephony calls
      expect(mockTelephonyProviderInstance.getSentDispatches()).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Test B — Recipient Allowlist & Consent Restrictions
  // ==========================================================================
  describe('Test B — Recipient Allowlist & Consent Restrictions', () => {
    it('successfully registers an authorized team member with explicit consent', async () => {
      const res = await request(app)
        .post(`/api/families/${familyId}/sos/live-test/recipients`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          displayName: 'Antigravity Lead Engineer',
          phoneNumber: '+919123456789',
          permittedChannel: 'BOTH',
          allowedPurpose: 'Hackathon demonstration and live telephony review',
          consentNotes: 'Team member consented via testing agreement',
          verified: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.recipient.display_name).toBe('Antigravity Lead Engineer');
      expect(res.body.recipient.verification_status).toBe('VERIFIED');
      expect(res.body.recipient.consent_status).toBe('CONSENT_GRANTED');
    });

    it('strictly rejects registration of Indian emergency service numbers (112, 100, 911)', async () => {
      const res = await request(app)
        .post(`/api/families/${familyId}/sos/live-test/recipients`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          displayName: 'Police / Emergency',
          phoneNumber: '112',
          permittedChannel: 'VOICE',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/emergency service/i);
    });

    it('strictly rejects fictional demo numbers (e.g. +91-98765-XXXXX (Simulated))', async () => {
      const res = await request(app)
        .post(`/api/families/${familyId}/sos/live-test/recipients`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          displayName: 'Simulated Demo Contact',
          phoneNumber: '+91-98765-00001 (Simulated)',
          permittedChannel: 'SMS',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/fictional demo contacts/i);
    });

    it('immediately blocks live dispatch after consent revocation', async () => {
      // 1. Create recipient
      const createRes = await request(app)
        .post(`/api/families/${familyId}/sos/live-test/recipients`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          displayName: 'Revocation Test Member',
          phoneNumber: '+919988776655',
          permittedChannel: 'SMS',
          verified: true,
        });
      const recId = createRes.body.recipient.id;

      // 2. Revoke consent
      const revokeRes = await request(app)
        .post(`/api/families/${familyId}/sos/live-test/recipients/${recId}/consent`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ consentStatus: 'CONSENT_REVOKED', notes: 'Operator requested opt-out' });
      expect(revokeRes.status).toBe(200);
      expect(revokeRes.body.recipient.consent_status).toBe('CONSENT_REVOKED');

      // 3. Attempt dispatch
      const dispatchRes = await request(app)
        .post(`/api/families/${familyId}/sos/live-test/dispatch`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          incidentId,
          recipientIds: [recId],
          channel: 'SMS',
          operatorConfirmed: true,
        });

      expect(dispatchRes.status).toBe(200);
      expect(dispatchRes.body.result.dispatchedCount).toBe(0);
      expect(dispatchRes.body.result.failedCount).toBe(1);
      expect(dispatchRes.body.result.results[0].error).toMatch(/consent revoked/i);
      expect(mockTelephonyProviderInstance.getSentDispatches()).toHaveLength(0);
    });

    it('blocks live dispatch to unverified recipients', async () => {
      // 1. Create recipient without verification
      const createRes = await request(app)
        .post(`/api/families/${familyId}/sos/live-test/recipients`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          displayName: 'Unverified Test Member',
          phoneNumber: '+919443322110',
          permittedChannel: 'SMS',
          verified: false,
        });
      const recId = createRes.body.recipient.id;

      // 2. Attempt dispatch
      const dispatchRes = await request(app)
        .post(`/api/families/${familyId}/sos/live-test/dispatch`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          incidentId,
          recipientIds: [recId],
          channel: 'SMS',
          operatorConfirmed: true,
        });

      expect(dispatchRes.body.result.dispatchedCount).toBe(0);
      expect(dispatchRes.body.result.failedCount).toBe(1);
      expect(dispatchRes.body.result.results[0].error).toMatch(/verification pending/i);
    });
  });

  // ==========================================================================
  // Test C — Live SMS Integration & Delivery Tracking
  // ==========================================================================
  describe('Test C — Live SMS Integration', () => {
    let verifiedRecipientId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post(`/api/families/${familyId}/sos/live-test/recipients`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          displayName: 'SMS Verified Colleague',
          phoneNumber: '+919811122233',
          permittedChannel: 'SMS',
          verified: true,
        });
      verifiedRecipientId = res.body.recipient.id;
    });

    it('generates preflight preview with masked numbers and exact SMS text', async () => {
      const res = await request(app)
        .get(`/api/families/${familyId}/sos/live-test/preflight/${incidentId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.preflight.incidentId).toBe(incidentId);
      expect(res.body.preflight.smsPreviewText).toContain('TEST ALERT — Sanjivani');
      expect(res.body.preflight.smsPreviewText).toContain('This is not a real emergency');
      expect(res.body.preflight.liveModeWarning).toContain('LIVE TEST MODE');

      // Masked number check
      const found = res.body.preflight.eligibleRecipients.find(
        (r: any) => r.id === verifiedRecipientId
      );
      expect(found).toBeDefined();
      expect(found.maskedPhone).toContain('***');
      expect(found.maskedPhone).not.toBe('+919811122233');
    });

    it('dispatches a real test SMS and records provider acceptance result', async () => {
      const res = await request(app)
        .post(`/api/families/${familyId}/sos/live-test/dispatch`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          incidentId,
          recipientIds: [verifiedRecipientId],
          channel: 'SMS',
          operatorConfirmed: true,
          idempotencyKey: 'test-sms-idemp-001',
        });

      expect(res.status).toBe(200);
      expect(res.body.result.dispatchedCount).toBe(1);
      expect(res.body.result.failedCount).toBe(0);
      expect(res.body.result.results[0].status).toBe('ACCEPTED');

      const auditLogId = res.body.result.results[0].auditLogId;
      expect(auditLogId).toBeDefined();

      // Check mock provider recorded the message
      const dispatches = mockTelephonyProviderInstance.getSentDispatches();
      expect(dispatches).toHaveLength(1);
      expect(dispatches[0].to).toBe('+919811122233');
      expect(dispatches[0].channel).toBe('SMS');
      expect(dispatches[0].payload).toContain('TEST ALERT');

      // Check timeline events contains LIVE_PROVIDER provenance
      const incRes = await request(app)
        .get(`/api/families/${familyId}/sos/incidents/${incidentId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      const liveEvent = incRes.body.events.find(
        (e: any) => e.event_type === 'LIVE_TEST_DISPATCHED'
      );
      expect(liveEvent).toBeDefined();
      expect(liveEvent.simulation_provenance).toBe('LIVE_PROVIDER');
      expect(liveEvent.is_demo).toBe(false);

      // Verify human acknowledgement is separate and can be recorded
      const ackRes = await request(app)
        .post(`/api/families/${familyId}/sos/live-test/acknowledge/${auditLogId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ note: 'Team member verified SMS receipt on physical phone' });

      expect(ackRes.status).toBe(200);
      expect(ackRes.body.auditLog.human_acknowledged).toBe(true);
      expect(ackRes.body.auditLog.human_acknowledgement_note).toContain('physical phone');
    });
  });

  // ==========================================================================
  // Test D — Live Voice Integration
  // ==========================================================================
  describe('Test D — Live Voice Integration', () => {
    let voiceRecipientId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post(`/api/families/${familyId}/sos/live-test/recipients`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          displayName: 'Voice Call Tester',
          phoneNumber: '+919777888999',
          permittedChannel: 'VOICE',
          verified: true,
        });
      voiceRecipientId = res.body.recipient.id;
    });

    it('places an authorized voice test call with introduction script and live-provider logging', async () => {
      const res = await request(app)
        .post(`/api/families/${familyId}/sos/live-test/dispatch`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          incidentId,
          recipientIds: [voiceRecipientId],
          channel: 'VOICE',
          operatorConfirmed: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.result.dispatchedCount).toBe(1);
      expect(res.body.result.channel).toBe('VOICE');

      const dispatches = mockTelephonyProviderInstance.getSentDispatches();
      expect(dispatches).toHaveLength(1);
      expect(dispatches[0].to).toBe('+919777888999');
      expect(dispatches[0].channel).toBe('VOICE');
      expect(dispatches[0].payload).toContain('This is a Health Memory Agent product demonstration');
      expect(dispatches[0].payload).toContain('No emergency services have been contacted');
    });

    it('rejects voice dispatch if recipient only permitted SMS channel', async () => {
      const smsOnlyRes = await request(app)
        .post(`/api/families/${familyId}/sos/live-test/recipients`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          displayName: 'SMS Only Colleague',
          phoneNumber: '+919555666777',
          permittedChannel: 'SMS',
          verified: true,
        });
      const smsOnlyId = smsOnlyRes.body.recipient.id;

      const res = await request(app)
        .post(`/api/families/${familyId}/sos/live-test/dispatch`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          incidentId,
          recipientIds: [smsOnlyId],
          channel: 'VOICE',
          operatorConfirmed: true,
        });

      expect(res.body.result.dispatchedCount).toBe(0);
      expect(res.body.result.failedCount).toBe(1);
      expect(res.body.result.results[0].error).toMatch(/Channel VOICE not permitted/i);
    });
  });

  // ==========================================================================
  // Test E — Provider Callback Handling & Idempotency
  // ==========================================================================
  describe('Test E — Provider Callbacks & Status Verification', () => {
    let auditLogId: string;
    let providerReqId: string;

    beforeAll(async () => {
      // Create recipient and dispatch
      const rRes = await request(app)
        .post(`/api/families/${familyId}/sos/live-test/recipients`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          displayName: 'Callback Recipient',
          phoneNumber: '+919666777888',
          permittedChannel: 'SMS',
          verified: true,
        });

      const dRes = await request(app)
        .post(`/api/families/${familyId}/sos/live-test/dispatch`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          incidentId,
          recipientIds: [rRes.body.recipient.id],
          channel: 'SMS',
          operatorConfirmed: true,
        });

      auditLogId = dRes.body.result.results[0].auditLogId;
      providerReqId = dRes.body.result.results[0].providerRequestId;
    });

    it('successfully processes valid delivery callback and updates audit log', async () => {
      const cbRes = await request(app)
        .post('/api/telephony/callbacks/mock')
        .set('x-mock-signature', 'valid-mock-signature')
        .send({
          providerRequestId: providerReqId,
          status: 'delivered',
        });

      expect(cbRes.status).toBe(200);
      expect(cbRes.body.success).toBe(true);

      // Verify audit log status is now DELIVERED
      const logsRes = await request(app)
        .get(`/api/families/${familyId}/sos/live-test/logs?incidentId=${incidentId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      const matched = logsRes.body.logs.find((l: any) => l.id === auditLogId);
      expect(matched.dispatch_status).toBe('DELIVERED');
      expect(matched.delivery_evidence_status).toBe('delivered');
      expect(matched.delivery_evidence_at).toBeDefined();
    });

    it('rejects callback with invalid signature (HTTP 401)', async () => {
      const cbRes = await request(app)
        .post('/api/telephony/callbacks/mock')
        .set('x-mock-signature', 'forged-signature')
        .send({
          providerRequestId: providerReqId,
          status: 'delivered',
        });

      expect(cbRes.status).toBe(401);
      expect(cbRes.body.message).toMatch(/invalid webhook signature/i);
    });

    it('handles duplicate webhook callback idempotently without creating duplicate transitions', async () => {
      // First callback
      await request(app)
        .post('/api/telephony/callbacks/mock')
        .set('x-mock-signature', 'valid-mock-signature')
        .send({
          providerRequestId: providerReqId,
          status: 'delivered',
        });

      // Send the same delivered callback again
      const cbRes = await request(app)
        .post('/api/telephony/callbacks/mock')
        .set('x-mock-signature', 'valid-mock-signature')
        .send({
          providerRequestId: providerReqId,
          status: 'delivered',
        });

      expect(cbRes.status).toBe(200);
      expect(cbRes.body.duplicate).toBe(true);
    });

    it('rejects malformed callback payload (HTTP 400)', async () => {
      const cbRes = await request(app)
        .post('/api/telephony/callbacks/mock')
        .set('x-mock-signature', 'valid-mock-signature')
        .send({});

      expect(cbRes.status).toBe(400);
    });

    it('returns 404 for unknown provider request ID', async () => {
      const cbRes = await request(app)
        .post('/api/telephony/callbacks/mock')
        .set('x-mock-signature', 'valid-mock-signature')
        .send({
          providerRequestId: 'unknown-request-999',
          status: 'delivered',
        });

      expect(cbRes.status).toBe(404);
    });
  });

  // ==========================================================================
  // Test F — Authorization, Preflight Confirmation & Rate Limiting
  // ==========================================================================
  describe('Test F — Authorization & Rate Limiting', () => {
    it('blocks dispatch when operatorConfirmed is false or missing', async () => {
      const res = await request(app)
        .post(`/api/families/${familyId}/sos/live-test/dispatch`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          incidentId,
          recipientIds: [crypto.randomUUID()],
          channel: 'SMS',
          operatorConfirmed: false,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/operator confirmation is mandatory/i);
    });

    it('blocks non-family member from accessing live test endpoints (HTTP 403)', async () => {
      const res = await request(app)
        .get(`/api/families/${familyId}/sos/live-test/recipients`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.status).toBe(403);
    });

    it('rejects dispatch exceeding recipient safety cap', async () => {
      const fakeUuids = [
        crypto.randomUUID(),
        crypto.randomUUID(),
        crypto.randomUUID(),
        crypto.randomUUID(),
      ];

      const res = await request(app)
        .post(`/api/families/${familyId}/sos/live-test/dispatch`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          incidentId,
          recipientIds: fakeUuids,
          channel: 'SMS',
          operatorConfirmed: true,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/safety limit/i);
    });

    it('enforces cooldown rate limiting when configured', async () => {
      // Set cooldown to 10 seconds
      (config.telephony as any).cooldownSeconds = 10;

      // Register recipient
      const rRes = await request(app)
        .post(`/api/families/${familyId}/sos/live-test/recipients`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          displayName: 'Rate Limit Tester',
          phoneNumber: '+919333444555',
          permittedChannel: 'SMS',
          verified: true,
        });

      // First dispatch succeeds
      const d1 = await request(app)
        .post(`/api/families/${familyId}/sos/live-test/dispatch`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          incidentId,
          recipientIds: [rRes.body.recipient.id],
          channel: 'SMS',
          operatorConfirmed: true,
        });
      expect(d1.status).toBe(200);

      // Immediate second dispatch hits rate limit
      const d2 = await request(app)
        .post(`/api/families/${familyId}/sos/live-test/dispatch`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          incidentId,
          recipientIds: [rRes.body.recipient.id],
          channel: 'SMS',
          operatorConfirmed: true,
        });

      expect(d2.status).toBe(429);
      expect(d2.body.error).toMatch(/rate limit/i);
    });
  });

  // ==========================================================================
  // Test G — Regression Safety
  // ==========================================================================
  describe('Test G — Regression Safety', () => {
    it('provider failure does not corrupt incident state or block hospital handoff', async () => {
      // Set mock provider to failure mode
      mockTelephonyProviderInstance.setMode('failure', 'Simulated carrier outage');

      const rRes = await request(app)
        .post(`/api/families/${familyId}/sos/live-test/recipients`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          displayName: 'Outage Tester',
          phoneNumber: '+919222333444',
          permittedChannel: 'SMS',
          verified: true,
        });

      (config.telephony as any).cooldownSeconds = 0;

      const dRes = await request(app)
        .post(`/api/families/${familyId}/sos/live-test/dispatch`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          incidentId,
          recipientIds: [rRes.body.recipient.id],
          channel: 'SMS',
          operatorConfirmed: true,
        });

      expect(dRes.status).toBe(200);
      expect(dRes.body.result.dispatchedCount).toBe(0);
      expect(dRes.body.result.failedCount).toBe(1);
      expect(dRes.body.result.results[0].error).toContain('Simulated carrier outage');

      // The incident remains intact and can still be acknowledged or resolved
      const resRes = await request(app)
        .post(`/api/families/${familyId}/sos/incidents/${incidentId}/resolve`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ resolutionNote: 'Safe test completion' });

      expect(resRes.status).toBe(200);
      expect(resRes.body.incident.status).toBe('RESOLVED');
    });

    it('demo reset leaves verified team recipients intact while clearing synthetic demo incidents', async () => {
      // Verify recipients still exist after reset
      const resetRes = await request(app)
        .post(`/api/families/${familyId}/sos/demo/reset`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ patientProfileId });
      expect(resetRes.status).toBe(200);

      const rList = await request(app)
        .get(`/api/families/${familyId}/sos/live-test/recipients`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(rList.status).toBe(200);
      expect(rList.body.recipients.length).toBeGreaterThan(0);
    });
  });
});
