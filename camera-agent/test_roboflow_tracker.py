import threading
import time
import unittest
from unittest.mock import mock_open
from unittest.mock import patch

import cv2
import numpy as np
import requests
import supervision as sv

import person_tracker
from person_tracker import (
    FallIncidentTracker,
    MJPEGStreamError,
    MJPEGStreamReader,
    RoboflowDetector,
    RoboflowInferenceError,
    create_byte_tracker,
    load_roboflow_api_key,
    parse_roboflow_predictions,
    resolve_camera_config,
)


class FakeResponse:
    def __init__(self, status_code=200, payload=None):
        self.status_code = status_code
        self.payload = payload or {"predictions": []}

    def json(self):
        return self.payload


class FakeSession:
    def __init__(self, response=None, error=None):
        self.response = response or FakeResponse()
        self.error = error
        self.request = None

    def post(self, url, **kwargs):
        self.request = (url, kwargs)
        if self.error:
            raise self.error
        return self.response


class FakeMJPEGReader:
    def __init__(self, stop_after=30):
        self.read_count = 0
        self.stop_after = stop_after
        self.closed = False

    @property
    def response(self):
        return object()

    def read_frame(self):
        time.sleep(0.005)
        self.read_count += 1
        if self.read_count >= self.stop_after:
            person_tracker.running = False
        return np.zeros((40, 40, 3), dtype=np.uint8)

    def close(self):
        self.closed = True

    def disconnect(self):
        pass


class FakeMJPEGResponse:
    def __init__(self, chunks, status_code=200):
        self.chunks = chunks
        self.status_code = status_code
        self.closed = False

    def iter_content(self, chunk_size):
        yield from self.chunks

    def close(self):
        self.closed = True


class FakeMJPEGSession:
    def __init__(self, responses):
        self.responses = list(responses)
        self.get_calls = []
        self.closed = False

    def get(self, url, *, stream, timeout):
        self.get_calls.append((url, stream, timeout))
        if not self.responses:
            raise requests.ConnectionError("stream ended")
        return self.responses.pop(0)

    def close(self):
        self.closed = True


class FakeDispatcher:
    def __init__(self):
        self.events = []

    def dispatch(self, event_payload, *, critical=False):
        self.events.append((event_payload, critical))


