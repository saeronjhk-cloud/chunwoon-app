// ============================================================
//  P-20 · 관상 AI 해석 실측 문자열 한글화 평가 — v796 P-796-A
//  node _v792_work/p20_face_measure_label_eval.js
//  ★Eval-First. 결함(2026-10-02 제이 셀카 실기, P-795-B 배포 확인 중 발견):
//   AI 해석 본문에 「noseW 34.0%라는 실측치」 「실측 mouth 비율 0.416」 — 프롬프트의 영문 약어 키(whR·jawR·eyeR·noseW·mouth·sym·thirds)가
//   사용자 화면에 그대로 새어 나왔다. 또 상정 계측 불가(null)면 「upper:?%」 처럼 물음표가 실렸다.
//  대상: api/fortune.js face · face_premium_1 · face_premium_2 의 실측 문자열 + cwFaceMeasureStr
// ============================================================
'use strict';
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'api', 'fortune.js'), 'utf8');
let total = 0, pass = 0; const fails = [];
function check(id, name, ok, detail) { total++; if (ok) pass++; else fails.push(id); console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${id} ${name} — ${detail}`); }
const fa = src.indexOf("if (type === 'face')"), fb = src.indexOf("type === 'naming_company'", fa);
const faceSrc = src.slice(fa, fb);
const leak = (faceSrc.match(/`[^`]*\b(whR|jawR|eyeR|noseW|noseH|mouth|sym|thirds|upper|mid|lower):\$\{/g) || []);
check('K1', '관상 프롬프트 실측 문자열에 영문 약어 키 없음', leak.length === 0, leak.length ? leak.length + '건' : '없음');
const a = src.indexOf('const CW_FACE_MEASURE_KO'), b = src.indexOf('\n    }\n', src.indexOf('function cwFaceMeasureStr'));
let fn = null;
if (a >= 0 && b > a) fn = new Function(src.slice(a, b + 6) + '\nreturn cwFaceMeasureStr;')();
check('K2', 'cwFaceMeasureStr 존재', !!fn, a >= 0 ? 'ok' : '없음');
const m = { whRatio: 0.7741, jawRatio: 0.78, eyeAspect: 3.5, noseWRatio: 0.34, noseHRatio: 0.309, mouthRatio: 0.416, symmetry: 0.95, thirds: 0.82, upperThirdPct: null, middleThirdPct: null, lowerThirdPct: null };
const s = fn ? fn(m, ['whRatio', 'jawRatio', 'eyeAspect', 'noseWRatio', 'noseHRatio', 'mouthRatio', 'symmetry', 'thirds', 'upperThirdPct', 'middleThirdPct', 'lowerThirdPct']) : '';
check('K3', '한글 라벨로 나온다(가로세로비·콧방울 폭·입 너비)', /가로세로비 0\.774/.test(s) && /콧방울 폭\/얼굴 폭 34\.0%/.test(s) && /입 너비\/얼굴 폭 0\.416/.test(s), s);
check('K4', '영문 약어·물음표 없음 · null 축 생략', !/[A-Za-z]{3,}/.test(s) && !/\?/.test(s) && !/상정/.test(s), s);
const s2 = fn ? fn({ upperThirdPct: 31.2, middleThirdPct: 35.1, lowerThirdPct: 33.7, eyeRatio: 3.1 }, ['upperThirdPct', 'middleThirdPct', 'lowerThirdPct', 'eyeAspect']) : '';
check('K5', '상정 계측 시 상·중·하정 % · eyeAspect 없으면 eyeRatio 별칭', /상정 31\.2%/.test(s2) && /하정 33\.7%/.test(s2) && /눈 가로세로비 3\.10/.test(s2), s2);
check('K6', '규칙: 영문 변수명을 본문에 쓰지 말 것', /영문 (약어|변수명)/.test(src.slice(src.indexOf('const CW_FACE_AXIS_RULE'), src.indexOf("if (type === 'face')"))), '');
console.log(`[p20_face_measure_label] total=${total} pass=${pass} fail=${total - pass}${fails.length ? ' · FAIL ' + fails.join(',') : ''}`);
process.exitCode = fails.length ? 1 : 0;
