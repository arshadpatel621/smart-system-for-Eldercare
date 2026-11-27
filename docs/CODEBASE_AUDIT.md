# VitalCare - Codebase Audit Report

**Project path:** `D:\eldercare\eldercare`
**Audit type:** Read-only (no files modified, no dependencies installed, no destructive commands)
**Generated as:** Phase 1 deliverable (`docs/CODEBASE_AUDIT.md`)

> **Historical snapshot:** This initial audit predates the V2 migration and model cleanup. Its Roboflow/YOLO usage claims below are superseded by the current architecture in `ARCHITECTURE_AND_DEPLOYMENT.md`: V2 uses YOLO11n-Pose and the TCN-Transformer; the legacy Roboflow and standard YOLO box-only paths have been removed.

---

## 1. Current Architecture

### 1.1 High-level runtime

```
Browser (React 18 + Vite + TS)
  -> Firebase Auth + Firestore (identity, eldercare data, AI reports)
  -> n8n webhook (VITE_N8N_WEBHOOK_URL) for AI insights
  -> HTTP/WS to Node gateway (VITE_CAMERA_API_URL / VITE_API_URL)
        |
        v
Node.js Express gateway (server/)
  -> /api/cameras/*  (camera CRUD, probe, discovery, stream MJPEG, PTZ, recordings)
  -> /api/watches/*  (smart-watch CRUD, BLE test results, health data)
  -> /api/events     (AI event receiver, X-Internal-Secret gated)
  -> /health
  -> WebSocket (camera status broadcast + AI alert push)
        | FFmpeg (RTSP -> MJPEG)
        v
IP Cameras (RTSP/ONVIF)
        |
        v
Python camera-agent (person_tracker.py)
  -> consumes Node MJPEG stream
  -> Roboflow hosted model "fall-detection-real/1"
  -> ByteTrack IDs (supervision)
  -> POST /api/events (X-Internal-Secret)
```
### 1.2 Major modules

| Module | Location | Status |
|---|---|---|
| Frontend SPA | `src/` | ACTIVE |
| Auth context | `src/context/AuthContext.tsx`, `src/lib/userStore.ts` | ACTIVE |
| Eldercare data store | `src/lib/eldercareStore.ts` | ACTIVE |
| Camera API client | `src/services/camera.ts` | ACTIVE |
| AI service | `src/services/aiService.ts`, `src/services/aiReportService.ts` | ACTIVE |
| Backend gateway | `server/index.ts` | ACTIVE |
| Camera module | `server/camera/*` | ACTIVE (most tested) |
| Watch module | `server/watch/*` | ACTIVE |
| Camera agent (discovery/probe) | `camera-agent/agent.py`, `discovery.py` | ACTIVE |
| Fall-cue monitor (YOLO box heuristic) | `camera-agent/fall_detector.py` | EXPERIMENTAL |
| Pose fall-cue monitor | `camera-agent/pose_fall_detector.py` | EXPERIMENTAL |
| Temporal fall analysis | `camera-agent/fall_analysis.py` | EXPERIMENTAL/REQUIRED LATER |
| Roboflow tracker + event dispatch | `camera-agent/person_tracker.py` | ACTIVE AI PATH |
| YOLO weights | `yolo11n.pt`, `camera-agent/models/yolo11n.pt` | ACTIVE (experimental scripts) |
| n8n workflow | `n8n/VitalCare-AI-Elder-Care-Monitoring.json` | ACTIVE (external) |

---

## 2. File and Module Inventory (top-level, excluding generated dirs)

Source files counted: ~186 (excluding `node_modules`, `.venv`, `__pycache__`, `.git`, `dist`).

Key directories:

- `src/` (90 files): `components/`, `pages/` (admin/caregiver/elder + shared), `context/`, `hooks/`, `lib/`, `services/`, `types/`.
- `server/` (42 files): `camera/` (12), `watch/` (5), `test/` (1), `data/` (JSON DB + recordings).
- `camera-agent/`: `agent.py`, `discovery.py`, `fall_detector.py`, `person_tracker.py`, `pose_fall_detector.py`, `fall_analysis.py`, tests, `requirements.txt`, `.env`.
- Root: config files, docs, mockups, n8n workflow, `yolo11n.pt`.

