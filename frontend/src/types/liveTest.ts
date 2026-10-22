/**
 * frontend/src/types/liveTest.ts
 *
 * Types for Phase 6 Live Test Mode:
 * Recipients, Consent, Preflight, Audit Logs, and Provider Diagnostics.
 */

export type LiveTestChannel = 'SMS' | 'VOICE' | 'BOTH';
export type LiveTestVerificationStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
export type LiveTestConsentStatus = 'CONSENT_GRANTED' | 'CONSENT_REVOKED';
export type LiveTestDispatchStatus = 'QUEUED' | 'SENDING' | 'ACCEPTED' | 'DELIVERED' | 'FAILED' | 'UNKNOWN';

export interface LiveTestRecipient {
  id: string;
  family_id: string;
  display_name: string;
  phone_number: string;
  permitted_channel: LiveTestChannel;
  verification_status: LiveTestVerificationStatus;
  verification_notes?: string | null;
  verified_at?: string | null;
  verified_by_user_id?: string | null;
  consent_status: LiveTestConsentStatus;
  consent_recorded_at: string;
  consent_notes: string;
  is_active: boolean;
  allowed_purpose: string;
  created_at: string;
  updated_at: string;
}

export interface TelephonyProviderHealth {
  provider: 'twilio' | 'exotel' | 'mock' | 'none';
  isConfigured: boolean;
  liveTestModeEnabled: boolean;
  supportedChannels: ('SMS' | 'VOICE')[];
  maxRecipients: number;
  cooldownSeconds: number;
  statusMessage: string;
}

export interface EligibleRecipientPreview {
  id: string;
  displayName: string;
  maskedPhone: string;
  permittedChannel: LiveTestChannel;
  verificationStatus: LiveTestVerificationStatus;
  consentStatus: LiveTestConsentStatus;
}

export interface IneligibleRecipientPreview {
  id: string;
  displayName: string;
  reason: string;
}

export interface LiveTestPreflightResponse {
  incidentId: string;
  patientName: string;
  healthId: string;
  liveModeWarning: string;
  simulatedEscalationNotice: string;
  providerHealth: TelephonyProviderHealth;
  eligibleRecipients: EligibleRecipientPreview[];
  ineligibleRecipients: IneligibleRecipientPreview[];
  smsPreviewText: string;
  voicePreviewScript: string;
}

export interface LiveTestDispatchRequest {
  incidentId: string;
  recipientIds: string[];
  channel: 'SMS' | 'VOICE';
  operatorConfirmed: boolean;
  idempotencyKey?: string;
}

export interface LiveTestDispatchResultItem {
  recipientId: string;
  displayName: string;
  maskedPhone: string;
  status: LiveTestDispatchStatus;
  providerRequestId?: string | null;
  auditLogId: string;
  error?: string | null;
}

export interface LiveTestDispatchResult {
  incidentId: string;
  channel: 'SMS' | 'VOICE';
  providerName: string;
  dispatchedCount: number;
  failedCount: number;
  results: LiveTestDispatchResultItem[];
  simulationNotice: string;
}

export interface LiveTestAuditLog {
  id: string;
  family_id: string;
  incident_id: string;
  recipient_id: string;
  channel: 'SMS' | 'VOICE';
  provider_name: string;
  provider_request_id?: string | null;
  destination_phone_masked: string;
  message_payload_preview: string;
  dispatch_status: LiveTestDispatchStatus;
  delivery_evidence_at?: string | null;
  delivery_evidence_status?: string | null;
  human_acknowledged: boolean;
  human_acknowledged_at?: string | null;
  human_acknowledgement_note?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  raw_provider_response?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}
