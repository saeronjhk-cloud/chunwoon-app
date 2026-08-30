"""★★P-23 진단 — ROI 가 RLC 를 얼마나 자르는가 (2026-08-28 · 교정 엔진으로 재측정)

★★이것은 ★관측입니다. ★계수를 고르는 것이 ★아닙니다.
   ★결과를 보고 `ROI_RADIAL_EXTRA` 를 정하면 ★그것이 2026-08-26 의 4 % 입니다.
   ⟹ ★계수는 ★Tier-B 라벨 후 P-33 에서만 확정합니다 (G-7).
   ⟹ ★이 스크립트는 ★어떤 임계도 파일에 쓰지 않습니다.

★재측정 이유: 2026-08-26 의 「ROI 가 잘라냄 12/23」 진단은
   ★P-35(방향·거리 비등방) 결함이 있는 코드로 낸 값입니다.

사용: cd "D:\\AI ChunWoon" && python3 _v785_palm/probe/p23_diag.py <데이터셋루트>
★게이트는 harness 의 것을 ★그대로 재사용합니다 — 우회 경로를 만들지 않습니다.
"""
import sys, os, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image

from harness import detect_tier, gate_checks, S, PALM_GROW, GateFail
from pthread import load
from unet_np import forward
from mask import palm_mask
import palmroi, palmtype
import thresholds as TH

# ★탐색용 격자입니다. ★후보 계수가 아닙니다 — 「얼마나 더 들어오는가」를 보기 위한 눈금입니다.
GRID = (0.0, 0.1, 0.2, 0.3, 0.4, 0.5)


