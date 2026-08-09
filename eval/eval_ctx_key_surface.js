// 천운 — context 키 표면 게이트 · v7.77 신설 (결정 90 · I-43 유형을 사고 **전에** 잡는다)
// ═══════════════════════════════════════════════════════════════════════════
// 【무엇을 잡는가】
//   「**클라이언트가 context 에 싣는데, 서버가 프롬프트에 보간하지도 재계산 입력으로
//     읽지도 않는 키**」 = 클라에만 있고 서버에는 없는 사실.
//   v7.73 의 I-43(E-1)이 정확히 이것이었다 — 에이전트 B 가 윤달 UI 를 신설해
//   `isLeapMonth` 를 싣기 시작했는데 서버는 계속 평달로 재계산했고,
//   **윤달 출생 1,637건 중 1,627건(99.39%)이 화면≠해석**이 됐다.
//   계약 `CONTRACT_v773.md` §3 은 그 키를 명시했지만 **「B(클라) 소유」 제목 아래**
//   있어서 A(서버)가 자기 몫으로 읽지 않았다. 걸침을 아무도 표로 만들지 않았다.
//   ⟹ 이 게이트가 그 표를 **손이 아니라 소스에서** 만든다.
//
// 【왜 v7.73~v7.76 동안 승격하지 못했나 — 그리고 무엇이 달라졌나】
//   원본 프로브 `_v773_work/probe_A2/probe_ctx_key_surface.js` 는
//   `body:JSON.stringify({type:'x',context:ctx})` 한 형태만 정규식으로 잡았다.
//   ★v7.77 재측정 결과 그 열거는 **클라 호출 15곳 중 3곳**만 덮고 있었다:
//     · `analyzeTojeong` 은 context 를 **인라인 객체**로 만들어 아예 안 잡혔고
//     · 나머지 11곳은 `type:apiType`(변수)이라 **의도적으로 제외**되고 있었다.
//   즉 「dangling 0건」은 **표본이 3/15 인 0건**이었다 — 승격했다면 거짓 안심이 된다.
//   ⟹ 이 게이트는 열거기를 다시 만들어 **15/15** 를 덮고, ★커버리지 자체를 검사한다.
//
// 【이 게이트의 성질 검사 — 형태를 못박지 않는다】
//   · K-0 사이트 열거 하한 + **미해석 0** (조용한 커버리지 상실 차단)
//   · K-1 키 추출 실패 **0** (「못 뽑아서 0건」을 통과로 접지 않는다)
//   · K-2 ★★dangling 0 — 본체
//   · K-4 ★긍정 대조 — 알려진 키(`isLeapMonth`)가 실제로 잡히고 서버가 읽는다
//   · K-7 ★★자기 뮤턴트 — 클라 소스 **사본**에 가짜 키를 심어 K-2 가 적발하는지 확인.
//         외부 뮤테이션 하네스에 의존하지 않고 **스스로** 유효성을 증명한다(결정 88).
//   · K-9 ★js/*.js 편입 유효성 (v7.79 파 ⓑ 신설 — 아래 I-81)
//
// ═══ v7.79 파 ⓑ — I-81 수리: 열거 대상에 `js/*.js` 를 편입한다 ═══════════════
//   【무엇이 빠져 있었나】
//     이 게이트의 클라 사이트 열거기는 **`index.html` 만** 읽었다. 그런데 `/api/fortune`
//     호출은 `js/tarot.js`(2곳)·`js/chat.js`(1곳)에도 있다 — `tarot`·`tarot_premium`·
//     `daily_message` **3곳이 K-2 검사에서 원래부터 빠져 있었다**.
//     v7.77 이 「15/15 를 덮는다」고 못박은 그 15 는 **index.html 안에서만** 15였다.
//     ⟹ 「dangling 0건」은 또 한 번 **표본이 15/18 인 0건**이었다. v7.77 이 고친 것과
//       정확히 같은 형태의 거짓 안심이 한 층 더 있었던 것이다.
//
//   【왜 단순 편입으로는 안 됐나 — 추출기가 새 형태를 못 읽는다】
//     편입만 하면 K-1 이 붉어진다. 두 파일이 index.html 에 없던 형태를 쓰기 때문이다:
//       ③ `const ctx = Object.assign({}, ctxData, { … })`   ← `js/chat.js` fetchDailyMessage
//          + `ctxData = _gatherChatContext()` 는 `return {…}` 가 아니라
//            **`ctx.KEY = …` 대입으로 짓고 `return ctx`** 한다
//       ④ `Object.assign(ctx, { … })`                       ← `js/tarot.js` (파 ⓐ 6키 적재)
//     ⟹ `exprKeys`/`varKeys`/`builderKeys` 로 ①~④를 전부 푼다. **못 푸는 형태는 `null`**
//       — K-1 이 붉어진다. 「못 뽑아서 0건」을 통과로 접지 않는다.
//
//   【커버리지 하한을 함께 올린다 (결정 99·105)】
//     하한을 그대로 두면 편입분이 조용히 빠져도 안 붉어진다. `SITES_MIN` 15 → 18 이고,
//     ★**파일별 하한**(`FILE_MIN`)도 둔다 — 총합만 보면 index.html 이 1곳 늘고 js 가
//     1곳 사라져도 통과한다.
//
//   【긍정 짝】
//     K-8 을 「0건」이 아니라 「**무변경 사본의 적발 집합이 라이브와 동일** + 심은 가짜 키
//     없음」으로 바꿨다. 편입으로 실제 dangling 이 드러나면 종전 K-8 은 그 자체로 붉어져
//     오탐 판별력을 잃는다. K-9 는 그 반대 방향 — **새 파일에서 키가 실제로 뽑히는지**를 본다
//     (안 뽑히면 dangling 0건은 「덜 보고 0건」이다).
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const CWTMP = require('./_tmp.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');

