"""손가락 배제 강화 + minor crease 필터.
★제이 지적(2026-08-26): ⑴손가락 따라 짧은 선 ⑵불필요한 잔주름.
★방향 필터는 쓰지 않습니다 — §1-4 의 `is_vertical` 난수화가 그 함정이었습니다.
   위치(손바닥 안인가) · 길이 · 폭만 씁니다. 전부 라벨규칙 §4-5 에 근거가 있습니다."""
import numpy as np
from mask import skin, largest_cc, erode, dilate
from mask2 import depth_map, _open
from metrics import skeletonize

def palm_disk(hand, k=1.9):
    """손바닥 내접원 중심에서 반경 k×r 이내 = 손바닥 영역 근사.
    ★손가락은 중심에서 멀고, RLC 는 가까워 살아남습니다."""
    d = depth_map(hand)
    if d.max() < 3: return hand, None, 0
    cy, cx = np.unravel_index(np.argmax(d), d.shape)
    r = d.max()
    Y, X = np.ogrid[:hand.shape[0], :hand.shape[1]]
    disk = (Y-cy)**2 + (X-cx)**2 <= (k*r)**2
    return hand & disk, (cy, cx), r

def palm_mask3(rgb, k=1.9):
    hand = largest_cc(skin(rgb))
    d = depth_map(hand)
    if d.max() < 3: return hand, hand
    kk = max(1, int(d.max()*0.55))
    core = _open(hand, kk)
    if core.any():
        core = largest_cc(core)
        reach = dilate(core, kk) & hand
        hand_nofinger = hand & reach          # mask2 방식 (경계 보존)
    else:
        hand_nofinger = hand
    disk, c, r = palm_disk(hand_nofinger, k)
    return hand, disk

def label(m):
    lab=np.zeros(m.shape,np.int32); cur=0; H,W=m.shape
    for i in range(H):
        for j in range(W):
            if m[i,j] and lab[i,j]==0:
                cur+=1; st=[(i,j)]; lab[i,j]=cur
                while st:
                    y,x=st.pop()
                    for dy in(-1,0,1):
                        for dx in(-1,0,1):
                            yy,xx=y+dy,x+dx
                            if 0<=yy<H and 0<=xx<W and m[yy,xx] and lab[yy,xx]==0:
                                lab[yy,xx]=cur; st.append((yy,xx))
    return lab,cur

def filter_minor(det, min_len=14, width_ratio=0.5):
    """라벨규칙 §4-5 ①(폭이 major 의 절반 이하) + 길이 하한.
    ★폭 = 면적 / 골격길이"""
    lab, n = label(det)
    info = []
    for k in range(1, n+1):
        m = (lab == k); L = int(skeletonize(m).sum())
        if L == 0: continue
        info.append(dict(k=k, len=L, area=int(m.sum()), w=m.sum()/L))
    if not info: return det, [], []
    wmax = max(i['w'] for i in info)          # ★같은 손의 가장 굵은 주름 기준 (§4-5 정련)
    keep, drop = [], []
    for i in info:
        if i['len'] < min_len:                        i['why']='짧음';       drop.append(i)
        elif i['w'] < wmax*width_ratio:               i['why']='가늘음';     drop.append(i)
        else:                                          keep.append(i)
    out = np.zeros_like(det)
    for i in keep: out |= (lab == i['k'])
    return out, keep, drop
