# VitalCare Elder Care Monitoring System — Architectural Reference & Production Guide

## 1. System Overview & Architecture

VitalCare is an intelligent elder care platform integrating multi-role authentication (Elder, Caregiver, Administrator), real-time biometric tracking, automated emergency response protocols, medication routines, and hardware integration boundaries.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Frontend (Vercel / React SPA)                   │
│   React 18 + Vite + TypeScript + Tailwind CSS                          │
│                                                                        │
│   Roles: Elder Portal | Caregiver Portal | Admin Management            │
│   Contexts: AuthContext | EldercareContext                             │
│   Managers: useCameraManager | useWatchManager | useDeviceManager     │
└──────────────┬─────────────────────────┬───────────────────────────────┘
               │                         │
               ▼                         ▼
┌───────────────────────────────┐ ┌──────────────────────────────────────┐
│  Firebase Backend (Cloud)     │ │  Camera Edge Gateway (Local Server)  │
│                               │ │                                      │
│  - Firebase Authentication    │ │  - Node.js / Express                 │
│  - Cloud Firestore            │ │  - Native ONVIF probe & discovery    │
│    * /users/{uid}             │ │  - RTSP stream ingestion             │
│    * /elders/{elderId}        │ │  - FFmpeg HLS transcoding            │
│      ├── /contacts            │ │  - Runs on LAN or tunnel (ngrok)     │
│      ├── /metrics             │ └──────────────────────────────────────┘
│      ├── /medications         │
│      ├── /medicationLogs      │ ┌──────────────────────────────────────┐
│      ├── /devices             │ │  AI Copilot / Automation             │
│      ├── /safetyEvents        │ │                                      │
│      ├── /alerts              │ │  - Hosted n8n Workflow Webhook       │
│      ├── /reports             │ │  - AI Health Trend Summaries         │
│      └── /watches             │ └──────────────────────────────────────┘
└───────────────────────────────┘
```

---

## 2. Service Separation & Camera Service Boundary

### Why Camera Streaming Must Remain a Separate Edge Service
1. **Network Topology & Protocol Constraints**: IP Cameras (CP Plus, Dahua, Hikvision, Tapo) broadcast RTSP over raw TCP/UDP on local LAN subnets (`192.168.x.x` / `10.x.x.x`). Serverless platforms like Vercel and Cloud Functions cannot penetrate private home networks without dedicated VPN tunnels.
2. **Persistent Transcoding Execution**: FFmpeg transcodes RTSP streams into segmented HLS (`.m3u8` / `.ts` video segments) continuously. Serverless functions terminate on execution timeouts (10s–60s) and cannot sustain 24/7 FFmpeg child processes.
3. **Decoupled Boundary**:
   - Web application data (elders, metrics, watches, medications, care team, reports, alerts) is **100% serverless via Cloud Firestore**.
   - Camera video gateway runs on the user's local server (`server/index.ts` / port 5000) or via a secure tunnel URL configured via `VITE_CAMERA_API_URL`.

---

## 3. Smartwatch & Device Data Architecture

Smartwatch Bluetooth hardware integration is deferred. Previously, the client called `http://localhost:5000/api/watches`, which caused `ERR_CONNECTION_REFUSED` on Vercel deployments.

### Modernized Watch & Device Flow:
1. **Persistence**: Watches are stored directly in Firestore under `elders/{elderId}/watches/{watchId}` (with fallback to `localStorage` for offline/guest modes).
2. **Status Derivation**: Connection status (`connected`, `syncing`, `offline`) is dynamically derived on the client from `lastSeen` timestamps:
   - Within 5 minutes: `connected`
   - Within 30 minutes: `syncing`
   - Greater than 30 minutes: `offline`
3. **Diagnostics**: Web Bluetooth API is preserved exclusively as a browser diagnostic tool for service enumeration.
4. **Manual Health Entry**: Health metrics can be recorded manually through the dedicated form in `/health`.

---

## 4. Multi-Role Permissions & Data Access

| Role | Allowed Views | Accessible Data Scope |
|---|---|---|
| **Elder** | Dashboard, Health, Routine, Devices, Emergency, Care Team, Settings | Self only (`elderId == user.uid`) |
| **Caregiver** | Caregiver Dashboard, Multi-Elder Selector, Health, Routine, Live Monitor, Emergency | Only linked elders approved in `/relationships` |
| **Admin** | Admin Dashboard, System Monitoring, Audit Logs, Users, Residents, Device Registry | System-wide administrative access |

Firestore Security Rules enforce that non-admins can only read/write documents where `canAccessElder(elderId)` evaluates to true.

---

## 5. Deployment & Configuration

### Required Vercel Environment Variables:
```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-app.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
VITE_FIREBASE_ELDER_ID=demo-resident
VITE_N8N_WEBHOOK_URL=https://<your-subdomain>.app.n8n.cloud/webhook/vitalcare-ai
```

### Optional Camera Gateway Variable:
```env
VITE_CAMERA_API_URL=https://your-camera-tunnel.ngrok-free.app
```
*(Leave blank or omit if live RTSP cameras are not connected).*
