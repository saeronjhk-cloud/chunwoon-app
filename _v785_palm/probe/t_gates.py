#!/usr/bin/env python3
"""★★게이트 뮤턴트 검사 (P-47 · 2026-08-28) — `harness.py` 의 티어 격리 게이트 G-1~G-6.

사용: cd _v785_palm/probe && python3 t_gates.py

★★무엇을 하는가
   게이트가 ★「막아야 하는 상황」을 인위적으로 만들어(뮤턴트) ★실제로 GateFail 이 나는지 봅니다.
   ★그리고 ★「막으면 안 되는 상황」(정상 Tier-A · 정상 Tier-B)이 ★통과하는지도 봅니다 —
   ★아무거나 다 막는 게이트는 게이트가 아니라 고장입니다.

★★설계 (★체크포인트가 없어도 돌아갑니다)
   게이트는 ★추론 이전 단계입니다. 그래서 `run()` 전체를 돌리지 않고
   `detect_tier` · `gate_checks` · `report` 를 ★직접 부릅니다.
   ★단 하나 「한 실행에 두 티어」(G-1 후반부)만은 검사가 `run()` ★안에 있으므로,
   ★그것을 여기서 재구현하지 않고 ★없는 체크포인트로 `run()` 을 불러 확인합니다.
   (그 결과가 ★「게이트가 체크포인트 로드보다 먼저」라는 증거도 됩니다 — ⑦ 참조)

★★실데이터 미접촉
   모든 픽스처는 `tempfile.mkdtemp()` 아래에만 만듭니다.
   이미지는 ★8×8 합성 PNG/JPG 이며 ★실제 손바닥 사진을 ★한 장도 복사하지 않습니다.

★★뮤턴트 번호에 관하여 (★정직하게)
   설계 문서(§3-2)에는 ★네 종(M-A·B·C·D)만 적혀 있고, 인수인계 기록에 M-F·M-G 가 더 있습니다.
   ★「10종 전건 KILL」이라는 서술이 문서에 남아 있으나 ★재현 가능한 기록은 위 여섯뿐이고
   ★나머지 넷의 ★내용은 어디에도 없습니다. ⟹ ★그 숫자를 되살리지 않습니다.
   ★M-E 는 결번으로 둡니다 (내용 미확인 · 이름을 재사용하면 없던 기록을 지어내는 셈입니다).
   ★아래 M-H 이후는 ★이번에 새로 설계한 것이며, 「문서에 있던 것」이 아닙니다.

★★이 검사가 ★보증하지 못하는 것 (정직하게)
   · ★실제 사진·실제 체크포인트로 돌린 적이 없습니다 (합성 픽스처만).
   · ★추론 이후 단계(`infer`·`load_gt`·판정 엔진)는 ★검사하지 않습니다 — `t_palmtype.py` 소관입니다.
   · ★G-2 는 「리포트 파일명·접두사 강제」만 봅니다. ★그 리포트를 ★읽는 사람이
     경고를 무시하는 것은 ★코드가 막을 수 없습니다.
   · ★게이트를 ★부르지 않고 `infer()` 만 직접 import 해서 쓰는 경로는 ★막지 못합니다
     (가드레일이지 보안 경계가 아닙니다 — thresholds.py 서문과 같은 성질입니다).
   · ★`intake.py` 를 거치면 여기서 「막지 못함」으로 기록된 것 중 일부(동의 증빙 부재 등)가
     ★수집 단계에서 걸립니다. ★그러나 폴더를 손으로 만들면 그 경로를 건너뜁니다 —
     ★아래 결함 목록은 ★「하네스 게이트 자체」의 능력만 말합니다.
   · ★파일 권한·심볼릭 링크·동시 실행 경합은 ★미검사입니다.
"""
import sys, os, csv, glob, json, shutil, tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
# ★임계 확정 파일을 ★건드리지 않기 위해 임시 경로로 돌립니다 (게이트는 임계를 쓰지 않습니다)
_TMPTH = os.path.join(tempfile.mkdtemp(prefix="cwgate_th_"), "frozen.json")
os.environ["CW_PALM_THRESHOLDS"] = _TMPTH

