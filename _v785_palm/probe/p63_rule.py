"""★★P-63 — 우리 도메인 트리를 ★손규칙 v4 로 승격하고 ★손실을 잽니다 (2026-08-31)

★★무엇을 승격하는가
   ★`ourtree.py` 가 우리 도메인 정답 212개로 학습한 트리(depth 3)를
   ★사람이 읽을 수 있는 ★규칙 v4 로 옮겼습니다 (`palmtype.assign_fragments(rule='v4')`).
   ★임계 5개는 ★레지스트리(G-7)를 거칩니다 — ★트리는 그것을 우회했습니다.

★★축이 바뀐 것이 핵심입니다 (P-58 · P-60)
   v3(Tier-C 스튜디오) : u_max · v_max
   ★v4(Tier-A 우리)     : ★cu · ang_v_deg
   ⟹ ★우리 조각은 잘아서(npix 중앙값 12 vs 47) ★u_max ≈ cu 가 되어 ★정보가 사라집니다.

★★★수치를 읽는 법 — ★이 파일에서 가장 중요한 부분입니다
   ① ★in-sample : 212개 ★전체로 적합한 임계로 ★그 212개를 채점 ⟹ ★부풀려집니다.
                  ★단 ★트리 in-sample 과 ★같은 조건이므로 ★「단순화 손실」만 재는 데는 유효합니다.
   ② ★★k-fold  : ★폴드마다 ★임계를 다시 적합해 ★남긴 이미지로 채점 ⟹ ★정직한 수치입니다.
                  ★★규칙을 다른 사람에게 썼을 때 기대할 수 있는 값은 ★이쪽입니다.

★★NOT_A_VERDICT — 1명 2손 23장입니다. ★verdict 승격은 ★P-57(Tier-B 재검증) 소관입니다.

사용:
    export CW_PALM_DATA="D:\\ChunWoon_palm_dataset\\A-smoke"
    export CW_PALM_FRAG="D:\\ChunWoon_palm_dataset\\_frag"
    python3 _v785_palm/probe/p63_rule.py [--folds 5]
"""
import sys, os, argparse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np

from pthread import load
import palmtype
import thresholds as TH
from bench_assign import FEATURES, score, report
from ourtree import read_gt, collect_ours
from tree import fit, apply_tree, CLASSES

MODE = "dev"
# ★v4 가 쓰는 특징의 FEATURES 상 위치 — 폴드 재적합 때 트리를 이 축으로 제한합니다
V4_FEATS = ("cu", "ang_v_deg", "v_max", "cv")


def apply_v4(X, th):
    """★palmtype 의 v4 와 ★같은 규칙을 ★특징 행렬에 직접 적용합니다 (동치성은 아래서 검증)."""
    cu = X[:, FEATURES.index("cu")]
    ang = X[:, FEATURES.index("ang_v_deg")]
    vmx = X[:, FEATURES.index("v_max")]
    cv = X[:, FEATURES.index("cv")]
    out = np.empty(len(X), dtype=object)
    radial = cu <= th["cu"]
    out[radial & (ang <= th["a_rlc"])] = "RLC"
    out[radial & (ang > th["a_rlc"]) & (vmx <= th["v_mid"])] = "NONE"
    out[radial & (ang > th["a_rlc"]) & (vmx > th["v_mid"])] = "PTC"
    out[~radial & (ang > th["a_dtc"])] = "DTC"
    out[~radial & (ang <= th["a_dtc"]) & (cv <= th["cv_f"])] = "FATE"
    out[~radial & (ang <= th["a_dtc"]) & (cv > th["cv_f"])] = "NONE"
    return out


def registry_th():
    return dict(cu=TH.get("V4_CU_SPLIT", MODE), a_rlc=TH.get("V4_ANG_RLC", MODE),
                v_mid=TH.get("V4_VMAX_MID", MODE), a_dtc=TH.get("V4_ANG_DTC", MODE),
                cv_f=TH.get("V4_CV_FATE", MODE))


def fit_v4(Xtr, ytr):
    """★v4 ★구조를 유지한 채 ★임계 5개만 학습 폴드에서 ★다시 적합합니다.

    ★★임의 탐색이 아닙니다 — ★깊이 1 트리(=최적 단일 분기)를 ★해당 부분집합에서 구해
       ★분기점을 가져옵니다. ★구조는 고정, ★값만 재적합입니다.
    """
    idx = {c: i for i, c in enumerate(CLASSES)}
    yi = np.array([idx[v] for v in ytr])
    w = np.ones(len(CLASSES))

    def split_at(Xs, ys, feat):
        """★부분집합에서 ★그 특징 하나로 낸 ★최적 분기점. 없으면 None."""
        if len(Xs) < 2 or len(set(ys.tolist())) < 2:
            return None
        j = FEATURES.index(feat)
        sub = np.zeros((len(Xs), len(FEATURES)), np.float32)
        sub[:, j] = Xs[:, j]                       # ★그 축만 남겨 다른 축이 뽑히지 않게
        n = fit(sub, ys, depth=1, min_leaf=1, w=w)
        return float(n["thr"]) if "feat" in n else None

    th = registry_th()                              # ★적합 실패 시 레지스트리 값으로 후퇴
    t = split_at(Xtr, yi, "cu")
    if t is not None: th["cu"] = t
    r = Xtr[:, FEATURES.index("cu")] <= th["cu"]
    for m, feat, key in ((r, "ang_v_deg", "a_rlc"), (~r, "ang_v_deg", "a_dtc")):
        t = split_at(Xtr[m], yi[m], feat)
        if t is not None: th[key] = t
    m2 = r & (Xtr[:, FEATURES.index("ang_v_deg")] > th["a_rlc"])
    t = split_at(Xtr[m2], yi[m2], "v_max")
    if t is not None: th["v_mid"] = t
    m3 = (~r) & (Xtr[:, FEATURES.index("ang_v_deg")] <= th["a_dtc"])
    t = split_at(Xtr[m3], yi[m3], "cv")
    if t is not None: th["cv_f"] = t
    return th


