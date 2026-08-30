"""★★P-9 — labelme JSON → 마스크 PNG 생성 (2026-08-28)
   ★★P-43 해소 포함 — 「폭 3단계(원본)」와 「평가 해상도 256 고정」의 충돌.

사용:
  python3 mask_from_labelme.py <라벨폴더> <이미지폴더> <출력폴더>          ← ★dry-run(기본)
  python3 mask_from_labelme.py <라벨폴더> <이미지폴더> <출력폴더> --apply  ← ★실제로 씁니다

★★기본이 dry-run 입니다 (intake.py 와 같은 패턴). `--apply` 없이는 파일을 한 개도 쓰지 않습니다.
★★출력폴더는 ★저장소 밖이어야 합니다 — 생체정보 파생물입니다 (라벨규칙 v1 §5-5).
   ⟹ `labelaid._repo_guard` 를 ★그대로 재사용합니다 (두 벌 구현하지 않습니다).

────────────────────────────────────────────────────────────────────────────
★★임계 규율
   ★이 스크립트에는 ★판정 임계가 ★하나도 없습니다. `thresholds.py` 를 import 하지 않습니다.
   ★아래 상수들은 ★임계가 아니라 ★「라벨 규격」입니다 — 문서에 명문화된 값이며 ★출처를 병기합니다.
   ★규격이 아닌 값을 여기에 새로 적지 마십시오. 임계가 필요해지면 `thresholds.py` 로 가십시오.

★★P-43 — 폭 규격 충돌을 어떻게 해소했는가
   문제 : 라벨규칙 v1 §5-4 의 폭 3단계(0.8/1.5/2.5 % × W)는 ★원본 해상도 기준인데,
          §5-7 은 2026-08-25 번복으로 ★평가 해상도를 256×256 으로 고정했습니다.
          256 격자에서는 crop 내 W ≈ 100 px 이라 3단계가 ★전부 최소 3px 로 붕괴합니다
          (§5-7 붕괴 표가 이미 176×176 에서 3/3/3 px 을 보여줍니다).
   해결 : ★마스크를 ★두 벌 냅니다. ★한 벌을 리사이즈해 다른 벌을 만들지 ★않습니다.
     (a) `<name>_mask.png`     — ★원본 해상도. 폭 3단계 ★보존. 아카이브 · Phase 1.5 재학습용
     (b) `<name>_mask256.png`  — ★256×256 평가용. ★harness 와 ★똑같은 crop+resize 격자
   ★(b)는 ★폴리라인 좌표를 crop 기준으로 옮겨 스케일한 뒤 ★256 격자에서 W 를 다시 재어
     ★그 격자에서 직접 그립니다. ⟹ ★얇은 선이 NEAREST 리사이즈로 사라지지 않습니다.
   ★(b)에서 폭이 사실상 3/3/3 px 로 수렴하는 것은 ★정상입니다 —
     Phase0실측 §4 에서 ★모델 출력 선 폭도 ~3px 고정이므로 ★두 폭 정의가 오히려 맞아떨어집니다.
     ⟹ ★256 격자에서는 폭이 「정보」가 아닙니다. ★폭 정보는 (a)에만 살아 있습니다.
   ★crop 변환은 `harness.crop_box` · `harness.crop_to_S` 를 ★import 해서 씁니다.
     ★따로 구현하면 언젠가 어긋나고, 그러면 ★GT 와 예측이 ★다른 격자에 놓입니다.
   ★(b)의 랜드마크는 ★crop 된 256 이미지에서 ★다시 검출합니다 (`harness.infer` 와 동일 조건).

★★이 스크립트가 ★보증하지 못하는 것 (정직하게)
   · ★실제 labelme JSON 으로 돌린 적이 ★없습니다 (2026-08-28 현재 라벨이 아직 없습니다).
     ⟹ 검증은 ★합성 JSON 으로만 했습니다 (`t_mask.py`).
   · ★(a)의 W 는 ★원본을 LM_MAX_SIDE 로 줄여 검출한 랜드마크를 ★되스케일한 값입니다.
     ⟹ ★원본 그대로 검출했을 때와 같은 값이라는 보장은 ★없습니다 — ★미확인 (P-41 과 같은 종류).
   · ★(a)의 W 와 (b)의 W 는 ★서로 다른 MediaPipe 추정입니다. ★일치를 보증하지 않습니다.
     ⟹ 그래서 ★둘을 각각 재고, ★각각의 격자에서 폭을 계산합니다 (환산하지 않습니다).
   · ★라벨 「내용」이 맞는지는 ★검사하지 않습니다. 형식·규격만 봅니다.
   · ★`ignore_ratio` 의 분모(손바닥 영역)는 ★harness 와 같은 ROI 다각형(grow=1.12)이며,
     ★그 ROI 자체가 RLC 를 자른 전력이 있습니다(유형체계 §11-4). ⟹ ★분모가 보수적입니다.
"""
import sys, os, json, glob

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np
from PIL import Image, ImageDraw

