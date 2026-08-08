// 천운 — 반입 블록 격리(폭발반경) 게이트 · v7.74 신설 (관통 E-8)
// ═══════════════════════════════════════════════════════════════════════════
// 【왜 신설하는가】
//   v7.74 에서 기계 생성 반입 블록(`CW_ENGINE_PORT`)을 **별도 `<script>`** 로 분리하고
//   앱 스크립트의 유일한 최상위 `CW_ENGINE` 참조(`CW_PILLAR_RANGE_MSG`)에 `typeof` 가드를
//   두었다. 목적은 **폭발반경 축소** — 엔진측 문법 변화 1건이 앱 전체를 백지로 만들지 않고
//   사주 계열만 실패하게 만드는 것이다.
//
//   ★그런데 「분리했다」는 **형상**이지 **효과**가 아니다(결정 96 — 수리안의 효과도 측정하라).
//     v7.73 B3 의 실측이 이를 증명했다: 「분리만」 하면 살아남은 상품은 **0종**으로 현행과
//     같았고(2010줄 ReferenceError 로 아래 7,700줄이 통째로 미실행), 실패 양상만
//     「명백한 SyntaxError」에서 「말없이 아무 일도 안 일어남」으로 **나빠졌다**.
//     즉 경계 2쌍만 넣고 `typeof` 가드를 빠뜨리면 **이득 0 · 진단 난이도 악화**다.
//     이 회귀는 정상 경로에서 아무 증상도 내지 않으므로 어떤 기존 게이트에도 안 잡힌다.
//
// 【이 게이트가 검사하는 성질】
//   「반입 블록에 **문법 오류 1건**이 생겨도 사주 계열 밖의 상품과 앱 셸은 **산다**.」
//   형상(`</script>` 가 몇 개인가 · `typeof` 문자열이 있는가)이 아니라 **jsdom 실구동 결과**로
//   판정한다. 구현을 바꿔도(예: 별도 파일 `<script src>` 로 빼도) 성질만 지키면 통과한다.
//
// 【위약 방지】
//   · P0 긍정 대조 — 무변경 index.html 에서 상품 전건이 정상 산출된다(항상-FAIL 위약 차단).
//   · P3 대조군    — **같은 파손**을 「분리 전 형상」(경계 줄 제거본)에 넣으면 앱 셸이 전부
//                    죽어야 한다. 죽지 않으면 이 검사는 분리 효과를 재고 있지 않다
//                    ⟹ 「항상 같음」 위약이므로 FAIL (결정 88·95 의 대조군 원칙).
//   · 파손 앵커가 1건이 아니면 **판정 불가 = FAIL**(통과로 접지 않는다).
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');

function frontRoot() {
  const env = process.env.CHUNWOON_FRONT_ROOT;
  if (env && fs.existsSync(path.join(env, 'index.html'))) return env;
  let d = ROOT;
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(d, 'api', 'fortune.js')) && fs.existsSync(path.join(d, 'index.html'))) return d;
    const up = path.dirname(d);
    if (up === d) break;
    d = up;
  }
  return null;
}
const FR = frontRoot();

let total = 0, pass = 0;
const fails = [];
function check(id, title, fn) {
  total++;
  let ok = false, detail = '';
  try { const r = fn(); if (r && typeof r === 'object') { ok = !!r.ok; detail = r.detail || ''; } else { ok = !!r; } }
  catch (e) { ok = false; detail = '예외: ' + ((e && e.message) || String(e)); }
  if (ok) { pass++; console.log('PASS ' + id + '  ' + title + (detail ? '   — ' + detail : '')); }
  else { fails.push({ id, title, detail }); console.log('FAIL ' + id + '  ' + title + (detail ? '   — ' + detail : '')); }
}
function done() {
  const fail = fails.length;
  if (fail) {
    console.log('\n[port_isolation] 실패 내역');
    for (const f of fails) console.log('  FAIL ' + f.id + ' ' + f.title + '  -> ' + f.detail);
  }
  console.log('[port_isolation] front_root=' + FR);
  console.log('[port_isolation] total=' + total + ' pass=' + pass + ' fail=' + fail);
  process.exit(fail ? 1 : 0);
}