def unet_logits(path, sd):
    """ROI 마스킹 ★전」의 U-Net 출력과 랜드마크를 냅니다."""
    im = Image.open(path)
    sm = np.asarray(im.resize((im.width//16, im.height//16)), np.float32)
    h, _ = palm_mask(sm); ys, xs = np.nonzero(h)
    if len(ys) < 50: return None
    cy, cx = int(ys.mean())*16, int(xs.mean())*16
    box = max(int(max(np.ptp(ys), np.ptp(xs))*0.95)*16, 400)
    x0, y0 = max(0, cx-box//2), max(0, cy-box//2)
    crop = im.crop((x0, y0, min(im.width, x0+box), min(im.height, y0+box))).resize((S, S), Image.LANCZOS)
    rgb = np.asarray(crop, np.float32)
    lm, side = palmroi.landmarks(rgb.astype(np.uint8))
    if lm is None: return None
    lg = forward(np.ascontiguousarray(rgb.transpose(2, 0, 1)/255.), sd)
    return (1/(1+np.exp(-lg)) > 0.5), lm, side


def main(root, ckpt):
    tier = detect_tier(root); gate_checks(root, tier)
    pre = '[TIER-A] ' if tier == 'A' else ''
    sd = load(ckpt)
    imgs = sorted(glob.glob(os.path.join(root, '**', '*.jpg'), recursive=True))
    imgs = [i for i in imgs if '/masks/' not in i.replace('\\', '/')]

    rlc_cu = TH.get("ASSIGN_RLC_CU", "diagnostic")   # ★진단 전용 — 판정에 쓰지 않습니다
    print(f"{pre}P-23 진단 · Tier-{tier} · 이미지 {len(imgs)}장")
    print(f"{pre}★NOT_A_VERDICT — 관측만 합니다. ★계수를 여기서 정하지 않습니다.")
    print(f"{pre}★RLC 영역 기준 cu ≤ {rlc_cu} (2026-08-26 실패치 · 진단용)\n")

    horiz_dg = TH.get("ASSIGN_HORIZ_DEG", "diagnostic")
    tot = {g: dict(n=0, rlc=0, frag=0, intr=0, assigned=0) for g in GRID}
    angs = []          # ★노쪽 영역 조각의 방향 분포 — ★「ROI 탓인가 방향 탓인가」를 가릅니다
    per = []
    for p in imgs:
        r = unet_logits(p, sd)
        if r is None:
            per.append((os.path.basename(p)[-10:], None)); continue
        raw, lm, side = r
        row = {}
        for g in GRID:
            poly = palmroi.palm_polygon(lm, grow=PALM_GROW, radial_extra=(g or None))
            if g and palmroi.thumb_intruded(poly, lm):
                tot[g]['intr'] += 1; row[g] = None; continue
            roi = palmroi._inside(poly, S, S)
            feats = [palmtype.frag_features(pts, lm)
                     for _, pts in palmtype.components(raw & roi)]
            cand = [f for f in feats if not f['degenerate'] and f['cu'] <= rlc_cu]
            nrlc = len(cand)
            nass = sum(1 for f in cand if f['ang_v_deg'] <= horiz_dg)   # ★실제 RLC 배정 조건
            if g == 0.0: angs += [f['ang_v_deg'] for f in cand]
            tot[g]['n'] += 1; tot[g]['rlc'] += (nrlc > 0)
            tot[g]['assigned'] += (nass > 0); tot[g]['frag'] += len(feats)
            row[g] = (len(feats), nrlc)
        per.append((os.path.basename(p)[-10:], row))

    print(f"{pre}{'확장':>5} {'유효':>5} {'노쪽조각有':>11} {'그중 세로(=RLC배정)':>20} {'평균조각':>9} {'엄지침입':>8}")
    for g in GRID:
        t = tot[g]
        if not t['n']:
            print(f"{pre}{g:>5} {'—':>5} {'—':>11} {'—':>20} {'—':>9} {t['intr']:>8}"); continue
        print(f"{pre}{g:>5} {t['n']:>5} {t['rlc']:>11} {t['assigned']:>20} "
              f"{t['frag']/t['n']:>9.1f} {t['intr']:>8}")

    # ★★핵심 진단 — 노쪽 조각이 ★있는데도 배정이 안 되는 이유가 ★방향인가
    if angs:
        a = np.array(angs)
        print(f"\n{pre}── 노쪽(cu ≤ {rlc_cu}) 조각의 방향 분포 · 확장 0.0 · n={len(a)} ──")
        print(f"{pre}  0=세로 · 90=가로 · ★{horiz_dg}도 초과면 「가로」로 분류돼 ★RLC 가 될 수 없습니다")
        for lo, hi in ((0, 15), (15, 30), (30, 45), (45, 60), (60, 75), (75, 90.1)):
            n = int(((a >= lo) & (a < hi)).sum())
            bar = '█'*int(n/max(1, len(a))*40)
            print(f"{pre}  {lo:>2}~{hi:<4.0f}도 {n:>4}  {bar}")
        print(f"{pre}  ★세로(≤{horiz_dg}도) {int((a <= horiz_dg).sum())} / "
              f"가로(>{horiz_dg}도) {int((a > horiz_dg).sum())}")

    base = tot[0.0]
    print(f"\n{pre}── 장별 변화 (0.0 → 최대 확장에서 RLC 후보가 새로 생긴 사진) ──")
    gained = 0
    for name, row in per:
        if not row or row.get(0.0) is None: continue
        b = row[0.0][1]
        best = max((row[g][1] for g in GRID if row.get(g)), default=b)
        if best > b:
            gained += 1
            print(f"{pre}  {name}: RLC 후보 {b} → {best}")
    print(f"\n{pre}★ROI 확장으로 RLC 후보가 새로 생기는 사진: ★{gained}/{base['n']}")
    print(f"{pre}★그 외는 ★U-Net 이 애초에 못 찾은 것이거나 ★이미 잡혀 있던 것입니다.")
    print(f"\n{pre}★★계수는 여기서 정하지 않습니다. ★Tier-B 라벨 후 P-33 에서만 확정합니다 (G-7).")


if __name__ == '__main__':
    if len(sys.argv) != 2:
        print(__doc__); sys.exit(2)
    try:
        main(sys.argv[1], os.environ.get('CW_PALM_CKPT', 'palm-api/checkpoint_aug_epoch70.pth'))
    except GateFail as e:
        print(f"★★게이트 위반 — 중단합니다\n   {e}"); sys.exit(2)