---

## 3. Dependency Relationships

### 3.1 Frontend

- Entry: `src/main.tsx` -> `AuthProvider` -> `EldercareProvider` -> `App` (lazy routes).
- Data: `src/lib/eldercareStore.ts` (Firestore CRUD) used by `EldercareContext`.
- Camera/Watch state: `useCameraManager`, `useWatchManager` (local useState + fetch).
- AI: `aiService.ts` (n8n), `aiReportService.ts` (Firestore AIReports).

### 3.2 Backend

- Entry: `server/index.ts` wires Express, WS, camera + watch modules, `/api/events`, `/health`.
- Camera module: `camera.routes.ts` -> `CameraController` -> `CameraService` -> `JsonCameraRepository` + `camera.crypto`, `camera.probe`, `camera.discovery`, `brand.profiles`, `camera.onvif.ptz`.
- Watch module mirrors camera module structure.
- Tests: `server/test/camera.test.ts` imports service internals and runs with node:test.

### 3.3 Python agent

- `agent.py` (HTTP server) imports `discovery.py` (`discover_cameras`, `probe_camera_detailed`, `sanitize_uri`).
- `person_tracker.py` is standalone CLI; imports `requests`, `cv2`, `supervision`, `numpy` (Roboflow via HTTP, not local YOLO).
- `fall_detector.py`, `pose_fall_detector.py` are standalone CLIs using local `ultralytics` YOLO.
- `fall_analysis.py` is a library used by `test_fall_analysis.py`.

---

## 4. Active AI Models

| Model/Algorithm | Location | Framework | Purpose | Actual usage |
|---|---|---|---|---|
| YOLO11n (`yolo11n.pt`) | root + `camera-agent/models/` | Ultralytics/PyTorch | Person detection | Used by experimental scripts `fall_detector.py`, `pose_fall_detector.py` only |
| Roboflow `fall-detection-real/1` | Hosted API | Roboflow | Fall classes (standing/falling/fallen) | Used by `person_tracker.py` (active AI path) |
| ByteTrack | `supervision` | Python | Person tracking | `person_tracker.py` |
| Pose keypoints | YOLO pose (optional `--model`) | Ultralytics | Torso angle | `pose_fall_detector.py`, `fall_analysis.py` (experimental) |
| n8n AI workflow | `n8n/*.json` | n8n | Health insights | Frontend via webhook |

### 4.1 YOLO11 usage (important)

- YOLO11 **is present and used** by experimental local scripts (`fall_detector.py`, `pose_fall_detector.py`) for person detection.
- It is **not** used by the active event-dispatch path (`person_tracker.py`), which uses the hosted Roboflow model.
- `yolo11n.pt` is gitignored (`*.pt`, `camera-agent/models/*.pt`) but present on disk (5.6MB).
- **Decision:** Preserve YOLO11; do not remove/replace without justification.

---
## 5. Duplicate Implementations

1. **Fall detection (4 scripts):**
   - `fall_detector.py` - bounding-box aspect ratio + vertical position heuristic.
   - `pose_fall_detector.py` - YOLO pose + sudden drop + horizontal torso.
   - `person_tracker.py` - Roboflow + ByteTrack + temporal confirmation (active).
   - `fall_analysis.py` - reusable `PersonFallAnalyzer` (temporal state machine).
   Overlap and inconsistent thresholds; only `person_tracker.py` dispatches events.

2. **Type definitions duplicated:** `CameraBrand`, `CameraLocation`, etc. in both `src/services/camera.ts` and `server/camera/camera.types.ts`.

3. **Device management overlap:** `DeviceManagement.tsx` embeds camera + watch management; `CameraManagement.tsx` separate page.

4. **Camera Management UI:** `useCamera.ts` (single-camera live monitor) vs `useCameraManager.ts` (CRUD) - separate concerns but naming overlap.

