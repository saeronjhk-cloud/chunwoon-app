"""★P-19 자체 검사 — Betti number 오차 (2026-08-28)
사용: cd _v785_palm/probe && python3 t_betti.py
★전건 통과해야 합니다.

★★이 검사의 핵심 질문은 하나입니다:
   ★「clDice 가 못 재는 것을 Betti 가 재는가?」
   ⑥번 절이 그 답이고, 나머지는 그 답을 믿을 수 있게 하는 기초 검사입니다.

★★이 검사가 ★보증하지 못하는 것 (정직하게)
   · ★합성 마스크만 씁니다. ★실제 사진·실제 체크포인트로 돌린 적이 ★없습니다.
   · ★실제 손금 GT 의 b0 분포(선 하나가 평균 몇 조각인지)는 ★미측정입니다.
   · ★합격 임계를 ★정하지 않습니다. P-19 는 지표 계산이며, 임계는 GT 를 갖춘 뒤
     `thresholds.py` 로만 공급합니다(G-7). ★여기 숫자를 적지 마십시오.
   · ★clDice 실측치(0.880 / 0.919 / 1.000)는 ★프로젝트가 실데이터에서 관측한 값이고,
     아래 표의 숫자는 ★그 병리를 재현하도록 만든 ★합성 케이스의 ★실측값입니다.
     ★두 숫자가 같은 실험에서 나온 것은 ★아닙니다.
"""
import sys, os, ast, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np
import metrics
import betti

OK = []
def chk(name, cond):
    OK.append((name, bool(cond)))
    print(("  ✅ " if cond else "  ❌ ") + name)


# ─────────────────────────────────────────────────────────────────────────────
# 합성 도형
# ─────────────────────────────────────────────────────────────────────────────
H, W = 64, 256
_X0, _X1, _ROW = 15, 219, slice(30, 33)          # ★구조 파라미터(도형 좌표)이지 임계가 아닙니다

def stroke(gaps=()):
    """가로 획 하나(굵기 3px). gaps 로 끊습니다."""
    m = np.zeros((H, W), bool)
    m[_ROW, _X0:_X1] = True
    for a, b in gaps:
        m[_ROW, a:b] = False
    return m

def donut(hole=True):
    m = np.zeros((30, 30), bool)
    m[5:25, 5:25] = True
    if hole:
        m[10:20, 10:20] = False
    return m

def diamond_ring():
    """★벽이 ★대각선으로만 이어진 마름모 고리 — 연결성 이중성 검사용."""
    n, c, r = 21, 10, 8
    yy, xx = np.mgrid[0:n, 0:n]
    return (np.abs(yy - c) + np.abs(xx - c)) == r

def x_cross():
    """대각 X — 8-연결이면 한 덩어리, 4-연결이면 픽셀마다 따로."""
    m = np.zeros((11, 11), bool)
    for i in range(11):
        m[i, i] = True
        m[i, 10 - i] = True
    return m

