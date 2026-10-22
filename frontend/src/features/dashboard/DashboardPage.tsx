import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext.tsx';
import { apiClient } from '../../lib/apiClient.ts';
import { Family, FamilyMembership, PatientProfile, MembershipRole } from '../../types/auth.ts';
import { HealthDocument } from '../../types/document.ts';
import { documentApiService } from '../../services/documentService.ts';
import { DocumentLibrary } from '../documents/DocumentLibrary.tsx';
import { HealthMemoryChat } from '../memory/HealthMemoryChat.tsx';
import { PatientTimelineView } from '../memory/PatientTimelineView.tsx';
import { LabTrendsView } from '../memory/LabTrendsView.tsx';
import { DoctorSummaryModal } from '../memory/DoctorSummaryModal.tsx';
import { MedicationDashboard } from '../medications/MedicationDashboard.tsx';
import { AppointmentDashboard } from '../appointments/AppointmentDashboard.tsx';
import { NotificationCenter } from '../notifications/NotificationCenter.tsx';
import { EmergencyDashboard } from '../emergency/EmergencyDashboard.tsx';
import { offlineStorage } from '../../lib/offlineStorage.ts';
import { syncEngine } from '../../services/syncEngine.ts';
import { SyncDashboardModal } from '../../components/sync/SyncDashboardModal.tsx';
import { CommunityDashboard } from '../community/CommunityDashboard.tsx';
import styles from './Dashboard.module.css';

export type DashboardView =
  | 'documents'
  | 'medications'
  | 'appointments'
  | 'notifications'
  | 'sos'
  | 'memory'
  | 'timeline'
  | 'lab_trends'
  | 'profiles'
  | 'sync'
  | 'community';

