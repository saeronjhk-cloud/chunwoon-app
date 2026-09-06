"""★★P-61 진단 — closed crease(RLC·PTC 공통 주름)를 현재 구조가 왜 표현 못 하는가

★배경: ★제이가 조각 라벨(2026-08-31)에서 ★1건을 `RLC & PTC` 로 표시하셨습니다.
   `_13.jpg` frag 0 — ★npix 328 = ★전 데이터셋 218조각 중 ★최대 (중앙값 12의 27배).
   ★이것이 Park 2010 의 ★Closed(한국인 최다수 패턴)입니다.

★이 스크립트가 확인하는 것 (★추측 금지 · 전부 실측)
   ① ★그 조각이 정말 ★하나의 연결성분인가 — 붙어서 하나로 나오는가
   ② ★그 조각 하나가 ★v3 규칙의 ★RLC 영역과 ★PTC 영역에 ★걸쳐 있는가 (straddle)
   ③ ★★straddle 판정의 ★오탐률 — ★양성 1건으로 ★민감도는 못 잽니다.
      ★그러나 ★음성 212건으로 ★특이도는 잴 수 있습니다. ★이것이 지금 가능한 유일한 평가입니다.
   ④ ★T2(기시부 결합)가 ★몇 장에서 ★구조적으로 판정 불가인가

★★NOT_A_VERDICT — mode='dev' 임계(Tier-C 유래)를 씁니다. 출시 판정에 쓸 수 없습니다.

사용:
    export CW_PALM_DATA="D:\\ChunWoon_palm_dataset\\A-smoke"
    export CW_PALM_FRAG="D:\\ChunWoon_palm_dataset\\_frag"
    python3 _v785_palm/probe/p61_closed.py [--nseg 2]
"""
import sys, os, csv, glob, argparse, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image

from harness import crop_box, crop_to_S, PALM_GROW
from pthread import load
from unet_np import forward
import palmroi, palmtype
import thresholds as TH
from ourtree import read_gt                      # ★P-68 — 스키마 판별을 한 곳에서만 합니다

MODE = "dev"
OK = {"RLC", "PTC", "DTC", "FATE", "NONE"}
# ★구 스키마(`RLC & PTC`) · 신 스키마(`CLOSED` · `EXCLUDED:CLOSED_UNTRAINABLE`) 전부 받습니다
CLOSED_TAGS = {"RLC & PTC", "CLOSED", "EXCLUDED:CLOSED_UNTRAINABLE"}


def v3_class(u_max, v_max, t):
    """★v3 규칙 그대로 (palmtype.assign_fragments rule='v3'). ★새 임계를 만들지 않습니다."""
    if u_max > t["dtc"]:
        return "DTC"
    if v_max > t["mid"]:
        return "RLC" if u_max <= t["rlc"] else "PTC"
    if v_max <= t["low"]:
        return "NONE"
    return "FATE"


def segments(pix, nseg):
    """조각을 ★주축 방향으로 nseg 등분. 반환: 각 구간의 픽셀 인덱스."""
    c = pix.mean(0)
    p0 = pix - c
    if len(p0) < 2:
        return [np.arange(len(pix))]
    vec = np.linalg.svd(p0, full_matrices=False)[2][0]
    t = p0 @ vec
    lo, hi = t.min(), t.max()
    if hi - lo <= 0:
        return [np.arange(len(pix))]
    edges = np.linspace(lo, hi, nseg + 1)
    out = []
    for i in range(nseg):
        m = (t >= edges[i]) & (t <= edges[i + 1]) if i == nseg - 1 else (t >= edges[i]) & (t < edges[i + 1])
        if m.sum():
            out.append(np.where(m)[0])
    return out


def find_gt(root):
    """★정답 CSV 경로. ★P-68 이후 `frag_gt_v3.csv` 가 정본입니다."""
    for cand in ("frag_gt_v3.csv", "frag_gt(수정).csv", "frag_gt.csv"):
        p = os.path.join(root, cand)
        if os.path.exists(p):
            return p
    raise SystemExit(f"★정답 CSV 가 없습니다: {root}")


