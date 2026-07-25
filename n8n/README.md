# VitalCare AI — n8n Workflow

## Workflow Overview

**Name:** VitalCare AI - Elder Care Monitoring  
**Workflow ID:** `cOTJhjYUp54LjDz0`  
**Webhook Path:** `/webhook/vitalcare-ai`  
**Trigger:** HTTP POST  
**Status:** Active  

This n8n workflow powers the AI backend for the VitalCare elder care monitoring system. It receives resident vital sign data from the React frontend via a webhook, runs it through five sequential Groq LLM agents, and returns a single consolidated JSON response containing a full health assessment, risk prediction, emergency status, recommendations, and a caregiver report.

---

## Execution Flow

```
React App (POST)
       │
       ▼
[1] Receive Resident Health Data   ← Webhook trigger (POST /webhook/vitalcare-ai)
       │
       ▼
[2] Normalize & Validate Input     ← JS: sanitize, coerce types, fill defaults, quality flags
       │
       ▼
[3] Health Monitoring Agent        ← Groq LLM: healthScore (0–100), overallHealth, summary
       │
       ▼
[4] Risk Prediction Agent          ← Groq LLM: fallRisk (%), heartRisk, sleepRisk, activityRisk
       │
       ▼
[5] Emergency Agent                ← Groq LLM: emergency flag, priority, immediateAction
       │
       ▼
[6] Recommendation Agent           ← Groq LLM: Diet, Exercise, Hydration, Medication, Sleep, Doctor
       │
       ▼
[7] Caregiver Report Agent         ← Groq LLM: formatted multi-section clinical report
       │
       ▼
[8] Assemble Final Response        ← JS: merge all outputs, derive riskLevel
       │
       ▼
[9] Respond to Frontend            ← HTTP 200 JSON + CORS headers
```

---

## AI Agents Used

| # | Agent Name | Model | Purpose |
|---|-----------|-------|---------|
| 1 | **Health Monitoring Agent** | `llama-3.3-70b-versatile` | Evaluates vitals, computes health score (0–100) and overallHealth label |
| 2 | **Risk Prediction Agent** | `llama-3.3-70b-versatile` | Predicts fall risk (%), heart/sleep/activity risk levels |
| 3 | **Emergency Agent** | `llama-3.3-70b-versatile` | Detects true emergencies, provides priority and immediate action |
| 4 | **Recommendation Agent** | `llama-3.3-70b-versatile` | Generates personalized Diet/Exercise/Hydration/Medication/Sleep/Doctor recommendations |
| 5 | **Caregiver Report Agent** | `llama-3.3-70b-versatile` | Produces professional multi-section caregiver report with next checkup |

All agents use **structured output parsers** to guarantee valid JSON responses.

---

## Input Payload

Send a `POST` request to the webhook URL with the following JSON body:

```json
{
  "residentId": "resident-001",
  "name": "John Doe",
  "age": 78,
  "gender": "Male",
  "heartRate": 82,
  "spo2": 96,
  "bloodPressure": "128/82",
  "temperature": 36.8,
  "respiratoryRate": 16,
  "sleepHours": 6.5,
  "steps": 1200,
  "stressLevel": 35,
  "cameraEvent": "none",
  "fallDetected": false,
  "medicationTaken": true,
  "timestamp": "2026-07-25T10:00:00.000Z"
}
```

### Field Reference

| Field | Type | Range | Description |
|-------|------|-------|-------------|
| `residentId` | string | — | Unique resident identifier |
| `name` | string | — | Resident full name |
| `age` | number | 0–130 | Age in years |
| `gender` | string | — | Gender |
| `heartRate` | number | 0–300 | Beats per minute |
| `spo2` | number | 0–100 | Blood oxygen saturation (%) |
| `bloodPressure` | string | — | e.g. `"120/80"` |
| `temperature` | number | 25–45 | Body temperature (°C) |
| `respiratoryRate` | number | 0–80 | Breaths per minute |
| `sleepHours` | number | 0–24 | Hours of sleep last night |
| `steps` | number | 0–100000 | Daily step count |
| `stressLevel` | number | 0–100 | Perceived stress level |
| `cameraEvent` | string | — | Camera-detected event or `"none"` |
| `fallDetected` | boolean | — | Fall detection flag |
| `medicationTaken` | boolean | — | Medication compliance flag |
| `timestamp` | string | ISO 8601 | Data collection timestamp |

> Missing or invalid fields are handled gracefully — the validation node fills safe defaults and records `dataQuality` flags.

