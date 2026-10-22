/**
 * backend/src/services/healthMemoryService.ts
 *
 * Business logic orchestrating:
 * 1. AI Health Memory Conversational Q&A grounded in authorized records.
 * 2. Patient Medical History Timeline generation.
 * 3. Laboratory Trend series extraction.
 * 4. Doctor-Ready PDF Summary compilation.
 */

import PDFDocument from 'pdfkit';
import { db } from '../repositories/database.js';
import { createError } from '../middlewares/errorHandler.js';
import { groundedAIService } from '../integrations/ai/aiService.js';
import { RetrievedDocumentEvidence } from '../integrations/ai/types.js';
import {
  AIMemoryQueryResponse,
  TimelineEvent,
  LabTrendSeries,
  DoctorSummaryOptions,
  DoctorSummaryRecord,
  PatientProfile,
  HealthDocument,
  DocumentExtraction,
} from '../types/models.js';

export class HealthMemoryService {
  /**
   * Evaluates user query and retrieves authorized grounded evidence.
   */
  async askHealthMemory(params: {
    familyId: string;
    patientProfileId: string;
    userId: string;
    question: string;
    conversationId?: string;
  }): Promise<AIMemoryQueryResponse & { conversationId: string }> {
    const { familyId, patientProfileId, userId, question, conversationId } = params;

    // 1. Verify patient belongs to family
    const patient = await db.getPatientProfileById(patientProfileId);
    if (!patient || patient.family_id !== familyId) {
      throw createError('Patient profile not found in this family workspace.', 404);
    }

    // 2. Retrieve all documents belonging to this patient
    const docs = await db.listFamilyDocuments(familyId, { patientProfileId });

    // 3. Assemble authorized evidence with extractions
    const evidenceList: RetrievedDocumentEvidence[] = [];
    for (const doc of docs) {
      const ext = await db.getExtractionByDocumentId(doc.id);
      const isVerified = doc.review_status === 'confirmed';
      const activeFields = isVerified ? ext?.confirmed_fields : (ext?.proposed_fields || {});

      evidenceList.push({
        documentId: doc.id,
        title: doc.title,
        category: doc.category,
        documentDate: doc.document_date,
        isVerified,
        medicines: (activeFields?.medicines || activeFields?.prescription_medicines) as any,
        labResults: (activeFields?.lab_results || activeFields?.laboratory_results) as any,
        allergies: activeFields?.allergies,
        doctorName: activeFields?.doctor_name,
        facilityName: activeFields?.facility_name,
        extractedTextSnippet: ext?.extracted_text ? ext.extracted_text.substring(0, 1500) : undefined,
      });
    }

    // 4. Generate grounded answer
    const aiResponse = await groundedAIService.generateGroundedAnswer({
      question,
      patientName: patient.full_name,
      evidence: evidenceList,
    });

    // 5. Persist conversation and messages if needed
    let activeConvId = conversationId;
    if (!activeConvId) {
      const conv = await db.createConversation({
        family_id: familyId,
        patient_profile_id: patientProfileId,
        user_id: userId,
        title: question.length > 40 ? `${question.substring(0, 40)}...` : question,
      });
      activeConvId = conv.id;
    }

    await db.createMessage({
      conversation_id: activeConvId,
      sender: 'user',
      content: question,
      sources: [],
      is_grounded: true,
    });

    await db.createMessage({
      conversation_id: activeConvId,
      sender: 'assistant',
      content: aiResponse.answer,
      sources: aiResponse.sources,
      is_grounded: aiResponse.isGrounded,
    });

    return {
      ...aiResponse,
      conversationId: activeConvId,
    };
  }

