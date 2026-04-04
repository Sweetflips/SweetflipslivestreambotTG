"""Windows/PortAudio: skip speaker loopback and stereo-mix style inputs when choosing a mic."""

from __future__ import annotations

import os
import re

import sounddevice as sd

_DESKTOP_CAPTURE_HINTS = (
    "stereo mix",
    "stereomix",
    "what u hear",
    "what you hear",
    "wave out mix",
    "mono mix",
    "loopback",
    "(loopback)",
)

_VIRTUAL_MIXER_HINTS = (
    "voicemeeter",
    "vb-audio",
    "virtual cable",
    "blackhole",
    "cable output",
    "vb cable",
    "wave link",
    "obs virtual",
    "virtual mic",
)


def allow_desktop_capture_devices() -> bool:
    return os.environ.get("STT_ALLOW_DESKTOP_CAPTURE", "").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


def default_input_device_index() -> int | None:
    try:
        d = sd.default.device
        return int(d[0])
    except Exception:
        return None


def prefer_default_when_duplicate() -> bool:
    return os.environ.get("STT_PREFER_DEVICE_DEFAULT", "1").strip().lower() not in (
        "0",
        "false",
        "no",
        "off",
    )


def name_looks_like_desktop_capture(name: str) -> bool:
    n = name.strip().lower()
    for hint in _VIRTUAL_MIXER_HINTS:
        if hint in n:
            return True
    if "microphone" in n or "microfoon" in n:
        return False
    for hint in _DESKTOP_CAPTURE_HINTS:
        if hint in n:
            return True
    if re.search(r"\bspeakers\b", n) and "mic" not in n:
        return True
    if re.search(r"\b(line in|line-in|aux in)\b", n) and "mic" not in n:
        return True
    return False


def is_likely_desktop_capture(name: str) -> bool:
    if allow_desktop_capture_devices():
        return False
    return name_looks_like_desktop_capture(name)


def print_input_devices() -> None:
    print("Input devices (max_input_channels > 0):")
    for i, dev in enumerate(sd.query_devices()):
        if int(dev["max_input_channels"]) <= 0:
            continue
        mark = (
            "  [likely desktop/speaker capture — not a mic]"
            if name_looks_like_desktop_capture(dev["name"])
            else ""
        )
        print(f"  {i}: {dev['name']}{mark}")
