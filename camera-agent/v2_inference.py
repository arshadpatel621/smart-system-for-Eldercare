import argparse
import math
import os
import queue
import signal
import threading
import time
from collections import defaultdict, deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import cv2
import numpy as np
import requests
import torch
from ultralytics import YOLO

from camera_lock import CameraLock as CameraInstanceLock
from v2_model import load_v2_model

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "models"
CLASSES = ["FALL", "FALLEN", "LIE_DOWN", "LYING", "OTHER", "SIT_DOWN", "SITTING", "STAND_UP", "STANDING", "WALKING"]
STOP = threading.Event()
FALL_CLASSES = {"FALL", "FALLEN"}
AGENT_STATUS_INTERVAL = 5.0
DETECTION_UPDATE_INTERVAL = 0.5
STALE_TRACK_SECONDS = 3.0

# COCO keypoint skeleton connections (0-based)
SKELETON_CONNECTIONS = (
    (5, 7), (7, 9),      # left arm
    (6, 8), (8, 10),     # right arm
    (5, 6),              # shoulders
    (5, 11), (6, 12),    # torso sides
    (11, 12),            # hips
    (11, 13), (13, 15),  # left leg
    (12, 14), (14, 16),  # right leg
    (0, 1), (0, 2),      # nose-eyes
    (1, 3), (2, 4),      # eyes-ears
    (0, 5), (0, 6),      # nose-shoulders
)
KEYPOINT_CONF_THRESHOLD = 0.2

latest_annotated_jpeg = None
annotated_frame_lock = threading.Lock()


def get_keypoint_conf_threshold():
    return KEYPOINT_CONF_THRESHOLD


def load_secret():
    secret = os.getenv("INTERNAL_SERVICE_KEY", "")
    for path in (BASE_DIR / ".env", BASE_DIR.parent / "server" / ".env", BASE_DIR.parent / ".env"):
        if path.is_file():
            try:
                for line in path.read_text(encoding="utf-8-sig").splitlines():
                    line = line.strip()
                    if line.startswith("INTERNAL_SERVICE_KEY="):
                        value = line.split("=", 1)[1].strip().strip('"').strip("'")
                        if value:
                            return value
            except OSError as exc:
                print(f"[V2] Could not read {path}: {exc}")
    return secret


def resolve_camera(api_url, camera_id):
    if not camera_id:
        response = requests.get(f"{api_url.rstrip('/')}/api/cameras", timeout=8)
        response.raise_for_status()
        payload = response.json()
        cameras = payload if isinstance(payload, list) else payload.get("value", [])
        selected = next((c for c in cameras if c.get("enabled") is True), None)
        if selected is None:
            raise RuntimeError("No enabled camera found. Enable one in Camera Management.")
        camera_id = selected.get("id")
        if not camera_id:
            raise RuntimeError("Selected camera has no ID")
    response = requests.get(f"{api_url.rstrip('/')}/api/cameras/{camera_id}/ai-consumer", timeout=8)
    response.raise_for_status()
    info = response.json()
    stream_url = info.get("streamEndpoint") or info.get("directRtspUrl")
    if not stream_url:
        raise RuntimeError("Backend returned no streamEndpoint or directRtspUrl")
    return stream_url, camera_id, info.get("name", "Camera")


