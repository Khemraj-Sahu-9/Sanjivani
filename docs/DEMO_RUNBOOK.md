# Health Memory Agent — SOS Emergency Response Demo Runbook

> **Audience:** Hackathon Judges, Incubator Reviewers, Investors, and Evaluators.  
> **Safety Notice:** All emergency contacts, voice/SMS alerts, hospital handoffs, and receiving-desk events in this demonstration are **strictly simulated**. No real emergency calls, SMS, 112 dialing, or hospital contacts occur.

---

## 1. Scenario Overview

This runbook demonstrates the automated emergency-assistance pipeline of the Health Memory Agent:

**SOS ACTIVATED &rarr; SIMULATED FAMILY ALERTS &rarr; INTERACTIVE ACKNOWLEDGEMENT &rarr; NO-RESPONSE TIMEOUT &rarr; CAREGIVER ESCALATION &rarr; SIMULATED HOSPITAL RECEIVING HANDOFF &rarr; INCIDENT RESOLUTION**

---

## 2. Prerequisites & Demo Setup

1. Start both backend and frontend applications:
   ```bash
   # Terminal 1: Backend
   npm run dev:backend

   # Terminal 2: Frontend
   npm run dev:frontend
   ```
2. Open your browser at `http://localhost:5173`.
3. Sign in or register as a family owner (e.g. `phase5_user1@example.com` / `password123`).
4. Select or create an elderly family member profile (e.g. **Om Prakash Sharma**, Age 76, Health ID: `SNJ-2026-DEMO-001`).
5. Click the **🚨 Emergency SOS** navigation tab.

---

## 3. Demonstration Walkthrough Steps

### Step 1: Pre-Incident State & Safety Verification
- Observe the prominent banner:  
  `DEMO MODE — ALL EMERGENCY CONTACTS AND HOSPITAL EVENTS ARE SIMULATED.`
- Notice the seeded synthetic emergency contacts:
  - **Ramesh Sharma (Son)** &bull; `+91-98765-00001 (Simulated)`
  - **Priya Sharma (Daughter)** &bull; `+91-98765-00002 (Simulated)`
  - **Dr. Arvind Mehta (Home Nurse / Caregiver)** &bull; `+91-98765-00003 (Simulated)`
- Notice the configured demonstration timeouts: `15 seconds` for family response, `15 seconds` for caregiver escalation.

### Step 2: Triggering the Emergency SOS
1. Click the large red button: **ACTIVATE EMERGENCY SOS (DEMO)**.
2. The server creates an incident record with a unique identifier (e.g. `SOS-20261022-X7K2`).
3. The interface immediately transitions to the active incident screen:
   - Red banner displays: `ACTIVE INCIDENT: SOS-20261022-XXXX` &bull; `CRITICAL`.
   - Countdown timer displays time remaining in the family response window (e.g. `15s`).
   - Stage 1 indicates: `Simulated Alert Dispatched to Family Contacts`.
   - The **Incident Event Timeline** updates with `INCIDENT_CREATED` and `FAMILY_ALERT_DISPATCHED`.

### Step 3: Interactive Family Response (Option A)
1. On **Ramesh Sharma**'s contact card, click **I am Responding** or **Contacted Patient**.
2. Notice the instant server-side state transition:
   - Status updates to `Family Responded`.
   - Countdown timer pauses and pending escalation jobs are cancelled.
   - The timeline logs `FAMILY_ALERT_ACKNOWLEDGED`.
3. Click **Mark Incident Resolved** to complete the scenario cleanly.

### Step 4: No-Response Timeout & Caregiver Escalation (Option B)
1. Trigger a fresh SOS incident.
2. Either allow the 15-second countdown to expire OR click **Advance Demo Timeout &rarr;** in the Demo Control Panel to fast-forward immediately.
3. Observe the server-controlled escalation:
   - Family contacts are marked `TIMEOUT_NO_RESPONSE`.
   - Incident state transitions to `Caregiver Escalated` (`AWAITING_CAREGIVER_RESPONSE`).
   - Stage 2 card activates showing **Dr. Arvind Mehta (Designated Caregiver)**.
   - Timeline records `FAMILY_TIMEOUT` and `CAREGIVER_ESCALATED`.
4. Test the caregiver action buttons:
   - Clicking **Take Responsibility** pauses escalation and records responsibility.
   - Clicking **Cannot Respond** immediately advances to Hospital Handoff.

### Step 5: Fictional Hospital Receiving Desk Handoff
1. From Caregiver Escalation, let the timer expire OR click **Advance Demo Timeout &rarr;**.
2. Incident state transitions to `Hospital Handoff Ready (Demo)` (`HOSPITAL_HANDOFF_SIMULATED`).
3. Click **Open Hospital Receiving Desk Dashboard**.
4. The simulated hospital receiving desk modal appears:
   - Notice the header banner: `SIMULATED HOSPITAL HANDOFF — NO REAL HOSPITAL CONTACTED.`
   - Inspect the compiled synthetic patient summary packet:
     - Patient identity & application Health ID.
     - Documented critical conditions (e.g. *Type 2 Diabetes Mellitus, Hypertension, CAD*).
     - Known allergies (*Penicillin anaphylaxis*).
     - Current medication regimen compiled from confirmed prescription schedules.
     - Recent medical reports.
