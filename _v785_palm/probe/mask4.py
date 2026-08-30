"""손바닥 영역 v3 — ★반경 프로파일 기반.
원리: 손바닥 중심 c 에서 각 방향 θ 로 마스크 경계까지 거리 r(θ) 를 잰다.
      ★손가락 방향은 r 이 크게 튀어나오고, 손바닥 방향은 고르다.
      ⟹ r(θ) 의 하위 백분위수를 손바닥 반경으로 쓰면 손가락만 잘린다.
★방향으로 「선」을 거르지 않습니다 — 영역 경계에만 씁니다 (§1-4 교훈)."""
import numpy as np
from mask import skin, largest_cc
from mask2 import depth_map

def palm_region(hand, pct=62, scale=1.12, nray=180):
    d = depth_map(hand)
    if d.max() < 3: return hand, None, 0
    cy, cx = np.unravel_index(np.argmax(d), d.shape)
    H, W = hand.shape
    maxr = int(np.hypot(H, W))
    th = np.linspace(0, 2*np.pi, nray, endpoint=False)
    rs = np.arange(1, maxr)
    ys = (cy + rs[None,:]*np.sin(th)[:,None]).round().astype(int)
    xs = (cx + rs[None,:]*np.cos(th)[:,None]).round().astype(int)
    ok = (ys>=0)&(ys<H)&(xs>=0)&(xs<W)
    hit = np.zeros_like(ok)
    hit[ok] = hand[ys[ok], xs[ok]]
    # 각 방향에서 「연속으로 손인 구간」의 끝 = 경계까지 거리
    r_edge = np.array([np.argmin(row) if (~row).any() else maxr-1 for row in hit])
    R = np.percentile(r_edge, pct) * scale
    Y, X = np.ogrid[:H, :W]
    return hand & ((Y-cy)**2 + (X-cx)**2 <= R**2), (cy, cx), R

def palm_mask4(rgb, pct=62, scale=1.12):
    hand = largest_cc(skin(rgb))
    palm, c, R = palm_region(hand, pct, scale)
    return hand, palm
