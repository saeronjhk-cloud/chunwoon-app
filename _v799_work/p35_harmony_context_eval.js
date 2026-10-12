// ============================================================
//  P-35 · 종합 점수(조화도) 맥락 표기 평가 — v801 P-801-A Q1 = A (외부 자문 R1 Gemini·ChatGPT 일치)
//  node _v799_work/p35_harmony_context_eval.js
// ------------------------------------------------------------
//  결함(진단 d26): 실사진 123장 전부 88~95점(SD 1.8). 코어 주석은 「대부분 여기 듭니다」 병기를 요구하나
//   결과 카드에는 「92점」만 크게 나와 순위·우수함처럼 읽힌다. AI 풀이에도 같은 맥락이 없다.
//  수리: 계산은 그대로(ABS) · 화면에 「순위가 아니라 균형 상태 · 대부분 lo~hi점 · 사진마다 몇 점씩 달라짐」 병기 ·
//   fortune.js 규칙에 같은 맥락 + 과장·비교 금지.
//  기준(수리 전에 정함):
//   H1 index.html 결과 카드에 맥락 문구(CW_FACE_HARMONY_NOTE)가 점수 바로 아래에 있다
//   H2 문구는 랜드마크 계측(aiScores)이 있을 때만 — 해시 대체 점수에는 붙이지 않는다
//   H3 범위 상수가 index.html·fortune.js 두 곳에서 같다
//   H4 실사진(라벨셋+셀카+인터넷, 고개 보류 제외) ≥95%가 그 범위 안에 든다
//   H5 fortune.js CW_FACE_AXIS_RULE에 범위·「순위가 아니」·과장 금지·비교 금지가 들어 있다
//   H6 점수 계산 불변 — 코어 원본·built 무변경(HEAD 대비)
// ============================================================
'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib'),cp=require('child_process');const Lb=require('./persp_v2_lib.js');
const ROOT=path.join(__dirname,'..'),IP=path.join(ROOT,'..','ChunWoon_IP','face');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8'),api=fs.readFileSync(path.join(ROOT,'api','fortune.js'),'utf8');
const res=[];const T=(id,ok,msg)=>{res.push({id,ok});console.log(`${ok?'PASS':'FAIL'} ${id} — ${msg}`);};
const rng=s=>{const m=s.match(/CW_FACE_HARMONY_RANGE\s*=\s*\{\s*lo\s*:\s*(\d+)\s*,\s*hi\s*:\s*(\d+)/);return m?{lo:+m[1],hi:+m[2]}:null;};
// H1
const fn=(html.match(/function setupFaceResultContainer\([\s\S]*?\n\}/)||[''])[0];
const iScore=fn.indexOf('${ov}<span'),iNote=fn.indexOf('CW_FACE_HARMONY_NOTE');
T('H1',iScore>0&&iNote>iScore&&iNote-iScore<600&&/const CW_FACE_HARMONY_NOTE\s*=/.test(html),`점수 뒤 맥락 문구 위치 Δ${iNote-iScore}`);
// H2
T('H2',/aiScores\s*\?\s*CW_FACE_HARMONY_NOTE/.test(fn)||/aiScores\s*&&\s*CW_FACE_HARMONY_NOTE/.test(fn),'aiScores 있을 때만 표시');
// H3
const rH=rng(html),rA=rng(api);T('H3',!!rH&&!!rA&&rH.lo===rA.lo&&rH.hi===rA.hi,`index ${JSON.stringify(rH)} · fortune ${JSON.stringify(rA)}`);
// H4
{const C=Lb.loadCore(path.join(ROOT,'index.html'));let n=0,inR=0;
 for(const dir of ['eval_labelset','eval_selfie','eval_hairline']){const L=JSON.parse(fs.readFileSync(path.join(IP,dir,'cache','landmarks.json'),'utf8'));
  for(const k of Object.keys(L)){const d=L[k];if(!d||!d.lm)continue;const ai=d.lm.map(a=>({x:a[0],y:a[1],z:a[2]}));const mp=path.join(IP,dir,'cache',k+'.mask.gz');const hr=fs.existsSync(mp)?C._cwHairline(zlib.gunzipSync(fs.readFileSync(mp)),d.w,d.h,ai):null;
   const src=dir==='eval_labelset'?(d.distCm<=60?'live':null):(/^p2_2026_nog_near|^jay_2026_nog_guide/.test(k)?'live':null);
   const c=C.classifyFaceFromLandmarks(ai,d.h/d.w,hr,src);if(c.pose&&c.pose.held)continue;n++;if(rH&&c.overallScore>=rH.lo&&c.overallScore<=rH.hi)inR++;}}
 T('H4',n>0&&inR/n>=0.95,`범위 안 ${inR}/${n} = ${(100*inR/n).toFixed(1)}%`);}
// H5
const rule=(api.match(/const CW_FACE_AXIS_RULE\s*=[\s\S]*?;\n/)||[''])[0];
T('H5',/CW_FACE_HARMONY_RANGE\.lo/.test(rule)&&/CW_FACE_HARMONY_RANGE\.hi/.test(rule)&&/순위가 아니/.test(rule)&&/과장/.test(rule)&&/비교하지/.test(rule)&&/종합 점수/.test(rule),'규칙 문장');
// H6
{const d1=cp.execSync('git diff HEAD --stat -- _v786_diag/face_core_v786.js _v786_diag/face_core_v786.built.js',{cwd:ROOT}).toString().trim();
 const built=fs.readFileSync(path.join(ROOT,'_v786_diag','face_core_v786.built.js'),'utf8');T('H6',d1===''&&html.split(built).length===2,`코어 diff ${d1===''?'없음':d1} · built 1회 포함 ${html.split(built).length===2}`);}
const fail=res.filter(r=>!r.ok).map(r=>r.id);console.log(`total=${res.length} pass=${res.length-fail.length} fail=${fail.length}${fail.length?' · FAIL '+fail.join(','):''}`);
