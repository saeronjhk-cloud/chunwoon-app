"""★판정 엔진·임계 레지스트리 자체 검사 (2026-08-28 · ★적대적 감사 반영판)
사용: cd _v785_palm/probe && python3 t_palmtype.py
★전건 통과해야 합니다. ★한 건이라도 실패하면 「임계 없이 판정이 나가는 구멍」이 있는 것입니다.

★★이 검사가 ★보증하지 못하는 것 (정직하게 · 감사 F-8)
   · ★실제 사진·실제 체크포인트로 돌린 적이 없습니다 (합성 마스크만)
   · ★harness.py 게이트 6종은 여기서 검사하지 않습니다 (인수인계 v2 §9 뮤턴트 절차)
   · ★`thresholds.VALUES[...] = 0.3` 같은 ★직접 대입은 막지 못합니다 — 가드레일이지 보안이 아닙니다
   · ★labelaid 가 ★무엇을 그리는지는 검사하지 않습니다 (import 금지만 봅니다)
   · ★제이 눈금값 ↔ 엔진 특징값의 ★좌표계 동일성은 ★미검증입니다 (P-41)
"""
import sys, os, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
# ★확정 파일이 디스크에 남으므로 ★임시 경로를 씁니다 (실제 확정을 건드리지 않습니다)
_TMP = os.path.join(tempfile.mkdtemp(prefix="cwpalm_"), "frozen.json")
os.environ["CW_PALM_THRESHOLDS"] = _TMP

import numpy as np
import thresholds as TH
from thresholds import ThresholdUnset, ThresholdFrozen
import palmroi, palmtype, labelaid

OK = []
def chk(name, cond):
    OK.append((name, bool(cond)))
    print(("  ✅ " if cond else "  ❌ ") + name)


def fake_lm():
    lm = np.zeros((21, 2))
    lm[0]  = (128, 230)   # WRIST
    lm[1]  = ( 78, 205)   # T_CMC
    lm[2]  = ( 58, 175)   # T_MCP
    lm[3]  = ( 40, 150)   # T_IP
    lm[4]  = ( 30, 130)   # T_TIP
    lm[5]  = ( 82,  95)   # I_MCP
    lm[9]  = (122,  88)   # M_MCP
    lm[13] = (158,  95)   # R_MCP
    lm[17] = (188, 112)   # P_MCP
    return lm

def fake_pred(lm):
    """RLC · PTC · DTC · FATE. ★교차부는 비웁니다 — 실제 출력이 파편화된 상태를 본뜬 것입니다."""
    m = np.zeros((256, 256), bool)
    for t in np.linspace(0, 1, 300):
        x = int(70 + 45*np.sin(t*np.pi*0.9)); y = int(120 + 95*t)
        m[y-1:y+2, x-1:x+2] = True
    for x in range(80, 190):
        if not (122 <= x <= 134): m[149:152, x] = True
    for x in range(95, 195):
        if not (122 <= x <= 134): m[114:117, x] = True
    for y in range(122, 200):
        if not (112 <= y <= 119 or 147 <= y <= 154): m[y, 127:130] = True
    return m

FULL = {"ROI_RADIAL_EXTRA": 0.0, "AREA_LO": 1.5, "AREA_HI": 6.0,
        "ASSIGN_HORIZ_DEG": 45, "ASSIGN_DTC_CV": 0.6, "ASSIGN_PTC_CV_LO": 0.3,
        "ASSIGN_RLC_CU": -0.2, "ASSIGN_FATE_CU": 0.2, "ASSIGN_RLC_SPAN": 0.15,
        "T1_GAP": 0.08, "T2_CLOSED": 0.05, "T2_COMMON_LEN": 0.05,
        "T3_ANGLE_DEG": 35, "T3_LEN": 0.25, "T3_CENTER": 0.30,
        "T3_FAINT_RATIO": 0.6, "CONF_MARGIN": 0.01, "CONF_HIGH_MULT": 2.0,
        "MERGE_DIST": 0.10, "MERGE_ANG": 55.0,
        "V3_UMAX_DTC": 0.50, "V3_UMAX_RLC": 0.21,
        "V3_VMAX_MID": 0.64, "V3_VMAX_LOW": 0.24,
        # ★★P-63 — v4 임계를 레지스트리에 등록하면 ★freeze() 가 이 5개도 ★요구합니다.
        #   ★그것이 G-7 의 설계입니다 (전부 한꺼번에 확정). ★아래는 ★합성 테스트값입니다.
        "V4_CU_SPLIT": 0.03, "V4_ANG_RLC": 28.0, "V4_VMAX_MID": 0.71,
        "V4_ANG_DTC": 47.7, "V4_CV_FATE": 0.45}
