// ============================================================
//  P-13 · 눈썹 계측축(browLength · browAngle) 평가 — v789 P-789-A/B
//  node _v789_work/p13_brow_axis_eval.js
// ------------------------------------------------------------
//  ★Eval-First: 수리 전에 작성·실행해 결함을 FAIL 로 확인한 뒤 수리한다.
//  고정 입력: MediaPipe canonical_face_model.obj (468 정점, Apache-2.0)
//    _v789_work/fixtures/canonical_face_model.obj · sha256 8bac8044…c0c54e618
//  결함(수리 전 실측)
//   A. browLength = LM53↔55 — 53 은 꼬리 끝이 아니다(하단 윤곽 46→53→52→65→55, 꼬리=46/276).
//      표준 얼굴에서 눈썹 길이/눈 폭 = 1.30 (꼬리 포함 1.56). OGWAN R020/R021(眉過眼) 이 乏財 쪽으로 기운다.
//   B. browAngle = atan2(dy, 음수 dx) — 좌우 반전 없는 사진에서 ±180° 근처, 꼬리가 머리보다
//      내려가면 +178 ↔ −178 로 뒤집힌다. 합성 참조표 −178.8~−166.7 · 사용자 화면 「기울기 −175°」.
// ============================================================
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const OBJ = path.join(__dirname, 'fixtures', 'canonical_face_model.obj');

const V = fs.readFileSync(OBJ, 'utf8').split('\n').filter(l => l.startsWith('v ')).map(l => l.split(/\s+/).slice(1, 4).map(Number));
if (V.length !== 468) throw new Error('canonical 468 정점 아님: ' + V.length);

// 모델좌표(+y 위) → MediaPipe 정규화 좌표(사진 폭·높이 각각 0..1, +y 아래). A = 사진높이/사진폭
function toImage(verts, A, mirror) {
  const S = 40;
  return verts.map(([x, y, z]) => {
    const xi = 0.5 + x / S;
    return { x: mirror ? 1 - xi : xi, y: 0.5 - y / (S * A), z: z / S };
  });
}
function shiftY(verts, ids, dy) { return verts.map((v, i) => ids.includes(i) ? [v[0], v[1] + dy, v[2]] : v); }

const STUB = "const FACE_S=[{l:'a',v:'round'},{l:'b',v:'square'},{l:'c',v:'long'},{l:'d',v:'inv'}];" +
  "const FACE_E=[{l:'a',v:'big'},{l:'b',v:'narrow'},{l:'c',v:'round'},{l:'d',v:'droopy'}];" +
  "const FACE_N=[{l:'a',v:'high'},{l:'b',v:'wide'},{l:'c',v:'small'},{l:'d',v:'hooked'}];" +
  "const FACE_M=[{l:'a',v:'big'},{l:'b',v:'small'},{l:'c',v:'thick'},{l:'d',v:'thin'}];";
function loadCore(code) {
  const M = { exports: {} };
  new Function('module', 'exports', 'window', STUB + code + '\nmodule.exports={_cwFaceMeasure,CW_FACE_REF};')(M, M.exports, undefined);
  return M.exports;
}
const builtTxt = fs.readFileSync(path.join(ROOT, '_v786_diag', 'face_core_v786.built.js'), 'utf8');
const CORE = loadCore(builtTxt);
const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const i0 = idx.indexOf('var CW_FACE_REF'), i1 = idx.indexOf('//  5b. PAL', i0);
const IDXCORE = loadCore(idx.slice(i0, idx.lastIndexOf('// ====', i1)));

const TAILS = [46, 276, 70, 300];              // 하단·상단 윤곽 꼬리 끝
const m = (verts, A, mir) => CORE._cwFaceMeasure(toImage(verts, A || 1.25, !!mir), A || 1.25);

