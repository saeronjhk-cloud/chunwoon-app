"""★★P-58 진단 — ★도메인 격차가 ★어디서 오는가 (2026-08-29)

★★계기: ★배정 트리(P-53)가 ★Roboflow 박스 GT 에서는 ★76.6 % 인데,
   ★우리 도메인(A-smoke · 제이 손) 시각화에서는 ★DTC 가 ★엄지두덩 쪽에 배정된 장이 보입니다.

★★정답이 없어도 ★특징 분포는 비교할 수 있습니다.
   ★트리는 ★`u_max`·`v_max` 로 판정하므로, ★그 분포가 두 도메인에서 다르면
   ★★학습한 경계가 ★우리 쪽에서 ★엉뚱한 자리에 놓입니다.

★비교 항목
   ① ★손바닥 종횡비 `wid/hgt` — 손가락을 편 정도·촬영 각도에 따라 달라집니다
   ② ★조각 특징 분포 — u_max · v_max · span_u · ang_v_deg
   ③ ★조각 수 · 조각 크기
   ④ ★트리 분기점(u_max 0.50 / 0.21, v_max 0.64 / 0.24) 기준 ★양쪽 비율

★NOT_A_VERDICT — 관측입니다.
사용: python3 p58_domain.py
"""
import sys, os, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image

from harness import crop_box, crop_to_S, S, PALM_GROW
from pthread import load
from unet_np import forward
import palmroi, palmtype
from bench_assign import load_cache, FEATURES

# ★트리(depth 4)가 쓰는 분기점 — ★assign_tree.json 에서 온 값입니다
CUTS = (('u_max', 0.5008), ('u_max', 0.2054), ('v_max', 0.6357), ('v_max', 0.2376))


def a_smoke_feats(root, ckpt, limit=None):
    imgs = sorted(glob.glob(os.path.join(root, '**', '*.jpg'), recursive=True))
    imgs = [i for i in imgs if '/masks/' not in i.replace('\\', '/')]
    if limit: imgs = imgs[:limit]
    sd = load(ckpt)
    rows, ratios, nfrag = [], [], []
    for p in imgs:
        im = Image.open(p).convert('RGB')
        cb = crop_box(im)
        if cb is None: continue
        rgb = np.asarray(crop_to_S(im, cb), np.float32)
        roi, lm, side = palmroi.palm_roi(rgb, grow=PALM_GROW)
        if roi is None: continue
        u, v, wid, hgt = palmroi.palm_frame(lm)
        ratios.append(wid/hgt)
        lg = forward(np.ascontiguousarray(rgb.transpose(2, 0, 1)/255.), sd)
        pred = (1/(1+np.exp(-lg)) > 0.5) & roi
        comps = palmtype.components(pred)
        nfrag.append(len(comps))
        for _, pts in comps:
            f = palmtype.frag_features(pts, lm)
            rows.append([f[k] if k != 'degenerate' else (1.0 if f['degenerate'] else 0.0)
                         for k in FEATURES])
    return (np.nan_to_num(np.array(rows, np.float32)),
            np.array(ratios), np.array(nfrag))


def q(a, name):
    return (f"{name:>10}: 중앙값 {np.median(a):>7.3f} · "
            f"25~75% {np.percentile(a,25):>6.3f}~{np.percentile(a,75):>6.3f} · "
            f"범위 {a.min():>6.3f}~{a.max():>6.3f}")


def main():
    A = os.environ.get('CW_PALM_DATA', r'D:\ChunWoon_palm_dataset\A-smoke')
    C = os.environ.get('CW_PALM_CTRAIN', r'D:\ChunWoon_palm_dataset\C_train')
    ck = os.environ.get('CW_PALM_CKPT', 'palm-api/checkpoint_aug_epoch70.pth')

    print("★★NOT_A_VERDICT — 도메인 격차 진단 (P-58)\n")
    Xc, yc, imgc, spc, filesc = load_cache(C)
    Xa, ratA, nfA = a_smoke_feats(A, ck)
    ix = {k: i for i, k in enumerate(FEATURES)}

    print(f"★A-smoke (우리 도메인 · 제이 손): 조각 {len(Xa)}개 · 이미지 {len(nfA)}장")
    print(f"★C_train (학습 도메인 · 스튜디오): 조각 {len(Xc)}개\n")

    print("── ① 손바닥 종횡비 wid/hgt ──")
    print(q(ratA, 'A-smoke'))
    print("   ★C_train 은 캐시에 종횡비를 저장하지 않아 ★비교 불가 (미확인)\n")

    print("── ② 조각 특징 분포 ──")
    for k in ('u_max', 'v_max', 'span_u', 'ang_v_deg', 'npix'):
        print(f"  ★{k}")
        print("   A-smoke " + q(Xa[:, ix[k]], '')[10:])
        print("   C_train " + q(Xc[:, ix[k]], '')[10:])

    print("\n── ③ 조각 수 (장당) ──")
    print(f"   A-smoke 평균 {nfA.mean():.1f} · 범위 {nfA.min()}~{nfA.max()}")
    _, cnt = np.unique(imgc, return_counts=True)
    print(f"   C_train 평균 {cnt.mean():.1f} · 범위 {cnt.min()}~{cnt.max()}")

    print("\n── ④ ★트리 분기점 기준 양쪽 비율 ──")
    print(f"   {'분기':>22} {'A-smoke':>10} {'C_train':>10}  {'차이':>8}")
    for k, t in CUTS:
        a = float((Xa[:, ix[k]] <= t).mean()*100)
        c = float((Xc[:, ix[k]] <= t).mean()*100)
        flag = " ★★" if abs(a-c) > 15 else (" ★" if abs(a-c) > 8 else "")
        print(f"   {k} <= {t:<6.4f} {a:>9.1f}% {c:>9.1f}% {a-c:>+8.1f}%p{flag}")

    print("\n★★읽는 법: ★차이가 크면 ★학습한 경계가 ★우리 도메인에서 ★엉뚱한 자리에 놓입니다.")
    print("   ★특히 ★`u_max <= 0.5008` 은 ★DTC 를 가르는 ★최상위 분기입니다 —")
    print("   ★여기서 비율이 크게 다르면 ★DTC 오배정의 ★직접 원인입니다.")


if __name__ == '__main__':
    main()
