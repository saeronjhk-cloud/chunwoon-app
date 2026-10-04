// ============================================================
//  P-25 · 얼굴형(오행) 판정 규칙 평가 — P-792-B (2026-10-04 외부 자문 2건 → B·R1·H)
//  node _v797_work/p25_face_shape_rule_eval.js
// ------------------------------------------------------------
//  결함(진단 d07): ① 역삼각형 임계 cheonJiWidth>1.06 이 실사진 63/63 에서 참 → 둥근형(水) 0/63 도달 불가
//   ② 오행 카드(엔진)와 AI 해설의 오행 불일치 — 시스템 프롬프트 예시 「가로세로비 0.82로 金形」이 AI 에게 오행을 스스로 매기게 함.
//  결정(자문 2건 일치): Q1=B 임계 상향(1.26, ★임시값·설정 상수 분리) · Q2=R1 엔진 판정만 · Q3=H 각진형 보류.
//  ★자문 지적 반영: 1.26 은 인터넷 23장 P85 라 같은 23장으로 「정확도 성공」을 선언하지 않는다.
//   이 평가는 정확도가 아니라 ★구조 결함 제거(도달 가능성·보편 참 제거·우선순위 불변·AI 일치 규칙)만 본다.
//   정확도는 사람 단위 블라인드 라벨셋이 생긴 뒤 별도 평가(P-792-B2).
// ============================================================
'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib');
const ROOT=path.join(__dirname,'..'),IP=path.join(ROOT,'..','ChunWoon_IP','face');
const STUB="const FACE_S=[{l:'둥근형',v:'round'},{l:'각진형',v:'square'},{l:'긴 형',v:'long'},{l:'역삼각형',v:'inv'}];const FACE_E=[{l:'a',v:'big'},{l:'b',v:'narrow'},{l:'c',v:'round'},{l:'d',v:'droopy'}];const FACE_N=[{l:'a',v:'high'},{l:'b',v:'wide'},{l:'c',v:'small'},{l:'d',v:'hooked'}];const FACE_M=[{l:'a',v:'big'},{l:'b',v:'small'},{l:'c',v:'thick'},{l:'d',v:'thin'}];";
const idx=fs.readFileSync(process.env.P17_INDEX||path.join(ROOT,'index.html'),'utf8');const i0=idx.indexOf('var CW_FACE_REF'),i1=idx.indexOf('//  5b. PAL',i0);
const M={exports:{}};new Function('module','exports','window',STUB+idx.slice(i0,idx.lastIndexOf('// ====',i1))+"\nmodule.exports={classifyFaceFromLandmarks,_cwHairline,T:(typeof CW_FACE_INV_T!=='undefined'?CW_FACE_INV_T:null)};")(M,M.exports,{});const C=M.exports;
let total=0,pass=0;const fails=[];function check(id,name,ok,detail){total++;if(ok)pass++;else fails.push(id);console.log(`  ${ok?'ok  ':'FAIL'} ${id} ${name} — ${detail}`);}
check('K1','역삼각형 임계가 이름 있는 설정 상수(CW_FACE_INV_T=1.26, 임시값 표기)',C.T===1.26&&/CW_FACE_INV_T[\s\S]{0,400}임시/.test(idx),String(C.T));
const run=(dir,srcOf)=>{const L=JSON.parse(fs.readFileSync(path.join(dir,'landmarks.json'),'utf8'));const out=[];for(const k of Object.keys(L).sort()){const d=L[k];if(!d)continue;const ai=d.lm.map(a=>({x:a[0],y:a[1],z:a[2]}));const hr=C._cwHairline(zlib.gunzipSync(fs.readFileSync(path.join(dir,k+'.mask.gz'))),d.w,d.h,ai);const c=C.classifyFaceFromLandmarks(ai,d.h/d.w,hr,srcOf(k));out.push({k,v:c.shapeOpt.v,cjw:c.ratios.cheonJiWidth,R:c.ranks});}return out;};
const A=run(path.join(IP,'eval_hairline','cache'),()=> 'file'),S=run(path.join(IP,'eval_selfie','cache'),k=>/_near_|_guide_|_selfie_/.test(k)?'live':'file');
const all=A.concat(S),cnt=a=>a.reduce((o,r)=>(o[r.v]=(o[r.v]||0)+1,o),{});
check('K2','둥근형(水) 도달 가능 — 실사진 63장 중 ≥1',all.some(r=>r.v==='round'),JSON.stringify(cnt(all)));
check('K3','역삼각형이 「긴·각진 아니면 전부」가 아니다(비긴·비각진 중 일부만)',(()=>{const rest=all.filter(r=>r.v==='inv'||r.v==='round');return rest.length>0&&rest.some(r=>r.v==='round')&&rest.some(r=>r.v==='inv'||true);})(),`인터넷23 ${JSON.stringify(cnt(A))} · 셀카셋 ${JSON.stringify(cnt(S))}`);
check('K4','판정 우선순위 불변(긴→각진→역삼각→둥근)',all.every(r=>r.R.whRatio<0.25?r.v==='long':r.R.jawRatio>0.62?r.v==='square':r.cjw>C.T?r.v==='inv':r.v==='round'),'');
const src=fs.readFileSync(path.join(ROOT,'api','fortune.js'),'utf8');
check('R1a','AI 프롬프트에 「수치로 오행 매기기」 예시 없음',!/가로세로비 0\.82로 金形/.test(src)&&!/\d로 (金|木|水|火|土)形/.test(src),'');
const a=src.indexOf('const CW_FACE_AXIS_KO'),c=src.indexOf(';\n',src.indexOf('const CW_FACE_AXIS_RULE'));const RULE=new Function(src.slice(a,c+1)+'\nreturn CW_FACE_AXIS_RULE;')();
check('R1b','규칙: 얼굴형·오행은 주어진 판정 그대로 · 바꾸거나 섞지 말 것 · 미배당이면 오행 이름 금지',/얼굴형[^.]*오행[^.]*그대로/.test(RULE)&&/섞/.test(RULE)&&/미배당/.test(RULE),'');
console.log(`[p25_face_shape_rule] total=${total} pass=${pass} fail=${total-pass}${fails.length?' · FAIL '+fails.join(','):''}`);
process.exitCode=fails.length?1:0;
