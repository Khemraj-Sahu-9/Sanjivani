/**
 * frontend/src/features/notifications/NotificationCenter.tsx
 *
 * Notification Inbox & Management UI:
 * - In-app inbox with privacy-preserving alerts and delivery status
 * - Notification category and unread filtering
 * - Read and Acknowledge actions
 * - Preferences & Quiet Hours configuration modal
 * - Caregiver Escalation Policy settings modal
 * - Immediate scheduler trigger for verification
 */

import React, { useState, useEffect, useCallback } from 'react';
import { PatientProfile } from '../../types/auth';
import {
  Notification,
  NotificationPreference,
  CaregiverReminderPolicy,
} from '../../types/notification';
import { notificationApiService } from '../../services/notificationService';

interface NotificationCenterProps {
  familyId: string;
  patient?: PatientProfile | null;
  userRole?: string;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  familyId,
  patient,
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [unreadOnly, setUnreadOnly] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals state
  const [showPreferencesModal, setShowPreferencesModal] = useState<boolean>(false);
  const [showCaregiverModal, setShowCaregiverModal] = useState<boolean>(false);

  // Preferences form state
  const [preferences, setPreferences] = useState<NotificationPreference | null>(null);
  const [prefInApp, setPrefInApp] = useState(true);
  const [prefBrowser, setPrefBrowser] = useState(false);
  const [prefQuietHoursEnabled, setPrefQuietHoursEnabled] = useState(false);
  const [prefQuietStart, setPrefQuietStart] = useState('22:00');
  const [prefQuietEnd, setPrefQuietEnd] = useState('07:00');
  const [prefLanguage, setPrefLanguage] = useState('en');

  // Caregiver policy form state
  const [, setCaregiverPolicies] = useState<CaregiverReminderPolicy[]>([]);
  const [policyEscalateMeds, setPolicyEscalateMeds] = useState(true);
  const [policyDelayMinutes, setPolicyDelayMinutes] = useState(30);
  const [policyOverrideQuiet, setPolicyOverrideQuiet] = useState(false);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setActionError(null);
    try {
      const res = await notificationApiService.listNotifications(familyId, {
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        patientProfileId: patient?.id,
      });
      if (res.data) {
        setNotifications(res.data);
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [familyId, categoryFilter, patient?.id]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const loadPreferences = async () => {
    try {
      const res = await notificationApiService.getPreferences(familyId);
      if (res.data) {
        setPreferences(res.data);
        setPrefInApp(res.data.enable_in_app);
        setPrefBrowser(res.data.enable_browser);
        setPrefQuietHoursEnabled(res.data.quiet_hours_enabled);
        setPrefQuietStart(res.data.quiet_hours_start);
        setPrefQuietEnd(res.data.quiet_hours_end);
        setPrefLanguage(res.data.preferred_language || 'en');
      }
    } catch {
      // fallback
    }
  };

  const loadCaregiverPolicies = async () => {
    try {
      const res = await notificationApiService.getCaregiverPolicies(familyId);
      if (res.data && res.data.length > 0) {
        setCaregiverPolicies(res.data);
        const p = res.data[0];
        setPolicyEscalateMeds(p.escalate_unacknowledged_meds);
        setPolicyDelayMinutes(p.escalation_delay_minutes);
        setPolicyOverrideQuiet(p.quiet_hours_override_for_urgent);
      }
    } catch {
      // fallback
    }
  };

  const handleOpenPreferences = () => {
    loadPreferences();
    setShowPreferencesModal(true);
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setSuccessMsg(null);
    try {
      await notificationApiService.updatePreferences(familyId, {
        enable_in_app: prefInApp,
        enable_browser: prefBrowser,
        quiet_hours_enabled: prefQuietHoursEnabled,
        quiet_hours_start: prefQuietStart,
        quiet_hours_end: prefQuietEnd,
        preferred_language: prefLanguage,
      });
      setSuccessMsg('Notification preferences updated successfully');
      setShowPreferencesModal(false);
    } catch (err: any) {
      setActionError(err.message || 'Failed to update preferences');
    }
  };

  const handleOpenCaregiverPolicy = () => {
    loadCaregiverPolicies();
    setShowCaregiverModal(true);
  };

  const handleSaveCaregiverPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patient) return;
    setActionError(null);
    setSuccessMsg(null);
    try {
      await notificationApiService.setCaregiverPolicy(familyId, {
        patientProfileId: patient.id,
        caregiverUserId: preferences?.user_id || 'caregiver',
        escalateUnacknowledgedMeds: policyEscalateMeds,
        escalationDelayMinutes: Number(policyDelayMinutes),
        quietHoursOverrideForUrgent: policyOverrideQuiet,
      });
      setSuccessMsg('Caregiver reminder escalation policy saved');
      setShowCaregiverModal(false);
    } catch (err: any) {
      setActionError(err.message || 'Failed to update caregiver policy');
    }
  };

