/**
 * backend/src/controllers/healthMemoryController.ts
 *
 * Controllers for AI Health Memory, Chronological Timeline,
 * Laboratory Trend Analysis, and Doctor-Ready PDF Summary generation.
 */

import { Request, Response, NextFunction } from 'express';
import { healthMemoryService } from '../services/healthMemoryService.js';
import { db } from '../repositories/database.js';
import { createError } from '../middlewares/errorHandler.js';
import { askMemorySchema, doctorSummaryOptionsSchema } from '../validators/schemas.js';

export async function askHealthMemory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return next(createError('Authentication required.', 401));

    const rawFamilyId = req.params['familyId'];
    if (!rawFamilyId || Array.isArray(rawFamilyId)) {
      return next(createError('Family ID parameter required.', 400));
    }
    const familyId = String(rawFamilyId);

    const validated = askMemorySchema.parse(req.body);
    const { patientProfileId, question, conversationId } = validated;

    const result = await healthMemoryService.askHealthMemory({
      familyId,
      patientProfileId,
      userId: req.user.id,
      question,
      conversationId,
    });

    res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function getPatientTimeline(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawFamilyId = req.params['familyId'];
    const rawPatientId = req.params['patientProfileId'];
    if (!rawFamilyId || !rawPatientId) {
      return next(createError('Family ID and Patient Profile ID required.', 400));
    }
    const familyId = String(rawFamilyId);
    const patientProfileId = String(rawPatientId);

    const timeline = await healthMemoryService.getPatientTimeline(familyId, patientProfileId);

    res.status(200).json({
      status: 'success',
      data: timeline,
    });
  } catch (err) {
    next(err);
  }
}

export async function getLaboratoryTrends(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawFamilyId = req.params['familyId'];
    const rawPatientId = req.params['patientProfileId'];
    if (!rawFamilyId || !rawPatientId) {
      return next(createError('Family ID and Patient Profile ID required.', 400));
    }
    const familyId = String(rawFamilyId);
    const patientProfileId = String(rawPatientId);

    const trends = await healthMemoryService.getLaboratoryTrends(familyId, patientProfileId);

    res.status(200).json({
      status: 'success',
      data: trends,
    });
  } catch (err) {
    next(err);
  }
}

export async function generateDoctorSummaryPdf(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return next(createError('Authentication required.', 401));

    const rawFamilyId = req.params['familyId'];
    if (!rawFamilyId || Array.isArray(rawFamilyId)) {
      return next(createError('Family ID parameter required.', 400));
    }
    const familyId = String(rawFamilyId);

    const validated = doctorSummaryOptionsSchema.parse(req.body);

    const patient = await db.getPatientProfileById(validated.patientProfileId);
    if (!patient || patient.family_id !== familyId) {
      return next(createError('Patient profile not found in this family workspace.', 404));
    }

    const { pdfBuffer, summaryRecord } = await healthMemoryService.generateDoctorSummaryPdf(
      familyId,
      req.user.id,
      validated
    );

    const safeTitle = (summaryRecord.title || 'health_summary').replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}_${Date.now()}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
}

export async function previewDoctorSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawFamilyId = req.params['familyId'];
    if (!rawFamilyId || Array.isArray(rawFamilyId)) {
      return next(createError('Family ID parameter required.', 400));
    }
    const familyId = String(rawFamilyId);

    const validated = doctorSummaryOptionsSchema.parse(req.body);
    const { patientProfileId, selectedDocumentIds, includedSections } = validated;

    const patient = await db.getPatientProfileById(patientProfileId);
    if (!patient || patient.family_id !== familyId) {
      return next(createError('Patient profile not found in this family workspace.', 404));
    }

    const selectedDocs = [];
    for (const docId of selectedDocumentIds) {
      const doc = await db.getDocumentById(docId);
      if (doc && doc.patient_profile_id === patientProfileId && doc.family_id === familyId) {
        const ext = await db.getExtractionByDocumentId(doc.id);
        selectedDocs.push({
          document: doc,
          extraction: ext,
        });
      }
    }

    res.status(200).json({
      status: 'success',
      data: {
        patient,
        selectedDocs,
        includedSections,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function listPatientConversations(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawPatientId = req.params['patientProfileId'];
    if (!rawPatientId) return next(createError('Patient Profile ID required.', 400));
    const patientProfileId = String(rawPatientId);

    const convs = await db.listPatientConversations(patientProfileId);
    res.status(200).json({
      status: 'success',
      data: convs,
    });
  } catch (err) {
    next(err);
  }
}

export async function getConversationMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawConvId = req.params['conversationId'];
    if (!rawConvId) return next(createError('Conversation ID required.', 400));
    const conversationId = String(rawConvId);

    const messages = await db.getConversationMessages(conversationId);
    res.status(200).json({
      status: 'success',
      data: messages,
    });
  } catch (err) {
    next(err);
  }
}