  /**
   * Builds chronological medical history timeline for authorized patient.
   */
  async getPatientTimeline(familyId: string, patientProfileId: string): Promise<TimelineEvent[]> {
    const patient = await db.getPatientProfileById(patientProfileId);
    if (!patient || patient.family_id !== familyId) {
      throw createError('Patient profile not found in this family workspace.', 404);
    }

    const docs = await db.listFamilyDocuments(familyId, { patientProfileId });
    const timeline: TimelineEvent[] = [];

    for (const doc of docs) {
      const ext = await db.getExtractionByDocumentId(doc.id);
      const isVerified = doc.review_status === 'confirmed';
      const eventDate = doc.document_date || doc.created_at.split('T')[0]!;
      const isDateConfirmed = Boolean(doc.document_date);

      let eventType: TimelineEvent['eventType'] = 'other';
      if (doc.category === 'prescription') eventType = 'prescription';
      else if (doc.category === 'laboratory_report') eventType = 'lab_report';
      else if (doc.category === 'hospital_record' || doc.category === 'discharge_summary') eventType = 'hospital_visit';
      else if (doc.category === 'diagnostic_imaging_report') eventType = 'imaging';
      else if (doc.category === 'vaccination_record') eventType = 'vaccination';

      const highlights: string[] = [];
      const fields = isVerified ? ext?.confirmed_fields : ext?.proposed_fields;
      if (fields?.doctor_name) highlights.push(`Doctor: ${fields.doctor_name}`);
      if (fields?.facility_name) highlights.push(`Facility: ${fields.facility_name}`);
      if (fields?.medicines && fields.medicines.length > 0) {
        highlights.push(`Meds: ${fields.medicines.map((m) => m.name).join(', ')}`);
      }
      if (fields?.lab_results && fields.lab_results.length > 0) {
        highlights.push(`Tests: ${fields.lab_results.slice(0, 3).map((l) => `${l.test_name}: ${l.result_value} ${l.unit || ''}`).join(', ')}`);
      }

      timeline.push({
        id: doc.id,
        eventType,
        date: eventDate,
        isDateConfirmed,
        title: doc.title,
        description: `${doc.category.replace(/_/g, ' ')} • ${doc.original_filename}`,
        documentId: doc.id,
        category: doc.category,
        isVerified,
        highlights,
      });
    }

    // Sort chronologically descending
    return timeline.sort((a, b) => b.date.localeCompare(a.date));
  }

  /**
   * Extracts compatible laboratory test historical trend series.
   */
  async getLaboratoryTrends(familyId: string, patientProfileId: string): Promise<LabTrendSeries[]> {
    const patient = await db.getPatientProfileById(patientProfileId);
    if (!patient || patient.family_id !== familyId) {
      throw createError('Patient profile not found in this family workspace.', 404);
    }

    const docs = await db.listFamilyDocuments(familyId, { patientProfileId });
    const seriesMap = new Map<string, { unit: string; points: LabTrendSeries['dataPoints'] }>();

    for (const doc of docs) {
      const ext = await db.getExtractionByDocumentId(doc.id);
      const isVerified = doc.review_status === 'confirmed';
      const fields = isVerified ? ext?.confirmed_fields : ext?.proposed_fields;
      const docDate = doc.document_date || doc.created_at.split('T')[0]!;

      for (const lab of fields?.lab_results || []) {
        const cleanVal = parseFloat(lab.result_value.replace(/[^0-9.]/g, ''));
        if (isNaN(cleanVal)) continue;

        // Normalize test name (e.g. "Hemoglobin (Hb)" -> "Hemoglobin")
        const normalized = lab.test_name.trim().toLowerCase()
          .replace(/\s*\([^)]*\)/g, '')
          .replace(/[-:]/g, ' ')
          .replace(/\s+/g, ' ');

        const unit = (lab.unit || '').trim().toLowerCase();
        const groupKey = `${normalized}__${unit}`;

        if (!seriesMap.has(groupKey)) {
          seriesMap.set(groupKey, { unit: lab.unit || '', points: [] });
        }

        seriesMap.get(groupKey)!.points.push({
          id: `${doc.id}_${lab.test_name}`,
          testName: lab.test_name,
          normalizedTestName: normalized,
          value: cleanVal,
          rawResultValue: lab.result_value,
          unit: lab.unit || '',
          referenceRange: lab.reference_range,
          date: docDate,
          documentId: doc.id,
          documentTitle: doc.title,
          isVerified,
        });
      }
    }

    const result: LabTrendSeries[] = [];
    for (const [, val] of seriesMap.entries()) {
      if (val.points.length > 0) {
        val.points.sort((a, b) => a.date.localeCompare(b.date));
        result.push({
          testName: val.points[0]!.testName,
          unit: val.unit,
          dataPoints: val.points,
        });
      }
    }

