/**
 * backend/src/integrations/ai/types.ts
 *
 * Interfaces for AI Health Memory retrieval and response generation.
 * Swappable between live Google Gemini API and grounded deterministic engine.
 */

import { GroundedSourceReference } from '../../types/models.js';

export interface RetrievedDocumentEvidence {
  documentId: string;
  title: string;
  category: string;
  documentDate?: string | null;
  isVerified: boolean;
  medicines?: Array<{ name: string; dosage?: string; strength?: string }>;
  labResults?: Array<{ test_name: string; result_value: string; unit?: string; reference_range?: string }>;
  allergies?: string[];
  doctorName?: string;
  facilityName?: string;
  extractedTextSnippet?: string;
}

export interface AIRetrievalQueryInput {
  question: string;
  patientName: string;
  evidence: RetrievedDocumentEvidence[];
  conversationHistory?: Array<{ sender: 'user' | 'assistant'; text: string }>;
}

export interface AIRetrievalQueryResult {
  answer: string;
  sources: GroundedSourceReference[];
  isGrounded: boolean;
  confidenceNote?: string;
}

export interface IAIProvider {
  generateGroundedAnswer(input: AIRetrievalQueryInput): Promise<AIRetrievalQueryResult>;
}