---

## 6. Unused / Potentially Unused Components

Verified/likely unused or dead:

- Frontend `src/services/camera.ts` calls endpoints not registered in `server/camera/camera.routes.ts`: `/preset`, `/tracking`, `/nightvision`, `/talk`, `/snapshot` -> runtime 404s (dead client code unless implemented elsewhere).
- `src/lib/mockData.ts` used only for demo data seeding in `eldercareStore.ts` (demo path).
- `scratch/test_mock_camera.py` stray test script.
- `mockups/` (HTML/PNG) not part of runtime.
- `docs/AI_Powered_...docx` binary doc.
- `server/data/recordings/*.mp4`, snapshots - runtime artifacts in working tree.
- Root `yolo11n.pt` duplicate of `camera-agent/models/yolo11n.pt`.

**Not removable without verification:** dynamic imports in `App.tsx` (lazy routes) - all pages referenced; any page could be considered "used" via routing. `camera-agent` scripts are CLI entry points (not imported) but intended for manual execution.

---

## 7. Experimental Code Mixed into Production Modules

- `fall_detector.py`, `pose_fall_detector.py` are research scripts but live alongside production `agent.py`, `discovery.py`, `person_tracker.py`.
- `test_*.py`, `test_*.jpg`, `test_frame.jpg`, `norman.mp4`, `fall_detection.mp4` in `camera-agent/` root.
- `verify_phase2_integration.mjs` in `camera-agent/`.

---

## 8. Potential Risks

1. **Secrets in working tree:** `.env` (Firebase), `server/.env` (encryption/internal keys with defaults), `camera-agent/.env` (Roboflow key). `.gitignore` ignores `.env`, but files exist on disk and may have been shared.
2. **Client-side privilege escalation:** `AuthContext.enableGuestMode('admin')` creates synthetic admin profile in localStorage.
3. **Firestore rules BOLA:** `canAccessElder` includes `request.resource.data.id == elderId` on read paths.
4. **Insecure crypto default:** `camera.crypto.ts` falls back to a known dev key if env missing.
5. **Weak internal secret default:** `vitalcare-internal-ai-service-token-32c!`.
6. **No auth middleware on camera/watch APIs** (relies on network trust).
7. **MJPEG stream unauthenticated.**
8. **SSRF risk:** discovery/probe accepts arbitrary IP from client.
9. **Fall detection claims unsupported:** current system detects people + posture cues, not validated falls.
10. **Camera streaming instability:** FFmpeg reconnection/SIGKILL/zero-frame periods; multiple consumers share one stream.
11. **JSON file DB:** not scalable, no concurrency control, path inconsistency (`process.cwd()` vs `__dirname`).
12. **No frontend tests;** only backend camera tests.

---

## 9. Summary Classification Table

| File/Module | Classification |
|---|---|
| `src/` (app, features) | ACTIVE |
| `server/camera/*` | ACTIVE |
| `server/watch/*` | ACTIVE |
| `camera-agent/agent.py`, `discovery.py` | ACTIVE |
| `camera-agent/person_tracker.py` | ACTIVE (AI path) |
| `camera-agent/fall_detector.py` | EXPERIMENTAL |
| `camera-agent/pose_fall_detector.py` | EXPERIMENTAL |
| `camera-agent/fall_analysis.py` | REQUIRED LATER (reusable analyzer) |
| `camera-agent/test_*.py`, `verify_phase2_integration.mjs` | EXPERIMENTAL/TEST |
| `src/services/camera.ts` (missing endpoints) | ACTIVE with DEAD PARTS |
| `src/lib/mockData.ts` | ACTIVE (demo only) |
| `scratch/`, `mockups/` | UNUSED (archive) |
| `yolo11n.pt` (root duplicate) | DUPLICATE (keep one) |
| `server/data/recordings/*.mp4` | UNUSED (runtime artifacts) |

---

**End of Phase 1 audit.** Proceed to `docs/REFACTORING_PLAN.md` for proposed changes. No files modified during this phase.
