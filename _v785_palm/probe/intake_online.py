"""★★온라인 수집 사진 인테이크 — ★Tier-C 전용 (2026-08-31 · P-71)

★★이것은 ★Tier-B 가 ★아닙니다. ★혼동하면 안 되므로 먼저 적습니다.

   Tier-B = ★사람마다 ★이 용도로 ★동의한 사진 ⟹ ★출시 판정 근거로 쓸 수 있습니다
   Tier-C = ★그 외 전부 (라이선스가 아무리 깨끗해도) ⟹ ★G-8 이 평가 하네스 진입을 막습니다

   ★★라이선스(CC0·CC BY·Apache)는 ★「배포·이용 허락」이지 ★「이 사람이 자기 손금을
      상업 판정 시험에 쓰는 데 동의했다」가 ★아닙니다. ★둘은 다른 문제입니다.
   ⟹ ★그래서 ★깨끗한 라이선스여도 ★Tier-C 입니다. ★이 스크립트는 ★Tier-B 를 만들지 못합니다.

★★Tier-C 로 ★할 수 있는 것 (전부 유효합니다)
   · ★도메인 격차 측정 — 이 사진들이 ★우리 도메인에 가까운가 (§도메인 진단)
   · ★v4 축(cu·ang_v_deg)의 ★일반성 검증 — 우리 도메인 전용인가
   · ★U-Net 재학습 · pseudo-label 실험 (Phase 1.5)
★★할 수 없는 것
   · ★출시 판정(verdict) 근거 · ★임계 확정(freeze) 근거 · ★배정 규칙 승격 근거

★★기본이 ★dry-run 입니다. `--apply` 없이는 파일을 ★한 개도 쓰지 않습니다.
★원본을 ★옮기지 않고 ★복사합니다.

★★fail-closed 항목 (하나라도 걸리면 ★거부합니다)
   · `source_url` 이 비었음                → ★거부. ★출처 없는 사진은 방어할 수 없습니다
   · `license` 가 허용 목록 밖             → ★거부
   · `commercial_ok` 가 `Y` 가 아님        → ★거부
   · `license_url` 이 비었음               → ★거부. ★문구를 확인한 자리가 있어야 합니다
   · 파일명에 ★스톡 사이트 흔적            → ★거부 (v7 §4 — 무단수집 확정 사례가 있었습니다)
   · ★사람 이름으로 보이는 subject         → ★거부 (라벨규칙 v1 §5-6)

사용:
  1) python3 intake_online.py <받은폴더> <C_online경로>
        → ★`online_map.csv` 뼈대를 만듭니다. ★제이가 채우십시오
  2) (채운 뒤) python3 intake_online.py <받은폴더> <C_online경로>
        → ★검증 + 품질 체크 + ★도메인 진단만 합니다 (파일 안 씀)
  3) python3 intake_online.py <받은폴더> <C_online경로> --apply
        → ★images\\ 복사 + `meta.csv` + `.TIER_C` 마커 생성
"""
import sys, os, csv, glob, shutil, re

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# ★촬영 품질 하한 — intake.py 와 ★같은 값을 씁니다 (판정 임계가 아닙니다)
MIN_SIDE = 1000

# ★상업 이용이 ★명문으로 허용되는 것만. ★「아마 될 것 같다」는 넣지 마십시오.
ALLOWED_LICENSES = {
    "CC0-1.0", "CC-BY-4.0", "CC-BY-3.0", "CC-BY-SA-4.0",
    "Apache-2.0", "MIT", "PDM-1.0", "Unsplash", "Pexels", "Pixabay",
}
# ★v7 §4 — ★파일명에서 ★스톡 무단수집이 ★확정된 전례가 있습니다. 같은 실수를 막습니다.
STOCK_MARKERS = ("shutterstock", "istockphoto", "istock", "gettyimages", "getty",
                 "depositphotos", "dreamstime", "alamy", "123rf", "adobestock",
                 "stock.adobe", "freepik")

MAP_COLS = ["src_file", "subject", "hand", "source_url", "license", "license_url",
            "commercial_ok", "attribution", "note"]
META_COLS = ["file", "subject", "hand", "tier", "source_url", "license", "license_url",
             "commercial_ok", "attribution", "ignore_ratio"]
EXTS = ('*.jpg', '*.jpeg', '*.png', '*.webp',
        '*.JPG', '*.JPEG', '*.PNG', '*.WEBP')


class Reject(Exception):
    pass


def collect(src):
    seen, out = set(), []
    for e in EXTS:
        for f in glob.glob(os.path.join(src, '**', e), recursive=True):
            k = os.path.normcase(os.path.abspath(f))
            if k not in seen:
                seen.add(k); out.append(f)
    return sorted(out)


