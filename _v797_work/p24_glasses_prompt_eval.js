// ============================================================
//  P-24 · 안경 착용 시 AI 해석 프롬프트 처리 평가 — v797 P-797-B2
//  node _v797_work/p24_glasses_prompt_eval.js
// ------------------------------------------------------------
//  결함: P-797-B 로 앱은 안경을 감지하지만 서버 프롬프트에는 안경 여부가 없어 AI 가 「명궁 상위 8%」처럼 단정한다.
//  진단 d06(제이 안경 유/무, 근접 5:5 · 원거리 3:2): 근접 t≥1.5 이고 원거리 차 ≥0.12 인 축 =
//   eyeSize · noseWRatio · mouthRatio · myungGung · jilAek · jeonTaek (모두 얼굴 폭 분모 — 안경다리가 얼굴 가장자리 점을 안쪽으로 당기는 것으로 추정).
//   ★한 사람 자료다(기록).
//  수리: features.glasses===true 면 ① 위 축 백분위를 싣지 않고 ② [촬영 조건] 줄로 이유를 밝히며 ③ 실측 문자열에서 콧방울·입 비율을 빼고
//   ④ 규칙에 「안경 착용 시 해당 부위는 수치·순위 없이」 지시. 안경 아님/미전송이면 종전과 한 글자도 같다.
// ============================================================
'use strict';
const fs=require('fs'),path=require('path');const root=path.join(__dirname,'..');
const src=fs.readFileSync(path.join(root,'api','fortune.js'),'utf8');
const a=src.indexOf('const CW_FACE_AXIS_KO'),c=src.indexOf(';\n',src.indexOf('const CW_FACE_AXIS_RULE'));
const M=new Function(src.slice(a,c+1)+"\nreturn { cwFaceAxisBlock, cwFaceMeasureStr, CW_FACE_AXIS_RULE, CW_FACE_AXIS_KO, G: (typeof CW_FACE_GLASSES_AXES!=='undefined'?CW_FACE_GLASSES_AXES:null) };")();
let total=0,pass=0;const fails=[];
function check(id,name,ok,detail){total++;if(ok)pass++;else fails.push(id);console.log(`  ${ok?'ok  ':'FAIL'} ${id} ${name} — ${detail}`);}
const WANT=['eyeSize','noseWRatio','mouthRatio','myungGung','jilAek','jeonTaek'];
check('G1','안경 영향 축 목록 = 진단 d06 규칙 결과(6축)',!!M.G&&M.G.length===WANT.length&&WANT.every(k=>M.G.includes(k)),M.G?M.G.join(','):'없음');
const ranks={},meas={};for(const k of Object.keys(M.CW_FACE_AXIS_KO)){ranks[k]=0.8;meas[k]=0.3;}meas.symmetry=0.9;meas.thirds=0.85;
const base=M.cwFaceAxisBlock({ranks,measurements:meas}),off=M.cwFaceAxisBlock({ranks,measurements:meas,glasses:false}),on=M.cwFaceAxisBlock({ranks,measurements:meas,glasses:true});
const lab=k=>M.CW_FACE_AXIS_KO[k];
check('G2','안경: 영향 축 백분위 미전달 · 나머지 축은 그대로',WANT.every(k=>!on.includes(lab(k)))&&Object.keys(M.CW_FACE_AXIS_KO).filter(k=>!WANT.includes(k)&&!['symmetry','thirds','cheonI'].includes(k)).every(k=>on.includes(lab(k))),'');
check('G3','안경: [촬영 조건] 줄로 이유 명시',/\[촬영 조건\][^\n]*안경/.test(on),(on.match(/\[촬영 조건\][^\n]*/)||[''])[0]);
check('G4','안경 아님/미전송 → 종전과 동일 · 영향 축 포함',off===base&&WANT.every(k=>base.includes(lab(k)))&&!/촬영 조건/.test(base),'');
const m={whRatio:0.8,jawRatio:0.8,eyeAspect:3.1,noseWRatio:0.31,noseHRatio:0.3,mouthRatio:0.37,symmetry:0.9,thirds:0.85};
const keys=['whRatio','jawRatio','eyeAspect','noseWRatio','mouthRatio','symmetry','thirds'];
const s0=M.cwFaceMeasureStr(m,keys),s1=M.cwFaceMeasureStr(m,keys,true);
check('G5','안경: 실측 문자열에서 콧방울·입 비율 제외 · 아니면 종전',/콧방울/.test(s0)&&/입 너비/.test(s0)&&!/콧방울/.test(s1)&&!/입 너비/.test(s1)&&/얼굴 가로세로비/.test(s1)&&M.cwFaceMeasureStr(m,keys,false)===s0,s1);
check('G6','규칙: 안경 착용 시 해당 부위는 수치·순위 없이',/안경/.test(M.CW_FACE_AXIS_RULE)&&/촬영 조건/.test(M.CW_FACE_AXIS_RULE),'');
const calls=(src.replace(/function cwFaceMeasureStr\(/,'function __def(').match(/cwFaceMeasureStr\([^)]*\)/g)||[]); // 정의부 제외(수리 전 첫 실행에서 정정)
check('W1','서버: 실측 문자열 호출 3곳 모두 features.glasses 전달',calls.length===3&&calls.every(x=>/features\.glasses/.test(x)),calls.join(' | '));
const idx=fs.readFileSync(process.env.P17_INDEX||path.join(root,'index.html'),'utf8');
const n=(idx.match(/glasses:window\._cwGlasses===true/g)||[]).length;
check('W2','앱: 관상 요청 3곳(무료·프리미엄·부분 리포트)에 glasses 전송',n===3,`${n}곳`);
console.log(`[p24_glasses_prompt] total=${total} pass=${pass} fail=${total-pass}${fails.length?' · FAIL '+fails.join(','):''}`);
process.exitCode=fails.length?1:0;
