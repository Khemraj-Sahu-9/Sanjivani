/**
 * backend/src/services/liveTestService.ts
 *
 * Core service for Phase 6 Live Test Mode:
 * - Controlled test recipient management & explicit consent tracking
 * - Preflight preview and safety checks
 * - Outbound SMS and Voice dispatch via pluggable provider
 * - Delivery evidence & human acknowledgement tracking
 * - Webhook callback processing with signature verification
 */

import { db } from '../repositories/database.js';
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';
import { createError } from '../middlewares/errorHandler.js';
import { getTelephonyProvider } from '../integrations/telephony/providerRegistry.js';
import { WebhookVerificationParams } from '../integrations/telephony/telephonyProvider.interface.js';
import {
  LiveTestAuditLog,
  LiveTestChannel,
  LiveTestConsentStatus,
  LiveTestDispatchRequest,
  LiveTestDispatchResult,
  LiveTestPreflightResponse,
  LiveTestRecipient,
  LiveTestVerificationStatus,
  TelephonyProviderHealth,
} from '../types/models.js';

// Cooldown tracker (in-memory rate limiting per family)
const lastDispatchTimestamps = new Map<string, number>();

// Track processed webhook event IDs to guarantee strict idempotency
const processedWebhookEvents = new Set<string>();

export function resetLiveTestRateLimits(): void {
  lastDispatchTimestamps.clear();
}

/**
 * Normalizes and masks a phone number for safe display.
 * e.g., "+919876543210" -> "+91 98*** **210"
 */
export function maskPhoneNumber(phone: string): string {
  const clean = phone.replace(/\s+/g, '');
  if (clean.length < 8) return '***-***';
  const prefix = clean.slice(0, 5);
  const suffix = clean.slice(-3);
  return `${prefix}*** **${suffix}`;
}

/**
 * Validates whether a phone number is an emergency service or simulated demo contact.
 */
function isRestrictedNumber(phone: string): { restricted: boolean; reason?: string } {
  const clean = phone.replace(/[\s\-().]/g, '');
  const emergencyNumbers = ['112', '911', '100', '101', '102', '108', '1091', '1098'];

  for (const emg of emergencyNumbers) {
    if (clean === emg || clean.endsWith(emg)) {
      return {
        restricted: true,
        reason: `Destination ${phone} is an emergency service number. Dialing emergency services is strictly prohibited.`,
      };
    }
  }

  if (phone.toLowerCase().includes('simulated') || phone.includes('98765-XXXXX') || clean.includes('0000000000')) {
    return {
      restricted: true,
      reason: 'Fictional demo contacts cannot be used for live communications.',
    };
  }

  // Strict E.164 check (must start with + and 7-15 digits)
  const e164Regex = /^\+[1-9]\d{6,14}$/;
  if (!e164Regex.test(clean)) {
    return {
      restricted: true,
      reason: 'Phone number must be a valid international E.164 format (e.g. +919876543210).',
    };
  }

  return { restricted: false };
}

export class LiveTestService {
  /**
   * Returns current provider configuration and health diagnostics.
   */
  getProviderHealth(): TelephonyProviderHealth {
    const provider = getTelephonyProvider();
    return provider.getHealthStatus();
  }

  /**
   * Lists all registered live test recipients for a family.
   */
  async listRecipients(familyId: string): Promise<LiveTestRecipient[]> {
    return db.listLiveTestRecipients(familyId);
  }

