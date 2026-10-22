/**
 * frontend/src/features/emergency/EmergencyDashboard.tsx
 *
 * Phase 5: Complete SOS Emergency Response Demo Mode & Fictional Hospital Handoff.
 *
 * Features:
 * - Persistent DEMO MODE warnings across all screens
 * - One-click interactive SOS Trigger
 * - Real-time Incident Status & Progress Stepper
 * - Simulated Family Alert dispatch & interactive acknowledgement buttons
 * - Caregiver Escalation card with take-responsibility controls
 * - Fictional Hospital Receiving Desk modal with synthetic patient summary packet
 * - Chronological Audit Event Timeline
 * - Demo Control Panel for manual stage advancement and safe scenario reset
 */

import React, { useState, useEffect, useCallback } from 'react';
import { PatientProfile } from '../../types/auth';
import {
  EmergencyIncident,
  EmergencyContact,
  EmergencyContactAttempt,
  EmergencyIncidentEvent,
  EmergencyEscalationPolicy,
  HospitalHandoff,
} from '../../types/sos';
import { sosApiService } from '../../services/sosService';
import { liveTestApiService } from '../../services/liveTestService';
import { LiveTestAuditLog, LiveTestDispatchResult } from '../../types/liveTest';
import { LiveTestRecipientManager } from './LiveTestRecipientManager';
import { LiveTestPreflightModal } from './LiveTestPreflightModal';

interface EmergencyDashboardProps {
  familyId: string;
  patient: PatientProfile;
  userRole?: string;
}