def palm4():
    """★손금 4선을 본뜬 ★조각난 GT (교차부를 비워 4조각이 되게 했습니다 —
       t_palmtype.fake_pred 와 같은 취지의 합성입니다)."""
    m = np.zeros((128, 128), bool)
    m[35, 30:100] = True                       # DTC
    m[50, 20:90]  = True                       # PTC
    for k in range(55):                        # FATE (세로)
        m[55 + k, 64] = True
    for k in range(50):                        # RLC (사선)
        m[58 + k, 40 - k // 3] = True
    return m


# ─────────────────────────────────────────────────────────────────────────────
print("① 연결 성분 수 b0 — 기본")
chk("빈 마스크 b0 = 0", betti.b0(np.zeros((8, 8), bool)) == 0)
one = np.zeros((8, 8), bool); one[3, 3] = True
chk("1픽셀 b0 = 1", betti.b0(one) == 1)
chk("이어진 획 b0 = 1", betti.b0(stroke()) == 1)
chk("한 곳 끊긴 획 b0 = 2", betti.b0(stroke(((96, 139),))) == 2)
chk("4토막 획 b0 = 4", betti.b0(stroke(((55, 65), (96, 106), (137, 147)))) == 4)
try:                                   # ★읽기만 합니다 — palmtype.py 를 수정하지 않습니다
    import palmtype as _pt
    _cmp_ok = betti.b0(palm4()) == len(_pt.components(palm4()))
    _cmp_why = "★palmtype.components() 와 8-연결 성분 수가 일치한다"
except Exception as _e:                # ★import 실패 시 「미확인」으로 남깁니다
    _cmp_ok, _cmp_why = False, f"★palmtype.components() 대조 — ★미확인({type(_e).__name__})"
chk(_cmp_why, _cmp_ok)
chk("★손금 4선 합성 GT 는 4조각", betti.b0(palm4()) == 4)
chk("전면 마스크 b0 = 1", betti.b0(np.ones((30, 30), bool)) == 1)

print("\n② 4-연결 vs 8-연결 — ★대각 케이스에서 갈라져야 합니다")
diag = np.zeros((4, 4), bool); diag[1, 1] = diag[2, 2] = True
chk("대각 2픽셀: 8-연결이면 1, 4-연결이면 2",
    betti.b0(diag, 8) == 1 and betti.b0(diag, 4) == 2)
xc = x_cross()
chk(f"X자: 8-연결 {betti.b0(xc, 8)} · 4-연결 {betti.b0(xc, 4)} (★달라야 합니다)",
    betti.b0(xc, 8) == 1 and betti.b0(xc, 4) == 21)
try:
    betti.b0(diag, 6); chk("connectivity 6 은 거부한다", False)
except ValueError:
    chk("connectivity 6 은 거부한다", True)
try:
    betti.b0(np.zeros((2, 2, 2), bool)); chk("3D 입력은 거부한다", False)
except ValueError:
    chk("3D 입력은 거부한다", True)

print("\n③ 구멍 수 b1 — ★연결성 이중성(전경 8 ↔ 배경 4)")
chk("빈 마스크 b1 = 0", betti.b1(np.zeros((8, 8), bool)) == 0)
chk("1픽셀 b1 = 0", betti.b1(one) == 0)
chk("★도넛 b1 = 1", betti.b1(donut()) == 1)
chk("구멍 메운 사각형 b1 = 0", betti.b1(donut(hole=False)) == 0)
two = np.zeros((30, 40), bool); two[5:25, 5:35] = True
two[10:20, 10:15] = False; two[10:20, 25:30] = False
chk("구멍 2개 b1 = 2", betti.b1(two) == 2)
ring = diamond_ring()
naive_bg8 = max(betti.label(~np.pad(ring, 1, constant_values=False), 8)[0] - 1, 0)
chk(f"★대각 벽 마름모 고리: b1 = 1 (★배경을 8-연결로 세면 {naive_bg8} 이라는 ★틀린 답)",
    betti.b0(ring, 8) == 1 and betti.b1(ring, 8) == 1 and naive_bg8 == 0)
chk("이어진 획에는 구멍이 없다 b1 = 0", betti.b1(stroke()) == 0)

print("\n④ 오일러 표수 교차 검증 — ★χ = b0 − b1 이 ★독립 계산과 일치하는가")
_shapes = [("빈", np.zeros((8, 8), bool)), ("1픽셀", one), ("획", stroke()),
           ("4토막", stroke(((55, 65), (96, 106), (137, 147)))),
           ("도넛", donut()), ("구멍2", two), ("마름모고리", ring),
           ("X자", x_cross()), ("전면", np.ones((20, 20), bool)),
           ("손금4선", palm4())]
rng = np.random.default_rng(19)
_shapes += [(f"난수{i}", rng.random((40, 40)) < 0.4) for i in range(5)]
bad = [n for n, m in _shapes
       if betti.b0(m, 8) - betti.b1(m, 8) != betti.euler_characteristic(m, 8)]
chk(f"8-연결: 전 {len(_shapes)}개 도형에서 b0 − b1 = χ (불일치 {bad})", not bad)
bad4 = [n for n, m in _shapes
        if betti.b0(m, 4) - betti.b1(m, 4) != betti.euler_characteristic(m, 4)]
chk(f"4-연결(듀얼 배경 8)에서도 일치 (불일치 {bad4})", not bad4)

print("\n⑤ 경계 케이스 — ★죽지 않는가 · 0 나눗셈")
z = np.zeros((8, 8), bool)
e = betti.betti_error(z, z)
chk("빈 pred / 빈 gt 에서 예외 없이 0 오차", e["b0_abs_err"] == 0 and e["betti_abs_err"] == 0)
chk("★GT 가 비어도 0 으로 나누지 않는다 (rel = abs/max(gt,1))",
    np.isfinite(betti.betti_error(one, z)["b0_rel_err"])
    and betti.betti_error(one, z)["b0_rel_err"] == 1.0)
chk("정규화 정의대로: 4조각 vs GT 1조각 → rel = 3.0",
    betti.betti_error(stroke(((55, 65), (96, 106), (137, 147))), stroke())["b0_rel_err"] == 3.0)
chk("1픽셀 pred / 1픽셀 gt 정상 동작", betti.betti_error(one, one)["betti_abs_err"] == 0)
try:
    betti.betti_error(np.zeros((4, 4), bool), np.zeros((5, 5), bool))
    chk("shape 불일치는 거부한다", False)
except ValueError:
    chk("shape 불일치는 거부한다", True)
chk("★부호가 방향을 말한다 (과분할 +, 이어붙임 −)",
    betti.betti_error(stroke(((96, 139),)), stroke())["b0_signed_err"] == 1
    and betti.betti_error(stroke(), stroke(((96, 139),)))["b0_signed_err"] == -1)


# ─────────────────────────────────────────────────────────────────────────────
print("\n⑥ ★★핵심 — clDice 가 못 재는 것을 Betti 가 재는가")
# ─────────────────────────────────────────────────────────────────────────────
GT_S   = stroke()
P_SAME = stroke()
P_BIG  = stroke(((96, 139),))                                  # ★한 곳이 크게 끊김
P_4    = stroke(((55, 65), (96, 106), (137, 147)))             # ★4토막

GT_FULLROW = np.zeros((H, W), bool); GT_FULLROW[29:34, :] = True   # 전폭 획
P_ALL      = np.ones((H, W), bool)                                  # ★「전부 선이다」
GT_PALM    = palm4()
P_ALL128   = np.ones((128, 128), bool)

GT_BROKEN  = stroke(((100, 118),))     # ★GT 가 ★실제로 끊겨 있습니다
P_JOINED   = stroke()                  # ★모델이 ★이어 붙였습니다 (_fallback_line 계열)

GT_DONUT   = donut()
P_FILLED   = donut(hole=False)         # ★구멍을 메웠습니다

CASES = [
    ("완전 동일",                         P_SAME,   GT_S),
    ("★한 곳이 크게 끊김",                 P_BIG,    GT_S),
    ("★4토막으로 끊김",                    P_4,      GT_S),
    ("★「전부 선」· GT=이어진 획 1개",      P_ALL,    GT_FULLROW),
    ("★「전부 선」· GT=손금 4선(조각)",     P_ALL128, GT_PALM),
    ("★끊긴 GT 를 이어 붙임",              P_JOINED, GT_BROKEN),
    ("★도넛 GT 의 구멍을 메움",            P_FILLED, GT_DONUT),
]
print(f"  {'케이스':<26}{'clDice':>8}{'Dice':>8}   {'b0 pred/gt':>11}{'b0오차':>7}"
      f"{'b1 pred/gt':>11}{'b1오차':>7}")
print("  " + "-" * 80)
M = {}
for name, p, g in CASES:
    cd = metrics.cl_dice(p, g); dc = metrics.dice(p, g)
    er = betti.betti_error(p, g)
    M[name] = (cd, dc, er)
    print(f"  {name:<26}{cd:>8.3f}{dc:>8.3f}   "
          f"{er['b0_pred']:>5}/{er['b0_gt']:<5}{er['b0_signed_err']:>+7d}"
          f"{er['b1_pred']:>5}/{er['b1_gt']:<5}{er['b1_signed_err']:>+7d}")
print()

cd_same, _, er_same = M["완전 동일"]
chk(f"완전 동일 → clDice {cd_same:.3f} · Betti 오차 {er_same['betti_abs_err']}",
    round(cd_same, 3) == 1.000 and er_same["betti_abs_err"] == 0)

cd_big, _, er_big = M["★한 곳이 크게 끊김"]
cd_4,   _, er_4   = M["★4토막으로 끊김"]
chk(f"★clDice 가 ★역전한다: 크게끊김 {cd_big:.3f} < 4토막 {cd_4:.3f} "
    f"(★조각이 더 많은 쪽이 더 좋아 보입니다)", cd_big < cd_4)
chk(f"★프로젝트 실측 병리(0.880 vs 0.919)를 합성으로 재현했다 "
    f"[{cd_big:.3f} / {cd_4:.3f}]", round(cd_big, 3) == 0.880 and round(cd_4, 3) == 0.919)
chk(f"★b0 오차는 ★역전하지 않는다: 크게끊김 {er_big['b0_abs_err']} < 4토막 {er_4['b0_abs_err']} "
    f"— ★이것이 이 지표의 존재 이유입니다", er_big["b0_abs_err"] < er_4["b0_abs_err"])
chk("★b0 오차는 ★조각 수를 그대로 센다 (1 / 3)",
    er_big["b0_abs_err"] == 1 and er_4["b0_abs_err"] == 3)

cd_all, dc_all, er_all = M["★「전부 선」· GT=이어진 획 1개"]
chk(f"★「전부 선」인데 clDice = {cd_all:.3f} (Dice 는 {dc_all:.3f}) — ★clDice 병리 재현",
    round(cd_all, 3) == 1.000 and dc_all < cd_all)
chk(f"★★그런데 ★Betti 도 이 경우를 잡지 못한다 (오차 {er_all['betti_abs_err']}) — ★한계입니다. "
    f"과검출을 잡는 것은 ★Dice/IoU 입니다", er_all["betti_abs_err"] == 0)

cd_allp, dc_allp, er_allp = M["★「전부 선」· GT=손금 4선(조각)"]
chk(f"★GT 가 조각나 있으면 「전부 선」은 b0 오차 {er_allp['b0_signed_err']:+d} 로 잡힌다 "
    f"(clDice {cd_allp:.3f} · Dice {dc_allp:.3f})",
    er_allp["b0_signed_err"] == -3)

cd_j, _, er_j = M["★끊긴 GT 를 이어 붙임"]
chk(f"★★이어 붙임: clDice 는 {cd_j:.3f} 로 ★여전히 높은데 b0 오차는 "
    f"{er_j['b0_signed_err']:+d} — ★`_fallback_line` 을 잡는 검사입니다",
    er_j["b0_signed_err"] == -1)
chk("★이어 붙임의 부호가 ★음수다 (과분할과 구분된다)",
    er_j["b0_signed_err"] < 0 and er_4["b0_signed_err"] > 0)

cd_f, _, er_f = M["★도넛 GT 의 구멍을 메움"]
chk(f"★구멍을 메우면 b1 오차 {er_f['b1_signed_err']:+d} 로 잡힌다 (b0 오차는 "
    f"{er_f['b0_signed_err']:+d} 로 ★0)",
    er_f["b1_signed_err"] == -1 and er_f["b0_signed_err"] == 0)

print("\n⑦ 규모 — 256×256 에서 도는가 (★재귀 없이)")
t0 = time.time()
big_full = np.ones((256, 256), bool)
chk("256×256 전면 마스크: b0 = 1 · b1 = 0",
    betti.b0(big_full) == 1 and betti.b1(big_full) == 0)
stripes = np.zeros((256, 256), bool); stripes[::8, :] = True
chk("256×256 줄무늬 32줄: b0 = 32", betti.b0(stripes) == 32)
noise = np.random.default_rng(0).random((256, 256)) < 0.35
nb0, nb1 = betti.b0(noise), betti.b1(noise)
chk(f"256×256 난수 마스크(b0 {nb0} · b1 {nb1})에서도 χ 가 맞는다",
    nb0 - nb1 == betti.euler_characteristic(noise))
el = time.time() - t0
print(f"     ↳ 256×256 4건 총 소요 {el:.2f}s (★참고값 · ★성능 임계가 아닙니다)")
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "betti.py"),
           encoding="utf-8").read()
