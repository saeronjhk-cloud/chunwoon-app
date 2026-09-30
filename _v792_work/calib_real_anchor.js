// ============================================================
//  v794 P-793-C — 합성 생성기 실사진 앵커 보정 (fixture 생성)
//  node _v792_work/calib_real_anchor.js  → _v792_work/fixtures/real_anchor_v1.json
//  ① 평균 얼굴: 평가셋 실사진 23장 랜드마크를 등방화(y×A) → 234↔454 중점 원점 · 152→10 을 세로축으로 회전 ·
//     234↔454 폭=1 로 스케일 · (10,152) 세로 중점 = 0 → 좌우 대칭화(canonical 로 구한 거울 짝) → 평균
//  ② 산포: 합성 모집단의 축별 표준편차를 실사진 23장의 강건 표준편차(MAD×1.4826)에 맞춰 REL/ABS 를 3회 반복 보정
//  입력: D:\ChunWoon_IP\face\eval_hairline\cache (git 밖) · 출력 fixture 는 평균값·배수만 담는다(개인 식별 불가)
// ============================================================
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const ROOT = path.join(__dirname, '..'), EV = path.join(ROOT, '..', 'ChunWoon_IP', 'face', 'eval_hairline');
const OUT = path.join(__dirname, 'fixtures', 'real_anchor_v1.json');
const LMS = JSON.parse(fs.readFileSync(path.join(EV, 'cache', 'landmarks.json'), 'utf8'));
const keys = Object.keys(LMS).sort();
// 거울 짝 (canonical 기하에서)
const V = fs.readFileSync(path.join(ROOT, '_v789_work', 'fixtures', 'canonical_face_model.obj'), 'utf8').split('\n').filter(l => l.startsWith('v ')).map(l => l.split(/\s+/).slice(1, 4).map(Number));
const MIR = V.map((v, i) => { let b = i, d = 1e9; V.forEach((w, j) => { const e = Math.hypot(w[0] + v[0], w[1] - v[1], w[2] - v[2]); if (e < d) { d = e; b = j; } }); return b; });
function norm(d) {
  const A = d.h / d.w, P = d.lm.map(([x, y, z]) => [x, y * A, z]);
  const cx = (P[234][0] + P[454][0]) / 2, cy = (P[234][1] + P[454][1]) / 2;
  let ux = P[10][0] - P[152][0], uy = P[10][1] - P[152][1]; const un = Math.hypot(ux, uy); ux /= un; uy /= un;
  // 화면 좌표(+y 아래)에서 위쪽 벡터 u → (0,-1) 로 돌리는 회전
  const rot = ([x, y, z]) => { const dx = x - cx, dy = y - cy; const a = dx * (-uy) + dy * ux; const b = -(dx * ux + dy * uy); return [a, b, z]; };
  const Q = P.map(rot);
  const W = Math.abs(Q[454][0] - Q[234][0]);
  const my = (Q[10][1] + Q[152][1]) / 2, mz = Q.reduce((s, q) => s + q[2], 0) / Q.length;
  return Q.map(([x, y, z]) => [x / W, (y - my) / W, (z - mz) / W]);
}
const N = keys.map(k => norm(LMS[k]));
const mean = V.map((_, i) => [0, 1, 2].map(c => N.reduce((s, q) => s + q[i][c], 0) / N.length));
const sym = mean.map((p, i) => { const m = mean[MIR[i]]; return i === MIR[i] ? [0, p[1], p[2]] : [(p[0] - m[0]) / 2, (p[1] + m[1]) / 2, (p[2] + m[2]) / 2]; });
// 세로 방향 검사 — 10 이 위(음수 y)
if (!(sym[10][1] < sym[152][1])) throw new Error('평균 얼굴 방향 오류');
const round = a => a.map(v => +v.toFixed(6));
// 머리선 높이(실측)
const STUB = "const FACE_S=[{l:'a',v:'round'}];const FACE_E=[{l:'a',v:'big'}];const FACE_N=[{l:'a',v:'high'}];const FACE_M=[{l:'a',v:'big'}];";
const SRC = fs.readFileSync(path.join(ROOT, '_v786_diag', 'face_core_v786.js'), 'utf8');
const Mo = { exports: {} };
new Function('module', 'exports', 'window', STUB + SRC.replace('__REF__', '{"version":"tmp","tier":"tmp","q":{}}') + '\nmodule.exports={_cwFaceMeasure,_cwHairline,CW_FACE_AXES,CW_FACE_AXIS_KIND};')(Mo, Mo.exports, undefined);
const C = Mo.exports;
const real = keys.map(k => { const d = LMS[k], ai = d.lm.map(a => ({ x: a[0], y: a[1], z: a[2] }));
  const hr = C._cwHairline(zlib.gunzipSync(fs.readFileSync(path.join(EV, 'cache', k + '.mask.gz'))), d.w, d.h, ai);
  return C._cwFaceMeasure(ai, d.h / d.w, hr); });