---

## Output Payload

The workflow responds with a single JSON object:

```json
{
  "residentId": "resident-001",
  "name": "John Doe",
  "healthScore": 74,
  "overallHealth": "Good",
  "riskLevel": "Medium",
  "emergency": false,
  "fallRisk": 38,
  "heartRisk": "Low",
  "sleepRisk": "Medium",
  "activityRisk": "Low",
  "summary": "Resident presents stable vitals with mildly reduced sleep...",
  "recommendations": [
    { "category": "Sleep", "recommendation": "Aim for 7–8 hours; establish a consistent bedtime routine." },
    { "category": "Diet", "recommendation": "Increase potassium-rich foods to support blood pressure management." }
  ],
  "caregiverReport": "## Current Status\n...\n## Risk\n...\n## Recommendations\n...",
  "nextCheckup": "Within 24 hours",
  "emergencyDetails": null,
  "dataQuality": {
    "missingFields": [],
    "invalidFields": [],
    "complete": true
  },
  "timestamp": "2026-07-25T10:00:00.000Z",
  "processedAt": "2026-07-25T10:00:05.123Z"
}
```

---

## Required Credentials

### Groq API Key

All five AI agents use the **Groq API** to call `llama-3.3-70b-versatile`.

1. Sign up at [console.groq.com](https://console.groq.com)
2. Create an API key under **API Keys**
3. In n8n, go to **Settings → Credentials → New Credential**
4. Select **Groq** and paste your API key
5. Name it **"Groq account"** (this matches what the workflow expects)

---

## Environment Variables

Set these in `eldercare/.env` (copy from `.env.example`):

```env
# n8n Webhook
VITE_N8N_WEBHOOK_URL=https://<your-n8n-cloud-subdomain>.app.n8n.cloud/webhook/vitalcare-ai
```

The live webhook URL for this project is:
```
https://arshadpatel6361.app.n8n.cloud/webhook/vitalcare-ai
```

---

## Import Steps

### Import into n8n Cloud

1. Log in to [app.n8n.cloud](https://app.n8n.cloud)
2. Go to **Workflows** in the left sidebar
3. Click **+ New Workflow** → **Import from file**
4. Select `n8n/VitalCare-AI-Elder-Care-Monitoring.json`
5. Click **Import**

### After Import

6. Open the workflow
7. Click on any **Groq Model** node (e.g., "Groq Model - Health")
8. Under **Credential**, click **+ Add Credential** → select your saved Groq credential
9. Repeat for all 5 Groq Model nodes:
   - Groq Model - Health
   - Groq Model - Risk
   - Groq Model - Emergency
   - Groq Model - Recommendations
   - Groq Model - Report
10. Click **Save** (top right)
11. Toggle **Active** to enable the workflow
12. Copy the webhook URL from the **"Receive Resident Health Data"** node and set it as `VITE_N8N_WEBHOOK_URL` in your `.env`

---

## Deployment Instructions

### n8n Cloud (Recommended)

1. Use [app.n8n.cloud](https://app.n8n.cloud) — no server management needed
2. The webhook is automatically HTTPS and publicly accessible
3. Free tier supports up to 5 active workflows and 2,500 executions/month

### Self-Hosted n8n (Docker)

```bash
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  -e N8N_HOST=your-domain.com \
  -e WEBHOOK_URL=https://your-domain.com \
  n8nio/n8n
```

Then import the workflow via the n8n UI at `http://localhost:5678`.

### CORS

The webhook node is already configured with `allowedOrigins: "*"` and the response node sends `Access-Control-Allow-Origin: *` headers, so the React app can call the webhook directly from the browser.

---

## Testing the Webhook

Use `curl` to verify the workflow is running:

```bash
curl -X POST https://arshadpatel6361.app.n8n.cloud/webhook/vitalcare-ai \
  -H "Content-Type: application/json" \
  -d '{
    "residentId": "test-001",
    "name": "Test Resident",
    "age": 75,
    "gender": "Female",
    "heartRate": 78,
    "spo2": 97,
    "bloodPressure": "122/78",
    "temperature": 36.6,
    "respiratoryRate": 15,
    "sleepHours": 7,
    "steps": 2500,
    "stressLevel": 25,
    "cameraEvent": "none",
    "fallDetected": false,
    "medicationTaken": true,
    "timestamp": "2026-07-25T10:00:00.000Z"
  }'
```

Expected response: HTTP 200 with a full JSON health assessment.