def make_skeleton(src, path):
    files = collect(src)
    if not files:
        raise Reject(f"★사진이 없습니다: {src}")
    with open(path, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f); w.writerow(MAP_COLS)
        for p in files:
            w.writerow([os.path.basename(p), "", "", "", "", "", "", "", ""])
    print(f"★뼈대를 만들었습니다 ({len(files)}행) → {path}\n"
          f"  ★채우실 것 (★한 줄이라도 비면 그 행은 거부됩니다):\n"
          f"    · subject       — ★O01, O02 … ★사람 이름을 적지 마십시오\n"
          f"    · hand          — L / R (모르면 U)\n"
          f"    · source_url    — ★사진을 받은 ★정확한 페이지 주소\n"
          f"    · license       — {' · '.join(sorted(ALLOWED_LICENSES))}\n"
          f"    · license_url   — ★라이선스 문구를 ★확인한 페이지 주소\n"
          f"    · commercial_ok — ★Y 만 허용. ★확실할 때만 Y 를 적으십시오\n"
          f"    · attribution   — CC BY 계열이면 ★표기해야 할 저작자명\n"
          f"  ★★이 표가 ★나중에 우리를 지킵니다. ★기억에 의존하지 마십시오.")


def size_of(p):
    try:
        from PIL import Image
        with Image.open(p) as im:
            return im.size
    except Exception:
        return (0, 0)


def validate(rows, src):
    """★행 단위 검증. 반환: (통과행, [(행, 사유)])"""
    ok, bad, seen = [], [], set()
    for r in rows:
        n = r["src_file"].strip()
        try:
            if not n:
                raise Reject("src_file 이 비었습니다")
            p = os.path.join(src, n)
            if not os.path.exists(p):
                cands = [q for q in collect(src) if os.path.basename(q) == n]
                if not cands:
                    raise Reject("파일을 찾을 수 없습니다")
                p = cands[0]

            sub = r["subject"].strip()
            if not re.fullmatch(r"O\d{2,3}", sub):
                raise Reject(f"subject 는 O01 형식이어야 합니다: {sub!r}")
            hand = r["hand"].strip().upper()
            if hand not in ("L", "R", "U"):
                raise Reject(f"hand 는 L/R/U 여야 합니다: {hand!r}")
            if (sub, hand) in seen:
                raise Reject(f"중복: {sub}-{hand}")
            seen.add((sub, hand))

            # ── 라이선스 — ★여기가 이 스크립트의 핵심입니다
            if not r["source_url"].strip():
                raise Reject("source_url 이 비었습니다 (★출처 없는 사진은 못 씁니다)")
            lic = r["license"].strip()
            if lic not in ALLOWED_LICENSES:
                raise Reject(f"허용 목록 밖 라이선스: {lic!r}")
            if not r["license_url"].strip():
                raise Reject("license_url 이 비었습니다 (★문구를 확인한 자리가 있어야 합니다)")
            if r["commercial_ok"].strip().upper() != "Y":
                raise Reject("commercial_ok 가 Y 가 아닙니다")
            if lic.startswith("CC-BY") and not r["attribution"].strip():
                raise Reject("CC BY 계열은 attribution 이 필요합니다")

            # ── 스톡 흔적 (v7 §4)
            hay = (n + " " + r["source_url"]).lower()
            hit = [m for m in STOCK_MARKERS if m in hay]
            if hit:
                raise Reject(f"★스톡 사이트 흔적: {hit}")

            w, h = size_of(p)
            warn = []
            if min(w, h) < MIN_SIDE:
                warn.append(f"해상도 {w}x{h} < {MIN_SIDE} (압축 의심 · 거부는 아님)")
            ok.append((r, p, warn))
        except Reject as e:
            bad.append((r.get("src_file", "?"), str(e)))
    return ok, bad


def domain_probe(paths, ckpt):
    """★★도메인 진단 — ★이 사진들이 ★우리 도메인에 가까운가.

    ★v7 §2-6 실측 비교값:
       ★A-smoke(우리) : npix 중앙값 ★12 · 조각 ★9.5개/장 · span_u 중앙값 0.066
       ★C_train(스튜디오): npix 중앙값 ★47 · 조각 ★5.7개/장 · span_u 중앙값 0.115
    ⟹ ★★가까우면 ★쓸모가 큽니다. ★멀면 ★v7 §2-3 ③(58.5 %)이 반복됩니다.
    """
    import numpy as np
    from PIL import Image
    from harness import crop_box, crop_to_S, PALM_GROW
    from pthread import load
    from unet_np import forward
    import palmroi, palmtype

    sd = load(ckpt)
    npix, nfrag, spanu, area, nohand = [], [], [], [], 0
    for p in paths:
        im = Image.open(p).convert("RGB")
        cb = crop_box(im)
        if cb is None:
            nohand += 1; continue
        rgb = np.asarray(crop_to_S(im, cb), np.float32)
        roi, lm, _ = palmroi.palm_roi(rgb, grow=PALM_GROW)
        if roi is None:
            nohand += 1; continue
        lg = forward(np.ascontiguousarray(rgb.transpose(2, 0, 1)/255.), sd)
        pred = (1/(1+np.exp(-lg)) > 0.5) & roi
        comps = palmtype.components(pred)
        nfrag.append(len(comps))
        area.append(float(pred.sum())/max(float(roi.sum()), 1.0)*100)
        for _, pts in comps:
            f = palmtype.frag_features(pts, lm)
            npix.append(f["npix"]); spanu.append(f["span_u"])
    return dict(n=len(paths), nohand=nohand,
                npix_med=(float(np.median(npix)) if npix else float("nan")),
                frag_mean=(float(np.mean(nfrag)) if nfrag else float("nan")),
                spanu_med=(float(np.median(spanu)) if spanu else float("nan")),
                area_mean=(float(np.mean(area)) if area else float("nan")))


