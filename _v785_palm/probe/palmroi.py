"""★손가락을 먼저 확정해 배제한다 (제이 제안 · 2026-08-26).
MediaPipe Hands 21 랜드마크로 ★손바닥 다각형을 만든다.

★★v2 (2026-08-28) — **P-23 엄지 방향 비대칭 확장 · ★구조만** 추가했습니다.
   ★근거: 유형체계 §11-4 실측 — RLC 미검출 23장 중 ★**12장(52 %)이 ROI 절단**이었습니다.
   ★★계수 `radial_extra` 는 ★**미확정입니다.** 기본값 `None` = ★**v1 거동 그대로**입니다.
      ⟹ 이 파일을 바꿔도 harness.py 결과는 ★한 픽셀도 달라지지 않습니다.
   ★★계수는 `thresholds.py` 의 G-7(Tier-B 라벨)로만 확정됩니다.
      ★2026-08-26 에 GT 없이 눈대중으로 임계를 정해 ★배정률 4 % 가 나왔습니다 — 반복하지 않습니다.

★§1-4 교훈 준수: 랜드마크로 「선의 위치」를 추론하지 않습니다.
   ★영역 「경계」에만 씁니다 — 그것은 추론이 아니라 실측입니다.
"""
import numpy as np, mediapipe as mp

WRIST, T_CMC, T_MCP, I_MCP, M_MCP, R_MCP, P_MCP = 0, 1, 2, 5, 9, 13, 17
T_IP, T_TIP = 3, 4                      # ★엄지 「자체」 — 확장이 여기 닿으면 손가락 침입입니다
POLY_IDX = [WRIST, T_CMC, T_MCP, I_MCP, M_MCP, R_MCP, P_MCP]
RADIAL_IDX = (WRIST, T_CMC, T_MCP)      # ★노쪽(엄지 쪽) 변을 이루는 꼭짓점 — RLC 를 자르는 변입니다
_H = mp.solutions.hands


class RoiIntrusion(Exception):
    """★확장이 엄지 자체에 닿았습니다 — 조용히 되돌리지 않고 ★멈춥니다(fail-closed)."""


def landmarks(rgb_uint8, min_conf=0.3):
    with _H.Hands(static_image_mode=True, max_num_hands=1,
                  min_detection_confidence=min_conf) as h:
        r = h.process(np.ascontiguousarray(rgb_uint8))
    if not r.multi_hand_landmarks: return None, None
    H, W = rgb_uint8.shape[:2]
    lm = np.array([[p.x*W, p.y*H] for p in r.multi_hand_landmarks[0].landmark])
    side = r.multi_handedness[0].classification[0].label if r.multi_handedness else '?'
    return lm, side


def _inside(poly, H, W):
    """even-odd 광선 교차 — 벡터화"""
    Y, X = np.mgrid[:H, :W]
    inside = np.zeros((H, W), bool)
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]; x2, y2 = poly[(i+1) % n]
        cond = ((y1 > Y) != (y2 > Y))
        with np.errstate(divide='ignore', invalid='ignore'):
            xint = (x2-x1)*(Y-y1)/(y2-y1+1e-12) + x1
        inside ^= cond & (X < xint)
    return inside


def _inside_pts(poly, pts):
    """소수의 점에 대한 even-odd 판정 (래스터 없이)."""
    pts = np.atleast_2d(np.asarray(pts, float))
    out = np.zeros(len(pts), bool)
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]; x2, y2 = poly[(i+1) % n]
        cond = (y1 > pts[:, 1]) != (y2 > pts[:, 1])
        with np.errstate(divide='ignore', invalid='ignore'):
            xint = (x2-x1)*(pts[:, 1]-y1)/(y2-y1+1e-12) + x1
        out ^= cond & (pts[:, 0] < xint)
    return out


