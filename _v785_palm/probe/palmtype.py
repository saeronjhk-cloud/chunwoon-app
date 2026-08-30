"""★★유형 판정 엔진 골격 — P-28 · P-34 (2026-08-28 · ★적대적 감사 반영판)

★고정 원칙 5: 판정은 ★엔진이 규칙으로 합니다. ★LLM 은 여기에 관여하지 않습니다.
★★임계는 ★하나도 들어 있지 않습니다 — 전부 `thresholds.py` 에서 받습니다(G-7).
   임계가 없으면 ★UNCERTAIN 을 냅니다. ★추측해서 채우지 않습니다.

★★P-34 — 유형체계 v1 초안이 빠뜨린 단계를 ★명시적으로 넣었습니다:
      전처리 → ★**① 조각 분리 → ② 조각 → 선 배정** → ③ 유형 판정

★★거리 단위 규약 (★2026-08-28 감사 D-1 교정)
   ★모든 거리는 ★픽셀 거리를 `wid` 로 나눈 ★등방 무차원 값입니다.
   ★uv 정규 좌표(u/wid, v/hgt)의 거리는 ★비등방이라 ★어떤 물리 단위에도 대응하지 않습니다.
   ★초판은 그 비등방 거리를 「손바닥 폭 대비」라 부르고 있었습니다 — ★고쳤습니다.
   ★`wid` 는 ★검지MCP↔새끼MCP 투영 거리입니다. ★해부학적 「손바닥 폭」이 아닙니다 —
     문서에서 「손바닥 폭」이라 쓸 때 ★이 정의를 뜻합니다.

★★`_fallback_line` 과의 경계 (§1-4)
   · 조각이 없으면 ★배정하지 않습니다. ★만들어내지 않습니다.
   · ★방향을 정할 수 없는 조각(1픽셀 등)은 ★NONE 입니다 — ★FATE 로 흘려보내지 않습니다
     (초판은 그것을 「세로」로 확정해 ★FATE 에 넣고 있었습니다 · 감사 D-4)
   · 「없음(absent)」은 ★§4 의 조건을 전부 만족할 때만 나옵니다.

★★assign.py 와의 관계 — ★4 % 재현용으로 ★동결. ★판정 경로에 쓰지 마십시오 (P-35).
"""
import json, os
import numpy as np

import thresholds as TH
from thresholds import ThresholdUnset
from palmroi import palm_frame, WRIST, M_MCP, I_MCP, P_MCP   # noqa: F401

__all__ = ["components", "frag_features", "assign_fragments", "judge",
           "T1_CODES", "T2_CODES", "T3_CODES"]

T1_CODES = ("T1-S", "T1-M", "T1-U")
T2_CODES = ("T2-C", "T2-O", "T2-M", "T2-U")
T3_CODES = ("T3-C", "T3-F", "T3-A", "T3-U")
LINES = ("RLC", "PTC", "DTC", "FATE")


