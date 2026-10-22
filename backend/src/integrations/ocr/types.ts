/**
 * backend/src/integrations/ocr/types.ts
 *
 * Interfaces for OCR and document text extraction.
 * Enables clean swappability between local engines (pdf-parse, tesseract.js)
 * and cloud providers (Google Document AI / AWS Textract) in future phases.
 */

import { ExtractionMethod, StructuredMedicalFields } from '../../types/models.js';

export interface OCRExtractionInput {
  fileBuffer: Buffer;
  mimeType: string;
  originalFilename: string;
}

export interface OCRExtractionResult {
  rawText: string;
  method: ExtractionMethod;
  provider: string;
  confidence?: number;
  proposedFields: StructuredMedicalFields;
  status: 'completed' | 'failed' | 'empty';
  errorClassification?: string;
}

export interface IOCRProvider {
  extractTextAndStructure(input: OCRExtractionInput): Promise<OCRExtractionResult>;
}
