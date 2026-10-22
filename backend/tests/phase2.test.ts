/**
 * backend/tests/phase2.test.ts
 *
 * Comprehensive Automated Test Suite for Phase 2:
 * 1. Medical Document Upload & File Type / Size Validation
 * 2. Deduplication using SHA-256 Checksums
 * 3. Digital PDF Text Extraction & Image OCR Pipeline
 * 4. Structured Medical Field Extraction (Prescriptions, Lab Results, Allergies)
 * 5. Human Review, Edits, Discrepancies & Confirmation
 * 6. Document Search, Filters, and Timeline Retrieval
 * 7. Secure File Access & Streaming
 * 8. Patient-Level Authorization & Cross-Family Isolation
 * 9. Safe Document Deletion & Storage Cleanup
 */

import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { app } from '../src/app.js';
import { parseMedicalText } from '../src/integrations/ocr/medicalExtractor.js';

const request = supertest(app);

describe('Phase 2 — Medical Record Management, Secure Document Upload & OCR', () => {
  let user1Token: string;
  let user2Token: string;
  let family1Id: string;
  let family2Id: string;
  let patient1Id: string;
  let patient2Id: string;
  let uploadedDocId: string;

  beforeAll(async () => {
    // 1. Register User 1 & Create Family 1
    const reg1 = await request
      .post('/api/auth/register')
      .send({
        email: 'phase2_user1@example.com',
        password: 'password123',
        fullName: 'Phase 2 Test User 1',
      });
    user1Token = reg1.body.data.token;

    const fam1 = await request
      .post('/api/families')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ name: 'Phase 2 Family One' });
    family1Id = fam1.body.data.family.id;

    // Create Patient 1 in Family 1
    const pat1 = await request
      .post(`/api/families/${family1Id}/patients`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        fullName: 'Sita Sharma',
        category: 'elderly',
        dateOfBirth: '1955-06-15',
        gender: 'female',
        relationshipToCreator: 'Mother',
      });
    patient1Id = pat1.body.data.profile.id;

    // 2. Register User 2 (Isolated user in Family 2)
    const reg2 = await request
      .post('/api/auth/register')
      .send({
        email: 'phase2_user2@example.com',
        password: 'password123',
        fullName: 'Phase 2 Test User 2',
      });
    user2Token = reg2.body.data.token;

    const fam2 = await request
      .post('/api/families')
      .set('Authorization', `Bearer ${user2Token}`)
      .send({ name: 'Phase 2 Family Two' });
    family2Id = fam2.body.data.family.id;

    // Create Patient 2 in Family 2
    const pat2 = await request
      .post(`/api/families/${family2Id}/patients`)
      .set('Authorization', `Bearer ${user2Token}`)
      .send({
        fullName: 'Ravi Verma',
        category: 'adult',
        gender: 'male',
      });
    patient2Id = pat2.body.data.profile.id;
  });

  // ===========================================================================
  // 1. Medical Document Upload & Validation
  // ===========================================================================
  describe('1. Medical Document Upload & Validation', () => {
    it('uploads a valid medical document successfully and returns 201', async () => {
      const sampleText = Buffer.from('Dr. Rajesh Mehta\nPatient Name: Sita Sharma\nRx: Tab Paracetamol 500mg 1-0-1');

      const res = await request
        .post(`/api/families/${family1Id}/documents/upload`)
        .set('Authorization', `Bearer ${user1Token}`)
        .field('patientProfileId', patient1Id)
        .field('category', 'prescription')
        .field('title', 'Mehta Clinic Prescription')
        .field('documentDate', '2026-04-10')
        .attach('file', sampleText, { filename: 'prescription.png', contentType: 'image/png' });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.patient_profile_id).toBe(patient1Id);
      expect(res.body.data.category).toBe('prescription');
      expect(res.body.data.title).toBe('Mehta Clinic Prescription');
      expect(res.body.data.file_checksum).toBeDefined();
      expect(res.body.data.processing_status).toBe('queued');
      uploadedDocId = res.body.data.id;
    });

    it('rejects unsupported file formats with error status', async () => {
      const invalidFile = Buffer.from('some text');
      const res = await request
        .post(`/api/families/${family1Id}/documents/upload`)
        .set('Authorization', `Bearer ${user1Token}`)
        .field('patientProfileId', patient1Id)
        .field('category', 'other')
        .field('title', 'Executable Script')
        .attach('file', invalidFile, { filename: 'malicious.exe', contentType: 'application/x-msdownload' });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('rejects upload without attached file with 400', async () => {
      const res = await request
        .post(`/api/families/${family1Id}/documents/upload`)
        .set('Authorization', `Bearer ${user1Token}`)
        .field('patientProfileId', patient1Id)
        .field('category', 'prescription')
        .field('title', 'No File Document');

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/No file provided/i);
    });

    it('rejects upload for an invalid or non-existent patient profile', async () => {
      const sampleText = Buffer.from('test doc');
      const nonExistentPatient = '00000000-0000-0000-0000-000000000000';

      const res = await request
        .post(`/api/families/${family1Id}/documents/upload`)
        .set('Authorization', `Bearer ${user1Token}`)
        .field('patientProfileId', nonExistentPatient)
        .field('category', 'other')
        .field('title', 'Test Doc')
        .attach('file', sampleText, { filename: 'test.png', contentType: 'image/png' });

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/Patient profile not found in this family/i);
    });
  });

  // ===========================================================================
  // 2. Duplicate Detection
  // ===========================================================================
  describe('2. Duplicate Detection', () => {
    it('detects duplicate file upload with identical SHA-256 and returns 409 warning', async () => {
      const sampleText = Buffer.from('Dr. Rajesh Mehta\nPatient Name: Sita Sharma\nRx: Tab Paracetamol 500mg 1-0-1');

      const res = await request
        .post(`/api/families/${family1Id}/documents/upload`)
        .set('Authorization', `Bearer ${user1Token}`)
        .field('patientProfileId', patient1Id)
        .field('category', 'prescription')
        .field('title', 'Mehta Clinic Prescription Duplicate')
        .attach('file', sampleText, { filename: 'prescription_copy.png', contentType: 'image/png' });

      expect(res.status).toBe(409);
      expect(res.body.status).toBe('duplicate_warning');
      expect(res.body.existingDocument.id).toBe(uploadedDocId);
    });

    it('allows bypassing duplicate warning when bypassDuplicate flag is set', async () => {
      const sampleText = Buffer.from('Dr. Rajesh Mehta\nPatient Name: Sita Sharma\nRx: Tab Paracetamol 500mg 1-0-1');

      const res = await request
        .post(`/api/families/${family1Id}/documents/upload`)
        .set('Authorization', `Bearer ${user1Token}`)
        .field('patientProfileId', patient1Id)
        .field('category', 'prescription')
        .field('title', 'Intended Second Copy')
        .field('bypassDuplicate', 'true')
        .attach('file', sampleText, { filename: 'prescription_copy2.png', contentType: 'image/png' });

      expect(res.status).toBe(201);
      expect(res.body.data.id).not.toBe(uploadedDocId);
    });
  });

  // ===========================================================================
  // 3. OCR & Structured Medical Field Extraction
  // ===========================================================================
  describe('3. OCR & Structured Medical Field Extraction', () => {
    it('correctly parses doctor, patient, medicines and instructions from clinical text', () => {
      const sampleMedicalReport = `
        City Care Hospital
        Dr. Ananya Roy, MD
        Date: 2026-05-12
        Patient Name: Sita Sharma
        Age: 68
        Diagnosis: Hypertension

        Rx:
        Tab Telmisartan 40mg 1-0-0
        Cap Omeprazole 20mg 1-0-0
        Tab Paracetamol 650mg 1-0-1

        Allergies: Penicillin, Sulfa drugs
        Follow-up: 2 weeks
      `;

      const structured = parseMedicalText(sampleMedicalReport);

      expect(structured.doctor_name).toBe('Dr. Ananya Roy');
      expect(structured.patient_name).toBe('Sita Sharma');
      expect(structured.facility_name).toBe('City Care Hospital');
      expect(structured.document_date).toBe('2026-05-12');
      expect(structured.allergies).toContain('Penicillin');
      expect(structured.allergies).toContain('Sulfa drugs');
      expect(structured.follow_up_instructions).toMatch(/2 weeks/i);
      expect(structured.medicines?.length).toBeGreaterThanOrEqual(2);
      expect(structured.medicines?.[0]?.name).toMatch(/Telmisartan/i);
      expect(structured.medicines?.[0]?.strength).toBe('40mg');
    });

    it('correctly parses laboratory reports with test names, units and reference ranges', () => {
      const sampleLabReport = `
        Apex Diagnostic Laboratories
        Date: 2026-03-22
        Patient Name: Sita Sharma
        Complete Blood Count (CBC)

        Hemoglobin: 12.5 g/dL Normal: 12.0 - 15.0
        WBC Count: 7200 /mcL Normal: 4500 - 11000
        Platelet Count: 250000 /mcL Normal: 150000 - 450000
        Blood Glucose Fasting: 98 mg/dL Ref: 70 - 99
      `;

      const structured = parseMedicalText(sampleLabReport);

      expect(structured.document_type).toBe('Laboratory Report');
      expect(structured.lab_results?.length).toBeGreaterThanOrEqual(3);

      const hb = structured.lab_results?.find((l) => /Hemoglobin/i.test(l.test_name));
      expect(hb).toBeDefined();
      expect(hb?.result_value).toBe('12.5');
    });

    it('retrieves document details including extraction record and job status', async () => {
      const res = await request
        .get(`/api/families/documents/details/${uploadedDocId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.document.id).toBe(uploadedDocId);
      expect(res.body.data.latestJob).toBeDefined();
    });
  });

  // ===========================================================================
  // 4. Human Review, Corrections & Approvals
  // ===========================================================================
  describe('4. Human Review, Corrections & Approvals', () => {
    it('allows user to save draft review corrections', async () => {
      const correctedFields = {
        doctor_name: 'Dr. Rajesh Mehta',
        patient_name: 'Sita Sharma',
        document_date: '2026-04-10',
        report_title: 'Confirmed Cardiology Prescription',
        medicines: [
          { name: 'Paracetamol', strength: '500mg', dosage: '1-0-1' },
          { name: 'Atorvastatin', strength: '10mg', dosage: '0-0-1' },
        ],
      };

      const res = await request
        .post(`/api/families/documents/review/${uploadedDocId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          confirmedFields: correctedFields,
          markConfirmed: false,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.document.review_status).toBe('in_review');
      expect(res.body.data.extraction.confirmed_fields.doctor_name).toBe('Dr. Rajesh Mehta');
    });

    it('allows user to approve and finalize confirmation', async () => {
      const confirmedFields = {
        doctor_name: 'Dr. Rajesh Mehta',
        patient_name: 'Sita Sharma',
        document_date: '2026-04-10',
        report_title: 'Finalized Verified Prescription',
      };

      const res = await request
        .post(`/api/families/documents/review/${uploadedDocId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          confirmedFields,
          markConfirmed: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.document.review_status).toBe('confirmed');
      expect(res.body.data.document.title).toBe('Finalized Verified Prescription');
    });

    it('allows re-triggering extraction/OCR retry without duplicates', async () => {
      const res = await request
        .post(`/api/families/documents/retry/${uploadedDocId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.document_id).toBe(uploadedDocId);
    });
  });

  // ===========================================================================
  // 5. Document Search & Medical Timeline Filtering
  // ===========================================================================
  describe('5. Document Search & Medical Timeline Filtering', () => {
    it('lists all authorized documents for the family workspace', async () => {
      const res = await request
        .get(`/api/families/${family1Id}/documents`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('filters documents by patient profile ID', async () => {
      const res = await request
        .get(`/api/families/${family1Id}/documents?patientProfileId=${patient1Id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.every((d: any) => d.patient_profile_id === patient1Id)).toBe(true);
    });

    it('filters documents by search query', async () => {
      const res = await request
        .get(`/api/families/${family1Id}/documents?query=Finalized`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].title).toMatch(/Finalized/i);
    });

    it('filters documents by review status', async () => {
      const res = await request
        .get(`/api/families/${family1Id}/documents?reviewStatus=confirmed`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.every((d: any) => d.review_status === 'confirmed')).toBe(true);
    });
  });

  // ===========================================================================
  // 6. Secure Document Storage & Streaming
  // ===========================================================================
  describe('6. Secure Document Storage & Streaming', () => {
    it('provides short-lived signed access URL for viewing', async () => {
      const res = await request
        .get(`/api/families/documents/signed-url/${uploadedDocId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.url).toBeDefined();
    });

    it('streams original file buffer with correct MIME type', async () => {
      const res = await request
        .get(`/api/families/documents/file/${uploadedDocId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/image\/png/);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // 7. Security & Cross-Family Isolation
  // ===========================================================================
  describe('7. Security & Cross-Family Isolation', () => {
    it('prevents unauthorized User 2 from listing User 1 family documents', async () => {
      const res = await request
        .get(`/api/families/${family1Id}/documents`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Access denied/i);
    });

    it('prevents unauthorized User 2 from viewing User 1 document details', async () => {
      const res = await request
        .get(`/api/families/documents/details/${uploadedDocId}`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Access denied/i);
    });

    it('prevents unauthorized User 2 from downloading User 1 document file', async () => {
      const res = await request
        .get(`/api/families/documents/file/${uploadedDocId}`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Access denied/i);
    });

    it('prevents uploading file to a patient from another family workspace', async () => {
      const sampleText = Buffer.from('unauthorized injection');

      const res = await request
        .post(`/api/families/${family1Id}/documents/upload`)
        .set('Authorization', `Bearer ${user1Token}`)
        .field('patientProfileId', patient2Id) // Patient 2 belongs to Family 2!
        .field('category', 'prescription')
        .field('title', 'Cross-Family Exploit Attempt')
        .attach('file', sampleText, { filename: 'exploit.png', contentType: 'image/png' });

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/Patient profile not found in this family/i);
    });
  });

  // ===========================================================================
  // 8. Safe Document Deletion & Storage Cleanup
  // ===========================================================================
  describe('8. Safe Document Deletion & Storage Cleanup', () => {
    it('prevents unauthorized user from deleting document', async () => {
      const res = await request
        .delete(`/api/families/documents/details/${uploadedDocId}`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.status).toBe(403);
    });

    it('allows authorized family owner to delete document permanently', async () => {
      const res = await request
        .delete(`/api/families/documents/details/${uploadedDocId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/deleted/i);

      // Verify it is gone
      const checkRes = await request
        .get(`/api/families/documents/details/${uploadedDocId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(checkRes.status).toBe(404);
      expect(checkRes.body.message).toMatch(/Document not found/i);
    });
  });
});
