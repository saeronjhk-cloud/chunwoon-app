"""★★★P-24 조각 병합 — ★정답으로 검증합니다 (2026-08-29)

★★왜 이제 하는가
   ★그동안 P-24 를 미뤄 왔습니다 — ★「증거 없이 이으면 그것이 `_fallback_line`」이기 때문입니다.
   ★★그런데 ★P-58 에서 ★도메인 격차의 본질이 ★조각 파편화임이 드러났습니다:
      ★우리 도메인 조각 ★npix 중앙값 12 vs 학습 도메인 ★47 (★4배)
      ★트리는 ★`u_max`(뻗은 끝점)로 판정하는데 ★조각이 잘면 ★멀리 못 뻗습니다
   ★★그리고 ★이제 ★정답(박스 라벨)이 있습니다.
   ⟹ ★★**병합이 정확도를 ★올리는지 내리는지 ★숫자로 잽니다. ★지어내는 것이 아닙니다.**

★병합 규칙 (★기하 휴리스틱이지만 ★검증됩니다)
   두 조각을 잇는 조건 — ★전부 만족할 때만:
     ① ★끝점 거리 / wid  <= MERGE_DIST
     ② ★두 조각의 주축 방향 차이(도) <= MERGE_ANG
     ③ ★이음선의 방향도 ★양쪽 주축과 ★MERGE_ANG 이내
        (★③ 이 없으면 ★나란한 두 선을 ★옆으로 이어붙입니다)

★★정답 처리: 병합된 덩어리의 정답 = ★구성 조각의 ★픽셀 가중 다수결.
   ⟹ ★서로 다른 선을 이으면 ★그만큼 정확도가 ★떨어집니다. ★그것이 측정됩니다.

★NOT_A_VERDICT — 관측·실험입니다.
사용: python3 p24_merge.py [--n 60] [--grid]
"""
import sys, os, json, glob, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image

from harness import crop_box, crop_to_S, S, PALM_GROW
from pthread import load
from unet_np import forward
import palmroi, palmtype
from bench_assign import load_boxes, NAME2CLS, score, report

CLASSES = ('RLC', 'PTC', 'DTC', 'FATE', 'NONE')


def endpoints(pix):
    """조각의 두 끝점(픽셀 좌표계 du,dv)과 주축 단위벡터."""
    c = pix.mean(0); p0 = pix - c
    if len(p0) < 2: return c, c, np.array([0.0, 1.0])
    vec = np.linalg.svd(p0, full_matrices=False)[2][0]
    t = p0 @ vec
    return c + vec*t.min(), c + vec*t.max(), vec


def ang_between(a, b):
    """두 방향(부호 무시) 사이 각도(도)."""
    c = abs(float(np.dot(a, b)))/(np.linalg.norm(a)*np.linalg.norm(b) + 1e-9)
    return float(np.degrees(np.arccos(np.clip(c, 0, 1))))


def merge_groups(pixs, wid, dist, angd):
    """union-find 로 병합 그룹을 만듭니다."""
    n = len(pixs)
    par = list(range(n))
    def find(x):
        while par[x] != x: par[x] = par[par[x]]; x = par[x]
        return x
    def uni(a, b):
        ra, rb = find(a), find(b)
        if ra != rb: par[rb] = ra

    ends = [endpoints(p) for p in pixs]
    for i in range(n):
        ai, bi, vi = ends[i]
        for j in range(i+1, n):
            aj, bj, vj = ends[j]
            if ang_between(vi, vj) > angd: continue          # ②
            best = None
            for e1 in (ai, bi):
                for e2 in (aj, bj):
                    d = float(np.linalg.norm(e1-e2))/wid
                    if best is None or d < best[0]: best = (d, e1, e2)
            if best[0] > dist: continue                       # ①
            link = best[2]-best[1]
            if np.linalg.norm(link) > 1e-6:                   # ③
                if ang_between(link, vi) > angd or ang_between(link, vj) > angd: continue
            uni(i, j)
    g = {}
    for i in range(n): g.setdefault(find(i), []).append(i)
    return list(g.values())


