#!/usr/bin/env python3
"""천운 손금 평가 하네스 v1 — ★Tier 격리 게이트 6종 내장.
사용: python3 harness.py <데이터셋루트> [<또다른루트> ...]
  루트에 .TIER_A 또는 .TIER_B 마커가 있어야 합니다.
★합격 판정은 Tier-B 에서만, 그리고 ★3중 조건(clDice + Dice + 면적 sanity)으로만 냅니다."""
import sys, os, glob, csv, json, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image
from pthread import load
from unet_np import forward
from mask import palm_mask
from mask2 import palm_mask2
from palmroi import palm_roi   # ★랜드마크 기반 손바닥 ROI (제이 제안 2026-08-26)
from metrics import cl_dice, dice, iou
import palmtype                # ★P-45 (2026-08-28) — 유형 판정 엔진. ★임계는 thresholds.py 에서만
import thresholds as TH

S = 256
PALM_GROW = 1.12          # ★랜드마크 다각형 확장 계수 (실측으로 선택 · §5-9)
# ★★P-40 해소 (2026-08-28) — 면적 sanity 임계를 ★레지스트리로 이관했습니다.
#   ★이전에는 `AREA_LO, AREA_HI = 1.5, 6.0` 이 여기 하드코딩돼 있었고,
#   ★그 값은 「ROI 가 좁아져서」 ★결과를 보고 재보정한 것이었습니다(출처가 관측이 아닙니다).
#   ★그런데 그 값이 만드는 `area_ok` 가 ★T3 「없음」 게이트의 한 조건입니다.
#   ⟹ ★이제 `thresholds.AREA_LO/AREA_HI` 에서만 옵니다.
#   ⟹ ★★확정 전(verdict)에는 ★면적을 판정하지 않습니다 — 상태가 '면적미판정' 이 되고
#      `area_ok=False` 이므로 ★T3 는 absent 를 낼 수 없습니다 (fail-closed).
# ★★P-46 — G-6 금지어 확장 (t_gates D-9). ★소문자·「통과」까지 막습니다.
BANNED = ("합격", "불합격", "통과", "PASS", "FAIL", "pass", "fail")

class GateFail(Exception): pass

def detect_tier(root):
    """★★D-7 교정 (2026-08-28): ★하위 폴더의 마커까지 봅니다.
    ★run() 은 `**` 로 재귀 수집하는데 detect_tier 가 ★루트만 보면,
      ★Tier-A 루트 밑에 `.TIER_B` 폴더를 두어 ★두 티어를 섞을 수 있었습니다."""
    found = {}
    for dp, dn, fn in os.walk(root):
        # ★Tier-C (2026-08-29 · ADR-002) = ★학습·튜닝용 외부 데이터.
        #   ★평가에 쓸 수 없습니다 — `run()` 이 거부합니다.
        for m, t in (('.TIER_A', 'A'), ('.TIER_B', 'B'), ('.TIER_C', 'C')):
            if m in fn or os.path.exists(os.path.join(dp, m)):
                found.setdefault(t, []).append(dp)
    if not found:
        raise GateFail(f"G-1: {root} (하위 포함)에 티어 마커(.TIER_A/.TIER_B)가 없습니다")
    if len(found) > 1:
        raise GateFail(f"G-1: {root} 트리에 ★두 티어 마커가 함께 있습니다 — {found}")
    t = next(iter(found))
    if len(found[t]) > 1:
        raise GateFail(f"G-1: 마커가 여러 곳에 있습니다 (하위 폴더 혼입 의심) — {found[t]}")
    if os.path.abspath(found[t][0]) != os.path.abspath(root):
        raise GateFail(f"G-1: 마커가 루트가 아니라 하위에 있습니다 — {found[t][0]}")
    return t

def read_csv(p):
    """(행 리스트, 열 이름 리스트) 를 냅니다. ★D-1: 0행이어도 열을 볼 수 있어야 합니다."""
    if not os.path.exists(p): return None, None
    with open(p, encoding='utf-8-sig') as f:
        r = csv.DictReader(f)
        return list(r), list(r.fieldnames or [])

