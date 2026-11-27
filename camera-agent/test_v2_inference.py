import sys
import unittest
from pathlib import Path
from unittest.mock import patch

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))

from v2_inference import (  # noqa: E402
    CLASSES,
    STOP,
    FallEventGate,
    LatestFrameBuffer,
    MjpegStreamReader,
    classify_sequence,
    load_v2_model,
    make_person_update,
    normalize_keypoints,
    pose_has_minimum_visibility,
    validate_metadata,
)


class FakeMjpegResponse:
    status_code = 200
    headers = {"Content-Type": "multipart/x-mixed-replace; boundary=frame"}

    def __init__(self, jpeg):
        self.jpeg = jpeg
        self.body = (
            b"--frame\r\nContent-Type: image/jpeg\r\n"
            + f"Content-Length: {len(jpeg)}\r\n\r\n".encode("ascii")
            + jpeg
            + b"\r\n"
        )

    def raise_for_status(self):
        return None

    def iter_content(self, chunk_size):
        return iter([self.body[:13], self.body[13:49], self.body[49:]])

    def close(self):
        return None


class V2InferenceTests(unittest.TestCase):
    def setUp(self):
        STOP.clear()

    def test_normalize_keypoints_preserves_expected_feature_shape(self):
        points = np.array([[10.0, 20.0, 0.8]] * 17, dtype=np.float32)
        normalized = normalize_keypoints(points, 100, 200)

        self.assertEqual(normalized.shape, (51,))
        self.assertTrue(np.allclose(normalized[:3], [0.1, 0.1, 0.8]))
        self.assertIsNone(normalize_keypoints(points[:16], 100, 200))

    def test_low_visibility_pose_disables_temporal_input_but_keeps_detection_eligible(self):
        occluded = [[20.0, 30.0, 0.01] for _ in range(17)]
        occluded[:4] = [[20.0, 30.0, 0.8] for _ in range(4)]
        self.assertFalse(pose_has_minimum_visibility(occluded))
        occluded[4] = [20.0, 30.0, 0.8]
        self.assertTrue(pose_has_minimum_visibility(occluded))

    def test_metadata_and_trained_model_produce_all_ten_probabilities(self):
        model, metadata = load_v2_model(
            Path(__file__).resolve().parent / "models",
            device="cpu",
        )
        validate_metadata(metadata)

        probabilities = classify_sequence(model, np.zeros((16, 51), dtype=np.float32), CLASSES)

        self.assertEqual(probabilities.shape, (10,))
        self.assertTrue(np.isfinite(probabilities).all())
        self.assertAlmostEqual(float(probabilities.sum()), 1.0, places=5)

    def test_fall_requires_consecutive_confirmation_and_respects_cooldown(self):
        gate = FallEventGate(confirmation_frames=3, threshold=0.75, cooldown=30)

        self.assertFalse(gate.update(7, "FALLEN", 0.9, 10.0))
        self.assertFalse(gate.update(7, "STANDING", 0.1, 10.3))
        self.assertFalse(gate.update(7, "FALL", 0.8, 10.6))
        self.assertFalse(gate.update(7, "FALL", 0.8, 10.9))
        self.assertTrue(gate.update(7, "FALLEN", 0.9, 11.2))
        self.assertTrue(gate.is_confirmed(7))

        gate.update(7, "STANDING", 0.0, 12.0)
        self.assertFalse(gate.update(7, "FALLEN", 0.9, 12.3))
        self.assertFalse(gate.update(7, "FALLEN", 0.9, 12.6))
        self.assertFalse(gate.update(7, "FALLEN", 0.9, 12.9))
        self.assertTrue(gate.update(7, "FALLEN", 0.9, 41.3))

    def test_person_update_contains_backend_required_fields(self):
        event = make_person_update(
            "camera-1",
            "living",
            640,
            480,
            [{
                "trackId": 2,
                "confidence": 0.91,
                "state": "green",
                "reason": "Collecting pose history (3/16)",
                "box": [10.0, 20.0, 100.0, 200.0],
                "torsoAngle": None,
            }],
        )
        person = event["details"]["persons"][0]

        self.assertEqual((event["details"]["frameWidth"], event["details"]["frameHeight"]), (640, 480))
        self.assertEqual(
            {"trackId", "confidence", "state", "reason", "box", "torsoAngle"},
            set(person),
        )

    def test_latest_frame_buffer_drops_stale_pending_frames(self):
        frame_buffer = LatestFrameBuffer()
        frame_buffer.publish("first")
        frame_buffer.publish("stale")
        frame_buffer.publish("latest")

        self.assertEqual(frame_buffer.get(timeout=0.01), "latest")
        self.assertEqual(frame_buffer.dropped_frames, 2)

    def test_mjpeg_reader_reconnects_after_stream_end(self):
        ok, encoded = cv2.imencode(".jpg", np.zeros((16, 16, 3), dtype=np.uint8))
        self.assertTrue(ok)
        response1 = FakeMjpegResponse(encoded.tobytes())
        response2 = FakeMjpegResponse(encoded.tobytes())
        session = type("FakeSession", (), {
            "get": lambda *_args, **_kwargs: next(responses),
            "close": lambda *_args: None,
        })()
        responses = iter([response1, response2])

        with patch("v2_inference.requests.Session", return_value=session):
            stream = MjpegStreamReader("http://127.0.0.1:5000/stream")
        try:
            first_ok, first_frame = stream.read()
            stream.retry_delay = 0
            second_ok, second_frame = stream.read()

            self.assertTrue(first_ok)
            self.assertTrue(second_ok)
            self.assertEqual(first_frame.shape, (16, 16, 3))
            self.assertEqual(second_frame.shape, (16, 16, 3))
            self.assertEqual(stream.connection_generation, 2)
        finally:
            stream.close()

    def test_mjpeg_reader_drops_incomplete_parts_and_honors_content_length(self):
        ok, encoded = cv2.imencode(".jpg", np.full((16, 16, 3), 127, dtype=np.uint8))
        self.assertTrue(ok)
        valid_jpeg = encoded.tobytes()
        incomplete_jpeg = valid_jpeg[:-8]
        invalid_part = (
            b"--frame\r\nContent-Type: image/jpeg\r\n"
            + f"Content-Length: {len(incomplete_jpeg)}\r\n\r\n".encode("ascii")
            + incomplete_jpeg
            + b"\r\n"
        )
        valid_part = (
            b"--frame\r\nContent-Type: image/jpeg\r\n"
            + f"Content-Length: {len(valid_jpeg)}\r\n\r\n".encode("ascii")
            + valid_jpeg
            + b"\r\n"
        )
        response = FakeMjpegResponse(valid_jpeg)
        response.body = invalid_part + valid_part
        session = type("FakeSession", (), {
            "get": lambda *_args, **_kwargs: response,
            "close": lambda *_args: None,
        })()

        with patch("v2_inference.requests.Session", return_value=session):
            stream = MjpegStreamReader("http://127.0.0.1:5000/stream")
        try:
            frame_ok, jpeg = stream.read_jpeg()
            self.assertTrue(frame_ok)
            self.assertEqual(jpeg, valid_jpeg)
            self.assertEqual(stream.invalid_frames, 1)
            decoded = cv2.imdecode(np.frombuffer(jpeg, dtype=np.uint8), cv2.IMREAD_COLOR)
            self.assertIsNotNone(decoded)
            self.assertEqual(decoded.shape, (16, 16, 3))
        finally:
            stream.close()


if __name__ == "__main__":
    unittest.main()
