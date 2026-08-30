"""★P-19 — Betti number 오차 (★순수 위상 지표) · 2026-08-28

★왜 이 파일이 필요합니까
   현재 평가 지표 `metrics.cl_dice` 는 ★위상 지표가 아닙니다. 실측 병리 2건:
     ① 과검출을 ★전혀 벌하지 않습니다 — 「전부 선이다」로 답하면 clDice = 1.000
        (같은 예측의 Dice 는 0.064). skel(전체마스크)가 1픽셀로 줄고 그 1픽셀이
        GT 안에 있으면 Tprec = 1, skel(GT)는 전부 pred 안에 있으므로 Tsens = 1.
     ② ★조각 수에 둔감합니다 — 한 곳이 크게 끊긴 예측이 0.880, 4토막으로 끊긴
        예측이 오히려 0.919. 즉 clDice 는 ★「소실 길이 지표」에 가깝습니다.
   이 프로젝트에서 「★끊긴 선을 이어 붙이지 마라」는 가장 중요한 규율 중 하나인데
   (2026-05 `_fallback_line` 이 없는 선을 지어낸 실패 이력), clDice 로는
   ★이어 붙인 모델을 벌할 수 없습니다. 그래서 ★연결 성분 수·구멍 수를 직접 셉니다.

★이 파일이 하는 일 / 하지 않는 일
   · 합니다   : b0(연결 성분 수) · b1(구멍 수) · GT 대비 오차를 ★관측해 반환합니다.
   · ★하지 않습니다 : ★합격/불합격 판정을 하지 않습니다. ★임계가 하나도 없습니다.
     P-19 는 「지표 계산」이므로 합격선을 정할 필요가 없고, 이 프로젝트는 GT 없이
     눈대중으로 임계를 정해 실패한 이력이 있어 임계는 `thresholds.py` 를 통해서만
     공급합니다. ★이 파일에 숫자 임계를 추가하지 마십시오.

★의존성 : numpy 만 씁니다 (scipy 없음 — 디스크·프록시 제약).
★재귀 없음 : 전부 ★반복(iterative) 구현입니다. 256×256 에서 스택 넘침이 없습니다.
"""
import numpy as np

__all__ = ["label", "b0", "b1", "euler_characteristic", "betti_error", "summary_line"]

# ★8-연결 / 4-연결 이웃 변위. ★구조 상수이며 임계가 아닙니다.
_OFF8 = ((-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1))
_OFF4 = ((-1, 0), (0, -1), (0, 1), (1, 0))


def _offsets(connectivity):
    if connectivity == 8:
        return _OFF8
    if connectivity == 4:
        return _OFF4
    raise ValueError(f"connectivity 는 4 또는 8 이어야 합니다 (받은 값: {connectivity!r})")


def label(mask, connectivity=8):
    """연결 성분 라벨링. 반환: (성분 수, 라벨 배열 int32 · 배경 0 · 성분 1..n)

    ★`palmtype.components()` 와 ★같은 8-연결 규칙을 씁니다(그쪽은 좌표 목록을,
      여기서는 라벨 배열을 냅니다). ★재귀가 아니라 ★명시적 스택 반복입니다 —
      256×256 전면 마스크(65,536픽셀)에서도 파이썬 재귀 한계에 걸리지 않습니다.
    """
    m = np.asarray(mask, bool)
    if m.ndim != 2:
        raise ValueError(f"2D 이진 마스크만 받습니다 (받은 shape: {m.shape})")
    off = _offsets(connectivity)
    H, W = m.shape
    lab = np.zeros((H, W), np.int32)
    if H == 0 or W == 0:
        return 0, lab
    n = 0
    ys, xs = np.nonzero(m)
    for y0, x0 in zip(ys, xs):
        if lab[y0, x0]:
            continue
        n += 1
        lab[y0, x0] = n
        stack = [(int(y0), int(x0))]
        while stack:                                   # ★반복 — 재귀 아님
            y, x = stack.pop()
            for dy, dx in off:
                ny, nx = y + dy, x + dx
                if 0 <= ny < H and 0 <= nx < W and m[ny, nx] and lab[ny, nx] == 0:
                    lab[ny, nx] = n
                    stack.append((ny, nx))
    return n, lab


def b0(mask, connectivity=8):
    """0차 Betti number = ★연결 성분 수. 빈 마스크는 0 입니다."""
    return label(mask, connectivity)[0]


def b1(mask, connectivity=8):
    """1차 Betti number = ★구멍(hole) 수.

    ★구현: 배경의 연결 성분 수에서 유도합니다.
       마스크를 배경으로 1픽셀 패딩한 뒤 배경 성분을 세면, 그중 1개는 ★바깥 배경이고
       나머지가 전부 ★내부 구멍입니다. 따라서 b1 = (배경 성분 수) − 1.
       (빈 마스크면 바깥 배경 1개뿐이므로 b1 = 0 이 자동으로 나옵니다.)

    ★★연결성 이중성(dual connectivity) — ★반드시 지켜야 하는 점:
       전경을 ★8-연결로 세면 배경은 ★4-연결로 세야 일관됩니다(그 반대도 마찬가지).
       같은 연결성을 양쪽에 쓰면 Jordan 곡선 성질이 깨집니다. 예를 들어 벽이
       ★대각선으로만 이어진 마름모 고리는, 전경 8-연결에서는 닫힌 고리인데
       배경까지 8-연결로 세면 안쪽 구멍이 대각 틈으로 ★바깥과 이어져 버려
       b1 = 0 이라는 ★틀린 답이 나옵니다. 그래서 여기서는 배경에 ★듀얼 연결성을
       씁니다: `connectivity` 인자는 ★전경 기준이고, 배경은 8↔4 로 뒤집습니다.
    """
    fg = np.asarray(mask, bool)
    if fg.ndim != 2:
        raise ValueError(f"2D 이진 마스크만 받습니다 (받은 shape: {fg.shape})")
    _offsets(connectivity)                              # 인자 검증
    dual = 4 if connectivity == 8 else 8                # ★전경 8 ↔ 배경 4
    bg = ~np.pad(fg, 1, constant_values=False)          # ★바깥 배경이 반드시 연결되도록 패딩
    n_bg = label(bg, dual)[0]
    return max(n_bg - 1, 0)                             # 바깥 배경 1개를 뺍니다


