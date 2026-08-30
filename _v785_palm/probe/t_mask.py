"""★P-9 / P-43 자체 검사 — `mask_from_labelme.py` (2026-08-28)
사용: cd _v785_palm/probe && python3 t_mask.py
★전건 통과해야 합니다. ★한 건이라도 실패하면 GT 가 틀린 채로 만들어지는 구멍이 있는 것입니다.

★★이 검사가 ★보증하지 못하는 것 (정직하게)
   · ★실제 labelme JSON 이 ★아직 존재하지 않습니다 — ★전부 ★합성 JSON 입니다.
   · ★MediaPipe 랜드마크 검출은 ★스텁으로 대체했습니다.
     ★합성 사각형 이미지에서 MediaPipe 가 손을 찾을 리 없기 때문입니다.
     ⟹ ★`landmarks()` 가 ★실제 사진에서 무엇을 내는지는 ★여기서 검증되지 않습니다.
     ⟹ 대신 ★`crop_box`/`crop_to_S` 는 ★harness 원본 함수를 ★그대로 호출해 검증합니다.
   · ★(a)원본 W 와 (b)256 W 가 ★실제 손에서 서로 일관되는지는 ★미확인입니다.
   · ★라벨 「내용」의 옳고 그름은 검사 대상이 아닙니다 (형식·규격·기하만).
   · ★PIL 이 굽는 선 두께가 ★정확히 width 픽셀이라는 보장은 없습니다
     ⟹ ★절대값이 아니라 ★대소 관계와 ★하한(3px)만 봅니다.
"""
import sys, os, json, tempfile, shutil, ast

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
# ★실제 확정 파일을 건드리지 않습니다 (harness → thresholds 를 import 합니다)
os.environ["CW_PALM_THRESHOLDS"] = os.path.join(tempfile.mkdtemp(prefix="cwmask_"), "frozen.json")

import numpy as np
from PIL import Image

import harness
import mask_from_labelme as M
from mask_from_labelme import LabelSpecError, MaskBuildError
from labelaid import OutsideRepoRequired

OK = []
def chk(name, cond):
    OK.append((name, bool(cond)))
    print(("  ✅ " if cond else "  ❌ ") + name)


# ─────────────────────────────────────────────────────────────────────────────
# 합성 재료
# ─────────────────────────────────────────────────────────────────────────────
IMG_W, IMG_H = 1600, 1200
SKIN = (205, 150, 120)          # ★mask.skin() 조건을 만족하는 색 (r>95·g>40·b>20·|r-g|>15·r>g>b)
BG = (18, 18, 22)

# ★t_palmtype.fake_lm 을 256 로 정규화한 것 — ★같은 합성 손을 씁니다
_BASE = np.zeros((21, 2))
for _i, _p in {0: (128, 230), 1: (78, 205), 2: (58, 175), 3: (40, 150), 4: (30, 130),
               5: (82, 95), 9: (122, 88), 13: (158, 95), 17: (188, 112)}.items():
    _BASE[_i] = _p
_BASE = _BASE / 256.0


def stub_landmarks(rgb_uint8, min_conf=0.3):
    """★스텁 — 주어진 이미지 크기에 비례해 합성 랜드마크를 냅니다."""
    H, W = rgb_uint8.shape[:2]
    return _BASE * np.array([W, H], float), "Right"


def stub_none(rgb_uint8, min_conf=0.3):
    return None, None


def synth_image(path):
    a = np.zeros((IMG_H, IMG_W, 3), np.uint8)
    a[:, :] = BG
    a[150:1150, 300:1300] = SKIN            # ★중앙 1000×1000 살색 덩어리
    Image.fromarray(a).save(path)


