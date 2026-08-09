// 천운 — 생년월일 **원본 6키** 적재 게이트 · v7.79 신설 (계약 §2-1 · 파 ⓐ)
// ═══════════════════════════════════════════════════════════════════════════
// 【무엇을 잡는가】
//   계약 v7.79 는 서버가 클라 원국을 **재유도**해 교체하도록 바꾼다. 그러려면 서버가
//   생년월일 **원본**을 받아야 한다 — `cal`·`y`·`m`·`d`·`h`·`leap` 6키(§2-1).
//   6키가 없으면 서버는 `mode:'legacy'` 로 **아무것도 안 바꾼다**(§6). 즉 클라가 안 실으면
//   가드는 **조용히 사문화**된다. 붉어지는 곳이 하나도 없다 — 그것이 이 게이트의 존재 이유다.
//
// 【왜 정적 분석이 아니라 런타임인가 — v7.78 의 교훈】
//   v7.78 세션에서 정적 표현식 추론이 **두 번** 틀렸다(I-70 · 결정 106).
//   「소스에 `cal:` 이라고 써 있다」와 「실제 payload 에 `cal` 이 도달했다」는 다른 명제다.
//   ⟹ 이 게이트는 `jsdom` 으로 UI 를 실제로 조작하고 `/api/fortune` 으로 나가는
//     **payload 를 그대로 가로채** 값을 본다. 성질만 선례에서 가져왔다(결정 105):
//     `eval_ctx_dead_value.js`(payload 포착) · `eval_lunar_ui_dom.js`(음력 UI 원시연산).
//
// 【경로 — 「직접 입력」만 보면 v7.78 I-70 이 재발한다】
//   상품 폼이 생년월일을 **직접 받는 경로**와, 비워두면 `window._sajuResultData` 를
//   재사용하는 **폴백 경로**는 산출 지점이 다르다. I-70 은 정확히 폴백에서 났다.
//   게다가 `_sajuResultData` 에는 **윤달 여부가 없었다** — 음력 윤달 생일을 사주 탭에서
//   입력한 사용자가 작명으로 넘어가면 `leap` 을 복원할 방법이 원리적으로 없다.
//   ⟹ 경로 4종 전수:
//     P1 direct              (상품 폼 양력 직접 입력)
//     P2 fallback            (사주 탭 양력 → 상품 폼 비움)
//     P3 lunarleap           (상품 폼 음력 윤달 직접 입력)
//     P4 fallback_lunarleap  (사주 탭 음력 윤달 → 상품 폼 비움)  ★I-70 형태의 재발 자리
//
// 【분모】
//   파 ⓐ 상품 7 type = naming · naming_premium_1 · naming_premium_2 · naming_nickname ·
//                      tarot · tarot_premium_1 · tarot_premium_2
//   ★타로는 **폴백 경로가 없다**(`analyzeTarot` 이 `_sajuResultData` 를 안 본다).
//     그러므로 P2·P4 의 분모는 naming 계열 4 type 뿐이다 — 이 사실 자체를 B-0 이 못박는다.
//   전수 = 7(P1) + 4(P2) + 7(P3) + 4(P4) = **22 payload**
//
// ═══ v7.79 파 ⓑ 증축 — `dream`(3) · `daily_message` (B-9 ~ B-15) ═══════════
//   【파 ⓐ 와 무엇이 다른가】
//     파 ⓐ 7종은 상품 폼이 생년월일을 **직접 받았다**. 파 ⓑ 4종은 UI 가 아예 안 받고
//     `window._sajuResultData` 만 재사용한다 ⟹ **원본 6키의 유일한 출처가 그 전역 하나뿐**이다.
//     그래서 「사주 미연동」이 정상 상태로 존재한다 — 그때 6키를 **만들어 내면 없던 사실을
//     지어내는 것**이고, 서버는 그것을 참으로 믿고 원국을 재유도한다(계약 §6 `derived`).
//     ⟹ B-13 이 **미적재**를 적재만큼 엄격하게 못박는다.
//
//   【적재 지점 — 전수 3곳 · payload 사이트 5곳 (분모를 먼저 못박는다)】
//     ① `analyzeDream()`   ctx 리터럴          → `dream`                        (사이트 1)
//     ② `_buildDreamContext(info)` return 리터럴 → `dream_premium_1`·`_2`        (사이트 2·3)
//        ★그리고 **`retryDreamPremiumAPI()` 도 같은 빌더를 쓴다**(사이트 4·5).
//          v7.78 결정 106 이 「값 출처 3곳」을 4곳으로 정정한 것과 같은 형태 —
//          재시도 경로를 안 세면 결제 후 1회 실패한 사용자만 조용히 legacy 로 떨어진다.
//     ③ `js/chat.js` `_gatherChatContext()`     → `daily_message`               (사이트 6)
//        ★`_buildXxxContext` 계열이 **아니다**. 이름 규약이 다르다.
//
//   【경로 5종 — 계약 §6 의 분기를 전부 밟는다】
//     Q1 linked        사주 연동(양력 · 시각 있음)      6 슬롯
//     Q2 lunarleap     사주 탭 **음력 윤달**             6 슬롯  ← `leap:true` 가 실려야 한다
//     Q3 nohour        **시간 모름**(`hi=-1`)            6 슬롯  ← `h:-1` · ★`hourBranch` 키 자체가 없어야
//     Q4 unlinked_off  사주는 있으나 `linkSaju` **꺼짐** 5 슬롯  ← dream(3)만. 6키 0개여야
//     Q5 nosaju        `_sajuResultData` **없음**        6 슬롯  ← 전건 6키 0개여야
//     전수 = 6+6+6+5+6 = **29 payload**
//
// 【자기 유효성 — 0건이 아무것도 증명하지 않는 것을 막는다】
//   · B-0 커버리지 하한(경로 4종 · type 7종 · payload 22벌) — ★분모 없는 통과는 측정이 아니다
//   · B-6 자기 뮤턴트 2종(직접 경로 적재 제거 · `_sajuResultData.leap` 제거)
//   · B-7 긍정 짝(무변경 사본에서는 안 잡힌다)
//   · B-4 ★역방향 대조군(계약 §8) — 이미 닫힌 `saju`·`compat`·`tojeong` payload 무변경
//   · B-5 ★하위호환(계약 §6) — 사주 없는 요청은 6키가 **한 개도** 없다(부분 적재 금지)
//
// 【임시 파일】
//   ★디스크에 사본을 **만들지 않는다**(결정 109). jsdom 은 HTML 문자열을 직접 받는다.
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
  try { const r = fn(); if (r && typeof r === 'object') { ok = !!r.ok; detail = r.detail || ''; } else ok = !!r; }
  catch (e) { ok = false; detail = '예외: ' + ((e && e.message) || String(e)); }
  if (ok) { pass++; console.log('PASS ' + id + '  ' + title + (detail ? '   — ' + detail : '')); }
  else { fails.push({ id, title, detail }); console.log('FAIL ' + id + '  ' + title + (detail ? '   — ' + detail : '')); }
}
function done() {
  const fail = fails.length;
  if (fail) {
    console.log('\n[ctx_birth_keys] 실패 내역');
    for (const f of fails) console.log('  FAIL ' + f.id + ' ' + f.title + '  -> ' + f.detail);
  }
  console.log('[ctx_birth_keys] front_root=' + FR);
  console.log('[ctx_birth_keys] total=' + total + ' pass=' + pass + ' fail=' + fail);
  process.exit(fail ? 1 : 0);
}

