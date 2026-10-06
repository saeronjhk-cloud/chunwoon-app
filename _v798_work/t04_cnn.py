# t04 — 안경 감지 v2 소형 CNN(브라우저 이식용 · 약 1.2만 파라미터)
# 입력: _cwGlassesPatch 52×24(JS 로 추출) → 패치 표준화(평균0·표준편차1)
# 학습 p0~p2(원본·반전·열화·열화반전) · 검증 p3(조기종료·임계 결정) · 시험 p4·p5(1회)
import numpy as np,json,torch,torch.nn as nn,torch.nn.functional as Fn,sys
torch.manual_seed(0);np.random.seed(0);PW,PH=52,24
def load(n):
  X=np.fromfile(f'{n}.bin',np.float32).reshape(-1,PH,PW);M=json.load(open(f'{n}.meta.json'))
  y=np.concatenate([[1 if m['label']=='pos' else 0]*m['n'] for m in M]).astype(np.float32)
  k=np.concatenate([[m['k']]*m['n'] for m in M]);lab=np.concatenate([[m['label']]*m['n'] for m in M]);return X,y,k,lab
def std(X): m=X.mean((1,2),keepdims=True);s=X.std((1,2),keepdims=True);return (X-m)/(s+4.0)
Xa,ya,ka,_=load('r_tr');Xb,yb,kb,_=load('r_trd')
X=np.concatenate([Xa,Xb]);y=np.concatenate([ya,yb]);k=np.concatenate([ka,kb])
va=np.array([s.startswith('p3_') for s in k]);Xtr,ytr=std(X[~va]),y[~va];Xva,yva=std(X[va]),y[va]
class Net(nn.Module):
  def __init__(s):
    super().__init__();s.c1=nn.Conv2d(1,8,3,padding=1);s.c2=nn.Conv2d(8,16,3,padding=1);s.c3=nn.Conv2d(16,24,3,padding=1);s.f1=nn.Linear(24*3*6,16);s.f2=nn.Linear(16,1)
  def forward(s,x):
    x=Fn.max_pool2d(Fn.relu(s.c1(x)),2);x=Fn.max_pool2d(Fn.relu(s.c2(x)),2);x=Fn.max_pool2d(Fn.relu(s.c3(x)),2)
    return s.f2(Fn.relu(s.f1(x.flatten(1)))).squeeze(1)
net=Net();print('params',sum(p.numel() for p in net.parameters()))
opt=torch.optim.AdamW(net.parameters(),2e-3,weight_decay=1e-4);pw=torch.tensor(3.0)
Tx=torch.tensor(Xtr).unsqueeze(1);Ty=torch.tensor(ytr);Vx=torch.tensor(Xva).unsqueeze(1)
def shift(x):  # ±1px 무작위 이동(랜드마크 흔들림 모사)
  dx,dy=np.random.randint(-1,2,2);return torch.roll(x,(int(dy),int(dx)),(2,3))
def score(net,x):
  net.eval()
  with torch.no_grad(): return torch.cat([net(x[i:i+4096]) for i in range(0,len(x),4096)]).numpy()
best=(-1,None)
for ep in range(30):
  net.train();perm=torch.randperm(len(Tx))
  for i in range(0,len(perm),256):
    b=perm[i:i+256];xb=shift(Tx[b]);loss=Fn.binary_cross_entropy_with_logits(net(xb),Ty[b],pos_weight=pw);opt.zero_grad();loss.backward();opt.step()
  sv=score(net,Vx);t=np.quantile(sv[yva==0],0.995);r=(sv[yva==1]>t).mean()
  print(ep,'val 재현@오탐0.5%',round(r,4),flush=True)
  if r>best[0]: best=(r,{k_:v.clone() for k_,v in net.state_dict().items()},ep)
net.load_state_dict(best[1]);torch.save(best[1],'t04_cnn.pt')
sv=score(net,Vx);thr={q:float(np.quantile(sv[yva==0],q)) for q in [0.99,0.995,0.998]}
json.dump({'best_ep':best[2],'val_recall':best[0],'thr_val':thr},open('t04_model.json','w'),indent=1)
print('best ep',best[2],thr)
for nm in ['r_te','r_ted','r_sel']:
  Xt,yt,kt,lab=load(nm);st=score(net,torch.tensor(std(Xt)).unsqueeze(1))
  for q,t in thr.items():
    miss=[s for s,l,v in zip(kt,lab,st) if l=='pos' and v<t] if nm=='r_sel' else ''
    print(f'{nm} q{q} t{t:.3f} 재현 {(st[lab=="pos"]>=t).sum()}/{(lab=="pos").sum()} 오탐 무안경 {(st[lab=="neg"]>=t).sum()}/{(lab=="neg").sum()} 머리위 {(st[lab=="head"]>=t).sum()}/{(lab=="head").sum()} {miss}')
  np.save(f't04_scores_{nm}.npy',st)
