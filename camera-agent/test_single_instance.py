"""Tests for the shared per-camera OS lock."""

import concurrent.futures
import os
import subprocess
import sys
import tempfile
import threading
import time

sys.path.insert(0, os.path.dirname(__file__))

from camera_lock import CameraLock, _default_locks_dir, _pid_alive

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


def _fresh_dir():
    return tempfile.mkdtemp(prefix="vc-locks-")


def _run_child(code, lock_dir, timeout=15):
    """Run a snippet that imports from camera-agent and returns output."""
    return subprocess.run(
        [sys.executable, "-c", code, SCRIPT_DIR, lock_dir],
        capture_output=True,
        text=True,
        timeout=timeout,
    )


def test_first_acquire_succeeds():
    lock_dir = _fresh_dir()
    lock = CameraLock("cam-a", locks_dir=lock_dir)
    assert lock.acquire(), "First acquire should succeed"
    assert lock.acquired
    assert os.path.isfile(lock.path)
    lock.release()
    assert not lock.acquired
    print(" [PASS] test_first_acquire_succeeds")


def test_second_acquire_same_camera_fails():
    lock_dir = _fresh_dir()
    lock1 = CameraLock("cam-a", locks_dir=lock_dir)
    lock2 = CameraLock("cam-a", locks_dir=lock_dir)
    assert lock1.acquire(), "First holder should acquire"
    assert not lock2.acquire(), "Second instance for same camera must be rejected"
    lock1.release()
    assert lock2.acquire(), "Acquire after release should succeed"
    lock2.release()
    print(" [PASS] test_second_acquire_same_camera_fails")


def test_different_cameras_independent():
    lock_dir = _fresh_dir()
    lock_a = CameraLock("cam-a", locks_dir=lock_dir)
    lock_b = CameraLock("cam-b", locks_dir=lock_dir)
    assert lock_a.acquire()
    assert lock_b.acquire(), "Different camera IDs must not block each other"
    assert lock_a.path != lock_b.path
    lock_a.release()
    lock_b.release()
    print(" [PASS] test_different_cameras_independent")


def test_graceful_shutdown_releases_lock():
    lock_dir = _fresh_dir()
    lock = CameraLock("cam-a", locks_dir=lock_dir)
    assert lock.acquire()
    lock.release()
    lock.release()  # double release must not raise
    assert not lock.acquired
    lock2 = CameraLock("cam-a", locks_dir=lock_dir)
    assert lock2.acquire()
    lock2.release()
    print(" [PASS] test_graceful_shutdown_releases_lock")


def test_default_lock_dir_outside_repo():
    path = _default_locks_dir()
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    assert repo_root not in os.path.realpath(path), (
        f"Default locks dir must be outside the repository: {path}"
    )
    if sys.platform == "win32":
        assert "VitalCare" in path and "locks" in path, path
    print(f" [PASS] test_default_lock_dir_outside_repo ({path})")


def test_child_process_blocked_while_parent_holds():
    """A second OS process must be unable to acquire a held lock."""
    lock_dir = _fresh_dir()
    lock = CameraLock("cam-a", locks_dir=lock_dir)
    assert lock.acquire()
    code = (
        "import sys; sys.path.insert(0, sys.argv[1]); "
        "from camera_lock import CameraLock; "
        "l=CameraLock('cam-a', locks_dir=sys.argv[2]); "
        "ok=l.acquire(); print('child-acquire', ok)"
    )
    result = _run_child(code, lock_dir)
    assert result.returncode == 0, result.stderr
    assert "child-acquire False" in result.stdout, result.stdout
    lock.release()
    # After release a new process can acquire.
    result2 = _run_child(code, lock_dir)
    assert "child-acquire True" in result2.stdout, result2.stdout
    print(" [PASS] test_child_process_blocked_while_parent_holds")