# ★crop 변환은 ★반드시 harness 것을 씁니다 (P-43 · 격자 일치의 유일한 보장)
from harness import crop_box, crop_to_S, S, PALM_GROW
from palmroi import landmarks, palm_frame, palm_polygon, _inside
# ★저장소 가드는 ★재사용합니다 — 두 벌 구현하면 한 쪽만 고쳐집니다
from labelaid import _repo_guard, OutsideRepoRequired, MAX_SIDE as LM_MAX_SIDE

# ─────────────────────────────────────────────────────────────────────────────
# ★라벨 「규격」 상수 — ★임계가 아닙니다. ★전부 출처가 있습니다.
# ─────────────────────────────────────────────────────────────────────────────
# 출처: 라벨규칙 v1 §2-1 클래스 표 (「이 표가 정본입니다」)
CLASS_ID = {"RLC": 1, "PTC": 2, "DTC": 3, "FATE": 4}
IGNORE_ID = 255

# 출처: 라벨규칙 v1 §5-7 —「겹침 금지 · 픽셀당 클래스 하나. 겹치면 우선순위 255 > 1 > 2 > 3 > 4」
#   ★FATE 가 최하위인 이유: 해부학 근거가 있는 선을 우선합니다 (§2-3-4).
#   ★255 가 최상위인 이유: 모르는 곳을 아는 척하지 않기 위해서입니다 (§5-7 말미).
PRIORITY = (IGNORE_ID, 1, 2, 3, 4)          # ★앞에 올수록 강합니다

# 출처: 라벨규칙 v1 §5-4 폭 확장 규칙
#   W = MediaPipe 기준 「검지 MCP ↔ 새끼 MCP」 픽셀 거리
#   thin 0.8 % · medium 1.5 % · thick 2.5 % · ★최소 3px 보장
#   ★W 는 `palmroi.palm_frame(lm)` 이 반환하는 `wid` 와 ★같은 정의입니다 — 그 함수를 씁니다.
WIDTH_PCT = {"thin": 0.008, "medium": 0.015, "thick": 0.025}
MIN_WIDTH_PX = 3

# 출처: 라벨규칙 v1 §4-6 —「한 장에서 255 가 손바닥 영역의 15% 초과면 폐기·재촬영」
#   ★이것은 ★판정 임계가 아니라 ★재촬영 기준입니다. ★경고만 냅니다 (사람이 결정합니다).
IGNORE_MAX_RATIO = 0.15

# 출처: 라벨규칙 v1 §5-3 labelme 실사양 — 라벨명에 폭을 인코딩 · ★허용값 13개
WIDTH_TAGS = ("thin", "medium", "thick")
ALLOWED_LABELS = {f"{c}_{w}" for c in CLASS_ID for w in WIDTH_TAGS} | {"IGNORE"}
assert len(ALLOWED_LABELS) == 13, "★§5-3 은 허용 label 을 13개로 못박습니다"
KIND_OF = {**{lab: "linestrip" for lab in ALLOWED_LABELS if lab != "IGNORE"},
           "IGNORE": "polygon"}

# ★처리 파라미터 — ★판정 임계가 아닙니다.
#   원본을 그대로 MediaPipe 에 넣지 않기 위한 축소 상한입니다.
#   ★`labelaid.MAX_SIDE` 를 ★그대로 씁니다 — 두 스크립트가 다른 값을 쓰면 W 가 갈라집니다.


