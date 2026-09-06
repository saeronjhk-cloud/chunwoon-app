"""★★조각 라벨 도구 — ★우리 도메인의 ★배정 정답을 만듭니다 (2026-08-29 · P-58)

★★왜 필요한가
   ★배정 트리(P-53)는 ★Roboflow 박스 라벨(스튜디오 흰 배경)로 학습됐습니다.
   ★그런데 ★우리 도메인(제이 손 · 폰 사진 · 손이 누움)에서 ★맞는지 ★확인할 정답이 ★없습니다.
   ★시각화에서 ★DTC 가 ★엄지두덩 쪽에 배정되는 장이 여럿 보였는데,
   ★그것이 ★진짜 오류인지 ★눈의 착각인지 ★가릴 방법이 없습니다.
   ⟹ ★★제이가 ★조각마다 ★어느 선인지만 적어 주시면 ★그 정답이 생깁니다.

★★제이 부담을 최소화하는 설계 (고정 원칙 1)
   · ★`gt` 열을 ★트리 예측으로 ★미리 채웁니다
   · ★제이는 ★**틀린 것만 고치면** 됩니다 (정확도 ~76 % 라면 ★1/4 만 손봅니다)
   · ★조각마다 ★번호가 이미지에 찍혀 있습니다

★NOT_A_VERDICT — 산출물은 ★배정 정답이지 ★출시 판정이 아닙니다.

사용:
  ① 생성:  python3 fraglabel.py make <출력폴더>
  ② (제이가 CSV 의 gt 열을 고침)
  ③ 채점:  python3 fraglabel.py score <출력폴더>
"""
import sys, os, csv, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image, ImageDraw, ImageFont

from harness import crop_box, crop_to_S, S, PALM_GROW, detect_tier, gate_checks, GateFail
from pthread import load
from unet_np import forward
import palmroi, palmtype
from labelaid import _repo_guard, OutsideRepoRequired

COLOR = {'RLC': (235, 70, 70), 'PTC': (70, 210, 100), 'DTC': (80, 140, 250),
         'FATE': (245, 205, 60), 'NONE': (150, 150, 150),
         # ★★ADR-003 — closed crease. ★규칙이 아직 이 값을 내지 않으므로 지금은 쓰이지 않습니다.
         palmtype.CLOSED: (205, 70, 205)}
ZOOM = 3                       # 256 → 768. ★번호가 읽히도록
# ★★P-68 (2026-08-31) — ★정답은 `gt` 열입니다. `note` 는 ★비고입니다.
#   ★구판은 `note` 가 정답 채널이 돼 있었고, ★오타 하나로 표본이 조용히 줄어들었습니다.
#   ★`exclude=Y` 로 ★제외를 ★명시하십시오 (이유는 `exclude_reason`).
COLS = ['file', 'frag_id', 'pred_tree', 'gt', 'exclude', 'exclude_reason', 'note',
        'npix', 'cu', 'cv', 'u_max', 'v_max', 'ang_v_deg']


def _font(sz):
    for p in ('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
              'C:/Windows/Fonts/arialbd.ttf'):
        if os.path.exists(p):
            try: return ImageFont.truetype(p, sz)
            except Exception: pass
    return ImageFont.load_default()


def make(root, outdir, ckpt):
    tier = detect_tier(root); gate_checks(root, tier)
    _repo_guard(outdir); os.makedirs(outdir, exist_ok=True)
    sd = load(ckpt)
    imgs = sorted(glob.glob(os.path.join(root, '**', '*.jpg'), recursive=True))
    imgs = [i for i in imgs if '/masks/' not in i.replace('\\', '/')]
    fnt = _font(22); rows = []; nimg = 0

    for p in imgs:
        im = Image.open(p).convert('RGB')
        cb = crop_box(im)
        if cb is None: continue
        crop = crop_to_S(im, cb)
        rgb = np.asarray(crop, np.float32)
        roi, lm, side = palmroi.palm_roi(rgb, grow=PALM_GROW)
        if roi is None: continue
        lg = forward(np.ascontiguousarray(rgb.transpose(2, 0, 1)/255.), sd)
        pred = (1/(1+np.exp(-lg)) > 0.5) & roi

        comps = palmtype.components(pred)
        feats = [palmtype.frag_features(pts, lm) for _, pts in comps]
        groups, why = palmtype.assign_fragments(feats, mode="dev", rule="tree")
        owner = {}
        if groups:
            for k, idxs in groups.items():
                for i in idxs: owner[i] = k

        # ★배경 = 원본 crop 을 어둡게. ★조각 색이 잘 보이게
        base = np.asarray(crop, np.float32)*0.45
        ov = base.astype(np.uint8).copy()
        for i, (_, pts) in enumerate(comps):
            ov[pts[:, 0], pts[:, 1]] = COLOR[owner.get(i, 'NONE')]
        big = Image.fromarray(ov).resize((S*ZOOM, S*ZOOM), Image.NEAREST)
        d = ImageDraw.Draw(big)
        name = os.path.splitext(os.path.basename(p))[0]
        for i, (_, pts) in enumerate(comps):
            cy, cx = pts[:, 0].mean()*ZOOM, pts[:, 1].mean()*ZOOM
            t = str(i)
            d.text((cx+2, cy+2), t, fill=(0, 0, 0), font=fnt)
            d.text((cx, cy), t, fill=(255, 255, 255), font=fnt)
            f = feats[i]
            rows.append({'file': os.path.basename(p), 'frag_id': i,
                         'pred_tree': owner.get(i, 'NONE'), 'gt': owner.get(i, 'NONE'),
                         'exclude': 'N', 'exclude_reason': '',
                         'note': '', 'npix': f['npix'],
                         'cu': round(f['cu'], 3), 'cv': round(f['cv'], 3),
                         'u_max': round(f['u_max'], 3), 'v_max': round(f['v_max'], 3),
                         'ang_v_deg': ('' if f['degenerate'] else round(f['ang_v_deg'], 1))})
        # ★한글 폰트가 없는 환경이 있어 ★범례를 ★색 견본 + 영문으로 그립니다
        d.text((8, 8), f"{name[-14:]}   fragments: {len(comps)}",
               fill=(255, 255, 255), font=fnt)
        x = 8; f2 = _font(20)
        for k in ('RLC', 'PTC', 'DTC', 'FATE', 'NONE'):
            d.rectangle([x, 40, x+22, 60], fill=COLOR[k], outline=(255, 255, 255))
            d.text((x+27, 40), k, fill=(255, 255, 255), font=f2)
            x += 27 + int(d.textlength(k, font=f2)) + 16
        big.save(os.path.join(outdir, f"{name}_frag.jpg"), quality=90)
        nimg += 1

    cp = os.path.join(outdir, 'frag_gt.csv')
    with open(cp, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=COLS); w.writeheader(); w.writerows(rows)
    print(f"★이미지 {nimg}장 · 조각 {len(rows)}개 → {outdir}")
    print(f"★입력표 → {cp}")
    print("★★제이가 하실 것: ★`gt` 열이 ★트리 예측으로 ★미리 채워져 있습니다.")
    print("   ★이미지를 보고 ★**틀린 것만** 고치십시오 (RLC / PTC / DTC / FATE / NONE).")
    print("   ★★정답은 ★반드시 `gt` 열에 적으십시오 — ★`note` 는 ★비고입니다 (P-68).")
    print("   ★생명선과 두뇌선이 ★한 조각으로 붙어 있으면 ★`CLOSED` 입니다 (ADR-003).")
    print("   ★못 정하겠으면 ★`exclude` 를 `Y` 로, ★`exclude_reason` 에 이유를 적으십시오.")
    print("   ★잡음·잔주름·손가락 주름은 ★`NONE` 입니다.")


