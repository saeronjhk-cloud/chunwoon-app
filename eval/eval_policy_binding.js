// 천운 — 처리방침 결속 게이트 · v7.83 신설 (E-13 · E-14 · E-15)
// ═══════════════════════════════════════════════════════════════════════════
// 【왜 신설하는가】
//   v7.82 가 개인정보 처리방침 14개 조항을 코드 실측에 맞춰 전면 재작성했다.
//   ★그런데 처리방침은 **코드와 함께 썩는다.** 지금 정확해도 다음 변경에서 다시 어긋난다.
//   v7.82 §1-2 가 실측한 어긋남은 두 방향이었다:
//     · 하는 일을 **안 한다고** 적었다 (서버 전송 · localStorage 영구 저장)
//     · 안 하는 일을 **한다고** 적었다 (Google Analytics · AdSense — 전부 주석이었다)
//   ★결정 128: 「~하지 않습니다」라는 **부정 단언**을 쓸 때는 그 부정을 **검사로 만들 수
//     있는지**를 먼저 물어라. 만들 수 없으면 그 단언을 쓰지 마라.
//   ⟹ 이 게이트가 그 시도다. 처리방침이 하는 세 개의 부정 단언을 코드에 결속한다.
//
// 【검사하는 세 관계】
//   E-13 모델   — 코드의 기본 LLM 모델  ↔ 「Anthropic 이 기본적으로 보관하지 않는다」
//   E-14 수탁자 — api 의 실제 외부 호출 ↔ 처리방침 제4조 처리위탁 명단
//   E-15 쿠키   — GA/AdSense 활성 여부  ↔ 처리방침 제8조 「사용하지 않습니다」
//
// 【설계 원칙 — E-7e·I-126 수리와 같다】
//   ★결정 126 — 결속 검사에는 **그 값을 쓰지 않는다.**
//     「기본 모델은 claude-sonnet-5 여야 한다」로 적으면 그 순간 값이 **세 곳**이 되고
//     세 번째가 가장 먼저 썩는다. 이 게이트는 **소스에서 뽑은 것끼리 비교**만 한다.
//   ★결정 127 — 검사 대상을 **열거하지 않는다.**
//     수탁자 호스트를 손으로 적으면 목록에 없는 새 호스트를 영원히 못 본다.
//     ⟹ api 트리의 **비주석 코드**에서 기계 추출하고, **모르는 호스트는 FAIL**(fail-closed).
//   ★결정 128 — **양방향**으로 건다. 「쓰는데 안 쓴다고 적음」과 「안 쓰는데 쓴다고 적음」
//     둘 다 붉어져야 한다. E-15 가 그 형태다.
//
// 【공허 통과 차단】
//   ★추출이 0건이면 「위반 0건」이 아니라 **「판정 못함」**이다 — 전부 FAIL 로 접는다.
//   ★그리고 결속 대상(처리방침의 그 문장)이 사라져도 FAIL 이다(E-13c). 문장을 지우면
//     검사가 조용히 공허해지는데, 그것은 통과가 아니다.
//
// 【★주석 함정 — 실측된 오탐】
//   순진하게 `grep https://` 하면 `api/fortune.js:349` 의 **주석 안 예시**
//   (스크럽 동작 설명용 가짜 CDN 호스트)가 잡힌다. v7.83 착수 시 실제로 잡혔다.
//   ⟹ 주석을 제거한 뒤 추출하고, ★그 제거기 자신을 SELF-3 이 합성 입력으로 검증한다.
//
// 【한계 — 정직하게】
//   ★Covered Model 집합(보존 30일 필수)은 **외부 사실**이라 이 트리에서 뽑을 수 없다.
//     2026-08-11 Anthropic 공식 문서 실측분을 상수로 둔다(v7.82 §1-4).
//     ⟹ 이 상수만은 사람이 주기적으로 재확인해야 한다. 그 사실을 E-13b 가 detail 에 적는다.
//   ★호스트→수탁자 법인명 매핑도 외부 사실이다(호스트는 법인명이 아니다).
//     ⟹ 매핑에 **없는** 호스트는 통과가 아니라 FAIL 로 접어 fail-open 을 막는다.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
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
    console.log('\n[policy_binding] 실패 내역');
    for (const f of fails) console.log('  FAIL ' + f.id + ' ' + f.title + '  -> ' + f.detail);
  }
  console.log('[policy_binding] front_root=' + String(FR));
  console.log('[policy_binding] total=' + total + ' pass=' + pass + ' fail=' + fail);
  process.exit(fail ? 1 : 0);
}

