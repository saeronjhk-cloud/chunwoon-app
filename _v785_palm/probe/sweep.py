"""★★★추론 캐시 + 임계 스윕 (2026-08-29 · ADR-002 · P-49)

★★목적: ★개발을 ★빠르게. ★U-Net 을 ★한 번만 돌리고 ★배정 실험은 ★초 단위로 반복합니다.
   ★이전에는 임계 하나 바꿀 때마다 ★24장 × 1.3초 = ★30초 + MediaPipe 였습니다.
   ★캐시 후에는 ★배정만 다시 돌리므로 ★한 조합에 ★1초 미만입니다.

★★모든 출력은 ★`dev` 모드입니다 — ★NOT_A_VERDICT. ★출시 판정에 쓸 수 없습니다.
   ★출시 판정은 ★`freeze()` 후 ★verdict 로만 (ADR-002 D-6').

사용:
  ① 캐시 만들기 (한 번만 · 30~60초)
     python3 sweep.py cache <데이터셋루트>
  ② 규칙 비교 (v1 방향우선 vs v2 위치우선)
     python3 sweep.py rules
  ③ 임계 스윕
     python3 sweep.py sweep ASSIGN_RLC_CU -0.30 -0.05 6
     python3 sweep.py sweep ASSIGN_RLC_SPAN 0.2 0.8 7
  ④ 2차원 스윕
     python3 sweep.py grid ASSIGN_RLC_CU -0.25 -0.05 5 ASSIGN_RLC_SPAN 0.2 0.8 4

★캐시 파일은 ★데이터셋 폴더(저장소 밖)에 둡니다 — ★예측 마스크도 생체정보 파생물입니다.
"""
import sys, os, glob, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image

from harness import detect_tier, gate_checks, crop_box, crop_to_S, S, PALM_GROW, GateFail
from pthread import load
from unet_np import forward
import palmroi, palmtype
import thresholds as TH

CACHE = '_sweep_cache.npz'


# ─────────────────────────────────────────────────────────────────────────────
def build_cache(root, ckpt):
    """U-Net 출력 + 랜드마크를 ★한 번만 계산해 저장합니다."""
    tier = detect_tier(root); gate_checks(root, tier)
    sd = load(ckpt)
    imgs = sorted(glob.glob(os.path.join(root, '**', '*.jpg'), recursive=True))
    imgs = [i for i in imgs if '/masks/' not in i.replace('\\', '/')]
    preds, lms, names, sides = [], [], [], []
    t0 = time.time()
    for p in imgs:
        im = Image.open(p).convert('RGB')
        cb = crop_box(im)
        if cb is None: continue
        rgb = np.asarray(crop_to_S(im, cb), np.float32)
        roi, lm, side = palmroi.palm_roi(rgb, grow=PALM_GROW)
        if roi is None: continue
        lg = forward(np.ascontiguousarray(rgb.transpose(2, 0, 1)/255.), sd)
        preds.append(((1/(1+np.exp(-lg)) > 0.5) & roi))
        lms.append(lm); names.append(os.path.basename(p)); sides.append(side or '?')
    out = os.path.join(root, CACHE)
    np.savez_compressed(out, preds=np.array(preds), lms=np.array(lms),
                        names=np.array(names), sides=np.array(sides))
    print(f"★캐시 {len(preds)}장 → {out}  ({time.time()-t0:.1f}초)")
    print(f"★[TIER-{tier}] ★이 캐시는 ★NOT_A_VERDICT 실험 전용입니다.")
    return out


def load_cache(root):
    p = os.path.join(root, CACHE)
    if not os.path.exists(p):
        raise SystemExit(f"★캐시가 없습니다 — 먼저: python3 sweep.py cache {root}")
    z = np.load(p, allow_pickle=False)
    return z['preds'], z['lms'], z['names'], z['sides']


# ─────────────────────────────────────────────────────────────────────────────
def evaluate(preds, lms, rule="v2", min_pix=1):
    """★배정만 다시 돌립니다. ★캐시 덕분에 빠릅니다.
    반환: dict(RLC=, PTC=, DTC=, FATE=, three=, n=, frags=)"""
    cnt = dict.fromkeys(('RLC', 'PTC', 'DTC', 'FATE'), 0)
    three = 0; frags = []
    for pred, lm in zip(preds, lms):
        feats = [palmtype.frag_features(pts, lm)
                 for _, pts in palmtype.components(pred, min_pix=min_pix)]
        frags.append(len(feats))
        g, why = palmtype.assign_fragments(feats, mode="dev", rule=rule)
        if g is None: continue
        for k in cnt:
            if g[k]: cnt[k] += 1
        if all(g[k] for k in ('RLC', 'PTC', 'DTC')): three += 1
    return dict(cnt, three=three, n=len(preds), frags=float(np.mean(frags)) if frags else 0.0)


