// ============================================================
//  P-28 · 근접 셀카 원근 보정 v2 평가 — v799 P-799-A
//  node _v799_work/p28_persp_v2_eval.js
// ------------------------------------------------------------
//  결함(d11·d12 · 라벨셋 9명): v1 보정표는 기하 모형(2명 적합)이라 실측과 어긋난다 — whRatio 과보정(모형 0.931 vs 실측 0.960),
//   턱 폭 jawRatio(실측 −1.8%)·이마/턱 폭 cheonJiWidth(+3.3~4.5%)는 아예 보정 없음 → 근접 셀카에서 얼굴형이 원거리와 달라짐
//   (07·08 원거리 둥근 → 근접 역삼각 · 01 원거리 각진 → 근접 둥근).
//  수리: 축별로 v1 계수 vs 경험 계수(근/원 비 중앙)를 사람 단위 LOPO 로 골라 PERSP-v2(생성기 d15 → fixtures/persp_v2.json).
//  기준(수리 전에 정함) — ★중첩 LOPO: 시험 사람을 뺀 나머지로 선택·계수를 정해 그 사람에 적용(낙관 편향 없음):
//   V1 앱 보정표 = 생성기 산출(persp_v2.json)
//   V2 후보 12축 랭크 오차(사람별 축 중앙의 사람 중앙): v2 < v1 · v2 ≤ 0.12
//   V3 축별 악화 없음: 어느 축도 v2 사람중앙 오차가 v1 보다 0.05 넘게 크지 않음
//   V4 얼굴형 근접 다수결 = 원거리 다수결 사람 수: v2 ≥ v1 + 2
//   V5 근접 「역삼각」 오판(원거리는 역삼각 아님) 사진 수: v2 < v1
//   V6 파일 경로(src≠'live') 무보정 유지
//  자료: D:\ChunWoon_IP\face\eval_labelset · eval_selfie (git 밖 · 동의 받음 · 내부 평가 전용)
// ============================================================
'use strict';
const fs=require('fs'),path=require('path');const L=require('./persp_v2_lib.js');
const ROOT=path.join(__dirname,'..'),IP=path.join(ROOT,'..','ChunWoon_IP','face');
const C=L.loadCore(process.env.P17_INDEX||path.join(ROOT,'index.html'));const P=L.loadPeople(C,IP);
const FIX=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','persp_v2.json'),'utf8'));
let total=0,pass=0;const fails=[];
function check(id,name,ok,detail){total++;if(ok)pass++;else fails.push(id);console.log(`  ${ok?'ok  ':'FAIL'} ${id} ${name} — ${detail}`);}
const AP=C.CW_FACE_PERSP;
check('V1','앱 CW_FACE_PERSP = 생성기 산출(PERSP-v2)',!!AP&&AP.version===FIX.version&&Object.keys(FIX.f).length===Object.keys(AP.f).length&&Object.keys(FIX.f).every(a=>Math.abs(AP.f[a]-FIX.f[a])<1e-9),AP?AP.version+' · '+Object.keys(AP.f).length+'축':'없음');
// 중첩 LOPO
const grps=[...new Set(P.map(p=>p.grp))];const errV1={},errV2={},errNo={};for(const a of L.CAND){errV1[a]=[];errV2[a]=[];errNo[a]=[];}
const per={v1:{},v2:{},no:{}};let agreeV1=0,agreeV2=0,invV1=0,invV2=0;const rows=[];
for(const g of grps){const tr=P.filter(p=>p.grp!==g),te=P.filter(p=>p.grp===g);const sel=L.select(C,tr);
 for(const p of te){const e1=[],e2=[],e0=[];
  for(const a of L.CAND){const a1=L.rankErr(C,p,a,L.V1[a]||1),a2=L.rankErr(C,p,a,sel.f[a]||1),a0=L.rankErr(C,p,a,1);errV1[a].push(a1);errV2[a].push(a2);errNo[a].push(a0);e1.push(a1);e2.push(a2);e0.push(a0);}
  per.v1[p.id]=L.med(e1);per.v2[p.id]=L.med(e2);per.no[p.id]=L.med(e0);
  const s1=L.shapes(C,p,L.V1),s2=L.shapes(C,p,sel.f);const fm=L.mode(s1.far);
  const ag1=L.mode(s1.near)===fm,ag2=L.mode(s2.near)===fm;agreeV1+=ag1;agreeV2+=ag2;
  const i1=s1.near.filter((v,i)=>v==='inv'&&fm!=='inv').length,i2=s2.near.filter(v=>v==='inv'&&fm!=='inv').length;invV1+=i1;invV2+=i2;
  rows.push(`${p.id.padEnd(3)} 원거리 ${s1.far.join(',')} | 근접 v1 ${s1.near.join(',')} → v2 ${s2.near.join(',')}`);}}
const mV1=L.med(Object.values(per.v1)),mV2=L.med(Object.values(per.v2)),mNo=L.med(Object.values(per.no));
check('V2','후보 12축 랭크 오차 v2 < v1 · ≤0.12',mV2<mV1&&mV2<=0.12,`무보정 ${mNo.toFixed(3)} · v1 ${mV1.toFixed(3)} → v2 ${mV2.toFixed(3)} (사람 ${Object.keys(per.v2).length})`);
const worse=L.CAND.filter(a=>L.med(errV2[a])-L.med(errV1[a])>0.05);
check('V3','축별 악화 ≤0.05',worse.length===0,(worse.length?'악화 '+worse.join(',')+' · ':'')+L.CAND.map(a=>`${a}:${L.med(errV1[a]).toFixed(2)}→${L.med(errV2[a]).toFixed(2)}`).join(' '));
check('V4','얼굴형 근접 다수결 = 원거리 다수결: v2 ≥ v1+2',agreeV2>=agreeV1+2,`v1 ${agreeV1}/${P.length} → v2 ${agreeV2}/${P.length}`);
check('V5','근접 역삼각 오판 사진: v2 < v1',invV2<invV1,`v1 ${invV1} → v2 ${invV2}`);
{const x=P[0].near[0];const mf=C._cwFaceMeasure(x.ai,x.A,x.hr,'file'),mu=C._cwFaceMeasure(x.ai,x.A,x.hr);const ok=Object.keys(x.raw).every(k=>(mf[k]===x.raw[k]||(Number.isNaN(mf[k])&&Number.isNaN(x.raw[k])))&&(mu[k]===x.raw[k]||(Number.isNaN(mu[k])&&Number.isNaN(x.raw[k]))));
 check('V6',"파일 경로(src≠'live') 무보정",ok&&!mf.perspCorrected,String(ok));}
if(process.argv[2]==='dump')rows.forEach(r=>console.log('   ',r));
console.log(`[p28_persp_v2] total=${total} pass=${pass} fail=${total-pass}${fails.length?' · FAIL '+fails.join(','):''}`);
process.exitCode=fails.length?1:0;
