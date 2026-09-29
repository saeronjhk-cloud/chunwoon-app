// ============================================================
//  P-16 · 머리선(髮際) 검출 + 삼정(三停) 재정의 평가 — v792 P-792-A
//  node _v792_work/p16_hairline_thirds_eval.js
// ------------------------------------------------------------
//  ★Eval-First: 수리 전에 작성·실행해 FAIL 을 확인한 뒤 수리한다.
//  결함(09-29 실측): 삼정 대용이 10(메시 꼭대기)→168(콧부리)→1(코끝)→152 라 원문과 다르다.
//    표준 얼굴 28/25/47% · thirds 0.46 → 프리미엄 「삼정 편차」 문장 99.7%.
//  수리: 上停 = 머리선(머리카락 분할 hair_segmenter)→눈썹선 · 中停 = 눈썹선→코 밑(LM2) · 下停 = LM2→턱(152).
//        머리선이 가려지면(앞머리·모자·민머리) 上停 「계측 불가」, 中·下停 2분 균형으로 대체.
//  평가셋: D:\ChunWoon_IP\face\eval_hairline\ (★git 밖 · 사진 23장 · 캐시 = 랜드마크 + 머리카락 확률 마스크)
//    정답: hairline_gt.json (Claude 육안 표시 · M 13 / BANG 6 / HAT 2 / BALD 2)
// ============================================================
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const ROOT = path.join(__dirname, '..');
const EV = path.join(ROOT, '..', 'ChunWoon_IP', 'face', 'eval_hairline');
const STUB = "const FACE_S=[{l:'둥근형',v:'round'},{l:'각진형',v:'square'},{l:'긴 형',v:'long'},{l:'역삼각형',v:'inv'}];" +
  "const FACE_E=[{l:'큰 눈',v:'big'},{l:'가늘고 긴 눈',v:'narrow'},{l:'둥근 눈',v:'round'},{l:'처진 눈',v:'droopy'}];" +
  "const FACE_N=[{l:'높고 오똑한 코',v:'high'},{l:'넓고 둥근 코',v:'wide'},{l:'작고 낮은 코',v:'small'},{l:'매부리코',v:'hooked'}];" +
  "const FACE_M=[{l:'큰 입',v:'big'},{l:'작은 입',v:'small'},{l:'두꺼운 입술',v:'thick'},{l:'얇은 입술',v:'thin'}];";
const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const i0 = idx.indexOf('var CW_FACE_REF'), i1 = idx.indexOf('//  5b. PAL', i0);
const coreTxt = idx.slice(i0, idx.lastIndexOf('// ====', i1));
const p0 = idx.indexOf('function _generateClientPremium('), p1 = idx.indexOf('\nfunction renderPremiumReport', p0);
const M = { exports: {} };
new Function('module', 'exports', 'window', STUB + coreTxt + '\n' + idx.slice(p0, p1) +
  '\nmodule.exports={_cwFaceMeasure,_cwRank,CW_FACE_REF,_generateClientPremium,' +
  '_cwHairline:(typeof _cwHairline==="function"?_cwHairline:null)};')(M, M.exports, undefined);
const C = M.exports;
const SY = require(path.join(ROOT, '_v786_diag', 'synth_face.js'));

