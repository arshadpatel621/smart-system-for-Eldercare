
import cv2
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from ultralytics import YOLO

CAMERA_URL = "rtsp://172.30.58.96:5543/live/channel1"
MODEL_PATH = "yolo11n.pt"
CONFIDENCE = 0.4
IMAGE_SIZE = 320
PORT = 8001

latest_frame = None
frame_lock = threading.Lock()
running = True


def detect_people():
    global latest_frame, running
    camera = None

    try:
        print("Loading YOLO model...")
        model = YOLO(MODEL_PATH)

        print("Connecting to camera...")
        camera = cv2.VideoCapture(CAMERA_URL, cv2.CAP_FFMPEG)

        if not camera.isOpened():
            print("ERROR: Could not open camera stream.")
            running = False
            return

        print("Camera connected. Annotated video: http://localhost:8001/video_feed")

        while running:
            ok, frame = camera.read()
            if not ok:
                print("Frame lost. Reconnecting...")
                camera.release()
                time.sleep(2)
                camera = cv2.VideoCapture(CAMERA_URL, cv2.CAP_FFMPEG)
                continue

            result = model.track(
                frame, persist=True, classes=[0],
                imgsz=IMAGE_SIZE, conf=CONFIDENCE,
                device="cpu", verbose=False
            )[0]

            count = 0
            if result.boxes is not None:
                for box in result.boxes:
                    x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                    track_id = int(box.id[0]) if box.id is not None else None
                    label = f"Person ID:{track_id}" if track_id is not None else "Person"
                    count += 1
                    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                    cv2.putText(
                        frame, label, (x1, max(20, y1 - 8)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2
                    )

            cv2.putText(
                frame, f"PERSON DETECTION: {count}",
                (15, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7,
                (0, 255, 0), 2
            )

            ok, encoded = cv2.imencode(".jpg", frame)
            if ok:
                with frame_lock:
                    latest_frame = encoded.tobytes()

    except Exception as exc:
        print("Person tracker error:", exc)
        running = False
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
            while True:
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


if __name__ == "__main__":
    threading.Thread(target=detect_people, daemon=True).start()
    print(f"Video server starting on port {PORT}")
    try:
        ThreadingHTTPServer(("0.0.0.0", PORT), VideoHandler).serve_forever()
    except KeyboardInterrupt:
        running = False
