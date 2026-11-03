"""
camera-agent/person_tracker.py
VitalCare Local Roboflow Fall Detection & Event Dispatcher Service

Consumes the Node.js MJPEG camera stream, runs Roboflow fall detection with
ByteTrack IDs, serves an annotated MJPEG stream on loopback, and dispatches
detection updates and confirmed fall alerts to POST /api/events.
"""

import argparse
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import math
import os
import queue
import re
import sys
import threading
import time
import uuid
import cv2
import numpy as np
import requests
import supervision as sv
from supervision.tracker.byte_tracker.core import ByteTrack

latest_frame = None
frame_lock = threading.Lock()
running = True

ROBOFLOW_MODEL_ID = "fall-detection-real/1"
CLASS_TO_ID = {"standing": 0, "falling": 1, "fallen": 2}
ID_TO_CLASS = {class_id: name for name, class_id in CLASS_TO_ID.items()}
FALL_CONFIRMATION_SECONDS = 3.0
FALL_MAX_SAMPLE_GAP_SECONDS = 1.5
FALL_RECOVERY_SECONDS = 3.0
MIN_FALL_SAMPLES = 3
MJPEG_SOI = b"\xff\xd8"
MJPEG_EOI = b"\xff\xd9"
MJPEG_MAX_FRAME_BYTES = 12 * 1024 * 1024
MJPEG_MAX_INVALID_FRAMES = 5
MJPEG_READ_TIMEOUT_SECONDS = 25.0
STREAM_DIAGNOSTIC_INTERVAL_SECONDS = 15.0


class MJPEGStreamError(RuntimeError):
    """The backend MJPEG stream could not provide a valid JPEG frame."""


class MJPEGStreamReader:
    """Reads JPEG frames from the existing Node.js HTTP multipart stream."""

    def __init__(
        self,
        stream_url: str,
        *,
        session: requests.Session | None = None,
        connect_timeout: float = 5.0,
        read_timeout: float = MJPEG_READ_TIMEOUT_SECONDS,
        chunk_size: int = 1024,
        max_frame_bytes: int = MJPEG_MAX_FRAME_BYTES,
    ):
        self.stream_url = stream_url
        self.session = session or requests.Session()
        self.timeout = (connect_timeout, read_timeout)
        self.chunk_size = chunk_size
        self.max_frame_bytes = max_frame_bytes
        self.response = None
        self.chunks = None
        self.buffer = bytearray()

    @property
    def connected(self) -> bool:
        return self.response is not None

    def connect(self) -> None:
        self.disconnect()
        try:
            response = self.session.get(
                self.stream_url,
                stream=True,
                timeout=self.timeout,
            )
        except requests.RequestException:
            raise MJPEGStreamError("Could not connect to the backend MJPEG stream.") from None

        if not 200 <= response.status_code < 300:
            response.close()
            raise MJPEGStreamError(
                f"Backend MJPEG stream returned HTTP {response.status_code}."
            )

        self.response = response
        self.chunks = iter(response.iter_content(chunk_size=self.chunk_size))
        self.buffer.clear()

    def disconnect(self) -> None:
        if self.response is not None:
            self.response.close()
        self.response = None
        self.chunks = None
        self.buffer.clear()

    def close(self) -> None:
        self.disconnect()
        self.session.close()

    def _next_jpeg(self) -> bytes:
        while True:
            start = self.buffer.find(MJPEG_SOI)
            if start < 0:
                keep_trailing_prefix = self.buffer.endswith(b"\xff")
                self.buffer[:] = b"\xff" if keep_trailing_prefix else b""
            else:
                if start:
                    del self.buffer[:start]

                end = self.buffer.find(MJPEG_EOI, len(MJPEG_SOI))
                next_start = self.buffer.find(MJPEG_SOI, len(MJPEG_SOI))
                if next_start >= 0 and (end < 0 or next_start < end):
                    del self.buffer[:next_start]
                    continue
                if end >= 0:
                    frame_end = end + len(MJPEG_EOI)
                    jpeg = bytes(self.buffer[:frame_end])
                    del self.buffer[:frame_end]
                    return jpeg
                if len(self.buffer) > self.max_frame_bytes:
                    self.buffer.clear()
                    raise MJPEGStreamError("Backend MJPEG frame exceeded the size limit.")

            if self.chunks is None:
                self.connect()
            try:
                chunk = next(self.chunks)
            except StopIteration:
                self.disconnect()
                raise MJPEGStreamError("Backend MJPEG stream disconnected.") from None
            except requests.RequestException:
                self.disconnect()
                raise MJPEGStreamError("Backend MJPEG stream read failed.") from None
            if chunk:
                self.buffer.extend(chunk)
                if len(self.buffer) > self.max_frame_bytes and MJPEG_SOI not in self.buffer:
                    self.buffer.clear()
                    raise MJPEGStreamError("Backend MJPEG data exceeded the size limit.")

    def read_frame(self) -> np.ndarray:
        for _ in range(MJPEG_MAX_INVALID_FRAMES):
            jpeg = self._next_jpeg()
            frame = cv2.imdecode(
                np.frombuffer(jpeg, dtype=np.uint8),
                cv2.IMREAD_COLOR,
            )
            if frame is not None:
                return frame
        raise MJPEGStreamError("Backend MJPEG stream supplied invalid JPEG frames.")


