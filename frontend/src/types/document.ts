/**
 * frontend/src/types/document.ts
 *
 * Types for Phase 2 medical documents, extractions, and review.
 */

export type DocumentCategory =
  | 'prescription'
  | 'laboratory_report'
  | 'diagnostic_imaging_report'
  | 'discharge_summary'
  | 'hospital_record'
  | 'vaccination_record'
  | 'other';

export type DocumentProcessingStatus =
  | 'uploaded'
  | 'queued'
  | 'processing'
  | 'extracted'
  | 'failed';

export type DocumentReviewStatus =
  | 'needs_review'
  | 'in_review'
  | 'confirmed'
  | 'rejected';

export type ExtractionMethod =
  | 'pdf_text_parser'
  | 'tesseract_ocr'
  | 'hybrid'
  | 'manual';

export interface HealthDocument {
  id: string;
  family_id: string;
  patient_profile_id: string;
  title: string;
  category: DocumentCategory;
  document_date?: string | null;
  original_filename: string;
  storage_path: string;
  mime_type: string;
  file_size_bytes: number;
  file_checksum: string;
  processing_status: DocumentProcessingStatus;
  review_status: DocumentReviewStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PrescriptionMedicineField {
  name: string;
  dosage?: string;
  strength?: string;
  route?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
}

export interface LabResultField {
  test_name: string;
  result_value: string;
  unit?: string;
  reference_range?: string;
  interpretation?: string;
}

export interface StructuredMedicalFields {
  patient_name?: string;
  document_type?: string;
  document_date?: string;
  doctor_name?: string;
  facility_name?: string;
  report_title?: string;
  follow_up_instructions?: string;
  allergies?: string[];
  clinical_notes?: string;
  medicines?: PrescriptionMedicineField[];
  lab_results?: LabResultField[];
  [key: string]: unknown;
}

export interface DocumentExtraction {
  id: string;
  document_id: string;
  extraction_version: number;
  extracted_text: string;
  extraction_method: ExtractionMethod;
  ocr_provider: string;
  confidence?: number | null;
  proposed_fields: StructuredMedicalFields;
  confirmed_fields: StructuredMedicalFields;
  extraction_status: 'completed' | 'failed' | 'empty';
  error_classification?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentProcessingJob {
  id: string;
  document_id: string;
  job_type: 'ocr_and_extract' | 'pdf_text_extract' | 'reprocess';
  status: 'queued' | 'processing' | 'completed' | 'failed';
  attempt_count: number;
  max_attempts: number;
  last_error?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentDetailsResponse {
  document: HealthDocument;
  extraction: DocumentExtraction | null;
  latestJob: DocumentProcessingJob | null;
}
