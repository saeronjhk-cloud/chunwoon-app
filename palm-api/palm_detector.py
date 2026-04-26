"""
Palm Line Detection using Caffe ENet + MediaPipe
v5 — Caffe DNN segmentation approach:
  1. MediaPipe Hands → 21 landmarks → hand region
  2. Caffe ENet (176x176) → 6-channel segmentation map
  3. Extract per-channel masks → classify as life/head/heart/fate
  4. Fallback: OpenCV edge detection if Caffe unavailable
"""

import os
import cv2
import numpy as np
import mediapipe as mp
import logging
from dataclasses import dataclass
from typing import Optional, List, Tuple

logger = logging.getLogger(__name__)

# MediaPipe Hand Landmark indices
WRIST = 0
THUMB_CMC = 1; THUMB_MCP = 2; THUMB_IP = 3; THUMB_TIP = 4
INDEX_MCP = 5; INDEX_PIP = 6; INDEX_DIP = 7; INDEX_TIP = 8
MIDDLE_MCP = 9; MIDDLE_PIP = 10; MIDDLE_DIP = 11; MIDDLE_TIP = 12
RING_MCP = 13; RING_PIP = 14; RING_DIP = 15; RING_TIP = 16
PINKY_MCP = 17; PINKY_PIP = 18; PINKY_DIP = 19; PINKY_TIP = 20

# Caffe ENet input size
ENET_SIZE = 176


@dataclass
class PalmLine:
    key: str
    name: str
    points: list
    length: float
    depth: int
    curvature: int
    detected: bool


