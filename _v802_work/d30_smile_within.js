// v803 d30 — 미소 판정이 같은 사람 안 흔들림(d27 사람 안 SD 1.64 · ICC 0.19)을 얼마나 줄이는가 + JS·파이썬 판정 일치(이식 검증).
// 집합: d27 과 동일(라벨셋 8명 + P2 + J0, 고개 보류 제외). 판정은 smile_lib.js(JS) — real_scores.json(파이썬)과 대조.
'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib');
const Lb=require('../_v799_work/persp_v2_lib.js');const S=require('./smile/smile_lib.js');
const ROOT=path.join(__dirname,'..'),IP=path.join(ROOT,'..','ChunWoon_IP','face');const C=Lb.loadCore(path.join(ROOT,'index.html'));
// d27 의 load() 그대로 복사(마스크·hair 처리 동일)
function load(dir){const L=JSON.parse(fs.readFileSync(path.join(IP,dir,'cache','landmarks.json'),'utf8'));return [L,k=>{const d=L[k];const ai=d.lm.map(a=>({x:a[0],y:a[1],z:a[2]}));const mp=path.join(IP,dir,'cache',k+'.mask.gz');const hr=fs.existsSync(mp)?C._cwHairline(zlib.gunzipSync(fs.readFileSync(mp)),d.w,d.h,ai):null;return {d,ai,A:d.h/d.w,hr};}];}
const [LB,fL]=load('eval_labelset'),[SB,fS]=load('eval_selfie');
const PY=Object.fromEntries(JSON.parse(fs.readFileSync(path.join(__dirname,'smile','real_scores.json'),'utf8')).map(r=>[r.id,r['5특징']]));
const P=['symmetry','thirds','cheonI','organProp'],W={symmetry:32,thirds:32,cheonI:18,organProp:18};const rows=[];let maxd=0;
function add(g,cond,k,d,x,src){const c=C.classifyFaceFromLandmarks(x.ai,x.A,x.hr,src);if(c.pose&&c.pose.held)return;
 const sm=S.smileScore(d.lm.map(a=>({x:a[0],y:a[1]})),d.w,d.h);const py=PY[k];if(py!=null)maxd=Math.max(maxd,Math.abs((sm.logit-S.M.warnT)-py));
 rows.push({g,cond,k,ov:100*P.reduce((s,p)=>s+W[p]/100*c.harmonyParts[p],0),sm});}
for(const k of Object.keys(LB))add(LB[k].pid,LB[k].kind,k,LB[k],fL(k),LB[k].distCm<=60?'live':null);
for(const k of Object.keys(SB).filter(k=>/^p2_2026_nog/.test(k)))add('P2',/near/.test(k)?'near':'far',k,SB[k],fS(k),/near/.test(k)?'live':null);
for(const k of Object.keys(SB).filter(k=>/^jay_2026_nog/.test(k)))add('J0',/guide/.test(k)?'near':'far',k,SB[k],fS(k),/guide/.test(k)?'live':null);
const mean=a=>a.reduce((x,y)=>x+y,0)/a.length,f=(v,d=2)=>v.toFixed(d);
function stats(R){const g={};R.forEach(r=>(g[r.g]=g[r.g]||[]).push(r.ov));const G=Object.values(g).filter(a=>a.length>=2);
 const N=G.reduce((s,a)=>s+a.length,0),a=G.length,gm=mean(G.flat());let ssb=0,ssw=0;G.forEach(x=>{const m=mean(x);ssb+=x.length*(m-gm)**2;x.forEach(v=>ssw+=(v-m)**2);});
 const msb=ssb/(a-1),msw=ssw/(N-a),n0=(N-G.reduce((s,x)=>s+x.length**2,0)/N)/(a-1);
 return {n:N,people:a,sdW:Math.sqrt(msw),icc:(msb-msw)/(msb+(n0-1)*msw),range:Object.fromEntries(Object.entries(g).map(([k,x])=>[k,Math.max(...x)-Math.min(...x)]))};}
console.log(`JS·파이썬 판정 여유(logit−warnT) 최대 차 ${maxd.toExponential(2)} (이식 일치 기준 < 1e-6)`);
for(const [nm,R] of [['전체',rows],['보류선 제외(hold)',rows.filter(r=>!r.sm.hold)],['경고선 제외(warn)',rows.filter(r=>!r.sm.warn)]]){
 const s=stats(R);console.log(`${nm.padEnd(14)} 사진 ${s.n} · ${s.people}명 · 사람 안 SD ${f(s.sdW)} · ICC ${f(s.icc)} · 사람별 범위 `+Object.entries(s.range).map(([k,v])=>`${k}:${f(v,1)}`).join(' '));}
console.log('제외된 사진: hold '+rows.filter(r=>r.sm.hold).map(r=>r.k).join(', ')+' | warn만 '+rows.filter(r=>r.sm.warn&&!r.sm.hold).map(r=>r.k).join(', '));
// ── ② 특징 축(REL 백분위) — 미소 사진이 같은 사람의 나머지 사진 평균에서 얼마나 벗어나는가(백분위 점 차)
{const any=C.classifyFaceFromLandmarks(fL(Object.keys(LB)[0]).ai,fL(Object.keys(LB)[0]).A,null,null);
 const RK=any.ranks||any.R||any.axisRanks;console.log('\n② classify 반환 키: '+Object.keys(any).join(','));
 if(RK){const AX=['mouthRatio','lipThickness','chin','inJung','noseWRatio','eyeSize','jawRatio','whRatio','gwanGol','browAngle'];
  const recs=[];const addR=(g,k,d,x,src)=>{const c=C.classifyFaceFromLandmarks(x.ai,x.A,x.hr,src);if(c.pose&&c.pose.held)return;const rk=c.ranks||c.R||c.axisRanks;
   recs.push({g,k,rk,sm:S.smileScore(d.lm.map(a=>({x:a[0],y:a[1]})),d.w,d.h)});};
  for(const k of Object.keys(LB))addR(LB[k].pid,k,LB[k],fL(k),LB[k].distCm<=60?'live':null);
  for(const k of Object.keys(SB).filter(k=>/^p2_2026_nog/.test(k)))addR('P2',k,SB[k],fS(k),/near/.test(k)?'live':null);
  const out={};for(const a of AX)out[a]={sm:[],ne:[]};
  const byG={};recs.forEach(r=>(byG[r.g]=byG[r.g]||[]).push(r));
  for(const R of Object.values(byG)){const ne=R.filter(r=>!r.sm.warn);if(ne.length<2)continue;
   for(const a of AX){const m=mean(ne.map(r=>r.rk[a]));R.forEach(r=>{const dv=Math.abs(r.rk[a]-m)*100;(r.sm.warn?out[a].sm:out[a].ne).push(dv);});}}
  console.log('   축별 |같은 사람 무표정 평균 대비 백분위 차| 평균 — 미소(warn) 사진 vs 무표정 사진');
  for(const a of AX)console.log(`   ${a.padEnd(12)} 미소 ${f(mean(out[a].sm),1)}점 (n ${out[a].sm.length}) · 무표정 ${f(mean(out[a].ne),1)}점 (n ${out[a].ne.length})`);}}