export function DashboardPage() {
  const { user } = useAuth();
  const [families, setFamilies] = useState<Family[]>([]);
  const [activeFamily, setActiveFamily] = useState<Family | null>(null);
  const [userRole, setUserRole] = useState<MembershipRole>('adult');
  const [members, setMembers] = useState<FamilyMembership[]>([]);
  const [patientProfiles, setPatientProfiles] = useState<PatientProfile[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientProfile | null>(null);
  const [, setLoading] = useState(true);

  // Active Tab: Records, AI Memory, Timeline, Lab Trends, Profiles
  const [activeView, setActiveView] = useState<DashboardView>('documents');

  // Doctor Summary Modal State
  const [showDoctorSummaryModal, setShowDoctorSummaryModal] = useState(false);
  const [summaryDocs, setSummaryDocs] = useState<HealthDocument[]>([]);
  const [isLoadingSummaryDocs, setIsLoadingSummaryDocs] = useState(false);

  // Modals state
  const [showCreateFamilyModal, setShowCreateFamilyModal] = useState(false);
  const [showCreatePatientModal, setShowCreatePatientModal] = useState(false);
  const [showInviteMemberModal, setShowInviteMemberModal] = useState(false);
  const [showEditPatientModal, setShowEditPatientModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);

  // Form states
  const [newFamilyName, setNewFamilyName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'adult' | 'caregiver' | 'guardian'>('adult');

  const [patientName, setPatientName] = useState('');
  const [patientDob, setPatientDob] = useState('');
  const [patientGender, setPatientGender] = useState<'male' | 'female' | 'other' | 'prefer_not_to_say'>('prefer_not_to_say');
  const [patientRel, setPatientRel] = useState('');
  const [patientCat, setPatientCat] = useState<'child' | 'adult' | 'elderly'>('adult');

  const [editName, setEditName] = useState('');
  const [editRel, setEditRel] = useState('');

  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const loadFamilyDetails = useCallback(async (familyId: string) => {
    // 1. Get family & current user role
    const famRes = await apiClient.get<{ family: Family; role: MembershipRole }>(`/api/families/${familyId}`);
    if (famRes.data) {
      setUserRole(famRes.data.role);
    }

    // 2. Get members
    const memRes = await apiClient.get<{ members: FamilyMembership[] }>(`/api/families/${familyId}/members`);
    if (memRes.data?.members) {
      setMembers(memRes.data.members);
    }

    // 3. Get patient profiles
    const patRes = await apiClient.get<{ profiles: PatientProfile[] }>(`/api/families/${familyId}/patients`);
    if (patRes.data?.profiles) {
      setPatientProfiles(patRes.data.profiles);
      if (patRes.data.profiles.length > 0 && !selectedPatient) {
        setSelectedPatient(patRes.data.profiles[0] || null);
      }
      // Save snapshots to offline storage for offline access
      if (user) {
        for (const p of patRes.data.profiles) {
          offlineStorage.savePatientSnapshot(user.id, {
            ...p,
            cached_at: new Date().toISOString(),
          }).catch(() => {});
        }
      }
    } else if (user) {
      // Offline fallback: load cached patient profiles
      const cached = await offlineStorage.listPatientSnapshots(user.id, familyId);
      if (cached.length > 0) {
        setPatientProfiles(cached as unknown as PatientProfile[]);
        if (!selectedPatient) {
          setSelectedPatient(cached[0] as unknown as PatientProfile);
        }
      }
    }
  }, [selectedPatient, user]);

  const loadUserFamilies = useCallback(async () => {
    setLoading(true);
    const res = await apiClient.get<{ families: Family[] }>('/api/families');
    if (res.data?.families) {
      setFamilies(res.data.families);
      if (res.data.families.length > 0 && !activeFamily) {
        setActiveFamily(res.data.families[0] || null);
      }
    }
    setLoading(false);
  }, [activeFamily]);

  // Load user families
  useEffect(() => {
    loadUserFamilies();
  }, [loadUserFamilies]);

  // When activeFamily changes, load members and patient profiles
  useEffect(() => {
    if (activeFamily) {
      loadFamilyDetails(activeFamily.id);
    }
  }, [activeFamily, loadFamilyDetails]);

  const handleCreateFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackMsg(null);
    const res = await apiClient.post<{ family: Family; membership: FamilyMembership }>('/api/families', {
      name: newFamilyName,
    });
    if (res.error || !res.data) {
      setFeedbackMsg({ type: 'error', text: res.error || 'Failed to create family workspace' });
      return;
    }
    setFamilies((prev) => [...prev, res.data!.family]);
    setActiveFamily(res.data.family);
    setShowCreateFamilyModal(false);
    setNewFamilyName('');
    setFeedbackMsg({ type: 'success', text: `Family workspace "${res.data.family.name}" created.` });
  };

  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFamily) return;
    setFeedbackMsg(null);

    const res = await apiClient.post<{ profile: PatientProfile }>(`/api/families/${activeFamily.id}/patients`, {
      fullName: patientName,
      dateOfBirth: patientDob || null,
      gender: patientGender,
      relationshipToCreator: patientRel || null,
      category: patientCat,
    });

    if (res.error || !res.data) {
      setFeedbackMsg({ type: 'error', text: res.error || 'Failed to create patient profile' });
      return;
    }

    setPatientProfiles((prev) => [...prev, res.data!.profile]);
    setSelectedPatient(res.data.profile);
    setShowCreatePatientModal(false);
    setPatientName('');
    setPatientDob('');
    setPatientRel('');
    setFeedbackMsg({
      type: 'success',
      text: `Patient profile created! Generated Health ID: ${res.data.profile.health_id}`,
    });
  };

  const handleEditPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;
    setFeedbackMsg(null);

    const res = await apiClient.patch<{ profile: PatientProfile }>(`/api/families/patients/${selectedPatient.id}`, {
      fullName: editName,
      relationshipToCreator: editRel,
    });

    if (res.error || !res.data) {
      // If offline or network error, queue operation in local offline sync queue
      if ((typeof navigator !== 'undefined' && !navigator.onLine) || res.status === 0) {
        if (user && activeFamily) {
          await syncEngine.enqueueOperation(
            user.id,
            activeFamily.id,
            'PATIENT_UPDATE',
            { patientId: selectedPatient.id, updates: { fullName: editName, relationshipToCreator: editRel } },
            selectedPatient.id,
            selectedPatient.updated_at
          );

          setPatientProfiles((prev) =>
            prev.map((p) => (p.id === selectedPatient.id ? { ...p, full_name: editName, relationship_to_creator: editRel } : p))
          );
          setSelectedPatient((prev) => (prev ? { ...prev, full_name: editName, relationship_to_creator: editRel } : null));
          setShowEditPatientModal(false);
          setFeedbackMsg({ type: 'success', text: 'Saved locally on device. Will synchronize when reconnected.' });
          return;
        }
      }

      setFeedbackMsg({ type: 'error', text: res.error || 'Failed to update patient profile' });
      return;
    }

    setPatientProfiles((prev) =>
      prev.map((p) => (p.id === selectedPatient.id ? { ...p, full_name: editName, relationship_to_creator: editRel } : p))
    );
    setSelectedPatient((prev) => (prev ? { ...prev, full_name: editName, relationship_to_creator: editRel } : null));
    setShowEditPatientModal(false);
    setFeedbackMsg({ type: 'success', text: 'Patient profile updated successfully.' });
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFamily) return;
    setFeedbackMsg(null);

    const res = await apiClient.post<{ membership: FamilyMembership }>(`/api/families/${activeFamily.id}/members`, {
      email: inviteEmail,
      role: inviteRole,
    });

    if (res.error || !res.data) {
      setFeedbackMsg({ type: 'error', text: res.error || 'Failed to add family member' });
      return;
    }

    setMembers((prev) => [...prev, res.data!.membership]);
    setShowInviteMemberModal(false);
    setInviteEmail('');
    setFeedbackMsg({ type: 'success', text: `Member added to ${activeFamily.name}.` });
  };

  const handleOpenDoctorSummary = async () => {
    if (!activeFamily) return;
    if (!selectedPatient) {
      setFeedbackMsg({ type: 'error', text: 'Please select a patient profile first to generate a doctor summary.' });
      return;
    }
    setIsLoadingSummaryDocs(true);
    setFeedbackMsg(null);
    try {
      const res = await documentApiService.listDocuments(activeFamily.id, {
        patientProfileId: selectedPatient.id,
      });
      if (res.data) {
        setSummaryDocs(res.data);
      }
      setShowDoctorSummaryModal(true);
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to fetch patient documents for doctor summary.' });
    } finally {
      setIsLoadingSummaryDocs(false);
    }
  };

  return (
    <div className={styles.dashboardContainer}>
      {/* Workspace Selector Bar */}
      <div className={styles.workspaceBar}>
        <div className={styles.workspaceBarLeft}>
          <span style={{ fontSize: '1.25rem' }}>🏠</span>
          <div>
            <h1 className={styles.workspaceTitle}>Family Health Workspace</h1>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
              Logged in as: <strong>{user?.full_name || user?.email}</strong>
            </p>
          </div>
        </div>

        <div className={styles.workspaceBarRight}>
          {families.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                Active Family:
              </label>
              <select
                className={styles.familySelect}
                value={activeFamily?.id || ''}
                onChange={(e) => {
                  const selected = families.find((f) => f.id === e.target.value);
                  if (selected) {
                    setActiveFamily(selected);
                    setSelectedPatient(null);
                  }
                }}
              >
                {families.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              <span className={styles.roleTag}>{userRole}</span>
            </div>
          ) : (
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>No family workspace yet</span>
          )}

          <button onClick={() => setShowCreateFamilyModal(true)} className={styles.btnPrimary}>
            + New Family Workspace
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.85rem',
            backgroundColor: feedbackMsg.type === 'error' ? 'var(--color-error-subtle)' : 'var(--color-success-subtle)',
            color: feedbackMsg.type === 'error' ? 'var(--color-error)' : 'var(--color-success)',
            border: `1px solid ${feedbackMsg.type === 'error' ? 'rgba(220,38,38,0.2)' : 'rgba(5,150,105,0.2)'}`,
          }}
        >
          {feedbackMsg.text}
        </div>
      )}

      {/* Navigation Tabs: Records, AI Memory, Timeline, Lab Trends, Profiles + Summary Action */}
      {activeFamily && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => setActiveView('documents')}
              style={{
                padding: '0.5rem 0.85rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeView === 'documents' ? '#0284c7' : 'transparent',
                color: activeView === 'documents' ? '#ffffff' : '#4b5563',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              📋 Records & OCR
            </button>
            <button
              onClick={() => setActiveView('medications')}
              style={{
                padding: '0.5rem 0.85rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeView === 'medications' ? '#0f766e' : 'transparent',
                color: activeView === 'medications' ? '#ffffff' : '#4b5563',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              💊 Medications & Doses
            </button>
            <button
              onClick={() => setActiveView('appointments')}
              style={{
                padding: '0.5rem 0.85rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeView === 'appointments' ? '#0f766e' : 'transparent',
                color: activeView === 'appointments' ? '#ffffff' : '#4b5563',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              🩺 Appointments
            </button>
            <button
              onClick={() => setActiveView('notifications')}
              style={{
                padding: '0.5rem 0.85rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeView === 'notifications' ? '#0f766e' : 'transparent',
                color: activeView === 'notifications' ? '#ffffff' : '#4b5563',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              🔔 Notifications
            </button>
            <button
              onClick={() => setActiveView('sos')}
              style={{
                padding: '0.5rem 0.85rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeView === 'sos' ? '#dc2626' : 'transparent',
                color: activeView === 'sos' ? '#ffffff' : '#b91c1c',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              🚨 Emergency SOS
            </button>
            <button
              onClick={() => setActiveView('memory')}
              style={{
                padding: '0.5rem 0.85rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeView === 'memory' ? '#0f766e' : 'transparent',
                color: activeView === 'memory' ? '#ffffff' : '#4b5563',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              🧠 Health Memory AI
            </button>
            <button
              onClick={() => setActiveView('timeline')}
              style={{
                padding: '0.5rem 0.85rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeView === 'timeline' ? '#0f766e' : 'transparent',
                color: activeView === 'timeline' ? '#ffffff' : '#4b5563',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              📅 Medical Timeline
            </button>
            <button
              onClick={() => setActiveView('lab_trends')}
              style={{
                padding: '0.5rem 0.85rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeView === 'lab_trends' ? '#0f766e' : 'transparent',
                color: activeView === 'lab_trends' ? '#ffffff' : '#4b5563',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              🧪 Lab Trends
            </button>
            <button
              onClick={() => setActiveView('profiles')}
              style={{
                padding: '0.5rem 0.85rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeView === 'profiles' ? '#0284c7' : 'transparent',
                color: activeView === 'profiles' ? '#ffffff' : '#4b5563',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              👥 Family & Profiles ({patientProfiles.length})
            </button>
            <button
              onClick={() => setActiveView('sync')}
              style={{
                padding: '0.5rem 0.85rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeView === 'sync' ? '#475569' : 'transparent',
                color: activeView === 'sync' ? '#ffffff' : '#4b5563',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              🔄 Offline Sync
            </button>

            <button
              onClick={() => setActiveView('community')}
              style={{
                padding: '0.5rem 0.85rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeView === 'community' ? '#0284c7' : 'transparent',
                color: activeView === 'community' ? '#ffffff' : '#4b5563',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              🏘️ Community & Elderly Aid
            </button>
          </div>

          <div>
            <button
              onClick={handleOpenDoctorSummary}
              disabled={isLoadingSummaryDocs}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                border: '1px solid #0f766e',
                backgroundColor: '#f0fdfa',
                color: '#0f766e',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <span>📄</span>
              <span>{isLoadingSummaryDocs ? 'Loading Records...' : 'Generate Doctor Summary'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Patient Selector Bar for Medications, Appointments, Health Memory, Timeline & Lab Trends */}
      {activeFamily && ['medications', 'appointments', 'memory', 'timeline', 'lab_trends'].includes(activeView) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc', padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', margin: '0.75rem 0', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Selected Patient Profile:</span>
            {patientProfiles.length > 0 ? (
              <select
                value={selectedPatient?.id || ''}
                onChange={(e) => {
                  const p = patientProfiles.find((item) => item.id === e.target.value);
                  if (p) setSelectedPatient(p);
                }}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  color: '#0f172a',
                }}
              >
                {patientProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name} ({p.health_id}) - {p.category}
                  </option>
                ))}
              </select>
            ) : (
              <span style={{ fontSize: '0.85rem', color: '#dc2626' }}>No patient profile created yet.</span>
            )}
          </div>
          {selectedPatient && (
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Health ID: <strong style={{ color: '#0f766e' }}>{selectedPatient.health_id}</strong>
            </div>
          )}
        </div>
      )}

      {/* Main Workspace Layout */}
      {activeFamily ? (
        activeView === 'documents' ? (
          /* Phase 2: Medical Document Management & OCR Library */
          <DocumentLibrary
            familyId={activeFamily.id}
            patients={patientProfiles}
            userRole={userRole}
          />
        ) : activeView === 'medications' ? (
          /* Phase 4: Medication Management & Dose Adherence Tracker */
          selectedPatient ? (
            <MedicationDashboard
              familyId={activeFamily.id}
              patient={selectedPatient}
              userRole={userRole}
            />
          ) : (
            <div className={styles.card} style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <p style={{ color: '#64748b' }}>Please select or create a patient profile to manage medication schedules.</p>
              <button onClick={() => setShowCreatePatientModal(true)} className={styles.btnPrimary} style={{ marginTop: '1rem' }}>
                + Add Patient Profile
              </button>
            </div>
          )
        ) : activeView === 'appointments' ? (
          /* Phase 4: Doctor Appointments & Advance Alerts */
          selectedPatient ? (
            <AppointmentDashboard
              familyId={activeFamily.id}
              patient={selectedPatient}
              userRole={userRole}
            />
          ) : (
            <div className={styles.card} style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <p style={{ color: '#64748b' }}>Please select or create a patient profile to view or schedule doctor appointments.</p>
              <button onClick={() => setShowCreatePatientModal(true)} className={styles.btnPrimary} style={{ marginTop: '1rem' }}>
                + Add Patient Profile
              </button>
            </div>
          )
        ) : activeView === 'notifications' ? (
          /* Phase 4: Notification Center, Preferences & Caregiver Policies */
          <NotificationCenter
            familyId={activeFamily.id}
            patient={selectedPatient}
            userRole={userRole}
          />
        ) : activeView === 'sos' ? (
          /* Phase 5: Complete SOS Emergency Response Demo Mode */
          selectedPatient ? (
            <EmergencyDashboard
              familyId={activeFamily.id}
              patient={selectedPatient}
              userRole={userRole}
            />
          ) : (
            <div className={styles.card} style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <p style={{ color: '#64748b' }}>Please select or create a patient profile to access Emergency SOS assistance.</p>
              <button onClick={() => setShowCreatePatientModal(true)} className={styles.btnPrimary} style={{ marginTop: '1rem' }}>
                + Add Patient Profile
              </button>
            </div>
          )
        ) : activeView === 'memory' ? (
          /* Phase 3: Conversational AI Health Memory */
          selectedPatient ? (
            <HealthMemoryChat familyId={activeFamily.id} patient={selectedPatient} />
          ) : (
            <div className={styles.card} style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <p style={{ color: '#64748b' }}>Please select or create a patient profile to consult their AI Health Memory.</p>
              <button onClick={() => setShowCreatePatientModal(true)} className={styles.btnPrimary} style={{ marginTop: '1rem' }}>
                + Add Patient Profile
              </button>
            </div>
          )
        ) : activeView === 'timeline' ? (
          /* Phase 3: Chronological Medical History Timeline */
          selectedPatient ? (
            <PatientTimelineView familyId={activeFamily.id} patient={selectedPatient} />
          ) : (
            <div className={styles.card} style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <p style={{ color: '#64748b' }}>Please select or create a patient profile to view their medical timeline.</p>
              <button onClick={() => setShowCreatePatientModal(true)} className={styles.btnPrimary} style={{ marginTop: '1rem' }}>
                + Add Patient Profile
              </button>
            </div>
          )
        ) : activeView === 'lab_trends' ? (
          /* Phase 3: Historical Laboratory Result Trends */
          selectedPatient ? (
            <LabTrendsView familyId={activeFamily.id} patient={selectedPatient} />
          ) : (
            <div className={styles.card} style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <p style={{ color: '#64748b' }}>Please select or create a patient profile to view their lab trends.</p>
              <button onClick={() => setShowCreatePatientModal(true)} className={styles.btnPrimary} style={{ marginTop: '1rem' }}>
                + Add Patient Profile
              </button>
            </div>
          )
        ) : activeView === 'community' ? (
          /* Phase 8: Health Community, Society Groups & Elderly Assistance */
          <CommunityDashboard currentUserId={user?.id || ''} />
        ) : activeView === 'sync' ? (
          /* Phase 7: Offline Sync & Storage Center */
          <div className={styles.card} style={{ padding: '1.5rem' }}>
            <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', color: '#1e293b' }}>
              🔄 Offline Health Records & Synchronization
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0 0 1rem 0' }}>
              Sanjivani enables local offline viewing and edits for patient summaries, medications, and appointments.
              When network connectivity returns, queued operations synchronize automatically with the server.
            </p>
            <button
              onClick={() => setShowSyncModal(true)}
              className={styles.btnPrimary}
              style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem' }}
            >
              Open Synchronization Center
            </button>
          </div>
        ) : (
          <div className={styles.sectionGrid}>
            {/* Left Column: Patient Profiles (Health Memory Identity) */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2 className={styles.cardTitle}>🩺 Family Patient Profiles</h2>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                    Individual health identities managed under <strong>{activeFamily.name}</strong>
                  </p>
                </div>

                {['owner', 'adult', 'guardian'].includes(userRole) && (
                  <button onClick={() => setShowCreatePatientModal(true)} className={styles.btnPrimary}>
                    + Add Patient Profile
                  </button>
                )}
              </div>

              {patientProfiles.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>No patient profiles in this workspace yet.</p>
                  <p style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
                    Create profiles for yourself, children, or elderly parents to organize their medical memory.
                  </p>
                </div>
              ) : (
                <div className={styles.patientGrid}>
                  {patientProfiles.map((p) => {
                    const isSelected = selectedPatient?.id === p.id;
                    const catClass =
                      p.category === 'child'
                        ? styles.catChild
                        : p.category === 'elderly'
                        ? styles.catElderly
                        : styles.catAdult;

                    return (
                      <div
                        key={p.id}
                        className={`${styles.patientCard} ${isSelected ? styles.patientCardActive : ''}`}
                        onClick={() => setSelectedPatient(p)}
                      >
                        <div className={styles.patientHeader}>
                          <span className={styles.patientName}>{p.full_name}</span>
                          <span className={`${styles.categoryBadge} ${catClass}`}>{p.category}</span>
                        </div>

                        <div className={styles.metaRow}>
                          {p.relationship_to_creator && <span>Relation: {p.relationship_to_creator}</span>}
                          {p.gender && <span>Gender: {p.gender}</span>}
                          {p.date_of_birth && <span>DOB: {p.date_of_birth}</span>}
                        </div>

                        <div>
                          <div className={styles.healthIdBadge}>
                            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>ID:</span>
                            <strong>{p.health_id}</strong>
                          </div>
                          <div className={styles.healthIdDisclaimer}>
                            Application Health ID (Not an ABHA/Aadhaar government identifier)
                          </div>
                        </div>

                        {isSelected && ['owner', 'adult', 'guardian'].includes(userRole) && (
                          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditName(p.full_name);
                                setEditRel(p.relationship_to_creator || '');
                                setShowEditPatientModal(true);
                              }}
                              className={styles.btnSecondary}
                              style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                            >
                              Edit Profile
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Column: Family Members & Permissions */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2 className={styles.cardTitle}>👥 Family Members & Roles</h2>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                    Permissions for workspace <strong>{activeFamily.name}</strong>
                  </p>
                </div>

                {userRole === 'owner' && (
                  <button onClick={() => setShowInviteMemberModal(true)} className={styles.btnSecondary}>
                    + Add Member
                  </button>
                )}
              </div>

              <div className={styles.memberList}>
                {members.map((m) => (
                  <div key={m.id} className={styles.memberItem}>
                    <div className={styles.memberAvatar}>
                      {m.user?.full_name?.charAt(0) || m.user?.email?.charAt(0) || 'U'}
                    </div>
                    <div className={styles.memberInfo}>
                      <div className={styles.memberName}>
                        {m.user?.full_name || 'Member'}
                        {m.user_id === user?.id && <span style={{ color: 'var(--color-primary)', marginLeft: 4 }}>(You)</span>}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                        {m.user?.email}
                      </div>
                    </div>
                    <span className={styles.roleTag}>{m.role}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      ) : (
        <div className={styles.card} style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <h3>Get Started with Sanjivani</h3>
          <p style={{ color: 'var(--color-text-secondary)', margin: '1rem auto', maxWidth: '30rem' }}>
            A family workspace allows you to coordinate records and care for yourself, your children, and elderly relatives.
          </p>
          <button onClick={() => setShowCreateFamilyModal(true)} className={styles.btnPrimary}>
            Create Your First Family Workspace
          </button>
        </div>
      )}

      {/* Modal: Create Family */}
      {showCreateFamilyModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3 style={{ marginBottom: '1rem' }}>Create Family Workspace</h3>
            <form onSubmit={handleCreateFamily} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>
                  Family Workspace Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sharma Family Care"
                  value={newFamilyName}
                  onChange={(e) => setNewFamilyName(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowCreateFamilyModal(false)} className={styles.btnSecondary}>
                  Cancel
                </button>
                <button type="submit" className={styles.btnPrimary}>
                  Create Workspace
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Patient Profile */}
      {showCreatePatientModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3 style={{ marginBottom: '1rem' }}>Add Patient Profile</h3>
            <form onSubmit={handleCreatePatient} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Sharma"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>
                  Category
                </label>
                <select
                  value={patientCat}
                  onChange={(e) => setPatientCat(e.target.value as 'child' | 'adult' | 'elderly')}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
                >
                  <option value="adult">Adult</option>
                  <option value="elderly">Elderly</option>
                  <option value="child">Child</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>
                  Relationship (e.g. Self, Father, Daughter)
                </label>
                <input
                  type="text"
                  placeholder="Father"
                  value={patientRel}
                  onChange={(e) => setPatientRel(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>
                  Date of Birth (Optional)
                </label>
                <input
                  type="date"
                  value={patientDob}
                  onChange={(e) => setPatientDob(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>
                  Gender (Optional)
                </label>
                <select
                  value={patientGender}
                  onChange={(e) => setPatientGender(e.target.value as 'male' | 'female' | 'other' | 'prefer_not_to_say')}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
                >
                  <option value="prefer_not_to_say">Prefer not to say</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowCreatePatientModal(false)} className={styles.btnSecondary}>
                  Cancel
                </button>
                <button type="submit" className={styles.btnPrimary}>
                  Generate Health ID & Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Patient Profile */}
      {showEditPatientModal && selectedPatient && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3 style={{ marginBottom: '1rem' }}>Edit Patient Profile</h3>
            <form onSubmit={handleEditPatient} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>
                  Health ID (Immutable)
                </label>
                <input
                  type="text"
                  disabled
                  value={selectedPatient.health_id}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-secondary)' }}
                />
                <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                  Application Health IDs cannot be modified.
                </span>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>
                  Relationship
                </label>
                <input
                  type="text"
                  value={editRel}
                  onChange={(e) => setEditRel(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowEditPatientModal(false)} className={styles.btnSecondary}>
                  Cancel
                </button>
                <button type="submit" className={styles.btnPrimary}>
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Member */}
      {showInviteMemberModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3 style={{ marginBottom: '1rem' }}>Add Family Member</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
              Add a registered Sanjivani user to this workspace.
            </p>
            <form onSubmit={handleInviteMember} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>
                  User Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="user@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>
                  Access Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'adult' | 'caregiver' | 'guardian')}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
                >
                  <option value="adult">Adult Member (Access allowed records)</option>
                  <option value="caregiver">Caregiver (Limited assistance view)</option>
                  <option value="guardian">Guardian (Can manage dependents)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowInviteMemberModal(false)} className={styles.btnSecondary}>
                  Cancel
                </button>
                <button type="submit" className={styles.btnPrimary}>
                  Add Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Doctor-Ready PDF Summary Generator */}
      {showDoctorSummaryModal && activeFamily && selectedPatient && (
        <DoctorSummaryModal
          familyId={activeFamily.id}
          patient={selectedPatient}
          documents={summaryDocs}
          isOpen={showDoctorSummaryModal}
          onClose={() => setShowDoctorSummaryModal(false)}
        />
      )}

      {/* Modal: Offline Synchronization & Storage Dashboard */}
      {showSyncModal && (
        <SyncDashboardModal
          familyId={activeFamily?.id}
          isOpen={showSyncModal}
          onClose={() => setShowSyncModal(false)}
        />
      )}
    </div>
  );
}