5. In the Receiving Desk Acknowledgement form, review the staff name (*Nurse Priya Desai*) and bed assignment notes.
6. Click **Acknowledge Emergency Packet**.
7. Observe that the handoff status updates to `ACKNOWLEDGED_SIMULATED` and the timeline records `HOSPITAL_HANDOFF_ACKNOWLEDGED`.

### Step 6: Incident Resolution & Repeatable Demo Reset
1. Click **Mark Incident Resolved** &rarr; state transitions to `Resolved`.
2. In the Demo Control Panel, click **Reset Demo Scenario**.
3. The server clears all demonstration incidents, attempts, events, and hospital handoffs for this patient, restoring a clean initial state.
4. The system is immediately ready for another evaluation run.

---

## 4. Key Verification Points for Evaluators

| Verification Point | Location in UI / System |
|---|---|
| **Real Database Persistence** | Incident numbers, status, and timestamps persist across page reloads. |
| **Server-Controlled Transitions** | Deadlines and state changes are enforced by the backend, not frontend JavaScript. |
| **Complete Audit Trail** | Live Event Timeline lists every actor, stage, and event with ISO timestamps. |
| **Strict Demo Mode Isolation** | Every record carries `is_demo: true` and `simulation_provenance: 'DEMO_SIMULATION_ONLY'`. |
| **Zero External Communications** | Automated tests (`tests/phase5.test.ts`) verify no real telephony or hospital network APIs can be called. |
| **Cross-Family Security** | Users from other families are strictly blocked from viewing or controlling incidents. |

---

## 5. Demonstrating Phase 6 Controlled Live Test Mode (Real SMS / Voice)

To prove real carrier communication capability to judges and investors without falsely claiming complete production readiness, follow this workflow:

### Step 1: Onboard Team Member & Review Consent
1. In the Emergency Dashboard, click **👥 Manage Test Recipients**.
2. Review existing registered team members.
3. To add a new team member:
   - Click **+ Add Consenting Member**.
   - Enter Full Name and E.164 phone number (e.g., `+919876543210`).
   - Select permitted channels (`Both SMS & Automated Voice Call`, `SMS Only`, or `Voice Only`).
   - Read and check the **Explicit Consent Agreement**.
   - Click **Save & Verify Member**.
4. Point out to judges: Fictional demo numbers and emergency services (`112`) cannot be added here; server-side allowlisting enforces this.

### Step 2: Trigger Emergency Incident & Open Preflight
1. Click **ACTIVATE EMERGENCY SOS (DEMO)** to launch an active incident.
2. In the top banner, click the flashing button: **⚡ Send Live Test Alert**.
3. The **Live Test Preflight Inspection Modal** opens.
4. Highlight to evaluators:
   - Prominent indicator: `REAL TEST COMMUNICATION TO APPROVED RECIPIENTS; REMAINING ESCALATION IS SIMULATED.`
   - Synthetic incident ID and patient name.
   - Channel selection: Toggle between **Real Test SMS** and **Automated Voice Call**.
   - Exact message / voice script preview box (no private medical data or clinical records are broadcast).
   - Recipient list with masked phone numbers (e.g., `+91 98*** **210`).
   - The **Confirm & Send** button is disabled until the operator authorization checkbox is clicked.

### Step 3: Authorize & Dispatch Live Test
1. Check the **MANDATORY PREFLIGHT AUTHORIZATION** checkbox.
2. Click **Confirm & Send Test SMS** (or Voice Call).
3. The modal closes and a notification banner confirms dispatch.
4. Observe the physical phone of the consenting team member:
   - SMS arrives with clearly labelled text: `TEST ALERT — Sanjivani Health Memory Agent product demonstration for Om Prakash Sharma. Incident: SOS-XXXX. This is not a real emergency.`
   - If Voice Call was selected, an automated call introduces itself as a test demonstration.

### Step 4: Inspect Provider Provenance & Human Acknowledgement
1. In the Active Incident view, observe the **Controlled Live Test Provider Dispatches** card:
   - Displays masked phone number, channel, provider name (`Twilio` or `Mock`), and dispatch status (`ACCEPTED`).
   - When carrier delivery evidence arrives, the status updates to `DELIVERED`.
2. Notice the **Incident Event Timeline**:
   - The dispatch event displays a bold green badge: `REAL PROVIDER DISPATCH` (`simulation_provenance: LIVE_PROVIDER`), cleanly separated from simulated events.
3. Click **Confirm Human Receipt** on the dispatch card.
   - The card updates to `✓ Human Confirmed`.
   - The timeline records a blue badge: `HUMAN ACKNOWLEDGEMENT`.

### Step 5: Advance Remaining Simulation
1. Advance the remaining stages (Caregiver Escalation and Hospital Receiving Desk Handoff) using the Demo Control Panel.
2. Emphasize to evaluators: Real telephony communication was demonstrated to consenting team members, while hospital handoff safely remained 100% simulated.

