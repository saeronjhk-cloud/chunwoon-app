"""★★COCO Segmentation → 우리 4클래스 마스크 (2026-08-29 · ADR-002)

★Roboflow `palmistry_seg` 의 클래스를 ★우리 클래스 표(라벨규칙 v1 §2-1)로 옮깁니다.

   life  → 1 RLC  (radial longitudinal crease · 생명선)
   head  → 2 PTC  (proximal transverse crease · 두뇌선)
   heart → 3 DTC  (distal transverse crease · 감정선)
   fate  → 4 FATE (우리 조작적 정의 · 운명선)
   ★겹침 우선순위 ★255 > 1 > 2 > 3 > 4 (라벨규칙 v1 §5-7 · 해부학 근거가 있는 선 우선)

★★정직하게 — ★이 라벨은 ★우리 라벨이 아닙니다 (TierA수집 v1 §5)
   · ★경계 정의(어디서 시작·끝나는가)가 ★문서화돼 있지 않습니다
   · ★끊긴 선 처리 규칙이 ★불명입니다
   · ★`255`(판정 불가)가 ★없습니다
   ⟹ ★★**학습에는 쓰되, ★출시 판정의 GT 로는 쓰지 마십시오.**
      ★판정 GT 는 ★우리 라벨(Tier-B)입니다.

사용:
  python3 coco2mask.py <C_train 루트> [--apply] [--vis <시각화폴더>]
  ★기본 dry-run. ★--apply 로만 파일을 씁니다 (intake.py 규율 준용).
"""
import sys, os, json
import numpy as np
from PIL import Image, ImageDraw

NAME2ID = {'life': 1, 'head': 2, 'heart': 3, 'fate': 4}
PRIORITY = [255, 1, 2, 3, 4]                       # ★낮은 인덱스가 우선
COLOR = {1: (230, 60, 60), 2: (60, 200, 90), 3: (70, 130, 240), 4: (240, 200, 50)}
SPLITS = ('train', 'valid', 'test')


def build_split(root, split, outdir, vis, apply_, limit_vis=8):
    p = os.path.join(root, split, '_annotations.coco.json')
    if not os.path.exists(p): return 0, 0, []
    with open(p, encoding='utf-8') as f: d = json.load(f)
    cat = {c['id']: c['name'] for c in d['categories']}
    img = {im['id']: im for im in d['images']}
    per = {}
    for a in d['annotations']:
        nm = cat.get(a['category_id'])
        if nm not in NAME2ID: continue           # ★'Palmistry' 더미 카테고리는 건너뜁니다
        per.setdefault(a['image_id'], []).append((NAME2ID[nm], a))

    ok, skip, samples = 0, 0, []
    if apply_: os.makedirs(os.path.join(outdir, split), exist_ok=True)
    for iid, anns in sorted(per.items()):
        im = img[iid]; W, H = im['width'], im['height']
        got = {v for v, _ in anns}
        if got != set(NAME2ID.values()):          # ★4선이 다 없으면 ★건너뜁니다 (fail-closed)
            skip += 1; continue
        m = Image.new('L', (W, H), 0)
        dr = ImageDraw.Draw(m)
        # ★우선순위 역순으로 그려 ★우선 클래스가 ★위에 남게 합니다
        for cls in reversed(PRIORITY):
            if cls == 255: continue
            for v, a in anns:
                if v != cls: continue
                for seg in (a.get('segmentation') or []):
                    if isinstance(seg, list) and len(seg) >= 6:
                        dr.polygon([tuple(x) for x in np.array(seg, float).reshape(-1, 2)],
                                   fill=cls)
        arr = np.asarray(m)
        if not (arr > 0).any():
            skip += 1; continue
        if apply_:
            base = os.path.splitext(im['file_name'])[0]
            Image.fromarray(arr).save(os.path.join(outdir, split, base + '_mask.png'))
        ok += 1
        if len(samples) < limit_vis:
            samples.append((os.path.join(root, split, im['file_name']), arr))
    return ok, skip, samples


def make_vis(samples, path):
    """★원본 위에 라벨을 겹쳐 ★경계 정의가 우리 규격과 맞는지 ★눈으로 봅니다."""
    tiles = []
    for src, arr in samples:
        try: base = Image.open(src).convert('RGB')
        except Exception: continue
        ov = np.asarray(base).copy()
        for cls, col in COLOR.items():
            ov[arr == cls] = col
        tiles.append(np.asarray(Image.fromarray(ov).resize((320, 320))))
    if not tiles: return None
    cols = 4; rows = (len(tiles)+cols-1)//cols
    sheet = np.zeros((rows*320, cols*320, 3), np.uint8)
    for i, t in enumerate(tiles):
        r, c = divmod(i, cols); sheet[r*320:(r+1)*320, c*320:(c+1)*320] = t
    Image.fromarray(sheet).save(path)
    return path


def main(root, apply_, vis):
    outdir = os.path.join(root, 'masks')
    print("★★NOT_A_VERDICT — 학습용 라벨 변환입니다.")
    print("★이 라벨은 ★우리 라벨이 아닙니다 — ★출시 판정 GT 로 쓰지 마십시오.\n")
    tot_ok = tot_skip = 0; allsam = []
    for s in SPLITS:
        ok, skip, sam = build_split(root, s, outdir, vis, apply_)
        tot_ok += ok; tot_skip += skip; allsam += sam[:3]
        print(f"{s:>6}: 변환 {ok:>4} · ★건너뜀 {skip:>3} (4선이 다 없는 장)")
    print(f"\n합계 변환 {tot_ok} · 건너뜀 {tot_skip}")
    if vis and allsam:
        p = make_vis(allsam, vis)
        print(f"★시각화 → {p}")
        print("★★확인하실 것: ★선이 ★실제 손금 고랑 위에 있는가 · "
              "★life(빨강)가 엄지두덩을 감싸는가 · ★heart(파랑)가 손가락 쪽인가")
    if not apply_:
        print("\n★dry-run 입니다. 실제로 쓰려면 ★--apply 를 붙이십시오.")
    else:
        print(f"\n★마스크 → {outdir}/<split>/*_mask.png")


if __name__ == '__main__':
    a = [x for x in sys.argv[1:] if not x.startswith('--')]
    if not a: print(__doc__); sys.exit(2)
    vis = None
    if '--vis' in sys.argv:
        i = sys.argv.index('--vis')
        vis = sys.argv[i+1] if i+1 < len(sys.argv) else None
    main(a[0], '--apply' in sys.argv, vis)
