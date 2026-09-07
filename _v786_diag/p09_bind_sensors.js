// 천운 v787 · P-786-I — 센서 결속 빌드 + 결속 게이트  (p09_bind_sensors.js)
// ═══════════════════════════════════════════════════════════════════════════
// 【무엇을 하는가】
//   ① 빌드  : _v786_diag/sensor_{color,texture,flatten}.js (정본) → js/ 배포 사본.
//            ★사본은 IIFE 로 감싼다. 세 정본이 top-level `var AXES·DEFAULTS·YUKBU·_llog…` 를
//              같은 이름으로 선언하므로 <script> 로 그대로 실으면 **나중 파일이 앞 파일의 전역을
//              덮어쓴다**(color.measureColor 가 호출 시점에 texture 의 DEFAULTS 를 읽는다 — 실측 J-4).
//   ② 결속 게이트 : 「만들어 놓고 안 부르는 것」을 막는다 (p08 I 계열의 클라이언트판).
//            index.html 이 스크립트를 싣고 · 프레임을 보관하고 · 센서를 부르고 · 3경로에 싣고 ·
//            새 사진에서 초기화하는가를 소스에서 대조한다.
//   ③ 회귀  : 분석 중 발견한 기존 결함 2건(이전 사진 랜드마크 잔존 · 카메라 경로 aiAspect 미저장)이
//            되살아나지 않는가.
//   ④ e2e   : p06 의 합성 얼굴을 브라우저와 같은 순서(color→texture→flatten, IIFE 사본)로 실어
//            평탄화 축이 실제로 나오는가 · Node 정본과 같은 값인가.
//
// 【실행】 node _v786_diag/p09_bind_sensors.js          (빌드 + 검사)
//         node _v786_diag/p09_bind_sensors.js --check  (빌드 없이 검사만 — 사본 드리프트 검출)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const DIAG = __dirname;
const JS = path.join(ROOT, 'js');
const CHECK_ONLY = process.argv.indexOf('--check') !== -1;

const FILES = ['sensor_color.js', 'sensor_texture.js', 'sensor_flatten.js'];

let total = 0, pass = 0; const fails = [];
function check(id, desc, fn) {
  total++;
  let r;
  try { r = fn(); } catch (e) { r = { ok: false, detail: '예외: ' + (e && e.message) }; }
  if (r.ok) { pass++; console.log(`PASS ${id}  ${desc}${r.detail ? '  — ' + r.detail : ''}`); }
  else { fails.push(`${id} ${desc} — ${r.detail || ''}`); console.log(`FAIL ${id}  ${desc}  — ${r.detail || ''}`); }
}
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

// ── ① 빌드 ──────────────────────────────────────────────────────────────────
function wrap(name, src) {
  const h = sha(src);
  return `/* ★배포 사본 — 정본은 _v786_diag/${name} (sha256 ${h.slice(0, 16)}…). 직접 고치지 마라.
   _v786_diag/p09_bind_sensors.js 가 정본을 IIFE 로 감싸 생성한다. 이 파일을 고치면 p09 --check 가 드리프트로 FAIL 한다. */
(function () {
${src}
})();
`;
}
const built = {};
for (const f of FILES) {
  const src = fs.readFileSync(path.join(DIAG, f), 'utf8');
  built[f] = wrap(f, src);
  if (!CHECK_ONLY) fs.writeFileSync(path.join(JS, f), built[f]);
}
console.log((CHECK_ONLY ? '[check] ' : '[build] ') + FILES.map((f) => f + ' (' + built[f].length + 'B)').join(' · '));

// ── ② 사본 무결성 ────────────────────────────────────────────────────────────
check('J-1', '★js/ 사본 3건이 정본을 IIFE 로 감싼 것과 바이트 동일하다 (드리프트 0)', () => {
  const bad = [];
  for (const f of FILES) {
    const p = path.join(JS, f);
    if (!fs.existsSync(p)) { bad.push(f + ':없음'); continue; }
    if (fs.readFileSync(p, 'utf8') !== built[f]) bad.push(f + ':드리프트');
  }
  return { ok: bad.length === 0, detail: bad.join(',') || '3/3 동일' };
});
check('J-2', '★.vercelignore 가 /js 를 배포 allowlist 에 되돌린다', () => {
  const v = fs.readFileSync(path.join(ROOT, '.vercelignore'), 'utf8');
  return { ok: /^!\/js\s*$/m.test(v), detail: '' };
});