# ★합성 라벨 — ★전부 crop 안쪽(중앙부)에 둡니다
SHAPES_OK = [
    # RLC(1) 세로 · thick — FATE 와 (700,650) 에서 교차합니다
    dict(label="RLC_thick", shape_type="linestrip", points=[[700, 400], [700, 900]]),
    # FATE(4) 가로 · medium — ★교차점은 우선순위상 ★RLC(1) 이 이겨야 합니다
    dict(label="FATE_medium", shape_type="linestrip", points=[[550, 650], [1050, 650]]),
    # PTC(2) 가로 · thin
    dict(label="PTC_thin", shape_type="linestrip", points=[[800, 450], [1100, 450]]),
    # ★DTC(3) — ★끊긴 선. ★조각마다 별도 shape (§5-3·§4-1). ★이어 붙이면 안 됩니다
    dict(label="DTC_medium", shape_type="linestrip", points=[[550, 850], [680, 850]]),
    dict(label="DTC_medium", shape_type="linestrip", points=[[820, 850], [1050, 850]]),
    # IGNORE(255) polygon
    dict(label="IGNORE", shape_type="polygon",
         points=[[560, 950], [660, 950], [660, 1000], [560, 1000]]),
]


def write_json(path, shapes, image_name, size=(IMG_W, IMG_H)):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(dict(version="5.0.1", flags={}, shapes=shapes, imagePath=image_name,
                       imageData=None, imageHeight=size[1], imageWidth=size[0]),
                  f, ensure_ascii=False)


def n_cc(m):
    """8-이웃 연결 성분 수. ★bbox 로 잘라 세어 원본 해상도에서도 빠르게."""
    ys, xs = np.nonzero(m)
    if len(ys) == 0:
        return 0
    sub = m[ys.min():ys.max()+1, xs.min():xs.max()+1].copy()
    H, W = sub.shape
    cnt = 0
    for i in range(H):
        for j in range(W):
            if sub[i, j]:
                cnt += 1
                st = [(i, j)]
                sub[i, j] = False
                while st:
                    y, x = st.pop()
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            yy, xx = y+dy, x+dx
                            if 0 <= yy < H and 0 <= xx < W and sub[yy, xx]:
                                sub[yy, xx] = False
                                st.append((yy, xx))
    return cnt


TMP = tempfile.mkdtemp(prefix="t_mask_")
LAB, IMG, OUT = (os.path.join(TMP, d) for d in ("labels", "images", "out"))
for d in (LAB, IMG):
    os.makedirs(d)
NAME = "palm_S01_L_01"
synth_image(os.path.join(IMG, NAME + ".jpg"))
write_json(os.path.join(LAB, NAME + ".json"), SHAPES_OK, NAME + ".jpg")

_real_landmarks = M.landmarks
M.landmarks = stub_landmarks          # ★이하 전 검사에서 랜드마크는 스텁입니다


# ─────────────────────────────────────────────────────────────────────────────
print("① 라벨 규격 상수 — 라벨규칙 v1 §2-1 · §5-3 · §5-4 · §5-7")
chk(f"허용 label 이 정확히 13개다 (§5-3) — {len(M.ALLOWED_LABELS)}", len(M.ALLOWED_LABELS) == 13)
chk("클래스 값이 §2-1 표와 같다 (RLC1·PTC2·DTC3·FATE4·ignore255)",
    M.CLASS_ID == {"RLC": 1, "PTC": 2, "DTC": 3, "FATE": 4} and M.IGNORE_ID == 255)
chk(f"겹침 우선순위가 255>1>2>3>4 다 (§5-7) — {M.PRIORITY}", M.PRIORITY == (255, 1, 2, 3, 4))
chk("폭 계수가 0.8/1.5/2.5 % 다 (§5-4)",
    M.WIDTH_PCT == {"thin": 0.008, "medium": 0.015, "thick": 0.025})
chk("최소 폭이 3px 이다 (§5-4)", M.MIN_WIDTH_PX == 3)
chk("ignore 재촬영 기준이 15 % 다 (§4-6)", M.IGNORE_MAX_RATIO == 0.15)

print("\n② 폭 계산 — 3단계가 갈리는가 · 최소 3px 이 보장되는가")
W_big = 1500.0                                   # ★§5-7 붕괴 표의 「원본 W≈1500」
w3 = [M.width_px(t, W_big) for t in ("thin", "medium", "thick")]
chk(f"원본급 W=1500 에서 3단계가 전부 다르다 {w3}", w3[0] < w3[1] < w3[2])
chk(f"§5-7 표의 12/22/37 px 과 일치한다 {w3}", w3 == [12, 22, 37])
w256 = [M.width_px(t, 100.0) for t in ("thin", "medium", "thick")]
chk(f"256 격자급 W=100 에서는 전부 3px 로 붕괴한다 (★P-43 의 그 현상) {w256}", w256 == [3, 3, 3])
chk("최소 3px 이 아래로 뚫리지 않는다 (W=1)", M.width_px("thin", 1.0) == 3)
try:
    M.width_px("bold", 1000.0); chk("알 수 없는 폭 태그를 거부한다", False)
