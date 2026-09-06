"""★★P-68 — 조각 정답을 `note` 열에서 `gt` 열로 이관합니다 (ADR-003 §7 · 2026-08-31)

★★왜 옮기는가 (감사 지적)
   ① ★라벨규칙 v1 §5 는 자유 텍스트 `note` 열을 ★「금지 정보가 흘러들 통로」라며 ★삭제했습니다.
      ★그런데 frag_gt 에서는 그 열이 ★정답 채널이 돼 있었습니다.
   ② ★`read_gt` 의 note-우선 규약은 ★오타 note 를 ★검증 없이 「클래스 아님」으로 처리해
      ★표본에서 ★조용히 탈락시킵니다 ⟹ ★오타 하나로 212 가 줄어듭니다.
   ③ ★`gt` 열은 218행 ★전부 `pred_tree` 와 같아 ★사실상 비어 있었습니다.

★★불변 조건 (이것이 깨지면 이관하지 않습니다)
   ★유효 212 · NONE 82 · PTC 45 · RLC 37 · DTC 29 · FATE 19
   ★구 규약(note 우선)과 ★신 규약(gt + exclude)의 ★결과가 ★전 행에서 동일해야 합니다.

★★새 스키마 — ★제외를 ★명시 열로 올립니다 (묵시적 탈락 제거)
   gt             : ★정답. RLC · PTC · DTC · FATE · NONE · ★CLOSED
   note           : ★비고 자유 텍스트 (★더 이상 정답 채널이 아닙니다)
   exclude        : Y / N — ★학습·CV 집합에서 제외할 것인가
   exclude_reason : HALF_ONLY · CLOSED_UNTRAINABLE

★`RLC & PTC` → ★`CLOSED` (ADR-003 §4-1 ①). ★학습 제외는 ★유지합니다 (n=1).

사용: python3 _v785_palm/probe/p68_migrate.py [--write]
      ★--write 없이는 ★검증만 하고 파일을 쓰지 않습니다.
"""
import sys, os, csv, argparse, collections

CLASSES = ("RLC", "PTC", "DTC", "FATE", "NONE")
CLOSED = "CLOSED"
CLOSED_SRC = "RLC & PTC"
HALF = "HALF ONLY"

EXPECT_N = 212
EXPECT_DIST = {"NONE": 82, "PTC": 45, "RLC": 37, "DTC": 29, "FATE": 19}

SRC = "frag_gt(수정).csv"
DST = "frag_gt_v3.csv"
OUT_COLS = ["file", "frag_id", "pred_tree", "gt", "exclude", "exclude_reason", "note",
            "npix", "cu", "cv", "u_max", "v_max", "ang_v_deg"]


def old_rule(r):
    """★구 규약 — note 가 있으면 그것이 정답, 없으면 gt. (ourtree.read_gt 원본)"""
    return (r["note"].strip().upper() or r["gt"].strip().upper())


def migrate(root, write):
    rows = list(csv.DictReader(open(os.path.join(root, SRC), encoding="utf-8-sig")))
    out, mismatch = [], []
    for r in rows:
        old = old_rule(r)
        note = r["note"].strip()
        nu = note.upper()

        if nu in CLASSES:                 # ★제이가 클래스를 적으신 행 → gt 로 올립니다
            gt, ex, why, keep_note = nu, "N", "", ""
        elif nu == CLOSED_SRC.upper():    # ★공통 주름 → CLOSED · 학습 제외 유지
            gt, ex, why, keep_note = CLOSED, "Y", "CLOSED_UNTRAINABLE", note
        elif nu == HALF:                  # ★조각이 선의 일부만 덮음 → 클래스는 그대로, 제외 유지
            gt, ex, why, keep_note = r["gt"].strip().upper(), "Y", "HALF_ONLY", note
        elif nu == "":                    # ★손대지 않으신 행 → gt(=pred_tree) 유지
            gt, ex, why, keep_note = r["gt"].strip().upper(), "N", "", ""
        else:                             # ★★예상 못 한 note — ★조용히 넘기지 않습니다
            raise SystemExit(f"★알 수 없는 note: {note!r} @ {r['file']} #{r['frag_id']}\n"
                             f"  ★스키마를 정하기 전에는 이관하지 않습니다.")

        # ★구·신 규약이 같은 답을 내는지 행 단위로 대조
        new_eff = None if ex == "Y" else gt
        old_eff = old if old in CLASSES else None
        if new_eff != old_eff:
            mismatch.append((r["file"], r["frag_id"], old_eff, new_eff))

        o = {k: r.get(k, "") for k in OUT_COLS}
        o.update(file=r["file"], frag_id=r["frag_id"], pred_tree=r["pred_tree"].strip().upper(),
                 gt=gt, exclude=ex, exclude_reason=why, note=keep_note)
        out.append(o)

    kept = [o for o in out if o["exclude"] == "N"]
    dist = collections.Counter(o["gt"] for o in kept)
    exd = collections.Counter(o["exclude_reason"] for o in out if o["exclude"] == "Y")

    print(f"입력 {len(rows)}행 → 유효 {len(kept)} · 제외 {len(out)-len(kept)} {dict(exd)}")
    print(f"GT 분포 {dict(dist)}")
    print(f"구·신 규약 불일치 ★{len(mismatch)}건")
    for m in mismatch[:10]:
        print("   ", m)

    ok = (len(kept) == EXPECT_N and dict(dist) == EXPECT_DIST and not mismatch)
    print("─" * 70)
    if not ok:
        print("★★불변 조건 위반 — ★쓰지 않습니다.")
        print(f"   기대 유효 {EXPECT_N} / 분포 {EXPECT_DIST}")
        return 1
    print("★불변 조건 통과: 212 · 분포 일치 · 불일치 0")

    if not write:
        print("★--write 를 주지 않아 파일을 쓰지 않았습니다.")
        return 0
    p = os.path.join(root, DST)
    with open(p, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=OUT_COLS)
        w.writeheader(); w.writerows(out)
    print(f"★기록: {p}")
    print(f"★원본 {SRC} 는 ★그대로 둡니다 (폐기 금지 · 승계 자산).")
    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=os.environ.get("CW_PALM_FRAG"))
    ap.add_argument("--write", action="store_true")
    a = ap.parse_args()
    if not a.root:
        raise SystemExit("★CW_PALM_FRAG 를 설정하거나 --root 를 주십시오.")
    sys.exit(migrate(a.root, a.write))
