// 미소 판정 JS 기준 구현(★코어 이식 원본) — smile_feat.py 와 같은 식. smile_model.json(학습 CelebA) 계수.
// 입력: aiRaw(정규화 0~1 랜드마크 {x,y}) · W·H(이미지 픽셀). 출력 {logit, warn, hold, f}
'use strict';
const M=require('./smile_model.json');
function smileFeats(ai,W,H){const P=ai.map(a=>[a.x*W,a.y*H]);
 const ax=P[263][0]-P[33][0],ay=P[263][1]-P[33][1],t=-Math.atan2(ay,ax),c=Math.cos(t),s=Math.sin(t);
 const cx=(P[33][0]+P[263][0])/2,cy=(P[33][1]+P[263][1])/2;
 const Q=P.map(([x,y])=>[(x-cx)*c-(y-cy)*s,(x-cx)*s+(y-cy)*c]);
 const en=Math.abs(Q[362][0]-Q[133][0])||1e-6,mw=Math.abs(Q[291][0]-Q[61][0])||1e-6;
 const cornerY=(Q[61][1]+Q[291][1])/2,midY=(Q[13][1]+Q[14][1])/2,noseY=Q[2][1];
 return {lift:(midY-cornerY)/mw,wide:mw/en,gap:Math.abs(Q[14][1]-Q[13][1])/mw,lowcurve:(Q[17][1]-cornerY)/mw,cornerDrop:(cornerY-noseY)/en};}
function smileScore(ai,W,H){const f=smileFeats(ai,W,H);let z=M.b;M.feats.forEach((n,i)=>{z+=M.w[i]*(f[n]-M.mu[i])/M.sd[i];});
 return {logit:z,warn:z>M.warnT,hold:z>M.holdT,f};}
module.exports={smileFeats,smileScore,M};
