"""
camera-agent/person_tracker.py
VitalCare Local YOLO Person Tracking & Event Dispatcher Service

Consumes a camera stream (direct RTSP or Node.js MJPEG proxy), runs YOLO
tracking for person detection (class 0), serves an annotated MJPEG stream on
HTTP port 8001, and securely dispatches real detection events to the Node.js
backend event pipeline (POST /api/events) with rate-limiting and deduplication.
"""

import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import os
import queue
import re
import sys
import threading
import time
import cv2
import requests
from ultralytics import YOLO

latest_frame = None
frame_lock = threading.Lock()
running = True


def sanitize_url(url: str) -> str:
    """Redacts credentials from RTSP/HTTP URLs for safe console output."""
    if not url:
        return ""
    return re.sub(r"://([^:@]+):([^@]+)@", r"://\1:***@", url)


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
    frame acquisition or YOLO inference.
    """

    def __init__(self, api_url: str, secret: str, max_queue: int = 20):
        self.api_url = api_url.rstrip("/")
        self.secret = secret
        self.queue = queue.Queue(maxsize=max_queue)
        self.worker = threading.Thread(target=self._run, daemon=True, name="EventDispatcherWorker")
        self._last_warn_time = 0.0

    def start(self):
        self.worker.start()

    def dispatch(self, event_payload: dict):
        """Queues an event. If full, drops the oldest item to preserve real-time updates."""
        try:
            self.queue.put_nowait(event_payload)
        except queue.Full:
            try:
                self.queue.get_nowait()
                self.queue.put_nowait(event_payload)
            except Exception:
                pass

    def _run(self):
        endpoint = f"{self.api_url}/api/events"
        while running:
            try:
                event = self.queue.get(timeout=1.0)
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
                self.queue.task_done()


def resolve_camera_config(
    api_url: str,
    camera_id: str | None = None,
    secret: str = "",
    prefer_direct_rtsp: bool = True
) -> tuple[str, str, str]:
    """
    Resolves the camera stream URL and metadata from the backend API.
    Returns: (stream_url, camera_id, camera_name)
    """
    try:
        # If camera_id was not provided, fetch the active/enabled camera
        if not camera_id:
            print(f"[Config] Querying available cameras from {api_url}/api/cameras...")
            resp = requests.get(f"{api_url}/api/cameras", timeout=4)
            if resp.status_code == 200:
                cameras = resp.json()
                if not cameras:
                    raise RuntimeError("No cameras registered in the database.")

                # Pick first enabled camera, or first overall
                chosen = next((c for c in cameras if c.get("enabled")), cameras[0])
                camera_id = chosen["id"]
                camera_name = chosen.get("name", "Camera")
                print(f"[Config] Selected camera: {camera_name} (ID: {camera_id})")
            else:
                raise RuntimeError(f"Failed to list cameras: HTTP {resp.status_code}")

        # Fetch consumer info for this specific camera, presenting internal secret
        consumer_url = f"{api_url}/api/cameras/{camera_id}/ai-consumer"
        headers = {}
        if secret:
            headers["X-Internal-Secret"] = secret

        print(f"[Config] Fetching stream endpoint from {consumer_url}...")
        resp = requests.get(consumer_url, headers=headers, timeout=4)
        if resp.status_code == 200:
            info = resp.json()
            camera_name = info.get("name", "Camera")
            direct_rtsp = info.get("directRtspUrl")
            mjpeg_endpoint = info.get("streamEndpoint")

            if prefer_direct_rtsp and direct_rtsp:
                stream_url = direct_rtsp
                print("[Config] Selected direct RTSP stream.")
            else:
                stream_url = mjpeg_endpoint or direct_rtsp
                print("[Config] Selected backend MJPEG stream proxy.")

            if not stream_url:
                raise RuntimeError(f"No stream endpoint returned for camera {camera_id}")
            return stream_url, camera_id, camera_name
        else:
            raise RuntimeError(f"Failed to get AI consumer config: HTTP {resp.status_code}")

    except Exception as exc:
        print(f"[Config Warning] Could not resolve camera from backend API: {exc}")
        return "", camera_id or "unknown", "Camera"


def detect_people(
    stream_url: str,
    model_path: str,
    confidence: float,
    image_size: int,
    camera_id: str,
    camera_name: str,
    dispatcher: EventDispatcher,
    throttle_interval: float = 2.0,
    cooldown: float = 0.5,
):
    global latest_frame, running
    camera = None

    try:
        print(f"[YOLO] Loading model from {model_path}...")
        if not os.path.exists(model_path):
            local_fallback = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models", "yolo11n.pt")
            model_path = local_fallback if os.path.exists(local_fallback) else "yolo11n.pt"

        model = YOLO(model_path)
        print(f"[YOLO] Model loaded successfully: {model_path}")

        redacted_url = sanitize_url(stream_url)
        print(f"[Stream] Connecting to camera: {redacted_url}")
        camera = cv2.VideoCapture(stream_url, cv2.CAP_FFMPEG)

        # Connection retry loop with backoff if initially unreachable
        retry_delay = 5
        while running and not camera.isOpened():
            print(f"[Stream Warning] Could not open camera stream: {redacted_url}")
            print(f"[Stream Warning] Camera may be offline or starting up. Retrying in {retry_delay}s...")
            time.sleep(retry_delay)
            if not running:
                return
            camera = cv2.VideoCapture(stream_url, cv2.CAP_FFMPEG)

        if not running:
            return

        print(f"[Stream Ready] Camera connected. Annotated feed at http://localhost:8001/video_feed")

        # Throttling & deduplication tracking state
        last_event_time = 0.0
        last_person_count = 0
        last_track_ids: set[int] = set()

        while running:
            ok, frame = camera.read()
            if not ok:
                print("[Stream] Frame read failed. Reconnecting in 3s...")
                camera.release()
                time.sleep(3)
                if not running:
                    break
                camera = cv2.VideoCapture(stream_url, cv2.CAP_FFMPEG)
                continue

            try:
                result = model.track(
                    frame,
                    persist=True,
                    classes=[0],  # class 0 = person
                    imgsz=image_size,
                    conf=confidence,
                    device="cpu",
                    verbose=False,
                )[0]
            except Exception as inference_err:
                print(f"[YOLO Inference Warning] Error during frame inference: {inference_err}")
                continue

            boxes_info = []
            confidences = []
            current_track_ids: set[int] = set()

            if result.boxes is not None:
                for box in result.boxes:
                    x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                    conf = float(box.conf[0]) if box.conf is not None else 0.0
                    track_id = int(box.id[0]) if box.id is not None else None

                    confidences.append(conf)
                    if track_id is not None:
                        current_track_ids.add(track_id)

                    boxes_info.append({
                        "trackId": track_id,
                        "confidence": round(conf, 3),
                        "box": [x1, y1, x2, y2],
                    })

                    label = f"Person ID:{track_id}" if track_id is not None else f"Person {conf:.2f}"
                    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                    cv2.putText(
                        frame,
                        label,
                        (x1, max(20, y1 - 8)),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.5,
                        (0, 255, 0),
                        2,
                    )

            count = len(boxes_info)
            max_conf = max(confidences) if confidences else 0.0
            now = time.time()
            new_tracks = current_track_ids - last_track_ids

            should_send = False

            if count > 0:
                # Event Trigger A: Person count changed (e.g. 0 -> 1 or 1 -> 2)
                if count != last_person_count and (now - last_event_time >= cooldown):
                    should_send = True
                # Event Trigger B: A new tracked person entered the view
                elif new_tracks and (now - last_event_time >= cooldown):
                    should_send = True
                # Event Trigger C: Periodic presence update while persons remain in scene
                elif now - last_event_time >= throttle_interval:
                    should_send = True

            elif last_person_count > 0 and (now - last_event_time >= cooldown):
                # Scene cleared (person departed): send single clear event
                should_send = True

            if should_send:
                event_payload = {
                    "type": "person_detected",
                    "cameraId": camera_id,
                    "confidence": round(max_conf, 2),
                    "details": {
                        "personCount": count,
                        "trackIds": sorted(list(current_track_ids)),
                        "boxes": boxes_info,
                        "cameraName": camera_name,
                    },
                }
                dispatcher.dispatch(event_payload)
                last_event_time = now
                last_person_count = count
                last_track_ids = current_track_ids

            # Overlay status banner
            header = f"[{camera_name}] PERSON DETECTION: {count}"
            cv2.putText(
                frame,
                header,
                (15, 30),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (0, 255, 0),
                2,
            )

            ok, encoded = cv2.imencode(".jpg", frame)
            if ok:
                with frame_lock:
                    latest_frame = encoded.tobytes()

    except Exception as exc:
        print("[Tracker Error]", exc)
    finally:
        if camera is not None:
            camera.release()


class VideoHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/video_feed":
            self.send_error(404)
            return

        self.send_response(200)
        self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Access-Control-Allow-Origin", "*")
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
    parser = argparse.ArgumentParser(description="VitalCare YOLO Person Tracker & Event Dispatcher")
    parser.add_argument("--camera-id", type=str, default=None, help="Camera ID to stream from")
    parser.add_argument("--stream-url", type=str, default=None, help="Override direct stream URL (RTSP or HTTP MJPEG)")
    parser.add_argument("--api-url", type=str, default="http://localhost:5000", help="Backend Node.js API URL")
    parser.add_argument("--internal-secret", type=str, default=None, help="Internal service key for backend auth")
    parser.add_argument("--model", type=str, default=None, help="Path to YOLO model weights")
    parser.add_argument("--confidence", type=float, default=0.4, help="Detection confidence threshold")
    parser.add_argument("--image-size", type=int, default=320, help="Inference image resolution")
    parser.add_argument("--port", type=int, default=8001, help="Annotated video HTTP server port")
    parser.add_argument("--throttle-interval", type=float, default=2.0, help="Periodic presence event interval (seconds)")
    parser.add_argument("--cooldown", type=float, default=0.5, help="Minimum gap between consecutive events (seconds)")
    parser.add_argument(
        "--prefer-mjpeg-proxy",
        action="store_true",
        help="Prefer Node.js MJPEG proxy stream endpoint over direct RTSP",
    )

    args = parser.parse_args()

    # Load internal secret securely
    internal_secret = load_internal_secret(args.internal_secret)

    # Initialize and start event dispatcher
    dispatcher = EventDispatcher(api_url=args.api_url, secret=internal_secret)
    dispatcher.start()

    # Determine default model path
    script_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = args.model
    if not model_path:
        local_model = os.path.join(script_dir, "models", "yolo11n.pt")
        model_path = local_model if os.path.exists(local_model) else "yolo11n.pt"

    # Resolve stream URL and camera metadata
    stream_url = args.stream_url
    camera_id = args.camera_id or "cam-1"
    camera_name = "Camera"

    if not stream_url:
        resolved_url, resolved_id, name = resolve_camera_config(
            api_url=args.api_url,
            camera_id=args.camera_id,
            secret=internal_secret,
            prefer_direct_rtsp=not args.prefer_mjpeg_proxy,
        )
        stream_url = resolved_url
        camera_id = resolved_id
        camera_name = name

    if not stream_url:
        print("[Startup Warning] Could not resolve a valid camera stream URL from backend API.")
        print("Running in standby: video server active on port, retrying connection...")
        stream_url = f"{args.api_url}/api/cameras/{camera_id}/stream"

    # Start detection worker thread
    worker = threading.Thread(
        target=detect_people,
        args=(
            stream_url,
            model_path,
            args.confidence,
            args.image_size,
            camera_id,
            camera_name,
            dispatcher,
            args.throttle_interval,
            args.cooldown,
        ),
        daemon=True,
        name="YOLODetectorWorker",
    )
    worker.start()

    print(f"[Server] Video server starting on port {args.port}...")
    try:
        server = ThreadingHTTPServer(("0.0.0.0", args.port), VideoHandler)
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[Server] Shutting down gracefully...")
        running = False


if __name__ == "__main__":
    main()
