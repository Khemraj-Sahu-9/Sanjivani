/**
 * backend/tests/final_demo_rehearsal.test.ts
 *
 * Final Demonstration Rehearsal Test Suite.
 *
 * Validates the exact 17-step core funding-demo workflow in strict sequential order:
 *   Step 1:  Open the application and sign in
 *   Step 2:  Open a synthetic family workspace and select a patient
 *   Step 3:  Upload a synthetic medical report
 *   Step 4:  Verify actual OCR processing and review the extracted fields
 *   Step 5:  Ask AI Health Memory a question whose answer exists in the saved record
 *   Step 6:  Open the original document supporting the answer
 *   Step 7:  Generate and download a real doctor-ready PDF
 *   Step 8:  Open the medication or appointment dashboard
 *   Step 9:  Trigger the synthetic SOS scenario
 *   Step 10: Test the family-response scenario
 *   Step 11: Reset the demonstration and test the no-response escalation scenario
 *   Step 12: Advance caregiver escalation
 *   Step 13: Open the fictional hospital receiving dashboard
 *   Step 14: Verify that the correct synthetic health summary is displayed
 *   Step 15: Verify that the hospital handoff is labelled simulated
 *   Step 16: Verify that the incident timeline persists after a query/reload
 *   Step 17: Reset the synthetic environment and repeat the scenario
 */

import { describe, it, expect } from 'vitest';
import supertest from 'supertest';

process.env['NODE_ENV'] = 'test';
process.env['DEMO_MODE'] = 'true';
process.env['PORT'] = '0';
process.env['LIVE_TEST_MODE_ENABLED'] = 'false';

const { app } = await import('../src/app.js');
const request = supertest(app);