def main():
    ap = argparse.ArgumentParser()
    # ★★아래 둘은 ★임계입니다 (G-7 대상 · 아직 레지스트리에 없습니다).
    #   ★그래서 이 스크립트는 ★dev 진단 전용이고 ★결과를 verdict 로 쓸 수 없습니다.
    #   ★승격하려면 STRADDLE_NSEG · STRADDLE_MINPIX 로 등록해야 합니다 (ADR-003 §4-2).
    ap.add_argument("--nseg", type=int, default=2)
    ap.add_argument("--minpix", type=int, default=8,
                    help="★임계입니다. 이보다 작은 조각은 straddle 검사 제외")
    a = ap.parse_args()

    root = os.environ.get("CW_PALM_DATA")
    frag = os.environ.get("CW_PALM_FRAG")
    ckpt = os.environ.get("CW_PALM_CKPT", "palm-api/checkpoint_aug_epoch70.pth")
    gp = find_gt(frag)
    gtmap = read_gt(gp)
    print(f"★정답 파일: {os.path.basename(gp)}")

    t = dict(dtc=TH.get("V3_UMAX_DTC", MODE), rlc=TH.get("V3_UMAX_RLC", MODE),
             mid=TH.get("V3_VMAX_MID", MODE), low=TH.get("V3_VMAX_LOW", MODE))
    print("★NOT_A_VERDICT — dev 임계(Tier-C 유래). 출시 판정 불가.")
    print(f"v3 임계: {t}\n")

    sd = load(ckpt)
    imgs = sorted(glob.glob(os.path.join(root, "**", "*.jpg"), recursive=True))
    imgs = [i for i in imgs if "/masks/" not in i.replace("\\", "/")]

    rows = []
    per_img = collections.defaultdict(collections.Counter)
    for p in imgs:
        im = Image.open(p).convert("RGB")
        cb = crop_box(im)
        if cb is None:
            continue
        rgb = np.asarray(crop_to_S(im, cb), np.float32)
        roi, lm, side = palmroi.palm_roi(rgb, grow=PALM_GROW)
        if roi is None:
            continue
        lg = forward(np.ascontiguousarray(rgb.transpose(2, 0, 1) / 255.), sd)
        pred = (1 / (1 + np.exp(-lg)) > 0.5) & roi
        base = os.path.basename(p)
        for i, (_, pts) in enumerate(palmtype.components(pred)):
            g = gtmap.get((base, i))
            if g is None:
                continue
            f = palmtype.frag_features(pts, lm)
            if g in OK:
                per_img[base][g] += 1
            whole = v3_class(f["u_max"], f["v_max"], t)
            segs, wid, hgt = [], f["wid"], f["hgt"]
            if f["npix"] >= a.minpix and not f["degenerate"]:
                for idx in segments(f["pix"], a.nseg):
                    du, dv = f["pix"][idx, 0], f["pix"][idx, 1]
                    segs.append(v3_class(du.max() / wid, dv.max() / hgt, t))
            rows.append(dict(file=base, fid=i, gt=g, npix=f["npix"], whole=whole,
                             segs=segs, straddle=(set(segs) >= {"RLC", "PTC"}),
                             disagree=(len(set(segs)) > 1)))

    # ── ① 표시된 CLOSED 조각
    print("─" * 78)
    print("① ★제이가 공통 주름으로 표시한 조각")
    print("   ★주의: `components()` 가 8-연결 성분을 내므로 ★「한 조각 = 한 연결성분」은")
    print("   ★정의상 참이지 측정 결과가 아닙니다. ★여기서 재는 것은 ★걸침(straddle)뿐입니다.")
    hit = 0
    for r in rows:
        if r["gt"] in CLOSED_TAGS:
            hit += 1
            print(f"   {r['file']} frag {r['fid']} · gt={r['gt']} · npix {r['npix']}")
            print(f"   전체 v3 판정 = {r['whole']}   구간별({a.nseg}등분) = {r['segs']}")
            print(f"   ★RLC·PTC 걸침(straddle) = {'★예' if r['straddle'] else '아니오'}")
    if not hit:
        print(f"   ★해당 조각이 없습니다 (찾는 값: {sorted(CLOSED_TAGS)})")

    # ── ② straddle 오탐 (특이도)
    print("─" * 78)
    print(f"② ★straddle 판정의 오탐 — 단일 클래스 정답 {sum(1 for r in rows if r['gt'] in OK)}건 기준")
    fp = collections.Counter(r["gt"] for r in rows if r["gt"] in OK and r["straddle"])
    tested = sum(1 for r in rows if r["gt"] in OK and r["segs"])
    print(f"   검사 대상(npix>={a.minpix}, 비퇴화) {tested}건 · ★오탐 {sum(fp.values())}건"
          f" ({sum(fp.values())/max(tested,1)*100:.1f} %)")
    for k, v in fp.most_common():
        print(f"      {k:5} {v}")
    print("   ★양성이 1건뿐이므로 ★민감도는 잴 수 없습니다 (원칙 4).")

    # ── ③ npix 상위
    print("─" * 78)
    print("③ ★npix 상위 8 — 병합 조각은 크기로 드러나는가")
    for r in sorted(rows, key=lambda r: -r["npix"])[:8]:
        print(f"   {r['file']:44} f{r['fid']:<3} npix {r['npix']:>4}  gt={r['gt']:10} "
              f"straddle={'Y' if r['straddle'] else '.'}")

    # ── ④ T2 구조적 판정 가능 여부 (★정답 기준 — 규칙이 완벽해도 이 이상 못 갑니다)
    print("─" * 78)
    print("④ ★T2(기시부 결합) 상한 — ★정답 조각 기준으로 RLC·PTC 가 둘 다 있는 장")
    both = sum(1 for c in per_img.values() if c["RLC"] and c["PTC"])
    n = len(per_img)
    print(f"   {both}/{n} 장 ({both/max(n,1)*100:.0f} %) — 나머지는 ★배정이 완벽해도 T2-U 입니다")
    for f in sorted(per_img):
        c = per_img[f]
        if not (c["RLC"] and c["PTC"]):
            print(f"      X {f}  RLC={c['RLC']} PTC={c['PTC']}")


if __name__ == "__main__":
    main()