def main(folds):
    A = os.environ.get("CW_PALM_DATA", r"D:\ChunWoon_palm_dataset\A-smoke")
    F = os.environ.get("CW_PALM_FRAG", r"D:\ChunWoon_palm_dataset\_frag")
    ck = os.environ.get("CW_PALM_CKPT", "palm-api/checkpoint_aug_epoch70.pth")
    cp = None
    for cand in ("frag_gt_v3.csv", "frag_gt(수정).csv", "frag_gt.csv"):
        if os.path.exists(os.path.join(F, cand)): cp = os.path.join(F, cand); break
    if cp is None: raise SystemExit(f"★정답 CSV 가 없습니다: {F}")

    print("★★NOT_A_VERDICT — P-63 · 규칙 v4 승격 검증 (1명 2손 23장)")
    print(f"★정답 파일: {os.path.basename(cp)}")
    X, y, g, skipped = collect_ours(A, ck, read_gt(cp))
    print(f"★우리 도메인: 조각 {len(y)}개 · 이미지 {len(np.unique(g))}장 · 제외 {skipped}\n")

    # ── ⓪ 동치성 — ★규칙을 두 곳에 적었으므로 ★같은 답을 내는지 먼저 확인합니다
    th0 = registry_th()
    feats = [dict(zip(FEATURES, row)) for row in X]
    for f in feats: f["degenerate"] = bool(f["degenerate"])
    gr, why = palmtype.assign_fragments(feats, MODE, "v4")
    pe = np.empty(len(X), dtype=object)
    for k, idxs in gr.items():
        for i in idxs: pe[i] = k
    pv = apply_v4(X, th0)
    same = int((pe == pv).sum())
    print(f"⓪ ★동치성 검사: palmtype.v4 ↔ 이 파일의 apply_v4 — ★{same}/{len(X)} 일치")
    if same != len(X):
        print("★★불일치가 있습니다 — ★규칙이 두 곳에서 갈라졌습니다. 중단합니다.")
        return 1

    # ── ① in-sample (★부풀려집니다 · 단순화 손실 측정용)
    print("\n① ★in-sample (212 전체로 적합한 임계로 212 채점) — ★부풀려진 값입니다")
    t = palmtype.load_tree(os.path.join(F, "_ourtree_d4.json"))
    if t is not None:
        pt = np.array([palmtype._tree_apply(t, f) for f in feats], dtype=object)
        a, f1, _ = score(pt, y)
        print(f"   ★우리 트리 (depth 4)  — 정확도 {a*100:.1f} % · 평균 F1 {f1:.3f}")
    a4, f14, _ = score(pv, y)
    print(f"   ★★규칙 v4             — 정확도 {a4*100:.1f} % · 평균 F1 {f14:.3f}")
    gr3, _ = palmtype.assign_fragments(feats, MODE, "v3")
    p3 = np.empty(len(X), dtype=object)
    for k, idxs in gr3.items():
        for i in idxs: p3[i] = k
    a3, f13, _ = score(p3, y)
    print(f"   ★규칙 v3 (Tier-C 축)   — 정확도 {a3*100:.1f} % · 평균 F1 {f13:.3f}")

    # ── ② k-fold (★정직한 수치)
    print(f"\n② ★★k-fold {folds} (★폴드마다 임계 재적합 · 이미지 단위) — ★정직한 수치")
    u = np.unique(g); rng = np.random.default_rng(0); rng.shuffle(u)
    P = np.empty(len(y), dtype=object)
    for pa in np.array_split(u, folds):
        te = np.isin(g, pa); tr = ~te
        P[te] = apply_v4(X[te], fit_v4(X[tr], y[tr]))
    report("★규칙 v4 — 5-fold CV (임계 재적합)", P, y)

    print("\n★★해석")
    print(f"   ★단순화 손실 (in-sample) : 트리 → v4 = {(a-a4)*100:+.1f} %p" if t is not None else "")
    print("   ★★출시 판정에는 ★②를 쓰십시오. ★①은 ★같은 데이터를 두 번 쓴 값입니다.")
    print("   ★v4 는 ★verdict 기본값이 ★아닙니다 — 1명 2손이므로 ★P-57(Tier-B) 후에 정합니다.")
    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--folds", type=int, default=5)
    sys.exit(main(ap.parse_args().folds))