except LabelSpecError:
    chk("알 수 없는 폭 태그를 거부한다", True)

print("\n③ ★허용되지 않은 label 은 ★실패한다 (조용히 무시 금지)")
for bad, why in [
        (dict(label="RLC_bold", shape_type="linestrip", points=[[1, 1], [2, 2]]), "폭 태그 오타"),
        (dict(label="LIFE_thin", shape_type="linestrip", points=[[1, 1], [2, 2]]), "수상학 명칭"),
        (dict(label="rlc_thin", shape_type="linestrip", points=[[1, 1], [2, 2]]), "소문자"),
        (dict(label="ignore", shape_type="polygon", points=[[1, 1], [2, 2], [3, 3]]), "IGNORE 소문자")]:
    p = os.path.join(LAB, "_bad.json"); write_json(p, [bad], NAME + ".jpg")
    try:
        M.read_labelme(p); chk(f"{why} 를 거부한다", False)
    except LabelSpecError:
        chk(f"{why} 를 거부한다", True)
for bad, why in [
        (dict(label="IGNORE", shape_type="linestrip", points=[[1, 1], [2, 2], [3, 3]]),
         "IGNORE 가 polygon 이 아니면 거부"),
        (dict(label="RLC_thin", shape_type="polygon", points=[[1, 1], [2, 2], [3, 3]]),
         "선이 linestrip 이 아니면 거부"),
        (dict(label="RLC_thin", shape_type="linestrip", points=[[1, 1]]), "점 1개짜리 선 거부")]:
    p = os.path.join(LAB, "_bad.json"); write_json(p, [bad], NAME + ".jpg")
    try:
        M.read_labelme(p); chk(why, False)
    except LabelSpecError:
        chk(why, True)
p = os.path.join(LAB, "_bad.json"); write_json(p, [], NAME + ".jpg")
try:
    M.read_labelme(p); chk("빈 shapes 를 거부한다 (§4-7 「없음」은 meta.csv 로 적습니다)", False)
except LabelSpecError:
    chk("빈 shapes 를 거부한다 (§4-7 「없음」은 meta.csv 로 적습니다)", True)
write_json(p, SHAPES_OK, NAME + ".jpg", size=(999, 999))
try:
    M.build(os.path.join(IMG, NAME + ".jpg"), p, None)
    chk("JSON 의 imageWidth/Height 가 실제와 다르면 거부한다", False)
except LabelSpecError:
    chk("JSON 의 imageWidth/Height 가 실제와 다르면 거부한다", True)
os.remove(p)

print("\n④ 끊긴 선을 ★읽는 단계에서 이어 붙이지 않는가")
shapes = M.read_labelme(os.path.join(LAB, NAME + ".json"))[0]
chk(f"shape 수가 JSON 그대로다 ({len(shapes)}=={len(SHAPES_OK)})", len(shapes) == len(SHAPES_OK))
chk("같은 label(DTC_medium) 이 2개 그대로 남아 있다",
    sum(1 for s in shapes if s["label"] == "DTC_medium") == 2)

print("\n⑤ ★전 경로 실행 — build() (★crop_box/crop_to_S 실호출 감시)")
calls = {"crop_box": 0, "crop_to_S": 0}
_rb, _rs = M.crop_box, M.crop_to_S
chk("crop_box 가 harness 의 그 함수다", _rb is harness.crop_box)
chk("crop_to_S 가 harness 의 그 함수다", _rs is harness.crop_to_S)
def spy_box(im):
    calls["crop_box"] += 1; return _rb(im)
def spy_s(im, cb):
    calls["crop_to_S"] += 1; return _rs(im, cb)
M.crop_box, M.crop_to_S = spy_box, spy_s
r = M.build(os.path.join(IMG, NAME + ".jpg"), os.path.join(LAB, NAME + ".json"), None)
M.crop_box, M.crop_to_S = _rb, _rs
chk(f"★256 판이 harness.crop_box 를 거쳤다 ({calls['crop_box']}회)", calls["crop_box"] == 1)
chk(f"★256 판이 harness.crop_to_S 를 거쳤다 ({calls['crop_to_S']}회)", calls["crop_to_S"] == 1)

