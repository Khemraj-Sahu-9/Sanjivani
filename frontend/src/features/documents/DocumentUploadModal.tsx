import React, { useState } from 'react';
import { DocumentCategory } from '../../types/document';
import { PatientProfile } from '../../types/auth';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: PatientProfile[];
  selectedPatientId?: string;
  onUpload: (data: {
    patientProfileId: string;
    category: DocumentCategory;
    title: string;
    documentDate?: string;
    file: File;
    bypassDuplicate?: boolean;
  }) => Promise<void>;
}

const CATEGORIES: { label: string; value: DocumentCategory }[] = [
  { label: 'Prescription', value: 'prescription' },
  { label: 'Laboratory Report', value: 'laboratory_report' },
  { label: 'Diagnostic Imaging Report', value: 'diagnostic_imaging_report' },
  { label: 'Discharge Summary', value: 'discharge_summary' },
  { label: 'Hospital Record', value: 'hospital_record' },
  { label: 'Vaccination Record', value: 'vaccination_record' },
  { label: 'Other Medical Document', value: 'other' },
];

export const DocumentUploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  patients,
  selectedPatientId,
  onUpload,
}) => {
  const [patientId, setPatientId] = useState<string>(selectedPatientId || patients[0]?.id || '');
  const [category, setCategory] = useState<DocumentCategory>('prescription');
  const [title, setTitle] = useState('');
  const [documentDate, setDocumentDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(selected.type)) {
      setError(`Unsupported file type: ${selected.type}. Only PDF, JPG, PNG, and WebP are allowed.`);
      setFile(null);
      return;
    }

    if (selected.size > 25 * 1024 * 1024) {
      setError('File size exceeds the 25MB maximum limit.');
      setFile(null);
      return;
    }

    setError(null);
    setFile(selected);
    if (!title) {
      // Pre-fill title without extension
      const nameWithoutExt = selected.name.replace(/\.[^/.]+$/, '');
      setTitle(nameWithoutExt);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file to upload.');
      return;
    }
    if (!patientId) {
      setError('Please select a patient profile.');
      return;
    }
    if (!title.trim()) {
      setError('Please enter a document title.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onUpload({
        patientProfileId: patientId,
        category,
        title: title.trim(),
        documentDate: documentDate || undefined,
        file,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h2 style={styles.heading}>Upload Medical Document</h2>
          <button onClick={onClose} style={styles.closeBtn}>×</button>
        </div>

        {error && <div style={styles.errorBanner}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Patient Profile *</label>
            <select
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              style={styles.select}
              required
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} ({p.health_id})
                </option>
              ))}
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Document Category *</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as DocumentCategory)}
              style={styles.select}
              required
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Document Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Dr. Mehta Cardiology Prescription"
              style={styles.input}
              required
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Document Date (Optional)</label>
            <input
              type="date"
              value={documentDate}
              onChange={(e) => setDocumentDate(e.target.value)}
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Choose File (PDF, PNG, JPG, WebP — Max 25MB) *</label>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              onChange={handleFileChange}
              style={styles.fileInput}
              required
            />
            {file && (
              <p style={styles.fileInfo}>
                Selected: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <div style={styles.actions}>
            <button type="button" onClick={onClose} style={styles.cancelBtn} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" style={styles.submitBtn} disabled={isSubmitting}>
              {isSubmitting ? 'Uploading & Queuing OCR...' : 'Upload & Process'}
            </button>
          </div>
        </form>
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
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '1rem',
  },
  modal: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    maxWidth: '520px',
    width: '100%',
    padding: '1.75rem',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.25rem',
  },
  heading: {
    fontSize: '1.35rem',
    fontWeight: 700,
    color: '#111827',
    margin: 0,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '1.5rem',
    cursor: 'pointer',
    color: '#6b7280',
  },
  errorBanner: {
    backgroundColor: '#fee2e2',
    color: '#b91c1c',
    padding: '0.75rem',
    borderRadius: '6px',
    fontSize: '0.875rem',
    marginBottom: '1rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },
  label: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#374151',
  },
  input: {
    padding: '0.625rem 0.85rem',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    fontSize: '0.9rem',
  },
  select: {
    padding: '0.625rem 0.85rem',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    fontSize: '0.9rem',
    backgroundColor: '#ffffff',
  },
  fileInput: {
    fontSize: '0.875rem',
  },
  fileInfo: {
    fontSize: '0.8rem',
    color: '#059669',
    marginTop: '0.25rem',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
    marginTop: '1rem',
  },
  cancelBtn: {
    padding: '0.625rem 1.25rem',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    backgroundColor: '#ffffff',
    color: '#374151',
    cursor: 'pointer',
    fontWeight: 500,
  },
  submitBtn: {
    padding: '0.625rem 1.25rem',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: '#0284c7',
    color: '#ffffff',
    cursor: 'pointer',
    fontWeight: 600,
  },
};