  /**
   * Registers a new live test recipient with explicit consent and purpose.
   */
  async addRecipient(
    familyId: string,
    data: {
      displayName: string;
      phoneNumber: string;
      permittedChannel: LiveTestChannel;
      allowedPurpose?: string;
      consentNotes?: string;
      verified?: boolean;
    },
    adminUserId?: string
  ): Promise<LiveTestRecipient> {
    const normalizedPhone = data.phoneNumber.trim().replace(/\s+/g, '');
    const check = isRestrictedNumber(normalizedPhone);
    if (check.restricted) {
      throw createError(check.reason || 'Restricted phone number', 400);
    }

    const now = new Date().toISOString();
    return db.createLiveTestRecipient({
      family_id: familyId,
      display_name: data.displayName.trim(),
      phone_number: normalizedPhone,
      permitted_channel: data.permittedChannel,
      verification_status: data.verified ? 'VERIFIED' : 'UNVERIFIED',
      verification_notes: data.verified ? 'Verified during team registration' : 'Verification pending',
      verified_at: data.verified ? now : null,
      verified_by_user_id: data.verified && adminUserId ? adminUserId : null,
      consent_status: 'CONSENT_GRANTED',
      consent_recorded_at: now,
      consent_notes: data.consentNotes || 'Explicit consent granted for demonstration test communications',
      is_active: true,
      allowed_purpose: data.allowedPurpose || 'Sanjivani Product Demo & Live Telephony Testing',
    });
  }

  /**
   * Updates verification status for a team member recipient.
   */
  async verifyRecipient(
    familyId: string,
    recipientId: string,
    verifierUserId: string,
    status: LiveTestVerificationStatus = 'VERIFIED',
    notes?: string
  ): Promise<LiveTestRecipient> {
    const recipient = await db.getLiveTestRecipient(recipientId);
    if (!recipient || recipient.family_id !== familyId) {
      throw createError('Recipient not found in this family workspace.', 404);
    }

    const now = new Date().toISOString();
    return db.updateLiveTestRecipient(recipientId, {
      verification_status: status,
      verification_notes: notes || `Verification set to ${status} by operator`,
      verified_at: status === 'VERIFIED' ? now : null,
      verified_by_user_id: status === 'VERIFIED' ? verifierUserId : null,
    });
  }

  /**
   * Updates consent status (e.g. revoking consent immediately blocks all subsequent sends).
   */
  async updateConsent(
    familyId: string,
    recipientId: string,
    consentStatus: LiveTestConsentStatus,
    notes?: string
  ): Promise<LiveTestRecipient> {
    const recipient = await db.getLiveTestRecipient(recipientId);
    if (!recipient || recipient.family_id !== familyId) {
      throw createError('Recipient not found in this family workspace.', 404);
    }

    return db.updateLiveTestRecipient(recipientId, {
      consent_status: consentStatus,
      consent_notes: notes || `Consent updated to ${consentStatus}`,
    });
  }

  /**
   * Deletes a recipient record.
   */
  async deleteRecipient(familyId: string, recipientId: string): Promise<void> {
    const recipient = await db.getLiveTestRecipient(recipientId);
    if (!recipient || recipient.family_id !== familyId) {
      throw createError('Recipient not found in this family workspace.', 404);
    }
    await db.deleteLiveTestRecipient(recipientId);
  }

