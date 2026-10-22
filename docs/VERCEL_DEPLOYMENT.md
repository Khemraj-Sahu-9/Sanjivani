# Vercel Cloud Deployment Guide — Sanjivani (Health Memory Agent)

> **Complete guide to deploying Sanjivani to Vercel so users can access the application through a live HTTPS URL.**
> No local server or terminal processes are required to keep the app online.

---

## 1. Application Architecture Discovered

| Layer | Technology | Deployment Target | Root Directory | Output / Entry |
|---|---|---|---|---|
| **Frontend** | React 18, TypeScript, Vite, React Router, CSS Modules | Vercel Project 1 (Static SPA) | `frontend` | Output: `dist` |
| **Backend** | Node.js (ESM), Express.js, TypeScript, Supabase JS SDK, Helmet, CORS | Vercel Project 2 (Serverless Functions) | `backend` | Entry: `api/index.ts` |
| **Database & Auth** | PostgreSQL via Supabase, Supabase Auth, Supabase Storage | Supabase Cloud | Managed Cloud | Hosted at `https://<project-ref>.supabase.co` |
| **AI Engine** | Grounded clinical memory analyzer + Google Gemini API | Server-side Backend | Managed API | Grounded retrieval fallback built-in |

### Communication Flow
```
User Browser (HTTPS)
      │
      ├──> [Vercel Project 1: Frontend] (https://sanjivani.vercel.app)
      │         │
      │         ▼ (REST API requests with Authorization: Bearer <token>)
      └──> [Vercel Project 2: Backend] (https://sanjivani-backend.vercel.app)
                │
                ├──> [Supabase Cloud] (Database, Auth, Storage)
                └──> [Google Gemini API] (Health Memory AI Answering)
```

- **Frontend to Backend**: The frontend communicates with the backend via `VITE_API_BASE_URL`.
- **CORS Protection**: The backend enforces strict origin checking via `FRONTEND_URL` (supporting comma-separated production and Vercel preview domains), rejecting unauthorized cross-origin requests while preserving server-to-server and health checks.
- **Security Isolation**: `SUPABASE_SECRET_KEY` and `GEMINI_API_KEY` are stored strictly on the server-side backend. Browser bundles only ever receive public publishable keys and user session bearer tokens.

---

## 2. Prerequisites Checklist

