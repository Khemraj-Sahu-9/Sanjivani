/**
 * frontend/src/features/memory/DoctorSummaryModal.tsx
 *
 * Doctor-Ready PDF Summary generator & document selection workflow.
 * Allows family members to select relevant patient documents, choose sections to include,
 * preview the summary, and download an official doctor-ready PDF report.
 */

import React, { useState } from 'react';
import { PatientProfile } from '../../types/auth';
import { HealthDocument } from '../../types/document';
import { DoctorSummaryOptions, SummarySectionType } from '../../types/memory';
import { healthMemoryApiService } from '../../services/healthMemoryService';

interface DoctorSummaryModalProps {
  familyId: string;
  patient: PatientProfile;
  documents: HealthDocument[];
  isOpen: boolean;
  onClose: () => void;
}

const SECTION_LABELS: { id: SummarySectionType; label: string; desc: string }[] = [
  { id: 'patient_info', label: 'Patient Demographics & Health ID', desc: 'Age, gender, blood group, unique ID' },
  { id: 'medical_history', label: 'Medical History & Chronological Timeline', desc: 'Chronological events extracted from reports' },
  { id: 'allergies', label: 'Allergies & Critical Warnings', desc: 'Documented allergies & drug sensitivities' },
  { id: 'lab_results', label: 'Laboratory Results & Vitals', desc: 'Quantitative lab values, reference ranges, and test dates' },
  { id: 'prescriptions', label: 'Active & Historic Prescriptions', desc: 'Medication list extracted from prescriptions' },
  { id: 'source_documents', label: 'Document Provenance & Source List', desc: 'Audit trail of every supporting medical document' },
];