class LabelSpecError(Exception):
    """★라벨 JSON 이 규격(라벨규칙 v1 §5-3)을 어겼습니다. ★조용히 무시하지 않습니다."""


class MaskBuildError(Exception):
    """★마스크를 만들 수 없습니다 (손 미검출 등). ★fail-closed — 마스크를 만들지 않습니다."""


# ─────────────────────────────────────────────────────────────────────────────
def width_px(tag, W):
    """★폭 3단계 → 픽셀 (라벨규칙 v1 §5-4).

    ★내림(int)을 씁니다 — §5-7 붕괴 표의 「원본 W≈1500 → 12 / 22 / 37 px」과 맞습니다
      (0.015×1500 = 22.5 → 22, 0.025×1500 = 37.5 → 37).
    """
    if tag not in WIDTH_PCT:
        raise LabelSpecError(f"알 수 없는 폭 태그: {tag!r} — {WIDTH_TAGS} 중 하나여야 합니다")
    return max(MIN_WIDTH_PX, int(WIDTH_PCT[tag] * float(W)))


def parse_label(lab):
    """`RLC_medium` → (1, 'medium') · `IGNORE` → (255, None). ★허용값 밖이면 실패합니다."""
    if lab not in ALLOWED_LABELS:
        raise LabelSpecError(
            f"허용되지 않은 label 입니다: {lab!r}\n"
            f"  ★라벨규칙 v1 §5-3 허용값 13개: {sorted(ALLOWED_LABELS)}\n"
            f"  ★오타를 조용히 무시하면 그 선이 통째로 배경이 됩니다 — 실패로 처리합니다.")
    if lab == "IGNORE":
        return IGNORE_ID, None
    cls, tag = lab.rsplit("_", 1)
    return CLASS_ID[cls], tag


def read_labelme(js_path):
    """labelme JSON 을 읽고 ★규격을 강제합니다. 반환: (shapes, imagePath, (W,H) 또는 None)

    ★끊긴 선은 ★조각마다 별도 shape 입니다 (§5-3·§4-1). ★여기서 ★절대 이어 붙이지 않습니다 —
      shape 를 ★그대로 하나씩 들고 나갑니다. 같은 label 이 여러 번 나오는 것이 ★정상입니다.
    """
    with open(js_path, encoding='utf-8') as f:
        d = json.load(f)
    if not isinstance(d, dict):
        raise LabelSpecError("JSON 최상위가 객체가 아닙니다")
    shapes = d.get("shapes")
    if not isinstance(shapes, list) or not shapes:
        raise LabelSpecError("`shapes` 가 없거나 비었습니다 — ★빈 라벨은 「선이 없다」와 다릅니다 (§4-7)")
    out = []
    for i, s in enumerate(shapes):
        if not isinstance(s, dict):
            raise LabelSpecError(f"shapes[{i}] 가 객체가 아닙니다")
        lab = s.get("label")
        cid, tag = parse_label(lab)                       # ★허용값 밖이면 여기서 실패합니다
        kind = s.get("shape_type")
        if kind != KIND_OF[lab]:
            raise LabelSpecError(
                f"shapes[{i}] label={lab!r} 의 shape_type 이 {kind!r} 입니다 — "
                f"§5-3 은 {KIND_OF[lab]!r} 로 못박습니다")
        pts = s.get("points")
        if not isinstance(pts, list):
            raise LabelSpecError(f"shapes[{i}] points 가 리스트가 아닙니다")
        need = 3 if kind == "polygon" else 2
        if len(pts) < need:
            raise LabelSpecError(f"shapes[{i}] label={lab!r} 점이 {len(pts)}개입니다 — 최소 {need}개")
        try:
            p = [(float(a), float(b)) for a, b in pts]
        except Exception as e:
            raise LabelSpecError(f"shapes[{i}] points 형식 오류: {e}")
        out.append(dict(idx=i, label=lab, cls=cid, wtag=tag, kind=kind, pts=p))
    size = None
    if d.get("imageWidth") and d.get("imageHeight"):
        size = (int(d["imageWidth"]), int(d["imageHeight"]))
    return out, (d.get("imagePath") or ""), size