GOOD_SRC = dict(tier="B", date="2026-01-01", label_manifest="TEST_ONLY_NOT_REAL",
                n_labels=40, n_subjects=20, method="합성 테스트 — ★실제 값 아님")


print("① 임계 레지스트리 — 확정 전")
chk("status 가 미확정을 말한다", "미확정" in TH.status())
try:
    TH.get("T1_GAP"); chk("verdict 모드에서 ThresholdUnset", False)
except ThresholdUnset:
    chk("verdict 모드에서 ThresholdUnset", True)
chk("diagnostic 모드는 2026-08-26 실패치를 준다", TH.get("ASSIGN_DTC_CV", "diagnostic") == 0.62)
chk("AREA_LO/HI 가 레지스트리에 등록돼 있다", {"AREA_LO", "AREA_HI"} <= set(TH.NAMES))

print("\n② G-7 — freeze 게이트")
for bad_v, bad_s, why in [
        (FULL, dict(GOOD_SRC, tier="A"), "Tier-A 거부"),
        (FULL, dict(GOOD_SRC, n_subjects=1), "1명 표본 거부"),
        (FULL, dict(GOOD_SRC, n_subjects="스무명"), "n_subjects 비수치도 G-7 로 거부"),
        (FULL, dict(GOOD_SRC, label_manifest=""), "출처 공란 거부"),
        ({"T1_GAP": 0.1}, GOOD_SRC, "★부분 확정 거부 (영구 잠금 방지)"),
        ({}, GOOD_SRC, "빈 확정 거부")]:
    try:
        TH.freeze(bad_v, bad_s); chk(why, False)
    except ThresholdFrozen:
        chk(why, True)
chk("거부 후에도 여전히 미확정", not TH.is_frozen())
chk("거부는 확정 파일을 만들지 않는다", not os.path.exists(TH.STORE))

print("\n③ 판정 — 임계 확정 전에는 전부 UNCERTAIN")
lm = fake_lm(); pred = fake_pred(lm)
r = palmtype.judge(pred, lm, "Right", area_ok=True, mode="verdict")
chk("★verdict 는 트리를 쓰지 않는다 (G-7)", palmtype.default_rule("verdict") == "v3")
chk("★v3 도 임계 레지스트리를 거친다",
    palmtype.assign_fragments([], mode="verdict", rule="v3")[1].startswith("THRESHOLD_UNSET"))
chk("★dev 는 트리를 쓴다", palmtype.default_rule("dev") == "tree")
chk("조각이 실제로 분리된다 (≥4)", r["n_frags"] >= 4)
chk("배정이 THRESHOLD_UNSET", r["assign_reason"].startswith("THRESHOLD_UNSET"))
for k in ("T1", "T2", "T3"):
    chk(f"{k} 가 -U", r[k]["code"].endswith("-U"))
chk("T3 가 absent 가 아니다", r["T3"]["code"] != "T3-A")

print("\n④ 손 미검출 = 판독 불가")
r0 = palmtype.judge(pred, None, None, area_ok=True)
chk("전 축 UNCERTAIN", all(r0[k]["code"].endswith("-U") for k in ("T1", "T2", "T3")))
chk("사유가 HAND_NOT_DETECTED", r0["T1"]["reason"] == "HAND_NOT_DETECTED")

