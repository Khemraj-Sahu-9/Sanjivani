/**
 * backend/src/integrations/ocr/medicalExtractor.ts
 *
 * Deterministic rule-based parser that analyzes raw extracted medical text
 * and proposes structured fields without fabricating missing information.
 */

import { StructuredMedicalFields, PrescriptionMedicineField, LabResultField } from '../../types/models.js';

export function parseMedicalText(rawText: string): StructuredMedicalFields {
  const result: StructuredMedicalFields = {
    medicines: [],
    lab_results: [],
  };

  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);

  // 1. Detect Doctor Name
  for (const line of lines) {
    const drMatch = line.match(/(?:Dr\.|Doctor)\s+([A-Z][a-zA-Z\s.]+)/i);
    if (drMatch && drMatch[1] && !result.doctor_name) {
      result.doctor_name = `Dr. ${drMatch[1].trim()}`;
      break;
    }
  }

  // 2. Detect Patient Name
  for (const line of lines) {
    const ptMatch = line.match(/(?:Patient\s*Name|Name|Pt):\s*([A-Za-z\s]+)/i);
    if (ptMatch && ptMatch[1] && !result.patient_name) {
      result.patient_name = ptMatch[1].trim();
      break;
    }
  }

  // 3. Detect Facility / Hospital / Clinic / Lab Name
  for (const line of lines) {
    if (/(?:Hospital|Clinic|Diagnostic|Laborator|Pathology|Medical Center|Healthcare)/i.test(line)) {
      if (!result.facility_name && line.length < 80) {
        result.facility_name = line.replace(/^[#*-]\s*/, '').trim();
      }
    }
  }

  // 4. Detect Document Date
  for (const line of lines) {
    const dateMatch = line.match(/(?:Date|Dated):\s*([0-9]{1,4}[-/][0-9]{1,2}[-/][0-9]{1,4})/i) ||
                      line.match(/\b([0-9]{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+[0-9]{4})\b/i);
    if (dateMatch && dateMatch[1] && !result.document_date) {
      result.document_date = dateMatch[1].trim();
      break;
    }
  }

  // 5. Detect Document Category / Report Title
  for (const line of lines) {
    if (/(?:Prescription|Rx|Medical Prescription)/i.test(line) && !result.document_type) {
      result.document_type = 'Prescription';
      result.report_title = result.report_title || 'Prescription';
    } else if (/(?:Blood Report|Complete Blood Count|CBC|Lipid Profile|Thyroid Profile|Lab Report|Biochemistry)/i.test(line) && !result.document_type) {
      result.document_type = 'Laboratory Report';
      result.report_title = result.report_title || line;
    } else if (/(?:Discharge Summary|Discharge Card)/i.test(line) && !result.document_type) {
      result.document_type = 'Discharge Summary';
      result.report_title = result.report_title || 'Discharge Summary';
    }
  }

  // 6. Detect Prescription Medicines
  const medicines: PrescriptionMedicineField[] = [];
  const medRegex = /(?:Tab(?:let)?|Cap(?:sule)?|Syr(?:up)?|Inj(?:ection)?|Susp(?:ension)?)\.?\s+([A-Za-z0-9\-+ ]+?)(?:\s+(\d+(?:\.\d+)?\s*(?:mg|mcg|ml|g|IU)))?(?:\s+[-–:]\s*|\s+)(\d+-\d+-\d+|\d+\s*(?:times|daily|BD|TDS|OD|HS)|(?:once|twice|thrice)\s+daily)?/gi;

  let match: RegExpExecArray | null;
  while ((match = medRegex.exec(rawText)) !== null) {
    const rawMedName = match[1]?.trim();
    if (rawMedName && rawMedName.length >= 2 && rawMedName.length <= 50) {
      medicines.push({
        name: rawMedName,
        strength: match[2]?.trim(),
        dosage: match[3]?.trim(),
      });
    }
  }
  if (medicines.length > 0) {
    result.medicines = medicines;
  }

  // 7. Detect Laboratory Results
  const labResults: LabResultField[] = [];
  const labRegex = /([A-Za-z\s()/\-%]{3,35})\s*[:=-]\s*([<>]?\s*\d+(?:\.\d+)?)\s*([a-zA-Z/%μu]+(?:\/[a-zA-Z0-9]+)?)?(?:\s*(?:Ref|Range|Normal)?\s*[:(]?\s*([0-9.\-–<>\s]+(?:\s*[a-zA-Z/%]+)?)?[)]?)?/gi;

  while ((match = labRegex.exec(rawText)) !== null) {
    const testName = match[1]?.trim();
    const val = match[2]?.trim();
    if (
      testName &&
      val &&
      !/(?:Date|Tel|Phone|Age|Sex|Page|Dr|Ref|Time|Email|Address|Invoice|ID|No)/i.test(testName)
    ) {
      labResults.push({
        test_name: testName,
        result_value: val,
        unit: match[3]?.trim(),
        reference_range: match[4]?.trim(),
      });
    }
  }
  if (labResults.length > 0) {
    result.lab_results = labResults.slice(0, 30);
  }

  // 8. Detect Allergies
  const allergyMatch = rawText.match(/(?:Allerg(?:y|ies)|Known Allergy):\s*([^\n.;]+)/i);
  if (allergyMatch && allergyMatch[1]) {
    const allergyText = allergyMatch[1].trim();
    if (!/none|nil|n\/a|no known/i.test(allergyText)) {
      result.allergies = allergyText.split(/[,/]/).map((a) => a.trim()).filter(Boolean);
    }
  }

  // 9. Detect Follow-up instructions
  const followUpMatch = rawText.match(/(?:Follow\s*-?\s*up|Review|Next Visit):\s*([^\n;]+)/i);
  if (followUpMatch && followUpMatch[1]) {
    result.follow_up_instructions = followUpMatch[1].trim();
  }

  return result;
}
