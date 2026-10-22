# Sanjivani (Health Memory Agent) — Final Demo Runbook

**Version:** 1.0.0  
**Target Audience:** Evaluators, Hackathon Judges, Investors, Clinical Partners  
**Presentation Length:** 5 to 8 Minutes  
**Demonstration Mode:** Live Web Application (Local or Staging)  

---

## 1. Environment Startup & Configuration

### Option A: Local Development (Single Host)

1. **Clone & Install Dependencies:**
   ```bash
   cd /path/to/Sanjivani
   npm install
   ```

2. **Configure Environment Variables:**
   Create `.env` in the root (or rely on built-in zero-config demo defaults):
   ```env
   NODE_ENV=development
   PORT=5000
   DEMO_MODE=true
   JWT_SECRET=demo-secret-key-sanjivani-2026-safe-for-demo
   FRONTEND_URL=http://localhost:5173
   VITE_API_URL=http://localhost:5000/api
   LIVE_TEST_MODE_ENABLED=false
   ```

3. **Start Application Services:**
   In separate terminal tabs:
   ```bash
   # Terminal 1: Backend API server
   npm run dev:backend

   # Terminal 2: Frontend Vite development server
   npm run dev:frontend
   ```
   Open browser at: `http://localhost:5173`

---

### Option B: Docker Compose Staging

1. **Launch Staging Stack:**
   ```bash
   docker compose -f docker-compose.staging.yml up -d --build
   ```

2. **Verify Liveness & Readiness:**
   ```bash
   curl -s http://localhost:80/api/health
   # Expected: {"status":"healthy","uptimeSeconds":...,"demoMode":true}

   curl -s http://localhost:80/api/health/ready
   # Expected: {"status":"ready","database":"in_memory_datastore","memory":{...}}
   ```
   Open browser at: `http://localhost:80`

---

## 2. Pre-Seeded Presentation Accounts

The platform includes a pre-seeded synthetic family profile designed for demonstrations:

| Field | Demo Credential / Value |
| :--- | :--- |
| **Presenter Email** | `demo@sanjivani.health` |
| **Password** | `DemoPassword123!` |
| **Family Workspace** | Sharma Family Healthcare Workspace |
| **Patient Profile** | **Ramesh Verma** (Age 68, Male) |
| **Health ID** | `SNJ-2026-9481-4402` (Unguessable, deterministic) |
| **Conditions** | Type 2 Diabetes, Essential Hypertension |
| **Allergies** | Penicillin (Severe) |
| **Active Medications** | Metformin 500mg (Twice Daily), Amlodipine 5mg (Once Daily) |

*(Note: If creating a fresh account during the presentation, any valid email and strong password works seamlessly due to the transactional in-memory datastore).*

---

## 3. 5–8 Minute Presentation Script & Screen Workflow

### Minute 0:00 – 1:00 | Introduction & Patient Selection
* **Narrative:** "Sanjivani is an AI-powered Health Memory Agent that acts as a continuous digital guardian for families. It unifies fragmented paper prescriptions, laboratory reports, medication tracking, and emergency response into one secure, privacy-first platform."
* **Screen Action:**
  1. Navigate to the Sign In page (`/login`).
  2. Log in with `demo@sanjivani.health` / `DemoPassword123!`.
  3. Arrive at the Family Workspace Dashboard.
  4. Select patient **Ramesh Verma**. Point to the unguessable Health ID: `SNJ-2026-9481-4402`.
* **Expected Output:**
  - Workspace dashboard loads cleanly showing family members and patient profile card.
  - Active Health ID badge displayed prominently.

---

### Minute 1:00 – 2:30 | Document Ingestion, OCR & Human Confirmation
* **Narrative:** "Healthcare begins with records. Elderly patients often have handwritten or printed prescription slips. Sanjivani ingests these documents, runs local OCR extraction, and provides an editable human review screen so families remain in control of medical truth."
* **Screen Action:**
  1. Navigate to **Medical Records** (`/documents`).
  2. Click **+ Upload Document**.
  3. Select sample diagnostic report/prescription (`sample_prescription.png` or `apex_rx.png`).
  4. Observe instant SHA-256 deduplication hashing and OCR processing.
  5. The **Split-Screen OCR Review Modal** opens:
     - Left pane: Original uploaded prescription image.
     - Right pane: Extracted structured medications (`Metformin 500mg`, `Amlodipine 5mg`, `Dr. S. K. Gupta`).
  6. Click **✓ Confirm & Approve**.