print("\n⑤ diagnostic 모드 — 반드시 NOT_A_VERDICT 가 붙는다")
rd = palmtype.judge(pred, lm, "Right", area_ok=True, mode="diagnostic")
chk("NOT_A_VERDICT 존재", "NOT_A_VERDICT" in rd)
chk("배정이 실행된다", rd["assign_reason"] == "OK")
chk("배정 결과 합 = 조각 수", rd["groups"] and sum(rd["groups"].values()) == rd["n_frags"])
chk("T1 은 여전히 UNCERTAIN (T1_GAP 은 실패치에 없음)",
    rd["T1"]["code"] == "T1-U" and rd["T1"]["reason"].startswith("THRESHOLD_UNSET"))

print("\n⑥ 「없음」 게이트 · 퇴화 조각")
r1 = palmtype.judge(np.zeros((256, 256), bool), lm, "Right", area_ok=False, mode="diagnostic")
chk("빈 마스크에서 T3 는 absent 가 아니다", r1["T3"]["code"] == "T3-U")
chk("사유가 기록된다", "ABSENT_GATE" in r1["T3"]["reason"] or "THRESHOLD_UNSET" in r1["T3"]["reason"])
spot = np.zeros((256, 256), bool); spot[160, 128] = True          # ★1픽셀 노이즈 (중앙 세로)
rs = palmtype.judge(spot, lm, "Right", area_ok=True, mode="diagnostic")
chk("1픽셀 조각이 퇴화로 잡힌다", rs["n_degenerate"] == 1)
chk("★1픽셀이 FATE 로 배정되지 않는다", rs["groups"]["FATE"] == 0 and rs["groups"]["NONE"] == 1)

print("\n⑦ P-23 ROI 엄지 확장 — ★v1 원본 구현과 대조")
def v1_palm_polygon(lm, grow):                      # ★2026-08-26 palmroi.py v1 원문 재현
    idx = [0, 1, 2, 5, 9, 13, 17]
    poly = lm[idx]; c = poly.mean(0)
    return c + (poly - c)*grow
p_v1 = v1_palm_polygon(lm, 1.12)
p_v2 = palmroi.palm_polygon(lm, grow=1.12, radial_extra=None)
chk("다각형 좌표가 v1 과 완전 동일", np.array_equal(np.asarray(p_v1, float), p_v2))
chk("★래스터 ROI 도 v1 과 완전 동일",
    np.array_equal(palmroi._inside(np.asarray(p_v1, float), 256, 256),
                   palmroi._inside(p_v2, 256, 256)))
u, v, wid, hgt = palmroi.palm_frame(lm)
moved = (palmroi.palm_polygon(lm, 1.12, 0.10) - p_v2) @ (-u)
chk("노쪽 꼭짓점 3개만 · 노쪽 방향으로 · 정확히 0.10×wid",
    int((np.abs(moved) > 1e-9).sum()) == 3 and (moved[np.abs(moved) > 1e-9] > 0).all()
    and np.allclose(moved[np.abs(moved) > 1e-9], 0.10*wid))
grid = [round(0.02*k, 2) for k in range(1, 61)]
hit = [palmroi.thumb_intruded(palmroi.palm_polygon(lm, 1.12, e), lm) for e in grid]
first = next((g for g, h in zip(grid, hit) if h), None)
chk("침입 판정이 단조롭다 (한 번 참이면 계속 참)",
    first is not None and all(hit[grid.index(first):]))
chk(f"과대 확장은 엄지 침입으로 잡힌다 (★이 합성 손의 첫 침입값 = {first})",
    palmroi.thumb_intruded(palmroi.palm_polygon(lm, 1.12, 1.2), lm))
print(f"     ↳ ★참고: 합성 손 기준 첫 침입 {first}. ★실제 손의 안전 상한은 ★미측정입니다(P-42)")

print("\n⑧ labelaid — 자만 그리는가")
import ast
aid = ast.parse(open('labelaid.py', encoding='utf-8').read())
aid_mods = {(n.module or '') for n in ast.walk(aid) if isinstance(n, ast.ImportFrom)} | \
           {a.name for n in ast.walk(aid) if isinstance(n, ast.Import) for a in n.names}