class MjpegStreamReader:
    """Read multipart MJPEG over HTTP and decode JPEG frames without FFmpeg."""
    def __init__(self, url, connect_timeout=8, read_timeout=20, max_frame_bytes=5 * 1024 * 1024):
        self.url = url
        self.timeout = (connect_timeout, read_timeout)
        self.max_frame_bytes = max_frame_bytes
        self.session = requests.Session()
        self.response = None
        self.iterator = None
        self.boundary = None
        self.buffer = bytearray()
        self.retry_delay = 1.0
        self.connection_generation = 0
        self.invalid_frames = 0

    def _close_response(self):
        if self.response is not None:
            self.response.close()
        self.response = None
        self.iterator = None
        self.boundary = None

    def _connect(self):
        self._close_response()
        print(f"[V2 Stream] Connecting: {self.url}")
        response = self.session.get(self.url, stream=True, timeout=self.timeout,
                                    headers={"Accept": "multipart/x-mixed-replace"})
        try:
            response.raise_for_status()
            content_type = response.headers.get("Content-Type", "")
            if "multipart" not in content_type.lower():
                raise RuntimeError(f"Expected multipart MJPEG, got {content_type!r}")
            parameters = content_type.split(";")[1:]
            boundary = next(
                (
                    value.split("=", 1)[1].strip().strip('"')
                    for value in parameters
                    if value.strip().lower().startswith("boundary=")
                ),
                "",
            )
            if not boundary:
                raise RuntimeError("MJPEG Content-Type is missing its multipart boundary")
        except (requests.RequestException, RuntimeError):
            response.close()
            raise
        self.response = response
        self.boundary = ("--" + boundary).encode("ascii")
        self.iterator = response.iter_content(chunk_size=8192)
        self.buffer.clear()
        self.retry_delay = 1.0
        self.connection_generation += 1
        print(f"[V2 Stream] HTTP {response.status_code}; {content_type}")

    def read_jpeg(self):
        while not STOP.is_set():
            if self.iterator is None:
                try:
                    self._connect()
                except (requests.RequestException, RuntimeError) as exc:
                    print(f"[V2 Stream] Connection failed: {exc}")
                    STOP.wait(self.retry_delay)
                    self.retry_delay = min(self.retry_delay * 2, 10.0)
                    continue
            boundary = self.boundary
            if boundary is None:
                raise RuntimeError("MJPEG stream is connected without a multipart boundary")

            boundary_at = self.buffer.find(boundary)
            if boundary_at < 0:
                preserve = len(boundary) + 4
                if len(self.buffer) > self.max_frame_bytes + 16_384:
                    self.buffer.clear()
                    self.invalid_frames += 1
                    print("[V2 Stream] Multipart data exceeded its size limit; resynchronizing")
                elif len(self.buffer) > preserve:
                    del self.buffer[:-preserve]
            elif boundary_at > 0:
                del self.buffer[:boundary_at]
            elif len(self.buffer) >= len(boundary) + 2:
                boundary_end = len(boundary)
                if self.buffer[boundary_end:boundary_end + 2] == b"--":
                    self._close_response()
                    self.buffer.clear()
                    print("[V2 Stream] Multipart stream ended; reconnecting")
                    STOP.wait(self.retry_delay)
                    self.retry_delay = min(self.retry_delay * 2, 10.0)
                    continue
                if self.buffer[boundary_end:boundary_end + 2] != b"\r\n":
                    del self.buffer[0]
                    self.invalid_frames += 1
                    continue

                header_start = boundary_end + 2
                header_end = self.buffer.find(b"\r\n\r\n", header_start)
                if header_end < 0:
                    if len(self.buffer) > 16_384:
                        del self.buffer[0]
                        self.invalid_frames += 1
                    else:
                        if not self._read_chunk():
                            continue
                    continue

                headers = {}
                for line in bytes(self.buffer[header_start:header_end]).decode("latin-1").split("\r\n"):
                    name, separator, value = line.partition(":")
                    if separator:
                        headers[name.strip().lower()] = value.strip()
                try:
                    content_length = int(headers.get("content-length", ""))
                except ValueError:
                    content_length = 0
                if (
                    headers.get("content-type", "").lower() != "image/jpeg"
                    or content_length <= 0
                    or content_length > self.max_frame_bytes
                ):
                    del self.buffer[0]
                    self.invalid_frames += 1
                    continue

                frame_start = header_end + 4
                frame_end = frame_start + content_length
                part_end = frame_end + 2
                next_boundary = self.buffer.find(boundary, frame_start)
                if next_boundary >= 0 and next_boundary < part_end:
                    del self.buffer[:next_boundary]
                    self.invalid_frames += 1
                    print("[V2 Stream] Content-Length overlaps the next part; dropping frame")
                    continue
                if len(self.buffer) < part_end:
                    if not self._read_chunk():
                        continue
                    continue

                jpeg = bytes(self.buffer[frame_start:frame_end])
                if self.buffer[frame_end:part_end] != b"\r\n":
                    del self.buffer[:frame_end]
                    self.invalid_frames += 1
                    continue
                del self.buffer[:part_end]
                if jpeg[:2] != b"\xff\xd8" or jpeg[-2:] != b"\xff\xd9":
                    self.invalid_frames += 1
                    print("[V2 Stream] Multipart part was not a complete JPEG; dropping frame")
                    continue
                return True, jpeg
            self._read_chunk()
        return False, None

    def _read_chunk(self):
        try:
            chunk = next(self.iterator)
            if not chunk:
                raise requests.RequestException("MJPEG stream ended")
            self.buffer.extend(chunk)
        except StopIteration:
            self._close_response()
            self.buffer.clear()
            print("[V2 Stream] Stream ended; reconnecting")
            STOP.wait(self.retry_delay)
            self.retry_delay = min(self.retry_delay * 2, 10.0)
            return False
        except (requests.RequestException, OSError, AttributeError, TypeError) as exc:
            self._close_response()
            self.buffer.clear()
            if not STOP.is_set():
                print(f"[V2 Stream] Read failed; reconnecting: {exc}")
            STOP.wait(self.retry_delay)
            self.retry_delay = min(self.retry_delay * 2, 10.0)
            return False
        return True

    def read(self):
        ok, jpeg = self.read_jpeg()
        if not ok:
            return False, None
        frame = cv2.imdecode(np.frombuffer(jpeg, dtype=np.uint8), cv2.IMREAD_COLOR)
        if frame is None:
            print("[V2 Stream] Invalid JPEG frame; skipping")
            return False, None
        return True, frame

    def close(self):
        self._close_response()
        self.session.close()