// ── SELF-1 : 외부 pin 자기검사 (직접 실행 경로에서도 자기 약화를 적발한다) ──
const EXPECTED_TOTAL_MIN = 8;
check('SELF-1', '★_gate_pins.json 자기검사 — 자기 sha256 · 검사 수 하한', () => {
  const pinPath = path.join(__dirname, '_gate_pins.json');
  if (!fs.existsSync(pinPath)) return { ok: false, detail: '★pin 표 부재 — 판정 불가' };
  let pins = null;
  try { pins = JSON.parse(fs.readFileSync(pinPath, 'utf8')); } catch (e) { return { ok: false, detail: 'pin 판독 실패' }; }
  const spec = pins && pins.evals && pins.evals['eval_port_isolation.js'];
  if (!spec || !spec.sha256) return { ok: false, detail: '★pin 표에 자기 항목이 없다 — 미등재 게이트는 침식이 안 잡힌다' };
  const self = crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex');
  if (self !== spec.sha256)
    return { ok: false, detail: '★자기 sha256 불일치 (실측 ' + self.slice(0, 16) + ' != pin ' + String(spec.sha256).slice(0, 16) + ') — 정당한 강화라면 node tools/regen_gate_pins.js 로 갱신하라' };
  if (typeof spec.checks_min === 'number' && spec.checks_min < EXPECTED_TOTAL_MIN)
    return { ok: false, detail: '★checks_min ' + spec.checks_min + ' < ' + EXPECTED_TOTAL_MIN + ' — 검사 수 하한이 낮춰졌다' };
  return { ok: true, detail: 'sha256 일치 · checks_min=' + spec.checks_min };
});

if (!FR) { check('SELF-0', 'front_root 해석', () => ({ ok: false, detail: '★CHUNWOON_FRONT_ROOT 미지정' })); done(); }

// ── jsdom 해석 ── (판정 불가 ≠ 통과 : 못 찾으면 FAIL)
let JSDOM = null, JSDOM_FROM = '';
{
  const cands = [
    'jsdom',
    path.join(ROOT, 'node_modules', 'jsdom'),
    path.join(FR, 'node_modules', 'jsdom'),
    path.join(FR, '_v773_work', 'probe_F', 'node_modules', 'jsdom'),
    path.join(FR, '_v773_work', 'probe_B', 'node_modules', 'jsdom'),
  ];
  for (const c of cands) {
    try { JSDOM = require(c).JSDOM; JSDOM_FROM = c; break; } catch (e) { /* 다음 후보 */ }
  }
}
check('SELF-2', '★jsdom 해석 — 적재 실패 격리를 실제로 구동할 수 있다 (없으면 판정 불가 = FAIL)', () =>
  ({ ok: !!JSDOM, detail: JSDOM ? '해석 ' + (JSDOM_FROM === 'jsdom' ? 'node_modules' : JSDOM_FROM) : '★jsdom 부재 — 게이트 환경에서 `npm i -D jsdom` 하십시오' }));
if (!JSDOM) done();

const INDEX = path.join(FR, 'index.html');
const HTML = fs.readFileSync(INDEX, 'utf8');
const BEGIN = '// ==== CW_ENGINE_PORT BEGIN';
const END = '// ==== CW_ENGINE_PORT END';

// ── 사본 제조 ─────────────────────────────────────────────────────────────
// 「엔진측 문법 변화 1건」의 최소 모사 — 반입 블록 첫 함수 머리에서 `)` 하나를 잃는다.
const BREAK_ANCHOR = 'function gregorianToJDN(y, m, d) {';
const BREAK_TO = 'function gregorianToJDN(y, m, d {';
function breakPort(html) {
  const n = html.split(BREAK_ANCHOR).length - 1;
  if (n !== 1) throw new Error('파손 앵커 ' + n + '건(1이어야 한다) — 판정 불가는 통과가 아니다');
  return html.replace(BREAK_ANCHOR, BREAK_TO);
}
// 「분리 전 형상」 복원 — 반입 블록 주변의 **단독 스크립트 경계 줄만** 걷어내 하나로 합친다.
function unsplit(html) {
  const L = html.split('\n');
  const s = L.findIndex((l) => l.startsWith("const HS=['갑'"));
  const e = L.findIndex((l) => l.startsWith('function calcElementDistribution'));
  if (s < 0 || e < 0) return null;
  const out = [];
  let removed = 0;
  for (let i = 0; i < L.length; i++) {
    if (i > s && i < e && /^\s*(<\/script>|<script>)\s*$/.test(L[i])) { removed++; continue; }
    out.push(L[i]);
  }
  return removed ? { html: out.join('\n'), removed } : null;
}

