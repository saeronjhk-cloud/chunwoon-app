"""
Palm Line Detection v6 — Frangi Ridge Filter approach
All dependencies: BSD / Apache licensed (no legal issues)

Pipeline:
  1. MediaPipe Hands → 21 landmarks → hand region
  2. Green channel → Bilateral filter → CLAHE → Frangi ridge detection
  3. Skeletonize → contour extraction → classify as life/head/heart/fate
  4. Fallback: landmark-based geometric estimation

Libraries used:
  - mediapipe (Apache-2.0)
  - opencv-python-headless (Apache-2.0)
  - scikit-image (BSD-3-Clause)
  - numpy (BSD-3-Clause)
  - Pillow (HPND, permissive)
"""

import cv2
import numpy as np
import mediapipe as mp
import logging
from dataclasses import dataclass
from typing import List, Tuple
from skimage.filters import frangi, hessian
from skimage.morphology import skeletonize

logger = logging.getLogger(__name__)

# MediaPipe Hand Landmark indices
WRIST = 0
THUMB_CMC = 1; THUMB_MCP = 2; THUMB_IP = 3; THUMB_TIP = 4
INDEX_MCP = 5; INDEX_PIP = 6; INDEX_DIP = 7; INDEX_TIP = 8
MIDDLE_MCP = 9; MIDDLE_PIP = 10; MIDDLE_DIP = 11; MIDDLE_TIP = 12
RING_MCP = 13; RING_PIP = 14; RING_DIP = 15; RING_TIP = 16
PINKY_MCP = 17; PINKY_PIP = 18; PINKY_DIP = 19; PINKY_TIP = 20


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

        # Step 3: Frangi ridge detection
        lines = self._detect_frangi(palm_img, lm, palm_box, w, h)
        logger.info(f"Frangi: detected {len([l for l in lines if l.detected])} real lines, "
                    f"{len([l for l in lines if not l.detected])} fallback lines")

        return {
            "success": True,
            "method": "frangi_ridge",
            "handedness": handedness,
            "landmarks": [[round(x, 4), round(y, 4)] for x, y in lm],
            "lines": [self._line_to_dict(l) for l in lines]
        }

    # ================================================================
    #  FRANGI RIDGE DETECTION
    # ================================================================

    def _detect_frangi(self, palm_img, lm, palm_box, orig_w, orig_h):
        """
        Frangi filter detects ridge/valley structures.
        Palm creases are dark valleys on lighter skin — perfect for Frangi.
        """
        px0, py0, px1, py1 = palm_box
        ph_crop, pw_crop = palm_img.shape[:2]

        # 1. Extract green channel (best contrast for palm creases on skin)
        green = palm_img[:, :, 1]

        # 2. Bilateral filter: smooth skin texture, preserve crease edges
        filtered = cv2.bilateralFilter(green, 9, 75, 75)

        # 3. CLAHE: enhance contrast of creases
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(filtered)

        # 4. Frangi ridge detection
        # sigmas controls the width of ridges to detect
        # Palm creases are typically 2-6 pixels wide at typical image resolutions
        scale = max(pw_crop, ph_crop) / 400  # normalize for image size
        sigmas = [max(1, s * scale) for s in [1, 2, 3, 4, 5]]

        ridges = frangi(
            enhanced.astype(np.float64),
            sigmas=sigmas,
            alpha=0.5,     # plate-like vs line-like sensitivity
            beta=0.5,      # blob suppression
            gamma=15,      # background suppression (structuredness)
            black_ridges=True  # palm creases are darker than surrounding skin
        )

        # 5. Normalize to 0-255
        if ridges.max() > 0:
            ridge_norm = (ridges / ridges.max() * 255).astype(np.uint8)
        else:
            logger.warning("Frangi returned empty result, using adaptive threshold fallback")
            return self._detect_adaptive_fallback(palm_img, lm, palm_box, orig_w, orig_h)

        # 6. Threshold — keep strong ridges
        # Use Otsu's method for automatic threshold
        _, binary = cv2.threshold(ridge_norm, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        # If Otsu gives too much or too little, use fixed threshold
        active_ratio = cv2.countNonZero(binary) / (pw_crop * ph_crop)
        if active_ratio > 0.3 or active_ratio < 0.01:
            _, binary = cv2.threshold(ridge_norm, 40, 255, cv2.THRESH_BINARY)

        # 7. Morphological cleanup
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=2)
        binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel, iterations=1)

        # 8. Skeletonize to get thin lines
        skel = skeletonize(binary > 0).astype(np.uint8) * 255

        # 9. Find contours
        contours, _ = cv2.findContours(skel, cv2.RETR_LIST, cv2.CHAIN_APPROX_NONE)

        # 10. Filter by minimum arc length
        min_arc = max(pw_crop, ph_crop) * 0.12
        valid = [c for c in contours if cv2.arcLength(c, False) >= min_arc]

        # 11. Merge nearby contour fragments
        if len(valid) > 1:
            valid = self._merge_contours(valid, max(pw_crop, ph_crop) * 0.06)
            valid = [c for c in valid if cv2.arcLength(c, False) >= min_arc]

        # Sort by arc length (longest first)
        valid.sort(key=lambda c: cv2.arcLength(c, False), reverse=True)

        # 12. Convert to normalized coordinates
        all_lines = []
        for c in valid[:10]:  # max 10 candidates
            pts = c.reshape(-1, 2).astype(float)
            norm_pts = [[(px0 + p[0]) / orig_w, (py0 + p[1]) / orig_h] for p in pts]
            total_len = sum(
                np.sqrt((norm_pts[j][0]-norm_pts[j-1][0])**2 + (norm_pts[j][1]-norm_pts[j-1][1])**2)
                for j in range(1, len(norm_pts))
            )
            all_lines.append({'pts': norm_pts, 'len': total_len, 'ch': -1})

        logger.info(f"Frangi detected {len(all_lines)} line candidates "
                    f"(from {len(contours)} total contours, {len(valid)} after filtering)")

        # 13. Classify lines using landmark positions
        return self._classify_lines(all_lines, lm)

    # ================================================================
    #  ADAPTIVE THRESHOLD FALLBACK
    # ================================================================

    def _detect_adaptive_fallback(self, palm_img, lm, palm_box, orig_w, orig_h):
        """Fallback when Frangi doesn't produce results"""
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

        skel = skeletonize(cleaned > 0).astype(np.uint8) * 255

        contours, _ = cv2.findContours(skel, cv2.RETR_LIST, cv2.CHAIN_APPROX_NONE)
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
    #  LINE CLASSIFICATION (shared)
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

            # LIFE LINE — curves around thumb mount
            life_score = 0
            thumb_rx = (thumb_cmc[0] + thumb_mcp[0]) / 2
            near_thumb = sum(1 for p in pts if abs(p[0] - thumb_rx) < palm_width * 0.35)
            if near_thumb > len(pts) * 0.3: life_score += 3
            if cx < palm_cx: life_score += 2
            if curve_ratio > 1.3: life_score += 3
            elif curve_ratio > 1.15: life_score += 2
            if y_span > 0.10: life_score += 2
            if total_len > 0.12: life_score += 2

            # HEAD LINE — horizontal, middle zone
            head_score = 0
            head_zone_y = (mcp_line_y + palm_cy) / 2
            if abs(cy - head_zone_y) < 0.10: head_score += 3
            if is_horizontal: head_score += 3
            if min(pts[0][0], pts[-1][0]) < palm_cx: head_score += 2
            if x_span > 0.08: head_score += 2

            # HEART LINE — horizontal, near finger bases
            heart_score = 0
            heart_zone_y = mcp_line_y + 0.04
            if abs(cy - heart_zone_y) < 0.08: heart_score += 3
            if cy < head_zone_y: heart_score += 2
            if is_horizontal: heart_score += 3
            if x_span > 0.10: heart_score += 2

            # FATE LINE — vertical, center of palm
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
                step = max(1, len(pts) // 20)
                simplified = [pts[i] for i in range(0, len(pts), step)]
                if pts[-1] not in simplified:
                    simplified.append(pts[-1])
                simplified = self._smooth_points(simplified)

                # Estimate depth from ridge intensity
                depth = 2 if s['len'] > 0.15 else 1

                result.append(PalmLine(
                    key=key, name=name,
                    points=[[round(p[0], 4), round(p[1], 4)] for p in simplified],
                    length=round(s['len'], 4),
                    depth=depth,
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
        """Simple moving average smoothing"""
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
        """Geometric estimation when detection fails for a line"""
        wrist = lm[WRIST]
        thumb_cmc = lm[THUMB_CMC]; thumb_mcp = lm[THUMB_MCP]
        index_mcp = lm[INDEX_MCP]; middle_mcp = lm[MIDDLE_MCP]
        ring_mcp = lm[RING_MCP]; pinky_mcp = lm[PINKY_MCP]

        def mid(a, b, t=0.5):
            return (a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t)

        pw = abs(pinky_mcp[0] - index_mcp[0])
        ph_val = abs(wrist[1] - middle_mcp[1])

        if key == 'life':
            p0 = mid(thumb_mcp, index_mcp, 0.5)
            p1 = (mid(thumb_cmc, middle_mcp, 0.32)[0], mid(thumb_mcp, middle_mcp, 0.55)[1])
            p2 = (thumb_cmc[0] + pw*0.15, mid(thumb_cmc, wrist, 0.20)[1])
            p3 = (thumb_cmc[0] + pw*0.12, mid(thumb_cmc, wrist, 0.45)[1])
            p4 = (mid(thumb_cmc, wrist, 0.65)[0] + pw*0.10, mid(thumb_cmc, wrist, 0.68)[1])
            p5 = (mid(thumb_cmc, wrist, 0.85)[0] + pw*0.13, mid(thumb_cmc, wrist, 0.88)[1])
            return [list(p) for p in [p0, p1, p2, p3, p4, p5]]
        elif key == 'head':
            p0 = mid(thumb_mcp, index_mcp, 0.5)
            p0 = (p0[0], p0[1] + ph_val*0.04)
            p1 = (mid(index_mcp, middle_mcp, 0.5)[0], mid(index_mcp, middle_mcp, 0.5)[1] + ph_val*0.14)
            p2 = (mid(middle_mcp, ring_mcp, 0.5)[0], mid(middle_mcp, ring_mcp, 0.5)[1] + ph_val*0.17)
            p3 = (mid(ring_mcp, pinky_mcp, 0.4)[0], mid(ring_mcp, pinky_mcp, 0.4)[1] + ph_val*0.20)
            p4 = (pinky_mcp[0] + pw*0.05, mid(pinky_mcp, wrist, 0.30)[1])
            return [list(p) for p in [p0, p1, p2, p3, p4]]
        elif key == 'heart':
            p0 = (pinky_mcp[0] + pw*0.02, pinky_mcp[1] + ph_val*0.06)
            p1 = (mid(pinky_mcp, ring_mcp, 0.5)[0], mid(pinky_mcp, ring_mcp, 0.5)[1] + ph_val*0.07)
            p2 = (mid(ring_mcp, middle_mcp, 0.5)[0], mid(ring_mcp, middle_mcp, 0.5)[1] + ph_val*0.06)
            p3 = (mid(middle_mcp, index_mcp, 0.5)[0], mid(middle_mcp, index_mcp, 0.5)[1] + ph_val*0.05)
            p4 = (index_mcp[0] - pw*0.02, index_mcp[1] + ph_val*0.06)
            return [list(p) for p in [p0, p1, p2, p3, p4]]
        else:  # fate
            palm_cx = (index_mcp[0] + pinky_mcp[0]) / 2
            mx = (palm_cx + middle_mcp[0]) / 2
            p0 = (mx, wrist[1] - ph_val*0.02)
            p1 = (mx, mid(wrist, middle_mcp, 0.30)[1])
            p2 = (mid((mx, 0), middle_mcp, 0.5)[0], mid(wrist, middle_mcp, 0.55)[1])
            p3 = (middle_mcp[0], mid(wrist, middle_mcp, 0.78)[1])
            p4 = (middle_mcp[0], middle_mcp[1] + ph_val*0.05)
            return [list(p) for p in [p0, p1, p2, p3, p4]]

    def _line_to_dict(self, line: PalmLine) -> dict:
        return {
            'key': line.key, 'name': line.name,
            'points': line.points, 'length': line.length,
            'depth': line.depth, 'curvature': line.curvature,
            'detected': line.detected
        }
