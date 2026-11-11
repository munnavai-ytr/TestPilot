---
title: TestPilot Runner
emoji: 🧪
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
---

# TestPilot Runner

Autonomous, production-grade AI QA testing agent service. TestPilot Runner opens websites in a real headless Chromium browser, tests user flows and features like a human QA engineer, captures real viewport screenshots, collects runtime console/network errors, detects visual/functional bugs, and securely persists test runs and screenshots into Supabase.

---

## 📱 Phone-Friendly Deployment Guide (No Terminal Required)

You can deploy and connect your TestPilot Runner entirely from your smartphone browser in under 5 minutes.

### Step 1: Set Up Supabase (Free Database & Storage)

1. Open your mobile browser and go to [supabase.com](https://supabase.com). Sign in or create a free account.
2. Tap **"New Project"**, name it `testpilot-runner`, set a strong database password, and tap **"Create new project"**.
3. Once the project finishes provisioning:
   - Tap the hamburger menu (☰) and tap **"SQL Editor"**.
   - Tap **"New query"** (or the `+` button).
   - Copy the entire contents of the [`supabase/schema.sql`](./supabase/schema.sql) file from this repository and paste it into the editor.
   - Tap **"Run"**. This will instantly create the `runs` table and the public `screenshots` storage bucket.
4. Obtain your API credentials:
   - Tap the **Settings gear icon (⚙)** in the sidebar -> **API**.
   - Copy the **Project URL** (e.g., `https://xyzcompany.supabase.co`).
   - Scroll down to **Project API keys** and copy the **`service_role` (secret)** key. *(Keep this private)*.

---

### Step 2: Deploy to Hugging Face Spaces (Free Cloud Docker Host)

1. Open [huggingface.co/spaces](https://huggingface.co/spaces) in your mobile browser and log in.
2. Tap your profile picture -> **"New Space"**.
3. Enter Space details:
   - **Space name**: `testpilot-runner`
   - **License**: `mit` or `apache-2.0`
   - **Select the Space SDK**: Choose **Docker** -> **Blank**.
   - **Space Hardware**: Free tier (2 vCPU, 16GB RAM is included).
   - Tap **"Create Space"**.
4. In your new Space:
   - Tap **"Files"** -> **"Add file"** -> **"Upload files"**.
   - Upload the files from this repository:
     - `Dockerfile`
     - `package.json`
     - `tsconfig.json`
     - The `src/` folder files: `server.ts`, `agent.ts`, `browser.ts`, `gemini.ts`, `supabase.ts`, `security.ts`, `scoring.ts`, `config.ts`, `types.ts`
     - Tap **"Commit changes to main"**.
5. Add your Environment Secrets:
   - Tap **"Settings"** tab on your Space page.
   - Scroll down to **"Variables and secrets"** -> tap **"New secret"**.
   - Add the following secrets one by one:
     - `RUNNER_TOKEN`: Any secret password you invent (e.g. `my-qa-token-2026`).
     - `SUPABASE_URL`: The Project URL from Step 1.
     - `SUPABASE_SERVICE_ROLE_KEY`: The `service_role` secret key from Step 1.
     - `GEMINI_MODEL`: `gemini-2.5-flash` (optional, default).
     - `ALLOWED_ORIGIN`: `*` (or your TestPilot frontend domain).
6. Hugging Face will automatically build and boot the Docker container on port 7860.
7. Once the status shows **"Running"**, copy your Space's public Direct URL (accessible under the three dots menu -> **"Embed this Space"** -> copy the direct link, e.g. `https://yourusername-testpilot-runner.hf.space`).

---

### Step 3: Connect to TestPilot Web Dashboard

1. Open your TestPilot web app.
2. Tap the **Settings (gear icon)** drawer.
3. Fill in:
   - **Runner API URL**: `https://yourusername-testpilot-runner.hf.space`
   - **Runner Access Token**: The `RUNNER_TOKEN` you created in Step 2.
   - **Gemini API Key**: Your free Gemini API key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
4. Tap **Save Settings**.
5. You're ready! Enter any website URL (e.g., `https://example.com`), select **Smoke** or **Full QA**, type what you want to test, and tap **"Run Test"**.

---

## 🛠️ API Reference

All `/api` endpoints require the header:
```
Authorization: Bearer <RUNNER_TOKEN>
```

### 1. `POST /api/runs`
Initiates an autonomous QA test run.

- **Headers**:
  - `Authorization: Bearer <RUNNER_TOKEN>`
  - `X-Gemini-Key: <GEMINI_API_KEY>` (Required)
  - `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "url": "https://example.com",
    "command": "Verify that navigation links work and sign up button is responsive",
    "mode": "smoke", // "smoke" | "user_flow" | "full_qa"
    "credentials": {
      "email": "tester@example.com",
      "password": "SecretPassword123"
    } // Optional: credentials are never sent to Gemini or Supabase
  }
  ```
- **Response** `(200 OK)`:
  ```json
  {
    "runId": "b8a8bcf4-49c8-47c1-8ce2-4e8c740266e7"
  }
  ```

### 2. `GET /api/runs/:id`
Polls live execution progress, steps, screenshots, bug list, and deterministic quality score.

- **Response** `(200 OK)`:
  ```json
  {
    "id": "b8a8bcf4-49c8-47c1-8ce2-4e8c740266e7",
    "url": "https://example.com",
    "command": "Verify sign up flow",
    "mode": "smoke",
    "status": "completed", // "running" | "completed" | "failed" | "stopped"
    "steps": [
      {
        "index": 1,
        "action": "Opened https://example.com",
        "status": "passed",
        "duration": "1.2s",
        "screenshotUrl": "https://xyz.supabase.co/storage/v1/object/public/screenshots/..."
      }
    ],
    "bugs": [
      {
        "id": "bug-1",
        "title": "Navigation link returns 404",
        "severity": "High",
        "pageUrl": "https://example.com/pricing",
        "screenshotUrl": "https://xyz.supabase.co/storage/v1/object/public/screenshots/...",
        "whatHappened": "Clicking 'Pricing' led to a 404 Not Found error page.",
        "whyItHappened": "Broken hyperlink path or unrouted endpoint.",
        "howToFix": "Update href attribute on header pricing anchor."
      }
    ],
    "score": 85,
    "createdAt": "2026-11-11T08:00:00.000Z",
    "completedAt": "2026-11-11T08:01:15.000Z"
  }
  ```

### 3. `POST /api/runs/:id/stop`
Gracefully signals the running agent to stop immediately, synthesize findings up to this point, and finalize the run.

---

## 🔒 Security Hardening

- **SSRF Prevention**: Strict DNS resolution and CIDR filtering prevents requests to `localhost`, `127.0.0.1`, RFC 1918 private ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), link-local, multicast, and cloud metadata (`169.254.169.254`). Subrequests in Playwright are actively blocked at the route layer.
- **Timing Safe Authentication**: Bearer tokens are validated using `crypto.timingSafeEqual` with SHA-256 digests to protect against timing attacks.
- **Zero Credential Leaks**: Login credentials provided for automated tests are injected locally into browser DOM form elements and never transmitted to Gemini or logged.
- **Single Concurrent Run & IP Rate Limiting**: The runner enforces 1 active run at a time to prevent resource contention, and rate limits requests to 10 runs/hr per client IP.
