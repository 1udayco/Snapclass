"""
face_pipeline.py  –  dlib + SVM face recognition pipeline
Used by the FastAPI AI server (ai_server/main.py)
"""

import dlib
import numpy as np
import face_recognition_models
from sklearn.svm import SVC
import streamlit as st  # kept for @st.cache_resource compatibility; swap for functools.lru_cache if running standalone


# ── Model Loading ──────────────────────────────────────────────────────────

def load_dlib_models():
    """Load and return (detector, shape_predictor, face_rec_model)."""
    detector = dlib.get_frontal_face_detector()
    sp = dlib.shape_predictor(
        face_recognition_models.pose_predictor_model_location()
    )
    facerec = dlib.face_recognition_model_v1(
        face_recognition_models.face_recognition_model_location()
    )
    return detector, sp, facerec


# Module-level singletons (loaded once per process)
_detector, _sp, _facerec = None, None, None


def _get_models():
    global _detector, _sp, _facerec
    if _detector is None:
        _detector, _sp, _facerec = load_dlib_models()
    return _detector, _sp, _facerec


# ── Embedding Extraction ───────────────────────────────────────────────────

def get_face_embeddings(image_np: np.ndarray) -> list[np.ndarray]:
    """
    Given an RGB uint8 numpy array, return a list of 128-d face embeddings
    (one per detected face).
    """
    detector, sp, facerec = _get_models()
    faces = detector(image_np, 1)
    encodings = []
    for face in faces:
        shape = sp(image_np, face)
        descriptor = facerec.compute_face_descriptor(image_np, shape, 1)
        encodings.append(np.array(descriptor))
    return encodings


# ── Classifier ────────────────────────────────────────────────────────────

def build_classifier(students: list[dict]) -> dict | None:
    """
    Build an SVM classifier from a list of student dicts:
        { 'student_id': int, 'face_embedding': list[float] }

    Returns a model_data dict or None if not enough data.
    """
    X, y = [], []
    for student in students:
        embedding = student.get("face_embedding")
        if embedding:
            X.append(np.array(embedding))
            y.append(student["student_id"])

    if len(X) < 1:
        return None

    clf = SVC(kernel="linear", probability=True, class_weight="balanced")
    try:
        clf.fit(X, y)
    except ValueError:
        return None

    return {"clf": clf, "X": X, "y": y}


# ── Prediction ────────────────────────────────────────────────────────────

RESEMBLANCE_THRESHOLD = 0.6


def predict_attendance(
    class_image_np: np.ndarray,
    model_data: dict,
) -> dict:
    """
    Given a classroom image and a pre-built model_data dict, return:
        {
          "detected": {student_id: True, ...},   # present students
          "all_students": [student_id, ...],
          "faces_found": int
        }
    """
    encodings = get_face_embeddings(class_image_np)
    result = {"detected": {}, "all_students": [], "faces_found": len(encodings)}

    if not model_data or not encodings:
        return result

    clf: SVC = model_data["clf"]
    X_train: list = model_data["X"]
    y_train: list = model_data["y"]
    all_students = sorted(set(y_train))
    result["all_students"] = all_students

    for encoding in encodings:
        if len(all_students) >= 2:
            predicted_id = int(clf.predict([encoding])[0])
        else:
            predicted_id = int(all_students[0])

        idx = y_train.index(predicted_id)
        student_embedding = X_train[idx]
        distance = float(np.linalg.norm(student_embedding - encoding))

        if distance <= RESEMBLANCE_THRESHOLD:
            result["detected"][predicted_id] = True

    return result
