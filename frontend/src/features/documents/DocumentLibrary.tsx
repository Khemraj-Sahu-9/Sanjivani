import React, { useState, useEffect, useCallback } from 'react';
import { HealthDocument, DocumentCategory, DocumentDetailsResponse } from '../../types/document';
import { PatientProfile } from '../../types/auth';
import { documentApiService } from '../../services/documentService';
import { DocumentUploadModal } from './DocumentUploadModal';
import { DocumentReviewModal } from './DocumentReviewModal';

interface DocumentLibraryProps {
  familyId: string;
  patients: PatientProfile[];
  userRole: string;
}

const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  prescription: 'Prescription',
  laboratory_report: 'Lab Report',
  diagnostic_imaging_report: 'Imaging Report',
  discharge_summary: 'Discharge Summary',
  hospital_record: 'Hospital Record',
  vaccination_record: 'Vaccination',
  other: 'Other Document',
};

export const DocumentLibrary: React.FC<DocumentLibraryProps> = ({ familyId, patients, userRole }) => {
  const [documents, setDocuments] = useState<HealthDocument[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [reviewDetails, setReviewDetails] = useState<DocumentDetailsResponse | null>(null);
  const [deleteConfirmDoc, setDeleteConfirmDoc] = useState<HealthDocument | null>(null);

  // Duplicate Warning Modal
  const [duplicateWarning, setDuplicateWarning] = useState<{
    pendingUpload: any;
    existingDoc: HealthDocument;
  } | null>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await documentApiService.listDocuments(familyId, {
        patientProfileId: selectedPatientId || undefined,
        category: categoryFilter ? (categoryFilter as DocumentCategory) : undefined,
        reviewStatus: statusFilter || undefined,
        query: searchQuery || undefined,
      });

      if (res.error) throw new Error(res.error);
      setDocuments(res.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch medical documents');
    } finally {
      setIsLoading(false);
    }
  }, [familyId, selectedPatientId, categoryFilter, statusFilter, searchQuery]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleUploadSubmit = async (uploadData: any) => {
    const res = await documentApiService.uploadDocument({
      familyId,
      ...uploadData,
    });

    if (res.status === 409) {
      // Duplicate warning
      const existing = (res as any).existingDocument || (res.data as any)?.existingDocument;
      setDuplicateWarning({
        pendingUpload: uploadData,
        existingDoc: existing,
      });
      return;
    }

    if (res.error) throw new Error(res.error);
    await fetchDocuments();
  };

  const handleBypassDuplicateUpload = async () => {
    if (!duplicateWarning) return;
    try {
      const res = await documentApiService.uploadDocument({
        familyId,
        ...duplicateWarning.pendingUpload,
        bypassDuplicate: true,
      });
      if (res.error) throw new Error(res.error);
      setDuplicateWarning(null);
      await fetchDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  const openReviewModal = async (docId: string) => {
    try {
      setIsLoading(true);
      const res = await documentApiService.getDocumentDetails(docId);
      if (res.error || !res.data) throw new Error(res.error || 'Failed to load details');
      setReviewDetails(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open document review');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    try {
      setIsLoading(true);
      const res = await documentApiService.deleteDocument(docId);
      if (res.error) throw new Error(res.error);
      setDeleteConfirmDoc(null);
      await fetchDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete document');
    } finally {
      setIsLoading(false);
    }
  };

  const getPatientName = (patientId: string) => {
    return patients.find((p) => p.id === patientId)?.full_name || 'Unknown Patient';
  };

  const canUpload = ['owner', 'adult', 'caregiver', 'guardian'].includes(userRole);
  const canDelete = ['owner', 'adult', 'guardian'].includes(userRole);

  return (
    <div style={styles.container}>
      {/* Top Header & Actions */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Medical Document Library</h2>
          <p style={styles.subTitle}>
            Centralized health memory, prescriptions, laboratory reports, and verified clinical OCR records.
          </p>
        </div>
        {canUpload && (
          <button
            onClick={() => setIsUploadOpen(true)}
            style={styles.uploadBtn}
          >
            + Upload Document
          </button>
        )}
      </div>

      {error && <div style={styles.errorBanner}>{error}</div>}

      {/* Filter and Search Bar */}
      <div style={styles.filterBar}>
        <div style={styles.filterItem}>
          <label style={styles.filterLabel}>Patient:</label>
          <select
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
            style={styles.select}
          >
            <option value="">All Patients ({patients.length})</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name} ({p.health_id})
              </option>
            ))}
          </select>
        </div>

        <div style={styles.filterItem}>
          <label style={styles.filterLabel}>Category:</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={styles.select}
          >
            <option value="">All Categories</option>
            {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.filterItem}>
          <label style={styles.filterLabel}>Review Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={styles.select}
          >
            <option value="">All Statuses</option>
            <option value="needs_review">Needs Review</option>
            <option value="in_review">In Review</option>
            <option value="confirmed">Confirmed</option>
          </select>
        </div>

        <div style={{ ...styles.filterItem, flex: 1 }}>
          <label style={styles.filterLabel}>Search:</label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, filename, category..."
            style={styles.searchInput}
          />
        </div>
      </div>

      {/* Documents Table / Timeline */}
      {isLoading && documents.length === 0 ? (
        <div style={styles.loadingBox}>Loading medical records...</div>
      ) : documents.length === 0 ? (
        <div style={styles.emptyState}>
          <span style={{ fontSize: '2.5rem' }}>📄</span>
          <h3 style={styles.emptyTitle}>No medical documents found</h3>
          <p style={styles.emptySub}>
            {canUpload
              ? 'Upload prescriptions or lab reports to run OCR extraction and index them.'
              : 'No documents match the selected filter criteria.'}
          </p>
        </div>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.trHead}>
                <th style={styles.th}>Document Title</th>
                <th style={styles.th}>Patient</th>
                <th style={styles.th}>Category</th>
                <th style={styles.th}>Document Date</th>
                <th style={styles.th}>OCR Status</th>
                <th style={styles.th}>Review</th>
                <th style={styles.thAction}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => {
                const isConfirmed = doc.review_status === 'confirmed';
                return (
                  <tr key={doc.id} style={styles.tr}>
                    <td style={styles.td}>
                      <div style={styles.docTitleBlock}>
                        <span style={styles.docIcon}>
                          {doc.mime_type === 'application/pdf' ? '📕' : '🖼️'}
                        </span>
                        <div>
                          <div style={styles.docTitle}>{doc.title}</div>
                          <div style={styles.docFilename}>{doc.original_filename}</div>
                        </div>
                      </div>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.patientBadge}>{getPatientName(doc.patient_profile_id)}</span>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.catBadge}>{CATEGORY_LABELS[doc.category] || doc.category}</span>
                    </td>
                    <td style={styles.td}>
                      {doc.document_date ? doc.document_date : <span style={styles.faintText}>Not set</span>}
                    </td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.statusTag,
                          backgroundColor:
                            doc.processing_status === 'extracted'
                              ? '#dcfce7'
                              : doc.processing_status === 'failed'
                              ? '#fee2e2'
                              : '#e0f2fe',
                          color:
                            doc.processing_status === 'extracted'
                              ? '#166534'
                              : doc.processing_status === 'failed'
                              ? '#991b1b'
                              : '#0369a1',
                        }}
                      >
                        {doc.processing_status.toUpperCase()}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.statusTag,
                          backgroundColor: isConfirmed ? '#dcfce7' : '#fef3c7',
                          color: isConfirmed ? '#166534' : '#92400e',
                        }}
                      >
                        {isConfirmed ? '✓ CONFIRMED' : 'NEEDS REVIEW'}
                      </span>
                    </td>
                    <td style={styles.tdAction}>
                      <div style={styles.actionGroup}>
                        <button
                          onClick={() => openReviewModal(doc.id)}
                          style={styles.reviewBtn}
                        >
                          Inspect & Review
                        </button>
                        {canDelete && (
                          <button
                            onClick={() => setDeleteConfirmDoc(doc)}
                            style={styles.deleteBtn}
                            title="Delete Document"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Upload Modal */}
      {isUploadOpen && (
        <DocumentUploadModal
          isOpen={isUploadOpen}
          patients={patients}
          selectedPatientId={selectedPatientId}
          onClose={() => setIsUploadOpen(false)}
          onUpload={handleUploadSubmit}
        />
      )}

      {/* Review / OCR Details Modal */}
      {reviewDetails && (
        <DocumentReviewModal
          details={reviewDetails}
          patientName={getPatientName(reviewDetails.document.patient_profile_id)}
          onClose={() => setReviewDetails(null)}
          onUpdated={fetchDocuments}
        />
      )}

      {/* Duplicate Warning Dialog */}
      {duplicateWarning && (
        <div style={styles.overlay}>
          <div style={styles.confirmBox}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#b45309' }}>⚠️ Duplicate Document Detected</h3>
            <p style={{ fontSize: '0.875rem', color: '#4b5563' }}>
              An identical file (matching SHA-256 checksum) was already uploaded for this patient:
            </p>
            <div style={styles.duplicateBox}>
              <strong>Existing:</strong> {duplicateWarning.existingDoc.title} ({duplicateWarning.existingDoc.original_filename})<br />
              <strong>Uploaded on:</strong> {new Date(duplicateWarning.existingDoc.created_at).toLocaleString()}
            </div>
            <p style={{ fontSize: '0.85rem', color: '#6b7280' }}>
              Do you want to upload this file anyway as a distinct copy, or inspect the existing document?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                onClick={() => setDuplicateWarning(null)}
                style={styles.cancelBtn}
              >
                Cancel Upload
              </button>
              <button
                onClick={() => {
                  const existingId = duplicateWarning.existingDoc.id;
                  setDuplicateWarning(null);
                  openReviewModal(existingId);
                }}
                style={styles.neutralBtn}
              >
                Open Existing Document
              </button>
              <button
                onClick={handleBypassDuplicateUpload}
                style={styles.submitBtn}
              >
                Upload Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmDoc && (
        <div style={styles.overlay}>
          <div style={styles.confirmBox}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#b91c1c' }}>Delete Medical Document?</h3>
            <p style={{ fontSize: '0.875rem', color: '#4b5563' }}>
              Are you sure you want to permanently delete <strong>{deleteConfirmDoc.title}</strong>?
              This will remove the file from storage and erase all OCR extractions.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                onClick={() => setDeleteConfirmDoc(null)}
                style={styles.cancelBtn}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmDoc.id)}
                style={styles.dangerBtn}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  title: {
    fontSize: '1.35rem',
    fontWeight: 700,
    color: '#111827',
    margin: '0 0 0.25rem 0',
  },
  subTitle: {
    fontSize: '0.875rem',
    color: '#6b7280',
    margin: 0,
  },
  uploadBtn: {
    padding: '0.625rem 1.25rem',
    borderRadius: '6px',
    backgroundColor: '#0284c7',
    color: '#ffffff',
    border: 'none',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.875rem',
  },
  errorBanner: {
    backgroundColor: '#fee2e2',
    color: '#b91c1c',
    padding: '0.75rem 1rem',
    borderRadius: '6px',
    fontSize: '0.875rem',
  },
  filterBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '1rem',
    backgroundColor: '#ffffff',
    padding: '1rem',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    alignItems: 'center',
  },
  filterItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  filterLabel: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#4b5563',
  },
  select: {
    padding: '0.5rem 0.75rem',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    fontSize: '0.85rem',
    backgroundColor: '#ffffff',
    minWidth: '160px',
  },
  searchInput: {
    padding: '0.5rem 0.75rem',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    fontSize: '0.85rem',
    width: '100%',
  },
  tableWrapper: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    fontSize: '0.875rem',
  },
  trHead: {
    backgroundColor: '#f9fafb',
    borderBottom: '1px solid #e5e7eb',
  },
  th: {
    padding: '0.75rem 1rem',
    color: '#4b5563',
    fontWeight: 600,
    fontSize: '0.8rem',
  },
  thAction: {
    padding: '0.75rem 1rem',
    color: '#4b5563',
    fontWeight: 600,
    fontSize: '0.8rem',
    textAlign: 'right',
  },
  tr: {
    borderBottom: '1px solid #f3f4f6',
  },
  td: {
    padding: '0.875rem 1rem',
    color: '#1f2937',
  },
  tdAction: {
    padding: '0.875rem 1rem',
    textAlign: 'right',
  },
  docTitleBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  docIcon: {
    fontSize: '1.25rem',
  },
  docTitle: {
    fontWeight: 600,
    color: '#111827',
  },
  docFilename: {
    fontSize: '0.75rem',
    color: '#6b7280',
  },
  patientBadge: {
    fontSize: '0.8rem',
    fontWeight: 500,
    backgroundColor: '#f3f4f6',
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
  },
  catBadge: {
    fontSize: '0.75rem',
    fontWeight: 500,
    color: '#4b5563',
    backgroundColor: '#f9fafb',
    border: '1px solid #e5e7eb',
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
  },
  statusTag: {
    fontSize: '0.7rem',
    fontWeight: 700,
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
  },
  faintText: {
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  actionGroup: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.5rem',
    alignItems: 'center',
  },
  reviewBtn: {
    padding: '0.4rem 0.75rem',
    borderRadius: '6px',
    border: '1px solid #0284c7',
    backgroundColor: '#e0f2fe',
    color: '#0284c7',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 600,
  },
  deleteBtn: {
    padding: '0.4rem 0.5rem',
    borderRadius: '6px',
    border: '1px solid #fee2e2',
    backgroundColor: '#fff',
    cursor: 'pointer',
  },
  loadingBox: {
    padding: '3rem',
    textAlign: 'center',
    color: '#6b7280',
    backgroundColor: '#ffffff',
    borderRadius: '8px',
  },
  emptyState: {
    padding: '3rem 1.5rem',
    textAlign: 'center',
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
  },
  emptyTitle: {
    fontSize: '1.1rem',
    fontWeight: 600,
    color: '#374151',
    margin: '0.75rem 0 0.25rem 0',
  },
  emptySub: {
    fontSize: '0.875rem',
    color: '#6b7280',
    margin: 0,
  },
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1100,
    padding: '1rem',
  },
  confirmBox: {
    backgroundColor: '#ffffff',
    borderRadius: '10px',
    maxWidth: '460px',
    width: '100%',
    padding: '1.5rem',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
  },
  duplicateBox: {
    backgroundColor: '#fef3c7',
    padding: '0.75rem',
    borderRadius: '6px',
    fontSize: '0.8rem',
    color: '#78350f',
    margin: '0.75rem 0',
  },
  cancelBtn: {
    padding: '0.5rem 1rem',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    backgroundColor: '#ffffff',
    color: '#374151',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  neutralBtn: {
    padding: '0.5rem 1rem',
    borderRadius: '6px',
    border: '1px solid #0284c7',
    backgroundColor: '#e0f2fe',
    color: '#0284c7',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 500,
  },
  submitBtn: {
    padding: '0.5rem 1rem',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: '#0284c7',
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
  },
  dangerBtn: {
    padding: '0.5rem 1rem',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: '#b91c1c',
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
  },
};
