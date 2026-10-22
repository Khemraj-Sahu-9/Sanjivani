/**
 * backend/src/integrations/ocr/ocrService.ts
 *
 * Implements real OCR and digital document text extraction.
 * - Extracts digital selectable text from PDFs via `pdf-parse/lib/pdf-parse.js`.
 * - Runs OCR on scanned documents/images via `tesseract.js`.
 * - Emits genuine extraction results without fabricating mock data.
 */

// Import directly from lib/pdf-parse.js to avoid the root debug file execution in pdf-parse
// @ts-expect-error pdf-parse/lib/pdf-parse.js does not have discrete types
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { createWorker } from 'tesseract.js';
import { logger } from '../../config/logger.js';
import { IOCRProvider, OCRExtractionInput, OCRExtractionResult } from './types.js';
import { parseMedicalText } from './medicalExtractor.js';

export class LocalOCRProvider implements IOCRProvider {
  async extractTextAndStructure(input: OCRExtractionInput): Promise<OCRExtractionResult> {
    const { fileBuffer, mimeType, originalFilename } = input;
    logger.info(`[OCR] Starting extraction for ${originalFilename} (${mimeType}, ${fileBuffer.length} bytes)`);

    try {
      // 1. Digital PDF Text Extraction
      if (mimeType === 'application/pdf') {
        const pdfData = await pdfParse(fileBuffer);
        const text = (pdfData.text || '').trim();

        if (text.length > 20) {
          logger.info(`[OCR] Successfully extracted selectable text from PDF (${text.length} chars)`);
          const proposed = parseMedicalText(text);
          return {
            rawText: text,
            method: 'pdf_text_parser',
            provider: 'pdf-parse',
            confidence: 95.0,
            proposedFields: proposed,
            status: 'completed',
          };
        }
        // If PDF has no text or very short text, flag empty/scanned
        logger.warn(`[OCR] PDF contains no extractable digital text. File may be scanned.`);
        return {
          rawText: text,
          method: 'pdf_text_parser',
          provider: 'pdf-parse',
          confidence: text.length > 0 ? 50.0 : 0.0,
          proposedFields: parseMedicalText(text),
          status: text.length > 0 ? 'completed' : 'empty',
          errorClassification: text.length === 0 ? 'scanned_pdf_needs_raster_ocr' : undefined,
        };
      }

      // 2. Image OCR (PNG, JPEG, WebP) via Tesseract.js
      if (['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(mimeType)) {
        logger.info(`[OCR] Running Tesseract OCR on image buffer...`);
        const worker = await createWorker('eng');
        const ret = await worker.recognize(fileBuffer);
        await worker.terminate();

        const text = (ret.data.text || '').trim();
        const confidence = typeof ret.data.confidence === 'number' ? Math.round(ret.data.confidence * 100) / 100 : undefined;
        logger.info(`[OCR] Tesseract completed with confidence: ${confidence}% (${text.length} chars)`);

        const proposed = parseMedicalText(text);
        return {
          rawText: text,
          method: 'tesseract_ocr',
          provider: 'tesseract.js',
          confidence,
          proposedFields: proposed,
          status: text.length > 0 ? 'completed' : 'empty',
          errorClassification: text.length === 0 ? 'no_text_recognized' : undefined,
        };
      }

      return {
        rawText: '',
        method: 'manual',
        provider: 'none',
        proposedFields: {},
        status: 'failed',
        errorClassification: `unsupported_mime_type: ${mimeType}`,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`[OCR] Document extraction failed: ${errorMsg}`);
      return {
        rawText: '',
        method: 'manual',
        provider: 'local',
        proposedFields: {},
        status: 'failed',
        errorClassification: errorMsg,
      };
    }
  }
}

export const ocrProvider: IOCRProvider = new LocalOCRProvider();
