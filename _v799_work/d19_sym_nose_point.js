// v799 d19 — 정면화 좌표에서 좌우대칭의 남은 고개 의존(F4 −0.46) 원인: 코 기준점 깊이(z) 오차 가설
//  코끝 LM1 은 얼굴면에서 가장 튀어나와 z 추정 오차가 x 로 가장 크게 샌다 → 얼굴면에 가까운 정중선 점과 비교
'use strict';
const fs=require('fs'),path=require('path');const L=require('./persp_v2_lib.js');
const ROOT=path.join(__dirname,'..'),IP=path.join(ROOT,'..','ChunWoon_IP','face');
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],sub=(a,b)=>[a.x-b.x,a.y-b.y,a.z-b.z],nrm=a=>{const l=Math.sqrt(dot(a,a));return a.map(v=>v/l);};
function Q(p){const ex=nrm(sub(p[454],p[234]));const u=sub(p[10],p[152]),k=dot(u,ex);const ey=nrm([u[0]-k*ex[0],u[1]-k*ex[1],u[2]-k*ex[2]]);const ez=[ex[1]*ey[2]-ex[2]*ey[1],ex[2]*ey[0]-ex[0]*ey[2],ex[0]*ey[1]-ex[1]*ey[0]];
 const c={x:(p[234].x+p[454].x)/2,y:(p[234].y+p[454].y)/2,z:(p[234].z+p[454].z)/2};return p.map(a=>{const v=sub(a,c);return {x:dot(v,ex),y:-dot(v,ey),z:dot(v,ez)};});}
const yaw=lm=>{const dl=lm[1][0]-lm[234][0],dr=lm[454][0]-lm[1][0];return (dl-dr)/(dl+dr);};
const LB=JSON.parse(fs.readFileSync(path.join(IP,'eval_labelset','cache','landmarks.json'),'utf8'));const SB=JSON.parse(fs.readFileSync(path.join(IP,'eval_selfie','cache','landmarks.json'),'utf8'));
const items=[];for(const k of Object.keys(LB))items.push([LB[k],LB[k].pid]);for(const k of Object.keys(SB)){if(/^p2_2026_nog/.test(k))items.push([SB[k],'P2']);if(/^jay_2026_nog/.test(k))items.push([SB[k],'J0']);}
const NOSE={'LM1 코끝(현행)':[1],'LM2 코밑':[2],'LM168 콧부리':[168],'LM6':[6],'정중선 평균(168·6·197·195·5·4·1·2)':[168,6,197,195,5,4,1,2]};
const corr=(x,y)=>{const mx=x.reduce((a,b)=>a+b)/x.length,my=y.reduce((a,b)=>a+b)/y.length;let s=0,sx=0,sy=0;for(let i=0;i<x.length;i++){s+=(x[i]-mx)*(y[i]-my);sx+=(x[i]-mx)**2;sy+=(y[i]-my)**2;}return s/Math.sqrt(sx*sy);};
for(const [name,ids] of Object.entries(NOSE)){const rows=items.map(([d,pid])=>{const A=d.h/d.w,q=Q(d.lm.map(a=>({x:a[0],y:a[1]*A,z:a[2]||0})));const W=Math.abs(q[454].x-q[234].x);
  const nx=ids.reduce((s,i)=>s+q[i].x,0)/ids.length,lc=(q[33].x+q[133].x)/2,rc=(q[362].x+q[263].x)/2;const sym=1-Math.min(1,Math.abs(Math.abs(nx-lc)-Math.abs(rc-nx))/W*5);return {pid,sym,ay:Math.abs(yaw(d.lm)),nz:ids.reduce((s,i)=>s+q[i].z,0)/ids.length/W};});
 const by={};rows.forEach(r=>(by[r.pid]=by[r.pid]||[]).push(r.sym));const rng=Object.values(by).map(a=>Math.max(...a)-Math.min(...a));
 console.log(name.padEnd(34),'상관(대칭,|고개|)',corr(rows.map(r=>r.sym),rows.map(r=>r.ay)).toFixed(2),'· 같은 사람 대칭 범위 중앙',L.med(rng).toFixed(3),'· 평균 대칭',(rows.reduce((s,r)=>s+r.sym,0)/rows.length).toFixed(3),'· 기준점 돌출 z/W',L.med(rows.map(r=>r.nz)).toFixed(3));}