class LatestFrameBuffer:
    """Keep only the newest sampled frame while inference is busy."""

    def __init__(self):
        self._queue = queue.Queue(maxsize=1)
        self.dropped_frames = 0

    def publish(self, item):
        while True:
            try:
                self._queue.put_nowait(item)
                return
            except queue.Full:
                try:
                    self._queue.get_nowait()
                except queue.Empty:
                    continue
                self.dropped_frames += 1

    def get(self, timeout=0.25):
        return self._queue.get(timeout=timeout)

    def clear(self):
        while True:
            try:
                self._queue.get_nowait()
            except queue.Empty:
                return


class EventDispatcher:
    def __init__(self, api_url, secret):
        self.endpoint = api_url.rstrip("/") + "/api/events"
        self.secret = secret
        self.events = queue.Queue(maxsize=100)
        self.thread = threading.Thread(target=self._worker, daemon=True)

    def start(self):
        self.thread.start()

    def dispatch(self, event):
        try:
            self.events.put_nowait(event)
        except queue.Full:
            print("[Events] Queue full; event dropped")

    def _worker(self):
        headers = {"Content-Type": "application/json"}
        if self.secret:
            headers["X-Internal-Secret"] = self.secret
        else:
            print("[Events] WARNING: INTERNAL_SERVICE_KEY not found; expect HTTP 401.")
        with requests.Session() as session:
            while not STOP.is_set() or not self.events.empty():
                try:
                    event = self.events.get(timeout=0.5)
                except queue.Empty:
                    continue
                try:
                    for attempt in range(3):
                        try:
                            response = session.post(self.endpoint, json=event, headers=headers, timeout=4)
                        except requests.RequestException as exc:
                            print(f"[Events] Delivery attempt {attempt + 1} failed: {exc}")
                            if attempt < 2:
                                time.sleep(0.25 * (attempt + 1))
                            continue

                        if response.ok:
                            try:
                                result = response.json()
                            except ValueError as exc:
                                print(f"[Events] Backend returned invalid JSON: {exc}")
                            else:
                                print(
                                    f"[Events] Delivered {event['type']}; "
                                    f"broadcastedTo={result.get('broadcastedTo', 'unknown')}"
                                )
                            break

                        print(f"[Events] HTTP {response.status_code}: {response.text[:250]}")
                        if response.status_code < 500 and response.status_code != 429:
                            break
                        if attempt < 2:
                            time.sleep(0.25 * (attempt + 1))
                finally:
                    self.events.task_done()

    def close(self):
        self.thread.join(timeout=15)
        if self.thread.is_alive():
            print(f"[Events] Shutdown timed out with {self.events.qsize()} queued event(s)")


def normalize_keypoints(keypoints, width, height):
    if keypoints is None or len(keypoints) != 17 or width <= 0 or height <= 0:
        return None
    values = []
    for x, y, confidence in keypoints:
        values.extend([float(x) / width, float(y) / height, float(confidence)])
    result = np.asarray(values, dtype=np.float32)
    return result if result.shape == (51,) and np.isfinite(result).all() else None


def validate_metadata(metadata):
    if metadata.get("input_shape") != [16, 17, 3]:
        raise RuntimeError(f"Expected model input shape [16, 17, 3], got {metadata.get('input_shape')!r}")
    if metadata.get("features_per_frame") != 51:
        raise RuntimeError("Model metadata must declare 51 features per frame")
    if metadata.get("classes") != CLASSES:
        raise RuntimeError(f"Unexpected class order: {metadata.get('classes')!r}")
    expected_mapping = {name: index for index, name in enumerate(CLASSES)}
    if metadata.get("class_to_idx") != expected_mapping:
        raise RuntimeError("Model metadata class_to_idx does not match the required class order")


def classify_sequence(model, sequence, class_names):
    values = np.asarray(sequence, dtype=np.float32)
    if values.shape != (16, 51) or not np.isfinite(values).all():
        raise ValueError(f"Expected a finite (16, 51) pose sequence, got {values.shape}")

    try:
        model_device = next(model.parameters()).device
    except (AttributeError, StopIteration):
        model_device = torch.device("cpu")
    input_tensor = torch.from_numpy(values).unsqueeze(0).to(model_device)
    with torch.inference_mode():
        logits = model(input_tensor)
        if tuple(logits.shape) != (1, len(class_names)):
            raise RuntimeError(f"Unexpected model output shape: {tuple(logits.shape)}")
        probabilities = torch.softmax(logits, dim=1)[0]
    if not torch.isfinite(probabilities).all():
        raise RuntimeError("Model returned non-finite activity probabilities")
    return probabilities.cpu().numpy()


