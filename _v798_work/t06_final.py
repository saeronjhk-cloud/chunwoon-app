# t06 — 출시 엔진(JS int8) 기준 임계 결정(검증 p3 원본+열화, 음성 오탐 0.2%) → 시험 p4·p5 1회 · 셀카셋 관문
import numpy as np,json
def ld(nm):
  M=[m for m in json.load(open(f'{nm}.meta.json')) if m['n']];s=np.array(json.load(open(f'{nm}.jslogit.json')));return s,np.array([m['label'] for m in M]),np.array([m['k'] for m in M])
a,la,_=ld('v_p3');b,lb,_=ld('v_p3d');sv=np.concatenate([a,b]);lv=np.concatenate([la,lb])
t=float(np.quantile(sv[lv!='pos'],0.998));print('임계 logit',round(t,3),'· 검증 재현',round((sv[lv=='pos']>=t).mean(),4))
J={}
for p in ['p4','p5']: J.update(json.load(open(f'full/{p}.json'))['items'])
def front(k):  # 정면성: 코끝(1)과 양 볼(234·454) 가로 비대칭 |dl-dr|/(dl+dr)
  L=J[k]['lm'];dl=L[1][0]-L[234][0];dr=L[454][0]-L[1][0];return abs(dl-dr)/(dl+dr)
res={'thr':t}
for nm in ['r_te','r_ted','r_sel']:
  s,l,k=ld(nm);P=l=='pos';N=l=='neg';H=l=='head'
  r={'recall':[int((s[P]>=t).sum()),int(P.sum())],'fp_neg':[int((s[N]>=t).sum()),int(N.sum())],'fp_head':[int((s[H]>=t).sum()),int(H.sum())]}
  if nm!='r_sel':
    fr=np.array([front(x)<0.25 for x in k]);r['frontal']={'recall':[int((s[P&fr]>=t).sum()),int((P&fr).sum())],'fp_neg':[int((s[N&fr]>=t).sum()),int((N&fr).sum())]}
  else: r['miss']=[x for x,y,z in zip(k,l,s) if y=='pos' and z<t];r['fp']=[x for x,y,z in zip(k,l,s) if y!='pos' and z>=t]
  res[nm]=r;print(nm,r)
json.dump(res,open('t06_result.json','w'),ensure_ascii=False,indent=1)
