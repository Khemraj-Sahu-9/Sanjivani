# SANJIVANI FUNDING DEMONSTRATION RUNBOOK
## Executive Investor & Incubator Presentation Guide (Phases 0–9)

> **Platform:** Sanjivani — The AI-Powered Family Health Memory & Emergency Assistance Agent  
> **Target Audience:** Healthcare Venture Investors, Hackathon Judges, Incubator Selection Committees  
> **Document Version:** 1.0 (Phase 9 Quality Release)  
> **Last Verified:** October 2026

---

## 1. Executive Overview & Mission

Millions of elderly individuals and chronic disease patients in India and worldwide face severe healthcare fragmentation. Critical medical histories, past prescriptions, and lab tests remain locked in paper files, illegible handwritten slips, and disjointed WhatsApp photos. When an emergency strikes, or when consulting a new specialist, families struggle to convey vital facts: existing conditions, drug allergies, and current medications.

**Sanjivani (Health Memory Agent)** solves this crisis through three core innovations:
1. **Intelligent Paper-to-Digital Memory:** Secure medical document capture with OCR, human-in-the-loop review, and grounded RAG that never hallucinates facts.
2. **Coordinated Family & Caregiver Workflow:** Confirmed medication tracking, missed-dose escalation, and doctor-ready clinical summaries generated in seconds.
3. **Emergency SOS & Community Support:** Simulated emergency triage escalation, fictional hospital receiving handoffs, controlled live test telephony, and neighborhood volunteer networks.

---

## 2. Demonstration Architecture & Operating Modes

Sanjivani supports two primary operating environments:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        SANJIVANI APPLICATION                           │
├──────────────────────────────────┬─────────────────────────────────────┤
│      1. DEMO / SCAFFOLD MODE     │         2. PRODUCTION MODE          │
│        (DEMO_MODE=true)          │          (DEMO_MODE=false)          │
├──────────────────────────────────┼─────────────────────────────────────┤
│ • Zero external credentials req. │ • Backed by live Supabase Postgres  │
│ • In-memory relational database  │ • Supabase Auth JWT sessions        │
│ • Deterministic grounded AI RAG  │ • Google Cloud Vision OCR           │
│ • Built-in simulated emergency   │ • Google Gemini Live LLM RAG        │
│ • Instant setup on any laptop    │ • Twilio / Exotel Telephony APIs    │
└──────────────────────────────────┴─────────────────────────────────────┘
```

> **For Investors/Judges:** The application can run 100% locally in `DEMO_MODE=true` without risking external API rate limits, network outages, or third-party service downtime during a high-stakes presentation.

---

## 3. Honest Technical Disclosures (Live vs. Simulated vs. Mock)

To maintain absolute ethical integrity and compliance with healthcare software standards, present the following honest disclosures:

| Capability | Demonstration Implementation | Production Status & Next Steps |
| :--- | :--- | :--- |
| **Authentication & Workspaces** | **Live & Functional.** Real token verification, session tracking, and role-based access control. | Ready for production deployment with Supabase Auth. |
| **Document Processing & OCR** | **Functional with Hybrid OCR.** Real multi-part file parsing, SHA-256 deduplication, and extraction review. Uses deterministic OCR in test mode. | Upstream Google Cloud Vision adapter ready for API key activation. |
| **AI Health Memory & PDF** | **Functional with Grounded Fallback.** Extracts facts, verifies citations, produces real binary PDFs. | Connects to Gemini 1.5 Pro via `GEMINI_API_KEY`. |
| **Medication & Appointments** | **Live & Database-Backed.** Real schedule generation, dose occurrence tracking, and status audit trail. | Ready for production. |
| **SOS Emergency System** | **Fully Simulated State Machine.** Demonstrates multi-tier escalation, family alerts, and handoffs. | **SIMULATED ONLY.** Does NOT contact real 112/911 or dispatch ambulances. |
| **Live Telephony (Phase 6)** | **Controlled Test Driver.** Real SMS/calls sent ONLY to consenting allowlisted test team members. | Emergency numbers (`112`, `911`) are permanently hard-blocked. |
| **Offline Sync (Phase 7)** | **Functional Idempotent Batch Sync.** Queued mutations, duplicate deduplication, conflict resolution. | Ready for production service-worker rollout. |
| **Community Aid (Phase 8)** | **Live & Database-Backed.** Society groups, volunteer assignments, masked PII, contact grants. | Ready for production residential rollouts. |

---

## 4. Prerequisites & Environment Setup

### System Requirements
- Node.js v20.x or higher
- Git & npm v10.x
- Modern web browser (Chrome, Safari, Edge, Firefox)

### Fast Start (Zero-Configuration Demo)
```bash
# 1. Clone repository & install dependencies
cd /Users/khemrajsahu/Downloads/Sanjivani
npm install

