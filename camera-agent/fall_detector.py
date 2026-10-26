
import time
import cv2
from ultralytics import YOLO

CAMERA_URL = "rtsp://172.30.58.96:5543/live/channel1"
MODEL_PATH = "yolo11n.pt"

CONFIDENCE = 0.4
IMAGE_SIZE = 320

# Experimental settings; these require testing and tuning.
LOW_PERSON_HEIGHT = 0.65
LOW_POSITION_RATIO = 0.75
SUSPECT_SECONDS = 2.0


def main():
    model = YOLO(MODEL_PATH)
    camera = cv2.VideoCapture(CAMERA_URL, cv2.CAP_FFMPEG)

    if not camera.isOpened():
        print("ERROR: Could not open camera stream.")
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
                imgsz=IMAGE_SIZE,
                device="cpu",
                classes=[0],
                conf=CONFIDENCE,
                verbose=False,
            )

            possible_fall_cue = False

            for box in results[0].boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())

                person_width = max(1, x2 - x1)
                person_height = max(1, y2 - y1)
                aspect_ratio = person_width / person_height
                bottom_position = y2 / max(1, height)

                # A wide, low-position box is only a visual cue.
                # It cannot confirm that a person has fallen.
                if (
                    aspect_ratio > 1.0 / LOW_PERSON_HEIGHT
                    and bottom_position > LOW_POSITION_RATIO
                ):
                    possible_fall_cue = True
                    color = (0, 165, 255)
                    label = "Possible fall cue - verify"
                else:
                    color = (0, 255, 0)
                    label = "Person"

                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                cv2.putText(
                    frame,
                    label,
                    (x1, max(20, y1 - 8)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.45,
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
