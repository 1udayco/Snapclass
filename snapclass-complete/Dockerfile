# ── SnapClass AI Server – Docker image ────────────────────────────────────
# Build: docker build -t snapclass-ai .
# Run:   docker run -p 8000:8000 snapclass-ai

FROM python:3.11-slim

# System deps needed by dlib (cmake + C++ compiler + BLAS for speed)
RUN apt-get update && apt-get install -y --no-install-recommends \
    cmake \
    build-essential \
    libopenblas-dev \
    liblapack-dev \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first (layer-cache friendly)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY ai_server/ ./ai_server/

EXPOSE 8000

CMD ["uvicorn", "ai_server.main:app", "--host", "0.0.0.0", "--port", "8000"]
