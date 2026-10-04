// ============================================================
//  P-22 · 다중 프레임 랜드마크 합성 평가 — v797 P-797-A
//  node _v797_work/p22_multiframe_eval.js
// ------------------------------------------------------------
//  결함(진단 d01 · 실기 10-04): 같은 사람·같은 조건 4초 안의 셀카 5장에서 눈 크기 랭크 0.23~0.77, 명궁 0.65~0.88 처럼
//   한 장 계측이 크게 흔들린다. 앱은 정렬 후 한 프레임만 계측한다.
//  수리: 자동 촬영 때 저장 프레임 + 추가 프레임 N 장의 랜드마크를 저장 프레임에 닮음변환(이동·회전·배율)으로 맞춘 뒤
//   점·좌표별 중앙값으로 합성(_cwFaceLmAggregate). 중앙값이라 눈 깜빡임 등 소수 이상 프레임에 강하다.
//  ★A3 평가 코드 오타 정정(수리 후 첫 실행에서 발견): 합성 결과를 ranks(…, R0) 로 불러 종횡비 자리에 랭크 객체가 들어갔다
//    → ranks(…, A). 기준(60%)은 그대로. 진단 기록: 실측 프레임 간 점별 σ ≈ 0.0023~0.0073(얼굴폭 0.41~0.49).
//  기준(수리 전에 정함): A1 기본 동작 · A2 닮음변환 불변(1e-6) · A3 합성 잡음(σ=0.004, 7장) 랭크 오차 ≤ 단일의 60% ·
//   A4 깜빡임 1/5장 → 눈 가로세로비 오차 ≤2% · R1 실사진(평가셋 4묶음×5장) 서로 겹치지 않는 2장 합성끼리의 랭크 차이 ≤ 단일끼리의 85% ·
//   W1 앱 배선(카메라 끄기 전 추가 프레임 수집 → 합성 → 저장)
// ============================================================
'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib');
const ROOT=path.join(__dirname,'..'),EV=path.join(ROOT,'..','ChunWoon_IP','face','eval_selfie');
const STUB="const FACE_S=[{l:'a',v:'round'},{l:'b',v:'square'},{l:'c',v:'long'},{l:'d',v:'inv'}];const FACE_E=[{l:'a',v:'big'},{l:'b',v:'narrow'},{l:'c',v:'round'},{l:'d',v:'droopy'}];const FACE_N=[{l:'a',v:'high'},{l:'b',v:'wide'},{l:'c',v:'small'},{l:'d',v:'hooked'}];const FACE_M=[{l:'a',v:'big'},{l:'b',v:'small'},{l:'c',v:'thick'},{l:'d',v:'thin'}];";
const idx=fs.readFileSync(process.env.P17_INDEX||path.join(ROOT,'index.html'),'utf8');
const i0=idx.indexOf('var CW_FACE_REF'),i1=idx.indexOf('//  5b. PAL',i0);
const M={exports:{}};
new Function('module','exports','window',STUB+idx.slice(i0,idx.lastIndexOf('// ====',i1))+
  "\nmodule.exports={_cwFaceMeasure,_cwRank,CW_FACE_REF,CW_FACE_AXES,CW_FACE_AXIS_KIND,agg:(typeof _cwFaceLmAggregate!=='undefined'?_cwFaceLmAggregate:null)};")(M,M.exports,{});
