import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DocumentLibrary } from './DocumentLibrary';
import { PatientProfile } from '../../types/auth';

// Mock documentApiService
vi.mock('../../services/documentService', () => ({
  documentApiService: {
    listDocuments: vi.fn().mockResolvedValue({
      status: 200,
      error: null,
      data: [
        {
          id: 'doc-1',
          family_id: 'fam-1',
          patient_profile_id: 'patient-1',
          title: 'Apollo Clinic Prescription',
          category: 'prescription',
          document_date: '2026-03-15',
          original_filename: 'rx_apollo.pdf',
          storage_path: 'patients/patient-1/sample.pdf',
          mime_type: 'application/pdf',
          file_size_bytes: 104200,
          file_checksum: 'abc123sha',
          processing_status: 'extracted',
          review_status: 'needs_review',
          created_by: 'user-1',
          created_at: '2026-03-15T10:00:00Z',
          updated_at: '2026-03-15T10:00:00Z',
        },
      ],
    }),
    getDocumentFileUrl: vi.fn().mockReturnValue('http://localhost:3001/api/families/documents/file/doc-1'),
    deleteDocument: vi.fn().mockResolvedValue({ status: 200, data: { message: 'Deleted' } }),
    saveReview: vi.fn().mockResolvedValue({ status: 200, data: {} }),
  },
}));

const mockPatients: PatientProfile[] = [
  {
    id: 'patient-1',
    family_id: 'fam-1',
    health_id: 'SNJ-TEST-1234-5678',
    full_name: 'Devaki Devi',
    category: 'elderly',
    status: 'active',
    created_by: 'user-1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
];

describe('Phase 2 Document Management & Library UI', () => {
  it('renders document library with uploaded records and metadata', async () => {
    render(<DocumentLibrary familyId="fam-1" patients={mockPatients} userRole="owner" />);

    expect(screen.getByText(/Medical Document Library/i)).toBeInTheDocument();
    expect(await screen.findByText('Apollo Clinic Prescription')).toBeInTheDocument();
    expect(screen.getByText('Devaki Devi')).toBeInTheDocument();
    expect(screen.getByText('NEEDS REVIEW')).toBeInTheDocument();
  });

  it('renders upload action button for authorized family owner/caregiver', () => {
    render(<DocumentLibrary familyId="fam-1" patients={mockPatients} userRole="owner" />);
    expect(screen.getByRole('button', { name: /\+ Upload Document/i })).toBeInTheDocument();
  });

  it('opens upload modal when clicking + Upload Document', () => {
    render(<DocumentLibrary familyId="fam-1" patients={mockPatients} userRole="owner" />);
    const uploadBtn = screen.getByRole('button', { name: /\+ Upload Document/i });
    fireEvent.click(uploadBtn);

    expect(screen.getByText(/Upload Medical Document/i)).toBeInTheDocument();
    expect(screen.getByText(/Choose File/i)).toBeInTheDocument();
  });
});
