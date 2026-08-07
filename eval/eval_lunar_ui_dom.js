// 천운 — 음력 입력 UI **DOM 조작 → 판독** 게이트 · v7.74 신설 (에이전트 F)
// ═══════════════════════════════════════════════════════════════════════════
// 【왜 신설하는가 — 이번 사고의 유일한 교훈】
//   v7.73 은 게이트 45종 · 뮤테이션 26종을 fail=0 / 생존 0 으로 통과하고 배포됐다.
//   그 직후 프로덕션에서 「사용자가 입력했다고 기억하는 날짜」와 「화면·해석문의 날짜」가 달랐다.
//   ★핵심: 화면과 해석문은 **서로 완전히 일치**한 채 함께 틀린다. 클라와 서버가 같은
//     (잘못된) 입력을 공유하기 때문이다. ⟹ 「화면 vs 해석」 대조 게이트는 원리적으로 못 잡는다.
//     잡을 수 있는 유일한 지점은 **UI 조작 결과 == 사용자 의도** 뿐이다.
//   그런데 v7.73 게이트 45종 중 **DOM 을 실제로 조작하는 검사는 0건**이었다(`jsdom` 참조 0).
//   `cwReadBirth` 를 직접 호출하는 검사는 통과하지만, 그 함수가 읽는 `select.value` 를
//   **누가 어떤 순서로 채웠는지**가 결함의 자리였다.
//
// 【실측 재현 (v7.73 소스, _v773_work/probe_F)】
//   · 년/월/일/윤달 조작 순서 4! = 24 순열 중 **16 순열**에서 윤달 체크가 조용히 무시됐다.
//     음력 2023 윤2/15 → 평2/15 → 양력 2023-04-05 가 2023-03-06 으로, **30일 오차**.
//     원인: `cwSyncLunarDays` 가 윤달 없는 년/월에서 체크박스를 `disabled=true; checked=false`
//     로 되돌린다. 초기 상태(1990년 1월)에 윤달이 없으므로 UI 진입 직후 체크박스가 죽어 있고,
//     년·월을 확정하기 전에 윤달을 누르면 브라우저가 그 클릭을 삼킨다. 뒤늦게 살아나도
//     checked 는 false 로 남는다. 진입 경로 3종(직행 · 양력→음력 · 왕복) 모두 동일.
//   · 1900~2050 윤달 보유 **56개 연 전수**에서 「윤달을 먼저 클릭」 시 소실률 100%.
//   · 음력으로 전환만 하고 아무 것도 고르지 않아도 판독이 `ok:true / 1990-01-01` 이었다
//     (양력은 EMPTY 로 거부된다). 「고르지 않음」이 표현 불가능한 UI 였다.
//   · 양력 1900-01-xx → 음력 1899년(지원 범위 밖) → 이관 실패가 조용히 무시되어
//     사용자 입력이 통째로 **1990-01-27** 로 바뀌었다.
//
// 【이 게이트가 검사하는 성질】
//   「**실제 DOM 조작**(select.value 설정 + change 이벤트 · checkbox 클릭)의 결과로
//     `cwReadBirth` 가 돌려주는 값이, 조작 순서·진입 경로와 무관하게 사용자 의도와 같다.
//     같을 수 없으면 **조용히 다른 값으로 바꾸지 않고 거부한다**.」
//   ★결정 89 — 함수 직접 호출은 인정하지 않는다. 도달 경로(이벤트)를 통과해야 한다.
//   ★위약 방지 — SELF-3 이 「reset 재사용 경로」와 「완전 새 부팅」이 같은 판독을 내는지 대조하고,
//     SELF-4 가 긍정 대조(정상 순서는 반드시 통과)를 둔다. 항상-FAIL·항상-PASS 양쪽을 막는다.
//   【판정 불가 ≠ 통과】 jsdom·index.html·핀 중 하나라도 없으면 그 자체를 FAIL 로 둔다.
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
    console.log('\n[lunar_ui_dom] 실패 내역');
    for (const f of fails) console.log('  FAIL ' + f.id + ' ' + f.title + '  -> ' + f.detail);
  }
  console.log('[lunar_ui_dom] front_root=' + FR);
  console.log('[lunar_ui_dom] total=' + total + ' pass=' + pass + ' fail=' + fail);
  process.exit(fail ? 1 : 0);
}