m_o, m_c = r["_mask"], r["_mask256"]
chk(f"원본 마스크 크기가 원본과 같다 {m_o.shape}", m_o.shape == (IMG_H, IMG_W))
chk(f"256 마스크가 {harness.S}×{harness.S} 다 {m_c.shape}", m_c.shape == (harness.S, harness.S))
chk("두 마스크 모두 8-bit 단일 채널(uint8) 이다 (§5-7)",
    m_o.dtype == np.uint8 and m_c.dtype == np.uint8)

print("\n⑥ ★클래스 값이 0/1/2/3/4/255 만 나오는가 (§5-7)")
ALLOWED_V = {0, 1, 2, 3, 4, 255}
chk(f"원본 마스크 값 {sorted(set(np.unique(m_o).tolist()))}", set(np.unique(m_o).tolist()) <= ALLOWED_V)
chk(f"256 마스크 값 {sorted(set(np.unique(m_c).tolist()))}", set(np.unique(m_c).tolist()) <= ALLOWED_V)
chk("네 클래스가 전부 원본 마스크에 있다", {1, 2, 3, 4, 255} <= set(np.unique(m_o).tolist()))

print("\n⑦ ★겹침 우선순위 — RLC(1) × FATE(4) 교차점")
chk(f"교차점 (700,650) 이 RLC=1 이다 (실제 {int(m_o[650, 700])})", m_o[650, 700] == 1)
chk(f"교차에서 벗어난 FATE 구간은 4 다 (실제 {int(m_o[650, 1000])})", m_o[650, 1000] == 4)
chk(f"교차에서 벗어난 RLC 구간은 1 다 (실제 {int(m_o[430, 700])})", m_o[430, 700] == 1)
# ★255 가 최상위인지 — IGNORE 폴리곤과 DTC 를 겹쳐 봅니다
sh_ov = SHAPES_OK[:] + [dict(label="IGNORE", shape_type="polygon",
                             points=[[560, 830], [700, 830], [700, 870], [560, 870]])]
p_ov = os.path.join(LAB, "_ov.json"); write_json(p_ov, sh_ov, NAME + ".jpg")
r_ov = M.build(os.path.join(IMG, NAME + ".jpg"), p_ov, None)
chk(f"DTC(3) 위를 덮은 IGNORE 가 255 로 이긴다 (실제 {int(r_ov['_mask'][850, 600])})",
    r_ov["_mask"][850, 600] == 255)
os.remove(p_ov)

print("\n⑧ ★끊긴 선이 이어지지 않는가 — 연결 성분")
chk(f"DTC(3) 연결 성분이 2개다 (실제 {n_cc(m_o == 3)})", n_cc(m_o == 3) == 2)
chk(f"두 조각 사이(850,750)가 배경이다 (실제 {int(m_o[850, 750])})", m_o[850, 750] == 0)
chk(f"256 격자에서도 DTC 조각이 2개다 (실제 {n_cc(m_c == 3)})", n_cc(m_c == 3) == 2)

print("\n⑨ ★폭 — 원본에서는 3단계가 갈리고 · 256 에서는 3px 로 수렴한다 (★P-43)")
wo, wc = r["widths_orig"], r["widths_256"]
chk(f"원본 W={r['W_orig']} · 규칙 폭 {wo}", wo["thin"] < wo["medium"] < wo["thick"])
chk(f"256 W={r['W_256']} · 규칙 폭 {wc} — ★전부 3px 로 붕괴 (정상)",
    set(wc.values()) == {3})
t_thin = int((m_o[:, 950] == 2).sum())      # PTC_thin 가로선의 세로 두께
t_med = int((m_o[:, 600] == 3).sum())       # DTC_medium 가로선
t_thick = int((m_o[430, :] == 1).sum())     # RLC_thick 세로선의 가로 두께
chk(f"★실제로 구운 두께가 thin<medium<thick 이다 ({t_thin}/{t_med}/{t_thick})",
    t_thin < t_med < t_thick)