tree = ast.parse(src)
selfrec = [f.name for f in ast.walk(tree) if isinstance(f, ast.FunctionDef)
           for c in ast.walk(f)
           if isinstance(c, ast.Call) and isinstance(c.func, ast.Name) and c.func.id == f.name]
chk(f"★자기 재귀 호출이 없다 (발견 {sorted(set(selfrec))})", not selfrec)

print("\n⑧ ★betti.py 에 임계가 박혀 있지 않다 (G-7 재발 방지)")
lits = []
for n in ast.walk(tree):
    if isinstance(n, ast.Compare):
        for s in [n.left] + list(n.comparators):
            if isinstance(s, ast.Constant) and isinstance(s.value, (int, float)):
                lits.append(s.value)
chk(f"비교식의 숫자 리터럴이 구조값뿐이다 {sorted(set(lits))} "
    f"(0/1/2=차원·개수 · 3=비트쿼드 전경 픽셀 수 · 4/8=연결성)",
    set(lits) <= {0, 1, 2, 3, 4, 8})
floats = {n.value for n in ast.walk(tree)
          if isinstance(n, ast.Constant) and isinstance(n.value, float)}
chk(f"★float 상수가 하나도 없다 {sorted(floats)}", not floats)
mods = {(n.module or "") for n in ast.walk(tree) if isinstance(n, ast.ImportFrom)} | \
       {a.name for n in ast.walk(tree) if isinstance(n, ast.Import) for a in n.names}
chk(f"numpy 외 의존성이 없다 {sorted(mods)}", mods <= {"numpy"})
_keys = set(betti.betti_error(P_4, GT_S))
chk(f"★반환 dict 에 ★판정 키가 없다 (관측값만 냅니다) {sorted(_keys)}",
    not (_keys & {"pass", "passed", "ok", "verdict", "fail", "grade", "score", "code"}))
chk("★thresholds 를 import 하지 않는다 (합격선을 정하는 파일이 아닙니다)",
    "thresholds" not in mods)
chk("★모듈 전역에 대문자 상수 임계가 없다 (구조 상수 _OFF4/_OFF8 뿐)",
    {n for n in dir(betti) if n.isupper() and not n.startswith("_")} == set())

n_bad = sum(1 for _, o in OK if not o)
print(f"\n{'=' * 58}\n{len(OK) - n_bad}/{len(OK)} 통과" + ("" if n_bad == 0 else f" · ★실패 {n_bad}건"))
sys.exit(1 if n_bad else 0)