const EXPECTED_TOTAL_MIN = 17;   // ★v7.79 파 ⓑ 증축(11 → 18). 래칫이므로 내리지 말 것.
check('SELF-1', '★_gate_pins.json 자기검사 — 자기 sha256 · 검사 수 하한', () => {
  const p = path.join(__dirname, '_gate_pins.json');
  if (!fs.existsSync(p)) return { ok: false, detail: '★pin 표 부재 — 판정 불가' };
  let pins = null;
  try { pins = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return { ok: false, detail: 'pin 판독 실패' }; }
  const spec = pins && pins.evals && pins.evals['eval_ctx_birth_keys.js'];
  if (!spec || !spec.sha256) return { ok: false, detail: '★pin 표에 자기 항목이 없다 — 미등재 게이트는 침식이 안 잡힌다' };
  const self = crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex');
  if (self !== spec.sha256)
    return { ok: false, detail: '★자기 sha256 불일치 (실측 ' + self.slice(0, 16) + ' != pin ' + String(spec.sha256).slice(0, 16) + ') — 정당한 강화라면 node tools/regen_gate_pins.js 로 갱신하라' };
  if (typeof spec.checks_min === 'number' && spec.checks_min < EXPECTED_TOTAL_MIN)
    return { ok: false, detail: '★checks_min ' + spec.checks_min + ' < ' + EXPECTED_TOTAL_MIN };
  return { ok: true, detail: 'sha256 일치 · checks_min=' + spec.checks_min };
});

if (!FR) { check('SELF-0', 'front_root 해석', () => ({ ok: false, detail: '★CHUNWOON_FRONT_ROOT 미지정' })); done(); }

// ── jsdom 해석 ── (판정 불가 ≠ 통과 : 없으면 FAIL)
let JSDOM = null, JSDOM_FROM = '';
{
  const cands = [
    'jsdom',
    path.join(ROOT, 'node_modules', 'jsdom'),
    path.join(FR, 'node_modules', 'jsdom'),
    path.join(process.env.HOME || '', 'cw778g', 'node_modules', 'jsdom'),
  ];
  for (const c of cands) {
    if (!c) continue;
    try { JSDOM = require(c).JSDOM; JSDOM_FROM = c; break; } catch (e) { /* 다음 후보 */ }
  }
}
check('SELF-2', '★jsdom 해석 — 「실었다」가 아니라 「도달했다」를 본다 (없으면 판정 불가 = FAIL)', () =>
  ({ ok: !!JSDOM, detail: JSDOM ? '해석 ' + (JSDOM_FROM === 'jsdom' ? 'node_modules' : JSDOM_FROM) : '★jsdom 부재 — `npm i -D jsdom`' }));
if (!JSDOM) done();

const HTML = fs.readFileSync(path.join(FR, 'index.html'), 'utf8');
const TAROT_SRC = fs.readFileSync(path.join(FR, 'js', 'tarot.js'), 'utf8');
// ★파 ⓑ — `daily_message` 는 `js/chat.js` 가 만든다. index.html 만 부팅하면 그 경로가 통째로 안 보인다.
const CHAT_SRC = fs.readFileSync(path.join(FR, 'js', 'chat.js'), 'utf8');

// ══════════════════════════════════════════════════════════════════════════
// ⑴ 계약 §2-1 — 6키 (★명시 배열. `'y'+i` 같은 조립을 만들지 않는다 · §2-3)
// ══════════════════════════════════════════════════════════════════════════
const BIRTH_KEYS = Object.freeze(['cal', 'y', 'm', 'd', 'h', 'leap']);

/** 파 ⓐ 분모. 이 목록이 B-0 의 분모다. */
const WAVE_A_TYPES = Object.freeze(['naming', 'naming_premium_1', 'naming_premium_2',
  'naming_nickname', 'tarot', 'tarot_premium_1', 'tarot_premium_2']);
/** ★타로는 폴백 경로가 없다 — 폴백 분모는 naming 계열뿐이다. */
const FALLBACK_TYPES = Object.freeze(['naming', 'naming_premium_1', 'naming_premium_2', 'naming_nickname']);

/** 파 ⓑ 분모(계약 §9). ★`naming_company`(파 ⓒ)는 여기 없다. */
const WAVE_B_TYPES = Object.freeze(['dream', 'dream_premium_1', 'dream_premium_2', 'daily_message']);
/**
 * ★payload **슬롯** 이름. type 4종이지만 사이트는 6곳이다 —
 *   프리미엄 2종은 최초 호출과 **재시도**(`retryDreamPremiumAPI`)가 서로 다른 사이트다.
 *   `@retry` 접미는 이 게이트의 표기이며 서버로는 같은 type 이 나간다.
 */
const WAVE_B_SLOTS = Object.freeze(['dream', 'dream_premium_1', 'dream_premium_2',
  'dream_premium_1@retry', 'dream_premium_2@retry', 'daily_message']);
/** `linkSaju` 를 끈 경로에서는 dream 계열만 본다(daily 는 토글이 없어 정상 적재된다). */
const WAVE_B_DREAM_SLOTS = Object.freeze(['dream', 'dream_premium_1', 'dream_premium_2',
  'dream_premium_1@retry', 'dream_premium_2@retry']);

// 검체 — 세 벌이 서로 다른 값을 내야 「UI 조작이 실제로 먹었다」가 증명된다
const FX_SAJU = { bs: '1990-05-15', y: 1990, m: 5, d: 15, h: 3, g: 'male' };  // 사주 탭(폴백 출처)
const FX_FORM = { bs: '1988-11-03', y: 1988, m: 11, d: 3, h: 5, g: 'male' };  // 상품 폼 직접 입력
const FX_LUNAR = { y: 2023, m: 2, d: 15, leap: true, h: 7 };                   // 음력 2023 윤2/15

const WANT = {
  direct: { cal: 'solar', y: FX_FORM.y, m: FX_FORM.m, d: FX_FORM.d, h: FX_FORM.h, leap: false },
  fallback: { cal: 'solar', y: FX_SAJU.y, m: FX_SAJU.m, d: FX_SAJU.d, h: FX_SAJU.h, leap: false },
  lunarleap: { cal: 'lunar', y: FX_LUNAR.y, m: FX_LUNAR.m, d: FX_LUNAR.d, h: FX_LUNAR.h, leap: true },
  fallback_lunarleap: { cal: 'lunar', y: FX_LUNAR.y, m: FX_LUNAR.m, d: FX_LUNAR.d, h: FX_LUNAR.h, leap: true },
  // ── 파 ⓑ (출처는 전부 사주 탭 = `window._sajuResultData`) ─────────────────
  linked: { cal: 'solar', y: FX_SAJU.y, m: FX_SAJU.m, d: FX_SAJU.d, h: FX_SAJU.h, leap: false },
  b_lunarleap: { cal: 'lunar', y: FX_LUNAR.y, m: FX_LUNAR.m, d: FX_LUNAR.d, h: FX_LUNAR.h, leap: true },
  // ★「시간 모름」 — `h:-1` 이 **실려야** 한다. 키를 빼면 6키가 전부 무너져 legacy 가 된다.
  nohour: { cal: 'solar', y: FX_SAJU.y, m: FX_SAJU.m, d: FX_SAJU.d, h: -1, leap: false },
};

