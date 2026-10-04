// v797 P-797-C 진단 — ABS 6축 · 얼굴형/눈/코/입 판정이 근접 셀카(보정 후)와 원거리에서 어떻게 다른가
//  사람 2(J·P) × 근접 5 / 원거리 5 (무안경). 근접은 src='live'(P-795-A 보정 적용) · 원거리는 무보정.
//  ① ABS 축 원시값 근/원 비(관측) vs 기하 모형(d48/d120) ② 판정 라벨 근/원 일치 ③ harmonyScore 차
'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib');const ROOT=path.join(__dirname,'..'),EV=path.join(ROOT,'..','ChunWoon_IP','face','eval_selfie');
const STUB="const FACE_S=[{l:'round',v:'round'},{l:'square',v:'square'},{l:'long',v:'long'},{l:'inv',v:'inv'}];const FACE_E=[{l:'big',v:'big'},{l:'narrow',v:'narrow'},{l:'round',v:'round'},{l:'droopy',v:'droopy'}];const FACE_N=[{l:'high',v:'high'},{l:'wide',v:'wide'},{l:'small',v:'small'},{l:'hooked',v:'hooked'}];const FACE_M=[{l:'big',v:'big'},{l:'small',v:'small'},{l:'thick',v:'thick'},{l:'thin',v:'thin'}];";
const idx=fs.readFileSync(process.env.P17_INDEX||path.join(ROOT,'index.html'),'utf8');const i0=idx.indexOf('var CW_FACE_REF'),i1=idx.indexOf('//  5b. PAL',i0);
const M={exports:{}};new Function('module','exports','window',STUB+idx.slice(i0,idx.lastIndexOf('// ====',i1))+'\nmodule.exports={_cwFaceMeasure,_cwFaceMeasureRaw,_cwRank,_cwHairline,classifyFaceFromLandmarks,CW_FACE_REF,CW_FACE_AXES,CW_FACE_AXIS_KIND,CW_FACE_PERSP,CW_FACE_INV_T};')(M,M.exports,{});const C=M.exports;
const L=JSON.parse(fs.readFileSync(path.join(EV,'cache','landmarks.json'),'utf8'));
const ABS=Object.keys(C.CW_FACE_AXIS_KIND).filter(k=>C.CW_FACE_AXIS_KIND[k]==='ABS');
const load=k=>{const d=L[k],ai=d.lm.map(a=>({x:a[0],y:a[1],z:a[2]}));const hr=C._cwHairline(zlib.gunzipSync(fs.readFileSync(path.join(EV,'cache',k+'.mask.gz'))),d.w,d.h,ai);return {ai,A:d.h/d.w,hr};};
const med=a=>{a=a.filter(x=>x!=null&&isFinite(x));if(!a.length)return null;const s=[...a].sort((x,y)=>x-y);return s.length%2?s[(s.length-1)>>1]:(s[s.length/2-1]+s[s.length/2])/2;};
const P={J:{near:'jay_2026_nog_guide',far:'jay_2026_nog_far'},P:{near:'p2_2026_nog_near',far:'p2_2026_nog_far'}};
// 기하 모형
const V=fs.readFileSync(path.join(ROOT,'_v789_work','fixtures','canonical_face_model.obj'),'utf8').split('\n').filter(l=>l.startsWith('v ')).map(l=>l.split(/\s+/).slice(1,4).map(Number));
const zmax=Math.max(...V.map(v=>v[2]));
function proj(d){const Pp=V.map(([x,y,z])=>{const s=d/(d+zmax-z);return [x*s,-y*s,z];});const xs=Pp.map(p=>p[0]),ys=Pp.map(p=>p[1]);const x0=Math.min(...xs)-5,x1=Math.max(...xs)+5,y0=Math.min(...ys)-8,y1=Math.max(...ys)+5;const W=x1-x0,H=y1-y0;return C._cwFaceMeasureRaw(Pp.map(([x,y,z])=>({x:(x-x0)/W,y:(y-y0)/H,z:z/W})),H/W,null);}
const MN=proj(C.CW_FACE_PERSP.dEff),MF=proj(C.CW_FACE_PERSP.dFar);
const out={};
for(const [pn,p] of Object.entries(P)){
  const ks=f=>Object.keys(L).filter(k=>k.startsWith(f)).sort();
  const N=ks(p.near).map(k=>({k,...load(k)})),F=ks(p.far).map(k=>({k,...load(k)}));
  const mN=N.map(x=>C._cwFaceMeasure(x.ai,x.A,x.hr,'live')),mF=F.map(x=>C._cwFaceMeasure(x.ai,x.A,x.hr,null));
  const cN=N.map(x=>C.classifyFaceFromLandmarks(x.ai,x.A,x.hr,'live')),cF=F.map(x=>C.classifyFaceFromLandmarks(x.ai,x.A,x.hr,null));
  console.log(`\n[${pn}] 근접 ${N.length} · 원거리 ${F.length}`);
  console.log('ABS축'.padEnd(16)+'  근접중앙  원거리중앙  관측비   모형비(48/120)');
  out[pn]={abs:{}};
  for(const a of ABS){const n=med(mN.map(m=>m[a])),f=med(mF.map(m=>m[a]));const mo=MN[a]!=null&&MF[a]?MN[a]/MF[a]:null;out[pn].abs[a]={n,f,obs:n&&f?n/f:null,model:mo};
    console.log(a.padEnd(16)+[n,f].map(v=>v==null?'      -':v.toFixed(4).padStart(10)).join('  ')+(n&&f?(n/f).toFixed(3).padStart(9):'     -')+(mo?mo.toFixed(3).padStart(10):'     -'));}
  // 판정에 쓰이는 랭크/원시
  const show=(lab,arr,fn)=>console.log(lab.padEnd(16)+arr.map(fn).join(' '));
  console.log('-- 판정 입력(각 사진) --');
  show('R.whRatio N',cN,c=>c.ranks.whRatio.toFixed(2));show('R.whRatio F',cF,c=>c.ranks.whRatio.toFixed(2));
  show('R.jawRatio N',cN,c=>c.ranks.jawRatio.toFixed(2));show('R.jawRatio F',cF,c=>c.ranks.jawRatio.toFixed(2));
  show('cheonJiW N',mN,m=>m.cheonJiWidth.toFixed(3));show('cheonJiW F',mF,m=>m.cheonJiWidth.toFixed(3));
  for(const o of ['shapeOpt','eyeOpt','noseOpt','mouthOpt']){show(o+' N',cN,c=>c[o].v);show(o+' F',cF,c=>c[o].v);}
  show('harmony N',cN,c=>String(c.harmonyScore));show('harmony F',cF,c=>String(c.harmonyScore));
  out[pn].labels={N:cN.map(c=>[c.shapeOpt.v,c.eyeOpt.v,c.noseOpt.v,c.mouthOpt.v]),F:cF.map(c=>[c.shapeOpt.v,c.eyeOpt.v,c.noseOpt.v,c.mouthOpt.v])};
  out[pn].harmony={N:med(cN.map(c=>c.harmonyScore)),F:med(cF.map(c=>c.harmonyScore))};
  out[pn].jawRank={N:med(cN.map(c=>c.ranks.jawRatio)),F:med(cF.map(c=>c.ranks.jawRatio))};
}
fs.writeFileSync(path.join(__dirname,'d08.json'),JSON.stringify(out,null,1));
