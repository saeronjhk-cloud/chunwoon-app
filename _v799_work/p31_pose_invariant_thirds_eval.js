// ============================================================
//  P-31 · 상하 고개에 흔들리지 않는 삼정(三停) 계측 — v799 P-799-C 2단계
//  node _v799_work/p31_pose_invariant_thirds_eval.js
// ------------------------------------------------------------
//  결함(진단 d17·d18): 대칭·천이 정면화(p30) 뒤 같은 사람 종합 점수 편차의 최대 성분이 삼정(표준편차 기여 1.8점).
//   원인 ① 2D 中/下停 비가 상하 고개에 끌림(사람 안 상관 0.79 · 사람별 표준편차 중앙 0.054)
//        ② 머리선 보임/가림(OK↔BANGS)에 따라 3분↔2분 공식이 바뀌어 같은 사람도 0.64~0.99 로 뜀 → 정책 판단(자문 P-799-C)
//  이 평가는 ①(계측)만 다룬다. ②는 점수 정책이라 별도.
//  기준(코어 수정 평가 전에 정함 · d18 수치는 진단값):
//   T1 사람별 中/下停 비 표준편차 중앙 ≤ 0.042 (수리 전 0.054 의 약 −25%)
//   T2 사람 안 中/下停 비 ↔ 상하각(정면화 법선) 상관 ≤ 0.6 (수리 전 0.79)
//   T3 합성 상하 회전 ±10°(정면 사진 3D 점 회전·정사영) → 삼정 점수 변화 ≤ 0.02
//   T4 민감도 보존: 합성 하정 10% 연장(코밑 아래 점을 아래로) → 삼정 점수 0.05 이상 변화
//   T5 z 없는 입력(모두 0) → 종전 2D 값과 동일(후퇴)
//   T6 인터넷 23장·셀카 전부 유한값 · thirdsParts 분포 기록(머리선 판정은 무변경이어야 함)
// ============================================================
'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib');const Lb=require('./persp_v2_lib.js');
const ROOT=path.join(__dirname,'..'),IP=path.join(ROOT,'..','ChunWoon_IP','face');
const C=Lb.loadCore(process.env.P17_INDEX||path.join(ROOT,'index.html'));
let total=0,pass=0;const fails=[];function check(id,name,ok,detail){total++;if(ok)pass++;else fails.push(id);console.log(`  ${ok?'ok  ':'FAIL'} ${id} ${name} — ${detail}`);}
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],sub=(a,b)=>[a.x-b.x,a.y-b.y,a.z-b.z],nrm=a=>{const l=Math.sqrt(dot(a,a));return a.map(v=>v/l);};
const pitchDeg=p=>{const ex=nrm(sub(p[454],p[234]));const u=sub(p[10],p[152]),k=dot(u,ex);const ey=nrm([u[0]-k*ex[0],u[1]-k*ex[1],u[2]-k*ex[2]]);return Math.asin(ex[2]*ey[0]-ex[0]*ey[2])*180/Math.PI;};
function load(dir){const L=JSON.parse(fs.readFileSync(path.join(IP,dir,'cache','landmarks.json'),'utf8'));return [L,k=>{const d=L[k];const ai=d.lm.map(a=>({x:a[0],y:a[1],z:a[2]}));const mp=path.join(IP,dir,'cache',k+'.mask.gz');const hr=fs.existsSync(mp)?C._cwHairline(zlib.gunzipSync(fs.readFileSync(mp)),d.w,d.h,ai):null;return {d,ai,A:d.h/d.w,hr};}];}
const [LB,fL]=load('eval_labelset'),[SB,fS]=load('eval_selfie');
// 中/下停 비: 2분 점수에서 역산하지 않고, 머리선 없이(hr=null) 계측한 thirds 로부터 r 을 복원 — 2분 점수 = 1−2|r−1|/(r+1) 는 r↔1/r 대칭이라 방향을 못 담음
//  → 계측 원본: 머리선 없는 raw 의 midOverLow 축이 있으면 그것을, 없으면 점수로 대신
const rows=[];const add=(g,x)=>{const raw=C._cwFaceMeasureRaw(x.ai,x.A,null);const p=x.ai.map(a=>({x:a.x,y:a.y*x.A,z:a.z||0}));rows.push({g,th:raw.thirds,r:raw.thirdsMidLow!=null?raw.thirdsMidLow:null,pd:pitchDeg(p)});};
for(const k of Object.keys(LB))add(LB[k].pid,fL(k));
for(const k of Object.keys(SB).filter(k=>/^p2_2026_nog/.test(k)))add('P2',fS(k));
for(const k of Object.keys(SB).filter(k=>/^jay_2026_nog/.test(k)))add('J0',fS(k));
const by={};rows.forEach(r=>(by[r.g]=by[r.g]||[]).push(r));
const sd=a=>{const m=a.reduce((x,y)=>x+y)/a.length;return Math.sqrt(a.reduce((x,y)=>x+(y-m)**2,0)/a.length);};
const corr=(x,y)=>{const mx=x.reduce((a,b)=>a+b)/x.length,my=y.reduce((a,b)=>a+b)/y.length;let s=0,sx=0,sy=0;for(let i=0;i<x.length;i++){s+=(x[i]-mx)*(y[i]-my);sx+=(x[i]-mx)**2;sy+=(y[i]-my)**2;}return s/Math.sqrt(sx*sy);};
const hasR=rows.every(r=>r.r!=null);
{const v=hasR?Lb.med(Object.values(by).map(a=>sd(a.map(r=>r.r)))):null;check('T1','사람별 中/下停 비 표준편차 중앙 ≤0.042',v!=null&&v<=0.042,hasR?`${v.toFixed(3)} (수리 전 0.054)`:'계측 원본 thirdsMidLow 없음(수리 전)');}
{let c=null;if(hasR){const xs=[],ys=[];for(const a of Object.values(by)){const m=a.reduce((s,r)=>s+r.r,0)/a.length,mp=a.reduce((s,r)=>s+r.pd,0)/a.length;a.forEach(r=>{xs.push(r.r-m);ys.push(r.pd-mp);});}c=corr(xs,ys);}
 check('T2','사람 안 中/下停 비 ↔ 상하각 상관 ≤0.6',c!=null&&c<=0.6,c!=null?`${c.toFixed(2)} (수리 전 0.79)`:'계측 원본 없음(수리 전)');}
