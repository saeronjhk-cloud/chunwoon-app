"""★★임계 레지스트리 — ★verdict 경로에서 쓰이는 값이 ★하나도 없습니다.

★★왜 이 파일이 있는가 (2026-08-26 실측)
   유형체계 §3-5 에 「임계는 제이 라벨이 온 뒤 정한다」고 써 놓고,
   ★그 문서를 쓴 직후 ★눈대중으로 임계를 정했습니다 (cv 0.62 · cu ±0.18).
   ⟹ ★★3대선 전부 배정 ★**1/23 (4 %)**.
   ⟹ ★★규율을 문서에만 적으면 또 어깁니다. ★코드로 막습니다.

★★G-7 — **임계는 Tier-B 라벨에서만, 전부 한꺼번에, 한 번만 확정됩니다**
   · `source['tier'] == 'B'` 가 아니면 거부 · `n_subjects < 2` 거부 · 출처 공란 거부
   · ★`NAMES` 를 ★전부 채우지 않으면 거부 (★부분 확정 뒤 영구 잠금 방지)
   · ★확정 상태를 ★디스크에 저장합니다 ⟹ ★프로세스를 다시 띄워도 두 번째 확정이 막힙니다
   · `get(..., mode='verdict')` 는 확정 전에는 ★ThresholdUnset

★★★정직하게 — 이것은 ★가드레일이지 ★보안 경계가 아닙니다
   `thresholds.VALUES[...] = 0.3` 이나 저장 파일 삭제 한 번이면 우회됩니다.
   ★막는 대상은 ★「악의」가 아니라 ★「2026-08-26 처럼 무심코 정해 버리는 것」입니다.
   ⟹ ★그러므로 ★리뷰가 대체물이 아니라 ★보완물입니다.

★★Tier-A(제이 본인 손 24장)로는 임계를 ★확정할 수 없습니다 — 1명 2손이라 과적합됩니다.
"""
import json, os

__all__ = ["ThresholdUnset", "ThresholdFrozen", "NAMES", "get", "freeze",
           "status", "is_frozen", "FAILED_2026_08_26", "STORE",
           "set_dev", "clear_dev", "DEV"]

# ─────────────────────────────────────────────────────────────────────────────
# ★★★`dev` 모드 (ADR-002 · 2026-08-29) — ★개발 중에는 임계를 ★자유롭게 실험합니다
#
# ★★왜 열었는가 — ★내 근거가 무너졌기 때문입니다
#    D-6 의 근거는 「2026-08-26 눈대중 임계 → 배정률 4 %」 하나였는데,
#    ★P-39 에서 ★같은 임계로 ★코드 결함(P-35)만 고치니 ★13 % 가 됐습니다.
#    ⟹ ★4 % 의 주원인은 ★임계가 아니라 ★구현 결함이었습니다.
#    ⟹ ★★잘못된 원인 분석 위에 세운 잠금장치가 ★개발을 멈춰 세우고 있었습니다.
#
# ★★그래서 ★막던 것과 ★막아야 할 것을 ★분리했습니다:
#    · ★실험(dev)      → ★허용. ★디스크에 저장하지 않습니다. ★NOT_A_VERDICT 가 붙습니다
#    · ★출시 판정(verdict) → ★여전히 `freeze()` 로만. ★Tier-B · 2명 이상 · 전부 · 1회
# ─────────────────────────────────────────────────────────────────────────────
DEV = {}


def set_dev(values=None, **kw):
    """★개발 실험용 임계를 설정합니다. ★세션 안에서만 삽니다 (★디스크 미저장).

    ★사용: set_dev(ASSIGN_RLC_CU=-0.10) 또는 set_dev({"T1_GAP": 0.08})
    ★★이 값으로 낸 결과에는 ★반드시 NOT_A_VERDICT 가 붙습니다 —
       ★`palmtype.judge` 가 강제합니다. ★출시 판정에 쓸 수 없습니다.
    """
    d = dict(values or {}); d.update(kw)
    bad = [k for k in d if k not in NAMES]
    if bad:
        raise KeyError(f"알 수 없는 임계 이름: {bad}")
    DEV.update({k: float(v) for k, v in d.items()})
    return dict(DEV)