  /**
   * Generates a preflight preview with masked details, exact scripts, and recipient eligibility.
   */
  async getPreflight(familyId: string, incidentId: string): Promise<LiveTestPreflightResponse> {
    const incident = await db.getEmergencyIncidentById(incidentId);
    if (!incident || incident.family_id !== familyId) {
      throw createError('Emergency incident not found.', 404);
    }

    const patient = await db.getPatientProfileById(incident.patient_profile_id);
    const patientName = patient ? patient.full_name : 'Critical Patient (Demo)';
    const healthId = patient ? patient.health_id : 'SNJ-XXXX-XXXX-XXXX';

    const providerHealth = this.getProviderHealth();
    const allRecipients = await db.listLiveTestRecipients(familyId);

    const eligibleRecipients: LiveTestPreflightResponse['eligibleRecipients'] = [];
    const ineligibleRecipients: LiveTestPreflightResponse['ineligibleRecipients'] = [];

    for (const r of allRecipients) {
      if (!r.is_active) {
        ineligibleRecipients.push({
          id: r.id,
          displayName: r.display_name,
          reason: 'Recipient record is deactivated.',
        });
        continue;
      }
      if (r.consent_status !== 'CONSENT_GRANTED') {
        ineligibleRecipients.push({
          id: r.id,
          displayName: r.display_name,
          reason: 'Explicit consent is not granted or was revoked.',
        });
        continue;
      }
      if (r.verification_status !== 'VERIFIED') {
        ineligibleRecipients.push({
          id: r.id,
          displayName: r.display_name,
          reason: `Recipient verification is ${r.verification_status}. Only VERIFIED members can receive alerts.`,
        });
        continue;
      }

      eligibleRecipients.push({
        id: r.id,
        displayName: r.display_name,
        maskedPhone: maskPhoneNumber(r.phone_number),
        permittedChannel: r.permitted_channel,
        verificationStatus: r.verification_status,
        consentStatus: r.consent_status,
      });
    }

    const smsPreviewText = `TEST ALERT — Sanjivani Health Memory Agent product demonstration for ${patientName}. Incident: ${incidentId.slice(0, 8)}. This is not a real emergency. Please acknowledge this test if you have agreed to participate.`;

    const voicePreviewScript = `This is a Health Memory Agent product demonstration for patient ${patientName}. This is a test call, not a real emergency. You agreed to participate in this test. No emergency services have been contacted.`;

    return {
      incidentId,
      patientName,
      healthId,
      liveModeWarning: 'LIVE TEST MODE — REAL TEST COMMUNICATION TO APPROVED RECIPIENTS; REMAINING ESCALATION IS SIMULATED.',
      simulatedEscalationNotice: 'Caregiver escalation, hospital handoff, and emergency services are 100% simulated.',
      providerHealth,
      eligibleRecipients,
      ineligibleRecipients,
      smsPreviewText,
      voicePreviewScript,
    };
  }

