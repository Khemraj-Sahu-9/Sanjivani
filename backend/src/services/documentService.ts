/**
 * backend/src/services/documentService.ts
 *
 * Business logic for medical document management, private storage,
 * duplicate detection, OCR job dispatch, and human review confirmation.
 */

import crypto from 'crypto';
import { db, DocumentSearchFilters } from '../repositories/database.js';
import { storageProvider } from '../integrations/storage/storageService.js';
import { ocrProvider } from '../integrations/ocr/ocrService.js';
import { logger } from '../config/logger.js';
import { createError } from '../middlewares/errorHandler.js';
import {
  HealthDocument,
  DocumentCategory,
  DocumentExtraction,
  DocumentProcessingJob,
  StructuredMedicalFields,
} from '../types/models.js';

const STORAGE_BUCKET = 'medical-records';

export class DocumentService {
  /**
   * Calculates SHA-256 checksum of a buffer.
   */
  calculateChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Uploads and saves a medical document against an authorized patient.
   */
  async uploadDocument(params: {
    familyId: string;
    patientProfileId: string;
    userId: string;
    category: DocumentCategory;
    title: string;
    documentDate?: string | null;
    fileBuffer: Buffer;
    originalFilename: string;
    mimeType: string;
    bypassDuplicate?: boolean;
  }): Promise<{
    document: HealthDocument;
    isDuplicateWarning?: boolean;
    existingDocument?: HealthDocument;
  }> {
    const {
      familyId,
      patientProfileId,
      userId,
      category,
      title,
      documentDate,
      fileBuffer,
      originalFilename,
      mimeType,
      bypassDuplicate,
    } = params;

    // 1. Verify patient belongs to family
    const patient = await db.getPatientProfileById(patientProfileId);
    if (!patient || patient.family_id !== familyId) {
      throw createError('Patient profile not found in this family workspace.', 404);
    }

    // 2. Validate file size and mime types
    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedMimes.includes(mimeType)) {
      throw createError(`Unsupported file type: ${mimeType}. Allowed formats: PDF, JPEG, PNG, WebP.`, 400);
    }

    const MAX_SIZE = 25 * 1024 * 1024; // 25 MB
    if (fileBuffer.length > MAX_SIZE) {
      throw createError('File exceeds the maximum allowed size of 25MB.', 413);
    }

    // 3. Duplicate Detection via SHA-256
    const checksum = this.calculateChecksum(fileBuffer);
    const existingDuplicates = await db.findDocumentsByChecksum(patientProfileId, checksum);

    if (existingDuplicates.length > 0 && !bypassDuplicate) {
      return {
        document: existingDuplicates[0]!,
        isDuplicateWarning: true,
        existingDocument: existingDuplicates[0],
      };
    }

    // 4. Safe storage object key generation
    const sanitizedExt = originalFilename.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'bin';
    const storageKey = `patients/${patientProfileId}/${Date.now()}_${crypto.randomUUID()}.${sanitizedExt}`;

    // 5. Store file in private object storage
    await storageProvider.uploadFile({
      bucket: STORAGE_BUCKET,
      path: storageKey,
      fileBuffer,
      contentType: mimeType,
    });

    // 6. Create database record
    const document = await db.createDocument({
      family_id: familyId,
      patient_profile_id: patientProfileId,
      title: title.trim(),
      category,
      document_date: documentDate || null,
      original_filename: originalFilename,
      storage_path: storageKey,
      mime_type: mimeType,
      file_size_bytes: fileBuffer.length,
      file_checksum: checksum,
      processing_status: 'queued',
      review_status: 'needs_review',
      created_by: userId,
    });

    // 7. Create background processing job & run async
    const job = await db.createProcessingJob({
      document_id: document.id,
      job_type: 'ocr_and_extract',
      status: 'queued',
      attempt_count: 0,
      max_attempts: 3,
    });

    // Fire off async processing without blocking response
    this.runProcessingJob(job.id, document.id, fileBuffer, mimeType, originalFilename).catch((err) => {
      logger.error(`[DocumentService] Async processing error for document ${document.id}: ${err.message}`);
    });