// ══════════════════════════════════════════════════════════════════════════
// ⑵ 역방향 대조군 핀 (계약 §8) — 이미 닫힌 3종 payload 의 정규화 sha256
//    ★v7.79 착수 시점(HEAD 7b451ee) 실측. 이 작업이 그 셋을 건드리면 여기가 붉어진다.
//    `currentYear`·`currentGanji` 는 실행 연도에 따라 변하므로 제외한다(그 둘만).
// ══════════════════════════════════════════════════════════════════════════
const CLOSED_PIN = Object.freeze({
  saju: '9764ba218843b41a4b070adeade0396490885a1161d8517f9910d0b24b42cbd4',
  compat: '0524236feecac009708f67d17b8621d4acdba143ffe26b473b2e287a3d12808a',
  tojeong: 'cbba7035e62814d2fbcff368d0660e983fc9e4823ea9cabf22cc3c6aad400a4f',
});
const CLOSED_VOLATILE = Object.freeze(['currentYear', 'currentGanji']);
function stableStr(v) {
  if (Array.isArray(v)) return '[' + v.map(stableStr).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + stableStr(v[k])).join(',') + '}';
  return JSON.stringify(v);
}
function closedSha(ctx) {
  const c = Object.assign({}, ctx);
  for (const k of CLOSED_VOLATILE) delete c[k];
  return crypto.createHash('sha256').update(stableStr(c)).digest('hex');
}

// ══════════════════════════════════════════════════════════════════════════
// ⑶ 구동 원시연산 — 실제 DOM 조작(결정 89: 함수 직접 호출은 인정하지 않는다)
// ══════════════════════════════════════════════════════════════════════════
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** type 별 최소 성공 응답. 렌더가 돌아야 `_tarotResultData`·`_namingResultData` 가 생긴다. */
function canned(type) {
  if (/^tarot_premium/.test(type)) return { success: true, result: { readings: [{}], sajuLink: '', timeline: {}, actionPlan: [], luckyInfo: {}, blessing: '' } };
  if (type === 'tarot') return { success: true, result: { reading: [{}], fortuneScore: 70 } };
  if (/^naming/.test(type)) return { success: true, result: { candidates: [], bestThree: [] } };
  if (/^dream_premium/.test(type)) return { success: true, result: { traditionalDeep: 'x', symbolsDetail: [{}], hwamongbup: {}, timelineImpact: {}, luckyDetail: {} } };
  if (type === 'dream') return { success: true, result: { summary: 's', keySymbols: [] } };
  if (type === 'daily_message') return { success: true, result: { text: '오늘의 한 마디' } };
  return { success: true, result: { text: 'ok' } };
}

/**
 * @param {string} html
 * @param {string} [chatSrc] `js/chat.js` 원문(뮤턴트에서 갈아끼운다). 생략하면 워킹본.
 */
async function boot(html, chatSrc) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://chunwoon.test/', pretendToBeVisual: true });
  const w = dom.window;
  w.__calls = [];
  w.fetch = (u, o) => {
    let b = null; try { b = JSON.parse(o.body); } catch (e) { /* 형태 불명은 그대로 기록 */ }
    w.__calls.push(b);
    const r = canned(b && b.type);
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(r), text: () => Promise.resolve(JSON.stringify(r)) });
  };
  w.alert = () => {}; w.confirm = () => true; w.scrollTo = () => {};
  if (!w.Element.prototype.scrollIntoView) w.Element.prototype.scrollIntoView = function () {};
  // ★`js/tarot.js`·`js/chat.js` 는 **별도 파일**이다(`<script src>`).
  //   jsdom 은 외부 자원을 안 받아오므로 직접 평가하지 않으면 그 상품 경로가 통째로 안 보인다.
  w.eval(TAROT_SRC);
  w.eval(chatSrc || CHAT_SRC);
  await sleep(250);
  return w;
}
function setv(w, id, v) { const e = w.document.getElementById(id); if (!e) return 'NOEL'; e.value = v; return 'ok'; }
function chip(w, kind, k) {
  const all = [...w.document.querySelectorAll('[data-kind="' + kind + '"]')];
  all.forEach((x) => x.classList.remove('selected'));
  const t = all.find((x) => x.dataset.k === k);
  if (!t) return 'NOCHIP'; t.classList.add('selected'); return 'ok';
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
  if (el.disabled) return 'DISABLED';
  el.checked = !!on; el.dispatchEvent(new w.Event('change', { bubbles: true })); return 'ok';
}
/** 음력 윤달 입력 — 년→월→일→윤달 순서(v7.74 F-1 이후 순서 무관하지만 정상 순서를 쓴다) */
function driveLunar(w, birthId, setcal, t) {
  const trail = [setcal(w, 'lunar')];
  trail.push(pick(w, birthId + '_LY', t.y), pick(w, birthId + '_LM', t.m), pick(w, birthId + '_LD', t.d), chk(w, birthId + '_LEAP', t.leap));
  return trail.join(',');
}
const setSajuCal = (w, x) => { try { w.setSajuCal(x); return 'ok'; } catch (e) { return 'ERR'; } };
const setNamingCal = (w, x) => { try { w.setNamingCal(x); return 'ok'; } catch (e) { return 'ERR'; } };
const setTarotCal = (w, x) => { try { w.setTarotCal(x); return 'ok'; } catch (e) { return 'ERR'; } };

async function drive(w, expr) {
  w.__calls = [];
  try { w.eval(expr); } catch (e) { return { err: 'THROW:' + ((e && e.message) || String(e)) }; }
  await sleep(220);
  const bodies = w.__calls.filter(Boolean);
  if (!bodies.length) return { err: 'NOCALL' };
  return { bodies };
}

// ══════════════════════════════════════════════════════════════════════════
// ⑷ 시나리오 — 경로 하나 = 부팅 하나 (상태 오염 차단)
// ══════════════════════════════════════════════════════════════════════════
/**
 * @param {string} html
 * @param {'direct'|'fallback'|'lunarleap'|'fallback_lunarleap'} kind
 * @param {boolean} withClosed 역방향 대조군(saju·compat·tojeong)도 함께 채집할지
 */
