// v801 d26 — 종합 점수(= 조화도) 85~95 몰림 진단. ★수치 변경 없음 · 진단만.
// 출력: ① 묶음별 분포 ② 항목별 분포·포화 ③ 항목별 감점 몫 ④ 분산 기여 ⑤ 사람 간/사람 안(ICC) ⑥ clamp 이전 원값
'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib');const Lb=require('./persp_v2_lib.js');
const ROOT=path.join(__dirname,'..'),IP=path.join(ROOT,'..','ChunWoon_IP','face');const C=Lb.loadCore(path.join(ROOT,'index.html'));
function load(dir){const L=JSON.parse(fs.readFileSync(path.join(IP,dir,'cache','landmarks.json'),'utf8'));return [L,k=>{const d=L[k];const ai=d.lm.map(a=>({x:a[0],y:a[1],z:a[2]}));const mp=path.join(IP,dir,'cache',k+'.mask.gz');const hr=fs.existsSync(mp)?C._cwHairline(zlib.gunzipSync(fs.readFileSync(mp)),d.w,d.h,ai):null;return {d,ai,A:d.h/d.w,hr};}];}
const [LB,fL]=load('eval_labelset'),[SB,fS]=load('eval_selfie'),[NB,fN]=load('eval_hairline');const rows=[];let held=0;
function add(set,g,k,x,src){const c=C.classifyFaceFromLandmarks(x.ai,x.A,x.hr,src);if(c.pose&&c.pose.held){held++;return;}rows.push({set,g,k,ov:c.overallScore,hp:c.harmonyParts,m:c.ratios});}
for(const k of Object.keys(LB))add('label',LB[k].pid,k,fL(k),LB[k].distCm<=60?'live':null);
for(const k of Object.keys(SB).filter(k=>/^p2_2026_nog/.test(k)))add('label','P2',k,fS(k),/near/.test(k)?'live':null);
for(const k of Object.keys(SB).filter(k=>/^jay_2026_nog/.test(k)))add('label','J0',k,fS(k),/guide/.test(k)?'live':null);
for(const k of Object.keys(SB).filter(k=>!/_2026_nog/.test(k)))add('selfie','jay',k,fS(k),null);
for(const k of Object.keys(NB))if(NB[k]&&NB[k].lm)add('net','n_'+k,k,fN(k),null);
const mean=a=>a.reduce((x,y)=>x+y,0)/a.length,sd=a=>{const m=mean(a);return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/Math.max(1,a.length-1));};
const qt=(a,p)=>{const s=[...a].sort((x,y)=>x-y);const i=(s.length-1)*p,lo=Math.floor(i);return s[lo]+(s[Math.min(lo+1,s.length-1)]-s[lo])*(i-lo);};
const f=(v,d=2)=>isFinite(v)?v.toFixed(d):'-';
const P=['symmetry','thirds','cheonI','organProp'],W={symmetry:.32,thirds:.32,cheonI:.18,organProp:.18};
console.log(`사진 ${rows.length}장 (보류 제외 ${held})`);
console.log('① 종합 점수 분포');
for(const [n,q] of [['전체',rows],['라벨셋+P2+J0',rows.filter(r=>r.set==='label')],['셀카(제이)',rows.filter(r=>r.set==='selfie')],['인터넷23',rows.filter(r=>r.set==='net')]]){const o=q.map(r=>r.ov);
 console.log(`  ${n} n ${q.length} · 평균 ${f(mean(o),1)} SD ${f(sd(o),1)} · 최소 ${Math.min(...o)} P10 ${f(qt(o,.1),0)} 중앙 ${f(qt(o,.5),0)} P90 ${f(qt(o,.9),0)} 최대 ${Math.max(...o)} · 85~95 비율 ${f(100*o.filter(v=>v>=85&&v<=95).length/o.length,0)}%`);}
