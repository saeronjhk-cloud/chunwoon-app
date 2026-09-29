// ============================================================
//  P-15 · 관상 참조표 앵커 + 프리미엄 해석 임계 쏠림 평가 — v792 P-790-H
//  node _v790_work/p15_premium_threshold_skew_eval.js
// ------------------------------------------------------------
//  ★Eval-First: 수리 전에 작성·실행해 FAIL 을 확인한 뒤 수리한다.
//  근본 원인(09-29 실측): 합성 얼굴 생성기(synth_face.js)의 중심값·고정 위치가 MediaPipe 실제 기하와 어긋나
//    표준 얼굴(canonical_face_model)이 참조표 30축 중 14축에서 양 끝(랭크<0.1·>0.9)에 놓였다.
//    ⟹ 고정 임계를 랭크로만 바꾸면 실사진에서 쏠림 방향만 뒤집힌다. 참조표부터 표준 얼굴에 앵커한다.
//  A. 참조표 앵커   B. 계측 정의(눈썹 윤곽)   C. 프리미엄 칸별 쏠림   D. 결제 블록 부위 선택   E. 방향
//  고정 입력: _v789_work/fixtures/canonical_face_model.obj (sha256 8bac8044…)
// ============================================================
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const V = fs.readFileSync(path.join(ROOT, '_v789_work', 'fixtures', 'canonical_face_model.obj'), 'utf8')
  .split('\n').filter(l => l.startsWith('v ')).map(l => l.split(/\s+/).slice(1, 4).map(Number));
if (V.length !== 468) throw new Error('canonical 468 정점 아님');
// 모델(+y 위 · +z 관찰자 쪽) → MediaPipe 정규화(+y 아래 · z 작을수록 카메라 쪽). ★z 부호도 뒤집는다(콧대 볼록도).
const toImage = (verts, A) => verts.map(([x, y, z]) => ({ x: 0.5 + x / 40, y: 0.5 - y / (40 * A), z: -z / 40 }));
const shiftY = (verts, ids, dy) => verts.map((v, i) => ids.includes(i) ? [v[0], v[1] + dy, v[2]] : v);

const STUB = "const FACE_S=[{l:'둥근형',v:'round'},{l:'각진형',v:'square'},{l:'긴 형',v:'long'},{l:'역삼각형',v:'inv'}];" +
  "const FACE_E=[{l:'큰 눈',v:'big'},{l:'가늘고 긴 눈',v:'narrow'},{l:'둥근 눈',v:'round'},{l:'처진 눈',v:'droopy'}];" +
  "const FACE_N=[{l:'높고 오똑한 코',v:'high'},{l:'넓고 둥근 코',v:'wide'},{l:'작고 낮은 코',v:'small'},{l:'매부리코',v:'hooked'}];" +
  "const FACE_M=[{l:'큰 입',v:'big'},{l:'작은 입',v:'small'},{l:'두꺼운 입술',v:'thick'},{l:'얇은 입술',v:'thin'}];";
const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const i0 = idx.indexOf('var CW_FACE_REF'), i1 = idx.indexOf('//  5b. PAL', i0);
const coreTxt = idx.slice(i0, idx.lastIndexOf('// ====', i1));
const p0 = idx.indexOf('function _generateClientPremium('), p1 = idx.indexOf('\nfunction renderPremiumReport', p0);
if (p0 < 0 || p1 < 0) throw new Error('_generateClientPremium 추출 실패');
const premTxt = idx.slice(p0, p1);
const w0 = idx.indexOf('function _showFacePaywall('), wA = idx.indexOf('if(ra){', w0), wB = idx.indexOf('const paywallBox', wA);
const pwTxt = 'function _pwPick(ra){let warningMsg="(기본)";let warningDetail="";' + idx.slice(wA, wB) + ';return warningMsg;}';
const M = { exports: {} };
new Function('module', 'exports', 'window', STUB + coreTxt + '\n' + premTxt + '\n' + pwTxt +
  '\nmodule.exports={_cwFaceMeasure,_cwRank,CW_FACE_REF,CW_FACE_AXES,CW_FACE_AXIS_KIND,classifyFaceFromLandmarks,_generateClientPremium,_pwPick};')(M, M.exports, undefined);
