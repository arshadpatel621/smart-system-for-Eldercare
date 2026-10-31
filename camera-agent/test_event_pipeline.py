"""
camera-agent/test_event_pipeline.py
Automated test suite for Phase 2: YOLO Person Tracker & Event Pipeline
"""

import os
import sys
import numpy as np
import cv2

# Import functions from person_tracker
from person_tracker import (
    load_internal_secret,
    sanitize_url,
    EventDispatcher,
)
from ultralytics import YOLO


def test_sanitize_url():
    raw_rtsp = "rtsp://admin:SecretPass123!@192.168.1.100:554/cam/realmonitor"
    sanitized = sanitize_url(raw_rtsp)
    assert "SecretPass123!" not in sanitized, "Password leaked in sanitized URL!"
    assert "rtsp://admin:***@192.168.1.100:554/cam/realmonitor" == sanitized, f"Unexpected: {sanitized}"
    print(" [PASS] test_sanitize_url")


def test_load_internal_secret():
    secret = load_internal_secret()
    assert secret, "Failed to load INTERNAL_SERVICE_KEY from server/.env"
    assert len(secret) >= 16, "Secret key unexpectedly short"
    print(f" [PASS] test_load_internal_secret (Length: {len(secret)} chars)")


def test_yolo_model_loading_and_detection():
    model_path = os.path.join(os.path.dirname(__file__), "models", "yolo11n.pt")
    assert os.path.isfile(model_path), f"Model file not found: {model_path}"
    model = YOLO(model_path)

    # Create synthetic test frame (blank image)
    blank_frame = np.zeros((480, 640, 3), dtype=np.uint8)
    res_blank = model.track(
        blank_frame,
        persist=True,
        classes=[0],
        imgsz=320,
        device="cpu",
        verbose=False,
    )[0]
    # Blank frame should detect 0 persons
    count_blank = len(res_blank.boxes) if res_blank.boxes is not None else 0
    assert count_blank == 0, f"Expected 0 persons on blank frame, got {count_blank}"

    # Test on bus.jpg if present or create an image with shapes
    bus_path = os.path.join(os.path.dirname(__file__), "scratch_bus.jpg")
    if os.path.isfile(bus_path):
        bus_frame = cv2.imread(bus_path)
        res_bus = model.track(
            bus_frame,
            persist=True,
            classes=[0],
            imgsz=320,
            device="cpu",
            verbose=False,
        )[0]
        count_bus = len(res_bus.boxes) if res_bus.boxes is not None else 0
        assert count_bus > 0, "Expected person detection on test image"
        print(f" [PASS] test_yolo_model_loading_and_detection ({count_bus} person(s) detected)")
    else:
        print(" [PASS] test_yolo_model_loading_and_detection (blank frame verified)")


def test_event_dispatcher_queuing():
    # Test queueing mechanism without network calls
    dispatcher = EventDispatcher(api_url="http://127.0.0.1:5000", secret="test-secret")
    payload = {
        "type": "person_detected",
        "cameraId": "test-cam",
        "confidence": 0.95,
        "details": {"personCount": 1, "trackIds": [101]},
    }
    dispatcher.dispatch(payload)
    assert not dispatcher.queue.empty(), "Event was not queued in dispatcher"
    item = dispatcher.queue.get_nowait()
    assert item["type"] == "person_detected"
    assert item["confidence"] == 0.95
    print(" [PASS] test_event_dispatcher_queuing")


if __name__ == "__main__":
    print("=== Running Phase 2 Python Unit Tests ===")
    test_sanitize_url()
    test_load_internal_secret()
    test_yolo_model_loading_and_detection()
    test_event_dispatcher_queuing()
    print("=== All Python Unit Tests Passed Successfully ===")
