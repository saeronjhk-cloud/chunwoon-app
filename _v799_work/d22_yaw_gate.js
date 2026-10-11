// v799 d22 — 큰 고개 돌림 보류(p33) 임계 진단: |yaw| 분포 · 합성 회전 각도↔yaw · 사람별 범위/상관 vs 임계
'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib');const Lb=require('./persp_v2_lib.js');
const ROOT=path.join(__dirname,'..'),IP=path.join(ROOT,'..','ChunWoon_IP','face');const C=Lb.loadCore(path.join(ROOT,'index.html'));
const yaw=lm=>{const dl=lm[1][0]-lm[234][0],dr=lm[454][0]-lm[1][0];return (dl-dr)/(dl+dr);};
function load(dir){const L=JSON.parse(fs.readFileSync(path.join(IP,dir,'cache','landmarks.json'),'utf8'));return [L,k=>{const d=L[k];const ai=d.lm.map(a=>({x:a[0],y:a[1],z:a[2]}));const mp=path.join(IP,dir,'cache',k+'.mask.gz');const hr=fs.existsSync(mp)?C._cwHairline(zlib.gunzipSync(fs.readFileSync(mp)),d.w,d.h,ai):null;return {d,ai,A:d.h/d.w,hr};}];}
const [LB,fL]=load('eval_labelset'),[SB,fS]=load('eval_selfie'),[NB,fN]=load('eval_hairline');const rows=[];
const add=(set,g,k,x,src)=>{const c=C.classifyFaceFromLandmarks(x.ai,x.A,x.hr,src);rows.push({set,g,k,y:Math.abs(yaw(x.d.lm)),ov:c.overallScore,sym:c.harmonyParts.symmetry});};
for(const k of Object.keys(LB))add('label',LB[k].pid,k,fL(k),LB[k].distCm<=60?'live':null);
for(const k of Object.keys(SB).filter(k=>/^p2_2026_nog/.test(k)))add('label','P2',k,fS(k),/near/.test(k)?'live':null);
for(const k of Object.keys(SB).filter(k=>/^jay_2026_nog/.test(k)))add('label','J0',k,fS(k),/guide/.test(k)?'live':null);
for(const k of Object.keys(SB).filter(k=>!/^p2_2026_nog|^jay_2026_nog/.test(k)))add('selfie',null,k,fS(k),null);
for(const k of Object.keys(NB))if(NB[k]&&NB[k].lm)add('net',null,k,fN(k),null);
const q=(a,p)=>{a=[...a].sort((x,y)=>x-y);return a[Math.min(a.length-1,Math.floor(p*a.length))];};
for(const s of ['label','selfie','net']){const a=rows.filter(r=>r.set===s).map(r=>r.y);console.log(`① |yaw| ${s} n ${a.length} · 중앙 ${q(a,.5).toFixed(3)} · P90 ${q(a,.9).toFixed(3)} · P95 ${q(a,.95).toFixed(3)} · 최대 ${Math.max(...a).toFixed(3)}`);}
console.log('① 상위 8장:',rows.slice().sort((a,b)=>b.y-a.y).slice(0,8).map(r=>`${r.k} ${r.y.toFixed(2)}(${r.ov})`).join(' · '));
// ② 합성: 가장 정면인 라벨셋 사진의 3D 점을 좌우로 돌려 정사영 → yaw 지표와 종합 점수
const base=(()=>{let b=null;for(const k of Object.keys(LB)){const y=Math.abs(yaw(LB[k].lm));if(!b||y<b.y)b={k,y};}return {k:b.k,...fL(b.k)};})();
const iso=x=>x.ai.map(p=>({x:p.x,y:p.y*x.A,z:p.z}));const back=(P,A)=>P.map(p=>({x:p.x,y:p.y/A,z:p.z}));
const rotY=(P,deg)=>{const t=deg*Math.PI/180,c=Math.cos(t),s=Math.sin(t);const cx=P.reduce((a,p)=>a+p.x,0)/P.length,cz=P.reduce((a,p)=>a+p.z,0)/P.length;return P.map(p=>({x:cx+(p.x-cx)*c+(p.z-cz)*s,y:p.y,z:cz-(p.x-cx)*s+(p.z-cz)*c}));};
const P0=iso(base);console.log('② 기준 사진',base.k);
for(const d of [0,5,10,15,20,25,30,35,40]){const ai=back(rotY(P0,d),base.A);const lm=ai.map(p=>[p.x,p.y,p.z]);const c=C.classifyFaceFromLandmarks(ai,base.A,null,null);console.log(`   ${String(d).padStart(2)}° · yaw ${Math.abs(yaw(lm)).toFixed(3)} · 종합 ${c.overallScore} · 대칭 ${c.harmonyParts.symmetry.toFixed(3)}`);}
// ③ 임계별 보류 비율 · 사람별 범위 최대/중앙 · 상관(종합,|yaw|)
const cr=(x,y)=>{const mx=x.reduce((a,b)=>a+b)/x.length,my=y.reduce((a,b)=>a+b)/y.length;let s=0,sx=0,sy=0;for(let i=0;i<x.length;i++){s+=(x[i]-mx)*(y[i]-my);sx+=(x[i]-mx)**2;sy+=(y[i]-my)**2;}return s/Math.sqrt(sx*sy);};
const rng=a=>a.length?Math.max(...a)-Math.min(...a):0;
for(const T of [1,0.6,0.5,0.45,0.4,0.35,0.3,0.25]){const keep=rows.filter(r=>r.y<T),P=keep.filter(r=>r.g);const by={};P.forEach(r=>(by[r.g]=by[r.g]||[]).push(r.ov));const R=Object.values(by).map(rng);
 console.log(`③ T ${T} · 보류 ${rows.length-keep.length}/${rows.length}(${((rows.length-keep.length)/rows.length*100).toFixed(1)}%) · 라벨 보류 ${rows.filter(r=>r.g&&r.y>=T).length} · 범위 중앙 ${Lb.med(R)} 최대 ${Math.max(...R)} · 상관(종합,|yaw|) 라벨 ${cr(P.map(r=>r.ov),P.map(r=>r.y)).toFixed(2)} · 대칭 ${cr(P.map(r=>r.sym),P.map(r=>r.y)).toFixed(2)}`);}
