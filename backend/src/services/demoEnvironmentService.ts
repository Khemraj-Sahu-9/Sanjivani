/**
 * backend/src/services/demoEnvironmentService.ts
 *
 * Synthetic Demonstration Environment Service for Hackathons, Investor Demos,
 * and Controlled Pilot Evaluators.
 *
 * Requirements (Phase 11):
 * - Seeded data clearly identified as synthetic.
 * - Isolated from real patient records.
 * - Simulated events never masquerade as real provider events.
 * - Demo reset affects only designated demo data.
 */

import crypto from 'crypto';
import { db } from '../repositories/database.js';
import { logger } from '../config/logger.js';
import { createError } from '../middlewares/errorHandler.js';
import { HealthDocument, MedicationSchedule } from '../types/models.js';

export interface SeededDemoEnvironment {
  family: {
    id: string;
    name: string;
    provenance: string;
  };
  patient: {
    id: string;
    healthId: string;
    fullName: string;
    age: number;
    category: string;
    provenance: string;
  };
  document: {
    id: string;
    title: string;
    category: string;
    reviewStatus: string;
    extractedConditions: string[];
    extractedAllergies: string[];
    provenance: string;
  };
  medications: Array<{
    id: string;
    name: string;
    dosage: string;
    status: string;
  }>;
  appointment: {
    id: string;
    doctorName: string;
    specialty: string;
    appointmentDate: string;
    status: string;
  };
  emergencyContacts: Array<{
    id: string;
    name: string;
    relationship: string;
    phone: string;
    priorityOrder: number;
  }>;
  communityGroup: {
    id: string;
    name: string;
    locality: string;
    provenance: string;
  };
  assistanceRequest: {
    id: string;
    title: string;
    category: string;
    status: string;
    provenance: string;
  };
  disclaimer: string;
}