def clear_dev():
    """★실험값을 전부 지웁니다."""
    DEV.clear()
    return dict(DEV)

# ★확정 상태 저장 위치. ★저장소 안이어도 무방합니다 — 임계는 생체정보가 아닙니다.
STORE = os.environ.get("CW_PALM_THRESHOLDS",
                       os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                    "thresholds_frozen.json"))


class ThresholdUnset(Exception):
    """★임계가 아직 없습니다. ★추측해서 채우지 마십시오 — 그것이 4 % 였습니다."""


class ThresholdFrozen(Exception):
    """★임계는 정한 뒤 고치지 않습니다. 고치려면 ADR 입니다."""


# ─────────────────────────────────────────────────────────────────────────────
# ★임계 이름과 「무엇을 재는가」. ★값은 전부 None 입니다.
# ★★거리 단위 규약: ★모든 거리는 ★픽셀 거리를 `wid`(검지MCP↔새끼MCP 투영 거리)로 나눈
#    ★등방 무차원 값입니다. ★uv 정규 좌표(u/wid, v/hgt)의 비등방 거리를 ★쓰지 않습니다 (P-35).
# ─────────────────────────────────────────────────────────────────────────────
NAMES = {
    # ── 0단계: ROI (P-23)
    "ROI_RADIAL_EXTRA":  "노쪽(엄지) 꼭짓점을 wid 대비 얼마나 더 미는가",

    # ── 면적 sanity (★2026-08-28 등록 · P-40 으로 harness 를 이 값에 물립니다)
    "AREA_LO":           "ROI 대비 예측 면적 하한(%) — 미만이면 판독 불가",
    "AREA_HI":           "ROI 대비 예측 면적 상한(%) — 초과면 과검출",

    # ── 1단계: 조각 → 선 배정 (P-34 · 유형 판정의 ★선행 조건)
    "ASSIGN_HORIZ_DEG":  ("조각을 「가로」로 볼 각도 하한(도 · 세로축 기준). "
                          "★45 는 「가로가 세로보다 우세하다」의 정의값이지만 "
                          "★임계는 임계입니다 — 레지스트리를 거칩니다"),
    "ASSIGN_DTC_CV":     "가로 조각이 DTC 가 되는 정규 세로좌표 cv 하한",
    "ASSIGN_PTC_CV_LO":  "가로 조각이 PTC 가 되는 cv 하한 (상한은 ASSIGN_DTC_CV)",
    "ASSIGN_RLC_CU":     "조각이 RLC 후보가 되는 정규 가로좌표 cu 상한 (노쪽 = 음수)",
    "ASSIGN_RLC_SPAN":   ("★P-49 (2026-08-29) — 노쪽 조각이 RLC 가 되는 ★가로 span 상한 / wid. "
                          "★RLC 는 엄지두덩을 감싸는 ★호라서 ★가로로도 잡힙니다. "
                          "★손바닥을 가로지르는 PTC·DTC 는 span 이 큽니다 — 그것으로 가릅니다"),
    "ASSIGN_FATE_CU":    "세로 조각이 FATE 가 되는 |cu| 상한 (손바닥 중앙부)",

    # ── 2단계: 유형 판정 (유형체계 §3)
    "T1_GAP":            "PTC 군 ↔ DTC 군 최소 거리 / wid — 미만이면 merged",
    "T2_CLOSED":         "RLC·PTC 가 「붙었다」고 볼 근접 반경 / wid",
    "T2_COMMON_LEN":     ("T2_CLOSED 이내로 나란한 ★공통 구간 길이 / wid. "
                          "★이상이면 closed · 미만인데 접하면 meeting "
                          "(★Park 의 meeting = 노쪽에서 스치되 공통 주름이 없음)"),
    "T3_ANGLE_DEG":      "세로축과 이루는 각 상한(도) — 라벨규칙 v1 §2-3-3 잠정 35",
    "T3_LEN":            "손바닥 세로 길이 대비 길이 하한 — 잠정 25 %",
    "T3_CENTER":         "중심선에서의 |cu| 상한 — 잠정 ±30 %",
    "T3_FAINT_RATIO":    "후보 평균 굵기 / 같은 손 최대 굵기 — 미만이면 faint",

    # ── 3단계: 신뢰도
    "CONF_MARGIN":       "임계에서 이만큼 안쪽이면 uncertain 으로 내립니다",
    "CONF_HIGH_MULT":    "CONF_MARGIN 의 몇 배를 넘으면 high 인가",
}

