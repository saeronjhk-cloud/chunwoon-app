// v799 d20 — 상정(上停)을 종합 점수에 넣는 방식별 비교(정책 판단 자료 · 자문 P-799-C)
//  cur = 현행(1단계 후): 머리선 보이면 3분, 가리면 2분 · O3 = 점수는 항상 中/下 2분(상정은 별도 표시) · O6 = 가리면 상정을 참조 중앙값으로 대체해 항상 3분
'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib');const L=require('./persp_v2_lib.js');
const ROOT=path.join(__dirname,'..'),IP=path.join(ROOT,'..','ChunWoon_IP','face');const C=L.loadCore(path.join(ROOT,'index.html'));
const t2=r=>1-Math.min(1,Math.abs(r-1)/(r+1)*2);
const t3=(u,r)=>{const m=r/(1+r),l=1/(1+r),T=u+m+l,i=T/3;return 1-Math.min(1,(Math.abs(u-i)+Math.abs(m-i)+Math.abs(l-i))/T*2);};
function rows(dir,filter,pidOf,srcOf){const Lm=JSON.parse(fs.readFileSync(path.join(IP,dir,'cache','landmarks.json'),'utf8'));const out=[];
 for(const k of Object.keys(Lm).filter(filter)){const d=Lm[k];if(!d||!d.lm)continue;const ai=d.lm.map(a=>({x:a[0],y:a[1],z:a[2]}));const mp=path.join(IP,dir,'cache',k+'.mask.gz');
  const hr=fs.existsSync(mp)?C._cwHairline(zlib.gunzipSync(fs.readFileSync(mp)),d.w,d.h,ai):null;const c=C.classifyFaceFromLandmarks(ai,d.h/d.w,hr,srcOf(k,d));const raw=C._cwFaceMeasureRaw(ai,d.h/d.w,hr);
  const hp=c.harmonyParts;const ov=th=>Math.round(100*(0.32*hp.symmetry+0.32*th+0.18*hp.cheonI+0.18*hp.organProp));
  // 상정 비(정면화): thirds(3분) 에서 역산 대신 직접 — raw 에 없으므로 2D upperOverRest 사용(정면화와 차 ~3%)
  out.push({pid:pidOf(k,d),k,parts:raw.thirdsParts,u:raw.upperOverRest,r:raw.thirdsMidLow,cur:c.overallScore,O3:ov(t2(raw.thirdsMidLow)),th3:raw.thirdsParts===3?hp.thirds:null});}return out;}
const LBr=rows('eval_labelset',()=>true,(k,d)=>d.pid,(k,d)=>d.distCm<=60?'live':null);
const P2=rows('eval_selfie',k=>/^p2_2026_nog/.test(k),()=>'P2',k=>/near/.test(k)?'live':null),J0=rows('eval_selfie',k=>/^jay_2026_nog/.test(k),()=>'J0',k=>/guide/.test(k)?'live':null);
const NET=rows('eval_hairline',()=>true,k=>k,()=>null),SEL=rows('eval_selfie',()=>true,k=>k,()=>null);
const all=[...LBr,...P2,...J0];const uMed=L.med([...all,...NET].filter(r=>r.u!=null).map(r=>r.u));
// 상정 중앙 비율(정면화 대신 2D 값 기준 · 참고)
for(const r of [...all,...NET,...SEL]){r.O6=r.parts===3?r.cur:Math.round(r.cur-100*0.32*(t2(r.r))+100*0.32*t3(uMed,r.r));}
const by={};all.forEach(r=>(by[r.pid]=by[r.pid]||[]).push(r));const rng=a=>Math.max(...a)-Math.min(...a);
console.log('상정/(中+下) 참조 중앙(2D)',uMed.toFixed(3));
for(const o of ['cur','O3','O6'])console.log(o.padEnd(3),'같은 사람 범위 중앙',L.med(Object.values(by).map(a=>rng(a.map(x=>x[o])))),'· 사람별',Object.entries(by).map(([p,a])=>p+':'+rng(a.map(x=>x[o]))).join(' '));
const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
for(const [name,set] of [['라벨셋+P2+J0',all],['인터넷23',NET],['셀카전체',SEL]]){const g3=set.filter(r=>r.parts===3),g2=set.filter(r=>r.parts===2);
 console.log(name.padEnd(10),'n',set.length,'· 3분',g3.length,'2분',g2.length,'| 현행 평균 3분',g3.length?mean(g3.map(r=>r.cur)).toFixed(1):'-','2분',g2.length?mean(g2.map(r=>r.cur)).toFixed(1):'-','| O3 평균 3분',g3.length?mean(g3.map(r=>r.O3)).toFixed(1):'-','2분',g2.length?mean(g2.map(r=>r.O3)).toFixed(1):'-','| 전체 평균 cur',mean(set.map(r=>r.cur)).toFixed(1),'O3',mean(set.map(r=>r.O3)).toFixed(1),'O6',mean(set.map(r=>r.O6)).toFixed(1));}
// 같은 사람 안: 머리선 보인 사진 vs 가린 사진 평균 차(현행)
console.log('같은 사람 안 3분-2분 평균 차(현행):',Object.entries(by).filter(([p,a])=>a.some(r=>r.parts===3)&&a.some(r=>r.parts===2)).map(([p,a])=>p+':'+(mean(a.filter(r=>r.parts===3).map(r=>r.cur))-mean(a.filter(r=>r.parts===2).map(r=>r.cur))).toFixed(1)).join(' '));
fs.writeFileSync(path.join(__dirname,'d20.json'),JSON.stringify({all,NET,SEL}));
