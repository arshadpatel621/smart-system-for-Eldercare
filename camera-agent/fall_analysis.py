"""Temporal fall-state analysis for tracked YOLO pose detections."""

import math


class PersonFallAnalyzer:
    """Classifies each stable tracker ID using pose and frame-to-frame history."""

    def __init__(
        self,
        *,
        horizontal_angle: float = 55.0,
        posture_seconds: float = 1.0,
        fall_confirmation_seconds: float = 0.8,
        inactivity_seconds: float = 90.0,
        track_expiry_seconds: float = 3.0,
    ):
        self.horizontal_angle = horizontal_angle
        self.posture_seconds = posture_seconds
        self.fall_confirmation_seconds = fall_confirmation_seconds
        self.inactivity_seconds = inactivity_seconds
        self.track_expiry_seconds = track_expiry_seconds
        self.tracks: dict[int, dict] = {}

    @staticmethod
    def _center(box: list[float]) -> tuple[float, float]:
        return ((box[0] + box[2]) / 2.0, (box[1] + box[3]) / 2.0)

    @staticmethod
    def _torso_angle(keypoints: list, scores: list | None) -> float | None:
        if len(keypoints) <= 12:
            return None

        required = (5, 6, 11, 12)
        if any(
            len(keypoints[index]) < 2
            or keypoints[index][0] <= 0
            or keypoints[index][1] <= 0
            or (scores is not None and (len(scores) <= index or scores[index] < 0.3))
            for index in required
        ):
            return None

        shoulder_x = (keypoints[5][0] + keypoints[6][0]) / 2.0
        shoulder_y = (keypoints[5][1] + keypoints[6][1]) / 2.0
        hip_x = (keypoints[11][0] + keypoints[12][0]) / 2.0
        hip_y = (keypoints[11][1] + keypoints[12][1]) / 2.0
        return math.degrees(math.atan2(abs(hip_x - shoulder_x), abs(hip_y - shoulder_y) + 1e-6))

    def update(
        self,
        track_id: int,
        box: list[float],
        keypoints: list,
        scores: list | None,
        frame_width: int,
        frame_height: int,
        now: float,
    ) -> dict:
        center = self._center(box)
        history = self.tracks.get(track_id)
        if history is None:
            history = {
                "center": center,
                "last_seen": now,
                "last_motion": now,
                "horizontal_since": None,
                "fall_window_until": 0.0,
                "fall_confirmed": False,
                "upright_since": None,
            }
            self.tracks[track_id] = history

        elapsed = max(now - history["last_seen"], 1e-3)
        previous_center = history["center"]
        displacement = math.hypot(center[0] - previous_center[0], center[1] - previous_center[1])
        frame_diagonal = math.hypot(frame_width, frame_height)
        if displacement > frame_diagonal * 0.015:
            history["last_motion"] = now

        downward_motion = center[1] - previous_center[1]
        rapid_drop = (
            0 < elapsed <= 1.0
            and downward_motion >= frame_height * 0.10
        )
        if rapid_drop:
            history["fall_window_until"] = now + 2.0

        angle = self._torso_angle(keypoints, scores)
        horizontal = angle is not None and angle >= self.horizontal_angle
        if horizontal:
            if history["horizontal_since"] is None:
                history["horizontal_since"] = now
        else:
            history["horizontal_since"] = None

        horizontal_duration = (
            now - history["horizontal_since"]
            if history["horizontal_since"] is not None
            else 0.0
        )
        fall_candidate = (
            horizontal
            and now <= history["fall_window_until"]
            and horizontal_duration >= self.fall_confirmation_seconds
        )

        recovered_upright = angle is not None and angle < 35.0
        if history["fall_confirmed"] and recovered_upright:
            if history["upright_since"] is None:
                history["upright_since"] = now
            elif now - history["upright_since"] >= 3.0:
                history["fall_confirmed"] = False
                history["upright_since"] = None
        else:
            history["upright_since"] = None

        newly_confirmed_fall = fall_candidate and not history["fall_confirmed"]
        if newly_confirmed_fall:
            history["fall_confirmed"] = True

        if history["fall_confirmed"]:
            state = "red"
            reason = "Fall posture confirmed after rapid downward movement"
        elif angle is None:
            state = "yellow"
            reason = "Posture unclear; verify the person visually"
        elif horizontal_duration >= self.posture_seconds:
            state = "yellow"
            reason = "Unusual horizontal posture"
        elif now - history["last_motion"] >= self.inactivity_seconds:
            state = "yellow"
            reason = "Prolonged inactivity"
        else:
            state = "green"
            reason = "Normal activity"

        history["center"] = center
        history["last_seen"] = now

        return {
            "state": state,
            "reason": reason,
            "torsoAngle": round(angle, 1) if angle is not None else None,
            "fallConfirmed": newly_confirmed_fall,
        }

    def remove_stale_tracks(self, now: float) -> None:
        for track_id, history in list(self.tracks.items()):
            if now - history["last_seen"] > self.track_expiry_seconds:
                del self.tracks[track_id]
