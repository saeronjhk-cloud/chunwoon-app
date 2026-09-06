"""★★배정 결과 시각화 (2026-08-29 · ADR-002)

★★왜 필요한가 — ★배정률이 올랐다고 ★맞아진 것이 아닙니다.
   GT 가 없는 상태에서 ★「3대선 전부 배정」만 올리면
   ★엉뚱한 조각을 RLC 라 부르면서 ★숫자만 좋아질 수 있습니다.
   ⟹ ★라벨규칙 v2 §9-2 가 「배정률을 목적함수로 삼지 마라」고 적어 둔 그 함정입니다.
   ⟹ ★★그래서 ★눈으로 확인합니다. ★GT 없이 할 수 있는 ★유일한 검증입니다.

색: ★RLC 빨강 · PTC 초록 · DTC 파랑 · FATE 노랑 · NONE 회색

사용:
  python3 seeassign.py <출력폴더> [rule] [임계=값 ...]
  예) python3 seeassign.py D:\\ChunWoon_palm_dataset\\_assign v2 ASSIGN_DTC_CV=0.75 ASSIGN_RLC_SPAN=0.15

★캐시(sweep.py cache)가 있어야 합니다. ★출력은 ★저장소 밖이어야 합니다.
★★모든 출력은 ★dev 실험입니다 — 파일명에 NOT_A_VERDICT 가 붙습니다.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image, ImageDraw

import palmtype
import thresholds as TH
from sweep import load_cache
from labelaid import _repo_guard, OutsideRepoRequired

COLOR = {'RLC': (230, 60, 60), 'PTC': (60, 200, 90), 'DTC': (70, 130, 240),
         'FATE': (240, 200, 50), 'NONE': (130, 130, 130),
         # ★★ADR-003 — closed crease(RLC·PTC 공통 주름). ★자홍: 빨강(RLC)+파랑 계열의 섞임
         #   ★KeyError 방지용이 아니라 ★눈으로 구별하려고 넣습니다.
         palmtype.CLOSED: (200, 60, 200)}


def render(pred, lm, name, rule, mode="dev", min_pix=1):
    feats, comps = [], palmtype.components(pred, min_pix=min_pix)
    for _, pts in comps:
        feats.append(palmtype.frag_features(pts, lm))
    groups, why = palmtype.assign_fragments(feats, mode=mode, rule=rule)
    H, W = pred.shape
    img = np.zeros((H, W, 3), np.uint8)
    if groups is None:
        return Image.fromarray(img), why, {}
    owner = {}
    for k, idxs in groups.items():
        for i in idxs: owner[i] = k
    for (i, pts) in comps:
        c = COLOR[owner.get(i, 'NONE')]
        img[pts[:, 0], pts[:, 1]] = c
    im = Image.fromarray(img)
    d = ImageDraw.Draw(im)
    # ★손바닥 정규 좌표축을 옅게 — 어디가 노쪽인지 보이게
    u, v, wid, hgt = __import__('palmroi').palm_frame(lm)
    o = lm[0]
    P = lambda cu, cv: tuple(o + u*(cu*wid) + v*(cv*hgt))
    d.line([P(0, -0.05), P(0, 1.05)], fill=(80, 80, 80), width=1)
    d.text((4, 4), name[-12:], fill=(255, 255, 255))
    d.text((4, 16), " ".join(f"{k}{len(groups[k])}" for k in ('RLC', 'PTC', 'DTC', 'FATE')),
           fill=(255, 255, 255))
    return im, "OK", {k: len(v_) for k, v_ in groups.items()}


def main(outdir, rule, kv):
    _repo_guard(outdir)
    root = os.environ.get('CW_PALM_DATA', r'D:\ChunWoon_palm_dataset\A-smoke')
    preds, lms, names, sides = load_cache(root)
    if kv: TH.set_dev(kv)
    os.makedirs(outdir, exist_ok=True)
    print(f"★★NOT_A_VERDICT — dev 실험 시각화입니다. rule={rule} · dev={dict(TH.DEV)}")
    tile, cols = [], 6
    tot = dict.fromkeys(('RLC', 'PTC', 'DTC', 'FATE'), 0); three = 0
    for pred, lm, nm in zip(preds, lms, names):
        im, why, g = render(pred, lm, str(nm), rule)
        im.save(os.path.join(outdir, f"{os.path.splitext(str(nm))[0]}_assign_NOT_A_VERDICT.png"))
        tile.append(np.asarray(im))
        for k in tot:
            if g.get(k): tot[k] += 1
        if all(g.get(k) for k in ('RLC', 'PTC', 'DTC')): three += 1
    # ★대조 시트 — 한눈에 봅니다
    n = len(tile); rows = (n + cols - 1)//cols
    H, W = tile[0].shape[:2]
    sheet = np.zeros((rows*H, cols*W, 3), np.uint8)
    for i, t in enumerate(tile):
        r, c = divmod(i, cols); sheet[r*H:(r+1)*H, c*W:(c+1)*W] = t
    sp = os.path.join(outdir, "_contact_assign_NOT_A_VERDICT.png")
    Image.fromarray(sheet).save(sp)
    TH.clear_dev()
    print(f"★{n}장 → {outdir}")
    print(f"★대조 시트 → {sp}")
    print(f"★RLC {tot['RLC']} · PTC {tot['PTC']} · DTC {tot['DTC']} · FATE {tot['FATE']} · "
          f"★3대선 {three}/{n}")
    print("★★색이 ★해부학적으로 맞는 자리에 있는지 ★눈으로 확인하십시오 —")
    print("   ★RLC(빨강)는 ★엄지두덩을 감싸는 활 · ★DTC(파랑)는 ★손가락 쪽 가로 · "
          "★PTC(초록)는 ★그 아래 가로")


if __name__ == '__main__':
    a = sys.argv[1:]
    if not a: print(__doc__); sys.exit(2)
    rule = a[1] if len(a) > 1 and a[1] in ('v1', 'v2', 'tree') else 'tree'
    kv = {}
    for s in a:
        if '=' in s:
            k, v = s.split('=', 1); kv[k] = float(v)
    try:
        main(a[0], rule, kv)
    except OutsideRepoRequired as e:
        print(f"★★{e}"); sys.exit(2)
