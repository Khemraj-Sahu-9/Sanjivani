/**
 * backend/src/routes/documentRouter.ts
 *
 * Router for medical document operations.
 * Mounts under /api/families (or /api/documents) with strict auth & RBAC middleware.
 */

import { Router } from 'express';
import multer from 'multer';
import { requireAuth, requireFamilyRole } from '../middlewares/auth.js';
import * as documentController from '../controllers/documentController.js';

// Multer memory storage — safe in-memory buffering for virus check & fast transfer to private object store
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB
  },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Only PDF, JPEG, PNG, and WebP are supported.`));
    }
  },
});

export const documentRouter = Router({ mergeParams: true });

// Document library listing & search (any family member: owner, adult, caregiver, guardian)
documentRouter.get(
  '/',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  documentController.listDocuments
);

// Upload document (owner, adult, caregiver, guardian)
documentRouter.post(
  '/upload',
  requireAuth,
  requireFamilyRole(['owner', 'adult', 'caregiver', 'guardian']),
  upload.single('file'),
  documentController.uploadDocument
);

// Get document details & extraction
documentRouter.get('/details/:documentId', requireAuth, documentController.getDocumentDetails);

// Get signed URL for document
documentRouter.get('/signed-url/:documentId', requireAuth, documentController.getSignedFileUrl);

// Stream document file content securely
documentRouter.get('/file/:documentId', requireAuth, documentController.getDocumentFile);

// Update document metadata (title, category, date)
documentRouter.patch('/details/:documentId', requireAuth, documentController.updateDocumentMetadata);

// Retry document extraction/OCR
documentRouter.post('/retry/:documentId', requireAuth, documentController.retryDocumentExtraction);

// Save review corrections or confirm
documentRouter.post('/review/:documentId', requireAuth, documentController.saveDocumentReview);

// Delete document (owner, adult, guardian)
documentRouter.delete('/details/:documentId', requireAuth, documentController.deleteDocument);