class RoboflowDetectorTests(unittest.TestCase):
    @staticmethod
    def make_jpeg(value=80):
        frame = np.full((24, 32, 3), value, dtype=np.uint8)
        ok, encoded = cv2.imencode(".jpg", frame)
        if not ok:
            raise AssertionError("Could not encode test JPEG")
        return encoded.tobytes()

    def test_mjpeg_reader_parses_split_jpeg_markers_and_decodes_frames(self):
        jpeg = self.make_jpeg()
        response = FakeMJPEGResponse(
            [
                b"--myboundary\r\nContent-Type: image/jpeg\r\n\r\nnoise\xff",
                jpeg[1:19],
                jpeg[19:-1],
                jpeg[-1:] + b"\r\n--myboundary\r\n",
            ]
        )
        session = FakeMJPEGSession([response])
        reader = MJPEGStreamReader(
            "http://localhost:5000/api/cameras/cam-1/stream",
            session=session,
            chunk_size=17,
        )

        frame = reader.read_frame()

        self.assertEqual(frame.shape, (24, 32, 3))
        self.assertEqual(session.get_calls, [
            (
                "http://localhost:5000/api/cameras/cam-1/stream",
                True,
                (5.0, person_tracker.MJPEG_READ_TIMEOUT_SECONDS),
            )
        ])
        reader.close()
        self.assertTrue(response.closed)
        self.assertTrue(session.closed)

    def test_mjpeg_reader_resynchronizes_after_corrupt_jpeg_start(self):
        jpeg = self.make_jpeg(120)
        session = FakeMJPEGSession(
            [FakeMJPEGResponse([b"noise\xff\xd8corrupt\xff\xd8" + jpeg[2:]])]
        )
        reader = MJPEGStreamReader("http://localhost:5000/stream", session=session)

        frame = reader.read_frame()

        self.assertEqual(frame.shape, (24, 32, 3))
        reader.close()

    def test_mjpeg_reader_reconnects_after_stream_ends(self):
        jpeg = self.make_jpeg()
        first = FakeMJPEGResponse([jpeg])
        second = FakeMJPEGResponse([jpeg])
        session = FakeMJPEGSession([first, second])
        reader = MJPEGStreamReader("http://localhost:5000/stream", session=session)

        self.assertEqual(reader.read_frame().shape, (24, 32, 3))
        with self.assertRaises(MJPEGStreamError):
            reader.read_frame()
        self.assertFalse(reader.connected)
        self.assertEqual(reader.read_frame().shape, (24, 32, 3))
        self.assertEqual(len(session.get_calls), 2)

        reader.close()
        self.assertTrue(first.closed)
        self.assertTrue(second.closed)

    def test_mjpeg_reader_rejects_http_errors_and_oversized_frames(self):
        bad_status = FakeMJPEGResponse([], status_code=503)
        session = FakeMJPEGSession([bad_status])
        reader = MJPEGStreamReader("http://localhost:5000/stream", session=session)
        with self.assertRaisesRegex(MJPEGStreamError, "HTTP 503"):
            reader.read_frame()
        self.assertTrue(bad_status.closed)

        too_large = FakeMJPEGResponse([b"x" * 64])
        reader = MJPEGStreamReader(
            "http://localhost:5000/stream",
            session=FakeMJPEGSession([too_large]),
            max_frame_bytes=32,
        )
        with self.assertRaisesRegex(MJPEGStreamError, "size limit"):
            reader.read_frame()
        reader.close()

    def test_predictions_are_validated_and_clipped(self):
        predictions = parse_roboflow_predictions(
            {
                "predictions": [
                    {
                        "x": 5,
                        "y": 40,
                        "width": 30,
                        "height": 50,
                        "confidence": 0.91,
                        "class": "standing",
                    },
                    {
                        "x": 80,
                        "y": 40,
                        "width": 50,
                        "height": 50,
                        "confidence": 0.8,
                        "class": "unknown",
                    },
                    {
                        "x": 40,
                        "y": 40,
                        "width": -5,
                        "height": 10,
                        "confidence": 0.8,
                        "class": "fallen",
                    },
                ]
            },
            frame_width=100,
            frame_height=100,
        )

        self.assertEqual(len(predictions), 1)
        self.assertEqual(predictions[0].box, (0, 15, 20, 65))
        self.assertEqual(predictions[0].class_name, "standing")

    def test_request_uses_configured_model_confidence_and_timeout(self):
        session = FakeSession(
            FakeResponse(
                payload={
                    "predictions": [
                        {
                            "x": 50,
                            "y": 40,
                            "width": 30,
                            "height": 50,
                            "confidence": 0.75,
                            "class": "falling",
                        }
                    ]
                }
            )
        )
        detector = RoboflowDetector(
            "not-logged",
            confidence=0.4,
            image_size=640,
            timeout=2.0,
            session=session,
        )

        detections = detector.predict(np.zeros((100, 100, 3), dtype=np.uint8))

        self.assertEqual(len(detections), 1)
        self.assertEqual(detections[0].class_name, "falling")
        url, request = session.request
        self.assertEqual(url, "https://detect.roboflow.com/fall-detection-real/1")
        self.assertEqual(request["params"]["confidence"], 40)
        self.assertEqual(request["params"]["api_key"], "not-logged")
        self.assertEqual(request["timeout"], 2.0)
        self.assertEqual(request["files"]["file"][2], "image/jpeg")

    def test_timeout_error_does_not_expose_api_key(self):
        api_key = "private-test-key"
        detector = RoboflowDetector(
            api_key,
            confidence=0.4,
            image_size=640,
            session=FakeSession(error=requests.Timeout(api_key)),
        )

        with self.assertRaises(RoboflowInferenceError) as error:
            detector.predict(np.zeros((100, 100, 3), dtype=np.uint8))

        self.assertNotIn(api_key, str(error.exception))

    def test_api_key_loads_from_environment_or_env_file_without_logging(self):
        with patch.dict(person_tracker.os.environ, {"ROBOFLOW_API_KEY": "env-key"}):
            self.assertEqual(load_roboflow_api_key(), "env-key")

        with (
            patch.dict(person_tracker.os.environ, {}, clear=True),
            patch("person_tracker.os.path.isfile", return_value=True),
            patch("builtins.open", mock_open(read_data="ROBOFLOW_API_KEY='file-key'\n")),
        ):
            self.assertEqual(load_roboflow_api_key(), "file-key")

    def test_tracker_assigns_stable_ids(self):
        tracker = create_byte_tracker(inference_fps=3)
        detections = sv.Detections(
            xyxy=np.asarray([[10, 10, 60, 100]], dtype=float),
            confidence=np.asarray([0.9], dtype=float),
            class_id=np.asarray([0], dtype=int),
        )

        first = tracker.update_with_detections(detections)
        second = tracker.update_with_detections(detections)

        self.assertIsNotNone(first.tracker_id)
        self.assertEqual(first.tracker_id[0], second.tracker_id[0])

    def test_camera_resolution_uses_backend_mjpeg_not_rtsp(self):
        response = FakeResponse(
            payload=[
                {
                    "id": "0288f279-4a77-476a-b1ec-c0f8478932d",
                    "name": "Living Room",
                    "enabled": True,
                }
            ]
        )
        with patch("person_tracker.requests.get", return_value=response) as get:
            stream_url, camera_id, camera_name = resolve_camera_config(
                "http://localhost:5000/",
                camera_id="0288f279-4a77-476a-b1ec-c0f8478932d",
            )

        self.assertEqual(
            stream_url,
            "http://localhost:5000/api/cameras/0288f279-4a77-476a-b1ec-c0f8478932d/stream",
        )
        self.assertEqual(camera_id, "0288f279-4a77-476a-b1ec-c0f8478932d")
        self.assertEqual(camera_name, "Living Room")
        get.assert_called_once_with("http://localhost:5000/api/cameras", timeout=4)

    def test_camera_resolution_selects_enabled_camera_without_ai_consumer(self):
        response = FakeResponse(
            payload=[
                {"id": "disabled", "name": "Offline Camera", "enabled": False},
                {"id": "enabled", "name": "Living Room", "enabled": True},
            ]
        )
        with patch("person_tracker.requests.get", return_value=response) as get:
            stream_url, camera_id, camera_name = resolve_camera_config(
                "http://localhost:5000",
            )

        self.assertEqual(
            stream_url,
            "http://localhost:5000/api/cameras/enabled/stream",
        )
        self.assertEqual(camera_id, "enabled")
        self.assertEqual(camera_name, "Living Room")
        get.assert_called_once_with("http://localhost:5000/api/cameras", timeout=4)

    def test_capture_continues_while_roboflow_inference_is_busy(self):
        reader = FakeMJPEGReader()
        inference_started = threading.Event()
        read_count_when_prediction_returns = []
        original_running = person_tracker.running

        def slow_prediction(_detector, _frame):
            inference_started.set()
            time.sleep(0.5)
            read_count_when_prediction_returns.append(reader.read_count)
            return []

        person_tracker.running = True
        try:
            with (
                patch("person_tracker.MJPEGStreamReader", return_value=reader) as open_stream,
                patch.object(RoboflowDetector, "predict", slow_prediction),
            ):
                person_tracker.detect_people(
                    "http://localhost:5000/api/cameras/cam-1/stream",
                    "test-api-key",
                    0.4,
                    640,
                    "cam-1",
                    "Camera",
                    FakeDispatcher(),
                    inference_fps=5,
                )
                open_stream.assert_called_once_with("http://localhost:5000/api/cameras/cam-1/stream")
        finally:
            person_tracker.running = original_running

        self.assertTrue(inference_started.is_set())
        self.assertEqual(read_count_when_prediction_returns, [reader.stop_after])
        self.assertEqual(reader.read_count, reader.stop_after)
        self.assertTrue(reader.closed)


