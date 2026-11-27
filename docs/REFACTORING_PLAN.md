# VitalCare - Refactoring Plan

**Project path:** `D:\eldercare\eldercare`
**Phase:** 2 - Refactoring Plan (for review; no destructive changes yet)
**Principles:** Preserve YOLO11 and Camera Management; incremental, reversible; no new features.

> **Superseded:** The approved V2 cleanup removed the legacy Roboflow detector and standard YOLO box-only weights. Keep `yolo11n-pose.pt` and the TCN-Transformer checkpoint for the active pipeline. Do not follow older retain/move recommendations for `person_tracker.py` or `yolo11n.pt` below.

---

## 1. Proposed Target Architecture (logical)

```
VitalCare/
  src/                      # Frontend application (feature-based)
  server/
    camera/                 # Camera management, ONVIF, RTSP, APIs (unchanged core)
    events/                 # AI event communication (extracted from index.ts)
  camera-agent/
    camera/                 # Frame capture and decoding (MJPEG reader)
    detection/              # Person detection using existing model (YOLO11 where used)
    tracking/               # Person tracking (ByteTrack)
    fall_detection/         # Fall analysis (consolidated)
    events/                 # Event generation/dispatch
    config/                 # Agent configuration
    tests/                  # Automated tests
  docs/
    CODEBASE_AUDIT.md
    REFACTORING_PLAN.md
    REFACTORING_REPORT.md   # Phase 4
```

This is a logical structure. Physical moves are proposed below and require approval.

---

## 2. Files to Retain (no change)

- `server/camera/*` (all) - Camera Management core; most tested. Preserve as-is.
- `server/watch/*` - Watch module; preserve API contracts.
- `server/index.ts` - keep, but extract `/api/events` validation into `server/events/` (optional, later).
- `camera-agent/agent.py`, `camera-agent/discovery.py` - ONVIF discovery/probe; preserve.
- `camera-agent/person_tracker.py` - active AI path; preserve behavior.
- `camera-agent/fall_analysis.py` - reusable analyzer; retain (move to fall_detection/).
- `yolo11n.pt`, `camera-agent/models/yolo11n.pt` - retain YOLO11 weights (keep one canonical copy).
- `src/` frontend - preserve functionality; reorganize folders only after approval.

---

## 3. Files to Move (proposed)

| From | To | Reason |
|---|---|---|
| `camera-agent/fall_analysis.py` | `camera-agent/fall_detection/fall_analysis.py` | Group fall analysis |
| `camera-agent/fall_detector.py` | `camera-agent/experiments/fall_detector.py` | Experimental heuristic |
| `camera-agent/pose_fall_detector.py` | `camera-agent/experiments/pose_fall_detector.py` | Experimental pose script |
| `camera-agent/test_*.py` | `camera-agent/tests/` | Group tests |
| `camera-agent/test_*.jpg`, `test_frame.jpg` | `camera-agent/tests/fixtures/` | Test fixtures |
| `camera-agent/verify_phase2_integration.mjs` | `camera-agent/tests/` | Integration check |
| `camera-agent/norman.mp4`, `fall_detection.mp4` | `camera-agent/samples/` | Keep research videos |
| `scratch/test_mock_camera.py` | `archive/scratch/` | Not runtime |
| `mockups/` | `archive/mockups/` | Design artifacts |
| Root `yolo11n.pt` | remove duplicate; keep `camera-agent/models/yolo11n.pt` | Avoid duplicate weights |

No moves will be executed without approval.

---

## 4. Files Proposed for Consolidation

- Fall detection scripts: keep `person_tracker.py` as the active path; move experimental scripts under `experiments/`; keep `fall_analysis.py` as shared analyzer. Do not delete YOLO11.
- Duplicate TS types: create `shared-types` (or `src/types/camera.ts` re-exporting server types via a shared package) later; short-term keep both but document drift. Avoid big-bang type unification.
- `DeviceManagement.tsx` vs `CameraManagement.tsx`: keep both; clarify naming; no deletion.

---

## 5. Files Proposed for Removal (only after verification)

| Candidate | Reason | Verification needed |
|---|---|---|
| Root `yolo11n.pt` duplicate | Duplicate of `camera-agent/models/yolo11n.pt` | Confirm identical hash; confirm scripts reference models path |
| `server/data/recordings/*.mp4` | Runtime artifacts | Confirm not referenced by tests/docs |
| `src/services/camera.ts` dead endpoints (`/preset`, `/tracking`, `/nightvision`, `/talk`, `/snapshot`) | No backend routes | Search for callers; implement or remove |
| `mockups/`, `scratch/` | Not runtime | Confirm no imports |
| `docs/AI_Powered_...docx` | Binary doc | Confirm superseded by markdown docs |

No deletions in Phase 2. All require explicit approval and checkpoint.

---

## 6. Dependency Changes (proposed, not applied)

- Backend: add schema validation (e.g., zod) only if approved; add rate limiting and helmet for production; keep current deps for now.
- Frontend: move `clsx`, `tailwind-merge` to dependencies if used at runtime; verify.
- Python: pin versions via lock file (`pip-compile`) after confirming usage; no removal of ultralytics/torch (YOLO11).
- Do not introduce state management libraries (Context sufficient).

---

## 7. Potential Breaking Changes

- Moving Python files changes CLI invocation paths (docs/scripts must update).
- Changing DB path resolution (process.cwd vs __dirname) could break tests; fix carefully.
- Removing dead frontend endpoints may break UI features if they were intended; verify first.
- Any folder reorg requires updating imports and lazy route paths.

---

## 8. Rollback Strategy

- Create a Git checkpoint (commit or branch) before any destructive change.
- Apply changes in small commits; keep diffs reviewable.
- If a move breaks imports, revert that commit only.
- Keep original files until new structure verified by build/tests.

---

## 9. Validation Tests (Phase 4)

Run and document results:
- Frontend: `npm run build` (tsc + vite build).
- Backend: `npm run test` (tsc + node tests).
- Python: import checks (`python -c import ...`), run `test_fall_analysis.py`, `test_roboflow_tracker.py`, `test_event_pipeline.py`.
- Camera API smoke: `/health`, list cameras, statuses.
- Person-detection smoke: run `person_tracker.py` against a test stream if available.

Do not claim success for tests not executed.

---

## 10. Acceptance Criteria

1. Clear, maintainable structure.
2. Verified duplicates/unused code removed (with reasons).
3. YOLO11 preserved if required.
4. Camera Management functional.
5. Backend APIs compatible.
6. Streaming and AI inference boundaries clear.
7. No silent breakage.
8. Tests/build documented.
9. Ready for RTSP/FFmpeg stabilization.

---

**Stop point:** This plan is for review. Awaiting approval before any file moves, deletions, or dependency changes.
