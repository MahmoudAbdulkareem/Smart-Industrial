FROM python:3.11-slim

WORKDIR /app

# System deps for scikit-learn / numpy
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl gcc g++ && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY . .

# Pre-train models at build time so the container starts instantly
# (model.pkl, scaler.pkl, rul_model.pkl, rul_scaler.pkl are generated here)
RUN python train.py

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
