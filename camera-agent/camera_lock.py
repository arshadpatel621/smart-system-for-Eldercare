"""Cross-platform OS lock used to prevent duplicate inference per camera."""

import os
import sys
import time


def _default_locks_dir() -> str:
    """Choose a runtime lock directory outside the repository."""
    if sys.platform == "win32":
        base = os.environ.get("LOCALAPPDATA") or os.path.expanduser("~")
        return os.path.join(base, "VitalCare", "locks")
    xdg = os.environ.get("XDG_RUNTIME_DIR")
    if xdg:
        return os.path.join(xdg, "vitalcare", "locks")
    return os.path.join(os.path.expanduser("~"), ".cache", "vitalcare", "locks")


def _lock_file_path(locks_dir: str, camera_id: str) -> str:
    safe = "".join(char if char.isalnum() or char in "-_" else "_" for char in str(camera_id))
    return os.path.join(locks_dir, f"person_tracker_{safe}.lock")


class CameraLock:
    """OS advisory lock: only one process may run inference for a camera."""

    def __init__(self, camera_id: str, locks_dir: str | None = None):
        self.camera_id = str(camera_id)
        self.locks_dir = locks_dir or _default_locks_dir()
        self.path = _lock_file_path(self.locks_dir, self.camera_id)
        self.acquired = False
        self._handle = None

    def acquire(self) -> bool:
        try:
            os.makedirs(self.locks_dir, exist_ok=True)
        except OSError:
            return False
        import portalocker

        lock_obj = portalocker.Lock(
            self.path,
            fail_when_locked=True,
            timeout=0,
            check_interval=0.1,
            flags=portalocker.LOCK_EX | portalocker.LOCK_NB,
        )
        try:
            handle = lock_obj.acquire(timeout=0, fail_when_locked=True)
        except portalocker.exceptions.LockException:
            return False
        except Exception:
            return False
        if handle is None:
            return False
        try:
            handle.truncate(0)
            handle.write(f"{os.getpid()}|{time.time():.6f}")
            handle.flush()
            handle.seek(0)
        except OSError:
            lock_obj.release()
            return False
        self._handle = lock_obj
        self.acquired = True
        return True

    def release(self) -> None:
        lock_obj = self._handle
        self._handle = None
        self.acquired = False
        if lock_obj is not None:
            try:
                lock_obj.release()
            except Exception:
                pass


def _pid_alive(pid: int) -> bool:
    """Best-effort PID liveness helper retained for diagnostics/tests only."""
    if pid <= 0:
        return False
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    except Exception:
        return True
    return True