export const DoctorSummaryModal: React.FC<DoctorSummaryModalProps> = ({
  familyId,
  patient,
  documents,
  isOpen,
  onClose,
}) => {
  const [title, setTitle] = useState('Doctor Visit Health Summary');
  const [doctorName, setDoctorName] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>(
    documents.map((d) => d.id)
  );
  const [selectedSections, setSelectedSections] = useState<SummarySectionType[]>([
    'patient_info',
    'medical_history',
    'allergies',
    'lab_results',
    'prescriptions',
    'source_documents',
  ]);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewData, setPreviewData] = useState<{
    patient: any;
    selectedDocs: any[];
    includedSections: string[];
  } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleDoc = (id: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  const toggleAllDocs = () => {
    if (selectedDocIds.length === documents.length) {
      setSelectedDocIds([]);
    } else {
      setSelectedDocIds(documents.map((d) => d.id));
    }
  };

  const toggleSection = (section: SummarySectionType) => {
    setSelectedSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
  };

  const handlePreview = async () => {
    if (selectedDocIds.length === 0) {
      setError('Please select at least one medical document.');
      return;
    }
    setError(null);
    setIsGenerating(true);
    try {
      const options: DoctorSummaryOptions = {
        patientProfileId: patient.id,
        title,
        doctorName: doctorName || undefined,
        notes: notes || undefined,
        selectedDocumentIds: selectedDocIds,
        includedSections: selectedSections,
      };
      const res = await healthMemoryApiService.previewDoctorSummary(familyId, options);
      if (res.error) {
        setError(res.error);
      } else if (res.data) {
        setPreviewData(res.data);
        setIsPreviewing(true);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate preview');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (selectedDocIds.length === 0) {
      setError('Please select at least one medical document to generate PDF.');
      return;
    }
    setError(null);
    setIsGenerating(true);
    try {
      const options: DoctorSummaryOptions = {
        patientProfileId: patient.id,
        title,
        doctorName: doctorName || undefined,
        notes: notes || undefined,
        selectedDocumentIds: selectedDocIds,
        includedSections: selectedSections,
      };
      await healthMemoryApiService.downloadDoctorSummaryPdf(familyId, options);
    } catch (err: any) {
      setError(err.message || 'Failed to download PDF summary');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="summary-modal-title"
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-700 to-cyan-800 text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-2xl" aria-hidden="true">📄</span>
            <div>
              <h2 id="summary-modal-title" className="text-xl font-bold">
                Doctor-Ready Health Summary Generator
              </h2>
              <p className="text-xs text-teal-100">
                Patient: <span className="font-semibold">{patient.full_name}</span> ({patient.health_id})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 text-2xl font-semibold leading-none focus:outline-none"
            aria-label="Close generator"
          >
            &times;
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-start space-x-2">
              <span className="font-bold">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {isPreviewing && previewData ? (
            /* PREVIEW SCREEN */
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-emerald-900 text-base">Summary Document Preview</h3>
                  <span className="text-xs px-2 py-0.5 bg-emerald-200 text-emerald-800 font-semibold rounded">
                    Ready for PDF Export
                  </span>
                </div>
                <p className="text-xs text-emerald-800 mb-2">
                  The generated PDF will format the following verified medical data into a clean, multi-page clinical dossier.
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-700">
                  <div><strong>Report Title:</strong> {title}</div>
                  <div><strong>Doctor / Clinic:</strong> {doctorName || 'General Consultation'}</div>
                  <div><strong>Patient:</strong> {previewData.patient.full_name || previewData.patient.fullName} ({previewData.patient.health_id || previewData.patient.healthId})</div>
                  <div><strong>Documents Included:</strong> {previewData.selectedDocs.length} records</div>
                </div>
              </div>

              {/* Sections to be included */}
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                  Included Clinical Sections ({previewData.includedSections.length})
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {previewData.includedSections.map((sec) => (
                    <div key={sec} className="flex items-center space-x-2 text-xs text-gray-700">
                      <span className="text-teal-600 font-bold">✓</span>
                      <span className="capitalize">{sec.replace('_', ' ')}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Selected documents list */}
              <div className="border border-gray-200 rounded-lg p-4 bg-white">
                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                  Selected Source Documents
                </h4>
                <div className="max-h-44 overflow-y-auto divide-y divide-gray-100">
                  {previewData.selectedDocs.map((item: any) => {
                    const doc = item.document || item;
                    return (
                      <div key={doc.id} className="py-2 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-medium text-gray-900">{doc.title}</span>
                          <span className="ml-2 text-gray-500">({(doc.category || '').replace('_', ' ')})</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          {(doc.document_date || doc.documentDate) && (
                            <span className="text-gray-500">{doc.document_date || doc.documentDate}</span>
                          )}
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-700">
                            {doc.review_status || doc.reviewStatus}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => setIsPreviewing(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100"
                >
                  ← Back to Options
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={isGenerating}
                  className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-bold shadow-md hover:shadow transition disabled:opacity-50 flex items-center space-x-2"
                >
                  <span>📥</span>
                  <span>{isGenerating ? 'Generating PDF...' : 'Download Official PDF'}</span>
                </button>
              </div>
            </div>
          ) : (
            /* CONFIGURATION FORM */
            <div className="space-y-5">
              {/* Report Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="summary-title" className="block text-xs font-semibold text-gray-700 mb-1">
                    Summary Title
                  </label>
                  <input
                    id="summary-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Doctor Visit Health Summary"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="doctor-name" className="block text-xs font-semibold text-gray-700 mb-1">
                    Doctor / Clinic Name (Optional)
                  </label>
                  <input
                    id="doctor-name"
                    type="text"
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value)}
                    placeholder="e.g. Dr. A. Sharma / Apollo Clinic"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="summary-notes" className="block text-xs font-semibold text-gray-700 mb-1">
                  Visit Purpose / Clinical Notes (Optional)
                </label>
                <textarea
                  id="summary-notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Follow-up consultation for blood pressure and seasonal allergy review."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              {/* Sections to include */}
              <div>
                <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-2">
                  Sections to Include in PDF
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {SECTION_LABELS.map((sec) => (
                    <label
                      key={sec.id}
                      className={`flex items-start p-2.5 rounded-lg border cursor-pointer transition ${
                        selectedSections.includes(sec.id)
                          ? 'border-teal-500 bg-teal-50/50'
                          : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedSections.includes(sec.id)}
                        onChange={() => toggleSection(sec.id)}
                        className="mt-0.5 h-4 w-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500"
                      />
                      <div className="ml-2.5">
                        <div className="text-xs font-semibold text-gray-900">{sec.label}</div>
                        <div className="text-[11px] text-gray-500">{sec.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Medical Documents Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                    Select Medical Records ({selectedDocIds.length} of {documents.length} selected)
                  </label>
                  <button
                    type="button"
                    onClick={toggleAllDocs}
                    className="text-xs text-teal-700 hover:text-teal-900 font-semibold"
                  >
                    {selectedDocIds.length === documents.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                {documents.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-gray-300 rounded-lg text-gray-500 text-xs">
                    No medical documents uploaded for this patient yet.
                  </div>
                ) : (
                  <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100 bg-white">
                    {documents.map((doc) => {
                      const isSelected = selectedDocIds.includes(doc.id);
                      return (
                        <label
                          key={doc.id}
                          className={`flex items-center justify-between p-3 cursor-pointer hover:bg-teal-50/30 transition ${
                            isSelected ? 'bg-teal-50/20' : ''
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleDoc(doc.id)}
                              className="h-4 w-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500"
                            />
                            <div>
                              <div className="text-xs font-semibold text-gray-900">{doc.title}</div>
                              <div className="text-[11px] text-gray-500">
                                {doc.category.replace('_', ' ')} • {doc.original_filename}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-medium text-gray-600">
                              {doc.document_date || 'No date'}
                            </div>
                            <span
                              className={`inline-block text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                                doc.review_status === 'confirmed'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {doc.review_status}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end items-center space-x-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={isGenerating || selectedDocIds.length === 0}
                  className="px-4 py-2 bg-gray-100 text-gray-800 hover:bg-gray-200 rounded-lg text-sm font-semibold transition disabled:opacity-50"
                >
                  Preview Summary
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={isGenerating || selectedDocIds.length === 0}
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-bold shadow-md hover:shadow transition disabled:opacity-50 flex items-center space-x-2"
                >
                  <span>📥</span>
                  <span>{isGenerating ? 'Generating...' : 'Download PDF'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