// ══════════════════════════════════════════════════════════════════════════
// 0. 외부 사실 상수 — 이 트리에서 뽑을 수 없는 것만 둔다
// ══════════════════════════════════════════════════════════════════════════

// ★Anthropic Covered Model — 프롬프트·응답이 **30일간 의무 보존**되는 모델군.
//   2026-08-11 Anthropic 공식 문서 실측 (v7.82 §1-4). 계열명으로 잡는다 —
//   버전이 올라가도(`-5`, `-6` …) 계열이 같으면 걸리도록.
const COVERED_MODEL_RX = /(fable|mythos)/i;
const COVERED_MODEL_ASOF = '2026-08-11';

// ★호스트 → 처리방침에 등재돼야 하는 수탁자 표기.
//   ★이 표에 **없는** 호스트가 나오면 통과가 아니라 FAIL 이다(E-14b).
const HOST_TO_PROCESSOR = Object.freeze({
  'api.anthropic.com': 'Anthropic',
  'api.tosspayments.com': '토스페이먼츠',
});

// ══════════════════════════════════════════════════════════════════════════
// 1. 추출기 — 주석 제거 · 호스트 열거 · 처리방침 평문화
// ══════════════════════════════════════════════════════════════════════════

/** JS 주석 제거 (줄 · 블록). 문자열 리터럴 안의 `//` 를 지우지 않도록 따옴표를 추적한다. */
function stripJsComments(src) {
  let out = '', i = 0, q = null, inLine = false, inBlock = false;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (inLine) { if (c === '\n') { inLine = false; out += c; } i++; continue; }
    if (inBlock) { if (c === '*' && n === '/') { inBlock = false; i += 2; } else i++; continue; }
    if (q) {
      out += c;
      if (c === '\\') { out += (n === undefined ? '' : n); i += 2; continue; }
      if (c === q) q = null;
      i++; continue;
    }
    if (c === '/' && n === '/') { inLine = true; i += 2; continue; }
    if (c === '/' && n === '*') { inBlock = true; i += 2; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; out += c; i++; continue; }
    out += c; i++;
  }
  return out;
}

/** HTML 주석 제거. */
function stripHtmlComments(src) { return src.replace(/<!--[\s\S]*?-->/g, ' '); }

/** api 트리의 `.js` 전건 열거 (재귀). */
function apiFiles(dir, acc) {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return acc; }
  for (const e of ents) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') apiFiles(full, acc); }
    else if (e.isFile() && /\.(js|mjs|cjs)$/.test(e.name)) acc.push(full);
  }
  return acc;
}

