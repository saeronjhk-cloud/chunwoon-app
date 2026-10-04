// v797 P-795-A 진단 — 셀카 평가셋(제이 25장)의 REL 축 랭크를 현 참조표로 계산 · 조건별(가이드 안경/무안경 · 옛 셀카 · 무원근) 비교
// node _v797_work/d01_selfie_rank_diag.js [json]
'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib');
const ROOT=path.join(__dirname,'..'),EV=path.join(ROOT,'..','ChunWoon_IP','face','eval_selfie');
const STUB="const FACE_S=[{l:'a',v:'round'},{l:'b',v:'square'},{l:'c',v:'long'},{l:'d',v:'inv'}];const FACE_E=[{l:'a',v:'big'},{l:'b',v:'narrow'},{l:'c',v:'round'},{l:'d',v:'droopy'}];const FACE_N=[{l:'a',v:'high'},{l:'b',v:'wide'},{l:'c',v:'small'},{l:'d',v:'hooked'}];const FACE_M=[{l:'a',v:'big'},{l:'b',v:'small'},{l:'c',v:'thick'},{l:'d',v:'thin'}];";
const idx=fs.readFileSync(process.env.P17_INDEX||path.join(ROOT,'index.html'),'utf8');
const i0=idx.indexOf('var CW_FACE_REF'),i1=idx.indexOf('//  5b. PAL',i0);
const M={exports:{}};
new Function('module','exports','window',STUB+idx.slice(i0,idx.lastIndexOf('// ====',i1))+'\nmodule.exports={_cwFaceMeasure,_cwRank,_cwHairline,CW_FACE_REF,CW_FACE_AXES,CW_FACE_AXIS_KIND};')(M,M.exports,undefined);
const C=M.exports, L=JSON.parse(fs.readFileSync(path.join(EV,'cache','landmarks.json'),'utf8'));
const REL=C.CW_FACE_AXES.filter(k=>C.CW_FACE_AXIS_KIND[k]==='REL');
const grp=k=>k.startsWith('p2_')?(k.includes('_far_')?'PnF':'PnN'):k.includes('2026_g_far')?'JgF':k.includes('2026_nog_far')?'JnF':k.includes('2026_g_')?'JgN':k.includes('2026_nog')?'JnN':k.includes('nog_')?'FLAT':'OLDg';
const rows={};
for(const k of Object.keys(L).sort()){const d=L[k],ai=d.lm.map(a=>({x:a[0],y:a[1],z:a[2]}));
  const hr=C._cwHairline(zlib.gunzipSync(fs.readFileSync(path.join(EV,'cache',k+'.mask.gz'))),d.w,d.h,ai);
  const m=C._cwFaceMeasure(ai,d.h/d.w,hr); rows[k]={g:grp(k),hair:hr.status,m,r:{}};
  for(const a of REL) if(m[a]!=null) rows[k].r[a]=C._cwRank(m[a],C.CW_FACE_REF.q[a]);}
if(process.argv[2]==='json'){console.log(JSON.stringify(rows));process.exit(0);}
const G=['JgN','JnN','JgF','JnF','PnN','PnF','OLDg','FLAT'];const med=a=>{if(!a.length)return NaN;const s=[...a].sort((x,y)=>x-y);return s.length%2?s[(s.length-1)>>1]:(s[s.length/2-1]+s[s.length/2])/2;};
console.log('REF',C.CW_FACE_REF.version,'· n',Object.keys(L).length,'· 머리선 OK',Object.values(rows).filter(r=>r.hair==='OK').length);
console.log('axis'.padEnd(15)+G.map(g=>g.padStart(7)).join('')+'   J근/원 P근/원 (원시값비)');
for(const a of REL){const md=G.map(g=>med(Object.values(rows).filter(r=>r.g===g&&r.r[a]!=null).map(r=>r.r[a])));
  const raw=g=>med(Object.values(rows).filter(r=>r.g===g&&r.m[a]!=null).map(r=>r.m[a]));
  console.log(a.padEnd(15)+md.map(v=>isNaN(v)?'    -  ':v.toFixed(2).padStart(7)).join('')+'   '+(raw('JnN')/raw('JnF')).toFixed(3)+'  '+(raw('PnN')/raw('PnF')).toFixed(3));}