function frontRoot() {
  const env = process.env.CHUNWOON_FRONT_ROOT;
  if (env && fs.existsSync(path.join(env, 'api', 'fortune.js'))) return env;
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
    console.log('\n[ctx_key_surface] 실패 내역');
    for (const f of fails) console.log('  FAIL ' + f.id + ' ' + f.title + '  -> ' + f.detail);
  }
  console.log('[ctx_key_surface] front_root=' + FR);
  console.log('[ctx_key_surface] total=' + total + ' pass=' + pass + ' fail=' + fail);
  process.exit(fail ? 1 : 0);
}

const EXPECTED_TOTAL_MIN = 10;   // ★v7.79 파 ⓑ — K-9 신설(10 → 11). 래칫이므로 내리지 말 것.
check('SELF-1', '★_gate_pins.json 자기검사 — 자기 sha256 · 검사 수 하한', () => {
  const p = path.join(__dirname, '_gate_pins.json');
  if (!fs.existsSync(p)) return { ok: false, detail: '★pin 표 부재 — 판정 불가' };
  let pins = null;
  try { pins = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return { ok: false, detail: 'pin 판독 실패' }; }
  const spec = pins && pins.evals && pins.evals['eval_ctx_key_surface.js'];
  if (!spec || !spec.sha256) return { ok: false, detail: '★pin 표에 자기 항목이 없다' };
  const self = crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex');
  if (self !== spec.sha256)
    return { ok: false, detail: '★자기 sha256 불일치 (실측 ' + self.slice(0, 16) + ' != pin ' + String(spec.sha256).slice(0, 16) + ')' };
  if (typeof spec.checks_min === 'number' && spec.checks_min < EXPECTED_TOTAL_MIN)
    return { ok: false, detail: '★checks_min ' + spec.checks_min + ' < ' + EXPECTED_TOTAL_MIN };
  return { ok: true, detail: 'sha256 일치 · checks_min=' + spec.checks_min };
});

if (!FR) { check('SELF-0', 'front_root 해석', () => ({ ok: false, detail: '★CHUNWOON_FRONT_ROOT 미지정' })); done(); }

const FORTUNE_SRC = fs.readFileSync(path.join(FR, 'api', 'fortune.js'), 'utf8');
const GUARD_SRC = fs.readFileSync(path.join(FR, 'api', '_engine', 'ctxguard.js'), 'utf8');
const INDEX_PATH = path.join(FR, 'index.html');
let GUARD_MOD = null;
try { GUARD_MOD = require(path.join(FR, 'api', '_engine', 'ctxguard.js')); } catch (e) { /* 아래에서 FAIL */ }

