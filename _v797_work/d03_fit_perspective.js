// v797 P-795-A 진단 3 — 원근 보정 방식 비교(사람 단위 교차검증: 한 사람으로 맞추고 다른 사람으로 평가)
//  방식 0: 보정 없음 · 1: 기하 모형 1-모수(유효 거리 d) · 2: 축별 경험 계수(다른 사람의 근/원 비)
//  지표: 보정한 근접 셀카 축값의 랭크 vs 같은 사람 원거리 사진 랭크(중앙) 차이 |Δrank| — 축별 중앙값
'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib');const ROOT=path.join(__dirname,'..'),EV=path.join(ROOT,'..','ChunWoon_IP','face','eval_selfie');
const STUB="const FACE_S=[{l:'a',v:'round'}];const FACE_E=[{l:'a',v:'big'}];const FACE_N=[{l:'a',v:'high'}];const FACE_M=[{l:'a',v:'big'}];";
const idx=fs.readFileSync(process.env.P17_INDEX||path.join(ROOT,'index.html'),'utf8');const i0=idx.indexOf('var CW_FACE_REF'),i1=idx.indexOf('//  5b. PAL',i0);
const M={exports:{}};new Function('module','exports','window',STUB+idx.slice(i0,idx.lastIndexOf('// ====',i1))+'\nmodule.exports={_cwFaceMeasure,_cwRank,_cwHairline,CW_FACE_REF,CW_FACE_AXES,CW_FACE_AXIS_KIND};')(M,M.exports,undefined);const C=M.exports;
const REL=C.CW_FACE_AXES.filter(k=>C.CW_FACE_AXIS_KIND[k]==='REL');
const L=JSON.parse(fs.readFileSync(path.join(EV,'cache','landmarks.json'),'utf8'));
const meas=k=>{const d=L[k],ai=d.lm.map(a=>({x:a[0],y:a[1],z:a[2]}));const hr=C._cwHairline(zlib.gunzipSync(fs.readFileSync(path.join(EV,'cache',k+'.mask.gz'))),d.w,d.h,ai);return C._cwFaceMeasure(ai,d.h/d.w,hr);};
const med=a=>{a=a.filter(x=>x!=null&&isFinite(x));if(!a.length)return null;const s=[...a].sort((x,y)=>x-y);return s.length%2?s[(s.length-1)>>1]:(s[s.length/2-1]+s[s.length/2])/2;};
const P={J:{near:Object.keys(L).filter(k=>k.startsWith('jay_2026_nog_guide')),far:Object.keys(L).filter(k=>k.startsWith('jay_2026_nog_far'))},
         Q:{near:Object.keys(L).filter(k=>k.startsWith('p2_2026_nog_near')),far:Object.keys(L).filter(k=>k.startsWith('p2_2026_nog_far'))}};
for(const p of Object.values(P)){p.N=p.near.map(meas);p.F=p.far.map(meas);}
// 기하 모형
const V=fs.readFileSync(path.join(ROOT,'_v789_work','fixtures','canonical_face_model.obj'),'utf8').split('\n').filter(l=>l.startsWith('v ')).map(l=>l.split(/\s+/).slice(1,4).map(Number));
const zmax=Math.max(...V.map(v=>v[2]));
function proj(d){const Pp=V.map(([x,y,z])=>{const s=d/(d+zmax-z);return [x*s,-y*s,z];});const xs=Pp.map(p=>p[0]),ys=Pp.map(p=>p[1]);const x0=Math.min(...xs)-5,x1=Math.max(...xs)+5,y0=Math.min(...ys)-8,y1=Math.max(...ys)+5;const W=x1-x0,H=y1-y0;return C._cwFaceMeasure(Pp.map(([x,y,z])=>({x:(x-x0)/W,y:(y-y0)/H,z:z/W})),H/W,null);}
const FAR=proj(120), DS=[]; for(let d=20;d<=200;d+=2) DS.push(d);
const MOD={};for(const d of DS){const m=proj(d);MOD[d]={};for(const a of REL) if(m[a]!=null&&FAR[a]&&a!=='eyeTilt'&&a!=='browAngle') MOD[d][a]=m[a]/FAR[a];}
const SENS=REL.filter(a=>MOD[30][a]!=null&&Math.abs(Math.log(MOD[30][a]))>0.02);
const obsRatio=p=>{const o={};for(const a of REL){const n=med(p.N.map(m=>m[a])),f=med(p.F.map(m=>m[a]));if(n!=null&&f!=null&&f!==0&&a!=='eyeTilt'&&a!=='browAngle')o[a]=n/f;}return o;};
function fitD(o){let best=null;for(const d of DS){let e=0;for(const a of SENS) if(o[a]&&o[a]>0) e+=Math.pow(Math.log(o[a])-Math.log(MOD[d][a]),2);if(!best||e<best.e)best={d,e};}return best;}
const rank=(a,v)=>C._cwRank(v,C.CW_FACE_REF.q[a]);
function evalOn(p,fac){const out={};for(const a of SENS){const fr=med(p.F.map(m=>m[a]));if(fr==null)continue;const rf=rank(a,fr);const rs=p.N.map(m=>m[a]).filter(v=>v!=null).map(v=>rank(a,v/(fac[a]||1)));out[a]=med(rs.map(r=>Math.abs(r-rf)));}return out;}
console.log('민감 축(모형 d30 에서 >2%):',SENS.join(','));
const oJ=obsRatio(P.J),oQ=obsRatio(P.Q);
const fJ=fitD(oJ),fQ=fitD(oQ),fAll=fitD(Object.fromEntries(SENS.map(a=>[a,Math.sqrt((oJ[a]||1)*(oQ[a]||1))])));
console.log('유효 거리 적합: J',fJ.d,'cm · P',fQ.d,'cm · 둘 합',fAll.d,'cm (원거리 기준 120cm)');
const rows=[];
for(const [tr,te,ftr,otr,name] of [[P.J,P.Q,fJ,oJ,'J→P'],[P.Q,P.J,fQ,oQ,'P→J']]){
  const m0=evalOn(te,{}),m1=evalOn(te,MOD[ftr.d]),m2=evalOn(te,otr);
  console.log(`\n[${name}] 학습 사람으로 맞추고 다른 사람에서 평가 — |Δrank| 축별 중앙`);
  console.log('axis'.padEnd(15)+'  none  geo1  emp');
  for(const a of SENS) console.log(a.padEnd(15)+[m0,m1,m2].map(m=>m[a]==null?'   - ':m[a].toFixed(2).padStart(6)).join(''));
  const s=m=>med(Object.values(m));console.log('전체 중앙'.padEnd(13)+[m0,m1,m2].map(m=>s(m).toFixed(3).padStart(6)).join(''));
  rows.push({name,none:s(m0),geo:s(m1),emp:s(m2)});
}
console.log('\n관측 근/원 비 vs 모형(d='+fAll.d+')');for(const a of SENS) console.log(a.padEnd(15),(oJ[a]||NaN).toFixed(3),(oQ[a]||NaN).toFixed(3),MOD[fAll.d][a].toFixed(3));
console.log('\nJSON',JSON.stringify({dJ:fJ.d,dQ:fQ.d,dAll:fAll.d,rows}));
