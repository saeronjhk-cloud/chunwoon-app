// v799 원근 보정 v2 공용 함수 — 생성기(d15)와 평가(p28)가 같은 규칙을 쓰도록 한 곳에 둔다
//  사람: 라벨셋 01~08(near=전면 f35 30 · far=후면 3배) + P2(eval_selfie p2_2026_nog_near/far) + J0(jay_2026_nog_guide/far, 01과 같은 사람 → 한 묶음)
//  후보 축: v1 보정 10축 + jawRatio + cheonJiWidth(8명 모두 같은 방향 — d11)
//  축별 선택 규칙(시험 대상 사람을 보지 않고): 학습 사람들 안에서 LOPO 랭크 오차 중앙값이 v1 계수(새 축은 1=무보정)보다 작고
//   학습 사람의 70% 이상에서 개선되면 경험 계수(학습 사람 근/원 비 중앙값) 채택(수정 1 — 1차는 「중앙값만」이라 흔들리는 축이 뽑혀 V3 실패)
'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib');
const STUB="const FACE_S=[{l:'round',v:'round'},{l:'square',v:'square'},{l:'long',v:'long'},{l:'inv',v:'inv'}];const FACE_E=[{l:'big',v:'big'},{l:'narrow',v:'narrow'},{l:'round',v:'round'},{l:'droopy',v:'droopy'}];const FACE_N=[{l:'high',v:'high'},{l:'wide',v:'wide'},{l:'small',v:'small'},{l:'hooked',v:'hooked'}];const FACE_M=[{l:'big',v:'big'},{l:'small',v:'small'},{l:'thick',v:'thick'},{l:'thin',v:'thin'}];";
function loadCore(indexPath){const idx=fs.readFileSync(indexPath,'utf8');const i0=idx.indexOf('var CW_FACE_REF'),i1=idx.indexOf('//  5b. PAL',i0);const M={exports:{}};
 new Function('module','exports','window',STUB+idx.slice(i0,idx.lastIndexOf('// ====',i1))+'\nmodule.exports={_cwFaceMeasure,_cwFaceMeasureRaw,_cwHairline,_cwRank,classifyFaceFromLandmarks,CW_FACE_REF,CW_FACE_PERSP};')(M,M.exports,{});return M.exports;}
const med=a=>{a=a.filter(x=>x!=null&&isFinite(x));if(!a.length)return null;const s=[...a].sort((x,y)=>x-y);return s.length%2?s[(s.length-1)>>1]:(s[s.length/2-1]+s[s.length/2])/2;};
const V1={"whRatio":0.9315,"foreheadRatio":1.0253,"eyeSize":1.0543,"noseWRatio":1.0795,"mouthRatio":1.0725,"myungGung":1.0827,"jilAek":1.0839,"browLength":1.057,"chin":0.9787,"midOverLow":1.0205};
const CAND=[...Object.keys(V1),'jawRatio','cheonJiWidth'];
function loadPeople(C,IP){
 const src=dir=>{const L=JSON.parse(fs.readFileSync(path.join(IP,dir,'cache','landmarks.json'),'utf8'));return [L,k=>{const d=L[k],ai=d.lm.map(a=>({x:a[0],y:a[1],z:a[2]}));const hr=C._cwHairline(zlib.gunzipSync(fs.readFileSync(path.join(IP,dir,'cache',k+'.mask.gz'))),d.w,d.h,ai);return {k,ai,A:d.h/d.w,hr,raw:C._cwFaceMeasureRaw(ai,d.h/d.w,hr)};}];};
 const [LB,fL]=src('eval_labelset'),[SB,fS]=src('eval_selfie');const P=[];
 for(const p of [...new Set(Object.values(LB).map(v=>v.pid))].sort())P.push({id:p,grp:p,near:Object.keys(LB).filter(k=>LB[k].pid===p&&LB[k].kind==='near').sort().map(fL),far:Object.keys(LB).filter(k=>LB[k].pid===p&&LB[k].kind==='far').sort().map(fL)});
 P.push({id:'P2',grp:'P2',near:Object.keys(SB).filter(k=>k.startsWith('p2_2026_nog_near')).sort().map(fS),far:Object.keys(SB).filter(k=>k.startsWith('p2_2026_nog_far')).sort().map(fS)});
 P.push({id:'J0',grp:'01',near:Object.keys(SB).filter(k=>k.startsWith('jay_2026_nog_guide')).sort().map(fS),far:Object.keys(SB).filter(k=>k.startsWith('jay_2026_nog_far')).sort().map(fS)});
 return P;}
const ratio=(p,a)=>{const n=med(p.near.map(x=>x.raw[a])),f=med(p.far.map(x=>x.raw[a]));return n&&f?n/f:null;};
// 사람 한 명·축 하나의 랭크 오차: 근접 사진마다 |rank(보정값) − rank(원거리 중앙)| 의 중앙
function rankErr(C,p,a,c){const q=C.CW_FACE_REF.q[a];const rf=C._cwRank(med(p.far.map(x=>x.raw[a])),q);return med(p.near.map(x=>x.raw[a]==null?null:Math.abs(C._cwRank(x.raw[a]/c,q)-rf)));}
function select(C,persons){const f={},choice={},detail={};
 for(const a of CAND){const base=V1[a]||1;const grps=[...new Set(persons.map(p=>p.grp))];const e0=[],e1=[];
  for(const g of grps){const tr=persons.filter(p=>p.grp!==g),te=persons.filter(p=>p.grp===g);const c=med(tr.map(p=>ratio(p,a)));for(const p of te){e0.push(rankErr(C,p,a,base));e1.push(rankErr(C,p,a,c));}}
  const m0=med(e0),m1=med(e1),emp=med(persons.map(p=>ratio(p,a)));
  const win=e1.filter((v,i)=>v!=null&&e0[i]!=null&&v<e0[i]).length/e1.length;detail[a]={base,emp,errBase:m0,errEmp:m1,win};
  // ★수정 1(2026-10-09, p28 1차 V2·V3 실패 후): 경험 계수는 「중앙 오차가 작고 + 학습 사람의 70% 이상에서 개선」일 때만 채택(일관된 증거만)
  if(m1<m0&&win>=0.7){f[a]=+emp.toFixed(4);choice[a]='emp';}else if(V1[a]){f[a]=V1[a];choice[a]='v1';}else choice[a]='none';}
 return {f,choice,detail};}
// 얼굴형: 근접은 live(보정표 f) · 원거리는 보정 없음
function shapes(C,p,f){const P=C.CW_FACE_PERSP,save=P.f;P.f=f;try{return {near:p.near.map(x=>C.classifyFaceFromLandmarks(x.ai,x.A,x.hr,'live').shapeOpt.v),far:p.far.map(x=>C.classifyFaceFromLandmarks(x.ai,x.A,x.hr,null).shapeOpt.v)};}finally{P.f=save;}}
const mode=a=>{const m={};a.forEach(x=>m[x]=(m[x]||0)+1);const s=Object.entries(m).sort((x,y)=>y[1]-x[1]);return s.length>1&&s[0][1]===s[1][1]?'tie':s[0][0];};
module.exports={loadCore,loadPeople,select,rankErr,shapes,ratio,med,mode,V1,CAND};