# ─────────────────────────────────────────────────────────────────────────────
def render(shapes, size, W, xform=None):
    """폴리라인·폴리곤을 ★클래스 마스크(uint8)로 굽습니다.

    size  : (가로, 세로) 출력 격자
    W     : ★그 격자에서 잰 손바닥 폭 (palm_frame 의 wid). ★폭은 이 격자에서 계산합니다
    xform : 점 변환 함수 (None 이면 항등). ★256 판에서 crop+resize 를 적용할 때 씁니다

    반환: (mask, widths, n_out) — widths 는 태그별 실제 픽셀 폭, n_out 은 격자 밖 점 수
    """
    Wg, Hg = size
    f = xform or (lambda p: p)
    layers, widths, n_out = {}, {}, 0

    for sh in shapes:
        pts = [f(p) for p in sh["pts"]]
        n_out += sum(1 for x, y in pts if not (0 <= x < Wg and 0 <= y < Hg))
        lay = layers.get(sh["cls"])
        if lay is None:
            lay = layers[sh["cls"]] = Image.new("L", (Wg, Hg), 0)
        d = ImageDraw.Draw(lay)
        if sh["kind"] == "polygon":
            d.polygon(pts, fill=255)                       # ★IGNORE 는 면으로 칠합니다
        else:
            w = width_px(sh["wtag"], W)
            widths[sh["wtag"]] = w
            # ★joint='curve' 는 꺾임에서 폭이 얇아지는 것을 막습니다 (폭 태그의 의미 보존)
            d.line(pts, fill=255, width=w, joint="curve" if w > 1 else None)

    m = np.zeros((Hg, Wg), np.uint8)
    # ★우선순위가 ★낮은 것부터 칠하고 ★높은 것이 덮어씁니다 (§5-7 · 255 > 1 > 2 > 3 > 4)
    for cid in reversed(PRIORITY):
        lay = layers.get(cid)
        if lay is None:
            continue
        m[np.asarray(lay, np.uint8) > 0] = cid
    return m, widths, n_out


def _lm_original(im):
    """★원본 해상도 랜드마크. 원본을 LM_MAX_SIDE 로 줄여 검출한 뒤 ★되스케일합니다.

    ★한계: 원본 그대로 검출했을 때와 같다는 보장은 ★없습니다 (P-41 과 같은 종류의 미확인).
    """
    s = LM_MAX_SIDE / max(im.size)
    small = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))),
                      Image.LANCZOS) if s < 1 else im
    lm, side = landmarks(np.asarray(small.convert("RGB"), np.uint8))
    if lm is None:
        return None, None
    k = im.width / small.width                             # ★되스케일 계수
    return lm * k, side


