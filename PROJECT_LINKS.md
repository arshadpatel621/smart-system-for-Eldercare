# VitalCare AI — Project Links

A complete reference of all URLs, services, and resources for the VitalCare AI Elder Care Monitoring system.

---

## 🌐 Website

| Environment | URL |
|-------------|-----|
| Development | `http://localhost:5173` (Vite dev server) |
| Backend API | `http://localhost:5000` (Express server) |
| Production | *(Deploy to Firebase Hosting — see FIREBASE_SETUP.md)* |

---

## 📦 GitHub Repository

| Resource | Details |
|----------|---------|
| Repository | `d:\eldercare` (local workspace) |
| Main branch | `main` |
| Workflow file | [`n8n/VitalCare-AI-Elder-Care-Monitoring.json`](./n8n/VitalCare-AI-Elder-Care-Monitoring.json) |
| n8n README | [`n8n/README.md`](./n8n/README.md) |

---

## 🔄 n8n Workflow

| Resource | Details |
|----------|---------|
| Platform | [n8n Cloud](https://app.n8n.cloud) |
| Workflow Name | VitalCare AI - Elder Care Monitoring |
| Workflow ID | `cOTJhjYUp54LjDz0` |
| Workflow File | [`n8n/VitalCare-AI-Elder-Care-Monitoring.json`](./n8n/VitalCare-AI-Elder-Care-Monitoring.json) |
| Workflow Docs | [`n8n/README.md`](./n8n/README.md) |

---

## 🔗 n8n Webhook Endpoint

| Item | Value |
|------|-------|
| **Webhook URL** | `https://arshadpatel6361.app.n8n.cloud/webhook/vitalcare-ai` |
| **Method** | `POST` |
| **Content-Type** | `application/json` |
| **CORS** | `*` (all origins allowed) |
| **Env Variable** | `VITE_N8N_WEBHOOK_URL` |

### Quick Test

```bash
curl -X POST https://arshadpatel6361.app.n8n.cloud/webhook/vitalcare-ai \
  -H "Content-Type: application/json" \
  -d '{"residentId":"test-001","name":"Test Resident","age":75,"heartRate":78,"spo2":97,"bloodPressure":"122/78","temperature":36.6,"respiratoryRate":15,"sleepHours":7,"steps":2500,"stressLevel":25,"fallDetected":false,"medicationTaken":true}'
```

---

## 🔥 Firebase Project

| Resource | Details |
|----------|---------|
| Project ID | `smart-eldercare-81352992-1b464` |
| Auth Domain | `smart-eldercare-81352992-1b464.firebaseapp.com` |
| Storage Bucket | `smart-eldercare-81352992-1b464.firebasestorage.app` |
| Messaging Sender ID | `671977597748` |
| Firebase Console | [console.firebase.google.com/project/smart-eldercare-81352992-1b464](https://console.firebase.google.com/project/smart-eldercare-81352992-1b464) |
| Firestore | [Firestore Database](https://console.firebase.google.com/project/smart-eldercare-81352992-1b464/firestore) |
| Hosting | [Firebase Hosting](https://console.firebase.google.com/project/smart-eldercare-81352992-1b464/hosting) |
| Authentication | [Firebase Auth](https://console.firebase.google.com/project/smart-eldercare-81352992-1b464/authentication) |

---

## 🤖 AI Services

### Groq (Primary LLM Provider)

| Resource | Details |
|----------|---------|
| Platform | [console.groq.com](https://console.groq.com) |
| Model Used | `llama-3.3-70b-versatile` |
| Agents Count | 5 (Health, Risk, Emergency, Recommendation, Caregiver Report) |
| Credential Name | `Groq account` (in n8n) |
| Temperature | `0.2` (low — deterministic clinical output) |
| Max Tokens | `2048` per agent call |

### n8n LangChain Nodes

| Node Type | Usage |
|-----------|-------|
| `@n8n/n8n-nodes-langchain.agent` | All 5 AI agents |
| `@n8n/n8n-nodes-langchain.lmChatGroq` | Groq LLM connection for each agent |
| `@n8n/n8n-nodes-langchain.outputParserStructured` | JSON schema enforcement for each agent |

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| [`eldercare/.env.example`](./eldercare/.env.example) | Environment variable template |
| [`eldercare/.env`](./eldercare/.env) | Local environment config (git-ignored) |
| [`eldercare/src/services/aiService.ts`](./eldercare/src/services/aiService.ts) | React → n8n webhook client |
| [`eldercare/src/pages/HealthMonitor.tsx`](./eldercare/src/pages/HealthMonitor.tsx) | Health monitoring UI |
| [`eldercare/firestore.rules`](./eldercare/firestore.rules) | Firestore security rules |
| [`server/index.ts`](./server/index.ts) | Express backend entry point |
| [`n8n/VitalCare-AI-Elder-Care-Monitoring.json`](./n8n/VitalCare-AI-Elder-Care-Monitoring.json) | n8n workflow export |
| [`n8n/README.md`](./n8n/README.md) | n8n workflow documentation |

---

*Generated: 2026-07-25*
