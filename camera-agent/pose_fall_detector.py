
import time
import math
import cv2
from ultralytics import YOLO

CAMERA_URL = "rtsp://172.30.58.96:5543/live/channel1"
MODEL_PATH = "yolo11n-pose.pt"

CONFIDENCE = 0.4
IMAGE_SIZE = 320

# Experimental thresholds; these need real-world testing.
HORIZONTAL_TORSO_DEG = 55
SUDDEN_DROP_RATIO = 0.08
CONFIRM_SECONDS = 1.2
TRACK_EXPIRY_SECONDS = 2.0
RECONNECT_DELAY_SECONDS = 2

# Store recent information separately for each tracked person.
person_history = {}


def midpoint(a, b):
    return (
        (a[0] + b[0]) / 2,
        (a[1] + b[1]) / 2,
    )


def connect_camera():
    print("Connecting to camera...")
    camera = cv2.VideoCapture(CAMERA_URL, cv2.CAP_FFMPEG)

    if camera.isOpened():
        print("Camera connected.")
        return camera

    camera.release()
    print("Camera connection failed.")
    return None


def main():
    global person_history

    print("Loading pose model...")
    model = YOLO(MODEL_PATH)

    camera = connect_camera()

    while camera is None:
        print("Retrying camera connection in 2 seconds...")
        time.sleep(RECONNECT_DELAY_SECONDS)
        camera = connect_camera()

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

                camera = connect_camera()

                while camera is None:
                    print("Reconnect failed. Retrying in 2 seconds...")
                    time.sleep(RECONNECT_DELAY_SECONDS)
                    camera = connect_camera()

                # Clear old track history after reconnecting.
                person_history.clear()
                continue

            now = time.time()
            height, width = frame.shape[:2]

            results = model.track(
                frame,
                persist=True,
                tracker="bytetrack.yaml",
                imgsz=IMAGE_SIZE,
                device="cpu",
                classes=[0],
                conf=CONFIDENCE,
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