# 2. Build production assets & verify all tests
npm run build
npm run test:backend
npm run test:frontend

# 3. Start development servers
# Terminal 1: Backend API (port 3001)
npm run dev:backend

# Terminal 2: Frontend Client (port 5173)
npm run dev:frontend
```
Open your browser to `http://localhost:5173`.

---

## 5. Test Credentials & Demo Personas

The database comes pre-seeded with three distinct personas for presenting family collaboration and security isolation:

| Persona | Role | Email | Password | Primary Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Aarav Patel** | Family Workspace Owner | `p9_owner@sanjivani.local` | `SecurePassword123!` | Manages elderly father (Kantilal), uploads documents, triggers SOS. |
| **Pooja Patel** | Daughter & Caregiver | `p9_caregiver@sanjivani.local` | `SecurePassword123!` | Records medication doses, responds to emergency alerts, volunteers in community. |
| **Vikram Singh** | Unrelated Third-Party | `p9_outsider@sanjivani.local` | `SecurePassword123!` | Used to demonstrate strict cross-account security isolation (HTTP 403). |

---

## 6. Time-Budgeted Presentation Tracks

### Track A: 5-Minute Lightning Pitch (Hackathon / Quick Judging)
- **Min 0:00 - 1:00:** The Problem & Vision (Paper medical records chaos vs. Sanjivani).
- **Min 1:00 - 2:30:** Intelligent Prescription Upload & AI Health Memory grounded Q&A.
- **Min 2:30 - 4:00:** SOS Emergency Simulation: Trigger alert, caregiver timeout, hospital handoff packet.
- **Min 4:00 - 5:00:** Doctor-Ready PDF Summary export & closing value proposition.

### Track B: 10-Minute Comprehensive Investor Demo
- **Min 0:00 - 2:00:** Problem, Indian market demographics (140M elders), family caregiver burden.
- **Min 2:00 - 4:30:** The Core App: Family workspace, Health ID, prescription OCR, and AI grounding.
- **Min 4:30 - 6:30:** Medication schedule confirmation, daily dose tracking, and appointment reminders.
- **Min 6:30 - 8:30:** Emergency SOS Demo Mode + Controlled Live Telephony demonstration.
- **Min 8:30 - 10:00:** Community elderly mutual aid network, privacy isolation, and financial traction.

### Track C: 15-Minute Technical & Architectural Deep-Dive
- Includes Track B + Offline-First synchronization queue, server-side idempotency, RLS security audit, and live code walkthrough.

---

## 7. Act I: The Elderly Care Challenge & Family Setup (Journey 1)

1. **Log in as Aarav Patel** (`p9_owner@sanjivani.local`).
2. Point out the **Family Workspace Switcher**: show that multiple family members collaborate under one unified umbrella.
3. Open **Patient Profile: Kantilal Patel (Age 76)**.
4. Highlight the **Health ID (`SNJ-XXXX-XXXX`)**:
   - Universal, privacy-preserving identifier.
   - Encodes zero personal medical information in the ID string itself.
5. Demonstrate **Role-Based Collaboration**:
   - Show Pooja Patel listed with the `caregiver` role.
   - Explain that caregivers can administer medication and view records, but cannot rename workspaces or delete records.

---

## 8. Act II: Paper to Pixel — Prescription Upload & Review (Journey 2)

1. Navigate to **Documents Library** → Click **Upload Medical Document**.
2. Upload a sample prescription image (e.g. `apex_rx.png`).
3. Point out the **SHA-256 Deduplication Safeguard**:
   - If an identical document was previously uploaded, the system immediately flags the duplicate and references the existing record.
4. Open the **Human Review Screen**:
   - **Key Talking Point:** *"In healthcare, AI must never make unilateral decisions without human oversight."*
   - Show proposed extracted medications (`Metformin 500mg`, `Telmisartan 40mg`).
   - Click **Confirm & Verify Extraction**.
   - The document status transitions from `in_review` to `confirmed`.

---

## 9. Act III: AI Health Memory in Action (Journey 3)

1. Navigate to **Health Memory** tab.
2. Ask a factual question:
   > *"What medications has Dr. Anjali Nair prescribed for Kantilal?"*
3. Observe the response:
   - Mentions `Metformin 500mg` and `Telmisartan 40mg`.
   - **Crucial Feature:** Displays clickable source citations linking directly to the verified prescription.