async function scenario(html, kind, withClosed) {
  const w = await boot(html);
  const out = { kind, got: {}, errs: [], closed: {}, trail: [] };
  const fallbackKind = (kind === 'fallback' || kind === 'fallback_lunarleap');
  const lunarKind = (kind === 'lunarleap' || kind === 'fallback_lunarleap');

  // ── 사주 탭 — 폴백 경로의 **출처**. 직접 경로에서도 돌려 둔다(폴백이 섞이면 그것도 결함이므로).
  setv(w, 'sajuName', '검사'); setv(w, 'sajuGender', FX_SAJU.g);
  if (kind === 'fallback_lunarleap') {
    out.trail.push('sajuLunar:' + driveLunar(w, 'sajuBirth', setSajuCal, FX_LUNAR));
    setv(w, 'sajuHour', String(FX_LUNAR.h));
  } else {
    setv(w, 'sajuBirth', FX_SAJU.bs); setv(w, 'sajuHour', String(FX_SAJU.h));
  }
  const rs = await drive(w, 'analyzeSaju()');
  if (rs.err) out.errs.push('analyzeSaju:' + rs.err);
  else if (withClosed && rs.bodies[0] && rs.bodies[0].type === 'saju') out.closed.saju = rs.bodies[0].context;

  if (withClosed) {
    setv(w, 'cName1', '갑돌'); setv(w, 'cName2', '을순');
    setv(w, 'cBirth1', FX_SAJU.bs); setv(w, 'cBirth2', FX_FORM.bs);
    setv(w, 'cHour1', String(FX_SAJU.h)); setv(w, 'cHour2', String(FX_FORM.h));
    setv(w, 'cGender1', 'male'); setv(w, 'cGender2', 'female');
    const rc = await drive(w, 'analyzeCompat()');
    if (rc.err) out.errs.push('analyzeCompat:' + rc.err); else out.closed.compat = rc.bodies[0].context;
    setv(w, 'tjName', '검사'); setv(w, 'tjGender', 'male');
    setv(w, 'tjBirth', FX_SAJU.bs); setv(w, 'tjTargetYear', '2031');
    const rt = await drive(w, 'analyzeTojeong()');
    if (rt.err) out.errs.push('analyzeTojeong:' + rt.err); else out.closed.tojeong = rt.bodies[0].context;
  }

  // ── 작명(사람) ─────────────────────────────────────────────────────────
  chip(w, 'ntype', 'person'); chip(w, 'nstyle', 'traditional'); chip(w, 'nlen', '3');
  setv(w, 'namingSurname', '김'); setv(w, 'namingSurnameHanja', '金');
  setv(w, 'namingGender', 'male'); setv(w, 'namingPreferred', '宇');
  setv(w, 'namingHangryeolHanja', '俊'); setv(w, 'namingHangryeolPos', 'first');
  if (fallbackKind) {
    setNamingCal(w, 'solar'); setv(w, 'namingBirth', ''); setv(w, 'namingHour', '-1');
  } else if (lunarKind) {
    out.trail.push('namingLunar:' + driveLunar(w, 'namingBirth', setNamingCal, FX_LUNAR));
    setv(w, 'namingHour', String(FX_LUNAR.h));
  } else {
    setNamingCal(w, 'solar'); setv(w, 'namingBirth', FX_FORM.bs); setv(w, 'namingHour', String(FX_FORM.h));
  }
  const rn = await drive(w, 'analyzeNaming()');
  if (rn.err) out.errs.push('naming:' + rn.err); else out.got.naming = rn.bodies[0].context;

  const rnp = await drive(w, 'unlockNamingPremium()');
  if (rnp.err) out.errs.push('naming_premium:' + rnp.err);
  else for (const b of rnp.bodies) { if (WAVE_A_TYPES.indexOf(b.type) >= 0) out.got[b.type] = b.context; }

  // ── 닉네임 ────────────────────────────────────────────────────────────
  chip(w, 'ntype', 'nickname');
  setv(w, 'namingNickPlatform', '인스타'); setv(w, 'namingNickVibe', '신비'); setv(w, 'namingNickLang', '한글');
  const rk = await drive(w, 'analyzeNaming()');
  if (rk.err) out.errs.push('naming_nickname:' + rk.err); else out.got.naming_nickname = rk.bodies[0].context;

  // ── 타로 ★폴백 경로가 없다 — 폴백 시나리오에서는 채집하지 않는다 ────────
  if (!fallbackKind) {
    const f = w.document.getElementById('tarotSajuFields');
    if (f) f.style.display = 'block'; else out.errs.push('tarot:NOFIELDS');
    setv(w, 'tarotQuestion', '검사 질문'); setv(w, 'tarotGender', 'female');
    if (lunarKind) {
      out.trail.push('tarotLunar:' + driveLunar(w, 'tarotBirth', setTarotCal, FX_LUNAR));
      setv(w, 'tarotHour', String(FX_LUNAR.h));
    } else {
      setTarotCal(w, 'solar'); setv(w, 'tarotBirth', FX_FORM.bs); setv(w, 'tarotHour', String(FX_FORM.h));
    }
    const ra = await drive(w, 'analyzeTarot()');
    if (!ra.err) out.errs.push('analyzeTarot:UNEXPECTED_CALL');   // 카드만 뽑고 호출은 없어야 정상
    else if (ra.err !== 'NOCALL') out.errs.push('analyzeTarot:' + ra.err);
    const rt2 = await drive(w, 'showTarotReading()');
    if (rt2.err) out.errs.push('tarot:' + rt2.err); else out.got.tarot = rt2.bodies[0].context;
    const rtp = await drive(w, 'unlockTarotPremium()');
    if (rtp.err) out.errs.push('tarot_premium:' + rtp.err);
    else for (const b of rtp.bodies) { if (WAVE_A_TYPES.indexOf(b.type) >= 0) out.got[b.type] = b.context; }
  }

  try { w.close(); } catch (e) { /* 정리 실패가 판정을 바꾸지 않는다 */ }
  return out;
}

/** 사주도 없고 폼 입력도 없는 요청 — 계약 §6 `mode:'legacy'` 의 클라 쪽 조건 */
async function scenarioLegacy(html) {
  const w = await boot(html);
  const out = { got: {}, errs: [] };
  chip(w, 'ntype', 'person'); chip(w, 'nstyle', 'traditional'); chip(w, 'nlen', '3');
  setv(w, 'namingSurname', '김'); setv(w, 'namingGender', 'male');
  setNamingCal(w, 'solar'); setv(w, 'namingBirth', ''); setv(w, 'namingHour', '-1');
  const rn = await drive(w, 'analyzeNaming()');
  if (rn.err) out.errs.push('naming:' + rn.err); else out.got.naming = rn.bodies[0].context;
  chip(w, 'ntype', 'nickname');
  setv(w, 'namingNickPlatform', '인스타'); setv(w, 'namingNickVibe', '신비');
  const rk = await drive(w, 'analyzeNaming()');
  if (rk.err) out.errs.push('naming_nickname:' + rk.err); else out.got.naming_nickname = rk.bodies[0].context;
  // 타로 — 사주 토글을 **닫은 채**(기본값) 돌린다
  setv(w, 'tarotQuestion', '검사 질문');
  await drive(w, 'analyzeTarot()');
  const rt = await drive(w, 'showTarotReading()');
  if (rt.err) out.errs.push('tarot:' + rt.err); else out.got.tarot = rt.bodies[0].context;
  try { w.close(); } catch (e) { /* noop */ }
  return out;
}

// ══════════════════════════════════════════════════════════════════════════
// ⑷-b 파 ⓑ 시나리오 — `dream`(3) · `daily_message`
//     ★값 출처가 `window._sajuResultData` 하나뿐이므로 「사주 탭을 어떻게 돌렸는가」가
//       그대로 기대값이 된다. 상품 폼에는 생년월일 입력란이 **없다**.
// ══════════════════════════════════════════════════════════════════════════
/**
 * @param {string} html
 * @param {'linked'|'b_lunarleap'|'nohour'|'unlinked_off'|'nosaju'} kind
 * @param {string} [chatSrc]
 */
