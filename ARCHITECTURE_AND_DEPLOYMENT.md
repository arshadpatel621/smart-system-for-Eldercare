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
VITE_CAMERA_API_URL=http://localhost:5000
# Or if hosted on remote server: https://your-camera-tunnel.ngrok-free.app
```
*(Leave blank or omit if live RTSP cameras are not connected).*

---

## 6. Camera Integration: Discovery, Security & Network Topology

### Dual Discovery Path
1. **Node.js Express Backend Discovery (`/api/cameras/discover`)**:
   - Sends ONVIF WS-Discovery probe via UDP multicast to `239.255.255.250:3702`.
   - Parses `XAddrs` in XML responses to identify both IP and actual ONVIF port (e.g. 80, 8899, 2020).
   - Validates reachability on RTSP ports (554, 8554).
2. **Local Python Camera Agent (`camera-agent/agent.py` on `http://127.0.0.1:8000`)**:
   - Provides auxiliary ONVIF discovery and camera diagnostics.
   - Frontend automatically falls back to the Node.js backend discovery if the Python agent is offline.

### Real-Time Person and Fall Detection
- VitalCare V2 runs locally with `camera-agent/models/yolo11n-pose.pt`, `tcn_transformer_10class_best.pth`, and `model_metadata.json`. It reads the existing Node.js MJPEG stream and does not open a second RTSP connection or use Roboflow.
- Set `INTERNAL_SERVICE_KEY` in `server/.env` (do not commit or expose it). The V2 agent reads that key locally and sends activity, person-update, fall, and liveness events to the existing authenticated `POST /api/events` endpoint. The backend forwards accepted events to dashboard WebSocket clients.
- Install the camera-agent dependencies with `camera-agent/setup_env.ps1`. Start each command in a separate PowerShell terminal from the repository root:

  ```powershell
  # Terminal 1: camera/API backend
  Set-Location D:\eldercare\eldercare\server
  npm run dev

  # Terminal 2: React dashboard
  Set-Location D:\eldercare\eldercare
  npm run dev

  # Terminal 3: local V2 inference for the registered living camera
  Set-Location D:\eldercare\eldercare
  .\camera-agent\.venv\Scripts\python.exe .\camera-agent\v2_inference.py --camera-id a54b71bd-1acc-44ae-9f1d-83304d4e6e5f --api-url http://localhost:5000
  ```

- Inference samples at 3 FPS by default, keeps an independent 16-frame pose history per tracked person, and publishes all ten class probabilities. Activity labels therefore begin only after the first 16 usable tracked poses (about 5.3 seconds at the default rate); a fall alert then requires three consecutive fall-class predictions with combined `FALL`/`FALLEN` probability of at least 0.75. Repeat alerts for the same track are subject to a 30-second cooldown. The agent selects CUDA when available and otherwise runs on CPU; `--device cpu` or `--device cuda:N` can override this. Alerts are advisory and require caregiver verification.
- MJPEG reading runs on its own thread and passes sampled frames through a one-frame latest-only buffer, so slow inference drops stale samples rather than building a backlog. The backend likewise holds only the latest pending frame for a slow HTTP client. The agent uses one OS-level lock per camera and logs measured camera FPS, inference FPS, CPU utilization/core-equivalents, inference latency, frame age, and dropped frames every 10 seconds. Tune with `--fps`, `--image-size`, and `--torch-threads`; these affect inference only, not the browser video stream.
- The camera video stream is independent of WebSocket availability. A websocket reconnect no longer reloads the MJPEG `<img>` stream; actual image errors retain their own retry.
- The unused Roboflow tracker and standard YOLO box-only detector have been removed. V2 uses YOLO11n-Pose plus the trained TCN-Transformer. The Live Monitor reports AI Detection ONLINE only while it receives a recent V2 liveness event (15-second freshness window).

### Credential Security Architecture
- **AES-256-CBC Encryption**: Camera passwords and custom RTSP URLs are encrypted before persistence in `server/data/cameras.json`.
- **Random Initialization Vector (IV)**: Every encryption generates a fresh 16-byte cryptographically secure random IV (`crypto.randomBytes(16)`), stored alongside the ciphertext in `iv:ciphertext` format.
- **Zero Credential Exposure**: Plaintext passwords never leave the backend. Controller endpoints and service serialization (`toPublic()`) strip `passwordEncrypted`, `rtspUrlEncrypted`, and plain passwords from all responses, logs, and WebSocket events.

### Bounded Exponential Reconnection
- If an RTSP stream disconnects unexpectedly, `scheduleReconnect` executes bounded backoff:
  - Attempt 1: 2s
  - Attempt 2: 4s
  - Attempt 3: 8s
  - Attempt 4: 16s
  - Attempt 5: 30s (capped at 30s)
  - Maximum retries: 5 attempts
- **Authentication Lockout Prevention**: If an authentication error (HTTP 401 or RTSP 401) is detected, reconnection immediately halts to prevent triggering IP-lockout mechanisms built into camera firmware.

### Hardware & Network Limitations (Cannot Be Solved Purely in Software)
1. **Wi-Fi Client / AP Isolation**:
   - Many enterprise routers and residential "Guest" Wi-Fi networks enable Client Isolation (AP Isolation), preventing Wi-Fi clients from communicating with each other.
   - **Resolution**: Ensure the computer running VitalCare and the IP cameras are connected to the main Wi-Fi network, or connect the server via an Ethernet cable to the same switch/router.
2. **Multicast Packet Drops / IGMP Snooping**:
   - ONVIF WS-Discovery relies on UDP multicast `239.255.255.250:3702`. Some mesh routers and managed switches drop multicast traffic across 2.4 GHz and 5 GHz bands.
   - **Resolution**: Use the "+ Add Camera Manually" flow to directly probe and connect to the camera's IP address.
3. **Cloud-Only / Remote Hosting**:
   - Cloud servers (e.g. Render, AWS EC2, Vercel) have no route into a private home network (`192.168.x.x` RFC 1918 addresses).
   - **Resolution**: Run the VitalCare Camera Server on a local machine (e.g. Raspberry Pi, mini-PC, or home computer) on the same LAN as the cameras, and point `VITE_CAMERA_API_URL` to it. Alternatively, configure a reverse tunnel (such as Cloudflare Tunnel or WireGuard VPN).
4. **Camera Firmware ONVIF Toggle**:
   - Modern cameras (such as CP Plus Ezykam, TP-Link Tapo, and EZVIZ) ship with ONVIF and RTSP disabled by default for consumer privacy.
   - **Resolution**: The user must enable "PC View" / "ONVIF" and set an ONVIF password in the camera's mobile application once prior to connecting.

---

## 7. Startup Commands Reference

### 1. Start the Camera Edge Backend (Port 5000):
```powershell
cd D:\eldercare\eldercare\server
npm run dev
```

### 2. Start the Frontend Application (Port 5173):
```powershell
cd D:\eldercare\eldercare
npm run dev
```

### 3. (Optional) Start the Local Edge AI Agent (Port 8000):
```powershell
cd D:\eldercare\eldercare\camera-agent
python agent.py
```
