/**
 * frontend/src/types/notification.ts
 *
 * Types for Notifications, In-App Center, Preferences, and Caregiver Escalation Policies.
 */

export type NotificationCategory =
  | 'medication_reminder'
  | 'medication_escalation'
  | 'appointment_reminder'
  | 'general';

export type NotificationChannel =
  | 'in_app'
  | 'browser'
  | 'email'
  | 'sms';

export type NotificationStatus =
  | 'scheduled'
  | 'queued'
  | 'attempted'
  | 'delivered'
  | 'failed'
  | 'cancelled'
  | 'read'
  | 'acknowledged';

export interface Notification {
  id: string;
  family_id: string;
  patient_profile_id?: string | null;
  recipient_user_id: string;
  category: NotificationCategory;
  title: string;
  message: string;
  details_payload: Record<string, unknown>;
  channel: NotificationChannel;
  status: NotificationStatus;
  scheduled_for: string;
  attempt_count: number;
  last_attempt_at?: string | null;
  delivered_at?: string | null;
  read_at?: string | null;
  acknowledged_at?: string | null;
  acknowledged_by?: string | null;
  failure_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreference {
  id: string;
  user_id: string;
  family_id: string;
  enable_in_app: boolean;
  enable_browser: boolean;
  enable_email: boolean;
  enable_sms: boolean;
  medication_reminders: boolean;
  appointment_reminders: boolean;
  caregiver_escalations: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  preferred_language: string;
  created_at: string;
  updated_at: string;
}

export interface CaregiverReminderPolicy {
  id: string;
  family_id: string;
  patient_profile_id: string;
  caregiver_user_id: string;
  escalate_unacknowledged_meds: boolean;
  escalation_delay_minutes: number;
  quiet_hours_override_for_urgent: boolean;
  created_at: string;
  updated_at: string;
}
