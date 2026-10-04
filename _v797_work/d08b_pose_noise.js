// v797 P-797-C 진단 2 — (a) ABS 차이가 원근인지 자세(yaw)인지 (b) 라벨 근/원 불일치 vs 같은 조건 안 불일치 (c) jawRatio 원시 비
'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib');const ROOT=path.join(__dirname,'..'),EV=path.join(ROOT,'..','ChunWoon_IP','face','eval_selfie');
const STUB="const FACE_S=[{l:'round',v:'round'},{l:'square',v:'square'},{l:'long',v:'long'},{l:'inv',v:'inv'}];const FACE_E=[{l:'big',v:'big'},{l:'narrow',v:'narrow'},{l:'round',v:'round'},{l:'droopy',v:'droopy'}];const FACE_N=[{l:'high',v:'high'},{l:'wide',v:'wide'},{l:'small',v:'small'},{l:'hooked',v:'hooked'}];const FACE_M=[{l:'big',v:'big'},{l:'small',v:'small'},{l:'thick',v:'thick'},{l:'thin',v:'thin'}];";
const idx=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');const i0=idx.indexOf('var CW_FACE_REF'),i1=idx.indexOf('//  5b. PAL',i0);
const M={exports:{}};new Function('module','exports','window',STUB+idx.slice(i0,idx.lastIndexOf('// ====',i1))+'\nmodule.exports={_cwFaceMeasure,_cwRank,_cwHairline,classifyFaceFromLandmarks,CW_FACE_REF};')(M,M.exports,{});const C=M.exports;
const L=JSON.parse(fs.readFileSync(path.join(EV,'cache','landmarks.json'),'utf8'));
const load=k=>{const d=L[k],ai=d.lm.map(a=>({x:a[0],y:a[1],z:a[2]}));const hr=C._cwHairline(zlib.gunzipSync(fs.readFileSync(path.join(EV,'cache',k+'.mask.gz'))),d.w,d.h,ai);return {k,ai,A:d.h/d.w,hr};};
const yaw=x=>{const a=x.ai;const l=a[234].x,r=a[454].x,n=a[1].x;return ((n-l)-(r-n))/(r-l);}; // 0=정면
const med=a=>{const s=[...a].sort((x,y)=>x-y);return s.length%2?s[(s.length-1)>>1]:(s[s.length/2-1]+s[s.length/2])/2;};
const P={J:['jay_2026_nog_guide','jay_2026_nog_far'],P:['p2_2026_nog_near','p2_2026_nog_far']};
const agree={};const LAB=['shapeOpt','eyeOpt','noseOpt','mouthOpt'];
for(const [pn,[np,fp]] of Object.entries(P)){
  const ks=f=>Object.keys(L).filter(k=>k.startsWith(f)).sort();
  const N=ks(np).map(load),F=ks(fp).map(load);
  console.log(`\n[${pn}] (a) 사진별 yaw(코끝 좌우 치우침) · cheonI · symmetry`);
  for(const [cond,arr,src] of [['N',N,'live'],['F',F,null]])for(const x of arr){const m=C._cwFaceMeasure(x.ai,x.A,x.hr,src);console.log(`  ${cond} ${x.k.padEnd(24)} yaw ${yaw(x).toFixed(3).padStart(7)}  cheonI ${m.cheonI.toFixed(3)}  sym ${m.symmetry.toFixed(3)}  jawRaw ${m.jawRatio.toFixed(4)}`);}
  const cN=N.map(x=>C.classifyFaceFromLandmarks(x.ai,x.A,x.hr,'live')),cF=F.map(x=>C.classifyFaceFromLandmarks(x.ai,x.A,x.hr,null));
  const pr=(A,B,same)=>{let a=0,t=0;for(let i=0;i<A.length;i++)for(let j=same?i+1:0;j<B.length;j++){t++;a+=A[i]===B[j]?1:0;}return t?a/t:null;};
  console.log(`[${pn}] (b) 라벨 일치율  근×근 · 원×원 · 근×원`);
  for(const o of LAB){const n=cN.map(c=>c[o].v),f=cF.map(c=>c[o].v);const r=[pr(n,n,1),pr(f,f,1),pr(n,f,0)];(agree[o]=agree[o]||[]).push(r);console.log(`  ${o.padEnd(9)} ${r.map(v=>v==null?'  -  ':v.toFixed(2)).join('   ')}`);}
  const jN=med(N.map(x=>C._cwFaceMeasure(x.ai,x.A,x.hr,'live').jawRatio)),jF=med(F.map(x=>C._cwFaceMeasure(x.ai,x.A,x.hr,null).jawRatio));
  const q=C.CW_FACE_REF.q.jawRatio;console.log(`[${pn}] (c) jawRatio 원시 중앙 근 ${jN.toFixed(4)} 원 ${jF.toFixed(4)} 비 ${(jN/jF).toFixed(4)} · 랭크 ${C._cwRank(jN,q).toFixed(2)}→${C._cwRank(jF,q).toFixed(2)} · 정사각 임계(랭크 0.62) 원시값 ≈ ${(()=>{let lo=0.3,hi=1.2;for(let i=0;i<60;i++){const mid=(lo+hi)/2;if(C._cwRank(mid,q)<0.62)lo=mid;else hi=mid;}return lo.toFixed(4);})()}`);
}
