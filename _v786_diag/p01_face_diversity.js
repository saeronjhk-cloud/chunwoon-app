// ============================================================
//  P-01 · 관상 분류 다양성 실측
//  사용: node _v786_diag/p01_face_diversity.js [--n 20000]
// ============================================================
const { classifyFaceFromLandmarks } = require('./classifier_asis.js');
const { sampleParams, makeLandmarks, mulberry32 } = require('./synth_face.js');

const argv = process.argv.slice(2);
const argN = argv.indexOf('--n');
const N = argN >= 0 ? parseInt(argv[argN + 1], 10) : 20000;

// FACE_R.shape 점수 (index.html:1082)
const SHAPE_SCORE = { round: 86, square: 82, long: 80, inv: 84 };

function tally(arr) {
  const m = new Map();
  for (const v of arr) m.set(v, (m.get(v) || 0) + 1);
  return m;
}
function stats(arr) {
  const m = tally(arr), n = arr.length;
  let H = 0;
  for (const c of m.values()) { const p = c / n; H -= p * Math.log2(p); }
  const ent = [...m.entries()].sort((a, b) => b[1] - a[1]);
  return { uniq: m.size, top1: ent[0][1] / n, top1v: ent[0][0], H, dist: ent };
}
function numStats(arr) {
  const s = [...arr].sort((a, b) => a - b), n = s.length;
  const mean = s.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  const q = f => s[Math.min(n - 1, Math.floor(f * n))];
  return { min: s[0], p05: q(.05), p25: q(.25), med: q(.5), p75: q(.75), p95: q(.95), max: s[n - 1], mean, sd };
}
const pct = x => (x * 100).toFixed(2) + '%';

function run(cv, A, n, seed) {
  const rnd = mulberry32(seed);
  const out = { shape: [], eyes: [], nose: [], mouth: [], combo: [], score: [], shapeScore: [], eyeScore: [], noseScore: [], mouthScore: [], sym: [], thirds: [], golden: [], whR: [], jawR: [], eyeR: [], mouthR: [], noseWR: [], eyeSizeR: [], tipToAlar: [] };
  for (let i = 0; i < n; i++) {
    const p = sampleParams(rnd, cv);
    const L = makeLandmarks(p, A);
    const c = classifyFaceFromLandmarks(L);
    out.shape.push(c.shapeOpt.v); out.eyes.push(c.eyeOpt.v);
    out.nose.push(c.noseOpt.v); out.mouth.push(c.mouthOpt.v);
    out.combo.push([c.shapeOpt.v, c.eyeOpt.v, c.noseOpt.v, c.mouthOpt.v].join('/'));
    out.score.push(c.overallScore);
    out.shapeScore.push(SHAPE_SCORE[c.shapeOpt.v]);
    out.eyeScore.push(c.eyeScore); out.noseScore.push(c.noseScore); out.mouthScore.push(c.mouthScore);
    const r = c.ratios;
    out.sym.push(r.symmetry); out.thirds.push(r.thirdsScore); out.golden.push(r.goldenProximity);
    out.whR.push(r.whRatio); out.jawR.push(r.jawRatio); out.eyeR.push(r.eyeRatio);
    out.mouthR.push(r.mouthFaceRatio); out.noseWR.push(r.noseWRatio); out.eyeSizeR.push(r.eyeSizeRatio);
    out.tipToAlar.push(L[1].y - L[2].y);
  }
  return out;
}

console.log('='.repeat(78));
console.log('P-01  관상 분류 다양성 실측   N=' + N + ' /조건');
console.log('='.repeat(78));

// ── 1) 기준 조건: 정사각 사진(A=1.0), CV=8% ──
console.log('\n[1] 기준 조건  (사진 종횡비 A=1.0 정사각, CV=8%)');
const base = run(0.08, 1.0, N, 12345);
for (const axis of ['shape', 'eyes', 'nose', 'mouth']) {
  const s = stats(base[axis]);
  const Hmax = Math.log2(4);
  console.log(`  ${axis.padEnd(6)} 도달버킷 ${s.uniq}/4  top1=${s.top1v}(${pct(s.top1)})  H/Hmax=${(s.H / Hmax).toFixed(3)}`);
  console.log('         ' + s.dist.map(([k, c]) => `${k}:${pct(c / N)}`).join('  '));
}
const cs = stats(base.combo);
console.log(`  4축조합 고유 ${cs.uniq}/256  top1=${cs.top1v}(${pct(cs.top1)})  H/Hmax=${(cs.H / Math.log2(256)).toFixed(3)}`);
console.log(`  ⟹ 두 사용자가 4축 전부 같을 확률 = ${pct(cs.dist.reduce((a, [, c]) => a + (c / N) ** 2, 0))}`);

