// 천운 — context **죽은 값(dead value)** 게이트 · v7.78 신설 (I-70)
// ═══════════════════════════════════════════════════════════════════════════
// 【무엇을 잡는가 — 기존 두 검사와 다른 제3의 범주】
//   `eval_ctx_key_surface.js` 는 **키의 존재**만 본다:
//     · K-2 = 클라가 싣는데 서버가 안 읽는 키          (dangling key)
//     · K-3 = 서버가 보간하는데 클라가 안 싣는 키      (빈 슬롯)
//   그런데 v7.78 에 실측된 I-70 은 **둘 다 아니다**:
//     ★신설 = 클라가 싣기는 하는데 **값이 구조적으로 항상 비는 키** (dead value)
//   키가 있으니 K-3 이 못 보고, 서버가 읽으니 K-2 도 못 본다. 표면은 완벽한데
//   프롬프트에 들어가는 것은 빈 문자열이다 — **조용히 품질만 깎인다.**
//
// 【실측된 I-70 (v7.78 수리 전)】
//   `index.html` 의 `window._sajuResultData = info` 에서 `info` 는
//   `{name,gender,calType,…,pillars,els,sipsung}` 이었다 — `dominant` 도 `lacking` 도 없다.
//   그런데 그것을 읽는 소비자가 3곳이었다:
//     ① `js/chat.js:183-184`  `ctx.dominant = s.dominant||''` → daily_message 프롬프트 두 자리가 항상 빈다
//     ② `index.html:7168`     작명(사람) 사주연동 폴백 → `dominant:''` · `lacking:'없음'`
//     ③ `index.html:7242`     닉네임 사주연동 폴백 → `lacking:''`
//   ②③ 은 사용자가 **작명 폼에 생년월일을 안 넣고 이미 본 사주 결과를 재사용**할 때 탄다.
//   그때 UI 는 「사주 정보가 있으면 부족한 오행을 보완하는 더 풍부한 작명이 가능해요」라고
//   약속한다. 약속과 실제가 갈렸다 — **작명 품질에 직결**된다.
//
// 【왜 정적 분석이 아니라 런타임인가】
//   「구조적으로 항상 빈다」는 표현식 분석으로는 못 판정한다. `info.dominant||''` 는
//   소스만 보면 「값이 있으면 쓴다」로 읽힌다. 정적 표현식 추론은 v7.78 세션에서
//   **두 번 실패**했다. ⟹ 이 게이트는 `jsdom` 으로 실제 UI 를 조작해 `/api/fortune`
//   으로 나가는 **payload 를 그대로 가로채** 값을 본다(`eval_lunar_ui_dom.js` 의 성질 ·
//   `eval_ctxguard.js` CT-1 의 「인라인 script 전건을 문서 순서대로」 성질을 따른다).
//   ★열거기를 **복사하지 않았다** — 성질만 가져왔다(결정 105).
//
// 【「항상 빈다」의 판정 — 표본과 분모】
//   생년월일 3종(오행 분포가 서로 다른 검체)으로 상품 9종을 실구동해 payload 27벌을 모은다.
//   서버가 그 type 에서 실제로 읽는 키만 대상으로 하고(= 분모), **전 표본에서 비어 있으면**
//   dead value 로 판정한다. 1표본만으로는 「그 입력이 마침 비었다」와 구분되지 않는다.
//   ★비었다 = `''` · `null` · `undefined` · 빈 배열. 한국어 자리표시자(`없음`·`미선택`)는
//     D-1 의 판정 기준에 **넣지 않는다** — `compat.lacking` 처럼 「진짜로 없어서 없음」인
//     정당한 산출이 오분류되기 때문이다. 그 범주는 D-6 이 **래칫**으로 따로 감시한다.
//
// 【자기 유효성 — 0건이 아무것도 증명하지 않는 것을 막는다】
//   · D-0 커버리지 하한(표본 수 · 상품 수 · 검사한 (type,key) 쌍 수) — ★분모 없는 0 은 측정이 아니다
//   · D-3 자기 뮤턴트: 살아 있는 키를 사본에서 `''` 로 만들면 D-1 이 적발하는가
//   · D-4 긍정 짝: 무변경 사본에서는 그 뮤턴트가 안 잡히는가 (D-3 이 항상-적발인 위약 차단)
//   · D-2 긍정 대조: 값이 실제로 차는 키가 「빈 값」으로 오분류되지 않는가
//
// 【임시 파일】
//   ★이 게이트는 디스크에 사본을 **만들지 않는다.** jsdom 은 HTML 문자열을 직접 받으므로
//   뮤턴트도 메모리에서 끝난다. I-62 의 목적은 임시 사본 누수 차단이고, **아예 만들지
//   않는 것**이 가장 확실한 준수다(`eval/_tmp.js` 의 `mk()` 는 파일이 꼭 필요할 때만 쓴다).
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
    console.log('\n[ctx_dead_value] 실패 내역');
    for (const f of fails) console.log('  FAIL ' + f.id + ' ' + f.title + '  -> ' + f.detail);
  }
  console.log('[ctx_dead_value] front_root=' + FR);
  console.log('[ctx_dead_value] total=' + total + ' pass=' + pass + ' fail=' + fail);
  process.exit(fail ? 1 : 0);
}

