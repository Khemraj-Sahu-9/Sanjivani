/**
 * backend/src/integrations/abdm/mockAbdmGatewayAdapter.ts
 *
 * Deterministic simulator for Ayushman Bharat Digital Mission (ABDM) Gateway.
 * Supports ABHA M1 verification, M2/M3 consent flow, and FHIR R4 Bundle generation.
 */

import crypto from 'crypto';
import { IABDMGatewayAdapter } from './abdmGatewayInterface.js';
import {
  AbhaVerificationRequest,
  AbhaOtpSession,
  AbhaProfile,
  AbdmConsentRequest,
  AbdmConsentArtefact,
  FhirR4Bundle,
  FhirBundleEntry,
} from './types.js';

export class MockAbdmGatewayAdapter implements IABDMGatewayAdapter {
  private activeSessions = new Map<string, { mobile: string; abha: string; createdAt: number }>();
  private consentStore = new Map<string, AbdmConsentArtefact>();

  isMock(): boolean {
    return true;
  }

  validateAbhaFormat(input: string): {
    valid: boolean;
    type: 'NUMBER' | 'ADDRESS' | 'INVALID';
    formatted?: string;
    error?: string;
  } {
    if (!input || typeof input !== 'string') {
      return { valid: false, type: 'INVALID', error: 'ABHA identifier must be a non-empty string.' };
    }

    const trimmed = input.trim();

    // Check 14-digit numeric ABHA number format (with or without hyphens)
    const normalizedDigits = trimmed.replace(/-/g, '');
    if (/^\d{14}$/.test(normalizedDigits)) {
      const formatted = `${normalizedDigits.slice(0, 2)}-${normalizedDigits.slice(2, 6)}-${normalizedDigits.slice(6, 10)}-${normalizedDigits.slice(10, 14)}`;
      return { valid: true, type: 'NUMBER', formatted };
    }

    // Check ABHA address (handle) format: user@abdm or user@sbx
    if (/^[a-zA-Z0-9._-]+@(abdm|sbx)$/i.test(trimmed)) {
      return { valid: true, type: 'ADDRESS', formatted: trimmed.toLowerCase() };
    }

    return {
      valid: false,
      type: 'INVALID',
      error: 'Invalid ABHA format. Expected 14-digit ABHA Number (XX-XXXX-XXXX-XXXX) or ABHA Address (username@abdm).',
    };
  }

  async initiateAbhaAuth(request: AbhaVerificationRequest): Promise<AbhaOtpSession> {
    const target = request.abhaNumber || request.abhaAddress || '';
    const validation = this.validateAbhaFormat(target);

    if (!validation.valid) {
      throw new Error(`ABDM Validation Failed: ${validation.error}`);
    }

    const txnId = `TXN-SBX-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const maskedMobile = 'XXXXXX9824';

    this.activeSessions.set(txnId, {
      mobile: maskedMobile,
      abha: validation.formatted!,
      createdAt: Date.now(),
    });

    return {
      txnId,
      mobile: maskedMobile,
      authMethod: 'OTP',
      expiresInSeconds: 300,
    };
  }

  async verifyAbhaOtp(txnId: string, otp: string): Promise<AbhaProfile> {
    const session = this.activeSessions.get(txnId);
    if (!session) {
      throw new Error('Invalid or expired ABDM transaction session.');
    }

    if (!/^\d{6}$/.test(otp)) {
      throw new Error('Invalid OTP format. Expected 6-digit numeric OTP.');
    }

    // Reject simulated incorrect OTP
    if (otp === '000000') {
      throw new Error('Incorrect OTP entered. Verification failed.');
    }

    this.activeSessions.delete(txnId);

    const isAddress = session.abha.includes('@');
    const abhaNumber = isAddress ? '91-4829-1029-4821' : session.abha;
    const abhaAddress = isAddress ? session.abha : `user_${session.abha.replace(/-/g, '').slice(-4)}@abdm`;

    return {
      abhaNumber,
      abhaAddress,
      fullName: 'Rameshwar Sharma',
      gender: 'M',
      dateOfBirth: '1962-08-14',
      yearOfBirth: 1962,
      mobile: '+919876549824',
      status: 'ACTIVE',
      kycVerified: true,
    };
  }

  async requestConsent(request: AbdmConsentRequest): Promise<AbdmConsentArtefact> {
    const validation = this.validateAbhaFormat(request.patientAbhaAddress);
    if (!validation.valid) {
      throw new Error(`Consent Request Failed: ${validation.error}`);
    }

    const consentId = `CONSENT-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const now = new Date();
    const expiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const artefact: AbdmConsentArtefact = {
      consentId,
      status: 'GRANTED',
      patientAbhaAddress: validation.formatted!,
      purpose: request.purpose.text,
      hiTypes: request.hiTypes,
      createdAt: now.toISOString(),
      expiresAt: expiry.toISOString(),
      grantedBy: 'Data Principal (Self-Affirmed)',
    };

    this.consentStore.set(consentId, artefact);
    return artefact;
  }

