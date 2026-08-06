#!/usr/bin/env node
/* eval/eval_token_roundtrip.js — 발급부↔검증부 「토큰 규격 갈라짐」 게이트 (2026-07-31 v7.67 신설)
 *
 * 【왜 필요한가 — 실측된 공백】
 *   P1-AUTH 안 B 는 토큰 **발급부**를 api/confirm-payment.js 에, **검증부**를 api/fortune.js 에
 *   두었다. 두 파일은 서로를 import 하지 않고, 규격(접두어·필드명·서명 입력·인코딩·TTL·알고리즘)을
 *   각자 독립적으로 구현한다. v7.66 까지 이 두 규격이 갈라져도 적발하는 게이트가 **하나도 없었다**.
 *   eval_response_scrub.js 는 하네스가 **자기 손으로** 규격대로 서명한 토큰을 쓰므로
 *   「문서 규격 ↔ 검증부」만 보증하고 「발급부 ↔ 검증부」는 무검사였다.
 *   ⟹ 발급부만 고치면(예: pk → productKey) 실서비스는 결제 직후 전건 403 이 되는데
 *      게이트는 전부 초록이었다.
 *
 * 【무엇을 판정하는가 — 결정 49 정합】
 *   「이 구현이 있는가」(규격 문자열 grep)가 아니라 **성질**로 판정한다:
 *     P1. 발급부가 실제로 만들어낸 토큰이 검증부에서 실제로 통과한다 (프리미엄 전건).
 *     P2. 그 통과는 상품(pk)·서명·시크릿·유효창에 실제로 결속돼 있다
 *         — 한 축만 어긋나도 검증부가 거부한다.
 *     P3. 발급부만 또는 검증부만 바꾸면 P1 이 반드시 깨진다.
 *   P3 는 이 파일이 「어떻게 구현됐는지」를 보지 않기 때문에 성립한다. 두 모듈을 실제로
 *   적재해 왕복시키므로, 어느 한쪽의 규격이 이동하면 왕복이 성립하지 않는다.
 *   ★이름 기반 면제·exempt_if·scope 면제는 두지 않는다.
 *
 * 【열거와 판정의 분리 — 정직한 한계】
 *   프리미엄 type 목록과 상품 가격은 소스에서 **열거**한다(파싱). 이것은 「무엇을 왕복시킬
 *   대상으로 삼는가」를 정하는 절차이며 판정 기준이 아니다. 열거가 실패하면 검사 수 하한
 *   pin(D3)이 즉시 FAIL 하므로 조용한 무검사가 되지 않는다.
 *
 * 【실 키·외부 왕복 금지】
 *   TOSS_SECRET_KEY · ANTHROPIC_API_KEY · CW_PREMIUM_HMAC_SECRET 은 매 실행 난수로 심는다.
 *   fetch 는 적재 **이전에** 고정 디스패처로 교체하고, 화이트리스트(tosspayments·anthropic) 밖
 *   호출은 예외로 되돌린다. A7 이 「화이트리스트 밖 호출 0건」을 실측한다.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const EXPECTED_TOTAL = 51;          // ★검사 수 하한 pin (외부 pin 표와 짝)
const PINS_REL = '_gate_pins.json';
const RUNNER_REL = 'tools/run_gate.js';

// ── 결과 수집 ────────────────────────────────────────────────────────────────
const results = [];
function ck(id, cond, detail) { results.push({ id: id, ok: !!cond, detail: detail || '' }); }
async function asec(id, body) {
  try { await body(); }
  catch (e) { ck(id + ' [BLOCK]', false, 'EXCEPTION(fail-closed): ' + ((e && e.message) || String(e))); }
}
function lazy(fn) {
  let done = false, val, err;
  return function () {
    if (!done) { done = true; try { val = fn(); } catch (e) { err = e; } }
    if (err) throw err;
    return val;
  };
}
function rtok(n) { return crypto.randomBytes(Math.ceil(n / 2)).toString('hex').slice(0, n); }
function sha256(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }

// ── front_root ──────────────────────────────────────────────────────────────
const ISSUER_REL = path.join('api', 'confirm-payment.js');
const VERIFIER_REL = path.join('api', 'fortune.js');
function hasBoth(dir) {
  try { return fs.existsSync(path.join(dir, ISSUER_REL)) && fs.existsSync(path.join(dir, VERIFIER_REL)); }
  catch (e) { return false; }
}
const FRONT_ROOT = lazy(function () {
  const env = process.env.CHUNWOON_FRONT_ROOT;
  if (env && hasBoth(env)) return env;
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (hasBoth(dir)) return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
});
function readSrc(rel) {
  const root = FRONT_ROOT();
  if (!root) throw new Error('front_root 미해석 — CHUNWOON_FRONT_ROOT 를 지정하십시오');
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) throw new Error(rel + ' 부재: ' + p);
  const buf = fs.readFileSync(p);
  return { path: p, buf: buf, src: buf.toString('utf8'), sha256: sha256(buf), size: buf.length };
}
const ISSUER_SRC = lazy(function () { return readSrc(ISSUER_REL); });
const VERIFIER_SRC = lazy(function () { return readSrc(VERIFIER_REL); });

// ── fetch 디스패처 (적재 이전 설치 · 참조 동일성 불변) ────────────────────────
const FETCH_SLOT = { impl: null };
const NET = { all: [], toss: 0, llm: 0, forbidden: [] };
function installFetch() {
  const shim = function () {
    const f = FETCH_SLOT.impl;
    if (typeof f !== 'function') return Promise.reject(new Error('fetch 미구성(게이트 내부)'));
    return f.apply(null, Array.prototype.slice.call(arguments));
  };
  try {
    Object.defineProperty(shim, 'name', { value: 'fetch', configurable: true });
    Object.defineProperty(shim, 'toString', {
      value: function () { return 'function fetch() { [native code] }'; }, writable: true, configurable: true
    });
  } catch (e) { /* 위장 실패는 판정에 영향 없음 */ }
  globalThis.fetch = shim;
}
function tossImpl(expect, over) {
  return async function (url) {
    const u = String(url);
    NET.all.push(u);
    if (u.indexOf('https://api.tosspayments.com/v1/payments') === 0) {
      NET.toss++;
      const d = Object.assign({
        status: 'DONE', orderId: expect.orderId, orderName: '천운 상품', method: '카드',
        totalAmount: expect.amount, approvedAt: '2026-07-31T00:00:00+09:00',
        receipt: { url: 'https://receipt.invalid/' + rtok(6) }
      }, over || {});
      return { ok: true, status: 200, json: async () => d, text: async () => JSON.stringify(d) };
    }
    NET.forbidden.push(u);
    throw new Error('게이트 차단: 화이트리스트 밖 외부 왕복 ' + u);
  };
}
function llmImpl() {
  return async function (url) {
    const u = String(url);
    NET.all.push(u);
    if (u.indexOf('https://api.anthropic.com/') === 0) {
      NET.llm++;
      const d = { content: [{ type: 'text', text: '{"ok":1,"summary":"게이트 표본 응답"}' }] };
      return { ok: true, status: 200, json: async () => d, text: async () => JSON.stringify(d) };
    }
    NET.forbidden.push(u);
    throw new Error('게이트 차단: 화이트리스트 밖 외부 왕복 ' + u);
  };
}

