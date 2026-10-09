// v799 d17 — 삼정(三停) 사진 간 편차 원인 분해: 머리선 상태(3분/2분 전환)·상하 고개(pitch) 단축·머리선 위치
//  각 사진: 2D(현행) 上·中·下停 비율 vs 정면화(3D) 中·下停 · 머리선 상태 · pitch
'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib');const L=require('./persp_v2_lib.js');
const ROOT=path.join(__dirname,'..'),IP=path.join(ROOT,'..','ChunWoon_IP','face');const C=L.loadCore(path.join(ROOT,'index.html'));
function frontal(p){const sub=(a,b)=>[a.x-b.x,a.y-b.y,a.z-b.z],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],nrm=a=>{const l=Math.sqrt(dot(a,a));return a.map(v=>v/l);};
 const ex=nrm(sub(p[454],p[234]));const u=sub(p[10],p[152]),k=dot(u,ex);const ey=nrm([u[0]-k*ex[0],u[1]-k*ex[1],u[2]-k*ex[2]]);const ez=[ex[1]*ey[2]-ex[2]*ey[1],ex[2]*ey[0]-ex[0]*ey[2],ex[0]*ey[1]-ex[1]*ey[0]];
 const c={x:(p[234].x+p[454].x)/2,y:(p[234].y+p[454].y)/2,z:(p[234].z+p[454].z)/2};return {ex,ey,ez,c,q:p.map(a=>{const v=sub(a,c);return {x:dot(v,ex),y:-dot(v,ey),z:dot(v,ez)};})};}
const pitch=lm=>{const a=lm[1][1]-lm[168][1],b=lm[152][1]-lm[1][1];return a/(a+b);};
function row(dir,Lm,k,pid){const d=Lm[k],A=d.h/d.w,ai=d.lm.map(a=>({x:a[0],y:a[1],z:a[2]}));const mp=path.join(IP,dir,'cache',k+'.mask.gz');
 const hr=fs.existsSync(mp)?C._cwHairline(zlib.gunzipSync(fs.readFileSync(mp)),d.w,d.h,ai):null;const raw=C._cwFaceMeasureRaw(ai,A,hr);
 const p=ai.map(a=>({x:a.x,y:a.y*A,z:a.z||0}));
 // 2D 현행 재현
 let aux=p[10].x-p[152].x,auy=p[10].y-p[152].y;const an=Math.hypot(aux,auy);aux/=an;auy/=an;const s=q=>(q.x-p[152].x)*aux+(q.y-p[152].y)*auy;
 const brow=(s(p[55])+s(p[285])+s(p[107])+s(p[336]))/4;const mid2=brow-s(p[2]),low2=s(p[2]);let up2=null;
 if(hr&&hr.status==='OK'&&hr.hairline){const h=s({x:hr.hairline.x,y:hr.hairline.y*A})-brow;if(h>0)up2=h;}
 // 정면화
 const F=frontal(p),q=F.q;const fb=(q[55].y+q[285].y+q[107].y+q[336].y)/4;const midF=q[2].y-fb,lowF=q[152].y-q[2].y;
 // 상정 정면화: 이마 3D 방향(9→10)을 따라 머리선 2D 위치까지 연장
 let upF=null;if(up2!=null){const d3=[p[10].x-p[9].x,p[10].y-p[9].y,p[10].z-p[9].z];const d2=d3[0]*aux+d3[1]*auy;const hl={x:hr.hairline.x,y:hr.hairline.y*A};const t=(s(hl)-s(p[10]))/d2;
  const H={x:p[10].x+d3[0]*t,y:p[10].y+d3[1]*t,z:p[10].z+d3[2]*t};const v=[H.x-F.c.x,H.y-F.c.y,H.z-F.c.z];const hy=-(v[0]*F.ey[0]+v[1]*F.ey[1]+v[2]*F.ey[2]);upF=fb-hy;}
 return {pid,k,st:hr?hr.status:'-',thi:raw.thirds,parts:raw.thirdsParts,pitch:pitch(d.lm),r2:mid2/low2,rF:midF/lowF,u2:up2!=null?up2/(mid2+low2):null,uF:upF!=null?upF/(midF+lowF):null};}
