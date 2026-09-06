"""★★★우리 도메인 배정 학습 (2026-08-29 · P-60)

★★계기: ★제이가 ★조각 정답 212개를 주셨습니다 (A-smoke 23장).
   ★기존 트리(C_train · 스튜디오)는 ★우리 도메인에서 ★55.7 % 로 떨어졌습니다 (박스 GT 76.6 %).
   ⟹ ★★우리 도메인 정답으로 ★다시 학습하면 ★오르는가?

★★과적합 경계 — ★이 데이터는 ★1명 2손 · 23장 · 212조각입니다
   ★단순 학습 점수는 ★의미가 없습니다. ⟹ ★**이미지 단위 k-fold 교차검증**만 봅니다.
   ★같은 이미지의 조각이 ★학습·검증 양쪽에 들어가면 ★점수가 부풀려집니다.

★비교하는 것
   ① 기존 트리 (C_train 학습)          — ★도메인 밖에서 배운 것
   ② ★우리 도메인만 학습 (k-fold CV)   — ★도메인은 맞지만 ★표본이 작습니다
   ③ ★두 도메인 합쳐 학습 (k-fold CV)  — ★일반화 시도

★NOT_A_VERDICT — ★1명 표본입니다. ★출시 판정에 쓸 수 없습니다.
사용: python3 ourtree.py [--depth 4] [--folds 5]
"""
import sys, os, csv, glob, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image

from harness import crop_box, crop_to_S, S, PALM_GROW
from pthread import load
from unet_np import forward
import palmroi, palmtype
from bench_assign import FEATURES, score, report, load_cache
from tree import fit, apply_tree, to_rules, CLASSES, _class_counts

OK = set(CLASSES)


def read_gt(csvpath):
    """★정답을 읽습니다. ★스키마 두 가지를 ★자동으로 가립니다 (P-68 · 2026-08-31).

    ★신 스키마 (`frag_gt_v3.csv` · ★정본)
       `gt` 가 정답 · `exclude=Y` 이면 ★제외 (`exclude_reason` 에 이유)
       ⟹ ★제외가 ★명시적입니다. ★오타로 조용히 탈락하지 않습니다.

    ★구 스키마 (`frag_gt(수정).csv` · 승계 · 재현용)
       ★`note` 가 있으면 그것이 정답, 없으면 `gt` — ★제이가 note 열에 적으셨습니다.
       ⟹ ★클래스가 아닌 note(`HALF ONLY` · `RLC & PTC`)는 ★호출자가 걸러 냅니다.

    ★★두 스키마는 ★전 218행에서 ★같은 답을 냅니다 (p68_migrate.py 가 검증합니다).
    """
    rd = csv.DictReader(open(csvpath, encoding='utf-8-sig'))
    new = 'exclude' in (rd.fieldnames or [])
    m = {}
    for r in rd:
        if new:
            v = "EXCLUDED:" + (r['exclude_reason'].strip() or 'UNSPECIFIED') \
                if r['exclude'].strip().upper() == 'Y' else r['gt'].strip().upper()
        else:
            v = (r['note'].strip().upper() or r['gt'].strip().upper())
        m[(r['file'].strip(), int(r['frag_id']))] = v
    return m


def collect_ours(root, ckpt, gtmap):
    """A-smoke 에서 ★fraglabel 과 ★같은 순서로 조각을 뽑아 정답과 맞춥니다."""
    sd = load(ckpt)
    imgs = sorted(glob.glob(os.path.join(root, '**', '*.jpg'), recursive=True))
    imgs = [i for i in imgs if '/masks/' not in i.replace('\\', '/')]
    X, y, im_id, skipped = [], [], [], {}
    for p in imgs:
        im = Image.open(p).convert('RGB')
        cb = crop_box(im)
        if cb is None: continue
        rgb = np.asarray(crop_to_S(im, cb), np.float32)
        roi, lm, side = palmroi.palm_roi(rgb, grow=PALM_GROW)
        if roi is None: continue
        lg = forward(np.ascontiguousarray(rgb.transpose(2, 0, 1)/255.), sd)
        pred = (1/(1+np.exp(-lg)) > 0.5) & roi
        base = os.path.basename(p)
        for i, (_, pts) in enumerate(palmtype.components(pred)):
            g = gtmap.get((base, i))
            if g is None: continue
            if g not in OK:                       # ★'HALF ONLY' · 'RLC & PTC' 등
                skipped[g] = skipped.get(g, 0) + 1; continue
            f = palmtype.frag_features(pts, lm)
            X.append([1.0 if f['degenerate'] else 0.0 if k == 'degenerate' else float(f[k])
                      for k in FEATURES])
            y.append(g); im_id.append(base)
    X = np.nan_to_num(np.array(X, np.float32))
    return X, np.array(y, dtype=object), np.array(im_id, dtype=object), skipped


