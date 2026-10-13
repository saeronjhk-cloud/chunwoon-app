# x02 — 미소 판정기: 학습(tr)에서 로지스틱 적합 → 검증(va)에서 임계 결정 → 시험(te)은 --test 일 때만 1회.
# 사용: python x02_fit.py [--test]
import json, sys, math, random
import numpy as np
from smile_feat import feats, FEATS
def load(fn):
    d = json.load(open(fn))['items']; X, y, ids = [], [], []
    for k, e in d.items():
        f = feats(e['lm'], e['w'], e['h']); X.append([f[n] for n in FEATS]); y.append(1 if e['smile'] else 0); ids.append(e['id'])
    return np.array(X), np.array(y), ids
Xtr, ytr, _ = load('tr.json'); Xva, yva, _ = load('va.json')
print('n', len(ytr), len(yva), '· 미소 비율', round(ytr.mean(), 3), round(yva.mean(), 3))
def auc(s, y):
    o = np.argsort(s); r = np.empty(len(s)); r[o] = np.arange(1, len(s) + 1)
    p = y.sum(); n = len(y) - p; return (r[y == 1].sum() - p * (p + 1) / 2) / (p * n)
print('\n[1] 단일 특징 AUC(검증) — 방향 자동')
for i, n in enumerate(FEATS):
    a = auc(Xva[:, i], yva); print(f'  {n:10s} AUC {max(a,1-a):.3f} ({"+" if a>=0.5 else "−"}) · 미소 중앙 {np.median(Xva[yva==1,i]):.3f} · 무표정 중앙 {np.median(Xva[yva==0,i]):.3f}')
mu, sd = Xtr.mean(0), Xtr.std(0) + 1e-9
def fit(X, y, m, l2=1e-2, it=3000, lr=0.5):
    Z = (X - mu[m]) / sd[m]; w = np.zeros(Z.shape[1]); b = 0.0
    for _ in range(it):
        p = 1 / (1 + np.exp(-(Z @ w + b))); g = p - y
        w -= lr * (Z.T @ g / len(y) + l2 * w); b -= lr * g.mean()
    return w, b

res = {}
for name, cols in [('5특징', list(range(len(FEATS)))), ('wide 제외 4특징', [0, 2, 3, 4]), ('lift+gap+lowcurve', [0, 2, 3]), ('lift 단독', [0])]:
    m = np.zeros(len(FEATS), bool); m[cols] = True
    w, b = fit(Xtr[:, m], ytr, m)
    mu_s, sd_s = mu, sd
    s = ((Xva[:, m] - mu[m]) / sd[m]) @ w + b
    res[name] = (m, w, b); print(f'\n[2] {name}: 검증 AUC {auc(s, yva):.3f}')
    # 임계: 무표정(음성) 오보류율 ≤ 5% 를 지키는 가장 낮은 점수 — 「무표정 사진을 웃었다고 막는」 피해를 우선 억제
    neg = np.sort(s[yva == 0]); t95 = neg[int(0.95 * (len(neg) - 1))]
    tpr = (s[yva == 1] > t95).mean(); print(f'    임계(무표정 FPR 5%) logit {t95:.3f} → 미소 검출률 {tpr:.3f}')
    for fpr in [0.02, 0.10]:
        t = neg[int((1 - fpr) * (len(neg) - 1))]; print(f'    (참고) FPR {fpr:.0%} → logit {t:.3f} · 검출률 {(s[yva==1]>t).mean():.3f}')
    res[name] = (m, w, b, t95)
import pickle; pickle.dump({k:(v[0].tolist(),v[1].tolist(),float(v[2]),float(v[3])) for k,v in res.items()}|{'_mu':mu.tolist(),'_sd':sd.tolist()}, open('models.pkl','wb'))
m, w, b, t = res['5특징']
json.dump({'feats': FEATS, 'mu': mu.tolist(), 'sd': sd.tolist(), 'w': w.tolist(), 'b': b, 'logitT': float(t), 'rule': '무표정 FPR 5%(검증)'}, open('smile_model.json', 'w'), indent=1)
print('\n저장 smile_model.json(5특징)')
if '--test' in sys.argv:
    Xte, yte, _ = load('te.json'); s = score(Xte[:, m], w, b) if False else ((Xte[:, m]-mu[m])/sd[m])@w+b
    print(f'\n[3] ★시험 1회: n {len(yte)} · AUC {auc(s, yte):.3f} · 무표정 오보류 {(s[yte==0]>t).mean():.3f} · 미소 검출률 {(s[yte==1]>t).mean():.3f}')
