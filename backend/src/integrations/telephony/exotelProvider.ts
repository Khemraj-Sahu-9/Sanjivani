/**
 * backend/src/integrations/telephony/exotelProvider.ts
 *
 * Exotel adapter for Indian telephony with TRAI/DLT Header and Template support.
 */

import { URLSearchParams } from 'node:url';
import {
  ITelephonyProvider,
  NormalizedWebhookEvent,
  TelephonySmsResult,
  TelephonyVoiceResult,
  WebhookVerificationParams,
} from './telephonyProvider.interface.js';
import { LiveTestDispatchStatus, TelephonyProviderHealth } from '../../types/models.js';
import { config } from '../../config/env.js';
import { logger } from '../../config/logger.js';

export class ExotelProvider implements ITelephonyProvider {
  readonly name = 'exotel' as const;

  getHealthStatus(): TelephonyProviderHealth {
    const isConfigured = config.telephony.exotel.isConfigured;
    const missing: string[] = [];
    if (!config.telephony.exotel.accountSid) missing.push('EXOTEL_ACCOUNT_SID');
    if (!config.telephony.exotel.apiKey && !config.telephony.exotel.apiToken) missing.push('EXOTEL_API_KEY/TOKEN');
    if (!config.telephony.exotel.callerId) missing.push('EXOTEL_CALLER_ID');

    return {
      provider: 'exotel',
      isConfigured,
      liveTestModeEnabled: config.telephony.liveTestModeEnabled,
      supportedChannels: ['SMS', 'VOICE'],
      maxRecipients: config.telephony.maxRecipients,
      cooldownSeconds: config.telephony.cooldownSeconds,
      statusMessage: isConfigured
        ? 'Exotel API configured for Indian DLT Telephony'
        : `Exotel not fully configured. Missing: ${missing.join(', ')}`,
    };
  }

  async sendSms(
    to: string,
    messageText: string,
    _options?: { idempotencyKey?: string }
  ): Promise<TelephonySmsResult> {
    if (!config.telephony.exotel.isConfigured) {
      return {
        success: false,
        status: 'FAILED',
        error: 'Exotel credentials not configured on the server.',
      };
    }

    const { accountSid, apiKey, apiToken, subdomain, callerId, dltEntityId, dltTemplateId } = config.telephony.exotel;
    const url = `https://${subdomain}/v1/Accounts/${accountSid}/Sms/send.json`;

    const bodyParams = new URLSearchParams();
    bodyParams.append('From', callerId);
    bodyParams.append('To', to);
    bodyParams.append('Body', messageText);
    if (dltEntityId) bodyParams.append('DltEntityId', dltEntityId);
    if (dltTemplateId) bodyParams.append('DltTemplateId', dltTemplateId);

    try {
      const auth = Buffer.from(`${apiKey}:${apiToken}`).toString('base64');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: bodyParams.toString(),
      });

      const data = (await response.json()) as Record<string, unknown>;

      if (!response.ok) {
        logger.warn('[ExotelProvider] SMS rejected by Exotel', { status: response.status });
        return {
          success: false,
          status: 'FAILED',
          error: String(data.RestException || data.message || `Exotel SMS error HTTP ${response.status}`),
        };
      }

      const smsObj = (data.SMSMessage || {}) as Record<string, unknown>;
      const sid = String(smsObj.Sid || '');

      return {
        success: true,
        providerRequestId: sid,
        status: 'ACCEPTED',
        rawResponse: {
          sid,
          status: smsObj.Status,
          date_created: smsObj.DateCreated,
        },
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('[ExotelProvider] Error sending SMS via Exotel', { error: msg });
      return {
        success: false,
        status: 'FAILED',
        error: `Exotel network error: ${msg}`,
      };
    }
  }

  async initiateVoiceCall(
    to: string,
    _scriptText: string,
    _options?: { idempotencyKey?: string }
  ): Promise<TelephonyVoiceResult> {
    if (!config.telephony.exotel.isConfigured) {
      return {
        success: false,
        status: 'FAILED',
        error: 'Exotel credentials not configured on the server.',
      };
    }

    const { accountSid, apiKey, apiToken, subdomain, callerId } = config.telephony.exotel;
    const url = `https://${subdomain}/v1/Accounts/${accountSid}/Calls/connect.json`;

    const bodyParams = new URLSearchParams();
    bodyParams.append('From', callerId);
    bodyParams.append('To', to);
    bodyParams.append('CallerId', callerId);

    try {
      const auth = Buffer.from(`${apiKey}:${apiToken}`).toString('base64');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: bodyParams.toString(),
      });

      const data = (await response.json()) as Record<string, unknown>;

      if (!response.ok) {
        return {
          success: false,
          status: 'FAILED',
          error: String(data.RestException || `Exotel Call error HTTP ${response.status}`),
        };
      }

      const callObj = (data.Call || {}) as Record<string, unknown>;
      const sid = String(callObj.Sid || '');

      return {
        success: true,
        providerRequestId: sid,
        status: 'ACCEPTED',
        rawResponse: {
          sid,
          status: callObj.Status,
        },
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('[ExotelProvider] Error initiating voice call via Exotel', { error: msg });
      return {
        success: false,
        status: 'FAILED',
        error: `Exotel voice call network error: ${msg}`,
      };
    }
  }

  verifyWebhookSignature(params: WebhookVerificationParams): boolean {
    const token =
      (params.queryParams && params.queryParams.token) ||
      params.headers['x-exotel-token'] ||
      params.headers['authorization'];

    if (!config.telephony.webhookSecret) {
      // In development, require token if provided
      return Boolean(token);
    }
    return token === config.telephony.webhookSecret || token === `Bearer ${config.telephony.webhookSecret}`;
  }

  parseWebhookPayload(payload: Record<string, unknown>): NormalizedWebhookEvent | null {
    if (!payload || typeof payload !== 'object') return null;
    const providerRequestId = String(payload.SmsSid || payload.CallSid || payload.Sid || '');
    if (!providerRequestId) return null;

    const rawStatus = String(payload.Status || payload.status || '').toLowerCase();
    let status: LiveTestDispatchStatus = 'UNKNOWN';
    if (['delivered', 'completed'].includes(rawStatus)) {
      status = 'DELIVERED';
    } else if (['sent', 'sending', 'in-progress'].includes(rawStatus)) {
      status = 'ACCEPTED';
    } else if (['failed', 'failed-dnd', 'busy', 'no-answer', 'canceled'].includes(rawStatus)) {
      status = 'FAILED';
    }

    const channel = payload.CallSid ? 'VOICE' : 'SMS';

    return {
      providerRequestId,
      status,
      channel,
      deliveryEvidenceAt: status === 'DELIVERED' ? new Date().toISOString() : undefined,
      deliveryEvidenceStatus: rawStatus,
      error: status === 'FAILED' ? `Exotel reported status: ${rawStatus}` : undefined,
      rawPayload: payload,
    };
  }
}