const C=M.exports;let total=0,pass=0;const fails=[];
function check(id,name,ok,detail){total++;if(ok)pass++;else fails.push(id);console.log(`  ${ok?'ok  ':'FAIL'} ${id} ${name} — ${detail}`);}
const REL=C.CW_FACE_AXES.filter(k=>C.CW_FACE_AXIS_KIND[k]==='REL');
const L=JSON.parse(fs.readFileSync(path.join(EV,'cache','landmarks.json'),'utf8'));
const lmOf=k=>L[k].lm.map(a=>({x:a[0],y:a[1],z:a[2]}));
const ranks=(lm,A)=>{const m=C._cwFaceMeasure(lm,A,null,'file');const r={};for(const a of REL)if(m[a]!=null&&isFinite(m[a]))r[a]=C._cwRank(m[a],C.CW_FACE_REF.q[a]);return r;};
const rdiff=(r1,r2)=>{const ks=Object.keys(r1).filter(a=>r2[a]!=null);return ks.reduce((s,a)=>s+Math.abs(r1[a]-r2[a]),0)/ks.length;};
let rnd=12345;const rand=()=>{rnd=(rnd*1103515245+12345)%2147483648;return rnd/2147483648;};
const gauss=()=>Math.sqrt(-2*Math.log(rand()+1e-12))*Math.cos(2*Math.PI*rand());
const AG=C.agg;
console.log('[A] 합성 함수');
const k0='jay_2026_nog_guide_1',T=lmOf(k0),A=L[k0].h/L[k0].w;
{const one=AG?AG([T],A):null,none=AG?AG([],A):'x';
 check('A1','1장=그대로 · 0장=null',!!AG&&one&&one.length===T.length&&one.every((p,i)=>p.x===T[i].x&&p.y===T[i].y)&&none===null,AG?'ok':'함수 없음');}
{let ok=false,err=NaN;if(AG){const tf=(s,th,tx,ty)=>T.map(p=>{const X=p.x,Y=p.y*A;const c=Math.cos(th),si=Math.sin(th);return {x:s*(c*X-si*Y)+tx,y:(s*(si*X+c*Y)+ty)/A,z:p.z*s};});
  const out=AG([T,tf(1.05,0.05,0.02,-0.01),tf(0.97,-0.03,-0.015,0.02)],A);err=Math.max(...out.map((p,i)=>Math.max(Math.abs(p.x-T[i].x),Math.abs(p.y-T[i].y))));ok=err<1e-6;}
 check('A2','닮음변환된 같은 얼굴 → 기준 프레임 복원',ok,'최대오차 '+err);}
{let ok=false,d='-';if(AG){let e1=0,e7=0;const R0=ranks(T,A);for(let t=0;t<20;t++){const fr=[];for(let j=0;j<7;j++)fr.push(T.map(p=>({x:p.x+0.004*gauss(),y:p.y+0.004*gauss(),z:p.z})));
   e1+=rdiff(ranks(fr[0],A),R0);e7+=rdiff(ranks(AG(fr,A),A),R0);}ok=e7<=0.6*e1;d=`단일 ${(e1/20).toFixed(3)} → 7장 ${(e7/20).toFixed(3)}`;}
 check('A3','잡음 7장 합성 랭크 오차 ≤ 단일의 60%',ok,d);}
{let ok=false,d='-';if(AG){const blink=T.map((p,i)=>({...p}));for(const [u,l] of [[159,145],[386,374],[158,153],[160,144],[385,380],[387,373]]){const my=(T[u].y+T[l].y)/2;blink[u].y=my-0.0005;blink[l].y=my+0.0005;}
   const out=AG([T,T,blink,T,T].map((f,j)=>j===2?f:f.map(p=>({x:p.x+0.0005*gauss(),y:p.y+0.0005*gauss(),z:p.z}))),A);
   const e0=C._cwFaceMeasure(T,A,null,'file').eyeAspect,e1=C._cwFaceMeasure(out,A,null,'file').eyeAspect;ok=Math.abs(e1/e0-1)<=0.02;d=`눈 가로세로비 ${e0.toFixed(3)} → ${e1.toFixed(3)}`;}
 check('A4','깜빡임 1/5장 → 눈 가로세로비 오차 ≤2%',ok,d);}
console.log('[R] 실사진 같은 조건 5장 묶음 — 겹치지 않는 부분집합끼리 랭크 차이');
{const G=['jay_2026_nog_guide','jay_2026_g_guide','p2_2026_nog_near','p2_2026_nog_far'];let s1=0,n1=0,s2=0,n2=0;const line=[];
 for(const g of G){const ks=Object.keys(L).filter(k=>k.startsWith(g)).sort();const Ag=L[ks[0]].h/L[ks[0]].w;const F=ks.map(lmOf);
   let a1=0,c1=0,a2=0,c2=0;
   for(let i=0;i<F.length;i++)for(let j=i+1;j<F.length;j++){a1+=rdiff(ranks(F[i],Ag),ranks(F[j],Ag));c1++;}
   if(AG){const idxs=[...Array(F.length).keys()];for(let a=0;a<5;a++)for(let b=a+1;b<5;b++)for(let c=0;c<5;c++)for(let d=c+1;d<5;d++){if(new Set([a,b,c,d]).size<4||a>c)continue;
     a2+=rdiff(ranks(AG([F[a],F[b]],Ag),Ag),ranks(AG([F[c],F[d]],Ag),Ag));c2++;}}
   s1+=a1/c1;n1++;if(c2){s2+=a2/c2;n2++;}line.push(`${g} 단일 ${(a1/c1).toFixed(3)}${c2?' · 2장 '+(a2/c2).toFixed(3):''}`);}
 const r=n2?(s2/n2)/(s1/n1):NaN;console.log('   '+line.join('\n   '));
 check('R1','2장 합성끼리 차이 ≤ 단일끼리의 85%',n2>0&&r<=0.85,`비 ${isFinite(r)?r.toFixed(3):'-'}`);}
console.log('[W] 앱 배선');
{const i=idx.indexOf('async function autoSnapFace'),body=idx.slice(i,idx.indexOf('\n}\n',i));
 const iCol=body.indexOf('_cwCollectFaceFrames('),iAgg=body.indexOf('_cwFaceLmAggregate('),iStop=body.indexOf('stopCamera()'),iStore=body.indexOf('_cwStoreAIFrame(');
 const nm=(idx.match(/const CW_FACE_MULTI_FRAMES\s*=\s*(\d+)/)||[])[1];
 check('W1','자동 촬영: 카메라 끄기 전 추가 프레임 수집 → 합성 → 저장 · 추가 프레임 ≥4',i>0&&iCol>0&&iAgg>iCol&&iStop>iAgg&&iStore>iAgg&&+nm>=4,`collect ${iCol} agg ${iAgg} stop ${iStop} store ${iStore} · N=${nm}`);}
console.log(`[p22_multiframe] total=${total} pass=${pass} fail=${total-pass}${fails.length?' · FAIL '+fails.join(','):''}`);
process.exitCode=fails.length?1:0;