// ── 난수 환경 (실 키 사용 0) ─────────────────────────────────────────────────
const GATE_ENV = lazy(function () {
  return {
    toss: 'test_sk_' + rtok(28),
    anthropic: 'sk-ant-api03-' + rtok(30),
    secret: rtok(64)
  };
});

// ── 두 모듈 실적재 ───────────────────────────────────────────────────────────
const RT = {
  loaded: false, error: null, issuer: null, verifier: null,
  dir: null, cjsCopySha: null, esmCopySha: null, importMs: 0,
  issueCalls: 0, verifyCalls: 0
};
async function load() {
  if (RT.loaded) return RT;
  RT.loaded = true;
  try {
    installFetch();
    process.env.TOSS_SECRET_KEY = GATE_ENV().toss;
    process.env.ANTHROPIC_API_KEY = GATE_ENV().anthropic;
    process.env.CW_PREMIUM_HMAC_SECRET = GATE_ENV().secret;
    const iss = ISSUER_SRC(), ver = VERIFIER_SRC();
    const apiDir = path.dirname(ver.path);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cw_rtrip_'));
    RT.dir = dir;
    // ★배포 번들 형상 그대로 — api/ 전건을 같은 상대 경로로 복사한다(형제 모듈·상대 import 보존).
    //   .js 확장자를 그대로 두기 위해 CJS/ESM 두 트리를 만들고 package.json 의 type 만 달리 한다.
    const trees = {};
    for (const kind of ['cjs', 'esm']) {
      const base = path.join(dir, kind);
      const bundle = path.join(base, 'api');
      fs.mkdirSync(bundle, { recursive: true });
      fs.writeFileSync(path.join(base, 'package.json'),
        JSON.stringify({ type: kind === 'esm' ? 'module' : 'commonjs' }) + '\n');
      // ★v7.72 수리 — 종전에는 `isFile()` 아닌 항목을 건너뛰어 **`api/_engine/` 디렉터리를
      //   통째로 누락**했다. 주석은 「배포 번들 형상 그대로」라고 했지만 v7.70 이 도입한
      //   엔진이 번들에 없었고, 그래서 이 eval 이 구동한 fortune.js 는 **항상 엔진 부재
      //   경로**를 탔다(cwEng=null). 엔진 결속·ctxguard 는 한 번도 검사되지 않았다.
      //   ⟹ 하위 디렉터리를 재귀 복사한다. 결정 84(실제 경로로 통과시켜라)의 하네스판이다.
      const copyTree = (srcDir, dstDir) => {
        fs.mkdirSync(dstDir, { recursive: true });
        for (const nm of fs.readdirSync(srcDir)) {
          const src = path.join(srcDir, nm);
          let st = null;
          try { st = fs.statSync(src); } catch (e) { continue; }
          if (st.isDirectory()) { copyTree(src, path.join(dstDir, nm)); continue; }
          if (!st.isFile()) continue;
          fs.copyFileSync(src, path.join(dstDir, nm));
        }
      };
      copyTree(apiDir, bundle);
      trees[kind] = bundle;
    }
    const cjsIssuer = path.join(trees.cjs, path.basename(iss.path));
    const esmVerifier = path.join(trees.esm, path.basename(ver.path));
    RT.cjsCopySha = sha256(fs.readFileSync(cjsIssuer));
    RT.esmCopySha = sha256(fs.readFileSync(esmVerifier));
    RT.issuer = require(cjsIssuer);
    const t0 = Date.now();
    const mod = await import('file://' + esmVerifier.split(path.sep).join('/'));
    RT.importMs = Date.now() - t0;
    RT.verifier = mod && mod.default;
  } catch (e) {
    RT.error = (e && e.message) ? e.message : String(e);
  }
  return RT;
}

