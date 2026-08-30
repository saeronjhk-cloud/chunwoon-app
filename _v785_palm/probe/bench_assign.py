"""★★★배정 규칙 벤치마크 — 박스 라벨을 ★정답으로 씁니다 (2026-08-29 · ADR-002)

★★왜 이것이 중요한가
   우리는 ★「조각을 어느 선에 배정하는가」에서 막혀 있었고,
   ★그것이 맞는지 ★확인할 방법이 ★없었습니다 (GT 부재 · 시각화로 눈대중만).
   ★★Roboflow `palmistry_seg` 의 라벨은 ★선이 아니라 ★**박스**였습니다 —
      ⟹ ★U-Net 학습(픽셀 분할)에는 ★못 씁니다.
      ⟹ ★★그러나 ★「이 위치의 이 조각은 life 다」를 ★496장 × 4선 = 1984건 알려줍니다.
      ⟹ ★★★**배정 규칙의 정답(GT)으로는 ★정확히 맞습니다.**

★정답 만드는 법: ★조각의 픽셀이 ★가장 많이 겹치는 박스의 클래스를 ★그 조각의 정답으로 봅니다.
   ★어느 박스와도 안 겹치면 ★정답은 `NONE` 입니다.

★★한계 (정직하게)
   · ★박스는 ★굵습니다 — 두 선의 박스가 ★겹치는 구간에서는 정답이 흔들립니다
   · ★남의 경계 정의입니다 (TierA수집 v1 §5) — ★우리 라벨규칙 §3 과 다릅니다
   · ★11k Hands 58 % — ★스튜디오 흰 배경. ★우리 앱 도메인과 다릅니다
   ⟹ ★★**배정 규칙의 ★상대 비교**에는 유효하고, ★**출시 판정에는 쓸 수 없습니다.**

사용:
  python3 bench_assign.py cache <C_train 루트> [--limit N]
  python3 bench_assign.py rules
  python3 bench_assign.py sweep ASSIGN_RLC_SPAN 0.05 0.40 8
  python3 bench_assign.py grid ASSIGN_DTC_CV 0.55 0.85 4 ASSIGN_RLC_SPAN 0.05 0.30 6
"""
import sys, os, json, glob, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image

from harness import crop_box, crop_to_S, S, PALM_GROW
from pthread import load
from unet_np import forward
import palmroi, palmtype
import thresholds as TH

NAME2CLS = {'life': 'RLC', 'head': 'PTC', 'heart': 'DTC', 'fate': 'FATE'}
CACHE = '_bench_cache.npz'
SPLITS = ('train', 'valid', 'test')

# ★조각 특징 — ★분류기(P-53)의 입력입니다. ★순서를 바꾸면 캐시를 다시 만들어야 합니다.
FEATURES = ('cu', 'cv', 'ang_v_deg', 'span_u', 'span_v', 'len_v',
            'u_min', 'u_max', 'v_min', 'v_max', 'thick', 'npix', 'degenerate')


# ─────────────────────────────────────────────────────────────────────────────
def load_boxes(root):
    """{파일경로: [(cls, x0,y0,x1,y1), ...]} · {파일경로: split}"""
    out, spl = {}, {}
    for sp in SPLITS:
        p = os.path.join(root, sp, '_annotations.coco.json')
        if not os.path.exists(p): continue
        d = json.load(open(p, encoding='utf-8'))
        cat = {c['id']: c['name'] for c in d['categories']}
        img = {im['id']: im['file_name'] for im in d['images']}
        for a in d['annotations']:
            nm = cat.get(a['category_id'])
            if nm not in NAME2CLS: continue
            x, y, w, h = a['bbox']
            fp = os.path.join(root, sp, img[a['image_id']])
            out.setdefault(fp, []).append((NAME2CLS[nm], x, y, x+w, y+h))
            spl[fp] = sp
    return out, spl


