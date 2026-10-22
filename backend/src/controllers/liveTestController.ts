/**
 * backend/src/controllers/liveTestController.ts
 *
 * Thin request/response controller for Phase 6 Live Test Mode & Telephony.
 */

import { Request, Response, NextFunction } from 'express';
import { liveTestService } from '../services/liveTestService.js';
import {
  addLiveTestRecipientSchema,
  updateLiveTestConsentSchema,
  verifyLiveTestRecipientSchema,
  dispatchLiveTestSchema,
  acknowledgeLiveTestSchema,
} from '../validators/schemas.js';

export class LiveTestController {
  async getProviderHealth(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const health = liveTestService.getProviderHealth();
      res.status(200).json({ success: true, health });
    } catch (err) {
      next(err);
    }
  }

  async listRecipients(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const familyId = req.params.familyId as string;
      const recipients = await liveTestService.listRecipients(familyId);
      res.status(200).json({ success: true, recipients });
    } catch (err) {
      next(err);
    }
  }

  async addRecipient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const familyId = req.params.familyId as string;
      const userId = req.user!.id;
      const validated = addLiveTestRecipientSchema.parse(req.body);

      const displayName = validated.displayName || validated.display_name || '';
      const phoneNumber = validated.phoneNumber || validated.phone_number || '';
      const permittedChannel = validated.permittedChannel || validated.permitted_channel || 'SMS';
      const allowedPurpose = validated.allowedPurpose || validated.allowed_purpose;
      const consentNotes = validated.consentNotes || validated.consent_notes;

      const recipient = await liveTestService.addRecipient(
        familyId,
        {
          displayName,
          phoneNumber,
          permittedChannel,
          allowedPurpose,
          consentNotes,
          verified: validated.verified,
        },
        userId
      );

      res.status(201).json({ success: true, recipient });
    } catch (err) {
      next(err);
    }
  }

  async verifyRecipient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const familyId = req.params.familyId as string;
      const recipientId = req.params.recipientId as string;
      const userId = req.user!.id;
      const validated = verifyLiveTestRecipientSchema.parse(req.body);

      const recipient = await liveTestService.verifyRecipient(
        familyId,
        recipientId,
        userId,
        validated.status,
        validated.notes
      );

      res.status(200).json({ success: true, recipient });
    } catch (err) {
      next(err);
    }
  }

  async updateConsent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const familyId = req.params.familyId as string;
      const recipientId = req.params.recipientId as string;
      const validated = updateLiveTestConsentSchema.parse(req.body);

      const consentStatus = validated.consentStatus || validated.consent_status || 'CONSENT_GRANTED';
      const recipient = await liveTestService.updateConsent(
        familyId,
        recipientId,
        consentStatus,
        validated.notes
      );

      res.status(200).json({ success: true, recipient });
    } catch (err) {
      next(err);
    }
  }

  async deleteRecipient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const familyId = req.params.familyId as string;
      const recipientId = req.params.recipientId as string;

      await liveTestService.deleteRecipient(familyId, recipientId);
      res.status(200).json({ success: true, message: 'Recipient removed successfully.' });
    } catch (err) {
      next(err);
    }
  }

  async getPreflight(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const familyId = req.params.familyId as string;
      const incidentId = req.params.incidentId as string;

      const preflight = await liveTestService.getPreflight(familyId, incidentId);
      res.status(200).json({ success: true, preflight });
    } catch (err) {
      next(err);
    }
  }

  async dispatchLiveTest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const familyId = req.params.familyId as string;
      const userId = req.user!.id;
      const validated = dispatchLiveTestSchema.parse(req.body);

      const incidentId = validated.incidentId || validated.incident_id || '';
      const recipientIds = validated.recipientIds || validated.recipient_ids || [];
      const operatorConfirmed = Boolean(validated.operatorConfirmed ?? validated.operator_confirmed);
      const idempotencyKey = validated.idempotencyKey || validated.idempotency_key;

      const result = await liveTestService.dispatchLiveTest(familyId, userId, {
        incidentId,
        recipientIds,
        channel: validated.channel,
        operatorConfirmed,
        idempotencyKey,
      });

      res.status(200).json({ success: true, result });
    } catch (err) {
      next(err);
    }
  }

  async recordHumanAcknowledgement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const familyId = req.params.familyId as string;
      const auditLogId = req.params.auditLogId as string;
      const validated = acknowledgeLiveTestSchema.parse(req.body);

      const log = await liveTestService.recordHumanAcknowledgement(familyId, auditLogId, validated.note);
      res.status(200).json({ success: true, auditLog: log });
    } catch (err) {
      next(err);
    }
  }

  async listAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const familyId = req.params.familyId as string;
      const incidentId = req.query.incidentId as string | undefined;

      const logs = await liveTestService.listAuditLogs(familyId, incidentId);
      res.status(200).json({ success: true, logs });
    } catch (err) {
      next(err);
    }
  }

  async handleWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawProvider = Array.isArray(req.params.provider) ? req.params.provider[0] : req.params.provider;
      const providerParam = (rawProvider || '').toLowerCase() as 'twilio' | 'exotel' | 'mock';
      const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

      const result = await liveTestService.processProviderWebhook(providerParam, {
        headers: req.headers as Record<string, string | string[] | undefined>,
        rawBody: typeof req.body === 'string' ? req.body : JSON.stringify(req.body),
        url: fullUrl,
        bodyParams: req.body,
        queryParams: req.query as Record<string, string | string[] | undefined>,
      });

      res.status(result.statusCode).json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const liveTestController = new LiveTestController();