  /**
   * Executes a live test dispatch with full guardrails and provenance tracking.
   */
  async dispatchLiveTest(
    familyId: string,
    userId: string,
    params: LiveTestDispatchRequest
  ): Promise<LiveTestDispatchResult> {
    // Safety Gate 1: Operator Confirmation
    if (!params.operatorConfirmed) {
      throw createError('Operator confirmation is mandatory before executing a live test dispatch.', 400);
    }

    // Safety Gate 2: Server-side configuration flag
    if (!config.telephony.liveTestModeEnabled) {
      throw createError(
        'Live Test Mode is disabled on the server. Set LIVE_TEST_MODE_ENABLED=true in backend environment to enable.',
        403
      );
    }

    // Safety Gate 3: Incident check
    const incident = await db.getEmergencyIncidentById(params.incidentId);
    if (!incident || incident.family_id !== familyId) {
      throw createError('Emergency incident not found.', 404);
    }

    const patient = await db.getPatientProfileById(incident.patient_profile_id);
    const patientName = patient ? patient.full_name : 'Critical Patient (Demo)';

    // Safety Gate 4: Provider readiness
    const provider = getTelephonyProvider();
    const health = provider.getHealthStatus();
    if (!health.isConfigured) {
      throw createError(`Telephony provider (${provider.name}) is not configured: ${health.statusMessage}`, 503);
    }

    // Safety Gate 5: Recipient count cap
    if (!params.recipientIds || params.recipientIds.length === 0) {
      throw createError('At least one recipient must be selected.', 400);
    }
    if (params.recipientIds.length > config.telephony.maxRecipients) {
      throw createError(
        `Selected recipients (${params.recipientIds.length}) exceed maximum safety limit of ${config.telephony.maxRecipients}.`,
        400
      );
    }

    // Safety Gate 6: Rate limit / cooldown
    const nowMs = Date.now();
    const lastDispatch = lastDispatchTimestamps.get(familyId) || 0;
    const cooldownMs = config.telephony.cooldownSeconds * 1000;
    if (nowMs - lastDispatch < cooldownMs) {
      const remainingSeconds = Math.ceil((cooldownMs - (nowMs - lastDispatch)) / 1000);
      throw createError(`Rate limit active. Please wait ${remainingSeconds} seconds before sending another live test alert.`, 429);
    }
    lastDispatchTimestamps.set(familyId, nowMs);

    // Prepare message payloads
    const smsText = `TEST ALERT — Sanjivani Health Memory Agent product demonstration for ${patientName}. Incident: ${incident.id.slice(0, 8)}. This is not a real emergency. Please acknowledge this test if you have agreed to participate.`;
    const voiceScript = `This is a Health Memory Agent product demonstration for patient ${patientName}. This is a test call, not a real emergency. You agreed to participate in this test. No emergency services have been contacted.`;

    const results: LiveTestDispatchResult['results'] = [];
    let dispatchedCount = 0;
    let failedCount = 0;

    for (const recipientId of params.recipientIds) {
      const recipient = await db.getLiveTestRecipient(recipientId);
      if (!recipient || recipient.family_id !== familyId) {
        failedCount++;
        results.push({
          recipientId,
          displayName: 'Unknown',
          maskedPhone: '***',
          status: 'FAILED',
          auditLogId: 'none',
          error: 'Recipient record not found.',
        });
        continue;
      }

      // Re-verify eligibility (defense in depth)
      if (!recipient.is_active) {
        failedCount++;
        results.push({
          recipientId,
          displayName: recipient.display_name,
          maskedPhone: maskPhoneNumber(recipient.phone_number),
          status: 'FAILED',
          auditLogId: 'none',
          error: 'Recipient is deactivated.',
        });
        continue;
      }
      if (recipient.consent_status !== 'CONSENT_GRANTED') {
        failedCount++;
        results.push({
          recipientId,
          displayName: recipient.display_name,
          maskedPhone: maskPhoneNumber(recipient.phone_number),
          status: 'FAILED',
          auditLogId: 'none',
          error: 'Consent revoked or not granted.',
        });
        continue;
      }
      if (recipient.verification_status !== 'VERIFIED') {
        failedCount++;
        results.push({
          recipientId,
          displayName: recipient.display_name,
          maskedPhone: maskPhoneNumber(recipient.phone_number),
          status: 'FAILED',
          auditLogId: 'none',
          error: 'Recipient verification pending.',
        });
        continue;
      }
      if (recipient.permitted_channel !== 'BOTH' && recipient.permitted_channel !== params.channel) {
        failedCount++;
        results.push({
          recipientId,
          displayName: recipient.display_name,
          maskedPhone: maskPhoneNumber(recipient.phone_number),
          status: 'FAILED',
          auditLogId: 'none',
          error: `Channel ${params.channel} not permitted for this recipient (allowed: ${recipient.permitted_channel}).`,
        });
        continue;
      }

      const maskedPhone = maskPhoneNumber(recipient.phone_number);
      const payloadPreview = params.channel === 'SMS' ? smsText : voiceScript;

      // Create initial audit log
      const auditLog = await db.createLiveTestAuditLog({
        family_id: familyId,
        incident_id: params.incidentId,
        recipient_id: recipient.id,
        channel: params.channel,
        provider_name: provider.name,
        destination_phone_masked: maskedPhone,
        message_payload_preview: payloadPreview,
        dispatch_status: 'SENDING',
        delivery_evidence_at: null,
        delivery_evidence_status: null,
        human_acknowledged: false,
        human_acknowledged_at: null,
        human_acknowledgement_note: null,
        error_code: null,
        error_message: null,
        raw_provider_response: null,
      });

      // Dispatch via provider
      try {
        let dispatchRes: { success: boolean; status: any; providerRequestId?: string; rawResponse?: any; error?: string };

        if (params.channel === 'SMS') {
          dispatchRes = await provider.sendSms(recipient.phone_number, smsText, {
            idempotencyKey: params.idempotencyKey,
          });
        } else {
          dispatchRes = await provider.initiateVoiceCall(recipient.phone_number, voiceScript, {
            idempotencyKey: params.idempotencyKey,
          });
        }

        if (dispatchRes.success) {
          dispatchedCount++;
          await db.updateLiveTestAuditLog(auditLog.id, {
            provider_request_id: dispatchRes.providerRequestId,
            dispatch_status: dispatchRes.status,
            raw_provider_response: dispatchRes.rawResponse,
          });

          // Record incident timeline event with LIVE_PROVIDER provenance
          await db.createEmergencyIncidentEvent({
            incident_id: params.incidentId,
            event_type: 'LIVE_TEST_DISPATCHED',
            title: `Live Test Alert Dispatched (${params.channel})`,
            description: `Sent real ${params.channel} alert via ${provider.name} to verified recipient ${recipient.display_name} (${maskedPhone}). Provider request ID: ${dispatchRes.providerRequestId || 'none'}.`,
            actor_type: 'DEMO_OPERATOR',
            actor_id: userId,
            stage: 'FAMILY_CONTACT',
            payload: {
              channel: params.channel,
              provider: provider.name,
              providerRequestId: dispatchRes.providerRequestId,
              recipientId: recipient.id,
              maskedPhone,
              status: dispatchRes.status,
            },
            is_demo: false,
            simulation_provenance: 'LIVE_PROVIDER',
          });

          results.push({
            recipientId: recipient.id,
            displayName: recipient.display_name,
            maskedPhone,
            status: dispatchRes.status,
            providerRequestId: dispatchRes.providerRequestId,
            auditLogId: auditLog.id,
          });
        } else {
          failedCount++;
          await db.updateLiveTestAuditLog(auditLog.id, {
            dispatch_status: 'FAILED',
            error_message: dispatchRes.error,
          });

          results.push({
            recipientId: recipient.id,
            displayName: recipient.display_name,
            maskedPhone,
            status: 'FAILED',
            auditLogId: auditLog.id,
            error: dispatchRes.error,
          });
        }
      } catch (err: unknown) {
        failedCount++;
        const msg = err instanceof Error ? err.message : String(err);
        await db.updateLiveTestAuditLog(auditLog.id, {
          dispatch_status: 'FAILED',
          error_message: msg,
        });

        results.push({
          recipientId: recipient.id,
          displayName: recipient.display_name,
          maskedPhone,
          status: 'FAILED',
          auditLogId: auditLog.id,
          error: msg,
        });
      }
    }

    return {
      incidentId: params.incidentId,
      channel: params.channel,
      providerName: provider.name,
      dispatchedCount,
      failedCount,
      results,
      simulationNotice:
        'Live communication dispatched to verified team recipients only. Caregiver escalation and hospital handoff remain simulated.',
    };
  }

