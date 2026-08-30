"""P-18: 손바닥 경계를 보존하는 마스크.
★기존 결함: erosion 코어(open)는 엄지두덩 「경계」를 깎아 RLC(생명선)를 잘라냈다.
★수정 원리: 손 전체에서 「손가락 성분」만 빼면 ★손바닥 경계가 원본 그대로 남는다."""
import numpy as np
from mask import skin, largest_cc, erode, dilate

def _open(m, k):
    for _ in range(k): m = erode(m)
    return dilate(m, k)

def depth_map(m, cap=300):
    d = np.zeros(m.shape, np.int32); cur = m.copy(); k = 0
    while cur.any() and k < cap:
        d[cur] = k; cur = erode(cur); k += 1
    return d

def palm_mask2(rgb, finger_frac=0.55, ret_hand=False):
    hand = largest_cc(skin(rgb))
    d = depth_map(hand)
    if d.max() < 3:
        return (hand, hand) if ret_hand else hand
    k = max(1, int(d.max()*finger_frac))       # 손가락 반폭 근사
    core   = _open(hand, k)                     # 손바닥 코어(경계는 안으로 밀려 있음)
    if not core.any():
        return (hand, hand) if ret_hand else hand
    core   = largest_cc(core)
    reach  = dilate(core, k) & hand             # ★코어를 되돌려 손바닥 경계를 복원
    finger = hand & ~reach                      # 남은 것 = 손가락·팔뚝 돌기
    palm   = hand & ~finger                     # ★손바닥 경계는 원본 그대로
    return (hand, palm) if ret_hand else palm
