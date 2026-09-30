// ============================================================
//  P-18 · 관상 AI 해석 백분위 표기·방향 평가 — v795 P-790-G/F
//  node _v792_work/p18_face_percentile_wording_eval.js
//  ★Eval-First. 결함(09-30 제이 셀카 AI 해석):
//   G. 하위 9% 를 「상위 91%(매우 작음)」로 적었다 — 뜻은 맞아도 읽는 사람은 크다고 오해한다.
//   F. 참조표 범위 밖이면 「상위 0%」가 나온다.
//   D. 눈꼬리 경사는 랭크가 높을수록 ★처진 눈인데 라벨이 방향을 말하지 않아 AI 가 「상위 5%로 뚜렷하게 올라간」이라 썼다
//      (제이 눈꼬리 0.1° — 평균 −3.9° 보다 평평). 보수관 기울기도 같은 구조(+ = 꼬리가 위).
//  대상: api/fortune.js 의 CW_FACE_AXIS_KO ~ cwFaceAxisBlock 을 그대로 잘라 실행한다.
// ============================================================
'use strict';
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'api', 'fortune.js'), 'utf8');
const a = src.indexOf('const CW_FACE_AXIS_KO'), b = src.indexOf('const CW_FACE_AXIS_RULE', a);
if (a < 0 || b < 0) throw new Error('cwFaceAxisBlock 추출 실패');
const block = new Function(src.slice(a, b) + '\nreturn { cwFaceAxisBlock, CW_FACE_AXIS_KO };')();
let total = 0, pass = 0; const fails = [];
function check(id, name, ok, detail) { total++; if (ok) pass++; else fails.push(id); console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${id} ${name} — ${detail}`); }
const one = (k, r) => block.cwFaceAxisBlock({ ranks: { [k]: r }, measurements: {} }).split('] ')[1] || '';
const s09 = one('eyeSize', 0.09), s95 = one('noseWRatio', 0.95), s1 = one('noseWRatio', 1), s0 = one('chin', 0), s50 = one('mouthRatio', 0.5);
check('G1', '랭크 0.09 → 「하위 9%」(「상위 91%」 금지)', /하위 9%/.test(s09) && !/상위 91%/.test(s09), s09);
check('G2', '랭크 0.95 → 「상위 5%」', /상위 5%/.test(s95), s95);
check('G3', '랭크 0.5 → 「상위 50%」 또는 「하위 50%」 한 가지(중앙)', /(상위|하위) 50%/.test(s50), s50);
check('F1', '랭크 1 → 「상위 0%」 금지 · 범위 밖 표기', !/상위 0%/.test(s1) && /범위 밖|1% 미만/.test(s1), s1);
check('F2', '랭크 0 → 「하위 0%」 금지 · 범위 밖 표기', !/하위 0%/.test(s0) && /범위 밖|1% 미만/.test(s0), s0);
check('D1', '눈꼬리 라벨이 방향을 말한다(높을수록 처짐)', /처짐|처진/.test(block.CW_FACE_AXIS_KO.eyeTilt), block.CW_FACE_AXIS_KO.eyeTilt);
check('D2', '보수관 기울기 라벨이 방향을 말한다(높을수록 꼬리가 위)', /꼬리/.test(block.CW_FACE_AXIS_KO.browAngle), block.CW_FACE_AXIS_KO.browAngle);
// ★v795 촬영 안내 — 안경 렌즈(근시)는 눈을 작게, 앞머리는 이마를 가린다(평가셋·제이 셀카 실측)
const idx = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
check('U1', '관상 촬영 안내에 「안경을 벗고」와 앞머리 안내가 있다', /안경을 벗고 얼굴을 원형 가이드에/.test(idx) && /안경은 벗고<\/b>, 앞머리가 이마를/.test(idx), '');
console.log(`[p18_face_percentile] total=${total} pass=${pass} fail=${total - pass}${fails.length ? ' · FAIL ' + fails.join(',') : ''}`);
process.exitCode = fails.length ? 1 : 0;
