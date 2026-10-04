// ============================================================
//  P-23 · 안경 감지 평가 — v797 P-797-B
//  node _v797_work/p23_glasses_eval.js
// ------------------------------------------------------------
//  결함(진단 d01 · 10-04): 같은 사람·같은 날 안경 유/무에서 눈 크기 랭크 0.86↔0.49 · 명궁 0.95↔0.78 · 콧방울 0.94↔0.76.
//   안경이 눈 주변 계측을 부풀리는데 앱은 안경 착용을 모른다(안내 문구만 있음).
//  수리: 콧등(두 눈 안쪽 사이 · 168 위~6 아래) 띠에서 가로 경계선(안경 브리지)의 세기를 재는 _cwGlassesScore(gray,w,h,lm).
//   눈 안쪽 간격 기준으로 표본 격자를 정규화해 해상도에 덜 민감. 정밀도 우선(오탐 = 안경 없는 사람에게 경고).
//  기준(수리 전에 정함): G1 함수·임계표 · G2 셀카셋(제이·두번째 분 40장) 오탐 0 · 재현율 ≥75% ·
//   G3 앱 조건(제이 2026 가이드 셀카 안경 5장) 5/5 · G4 인터넷 23장(안경 5) 오탐 0 · 재현율 ≥60%
//   ★G4 는 특징 설계 중 python 으로 한 번 들여다본 셋이라 완전한 홀드아웃이 아니다(기록) ·
//   W1 정렬 루프 검출·대기 · W2 촬영 시 판정 저장·초기화 · W3 결과 화면 안내
//  평가셋: D:\ChunWoon_IP\face\eval_selfie\gray (git 밖)
// ============================================================
'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib');
const ROOT=path.join(__dirname,'..'),EV=path.join(ROOT,'..','ChunWoon_IP','face','eval_selfie');
const STUB="const FACE_S=[{l:'a',v:'round'}];const FACE_E=[{l:'a',v:'big'}];const FACE_N=[{l:'a',v:'high'}];const FACE_M=[{l:'a',v:'big'}];";
const idx=fs.readFileSync(process.env.P17_INDEX||path.join(ROOT,'index.html'),'utf8');
const i0=idx.indexOf('var CW_FACE_REF'),i1=idx.indexOf('//  5b. PAL',i0);
const M={exports:{}};
new Function('module','exports','window',STUB+idx.slice(i0,idx.lastIndexOf('// ====',i1))+
  "\nmodule.exports={gs:(typeof _cwGlassesScore!=='undefined'?_cwGlassesScore:null),T:(typeof CW_GLASSES_T!=='undefined'?CW_GLASSES_T:null)};")(M,M.exports,{});
const C=M.exports;let total=0,pass=0;const fails=[];
function check(id,name,ok,detail){total++;if(ok)pass++;else fails.push(id);console.log(`  ${ok?'ok  ':'FAIL'} ${id} ${name} — ${detail}`);}
check('G1','_cwGlassesScore · CW_GLASSES_T 존재',!!C.gs&&!!C.T&&C.T.peak>0&&C.T.max>0,C.T?JSON.stringify(C.T):'없음');
const GT=JSON.parse(fs.readFileSync(path.join(EV,'gray','glasses_gt.json'),'utf8')).gt;
const LS=JSON.parse(fs.readFileSync(path.join(EV,'cache','landmarks.json'),'utf8')),LH=JSON.parse(fs.readFileSync(path.join(EV,'gray','hl_landmarks.json'),'utf8'));
const R={};
if(C.gs)for(const [k,g] of Object.entries(GT)){const L=k.startsWith('hl_')?LH[k.slice(3)]:LS[k];const gray=zlib.gunzipSync(fs.readFileSync(path.join(EV,'gray',k+'.gray.gz')));
  const r=C.gs(gray,g.w,g.h,L.lm.map(a=>({x:a[0],y:a[1]})));R[k]={gt:g.glasses,set:g.set,pred:!!(r&&r.glasses),peak:r&&r.peak,max:r&&r.max};}