// ── req/res 스텁 ────────────────────────────────────────────────────────────
function mkRes() {
  const st = { code: null, body: null, headers: {}, ended: false };
  const r = {
    setHeader: function (k, v) { st.headers[String(k).toLowerCase()] = v; return r; },
    getHeader: function (k) { return st.headers[String(k).toLowerCase()]; },
    status: function (c) { st.code = c; return r; },
    json: function (b) { st.body = b; st.ended = true; return r; },
    send: function (b) { st.body = b; st.ended = true; return r; },
    end: function (b) { if (b !== undefined) st.body = b; st.ended = true; return r; }
  };
  return { r: r, st: st };
}
function mkReq(body, headers) {
  return {
    method: 'POST',
    url: '/api/x',
    headers: Object.assign({ 'content-type': 'application/json', host: 'gate.local' }, headers || {}),
    body: body
  };
}

// ── 시계 이동 (TTL 성질 측정용) ──────────────────────────────────────────────
async function withShift(ms, fn) {
  if (!ms) return await fn();
  const Real = globalThis.Date;
  class Shifted extends Real {
    constructor() {
      if (arguments.length === 0) super(Real.now() + ms);
      else super(...arguments);
    }
    static now() { return Real.now() + ms; }
  }
  try {
    Object.defineProperty(Shifted, 'name', { value: 'Date', configurable: true });
    Object.defineProperty(Shifted, 'toString', {
      value: function () { return 'function Date() { [native code] }'; }, writable: true, configurable: true
    });
  } catch (e) { /* 위장 실패는 판정에 영향 없음 */ }
  globalThis.Date = Shifted;
  try { return await fn(); } finally { globalThis.Date = Real; }
}

// ── 발급 구동 ───────────────────────────────────────────────────────────────
async function issue(opts) {
  const o = opts || {};
  const rt = await load();
  if (rt.error || typeof rt.issuer !== 'function') throw new Error('발급부 미적재: ' + rt.error);
  const pk = o.productKey;
  const orderId = 'cw_' + pk + '_' + Date.now().toString(36) + '_' + rtok(6);
  const paymentKey = 'gatePay' + rtok(14);
  const amount = o.amount;
  const prevSecret = process.env.CW_PREMIUM_HMAC_SECRET;
  if (o.noSecret) delete process.env.CW_PREMIUM_HMAC_SECRET;
  else process.env.CW_PREMIUM_HMAC_SECRET = o.secret || GATE_ENV().secret;
  FETCH_SLOT.impl = tossImpl({ orderId: orderId, amount: amount }, o.tossOver);
  const body = { paymentKey: paymentKey, orderId: orderId, amount: amount };
  if (o.bootstrap) body.action = 'bootstrap';
  const { r, st } = mkRes();
  RT.issueCalls++;
  let threw = null;
  try { await rt.issuer(mkReq(body), r); } catch (e) { threw = (e && e.message) || String(e); }
  process.env.CW_PREMIUM_HMAC_SECRET = prevSecret;
  const tok = st.body && typeof st.body.premiumToken === 'string' ? st.body.premiumToken : null;
  return {
    code: st.code, body: st.body, token: tok, threw: threw,
    orderId: orderId, paymentKey: paymentKey, amount: amount, productKey: pk
  };
}