// ── ③ 브라우저와 같은 순서로 적재 (vm 샌드박스 · window 흉내) ─────────────
function loadInSandbox() {
  const win = {};
  const ctx = vm.createContext({ window: win, console: console, Math: Math, Object: Object, Array: Array, Number: Number,
    isFinite: isFinite, Float64Array: Float64Array, Float32Array: Float32Array, Int32Array: Int32Array,
    Uint8Array: Uint8Array, Uint8ClampedArray: Uint8ClampedArray, Uint16Array: Uint16Array, String: String, Error: Error, JSON: JSON });
  for (const f of FILES) vm.runInContext(built[f], ctx, { filename: 'js/' + f });
  return { win, ctx };
}
let SB = null;
check('J-3', '★사본 3건이 브라우저 순서(color→texture→flatten)로 실려 window.CW_SENSOR_* 를 만든다', () => {
  SB = loadInSandbox();
  const w = SB.win;
  const ok = w.CW_SENSOR_COLOR && typeof w.CW_SENSOR_COLOR.measureColor === 'function' &&
    w.CW_SENSOR_TEXTURE && typeof w.CW_SENSOR_TEXTURE.measureTexture === 'function' &&
    w.CW_SENSOR_FLATTEN && typeof w.CW_SENSOR_FLATTEN.flattenSensors === 'function';
  const leak = Object.keys(SB.ctx).filter((k) => /^(AXES|DEFAULTS|YUKBU|REGIONS|OVAL|_api|_llog|_mean|LOG_FLOOR|NOT_MEASURED|COLOR|IN|measureColor|measureTexture|flattenSensors)$/.test(k));
  return { ok: !!ok && leak.length === 0, detail: ok ? ('전역 누출 ' + leak.length + '건' + (leak.length ? ': ' + leak.join(',') : '')) : 'window.CW_SENSOR_* 결손' };
});
check('J-4', '★IIFE 격리 — texture 적재 후에도 color.DEFAULTS 가 color 의 것이다 (전역 덮어쓰기 없음)', () => {
  const w = SB.win;
  const cd = w.CW_SENSOR_COLOR.DEFAULTS, td = w.CW_SENSOR_TEXTURE.DEFAULTS;
  const NODE = require('./sensor_color.js');
  return { ok: cd !== td && 'clipFracMax' in cd && !('faceRefPx' in cd) && JSON.stringify(cd) === JSON.stringify(NODE.DEFAULTS),
    detail: 'color.DEFAULTS 키: ' + Object.keys(cd).join(',') };
});

