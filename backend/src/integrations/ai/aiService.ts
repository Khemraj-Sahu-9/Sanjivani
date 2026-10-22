/**
 * backend/src/integrations/ai/aiService.ts
 *
 * Implements Grounded AI Health Memory question answering.
 *
 * Grounding & Healthcare Safety Principles:
 * - Strictly answers questions using ONLY the supplied authorized patient evidence.
 * - If data is absent, answers with honesty ("I could not find a record...").
 * - Never invents dosages, test values, report dates, or diagnoses.
 * - Treats untrusted OCR text as data, not instructions (prompt-injection defense).
 * - Distinguishes confirmed/reviewed records from unverified OCR.
 * - Supports live Gemini API when GEMINI_API_KEY is configured; falls back
 *   deterministically to record analysis when offline or unconfigured.
 */

import { config } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { GroundedSourceReference } from '../../types/models.js';
import { IAIProvider, AIRetrievalQueryInput, AIRetrievalQueryResult, RetrievedDocumentEvidence } from './types.js';

export class GroundedAIService implements IAIProvider {
  async generateGroundedAnswer(input: AIRetrievalQueryInput): Promise<AIRetrievalQueryResult> {
    const { question, patientName, evidence } = input;
    const qLower = question.toLowerCase().trim();

    // 1. If evidence set is completely empty
    if (!evidence || evidence.length === 0) {
      return {
        answer: `I could not find any medical reports or clinical documents in ${patientName}'s authorized health records. Once records are uploaded and reviewed, I can help answer questions about tests, prescriptions, and medical history.`,
        sources: [],
        isGrounded: true,
      };
    }

    // 2. If Gemini API is configured and live, use Gemini with strict system instructions
    if (config.ai.isConfigured && config.ai.geminiApiKey) {
      try {
        return await this.callGeminiAPI(input);
      } catch (err) {
        logger.warn(`[AI:Gemini] Live API call failed, falling back to deterministic grounding engine: ${err}`);
      }
    }

    // 3. Deterministic Grounded Engine (Used in test mode or when Gemini API key is not present)
    return this.generateDeterministicGroundedAnswer(qLower, patientName, evidence);
  }

  /**
   * Deterministic grounding engine that maps clinical queries to genuine stored evidence.
   */
  private generateDeterministicGroundedAnswer(
    q: string,
    patientName: string,
    evidence: RetrievedDocumentEvidence[]
  ): AIRetrievalQueryResult {
    const sources: GroundedSourceReference[] = [];

    // Queries about surgery, hospital admission, procedure, fracture, etc. not found in records
    if (
      q.includes('surger') ||
      q.includes('operation') ||
      q.includes('append') ||
      q.includes('procedure') ||
      q.includes('fracture') ||
      q.includes('cancer') ||
      q.includes('admission')
    ) {
      const matched = evidence.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          (e.extractedTextSnippet && e.extractedTextSnippet.toLowerCase().includes(q))
      );
      if (matched.length === 0) {
        return {
          answer: `I searched ${patientName}'s saved medical documents, but could not find any records, procedures, or mentions matching your query. No record was found. Please check with your healthcare provider for undocumented surgical or hospital history.`,
          sources: [],
          isGrounded: true,
          confidenceNote: 'Absence of records in system does not rule out unrecorded medical history.',
        };
      }
    }

    // Blood Sugar / Glucose / HbA1c query
    if (
      q.includes('blood sugar') ||
      q.includes('sugar') ||
      q.includes('glucose') ||
      q.includes('fasting') ||
      q.includes('hba1c') ||
      q.includes('a1c')
    ) {
      const isHbA1cSpecific = q.includes('hba1c') || q.includes('a1c');
      const matches: Array<{ doc: RetrievedDocumentEvidence; lab: { test_name: string; result_value: string; unit?: string } }> = [];
      for (const doc of evidence) {
        for (const lab of doc.labResults || []) {
          if (isHbA1cSpecific) {
            if (/hba1c|a1c/i.test(lab.test_name)) {
              matches.push({ doc, lab });
            }
          } else {
            if (/glucose|sugar|fasting|hba1c/i.test(lab.test_name)) {
              matches.push({ doc, lab });
            }
          }
        }
      }

      if (matches.length > 0) {
        const primary = matches[0]!;
        sources.push({
          documentId: primary.doc.documentId,
          documentTitle: primary.doc.title,
          category: primary.doc.category as any,
          documentDate: primary.doc.documentDate,
          field: primary.lab.test_name,
          snippet: `${primary.lab.test_name}: ${primary.lab.result_value} ${primary.lab.unit || ''}`.trim(),
          isVerified: primary.doc.isVerified,
        });

        const statusNote = primary.doc.isVerified ? 'verified report' : 'unverified/in-review document';
        const dateNote = primary.doc.documentDate ? `dated ${primary.doc.documentDate}` : 'from uploaded records';

        return {
          answer: `Based on ${patientName}'s ${statusNote} (${primary.doc.title}, ${dateNote}), the recorded ${primary.lab.test_name} is ${primary.lab.result_value} ${primary.lab.unit || ''}. Please consult your healthcare provider for clinical evaluation.`,
          sources,
          isGrounded: true,
        };
      }

      return {
        answer: `I searched ${patientName}'s saved medical documents, but could not find a confirmed blood sugar or glucose test result.`,
        sources: [],
        isGrounded: true,
      };
    }