class PalmLineDetector:
    def __init__(self):
        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(
            static_image_mode=True,
            max_num_hands=1,
            min_detection_confidence=0.5
        )
        self.caffe_net = None
        self._load_caffe_model()

    def _load_caffe_model(self):
        """Load Caffe ENet model for palm line segmentation"""
        base_dir = os.path.dirname(__file__)
        prototxt = os.path.join(base_dir, 'palm.prototxt')
        caffemodel = os.path.join(base_dir, 'palm.caffemodel')

        if not os.path.exists(prototxt) or not os.path.exists(caffemodel):
            logger.warning("Caffe model files not found, will use OpenCV fallback")
            return

        try:
            self.caffe_net = cv2.dnn.readNetFromCaffe(prototxt, caffemodel)
            logger.info("Caffe ENet palm line model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load Caffe model: {e}")
            self.caffe_net = None

    def detect(self, image_rgb: np.ndarray) -> dict:
        h, w = image_rgb.shape[:2]

        # Step 1: Detect hand landmarks
        results = self.hands.process(image_rgb)
        if not results.multi_hand_landmarks:
            return {"error": "손을 감지할 수 없습니다. 손바닥이 카메라를 향하도록 다시 촬영해주세요."}

        landmarks = results.multi_hand_landmarks[0]
        handedness = "left"
        if results.multi_handedness:
            handedness = results.multi_handedness[0].classification[0].label.lower()

        lm = [(l.x, l.y) for l in landmarks.landmark]

        # Step 2: Extract palm region
        palm_img, palm_box = self._extract_palm_region(image_rgb, lm, w, h)
        if palm_img is None:
            return {"error": "손바닥 영역을 추출할 수 없습니다."}

        px0, py0, px1, py1 = palm_box
        pw, ph = px1 - px0, py1 - py0
        logger.info(f"Palm region: {pw}x{ph} at ({px0},{py0})-({px1},{py1})")

        # Step 3: Run segmentation
        if self.caffe_net is not None:
            lines = self._detect_caffe(palm_img, lm, palm_box, w, h)
            method = "caffe_enet"
            logger.info(f"Caffe ENet: detected {len(lines)} lines")
        else:
            lines = self._detect_opencv_fallback(palm_img, lm, palm_box, w, h)
            method = "opencv"
            logger.info(f"OpenCV fallback: detected {len(lines)} lines")

        return {
            "success": True,
            "method": method,
            "handedness": handedness,
            "landmarks": [[round(x, 4), round(y, 4)] for x, y in lm],
            "lines": [self._line_to_dict(l) for l in lines]
        }

    # ================================================================
    #  CAFFE ENET SEGMENTATION
    # ================================================================

    def _detect_caffe(self, palm_img, lm, palm_box, orig_w, orig_h):
        """
        Run Caffe ENet segmentation on palm image.
        Output: 6-channel map (176x176).
        Channels map to different palm line types.
        """
        px0, py0, px1, py1 = palm_box
        ph_crop, pw_crop = palm_img.shape[:2]

        # Convert RGB → BGR for OpenCV DNN
        bgr = cv2.cvtColor(palm_img, cv2.COLOR_RGB2BGR)

        # Create blob: resize to 176x176, no mean subtraction
        blob = cv2.dnn.blobFromImage(bgr, scalefactor=1.0, size=(ENET_SIZE, ENET_SIZE),
                                      mean=(0, 0, 0), swapRB=False, crop=False)

        self.caffe_net.setInput(blob)
        output = self.caffe_net.forward()  # shape: (1, 6, 176, 176)

        # output[0] has 6 channels
        seg_maps = output[0]  # (6, 176, 176)
        num_channels = seg_maps.shape[0]
        logger.info(f"Caffe output: {num_channels} channels, shape {seg_maps.shape}")

        # Apply softmax-like normalization per pixel to get probabilities
        # Then extract per-channel binary masks
        channel_masks = []
        for ch in range(num_channels):
            raw = seg_maps[ch]
            # Normalize to 0-255
            mn, mx = raw.min(), raw.max()
            if mx - mn > 1e-6:
                norm = ((raw - mn) / (mx - mn) * 255).astype(np.uint8)
            else:
                norm = np.zeros((ENET_SIZE, ENET_SIZE), dtype=np.uint8)

            # Threshold: keep strong activations
            _, binary = cv2.threshold(norm, 80, 255, cv2.THRESH_BINARY)

            # Clean up
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
            binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=2)
            binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel, iterations=1)

            # Count active pixels
            active = cv2.countNonZero(binary)
            channel_masks.append({'mask': binary, 'active': active, 'ch': ch})

        # Sort channels by activation (skip background channel — usually the one with most pixels)
        channel_masks.sort(key=lambda x: x['active'], reverse=True)

        # The channel with the MOST pixels is likely background → skip it
        # Use the next 3-5 channels as palm lines
        line_channels = []
        for cm in channel_masks:
            if cm['active'] < 20:
                continue  # too few pixels
            if cm['active'] > ENET_SIZE * ENET_SIZE * 0.5:
                continue  # likely background
            line_channels.append(cm)

        logger.info(f"Line channels: {len(line_channels)} (activations: {[c['active'] for c in line_channels]})")

        # Extract contours from each channel and map to original coordinates
        all_lines = []
        for lc in line_channels[:6]:  # max 6 line candidates
            mask = lc['mask']

            # Resize mask back to palm crop size
            mask_full = cv2.resize(mask, (pw_crop, ph_crop), interpolation=cv2.INTER_NEAREST)

            # Thin the mask
            mask_thin = self._thin_lines(mask_full)

            # Find contours
            contours, _ = cv2.findContours(mask_thin, cv2.RETR_LIST, cv2.CHAIN_APPROX_NONE)

            min_arc = max(pw_crop, ph_crop) * 0.10
            for c in contours:
                arc = cv2.arcLength(c, False)
                if arc < min_arc:
                    continue
                pts = c.reshape(-1, 2).astype(float)
                # Convert palm-crop pixel coords → original image normalized coords
                norm_pts = [[(px0 + p[0]) / orig_w, (py0 + p[1]) / orig_h] for p in pts]
                total_len = sum(
                    np.sqrt((norm_pts[j][0]-norm_pts[j-1][0])**2 + (norm_pts[j][1]-norm_pts[j-1][1])**2)
                    for j in range(1, len(norm_pts))
                )
                all_lines.append({'pts': norm_pts, 'len': total_len, 'ch': lc['ch']})

        # Classify lines using landmark positions
        return self._classify_lines(all_lines, lm)

    # ================================================================
    #  OPENCV FALLBACK
    # ================================================================

    def _detect_opencv_fallback(self, palm_img, lm, palm_box, orig_w, orig_h):
        """OpenCV-based line detection (fallback when Caffe not available)"""
        px0, py0, px1, py1 = palm_box
        pw, ph = px1 - px0, py1 - py0

        gray = cv2.cvtColor(palm_img, cv2.COLOR_RGB2GRAY)
        non_zero_mask = gray > 10

        clahe = cv2.createCLAHE(clipLimit=4.0, tileGridSize=(6, 6))
        enhanced = clahe.apply(gray)
        filtered = cv2.bilateralFilter(enhanced, 11, 85, 85)

        thresh1 = cv2.adaptiveThreshold(filtered, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                         cv2.THRESH_BINARY_INV, 35, 10)
        thresh2 = cv2.adaptiveThreshold(filtered, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                         cv2.THRESH_BINARY_INV, 55, 14)
        combined = cv2.bitwise_and(thresh1, thresh2)
        combined = cv2.bitwise_and(combined, combined, mask=non_zero_mask.astype(np.uint8) * 255)

        k = max(5, int(min(pw, ph) * 0.02) | 1)
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
        closed = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, kernel, iterations=3)
        kernel_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        cleaned = cv2.morphologyEx(closed, cv2.MORPH_OPEN, kernel_open, iterations=2)
        thinned = self._thin_lines(cleaned)

        contours, _ = cv2.findContours(thinned, cv2.RETR_LIST, cv2.CHAIN_APPROX_NONE)
        min_arc = max(pw, ph) * 0.15
        valid = [c for c in contours if cv2.arcLength(c, False) >= min_arc]

        if len(valid) > 1:
            valid = self._merge_contours(valid, max(pw, ph) * 0.05)
            valid = [c for c in valid if cv2.arcLength(c, False) >= min_arc]

        all_lines = []
        for c in valid:
            pts = c.reshape(-1, 2).astype(float)
            norm_pts = [[(px0 + p[0]) / orig_w, (py0 + p[1]) / orig_h] for p in pts]
            total_len = sum(
                np.sqrt((norm_pts[j][0]-norm_pts[j-1][0])**2 + (norm_pts[j][1]-norm_pts[j-1][1])**2)
                for j in range(1, len(norm_pts))
            )
            all_lines.append({'pts': norm_pts, 'len': total_len, 'ch': -1})

        return self._classify_lines(all_lines, lm)

    # ================================================================
    #  LINE CLASSIFICATION (shared by Caffe & OpenCV)
    # ================================================================

    def _classify_lines(self, all_lines, lm):
        """Classify detected lines into life/head/heart/fate using landmark positions"""
        wrist = lm[WRIST]
        thumb_cmc = lm[THUMB_CMC]; thumb_mcp = lm[THUMB_MCP]
        index_mcp = lm[INDEX_MCP]; middle_mcp = lm[MIDDLE_MCP]
        ring_mcp = lm[RING_MCP]; pinky_mcp = lm[PINKY_MCP]

        palm_cx = (index_mcp[0] + pinky_mcp[0]) / 2
        palm_cy = (index_mcp[1] + wrist[1]) / 2
        mcp_line_y = (index_mcp[1] + middle_mcp[1] + ring_mcp[1] + pinky_mcp[1]) / 4
        palm_width = abs(pinky_mcp[0] - thumb_mcp[0])

        scored = []
        for i, line in enumerate(all_lines):
            pts = line['pts']
            if len(pts) < 5:
                continue
            arr = np.array(pts)
            cx, cy = arr.mean(axis=0)
            total_len = line['len']
            dx = pts[-1][0] - pts[0][0]
            dy = pts[-1][1] - pts[0][1]
            angle = np.arctan2(dy, dx)
            chord = np.sqrt(dx**2 + dy**2) + 1e-6
            curve_ratio = total_len / chord
            x_span = arr[:, 0].max() - arr[:, 0].min()
            y_span = arr[:, 1].max() - arr[:, 1].min()
            is_horizontal = abs(angle) < 0.7 or abs(angle) > 2.4
            is_vertical = 0.8 < abs(angle) < 2.3

            # LIFE LINE
            life_score = 0
            thumb_rx = (thumb_cmc[0] + thumb_mcp[0]) / 2
            near_thumb = sum(1 for p in pts if abs(p[0] - thumb_rx) < palm_width * 0.35)
            if near_thumb > len(pts) * 0.3: life_score += 3
            if cx < palm_cx: life_score += 2
            if curve_ratio > 1.3: life_score += 3
            elif curve_ratio > 1.15: life_score += 2
            if y_span > 0.10: life_score += 2
            if total_len > 0.12: life_score += 2

            # HEAD LINE
            head_score = 0
            head_zone_y = (mcp_line_y + palm_cy) / 2
            if abs(cy - head_zone_y) < 0.10: head_score += 3
            if is_horizontal: head_score += 3
            if min(pts[0][0], pts[-1][0]) < palm_cx: head_score += 2
            if x_span > 0.08: head_score += 2

            # HEART LINE
            heart_score = 0
            heart_zone_y = mcp_line_y + 0.04
            if abs(cy - heart_zone_y) < 0.08: heart_score += 3
            if cy < head_zone_y: heart_score += 2
            if is_horizontal: heart_score += 3
            if x_span > 0.10: heart_score += 2

            # FATE LINE
            fate_score = 0
            if abs(cx - palm_cx) < 0.10: fate_score += 3
            if is_vertical: fate_score += 4
            if y_span > x_span * 1.5: fate_score += 2

            scored.append({
                'idx': i, 'pts': pts, 'len': total_len,
                'curve_ratio': curve_ratio,
                'life': life_score, 'head': head_score,
                'heart': heart_score, 'fate': fate_score,
            })

        # Greedy assignment
        assigned = {}
        used = set()
        for lt in ['life', 'heart', 'head', 'fate']:
            best_idx, best_score = -1, 3
            for s in scored:
                if s['idx'] in used:
                    continue
                if s[lt] > best_score and s['len'] > 0.04:
                    best_score = s[lt]
                    best_idx = s['idx']
            if best_idx >= 0:
                assigned[lt] = scored[[s['idx'] for s in scored].index(best_idx)]
                used.add(best_idx)

        # Build result
        result = []
        for key, name in [('life', '생명선'), ('head', '두뇌선'), ('heart', '감정선'), ('fate', '운명선')]:
            if key in assigned:
                s = assigned[key]
                pts = s['pts']
                step = max(1, len(pts) // 15)
                simplified = [pts[i] for i in range(0, len(pts), step)]
                if pts[-1] not in simplified:
                    simplified.append(pts[-1])
                simplified = self._smooth_points(simplified)

                result.append(PalmLine(
                    key=key, name=name,
                    points=[[round(p[0], 4), round(p[1], 4)] for p in simplified],
                    length=round(s['len'], 4),
                    depth=2,
                    curvature=self._classify_curvature(s['curve_ratio']),
                    detected=True
                ))
            else:
                fb = self._fallback_line(key, lm)
                fb_len = sum(np.sqrt((fb[j][0]-fb[j-1][0])**2 + (fb[j][1]-fb[j-1][1])**2)
                             for j in range(1, len(fb)))
                chord = np.sqrt((fb[-1][0]-fb[0][0])**2 + (fb[-1][1]-fb[0][1])**2) + 1e-6
                result.append(PalmLine(
                    key=key, name=name,
                    points=[[round(p[0], 4), round(p[1], 4)] for p in fb],
                    length=round(fb_len, 4), depth=1,
                    curvature=self._classify_curvature(fb_len / chord),
                    detected=False
                ))
        return result

    # ================================================================
    #  PALM REGION EXTRACTION
    # ================================================================

    def _extract_palm_region(self, image_rgb, lm, w, h):
        """Extract hand region using convex hull of all 21 landmarks"""
        all_pts = np.array(
            [[int(lm[i][0] * w), int(lm[i][1] * h)] for i in range(21)],
            dtype=np.int32
        )
        hull = cv2.convexHull(all_pts)
        x_min, y_min = all_pts.min(axis=0)
        x_max, y_max = all_pts.max(axis=0)
        pad_x = int((x_max - x_min) * 0.12)
        pad_y = int((y_max - y_min) * 0.12)
        x0 = max(0, x_min - pad_x)
        y0 = max(0, y_min - pad_y)
        x1 = min(w, x_max + pad_x)
        y1 = min(h, y_max + pad_y)

        if x1 - x0 < 50 or y1 - y0 < 50:
            return None, None

        mask = np.zeros((h, w), dtype=np.uint8)
        cv2.fillConvexPoly(mask, hull, 255)
        dilate_size = max(15, int(max(x_max - x_min, y_max - y_min) * 0.08))
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (dilate_size, dilate_size))
        mask = cv2.dilate(mask, kernel, iterations=1)
        masked = cv2.bitwise_and(image_rgb, image_rgb, mask=mask)
        palm_crop = masked[y0:y1, x0:x1]

        return palm_crop, (x0, y0, x1, y1)

    # ================================================================
    #  UTILITIES
    # ================================================================

    def _thin_lines(self, binary_mask):
        """Morphological thinning"""
        skel = np.zeros(binary_mask.shape, np.uint8)
        element = cv2.getStructuringElement(cv2.MORPH_CROSS, (3, 3))
        img = binary_mask.copy()
        for _ in range(50):
            eroded = cv2.erode(img, element)
            dilated = cv2.dilate(eroded, element)
            diff = cv2.subtract(img, dilated)
            skel = cv2.bitwise_or(skel, diff)
            img = eroded.copy()
            if cv2.countNonZero(img) == 0:
                break
        return skel

    def _merge_contours(self, contours, max_gap):
        """Merge contour fragments that are close together"""
        segments = []
        for c in contours:
            pts = c.reshape(-1, 2)
            if len(pts) < 2:
                continue
            segments.append({'pts': pts, 'start': pts[0], 'end': pts[-1], 'used': False})

        merged = []
        for seg in segments:
            if seg['used']:
                continue
            chain = list(seg['pts'])
            seg['used'] = True
            changed = True
            while changed:
                changed = False
                for other in segments:
                    if other['used']:
                        continue
                    dists = [
                        np.sqrt((chain[-1][0]-other['start'][0])**2 + (chain[-1][1]-other['start'][1])**2),
                        np.sqrt((chain[-1][0]-other['end'][0])**2 + (chain[-1][1]-other['end'][1])**2),
                        np.sqrt((chain[0][0]-other['start'][0])**2 + (chain[0][1]-other['start'][1])**2),
                        np.sqrt((chain[0][0]-other['end'][0])**2 + (chain[0][1]-other['end'][1])**2),
                    ]
                    min_d = min(dists)
                    idx = dists.index(min_d)
                    if min_d < max_gap:
                        if idx == 0: chain = list(chain) + list(other['pts'])
                        elif idx == 1: chain = list(chain) + list(other['pts'][::-1])
                        elif idx == 2: chain = list(other['pts'][::-1]) + list(chain)
                        else: chain = list(other['pts']) + list(chain)
                        other['used'] = True
                        changed = True
            merged.append(np.array(chain).reshape(-1, 1, 2).astype(np.int32))
        return merged

    def _smooth_points(self, pts):
        if len(pts) < 5:
            return pts
        smoothed = [pts[0]]
        for i in range(1, len(pts) - 1):
            sx = (pts[i-1][0] + pts[i][0] + pts[i+1][0]) / 3
            sy = (pts[i-1][1] + pts[i][1] + pts[i+1][1]) / 3
            smoothed.append([sx, sy])
        smoothed.append(pts[-1])
        return smoothed

    def _classify_curvature(self, ratio):
        if ratio < 1.05: return 0
        elif ratio < 1.15: return 1
        elif ratio < 1.3: return 2
        else: return 3

    def _fallback_line(self, key, lm):
        wrist = lm[WRIST]
        thumb_cmc = lm[THUMB_CMC]; thumb_mcp = lm[THUMB_MCP]
        index_mcp = lm[INDEX_MCP]; middle_mcp = lm[MIDDLE_MCP]
        ring_mcp = lm[RING_MCP]; pinky_mcp = lm[PINKY_MCP]

        def mid(a, b, t=0.5):
            return (a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t)

        pw = abs(pinky_mcp[0] - index_mcp[0])
        ph_val = abs(wrist[1] - middle_mcp[1])

        if key == 'life':
            p0 = mid(thumb_mcp, index_mcp, 0.45)
            p1 = (mid(thumb_cmc, index_mcp, 0.35)[0], mid(thumb_mcp, middle_mcp, 0.6)[1])
            p2 = (thumb_cmc[0] + pw*0.08, mid(thumb_cmc, wrist, 0.3)[1])
            p3 = (thumb_cmc[0] + pw*0.05, mid(thumb_cmc, wrist, 0.55)[1])
            p4 = (mid(thumb_cmc, wrist, 0.7)[0] + pw*0.08, mid(thumb_cmc, wrist, 0.78)[1])
            p5 = (mid(thumb_cmc, wrist, 0.92)[0] + pw*0.12, mid(thumb_cmc, wrist, 0.92)[1])
            return [list(p) for p in [p0, p1, p2, p3, p4, p5]]
        elif key == 'head':
            p0 = mid(thumb_mcp, index_mcp, 0.45)
            p0 = (p0[0], p0[1] + ph_val*0.04)
            p1 = (mid(index_mcp, middle_mcp, 0.5)[0], mid(index_mcp, middle_mcp, 0.5)[1] + ph_val*0.12)
            p2 = (mid(middle_mcp, ring_mcp, 0.5)[0], mid(middle_mcp, ring_mcp, 0.5)[1] + ph_val*0.15)
            p3 = (mid(ring_mcp, pinky_mcp, 0.6)[0], mid(ring_mcp, wrist, 0.32)[1])
            return [list(p) for p in [p0, p1, p2, p3]]
        elif key == 'heart':
            p0 = (pinky_mcp[0], pinky_mcp[1] + ph_val*0.06)
            p1 = (mid(pinky_mcp, ring_mcp, 0.5)[0], mid(pinky_mcp, ring_mcp, 0.5)[1] + ph_val*0.07)
            p2 = (mid(ring_mcp, middle_mcp, 0.5)[0], mid(ring_mcp, middle_mcp, 0.5)[1] + ph_val*0.06)
            p3 = (mid(middle_mcp, index_mcp, 0.5)[0], mid(middle_mcp, index_mcp, 0.5)[1] + ph_val*0.05)
            p4 = (index_mcp[0], index_mcp[1] + ph_val*0.07)
            return [list(p) for p in [p0, p1, p2, p3, p4]]
        else:
            mx = (middle_mcp[0] + mid(wrist, middle_mcp)[0]) / 2
            p0 = (mx, wrist[1] - ph_val*0.03)
            p1 = (mx, mid(wrist, middle_mcp, 0.35)[1])
            p2 = (middle_mcp[0], mid(wrist, middle_mcp, 0.65)[1])
            p3 = (middle_mcp[0], middle_mcp[1] + ph_val*0.05)
            return [list(p) for p in [p0, p1, p2, p3]]

    def _line_to_dict(self, line: PalmLine) -> dict:
        return {
            'key': line.key, 'name': line.name,
            'points': line.points, 'length': line.length,
            'depth': line.depth, 'curvature': line.curvature,
            'detected': line.detected
        }