async function scenarioB(html, kind, chatSrc) {
  const w = await boot(html, chatSrc);
  const out = { kind, got: {}, errs: [], trail: [] };
  const withSaju = (kind !== 'nosaju');

  if (withSaju) {
    setv(w, 'sajuName', '검사'); setv(w, 'sajuGender', FX_SAJU.g);
    if (kind === 'b_lunarleap') {
      out.trail.push('sajuLunar:' + driveLunar(w, 'sajuBirth', setSajuCal, FX_LUNAR));
      setv(w, 'sajuHour', String(FX_LUNAR.h));
    } else {
      setSajuCal(w, 'solar');
      setv(w, 'sajuBirth', FX_SAJU.bs);
      setv(w, 'sajuHour', kind === 'nohour' ? '-1' : String(FX_SAJU.h));
    }
    const rs = await drive(w, 'analyzeSaju()');
    if (rs.err) out.errs.push('analyzeSaju:' + rs.err);
    else if (!w._sajuResultData) out.errs.push('analyzeSaju:NO_GLOBAL');
  } else if (w._sajuResultData) {
    out.errs.push('nosaju:_sajuResultData 가 이미 있다 — 시나리오 전제가 깨졌다');
  }

  // ── 꿈해몽 ──────────────────────────────────────────────────────────────
  const lk = w.document.getElementById('dreamLinkSaju');
  if (!lk) out.errs.push('dream:NO_LINK_TOGGLE');
  else lk.checked = (withSaju && kind !== 'unlinked_off');
  setv(w, 'dreamStory', '큰 호랑이가 산에서 나타나 함께 내려왔다');
  const rd = await drive(w, 'analyzeDream()');
  if (rd.err) out.errs.push('dream:' + rd.err); else out.got.dream = rd.bodies[0].context;

  const rp = await drive(w, 'unlockDreamPremium()');
  if (rp.err) out.errs.push('dream_premium:' + rp.err);
  else for (const b of rp.bodies) { if (WAVE_B_TYPES.indexOf(b.type) >= 0) out.got[b.type] = b.context; }

  // ★재시도 경로 — 결제 후 1회 실패한 사용자만 밟는다. 안 세면 조용히 legacy 로 떨어진다.
  const rr = await drive(w, 'retryDreamPremiumAPI()');
  if (rr.err) out.errs.push('dream_retry:' + rr.err);
  else for (const b of rr.bodies) { if (WAVE_B_TYPES.indexOf(b.type) >= 0) out.got[b.type + '@retry'] = b.context; }

  // ── 데일리 한 마디 ──────────────────────────────────────────────────────
  //   ★`linkSaju` 같은 토글이 **없다**. 사주가 있으면 항상 연동이므로
  //     `unlinked_off` 시나리오에서는 채집하지 않는다(분모를 그만큼 줄인다).
  if (kind !== 'unlinked_off') {
    const rm = await drive(w, "fetchDailyMessage('general')");
    if (rm.err) out.errs.push('daily_message:' + rm.err); else out.got.daily_message = rm.bodies[0].context;
  }

  try { w.close(); } catch (e) { /* 정리 실패가 판정을 바꾸지 않는다 */ }
  return out;
}

// ══════════════════════════════════════════════════════════════════════════
// ⑸ 판정기
// ══════════════════════════════════════════════════════════════════════════
function isInt(v) { return typeof v === 'number' && Number.isInteger(v); }
/** 6키가 계약 §2-1 의 형·범위를 지키는가 */
function shapeErr(o) {
  const e = [];
  for (const k of BIRTH_KEYS) if (!Object.prototype.hasOwnProperty.call(o, k)) e.push('missing:' + k);
  if (e.length) return e;
  if (o.cal !== 'solar' && o.cal !== 'lunar') e.push('cal=' + JSON.stringify(o.cal));
  if (!isInt(o.y) || o.y < 1900 || o.y > 2050) e.push('y=' + JSON.stringify(o.y));
  if (!isInt(o.m) || o.m < 1 || o.m > 12) e.push('m=' + JSON.stringify(o.m));
  if (!isInt(o.d) || o.d < 1 || o.d > 31) e.push('d=' + JSON.stringify(o.d));
  if (!isInt(o.h) || o.h < -1 || o.h > 11) e.push('h=' + JSON.stringify(o.h));
  if (typeof o.leap !== 'boolean') e.push('leap=' + JSON.stringify(o.leap));
  if (o.cal === 'solar' && o.leap !== false) e.push('solar 인데 leap=true');
  return e;
}
/** 기대값과 **정확히** 같은가 */
function valueErr(o, want) {
  const e = [];
  for (const k of BIRTH_KEYS) if (o[k] !== want[k]) e.push(k + '=' + JSON.stringify(o[k]) + '!=' + JSON.stringify(want[k]));
  return e;
}
/**
 * 파 ⓑ — **슬롯** 목록 기준 위반. 기대값을 명시로 받는다
 * (`sc.kind` 와 `WANT` 키가 1:1이 아니고, 미적재 경로는 기대값 자체가 없다).
 */
function violationsB(sc, slots, want) {
  const bad = [];
  for (const s of slots) {
    const ctx = sc.got[s];
    if (!ctx) { bad.push(sc.kind + '/' + s + ':미채집'); continue; }
    const se = shapeErr(ctx);
    if (se.length) { bad.push(sc.kind + '/' + s + ':' + se.join('|')); continue; }
    const ve = valueErr(ctx, want);
    if (ve.length) bad.push(sc.kind + '/' + s + ':' + ve.join('|'));
  }
  return bad;
}
/**
 * ★6키가 **한 개도** 없어야 하는 경로의 위반.
 *   부분 적재는 서버가 `discarded` 로 판정해 원국을 통째로 폐기한다(계약 §6).
 *   미연동에서 6키를 만들어 내면 서버는 그것을 참으로 믿고 재유도한다 — 없는 사실의 날조다.
 */
function leakedB(sc, slots) {
  const bad = [];
  for (const s of slots) {
    const ctx = sc.got[s];
    if (!ctx) { bad.push(sc.kind + '/' + s + ':미채집'); continue; }
    const has = BIRTH_KEYS.filter((k) => Object.prototype.hasOwnProperty.call(ctx, k));
    if (has.length) bad.push(sc.kind + '/' + s + ':' + has.join(',') + '=' + has.map((k) => JSON.stringify(ctx[k])).join(','));
  }
  return bad;
}

/** 시나리오 하나의 위반 목록 */
function violations(sc, types) {
  const bad = [];
  const want = WANT[sc.kind];
  for (const t of types) {
    const ctx = sc.got[t];
    if (!ctx) { bad.push(sc.kind + '/' + t + ':미채집'); continue; }
    const se = shapeErr(ctx);
    if (se.length) { bad.push(sc.kind + '/' + t + ':' + se.join('|')); continue; }
    const ve = valueErr(ctx, want);
    if (ve.length) bad.push(sc.kind + '/' + t + ':' + ve.join('|'));
  }
  return bad;
}

