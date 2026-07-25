# Smart System for ElderCare — VitalCare AI

A full-stack AI-powered elder care monitoring system that collects resident vital signs, processes them through a multi-agent n8n AI workflow, and displays real-time health insights in a React dashboard backed by Firebase.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite + TypeScript + TailwindCSS |
| Backend | Node.js + Express (TypeScript) |
| Database | Firebase Firestore |
| AI Workflow | n8n Cloud + Groq (llama-3.3-70b-versatile) |
| Auth | Firebase Authentication |
| Hosting | Firebase Hosting / Vite Dev Server |

---

## Project Structure

```
eldercare/
├── eldercare/          # React frontend (Vite + TypeScript)
│   ├── src/
│   │   ├── pages/      # HealthMonitor, Dashboard, etc.
│   │   ├── services/   # aiService.ts (n8n webhook client)
│   │   └── config/     # Firebase, device config
│   ├── .env.example    # Environment variable template
│   └── firestore.rules
├── server/             # Express backend (TypeScript)
│   ├── index.ts
│   └── watch/          # Watch routes
└── n8n/                # n8n AI workflow
    ├── VitalCare-AI-Elder-Care-Monitoring.json
    └── README.md
```

---

## Quick Start

```bash
# 1. Clone the repository
git clone <repo-url>
cd eldercare

# 2. Install frontend dependencies
cd eldercare && npm install

# 3. Copy and fill environment variables
cp .env.example .env
# Edit .env with your Firebase config and n8n webhook URL

# 4. Start the dev server
npm run dev
```

---

## n8n AI Workflow

The VitalCare AI workflow is the intelligence engine of this system. It runs on n8n Cloud and processes elder care resident vitals through five sequential Groq LLM agents.

### Workflow Description

When the React app submits resident vitals, the n8n workflow:

1. **Validates & normalizes** the incoming payload (coerces types, fills missing fields, flags data quality issues)
2. **Health Monitoring Agent** — scores overall health (0–100) and identifies vital sign abnormalities
3. **Risk Prediction Agent** — computes fall risk (%), heart/sleep/activity risk levels
4. **Emergency Agent** — detects critical conditions requiring immediate intervention
5. **Recommendation Agent** — generates personalized care recommendations (Diet, Exercise, Hydration, Medication, Sleep, Doctor)
6. **Caregiver Report Agent** — produces a professional multi-section clinical report
7. **Assembles** all outputs into a single JSON response returned to the frontend

### Webhook Endpoint

```
POST https://arshadpatel6361.app.n8n.cloud/webhook/vitalcare-ai
```

### Import Instructions

1. Log in to [app.n8n.cloud](https://app.n8n.cloud)
2. Go to **Workflows → + New Workflow → Import from file**
3. Select `n8n/VitalCare-AI-Elder-Care-Monitoring.json`
4. After import, attach your **Groq API credential** to all 5 Groq Model nodes
5. Save and **Activate** the workflow
6. Copy the webhook URL and set `VITE_N8N_WEBHOOK_URL` in your `.env`

> See [n8n/README.md](./n8n/README.md) for the full import guide, payload schemas, and deployment instructions.

### Required Credentials

| Service | Credential | Where to Get It |
|---------|-----------|----------------|
| **Groq** | API Key | [console.groq.com](https://console.groq.com) → API Keys |

### Environment Variables

Add these to `eldercare/.env`:

```env
# Firebase
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
VITE_FIREBASE_ELDER_ID=demo-resident

# Backend API
VITE_API_URL=http://localhost:5000

# n8n AI Workflow Webhook
VITE_N8N_WEBHOOK_URL=https://<your-n8n-subdomain>.app.n8n.cloud/webhook/vitalcare-ai
```

### Execution Flow

```
React App
    │  POST { residentId, heartRate, spo2, ... }
    ▼
n8n Webhook (/webhook/vitalcare-ai)
    │
    ├─► Validate & Normalize Input
    ├─► Health Monitoring Agent      (Groq llama-3.3-70b)
    ├─► Risk Prediction Agent        (Groq llama-3.3-70b)
    ├─► Emergency Agent              (Groq llama-3.3-70b)
    ├─► Recommendation Agent         (Groq llama-3.3-70b)
    ├─► Caregiver Report Agent       (Groq llama-3.3-70b)
    └─► Assemble Final Response
    │
    ▼  HTTP 200 JSON
React App → display health dashboard + alerts
```

---

## Firebase Setup

See [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) for detailed Firebase project configuration.

---

## Additional Documentation

| File | Description |
|------|-------------|
| [n8n/README.md](./n8n/README.md) | n8n workflow deep-dive |
| [N8N_INTEGRATION_GUIDE.md](./N8N_INTEGRATION_GUIDE.md) | n8n integration walkthrough |
| [N8N_CONFIG_VISUAL_GUIDE.md](./N8N_CONFIG_VISUAL_GUIDE.md) | Visual configuration guide |
| [N8N_DEBUGGING_GUIDE.md](./N8N_DEBUGGING_GUIDE.md) | Debugging & troubleshooting |
| [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) | Firebase project setup |
| [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) | Full implementation guide |
| [START_HERE.md](./START_HERE.md) | Getting started guide |

---

## License

MIT
