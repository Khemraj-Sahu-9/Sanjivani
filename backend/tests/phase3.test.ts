/**
 * backend/tests/phase3.test.ts
 *
 * Comprehensive Automated Test Suite for Phase 3:
 * 1. AI Health Memory Conversational Interface & Grounding
 * 2. Source Provenance & Document Citations
 * 3. Handling Missing Information & Medical Uncertainty
 * 4. Multi-Turn Conversation Persistence
 * 5. Chronological Medical History Timeline Generation
 * 6. Laboratory Results Trend Series & Normalization
 * 7. Doctor-Ready PDF Summary Preview & Binary Generation
 * 8. Security & Patient-Level Cross-Family Isolation
 */

import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { app } from '../src/app.js';

const request = supertest(app);

describe('Phase 3 — AI Health Memory, Medical History Timeline & Doctor-Ready PDF Summary', () => {
  let user1Token: string;
  let user2Token: string;
  let family1Id: string;
  let family2Id: string;
  let patient1Id: string;
  let patient2Id: string;
  let labDocId: string;
  let rxDocId: string;

  beforeAll(async () => {
    // 1. Setup User 1 & Family 1
    const reg1 = await request.post('/api/auth/register').send({
      email: 'phase3_user1@example.com',
      password: 'password123',
      fullName: 'Phase 3 Caretaker User',
    });
    user1Token = reg1.body.data.token;

    const fam1 = await request
      .post('/api/families')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ name: 'Phase 3 Sharma Family' });
    family1Id = fam1.body.data.family.id;

    // Create Patient 1 (Elderly Mother)
    const pat1 = await request
      .post(`/api/families/${family1Id}/patients`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        fullName: 'Kaveri Sharma',
        category: 'elderly',
        dateOfBirth: '1952-04-12',
        gender: 'female',
        relationshipToCreator: 'Mother',
      });
    patient1Id = pat1.body.data.profile.id;

    // 2. Setup User 2 & Family 2 for Cross-Tenant Isolation Tests
    const reg2 = await request.post('/api/auth/register').send({
      email: 'phase3_user2@example.com',
      password: 'password123',
      fullName: 'Phase 3 Other Family User',
    });
    user2Token = reg2.body.data.token;

    const fam2 = await request
      .post('/api/families')
      .set('Authorization', `Bearer ${user2Token}`)
      .send({ name: 'Phase 3 Patel Family' });
    family2Id = fam2.body.data.family.id;

    const pat2 = await request
      .post(`/api/families/${family2Id}/patients`)
      .set('Authorization', `Bearer ${user2Token}`)
      .send({
        fullName: 'Aarav Patel',
        category: 'adult',
        gender: 'male',
      });
    patient2Id = pat2.body.data.profile.id;

    // 3. Upload a sample Lab Report for Patient 1
    const sampleLabCsv = Buffer.from('Blood Sugar Fasting: 112 mg/dL\nHbA1c: 6.8 %\nHemoglobin: 13.5 g/dL', 'utf-8');
    const labUpload = await request
      .post(`/api/families/${family1Id}/documents/upload`)
      .set('Authorization', `Bearer ${user1Token}`)
      .field('patientProfileId', patient1Id)
      .field('category', 'laboratory_report')
      .field('title', 'Comprehensive Metabolic Panel')
      .field('documentDate', '2026-03-10')
      .attach('file', sampleLabCsv, { filename: 'lab_report_march.png', contentType: 'image/png' });

    expect(labUpload.status).toBe(201);
    labDocId = labUpload.body.data.id;

    // Confirm the lab document extraction
    const labConfirmRes = await request
      .post(`/api/families/documents/review/${labDocId}`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        confirmedFields: {
          doctor_name: 'Dr. A. Verma',
          patient_name: 'Kaveri Sharma',
          document_date: '2026-03-10',
          report_title: 'Comprehensive Metabolic Panel',
          lab_results: [
            {
              test_name: 'Fasting Blood Sugar',
              result_value: '112',
              unit: 'mg/dL',
              reference_range: '70-100 mg/dL',
              interpretation: 'Borderline Elevated',
            },
            {
              test_name: 'HbA1c',
              result_value: '6.8',
              unit: '%',
              reference_range: '< 5.7 %',
              interpretation: 'Pre-diabetic Range',
            },
          ],
        },
        markConfirmed: true,
      });
    expect(labConfirmRes.status).toBe(200);

    // 4. Upload a sample Prescription for Patient 1
    const sampleRxText = Buffer.from('Rx: Metformin 500mg once daily\nAllergies: Penicillin, Sulfa drugs', 'utf-8');
    const rxUpload = await request
      .post(`/api/families/${family1Id}/documents/upload`)
      .set('Authorization', `Bearer ${user1Token}`)
      .field('patientProfileId', patient1Id)
      .field('category', 'prescription')
      .field('title', 'Endocrine Clinic Consultation')
      .field('documentDate', '2026-03-15')
      .attach('file', sampleRxText, { filename: 'prescription_march.png', contentType: 'image/png' });

    expect(rxUpload.status).toBe(201);
    rxDocId = rxUpload.body.data.id;

    // Confirm prescription document extraction
    const rxConfirmRes = await request
      .post(`/api/families/documents/review/${rxDocId}`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        confirmedFields: {
          doctor_name: 'Dr. Sen',
          patient_name: 'Kaveri Sharma',
          document_date: '2026-03-15',
          report_title: 'Endocrine Clinic Consultation',
          medicines: [
            {
              name: 'Metformin',
              dosage: '500mg',
              frequency: 'Once Daily',
              instructions: 'After dinner with water',
            },
          ],
          allergies: ['Penicillin', 'Sulfa drugs'],
        },
        markConfirmed: true,
      });
    expect(rxConfirmRes.status).toBe(200);
  });

  describe('1. AI Health Memory Conversational Q&A & Evidence Grounding', () => {
    it('answers queries grounded in confirmed lab records and cites sources', async () => {
      const res = await request
        .post(`/api/families/${family1Id}/memory/ask`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          patientProfileId: patient1Id,
          question: 'What was my last blood sugar reading?',
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toBeDefined();

      const { answer, sources, isGrounded, conversationId } = res.body.data;
      expect(typeof answer).toBe('string');
      expect(answer.length).toBeGreaterThan(10);
      expect(isGrounded).toBe(true);
      expect(conversationId).toBeDefined();

      // Answer should mention 112 or blood sugar
      expect(answer).toMatch(/112|blood sugar|mg\/dL/i);

      // Must have cited sources
      expect(Array.isArray(sources)).toBe(true);
      expect(sources.length).toBeGreaterThan(0);
      expect(sources[0].documentId).toBe(labDocId);
      expect(sources[0].documentTitle).toBe('Comprehensive Metabolic Panel');
      expect(sources[0].isVerified).toBe(true);
    });

    it('answers medication and prescription inquiries with exact details', async () => {
      const res = await request
        .post(`/api/families/${family1Id}/memory/ask`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          patientProfileId: patient1Id,
          question: 'What prescribed medicines am I currently taking?',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.isGrounded).toBe(true);
      expect(res.body.data.answer).toMatch(/Metformin/i);
      expect(res.body.data.sources[0].documentId).toBe(rxDocId);
    });

    it('identifies documented patient allergies with source citations', async () => {
      const res = await request
        .post(`/api/families/${family1Id}/memory/ask`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          patientProfileId: patient1Id,
          question: 'Are there any known allergies recorded?',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.isGrounded).toBe(true);
      expect(res.body.data.answer).toMatch(/Penicillin|Sulfa/i);
    });

    it('honestly states when information is missing instead of fabricating data', async () => {
      const res = await request
        .post(`/api/families/${family1Id}/memory/ask`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          patientProfileId: patient1Id,
          question: 'When did I have an appendectomy surgery?',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.answer).toMatch(/not found|no record|no mentions|unable to find/i);
    });

    it('persists multi-turn conversations under the patient profile', async () => {
      // First turn
      const turn1 = await request
        .post(`/api/families/${family1Id}/memory/ask`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          patientProfileId: patient1Id,
          question: 'Can you summarize my recent test results?',
        });

      expect(turn1.status).toBe(200);
      const convId = turn1.body.data.conversationId;

      // Second turn using same conversationId
      const turn2 = await request
        .post(`/api/families/${family1Id}/memory/ask`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          patientProfileId: patient1Id,
          conversationId: convId,
          question: 'What about my HbA1c specifically?',
        });

      expect(turn2.status).toBe(200);
      expect(turn2.body.data.conversationId).toBe(convId);
      expect(turn2.body.data.answer).toMatch(/6\.8|HbA1c/i);

      // Verify conversation history endpoint
      const listConvs = await request
        .get(`/api/families/${family1Id}/memory/patients/${patientProfileId(patient1Id)}/conversations`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(listConvs.status).toBe(200);
      expect(Array.isArray(listConvs.body.data)).toBe(true);
      expect(listConvs.body.data.some((c: any) => c.id === convId)).toBe(true);
    });
  });

  describe('2. Patient-Specific Chronological Medical History Timeline', () => {
    it('compiles chronological timeline events from uploaded medical records', async () => {
      const res = await request
        .get(`/api/families/${family1Id}/memory/patients/${patient1Id}/timeline`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data)).toBe(true);

      const timeline = res.body.data;
      expect(timeline.length).toBeGreaterThanOrEqual(2);

      // Verify timeline sorting (newest first: 2026-03-15 before 2026-03-10)
      const eventDates = timeline.map((e: any) => e.date);
      expect(new Date(eventDates[0]).getTime()).toBeGreaterThanOrEqual(new Date(eventDates[1]).getTime());

      // Verify event structure
      const rxEvent = timeline.find((e: any) => e.documentId === rxDocId);
      expect(rxEvent).toBeDefined();
      expect(rxEvent.eventType).toBe('prescription');
      expect(rxEvent.isVerified).toBe(true);
      expect(rxEvent.title).toBe('Endocrine Clinic Consultation');
    });
  });

  describe('3. Historical Laboratory Result Trends', () => {
    it('aggregates quantitative lab results into trend series with units and ranges', async () => {
      const res = await request
        .get(`/api/families/${family1Id}/memory/patients/${patient1Id}/lab-trends`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data)).toBe(true);

      const series = res.body.data;
      expect(series.length).toBeGreaterThan(0);

      const fbs = series.find((s: any) => /blood sugar/i.test(s.testName));
      expect(fbs).toBeDefined();
      expect(fbs.unit).toBe('mg/dL');
      expect(fbs.dataPoints.length).toBeGreaterThanOrEqual(1);
      expect(fbs.dataPoints[0].value).toBe(112);
      expect(fbs.dataPoints[0].referenceRange).toBe('70-100 mg/dL');
      expect(fbs.dataPoints[0].isVerified).toBe(true);
    });
  });

  describe('4. Doctor-Ready PDF Summary Preview & Generation', () => {
    it('previews doctor summary selection before generating report', async () => {
      const res = await request
        .post(`/api/families/${family1Id}/memory/doctor-summary/preview`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          patientProfileId: patient1Id,
          title: 'Cardiology Pre-Op Consultation Summary',
          doctorName: 'Dr. R. K. Sen',
          notes: 'Evaluated for routine health checkup',
          selectedDocumentIds: [labDocId, rxDocId],
          includedSections: ['patient_info', 'medical_history', 'allergies', 'lab_results', 'prescriptions'],
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.patient.id).toBe(patient1Id);
      expect(res.body.data.selectedDocs.length).toBe(2);
      expect(res.body.data.includedSections).toContain('allergies');
    });

    it('generates real downloadable binary PDF health summary', async () => {
      const res = await request
        .post(`/api/families/${family1Id}/memory/doctor-summary/pdf`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          patientProfileId: patient1Id,
          title: 'Clinical Visit Dossier',
          doctorName: 'Dr. Sen, Apollo Hospital',
          notes: 'Annual follow-up review for chronic management',
          selectedDocumentIds: [labDocId, rxDocId],
          includedSections: ['patient_info', 'medical_history', 'allergies', 'lab_results', 'prescriptions', 'source_documents'],
        });

      expect(res.status).toBe(200);
      expect(res.header['content-type']).toMatch(/application\/pdf/i);
      expect(res.header['content-disposition']).toMatch(/attachment/i);

      // Verify PDF binary signature (%PDF-)
      const pdfBuffer = Buffer.isBuffer(res.body) ? res.body : Buffer.from(res.text, 'binary');
      expect(pdfBuffer.slice(0, 4).toString()).toBe('%PDF');
      expect(pdfBuffer.length).toBeGreaterThan(500); // Realistic multi-page PDF size
    });

    it('rejects PDF generation when patient does not belong to family workspace', async () => {
      const res = await request
        .post(`/api/families/${family1Id}/memory/doctor-summary/pdf`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          patientProfileId: patient2Id, // belongs to family 2
          selectedDocumentIds: [labDocId],
          includedSections: ['patient_info'],
        });

      expect(res.status).toBe(404);
    });
  });

  describe('5. Security, Authorization Boundaries & Cross-Family Isolation', () => {
    it('prevents user from another family from querying patient AI memory', async () => {
      const res = await request
        .post(`/api/families/${family1Id}/memory/ask`)
        .set('Authorization', `Bearer ${user2Token}`) // User 2 trying to query Family 1
        .send({
          patientProfileId: patient1Id,
          question: 'What medications is Kaveri Sharma taking?',
        });

      expect(res.status).toBe(403);
    });

    it('prevents user from another family from viewing patient timeline', async () => {
      const res = await request
        .get(`/api/families/${family1Id}/memory/patients/${patient1Id}/timeline`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.status).toBe(403);
    });

    it('prevents user from another family from viewing patient lab trends', async () => {
      const res = await request
        .get(`/api/families/${family1Id}/memory/patients/${patient1Id}/lab-trends`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.status).toBe(403);
    });
  });
});

function patientProfileId(id: string) {
  return id;
}
