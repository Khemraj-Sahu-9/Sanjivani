/**
 * backend/src/integrations/telephony/telephonyProvider.interface.ts
 *
 * Provider-agnostic telephony interfaces for Phase 6 Live Test Mode.
 */

import { LiveTestDispatchStatus, TelephonyProviderHealth } from '../../types/models.js';

export interface TelephonySmsResult {
  success: boolean;
  providerRequestId?: string;
  status: LiveTestDispatchStatus;
  rawResponse?: Record<string, unknown>;
  error?: string;
}

export interface TelephonyVoiceResult {
  success: boolean;
  providerRequestId?: string;
  status: LiveTestDispatchStatus;
  rawResponse?: Record<string, unknown>;
  error?: string;
}

export interface NormalizedWebhookEvent {
  providerRequestId: string;
  status: LiveTestDispatchStatus;
  channel: 'SMS' | 'VOICE';
  deliveryEvidenceAt?: string;
  deliveryEvidenceStatus?: string;
  error?: string;
  rawPayload: Record<string, unknown>;
}

export interface WebhookVerificationParams {
  headers: Record<string, string | string[] | undefined>;
  rawBody: string;
  url: string;
  bodyParams?: Record<string, unknown>;
  queryParams?: Record<string, string | string[] | undefined>;
}

export interface ITelephonyProvider {
  readonly name: 'twilio' | 'exotel' | 'mock' | 'none';
  getHealthStatus(): TelephonyProviderHealth;
  sendSms(to: string, messageText: string, options?: { idempotencyKey?: string }): Promise<TelephonySmsResult>;
  initiateVoiceCall(to: string, scriptText: string, options?: { idempotencyKey?: string }): Promise<TelephonyVoiceResult>;
  verifyWebhookSignature(params: WebhookVerificationParams): boolean;
  parseWebhookPayload(payload: Record<string, unknown>): NormalizedWebhookEvent | null;
}
