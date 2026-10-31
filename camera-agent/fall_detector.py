"""
camera-agent/fall_detector.py
VitalCare Experimental Fall-Cue Monitor
"""

import argparse
import os
import re
import sys
import time
import cv2
import requests
from ultralytics import YOLO

# Experimental settings; these require testing and tuning.
LOW_PERSON_HEIGHT = 0.65
LOW_POSITION_RATIO = 0.75
SUSPECT_SECONDS = 2.0


def sanitize_url(url: str) -> str:
    """Redacts credentials from RTSP/HTTP URLs for safe console output."""
    if not url:
        return ""
    return re.sub(r"://([^:@]+):([^@]+)@", r"://\1:***@", url)


def resolve_camera_config(api_url: str, camera_id: str | None = None) -> tuple[str, str, str]:
    """Resolves stream endpoint and camera info from the Node.js backend."""
    try:
        if not camera_id:
            resp = requests.get(f"{api_url}/api/cameras", timeout=4)
            if resp.status_code == 200:
                cameras = resp.json()
                if not cameras:
                    raise RuntimeError("No cameras found in database.")
                chosen = next((c for c in cameras if c.get("enabled")), cameras[0])
                camera_id = chosen["id"]
                camera_name = chosen.get("name", "Camera")
            else:
                raise RuntimeError(f"Failed to list cameras: HTTP {resp.status_code}")

        consumer_url = f"{api_url}/api/cameras/{camera_id}/ai-consumer"
        resp = requests.get(consumer_url, timeout=4)
        if resp.status_code == 200:
            info = resp.json()
            name = info.get("name", "Camera")
            stream_url = info.get("streamEndpoint") or info.get("directRtspUrl")
            if not stream_url:
                raise RuntimeError("No stream endpoint returned.")
            return stream_url, camera_id, name
        else:
            raise RuntimeError(f"Failed to fetch consumer info: HTTP {resp.status_code}")
    except Exception as exc:
        print(f"[Config Warning] Could not resolve camera from backend API: {exc}")
        return "", camera_id or "unknown", "Camera"


def main():
    parser = argparse.ArgumentParser(description="VitalCare Fall Cue Monitor")
    parser.add_argument("--camera-id", type=str, default=None, help="Camera ID to stream from")
    parser.add_argument("--stream-url", type=str, default=None, help="Override direct stream URL (RTSP or HTTP MJPEG)")
    parser.add_argument("--api-url", type=str, default="http://localhost:5000", help="Backend Node.js API URL")
    parser.add_argument("--model", type=str, default=None, help="Path to YOLO model")
    parser.add_argument("--confidence", type=float, default=0.4, help="Detection confidence threshold")
    parser.add_argument("--image-size", type=int, default=320, help="Inference image resolution")

    args = parser.parse_args()

    script_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = args.model
    if not model_path:
        local_model = os.path.join(script_dir, "models", "yolo11n.pt")
        model_path = local_model if os.path.exists(local_model) else "yolo11n.pt"

    stream_url = args.stream_url
    if not stream_url:
        resolved_url, _, _ = resolve_camera_config(args.api_url, args.camera_id)
        stream_url = resolved_url

    if not stream_url:
        print("[Startup Error] Could not determine a valid camera stream URL.")
        print("Please configure a camera in the dashboard or pass --stream-url <url>.")
        sys.exit(1)

    print(f"Loading YOLO model from {model_path}...")
    model = YOLO(model_path)

    redacted = sanitize_url(stream_url)
    print(f"Connecting to camera: {redacted}")
    camera = cv2.VideoCapture(stream_url, cv2.CAP_FFMPEG)

    if not camera.isOpened():
        print(f"ERROR: Could not open camera stream: {redacted}")
        return

    print("Experimental fall-cue monitor started.")
    print("This is NOT a confirmed fall detector. Press Q to stop.")

    suspect_start = None
    alert_shown = False

    try:
        while True:
            ok, frame = camera.read()

            if not ok:
                print("Camera frame unavailable; stopping safely.")
                break

            height, width = frame.shape[:2]
            results = model.predict(
                frame,
                imgsz=args.image_size,
                device="cpu",
                classes=[0],
                conf=args.confidence,
                verbose=False,
            )

            possible_fall_cue = False

            for box in results[0].boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                box_w = max(1, x2 - x1)
                box_h = max(1, y2 - y1)
                aspect_ratio = box_h / float(box_w)
                y_center_ratio = (y1 + y2) / (2.0 * height)

                is_low_height = aspect_ratio < LOW_PERSON_HEIGHT
                is_low_position = y_center_ratio > LOW_POSITION_RATIO

                if is_low_height or is_low_position:
                    possible_fall_cue = True
                    label = "POSSIBLE FALL CUE"
                    color = (0, 165, 255)
                else:
                    label = "Person"
                    color = (0, 255, 0)

                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                cv2.putText(
                    frame,
                    label,
                    (x1, max(20, y1 - 8)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.5,
                    color,
                    2,
                )

            if possible_fall_cue:
                if suspect_start is None:
                    suspect_start = time.time()

                elapsed = time.time() - suspect_start

                if elapsed >= SUSPECT_SECONDS and not alert_shown:
                    print(
                        "WARNING: Possible fall-like posture detected. "
                        "Please verify visually."
                    )
                    alert_shown = True
            else:
                suspect_start = None
                alert_shown = False

            cv2.imshow("Experimental Fall-Cue Monitor", frame)

            if cv2.waitKey(1) & 0xFF == ord("q"):
                break

    except KeyboardInterrupt:
        print("Stopping monitor...")

    finally:
        camera.release()
        cv2.destroyAllWindows()
        print("Camera released.")


if __name__ == "__main__":
    main()
