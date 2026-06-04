FROM python:3.11-slim

# Install PaddleOCR system dependencies.
# Includes libGL and libglib2.0 for OpenCV, and poppler-utils for PDF-to-image conversion.
RUN apt-get update && apt-get install -y --no-install-recommends \
  libgl1 libglib2.0-0 \
  poppler-utils \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
# Install Python dependencies; use --no-cache-dir to keep image size small.
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