def euler_characteristic(mask, connectivity=8):
    """오일러 표수 χ. 2D 이진 이미지에서는 ★χ = b0 − b1 입니다.

    ★여기서는 b0/b1 을 쓰지 않고 ★2×2 비트쿼드(bit-quad) 셈으로 ★독립 계산합니다.
      (Gray 1971) χ8 = (Q1 − Q3 − 2·QD)/4 · χ4 = (Q1 − Q3 + 2·QD)/4
      Q1/Q3 = 전경 픽셀이 정확히 1개/3개인 2×2 창의 수, QD = 대각 쌍 창의 수.
    ★용도: `b1 = b0 − χ` 가 배경 성분 방식과 ★일치하는지 교차 검증하는 데 씁니다.
      두 경로가 어긋나면 구현이 틀린 것입니다(t_betti.py 에서 검사합니다).
    """
    m = np.asarray(mask, bool)
    if m.ndim != 2:
        raise ValueError(f"2D 이진 마스크만 받습니다 (받은 shape: {m.shape})")
    p = np.pad(m, 1, constant_values=False)
    a, b, c, d = p[:-1, :-1], p[:-1, 1:], p[1:, :-1], p[1:, 1:]
    s = a.astype(np.int16) + b + c + d
    q1 = int((s == 1).sum())
    q3 = int((s == 3).sum())
    qd = int((((a & d) & ~(b | c)) | ((b & c) & ~(a | d))).sum())
    num = (q1 - q3 - 2 * qd) if connectivity == 8 else (q1 - q3 + 2 * qd)
    if num % 4:                                          # ★이론상 일어나지 않습니다
        raise AssertionError(f"비트쿼드 합이 4의 배수가 아닙니다: {num}")
    return num // 4


def _rel(abs_err, gt_count):
    """정규화 오차.

    ★정규화 방식(명시): rel = |pred − gt| / max(gt, 1)
       · 분모는 ★GT 의 성분(또는 구멍) 수입니다 — 「GT 위상 단위 하나당 오차 배수」.
       · ★GT 가 0 일 때(빈 GT · 구멍 없는 GT) 0 으로 나누지 않도록 ★분모 하한을 1 로
         둡니다. 이때 rel 은 「예측이 만들어낸 여분 개수」와 같아집니다.
       · ★상한이 없습니다(0 ~ ∞). ★1 − rel 같은 「점수」로 바꾸지 마십시오 —
         그 순간 임계처럼 읽히기 시작합니다.
    """
    return float(abs_err) / float(max(int(gt_count), 1))


def betti_error(pred, gt, connectivity=8):
    """GT 대비 위상 오차. ★관측값만 냅니다 — ★합격 판정을 하지 않습니다.

    반환 dict
      b0_pred / b0_gt / b0_abs_err / b0_signed_err / b0_rel_err
      b1_pred / b1_gt / b1_abs_err / b1_signed_err / b1_rel_err
      betti_abs_err   : b0_abs_err + b1_abs_err (단순 합 · 가중치 없음)
      chi_pred/chi_gt : 오일러 표수(교차 검증용)
      connectivity    : 전경 연결성 (배경은 그 듀얼)

    ★★signed 를 반드시 같이 보십시오 — abs 만으로는 ★방향을 알 수 없습니다.
       b0_signed_err > 0 : 예측이 GT 보다 ★더 잘게 쪼개졌습니다 (과분할·끊김)
       b0_signed_err < 0 : 예측이 GT 보다 ★덜 쪼개졌습니다 —
                           ★끊긴 선을 ★이어 붙였다는 신호입니다(`_fallback_line` 계열).
       b1_signed_err > 0 : 없는 구멍(고리)을 만들어냈습니다
       b1_signed_err < 0 : 있는 구멍을 메웠습니다
    """
    p = np.asarray(pred, bool)
    g = np.asarray(gt, bool)
    if p.shape != g.shape:
        raise ValueError(f"pred 와 gt 의 shape 이 다릅니다: {p.shape} vs {g.shape}")
    p0, g0 = b0(p, connectivity), b0(g, connectivity)
    p1, g1 = b1(p, connectivity), b1(g, connectivity)
    d0, d1 = p0 - g0, p1 - g1
    return dict(
        b0_pred=p0, b0_gt=g0, b0_abs_err=abs(d0), b0_signed_err=d0,
        b0_rel_err=_rel(abs(d0), g0),
        b1_pred=p1, b1_gt=g1, b1_abs_err=abs(d1), b1_signed_err=d1,
        b1_rel_err=_rel(abs(d1), g1),
        betti_abs_err=abs(d0) + abs(d1),
        chi_pred=p0 - p1, chi_gt=g0 - g1,
        connectivity=int(connectivity),
    )


def summary_line(e):
    """betti_error() 결과를 한 줄로. ★판정 문구를 넣지 마십시오 — 관측만 씁니다."""
    return ("b0 {b0_pred}/{b0_gt} (오차 {b0_signed_err:+d}) · "
            "b1 {b1_pred}/{b1_gt} (오차 {b1_signed_err:+d}) · "
            "합 {betti_abs_err}").format(**e)
