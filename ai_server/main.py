"""
ai_server/main.py  –  FastAPI server exposing face & voice recognition endpoints
Run:  uvicorn ai_server.main:app --host 0.0.0.0 --port 8000 --reload
"""

import base64
import io
from contextlib import asynccontextmanager

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pydantic import BaseModel

from ai_server.src.face_pipeline import build_classifier, get_face_embeddings, predict_attendance
from ai_server.src.voice_pipeline import get_voice_embedding, identify_speaker, process_bulk_audio


# ── Lifespan (warm up models once) ────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Trigger model loading at startup so first request isn't slow
    from ai_server.src.face_pipeline import _get_models
    from ai_server.src.voice_pipeline import _get_encoder
    _get_models()
    _get_encoder()
    yield


app = FastAPI(title="SnapClass AI Server", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helpers ────────────────────────────────────────────────────────────────

def decode_image(data_url_or_b64: str) -> np.ndarray:
    """Accept a data-URL (data:image/...;base64,...) or raw base64 string."""
    if data_url_or_b64.startswith("data:"):
        _, b64 = data_url_or_b64.split(",", 1)
    else:
        b64 = data_url_or_b64
    raw = base64.b64decode(b64)
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    return np.array(img)


def decode_audio(data_url_or_b64: str) -> bytes:
    if data_url_or_b64.startswith("data:"):
        _, b64 = data_url_or_b64.split(",", 1)
    else:
        b64 = data_url_or_b64
    return base64.b64decode(b64)


# ── Pydantic Schemas ───────────────────────────────────────────────────────

class StudentRecord(BaseModel):
    student_id: int
    face_embedding: list[float] | None = None
    voice_embedding: list[float] | None = None


class FaceEmbedRequest(BaseModel):
    image: str   # base64 or data-URL


class FaceAttendanceRequest(BaseModel):
    image: str                       # classroom photo
    students: list[StudentRecord]    # enrolled students with embeddings


class VoiceEmbedRequest(BaseModel):
    audio: str   # base64 or data-URL


class VoiceAttendanceRequest(BaseModel):
    audio: str
    students: list[StudentRecord]
    threshold: float = 0.65


class StudentIdentifyRequest(BaseModel):
    image: str
    students: list[StudentRecord]


# ── Face Endpoints ─────────────────────────────────────────────────────────

@app.post("/ai/face/embed")
async def face_embed(req: FaceEmbedRequest):
    """
    Extract face embedding(s) from a single image.
    Returns { embeddings: [[128 floats], ...] }
    """
    try:
        img = decode_image(req.image)
        embeddings = get_face_embeddings(img)
        return {"embeddings": [e.tolist() for e in embeddings]}
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@app.post("/ai/face/identify")
async def face_identify(req: StudentIdentifyRequest):
    """
    Identify a single student from a face image.
    Returns { student_id, confidence } or { student_id: null } if not found.
    """
    try:
        img = decode_image(req.image)
        students = [s.model_dump() for s in req.students]
        model_data = build_classifier(students)
        if not model_data:
            return {"student_id": None, "confidence": 0.0}

        result = predict_attendance(img, model_data)
        detected = result["detected"]
        if detected:
            sid = next(iter(detected))
            return {"student_id": sid, "confidence": 1.0}
        return {"student_id": None, "confidence": 0.0}
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@app.post("/ai/face/attendance")
async def face_attendance(req: FaceAttendanceRequest):
    """
    Run attendance detection on a classroom photo.
    Returns {
        detected: { student_id: true },
        all_students: [student_id, ...],
        faces_found: int
    }
    """
    try:
        img = decode_image(req.image)
        students = [s.model_dump() for s in req.students]
        model_data = build_classifier(students)
        if not model_data:
            return {"detected": {}, "all_students": [], "faces_found": 0}

        result = predict_attendance(img, model_data)
        # JSON keys must be strings
        result["detected"] = {str(k): v for k, v in result["detected"].items()}
        result["all_students"] = [str(s) for s in result["all_students"]]
        return result
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc))


# ── Voice Endpoints ────────────────────────────────────────────────────────

@app.post("/ai/voice/embed")
async def voice_embed(req: VoiceEmbedRequest):
    """
    Extract voice embedding from an audio clip.
    Returns { embedding: [256 floats] } or { embedding: null } on error.
    """
    audio_bytes = decode_audio(req.audio)
    embedding = get_voice_embedding(audio_bytes)
    return {"embedding": embedding}


@app.post("/ai/voice/attendance")
async def voice_attendance(req: VoiceAttendanceRequest):
    """
    Identify speakers from a bulk audio recording.
    Returns { detected: { student_id: score } }
    """
    try:
        audio_bytes = decode_audio(req.audio)
        candidates = {
            s.student_id: s.voice_embedding
            for s in req.students
            if s.voice_embedding
        }
        identified = process_bulk_audio(audio_bytes, candidates, req.threshold)
        return {"detected": {str(k): v for k, v in identified.items()}}
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc))


# ── Health ─────────────────────────────────────────────────────────────────

@app.get("/ai/health")
async def health():
    return {"status": "ok", "service": "SnapClass AI Server"}
