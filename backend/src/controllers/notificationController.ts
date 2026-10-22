/**
 * backend/src/controllers/notificationController.ts
 *
 * Request handlers for Notifications, Preferences, and Caregiver Policies.
 */

import { Request, Response, NextFunction } from 'express';
import { notificationService } from '../services/notificationService.js';
import { reminderScheduler } from '../jobs/reminderScheduler.js';
import { db } from '../repositories/database.js';
import {
  updateNotificationPreferencesSchema,
} from '../validators/schemas.js';
import { createError } from '../middlewares/errorHandler.js';

export async function listUserNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return next(createError('Authentication required.', 401));
    const category = req.query['category'] ? String(req.query['category']) : undefined;
    const status = req.query['status'] ? String(req.query['status']) : undefined;

    const notifs = await notificationService.listUserNotifications(req.user.id, category, status);
    res.status(200).json({ status: 'success', data: notifs });
  } catch (err) {
    next(err);
  }
}

export async function markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return next(createError('Authentication required.', 401));
    const notificationId = String(req.params['notificationId']);

    const notif = await notificationService.markNotificationAsRead(notificationId, req.user.id);
    res.status(200).json({ status: 'success', data: notif });
  } catch (err) {
    next(err);
  }
}

export async function acknowledgeCaregiverAlert(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return next(createError('Authentication required.', 401));
    const notificationId = String(req.params['notificationId']);

    const notif = await notificationService.acknowledgeCaregiverAlert(notificationId, req.user.id);
    res.status(200).json({ status: 'success', data: notif });
  } catch (err) {
    next(err);
  }
}

export async function getPreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return next(createError('Authentication required.', 401));
    const familyId = String(req.params['familyId']);

    const prefs = await notificationService.getOrCreatePreferences(req.user.id, familyId);
    res.status(200).json({ status: 'success', data: prefs });
  } catch (err) {
    next(err);
  }
}

export async function updatePreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return next(createError('Authentication required.', 401));
    const familyId = String(req.params['familyId']);
    const validated = updateNotificationPreferencesSchema.parse(req.body);

    const patch: Record<string, unknown> = {};
    if (validated.enableInApp !== undefined || validated.enable_in_app !== undefined)
      patch['enable_in_app'] = validated.enableInApp ?? validated.enable_in_app;
    if (validated.enableBrowser !== undefined || validated.enable_browser !== undefined)
      patch['enable_browser'] = validated.enableBrowser ?? validated.enable_browser;
    if (validated.enableEmail !== undefined || validated.enable_email !== undefined)
      patch['enable_email'] = validated.enableEmail ?? validated.enable_email;
    if (validated.enableSms !== undefined || validated.enable_sms !== undefined)
      patch['enable_sms'] = validated.enableSms ?? validated.enable_sms;
    if (validated.medicationReminders !== undefined || validated.medication_reminders !== undefined)
      patch['medication_reminders'] = validated.medicationReminders ?? validated.medication_reminders;
    if (validated.appointmentReminders !== undefined || validated.appointment_reminders !== undefined)
      patch['appointment_reminders'] = validated.appointmentReminders ?? validated.appointment_reminders;
    if (validated.caregiverEscalations !== undefined || validated.caregiver_escalations !== undefined)
      patch['caregiver_escalations'] = validated.caregiverEscalations ?? validated.caregiver_escalations;
    if (validated.quietHoursEnabled !== undefined || validated.quiet_hours_enabled !== undefined)
      patch['quiet_hours_enabled'] = validated.quietHoursEnabled ?? validated.quiet_hours_enabled;
    if (validated.quietHoursStart !== undefined || validated.quiet_hours_start !== undefined)
      patch['quiet_hours_start'] = validated.quietHoursStart ?? validated.quiet_hours_start;
    if (validated.quietHoursEnd !== undefined || validated.quiet_hours_end !== undefined)
      patch['quiet_hours_end'] = validated.quietHoursEnd ?? validated.quiet_hours_end;
    if (validated.preferredLanguage !== undefined || validated.preferred_language !== undefined)
      patch['preferred_language'] = validated.preferredLanguage ?? validated.preferred_language;

    const prefs = await notificationService.updatePreferences(req.user.id, familyId, patch as any);
    res.status(200).json({ status: 'success', data: prefs });
  } catch (err) {
    next(err);
  }
}

export async function listCaregiverPolicies(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const familyId = String(req.params['familyId']);
    const patientProfileId = req.params['patientProfileId'] || req.query['patientProfileId'];
    if (patientProfileId) {
      const policies = await db.listCaregiverPolicies(String(patientProfileId));
      res.status(200).json({ status: 'success', data: policies });
      return;
    }
    const patients = await db.getFamilyPatientProfiles(familyId);
    let allPolicies: any[] = [];
    for (const p of patients) {
      const pols = await db.listCaregiverPolicies(p.id);
      allPolicies = allPolicies.concat(pols);
    }
    res.status(200).json({ status: 'success', data: allPolicies });
  } catch (err) {
    next(err);
  }
}

export async function upsertCaregiverPolicy(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const familyId = String(req.params['familyId']);
    const patientProfileId = String(req.params['patientProfileId'] || req.body['patientProfileId'] || '');
    const caregiverUserId = String(req.body['caregiverUserId'] || req.user?.id || 'caregiver');
    const escalateUnacknowledgedMeds = req.body['escalateUnacknowledgedMeds'] !== false;
    const medEscalationGraceMinutes = req.body['escalationDelayMinutes'] !== undefined
      ? Number(req.body['escalationDelayMinutes'])
      : req.body['medEscalationGraceMinutes'] !== undefined
      ? Number(req.body['medEscalationGraceMinutes'])
      : 30;
    const escalateUpcomingAppointments = Boolean(req.body['escalateUpcomingAppointments']);

    const policy = await db.upsertCaregiverPolicy({
      family_id: familyId,
      patient_profile_id: patientProfileId,
      caregiver_user_id: caregiverUserId,
      escalate_unacknowledged_meds: escalateUnacknowledgedMeds,
      med_escalation_grace_minutes: medEscalationGraceMinutes,
      escalate_upcoming_appointments: escalateUpcomingAppointments,
    });

    res.status(200).json({
      status: 'success',
      data: {
        ...policy,
        escalation_delay_minutes: policy.med_escalation_grace_minutes,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function triggerSchedulerCheck(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await reminderScheduler.processDueJobs();
    res.status(200).json({
      status: 'success',
      data: {
        processed: result.processedCount,
        failed: result.failedCount,
        ...result,
      },
    });
  } catch (err) {
    next(err);
  }
}