    return result.sort((a, b) => b.dataPoints.length - a.dataPoints.length);
  }

  /**
   * Generates a downloadable Doctor-Ready Health Summary PDF.
   */
  async generateDoctorSummaryPdf(
    familyId: string,
    userId: string,
    options: DoctorSummaryOptions
  ): Promise<{ pdfBuffer: Buffer; summaryRecord: DoctorSummaryRecord }> {
    const { patientProfileId, selectedDocumentIds, includedSections, doctorName, notes, title } = options;

    const patient = await db.getPatientProfileById(patientProfileId);
    if (!patient || patient.family_id !== familyId) {
      throw createError('Patient profile not found in this family workspace.', 404);
    }

    // Retrieve requested documents
    const selectedDocs: HealthDocument[] = [];
    const extractions: Map<string, DocumentExtraction | null> = new Map();

    for (const docId of selectedDocumentIds) {
      const doc = await db.getDocumentById(docId);
      if (doc && doc.patient_profile_id === patientProfileId && doc.family_id === familyId) {
        selectedDocs.push(doc);
        const ext = await db.getExtractionByDocumentId(doc.id);
        extractions.set(doc.id, ext);
      }
    }

    // Build PDF Document in memory using pdfkit
    const pdfBuffer = await this.renderPdfkitSummary({
      patient,
      selectedDocs,
      extractions,
      includedSections,
      doctorName,
      notes,
      title: title || 'Patient Health Summary',
    });

    const summaryRecord = await db.recordDoctorSummary({
      family_id: familyId,
      patient_profile_id: patientProfileId,
      title: title || 'Patient Health Summary',
      selected_document_ids: selectedDocumentIds,
      included_sections: includedSections,
      doctor_name: doctorName || null,
      notes: notes || null,
      generated_by: userId,
      file_size_bytes: pdfBuffer.length,
    });

    return { pdfBuffer, summaryRecord };
  }

  /**
   * PDFKit stream renderer producing structured multi-page medical summaries.
   */
  private renderPdfkitSummary(data: {
    patient: PatientProfile;
    selectedDocs: HealthDocument[];
    extractions: Map<string, DocumentExtraction | null>;
    includedSections: string[];
    doctorName?: string;
    notes?: string;
    title: string;
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 45, size: 'A4' });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const { patient, selectedDocs, extractions, includedSections, doctorName, notes, title } = data;

      // 1. Header Banner
      doc.rect(45, 45, 505, 55).fill('#0284c7');
      doc.fillColor('#ffffff').fontSize(16).font('Helvetica-Bold').text('SANJIVANI HEALTH MEMORY', 60, 55);
      doc.fontSize(10).font('Helvetica').text(title || 'Doctor-Ready Medical Summary Report', 60, 78);
      doc.fontSize(9).text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 380, 78, { width: 160, align: 'right' });

      doc.moveDown(2);
      doc.fillColor('#111827');

      // 2. Patient Identity Box
      doc.rect(45, 115, 505, 75).stroke('#d1d5db');
      doc.fontSize(11).font('Helvetica-Bold').text('PATIENT IDENTIFIER', 55, 125);
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#0284c7').text(patient.full_name, 55, 140);
      doc.fillColor('#374151').fontSize(10).font('Helvetica');
      doc.text(`Health ID: ${patient.health_id}`, 55, 160);
      doc.text(`Category: ${patient.category.toUpperCase()}`, 250, 140);
      doc.text(`DOB: ${patient.date_of_birth || 'Not recorded'}`, 250, 160);
      doc.text(`Gender: ${patient.gender || 'Not specified'}`, 380, 140);
      if (doctorName) doc.text(`Prepared for: Dr. ${doctorName}`, 380, 160);

      doc.y = 205;

      // Doctor Notes
      if (notes) {
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#111827').text('APPOINTMENT / CLINICAL NOTES');
        doc.fontSize(9).font('Helvetica').fillColor('#4b5563').text(notes);
        doc.moveDown(1);
      }

      // 3. Documented Allergies
      if (includedSections.includes('allergies')) {
        const allergies: string[] = [];
        for (const d of selectedDocs) {
          const ext = extractions.get(d.id);
          const f = d.review_status === 'confirmed' ? ext?.confirmed_fields : ext?.proposed_fields;
          if (f?.allergies) allergies.push(...f.allergies);
        }
        const uniqueAllergies = Array.from(new Set(allergies));

        doc.fontSize(11).font('Helvetica-Bold').fillColor('#b91c1c').text('RECORDED ALLERGIES');
        if (uniqueAllergies.length > 0) {
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#b91c1c').text(uniqueAllergies.join(', '));
        } else {
          doc.fontSize(9).font('Helvetica').fillColor('#6b7280').text('No allergies documented in the selected reports.');
        }
        doc.moveDown(1);
      }

      // 4. Prescriptions & Medications
      if (includedSections.includes('prescriptions')) {
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#111827').text('PRESCRIBED MEDICINES (FROM HISTORICAL RECORDS)');
        doc.fontSize(8).font('Helvetica-Oblique').fillColor('#6b7280').text('*Note: Historical records list medicines prescribed on document date. Confirm active regimen with doctor.');

        let hasMeds = false;
        for (const d of selectedDocs) {
          const ext = extractions.get(d.id);
          const f = d.review_status === 'confirmed' ? ext?.confirmed_fields : ext?.proposed_fields;
          if (f?.medicines && f.medicines.length > 0) {
            hasMeds = true;
            doc.moveDown(0.5);
            doc.fontSize(9).font('Helvetica-Bold').fillColor('#111827').text(`From: ${d.title} (${d.document_date || 'Date unrecorded'})`);
            for (const m of f.medicines) {
              doc.fontSize(9).font('Helvetica').fillColor('#374151').text(`  • ${m.name} ${m.strength || ''} — Dosage: ${m.dosage || 'As directed'}`);
            }
          }
        }
        if (!hasMeds) {
          doc.fontSize(9).font('Helvetica').fillColor('#6b7280').text('No prescription medicines found in selected records.');
        }
        doc.moveDown(1);
      }

      // 5. Laboratory Results
      if (includedSections.includes('lab_results')) {
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#111827').text('LABORATORY TEST RESULTS');

        let hasLab = false;
        for (const d of selectedDocs) {
          const ext = extractions.get(d.id);
          const f = d.review_status === 'confirmed' ? ext?.confirmed_fields : ext?.proposed_fields;
          if (f?.lab_results && f.lab_results.length > 0) {
            hasLab = true;
            doc.moveDown(0.5);
            doc.fontSize(9).font('Helvetica-Bold').fillColor('#0284c7').text(`${d.title} (${d.document_date || 'Date unrecorded'})`);
            for (const l of f.lab_results) {
              const ref = l.reference_range ? ` [Ref: ${l.reference_range}]` : '';
              doc.fontSize(9).font('Helvetica').fillColor('#374151').text(`  • ${l.test_name}: ${l.result_value} ${l.unit || ''}${ref}`);
            }
          }
        }
        if (!hasLab) {
          doc.fontSize(9).font('Helvetica').fillColor('#6b7280').text('No laboratory results found in selected records.');
        }
        doc.moveDown(1);
      }

      // 6. Source Documents Table
      if (includedSections.includes('source_documents')) {
        doc.moveDown(0.5);
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#111827').text('SELECTED SOURCE DOCUMENTS & PROVENANCE');
        for (const d of selectedDocs) {
          const status = d.review_status === 'confirmed' ? '✓ CONFIRMED' : 'NEEDS REVIEW';
          doc.fontSize(8.5).font('Helvetica').fillColor('#4b5563').text(
            `• ${d.title} | ${d.category.replace(/_/g, ' ')} | Date: ${d.document_date || 'N/A'} | Status: ${status} | File: ${d.original_filename}`
          );
        }
      }

      // Disclaimer Footer
      doc.moveDown(2);
      doc.fontSize(8).font('Helvetica-Oblique').fillColor('#9ca3af').text(
        'DISCLAIMER: This medical summary is compiled from documents uploaded by the patient or family. It does not replace professional clinical evaluation, diagnosis, or direct physician assessment.',
        { align: 'center' }
      );

      doc.end();
    });
  }
}

export const healthMemoryService = new HealthMemoryService();