const hairRel = keys.map(k => { const d = LMS[k], ai = d.lm.map(a => ({ x: a[0], y: a[1] }));
  const hr = C._cwHairline(zlib.gunzipSync(fs.readFileSync(path.join(EV, 'cache', k + '.mask.gz'))), d.w, d.h, ai); return hr.status === 'OK' ? hr.rel : null; }).filter(v => v != null);
const medOf = a => { const s = [...a].sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
// ★산포는 표준편차(꼬리 포함) — 강건 MAD 는 양 끝 비율을 과소평가했다(p17 R1·R21 30% 초과)
const rsd = a => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) * (y - m), 0) / (a.length - 1)); };
fs.writeFileSync(OUT, JSON.stringify({ version: 'REAL-ANCHOR-v1', n: keys.length, meanFace: sym.map(round), hairUp: { mu: +medOf(hairRel).toFixed(4) } }));
// 산포 보정
const PARAM = { whRatio: ['whRatioPhys', 'upperR'], jawRatio: 'trueJawRatio', foreheadRatio: 'fhOverJaw', eyeAspect: 'eyeAspect', eyeSize: 'eyeW', noseWRatio: 'noseWRatio', noseHRatio: 'noseHRatio',
  mouthRatio: 'mouthOverIP', lipThickness: 'lipThick', myungGung: 'myungGungW', jaNyeo: 'underEyeR', jilAek: 'sanGeunW', jeonTaek: 'browEyeGap', browLength: 'browLenR',
  browAngle: 'browTiltR', browThick: 'browThickR', gwanGol: 'jawRatio' };
const ABSMAP = { eyeTilt: ['canthalTilt'], noseDorsum: ['noseDorsum', 'noseDorsumTail'], chin: ['mouthY'], midOverLow: ['browY'], upperOverRest: ['hairUp'] };
const rel = {}, abs = { mouthY: 0.01, browY: 0.01 };
const realSd = {}; for (const a of Object.keys(PARAM).concat(Object.keys(ABSMAP))) { const v = real.map(m => m[a]).filter(x => x != null); realSd[a] = rsd(v); }
let log = [];
for (let it = 0; it < 8; it++) {
  const cur = JSON.parse(fs.readFileSync(OUT, 'utf8')); cur.rel = rel; cur.abs = abs; fs.writeFileSync(OUT, JSON.stringify(cur));
  delete require.cache[require.resolve(path.join(ROOT, '_v786_diag', 'synth_face.js'))];
  const SY = require(path.join(ROOT, '_v786_diag', 'synth_face.js'));
  if (it === 0) { for (const [a, p] of Object.entries(PARAM)) for (const q of [].concat(p)) rel[q] = SY.REL[q]; Object.assign(abs, SY.ABS, { mouthY: abs.mouthY, browY: abs.browY }); }
  const rnd = SY.mulberry32(777 + it), CV = [0.05, 0.08, 0.12], rows = [];
  for (let i = 0; i < 4000; i++) { const L = SY.makeLandmarks(SY.sampleParams(rnd, CV[i % 3]), 1.25); rows.push(C._cwFaceMeasure(L, 1.25, L.__hair)); }
  const line = [];
  for (const [a, p] of Object.entries(PARAM)) { const s = rsd(rows.map(r => r[a])); const f = Math.max(0.5, Math.min(2, realSd[a] / (s || 1e-9))); for (const q of [].concat(p)) rel[q] = +(rel[q] * f).toFixed(4); line.push(`${a}:${f.toFixed(2)}`); }
  for (const [a, ps] of Object.entries(ABSMAP)) { const s = rsd(rows.map(r => r[a]).filter(x => x != null)); const f = Math.max(0.5, Math.min(2, realSd[a] / (s || 1e-9))); for (const p of ps) abs[p] = +(abs[p] * f).toFixed(5); line.push(`${a}:${f.toFixed(2)}`); }
  log.push(`it${it} ` + line.join(' '));
}
const cur = JSON.parse(fs.readFileSync(OUT, 'utf8')); cur.rel = rel; cur.abs = abs;
cur._desc = 'v794 P-793-C 실사진 앵커 — 평균 얼굴(n=23, 대칭화) + 산포 보정 REL/ABS. 생성: _v792_work/calib_real_anchor.js · 평가: p17';
cur._log = log;
fs.writeFileSync(OUT, JSON.stringify(cur));
console.log(log.join('\n')); console.log('hairUp mu', cur.hairUp.mu, '→', OUT, fs.statSync(OUT).size + 'B');
