"""
Ensure only one STT streamer process runs (avoids double Whisper/GPU load).

Set STT_ALLOW_MULTIPLE_STREAMERS=1 to disable (debug only).
"""

from __future__ import annotations

import os
import sys


def acquire_streamer_lock() -> bool:
    if os.environ.get("STT_ALLOW_MULTIPLE_STREAMERS", "").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    ):
        return True

    if sys.platform == "win32":
        return _acquire_mutex_win32()
    return _acquire_flock_posix()


_mutex_handle = None


def _acquire_mutex_win32() -> bool:
    global _mutex_handle
    import ctypes
    from ctypes import wintypes

    kernel32 = ctypes.windll.kernel32
    ERROR_ALREADY_EXISTS = 183
    name = "Local\\FastWhisper2.STT.Streamer"

    kernel32.SetLastError(0)
    kernel32.CreateMutexW.argtypes = [
        wintypes.LPVOID,
        wintypes.BOOL,
        wintypes.LPCWSTR,
    ]
    kernel32.CreateMutexW.restype = wintypes.HANDLE

    h = kernel32.CreateMutexW(None, False, name)
    if not h:
        err = ctypes.get_last_error()
        raise RuntimeError(
            f"Could not create the STT single-instance mutex (winerror={err}). "
            "Refusing to start without reliable single-instance protection."
        )
    err = kernel32.GetLastError()
    if err == ERROR_ALREADY_EXISTS:
        kernel32.CloseHandle(h)
        return False
    _mutex_handle = h
    return True


_lock_fd: int | None = None


def _acquire_flock_posix() -> bool:
    global _lock_fd
    import fcntl

    path = os.path.join(
        os.environ.get("XDG_RUNTIME_DIR", os.environ.get("TMPDIR", "/tmp")),
        "fast-whisper-2-stt-streamer.lock",
    )
    fd = os.open(path, os.O_CREAT | os.O_RDWR, 0o600)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        os.close(fd)
        return False
    _lock_fd = fd
    return True
