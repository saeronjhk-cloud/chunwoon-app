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

const EXPECTED_TOTAL_MIN = 9;
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
  for (const arr of ['COMPAT_BIRTH_KEYS', 'TOJEONG_BIRTH_KEYS', 'TOJEONG_REPLACE_KEYS',
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

/**
 * 빌더 함수(`_buildSajuContext` 등)가 `return {…}` 하는 **모든** 객체 리터럴의
 * 최상위 키 합집합. 분기마다 다른 객체를 반환하는 경우(`_buildNamingContext`)를 위해
 * 합집합을 쓴다 — 어느 분기에서든 실릴 수 있는 키는 전부 표면이다.
 */
function builderReturnKeys(src, fnName) {
  const re = new RegExp('function\\s+' + fnName.replace(/[$]/g, '\\$') + '\\s*\\(', 'g');
  const m = re.exec(src);
  if (!m) return null;
  // 함수 본문 범위를 중괄호 균형으로 잡는다.
  const ob = src.indexOf('{', m.index);
  let depth = 0, end = -1, str = null;
  for (let i = ob; i < src.length; i++) {
    const ch = src[i];
    if (str) { if (ch === '\\') { i++; continue; } if (ch === str) str = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { str = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end < 0) return null;
  const body = src.slice(ob, end + 1);
  const out = new Set();
  let found = 0;
  const rr = /return\s*\{/g; let rm;
  while ((rm = rr.exec(body))) {
    const ks = topLevelKeys(body, body.indexOf('{', rm.index + 6));
    if (ks) { found++; ks.forEach((k) => out.add(k)); }
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

/** `/api/fortune` 의 context 사이트 전건. */
function clientSites(src) {
  const out = [];
  const re = /body:\s*JSON\.stringify\(\s*\{\s*type:\s*([^,]+?)\s*,\s*context\s*:\s*/g;
  let m;
  while ((m = re.exec(src))) {
    const at = m.index;
    const line = src.slice(0, at).split('\n').length;
    const typeExpr = m[1].trim();
    const after = re.lastIndex;
    let keys = null, shape = null;
    if (/^\{/.test(src.slice(after).trimStart())) {
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
      const fnAt = enclosingFunctionStart(src, at);
      const from = fnAt >= 0 ? fnAt : 0;
      const seg = src.slice(from, at);
      const acc = new Set();
      let hit = 0, sawBuilder = null;
      const ar = /\bctx\s*=\s*/g; let am;
      while ((am = ar.exec(seg))) {
        const rhsAt = from + am.index + am[0].length;
        const rhs = src.slice(rhsAt, src.indexOf(';', rhsAt) + 1).trim();
        if (rhs.startsWith('{')) {
          const ks = topLevelKeys(src, rhsAt);
          if (ks && ks.length) { ks.forEach((k) => acc.add(k)); hit++; }
        } else {
          const call = /^([A-Za-z_$][\w$]*)\s*\(/.exec(rhs);
          if (!call) continue;
          const ks = builderReturnKeys(src, call[1]);
          if (ks && ks.length) { ks.forEach((k) => acc.add(k)); hit++; sawBuilder = call[1]; }
        }
      }
      shape = hit ? (sawBuilder ? 'builder:' + sawBuilder : 'var') : 'unresolved';
      keys = hit ? [...acc].sort() : null;
    }
    const fam = familyOfSite(src, at);
    out.push({ line, typeExpr, shape, keys, fn: fam.fn, family: fam.family });
  }
  return out;
}

const BYTYPE = promptKeysByType();
const GREAD = guardReadKeys();
const INDEX_SRC = fs.readFileSync(INDEX_PATH, 'utf8');
const SITES = clientSites(INDEX_SRC);

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
      out.push(s.family + '.' + k + ' (' + (s.fn || '?') + ':' + s.line + ')');
    }
  }
  return [...new Set(out)];
}

// ══════════════════════════════════════════════════════════════════════════
const SITES_MIN = 15;   // ★v7.77 실측. 줄어들면 「덜 보고 0건」이므로 FAIL.

check('K-0', '★클라이언트 `/api/fortune` context 사이트를 **전건** 열거한다 (커버리지 하한 ' + SITES_MIN + ')', () => {
  const noFam = SITES.filter((s) => !s.family);
  if (SITES.length < SITES_MIN)
    return { ok: false, detail: '★사이트 ' + SITES.length + ' < 하한 ' + SITES_MIN + ' — 호출 형태가 바뀌었거나 열거기가 죽었다' };
  if (noFam.length)
    return { ok: false, detail: '★상품군 미해석 ' + noFam.length + '건: ' + noFam.map((s) => (s.fn || '?') + ':' + s.line).join(',') + ' — FAMILIES 에 넣거나 함수명을 규약에 맞추십시오' };
  const inline = SITES.filter((s) => s.shape === 'inline').length;
  return { ok: true, detail: SITES.length + '곳 전건 해석 (인라인 ' + inline + ' · 변수 ' + (SITES.length - inline) + ')' };
});

check('K-1', '★키 추출이 **전건 성공**한다 (「못 뽑아서 0건」을 통과로 접지 않는다)', () => {
  const bad = SITES.filter((s) => !s.keys || s.keys.length === 0);
  return { ok: bad.length === 0,
    detail: bad.length ? '★추출 실패 ' + bad.map((s) => (s.fn || '?') + ':' + s.line).join(',') : SITES.length + '곳 전건 추출' };
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
  const mutated = INDEX_SRC.slice(0, ob + 1) + '__cw_probe_dangling__:1,' + INDEX_SRC.slice(ob + 1);
  const d = CWTMP.mk('cw_ctxkey_');
  const p = path.join(d, 'index.html');
  fs.writeFileSync(p, mutated);
  const caught = danglingOf(clientSites(fs.readFileSync(p, 'utf8')))
    .some((x) => x.indexOf('__cw_probe_dangling__') !== -1);
  return { ok: caught,
    detail: caught ? '가짜 키 적발 — K-2 가 실제로 작동한다' : '★심은 키를 못 잡았다 — K-2 의 0건은 아무것도 증명하지 않는다' };
});

check('K-8', '★긍정 짝 — **무변경** 사본에서는 그 가짜 키가 잡히지 않는다 (K-7 이 항상 적발인 위약 차단)', () => {
  const d = CWTMP.mk('cw_ctxkey_ok_');
  const p = path.join(d, 'index.html');
  fs.writeFileSync(p, INDEX_SRC);
  const found = danglingOf(clientSites(fs.readFileSync(p, 'utf8')));
  return { ok: found.length === 0, detail: found.length ? '★무변경본에서 ' + found.length + '건: ' + found.slice(0, 4).join(' / ') : '0건' };
});

done();
