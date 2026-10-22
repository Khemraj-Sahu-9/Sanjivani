# PHASE 10 — OPERATIONAL COST & INFRASTRUCTURE ASSESSMENT

> **Sanjivani (Health Memory Agent)**  
> **Document:** Infrastructure Cost Modeling, Unit Economics, and Pilot Budget Forecast  
> **Status:** Commercial Feasibility Assessment  
> **Date:** October 2026  

---

## 1. Unit Economics & Provider Pricing Breakdown

Sanjivani's cloud architecture is designed to maximize cost efficiency by utilizing serverless, scale-to-zero compute and pay-as-you-go microservices.

### 1.1 Provider Price Schedule (Current 2026 Tier Rates)

| Service / Provider | Free Allowance | Paid Tier Rate | Pilot Usage Estimate |
| :--- | :--- | :--- | :--- |
| **Supabase PostgreSQL** | 500 MB DB, 1 GB Storage, 50k MAU | **Pro Plan: $25.00 / month** (8 GB DB, 100 GB Storage, Daily PITR) | Pro tier recommended for Stage B & C pilot |
| **Google Gemini 1.5 Flash API** | 15 RPM / 1M TPM (Free Tier) | **$0.075 per 1M Input Tokens**<br>**$0.30 per 1M Output Tokens** | ~500k tokens/mo = **$0.15 / month** |
| **Google Cloud Vision OCR** | 1,000 pages / month (Free) | **$1.50 per 1,000 pages** (Text detection) | 200 pages/mo = **$0.00 (within free tier)** |
| **Exotel SMS (India DLT)** | None (Commercial account) | **₹0.20 ($0.0024) per SMS** | 500 SMS/mo = **₹100 ($1.20) / month** |
| **Exotel Voice Calls** | None (Commercial account) | **₹0.75 ($0.0090) per minute** | 50 call mins/mo = **₹37.50 ($0.45) / month** |
| **Cloud Run Backend Compute** | 2M requests/mo, 360k GB-sec | **~$0.000024 / vCPU-second** (Scale-to-zero) | ~50k requests/mo = **$0.00 (within free tier)** |
| **Vercel Frontend Hosting** | 100 GB bandwidth / mo | **Pro Plan: $20.00 / month** | Hobby free tier sufficient for pilot = **$0.00** |

---

## 2. Monthly Budget Forecast by Pilot Stage

```
+----------------------------------------------------------------------------------------+
|  Stage                 | Scale                  | Monthly Cloud Cost | Cost Per Family  |
+------------------------+------------------------+--------------------+------------------+
|  Stage A (Internal)    | 10 Engineers           | $0.00 (Free Tiers) | $0.00            |
|  Stage B (Families)    | 30 Families (90 Users) | $27.00             | $0.90 / family   |
|  Stage C (Community)   | 1 Society (400 Users)  | $48.50             | $0.32 / family   |
+----------------------------------------------------------------------------------------+
```

### Detailed Stage C (400 Users / 1 Residential Society) Cost Model
- **Supabase Pro Database & Storage:** $25.00
- **Google Gemini 1.5 Flash (AI Timeline & Queries):** $2.50 (approx. 10M tokens)
- **Google Vision OCR (Prescriptions & Lab Scans):** $1.50 (1,000 billable pages above free allowance)
- **Exotel SMS (Medication & Appointment Alerts):** $12.00 (approx. 5,000 transactional SMS)
- **Exotel Voice Call Escalations:** $2.50 (approx. 275 voice call minutes)
- **Cloud Run & Vercel Compute:** $5.00
- **Total Projected Monthly Cloud Spend:** **$48.50 / month (~₹4,050 INR)**

---

## 3. Cost Optimization & Scaling Recommendations

1. **OCR Batching & Heuristic Pre-Filtering:**
   - Pre-process digital PDF files using local native text extraction (`pdfkit` / `pdf-parse`) before sending to cloud OCR. This bypasses billable Vision API calls for ~65% of typed lab reports.
2. **Context Window Caching:**
   - Leverage Gemini Prompt Caching for static patient medical timelines, reducing repeated token ingestion costs by up to 75%.
3. **PWA Push Notifications vs SMS:**
   - Encourage progressive web app (PWA) installation to deliver medication reminders via browser Web Push (free of cost), reserving billable carrier SMS for high-priority caregiver escalations.
4. **Offline Local SQLite / IndexedDB:**
   - Shifting read queries to local device caches minimizes server database egress bandwidth and database compute workloads.
