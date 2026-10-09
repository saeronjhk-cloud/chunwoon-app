// v799 d18 — 삼정 계산 대안별 같은 사람 종합 점수 범위(시뮬레이션) · 진짜 고개 상하각(정면화 좌표계 법선)과의 상관
'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib');const L=require('./persp_v2_lib.js');
const ROOT=path.join(__dirname,'..'),IP=path.join(ROOT,'..','ChunWoon_IP','face');const C=L.loadCore(path.join(ROOT,'index.html'));
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],sub=(a,b)=>[a.x-b.x,a.y-b.y,a.z-b.z],nrm=a=>{const l=Math.sqrt(dot(a,a));return a.map(v=>v/l);};
function frame(p){const ex=nrm(sub(p[454],p[234]));const u=sub(p[10],p[152]),k=dot(u,ex);const ey=nrm([u[0]-k*ex[0],u[1]-k*ex[1],u[2]-k*ex[2]]);const ez=[ex[1]*ey[2]-ex[2]*ey[1],ex[2]*ey[0]-ex[0]*ey[2],ex[0]*ey[1]-ex[1]*ey[0]];
 const c={x:(p[234].x+p[454].x)/2,y:(p[234].y+p[454].y)/2,z:(p[234].z+p[454].z)/2};const Y=a=>{const v=sub(a,c);return -dot(v,ey);};return {ex,ey,ez,Y};}
const t2=(m,l)=>1-Math.min(1,Math.abs(m-l)/(m+l)*2);
const t3=(u,m,l)=>{const T=u+m+l,i=T/3;return 1-Math.min(1,(Math.abs(u-i)+Math.abs(m-i)+Math.abs(l-i))/T*2);};
function row(dir,Lm,k,pid){const d=Lm[k],A=d.h/d.w,ai=d.lm.map(a=>({x:a[0],y:a[1],z:a[2]}));const mp=path.join(IP,dir,'cache',k+'.mask.gz');
 const hr=fs.existsSync(mp)?C._cwHairline(zlib.gunzipSync(fs.readFileSync(mp)),d.w,d.h,ai):null;
 const src=(d.distCm!=null?d.distCm<=60:/near|guide/.test(k))?'live':null;const c=C.classifyFaceFromLandmarks(ai,A,hr,src);const hp=c.harmonyParts;
 const p=ai.map(a=>({x:a.x,y:a.y*A,z:a.z||0}));const F=frame(p);
 let aux=p[10].x-p[152].x,auy=p[10].y-p[152].y;const an=Math.hypot(aux,auy);aux/=an;auy/=an;const s=q=>(q.x-p[152].x)*aux+(q.y-p[152].y)*auy;
 const b2=(s(p[55])+s(p[285])+s(p[107])+s(p[336]))/4,m2=b2-s(p[2]),l2=s(p[2]);
 const bF=(F.Y(p[55])+F.Y(p[285])+F.Y(p[107])+F.Y(p[336]))/4,mF=F.Y(p[2])-bF,lF=F.Y(p[152])-F.Y(p[2]);
 let uF=null,u2=null;if(hr&&hr.status==='OK'&&hr.hairline){const hl={x:hr.hairline.x,y:hr.hairline.y*A};u2=s(hl)-b2;
  const d3=[p[10].x-p[9].x,p[10].y-p[9].y,p[10].z-p[9].z],d2=d3[0]*aux+d3[1]*auy,t=(s(hl)-s(p[10]))/d2;uF=bF-F.Y({x:p[10].x+d3[0]*t,y:p[10].y+d3[1]*t,z:p[10].z+d3[2]*t});if(u2<=0){u2=null;uF=null;}}
 const pitchDeg=Math.asin(F.ez[1])*180/Math.PI;   // 얼굴 법선의 화면 세로 성분
 const ov=th=>Math.round(100*(0.32*hp.symmetry+0.32*th+0.18*hp.cheonI+0.18*hp.organProp));
 return {pid,k,pitchDeg,rF:mF/lF,r2:m2/l2,cur:c.overallScore,
  O2:ov(t2(m2,l2)),O3:ov(t2(mF,lF)),O4:ov(uF!=null?t3(uF,mF,lF):t2(mF,lF)),O5:ov(hp.thirds),thCur:hp.thirds,th2F:t2(mF,lF)};}
const LB=JSON.parse(fs.readFileSync(path.join(IP,'eval_labelset','cache','landmarks.json'),'utf8'));const SB=JSON.parse(fs.readFileSync(path.join(IP,'eval_selfie','cache','landmarks.json'),'utf8'));
const R=[];for(const k of Object.keys(LB))R.push(row('eval_labelset',LB,k,LB[k].pid));
for(const k of Object.keys(SB).filter(k=>/^p2_2026_nog/.test(k)))R.push(row('eval_selfie',SB,k,'P2'));
for(const k of Object.keys(SB).filter(k=>/^jay_2026_nog/.test(k)))R.push(row('eval_selfie',SB,k,'J0'));
const by={};R.forEach(r=>(by[r.pid]=by[r.pid]||[]).push(r));const rng=a=>Math.max(...a)-Math.min(...a);
const corr=(x,y)=>{const mx=x.reduce((a,b)=>a+b)/x.length,my=y.reduce((a,b)=>a+b)/y.length;let s=0,sx=0,sy=0;for(let i=0;i<x.length;i++){s+=(x[i]-mx)*(y[i]-my);sx+=(x[i]-mx)**2;sy+=(y[i]-my)**2;}return s/Math.sqrt(sx*sy);};
const within=(key,ref)=>{const xs=[],ys=[];for(const a of Object.values(by)){const m=a.reduce((s,r)=>s+r[key],0)/a.length,mp=a.reduce((s,r)=>s+r[ref],0)/a.length;a.forEach(r=>{xs.push(r[key]-m);ys.push(r[ref]-mp);});}return corr(xs,ys).toFixed(2);};
console.log('대안: cur=현행(대칭·천이 정면화, 삼정 2D·머리선 있으면 3분) · O2=삼정 항상 中/下 2D · O3=항상 中/下 정면화 · O4=정면화 3분/2분 · O5=현행 재계산 검증');
for(const o of ['cur','O5','O2','O3','O4']){const r=Object.entries(by).map(([p,a])=>p+':'+rng(a.map(x=>x[o])));console.log(o.padEnd(3),'범위 중앙',L.med(Object.values(by).map(a=>rng(a.map(x=>x[o])))),'·',r.join(' '));}
console.log('사람 안 상관(진짜 상하각): 中/下 2D',within('r2','pitchDeg'),'· 정면화',within('rF','pitchDeg'));
console.log('상하각 범위(도) 사람별:',Object.entries(by).map(([p,a])=>p+':'+rng(a.map(x=>x.pitchDeg)).toFixed(1)).join(' '));
fs.writeFileSync(path.join(__dirname,'d18.json'),JSON.stringify(R));