console.log('\n[2] 점수 분포');
for (const k of ['score', 'shapeScore', 'eyeScore', 'noseScore', 'mouthScore']) {
  const s = numStats(base[k]); const t = stats(base[k]);
  console.log(`  ${k.padEnd(11)} 범위 ${s.min}~${s.max}  중앙 ${s.med}  SD ${s.sd.toFixed(2)}  p05~p95 ${s.p05}~${s.p95}  고유값 ${t.uniq}  top1=${t.top1v}(${pct(t.top1)})`);
}
console.log('  overallScore 산식 = 60 + sym*15 + thirds*12 + golden*10 → 이론범위 60~97, clamp[65,99]');
for (const k of ['sym', 'thirds', 'golden']) {
  const s = numStats(base[k]);
  console.log(`    ${k.padEnd(7)} 중앙 ${s.med.toFixed(4)}  p05~p95 ${s.p05.toFixed(4)}~${s.p95.toFixed(4)}  SD ${s.sd.toFixed(4)}`);
}

console.log('\n[3] 분기 변수 실측 분포 (임계 대비)');
const TH = {
  whR: '임계 0.85(wide) / 0.68(long)', jawR: '임계 0.88, 0.85(square)',
  eyeR: '임계 4.0(narrow) / 3.0(round)', eyeSizeR: '임계 0.055(big)',
  noseWR: '임계 0.30(wide) / 0.20(small)', mouthR: '임계 1.3(big) / 0.95(small) / 1.1',
  tipToAlar: '임계 0.015(hooked)'
};
for (const k of Object.keys(TH)) {
  const s = numStats(base[k]);
  console.log(`  ${k.padEnd(10)} p05 ${s.p05.toFixed(4)} | 중앙 ${s.med.toFixed(4)} | p95 ${s.p95.toFixed(4)}   ${TH[k]}`);
}

// ── 4) CV 민감도 sweep ──
console.log('\n[4] CV 민감도 sweep (A=1.0) — 분산을 키워도 붕괴가 유지되는가');
console.log('  CV      shape top1            eyes top1           nose top1           mouth top1          score SD  4축조합');
for (const cv of [0.03, 0.05, 0.08, 0.12, 0.18, 0.25]) {
  const r = run(cv, 1.0, Math.min(N, 8000), 777);
  const f = a => { const s = stats(a); return `${s.top1v}:${pct(s.top1)}`.padEnd(19); };
  const sc = numStats(r.score);
  console.log(`  ${(cv * 100).toFixed(0).padStart(3)}%   ${f(r.shape)} ${f(r.eyes)} ${f(r.nose)} ${f(r.mouth)} ${sc.sd.toFixed(2).padStart(6)}   ${stats(r.combo).uniq}/256`);
}

// ── 5) 사진 종횡비 sweep ──
console.log('\n[5] 사진 종횡비 sweep (CV=8%) — 같은 얼굴 분포, 사진 비율만 변경');
console.log('  A=H/W  대표사진          shape 분포                                       eyes 분포');
const RATIOS = [[0.75, '가로 4:3'], [1.0, '정사각 1:1'], [1.333, '세로 3:4'], [1.5, '세로 2:3'], [1.778, '세로 9:16']];
for (const [A, label] of RATIOS) {
  const r = run(0.08, A, Math.min(N, 8000), 999);
  const sh = stats(r.shape), ey = stats(r.eyes);
  const d = s => s.dist.map(([k, c]) => `${k}:${(c / s.dist.reduce((a, b) => a + b[1], 0) * 100).toFixed(0)}%`).join(' ').padEnd(46);
  console.log(`  ${A.toFixed(3)}  ${label.padEnd(10)} ${d(sh)} ${d(ey)}`);
}

// ── 6) 도달 불가 분기 검증 ──
console.log('\n[6] 도달 불가(dead) 분기 실측 — 전 조건 통합 (CV 3~25% × 종횡비 5종)');
const reach = { shape: new Set(), eyes: new Set(), nose: new Set(), mouth: new Set() };
let hookedHit = 0, invHit = 0, tot = 0;
for (const cv of [0.03, 0.08, 0.15, 0.25]) for (const [A] of RATIOS) {
  const r = run(cv, A, 3000, 4242);
  r.shape.forEach(v => reach.shape.add(v)); r.eyes.forEach(v => reach.eyes.add(v));
  r.nose.forEach(v => reach.nose.add(v)); r.mouth.forEach(v => reach.mouth.add(v));
  hookedHit += r.nose.filter(v => v === 'hooked').length;
  invHit += r.shape.filter(v => v === 'inv').length;
  tot += r.shape.length;
}
console.log(`  전 조건 표본 ${tot}건`);
console.log(`  shape 도달: ${[...reach.shape].join(',')}   (전체 4종 중)`);
console.log(`  eyes  도달: ${[...reach.eyes].join(',')}`);
console.log(`  nose  도달: ${[...reach.nose].join(',')}`);
console.log(`  mouth 도달: ${[...reach.mouth].join(',')}`);
console.log(`  '매부리코'(hooked) 발생 ${hookedHit}건, '역삼각형'(inv) 발생 ${invHit}건`);
console.log('  ※ hooked 는 V2(canonical LM1/LM2 좌표)에 의해 수학적으로 도달 불가.');
console.log('  ※ inv 는 V1(FACE_OVAL 순서: 21/251 이 127/356 보다 위)에 의해 볼록윤곽에서 도달 불가.');
