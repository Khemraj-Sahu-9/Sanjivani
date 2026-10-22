// @vitest-environment jsdom
/**
 * frontend/src/features/memory/HealthMemory.test.tsx
 *
 * Unit tests for Phase 3 UI Components:
 * - HealthMemoryChat (conversational interface, grounding citations)
 * - PatientTimelineView (chronological medical events, filters)
 * - LabTrendsView (quantitative test series, reference ranges)
 * - DoctorSummaryModal (document selection, sections, PDF generation workflow)
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HealthMemoryChat } from './HealthMemoryChat';
import { PatientTimelineView } from './PatientTimelineView';
import { LabTrendsView } from './LabTrendsView';
import { DoctorSummaryModal } from './DoctorSummaryModal';
import { PatientProfile } from '../../types/auth';
import { HealthDocument } from '../../types/document';
import { healthMemoryApiService } from '../../services/healthMemoryService';

// Mock healthMemoryApiService
vi.mock('../../services/healthMemoryService', () => ({
  healthMemoryApiService: {
    askMemory: vi.fn().mockResolvedValue({
      status: 200,
      data: {
        answer: 'Based on Kaveri Sharma\'s verified report, fasting blood sugar is 112 mg/dL.',
        sources: [
          {
            documentId: 'doc-lab-1',
            documentTitle: 'Comprehensive Metabolic Panel',
            category: 'laboratory_report',
            documentDate: '2026-03-10',
            field: 'Fasting Blood Sugar',
            snippet: 'Fasting Blood Sugar: 112 mg/dL',
            isVerified: true,
          },
        ],
        isGrounded: true,
        conversationId: 'conv-test-123',
      },
      error: null,
    }),
    getTimeline: vi.fn().mockResolvedValue({
      status: 200,
      data: [
        {
          id: 'event-1',
          eventType: 'prescription',
          date: '2026-03-15',
          isDateConfirmed: true,
          title: 'Endocrine Clinic Consultation',
          description: 'Prescription with 1 active medication',
          documentId: 'doc-rx-1',
          category: 'prescription',
          isVerified: true,
          highlights: ['Metformin 500mg'],
        },
        {
          id: 'event-2',
          eventType: 'lab_report',
          date: '2026-03-10',
          isDateConfirmed: true,
          title: 'Metabolic Panel',
          description: '2 recorded lab test readings',
          documentId: 'doc-lab-1',
          category: 'laboratory_report',
          isVerified: true,
          highlights: ['Fasting Blood Sugar: 112 mg/dL', 'HbA1c: 6.8 %'],
        },
      ],
      error: null,
    }),
    getLabTrends: vi.fn().mockResolvedValue({
      status: 200,
      data: [
        {
          testName: 'fasting blood sugar',
          unit: 'mg/dL',
          dataPoints: [
            {
              id: 'dp-1',
              testName: 'Fasting Blood Sugar',
              normalizedTestName: 'fasting blood sugar',
              value: 112,
              rawResultValue: '112',
              unit: 'mg/dL',
              referenceRange: '70-100 mg/dL',
              date: '2026-03-10',
              documentId: 'doc-lab-1',
              documentTitle: 'Metabolic Panel',
              isVerified: true,
            },
          ],
        },
      ],
      error: null,
    }),
    previewDoctorSummary: vi.fn().mockResolvedValue({
      status: 200,
      data: {
        patient: {
          fullName: 'Kaveri Sharma',
          healthId: 'SNJ-2026-TEST-9999',
        },
        selectedDocs: [
          {
            id: 'doc-lab-1',
            title: 'Metabolic Panel',
            category: 'laboratory_report',
            documentDate: '2026-03-10',
            reviewStatus: 'confirmed',
          },
        ],
        includedSections: ['patient_info', 'medical_history', 'allergies', 'lab_results'],
      },
      error: null,
    }),
    downloadDoctorSummaryPdf: vi.fn().mockResolvedValue(undefined),
  },
}));

const mockPatient: PatientProfile = {
  id: 'patient-kaveri-1',
  family_id: 'fam-sharma-1',
  health_id: 'SNJ-2026-TEST-9999',
  full_name: 'Kaveri Sharma',
  category: 'elderly',
  date_of_birth: '1952-04-12',
  gender: 'female',
  status: 'active',
  created_by: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const mockDocs: HealthDocument[] = [
  {
    id: 'doc-lab-1',
    family_id: 'fam-sharma-1',
    patient_profile_id: 'patient-kaveri-1',
    title: 'Metabolic Panel',
    category: 'laboratory_report',
    document_date: '2026-03-10',
    original_filename: 'metabolic_panel.pdf',
    storage_path: 'patients/p1/metabolic.pdf',
    mime_type: 'application/pdf',
    file_size_bytes: 84000,
    file_checksum: 'checksum1',
    processing_status: 'extracted',
    review_status: 'confirmed',
    created_by: 'user-1',
    created_at: '2026-03-10T10:00:00Z',
    updated_at: '2026-03-10T10:00:00Z',
  },
];

describe('Phase 3 — Frontend Health Memory Components', () => {
  describe('1. HealthMemoryChat', () => {
    it('renders patient name, Health ID, and example prompt buttons', () => {
      render(<HealthMemoryChat familyId="fam-sharma-1" patient={mockPatient} />);

      expect(screen.getByText(/Ask Sanjivani Health Memory/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Kaveri Sharma/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/SNJ-2026-TEST-9999/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Ask anything about Kaveri Sharma/i)).toBeInTheDocument();
    });

    it('submits a prompt and displays grounded answer with source citations', async () => {
      render(<HealthMemoryChat familyId="fam-sharma-1" patient={mockPatient} />);

      const input = screen.getByPlaceholderText(/Ask anything about Kaveri Sharma/i);
      fireEvent.change(input, { target: { value: 'When was my last blood sugar report?' } });

      const sendBtn = screen.getByRole('button', { name: /Send/i });
      fireEvent.click(sendBtn);

      expect(healthMemoryApiService.askMemory).toHaveBeenCalledWith(
        'fam-sharma-1',
        mockPatient.id,
        'When was my last blood sugar report?',
        undefined
      );

      await waitFor(() => {
        expect(screen.getByText(/fasting blood sugar is 112 mg\/dL/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/Comprehensive Metabolic Panel/i)).toBeInTheDocument();
      expect(screen.getByText(/GROUNDED SUPPORTING SOURCES/i)).toBeInTheDocument();
    });
  });

  describe('2. PatientTimelineView', () => {
    it('renders chronological timeline events with categories and dates', async () => {
      render(<PatientTimelineView familyId="fam-sharma-1" patient={mockPatient} />);

      expect(screen.getByText(/Medical History Timeline/i)).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('Endocrine Clinic Consultation')).toBeInTheDocument();
        expect(screen.getByText('Metabolic Panel')).toBeInTheDocument();
      });

      expect(screen.getByText(/2026-03-15/)).toBeInTheDocument();
      expect(screen.getByText(/2026-03-10/)).toBeInTheDocument();
      expect(screen.getByText(/Metformin 500mg/i)).toBeInTheDocument();
    });
  });

  describe('3. LabTrendsView', () => {
    it('renders historical laboratory trend series with numerical values and ranges', async () => {
      render(<LabTrendsView familyId="fam-sharma-1" patient={mockPatient} />);

      expect(screen.getByText(/Historical Laboratory Trends/i)).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getAllByText(/fasting blood sugar/i).length).toBeGreaterThan(0);
      });

      expect(screen.getByText(/112\s*mg\/dL/)).toBeInTheDocument();
      expect(screen.getByText('70-100 mg/dL')).toBeInTheDocument();
    });
  });

  describe('4. DoctorSummaryModal', () => {
    it('renders document selector checkboxes and triggers PDF generation workflow', async () => {
      const handleClose = vi.fn();
      render(
        <DoctorSummaryModal
          familyId="fam-sharma-1"
          patient={mockPatient}
          documents={mockDocs}
          isOpen={true}
          onClose={handleClose}
        />
      );

      expect(screen.getByText(/Doctor-Ready Health Summary Generator/i)).toBeInTheDocument();
      expect(screen.getByText('Metabolic Panel')).toBeInTheDocument();
      expect(screen.getByText(/Preview Summary/i)).toBeInTheDocument();

      // Trigger preview
      fireEvent.click(screen.getByText(/Preview Summary/i));

      await waitFor(() => {
        expect(healthMemoryApiService.previewDoctorSummary).toHaveBeenCalled();
      });

      // Verify Download PDF button exists in preview
      const downloadBtn = screen.getByRole('button', { name: /Download Official PDF/i });
      expect(downloadBtn).toBeInTheDocument();

      fireEvent.click(downloadBtn);
      expect(healthMemoryApiService.downloadDoctorSummaryPdf).toHaveBeenCalled();
    });
  });
});