let total = 0, pass = 0; const fails = [];
function check(id, name, ok, detail) { total++; if (ok) pass++; else fails.push(id); console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${id} ${name} — ${detail}`); }
const f = (x, d) => (typeof x === 'number' ? x.toFixed(d == null ? 3 : d) : String(x));
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN; };

// ── H. 머리선 검출 (실사진 23장) ──
console.log('[H] 머리선 검출 — 실사진 평가셋');
const GT = JSON.parse(fs.readFileSync(path.join(EV, 'hairline_gt.json'), 'utf8')).gt;
const LMS = JSON.parse(fs.readFileSync(path.join(EV, 'cache', 'landmarks.json'), 'utf8'));
const res = {};
const hasFn = typeof C._cwHairline === 'function';
for (const k of Object.keys(GT).sort()) {
  const d = LMS[k], ai = d.lm.map(a => ({ x: a[0], y: a[1], z: a[2] }));
  const mask = zlib.gunzipSync(fs.readFileSync(path.join(EV, 'cache', k + '.mask.gz')));
  const hr = hasFn ? C._cwHairline(mask, d.w, d.h, ai) : { status: 'NONE', hairline: null };
  const m = C._cwFaceMeasure(ai, d.h / d.w, hr);
  res[k] = { g: GT[k], hr, m, d, ai };
}
const Ms = Object.keys(res).filter(k => res[k].g.cls === 'M');
const measured = Ms.filter(k => res[k].hr.status === 'OK');
check('H1', `계측 가능(M ${Ms.length}장) 중 머리선 검출 ≥ ${Ms.length - 2}`, measured.length >= Ms.length - 2, `${measured.length}/${Ms.length}`);
const errs = measured.map(k => { const r = res[k]; const span = r.ai[152].y * r.d.h - r.g.hair_y_px; return Math.abs(r.hr.hairline.y * r.d.h - r.g.hair_y_px) / span; });
const within = errs.filter(e => e <= 0.05).length;
check('H2', '머리선 오차 |Δy|/(머리선→턱) ≤ 0.05 가 80% 이상 · 중앙 ≤ 0.03', errs.length > 0 && within / errs.length >= 0.8 && med(errs) <= 0.03, `${within}/${errs.length} · 중앙 ${f(med(errs))}`);
const nh = Object.keys(res).filter(k => ['HAT', 'BALD'].includes(res[k].g.cls));
check('H3', `모자·민머리 ${nh.length}장 전부 「머리카락 없음」`, nh.every(k => res[k].hr.status === 'NO_HAIR'), nh.map(k => k + ':' + res[k].hr.status).join(' '));
const bg = Object.keys(res).filter(k => res[k].g.cls === 'BANG');
const bgU = bg.filter(k => res[k].hr.status !== 'OK');
check('H4', `앞머리 ${bg.length}장 중 계측 불가 판정 ≥ ${bg.length - 2}`, bgU.length >= bg.length - 2, `${bgU.length}/${bg.length} · 놓침 ${bg.filter(k => res[k].hr.status === 'OK').join(',') || '없음'}`);

// ── T. 삼정 재정의 ──
console.log('[T] 삼정 — 머리선→눈썹선→코 밑(2)→턱(152)');
const shares = measured.map(k => res[k].m).filter(m => m.thirdsParts === 3);
check('T1', '머리선 검출된 실사진은 3분 삼정(thirdsParts=3)', shares.length === measured.length && measured.length > 0, `${shares.length}/${measured.length}`);
const up = shares.map(m => m.upperThirdPct), mi = shares.map(m => m.middleThirdPct), lo = shares.map(m => m.lowerThirdPct);
check('T2', '실사진 상·중·하정 평균이 각각 [28,38]% (원문 三停均等에 근접)', shares.length > 0 && [up, mi, lo].every(a => { const v = a.reduce((x, y) => x + y, 0) / a.length; return v >= 28 && v <= 38; }),
  shares.length ? [up, mi, lo].map(a => f(a.reduce((x, y) => x + y, 0) / a.length, 1)).join(' / ') : '없음');
const sc = shares.map(m => m.thirds);
const bucket = s => s >= 0.9 ? '매우' : s >= 0.8 ? '대체로' : '편차';
const bc = {}; sc.forEach(s => bc[bucket(s)] = (bc[bucket(s)] || 0) + 1);
check('T3', '실사진 삼정 균형 문장 — 한 문장 ≤ 80%', sc.length > 0 && Math.max(...Object.values(bc)) / sc.length <= 0.8, JSON.stringify(bc));
const V = fs.readFileSync(path.join(ROOT, '_v789_work', 'fixtures', 'canonical_face_model.obj'), 'utf8').split('\n').filter(l => l.startsWith('v ')).map(l => l.split(/\s+/).slice(1, 4).map(Number));
const can = C._cwFaceMeasure(V.map(([x, y, z]) => ({ x: 0.5 + x / 40, y: 0.5 - y / 50, z: -z / 40 })), 1.25);
check('T4', '표준 얼굴(머리카락 없음) → 上停 계측 불가 · 2분 삼정', can.thirdsParts === 2 && can.upperThirdPct == null, `parts=${can.thirdsParts} upper=${can.upperThirdPct}`);
check('T5', '표준 얼굴 中停/下停 비 ∈ [0.85,1.15] · 2분 균형 ≥ 0.8 (구 0.46)', can.midOverLow >= 0.85 && can.midOverLow <= 1.15 && can.thirds >= 0.8, `mid/low ${f(can.midOverLow)} · thirds ${f(can.thirds)}`);
const nb = bg.map(k => res[k].m).filter(m => res[bg[0]] && m.thirdsParts === 2);
check('T6', '앞머리로 계측 불가인 사진은 2분 삼정 · 上停 null', bgU.every(k => res[k].m.thirdsParts === 2 && res[k].m.upperThirdPct == null), bgU.map(k => k + ':' + res[k].m.thirdsParts).join(' '));

// ── P. 프리미엄 삼정 문장 ──
console.log('[P] 프리미엄 삼정 칸');
const P3 = measured.length ? C._generateClientPremium(res[measured[0]].m, '').threeCourtAnalysis : null;
const P2 = C._generateClientPremium(can, '').threeCourtAnalysis;
check('P1', '上停 계측 불가 시 상정 칸이 「계측하지 못했」 안내', !!P2 && /계측하지 못했/.test(P2.upper.interpretation), P2 ? P2.upper.interpretation.slice(0, 30) : '-');
check('P2', '2분 삼정일 때 균형 문장에 「상정 제외」 표기', !!P2 && /상정 제외/.test(P2.balance), P2 ? P2.balance.slice(0, 24) : '-');
check('P3', '3분 삼정일 때 상정 칸은 해석 문장(계측 불가 아님)', !!P3 && !/계측하지 못했/.test(P3.upper.interpretation), P3 ? P3.upper.interpretation.slice(0, 20) : '-');
// 합성 모집단(머리선 포함) 칸별 쏠림
const RATIOS = [0.75, 1.0, 1.333, 1.5, 1.778], CVS = [0.05, 0.08, 0.12], N = 6000, rnd = SY.mulberry32(90210);
const cnt = { upper: new Map(), middle: new Map(), lower: new Map(), balance: new Map() };
for (let i = 0; i < N; i++) {
  const cv = CVS[i % 3], A = RATIOS[(i / 3 | 0) % 5];
  const L = SY.makeLandmarks(SY.sampleParams(rnd, cv), A);
  const T = C._generateClientPremium(C._cwFaceMeasure(L, A, L.__hair), '').threeCourtAnalysis;
  for (const s of ['upper', 'middle', 'lower']) cnt[s].set(T[s].interpretation, (cnt[s].get(T[s].interpretation) || 0) + 1);
  cnt.balance.set(T.balance, (cnt.balance.get(T.balance) || 0) + 1);
}
for (const s of ['upper', 'middle', 'lower']) {
  const t = Math.max(...cnt[s].values()) / N;
  check('P-' + s, `합성 모집단(머리선 포함) ${s} 칸 최다 문장 ≤ 90%`, t <= 0.9, `${f(t * 100, 1)}% · ${cnt[s].size}종`);
}
console.log(`  INFO 합성 균형(ABS) 최다 ${f(Math.max(...cnt.balance.values()) / N * 100, 1)}% · ${cnt.balance.size}종`);

// ── W. 운영 결속(정적) ──
console.log('[W] 운영 결속');
check('W1', 'index.html 이 hair_segmenter float32/1 과 tasks-vision 버전 고정 URL 을 쓴다', /hair_segmenter\/float32\/1\/hair_segmenter\.tflite/.test(idx) && /tasks-vision@0\.10\.14/.test(idx), '');
check('W2', '분석 전 머리선 측정(_cwEnsureHair)을 기다린 뒤 분류한다', /await _cwEnsureHair\(\)[\s\S]{0,400}classifyFaceFromLandmarks\(ai/.test(idx), '');
check('W3', '사진이 바뀌면 머리선 결과도 지운다(_cwResetAIFrame)', /function _cwResetAIFrame\(\)\{[^}]*hair/.test(idx), '');

console.log(`[p16_hairline_thirds] total=${total} pass=${pass} fail=${total - pass}${fails.length ? ' · FAIL ' + fails.join(',') : ''}`);
process.exitCode = fails.length ? 1 : 0;