chk(f"모델·판정 모듈을 import 하지 않는다 {sorted(aid_mods)}",
    not ({'unet_np', 'pthread', 'metrics', 'palmtype', 'assign'} & aid_mods))
# ★P-41 해소로 harness 를 쓰게 됐습니다 — ★crop 기하 함수만 쓰는지 ★이름 단위로 검사합니다
aid_h = set()
for n in ast.walk(aid):
    if isinstance(n, ast.ImportFrom) and n.module == 'harness':
        aid_h |= {a.name for a in n.names}
chk(f"harness 에서 ★crop 기하만 가져온다 {sorted(aid_h)}", aid_h <= {'crop_box', 'crop_to_S', 'S'})
chk("★harness 좌표계를 쓴다 (P-41 해소)", {'crop_box', 'crop_to_S'} <= aid_h)
src_aid = open('labelaid.py', encoding='utf-8').read()
chk("★랜드마크를 crop_to_S 결과에서 검출한다",
    'landmarks(np.asarray(crop_to_S' in src_aid.replace(' ', '').replace('\n', '')
    or 'crop_to_S(im,cb)' in src_aid.replace(' ', ''))
prov = {0.18, 0.25, 0.30, 0.62, 0.35}      # ★잠정 임계값들
chk(f"★U 눈금이 잠정 임계와 겹치지 않는다 {labelaid.U_TICKS}",
    not (set(labelaid.U_TICKS) & {0.18, 0.30, 0.62}))
chk(f"★V 눈금이 잠정 임계와 겹치지 않는다 {labelaid.V_TICKS}",
    not (set(labelaid.V_TICKS) & {0.25, 0.30, 0.62}))
chk("★ROI 다각형을 그리지 않는다 (결정 경계 비노출)",
    'palm_polygon' not in open('labelaid.py', encoding='utf-8').read())
try:
    labelaid.render('x.jpg', '.'); chk("render() 도 저장소 가드를 건다", False)
except labelaid.OutsideRepoRequired:
    chk("render() 도 저장소 가드를 건다", True)
except Exception:
    chk("render() 도 저장소 가드를 건다", False)

print("\n⑨ ★판정 코드에 임계 상수가 ★박혀 있지 않다 (2026-08-26 재발 방지)")
src = open('palmtype.py', encoding='utf-8').read()
tree = ast.parse(src)
lits = []
for n in ast.walk(tree):                      # ★비교식의 숫자 리터럴 = 사실상 임계
    if isinstance(n, ast.Compare):
        for side_ in [n.left] + list(n.comparators):
            if isinstance(side_, ast.Constant) and isinstance(side_.value, (int, float)):
                lits.append(side_.value)
EPS = {1e-6, 1e-9, 1e-12}   # ★0 나눗셈 방지 — ★임계가 아닙니다
chk(f"비교식의 숫자 리터럴이 구조값·엡실론뿐이다 {sorted(set(lits))}", set(lits) <= {0, 1, 2} | EPS)
floats = {n.value for n in ast.walk(tree)
          if isinstance(n, ast.Constant) and isinstance(n.value, float)}
chk(f"float 상수가 구조값·엡실론뿐이다 {sorted(floats)}", floats <= {0.0, 1.0} | EPS)
used = {n.args[0].value for n in ast.walk(tree)
        if isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute)
        and n.func.attr == 'get' and n.args and isinstance(n.args[0], ast.Constant)}
need = {k for k in TH.NAMES if k.startswith(('ASSIGN_', 'T1_', 'T2_', 'T3_', 'CONF_'))}
chk(f"모든 배정·유형·신뢰도 임계를 레지스트리에서 받는다 (누락 {sorted(need-used)})", need <= used)

