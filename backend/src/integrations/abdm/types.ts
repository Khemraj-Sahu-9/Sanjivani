/**
 * backend/src/integrations/abdm/types.ts
 *
 * Types for Ayushman Bharat Digital Mission (ABDM) / ABHA Gateway Integration.
 */

export interface AbhaVerificationRequest {
  abhaNumber?: string;       // 14-digit numeric format: XX-XXXX-XXXX-XXXX
  abhaAddress?: string;      // handle format: alias@abdm or alias@sbx
  authMethod: 'OTP' | 'DEMOGRAPHIC';
}

export interface AbhaProfile {
  abhaNumber: string;
  abhaAddress: string;
  fullName: string;
  gender: 'M' | 'F' | 'O';
  dateOfBirth?: string;
  yearOfBirth: number;
  mobile: string;
  status: 'ACTIVE' | 'INACTIVE' | 'DEACTIVATED';
  kycVerified: boolean;
  linkedInternalHealthId?: string; // Linked Sanjivani SNJ- ID
}

export interface AbhaOtpSession {
  txnId: string;
  mobile: string;
  authMethod: 'OTP';
  expiresInSeconds: number;
}

export type HiType = 'DiagnosticReport' | 'Prescription' | 'OPDRecord' | 'DischargeSummary' | 'ImmunizationRecord';

export interface AbdmConsentRequest {
  patientAbhaAddress: string;
  purpose: {
    code: string;
    text: string;
  };
  hiTypes: HiType[];
  dateRange: {
    from: string;
    to: string;
  };
  dataEraseAt: string;
}

export interface AbdmConsentArtefact {
  consentId: string;
  status: 'REQUESTED' | 'GRANTED' | 'DENIED' | 'EXPIRED' | 'REVOKED';
  patientAbhaAddress: string;
  purpose: string;
  hiTypes: HiType[];
  createdAt: string;
  expiresAt: string;
  grantedBy?: string;
}

export interface FhirBundleEntry {
  fullUrl: string;
  resource: {
    resourceType: string;
    id: string;
    [key: string]: any;
  };
}

export interface FhirR4Bundle {
  resourceType: 'Bundle';
  id: string;
  type: 'document' | 'collection';
  timestamp: string;
  entry: FhirBundleEntry[];
}