export const EmergencyDashboard: React.FC<EmergencyDashboardProps> = ({
  familyId,
  patient,
  userRole: _userRole = 'adult',
}) => {
  const [activeIncident, setActiveIncident] = useState<EmergencyIncident | null>(null);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [attempts, setAttempts] = useState<EmergencyContactAttempt[]>([]);
  const [events, setEvents] = useState<EmergencyIncidentEvent[]>([]);
  const [policy, setPolicy] = useState<EmergencyEscalationPolicy | null>(null);
  const [handoff, setHandoff] = useState<HospitalHandoff | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [triggering, setTriggering] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals & Panels
  const [showHospitalModal, setShowHospitalModal] = useState<boolean>(false);
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [hospitalStaff, setHospitalStaff] = useState<string>('Nurse Priya Desai (Emergency Desk, Simulated)');
  const [hospitalNotes, setHospitalNotes] = useState<string>(
    'Patient emergency summary packet received. Priority trauma/triage bed assigned.'
  );

  // Phase 6: Live Test Mode State
  const [liveTestLogs, setLiveTestLogs] = useState<LiveTestAuditLog[]>([]);
  const [showRecipientModal, setShowRecipientModal] = useState<boolean>(false);
  const [showPreflightModal, setShowPreflightModal] = useState<boolean>(false);

  // Time remaining countdown in seconds
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setActionError(null);

      // 1. Fetch active incident
      const activeRes = await sosApiService.getActiveIncident(familyId, patient.id);
      if (activeRes.data?.incident) {
        setActiveIncident(activeRes.data.incident);
        // Fetch full incident details (attempts, events, handoff)
        const detRes = await sosApiService.getIncidentDetails(familyId, activeRes.data.incident.id);
        if (detRes.data) {
          setAttempts(detRes.data.attempts || []);
          setEvents(detRes.data.events || []);
          setPolicy(detRes.data.policy || null);
          setHandoff(detRes.data.handoff || null);
        }

        // Fetch live test audit logs for this incident
        try {
          const logsRes = await liveTestApiService.listAuditLogs(familyId, activeRes.data.incident.id);
          if (logsRes.data?.logs) {
            setLiveTestLogs(logsRes.data.logs);
          }
        } catch {
          // Ignore log fetch error in demo mode
        }
      } else {
        setActiveIncident(null);
        setAttempts([]);
        setEvents([]);
        setHandoff(null);
        setLiveTestLogs([]);

        // Fetch contacts & policy
        const [cRes, pRes] = await Promise.all([
          sosApiService.listContacts(familyId, patient.id),
          sosApiService.getPolicy(familyId, patient.id),
        ]);
        setContacts(cRes.data?.contacts || []);
        setPolicy(pRes.data?.policy || null);
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to load emergency data');
    } finally {
      setLoading(false);
    }
  }, [familyId, patient.id]);

  useEffect(() => {
    loadData();
    // Poll every 3 seconds for demo progress updates
    const interval = window.setInterval(loadData, 3000);
    return () => window.clearInterval(interval);
  }, [loadData]);

  // Compute countdown timer
  useEffect(() => {
    if (!activeIncident?.response_deadline) {
      setRemainingSeconds(null);
      return;
    }

    const updateTimer = () => {
      const deadline = new Date(activeIncident.response_deadline!).getTime();
      const diff = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setRemainingSeconds(diff);
    };

    updateTimer();
    const timerInterval = window.setInterval(updateTimer, 1000);
    return () => window.clearInterval(timerInterval);
  }, [activeIncident?.response_deadline]);

  // SOS Trigger
  const handleTriggerSos = async () => {
    try {
      setTriggering(true);
      setActionError(null);
      const res = await sosApiService.triggerSos(familyId, {
        patientProfileId: patient.id,
        severity: 'CRITICAL',
        locationNote: 'Home Residence (Coordinates unavailable in demo)',
      });

      if (res.data?.incident) {
        setActiveIncident(res.data.incident);
        setAttempts(res.data.attempts);
        setSuccessMsg(`Emergency SOS activated for ${patient.full_name}! (Incident ${res.data.incident.incident_number})`);
        await loadData();
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to activate SOS');
    } finally {
      setTriggering(false);
    }
  };

  // Contact acknowledgement
  const handleAcknowledgeContact = async (attemptId: string, action: string) => {
    if (!activeIncident) return;
    try {
      setActionError(null);
      await sosApiService.acknowledgeContactAttempt(familyId, activeIncident.id, attemptId, action);
      setSuccessMsg(`Simulated response registered: &ldquo;${action}&rdquo;`);
      await loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to submit acknowledgement');
    }
  };

  // Caregiver acknowledgement
  const handleAcknowledgeCaregiver = async (attemptId: string, action: string) => {
    if (!activeIncident) return;
    try {
      setActionError(null);
      await sosApiService.acknowledgeCaregiver(familyId, activeIncident.id, attemptId, action);
      setSuccessMsg(`Caregiver response registered: &ldquo;${action}&rdquo;`);
      await loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to submit caregiver acknowledgement');
    }
  };

  // Hospital Desk acknowledgement
  const handleAcknowledgeHospital = async () => {
    if (!activeIncident) return;
    try {
      setActionError(null);
      await sosApiService.acknowledgeHospitalDesk(familyId, activeIncident.id, hospitalStaff, hospitalNotes);
      setSuccessMsg('Simulated Hospital Receiving Desk acknowledged packet receipt!');
      setShowHospitalModal(false);
      await loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to acknowledge hospital receipt');
    }
  };

  // Advance timeout manually (Demo control)
  const handleAdvanceTimeout = async () => {
    if (!activeIncident) return;
    try {
      setActionError(null);
      const res = await sosApiService.advanceTimeout(familyId, activeIncident.id);
      setSuccessMsg(`Demo Timeout Advanced: Stage is now ${res.data?.advancedStage}`);
      await loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to advance demo timeout');
    }
  };

  // Resolve incident
  const handleResolveIncident = async () => {
    if (!activeIncident) return;
    try {
      setActionError(null);
      await sosApiService.resolveIncident(familyId, activeIncident.id, 'Incident marked safe and resolved by operator');
      setSuccessMsg(`Incident ${activeIncident.incident_number} successfully resolved.`);
      await loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to resolve incident');
    }
  };

  // Cancel incident
  const handleCancelIncident = async () => {
    if (!activeIncident) return;
    try {
      setActionError(null);
      await sosApiService.cancelIncident(familyId, activeIncident.id, cancelReason || 'False alarm / test');
      setSuccessMsg(`Incident ${activeIncident.incident_number} cancelled.`);
      setShowCancelModal(false);
      setCancelReason('');
      await loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to cancel incident');
    }
  };

  // Reset Demo Scenario
  const handleResetDemo = async () => {
    try {
      setActionError(null);
      await sosApiService.resetDemoScenario(familyId, patient.id);
      setSuccessMsg('Demo scenario reset successfully. Clean initial state restored.');
      await loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to reset demo scenario');
    }
  };

  // Phase 6: Live Test Handlers
  const handleLiveTestDispatched = (result: LiveTestDispatchResult) => {
    setSuccessMsg(
      `<strong>LIVE TEST DISPATCHED:</strong> Dispatched ${result.dispatchedCount} real alert(s) via ${result.providerName.toUpperCase()}. Check recipient phone(s). Remaining escalation is simulated.`
    );
    loadData();
  };

  const handleAcknowledgeLiveTest = async (auditLogId: string) => {
    try {
      setActionError(null);
      await liveTestApiService.recordHumanAcknowledgement(
        familyId,
        auditLogId,
        'Team member confirmed receipt on physical device.'
      );
      setSuccessMsg('Live test alert acknowledged by recipient.');
      await loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to acknowledge live test');
    }
  };

  // Status helper badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'AWAITING_FAMILY_RESPONSE':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 animate-pulse">Awaiting Family Response</span>;
      case 'FAMILY_RESPONDED':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">Family Responded</span>;
      case 'AWAITING_CAREGIVER_RESPONSE':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800 animate-pulse">Caregiver Escalated</span>;
      case 'CAREGIVER_RESPONDED':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">Caregiver Responded</span>;
      case 'HOSPITAL_HANDOFF_SIMULATED':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">Hospital Handoff Ready (Demo)</span>;
      case 'RESOLVED':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">Resolved</span>;
      case 'CANCELLED':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-500">Cancelled</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-700">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Mode Banner & Phase 6 Live Test Mode Controls */}
      <div
        className={`px-4 py-3 rounded-lg text-white shadow-sm flex flex-wrap items-center justify-between gap-3 ${
          liveTestLogs.length > 0
            ? 'bg-gradient-to-r from-rose-700 via-red-600 to-amber-700 border-2 border-red-300'
            : 'bg-gradient-to-r from-amber-500 via-red-500 to-amber-500'
        }`}
      >
        <div className="flex items-center space-x-2">
          <span className="text-xl">{liveTestLogs.length > 0 ? '📡' : '⚠️'}</span>
          <div>
            <p className="font-bold text-sm tracking-wide uppercase">
              {liveTestLogs.length > 0
                ? 'LIVE TEST MODE — REAL TEST COMMUNICATION TO APPROVED RECIPIENTS; REMAINING ESCALATION IS SIMULATED.'
                : 'DEMO MODE — ALL EMERGENCY CONTACTS AND HOSPITAL EVENTS ARE SIMULATED.'}
            </p>
            <p className="text-xs text-amber-100">
              {liveTestLogs.length > 0
                ? 'Carrier alerts delivered to verified team recipients only. Zero real emergency services (112) or actual hospitals contacted.'
                : 'No actual calls, SMS, 112 dialing, or real hospitals will be contacted. Fictional patient data only.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRecipientModal(true)}
            className="text-xs font-semibold bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded transition shadow-sm border border-white/30"
          >
            👥 Manage Test Recipients
          </button>
          {activeIncident && (
            <button
              onClick={() => setShowPreflightModal(true)}
              className="text-xs font-bold bg-white text-red-700 px-3 py-1.5 rounded hover:bg-rose-50 transition shadow-sm animate-pulse"
            >
              ⚡ Send Live Test Alert
            </button>
          )}
          <button
            onClick={handleResetDemo}
            className="text-xs font-semibold bg-white text-red-600 px-3 py-1.5 rounded hover:bg-amber-50 transition shadow-sm"
          >
            Reset Demo
          </button>
        </div>
      </div>

      {/* Messages */}
      {actionError && (
        <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded text-sm text-red-700 flex justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="font-bold">&times;</button>
        </div>
      )}
      {successMsg && (
        <div className="bg-emerald-50 border-l-4 border-emerald-500 p-3 rounded text-sm text-emerald-700 flex justify-between">
          <span dangerouslySetInnerHTML={{ __html: successMsg }} />
          <button onClick={() => setSuccessMsg(null)} className="font-bold">&times;</button>
        </div>
      )}

      {/* 2. Main SOS Trigger Card (when no active incident) */}
      {!activeIncident && (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8 text-center">
          <div className="max-w-md mx-auto space-y-4">
            <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto text-4xl shadow-inner animate-pulse">
              🚨
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Emergency Assistance (SOS)</h2>
            <p className="text-sm text-gray-600">
              Trigger a simulated emergency response for <strong>{patient.full_name}</strong> ({patient.health_id}).
              Simulates high-priority family voice/SMS alerts, caregiver escalation, and fictional hospital receiving desk handoff.
            </p>

            <button
              onClick={handleTriggerSos}
              disabled={triggering || loading}
              className="w-full py-4 px-6 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white font-extrabold text-lg rounded-xl shadow-lg transform active:scale-95 transition flex items-center justify-center space-x-2"
            >
              <span>{triggering ? 'Activating Simulation...' : 'ACTIVATE EMERGENCY SOS (DEMO)'}</span>
            </button>

            <div className="text-xs text-gray-400">
              Simulated response window: {policy?.family_response_timeout_seconds || 15}s family &bull; {policy?.caregiver_response_timeout_seconds || 15}s caregiver
            </div>
          </div>
        </div>
      )}

      {/* 3. Active Incident View */}
      {activeIncident && (
        <div className="space-y-6">
          {/* Active Incident Header */}
          <div className="bg-white rounded-xl shadow-md border-2 border-red-500 overflow-hidden">
            <div className="bg-red-600 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <span className="text-3xl animate-bounce">🚨</span>
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-xl font-bold tracking-tight">ACTIVE INCIDENT: {activeIncident.incident_number}</h2>
                    <span className="bg-red-800 text-red-100 text-xs px-2 py-0.5 rounded font-mono uppercase">
                      {activeIncident.severity}
                    </span>
                  </div>
                  <p className="text-xs text-red-100">
                    Patient: {patient.full_name} ({patient.health_id}) &bull; Activated: {new Date(activeIncident.activated_at).toLocaleTimeString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                {getStatusBadge(activeIncident.status)}
                {remainingSeconds !== null && (
                  <div className="bg-black/40 px-3 py-1 rounded text-right">
                    <span className="text-xs text-gray-300 block uppercase">Timeout in</span>
                    <span className="text-lg font-mono font-bold text-amber-300">{remainingSeconds}s</span>
                  </div>
                )}
              </div>
            </div>

            {/* Stage Progress Stepper */}
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
                <div className={`flex items-center space-x-1 ${activeIncident.current_stage === 'FAMILY_CONTACT' ? 'text-red-600 font-bold' : ''}`}>
                  <span>1. Family Alerts</span>
                  {activeIncident.current_stage !== 'FAMILY_CONTACT' && <span>✓</span>}
                </div>
                <span>&rarr;</span>
                <div className={`flex items-center space-x-1 ${activeIncident.current_stage === 'CAREGIVER_ESCALATION' ? 'text-red-600 font-bold' : ''}`}>
                  <span>2. Caregiver Escalation</span>
                  {activeIncident.current_stage === 'HOSPITAL_HANDOFF' && <span>✓</span>}
                </div>
                <span>&rarr;</span>
                <div className={`flex items-center space-x-1 ${activeIncident.current_stage === 'HOSPITAL_HANDOFF' ? 'text-purple-600 font-bold' : ''}`}>
                  <span>3. Hospital Handoff</span>
                </div>
                <span>&rarr;</span>
                <div className={`flex items-center space-x-1 ${activeIncident.status === 'RESOLVED' ? 'text-emerald-600 font-bold' : ''}`}>
                  <span>4. Resolution</span>
                </div>
              </div>
            </div>

            {/* Content Body: Contacts, Escalation, Actions */}
            <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Cols: Contacts & Escalation Cards */}
              <div className="lg:col-span-2 space-y-6">
                {/* Phase 6: Live Test Provider Dispatches Card */}
                {liveTestLogs.length > 0 && (
                  <div className="border-2 border-rose-300 rounded-lg p-4 bg-rose-50/70 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-xl">📡</span>
                        <div>
                          <h3 className="font-bold text-rose-950 text-sm">
                            Controlled Live Test Provider Dispatches ({liveTestLogs.length})
                          </h3>
                          <p className="text-xs text-rose-700">
                            Real communications sent to verified team members. Caregiver escalation remains simulated.
                          </p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 text-xs font-bold rounded bg-rose-200 text-rose-900 font-mono">
                        PROVENANCE: LIVE_PROVIDER
                      </span>
                    </div>

                    <div className="space-y-2">
                      {liveTestLogs.map((log) => (
                        <div
                          key={log.id}
                          className="bg-white border border-rose-200 rounded-lg p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs shadow-xs"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-gray-900">{log.destination_phone_masked}</span>
                              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded font-semibold text-[11px]">
                                {log.channel}
                              </span>
                              <span className="px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded font-mono text-[11px] uppercase">
                                via {log.provider_name}
                              </span>
                            </div>
                            <p className="text-gray-500 font-mono text-[11px] truncate max-w-md">
                              {log.message_payload_preview}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-gray-400">
                              <span>Status: <strong>{log.dispatch_status}</strong></span>
                              <span>•</span>
                              <span>Sent: {new Date(log.created_at).toLocaleTimeString()}</span>
                              {log.delivery_evidence_at && (
                                <>
                                  <span>•</span>
                                  <span className="text-emerald-700 font-semibold">
                                    Carrier Delivered ({new Date(log.delivery_evidence_at).toLocaleTimeString()})
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {log.human_acknowledged ? (
                              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-lg border border-emerald-300">
                                ✓ Human Confirmed
                              </span>
                            ) : (
                              <button
                                onClick={() => handleAcknowledgeLiveTest(log.id)}
                                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow-sm transition"
                              >
                                Confirm Human Receipt
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Stage 1: Family Contacts */}
                <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-gray-900 text-sm flex items-center space-x-2">
                      <span>👨‍👩‍👧</span>
                      <span>Stage 1: Simulated Family Notifications</span>
                    </h3>
                    <span className="text-xs text-gray-400">Voice/SMS Broadcast (Simulated)</span>
                  </div>

                  <div className="space-y-3">
                    {attempts.filter((a) => a.stage === 'FAMILY_CONTACT').map((attempt) => (
                      <div key={attempt.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-gray-800 text-sm">{attempt.contact_name}</span>
                            <span className="text-xs text-gray-500 font-mono">({attempt.contact_role})</span>
                          </div>
                          <p className="text-xs text-gray-400">
                            Status: <strong className="text-gray-700">{attempt.status}</strong>
                            {attempt.acknowledgement_action && (
                              <span className="ml-2 text-emerald-600">&ldquo;{attempt.acknowledgement_action}&rdquo;</span>
                            )}
                          </p>
                        </div>

                        {/* Interactive Acknowledgement simulation controls */}
                        {attempt.status === 'AWAITING_RESPONSE' && (
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              onClick={() => handleAcknowledgeContact(attempt.id, 'I am responding')}
                              className="px-2.5 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 font-medium"
                            >
                              I am Responding
                            </button>
                            <button
                              onClick={() => handleAcknowledgeContact(attempt.id, 'I have contacted the patient')}
                              className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
                            >
                              Contacted Patient
                            </button>
                            <button
                              onClick={() => handleAcknowledgeContact(attempt.id, 'I cannot respond')}
                              className="px-2.5 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium"
                            >
                              Cannot Respond
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Stage 2: Caregiver Escalation Card */}
                {(activeIncident.current_stage === 'CAREGIVER_ESCALATION' ||
                  activeIncident.current_stage === 'HOSPITAL_HANDOFF' ||
                  attempts.some((a) => a.stage === 'CAREGIVER_ESCALATION')) && (
                  <div className="border border-orange-200 rounded-lg p-4 bg-orange-50/50 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-orange-900 text-sm flex items-center space-x-2">
                        <span>🩺</span>
                        <span>Stage 2: Designated Caregiver Escalation</span>
                      </h3>
                      <span className="text-xs text-orange-700 font-semibold">Caregiver Alert</span>
                    </div>

                    <div className="space-y-3">
                      {attempts.filter((a) => a.stage === 'CAREGIVER_ESCALATION').map((attempt) => (
                        <div key={attempt.id} className="p-3 bg-white rounded-lg border border-orange-200 flex flex-col md:flex-row md:items-center justify-between gap-2">
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-semibold text-gray-800 text-sm">{attempt.contact_name}</span>
                              <span className="text-xs text-orange-600 font-mono">({attempt.contact_role})</span>
                            </div>
                            <p className="text-xs text-gray-400">
                              Status: <strong className="text-gray-700">{attempt.status}</strong>
                              {attempt.acknowledgement_action && (
                                <span className="ml-2 text-emerald-600">&ldquo;{attempt.acknowledgement_action}&rdquo;</span>
                              )}
                            </p>
                          </div>

                          {attempt.status === 'AWAITING_RESPONSE' && (
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                onClick={() => handleAcknowledgeCaregiver(attempt.id, 'I am taking responsibility')}
                                className="px-2.5 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 font-medium"
                              >
                                Take Responsibility
                              </button>
                              <button
                                onClick={() => handleAcknowledgeCaregiver(attempt.id, 'Assistance is being arranged')}
                                className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
                              >
                                Arrange Assistance
                              </button>
                              <button
                                onClick={() => handleAcknowledgeCaregiver(attempt.id, 'I cannot respond')}
                                className="px-2.5 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium"
                              >
                                Cannot Respond
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Stage 3: Hospital Handoff Card */}
                {handoff && (
                  <div className="border border-purple-300 rounded-lg p-4 bg-purple-50/70 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-xl">🏥</span>
                        <div>
                          <h3 className="font-bold text-purple-900 text-sm">Stage 3: Simulated Hospital Receiving Desk</h3>
                          <p className="text-xs text-purple-700">{handoff.hospital_name} &bull; {handoff.department}</p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 text-xs font-semibold rounded bg-purple-200 text-purple-800">
                        {handoff.status}
                      </span>
                    </div>

                    <p className="text-xs text-gray-600 mb-3">
                      Emergency Health Summary packet prepared. Emergency department triage bed pre-allocated in simulation.
                    </p>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setShowHospitalModal(true)}
                        className="px-4 py-2 bg-purple-700 text-white text-xs font-bold rounded-lg hover:bg-purple-800 transition flex items-center space-x-1 shadow"
                      >
                        <span>Open Hospital Receiving Desk Dashboard</span>
                        <span>&rarr;</span>
                      </button>
                      {handoff.acknowledged_at && (
                        <span className="text-xs text-emerald-700 font-semibold">
                          ✓ Acknowledged by {handoff.receiving_staff_name}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Col: Demo Control Panel & Incident Actions */}
              <div className="space-y-6">
                {/* Demo Control Panel */}
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 shadow-sm">
                  <h3 className="font-bold text-gray-900 text-sm mb-2 flex items-center space-x-1.5">
                    <span>🎛️</span>
                    <span>Demo Control Panel</span>
                  </h3>
                  <p className="text-xs text-gray-500 mb-3">
                    Fast-forward demo intervals or simulate responses for presentations.
                  </p>

                  <div className="space-y-2">
                    <button
                      onClick={handleAdvanceTimeout}
                      className="w-full text-left px-3 py-2 text-xs bg-white hover:bg-gray-100 border border-gray-300 rounded text-gray-800 font-medium flex items-center justify-between"
                    >
                      <span>Advance Demo Timeout &rarr;</span>
                      <span className="text-gray-400 font-mono">Skip wait</span>
                    </button>

                    {handoff && (
                      <button
                        onClick={() => setShowHospitalModal(true)}
                        className="w-full text-left px-3 py-2 text-xs bg-purple-50 hover:bg-purple-100 border border-purple-300 rounded text-purple-800 font-medium flex items-center justify-between"
                      >
                        <span>View Hospital Packet</span>
                        <span>🏥</span>
                      </button>
                    )}

                    <button
                      onClick={handleResolveIncident}
                      className="w-full text-left px-3 py-2 text-xs bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded text-emerald-800 font-medium flex items-center justify-between"
                    >
                      <span>Mark Incident Resolved</span>
                      <span>✓</span>
                    </button>

                    <button
                      onClick={() => setShowCancelModal(true)}
                      className="w-full text-left px-3 py-2 text-xs bg-red-50 hover:bg-red-100 border border-red-300 rounded text-red-800 font-medium flex items-center justify-between"
                    >
                      <span>Cancel Emergency Incident</span>
                      <span>&times;</span>
                    </button>

                    <hr className="my-2 border-gray-200" />

                    <button
                      onClick={handleResetDemo}
                      className="w-full text-left px-3 py-2 text-xs bg-white hover:bg-red-50 border border-gray-200 text-red-600 rounded font-medium flex items-center justify-between"
                    >
                      <span>Reset Demo Scenario</span>
                      <span>🔄</span>
                    </button>
                  </div>
                </div>

                {/* Patient Summary Preview Card */}
                <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Patient Emergency Snapshot</h4>
                  <div className="text-xs space-y-1 text-gray-600">
                    <div><strong>Name:</strong> {patient.full_name}</div>
                    <div><strong>Health ID:</strong> {patient.health_id}</div>
                    <div><strong>Category:</strong> {patient.category}</div>
                    <div><strong>Location:</strong> {activeIncident.location_note}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Live Event Timeline */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900 flex items-center space-x-2">
                <span>⏱️</span>
                <span>Incident Event Timeline (Audit Trail)</span>
              </h3>
              <span className="text-xs font-mono text-gray-400">{events.length} events logged</span>
            </div>

            {events.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No events recorded yet.</p>
            ) : (
              <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-gray-200">
                {events.map((evt) => (
                  <div key={evt.id} className="relative flex items-start space-x-3 pl-2">
                    <div className="w-3.5 h-3.5 rounded-full bg-red-500 ring-4 ring-white shrink-0 mt-1" />
                    <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-gray-900">{evt.title}</span>
                        <div className="flex items-center space-x-2">
                          {evt.simulation_provenance === 'LIVE_PROVIDER' && (
                            <span className="bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded text-[10px] border border-emerald-300">
                              REAL PROVIDER DISPATCH
                            </span>
                          )}
                          {evt.simulation_provenance === 'HUMAN_ACKNOWLEDGEMENT' && (
                            <span className="bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded text-[10px] border border-blue-300">
                              HUMAN ACKNOWLEDGEMENT
                            </span>
                          )}
                          {evt.simulation_provenance !== 'LIVE_PROVIDER' && evt.simulation_provenance !== 'HUMAN_ACKNOWLEDGEMENT' && (
                            <span className="bg-amber-100 text-amber-800 font-semibold px-1.5 py-0.5 rounded text-[10px]">
                              SIMULATED
                            </span>
                          )}
                          <span className="text-gray-400 font-mono">
                            {new Date(evt.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                      <p className="text-gray-600">{evt.description}</p>
                      <div className="mt-1 flex items-center space-x-2 text-[10px] text-gray-400 uppercase">
                        <span>Actor: {evt.actor_type}</span>
                        <span>&bull;</span>
                        <span>Stage: {evt.stage}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. Pre-Incident Configuration (Contacts & Policy view when idle) */}
      {!activeIncident && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Contacts Card */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
            <h3 className="font-bold text-gray-900 text-sm mb-3 flex items-center space-x-2">
              <span>👥</span>
              <span>Emergency Contacts (Simulated)</span>
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Fictional phone numbers seeded for demonstration. Safe from real dialing.
            </p>

            <div className="space-y-2">
              {contacts.map((c) => (
                <div key={c.id} className="p-3 bg-gray-50 rounded border border-gray-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-gray-800">{c.name}</span>
                    <span className="text-gray-500 ml-1.5">({c.relationship})</span>
                    <p className="text-gray-400 font-mono">{c.phone_number}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-200 text-gray-700 uppercase">
                    {c.role}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Policy Card */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
            <h3 className="font-bold text-gray-900 text-sm mb-3 flex items-center space-x-2">
              <span>⚙️</span>
              <span>Escalation Policy Configuration (Demo Settings)</span>
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Configured short demonstration intervals for rapid review.
            </p>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between p-2.5 bg-gray-50 rounded border border-gray-200">
                <span className="text-gray-600">Family Response Timeout:</span>
                <strong className="text-gray-900">{policy?.family_response_timeout_seconds || 15} seconds</strong>
              </div>
              <div className="flex justify-between p-2.5 bg-gray-50 rounded border border-gray-200">
                <span className="text-gray-600">Caregiver Response Timeout:</span>
                <strong className="text-gray-900">{policy?.caregiver_response_timeout_seconds || 15} seconds</strong>
              </div>
              <div className="flex justify-between p-2.5 bg-gray-50 rounded border border-gray-200">
                <span className="text-gray-600">Fictional Receiving Hospital:</span>
                <strong className="text-gray-900">{policy?.hospital_name || 'Apollo Indraprastha (Demo)'}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Hospital Receiving Desk Modal */}
      {showHospitalModal && handoff && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border-2 border-purple-500">
            {/* Modal Header */}
            <div className="bg-purple-800 text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold flex items-center space-x-2">
                  <span>🏥</span>
                  <span>{handoff.hospital_name}</span>
                </h3>
                <p className="text-xs text-purple-200">{handoff.department} &bull; Triage Incident Handoff</p>
              </div>
              <button
                onClick={() => setShowHospitalModal(false)}
                className="text-white hover:text-purple-200 font-bold text-xl"
              >
                &times;
              </button>
            </div>

            {/* Simulated Banner */}
            <div className="bg-amber-100 border-b border-amber-300 p-2.5 text-center text-xs font-bold text-amber-900 uppercase tracking-wide">
              SIMULATED HOSPITAL HANDOFF — NO REAL HOSPITAL CONTACTED.
            </div>

            <div className="p-6 space-y-5 text-xs text-gray-700">
              {/* Patient Identity */}
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-purple-900 text-sm">
                    {handoff.patient_summary_packet.patient?.fullName || patient.full_name}
                  </h4>
                  <p className="text-purple-700 font-mono">
                    Health ID: {handoff.patient_summary_packet.patient?.healthId || patient.health_id} &bull; DOB: {handoff.patient_summary_packet.patient?.dateOfBirth || '1948-03-12'}
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-red-600 text-white font-bold rounded uppercase">
                  {handoff.patient_summary_packet.severity || 'CRITICAL'}
                </span>
              </div>

              {/* Critical Conditions */}
              <div>
                <h5 className="font-bold text-gray-900 uppercase text-[11px] mb-1.5">Documented Critical Conditions</h5>
                <ul className="list-disc pl-5 space-y-1 text-red-700 font-medium">
                  {handoff.patient_summary_packet.criticalConditions?.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>

              {/* Known Allergies */}
              <div>
                <h5 className="font-bold text-gray-900 uppercase text-[11px] mb-1.5">Known Allergies & Contraindications</h5>
                <ul className="list-disc pl-5 space-y-1 text-amber-800">
                  {handoff.patient_summary_packet.knownAllergies?.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>

              {/* Active Medications */}
              <div>
                <h5 className="font-bold text-gray-900 uppercase text-[11px] mb-1.5">Current Medication Regimen</h5>
                {handoff.patient_summary_packet.activeMedications && handoff.patient_summary_packet.activeMedications.length > 0 ? (
                  <div className="space-y-1.5">
                    {handoff.patient_summary_packet.activeMedications.map((m, i) => (
                      <div key={i} className="p-2 bg-gray-50 rounded border border-gray-200 flex justify-between">
                        <span className="font-semibold text-gray-800">{m.name}</span>
                        <span className="text-gray-500">{m.dosage} &bull; {m.frequency}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 italic">No active medication records found.</p>
                )}
              </div>

              {/* Staff Acknowledgement Form */}
              <div className="pt-4 border-t border-gray-200 space-y-3">
                <h5 className="font-bold text-gray-900 uppercase text-[11px]">Receiving Desk Acknowledgement</h5>
                <div>
                  <label className="block text-gray-600 mb-1">Receiving Staff Name (Simulated)</label>
                  <input
                    type="text"
                    value={hospitalStaff}
                    onChange={(e) => setHospitalStaff(e.target.value)}
                    className="w-full border border-gray-300 rounded p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">Receiving Notes / Bed Assignment</label>
                  <textarea
                    rows={2}
                    value={hospitalNotes}
                    onChange={(e) => setHospitalNotes(e.target.value)}
                    className="w-full border border-gray-300 rounded p-2 text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="p-5 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowHospitalModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-100"
              >
                Close
              </button>
              <button
                onClick={handleAcknowledgeHospital}
                className="px-4 py-2 bg-purple-700 text-white rounded-lg text-xs font-bold hover:bg-purple-800 shadow"
              >
                Acknowledge Emergency Packet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Cancel Incident Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Cancel Emergency Incident</h3>
            <p className="text-xs text-gray-600">
              Provide a cancellation reason (e.g. False alarm, Accidental trigger, Patient confirmed stable).
            </p>
            <textarea
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Enter reason for cancellation..."
              className="w-full border border-gray-300 rounded p-2.5 text-xs"
            />
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-3 py-1.5 border border-gray-300 rounded text-xs font-medium text-gray-700"
              >
                Back
              </button>
              <button
                onClick={handleCancelIncident}
                disabled={!cancelReason.trim()}
                className="px-4 py-1.5 bg-red-600 text-white rounded text-xs font-bold hover:bg-red-700 disabled:opacity-50"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Phase 6: Live Test Modals */}
      {showRecipientModal && (
        <LiveTestRecipientManager
          familyId={familyId}
          onClose={() => setShowRecipientModal(false)}
        />
      )}

      {showPreflightModal && activeIncident && (
        <LiveTestPreflightModal
          familyId={familyId}
          incidentId={activeIncident.id}
          onClose={() => setShowPreflightModal(false)}
          onDispatched={handleLiveTestDispatched}
        />
      )}
    </div>
  );
};