const stat=f=>{const ks=Object.keys(R).filter(f);const fp=ks.filter(k=>!R[k].gt&&R[k].pred),tp=ks.filter(k=>R[k].gt&&R[k].pred),pos=ks.filter(k=>R[k].gt);return {n:ks.length,fp,tp:tp.length,pos:pos.length,miss:pos.filter(k=>!R[k].pred)};};
{const s=stat(k=>R[k].set==='selfie');check('G2','셀카셋 오탐 0 · 재현율 ≥75%',C.gs&&s.fp.length===0&&s.tp>=0.75*s.pos,`n ${s.n} · 오탐 ${s.fp.join(',')||0} · 재현 ${s.tp}/${s.pos} · 놓침 ${s.miss.join(',')}`);}
{const ks=Object.keys(R).filter(k=>k.startsWith('jay_2026_g_guide'));check('G3','앱 조건 제이 2026 가이드 안경 5/5',ks.length===5&&ks.every(k=>R[k].pred),ks.map(k=>`${k.slice(-1)}:${R[k].pred?1:0}`).join(' '));}
{const s=stat(k=>R[k].set==='hairline');check('G4','인터넷 23장 오탐 0 · 재현율 ≥60%',C.gs&&s.n===23&&s.fp.length===0&&s.tp>=0.6*s.pos,`오탐 ${s.fp.join(',')||0} · 재현 ${s.tp}/${s.pos} · 놓침 ${s.miss.join(',')}`);}
if(process.argv[2]==='dump')for(const [k,v] of Object.entries(R))console.log('   ',k.padEnd(26),v.gt?'G':'-',v.pred?'P':'.',(v.peak||0).toFixed(2),(v.max||0).toFixed(1));
console.log('[W] 앱 배선');
{const i=idx.indexOf('async function detectFaceInFrame'),b=idx.slice(i,idx.indexOf('\n}\n',i));
 const loop=idx.slice(idx.indexOf('function startFaceAlignLoop'),idx.indexOf('function stopFaceAlignLoop'));
 // ★W1 표기 정정(수리 후): 검출부가 도우미 _cwGlassesOnCanvas(→_cwGlassesScore) 를 거쳐도 인정 — 도우미가 실제로 점수 함수를 부르는지 함께 확인
 const helperOk=/function _cwGlassesOnCanvas[\s\S]{0,300}_cwGlassesScore\(/.test(idx);
 check('W1','정렬 루프: 프레임마다 _cwGlassesScore → 감지 시 안내·카운트다운 대기(상한 있음)',(/_cwGlassesScore\(/.test(b)||(/_cwGlassesOnCanvas\(/.test(b)&&helperOk))&&/glasses/.test(b)&&/det\.glasses/.test(loop)&&/CW_GLASSES_WAIT_TICKS/.test(loop)&&/안경/.test(loop),'');}
{const ok1=/window\._cwGlasses\s*=/.test(idx.slice(idx.indexOf('async function autoSnapFace'),idx.indexOf('// Convert AI landmarks')))&&/window\._cwGlasses\s*=/.test(idx.slice(idx.indexOf('async function snapPhoto'),idx.indexOf('function pickPhoto')));
 const ok2=/function _cwResetAIFrame\(\)\{[\s\S]{0,800}window\._cwGlasses\s*=\s*null/.test(idx);
 check('W2','촬영(자동·수동) 시 판정 저장 · 초기화',ok1&&ok2,`save ${ok1} reset ${ok2}`);}
check('W3','결과 화면 안내(안경 감지 시 눈 주변 수치 참고)',/AI 실측 데이터:[\s\S]{0,1400}_cwGlasses[\s\S]{0,200}안경/.test(idx),'');
console.log(`[p23_glasses] total=${total} pass=${pass} fail=${total-pass}${fails.length?' · FAIL '+fails.join(','):''}`);
process.exitCode=fails.length?1:0;