def score(outdir):
    # ★★P-68 — 정본은 `frag_gt_v3.csv`(gt 열 · exclude 열). 없으면 구 파일로 후퇴합니다.
    cp = None
    for cand in ('frag_gt_v3.csv', 'frag_gt(수정).csv', 'frag_gt.csv'):
        if os.path.exists(os.path.join(outdir, cand)):
            cp = os.path.join(outdir, cand); break
    if cp is None: raise SystemExit(f"★정답 CSV 가 없습니다: {outdir}")
    print(f"★정답 파일: {os.path.basename(cp)}")
    rows = list(csv.DictReader(open(cp, encoding='utf-8-sig')))

    # ★제외를 ★명시 열로 봅니다. ★구 스키마에는 이 열이 없으므로 전부 포함됩니다.
    nex = sum(1 for r in rows if r.get('exclude', 'N').strip().upper() == 'Y')
    if nex:
        why = {}
        for r in rows:
            if r.get('exclude', 'N').strip().upper() == 'Y':
                k = r.get('exclude_reason', '').strip() or 'UNSPECIFIED'
                why[k] = why.get(k, 0) + 1
        print(f"★제외 {nex}건: {why}")
    rows = [r for r in rows if r.get('exclude', 'N').strip().upper() != 'Y']

    y = np.array([r['gt'].strip().upper() for r in rows], dtype=object)
    p = np.array([r['pred_tree'].strip().upper() for r in rows], dtype=object)
    ok = np.array([v in COLOR for v in y])
    if not ok.all():
        bad = sorted({v for v in y[~ok]})
        print(f"★★허용되지 않는 gt 값 {len(y)-ok.sum()}건: {bad}")
        print("   ★RLC / PTC / DTC / FATE / NONE / CLOSED 중 하나여야 합니다")
        print("   ★못 정하겠으면 ★gt 를 고치지 말고 ★exclude=Y 로 두십시오"); return
    from bench_assign import report
    print("★★NOT_A_VERDICT — ★우리 도메인(Tier-A) 배정 정답 대비 채점")
    print(f"★조각 {len(y)}개 · 제이가 고친 것 {int((y != p).sum())}개")
    report("배정 트리 (P-53) — 우리 도메인", p, y)
    print("\n★★비교: ★Roboflow 박스 GT(스튜디오)에서는 ★76.6 % / F1 0.771 이었습니다.")
    print("   ★여기서 크게 떨어지면 ★도메인 격차가 실재하는 것입니다 (P-58).")


if __name__ == '__main__':
    a = [x for x in sys.argv[1:] if not x.startswith('--')]
    root = os.environ.get('CW_PALM_DATA', r'D:\ChunWoon_palm_dataset\A-smoke')
    if not a: print(__doc__); sys.exit(2)
    try:
        if a[0] == 'make':
            make(root, a[1] if len(a) > 1 else r'D:\ChunWoon_palm_dataset\_frag',
                 os.environ.get('CW_PALM_CKPT', 'palm-api/checkpoint_aug_epoch70.pth'))
        elif a[0] == 'score':
            score(a[1] if len(a) > 1 else r'D:\ChunWoon_palm_dataset\_frag')
        else: print(__doc__); sys.exit(2)
    except (GateFail, OutsideRepoRequired) as e:
        print(f"★★중단합니다\n   {e}"); sys.exit(2)
