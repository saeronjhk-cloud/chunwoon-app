"""★★★배정 분류기 — ★결정트리를 ★직접 구현합니다 (2026-08-29 · P-53)

★★왜 학습으로 가는가
   ★손으로 만든 배정 규칙은 ★조각 정확도 ★40 % 에서 막혔습니다 (인수인계 v6 §2).
   ★임계를 어떻게 조합해도 ★평균 F1 0.40 을 못 넘고,
   ★`ASSIGN_PTC_CV_LO` 는 ★값을 뭘 넣어도 결과가 같아 ★PTC 경로가 죽어 있었습니다.
   ⟹ ★★임계 문제가 아니라 ★규칙 설계의 문제입니다.

★★왜 sklearn 을 쓰지 않는가
   ① ★의존성을 늘리지 않습니다 (제이 원칙 — native 컴파일 헬 회피)
   ② ★★목적이 ★「규칙으로 내보내기」입니다 — 직접 구현이 ★투명합니다
   ③ 얕은 트리(depth 3~5)면 ★사람이 읽을 수 있는 if-else 로 나옵니다
   ⟹ ★★**여전히 「엔진」입니다** (고정 원칙 5). ★LLM 추론이 아닙니다.

★★누수 방지
   ★같은 ★이미지의 조각이 ★학습/검증 양쪽에 들어가면 ★점수가 부풀려집니다.
   ⟹ ★Roboflow 의 ★train/valid/test 분할을 ★그대로 존중합니다 (이미지 단위).

★NOT_A_VERDICT — ★정답이 ★남의 박스 라벨입니다. ★출시 판정에 쓸 수 없습니다.

사용:
  python3 tree.py train [--depth 4] [--minleaf 20]
  python3 tree.py rules  [--depth 4]      ← ★학습한 트리를 ★if-else 규칙으로 출력
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np

from bench_assign import load_cache, FEATURES, score, report, predict

CLASSES = ('RLC', 'PTC', 'DTC', 'FATE', 'NONE')


# ─────────────────────────────────────────────────────────────────────────────
# ★결정트리 (CART · gini) — numpy 만 씁니다
# ─────────────────────────────────────────────────────────────────────────────
def _gini(counts):
    n = counts.sum()
    if n == 0: return 0.0
    p = counts/n
    return float(1.0 - (p*p).sum())


def _class_counts(y_idx, k=len(CLASSES)):
    return np.bincount(y_idx, minlength=k).astype(float)


def _gini_rows(C):
    """행마다 gini. C: (n, K) 가중 카운트."""
    s = C.sum(1)
    return 1.0 - (C*C).sum(1)/np.maximum(s*s, 1e-12)


def _best_split(X, y_idx, min_leaf, w):
    """가중 gini 감소가 최대인 (특징, 임계). ★누적합으로 벡터화했습니다."""
    n, d = X.shape
    K = len(CLASSES)
    oh = np.zeros((n, K), np.float64)
    oh[np.arange(n), y_idx] = 1.0
    parent = oh.sum(0)
    base = _gini(parent*w)
    best = (0.0, None, None)
    for f in range(d):
        order = np.argsort(X[:, f], kind='mergesort')
        cs = X[order, f]
        cum = np.cumsum(oh[order], axis=0)          # (n, K) — i 까지 왼쪽
        left, right = cum[:-1], parent - cum[:-1]   # 분할점 i (0..n-2)
        nl = left.sum(1); nr = right.sum(1)
        gl = _gini_rows(left*w); gr = _gini_rows(right*w)
        gain = base - (nl/n)*gl - (nr/n)*gr
        ok = (nl >= min_leaf) & (nr >= min_leaf) & (cs[:-1] != cs[1:])
        if not ok.any(): continue
        gain = np.where(ok, gain, -np.inf)
        i = int(np.argmax(gain))
        if gain[i] > best[0]:
            best = (float(gain[i]), f, float((cs[i]+cs[i+1])/2))
    return best


def fit(X, y_idx, depth, min_leaf, w, d=0):
    cnt = _class_counts(y_idx)
    node = {'n': int(len(y_idx)), 'counts': cnt.tolist(),
            'pred': int(np.argmax(cnt*w))}
    if d >= depth or len(y_idx) < 2*min_leaf or (cnt > 0).sum() <= 1:
        return node
    gain, f, thr = _best_split(X, y_idx, min_leaf, w)
    if f is None or gain <= 1e-9: return node
    m = X[:, f] <= thr
    node.update(feat=int(f), thr=float(thr), gain=float(gain),
                L=fit(X[m], y_idx[m], depth, min_leaf, w, d+1),
                R=fit(X[~m], y_idx[~m], depth, min_leaf, w, d+1))
    return node


def apply_tree(node, X):
    out = np.empty(len(X), np.int32)
    for i, r in enumerate(X):
        nd = node
        while 'feat' in nd:
            nd = nd['L'] if r[nd['feat']] <= nd['thr'] else nd['R']
        out[i] = nd['pred']
    return out


def to_rules(node, d=0, lines=None):
    if lines is None: lines = []
    ind = '  '*d
    if 'feat' not in node:
        c = np.array(node['counts']); tot = c.sum()
        pur = c.max()/tot*100 if tot else 0
        lines.append(f"{ind}→ {CLASSES[node['pred']]}   (n={node['n']} · 순도 {pur:.0f}%)")
        return lines
    f = FEATURES[node['feat']]
    lines.append(f"{ind}if {f} <= {node['thr']:.4f}:")
    to_rules(node['L'], d+1, lines)
    lines.append(f"{ind}else:  # {f} > {node['thr']:.4f}")
    to_rules(node['R'], d+1, lines)
    return lines


# ─────────────────────────────────────────────────────────────────────────────
def main(cmd, depth, min_leaf, balance):
    root = os.environ.get('CW_PALM_CTRAIN', r'D:\ChunWoon_palm_dataset\C_train')
    X, y, img, sp, files = load_cache(root)
    y_idx = np.array([CLASSES.index(v) for v in y], np.int32)

    tr = (sp == 'train'); va = (sp == 'valid'); te = (sp == 'test')
    if tr.sum() == 0:                       # ★분할 정보가 없으면 ★이미지 단위로 나눕니다
        uim = np.unique(img); rng = np.random.default_rng(0); rng.shuffle(uim)
        k = int(len(uim)*0.7); k2 = int(len(uim)*0.85)
        tr = np.isin(img, uim[:k]); va = np.isin(img, uim[k:k2]); te = np.isin(img, uim[k2:])
        print("★분할 정보가 없어 ★이미지 단위로 70/15/15 나눴습니다 (seed 0)")

    print(f"★★NOT_A_VERDICT — 배정 분류기 (P-53)")
    print(f"★조각 {len(y)}개 · 이미지 {len(np.unique(img))}장 · 특징 {len(FEATURES)}개")
    print(f"★분할: train {tr.sum()} · valid {va.sum()} · test {te.sum()} (조각 수)")
    from collections import Counter
    print(f"★정답 분포: {dict(Counter(y))}\n")

    # ★클래스 가중 — ★희소 클래스(RLC·PTC)를 무시하지 않게
    cnt = _class_counts(y_idx[tr])
    w = np.where(cnt > 0, cnt.sum()/np.maximum(cnt, 1), 0.0) if balance else np.ones(len(CLASSES))
    w = w/w.max() if w.max() > 0 else w

    t = fit(X[tr], y_idx[tr], depth, min_leaf, w)

    if cmd == 'rules':
        print("★★학습된 규칙 (그대로 엔진에 옮길 수 있습니다)")
        print("─"*60)
        for l in to_rules(t): print(l)
        print("─"*60)
        out = os.path.join(root, f'_tree_d{depth}.json')
        json.dump(t, open(out, 'w'), ensure_ascii=False)
        print(f"★트리 → {out}")
        return

    # ★현행 손규칙과 비교
    for name, mask in (('train', tr), ('valid', va), ('test', te)):
        if mask.sum() == 0: continue
        pr = np.array([CLASSES[i] for i in apply_tree(t, X[mask])], dtype=object)
        report(f"[{name}] ★결정트리 depth={depth}", pr, y[mask])
    print("\n" + "="*60)
    for rule in ('v1', 'v2'):
        p, why = predict(X[te if te.sum() else va], rule)
        if p is not None:
            report(f"[test] 손규칙 {rule} (비교군)", p, y[te if te.sum() else va])


if __name__ == '__main__':
    a = [x for x in sys.argv[1:] if not x.startswith('--')]
    dep = int(sys.argv[sys.argv.index('--depth')+1]) if '--depth' in sys.argv else 4
    ml = int(sys.argv[sys.argv.index('--minleaf')+1]) if '--minleaf' in sys.argv else 20
    bal = '--nobalance' not in sys.argv
    if not a: print(__doc__); sys.exit(2)
    main(a[0], dep, ml, bal)
