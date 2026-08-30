"""★★유형 라벨 보조 오버레이 — 「자」를 그립니다. ★「답」을 그리지 않습니다.
   (2026-08-28 · P-27 · ★적대적 감사 반영판)

★왜 필요한가
   T1·T2 는 「붙었는가/떨어졌는가」, T3 는 「중앙부인가·충분히 긴가」를 묻습니다.
   ★맨눈으로는 기준이 흔들립니다 ⟹ 자기 일치도가 떨어집니다.

★★「판정 밴드」를 그리면 ★순환논증이 됩니다
   ±30 % 같은 ★잠정 임계를 그려 놓고 제이가 그것을 보고 라벨하면,
   ★그 라벨로 임계를 맞추는 것은 ★자기가 그린 선을 자기가 다시 재는 것입니다.
   ⟹ ★균등 눈금(자)만 그립니다.
   ⟹ ★★눈금 위치를 ★잠정 임계와 ★어긋나게 잡았습니다 (감사 E-1)
      ★초판은 U 에 0.30, V 에 0.25 가 있어 ★T3_CENTER(±30 %)·T3_LEN(25 %)와 ★정확히 겹쳤습니다.
      ⟹ 지금은 ★5 % 에서 시작하는 10 % 사다리라 ★어떤 잠정 임계와도 겹치지 않습니다.

★★손바닥 다각형(ROI)을 ★그리지 않습니다 (감사 E-2)
   grow=1.12 다각형은 ★RLC 를 12/23 에서 잘라낸 ★우리 시스템의 결정 경계입니다.
   ★그것을 보여주면 라벨러가 그 밖의 주름을 「손바닥 밖」으로 간주하게 됩니다.

★★모델 출력을 절대 그리지 않습니다
   겹쳐 보이면 라벨이 ★모델 쪽으로 끌려갑니다(anchoring).
   ⟹ 이 파일은 `unet_np`·`pthread`·`metrics`·`harness` 를 ★import 하지 않습니다.

★★★P-41 해소 (2026-08-28) — ★harness 와 ★같은 좌표계를 씁니다
   ★초판은 ★원본을 MAX_SIDE 로 줄여 ★전체 이미지에서 랜드마크를 잡았고,
   `harness.infer` 는 ★손 영역을 crop 해 ★256×256 에서 잡았습니다.
   ★★실측(p41_frame.py · 24장): ★랜드마크 정규 좌표 차이가
      ★평균 3.1 % · ★장별 최대차 중앙값 8.5 % · ★최악 26 %,
      ★가로세로비(wid/hgt) 비율이 ★중앙값 0.927 이었습니다.
   ⟹ ★제이가 읽는 눈금 간격이 10 % 인데 ★한 눈금 통째로 어긋납니다.
   ⟹ ★그 눈금값으로 임계 초기 범위를 잡으면 ★계통 오차가 들어갑니다.

   ★★해소 방법: ★보정하지 않고 ★경로를 통일했습니다.
      ① `harness.crop_box` → `harness.crop_to_S` 로 ★harness 와 똑같이 256 을 만들고
      ② ★랜드마크를 ★그 256 에서 검출합니다 (엔진과 ★동일 조건)
      ③ 눈금 좌표를 ★256 격자에서 계산한 뒤 ★표시 배율로 옮겨 그립니다
   ⟹ ★★제이가 보는 눈금은 ★엔진이 쓰는 좌표계 ★그 자체입니다.
   ★부수 이득: crop 을 확대해 보여주므로 ★손금이 초판보다 ★더 크게 보입니다.

사용:
   python3 labelaid.py <이미지폴더> <출력폴더>
   ★출력폴더는 ★저장소 밖이어야 합니다 (생체정보 · 라벨규칙 v1 §5-5).
"""
import os, sys, glob
import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from palmroi import landmarks, palm_frame, WRIST   # noqa: F401

MAX_SIDE = 1400
# ★균등 눈금 — ★5 % 에서 시작하는 10 % 사다리. ★잠정 임계(0.18·0.25·0.30·0.62)와 겹치지 않습니다.
# ★U(가로 오프셋) 축의 잠정 임계: T3_CENTER 0.30 · ASSIGN_FATE_CU 0.18 · ASSIGN_RLC_CU 0.18
U_TICKS = (0.05, 0.15, 0.25, 0.35, 0.45)
# ★V(세로 길이) 축의 잠정 임계: T3_LEN 0.25 · ASSIGN_PTC_CV_LO 0.30 · ASSIGN_DTC_CV 0.62
#   ⟹ ★V 사다리는 ★8 % 에서 시작합니다. ★두 축의 시작점이 다른 것은 ★의도된 것입니다.
V_TICKS = (0.08, 0.18, 0.28, 0.38, 0.48, 0.58, 0.68, 0.78, 0.88, 0.98)


class OutsideRepoRequired(Exception):
    """★생체정보 파생물을 저장소 안에 쓰지 않습니다."""


def _repo_guard(outdir):
    """★.git 이 ★디렉터리든 ★파일(worktree·submodule)이든 잡습니다 (감사 E-4)."""
    cur = os.path.abspath(outdir)
    while True:
        if os.path.exists(os.path.join(cur, '.git')):
            raise OutsideRepoRequired(
                f"출력폴더가 git 저장소 안입니다: {cur}\n"
                "★손바닥 이미지 파생물은 저장소 밖에 두십시오 (라벨규칙 v1 §5-5).")
        nxt = os.path.dirname(cur)
        if nxt == cur: return
        cur = nxt


