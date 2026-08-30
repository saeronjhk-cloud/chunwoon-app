"""★★C_train(Roboflow palmistry_seg) 검수 (2026-08-29 · ADR-002)

★★목적: ★학습 전에 ★데이터가 우리 용도에 맞는지 ★실측합니다.
   ★나쁜 데이터로 학습하면 ★그 시간이 통째로 낭비됩니다.

★확인하는 것
   ① 클래스 목록·어노테이션 수 — ★우리 4클래스(RLC/PTC/DTC/FATE)와 대응되는가
   ② ★출처 분리 — 파일명이 `Hand_00XXXXX`(11k Hands 유래)인가 `IMG_xxxx`(자체 촬영)인가
   ③ ★라벨 위치 — ★손바닥 중앙인가 ★손가락 쪽인가 (y 분포)
   ④ ★이미지 밝기·대비 — ★어두우면 손금 고랑이 안 보입니다
   ⑤ ★선 길이·굵기 — 우리 GT 규격과 자릿수가 맞는가
   ⑥ ★한 장에 클래스가 몇 개씩 있는가 — ★4선이 다 라벨된 장이 얼마나 되는가

★NOT_A_VERDICT — ★관측입니다. ★임계를 정하지 않습니다.
사용: python3 audit_ctrain.py <C_train 루트>
"""
import sys, os, json, glob
import numpy as np
from PIL import Image


def load_split(root, split):
    p = os.path.join(root, split, '_annotations.coco.json')
    if not os.path.exists(p): return None
    with open(p, encoding='utf-8') as f: return json.load(f)


def origin(name):
    """파일명으로 출처를 가릅니다 (TierA수집 v2 §1-1)."""
    b = os.path.basename(name)
    if b.startswith('Hand_0'): return '11k Hands 유래(추정)'
    if b.upper().startswith('IMG_'): return '자체 촬영(추정)'
    return '기타/미확인'


def main(root):
    print("★★NOT_A_VERDICT — 학습 전 데이터 검수입니다. 관측만 합니다.\n")
    tot_img, tot_ann = 0, 0
    cats, per_img_cls, origins = {}, [], {}
    areas, ys, xs, lens = [], [], [], []
    bright, sizes = [], []

    for split in ('train', 'valid', 'test'):
        d = load_split(root, split)
        if d is None: continue
        id2n = {im['id']: im['file_name'] for im in d['images']}
        id2wh = {im['id']: (im['width'], im['height']) for im in d['images']}
        catmap = {c['id']: c['name'] for c in d['categories']}
        for c in d['categories']:
            cats.setdefault(c['name'], 0)
        byimg = {}
        for a in d['annotations']:
            nm = catmap.get(a['category_id'], '?')
            cats[nm] = cats.get(nm, 0) + 1
            byimg.setdefault(a['image_id'], set()).add(nm)
            W, H = id2wh.get(a['image_id'], (640, 640))
            areas.append(a.get('area', 0)/(W*H)*100)
            seg = a.get('segmentation') or []
            if seg and isinstance(seg[0], list) and len(seg[0]) >= 6:
                p = np.array(seg[0], float).reshape(-1, 2)
                ys.append(float(p[:, 1].mean()/H)); xs.append(float(p[:, 0].mean()/W))
                lens.append(float(np.hypot(*(p.max(0)-p.min(0)))/max(W, H)))
            tot_ann += 1
        for im in d['images']:
            tot_img += 1
            origins[origin(im['file_name'])] = origins.get(origin(im['file_name']), 0) + 1
            per_img_cls.append(len(byimg.get(im['id'], ())))
            sizes.append((im['width'], im['height']))
        print(f"{split:>6}: 이미지 {len(d['images']):>4} · 어노테이션 {len(d['annotations']):>5} · "
              f"클래스 {[c['name'] for c in d['categories']]}")

    print(f"\n합계: 이미지 {tot_img} · 어노테이션 {tot_ann}")

    print("\n① ★클래스별 어노테이션 수")
    for k, v in sorted(cats.items(), key=lambda x: -x[1]):
        print(f"   {k:>12}: {v:>5}")

    print("\n② ★출처 (파일명 기준 · TierA수집 v2 §1-1)")
    for k, v in sorted(origins.items(), key=lambda x: -x[1]):
        print(f"   {k:>18}: {v:>4}장 ({v/max(tot_img,1)*100:.0f} %)")

    print("\n③ ★한 장에 라벨된 ★서로 다른 클래스 수")
    pc = np.array(per_img_cls)
    for k in range(0, int(pc.max())+1 if len(pc) else 1):
        n = int((pc == k).sum())
        if n: print(f"   {k}종: {n:>4}장  {'█'*int(n/max(tot_img,1)*40)}")
    print(f"   ★4종 이상 = {int((pc >= 4).sum())}장 ({(pc>=4).mean()*100:.0f} %)")

    if ys:
        y = np.array(ys); x = np.array(xs); a = np.array(areas); L = np.array(lens)
        print("\n④ ★라벨 위치 — ★세로(y) 분포  0=위(손가락) · 1=아래(손목)")
        for lo in np.arange(0, 1.0, 0.125):
            n = int(((y >= lo) & (y < lo+0.125)).sum())
            print(f"   {lo:.2f}~{lo+0.125:.2f}: {n:>5}  {'█'*int(n/len(y)*60)}")
        print(f"   ★중앙값 y={np.median(y):.3f} · x={np.median(x):.3f}")
        print(f"\n⑤ ★어노테이션 면적 비율(%) 중앙값 {np.median(a):.3f} · "
              f"90분위 {np.percentile(a,90):.3f}")
        print(f"   ★대각 길이/이미지 변 중앙값 {np.median(L):.3f}")

    print("\n⑥ ★이미지 크기")
    from collections import Counter
    for s, n in Counter(sizes).most_common(3): print(f"   {s[0]}×{s[1]}: {n}장")

    print("\n⑦ ★밝기 (표본 60장 · 0~255)")
    fs = sorted(glob.glob(os.path.join(root, '*', '*.jpg')))
    step = max(1, len(fs)//60)
    for f in fs[::step][:60]:
        try:
            g = np.asarray(Image.open(f).convert('L'), np.float32)
            bright.append((g.mean(), g.std()))
        except Exception: pass
    if bright:
        b = np.array(bright)
        print(f"   평균 밝기 중앙값 {np.median(b[:,0]):.1f} · 범위 {b[:,0].min():.0f}~{b[:,0].max():.0f}")
        print(f"   대비(표준편차) 중앙값 {np.median(b[:,1]):.1f}")
        dark = int((b[:, 0] < 80).sum())
        print(f"   ★어두운 편(<80) {dark}/{len(b)}장")


if __name__ == '__main__':
    if len(sys.argv) != 2: print(__doc__); sys.exit(2)
    main(sys.argv[1])
