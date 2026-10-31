
import argparse
import math
import os
import re
import sys
import time
import cv2
import requests
from ultralytics import YOLO

# Experimental thresholds; these need real-world testing.
HORIZONTAL_TORSO_DEG = 55
SUDDEN_DROP_RATIO = 0.08
CONFIRM_SECONDS = 1.2
TRACK_EXPIRY_SECONDS = 2.0
RECONNECT_DELAY_SECONDS = 2

# Store recent information separately for each tracked person.
person_history = {}


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


def midpoint(a, b):
    return (
        (a[0] + b[0]) / 2,
        (a[1] + b[1]) / 2,
    )


def connect_camera(camera_url: str):
    redacted = sanitize_url(camera_url)
    print(f"Connecting to camera: {redacted}")
    camera = cv2.VideoCapture(camera_url, cv2.CAP_FFMPEG)

    if camera.isOpened():
        print("Camera connected.")
        return camera

    camera.release()
    print("Camera connection failed.")
    return None


def main():
    global person_history

    parser = argparse.ArgumentParser(description="VitalCare Pose Fall Detector")
    parser.add_argument("--camera-id", type=str, default=None, help="Camera ID to stream from")
    parser.add_argument("--stream-url", type=str, default=None, help="Override direct stream URL (RTSP or HTTP MJPEG)")
    parser.add_argument("--api-url", type=str, default="http://localhost:5000", help="Backend Node.js API URL")
    parser.add_argument("--model", type=str, default=None, help="Path to pose YOLO model")
    parser.add_argument("--confidence", type=float, default=0.4, help="Detection confidence threshold")
    parser.add_argument("--image-size", type=int, default=320, help="Inference image resolution")

    args = parser.parse_args()

    script_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = args.model
    if not model_path:
        local_model = os.path.join(script_dir, "models", "yolo11n-pose.pt")
        model_path = local_model if os.path.exists(local_model) else "yolo11n-pose.pt"

    stream_url = args.stream_url
    if not stream_url:
        resolved_url, _, _ = resolve_camera_config(args.api_url, args.camera_id)
        stream_url = resolved_url

    if not stream_url:
        print("[Startup Error] Could not determine a valid camera stream URL.")
        print("Please configure a camera in the dashboard or pass --stream-url <url>.")
        sys.exit(1)

    print(f"Loading pose model from {model_path}...")
    model = YOLO(model_path)

    camera = connect_camera(stream_url)

    while camera is None:
        print("Retrying camera connection in 2 seconds...")
        time.sleep(RECONNECT_DELAY_SECONDS)
        camera = connect_camera(stream_url)

    print("Experimental pose fall-cue monitor started.")
    print("Press Q in the video window to stop.")
    print("Orange means possible fall-like movement, not a confirmed fall.")

    try:
        while True:
            ok, frame = camera.read()

            if not ok:
                print("Camera frame lost. Reconnecting in 2 seconds...")
                camera.release()
                time.sleep(RECONNECT_DELAY_SECONDS)

                camera = connect_camera(stream_url)

                while camera is None:
                    print("Reconnect failed. Retrying in 2 seconds...")
                    time.sleep(RECONNECT_DELAY_SECONDS)
                    camera = connect_camera(stream_url)

                # Clear old track history after reconnecting.
                person_history.clear()
                continue

            now = time.time()
            height, width = frame.shape[:2]

            results = model.track(
                frame,
                persist=True,
                tracker="bytetrack.yaml",
                imgsz=args.image_size,
                device="cpu",
                classes=[0],
                conf=args.confidence,
                verbose=False,
            )

            result = results[0]

            if result.keypoints is not None and result.boxes is not None:
                for i, box in enumerate(result.boxes):
                    x1, y1, x2, y2 = map(
                        int, box.xyxy[0].tolist()
                    )
                    points = result.keypoints.xy[i].cpu().tolist()

                    scores = (
                        result.keypoints.conf[i].cpu().tolist()
                        if result.keypoints.conf is not None
                        else None
                    )

                    track_id = None
                    if box.id is not None:
                        track_id = int(box.id[0])

                    color = (0, 255, 0)
                    label = (
                        f"Person ID:{track_id}"
                        if track_id is not None
                        else "Person"
                    )
                    person_cue = False

                    # COCO pose landmarks:
                    # 5/6 = shoulders; 11/12 = hips.
                    required = [5, 6, 11, 12]

                    valid = all(
                        len(points) > k
                        and points[k][0] > 0
                        and points[k][1] > 0
                        and (
                            scores is None
                            or scores[k] > 0.35
                        )
                        for k in required
                    )

                    if valid and track_id is not None:
                        shoulders = midpoint(points[5], points[6])
                        hips = midpoint(points[11], points[12])

                        dx = hips[0] - shoulders[0]
                        dy = hips[1] - shoulders[1]

                        torso_angle = math.degrees(
                            math.atan2(abs(dx), abs(dy) + 1e-6)
                        )

                        center_y = (y1 + y2) / 2

                        history = person_history.setdefault(
                            track_id,
                            {
                                "previous_y": center_y,
                                "previous_time": now,
                                "cue_start": None,
                                "last_warning": 0,
                            },
                        )

                        elapsed = now - history["previous_time"]

                        sudden_drop = (
                            0 < elapsed <= 1.0
                            and center_y - history["previous_y"]
                            > height * SUDDEN_DROP_RATIO
                        )

                        horizontal_torso = (
                            torso_angle > HORIZONTAL_TORSO_DEG
                        )
                        low_on_screen = center_y / height > 0.65

                        person_cue = horizontal_torso and (
                            sudden_drop or low_on_screen
                        )

                        history["previous_y"] = center_y
                        history["previous_time"] = now

                        if person_cue:
                            if history["cue_start"] is None:
                                history["cue_start"] = now

                            if (
                                now - history["cue_start"]
                                >= CONFIRM_SECONDS
                                and now - history["last_warning"] >= 5
                            ):
                                print(
                                    f"Possible fall-like posture for "
                                    f"person ID {track_id}. "
                                    "Please verify visually."
                                )
                                history["last_warning"] = now
                        else:
                            history["cue_start"] = None

                        if person_cue:
                            color = (0, 165, 255)
                            label = f"Possible fall? ID:{track_id}"

                        cv2.line(
                            frame,
                            (int(shoulders[0]), int(shoulders[1])),
                            (int(hips[0]), int(hips[1])),
                            (255, 0, 0),
                            2,
                        )

                    cv2.rectangle(
                        frame, (x1, y1), (x2, y2), color, 2
                    )
                    cv2.putText(
                        frame,
                        label,
                        (x1, max(20, y1 - 8)),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.45,
                        color,
                        2,
                    )

            # Remove stale tracking histories.
            for track_id in list(person_history):
                if (
                    now - person_history[track_id]["previous_time"]
                    > TRACK_EXPIRY_SECONDS
                ):
                    del person_history[track_id]

            cv2.imshow("Eldercare Pose Fall-Cue Test", frame)

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
