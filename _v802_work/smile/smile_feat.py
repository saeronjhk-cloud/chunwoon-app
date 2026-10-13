# 미소 특징(랜드마크 → 수치) — 앱 JS 이식 대상이므로 단순 기하만 쓴다.
# 좌표: 픽셀(x*w, y*h) → 두 눈 바깥꼬리(33·263) 선이 수평이 되게 회전(roll 제거) · 크기는 내안각 간격(133–362)으로 정규화.
import math
FEATS = ['lift', 'wide', 'gap', 'lowcurve', 'cornerDrop']
def feats(lm, w, h):
    P = [(a[0] * w, a[1] * h) for a in lm]
    ax, ay = P[263][0] - P[33][0], P[263][1] - P[33][1]
    t = -math.atan2(ay, ax); c, s = math.cos(t), math.sin(t)
    cx, cy = (P[33][0] + P[263][0]) / 2, (P[33][1] + P[263][1]) / 2
    Q = [((x - cx) * c - (y - cy) * s, (x - cx) * s + (y - cy) * c) for x, y in P]
    en = abs(Q[362][0] - Q[133][0]) or 1e-6
    mw = abs(Q[291][0] - Q[61][0]) or 1e-6
    cornerY = (Q[61][1] + Q[291][1]) / 2
    midY = (Q[13][1] + Q[14][1]) / 2
    eyeY = (Q[33][1] + Q[263][1] + Q[133][1] + Q[362][1]) / 4
    noseY = Q[2][1]                                   # 코밑(subnasale 부근)
    return {
        'lift': (midY - cornerY) / mw,                # 입꼬리가 입술 가운데보다 위면 + (y 아래로 증가)
        'wide': mw / en,                              # 입 폭/내안각 간격(웃으면 넓어짐 · 사람마다 다름)
        'gap': abs(Q[14][1] - Q[13][1]) / mw,         # 입술 사이 벌어짐
        'lowcurve': (Q[17][1] - cornerY) / mw,        # 아랫입술 가운데가 입꼬리보다 얼마나 아래(웃으면 U자)
        'cornerDrop': (cornerY - noseY) / en,         # 코밑→입꼬리 세로 거리(웃으면 입꼬리가 올라가 짧아짐)
    }