const LB=JSON.parse(fs.readFileSync(path.join(IP,'eval_labelset','cache','landmarks.json'),'utf8'));const SB=JSON.parse(fs.readFileSync(path.join(IP,'eval_selfie','cache','landmarks.json'),'utf8'));
const R=[];for(const k of Object.keys(LB))R.push(row('eval_labelset',LB,k,LB[k].pid));
for(const k of Object.keys(SB).filter(k=>/^p2_2026_nog/.test(k)))R.push(row('eval_selfie',SB,k,'P2'));
for(const k of Object.keys(SB).filter(k=>/^jay_2026_nog/.test(k)))R.push(row('eval_selfie',SB,k,'J0'));
const f=v=>v==null?'  -  ':v.toFixed(3);
const by={};R.forEach(r=>(by[r.pid]=by[r.pid]||[]).push(r));
for(const [p,a] of Object.entries(by)){console.log('== '+p);for(const r of a)console.log(`  ${r.k.slice(-22).padEnd(22)} ${r.st.padEnd(7)} parts${r.parts} thi ${f(r.thi)} pitch ${f(r.pitch)} | 中/下 2D ${f(r.r2)} 3D ${f(r.rF)} | 上/(中+下) 2D ${f(r.u2)} 3D ${f(r.uF)}`);}
const rng=a=>{a=a.filter(x=>x!=null);return a.length>1?Math.max(...a)-Math.min(...a):null;};const sd=a=>{a=a.filter(x=>x!=null);if(a.length<2)return null;const m=a.reduce((x,y)=>x+y)/a.length;return Math.sqrt(a.reduce((x,y)=>x+(y-m)**2,0)/a.length);};
console.log('\n사람별 sd: 中/下 2D vs 3D · 上 비율 2D vs 3D · 상태 전환');
const s2=[],sF=[],u2=[],uF=[];for(const [p,a] of Object.entries(by)){const x=[sd(a.map(r=>r.r2)),sd(a.map(r=>r.rF)),sd(a.map(r=>r.u2)),sd(a.map(r=>r.uF))];s2.push(x[0]);sF.push(x[1]);if(x[2]!=null){u2.push(x[2]);uF.push(x[3]);}
 console.log(`  ${p.padEnd(3)} ${x.map(f).join(' ')} · 상태 ${[...new Set(a.map(r=>r.st))].join('/')} (${a.filter(r=>r.parts===3).length}/${a.length} 3분)`);}
console.log('  중앙',[s2,sF,u2,uF].map(a=>f(L.med(a))).join(' '));
const corr=(x,y)=>{const mx=x.reduce((a,b)=>a+b)/x.length,my=y.reduce((a,b)=>a+b)/y.length;let s=0,sx=0,sy=0;for(let i=0;i<x.length;i++){s+=(x[i]-mx)*(y[i]-my);sx+=(x[i]-mx)**2;sy+=(y[i]-my)**2;}return s/Math.sqrt(sx*sy);};
// 사람 안 편차(사람 평균 빼고) 와 pitch 상관
const dev=(key)=>{const xs=[],ys=[];for(const a of Object.values(by)){const b=a.filter(r=>r[key]!=null);if(b.length<2)continue;const m=b.reduce((s,r)=>s+r[key],0)/b.length,mp=b.reduce((s,r)=>s+r.pitch,0)/b.length;b.forEach(r=>{xs.push(r[key]-m);ys.push(r.pitch-mp);});}return corr(xs,ys).toFixed(2);};
console.log('사람 안 pitch 상관: 中/下 2D',dev('r2'),'3D',dev('rF'),'· 上 2D',dev('u2'),'3D',dev('uF'));
fs.writeFileSync(path.join(__dirname,'d17.json'),JSON.stringify(R));
