"""
PaddleOCR sidecar service.

Accepts a JSON body with a base64-encoded PDF, converts each page to an image,
runs PaddleOCR on each image, and returns the aggregated text with confidence.

POST /ocr
  Body: { "pdf_base64": "<base64>", "languages": ["tha", "eng"] }
  Response: { "text": "...", "page_count": N, "confidence": 0.0-1.0, "warnings": [...] }

GET /health
  Response: { "status": "ok" }
"""

import base64
import io
import logging
import os
import re
import tempfile
from typing import Any

from fastapi import FastAPI, HTTPException
from paddleocr import PaddleOCR
from pdf2image import convert_from_bytes
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="DocAI PaddleOCR Sidecar", version="1.0.0")

# Initialise PaddleOCR once at startup with Thai + English support.
# use_angle_cls=True enables document-level layout orientation detection.
_ocr_instance: PaddleOCR | None = None


def get_ocr() -> PaddleOCR:
    global _ocr_instance
    if _ocr_instance is None:
        logger.info("Initialising PaddleOCR (first request may be slow)…")
        _ocr_instance = PaddleOCR(
            use_angle_cls=True,
            lang="latin",  # 'latin' covers Thai in PaddleOCR's multilingual pack
            show_log=False,
        )
    return _ocr_instance


class OcrRequest(BaseModel):
    pdf_base64: str
    languages: list[str] = ["tha", "eng"]


class OcrResponse(BaseModel):
    text: str
    page_count: int
    confidence: float
    warnings: list[str] = []


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/ocr", response_model=OcrResponse)
def ocr_pdf(request: OcrRequest) -> OcrResponse:
    try:
        pdf_bytes = base64.b64decode(request.pdf_base64)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid base64 PDF: {exc}") from exc

    warnings: list[str] = []
    texts: list[str] = []
    confidence_scores: list[float] = []

    try:
        images = convert_from_bytes(pdf_bytes, dpi=200)
    except Exception as exc:
        logger.error("pdf2image conversion failed: %s", exc)
        return OcrResponse(text="", page_count=0, confidence=0.0, warnings=[f"PDF conversion failed: {exc}"])

    ocr = get_ocr()

    for page_num, image in enumerate(images, start=1):
        try:
            img_byte_arr = io.BytesIO()
            image.save(img_byte_arr, format="PNG")
            img_byte_arr.seek(0)

            result: list[Any] | None = ocr.ocr(img_byte_arr.read(), cls=True)
            if not result or not result[0]:
                warnings.append(f"Page {page_num}: no text detected")
                continue

            page_lines: list[str] = []
            for line in result[0]:
                # Each line: [[x1,y1],[x2,y2],[x3,y3],[x4,y4]], [text, confidence]
                if line and len(line) >= 2:
                    text_info = line[1]
                    if isinstance(text_info, (list, tuple)) and len(text_info) >= 2:
                        text_val = str(text_info[0])
                        conf_val = float(text_info[1])
                        page_lines.append(text_val)
                        confidence_scores.append(conf_val)

            texts.append("\n".join(page_lines))
        except Exception as exc:
            logger.warning("OCR failed on page %d: %s", page_num, exc)
            warnings.append(f"Page {page_num} OCR failed: {exc}")

    full_text = "\n\f".join(texts).strip()
    avg_confidence = sum(confidence_scores) / len(confidence_scores) if confidence_scores else 0.0

    logger.info(
        "OCR complete: pages=%d, chars=%d, confidence=%.3f",
        len(images),
        len(full_text),
        avg_confidence,
    )

    return OcrResponse(
        text=full_text,
        page_count=len(images),
        confidence=round(avg_confidence, 4),
        warnings=warnings,
    )
