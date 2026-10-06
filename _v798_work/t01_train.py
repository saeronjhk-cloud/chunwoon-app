# t01 — 안경 감지 v2 학습(HOG 2160 → 로지스틱 회귀 L2)
# 학습: CelebAMask-HQ p0~p3 = 원본+좌우반전(f_tr) + 열화본(f_trd: 축소·대비·잡음) · 같은 사진은 같은 fold(GroupKFold)
# 임계: 학습 OOF 점수에서 음성(무안경+머리위) 오탐률 목표로 결정 → 시험(p4·p5)은 1회만 적용
import numpy as np,json
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GroupKFold
D=2160
def load(n):
  X=np.fromfile(f'{n}.bin',np.float32).reshape(-1,D);M=json.load(open(f'{n}.meta.json'));
  y=np.concatenate([[1 if m['label']=='pos' else 0]*m['n'] for m in M]);g=np.concatenate([[m['k']]*m['n'] for m in M]);return X,y,g,M
Xa,ya,ga,_=load('f_tr');Xb,yb,gb,_=load('f_trd');X=np.vstack([Xa,Xb]);y=np.concatenate([ya,yb]);g=np.concatenate([ga,gb])
_,gi=np.unique(g,return_inverse=True)
oof={}
for C in [0.1,0.3,1.0]:
  s=np.zeros(len(y))
  for tri,vai in GroupKFold(4).split(X,y,gi):
    s[vai]=LogisticRegression(C=C,max_iter=4000).fit(X[tri],y[tri]).decision_function(X[vai])
  oof[C]=s;t=np.quantile(s[y==0],0.995);print('C',C,'OOF 재현@오탐0.5%',round((s[y==1]>t).mean(),4),flush=True)
C=max(oof,key=lambda c:(oof[c][y==1]>np.quantile(oof[c][y==0],0.995)).mean())
s=oof[C];thr={q:float(np.quantile(s[y==0],q)) for q in [0.99,0.995,0.998]}
m=LogisticRegression(C=C,max_iter=6000).fit(X,y);w=m.coef_[0];b=float(m.intercept_[0])
np.save('t01_w.npy',w);json.dump({'C':C,'b':b,'thr_oof':thr},open('t01_model.json','w'),indent=1)
print('C',C,'임계(OOF)',thr)
for nm in ['f_te','f_ted','f_sel']:
  Xt,yt,gt,M=load(nm);sc=Xt@w+b;lab=np.array([mm['label'] for mm in M if mm['n']])
  for q,t in thr.items():
    print(f'{nm} q{q} t{t:.3f} 재현 {(sc[lab=="pos"]>=t).sum()}/{(lab=="pos").sum()} 오탐 무안경 {(sc[lab=="neg"]>=t).sum()}/{(lab=="neg").sum()} 머리위 {(sc[lab=="head"]>=t).sum()}/{(lab=="head").sum()}')