// ── jsdom 실구동 ──────────────────────────────────────────────────────────
const SHELL = ['saveResult', 'shareResult', 'installApp', 'handlePremiumPurchase'];
function run(html) {
  const errs = [];
  const { VirtualConsole } = require(JSDOM_FROM === 'jsdom' ? 'jsdom' : JSDOM_FROM);
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errs.push(String((e && e.message) || e).split('\n')[0]));
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://chunwoon.test/', pretendToBeVisual: true, virtualConsole: vc });
  const w = dom.window, D = w.document;
  const sent = [], alerts = [];
  w.fetch = function (u, o) { let b = null; try { b = JSON.parse((o && o.body) || '{}'); } catch (e) {} sent.push(b); return new Promise(function () {}); };
  w.alert = (m) => alerts.push(String(m));
  w.confirm = () => false; w.scrollTo = () => {};
  if (!w.Element.prototype.scrollIntoView) w.Element.prototype.scrollIntoView = function () {};
  if (!w.HTMLCanvasElement.prototype.getContext) w.HTMLCanvasElement.prototype.getContext = function () { return null; };
  const setV = (id, v) => { const el = D.getElementById(id); if (el) el.value = v; };
  const probe = (fname, prep) => {
    sent.length = 0; alerts.length = 0;
    try {
      if (typeof w[fname] !== 'function') return 'UNDEF';
      if (prep) prep(setV, D);
      w[fname]();
    } catch (e) { return 'THROW:' + String((e && e.message) || e).slice(0, 60); }
    return sent.length ? ('PAYLOAD:' + (sent[0] && sent[0].type)) : (alerts.length ? 'ALERT' : 'NOCALL');
  };
  const R = { errs: errs.slice(0, 6), products: {}, shell: {} };
  R.products['사주'] = probe('analyzeSaju', (s) => { s('sajuName', '홍'); s('sajuHour', '3'); s('sajuGender', 'male'); s('sajuBirth', '1990-05-15'); });
  R.products['꿈해몽'] = probe('analyzeDream', (s, d) => { s('dreamStory', '하늘을 나는 꿈을 꾸었습니다.'); const c = d.getElementById('dreamLinkSaju'); if (c) c.checked = false; });
  R.products['관상'] = probe('analyzeFace');
  for (const n of SHELL) R.shell[n] = typeof w[n];
  R.refErr = errs.some((e) => /CW_ENGINE is not defined/.test(e));
  try { dom.window.close(); } catch (e) {}
  return R;
}

// ══════════════════════════════════════════════════════════════════════════
// P-0 형상 — 반입 블록이 **전용 <script>** 안에 홀로 있다 (사고 조사의 출발점 보존)
// ══════════════════════════════════════════════════════════════════════════
check('P-0', '반입 블록 마커가 각 1건이고 BEGIN 이 END 보다 앞선다', () => {
  const nb = HTML.split(BEGIN).length - 1, ne = HTML.split(END).length - 1;
  if (nb !== 1 || ne !== 1) return { ok: false, detail: '★BEGIN=' + nb + ' END=' + ne + ' (각 1이어야 한다)' };
  return { ok: HTML.indexOf(BEGIN) < HTML.indexOf(END), detail: 'BEGIN=1 END=1' };
});

check('P-1', '★반입 블록이 **자기 전용 인라인 <script>** 안에 있다 (앱 코드와 같은 파싱 단위가 아니다)', () => {
  const re = /<script(?![^>]*\bsrc=)(?![^>]*type=")[^>]*>([\s\S]*?)<\/script>/g;
  let m, own = null, others = 0;
  while ((m = re.exec(HTML))) {
    if (m[1].indexOf(BEGIN) >= 0) own = m[1]; else others++;
  }
  if (own === null) return { ok: false, detail: '★반입 블록이 인라인 <script> 안에 없다 — 판정 불가' };
  if (own.indexOf(END) < 0) return { ok: false, detail: '★BEGIN 과 END 가 서로 다른 <script> 에 있다' };
  // 전용성: 그 스크립트에서 마커 구간(END 줄 끝까지)과 주석·공백을 뺀 나머지에 앱 코드가 없어야 한다.
  const endLineStop = (() => { const i = own.indexOf(END); const nl = own.indexOf('\n', i); return nl < 0 ? own.length : nl; })();
  const rest = (own.slice(0, own.indexOf(BEGIN)) + own.slice(endLineStop))
    .split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('//')).join('');
  const ok = rest === '';
  return { ok, detail: ok ? '전용 <script> · 다른 인라인 ' + others + '개' : '★반입 <script> 에 앱 코드가 섞여 있다: ' + rest.slice(0, 80) };
});

// ══════════════════════════════════════════════════════════════════════════
// P-2 ★긍정 대조 — 무변경에서 상품이 정상이다 (항상-FAIL 위약 차단)
// ══════════════════════════════════════════════════════════════════════════
let BASE = null, BASE_ERR = null;
try { BASE = run(HTML); } catch (e) { BASE_ERR = (e && e.message) || String(e); }
check('P-2', '★긍정 대조 — 무변경 index.html 에서 사주·꿈해몽·관상과 앱 셸이 전부 정상이다', () => {
  if (!BASE) return { ok: false, detail: '★판정 불가(통과 아님): ' + BASE_ERR };
  const bad = [];
  if (!/^PAYLOAD:/.test(BASE.products['사주'])) bad.push('사주=' + BASE.products['사주']);
  if (!/^PAYLOAD:/.test(BASE.products['꿈해몽'])) bad.push('꿈해몽=' + BASE.products['꿈해몽']);
  if (BASE.products['관상'] === 'UNDEF') bad.push('관상=UNDEF');
  for (const n of SHELL) if (BASE.shell[n] !== 'function') bad.push(n + '=' + BASE.shell[n]);
  return { ok: bad.length === 0 && BASE.errs.length === 0,
    detail: bad.length || BASE.errs.length ? '★' + bad.concat(BASE.errs).join(' / ') : '상품 3종 정상 · 앱 셸 4종 정의 · 적재 오류 0' };
});