// ── SELF-1 : 외부 pin 자기검사 (직접 실행 경로에서도 자기 약화를 적발한다) ──
const EXPECTED_TOTAL_MIN = 21;
check('SELF-1', '★_gate_pins.json 자기검사 — 자기 sha256 · 검사 수 하한', () => {
  const pinPath = path.join(__dirname, '_gate_pins.json');
  if (!fs.existsSync(pinPath)) return { ok: false, detail: '★pin 표 부재 — 판정 불가' };
  let pins = null;
  try { pins = JSON.parse(fs.readFileSync(pinPath, 'utf8')); } catch (e) { return { ok: false, detail: 'pin 판독 실패' }; }
  const spec = pins && pins.evals && pins.evals['eval_lunar_ui_dom.js'];
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
check('SELF-2', '★jsdom 해석 — DOM 조작 경로를 실제로 구동할 수 있다 (없으면 판정 불가 = FAIL)', () =>
  ({ ok: !!JSDOM, detail: JSDOM ? '해석 ' + (JSDOM_FROM === 'jsdom' ? 'node_modules' : JSDOM_FROM) : '★jsdom 부재 — 게이트 환경에서 `npm i -D jsdom` 하십시오' }));
if (!JSDOM) done();

const INDEX = path.join(FR, 'index.html');
const HTML = fs.readFileSync(INDEX, 'utf8');

// ── 부팅 & 조작 원시연산 ──────────────────────────────────────────────────
function boot() {
  const dom = new JSDOM(HTML, { runScripts: 'dangerously', url: 'https://chunwoon.test/', pretendToBeVisual: true });
  const w = dom.window;
  w.fetch = () => Promise.reject(new Error('NETWORK_BLOCKED_BY_GATE'));
  w.alert = () => {}; w.confirm = () => false; w.scrollTo = () => {};
  if (!w.Element.prototype.scrollIntoView) w.Element.prototype.scrollIntoView = function () {};
  return w;
}
const W = boot();
const D = W.document;

const IDS = ['tarotBirth', 'sajuBirth', 'cBirth1', 'cBirth2', 'tjBirth', 'namingBirth'];
const CALHID = { tarotBirth: 'tarotCalType', sajuBirth: 'sajuCalType', cBirth1: 'cCal1Type', cBirth2: 'cCal2Type', tjBirth: 'tjCalType', namingBirth: 'namingCalType' };
const SETCAL = {
  tarotBirth: (t) => W.setTarotCal(t), sajuBirth: (t) => W.setSajuCal(t),
  cBirth1: (t) => W.setCompatCal(1, t), cBirth2: (t) => W.setCompatCal(2, t),
  tjBirth: (t) => W.setTjCal(t), namingBirth: (t) => W.setNamingCal(t),
};
const ORIG = {};
for (const id of IDS) { const lw = D.getElementById(id + '_LUNARWRAP'); ORIG[id] = lw ? lw.outerHTML : null; }

/** 상품 하나의 생년월일 UI 를 **원본 HTML 그대로** 되돌린다(옵션 0개 · cwInit 미표식 · 리스너 없음) */
function reset(id) {
  const lw = D.getElementById(id + '_LUNARWRAP');
  if (lw && ORIG[id]) { const t = D.createElement('div'); t.innerHTML = ORIG[id]; lw.replaceWith(t.firstElementChild); }
  const inp = D.getElementById(id); if (inp) inp.value = '';
  const ce = D.getElementById(CALHID[id]); if (ce) ce.value = 'solar';
  const sw = D.getElementById(id + '_SOLARWRAP'); if (sw) sw.style.display = '';
}
/** ★브라우저의 사용자 조작 재현 — 옵션에 없는 값은 고를 수 없다 */
function pick(w, id, v) {
  const el = w.document.getElementById(id);
  if (!el) return 'NOEL';
  if (!Array.from(el.options).some((o) => o.value === String(v))) return 'NOOPT';
  el.value = String(v); el.dispatchEvent(new w.Event('change', { bubbles: true })); return 'ok';
}
function chk(w, id, on) {
  const el = w.document.getElementById(id);
  if (!el) return 'NOEL';
  if (el.disabled) return 'DISABLED';          // ★브라우저는 disabled 요소의 클릭을 삼킨다
  el.checked = !!on; el.dispatchEvent(new w.Event('change', { bubbles: true })); return 'ok';
}
function perms(a) { if (a.length <= 1) return [a]; const o = []; a.forEach((x, i) => perms(a.slice(0, i).concat(a.slice(i + 1))).forEach((p) => o.push([x].concat(p)))); return o; }
const P = perms(['Y', 'M', 'D', 'L']);

/** 진입 경로 + 조작 순서대로 UI 를 몰고 `cwReadBirth` 를 판독한다 */
function drive(w, id, order, t, entry) {
  const setcal = {
    tarotBirth: (x) => w.setTarotCal(x), sajuBirth: (x) => w.setSajuCal(x),
    cBirth1: (x) => w.setCompatCal(1, x), cBirth2: (x) => w.setCompatCal(2, x),
    tjBirth: (x) => w.setTjCal(x), namingBirth: (x) => w.setNamingCal(x),
  }[id];
  if (entry === 'fromSolar') { const inp = w.document.getElementById(id); if (inp) inp.value = '1990-05-15'; }
  setcal('lunar');
  if (entry === 'roundtrip') { setcal('solar'); setcal('lunar'); }
  const trail = [];
  for (const op of order) {
    let r;
    if (op === 'Y') r = pick(w, id + '_LY', t.y);
    else if (op === 'M') r = pick(w, id + '_LM', t.m);
    else if (op === 'D') r = pick(w, id + '_LD', t.d);
    else r = chk(w, id + '_LEAP', t.leap);
    trail.push(op + (r === 'ok' ? '' : '!' + r));
  }
  return { br: w.cwReadBirth(id), trail: trail.join(' ') };
}
const T = { y: 2023, m: 2, d: 15, leap: true };   // 음력 2023 윤2월 15일 = 양력 2023-04-05
const same = (br, t) => !!(br && br.ok && br.y === t.y && br.m === t.m && br.d === t.d && br.leap === !!t.leap);

// ── SELF-3 : 도달성/위약 대조 — reset 재사용 경로 == 완전 새 부팅 ──────────
check('SELF-3', '★검사 경로의 도달성 — reset 재사용 결과가 **완전 새 JSDOM 부팅** 결과와 같다 (경로 위약 차단)', () => {
  const bad = [];
  for (const order of [['L', 'M', 'D', 'Y'], ['Y', 'M', 'D', 'L']]) {
    const w2 = boot();
    const a = drive(w2, 'sajuBirth', order, T, 'direct').br;
    if (w2.close) w2.close();
    reset('sajuBirth');
    const b = drive(W, 'sajuBirth', order, T, 'direct').br;
    const key = (r) => JSON.stringify([r.ok, r.err || null, r.y, r.m, r.d, r.leap]);
    if (key(a) !== key(b)) bad.push(order.join('') + ' 새부팅' + key(a) + ' != reset' + key(b));
  }
  return { ok: bad.length === 0, detail: bad.length ? '★' + bad.join(' / ') : '2 순서 동치' };
});

// ── SELF-4 : 긍정 대조 (항상-FAIL 위약 차단) ──────────────────────────────
check('SELF-4', '★긍정 대조 — 정상 순서(년→월→윤달→일)는 반드시 통과한다', () => {
  reset('sajuBirth');
  const { br, trail } = drive(W, 'sajuBirth', ['Y', 'M', 'L', 'D'], T, 'direct');
  return { ok: same(br, T), detail: trail + ' → ' + JSON.stringify(br) };
});

// ── U-1 : 조작 순서 24 순열 × 진입 경로 3종 (★이번 사고의 정면) ───────────
check('U-1', '★★조작 순서 4!=24 순열 × 진입 3종 — 전건에서 사용자 의도 == 판독 (윤달 소실 0)', () => {
  const bad = [];
  for (const entry of ['direct', 'fromSolar', 'roundtrip']) {
    for (const order of P) {
      reset('sajuBirth');
      const { br, trail } = drive(W, 'sajuBirth', order, T, entry);
      if (!same(br, T)) bad.push(entry + '/' + order.join('') + '[' + trail + ']→' + (br.ok ? `${br.y}-${br.leap ? '윤' : '평'}${br.m}-${br.d}` : 'ERR:' + br.err));
    }
  }
  return { ok: bad.length === 0, detail: bad.length ? '★' + bad.length + '/72 불일치: ' + bad.slice(0, 4).join(' · ') : '72/72 일치' };
});

// ── U-2 : 상품 6종 × 최악 순서 ────────────────────────────────────────────
check('U-2', '★상품 6종(유료 포함) — 윤달을 **먼저** 클릭한 순서에서도 의도 보존', () => {
  const bad = [];
  for (const id of IDS) {
    reset(id);
    const { br, trail } = drive(W, id, ['L', 'M', 'D', 'Y'], T, 'direct');
    if (!same(br, T)) bad.push(id + '[' + trail + ']→' + (br.ok ? `${br.leap ? '윤' : '평'}${br.m}-${br.d}` : 'ERR:' + br.err));
  }
  return { ok: bad.length === 0, detail: bad.length ? '★' + bad.join(' · ') : IDS.length + '상품 전건 보존' };
});

// ── U-3 : 「고르지 않음」이 표현 가능한가 (양력과 대칭) ────────────────────
check('U-3', '★★음력으로 전환만 하고 아무 것도 고르지 않으면 **판독이 거부**된다 (조용한 1990-01-01 제출 금지)', () => {
  const bad = [];
  for (const id of IDS) {
    reset(id); SETCAL[id]('lunar');
    const br = W.cwReadBirth(id);
    if (br.ok) bad.push(id + '→ok ' + br.y + '-' + br.m + '-' + br.d);
  }
  return { ok: bad.length === 0, detail: bad.length ? '★미선택인데 ok: ' + bad.join(' · ') : IDS.length + '상품 전건 EMPTY 거부' };
});
check('U-3b', '양력 대조군 — 빈 <input type=date> 도 동일하게 거부된다 (달력 종류 간 대칭)', () => {
  reset('sajuBirth'); SETCAL.sajuBirth('solar');
  D.getElementById('sajuBirth').value = '';
  const br = W.cwReadBirth('sajuBirth');
  return { ok: !br.ok && br.err === 'EMPTY', detail: JSON.stringify(br) };
});

// ── U-4 : 윤달 없는 년/월 + 윤달 체크 → 조용한 평달 대체 금지 ─────────────
check('U-4', '★윤달이 없는 년·월에 윤달을 체크하면 **거부**한다 (조용히 평달로 바꾸지 않는다)', () => {
  reset('sajuBirth');
  // 2023년 윤달은 2월이다 ⟹ 3월에는 윤달이 없다
  const r = drive(W, 'sajuBirth', ['L', 'Y', 'M', 'D'], { y: 2023, m: 3, d: 10, leap: true }, 'direct');
  const br = r.br;
  const silentlyPlain = br.ok && br.leap === false;      // ★종전 결함의 형태
  return { ok: !br.ok && br.err === 'LEAP_NA',
    detail: silentlyPlain ? '★조용히 평달로 대체됨' : r.trail + ' → ' + JSON.stringify(br) };
});

// ── U-5 : 일(日) 조용한 클램프 금지 ───────────────────────────────────────
check('U-5', '★일 목록이 줄어들 때 고른 일자를 **조용히 당기지 않는다** (30일 → 29일 달)', () => {
  reset('sajuBirth'); SETCAL.sajuBirth('lunar');
  pick(W, 'sajuBirth_LY', 2023); pick(W, 'sajuBirth_LM', 2);
  const p30 = pick(W, 'sajuBirth_LD', 30);              // 평2월은 30일까지 — 고를 수 있어야 한다
  const before = W.cwReadBirth('sajuBirth');
  chk(W, 'sajuBirth_LEAP', true);                       // 윤2월은 29일까지 — 30일이 사라진다
  const after = W.cwReadBirth('sajuBirth');
  const silentClamp = after.ok && after.d === 29;        // ★종전 결함의 형태
  return { ok: p30 === 'ok' && before.ok && before.d === 30 && !after.ok && !silentClamp,
    detail: '평2/30 선택=' + p30 + ' 판독=' + (before.ok ? before.d : 'ERR') + ' → 윤달 체크 후=' + (after.ok ? '★' + after.d + '일로 조용히 대체' : '거부(' + after.err + ')') };
});

check('U-5b', '★2층 방어 — 1층(옵션 재구성)이 무너져 그 달에 없는 일자가 선택된 상태여도 **판독이 거부**한다', () => {
  // ★왜 주입하는가 — 1층(_cwFillSel)이 정상이면 이 상태는 DOM 조작만으로 도달할 수 없다.
  //   그러나 2층(cwReadBirth 의 DAY_NA)은 1층 회귀에 대한 **독립 방어**다. 1층 회귀를
  //   실제로 주입해(낡은 옵션이 남은 상태) 2층이 홀로 버티는지 본다.
  //   ※ 주입하지 않으면 이 방어는 어떤 뮤턴트도 죽이지 못하는 죽은 코드가 된다(뮤테이션 MF5 로 실증).
  reset('sajuBirth'); SETCAL.sajuBirth('lunar');
  pick(W, 'sajuBirth_LY', 2023); pick(W, 'sajuBirth_LM', 2);
  chk(W, 'sajuBirth_LEAP', true);                    // 윤2월 = 29일까지
  const ds = D.getElementById('sajuBirth_LD');
  const stale = D.createElement('option'); stale.value = '30'; stale.textContent = '30일';
  ds.appendChild(stale); ds.value = '30';
  const br = W.cwReadBirth('sajuBirth');
  const silent = br.ok && br.d !== 30;
  return { ok: !br.ok && br.err === 'DAY_NA',
    detail: silent ? '★조용히 ' + br.d + '일로 대체' : JSON.stringify(br) };
});

check('U-5c', '★일(日) 의도 보존 — 중간 단계에서 잠시 사라진 일자가 다시 유효해지면 **그 값 그대로** 되살아난다', () => {
  // 윤달이 30일인 해에서 순서 D→Y→M→L : 평달(29일)을 거치며 30일이 사라졌다가 윤달 체크로 복귀한다.
  const big = [];
  for (let y = 1900; y <= 2050; y++) { const lm = W.lunarLeapMonth(y); if (lm && W.lunarLeapDays(y) === 30) big.push([y, lm]); }
  if (big.length < 5) return { ok: false, detail: '★윤달 30일인 해 ' + big.length + '개 — 표본 부족(판정 불가)' };
  const bad = [];
  for (const [y, lm] of big) {
    for (const order of [['D', 'Y', 'M', 'L'], ['L', 'M', 'D', 'Y'], ['Y', 'M', 'L', 'D']]) {
      reset('sajuBirth');
      const { br } = drive(W, 'sajuBirth', order, { y: y, m: lm, d: 30, leap: true }, 'direct');
      if (!(br.ok && br.leap === true && br.d === 30 && br.y === y && br.m === lm)) bad.push(y + '/윤' + lm + '/' + order.join(''));
    }
  }
  return { ok: bad.length === 0, detail: bad.length ? '★' + bad.length + '/' + big.length * 3 + ' 소실: ' + bad.slice(0, 5).join(',') : big.length * 3 + '건 전건 복원' };
});

// ── U-6 : 사용자 의도를 파괴하는 컨트롤이 없다 ────────────────────────────
check('U-6', '★★윤달 체크박스가 어느 시점에도 `disabled` 되지 않는다 (클릭을 삼켜 의도를 버리는 경로 봉쇄)', () => {
  const bad = [];
  for (const id of IDS) {
    reset(id); SETCAL[id]('lunar');
    const lp = D.getElementById(id + '_LEAP');
    if (!lp) { bad.push(id + ': 체크박스 부재'); continue; }
    if (lp.disabled) bad.push(id + ': 진입 직후 disabled');
    // 윤달 없는 년·월을 골라도 죽지 않아야 한다
    pick(W, id + '_LY', 2023); pick(W, id + '_LM', 3);
    if (lp.disabled) bad.push(id + ': 윤달 없는 월 선택 후 disabled');
    if (lp.checked) bad.push(id + ': 코드가 checked 를 임의로 켰다');
    chk(W, id + '_LEAP', true);
    pick(W, id + '_LM', 5);
    if (!lp.checked) bad.push(id + ': ★코드가 사용자의 checked 를 껐다');
  }
  return { ok: bad.length === 0, detail: bad.length ? '★' + bad.join(' · ') : IDS.length + '상품 전건 · 의도 파괴 0' };
});
// ★주석은 검사 대상이 아니다 — 이 게이트의 설명 주석 자신이 오탐을 만들면 게이트가 못 쓰게 된다.
//   (문자열 리터럴까지 완벽히 걷어내진 않는다. 목적은 **실행되는 코드**의 회귀 적발이다.)
const HTML_CODE = HTML.split(/\r?\n/).map((l) => l.replace(/\/\/.*$/, '')).join('\n');
check('U-6b', '★소스 회귀 차단 — `disabled` 로 윤달 의도를 버리는 코드가 되살아나지 않았다', () => {
  const revived = [];
  if (/lp\s*\.\s*disabled\s*=\s*true/.test(HTML_CODE)) revived.push('lp.disabled=true');
  if (/checked\s*&&\s*!\s*lp\s*\.\s*disabled/.test(HTML_CODE)) revived.push('checked&&!lp.disabled (판독에서 의도 폐기)');
  if (/!\s*hasLeap\s*\)\s*\{\s*lp\s*\.\s*checked\s*=\s*false/.test(HTML_CODE)) revived.push('!hasLeap → lp.checked=false');
  // 「미선택 상태를 마지막 옵션으로 몰래 채우는」 종전 폴백도 함께 봉쇄한다.
  if (/selectedIndex\s*=\s*sel\s*\.\s*options\s*\.\s*length\s*-\s*1/.test(HTML_CODE)) revived.push('sel.selectedIndex=options.length-1 (조용한 대체 폴백)');
  return { ok: revived.length === 0, detail: revived.length ? '★부활: ' + revived.join(', ') : '4 패턴 부재' };
});

// ── U-7 : 관통 #10 회귀 방지 — 음력 2월 30일 ─────────────────────────────
check('U-7', '음력 대월 30일을 실제로 고를 수 있다 (관통 #10 회귀 방지)', () => {
  reset('sajuBirth'); SETCAL.sajuBirth('lunar');
  pick(W, 'sajuBirth_LY', 2023); pick(W, 'sajuBirth_LM', 2);
  const r = pick(W, 'sajuBirth_LD', 30);
  const br = W.cwReadBirth('sajuBirth');
  return { ok: r === 'ok' && br.ok && br.d === 30 && br.leap === false, detail: r + ' → ' + JSON.stringify(br) };
});

// ── U-8 : 1900~2050 윤달 보유 연 전수 ────────────────────────────────────
check('U-8', '★1900~2050 윤달 보유 연 **전수** — 「윤달 먼저 클릭」에서 소실 0', () => {
  const years = [];
  for (let y = 1900; y <= 2050; y++) { const lm = W.lunarLeapMonth(y); if (lm) years.push([y, lm]); }
  if (years.length < 50) return { ok: false, detail: '★윤달 보유 연 ' + years.length + '개 — 표가 비었다(판정 불가)' };
  const bad = [];
  for (const [y, lm] of years) {
    reset('sajuBirth');
    const { br } = drive(W, 'sajuBirth', ['L', 'M', 'D', 'Y'], { y: y, m: lm, d: 10, leap: true }, 'direct');
    if (!(br.ok && br.leap === true && br.y === y && br.m === lm && br.d === 10)) bad.push(y + '/윤' + lm);
  }
  return { ok: bad.length === 0, detail: bad.length ? '★' + bad.length + '/' + years.length + ' 소실: ' + bad.slice(0, 6).join(',') : years.length + '개 연 전건 보존' };
});

// ── U-9 : 양력 → 음력 전환 이관 ──────────────────────────────────────────
check('U-9', '★양력 입력 → 음력 전환 : 지원 범위 내는 무손실 왕복', () => {
  const bad = [];
  let n = 0;
  for (const yy of [1901, 1985, 2023, 2033, 2050]) {
    for (let mm = 1; mm <= 12; mm++) {
      for (const dd of [1, 15, 28]) {
        const bs = `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
        reset('sajuBirth');
        D.getElementById('sajuBirth').value = bs;
        SETCAL.sajuBirth('lunar');
        const br = W.cwReadBirth('sajuBirth'); const s = W.cwToSolar(br);
        n++;
        const back = s && s.ok ? `${s.solarY}-${String(s.solarM).padStart(2, '0')}-${String(s.solarD).padStart(2, '0')}` : 'ERR';
        if (back !== bs && bad.length < 6) bad.push(bs + '→' + back);
      }
    }
  }
  return { ok: bad.length === 0, detail: bad.length ? '★' + bad.join(' · ') : n + '건 무손실' };
});
check('U-9b', '★지원 범위 밖(양력 1900-01-xx → 음력 1899년)은 **조용히 다른 날로 바뀌지 않는다**', () => {
  reset('sajuBirth');
  D.getElementById('sajuBirth').value = '1900-01-15';
  SETCAL.sajuBirth('lunar');
  const br = W.cwReadBirth('sajuBirth');
  const silent = br.ok && !(br.y === 1899);            // ★종전엔 1990-01-01 이 나왔다
  return { ok: !br.ok, detail: silent ? '★조용히 ' + br.y + '-' + br.m + '-' + br.d + ' 로 대체' : '거부(' + br.err + ')' };
});

// ── U-10 : DOM 조작 산출 == 서버 엔진 재계산 (화면·해석이 **함께** 틀리는 축) ──
check('U-10', '★★DOM 조작 판독 → 양력 변환이 서버 엔진(api/_engine/recompute.js)과 동치', () => {
  let RC = null;
  try { RC = require(path.join(FR, 'api', '_engine', 'recompute.js')); } catch (e) { return { ok: false, detail: '★서버 엔진 로드 실패: ' + e.message }; }
  if (!RC || typeof RC.recompute !== 'function') return { ok: false, detail: '★recompute 부재 — 판정 불가' };
  const cases = [];
  for (const [y, m] of [[2023, 2], [1987, 6], [2020, 4], [1955, 3], [2036, 6]]) {
    for (const leap of [true, false]) for (const d of [1, 15, 29]) cases.push({ y, m, d, leap });
  }
  const bad = []; let n = 0, skipped = 0;
  for (const c of cases) {
    reset('sajuBirth');
    // ★순서를 일부러 최악(윤달 먼저)으로 둔다 — 이 경로에서 서버와 갈리면 그것이 이번 사고다
    const { br } = drive(W, 'sajuBirth', ['L', 'M', 'D', 'Y'], c, 'direct');
    if (!br.ok) { skipped++; continue; }               // 실재하지 않는 조합은 거부가 정답
    const s = W.cwToSolar(br);
    const sv = RC.recompute({ birth: `${br.y}-${String(br.m).padStart(2, '0')}-${String(br.d).padStart(2, '0')}`, calType: 'lunar', isLeap: br.leap, hourIdx: 4 });
    n++;
    if (!sv || !sv.ok) { bad.push(JSON.stringify(c) + ' 서버거부'); continue; }
    const cl = `${s.solarY}-${s.solarM}-${s.solarD}`;
    const svs = `${sv.solar.y}-${sv.solar.m}-${sv.solar.d}`;
    if (cl !== svs) bad.push(JSON.stringify(c) + ' 클라' + cl + ' != 서버' + svs);
  }
  return { ok: bad.length === 0 && n >= 20, detail: bad.length ? '★' + bad.slice(0, 5).join(' · ') : n + '건 동치 (거부 ' + skipped + '건)' };
});

// ── U-11 : 「미선택」 표현 수단이 실재한다 (구조 pin) ──────────────────────
check('U-11', '★음력 select 3종에 placeholder(value="") 가 실재한다 — 「고르지 않음」의 표현 수단', () => {
  reset('sajuBirth'); SETCAL.sajuBirth('lunar');
  const bad = [];
  for (const sfx of ['_LY', '_LM', '_LD']) {
    const el = D.getElementById('sajuBirth' + sfx);
    if (!el || el.options.length < 2) { bad.push(sfx + ': 옵션 부족'); continue; }
    if (el.options[0].value !== '') bad.push(sfx + ': 첫 옵션이 placeholder 가 아니다');
    if (el.value !== '') bad.push(sfx + ': 초기 선택이 미선택이 아니다(' + el.value + ')');
  }
  return { ok: bad.length === 0, detail: bad.length ? '★' + bad.join(' · ') : '3 select 전건' };
});

// ── U-12 : 판독 진입점 단일화 (우회 경로가 생기지 않았다) ─────────────────
check('U-12', '★생년월일 판독 우회 금지 — 상품 핸들러가 `_LY/_LM/_LD` 를 직접 읽지 않는다', () => {
  const lines = HTML.split(/\r?\n/);
  const bad = [];
  const ALLOW = /_cwFillSel|cwSyncLunarDays|cwInitLunarUI|cwSwitchBirthUI|cwReadBirth/;
  let fnHead = '';
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    const fm = /^\s*(?:async\s+)?function\s+([A-Za-z0-9_$]+)/.exec(L);
    if (fm) fnHead = fm[1];
    if (/getElementById\s*\(\s*[^)]*_L[YMD]['"]/.test(L) && !ALLOW.test(fnHead)) bad.push((i + 1) + ':' + fnHead);
  }
  return { ok: bad.length === 0, detail: bad.length ? '★UI 함수 밖에서 직접 판독: ' + bad.join(', ') : '판독 진입점 = cwReadBirth 단일' };
});

done();
