// ============================================================
//  P-19 · 관상 AI 해석 축 라벨 방향 전수 평가 — v796 P-795-B
//  node _v792_work/p19_face_axis_label_direction_eval.js
//  ★Eval-First. 결함: v795 에서 눈꼬리·보수관 기울기만 방향을 붙였다. 나머지 REL 축 라벨도
//   「높을수록 무엇」이 비어 있어 AI 가 비율의 방향을 추측한다.
//   예) eyeAspect=눈 가로/세로 — 높을수록 ★가늘고 긴 눈인데 「(큼/높음)」만 붙어 「눈이 크다」로 오독 가능
//       gwanGol=얼굴폭/관자폭 · whRatio=폭/높이(높을수록 넓은 얼굴) · eyeSize=눈 폭/얼굴 폭
//   또 REL 축 upperOverRest·midOverLow(v792 삼정 재정의) 가 라벨 표에 없어 AI 에 아예 전달되지 않았다.
//  대상: api/fortune.js CW_FACE_AXIS_KO ~ CW_FACE_AXIS_RULE · 축 성질표는 코어(face_core_v786.js) CW_FACE_AXIS_KIND.
// ============================================================
'use strict';
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'api', 'fortune.js'), 'utf8');
const a = src.indexOf('const CW_FACE_AXIS_KO'), b = src.indexOf('const CW_FACE_AXIS_RULE', a), c = src.indexOf(';\n', src.indexOf('const CW_FACE_AXIS_RULE'));
if (a < 0 || b < 0 || c < 0) throw new Error('추출 실패');
const M = new Function(src.slice(a, c + 1) + '\nreturn { cwFaceAxisBlock, CW_FACE_AXIS_KO, CW_FACE_ABS_AXES, CW_FACE_AXIS_RULE };')();
const core = fs.readFileSync(path.join(root, '_v786_diag', 'face_core_v786.js'), 'utf8');
const ti = core.indexOf('var CW_FACE_AXIS_KIND'), te = core.indexOf('};', ti);
const TYPE = {}; core.slice(ti, te).replace(/(\w+):\s*'(REL|ABS)'/g, (_, k, t) => { TYPE[k] = t; });
const REL = Object.keys(TYPE).filter(k => TYPE[k] === 'REL');
let total = 0, pass = 0; const fails = [];
function check(id, name, ok, detail) { total++; if (ok) pass++; else fails.push(id); console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${id} ${name} — ${detail}`); }
const KO = M.CW_FACE_AXIS_KO, L = k => KO[k] || '';
check('A0', '코어 축 성질표 추출(REL ≥ 23 · 29축 − ABS 6)', REL.length >= 23, `REL ${REL.length}`);
const miss = REL.filter(k => !KO[k] && !M.CW_FACE_ABS_AXES[k]);
check('A1', 'REL 축 전부가 라벨 표에 있다(누락 = AI 미전달)', miss.length === 0, miss.join(',') || '없음');
const nodir = REL.filter(k => KO[k] && !/높을수록/.test(KO[k]));
check('A2', 'REL 축 라벨 전부가 「높을수록 …」 방향을 말한다', nodir.length === 0, nodir.join(',') || '없음');
check('D1', 'whRatio: 높을수록 넓은(가로) · 낮을수록 긴 얼굴', /높을수록[^·)]*(넓|가로)/.test(L('whRatio')) && /낮을수록[^)]*(길|긴)/.test(L('whRatio')), L('whRatio'));
check('D2', 'eyeAspect: 높을수록 가늘고 긴 눈 · 낮을수록 둥근 눈(크기 아님)', /높을수록[^)]*가늘/.test(L('eyeAspect')) && /낮을수록[^)]*둥/.test(L('eyeAspect')), L('eyeAspect'));
check('D3', 'eyeSize: 얼굴 폭 대비 눈 폭임을 밝힌다', /얼굴\s?폭/.test(L('eyeSize')) && /눈\s?폭/.test(L('eyeSize')), L('eyeSize'));
check('D4', 'gwanGol: 관자 대비 광대 폭 · 높을수록 광대가 도드라짐', /관자/.test(L('gwanGol')) && /높을수록[^)]*광대/.test(L('gwanGol')), L('gwanGol'));
check('D5', 'myungGung·jilAek·jeonTaek: 높을수록 넓음', ['myungGung', 'jilAek', 'jeonTaek'].every(k => /높을수록[^)]*넓/.test(L(k))), ['myungGung', 'jilAek', 'jeonTaek'].map(L).join(' / '));
check('D6', 'noseDorsum: 높을수록 콧대가 솟음', /높을수록[^)]*(솟|볼록)/.test(L('noseDorsum')), L('noseDorsum'));
check('D7', 'chin: 턱 길이(아랫입술~턱끝)', /길/.test(L('chin')) && /높을수록/.test(L('chin')), L('chin'));
check('D8', 'v795 라벨 유지(눈꼬리 처짐 · 보수관 꼬리)', /처/.test(L('eyeTilt')) && /꼬리가 위/.test(L('browAngle')), '');
const t1 = M.cwFaceAxisBlock({ ranks: { upperOverRest: 0.8, midOverLow: 0.2 }, measurements: { upperOverRest: 0.52, midOverLow: 1.0 } });
check('T1', '삼정 길이 축이 프롬프트에 실린다(상정·중정/하정)', /상정/.test(t1) && /중정/.test(t1), t1.replace(/\n/g, ' '));
// 실제 운영: 머리선이 가려지면 measurements.upperOverRest=null 인데 코어 _cwRank(null)=0.5 라 ranks 엔 0.5 가 온다.
const t2 = M.cwFaceAxisBlock({ ranks: { upperOverRest: 0.5, midOverLow: 0.5 }, measurements: { upperOverRest: null, midOverLow: 1.0 } });
check('T2', '머리선 가림(실측 null · 랭크 0.5) → 상정 축 생략(「보통」 둔갑 금지)', !/상정 길이/.test(t2) && /중정/.test(t2), t2.replace(/\n/g, ' '));
const t3 = M.cwFaceAxisBlock({ ranks: { upperOverRest: 0.7, midOverLow: 0.5 } });
check('T3', '실측값 없는 구 클라이언트 → 상정 축 생략', !/상정 길이/.test(t3), t3.replace(/\n/g, ' '));
check('R1', '규칙 문구가 괄호 속 「높을수록」 방향 해석을 지시한다', /높을수록/.test(M.CW_FACE_AXIS_RULE), '');
console.log(`[p19_face_axis_label_direction] total=${total} pass=${pass} fail=${total - pass}${fails.length ? ' · FAIL ' + fails.join(',') : ''}`);
process.exitCode = fails.length ? 1 : 0;
