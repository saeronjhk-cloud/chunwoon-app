"""★★P-41 진단 — labelaid 좌표계 ↔ harness 좌표계가 ★같은가 (2026-08-28)

★★왜 이것이 ★제이 라벨보다 먼저인가
   라벨규칙 v2 는 제이가 ★자 오버레이(labelaid)에서 ★「중심선에서 몇 %인가」를 ★읽어 적게 합니다.
   ★엔진은 ★harness 경로(crop→256)에서 같은 값을 계산합니다.
   ★★두 경로의 ★정규 좌표계가 다르면 ★제이의 눈금값이 ★엔진 특징값과 ★대응하지 않습니다.
   ⟹ ★그러면 ★P-33 임계 확정에서 ★눈금값을 초기 범위로 쓸 수 없습니다.
   ⟹ ★★라벨을 40~50장 다 한 뒤에 알면 ★그 노동이 헛됩니다.

★경로 A (labelaid) : 원본 → MAX_SIDE(1400) 리사이즈 → landmarks → palm_frame
★경로 B (harness)  : 원본 → crop_box → 256 → landmarks → palm_frame

★비교 방법: ★랜드마크 21개를 ★각 경로의 정규 좌표 (cu, cv) 로 옮겨 ★차이를 잽니다.
   ★정규 좌표는 ★스케일 불변이므로, ★같은 손이면 ★같은 값이 나와야 합니다.
   ⟹ ★차이는 ★MediaPipe 추정 차이에서만 옵니다.

★★이것은 ★관측입니다. ★어떤 임계도 정하지 않습니다.
사용: cd "D:\\AI ChunWoon" && python3 _v785_palm/probe/p41_frame.py <데이터셋루트>
"""
import sys, os, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image

from harness import detect_tier, gate_checks, crop_box, crop_to_S, S, GateFail
import palmroi
import labelaid

LM_N = 21


def frame_uv(lm):
    """랜드마크 21개를 ★자기 자신의 정규 좌표로 옮깁니다."""
    o = lm[palmroi.WRIST]
    u, v, wid, hgt = palmroi.palm_frame(lm)
    d = lm - o
    return np.stack([(d @ u)/wid, (d @ v)/hgt], 1), wid, hgt


def path_A(im):
    """labelaid 경로 — 전체 이미지를 MAX_SIDE 로 줄여 검출"""
    s = labelaid.MAX_SIDE/max(im.size)
    a = im.resize((int(im.width*s), int(im.height*s)), Image.LANCZOS) if s < 1 else im
    lm, side = palmroi.landmarks(np.asarray(a.convert('RGB'), np.uint8))
    return lm, side


def path_B(im):
    """harness 경로 — 손 영역 crop 후 256"""
    cb = crop_box(im)
    if cb is None: return None, None
    c = crop_to_S(im, cb)
    lm, side = palmroi.landmarks(np.asarray(c.convert('RGB'), np.uint8))
    return lm, side


def main(root):
    tier = detect_tier(root); gate_checks(root, tier)
    pre = '[TIER-A] ' if tier == 'A' else ''
    imgs = sorted(glob.glob(os.path.join(root, '**', '*.jpg'), recursive=True))
    imgs = [i for i in imgs if '/masks/' not in i.replace('\\', '/')]

    print(f"{pre}P-41 진단 · Tier-{tier} · 이미지 {len(imgs)}장")
    print(f"{pre}★NOT_A_VERDICT — 좌표계 일치 여부만 관측합니다.\n")

    rows, sidemis, fail = [], 0, []
    for p in imgs:
        im = Image.open(p)
        lmA, sA = path_A(im)
        lmB, sB = path_B(im)
        n = os.path.basename(p)[-10:]
        if lmA is None or lmB is None:
            fail.append((n, 'A' if lmA is None else '', 'B' if lmB is None else '')); continue
        uvA, widA, hgtA = frame_uv(lmA)
        uvB, widB, hgtB = frame_uv(lmB)
        d = np.linalg.norm(uvA - uvB, axis=1)          # ★정규 좌표에서의 거리
        if sA != sB: sidemis += 1
        rows.append(dict(name=n, mean=float(d.mean()), mx=float(d.max()),
                         ar=float((widA/hgtA)/(widB/hgtB)), sA=sA, sB=sB))

    if fail:
        print(f"{pre}★검출 실패 {len(fail)}장:")
        for n, a, b in fail: print(f"{pre}  {n} — 실패 경로 {a}{b}")
        print()
    if not rows:
        print(f"{pre}★비교 가능한 장이 없습니다."); return

    mean = np.array([r['mean'] for r in rows]); mx = np.array([r['mx'] for r in rows])
    ar = np.array([r['ar'] for r in rows])
    print(f"{pre}── 랜드마크 21개의 ★정규 좌표 차이 (경로 A vs B) · n={len(rows)} ──")
    print(f"{pre}  장별 평균차 : 중앙값 {np.median(mean):.4f} · 최대 {mean.max():.4f}")
    print(f"{pre}  장별 최대차 : 중앙값 {np.median(mx):.4f} · 최대 {mx.max():.4f}")
    print(f"{pre}  ★가로세로비(wid/hgt) 비율 A/B : 중앙값 {np.median(ar):.4f} · "
          f"범위 {ar.min():.4f}~{ar.max():.4f}")
    print(f"{pre}  ★좌/우 판정 불일치 : {sidemis}/{len(rows)}")

    print(f"\n{pre}── 해석에 필요한 대조군 ──")
    print(f"{pre}  ★제이가 자 오버레이에서 읽는 눈금 간격 = ★0.10 (10 %)")
    print(f"{pre}  ⟹ ★평균차가 눈금 간격에 비해 ★얼마나 작은지가 관건입니다")
    print(f"{pre}  ★★단 ★「몇 이하면 괜찮다」는 ★기준을 여기서 정하지 않습니다 (G-7 정신)")

    worst = sorted(rows, key=lambda r: -r['mx'])[:5]
    print(f"\n{pre}── 차이가 큰 5장 ──")
    for r in worst:
        print(f"{pre}  {r['name']}: 평균 {r['mean']:.4f} · 최대 {r['mx']:.4f} · "
              f"가로세로비 {r['ar']:.3f} · 손 {r['sA']}/{r['sB']}")


if __name__ == '__main__':
    if len(sys.argv) != 2:
        print(__doc__); sys.exit(2)
    try:
        main(sys.argv[1])
    except GateFail as e:
        print(f"★★게이트 위반 — 중단합니다\n   {e}"); sys.exit(2)