Before deploying, ensure you have:
1. A **GitHub account** with the `Sanjivani` repository pushed.
2. A **Vercel account** connected to your GitHub ([vercel.com](https://vercel.com)).
3. Your **Supabase Project** URL and keys:
   - Supabase Project URL (`https://<project-ref>.supabase.co`)
   - Secret / Service-Role Key (`sb_secret_...` or legacy `service_role` JWT)
   - Publishable / Anon Key (`sb_publishable_...` or legacy `anon` JWT)
4. *(Optional)* **Google Gemini API Key** for live AI Health Memory queries.

---

## 3. Step-by-Step Vercel Deployment

We deploy the system as **two projects in Vercel** linked to the same GitHub repository:
1. **Backend Project** (`sanjivani-backend`) — provides the serverless API.
2. **Frontend Project** (`sanjivani-frontend`) — serves the web UI and connects to the backend.

---

### Step 3.1: Deploy the Backend (Project 1 on Vercel)

1. Open your [Vercel Dashboard](https://vercel.com/dashboard) and click **"Add New..."** → **"Project"**.
2. Select your `Sanjivani` GitHub repository and click **"Import"**.
3. In the **Configure Project** screen:
   - **Project Name**: `sanjivani-backend` (or your preferred name).
   - **Framework Preset**: Select **Other**.
   - **Root Directory**: Click **Edit** and select `backend`.
4. Expand the **Build and Output Settings** section:
   - **Build Command**: `npm run build`
   - **Output Directory**: Leave empty / default.
   - **Install Command**: Leave empty / default (`npm install`).
5. Expand the **Environment Variables** section and add the following:

| Variable Name | Required? | Example / Format | Description | Confidentiality |
|---|---|---|---|---|
| `NODE_ENV` | Yes | `production` | Production runtime flag | Public |
| `DEMO_MODE` | Yes | `false` | Set to `false` for live Supabase; `true` for in-memory mode | Public |
| `SUPABASE_URL` | Yes | `https://xxxx.supabase.co` | Your Supabase project HTTPS URL | Public |
| `SUPABASE_SECRET_KEY` | Yes | `sb_secret_...` | Supabase privileged secret/service-role key | **CONFIDENTIAL** |
| `SUPABASE_PUBLISHABLE_KEY` | Yes | `sb_publishable_...` | Supabase publishable or anon key | Public |
| `FRONTEND_URL` | Yes | `https://sanjivani-frontend.vercel.app` | Allowed frontend origin(s), comma-separated | Public |
| `GEMINI_API_KEY` | Optional | `AIzaSy...` | Google Gemini API key for live AI answers | **CONFIDENTIAL** |

*(Note: When you first deploy the backend, set `FRONTEND_URL` to `http://localhost:5173,https://*.vercel.app` or update it with your actual frontend URL after Step 3.2).*

6. Click **"Deploy"**.
7. Wait 1-2 minutes for the build to complete.
8. Copy your live backend URL (e.g. `https://sanjivani-backend.vercel.app`).

---

### Step 3.2: Verify Backend Deployment

Open your browser or terminal and test your backend URL:
- Visit `https://your-backend.vercel.app/` — should return:
  ```json
  {
    "name": "Sanjivani — AI Health Memory Agent API",
    "status": "ok",
    "version": "0.0.1",
    "environment": "production",
    "demo_mode": false,
    "health": "/api/health"
  }
  ```
- Visit `https://your-backend.vercel.app/api/health` — should return HTTP 200 `{"status": "ok"}`.
- Visit `https://your-backend.vercel.app/api/health/ready` — should report readiness and `database: "supabase_connected"`.

---

### Step 3.3: Deploy the Frontend (Project 2 on Vercel)

1. Return to your [Vercel Dashboard](https://vercel.com/dashboard) and click **"Add New..."** → **"Project"**.
2. Select the same `Sanjivani` GitHub repository and click **"Import"**.
3. In the **Configure Project** screen:
   - **Project Name**: `sanjivani-frontend` (or `sanjivani`).
   - **Framework Preset**: Vercel automatically detects **Vite**.
   - **Root Directory**: Click **Edit** and select `frontend`.
4. Build and output settings are auto-configured by `frontend/vercel.json` and Vite:
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Expand the **Environment Variables** section and add:

| Variable Name | Required? | Example / Format | Description | Confidentiality |
|---|---|---|---|---|
| `VITE_API_BASE_URL` | **Yes** | `https://sanjivani-backend.vercel.app` | Your deployed backend HTTPS URL from Step 3.1 | Public |
| `VITE_APP_NAME` | Optional | `Sanjivani` | Application brand name | Public |
| `VITE_SUPABASE_URL` | Optional | `https://xxxx.supabase.co` | Supabase project URL | Public |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Optional | `sb_publishable_...` | Supabase publishable key | Public |

> [!CAUTION]
> **NEVER add `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` to the frontend!**
> Frontend variables starting with `VITE_` are bundled into client-side JavaScript. Only the backend server should hold secret keys.

6. Click **"Deploy"**.
7. Wait 1 minute for Vite compilation.
8. Copy your live frontend URL (e.g. `https://sanjivani-frontend.vercel.app`).

---

### Step 3.4: Connect CORS Between Frontend and Backend

1. Go back to your backend project in Vercel (`sanjivani-backend`).
2. Navigate to **Settings** → **Environment Variables**.
3. Edit `FRONTEND_URL` and set its value to your exact frontend domain, plus local dev:
   ```
   https://sanjivani-frontend.vercel.app,http://localhost:5173
   ```
4. Navigate to **Deployments** tab and click **Redeploy** on the latest deployment (or trigger a new git push) so the updated `FRONTEND_URL` takes effect.

---

## 4. End-to-End Verification Guide

Once both projects are live, verify the core user journeys:

### 1. Frontend Page Loading & Routing
- Open your live frontend URL `https://your-frontend.vercel.app/`.
- Navigate to `/login`, `/register`, and `/dashboard`.
- Refresh any sub-route (e.g. `/register`) in your browser. Thanks to `frontend/vercel.json`, Vercel rewrites all routes to `index.html` without returning a 404.

### 2. Live Registration and Authentication
- On the `/register` page, create a test family account.
- The browser dispatches `POST https://your-backend.vercel.app/api/auth/register`.
- The backend creates the account with Supabase Auth and returns a session token.
- The user is redirected to the active dashboard.

### 3. Patient Workspace & Medical Records
- Create an elderly or family patient profile.
- Open the **Documents** tab and upload a sample medical document (PDF or image).
- The file uploads to the backend and is securely archived in the private Supabase Storage bucket (`medical-records`).
- An OCR job runs on the server; extracted fields appear under **Review Required**.
- Confirmed fields become part of the patient's verified clinical history.

### 4. AI Health Memory Chat
- Open the **Health Memory** tab.
- Ask a clinical question about the patient (e.g. "What medications was the patient prescribed?").
- The backend analyzes the grounded documents and returns a referenced response.
- If `GEMINI_API_KEY` is configured, Google Gemini formulates natural conversational answers; otherwise, the deterministic grounded fallback handles the query.

### 5. Medication Reminders & SOS Emergency Simulation
- Test taking scheduled doses on the Medication Dashboard.
- Open the Emergency Dashboard to test the SOS sequence.
- All SOS events are explicitly watermarked `DEMO_SIMULATION_ONLY`. No real emergency services or hospitals are contacted.

---

## 5. Security & Secret Protection

- **No Secrets in Git**: Git tracking was verified; no `.env` files or secret keys were committed.
- **Gitignore Protection**: Root, backend, and frontend `.gitignore` files exclude all `.env`, `.env.*`, and `.vercel` directories.
- **Secret Key Rotation Notice**:
  > [!IMPORTANT]
  > If any secret key was previously shared or exposed in chat or unencrypted channels, rotate it immediately in the [Supabase Dashboard](https://supabase.com/dashboard) under **Project Settings → API → Secret Keys**. Enter the newly rotated secret key into the Vercel backend environment variables without displaying it in chat or terminal logs.

---

## 6. Background Jobs & Scheduled Work on Serverless

In a standard Node.js server, jobs can run via `setInterval`. However, **Vercel Serverless Functions are ephemeral**: they only execute in response to incoming HTTP requests and spin down when idle.

To execute scheduled work (such as checking due medication reminders or caregiver escalations) on Vercel:
1. **Vercel Cron (Included)**: Vercel supports scheduled cron triggers by adding a `crons` entry in `backend/vercel.json` (e.g., calling `/api/notifications/scheduler/process-due` periodically).
2. **External Schedulers**: You can use external cron services (e.g., [cron-job.org](https://cron-job.org), GitHub Actions, or Supabase `pg_cron`) to trigger the scheduler endpoint with authorized service credentials.
3. If an automated background scheduler is not configured, medication dose tracking and appointment reminders continue functioning interactively upon user check-in.