print("\n⑩ freeze 정상 경로 · 재확정 거부 · ★프로세스 재시작 후에도 거부")
TH.freeze(FULL, GOOD_SRC)
chk("확정 후 verdict 모드가 동작", palmtype.judge(pred, lm, "Right", True)["assign_reason"] == "OK")
chk("확정 파일이 생성된다", os.path.exists(TH.STORE))
try:
    TH.freeze(FULL, GOOD_SRC); chk("재확정 거부", False)
except ThresholdFrozen:
    chk("재확정 거부 (ADR 필요)", True)
import subprocess
p = subprocess.run([sys.executable, "-c",
                    "import sys;sys.path.insert(0,'.');import thresholds as T;"
                    "print('FROZEN' if T.is_frozen() else 'NOT')"],
                   capture_output=True, text=True, env=dict(os.environ),
                   cwd=os.path.dirname(os.path.abspath(__file__)))
chk("★새 프로세스에서도 확정 상태가 유지된다 (B-1)", "FROZEN" in p.stdout)

print("\n⑪ ★harness 통합 (P-45) — 게이트를 우회하는 경로가 없는가")
h = ast.parse(open('harness.py', encoding='utf-8').read())
h_mods = {(n.module or '') for n in ast.walk(h) if isinstance(n, ast.ImportFrom)} | \
         {a.name for n in ast.walk(h) if isinstance(n, ast.Import) for a in n.names}
chk("harness 가 palmtype·thresholds 를 쓴다", {'palmtype', 'thresholds'} <= h_mods)
fns = {n.name: n for n in ast.walk(h) if isinstance(n, ast.FunctionDef)}
chk("run() 이 mode 를 받는다", 'mode' in [a.arg for a in fns['run'].args.args])
chk("report() 가 mode 를 받는다", 'mode' in [a.arg for a in fns['report'].args.args])
chk("infer() 가 lm 을 반환한다 (4-tuple)",
    any(isinstance(n, ast.Return) and isinstance(n.value, ast.Tuple) and len(n.value.elts) == 4
        for n in ast.walk(fns['infer'])))
src_h = open('harness.py', encoding='utf-8').read()
chk("판정 엔진 호출이 gate_checks 뒤에 있다 (run 안)", src_h.index('gate_checks') < src_h.index('palmtype.judge'))
d = ast.parse(open('p23_diag.py', encoding='utf-8').read())
d_names = {n.name for n in ast.walk(d) if isinstance(n, ast.ImportFrom) for n in n.names}
chk("p23_diag 가 harness 게이트를 재사용한다",
    {'detect_tier', 'gate_checks'} <= d_names)
chk("p23_diag 가 임계를 파일에 쓰지 않는다",
    'freeze' not in open('p23_diag.py', encoding='utf-8').read())


# ─────────────────────────────────────────────────────────────────────────────
print("\n⑨ ★★ADR-003 — closed crease 가드 (P-61 · P-64)")
# ★★임계를 쓰지 않는 가드입니다. ★T2_CLOSED 가 있어도 ★CLOSED 조각이 있으면 먼저 막습니다.
TH.set_dev(**FULL)
_f = [dict(pix=np.array([[0.0, 0.0], [1.0, 1.0]]), wid=100.0, hgt=100.0, degenerate=False)]

chk("★CLOSED 가 groups 키에 있다", palmtype.CLOSED in palmtype.GROUP_KEYS)
chk("★CLOSED 는 배정 클래스가 아니다 (LINES 밖)", palmtype.CLOSED not in palmtype.LINES)
# ★★이것이 핵심입니다 — tree.CLASSES 가 넓어지면 ourtree.OK 가 따라 넓어져 212 가 213 이 됩니다
import tree as _tree
chk("★★tree.CLASSES 에 CLOSED 가 들어가지 않았다 (212 불변 보호)",
    palmtype.CLOSED not in _tree.CLASSES)

