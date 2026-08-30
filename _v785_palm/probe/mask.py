"""살색 → 최대 연결성분 → 반복 erosion(거리변환 근사) → 손바닥 영역.
   MediaPipe 없이 palm region 을 근사한다. ★손가락은 가늘어 먼저 깎여 나간다."""
import numpy as np

def skin(rgb):
    r,g,b = rgb[...,0], rgb[...,1], rgb[...,2]
    mx,mn = rgb.max(-1), rgb.min(-1)
    return (r>95)&(g>40)&(b>20)&((mx-mn)>15)&(np.abs(r-g)>15)&(r>g)&(r>b)

def largest_cc(m):
    lab = np.zeros(m.shape, np.int32); cur = 0; best=(0,0)
    H,W = m.shape
    for i in range(H):
        for j in range(W):
            if m[i,j] and lab[i,j]==0:
                cur += 1; st=[(i,j)]; lab[i,j]=cur; n=0
                while st:
                    y,x = st.pop(); n+=1
                    for dy,dx in ((1,0),(-1,0),(0,1),(0,-1)):
                        yy,xx = y+dy, x+dx
                        if 0<=yy<H and 0<=xx<W and m[yy,xx] and lab[yy,xx]==0:
                            lab[yy,xx]=cur; st.append((yy,xx))
                if n>best[0]: best=(n,cur)
    return lab==best[1] if best[1] else m

def erode(m):
    p = np.pad(m, 1, constant_values=False)
    return m & p[:-2,1:-1] & p[2:,1:-1] & p[1:-1,:-2] & p[1:-1,2:]

def dilate(m, k=1):
    for _ in range(k):
        p = np.pad(m, 1, constant_values=False)
        m = m | p[:-2,1:-1] | p[2:,1:-1] | p[1:-1,:-2] | p[1:-1,2:]
    return m

def palm_mask(rgb, keep=0.55):
    """손 전체 마스크와 손바닥(손가락 제외 근사) 마스크를 반환"""
    hand = largest_cc(skin(rgb))
    # 반복 erosion 으로 거리변환 근사 → 최대 깊이의 keep 비율 이상만 남긴다
    d = np.zeros(hand.shape, np.int32); cur = hand.copy(); k = 0
    while cur.any() and k < 200:
        d[cur] = k; cur = erode(cur); k += 1
    core = d >= max(1, int(d.max()*keep))
    if not core.any(): core = d >= max(1, d.max()-1)
    palm = dilate(largest_cc(core), int(d.max()*keep))  & hand
    return hand, palm