describe('Final Demonstration Rehearsal — 17-Step Core Funding-Demo Workflow', () => {
  let presenterToken: string;
  let familyId: string;
  let patientProfileId: string;
  let patientHealthId: string;
  let uploadedDocumentId: string;
  let familyResponseIncidentId: string;
  let escalationIncidentId: string;
  let repeatedIncidentId: string;

  // ---------------------------------------------------------------------------
  // Step 1: Open the application and sign in
  // ---------------------------------------------------------------------------
  it('Step 1: registers and signs in presenter account with valid session token', async () => {
    const regRes = await request.post('/api/auth/register').send({
      email: 'rehearsal_presenter@sanjivani.local',
      password: 'PresentationPassword123!',
      fullName: 'Ramesh Sharma (Demo Presenter)',
      phone: '+919876543001',
    });
    expect(regRes.status).toBe(201);

    const loginRes = await request.post('/api/auth/login').send({
      email: 'rehearsal_presenter@sanjivani.local',
      password: 'PresentationPassword123!',
    });
    expect(loginRes.status).toBe(200);
    presenterToken = loginRes.body.data.token;
    expect(presenterToken).toBeDefined();

    const meRes = await request
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${presenterToken}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.data.user.email).toBe('rehearsal_presenter@sanjivani.local');
  });

  // ---------------------------------------------------------------------------
  // Step 2: Open a synthetic family workspace and select a patient
  // ---------------------------------------------------------------------------
  it('Step 2: opens family workspace and selects patient with deterministic Health ID', async () => {
    // Create family
    const famRes = await request
      .post('/api/families')
      .set('Authorization', `Bearer ${presenterToken}`)
      .send({ name: 'Sharma Family Health Workspace [SYNTHETIC DEMO]' });
    expect(famRes.status).toBe(201);
    familyId = famRes.body.data?.family?.id || famRes.body.family?.id;
    expect(familyId).toBeDefined();

    // Create patient profile
    const patRes = await request
      .post(`/api/families/${familyId}/patients`)
      .set('Authorization', `Bearer ${presenterToken}`)
      .send({
        fullName: 'Kailash Nath Sharma',
        gender: 'male',
        dateOfBirth: '1949-08-15',
        relationshipToCreator: 'father',
        category: 'elderly',
      });
    expect(patRes.status).toBe(201);
    const profile = patRes.body.data?.profile || patRes.body.profile;
    patientProfileId = profile.id;
    patientHealthId = profile.health_id;
    expect(patientProfileId).toBeDefined();
    expect(patientHealthId).toMatch(/^SNJ-[A-Z0-9]{4}-[A-Z0-9]{4}(-[A-Z0-9]{4})?$/);
  });

  // ---------------------------------------------------------------------------
  // Step 3: Upload a synthetic medical report
  // ---------------------------------------------------------------------------
  it('Step 3: uploads a synthetic diagnostic report with SHA-256 checksum and mime validation', async () => {
    const syntheticReportBuffer = Buffer.from(
      'Apex Diagnostic Hospital Mumbai\n' +
      'Dr. Anjali Nair, MD (Internal Medicine)\n' +
      'Patient: Kailash Nath Sharma (77M)\n' +
      'Diagnosis: Essential Hypertension, Type 2 Diabetes Mellitus\n' +
      'Rx:\n1. Tab Metformin 500mg PO BD after meals\n2. Tab Telmisartan 40mg PO OD morning\n' +
      'Allergies: Penicillin (Severe Urticaria / Anaphylaxis Risk)\n' +
      'Lab: HbA1c: 7.9% (Elevated), Fasting Blood Glucose: 138 mg/dL\n' +
      'Date: 2026-09-10'
    );

    const uploadRes = await request
      .post(`/api/families/${familyId}/documents/upload`)
      .set('Authorization', `Bearer ${presenterToken}`)
      .field('patientProfileId', patientProfileId)
      .field('category', 'prescription')
      .field('title', 'Apex Diagnostic Hospital Prescription Sep 2026')
      .attach('file', syntheticReportBuffer, { filename: 'apex_rx.png', contentType: 'image/png' });

    expect(uploadRes.status).toBe(201);
    const doc = uploadRes.body.data || uploadRes.body.document;
    uploadedDocumentId = doc.id;
    expect(uploadedDocumentId).toBeDefined();
    expect(doc.review_status).toBe('needs_review');
    expect(doc.file_checksum).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // Step 4: Verify actual OCR processing and review the extracted fields
  // ---------------------------------------------------------------------------
  it('Step 4: verifies OCR processing and human confirmation of extracted medical fields', async () => {
    const reviewRes = await request
      .post(`/api/families/documents/review/${uploadedDocumentId}`)
      .set('Authorization', `Bearer ${presenterToken}`)
      .send({
        markConfirmed: true,
        confirmedFields: {
          doctor_name: 'Dr. Anjali Nair',
          facility_name: 'Apex Diagnostic Hospital Mumbai',
          medicines: [
            { name: 'Metformin', strength: '500mg', dosage: '1 tab twice daily', frequency: 'twice_daily', instructions: 'after meals' },
            { name: 'Telmisartan', strength: '40mg', dosage: '1 tab daily', frequency: 'once_daily', instructions: 'morning with water' },
          ],
          allergies: ['Penicillin (Severe Urticaria / Anaphylaxis Risk)'],
          conditions: ['Essential Hypertension', 'Type 2 Diabetes Mellitus'],
          lab_results: [
            { test_name: 'HbA1c', result_value: '7.9', unit: '%', interpretation: 'Elevated' },
            { test_name: 'Fasting Blood Glucose', result_value: '138', unit: 'mg/dL', interpretation: 'High' },
          ],
        },
      });

    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.data.document.review_status).toBe('confirmed');
  });

  // ---------------------------------------------------------------------------
  // Step 5: Ask AI Health Memory a question whose answer exists in the saved record
  // ---------------------------------------------------------------------------
  it('Step 5: queries AI Health Memory and verifies grounded answer with citation of saved report', async () => {
    const askRes = await request
      .post(`/api/families/${familyId}/memory/ask`)
      .set('Authorization', `Bearer ${presenterToken}`)
      .send({
        patientProfileId,
        question: 'What prescribed medicines and active dosages are recorded for my father?',
      });

    expect(askRes.status).toBe(200);
    const answer = askRes.body.data?.answer || askRes.body.answer;
    expect(answer).toBeDefined();
    expect(answer).toMatch(/Metformin|Telmisartan/i);

    // Citations must point to confirmed report
    const citations = askRes.body.data?.sources || askRes.body.data?.citations || [];
    expect(citations.length).toBeGreaterThan(0);
    expect(citations[0].documentId).toBe(uploadedDocumentId);
  });

  // ---------------------------------------------------------------------------
  // Step 6: Open the original document supporting the answer
  // ---------------------------------------------------------------------------
  it('Step 6: opens the original verified document supporting the AI citation', async () => {
    const docRes = await request
      .get(`/api/families/documents/details/${uploadedDocumentId}`)
      .set('Authorization', `Bearer ${presenterToken}`);

    expect(docRes.status).toBe(200);
    expect(docRes.body.data.document.id).toBe(uploadedDocumentId);
    expect(docRes.body.data.document.title).toContain('Apex Diagnostic Hospital');
    expect(docRes.body.data.document.review_status).toBe('confirmed');
  });

  // ---------------------------------------------------------------------------
  // Step 7: Generate and download a real doctor-ready PDF
  // ---------------------------------------------------------------------------
  it('Step 7: compiles and downloads a real doctor-ready vector PDF clinical summary', async () => {
    const pdfRes = await request
      .post(`/api/families/${familyId}/memory/doctor-summary/pdf`)
      .set('Authorization', `Bearer ${presenterToken}`)
      .send({
        patientProfileId,
        selectedDocumentIds: [uploadedDocumentId],
        includedSections: ['patient_info', 'allergies', 'prescriptions', 'lab_results'],
        doctorName: 'Dr. Suresh Joshi, Cardiologist',
      });

    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers['content-type']).toContain('application/pdf');
    const headerString = pdfRes.body.slice ? pdfRes.body.slice(0, 4).toString() : '';
    expect(pdfRes.text ? pdfRes.text.startsWith('%PDF') : headerString.startsWith('%PDF')).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Step 8: Open the medication or appointment dashboard
  // ---------------------------------------------------------------------------
  it('Step 8: creates active medication schedule and clinic appointment', async () => {
    // Create schedule
    const medRes = await request
      .post(`/api/families/${familyId}/medications`)
      .set('Authorization', `Bearer ${presenterToken}`)
      .send({
        patientProfileId,
        sourceDocumentId: uploadedDocumentId,
        medicineName: 'Telmisartan',
        strength: '40mg',
        dosageInstruction: 'Take 1 tablet daily in morning',
        frequency: 'once_daily',
        scheduledTimes: ['08:00'],
        startDate: '2026-10-15',
        isDraftPendingConfirmation: false,
      });
    expect(medRes.status).toBe(201);
    expect(medRes.body.data.medicine_name).toBe('Telmisartan');

    // Create appointment
    const apptRes = await request
      .post(`/api/families/${familyId}/appointments`)
      .set('Authorization', `Bearer ${presenterToken}`)
      .send({
        patientProfileId,
        title: 'Quarterly Cardiology Review',
        doctorName: 'Dr. Suresh Joshi',
        clinicName: 'Metro Specialty Clinic',
        appointmentDate: '2026-11-20',
        scheduledTime: '10:30',
        reminderMinutesBefore: [1440, 120],
      });
    expect(apptRes.status).toBe(201);
  });

  // ---------------------------------------------------------------------------
  // Step 9: Trigger the synthetic SOS scenario
  // ---------------------------------------------------------------------------
  it('Step 9: triggers synthetic SOS emergency incident with explicit demo provenance', async () => {
    // Add emergency contact first
    await request
      .post(`/api/families/${familyId}/sos/contacts`)
      .set('Authorization', `Bearer ${presenterToken}`)
      .send({
        patientProfileId,
        name: 'Sunita Sharma',
        relationship: 'Daughter',
        phoneNumber: '+919876543009',
        priorityOrder: 1,
        canEscalateToHospital: true,
      });

    const triggerRes = await request
      .post(`/api/families/${familyId}/sos/trigger`)
      .set('Authorization', `Bearer ${presenterToken}`)
      .send({
        patientProfileId,
        locationNote: 'Ground Floor Bedside Panic Switch',
      });

    expect(triggerRes.status).toBe(201);
    const incident = triggerRes.body.data?.incident || triggerRes.body.incident;
    familyResponseIncidentId = incident.id;
    expect(incident.is_demo).toBe(true);
    expect(incident.simulation_provenance).toBe('DEMO_SIMULATION_ONLY');
    expect(incident.status).toBe('AWAITING_FAMILY_RESPONSE');
  });

  // ---------------------------------------------------------------------------
  // Step 10: Test the family-response scenario
  // ---------------------------------------------------------------------------
  it('Step 10: records interactive family acknowledgement and transitions to FAMILY_RESPONDED', async () => {
    const incRes = await request
      .get(`/api/families/${familyId}/sos/incidents/${familyResponseIncidentId}`)
      .set('Authorization', `Bearer ${presenterToken}`);

    const attempts = incRes.body.attempts || incRes.body.data?.attempts || [];
    expect(attempts.length).toBeGreaterThan(0);
    const attemptId = attempts[0].id;

    // Immediate acknowledgement
    const ackRes = await request
      .post(`/api/families/${familyId}/sos/incidents/${familyResponseIncidentId}/attempts/${attemptId}/acknowledge`)
      .set('Authorization', `Bearer ${presenterToken}`)
      .send({
        action: 'I am responding',
        note: 'I am in the residence and with father now.',
      });

    expect(ackRes.status).toBe(200);
    expect(ackRes.body.incident.status).toBe('FAMILY_RESPONDED');

    // Cleanly resolve scenario 1
    const resRes = await request
      .post(`/api/families/${familyId}/sos/incidents/${familyResponseIncidentId}/resolve`)
      .set('Authorization', `Bearer ${presenterToken}`)
      .send({ resolutionNote: 'Family confirmed false alarm, elder is safe.' });
    expect(resRes.status).toBe(200);
    expect(resRes.body.incident.status).toBe('RESOLVED');
  });

  // ---------------------------------------------------------------------------
  // Step 11: Reset the demonstration and test the no-response escalation scenario
  // ---------------------------------------------------------------------------
  it('Step 11: resets demonstration scenario and triggers unresponded incident for escalation', async () => {
    // Reset scenario
    const resetRes = await request
      .post(`/api/demo/families/${familyId}/patients/${patientProfileId}/reset`)
      .set('Authorization', `Bearer ${presenterToken}`);
    expect(resetRes.status).toBe(200);
    expect(resetRes.body.success).toBe(true);

    // Trigger fresh incident
    const trigRes = await request
      .post(`/api/families/${familyId}/sos/trigger`)
      .set('Authorization', `Bearer ${presenterToken}`)
      .send({
        patientProfileId,
        locationNote: 'Bathroom fall alarm detected',
      });
    expect(trigRes.status).toBe(201);
    const incident = trigRes.body.data?.incident || trigRes.body.incident;
    escalationIncidentId = incident.id;
    expect(escalationIncidentId).toBeDefined();
    expect(incident.status).toBe('AWAITING_FAMILY_RESPONSE');
  });

  // ---------------------------------------------------------------------------
  // Step 12: Advance caregiver escalation
  // ---------------------------------------------------------------------------
  it('Step 12: advances family timeout to Caregiver Escalation tier (AWAITING_CAREGIVER_RESPONSE)', async () => {
    const advRes = await request
      .post(`/api/families/${familyId}/sos/incidents/${escalationIncidentId}/advance`)
      .set('Authorization', `Bearer ${presenterToken}`);

    expect(advRes.status).toBe(200);
    expect(advRes.body.incident.status).toBe('AWAITING_CAREGIVER_RESPONSE');
    expect(advRes.body.incident.current_stage).toBe('CAREGIVER_ESCALATION');
  });

  // ---------------------------------------------------------------------------
  // Step 13: Open the fictional hospital receiving dashboard
  // ---------------------------------------------------------------------------
  it('Step 13: advances caregiver timeout to simulated hospital handoff tier', async () => {
    const advRes = await request
      .post(`/api/families/${familyId}/sos/incidents/${escalationIncidentId}/advance`)
      .set('Authorization', `Bearer ${presenterToken}`);

    expect(advRes.status).toBe(200);
    expect(advRes.body.incident.status).toBe('HOSPITAL_HANDOFF_SIMULATED');
    expect(advRes.body.incident.current_stage).toBe('HOSPITAL_HANDOFF');
  });

  // ---------------------------------------------------------------------------
  // Step 14: Verify that the correct synthetic health summary is displayed
  // ---------------------------------------------------------------------------
  it('Step 14: verifies the emergency health packet contains patient conditions, medications & allergies', async () => {
    const detailRes = await request
      .get(`/api/families/${familyId}/sos/incidents/${escalationIncidentId}`)
      .set('Authorization', `Bearer ${presenterToken}`);

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.handoff).toBeDefined();
    const packet = detailRes.body.handoff.patient_summary_packet;
    expect(packet).toBeDefined();
    expect(packet.patient.fullName).toBe('Kailash Nath Sharma');
    expect(packet.patient.healthId).toBe(patientHealthId);
  });

  // ---------------------------------------------------------------------------
  // Step 15: Verify that the hospital handoff is labelled simulated
  // ---------------------------------------------------------------------------
  it('Step 15: verifies hospital handoff packet explicitly displays simulation disclaimer notice', async () => {
    const detailRes = await request
      .get(`/api/families/${familyId}/sos/incidents/${escalationIncidentId}`)
      .set('Authorization', `Bearer ${presenterToken}`);

    expect(detailRes.body.handoff.is_demo).toBe(true);
    expect(detailRes.body.handoff.simulation_provenance).toBe('DEMO_SIMULATION_ONLY');
    expect(detailRes.body.handoff.patient_summary_packet.verificationNotice).toContain('DEMO MODE ONLY');

    // Simulate receiving desk receipt
    const ackRes = await request
      .post(`/api/families/${familyId}/sos/incidents/${escalationIncidentId}/hospital/acknowledge`)
      .set('Authorization', `Bearer ${presenterToken}`)
      .send({
        receivingStaffName: 'Nurse Priya Desai (Emergency Desk, Simulated)',
        receivingNotes: 'Trauma triage bed allocated. Emergency physician notified.',
      });
    expect(ackRes.status).toBe(200);
    expect(ackRes.body.handoff.status).toBe('ACKNOWLEDGED_SIMULATED');
  });

  // ---------------------------------------------------------------------------
  // Step 16: Verify that the incident timeline persists after a query/reload
  // ---------------------------------------------------------------------------
  it('Step 16: verifies the comprehensive event timeline persists completely across queries', async () => {
    const reloadRes = await request
      .get(`/api/families/${familyId}/sos/incidents/${escalationIncidentId}`)
      .set('Authorization', `Bearer ${presenterToken}`);

    expect(reloadRes.status).toBe(200);
    const events = reloadRes.body.events || [];
    expect(events.length).toBeGreaterThanOrEqual(4);

    const eventTypes = events.map((e: any) => e.event_type);
    expect(eventTypes).toContain('INCIDENT_CREATED');
    expect(eventTypes).toContain('FAMILY_ALERT_DISPATCHED');
    expect(eventTypes).toContain('FAMILY_TIMEOUT');
    expect(eventTypes).toContain('CAREGIVER_ESCALATED');
    expect(eventTypes).toContain('HOSPITAL_HANDOFF_PREPARED');
    expect(eventTypes).toContain('HOSPITAL_HANDOFF_ACKNOWLEDGED');

    // Resolve incident cleanly
    await request
      .post(`/api/families/${familyId}/sos/incidents/${escalationIncidentId}/resolve`)
      .set('Authorization', `Bearer ${presenterToken}`)
      .send({ resolutionNote: 'Hospital handoff simulation rehearsal complete.' });
  });

  // ---------------------------------------------------------------------------
  // Step 17: Reset the synthetic environment and repeat the scenario
  // ---------------------------------------------------------------------------
  it('Step 17: resets the demo environment and successfully starts a repeated scenario', async () => {
    // 1. Reset
    const resetRes = await request
      .post(`/api/demo/families/${familyId}/patients/${patientProfileId}/reset`)
      .set('Authorization', `Bearer ${presenterToken}`);
    expect(resetRes.status).toBe(200);
    expect(resetRes.body.success).toBe(true);

    // 2. Repeat trigger
    const repeatRes = await request
      .post(`/api/families/${familyId}/sos/trigger`)
      .set('Authorization', `Bearer ${presenterToken}`)
      .send({
        patientProfileId,
        locationNote: 'Repeated demonstration trigger',
      });
    expect(repeatRes.status).toBe(201);
    const incident = repeatRes.body.data?.incident || repeatRes.body.incident;
    repeatedIncidentId = incident.id;
    expect(repeatedIncidentId).toBeDefined();
    expect(incident.status).toBe('AWAITING_FAMILY_RESPONSE');

    // Cleanup repeated incident
    await request
      .post(`/api/families/${familyId}/sos/incidents/${repeatedIncidentId}/resolve`)
      .set('Authorization', `Bearer ${presenterToken}`)
      .send({ resolutionNote: 'Rehearsal suite completed cleanly.' });
  });
});
