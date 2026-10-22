// @vitest-environment jsdom
/**
 * frontend/src/features/medications/MedicationManagement.test.tsx
 *
 * Unit tests for Phase 4 UI Components:
 * - MedicationDashboard (dose tracking, taking dose, explicit draft confirmation, manual schedule creation)
 * - AppointmentDashboard (listing appointments, schedule consultation modal)
 * - NotificationCenter (inbox rendering, filter by category, mark read/acknowledge)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MedicationDashboard } from './MedicationDashboard';
import { AppointmentDashboard } from '../appointments/AppointmentDashboard';
import { NotificationCenter } from '../notifications/NotificationCenter';
import { PatientProfile } from '../../types/auth';
import { medicationApiService } from '../../services/medicationService';
import { appointmentApiService } from '../../services/appointmentService';
import { notificationApiService } from '../../services/notificationService';

// Mock Services
vi.mock('../../services/medicationService', () => ({
  medicationApiService: {
    listSchedules: vi.fn(),
    createSchedule: vi.fn(),
    confirmDraft: vi.fn(),
    pauseSchedule: vi.fn(),
    resumeSchedule: vi.fn(),
    discontinueSchedule: vi.fn(),
    getScheduleHistory: vi.fn(),
    getPrefillCandidates: vi.fn(),
    listDoses: vi.fn(),
    updateDoseStatus: vi.fn(),
    generateDoses: vi.fn(),
  },
}));

vi.mock('../../services/appointmentService', () => ({
  appointmentApiService: {
    listAppointments: vi.fn(),
    createAppointment: vi.fn(),
    updateAppointment: vi.fn(),
    cancelAppointment: vi.fn(),
    completeAppointment: vi.fn(),
  },
}));

vi.mock('../../services/notificationService', () => ({
  notificationApiService: {
    listNotifications: vi.fn(),
    markAsRead: vi.fn(),
    acknowledgeNotification: vi.fn(),
    getPreferences: vi.fn(),
    updatePreferences: vi.fn(),
    getCaregiverPolicies: vi.fn(),
    setCaregiverPolicy: vi.fn(),
    triggerTestDispatch: vi.fn(),
  },
}));

vi.mock('../../services/documentService', () => ({
  documentApiService: {
    listDocuments: vi.fn().mockResolvedValue({
      status: 200,
      data: [],
      error: null,
    }),
  },
}));

const mockPatient: PatientProfile = {
  id: 'patient-401',
  family_id: 'fam-401',
  full_name: 'Ananya Roy',
  health_id: 'SANJ-2026-AR01',
  category: 'adult',
  date_of_birth: '1992-05-10',
  gender: 'female',
  relationship_to_creator: 'Sister',
  status: 'active',
  created_by: 'user-1',
  created_at: '2026-10-22T00:00:00.000Z',
  updated_at: '2026-10-22T00:00:00.000Z',
};

describe('Phase 4 — Medication Dashboard UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(medicationApiService.listSchedules).mockResolvedValue({
      status: 200,
      data: [
        {
          id: 'sched-1',
          family_id: 'fam-401',
          patient_profile_id: 'patient-401',
          medicine_name: 'Amlodipine',
          strength: '5mg',
          dosage_instruction: 'Take 1 tablet every morning',
          frequency: 'once_daily',
          scheduled_times: ['08:00'],
          start_date: '2026-10-20',
          status: 'active',
          created_by: 'user-1',
          created_at: '2026-10-20T00:00:00.000Z',
          updated_at: '2026-10-20T00:00:00.000Z',
        },
        {
          id: 'sched-draft-1',
          family_id: 'fam-401',
          patient_profile_id: 'patient-401',
          medicine_name: 'Metformin',
          strength: '500mg',
          dosage_instruction: 'Take 1 tablet twice daily after meals',
          frequency: 'twice_daily',
          scheduled_times: ['08:00', '20:00'],
          start_date: '2026-10-22',
          status: 'draft_pending_confirmation',
          created_by: 'user-1',
          created_at: '2026-10-22T00:00:00.000Z',
          updated_at: '2026-10-22T00:00:00.000Z',
        },
      ],
      error: null,
    });

    vi.mocked(medicationApiService.listDoses).mockResolvedValue({
      status: 200,
      data: [
        {
          id: 'dose-1',
          schedule_id: 'sched-1',
          patient_profile_id: 'patient-401',
          family_id: 'fam-401',
          scheduled_date: '2026-10-22',
          scheduled_time: '08:00',
          scheduled_datetime: '2026-10-22T08:00:00+05:30',
          status: 'scheduled',
          dose_instruction: 'Take 1 tablet every morning',
          created_at: '2026-10-22T00:00:00.000Z',
          updated_at: '2026-10-22T00:00:00.000Z',
          schedule: {
            id: 'sched-1',
            family_id: 'fam-401',
            patient_profile_id: 'patient-401',
            medicine_name: 'Amlodipine',
            strength: '5mg',
            dosage_instruction: 'Take 1 tablet every morning',
            frequency: 'once_daily',
            scheduled_times: ['08:00'],
            start_date: '2026-10-20',
            status: 'active',
            created_by: 'user-1',
            created_at: '2026-10-20T00:00:00.000Z',
            updated_at: '2026-10-20T00:00:00.000Z',
          },
        },
      ],
      error: null,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders today dose tracker and active schedules', async () => {
    render(<MedicationDashboard familyId="fam-401" patient={mockPatient} />);

    await waitFor(() => {
      expect(screen.getByText(/Medication Management:/i)).toBeInTheDocument();
      expect(screen.getByText('Ananya Roy')).toBeInTheDocument();
      expect(screen.getAllByText(/Amlodipine/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Prescription Schedules Awaiting Explicit Confirmation/i)).toBeInTheDocument();
      expect(screen.getByText('Metformin')).toBeInTheDocument();
    });
  });

  it('handles taking a scheduled dose', async () => {
    vi.mocked(medicationApiService.updateDoseStatus).mockResolvedValue({
      status: 200,
      data: {
        id: 'dose-1',
        schedule_id: 'sched-1',
        patient_profile_id: 'patient-401',
        family_id: 'fam-401',
        scheduled_date: '2026-10-22',
        scheduled_time: '08:00',
        scheduled_datetime: '2026-10-22T08:00:00+05:30',
        status: 'taken',
        dose_instruction: 'Take 1 tablet every morning',
        created_at: '2026-10-22T00:00:00.000Z',
        updated_at: '2026-10-22T00:00:00.000Z',
      },
      error: null,
    });

    render(<MedicationDashboard familyId="fam-401" patient={mockPatient} />);

    await waitFor(() => {
      expect(screen.getByText('✓ Take Dose')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('✓ Take Dose'));

    await waitFor(() => {
      expect(medicationApiService.updateDoseStatus).toHaveBeenCalledWith(
        'fam-401',
        'dose-1',
        'taken',
        undefined
      );
    });
  });

  it('handles confirming a draft prescription schedule', async () => {
    vi.mocked(medicationApiService.confirmDraft).mockResolvedValue({
      status: 200,
      data: {
        id: 'sched-draft-1',
        family_id: 'fam-401',
        patient_profile_id: 'patient-401',
        medicine_name: 'Metformin',
        strength: '500mg',
        dosage_instruction: 'Take 1 tablet twice daily after meals',
        frequency: 'twice_daily',
        scheduled_times: ['08:00', '20:00'],
        start_date: '2026-10-22',
        status: 'active',
        created_by: 'user-1',
        created_at: '2026-10-22T00:00:00.000Z',
        updated_at: '2026-10-22T00:00:00.000Z',
      },
      error: null,
    });

    render(<MedicationDashboard familyId="fam-401" patient={mockPatient} />);

    await waitFor(() => {
      expect(screen.getByText('✓ Confirm & Activate')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('✓ Confirm & Activate'));

    await waitFor(() => {
      expect(medicationApiService.confirmDraft).toHaveBeenCalledWith(
        'fam-401',
        'sched-draft-1'
      );
    });
  });
});

describe('Phase 4 — Appointment Dashboard UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(appointmentApiService.listAppointments).mockResolvedValue({
      status: 200,
      data: [
        {
          id: 'app-1',
          family_id: 'fam-401',
          patient_profile_id: 'patient-401',
          title: 'Annual Health Checkup',
          doctor_name: 'Dr. Neha Verma',
          facility_name: 'Fortis Hospital',
          appointment_date: '2026-11-05',
          appointment_time: '11:00',
          timezone: 'Asia/Kolkata',
          status: 'scheduled',
          created_by: 'user-1',
          created_at: '2026-10-22T00:00:00.000Z',
          updated_at: '2026-10-22T00:00:00.000Z',
        },
      ],
      error: null,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders upcoming appointments and opens schedule modal', async () => {
    render(<AppointmentDashboard familyId="fam-401" patient={mockPatient} />);

    await waitFor(() => {
      expect(screen.getByText('Annual Health Checkup')).toBeInTheDocument();
      expect(screen.getByText(/Dr\. Neha Verma/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /\+.*Schedule Appointment/i }));

    expect(screen.getByText('Schedule Doctor Appointment')).toBeInTheDocument();
    expect(screen.getByText(/Appointment Title \/ Reason/i)).toBeInTheDocument();
  });
});

describe('Phase 4 — Notification Center UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(notificationApiService.listNotifications).mockResolvedValue({
      status: 200,
      data: [
        {
          id: 'notif-1',
          family_id: 'fam-401',
          patient_profile_id: 'patient-401',
          recipient_user_id: 'user-1',
          category: 'medication_reminder',
          title: 'Medication Dose Due',
          message: 'It is time for Ananya Roy to take scheduled medication.',
          details_payload: { doseId: 'dose-1' },
          channel: 'in_app',
          status: 'delivered',
          scheduled_for: '2026-10-22T08:00:00+05:30',
          attempt_count: 1,
          created_at: '2026-10-22T08:00:00.000Z',
          updated_at: '2026-10-22T08:00:00.000Z',
        },
      ],
      error: null,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders notification inbox and acknowledges notifications', async () => {
    vi.mocked(notificationApiService.acknowledgeNotification).mockResolvedValue({
      status: 200,
      data: {
        id: 'notif-1',
        family_id: 'fam-401',
        recipient_user_id: 'user-1',
        category: 'medication_reminder',
        title: 'Medication Dose Due',
        message: 'It is time for Ananya Roy to take scheduled medication.',
        details_payload: {},
        channel: 'in_app',
        status: 'acknowledged',
        scheduled_for: '2026-10-22T08:00:00+05:30',
        attempt_count: 1,
        created_at: '2026-10-22T08:00:00.000Z',
        updated_at: '2026-10-22T08:00:00.000Z',
      },
      error: null,
    });

    render(<NotificationCenter familyId="fam-401" patient={mockPatient} />);

    await waitFor(() => {
      expect(screen.getByText('Medication Dose Due')).toBeInTheDocument();
      expect(screen.getByText(/It is time for Ananya Roy to take scheduled medication/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('✓ Acknowledge'));

    await waitFor(() => {
      expect(notificationApiService.acknowledgeNotification).toHaveBeenCalledWith('fam-401', 'notif-1');
    });
  });
});