class FallEventGate:
    def __init__(self, confirmation_frames=3, threshold=0.75, cooldown=30.0):
        if confirmation_frames < 1:
            raise ValueError("confirmation_frames must be at least one")
        if not 0.0 < threshold <= 1.0:
            raise ValueError("threshold must be between 0 and 1")
        if cooldown < 0:
            raise ValueError("cooldown must not be negative")
        self.confirmation_frames = confirmation_frames
        self.threshold = threshold
        self.cooldown = cooldown
        self.samples = defaultdict(lambda: deque(maxlen=confirmation_frames))
        self.last_event = {}
        self.confirmed = set()

    def update(self, track_id, activity, fall_score, now):
        is_fall = activity in FALL_CLASSES and fall_score >= self.threshold
        if not is_fall:
            self.samples[track_id].clear()
            self.confirmed.discard(track_id)
            return False

        samples = self.samples[track_id]
        samples.append(True)
        if (
            len(samples) == self.confirmation_frames
            and all(samples)
            and track_id not in self.confirmed
            and (
                track_id not in self.last_event
                or now - self.last_event[track_id] >= self.cooldown
            )
        ):
            self.confirmed.add(track_id)
            self.last_event[track_id] = now
            return True
        return False

    def is_confirmed(self, track_id):
        return track_id in self.confirmed

    def reset(self, track_id):
        self.samples.pop(track_id, None)
        self.last_event.pop(track_id, None)
        self.confirmed.discard(track_id)

    def reset_all(self):
        self.samples.clear()
        self.last_event.clear()
        self.confirmed.clear()


def make_person_update(camera_id, camera_name, width, height, persons):
    return {
        "type": "person_detection_update",
        "cameraId": camera_id,
        "confidence": 1.0,
        "details": {
            "frameWidth": int(width),
            "frameHeight": int(height),
            "persons": persons,
            "cameraName": camera_name,
        },
    }


def make_status_event(camera_id, camera_name, status, metrics=None, annotated_stream_url=None):
    details = {
        "status": status,
        "cameraName": camera_name,
        "model": "VitalCare V2 TCN-Transformer",
        "poseModel": "YOLO11n-Pose",
    }
    if metrics:
        details["metrics"] = metrics
    if annotated_stream_url:
        details["annotatedStreamUrl"] = annotated_stream_url
    return {
        "type": "v2_agent_status",
        "cameraId": camera_id,
        "confidence": 1.0,
        "details": details,
    }


def extract_keypoints_array(keypoints_data, index, width, height):
    if keypoints_data is None or index >= len(keypoints_data):
        return None
    raw = keypoints_data[index]
    if raw is None or len(raw) != 17:
        return None
    points = []
    for x, y, conf in raw:
        x = float(x)
        y = float(y)
        conf = float(conf)
        if not (np.isfinite(x) and np.isfinite(y) and np.isfinite(conf)):
            return None
        x = max(0.0, min(float(width), x))
        y = max(0.0, min(float(height), y))
        conf = max(0.0, min(1.0, conf))
        points.append([x, y, conf])
    return points


def pose_has_minimum_visibility(keypoints, minimum_points=5, confidence_threshold=0.05):
    """Gate temporal classification on usable joints without suppressing boxes."""
    return (
        keypoints is not None
        and sum(1 for _, _, confidence in keypoints if confidence >= confidence_threshold) >= minimum_points
    )


