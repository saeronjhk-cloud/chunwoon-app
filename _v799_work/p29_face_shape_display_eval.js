// ============================================================
//  P-29 · 얼굴형 표시 방식(측정 근거형) 평가 — v799 P-799-B
//  node _v799_work/p29_face_shape_display_eval.js
// ------------------------------------------------------------
//  결함: 얼굴형을 「판독상 金形으로 분류」처럼 단정 표시 · 사람 평가자 일치도 κ=−0.02(우연 수준)인데 근거 없이 단정 ·
//   역삼각형은 「(오행 미배당)」이 미완성처럼 보임 · shapeCommon 이 「木·火·金·水 4형」(火 배당은 v786-c 에서 뗌)으로 낡음.
//  수리(외부 자문 R1 · Gemini/ChatGPT 모두 B안 · 제이 「추천대로」 2026-10-09):
//   엔진 _cwFaceShapeDesc 가 「~형 계열」 + 측정 근거 한 줄 + 경계 인접형(사전 고정 구간) + 측정 세부를 만든다.
//   판정 규칙·임계(whRatio 랭크<0.25 · jawRatio 랭크>0.62 · cheonJiWidth>1.26)는 ★동결(자문 Q5).
//  기준(수리 전에 정함):
//   S1 _cwFaceShapeDesc · CW_FACE_SHAPE_BAND = {rank:0.05, cjw:0.02}(사전 고정)
//   S2 평가 사진 전부(라벨셋 64 · 셀카 40 · 인터넷 23)에서 desc.primary = shapeOpt.v (판정 무변경)
//   S3 경계 대칭: 각 결정 변수 임계 ±band/2 → 반대편 형이 인접형으로 표기 · ±band×2 → 인접형 없음 (3변수 × 양쪽)
//   S4 근거 문구: 4형 각각 정해진 문구 · 평가성 금지어 없음(넓적·결점·단점·못생·투박·억센·둔해)
//   S5 앱: 역삼각형 「(오행 미배당)」 제거 → 「원전 오형에 직접 대응하지 않는 윤곽」 · shapeCommon 4형 문구 정정 ·
//       얼굴형 근거에 title·basis 사용 · 측정 세부는 <details> · 「좋고 나쁨의 평가가 아니며」 안내 · 단정 「으로 분류」 제거
//   S6 AI 요청 3곳에 shape.type·shape.basis 전달
//   S7 서버 프롬프트: 「오행 미배당」 규칙 → 새 표기 규칙 · 「계열」·근거와 함께 · 좋고 나쁨 평가 금지 · userPrompt 3곳에 윤곽 줄
// ============================================================
'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib');
const ROOT=path.join(__dirname,'..'),IP=path.join(ROOT,'..','ChunWoon_IP','face');
const STUB="const FACE_S=[{l:'둥근형',v:'round'},{l:'각진형',v:'square'},{l:'긴 형',v:'long'},{l:'역삼각형',v:'inv'}];const FACE_E=[{l:'a',v:'big'},{l:'b',v:'narrow'},{l:'c',v:'round'},{l:'d',v:'droopy'}];const FACE_N=[{l:'a',v:'high'},{l:'b',v:'wide'},{l:'c',v:'small'},{l:'d',v:'hooked'}];const FACE_M=[{l:'a',v:'big'},{l:'b',v:'small'},{l:'c',v:'thick'},{l:'d',v:'thin'}];";
const idx=fs.readFileSync(process.env.P17_INDEX||path.join(ROOT,'index.html'),'utf8');const srv=fs.readFileSync(path.join(ROOT,'api','fortune.js'),'utf8');
const i0=idx.indexOf('var CW_FACE_REF'),i1=idx.indexOf('//  5b. PAL',i0);const M={exports:{}};
new Function('module','exports','window',STUB+idx.slice(i0,idx.lastIndexOf('// ====',i1))+"\nmodule.exports={classifyFaceFromLandmarks,_cwHairline,D:(typeof _cwFaceShapeDesc!=='undefined'?_cwFaceShapeDesc:null),B:(typeof CW_FACE_SHAPE_BAND!=='undefined'?CW_FACE_SHAPE_BAND:null),T:CW_FACE_INV_T};")(M,M.exports,{});const C=M.exports;
let total=0,pass=0;const fails=[];function check(id,name,ok,detail){total++;if(ok)pass++;else fails.push(id);console.log(`  ${ok?'ok  ':'FAIL'} ${id} ${name} — ${detail}`);}
check('S1','_cwFaceShapeDesc · CW_FACE_SHAPE_BAND {rank:0.05, cjw:0.02}',!!C.D&&!!C.B&&C.B.rank===0.05&&C.B.cjw===0.02,C.B?JSON.stringify(C.B):'없음');
// S2
{let n=0,bad=[],near=0;const sets=[['eval_labelset',null],['eval_selfie',null],['eval_hairline',null]];
 for(const [dir] of sets){const lp=path.join(IP,dir,'cache','landmarks.json');if(!fs.existsSync(lp))continue;const L=JSON.parse(fs.readFileSync(lp,'utf8'));
  for(const [k,d] of Object.entries(L)){if(!d||!d.lm)continue;const mp=path.join(IP,dir,'cache',k+'.mask.gz');const ai=d.lm.map(a=>({x:a[0],y:a[1],z:a[2]}));
   const hr=fs.existsSync(mp)?C._cwHairline(zlib.gunzipSync(fs.readFileSync(mp)),d.w,d.h,ai):null;const c=C.classifyFaceFromLandmarks(ai,d.h/d.w,hr,null);n++;
   if(!c.shapeDesc||c.shapeDesc.primary!==c.shapeOpt.v)bad.push(k);else if(c.shapeDesc.near)near++;}}
 check('S2','평가 사진 전부 desc.primary = shapeOpt.v',!!C.D&&n>=100&&bad.length===0,`n ${n} · 불일치 ${bad.length}${bad.length?' '+bad.slice(0,3).join(','):''} · 인접형 표기 ${near}장`);}