  /**
   * Records human acknowledgement from a test recipient.
   */
  async recordHumanAcknowledgement(
    familyId: string,
    auditLogId: string,
    note?: string
  ): Promise<LiveTestAuditLog> {
    const auditLog = await db.getLiveTestAuditLog(auditLogId);
    if (!auditLog || auditLog.family_id !== familyId) {
      throw createError('Live test audit record not found.', 404);
    }

    const now = new Date().toISOString();
    const updated = await db.updateLiveTestAuditLog(auditLogId, {
      human_acknowledged: true,
      human_acknowledged_at: now,
      human_acknowledgement_note: note || 'Recipient explicitly acknowledged receipt of the test notification.',
    });

    const recipient = await db.getLiveTestRecipient(auditLog.recipient_id);
    const recipientName = recipient ? recipient.display_name : 'Verified Recipient';

    // Record timeline event
    await db.createEmergencyIncidentEvent({
      incident_id: auditLog.incident_id,
      event_type: 'LIVE_TEST_HUMAN_ACKNOWLEDGED',
      title: 'Live Test Human Acknowledgement',
      description: `${recipientName} (${auditLog.destination_phone_masked}) confirmed receipt of the live test alert.`,
      actor_type: 'CONTACT',
      actor_id: auditLog.recipient_id,
      stage: 'FAMILY_CONTACT',
      payload: {
        auditLogId: auditLog.id,
        channel: auditLog.channel,
        note: updated.human_acknowledgement_note,
        acknowledgedAt: now,
      },
      is_demo: false,
      simulation_provenance: 'HUMAN_ACKNOWLEDGEMENT',
    });

    return updated;
  }