def draw_person_overlay(frame, person, keypoint_conf_threshold=None):
    threshold = KEYPOINT_CONF_THRESHOLD if keypoint_conf_threshold is None else keypoint_conf_threshold
    box = person.get("box") or [0, 0, 0, 0]
    x1, y1, x2, y2 = [int(v) for v in box]
    state = person.get("state", "green")
    color = (0, 200, 0) if state == "green" else (0, 215, 255) if state == "yellow" else (0, 0, 255)
    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)

    keypoints = person.get("keypoints")
    if keypoints and len(keypoints) == 17:
        for a, b in SKELETON_CONNECTIONS:
            xa, ya, ca = keypoints[a]
            xb, yb, cb = keypoints[b]
            if ca >= threshold and cb >= threshold:
                cv2.line(frame, (int(xa), int(ya)), (int(xb), int(yb)), color, 2)
        for x, y, conf in keypoints:
            if conf >= threshold:
                cv2.circle(frame, (int(x), int(y)), 3, (255, 255, 255), -1)
                cv2.circle(frame, (int(x), int(y)), 3, color, 1)

    track_id = person.get("trackId")
    activity = person.get("activity")
    label = f"ID {track_id}" if track_id is not None else "Person"
    if activity:
        label += f" {activity}"
    conf = person.get("confidence")
    if isinstance(conf, (int, float)):
        label += f" {int(conf * 100)}%"
    cv2.putText(frame, label, (x1, max(18, y1 - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2, cv2.LINE_AA)


def start_annotated_stream_server(host, port):
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path not in ("/video_feed", "/annotated", "/"):
                self.send_error(404)
                return
            self.send_response(200)
            self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.send_header("Pragma", "no-cache")
            self.end_headers()
            try:
                while not STOP.is_set():
                    with annotated_frame_lock:
                        frame = latest_annotated_jpeg
                    if frame:
                        self.wfile.write(b"--frame\r\nContent-Type: image/jpeg\r\n")
                        self.wfile.write(f"Content-Length: {len(frame)}\r\n\r\n".encode("ascii"))
                        self.wfile.write(frame + b"\r\n")
                    time.sleep(0.04)
            except (BrokenPipeError, ConnectionResetError, OSError):
                pass

        def log_message(self, _format, *_args):
            return

    try:
        server = ThreadingHTTPServer((host, port), Handler)
    except OSError as exc:
        print(f"[V2 Annotated] Could not start annotated stream server on {host}:{port}: {exc}")
        return None, None

    thread = threading.Thread(target=server.serve_forever, name="v2-annotated-stream", daemon=True)
    thread.start()
    url = f"http://{host}:{port}/video_feed"
    print(f"[V2 Annotated] Serving annotated stream at {url}")
    return server, url


def main():
    global KEYPOINT_CONF_THRESHOLD, latest_annotated_jpeg
    parser = argparse.ArgumentParser(description="VitalCare V2 live inference over backend MJPEG")
    parser.add_argument("--camera-id", default=None)
    parser.add_argument("--stream-url", default=None)
    parser.add_argument("--api-url", default="http://localhost:5000")
    parser.add_argument("--pose-model", default=str(MODEL_DIR / "yolo11n-pose.pt"))
    parser.add_argument("--fps", type=float, default=3.0)
    parser.add_argument("--torch-threads", type=int, default=2)
    parser.add_argument("--confidence", type=float, default=0.4)
    parser.add_argument("--image-size", type=int, default=320)
    parser.add_argument("--fall-cooldown", type=float, default=30.0)
    parser.add_argument("--fall-threshold", type=float, default=0.75)
    parser.add_argument("--fall-confirmation-frames", type=int, default=3)
    parser.add_argument("--max-frames", type=int, default=0, help="Stop after this many sampled frames; 0 runs continuously")
    parser.add_argument("--device", default="auto", help="Inference device: auto, cpu, cuda, or cuda:N")
    parser.add_argument("--annotated-host", default="127.0.0.1", help="Host for optional annotated MJPEG stream")
    parser.add_argument("--annotated-port", type=int, default=0, help="Port for annotated MJPEG stream; 0 disables it")
    parser.add_argument("--keypoint-conf", type=float, default=0.2, help="Minimum keypoint confidence for skeleton rendering")
    args = parser.parse_args()
    if not 0 < args.fps <= 10:
        parser.error("--fps must be greater than 0 and at most 10")
    if not 0 < args.confidence <= 1:
        parser.error("--confidence must be greater than 0 and at most 1")
    if not 0 < args.fall_threshold <= 1:
        parser.error("--fall-threshold must be greater than 0 and at most 1")
    if args.torch_threads < 1:
        parser.error("--torch-threads must be at least one")
    if args.fall_confirmation_frames < 1:
        parser.error("--fall-confirmation-frames must be at least 1")
    if args.fall_cooldown < 0 or args.max_frames < 0:
        parser.error("--fall-cooldown and --max-frames must not be negative")
    requested_device = args.device.lower()
    if requested_device == "auto":
        device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
    else:
        try:
            device = torch.device(requested_device)
        except (RuntimeError, ValueError):
            parser.error("--device must be auto, cpu, cuda, or cuda:N")
        if device.type not in {"cpu", "cuda"}:
            parser.error("--device must be auto, cpu, cuda, or cuda:N")
        if device.type == "cuda" and not torch.cuda.is_available():
            parser.error("CUDA was requested, but CUDA is not available in this PyTorch environment")

    STOP.clear()
    def request_stop(_signum, _frame):
        print("[V2] Stop requested")
        STOP.set()

    signal.signal(signal.SIGINT, request_stop)
    signal.signal(signal.SIGTERM, request_stop)

    camera_id, camera_name, stream_url = args.camera_id or "unknown", "Camera", args.stream_url
    if not stream_url:
        stream_url, camera_id, camera_name = resolve_camera(args.api_url, args.camera_id)
    print(f"[V2] Camera: {camera_name} ({camera_id})")

    instance_lock = CameraInstanceLock(camera_id) if camera_id != "unknown" else None
    if instance_lock is not None and not instance_lock.acquire():
        raise RuntimeError(f"Another camera inference process already holds the lock for {camera_id}")
    if instance_lock is None:
        print("[V2] WARNING: --stream-url supplied without --camera-id; single-consumer lock is unavailable")

    torch.set_num_threads(args.torch_threads)
    torch.set_num_interop_threads(1)
    cv2.setNumThreads(1)
    KEYPOINT_CONF_THRESHOLD = max(0.0, min(1.0, float(args.keypoint_conf)))
    print(f"[V2] Inference device: {device}; CPU threads: torch={args.torch_threads}, interop=1, OpenCV=1")
    print("[V2] Loading trained TCN-Transformer...")
    v2_model, metadata = load_v2_model(model_dir=MODEL_DIR, device=device)
    validate_metadata(metadata)
    class_names = metadata["classes"]
    print("[V2] Loading YOLO11n-Pose...")
    pose_model = YOLO(args.pose_model)
    print("[V2] Warming up both models before live measurements...")
    pose_model.predict(
        np.zeros((args.image_size, args.image_size, 3), dtype=np.uint8),
        imgsz=args.image_size,
        device=str(device),
        classes=[0],
        conf=args.confidence,
        verbose=False,
    )
    classify_sequence(v2_model, np.zeros((16, 51), dtype=np.float32), class_names)

    stream = MjpegStreamReader(stream_url, read_timeout=20)
    dispatcher = EventDispatcher(args.api_url, load_secret())
    dispatcher.start()
    annotated_server = None
    annotated_stream_url = None
    if args.annotated_port:
        annotated_server, annotated_stream_url = start_annotated_stream_server(args.annotated_host, args.annotated_port)
    dispatcher.dispatch(make_status_event(camera_id, camera_name, "offline", annotated_stream_url=annotated_stream_url))
    buffers = defaultdict(lambda: deque(maxlen=16))
    last_seen, last_prediction, last_activity_sent = {}, {}, {}
    fall_gate = FallEventGate(
        confirmation_frames=args.fall_confirmation_frames,
        threshold=args.fall_threshold,
        cooldown=args.fall_cooldown,
    )
    frame_interval = 1.0 / args.fps
    latest_frames = LatestFrameBuffer()
    capture_stats_lock = threading.Lock()
    capture_stats = {"mjpeg_frames": 0, "last_frame_at": 0.0, "invalid_sampled_frames": 0}
    capture_stopped = threading.Event()

    def capture_frames():
        next_sample_at = 0.0
        try:
            while not STOP.is_set():
                ok, jpeg = stream.read_jpeg()
                if not ok:
                    break
                received_at = time.monotonic()
                with capture_stats_lock:
                    capture_stats["mjpeg_frames"] += 1
                    capture_stats["last_frame_at"] = received_at
                if received_at < next_sample_at:
                    continue
                next_sample_at = received_at + frame_interval
                try:
                    frame = cv2.imdecode(np.frombuffer(jpeg, dtype=np.uint8), cv2.IMREAD_COLOR)
                except cv2.error as exc:
                    print(f"[V2 Stream] JPEG decode failed: {exc}")
                    continue
                if frame is None:
                    with capture_stats_lock:
                        capture_stats["invalid_sampled_frames"] += 1
                    print("[V2 Stream] Invalid sampled JPEG frame; skipping")
                    continue
                latest_frames.publish((stream.connection_generation, received_at, frame))
        finally:
            capture_stopped.set()

    capture_thread = threading.Thread(target=capture_frames, name="v2-mjpeg-reader", daemon=True)
    capture_thread.start()
    last_detection_update = 0.0
    last_status = 0.0
    last_connection_generation = 0
    frame_count = 0
    agent_online = False
    last_source_frame_at = 0.0
    metrics_started_at = time.monotonic()
    cpu_started_at = time.process_time()
    last_mjpeg_frames = 0
    last_metric_inference_count = 0
    latency_samples = deque(maxlen=100)
    frame_age_samples = deque(maxlen=100)

    print("[V2] Live inference started (HTTP MJPEG reader; FFmpeg capture disabled)")
    print(f"[V2] Sampling rate: {args.fps} FPS")
    print(f"[V2] YOLO image size: {args.image_size}; bounded frame buffer: 1")
    print("[V2] Waiting for 16 pose frames per tracked person")
    try:
        while not STOP.is_set():
            try:
                generation, received_at, frame = latest_frames.get(timeout=0.25)
            except queue.Empty:
                with capture_stats_lock:
                    last_source_frame_at = capture_stats["last_frame_at"]
                if agent_online and last_source_frame_at and time.monotonic() - last_source_frame_at > 3.0:
                    dispatcher.dispatch(make_status_event(camera_id, camera_name, "offline", annotated_stream_url=annotated_stream_url))
                    agent_online = False
                    buffers.clear()
                    last_seen.clear()
                    last_prediction.clear()
                    last_activity_sent.clear()
                    fall_gate.reset_all()
                    latest_frames.clear()
                    last_detection_update = 0.0
                    print("[V2] MJPEG stalled; marked offline and cleared temporal state")
                if capture_stopped.is_set():
                    break
                continue

            now = time.monotonic()
            last_source_frame_at = received_at
            if generation != last_connection_generation:
                if last_connection_generation:
                    buffers.clear()
                    last_seen.clear()
                    last_prediction.clear()
                    last_activity_sent.clear()
                    fall_gate.reset_all()
                    last_detection_update = 0.0
                    print("[V2] MJPEG reconnected; cleared temporal and fall-confirmation buffers")
                last_connection_generation = generation

            frame_count += 1
            frame_age_samples.append(max(0.0, (now - received_at) * 1000.0))
            height, width = frame.shape[:2]
            inference_started = time.perf_counter()
            results = pose_model.track(frame, persist=True, tracker="bytetrack.yaml",
                                       imgsz=args.image_size, device=str(device), classes=[0],
                                       conf=args.confidence, verbose=False)
            result = results[0]
            boxes = result.boxes
            keypoints_data = result.keypoints.data.cpu().numpy() if result.keypoints is not None else []
            persons = []
            if boxes is not None:
                raw_ids = boxes.id.int().cpu().tolist() if boxes.id is not None else None
                coordinates = boxes.xyxy.cpu().numpy()
                detection_confidences = boxes.conf.cpu().numpy()
                detection_count = len(coordinates)
                track_ids = (
                    [track_id if track_id >= 0 else None for track_id in raw_ids]
                    if raw_ids is not None else [None] * detection_count
                )

                for index, track_id in enumerate(track_ids):
                    if (
                        index >= len(keypoints_data) or
                        index >= len(coordinates) or
                        index >= len(detection_confidences)
                    ):
                        continue
                    x1, y1, x2, y2 = coordinates[index].tolist()
                    box = [
                        max(0.0, min(float(width), float(x1))),
                        max(0.0, min(float(height), float(y1))),
                        max(0.0, min(float(width), float(x2))),
                        max(0.0, min(float(height), float(y2))),
                    ]
                    if box[2] <= box[0] or box[3] <= box[1]:
                        continue

                    keypoints = extract_keypoints_array(keypoints_data, index, width, height)
                    pose_eligible = pose_has_minimum_visibility(keypoints)
                    prediction = None
                    probabilities = None
                    pose = normalize_keypoints(keypoints_data[index], width, height) if pose_eligible else None
                    track_key = int(track_id) if track_id is not None else None
                    if track_key is not None and pose is not None:
                        if (
                            track_key in last_seen
                            and now - last_seen[track_key] > STALE_TRACK_SECONDS
                        ):
                            buffers.pop(track_key, None)
                            last_prediction.pop(track_key, None)
                            last_activity_sent.pop(track_key, None)
                            fall_gate.reset(track_key)
                            print(f"[V2] Track {track_key} resumed after interruption; reset temporal state")
                        last_seen[track_key] = now
                        buffers[track_key].append(pose)
                        if len(buffers[track_key]) == 16:
                            probabilities = classify_sequence(v2_model, list(buffers[track_key]), class_names)
                            class_index = int(np.argmax(probabilities))
                            predicted_class = class_names[class_index]
                            confidence = float(probabilities[class_index])
                            fall_score = float(probabilities[0] + probabilities[1])
                            fall_confirmed = fall_gate.update(track_key, predicted_class, fall_score, now)
                            probability_map = {
                                name: round(float(probabilities[i]), 5)
                                for i, name in enumerate(class_names)
                            }
                            prediction = {
                                "activity": predicted_class,
                                "confidence": confidence,
                                "classProbabilities": probability_map,
                            }

                            if last_prediction.get(track_key) != predicted_class:
                                print(
                                    f"[V2] Track {track_key}: {predicted_class} "
                                    f"(confidence={confidence:.3f}, fall_score={fall_score:.3f})"
                                )
                                last_prediction[track_key] = predicted_class

                            if (
                                predicted_class != last_activity_sent.get(track_key, (None,))[0]
                                or now - last_activity_sent.get(track_key, (None, 0.0))[1] >= 1.0
                            ):
                                dispatcher.dispatch({
                                    "type": "activity_classified",
                                    "cameraId": camera_id,
                                    "confidence": confidence,
                                    "details": {
                                        "trackId": track_key,
                                        "activity": predicted_class,
                                        "classProbabilities": probability_map,
                                        "frameWidth": width,
                                        "frameHeight": height,
                                        "box": box,
                                        "model": "VitalCare V2 TCN-Transformer",
                                        "poseModel": "YOLO11n-Pose",
                                    },
                                })
                                last_activity_sent[track_key] = (predicted_class, now)

                            if fall_confirmed:
                                dispatcher.dispatch({
                                    "type": "fall_detected",
                                    "cameraId": camera_id,
                                    "confidence": confidence,
                                    "details": {
                                        "trackId": track_key,
                                        "cameraName": camera_name,
                                        "activity": predicted_class,
                                        "fallScore": fall_score,
                                        "classProbabilities": probability_map,
                                        "model": "VitalCare V2 TCN-Transformer",
                                        "poseModel": "YOLO11n-Pose",
                                        "frameWidth": width,
                                        "frameHeight": height,
                                        "requiresHumanVerification": True,
                                    },
                                })
                                print(
                                    f"[V2 ALERT] {predicted_class} track={track_key}, "
                                    f"confidence={confidence:.3f}, fall_score={fall_score:.3f}"
                                )

                    if track_key is not None and fall_gate.is_confirmed(track_key):
                        state, reason = "red", "Fall confirmed; caregiver verification required"
                    elif prediction and prediction["activity"] in FALL_CLASSES:
                        fall_score = float(probabilities[0] + probabilities[1]) if probabilities is not None else 0.0
                        state = "yellow"
                        reason = f"Possible fall ({fall_score:.0%}); confirming"
                    elif prediction:
                        state = "green"
                        reason = f"V2 activity: {prediction['activity']}"
                    elif track_key is None:
                        state, reason = "yellow", "Person detected; waiting for a stable track ID"
                    else:
                        state, reason = "green", f"Collecting pose history ({len(buffers[track_key])}/16)"

                    person = {
                        "trackId": track_key,
                        "confidence": max(0.0, min(1.0, float(detection_confidences[index]))),
                        "state": state,
                        "reason": reason[:120],
                        "box": box,
                        "torsoAngle": None,
                    }
                    if keypoints is not None:
                        person["keypoints"] = keypoints
                    if prediction is not None:
                        person["activity"] = prediction["activity"]
                        person["activityConfidence"] = prediction["confidence"]
                    persons.append(person)

            if now - last_detection_update >= DETECTION_UPDATE_INTERVAL:
                dispatcher.dispatch(make_person_update(camera_id, camera_name, width, height, persons))
                last_detection_update = now

            if annotated_server is not None:
                try:
                    annotated = frame.copy()
                    for person in persons:
                        draw_person_overlay(annotated, person, KEYPOINT_CONF_THRESHOLD)
                    header = f"V2 {camera_name} | persons={len(persons)}"
                    cv2.putText(annotated, header, (12, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2, cv2.LINE_AA)
                    ok_jpeg, encoded = cv2.imencode(".jpg", annotated, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
                    if ok_jpeg:
                        with annotated_frame_lock:
                            latest_annotated_jpeg = encoded.tobytes()
                except Exception as exc:
                    print(f"[V2 Annotated] Frame render failed: {exc}")

            stale = [tid for tid, seen in last_seen.items() if now - seen > STALE_TRACK_SECONDS]
            for tid in stale:
                buffers.pop(tid, None)
                last_seen.pop(tid, None)
                last_prediction.pop(tid, None)
                last_activity_sent.pop(tid, None)
                fall_gate.reset(tid)

            if not agent_online or now - last_status >= AGENT_STATUS_INTERVAL:
                dispatcher.dispatch(make_status_event(camera_id, camera_name, "online", annotated_stream_url=annotated_stream_url))
                agent_online = True
                last_status = now

            latency_samples.append((time.perf_counter() - inference_started) * 1000.0)
            metric_now = time.monotonic()
            metric_elapsed = metric_now - metrics_started_at
            if metric_elapsed >= 10.0:
                with capture_stats_lock:
                    mjpeg_frames = capture_stats["mjpeg_frames"]
                    invalid_frames = capture_stats["invalid_sampled_frames"]
                camera_fps = (mjpeg_frames - last_mjpeg_frames) / metric_elapsed
                inference_fps = (frame_count - last_metric_inference_count) / metric_elapsed
                cpu_cores_used = (time.process_time() - cpu_started_at) / metric_elapsed
                cpu_percent = cpu_cores_used * 100.0 / max(os.cpu_count() or 1, 1)
                latency_sorted = sorted(latency_samples)
                age_sorted = sorted(frame_age_samples)
                latency_avg = sum(latency_sorted) / len(latency_sorted) if latency_sorted else 0.0
                age_avg = sum(age_sorted) / len(age_sorted) if age_sorted else 0.0
                metrics = {
                    "cameraFps": round(camera_fps, 2),
                    "inferenceFps": round(inference_fps, 2),
                    "cpuPercent": round(cpu_percent, 1),
                    "cpuCoresUsed": round(cpu_cores_used, 2),
                    "inferenceLatencyAvgMs": round(latency_avg, 2),
                    "inferenceLatencyP95Ms": round(latency_sorted[max(0, math.ceil(len(latency_sorted) * 0.95) - 1)], 2) if latency_sorted else 0.0,
                    "frameAgeAvgMs": round(age_avg, 2),
                    "droppedFrames": latest_frames.dropped_frames,
                    "invalidSampledFrames": invalid_frames,
                    "invalidMultipartFrames": stream.invalid_frames,
                }
                print("[V2 Metrics] " + " ".join(f"{key}={value}" for key, value in metrics.items()))
                if agent_online:
                    dispatcher.dispatch(make_status_event(camera_id, camera_name, "online", metrics))
                metrics_started_at = metric_now
                cpu_started_at = time.process_time()
                last_mjpeg_frames = mjpeg_frames
                last_metric_inference_count = frame_count
                latency_samples.clear()
                frame_age_samples.clear()

            if frame_count == 1:
                print(f"[V2] First frame received successfully: {width}x{height}")
                if not persons:
                    print("[V2] Frame received, but no person is currently tracked.")
            if args.max_frames and frame_count >= args.max_frames:
                break
    except KeyboardInterrupt:
        print("[V2] Stop requested")
    finally:
        if agent_online:
            dispatcher.dispatch(make_status_event(camera_id, camera_name, "offline", annotated_stream_url=annotated_stream_url))
        STOP.set()
        stream.close()
        if annotated_server is not None:
            try:
                annotated_server.shutdown()
                annotated_server.server_close()
            except Exception:
                pass
        capture_thread.join(timeout=6)
        if capture_thread.is_alive():
            print("[V2] MJPEG reader did not stop before timeout")
        dispatcher.close()
        if instance_lock is not None:
            instance_lock.release()
        print("[V2] Inference stopped cleanly")


if __name__ == "__main__":
    main()