// ── ④ index.html 결속 대조 ───────────────────────────────────────────────────
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const count = (re) => (html.match(re) || []).length;
check('K-1', '★index.html 이 센서 사본 3건을 async 없이, 이 순서로 싣는다', () => {
  const i1 = html.indexOf('<script src="js/sensor_color.js"></script>');
  const i2 = html.indexOf('<script src="js/sensor_texture.js"></script>');
  const i3 = html.indexOf('<script src="js/sensor_flatten.js"></script>');
  return { ok: i1 > 0 && i2 > i1 && i3 > i2, detail: `${i1}<${i2}<${i3}` };
});
check('K-2', '★프레임 보관 — _cwStoreAIFrame 이 aiLandmarks·aiAspect·aiFrame(getImageData) 을 함께 저장한다', () => {
  const m = html.match(/function _cwStoreAIFrame\([\s\S]*?\n}\n/);
  if (!m) return { ok: false, detail: '_cwStoreAIFrame 없음' };
  const b = m[0];
  const ok = /aiLandmarks=lm/.test(b) && /aiAspect=/.test(b) && /_cwFaceAspect=/.test(b) && /aiFrame=fctx\.getImageData/.test(b) && /sensor=null/.test(b);
  return { ok, detail: '' };
});
check('K-3', '★두 검출 경로(파일·카메라)가 모두 _cwStoreAIFrame 을 부른다 (카메라 경로 aiAspect 누락 회귀 차단)', () => {
  const snap = html.match(/async function autoSnapFace\(\)[\s\S]*?\n}\n/);
  const ana = html.match(/async function analyzeFace\(\)[\s\S]*?const lm=getFaceLandmarks/);
  const okSnap = snap && /_cwStoreAIFrame\(cv,aiLandmarks\)/.test(snap[0]);
  const okAna = ana && /_cwStoreAIFrame\(sensCv,aiLm,tmpCv\.height\/\(tmpCv\.width\|\|1\)\)/.test(ana[0]);
  const stale = /photoState\.face\.aiLandmarks=aiLm;|photoState\.face\.aiLandmarks=aiLandmarks;/.test(html);
  return { ok: !!okSnap && !!okAna && !stale, detail: `snap:${!!okSnap} analyze:${!!okAna} 직접대입잔존:${stale}` };
});
check('K-4', '★새 사진 시작(onPhotoPicked·openCamera)이 _cwResetAIFrame 을 불러 이전 랜드마크를 지운다 (잔존 결함 회귀 차단)', () => {
  const pick = html.match(/function onPhotoPicked\(ev,kind\)\{[\s\S]*?const r=new FileReader/);
  const cam = html.match(/async function openCamera\(kind\)\{[\s\S]*?navigator\.mediaDevices\.getUserMedia\(\{/);
  const reset = html.match(/function _cwResetAIFrame\(\)\{[\s\S]*?\n}/);
  const okReset = reset && /aiLandmarks=null/.test(reset[0]) && /aiAspect=null/.test(reset[0]) && /aiFrame=null/.test(reset[0]) && /sensor=null/.test(reset[0]) && /faceBounds=null/.test(reset[0]);
  const leftover = /if\(kind==='face'\)photoState\.face\.faceBounds=null;/.test(html);
  return { ok: !!(pick && /_cwResetAIFrame\(\)/.test(pick[0])) && !!(cam && /_cwResetAIFrame\(\)/.test(cam[0])) && !!okReset && !leftover,
    detail: `pick:${!!(pick && /_cwResetAIFrame/.test(pick[0]))} cam:${!!(cam && /_cwResetAIFrame/.test(cam[0]))} reset완전:${!!okReset} 낡은초기화잔존:${leftover}` };
});
check('K-5', '★_cwFaceSensorMeasures 가 세 모듈을 부르고 결과를 캐시하며 fail-closed 다', () => {
  const m = html.match(/function _cwFaceSensorMeasures\(\)\{[\s\S]*?\n}\n/);
  if (!m) return { ok: false, detail: '없음' };
  const b = m[0];
  const ok = /SC\.measureColor\(fr,lm,A\)/.test(b) && /ST\.measureTexture\(fr,lm,A\)/.test(b) && /SF\.flattenSensors\(col,tex\)/.test(b) &&
    /photoState\.face\.sensor=out/.test(b) && /SF\.flattenSensors\(null,null\)/.test(b) && /notLoaded:true/.test(b);
  return { ok, detail: '' };
});
check('K-6', '★3경로(무료 face · 프리미엄 2) 전부 sensorMeasures·sensorMeta 를 싣는다', () => {
  const n1 = count(/sensorMeasures:aiScores\?_cwFaceSensorMeasures\(\)\.measures:null/g);
  const n2 = count(/sensorMeasures:cls\?_cwFaceSensorMeasures\(\)\.measures:null/g);
  const m1 = count(/sensorMeta:aiScores\?_cwFaceSensorMeasures\(\)\.meta:null/g);
  const m2 = count(/sensorMeta:cls\?_cwFaceSensorMeasures\(\)\.meta:null/g);
  return { ok: n1 === 1 && n2 === 2 && m1 === 1 && m2 === 2, detail: `measures 무료${n1}/프리미엄${n2} · meta 무료${m1}/프리미엄${m2}` };
});
check('K-7', '★픽셀은 서버로 가지 않는다 — fetch 본문에 aiFrame·ImageData 가 실리지 않는다', () => {
  const bad = /body:JSON\.stringify\([^)]*aiFrame/.test(html) || /sensorFrame|frameData:/.test(html);
  return { ok: !bad, detail: '' };
});

// ── ⑤ 서버 결속 대조 ─────────────────────────────────────────────────────────
const fortune = fs.readFileSync(path.join(ROOT, 'api', 'fortune.js'), 'utf8');
const facever = fs.readFileSync(path.join(ROOT, 'api', '_engine', 'facever.js'), 'utf8');
check('L-1', '★fortune.js 가 features.sensorMeasures 를 evaluateFace 에 넘긴다', () => ({
  ok: /sensorMeasures:\s*features\.sensorMeasures\s*\|\|\s*null/.test(fortune), detail: ''
}));
check('L-2', '★facever.evaluateFace 가 sensorMeasures 를 병합하고(접두사 col_/tex_ 한정) 충돌 시 센서 전체를 버린다', () => {
  const FV = require(path.join(ROOT, 'api', '_engine', 'facever.js'));
  const core = { browLength: 0.3, eyeSize: 0.22 };
  // 접두사 위반(eyeSize·hacked)은 개별 거부, col_/tex_ 는 병합
  const a = FV.mergeSensorMeasures(core, { col_INDANG_lightness: 0.4, tex_INDANG_crossingIndex: 0.1, eyeSize: 9, hacked: 1 });
  const okA = a.info.rejected_prefix === 2 && a.info.accepted === 2 && a.measures.eyeSize === 0.22 && !('hacked' in a.measures);
  // 랜드마크 축과 같은 이름의 센서 키가 오면(정상 경로에선 불가능) 센서 전체 폐기
  const coreX = Object.assign({}, core, { col_INDANG_lightness: 0.1 });
  const x = FV.mergeSensorMeasures(coreX, { col_INDANG_lightness: 0.4, tex_INDANG_crossingIndex: 0.1 });
  const okX = x.info.dropped_all === true && x.measures === coreX && x.info.accepted === 0;
  const b = FV.mergeSensorMeasures(core, { col_INDANG_lightness: 0.4 });
  const c = FV.mergeSensorMeasures(null, { col_INDANG_lightness: 0.4 });
  const okB = b.info.accepted === 1 && b.measures.col_INDANG_lightness === 0.4 && b.measures.browLength === 0.3;
  const okC = c.measures === null && c.info.dropped_all === true;             // 랜드마크 없이 센서만 → 판정 안 함
  return { ok: okA && okX && okB && okC, detail: `접두사거부:${okA} 충돌폐기:${okX} 병합:${okB} 센서단독거부:${okC}` };
});
check('L-3', '★프롬프트 규칙이 「얼굴빛·주름결 미계측」 문구를 버리고 참고층 한정 문구로 바뀌었다', () => {
  const old = /귀·얼굴빛·주름결은 이 앱이 계측하지 않으므로/.test(fortune);
  const neu = /얼굴빛·광택·주름결·점은 아래 【참고】 블록에 계측 항목이 있을 때만/.test(fortune);
  return { ok: !old && neu, detail: '' };
});

// ── ⑥ e2e — p06 합성 얼굴을 브라우저 순서 사본으로 계측 ───────────────────
function loadSynth() {
  // p06 의 합성 생성기(CANON_XY·makeLandmarks·BASE·render)만 잘라 vm 으로 평가한다.
  // p06 전체를 require 하면 90초짜리 평가가 함께 돈다. p06 이 p05 에서 CANON_XY 를 정규식으로 읽는 것과 같은 방식이다.
  const src = fs.readFileSync(path.join(DIAG, 'p06_sensor_texture_eval.js'), 'utf8');
  const a = src.indexOf('/* ── canonical 468정점');
  const b = src.indexOf('function render(lm, scen) {');
  if (a < 0 || b < 0) throw new Error('p06 합성 생성기 구간을 찾지 못했다');
  // render 함수의 끝: 'function render' 이후 첫 줄머리 '}' 까지
  const rest = src.slice(b);
  const endRel = rest.search(/\n}\n/);
  const body = src.slice(a, b + endRel + 3);
  const T = require('./sensor_texture.js'), S = require('./sensor_color.js');
  const ctx = vm.createContext({ require, fs, path, __dirname: DIAG, console, Math, Object, Array, Number, isFinite, Float64Array, Float32Array, Int32Array, Uint8Array, Uint8ClampedArray, Error, JSON,
    T, S, IN: S._internals, TI: T._internals });
  vm.runInContext(body + '\nthis.__synth = { makeLandmarks, render, BASE };', ctx, { filename: 'p06-synth-slice.js' });
  return ctx.__synth;
}
let synth = null, lm = null, img = null;
check('M-1', 'p06 합성 얼굴 생성기가 분리 적재된다 (마스터 1280×1704 · 얼굴 폭 ≈900px)', () => {
  synth = loadSynth();
  lm = synth.makeLandmarks({ withIris: true });
  img = synth.render(lm, { wrinkles: [{ region: 'CHEONJEONG', angleDeg: 0, count: 2, spacingFrac: 0.05, sigmaFrac: 0.006, depth: 0.22 }] });
  return { ok: !!(img && img.data && img.width === 1280 && lm.length === 478), detail: `${img.width}×${img.height} · lm ${lm.length}` };
});
let nodeFlat = null, sbFlat = null;
check('M-2', '★Node 정본 경로 — 색·텍스처 계측 성공 → 평탄화 축이 나온다', () => {
  const S = require('./sensor_color.js'), T = require('./sensor_texture.js'), F = require('./sensor_flatten.js');
  const A = img.height / img.width;
  const c = S.measureColor(img, lm, A), t = T.measureTexture(img, lm, A);
  nodeFlat = F.flattenSensors(c, t);
  const ok = c.ok && t.ok && nodeFlat.meta.axesEmitted > 100 && typeof nodeFlat.measures.col_INDANG_lightness === 'number' && typeof nodeFlat.measures.tex_CHEONJEONG_directionality === 'number';
  return { ok, detail: `color:${c.ok ? 'ok' : c.reject.gate} texture:${t.ok ? 'ok' : t.reject.gate} 축 ${nodeFlat.meta.axesEmitted}` };
});
check('M-3', '★브라우저 순서 사본 경로가 Node 정본과 같은 값을 낸다 (IIFE 사본 = 정본)', () => {
  const w = SB.win, A = img.height / img.width;
  const c = w.CW_SENSOR_COLOR.measureColor(img, lm, A), t = w.CW_SENSOR_TEXTURE.measureTexture(img, lm, A);
  sbFlat = w.CW_SENSOR_FLATTEN.flattenSensors(c, t);
  const ka = Object.keys(nodeFlat.measures), kb = Object.keys(sbFlat.measures);
  let diff = 0;
  for (const k of ka) if (Math.abs(nodeFlat.measures[k] - sbFlat.measures[k]) > 1e-12) diff++;
  return { ok: ka.length === kb.length && diff === 0, detail: `축 ${ka.length}/${kb.length} · 값 불일치 ${diff}` };
});
check('M-4', '★평탄화 키가 전부 레지스트리에 있고 접두사 규약(col_/tex_)을 지킨다', () => {
  const S = require('./sensor_color.js'), T = require('./sensor_texture.js'), F = require('./sensor_flatten.js');
  const reg = new Set(F.buildRegistry(S, T).map((a) => a.axis));
  const FV = require(path.join(ROOT, 'api', '_engine', 'facever.js'));
  const bad = Object.keys(nodeFlat.measures).filter((k) => !reg.has(k) || !FV.SENSOR_KEY_RE.test(k));
  return { ok: bad.length === 0, detail: bad.length ? bad.slice(0, 5).join(',') : `${Object.keys(nodeFlat.measures).length}축 전건 등재` };
});
check('M-5', '★fail-closed — 센서 거부(빈 이미지)면 축 0개 + 사유가 남는다', () => {
  const F = require('./sensor_flatten.js'), S = require('./sensor_color.js');
  const c = S.measureColor({ data: new Uint8ClampedArray(16), width: 2, height: 2 }, lm, 1);
  const f = F.flattenSensors(c, null);
  return { ok: f.meta.axesEmitted === 0 && f.meta.color.ok === false && !!f.meta.color.reject && f.meta.texture.ran === false, detail: f.meta.color.reject && f.meta.color.reject.gate };
});
check('M-6', '★facever 가 센서 축을 병합해도 ranks 가 없으므로 센서 규칙은 VERDICT 가 되지 않는다 (어느 tier 든)', () => {
  const FV = require(path.join(ROOT, 'api', '_engine', 'facever.js'));
  const core = {}; const AX = (fs.readFileSync(path.join(DIAG, 'face_core_v786.js'), 'utf8').match(/var\s+CW_FACE_AXES\s*=\s*\[([\s\S]*?)\]\s*;/) || [])[1] || '';
  const re = /'([A-Za-z][A-Za-z0-9_]*)'/g; let g; const ranks = {};
  while ((g = re.exec(AX))) { core[g[1]] = 0.5; ranks[g[1]] = 0.5; }
  const bad = [];
  for (const t of ['A', 'B', 'C-SYNTHETIC']) {
    const r = FV.evaluateFace({ measures: core, ranks, refTier: t, sensorMeasures: nodeFlat.measures });
    for (const v of r.verdicts) if (String(v.measure_axis || '').match(/^(col|tex)_/) || JSON.stringify(v).match(/"(col|tex)_/)) bad.push(v.rule_id + '@' + t);
  }
  return { ok: bad.length === 0, detail: bad.join(',') || '센서 축 VERDICT 0건' };
});

console.log('');
console.log('='.repeat(78));
if (fails.length) { console.log('실패 내역'); fails.forEach((f) => console.log('  FAIL ' + f)); }
console.log(`[p09_bind_sensors] total=${total} pass=${pass} fail=${fails.length}`);
process.exit(fails.length ? 1 : 0);
