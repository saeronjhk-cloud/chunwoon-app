// ============================================================
//  P-17 · 참조표 실사진 앵커 평가 — v794 P-793-C
//  node _v792_work/p17_real_anchor_eval.js
// ------------------------------------------------------------
//  ★Eval-First. 결함(09-30 제이 셀카 + 평가셋 23장 실측): v792 는 MediaPipe 3D 표준 얼굴(canonical_face_model)을
//    참조표 중심으로 잡았는데, ★실사진 검출 좌표는 3D 모형과 배치가 다르다(광대 끝 234/454 가 3D 에선 더 바깥
//    → 실사진은 얼굴폭이 좁게 잡혀 폭 분모 비율이 전부 커진다. 코너비 표준 23.3% vs 실사진 중앙 30.4%).
//    ⟹ 실사진 23장 중 과반이 참조표 양 끝(랭크<0.1·>0.9)에 놓이는 축이 10개(눈 크기·코 너비 23/23 …).
//    AI 해석이 「코 상위 1% · 눈 상위 4% · 입 상위 4%」처럼 모든 부위를 극단으로 말했다.
//  기준: 실사진(평가셋 23장, 머리선 포함)의 REL 축마다 ① 중앙 랭크 ∈ [0.3,0.7] ② 양 끝 개수 ≤ 이항(n, 0.2) 99% 분위.
//   ★②는 v794 작성 중 30% 고정값에서 바꿨다: 참조표가 완벽해도 양 끝(10%+10%) 개수는 이항(n,0.2)을 따르므로
//     n=23 에선 7개(30%) 이상이 21% 확률로 나온다 — 23축이면 우연만으로 여러 축이 걸린다(통계 설계 오류).
//     99% 분위(n=23 → 10개, 43%)는 수리 전 값(23/23·21/23·18/23 …)을 여전히 전부 잡는다.
//  평가셋: D:\ChunWoon_IP\face\eval_hairline\cache (git 밖)
// ============================================================
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const ROOT = path.join(__dirname, '..'), EV = path.join(ROOT, '..', 'ChunWoon_IP', 'face', 'eval_hairline');
const STUB = "const FACE_S=[{l:'a',v:'round'},{l:'b',v:'square'},{l:'c',v:'long'},{l:'d',v:'inv'}];const FACE_E=[{l:'a',v:'big'},{l:'b',v:'narrow'},{l:'c',v:'round'},{l:'d',v:'droopy'}];const FACE_N=[{l:'a',v:'high'},{l:'b',v:'wide'},{l:'c',v:'small'},{l:'d',v:'hooked'}];const FACE_M=[{l:'a',v:'big'},{l:'b',v:'small'},{l:'c',v:'thick'},{l:'d',v:'thin'}];";
const idx = fs.readFileSync(process.env.P17_INDEX || path.join(ROOT, 'index.html'), 'utf8');   // 수리 전 비교용: P17_INDEX=<HEAD 사본>
const i0 = idx.indexOf('var CW_FACE_REF'), i1 = idx.indexOf('//  5b. PAL', i0);
const M = { exports: {} };
new Function('module', 'exports', 'window', STUB + idx.slice(i0, idx.lastIndexOf('// ====', i1)) +
  '\nmodule.exports={_cwFaceMeasure,_cwRank,_cwHairline,CW_FACE_REF,CW_FACE_AXES,CW_FACE_AXIS_KIND,classifyFaceFromLandmarks};')(M, M.exports, undefined);
const C = M.exports;
let total = 0, pass = 0; const fails = [];
function check(id, name, ok, detail) { total++; if (ok) pass++; else fails.push(id); console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${id} ${name} — ${detail}`); }
const L = JSON.parse(fs.readFileSync(path.join(EV, 'cache', 'landmarks.json'), 'utf8'));
const REL = C.CW_FACE_AXES.filter(k => C.CW_FACE_AXIS_KIND[k] === 'REL');
const R = {}, cls = { s: {}, e: {}, n: {}, m: {} };
for (const k of Object.keys(L).sort()) {
  const d = L[k], ai = d.lm.map(a => ({ x: a[0], y: a[1], z: a[2] }));
  const mask = zlib.gunzipSync(fs.readFileSync(path.join(EV, 'cache', k + '.mask.gz')));
  const hr = C._cwHairline(mask, d.w, d.h, ai);
  const m = C._cwFaceMeasure(ai, d.h / d.w, hr);
  for (const a of REL) if (m[a] != null) (R[a] = R[a] || []).push(C._cwRank(m[a], C.CW_FACE_REF.q[a]));
  const c = C.classifyFaceFromLandmarks(ai, d.h / d.w, hr);
  for (const [t, o] of [['s', c.shapeOpt], ['e', c.eyeOpt], ['n', c.noseOpt], ['m', c.mouthOpt]]) cls[t][o.v] = (cls[t][o.v] || 0) + 1;
}
function binomQ(n, p, q) { let c = 0, k = 0, b = Math.pow(1 - p, n); for (k = 0; k <= n; k++) { c += b; if (c >= q) return k; b = b * (n - k) / (k + 1) * p / (1 - p); } return n; }
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
console.log('[R] 실사진 23장 — REL 축 랭크 분포');
let n = 0;
for (const a of REL) {
  const r = R[a] || []; if (r.length < 8) { console.log(`  INFO ${a} 표본 ${r.length} (머리선 필요 축 · 판정 제외)`); continue; }
  const md = med(r), exN = r.filter(x => x < 0.1 || x > 0.9).length, lim = binomQ(r.length, 0.2, 0.99);
  check('R' + (++n), `${a} 중앙 ∈[0.3,0.7] · 양끝 ≤ ${lim}/${r.length}`, md >= 0.3 && md <= 0.7 && exN <= lim, `중앙 ${md.toFixed(2)} · 양끝 ${exN}/${r.length}`);
}
console.log('  INFO 무료 분류 분포(실사진 23장):', JSON.stringify(cls));
console.log(`[p17_real_anchor] total=${total} pass=${pass} fail=${total - pass}${fails.length ? ' · FAIL ' + fails.join(',') : ''}`);
process.exitCode = fails.length ? 1 : 0;