def build_cache(root, ckpt, start=0, end=None):
    """U-Net 조각 + ★조각별 정답 클래스를 저장합니다.
    ★[start, end) 구간만 처리해 ★여러 번 나눠 만들 수 있습니다 (타임아웃 회피).
    ★load_cache 가 ★조각 파일들을 ★자동 병합합니다."""
    boxes, splits = load_boxes(root)
    allf = sorted(boxes)
    files = allf[start:end]
    sd = load(ckpt)
    F_uv, F_gt, F_img, F_sp, meta = [], [], [], [], []
    nodet = 0; t0 = time.time()
    for fi, f in enumerate(files):
        try: im = Image.open(f).convert('RGB')
        except Exception: continue
        cb = crop_box(im)
        if cb is None: nodet += 1; continue
        rgb = np.asarray(crop_to_S(im, cb), np.float32)
        roi, lm, side = palmroi.palm_roi(rgb, grow=PALM_GROW)
        if roi is None: nodet += 1; continue
        lg = forward(np.ascontiguousarray(rgb.transpose(2, 0, 1)/255.), sd)
        pred = (1/(1+np.exp(-lg)) > 0.5) & roi
        # ★박스를 ★crop→S 좌표로 옮깁니다 (★추론과 같은 변환)
        x0c, y0c, box = cb
        sx = S/min(im.width - x0c, box); sy = S/min(im.height - y0c, box)
        bxs = []
        for cls, a, b, c, d_ in boxes[f]:
            bxs.append((cls, (a-x0c)*sx, (b-y0c)*sy, (c-x0c)*sx, (d_-y0c)*sy))
        comps = palmtype.components(pred)
        for _, pts in comps:
            feat = palmtype.frag_features(pts, lm)
            # ★정답: 픽셀이 가장 많이 들어간 박스
            best, bestn = 'NONE', 0
            for cls, a, b, c, d_ in bxs:
                n = int(((pts[:, 1] >= a) & (pts[:, 1] <= c) &
                         (pts[:, 0] >= b) & (pts[:, 0] <= d_)).sum())
                if n > bestn: best, bestn = cls, n
            if bestn < len(pts)*0.5: best = 'NONE'      # ★과반이 박스 안이어야 인정
            row = []
            for k in FEATURES:
                v = feat[k]
                row.append(1.0 if (k == 'degenerate' and v) else
                           (0.0 if k == 'degenerate' else float(v)))
            F_uv.append(row)
            F_gt.append(best); F_img.append(start+fi); F_sp.append(splits.get(f, '?'))
        meta.append(os.path.basename(f))
    out = os.path.join(root, f"_bench_cache_{start:04d}.npz")
    X = np.nan_to_num(np.array(F_uv, np.float32), nan=0.0, posinf=0.0, neginf=0.0)
    np.savez_compressed(out, X=X, y=np.array(F_gt), img=np.array(F_img, np.int32),
                        split=np.array(F_sp), files=np.array(meta),
                        cols=np.array(FEATURES))
    print(f"★캐시 {len(meta)}장 · 조각 {len(F_gt)}개 · 손 미검출 {nodet}장  ({time.time()-t0:.0f}초)")
    print(f"→ {out}   (전체 {len(allf)}장 중 [{start}:{end if end else len(allf)}])")
    from collections import Counter
    print("★정답 분포:", dict(Counter(F_gt)))
    return out


def load_cache(root):
    """★조각 캐시 파일들을 ★자동 병합합니다."""
    ps = sorted(glob.glob(os.path.join(root, '_bench_cache_*.npz')))
    if not ps:
        p = os.path.join(root, CACHE)                    # ★구버전 단일 캐시
        if os.path.exists(p): ps = [p]
    if not ps:
        raise SystemExit(f"★캐시가 없습니다 — 먼저: python3 bench_assign.py cache {root}")
    Xs, ys, ims, sps, fs = [], [], [], [], []
    for p in ps:
        z = np.load(p, allow_pickle=False)
        Xs.append(z['X']); ys.append(z['y']); ims.append(z['img'])
        sps.append(z['split'] if 'split' in z else np.array(['?']*len(z['y'])))
        fs.append(z['files'])
    X = np.vstack(Xs)
    return (X, np.concatenate(ys), np.concatenate(ims),
            np.concatenate(sps), np.concatenate(fs))


# ─────────────────────────────────────────────────────────────────────────────
def predict(X, rule, mode="dev"):
    """캐시된 특징값으로 ★배정만 다시 계산합니다 (U-Net 재실행 없음)."""
    ix = {k: i for i, k in enumerate(FEATURES)}
    feats = [{k: (bool(r[ix['degenerate']]) if k == 'degenerate' else float(r[ix[k]]))
              for k in FEATURES} for r in X]
    g, why = palmtype.assign_fragments(feats, mode=mode, rule=rule)
    if g is None: return None, why
    out = np.array(['NONE']*len(feats), dtype=object)
    for k, idxs in g.items():
        for i in idxs: out[i] = k
    return out, "OK"


def score(pred, y):
    """조각 단위 정확도 + 선별 precision/recall."""
    acc = float((pred == y).mean())
    rows = {}
    for k in ('RLC', 'PTC', 'DTC', 'FATE'):
        tp = int(((pred == k) & (y == k)).sum())
        fp = int(((pred == k) & (y != k)).sum())
        fn = int(((pred != k) & (y == k)).sum())
        p = tp/max(tp+fp, 1); r = tp/max(tp+fn, 1)
        rows[k] = (p, r, 2*p*r/max(p+r, 1e-9), tp, fp, fn)
    f1m = float(np.mean([v[2] for v in rows.values()]))
    return acc, f1m, rows


