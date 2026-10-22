/**
 * backend/src/integrations/telephony/twilioProvider.ts
 *
 * Production Twilio adapter for SMS and Voice calls with cryptographic
 * webhook signature verification.
 */

import crypto from 'node:crypto';
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

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export class TwilioProvider implements ITelephonyProvider {
  readonly name = 'twilio' as const;

  getHealthStatus(): TelephonyProviderHealth {
    const isConfigured = config.telephony.twilio.isConfigured;
    const missing: string[] = [];
    if (!config.telephony.twilio.accountSid) missing.push('TWILIO_ACCOUNT_SID');
    if (!config.telephony.twilio.authToken) missing.push('TWILIO_AUTH_TOKEN');
    if (!config.telephony.twilio.phoneNumber) missing.push('TWILIO_PHONE_NUMBER');

    return {
      provider: 'twilio',
      isConfigured,
      liveTestModeEnabled: config.telephony.liveTestModeEnabled,
      supportedChannels: ['SMS', 'VOICE'],
      maxRecipients: config.telephony.maxRecipients,
      cooldownSeconds: config.telephony.cooldownSeconds,
      statusMessage: isConfigured
        ? 'Twilio API configured and ready for Live Test Mode'
        : `Twilio not fully configured. Missing: ${missing.join(', ')}`,
    };
  }

  async sendSms(
    to: string,
    messageText: string,
    _options?: { idempotencyKey?: string }
  ): Promise<TelephonySmsResult> {
    if (!config.telephony.twilio.isConfigured) {
      return {
        success: false,
        status: 'FAILED',
        error: 'Twilio credentials not configured on the server.',
      };
    }

    const { accountSid, authToken, phoneNumber } = config.telephony.twilio;
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const bodyParams = new URLSearchParams();
    bodyParams.append('To', to);
    bodyParams.append('From', phoneNumber);
    bodyParams.append('Body', messageText);

    try {
      const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
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
        const errorMsg = String(data.message || `Twilio SMS error HTTP ${response.status}`);
        logger.warn('[TwilioProvider] SMS dispatch rejected by provider', {
          status: response.status,
          code: data.code,
        });
        return {
          success: false,
          status: 'FAILED',
          error: errorMsg,
          rawResponse: { status: response.status, code: data.code },
        };
      }

      const sid = String(data.sid || '');
      return {
        success: true,
        providerRequestId: sid,
        status: 'ACCEPTED',
        rawResponse: {
          sid,
          status: data.status,
          date_created: data.date_created,
        },
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('[TwilioProvider] Network error during SMS send', { error: msg });
      return {
        success: false,
        status: 'FAILED',
        error: `Network error reaching Twilio: ${msg}`,
      };
    }
  }

  async initiateVoiceCall(
    to: string,
    scriptText: string,
    _options?: { idempotencyKey?: string }
  ): Promise<TelephonyVoiceResult> {
    if (!config.telephony.twilio.isConfigured) {
      return {
        success: false,
        status: 'FAILED',
        error: 'Twilio credentials not configured on the server.',
      };
    }

    const { accountSid, authToken, phoneNumber } = config.telephony.twilio;
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`;

    const twiml = `<Response><Say voice="Polly.Aditi" language="en-IN">${escapeXml(scriptText)}</Say><Pause length="1"/><Say voice="Polly.Aditi" language="en-IN">Repeating test message: ${escapeXml(scriptText)}</Say></Response>`;

    const bodyParams = new URLSearchParams();
    bodyParams.append('To', to);
    bodyParams.append('From', phoneNumber);
    bodyParams.append('Twiml', twiml);

    try {
      const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
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
        const errorMsg = String(data.message || `Twilio Voice error HTTP ${response.status}`);
        logger.warn('[TwilioProvider] Voice call rejected by provider', {
          status: response.status,
          code: data.code,
        });
        return {
          success: false,
          status: 'FAILED',
          error: errorMsg,
          rawResponse: { status: response.status, code: data.code },
        };
      }

      const sid = String(data.sid || '');
      return {
        success: true,
        providerRequestId: sid,
        status: 'ACCEPTED',
        rawResponse: {
          sid,
          status: data.status,
          date_created: data.date_created,
        },
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('[TwilioProvider] Network error during Voice call initiation', { error: msg });
      return {
        success: false,
        status: 'FAILED',
        error: `Network error reaching Twilio: ${msg}`,
      };
    }
  }

  verifyWebhookSignature(params: WebhookVerificationParams): boolean {
    const signatureHeader = params.headers['x-twilio-signature'];
    if (!signatureHeader || Array.isArray(signatureHeader)) return false;
    const authToken = config.telephony.twilio.authToken;
    if (!authToken) return false;

    // Twilio signature verification algorithm:
    // 1. Take full request URL
    // 2. Sort POST params alphabetically by key
    // 3. Append key + value to URL
    // 4. Compute HMAC-SHA1 with AuthToken and Base64 encode
    let dataToSign = params.url;
    if (params.bodyParams && typeof params.bodyParams === 'object') {
      const sortedKeys = Object.keys(params.bodyParams).sort();
      for (const key of sortedKeys) {
        dataToSign += key + String(params.bodyParams[key] ?? '');
      }
    }

    const expectedSignature = crypto
      .createHmac('sha1', authToken)
      .update(Buffer.from(dataToSign, 'utf-8'))
      .digest('base64');

    return crypto.timingSafeEqual(
      Buffer.from(signatureHeader, 'utf-8'),
      Buffer.from(expectedSignature, 'utf-8')
    );
  }

  parseWebhookPayload(payload: Record<string, unknown>): NormalizedWebhookEvent | null {
    if (!payload || typeof payload !== 'object') return null;
    const providerRequestId = String(payload.MessageSid || payload.CallSid || payload.SmsSid || '');
    if (!providerRequestId) return null;

    const rawStatus = String(payload.MessageStatus || payload.CallStatus || '').toLowerCase();
    let status: LiveTestDispatchStatus = 'UNKNOWN';
    if (['delivered', 'completed'].includes(rawStatus)) {
      status = 'DELIVERED';
    } else if (['sent', 'queued', 'accepted', 'in-progress', 'ringing'].includes(rawStatus)) {
      status = 'ACCEPTED';
    } else if (['failed', 'undelivered', 'busy', 'no-answer', 'canceled'].includes(rawStatus)) {
      status = 'FAILED';
    }

    const channel = payload.CallSid ? 'VOICE' : 'SMS';

    return {
      providerRequestId,
      status,
      channel,
      deliveryEvidenceAt: status === 'DELIVERED' ? new Date().toISOString() : undefined,
      deliveryEvidenceStatus: rawStatus || 'unknown',
      error: status === 'FAILED' ? String(payload.ErrorMessage || payload.ErrorCode || 'Twilio reported delivery failure') : undefined,
      rawPayload: {
        sid: providerRequestId,
        status: rawStatus,
        to: payload.To,
        from: payload.From,
      },
    };
  }
}
