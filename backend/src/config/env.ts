/**
 * backend/src/config/env.ts
 *
 * Loads and validates all environment variables at startup.
 * This is the ONLY file that reads process.env directly.
 * All other modules must import the `config` object from here.
 *
 * Rules:
 * - In DEMO_MODE, Supabase credentials are optional.
 * - In production (DEMO_MODE=false), all Supabase credentials are required.
 * - Missing required variables cause an immediate startup failure with a clear message.
 * - No secrets are logged here.
 */

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load backend/.env in non-test environments (and fallback to process.cwd()/.env)
if (process.env.NODE_ENV !== 'test') {
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
  dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
  dotenv.config();
}

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

// Polyfill global WebSocket for Supabase client in Node.js < 22 environments
if (typeof globalThis.WebSocket === 'undefined') {
  try {
    const wsModule = require('ws');
    (globalThis as unknown as Record<string, unknown>)['WebSocket'] = wsModule.default || wsModule;
  } catch {
    // ws package not available
  }
}

function requireEnv(key: string, label: string): string {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new Error(
      `[Config] Missing required environment variable: ${key}\n` +
        `  Description: ${label}\n` +
        `  Fix: Copy backend/.env.example to backend/.env and set this value.`
    );
  }
  return value.trim();
}

function optionalEnv(key: string, defaultValue: string): string {
  const value = process.env[key];
  return value && value.trim() !== '' ? value.trim() : defaultValue;
}

const isDemoMode = optionalEnv('DEMO_MODE', 'false').toLowerCase() === 'true';
const nodeEnv = optionalEnv('NODE_ENV', 'development');
const isProduction = nodeEnv === 'production';

// In production, demo mode is not allowed
if (isProduction && isDemoMode) {
  throw new Error(
    '[Config] DEMO_MODE cannot be enabled in production (NODE_ENV=production).'
  );
}

// Validate Supabase credentials if not in demo mode
let supabaseUrl = '';
let supabaseSecretKey = '';
let supabasePublishableKey = '';
const supabaseJwksUrl = optionalEnv('SUPABASE_JWKS_URL', '');

if (!isDemoMode) {
  supabaseUrl = requireEnv(
    'SUPABASE_URL',
    'Your Supabase project URL (e.g. https://xxx.supabase.co)'
  );
  // Support SUPABASE_SECRET_KEY preferentially with SUPABASE_SERVICE_ROLE_KEY fallback
  supabaseSecretKey =
    process.env['SUPABASE_SECRET_KEY']?.trim() ||
    process.env['SUPABASE_SERVICE_ROLE_KEY']?.trim() ||
    requireEnv(
      'SUPABASE_SECRET_KEY',
      'Supabase secret or service role key — backend only, never expose to frontend'
    );
  // Support SUPABASE_PUBLISHABLE_KEY preferentially with SUPABASE_ANON_KEY fallback
  supabasePublishableKey =
    process.env['SUPABASE_PUBLISHABLE_KEY']?.trim() ||
    process.env['SUPABASE_ANON_KEY']?.trim() ||
    requireEnv(
      'SUPABASE_PUBLISHABLE_KEY',
      'Supabase publishable or anon key'
    );
} else {
  supabaseUrl = optionalEnv('SUPABASE_URL', '');
  supabaseSecretKey = optionalEnv('SUPABASE_SECRET_KEY', '') || optionalEnv('SUPABASE_SERVICE_ROLE_KEY', '');
  supabasePublishableKey = optionalEnv('SUPABASE_PUBLISHABLE_KEY', '') || optionalEnv('SUPABASE_ANON_KEY', '');
}

// Gemini / LLM AI API configuration
const geminiApiKey = optionalEnv('GEMINI_API_KEY', '');

// Telephony / Phase 6 Live Test Mode
const liveTestModeEnabled = optionalEnv('LIVE_TEST_MODE_ENABLED', 'false').toLowerCase() === 'true';
const telephonyProviderRaw = optionalEnv('LIVE_TEST_TELEPHONY_PROVIDER', 'none').toLowerCase();
const telephonyProvider = ['twilio', 'exotel', 'mock', 'none'].includes(telephonyProviderRaw)
  ? (telephonyProviderRaw as 'twilio' | 'exotel' | 'mock' | 'none')
  : 'none';
const liveTestMaxRecipients = Math.max(1, parseInt(optionalEnv('LIVE_TEST_MAX_RECIPIENTS', '3'), 10));
const liveTestCooldownSeconds = Math.max(0, parseInt(optionalEnv('LIVE_TEST_COOLDOWN_SECONDS', '30'), 10));
const telephonyWebhookSecret = optionalEnv('TELEPHONY_WEBHOOK_SECRET', '');

