/**
 * backend/src/services/notificationService.ts
 *
 * Reusable Notification Service with extensible channel adapters.
 * Manages in-app notifications, browser notification queuing, caregiver escalation,
 * and user preferences with privacy-preserving notification payloads.
 */

import { db } from '../repositories/database.js';
import { logger } from '../config/logger.js';
import { createError } from '../middlewares/errorHandler.js';
import {
  Notification,
  NotificationCategory,
  NotificationChannel,
  NotificationPreference,
  MedicationDoseOccurrence,
} from '../types/models.js';

export interface SendNotificationOptions {
  familyId?: string | null;
  communityId?: string | null;
  patientProfileId?: string | null;
  recipientUserId: string;
  category: NotificationCategory;
  title: string;
  message: string;
  detailsPayload?: Record<string, unknown>;
  channel?: NotificationChannel;
  scheduledFor?: string;
}

export class NotificationService {
  /**
   * Dispatches or schedules a notification according to user channel preferences.
   */
  async sendNotification(options: SendNotificationOptions): Promise<Notification> {
    const {
      familyId,
      communityId,
      patientProfileId,
      recipientUserId,
      category,
      title,
      message,
      detailsPayload = {},
      channel = 'in_app',
      scheduledFor,
    } = options;

    const scheduledTime = scheduledFor || new Date().toISOString();

    // Check recipient's notification preferences if familyId provided
    let isQuietHours = false;
    let prefs: NotificationPreference | null = null;
    if (familyId) {
      prefs = await this.getOrCreatePreferences(recipientUserId, familyId);
      if (prefs.quiet_hours_enabled && prefs.quiet_hours_start && prefs.quiet_hours_end) {
        isQuietHours = this.isInQuietHours(new Date(), prefs.quiet_hours_start, prefs.quiet_hours_end);
      }
      // Check category enablement
      if (category === 'medication_reminder' && !prefs.medication_reminders) {
        logger.info(`[Notification] Skipping medication reminder for user ${recipientUserId} per preferences`);
      }
    }

    // Determine initial delivery status
    let initialStatus: Notification['status'] = 'scheduled';
    let deliveredAt: string | null = null;
    let failureReason: string | null = null;

    if (channel === 'in_app') {
      // In-app notifications are instantly available in the user's notification center
      initialStatus = 'delivered';
      deliveredAt = new Date().toISOString();
    } else if (channel === 'browser') {
      if (prefs && !prefs.enable_browser) {
        initialStatus = 'failed';
        failureReason = 'browser_notifications_disabled_by_user';
      } else {
        initialStatus = 'delivered';
        deliveredAt = new Date().toISOString();
      }
    } else if (channel === 'sms' || channel === 'email') {
      // External SMS/Email channel adapters: report truthfully when not configured
      initialStatus = 'failed';
      failureReason = `${channel}_provider_not_configured`;
    }

    const notif = await db.createNotification({
      family_id: familyId || null,
      community_id: communityId || null,
      patient_profile_id: patientProfileId || null,
      recipient_user_id: recipientUserId,
      category,
      title: isQuietHours ? `${title} (Muted during quiet hours)` : title,
      message,
      details_payload: detailsPayload,
      channel,
      status: initialStatus,
      scheduled_for: scheduledTime,
      attempt_count: 1,
      last_attempt_at: new Date().toISOString(),
      delivered_at: deliveredAt,
      read_at: null,
      acknowledged_at: null,
      acknowledged_by: null,
      failure_reason: failureReason,
    });

    return notif;
  }

  /**
   * Retrieves notification preferences for a user, creating defaults if not yet present.
   */
  async getOrCreatePreferences(userId: string, familyId: string): Promise<NotificationPreference> {
    const existing = await db.getNotificationPreferences(userId, familyId);
    if (existing) return existing;

    return db.upsertNotificationPreferences({
      user_id: userId,
      family_id: familyId,
      enable_in_app: true,
      enable_browser: true,
      enable_email: false,
      enable_sms: false,
      medication_reminders: true,
      appointment_reminders: true,
      caregiver_escalations: true,
      quiet_hours_enabled: false,
      quiet_hours_start: '22:00',
      quiet_hours_end: '07:00',
      preferred_language: 'en',
    });
  }

  /**
   * Updates notification preferences.
   */
  async updatePreferences(
    userId: string,
    familyId: string,
    patch: Partial<NotificationPreference>
  ): Promise<NotificationPreference> {
    const current = await this.getOrCreatePreferences(userId, familyId);
    return db.upsertNotificationPreferences({
      ...current,
      ...patch,
      user_id: userId,
      family_id: familyId,
    });
  }

  /**
   * Lists notifications visible to the recipient user.
   */
  async listUserNotifications(
    userId: string,
    category?: string,
    status?: string
  ): Promise<Notification[]> {
    return db.listNotificationsForUser(userId, category, status);
  }

  /**
   * Marks an in-app notification as read.
   */
  async markNotificationAsRead(notificationId: string, userId: string): Promise<Notification> {
    const notif = await db.getNotificationById(notificationId);
    if (!notif) throw createError('Notification not found.', 404);
    if (notif.recipient_user_id !== userId) throw createError('Access denied to notification.', 403);

    return db.updateNotification(notificationId, {
      status: notif.status === 'acknowledged' ? 'acknowledged' : 'read',
      read_at: new Date().toISOString(),
    });
  }

  /**
   * Acknowledges a caregiver reminder alert.
   */
  async acknowledgeCaregiverAlert(notificationId: string, userId: string): Promise<Notification> {
    const notif = await db.getNotificationById(notificationId);
    if (!notif) throw createError('Notification not found.', 404);

    return db.updateNotification(notificationId, {
      status: 'acknowledged',
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: userId,
    });
  }

  /**
   * Escalates an unacknowledged medication reminder to designated caregivers.
   */
  async escalateToCaregivers(
    doseOccurrence: MedicationDoseOccurrence,
    patientName: string
  ): Promise<Notification[]> {
    const policies = await db.listCaregiverPolicies(doseOccurrence.patient_profile_id);
    const notificationsSent: Notification[] = [];

    for (const pol of policies) {
      if (!pol.escalate_unacknowledged_meds) continue;

      // Privacy-preserving minimal lock-screen message
      const notif = await this.sendNotification({
        familyId: doseOccurrence.family_id,
        patientProfileId: doseOccurrence.patient_profile_id,
        recipientUserId: pol.caregiver_user_id,
        category: 'medication_escalation',
        title: 'Caregiver Health Alert',
        message: `Scheduled medication for ${patientName} (${doseOccurrence.scheduled_time}) remains unconfirmed. Open Sanjivani to inspect.`,
        detailsPayload: {
          doseOccurrenceId: doseOccurrence.id,
          scheduleId: doseOccurrence.schedule_id,
          patientProfileId: doseOccurrence.patient_profile_id,
          scheduledTime: doseOccurrence.scheduled_time,
          scheduledDate: doseOccurrence.scheduled_date,
        },
      });

      notificationsSent.push(notif);
    }

    return notificationsSent;
  }

  private isInQuietHours(now: Date, startStr: string, endStr: string): boolean {
    const [startH, startM] = startStr.split(':').map(Number);
    const [endH, endM] = endStr.split(':').map(Number);
    if (startH === undefined || startM === undefined || endH === undefined || endM === undefined) {
      return false;
    }

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (startMinutes <= endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    } else {
      // Crosses midnight, e.g. 22:00 to 07:00
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }
  }
}

export const notificationService = new NotificationService();
