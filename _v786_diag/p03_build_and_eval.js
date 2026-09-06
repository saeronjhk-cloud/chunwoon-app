// ============================================================
//  P-03 · face_core_v786.js 참조분위수 주입 + 최종 전/후 평가
//  node _v786_diag/p03_build_and_eval.js
//  산출: face_core_v786.built.js (index.html 삽입용)
// ============================================================
const fs = require('fs'), path = require('path');
const { classifyFaceFromLandmarks: asis } = require('./classifier_asis.js');
const { sampleParams, makeLandmarks, mulberry32 } = require('./synth_face.js');

const SRC = fs.readFileSync(path.join(__dirname, 'face_core_v786.js'), 'utf8');
const STUB = `
const FACE_S=[{l:'둥근형',v:'round'},{l:'각진형',v:'square'},{l:'긴 형',v:'long'},{l:'역삼각형',v:'inv'}];
const FACE_E=[{l:'큰 눈',v:'big'},{l:'가늘고 긴 눈',v:'narrow'},{l:'둥근 눈',v:'round'},{l:'처진 눈',v:'droopy'}];
const FACE_N=[{l:'높고 오똑한 코',v:'high'},{l:'넓고 둥근 코',v:'wide'},{l:'작고 낮은 코',v:'small'},{l:'매부리코',v:'hooked'}];
const FACE_M=[{l:'큰 입',v:'big'},{l:'작은 입',v:'small'},{l:'두꺼운 입술',v:'thick'},{l:'얇은 입술',v:'thin'}];
`;
function load(refJson) {
  const code = STUB + SRC.replace('__REF__', refJson) +
    '\nmodule.exports={classifyFaceFromLandmarks,_cwFaceMeasure,CW_FACE_AXES};';
  const M = { exports: {} };
  new Function('module', 'exports', 'window', code)(M, M.exports, undefined);
  return M.exports;
}

const RATIOS = [0.75, 1.0, 1.333, 1.5, 1.778];
const CVS = [0.05, 0.08, 0.12];
const pct = x => (x * 100).toFixed(2) + '%';
function stats(a) {
  const m = new Map(); for (const v of a) m.set(v, (m.get(v) || 0) + 1);
  const n = a.length; let H = 0; for (const c of m.values()) { const p = c / n; H -= p * Math.log2(p); }
  const e = [...m.entries()].sort((x, y) => y[1] - x[1]);
  return { uniq: m.size, top1: e[0][1] / n, top1v: e[0][0], H, coll: e.reduce((s, [, c]) => s + (c / n) ** 2, 0), dist: e };
}
function quant(a, k) { const s = [...a].sort((x, y) => x - y), o = []; for (let i = 0; i <= k; i++) o.push(s[Math.min(s.length - 1, Math.round(i / k * (s.length - 1)))]); return o; }

// ── 1) 캘리브레이션 ──
const tmp = load('{"version":"tmp","tier":"tmp","q":{}}');
const CAL = 60000, rndC = mulberry32(20260904);
const rows = [];
for (let i = 0; i < CAL; i++) {
  const cv = CVS[i % CVS.length], A = RATIOS[(i / CVS.length | 0) % RATIOS.length];
  rows.push(tmp._cwFaceMeasure(makeLandmarks(sampleParams(rndC, cv), A), A));
}
const REF = { version: 'REF-SYNTH-v786-20260904', tier: 'C-SYNTHETIC', n: CAL, q: {} };
for (const k of tmp.CW_FACE_AXES) REF.q[k] = quant(rows.map(r => r[k]), 20).map(v => +v.toFixed(6));
const built = SRC.replace('__REF__', JSON.stringify(REF));
fs.writeFileSync(path.join(__dirname, 'face_core_v786.built.js'), built);
console.log(`[1] 캘리브레이션 ${CAL}건 · ${tmp.CW_FACE_AXES.length}축 → face_core_v786.built.js (${(built.length / 1024).toFixed(1)}KB)`);

// ── 2) 평가 ──
const V2 = load(JSON.stringify(REF));
const N = 20000, rnd = mulberry32(90210);
const A_ = { shape: [], eyes: [], nose: [], mouth: [], combo: [], score: [] };
const B_ = { shape: [], eyes: [], nose: [], mouth: [], combo: [], score: [], sig: [] };
for (let i = 0; i < N; i++) {
  const cv = CVS[i % CVS.length], A = RATIOS[(i / CVS.length | 0) % RATIOS.length];
  const L = makeLandmarks(sampleParams(rnd, cv), A);
  const a = asis(L);
  A_.shape.push(a.shapeOpt.v); A_.eyes.push(a.eyeOpt.v); A_.nose.push(a.noseOpt.v); A_.mouth.push(a.mouthOpt.v);
  A_.combo.push([a.shapeOpt.v, a.eyeOpt.v, a.noseOpt.v, a.mouthOpt.v].join('/')); A_.score.push(a.overallScore);
  const b = V2.classifyFaceFromLandmarks(L, A);
  (B_.harm = B_.harm || []).push(b.harmonyScore);
  (B_.dsig = B_.dsig || []).push(b.distinctAxes.map(d => d.axis + (d.rank > .5 ? '+' : '-')).join(','));
  (B_.wux = B_.wux || []).push(b.wuxingTop);
  B_.shape.push(b.shapeOpt.v); B_.eyes.push(b.eyeOpt.v); B_.nose.push(b.noseOpt.v); B_.mouth.push(b.mouthOpt.v);
  B_.combo.push([b.shapeOpt.v, b.eyeOpt.v, b.noseOpt.v, b.mouthOpt.v].join('/'));
  B_.score.push(b.overallScore); B_.sig.push(b.signature);
}
console.log(`\n[2] 평가 ${N}건 (CV 5/8/12% × 사진비 0.75~1.778, 캘리브와 독립 시드)`);
console.log('\n  축     | 현행                                    | v786');
console.log('  -------+-----------------------------------------+----------------------------------------');
for (const ax of ['shape', 'eyes', 'nose', 'mouth']) {
  const a = stats(A_[ax]), b = stats(B_[ax]);
  const f = s => s.dist.map(([k, c]) => `${k}:${(c / N * 100).toFixed(1)}`).join(' ').padEnd(40);
  console.log(`  ${ax.padEnd(6)} | ${f(a)}| ${f(b)}`);
}
const ca = stats(A_.combo), cb = stats(B_.combo), cs = stats(B_.sig);
console.log('\n  4축 조합 (사용자가 화면에서 비교하게 되는 라벨 4개)');
console.log(`    현행 : 고유 ${String(ca.uniq).padStart(5)}종  top1 ${pct(ca.top1).padStart(7)}  H ${ca.H.toFixed(2)}bit  ★두 사용자 4축 전부 동일 ${pct(ca.coll)}`);
console.log(`    v786 : 고유 ${String(cb.uniq).padStart(5)}종  top1 ${pct(cb.top1).padStart(7)}  H ${cb.H.toFixed(2)}bit  ★두 사용자 4축 전부 동일 ${pct(cb.coll)}`);
console.log(`    v786 24축 시그니처: 고유 ${cs.uniq}종  top1 ${pct(cs.top1)}  H ${cs.H.toFixed(2)}bit  동일확률 ${pct(cs.coll)}`);