  async getConsentStatus(consentId: string): Promise<AbdmConsentArtefact> {
    const artefact = this.consentStore.get(consentId);
    if (!artefact) {
      throw new Error(`Consent artefact ${consentId} not found.`);
    }
    return artefact;
  }

  exportToFhirBundle(patient: any, records: any[] = [], medications: any[] = []): FhirR4Bundle {
    const bundleId = `bundle-${crypto.randomUUID()}`;
    const timestamp = new Date().toISOString();

    const entries: FhirBundleEntry[] = [];

    // 1. Patient Resource
    const patientResourceId = `Patient/${patient.id || 'pat-default'}`;
    entries.push({
      fullUrl: `urn:uuid:${patient.id || crypto.randomUUID()}`,
      resource: {
        resourceType: 'Patient',
        id: patient.id || 'pat-default',
        identifier: [
          {
            system: 'https://sanjivani.health/identifiers/internal',
            value: patient.healthId || patient.patient_health_id || 'SNJ-2026-0001',
          },
          ...(patient.abhaNumber
            ? [
                {
                  system: 'https://healthid.ndhm.gov.in',
                  value: patient.abhaNumber,
                },
              ]
            : []),
        ],
        name: [
          {
            use: 'official',
            text: patient.fullName || patient.name || 'Unnamed Patient',
          },
        ],
        gender: patient.gender === 'female' ? 'female' : 'male',
        birthDate: patient.dateOfBirth || patient.dob || '1970-01-01',
      },
    });

    // 2. DiagnosticReport Resources (Medical Documents)
    for (const record of records) {
      entries.push({
        fullUrl: `urn:uuid:${record.id || crypto.randomUUID()}`,
        resource: {
          resourceType: 'DiagnosticReport',
          id: record.id || `dr-${Date.now()}`,
          status: 'final',
          category: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
                  code: record.category || 'LAB',
                  display: record.category || 'Laboratory',
                },
              ],
            },
          ],
          code: {
            text: record.title || 'Diagnostic Document',
          },
          subject: {
            reference: patientResourceId,
          },
          effectiveDateTime: record.documentDate || record.created_at || timestamp,
          conclusion: record.summary || record.extractedData?.summary || 'Diagnostic record uploaded to Sanjivani.',
        },
      });
    }

    // 3. MedicationRequest Resources
    for (const med of medications) {
      entries.push({
        fullUrl: `urn:uuid:${med.id || crypto.randomUUID()}`,
        resource: {
          resourceType: 'MedicationRequest',
          id: med.id || `med-${Date.now()}`,
          status: med.status === 'active' ? 'active' : 'completed',
          intent: 'order',
          medicationCodeableConcept: {
            text: med.name || med.medication_name || 'Prescription Medication',
          },
          subject: {
            reference: patientResourceId,
          },
          dosageInstruction: [
            {
              text: `${med.dosage || ''} ${med.frequency || ''}`.trim(),
            },
          ],
        },
      });
    }

    return {
      resourceType: 'Bundle',
      id: bundleId,
      type: 'document',
      timestamp,
      entry: entries,
    };
  }
}