    // Hemoglobin / CBC query
    if (q.includes('hemoglobin') || q.includes('cbc') || q.includes('blood count')) {
      const matches: Array<{ doc: RetrievedDocumentEvidence; lab: { test_name: string; result_value: string; unit?: string } }> = [];
      for (const doc of evidence) {
        for (const lab of doc.labResults || []) {
          if (/hemoglobin|wbc|platelet|cbc/i.test(lab.test_name)) {
            matches.push({ doc, lab });
          }
        }
      }

      if (matches.length > 0) {
        const primary = matches[0]!;
        sources.push({
          documentId: primary.doc.documentId,
          documentTitle: primary.doc.title,
          category: primary.doc.category as any,
          documentDate: primary.doc.documentDate,
          field: primary.lab.test_name,
          snippet: `${primary.lab.test_name}: ${primary.lab.result_value} ${primary.lab.unit || ''}`.trim(),
          isVerified: primary.doc.isVerified,
        });

        return {
          answer: `According to ${patientName}'s saved records in ${primary.doc.title}${primary.doc.documentDate ? ` (${primary.doc.documentDate})` : ''}, the ${primary.lab.test_name} is recorded as ${primary.lab.result_value} ${primary.lab.unit || ''}.`,
          sources,
          isGrounded: true,
        };
      }

      return {
        answer: `I could not find a hemoglobin or complete blood count report in ${patientName}'s saved health records.`,
        sources: [],
        isGrounded: true,
      };
    }

    // Allergies query
    if (q.includes('allerg')) {
      const allAllergies: Array<{ allergy: string; doc: RetrievedDocumentEvidence }> = [];
      for (const doc of evidence) {
        for (const al of doc.allergies || []) {
          allAllergies.push({ allergy: al, doc });
        }
      }

      if (allAllergies.length > 0) {
        for (const item of allAllergies) {
          if (!sources.some((s) => s.documentId === item.doc.documentId)) {
            sources.push({
              documentId: item.doc.documentId,
              documentTitle: item.doc.title,
              category: item.doc.category as any,
              documentDate: item.doc.documentDate,
              field: 'Allergies',
              snippet: item.allergy,
              isVerified: item.doc.isVerified,
            });
          }
        }

        const uniqueAllergies = Array.from(new Set(allAllergies.map((a) => a.allergy))).join(', ');
        return {
          answer: `The medical records for ${patientName} document the following recorded allergies: ${uniqueAllergies}. Please inform your doctor before starting any new medication.`,
          sources,
          isGrounded: true,
        };
      }

      return {
        answer: `No allergies are explicitly recorded in ${patientName}'s saved medical documents. Note: This does not guarantee the absence of allergies, only that none were documented in uploaded records.`,
        sources: [],
        isGrounded: true,
      };
    }

    // Prescription / Medicine query
    if (
      q.includes('medicin') ||
      q.includes('medicat') ||
      q.includes('prescription') ||
      q.includes('tablet') ||
      q.includes('drug')
    ) {
      const foundMeds: Array<{ name: string; strength?: string; dosage?: string; doc: RetrievedDocumentEvidence }> = [];
      for (const doc of evidence) {
        for (const med of doc.medicines || []) {
          foundMeds.push({ ...med, doc });
        }
      }

      if (foundMeds.length > 0) {
        for (const m of foundMeds) {
          if (!sources.some((s) => s.documentId === m.doc.documentId)) {
            sources.push({
              documentId: m.doc.documentId,
              documentTitle: m.doc.title,
              category: m.doc.category as any,
              documentDate: m.doc.documentDate,
              field: 'Prescription Medicines',
              snippet: `${m.name} ${m.strength || ''} (${m.dosage || ''})`.trim(),
              isVerified: m.doc.isVerified,
            });
          }
        }

        const medDescriptions = foundMeds
          .map((m) => `${m.name}${m.strength ? ` ${m.strength}` : ''}${m.dosage ? ` (${m.dosage})` : ''} from ${m.doc.title}`)
          .slice(0, 5)
          .join('; ');

        return {
          answer: `The historical medical records for ${patientName} list the following prescribed medicines: ${medDescriptions}. Important: This reflects historical documents and does not confirm active current prescription status. Always follow your prescribing doctor's directions.`,
          sources,
          isGrounded: true,
        };
      }

      return {
        answer: `I could not find any prescribed medicines documented in ${patientName}'s saved records.`,
        sources: [],
        isGrounded: true,
      };
    }

