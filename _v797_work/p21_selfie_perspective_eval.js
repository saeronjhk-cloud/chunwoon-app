// ============================================================
//  P-21 · 근접 셀카 원근 보정 평가 — v797 P-795-A
//  node _v797_work/p21_selfie_perspective_eval.js
// ------------------------------------------------------------
//  결함(진단 d01·d03): 앱 실시간 촬영은 전면 카메라 근접 셀카라 얼굴 중앙(코·입·명궁·산근·눈)이 커지고 얼굴이
//   세로로 길게 계측된다. 같은 사람 원거리(후면 3배 줌) 사진과 비교해 콧방울 폭 +6.5/+9.3% · 명궁 +9.5/+5.7% ·
//   얼굴 가로세로비 −7.6/−5.1% (제이/두번째 분) → 백분위가 30~60%p 이동(제이 산근 0.91↔0.29).
//   참조표 앵커(인터넷 인물 사진)는 원거리 조건과 같은 쪽(제이 원거리 랭크 ≈ 증명·스튜디오 사진 랭크).
//  수리: 실시간 촬영(src='live')일 때만 원근 보정표(CW_FACE_PERSP, 기하 모형 유효거리 48cm)로 축값을 원거리 환산.
//  기준: 두 사람 각각 보정한 근접 랭크 vs 원거리 랭크 |Δ| 중앙 ≤ 0.15 이고 무보정의 50% 이하 · 축별 악화 ≤ 0.10 ·
//   사람 단위 교차검증(한 사람으로 거리 적합 → 다른 사람) ≤ 0.15 · 파일 경로 무변경 · 앱 배선.
//  평가셋: D:\ChunWoon_IP\face\eval_selfie (git 밖 · 제이 제공 · 내부 평가 전용)
// ============================================================
'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib');
const ROOT=path.join(__dirname,'..'),EV=path.join(ROOT,'..','ChunWoon_IP','face','eval_selfie');
const STUB="const FACE_S=[{l:'a',v:'round'},{l:'b',v:'square'},{l:'c',v:'long'},{l:'d',v:'inv'}];const FACE_E=[{l:'a',v:'big'},{l:'b',v:'narrow'},{l:'c',v:'round'},{l:'d',v:'droopy'}];const FACE_N=[{l:'a',v:'high'},{l:'b',v:'wide'},{l:'c',v:'small'},{l:'d',v:'hooked'}];const FACE_M=[{l:'a',v:'big'},{l:'b',v:'small'},{l:'c',v:'thick'},{l:'d',v:'thin'}];";
const idx=fs.readFileSync(process.env.P17_INDEX||path.join(ROOT,'index.html'),'utf8');
const i0=idx.indexOf('var CW_FACE_REF'),i1=idx.indexOf('//  5b. PAL',i0);
const W={};const M={exports:{}};
new Function('module','exports','window',STUB+idx.slice(i0,idx.lastIndexOf('// ====',i1))+
  "\nmodule.exports={_cwFaceMeasure,_cwRank,_cwHairline,CW_FACE_REF,CW_FACE_AXES,CW_FACE_AXIS_KIND,classifyFaceFromLandmarks,CW_FACE_PERSP:(typeof CW_FACE_PERSP!=='undefined'?CW_FACE_PERSP:null)};")(M,M.exports,W);