// ══════════════════════════════════════════════════════════════════════════
// ⑹ 뮤턴트 — 「게이트가 실제로 작동하는가」를 스스로 증명한다
//    ★MUT-A 직접 경로 적재 제거 · MUT-B `_sajuResultData` 의 윤달 소실(I-70 형태)
// ══════════════════════════════════════════════════════════════════════════
const MUT_A = { anchor: '...cwBirthKeys(br.calType,br.y,br.m,br.d,hi,br.leap),', to: '', kind: 'direct', types: ['naming', 'naming_nickname', 'tarot'] };
const MUT_B = { anchor: 'leap:(calType===\'lunar\'?!!br.leap:false),hi', to: 'leap:false,hi', kind: 'fallback_lunarleap', types: ['naming', 'naming_nickname'] };
// ★파 ⓑ 뮤턴트 — ⒞ `analyzeDream` 의 적재 제거 ⒟ `js/chat.js` 의 적재 제거.
//   ⒞ 는 **`dream` 슬롯만** 죽는다(프리미엄·재시도는 `_buildDreamContext` 를 쓴다) —
//   그 비대칭 자체가 「적재 지점이 둘」이라는 사실의 증거다.
const MUT_C = { anchor: 'cal:_bkDr.cal,y:_bkDr.y,m:_bkDr.m,d:_bkDr.d,h:_bkDr.h,leap:_bkDr.leap', to: '', slots: ['dream'] };
const MUT_D = { anchor: 'cal:_bkC.cal,y:_bkC.y,m:_bkC.m,d:_bkC.d,h:_bkC.h,leap:_bkC.leap', to: '', slots: ['daily_message'] };

