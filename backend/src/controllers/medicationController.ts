/**
 * backend/src/controllers/medicationController.ts
 *
 * Request handlers for Medication Schedules, Confirmation, and Dose Tracking.
 */

import { Request, Response, NextFunction } from 'express';
import { medicationService } from '../services/medicationService.js';
import {
  createMedicationScheduleSchema,
  updateMedicationScheduleSchema,
  recordDoseOccurrenceStatusSchema,
} from '../validators/schemas.js';
import { createError } from '../middlewares/errorHandler.js';

export async function createSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return next(createError('Authentication required.', 401));
    const familyId = String(req.params['familyId']);
    const validated = createMedicationScheduleSchema.parse(req.body);

    const schedule = await medicationService.createSchedule(familyId, req.user.id, validated);
    res.status(201).json({ status: 'success', data: schedule });
  } catch (err) {
    next(err);
  }
}

export async function confirmSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return next(createError('Authentication required.', 401));
    const familyId = String(req.params['familyId']);
    const scheduleId = String(req.params['scheduleId']);

    const schedule = await medicationService.confirmSchedule(familyId, req.user.id, scheduleId, req.body);
    res.status(200).json({ status: 'success', data: schedule });
  } catch (err) {
    next(err);
  }
}

export async function updateSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return next(createError('Authentication required.', 401));
    const familyId = String(req.params['familyId']);
    const scheduleId = String(req.params['scheduleId']);
    const validated = updateMedicationScheduleSchema.parse(req.body);

    const schedule = await medicationService.updateSchedule(familyId, req.user.id, scheduleId, validated);
    res.status(200).json({ status: 'success', data: schedule });
  } catch (err) {
    next(err);
  }
}

export async function getSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const familyId = String(req.params['familyId']);
    const scheduleId = String(req.params['scheduleId']);

    const details = await medicationService.getScheduleDetails(familyId, scheduleId);
    res.status(200).json({ status: 'success', data: details });
  } catch (err) {
    next(err);
  }
}

export async function listSchedules(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const familyId = String(req.params['familyId']);
    const patientProfileId = req.params['patientProfileId'] || req.query['patientProfileId'] ? String(req.params['patientProfileId'] || req.query['patientProfileId']) : undefined;
    const status = req.query['status'] ? String(req.query['status']) : undefined;

    const list = await medicationService.listPatientSchedules(familyId, patientProfileId, status);
    res.status(200).json({ status: 'success', data: list });
  } catch (err) {
    next(err);
  }
}

export async function listDoseOccurrences(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const familyId = String(req.params['familyId']);
    const patientProfileId = String(req.params['patientProfileId'] || req.query['patientProfileId'] || '');

    const todayStr = new Date().toISOString().split('T')[0]!;
    const startDate = req.query['startDate'] ? String(req.query['startDate']) : todayStr;
    const endDate = req.query['endDate'] ? String(req.query['endDate']) : todayStr;

    const doses = await medicationService.listDoseOccurrences(familyId, patientProfileId, startDate, endDate);
    res.status(200).json({ status: 'success', data: doses });
  } catch (err) {
    next(err);
  }
}

export async function generateDoses(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const familyId = String(req.params['familyId']);
    const patientProfileId = String(req.body['patientProfileId'] || req.params['patientProfileId'] || '');
    const daysAhead = req.body['daysAhead'] ? Number(req.body['daysAhead']) : 7;

    const generatedCount = await medicationService.generateDosesForPatient(familyId, patientProfileId, daysAhead);
    res.status(200).json({ status: 'success', data: { generatedCount } });
  } catch (err) {
    next(err);
  }
}

export async function recordDoseStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return next(createError('Authentication required.', 401));
    const familyId = String(req.params['familyId']);
    const occurrenceId = String(req.params['occurrenceId'] || req.params['doseId']);
    const validated = recordDoseOccurrenceStatusSchema.parse(req.body);

    const updated = await medicationService.recordDoseStatus(
      familyId,
      req.user.id,
      occurrenceId,
      validated.status,
      validated.note || undefined
    );
    res.status(200).json({ status: 'success', data: updated });
  } catch (err) {
    next(err);
  }
}

export async function prefillFromPrescription(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const familyId = String(req.params['familyId']);
    const patientProfileId = String(req.params['patientProfileId'] || req.query['patientProfileId'] || '');
    const documentId = String(req.params['documentId'] || req.query['documentId'] || '');

    const candidates = await medicationService.prefillFromPrescription(familyId, patientProfileId, documentId);
    res.status(200).json({ status: 'success', data: candidates });
  } catch (err) {
    next(err);
  }
}

export async function getScheduleHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const familyId = String(req.params['familyId']);
    const scheduleId = String(req.params['scheduleId']);

    const history = await medicationService.getScheduleHistory(familyId, scheduleId);
    res.status(200).json({ status: 'success', data: history });
  } catch (err) {
    next(err);
  }
}

export async function pauseSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return next(createError('Authentication required.', 401));
    const familyId = String(req.params['familyId']);
    const scheduleId = String(req.params['scheduleId']);

    const schedule = await medicationService.updateSchedule(familyId, req.user.id, scheduleId, {
      status: 'paused',
      instructions: req.body.reason ? `Paused: ${req.body.reason}` : undefined,
    });
    res.status(200).json({ status: 'success', data: schedule });
  } catch (err) {
    next(err);
  }
}

export async function resumeSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return next(createError('Authentication required.', 401));
    const familyId = String(req.params['familyId']);
    const scheduleId = String(req.params['scheduleId']);

    const schedule = await medicationService.updateSchedule(familyId, req.user.id, scheduleId, {
      status: 'active',
    });
    res.status(200).json({ status: 'success', data: schedule });
  } catch (err) {
    next(err);
  }
}

export async function discontinueSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return next(createError('Authentication required.', 401));
    const familyId = String(req.params['familyId']);
    const scheduleId = String(req.params['scheduleId']);

    const schedule = await medicationService.updateSchedule(familyId, req.user.id, scheduleId, {
      status: 'discontinued',
      instructions: req.body.reason ? `Discontinued: ${req.body.reason}` : undefined,
    });
    res.status(200).json({ status: 'success', data: schedule });
  } catch (err) {
    next(err);
  }
}