let total = 0, pass = 0; const fails = [];
function check(id, name, ok, detail) { total++; if (ok) pass++; else fails.push(id); console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${id} ${name} — ${detail}`); }
const f = (x, d) => (typeof x === 'number' ? x.toFixed(d == null ? 3 : d) : String(x));

const c = m(V);
const ratio = c.browLength / c.eyeSize;
check('C1', '표준 얼굴 눈썹길이/눈폭 ∈ [1.45,1.70] (꼬리 포함 현 1.56)', ratio >= 1.45 && ratio <= 1.70, f(ratio));
check('C2', '표준 얼굴 browAngle ∈ [−10°,0°) (꼬리가 머리보다 0.26 낮다 → 약한 下向)', c.browAngle >= -10 && c.browAngle < 0, f(c.browAngle, 2) + '°');
const cm = m(V, 1.25, true);
check('C3', '좌우 반전 불변', Math.abs(cm.browAngle - c.browAngle) < 1e-6 && Math.abs(cm.browLength - c.browLength) < 1e-9, `angle ${f(c.browAngle, 2)} vs ${f(cm.browAngle, 2)}`);
const a1 = m(V, 1.0), a2 = m(V, 1.5);
check('C4', '사진 종횡비 불변(A=1.0 vs 1.5)', Math.abs(a1.browAngle - a2.browAngle) < 1e-6 && Math.abs(a1.browLength - a2.browLength) < 1e-9, `${f(a1.browAngle, 3)} vs ${f(a2.browAngle, 3)}`);
const up = m(shiftY(V, TAILS, +0.6)), dn = m(shiftY(V, TAILS, -0.6));
check('C5', '꼬리를 올리면(頭低尾高) 양수', up.browAngle > 0, f(up.browAngle, 2) + '°');
check('C6', '꼬리를 내리면(頭高尾低) 표준보다 작고 음수', dn.browAngle < c.browAngle && dn.browAngle < 0, f(dn.browAngle, 2) + '°');
let mono = true, maxStep = 0, prev = null; const seq = [];
for (let k = -10; k <= 10; k++) {
  const v = m(shiftY(V, TAILS, k * 0.1)).browAngle; seq.push(v);
  if (prev !== null) { if (v <= prev) mono = false; maxStep = Math.max(maxStep, Math.abs(v - prev)); }
  prev = v;
}
check('C7', '연속성 — 꼬리 −1.0~+1.0 이동 시 단조증가 · 최대 계단 < 3°', mono && maxStep < 3, `단조=${mono} 최대계단=${f(maxStep, 2)}° 범위 ${f(seq[0], 1)}~${f(seq[seq.length - 1], 1)}`);
const asym = m(shiftY(shiftY(V, [46, 70], +0.6), [276, 300], -0.6));
check('C8', '좌우 반대 기울기 → 평균이 0 근처(|x|<5°)', Math.abs(asym.browAngle) < 5, f(asym.browAngle, 2) + '°');
const qa = CORE.CW_FACE_REF.q.browAngle, ql = CORE.CW_FACE_REF.q.browLength;
check('C9', '참조표 browAngle 분위수 전부 [−30°,30°]', qa.every(x => x >= -30 && x <= 30), `${f(qa[0], 1)} … ${f(qa[qa.length - 1], 1)}`);
check('C10', '참조표 browLength 중앙값이 표준 얼굴 값의 ±15%', Math.abs(ql[10] / c.browLength - 1) <= 0.15, `중앙 ${f(ql[10], 4)} / 표준 ${f(c.browLength, 4)}`);
const ci = IDXCORE._cwFaceMeasure(toImage(V, 1.25, false), 1.25);
const diffK = Object.keys(c).filter(k => typeof c[k] === 'number' && Math.abs(c[k] - ci[k]) > 1e-12);
check('C11', 'index.html 내장 코어 == face_core built (표준 얼굴 전 축)', diffK.length === 0 && JSON.stringify(IDXCORE.CW_FACE_REF) === JSON.stringify(CORE.CW_FACE_REF), diffK.length ? '불일치 ' + diffK.join(',') : '전 축 일치 · REF 일치');
let headRef = null;
try { headRef = loadCore(cp.execSync('git show HEAD:_v786_diag/face_core_v786.built.js', { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 24 })).CW_FACE_REF; } catch (e) { headRef = null; }
const BROW = ['browLength', 'browAngle'];
const changed = headRef ? Object.keys(CORE.CW_FACE_REF.q).filter(k => JSON.stringify(CORE.CW_FACE_REF.q[k]) !== JSON.stringify(headRef.q[k])) : ['(HEAD 없음)'];
check('C12', '참조표 — 눈썹 2축 외 28축은 HEAD 와 동일(난수열 불변)', changed.every(k => BROW.includes(k)), '변경 축: ' + (changed.join(',') || '없음'));
check('C13', 'OGWAN R020 조건(browLength > eyeSize) — 표준 얼굴에서 참(眉過眼)', c.browLength > c.eyeSize, `${f(c.browLength, 4)} > ${f(c.eyeSize, 4)}`);


// ── C14 (v789 추가) 화면 보수관 해석 — 고정임계 0.18(구 축의 5퍼센타일)을 원문 비교 「眉長過目」(눈썹 > 눈 폭)으로 교체
{
  const has = idx.indexOf("interpretation:ra.browLengthRatio>(ra.eyeSize||1)?'눈썹이 길고") >= 0 && idx.indexOf('ra.browLengthRatio>=0.18') < 0;
  total++; if (has) pass++; else fails.push('C14');
  console.log(`  ${has ? 'ok  ' : 'FAIL'} C14 화면 보수관 해석이 눈썹길이 > 눈폭 비교를 쓴다(고정임계 0.18 제거) — ${has}`);
  console.log(`[p13_brow_axis] total=${total} pass=${pass} fail=${total - pass}${fails.length ? ' · FAIL ' + fails.join(',') : ''}`);
  process.exitCode = fails.length ? 1 : 0;
}