export class DemoEnvironmentService {
  /**
   * Seeds a complete, repeatable, self-contained synthetic demonstration environment.
   */
  async seedDemoEnvironment(userId: string): Promise<SeededDemoEnvironment> {
    logger.info(`[DemoEnvironment] Initializing synthetic demonstration workspace for user ${userId}`);

    // 1. Create or retrieve synthetic family workspace
    const userFamilies = await db.getUserFamilies(userId);
    let family = userFamilies.find((f) => f.name.includes('[SYNTHETIC DEMO]'));

    if (!family) {
      const created = await db.createFamily('Sharma Family Health Workspace [SYNTHETIC DEMO]', userId);
      family = created.family;
    }

    // 2. Create synthetic elderly patient profile
    const existingPatients = await db.getFamilyPatientProfiles(family.id);
    let patient = existingPatients.find((p) => p.full_name === 'Rameshwar Sharma');

    if (!patient) {
      patient = await db.createPatientProfile({
        family_id: family.id,
        health_id: 'SNJ-2026-DEMO-001',
        full_name: 'Rameshwar Sharma',
        gender: 'male',
        date_of_birth: '1952-08-14',
        relationship_to_creator: 'father',
        category: 'elderly',
        status: 'active',
        created_by: userId,
      });
    }

    // 3. Create synthetic medical document
    const existingDocs = await db.listFamilyDocuments(family.id, { patientProfileId: patient.id });
    let document: HealthDocument | undefined = existingDocs.find((d) =>
      d.title.includes('Metabolic Panel')
    );

    if (!document) {
      document = await db.createDocument({
        family_id: family.id,
        patient_profile_id: patient.id,
        title: 'Complete Blood Count & Comprehensive Metabolic Panel [SYNTHETIC]',
        category: 'laboratory_report',
        document_date: '2026-09-18',
        original_filename: 'synthetic_lab_cbc_metabolic_2026.pdf',
        storage_path: `synthetic-demo/${patient.id}/cbc_panel.pdf`,
        mime_type: 'application/pdf',
        file_size_bytes: 142850,
        file_checksum: crypto.createHash('sha256').update('SYNTHETIC_LAB_REPORT_CONTENT').digest('hex'),
        processing_status: 'extracted',
        review_status: 'confirmed',
        created_by: userId,
      });

      // Upsert confirmed structured extraction
      await db.upsertExtraction({
        document_id: document.id,
        extraction_version: 1,
        extraction_method: 'hybrid',
        ocr_provider: 'tesseract_ocr',
        confidence: 0.98,
        extraction_status: 'completed',
        extracted_text:
          'SYNTHETIC CLINICAL REPORT — City Care Diagnostic Labs. Patient: Rameshwar Sharma (74M). ' +
          'HbA1c: 7.8% (Elevated). Fasting Glucose: 142 mg/dL. Hemoglobin: 11.4 g/dL. ' +
          'Blood Pressure: 146/92 mmHg. Diagnoses: Type 2 Diabetes Mellitus, Essential Hypertension, Mild Anemia. ' +
          'Allergies: Penicillin (Severe Urticaria / Anaphylaxis Risk). ' +
          'Rx: Metformin 500mg BID with meals; Telmisartan 40mg Once Daily in morning.',
        proposed_fields: {
          patient_name: 'Rameshwar Sharma',
          document_type: 'laboratory_report',
          allergies: ['Penicillin'],
          medicines: [
            { name: 'Metformin', dosage: '500mg', frequency: 'BID' },
            { name: 'Telmisartan', dosage: '40mg', frequency: 'Once Daily' },
          ],
        },
        confirmed_fields: {
          patient_name: 'Rameshwar Sharma',
          document_type: 'laboratory_report',
          allergies: ['Penicillin'],
          medicines: [
            { name: 'Metformin', dosage: '500mg', frequency: 'BID' },
            { name: 'Telmisartan', dosage: '40mg', frequency: 'Once Daily' },
          ],
          lab_results: [
            { test_name: 'HbA1c', result_value: '7.8', unit: '%', interpretation: 'Elevated' },
            { test_name: 'Fasting Blood Glucose', result_value: '142', unit: 'mg/dL', interpretation: 'High' },
            { test_name: 'Hemoglobin', result_value: '11.4', unit: 'g/dL', interpretation: 'Low' },
          ],
        },
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      });
    }

    // 4. Create confirmed medication schedules
    const existingMeds = await db.listMedicationSchedulesByPatient(patient.id);
    let med1 = existingMeds.find((m) => m.medicine_name === 'Metformin 500mg');
    let med2 = existingMeds.find((m) => m.medicine_name === 'Telmisartan 40mg');

    if (!med1) {
      med1 = await db.createMedicationSchedule({
        family_id: family.id,
        patient_profile_id: patient.id,
        medicine_name: 'Metformin 500mg',
        strength: '500mg',
        dosage_instruction: '1 tablet BID with meals',
        frequency: 'twice_daily',
        scheduled_times: ['08:00', '20:00'],
        start_date: '2026-09-20',
        prescriber_name: 'Dr. Rajesh Gupta',
        instructions: 'Take immediately after food to avoid GI upset.',
        status: 'active',
        created_by: userId,
        confirmed_by: userId,
        confirmed_at: new Date().toISOString(),
      });
    }

    if (!med2) {
      med2 = await db.createMedicationSchedule({
        family_id: family.id,
        patient_profile_id: patient.id,
        medicine_name: 'Telmisartan 40mg',
        strength: '40mg',
        dosage_instruction: '1 tablet once daily in morning',
        frequency: 'daily',
        scheduled_times: ['08:00'],
        start_date: '2026-09-20',
        prescriber_name: 'Dr. Rajesh Gupta',
        instructions: 'Take in morning with a glass of water.',
        status: 'active',
        created_by: userId,
        confirmed_by: userId,
        confirmed_at: new Date().toISOString(),
      });
    }

    // 5. Create synthetic appointment
    const existingAppts = await db.listAppointmentsByPatient(patient.id);
    let appt = existingAppts.find((a) => (a.doctor_name || '').includes('Dr. Alok Verma'));

    if (!appt) {
      const futureDate = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString();
      appt = await db.createAppointment({
        family_id: family.id,
        patient_profile_id: patient.id,
        title: 'Quarterly Diabetic Follow-Up',
        doctor_name: 'Dr. Alok Verma, MD (Endocrinology)',
        facility_name: 'Metro Care Specialty Clinics, Suite 402',
        appointment_date: futureDate.slice(0, 10),
        appointment_time: '10:30',
        appointment_datetime: futureDate,
        timezone: 'Asia/Kolkata',
        location: 'Sector 52 Medical Center',
        notes: 'Bring previous 3 months fasting blood sugar logs.',
        status: 'scheduled',
        created_by: userId,
      });
    }

    // 6. Fictional emergency contacts
    const existingContacts = await db.listEmergencyContacts(family.id, patient.id);
    let c1 = existingContacts.find((c) => c.name === 'Priya Sharma');
    let c2 = existingContacts.find((c) => c.name === 'Sunil Sharma');

    if (!c1) {
      c1 = await db.createEmergencyContact({
        family_id: family.id,
        patient_profile_id: patient.id,
        name: 'Priya Sharma',
        relationship: 'Daughter (Primary Caregiver)',
        phone_number: '+919876543210',
        role: 'primary_family',
        priority: 1,
        is_active: true,
        is_demo: true,
        simulation_provenance: 'SYNTHETIC DEMO CONTACT',
      });
    }

    if (!c2) {
      c2 = await db.createEmergencyContact({
        family_id: family.id,
        patient_profile_id: patient.id,
        name: 'Sunil Sharma',
        relationship: 'Son',
        phone_number: '+919876543211',
        role: 'secondary_family',
        priority: 2,
        is_active: true,
        is_demo: true,
        simulation_provenance: 'SYNTHETIC DEMO CONTACT',
      });
    }

    // 7. Emergency escalation policy
    await db.upsertEmergencyEscalationPolicy({
      family_id: family.id,
      patient_profile_id: patient.id,
      family_response_timeout_seconds: 60,
      caregiver_response_timeout_seconds: 120,
      advance_to_hospital_on_timeout: true,
      hospital_name: 'City Care Hospital — Emergency Medicine Department',
      hospital_department: 'Trauma & Resuscitation Center',
      is_active: true,
      is_demo: true,
      simulation_provenance: 'SYNTHETIC DEMO POLICY',
    });

    // 8. Residential Society Community Group
    const userGroups = await db.listCommunityGroupsForUser(userId);
    let group = userGroups.find((g) => g.name.includes('[SYNTHETIC DEMO]'));

    if (!group) {
      group = await db.createCommunityGroup({
        name: 'Greenwood Heights Residents Association [SYNTHETIC DEMO]',
        description: 'Residential community mutual assistance and elderly support network.',
        group_type: 'residential_society',
        approximate_locality: 'Sector 52, Gurgaon',
        creator_user_id: userId,
        membership_policy: 'open',
        moderation_policy: 'standard',
        status: 'active',
      });
      await db.createCommunityMembership({
        community_id: group.id,
        user_id: userId,
        role: 'owner',
        status: 'active',
      });
    }

    // 9. Representative Non-Emergency Assistance Request
    const existingReqs = await db.listAssistanceRequests(group.id);
    let assistanceReq = existingReqs.find((r) => r.title.includes('Prescription refill'));

    if (!assistanceReq) {
      const expiry = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
      assistanceReq = await db.createAssistanceRequest({
        community_id: group.id,
        creator_user_id: userId,
        title: 'Prescription refill and grocery delivery for elderly couple',
        description: 'Need neighbor assistance to pick up confirmed medicine refill from Apollo Pharmacy Sector 52.',
        request_category: 'grocery_supplies',
        priority: 'medium',
        intended_recipient_name: 'Mr. R. Sharma (Tower 4, Apt 802)',
        approximate_locality: 'Tower 4, Greenwood Heights',
        expiry_time: expiry,
        status: 'open',
        contact_sharing_consent: true,
      });
    }

    const seeded: SeededDemoEnvironment = {
      family: {
        id: family.id,
        name: family.name,
        provenance: 'SYNTHETIC DEMO DATASET',
      },
      patient: {
        id: patient.id,
        healthId: patient.health_id,
        fullName: patient.full_name,
        age: 74,
        category: patient.category,
        provenance: 'SYNTHETIC DEMO PATIENT',
      },
      document: {
        id: document.id,
        title: document.title,
        category: document.category,
        reviewStatus: document.review_status,
        extractedConditions: ['Type 2 Diabetes Mellitus', 'Essential Hypertension', 'Mild Anemia'],
        extractedAllergies: ['Penicillin (severe urticaria)'],
        provenance: 'SYNTHETIC CLINICAL EXTRACTION',
      },
      medications: [med1, med2].filter((m): m is MedicationSchedule => Boolean(m)).map((m) => ({
        id: m.id,
        name: m.medicine_name,
        dosage: m.dosage_instruction,
        status: m.status,
      })),
      appointment: {
        id: appt.id,
        doctorName: appt.doctor_name || 'Dr. Alok Verma',
        specialty: 'Endocrinology & Diabetology',
        appointmentDate: appt.appointment_date,
        status: appt.status,
      },
      emergencyContacts: [c1, c2].filter((c): c is NonNullable<typeof c> => Boolean(c)).map((c) => ({
        id: c.id,
        name: c.name,
        relationship: c.relationship,
        phone: c.phone_number,
        priorityOrder: c.priority,
      })),
      communityGroup: {
        id: group.id,
        name: group.name,
        locality: group.approximate_locality,
        provenance: 'SYNTHETIC COMMUNITY GROUP',
      },
      assistanceRequest: {
        id: assistanceReq.id,
        title: assistanceReq.title,
        category: assistanceReq.request_category,
        status: assistanceReq.status,
        provenance: 'SYNTHETIC ASSISTANCE REQUEST',
      },
      disclaimer:
        'ALL SEEDED DEMO DATA IS SYNTHETIC. NO REAL PATIENT INFORMATION IS CONTAINED. ' +
        'EMERGENCY RESPONSE IS STRICTLY SIMULATED. NO REAL EMERGENCY SERVICES WILL BE DISPATCHED.',
    };

    return seeded;
  }

  /**
   * Resets the synthetic demonstration scenario (incidents, notifications, demo occurrences).
   * Strictly preserves real user accounts and real production records.
   */
  async resetDemoEnvironment(
    userId: string,
    familyId: string,
    patientProfileId: string
  ): Promise<{
    success: boolean;
    familyId: string;
    patientProfileId: string;
    message: string;
    resetTimestamp: string;
  }> {
    const patient = await db.getPatientProfileById(patientProfileId);
    if (!patient || patient.family_id !== familyId) {
      throw createError('Patient profile not found in this family workspace.', 404);
    }

    // Reset emergency demo scenario
    await db.resetEmergencyDemoScenario(familyId, patientProfileId);

    logger.info(
      `[DemoEnvironment] Synthetic demo scenario reset successfully for patient ${patientProfileId} by user ${userId}`
    );

    return {
      success: true,
      familyId,
      patientProfileId,
      message: 'Synthetic demonstration scenario has been reset to baseline.',
      resetTimestamp: new Date().toISOString(),
    };
  }
}

export const demoEnvironmentService = new DemoEnvironmentService();