* **Expected Output:**
  - Status updates to `CONFIRMED`.
  - The record appears instantly in the patient's chronological medical records timeline.

---

### Minute 2:30 – 4:00 | AI Health Memory, Grounded Q&A & Doctor PDF
* **Narrative:** "Traditional LLMs hallucinate medical advice. Sanjivani's AI Health Memory is strictly grounded in the patient's verified records. Every answer cites its source, and if an answer is not in the records, the agent explicitly refuses rather than guessing."
* **Screen Action:**
  1. Open the **AI Health Memory** tab (`/memory`).
  2. In the chat prompt, type:
     `"What medications is Ramesh taking for hypertension and when was it prescribed?"`
  3. The AI responds:
     *"According to the prescription from Dr. S. K. Gupta dated October 2026, Ramesh Verma is prescribed Amlodipine 5mg once daily for hypertension."*
  4. Point to the **Interactive Source Citation Badge** under the answer: `[Doc #1: Apex Clinic Prescription]`.
  5. Click the citation badge — the original verified document view opens instantly.
  6. Ask a negative test question:
     `"Has Ramesh ever undergone open heart surgery?"`
  7. Observe the AI refusal:
     *"Based on Ramesh Verma's verified records, there is no mention of open heart surgery or cardiac surgical history."*
  8. Click **Download Doctor-Ready Summary (PDF)**.
* **Expected Output:**
  - A professional, high-fidelity vector PDF is compiled and downloaded with allergies highlighted in red, active medications, recent vitals, and physician notes.

---

### Minute 4:00 – 5:00 | Medication Adherence & Clinic Appointments
* **Narrative:** "Memory also means daily continuity. Sanjivani tracks scheduled doses and calculates real-time adherence rates for physicians."
* **Screen Action:**
  1. Navigate to **Medications** (`/medications`).
  2. View the active medication cards (Metformin 500mg, Amlodipine 5mg).
  3. Click **Log Dose Taken** for today's morning dose.
  4. Observe adherence score increase to 100%.
  5. View the upcoming appointment card: `"Follow-up with Dr. Gupta — Cardiology Clinic"`.
* **Expected Output:**
  - Dose logged with instant green checkmark.
  - Adherence metric dynamically updates.

---

### Minute 5:00 – 6:30 | SOS Emergency Workflow & Simulated Escalation
* **Narrative:** "When a crisis occurs, seconds count. Sanjivani provides a multi-tiered emergency escalation engine. For today's demonstration, the platform runs in strictly controlled Demo Mode."
* **Screen Action (Scenario 1: Immediate Family Response):**
  1. Navigate to **Emergency SOS** (`/emergency`). Point out the `DEMO MODE` banner.
  2. Click the red **TRIGGER SOS DEMO** button.
  3. Incident card appears: `STATUS: PENDING_FAMILY_RESPONSE`, Countdown timer begins.
  4. Simulate family member receiving notification and clicking **Acknowledge & Responding**.
  5. Incident status changes to `FAMILY_RESPONDED`.
* **Screen Action (Scenario 2: Timeout Escalation to Hospital Handoff):**
  1. Click **Reset Demo Scenario** and trigger SOS again.
  2. Click **Simulate Family Timeout (60s)**.
  3. Incident advances to Tier 2: `AWAITING_CAREGIVER_RESPONSE`.
  4. Click **Simulate Caregiver Timeout (120s)**.
  5. Incident advances to Tier 3: `HOSPITAL_HANDOFF_DISPATCHED`.
  6. Open the **Fictional Hospital Receiving Desk** modal.
  7. Highlight the clinical summary packet: Allergies (`Penicillin - Severe`), Conditions (`Type 2 Diabetes, Hypertension`), Current Meds (`Metformin, Amlodipine`).
  8. Point out the clear banner: `[SIMULATED HOSPITAL RECEIVING DESK — DEMO ENVIRONMENT ONLY]`.