// Twilio credentials
const twilioAccountSid = optionalEnv('TWILIO_ACCOUNT_SID', '');
const twilioAuthToken = optionalEnv('TWILIO_AUTH_TOKEN', '');
const twilioPhoneNumber = optionalEnv('TWILIO_PHONE_NUMBER', '');
const isTwilioConfigured = Boolean(twilioAccountSid && twilioAuthToken && twilioPhoneNumber);

// Exotel credentials
const exotelAccountSid = optionalEnv('EXOTEL_ACCOUNT_SID', '');
const exotelApiKey = optionalEnv('EXOTEL_API_KEY', '');
const exotelApiToken = optionalEnv('EXOTEL_API_TOKEN', '');
const exotelSubdomain = optionalEnv('EXOTEL_SUBDOMAIN', 'api.exotel.com');
const exotelCallerId = optionalEnv('EXOTEL_CALLER_ID', '');
const exotelDltEntityId = optionalEnv('EXOTEL_DLT_ENTITY_ID', '');
const exotelDltTemplateId = optionalEnv('EXOTEL_DLT_TEMPLATE_ID', '');
const isExotelConfigured = Boolean(
  exotelAccountSid &&
  (exotelApiKey || exotelApiToken) &&
  exotelCallerId
);

// Hospital Gateway (Phase 10)
const hospitalGatewayUrl = optionalEnv('HOSPITAL_GATEWAY_URL', '');
const hospitalGatewayApiKey = optionalEnv('HOSPITAL_GATEWAY_API_KEY', '');
const hospitalIntegrationMode = optionalEnv('HOSPITAL_INTEGRATION_MODE', 'simulated').toLowerCase() === 'live' ? 'live' : 'simulated';

// ABDM Gateway (Phase 10)
const abdmClientId = optionalEnv('ABDM_CLIENT_ID', '');
const abdmClientSecret = optionalEnv('ABDM_CLIENT_SECRET', '');
const abdmGatewayUrl = optionalEnv('ABDM_GATEWAY_URL', 'https://dev.abdm.gov.in/gateway');
const abdmEnv = optionalEnv('ABDM_ENV', 'sandbox').toLowerCase() === 'production' ? 'production' : 'sandbox';

export const config = {
  nodeEnv,
  isProduction,
  isDevelopment: nodeEnv === 'development',
  isDemoMode,
  port: parseInt(optionalEnv('PORT', '3001'), 10),
  frontendUrl: optionalEnv('FRONTEND_URL', 'http://localhost:5173'),
  logLevel: optionalEnv('LOG_LEVEL', isProduction ? 'info' : 'debug'),
  supabase: {
    url: supabaseUrl,
    secretKey: supabaseSecretKey,
    publishableKey: supabasePublishableKey,
    // Backwards-compatible aliases
    serviceRoleKey: supabaseSecretKey,
    anonKey: supabasePublishableKey,
    jwksUrl: supabaseJwksUrl,
  },
  ai: {
    geminiApiKey,
    isConfigured: Boolean(geminiApiKey && geminiApiKey.trim() !== ''),
  },
  telephony: {
    liveTestModeEnabled,
    provider: telephonyProvider,
    maxRecipients: liveTestMaxRecipients,
    cooldownSeconds: liveTestCooldownSeconds,
    webhookSecret: telephonyWebhookSecret,
    twilio: {
      accountSid: twilioAccountSid,
      authToken: twilioAuthToken,
      phoneNumber: twilioPhoneNumber,
      isConfigured: isTwilioConfigured,
    },
    exotel: {
      accountSid: exotelAccountSid,
      apiKey: exotelApiKey,
      apiToken: exotelApiToken,
      subdomain: exotelSubdomain,
      callerId: exotelCallerId,
      dltEntityId: exotelDltEntityId,
      dltTemplateId: exotelDltTemplateId,
      isConfigured: isExotelConfigured,
    },
  },
  hospital: {
    gatewayUrl: hospitalGatewayUrl,
    apiKey: hospitalGatewayApiKey,
    mode: hospitalIntegrationMode as 'simulated' | 'live',
    isConfigured: Boolean(hospitalGatewayUrl && hospitalGatewayUrl.trim() !== ''),
  },
  abdm: {
    clientId: abdmClientId,
    clientSecret: abdmClientSecret,
    gatewayUrl: abdmGatewayUrl,
    environment: abdmEnv as 'sandbox' | 'production',
    isConfigured: Boolean(abdmClientId && abdmClientSecret),
  },
} as const;
