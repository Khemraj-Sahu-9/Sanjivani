/**
 * backend/src/integrations/telephony/mockTelephonyProvider.ts
 *
 * Deterministic Mock Telephony Provider for automated tests and offline development.
 * Guarantees zero network calls and zero external costs.
 */

import crypto from 'node:crypto';
import {
  ITelephonyProvider,
  NormalizedWebhookEvent,
  TelephonySmsResult,
  TelephonyVoiceResult,
  WebhookVerificationParams,
} from './telephonyProvider.interface.js';
import { LiveTestDispatchStatus, TelephonyProviderHealth } from '../../types/models.js';
import { config } from '../../config/env.js';

export interface RecordedDispatch {
  to: string;
  payload: string;
  channel: 'SMS' | 'VOICE';
  providerRequestId: string;
  timestamp: string;
}

export class MockTelephonyProvider implements ITelephonyProvider {
  readonly name = 'mock' as const;

  private mode: 'success' | 'failure' = 'success';
  private failureReason = 'Mock provider simulated failure';
  private sentDispatches: RecordedDispatch[] = [];
  private enabled = true;

  setMode(mode: 'success' | 'failure', reason?: string): void {
    this.mode = mode;
    if (reason) this.failureReason = reason;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  getSentDispatches(): RecordedDispatch[] {
    return [...this.sentDispatches];
  }

  clear(): void {
    this.sentDispatches = [];
    this.mode = 'success';
    this.enabled = true;
  }

  getHealthStatus(): TelephonyProviderHealth {
    return {
      provider: 'mock',
      isConfigured: this.enabled,
      liveTestModeEnabled: config.telephony.liveTestModeEnabled,
      supportedChannels: ['SMS', 'VOICE'],
      maxRecipients: config.telephony.maxRecipients,
      cooldownSeconds: config.telephony.cooldownSeconds,
      statusMessage: this.enabled
        ? 'Mock Telephony Provider ready (Offline Test Mode)'
        : 'Mock Telephony Provider disabled',
    };
  }

  async sendSms(
    to: string,
    messageText: string,
    _options?: { idempotencyKey?: string }
  ): Promise<TelephonySmsResult> {
    if (!this.enabled) {
      return {
        success: false,
        status: 'FAILED',
        error: 'Mock Telephony Provider is currently disabled.',
      };
    }

    if (this.mode === 'failure') {
      return {
        success: false,
        status: 'FAILED',
        error: this.failureReason,
      };
    }

    const providerRequestId = `mock-sms-${crypto.randomUUID()}`;
    this.sentDispatches.push({
      to,
      payload: messageText,
      channel: 'SMS',
      providerRequestId,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      providerRequestId,
      status: 'ACCEPTED',
      rawResponse: {
        provider: 'mock',
        status: 'accepted',
        providerRequestId,
        to,
      },
    };
  }

  async initiateVoiceCall(
    to: string,
    scriptText: string,
    _options?: { idempotencyKey?: string }
  ): Promise<TelephonyVoiceResult> {
    if (!this.enabled) {
      return {
        success: false,
        status: 'FAILED',
        error: 'Mock Telephony Provider is currently disabled.',
      };
    }

    if (this.mode === 'failure') {
      return {
        success: false,
        status: 'FAILED',
        error: this.failureReason,
      };
    }

    const providerRequestId = `mock-voice-${crypto.randomUUID()}`;
    this.sentDispatches.push({
      to,
      payload: scriptText,
      channel: 'VOICE',
      providerRequestId,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      providerRequestId,
      status: 'ACCEPTED',
      rawResponse: {
        provider: 'mock',
        status: 'in-progress',
        providerRequestId,
        to,
      },
    };
  }

  verifyWebhookSignature(params: WebhookVerificationParams): boolean {
    const signature = params.headers['x-mock-signature'] || params.headers['x-webhook-secret'];
    if (config.telephony.webhookSecret) {
      return signature === config.telephony.webhookSecret;
    }
    // If no secret configured in test/demo mode, allow mock token
    return signature === 'valid-mock-signature' || signature === 'mock-secret';
  }

  parseWebhookPayload(payload: Record<string, unknown>): NormalizedWebhookEvent | null {
    if (!payload || typeof payload !== 'object') return null;
    const providerRequestId = (payload.providerRequestId || payload.id || payload.MessageSid || payload.CallSid) as string;
    if (!providerRequestId) return null;

    const rawStatus = String(payload.status || payload.MessageStatus || payload.CallStatus || '').toLowerCase();
    let status: LiveTestDispatchStatus = 'UNKNOWN';
    if (['delivered', 'completed'].includes(rawStatus)) {
      status = 'DELIVERED';
    } else if (['sent', 'accepted', 'in-progress', 'ringing'].includes(rawStatus)) {
      status = 'ACCEPTED';
    } else if (['failed', 'undelivered', 'busy', 'no-answer', 'canceled'].includes(rawStatus)) {
      status = 'FAILED';
    }

    const channel = (payload.channel === 'VOICE' || String(providerRequestId).includes('voice') || payload.CallSid)
      ? 'VOICE'
      : 'SMS';

    return {
      providerRequestId,
      status,
      channel,
      deliveryEvidenceAt: status === 'DELIVERED' ? new Date().toISOString() : undefined,
      deliveryEvidenceStatus: rawStatus || 'unknown',
      error: status === 'FAILED' ? String(payload.error || payload.ErrorMessage || 'Delivery failed') : undefined,
      rawPayload: payload,
    };
  }
}
