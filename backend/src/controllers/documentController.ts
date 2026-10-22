/**
 * backend/src/controllers/documentController.ts
 *
 * Request handlers for document upload, listing, search, view, review, and deletion.
 * Enforces patient and family workspace authorization rules.
 */

import { Request, Response, NextFunction } from 'express';
import { documentService } from '../services/documentService.js';
import { db } from '../repositories/database.js';
import { createError } from '../middlewares/errorHandler.js';
import {
  uploadDocumentMetadataSchema,
  updateDocumentMetadataSchema,
  saveReviewSchema,
} from '../validators/schemas.js';
import { DocumentCategory, DocumentProcessingStatus, DocumentReviewStatus, StructuredMedicalFields } from '../types/models.js';

export async function uploadDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      return next(createError('Authentication required.', 401));
    }
    const rawFamilyId = req.params['familyId'];
    if (!rawFamilyId || Array.isArray(rawFamilyId)) {
      return next(createError('Family ID parameter required.', 400));
    }
    const familyId = String(rawFamilyId);

    if (!req.file) {
      return next(createError('No file provided in request. Please attach a file.', 400));
    }

    const validated = uploadDocumentMetadataSchema.parse(req.body);
    const { patientProfileId, category, title, documentDate } = validated;
    const bypassDuplicate = req.body.bypassDuplicate === 'true' || req.body.bypassDuplicate === true;

    const result = await documentService.uploadDocument({
      familyId,
      patientProfileId,
      userId: req.user.id,
      category,
      title,
      documentDate,
      fileBuffer: req.file.buffer,
      originalFilename: req.file.originalname,
      mimeType: req.file.mimetype,
      bypassDuplicate,
    });

    if (result.isDuplicateWarning) {
      res.status(409).json({
        status: 'duplicate_warning',
        message: 'A duplicate file with the exact same content already exists for this patient.',
        existingDocument: result.existingDocument,
      });
      return;
    }

    res.status(201).json({
      status: 'success',
      data: result.document,
    });
  } catch (err) {
    next(err);
  }
}

export async function listDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawFamilyId = req.params['familyId'];
    if (!rawFamilyId || Array.isArray(rawFamilyId)) {
      return next(createError('Family ID parameter required.', 400));
    }
    const familyId = String(rawFamilyId);

    const { patientProfileId, category, processingStatus, reviewStatus, query, startDate, endDate } = req.query;

    const documents = await documentService.listDocuments(familyId, {
      patientProfileId: patientProfileId ? String(patientProfileId) : undefined,
      category: category ? (String(category) as DocumentCategory) : undefined,
      processingStatus: processingStatus ? (String(processingStatus) as DocumentProcessingStatus) : undefined,
      reviewStatus: reviewStatus ? (String(reviewStatus) as DocumentReviewStatus) : undefined,
      query: query ? String(query) : undefined,
      startDate: startDate ? String(startDate) : undefined,
      endDate: endDate ? String(endDate) : undefined,
    });

    res.status(200).json({
      status: 'success',
      data: documents,
    });
  } catch (err) {
    next(err);
  }
}

export async function getDocumentDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawDocId = req.params['documentId'];
    if (!rawDocId || Array.isArray(rawDocId)) return next(createError('Document ID required.', 400));
    const documentId = String(rawDocId);

    const details = await documentService.getDocumentDetails(documentId);

    // Cross-check that user has family membership
    if (req.user) {
      const membership = await db.getUserMembership(details.document.family_id, req.user.id);
      if (!membership || membership.status !== 'active') {
        return next(createError('Access denied to this document.', 403));
      }
    }

    res.status(200).json({
      status: 'success',
      data: details,
    });
  } catch (err) {
    next(err);
  }
}