(async function main() {
  let SC = {}, LEGACY = null, FATAL = null, MUTA = null, MUTB = null, CTL = null;
  let SB = {}, MUTC = null, MUTD = null, CTLB = null;
  try {
    SC.direct = await scenario(HTML, 'direct', false);
    SC.fallback = await scenario(HTML, 'fallback', true);      // ★역방향 대조군은 여기서 같이 채집
    SC.lunarleap = await scenario(HTML, 'lunarleap', false);
    SC.fallback_lunarleap = await scenario(HTML, 'fallback_lunarleap', false);
    LEGACY = await scenarioLegacy(HTML);
    if (HTML.split(MUT_A.anchor).length - 1 === 1) MUTA = await scenario(HTML.replace(MUT_A.anchor, MUT_A.to), MUT_A.kind, false);
    if (HTML.split(MUT_B.anchor).length - 1 === 1) MUTB = await scenario(HTML.replace(MUT_B.anchor, MUT_B.to), MUT_B.kind, false);
    CTL = await scenario(HTML, 'direct', false);
    // ── 파 ⓑ ──
    SB.linked = await scenarioB(HTML, 'linked');
    SB.b_lunarleap = await scenarioB(HTML, 'b_lunarleap');
    SB.nohour = await scenarioB(HTML, 'nohour');
    SB.unlinked_off = await scenarioB(HTML, 'unlinked_off');
    SB.nosaju = await scenarioB(HTML, 'nosaju');
    if (HTML.split(MUT_C.anchor).length - 1 === 1) MUTC = await scenarioB(HTML.replace(MUT_C.anchor, MUT_C.to), 'linked');
    if (CHAT_SRC.split(MUT_D.anchor).length - 1 === 1) MUTD = await scenarioB(HTML, 'linked', CHAT_SRC.replace(MUT_D.anchor, MUT_D.to));
    CTLB = await scenarioB(HTML, 'linked');
  } catch (e) { FATAL = (e && e.stack) ? String(e.stack).slice(0, 500) : String(e); }

  if (FATAL) { check('B-0', '★런타임 채집', () => ({ ok: false, detail: '★판정 불가(통과 아님): ' + FATAL })); done(); }

  const P1 = WAVE_A_TYPES, P2 = FALLBACK_TYPES;
  const PLAN = [
    ['direct', P1], ['fallback', P2], ['lunarleap', P1], ['fallback_lunarleap', P2],
  ];
  const SAMPLES_MIN = P1.length * 2 + P2.length * 2;   // 7+4+7+4 = 22

  check('B-0', '★커버리지 — 경로 4종 × 파 ⓐ 상품 7종(폴백은 4종) = payload ' + SAMPLES_MIN + '벌을 **전건** 채집한다', () => {
    const errs = [], missing = [];
    let n = 0;
    for (const [k, types] of PLAN) {
      const sc = SC[k];
      if (!sc) { errs.push(k + ':미구동'); continue; }
      if (sc.errs.length) errs.push(k + ':' + sc.errs.join(','));
      for (const t of types) { if (sc.got[t]) n++; else missing.push(k + '/' + t); }
    }
    if (errs.length) return { ok: false, detail: '★구동 실패: ' + errs.slice(0, 8).join(' / ') };
    if (missing.length) return { ok: false, detail: '★미채집 ' + missing.length + ': ' + missing.slice(0, 10).join(',') };
    if (n !== SAMPLES_MIN) return { ok: false, detail: '★payload ' + n + ' != ' + SAMPLES_MIN };
    // ★타로에 폴백 경로가 정말로 없는지 — 있다면 분모를 늘려야 한다
    const tarotInFallback = ['tarot', 'tarot_premium_1', 'tarot_premium_2'].filter((t) => SC.fallback.got[t]);
    if (tarotInFallback.length) return { ok: false, detail: '★타로에 폴백 경로가 생겼다(' + tarotInFallback.join(',') + ') — FALLBACK_TYPES 분모를 늘리십시오' };
    return { ok: true, detail: 'payload ' + n + '벌 (direct ' + P1.length + ' · fallback ' + P2.length + ' · lunarleap ' + P1.length + ' · fallback_lunarleap ' + P2.length + ')' };
  });

  check('B-1', '★★직접 입력 경로 — 6키가 파 ⓐ 상품 ' + P1.length + '종 payload 에 **전건 도달**하고 값이 입력과 일치한다', () => {
    const bad = violations(SC.direct, P1);
    return { ok: bad.length === 0, detail: bad.length ? '★' + bad.length + '/' + P1.length + ': ' + bad.join(' / ') : P1.length + '종 전건 ' + JSON.stringify(WANT.direct) };
  });

  check('B-2', '★★폴백 경로(`_sajuResultData` 재사용) — 6키가 naming 계열 ' + P2.length + '종에 도달한다 (I-70 이 난 자리)', () => {
    const bad = violations(SC.fallback, P2);
    return { ok: bad.length === 0, detail: bad.length ? '★' + bad.length + '/' + P2.length + ': ' + bad.join(' / ') : P2.length + '종 전건 ' + JSON.stringify(WANT.fallback) };
  });

  check('B-3', '★★음력 윤달 — 직접·폴백 **양쪽**에서 `cal:lunar`·`leap:true`·음력 원본 y/m/d 가 실린다', () => {
    const bad = violations(SC.lunarleap, P1).concat(violations(SC.fallback_lunarleap, P2));
    return { ok: bad.length === 0, detail: bad.length ? '★' + bad.length + '건: ' + bad.join(' / ') : (P1.length + P2.length) + '종 전건 ' + JSON.stringify(WANT.lunarleap) };
  });

  check('B-4', '★역방향 대조군(계약 §8) — 이미 닫힌 `saju`·`compat`·`tojeong` payload 가 **무변경**이다', () => {
    const bad = [];
    for (const t of Object.keys(CLOSED_PIN)) {
      const ctx = SC.fallback.closed[t];
      if (!ctx) { bad.push(t + ':미채집'); continue; }
      const s = closedSha(ctx);
      if (s !== CLOSED_PIN[t]) bad.push(t + ' sha ' + s.slice(0, 16) + ' != pin ' + CLOSED_PIN[t].slice(0, 16));
      // saju 는 6키를 안 쓴다. compat/tojeong 은 접미사/자기 규약이 따로 있으므로 새 키 유입만 본다.
      if (t === 'saju') { const leak = BIRTH_KEYS.filter((k) => Object.prototype.hasOwnProperty.call(ctx, k)); if (leak.length) bad.push('saju 로 유입: ' + leak.join(',')); }
    }
    return { ok: bad.length === 0, detail: bad.length ? '★' + bad.join(' / ') : '3종 정규화 sha256 핀 일치 (volatile 제외: ' + CLOSED_VOLATILE.join(',') + ')' };
  });

  check('B-5', '★하위호환(계약 §6 `legacy`) — 사주가 **없는** 요청은 6키를 한 개도 싣지 않는다 (부분 적재 금지)', () => {
    if (!LEGACY) return { ok: false, detail: '★미구동 — 판정 불가' };
    if (LEGACY.errs.length) return { ok: false, detail: '★구동 실패: ' + LEGACY.errs.join(' / ') };
    const bad = [];
    for (const t of Object.keys(LEGACY.got)) {
      const has = BIRTH_KEYS.filter((k) => Object.prototype.hasOwnProperty.call(LEGACY.got[t], k));
      if (has.length) bad.push(t + ':' + has.join(',') + ' — 부분 적재는 서버가 `discarded` 로 판정해 원국을 폐기한다');
    }
    return { ok: bad.length === 0, detail: bad.length ? '★' + bad.join(' / ') : Object.keys(LEGACY.got).length + '종 전부 6키 0개 (legacy)' };
  });

  check('B-6', '★★자기 뮤턴트 2종 — 적재를 지운 **사본**에서 B-1/B-3 이 실제로 적발한다', () => {
    const msg = [];
    if (!MUTA) return { ok: false, detail: '★MUT-A 앵커가 1건이 아니다 — 판정 불가는 통과가 아니다 (앵커: ' + MUT_A.anchor + ')' };
    if (!MUTB) return { ok: false, detail: '★MUT-B 앵커가 1건이 아니다 — 판정 불가는 통과가 아니다 (앵커: ' + MUT_B.anchor + ')' };
    const a = violations(MUTA, MUT_A.types);
    if (!a.length) return { ok: false, detail: '★MUT-A(직접 경로 적재 제거)를 못 잡았다 — B-1 의 통과는 아무것도 증명하지 않는다' };
    msg.push('MUT-A 적발 ' + a.length + '건');
    const b = violations(MUTB, MUT_B.types);
    if (!b.length) return { ok: false, detail: '★MUT-B(`_sajuResultData` 윤달 소실)를 못 잡았다 — 폴백 윤달은 감시되지 않는다' };
    msg.push('MUT-B 적발 ' + b.length + '건');
    return { ok: true, detail: msg.join(' · ') };
  });

  check('B-7', '★긍정 짝 — **무변경** 사본에서는 아무것도 안 잡힌다 (B-6 이 항상-적발인 위약 차단)', () => {
    if (!CTL) return { ok: false, detail: '★대조 사본 미구동 — 판정 불가' };
    if (CTL.errs.length) return { ok: false, detail: '★대조 사본 구동 실패: ' + CTL.errs.join(' / ') };
    const bad = violations(CTL, MUT_A.types);
    return { ok: bad.length === 0, detail: bad.length ? '★무변경본에서도 ' + bad.length + '건 잡힌다 — B-6 은 위약이다: ' + bad.join(' / ') : '무변경본 위반 0' };
  });

  check('B-8', '★단일 출처(결정 99·113) — 산출식 `cwBirthKeys` 1개 · 적재 지점 8곳이 **명시 리터럴**이다', () => {
    const defs = (HTML.match(/function\s+cwBirthKeys\s*\(/g) || []).length;
    if (defs !== 1) return { ok: false, detail: '★`cwBirthKeys` 정의 ' + defs + '개 — 0 이면 미구현, 2 이상이면 사본이 갈린다' };
    // ★적재는 payload **리터럴**로만 한다(§2-3 명시 맵 · `eval_ctx_key_surface.js` 표면 추출기 보존).
    const LIT = /cal:_bk[A-Za-z]*\.cal,\s*y:_bk[A-Za-z]*\.y,\s*m:_bk[A-Za-z]*\.m,\s*d:_bk[A-Za-z]*\.d,\s*h:_bk[A-Za-z]*\.h,\s*leap:_bk[A-Za-z]*\.leap/g;
    // 파 ⓐ 3(작명 사람 무료 · 닉네임 · `_buildNamingContext`) + 파 ⓑ 2(`analyzeDream` · `_buildDreamContext`)
    const inHtml = (HTML.match(LIT) || []).length;
    const inTarot = (TAROT_SRC.match(LIT) || []).length;  // 타로 무료 · 타로 프리미엄
    const inChat = (CHAT_SRC.match(LIT) || []).length;    // ★파 ⓑ `_gatherChatContext`
    if (inHtml !== 5 || inTarot !== 2 || inChat !== 1)
      return { ok: false, detail: '★적재 리터럴 index.html ' + inHtml + '(기대 5) · js/tarot.js ' + inTarot + '(기대 2) · js/chat.js ' + inChat + '(기대 1) — 파 ⓐ 5곳 + 파 ⓑ 3곳 = 8곳이다' };
    // 반입 블록 안에 들어가면 안 된다(양쪽 다 못 건드리는 구역)
    const bi = HTML.indexOf('CW_ENGINE_PORT BEGIN'), ei = HTML.indexOf('CW_ENGINE_PORT END');
    const at = HTML.indexOf('function cwBirthKeys');
    if (bi >= 0 && ei > bi && at > bi && at < ei) return { ok: false, detail: '★`cwBirthKeys` 가 반입 블록 안에 있다 — 블록은 생성물이다' };
    return { ok: true, detail: '산출식 1개 · 적재 리터럴 8곳(index.html 5 + js/tarot.js 2 + js/chat.js 1) · 반입 블록 밖' };
  });

  // ══════════════════════════════════════════════════════════════════════
  // 파 ⓑ — `dream`(3) · `daily_message`
  // ══════════════════════════════════════════════════════════════════════
  const B_PLAN = [
    ['linked', WAVE_B_SLOTS], ['b_lunarleap', WAVE_B_SLOTS], ['nohour', WAVE_B_SLOTS],
    ['unlinked_off', WAVE_B_DREAM_SLOTS], ['nosaju', WAVE_B_SLOTS],
  ];
  const B_SAMPLES_MIN = B_PLAN.reduce((n, [, s]) => n + s.length, 0);   // 6+6+6+5+6 = 29

  check('B-9', '★커버리지 — 경로 5종 × 파 ⓑ 사이트(재시도 포함 6곳 · linkSaju 꺼짐은 5곳) = payload ' + B_SAMPLES_MIN + '벌 **전건**', () => {
    const errs = [], missing = [];
    let n = 0;
    for (const [k, slots] of B_PLAN) {
      const sc = SB[k];
      if (!sc) { errs.push(k + ':미구동'); continue; }
      if (sc.errs.length) errs.push(k + ':' + sc.errs.join(','));
      for (const s of slots) { if (sc.got[s]) n++; else missing.push(k + '/' + s); }
    }
    if (errs.length) return { ok: false, detail: '★구동 실패: ' + errs.slice(0, 8).join(' / ') };
    if (missing.length) return { ok: false, detail: '★미채집 ' + missing.length + ': ' + missing.slice(0, 10).join(',') };
    if (n !== B_SAMPLES_MIN) return { ok: false, detail: '★payload ' + n + ' != ' + B_SAMPLES_MIN };
    // ★재시도 경로가 정말로 **별개 사이트**인지 — 같은 객체 참조를 두 번 센 것이면 측정이 아니다
    const a = SB.linked.got.dream_premium_1, b = SB.linked.got['dream_premium_1@retry'];
    if (!a || !b) return { ok: false, detail: '★재시도 슬롯 미채집' };
    return { ok: true, detail: 'payload ' + n + '벌 (linked 6 · 음력윤달 6 · 시간모름 6 · linkSaju꺼짐 5 · 사주없음 6)' };
  });

  check('B-10', '★★사주 **연동** — 6키가 `dream`(3, 재시도 포함)·`daily_message` payload ' + WAVE_B_SLOTS.length + '곳에 전건 도달한다', () => {
    const bad = violationsB(SB.linked, WAVE_B_SLOTS, WANT.linked);
    return { ok: bad.length === 0, detail: bad.length ? '★' + bad.length + '/' + WAVE_B_SLOTS.length + ': ' + bad.join(' / ') : WAVE_B_SLOTS.length + '곳 전건 ' + JSON.stringify(WANT.linked) };
  });

  check('B-11', '★★음력 윤달 — 사주 탭 음력 윤2월 입력이 `cal:lunar`·`leap:true`·**음력 원본** y/m/d 로 실린다', () => {
    const bad = violationsB(SB.b_lunarleap, WAVE_B_SLOTS, WANT.b_lunarleap);
    return { ok: bad.length === 0, detail: bad.length ? '★' + bad.length + '건: ' + bad.join(' / ') : WAVE_B_SLOTS.length + '곳 전건 ' + JSON.stringify(WANT.b_lunarleap) };
  });

  check('B-12', '★★시간 모름 — `h:-1` 이 실리고, ★`daily_message` 에 `hourBranch` 키가 **없다**(계약 §5-2)', () => {
    const bad = violationsB(SB.nohour, WAVE_B_SLOTS, WANT.nohour);
    if (bad.length) return { ok: false, detail: '★' + bad.length + '건: ' + bad.join(' / ') };
    // ★없는 사실을 지어내지 않는가 — `hourBranch` 는 「빈 문자열」이 아니라 **키 자체가 없어야** 한다.
    const dm = SB.nohour.got.daily_message;
    if (Object.prototype.hasOwnProperty.call(dm, 'hourBranch'))
      return { ok: false, detail: '★`h:-1` 인데 `hourBranch`=' + JSON.stringify(dm.hourBranch) + ' 가 있다 — 계약 §5-2 가 A 에게 준 사실이 깨졌다' };
    // 대조: 시각이 있는 경로에서는 반드시 있어야 한다(항상-없음 위약 차단)
    const dm2 = SB.linked.got.daily_message;
    if (!Object.prototype.hasOwnProperty.call(dm2, 'hourBranch'))
      return { ok: false, detail: '★연동 경로에도 `hourBranch` 가 없다 — 「없다」 판정이 아무것도 증명하지 않는다' };
    return { ok: true, detail: WAVE_B_SLOTS.length + '곳 전건 h:-1 · `hourBranch` 부재(연동 경로에는 ' + JSON.stringify(dm2.hourBranch) + ' 존재)' };
  });

  check('B-13', '★★사주 **미연동** — 6키를 **한 개도** 만들지 않는다 (없는 사실의 날조 금지 · 계약 §6 `legacy`)', () => {
    const bad = leakedB(SB.unlinked_off, WAVE_B_DREAM_SLOTS).concat(leakedB(SB.nosaju, WAVE_B_SLOTS));
    const n = WAVE_B_DREAM_SLOTS.length + WAVE_B_SLOTS.length;
    if (bad.length) return { ok: false, detail: '★' + bad.length + '/' + n + ': ' + bad.join(' / ') };
    // ★그 경로가 「그냥 아무것도 안 보낸 것」이 아님을 확인한다 — 자유 입력은 도달해야 한다
    const d = SB.nosaju.got.dream;
    if (!d || !d.story) return { ok: false, detail: '★미연동 payload 에 자유 입력(`story`)조차 없다 — 구동이 죽은 것이지 미적재가 아니다' };
    return { ok: true, detail: n + '곳 전부 6키 0개 (linkSaju 꺼짐 5 + 사주 없음 6) · 자유 입력은 정상 도달' };
  });

  check('B-14', '★★자기 뮤턴트 2종 — ⒞ `analyzeDream` 적재 제거 ⒟ `js/chat.js` 적재 제거를 B-10 이 적발한다', () => {
    const msg = [];
    if (!MUTC) return { ok: false, detail: '★MUT-C 앵커가 1건이 아니다 — 판정 불가는 통과가 아니다 (앵커: ' + MUT_C.anchor + ')' };
    if (!MUTD) return { ok: false, detail: '★MUT-D 앵커가 1건이 아니다 — 판정 불가는 통과가 아니다 (앵커: ' + MUT_D.anchor + ')' };
    const c = violationsB(MUTC, MUT_C.slots, WANT.linked);
    if (!c.length) return { ok: false, detail: '★MUT-C(`analyzeDream` 적재 제거)를 못 잡았다 — B-10 의 통과는 아무것도 증명하지 않는다' };
    // ★비대칭 확인 — 프리미엄은 **다른 적재 지점**이므로 살아 있어야 한다.
    //   같이 죽으면 적재가 한 곳뿐이라는 뜻이고, 그러면 재시도 경로 분모가 거짓이다.
    const cAlive = violationsB(MUTC, ['dream_premium_1', 'dream_premium_1@retry'], WANT.linked);
    if (cAlive.length) return { ok: false, detail: '★MUT-C 가 프리미엄까지 죽였다 — 적재 지점이 2곳이라는 분모가 틀렸다: ' + cAlive.join(' / ') };
    msg.push('MUT-C 적발 ' + c.length + '건(프리미엄은 생존 — 적재 지점 2곳 확인)');
    const d = violationsB(MUTD, MUT_D.slots, WANT.linked);
    if (!d.length) return { ok: false, detail: '★MUT-D(`js/chat.js` 적재 제거)를 못 잡았다 — daily_message 는 감시되지 않는다' };
    msg.push('MUT-D 적발 ' + d.length + '건');
    return { ok: true, detail: msg.join(' · ') };
  });

  check('B-15', '★긍정 짝 — **무변경** 사본에서는 파 ⓑ 위반이 0 이다 (B-14 가 항상-적발인 위약 차단)', () => {
    if (!CTLB) return { ok: false, detail: '★대조 사본 미구동 — 판정 불가' };
    if (CTLB.errs.length) return { ok: false, detail: '★대조 사본 구동 실패: ' + CTLB.errs.join(' / ') };
    const bad = violationsB(CTLB, WAVE_B_SLOTS, WANT.linked);
    return { ok: bad.length === 0, detail: bad.length ? '★무변경본에서도 ' + bad.length + '건 잡힌다 — B-14 는 위약이다: ' + bad.join(' / ') : '무변경본 위반 0' };
  });

  done();
})().catch((e) => {
  check('B-FATAL', '★게이트 자체가 죽었다 (판정 불가 ≠ 통과)', () => ({ ok: false, detail: (e && e.stack) ? String(e.stack).slice(0, 400) : String(e) }));
  done();
});
