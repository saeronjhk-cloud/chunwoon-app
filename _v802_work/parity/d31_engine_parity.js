// v803 d31 — 평가 캐시 엔진(파이썬 mediapipe 0.10.14 · static · refine 끔) vs 앱 엔진(JS face_mesh 0.4.1633559619 · refine 켬 · 정지 모드)
// 같은 사진 127장 · 같은 코어(index.html) · 같은 머리선 마스크 · 같은 src 규칙. 축별 편향(백분위 차 중앙)·잡음(|차| 중앙)·판정 일치율.
'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib');
const ROOT=path.join(__dirname,'..','..'),IP=path.join(ROOT,'..','ChunWoon_IP','face');
const C=require(path.join(ROOT,'_v799_work','persp_v2_lib.js')).loadCore(path.join(ROOT,'index.html'));
const sets={py0:{}};const meta={};
for(const d of ['eval_labelset','eval_selfie','eval_hairline']){const L=JSON.parse(fs.readFileSync(path.join(IP,d,'cache','landmarks.json'),'utf8'));
 for(const [k,e] of Object.entries(L)){sets.py0[k]={w:e.w,h:e.h,lm:e.lm};meta[k]={d,distCm:e.distCm};}}
for(const s of ['js1','js0','py1'])sets[s]=JSON.parse(fs.readFileSync(path.join(IP,'parity',(s==='js1'?'js_ref1':s==='js0'?'js_ref0':'py_ref1')+'.json'),'utf8'));
const srcOf=k=>{const m=meta[k];if(m.d==='eval_labelset')return m.distCm<=60?'live':null;if(m.d==='eval_selfie')return /near|guide/.test(k)?'live':null;return null;};
const masks={};const maskOf=k=>{if(k in masks)return masks[k];const p=path.join(IP,meta[k].d,'cache',k+'.mask.gz');return masks[k]=fs.existsSync(p)?zlib.gunzipSync(fs.readFileSync(p)):null;};
function run(s,k){const e=sets[s][k];if(!e||!e.lm)return null;const ai=e.lm.map(a=>({x:a[0],y:a[1],z:a[2]||0}));const mk=maskOf(k);
 const hr=mk?C._cwHairline(mk,sets.py0[k].w,sets.py0[k].h,ai):null;const c=C.classifyFaceFromLandmarks(ai,e.h/e.w,hr,srcOf(k));
 return {c,raw:C._cwFaceMeasure(ai,e.h/e.w,hr,srcOf(k))};}
const keys=Object.keys(sets.py0).sort();const R={};for(const s of Object.keys(sets)){R[s]={};for(const k of keys)R[s][k]=run(s,k);}
const med=a=>{a=[...a].sort((x,y)=>x-y);const n=a.length;return n?(n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2):NaN;},f=(v,d=1)=>(v>=0?'+':'')+v.toFixed(d);
const AX=Object.keys(R.py0[keys[0]].c.ranks);
function cmp(a,b,lab){const K=keys.filter(k=>R[a][k]&&R[b][k]);console.log(`\n== ${lab} (n ${K.length})`);
 const hv=K.map(k=>R[b][k].c.harmonyScore-R[a][k].c.harmonyScore);console.log(`종합(조화도) 차: 평균 ${f(hv.reduce((x,y)=>x+y,0)/hv.length,2)} · 최대 |차| ${Math.max(...hv.map(Math.abs))} · |차|≥2 ${hv.filter(v=>Math.abs(v)>=2).length}장`);
 const agree=(fn,nm)=>{const n=K.filter(k=>fn(R[a][k].c)===fn(R[b][k].c)).length;return `${nm} ${n}/${K.length}`;};
 console.log('판정 일치: '+[agree(c=>c.shapeOpt.v,'얼굴형'),agree(c=>c.shapeDesc&&c.shapeDesc.title,'얼굴형 표기(경계 병기 포함)'),agree(c=>c.eyeOpt.v,'눈'),agree(c=>c.noseOpt.v,'코'),agree(c=>c.mouthOpt.v,'입'),agree(c=>c.smile.warn,'미소 경고'),agree(c=>c.smile.hold,'미소 보류'),agree(c=>c.pose.held,'고개 보류')].join(' · '));
 const rows=AX.map(ax=>{const dv=K.map(k=>(R[b][k].c.ranks[ax]-R[a][k].c.ranks[ax])*100);return {ax,bias:med(dv),noise:med(dv.map(Math.abs)),p90:[...dv.map(Math.abs)].sort((x,y)=>x-y)[Math.floor(.9*(dv.length-1))]};});
 rows.sort((x,y)=>Math.abs(y.bias)-Math.abs(x.bias));
 console.log('축별 백분위 차(앱−평가, 점) — 편향=중앙 · 잡음=|차| 중앙 [P90], 편향 큰 순');
 rows.forEach(r=>console.log(`   ${r.ax.padEnd(15)} 편향 ${f(r.bias).padStart(6)} · 잡음 ${r.noise.toFixed(1).padStart(5)} [${r.p90.toFixed(1)}]`));
 return rows;}
const main=cmp('py0','js1','★평가 캐시(py·refine 끔) → 앱(js·refine 켬)');
cmp('py0','js0','엔진 판만 다름(py → js, 둘 다 refine 끔)');
cmp('py0','py1','refine 만 다름(파이썬 끔 → 켬)');
fs.writeFileSync(path.join(__dirname,'d31_rows.json'),JSON.stringify(main));
