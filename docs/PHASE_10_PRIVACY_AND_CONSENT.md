# PHASE 10 — PRIVACY, CONSENT OPERATIONS & DATA GOVERNANCE

> **Sanjivani (Health Memory Agent)**  
> **Document:** Privacy Policy, Consent Architecture, and Data Governance Framework  
> **Compliance Standard:** DPDP Act 2023, ABDM Consent Guidelines, ISO/IEC 27701  
> **Date:** October 2026  

---

## 1. Consent Management Architecture

Sanjivani implements a granular, verifiable, and revocable consent architecture aligned with the Digital Personal Data Protection Act 2023 (DPDP Act) and the ABDM electronic consent framework.

```
       +-----------------------------------------------------------+
       |                     DATA PRINCIPAL                        |
       |             (Patient or Authorized Guardian)              |
       +-----------------------------------------------------------+
                                     |
                                     v
       +-----------------------------------------------------------+
       |               ELECTRONIC CONSENT ARTEFACT                 |
       |  • Principal ID & Beneficiary ID                          |
       |  • Specified Purpose (e.g., "AI Health Summary Review")   |
       |  • Data Granularity (Prescriptions, Labs, Timeline)       |
       |  • Permitted Processors (Gemini AI, Doctor Portal)        |
       |  • Time-Bounded Validity (e.g., 24h, 30 days)             |
       |  • Revocation Mechanism (Active / Revoked)                |
       +-----------------------------------------------------------+
                 /                       |                      \
                v                        v                       v
     [Document OCR Engine]     [AI Health Memory]      [Hospital Handoff]
```

### 1.1 Consent Modalities

#### A. Adult Direct Consent
- Individuals aged 18 and older exercise direct consent for the collection, processing, and sharing of their personal medical data.
- Consent is captured with affirmative action (opt-in checkbox, digital signature, or authenticated session confirmation).
- Captured metadata: `user_id`, `patient_id`, `purpose`, `timestamp`, `ip_address`, `user_agent`, and `policy_version`.

#### B. Guardian & Parental Consent (Minors & Incapacitated Dependents)
- Required for minors under 18 years of age or elderly dependents under legal guardianship.
- The guardian must declare their legal relationship (`father`, `mother`, `legal_guardian`, `court_appointed_caregiver`).
- The system flags records as `guardian_managed: true` and logs the guardian's authenticated identifier alongside the beneficiary.
- Minors transitioning to age 18 automatically trigger a consent re-affirmation workflow upon their next login.

---

## 2. External Report Sharing & Granular Doctor Access

Patients and family owners frequently need to share medical summaries with visiting physicians, diagnostic laboratories, or consulting clinics.

### 2.1 Time-Bounded Access Links
1. **Cryptographic Tokens:** Access is granted via cryptographically random 256-bit URL-safe tokens.
2. **Strict Expiration:** Default expiration is 24 hours, configurable up to a maximum of 7 days. Once expired, the link returns HTTP 410 Gone.
3. **Granular Scoping:**
   - `summary_only`: Access restricted to the doctor-ready clinical PDF summary.
   - `timeline_view`: Access includes chronological history and active medications.
   - `full_records`: Access includes original scanned diagnostic reports.
4. **Immediate Revocation:** The family owner or patient can instantly invalidate any active share link from the security dashboard.
5. **Access Audit Logging:** Every access by an external link is logged with timestamp, client IP, user agent, and specific records retrieved.

---

## 3. AI Data Processing Boundaries & Model Ethics

Sanjivani leverages Google Gemini LLMs for unstructured document analysis, entity extraction, and conversational health queries.

### 3.1 Zero Data Retention & Training Guarantees
- **No Training on Patient Data:** Enterprise terms of service for Google Gemini API guarantee that prompts, uploaded medical documents, and generated responses are **NEVER used to train, fine-tune, or improve foundational AI models**.
- **Ephemeral Processing:** Text and document snippets sent to the AI engine are processed in memory during the inference call and immediately discarded by the provider.

### 3.2 Human-in-the-Loop Safeguard
- AI OCR extractions (diagnoses, medications, dosages, lab values) are strictly quarantined in a `PENDING_REVIEW` state.
- Extracted data is **never committed to active patient records** or made accessible to emergency handoffs until explicitly verified and confirmed by a human (the patient or their family caregiver).

### 3.3 Hallucination Defense & Strict Grounding
- Prompts use system-level constraints requiring the model to cite the exact document date and source title for every factual statement.
- If a user asks about a condition, allergy, or lab value not present in verified documents, the model is instructed to explicitly state: *"No verified medical records in your timeline contain information regarding [requested topic]. Please consult your doctor."*

---

## 4. Data Subject Rights: Export & Right to Erasure (DPDP Act Compliance)

### 4.1 Comprehensive Data Portability (Export)
Under Section 11 of the DPDP Act, users have the right to receive a machine-readable export of all stored data:
1. **JSON Data Package:** Contains patient profiles, family workspace metadata, complete medication schedules and adherence logs, appointment histories, community assistance requests, and consent logs.
2. **Document Binary Archive:** All uploaded medical files (PDFs, images) bundled in a secure archive.
3. **Execution Endpoint:** `POST /api/users/me/export` generates an export package and returns an expiring download link.

### 4.2 Right to Erasure / Complete Account Deletion
Under Section 12 of the DPDP Act, users may request the permanent deletion of their account and all personal health information:
1. **Multi-Table Cascading Purge:**
   - `users` & `auth.users` authentication records.
   - `family_members` & `family_workspaces`.
   - `patient_profiles` & `caregiver_assignments`.
   - `medical_documents`, `document_extractions`, and binary storage objects.
   - `medication_schedules` & `medication_occurrences`.
   - `appointments` & scheduled reminders.
   - `emergency_contacts` & `live_test_recipients`.
   - `community_requests`, `group_memberships`, and `blood_donor_registry` entries.
2. **Audit Logging Anonymization:** System-level audit entries are anonymized (user identifiers replaced with cryptographically salted hashes) to maintain audit integrity for regulatory compliance without retaining personal identifiable data (PII).
3. **Deletion Confirmation Receipt:** Upon completion, the system generates a cryptographically signed deletion certificate containing the deletion timestamp, purged entity counts, and verification hash.