  /**
   * Processes an incoming delivery or call status callback with signature verification and idempotency.
   */
  async processProviderWebhook(
    providerName: 'twilio' | 'exotel' | 'mock',
    params: WebhookVerificationParams
  ): Promise<{ success: boolean; statusCode: number; message: string; duplicate?: boolean }> {
    const provider = getTelephonyProvider();
    if (provider.name !== providerName && providerName !== 'mock') {
      logger.warn('[LiveTestService] Webhook received for non-active provider', { providerName, active: provider.name });
    }

    // 1. Signature verification
    const isValid = provider.verifyWebhookSignature(params);
    if (!isValid) {
      logger.warn('[LiveTestService] Webhook signature verification failed', { providerName });
      return { success: false, statusCode: 401, message: 'Invalid webhook signature.' };
    }

    // 2. Parse payload
    const parsed = provider.parseWebhookPayload(params.bodyParams || {});
    if (!parsed) {
      return { success: false, statusCode: 400, message: 'Malformed callback payload.' };
    }

    // 3. Strict Idempotency Check
    const eventKey = `${providerName}:${parsed.providerRequestId}:${parsed.status}`;
    if (processedWebhookEvents.has(eventKey)) {
      logger.info('[LiveTestService] Duplicate webhook event ignored (idempotent)', { eventKey });
      return { success: true, statusCode: 200, message: 'Duplicate callback ignored.', duplicate: true };
    }
    processedWebhookEvents.add(eventKey);

    // 4. Find matching audit log
    const auditLog = await db.getLiveTestAuditLogByProviderRequestId(parsed.providerRequestId);
    if (!auditLog) {
      logger.warn('[LiveTestService] Callback for unknown providerRequestId', { reqId: parsed.providerRequestId });
      return { success: false, statusCode: 404, message: 'Matching live test audit log not found.' };
    }

    // 5. Update audit log
    const now = new Date().toISOString();
    await db.updateLiveTestAuditLog(auditLog.id, {
      dispatch_status: parsed.status,
      delivery_evidence_status: parsed.deliveryEvidenceStatus,
      delivery_evidence_at: parsed.deliveryEvidenceAt || now,
      error_message: parsed.error,
    });

    // 6. Record timeline event if delivered
    if (parsed.status === 'DELIVERED') {
      await db.createEmergencyIncidentEvent({
        incident_id: auditLog.incident_id,
        event_type: 'LIVE_TEST_DELIVERY_CONFIRMED',
        title: `Carrier Delivery Confirmed (${auditLog.channel})`,
        description: `Telephony provider confirmed delivery of test ${auditLog.channel} alert to ${auditLog.destination_phone_masked}.`,
        actor_type: 'SYSTEM_SCHEDULER',
        stage: 'FAMILY_CONTACT',
        payload: {
          auditLogId: auditLog.id,
          providerRequestId: parsed.providerRequestId,
          status: parsed.status,
          carrierStatus: parsed.deliveryEvidenceStatus,
        },
        is_demo: false,
        simulation_provenance: 'LIVE_PROVIDER',
      });
    }

    return { success: true, statusCode: 200, message: 'Callback processed successfully.' };
  }

  /**
   * Retrieves audit logs for a family or specific incident.
   */
  async listAuditLogs(familyId: string, incidentId?: string): Promise<LiveTestAuditLog[]> {
    return db.listLiveTestAuditLogs(familyId, incidentId);
  }
}

export const liveTestService = new LiveTestService();