let _scan = null;
function scan() {
  if (_scan) return _scan;
  if (!FR) throw new Error('front_root 미해석 — CHUNWOON_FRONT_ROOT 를 지정하십시오');
  const files = apiFiles(path.join(FR, 'api'), []);
  const hosts = new Map();          // host -> [파일:라인]
  let commentHosts = 0;
  for (const f of files) {
    const raw = fs.readFileSync(f, 'utf8');
    const code = stripJsComments(raw);
    const rel = path.relative(FR, f).split(path.sep).join('/');
    const grab = (text) => {
      const s = new Set();
      for (const m of text.matchAll(/https?:\/\/([A-Za-z0-9][A-Za-z0-9.-]*\.[A-Za-z]{2,})/g)) s.add(m[1].toLowerCase());
      return s;
    };
    const inCode = grab(code), inRaw = grab(raw);
    for (const h of inCode) { if (!hosts.has(h)) hosts.set(h, []); hosts.get(h).push(rel); }
    for (const h of inRaw) if (!inCode.has(h)) commentHosts++;
  }
  // 처리방침 평문 — HTML 주석 제거 후 태그 제거, 공백 정규화
  const html = fs.readFileSync(path.join(FR, 'index.html'), 'utf8');
  const policyText = stripHtmlComments(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const htmlCode = stripHtmlComments(html);       // 주석만 제거(태그는 남긴다) — 활성 스크립트 판정용
  _scan = { files, hosts, commentHosts, html, htmlCode, policyText };
  return _scan;
}

// ══════════════════════════════════════════════════════════════════════════
// 2. SELF — 자기검사 · 대상 확보 · 추출기 유효성
// ══════════════════════════════════════════════════════════════════════════
const EXPECTED_TOTAL_MIN = 11;

check('SELF-1', '★_gate_pins.json 자기검사 — 자기 sha256 · 검사 수 하한', () => {
  const pinPath = path.join(__dirname, '_gate_pins.json');
  if (!fs.existsSync(pinPath)) return { ok: false, detail: '★pin 표 부재 — 판정 불가' };
  let pins = null;
  try { pins = JSON.parse(fs.readFileSync(pinPath, 'utf8')); } catch (e) { return { ok: false, detail: 'pin 판독 실패' }; }
  const spec = pins && pins.evals && pins.evals['eval_policy_binding.js'];
  if (!spec || !spec.sha256) return { ok: false, detail: '★pin 표에 자기 항목이 없다' };
  const self = crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex');
  if (self !== spec.sha256) return { ok: false, detail: '★자기 sha256 불일치 — pin 재생성 없이 수정됐다' };
  const cm = spec.checks_min;
  if (typeof cm === 'number' && cm < EXPECTED_TOTAL_MIN)
    return { ok: false, detail: '★checks_min(' + cm + ') < 하한(' + EXPECTED_TOTAL_MIN + ')' };
  return { ok: true, detail: 'sha 일치 · checks_min=' + cm };
});

check('SELF-2', '대상 확보 — front_root · api 트리 · index.html', () => {
  if (!FR) return { ok: false, detail: 'front_root=null' };
  const s = scan();
  const idx = fs.statSync(path.join(FR, 'index.html')).size;
  if (s.files.length < 2) return { ok: false, detail: '★api 파일 ' + s.files.length + '건 — 판정 불가' };
  if (idx < 100000) return { ok: false, detail: '★index.html ' + idx + 'B — 판정 불가' };
  return { ok: true, detail: 'api ' + s.files.length + '파일 · index.html ' + idx + 'B' };
});

check('SELF-3', '★주석 제거기 유효성 — 합성 입력으로 3형태를 실제로 지운다 (E-14·E-15 의 전제)', () => {
  const line = 'const a = 1; // https://line-comment.example.com/x\n';
  const blk = 'const b = 2; ' + '/' + '* https://block-comment.example.com/y *' + '/ const c = 3;';
  const str = 'const d = "https://string-literal.example.com/z";';
  const jsOut = stripJsComments(line + blk + str);
  const okLine = !jsOut.includes('line-comment.example.com');
  const okBlk = !jsOut.includes('block-comment.example.com');
  const okStr = jsOut.includes('string-literal.example.com');   // ★문자열은 **지우면 안 된다**
  const okKeep = jsOut.includes('const c = 3;');
  const htmlOut = stripHtmlComments('<p>keep</p><!-- <script src="https://html-comment.example.com/a"></script> -->');
  const okHtml = !htmlOut.includes('html-comment.example.com') && htmlOut.includes('keep');
  const bad = [];
  if (!okLine) bad.push('줄주석 미제거');
  if (!okBlk) bad.push('블록주석 미제거');
  if (!okStr) bad.push('★문자열 리터럴이 지워짐(과잉 제거 — 진짜 호출을 놓친다)');
  if (!okKeep) bad.push('블록주석 뒤 코드 소실');
  if (!okHtml) bad.push('HTML 주석 미제거');
  return { ok: bad.length === 0, detail: bad.length ? '★' + bad.join(' / ') : '줄·블록·HTML 제거 + 문자열 보존 전건 확인' };
});

// ══════════════════════════════════════════════════════════════════════════
// 3. E-13 — 모델 결속
//    처리방침 §5-1 은 「Anthropic 이 대화 내용을 **기본적으로 보관하지 않는다**」고
//    단언한다. 그 단언은 **모델에 달려 있다** — Covered Model 은 30일 의무 보존이다.
//    ★그리고 모델은 `CW_LLM_MODEL` 환경변수로 **코드 변경 없이** 바뀐다.
//      ⟹ 누가 값을 바꾸면 처리방침이 **그날로 거짓**이 되는데 아무 데도 붉어지지 않았다.
// ══════════════════════════════════════════════════════════════════════════

/** 소스에서 기본 모델 문자열을 **기계 추출**한다(열거하지 않는다 — 결정 127). */
function defaultModel() {
  const src = stripJsComments(fs.readFileSync(path.join(FR, 'api', 'fortune.js'), 'utf8'));
  const i = src.indexOf('CW_LLM_MODEL');
  if (i < 0) return null;
  // `CW_LLM_MODEL` 선언 이후 첫 폴백 문자열 리터럴이 기본값이다.
  const seg = src.slice(i, i + 600);
  const m = seg.match(/:\s*['"`]([A-Za-z0-9._-]{3,64})['"`]/);
  return m ? m[1] : null;
}

check('E-13a', '★기본 LLM 모델을 소스에서 **기계 추출**한다 (추출 실패는 통과가 아니라 판정 불가)', () => {
  const v = defaultModel();
  return { ok: !!v, detail: v ? 'CW_LLM_MODEL 기본값 = ' + v : '★추출 실패 — 선언 형태가 바뀌었다. 이 게이트를 고치기 전에는 E-13b 가 아무것도 보증하지 않는다' };
});

check('E-13b', '★★기본 모델이 **Covered Model 이 아니다** (Covered = 프롬프트·응답 30일 의무 보존)', () => {
  const v = defaultModel();
  if (!v) return { ok: false, detail: '★기본값 미추출 — 판정 불가(E-13a 참조)' };
  const hit = COVERED_MODEL_RX.test(v);
  return { ok: !hit,
    detail: hit
      ? '★★' + v + ' 는 Covered Model 이다 — 30일 의무 보존이므로 처리방침 §5-1 의 「기본적으로 보관하지 않습니다」가 **거짓**이 된다. 모델을 되돌리거나 처리방침 §5-1 의 보유기간을 고치십시오'
      : v + ' — Covered 아님 (외부 사실 기준일 ' + COVERED_MODEL_ASOF + ' · ★이 상수는 사람이 주기적으로 재확인해야 한다)' };
});

check('E-13c', '★결속 대상 실재 — 처리방침이 실제로 「학습 미이용 · 기본 미보관」을 단언하고 있다', () => {
  const t = scan().policyText;
  const a = /모델\s*학습에\s*이용하지\s*않/.test(t);
  const b = /기본적으로\s*보관하지\s*않/.test(t);
  if (a && b) return { ok: true, detail: '두 단언 실재 — E-13b 가 지킬 대상이 있다' };
  const miss = [];
  if (!a) miss.push('「모델 학습에 이용하지 않」');
  if (!b) miss.push('「기본적으로 보관하지 않」');
  return { ok: false,
    detail: '★처리방침에서 ' + miss.join(' · ') + ' 서술이 사라졌다 — 문장을 지우면 E-13b 가 조용히 공허해진다. 의도한 개정이면 이 검사를 함께 고치십시오' };
});

// ══════════════════════════════════════════════════════════════════════════
// 4. E-14 — 수탁자 결속
//    새 제3자 API 를 붙이고 처리방침에 고지하지 않는 것을 막는다.
//    ★문자열 열거가 아니라 **집합 관계**로 판정한다(결정 117·127).
// ══════════════════════════════════════════════════════════════════════════

check('E-14a', '★api 트리의 외부 호출 호스트를 **비주석 코드에서** 기계 추출한다 (열거 0건은 판정 불가)', () => {
  const s = scan();
  const list = [...s.hosts.keys()].sort();
  if (list.length === 0)
    return { ok: false, detail: '★호스트 0건 — 「위반 없음」이 아니라 **추출이 성립하지 않음**이다(공허 통과 차단)' };
  return { ok: true, detail: list.length + '건: ' + list.join(', ') + (s.commentHosts ? ' (주석 안 호스트 ' + s.commentHosts + '건은 제외됨)' : '') };
});

check('E-14b', '★★추출 호스트 **전건**이 수탁자 매핑에 있다 (모르는 호스트는 통과가 아니라 FAIL)', () => {
  const s = scan();
  const unknown = [...s.hosts.keys()].filter((h) => !HOST_TO_PROCESSOR[h]);
  return { ok: unknown.length === 0,
    detail: unknown.length
      ? '★★미등재 호스트 ' + unknown.length + '건: ' + unknown.map((h) => h + '(' + s.hosts.get(h).join(',') + ')').join(' / ')
        + ' — 새 외부 API 를 붙였다면 ⑴이 매핑에 법인명을 넣고 ⑵처리방침 제4조·제5조에 수탁자를 추가하십시오'
      : [...s.hosts.keys()].length + '건 전건 매핑됨' };
});

check('E-14c', '★★매핑된 수탁자 **전건**이 처리방침 제4조 처리위탁 명단에 등재돼 있다', () => {
  const s = scan();
  const need = [...new Set([...s.hosts.keys()].map((h) => HOST_TO_PROCESSOR[h]).filter(Boolean))];
  if (need.length === 0) return { ok: false, detail: '★대조할 수탁자 0건 — 판정 불가(E-14a·E-14b 참조)' };
  const miss = need.filter((n) => !s.policyText.includes(n));
  return { ok: miss.length === 0,
    detail: miss.length
      ? '★★처리방침 미등재 수탁자: ' + miss.join(', ') + ' — 실제로 개인정보를 보내면서 고지하지 않고 있다'
      : need.length + '건 전건 등재: ' + need.join(', ') };
});

// ══════════════════════════════════════════════════════════════════════════
// 5. E-15 — 쿠키 서술 결속 (★양방향)
//    v7.82 I-112 는 **반대 방향** 오류였다 — 안 쓰는데 쓴다고 적혀 있었다.
//    ⟹ 「활성인데 미사용이라 적음」과 「비활성인데 사용한다고 적음」을 **둘 다** 잡는다.
// ══════════════════════════════════════════════════════════════════════════

const TRACKER_TOKENS = Object.freeze([
  'googletagmanager.com',
  'pagead2.googlesyndication.com',
  'adsbygoogle',
]);

/** GA/AdSense 가 **주석 밖에서 실제로 로드되는가**. */
function trackerActive() {
  const s = scan();
  // HTML 주석 제거 후, `<script>` 블록 안의 JS 주석까지 제거한다.
  const html = s.htmlCode.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi,
    (m, body) => m.replace(body, stripJsComments(body)));
  const hit = TRACKER_TOKENS.filter((t) => html.includes(t));
  return { active: hit.length > 0, hit };
}

check('E-15a', '★GA/AdSense 활성 여부를 **주석 밖 기준**으로 판정한다 (판정 자체가 성립한다)', () => {
  const r = trackerActive();
  const s = scan();
  const rawHit = TRACKER_TOKENS.filter((t) => s.html.includes(t));
  return { ok: true,
    detail: '활성=' + r.active + (r.active ? ' [' + r.hit.join(',') + ']' : '')
      + ' · 원문 등장 ' + rawHit.length + '종' + (rawHit.length && !r.active ? ' (전부 주석 안)' : '') };
});

check('E-15b', '★처리방침 제8조가 「분석 도구·광고를 사용하지 않는다」고 단언하는가를 판정한다', () => {
  const t = scan().policyText;
  const claimsNone = /Google\s*Analytics[\s\S]{0,80}?사용하지\s*않/.test(t) || /분석\s*도구[\s\S]{0,80}?사용하지\s*않/.test(t);
  return { ok: true, detail: '미사용 단언=' + claimsNone };
});

check('E-15c', '★★결속 — 「실제 활성 여부」와 「처리방침 제8조의 단언」이 **일치**한다 (양방향)', () => {
  const t = scan().policyText;
  const r = trackerActive();
  const claimsNone = /Google\s*Analytics[\s\S]{0,80}?사용하지\s*않/.test(t) || /분석\s*도구[\s\S]{0,80}?사용하지\s*않/.test(t);
  if (r.active && claimsNone)
    return { ok: false,
      detail: '★★추적 도구가 **활성**인데(' + r.hit.join(',') + ') 처리방침은 「사용하지 않습니다」라고 단언한다 — **거짓 고지**다. 스크립트를 되돌리거나 제8조를 개정하고 쿠키 동의를 검토하십시오' };
  if (!r.active && !claimsNone)
    return { ok: false,
      detail: '★추적 도구가 **비활성**인데 처리방침 제8조에 미사용 단언이 없다 — v7.82 I-112 와 같은 **과잉 고지** 방향이다. 제8조를 실측에 맞추십시오' };
  return { ok: true, detail: '일치 (활성=' + r.active + ' · 미사용 단언=' + claimsNone + ')' };
});

done();