def cv(X, y, groups, depth, minleaf, folds, extraX=None, extray=None, seed=0):
    """★이미지 단위 k-fold. ★extraX 가 있으면 ★학습에만 더합니다 (검증은 우리 도메인)."""
    u = np.unique(groups); rng = np.random.default_rng(seed); rng.shuffle(u)
    parts = np.array_split(u, folds)
    P = np.empty(len(y), dtype=object)
    for pa in parts:
        te = np.isin(groups, pa); tr = ~te
        Xtr, ytr = X[tr], y[tr]
        if extraX is not None:
            Xtr = np.vstack([Xtr, extraX]); ytr = np.concatenate([ytr, extray])
        yi = np.array([CLASSES.index(v) for v in ytr], np.int32)
        cnt = _class_counts(yi)
        w = np.where(cnt > 0, cnt.sum()/np.maximum(cnt, 1), 0.0); w = w/max(w.max(), 1e-9)
        t = fit(Xtr, yi, depth, minleaf, w)
        P[te] = [CLASSES[i] for i in apply_tree(t, X[te])]
    return P


def main(depth, minleaf, folds):
    A = os.environ.get('CW_PALM_DATA', r'D:\ChunWoon_palm_dataset\A-smoke')
    F = os.environ.get('CW_PALM_FRAG', r'D:\ChunWoon_palm_dataset\_frag')
    C = os.environ.get('CW_PALM_CTRAIN', r'D:\ChunWoon_palm_dataset\C_train')
    ck = os.environ.get('CW_PALM_CKPT', 'palm-api/checkpoint_aug_epoch70.pth')

    cp = None
    # ★★P-68 — `frag_gt_v3.csv`(gt 열 정본)를 ★먼저 찾습니다. 없으면 구 스키마로 후퇴합니다.
    for cand in ('frag_gt_v3.csv', 'frag_gt(수정).csv', 'frag_gt.csv'):
        if os.path.exists(os.path.join(F, cand)): cp = os.path.join(F, cand); break
    if cp is None: raise SystemExit(f"★정답 CSV 가 없습니다: {F}")
    print(f"★★NOT_A_VERDICT — 우리 도메인 배정 학습 (P-60)")
    print(f"★정답 파일: {os.path.basename(cp)}")

    X, y, g, skipped = collect_ours(A, ck, read_gt(cp))
    print(f"★우리 도메인: 조각 {len(y)}개 · 이미지 {len(np.unique(g))}장")
    if skipped:
        print(f"★★제외한 정답: {skipped}")
        print("   ★CLOSED = ★Park 의 closed crease — ★n=1 이라 학습에서 제외합니다 (ADR-003 · P-61)")
    from collections import Counter
    print(f"★정답 분포: {dict(Counter(y))}\n")

    # ① 기존 트리 (C_train 학습)
    t0 = palmtype.load_tree()
    if t0 is not None:
        p0 = np.array([CLASSES[i] for i in apply_tree(t0, X)], dtype=object)
        report("① 기존 트리 (C_train 학습 · 도메인 밖)", p0, y)

    # ② 우리 도메인만 — k-fold CV
    p1 = cv(X, y, g, depth, minleaf, folds)
    report(f"② ★우리 도메인만 학습 ({folds}-fold 이미지 단위 CV)", p1, y)

    # ③ 두 도메인 합쳐 — 학습에만 C_train 추가
    try:
        Xc, yc, imgc, spc, filesc = load_cache(C)
        keep = np.array([v in OK for v in yc])
        p2 = cv(X, y, g, depth, minleaf, folds, extraX=Xc[keep], extray=yc[keep])
        report(f"③ ★두 도메인 합쳐 학습 (검증은 우리 도메인 · {folds}-fold CV)", p2, y)
    except SystemExit:
        print("\n★C_train 캐시가 없어 ③은 건너뜁니다")

    # ★전체로 한 번 더 학습해 규칙을 봅니다 (★CV 점수가 아니라 ★해석용)
    yi = np.array([CLASSES.index(v) for v in y], np.int32)
    cnt = _class_counts(yi)
    w = np.where(cnt > 0, cnt.sum()/np.maximum(cnt, 1), 0.0); w = w/max(w.max(), 1e-9)
    t = fit(X, yi, 3, minleaf, w)
    print("\n★★우리 도메인 규칙 (depth 3 · ★해석용 · CV 점수 아님)")
    print("─"*58)
    for l in to_rules(t): print(l)
    print("─"*58)
    out = os.path.join(F, f'_ourtree_d{depth}.json')
    json.dump(fit(X, yi, depth, minleaf, w), open(out, 'w'), ensure_ascii=False)
    print(f"★트리 → {out}")
    print("\n★★1명 2손 표본입니다 — ★출시 판정에 쓸 수 없습니다 (Tier-B 필요).")


if __name__ == '__main__':
    d = int(sys.argv[sys.argv.index('--depth')+1]) if '--depth' in sys.argv else 4
    ml = int(sys.argv[sys.argv.index('--minleaf')+1]) if '--minleaf' in sys.argv else 8
    f = int(sys.argv[sys.argv.index('--folds')+1]) if '--folds' in sys.argv else 5
    main(d, ml, f)