// ══════════════════════════════════════════════════════════════════════════
// P-3 ★핵심 성질 — 반입 블록이 깨져도 사주 계열 **밖**은 산다
// ══════════════════════════════════════════════════════════════════════════
let BRK = null, BRK_ERR = null;
try { BRK = run(breakPort(HTML)); } catch (e) { BRK_ERR = (e && e.message) || String(e); }

check('P-3', '★★반입 블록에 문법 오류 1건이 생겨도 **꿈해몽·관상이 산다** (폭발반경 = 사주 계열)', () => {
  if (!BRK) return { ok: false, detail: '★판정 불가(통과 아님): ' + BRK_ERR };
  const dream = BRK.products['꿈해몽'], face = BRK.products['관상'];
  const ok = /^PAYLOAD:/.test(dream) && face !== 'UNDEF' && face !== 'NOCALL';
  return { ok, detail: '꿈해몽=' + dream + ' · 관상=' + face + (ok ? '' : ' ★분리/지연 가드가 무너졌다') };
});

check('P-3b', '★★앱 셸(저장·공유·설치·프리미엄 결제)이 산다 — 결제 경로가 함께 죽지 않는다', () => {
  if (!BRK) return { ok: false, detail: '★판정 불가(통과 아님): ' + BRK_ERR };
  const bad = SHELL.filter((n) => BRK.shell[n] !== 'function');
  return { ok: bad.length === 0, detail: bad.length ? '★미정의: ' + bad.join(',') : SHELL.length + '/' + SHELL.length + ' 정의됨' };
});

check('P-3c', '★최상위 `CW_ENGINE` 참조 0건 — 파손 시 `ReferenceError: CW_ENGINE is not defined` 가 나지 않는다', () => {
  if (!BRK) return { ok: false, detail: '★판정 불가(통과 아님): ' + BRK_ERR };
  return { ok: !BRK.refErr,
    detail: BRK.refErr
      ? '★적재 중 CW_ENGINE 참조가 살아 있다 — `typeof` 가드(CW_PILLAR_RANGE_MSG)가 사라지면 아래 7,700줄이 통째로 미실행된다(B3 §5-2 V2)'
      : '적재 오류 ' + BRK.errs.length + '건 · CW_ENGINE 참조 오류 없음' };
});

check('P-3d', '★사주 계열은 (설계대로) 죽는다 — 「아무것도 안 깨졌다」는 위약이 아님을 증명', () => {
  if (!BRK) return { ok: false, detail: '★판정 불가(통과 아님): ' + BRK_ERR };
  const saju = BRK.products['사주'];
  return { ok: !/^PAYLOAD:/.test(saju),
    detail: '사주=' + saju + (/^PAYLOAD:/.test(saju) ? ' ★엔진이 깨졌는데 사주가 산다 — 파손이 실제로 먹지 않았다' : '') };
});

// ══════════════════════════════════════════════════════════════════════════
// P-4 ★대조군 — 「분리 전 형상」에 같은 파손을 넣으면 앱 셸이 전부 죽는다
//     (죽지 않으면 P-3 은 분리 효과를 재고 있지 않다 ⟹ 「항상 같음」 위약)
// ══════════════════════════════════════════════════════════════════════════
check('P-4', '★★대조군 — 경계를 걷어낸 「분리 전 형상」에 **같은 파손**을 넣으면 앱 셸이 전부 죽는다', () => {
  const u = unsplit(HTML);
  if (!u) return { ok: false, detail: '★경계 줄을 찾지 못했다 — 분리가 되돌려졌거나 앵커가 바뀌었다(판정 불가)' };
  let r = null;
  try { r = run(breakPort(u.html)); } catch (e) { return { ok: false, detail: '★판정 불가: ' + ((e && e.message) || e) }; }
  const alive = SHELL.filter((n) => r.shell[n] === 'function');
  return { ok: alive.length === 0,
    detail: '경계 ' + u.removed + '줄 제거본 · 살아남은 앱 셸 ' + alive.length + '/' + SHELL.length +
      (alive.length ? ' ★대조군이 죽지 않았다 — P-3 은 분리 효과를 재고 있지 않다' : ' (정상 — 분리 전에는 전부 죽는다)') };
});

done();
