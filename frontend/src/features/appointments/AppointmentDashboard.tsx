/**
 * frontend/src/features/appointments/AppointmentDashboard.tsx
 *
 * Doctor Appointment Management UI:
 * - Upcoming & Past appointments list
 * - Scheduling new appointments with advance reminders (Asia/Kolkata)
 * - Rescheduling, cancelling, and completing appointments
 */

import React, { useState, useEffect, useCallback } from 'react';
import { PatientProfile } from '../../types/auth';
import { Appointment } from '../../types/appointment';
import { appointmentApiService } from '../../services/appointmentService';

interface AppointmentDashboardProps {
  familyId: string;
  patient: PatientProfile;
  userRole?: string;
}

export const AppointmentDashboard: React.FC<AppointmentDashboardProps> = ({
  familyId,
  patient,
}) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState<boolean>(false);
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [showCompleteModal, setShowCompleteModal] = useState<boolean>(false);

  const [activeAppointment, setActiveAppointment] = useState<Appointment | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [facilityName, setFacilityName] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('10:00');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [reminder24h, setReminder24h] = useState(true);
  const [reminder2h, setReminder2h] = useState(true);

  // Cancel & complete notes
  const [cancelReason, setCancelReason] = useState('');
  const [completeNotes, setCompleteNotes] = useState('');

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    setActionError(null);
    try {
      const res = await appointmentApiService.listAppointments(familyId, {
        patientProfileId: patient.id,
      });
      if (res.data) {
        setAppointments(res.data);
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  }, [familyId, patient.id]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const resetForm = () => {
    setTitle('');
    setDoctorName('');
    setFacilityName('');
    setAppointmentDate('');
    setAppointmentTime('10:00');
    setLocation('');
    setNotes('');
    setReminder24h(true);
    setReminder2h(true);
  };

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setSuccessMsg(null);

    const intervals: number[] = [];
    if (reminder24h) intervals.push(24);
    if (reminder2h) intervals.push(2);

    try {
      await appointmentApiService.createAppointment(familyId, {
        patientProfileId: patient.id,
        title,
        doctorName: doctorName || null,
        facilityName: facilityName || null,
        appointmentDate,
        appointmentTime: appointmentTime || null,
        timezone: 'Asia/Kolkata',
        location: location || null,
        notes: notes || null,
        reminderIntervalsHours: intervals,
      });
      setSuccessMsg('Doctor appointment scheduled successfully with automated reminders!');
      setShowCreateModal(false);
      resetForm();
      loadAppointments();
    } catch (err: any) {
      setActionError(err.message || 'Failed to schedule appointment');
    }
  };

  const handleReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAppointment) return;

    setActionError(null);
    setSuccessMsg(null);

    const intervals: number[] = [];
    if (reminder24h) intervals.push(24);
    if (reminder2h) intervals.push(2);

    try {
      await appointmentApiService.updateAppointment(familyId, activeAppointment.id, {
        appointmentDate,
        appointmentTime,
        reminderIntervalsHours: intervals,
      });
      setSuccessMsg(`Rescheduled ${activeAppointment.title} to ${appointmentDate} at ${appointmentTime}`);
      setShowRescheduleModal(false);
      setActiveAppointment(null);
      loadAppointments();
    } catch (err: any) {
      setActionError(err.message || 'Failed to reschedule appointment');
    }
  };

  const handleConfirmCancel = async () => {
    if (!activeAppointment) return;
    setActionError(null);
    setSuccessMsg(null);
    try {
      await appointmentApiService.cancelAppointment(familyId, activeAppointment.id, cancelReason);
      setSuccessMsg('Appointment cancelled.');
      setShowCancelModal(false);
      setActiveAppointment(null);
      setCancelReason('');
      loadAppointments();
    } catch (err: any) {
      setActionError(err.message || 'Failed to cancel appointment');
    }
  };

  const handleConfirmComplete = async () => {
    if (!activeAppointment) return;
    setActionError(null);
    setSuccessMsg(null);
    try {
      await appointmentApiService.completeAppointment(familyId, activeAppointment.id, completeNotes);
      setSuccessMsg('Appointment marked as completed.');
      setShowCompleteModal(false);
      setActiveAppointment(null);
      setCompleteNotes('');
      loadAppointments();
    } catch (err: any) {
      setActionError(err.message || 'Failed to complete appointment');
    }
  };

  const upcomingAppointments = appointments.filter(
    (a) => a.status === 'scheduled' || a.status === 'rescheduled'
  );
  const pastAppointments = appointments.filter(
    (a) => a.status === 'completed' || a.status === 'cancelled'
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Header */}
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
            <span>🩺</span> Doctor Appointments: <strong>{patient.full_name}</strong>
          </h2>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
            Organize upcoming consultations, hospital visits, and automated advance alerts.
          </p>
        </div>

        <button
          onClick={() => {
            resetForm();
            setShowCreateModal(true);
          }}
          style={{
            padding: '0.55rem 1.15rem',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: '#0f766e',
            color: '#ffffff',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <span>+</span> Schedule Appointment
        </button>
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

      {/* UPCOMING APPOINTMENTS */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '1.25rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.15rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>📅</span> Upcoming Consultations ({upcomingAppointments.length})
        </h3>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Loading appointments...</div>
        ) : upcomingAppointments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', backgroundColor: '#f8fafc', borderRadius: '8px', color: '#64748b', fontSize: '0.9rem' }}>
            No upcoming appointments scheduled. Click &quot;Schedule Appointment&quot; above to book one.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
            {upcomingAppointments.map((app) => (
              <div
                key={app.id}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '1.15rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  backgroundColor: '#ffffff',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b' }}>{app.title}</h4>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '9999px',
                        backgroundColor: app.status === 'rescheduled' ? '#fef3c7' : '#eff6ff',
                        color: app.status === 'rescheduled' ? '#92400e' : '#1e40af',
                        fontWeight: 600,
                      }}
                    >
                      {app.status === 'rescheduled' ? 'Rescheduled' : 'Scheduled'}
                    </span>
                  </div>

                  <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.9rem', color: '#0f766e', fontWeight: 600 }}>
                    🗓 {app.appointment_date} {app.appointment_time && `at ${app.appointment_time}`} ({app.timezone})
                  </p>

                  {app.doctor_name && (
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#334155' }}>
                      <strong>Doctor:</strong> {app.doctor_name}
                    </p>
                  )}
                  {app.facility_name && (
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: '#475569' }}>
                      <strong>Facility:</strong> {app.facility_name}
                    </p>
                  )}
                  {app.location && (
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                      📍 {app.location}
                    </p>
                  )}
                  {app.notes && (
                    <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.8rem', color: '#475569', fontStyle: 'italic', backgroundColor: '#f8fafc', padding: '0.4rem', borderRadius: '4px' }}>
                      &ldquo;{app.notes}&rdquo;
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => {
                      setActiveAppointment(app);
                      setAppointmentDate(app.appointment_date);
                      setAppointmentTime(app.appointment_time || '10:00');
                      setShowRescheduleModal(true);
                    }}
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
                    Reschedule
                  </button>
                  <button
                    onClick={() => {
                      setActiveAppointment(app);
                      setShowCompleteModal(true);
                    }}
                    style={{
                      padding: '0.35rem 0.65rem',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: '#059669',
                      color: '#ffffff',
                      fontSize: '0.775rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    ✓ Complete
                  </button>
                  <button
                    onClick={() => {
                      setActiveAppointment(app);
                      setShowCancelModal(true);
                    }}
                    style={{
                      padding: '0.35rem 0.65rem',
                      borderRadius: '6px',
                      border: '1px solid #fecaca',
                      backgroundColor: '#fef2f2',
                      color: '#991b1b',
                      fontSize: '0.775rem',
                      cursor: 'pointer',
                      marginLeft: 'auto',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PAST APPOINTMENTS */}
      {pastAppointments.length > 0 && (
        <details
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '1rem 1.25rem',
          }}
        >
          <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#64748b', fontSize: '0.95rem' }}>
            Past & Cancelled Appointments ({pastAppointments.length})
          </summary>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
            {pastAppointments.map((app) => (
              <div key={app.id} style={{ padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <h5 style={{ margin: 0, fontSize: '0.95rem', color: '#1e293b' }}>{app.title}</h5>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.15rem 0.45rem',
                      borderRadius: '4px',
                      backgroundColor: app.status === 'completed' ? '#dcfce7' : '#f1f5f9',
                      color: app.status === 'completed' ? '#15803d' : '#64748b',
                      fontWeight: 600,
                    }}
                  >
                    {app.status}
                  </span>
                </div>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                  {app.appointment_date} {app.appointment_time} &bull; {app.doctor_name || 'Doctor'}
                </p>
                {app.notes && (
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#475569' }}>
                    Notes: {app.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        </details>
      )}

      {/* MODAL: CREATE APPOINTMENT */}
      {showCreateModal && (
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
          <div style={{ backgroundColor: '#ffffff', padding: '1.75rem', borderRadius: '12px', maxWidth: '540px', width: '92%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f766e' }}>
                Schedule Doctor Appointment
              </h3>
              <button onClick={() => setShowCreateModal(false)} style={{ border: 'none', background: 'transparent', fontSize: '1.25rem', cursor: 'pointer' }}>
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateAppointment} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                  Appointment Title / Reason *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Regular Cardiologist Checkup, Eye Exam"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.875rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                    Doctor Name
                  </label>
                  <input
                    type="text"
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value)}
                    placeholder="e.g. Dr. Ramesh Gupta"
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.875rem', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                    Hospital / Clinic Name
                  </label>
                  <input
                    type="text"
                    value={facilityName}
                    onChange={(e) => setFacilityName(e.target.value)}
                    placeholder="e.g. Apollo Hospital"
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.875rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                    Appointment Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.875rem', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                    Time (Asia/Kolkata)
                  </label>
                  <input
                    type="time"
                    value={appointmentTime}
                    onChange={(e) => setAppointmentTime(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.875rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                  Location / Address / Room
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Room 204, OPD Block B, Delhi"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.875rem', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                  Notes / Questions for Doctor
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Bring fasting sugar report and previous ECG chart..."
                  rows={2}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.875rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.825rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.4rem' }}>
                  Automated Advance Reminders:
                </span>
                <div style={{ display: 'flex', gap: '1.25rem' }}>
                  <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={reminder24h} onChange={(e) => setReminder24h(e.target.checked)} />
                    24 hours before
                  </label>
                  <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={reminder2h} onChange={(e) => setReminder2h(e.target.checked)} />
                    2 hours before
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '0.5rem 1.25rem', borderRadius: '6px', border: 'none', backgroundColor: '#0f766e', color: '#ffffff', fontWeight: 600, cursor: 'pointer' }}
                >
                  Schedule Appointment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESCHEDULE */}
      {showRescheduleModal && activeAppointment && (
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
          <div style={{ backgroundColor: '#ffffff', padding: '1.5rem', borderRadius: '12px', maxWidth: '420px', width: '90%' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#1e293b' }}>Reschedule Appointment</h3>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: '#64748b' }}>
              Choose a new date and time for <strong>{activeAppointment.title}</strong>. Reminders will be updated automatically.
            </p>

            <form onSubmit={handleReschedule} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  New Date
                </label>
                <input
                  type="date"
                  required
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  New Time
                </label>
                <input
                  type="time"
                  required
                  value={appointmentTime}
                  onChange={(e) => setAppointmentTime(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowRescheduleModal(false)}
                  style={{ padding: '0.45rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '0.45rem 1rem', borderRadius: '6px', border: 'none', backgroundColor: '#0f766e', color: '#ffffff', fontWeight: 600, cursor: 'pointer' }}
                >
                  Confirm Reschedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CANCEL APPOINTMENT */}
      {showCancelModal && activeAppointment && (
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
          <div style={{ backgroundColor: '#ffffff', padding: '1.5rem', borderRadius: '12px', maxWidth: '420px', width: '90%' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#991b1b' }}>Cancel Appointment</h3>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: '#64748b' }}>
              Are you sure you want to cancel <strong>{activeAppointment.title}</strong>? All pending reminder notifications will be cancelled.
            </p>
            <input
              type="text"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Reason for cancellation (optional)..."
              style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box', marginBottom: '1rem' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                onClick={() => setShowCancelModal(false)}
                style={{ padding: '0.45rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', cursor: 'pointer' }}
              >
                Keep Appointment
              </button>
              <button
                onClick={handleConfirmCancel}
                style={{ padding: '0.45rem 1rem', borderRadius: '6px', border: 'none', backgroundColor: '#991b1b', color: '#ffffff', fontWeight: 600, cursor: 'pointer' }}
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: COMPLETE APPOINTMENT */}
      {showCompleteModal && activeAppointment && (
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
          <div style={{ backgroundColor: '#ffffff', padding: '1.5rem', borderRadius: '12px', maxWidth: '440px', width: '90%' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#059669' }}>Mark Appointment as Completed</h3>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: '#64748b' }}>
              Record outcome or summary notes for <strong>{activeAppointment.title}</strong>:
            </p>
            <textarea
              value={completeNotes}
              onChange={(e) => setCompleteNotes(e.target.value)}
              placeholder="Doctor's advice, medication adjustments, or next follow-up instructions..."
              rows={3}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box', marginBottom: '1rem' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                onClick={() => setShowCompleteModal(false)}
                style={{ padding: '0.45rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', cursor: 'pointer' }}
              >
                Close
              </button>
              <button
                onClick={handleConfirmComplete}
                style={{ padding: '0.45rem 1rem', borderRadius: '6px', border: 'none', backgroundColor: '#059669', color: '#ffffff', fontWeight: 600, cursor: 'pointer' }}
              >
                Mark Completed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
