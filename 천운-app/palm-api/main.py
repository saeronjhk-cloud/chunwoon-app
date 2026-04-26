"""
Palm Line Detection API — FastAPI server
Deployed on Google Cloud Run
"""
import base64
import io
import logging

import numpy as np
from PIL import Image
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from palm_detector import PalmLineDetector

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Palm Line Detection API")

# CORS — allow all origins for Vercel frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize detector at startup
detector = PalmLineDetector()
logger.info("Palm line detector initialized (Frangi ridge method)")


class PalmRequest(BaseModel):
    image: str  # base64 data URL


@app.post("/detect")
async def detect_palm_lines(req: PalmRequest):
    try:
        # Decode base64 image
        image_data = req.image
        if "," in image_data:
            image_data = image_data.split(",", 1)[1]

        img_bytes = base64.b64decode(image_data)
        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")

        # Limit size for performance
        MAX_DIM = 800
        if max(img.size) > MAX_DIM:
            ratio = MAX_DIM / max(img.size)
            new_size = (int(img.width * ratio), int(img.height * ratio))
            img = img.resize(new_size, Image.LANCZOS)

        image_rgb = np.array(img)
        logger.info(f"Processing image: {image_rgb.shape}")

        result = detector.detect(image_rgb)

        if "error" in result:
            return {"success": False, "error": result["error"]}

        return result

    except Exception as e:
        logger.error(f"Detection error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health():
    return {"status": "ok", "method": "frangi_ridge", "version": "v6"}