def sanitize_url(url: str) -> str:
    """Redacts credentials from RTSP/HTTP URLs for safe console output."""
    if not url:
        return ""
    return re.sub(r"://([^:@]+):([^@]+)@", r"://\1:***@", url)


def load_roboflow_api_key() -> str:
    """Loads the hosted-inference key without logging it."""
    env_value = os.environ.get("ROBOFLOW_API_KEY", "").strip()
    if env_value:
        return env_value

    script_dir = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(script_dir, ".env"),
        os.path.join(script_dir, "..", ".env"),
        os.path.join(script_dir, "..", "server", ".env"),
    ]
    for env_path in candidates:
        if not os.path.isfile(env_path):
            continue
        try:
            with open(env_path, "r", encoding="utf-8") as env_file:
                for line in env_file:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    name, value = line.split("=", 1)
                    if name.strip() == "ROBOFLOW_API_KEY":
                        return value.strip().strip('"').strip("'")
        except OSError as exc:
            raise RuntimeError(
                f"Could not read the environment file {os.path.basename(env_path)}."
            ) from exc
    return ""


class RoboflowInferenceError(RuntimeError):
    """A safe-to-log Roboflow request or response failure."""


@dataclass(frozen=True)
class FallPrediction:
    box: tuple[int, int, int, int]
    confidence: float
    class_name: str


def parse_roboflow_predictions(
    payload: object,
    frame_width: int,
    frame_height: int,
) -> list[FallPrediction]:
    """Validates Roboflow boxes and clips them to the submitted frame."""
    if not isinstance(payload, dict) or not isinstance(payload.get("predictions"), list):
        raise RoboflowInferenceError("Roboflow returned an invalid predictions payload.")

    predictions: list[FallPrediction] = []
    for raw_prediction in payload["predictions"]:
        if not isinstance(raw_prediction, dict):
            continue
        class_name = str(raw_prediction.get("class", "")).strip().lower()
        if class_name not in CLASS_TO_ID:
            continue

        try:
            center_x = float(raw_prediction["x"])
            center_y = float(raw_prediction["y"])
            box_width = float(raw_prediction["width"])
            box_height = float(raw_prediction["height"])
            confidence = float(raw_prediction["confidence"])
        except (KeyError, TypeError, ValueError):
            continue
        if not all(
            math.isfinite(value)
            for value in (center_x, center_y, box_width, box_height, confidence)
        ):
            continue
        if box_width <= 0 or box_height <= 0 or not 0 <= confidence <= 1:
            continue

        x1 = max(0, min(frame_width, int(round(center_x - box_width / 2))))
        y1 = max(0, min(frame_height, int(round(center_y - box_height / 2))))
        x2 = max(0, min(frame_width, int(round(center_x + box_width / 2))))
        y2 = max(0, min(frame_height, int(round(center_y + box_height / 2))))
        if x2 <= x1 or y2 <= y1:
            continue

        predictions.append(
            FallPrediction((x1, y1, x2, y2), confidence, class_name)
        )
    return predictions