// ══════════════════════════════════════════════════════════════════════════
// ⑴ 서버 — type 분기별 `${c.KEY}` 보간 키
// ══════════════════════════════════════════════════════════════════════════
function promptKeysByType() {
  const re = /(?:if|else if)\s*\(\s*type === '([a-z0-9_]+)'\s*\)/g;
  const marks = []; let m;
  while ((m = re.exec(FORTUNE_SRC))) marks.push({ t: m[1], i: m.index });
  marks.push({ t: '__END__', i: FORTUNE_SRC.length });
  const out = {};
  for (let k = 0; k < marks.length - 1; k++) {
    const seg = FORTUNE_SRC.slice(marks[k].i, marks[k + 1].i);
    const keys = new Set(); let mm;
    const r2 = /\$\{\s*c\.([A-Za-z_$][\w$]*)/g;
    while ((mm = r2.exec(seg))) keys.add(mm[1]);
    const r3 = /\$\{\s*context\.([A-Za-z_$][\w$]*)/g;
    while ((mm = r3.exec(seg))) keys.add(mm[1]);
    // ★★v7.79 I-81 — 보간(`${c.x}`) **밖의 판독**도 세야 한다. I-79 와 같은 형태의
    //   열거기 한계였다: 서버는 아래처럼 템플릿 밖에서 읽는 자리가 많다.
    //     `const personaTone = c.personaTone || '…'`      (daily_message)
    //     `(c.cards||[]).map(card => …)`                   (tarot — 배열 안쪽을 푼다)
    //     `{love:'…', …}[c.category] || '전반적 운'`        (tarot — 표 조회)
    //   ⟹ `${` 만 보면 이 셋이 **전부 「서버가 안 읽는 키」로 오적발**된다(실측 6건).
    //     K-2 의 정의는 「보간하지도 **읽지도** 않는」이므로 판독 자리를 세는 쪽이 정의에 맞다.
    //   ★한계(의도적): 주석 안의 `c.x` 표기도 판독으로 센다. 과대 계상은 dangling 을
    //     **줄이는** 방향이라 오탐은 안 만들지만, 누락을 가릴 수는 있다.
    //     그래서 K-7 자기 뮤턴트가 「심은 가짜 키」로 이 검사의 살아 있음을 매번 증명한다.
    const r4 = /(?<![\w$.])c\.([A-Za-z_$][\w$]*)/g;
    while ((mm = r4.exec(seg))) keys.add(mm[1]);
    const r5 = /(?<![\w$.])context\.([A-Za-z_$][\w$]*)/g;
    while ((mm = r5.exec(seg))) keys.add(mm[1]);
    // ★같은 type 분기가 소스에 여러 번 나온다(프롬프트 · 인가 · 스크럽) — 반드시 합집합.
    out[marks[k].t] = [...new Set((out[marks[k].t] || []).concat([...keys]))].sort();
  }
  return out;
}

// ══════════════════════════════════════════════════════════════════════════
// ⑵ 서버 — ctxguard 가 **읽는** context 키
// ══════════════════════════════════════════════════════════════════════════
function guardReadKeys() {
  const keys = new Set(); let m;
  const r1 = /\bctx\.([A-Za-z_$][\w$]*)/g;
  while ((m = r1.exec(GUARD_SRC))) keys.add(m[1]);
  const r2 = /\bctx\[\s*'([^']+)'\s*\]/g;
  while ((m = r2.exec(GUARD_SRC))) keys.add(m[1]);
  const g = GUARD_MOD || {};
  // 동적 조립(`'y' + i`)·상수 배열은 모듈에서 직접 읽는다 — 정규식으로는 안 잡힌다.
  // ★v7.79 파 ⓐ — `PERSON_BIRTH_KEYS`(`cal`·`y`·`m`·`d`·`h`·`leap`). 판독기는
  //   `compatPersonInput(ctx,'')` 라 키가 `'h'+i` 로 조립되고, 그중 `h` 는 리터럴로
  //   한 번도 안 나타난다 ⟹ 정규식이 못 본다. **계약 §2-3 이 요구한 「명시 키 배열」**을
  //   여기에 등재해 「클라는 싣는데 서버가 안 읽는다」 오탐을 막는다(I-43 유형의 역방향).
  for (const arr of ['COMPAT_BIRTH_KEYS', 'TOJEONG_BIRTH_KEYS', 'TOJEONG_REPLACE_KEYS',
    'PERSON_BIRTH_KEYS',
    'CTX_REPLACE_KEYS', 'CTX_GUARDED_KEYS', 'COMPAT_GUARDED_KEYS', 'COMPAT_REPLACE_KEYS']) {
    for (const k of (g[arr] || [])) keys.add(k);
  }
  return keys;
}

// ══════════════════════════════════════════════════════════════════════════
// ⑶ ★클라이언트 — `/api/fortune` 호출 **전건**의 context 키
//    v7.77: 인라인 객체(`context:{…}`)와 `type:apiType` 사이트까지 덮는다.
// ══════════════════════════════════════════════════════════════════════════
/** 상품군 — 서버 type 이름의 접두. 긴 것부터 봐야 `naming_company` 가 `naming` 에 먹히지 않는다. */
const FAMILIES = ['naming_company', 'naming_product', 'naming_pet', 'naming_nickname',
  'naming', 'saju', 'compat', 'tojeong', 'dream', 'face', 'tarot', 'daily_message'];

/** 균형 잡힌 객체 리터럴의 최상위 키를 뽑는다. 실패하면 null(= 판정 불가). */
function topLevelKeys(src, openBraceIdx) {
  let depth = 0, end = -1, str = null;
  for (let i = openBraceIdx; i < src.length; i++) {
    const ch = src[i];
    if (str) { if (ch === '\\') { i++; continue; } if (ch === str) str = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { str = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end < 0) return null;
  const body = src.slice(openBraceIdx + 1, end);
  const parts = []; let d = 0, s2 = null, from = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (s2) { if (ch === '\\') { i++; continue; } if (ch === s2) s2 = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { s2 = ch; continue; }
    if (ch === '{' || ch === '[' || ch === '(') d++;
    else if (ch === '}' || ch === ']' || ch === ')') d--;
    else if (ch === ',' && d === 0) { parts.push(body.slice(from, i)); from = i + 1; }
  }
  parts.push(body.slice(from));
  const keys = [];
  for (const p of parts) {
    const t = p.replace(/\/\/[^\n]*/g, '').trim();
    if (!t) continue;
    const km = /^([A-Za-z_$][\w$]*)\s*(:|,|$)/.exec(t);
    if (km) keys.push(km[1]);
  }
  return [...new Set(keys)].sort();
}

/** 문(statement) 끝(최상위 `;` 또는 감싸는 괄호 닫힘) 위치. 못 찾으면 -1. */
function stmtEnd(src, from) {
  let depth = 0, str = null;
  for (let i = from; i < src.length; i++) {
    const ch = src[i];
    if (str) { if (ch === '\\') { i++; continue; } if (ch === str) str = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { str = ch; continue; }
    if (ch === '(' || ch === '{' || ch === '[') depth++;
    else if (ch === ')' || ch === '}' || ch === ']') { depth--; if (depth < 0) return i; }
    else if (ch === ';' && depth === 0) return i;
  }
  return -1;
}

/** `(` 위치에서 최상위 인자 구간 `[from,to)` 목록. 실패하면 null. */
function callArgSpans(src, openParenIdx) {
  if (src[openParenIdx] !== '(') return null;
  let depth = 0, str = null, from = openParenIdx + 1;
  const spans = [];
  for (let i = openParenIdx; i < src.length; i++) {
    const ch = src[i];
    if (str) { if (ch === '\\') { i++; continue; } if (ch === str) str = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { str = ch; continue; }
    if (ch === '(' || ch === '{' || ch === '[') { depth++; continue; }
    if (ch === ')' || ch === '}' || ch === ']') {
      depth--;
      if (depth === 0) { spans.push([from, i]); return spans; }
      continue;
    }
    if (ch === ',' && depth === 1) { spans.push([from, i]); from = i + 1; }
  }
  return null;
}

/** 함수 본문 `{…}` 구간 `[ob,end]`. 없으면 null. */
function fnBodySpan(src, fnName) {
  const re = new RegExp('function\\s+' + fnName.replace(/[$]/g, '\\$') + '\\s*\\(', 'g');
  const m = re.exec(src);
  if (!m) return null;
  const ob = src.indexOf('{', m.index);
  if (ob < 0) return null;
  let depth = 0, str = null;
  for (let i = ob; i < src.length; i++) {
    const ch = src[i];
    if (str) { if (ch === '\\') { i++; continue; } if (ch === str) str = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { str = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return [ob, i]; }
  }
  return null;
}

/**
 * 표현식 `[from,to)` 가 만드는 객체의 최상위 키. **못 풀면 `null`**(= 판정 불가 = K-1 붉음).
 *   ① `{ … }`                      인라인 리터럴
 *   ② `_buildXxxContext(info)`      빌더 호출
 *   ③ `Object.assign(a, b, { … })`  ★v7.79 I-81 — 인자 전체의 합집합
 *   ④ `someVar`                     같은 파일 안의 마지막 대입을 따라간다
 */
function exprKeys(src, from, to, depth) {
  // ★재귀 상한은 순환 대입(`a=b; b=a`)만 막는 안전망이다. 실제 사슬은
  //   `ctx = Object.assign({}, ctxData, {…})` → `ctxData = _gatherChatContext()`
  //   → `return ctx` → `Object.assign(ctx,{…})` 로 6단까지 내려간다.
  //   ★상한을 4로 두면 그 마지막 단이 잘려 **6키가 통째로 안 보인다** — 실측으로 겪었다.
  if (depth > 12) return null;
  const raw = src.slice(from, to);
  const t = raw.trim();
  if (!t) return null;
  const off = from + (raw.length - raw.replace(/^\s+/, '').length);
  if (t[0] === '{') return topLevelKeys(src, off);
  if (/^Object\s*\.\s*assign\s*\(/.test(t)) {
    const spans = callArgSpans(src, src.indexOf('(', off));
    if (!spans) return null;
    const acc = new Set();
    for (const [a, b] of spans) {
      const ks = exprKeys(src, a, b, depth + 1);
      if (ks === null) return null;          // 인자 하나라도 못 풀면 표면 전체가 미상이다
      ks.forEach((k) => acc.add(k));
    }
    return [...acc].sort();
  }
  const call = /^([A-Za-z_$][\w$]*)\s*\(/.exec(t);
  if (call) return builderKeys(src, call[1], depth + 1);
  const id = /^([A-Za-z_$][\w$]*)$/.exec(t);
  if (id) return varKeys(src, id[1], from, depth + 1);
  return null;
}

/** `name` 에 대입된 마지막 표현식(사이트 앞쪽)을 따라간다. */
function varKeys(src, name, beforeIdx, depth) {
  // ★재귀 상한은 순환 대입(`a=b; b=a`)만 막는 안전망이다. 실제 사슬은
  //   `ctx = Object.assign({}, ctxData, {…})` → `ctxData = _gatherChatContext()`
  //   → `return ctx` → `Object.assign(ctx,{…})` 로 6단까지 내려간다.
  //   ★상한을 4로 두면 그 마지막 단이 잘려 **6키가 통째로 안 보인다** — 실측으로 겪었다.
  if (depth > 12) return null;
  const re = new RegExp('\\b' + name.replace(/[$]/g, '\\$') + '\\s*=(?!=)\\s*', 'g');
  let m, last = -1;
  while ((m = re.exec(src))) { if (m.index >= beforeIdx) break; last = m.index + m[0].length; }
  if (last < 0) return null;
  const e = stmtEnd(src, last);
  if (e < 0) return null;
  return exprKeys(src, last, e, depth + 1);
}

/**
 * 빌더 함수의 반환 객체 최상위 키 합집합. 분기마다 다른 객체를 반환하는 경우
 * (`_buildNamingContext`)를 위해 합집합을 쓴다 — 어느 분기에서든 실릴 수 있는 키는 전부 표면이다.
 *   ⓐ `return { … }`  (v7.77)
 *   ⓑ ★v7.79 I-81 — `return ident;` 형태: 그 식별자에 대한 `ident.KEY = …` 대입과
 *      `Object.assign(ident, { … })` 을 본문에서 모은다. `js/chat.js` 의
 *      `_gatherChatContext()` 가 정확히 이 형태다(리터럴이 아예 없다).
 */
function builderKeys(src, fnName, depth) {
  const span = fnBodySpan(src, fnName);
  if (!span) return null;
  const body = src.slice(span[0], span[1] + 1);
  const out = new Set();
  let found = 0;
  const rr = /return\s*\{/g; let rm;
  while ((rm = rr.exec(body))) {
    const ks = topLevelKeys(body, body.indexOf('{', rm.index + 6));
    if (ks) { found++; ks.forEach((k) => out.add(k)); }
  }
  const rid = /return\s+([A-Za-z_$][\w$]*)\s*;/.exec(body);
  if (rid) {
    const v = rid[1].replace(/[$]/g, '\\$');
    let am;
    const ar = new RegExp('\\b' + v + '\\.([A-Za-z_$][\\w$]*)\\s*=(?!=)', 'g');
    while ((am = ar.exec(body))) { out.add(am[1]); found++; }
    const oa = new RegExp('Object\\s*\\.\\s*assign\\s*\\(\\s*' + v + '\\s*,', 'g');
    while ((am = oa.exec(body))) {
      const spans = callArgSpans(body, body.indexOf('(', am.index));
      if (!spans) return null;
      for (let i = 1; i < spans.length; i++) {
        const ks = exprKeys(body, spans[i][0], spans[i][1], (depth || 0) + 1);
        if (ks === null) return null;
        ks.forEach((k) => out.add(k)); found++;
      }
    }
  }
  return found ? [...out].sort() : null;
}

/** 사이트를 감싸는 **가장 가까운 최상위 함수 선언**의 시작 위치. 없으면 -1. */
function enclosingFunctionStart(src, at) {
  const head = src.slice(0, at);
  const re = /(?:^|\n)(?:async\s+)?function\s+[A-Za-z_$][\w$]*/g;
  let m, last = -1;
  while ((m = re.exec(head))) last = m.index;
  return last;
}

/** 사이트 앞쪽에서 가장 가까운 함수 선언 이름을 찾아 상품군을 판정한다. */
function familyOfSite(src, at) {
  const head = src.slice(0, at);
  const re = /(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g;
  let m, last = null;
  while ((m = re.exec(head))) last = m[1];
  if (!last) return { fn: null, family: null };
  const low = last.toLowerCase();
  for (const f of FAMILIES) {
    if (low.indexOf(f.replace(/_/g, '')) !== -1) return { fn: last, family: f };
  }
  return { fn: last, family: null };
}

/**
 * `/api/fortune` 의 context 사이트 전건.
 * ★v7.79 I-81 — `file` 인자를 받아 **`index.html` 밖**(`js/*.js`)도 같은 규칙으로 훑는다.
 */
function clientSites(src, file) {
  const out = [];
  const re = /body:\s*JSON\.stringify\(\s*\{\s*type:\s*([^,]+?)\s*,\s*context\s*:\s*/g;
  let m;
  while ((m = re.exec(src))) {
    const at = m.index;
    const line = src.slice(0, at).split('\n').length;
    const typeExpr = m[1].trim();
    const after = re.lastIndex;
    let keys = null, shape = null;
    if (/^\{/.test(src.slice(after).replace(/^\s+/, ''))) {
      shape = 'inline';
      keys = topLevelKeys(src, src.indexOf('{', after));
    } else {
      // ★★사이트가 속한 **함수 안에서만** `ctx=` 대입을 모은다.
      //   v7.77 실측으로 배운 두 가지:
      //   ① `const ctx=_buildSajuContext(info)` 처럼 **빌더 함수**를 쓰는 사이트가 7곳.
      //      종전 열거기는 `indexOf('{')` 가 **엉뚱한 객체**(바로 뒤의 `const cfg={api1:…}`)를
      //      잡아 `naming.api1/api2` 라는 ★가짜 dangling 을 만들었다.
      //   ② `analyzeNaming` 은 `let … ctx={}` 로 선언하고 **분기마다 다시 대입**한다.
      //      함수 경계를 안 보면 앞 상품(dream)의 ctx 를 집어 온다 — 실제로 그랬다.
      //   ★두 오탐 모두 **긍정 짝 K-8** 이 잡았다. 대조군이 없었으면 「제품 결함」으로 오진했다.
      // ★v7.79 I-81 추가 — `Object.assign(ctx,{…})` 로 **덧실은** 키도 표면이다.
      //   `js/tarot.js` 가 파 ⓐ 6키를 그렇게 실었다. 안 보면 그 6키가 통째로 안 보인다.
      const fnAt = enclosingFunctionStart(src, at);
      const from = fnAt >= 0 ? fnAt : 0;
      const seg = src.slice(from, at);
      const acc = new Set();
      let hit = 0, bad = 0, sawBuilder = null, sawAssign = 0;
      const ar = /\bctx\s*=(?!=)\s*/g; let am;
      while ((am = ar.exec(seg))) {
        const rhsAt = from + am.index + am[0].length;
        const e = stmtEnd(src, rhsAt);
        if (e < 0) { bad++; continue; }
        const rhs = src.slice(rhsAt, e).trim();
        const ks = exprKeys(src, rhsAt, e, 0);
        if (ks === null) { bad++; continue; }
        ks.forEach((k) => acc.add(k)); hit++;
        const call = /^([A-Za-z_$][\w$]*)\s*\(/.exec(rhs);
        if (call && !/^Object$/.test(call[1])) sawBuilder = call[1];
      }
      const oar = /Object\s*\.\s*assign\s*\(\s*ctx\s*,/g; let om;
      while ((om = oar.exec(seg))) {
        const spans = callArgSpans(src, src.indexOf('(', from + om.index));
        if (!spans) { bad++; continue; }
        for (let i = 1; i < spans.length; i++) {
          const ks = exprKeys(src, spans[i][0], spans[i][1], 0);
          if (ks === null) { bad++; continue; }
          ks.forEach((k) => acc.add(k)); hit++; sawAssign++;
        }
      }
      // ★못 푼 형태가 하나라도 있으면 **미상**으로 남긴다 — 부분 표면은 「덜 보고 0건」이다.
      shape = bad ? 'unresolved' : (hit ? ((sawBuilder ? 'builder:' + sawBuilder : 'var') + (sawAssign ? '+assign' : '')) : 'unresolved');
      keys = (!bad && hit) ? [...acc].sort() : null;
    }
    const fam = familyOfSite(src, at);
    out.push({ file: file || 'index.html', line, typeExpr, shape, keys, fn: fam.fn, family: fam.family });
  }
  return out;
}

/** 클라이언트 소스 전건 — `index.html` + `js/*.js`. ★I-81 이 요구한 편입. */
function readClientSrcs() {
  const out = [{ file: 'index.html', src: fs.readFileSync(INDEX_PATH, 'utf8') }];
  const jsDir = path.join(FR, 'js');
  // ★디렉터리 전체를 읽는다. 새 js 파일이 생겨도 자동으로 감시 대상이 된다
  //   — 화이트리스트로 두면 「파일을 새로 만들어 빠져나가는」 침식이 안 잡힌다.
  let names = [];
  try { names = fs.readdirSync(jsDir).filter((n) => /\.js$/.test(n)).sort(); } catch (e) { /* 아래 K-0 이 붉어진다 */ }
  for (const n of names) out.push({ file: 'js/' + n, src: fs.readFileSync(path.join(jsDir, n), 'utf8') });
  return out;
}
/** 소스 묶음 전체의 사이트. */
function allSites(srcs) {
  const out = [];
  for (const s of srcs) out.push(...clientSites(s.src, s.file));
  return out;
}

const BYTYPE = promptKeysByType();
const GREAD = guardReadKeys();
const INDEX_SRC = fs.readFileSync(INDEX_PATH, 'utf8');
const CLIENT_SRCS = readClientSrcs();
const SITES = allSites(CLIENT_SRCS);

/** 상품군의 서버 보간 키 합집합 (무료 + 프리미엄 + 하위 type). */
function familyPromptKeys(fam) {
  const out = new Set();
  for (const t of Object.keys(BYTYPE)) {
    if (t === fam || t.indexOf(fam + '_') === 0) BYTYPE[t].forEach((k) => out.add(k));
  }
  return out;
}

/** 사이트 전건에서 dangling 키를 센다. (게이트 자기 뮤턴트에서도 재사용) */
function danglingOf(sites) {
  const out = [];
  for (const s of sites) {
    if (!s.family || !s.keys) continue;
    const fam = familyPromptKeys(s.family);
    if (!fam.size) continue;
    for (const k of s.keys) {
      if (fam.has(k) || GREAD.has(k)) continue;
      out.push(s.family + '.' + k + ' (' + s.file + ' ' + (s.fn || '?') + ':' + s.line + ')');
    }
  }
  return [...new Set(out)];
}

// ══════════════════════════════════════════════════════════════════════════
// ★v7.79 I-81 — 15(index.html 만) → 18(+ js/tarot.js 2 · js/chat.js 1). 줄면 「덜 보고 0건」이므로 FAIL.
const SITES_MIN = 18;
// ★총합만 보면 index.html 이 1곳 늘고 js 가 1곳 사라져도 통과한다 — **파일별**로 못박는다.
const FILE_MIN = Object.freeze({ 'index.html': 15, 'js/tarot.js': 2, 'js/chat.js': 1 });

check('K-0', '★클라이언트 `/api/fortune` context 사이트를 **전건** 열거한다 (★`js/*.js` 포함 · 커버리지 하한 ' + SITES_MIN + ')', () => {
  const noFam = SITES.filter((s) => !s.family);
  if (SITES.length < SITES_MIN)
    return { ok: false, detail: '★사이트 ' + SITES.length + ' < 하한 ' + SITES_MIN + ' — 호출 형태가 바뀌었거나 열거기가 죽었다' };
  const byFile = {};
  for (const s of SITES) byFile[s.file] = (byFile[s.file] || 0) + 1;
  const short = Object.keys(FILE_MIN).filter((f) => (byFile[f] || 0) < FILE_MIN[f]);
  if (short.length)
    return { ok: false, detail: '★파일별 하한 미달: ' + short.map((f) => f + ' ' + (byFile[f] || 0) + '<' + FILE_MIN[f]).join(', ') + ' — I-81(그 파일을 안 보던 상태)로 되돌아갔는지 확인하십시오' };
  if (noFam.length)
    return { ok: false, detail: '★상품군 미해석 ' + noFam.length + '건: ' + noFam.map((s) => s.file + ' ' + (s.fn || '?') + ':' + s.line).join(',') + ' — FAMILIES 에 넣거나 함수명을 규약에 맞추십시오' };
  const inline = SITES.filter((s) => s.shape === 'inline').length;
  return { ok: true, detail: SITES.length + '곳 전건 해석 (' + Object.keys(byFile).map((f) => f + ' ' + byFile[f]).join(' · ') + ' · 인라인 ' + inline + ')' };
});

check('K-1', '★키 추출이 **전건 성공**한다 (「못 뽑아서 0건」을 통과로 접지 않는다)', () => {
  const bad = SITES.filter((s) => !s.keys || s.keys.length === 0);
  return { ok: bad.length === 0,
    detail: bad.length ? '★추출 실패 ' + bad.map((s) => s.file + ' ' + (s.fn || '?') + ':' + s.line + '[' + s.shape + ']').join(',') : SITES.length + '곳 전건 추출' };
});

check('K-2', '★★클라이언트가 싣는데 서버가 **읽지도 보간하지도 않는** 키가 0 이다 (I-43·E-1 유형)', () => {
  const d = danglingOf(SITES);
  return { ok: d.length === 0,
    detail: d.length ? '★' + d.length + '건: ' + d.slice(0, 6).join(' / ') : '0건 (' + SITES.length + '곳 전수)' };
});

check('K-3', '★서버가 보간하는데 클라이언트가 안 싣는 키(항상 빈 슬롯)를 열거한다', () => {
  const empty = [];
  const REPLACE = new Set((GUARD_MOD && GUARD_MOD.CTX_REPLACE_KEYS) || []);
  const TJ_REPLACE = new Set((GUARD_MOD && GUARD_MOD.TOJEONG_REPLACE_KEYS) || []);
  for (const s of SITES) {
    if (!s.family || !s.keys) continue;
    for (const k of familyPromptKeys(s.family)) {
      if (s.keys.indexOf(k) !== -1) continue;
      if (REPLACE.has(k) || TJ_REPLACE.has(k)) continue;   // 서버가 만들어 넣는 키는 빈 슬롯이 아니다
      empty.push(s.family + '.' + k);
    }
  }
  const uniq = [...new Set(empty)];
  // ★열거만 한다(수리 대상 판단은 사람이). 다만 **늘어나면** 보이도록 목록을 남긴다.
  return { ok: true, detail: uniq.length ? uniq.length + '건: ' + uniq.slice(0, 8).join(',') : '0건' };
});

check('K-4', '★★긍정 대조 — 알려진 키가 실제로 잡힌다 (`saju.isLeapMonth` 가 클라에 있고 서버가 읽는다)', () => {
  const saju = SITES.filter((s) => s.family === 'saju' && s.keys);
  if (!saju.length) return { ok: false, detail: '★saju 사이트를 못 찾았다 — 열거기가 죽었다(판정 불가)' };
  const hasClient = saju.some((s) => s.keys.indexOf('isLeapMonth') !== -1);
  const serverReads = GREAD.has('isLeapMonth');
  return { ok: hasClient && serverReads,
    detail: '클라 적재=' + hasClient + ' · 서버 판독=' + serverReads +
      (hasClient && serverReads ? '' : ' ★I-43 이 되살아났거나 열거기가 눈이 멀었다') };
});

check('K-5', '★★서버의 `isLeap` 대입 지점 중 **상수 false 하드코딩**이 0 이다 (E-1 본체)', () => {
  const lines = GUARD_SRC.split('\n')
    .map((l) => l.trim())
    .filter((l) => /\bisLeap\b/.test(l) && !/^(\/\/|\*)/.test(l));
  const hard = lines.filter((l) => /isLeap\s*:\s*false\s*[,}]/.test(l));
  return { ok: hard.length === 0,
    detail: hard.length ? '★' + hard.join(' | ') : lines.length + '곳 전부 입력에서 유도' };
});

check('K-6', '★엔진 `CTX_GUARDED_KEYS` 와 `fortune.js` fallback 사본이 **순서까지** 같다', () => {
  if (!GUARD_MOD) return { ok: false, detail: '★ctxguard 모듈 적재 실패 — 판정 불가' };
  const m = /const CW_GUARDED_KEYS_FALLBACK = Object\.freeze\(\[([\s\S]*?)\]\);/.exec(FORTUNE_SRC);
  if (!m) return { ok: false, detail: '★fallback 사본을 찾지 못했다 — 판정 불가' };
  const got = (m[1].match(/'([^']+)'/g) || []).map((s) => s.slice(1, -1));
  const eng = GUARD_MOD.CTX_GUARDED_KEYS || [];
  const same = got.length === eng.length && got.every((k, i) => k === eng[i]);
  return { ok: same, detail: same ? got.length + '키 일치' : '★갈림: 엔진 ' + eng.join(',') + ' / 사본 ' + got.join(',') };
});

// ══════════════════════════════════════════════════════════════════════════
// K-7 ★★자기 뮤턴트 — 외부 하네스 없이 **스스로** 유효성을 증명한다
// ══════════════════════════════════════════════════════════════════════════
const PROBE_KEY = '__cw_probe_dangling__';
/** 파일 하나만 갈아끼운 사본 묶음. ★디스크 사본은 K-7 만 만든다(결정 109 — 최소). */
function srcsWith(file, src) {
  return CLIENT_SRCS.map((s) => (s.file === file ? { file: s.file, src: src } : s));
}

check('K-7', '★★자기 뮤턴트 — 클라 소스 사본에 **서버가 모르는 키**를 심으면 K-2 가 적발한다', () => {
  const anchor = "type:'saju',context:ctx";
  if (INDEX_SRC.split(anchor).length - 1 !== 1)
    return { ok: false, detail: '★뮤테이션 앵커가 1건이 아니다 — 판정 불가는 통과가 아니다' };
  // saju 의 `const ctx={` 에 가짜 키를 하나 심는다.
  const at = INDEX_SRC.indexOf(anchor);
  const a = INDEX_SRC.lastIndexOf('const ctx=', at), b = INDEX_SRC.lastIndexOf('const ctx =', at);
  const start = Math.max(a, b);
  if (start < 0) return { ok: false, detail: '★saju 의 ctx 리터럴을 못 찾았다 — 판정 불가' };
  const ob = INDEX_SRC.indexOf('{', start);
  const mutated = INDEX_SRC.slice(0, ob + 1) + PROBE_KEY + ':1,' + INDEX_SRC.slice(ob + 1);
  const d = CWTMP.mk('cw_ctxkey_');
  const p = path.join(d, 'index.html');
  fs.writeFileSync(p, mutated);
  const caught = danglingOf(allSites(srcsWith('index.html', fs.readFileSync(p, 'utf8'))))
    .some((x) => x.indexOf(PROBE_KEY) !== -1);
  if (!caught) return { ok: false, detail: '★심은 키를 못 잡았다 — K-2 의 0건은 아무것도 증명하지 않는다' };
  // ★I-81 편입분에도 같은 힘이 미치는지 — `js/chat.js` 사이트에도 심어 본다.
  //   index.html 에서만 잡히면 편입은 「열거만 하고 판정은 안 하는」 상태다.
  const chat = CLIENT_SRCS.find((s) => s.file === 'js/chat.js');
  if (!chat) return { ok: false, detail: '★js/chat.js 를 못 읽었다 — 판정 불가' };
  const ca = chat.src.indexOf('const ctx = Object.assign({}, ctxData, {');
  if (ca < 0) return { ok: false, detail: '★js/chat.js 의 ctx 조립부를 못 찾았다 — 앵커가 바뀌었다면 갱신하십시오' };
  const cob = chat.src.indexOf('{', chat.src.indexOf('ctxData,', ca));
  const cmut = chat.src.slice(0, cob + 1) + PROBE_KEY + ':1,' + chat.src.slice(cob + 1);
  const caught2 = danglingOf(allSites(srcsWith('js/chat.js', cmut)))
    .some((x) => x.indexOf(PROBE_KEY) !== -1);
  return { ok: caught2,
    detail: caught2 ? '가짜 키 적발 2/2 (index.html · ★js/chat.js) — 편입분에도 판정이 미친다'
      : '★js/chat.js 에 심은 키를 못 잡았다 — I-81 편입이 열거뿐이고 판정은 여전히 없다' };
});

check('K-8', '★긍정 짝 — **무변경** 사본의 적발 집합이 라이브와 **동일**하고 심은 가짜 키가 없다 (K-7 이 항상 적발인 위약 차단)', () => {
  const d = CWTMP.mk('cw_ctxkey_ok_');
  const p = path.join(d, 'index.html');
  fs.writeFileSync(p, INDEX_SRC);
  const found = danglingOf(allSites(srcsWith('index.html', fs.readFileSync(p, 'utf8'))));
  const live = danglingOf(SITES);
  // ★「0건」이 아니라 「**라이브와 동일**」로 판정한다.
  //   I-81 편입으로 실제 dangling 이 드러난 뒤에도 이 검사가 오탐 판별력을 유지하게 하기 위함이다.
  //   무변경인데 라이브와 달라지면 그것이 곧 열거기의 비결정성(= 오탐 원천)이다.
  const probe = found.filter((x) => x.indexOf(PROBE_KEY) !== -1);
  if (probe.length) return { ok: false, detail: '★무변경본에서 심은 키가 잡힌다: ' + probe.join(' / ') };
  const same = found.length === live.length && found.every((x, i) => x === live[i]);
  return { ok: same,
    detail: same ? '무변경본 적발 집합 == 라이브 (' + live.length + '건) · 가짜 키 0'
      : '★무변경본 ' + found.length + '건 != 라이브 ' + live.length + '건 — 열거기가 비결정적이다' };
});

check('K-9', '★★I-81 편입 유효성 — `js/*.js` 사이트에서 키가 **실제로 뽑힌다** (안 뽑히면 dangling 0건은 「덜 보고 0건」)', () => {
  // ★알려진 키가 안 뽑히면 「편입했는데 표면이 비었다」 = 조용한 무감시다.
  //   `Object.assign` 안쪽(파 ⓐ 6키)과 `ctx.KEY=` 대입(`_gatherChatContext`)을 각각 못박는다.
  const WANT = [
    { file: 'js/tarot.js', keys: ['category', 'question', 'cards', 'ilgan', 'lacking', 'cal', 'y', 'm', 'd', 'h', 'leap'], why: 'Object.assign(ctx,{…}) 안쪽' },
    { file: 'js/chat.js', keys: ['ilgan', 'birth', 'hourBranch', 'lacking', 'personaName', 'category', 'cal', 'y', 'm', 'd', 'h', 'leap'], why: '`ctx.KEY=` 대입 + Object.assign 3인자' },
  ];
  const bad = [];
  for (const w of WANT) {
    const sites = SITES.filter((s) => s.file === w.file && s.keys);
    if (!sites.length) { bad.push(w.file + ':사이트 0 — 편입이 안 됐다'); continue; }
    const union = new Set();
    for (const s of sites) s.keys.forEach((k) => union.add(k));
    const miss = w.keys.filter((k) => !union.has(k));
    if (miss.length) bad.push(w.file + '(' + w.why + ') 미추출: ' + miss.join(','));
  }
  return { ok: bad.length === 0,
    detail: bad.length ? '★' + bad.join(' / ') : WANT.map((w) => w.file + ' ' + w.keys.length + '키').join(' · ') + ' 전건 추출' };
});

done();
