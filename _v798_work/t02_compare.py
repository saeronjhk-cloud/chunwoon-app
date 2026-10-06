import numpy as np,json,time
from sklearn.neural_network import MLPClassifier
from sklearn.linear_model import LogisticRegression
D=2160
def load(n):
  X=np.fromfile(f'{n}.bin',np.float32).reshape(-1,D);M=json.load(open(f'{n}.meta.json'));
  y=np.concatenate([[1 if m['label']=='pos' else 0]*m['n'] for m in M]);k=np.concatenate([[m['k']]*m['n'] for m in M]);return X,y,k
Xa,ya,_=load('f_tr');Xb,yb,_=load('f_trd');X=np.vstack([Xa,Xb]);y=np.concatenate([ya,yb])
Xt,yt,_=load('f_te');Xd,yd,_=load('f_ted');Xs,ys,ks=load('f_sel')
def rep(nm,f):
  st=f(Xt);t=np.quantile(st[yt==0],0.995)  # 시험 음성 기준 오탐 0.5% 고정 비교(모델 간 비교용)
  sd=f(Xd);ss=f(Xs)
  print(f'{nm}: 시험 재현@오탐0.5% {(st[yt==1]>t).mean():.3f} | 열화 재현 {(sd[yd==1]>t).mean():.3f} 오탐 {(sd[yd==0]>t).mean():.4f} | 셀카 재현 {(ss[ys==1]>t).sum()}/{(ys==1).sum()} 오탐 {(ss[ys==0]>t).sum()} 놓침 {list(ks[(ys==1)&(ss<=t)])}',flush=True)
lr=LogisticRegression(C=0.1,max_iter=4000).fit(X,y);rep('LR',lr.decision_function)
for h in [(32,),(64,)]:
  t0=time.time();m=MLPClassifier(h,alpha=1e-3,max_iter=60,early_stopping=True,random_state=0).fit(X,y);rep(f'MLP{h} {time.time()-t0:.0f}s',lambda Z:np.log(m.predict_proba(Z)[:,1]+1e-9)-np.log(m.predict_proba(Z)[:,0]+1e-9))
