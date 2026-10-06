// v799 P-792-B2 진단 d11 — 라벨셋(8명 · S26 Ultra 한 대 · 같은 날 같은 자리) 촬영 조건별 계측 차이
//  조건: near(전면 f35=30 · 약 34~54cm) · rear1x(후면 1배 f35=23 · 약 39~57cm) · far(후면 3배 f35=69 · 약 101~114cm)
//  ① 원시 계측(보정 없음) 중앙값의 비: near/far(거리+카메라) · rear1x/far(거리만, 같은 후면) · near/rear1x(카메라만, 같은 거리)
//  ② 기하 모형비(d=48 vs 120) — CW_FACE_PERSP 와 같은 방식
//  ③ 얼굴형 판정 안정성: 앱 규칙대로 near·rear1x(EXIF 거리≤60 → 'live' 보정) vs far(보정 없음)
'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib');
const ROOT=path.join(__dirname,'..'),EV=path.join(ROOT,'..','ChunWoon_IP','face','eval_labelset');
const STUB="const FACE_S=[{l:'round',v:'round'},{l:'square',v:'square'},{l:'long',v:'long'},{l:'inv',v:'inv'}];const FACE_E=[{l:'big',v:'big'},{l:'narrow',v:'narrow'},{l:'round',v:'round'},{l:'droopy',v:'droopy'}];const FACE_N=[{l:'high',v:'high'},{l:'wide',v:'wide'},{l:'small',v:'small'},{l:'hooked',v:'hooked'}];const FACE_M=[{l:'big',v:'big'},{l:'small',v:'small'},{l:'thick',v:'thick'},{l:'thin',v:'thin'}];";
const idx=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');const i0=idx.indexOf('var CW_FACE_REF'),i1=idx.indexOf('//  5b. PAL',i0);
const M={exports:{}};new Function('module','exports','window',STUB+idx.slice(i0,idx.lastIndexOf('// ====',i1))+'\nmodule.exports={_cwFaceMeasure,_cwFaceMeasureRaw,_cwHairline,classifyFaceFromLandmarks,CW_FACE_AXIS_KIND,CW_FACE_PERSP,CW_SELFIE_NEAR_CM};')(M,M.exports,{});const C=M.exports;
const L=JSON.parse(fs.readFileSync(path.join(EV,'cache','landmarks.json'),'utf8'));
const med=a=>{a=a.filter(x=>x!=null&&isFinite(x));if(!a.length)return null;const s=[...a].sort((x,y)=>x-y);return s.length%2?s[(s.length-1)>>1]:(s[s.length/2-1]+s[s.length/2])/2;};
const load=k=>{const d=L[k],ai=d.lm.map(a=>({x:a[0],y:a[1],z:a[2]}));const hr=C._cwHairline(zlib.gunzipSync(fs.readFileSync(path.join(EV,'cache',k+'.mask.gz'))),d.w,d.h,ai);return {k,ai,A:d.h/d.w,hr,d};};
// 기하 모형
const V=fs.readFileSync(path.join(ROOT,'_v789_work','fixtures','canonical_face_model.obj'),'utf8').split('\n').filter(l=>l.startsWith('v ')).map(l=>l.split(/\s+/).slice(1,4).map(Number));
const zmax=Math.max(...V.map(v=>v[2]));
function proj(d){const Pp=V.map(([x,y,z])=>{const s=d/(d+zmax-z);return [x*s,-y*s,z];});const xs=Pp.map(p=>p[0]),ys=Pp.map(p=>p[1]);const x0=Math.min(...xs)-5,x1=Math.max(...xs)+5,y0=Math.min(...ys)-8,y1=Math.max(...ys)+5;const W=x1-x0,H=y1-y0;return C._cwFaceMeasureRaw(Pp.map(([x,y,z])=>({x:(x-x0)/W,y:(y-y0)/H,z:z/W})),H/W,null);}
const MN=proj(C.CW_FACE_PERSP.dEff),MF=proj(C.CW_FACE_PERSP.dFar);
const AX=['jawRatio','cheonI','cheonJiWidth','whRatio','lowerUpperWidth','cheonJiHeight','symmetry','thirds','eyeSize','noseWRatio','mouthRatio'];
const pids=[...new Set(Object.values(L).map(v=>v.pid))].sort();
const out={people:{},model:{}};for(const a of AX)out.model[a]=MN[a]!=null&&MF[a]?MN[a]/MF[a]:null;
const R={nf:{},rf:{},nr:{}};for(const a of AX){R.nf[a]=[];R.rf[a]=[];R.nr[a]=[];}
console.log('[d11] 사람',pids.length,'· 사진',Object.keys(L).length);
for(const p of pids){
  const g=kind=>Object.keys(L).filter(k=>L[k].pid===p&&L[k].kind===kind).sort().map(load);
  const G={near:g('near'),rear1x:g('rear1x'),far:g('far')};
  const raw={},lab={};
  for(const [kd,arr] of Object.entries(G)){
    raw[kd]={};const ms=arr.map(x=>C._cwFaceMeasureRaw(x.ai,x.A,x.hr));for(const a of AX)raw[kd][a]=med(ms.map(m=>m[a]));
    lab[kd]=arr.map(x=>{const src=x.d.distCm<=C.CW_SELFIE_NEAR_CM?'live':null;const c=C.classifyFaceFromLandmarks(x.ai,x.A,x.hr,src);return {shape:c.shapeOpt.v,src,dist:x.d.distCm,jawR:c.ranks.jawRatio,whR:c.ranks.whRatio,cjw:C._cwFaceMeasureRaw(x.ai,x.A,x.hr).cheonJiWidth,jawRaw:C._cwFaceMeasureRaw(x.ai,x.A,x.hr).jawRatio};});
  }
  const ratio=(x,y)=>{const o={};for(const a of AX)o[a]=raw[x][a]&&raw[y][a]?raw[x][a]/raw[y][a]:null;return o;};
  const nf=ratio('near','far'),rf=ratio('rear1x','far'),nr=ratio('near','rear1x');
  for(const a of AX){R.nf[a].push(nf[a]);R.rf[a].push(rf[a]);R.nr[a].push(nr[a]);}
  out.people[p]={raw,nf,rf,nr,labels:lab};
  console.log(`\n[${p}] n${G.near.length}/r${G.rear1x.length}/f${G.far.length} · 얼굴형 near ${lab.near.map(l=>l.shape).join(',')} | rear1x ${lab.rear1x.map(l=>l.shape).join(',')} | far ${lab.far.map(l=>l.shape).join(',')}`);
  console.log('   jawRaw near '+lab.near.map(l=>l.jawRaw.toFixed(3)).join(' ')+' | rear '+lab.rear1x.map(l=>l.jawRaw.toFixed(3)).join(' ')+' | far '+lab.far.map(l=>l.jawRaw.toFixed(3)).join(' '));
  console.log('   cheonJiW near '+lab.near.map(l=>l.cjw.toFixed(3)).join(' ')+' | rear '+lab.rear1x.map(l=>l.cjw.toFixed(3)).join(' ')+' | far '+lab.far.map(l=>l.cjw.toFixed(3)).join(' '));
}
console.log('\n축'.padEnd(17)+'   모형n/f |  near/far 중앙[최소~최대] | rear1x/far 중앙[최소~최대] | near/rear1x 중앙[최소~최대]');
out.summary={};
for(const a of AX){const f=v=>{const s=v.filter(x=>x!=null);return `${med(s).toFixed(3)} [${Math.min(...s).toFixed(3)}~${Math.max(...s).toFixed(3)}]`;};
  out.summary[a]={model:out.model[a],nf:med(R.nf[a]),rf:med(R.rf[a]),nr:med(R.nr[a]),nf_all:R.nf[a],rf_all:R.rf[a],nr_all:R.nr[a]};
  console.log(a.padEnd(16)+(out.model[a]?out.model[a].toFixed(3):'  -  ').padStart(9)+' | '+f(R.nf[a]).padEnd(24)+' | '+f(R.rf[a]).padEnd(24)+' | '+f(R.nr[a]));}
fs.writeFileSync(path.join(__dirname,'d11.json'),JSON.stringify(out,null,1));