def build(img_path, js_path, out_dir=None):
    """한 장을 처리합니다. `out_dir` 이 None 이면 ★검증만 하고 ★아무것도 쓰지 않습니다.

    ★실패는 ★MaskBuildError / LabelSpecError 로 ★던집니다 — 조용히 건너뛰지 않습니다.
    """
    shapes, image_path, jsize = read_labelme(js_path)
    im = Image.open(img_path)
    if jsize and tuple(im.size) != tuple(jsize):
        raise LabelSpecError(
            f"JSON 의 imageWidth/Height {jsize} 가 실제 이미지 {tuple(im.size)} 와 다릅니다 — "
            f"★좌표계가 어긋나므로 실패로 둡니다")
    im = im.convert("RGB")
    name = os.path.splitext(os.path.basename(js_path))[0]

    # ── (a) 원본 해상도 ────────────────────────────────────────────────────
    lm_o, side_o = _lm_original(im)
    if lm_o is None:
        raise MaskBuildError("손 미검출 (원본) — ★마스크를 만들지 않습니다. "
                             "재촬영하거나 라벨 대상에서 제외하고 사유를 적으십시오")
    W_o = palm_frame(lm_o)[2]
    m_o, wid_o, nout_o = render(shapes, im.size, W_o)

    # ── (b) 256 평가 격자 ─────────────────────────────────────────────────
    #    ★harness 와 ★똑같은 crop 변환을 ★그 함수로 통과시킵니다
    cb = crop_box(im)
    if cb is None:
        raise MaskBuildError("crop 박스 산출 실패 (harness.crop_box) — ★손 영역을 못 찾았습니다")
    x0, y0, box = cb
    crop = crop_to_S(im, cb)
    # ★crop_to_S 와 ★같은 클리핑을 씁니다: im.crop((x0,y0,min(w,x0+box),min(h,y0+box)))
    cw = min(im.width, x0 + box) - x0
    ch = min(im.height, y0 + box) - y0
    if cw <= 0 or ch <= 0:
        raise MaskBuildError(f"crop 박스가 이미지 밖입니다: {cb}")
    sx, sy = S / float(cw), S / float(ch)                  # ★비등방일 수 있습니다 (harness 와 동일)

    lm_c, side_c = landmarks(np.asarray(crop, np.uint8))   # ★harness.infer 와 동일 조건
    if lm_c is None:
        raise MaskBuildError("손 미검출 (256 crop) — ★평가 격자 GT 를 만들 수 없습니다. "
                             "★harness.infer 도 같은 조건에서 판독불가가 됩니다")
    W_c = palm_frame(lm_c)[2]
    m_c, wid_c, nout_c = render(shapes, (S, S), W_c,
                                xform=lambda p: ((p[0] - x0) * sx, (p[1] - y0) * sy))

    # ── ignore_ratio (§4-6) ───────────────────────────────────────────────
    #    ★분모는 harness 와 같은 ROI 다각형(grow=PALM_GROW)의 256 격자 면적입니다
    roi = _inside(palm_polygon(lm_c, PALM_GROW), S, S)
    n_palm = int(roi.sum())
    if n_palm <= 0:
        raise MaskBuildError("손바닥 ROI 면적이 0 입니다 — ignore_ratio 를 정의할 수 없습니다")
    ignore_ratio = float(((m_c == IGNORE_ID) & roi).sum()) / n_palm

    res = dict(name=name, image=os.path.basename(img_path), image_path_in_json=image_path,
               n_shapes=len(shapes), size=tuple(im.size), crop=cb, side_orig=side_o,
               side_crop=side_c, W_orig=round(float(W_o), 1), W_256=round(float(W_c), 1),
               widths_orig=wid_o, widths_256=wid_c,
               n_points_outside_crop=nout_c, n_points_outside_image=nout_o,
               ignore_ratio=round(ignore_ratio, 4),
               ignore_over=bool(ignore_ratio > IGNORE_MAX_RATIO),
               values=sorted(int(v) for v in np.unique(m_o)),
               values256=sorted(int(v) for v in np.unique(m_c)),
               written=[])

    if out_dir is not None:
        _repo_guard(out_dir)                               # ★import 경로로 들어와도 막힙니다
        os.makedirs(out_dir, exist_ok=True)
        p_o = os.path.join(out_dir, f"{name}_mask.png")
        p_c = os.path.join(out_dir, f"{name}_mask256.png")
        Image.fromarray(m_o, mode="L").save(p_o)           # ★8-bit 단일 채널 (§5-7)
        Image.fromarray(m_c, mode="L").save(p_c)
        res["written"] = [p_o, p_c]
    res["_mask"], res["_mask256"] = m_o, m_c               # ★테스트·호출자용 (파일과 무관)
    return res


# ─────────────────────────────────────────────────────────────────────────────
def _pair(labels_dir, images_dir):
    """JSON ↔ 이미지 짝짓기. ★못 찾으면 ★실패 사유로 남깁니다 (건너뛰지 않습니다)."""
    js = sorted(glob.glob(os.path.join(labels_dir, '**', '*.json'), recursive=True))
    js = [p for p in js if os.path.basename(p) != 'intake_map.json']
    pairs = []
    for j in js:
        stem = os.path.splitext(os.path.basename(j))[0]
        cand = []
        try:
            with open(j, encoding='utf-8') as f:
                ip = (json.load(f) or {}).get('imagePath') or ''
            if ip:
                cand.append(os.path.basename(ip))
        except Exception:
            pass                                           # ★여기서 삼키지 않습니다 — build 가 다시 읽고 실패시킵니다
        cand += [stem + e for e in ('.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG')]
        found = None
        for c in cand:
            p = os.path.join(images_dir, c)
            if os.path.exists(p):
                found = p
                break
        pairs.append((j, found))
    return pairs


