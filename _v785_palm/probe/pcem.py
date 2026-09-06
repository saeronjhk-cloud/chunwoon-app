"""★★PCEM (MFRAT 손금선 추출) 편입 + 정량 평가 — 2026-09-01 · P-55

★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
★★`percentile` 은 ★★이것은 임계입니다 (G-7 대상 · 레지스트리 미등록) ⟹ dev 진단 전용
   ★기본값을 ★일부러 두지 않았습니다 — `pcem_mask(...)` 는 ★percentile 을 ★필수 인자로 받습니다.
   ★이 파일이 내는 어떤 숫자도 ★출시 판정(verdict)에 쓸 수 없습니다. ★NOT_A_VERDICT.
   ★임계 확정은 ★G-7(thresholds.freeze) · P-33 소관이며 ★Tier-B 라벨 뒤입니다.
   ★`ksize` · `angle0` · `hp_ksize` 도 ★같은 성격의 미확정 계수입니다 (원저자 기본값 그대로).
★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

★★출처 · 라이선스
   알고리즘 출처: PCE-Palm — https://github.com/Ukuer/PCE-Palm  (`PCEM_numpy.py`)
   라이선스     : Apache License 2.0 (원문 확인 완료 · 상업 이용 가능)
   ★원본 코드를 ★복사해 오지 않았습니다. ★알고리즘만 읽고 ★우리 규약(numpy 전용 ·
     torch/cv2 불필요 · palmroi 좌표계)으로 ★다시 썼습니다.
   ★학습 모델이 아니므로 ★가중치가 필요 없습니다.

★★알고리즘 (원저자 기본 계수: ksize=31 · angle0=30 · 고역통과 ksize=31)
   ① 가우시안 고역통과 : details = gray - GaussianBlur(gray, 31)
   ② MFRAT 필터뱅크    : 31×31 격자에 ★중심을 지나는 1픽셀 직선을 ★6방향(0·30·60·90·120·150°)
                         으로 그리고, 가우시안 포락선을 곱한 뒤 ★합이 1이 되게 정규화하고
                         ★부호를 뒤집습니다(-1). ⟹ ★어두운 선 위에서 응답이 커집니다
   ③ 응답 최대         : response = max over 6 directions
   ④ 퍼센타일 임계     : line = response >= percentile(response, p)

★★원본과 다른 점 (전부 의도한 것입니다)
   ㉠ ★cv2 를 쓰지 않습니다 — 분리형 가우시안 + 희소 상관을 numpy 로 씁니다.
      ★원본(cv2) 대비 응답 최대오차 0.44/81.9 = ★0.54 % · 마스크 IoU 0.992~0.995 (p=85/90/95).
      ★차이의 출처는 ★OpenCV getGaussianKernel 계수뿐입니다. MFRAT 커널은 ★비트 단위로 같습니다.
   ㉡ ★퍼센타일을 ★256-bin 히스토그램 CDF 보간이 아니라 ★정확한 분위수로 잽니다.
      ★원본의 히스토그램 근사는 「90 %」를 넣어도 실제로는 ★약 10.4 % 가 나옵니다.
   ㉢ ★★임계를 ★ROI 안쪽 화소로만 잽니다. ★마스크도 ROI 로 자릅니다.
      ★근거: 전신 손 사진(4000×3000)을 그대로 넣으면 ★손 윤곽선·배경이 10 % 예산을
        전부 먹습니다. ★손바닥 ROI 로 한정해야 예산이 손금에 갑니다.
   ㉣ ★출력 극성이 반대입니다. ★원본은 ★선=0(검정)/배경=255 로 저장하지만
      ★우리 규약은 ★선=True 입니다 (U-Net `pred` 와 같은 극성).

★★입력 배율 (roi_norm)
   ★원저자 입력은 ★손바닥 ROI 를 잘라 256×256 으로 만든 그림입니다.
   ★우리 `crop_to_S` 는 ★손 전체(손가락 포함)를 256×256 에 담습니다 ⟹ ★손바닥은
     ★변 96~173 px(중앙값 143)밖에 안 됩니다. ★같은 31 px 커널이 ★1.5~2.7배 크게 작동합니다.
   ⟹ ★두 가지를 ★모두 재고 ★고르지 않습니다:
      · roi_norm=False : ★우리 256 격자 그대로 (배율 불일치 있음)
      · roi_norm=True  : ★ROI 정사각 박스를 256 으로 확대 → 원저자 입력 배율에 맞춤

사용:
  python3 pcem.py                       # 24장 전체 · 퍼센타일 스윕 · 표 출력
  python3 pcem.py --pct 85,88,90,92,95 --vis pcem_compare.png
"""
import sys, os, glob, csv, math, time, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image