def line(tag, r):
    return (f"{tag:>26} │ RLC {r['RLC']:>2}  PTC {r['PTC']:>2}  DTC {r['DTC']:>2}  "
            f"FATE {r['FATE']:>2} │ ★3대선 {r['three']:>2}/{r['n']}  조각 {r['frags']:.1f}")


def header():
    print(f"{'':>26} │ {'선별 배정된 장수':^34} │ 전부 배정")
    print("─"*26 + "┼" + "─"*36 + "┼" + "─"*22)


# ─────────────────────────────────────────────────────────────────────────────
def cmd_rules(root):
    preds, lms, names, sides = load_cache(root)
    print("★★NOT_A_VERDICT — dev 실험입니다. 출시 판정에 쓸 수 없습니다.\n")
    print("★배정 규칙 비교 — 임계는 ★2026-08-26 실패치로 ★동일하게 고정")
    header()
    for rule, tag in (("v1", "v1 방향우선 (원안)"), ("v2", "v2 위치우선 (P-49)")):
        print(line(tag, evaluate(preds, lms, rule=rule)))
    print("\n★v1 은 ★RLC 를 「세로 조각」으로 규정합니다 — ★호(arc)인 RLC 가 걸러집니다")
    print("★v2 는 ★노쪽 위치를 먼저 보고 ★가로 span 으로 가로지르는 선만 제외합니다")


def cmd_sweep(root, name, lo, hi, n, rule="v2"):
    preds, lms, names_, sides = load_cache(root)
    print("★★NOT_A_VERDICT — dev 실험입니다.\n")
    print(f"★{name} 스윕 · rule={rule} · {lo} ~ {hi} · {n}단계")
    header()
    best = None
    for v in np.linspace(lo, hi, n):
        TH.set_dev({name: float(v)})
        r = evaluate(preds, lms, rule=rule)
        print(line(f"{name}={v:+.3f}", r))
        if best is None or r['three'] > best[1]['three']: best = (v, r)
    TH.clear_dev()
    print(f"\n★이 구간의 최고: {name}={best[0]:+.3f} → 3대선 {best[1]['three']}/{best[1]['n']}")
    print("★★단 ★이것은 ★24장(1명 2손)에 대한 값입니다 — ★일반화를 답하지 않습니다.")


def cmd_grid(root, n1, a1, b1, k1, n2, a2, b2, k2, rule="v2"):
    preds, lms, names_, sides = load_cache(root)
    print("★★NOT_A_VERDICT — dev 실험입니다.\n")
    print(f"★2차원 스윕 · rule={rule} · {n1} × {n2}  (칸 = ★3대선 전부 배정 장수)")
    v2s = np.linspace(a2, b2, k2)
    print(f"{'':>12}" + "".join(f"{n2[:6]}={v:+.2f} " for v in v2s))
    best = None
    for x in np.linspace(a1, b1, k1):
        row = f"{n1[:10]:>10}={x:+.2f}"
        for y in v2s:
            TH.set_dev({n1: float(x), n2: float(y)})
            r = evaluate(preds, lms, rule=rule)
            row += f"{r['three']:>13}"
            if best is None or r['three'] > best[2]: best = (x, y, r['three'])
        print(row)
    TH.clear_dev()
    print(f"\n★최고: {n1}={best[0]:+.3f} · {n2}={best[1]:+.3f} → 3대선 {best[2]}장")
    print("★★24장(1명 2손) 기준입니다. ★출시 임계로 쓰지 마십시오 — freeze() 는 Tier-B 를 요구합니다.")


# ─────────────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    a = sys.argv[1:]
    root = os.environ.get('CW_PALM_DATA', r'D:\ChunWoon_palm_dataset\A-smoke')
    try:
        if not a: print(__doc__); sys.exit(2)
        if a[0] == 'cache':
            build_cache(a[1] if len(a) > 1 else root,
                        os.environ.get('CW_PALM_CKPT', 'palm-api/checkpoint_aug_epoch70.pth'))
        elif a[0] == 'rules':
            cmd_rules(a[1] if len(a) > 1 else root)
        elif a[0] == 'sweep':
            cmd_sweep(root, a[1], float(a[2]), float(a[3]), int(a[4]),
                      a[5] if len(a) > 5 else "v2")
        elif a[0] == 'grid':
            cmd_grid(root, a[1], float(a[2]), float(a[3]), int(a[4]),
                     a[5], float(a[6]), float(a[7]), int(a[8]),
                     a[9] if len(a) > 9 else "v2")
        else:
            print(__doc__); sys.exit(2)
    except GateFail as e:
        print(f"★★게이트 위반 — 중단합니다\n   {e}"); sys.exit(2)
