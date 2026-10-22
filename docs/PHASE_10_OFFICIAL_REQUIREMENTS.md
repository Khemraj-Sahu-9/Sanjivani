# PHASE 10 — OFFICIAL REGULATORY & INTEGRATION REQUIREMENTS

> **Sanjivani (Health Memory Agent)**  
> **Document:** Official Indian Digital Health & Privacy Architecture Specifications  
> **Primary References:** National Health Authority (NHA) / ABDM, Ministry of Electronics and Information Technology (MeitY) / DPDP Act 2023, Central Drugs Standard Control Organisation (CDSCO)  
> **Date of Compilation:** October 2026  

---

## 1. Ayushman Bharat Digital Mission (ABDM) Integration Architecture

The National Health Authority (NHA) under the Ministry of Health and Family Welfare (MoHFW), Government of India, administers the **Ayushman Bharat Digital Mission (ABDM)** to create an interoperable national digital health ecosystem.

### 1.1 Official Portals & Developer Entry Points
- **ABDM Ecosystem Sandbox Portal:** [https://sandbox.abdm.gov.in/](https://sandbox.abdm.gov.in/)
- **ABDM Developer Documentation & API Specifications:** [https://abdm.gov.in/home/developers](https://abdm.gov.in/home/developers)
- **NHA GitHub & Swagger Repositories:** [https://github.com/project-sunbird](https://github.com/project-sunbird) / [https://sandbox.abdm.gov.in/docs/](https://sandbox.abdm.gov.in/docs/)
- **National Resource Centre for EHR Standards (NRCeS):** [https://www.nrces.in/](https://www.nrces.in/)

### 1.2 ABDM Milestone Certification Framework
To become an accredited digital health software application within the ABDM ecosystem, Sanjivani must progress through three formalized development milestones:

| Milestone | Scope & Functional Role | Sanjivani System Mapping |
| :--- | :--- | :--- |
| **Milestone 1 (M1)** | **ABHA Creation & Verification**<br>• Create ABHA number via Aadhaar / Mobile OTP.<br>• Verify and authenticate existing ABHA numbers.<br>• Link ABHA Address (`alias@abdm`) to personal health record. | **Implemented in Adapter Interface (`backend/src/integrations/abdm/`)**<br>Simulated in dev/demo mode; ready for sandbox credential deployment. Distinct from internal `SNJ-` identifier. |
| **Milestone 2 (M2)** | **Health Information Provider (HIP)**<br>• Link patient records via Discovery API (`/v0.5/care-contexts/discover`).<br>• Accept consent artefacts from Consent Manager.<br>• Encrypt and transfer health data to requesting HIU via FHIR R4 bundles. | **Care-Context Architecture**<br>Medical documents and prescription records are indexed with unique `care_context_id` ready for FHIR export upon validated consent. |
| **Milestone 3 (M3)** | **Health Information User (HIU)**<br>• Initiate consent request for a patient from external hospitals/diagnostic labs.<br>• Receive encrypted FHIR clinical bundles.<br>• Decrypt and ingest historical diagnostic reports into health memory. | **Health Memory Query Interface**<br>Aggregates external clinical reports alongside family-uploaded records once consent is granted by patient via ABDM PHR app. |

### 1.3 Identification Architecture: ABHA vs. Sanjivani Internal ID
To prevent identity spoofing, compliance confusion, and data contamination, Sanjivani strictly enforces a architectural duality:
1. **Sanjivani Internal Identifier (`patient_health_id`):**
   - Format: `SNJ-YYYY-XXXX-XXXX` (e.g., `SNJ-2026-9A82-4C1F`).
   - Purpose: Family workspace scoping, local offline index, zero-dependency prototype operations.
   - Authority: Generated and verified by Sanjivani auth service.
2. **Ayushman Bharat Health Account (ABHA Number):**
   - Format: 14-digit numeric code formatted as `XX-XXXX-XXXX-XXXX` (e.g., `14-1234-5678-9012`).
   - Authority: Issued solely by NHA via UIDAI Aadhaar e-KYC or verified mobile OTP.
   - **ABHA Address:** Human-readable handle formatted as `<username>@abdm` or `<username>@sbx` for sandbox testing.

### 1.4 Clinical Data Standards: FHIR R4 Specification
Under the NRCeS and NHA guidelines, all medical data shared across ABDM must conform to the **HL7 FHIR Release 4 (R4)** standard profiles adapted for India:
- **DiagnosticReport Profile:** Clinical lab results, diagnostic radiology, blood biochemistry panels.
- **MedicationRequest Profile:** Prescription metadata, medicine name, dosage, frequency, route, and prescribing physician registration number.
- **Condition Profile:** Diagnosed active clinical conditions, ICD-10 / SNOMED CT coded entries.
- **Patient Profile:** Name, gender, birth date, ABHA identifier, masked telecom.
- **DocumentReference Profile:** Binary doctor-ready PDF summaries and scanned prescription attachments.

---

## 2. Digital Personal Data Protection Act 2023 (DPDP Act 2023)

Enacted by the Parliament of India in August 2023, the DPDP Act 2023 establishes statutory guardrails for processing digital personal data.

### 2.1 Sanjivani Legal Classification
- **Data Fiduciary:** Sanjivani determines the purpose and means of processing personal health data submitted by patients and families.
- **Data Processor:** Integrated third-party services (e.g., Supabase PostgreSQL, Google Cloud Gemini AI, Twilio/Exotel) process data on behalf of Sanjivani under binding contractual safeguards.
- **Data Principal:** The individual patient or family member to whom the personal health data relates.

### 2.2 Statutory Consent Notice Requirements (Section 5)
Every user must receive an itemized, clear notice prior to data collection:
1. **Plain Language Notice:** Clear description of what personal data is collected (names, phone numbers, medical reports, prescriptions, emergency contacts).
2. **Specified Purpose:** Explicitly stating that data is used solely for personal health memory indexing, medication reminders, family caregiver sharing, and emergency handoff.
3. **Withdrawal Mechanism:** Users may withdraw consent at any time through application settings, stopping further processing without retroactive penalty.
4. **Multilingual Access:** Notices must be available in English and any of the 22 languages specified in the Eighth Schedule of the Constitution of India (Hindi, Bengali, Marathi, Tamil, Telugu, etc.).

### 2.3 Protection of Minors & Persons with Disabilities (Section 9)
1. **Verifiable Parental/Guardian Consent:** For any patient under 18 years of age, or an individual under legal guardianship, explicit affirmative consent from a verified parent or guardian is required.
2. **Prohibition of Tracking & Behavioral Profiling:** The platform strictly prohibits behavioral tracking, targeted advertising, or algorithmic profiling directed at minors.
3. **No Detrimental Processing:** System features must never process children's health records in any manner harmful to their well-being.

### 2.4 Rights of the Data Principal (Sections 11–14)
- **Right to Access Information:** Summary of personal data being processed, identities of all third-party data processors, and data transfer audit logs.
- **Right to Correction & Erasure:** Capability to update erroneous health information or request complete deletion of the account and associated medical files.
- **Right of Grievance Redressal:** Designated Data Protection Officer (DPO) contact and published response timeline (maximum 7 business days) before escalation to the Data Protection Board of India (DPBI).
- **Right to Nominate:** Capability for a Data Principal to nominate a successor/representative to exercise rights in the event of death or incapacity.

### 2.5 Security Safeguards & Breach Notification (Section 8)
- Mandatory implementation of technical safeguards: AES-256 encryption at rest, TLS 1.3 in transit, tenant isolation, and RBAC.
- In the event of a personal data breach, immediate intimation to both the **Data Protection Board of India (DPBI)** and each affected Data Principal.

---

## 3. Medical Device & Clinical Decision Support (CDSCO / SaMD Regulations)

Regulatory oversight of medical software in India is governed by the **Central Drugs Standard Control Organisation (CDSCO)** under the *Medical Devices Rules, 2017* (and subsequent notifications regarding Software as a Medical Device - SaMD).

### 3.1 Software Classification
Sanjivani is deliberately architected and legally scoped as a **Personal Health Record (PHR) / Assistive Health Memory Platform**, NOT a Software as a Medical Device (SaMD):
- **Does NOT Provide Clinical Diagnosis:** Sanjivani never issues a standalone medical diagnosis, interprets imaging radiographs autonomously, or predicts specific clinical outcomes.
- **Does NOT Autonomously Prescribe or Adjust Therapy:** The medication engine only stores and reminds users of regimens explicitly confirmed by registered practitioners or patients.
- **Does NOT Deliver Emergency Dispatch:** The emergency workflow provides a structured handoff document for clinical professionals; it does not dispatch ambulances or triage life-threatening trauma.

### 3.2 Statutory Clinical Disclaimer
The following disclaimer is permanently integrated into all application interfaces, AI memory responses, and PDF exports:

```
+-----------------------------------------------------------------------------------+
|                           CLINICAL & STATUTORY DISCLAIMER                         |
| Sanjivani is an assistive health memory and document organization platform.       |
| It is NOT a medical device, diagnostic engine, or emergency dispatch system.     |
| Information generated by this software is for informational reference only and    |
| must be reviewed and interpreted by a Registered Medical Practitioner (RMP).      |
| IN A MEDICAL EMERGENCY, IMMEDIATELY CALL 112 OR YOUR LOCAL EMERGENCY HOSPITAL.    |
+-----------------------------------------------------------------------------------+
```

---

## 4. Hospital Emergency Department Integration Pre-requisites

For Sanjivani to interface with real hospital emergency departments (Emergency Medicine Departments / Casualty Units):
1. **HL7 / FHIR Ingestion Gateway:** Hospital must provide an authenticated HL7 v2.x (ADT/MDM) or FHIR R4 endpoint secured via mutual TLS (mTLS) or OAuth 2.0.
2. **Business Associate / Interoperability Agreement:** Formal data sharing agreement specifying liability, data retention, and emergency notification SLAs.
3. **Primary Caregiver Fallback:** If the hospital receiving endpoint is unreachable (HTTP 5xx, network timeout), the system must immediately fall back to notifying designated family caregivers directly via SMS/voice.