  const handleMarkRead = async (notificationId: string) => {
    try {
      await notificationApiService.markAsRead(familyId, notificationId);
      loadNotifications();
    } catch (err: any) {
      setActionError(err.message || 'Failed to mark notification as read');
    }
  };

  const handleAcknowledge = async (notificationId: string) => {
    try {
      await notificationApiService.acknowledgeNotification(familyId, notificationId);
      setSuccessMsg('Notification acknowledged and recorded.');
      loadNotifications();
    } catch (err: any) {
      setActionError(err.message || 'Failed to acknowledge notification');
    }
  };

  const handleTriggerTestDispatch = async () => {
    setActionError(null);
    setSuccessMsg(null);
    try {
      const res = await notificationApiService.triggerTestDispatch(familyId);
      setSuccessMsg(`Notification runner executed: processed ${res.data?.processed ?? 0} scheduled tasks.`);
      loadNotifications();
    } catch (err: any) {
      setActionError(err.message || 'Failed to run notification dispatcher');
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (unreadOnly && (n.status === 'read' || n.status === 'acknowledged')) return false;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header & Controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          backgroundColor: '#ffffff',
          padding: '1.25rem',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '1.35rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🔔</span> Notification Center
          </h2>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
            Privacy-preserving alerts, dose reminders, caregiver escalations, and consultation notices.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
          <button
            onClick={handleTriggerTestDispatch}
            style={{
              padding: '0.5rem 0.85rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#f8fafc',
              color: '#334155',
              fontWeight: 600,
              fontSize: '0.825rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <span>⚡</span> Sync / Run Scheduler
          </button>
          <button
            onClick={handleOpenCaregiverPolicy}
            style={{
              padding: '0.5rem 0.85rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#f8fafc',
              color: '#0f766e',
              fontWeight: 600,
              fontSize: '0.825rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <span>🛡️</span> Caregiver Policy
          </button>
          <button
            onClick={handleOpenPreferences}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#0f766e',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '0.825rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <span>⚙️</span> Preferences & Quiet Hours
          </button>
        </div>
      </div>

      {actionError && (
        <div style={{ padding: '0.75rem 1rem', borderRadius: '8px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: '0.875rem' }}>
          ⚠️ {actionError}
        </div>
      )}
      {successMsg && (
        <div style={{ padding: '0.75rem 1rem', borderRadius: '8px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontSize: '0.875rem' }}>
          ✅ {successMsg}
        </div>
      )}

      {/* FILTER BAR */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          backgroundColor: '#f8fafc',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.825rem', fontWeight: 600, color: '#475569' }}>Filter Category:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.825rem' }}
          >
            <option value="all">All Notifications</option>
            <option value="medication_reminder">Medication Reminders</option>
            <option value="medication_escalation">Caregiver Escalations</option>
            <option value="appointment_reminder">Appointment Reminders</option>
            <option value="general">General</option>
          </select>
        </div>

        <label style={{ fontSize: '0.825rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
          />
          Show Unread / Action Required Only
        </label>
      </div>

      {/* NOTIFICATIONS INBOX */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '1.25rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Loading notification inbox...</div>
        ) : filteredNotifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', backgroundColor: '#f8fafc', borderRadius: '8px', color: '#64748b', fontSize: '0.9rem' }}>
            No notifications in this inbox.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filteredNotifications.map((n) => {
              const isEscalation = n.category === 'medication_escalation';
              const isUnread = n.status !== 'read' && n.status !== 'acknowledged';

              let categoryBadge = 'General';
              let badgeColor = '#475569';
              let badgeBg = '#f1f5f9';

              if (n.category === 'medication_reminder') {
                categoryBadge = 'Dose Reminder';
                badgeColor = '#0f766e';
                badgeBg = '#f0fdfa';
              } else if (n.category === 'medication_escalation') {
                categoryBadge = 'Caregiver Escalation';
                badgeColor = '#991b1b';
                badgeBg = '#fef2f2';
              } else if (n.category === 'appointment_reminder') {
                categoryBadge = 'Doctor Appointment';
                badgeColor = '#1e40af';
                badgeBg = '#eff6ff';
              }

              return (
                <div
                  key={n.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    padding: '1rem',
                    borderRadius: '8px',
                    border: isEscalation ? '1px solid #fecaca' : isUnread ? '1px solid #cbd5e1' : '1px solid #f1f5f9',
                    backgroundColor: isEscalation ? '#fff5f5' : isUnread ? '#ffffff' : '#f8fafc',
                    boxShadow: isUnread ? '0 1px 3px rgba(0,0,0,0.04)' : 'none',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ flex: 1, minWidth: '260px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '9999px',
                          backgroundColor: badgeBg,
                          color: badgeColor,
                        }}
                      >
                        {categoryBadge}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        via {n.channel.toUpperCase()} &bull; {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.1rem 0.4rem',
                          borderRadius: '4px',
                          backgroundColor: '#f1f5f9',
                          color: '#64748b',
                        }}
                      >
                        {n.status}
                      </span>
                    </div>

                    <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', color: '#1e293b' }}>{n.title}</h4>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', lineHeight: 1.4 }}>
                      {n.message}
                    </p>

                    {/* Privacy-Preserving Lock Screen Note */}
                    <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: '#64748b' }}>
                      🔒 <em>Privacy-preserved delivery: no clinical identifiers leaked to external push headers.</em>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {n.status !== 'read' && n.status !== 'acknowledged' && (
                      <button
                        onClick={() => handleMarkRead(n.id)}
                        style={{
                          padding: '0.35rem 0.65rem',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          backgroundColor: '#ffffff',
                          color: '#475569',
                          fontSize: '0.775rem',
                          cursor: 'pointer',
                        }}
                      >
                        Mark Read
                      </button>
                    )}
                    {n.status !== 'acknowledged' && (
                      <button
                        onClick={() => handleAcknowledge(n.id)}
                        style={{
                          padding: '0.35rem 0.85rem',
                          borderRadius: '6px',
                          border: 'none',
                          backgroundColor: '#0f766e',
                          color: '#ffffff',
                          fontWeight: 600,
                          fontSize: '0.775rem',
                          cursor: 'pointer',
                        }}
                      >
                        ✓ Acknowledge
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: NOTIFICATION PREFERENCES & QUIET HOURS */}
      {showPreferencesModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div style={{ backgroundColor: '#ffffff', padding: '1.75rem', borderRadius: '12px', maxWidth: '480px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#1e293b' }}>
                Notification Preferences
              </h3>
              <button onClick={() => setShowPreferencesModal(false)} style={{ border: 'none', background: 'transparent', fontSize: '1.25rem', cursor: 'pointer' }}>
                &times;
              </button>
            </div>

            <form onSubmit={handleSavePreferences} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.5rem' }}>
                  Delivery Channels
                </span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', marginBottom: '0.4rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={prefInApp} onChange={(e) => setPrefInApp(e.target.checked)} />
                  In-App Notification Center
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={prefBrowser} onChange={(e) => setPrefBrowser(e.target.checked)} />
                  Browser Desktop Notifications
                </label>
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.5rem' }}>
                  Quiet Hours (Asia/Kolkata)
                </span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', marginBottom: '0.6rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={prefQuietHoursEnabled} onChange={(e) => setPrefQuietHoursEnabled(e.target.checked)} />
                  Enable Quiet Hours (Hold non-urgent reminders)
                </label>

                {prefQuietHoursEnabled && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', marginBottom: '0.2rem' }}>
                        Start Time
                      </label>
                      <input
                        type="time"
                        value={prefQuietStart}
                        onChange={(e) => setPrefQuietStart(e.target.value)}
                        style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', marginBottom: '0.2rem' }}>
                        End Time
                      </label>
                      <input
                        type="time"
                        value={prefQuietEnd}
                        onChange={(e) => setPrefQuietEnd(e.target.value)}
                        style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>
                  Preferred Language
                </label>
                <select
                  value={prefLanguage}
                  onChange={(e) => setPrefLanguage(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                >
                  <option value="en">English (en)</option>
                  <option value="hi">Hindi (hi)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowPreferencesModal(false)}
                  style={{ padding: '0.45rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '0.45rem 1rem', borderRadius: '6px', border: 'none', backgroundColor: '#0f766e', color: '#ffffff', fontWeight: 600, cursor: 'pointer' }}
                >
                  Save Preferences
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CAREGIVER ESCALATION POLICY */}
      {showCaregiverModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div style={{ backgroundColor: '#ffffff', padding: '1.75rem', borderRadius: '12px', maxWidth: '480px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#1e293b' }}>
                Caregiver Escalation Policy
              </h3>
              <button onClick={() => setShowCaregiverModal(false)} style={{ border: 'none', background: 'transparent', fontSize: '1.25rem', cursor: 'pointer' }}>
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveCaregiverPolicy} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                Configure rules to alert family caregivers if a scheduled medication dose is left unconfirmed beyond the grace period.
              </p>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={policyEscalateMeds}
                  onChange={(e) => setPolicyEscalateMeds(e.target.checked)}
                />
                Escalate unacknowledged medication doses to caregivers
              </label>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>
                  Escalation Grace Period (Minutes)
                </label>
                <select
                  value={policyDelayMinutes}
                  onChange={(e) => setPolicyDelayMinutes(Number(e.target.value))}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                >
                  <option value={15}>15 Minutes</option>
                  <option value={30}>30 Minutes</option>
                  <option value={60}>60 Minutes (1 Hour)</option>
                  <option value={120}>120 Minutes (2 Hours)</option>
                </select>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={policyOverrideQuiet}
                  onChange={(e) => setPolicyOverrideQuiet(e.target.checked)}
                />
                Override Quiet Hours for critical escalations
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCaregiverModal(false)}
                  style={{ padding: '0.45rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '0.45rem 1rem', borderRadius: '6px', border: 'none', backgroundColor: '#0f766e', color: '#ffffff', fontWeight: 600, cursor: 'pointer' }}
                >
                  Save Policy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