const EXPECTED_TOTAL_MIN = 9;
check('SELF-1', '★_gate_pins.json 자기검사 — 자기 sha256 · 검사 수 하한', () => {
  const p = path.join(__dirname, '_gate_pins.json');
  if (!fs.existsSync(p)) return { ok: false, detail: '★pin 표 부재 — 판정 불가' };
  let pins = null;
  try { pins = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return { ok: false, detail: 'pin 판독 실패' }; }
  const spec = pins && pins.evals && pins.evals['eval_ctx_dead_value.js'];
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
check('SELF-2', '★jsdom 해석 — 「값이 실제로 무엇인가」를 런타임으로 본다 (없으면 판정 불가 = FAIL)', () =>
  ({ ok: !!JSDOM, detail: JSDOM ? '해석 ' + (JSDOM_FROM === 'jsdom' ? 'node_modules' : JSDOM_FROM) : '★jsdom 부재 — 게이트 환경에서 `npm i -D jsdom` 하십시오' }));
if (!JSDOM) done();

const HTML = fs.readFileSync(path.join(FR, 'index.html'), 'utf8');
const CHAT_SRC = fs.readFileSync(path.join(FR, 'js', 'chat.js'), 'utf8');
const FORTUNE_SRC = fs.readFileSync(path.join(FR, 'api', 'fortune.js'), 'utf8');

// ══════════════════════════════════════════════════════════════════════════
// ⑴ 서버 — type 별로 **실제로 읽는** context 키
//    `${c.KEY}` 보간만이 아니라 `if(c.KEY)` 같은 판독도 센다. daily_message 의
//    `lacking` 은 `if(c.lacking) sajuParts.push(…)` 로 들어가므로 보간만 보면 놓친다.
// ══════════════════════════════════════════════════════════════════════════
function serverKeysByType(src) {
  const re = /type\s*===\s*'([a-z0-9_]+)'/g;
  const marks = []; let m;
  while ((m = re.exec(src))) marks.push({ t: m[1], i: m.index });
  marks.push({ t: '__END__', i: src.length });
  const out = {};
  for (let k = 0; k < marks.length - 1; k++) {
    const seg = src.slice(marks[k].i, marks[k + 1].i);
    const s = new Set(); let mm;
    let r = /\bc\.([A-Za-z_$][\w$]*)/g; while ((mm = r.exec(seg))) s.add(mm[1]);
    r = /\bcontext\.([A-Za-z_$][\w$]*)/g; while ((mm = r.exec(seg))) s.add(mm[1]);
    // ★같은 type 분기가 소스에 여러 번 나온다(프롬프트 · maxTokens · 스크럽) — 합집합.
    out[marks[k].t] = new Set([...(out[marks[k].t] || []), ...s]);
  }
  return out;
}
const SK = serverKeysByType(FORTUNE_SRC);

// ══════════════════════════════════════════════════════════════════════════
// ⑵ 클라이언트 — **실제 UI 조작 → 실제 payload** 채집
//    ★사주 결과를 먼저 만든 뒤, 작명 폼의 생년월일은 **비운 채** 작명을 돌린다.
//      그것이 I-70 이 사는 경로(`_collectSajuFromUI` 가 null → `_sajuResultData` 재사용)다.
// ══════════════════════════════════════════════════════════════════════════
const FIX = [
  { bs: '1990-05-15', h: '3',  g: 'male',   bs2: '1988-11-03', ty: '2026' },
  { bs: '1969-08-26', h: '6',  g: 'female', bs2: '2001-02-14', ty: '2027' },
  { bs: '2004-01-09', h: '11', g: 'male',   bs2: '1975-06-30', ty: '2025' },
];
/** 한 상품 = 한 사이트. 이 목록이 D-0 의 분모다. */
const SITE_TYPES = Object.freeze(['saju', 'compat', 'tojeong', 'naming', 'naming_company',
  'naming_product', 'naming_pet', 'naming_nickname', 'daily_message']);

async function capture(html, fixtures) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://chunwoon.test/', pretendToBeVisual: true });
  const w = dom.window;
  let calls = [];
  w.fetch = (u, o) => { calls.push({ u, o }); return new Promise(() => {}); };   // ★응답을 안 준다 = 렌더까지 안 간다
  w.alert = () => {}; w.confirm = () => true; w.scrollTo = () => {};
  if (!w.Element.prototype.scrollIntoView) w.Element.prototype.scrollIntoView = function () {};
  // ★`js/chat.js` 는 **별도 파일**이다. index.html 만 봐서는 daily_message 경로가 안 보인다.
  w.eval(CHAT_SRC);
  await new Promise((r) => setTimeout(r, 200));
  const D = w.document;
  const miss = [];
  const set = (id, v) => { const e = D.getElementById(id); if (e) e.value = v; else miss.push('#' + id); };
  const chip = (kind, k) => {
    const all = [...D.querySelectorAll('[data-kind="' + kind + '"]')];
    all.forEach((x) => x.classList.remove('selected'));
    const t = all.find((x) => x.dataset.k === k);
    if (t) t.classList.add('selected'); else miss.push(kind + ':' + k);
  };
  const drive = async (expr) => {
    calls = [];
    try { w.eval(expr); } catch (e) { return { err: 'THROW:' + ((e && e.message) || e) }; }
    await new Promise((r) => setTimeout(r, 150));
    if (!calls.length) return { err: 'NOCALL' };
    try { return { body: JSON.parse(calls[0].o.body) }; } catch (e) { return { err: 'BADBODY' }; }
  };
  const samples = [], errs = [], srcVals = [];
  for (const f of fixtures) {
    set('sajuBirth', f.bs); set('sajuHour', f.h); set('sajuGender', f.g); set('sajuName', '검사');
    samples.push({ fx: f.bs, want: 'saju', r: await drive('analyzeSaju()') });
    // ★단일 출처 실측 — `window._sajuResultData` 가 무엇을 들고 있는가
    try {
      const s = w._sajuResultData || {};
      srcVals.push({ fx: f.bs, dominant: s.dominant, lacking: s.lacking, keys: Object.keys(s) });
    } catch (e) { srcVals.push({ fx: f.bs, err: String(e && e.message) }); }

    set('cName1', '갑돌'); set('cName2', '을순'); set('cBirth1', f.bs); set('cBirth2', f.bs2);
    set('cHour1', f.h); set('cHour2', '5'); set('cGender1', 'male'); set('cGender2', 'female');
    samples.push({ fx: f.bs, want: 'compat', r: await drive('analyzeCompat()') });

    set('tjName', '검사'); set('tjGender', f.g); set('tjBirth', f.bs); set('tjTargetYear', f.ty);
    samples.push({ fx: f.bs, want: 'tojeong', r: await drive('analyzeTojeong()') });

    // ★작명(사람) — namingBirth 를 **비운다**. I-70 이 사는 경로.
    chip('ntype', 'person'); chip('nstyle', 'traditional'); chip('nlen', '3');
    set('namingBirth', ''); set('namingSurname', '김'); set('namingSurnameHanja', '金');
    set('namingGender', f.g); set('namingPreferred', '宇'); set('namingHangryeolHanja', '俊');
    set('namingHangryeolPos', 'first'); set('namingCalType', 'solar');
    samples.push({ fx: f.bs, want: 'naming', r: await drive('analyzeNaming()') });

    chip('ntype', 'company'); chip('nind', 'tech'); chip('market', 'both');
    set('namingBizModel', 'SaaS 구독'); set('namingBizKeyword', '신뢰');
    set('namingCompanyRegion', '서울특별시'); set('namingCEOName', '김대표');
    set('namingCEOBirth', f.bs2); set('namingCEOHour', '4'); set('namingCEOGender', 'male');
    samples.push({ fx: f.bs, want: 'naming_company', r: await drive('analyzeNaming()') });

    chip('ntype', 'product');
    set('namingProductCat', '텀블러'); set('namingProductDesc', '보온 텀블러');
    set('namingProductTarget', '30대'); set('namingProductValue', '보온력');
    set('namingProductTrademarkScope', 'domestic');
    samples.push({ fx: f.bs, want: 'naming_product', r: await drive('analyzeNaming()') });

    chip('ntype', 'pet'); chip('npet', 'dog');
    set('namingPetTraits', '활발한 갈색 털'); set('namingPetVibe', '귀엽게');
    samples.push({ fx: f.bs, want: 'naming_pet', r: await drive('analyzeNaming()') });

    // ★닉네임 — 여기서도 namingBirth 를 비운다(사주연동 폴백 경로).
    chip('ntype', 'nickname');
    set('namingBirth', ''); set('namingNickPlatform', '인스타');
    set('namingNickVibe', '신비'); set('namingNickLang', '한글');
    samples.push({ fx: f.bs, want: 'naming_nickname', r: await drive('analyzeNaming()') });

    try { w.localStorage.clear(); } catch (e) { /* 일일 한도 초기화 */ }
    samples.push({ fx: f.bs, want: 'daily_message', r: await drive("fetchDailyMessage('general')") });
  }
  const ok = [];
  for (const s of samples) {
    if (s.r.err) { errs.push(s.want + '@' + s.fx + ':' + s.r.err); continue; }
    if (s.r.body.type !== s.want) { errs.push(s.want + '@' + s.fx + ':TYPE=' + s.r.body.type); continue; }
    ok.push({ site: s.r.body.type, fx: s.fx, ctx: s.r.body.context || {} });
  }
  try { w.close(); } catch (e) { /* 정리 실패가 판정을 바꾸지 않는다 */ }
  return { samples: ok, errs, miss: [...new Set(miss)], srcVals };
}

// ══════════════════════════════════════════════════════════════════════════
// ⑶ 판정기 — 「서버가 읽는 키인데 전 표본에서 비어 있다」
// ══════════════════════════════════════════════════════════════════════════
/** 한국어 자리표시자. ★D-1 이 아니라 D-6(래칫) 에서만 쓴다. */
const PLACEHOLDERS = Object.freeze(['없음', '미입력', '미선택', '(미입력)', '(없음)', '자유', '자유롭게']);
function isBlank(v) {
  if (v === null || v === undefined) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'string') return v.trim() === '';
  return false;
}
function isPlaceholder(v) { return typeof v === 'string' && PLACEHOLDERS.indexOf(v.trim()) >= 0; }