const C=M.exports;
let total=0,pass=0;const fails=[];
function check(id,name,ok,detail){total++;if(ok)pass++;else fails.push(id);console.log(`  ${ok?'ok  ':'FAIL'} ${id} ${name} — ${detail}`);}
// ★v799 표기 정정: 보정표가 PERSP-v2(_v799_work/fixtures/persp_v2.json · 평가 p28)로 바뀌면 그 생성기 산출과 비교한다(E·X 성능 기준은 그대로)
const FIX=(()=>{const v2=path.join(__dirname,'..','_v799_work','fixtures','persp_v2.json');const f2=fs.existsSync(v2)?JSON.parse(fs.readFileSync(v2,'utf8')):null;
  const live=C.CW_FACE_PERSP&&C.CW_FACE_PERSP.version;return f2&&live===f2.version?f2:JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','persp_v1.json'),'utf8'));})();
const P=C.CW_FACE_PERSP, REL=C.CW_FACE_AXES.filter(k=>C.CW_FACE_AXIS_KIND[k]==='REL');
console.log('[T] 보정표·함수');
check('T1','CW_FACE_PERSP 존재 · 생성기 산출과 일치',!!P&&P.version===FIX.version&&Object.keys(FIX.f).every(a=>P.f&&Math.abs(P.f[a]-FIX.f[a])<1e-9)&&Object.keys(P.f||{}).length===Object.keys(FIX.f).length,P?P.version+' · '+Object.keys(P.f||{}).length+'축':'없음');
// ★v799 표기 정정: v2 는 9명 실측 근거로 jawRatio(REL)·cheonJiWidth(ABS) 를 추가 — 그 둘만 예외로 허용 · 각도 축은 계속 제외
check('T2','보정 축은 REL 만(v2 예외: jawRatio·cheonJiWidth) · eyeTilt·browAngle 제외',!!P&&Object.keys(P.f).every(a=>REL.includes(a)||(/PERSP-v2/.test(P.version)&&a==='cheonJiWidth'))&&(/PERSP-v2/.test(P.version)||!('jawRatio' in P.f))&&!('eyeTilt' in P.f)&&!('browAngle' in P.f),P?Object.keys(P.f).join(','):'-');
const L=JSON.parse(fs.readFileSync(path.join(EV,'cache','landmarks.json'),'utf8'));
const inp=k=>{const d=L[k],ai=d.lm.map(a=>({x:a[0],y:a[1],z:a[2]}));return {ai,A:d.h/d.w,hr:C._cwHairline(zlib.gunzipSync(fs.readFileSync(path.join(EV,'cache',k+'.mask.gz'))),d.w,d.h,ai)};};
{const x=inp('jay_2026_nog_guide_1');const mf=C._cwFaceMeasure(x.ai,x.A,x.hr,'file'),mu=C._cwFaceMeasure(x.ai,x.A,x.hr),ml=C._cwFaceMeasure(x.ai,x.A,x.hr,'live');
 const keys=P?Object.keys(P.f):[];
 const okL=P&&keys.every(a=>mf[a]==null||Math.abs(ml[a]-mf[a]/P.f[a])<1e-9)&&REL.filter(a=>!keys.includes(a)).every(a=>ml[a]===mf[a]);
 const okU=REL.every(a=>mu[a]===mf[a]);
 check('T3',"_cwFaceMeasure(…,'live') 만 보정 · 미지정=파일",okL&&okU&&ml.perspCorrected===true&&!mf.perspCorrected,`live 보정 ${okL} · 미지정 무보정 ${okU} · flag ${ml.perspCorrected}`);
 W._cwFaceSrc='live';const cl=C.classifyFaceFromLandmarks(x.ai,x.A,x.hr);W._cwFaceSrc='file';const cf=C.classifyFaceFromLandmarks(x.ai,x.A,x.hr);W._cwFaceSrc=undefined;
 check('T4','classifyFaceFromLandmarks 가 window._cwFaceSrc 를 따른다',JSON.stringify(cl.ratios)!==JSON.stringify(cf.ratios),'live≠file');}
console.log('[E] 두 사람 근접(보정) vs 원거리 랭크');
const med=a=>{a=a.filter(x=>x!=null&&isFinite(x));if(!a.length)return null;const s=[...a].sort((x,y)=>x-y);return s.length%2?s[(s.length-1)>>1]:(s[s.length/2-1]+s[s.length/2])/2;};
const rank=(a,v)=>C._cwRank(v,C.CW_FACE_REF.q[a]);
const PEOPLE={J:['jay_2026_nog_guide','jay_2026_nog_far'],Q:['p2_2026_nog_near','p2_2026_nog_far']};
const AX=P?Object.keys(P.f):[];
function score(pre,fac){const [n,f]=pre;const N=Object.keys(L).filter(k=>k.startsWith(n)).map(inp),F=Object.keys(L).filter(k=>k.startsWith(f)).map(inp);
  const mF=F.map(x=>C._cwFaceMeasure(x.ai,x.A,x.hr,'file')),mN=N.map(x=>C._cwFaceMeasure(x.ai,x.A,x.hr,'file'));const o={};
  for(const a of AX){const rf=rank(a,med(mF.map(m=>m[a])));o[a]=med(mN.map(m=>m[a]==null?null:Math.abs(rank(a,m[a]/(fac?fac[a]||1:1))-rf)));}return o;}
for(const [who,pre] of Object.entries(PEOPLE)){
  const s0=score(pre,null),s1=score(pre,P?P.f:null);const m0=med(Object.values(s0)),m1=med(Object.values(s1));
  check('E1'+who,`${who} |Δrank| 중앙 ≤0.15 · 무보정의 50% 이하`,m1!=null&&m1<=0.15&&m1<=0.5*m0,`무보정 ${m0==null?'-':m0.toFixed(3)} → 보정 ${m1==null?'-':m1.toFixed(3)}`);
  const worse=AX.filter(a=>s1[a]-s0[a]>0.10);
  check('E2'+who,`${who} 축별 악화 ≤0.10`,AX.length>0&&worse.length===0,worse.length?'악화 '+worse.join(','):AX.map(a=>a+':'+s0[a].toFixed(2)+'→'+s1[a].toFixed(2)).join(' '));}
// 사람 단위 교차검증 — 한 사람의 근/원 비로 유효 거리를 맞춰 다른 사람에 적용
{const V=fs.readFileSync(path.join(ROOT,'_v789_work','fixtures','canonical_face_model.obj'),'utf8').split('\n').filter(l=>l.startsWith('v ')).map(l=>l.split(/\s+/).slice(1,4).map(Number));const zmax=Math.max(...V.map(v=>v[2]));
 const proj=d=>{const Pp=V.map(([x,y,z])=>{const s=d/(d+zmax-z);return [x*s,-y*s,z];});const xs=Pp.map(p=>p[0]),ys=Pp.map(p=>p[1]);const x0=Math.min(...xs)-5,x1=Math.max(...xs)+5,y0=Math.min(...ys)-8,y1=Math.max(...ys)+5;const Wd=x1-x0,H=y1-y0;return C._cwFaceMeasure(Pp.map(([x,y,z])=>({x:(x-x0)/Wd,y:(y-y0)/H,z:z/Wd})),H/Wd,null,'file');};
 const far=proj(120),DS=[];for(let d=20;d<=200;d+=2)DS.push(d);const MOD={};for(const d of DS){const m=proj(d);MOD[d]={};for(const a of AX)MOD[d][a]=m[a]/far[a];}
 const obs=pre=>{const N=Object.keys(L).filter(k=>k.startsWith(pre[0])).map(inp).map(x=>C._cwFaceMeasure(x.ai,x.A,x.hr,'file')),F=Object.keys(L).filter(k=>k.startsWith(pre[1])).map(inp).map(x=>C._cwFaceMeasure(x.ai,x.A,x.hr,'file'));const o={};for(const a of AX)o[a]=med(N.map(m=>m[a]))/med(F.map(m=>m[a]));return o;};
 const fit=o=>{let b=null;for(const d of DS){let e=0;for(const a of AX)e+=Math.pow(Math.log(o[a])-Math.log(MOD[d][a]),2);if(!b||e<b.e)b={d,e};}return b.d;};
 for(const [tr,te] of [['J','Q'],['Q','J']]){const d=AX.length?fit(obs(PEOPLE[tr])):null;const s=AX.length?med(Object.values(score(PEOPLE[te],MOD[d]))):null;
   check('X'+tr+te,`교차검증 ${tr}로 적합(d=${d}) → ${te} ≤0.15`,s!=null&&s<=0.15,s==null?'-':s.toFixed(3));}}
console.log('[W] 앱 배선');
{const f=(re)=>(idx.match(re)||[]).length;
 const cap=f(/window\._cwFaceSrc\s*=\s*'live'/g),pick=/function onPhotoPicked[\s\S]{0,900}window\._cwFaceSrc\s*=\s*'file'/.test(idx),rst=/function _cwResetAIFrame\(\)\{[\s\S]{0,500}window\._cwFaceSrc\s*=\s*null/.test(idx);
 check('W1',"실시간 촬영 2경로 'live' · 사진 선택 'file' · 초기화 null",cap>=2&&pick&&rst,`live ${cap} · file ${pick} · reset ${rst}`);}
console.log(`[p21_selfie_perspective] total=${total} pass=${pass} fail=${total-pass}${fails.length?' · FAIL '+fails.join(','):''}`);
process.exitCode=fails.length?1:0;