def collect(root, ckpt, n_img):
    """C_train 에서 ★픽셀까지 모읍니다 (병합에 필요)."""
    boxes, splits = load_boxes(root)
    files = sorted(boxes)[:n_img]
    sd = load(ckpt)
    out = []
    for f in files:
        try: im = Image.open(f).convert('RGB')
        except Exception: continue
        cb = crop_box(im)
        if cb is None: continue
        rgb = np.asarray(crop_to_S(im, cb), np.float32)
        roi, lm, side = palmroi.palm_roi(rgb, grow=PALM_GROW)
        if roi is None: continue
        lg = forward(np.ascontiguousarray(rgb.transpose(2, 0, 1)/255.), sd)
        pred = (1/(1+np.exp(-lg)) > 0.5) & roi
        x0c, y0c, box = cb
        sx = S/min(im.width-x0c, box); sy = S/min(im.height-y0c, box)
        bxs = [(c, (a-x0c)*sx, (b-y0c)*sy, (cc-x0c)*sx, (d-y0c)*sy)
               for c, a, b, cc, d in boxes[f]]
        comps = palmtype.components(pred)
        if not comps: continue
        items = []
        for _, pts in comps:
            best, bestn = 'NONE', 0
            for c, a, b, cc, d in bxs:
                k = int(((pts[:, 1] >= a) & (pts[:, 1] <= cc) &
                         (pts[:, 0] >= b) & (pts[:, 0] <= d)).sum())
                if k > bestn: best, bestn = c, k
            if bestn < len(pts)*0.5: best = 'NONE'
            items.append((pts, best))
        out.append((items, lm))
    return out


def evaluate(data, dist, angd, do_merge=True):
    P, Y = [], []
    for items, lm in data:
        u, v, wid, hgt = palmroi.palm_frame(lm)
        pixs = []
        for pts, gt in items:
            xy = np.stack([pts[:, 1], pts[:, 0]], 1).astype(float) - lm[palmroi.WRIST]
            pixs.append(np.stack([xy @ u, xy @ v], 1))
        groups = merge_groups(pixs, wid, dist, angd) if do_merge else [[i] for i in range(len(items))]
        for gidx in groups:
            allpts = np.vstack([items[i][0] for i in gidx])
            f = palmtype.frag_features(allpts, lm)
            g, why = palmtype.assign_fragments([f], mode="dev", rule="tree")
            pr = 'NONE'
            if g:
                for k, ids in g.items():
                    if ids: pr = k
            # ★정답 = 픽셀 가중 다수결
            w = {}
            for i in gidx:
                w[items[i][1]] = w.get(items[i][1], 0) + len(items[i][0])
            gt = max(w, key=w.get)
            P.append(pr); Y.append(gt)
    return np.array(P, dtype=object), np.array(Y, dtype=object)


def main(n_img, grid):
    root = os.environ.get('CW_PALM_CTRAIN', r'D:\ChunWoon_palm_dataset\C_train')
    ck = os.environ.get('CW_PALM_CKPT', 'palm-api/checkpoint_aug_epoch70.pth')
    t0 = time.time()
    data = collect(root, ck, n_img)
    nfr = sum(len(i) for i, _ in data)
    print(f"★★NOT_A_VERDICT — P-24 조각 병합 실험")
    print(f"★이미지 {len(data)}장 · 조각 {nfr}개  ({time.time()-t0:.0f}초)\n")

    p, y = evaluate(data, 0, 0, do_merge=False)
    a0, f0, _ = score(p, y)
    print(f"{'병합 없음':>22} → 정확도 {a0*100:>5.1f} % · F1 {f0:.3f} · 덩어리 {len(y)}개")

    best = (f0, None, None)
    # ★★병합을 ★너무 키우면 ★서로 다른 선이 이어집니다 — ★그러면 정확도가 ★떨어집니다.
    #   ★그것이 ★안전장치입니다. ★최적점을 찾되 ★그 너머는 스스로 나빠집니다.
    combos = [(d, a) for d in (0.10, 0.15, 0.20, 0.30) for a in (30, 40, 55)] if grid \
        else [(0.05, 20), (0.10, 20), (0.10, 30)]
    print(f"\n{'거리':>8} {'각도':>6} {'정확도':>9} {'F1':>8} {'덩어리':>8}")
    for d, a in combos:
        p, y = evaluate(data, d, a)
        acc, f1m, _ = score(p, y)
        mark = " ★" if f1m > f0 else ""
        print(f"{d:>8.2f} {a:>6}° {acc*100:>8.1f}% {f1m:>8.3f} {len(y):>8}{mark}")
        if f1m > best[0]: best = (f1m, d, a)

    print()
    if best[1] is None:
        print("★★병합이 ★도움이 되지 않았습니다 — ★현행(병합 없음)을 유지하십시오.")
        print("   ★이것도 결과입니다. ★근거 없이 잇지 않은 것이 옳았습니다.")
    else:
        print(f"★★최고: 거리 {best[1]} · 각도 {best[2]}° → F1 {best[0]:.3f} "
              f"(병합 없음 {f0:.3f} 대비 {best[0]-f0:+.3f})")
        p, y = evaluate(data, best[1], best[2])
        report(f"병합(거리 {best[1]} · 각도 {best[2]}°)", p, y)
    print("\n★★임계를 확정하지 않았습니다 — ★관측입니다 (G-7 정신).")


if __name__ == '__main__':
    n = int(sys.argv[sys.argv.index('--n')+1]) if '--n' in sys.argv else 60
    main(n, '--grid' in sys.argv)
