# PHASE 6 — Live Test Mode Telephony Provider Setup & Compliance

> **Sanjivani (Health Memory Agent) — Phase 6**  
> Controlled Emergency Notification Integration: Real SMS & Automated Voice Calls

---

## 1. Executive Summary & Architecture Overview

Phase 6 introduces a strictly guarded **Live Test Mode** to the Sanjivani emergency notification subsystem. While Demo Mode remains the safe default (with 100% simulated alerts and fictional contacts), Live Test Mode allows an authorized operator to dispatch real test SMS messages or automated voice calls exclusively to verified, allowlisted, and consenting team members during investor pitches or hackathon evaluations.

The emergency workflow preserves safety:
- **Zero Real Emergency Services:** Never dials `112`, real hospitals, police, or ambulance dispatch.
- **Zero Real Clinical Data over SMS/Voice:** Outgoing alerts contain only safe test notices, synthetic patient IDs, and confirmation instructions. No PHI/medical records are broadcast.
- **Strict Server Allowlist:** Seeded demo contacts (`+91-98765-XXXXX (Simulated)`) and unverified numbers are rejected server-side.
- **Per-Test Preflight Screen:** Every single live test requires manual operator confirmation with masked recipient details, exact message/voice script preview, and provider diagnostics.
- **Event Provenance:** Database records, timeline events, and UI badges strictly distinguish `LIVE_PROVIDER` and `HUMAN_ACKNOWLEDGEMENT` from `SIMULATED` escalations.

---

## 2. Indian Telephony Landscape & TRAI/DLT Regulatory Requirements

In India, commercial telecom communications are regulated by the **Telecom Regulatory Authority of India (TRAI)** under the **Telecom Commercial Communications Customer Preference Regulations, 2018 (TCCCPR)**.

### Distributed Ledger Technology (DLT) Registration
Indian telecom operators (Airtel, Reliance Jio, Vodafone Idea, BSNL) maintain DLT blockchain portals (e.g., Vilpower, Jio DLT, PingConnect). Any entity sending SMS to Indian numbers must complete:

1. **Principal Entity (PE) Registration:**
   - Registration with business KYC (PAN, GSTIN, Certificate of Incorporation).
   - Generates a unique 19-digit **Entity ID (PE ID)**.
2. **Header (Sender ID) Registration:**
   - 6-character alphabetic header representing the organization or brand (e.g., `SNJVNI` or `HMAHLT`).
   - Categorized as **Service Implicit** (for transactional OTPs/critical alerts) or **Service Explicit**.
3. **Content Template Registration:**
   - Every outbound SMS message structure must be pre-approved on DLT.
   - Dynamic parameters must use designated variable tags (e.g., `{#var#}`).
   - Registered Template ID (19 digits) must be passed with the API dispatch.
   - Example DLT Template for Sanjivani Test Alert:
     ```text
     TEST ALERT - Sanjivani Health Memory Agent product demonstration for {#var#}. Incident: {#var#}. This is a controlled test and not a real emergency.
     ```
4. **Consent Telephony Verification:**
   - Recipients must provide explicit consent for test notifications.
   - Unregistered promotional/transactional SMS to non-consenting recipients violates TRAI guidelines and leads to blacklisting.

---

## 3. Provider Evaluation: Exotel vs. Twilio

| Criteria | Exotel (India) | Twilio (Global / India) |
|---|---|---|
| **Headquarters & Focus** | Bengaluru, India — direct Indian carrier routes | San Francisco, USA — global carrier network |
| **TRAI / DLT Integration** | Native DLT support with Entity ID & Template ID params | Supports DLT via Indian aggregator bindings |
| **Developer Sandbox** | Trial account with registered virtual numbers (VN) | Generous trial tier with verified caller ID allowlisting |
| **Voice Calls (Outbound)** | Call Connect API (`/Calls/connect.json`) with Flow Applets / IVR | Programmable Voice (`/Calls.json`) with TwiML `<Say>` TTS |
| **SMS API** | `/v1/Accounts/{Sid}/Sms/send.json` | `/2010-04-01/Accounts/{Sid}/Messages.json` |
| **Webhook Verification** | HTTP Basic Auth or shared secret callback URL token | Cryptographic HMAC-SHA1 signature (`X-Twilio-Signature`) |
| **Setup Speed for Hackathons** | Requires Indian business KYC verification (2-5 business days) | Immediate testing with Verified Caller IDs in Twilio Console |
| **Selected Role in Sanjivani** | Production Indian Carrier Adapter | Primary Live Test Mode & Hackathon Demonstration Adapter |