class FallIncidentTrackerTests(unittest.TestCase):
    def test_single_and_2_4_second_false_fallen_run_do_not_confirm(self):
        tracker = FallIncidentTracker()

        first = tracker.update(7, "fallen", 6.0)
        self.assertFalse(first["fallConfirmed"])

        for sample in range(1, 13):
            result = tracker.update(7, "fallen", 6.0 + sample * 0.2)
            self.assertFalse(result["fallConfirmed"])
            self.assertEqual(result["state"], "yellow")

        self.assertEqual(tracker.tracks[7]["last_seen"], 8.4)

    def test_sustained_fall_confirms_once_and_rearms_after_recovery(self):
        tracker = FallIncidentTracker()
        track_id = 12

        tracker.update(track_id, "fallen", 0.0)
        tracker.update(track_id, "fallen", 1.5)
        confirmed = tracker.update(track_id, "fallen", 3.0)
        incident_id = confirmed["incidentId"]
        self.assertTrue(confirmed["fallConfirmed"])
        self.assertEqual(confirmed["state"], "red")
        self.assertTrue(incident_id)

        repeated = tracker.update(track_id, "fallen", 3.5)
        self.assertFalse(repeated["fallConfirmed"])
        self.assertEqual(repeated["incidentId"], incident_id)

        tracker.update(track_id, "standing", 4.0)
        recovered = tracker.update(track_id, "standing", 7.1)
        self.assertEqual(recovered["state"], "green")
        self.assertIsNone(recovered["incidentId"])

        tracker.update(track_id, "fallen", 8.0)
        tracker.update(track_id, "fallen", 9.5)
        next_incident = tracker.update(track_id, "fallen", 11.0)
        self.assertTrue(next_incident["fallConfirmed"])
        self.assertNotEqual(next_incident["incidentId"], incident_id)

    def test_falling_class_does_not_confirm_a_fall(self):
        tracker = FallIncidentTracker()
        result = tracker.update(3, "falling", 100.0)
        self.assertEqual(result["state"], "yellow")
        self.assertFalse(result["fallConfirmed"])


if __name__ == "__main__":
    unittest.main()
