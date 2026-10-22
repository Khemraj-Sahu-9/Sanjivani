/**
 * backend/src/controllers/pilotIntegrationController.ts
 *
 * Thin request/response controller for Phase 10 Pilot Integrations,
 * ABDM Gateway, Hospital Emergency Gateway, and DPDP Act compliance.
 */

import { Request, Response, NextFunction } from 'express';
import { pilotIntegrationService } from '../services/pilotIntegrationService.js';

export async function getHospitalGatewayHealth(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const health = await pilotIntegrationService.getHospitalGatewayHealth();
    res.status(200).json({ success: true, health });
  } catch (err) {
    next(err);
  }
}

export async function dispatchEmergencyHandoff(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const familyId = req.params.familyId as string;
    const incidentId = req.params.incidentId as string;
    const result = await pilotIntegrationService.dispatchEmergencyHandoff(
      familyId,
      incidentId
    );
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function validateAbha(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { abha } = req.body;
    const result = pilotIntegrationService.validateAbha(abha);
    res.status(200).json({ success: true, result });
  } catch (err) {
    next(err);
  }
}

export async function initiateAbhaAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { abhaNumber, abhaAddress, authMethod } = req.body;
    const session = await pilotIntegrationService.initiateAbhaAuth({
      abhaNumber,
      abhaAddress,
      authMethod: authMethod || 'OTP',
    });
    res.status(200).json({ success: true, session });
  } catch (err) {
    next(err);
  }
}

export async function verifyAbhaOtp(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const familyId = req.params.familyId as string;
    const patientId = req.params.patientId as string;
    const { txnId, otp } = req.body;
    const profile = await pilotIntegrationService.verifyAbhaOtp(
      familyId,
      patientId,
      txnId,
      otp
    );
    res.status(200).json({ success: true, profile });
  } catch (err) {
    next(err);
  }
}

export async function generateFhirBundle(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const familyId = req.params.familyId as string;
    const patientId = req.params.patientId as string;
    const bundle = await pilotIntegrationService.generateFhirBundle(
      familyId,
      patientId
    );
    res.status(200).json({ success: true, bundle });
  } catch (err) {
    next(err);
  }
}

export async function requestConsent(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { patientAbhaAddress, purpose, hiTypes, dateRange, dataEraseAt } = req.body;
    const artefact = await pilotIntegrationService.createConsentRequest({
      patientAbhaAddress,
      purpose,
      hiTypes,
      dateRange,
      dataEraseAt,
    });
    res.status(201).json({ success: true, artefact });
  } catch (err) {
    next(err);
  }
}

export async function getConsentStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const consentId = req.params.consentId as string;
    const status = await pilotIntegrationService.getConsentStatus(consentId);
    res.status(200).json({ success: true, status });
  } catch (err) {
    next(err);
  }
}

export async function exportUserData(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    const exportData = await pilotIntegrationService.exportUserData(userId);
    res.status(200).json({ success: true, export: exportData });
  } catch (err) {
    next(err);
  }
}

export async function deleteUserAccount(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    const { reason } = req.body;
    const certificate = await pilotIntegrationService.deleteUserAccount(
      userId,
      reason
    );
    res.status(200).json({ success: true, certificate });
  } catch (err) {
    next(err);
  }
}