4. Ask an unrecorded/out-of-bounds question:
   > *"What was Kantilal's brain MRI scan result from last month?"*
5. Observe the response:
   - The AI explicitly states that no MRI records exist in the patient's file.
   - **Key Talking Point:** *"Sanjivani utilizes strict grounded RAG. It will never invent or hallucinate clinical diagnoses."*

---

## 10. Act IV: Doctor-Ready Summary Packet & Physician PDF (Journey 4)

1. On the Health Memory screen, click **Generate Doctor Summary**.
2. Select target sections: Demographics, Chronic Conditions, Confirmed Medications, Allergies.
3. Click **Preview Summary**:
   - Displays clean, concise clinical bullets designed for rapid doctor consumption during a 5-minute OPD consult.
4. Click **Download Doctor PDF**:
   - Generates and downloads a real, printable PDF document formatted with clinical headers, patient Health ID, verified medication schedules, and physician sign-off blocks.

---

## 11. Act V: Daily Caregiver Peace of Mind (Journey 5)

1. Open **Medications Dashboard**.
2. Show the confirmed schedule for **Telmisartan 40mg (Daily Morning)**.
3. Show **Today's Scheduled Dose Occurrence (08:00 AM)**.
4. Click **Acknowledge as Taken**:
   - Dose badge changes from yellow (`scheduled`) to green (`taken`).
   - Timestamp and caregiver identity are permanently audited.
5. Open **Appointments Dashboard**:
   - Show upcoming appointment: *Cardiology Follow-Up with Dr. Suresh Joshi at Lilavati Hospital*.
   - Point out automated reminder triggers: 24 hours and 2 hours prior to the consult.

---

## 12. Act VI: Emergency Assistance Demo Mode (Journeys 6, 7 & 8)

> **Important Disclosure to Audience:** *"What you are about to see is a fully functional simulation of our multi-tier emergency escalation engine. No real emergency services or hospitals will be called."*

1. Open **Emergency SOS Dashboard**.
2. Click the red **Trigger Emergency SOS** button:
   - Select patient: *Kantilal Patel*.
   - Enter incident note: *Sudden chest discomfort and elevated BP*.
   - Click **Broadcast SOS**.
3. **Stage 1 (Family Alert):**
   - The incident enters `AWAITING_FAMILY_RESPONSE` with a countdown timer.
   - Switch to caregiver window or click **Acknowledge (Family Responded)**.
   - Incident transitions to `FAMILY_RESPONDED`.
4. **Stage 2 (Simulated Escalation Timeout):**
   - Trigger a new incident. Click **Simulate Response Timeout**.
   - Watch the state machine automatically advance to `AWAITING_CAREGIVER_RESPONSE`.
5. **Stage 3 (Simulated Hospital Handoff):**
   - Click **Simulate Hospital Escalation**.
   - Incident transitions to `HOSPITAL_HANDOFF_SIMULATED`.
   - Opens the **Fictional Hospital Receiving Desk**:
     - Shows the emergency summary packet: Blood Group (B+), Allergies (Penicillin, Sulfa), Active Medications, Emergency Contacts.
     - Displays unmistakable banner: *"DEMO MODE ONLY — SIMULATED EMERGENCY HANDOFF"*.
     - Nurse Priya Desai acknowledges receipt, allocating a triage bed.

---

## 13. Act VII: Controlled Live Telephony Demo Procedure (Journey 9)

*(Optional for live presentations where Twilio/Exotel credentials are configured)*

1. Navigate to **Emergency Settings** → **Live Test Mode**.
2. Point out the safety controls:
   - Max 3 allowlisted recipients.
   - 30-second mandatory cooldown between dispatches.
   - Indian emergency numbers (`112`, `100`, `911`) are hardcoded as blocked.
3. Add the presenter's mobile number:
   - Select permitted channels: *SMS & Voice*.
   - Check *Explicit Testing Consent*.
4. Click **Send Test Live Alert**:
   - The presenter's real mobile phone rings or receives an SMS clearly prefixed with:  
     `[TEST DEMO ONLY — NO EMERGENCY] Sanjivani Live Alert...`
   - Emphasize to investors that this proves real telecom carrier connectivity without endangering public emergency dispatch services.

---

## 14. Act VIII: Resilient Offline Mode & Sync Reconciliation (Journey 10)

1. Open the browser's Developer Tools → Network tab → Select **Offline**.
2. Notice the UI displays an amber badge: **Offline Mode Active**.
3. Navigate to Kantilal's records:
   - Patient demographics, existing prescriptions, and medication schedules remain fully viewable.