def main(src, dst, apply):
    mp = os.path.join(src, "online_map.csv")
    if not os.path.exists(mp):
        make_skeleton(src, mp); return 0

    rows = list(csv.DictReader(open(mp, encoding="utf-8-sig")))
    miss = [c for c in MAP_COLS if c not in (rows[0].keys() if rows else [])]
    if miss:
        print(f"★online_map.csv 에 열이 없습니다: {miss}"); return 2

    ok, bad = validate(rows, src)
    print(f"★★Tier-C 온라인 인테이크 — 통과 {len(ok)} · ★거부 {len(bad)}")
    for n, why in bad:
        print(f"   ❌ {n}: {why}")
    for r, p, warn in ok:
        for w in warn:
            print(f"   ⚠ {r['src_file']}: {w}")
    if not ok:
        print("★통과한 행이 없습니다."); return 2

    lic = {}
    for r, _, _ in ok:
        lic[r["license"].strip()] = lic.get(r["license"].strip(), 0) + 1
    print(f"★라이선스 구성: {lic}")

    # ── 도메인 진단
    ck = os.environ.get("CW_PALM_CKPT", "palm-api/checkpoint_aug_epoch70.pth")
    if os.path.exists(ck):
        print("\n★★도메인 진단 (v7 §2-6 대조)")
        d = domain_probe([p for _, p, _ in ok], ck)
        print(f"   손 미검출 {d['nohand']}/{d['n']}장")
        print(f"   {'':22}{'이 사진들':>10}{'우리(A-smoke)':>14}{'스튜디오(C_train)':>18}")
        print(f"   {'npix 중앙값':22}{d['npix_med']:>10.1f}{12:>14}{47:>18}")
        print(f"   {'조각 수/장':22}{d['frag_mean']:>10.1f}{9.5:>14}{5.7:>18}")
        print(f"   {'span_u 중앙값':22}{d['spanu_med']:>10.3f}{0.066:>14}{0.115:>18}")
        print(f"   {'ROI 대비 면적 %':22}{d['area_mean']:>10.2f}{3.58:>14}{'—':>18}")
        print("   ★★우리 쪽에 가까우면 쓸모가 큽니다. 스튜디오 쪽이면 v7 ③(58.5 %)이 반복됩니다.")
    else:
        print(f"★체크포인트가 없어 도메인 진단을 건너뜁니다: {ck}")

    if not apply:
        print("\n★--apply 를 주지 않아 ★파일을 쓰지 않았습니다.")
        return 0

    img = os.path.join(dst, "images")
    os.makedirs(img, exist_ok=True)
    meta = []
    for r, p, _ in ok:
        sub, hand = r["subject"].strip(), r["hand"].strip().upper()
        ext = os.path.splitext(p)[1].lower()
        name = f"{sub}_{hand}{ext}"
        shutil.copy2(p, os.path.join(img, name))
        meta.append({"file": name, "subject": sub, "hand": hand, "tier": "C",
                     "source_url": r["source_url"].strip(), "license": r["license"].strip(),
                     "license_url": r["license_url"].strip(), "commercial_ok": "Y",
                     "attribution": r["attribution"].strip(), "ignore_ratio": ""})
    with open(os.path.join(dst, "meta.csv"), "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=META_COLS); w.writeheader(); w.writerows(meta)
    with open(os.path.join(dst, ".TIER_C"), "w", encoding="utf-8") as f:
        f.write("★Tier-C — 온라인 수집 · 상업 이용 허용 라이선스 확인분\n"
                "★★출시 판정(verdict)·임계 확정(freeze)·배정 규칙 승격에 ★쓸 수 없습니다.\n"
                "★G-8 이 평가 하네스 진입을 막습니다. ★게이트를 풀지 마십시오.\n"
                "★쓸 수 있는 곳: 도메인 격차 측정 · v4 축 일반성 검증 · U-Net 재학습 실험\n")
    print(f"\n★복사 {len(meta)}장 → {img}")
    print(f"★meta.csv · .TIER_C 마커 생성 완료")
    print("★★다시 적습니다 — ★이것은 Tier-B 가 아닙니다. ★판정 근거로 쓸 수 없습니다.")
    return 0


if __name__ == "__main__":
    a = [x for x in sys.argv[1:] if not x.startswith("--")]
    if len(a) < 2:
        print(__doc__); sys.exit(2)
    try:
        sys.exit(main(a[0], a[1], "--apply" in sys.argv))
    except Reject as e:
        print(f"★★중단합니다\n   {e}"); sys.exit(2)