def overlay(img, lm, scale=(1.0, 1.0)):
    """★자만 그립니다: 세로축 + 균등 눈금. ★ROI 다각형도 판정 밴드도 없습니다.

    lm    : ★256 격자에서 검출한 랜드마크 (★엔진과 동일 조건 · P-41)
    scale : ★256 → 표시 이미지 배율 (sx, sy). ★비등방일 수 있습니다
            (crop 이 이미지 경계에서 잘리면 정사각형이 아닌 것을 256×256 으로 늘립니다)
    ★★눈금 좌표는 ★256 격자에서 계산한 뒤 ★배율만 곱해 옮깁니다 —
       ★표시 이미지에서 palm_frame 을 다시 계산하면 ★비등방 배율 탓에 좌표계가 어긋납니다.
    """
    d = ImageDraw.Draw(img, 'RGBA')
    u, v, wid, hgt = palm_frame(lm)
    o = lm[WRIST]
    sx, sy = scale

    def P(cu, cv):
        p = o + u*(cu*wid) + v*(cv*hgt)
        return (float(p[0])*sx, float(p[1])*sy)

    d.line([P(0, -0.05), P(0, 1.05)], fill=(0, 200, 255, 220), width=2)      # 세로축
    for t in U_TICKS:
        for s in (-1, 1):
            d.line([P(s*t, -0.02), P(s*t, 1.02)], fill=(0, 200, 255, 85), width=1)
            d.text(P(s*t, 1.06), f"{s*int(t*100):+d}", fill=(0, 200, 255, 235))
    for t in V_TICKS:
        d.line([P(-0.55, t), P(0.55, t)], fill=(255, 200, 0, 85), width=1)
        d.text(P(0.57, t), f"{int(t*100)}", fill=(255, 200, 0, 235))

    d.text((8, 8), "★자입니다. 판정선이 아닙니다 — 몇 %인지 '읽어서' 적으십시오.",
           fill=(255, 255, 255, 240))
    d.text((8, 24), "가로(청) = 중심선 거리 % · 세로(황) = 손바닥 길이 %",
           fill=(255, 255, 255, 200))
    return img


def render(path, outdir):
    """반환: (이름, 손 좌/우, 출력경로 또는 None, 사유) — ★슬롯을 섞지 않습니다 (감사 L).

    ★★P-41: ★harness 와 ★똑같은 crop→256 경로로 랜드마크를 잡습니다.
       ★`harness` 를 여기서 import 하는 것은 ★모델을 부르는 것이 아닙니다 —
       ★crop 기하 함수 2개만 씁니다. ★t_palmtype ⑧ 이 모델 모듈 미사용을 검사합니다.
    """
    _repo_guard(outdir)                       # ★import 경로로 들어와도 막힙니다 (감사 E-4)
    from harness import crop_box, crop_to_S, S as HS   # ★지연 import (순환 참조 회피)
    im = Image.open(path).convert('RGB')
    name = os.path.splitext(os.path.basename(path))[0]

    cb = crop_box(im)
    if cb is None:
        return name, None, None, "손바닥 영역 검출 실패 — ★harness 도 판독 불가로 처리합니다"
    lm, side = landmarks(np.asarray(crop_to_S(im, cb), np.uint8))   # ★엔진과 동일 조건
    if lm is None:
        return name, None, None, "손 미검출 — ★유형 라벨 대상에서 제외하고 사유를 적으십시오"

    x0, y0, box = cb
    disp = im.crop((x0, y0, min(im.width, x0+box), min(im.height, y0+box)))
    s = MAX_SIDE/max(disp.size)
    if s != 1: disp = disp.resize((max(1, int(disp.width*s)), max(1, int(disp.height*s))),
                                  Image.LANCZOS)
    out = os.path.join(outdir, f"{name}_ruler.jpg")
    overlay(disp, lm, scale=(disp.width/HS, disp.height/HS)).save(out, quality=92)
    return name, side, out, "OK"


def _collect(src):
    """★Windows 의 대소문자 비구분 glob 으로 ★중복 수집되는 것을 막습니다 (감사 E-5)."""
    seen, files = set(), []
    for e in ('*.jpg', '*.jpeg', '*.png', '*.JPG', '*.JPEG', '*.PNG'):
        for f in glob.glob(os.path.join(src, '**', e), recursive=True):
            k = os.path.normcase(os.path.abspath(f))
            if k in seen: continue
            if os.path.basename(f).endswith('_ruler.jpg'): continue
            seen.add(k); files.append(f)
    return sorted(files)


if __name__ == '__main__':
    if len(sys.argv) != 3:
        print(__doc__); sys.exit(2)
    src, dst = sys.argv[1], sys.argv[2]
    _repo_guard(dst)
    os.makedirs(dst, exist_ok=True)
    files = _collect(src)
    ok = 0
    for f in files:
        n, side, out, why = render(f, dst)
        print(f"{n:28s} {str(side):6s} {out or why}")
        ok += out is not None
    print(f"\n{ok}/{len(files)} 생성 → {dst}")
