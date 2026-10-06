// v799 P-792-B2 진단 d12 — 근접 셀카 원근 보정: 현행 PERSP-v1(기하 모형) vs 경험 계수(사람 단위 LOPO)
//  사람: 라벨셋 01~08(near 전면 · far 후면 3배) + 기존 셀카셋 P2(p2_2026_nog_near/far) + J0(jay_2026_nog_guide/far · 01과 같은 사람 추정 → LOPO 에서 01과 한 묶음)
//  지표: 사람별 |ln(보정 근접 중앙 / 원거리 중앙)| · 축별 사람 중앙 · REL 축 전부
'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib');
const ROOT=path.join(__dirname,'..'),IP=path.join(ROOT,'..','ChunWoon_IP','face');
const STUB="const FACE_S=[{l:'round',v:'round'},{l:'square',v:'square'},{l:'long',v:'long'},{l:'inv',v:'inv'}];const FACE_E=[{l:'big',v:'big'},{l:'narrow',v:'narrow'},{l:'round',v:'round'},{l:'droopy',v:'droopy'}];const FACE_N=[{l:'high',v:'high'},{l:'wide',v:'wide'},{l:'small',v:'small'},{l:'hooked',v:'hooked'}];const FACE_M=[{l:'big',v:'big'},{l:'small',v:'small'},{l:'thick',v:'thick'},{l:'thin',v:'thin'}];";
const idx=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');const i0=idx.indexOf('var CW_FACE_REF'),i1=idx.indexOf('//  5b. PAL',i0);
const M={exports:{}};new Function('module','exports','window',STUB+idx.slice(i0,idx.lastIndexOf('// ====',i1))+'\nmodule.exports={_cwFaceMeasure,_cwFaceMeasureRaw,_cwHairline,CW_FACE_AXES,CW_FACE_AXIS_KIND,CW_FACE_PERSP};')(M,M.exports,{});const C=M.exports;
const med=a=>{a=a.filter(x=>x!=null&&isFinite(x));if(!a.length)return null;const s=[...a].sort((x,y)=>x-y);return s.length%2?s[(s.length-1)>>1]:(s[s.length/2-1]+s[s.length/2])/2;};
function src(dir){const L=JSON.parse(fs.readFileSync(path.join(IP,dir,'cache','landmarks.json'),'utf8'));return k=>{const d=L[k];const ai=d.lm.map(a=>({x:a[0],y:a[1],z:a[2]}));const hr=C._cwHairline(zlib.gunzipSync(fs.readFileSync(path.join(IP,dir,'cache',k+'.mask.gz'))),d.w,d.h,ai);return C._cwFaceMeasureRaw(ai,d.h/d.w,hr);};}
const LB=JSON.parse(fs.readFileSync(path.join(IP,'eval_labelset','cache','landmarks.json'),'utf8')),SB=JSON.parse(fs.readFileSync(path.join(IP,'eval_selfie','cache','landmarks.json'),'utf8'));
const fL=src('eval_labelset'),fS=src('eval_selfie');
const P={};
for(const p of [...new Set(Object.values(LB).map(v=>v.pid))].sort())P[p]={grp:p,near:Object.keys(LB).filter(k=>LB[k].pid===p&&LB[k].kind==='near').map(fL),far:Object.keys(LB).filter(k=>LB[k].pid===p&&LB[k].kind==='far').map(fL)};
P.P2={grp:'P2',near:Object.keys(SB).filter(k=>k.startsWith('p2_2026_nog_near')).map(fS),far:Object.keys(SB).filter(k=>k.startsWith('p2_2026_nog_far')).map(fS)};
P.J0={grp:'01',near:Object.keys(SB).filter(k=>k.startsWith('jay_2026_nog_guide')).map(fS),far:Object.keys(SB).filter(k=>k.startsWith('jay_2026_nog_far')).map(fS)};
const AX=C.CW_FACE_AXES.filter(a=>C.CW_FACE_AXIS_KIND[a]==='REL'&&!/Tilt|Angle/.test(a));
const ratio={};for(const [p,v] of Object.entries(P)){ratio[p]={};for(const a of AX){const n=med(v.near.map(m=>m[a])),f=med(v.far.map(m=>m[a]));ratio[p][a]=n&&f?n/f:null;}}
const v1=C.CW_FACE_PERSP.f;const res={};
console.log('축'.padEnd(18)+'v1계수  | 관측 n/f 사람별('+Object.keys(P).join(' ')+') | 중앙 | 오차중앙 무보정 / v1 / LOPO');
for(const a of AX){
  const rs=Object.values(ratio).map(r=>r[a]);const e0=[],e1=[],e2=[];
  for(const [p,v] of Object.entries(P)){const r=ratio[p][a];if(r==null)continue;
    const others=Object.entries(P).filter(([q,w])=>w.grp!==v.grp).map(([q])=>ratio[q][a]);const c=med(others);
    e0.push(Math.abs(Math.log(r)));e1.push(Math.abs(Math.log(r/(v1[a]||1))));e2.push(Math.abs(Math.log(r/c)));}
  res[a]={v1:v1[a]||null,obs:Object.fromEntries(Object.entries(ratio).map(([p,r])=>[p,r[a]])),med:med(rs),err:{none:med(e0),v1:med(e1),lopo:med(e2)}};
  console.log(a.padEnd(18)+(v1[a]?v1[a].toFixed(3):'  -  ')+'  | '+rs.map(x=>x==null?'  -  ':x.toFixed(3)).join(' ')+' | '+med(rs).toFixed(3)+' | '+[med(e0),med(e1),med(e2)].map(x=>(x*100).toFixed(2)+'%').join(' / '));
}
fs.writeFileSync(path.join(__dirname,'d12.json'),JSON.stringify(res,null,1));
