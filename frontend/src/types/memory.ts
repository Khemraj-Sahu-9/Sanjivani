/**
 * frontend/src/types/memory.ts
 *
 * Types for Phase 3: AI Health Memory, Grounding, Timeline, Lab Trends, and Doctor Summary.
 */

import { DocumentCategory } from './document';

export interface GroundedSourceReference {
  documentId: string;
  documentTitle: string;
  category: DocumentCategory;
  documentDate?: string | null;
  field?: string;
  snippet?: string;
  isVerified: boolean;
}

export interface AIMemoryQueryResponse {
  answer: string;
  sources: GroundedSourceReference[];
  isGrounded: boolean;
  confidenceNote?: string;
  conversationId: string;
}

export interface TimelineEvent {
  id: string;
  eventType: 'document_uploaded' | 'prescription' | 'lab_report' | 'hospital_visit' | 'imaging' | 'vaccination' | 'other';
  date: string;
  isDateConfirmed: boolean;
  title: string;
  description: string;
  documentId: string;
  category: DocumentCategory;
  isVerified: boolean;
  highlights?: string[];
}

export interface LabResultDataPoint {
  id: string;
  testName: string;
  normalizedTestName: string;
  value: number;
  rawResultValue: string;
  unit: string;
  referenceRange?: string;
  date: string;
  documentId: string;
  documentTitle: string;
  isVerified: boolean;
}

export interface LabTrendSeries {
  testName: string;
  unit: string;
  dataPoints: LabResultDataPoint[];
}

export type SummarySectionType =
  | 'patient_info'
  | 'medical_history'
  | 'allergies'
  | 'lab_results'
  | 'prescriptions'
  | 'source_documents';

export interface DoctorSummaryOptions {
  patientProfileId: string;
  title?: string;
  selectedDocumentIds: string[];
  includedSections: SummarySectionType[];
  doctorName?: string;
  notes?: string;
}
