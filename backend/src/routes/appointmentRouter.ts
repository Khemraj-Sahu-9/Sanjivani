/**
 * backend/src/routes/appointmentRouter.ts
 *
 * Router registration for Doctor & Clinic Appointments.
 */

import { Router } from 'express';
import { requireAuth, requireFamilyRole } from '../middlewares/auth.js';
import * as appointmentController from '../controllers/appointmentController.js';

export const appointmentRouter = Router({ mergeParams: true });

// Read appointments: all members
appointmentRouter.get(
  '/patients/:patientProfileId',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  appointmentController.listAppointments
);

appointmentRouter.get(
  '/',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  appointmentController.listAppointments
);

// Create, reschedule, cancel, complete: owner, adult, guardian
appointmentRouter.post(
  '/',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'guardian']),
  appointmentController.createAppointment
);

appointmentRouter.put(
  '/:appointmentId',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'guardian']),
  appointmentController.updateAppointment
);

appointmentRouter.patch(
  '/:appointmentId',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'guardian']),
  appointmentController.updateAppointment
);

appointmentRouter.post(
  '/:appointmentId/cancel',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'guardian']),
  appointmentController.cancelAppointment
);

appointmentRouter.post(
  '/:appointmentId/complete',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'guardian']),
  appointmentController.completeAppointment
);
