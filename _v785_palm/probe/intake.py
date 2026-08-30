"""★★Tier-B 사진 정리 스크립트 (2026-08-28 · 원격수집 패킷 §5-4)

★★기본이 ★dry-run 입니다. `--apply` 없이는 ★파일을 한 개도 쓰지 않습니다.
★원본을 ★옮기지 않고 ★복사합니다 — 실수해도 되돌릴 수 있게.

사용:
  1) python3 intake.py <받은사진폴더> <B_verdict경로>
        → ★`intake_map.csv` 뼈대를 만들어 줍니다. ★제이가 채우십시오
  2) (채운 뒤) python3 intake.py <받은사진폴더> <B_verdict경로>
        → ★검증만 하고 무엇을 할지 보여줍니다
  3) python3 intake.py <받은사진폴더> <B_verdict경로> --apply
        → ★images\\ 복사 + meta.csv 생성 + ★게이트 사전 점검

★★검증에서 막는 것 (라벨규칙 v1 §5-5·§5-6 · 게이트 G-3/G-4/G-5)
   · consent 가 `Y` 가 아닌 행           → ★거부 (G-4)
   · `consent/<subject>.*` 증빙 없음      → ★거부
   · subject 코드가 `S\\d+` 형식이 아님    → ★거부 (이름·이니셜 금지)
   · hand 가 L/R 이 아님 · 같은 (subject,hand,순번) 중복 → ★거부
   · 해상도가 너무 낮음(압축 의심)        → ★경고 (거부 아님 · §MIN_SIDE 근거 참조)
   · ★meta 열에 자유 텍스트 열이 추가돼 있음 → ★거부
"""
import sys, os, csv, glob, shutil, re

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# ★촬영 품질 하한. ★판정 임계가 아닙니다 —
#   평가는 256×256 이고(Phase0실측 §4) crop 여유를 감안한 ★보수적 하한입니다.
#   ★카카오톡 압축 전송을 걸러내는 것이 목적입니다 (원격수집 패킷 §3).
MIN_SIDE = 1000

META_COLS = ["file", "subject", "hand", "consent", "date",
             "lighting", "indoor", "skin_tone_band", "age_band", "ignore_ratio"]
MAP_COLS = ["src_file", "subject", "hand", "seq", "consent", "date",
            "lighting", "indoor", "skin_tone_band", "age_band"]
EXTS = ('*.jpg', '*.jpeg', '*.png', '*.JPG', '*.JPEG', '*.PNG')


def collect(src):
    seen, out = set(), []
    for e in EXTS:
        for f in glob.glob(os.path.join(src, '**', e), recursive=True):
            k = os.path.normcase(os.path.abspath(f))
            if k not in seen:
                seen.add(k); out.append(f)
    return sorted(out)


def make_skeleton(src, path):
    with open(path, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f); w.writerow(MAP_COLS)
        for p in collect(src):
            w.writerow([os.path.basename(p), "", "", "", "", "", "", "", "", ""])
    print(f"★뼈대를 만들었습니다 → {path}\n"
          f"  ★채우실 것: subject(S01…) · hand(L/R) · seq(01…) · consent(Y) · date(YYYY-MM-DD)\n"
          f"  ★lighting(창가/실내등/야외) · indoor(Y/N) · skin_tone_band(1~5) · age_band(20s 등)\n"
          f"  ★★consent 는 ★Y 만 허용됩니다. ★애매한 답을 Y 로 적지 마십시오.\n"
          f"  ★★이름·전화번호·정확한 나이·장소를 ★적지 마십시오 (라벨규칙 v1 §5-6).")


def size_of(p):
    try:
        from PIL import Image
        with Image.open(p) as im: return min(im.size)
    except Exception:
        return None


