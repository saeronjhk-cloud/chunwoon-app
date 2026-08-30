"""★★★U-Net 이진화 임계 실험 (2026-08-29 · P-50 신규)

★★계기: ★우리 체크포인트의 ★원 저장소가 밝혀졌습니다 —
   `yeonsumia/palmistry` (KAIST · Apache-2.0 · arXiv:2102.12127 재현)
   ★그 저장소의 `detection.py` 는 ★이진화 임계로 ★**0.03** 을 씁니다.
   ★★그런데 우리 `harness.py` 는 ★**p > 0.5** 를 쓰고 있었습니다.

★★그것이 「U-Net 이 3대선을 온전히 못 잡는다」(2026-08-29 관찰)의 원인인지 ★잽니다.

★NOT_A_VERDICT — ★관측입니다. ★임계를 확정하지 않습니다.
사용: python3 p50_thresh.py <데이터셋루트> [--limit N]
"""
import sys, os, glob, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image

from harness import detect_tier, gate_checks, crop_box, crop_to_S, S, PALM_GROW, GateFail
from pthread import load
from unet_np import forward
import palmroi, palmtype

# ★탐색 눈금입니다. ★후보 값이 아닙니다.
GRID = (0.03, 0.05, 0.10, 0.20, 0.30, 0.50, 0.70)


def main(root, ckpt, limit=None):
    tier = detect_tier(root); gate_checks(root, tier)
    pre = '[TIER-A] ' if tier == 'A' else ''
    sd = load(ckpt)
    imgs = sorted(glob.glob(os.path.join(root, '**', '*.jpg'), recursive=True))
    imgs = [i for i in imgs if '/masks/' not in i.replace('\\', '/')]
    if limit: imgs = imgs[:limit]

    print(f"{pre}★★NOT_A_VERDICT — U-Net 이진화 임계 실험 · {len(imgs)}장")
    print(f"{pre}★원 저장소(yeonsumia/palmistry)의 detection.py 는 ★0.03 을 씁니다")
    print(f"{pre}★우리 harness 는 ★0.5 를 쓰고 있었습니다\n")

    acc = {t: dict(area=[], frag=[], deg=[]) for t in GRID}
    t0 = time.time(); n = 0
    for p in imgs:
        im = Image.open(p).convert('RGB')
        cb = crop_box(im)
        if cb is None: continue
        rgb = np.asarray(crop_to_S(im, cb), np.float32)
        roi, lm, side = palmroi.palm_roi(rgb, grow=PALM_GROW)
        if roi is None: continue
        lg = forward(np.ascontiguousarray(rgb.transpose(2, 0, 1)/255.), sd)
        prob = 1/(1+np.exp(-lg))
        n += 1
        for t in GRID:
            pred = (prob > t) & roi
            comps = palmtype.components(pred)
            feats = [palmtype.frag_features(pts, lm) for _, pts in comps]
            acc[t]['area'].append(pred.sum()/max(roi.sum(), 1)*100)
            acc[t]['frag'].append(len(feats))
            acc[t]['deg'].append(sum(1 for f in feats if f['degenerate']))

    print(f"{pre}{'임계':>6} {'ROI대비 면적%':>13} {'조각수':>8} {'퇴화조각':>9}")
    print(f"{pre}" + "─"*42)
    for t in GRID:
        a = np.array(acc[t]['area']); f = np.array(acc[t]['frag']); d = np.array(acc[t]['deg'])
        mark = ""
        if t == 0.03: mark = "  ← ★원 저장소"
        if t == 0.50: mark = "  ← ★우리 현행"
        print(f"{pre}{t:>6.2f} {a.mean():>12.2f}% {f.mean():>8.1f} {d.mean():>9.1f}{mark}")

    print(f"\n{pre}★{n}장 · {time.time()-t0:.0f}초")
    print(f"{pre}★★해석 기준: 라벨규칙 v1 §3-1 — ★「손금선은 손바닥 면적의 1~2 %」")
    print(f"{pre}   ★면적이 그보다 크게 벗어나면 ★잔주름·노이즈가 섞이는 것입니다")
    print(f"{pre}★★임계를 여기서 정하지 않습니다 — ★관측만 기록합니다")


if __name__ == '__main__':
    a = [x for x in sys.argv[1:] if not x.startswith('--')]
    lim = int(sys.argv[sys.argv.index('--limit')+1]) if '--limit' in sys.argv else None
    if not a: print(__doc__); sys.exit(2)
    try:
        main(a[0], os.environ.get('CW_PALM_CKPT', 'palm-api/checkpoint_aug_epoch70.pth'), lim)
    except GateFail as e:
        print(f"★★게이트 위반 — 중단합니다\n   {e}"); sys.exit(2)
