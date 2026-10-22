/**
 * backend/src/controllers/appointmentController.ts
 *
 * Request handlers for Doctor and Clinic Appointments.
 */

import { Request, Response, NextFunction } from 'express';
import { appointmentService } from '../services/appointmentService.js';
import {
  createAppointmentSchema,
  updateAppointmentSchema,
} from '../validators/schemas.js';
import { createError } from '../middlewares/errorHandler.js';

export async function createAppointment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return next(createError('Authentication required.', 401));
    const familyId = String(req.params['familyId']);
    const validated = createAppointmentSchema.parse(req.body);

    const appt = await appointmentService.createAppointment(familyId, req.user.id, validated);
    res.status(201).json({ status: 'success', data: appt });
  } catch (err) {
    next(err);
  }
}

export async function updateAppointment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const familyId = String(req.params['familyId']);
    const appointmentId = String(req.params['appointmentId']);
    const validated = updateAppointmentSchema.parse(req.body);

    const appt = await appointmentService.updateAppointment(familyId, appointmentId, validated);
    res.status(200).json({ status: 'success', data: appt });
  } catch (err) {
    next(err);
  }
}

export async function cancelAppointment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const familyId = String(req.params['familyId']);
    const appointmentId = String(req.params['appointmentId']);

    const appt = await appointmentService.cancelAppointment(familyId, appointmentId, req.body.reason);
    res.status(200).json({ status: 'success', data: appt });
  } catch (err) {
    next(err);
  }
}

export async function completeAppointment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const familyId = String(req.params['familyId']);
    const appointmentId = String(req.params['appointmentId']);

    const appt = await appointmentService.completeAppointment(familyId, appointmentId, req.body.notes);
    res.status(200).json({ status: 'success', data: appt });
  } catch (err) {
    next(err);
  }
}

export async function listAppointments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const familyId = String(req.params['familyId']);
    const patientProfileId = req.params['patientProfileId'] || req.query['patientProfileId'] ? String(req.params['patientProfileId'] || req.query['patientProfileId']) : undefined;
    const status = req.query['status'] ? String(req.query['status']) : undefined;

    const list = await appointmentService.listAppointments(familyId, patientProfileId, status);
    res.status(200).json({ status: 'success', data: list });
  } catch (err) {
    next(err);
  }
}