# ─────────────────────────────────────────────────────────────────────────────
# ① 조각 분리
# ─────────────────────────────────────────────────────────────────────────────
def components(pred, min_pix=1):
    """8-연결 성분 분리. 반환: [ (idx, pts Nx2(y,x)) ]

    ★min_pix > 1 은 ★그 자체가 임계입니다. 기본 1(=필터 없음)로 두고,
      쓰려면 ★thresholds.py 를 거치십시오. 여기에 숫자를 적지 마십시오.
    """
    m = np.asarray(pred, bool)
    H, W = m.shape
    seen = np.zeros((H, W), bool)
    out = []
    ys, xs = np.nonzero(m)
    for y0, x0 in zip(ys, xs):
        if seen[y0, x0]: continue
        stack = [(y0, x0)]; seen[y0, x0] = True; pts = []
        while stack:
            y, x = stack.pop(); pts.append((y, x))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if dy == 0 and dx == 0: continue
                    ny, nx = y+dy, x+dx
                    if 0 <= ny < H and 0 <= nx < W and m[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True; stack.append((ny, nx))
        pts = np.array(pts)
        if len(pts) >= min_pix:
            out.append((len(out), pts))
    return out


# ─────────────────────────────────────────────────────────────────────────────
# 조각 특징값 — ★임계가 필요 없는 「관측」입니다
# ─────────────────────────────────────────────────────────────────────────────
def frag_features(pts_yx, lm):
    """조각 하나의 관측값. ★임계는 하나도 쓰지 않습니다.

    cu, cv      : 정규 좌표 중심 (u+=새끼쪽 · v: 손목 0 → 중지MCP 1)
    pix         : ★(du, dv) ★픽셀 단위 좌표 — ★거리 계산은 ★전부 이것으로 합니다
    ang_v_deg   : PCA 주축 ↔ 세로축 각 (0=세로 · 90=가로) · ★픽셀 좌표에서 잽니다
    degenerate  : ★방향을 정할 수 없는 조각 (점 2개 미만 또는 span 0)
    len_v       : PCA 주축 span / 손바닥 세로 길이
    thick       : 굵기 근사 = 픽셀 수 / 골격 길이
    """
    o = lm[WRIST]
    u, v, wid, hgt = palm_frame(lm)
    xy = np.stack([pts_yx[:, 1], pts_yx[:, 0]], 1).astype(float)
    d = xy - o
    du, dv = d @ u, d @ v                                  # ★픽셀 단위
    pix = np.stack([du, dv], 1)

    p0 = pix - pix.mean(0)
    degenerate = len(p0) < 2
    if not degenerate:
        vec = np.linalg.svd(p0, full_matrices=False)[2][0]
        proj = p0 @ vec
        len_px = float(proj.max() - proj.min())
        degenerate = len_px <= 0
        ang = float(np.degrees(np.arctan2(abs(vec[0]), abs(vec[1]))))
    else:
        len_px, ang = 0.0, float("nan")

    npix = int(len(pts_yx))
    return dict(cu=float(du.mean()/wid), cv=float(dv.mean()/hgt), pix=pix,
                wid=float(wid), hgt=float(hgt),
                ang_v_deg=ang, degenerate=bool(degenerate),
                len_px=len_px, len_v=len_px/hgt, npix=npix,
                # ★P-49 — 축별 뻗은 폭. ★호(RLC)와 가로지르는 선(PTC·DTC)을 가릅니다
                span_u=float((du.max()-du.min())/wid),
                span_v=float((dv.max()-dv.min())/hgt),
                u_min=float(du.min()/wid), u_max=float(du.max()/wid),
                v_min=float(dv.min()/hgt), v_max=float(dv.max()/hgt),
                thick=_thickness(pts_yx, npix))


def _thickness(pts_yx, npix):
    """굵기 ≈ 면적 / 골격 길이. ★metrics.skeletonize(Zhang-Suen) 를 재사용합니다."""
    try:
        from metrics import skeletonize
    except Exception:
        return float("nan")
    y0, x0 = pts_yx.min(0); y1, x1 = pts_yx.max(0)
    sub = np.zeros((y1-y0+3, x1-x0+3), bool)
    sub[pts_yx[:, 0]-y0+1, pts_yx[:, 1]-x0+1] = True
    n = int(skeletonize(sub).sum())
    return float(npix/n) if n else float("nan")


def _pairdist(feats, ia, ib):
    """두 그룹 사이 ★픽셀 최소 거리 / wid — ★등방입니다."""
    a = np.vstack([feats[i]["pix"] for i in ia])
    b = np.vstack([feats[i]["pix"] for i in ib])
    dmin = np.sqrt(((a[:, None, :] - b[None, :, :])**2).sum(-1)).min()
    return float(dmin/feats[ia[0]]["wid"])


# ─────────────────────────────────────────────────────────────────────────────
# ② 조각 → 선 배정 (P-34)
# ─────────────────────────────────────────────────────────────────────────────
# ★★학습된 배정 트리 (P-53 · ADR-002 · 2026-08-29)
#   ★출처: Roboflow `palmistry_seg` 박스 라벨 425장 · 조각 2,435개로 학습한 ★결정트리(depth 4)
#   ★성능(test 79조각): ★조각 정확도 81.0 % · 평균 F1 0.817
#                       (★손규칙 v1 45.6 %/0.396 · v2 44.3 %/0.368 대비 ★약 2배)
#   ★★핵심 발견: ★가장 강한 특징이 ★`u_max`(조각이 자쪽으로 뻗은 끝점)입니다.
#      ★손규칙은 ★`cu`(중심)와 ★`ang_v_deg`(방향)를 썼는데 —
#      ★조각이 파편화되면 ★중심은 흔들리고, ★호(arc)에서 방향은 무의미합니다.
#      ★반면 ★「어디까지 뻗었는가」는 ★파편화돼도 살아남습니다.
#   ★★한계: ★정답이 ★남의 박스 라벨입니다 (경계 정의가 우리 라벨규칙 §3 과 다릅니다).
#      ⟹ ★**출시 판정 GT 로 쓰지 마십시오.** ★Tier-B 로 재검증이 필요합니다 (P-57).
_TREE = None
_TREE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assign_tree.json')
TREE_FEATURES = ('cu', 'cv', 'ang_v_deg', 'span_u', 'span_v', 'len_v',
                 'u_min', 'u_max', 'v_min', 'v_max', 'thick', 'npix', 'degenerate')
TREE_CLASSES = ('RLC', 'PTC', 'DTC', 'FATE', 'NONE')


def load_tree(path=None):
    """★학습된 트리를 읽습니다. ★없으면 None (호출부가 fail-closed 로 처리)."""
    global _TREE
    p = path or _TREE_PATH
    if _TREE is None and os.path.exists(p):
        with open(p, encoding='utf-8') as f:
            _TREE = json.load(f)
    return _TREE


def _tree_apply(node, f):
    while 'feat' in node:
        k = TREE_FEATURES[node['feat']]
        v = f[k]
        v = (1.0 if v else 0.0) if k == 'degenerate' else float(v)
        node = node['L'] if v <= node['thr'] else node['R']
    return TREE_CLASSES[node['pred']]


def assign_fragments(feats, mode="verdict", rule="v2"):
    """반환: ({'RLC':[i,...], ..., 'NONE':[i,...]}, reason)
    ★임계가 없으면 ★배정하지 않고 (None, 'THRESHOLD_UNSET:...') 를 냅니다.

    rule='v1' — ★방향 우선 (2026-08-26 원안). ★재현·비교용으로 남깁니다
    rule='v2' — ★★위치 우선 (P-49 · ADR-002 · 2026-08-29). ★기본값

    ★★왜 v2 인가 (P-49)
       v1 은 ★`(not horiz) and cu <= rlc_cu → RLC` 로 ★RLC 를 ★「세로 조각」으로 규정했습니다.
       ★그런데 ★RLC(생명선)는 ★엄지두덩을 ★감싸는 ★호(arc)입니다 —
       ★라벨규칙 v1 §3-1 이 ★「활처럼」이라고 정의해 놓았습니다.
       ★실측(p23_diag): ★노쪽 조각 54개 중 ★46개(85 %)가 ★「가로」로 분류돼
          ★RLC 가 될 자격을 잃고 있었습니다.
       ⟹ ★v2 는 ★위치(노쪽)를 ★먼저 보고, ★가로 span 으로 ★가로지르는 선(PTC·DTC)만 걸러냅니다.
       ⟹ ★★이것은 ★임계 튜닝이 아니라 ★모델링 오류 교정입니다 — ★해부학적 사실입니다.
    """
    if rule == "tree":                       # ★★P-53 — 학습된 배정 트리
        t = load_tree()
        if t is None:
            return None, "TREE_MISSING:assign_tree.json 이 없습니다 (fail-closed)"
        out = {k: [] for k in LINES + ("NONE",)}
        for i, f in enumerate(feats):
            if f["degenerate"]:              # ★방향·형태 불명 조각은 그대로 NONE
                out["NONE"].append(i); continue
            out[_tree_apply(t, f)].append(i)
        return out, "OK"

    try:
        horiz_dg = TH.get("ASSIGN_HORIZ_DEG", mode)
        dtc_cv   = TH.get("ASSIGN_DTC_CV", mode)
        ptc_lo   = TH.get("ASSIGN_PTC_CV_LO", mode)
        rlc_cu   = TH.get("ASSIGN_RLC_CU", mode)
        fate_cu  = TH.get("ASSIGN_FATE_CU", mode)
        rlc_span = TH.get("ASSIGN_RLC_SPAN", mode) if rule == "v2" else None
    except ThresholdUnset as e:
        return None, f"THRESHOLD_UNSET:{e}"

    out = {k: [] for k in LINES + ("NONE",)}
    for i, f in enumerate(feats):
        if f["degenerate"]:                    # ★방향 불명 → ★배정하지 않습니다 (감사 D-4)
            out["NONE"].append(i); continue
        horiz = f["ang_v_deg"] > horiz_dg      # ★픽셀 좌표에서 잰 각 (P-35 교정)
        cu, cv = f["cu"], f["cv"]

        if rule == "v2":
            # ★① 위치 먼저 — ★노쪽에 있고 ★가로로 길게 뻗지 않았으면 ★RLC (방향 무관)
            if cu <= rlc_cu and f["span_u"] <= rlc_span:
                out["RLC"].append(i); continue
            # ★② 나머지는 방향으로
            if   horiz and cv >= dtc_cv:                 k = "DTC"
            elif horiz and ptc_lo <= cv < dtc_cv:        k = "PTC"
            elif (not horiz) and abs(cu) < fate_cu:      k = "FATE"
            else:                                        k = "NONE"
        else:                                  # ★v1 — 2026-08-26 원안 (재현용)
            if   horiz and cv >= dtc_cv:                 k = "DTC"
            elif horiz and ptc_lo <= cv < dtc_cv:        k = "PTC"
            elif (not horiz) and cu <= rlc_cu:           k = "RLC"
            elif (not horiz) and abs(cu) < fate_cu:      k = "FATE"
            else:                                        k = "NONE"
        out[k].append(i)
    return out, "OK"


# ─────────────────────────────────────────────────────────────────────────────
# ③ 유형 판정
# ─────────────────────────────────────────────────────────────────────────────
def _uncertain(code_u, reason, feature=None):
    return dict(code=code_u, confidence=None, reason=reason, feature=feature)


def _graded(code, feature, thresh, margin, high_mult):
    if margin is None:
        return dict(code=code, confidence=None, reason="CONF_MARGIN_UNSET", feature=feature)
    d = abs(feature - thresh)
    if d < margin:
        return dict(code=None, confidence="low", reason="NEAR_THRESHOLD", feature=feature)
    return dict(code=code, confidence=("high" if d >= high_mult*margin else "mid"),
                reason="OK", feature=feature)


def _conf(mode):
    return TH.get("CONF_MARGIN", mode), TH.get("CONF_HIGH_MULT", mode)


def judge_T1(feats, groups, mode="verdict"):
    """가로 주름 결합 — PTC 군 ↔ DTC 군 ★최소 거리 / wid."""
    if groups is None: return _uncertain("T1-U", "ASSIGN_UNAVAILABLE")
    if not groups["PTC"] or not groups["DTC"]:
        return _uncertain("T1-U", "MISSING_PTC_OR_DTC")
    gap = _pairdist(feats, groups["PTC"], groups["DTC"])
    try:
        t = TH.get("T1_GAP", mode); m, hm = _conf(mode)
    except ThresholdUnset as e:
        return _uncertain("T1-U", f"THRESHOLD_UNSET:{e}", gap)
    g = _graded("T1-M" if gap < t else "T1-S", gap, t, m, hm)
    if g["code"] is None: g["code"] = "T1-U"
    return g


def judge_T2(feats, groups, mode="verdict"):
    """기시부 결합 (★Park 정의에 맞춘 2특징 판정 · 감사 I-4 교정)

    ★gap        : RLC 군 ↔ PTC 군 ★최소 거리 / wid
    ★common_len : ★T2_CLOSED 이내로 붙어 있는 ★공통 구간 길이 / wid
       closed  = 공통 주름을 이룬다        → common_len ≥ T2_COMMON_LEN
       meeting = ★노쪽에서 스치되 공통 주름이 없다 → gap < T2_CLOSED 인데 공통 구간이 짧다
       open    = 만나지 않는다             → gap ≥ T2_CLOSED
    ★RLC 미검출이면 ★uncertain 입니다. ★추정하지 않습니다.
    """
    if groups is None: return _uncertain("T2-U", "ASSIGN_UNAVAILABLE")
    if not groups["RLC"]: return _uncertain("T2-U", "RLC_NOT_DETECTED")
    if not groups["PTC"]: return _uncertain("T2-U", "PTC_NOT_DETECTED")
    gap = _pairdist(feats, groups["RLC"], groups["PTC"])
    try:
        c = TH.get("T2_CLOSED", mode); cl = TH.get("T2_COMMON_LEN", mode); m, hm = _conf(mode)
    except ThresholdUnset as e:
        return _uncertain("T2-U", f"THRESHOLD_UNSET:{e}", gap)

    # ★공통 구간: PTC 점들 중 RLC 에서 c*wid 이내인 것들의 ★세로 방향 span
    a = np.vstack([feats[i]["pix"] for i in groups["RLC"]])
    b = np.vstack([feats[i]["pix"] for i in groups["PTC"]])
    wid = feats[groups["RLC"][0]]["wid"]
    near = b[np.sqrt(((b[:, None, :] - a[None, :, :])**2).sum(-1)).min(1) <= c*wid]
    common = float((near.max(0) - near.min(0)).max()/wid) if len(near) else 0.0

    if gap >= c:
        g = _graded("T2-O", gap, c, m, hm)
    elif common >= cl:
        g = _graded("T2-C", common, cl, m, hm)
    else:
        g = _graded("T2-M", common, cl, m, hm)
    if g["code"] is None: g["code"] = "T2-U"
    g["feature"] = dict(gap=round(gap, 4), common_len=round(common, 4))
    return g


def t3_candidates(feats, mode="verdict"):
    try:
        ang = TH.get("T3_ANGLE_DEG", mode)
        ln  = TH.get("T3_LEN", mode)
        ctr = TH.get("T3_CENTER", mode)
    except ThresholdUnset as e:
        return None, f"THRESHOLD_UNSET:{e}"
    idx = [i for i, f in enumerate(feats)
           if not f["degenerate"] and f["ang_v_deg"] <= ang
           and f["len_v"] >= ln and abs(f["cu"]) <= ctr]
    return idx, "OK"


def judge_T3(feats, t1, t2, area_ok, mode="verdict"):
    """세로 주름 등급.

    ★「없음(T3-A)」 조건은 ★4개입니다 (유형체계 §4):
       ① 손 검출 ② T1·T2 가 uncertain 아님 ③ 면적 sanity ④ 후보 임계 미달
    ★★①은 ★상위 `judge()` 가 ★fail-closed 로 먼저 처리하므로(손 미검출이면 여기 오지 않습니다)
      ★이 함수가 검사하는 것은 ★②③④ 입니다. (감사 C-1)
    """
    cand, why = t3_candidates(feats, mode)
    if cand is None:
        return _uncertain("T3-U", why)

    if cand:
        thick = [feats[i]["thick"] for i in cand if np.isfinite(feats[i]["thick"])]
        allt  = [f["thick"] for f in feats if np.isfinite(f["thick"])]
        if not thick or not allt:
            return _uncertain("T3-U", "THICKNESS_UNMEASURABLE")
        ratio = float(np.mean(thick)/max(allt))
        try:
            t = TH.get("T3_FAINT_RATIO", mode); m, hm = _conf(mode)
        except ThresholdUnset as e:
            return _uncertain("T3-U", f"THRESHOLD_UNSET:{e}", ratio)
        g = _graded("T3-F" if ratio < t else "T3-C", ratio, t, m, hm)
        if g["code"] is None: g["code"] = "T3-U"
        return g

    gate = [("T1_UNCERTAIN", t1["code"] != "T1-U"),
            ("T2_UNCERTAIN", t2["code"] != "T2-U"),
            ("AREA_SANITY_UNMET", bool(area_ok))]
    failed = [n for n, ok in gate if not ok]
    if failed:
        return _uncertain("T3-U", "ABSENT_GATE_UNMET:" + ",".join(failed), 0)
    return dict(code="T3-A", confidence="mid", reason="OK", feature=0)


# ─────────────────────────────────────────────────────────────────────────────
# 진입점
# ─────────────────────────────────────────────────────────────────────────────
def default_rule(mode):
    """★`diagnostic` 은 ★2026-08-26 재현이므로 ★그때의 규칙(v1)을 씁니다.
    ★그 외에는 ★학습된 트리(P-53)를 씁니다 — ★없으면 ★v2 로 물러납니다.

    ★★근거: 박스 정답 2,435조각에서 ★손규칙 v1 44.9 % · v2 41.5 % vs ★트리 76.6 %.
    ★★한계: ★트리는 ★Tier-C(남의 박스 라벨 · 스튜디오 도메인)에서 학습됐습니다.
       ⟹ ★**출시 판정 전에 ★Tier-B 로 재검증해야 합니다 (P-57).**
    """
    if mode == "diagnostic": return "v1"
    return "tree" if load_tree() is not None else "v2"


def judge(pred, lm, hand, area_ok, mode="verdict", min_pix=1, rule=None):
    """전체 판정.

    pred     : (H,W) bool — U-Net p>0.5 & ROI
    lm       : MediaPipe 21 랜드마크 (None 이면 손 미검출 → ★fail-closed)
    area_ok  : ★면적 sanity 통과 여부. ★호출자가 계산해 넘깁니다
               (★현재 그 임계는 harness.py 에 하드코딩돼 있습니다 — P-40)
    mode     : 'verdict'(기본) 또는 'diagnostic'
    """
    if rule is None: rule = default_rule(mode)
    res = dict(mode=mode, thresholds=TH.status(), hand=hand,
               n_frags=0, assign_reason=None, groups=None,
               T1=None, T2=None, T3=None, notes=[])
    if mode == "diagnostic":
        res["NOT_A_VERDICT"] = ("★2026-08-26 실패치(배정률 4 %)를 쓰는 진단 실행입니다. "
                                "★판정·리포트·앱 출력에 사용할 수 없습니다.")
    elif mode == "dev":                                  # ★★ADR-002
        res["NOT_A_VERDICT"] = ("★개발 실험(dev) 실행입니다 — 임계를 자유롭게 넣은 값입니다. "
                                "★출시 판정에 쓸 수 없습니다. 판정은 freeze() 후 verdict 로만.")
        res["dev_values"] = dict(TH.DEV)
    if lm is None:
        for k in ("T1", "T2", "T3"):
            res[k] = _uncertain(k + "-U", "HAND_NOT_DETECTED")
        res["notes"].append("손 미검출 — 판독 불가 (fail-closed)")
        return res

    feats = [frag_features(p, lm) for _, p in components(pred, min_pix=min_pix)]
    res["n_frags"] = len(feats)
    res["n_degenerate"] = sum(1 for f in feats if f["degenerate"])

    groups, why = assign_fragments(feats, mode, rule)
    res["assign_reason"] = why
    res["assign_rule"] = rule
    res["groups"] = ({k: len(v) for k, v in groups.items()} if groups else None)

    t1 = judge_T1(feats, groups, mode)
    t2 = judge_T2(feats, groups, mode)
    t3 = judge_T3(feats, t1, t2, area_ok=area_ok, mode=mode)
    res["T1"], res["T2"], res["T3"] = t1, t2, t3
    return res
