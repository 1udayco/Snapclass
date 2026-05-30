"""
voice_pipeline.py  –  resemblyzer voice recognition pipeline
Used by the FastAPI AI server (ai_server/main.py)
"""

from resemblyzer import VoiceEncoder, preprocess_wav
import numpy as np
import io
import librosa


# ── Model Loading ──────────────────────────────────────────────────────────

_encoder: VoiceEncoder | None = None


def _get_encoder() -> VoiceEncoder:
    global _encoder
    if _encoder is None:
        _encoder = VoiceEncoder()
    return _encoder


# ── Embedding Extraction ───────────────────────────────────────────────────

def get_voice_embedding(audio_bytes: bytes) -> list[float] | None:
    """
    Accept raw audio bytes (any format librosa can read) and return a
    256-d speaker embedding as a plain Python list, or None on error.
    """
    try:
        encoder = _get_encoder()
        audio, _ = librosa.load(io.BytesIO(audio_bytes), sr=16000)
        wav = preprocess_wav(audio)
        embedding = encoder.embed_utterance(wav)
        return embedding.tolist()
    except Exception as exc:
        print(f"[voice_pipeline] get_voice_embedding error: {exc}")
        return None


# ── Speaker Identification ─────────────────────────────────────────────────

def identify_speaker(
    new_embedding: list[float],
    candidates: dict[int, list[float]],
    threshold: float = 0.65,
) -> tuple[int | None, float]:
    """
    Compare new_embedding against candidates dict { student_id: embedding }.
    Returns (best_student_id, score) or (None, score) if below threshold.
    """
    if new_embedding is None or not candidates:
        return None, 0.0

    new_vec = np.array(new_embedding)
    best_sid, best_score = None, -1.0

    for sid, stored in candidates.items():
        if stored:
            score = float(np.dot(new_vec, np.array(stored)))
            if score > best_score:
                best_score = score
                best_sid = sid

    if best_score >= threshold:
        return best_sid, best_score
    return None, best_score


# ── Bulk Audio Processing ─────────────────────────────────────────────────

def process_bulk_audio(
    audio_bytes: bytes,
    candidates: dict[int, list[float]],
    threshold: float = 0.65,
) -> dict[int, float]:
    """
    Split audio into voiced segments, identify each speaker, return
    { student_id: best_score } for all positively identified students.
    """
    try:
        encoder = _get_encoder()
        audio, sr = librosa.load(io.BytesIO(audio_bytes), sr=16000)
        segments = librosa.effects.split(audio, top_db=30)
        identified: dict[int, float] = {}

        for start, end in segments:
            if (end - start) < sr * 0.5:   # skip segments < 0.5 s
                continue
            segment_audio = audio[start:end]
            wav = preprocess_wav(segment_audio)
            embedding = encoder.embed_utterance(wav)
            sid, score = identify_speaker(embedding.tolist(), candidates, threshold)
            if sid is not None:
                if sid not in identified or score > identified[sid]:
                    identified[sid] = score

        return identified
    except Exception as exc:
        print(f"[voice_pipeline] process_bulk_audio error: {exc}")
        return {}