def palm_frame(lm):
    """손바닥 정규 좌표계. ★assign.frame 과 ★같은 정의입니다 (원점=손목, u+=새끼 방향).
    반환: (u, v, wid, hgt) · ★노쪽(엄지) 방향 = ★-u"""
    o = lm[WRIST]
    vv = lm[M_MCP] - o
    hgt = float(np.linalg.norm(vv)) + 1e-9
    v = vv/hgt
    u = np.array([-v[1], v[0]])
    if float((lm[P_MCP]-lm[I_MCP]) @ u) < 0: u = -u          # ★u+ 를 새끼 방향으로 통일
    wid = abs(float((lm[P_MCP]-lm[I_MCP]) @ u)) + 1e-9
    return u, v, wid, hgt


def palm_polygon(lm, grow=1.06, radial_extra=None):
    """★손바닥 = 손목 + 엄지뿌리 + 4개 MCP. ★손가락은 구조적으로 제외됩니다.

    grow          : ★등방 확장 (v1 그대로 · harness 는 1.12 를 씁니다)
    radial_extra  : ★★P-23 — ★노쪽(엄지) 꼭짓점만 손바닥 폭 대비 이만큼 ★더 밀어냅니다.
                    ★None/0 이면 ★아무 일도 일어나지 않습니다 (= v1 거동).
                    ★★숫자를 여기에 직접 적지 마십시오 — thresholds.py 를 통해 받으십시오.
    """
    poly = lm[POLY_IDX].astype(float)
    c = poly.mean(0)
    poly = c + (poly - c)*grow
    if radial_extra:
        u, _v, wid, _h = palm_frame(lm)
        r = -u                                                # ★노쪽(엄지) 방향
        for j, i in enumerate(POLY_IDX):
            if i in RADIAL_IDX:
                poly[j] = poly[j] + r*(float(radial_extra)*wid)
    return poly


def thumb_intruded(poly, lm):
    """★확장이 ★엄지 「자체」에 닿았는가.

    ★이것은 ★추측 임계가 아니라 ★관측입니다 — 엄지 IP·TIP 랜드마크가 다각형 ★안에
      들어왔는지만 봅니다. ⟹ ★§1-4 경계(랜드마크는 영역 경계에만)를 지킵니다.

    ★★한계 (정직하게 · 감사 F-3)
      · ★엄지 ★2점만 봅니다 — 검지~새끼 방향 침입은 ★보지 않습니다
      · ★「손가락 주름이 들어왔다」를 재는 것이 ★아닙니다. ★랜드마크 포함 여부만입니다
      · ★`palm_roi(radial_extra=..., strict=True)` 일 때만 호출됩니다
        ⟹ ★`grow` 를 키워서 생기는 침입은 ★잡지 못합니다
      · ★실사용 후보 구간(0.2~0.5)에서의 유효성은 ★미검증입니다
    """
    return bool(_inside_pts(poly, lm[[T_IP, T_TIP]]).any())


def palm_roi(rgb, grow=1.06, min_conf=0.3, radial_extra=None, strict=True):
    """반환: (손바닥 마스크, 랜드마크, 손 좌/우). 검출 실패 시 (None, None, None)

    radial_extra : ★P-23 확장 계수 (기본 None = 비활성)
    strict       : ★확장이 엄지에 닿으면 ★RoiIntrusion 을 던집니다.
                   ★조용히 되돌리지 않습니다 — 되돌리면 「왜 안 늘었는지」가 사라집니다.
    """
    u8 = rgb.astype(np.uint8) if rgb.dtype != np.uint8 else rgb
    lm, side = landmarks(u8, min_conf)
    if lm is None: return None, None, None
    H, W = u8.shape[:2]
    poly = palm_polygon(lm, grow, radial_extra)
    if radial_extra and strict and thumb_intruded(poly, lm):
        raise RoiIntrusion(
            f"P-23 확장(radial_extra={radial_extra}, grow={grow})이 엄지 랜드마크를 포함했습니다")
    return _inside(poly, H, W), lm, side
