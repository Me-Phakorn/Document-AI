FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
  tesseract-ocr tesseract-ocr-tha tesseract-ocr-eng \
  poppler-utils ghostscript ocrmypdf unpaper \
  && rm -rf /var/lib/apt/lists/*