// S3
{const ok=[];if(C.D){const B=C.B,T=C.T;
  const cases=[// [설명, 기본(wr,jr,cjw), 바꿀 변수, 임계]
   ['wr',[0.5,0.4,1.1],0,0.25],['jr',[0.5,0.4,1.1],1,0.62],['cjw',[0.5,0.4,1.1],2,T]];
  for(const [nm,base,ix,thr] of cases){const b=ix===2?B.cjw:B.rank;
   for(const sgn of [-1,1]){const v1=base.slice();v1[ix]=thr+sgn*b/2;const v2=base.slice();v2[ix]=thr+sgn*b*2;const o=base.slice();o[ix]=thr-sgn*b/2;
    const d1=C.D(...v1),d2=C.D(...v2),dO=C.D(...o);ok.push(d1.near===dO.primary&&d1.near!==d1.primary&&d2.near==null);}}}
 check('S3','경계 대칭(3변수×양쪽: band/2 → 인접형 · band×2 → 없음)',ok.length===6&&ok.every(Boolean),ok.map(x=>x?1:0).join(''));}
// S4
const BASIS={long:'세로 길이가 긴 편',square:'턱선이 또렷한 편',inv:'이마 쪽이 턱보다 넓은 편',round:'가로·세로 균형이 비슷하고 턱선이 부드러운 편'};
const BAN=/넓적|결점|단점|못생|투박|억센|둔해/;
{let ok=!!C.D;const det=[];if(C.D)for(const [v,args] of Object.entries({long:[0.1,0.4,1.1],square:[0.5,0.9,1.1],inv:[0.5,0.4,1.4],round:[0.5,0.4,1.1]})){const d=C.D(...args);const g=d.primary===v&&d.basis===BASIS[v]&&/계열$/.test(d.title)&&!BAN.test(d.title+d.basis+d.detail);ok=ok&&g;det.push(v+':'+(g?1:0));}
 check('S4','근거 문구 4형 · 「계열」 · 평가성 금지어 없음',ok,det.join(' '));}
// S5 (★표기 정정 1회: title 검사를 「shapeDesc 80자 안 title」 → 「sd=aiScores.shapeDesc 후 sd.title·sd.basis 사용」 — 같은 뜻, 구현 변수명 차이)
{const fs1=idx.slice(idx.indexOf('const FACE_SOURCES='),idx.indexOf('eyes:',idx.indexOf('const FACE_SOURCES=')));
 const sf=idx.slice(idx.indexOf('function setupFaceResultContainer'),idx.indexOf('// Separate LLM trigger for face'));
 const r={noMibae:!/오행 미배당/.test(idx),invNew:/원전 오형에 직접 대응하지 않는 윤곽/.test(fs1),common:!/木·火·金·水 4형/.test(idx),title:/const sd=aiScores&&aiScores\.shapeDesc/.test(sf)&&/sd\.title/.test(sf)&&/sd\.basis/.test(sf),details:/<details[\s\S]{0,300}측정 세부/.test(sf),notice:/좋고 나쁨의 평가가 아니며/.test(sf),noDanjeong:!/으로 분류/.test(sf)};
 check('S5','앱 표시(미배당 제거·4형 문구·title/basis·측정 세부 접기·안내·단정 제거)',Object.values(r).every(Boolean),JSON.stringify(r));}
// S6
{const n=(idx.match(/shape:\{label:[^}]*type:[^}]*basis:/g)||[]).length;check('S6','AI 요청 3곳 shape.type·basis',n===3,`${n}곳`);}
// S7
{const r={noMibae:!/오행 미배당/.test(srv),rule:/계열/.test(srv)&&/좋고 나쁨/.test(srv),lines:(srv.match(/윤곽:\$\{features\.shape\?\.type/g)||[]).length===3};
 check('S7','서버 프롬프트(규칙 교체 · 「계열」·평가 금지 · userPrompt 3곳 윤곽 줄)',Object.values(r).every(Boolean),JSON.stringify(r));}
console.log(`[p29_face_shape_display] total=${total} pass=${pass} fail=${total-pass}${fails.length?' · FAIL '+fails.join(','):''}`);
process.exitCode=fails.length?1:0;