def list_images(root):
    """게이트가 ★자족적으로 이미지를 셉니다 (D-5·D-6 대조용)."""
    out = []
    for e in ('*.jpg', '*.jpeg', '*.png', '*.JPG', '*.JPEG', '*.PNG'):
        out += glob.glob(os.path.join(root, '**', e), recursive=True)
    seen, res = set(), []
    for f in out:
        k = os.path.normcase(os.path.abspath(f))
        if k in seen or '/masks/' in f.replace('\\', '/') or '/consent/' in f.replace('\\', '/'):
            continue
        seen.add(k); res.append(f)
    return sorted(res)

def gate_checks(root, tier):
    """G-3 · G-4 · G-5 — ★2026-08-28 뮤턴트 테스트(t_gates.py)가 찾은 결함 반영판"""
    man,  man_cols  = read_csv(os.path.join(root, 'MANIFEST.csv'))
    meta, meta_cols = read_csv(os.path.join(root, 'meta.csv'))
    imgs = [os.path.basename(p) for p in list_images(root)]

    if tier == 'C':
        # ★Tier-C 는 ★평가 대상이 아니므로 ★게이트를 통과시키지 않고 ★여기까지 오지도 않습니다.
        #   (run() 의 G-8 이 먼저 막습니다) ★혹시 직접 불렸다면 ★그대로 거부합니다.
        raise GateFail("G-8: Tier-C 는 평가 경로에서 처리하지 않습니다")
    if tier == 'A':
        # ── G-3 : Tier-A 에 동의 관련 흔적이 있으면 혼입
        # ★D-10: 폴더 하나만 보던 것을 ★이름·형태 변형까지 봅니다
        for e in os.listdir(root) if os.path.isdir(root) else []:
            if 'consent' in e.lower() or '동의' in e:
                raise GateFail(f"G-3: Tier-A 에 동의 관련 항목이 있습니다: '{e}' (Tier-B 혼입 의심)")
        # ★D-1: 0행이어도 ★열 이름으로 검사 · ★D-4: 부분 일치까지
        for c in (meta_cols or []):
            if 'consent' in c.strip().lower():
                raise GateFail(f"G-3: Tier-A 의 meta.csv 에 동의 관련 열 '{c}' 이 있습니다")

        # ── G-5 : 출처·라이선스 필수
        if man is None: raise GateFail("G-5: Tier-A 에 MANIFEST.csv 가 없습니다")
        if not man:     raise GateFail("G-5: MANIFEST.csv 가 ★0행입니다 (검사가 한 번도 돌지 않습니다)")
        for c in ('file', 'source', 'license', 'commercial_ok'):
            if c not in (man_cols or []):
                raise GateFail(f"G-5: MANIFEST.csv 에 '{c}' 열이 없습니다")
        for i, r in enumerate(man, 2):
            for col in ('license', 'commercial_ok'):
                if not (r.get(col) or '').strip():
                    raise GateFail(f"G-5: MANIFEST.csv {i}행 '{col}' 이 비었습니다")
            if (r.get('commercial_ok') or '').strip().upper() != 'Y':
                raise GateFail(f"G-5: MANIFEST.csv {i}행 commercial_ok != Y")
            # ★자체 촬영은 URL 이 없을 수 있습니다 (구현 중 발견한 정련)
            if (r.get('source') or '').strip() != 'self_capture' and not (r.get('source_url') or '').strip():
                raise GateFail(f"G-5: MANIFEST.csv {i}행 source_url 이 비었습니다 (source={r.get('source')})")
        # ★D-5: MANIFEST 미등재 이미지 — ★출처를 모르는 파일은 자격이 없습니다 (TierA수집 v1 §3-3)
        listed = {(r.get('file') or '').strip() for r in man}
        miss = [n for n in imgs if n not in listed]
        if miss:
            raise GateFail(f"G-5: MANIFEST.csv 에 없는 이미지 {len(miss)}건 — 예: {miss[:3]}")
    else:
        # ── G-4 : Tier-B 는 동의가 전부 확인돼야 함
        if meta is None: raise GateFail("G-4: Tier-B 에 meta.csv 가 없습니다")
        if not meta:     raise GateFail("G-4: meta.csv 가 ★0행입니다 (동의 기록이 0건입니다)")
        if 'consent' not in (meta_cols or []):
            raise GateFail("G-4: meta.csv 에 'consent' 열이 없습니다")
        if 'file' not in (meta_cols or []):
            raise GateFail("G-4: meta.csv 에 'file' 열이 없습니다")
        for i, r in enumerate(meta, 2):
            c = (r.get('consent') or '').strip().upper()
            if c not in ('Y', 'SELF'):
                raise GateFail(f"G-4: meta.csv {i}행 consent='{r.get('consent')}' (Y 또는 SELF 여야 합니다)")
        # ★★D-6: meta 미등재 이미지 — ★동의 기록이 없는 사진이 판정에 들어가는 것을 막습니다
        listed = {(r.get('file') or '').strip() for r in meta}
        miss = [n for n in imgs if n not in listed]
        if miss:
            raise GateFail(f"G-4: meta.csv 에 없는 이미지 {len(miss)}건 — "
                           f"★동의 기록이 없습니다: {miss[:3]}")
    return man, meta