const C = M.exports;
const built = fs.readFileSync(path.join(ROOT, '_v786_diag', 'face_core_v786.built.js'), 'utf8');
const SY = require(path.join(ROOT, '_v786_diag', 'synth_face.js'));

let total = 0, pass = 0; const fails = [];
function check(id, name, ok, detail) { total++; if (ok) pass++; else fails.push(id); console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${id} ${name} — ${detail}`); }
const f = (x, d) => (typeof x === 'number' ? x.toFixed(d == null ? 3 : d) : String(x));
const ANG = new Set(['eyeTilt', 'browAngle']), PCT = new Set(['upperThirdPct', 'middleThirdPct', 'lowerThirdPct']);

const can = C._cwFaceMeasure(toImage(V, 1.25), 1.25);

// ── A. 참조표 앵커 ──
console.log('[A] 참조표 앵커 — 표준 얼굴이 합성 모집단의 중심에 놓이는가');
const zr = (() => { let k = 0; return () => (k++ % 2 === 0 ? 0.5 : 0.25); })();   // Box-Muller 가 정확히 0 을 내는 입력
const pz = SY.sampleParams(zr, 0.08);
const sz = C._cwFaceMeasure(SY.makeLandmarks(pz, 1.25), 1.25);
const offA = C.CW_FACE_AXES.filter(k => {
  const a = sz[k], b = can[k];
  if (ANG.has(k) || PCT.has(k)) return Math.abs(a - b) > 0.5;
  if (k === 'noseDorsum') return Math.abs(a - b) > 0.003;
  return Math.abs(a / (b || 1e-9) - 1) > 0.03;
});
check('A1', '합성 생성기 무잡음(중심값) 계측 == 표준 얼굴 계측 (30축 · 비 3% / 각·% 0.5)', offA.length === 0,
  offA.length ? `어긋난 ${offA.length}축: ` + offA.map(k => `${k} ${f(sz[k], 4)}≠${f(can[k], 4)}`).join(' · ') : '30축 일치');
const REL = C.CW_FACE_AXES.filter(k => C.CW_FACE_AXIS_KIND[k] === 'REL');
const offR = REL.filter(k => { const r = C._cwRank(can[k], C.CW_FACE_REF.q[k]); return r < 0.2 || r > 0.8; });
check('A2', `index.html 참조표에서 표준 얼굴 랭크 ∈ [0.2,0.8] (REL ${REL.length}축)`, offR.length === 0,
  offR.length ? `${offR.length}축 이탈: ` + offR.map(k => `${k} ${f(C._cwRank(can[k], C.CW_FACE_REF.q[k]), 2)}`).join(' · ') : '전 축 중앙권');
check('A3', 'index.html 내장 참조표 == face_core built', built.indexOf(JSON.stringify(C.CW_FACE_REF)) >= 0, C.CW_FACE_REF.version);

// ── B. 계측 정의 ──
console.log('[B] 눈썹 윤곽 — 63/66 은 윗윤곽(70→63→105→66→107), 하단 윤곽은 46→53→52→65→55');
check('B1', '표준 얼굴 browThick(눈썹 윗선↔아랫선) ∈ [0.025,0.045]', can.browThick >= 0.025 && can.browThick <= 0.045, f(can.browThick, 4));
check('B2', '표준 얼굴 jeonTaek(눈썹 아랫선↔상안검) ∈ [0.06,0.11]', can.jeonTaek >= 0.06 && can.jeonTaek <= 0.11, f(can.jeonTaek, 4));

// ── C·D. 합성 모집단(p03 평가 조건과 동일: seed 90210 · N 20000 · 종횡비 5 · CV 3) ──
const RATIOS = [0.75, 1.0, 1.333, 1.5, 1.778], CVS = [0.05, 0.08, 0.12];
const N = 20000, rnd = SY.mulberry32(90210);
const slots = {}, grades = {}, pw = new Map();
const add = (m, k, v) => { if (!m[k]) m[k] = new Map(); m[k].set(v, (m[k].get(v) || 0) + 1); };
for (let i = 0; i < N; i++) {
  const cv = CVS[i % CVS.length], A = RATIOS[(i / CVS.length | 0) % RATIOS.length];
  const ra = C._cwFaceMeasure(SY.makeLandmarks(SY.sampleParams(rnd, cv), A), A);
  const P = C._generateClientPremium(ra, '');
  for (const p of P.twelvePalaces.palaces) { add(slots, p.name, p.interpretation); add(grades, p.name, p.grade); }
  for (const o of P.fiveOfficials.officials) add(slots, o.name, o.interpretation);
  const T = P.threeCourtAnalysis;
  add(slots, '삼정·상정', T.upper.interpretation); add(slots, '삼정·중정', T.middle.interpretation);
  add(slots, '삼정·하정', T.lower.interpretation); add(slots, '삼정·균형', T.balance);
  const w = C._pwPick(ra); pw.set(w, (pw.get(w) || 0) + 1);
}
const top = m => Math.max(...m.values()) / N;
// ABS(원문이 기준을 스스로 주는 축)·TEXT(원문이 비교 대상을 주는 칸) 는 쏠림이 정상일 수 있어 INFO 로만 본다 — v786-b 원칙.
//   천이궁 = 좌우 균형(ABS) · 삼정·균형 = 三停均等(ABS) · 보수관 = 眉長過目(눈썹 > 눈 폭, TEXT · v789)
const ABS_SLOT = new Set(['천이궁(遷移宮)', '삼정·균형', '보수관(保壽官) — 눈썹']);
console.log('[C] 프리미엄 칸별 — 가장 흔한 문장 비율 ≤ 90%');
let ci = 0;
for (const [k, m] of Object.entries(slots)) {
  const t = top(m);
  if (ABS_SLOT.has(k)) { console.log(`  INFO ${k} (ABS) 최다 문장 ${f(t * 100, 1)}% · 문장 ${m.size}종`); continue; }
  check('C' + (++ci), `${k} 최다 문장 ≤ 90%`, t <= 0.90, `${f(t * 100, 1)}% · 문장 ${m.size}종`);
}
for (const [k, m] of Object.entries(grades)) {
  if (ABS_SLOT.has(k)) continue;
  const t = top(m);
  check('C' + (++ci), `${k} 등급 최다 ≤ 90%`, t <= 0.90, [...m.entries()].map(([g, c]) => `${g} ${f(c / N * 100, 1)}%`).join(' · '));
}
console.log('[D] 결제 블록 부위 선택');
check('D1', '결제 블록 최다 부위 ≤ 90%', top(pw) <= 0.90, [...pw.entries()].sort((a, b) => b[1] - a[1]).map(([g, c]) => `${g.split(' — ')[0]} ${f(c / N * 100, 1)}%`).join(' · '));

// ── E. 방향 ── (MediaPipe +y 아래 · tilt + = 외안각이 아래 = 처진 눈)
console.log('[E] 부처궁 눈꼬리 문장 방향');
const outer = [33, 263, 130, 359, 7, 249, 246, 466];
const upR = C._cwFaceMeasure(toImage(shiftY(V, outer, +0.5), 1.25), 1.25);
const dnR = C._cwFaceMeasure(toImage(shiftY(V, outer, -0.5), 1.25), 1.25);
const bu = C._generateClientPremium(upR, '').twelvePalaces.palaces.find(p => p.name.startsWith('부처궁')).interpretation;
const bd = C._generateClientPremium(dnR, '').twelvePalaces.palaces.find(p => p.name.startsWith('부처궁')).interpretation;
check('E1', '눈꼬리를 올리면(tilt<0) 「올라가」 문장', upR.eyeTailAngle < 0 && bu.indexOf('올라가') >= 0, `tilt ${f(upR.eyeTailAngle, 1)}° → ${bu.slice(0, 14)}…`);
check('E2', '눈꼬리를 내리면(tilt>0) 「내려가」 문장', dnR.eyeTailAngle > 0 && bd.indexOf('내려가') >= 0, `tilt ${f(dnR.eyeTailAngle, 1)}° → ${bd.slice(0, 14)}…`);

// ── INFO ──
const cls = C.classifyFaceFromLandmarks(toImage(V, 1.25), 1.25);
console.log(`  INFO 표준 얼굴 무료 화면 분류: ${cls.shapeOpt.l} / ${cls.eyeOpt.l} / ${cls.noseOpt.l} / ${cls.mouthOpt.l}`);
console.log(`[p15_premium_skew] total=${total} pass=${pass} fail=${total - pass}${fails.length ? ' · FAIL ' + fails.join(',') : ''}`);
process.exitCode = fails.length ? 1 : 0;
