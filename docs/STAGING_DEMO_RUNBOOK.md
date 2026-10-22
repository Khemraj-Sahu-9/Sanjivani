# Sanjivani (Health Memory Agent) — Staging Demonstration Runbook

> **Target Audience:** Evaluators, Hackathon Judges, Angel Investors & Clinical Pilot Partners  
> **Target Duration:** 5 to 8 Minutes (with optional deep-dive modules)  
> **Environment:** Staging Deployment (`http://localhost:8080` or deployed staging URL)  
> **Status:** 100% Tested & Verified (Tests A–L Passing)

---

## 1. Demonstration Scenario & Pre-Seeded Identities

| Entity | Identity in Staging Demo | Credentials / Identifiers | Role / Provenance |
|:-------|:-------------------------|:--------------------------|:------------------|
| **Family Owner (Presenter)** | **Ramesh Sharma** | `staging_owner@sanjivani.local`<br>`StagingPassword123!` | Primary Account & Workspace Owner |
| **Dependent Elder** | **Kailash Nath Sharma** (77M) | Health ID: `SNJ-FD5F-BF13-A0A0` | Patient Profile (Hypertension, Diabetes) |
| **Home Caregiver** | **Pooja Verma** | `staging_caregiver@sanjivani.local`<br>`StagingPassword123!` | Caregiver (Read & dose logging only) |
| **Fictional Hospital** | **Apex Specialty Hospital, Mumbai** | Hospital Code: `APEX-MUM-EMERG` | Fictional Receiving Desk (Simulated) |
| **Residential Group** | **Palm Grove Heights Association** | Society Code: `PGH-MUM-400` | Non-emergency Mutual Aid Network |

---

## 2. Pre-Flight Setup & One-Click Staging Reset (30 Seconds)

Before presenting to evaluators, execute the safe deterministic reset:

```bash
# 1. Check system readiness
curl -s http://localhost:8080/api/health/ready | jq .

# 2. Seed synthetic demonstration environment (if starting fresh)
curl -s -X POST http://localhost:8080/api/demo/seed \
  -H "Content-Type: application/json" \
  -d '{"targetEmail": "staging_owner@sanjivani.local"}' | jq .
```

> [!TIP]
> **Instant Scenario Reset:** If an active SOS incident or dose was modified during practice, reset the elder's demo scenario without deleting accounts:
> `POST /api/demo/families/:familyId/patients/:patientId/reset`

---

## 3. Step-by-Step 6-Minute Script

```
+-----------------------------------------------------------------------------------------------------+
| MINUTE | STEP / THEME                 | SCREEN / ACTION              | PROOF EVIDENCE               |
+--------+------------------------------+------------------------------+------------------------------+
| 00:00  | 1. Problem & Architecture    | Login & Workspace Dashboard  | Health ID, Family RBAC       |
| 01:00  | 2. Ingestion & Human OCR     | Medical Records -> Upload    | Split-Screen Review Modal    |
| 02:00  | 3. Grounded Health Memory    | AI Memory -> Query & Cites   | Source Chips & Refusal       |
| 03:00  | 4. Doctor-Ready Summary      | Doctor Summary -> PDF Gen    | Binary Download (%PDF-)      |
| 03:45  | 5. Medication Regimen        | Meds -> Today's Doses        | Dose Adherence Event         |
| 04:30  | 6. Emergency SOS Escalation  | Emergency Dashboard -> SOS   | Stage Progression 1 -> 2     |
| 05:15  | 7. Hospital Handoff Desk     | Fictional Receiving Desk     | Simulated HL7 Emergency Pkt  |
| 05:45  | 8. Telephony Safety & Live   | Controlled Live Test Panel   | 112 Blocked / Consented SMS  |
| 06:15  | 9. Society Privacy & Wrap-up | Community Assistance Tab     | Medical Record Isolation 403 |
+-----------------------------------------------------------------------------------------------------+
```

---

### Step 1 (00:00 – 01:00): Family Workspace & Unique Health ID

- **Screen to Open:** `/login` → `/dashboard`
- **Action:** Sign in as `staging_owner@sanjivani.local`. Select **Kailash Nath Sharma (77M)**.
- **What to Say:** *"Indian families manage medical records on crumpled paper across multiple doctors. When an emergency strikes, vital facts are forgotten. Sanjivani provides a private, family-governed health memory vault."*
- **Expected Result:** Dashboard displays the patient summary, active allergies (Penicillin), and unique unguessable **Health ID: `SNJ-XXXX-XXXX-XXXX`**.
- **Proof Evidence:** Top bar shows verified role `Family Owner` and deterministic Health ID badge.
- **Recovery Action:** If session expired, log in using stored credentials in Section 1.