def main(labels_dir, images_dir, out_dir, apply_):
    _repo_guard(out_dir)                                   # ★가장 먼저 막습니다
    pairs = _pair(labels_dir, images_dir)
    if not pairs:
        print(f"★라벨 JSON 이 없습니다: {labels_dir}")
        return 2

    print(f"★라벨 {len(pairs)}건 · 이미지폴더 {images_dir}")
    print(f"★출력 {out_dir} · 모드 {'--apply (실제로 씁니다)' if apply_ else 'dry-run (아무것도 쓰지 않습니다)'}\n")

    # ── 1차: ★전건 검증. 한 건이라도 실패하면 ★아무것도 쓰지 않습니다 (intake.py 와 같은 규율)
    ok, bad, warn = [], [], []
    for j, img in pairs:
        n = os.path.splitext(os.path.basename(j))[0]
        if img is None:
            bad.append(f"{n}: 짝이 되는 이미지를 찾지 못했습니다 (imagePath·동일 stem 모두)")
            continue
        try:
            r = build(img, j, None)
        except (LabelSpecError, MaskBuildError) as e:
            bad.append(f"{n}: {e}")
            continue
        r.pop("_mask", None); r.pop("_mask256", None)   # ★원본 해상도 배열을 쌓아 두지 않습니다
        ok.append((j, img, r))
        if r["ignore_over"]:
            warn.append(f"{n}: ★ignore_ratio {r['ignore_ratio']:.3f} > {IGNORE_MAX_RATIO} — "
                        f"라벨규칙 v1 §4-6 은 ★폐기·재촬영 대상이라고 정합니다")
        if r["n_points_outside_crop"]:
            warn.append(f"{n}: ★라벨 점 {r['n_points_outside_crop']}개가 256 crop 밖입니다 — "
                        f"★그만큼 평가 격자 GT 가 잘립니다")
        if r["side_orig"] != r["side_crop"]:
            warn.append(f"{n}: ★좌/우 추정이 원본({r['side_orig']})과 crop({r['side_crop']})에서 다릅니다")

    for _, _, r in ok:
        print(f"  ✅ {r['name']:26s} shapes {r['n_shapes']:2d} · "
              f"W원본 {r['W_orig']:7.1f} → {r['widths_orig']} · "
              f"W256 {r['W_256']:6.1f} → {r['widths_256']} · "
              f"ignore_ratio {r['ignore_ratio']:.4f} · 값 {r['values']}")
    for m in bad:
        print(f"  ❌ {m}")
    for m in warn:
        print(f"  ⚠️  {m}")

    print(f"\n★통과 {len(ok)} · ★실패 {len(bad)} · ★경고 {len(warn)}")
    if bad:
        print("★★실패 항목이 있어 ★아무것도 쓰지 않고 중단합니다 (fail-closed). 고친 뒤 다시 실행하십시오.")
        return 2
    if not apply_:
        print("\n★dry-run 입니다. 실제로 쓰려면 ★--apply 를 붙이십시오.")
        for _, _, r in ok[:5]:
            print(f"    → {r['name']}_mask.png (원본 {r['size'][0]}×{r['size'][1]}) + "
                  f"{r['name']}_mask256.png (256×256)")
        if len(ok) > 5:
            print(f"    … 외 {len(ok)-5}건")
        return 0

    # ── 2차: ★쓰기. ★1차에서 만든 배열을 들고 있지 않고 ★다시 굽습니다
    #    ⟹ 원본 해상도(예: 4000×3000) 마스크를 ★전건 메모리에 쌓지 않기 위해서입니다.
    n = 0
    for j, img, _ in ok:
        r = build(img, j, out_dir)
        n += len(r["written"])
        print(f"  → {r['written'][0]}\n  → {r['written'][1]}")
    print(f"\n★{n}개 파일을 썼습니다 → {out_dir}")
    print("★★`meta.csv` 의 `ignore_ratio` 열에 위 값을 옮겨 적으십시오 (§5-6).")
    return 0


if __name__ == '__main__':
    a = [x for x in sys.argv[1:] if not x.startswith('--')]
    if len(a) != 3:
        print(__doc__)
        sys.exit(2)
    try:
        sys.exit(main(a[0], a[1], a[2], '--apply' in sys.argv))
    except OutsideRepoRequired as e:
        print(f"★★거부합니다\n   {e}")
        sys.exit(2)