/**
 * @returns {{dead:string[], soft:string[], pairs:number, sites:number, examined:Object}}
 *   dead = 전 표본에서 **구조적으로 빈** 키 · soft = 전 표본에서 **자리표시자**인 키
 */
function deadOf(samples) {
  const bySite = {};
  for (const s of samples) (bySite[s.site] = bySite[s.site] || []).push(s.ctx);
  const dead = [], soft = []; let pairs = 0; const examined = {};
  for (const site of Object.keys(bySite).sort()) {
    const arr = bySite[site];
    const sk = SK[site] || new Set();
    const keys = [...new Set(arr.reduce((a, c) => a.concat(Object.keys(c)), []))].sort();
    for (const k of keys) {
      if (!sk.has(k)) continue;          // 서버가 안 읽는 키는 K-2 소관(다른 범주)
      pairs++; (examined[site] = examined[site] || []).push(k);
      if (arr.every((c) => isBlank(c[k]))) dead.push(site + '.' + k);
      else if (arr.every((c) => isBlank(c[k]) || isPlaceholder(c[k]))) soft.push(site + '.' + k);
    }
  }
  return { dead, soft, pairs, sites: Object.keys(bySite).length, examined };
}

// ══════════════════════════════════════════════════════════════════════════
// ⑷ 뮤턴트 — 살아 있는 키 하나를 사본에서 `''` 로 만든다
//    ★대상은 `naming_nickname.nickPlatform`. 지금 실제로 값이 차는 키이고,
//      I-70 수리 대상(`dominant`·`lacking`)과 겹치지 않아 수리 전/후 모두 유효하다.
// ══════════════════════════════════════════════════════════════════════════
const MUT_ANCHOR = 'ctx={nickPlatform,nickVibe,nickLang:';
const MUT_TO     = "ctx={nickPlatform:'',nickVibe,nickLang:";
const MUT_KEY    = 'naming_nickname.nickPlatform';