4. Record an offline dose acknowledgement (*Metformin taken at 08:30*).
   - Operation is queued locally with a unique `idempotencyKey`.
5. Re-enable network connectivity in DevTools (**No Throttling**).
6. Click **Sync Now** (or wait for automatic reconnection):
   - The queued mutation batch is transmitted to `/api/families/:familyId/sync/batch`.
   - Server applies the mutation idempotently, verifies revision timestamps, and updates status to **Synced**.

---

## 15. Act IX: The Healthcare Community Network (Journey 11)

1. Open **Community Network** tab.
2. Select **Greenwood Society Senior Care**:
   - Explain that Indian housing societies and apartment complexes form the primary social safety net for aging parents whose children live abroad.
3. Show an active **Non-Emergency Assistance Request**:
   - Title: *Need neighbor to pick up pre-ordered blood pressure medicine at Apollo Pharmacy*.
   - Point out **Privacy Masking**: The elder's exact flat number and phone number are masked with asterisks.
4. Caregiver Pooja clicks **Volunteer to Assist**.
5. Aarav Patel accepts Pooja's offer:
   - A time-bound **ContactSharingGrant** is generated.
   - The flat address and phone number are now securely revealed only to Pooja.
6. Once Pooja delivers the medicine, the request is marked **Completed**, and contact access is immediately revoked.

---

## 16. Act X: Security & Cross-Account Isolation (Journey 12)

1. Log out of Aarav Patel's account.
2. Log in as unrelated third-party **Vikram Singh** (`p9_outsider@sanjivani.local`).
3. Attempt to navigate directly to `/families/patients/{kantilal-id}`:
   - System immediately displays an unauthorized access screen (HTTP 403 Forbidden).
4. Point out the **Security Architecture**:
   - All database queries enforce tenant isolation via workspace IDs.
   - Cross-tenant data leaks are mathematically prohibited by database access repository checks.

---

## 17. Common Troubleshooting Scenarios & Instant Fallback Guide

| Issue During Demo | Likely Root Cause | Instant Recovery Action |
| :--- | :--- | :--- |
| **"Cannot connect to server"** | Backend Node process terminated | Run `npm run dev:backend` in terminal. In test mode, backend boots in <2 seconds. |
| **"An active incident is already in progress"** | Previous SOS was left unacknowledged | In the SOS dashboard, click **Resolve Incident** or restart backend to reset memory store. |
| **"Network Error on Ask AI"** | Gemini API key invalid or rate limited | DEMO_MODE automatically falls back to grounded deterministic RAG without errors. |
| **Live SMS not arriving** | Phone number not allowlisted or provider unconfigured | Point to the audit log: show that the provider driver captured the payload in the audit trail. |

---

## 18. Frequently Asked Questions by Investors & Healthcare Judges

### Q1: "How do you protect patient health data under Indian privacy laws (DPDP Act) and HIPAA?"
> **Answer:** All health records are strictly partitioned by family workspaces. Zero unverified PII is shared with LLMs. In community mutual-aid requests, personal identifying details (phone numbers, addresses) are never exposed publicly; they are only unlocked through temporary cryptographic grants between confirmed volunteers and request creators.

### Q2: "What prevents the AI from giving dangerous medical advice or hallucinating prescriptions?"
> **Answer:** Sanjivani's architecture implements Human-in-the-Loop review. OCR extractions are purely *proposed* until a family member confirms them. When querying the memory agent, our retrieval pipeline injects only verified clinical extractions into the prompt context and explicitly constrains the model to state when an answer is absent.

### Q3: "Is the SOS button connected to real 112 emergency services?"
> **Answer:** No, and intentionally so. Connecting unverified hackathon or prototype applications to real 112/911 emergency centers is illegal and dangerous. Sanjivani provides a complete, repeatable simulation for emergency triage and hospital packet handoff, while Phase 6 provides a strictly allowlisted live test mode for consenting team members.

---

## 19. Appendix: Product Roadmap & Phase 10 Interoperability

- **Phase 0–8 (Completed):** Core architecture, family health records, OCR review, AI memory, medications, appointments, SOS simulation, offline sync, community mutual aid.
- **Phase 9 (Current):** Full end-to-end QA, security hardening, automated 12-journey testing, and funding presentation readiness.
- **Phase 10 (Future Commercial Interoperability):**
  - Ayushman Bharat Digital Mission (ABDM) ABHA ID integration.
  - HL7 / FHIR R4 standard connectors for verified hospital EHR ingestion.
  - Certified ambulance dispatch network APIs for licensed emergency integration.
