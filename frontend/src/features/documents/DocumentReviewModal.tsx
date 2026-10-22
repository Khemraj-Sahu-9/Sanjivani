import React, { useState } from 'react';
import {
  DocumentDetailsResponse,
  StructuredMedicalFields,
  PrescriptionMedicineField,
  LabResultField,
} from '../../types/document';
import { documentApiService } from '../../services/documentService';

interface ReviewModalProps {
  details: DocumentDetailsResponse;
  patientName: string;
  onClose: () => void;
  onUpdated: () => void;
}

export const DocumentReviewModal: React.FC<ReviewModalProps> = ({
  details,
  patientName,
  onClose,
  onUpdated,
}) => {
  const { document: doc, extraction } = details;

  const initialFields: StructuredMedicalFields = {
    ...extraction?.proposed_fields,
    ...extraction?.confirmed_fields,
  };

  const [formData, setFormData] = useState<StructuredMedicalFields>(initialFields);
  const [activeTab, setActiveTab] = useState<'extracted' | 'raw' | 'preview'>('extracted');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasDiscrepancy] = useState<boolean>(() => {
    if (!initialFields.patient_name) return false;
    return !patientName.toLowerCase().includes(initialFields.patient_name.toLowerCase()) &&
      !initialFields.patient_name.toLowerCase().includes(patientName.toLowerCase());
  });

  const fileUrl = documentApiService.getDocumentFileUrl(doc.id);

  const handleFieldChange = (key: keyof StructuredMedicalFields, val: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: val }));
  };

  const handleMedicineChange = (index: number, field: keyof PrescriptionMedicineField, val: string) => {
    const list = [...(formData.medicines || [])];
    if (list[index]) {
      list[index] = { ...list[index]!, [field]: val };
      setFormData((prev) => ({ ...prev, medicines: list }));
    }
  };

  const removeMedicine = (index: number) => {
    const list = [...(formData.medicines || [])];
    list.splice(index, 1);
    setFormData((prev) => ({ ...prev, medicines: list }));
  };

  const addMedicine = () => {
    const list = [...(formData.medicines || [])];
    list.push({ name: '', dosage: '', strength: '' });
    setFormData((prev) => ({ ...prev, medicines: list }));
  };

  const handleLabResultChange = (index: number, field: keyof LabResultField, val: string) => {
    const list = [...(formData.lab_results || [])];
    if (list[index]) {
      list[index] = { ...list[index]!, [field]: val };
      setFormData((prev) => ({ ...prev, lab_results: list }));
    }
  };

  const removeLabResult = (index: number) => {
    const list = [...(formData.lab_results || [])];
    list.splice(index, 1);
    setFormData((prev) => ({ ...prev, lab_results: list }));
  };

  const addLabResult = () => {
    const list = [...(formData.lab_results || [])];
    list.push({ test_name: '', result_value: '', unit: '', reference_range: '' });
    setFormData((prev) => ({ ...prev, lab_results: list }));
  };

  const handleSave = async (markConfirmed: boolean) => {
    try {
      setIsSaving(true);
      setError(null);
      const res = await documentApiService.saveReview(doc.id, formData, markConfirmed);
      if (res.error) throw new Error(res.error);
      onUpdated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save review');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRetryOCR = async () => {
    try {
      setIsSaving(true);
      const res = await documentApiService.retryExtraction(doc.id);
      if (res.error) throw new Error(res.error);
      onUpdated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retry OCR');
      setIsSaving(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <div style={styles.categoryBadge}>{doc.category.toUpperCase().replace(/_/g, ' ')}</div>
            <h2 style={styles.title}>{doc.title}</h2>
            <p style={styles.subTitle}>
              Patient: <strong>{patientName}</strong> | Uploaded: {new Date(doc.created_at).toLocaleDateString()}
            </p>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>×</button>
        </div>

        {/* Warning if extracted patient name differs from profile */}
        {hasDiscrepancy && (
          <div style={styles.warningBanner}>
            ⚠️ <strong>Patient Name Discrepancy Flag:</strong> The extracted text references &quot;{initialFields.patient_name}&quot;,
            which differs from this patient profile ({patientName}). Please verify this document belongs to this patient.
          </div>
        )}

        {error && <div style={styles.errorBanner}>{error}</div>}

        {/* Split View: Left Document Preview, Right OCR Review */}
        <div style={styles.contentGrid}>
          {/* Left Column: Original Document */}
          <div style={styles.leftCol}>
            <div style={styles.colHeader}>
              <h3 style={styles.sectionHeading}>Original Document</h3>
              <a
                href={fileUrl}
                target="_blank"
                rel="noreferrer"
                style={styles.openExternalLink}
              >
                Open in New Tab ↗
              </a>
            </div>
            <div style={styles.viewerContainer}>
              {doc.mime_type === 'application/pdf' ? (
                <iframe
                  src={`${fileUrl}#toolbar=0`}
                  title="Medical Document Preview"
                  style={styles.iframe}
                />
              ) : (
                <img
                  src={fileUrl}
                  alt="Medical Document"
                  style={styles.imagePreview}
                />
              )}
            </div>
          </div>

          {/* Right Column: OCR Extraction & Human Review */}
          <div style={styles.rightCol}>
            <div style={styles.tabs}>
              <button
                type="button"
                style={activeTab === 'extracted' ? styles.activeTab : styles.tab}
                onClick={() => setActiveTab('extracted')}
              >
                Structured Fields
              </button>
              <button
                type="button"
                style={activeTab === 'raw' ? styles.activeTab : styles.tab}
                onClick={() => setActiveTab('raw')}
              >
                Raw OCR Text
              </button>
            </div>

            {/* OCR Provenance bar */}
            {extraction && (
              <div style={styles.provenanceBar}>
                <span>Method: <strong>{extraction.extraction_method}</strong> ({extraction.ocr_provider})</span>
                {extraction.confidence !== null && extraction.confidence !== undefined && (
                  <span>Confidence: <strong>{extraction.confidence}%</strong></span>
                )}
                <span>Status: <strong style={{ color: extraction.extraction_status === 'completed' ? '#059669' : '#b91c1c' }}>{extraction.extraction_status}</strong></span>
              </div>
            )}

            <div style={styles.formScroll}>
              {activeTab === 'extracted' && (
                <div style={styles.formFields}>
                  <div style={styles.fieldRow}>
                    <label style={styles.label}>Report Title / Subject</label>
                    <input
                      type="text"
                      value={String(formData.report_title || '')}
                      onChange={(e) => handleFieldChange('report_title', e.target.value)}
                      style={styles.input}
                    />
                  </div>

                  <div style={styles.fieldRowTwo}>
                    <div>
                      <label style={styles.label}>Doctor Name</label>
                      <input
                        type="text"
                        value={String(formData.doctor_name || '')}
                        onChange={(e) => handleFieldChange('doctor_name', e.target.value)}
                        placeholder="e.g. Dr. A. Sharma"
                        style={styles.input}
                      />
                    </div>
                    <div>
                      <label style={styles.label}>Facility / Clinic / Lab</label>
                      <input
                        type="text"
                        value={String(formData.facility_name || '')}
                        onChange={(e) => handleFieldChange('facility_name', e.target.value)}
                        placeholder="e.g. City Hospital"
                        style={styles.input}
                      />
                    </div>
                  </div>

                  <div style={styles.fieldRowTwo}>
                    <div>
                      <label style={styles.label}>Document Date</label>
                      <input
                        type="text"
                        value={String(formData.document_date || '')}
                        onChange={(e) => handleFieldChange('document_date', e.target.value)}
                        placeholder="YYYY-MM-DD"
                        style={styles.input}
                      />
                    </div>
                    <div>
                      <label style={styles.label}>Printed Patient Name</label>
                      <input
                        type="text"
                        value={String(formData.patient_name || '')}
                        onChange={(e) => handleFieldChange('patient_name', e.target.value)}
                        style={styles.input}
                      />
                    </div>
                  </div>

                  {/* Medicines Table (if prescription or items found) */}
                  <div style={styles.sectionBlock}>
                    <div style={styles.sectionHeader}>
                      <h4 style={styles.subHeading}>Prescribed Medicines</h4>
                      <button type="button" onClick={addMedicine} style={styles.addBtn}>+ Add Medicine</button>
                    </div>
                    {(!formData.medicines || formData.medicines.length === 0) ? (
                      <p style={styles.emptyNote}>No medicines automatically detected.</p>
                    ) : (
                      <div style={styles.listContainer}>
                        {formData.medicines.map((m, idx) => (
                          <div key={idx} style={styles.listItem}>
                            <input
                              type="text"
                              value={m.name}
                              placeholder="Medicine Name"
                              onChange={(e) => handleMedicineChange(idx, 'name', e.target.value)}
                              style={{ ...styles.input, flex: 2 }}
                            />
                            <input
                              type="text"
                              value={m.strength || ''}
                              placeholder="Strength (e.g. 500mg)"
                              onChange={(e) => handleMedicineChange(idx, 'strength', e.target.value)}
                              style={{ ...styles.input, flex: 1 }}
                            />
                            <input
                              type="text"
                              value={m.dosage || ''}
                              placeholder="Dosage (e.g. 1-0-1)"
                              onChange={(e) => handleMedicineChange(idx, 'dosage', e.target.value)}
                              style={{ ...styles.input, flex: 1 }}
                            />
                            <button type="button" onClick={() => removeMedicine(idx)} style={styles.removeBtn}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Lab Results Table (if lab report or items found) */}
                  <div style={styles.sectionBlock}>
                    <div style={styles.sectionHeader}>
                      <h4 style={styles.subHeading}>Laboratory Values & Tests</h4>
                      <button type="button" onClick={addLabResult} style={styles.addBtn}>+ Add Test Result</button>
                    </div>
                    {(!formData.lab_results || formData.lab_results.length === 0) ? (
                      <p style={styles.emptyNote}>No laboratory values automatically detected.</p>
                    ) : (
                      <div style={styles.listContainer}>
                        {formData.lab_results.map((l, idx) => (
                          <div key={idx} style={styles.listItem}>
                            <input
                              type="text"
                              value={l.test_name}
                              placeholder="Test Name"
                              onChange={(e) => handleLabResultChange(idx, 'test_name', e.target.value)}
                              style={{ ...styles.input, flex: 2 }}
                            />
                            <input
                              type="text"
                              value={l.result_value}
                              placeholder="Value"
                              onChange={(e) => handleLabResultChange(idx, 'result_value', e.target.value)}
                              style={{ ...styles.input, flex: 1 }}
                            />
                            <input
                              type="text"
                              value={l.unit || ''}
                              placeholder="Unit"
                              onChange={(e) => handleLabResultChange(idx, 'unit', e.target.value)}
                              style={{ ...styles.input, flex: 1 }}
                            />
                            <input
                              type="text"
                              value={l.reference_range || ''}
                              placeholder="Ref Range"
                              onChange={(e) => handleLabResultChange(idx, 'reference_range', e.target.value)}
                              style={{ ...styles.input, flex: 1 }}
                            />
                            <button type="button" onClick={() => removeLabResult(idx)} style={styles.removeBtn}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Follow-up / Clinical Notes */}
                  <div style={styles.fieldRow}>
                    <label style={styles.label}>Follow-up Instructions / Notes</label>
                    <textarea
                      value={String(formData.follow_up_instructions || '')}
                      onChange={(e) => handleFieldChange('follow_up_instructions', e.target.value)}
                      rows={2}
                      style={styles.textarea}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'raw' && (
                <div style={styles.rawTextContainer}>
                  <p style={styles.rawHelp}>Extracted textual content from engine (read-only):</p>
                  <pre style={styles.rawText}>
                    {extraction?.extracted_text || 'No text extracted for this document.'}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div style={styles.actions}>
              <button
                type="button"
                onClick={handleRetryOCR}
                style={styles.retryBtn}
                disabled={isSaving}
              >
                🔄 Reprocess OCR
              </button>
              <div style={{ flex: 1 }} />
              <button
                type="button"
                onClick={() => handleSave(false)}
                style={styles.saveDraftBtn}
                disabled={isSaving}
              >
                Save Review In Progress
              </button>
              <button
                type="button"
                onClick={() => handleSave(true)}
                style={styles.confirmBtn}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : '✓ Confirm & Approve'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '1rem',
  },
  modal: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    maxWidth: '1200px',
    width: '95vw',
    height: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '1.25rem 1.75rem',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#f9fafb',
  },
  categoryBadge: {
    display: 'inline-block',
    fontSize: '0.75rem',
    fontWeight: 700,
    color: '#0369a1',
    backgroundColor: '#e0f2fe',
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    marginBottom: '0.25rem',
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#111827',
    margin: '0 0 0.25rem 0',
  },
  subTitle: {
    fontSize: '0.85rem',
    color: '#6b7280',
    margin: 0,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '1.75rem',
    cursor: 'pointer',
    color: '#6b7280',
  },
  warningBanner: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    padding: '0.75rem 1.75rem',
    fontSize: '0.875rem',
    borderBottom: '1px solid #fde68a',
  },
  errorBanner: {
    backgroundColor: '#fee2e2',
    color: '#b91c1c',
    padding: '0.75rem 1.75rem',
    fontSize: '0.875rem',
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    flex: 1,
    overflow: 'hidden',
  },
  leftCol: {
    borderRight: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#f3f4f6',
  },
  colHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.75rem 1.25rem',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#ffffff',
  },
  sectionHeading: {
    fontSize: '0.9rem',
    fontWeight: 600,
    color: '#374151',
    margin: 0,
  },
  openExternalLink: {
    fontSize: '0.8rem',
    color: '#0284c7',
    textDecoration: 'none',
    fontWeight: 500,
  },
  viewerContainer: {
    flex: 1,
    padding: '1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'auto',
  },
  iframe: {
    width: '100%',
    height: '100%',
    border: 'none',
    borderRadius: '8px',
    backgroundColor: '#ffffff',
  },
  imagePreview: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
    borderRadius: '8px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  },
  rightCol: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#ffffff',
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid #e5e7eb',
    padding: '0 1rem',
    backgroundColor: '#f9fafb',
  },
  tab: {
    padding: '0.75rem 1rem',
    border: 'none',
    background: 'none',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: '#6b7280',
    cursor: 'pointer',
  },
  activeTab: {
    padding: '0.75rem 1rem',
    border: 'none',
    borderBottom: '2px solid #0284c7',
    background: 'none',
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#0284c7',
    cursor: 'pointer',
  },
  provenanceBar: {
    display: 'flex',
    gap: '1.5rem',
    fontSize: '0.75rem',
    padding: '0.5rem 1.25rem',
    backgroundColor: '#f0fdf4',
    borderBottom: '1px solid #dcfce7',
    color: '#166534',
  },
  formScroll: {
    flex: 1,
    overflowY: 'auto',
    padding: '1.25rem',
  },
  formFields: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  fieldRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  fieldRowTwo: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1rem',
  },
  label: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#4b5563',
  },
  input: {
    padding: '0.5rem 0.75rem',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    fontSize: '0.875rem',
  },
  textarea: {
    padding: '0.5rem 0.75rem',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    fontSize: '0.875rem',
    fontFamily: 'inherit',
  },
  sectionBlock: {
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '0.875rem',
    backgroundColor: '#f9fafb',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem',
  },
  subHeading: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#111827',
    margin: 0,
  },
  addBtn: {
    fontSize: '0.75rem',
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
    border: '1px solid #0284c7',
    backgroundColor: '#e0f2fe',
    color: '#0284c7',
    cursor: 'pointer',
    fontWeight: 600,
  },
  emptyNote: {
    fontSize: '0.8rem',
    color: '#9ca3af',
    fontStyle: 'italic',
    margin: 0,
  },
  listContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  listItem: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center',
  },
  removeBtn: {
    background: '#fee2e2',
    color: '#b91c1c',
    border: 'none',
    borderRadius: '4px',
    padding: '0.4rem 0.6rem',
    cursor: 'pointer',
    fontWeight: 700,
  },
  rawTextContainer: {
    padding: '0.5rem',
  },
  rawHelp: {
    fontSize: '0.8rem',
    color: '#6b7280',
    marginBottom: '0.5rem',
  },
  rawText: {
    backgroundColor: '#1f2937',
    color: '#f9fafb',
    padding: '1rem',
    borderRadius: '6px',
    fontSize: '0.8rem',
    whiteSpace: 'pre-wrap',
    maxHeight: '400px',
    overflowY: 'auto',
  },
  actions: {
    display: 'flex',
    gap: '0.75rem',
    padding: '1rem 1.25rem',
    borderTop: '1px solid #e5e7eb',
    backgroundColor: '#ffffff',
  },
  retryBtn: {
    padding: '0.5rem 1rem',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    backgroundColor: '#ffffff',
    color: '#374151',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 500,
  },
  saveDraftBtn: {
    padding: '0.5rem 1.25rem',
    borderRadius: '6px',
    border: '1px solid #0284c7',
    backgroundColor: '#ffffff',
    color: '#0284c7',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
  },
  confirmBtn: {
    padding: '0.5rem 1.25rem',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: '#059669',
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
  },
};
