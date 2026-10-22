/**
 * backend/src/integrations/telephony/providerRegistry.ts
 *
 * Central registry resolving the active ITelephonyProvider implementation
 * based on environment configuration.
 */

import { ITelephonyProvider } from './telephonyProvider.interface.js';
import { TwilioProvider } from './twilioProvider.js';
import { ExotelProvider } from './exotelProvider.js';
import { MockTelephonyProvider } from './mockTelephonyProvider.js';
import { LiveTestDispatchStatus, TelephonyProviderHealth } from '../../types/models.js';
import { config } from '../../config/env.js';

class NullTelephonyProvider implements ITelephonyProvider {
  readonly name = 'none' as const;

  getHealthStatus(): TelephonyProviderHealth {
    return {
      provider: 'none',
      isConfigured: false,
      liveTestModeEnabled: config.telephony.liveTestModeEnabled,
      supportedChannels: [],
      maxRecipients: config.telephony.maxRecipients,
      cooldownSeconds: config.telephony.cooldownSeconds,
      statusMessage:
        'Live telephony disabled. Set LIVE_TEST_TELEPHONY_PROVIDER to "twilio", "exotel", or "mock" with valid credentials.',
    };
  }

  async sendSms(): Promise<{ success: boolean; status: LiveTestDispatchStatus; error: string }> {
    return {
      success: false,
      status: 'FAILED',
      error: 'Telephony provider is not configured. Live test SMS cannot be sent.',
    };
  }

  async initiateVoiceCall(): Promise<{ success: boolean; status: LiveTestDispatchStatus; error: string }> {
    return {
      success: false,
      status: 'FAILED',
      error: 'Telephony provider is not configured. Live voice calls cannot be placed.',
    };
  }

  verifyWebhookSignature(): boolean {
    return false;
  }

  parseWebhookPayload(): null {
    return null;
  }
}

// Singletons
const twilioProviderInstance = new TwilioProvider();
const exotelProviderInstance = new ExotelProvider();
export const mockTelephonyProviderInstance = new MockTelephonyProvider();
const nullTelephonyProviderInstance = new NullTelephonyProvider();

let customProviderOverride: ITelephonyProvider | null = null;

export function setCustomTelephonyProvider(provider: ITelephonyProvider | null): void {
  customProviderOverride = provider;
}

export function getTelephonyProvider(): ITelephonyProvider {
  if (customProviderOverride) {
    return customProviderOverride;
  }

  const configured = config.telephony.provider;
  if (configured === 'twilio') {
    return twilioProviderInstance;
  }
  if (configured === 'exotel') {
    return exotelProviderInstance;
  }
  if (configured === 'mock') {
    return mockTelephonyProviderInstance;
  }
  return nullTelephonyProviderInstance;
}