// ── 검증 구동 ───────────────────────────────────────────────────────────────
const TYPE_FEATURES = {
  shape: { label: '계란형', fiveElement: '木', score: 80 },
  measurements: { whRatio: 0.82, jawRatio: 0.7, eyeRatio: 0.3, noseWRatio: 0.25, noseHRatio: 0.3,
    symmetry: 0.9, thirdsScore: 0.88, mouthFaceRatio: 0.35, upperThirdPct: 33, middleThirdPct: 33, lowerThirdPct: 34,
    ratio: 0.82, width: 140, height: 170 },
  eyes: { label: '큰 눈', score: 80 }, nose: { label: '곧은 코', score: 78 },
  mouth: { label: '단정한 입', score: 76 }, forehead: '넓은 이마', overallScore: 80, ratio: 0.82
};
const TYPE_CONTEXT = {
  cards: (function () {
    const a = [];
    for (let i = 0; i < 10; i++) {
      a.push({ name: 'Card' + i, reversed: i % 2 === 0, kind: 'major', suit: 'cups', suitName: '컵',
        up: '상승', rev: '하강', theme: '주제', court: '' });
    }
    return a;
  })(),
  // ★v7.72 (결정 83) — 실제 프런트가 보내는 원국 입력 계약을 픽스처에 반영한다.
  //   근거: index.html:1705 `inputYear=b.getFullYear(), inputMonth=..., inputDay=...`
  //         index.html:1763 payload 조립 · index.html:1764 `hourLabel`
  //   ★이 필드가 없으면 v7.72 의 ctxguard fail-closed 가 400(NO_BIRTH_FIELDS)을 낸다.
  //     종전 픽스처는 `ilgan`(원국 키)만 보내고 생년월일은 `birth` 문자열로만 줬는데,
  //     그것은 **어떤 클라이언트도 보내지 않는 조합**이었다 — 손으로 지어낸 픽스처였다.
  calType: 'solar', inputYear: 1990, inputMonth: 1, inputDay: 1, hourLabel: '오시',
  category: 'love', question: '올해 흐름은 어떤가요', ilgan: '甲', ilganElement: '木',
  dominant: '火', lacking: '水', surname: '김', gender: '남', birth: '1990-01-01',
  birthDate: '1990-01-01', birthTime: '12:00', dream: '용이 하늘로 오르는 꿈', keyword: '성장',
  companyName: '천운', businessType: 'IT', productName: '제품명', petType: '강아지',
  nickname: '별명', name: '홍길동', year: 2026, mode: 'gate',
  person1: { name: 'A', birth: '1990-01-01' }, person2: { name: 'B', birth: '1992-02-02' },
  ilju: '甲子', saju: { year: '甲子', month: '乙丑', day: '丙寅', hour: '丁卯' },
  pillars: ['甲子', '乙丑', '丙寅', '丁卯'], candidates: [{ name: '가나', hanja: '佳娜' }]
};
async function verify(type, token, opts) {
  const o = opts || {};
  const rt = await load();
  if (rt.error || typeof rt.verifier !== 'function') throw new Error('검증부 미적재: ' + rt.error);
  const prevSecret = process.env.CW_PREMIUM_HMAC_SECRET;
  if (o.noSecret) delete process.env.CW_PREMIUM_HMAC_SECRET;
  else process.env.CW_PREMIUM_HMAC_SECRET = o.secret || GATE_ENV().secret;
  FETCH_SLOT.impl = llmImpl();
  const headers = {};
  if (typeof token === 'string' && token) headers['x-cw-premium-token'] = token;
  const { r, st } = mkRes();
  const llmBefore = NET.llm;
  RT.verifyCalls++;
  let threw = null;
  await withShift(o.shiftMs || 0, async function () {
    try { await rt.verifier(mkReq({ type: type, features: TYPE_FEATURES, context: TYPE_CONTEXT }, headers), r); }
    catch (e) { threw = (e && e.message) || String(e); }
  });
  process.env.CW_PREMIUM_HMAC_SECRET = prevSecret;
  const body = st.body || {};
  const authRejected = body && body.error === 'PREMIUM_AUTH_REQUIRED';
  return {
    code: st.code, body: body, threw: threw, authRejected: authRejected,
    code_str: body && body.code ? String(body.code) : '',
    reachedUpstream: NET.llm > llmBefore
  };
}

// ── 열거(판정 아님) ──────────────────────────────────────────────────────────
const PREMIUM_MAP = lazy(function () {
  const out = {};
  const m = VERIFIER_SRC().src.match(/PREMIUM_TYPE_TO_PRODUCT\s*=\s*\{([\s\S]{0,4000}?)\}\s*;/);
  if (!m) return out;
  const rx = /([A-Za-z_$][\w$]*)\s*:\s*['"]([^'"]+)['"]/g;
  let g;
  while ((g = rx.exec(m[1])) !== null) out[g[1]] = g[2];
  return out;
});
const CATALOG = lazy(function () {
  const out = {};
  const m = ISSUER_SRC().src.match(/PRODUCT_CATALOG\s*=\s*\{([\s\S]{0,2000}?)\}\s*;/);
  if (!m) return out;
  const rx = /([A-Za-z_$][\w$]*)\s*:\s*(\d+)/g;
  let g;
  while ((g = rx.exec(m[1])) !== null) out[g[1]] = parseInt(g[2], 10);
  return out;
});
// 금액은 「카탈로그 값 집합」을 후보로 두고 **발급이 성립하는 금액**을 실측으로 찾는다.
// 파싱이 실패해도 기본 후보로 탐침한다(열거 실패가 무검사로 바뀌지 않게).
const AMOUNT_CANDIDATES = lazy(function () {
  const set = {};
  for (const k of Object.keys(CATALOG())) set[CATALOG()[k]] = true;
  for (const v of [4900, 29900]) set[v] = true;
  return Object.keys(set).map(Number).sort(function (a, b) { return a - b; });
});