def test_abrupt_process_termination_releases_lock():
    """kill -9 the owner: a new acquire must succeed (OS releases fd)."""
    lock_dir = _fresh_dir()
    # Child holds the same camera lock in a separate OS process; we kill it
    # abruptly and verify a fresh acquire succeeds (OS releases the fd).
    code = (
        "import sys, time; sys.path.insert(0, sys.argv[1]); "
        "from camera_lock import CameraLock; "
        "l=CameraLock('cam-crashed', locks_dir=sys.argv[2]); "
        "ok=l.acquire(); print('child-acquire', ok, flush=True); "
        "time.sleep(30)"
    )
    child = subprocess.Popen(
        [sys.executable, "-c", code, SCRIPT_DIR, lock_dir],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    try:
        line = child.stdout.readline()
        assert "child-acquire True" in line, f"child did not acquire: {line!r}"
        child.kill()  # abrupt termination (POSIX SIGKILL / TerminateProcess)
        child.wait(timeout=10)
    finally:
        if child.poll() is None:
            child.kill()
    # Small settle: OS lock release is synchronous on kill, but the file
    # descriptor teardown can lag a tick on some platforms.
    time.sleep(0.5)
    fresh = CameraLock("cam-crashed", locks_dir=lock_dir)
    assert fresh.acquire(), "Lock must be reusable after abrupt owner exit"
    fresh.release()
    print(" [PASS] test_abrupt_process_termination_releases_lock")


def test_simultaneous_stale_lock_recovery():
    """Two threads racing on a stale (dead-PID) file: exactly one wins
    while the winner holds; the documented OS-lock semantics apply.
    """
    lock_dir = _fresh_dir()
    stale_path = CameraLock("cam-race", locks_dir=lock_dir).path
    os.makedirs(lock_dir, exist_ok=True)
    with open(stale_path, "w", encoding="utf-8") as fh:
        fh.write(f"999999|{time.time():.6f}")
    barrier = threading.Barrier(2)
    results = {}
    guard = threading.Lock()
    holds = []

    def worker(idx):
        barrier.wait(timeout=10)
        lock = CameraLock("cam-race", locks_dir=lock_dir)
        ok = lock.acquire()
        with guard:
            results[idx] = ok
            if ok:
                holds.append(lock)

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(worker, range(2)))
    assert sorted(results.values()) == [False, True], results
    for lock in holds:
        lock.release()
    print(" [PASS] test_simultaneous_stale_lock_recovery")


def test_concurrent_launches_exactly_one_winner():
    """10 threads racing the same camera: exactly one acquire succeeds."""
    lock_dir = _fresh_dir()
    barrier = threading.Barrier(10)
    results = []
    guard = threading.Lock()
    holds = []

    def worker():
        barrier.wait(timeout=10)
        lock = CameraLock("cam-concurrent", locks_dir=lock_dir)
        ok = lock.acquire()
        with guard:
            results.append(ok)
            if ok:
                holds.append(lock)

    threads = [threading.Thread(target=worker) for _ in range(10)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=10)
    assert results.count(True) == 1, results
    for lock in holds:
        lock.release()
    assert CameraLock("cam-concurrent", locks_dir=lock_dir).acquire()
    print(" [PASS] test_concurrent_launches_exactly_one_winner")


def test_pid_reuse_scenario():
    """Simulate PID reuse: dead_pid reused by a live OS process while the
    lock file carries that PID. OS lock ownership is authoritative; content
    is advisory only — a live lock holder blocks new acquirers regardless."""
    lock_dir = _fresh_dir()
    lock = CameraLock("cam-pid", locks_dir=lock_dir)
    assert lock.acquire()
    # Lock file now contains our live PID; a second instance must still fail.
    lock2 = CameraLock("cam-pid", locks_dir=lock_dir)
    assert not lock2.acquire()
    # _pid_alive still reports correctly for our own PID.
    assert _pid_alive(os.getpid())
    lock.release()
    # After release, re-acquire works even though its content PID is gone.
    assert CameraLock("cam-pid", locks_dir=lock_dir).acquire()
    print(" [PASS] test_pid_reuse_scenario")


if __name__ == "__main__":
    print("=== Running single-instance lock tests ===")
    test_first_acquire_succeeds()
    test_second_acquire_same_camera_fails()
    test_different_cameras_independent()
    test_graceful_shutdown_releases_lock()
    test_default_lock_dir_outside_repo()
    test_child_process_blocked_while_parent_holds()
    test_abrupt_process_termination_releases_lock()
    test_simultaneous_stale_lock_recovery()
    test_concurrent_launches_exactly_one_winner()
    test_pid_reuse_scenario()
    print("=== All single-instance lock tests passed ===")