chk(f"★가장 얇은 선도 3px 이상이다 ({t_thin}px)", t_thin >= M.MIN_WIDTH_PX)
c_thin = int((m_c[:, np.nonzero((m_c == 2).any(0))[0][0]] == 2).sum()) if (m_c == 2).any() else 0
chk(f"256 격자의 thin 선도 3px 이상 존재한다 ({c_thin}px) — "
    f"★NEAREST 리사이즈였다면 사라졌을 폭입니다", c_thin >= M.MIN_WIDTH_PX)

print("\n⑩ ★256 판이 crop 변환과 좌표까지 맞는가")
x0, y0, box = r["crop"]
im = Image.open(os.path.join(IMG, NAME + ".jpg"))
cw = min(im.width, x0 + box) - x0
ch = min(im.height, y0 + box) - y0
ex = (700 - x0) * harness.S / cw
ey = (650 - y0) * harness.S / ch
chk(f"crop 박스가 산출됐다 {r['crop']}", box > 0)
chk(f"교차점이 256 격자의 예측 위치(±2px)에 RLC=1 로 있다 ({ex:.1f},{ey:.1f})",
    0 <= ex < harness.S and 0 <= ey < harness.S and
    (m_c[max(0, int(ey)-2):int(ey)+3, max(0, int(ex)-2):int(ex)+3] == 1).any())
chk("256 마스크를 원본 리사이즈로 만들지 않았다 (NEAREST 축소본과 다르다)",
    not np.array_equal(m_c, np.asarray(Image.fromarray(m_o).resize(
        (harness.S, harness.S), Image.NEAREST))))

print("\n⑪ ★ignore_ratio (§4-6)")
chk(f"ignore_ratio 가 계산된다 ({r['ignore_ratio']})",
    isinstance(r["ignore_ratio"], float) and 0.0 <= r["ignore_ratio"] <= 1.0)
chk("이 합성 라벨은 15 % 를 넘지 않는다", r["ignore_over"] is False)
sh_big = [SHAPES_OK[0], dict(label="IGNORE", shape_type="polygon",
                             points=[[0, 0], [IMG_W-1, 0], [IMG_W-1, IMG_H-1], [0, IMG_H-1]])]
p_big = os.path.join(LAB, "_big.json"); write_json(p_big, sh_big, NAME + ".jpg")
r_big = M.build(os.path.join(IMG, NAME + ".jpg"), p_big, None)
chk(f"전면 IGNORE 는 15 % 초과로 잡힌다 (ratio {r_big['ignore_ratio']})",
    r_big["ignore_over"] is True and r_big["ignore_ratio"] > M.IGNORE_MAX_RATIO)
os.remove(p_big)

print("\n⑫ ★손 미검출 = ★실패 (마스크를 만들지 않습니다)")
M.landmarks = stub_none
try:
    M.build(os.path.join(IMG, NAME + ".jpg"), os.path.join(LAB, NAME + ".json"), None)
    chk("손 미검출이면 MaskBuildError", False)
except MaskBuildError as e:
    chk(f"손 미검출이면 MaskBuildError ({str(e)[:18]}…)", True)
out_nd = os.path.join(TMP, "out_nodetect")
rc = M.main(LAB, IMG, out_nd, True)
chk("손 미검출이면 main 이 2 로 끝난다", rc == 2)
chk("★손 미검출이면 --apply 여도 파일을 쓰지 않는다",
    not os.path.exists(out_nd) or not os.listdir(out_nd))
M.landmarks = stub_landmarks

print("\n⑬ ★dry-run 은 파일을 쓰지 않는다")
rc = M.main(LAB, IMG, OUT, False)
chk("dry-run 이 0 으로 끝난다", rc == 0)
chk("★dry-run 이 출력폴더에 아무것도 만들지 않았다",
    not os.path.exists(OUT) or not os.listdir(OUT))