// b64url 판독(하네스측 — 발급 산출물을 **읽기** 위한 것이며 판정 기준이 아니다)
function b64uDec(s) {
  const t = String(s).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(t + '='.repeat((4 - (t.length % 4)) % 4), 'base64');
}
function b64uEnc(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function resign(payloadObj, secret, prefix) {
  const p = b64uEnc(Buffer.from(JSON.stringify(payloadObj), 'utf8'));
  const sig = b64uEnc(crypto.createHmac('sha256', secret).update(p).digest());
  return (prefix || 'cwp1') + '.' + p + '.' + sig;
}

// ════════════════════════════════════════════════════════════════════════════
(async function main() {
  const DAY = 24 * 3600 * 1000;

  // ── A축 적재 ──────────────────────────────────────────────────────────────
  await asec('A1', async function () {
    ck('A1 front_root 해석', !!FRONT_ROOT(), 'front_root=' + String(FRONT_ROOT()));
  });
  if (!FRONT_ROOT()) {
    ck('A-STOP 전제 미성립', false, 'front_root 미해석 — 이후 검사는 판정 불가(통과 아님)');
    return report();
  }
  await asec('A2', async function () {
    const s = ISSUER_SRC();
    ck('A2 발급부 판독 (api/confirm-payment.js)', s.size > 2000, 'sha256=' + s.sha256.slice(0, 16) + ' · ' + s.size + 'B');
  });
  await asec('A3', async function () {
    const s = VERIFIER_SRC();
    ck('A3 검증부 판독 (api/fortune.js)', s.size > 2000, 'sha256=' + s.sha256.slice(0, 16) + ' · ' + s.size + 'B');
  });
  const rt = await load();
  await asec('A4', async function () {
    const ok = !!RT.cjsCopySha && RT.cjsCopySha === ISSUER_SRC().sha256 &&
      !!RT.esmCopySha && RT.esmCopySha === VERIFIER_SRC().sha256;
    ck('A4 ★적재 사본 바이트 동일 — 사본 조작 경로 봉쇄', ok,
      'cjs=' + String(RT.cjsCopySha).slice(0, 12) + ' esm=' + String(RT.esmCopySha).slice(0, 12));
  });
  await asec('A5', async function () {
    ck('A5 발급부 실적재(module.exports 함수)', typeof rt.issuer === 'function', rt.error || ('typeof=' + typeof rt.issuer));
  });
  await asec('A6', async function () {
    ck('A6 검증부 실적재(export default 함수)', typeof rt.verifier === 'function',
      (rt.error || '') + ' import=' + rt.importMs + 'ms');
  });
  if (typeof rt.issuer !== 'function' || typeof rt.verifier !== 'function') {
    ck('A-STOP 적재 실패', false, '두 모듈 중 하나라도 적재 실패 — 이후 검사 판정 불가: ' + rt.error);
    return report();
  }

  // ── E축 열거 ──────────────────────────────────────────────────────────────
  const premiumTypes = Object.keys(PREMIUM_MAP()).sort();
  await asec('E1', async function () {
    ck('E1 프리미엄 type 열거 하한(17)', premiumTypes.length >= 17,
      '열거 ' + premiumTypes.length + '종');
  });
  const pkList = [];
  for (const t of premiumTypes) if (pkList.indexOf(PREMIUM_MAP()[t]) === -1) pkList.push(PREMIUM_MAP()[t]);
  await asec('E2', async function () {
    const cat = CATALOG();
    const missing = pkList.filter(function (k) { return !Object.prototype.hasOwnProperty.call(cat, k); });
    ck('E2 프리미엄 상품 전건이 발급부 카탈로그에 존재', pkList.length >= 9 && missing.length === 0,
      '상품 ' + pkList.length + '종 · 카탈로그 ' + Object.keys(cat).length + '종 · 누락 ' + missing.length +
      (missing.length ? ' [' + missing.join(',') + ']' : ''));
  });

  // ── E3 · B1 — 상품별 발급 실측 (가격 결속 포함) ──────────────────────────
  const issuedByPk = {};
  const priceProbe = [];
  await asec('E3', async function () {
    const bad = [];
    for (const pk of pkList) {
      const okAmts = [];
      for (const amt of AMOUNT_CANDIDATES()) {
        const r = await issue({ productKey: pk, amount: amt });
        if (r.token) { okAmts.push(amt); issuedByPk[pk] = r; }
      }
      priceProbe.push(pk + '=' + okAmts.join('|'));
      if (okAmts.length !== 1) bad.push(pk + '(성립금액 ' + okAmts.length + '종)');
    }
    ck('E3 ★가격 결속 — 상품마다 발급이 성립하는 금액이 정확히 1종', bad.length === 0 && pkList.length > 0,
      priceProbe.join(' ') + (bad.length ? ' · 위반 ' + bad.join(',') : ''));
  });
  await asec('B1', async function () {
    const miss = pkList.filter(function (k) { return !issuedByPk[k] || !issuedByPk[k].token; });
    ck('B1 ★발급 라운드트립 1단 — 상품 전건에서 실제 토큰이 발급됨', miss.length === 0 && pkList.length > 0,
      '발급 성공 ' + (pkList.length - miss.length) + '/' + pkList.length +
      (miss.length ? ' · 실패 [' + miss.join(',') + ']' : ''));
  });

  // ── B2 — 프리미엄 전건 라운드트립 (핵심) ─────────────────────────────────
  for (const t of premiumTypes) {
    await asec('B2.' + t, async function () {
      const pk = PREMIUM_MAP()[t];
      const iss = issuedByPk[pk];
      if (!iss || !iss.token) { ck('B2.' + t + ' 라운드트립', false, '발급 실패(상품 ' + pk + ') — 검증 이전 단계에서 붕괴'); return; }
      const v = await verify(t, iss.token);
      ck('B2.' + t + ' ★발급부 토큰이 검증부를 실제 통과', !v.authRejected && v.reachedUpstream,
        'pk=' + pk + ' status=' + v.code + ' code=' + v.code_str + ' upstream=' + v.reachedUpstream +
        (v.threw ? ' threw=' + v.threw : ''));
    });
  }

  // ── B3 — 상품 결속(교차 상품 거부) ───────────────────────────────────────
  await asec('B3', async function () {
    const bad = [];
    for (const t of premiumTypes) {
      const pk = PREMIUM_MAP()[t];
      const other = pkList.filter(function (k) { return k !== pk && issuedByPk[k] && issuedByPk[k].token; })[0];
      if (!other) { bad.push(t + '(대조 토큰 없음)'); continue; }
      const v = await verify(t, issuedByPk[other].token);
      if (!v.authRejected) bad.push(t + '←' + other + '(status=' + v.code + ')');
    }
    ck('B3 ★상품 결속 — 타 상품 토큰은 전건 거부', bad.length === 0 && premiumTypes.length > 0,
      '교차 대조 ' + premiumTypes.length + '건 · 위반 ' + bad.length + (bad.length ? ' [' + bad.slice(0, 5).join(',') + ']' : ''));
  });

  const anyType = premiumTypes[0];
  const anyPk = anyType ? PREMIUM_MAP()[anyType] : null;
  const anyIssued = anyPk ? issuedByPk[anyPk] : null;

  // ── B4 — bootstrap 경로 ──────────────────────────────────────────────────
  await asec('B4', async function () {
    const amt = CATALOG()[anyPk];
    const r = await issue({ productKey: anyPk, amount: amt, bootstrap: true });
    let pass = false, detail = '발급 실패 status=' + r.code;
    if (r.token) {
      const v = await verify(anyType, r.token);
      pass = !v.authRejected && v.reachedUpstream;
      detail = 'src=bootstrap · verify status=' + v.code + ' code=' + v.code_str;
    }
    ck('B4 bootstrap(구 영수증 재검증) 발급 토큰도 검증 통과', pass, detail);
  });

  // ── B5 · B6 — 시크릿 결속 ────────────────────────────────────────────────
  await asec('B5', async function () {
    const other = rtok(64);
    const v = await verify(anyType, anyIssued.token, { secret: other });
    ck('B5 ★시크릿 결속 — 발급 시크릿 ≠ 검증 시크릿이면 거부', v.authRejected,
      'status=' + v.code + ' code=' + v.code_str);
  });
  await asec('B6', async function () {
    const s2 = rtok(64);
    const r = await issue({ productKey: anyPk, amount: CATALOG()[anyPk], secret: s2 });
    let pass = false, detail = '발급 실패';
    if (r.token) {
      const v = await verify(anyType, r.token, { secret: s2 });
      pass = !v.authRejected && v.reachedUpstream;
      detail = '난수 시크릿 재발급 → 검증 status=' + v.code + ' code=' + v.code_str;
    }
    ck('B6 ★시크릿 교체 후에도 라운드트립 성립 (양측이 같은 env 를 실제 사용)', pass, detail);
  });

  // ── B7~B9 — 서명·페이로드·접두어 결속 ────────────────────────────────────
  await asec('B7', async function () {
    const parts = anyIssued.token.split('.');
    const last = parts[2];
    const flip = last.slice(0, -1) + (last.slice(-1) === 'A' ? 'B' : 'A');
    const v = await verify(anyType, parts[0] + '.' + parts[1] + '.' + flip);
    ck('B7 서명 1자 변조 거부', v.authRejected, 'status=' + v.code + ' code=' + v.code_str);
  });
  await asec('B8', async function () {
    const parts = anyIssued.token.split('.');
    const pl = JSON.parse(b64uDec(parts[1]).toString('utf8'));
    pl.amt = (Number(pl.amt) || 0) + 1;
    const tampered = parts[0] + '.' + b64uEnc(Buffer.from(JSON.stringify(pl), 'utf8')) + '.' + parts[2];
    const v = await verify(anyType, tampered);
    ck('B8 페이로드 변조(금액) 거부', v.authRejected, 'status=' + v.code + ' code=' + v.code_str);
  });
  await asec('B9', async function () {
    const parts = anyIssued.token.split('.');
    const v = await verify(anyType, parts[0] + 'X.' + parts[1] + '.' + parts[2]);
    ck('B9 접두어 변조 거부', v.authRejected, 'status=' + v.code + ' code=' + v.code_str);
  });

  // ── B10 · B11 — 유효창(TTL) 성질 ─────────────────────────────────────────
  await asec('B10', async function () {
    const v = await verify(anyType, anyIssued.token, { shiftMs: 31 * DAY });
    ck('B10 ★유효창 상한 — 발급 +31일 시점에는 반드시 거부(발급 TTL 연장 적발)', v.authRejected,
      'status=' + v.code + ' code=' + v.code_str);
  });
  await asec('B11', async function () {
    const v = await verify(anyType, anyIssued.token, { shiftMs: 29 * DAY });
    ck('B11 ★유효창 하한 — 발급 +29일 시점에는 여전히 통과(발급 TTL 단축 적발)',
      !v.authRejected && v.reachedUpstream, 'status=' + v.code + ' code=' + v.code_str);
  });
  await asec('B12', async function () {
    const v = await verify(anyType, anyIssued.token, { shiftMs: -20 * 60 * 1000 });
    ck('B12 발급시각(iat) 미래 토큰 거부 — 시계 20분 후퇴', v.authRejected,
      'status=' + v.code + ' code=' + v.code_str);
  });

  // ── B13 · B14 — 무토큰 거부 / 무료 경로 무해 ─────────────────────────────
  await asec('B13', async function () {
    const bad = [];
    for (const t of premiumTypes) {
      const v = await verify(t, null);
      if (!v.authRejected) bad.push(t + '(status=' + v.code + ')');
    }
    ck('B13 ★무토큰 프리미엄 전건 거부 (게이트가 무조건 통과가 아님을 실증)',
      bad.length === 0 && premiumTypes.length > 0,
      '대조 ' + premiumTypes.length + '건 · 통과된 무토큰 ' + bad.length + (bad.length ? ' [' + bad.slice(0, 5).join(',') + ']' : ''));
  });
  await asec('B14', async function () {
    const free = ['saju', 'naming', 'daily_message'];
    const bad = [];
    for (const t of free) {
      const v = await verify(t, null);
      if (v.authRejected || !v.reachedUpstream) bad.push(t + '(status=' + v.code + ' code=' + v.code_str + ')');
    }
    ck('B14 무료 type 은 토큰 없이도 통과 (프리미엄 관문 오탐 회귀 감시)', bad.length === 0,
      '무료 ' + free.length + '종 · 차단된 무료 ' + bad.length + (bad.length ? ' [' + bad.join(',') + ']' : ''));
  });

  // ── B15~B18 — fail-closed ────────────────────────────────────────────────
  await asec('B15', async function () {
    const r = await issue({ productKey: anyPk, amount: CATALOG()[anyPk], tossOver: { status: 'IN_PROGRESS' } });
    ck('B15 발급부 fail-closed — 결제 미완료(status≠DONE)면 토큰 미발급', !r.token,
      'status=' + r.code + ' token=' + (r.token ? 'ISSUED(위험)' : 'none'));
  });
  await asec('B16', async function () {
    const amt = CATALOG()[anyPk];
    const r = await issue({ productKey: anyPk, amount: amt, tossOver: { totalAmount: amt + 1000 } });
    ck('B16 발급부 fail-closed — 결제사 금액 불일치면 토큰 미발급', !r.token,
      'status=' + r.code + ' token=' + (r.token ? 'ISSUED(위험)' : 'none'));
  });
  await asec('B17', async function () {
    const r = await issue({ productKey: anyPk, amount: CATALOG()[anyPk], noSecret: true });
    ck('B17 발급부 fail-closed — 시크릿 미설정이면 토큰 미발급', !r.token,
      'status=' + r.code + ' token=' + (r.token ? 'ISSUED(위험)' : 'none'));
  });
  await asec('B18', async function () {
    const v = await verify(anyType, anyIssued.token, { noSecret: true });
    ck('B18 검증부 fail-closed — 시크릿 미설정이면 프리미엄 전건 거부', v.authRejected,
      'status=' + v.code + ' code=' + v.code_str);
  });

  // ── C축 — 발급 산출물의 규격 성질(측정값) ────────────────────────────────
  await asec('C1', async function () {
    const parts = String(anyIssued.token).split('.');
    const b64u = /^[A-Za-z0-9_-]+$/;
    const ok = parts.length === 3 && parts.every(function (p) { return p.length > 0; }) &&
      b64u.test(parts[1]) && b64u.test(parts[2]);
    ck('C1 발급 토큰 형상 — 3분절 · 페이로드/서명이 b64url 문자집합만 사용', ok,
      '분절 ' + parts.length + ' · prefix=' + parts[0] + ' · plen=' + (parts[1] || '').length + ' siglen=' + (parts[2] || '').length);
  });
  await asec('C2', async function () {
    const pl = JSON.parse(b64uDec(String(anyIssued.token).split('.')[1]).toString('utf8'));
    const need = ['v', 'pk', 'ord', 'pay', 'amt', 'iat', 'exp', 'src'];
    const miss = need.filter(function (k) { return !Object.prototype.hasOwnProperty.call(pl, k); });
    ck('C2 페이로드 필드 집합 {v,pk,ord,pay,amt,iat,exp,src} 전건', miss.length === 0,
      '필드 ' + Object.keys(pl).sort().join(',') + (miss.length ? ' · 누락 ' + miss.join(',') : ''));
  });
  await asec('C3', async function () {
    const pl = JSON.parse(b64uDec(String(anyIssued.token).split('.')[1]).toString('utf8'));
    const ok1 = await verify(anyType, resign(pl, GATE_ENV().secret));
    const bumped = Object.assign({}, pl, { v: (Number(pl.v) || 1) + 1 });
    const ok2 = await verify(anyType, resign(bumped, GATE_ENV().secret));
    ck('C3 토큰 버전 결속 — 동일 규격 재서명은 통과하고 v 상승분은 거부',
      !ok1.authRejected && ok1.reachedUpstream && ok2.authRejected,
      '재서명(v유지) status=' + ok1.code + ' · v+1 status=' + ok2.code + ' code=' + ok2.code_str);
  });
  await asec('C4', async function () {
    const pl = JSON.parse(b64uDec(String(anyIssued.token).split('.')[1]).toString('utf8'));
    const days = (Number(pl.exp) - Number(pl.iat)) / DAY;
    ck('C4 발급 유효창 실측이 29~31일 창 안', days >= 29 && days <= 31, 'exp-iat=' + days.toFixed(4) + '일');
  });

  // ── D축 자기무결성 ───────────────────────────────────────────────────────
  await asec('A7', async function () {
    const usedRealKey = String(process.env.TOSS_SECRET_KEY || '') !== GATE_ENV().toss ||
      String(process.env.ANTHROPIC_API_KEY || '') !== GATE_ENV().anthropic;
    ck('A7 ★외부 왕복 차단 — 화이트리스트 밖 호출 0건 · 실 키 미사용',
      NET.forbidden.length === 0 && !usedRealKey && NET.toss > 0 && NET.llm > 0,
      'toss=' + NET.toss + ' llm=' + NET.llm + ' 차단위반=' + NET.forbidden.length +
      (NET.forbidden.length ? ' [' + NET.forbidden.slice(0, 3).join(',') + ']' : ''));
  });
  await asec('D2', async function () {
    ck('D2 ★구동 실적 — 발급/검증을 실제로 돌렸다(공허 통과 차단)',
      RT.issueCalls >= 12 && RT.verifyCalls >= 20,
      '발급 구동 ' + RT.issueCalls + '회 · 검증 구동 ' + RT.verifyCalls + '회');
  });
  await asec('D1', async function () {
    const bad = [];
    const pinPath = path.join(__dirname, PINS_REL);
    let pins = null, pinsSha = null;
    try {
      const buf = fs.readFileSync(pinPath);
      pinsSha = sha256(buf);
      pins = JSON.parse(buf.toString('utf8'));
    } catch (e) { bad.push('외부 pin 판독·파싱 실패: ' + (e && e.message)); }
    const selfName = path.basename(__filename);
    let selfSha = null;
    try { selfSha = sha256(fs.readFileSync(__filename)); } catch (e) { bad.push('자기 소스 판독 실패'); }
    const spec = (pins && pins.evals) ? pins.evals[selfName] : null;
    if (!spec) bad.push('외부 pin 표에 ' + selfName + ' 항목 부재 — 자기 약화 무방비');
    else {
      if (spec.sha256 !== selfSha) {
        bad.push('자기 소스 sha256 불일치 (실측 ' + String(selfSha).slice(0, 16) + ' != pin ' +
          String(spec.sha256).slice(0, 16) + ') — 정당한 강화라면 node tools/regen_gate_pins.js 로 갱신하라');
      }
      if (typeof spec.checks_min === 'number' && EXPECTED_TOTAL < spec.checks_min) {
        bad.push('EXPECTED_TOTAL ' + EXPECTED_TOTAL + ' < 외부 하한 ' + spec.checks_min);
      }
    }
    const runnerPath = path.join(__dirname, '..', RUNNER_REL);
    let runnerSrc = null;
    try { runnerSrc = fs.readFileSync(runnerPath, 'utf8'); } catch (e) { bad.push('게이트 러너 판독 실패: ' + RUNNER_REL); }
    if (runnerSrc !== null) {
      if (runnerSrc.indexOf(PINS_REL) === -1) bad.push('러너가 외부 pin 파일을 참조하지 않음');
      const m = runnerSrc.match(/GATE_PINS_SHA256\s*=\s*'([0-9a-f]{64})'/);
      if (!m) bad.push('러너에 GATE_PINS_SHA256(64자) 상수 부재');
      else if (pinsSha && m[1] !== pinsSha) {
        bad.push('pin 파일 sha256 불일치 (실측 ' + pinsSha.slice(0, 16) + ' != 러너 상수 ' + m[1].slice(0, 16) + ')');
      }
    }
    ck('D1 ★외부 pin 자기대조 — 직접 실행 경로에서도 자기 약화가 적발됨', bad.length === 0,
      '자기 sha=' + String(selfSha).slice(0, 16) + ' · 위반 ' + bad.length + (bad.length ? ' → ' + bad.join(' / ') : ''));
  });

  return report();
})().catch(function (e) {
  ck('FATAL 톱레벨 예외(fail-closed)', false, (e && e.stack) ? String(e.stack).split('\n').slice(0, 3).join(' | ') : String(e));
  report();
});

function report() {
  // 적재용 임시 번들 정리 — 반복 실행 시 /tmp 누적을 막는다(판정에는 영향 없음).
  try { if (RT.dir) fs.rmSync(RT.dir, { recursive: true, force: true }); } catch (e) { /* 정리 실패는 판정 무관 */ }
  // ★D3 자신을 포함한 등록 수로 대조한다(하한 pin 과 stdout 의 total= 이 같은 수를 가리키게).
  const n = results.length + 1;
  ck('D3 SELF 검사 수 하한 pin(' + EXPECTED_TOTAL + ')', n >= EXPECTED_TOTAL,
    n >= EXPECTED_TOTAL ? '등록 ' + n : '등록 ' + n + ' < 하한 ' + EXPECTED_TOTAL + ' — 게이트 침식·열거 실패');
  let fail = 0;
  for (const r of results) {
    if (!r.ok) fail++;
    console.log((r.ok ? 'PASS ' : 'FAIL ') + r.id + '  — ' + r.detail);
  }
  console.log('[token_roundtrip] issuer=' + (function () { try { return ISSUER_SRC().sha256.slice(0, 16); } catch (e) { return 'ERR'; } })() +
    ' verifier=' + (function () { try { return VERIFIER_SRC().sha256.slice(0, 16); } catch (e) { return 'ERR'; } })());
  console.log('[token_roundtrip] total=' + results.length + ' pass=' + (results.length - fail) + ' fail=' + fail);
  process.exit(fail === 0 ? 0 : 1);
}