console.log('\n[3] 종합점수');
for (const [nm, arr] of [['현행', A_.score], ['v786', B_.score]]) {
  const s = [...arr].sort((x, y) => x - y), mean = s.reduce((a, b) => a + b, 0) / s.length;
  const sd = Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / s.length), q = f => s[Math.floor(f * (s.length - 1))];
  const st = stats(arr);
  console.log(`    ${nm}: ${s[0]}~${s[s.length - 1]}  p05~p95 ${q(.05)}~${q(.95)}  SD ${sd.toFixed(2)}  고유값 ${st.uniq}  최빈 ${st.top1v}(${pct(st.top1)})`);
}

console.log('\n[3b] ★축 분리 — 조화도(ABS·절대) vs 특징(REL·상대)');
{
  const h=[...B_.harm].sort((a,b)=>a-b), mean=h.reduce((a,b)=>a+b,0)/h.length;
  const sd=Math.sqrt(h.reduce((a,b)=>a+(b-mean)**2,0)/h.length), q=f=>h[Math.floor(f*(h.length-1))];
  const st=stats(B_.harm), ds=stats(B_.dsig);
  console.log(`    조화도(和·ABS): ${h[0]}~${h[h.length-1]}  p05~p95 ${q(.05)}~${q(.95)}  SD ${sd.toFixed(2)}  최빈 ${st.top1v}(${pct(st.top1)})`);
  console.log('      ⟹ 좁은 것이 정상입니다. 「三停均等」은 순위가 아니라 상태이므로 억지로 벌리면 그게 왜곡입니다.');
  console.log(`    특징(格·REL) 상위5축 조합: 고유 ${ds.uniq}종  top1 ${pct(ds.top1)}  H ${ds.H.toFixed(2)}bit  두 사용자 동일 ${pct(ds.coll)}`);
  console.log('      ⟹ 사람을 구분하는 일은 이쪽이 맡습니다.');
}

console.log('\n[3c] ★五形 부합도 (★단일 확정이 아니라 최고 부합 오행의 분포)');
{
  const w=stats(B_.wux);
  console.log('    ' + w.dist.map(([k,c])=>`${k}:${(c/N*100).toFixed(1)}%`).join('  '));
  console.log(`    고유 ${w.uniq}/4  (土 는 센서 부재로 판정 불가 — 후보에서 제외)  H ${w.H.toFixed(2)}bit`);
  console.log('      ★원문은 五形마다 색·몸통·살뼈·거동을 함께 본다. 우리가 잰 것은 형태 하나뿐이다.');
}

console.log('\n[4] 사진 종횡비 불변성 (같은 얼굴, 사진 비율만 5종 변경 시 4축 판정 유지율)');
const r2 = mulberry32(31337); let ka = 0, kb = 0, M = 5000;
for (let i = 0; i < M; i++) {
  const p = sampleParams(r2, 0.08), sa = new Set(), sb = new Set();
  for (const A of RATIOS) {
    const L = makeLandmarks(p, A);
    const a = asis(L); sa.add([a.shapeOpt.v, a.eyeOpt.v, a.noseOpt.v, a.mouthOpt.v].join('/'));
    const b = V2.classifyFaceFromLandmarks(L, A); sb.add([b.shapeOpt.v, b.eyeOpt.v, b.noseOpt.v, b.mouthOpt.v].join('/'));
  }
  if (sa.size === 1) ka++; if (sb.size === 1) kb++;
}
console.log(`    현행 ${pct(ka / M)}   v786 ${pct(kb / M)}   (표본 ${M}명)`);

console.log('\n[5] 도달 불가 분기 해소 여부');
for (const ax of ['shape', 'eyes', 'nose', 'mouth']) {
  const a = new Set(A_[ax]), b = new Set(B_[ax]);
  console.log(`    ${ax.padEnd(6)} 현행 ${a.size}/4 [${[...a].join(',')}]   →   v786 ${b.size}/4 [${[...b].join(',')}]`);
}