    return { document };
  }

  /**
   * Processes a document (OCR or PDF Text extraction) and proposes structured fields.
   */
  async runProcessingJob(
    jobId: string,
    documentId: string,
    fileBuffer: Buffer,
    mimeType: string,
    originalFilename: string
  ): Promise<void> {
    try {
      await db.updateProcessingJob(jobId, {
        status: 'processing',
        started_at: new Date().toISOString(),
        attempt_count: 1,
      });

      await db.updateDocument(documentId, { processing_status: 'processing' });

      // Run real OCR / text extraction engine
      const extractionResult = await ocrProvider.extractTextAndStructure({
        fileBuffer,
        mimeType,
        originalFilename,
      });

      // Save extraction results with source provenance
      await db.upsertExtraction({
        document_id: documentId,
        extraction_version: 1,
        extracted_text: extractionResult.rawText,
        extraction_method: extractionResult.method,
        ocr_provider: extractionResult.provider,
        confidence: extractionResult.confidence ?? null,
        proposed_fields: extractionResult.proposedFields,
        confirmed_fields: {},
        extraction_status: extractionResult.status,
        error_classification: extractionResult.errorClassification ?? null,
        reviewed_by: null,
        reviewed_at: null,
      });

      // Update processing job and document status
      await db.updateProcessingJob(jobId, {
        status: 'completed',
        completed_at: new Date().toISOString(),
      });

      await db.updateDocument(documentId, {
        processing_status: 'extracted',
        document_date: extractionResult.proposedFields.document_date
          ? extractionResult.proposedFields.document_date
          : undefined,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`[DocumentService] Extraction job ${jobId} failed: ${errorMsg}`);

      await db.updateProcessingJob(jobId, {
        status: 'failed',
        last_error: errorMsg,
        completed_at: new Date().toISOString(),
      });

      await db.updateDocument(documentId, { processing_status: 'failed' });
    }
  }

  /**
   * Retries extraction for an existing document.
   */
  async retryExtraction(documentId: string): Promise<DocumentProcessingJob> {
    const doc = await db.getDocumentById(documentId);
    if (!doc) throw createError('Document not found.', 404);

    const fileBuffer = await storageProvider.downloadFile(STORAGE_BUCKET, doc.storage_path);

    const job = await db.createProcessingJob({
      document_id: documentId,
      job_type: 'reprocess',
      status: 'queued',
      attempt_count: 0,
      max_attempts: 3,
    });

    this.runProcessingJob(job.id, documentId, fileBuffer, doc.mime_type, doc.original_filename).catch((err) => {
      logger.error(`[DocumentService] Retry processing error for document ${documentId}: ${err.message}`);
    });

    return job;
  }

  /**
   * Saves human review corrections and optionally confirms extraction.
   */
  async saveReview(params: {
    documentId: string;
    userId: string;
    confirmedFields: StructuredMedicalFields;
    markConfirmed?: boolean;
  }): Promise<{ extraction: DocumentExtraction; document: HealthDocument }> {
    const { documentId, userId, confirmedFields, markConfirmed } = params;

    const doc = await db.getDocumentById(documentId);
    if (!doc) throw createError('Document not found.', 404);

    const existingExtraction = await db.getExtractionByDocumentId(documentId);

    const updatedExtraction = await db.upsertExtraction({
      document_id: documentId,
      extraction_version: (existingExtraction?.extraction_version || 0) + 1,
      extracted_text: existingExtraction?.extracted_text || '',
      extraction_method: existingExtraction?.extraction_method || 'manual',
      ocr_provider: existingExtraction?.ocr_provider || 'manual',
      confidence: existingExtraction?.confidence || null,
      proposed_fields: existingExtraction?.proposed_fields || {},
      confirmed_fields: confirmedFields,
      extraction_status: 'completed',
      error_classification: null,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    });

    const newReviewStatus = markConfirmed ? 'confirmed' : 'in_review';
    const updatedDocument = await db.updateDocument(documentId, {
      review_status: newReviewStatus,
      document_date: confirmedFields.document_date ? String(confirmedFields.document_date) : doc.document_date,
      title: confirmedFields.report_title ? String(confirmedFields.report_title) : doc.title,
    });

    return { extraction: updatedExtraction, document: updatedDocument };
  }

  /**
   * Generates a secure, short-lived signed access URL or serves file buffer.
   */
  async getSecureFileAccess(documentId: string): Promise<{
    url: string;
    document: HealthDocument;
    buffer?: Buffer;
  }> {
    const doc = await db.getDocumentById(documentId);
    if (!doc) throw createError('Document not found.', 404);

    const signedUrl = await storageProvider.getSignedUrl(STORAGE_BUCKET, doc.storage_path, 300);
    return { url: signedUrl, document: doc };
  }

  /**
   * Retrieves raw file buffer for internal streaming.
   */
  async getFileBuffer(documentId: string): Promise<{ buffer: Buffer; document: HealthDocument }> {
    const doc = await db.getDocumentById(documentId);
    if (!doc) throw createError('Document not found.', 404);

    const buffer = await storageProvider.downloadFile(STORAGE_BUCKET, doc.storage_path);
    return { buffer, document: doc };
  }

  /**
   * Lists documents in a family with search, filter, and pagination support.
   */
  async listDocuments(familyId: string, filters?: DocumentSearchFilters): Promise<HealthDocument[]> {
    return db.listFamilyDocuments(familyId, filters);
  }

  /**
   * Gets complete document details including extraction and job status.
   */
  async getDocumentDetails(documentId: string): Promise<{
    document: HealthDocument;
    extraction: DocumentExtraction | null;
    latestJob: DocumentProcessingJob | null;
  }> {
    const document = await db.getDocumentById(documentId);
    if (!document) throw createError('Document not found.', 404);

    const extraction = await db.getExtractionByDocumentId(documentId);
    const latestJob = await db.getProcessingJobByDocumentId(documentId);

    return { document, extraction, latestJob };
  }

  /**
   * Updates metadata (e.g. title, category, documentDate).
   */
  async updateMetadata(
    documentId: string,
    updates: { title?: string; category?: DocumentCategory; documentDate?: string | null }
  ): Promise<HealthDocument> {
    const doc = await db.getDocumentById(documentId);
    if (!doc) throw createError('Document not found.', 404);

    return db.updateDocument(documentId, {
      title: updates.title?.trim() ?? doc.title,
      category: updates.category ?? doc.category,
      document_date: updates.documentDate !== undefined ? updates.documentDate : doc.document_date,
    });
  }

  /**
   * Deletes document and cleans up object storage and records.
   */
  async deleteDocument(documentId: string): Promise<void> {
    const doc = await db.getDocumentById(documentId);
    if (!doc) throw createError('Document not found.', 404);

    try {
      await storageProvider.deleteFile(STORAGE_BUCKET, doc.storage_path);
    } catch (err) {
      logger.warn(`[DocumentService] Storage file delete warning for ${doc.storage_path}: ${err}`);
    }

    await db.deleteDocument(documentId);
  }
}

export const documentService = new DocumentService();