from PIL import Image
import harness
from harness import GateFail

BASE = tempfile.mkdtemp(prefix="cwgate_")          # ★모든 픽스처는 여기 아래에만 만듭니다
NO_CKPT = os.path.join(BASE, "없는_체크포인트.pth")  # ★일부러 존재하지 않습니다

OK = []
DEFECTS = []        # ★게이트가 막지 못하는 것으로 ★확인된 항목
NOTES = []          # ★결함은 아니나 기록해 둘 현재 동작


def chk(name, cond):
    OK.append((name, bool(cond)))
    print(("  ✅ " if cond else "  ❌ ") + name)


# ──────────────────────────────────────────────────────────────────────
# 픽스처 (★합성 · 실데이터 미접촉)
# ──────────────────────────────────────────────────────────────────────
MAN_COLS = ['file', 'source', 'source_url', 'license', 'license_url',
            'commercial_ok', 'retrieved_at', 'note_risk']       # 설계 문서 §3-3
META_COLS = ['file', 'subject', 'hand', 'consent', 'captured_at']


def tiny(p):
    """★8×8 합성 이미지 — ★실제 손바닥 사진이 아닙니다."""
    os.makedirs(os.path.dirname(p), exist_ok=True)
    Image.new('RGB', (8, 8), (180, 150, 140)).save(p)


