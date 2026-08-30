"""조각 → 선 배정. ★랜드마크 「좌표계」 안의 위치로만 배정합니다.
★★§1-4 와의 경계: `_fallback_line` 은 ★선이 없어도 만들어냈습니다.
   여기는 ★U-Net 이 찾은 조각을 배정만 합니다. ★조각이 없으면 배정하지 않습니다."""
import numpy as np
WRIST,T_CMC,T_MCP,I_MCP,M_MCP,R_MCP,P_MCP = 0,1,2,5,9,13,17

def frame(lm, hand):
    """손바닥 정규 좌표계: origin=손목, v=손목→중지MCP(0~1), u=가로(엄지쪽 음수)"""
    o = lm[WRIST]
    vv = lm[M_MCP] - o; hgt = np.linalg.norm(vv); v = vv/(hgt+1e-9)
    u = np.array([-v[1], v[0]])
    if float((lm[P_MCP]-lm[I_MCP]) @ u) < 0: u = -u      # ★u+ 를 새끼 방향으로 통일
    wid = abs(float((lm[P_MCP]-lm[I_MCP]) @ u)) + 1e-9
    return o, u, v, wid, hgt

def to_uv(pts, o, u, v, wid, hgt):
    d = pts - o
    return np.stack([(d@u)/wid, (d@v)/hgt], 1)

def assign(frags, lm, hand):
    """frags: [(길이, 픽셀좌표 Nx2)] → {'RLC':[], 'PTC':[], 'DTC':[], 'FATE':[], 'NONE':[]}"""
    o,u,v,wid,hgt = frame(lm, hand)
    out = {k: [] for k in ('RLC','PTC','DTC','FATE','NONE')}
    for L, P in frags:
        uv = to_uv(P, o,u,v,wid,hgt)
        cu, cv = uv.mean(0)
        p0 = uv - uv.mean(0)
        vec = np.linalg.svd(p0, full_matrices=False)[2][0]
        horiz = abs(vec[0]) > abs(vec[1])                 # 정규 좌표계에서의 방향
        span_u, span_v = np.ptp(uv[:,0]), np.ptp(uv[:,1])
        k = 'NONE'
        if horiz and cv >= 0.62:              k = 'DTC'    # 손가락 쪽 가로
        elif horiz and 0.30 <= cv < 0.62:     k = 'PTC'    # 중간 가로
        elif (not horiz) and cu <= -0.18:     k = 'RLC'    # 엄지 쪽 세로/곡선
        elif (not horiz) and abs(cu) < 0.18:  k = 'FATE'   # 중앙 세로
        out[k].append(dict(len=L, cu=float(cu), cv=float(cv),
                           su=float(span_u), sv=float(span_v)))
    return out, (o,u,v,wid,hgt)
