"""clDice (Shit et al., CVPR 2021, pp.16560-16569) — numpy 구현.
clDice = 2·Tprec·Tsens/(Tprec+Tsens)
  Tprec(P,L) = |skel(P) ∩ L| / |skel(P)|     Tsens(L,P) = |skel(L) ∩ P| / |skel(L)|
★원저자는 위상 보존을 ★binary 분할에 한정해 증명했습니다(라벨규칙 §7-2 ④)."""
import numpy as np

def _nb(p):                       # P2..P9 (북→시계방향)
    return [p[0:-2,1:-1], p[0:-2,2:], p[1:-1,2:], p[2:,2:],
            p[2:,1:-1],   p[2:,0:-2], p[1:-1,0:-2], p[0:-2,0:-2]]

def skeletonize(img, max_iter=200):
    """Zhang-Suen 세선화 → 1픽셀 골격"""
    m = img.astype(bool).copy()
    for _ in range(max_iter):
        changed = False
        for step in (0, 1):
            p = np.pad(m, 1, constant_values=False)
            P = _nb(p); Pi = [x.astype(np.uint8) for x in P]
            B = sum(Pi)
            seq = Pi + [Pi[0]]
            A = sum(((seq[i]==0) & (seq[i+1]==1)).astype(np.uint8) for i in range(8))
            if step == 0:
                c = (~P[0] | ~P[2] | ~P[4]) & (~P[2] | ~P[4] | ~P[6])
            else:
                c = (~P[0] | ~P[2] | ~P[6]) & (~P[0] | ~P[4] | ~P[6])
            rm = m & (B>=2) & (B<=6) & (A==1) & c
            if rm.any(): m &= ~rm; changed = True
        if not changed: break
    return m

def cl_dice(pred, gt, eps=1e-9):
    P, L = pred.astype(bool), gt.astype(bool)
    if not P.any() or not L.any(): return 0.0
    sP, sL = skeletonize(P), skeletonize(L)
    tprec = (sP & L).sum()/(sP.sum()+eps)
    tsens = (sL & P).sum()/(sL.sum()+eps)
    return float(2*tprec*tsens/(tprec+tsens+eps))

def dice(p,g,eps=1e-9):
    p,g=p.astype(bool),g.astype(bool)
    return float(2*(p&g).sum()/(p.sum()+g.sum()+eps))

def iou(p,g,eps=1e-9):
    p,g=p.astype(bool),g.astype(bool)
    return float((p&g).sum()/((p|g).sum()+eps))