def wcsv(path, cols, rows):
    with open(path, 'w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction='ignore')
        w.writeheader()
        for r in rows:
            w.writerow(r)


def man_row(f='a0.jpg', **kw):
    r = dict(file=f, source='roboflow_palmlinesdetection',
             source_url='https://example.invalid/dataset', license='CC-BY-4.0',
             license_url='https://example.invalid/license', commercial_ok='Y',
             retrieved_at='2026-08-24', note_risk='')
    r.update(kw)
    return r


def meta_row(f='b0.jpg', i=1, **kw):
    r = dict(file=f, subject=f'S{i:03d}', hand='R', consent='Y', captured_at='2026-08-27')
    r.update(kw)
    return r


def root(tag):
    p = os.path.join(BASE, tag)
    os.makedirs(p, exist_ok=True)
    return p


def seed_A(tag, n=1, marker='.TIER_A'):
    """★정상 Tier-A(연막 시험) 폴더 한 벌."""
    r = root(tag)
    if marker:
        open(os.path.join(r, marker), 'w').close()
    rows = []
    for i in range(n):
        f = f'a{i}.jpg'
        tiny(os.path.join(r, 'images', f))
        rows.append(man_row(f))
    wcsv(os.path.join(r, 'MANIFEST.csv'), MAN_COLS, rows)
    return r


def seed_B(tag, n=1, consent='Y', marker='.TIER_B'):
    """★정상 Tier-B(판정) 폴더 한 벌."""
    r = root(tag)
    if marker:
        open(os.path.join(r, marker), 'w').close()
    rows = []
    for i in range(n):
        f = f'b{i}.jpg'
        tiny(os.path.join(r, 'images', f))
        rows.append(meta_row(f, i + 1, consent=consent))
    wcsv(os.path.join(r, 'meta.csv'), META_COLS, rows)
    return r


# ──────────────────────────────────────────────────────────────────────
# 게이트 호출기
# ──────────────────────────────────────────────────────────────────────
def gates(r):
    """★harness 의 게이트만 직접 호출합니다 (추론 전 단계 · 체크포인트 불필요).
    반환: None = 통과 / 문자열 = GateFail 사유."""
    try:
        t = harness.detect_tier(r)          # G-1 (마커)
        harness.gate_checks(r, t)           # G-3 · G-4 · G-5
        return None
    except GateFail as e:
        return str(e)


def run_stage(roots):
    """`run()` 을 ★없는 체크포인트로 부릅니다.
    반환: ('GATE', 사유) = 게이트가 막음 / ('CKPT', …) = 게이트를 지나 체크포인트 단계까지 감."""
    try:
        harness.run(roots, NO_CKPT)
        return ('완주', '')                                   # ★도달할 수 없어야 합니다
    except GateFail as e:
        return ('GATE', str(e))
    except FileNotFoundError as e:
        return ('CKPT', str(e))
    except Exception as e:                                    # noqa: BLE001
        return (type(e).__name__, str(e))


def kill(mid, want, desc, r):
    """★뮤턴트가 ★막혀야 한다."""
    msg = gates(r)
    ok = msg is not None and msg.startswith(want + ':')
    chk(f"{mid} {desc} → {want} 차단" + (f"  ⟨{msg}⟩" if msg else "  ⟨★막지 못했습니다⟩"), ok)
    return ok


def survive(mid, desc, r):
    """★정상 상황은 ★통과해야 한다 (위음성 검사)."""
    msg = gates(r)
    chk(f"{mid} {desc} → 통과해야 함" + (f"  ⟨★막혔습니다: {msg}⟩" if msg else ""), msg is None)
    return msg is None


def hole(did, mid, want, desc, r, why, extra_true=True):
    """★막아야 마땅한데 ★현재 막지 못하는 것. ★현재 동작을 사실대로 적습니다.
    ★게이트가 고쳐지면 이 검사는 ❌ 가 됩니다 — 그때 kill() 로 승격하십시오."""
    msg = gates(r)
    now_open = (msg is None) and bool(extra_true)
    chk(f"{did} {mid} {desc} → ★현재 막지 못함 ({want} 무반응)"
        + (f"  ⟨★이제 막힙니다: {msg} — 이 검사를 kill() 로 승격하십시오⟩" if msg else ""),
        now_open)
    if now_open:
        DEFECTS.append((did, mid, want, desc, why))
    return now_open


def rows_ok(**kw):
    """report() 가 받는 행 한 줄 (★상태 ok)."""
    r = dict(file='a0.jpg', area=3.0, area_ok=True, status='ok', hand='Right',
             T1='T1-U', T2='T2-U', T3='T3-U', n_frags=4, n_degenerate=0,
             groups=dict(RLC=1, PTC=1, DTC=1, FATE=1, NONE=0),
             judge_reason='THRESHOLD_UNSET', T1_why='', T2_why='', T3_why='')
    r.update(kw)
    return r


def rep(tag, tier, rows, mode='verdict'):
    """report() 호출. 반환: (GateFail 사유 or None, txt, path, outdir)"""
    out = os.path.join(BASE, 'out_' + tag)
    try:
        txt, path = harness.report(tier, rows, out, mode)
        return None, txt, path, out
    except GateFail as e:
        return str(e), None, None, out


# ══════════════════════════════════════════════════════════════════════
print("① ★문서에 기록된 뮤턴트 6종 (M-A·B·C·D·F·G) — 전건 KILL 이어야 합니다")

# M-A : Tier-A 에 consent/ 폴더
r = seed_A('MA')
os.makedirs(os.path.join(r, 'consent'))
kill("M-A", "G-3", "Tier-A 에 consent/ 폴더", r)

# M-B : MANIFEST 의 license 를 비움
r = seed_A('MB')
wcsv(os.path.join(r, 'MANIFEST.csv'), MAN_COLS, [man_row('a0.jpg', license='')])
kill("M-B", "G-5", "MANIFEST.csv 의 license 공란", r)

# M-C : Tier-A 리포트에 「합격」 (파일명으로 새어 들어오는 경로)
msg, txt, path, out = rep('MC', 'A', [rows_ok(file='합격.jpg', status='과검출', area=9.9)])
chk("M-C Tier-A 리포트 본문의 '합격' → G-6 차단"
    + (f"  ⟨{msg}⟩" if msg else "  ⟨★막지 못했습니다⟩"),
    msg is not None and msg.startswith('G-6:'))
chk("M-C ★차단 시 리포트 파일을 ★남기지 않는다 (fail-closed)", not os.path.exists(out))

# M-D : 한 실행에 Tier-A 와 Tier-B 를 동시에 (★검사가 run() 안에 있으므로 run() 으로 확인)
rA, rB = seed_A('MD_A'), seed_B('MD_B')
st, why = run_stage([rA, rB])
chk(f"M-D 한 실행에 두 티어 → G-1 차단  ⟨{st}: {why[:70]}⟩",
    st == 'GATE' and why.startswith('G-1:'))

# M-F : Tier-B meta.csv 에 consent=N
r = seed_B('MF', consent='N')
kill("M-F", "G-4", "Tier-B meta.csv 에 consent=N 인 행", r)

# M-G : 한 폴더에 .TIER_A 와 .TIER_B 동시
r = seed_A('MG')
open(os.path.join(r, '.TIER_B'), 'w').close()
kill("M-G", "G-1", "한 폴더에 .TIER_A · .TIER_B 동시", r)

print("     ↳ ★M-E 는 ★결번입니다 — 내용이 어느 기록에도 없어 재현할 수 없습니다.")

# ══════════════════════════════════════════════════════════════════════
print("\n② ★새로 설계한 뮤턴트 — G-1 (티어 판별)")

r = seed_A('MH', marker=None)                    # 마커를 아예 만들지 않음
kill("M-H", "G-1", "티어 마커가 하나도 없는 폴더", r)

kill("M-I0", "G-1", "존재하지 않는 경로", os.path.join(BASE, '없는폴더'))

r = root('MG2'); os.makedirs(os.path.join(r, '.TIER_A'), exist_ok=True)
os.makedirs(os.path.join(r, '.TIER_B'), exist_ok=True)
kill("M-G2", "G-1", "마커가 ★디렉터리 형태여도 동시 존재는 잡힌다", r)

# ══════════════════════════════════════════════════════════════════════
print("\n③ ★새로 설계한 뮤턴트 — G-5 (Tier-A 출처·라이선스)")

r = seed_A('MI'); os.remove(os.path.join(r, 'MANIFEST.csv'))
kill("M-I", "G-5", "Tier-A 에 MANIFEST.csv 가 없음", r)

for mid, val, desc in [("M-J", 'N', "commercial_ok=N"),
                       ("M-K", 'UNKNOWN', "commercial_ok=UNKNOWN"),
                       ("M-L", '', "commercial_ok 공란"),
                       ("M-L2", 'y', "commercial_ok=y (소문자)")]:
    r = seed_A('%s' % mid.replace('-', ''))
    wcsv(os.path.join(r, 'MANIFEST.csv'), MAN_COLS, [man_row(commercial_ok=val)])
    if mid == "M-L2":
        # ★소문자 y 는 .upper() 로 정규화되어 ★통과합니다 (아래 ⑥ 에 현재 동작으로 기록)
        continue
    kill(mid, "G-5", desc, r)

r = seed_A('MM')
wcsv(os.path.join(r, 'MANIFEST.csv'), MAN_COLS,
     [man_row(source='roboflow_palmlinesdetection', source_url='')])
kill("M-M", "G-5", "source_url 공란 · source 가 self_capture 가 아님", r)

r = seed_A('MAG')
wcsv(os.path.join(r, 'MANIFEST.csv'), [c for c in MAN_COLS if c != 'license'],
     [man_row()])
kill("M-AG", "G-5", "MANIFEST 에 license 열 ★자체가 없음", r)

r = seed_A('MAG2')
wcsv(os.path.join(r, 'MANIFEST.csv'), MAN_COLS,
     [man_row('a0.jpg'), man_row('a1.jpg', license='')])   # ★둘째 행만 위반
kill("M-AG2", "G-5", "MANIFEST 2행 중 ★뒤 행만 위반 (전 행을 본다)", r)

# ══════════════════════════════════════════════════════════════════════
print("\n④ ★새로 설계한 뮤턴트 — G-3 (Tier-A 동의 흔적) · G-4 (Tier-B 동의)")

r = seed_A('MO')
wcsv(os.path.join(r, 'meta.csv'), META_COLS, [meta_row('a0.jpg')])
kill("M-O", "G-3", "Tier-A 의 meta.csv 에 consent 열", r)

r = seed_B('MP'); os.remove(os.path.join(r, 'meta.csv'))
kill("M-P", "G-4", "Tier-B 에 meta.csv 가 없음", r)

kill("M-Q", "G-4", "Tier-B consent 공란", seed_B('MQ', consent=''))
kill("M-R", "G-4", "Tier-B consent='Yes' (Y·SELF 가 아님)", seed_B('MR', consent='Yes'))
kill("M-R2", "G-4", "Tier-B consent='보류'", seed_B('MR2', consent='보류'))

r = seed_B('MAH')
wcsv(os.path.join(r, 'meta.csv'), [c for c in META_COLS if c != 'consent'],
     [meta_row('b0.jpg')])
kill("M-AH", "G-4", "Tier-B meta 에 consent 열 ★자체가 없음", r)

r = seed_B('MAH2', n=2)
wcsv(os.path.join(r, 'meta.csv'), META_COLS,
     [meta_row('b0.jpg', 1), meta_row('b1.jpg', 2, consent='N')])
kill("M-AH2", "G-4", "여러 행 중 ★한 행만 consent=N", r)

# ══════════════════════════════════════════════════════════════════════
print("\n⑤ ★위음성 검사 — 정상은 ★통과해야 합니다 (다 막는 게이트는 고장입니다)")

survive("M-AE", "정상 Tier-A 폴더", seed_A('MAE', n=3))
survive("M-AF", "정상 Tier-B 폴더", seed_B('MAF', n=3))

r = seed_A('MN')
wcsv(os.path.join(r, 'MANIFEST.csv'), MAN_COLS,
     [man_row(source='self_capture', source_url='')])
survive("M-N", "self_capture 는 source_url 없이도 (문서 §3-3 예외)", r)

survive("M-S", "Tier-B consent=SELF", seed_B('MS', consent='SELF'))

r = seed_A('MAE2')
os.makedirs(os.path.join(r, 'masks'))
tiny(os.path.join(r, 'masks', 'a0_mask.png'))
survive("M-AE2", "Tier-A 에 masks/ 가 있어도", r)

# ★Tier-B 리포트는 「합격」을 써도 됩니다 — G-6 은 ★Tier-A 전용입니다
msg, txt, path, out = rep('BOK', 'B', [rows_ok(file='합격.jpg', status='과검출', area=9.9)])
chk("Tier-B 리포트의 '합격' 은 막지 않는다 (G-6 은 Tier-A 전용)", msg is None)
chk("Tier-B 리포트 파일명이 report_verdict.json",
    path is not None and os.path.basename(path) == 'report_verdict.json')

# ══════════════════════════════════════════════════════════════════════
print("\n⑥ ★현재 동작 기록 — consent 값의 정규화 (`.strip().upper()`)")
# ★판단: harness 는 `(r.get('consent') or '').strip().upper()` 로 ★정규화한 뒤 비교합니다.
#   ⟹ 소문자 y · 앞뒤 공백은 ★통과합니다. ★이것은 「막아야 할 우회」가 아니라
#      ★의도된 정규화로 판단했습니다 (여전히 ★긍정 토큰을 요구합니다).
#   ★다만 설계 문서 §3-2 는 `consent != Y` 라고만 적혀 있어 ★문구가 코드보다 좁습니다 —
#      ★문서 쪽을 코드에 맞춰 정정하시는 편이 맞습니다. ★여기서는 현재 동작을 사실대로 적습니다.
for mid, val, desc in [("M-T", 'y', "consent='y' (소문자)"),
                       ("M-U", ' Y ', "consent=' Y ' (앞뒤 공백)"),
                       ("M-U2", 'self', "consent='self' (소문자)")]:
    okp = survive(mid, f"{desc} → 정규화되어", seed_B(mid.replace('-', ''), consent=val))
    if okp:
        NOTES.append((mid, f"{desc} 는 strip+upper 정규화로 ★통과합니다 (결함 아님으로 판단 · 문서 문구는 정정 필요)"))

r = seed_A('ML2')
wcsv(os.path.join(r, 'MANIFEST.csv'), MAN_COLS, [man_row(commercial_ok='y')])
if survive("M-L2", "commercial_ok='y' (소문자) → 정규화되어", r):
    NOTES.append(("M-L2", "commercial_ok 도 같은 정규화로 소문자 y 를 ★받습니다"))

# ══════════════════════════════════════════════════════════════════════
print("\n⑦ ★게이트가 ★추론보다 먼저인가 (체크포인트 없이 확인)")
st, why = run_stage([seed_A('ORD_A')])
chk(f"정상 Tier-A 는 게이트를 ★지나 체크포인트 단계까지 간다  ⟨{st}⟩", st == 'CKPT')
st, why = run_stage([seed_B('ORD_B', consent='N')])
chk(f"동의 위반은 ★체크포인트를 읽기 전에 막힌다  ⟨{st}: {why[:50]}⟩",
    st == 'GATE' and why.startswith('G-4:'))
st, why = run_stage([seed_A('ORD_C', marker=None)])
chk(f"마커 없음도 ★체크포인트를 읽기 전에 막힌다  ⟨{st}⟩", st == 'GATE' and why.startswith('G-1:'))

# ══════════════════════════════════════════════════════════════════════
print("\n⑧ ★G-2 — Tier-A 리포트 강제 (중단이 아니라 ★강제)")
msg, txt, path, out = rep('G2A', 'A', [rows_ok()])
chk("G-2 Tier-A 리포트 파일명이 강제된다",
    msg is None and os.path.basename(path) == 'report_TIERA_NOT_FOR_VERDICT.json')
if txt:
    num_lines = [l for l in txt.split('\n')
                 if ('이미지 ' in l or '면적' in l or l.startswith(('T1', 'T2', 'T3', '[TIER-A] T')))]
    chk(f"G-2 수치 줄 {len(num_lines)}개가 전부 [TIER-A] 접두사를 단다",
        bool(num_lines) and all(l.startswith('[TIER-A] ') for l in num_lines))
    chk("G-2 Tier-A 리포트에 「판정에 사용할 수 없습니다」 경고가 있다",
        '판정에 사용할 수 없습니다' in txt)
    chk("G-2 리포트 JSON 에 tier='A' 가 기록된다",
        json.load(open(path, encoding='utf-8'))['tier'] == 'A')

# ══════════════════════════════════════════════════════════════════════
print("\n⑨ ★★2026-08-28 에 고친 결함 10건 — ★이제 막히는지 확인합니다 (kill 로 ★승격됨)")
print("   ★이 검사들은 원래 「현재 막지 못함」으로 기록돼 있었습니다.")
print("   ★harness 게이트를 고친 뒤 ★전건 승격했습니다. ★다시 ❌ 가 되면 ★퇴행입니다.\n")

# D-1 : consent 열이 있는데 데이터 행이 0 → ★열 이름(fieldnames)으로 봐야 합니다
r = seed_A('DV')
wcsv(os.path.join(r, 'meta.csv'), META_COLS, [])          # 헤더만
kill("D-1 M-V", "G-3", "Tier-A meta.csv 에 consent 열 + ★데이터 0행", r)

# D-2 : MANIFEST 0행 → 검사가 한 번도 돌지 않는 우회
r = seed_A('DW', n=2)
wcsv(os.path.join(r, 'MANIFEST.csv'), MAN_COLS, [])       # 헤더만 · 이미지는 2장
kill("D-2 M-W", "G-5", "Tier-A MANIFEST.csv 가 ★0행 (이미지는 2장)", r)

# D-3 : Tier-B meta 0행 → 동의 기록 0건
r = seed_B('DX', n=2)
wcsv(os.path.join(r, 'meta.csv'), META_COLS, [])          # 헤더만 · 사진은 2장
kill("D-3 M-X", "G-4", "Tier-B meta.csv 가 ★0행 (사진은 2장)", r)

# D-4 : 동의 열 이름 변형 → ★부분 일치로 봐야 합니다
r = seed_A('DY')
wcsv(os.path.join(r, 'meta.csv'), ['file', 'CONSENT', 'consent_date', 'consent_form'],
     [{'file': 'a0.jpg', 'CONSENT': 'Y', 'consent_date': '2026-08-27', 'consent_form': 'c001.pdf'}])
kill("D-4 M-Y", "G-3", "Tier-A meta 의 동의 열 이름이 CONSENT·consent_date·consent_form", r)

# D-5 : MANIFEST 미등재 이미지 → ★출처를 모르는 파일은 자격이 없습니다
r = seed_A('DZ')                                          # MANIFEST 에는 a0.jpg 만
tiny(os.path.join(r, 'images', '미등재.jpg'))
imgs = sorted(glob.glob(os.path.join(r, '**', '*.jpg'), recursive=True))   # ★run() 의 수집식과 동일
chk(f"D-5 전제: 수집 {len(imgs)}장 vs MANIFEST 1행", len(imgs) == 2)
kill("D-5 M-Z", "G-5", "MANIFEST 미등재 이미지", r)

# D-6 : Tier-B meta 미등재 사진 → ★동의 없는 사진이 판정에 들어가는 것을 막습니다
r = seed_B('DAA')                                         # meta 에는 b0.jpg 만
tiny(os.path.join(r, 'images', '동의미확인.jpg'))
imgs = sorted(glob.glob(os.path.join(r, '**', '*.jpg'), recursive=True))
chk(f"D-6 전제: 수집 {len(imgs)}장 vs meta 1행", len(imgs) == 2)
kill("D-6 M-AA", "G-4", "★Tier-B meta 미등재 사진 (가장 무거웠던 결함)", r)

# D-7 : 하위 폴더에 다른 티어 마커 중첩 → ★detect_tier 가 재귀로 봐야 합니다
r = seed_A('DAB')
sub = os.path.join(r, 'B_inside')
open(os.path.join(root('DAB/B_inside'), '.TIER_B'), 'w').close()
tiny(os.path.join(sub, 'images', 'private.jpg'))
imgs = sorted(glob.glob(os.path.join(r, '**', '*.jpg'), recursive=True))
chk("D-7 전제: 중첩 폴더 사진이 재귀 수집에 휩쓸린다",
    any('B_inside' in p.replace('\\', '/') for p in imgs))
kill("D-7 M-AB", "G-1", "Tier-A 루트 ★하위에 .TIER_B 폴더 중첩", r)

# D-10 : 동의 흔적의 형태·이름 변형 → ★이름 기준으로 봐야 합니다
r = seed_A('DAJ')
open(os.path.join(r, 'consent.pdf'), 'w').close()
open(os.path.join(r, 'consent'), 'w').close()              # ★디렉터리가 아니라 파일
os.makedirs(os.path.join(r, '동의서'))
os.makedirs(os.path.join(r, 'consents'))
kill("D-10 M-AJ", "G-3", "Tier-A 의 동의 흔적이 consent.pdf · consent(파일) · 동의서/ · consents/", r)

# ── G-6 ──────────────────────────────────────────────────────────────
print("\n⑩ ★★G-6 — 금지 문자열 검사가 어디까지 미치는가 (P-46 반영 후)")

# D-8 : ★rows(JSON)까지 검사해야 합니다
msg, txt, path, out = rep('D8', 'A', [rows_ok(judge_reason='합격', T1_why='PASS')])
chk("D-8 M-AC ★rows(JSON)의 '합격'·'PASS' 도 G-6 이 잡는다"
    + (f"  ⟨{msg}⟩" if msg else "  ⟨★새어 나갔습니다⟩"),
    msg is not None and msg.startswith('G-6:'))
chk("D-8 부수: 차단됐으므로 파일이 쓰이지 않았다", path is None or not os.path.exists(path))

# D-9 : '통과'·소문자 pass/fail 까지 막습니다 (P-46)
msg, txt, path, out = rep('D9', 'A', [rows_ok(file='통과.jpg', status='과검출', area=9.9)])
chk("D-9a M-AD '통과' 를 G-6 이 잡는다" + (f"  ⟨{msg}⟩" if msg else "  ⟨★새어 나갔습니다⟩"),
    msg is not None and msg.startswith('G-6:'))
msg, txt, path, out = rep('D9b', 'A', [rows_ok(file='pass.jpg', status='판독불가', area=0.1)])
chk("D-9b M-AD 소문자 'pass' 를 G-6 이 잡는다" + (f"  ⟨{msg}⟩" if msg else "  ⟨★새어 나갔습니다⟩"),
    msg is not None and msg.startswith('G-6:'))

# ★★정상 Tier-A 리포트가 ★자기 금지어에 걸리지 않아야 합니다
#   (초판은 면적 sanity 줄에 「통과」를 써서 ★자기 검사에 걸렸습니다 — 문구를 고쳤습니다)
msg, txt, path, out = rep('D9c', 'A', [rows_ok()])
chk("★정상 Tier-A 리포트가 ★자기 금지어에 걸리지 않는다"
    + (f"  ⟨★걸렸습니다: {msg}⟩" if msg else ""), msg is None)
chk("★정상 Tier-A 리포트 본문에 '통과' 라는 낱말이 ★없다", txt is not None and '통과' not in txt)
# ★우리 사유 코드도 금지어를 피해야 합니다 (ABSENT_GATE_FAILED → ABSENT_GATE_UNMET)
import palmtype as _pt
_src = open(os.path.join(HERE, 'palmtype.py'), encoding='utf-8').read() if 'HERE' in dir() \
    else open('palmtype.py', encoding='utf-8').read()
chk("★palmtype 의 사유 코드에 'FAIL' 이 없다 (G-6 오탐 방지)", 'FAIL' not in _src)

# ★막는 것도 확인 — 부분문자열이므로 문장 속에서도 잡힙니다
msg, _, _, _ = rep('D9c', 'A', [rows_ok(file='최종FAIL.jpg', status='과검출', area=9.9)])
chk("G-6 은 문장 ★안에 박힌 FAIL 도 잡는다 (부분문자열)",
    msg is not None and msg.startswith('G-6:'))
msg, _, _, _ = rep('D9d', 'A', [rows_ok(T1='T1-불합격')])
chk("G-6 은 T 코드에 섞인 '불합격' 도 잡는다", msg is not None and msg.startswith('G-6:'))

# ══════════════════════════════════════════════════════════════════════
n_bad = sum(1 for _, o in OK if not o)
print("\n" + "=" * 62)
print(f"{len(OK)-n_bad}/{len(OK)} 통과" + ("" if n_bad == 0 else f" · ★실패 {n_bad}건"))

print(f"\n★★게이트가 ★막지 못하는 것으로 ★확인된 항목 {len(DEFECTS)}건 "
      "(★고치지 않았습니다 — 보고 대상입니다)")
for did, mid, want, desc, why in DEFECTS:
    print(f"  ▸ {did} ({mid} · {want}) {desc}\n      └ {why}")

if NOTES:
    print(f"\n★현재 동작 기록 {len(NOTES)}건 (결함 아님으로 판단)")
    for mid, note in NOTES:
        print(f"  · {mid} {note}")

print("\n★이 검사가 보증하지 못하는 것은 파일 첫머리 docstring 에 적어 두었습니다.")
shutil.rmtree(BASE, ignore_errors=True)
shutil.rmtree(os.path.dirname(_TMPTH), ignore_errors=True)
sys.exit(1 if n_bad else 0)
