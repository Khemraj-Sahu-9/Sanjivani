// @vitest-environment jsdom
/**
 * frontend/src/features/emergency/EmergencyDashboard.test.tsx
 *
 * Unit tests for Phase 5 UI Components:
 * - EmergencyDashboard (SOS trigger, DEMO MODE banner, contact acknowledgement, demo controls, hospital modal)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EmergencyDashboard } from './EmergencyDashboard';
import { PatientProfile } from '../../types/auth';
import { sosApiService } from '../../services/sosService';

vi.mock('../../services/sosService', () => ({
  sosApiService: {
    triggerSos: vi.fn(),
    getActiveIncident: vi.fn(),
    listIncidents: vi.fn(),
    getIncidentDetails: vi.fn(),
    acknowledgeContactAttempt: vi.fn(),
    acknowledgeCaregiver: vi.fn(),
    acknowledgeHospitalDesk: vi.fn(),
    advanceTimeout: vi.fn(),
    resolveIncident: vi.fn(),
    cancelIncident: vi.fn(),
    resetDemoScenario: vi.fn(),
    seedDemo: vi.fn(),
    listContacts: vi.fn(),
    getPolicy: vi.fn(),
    upsertPolicy: vi.fn(),
  },
}));

describe('Phase 5 — Emergency Dashboard UI', () => {
  const mockPatient: PatientProfile = {
    id: 'pat-phase5-001',
    family_id: 'fam-phase5-001',
    health_id: 'SNJ-2026-DEMO-001',
    full_name: 'Om Prakash Sharma',
    category: 'elderly',
    date_of_birth: '1948-03-12',
    gender: 'male',
    status: 'active',
    created_by: 'usr-1',
    created_at: '2026-10-22T00:00:00Z',
    updated_at: '2026-10-22T00:00:00Z',
  };

  const mockContacts = [
    {
      id: 'c1',
      family_id: 'fam-phase5-001',
      patient_profile_id: 'pat-phase5-001',
      name: 'Ramesh Sharma (Son)',
      relationship: 'Son',
      phone_number: '+91-98765-00001 (Simulated)',
      role: 'primary_family' as const,
      priority: 1,
      is_active: true,
      is_demo: true,
      simulation_provenance: 'DEMO_SIMULATION_ONLY',
      created_at: '2026-10-22T00:00:00Z',
      updated_at: '2026-10-22T00:00:00Z',
    },
    {
      id: 'c2',
      family_id: 'fam-phase5-001',
      patient_profile_id: 'pat-phase5-001',
      name: 'Dr. Arvind Mehta (Home Nurse)',
      relationship: 'Designated Caregiver',
      phone_number: '+91-98765-00003 (Simulated)',
      role: 'caregiver' as const,
      priority: 3,
      is_active: true,
      is_demo: true,
      simulation_provenance: 'DEMO_SIMULATION_ONLY',
      created_at: '2026-10-22T00:00:00Z',
      updated_at: '2026-10-22T00:00:00Z',
    },
  ];

  const mockPolicy = {
    id: 'pol-1',
    family_id: 'fam-phase5-001',
    patient_profile_id: 'pat-phase5-001',
    family_response_timeout_seconds: 15,
    caregiver_response_timeout_seconds: 15,
    advance_to_hospital_on_timeout: true,
    hospital_name: 'Apollo Indraprastha Fictional Hospital (Demo Desk)',
    hospital_department: 'Emergency Receiving Desk (Simulated)',
    is_active: true,
    is_demo: true,
    simulation_provenance: 'DEMO_SIMULATION_ONLY',
    created_at: '2026-10-22T00:00:00Z',
    updated_at: '2026-10-22T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sosApiService.getActiveIncident).mockResolvedValue({
      data: { incident: null },
      status: 200,
    } as any);
    vi.mocked(sosApiService.listContacts).mockResolvedValue({
      data: { contacts: mockContacts },
      status: 200,
    } as any);
    vi.mocked(sosApiService.getPolicy).mockResolvedValue({
      data: { policy: mockPolicy },
      status: 200,
    } as any);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders DEMO MODE banner and idle SOS entry button', async () => {
    render(
      <EmergencyDashboard
        familyId="fam-phase5-001"
        patient={mockPatient}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText(/DEMO MODE — ALL EMERGENCY CONTACTS AND HOSPITAL EVENTS ARE SIMULATED/i)
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /ACTIVATE EMERGENCY SOS \(DEMO\)/i })
      ).toBeInTheDocument();
      expect(screen.getByText('Ramesh Sharma (Son)')).toBeInTheDocument();
    });
  });

  it('triggers emergency SOS and displays active incident details', async () => {
    const mockIncident = {
      id: 'inc-001',
      incident_number: 'SOS-20261022-TEST',
      family_id: 'fam-phase5-001',
      patient_profile_id: 'pat-phase5-001',
      initiated_by_user_id: 'usr-1',
      status: 'AWAITING_FAMILY_RESPONSE' as const,
      current_stage: 'FAMILY_CONTACT' as const,
      severity: 'CRITICAL' as const,
      location_note: 'Home',
      is_demo: true,
      simulation_provenance: 'DEMO_SIMULATION_ONLY',
      activated_at: new Date().toISOString(),
      response_deadline: new Date(Date.now() + 15000).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const mockAttempt = {
      id: 'att-1',
      incident_id: 'inc-001',
      contact_id: 'c1',
      contact_name: 'Ramesh Sharma (Son)',
      contact_role: 'primary_family',
      channel: 'SIMULATED_VOICE_SMS',
      stage: 'FAMILY_CONTACT' as const,
      status: 'AWAITING_RESPONSE' as const,
      attempted_at: new Date().toISOString(),
      is_demo: true,
      simulation_provenance: 'DEMO_SIMULATION_ONLY',
    };

    vi.mocked(sosApiService.triggerSos).mockResolvedValue({
      data: {
        incident: mockIncident,
        attempts: [mockAttempt],
      },
      status: 201,
    } as any);

    vi.mocked(sosApiService.getActiveIncident)
      .mockResolvedValueOnce({ data: { incident: null }, status: 200 } as any)
      .mockResolvedValue({ data: { incident: mockIncident }, status: 200 } as any);

    vi.mocked(sosApiService.getIncidentDetails).mockResolvedValue({
      data: {
        incident: mockIncident,
        patient: mockPatient,
        attempts: [mockAttempt],
        events: [
          {
            id: 'ev-1',
            incident_id: 'inc-001',
            event_type: 'INCIDENT_CREATED',
            title: 'SOS Incident Activated (Demo Simulation)',
            description: 'SOS activated for Om Prakash Sharma',
            actor_type: 'USER',
            stage: 'FAMILY_CONTACT',
            is_demo: true,
            simulation_provenance: 'DEMO_SIMULATION_ONLY',
            created_at: new Date().toISOString(),
          },
        ],
        policy: mockPolicy,
        handoff: null,
      },
      status: 200,
    } as any);

    render(
      <EmergencyDashboard
        familyId="fam-phase5-001"
        patient={mockPatient}
      />
    );

    const triggerBtn = await screen.findByRole('button', { name: /ACTIVATE EMERGENCY SOS \(DEMO\)/i });
    await waitFor(() => {
      expect(triggerBtn).not.toBeDisabled();
    });
    fireEvent.click(triggerBtn);

    await waitFor(() => {
      expect(sosApiService.triggerSos).toHaveBeenCalledWith('fam-phase5-001', {
        patientProfileId: 'pat-phase5-001',
        severity: 'CRITICAL',
        locationNote: expect.any(String),
      });
      expect(screen.getByText(/ACTIVE INCIDENT: SOS-20261022-TEST/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /I am Responding/i })).toBeInTheDocument();
    });
  });

  it('allows interactive family contact acknowledgement', async () => {
    const mockIncident = {
      id: 'inc-001',
      incident_number: 'SOS-20261022-TEST',
      family_id: 'fam-phase5-001',
      patient_profile_id: 'pat-phase5-001',
      initiated_by_user_id: 'usr-1',
      status: 'AWAITING_FAMILY_RESPONSE' as const,
      current_stage: 'FAMILY_CONTACT' as const,
      severity: 'CRITICAL' as const,
      location_note: 'Home',
      is_demo: true,
      simulation_provenance: 'DEMO_SIMULATION_ONLY',
      activated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const mockAttempt = {
      id: 'att-1',
      incident_id: 'inc-001',
      contact_id: 'c1',
      contact_name: 'Ramesh Sharma (Son)',
      contact_role: 'primary_family',
      channel: 'SIMULATED_VOICE_SMS',
      stage: 'FAMILY_CONTACT' as const,
      status: 'AWAITING_RESPONSE' as const,
      attempted_at: new Date().toISOString(),
      is_demo: true,
      simulation_provenance: 'DEMO_SIMULATION_ONLY',
    };

    vi.mocked(sosApiService.getActiveIncident).mockResolvedValue({
      data: { incident: mockIncident },
      status: 200,
    } as any);

    vi.mocked(sosApiService.getIncidentDetails).mockResolvedValue({
      data: {
        incident: mockIncident,
        patient: mockPatient,
        attempts: [mockAttempt],
        events: [],
        policy: mockPolicy,
        handoff: null,
      },
      status: 200,
    } as any);

    vi.mocked(sosApiService.acknowledgeContactAttempt).mockResolvedValue({
      data: {
        incident: { ...mockIncident, status: 'FAMILY_RESPONDED' },
        attempt: { ...mockAttempt, status: 'ACKNOWLEDGED', acknowledgement_action: 'I am responding' },
      },
      status: 200,
    } as any);

    render(
      <EmergencyDashboard
        familyId="fam-phase5-001"
        patient={mockPatient}
      />
    );

    const respondBtn = await screen.findByRole('button', { name: /I am Responding/i });
    fireEvent.click(respondBtn);

    await waitFor(() => {
      expect(sosApiService.acknowledgeContactAttempt).toHaveBeenCalledWith(
        'fam-phase5-001',
        'inc-001',
        'att-1',
        'I am responding'
      );
    });
  });

  it('opens and interacts with the fictional hospital receiving desk modal', async () => {
    const mockHandoff = {
      id: 'h-1',
      incident_id: 'inc-001',
      hospital_name: 'Apollo Indraprastha Fictional Hospital (Demo Desk)',
      department: 'Emergency Receiving Desk (Simulated)',
      status: 'PENDING_SIMULATED' as const,
      patient_summary_packet: {
        incidentNumber: 'SOS-20261022-TEST',
        severity: 'CRITICAL',
        patient: {
          fullName: 'Om Prakash Sharma',
          healthId: 'SNJ-2026-DEMO-001',
        },
        criticalConditions: ['Type 2 Diabetes Mellitus', 'Hypertension'],
        knownAllergies: ['Penicillin'],
        activeMedications: [{ name: 'Metformin', dosage: '500mg', frequency: 'twice_daily' }],
      },
      handoff_prepared_at: new Date().toISOString(),
      is_demo: true,
      simulation_provenance: 'DEMO_SIMULATION_ONLY',
    };

    const mockIncident = {
      id: 'inc-001',
      incident_number: 'SOS-20261022-TEST',
      family_id: 'fam-phase5-001',
      patient_profile_id: 'pat-phase5-001',
      initiated_by_user_id: 'usr-1',
      status: 'HOSPITAL_HANDOFF_SIMULATED' as const,
      current_stage: 'HOSPITAL_HANDOFF' as const,
      severity: 'CRITICAL' as const,
      location_note: 'Home',
      is_demo: true,
      simulation_provenance: 'DEMO_SIMULATION_ONLY',
      activated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    vi.mocked(sosApiService.getActiveIncident).mockResolvedValue({
      data: { incident: mockIncident },
      status: 200,
    } as any);

    vi.mocked(sosApiService.getIncidentDetails).mockResolvedValue({
      data: {
        incident: mockIncident,
        patient: mockPatient,
        attempts: [],
        events: [],
        policy: mockPolicy,
        handoff: mockHandoff,
      },
      status: 200,
    } as any);

    vi.mocked(sosApiService.acknowledgeHospitalDesk).mockResolvedValue({
      data: {
        incident: mockIncident,
        handoff: { ...mockHandoff, status: 'ACKNOWLEDGED_SIMULATED' },
      },
      status: 200,
    } as any);

    render(
      <EmergencyDashboard
        familyId="fam-phase5-001"
        patient={mockPatient}
      />
    );

    const openDeskBtn = await screen.findByRole('button', { name: /Open Hospital Receiving Desk Dashboard/i });
    fireEvent.click(openDeskBtn);

    // Modal should be visible
    expect(
      screen.getByText(/SIMULATED HOSPITAL HANDOFF — NO REAL HOSPITAL CONTACTED/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Type 2 Diabetes Mellitus')).toBeInTheDocument();

    // Click acknowledge
    const ackPacketBtn = screen.getByRole('button', { name: /Acknowledge Emergency Packet/i });
    fireEvent.click(ackPacketBtn);

    await waitFor(() => {
      expect(sosApiService.acknowledgeHospitalDesk).toHaveBeenCalledWith(
        'fam-phase5-001',
        'inc-001',
        expect.stringContaining('Nurse Priya Desai'),
        expect.any(String)
      );
    });
  });
});