const base=(()=>{let best=null;for(const k of Object.keys(LB)){const p=LB[k].lm.map(a=>({x:a[0],y:a[1],z:a[2]}));const v=Math.abs(pitchDeg(p))+Math.abs((LB[k].lm[1][0]-LB[k].lm[234][0])-(LB[k].lm[454][0]-LB[k].lm[1][0]))*10;if(!best||v<best.v)best={k,v};}return fL(best.k);})();
const iso=x=>x.ai.map(p=>({x:p.x,y:p.y*x.A,z:p.z}));const back=(P,A)=>P.map(p=>({x:p.x,y:p.y/A,z:p.z}));
function rotX(P,deg){const t=deg*Math.PI/180,c=Math.cos(t),s=Math.sin(t);const cy=P.reduce((a,p)=>a+p.y,0)/P.length,cz=P.reduce((a,p)=>a+p.z,0)/P.length;return P.map(p=>({x:p.x,y:cy+(p.y-cy)*c-(p.z-cz)*s,z:cz+(p.y-cy)*s+(p.z-cz)*c}));}
const thOf=ai=>C._cwFaceMeasureRaw(ai,base.A,null).thirds;
{const P0=iso(base),t0=thOf(back(P0,base.A));const d=[-10,10].map(a=>Math.abs(thOf(back(rotX(P0,a),base.A))-t0));check('T3','합성 상하 회전 ±10° → 삼정 변화 ≤0.02',d.every(v=>v<=0.02),`기준 ${t0.toFixed(3)} · Δ ${d.map(v=>v.toFixed(3)).join(', ')}`);}
{const P0=iso(base);const y2=P0[2].y;const P1=P0.map(p=>p.y>y2?{x:p.x,y:y2+(p.y-y2)*1.10,z:p.z}:p);const t0=thOf(back(P0,base.A)),t1=thOf(back(P1,base.A));check('T4','합성 하정 10% 연장 → 삼정 ≥0.05 변화',Math.abs(t1-t0)>=0.05,`${t0.toFixed(3)} → ${t1.toFixed(3)}`);}
{const ai0=base.ai.map(p=>({x:p.x,y:p.y,z:0}));const r0=C._cwFaceMeasureRaw(ai0,base.A,base.hr);
 // 종전 2D 식 재현
 const p=ai0.map(a=>({x:a.x,y:a.y*base.A}));let ux=p[10].x-p[152].x,uy=p[10].y-p[152].y;const n=Math.hypot(ux,uy);ux/=n;uy/=n;const s=q=>(q.x-p[152].x)*ux+(q.y-p[152].y)*uy;const b=(s(p[55])+s(p[285])+s(p[107])+s(p[336]))/4,m=b-s(p[2]),l=s(p[2]);
 let exp;if(base.hr&&base.hr.status==='OK'){const u=s({x:base.hr.hairline.x,y:base.hr.hairline.y*base.A})-b;const T=u+m+l,i=T/3;exp=1-Math.min(1,(Math.abs(u-i)+Math.abs(m-i)+Math.abs(l-i))/T*2);}else exp=1-Math.min(1,Math.abs(m-l)/(m+l)*2);
 check('T5','z 없음 → 종전 2D 값',Math.abs(r0.thirds-exp)<1e-9,`${r0.thirds.toFixed(4)} vs ${exp.toFixed(4)}`);}
{const [LH,fH]=load('eval_hairline');let ok=true,n=0;const parts={2:0,3:0};for(const k of Object.keys(LH)){if(!LH[k]||!LH[k].lm)continue;const x=fH(k);const r=C._cwFaceMeasureRaw(x.ai,x.A,x.hr);n++;parts[r.thirdsParts]++;ok=ok&&isFinite(r.thirds);}
 for(const k of Object.keys(SB)){const x=fS(k);const r=C._cwFaceMeasureRaw(x.ai,x.A,x.hr);n++;parts[r.thirdsParts]++;ok=ok&&isFinite(r.thirds);}
 check('T6','인터넷·셀카 전부 유한값',ok&&n>=60,`n ${n} · 3분 ${parts[3]} · 2분 ${parts[2]}`);}
console.log(`[p31_pose_thirds] total=${total} pass=${pass} fail=${total-pass}${fails.length?' · FAIL '+fails.join(','):''}`);
process.exitCode=fails.length?1:0;