def main(src, dst, apply_):
    mp = os.path.join(src, 'intake_map.csv')
    if not os.path.exists(mp):
        make_skeleton(src, mp); return 0

    with open(mp, encoding='utf-8-sig') as f:
        rows = list(csv.DictReader(f))
    if not rows:
        print("★intake_map.csv 가 비었습니다."); return 2

    bad, warn, plan, subs = [], [], [], set()
    consent_dir = os.path.join(dst, 'consent')
    for i, r in enumerate(rows, 2):
        s = (r.get('subject') or '').strip()
        h = (r.get('hand') or '').strip().upper()
        q = (r.get('seq') or '').strip() or '01'
        c = (r.get('consent') or '').strip().upper()
        srcf = os.path.join(src, (r.get('src_file') or '').strip())

        if not re.fullmatch(r'S\d{2,3}', s):
            bad.append(f"{i}행 subject='{s}' — ★`S01` 형식이어야 합니다 (이름·이니셜 금지)"); continue
        if h not in ('L', 'R'):
            bad.append(f"{i}행 hand='{h}' — L 또는 R"); continue
        if c != 'Y':
            bad.append(f"{i}행 consent='{c}' — ★G-4: `Y` 만 허용됩니다"); continue
        if not os.path.exists(srcf):
            bad.append(f"{i}행 원본 없음: {r.get('src_file')}"); continue
        if not glob.glob(os.path.join(consent_dir, s + '.*')):
            bad.append(f"{i}행 ★동의 증빙 없음: consent/{s}.* — ★회신 캡처를 먼저 넣으십시오"); continue
        if not (r.get('date') or '').strip():
            bad.append(f"{i}행 date 가 비었습니다"); continue

        n = size_of(srcf)
        if n is not None and n < MIN_SIDE:
            warn.append(f"{i}행 짧은 변 {n}px < {MIN_SIDE} — ★압축 전송 의심. 원본 재요청을 권합니다")
        name = f"palm_{s}_{h}_{q}.jpg"
        if any(p[1] == name for p in plan):
            bad.append(f"{i}행 파일명 중복: {name} — seq 를 다르게 하십시오"); continue
        plan.append((srcf, name, r)); subs.add(s)

    print(f"★대상 {len(rows)}행 · ★통과 {len(plan)} · ★거부 {len(bad)} · ★경고 {len(warn)}")
    print(f"★피험자 수 {len(subs)}명 {sorted(subs)}")
    for m in bad:  print("  ❌ " + m)
    for m in warn: print("  ⚠️  " + m)
    if bad:
        print("\n★★거부 항목이 있어 중단합니다. ★고친 뒤 다시 실행하십시오."); return 2
    if len(subs) < 2:
        print("\n⚠️ ★피험자가 2명 미만입니다 — G-7 이 임계 확정을 거부합니다.")
    if len(subs) < 20:
        print(f"⚠️ ★피험자 {len(subs)}명. ★임계 확정 목표는 ★20~25명입니다 (원격수집 패킷 §7).\n"
              f"   ★★목표 전에는 `thresholds.freeze()` 를 ★부르지 마십시오 — ★코드가 막지 못합니다.")

    if not apply_:
        print("\n★dry-run 입니다. 실제로 쓰려면 ★--apply 를 붙이십시오.")
        for _, n, _ in plan[:5]: print(f"    → images/{n}")
        if len(plan) > 5: print(f"    … 외 {len(plan)-5}건")
        return 0

    img = os.path.join(dst, 'images'); os.makedirs(img, exist_ok=True)
    marker = os.path.join(dst, '.TIER_B')
    if not os.path.exists(marker): open(marker, 'w').close(); print("★.TIER_B 마커를 만들었습니다")
    meta = os.path.join(dst, 'meta.csv')
    exist = set()
    if os.path.exists(meta):
        with open(meta, encoding='utf-8-sig') as f:
            exist = {r['file'] for r in csv.DictReader(f)}
    new = []
    for srcf, name, r in plan:
        shutil.copy2(srcf, os.path.join(img, name))          # ★복사 — 원본을 지우지 않습니다
        if name in exist: continue
        new.append({"file": name, "subject": r['subject'].strip(),
                    "hand": r['hand'].strip().upper(), "consent": "Y",
                    "date": r['date'].strip(), "lighting": (r.get('lighting') or '').strip(),
                    "indoor": (r.get('indoor') or '').strip(),
                    "skin_tone_band": (r.get('skin_tone_band') or '').strip(),
                    "age_band": (r.get('age_band') or '').strip(), "ignore_ratio": ""})
    hdr = not os.path.exists(meta)
    with open(meta, 'a', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=META_COLS)
        if hdr: w.writeheader()
        for r in new: w.writerow(r)
    print(f"★복사 {len(plan)}건 → {img}\n★meta.csv 신규 {len(new)}행")

    try:                                                     # ★게이트 사전 점검
        from harness import detect_tier, gate_checks
        gate_checks(dst, detect_tier(dst))
        print("★★게이트 사전 점검 통과 (G-1·G-4)")
    except Exception as e:
        print(f"★★게이트 위반 — ★고치기 전에는 하네스를 돌리지 마십시오\n   {e}"); return 2
    print("\n★★잊지 마십시오: 카카오톡 대화방·사진첩의 사본을 ★삭제하십시오 (패킷 §5-5).")
    return 0


if __name__ == '__main__':
    a = [x for x in sys.argv[1:] if not x.startswith('--')]
    if len(a) != 2:
        print(__doc__); sys.exit(2)
    sys.exit(main(a[0], a[1], '--apply' in sys.argv))
