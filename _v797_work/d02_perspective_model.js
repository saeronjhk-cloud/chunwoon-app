// v797 P-795-A 진단 2 — 원근(촬영 거리) 기하 모형: canonical_face_model(cm)을 거리 d 에서 핀홀 투영 → 축 원시값 / 원거리(무원근) 원시값
// 관측(제이 G26n/FLAT 비)과 축별 비교
'use strict';
const fs=require('fs'),path=require('path');const ROOT=path.join(__dirname,'..');
const STUB="const FACE_S=[{l:'a',v:'round'}];const FACE_E=[{l:'a',v:'big'}];const FACE_N=[{l:'a',v:'high'}];const FACE_M=[{l:'a',v:'big'}];";
const idx=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');const i0=idx.indexOf('var CW_FACE_REF'),i1=idx.indexOf('//  5b. PAL',i0);
const M={exports:{}};new Function('module','exports','window',STUB+idx.slice(i0,idx.lastIndexOf('// ====',i1))+'\nmodule.exports={_cwFaceMeasure,CW_FACE_AXES,CW_FACE_AXIS_KIND};')(M,M.exports,undefined);const C=M.exports;
const V=fs.readFileSync(path.join(ROOT,'_v789_work','fixtures','canonical_face_model.obj'),'utf8').split('\n').filter(l=>l.startsWith('v ')).map(l=>l.split(/\s+/).slice(1,4).map(Number));
console.error('nose tip z',V[1][2],'side 234 z',V[234][2],'width 234-454',(V[454][0]-V[234][0]).toFixed(2));
const zmax=Math.max(...V.map(v=>v[2]));
function proj(d){ // 카메라: 코끝 앞 d cm (z 축 +가 카메라 쪽)
  const P=V.map(([x,y,z])=>{const s=d/(d+zmax-z);return [x*s,-y*s,z];}); // depth from camera = d + (zmax - z)
  const xs=P.map(p=>p[0]),ys=P.map(p=>p[1]);const x0=Math.min(...xs)-5,x1=Math.max(...xs)+5,y0=Math.min(...ys)-8,y1=Math.max(...ys)+5;
  const W=x1-x0,H=y1-y0;return {ai:P.map(([x,y,z])=>({x:(x-x0)/W,y:(y-y0)/H,z:z/W})),asp:H/W};}
// note: s = d/(d+zmax-z)
const REL=C.CW_FACE_AXES.filter(k=>C.CW_FACE_AXIS_KIND[k]==='REL');
const far=(()=>{const p=proj(1e5);return C._cwFaceMeasure(p.ai,p.asp,null);})();
const obs=JSON.parse(process.argv[2]||'{}');
const out={};for(const d of [25,30,40,60,150]){const p=proj(d);const m=C._cwFaceMeasure(p.ai,p.asp,null);out[d]={};for(const a of REL) if(m[a]!=null&&far[a]) out[d][a]=m[a]/far[a];}
console.log('axis'.padEnd(15)+[25,30,40,60,150].map(d=>('d'+d).padStart(7)).join('')+'    obs');
for(const a of REL) console.log(a.padEnd(15)+[25,30,40,60,150].map(d=>out[d][a]==null?'   -   ':out[d][a].toFixed(3).padStart(7)).join('')+'  '+(obs[a]!=null?obs[a].toFixed(3):''));