### Selection Rationale
Sanjivani implements a **pluggable provider abstraction** (`ITelephonyProvider`):
1. **Twilio Adapter (`TwilioProvider`):** Chosen as the primary active provider for live demonstrations and testing due to instantaneous Verified Caller ID onboarding, automated TwiML Text-to-Speech voice prompts, and HMAC-SHA1 webhook signature verification.
2. **Exotel Adapter (`ExotelProvider`):** Implemented for direct Indian enterprise deployment with DLT Entity ID and Template ID bindings.
3. **Mock Telephony Adapter (`MockTelephonyProvider`):** Implemented for automated test suites (CI/CD) and local offline development, guaranteeing zero external dependencies or costs during testing.

---

## 4. Environment Variables Configuration

Add the following to `backend/.env` (refer to `backend/.env.example`):

```bash
# ---- Telephony / Phase 6 Live Test Mode -------------------
# Provider selection: 'twilio' | 'exotel' | 'mock' | 'none'
LIVE_TEST_TELEPHONY_PROVIDER=mock

# Enable Live Test Mode features (default is false)
LIVE_TEST_MODE_ENABLED=true

# Maximum allowed recipients per live test dispatch (safety cap)
LIVE_TEST_MAX_RECIPIENTS=3

# Rate limit: minimum seconds between live dispatches per family
LIVE_TEST_COOLDOWN_SECONDS=30

# Webhook secret for authenticating provider delivery callbacks
TELEPHONY_WEBHOOK_SECRET=your-webhook-secret-here

# Twilio Configuration (Required if LIVE_TEST_TELEPHONY_PROVIDER=twilio)
TWILIO_ACCOUNT_SID=ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+12025550199

# Exotel Configuration (Required if LIVE_TEST_TELEPHONY_PROVIDER=exotel)
EXOTEL_ACCOUNT_SID=your_exotel_sid_here
EXOTEL_API_KEY=your_exotel_api_key_here
EXOTEL_API_TOKEN=your_exotel_api_token_here
EXOTEL_SUBDOMAIN=api.exotel.com
EXOTEL_CALLER_ID=080XXXXXXXX
EXOTEL_DLT_ENTITY_ID=1101XXXXXXXXXXXX
EXOTEL_DLT_TEMPLATE_ID=1201XXXXXXXXXXXX
```

> [!IMPORTANT]
> If `LIVE_TEST_TELEPHONY_PROVIDER` is set to `none` or credentials are unset, the system cleanly disables Live Test dispatch, displays diagnostic missing-credential alerts, and keeps Demo Mode 100% operational.

---

## 5. Webhook Setup & Callback Verification

When using a live provider in development, use an HTTPS tunnel (e.g., `cloudflared` or `ngrok`):

```bash
# Example local tunnel:
ngrok http 3001
```

Set the provider's delivery callback URL to:
```text
https://<your-subdomain>.ngrok-free.app/api/v1/telephony/callbacks/twilio
```
or
```text
https://<your-subdomain>.ngrok-free.app/api/v1/telephony/callbacks/exotel
```

### Signature Verification
- **Twilio:** Validates `X-Twilio-Signature` using `twilio.validateRequest(authToken, signature, url, params)`.
- **Exotel:** Validates against `TELEPHONY_WEBHOOK_SECRET` provided in query parameter or authorization header.
- **Idempotency:** Webhook requests check `provider_request_id` in `live_test_audit_logs`. Duplicate delivery callbacks are safely acknowledged without creating duplicate event transitions.

---

## 6. Controlled Recipient Verification & Consent Workflow

To comply with privacy laws and telecom anti-spam rules:
1. Team members navigate to **Emergency Settings > Live Test Recipients**.
2. Operator adds the team member with:
   - Full Name
   - E.164 Normalized Phone Number (e.g., `+919876543210`)
   - Permitted Channels (`SMS`, `VOICE`, or `BOTH`)
   - Explicit Consent Statement & Timestamp
3. The number must be verified (in trial mode, the number must also be added as a Verified Caller ID in the Twilio/Exotel console).
4. Consent can be revoked instantly at any time with a single click, immediately preventing future outbound dispatches.

---

## 7. Safety Guidelines During Live Demonstrations

1. **Always run the Preflight Check:** Review the recipient's phone number and the exact message preview before clicking Confirm.
2. **Warn the Recipient:** Ensure the team member knows a test SMS or automated call will arrive.
3. **Point out the Badges:** Highlight to the evaluators the difference between `LIVE_PROVIDER` events (real SMS/Voice) and `SIMULATED` escalations (caregiver and hospital desk).
4. **Clean Reset:** After the demo, clicking "Reset Demo" resets the synthetic incident state without triggering any outbound telephony calls.