class RoboflowDetector:
    """Small hosted-inference client; API failures never include the secret."""

    def __init__(
        self,
        api_key: str,
        confidence: float,
        image_size: int,
        timeout: float = 6.0,
        session: requests.Session | None = None,
    ):
        if not api_key:
            raise ValueError("ROBOFLOW_API_KEY is required.")
        self.api_key = api_key
        self.confidence = confidence
        self.image_size = image_size
        self.timeout = timeout
        self.session = session or requests.Session()
        self.endpoint = f"https://detect.roboflow.com/{ROBOFLOW_MODEL_ID}"

    def predict(self, frame: np.ndarray) -> list[FallPrediction]:
        frame_height, frame_width = frame.shape[:2]
        scale = min(1.0, self.image_size / max(frame_width, frame_height))
        inference_frame = (
            cv2.resize(
                frame,
                (max(1, int(frame_width * scale)), max(1, int(frame_height * scale))),
                interpolation=cv2.INTER_AREA,
            )
            if scale < 1.0
            else frame
        )
        ok, encoded = cv2.imencode(".jpg", inference_frame)
        if not ok:
            raise RoboflowInferenceError("Could not encode the sampled camera frame.")

        try:
            response = self.session.post(
                self.endpoint,
                params={
                    "api_key": self.api_key,
                    "confidence": int(round(self.confidence * 100)),
                },
                files={"file": ("frame.jpg", encoded.tobytes(), "image/jpeg")},
                timeout=self.timeout,
            )
        except requests.Timeout:
            raise RoboflowInferenceError("Roboflow inference request timed out.") from None
        except requests.RequestException:
            raise RoboflowInferenceError("Roboflow inference request failed.") from None

        if response.status_code != 200:
            raise RoboflowInferenceError(
                f"Roboflow inference returned HTTP {response.status_code}."
            )
        try:
            payload = response.json()
        except ValueError:
            raise RoboflowInferenceError("Roboflow returned invalid JSON.") from None

        predictions = parse_roboflow_predictions(
            payload,
            inference_frame.shape[1],
            inference_frame.shape[0],
        )
        if scale < 1.0:
            predictions = [
                FallPrediction(
                    tuple(
                        max(0, min(limit, int(round(coordinate / scale))))
                        for coordinate, limit in zip(
                            prediction.box,
                            (frame_width, frame_height, frame_width, frame_height),
                        )
                    ),
                    prediction.confidence,
                    prediction.class_name,
                )
                for prediction in predictions
            ]
        return predictions


class FallIncidentTracker:
    """Confirms sustained fallen predictions and latches each incident once."""

    def __init__(
        self,
        confirmation_seconds: float = FALL_CONFIRMATION_SECONDS,
        max_sample_gap_seconds: float = FALL_MAX_SAMPLE_GAP_SECONDS,
        recovery_seconds: float = FALL_RECOVERY_SECONDS,
        minimum_samples: int = MIN_FALL_SAMPLES,
    ):
        self.confirmation_seconds = confirmation_seconds
        self.max_sample_gap_seconds = max_sample_gap_seconds
        self.recovery_seconds = recovery_seconds
        self.minimum_samples = minimum_samples
        self.tracks: dict[int, dict] = {}

    def update(self, track_id: int, class_name: str, now: float) -> dict:
        history = self.tracks.setdefault(
            track_id,
            {
                "last_seen": None,
                "fallen_since": None,
                "fallen_samples": 0,
                "confirmed": False,
                "incident_id": None,
                "upright_since": None,
            },
        )
        last_seen = history["last_seen"]
        if (
            not history["confirmed"]
            and last_seen is not None
            and now - last_seen > self.max_sample_gap_seconds
        ):
            history["fallen_since"] = None
            history["fallen_samples"] = 0

        newly_confirmed = False
        if class_name == "fallen":
            history["upright_since"] = None
            if history["fallen_since"] is None:
                history["fallen_since"] = now
                history["fallen_samples"] = 0
            history["fallen_samples"] += 1
            if (
                not history["confirmed"]
                and history["fallen_samples"] >= self.minimum_samples
                and now - history["fallen_since"] >= self.confirmation_seconds
            ):
                history["confirmed"] = True
                history["incident_id"] = uuid.uuid4().hex
                newly_confirmed = True
        else:
            history["fallen_since"] = None
            history["fallen_samples"] = 0
            if history["confirmed"] and class_name == "standing":
                if history["upright_since"] is None:
                    history["upright_since"] = now
                elif now - history["upright_since"] >= self.recovery_seconds:
                    history["confirmed"] = False
                    history["incident_id"] = None
                    history["upright_since"] = None
            else:
                history["upright_since"] = None

        history["last_seen"] = now
        confirmed = history["confirmed"]
        if confirmed:
            state = "red"
            label = "FALLEN - CONFIRMED"
            reason = "Fall confirmed; waiting for sustained standing recovery"
        elif class_name == "standing":
            state = "green"
            label = "STANDING"
            reason = "Standing"
        elif class_name == "falling":
            state = "yellow"
            label = "FALLING"
            reason = "Fall suspected; verify visually"
        else:
            elapsed = max(0.0, now - history["fallen_since"])
            state = "yellow"
            label = "FALLEN - VERIFY"
            reason = (
                f"Fallen prediction pending confirmation "
                f"({elapsed:.1f}/{self.confirmation_seconds:.1f}s)"
            )

        return {
            "state": state,
            "label": label,
            "reason": reason,
            "fallConfirmed": newly_confirmed,
            "incidentId": history["incident_id"] if confirmed else None,
        }

    def remove_stale_tracks(self, now: float, stale_seconds: float = 30.0) -> None:
        for track_id, history in list(self.tracks.items()):
            if (
                not history["confirmed"]
                and history["last_seen"] is not None
                and now - history["last_seen"] > stale_seconds
            ):
                del self.tracks[track_id]