const EL_NAMES = Object.freeze(['목(木)', '화(火)', '토(土)', '금(金)', '수(水)']);
/** 오행 이름(또는 `·` 로 이은 오행 이름들)인가 — 「실제 값」의 정의 */
function isElementValue(v) {
  if (typeof v !== 'string' || !v.trim()) return false;
  return v.split('·').every((p) => EL_NAMES.indexOf(p.trim()) >= 0);
}

// ── D-6 래칫: 「자리표시자로만 나가는 것이 **정당한**」 알려진 집합 ──────────
//   compat.lacking — 두 사람 16글자 합산이라 0인 오행이 실제로 드물다. 산출은 살아 있다.
//   ★이 목록을 늘리는 것은 「죽은 값을 허용한다」는 뜻이다. 늘리기 전에 수리를 검토하라.
const KNOWN_SOFT = Object.freeze(['compat.lacking']);

(async function main() {
  let MAIN = null, MUT = null, CTL = null, FATAL = null;
  try {
    MAIN = await capture(HTML, FIX);
    if (HTML.split(MUT_ANCHOR).length - 1 === 1) {
      MUT = await capture(HTML.replace(MUT_ANCHOR, MUT_TO), [FIX[0]]);
      CTL = await capture(HTML, [FIX[0]]);
    }
  } catch (e) { FATAL = (e && e.message) || String(e); }

  if (FATAL || !MAIN) {
    check('D-0', '★런타임 채집', () => ({ ok: false, detail: '★판정 불가(통과 아님): ' + FATAL }));
    done();
  }

  const R = deadOf(MAIN.samples);
  const SAMPLES_MIN = SITE_TYPES.length * FIX.length;   // 9 상품 × 3 검체 = 27
  const PAIRS_MIN = 90;                                  // ★v7.78 실측 105. 줄면 「덜 보고 0건」.

  check('D-0', '★커버리지 — 상품 ' + SITE_TYPES.length + '종 × 검체 ' + FIX.length + '종 = payload ' + SAMPLES_MIN + '벌을 **전건** 채집하고 (type,key) ' + PAIRS_MIN + '쌍 이상을 검사한다', () => {
    if (MAIN.errs.length)
      return { ok: false, detail: '★구동 실패 ' + MAIN.errs.length + '건: ' + MAIN.errs.slice(0, 6).join(' / ') + (MAIN.miss.length ? ' · 미해석 UI: ' + MAIN.miss.slice(0, 6).join(',') : '') };
    if (MAIN.samples.length !== SAMPLES_MIN)
      return { ok: false, detail: '★payload ' + MAIN.samples.length + ' != ' + SAMPLES_MIN };
    const gotTypes = [...new Set(MAIN.samples.map((s) => s.site))].sort();
    const missT = SITE_TYPES.filter((t) => gotTypes.indexOf(t) < 0);
    if (missT.length) return { ok: false, detail: '★미채집 상품: ' + missT.join(',') };
    const noSrv = SITE_TYPES.filter((t) => !SK[t] || SK[t].size === 0);
    if (noSrv.length) return { ok: false, detail: '★서버 판독 키 추출 실패: ' + noSrv.join(',') + ' — 「못 뽑아서 0건」을 통과로 접지 않는다' };
    if (R.pairs < PAIRS_MIN) return { ok: false, detail: '★검사 쌍 ' + R.pairs + ' < 하한 ' + PAIRS_MIN };
    return { ok: true, detail: 'payload ' + MAIN.samples.length + '벌 · 상품 ' + gotTypes.length + '종 · (type,key) ' + R.pairs + '쌍' };
  });

  check('D-1', '★★서버가 읽는 키 중 클라가 싣지만 **전 표본에서 빈 값**인 키가 0 이다 (dead value · I-70 유형)', () =>
    ({ ok: R.dead.length === 0,
       detail: R.dead.length ? '★' + R.dead.length + '/' + R.pairs + '건: ' + R.dead.join(' / ')
                             : '0건 (' + R.pairs + '쌍 전수 · payload ' + MAIN.samples.length + '벌)' }));

  check('D-2', '★긍정 대조 — 값이 실제로 차는 키(`saju.dayPillar`)가 「빈 값」으로 오분류되지 않는다', () => {
    const arr = MAIN.samples.filter((s) => s.site === 'saju');
    if (!arr.length) return { ok: false, detail: '★saju payload 미채집 — 판정 불가' };
    if (!(SK.saju && SK.saju.has('dayPillar'))) return { ok: false, detail: '★서버가 saju.dayPillar 를 안 읽는다 — 대조군이 죽었다' };
    const vals = arr.map((s) => s.ctx.dayPillar);
    if (vals.some((v) => isBlank(v))) return { ok: false, detail: '★대조군이 비었다: ' + JSON.stringify(vals) };
    if (R.dead.indexOf('saju.dayPillar') >= 0) return { ok: false, detail: '★대조군이 dead 로 오분류됐다' };
    if (new Set(vals).size < 2) return { ok: false, detail: '★검체가 달라도 값이 같다 — UI 조작이 실제로 안 먹었을 수 있다: ' + JSON.stringify(vals) };
    return { ok: true, detail: '검체 ' + vals.length + '종 전부 실값 · 서로 다름 (' + vals.join(' / ') + ')' };
  });

  check('D-3', '★★자기 뮤턴트 — 클라 소스 **사본**에서 살아 있는 키를 `\'\'` 로 만들면 D-1 이 적발한다', () => {
    if (!MUT) return { ok: false, detail: '★뮤테이션 앵커가 1건이 아니다 — 판정 불가는 통과가 아니다 (앵커: ' + MUT_ANCHOR + ')' };
    if (MUT.errs.length) return { ok: false, detail: '★뮤턴트 구동 실패: ' + MUT.errs.slice(0, 4).join(' / ') };
    const d = deadOf(MUT.samples).dead;
    return { ok: d.indexOf(MUT_KEY) >= 0,
      detail: d.indexOf(MUT_KEY) >= 0 ? MUT_KEY + ' 적발 — D-1 이 실제로 작동한다'
        : '★심은 죽은 값을 못 잡았다 — D-1 의 0건은 아무것도 증명하지 않는다 (적발 목록: ' + d.join(',') + ')' };
  });

  check('D-4', '★긍정 짝 — **무변경** 사본에서는 그 뮤턴트가 안 잡힌다 (D-3 이 항상-적발인 위약 차단)', () => {
    if (!CTL) return { ok: false, detail: '★대조 사본 미구동 — 판정 불가' };
    if (CTL.errs.length) return { ok: false, detail: '★대조 사본 구동 실패: ' + CTL.errs.slice(0, 4).join(' / ') };
    const d = deadOf(CTL.samples).dead;
    return { ok: d.indexOf(MUT_KEY) < 0,
      detail: d.indexOf(MUT_KEY) < 0 ? '무변경본에서 ' + MUT_KEY + ' 미적발 (그 사본의 dead ' + d.length + '건)'
        : '★무변경본에서도 잡힌다 — D-3 은 위약이다' };
  });

  check('D-5', '★★I-70 회귀 못 — `_sajuResultData` 재사용 경로에서 `dominant`·`lacking` 이 **실제 오행값**을 갖는다', () => {
    const NEED = [
      { site: 'naming', keys: ['dominant', 'lacking'] },
      { site: 'naming_nickname', keys: ['lacking'] },
      { site: 'daily_message', keys: ['dominant', 'lacking'] },   // ★js/chat.js 경로
    ];
    const bad = [];
    for (const n of NEED) {
      const arr = MAIN.samples.filter((s) => s.site === n.site);
      if (!arr.length) { bad.push(n.site + ':미채집'); continue; }
      for (const k of n.keys) {
        for (const s of arr) {
          if (!isElementValue(s.ctx[k])) bad.push(n.site + '.' + k + '@' + s.fx + '=' + JSON.stringify(s.ctx[k]));
        }
      }
    }
    // 단일 출처 실측 — window._sajuResultData 자체가 값을 들고 있는가
    const srcBad = MAIN.srcVals.filter((v) => !isElementValue(v.dominant) || !isElementValue(v.lacking));
    if (srcBad.length)
      bad.push('_sajuResultData@' + srcBad.map((v) => v.fx + '{dominant=' + JSON.stringify(v.dominant) + ',lacking=' + JSON.stringify(v.lacking) + '}').join(' '));
    return { ok: bad.length === 0,
      detail: bad.length ? '★' + bad.length + '건: ' + bad.slice(0, 6).join(' / ')
        : '소비자 3경로 × 검체 ' + FIX.length + '종 전부 실값 · 출처 `_sajuResultData` 도 실값 (예: ' +
          MAIN.srcVals[0].dominant + ' / ' + MAIN.srcVals[0].lacking + ')' };
  });

  check('D-6', '★자리표시자 래칫 — 전 표본이 `없음`·`미선택` 류로만 나가는 키가 알려진 ' + KNOWN_SOFT.length + '건을 넘지 않는다', () => {
    const added = R.soft.filter((s) => KNOWN_SOFT.indexOf(s) < 0);
    const gone = KNOWN_SOFT.filter((s) => R.soft.indexOf(s) < 0);
    if (added.length)
      return { ok: false, detail: '★신규 ' + added.length + '건: ' + added.join(' / ') + ' — 값이 실제로 차는지 확인하고, 죽었으면 수리하십시오(늘리는 것은 허용이다)' };
    return { ok: true, detail: R.soft.length + '/' + R.pairs + '건(알려진 집합 이내: ' + KNOWN_SOFT.join(',') + ')' + (gone.length ? ' · 해소됨: ' + gone.join(',') : '') };
  });

  check('D-7', '★`_sajuResultData` 에 키를 늘려도 **saju context payload 는 안 변한다** (`_buildSajuContext` 의 명시 선택)', () => {
    const src = MAIN.srcVals[0] || {};
    const saju = MAIN.samples.find((s) => s.site === 'saju');
    if (!saju) return { ok: false, detail: '★saju payload 미채집 — 판정 불가' };
    const leaked = ['dominant', 'lacking'].filter((k) => Object.prototype.hasOwnProperty.call(saju.ctx, k));
    if (leaked.length)
      return { ok: false, detail: '★saju payload 로 새어나갔다: ' + leaked.join(',') + ' — saju 게이트(프롬프트 표면)가 붉어진다' };
    return { ok: true, detail: '`_sajuResultData` 키 ' + (src.keys ? src.keys.length : '?') + '개 중 saju payload 키 ' +
      Object.keys(saju.ctx).length + '개 — dominant·lacking 은 실리지 않는다' };
  });

  done();
})().catch((e) => {
  check('D-FATAL', '★게이트 자체가 죽었다 (판정 불가 ≠ 통과)', () => ({ ok: false, detail: (e && e.stack) ? String(e.stack).slice(0, 400) : String(e) }));
  done();
});