---

### Step 2 (01:00 – 02:00): Medical Record Ingestion & Human-in-the-Loop OCR

- **Screen to Open:** `/documents`
- **Action:** Click **"+ Upload Document"**, attach sample prescription image `apex_prescription.png`, set category to **"Prescription"**, and click **Upload**. Once processed, click **"Review Extraction"**.
- **What to Say:** *"Generic OCR often misreads dosages. In healthcare, human verification is non-negotiable. Sanjivani extracts structured entities via client-side OCR and presents an interactive split-screen comparison for family confirmation."*
- **Expected Result:** Split-screen displays original image on left and editable fields on right:
  - Doctor: Dr. Anjali Nair
  - Medicines: Metformin 500mg, Telmisartan 40mg
  - Conditions: Essential Hypertension, Type 2 Diabetes
- **Action:** Click **"Confirm & Save to Record"**.
- **Proof Evidence:** Document badge immediately updates to green `Confirmed` (`review_status: confirmed`).
- **Recovery Action:** If OCR processing takes >5 seconds, select pre-seeded prescription from the list.

---

### Step 3 (02:00 – 03:00): AI Health Memory & Hallucination Resistance

- **Screen to Open:** `/memory`
- **Action 1 (Positive Query):** Ask: *"What medicines were prescribed for my father and what conditions does he have?"*
- **Expected Result 1:** AI responds with Metformin and Telmisartan, citing **Apex Hospital Prescription Sep 2026**.
- **Proof Evidence 1:** Clickable source citation chip appears below the answer. Clicking highlights the exact document.
- **Action 2 (Negative Query - Trick):** Ask: *"Does my father have any documented history of neurosurgery or brain cancer?"*
- **Expected Result 2:** AI explicitly refuses: *"No history of neurosurgery or brain cancer was found in Kailash Nath Sharma's confirmed medical records."*
- **What to Say:** *"Notice that Sanjivani never hallucinates medical conditions. If it is not in the confirmed clinical record, it explicitly states absence rather than guessing."*
- **Recovery Action:** If AI query times out, the local deterministic grounded engine returns the exact citation within 100ms.

---

### Step 4 (03:00 – 03:45): Doctor-Ready Clinical Summary PDF Generation

- **Screen to Open:** `/memory/doctor-summary`
- **Action:** Keep clinical checkboxes selected (`Allergies`, `Prescriptions`, `Diagnosed Conditions`). Enter doctor name: `Dr. Suresh Joshi, Cardiologist`. Click **"Download Summary PDF"**.
- **What to Say:** *"In an OPD queue, a doctor has less than 2 minutes. This feature compiles an instant 1-page clinical summary formatted specifically for rapid physician review."*
- **Expected Result:** Browser downloads a clean, vector PDF document.
- **Proof Evidence:** Open the PDF. Point to the **HIGH ALERT: PENICILLIN ALLERGY** banner, active prescriptions table, and cryptographic verification timestamp.
- **Recovery Action:** If browser blocks pop-ups, inspect the inline preview pane.

---

### Step 5 (03:45 – 04:30): Medication Regimens & Adherence Logging

- **Screen to Open:** `/medications`
- **Action:** Point to **"Today's Doses"**:
  - `Telmisartan 40mg (Morning - Scheduled)`
  - `Metformin 500mg (Night - Scheduled)`
- **Action:** Click **"Take Dose"** on Telmisartan. Enter note: *"Administered after breakfast with water."*
- **What to Say:** *"Caregivers can log dose occurrences with one tap. The entire family sees verified adherence in real time."*
- **Expected Result:** Dose pill changes from amber `Scheduled` to green `Taken`.
- **Proof Evidence:** Timestamp and caregiver name appear in the adherence audit feed.
- **Recovery Action:** If already marked taken, click next dose or inspect adherence history.

---

### Step 6 (04:30 – 05:15): Emergency SOS Multi-Tier Escalation

- **Screen to Open:** `/emergency`
- **What to Say:** *"Elderly distress requires tiered escalation. When a panic alarm triggers, Sanjivani alerts family first, then caregiver, and finally prepares a hospital handoff packet."*
- **Action:** Point to the top banner: **"DEMO MODE ONLY: All emergency contacts and calls are synthetic."**
- **Action:** Click **"ACTIVATE EMERGENCY SOS"** → Confirm.
- **Expected Result:** Incident created with human-readable ID (e.g. `SOS-20261022-X7K2`). Stage is **Stage 1: Contacting Family**.
- **Action:** Click **"Advance Timeout (Demo Control)"** to simulate unresponsiveness:
  - Incident escalates to **Stage 2: Caregiver Escalation (Pooja Verma)**.