def create_byte_tracker(inference_fps: float) -> ByteTrack:
    return ByteTrack(
        frame_rate=inference_fps,
        lost_track_buffer=max(1, int(math.ceil(inference_fps * 2.0))),
        minimum_consecutive_frames=1,
    )


def load_internal_secret(cli_arg: str | None = None) -> str:
    """
    Resolves the internal service key from CLI, environment, or .env files.
    Never logs or exposes the secret.
    """
    if cli_arg and cli_arg.strip():
        print("[Auth] Using internal secret from CLI argument.")
        return cli_arg.strip()

    env_val = os.environ.get("INTERNAL_SERVICE_KEY")
    if env_val and env_val.strip():
        print("[Auth] Using internal secret from INTERNAL_SERVICE_KEY environment variable.")
        return env_val.strip()

    # Search candidate .env paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(script_dir, ".env"),
        os.path.join(script_dir, "..", "server", ".env"),
        os.path.join(script_dir, "..", ".env"),
    ]

    for env_path in candidates:
        if os.path.isfile(env_path):
            try:
                with open(env_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line.startswith("#") or not line:
                            continue
                        if line.startswith("INTERNAL_SERVICE_KEY="):
                            secret = line.split("=", 1)[1].strip().strip('"').strip("'")
                            if secret:
                                print(f"[Auth] Loaded internal secret from {os.path.basename(env_path)}")
                                return secret
            except Exception:
                pass

    print("[Auth Warning] No INTERNAL_SERVICE_KEY found. Backend event dispatch may be rejected (401).")
    return ""


class EventDispatcher:
    """
    Asynchronous event dispatcher that queues and posts AI events to the Node.js
    backend in a background worker thread. Prevents network delays from blocking
    frame acquisition or model inference.
    """

    def __init__(self, api_url: str, secret: str, max_queue: int = 20):
        self.api_url = api_url.rstrip("/")
        self.secret = secret
        self.queue = queue.Queue(maxsize=max_queue)
        self.emergency_queue = queue.Queue()
        self.worker = threading.Thread(
            target=self._run,
            args=(self.queue,),
            daemon=True,
            name="EventDispatcherWorker",
        )
        self.emergency_worker = threading.Thread(
            target=self._run,
            args=(self.emergency_queue,),
            daemon=True,
            name="EmergencyEventDispatcherWorker",
        )
        self._last_warn_time = 0.0

    def start(self):
        self.worker.start()
        self.emergency_worker.start()

    def dispatch(self, event_payload: dict, *, critical: bool = False):
        """Prioritizes emergencies separately from coalescible detection updates."""
        if critical:
            self.emergency_queue.put_nowait(event_payload)
            return

        try:
            self.queue.put_nowait(event_payload)
        except queue.Full:
            try:
                self.queue.get_nowait()
                self.queue.put_nowait(event_payload)
            except Exception:
                pass

    def _run(self, source_queue: queue.Queue):
        endpoint = f"{self.api_url}/api/events"
        while running:
            try:
                event = source_queue.get(timeout=0.2)
            except queue.Empty:
                continue

            headers = {"Content-Type": "application/json"}
            if self.secret:
                headers["X-Internal-Secret"] = self.secret

            try:
                resp = requests.post(endpoint, json=event, headers=headers, timeout=2.5)
                if resp.status_code == 200:
                    data = resp.json()
                    evt_type = event.get("type", "unknown")
                    conf = event.get("confidence", 0.0)
                    cnt = event.get("details", {}).get("personCount", 0)
                    recipients = data.get("broadcastedTo", 0)
                    print(
                        f"[Event Dispatcher] Event sent: {evt_type} (conf: {conf:.2f}, "
                        f"count: {cnt}, WS broadcasted: {recipients})"
                    )
                elif resp.status_code == 401:
                    now = time.time()
                    if now - self._last_warn_time > 15.0:
                        print(
                            "[Event Dispatcher Warning] 401 Unauthorized from backend. "
                            "Verify INTERNAL_SERVICE_KEY in server/.env."
                        )
                        self._last_warn_time = now
                else:
                    print(
                        f"[Event Dispatcher Warning] Event rejected by backend: HTTP {resp.status_code} "
                        f"({resp.text[:100]})"
                    )
            except requests.RequestException as exc:
                now = time.time()
                if now - self._last_warn_time > 15.0:
                    print(f"[Event Dispatcher Warning] Backend unreachable at {endpoint}: {exc}")
                    self._last_warn_time = now
            finally:
                source_queue.task_done()


def resolve_camera_config(
    api_url: str,
    camera_id: str | None = None,
    secret: str = "",
    prefer_direct_rtsp: bool = False
) -> tuple[str, str, str]:
    """
    Resolves the public camera record and React-compatible MJPEG URL.
    Returns: (stream_url, camera_id, camera_name). The legacy auth arguments
    are retained for callers but are not needed by these public endpoints.
    """
    try:
        cameras_url = f"{api_url.rstrip('/')}/api/cameras"
        print(f"[Config] Querying camera records from {cameras_url}...")
        resp = requests.get(cameras_url, timeout=4)
        if resp.status_code != 200:
            raise RuntimeError(f"Failed to list cameras: HTTP {resp.status_code}")

        cameras = resp.json()
        if not isinstance(cameras, list) or not cameras:
            raise RuntimeError("No cameras registered in the database.")

        if camera_id:
            chosen = next(
                (camera for camera in cameras if camera.get("id") == camera_id),
                None,
            )
            if chosen is None:
                raise RuntimeError(f"Camera {camera_id} was not found in the backend.")
        else:
            chosen = next(
                (camera for camera in cameras if camera.get("enabled")),
                cameras[0],
            )

        resolved_id = chosen.get("id")
        if not isinstance(resolved_id, str) or not resolved_id:
            raise RuntimeError("The selected camera record has no valid ID.")

        camera_name = chosen.get("name", "Camera")
        stream_url = f"{api_url.rstrip('/')}/api/cameras/{resolved_id}/stream"
        print(f"[Config] Selected backend MJPEG stream proxy: {stream_url}")
        return stream_url, resolved_id, camera_name

    except Exception as exc:
        print(f"[Config Warning] Could not resolve camera from backend API: {exc}")
        return "", camera_id or "unknown", "Camera"


def detect_people(
    stream_url: str,
    api_key: str,
    confidence: float,
    image_size: int,
    camera_id: str,
    camera_name: str,
    dispatcher: EventDispatcher,
    throttle_interval: float = 2.0,
    cooldown: float = 0.5,
    inference_fps: float = 3.0,
):
    global latest_frame, running
    reader = None
    detector = None
    inference_worker = None
    inference_stop = threading.Event()
    tracker_reset = threading.Event()

    try:
        detector = RoboflowDetector(api_key, confidence, image_size)
        reader = MJPEGStreamReader(stream_url)
        frame_queue: queue.Queue = queue.Queue(maxsize=1)
        annotations: list[dict] = []
        annotations_lock = threading.Lock()
        generation_lock = threading.Lock()
        stream_generation = 0
        analyzer = FallIncidentTracker()
        tracker = create_byte_tracker(inference_fps)

        def current_stream_generation() -> int:
            with generation_lock:
                return stream_generation

        redacted_url = sanitize_url(stream_url)
        print(f"[Stream] Connecting to backend MJPEG stream: {redacted_url}")
        last_event_time = 0.0
        last_person_count = 0
        last_track_ids: set[int] = set()
        last_detection_update = 0.0
        inference_errors_at = 0.0
        inference_backoff_until = 0.0
        inference_backoff_seconds = 1.0
        reconnect_delay = 1.0
        connected_once = False

        def discard_pending_frame() -> None:
            try:
                frame_queue.get_nowait()
                frame_queue.task_done()
            except queue.Empty:
                pass

        def inference_loop():
            nonlocal tracker, analyzer, annotations, last_event_time, last_person_count
            nonlocal last_track_ids, last_detection_update, inference_errors_at
            nonlocal inference_backoff_until, inference_backoff_seconds
            while running and not inference_stop.is_set():
                try:
                    sample_generation, sample_time, sample = frame_queue.get(timeout=0.25)
                except queue.Empty:
                    continue
                try:
                    if inference_stop.is_set():
                        break
                    if time.monotonic() < inference_backoff_until:
                        continue
                    if tracker_reset.is_set():
                        tracker = create_byte_tracker(inference_fps)
                        analyzer = FallIncidentTracker()
                        last_track_ids.clear()
                        last_person_count = 0
                        last_event_time = 0.0
                        tracker_reset.clear()

                    predictions = detector.predict(sample)
                    inference_backoff_until = 0.0
                    inference_backoff_seconds = 1.0
                    current_time = time.monotonic()
                    if inference_stop.is_set():
                        continue
                    if sample_generation != current_stream_generation():
                        continue
                    if current_time - sample_time > max(3.0, 3.0 / inference_fps):
                        continue

                    frame_height, frame_width = sample.shape[:2]
                    raw_detections = sv.Detections(
                        xyxy=np.asarray([item.box for item in predictions], dtype=float).reshape(-1, 4),
                        confidence=np.asarray([item.confidence for item in predictions], dtype=float),
                        class_id=np.asarray(
                            [CLASS_TO_ID[item.class_name] for item in predictions],
                            dtype=int,
                        ),
                    )
                    tracked = tracker.update_with_detections(raw_detections)
                    persons = []
                    confidences = []
                    current_track_ids: set[int] = set()
                    fall_events = []
                    current_annotations = []

                    for index, box in enumerate(tracked.xyxy):
                        if tracked.class_id is None:
                            continue
                        class_name = ID_TO_CLASS.get(int(tracked.class_id[index]))
                        if class_name is None:
                            continue
                        track_id = (
                            int(tracked.tracker_id[index])
                            if tracked.tracker_id is not None
                            else None
                        )
                        if track_id is None:
                            continue

                        x1, y1, x2, y2 = map(int, box)
                        confidence_score = (
                            float(tracked.confidence[index])
                            if tracked.confidence is not None
                            else 0.0
                        )
                        analysis = analyzer.update(track_id, class_name, sample_time)
                        current_track_ids.add(track_id)
                        confidences.append(confidence_score)
                        person = {
                            "trackId": track_id,
                            "confidence": round(confidence_score, 3),
                            "box": [x1, y1, x2, y2],
                            "state": analysis["state"],
                            "reason": analysis["reason"],
                            "torsoAngle": None,
                        }
                        persons.append(person)
                        if analysis["fallConfirmed"]:
                            fall_events.append((person, analysis["incidentId"]))

                        color = {
                            "green": (0, 200, 0),
                            "yellow": (0, 215, 255),
                            "red": (0, 0, 255),
                        }[analysis["state"]]
                        current_annotations.append(
                            {
                                "box": (x1, y1, x2, y2),
                                "trackId": track_id,
                                "label": f"ID {track_id} {analysis['label']} {confidence_score:.0%}",
                                "color": color,
                            }
                        )

                    now = time.monotonic()
                    analyzer.remove_stale_tracks(now)
                    count = len(persons)
                    max_confidence = max(confidences) if confidences else 0.0
                    new_tracks = current_track_ids - last_track_ids
                    details = {
                        "personCount": count,
                        "trackIds": sorted(current_track_ids),
                        "persons": persons,
                        "frameWidth": frame_width,
                        "frameHeight": frame_height,
                        "cameraName": camera_name,
                    }
                    if now - last_detection_update >= min(throttle_interval, 0.5):
                        dispatcher.dispatch(
                            {
                                "type": "person_detection_update",
                                "cameraId": camera_id,
                                "confidence": round(max_confidence, 3),
                                "details": details,
                            }
                        )
                        last_detection_update = now

                    if (
                        count != last_person_count
                        or bool(new_tracks)
                        or now - last_event_time >= max(throttle_interval, 2.0)
                    ):
                        dispatcher.dispatch(
                            {
                                "type": "person_detected",
                                "cameraId": camera_id,
                                "confidence": round(max_confidence, 3),
                                "details": details,
                            }
                        )
                        last_event_time = now
                        last_person_count = count
                    last_track_ids = current_track_ids

                    for person, incident_id in fall_events:
                        dispatcher.dispatch(
                            {
                                "type": "fall_detected",
                                "cameraId": camera_id,
                                "confidence": person["confidence"],
                                "details": {
                                    "trackId": person["trackId"],
                                    "person": person,
                                    "personCount": count,
                                    "frameWidth": frame_width,
                                    "frameHeight": frame_height,
                                    "cameraName": camera_name,
                                    "fallIncidentId": incident_id,
                                    "model": ROBOFLOW_MODEL_ID,
                                    "requiresHumanVerification": True,
                                },
                            },
                            critical=True,
                        )

                    with annotations_lock:
                        annotations = current_annotations
                except RoboflowInferenceError as inference_error:
                    now = time.monotonic()
                    inference_backoff_until = now + inference_backoff_seconds
                    inference_backoff_seconds = min(
                        inference_backoff_seconds * 2.0,
                        30.0,
                    )
                    if now - inference_errors_at >= 15.0:
                        print(f"[Roboflow Warning] {inference_error}")
                        inference_errors_at = now
                except Exception as inference_error:
                    now = time.monotonic()
                    if now - inference_errors_at >= 15.0:
                        print(
                            "[Tracker Warning] Inference frame processing failed "
                            f"({type(inference_error).__name__})."
                        )
                        inference_errors_at = now
                finally:
                    frame_queue.task_done()

        inference_worker = threading.Thread(
            target=inference_loop,
            daemon=True,
            name="RoboflowInferenceWorker",
        )
        inference_worker.start()
        inference_interval = 1.0 / inference_fps
        next_sample_time = 0.0
        decoded_frames = 0
        last_stream_diagnostic = time.monotonic()

        while running:
            try:
                if reader.response is None:
                    reader.connect()
                    if connected_once:
                        tracker_reset.set()
                        discard_pending_frame()
                        with generation_lock:
                            stream_generation += 1
                        with annotations_lock:
                            annotations = []
                    connected_once = True
                    reconnect_delay = 1.0
                    next_sample_time = 0.0
                    print(
                        "[Stream Ready] Backend MJPEG connected. Annotated feed at "
                        "http://localhost:8001/video_feed"
                    )
                frame = reader.read_frame()
            except MJPEGStreamError as stream_error:
                reader.disconnect()
                if not connected_once:
                    print(f"[Stream Warning] {stream_error} Retrying in {reconnect_delay:.0f}s.")
                else:
                    print(f"[Stream Warning] {stream_error} Reconnecting in {reconnect_delay:.0f}s.")
                    with generation_lock:
                        stream_generation += 1
                    tracker_reset.set()
                    discard_pending_frame()
                    with annotations_lock:
                        annotations = []
                    with frame_lock:
                        latest_frame = None
                retry_deadline = time.monotonic() + reconnect_delay
                while running and time.monotonic() < retry_deadline:
                    time.sleep(min(0.1, retry_deadline - time.monotonic()))
                reconnect_delay = min(reconnect_delay * 2.0, 30.0)
                continue

            decoded_frames += 1
            now = time.monotonic()
            if now - last_stream_diagnostic >= STREAM_DIAGNOSTIC_INTERVAL_SECONDS:
                print("[Stream Metrics] " + json.dumps({
                    "event": "mjpeg_frames_decoded",
                    "cameraId": camera_id,
                    "framesDecoded": decoded_frames,
                    "lastFrameAtUtc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "inferenceQueueDepth": frame_queue.qsize(),
                    "streamConnected": reader.connected,
                }))
                last_stream_diagnostic = now

            frame_height, frame_width = frame.shape[:2]
            if now >= next_sample_time:
                try:
                    sample = (current_stream_generation(), now, frame.copy())
                    frame_queue.put_nowait(sample)
                except queue.Full:
                    try:
                        frame_queue.get_nowait()
                        frame_queue.task_done()
                    except queue.Empty:
                        pass
                    try:
                        sample = (current_stream_generation(), now, frame.copy())
                        frame_queue.put_nowait(sample)
                    except queue.Full:
                        pass
                next_sample_time = now + inference_interval

            with annotations_lock:
                current_annotations = list(annotations)
            for annotation in current_annotations:
                x1, y1, x2, y2 = annotation["box"]
                color = annotation["color"]
                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                cv2.putText(
                    frame,
                    annotation["label"],
                    (x1, max(20, y1 - 8)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.5,
                    color,
                    2,
                )

            visible_people = len(current_annotations)
            visible_falls = sum(item["color"] == (0, 0, 255) for item in current_annotations)
            visible_warnings = sum(item["color"] == (0, 215, 255) for item in current_annotations)
            header = (
                f"[{camera_name}] PEOPLE: {visible_people}  "
                f"RISK: {visible_warnings}  FALL: {visible_falls}"
            )
            header_color = (
                (0, 0, 255)
                if visible_falls
                else (0, 215, 255)
                if visible_warnings
                else (0, 200, 0)
            )
            cv2.putText(
                frame,
                header,
                (15, 30),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                header_color,
                2,
            )
            ok, encoded = cv2.imencode(".jpg", frame)
            if ok:
                with frame_lock:
                    latest_frame = encoded.tobytes()

    except Exception as exc:
        print("[Tracker Error]", exc)
    finally:
        inference_stop.set()
        if inference_worker is not None:
            inference_worker.join(timeout=(detector.timeout + 1.0) if detector else 1.0)
        if detector is not None and (
            inference_worker is None or not inference_worker.is_alive()
        ):
            detector.session.close()
        if reader is not None:
            reader.close()


class VideoHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/video_feed":
            self.send_error(404)
            return

        self.send_response(200)
        self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()

        try:
            while running:
                with frame_lock:
                    frame = latest_frame
                if frame is not None:
                    self.wfile.write(b"--frame\r\nContent-Type: image/jpeg\r\n")
                    self.wfile.write(f"Content-Length: {len(frame)}\r\n\r\n".encode())
                    self.wfile.write(frame + b"\r\n")
                time.sleep(0.04)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def log_message(self, format, *args):
        pass


def main():
    global running
    parser = argparse.ArgumentParser(description="VitalCare Roboflow Fall Detection & Event Dispatcher")
    parser.add_argument("--camera-id", type=str, default=None, help="Camera ID to stream from")
    parser.add_argument(
        "--stream-url",
        type=str,
        default=None,
        help="Override with an HTTP(S) MJPEG stream URL; RTSP URLs are not supported",
    )
    parser.add_argument("--api-url", type=str, default="http://localhost:5000", help="Backend Node.js API URL")
    parser.add_argument("--internal-secret", type=str, default=None, help="Internal service key for backend auth")
    parser.add_argument("--confidence", type=float, default=0.4, help="Roboflow confidence cutoff (0.0-1.0)")
    parser.add_argument("--image-size", type=int, default=640, help="Maximum Roboflow inference image dimension")
    parser.add_argument(
        "--inference-fps",
        type=float,
        default=3.0,
        help="Maximum sampled inference rate (0-5 FPS; default: 3)",
    )
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Annotated stream bind host (loopback by default)")
    parser.add_argument("--port", type=int, default=8001, help="Annotated video HTTP server port")
    parser.add_argument("--throttle-interval", type=float, default=0.5, help="Detection update interval (seconds)")
    parser.add_argument(
        "--cooldown",
        type=float,
        default=0.5,
        help="Deprecated compatibility option; event throttling uses --throttle-interval",
    )
    parser.add_argument(
        "--prefer-mjpeg-proxy",
        action="store_true",
        help="Deprecated; the Node.js MJPEG proxy is always used",
    )

    args = parser.parse_args()

    if not 0.0 < args.confidence <= 1.0:
        parser.error("--confidence must be greater than 0 and at most 1")
    if args.image_size < 1:
        parser.error("--image-size must be greater than 0")
    if not 0.0 < args.inference_fps <= 5.0:
        parser.error("--inference-fps must be greater than 0 and at most 5")
    if args.stream_url and not args.stream_url.lower().startswith(("http://", "https://")):
        parser.error("--stream-url must be an HTTP(S) MJPEG URL; RTSP is not supported")

    roboflow_api_key = load_roboflow_api_key()
    if not roboflow_api_key:
        print(
            "[Startup Error] ROBOFLOW_API_KEY is required. Set it in camera-agent/.env "
            "or the process environment."
        )
        return

    # Load internal secret securely
    internal_secret = load_internal_secret(args.internal_secret)

    # Initialize and start event dispatcher
    dispatcher = EventDispatcher(api_url=args.api_url, secret=internal_secret)
    dispatcher.start()

    # Resolve stream URL and camera metadata
    stream_url = args.stream_url
    camera_id = args.camera_id or "cam-1"
    camera_name = "Camera"

    if not stream_url:
        resolved_url, resolved_id, name = resolve_camera_config(
            api_url=args.api_url,
            camera_id=args.camera_id,
        )
        stream_url = resolved_url
        camera_id = resolved_id
        camera_name = name

    if not stream_url:
        print("[Startup Warning] Could not resolve a valid camera stream URL from backend API.")
        print("Running in standby: video server active on port, retrying connection...")
        stream_url = f"{args.api_url.rstrip('/')}/api/cameras/{camera_id}/stream"

    # Start detection worker thread
    worker = threading.Thread(
        target=detect_people,
        args=(
            stream_url,
            roboflow_api_key,
            args.confidence,
            args.image_size,
            camera_id,
            camera_name,
            dispatcher,
            args.throttle_interval,
            args.cooldown,
        ),
        kwargs={"inference_fps": args.inference_fps},
        daemon=True,
        name="RoboflowCameraAgentWorker",
    )
    worker.start()

    print(f"[Server] Video server starting on port {args.port}...")
    server = None
    try:
        server = ThreadingHTTPServer((args.host, args.port), VideoHandler)
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[Server] Shutting down gracefully...")
    finally:
        running = False
        if server is not None:
            server.server_close()
        worker.join(timeout=10.0)


if __name__ == "__main__":
    main()
