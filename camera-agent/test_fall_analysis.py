import unittest

from fall_analysis import PersonFallAnalyzer


def pose(horizontal: bool) -> list[list[float]]:
    points = [[0.0, 0.0] for _ in range(17)]
    if horizontal:
        points[5] = [100.0, 100.0]
        points[6] = [110.0, 100.0]
        points[11] = [200.0, 100.0]
        points[12] = [210.0, 100.0]
    else:
        points[5] = [100.0, 100.0]
        points[6] = [110.0, 100.0]
        points[11] = [100.0, 200.0]
        points[12] = [110.0, 200.0]
    return points


def scores() -> list[float]:
    values = [0.0] * 17
    for index in (5, 6, 11, 12):
        values[index] = 0.9
    return values


class PersonFallAnalyzerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.analyzer = PersonFallAnalyzer()

    def update(self, box: list[float], horizontal: bool, now: float) -> dict:
        return self.analyzer.update(7, box, pose(horizontal), scores(), 640, 480, now)

    def test_normal_posture_is_green(self) -> None:
        result = self.update([40, 20, 160, 220], False, 100.0)
        self.assertEqual(result["state"], "green")
        self.assertFalse(result["fallConfirmed"])

    def test_unusual_horizontal_posture_becomes_yellow_without_fall(self) -> None:
        self.update([40, 20, 160, 220], True, 100.0)
        result = self.update([40, 20, 160, 220], True, 101.1)
        self.assertEqual(result["state"], "yellow")
        self.assertFalse(result["fallConfirmed"])

    def test_prolonged_inactivity_becomes_yellow(self) -> None:
        self.update([40, 20, 160, 220], False, 100.0)
        result = self.update([40, 20, 160, 220], False, 191.0)
        self.assertEqual(result["state"], "yellow")
        self.assertEqual(result["reason"], "Prolonged inactivity")

    def test_rapid_drop_followed_by_persistent_horizontal_pose_confirms_once(self) -> None:
        self.update([40, 20, 160, 220], False, 100.0)
        self.update([40, 80, 160, 280], True, 100.2)
        self.update([40, 80, 160, 280], True, 100.6)
        result = self.update([40, 80, 160, 280], True, 101.05)

        self.assertEqual(result["state"], "red")
        self.assertTrue(result["fallConfirmed"])
        subsequent = self.update([40, 80, 160, 280], True, 101.2)
        self.assertEqual(subsequent["state"], "red")
        self.assertFalse(subsequent["fallConfirmed"])

    def test_stale_tracks_are_removed(self) -> None:
        self.update([40, 20, 160, 220], False, 100.0)
        self.analyzer.remove_stale_tracks(104.0)
        self.assertNotIn(7, self.analyzer.tracks)


if __name__ == "__main__":
    unittest.main()