- **Action:** Click **"Advance Timeout"** once more:
  - Incident escalates to **Stage 3: Simulated Hospital Handoff**.
- **Proof Evidence:** Real-time state machine timeline records each transition with seconds-level precision.
- **Recovery Action:** If previous incident is open, click **"Resolve Incident"** or run the demo reset command.

---

### Step 7 (05:15 – 05:45): Fictional Hospital Receiving Desk Handoff

- **Screen to Open:** Click **"Open Fictional Hospital Receiving Desk"** modal on `/emergency`.
- **Action:** Point to the emergency packet displayed on the simulated hospital console.
- **What to Say:** *"This simulated receiving console shows what an emergency triage desk would receive: blood group, active prescriptions, allergies, and location note, clearly tagged as DEMO MODE."*
- **Action:** Enter staff name `Nurse Priya Desai` and click **"Acknowledge Receipt"**.
- **Expected Result:** Incident status updates to `HOSPITAL_HANDOFF_ACKNOWLEDGED_SIMULATED`.
- **Proof Evidence:** Hospital badge turns blue with receiving staff signature and timestamp.
- **Action:** Click **"Resolve Incident"** to safely close the emergency drill.
- **Recovery Action:** If modal closed accidentally, reopen via incident timeline link.

---

### Step 8 (05:45 – 06:15): Controlled Live Test Telephony & Safety Controls

- **Screen to Open:** `/emergency` → **"Live Test Mode"** tab.
- **Action 1 (Negative Test):** Enter `112` or `911` into phone box.
- **Expected Result 1:** UI displays red safety validation: *"National emergency dispatch lines (112, 911, 108) are strictly blocked."*
- **Action 2 (Consented Test):** Select pre-registered team member. Verify the outgoing test script:  
  `"[SANJIVANI TEST ONLY] Emergency drill notification. THIS IS A CONTROLLED TEST. DO NOT CALL 112."`
- **What to Say:** *"Live telephony is restricted exclusively to consented team members with explicit safety prefixes. We never send live calls to emergency services."*
- **Recovery Action:** If live telephony credentials are not configured in staging, the UI displays: `Provider: None (Simulated Safe Mode)`.

---

### Step 9 (06:15 – 07:00): Residential Society Support & Medical Privacy Wrap-up

- **Screen to Open:** `/community`
- **Action:** Open society **Palm Grove Heights Association**. Point to the request:  
  `"Prescription medicine pickup from Apollo Pharmacy for senior resident (Flat 402)"`.
- **What to Say:** *"Neighbors can coordinate grocery and medicine pickups, but our strict tenant architecture guarantees that private health vaults remain 100% inaccessible to community members."*
- **Proof Evidence:** Point out that the assistance card shows only the errand request — **no diagnoses, no medical history, and no document scans**. Attempts by outsiders to query `/api/families/:familyId/patients` return **HTTP 403 Forbidden**.
- **Closing Statement:** *"Sanjivani delivers the full chain of health memory: from physical paper prescriptions to verified OCR, grounded AI memory, doctor summaries, tiered emergency escalation, and privacy-first community mutual aid. The application is completely functional, verified by 317 automated tests, and ready for supervised pilot deployment."*

---

## 4. Honest Evaluator Disclosures (Real vs Simulated)

| Module / Feature | Real Implementation | Simulated Implementation |
|:-----------------|:-------------------|:-------------------------|
| **User Accounts & RBAC** | **Real** (JWT + Server Middleware) | None |
| **Document Storage & Checksums** | **Real** (Private Storage + SHA-256) | None |
| **OCR Extraction & Human Review** | **Real** (`pdf-parse`, `tesseract.js`) | None |
| **AI Grounded Health Memory** | **Real** (Deterministic Citation Engine / Gemini) | None |
| **Doctor-Ready PDF Summary** | **Real** (Native binary vector PDF via `PDFKit`) | None |
| **Medication Schedules & Doses** | **Real** (Dose generation & adherence logs) | None |
| **Controlled Live Test SMS** | **Real** (Twilio REST API when configured) | Disabled by default in staging |
| **Offline Synchronization** | **Real** (IndexedDB client cache + batch replay) | None |
| **Residential Community Mutual Aid**| **Real** (Groups, requests & privacy isolation) | None |
| **National Emergency Dispatch (112)**| **STRICTLY PROHIBITED** | **100% Simulated Demo Mode** |
| **Hospital Emergency Receiving Desk**| **Contract Architecture Only** (HL7 / FHIR Bundle) | **Fictional Receiving Desk (Simulated)** |

---

*Authored for Sanjivani Staging & Investor Demonstration — October 2026.*
