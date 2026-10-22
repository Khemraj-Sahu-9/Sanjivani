/**
 * frontend/src/features/medications/MedicationDashboard.tsx
 *
 * Comprehensive Medication Management UI:
 * - Today's Dose Tracker (Scheduled, Taken, Skipped, Missed, Undo)
 * - Active & Draft Medication Schedules
 * - Explicit Confirmation for Prescription-derived Schedules
 * - Prescription Prefill Workflow
 * - Manual Schedule Creation & Update
 * - Schedule Change History Modal
 */

import React, { useState, useEffect, useCallback } from 'react';
import { PatientProfile } from '../../types/auth';
import {
  MedicationSchedule,
  MedicationDoseOccurrence,
  MedicationScheduleHistory,
  PrefilledMedicineCandidate,
  DoseOccurrenceStatus,
} from '../../types/medication';
import { HealthDocument } from '../../types/document';
import { medicationApiService } from '../../services/medicationService';
import { documentApiService } from '../../services/documentService';

interface MedicationDashboardProps {
  familyId: string;
  patient: PatientProfile;
  userRole?: string;
}

export const MedicationDashboard: React.FC<MedicationDashboardProps> = ({
  familyId,
  patient,
  userRole: _userRole = 'adult',
}) => {
  const [schedules, setSchedules] = useState<MedicationSchedule[]>([]);
  const [doses, setDoses] = useState<MedicationDoseOccurrence[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals state
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showPrefillModal, setShowPrefillModal] = useState<boolean>(false);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [historyItems, setHistoryItems] = useState<MedicationScheduleHistory[]>([]);
  const [historyScheduleName, setHistoryScheduleName] = useState<string>('');

  // Prescription documents for prefill
  const [patientDocs, setPatientDocs] = useState<HealthDocument[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [prefillCandidates, setPrefillCandidates] = useState<PrefilledMedicineCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState<boolean>(false);

  // Form State for Create/Edit Schedule
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [formMedicineName, setFormMedicineName] = useState('');
  const [formStrength, setFormStrength] = useState('');
  const [formDosageInstruction, setFormDosageInstruction] = useState('');
  const [formFrequency, setFormFrequency] = useState('once_daily');
  const [formScheduledTimes, setFormScheduledTimes] = useState('08:00');
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [formEndDate, setFormEndDate] = useState('');
  const [formPrescriberName, setFormPrescriberName] = useState('');
  const [formInstructions, setFormInstructions] = useState('');
  const [formSourceDocId, setFormSourceDocId] = useState<string | null>(null);
  const [formSourceMedName, setFormSourceMedName] = useState<string | null>(null);
  const [formSaveAsDraft, setFormSaveAsDraft] = useState(false);

  // Skip dose prompt state
  const [skippingDoseId, setSkippingDoseId] = useState<string | null>(null);
  const [skipNote, setSkipNote] = useState<string>('');

  // Load all schedules and doses for today
  const loadData = useCallback(async () => {
    setLoading(true);
    setActionError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);

      const [schedRes, doseRes] = await Promise.all([
        medicationApiService.listSchedules(familyId, { patientProfileId: patient.id }),
        medicationApiService.listDoses(familyId, {
          patientProfileId: patient.id,
          startDate: today,
          endDate: today,
        }),
      ]);

      if (schedRes.data) setSchedules(schedRes.data);
      if (doseRes.data) setDoses(doseRes.data);
    } catch (err: any) {
      setActionError(err.message || 'Failed to load medication data');
    } finally {
      setLoading(false);
    }
  }, [familyId, patient.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load patient documents for prescription prefill
  const loadPrescriptionDocs = async () => {
    try {
      const res = await documentApiService.listDocuments(familyId, {
        patientProfileId: patient.id,
      });
      if (res.data) {
        // filter by prescription category or docs with medical review
        const rxDocs = res.data.filter(
          (d) => d.category === 'prescription' || d.category === 'discharge_summary'
        );
        setPatientDocs(rxDocs);
        if (rxDocs.length > 0 && !selectedDocId) {
          setSelectedDocId(rxDocs[0].id);
          fetchCandidates(rxDocs[0].id);
        }
      }
    } catch {
      // ignore silently
    }
  };

  const fetchCandidates = async (docId: string) => {
    setLoadingCandidates(true);
    setPrefillCandidates([]);
    try {
      const res = await medicationApiService.getPrefillCandidates(familyId, docId, patient.id);
      if (res.data) {
        setPrefillCandidates(res.data);
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to extract medicines from prescription');
    } finally {
      setLoadingCandidates(false);
    }
  };

  // Open Prefill Modal
  const handleOpenPrefill = () => {
    setShowPrefillModal(true);
    loadPrescriptionDocs();
  };

  // Select a candidate to populate form
  const handleSelectCandidate = (candidate: PrefilledMedicineCandidate) => {
    setEditingScheduleId(null);
    setFormMedicineName(candidate.medicineName);
    setFormStrength(candidate.strength || '');
    setFormDosageInstruction(candidate.dosageInstruction);
    setFormFrequency(candidate.frequency);
    setFormScheduledTimes(candidate.suggestedTimes.join(', '));
    setFormStartDate(new Date().toISOString().slice(0, 10));
    setFormEndDate('');
    setFormPrescriberName(candidate.prescriberName || '');
    setFormInstructions('');
    setFormSourceDocId(candidate.sourceDocumentId);
    setFormSourceMedName(candidate.sourceMedicineName);
    setFormSaveAsDraft(true); // require explicit confirmation by default for extracted prescriptions

    setShowPrefillModal(false);
    setShowAddModal(true);
  };

  // Reset Form
  const resetForm = () => {
    setEditingScheduleId(null);
    setFormMedicineName('');
    setFormStrength('');
    setFormDosageInstruction('');
    setFormFrequency('once_daily');
    setFormScheduledTimes('08:00');
    setFormStartDate(new Date().toISOString().slice(0, 10));
    setFormEndDate('');
    setFormPrescriberName('');
    setFormInstructions('');
    setFormSourceDocId(null);
    setFormSourceMedName(null);
    setFormSaveAsDraft(false);
  };

  // Handle Save Schedule (Create or Update)
  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setSuccessMsg(null);

    const times = formScheduledTimes
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    if (times.length === 0) {
      setActionError('At least one scheduled time (HH:mm) is required');
      return;
    }

    try {
      if (editingScheduleId) {
        await medicationApiService.updateSchedule(familyId, editingScheduleId, {
          dosageInstruction: formDosageInstruction,
          frequency: formFrequency,
          scheduledTimes: times,
          endDate: formEndDate || null,
          instructions: formInstructions || null,
        });
        setSuccessMsg('Medication schedule updated successfully');
      } else {
        await medicationApiService.createSchedule(familyId, {
          patientProfileId: patient.id,
          medicineName: formMedicineName,
          strength: formStrength || null,
          dosageInstruction: formDosageInstruction,
          frequency: formFrequency,
          scheduledTimes: times,
          startDate: formStartDate,
          endDate: formEndDate || null,
          prescriberName: formPrescriberName || null,
          instructions: formInstructions || null,
          sourceDocumentId: formSourceDocId,
          sourceMedicineName: formSourceMedName,
          isDraftPendingConfirmation: formSaveAsDraft,
        });
        setSuccessMsg(
          formSaveAsDraft
            ? 'Draft schedule saved. Please review and confirm before it becomes active.'
            : 'Medication schedule created and activated!'
        );
      }
      setShowAddModal(false);
      resetForm();
      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to save medication schedule');
    }
  };

  // Confirm Draft Schedule
  const handleConfirmDraft = async (schedule: MedicationSchedule) => {
    setActionError(null);
    setSuccessMsg(null);
    try {
      await medicationApiService.confirmDraft(familyId, schedule.id);
      setSuccessMsg(`Confirmed and activated schedule for ${schedule.medicine_name}`);
      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to confirm schedule');
    }
  };

  // Pause / Resume / Discontinue
  const handlePause = async (scheduleId: string) => {
    const reason = window.prompt('Reason for pausing this schedule? (Optional)') || undefined;
    try {
      await medicationApiService.pauseSchedule(familyId, scheduleId, reason);
      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to pause schedule');
    }
  };

  const handleResume = async (scheduleId: string) => {
    try {
      await medicationApiService.resumeSchedule(familyId, scheduleId);
      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to resume schedule');
    }
  };

  const handleDiscontinue = async (scheduleId: string) => {
    if (!window.confirm('Are you sure you want to discontinue this medication schedule? All future doses will be cancelled.')) return;
    const reason = window.prompt('Reason for discontinuing? (Optional)') || undefined;
    try {
      await medicationApiService.discontinueSchedule(familyId, scheduleId, reason);
      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to discontinue schedule');
    }
  };

  // View Schedule Audit History
  const handleViewHistory = async (schedule: MedicationSchedule) => {
    try {
      const res = await medicationApiService.getScheduleHistory(familyId, schedule.id);
      if (res.data) {
        setHistoryItems(res.data);
        setHistoryScheduleName(schedule.medicine_name);
        setShowHistoryModal(true);
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to load change history');
    }
  };

  // Update Dose Occurrence Status
  const handleUpdateDoseStatus = async (
    doseId: string,
    status: DoseOccurrenceStatus,
    note?: string
  ) => {
    setActionError(null);
    setSuccessMsg(null);
    try {
      await medicationApiService.updateDoseStatus(familyId, doseId, status, note);
      setSkippingDoseId(null);
      setSkipNote('');
      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to update dose status');
    }
  };

  // Separate active vs draft vs ended schedules
  const activeSchedules = schedules.filter((s) => s.status === 'active');
  const draftSchedules = schedules.filter((s) => s.status === 'draft_pending_confirmation');
  const inactiveSchedules = schedules.filter(
    (s) => s.status === 'paused' || s.status === 'discontinued' || s.status === 'completed'
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Action Bar */}
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
            <span>💊</span> Medication Management: <strong>{patient.full_name}</strong>
          </h2>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
            Daily dose adherence, verified schedules, and prescription-derived medicine reminders.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={handleOpenPrefill}
            style={{
              padding: '0.55rem 1rem',
              borderRadius: '8px',
              border: '1px solid #0f766e',
              backgroundColor: '#f0fdfa',
              color: '#0f766e',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <span>📋</span> Prefill from Prescription
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowAddModal(true);
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
            <span>+</span> Add Schedule Manually
          </button>
        </div>
      </div>

      {/* Notifications / Alerts */}
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

      {/* Draft Schedules Alert Banner (Explicit Confirmation Requirement) */}
      {draftSchedules.length > 0 && (
        <div
          style={{
            backgroundColor: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: '10px',
            padding: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '1.25rem' }}>⏳</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#92400e' }}>
                Prescription Schedules Awaiting Explicit Confirmation ({draftSchedules.length})
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#b45309' }}>
                These schedules were extracted from uploaded prescriptions. They require your explicit verification before dose alerts and reminders become active.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '0.75rem' }}>
            {draftSchedules.map((draft) => (
              <div
                key={draft.id}
                style={{
                  backgroundColor: '#ffffff',
                  padding: '1rem',
                  borderRadius: '8px',
                  border: '1px solid #fcd34d',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h4 style={{ margin: 0, fontSize: '1rem', color: '#1e293b' }}>
                      {draft.medicine_name} {draft.strength && <small style={{ color: '#64748b' }}>({draft.strength})</small>}
                    </h4>
                    <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '9999px', backgroundColor: '#fef3c7', color: '#92400e', fontWeight: 600 }}>
                      Draft
                    </span>
                  </div>
                  <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.825rem', color: '#475569' }}>
                    <strong>Dose:</strong> {draft.dosage_instruction} &bull; <strong>Freq:</strong> {draft.frequency}
                  </p>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.825rem', color: '#475569' }}>
                    <strong>Times:</strong> {draft.scheduled_times.join(', ')} (Asia/Kolkata)
                  </p>
                  {draft.prescriber_name && (
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.775rem', color: '#64748b' }}>
                      Prescribed by: {draft.prescriber_name}
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button
                    onClick={() => handleConfirmDraft(draft)}
                    style={{
                      flex: 1,
                      padding: '0.45rem',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: '#059669',
                      color: '#ffffff',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    ✓ Confirm & Activate
                  </button>
                  <button
                    onClick={() => handleDiscontinue(draft.id)}
                    style={{
                      padding: '0.45rem 0.75rem',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#f8fafc',
                      color: '#64748b',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    Discard
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 1: TODAY'S DOSE TRACKER */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '1.25rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🕒</span> Today&apos;s Dose Schedule & Adherence
            </h3>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              Date: <strong>{new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}</strong>
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem', borderRadius: '6px', backgroundColor: '#ecfdf5', color: '#065f46', fontWeight: 600 }}>
              Taken: {doses.filter((d) => d.status === 'taken').length}
            </span>
            <span style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem', borderRadius: '6px', backgroundColor: '#eff6ff', color: '#1e40af', fontWeight: 600 }}>
              Scheduled: {doses.filter((d) => d.status === 'scheduled').length}
            </span>
            <span style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem', borderRadius: '6px', backgroundColor: '#fef2f2', color: '#991b1b', fontWeight: 600 }}>
              Missed / Skipped: {doses.filter((d) => d.status === 'missed' || d.status === 'skipped').length}
            </span>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Loading today&apos;s doses...</div>
        ) : doses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', backgroundColor: '#f8fafc', borderRadius: '8px', color: '#64748b', fontSize: '0.9rem' }}>
            No doses scheduled for today. {activeSchedules.length === 0 ? 'Create an active medication schedule above.' : 'All scheduled times fall outside today.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {doses.map((dose) => {
              const isTaken = dose.status === 'taken';
              const isSkipped = dose.status === 'skipped';
              const isMissed = dose.status === 'missed';

              let statusBg = '#f8fafc';
              let statusBorder = '#e2e8f0';
              let statusLabel = 'Scheduled';
              let statusColor = '#475569';

              if (isTaken) {
                statusBg = '#f0fdf4';
                statusBorder = '#bbf7d0';
                statusLabel = 'Taken';
                statusColor = '#166534';
              } else if (isSkipped) {
                statusBg = '#fffbeb';
                statusBorder = '#fde68a';
                statusLabel = 'Skipped';
                statusColor = '#92400e';
              } else if (isMissed) {
                statusBg = '#fef2f2';
                statusBorder = '#fecaca';
                statusLabel = 'Missed';
                statusColor = '#991b1b';
              }

              return (
                <div
                  key={dose.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.85rem 1rem',
                    borderRadius: '8px',
                    backgroundColor: statusBg,
                    border: `1px solid ${statusBorder}`,
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div
                      style={{
                        padding: '0.4rem 0.75rem',
                        borderRadius: '8px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #cbd5e1',
                        fontWeight: 700,
                        fontSize: '1rem',
                        color: '#0f766e',
                        minWidth: '70px',
                        textAlign: 'center',
                      }}
                    >
                      {dose.scheduled_time}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <strong style={{ fontSize: '1rem', color: '#1e293b' }}>
                          {dose.schedule?.medicine_name || 'Medication Dose'}
                        </strong>
                        {dose.schedule?.strength && (
                          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>({dose.schedule.strength})</span>
                        )}
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            padding: '0.15rem 0.5rem',
                            borderRadius: '9999px',
                            backgroundColor: '#ffffff',
                            color: statusColor,
                            border: `1px solid ${statusBorder}`,
                          }}
                        >
                          {statusLabel}
                        </span>
                      </div>
                      <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.825rem', color: '#475569' }}>
                        {dose.dose_instruction}
                      </p>
                      {dose.acknowledged_at && (
                        <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                          Recorded at {new Date(dose.acknowledged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {dose.acknowledgement_note && ` &bull; Reason: "${dose.acknowledgement_note}"`}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions for Dose */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {dose.status === 'scheduled' ? (
                      <>
                        <button
                          onClick={() => handleUpdateDoseStatus(dose.id, 'taken')}
                          style={{
                            padding: '0.4rem 0.85rem',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: '#059669',
                            color: '#ffffff',
                            fontWeight: 600,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                          }}
                        >
                          ✓ Take Dose
                        </button>
                        <button
                          onClick={() => setSkippingDoseId(dose.id)}
                          style={{
                            padding: '0.4rem 0.85rem',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            backgroundColor: '#ffffff',
                            color: '#b45309',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                          }}
                        >
                          Skip...
                        </button>
                        <button
                          onClick={() => handleUpdateDoseStatus(dose.id, 'missed')}
                          style={{
                            padding: '0.4rem 0.75rem',
                            borderRadius: '6px',
                            border: '1px solid #fecaca',
                            backgroundColor: '#ffffff',
                            color: '#991b1b',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                          }}
                        >
                          Missed
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleUpdateDoseStatus(dose.id, 'scheduled')}
                        style={{
                          padding: '0.35rem 0.75rem',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          backgroundColor: '#ffffff',
                          color: '#475569',
                          fontSize: '0.775rem',
                          cursor: 'pointer',
                        }}
                      >
                        ↩ Undo / Revert
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Skip Dose Modal Prompt */}
        {skippingDoseId && (
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
            <div style={{ backgroundColor: '#ffffff', padding: '1.5rem', borderRadius: '10px', maxWidth: '400px', width: '90%' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#1e293b' }}>Skip This Dose</h4>
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: '#64748b' }}>
                Please provide an optional note for the medical log (e.g. &quot;feeling nauseous&quot;, &quot;fasting for blood test&quot;).
              </p>
              <textarea
                value={skipNote}
                onChange={(e) => setSkipNote(e.target.value)}
                placeholder="Reason for skipping (optional)..."
                rows={3}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button
                  onClick={() => setSkippingDoseId(null)}
                  style={{ padding: '0.45rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleUpdateDoseStatus(skippingDoseId, 'skipped', skipNote)}
                  style={{ padding: '0.45rem 1rem', borderRadius: '6px', border: 'none', backgroundColor: '#b45309', color: '#ffffff', fontWeight: 600, cursor: 'pointer' }}
                >
                  Confirm Skip
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: ACTIVE MEDICATION SCHEDULES */}
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
          <span>📋</span> Active Medication Schedules ({activeSchedules.length})
        </h3>

        {activeSchedules.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', backgroundColor: '#f8fafc', borderRadius: '8px', color: '#64748b', fontSize: '0.9rem' }}>
            No active schedules configured. Use &quot;Prefill from Prescription&quot; or &quot;Add Schedule Manually&quot; to create one.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
            {activeSchedules.map((schedule) => (
              <div
                key={schedule.id}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '1.15rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b' }}>
                      {schedule.medicine_name} {schedule.strength && <small style={{ color: '#64748b' }}>({schedule.strength})</small>}
                    </h4>
                    <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '9999px', backgroundColor: '#dcfce7', color: '#15803d', fontWeight: 600 }}>
                      Active
                    </span>
                  </div>

                  <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.85rem', color: '#334155' }}>
                    <strong>Instructions:</strong> {schedule.dosage_instruction}
                  </p>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#475569' }}>
                    <strong>Frequency:</strong> {schedule.frequency.replace('_', ' ')}
                  </p>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#475569' }}>
                    <strong>Times:</strong> {schedule.scheduled_times.join(', ')}
                  </p>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                    <strong>Duration:</strong> {schedule.start_date} {schedule.end_date ? `to ${schedule.end_date}` : '(Ongoing)'}
                  </p>
                  {schedule.prescriber_name && (
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                      <strong>Prescriber:</strong> {schedule.prescriber_name}
                    </p>
                  )}
                  {schedule.source_medicine_name && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#0f766e', backgroundColor: '#f0fdfa', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                      Derived from Prescription Document
                    </div>
                  )}
                </div>

                {/* Management controls */}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => {
                      setEditingScheduleId(schedule.id);
                      setFormMedicineName(schedule.medicine_name);
                      setFormStrength(schedule.strength || '');
                      setFormDosageInstruction(schedule.dosage_instruction);
                      setFormFrequency(schedule.frequency);
                      setFormScheduledTimes(schedule.scheduled_times.join(', '));
                      setFormStartDate(schedule.start_date);
                      setFormEndDate(schedule.end_date || '');
                      setFormPrescriberName(schedule.prescriber_name || '');
                      setFormInstructions(schedule.instructions || '');
                      setShowAddModal(true);
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
                    Edit
                  </button>
                  <button
                    onClick={() => handlePause(schedule.id)}
                    style={{
                      padding: '0.35rem 0.65rem',
                      borderRadius: '6px',
                      border: '1px solid #fde68a',
                      backgroundColor: '#fffbeb',
                      color: '#92400e',
                      fontSize: '0.775rem',
                      cursor: 'pointer',
                    }}
                  >
                    Pause
                  </button>
                  <button
                    onClick={() => handleDiscontinue(schedule.id)}
                    style={{
                      padding: '0.35rem 0.65rem',
                      borderRadius: '6px',
                      border: '1px solid #fecaca',
                      backgroundColor: '#fef2f2',
                      color: '#991b1b',
                      fontSize: '0.775rem',
                      cursor: 'pointer',
                    }}
                  >
                    Discontinue
                  </button>
                  <button
                    onClick={() => handleViewHistory(schedule)}
                    style={{
                      padding: '0.35rem 0.65rem',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#f8fafc',
                      color: '#64748b',
                      fontSize: '0.775rem',
                      cursor: 'pointer',
                      marginLeft: 'auto',
                    }}
                  >
                    Audit Log
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 3: INACTIVE / ENDED SCHEDULES */}
      {inactiveSchedules.length > 0 && (
        <details
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '1rem 1.25rem',
          }}
        >
          <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#64748b', fontSize: '0.95rem' }}>
            Ended / Paused / Discontinued Schedules ({inactiveSchedules.length})
          </summary>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
            {inactiveSchedules.map((s) => (
              <div key={s.id} style={{ padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <h5 style={{ margin: 0, fontSize: '0.95rem', color: '#64748b' }}>{s.medicine_name}</h5>
                  <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.45rem', borderRadius: '4px', backgroundColor: '#e2e8f0', color: '#475569' }}>
                    {s.status}
                  </span>
                </div>
                <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>{s.dosage_instruction}</p>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  {s.status === 'paused' && (
                    <button
                      onClick={() => handleResume(s.id)}
                      style={{ padding: '0.3rem 0.6rem', borderRadius: '4px', border: 'none', backgroundColor: '#059669', color: '#ffffff', fontSize: '0.75rem', cursor: 'pointer' }}
                    >
                      Resume Schedule
                    </button>
                  )}
                  <button
                    onClick={() => handleViewHistory(s)}
                    style={{ padding: '0.3rem 0.6rem', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#64748b', fontSize: '0.75rem', cursor: 'pointer' }}
                  >
                    View History
                  </button>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* MODAL: PREFILL FROM PRESCRIPTION */}
      {showPrefillModal && (
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
          <div style={{ backgroundColor: '#ffffff', padding: '1.75rem', borderRadius: '12px', maxWidth: '640px', width: '92%', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f766e' }}>
                📋 Prefill from Uploaded Prescription
              </h3>
              <button onClick={() => setShowPrefillModal(false)} style={{ border: 'none', background: 'transparent', fontSize: '1.25rem', cursor: 'pointer' }}>
                &times;
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 0 }}>
              Select a prescription document to extract candidate medicines. You will review and confirm all details before activation.
            </p>

            {patientDocs.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '8px', color: '#64748b' }}>
                No prescription documents found for this patient. Please upload a prescription under the &quot;Medical Records&quot; tab first.
              </div>
            ) : (
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Select Prescription Document:
                </label>
                <select
                  value={selectedDocId}
                  onChange={(e) => {
                    setSelectedDocId(e.target.value);
                    fetchCandidates(e.target.value);
                  }}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '1.25rem' }}
                >
                  {patientDocs.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.title} ({doc.document_date || 'No date'}) - {doc.review_status}
                    </option>
                  ))}
                </select>

                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', color: '#1e293b' }}>
                  Extracted Medicine Candidates:
                </h4>

                {loadingCandidates ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>Extracting medicine fields...</div>
                ) : prefillCandidates.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', backgroundColor: '#f8fafc', borderRadius: '8px', color: '#64748b', fontSize: '0.85rem' }}>
                    No structured medicines detected in this document. Ensure OCR and human review are completed for the document.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {prefillCandidates.map((cand, idx) => (
                      <div
                        key={idx}
                        style={{
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          padding: '0.85rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          backgroundColor: '#fafafa',
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: '0.95rem', color: '#1e293b' }}>{cand.medicineName}</strong>
                          {cand.strength && <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: '0.35rem' }}>({cand.strength})</span>}
                          <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.2rem' }}>
                            {cand.dosageInstruction} &bull; Suggested: {cand.suggestedTimes.join(', ')}
                          </div>
                        </div>

                        <button
                          onClick={() => handleSelectCandidate(cand)}
                          style={{
                            padding: '0.45rem 0.85rem',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: '#0f766e',
                            color: '#ffffff',
                            fontWeight: 600,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                          }}
                        >
                          Use in Schedule &rarr;
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT SCHEDULE */}
      {showAddModal && (
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
          <div style={{ backgroundColor: '#ffffff', padding: '1.75rem', borderRadius: '12px', maxWidth: '580px', width: '92%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f766e' }}>
                {editingScheduleId ? 'Edit Medication Schedule' : 'New Medication Schedule'}
              </h3>
              <button onClick={() => setShowAddModal(false)} style={{ border: 'none', background: 'transparent', fontSize: '1.25rem', cursor: 'pointer' }}>
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                  Medicine Name *
                </label>
                <input
                  type="text"
                  required
                  value={formMedicineName}
                  onChange={(e) => setFormMedicineName(e.target.value)}
                  placeholder="e.g. Metformin, Amlodipine, Paracetamol"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.875rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                    Strength / Unit
                  </label>
                  <input
                    type="text"
                    value={formStrength}
                    onChange={(e) => setFormStrength(e.target.value)}
                    placeholder="e.g. 500mg, 5ml"
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.875rem', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                    Frequency *
                  </label>
                  <select
                    value={formFrequency}
                    onChange={(e) => {
                      setFormFrequency(e.target.value);
                      if (e.target.value === 'once_daily') setFormScheduledTimes('08:00');
                      else if (e.target.value === 'twice_daily') setFormScheduledTimes('08:00, 20:00');
                      else if (e.target.value === 'thrice_daily') setFormScheduledTimes('08:00, 14:00, 20:00');
                      else if (e.target.value === 'every_12_hours') setFormScheduledTimes('08:00, 20:00');
                    }}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.875rem', boxSizing: 'border-box' }}
                  >
                    <option value="once_daily">Once Daily</option>
                    <option value="twice_daily">Twice Daily</option>
                    <option value="thrice_daily">Thrice Daily</option>
                    <option value="every_12_hours">Every 12 Hours</option>
                    <option value="as_needed">As Needed (PRN)</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                  Scheduled Times (Comma-separated 24h format, Asia/Kolkata) *
                </label>
                <input
                  type="text"
                  required
                  value={formScheduledTimes}
                  onChange={(e) => setFormScheduledTimes(e.target.value)}
                  placeholder="08:00, 20:00"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.875rem', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                  Dosage Instruction *
                </label>
                <input
                  type="text"
                  required
                  value={formDosageInstruction}
                  onChange={(e) => setFormDosageInstruction(e.target.value)}
                  placeholder="e.g. Take 1 tablet after breakfast with water"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.875rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.875rem', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                    End Date (Leave blank if ongoing)
                  </label>
                  <input
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.875rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                  Prescribing Doctor / Hospital
                </label>
                <input
                  type="text"
                  value={formPrescriberName}
                  onChange={(e) => setFormPrescriberName(e.target.value)}
                  placeholder="e.g. Dr. A. Sharma"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.875rem', boxSizing: 'border-box' }}
                />
              </div>

              {!editingScheduleId && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
                  <input
                    type="checkbox"
                    id="saveAsDraft"
                    checked={formSaveAsDraft}
                    onChange={(e) => setFormSaveAsDraft(e.target.checked)}
                  />
                  <label htmlFor="saveAsDraft" style={{ fontSize: '0.825rem', color: '#475569', cursor: 'pointer' }}>
                    Save as <strong>Draft Pending Confirmation</strong> (Requires explicit confirmation before doses start)
                  </label>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '0.5rem 1.25rem', borderRadius: '6px', border: 'none', backgroundColor: '#0f766e', color: '#ffffff', fontWeight: 600, cursor: 'pointer' }}
                >
                  {editingScheduleId ? 'Update Schedule' : 'Save Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: AUDIT HISTORY */}
      {showHistoryModal && (
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
          <div style={{ backgroundColor: '#ffffff', padding: '1.5rem', borderRadius: '12px', maxWidth: '540px', width: '90%', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b' }}>
                Audit History: {historyScheduleName}
              </h3>
              <button onClick={() => setShowHistoryModal(false)} style={{ border: 'none', background: 'transparent', fontSize: '1.25rem', cursor: 'pointer' }}>
                &times;
              </button>
            </div>

            {historyItems.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No audit history records available.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {historyItems.map((item) => (
                  <div key={item.id} style={{ padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, color: '#0f766e' }}>
                      <span>Action: {item.action.toUpperCase()}</span>
                      <span style={{ color: '#64748b' }}>{new Date(item.created_at).toLocaleString()}</span>
                    </div>
                    <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.825rem', color: '#334155' }}>{item.change_summary}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