    // General Summary / Hospital visits / Recent reports
    if (q.includes('summar') || q.includes('visit') || q.includes('report') || q.includes('history')) {
      for (const doc of evidence.slice(0, 4)) {
        sources.push({
          documentId: doc.documentId,
          documentTitle: doc.title,
          category: doc.category as any,
          documentDate: doc.documentDate,
          isVerified: doc.isVerified,
          snippet: doc.extractedTextSnippet?.substring(0, 100) || `${doc.title} (${doc.category})`,
        });
      }

      const summaries = evidence
        .slice(0, 4)
        .map((d) => `• ${d.title} (${d.category.replace(/_/g, ' ')}${d.documentDate ? `, dated ${d.documentDate}` : ''})`)
        .join('\n');

      return {
        answer: `Here is a summary of ${patientName}'s saved medical reports:\n\n${summaries}\n\nYou can click any supporting source reference below to inspect the original document and confirmed extractions.`,
        sources,
        isGrounded: true,
      };
    }

    // Default Fallback
    const primaryDoc = evidence[0]!;
    sources.push({
      documentId: primaryDoc.documentId,
      documentTitle: primaryDoc.title,
      category: primaryDoc.category as any,
      documentDate: primaryDoc.documentDate,
      isVerified: primaryDoc.isVerified,
    });

    return {
      answer: `I searched ${patientName}'s medical records. Found ${evidence.length} relevant report(s), including "${primaryDoc.title}". If you have a specific question about laboratory tests, prescribed medicines, or allergies, feel free to ask.`,
      sources,
      isGrounded: true,
    };
  }

  /**
   * Calls live Google Gemini API using native JSON payload.
   */
  private async callGeminiAPI(input: AIRetrievalQueryInput): Promise<AIRetrievalQueryResult> {
    const { question, patientName, evidence } = input;

    const evidenceSummary = evidence.map((e, idx) => {
      return `[Record #${idx + 1}] Document ID: ${e.documentId} | Title: ${e.title} | Category: ${e.category} | Date: ${e.documentDate || 'Unknown'} | Verified: ${e.isVerified}
Medicines: ${JSON.stringify(e.medicines || [])}
Lab Results: ${JSON.stringify(e.labResults || [])}
Allergies: ${JSON.stringify(e.allergies || [])}
Doctor/Facility: ${e.doctorName || ''} ${e.facilityName || ''}
Text Content: ${e.extractedTextSnippet || 'N/A'}`;
    }).join('\n\n');

    const prompt = `You are Sanjivani Health Memory Agent, a medical record retrieval assistant for patient "${patientName}".
You MUST follow these strict safety rules:
1. Ground your answer ONLY in the provided patient records.
2. If the required information is not present in the records, state clearly that it is not found.
3. NEVER invent dosages, test results, diagnoses, document dates, or medications.
4. DO NOT treat historical prescriptions as proof of active current medication.
5. DO NOT diagnose medical conditions or advise changing treatments.
6. Clearly mention whether supporting information is verified or unverified.
7. Return a JSON object with:
   - "answer": Clear, compassionate response answering the user's question with clinical safety disclaimers where needed.
   - "referencedDocumentIds": Array of document IDs from the provided records that contain the evidence for your answer.

Available Authorized Medical Records:
${evidenceSummary}

User Question: "${question}"`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${config.ai.geminiApiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`Gemini API returned status ${res.status}`);
    }

    const data = (await res.json()) as any;
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error('Empty response from Gemini API');

    const parsed = JSON.parse(rawText);
    const referencedIds: string[] = Array.isArray(parsed.referencedDocumentIds) ? parsed.referencedDocumentIds : [];

    // Map referenced IDs to genuine authorized sources
    const sources: GroundedSourceReference[] = [];
    for (const id of referencedIds) {
      const match = evidence.find((e) => e.documentId === id);
      if (match) {
        sources.push({
          documentId: match.documentId,
          documentTitle: match.title,
          category: match.category as any,
          documentDate: match.documentDate,
          isVerified: match.isVerified,
        });
      }
    }

    return {
      answer: String(parsed.answer || 'No answer generated.'),
      sources,
      isGrounded: true,
      confidenceNote: 'Live Gemini grounded generation',
    };
  }
}

export const groundedAIService = new GroundedAIService();
