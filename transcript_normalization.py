"""
Whisper often misreads your brand name. Map variants to canonical spelling.

Adjust CANONICAL_BRAND and patterns when you see new variants.

Keep in sync with Mascoobs rules in scripts/streamer_obs_whisper_agent.py _VOCAB_PATTERNS.
"""

from __future__ import annotations

import re

CANONICAL_BRAND = "Mascoobs"

_PHRASE_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (
        re.compile(r"(?i)\bmy\s+scoops?,?\s*my\s+scupes?\b"),
        CANONICAL_BRAND,
    ),
    (
        re.compile(r"(?i)\bmy\s+scupes?,?\s*my\s+scoops?\b"),
        CANONICAL_BRAND,
    ),
    (
        re.compile(r"(?i)\bm[ua]s+c?o{1,2}ps?\s*,\s*m[ua]s+c?o{1,2}ps?\b"),
        CANONICAL_BRAND,
    ),
    (
        re.compile(r"(?i)\bmass\s+scopes?\b"),
        CANONICAL_BRAND,
    ),
    (
        re.compile(r"(?i)\bmass\s+coops?\b"),
        CANONICAL_BRAND,
    ),
    (
        re.compile(r"(?i)\bmas\s+co{1,2}bs?\b"),
        CANONICAL_BRAND,
    ),
    (
        re.compile(r"(?i)\bmass\s+co{1,2}bs?\b"),
        CANONICAL_BRAND,
    ),
    (
        re.compile(r"(?i)\bmask\s+co{1,2}bs?\b"),
        CANONICAL_BRAND,
    ),
]

_WORD_RE = re.compile(
    r"(?i)\b(?:"
    r"mascopes?|mascop|mascops|mascubes?|mascobes?|mascoups?|"
    r"m[ua]s+copes?|m[ua]s+cop\b|m[ua]s+cops\b|"
    r"m[ua]s+c?o{1,2}ps?|m[ua]ssc+oops?|mucscoops?|musscoops?|muscoops|mascoops|"
    r"mus+copes?|muskopes?"
    r")\b"
)


def normalize_brand_transcript(text: str) -> str:
    if not (text or "").strip():
        return text
    t = text.strip()
    for pat, repl in _PHRASE_PATTERNS:
        t = pat.sub(repl, t)
    t = _WORD_RE.sub(CANONICAL_BRAND, t)
    t = re.sub(r"\s{2,}", " ", t).strip()
    return t