* **Expected Output:**
  - Seamless state machine transitions without race conditions.
  - Complete, uneditable audit timeline recording every second of escalation.

---

### Minute 6:30 – 7:30 | Residential Community Network & Privacy Protection
* **Narrative:** "Beyond family care, Sanjivani integrates society-level assistance for elderly residents without compromising their private medical records."
* **Screen Action:**
  1. Switch to the **Community** tab (`/community`).
  2. View society group: `"Green Valley Heights Residents"`.
  3. Show the active non-emergency assistance request: `"Grocery delivery for elderly resident (Flat 402)"`.
  4. Show the Blood Donor registry (matching A+ donors without exposing medical histories).
  5. Highlight that no diagnoses, prescriptions, or documents are ever shared with neighbors or volunteers.
* **Expected Output:**
  - Clean mutual aid dashboard with strict clinical confidentiality.

---

### Minute 7:30 – 8:00 | Conclusion & Q&A
* **Summary Statement:** "Sanjivani bridges the gap between daily clinical memory and emergency action. Everything demonstrated today is backed by 334 automated tests, dual-mode persistence, and strict security boundaries. We are now open for questions."

---

## 4. Live Test Mode: Consented SMS & Voice Demonstration

If presenting to evaluators who wish to receive a **real live SMS or automated voice call** on their mobile phone:

1. **Verify Opt-In Consent:**
   - Only add team members or evaluators who explicitly agree.
   - Emergency numbers (112, 911, 100) are hard-coded to be **rejected and blocked**.
2. **Configure Provider Credentials:**
   In backend `.env`:
   ```env
   LIVE_TEST_MODE_ENABLED=true
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_PHONE_NUMBER=+1234567890
   ```
3. **Add Recipient in UI:**
   - In Emergency Dashboard, go to **Live Test Settings**.
   - Enter Name: `"Judge Smith"`, Phone: `"+919876543210"`.
   - Check the box: `"I confirm this recipient has given explicit written consent to receive test notifications"`.
   - Click **Save Recipient**.
4. **Trigger Live Test:**
   - Click **Send Test SMS** or **Trigger Test Voice Call**.
   - Evaluator receives SMS: `[SANJIVANI TEST ALERT] This is an authorized test notification for patient Ramesh Verma. Do not contact emergency services.`

---

## 5. Recovery Runbook (Handling Presentation Hitches)

| Issue Encountered | Root Cause | Immediate Recovery Action (Under 10 Seconds) |
| :--- | :--- | :--- |
| **SOS Incident stuck in progress** | Scenario left active from earlier test | Click **Reset Demo Scenario** button at top right of Emergency screen; returns state to idle. |
| **AI Memory says "Cannot answer"** | Document was uploaded but review was not confirmed | Go to Medical Records, click **Review**, click **✓ Confirm & Approve**. The AI immediately sees the record. |
| **Port 5000 / 5173 conflict** | Previous instance still running | Run `npx kill-port 5000 5173` and restart `npm run dev:backend` / `npm run dev:frontend`. |
| **Session Expired / Token Error** | JWT expired during overnight run | Click Log Out, then log in with `demo@sanjivani.health` / `DemoPassword123!`. |
| **Simulated vs Real Telephony Confusion** | Judge asks if hospital was called | Point directly to the prominent `[SIMULATED HOSPITAL RECEIVING DESK]` banner and explain emergency number blocking. |

---

## 6. Ethical & Safety Commitments

1. **Never Call 112 / 911:** The application will never trigger real emergency dispatch calls to government PSAPs.
2. **Transparent Simulation:** All hospital receiving screens and ambulance dispatch cards are clearly labelled as simulations.
3. **Zero Clinical Hallucination:** If records do not contain a fact, the AI will state that the information is absent.
4. **Data Isolation:** No private health data is exposed to community mutual aid or neighbors.
