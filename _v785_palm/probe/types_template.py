"""★유형 라벨 입력표(`types.csv`) 뼈대 생성 (2026-08-28 · 라벨규칙 v2 §5-2)

★제이가 ★값만 채우면 되게 ★파일명·좌우를 미리 채워 둡니다.
★좌/우는 ★MediaPipe 판정입니다 — ★제이가 ★확인하고 틀리면 고치십시오
   (인수인계 v2 §2-5 에서 24장 전건 일치가 확인됐지만 ★보증은 아닙니다).

★★손 미검출 장도 ★행을 만듭니다 — ★행을 지우면 「없는 것」과 「빠진 것」이 구별되지 않습니다
   (라벨규칙 v1 §4-7). ★그런 장은 T1·T2·T3 를 전부 `U` 로 두고 사유를 적으십시오.

사용: cd "D:\\AI ChunWoon" && python3 _v785_palm/probe/types_template.py <데이터셋루트>
★이미 types.csv 가 있으면 ★덮어쓰지 않습니다.
"""
import sys, os, csv
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image

from harness import detect_tier, gate_checks, crop_box, crop_to_S, list_images, GateFail
import palmroi

COLS = ["file", "hand", "T1", "T2", "T3",
        "t1_gap_u_pct", "t1_gap_v_pct",
        "t2_gap_u_pct", "t2_gap_v_pct", "t2_common_len_pct",
        "t3_offset_pct", "t3_len_pct", "t3_tilt", "t3_darkness",
        "accessory_present", "radial_origin", "confidence", "note_uncertain"]


def main(root):
    tier = detect_tier(root); gate_checks(root, tier)
    out = os.path.join(root, 'types.csv')
    if os.path.exists(out):
        print(f"★이미 있습니다 — 덮어쓰지 않습니다: {out}"); return 0

    rows, nodet = [], 0
    for p in list_images(root):
        name = os.path.basename(p)
        hand, note = "", ""
        try:
            im = Image.open(p).convert('RGB')
            cb = crop_box(im)
            if cb is None:
                note = "손바닥 영역 검출 실패 — 라벨 대상 제외 사유를 적으십시오"
            else:
                lm, side = palmroi.landmarks(np.asarray(crop_to_S(im, cb), np.uint8))
                if lm is None:
                    note = "손 미검출 — 라벨 대상 제외 사유를 적으십시오"
                else:
                    hand = {'Left': 'L', 'Right': 'R'}.get(side, '')
        except Exception as e:                       # ★조용히 넘기지 않습니다
            note = f"읽기 실패: {type(e).__name__}"
        if note:
            nodet += 1
            rows.append(dict.fromkeys(COLS, ""))
            rows[-1].update(file=name, T1="T1-U", T2="T2-U", T3="T3-U",
                            confidence="low", note_uncertain=note)
        else:
            rows.append(dict.fromkeys(COLS, ""))
            rows[-1].update(file=name, hand=hand)

    with open(out, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=COLS); w.writeheader(); w.writerows(rows)

    print(f"★생성 {len(rows)}행 → {out}")
    print(f"★그중 ★손 미검출 {nodet}행은 ★U 로 미리 채웠습니다 (★행을 지우지 마십시오)")
    print("★★채우실 열: T1 · T2 · T3 · 눈금 7개 · t3_darkness · confidence")
    print("★  방법은 ★`천운_손금_라벨규칙_v2_2026-08-28.md` §3 을 보십시오")
    print("★  ★hand 는 MediaPipe 판정입니다 — ★맞는지 확인하고 틀리면 고치십시오")
    return 0


if __name__ == '__main__':
    if len(sys.argv) != 2:
        print(__doc__); sys.exit(2)
    try:
        sys.exit(main(sys.argv[1]))
    except GateFail as e:
        print(f"★★게이트 위반 — 중단합니다\n   {e}"); sys.exit(2)
