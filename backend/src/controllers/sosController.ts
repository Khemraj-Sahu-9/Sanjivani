/**
 * backend/src/controllers/sosController.ts
 *
 * Thin request/response handlers for SOS Emergency Simulation & Hospital Handoff.
 */

import { Request, Response, NextFunction } from 'express';
import { sosService } from '../services/sosService.js';
import { emergencyContactService } from '../services/emergencyContactService.js';
import {
  triggerSosSchema,
  contactAcknowledgementSchema,
  caregiverAcknowledgementSchema,
  hospitalDeskAcknowledgementSchema,
  cancelIncidentSchema,
  resolveIncidentSchema,
  emergencyContactSchema,
  emergencyEscalationPolicySchema,
} from '../validators/schemas.js';

export class SosController {
  async triggerSos(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const familyId = req.params.familyId as string;
      const userId = req.user!.id;
      const validated = triggerSosSchema.parse(req.body);

      const result = await sosService.triggerSos(userId, familyId, validated);
      res.status(201).json({
        success: true,
        incident: result.incident,
        attempts: result.attempts,
      });
    } catch (err) {
      next(err);
    }
  }

  async getActiveIncident(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const familyId = req.params.familyId as string;
      const patientProfileId = req.query.patientProfileId as string | undefined;

      if (!patientProfileId) {
        res.status(200).json({ success: true, incident: null });
        return;
      }

      const incident = await sosService.getActiveIncident(familyId, patientProfileId);
      res.status(200).json({ success: true, incident });
    } catch (err) {
      next(err);
    }
  }

  async listIncidents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const familyId = req.params.familyId as string;
      const patientProfileId = req.query.patientProfileId as string | undefined;

      const incidents = await sosService.listIncidents(familyId, patientProfileId);
      res.status(200).json({ success: true, incidents });
    } catch (err) {
      next(err);
    }
  }

  async getIncident(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const familyId = req.params.familyId as string;
      const incidentId = req.params.incidentId as string;
      const userId = req.user!.id;

      const result = await sosService.getIncident(userId, familyId, incidentId);
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async acknowledgeContact(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const familyId = req.params.familyId as string;
      const incidentId = req.params.incidentId as string;
      const attemptId = req.params.attemptId as string;
      const userId = req.user!.id;
      const validated = contactAcknowledgementSchema.parse(req.body);

      const result = await sosService.acknowledgeContactAttempt(
        userId,
        familyId,
        incidentId,
        attemptId,
        validated.action,
        validated.note
      );

      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async acknowledgeCaregiver(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const familyId = req.params.familyId as string;
      const incidentId = req.params.incidentId as string;
      const attemptId = (req.body.attemptId || req.body.attempt_id) as string;
      const userId = req.user!.id;
      const validated = caregiverAcknowledgementSchema.parse(req.body);

      const result = await sosService.acknowledgeCaregiver(
        userId,
        familyId,
        incidentId,
        attemptId,
        validated.action,
        validated.note
      );

      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async acknowledgeHospitalDesk(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const familyId = req.params.familyId as string;
      const incidentId = req.params.incidentId as string;
      const userId = req.user!.id;
      const validated = hospitalDeskAcknowledgementSchema.parse(req.body);

      const staff = validated.receivingStaffName || validated.receiving_staff_name;
      const notes = validated.receivingNotes || validated.receiving_notes;

      const result = await sosService.acknowledgeHospitalDesk(userId, familyId, incidentId, staff, notes);
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async advanceTimeout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const familyId = req.params.familyId as string;
      const incidentId = req.params.incidentId as string;
      const userId = req.user!.id;

      const result = await sosService.advanceDemoTimeout(userId, familyId, incidentId);
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async resolveIncident(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const familyId = req.params.familyId as string;
      const incidentId = req.params.incidentId as string;
      const userId = req.user!.id;
      const validated = resolveIncidentSchema.parse(req.body);

      const note = validated.resolutionNote || validated.resolution_note;
      const incident = await sosService.resolveIncident(userId, familyId, incidentId, note);
      res.status(200).json({ success: true, incident });
    } catch (err) {
      next(err);
    }
  }

  async cancelIncident(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const familyId = req.params.familyId as string;
      const incidentId = req.params.incidentId as string;
      const userId = req.user!.id;
      const validated = cancelIncidentSchema.parse(req.body);

      const incident = await sosService.cancelIncident(userId, familyId, incidentId, validated.reason);
      res.status(200).json({ success: true, incident });
    } catch (err) {
      next(err);
    }
  }

  async resetDemo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const familyId = req.params.familyId as string;
      const userId = req.user!.id;
      const patientProfileId = (req.body.patientProfileId || req.body.patient_profile_id) as string;

      if (!patientProfileId) {
        res.status(400).json({ success: false, message: 'patientProfileId is required for demo reset' });
        return;
      }

      const result = await sosService.resetDemoScenario(userId, familyId, patientProfileId);
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async seedDemo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const familyId = req.params.familyId as string;
      const patientProfileId = (req.body.patientProfileId || req.body.patient_profile_id) as string;

      if (!patientProfileId) {
        res.status(400).json({ success: false, message: 'patientProfileId is required' });
        return;
      }

      const contacts = await sosService.ensureDemoContacts(familyId, patientProfileId);
      const policy = await sosService.getOrCreatePolicy(familyId, patientProfileId);

      res.status(200).json({ success: true, contacts, policy });
    } catch (err) {
      next(err);
    }
  }

  async listContacts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const familyId = req.params.familyId as string;
      const patientProfileId = req.query.patientProfileId as string | undefined;

      const contacts = await emergencyContactService.listContacts(familyId, patientProfileId);
      res.status(200).json({ success: true, contacts });
    } catch (err) {
      next(err);
    }
  }

  async createContact(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const familyId = req.params.familyId as string;
      const validated = emergencyContactSchema.parse(req.body);

      const contact = await emergencyContactService.createContact(familyId, validated);
      res.status(201).json({ success: true, contact });
    } catch (err) {
      next(err);
    }
  }

  async updateContact(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const familyId = req.params.familyId as string;
      const contactId = req.params.contactId as string;
      const contact = await emergencyContactService.updateContact(familyId, contactId, req.body);
      res.status(200).json({ success: true, contact });
    } catch (err) {
      next(err);
    }
  }

  async deleteContact(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const familyId = req.params.familyId as string;
      const contactId = req.params.contactId as string;
      await emergencyContactService.deleteContact(familyId, contactId);
      res.status(200).json({ success: true, message: 'Emergency contact deleted' });
    } catch (err) {
      next(err);
    }
  }

  async getPolicy(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const familyId = req.params.familyId as string;
      const patientProfileId = req.query.patientProfileId as string;

      if (!patientProfileId) {
        res.status(400).json({ success: false, message: 'patientProfileId is required' });
        return;
      }

      const policy = await emergencyContactService.getPolicy(familyId, patientProfileId);
      res.status(200).json({ success: true, policy });
    } catch (err) {
      next(err);
    }
  }

  async upsertPolicy(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const familyId = req.params.familyId as string;
      const validated = emergencyEscalationPolicySchema.parse(req.body);

      const policy = await emergencyContactService.upsertPolicy(familyId, validated);
      res.status(200).json({ success: true, policy });
    } catch (err) {
      next(err);
    }
  }
}

export const sosController = new SosController();