VALUES = {k: None for k in NAMES}

# ★★2026-08-26 에 ★눈대중으로 정했던 값 — ★배정률 4 % 를 낸 그 값입니다.
#   ★남겨 두는 이유는 ★재현을 위해서지 ★사용을 위해서가 아닙니다.
#   ★verdict 모드에서는 ★절대 쓰이지 않습니다.
#   ★★AREA_LO/HI 는 ★「ROI 가 좁아져 재보정」한 값입니다 — ★결과를 보고 조정한 값이며
#     현재 harness.py 에 ★하드코딩돼 있습니다 (P-40).
FAILED_2026_08_26 = {
    "ASSIGN_HORIZ_DEG": 45.0,   # ★assign.py 는 정규 좌표에서 쟀습니다(P-35 결함)
    "ASSIGN_DTC_CV":    0.62,
    "ASSIGN_PTC_CV_LO": 0.30,
    "ASSIGN_RLC_CU":   -0.18,
    "ASSIGN_FATE_CU":   0.18,
    "T3_ANGLE_DEG":     35.0,   # ★라벨규칙 v1 §2-3-3 「잠정 · 출처 없음」 명시치
    "T3_LEN":           0.25,   # ★동上
    "T3_CENTER":        0.30,   # ★동上
    "AREA_LO":          1.5,    # ★harness.py:19 하드코딩치 (★결과를 보고 재보정)
    "AREA_HI":          6.0,    # ★동上
}

# ★★2026-08-29 이후 신설된 임계의 ★dev 초기값 (ADR-002).
#   ★`FAILED_2026_08_26` 에 넣지 않는 이유: ★그 딕셔너리는 ★2026-08-26 에 실제로 쓴 값의
#   ★역사 기록입니다. ★나중에 만든 값을 섞으면 ★그 기록이 거짓이 됩니다.
#   ★★이 값들도 ★근거가 없습니다 — ★실험 출발점일 뿐입니다. ★verdict 에서는 쓰이지 않습니다.
DEV_DEFAULTS = {
    "ASSIGN_RLC_SPAN": 0.45,   # ★출발점. ★p49_sweep 으로 탐색하십시오
}

SOURCE = None


def _load():
    global SOURCE
    if SOURCE is not None or not os.path.exists(STORE):
        return
    try:
        with open(STORE, encoding='utf-8') as f:
            d = json.load(f)
        VALUES.update({k: v for k, v in d.get("values", {}).items() if k in NAMES})
        SOURCE = d.get("source")
    except Exception as e:                                # ★조용히 넘어가지 않습니다
        raise ThresholdFrozen(f"확정 파일을 읽을 수 없습니다: {STORE} — {e}")


def is_frozen():
    _load()
    return SOURCE is not None


def status():
    """사람이 읽는 현재 상태 — 리포트에 그대로 실으십시오."""
    if not is_frozen():
        return ("★임계 미확정 (G-7). Tier-B 라벨로 freeze() 하기 전까지 "
                "verdict 모드는 전부 UNCERTAIN 을 냅니다.")
    return (f"임계 확정: tier={SOURCE.get('tier')} · {SOURCE.get('date')} · "
            f"n_labels={SOURCE.get('n_labels')} · n_subjects={SOURCE.get('n_subjects')} · "
            f"manifest={SOURCE.get('label_manifest')}")