console.log('② 항목별 분포 (0~1) · 포화(=1)·바닥(=0) 비율');
for(const p of P){const a=rows.map(r=>r.hp[p]);console.log(`  ${p.padEnd(9)} 평균 ${f(mean(a),3)} SD ${f(sd(a),3)} · 최소 ${f(Math.min(...a),3)} P10 ${f(qt(a,.1),3)} 중앙 ${f(qt(a,.5),3)} P90 ${f(qt(a,.9),3)} · =1 ${f(100*a.filter(v=>v>=0.9995).length/a.length,0)}% · =0 ${f(100*a.filter(v=>v<=0.0005).length/a.length,0)}%`);}
console.log('③ 항목별 감점(100점에서 깎이는 점수) 평균');
{let tot=0;const d={};for(const p of P){d[p]=mean(rows.map(r=>100*W[p]*(1-r.hp[p])));tot+=d[p];}console.log('  '+P.map(p=>`${p} −${f(d[p],1)}`).join(' · ')+` · 합 −${f(tot,1)} (→ 평균 ${f(100-tot,1)})`);
 console.log('  항목별 최대로 가능한 감점: '+P.map(p=>`${p} −${W[p]*100}`).join(' · '));}
console.log('④ 종합 분산 기여 (cov(가중 항목, 종합)/var(종합))');
{const o=rows.map(r=>r.ov),mo=mean(o),vo=o.reduce((s,x)=>s+(x-mo)**2,0);console.log('  '+P.map(p=>{const a=rows.map(r=>100*W[p]*r.hp[p]),ma=mean(a);let c=0;for(let i=0;i<a.length;i++)c+=(a[i]-ma)*(o[i]-mo);return `${p} ${f(100*c/vo,0)}%`;}).join(' · '));}
console.log('⑤ 사람 간 vs 사람 안 (라벨셋 01~08 + P2 + J0 — ICC(1) = 사람 간 분산 몫)');
{const q=rows.filter(r=>r.set==='label');const icc=get=>{const g={};q.forEach(r=>(g[r.g]=g[r.g]||[]).push(get(r)));const G=Object.values(g),N=q.length,k=G.length,gm=mean(q.map(get));let ssb=0,ssw=0;G.forEach(a=>{const m=mean(a);ssb+=a.length*(m-gm)**2;a.forEach(x=>ssw+=(x-m)**2);});const n0=(N-G.reduce((s,a)=>s+a.length**2,0)/N)/(k-1);const msb=ssb/(k-1),msw=ssw/(N-k);return {icc:(msb-msw)/(msb+(n0-1)*msw),sdw:Math.sqrt(msw),sdb:Math.sqrt(Math.max(0,(msb-msw)/n0))};};
 for(const [n,get] of [['종합',r=>r.ov],...P.map(p=>[p,r=>100*W[p]*r.hp[p]])]){const x=icc(get);console.log(`  ${n.padEnd(9)} ICC ${f(x.icc)} · 사람 간 SD ${f(x.sdb,1)}점 · 사람 안 SD ${f(x.sdw,1)}점`);}
 const g={};q.forEach(r=>(g[r.g]=g[r.g]||[]).push(r.ov));console.log('  사람별 평균(범위): '+Object.entries(g).map(([k,a])=>`${k} ${f(mean(a),0)}(${Math.min(...a)}~${Math.max(...a)})`).join(' · '));}
console.log('⑥ clamp 이전 원값 — symmetry·cheonI 는 (1−5×편차/폭), 편차/폭 분포');
{const a=rows.map(r=>(1-r.hp.symmetry)/5),b=rows.map(r=>(1-r.hp.cheonI)/5);console.log(`  대칭 편차/얼굴폭 중앙 ${f(qt(a,.5),3)} P90 ${f(qt(a,.9),3)} 최대 ${f(Math.max(...a),3)} · 천이 편차/폭 중앙 ${f(qt(b,.5),3)} P90 ${f(qt(b,.9),3)} 최대 ${f(Math.max(...b),3)}`);
 const c=rows.map(r=>(1-r.hp.thirds)/2);console.log(`  중·하정 |중−하|/(중+하) 중앙 ${f(qt(c,.5),3)} P90 ${f(qt(c,.9),3)} 최대 ${f(Math.max(...c),3)}`);
 const e=rows.map(r=>r.m.eyeSize*2/r.m.noseWRatio),mo=rows.map(r=>r.m.mouthRatio/r.m.noseWRatio);console.log(`  오관: 눈폭×2/코폭 중앙 ${f(qt(e,.5))} (P10 ${f(qt(e,.1))}~P90 ${f(qt(e,.9))}) · 입/코 중앙 ${f(qt(mo,.5))} (P10 ${f(qt(mo,.1))}~P90 ${f(qt(mo,.9))}) · 기준 1.62`);}
