"""
ChunWoon (天運) Palm Line Detection API
Deployed on Google Cloud Run
"""

import io
import base64
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image
import numpy as np

from palm_detector import PalmLineDetector

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="ChunWoon Palm API", version="1.0.0")

# CORS — allow requests from any origin (Vercel frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize detector (singleton — loads MediaPipe model once)
detector = PalmLineDetector()


class PalmRequest(BaseModel):
    image: str  # base64 encoded image (data URL or raw base64)


class HealthResponse(BaseModel):
    status: str
    version: str


@app.get("/", response_model=HealthResponse)
async def health_check():
    return {"status": "ok", "version": "1.0.0"}


@app.post("/detect")
async def detect_palm_lines(req: PalmRequest):
    """
    Receive a base64-encoded palm image,
    return detected palm line coordinates and characteristics.
    """
    try:
        # Decode base64 image
        image_data = req.image
        if "," in image_data:
            image_data = image_data.split(",", 1)[1]

        img_bytes = base64.b64decode(image_data)
        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")

        # Limit image size for performance (max 1024px on longest side)
        max_dim = 1024
        if max(img.size) > max_dim:
            ratio = max_dim / max(img.size)
            new_size = (int(img.width * ratio), int(img.height * ratio))
            img = img.resize(new_size, Image.LANCZOS)

        img_array = np.array(img)
        logger.info(f"Processing image: {img_array.shape}")

        # Run detection
        result = detector.detect(img_array)

        if "error" in result:
            return {"success": False, "error": result["error"]}

        return result

    except Exception as e:
        logger.error(f"Detection failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/debug")
async def debug_detection(req: PalmRequest):
    """
    Debug endpoint: returns palm crop + line mask as base64 images
    so we can visualize what the detector sees.
    """
    import cv2

    try:
        image_data = req.image
        if "," in image_data:
            image_data = image_data.split(",", 1)[1]

        img_bytes = base64.b64decode(image_data)
        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")

        max_dim = 1024
        if max(img.size) > max_dim:
            ratio = max_dim / max(img.size)
            new_size = (int(img.width * ratio), int(img.height * ratio))
            img = img.resize(new_size, Image.LANCZOS)

        img_array = np.array(img)
        h, w = img_array.shape[:2]

        # Run MediaPipe
        results = detector.hands.process(img_array)
        if not results.multi_hand_landmarks:
            return {"error": "손 감지 실패"}

        lm = [(l.x, l.y) for l in results.multi_hand_landmarks[0].landmark]

        # Extract palm region
        palm_img, palm_box = detector._extract_palm_region(img_array, lm, w, h)
        if palm_img is None:
            return {"error": "palm region 추출 실패"}

        # Get line mask
        if detector.unet is not None:
            line_mask = detector._detect_lines_unet(palm_img)
            method = "unet"
        else:
            line_mask = detector._detect_lines_opencv(palm_img)
            method = "opencv"

        # Encode palm crop as base64
        palm_pil = Image.fromarray(palm_img)
        buf1 = io.BytesIO()
        palm_pil.save(buf1, format='PNG')
        palm_b64 = base64.b64encode(buf1.getvalue()).decode()

        # Encode line mask as base64
        mask_pil = Image.fromarray(line_mask)
        buf2 = io.BytesIO()
        mask_pil.save(buf2, format='PNG')
        mask_b64 = base64.b64encode(buf2.getvalue()).decode()

        # Draw landmarks on original image for reference
        debug_img = img_array.copy()
        for i, (lx, ly) in enumerate(lm):
            px, py = int(lx * w), int(ly * h)
            cv2.circle(debug_img, (px, py), 4, (0, 255, 0), -1)
            cv2.putText(debug_img, str(i), (px+5, py-5), cv2.FONT_HERSHEY_SIMPLEX, 0.3, (255,255,0), 1)
        # Draw palm box
        px0, py0, px1, py1 = palm_box
        cv2.rectangle(debug_img, (px0, py0), (px1, py1), (255, 0, 0), 2)

        debug_pil = Image.fromarray(debug_img)
        buf3 = io.BytesIO()
        debug_pil.save(buf3, format='PNG')
        debug_b64 = base64.b64encode(buf3.getvalue()).decode()

        return {
            "method": method,
            "palm_box": [px0, py0, px1, py1],
            "image_size": [w, h],
            "palm_crop": f"data:image/png;base64,{palm_b64}",
            "line_mask": f"data:image/png;base64,{mask_b64}",
            "debug_img": f"data:image/png;base64,{debug_b64}"
        }

    except Exception as e:
        logger.error(f"Debug failed: {e}", exc_info=True)
        return {"error": str(e)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