def report(tag, pred, y):
    acc, f1m, rows = score(pred, y)
    print(f"\n★{tag} — ★조각 정확도 {acc*100:.1f} % · ★평균 F1 {f1m:.3f}")
    print(f"   {'선':>5} {'정밀도':>7} {'재현율':>7} {'F1':>7} {'TP':>6} {'FP':>6} {'FN':>6}")
    for k, (p, r, f, tp, fp, fn) in rows.items():
        print(f"   {k:>5} {p*100:>6.1f}% {r*100:>6.1f}% {f:>7.3f} {tp:>6} {fp:>6} {fn:>6}")
    return acc, f1m


# ─────────────────────────────────────────────────────────────────────────────
def cmd_rules(root):
    X, y, img, sp, files = load_cache(root)
    print(f"★★NOT_A_VERDICT — 배정 규칙 벤치마크 (조각 {len(y)}개 · {len(files)}장)")
    print("★박스 라벨을 정답으로 씁니다 — ★출시 판정용이 아닙니다.")
    for rule in ('v1', 'v2', 'tree'):
        p, why = predict(X, rule)
        if p is None: print(f"★{rule}: {why}"); continue
        report(f"rule={rule}", p, y)


def cmd_sweep(root, name, lo, hi, n, rule="v2"):
    X, y, img, sp, files = load_cache(root)
    print(f"★★NOT_A_VERDICT · {name} 스윕 · rule={rule} (조각 {len(y)}개)\n")
    print(f"{'값':>12} {'정확도':>9} {'평균F1':>9}")
    best = None
    for v in np.linspace(lo, hi, n):
        TH.set_dev({name: float(v)})
        p, _ = predict(X, rule)
        acc, f1m, _ = score(p, y)
        print(f"{v:>12.3f} {acc*100:>8.1f}% {f1m:>9.3f}")
        if best is None or f1m > best[2]: best = (v, acc, f1m)
    TH.clear_dev()
    print(f"\n★최고: {name}={best[0]:.3f} → 정확도 {best[1]*100:.1f} % · F1 {best[2]:.3f}")


def cmd_grid(root, n1, a1, b1, k1, n2, a2, b2, k2, rule="v2"):
    X, y, img, sp, files = load_cache(root)
    print(f"★★NOT_A_VERDICT · 2차원 스윕 · rule={rule} (칸 = ★평균 F1)\n")
    v2s = np.linspace(a2, b2, k2)
    print(f"{'':>16}" + "".join(f"{v:>8.2f}" for v in v2s) + f"   ← {n2}")
    best = None
    for x in np.linspace(a1, b1, k1):
        row = f"{n1[:14]:>10}={x:>5.2f}"
        for v in v2s:
            TH.set_dev({n1: float(x), n2: float(v)})
            p, _ = predict(X, rule)
            _, f1m, _ = score(p, y)
            row += f"{f1m:>8.3f}"
            if best is None or f1m > best[2]: best = (x, v, f1m)
        print(row)
    TH.clear_dev()
    print(f"\n★최고: {n1}={best[0]:.3f} · {n2}={best[1]:.3f} → 평균 F1 {best[2]:.3f}")


if __name__ == '__main__':
    a = [x for x in sys.argv[1:] if not x.startswith('--')]
    root = os.environ.get('CW_PALM_CTRAIN', r'D:\ChunWoon_palm_dataset\C_train')
    st = int(sys.argv[sys.argv.index('--start')+1]) if '--start' in sys.argv else 0
    en = int(sys.argv[sys.argv.index('--end')+1]) if '--end' in sys.argv else None
    if '--limit' in sys.argv: en = st + int(sys.argv[sys.argv.index('--limit')+1])
    if not a: print(__doc__); sys.exit(2)
    if a[0] == 'cache':
        build_cache(a[1] if len(a) > 1 else root,
                    os.environ.get('CW_PALM_CKPT', 'palm-api/checkpoint_aug_epoch70.pth'), st, en)
    elif a[0] == 'rules':  cmd_rules(a[1] if len(a) > 1 else root)
    elif a[0] == 'sweep':  cmd_sweep(root, a[1], float(a[2]), float(a[3]), int(a[4]))
    elif a[0] == 'grid':   cmd_grid(root, a[1], float(a[2]), float(a[3]), int(a[4]),
                                    a[5], float(a[6]), float(a[7]), int(a[8]))
    else: print(__doc__); sys.exit(2)
