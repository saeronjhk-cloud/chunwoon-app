// ============================================================
//  P-02 · 관상 분류기 v2 참조분위수 생성 + 패치 전/후 다양성 비교
//  node _v786_diag/p02_face_v2_eval.js [--n 20000]
// ============================================================
const fs = require('fs');
const path = require('path');
const { classifyFaceFromLandmarks } = require('./classifier_asis.js');
const { AXES, measure, classifyV2 } = require('./classifier_v2.js');
const { sampleParams, makeLandmarks, mulberry32 } = require('./synth_face.js');

const argv = process.argv.slice(2);
const iN = argv.indexOf('--n');
const N = iN >= 0 ? parseInt(argv[iN + 1], 10) : 20000;
const RATIOS = [0.75, 1.0, 1.333, 1.5, 1.778];   // 실사용 사진 종횡비
const CVS = [0.05, 0.08, 0.12];

function quantiles(arr, k) {
  const s = [...arr].sort((a, b) => a - b), out = [];
  for (let i = 0; i <= k; i++) out.push(s[Math.min(s.length - 1, Math.round(i / k * (s.length - 1)))]);
  return out;
}
function stats(arr) {
  const m = new Map();
  for (const v of arr) m.set(v, (m.get(v) || 0) + 1);
  const n = arr.length; let H = 0;
  for (const c of m.values()) { const p = c / n; H -= p * Math.log2(p); }
  const ent = [...m.entries()].sort((a, b) => b[1] - a[1]);
  const coll = ent.reduce((a, [, c]) => a + (c / n) ** 2, 0);
  return { uniq: m.size, top1: ent[0][1] / n, top1v: ent[0][0], H, collision: coll };
}
const pct = x => (x * 100).toFixed(2) + '%';

// ── 1) 참조분포 생성 (모든 CV × 종횡비 혼합 = 실사용 조건) ──
console.log('='.repeat(78));
console.log('P-02  관상 v2 — 참조분위수 생성 + 패치 전/후 비교');
console.log('='.repeat(78));

const rndR = mulberry32(20260903);
const refRows = [];
const CAL = 60000;
for (let i = 0; i < CAL; i++) {
  const cv = CVS[i % CVS.length];
  const A = RATIOS[(i / CVS.length | 0) % RATIOS.length];
  const p = sampleParams(rndR, cv);
  refRows.push(measure(makeLandmarks(p, A), A));
}
const REF = { version: 'REF-SYNTH-v786-2026-09-04', tier: 'C-SYNTHETIC', n: CAL, q: {} };
for (const [k] of AXES) REF.q[k] = quantiles(refRows.map(r => r[k]), 20);
const refPath = path.join(__dirname, 'face_ref_quantiles_v786.json');
fs.writeFileSync(refPath, JSON.stringify(REF, null, 1));
console.log(`\n[1] 참조분위수 생성: ${CAL}건 → ${AXES.length}축 × 21분위  → ${path.basename(refPath)}`);
console.log(`    tier=${REF.tier}  ★합성 유래이므로 실사진 캘리브레이션 전까지 TIER-C 입니다.`);

// ── 2) 평가 표본 (참조와 다른 시드) ──
function evalSet(n, seed) {
  const rnd = mulberry32(seed);
  const asis = { shape: [], eyes: [], nose: [], mouth: [], combo: [], score: [] };
  const v2 = { shape: [], eyes: [], nose: [], mouth: [], combo: [], score: [], sig: [] };
  for (let i = 0; i < n; i++) {
    const cv = CVS[i % CVS.length];
    const A = RATIOS[(i / CVS.length | 0) % RATIOS.length];
    const p = sampleParams(rnd, cv);
    const L = makeLandmarks(p, A);
    const a = classifyFaceFromLandmarks(L);   // 현행 (종횡비 보정 없음 = 실제 앱 동작)
    asis.shape.push(a.shapeOpt.v); asis.eyes.push(a.eyeOpt.v);
    asis.nose.push(a.noseOpt.v); asis.mouth.push(a.mouthOpt.v);
    asis.combo.push([a.shapeOpt.v, a.eyeOpt.v, a.noseOpt.v, a.mouthOpt.v].join('/'));
    asis.score.push(a.overallScore);
    const b = classifyV2(L, A, REF);
    v2.shape.push(b.shapeKey); v2.eyes.push(b.eyeKey);
    v2.nose.push(b.noseKey); v2.mouth.push(b.mouthKey);
    v2.combo.push([b.shapeKey, b.eyeKey, b.noseKey, b.mouthKey].join('/'));
    v2.score.push(b.overallScore); v2.sig.push(b.signature);
  }
  return { asis, v2 };
}
const E = evalSet(N, 777001);

