/**
 * backend/src/integrations/abdm/abdmGatewayInterface.ts
 *
 * Interface defining ABDM Milestone 1 (ABHA), Milestone 2 (HIP) and Milestone 3 (HIU)
 * integration capabilities.
 */

import {
  AbhaVerificationRequest,
  AbhaOtpSession,
  AbhaProfile,
  AbdmConsentRequest,
  AbdmConsentArtefact,
  FhirR4Bundle,
} from './types.js';

export interface IABDMGatewayAdapter {
  /**
   * Validates ABHA string syntax (14-digit number XX-XXXX-XXXX-XXXX or alias@abdm).
   */
  validateAbhaFormat(input: string): {
    valid: boolean;
    type: 'NUMBER' | 'ADDRESS' | 'INVALID';
    formatted?: string;
    error?: string;
  };

  /**
   * Initiates authentication by dispatching an OTP to the ABHA-linked mobile.
   */
  initiateAbhaAuth(request: AbhaVerificationRequest): Promise<AbhaOtpSession>;

  /**
   * Confirms OTP and returns the verified ABHA profile.
   */
  verifyAbhaOtp(txnId: string, otp: string): Promise<AbhaProfile>;

  /**
   * Initiates a consent request via ABDM Consent Manager (HIU role).
   */
  requestConsent(request: AbdmConsentRequest): Promise<AbdmConsentArtefact>;

  /**
   * Retrieves the current status of an ABDM consent artefact.
   */
  getConsentStatus(consentId: string): Promise<AbdmConsentArtefact>;

  /**
   * Transforms Sanjivani internal medical records into an HL7 FHIR R4 Bundle.
   */
  exportToFhirBundle(patient: any, records: any[], medications: any[]): FhirR4Bundle;

  /**
   * Returns whether the adapter runs against live NHA Sandbox or deterministic simulation.
   */
  isMock(): boolean;
}