print("\n⑭ --apply 로만 파일을 쓴다")
rc = M.main(LAB, IMG, OUT, True)
p_o = os.path.join(OUT, NAME + "_mask.png")
p_c = os.path.join(OUT, NAME + "_mask256.png")
chk("--apply 가 0 으로 끝난다", rc == 0)
chk(f"★원본 해상도 마스크가 생겼다 {os.path.basename(p_o)}", os.path.exists(p_o))
chk(f"★256 평가 마스크가 생겼다 {os.path.basename(p_c)}", os.path.exists(p_c))
if os.path.exists(p_o) and os.path.exists(p_c):
    a_o, a_c = Image.open(p_o), Image.open(p_c)
    chk(f"원본 마스크 {a_o.size}·mode {a_o.mode}", a_o.size == (IMG_W, IMG_H) and a_o.mode == "L")
    chk(f"256 마스크 {a_c.size}·mode {a_c.mode}", a_c.size == (256, 256) and a_c.mode == "L")
    chk("저장된 값도 0/1/2/3/4/255 뿐이다",
        set(np.unique(np.asarray(a_o)).tolist()) <= ALLOWED_V and
        set(np.unique(np.asarray(a_c)).tolist()) <= ALLOWED_V)
    chk("★harness.load_gt 가 읽는 이름 규칙(`<name>_mask.png`)과 같다",
        os.path.basename(p_o) == os.path.splitext(NAME + '.jpg')[0] + '_mask.png')

print("\n⑮ ★저장소 안 출력은 거부한다 (생체정보 파생물 · §5-5)")
here = os.path.dirname(os.path.abspath(__file__))
for target, why in [(os.path.join(here, "_t_mask_out"), "main() 이 저장소 가드를 건다")]:
    try:
        M.main(LAB, IMG, target, True); chk(why, False)
    except OutsideRepoRequired:
        chk(why, True)
    except Exception as e:
        chk(f"{why} (다른 예외: {type(e).__name__})", False)
chk("★거부 후 저장소 안에 폴더가 만들어지지 않았다",
    not os.path.exists(os.path.join(here, "_t_mask_out")))
try:
    M.build(os.path.join(IMG, NAME + ".jpg"), os.path.join(LAB, NAME + ".json"), here)
    chk("build() 도 저장소 가드를 건다", False)
except OutsideRepoRequired:
    chk("build() 도 저장소 가드를 건다", True)
except Exception as e:
    chk(f"build() 도 저장소 가드를 건다 (다른 예외: {type(e).__name__})", False)

print("\n⑯ ★임계가 코드에 박혀 있지 않은가 · 변환을 따로 구현하지 않았는가")
src = open(os.path.join(here, "mask_from_labelme.py"), encoding='utf-8').read()
tree = ast.parse(src)
mods = {(n.module or '') for n in ast.walk(tree) if isinstance(n, ast.ImportFrom)} | \
       {a.name for n in ast.walk(tree) if isinstance(n, ast.Import) for a in n.names}
chk(f"판정 임계 모듈(thresholds)을 쓰지 않는다 — ★쓸 임계가 없습니다 {sorted(mods)}",
    'thresholds' not in mods)
imported = {a.asname or a.name
            for n in ast.walk(tree) if isinstance(n, ast.ImportFrom) for a in n.names}
chk("crop_box·crop_to_S 를 harness 에서 import 한다 (P-43)",
    {'crop_box', 'crop_to_S'} <= imported)
chk("palm_frame·landmarks 를 palmroi 에서 import 한다 (§5-4 의 W 정의)",
    {'palm_frame', 'landmarks'} <= imported)
chk("_repo_guard 를 labelaid 에서 재사용한다", '_repo_guard' in imported)
floats = {n.value for n in ast.walk(tree)
          if isinstance(n, ast.Constant) and isinstance(n.value, float)}
chk(f"float 상수가 ★문서에 출처가 있는 규격값뿐이다 {sorted(floats)}",
    floats <= {0.008, 0.015, 0.025, 0.15})
chk("자체 resize((256,256)) 로 256 판을 만들지 않는다",
    'Image.NEAREST' not in src and '(S, S)' not in src.replace('(S, S), W_c', ''))

M.landmarks = _real_landmarks
shutil.rmtree(TMP, ignore_errors=True)
n_bad = sum(1 for _, o in OK if not o)
print(f"\n{'='*58}\n{len(OK)-n_bad}/{len(OK)} 통과" + ("" if n_bad == 0 else f" · ★실패 {n_bad}건"))
if n_bad:
    print("★실패 목록:")
    for k, o in OK:
        if not o:
            print("   · " + k)
sys.exit(1 if n_bad else 0)