from harness import crop_box, crop_to_S, S, PALM_GROW
from pthread import load
from unet_np import forward
from metrics import cl_dice, dice, iou
import palmroi, palmtype
from ourtree import read_gt

LINES = ('RLC', 'PTC', 'DTC', 'FATE')
OK = LINES + ('NONE',)

# ★원저자 기본 계수 — ★우리가 고른 값이 아닙니다 (미확정 · G-7 대상)
KSIZE, ANGLE0, HP_KSIZE = 31, 30, 31


# ─────────────────────────────────────────────────────────────────────────────
# ① MFRAT 방향 필터뱅크
# ─────────────────────────────────────────────────────────────────────────────
def _envelope(ksize):
    """가우시안 포락선. ★원저자의 `get_ftype('gaussian')` 과 ★같은 값입니다.
    원본은 t=linspace(-2σ,2σ,k), exp(-t²/2σ²) 로 σ 가 상쇄됩니다 ⟹ exp(-2·x²), x∈[-1,1]."""
    return np.exp(-2.0 * np.linspace(-1.0, 1.0, ksize) ** 2)


def mfrat_kernels(ksize=KSIZE, angle0=ANGLE0):
    """(180/angle0, ksize, ksize) 필터뱅크. ★합이 1 이 되게 정규화하고 ★부호를 뒤집습니다.

    ★부호 반전의 뜻: 고역통과 영상에서 ★어두운 선은 음수입니다.
      ⟹ -평균 을 재면 ★선 위에서 ★큰 양수가 됩니다 ⟹ 「응답 최대」가 선 방향을 고릅니다.
    """
    env = _envelope(ksize)
    half = ksize // 2
    out = []
    for a in [i * angle0 for i in range(180 // angle0)]:
        f = np.zeros((ksize, ksize), np.float32)
        aa = a - 180 if a > 90 else a                    # ★원저자 규약: 90° 초과는 음각으로
        rad = math.radians(aa)
        if -45 < aa < 45:                                # 가로에 가까움 → x 로 훑습니다
            t = math.tan(rad)
            for dx in range(-half, half + 1):
                f[half + round(dx * t), half + dx] = 1.0
        elif aa < -45 or aa > 45:                        # 세로에 가까움 → y 로 훑습니다
            t = math.cos(rad) / math.sin(rad)
            for dy in range(-half, half + 1):
                f[half + dy, half + round(dy * t)] = 1.0
        elif aa == 45:
            for dx in range(-half, half + 1):
                f[half + dx, half + dx] = 1.0
        else:                                            # aa == -45
            for dx in range(-half, half + 1):
                f[half - dx, half + dx] = 1.0
        # ★포락선 방향은 ★원래 각도로 판정합니다 (원저자와 동일)
        f = f * env[None, :] if (a <= 45 or a >= 135) else f * env[:, None]
        out.append(f / f.sum())
    return -np.stack(out).astype(np.float32)


# ─────────────────────────────────────────────────────────────────────────────
# ② 가우시안 고역통과 (numpy · cv2 불필요)
# ─────────────────────────────────────────────────────────────────────────────
def _gauss1d(ksize):
    """OpenCV `GaussianBlur(..., sigma=0)` 의 σ 규칙을 그대로 씁니다."""
    s = 0.3 * ((ksize - 1) * 0.5 - 1) + 0.8
    i = np.arange(ksize) - (ksize - 1) / 2.0
    g = np.exp(-(i * i) / (2 * s * s))
    return (g / g.sum()).astype(np.float32)


def _sep_blur(img, g):
    """분리형 합성곱 · 테두리는 symmetric (= cv2.BORDER_REFLECT)."""
    r = len(g) // 2
    H, W = img.shape
    p = np.pad(img, ((0, 0), (r, r)), mode='symmetric')
    a = np.zeros((H, W), np.float32)
    for i, c in enumerate(g):
        a += c * p[:, i:i + W]
    p = np.pad(a, ((r, r), (0, 0)), mode='symmetric')
    b = np.zeros((H, W), np.float32)
    for i, c in enumerate(g):
        b += c * p[i:i + H, :]
    return b


def highpass(gray, ksize=HP_KSIZE):
    g = np.asarray(gray, np.float32)
    return g - _sep_blur(g, _gauss1d(ksize))


# ─────────────────────────────────────────────────────────────────────────────
# ③ 응답
# ─────────────────────────────────────────────────────────────────────────────
def _corr_sparse(img, k):
    """★커널이 ★직선 한 줄(비영 원소 ~ksize개)뿐이라 ★이동-누산이 가장 쌉니다."""
    r = k.shape[0] // 2
    H, W = img.shape
    p = np.pad(img, r, mode='symmetric')
    out = np.zeros((H, W), np.float32)
    ys, xs = np.nonzero(k)
    for y, x in zip(ys, xs):
        out += k[y, x] * p[y:y + H, x:x + W]
    return out


def mfrat_response(gray, ksize=KSIZE, angle0=ANGLE0, hp_ksize=HP_KSIZE):
    """(H,W) float32 응답. ★클수록 ★어두운 선일 가능성이 큽니다."""
    img = highpass(gray, hp_ksize)
    return np.max(np.stack([_corr_sparse(img, k)
                            for k in mfrat_kernels(ksize, angle0)]), axis=0)


def to_gray(rgb):
    """ITU-R BT.601 (cv2.COLOR_RGB2GRAY 와 같은 계수)."""
    a = np.asarray(rgb, np.float32)
    return 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]


# ─────────────────────────────────────────────────────────────────────────────
# ④ 마스크 — ★percentile 은 ★필수 인자입니다 (기본값을 두지 않습니다)
# ─────────────────────────────────────────────────────────────────────────────
def _roi_square_box(roi):
    """ROI 를 감싸는 ★정사각 박스 (S 안으로 평행이동해서 맞춥니다 · 축소하지 않습니다)."""
    ys, xs = np.nonzero(roi)
    H, W = roi.shape
    side = int(max(np.ptp(ys), np.ptp(xs))) + 1
    side = min(side, min(H, W))
    cy, cx = (ys.min() + ys.max()) // 2, (xs.min() + xs.max()) // 2
    y0 = int(np.clip(cy - side // 2, 0, H - side))
    x0 = int(np.clip(cx - side // 2, 0, W - side))
    return y0, x0, side


def pcem_mask(rgb, roi, percentile, ksize=KSIZE, angle0=ANGLE0, hp_ksize=HP_KSIZE,
              roi_norm=False, out_size=256):
    """PCEM 손금선 마스크 (bool · True=선). ★ROI 밖은 항상 False 입니다.

    percentile : ★★임계입니다 (G-7 대상 · 레지스트리 미등록) ⟹ dev 진단 전용.
                 ★ROI 안쪽 화소의 분위수로 잽니다 ⟹ ★ROI 면적의 (100-p) % 가 선이 됩니다.
    roi_norm   : True 면 ★ROI 정사각 박스를 out_size 로 확대해 ★원저자 입력 배율에 맞춥니다.
    """
    if not (0 < percentile < 100):
        raise ValueError(f"percentile 은 0~100 사이여야 합니다: {percentile}")
    gray = to_gray(rgb)
    if not roi_norm:
        resp = mfrat_response(gray, ksize, angle0, hp_ksize)
        thr = np.percentile(resp[roi], percentile)
        return (resp >= thr) & roi

    y0, x0, side = _roi_square_box(roi)
    sub = gray[y0:y0 + side, x0:x0 + side]
    sroi = roi[y0:y0 + side, x0:x0 + side]
    big = np.asarray(Image.fromarray(sub.astype(np.float32), 'F')
                     .resize((out_size, out_size), Image.BILINEAR), np.float32)
    broi = np.asarray(Image.fromarray(sroi.astype(np.uint8) * 255)
                      .resize((out_size, out_size), Image.NEAREST)) > 0
    resp = mfrat_response(big, ksize, angle0, hp_ksize)
    if not broi.any():
        return np.zeros_like(roi)
    thr = np.percentile(resp[broi], percentile)
    m = ((resp >= thr) & broi).astype(np.uint8) * 255
    back = np.asarray(Image.fromarray(m).resize((side, side), Image.NEAREST)) > 0
    out = np.zeros_like(roi)
    out[y0:y0 + side, x0:x0 + side] = back
    return out & roi


# ═════════════════════════════════════════════════════════════════════════════
# 평가 — ★비교군은 ★기존 U-Net (p>0.5 & ROI)
# ═════════════════════════════════════════════════════════════════════════════
def collect(root, ckpt):
    """★`ourtree.collect_ours` 와 ★같은 순서로 이미지·조각을 냅니다 (조각 추출 정본).
    반환: [dict(file, rgb, roi, pred, lm, comps)] · comps = [(i, pts Nx2)]"""
    sd = load(ckpt)
    imgs = sorted(glob.glob(os.path.join(root, '**', '*.jpg'), recursive=True))
    imgs = [i for i in imgs if '/masks/' not in i.replace('\\', '/')]
    out, skipped = [], []
    for p in imgs:
        im = Image.open(p).convert('RGB')
        cb = crop_box(im)
        if cb is None:
            skipped.append((os.path.basename(p), 'crop_box 실패')); continue
        rgb = np.asarray(crop_to_S(im, cb), np.float32)
        roi, lm, side = palmroi.palm_roi(rgb, grow=PALM_GROW)
        if roi is None:
            skipped.append((os.path.basename(p), 'palm_roi 실패(손 미검출)')); continue
        lg = forward(np.ascontiguousarray(rgb.transpose(2, 0, 1) / 255.), sd)
        pred = (1 / (1 + np.exp(-lg)) > 0.5) & roi
        out.append(dict(file=os.path.basename(p), rgb=rgb.astype(np.uint8), roi=roi,
                        pred=pred, lm=lm, comps=palmtype.components(pred)))
    return out, skipped


def _label_map(rec, gtmap):
    """조각 인덱스 → 정답 라벨 (유효한 것만)."""
    d = {}
    for i, _pts in rec['comps']:
        g = gtmap.get((rec['file'], i))
        if g in OK:
            d[i] = g
    return d


GAPS = ((0, 3), (4, 8), (9, 20), (21, 10 ** 6))     # 조각 간 최소 체스보드 거리 구간(px)


def _gap(a, b):
    """두 조각 사이 ★최소 체스보드 거리(px). 0 = 8-이웃으로 맞닿음."""
    return int(np.abs(a[:, None, :] - b[None, :, :]).max(-1).min())


def _dilate(m, n=1):
    o = m.copy()
    for _ in range(n):
        p = np.pad(o, 1)
        o = (p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:] |
             p[:-2, :-2] | p[:-2, 2:] | p[2:, :-2] | p[2:, 2:] | o)
    return o


def evaluate(recs, gtmap, pct, roi_norm):
    """한 퍼센타일·한 변형에 대한 지표 묶음."""
    px = dict(iou=[], dice=[], cldice=[], a_pcem=[], a_unet=[], extra=[])
    cov = {k: [] for k in OK}          # 조각별 피복률
    covd = {k: [] for k in OK}         # 1px 팽창 허용
    mass = dict(on_line=0, on_none=0, on_bg=0)
    comp_hit = dict(line=0, none_only=0, empty=0)
    # ★긴 조각만 (len_v>0.3 · ★보고용 절단선입니다 · 임계 아님) — 「긴 것은 진짜 선인가」
    long_hit = dict(line=0, none_only=0, empty=0)
    comp_len = []
    bridge = dict(same=[0, 0], cross=[0, 0], linenone=[0, 0])   # [연결, 전체]
    # ★⑦ 거리 통제 — ★같은 선끼리는 ★원래 더 가깝습니다. ★같은 간격대에서 비교해야 합니다
    gbin = {(k, i): [0, 0] for k in ('same', 'cross', 'linenone') for i in range(len(GAPS))}
    novel = []                          # U-Net 과 전혀 안 겹치는 PCEM 조각의 len_v
    novel_miss = []                     # ★클래스 결손 이미지에서의 최대 novel len_v
    cont = []                           # ★⑩ (이미지×클래스) U-Net 최장 len_v vs PCEM 최장 len_v

    for r in recs:
        roi, unet = r['roi'], r['pred']
        m = pcem_mask(r['rgb'], roi, pct, roi_norm=roi_norm)
        px['iou'].append(iou(m, unet)); px['dice'].append(dice(m, unet))
        px['cldice'].append(cl_dice(m, unet))
        px['a_pcem'].append(m.sum() / roi.sum()); px['a_unet'].append(unet.sum() / roi.sum())
        px['extra'].append((m & ~unet).sum() / max(m.sum(), 1))

        lab = _label_map(r, gtmap)
        md = _dilate(m, 1)
        linepix = np.zeros_like(roi); nonepix = np.zeros_like(roi)
        for i, pts in r['comps']:
            g = lab.get(i)
            if g is None: continue
            c = m[pts[:, 0], pts[:, 1]].mean()
            cov[g].append(c); covd[g].append(md[pts[:, 0], pts[:, 1]].mean())
            (linepix if g in LINES else nonepix)[pts[:, 0], pts[:, 1]] = True

        mass['on_line'] += int((m & linepix).sum())
        mass['on_none'] += int((m & nonepix).sum())
        mass['on_bg'] += int((m & ~(linepix | nonepix)).sum())

        # PCEM 조각 단위
        pc = palmtype.components(m)
        cid = np.full(roi.shape, -1, np.int32)
        for j, pts in pc:
            cid[pts[:, 0], pts[:, 1]] = j
        ud = _dilate(unet, 1)
        best_novel = 0.0
        for j, pts in pc:
            hitl = linepix[pts[:, 0], pts[:, 1]].any()
            hitn = nonepix[pts[:, 0], pts[:, 1]].any()
            k = 'line' if hitl else ('none_only' if hitn else 'empty')
            comp_hit[k] += 1
            f = palmtype.frag_features(pts, r['lm'])
            comp_len.append(f['len_v'])
            if f['len_v'] > 0.3: long_hit[k] += 1
            if not ud[pts[:, 0], pts[:, 1]].any():
                novel.append(f['len_v']); best_novel = max(best_novel, f['len_v'])
        if set(LINES) - set(lab.values()):          # ★U-Net 이 통째로 놓친 선이 있는 장
            novel_miss.append(best_novel)

        # 다리 놓기 — GT 조각쌍이 ★한 PCEM 조각으로 이어지는가
        ids = sorted(lab)
        own = {}
        for i in ids:
            pts = r['comps'][i][1]
            v = cid[pts[:, 0], pts[:, 1]]
            v = v[v >= 0]
            own[i] = set(np.unique(v).tolist())

        # ★⑩ 연속성 — (이미지×클래스)마다 ★U-Net 최장 조각 vs ★그것을 품은 PCEM 최장 조각
        plen = {j: palmtype.frag_features(pts, r['lm'])['len_v'] for j, pts in pc}
        byc = {}
        for i, g in lab.items():
            if g in LINES: byc.setdefault(g, []).append(i)
        for c, idl in byc.items():
            u = max(palmtype.frag_features(r['comps'][i][1], r['lm'])['len_v'] for i in idl)
            js = set().union(*(own[i] for i in idl))
            cont.append((u, max((plen[j] for j in js), default=0.0)))
        for a in range(len(ids)):
            for b in range(a + 1, len(ids)):
                ia, ib = ids[a], ids[b]
                ga, gb = lab[ia], lab[ib]
                joined = bool(own[ia] & own[ib])
                if ga in LINES and gb in LINES:
                    key = 'same' if ga == gb else 'cross'
                elif (ga in LINES) != (gb in LINES):
                    key = 'linenone'
                else:
                    continue
                bridge[key][1] += 1; bridge[key][0] += int(joined)
                g = _gap(r['comps'][ia][1], r['comps'][ib][1])
                bi = next(i for i, (lo, hi) in enumerate(GAPS) if lo <= g <= hi)
                gbin[(key, bi)][1] += 1; gbin[(key, bi)][0] += int(joined)
    return dict(px=px, cov=cov, covd=covd, mass=mass, comp_hit=comp_hit,
                long_hit=long_hit, comp_len=comp_len, bridge=bridge, gbin=gbin,
                novel=novel, novel_miss=novel_miss, cont=cont)


def _m(a): return float(np.mean(a)) if len(a) else float('nan')


def main(pcts, vis):
    A = os.environ.get('CW_PALM_DATA', r'D:\ChunWoon_palm_dataset\A-smoke')
    F = os.environ.get('CW_PALM_FRAG', r'D:\ChunWoon_palm_dataset\_frag')
    ck = os.environ.get('CW_PALM_CKPT', 'palm-api/checkpoint_aug_epoch70.pth')
    cp = None
    for cand in ('frag_gt(수정).csv', 'frag_gt.csv'):
        if os.path.exists(os.path.join(F, cand)): cp = os.path.join(F, cand); break
    if cp is None: raise SystemExit(f"★정답 CSV 가 없습니다: {F}")

    print("★★NOT_A_VERDICT — PCEM 편입 진단 (P-55) · Tier-A 1명 2손 표본입니다")
    print(f"★정답 파일: {os.path.basename(cp)}")
    t0 = time.time()
    recs, skipped = collect(A, ck)
    gtmap = read_gt(cp)
    nlab = sum(len(_label_map(r, gtmap)) for r in recs)
    print(f"★이미지 {len(recs)}장 · 정답이 붙은 조각 {nlab}개 ({time.time()-t0:.0f}s)")
    for f, why in skipped: print(f"   ★제외: {f} — {why}")
    cnt = collections.Counter(g for r in recs for g in _label_map(r, gtmap).values())
    print(f"★정답 분포: {dict(cnt)}")
    au = _m([r['pred'].sum() / r['roi'].sum() for r in recs])
    ar = _m([r['roi'].mean() for r in recs])
    print(f"★비교군 U-Net(p>0.5 & ROI): ROI 대비 면적 {100*au:.2f} % · ROI 는 256² 의 {100*ar:.1f} %")

    res = {}
    for rn in (False, True):
        for p in pcts:
            res[(rn, p)] = evaluate(recs, gtmap, p, rn)
            print(f"   ...계산 {'roi_norm' if rn else 'native  '} p={p} ({time.time()-t0:.0f}s)")

    for rn in (False, True):
        tag = 'roi_norm=True (ROI 를 256 으로 확대 · 원저자 배율)' if rn else \
              'roi_norm=False (우리 256 격자 그대로)'
        print(f"\n{'='*94}\n★★[{tag}]\n{'='*94}")
        print("\n★① 픽셀 단위 — PCEM vs U-Net (23장 평균)")
        print(f"{'pct':>4} {'면적/ROI%':>9} {'U-Net면적%':>10} {'IoU':>7} {'Dice':>7} "
              f"{'clDice':>7} {'PCEM중 U-Net밖%':>15}")
        for p in pcts:
            d = res[(rn, p)]['px']
            print(f"{p:>4} {100*_m(d['a_pcem']):>9.2f} {100*_m(d['a_unet']):>10.2f} "
                  f"{_m(d['iou']):>7.3f} {_m(d['dice']):>7.3f} {_m(d['cldice']):>7.3f} "
                  f"{100*_m(d['extra']):>15.1f}")

        print("\n★② 조각 단위 재현율 — ★제이 정답 조각을 PCEM 이 덮는가 (평균 피복률)")
        print("   ★lift = 피복률 / (PCEM 면적비). ★1.0 = 무작위 마스크와 구별 안 됨")
        hdr = ' '.join(f"{k:>13}" for k in OK)
        print(f"{'pct':>4} {hdr}   |  lift(RLC/PTC/DTC/FATE/NONE)")
        for p in pcts:
            d = res[(rn, p)]; a = _m(d['px']['a_pcem'])
            cells = ' '.join(f"{_m(d['cov'][k]):>13.3f}" for k in OK)
            lifts = '/'.join(f"{_m(d['cov'][k])/a:.2f}" for k in OK)
            print(f"{p:>4} {cells}   |  {lifts}")
        print(f"{'':>4} " + ' '.join(f"{'n=%d'%len(res[(rn,pcts[0])]['cov'][k]):>13}" for k in OK))

        print("\n★③ 조각 피복률 ≥ 0.5 인 정답 조각 수 (★0.5 는 ★보고용 절단선입니다 · 임계 아님)")
        print(f"{'pct':>4} " + ' '.join(f"{k:>13}" for k in OK))
        for p in pcts:
            d = res[(rn, p)]
            print(f"{p:>4} " + ' '.join(
                f"{'%d/%d'%(sum(1 for c in d['cov'][k] if c>=0.5), len(d['cov'][k])):>13}"
                for k in OK))

        print("\n★④ PCEM 화소·조각이 ★어디에 놓이는가 (오탐 쪽)")
        print("   ★len_v>0.3 은 ★보고용 절단선입니다 (임계 아님) — 「긴 조각은 진짜 선인가」를 봅니다")
        print(f"{'pct':>4} {'선GT위%':>8} {'NONE위%':>8} {'둘다아님%':>10} "
              f"{'조각:선접촉':>10} {'NONE만':>8} {'무접촉':>8} | "
              f"{'긴것:선접촉':>10} {'NONE만':>8} {'무접촉':>8}")
        for p in pcts:
            d = res[(rn, p)]; ms = d['mass']; tot = max(sum(ms.values()), 1)
            ch, lh = d['comp_hit'], d['long_hit']
            print(f"{p:>4} {100*ms['on_line']/tot:>8.1f} {100*ms['on_none']/tot:>8.1f} "
                  f"{100*ms['on_bg']/tot:>10.1f} {ch['line']:>10} {ch['none_only']:>8} "
                  f"{ch['empty']:>8} | {lh['line']:>10} {lh['none_only']:>8} {lh['empty']:>8}")

        print("\n★⑤ ★U-Net 이 끊어 놓은 것을 PCEM 이 잇는가 (조각쌍이 ★한 PCEM 조각에 들어감)")
        print("   ★대조군이 핵심입니다 — 다른 선끼리·선/NONE 까지 같이 이어지면 ★변별이 없습니다")
        print(f"{'pct':>4} {'같은선쌍':>14} {'다른선쌍':>14} {'선-NONE쌍':>14}")
        for p in pcts:
            b = res[(rn, p)]['bridge']
            f = lambda k: f"{b[k][0]}/{b[k][1]} ({100*b[k][0]/max(b[k][1],1):.0f}%)"
            print(f"{p:>4} {f('same'):>14} {f('cross'):>14} {f('linenone'):>14}")

        print("\n★⑥ ★U-Net 과 ★한 화소도 안 겹치는 PCEM 조각 (=정답이 없는 후보 · ★미검증)")
        print(f"{'pct':>4} {'조각수':>8} {'len_v 중앙값':>12} {'len_v>0.3 개수':>14} "
              f"{'전체PCEM조각 len_v중앙값':>24}")
        for p in pcts:
            d = res[(rn, p)]; nv = d['novel']
            print(f"{p:>4} {len(nv):>8} {np.median(nv) if nv else float('nan'):>12.3f} "
                  f"{sum(1 for v in nv if v>0.3):>14} "
                  f"{np.median(d['comp_len']) if d['comp_len'] else float('nan'):>24.3f}")

        print("\n★⑦ ★⑤의 거리 통제 — ★같은 선 조각끼리는 ★원래 더 가깝습니다.")
        print("   ★같은 간격대 안에서 「같은선」이 「다른선」보다 높아야 ★진짜 신호입니다.")
        for p in pcts:
            g = res[(rn, p)]['gbin']
            cells = []
            for i, (lo, hi) in enumerate(GAPS):
                nm = f"{lo}-{hi}" if hi < 10 ** 6 else f"{lo}+"
                row = []
                for k in ('same', 'cross', 'linenone'):
                    n, t = g[(k, i)]
                    row.append(f"{n}/{t}({100*n/t:.0f}%)" if t else "-")
                cells.append(f"   간격 {nm:>6}px  같은선 {row[0]:>14}  "
                             f"다른선 {row[1]:>14}  선-NONE {row[2]:>14}")
            print(f"  p={p}\n" + "\n".join(cells))

        print("\n★⑩ ★연속성 — (이미지×클래스)마다 ★U-Net 최장 조각 vs ★그것을 품은 PCEM 최장 조각")
        print("   ★「3대선이 조각나 있다」가 얼마나 이어지는지를 잽니다. ★단, 길어진 원인이")
        print("   ★진짜 선 연장인지 ★잔주름 흡수인지는 ⑦·④와 함께 읽어야 합니다")
        print(f"{'pct':>4} {'U-Net 최장 중앙':>16} {'PCEM 최장 중앙':>16} {'배수 중앙':>10} "
              f"{'PCEM 이 더 긴 건수':>18}")
        for p in pcts:
            cc = res[(rn, p)]['cont']
            u = np.array([a for a, _ in cc]); q = np.array([b for _, b in cc])
            print(f"{p:>4} {np.median(u):>16.3f} {np.median(q):>16.3f} "
                  f"{np.median(q/np.maximum(u,1e-9)):>10.2f} "
                  f"{'%d/%d'%(int((q>u).sum()), len(cc)):>18}")

        print("\n★⑧ ★U-Net 이 ★통째로 놓친 선이 있는 장에서 PCEM 이 그것을 찾아내는가")
        print("   ★U-Net 조각에 해당 클래스 정답이 ★0개인 장이 대상입니다. ★정답이 없으므로 ★미검증 후보 수입니다")
        print(f"{'pct':>4} {'대상 장수':>9} {'장별 최대 novel len_v 중앙값':>28} {'len_v>0.3 인 장':>14}")
        for p in pcts:
            nm = res[(rn, p)]['novel_miss']
            print(f"{p:>4} {len(nm):>9} {np.median(nm) if nm else float('nan'):>28.3f} "
                  f"{'%d/%d'%(sum(1 for v in nm if v>0.3), len(nm)):>14}")

    # 참고: U-Net 조각의 len_v 분포
    ul = [palmtype.frag_features(pts, r['lm'])['len_v'] for r in recs for _, pts in r['comps']]
    print(f"\n★참고 — U-Net 조각 {len(ul)}개의 len_v 중앙값 {np.median(ul):.3f} · "
          f"len_v>0.3 {sum(1 for v in ul if v>0.3)}개")

    # ★⑨ U-Net 이 클래스를 통째로 놓친 빈도 (★PCEM 과 무관한 ★비교군 실측)
    miss = collections.Counter()
    for r in recs:
        have = set(_label_map(r, gtmap).values())
        for c in LINES:
            if c not in have: miss[c] += 1
    print(f"★참고 — U-Net 조각에 해당 클래스 정답이 ★0개인 장 (23장 중): "
          + ' · '.join(f"{c} {miss[c]}장" for c in LINES))

    if vis:
        _save_vis(recs, vis, pcts[len(pcts) // 2])
    print("\n★★임계를 고르지 않았습니다 — 표만 냅니다. 확정은 G-7 · P-33 소관(Tier-B 뒤)입니다.")


def _save_vis(recs, path, pct):
    """진단용 대조 그림: 원본 · U-Net · PCEM(native) · PCEM(roi_norm)"""
    rows = []
    for r in recs:
        base = (r['rgb'].astype(np.float32) * 0.45).astype(np.uint8)
        tiles = [r['rgb']]
        for m, col in ((r['pred'], (80, 220, 120)),
                       (pcem_mask(r['rgb'], r['roi'], pct, roi_norm=False), (250, 90, 90)),
                       (pcem_mask(r['rgb'], r['roi'], pct, roi_norm=True), (90, 150, 250))):
            t = base.copy(); t[m] = col; tiles.append(t)
        rows.append(np.concatenate(tiles, 1))
    Image.fromarray(np.concatenate(rows, 0)).save(path, quality=90)
    print(f"★대조 그림(p={pct}) → {path}   [원본 | U-Net | PCEM native | PCEM roi_norm]")


if __name__ == '__main__':
    a = sys.argv[1:]
    pcts = [int(x) for x in a[a.index('--pct') + 1].split(',')] if '--pct' in a \
        else [85, 88, 90, 92, 95]
    vis = a[a.index('--vis') + 1] if '--vis' in a else None
    main(pcts, vis)
