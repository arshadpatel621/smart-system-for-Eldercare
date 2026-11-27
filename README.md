# VitalCare Professional — Elder Care Monitoring System

> **Safe, real-time elder-care monitoring.** React + Firebase frontend, a Node.js/Express + FFmpeg camera gateway, and a local Python V2 AI agent (YOLO11n-Pose + TCN-Transformer) for **live MJPEG video, reliable RTSP/ONVIF ingest, PTZ control, fall/activity detection**, plus an optional **n8n** health-AI workflow. This is a **local edge camera gateway + cloud app-data** system; it is **not** a serverless video service.

**Status:** active development; **not deployed to production yet.** Streaming reliability, PTZ, production DB path, and process supervision are implemented and tested (see [Current status](#current-status) / [Testing](#testing)). **No secrets are committed.**

---

## Table of contents
- [Overview](#overview) · [Implemented features](#implemented-features) · [Planned / not implemented](#planned--not-implemented)
- [Tech stack](#tech-stack) · [Architecture](#architecture) · [Folder structure](#folder-structure)
- [Installation & setup](#installation--setup) · [Run: frontend / backend / Camera Agent](#run-frontend--backend--python-camera-agent)
- [Environment variables](#environment-variables) · [Camera configuration (CP PLUS etc.)](#camera-configuration)
- [Streaming reliability notes](#streaming-reliability-notes) · [Testing](#testing) · [Troubleshooting](#troubleshooting)
- [Security](#security) · [Current status](#current-status) · [Future plans](#future-plans) · [License](#license)

---

## Overview

VitalCare Professional helps caregivers and families monitor elders: **live camera view** with **AI fall/person/activity insight**, **health vitals + smart-watch** data, **alerts/emergency**, **caregiver/elder roles**, **camera management + ONVIF discovery + PTZ**, **local recording**, and **optional AI health-insight summaries** via n8n. Multi-role access (Elder / Caregiver / Admin) is enforced by **Firebase Auth + Firestore rules**.

Two halves, on purpose:

- **App data** → **Firebase Firestore** + **Firebase Auth** (elders, caregivers, meds, routines, watches, reports, relationships).
- **Video + camera control** → **local edge `server/` (Node/Express + FFmpeg) on the LAN/next to cameras** (`server/data/cameras.json`, AES-256-CBC-encrypted credentials; `server/data/watches.json`). Cameras are **not** reachable from serverless cloud; run `server/` on an always-on machine on the camera network, expose it (`wss` + TLS + `ALLOWED_ORIGINS` + `VITE_CAMERA_API_URL`) for remote phone/laptop viewing.

---

## Implemented features

**Camera edge gateway (`server/`, `server/camera/`)** — preserved + hardened:
- Camera **CRUD** (`/api/cameras`), **enable/disable**, **test connection**, **`/health`**; **ONVIF WS-Discovery + `probeCamera`** (`/api/cameras/discover`, `/:id/test`, `/test`); **CP PLUS / Dahua / Hikvision / Tapo / EZVIZ / generic ONVIF / RTSP** brand profiles + RTSP-path resolution + `discoveredRtspPath`.
- **Reliable live MJPEG**: RTSP→FFmpeg→**`multipart/x-mixed-replace`** `GET /api/cameras/:id/stream`; **one FFmpeg per camera**; **multiple consumers**; **no duplicate/orphaned `ffmpeg`**; **latest-frame** backpressure; **`multipart` + `Content-Length`**; **stale-frame drop**; AI + dashboard + recorder share one stream.
- **RTSP-over-TCP + automatic RTSP-UDP fallback** (`-rtsp_transport`, `RTSP_TRANSPORT`; CP PLUS WiFi `minirtsp`); **HEVC/H.265 input**; **`-c:v mjpeg` output**; `fps=15`, `scale≤1280`, `q=5`, `-an`.
- **FFmpeg lifecycle + supervision**: `spawn` guard, `proc.on('error')`, `'error'` on stdio, **graceful SIGTERM→SIGKILL**, **`killAllStreams`**, `EADDRINUSE→exit`, **graceful shutdown** + signals, **`STREAM_STARTUP_TIMEOUT_MS`/`STREAM_STALL_TIMEOUT_MS` watchdog**, `checkStreamHealth`.
- **Automatic reconnection**: **bounded exponential backoff** + **`MAX_RECONNECT_ATTEMPTS`** + clear timer + stable reset + no zero-frame loop + no auth retry (no camera lockout).
- **Accurate `CameraStatus`**: `ONLINE/CONNECTING/ERROR/OFFLINE`, **`fps`**, **`lastFrameAt`**, **`reconnectAttempts`**, **`connectionTime`**, `resolution`, **meaningful `lastError`**, **WebSocket** push (`camera_statuses`, `camera_status_update`); no stderr progress noise; **no credentials in logs**.
- **ONVIF PTZ**: `POST /api/cameras/:id/ptz` (`left/right/up/down/zoom_in/zoom_out/home/stop`, `speed`); `ContinuousMove`/`Stop`/`GotoHomePosition`; **`Stop`-then-move**; **30s failsafe `Stop`**; **per-camera serialization**; **PTZ never kills/restarts FFmpeg**; `supportsPTZ` (CP PLUS/Dahua); capability flags honest. (ONVIF discovery + PasswordDigest preserved.)
- **Local recording**: shared-stream → **MP4** (`libx264`); start/stop; list/play/download; path-traversal guard; bounded buffer; `faststart`. **Snapshot** (`takeSnapshot`, reuses live frame).
- **`/api/events`** AI ingestion (`X-Internal-Secret`/`verifyInternalSecret`, timing-safe; sanitized `person_detection_update`, `activity_classified`, `v2_agent_status`, `fall_detected`, `inactivity_detected`, `person_detected`, `face_recognized`, `smoke_detected`, `intrusion_detected`); **`/api/cameras/:id/ai-consumer`** (`directRtspUrl` only `isInternal`).
- **WebSocket** dashboard + AI push; **CORS**; **graceful shutdown**.
- **Watch module** `/api/watches` (`JsonWatchRepository`, `server/data/watches.json`).
- **Production data path**: `server/data/cameras.json` resolved for **dev + `node dist`** (`CAMERAS_DB_PATH`/`VITALCARE_DATA_DIR`); **`server/data/cameras.example.json`**; runtime DB **not committed**; `firestore.rules`.
- **Production streaming knobs** (env; see [Environment variables](#environment-variables)).

**Python Camera Agent (`camera-agent/`)** — preserved + hardened:
- **V2 live inference `v2_inference.py`**: reads backend **MJPEG** (no second RTSP); **`LatestFrameBuffer(1)`**; **separate capture thread**; **bounded event dispatch** + retry; **`CameraLock`** single-instance; `INTERNAL_SERVICE_KEY`; `--fps/--confidence/--image-size/--torch-threads/--device/--annotated-*`; **not blocking video**; **not retraining/replacing model**.
- **AI model (unchanged): `YOLO11n-Pose` (`yolo11n-pose.pt`) + `VitalCareV2` TCN-Transformer (`tcn_transformer_10class_best.pth` + `model_metadata.json`)**; `load_v2_model`; **16-frame / 51-feature** pose sequences; **10 classes** `FALL/FALLEN/LIE_DOWN/LYING/OTHER/SIT_DOWN/SITTING/STAND_UP/STANDING/WALKING`; `FallEventGate`; `ByteTrack`; per-track temporal reset on reconnect; annotated stream; `v2_agent_status`/`person_detection_update`/`activity_classified`; `model:'VitalCare V2 TCN-Transformer'`, `poseModel:'YOLO11n-Pose'`.
- **ONVIF Local Camera Agent `agent.py`** `127.0.0.1:8000`: `/health`, `/discover`, `/detect`, `/probe`; `discovery.py`; **credential redaction**; `CameraLock`.
- **Model weights NOT committed.**

**Frontend (`src/`, React 18 + Vite + TS + Tailwind):**
- **`CameraPlayer`** live MJPEG `<img>`, **accurate status** `CONNECTING/ONLINE/ERROR/OFFLINE`, `fps`, `lastFrameAt`, `reconnectAttempts`, `lastError`, auto-reconnect, `onError` retry, **PTZ** D-pad/zoom/home/stop, **recording**, **snapshot** (gated `supportsSnapshot`), **AI overlays** (keypoints/boxes/fall), **`AI DETECTION OFFLINE`** fallback; **`CameraStatus` `lastFrameAt`.**
- **Camera Management** (`CameraManagement`), `AddDeviceWizard`, ONVIF discovery, `useCamera`, `useCameraManager`, `src/services/camera.ts`.
- **App**: role dashboards (`Elder`/`Caregiver`/`Admin`), `LiveMonitor`, `CaregiverLiveMonitor`, `ElderLiveMonitor`, **HealthMonitor**, **WatchManagement** + `useWatchManager`, **EmergencyCenter**, **Notifications**, **AIInsights** (`aiService` n8n + `aiReportService` Firestore + `n8n`), **CareTeam**, **routines**, **medication**, **protected routes** + **`access`**. **Firebase** (`firebase.ts`, `eldercareStore`, `userStore`, `AuthContext`, `EldercareContext`).

**n8n** `n8n/VitalCare-AI-Elder-Care-Monitoring.json` + guides; `VITE_N8N_WEBHOOK_URL`; **Groq** LLM; **planned/AI-workflow**, not required for streaming.

---

## Planned / not implemented

- **Production deployment** not done.
- **`schedulePreset` / `moveCameraPreset`**, **motion tracking**, **night vision**, **talk**, **presets**: frontend calls exist but **backend routes not registered** + `supportsPresets/supportsTracking/supportsNightVision/supportsTalk=false`. **`/api/cameras/:id/snapshot` route not registered** (`takeSnapshot` service only; `supportsSnapshot=false`); **`supportsSnapshot=false`.**
- **HLS** is **not** used (docs mention it; implementation is **MJPEG**).
- **`mock`/`0.0.0.0`** camera (`lavfi testsrc`) + `mock` PTZ reject — **dev/test only, not real hardware; no mock data hides errors.**
- **V2 annotated MJPEG** optional; **GPU** optional (`--device cuda`, else CPU).
- WiFi-camera movement can't be fully prevented; **wired camera recommended**.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | **React 18 + Vite 5 + TypeScript + Tailwind CSS** (`react-router-dom`) |
| Backend | **Node.js 20 + Express 4 + TypeScript**; `ws`; `cors`; `dotenv`; `@ffmpeg-installer/ffmpeg` (**bundled FFmpeg 4.1**, `-stimeout`) |
| Video | **FFmpeg RTSP→MJPEG**, HEVC/H.264 in, `mjpeg` out; **MP4 `libx264`**; **RTSP TCP/UDP**; **ONVIF SOAP WS-Security**; **AES-256-CBC** |
| AI (local) | **Python 3.11–3.13**; **`ultralytics` + `torch` + `torchvision` + `opencv-python` + `numpy` + `Pillow` + `requests` + `PyYAML` + `portalocker`**; **YOLO11n-Pose + TCN-Transformer (`VitalCareV2`)**; `ByteTrack`; `cv2`; `portalocker` |
| App data | **Firebase Auth + Firestore**; **Firebase Hosting** (optional); `firestore.rules`; `firebase-tools`; `@firebase/rules-unit-testing` |
| AI workflow | **n8n + Groq** (`llama-3.3-70b-versatile`); `n8n/VitalCare-AI-Elder-Care-Monitoring.json` |
| Tests | **`node --test`** backend (`server/test`); **Firestore rules** (`tests`, Firebase emulator); **`pytest`** `camera-agent`; **`scratch/verify_e2e.mjs`**; **`build`** |
| Smartwatch | `camera-agent`-style `watch` module; **BLE diagnostic** frontend; Firestore-backed `watches` |

**Camera ports:** RTSP `port` (default `554`, **CP PLUS `5543`**); **ONVIF `onvifPort`** (`80`, **CP PLUS `8899`**, **CP PLUS WiFi `8000`**); **Local Camera Agent `127.0.0.1:8000`**; **backend `5000`**; **frontend `5173`**.

---

## Architecture

```
                    ┌─────────────────────────────────────────────────────────────┐
                    │                      Viewers (React)                        │
 Phone / Laptop ──► │  CameraPlayer + useCamera                                   │
 (any network,      │  • <img src=/api/cameras/:id/stream>  (multipart MJPEG)     │
  wss + TLS +       │  • WebSocket camera_status_update + ai_alert                │
  CORS to host)     │  • PTZ  POST /api/cameras/:id/ptz                           │
                    └───────────────┬─────────────────────────────────────────────┘
                                    │  VITE_CAMERA_API_URL / VITE_API_URL (http→ws / https→wss)
                    ┌───────────────▼─────────────────────────────────────────────┐
                    │  Edge backend  server/  (Node 20 + Express + ws, port 5000) │
                    │  CameraService                                              │
                    │  • ONE FFmpeg per camera  -rtsp_transport tcp + UDP fallback │
                    │  • RTSP(HEVC/H264) → -c:v mjpeg image2pipe → MjpegFrameParser│
                    │  • per-consumer LatestFrameWriter (latest-only backpressure) │
                    │  • checkStreamHealth + bounded reconnect + killAllStreams    │
                    │  • shared MP4 recording + snapshot + probe + ONVIF discovery │
                    │  • ONVIF PTZ (serialized; never kills FFmpeg)                │
                    │  • /api/events (X-Internal-Secret) + WS broadcast            │
                    │  • server/data/cameras.json (AES-256-CBC; prod DB path)      │
                    └───────┬───────────────────────────┬─────────────────────────┘
              RTSP tcp/udp  │ onvifPort                  │ shared MJPEG /ai-consumer + X-Internal-Secret
       ┌────────────────────▼───────────┐     ┌──────────▼──────────────────────────────────────┐
       │  IP CAMERA (CP PLUS / ONVIF)   │     │ Python camera-agent/  (local, V2; not blocking) │
       │  RTSP port 5543 / ONVIF 8000   │     │  v2_inference.py  (NO 2nd RTSP)                  │
       │  HEVC 2560x1440@20 + PCMA;     │     │  YOLO11n-Pose + TCN-Transformer (VitalCareV2)    │
       │  ONVIF PTZ; minirtsp (WiFi)    │     │  LatestFrameBuffer(1) + bounded event dispatch   │
       └────────────────────────────────┘     │  → POST /api/events → WS dashboard + AI         │
                                               │  ONVIF agent :8000 (discover/detect)            │
                                               └─────────────────────────────────────────────────┘

App data (separate from video): React → Firebase Auth/Firestore ↔ server /api/watches + n8n /api/events → AI (n8n/Groq)
```

**Streaming path:** `Camera → RTSP → FFmpeg (one/camera) → raw MJPEG → MjpegFrameParser → per-consumer LatestFrameWriter → multipart MJPEG → React <img> + Python V2 + MP4`. **`CameraService` is independent of AI; AI reads `/stream`, never controls camera.**

---

## Folder structure

```
.                                   repo root (VitalCare; npm workspace-less; app name eldercare-app)
├─ src/                             React + Vite + TS frontend
│  ├─ pages/  components/  hooks/  services/  context/  lib/  types/  config/  main.tsx  App.tsx
│  ├─ services/camera.ts            camera API + CameraStatus(lastFrameAt,...)
│  ├─ components/CameraPlayer.tsx   live + PTZ + recording + AI overlays
│  └─ pages/{CameraManagement,LiveMonitor,HealthMonitor,...}.tsx
├─ server/                          Node.js + Express + TS edge gateway (port 5000)
│  ├─ index.ts                      Express + WebSocket + /api/events + /health + graceful shutdown + EADDRINUSE
│  ├─ camera/
│  │  ├─ camera.service.ts          CameraService: FFmpeg lifecycle, MJPEG, reconnect, stall, PTZ, recording, snapshot
│  │  ├─ camera.repository.ts       JsonCameraRepository (AES-256-CBC; prod DB_PATH -> server/data)
│  │  ├─ camera.crypto.ts           AES-256-CBC + verifyInternalSecret + verifyEncryptionConfig
│  │  ├─ camera.probe.ts            port scan + ONVIF + RTSP probe (TCP->UDP); parseFfmpegStderr
│  │  ├─ camera.discovery.ts        LAN ONVIF WS-Discovery
│  │  ├─ camera.onvif.ptz.ts        ONVIF PTZ discover + SOAP ContinuousMove/Stop/GotoHome (PasswordDigest)
│  │  ├─ camera.controller.ts  camera.routes.ts  camera.types.ts  brand.profiles.ts
│  ├─ watch/                        smart-watch module + repository
│  ├─ test/  camera.test.ts  streaming.reliability.test.ts
│  ├─ data/  cameras.example.json  cameras.json(runtime, NOT committed)  watches.json  recordings/  snapshots/
│  ├─ package.json  tsconfig.json  .env(.example; NOT committed)
├─ camera-agent/                    local Python Camera Agent + V2 AI
│  ├─ agent.py  discovery.py  camera_lock.py                 ONVIF Local Camera Agent :8000 + single-instance
│  ├─ v2_inference.py  v2_model.py                            V2 MJPEG + YOLO + TCN-Transformer
│  ├─ fall_analysis.py  pose_fall_detector.py                 fall analysis (preserved)
│  ├─ models/  yolo11n-pose.pt + tcn_transformer_10class_best.pth + model_metadata.json  (weights NOT committed)
│  ├─ requirements.txt  setup_env.ps1  test_*.py  .venv/.venv-v2(NOT committed)  .env(NOT committed)
├─ n8n/  VitalCare-AI-Elder-Care-Monitoring.json + guides     n8n AI workflow
├─ tests/  firestore.rules.test.mjs                           Firestore rules (emulator)
├─ scratch/  verify_e2e.mjs  test_mock_camera.py              verification helpers
├─ docs/  firebase.json  firestore.rules  .env.example  package*.json  vite/tailwind/tsconfig  *.md  .gitignore
```

---

## Installation & setup

**Prerequisites:** **Node.js 20+**, **npm**, **Python 3.11–3.13** (Camera Agent; `py -3.11`/`py -3.12`/`py -3.13`), **FFmpeg** (bundled `@ffmpeg-installer/ffmpeg`; no system install needed), **Git**, **Firebase** project (Auth + Firestore), optional **n8n + Groq**, a camera (CP PLUS/ONVIF/RTSP).

```bash
git clone <repo-url>
cd <repo>/                         # repo root (VitalCare; `eldercare-app`)

# ── Frontend ──
npm install
cp .env.example .env               # then fill VITE_* (NO secrets committed)

# ── Backend (edge gateway) ──
npm install --prefix server
# server/.env: PORT=5000 ENCRYPTION_KEY=<32+char-secret> INTERNAL_SERVICE_KEY=<secret>
#   ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174 ; RTSP_TRANSPORT=udp ; API_BASE_URL=...
# server/data/cameras.json (runtime; NOT committed) or server/data/cameras.example.json ; CAMERAS_DB_PATH=
npm run build --prefix server

# ── Python Camera Agent (V2) ──
# camera-agent/setup_env.ps1  (Windows; creates .venv; Python 3.11-3.13)
#   pip install -r camera-agent/requirements.txt
#   model weights already in camera-agent/models/  (NOT committed; not downloaded here)
#   INTERNAL_SERVICE_KEY must match server/.env
```

**Firebase:** create project; enable **Auth** + **Firestore**; `firebase login`; `firebase use <project>`; deploy rules `firebase deploy --only firestore:rules`. Copy `.env.example`. See `FIREBASE_SETUP.md`, `firebase.json`, `firestore.rules`.

**n8n (optional):** import `n8n/VitalCare-AI-Elder-Care-Monitoring.json`; attach **Groq**; activate; set `VITE_N8N_WEBHOOK_URL`. See `n8n/README.md`, `N8N_*`.

---

## Run frontend / backend / Python Camera Agent

**Three processes.** Backend **first**. (PowerShell shown; same commands on bash.)

```powershell
# 1) Backend — edge camera gateway (port 5000)
npm run dev --prefix server                 # dev (ts-node-dev); reads server/data/cameras.json
# production:
npm run build --prefix server; npm start --prefix server    # node dist/index.js; reads server/data (prod DB path)

# 2) Frontend (port 5173)
npm run dev                                 # vite; VITE_CAMERA_API_URL=http://localhost:5000

# 3) Python Camera Agent — V2 AI (local; optional; not required for MJPEG)
#   .\camera-agent\setup_env.ps1 ; .\camera-agent\.venv\Scripts\Activate.ps1
python camera-agent/v2_inference.py `
  --camera-id CAM_ID --api-url http://localhost:5000 `
  --pose-model camera-agent/models/yolo11n-pose.pt `
  --fps 3 --torch-threads 2 --confidence 0.4 --image-size 320 `
  --fall-threshold 0.75 --fall-confirmation-frames 3 --fall-cooldown 30 `
  --device auto                              # auto|cpu|cuda|cuda:N ; --annotated-port 0
# stream source resolved from /api/cameras/:id/ai-consumer (+ X-Internal-Secret for internal)
# 4) Python ONVIF Local Camera Agent (optional discovery; port 8000)
python camera-agent/agent.py               # 127.0.0.1:8000  /health /discover /detect
```

**`INTERNAL_SERVICE_KEY`** must match `server/.env` for `/api/events` + `ai-consumer`.

---

## Environment variables

**Never commit `.env` / `server/.env` / `camera-agent/.env`.** No secrets in this README.

**Frontend (`.env`; `VITE_*`; placeholders in `.env.example`):**
```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
VITE_FIREBASE_ELDER_ID=demo-resident
VITE_CAMERA_API_URL=http://localhost:5000      # backend base; NOT localhost for remote; https->wss
VITE_API_URL=http://localhost:5000             # fallback for camera API
VITE_N8N_WEBHOOK_URL=https://<your-n8n>.app.n8n.cloud/webhook/vitalcare-ai
```

**Backend (`server/.env`):**
```env
PORT=5000
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174   # + remote origins; localhost always allowed
ENCRYPTION_KEY=<unique-32+-char-secret>        # REQUIRED prod; AES-256-CBC key; default dev key warns
INTERNAL_SERVICE_KEY=<secret-for-python-v2>    # REQUIRED prod; /api/events + ai-consumer; timing-safe
API_BASE_URL=http://localhost:5000             # advertised base for AI stream URLs
# production data path (optional)
CAMERAS_DB_PATH=                               # else server/data/cameras.json (dev+prod)
VITALCARE_DATA_DIR=                            # else server/data
# streaming reliability (optional; safe defaults)
RTSP_TRANSPORT=tcp                             # tcp|udp|udp_multicast|http; UDP auto-fallback; CP PLUS WiFi -> udp
RTSP_SOCKET_TIMEOUT_US=15000000
RTSP_TCP_FALLBACK_MS=12000
STREAM_OUTPUT_FPS=15
STREAM_MAX_WIDTH=1280
STREAM_JPEG_QUALITY=5
STREAM_THREADS=2
STREAM_STARTUP_TIMEOUT_MS=30000
STREAM_STALL_TIMEOUT_MS=12000
STREAM_FPS_IDLE_MS=2000
STREAM_HEALTH_CHECK_INTERVAL_MS=5000
STREAM_MAX_DELAY_US=500000
STREAM_ANALYZE_DURATION_US=4000000
STREAM_PROBE_SIZE=2000000
RECONNECT_INITIAL_DELAY_MS=2000
RECONNECT_MAX_DELAY_MS=30000
MAX_RECONNECT_ATTEMPTS=5
RECONNECT_STABLE_RESET_MS=60000
FFMPEG_KILL_GRACE_MS=1500
```

**Python Camera Agent (`camera-agent/.env` + reads `server/.env`/root for `INTERNAL_SERVICE_KEY`):**
```env
INTERNAL_SERVICE_KEY=<matches-server>
# args instead of env: --api-url --camera-id --stream-url --fps --torch-threads --device ...
```

---

## Camera configuration

- Add camera in **Camera Management**; **brand** `cpplus` (CP PLUS), `dahua`, `hikvision`, `tplink_tapo`, `ezviz`, `onvif`, `rtsp`.
- **CP PLUS:** `ipAddress`, **RTSP `port=5543`** (or `554`), **`onvifPort` `8899`/`8000`/`80`**, `username`, `password`, optional `customRtspPath`, `discoveredRtspPath`. CP PLUS WiFi model `CP_Plus_Wi-Fi_camera`, `minirtsp`. **HEVC/H.265 `2560x1440@20` + `pcm_alaw` supported; audio discarded.**
- **Test Connection** runs `probeCamera` (port scan + **ONVIF** + **RTSP TCP→UDP**, `rtspAvailable`, `discoveredRtspPath`, `resolution/fps`, `authError`, `timeout`, `networkUnreachable`, `errorMessage`).
- **ONVIF discovery** `GET /api/cameras/discover` + local `camera-agent` `:8000/discover`.
- **RTSP transport:** default `tcp` + **auto UDP fallback**; `RTSP_TRANSPORT=udp`. CP PLUS WiFi camera **that accepts TCP+SDP but no RTP-over-TCP needs UDP**; **RTSP control always TCP.**
- **Credentials:** encrypted **AES-256-CBC** (`passwordEncrypted`, `rtspUrlEncrypted`); **never returned** (`toPublic`); **`ENCRYPTION_KEY`** in env (not repo); **not logged**; `directRtspUrl` only to authenticated internal agent. **`server/data/cameras.json` runtime, NOT committed.**
- **PTZ:** ONVIF `ptzServiceUrl`; `profileToken`; `speed 1–10`; `Stop`; CP PLUS PTZ model required + `onvifPort`.

---

## Streaming reliability notes

`CameraService` uses **one FFmpeg per camera** with `-nostdin -hide_banner -rtsp_transport <tcp|udp> -stimeout -avoid_negative_ts make_zero -fflags +genpts -max_delay -reorder_queue_size -probesize -analyzeduration -map 0:v:0 -c:v mjpeg -an -vf fps=15,scale=w='min(1280,iw)':h=-2 -threads:v -f image2pipe -q:v pipe:1`.

- **No `+nobuffer`/`+discardcorrupt`/`+low_delay`.** **TCP + auto UDP fallback.** **HEVC input.** **MJPEG output.** **Audio off.**
- **Small reorder buffer**, not a large latency queue. **`fps` cap + downscale.** **Latest-only** per consumer; **no stale replay**; **slow viewer / AI can't stall video.**
- **Stall/startup watchdog + bounded exponential reconnect + `MAX_RECONNECT_ATTEMPTS`.** **No duplicate/orphan `ffmpeg`.** **Graceful kill + `killAllStreams`.**
- **PTZ isolated + serialized.** **AI independent.** **Accurate `CameraStatus`.** **No credential leakage.**

**Network advice:** `CP_Plus_Wi-Fi_camera` is **Wi-Fi**; **moving it / weak signal drops RTSP/ONVIF** (measured `192.168.29.156` unreachable after move). **Wired Ethernet, don't move, same LAN, strong signal, `RTSP_TRANSPORT=udp`, lower `STREAM_OUTPUT_FPS/STREAM_MAX_WIDTH`, `STREAM_MAX_DELAY_US`.** **Remote phone/laptop on another network requires `wss` + TLS + reachable backend + `ALLOWED_ORIGINS` + `VITE_CAMERA_API_URL` (not `localhost`); can't guarantee zero interruption on lossy public internet.**

---

## Testing

```powershell
npm test --prefix server                 # tsc + node --test dist/test/  → 45/45 (Phase-1 incl. streaming.reliability +16 + camera)
npm run build --prefix server            # tsc
npm run build                            # tsc + vite build
npm run lint                             # eslint
# Firestore rules (Firebase emulator + Java):
npm run test:firestore-rules             # firebase emulators:exec --only firestore ... node --test tests/firestore.rules.test.mjs
# Python:
#   pytest camera-agent -q               (test_v2_inference, test_fall_analysis, test_single_instance, ...)
# End-to-end verification (real Express + WS + temp DB + mock camera; no hardware):
npm run build --prefix server; node scratch/verify_e2e.mjs
```

**Verified (this repo, real CP PLUS when reachable):** backend **45/45**; frontend build; tsc; `probeCamera rtspAvailable=true 2560x1440@20`; **RTSP-TCP→UDP fallback**; **ONLINE ~15 FPS 1280x720 `outputFps=15` `frameAgeMs~120` `invalidJpegFrames=0`**; **one FFmpeg**; **multi-consumer**; **bounded reconnect**; **ONVIF PTZ 200 + Stop**; **WS**; **no secret leak**. **`npm run dev` + `npm start` production DB path.** **Firestore rules tests** included.

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `CONNECTING` / `0 FPS` / `AI OFFLINE` | stream not producing; check camera reachable `ping`, `port 5543`/`8000`, **`RTSP_TRANSPORT=udp`** (CP PLUS WiFi no RTP-over-TCP), `discoveredRtspPath`, `Test Connection`, `status.lastFrameAt`/`error`. |
| `ERR_CONNECTION_REFUSED` `localhost:5000` | **backend not running** / `EADDRINUSE`; start `npm run dev --prefix server` **first**; kill duplicate `node`+`ffmpeg`. |
| `EADDRINUSE :::5000` | duplicate server; my server `process.exit(1)`; kill extra; `PORT`. |
| `ERR_CONNECTION_RESET` `/stream` | stream reset + WiFi; my reconnect; check `status`. |
| `403` | **CORS** (`ALLOWED_ORIGINS`) / **Firebase** / `dotfiles deny` recordings; `/api/events`=`401`. Not `res.status(403)`. |
| `AI OFFLINE` / no `person_detection_update` | stream unstable (fixed) OR V2 not running / `INTERNAL_SERVICE_KEY` mismatch / `MJPEG stalled`. |
| PTZ `502` `ONVIF ... timed out` | `onvifPort` `8000`, `Stop`-then-move, 4s SOAP; **camera must have ONVIF PTZ**; not a stream bug; **PTZ never kills FFmpeg**. |
| gray screen / stale frames | no frames / `fps=0`; latest-only drops stale; check `lastFrameAt`. |
| lagging / buffering / unstable FPS | reliable profile + `fps=15`+scale + latest-only + `RTSP_TRANSPORT=udp` + wired + lower `STREAM_OUTPUT_FPS`. |
| `npm run dev` vs `npm start` data | dev `server/camera→server/data`; **prod `node dist→server/data` (fixed `resolveDbPath`)**; `CAMERAS_DB_PATH`. |
| `dist`/`node_modules`/`.env`/`cameras.json` committed | `.gitignore`; runtime `server/data/cameras.json` **not** tracked. |

---

## Security

- **No secrets committed.** `.env`, `server/.env`, `camera-agent/.env`, `ENCRYPTION_KEY`, `INTERNAL_SERVICE_KEY`, Groq key, Firebase secrets, camera passwords **not** in git. `.env.example` placeholders. `.gitignore`.
- **Camera credentials AES-256-CBC at rest**; **not returned**; **not logged**; `rtsp://***@`; `redactStderr`; `toPublic`; `directRtspUrl` only `isInternal`. `server/data/cameras.json` **runtime, NOT committed.**
- **`/api/events` + `ai-consumer`** `X-Internal-Secret`/`Authorization` + `verifyInternalSecret` (timing-safe). **ONVIF** WS-Security `PasswordDigest`; `serviceAddress` host-pin; `escapeXml`. **CORS** allowlist. **Firestore rules.** **Path-traversal guard** recordings.
- **No model weights committed.** **No mock data hiding errors.** **`EADDRINUSE`/orphan-FFmpeg protection.**

---

## Current status

**Phase-1 camera streaming reliability implemented + verified; pushed to `origin/camera`.**

- `feat(camera)` reliable RTSP/FFmpeg + bounded reconnect + production DB path; `feat(camera-ui)`; `feat(ai)` V2; `feat(auth)`; `docs(config)`; `test`; + `docs` audit.
- `npm test --prefix server` **45/45**; `npm run build`; **`npm run dev` + `npm start`**; **real CP PLUS `CP_Plus_Wi-Fi_camera` ONLINE ~15 FPS + ONVIF PTZ.**
- **`server/data/cameras.json` intact on disk, NOT committed.** **No secrets/model-weights/runtime.**

**Deployment status: NOT deployed.** Frontend build + `dist` exist but not published; edge `server/` must run on LAN; Firebase/n8n configured separately.

---

## Future plans

- Production `wss` + TLS + tunnel + `ALLOWED_ORIGINS` for remote phone/laptop.
- Register `/snapshot`, `/preset`, `/tracking`, `/nightvision`, `/talk`; enable `supportsSnapshot/Presets/Tracking/NightVision/Talk`.
- Optional lower-latency mode (`+nobuffer`) toggle; adaptive `fps`/`width`; `+discardcorrupt` policy.
- Replace JSON `server/data` with Postgres/secret manager (repo interface ready); key rotation.
- GPU V2; event retention; Firestore AI reports; hardware watchdogs.
- Full production deployment + CI.

---

## License

MIT (see `LICENSE` if present).