def crop_box(im):
    """★손 영역 crop 박스 (x0, y0, box) 를 냅니다. 실패 시 None.

    ★★이 함수를 ★분리해 둔 이유: ★마스크 생성(P-9)이 ★추론과 ★똑같은 변환을 써야 합니다.
       ★따로 구현하면 ★언젠가 어긋나고, 그러면 ★GT 와 예측이 ★다른 격자에 놓입니다.
    """
    sm = np.asarray(im.resize((im.width//16, im.height//16)), np.float32)
    h, _ = palm_mask(sm); ys, xs = np.nonzero(h)
    if len(ys) < 50: return None
    cy, cx = int(ys.mean())*16, int(xs.mean())*16
    box = max(int(max(np.ptp(ys), np.ptp(xs))*0.95)*16, 400)   # ★변수명 정정: side 는 좌/우 손입니다
    return max(0, cx-box//2), max(0, cy-box//2), box


def crop_to_S(im, cb):
    """crop 박스를 적용해 S×S 로 리사이즈. ★추론·마스크가 공유합니다."""
    x0, y0, box = cb
    return im.crop((x0, y0, min(im.width, x0+box), min(im.height, y0+box))).resize((S, S), Image.LANCZOS)


def infer(path, sd):
    im = Image.open(path)
    cb = crop_box(im)
    if cb is None: return None
    crop = crop_to_S(im, cb)
    rgb = np.asarray(crop, np.float32)
    # ★손가락을 먼저 확정해 배제한다 — 랜드마크는 「영역 경계」에만 씁니다(§1-4 교훈)
    roi, lm, side = palm_roi(rgb, grow=PALM_GROW)
    if roi is None:                      # ★손 미검출 = 판독 불가 (fail-closed)
        return None
    lg = forward(np.ascontiguousarray(rgb.transpose(2,0,1)/255.), sd)
    pred = (1/(1+np.exp(-lg)) > 0.5) & roi
    return pred, roi, lm, side          # ★P-45: lm·side 를 함께 반환합니다 (판정 엔진 입력)

def load_gt(root, name):
    p = os.path.join(root, 'masks', os.path.splitext(name)[0] + '_mask.png')
    if not os.path.exists(p): return None
    m = np.asarray(Image.open(p).resize((S, S), Image.NEAREST))
    return (m > 0) & (m != 255), (m == 255)      # (선, ignore)

def run(roots, ckpt, mode="verdict"):
    tiers = {r: detect_tier(r) for r in roots}
    if len(set(tiers.values())) > 1:              # ★G-1
        raise GateFail(f"G-1: 한 실행에 Tier-A 와 Tier-B 가 섞였습니다 — {tiers}")
    tier = next(iter(tiers.values()))
    if tier == 'C':                               # ★★G-8 (ADR-002)
        raise GateFail("G-8: Tier-C(학습·튜닝용 외부 데이터)는 ★평가 하네스로 돌릴 수 없습니다. "
                       "★배정 벤치마크는 bench_assign.py 를 쓰십시오")
    for r in roots: gate_checks(r, tier)

    # ★★P-40 — 면적 임계를 레지스트리에서만 받습니다. 없으면 ★판정하지 않습니다
    try:
        area_lo, area_hi = TH.get("AREA_LO", mode), TH.get("AREA_HI", mode)
    except TH.ThresholdUnset:
        area_lo = area_hi = None

    sd = load(ckpt); rows = []
    for r in roots:
        imgs = sorted(glob.glob(os.path.join(r, '**', '*.jpg'), recursive=True)) + \
               sorted(glob.glob(os.path.join(r, '**', '*.png'), recursive=True))
        imgs = [i for i in imgs if '/masks/' not in i.replace('\\','/')]
        for p in imgs:
            out = infer(p, sd)
            if out is None:
                rows.append(dict(file=os.path.basename(p), status='판독불가', area=None,
                                 T1='T1-U', T2='T2-U', T3='T3-U',
                                 judge_reason='HAND_OR_PALM_NOT_DETECTED')); continue
            pred, palm, lm, side = out
            area = pred.sum()/max(palm.sum(), 1)*100
            # ★면적 sanity 를 「판독 불가 / 과검출 / ok」 3분기로 (개발계획 Phase 2-4 fail-closed)
            if area_lo is None:    st = '면적미판정'      # ★P-40 — 임계 미확정 (G-7)
            elif area < area_lo:   st = '판독불가'
            elif area > area_hi:   st = '과검출'
            else:                  st = 'ok'
            row = dict(file=os.path.basename(p), area=round(area, 2),
                       area_ok=bool(st == 'ok'), status=st, hand=side)
            # ★★P-45 — 판정 엔진 연결. ★임계가 없으면 전 축 UNCERTAIN 이 나옵니다(G-7)
            j = palmtype.judge(pred, lm, side, area_ok=(st == 'ok'), mode=mode)
            row.update(T1=j['T1']['code'], T2=j['T2']['code'], T3=j['T3']['code'],
                       n_frags=j['n_frags'], n_degenerate=j.get('n_degenerate'),
                       groups=j['groups'], judge_reason=j['assign_reason'],
                       T1_why=j['T1']['reason'], T2_why=j['T2']['reason'], T3_why=j['T3']['reason'])
            g = load_gt(r, os.path.basename(p))
            if g is not None:
                gt, ign = g; keep = ~ign
                row.update(clDice=round(cl_dice(pred & keep, gt & keep), 3),
                           dice=round(dice(pred & keep, gt & keep), 3),
                           iou=round(iou(pred & keep, gt & keep), 3))
            rows.append(row)
    return tier, rows

def report(tier, rows, outdir, mode="verdict"):
    pre = '[TIER-A] ' if tier == 'A' else ''                     # ★G-2
    name = 'report_TIERA_NOT_FOR_VERDICT.json' if tier == 'A' else 'report_verdict.json'
    has_gt = any('clDice' in r for r in rows)
    lines = [f"천운 손금 평가 하네스 v2 — Tier-{tier} · 판정모드 {mode}", ""]
    if tier == 'A':
        lines += ["★★이 리포트는 ★연막 시험(Tier-A)입니다.",
                  "★일반화·품질 판정에 사용할 수 없습니다. 판정은 Tier-B 에서만 냅니다.", ""]
    if mode == 'diagnostic':
        lines += ["★★NOT_A_VERDICT — ★2026-08-26 실패치(눈대중 임계)를 쓰는 ★진단 실행입니다.",
                  "★아래 유형 분포는 ★「엔진이 도는가」의 증거일 뿐이며 ★성능이 아닙니다.",
                  "★임계는 Tier-B 라벨로만 확정됩니다 (G-7).", ""]
    lines += [f"{pre}임계 상태: {TH.status()}", ""]
    cnt = {}
    for r in rows: cnt[r['status']] = cnt.get(r['status'], 0) + 1
    lines.append(f"{pre}이미지 {len(rows)}장 · " + " · ".join(f"{k} {v}" for k, v in sorted(cnt.items())))
    have = [r for r in rows if r.get('area') is not None]
    if have:
        a = [r['area'] for r in have]
        lines.append(f"{pre}예측 면적(palm 대비) 평균 {np.mean(a):.2f}% · 범위 {min(a):.2f}~{max(a):.2f}%")
        if cnt.get('면적미판정'):
            lines.append(f"{pre}★면적 sanity 임계 미확정 — ★판정하지 않았습니다 (G-7 · P-40). "
                         f"area_ok=False 이므로 T3 는 absent 를 낼 수 없습니다")
        for r in rows:      # ★'면적미판정' 은 전건이라 나열하지 않습니다 (위 한 줄로 갈음)
            if r['status'] not in ('ok', '면적미판정'):
                lines.append(f"{pre}  · {r['file'][-10:]} {r['status']} (면적 {r.get('area')}%)")
    ok = [r for r in rows if r['status'] == 'ok']
    if has_gt:
        for k in ('clDice','dice','iou'):
            v = [r[k] for r in ok if k in r]
            if v: lines.append(f"{pre}{k} 평균 {np.mean(v):.3f}")
    else:
        lines.append(f"{pre}★GT 마스크가 없어 clDice·Dice 를 계산하지 않았습니다 (면적 sanity 만)")

    # ★★P-45 — 유형 판정 요약
    lines.append("")
    lines.append(f"{pre}── 유형 판정 (엔진) ──")
    fr = [r['n_frags'] for r in rows if r.get('n_frags') is not None]
    if fr:
        lines.append(f"{pre}조각 수 평균 {np.mean(fr):.1f} · 범위 {min(fr)}~{max(fr)} · "
                     f"퇴화조각 총 {sum(r.get('n_degenerate') or 0 for r in rows)}")
    for ax in ('T1', 'T2', 'T3'):
        cnt = {}
        for r in rows: cnt[r.get(ax, '-')] = cnt.get(r.get(ax, '-'), 0) + 1
        lines.append(f"{pre}{ax}: " + " · ".join(f"{k} {v}" for k, v in sorted(cnt.items())))
    # ★선별 배정률 — ★P-39 기준선. ★이것은 「성능」이 아니라 「배정이 일어나는가」입니다
    g = [r['groups'] for r in rows if r.get('groups')]
    if g:
        for k in ('RLC', 'PTC', 'DTC', 'FATE'):
            n = sum(1 for x in g if x.get(k, 0) > 0)
            lines.append(f"{pre}  {k} 배정된 장수 {n}/{len(g)}")
        three = sum(1 for x in g if all(x.get(k, 0) > 0 for k in ('RLC', 'PTC', 'DTC')))
        lines.append(f"{pre}  ★3대선 전부 배정 {three}/{len(g)}")
    else:
        lines.append(f"{pre}  ★배정이 일어나지 않았습니다 (임계 미확정 — 정상입니다)")

    txt = "\n".join(lines)
    payload = dict(tier=tier, mode=mode, thresholds=TH.status(), summary=lines, rows=rows)
    if tier == 'A':                                              # ★G-6
        # ★★P-46 (t_gates D-8) — ★요약 텍스트만 보던 것을 ★디스크에 쓰는 내용 ★전체로 넓혔습니다.
        #   ★이전에는 rows 안의 값(예: judge_reason='합격')이 ★그대로 파일에 기록됐습니다.
        blob = txt + "\n" + json.dumps(payload, ensure_ascii=False)
        for w in BANNED:
            if w in blob:
                raise GateFail(f"G-6: Tier-A 리포트(요약 또는 rows)에 금지 문자열 '{w}' 이 있습니다")
    os.makedirs(outdir, exist_ok=True)
    with open(os.path.join(outdir, name), 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=1)
    return txt, os.path.join(outdir, name)

if __name__ == '__main__':
    ck = os.environ.get('CW_PALM_CKPT', 'palm-api/checkpoint_aug_epoch70.pth')
    out = os.environ.get('CW_PALM_OUT', '/tmp/palm_report')
    md = os.environ.get('CW_PALM_MODE', 'verdict')     # ★diagnostic 은 진단 전용입니다
    try:
        tier, rows = run(sys.argv[1:], ck, md)
        txt, path = report(tier, rows, out, md)
        print(txt); print(f"\n→ {path}")
    except GateFail as e:
        print(f"★★게이트 위반 — 중단합니다\n   {e}"); sys.exit(2)