_g = {k: [] for k in palmtype.GROUP_KEYS}
_g["RLC"], _g["PTC"] = [0], [0]
_t2_no = palmtype.judge_T2(_f, _g, mode="dev")
_g[palmtype.CLOSED] = [0]
_t2_yes = palmtype.judge_T2(_f, _g, mode="dev")
chk("★CLOSED 조각이 있으면 T2 는 UNCERTAIN", _t2_yes["code"] == "T2-U")
chk("★사유가 CLOSED_FRAGMENT_UNMEASURED", _t2_yes["reason"] == "CLOSED_FRAGMENT_UNMEASURED")
chk("★가드는 RLC/PTC 검사보다 먼저 걸린다", _t2_no["reason"] != "CLOSED_FRAGMENT_UNMEASURED")
chk("★★CLOSED 가 비어 있으면 가드가 발화하지 않는다 (현행 회귀 보호)",
    palmtype.judge_T2(_f, {k: ([0] if k in ("RLC", "PTC") else [])
                           for k in palmtype.GROUP_KEYS}, mode="dev")["reason"]
    != "CLOSED_FRAGMENT_UNMEASURED")
# ★★G-6 — 가드 사유가 판정 어휘 금칙어를 건드리지 않아야 리포트가 죽지 않습니다
from harness import BANNED
chk("★사유 문자열이 G-6 금칙어를 포함하지 않는다",
    not any(b in "CLOSED_FRAGMENT_UNMEASURED" for b in BANNED))
# ★현재는 어떤 규칙도 CLOSED 를 내지 않습니다 — 냈다면 학습 집합이 바뀐 것입니다
_gr, _ = palmtype.assign_fragments(
    [palmtype.frag_features(p, lm) for _, p in palmtype.components(pred)], "dev", "v3")
chk("★어떤 규칙도 아직 CLOSED 를 내지 않는다", _gr is not None and not _gr[palmtype.CLOSED])

# ─────────────────────────────────────────────────────────────────────────────
print("\n⑩ ★★P-63 — 배정 규칙 v4 (우리 도메인 축)")
chk("★v4 가 임계 레지스트리를 거친다 (G-7)",
    {"V4_CU_SPLIT", "V4_ANG_RLC", "V4_VMAX_MID", "V4_ANG_DTC", "V4_CV_FATE"} <= set(TH.NAMES))
_fv = [palmtype.frag_features(p, lm) for _, p in palmtype.components(pred)]
_g4, _w4 = palmtype.assign_fragments(_fv, "dev", "v4")
chk("★dev 에서 v4 가 배정을 낸다", _g4 is not None and _w4 == "OK")
chk("★v4 배정 합 = 조각 수", _g4 and sum(len(v) for v in _g4.values()) == len(_fv))
chk("★v4 도 CLOSED 를 내지 않는다", _g4 is not None and not _g4[palmtype.CLOSED])
TH.clear_dev()
# ★★v4 임계는 ★2026-08-26 실패치에 ★없습니다 (그때 존재하지 않던 규칙입니다).
#   ⟹ ★diagnostic 모드에서 ★fail-closed 여야 합니다. ★추측해서 채우면 안 됩니다.
_g4d, _w4d = palmtype.assign_fragments(_fv, "diagnostic", "v4")
chk("★★diagnostic 에서 v4 는 임계가 없어 배정하지 않는다 (fail-closed)",
    _g4d is None and _w4d.startswith("THRESHOLD_UNSET"))
# ★freeze 된 뒤에는 ★레지스트리를 통해 값을 받습니다 — ★트리처럼 우회하지 않습니다
chk("★freeze 후 verdict 에서 v4 가 레지스트리로 값을 받는다",
    palmtype.assign_fragments(_fv, "verdict", "v4")[1] == "OK")
# ★★v4 는 ★1명 2손 표본입니다 — ★verdict 기본값이 되면 안 됩니다 (P-57)
chk("★★verdict 기본 규칙은 여전히 v3 이다 (v4 무단 승격 방지)",
    palmtype.default_rule("verdict") == "v3")

os.remove(TH.STORE)
n_bad = sum(1 for _, o in OK if not o)
print(f"\n{'='*58}\n{len(OK)-n_bad}/{len(OK)} 통과" + ("" if n_bad == 0 else f" · ★실패 {n_bad}건"))
sys.exit(1 if n_bad else 0)