export async function getDocumentFile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawDocId = req.params['documentId'];
    if (!rawDocId || Array.isArray(rawDocId)) return next(createError('Document ID required.', 400));
    const documentId = String(rawDocId);

    const details = await documentService.getDocumentDetails(documentId);

    if (req.user) {
      const membership = await db.getUserMembership(details.document.family_id, req.user.id);
      if (!membership || membership.status !== 'active') {
        return next(createError('Access denied to this document.', 403));
      }
    }

    const { buffer, document } = await documentService.getFileBuffer(documentId);

    res.setHeader('Content-Type', document.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(document.original_filename)}"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

export async function getSignedFileUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawDocId = req.params['documentId'];
    if (!rawDocId || Array.isArray(rawDocId)) return next(createError('Document ID required.', 400));
    const documentId = String(rawDocId);

    const details = await documentService.getDocumentDetails(documentId);

    if (req.user) {
      const membership = await db.getUserMembership(details.document.family_id, req.user.id);
      if (!membership || membership.status !== 'active') {
        return next(createError('Access denied to this document.', 403));
      }
    }

    const { url } = await documentService.getSecureFileAccess(documentId);

    res.status(200).json({
      status: 'success',
      data: { url },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateDocumentMetadata(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawDocId = req.params['documentId'];
    if (!rawDocId || Array.isArray(rawDocId)) return next(createError('Document ID required.', 400));
    const documentId = String(rawDocId);

    const details = await documentService.getDocumentDetails(documentId);
    if (req.user) {
      const membership = await db.getUserMembership(details.document.family_id, req.user.id);
      if (!membership || membership.status !== 'active') {
        return next(createError('Access denied to this document.', 403));
      }
    }

    const validated = updateDocumentMetadataSchema.parse(req.body);

    const updated = await documentService.updateMetadata(documentId, validated);
    res.status(200).json({
      status: 'success',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

export async function retryDocumentExtraction(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawDocId = req.params['documentId'];
    if (!rawDocId || Array.isArray(rawDocId)) return next(createError('Document ID required.', 400));
    const documentId = String(rawDocId);

    const details = await documentService.getDocumentDetails(documentId);
    if (req.user) {
      const membership = await db.getUserMembership(details.document.family_id, req.user.id);
      if (!membership || membership.status !== 'active') {
        return next(createError('Access denied to this document.', 403));
      }
    }

    const job = await documentService.retryExtraction(documentId);
    res.status(200).json({
      status: 'success',
      message: 'Document reprocessing job queued',
      data: job,
    });
  } catch (err) {
    next(err);
  }
}

export async function saveDocumentReview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return next(createError('Authentication required.', 401));

    const rawDocId = req.params['documentId'];
    if (!rawDocId || Array.isArray(rawDocId)) return next(createError('Document ID required.', 400));
    const documentId = String(rawDocId);

    const details = await documentService.getDocumentDetails(documentId);
    const membership = await db.getUserMembership(details.document.family_id, req.user.id);
    if (!membership || membership.status !== 'active') {
      return next(createError('Access denied to this document.', 403));
    }

    const validated = saveReviewSchema.parse(req.body);
    const { confirmedFields, markConfirmed } = validated;

    const result = await documentService.saveReview({
      documentId,
      userId: req.user.id,
      confirmedFields: confirmedFields as StructuredMedicalFields,
      markConfirmed: Boolean(markConfirmed),
    });

    res.status(200).json({
      status: 'success',
      message: markConfirmed ? 'Medical document review confirmed' : 'Review progress saved',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return next(createError('Authentication required.', 401));

    const rawDocId = req.params['documentId'];
    if (!rawDocId || Array.isArray(rawDocId)) return next(createError('Document ID required.', 400));
    const documentId = String(rawDocId);

    const details = await documentService.getDocumentDetails(documentId);
    const membership = await db.getUserMembership(details.document.family_id, req.user.id);
    if (!membership || !['owner', 'adult', 'guardian'].includes(membership.role)) {
      return next(createError('Access denied. Only owners, adults, or guardians can delete documents.', 403));
    }

    await documentService.deleteDocument(documentId);

    res.status(200).json({
      status: 'success',
      message: 'Document and associated data permanently deleted.',
    });
  } catch (err) {
    next(err);
  }
}