console.log(`\n[2] 평가 표본 ${N}건 (CV 5/8/12% × 종횡비 0.75~1.778 혼합, 참조와 독립 시드)`);
console.log('\n  축      | 현행 도달/top1 점유              | v2 도달/top1 점유');
console.log('  --------+----------------------------------+----------------------------------');
for (const ax of ['shape', 'eyes', 'nose', 'mouth']) {
  const a = stats(E.asis[ax]), b = stats(E.v2[ax]);
  console.log(`  ${ax.padEnd(7)} | ${String(a.uniq).padStart(3)}종  ${a.top1v.padEnd(12)} ${pct(a.top1).padStart(7)} | ${String(b.uniq).padStart(3)}종  ${b.top1v.slice(0, 16).padEnd(17)} ${pct(b.top1).padStart(7)}`);
}
const ca = stats(E.asis.combo), cb = stats(E.v2.combo), cs = stats(E.v2.sig);
console.log('\n  4축 조합');
console.log(`    현행: 고유 ${ca.uniq}종  top1 ${pct(ca.top1)}  H=${ca.H.toFixed(2)}bit  두 사용자 동일확률 ${pct(ca.collision)}`);
console.log(`    v2  : 고유 ${cb.uniq}종  top1 ${pct(cb.top1)}  H=${cb.H.toFixed(2)}bit  두 사용자 동일확률 ${pct(cb.collision)}`);
console.log(`    v2 24축 시그니처: 고유 ${cs.uniq}종  top1 ${pct(cs.top1)}  H=${cs.H.toFixed(2)}bit  동일확률 ${pct(cs.collision)}`);

console.log('\n[3] 종합점수 분포');
for (const [nm, arr] of [['현행', E.asis.score], ['v2  ', E.v2.score]]) {
  const s = [...arr].sort((x, y) => x - y);
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  const sd = Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / s.length);
  const q = f => s[Math.floor(f * (s.length - 1))];
  const st = stats(arr);
  console.log(`    ${nm}: 범위 ${s[0]}~${s[s.length - 1]}  p05~p95 ${q(.05)}~${q(.95)}  SD ${sd.toFixed(2)}  고유값 ${st.uniq}  최빈 ${st.top1v}(${pct(st.top1)})`);
}

// ── 4) 종횡비 불변성 검증 ──
console.log('\n[4] 종횡비 불변성 — 같은 얼굴을 종횡비만 바꿔 촬영했을 때 판정이 유지되는가');
const rnd2 = mulberry32(555000);
let aSame = 0, bSame = 0, M = 4000;
for (let i = 0; i < M; i++) {
  const p = sampleParams(rnd2, 0.08);
  const outA = [], outB = [];
  for (const A of RATIOS) {
    const L = makeLandmarks(p, A);
    const a = classifyFaceFromLandmarks(L);
    outA.push([a.shapeOpt.v, a.eyeOpt.v, a.noseOpt.v, a.mouthOpt.v].join('/'));
    const b = classifyV2(L, A, REF);
    outB.push([b.shapeKey, b.eyeKey, b.noseKey, b.mouthKey].join('/'));
  }
  if (new Set(outA).size === 1) aSame++;
  if (new Set(outB).size === 1) bSame++;
}
console.log(`    같은 사람을 5가지 종횡비로 찍었을 때 4축 판정이 전부 동일한 비율`);
console.log(`      현행: ${pct(aSame / M)}   v2: ${pct(bSame / M)}   (표본 ${M}명)`);
console.log('\n' + '='.repeat(78));
