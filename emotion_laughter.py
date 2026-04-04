"""
Laughter + emotion hints from Whisper text (no extra ML dependencies).

Whisper often writes laughter as "ha ha", "hahaha" — we detect that with regex.
Emotion: simple keyword sets over words in the sentence.
"""

from __future__ import annotations

import os
import re
from typing import Any

import numpy as np

_LAUGH_PATTERNS = [
    re.compile(r"(?:\b(?:ha|hah|haha|hahaha|ha\s+ha|heh|hehe|hee|hi\s*hi)\b)", re.I),
    re.compile(r"(?:\b(?:lol|rofl|lmao)\b)", re.I),
    re.compile(r"(?:\bha\b\s*){2,}", re.I),
    re.compile(r"(?:[ha]){4,}", re.I),
]


def laughter_from_text(text: str) -> dict[str, Any]:
    t = (text or "").strip()
    if not t:
        return {"detected": False, "score": 0.0}
    score = 0.0
    for pat in _LAUGH_PATTERNS:
        m = pat.search(t)
        if m:
            score = max(score, 0.55 + min(0.4, len(m.group()) * 0.03))
    ha_count = len(re.findall(r"\bha\b", t.lower()))
    if ha_count >= 2:
        score = max(score, min(0.95, 0.4 + ha_count * 0.12))
    return {"detected": score >= 0.45, "score": round(min(1.0, score), 3)}


_POS = frozenset(
    """
    love great awesome amazing wonderful happy glad yes wow nice excellent perfect
    excited fun funny hilarious joy sweet thanks thank you brilliant leuk top mooi
    blij fijn super gaaf lol
    """.split()
)
_NEG = frozenset(
    """
    sad sorry hate awful terrible worst angry mad frustrated scared afraid worried
    bad no ugh damn horrible cry depressed kut stom rot helaas jammer
    """.split()
)
_SURP = frozenset("wow what oh damn hell really seriously echt serieus o nee huh".split())


def emotion_hint_from_text(text: str) -> str:
    words = re.findall(r"[a-zA-Zà-ÿ']+", (text or "").lower())
    if not words:
        return "neutral"
    pos = sum(1 for w in words if w in _POS)
    neg = sum(1 for w in words if w in _NEG)
    sur = sum(1 for w in words if w in _SURP)
    if pos > neg and pos >= 1:
        return "positive"
    if neg > pos and neg >= 1:
        return "negative"
    if sur >= 2 and pos == neg == 0:
        return "surprise"
    return "neutral"


_voice_classifier = None


def _emotion_from_voice_try(audio: np.ndarray, sample_rate: int) -> dict[str, Any] | None:
    global _voice_classifier
    if os.environ.get("STT_VOICE_EMOTION", "0").strip() not in ("1", "true", "yes"):
        return None
    if audio is None or audio.size < sample_rate * 0.2:
        return None
    try:
        if _voice_classifier is None:
            try:
                from speechbrain.inference.classifiers import EncoderClassifier
            except ImportError:
                from speechbrain.pretrained import EncoderClassifier  # type: ignore

            _voice_classifier = EncoderClassifier.from_hparams(
                source="speechbrain/emotion-recognition-wav2vec2-IEMOCAP",
                savedir="pretrained_models/emotion-recognition-wav2vec2-IEMOCAP",
            )
        import torch

        wav = torch.from_numpy(audio.astype(np.float32))
        if wav.dim() == 1:
            wav = wav.unsqueeze(0)
        out_prob, score, index, label = _voice_classifier.classify_batch(wav)
        lab = str(label[0]) if label is not None else "unknown"
        conf = float(score[0]) if score is not None else 0.0
        return {"label": lab, "confidence": round(conf, 3)}
    except Exception:
        return None


def enrich_utterance(
    text: str,
    audio: np.ndarray | None = None,
    sample_rate: int = 16000,
) -> dict[str, Any]:
    laugh = laughter_from_text(text)
    emo_txt = emotion_hint_from_text(text)
    out: dict[str, Any] = {
        "laughter_detected": laugh["detected"],
        "laughter_score": laugh["score"],
        "emotion_text": emo_txt,
    }
    if audio is not None:
        voice = _emotion_from_voice_try(audio, sample_rate)
        if voice is not None:
            out["emotion_voice"] = voice["label"]
            out["emotion_voice_confidence"] = voice["confidence"]
        else:
            out["emotion_voice"] = ""
            out["emotion_voice_confidence"] = 0.0
    return out