def get(name, mode="verdict"):
    """임계를 꺼냅니다.

    mode='verdict'    : ★확정 전에는 ★ThresholdUnset. ★이것이 기본값입니다.
    mode='diagnostic' : ★2026-08-26 실패치를 씁니다. ★호출자는 반드시 NOT_A_VERDICT 를
                        출력에 남겨야 합니다 (palmtype.judge 가 강제합니다).
    """
    if name not in NAMES:
        raise KeyError(f"알 수 없는 임계 이름: {name}")
    if mode == "dev":                                   # ★★ADR-002 — 개발 실험
        if name in DEV: return DEV[name]
        if name in DEV_DEFAULTS: return DEV_DEFAULTS[name]
        v = FAILED_2026_08_26.get(name)                 # ★설정 안 한 것은 실패치로 폴백
        if v is None:
            raise ThresholdUnset(f"{name}: dev 값이 없습니다 — set_dev({name}=...) 로 넣으십시오")
        return v
    if mode == "diagnostic":
        v = FAILED_2026_08_26.get(name)
        if v is None:
            raise ThresholdUnset(f"{name}: 진단 모드에도 값이 없습니다 (2026-08-26 에 쓰지 않았습니다)")
        return v
    if mode != "verdict":
        raise ValueError(f"mode 는 'verdict' · 'diagnostic' · 'dev' 입니다: {mode}")
    if not is_frozen():
        raise ThresholdUnset(f"{name}: ★임계 미확정 (G-7 — Tier-B 라벨 필요)")
    v = VALUES[name]
    if v is None:
        raise ThresholdUnset(f"{name}: 확정 세트에 이 임계가 없습니다")
    return v


def freeze(values, source):
    """★임계를 ★한 번, ★전부 확정합니다. (P-33)

    values : ★NAMES 전부. ★하나라도 빠지면 거부합니다
    source : {'tier':'B', 'date':'YYYY-MM-DD', 'label_manifest':<파일경로>,
              'n_labels':<장수>, 'n_subjects':<인원>, 'method':<어떻게 맞췄는가>}
    """
    global SOURCE
    if is_frozen():
        raise ThresholdFrozen(f"이미 확정됐습니다: {SOURCE}. ★고치려면 ADR 이 필요합니다\n"
                              f"  (확정 파일: {STORE})")
    if not isinstance(source, dict) or source.get("tier") != "B":
        raise ThresholdFrozen("G-7: 임계는 ★Tier-B 라벨에서만 확정됩니다 (source['tier']=='B')")
    for k in ("date", "label_manifest", "n_labels", "n_subjects", "method"):
        if not source.get(k):
            raise ThresholdFrozen(f"G-7: source['{k}'] 이 비었습니다 — 출처 없는 확정은 금지입니다")
    try:
        n_sub = int(source["n_subjects"])
    except (TypeError, ValueError):
        raise ThresholdFrozen(f"G-7: n_subjects 가 숫자가 아닙니다: {source['n_subjects']!r}")
    if n_sub < 2:
        raise ThresholdFrozen("G-7: n_subjects < 2 — ★1명 표본으로 임계를 확정하지 않습니다")
    bad = [k for k in values if k not in NAMES]
    if bad:
        raise KeyError(f"알 수 없는 임계 이름: {bad}")
    missing = [k for k in NAMES if k not in values]
    if missing:                                          # ★부분 확정 → 영구 잠금 방지
        raise ThresholdFrozen(f"G-7: 임계 {len(missing)}개가 빠졌습니다 — ★전부 한꺼번에 "
                              f"확정해야 합니다: {missing}")
    VALUES.update({k: float(v) for k, v in values.items()})
    SOURCE = dict(source)
    with open(STORE, 'w', encoding='utf-8') as f:
        json.dump(dict(values=VALUES, source=SOURCE), f, ensure_ascii=False, indent=1)
    return status()
