// 천운 — **폐기 표면(discard surface)** 게이트 · v7.80 신설 (계약 v7.80 §3 파 A)
// ═══════════════════════════════════════════════════════════════════════════
// 【무엇을 못박는가 — 한 문장】
//   「**가드가 걸린 type 전건에서, 재유도 실패(폐기) 시 프롬프트에 빈 슬롯이 남지 않는다.**」
//
// 【왜 신설인가 — 계약 §0 의 재측정】
//   인수인계 §8-1 은 「`CW_COMPAT_STRICT` 를 켜면 빈 슬롯이 생긴다」고 적었다.
//   ★그 서술은 **조건이 좁았다**. `_v780_work/probe/probe_discard_surface.js` 실측:
//     가드 type 전건 20 · ★빈 슬롯이 생기는 type 12 · ★빈 슬롯 줄 30 (그중 ★★혼합 2).
//   ⟹ 빈 슬롯은 strict 전환의 부작용이 아니라 **현행 프로덕션에서 이미 도달 가능한
//     결함**이다. `mode:'discarded'` 는 스위치와 무관하다 — 「6키를 **주장**했는데
//     재유도가 실패」하면 지금도 탄다.
//
// 【★★가장 나쁜 것 — `mixed`(거짓 단언)】
//     naming           ③폐기 : "부족한 오행: 없음 / 강한 오행: "
//     naming_premium_1 ③폐기 : "일간: () / 강함:  / 부족: 없음"
//   폐기해 놓고 「없음」이라고 **단언**한다.
//   ★**빈 칸은 LLM 이 「모른다」로 읽지만 「없음」은 틀린 사실로 읽는다.**
//   그래서 `mixed` 는 `empty` 보다 나쁘다 — 둘 다 E-1 이 잡되 분류를 나눠 남긴다.
//
// 【판정 주체 — 결정 84】
//   ★소스 문자열이 아니라 **handler 실구동의 프롬프트 바이트**로 판정한다.
//     상류 `fetch` 를 스텁으로 갈아끼워 `messages[0].content` 를 직접 본다.
//     「로그에 폐기했다고 찍혔다」가 아니라 **「프롬프트에 빈 슬롯이 없다」**가 근거다.
//     로그(`[cw:ctxguard]`)는 **검체가 실제로 폐기 경로를 탔는지**를 확인하는
//     보조 축으로만 쓴다 — 판정의 근거가 아니다.
//
// 【빈 슬롯의 정의 — ★형태 열거 금지, 관계로 (결정 106)】
//   초판 프로브는 「콜론 뒤가 비었는가」를 정규식으로 적었다가
//   `상괘(태세괘):  (태세수 )` 를 **놓쳤다**. 구두점 형태를 사람이 열거하면
//   **그 열거가 곧 미검증 주장**이 된다. ⟹ 형태가 아니라 **① 과 ③ 의 관계**로 본다:
//
//     같은 요청을 ① 재유도 성공 · ③ 재유도 실패(폐기) 두 번 돌려 **달라진 줄**을
//     절 단위(`/` `,`)로 쪼개고 —
//       `empty`    ③ 절이 ① 절의 **부분수열** (값만 빠지고 아무 말도 덧붙지 않음) → ★FAIL
//       `mixed`    한 줄 안에서 절마다 갈린다                                     → ★★FAIL
//       `explicit` ③ 에 ① 에 없던 글자가 들어왔다 (`미입력`)                      → PASS
//       `dropped`  절이(줄이) 통째로 빠졌다                                       → PASS
//
//   ★프로브의 `isSubsequence`·`classify` 를 **복사해 온 것이 아니라** 이 게이트 안에
//     **한 벌만** 둔다. 프로브는 작업 자산이고 **게이트가 정본**이다(계약 §3).
//
// 【★줄 짝짓기 — 프로브보다 한 겹 더 (게이트가 정본이므로)】
//   프로브는 ①③ 을 **줄 번호로** 짝지었다. `daily_message` 처럼 폐기가 **줄을 통째로
//   지우는** 상품에서는 그 뒤 줄이 전부 한 칸씩 밀려 **엉뚱한 짝**이 만들어진다.
//   지금은 우연히 `explicit` 으로 떨어졌지만, 밀린 짝이 우연히 부분수열이면
//   **없는 빈 슬롯을 만들어 낸다**(위약의 반대 방향 — 오탐).
//   ⟹ 게이트는 **LCS 정렬**로 짝짓는다. 같은 줄은 같은 줄끼리 붙고, 남은 것끼리만
//     순서대로 짝짓는다. 짝이 없는 ① 줄은 `dropped`(PASS), 짝이 없는 ③ 줄은
//     `explicit`(PASS) 이다. ★SELF-3 이 정렬기·분류기를 **단위 검사**한다.
//
// 【위약 방지 — 결정 103·105·107】
//   · `E-0` **커버리지 = 분모**. `CW_*_TYPES` 상수를 fortune.js 소스에서 **기계 추출**해
//     집합 일치를 본다. 손으로 적은 목록은 그 목록 자체가 미검증 주장이다(결정 99).
//     「0건 중 0건 통과」를 원천 차단한다.
//   · `E-5` 자기 뮤턴트 / `E-6` 긍정 짝. ★이 짝이 없으면 「본체가 아무것도 안 잡는데
//     녹색」이 가능하다.
//   · `E-2` 긍정 대조 — ① 이 **서버 재유도값**으로 만들어졌음을 **클라값 무영향**으로
//     증명한다(클라 원국을 위조해도 프롬프트가 **바이트 동일**).
//   · `E-3` 음성 대조 — legacy 는 **클라값이 그대로** 남는다(빈 슬롯이 아니다).
//   · `E-4` ★역방향 대조 — `saju` 3종은 **400 `CONTEXT_UNVERIFIABLE`**. 이미 옳은 것이
//     옳다고 나오는가. ★여기가 붉으면 **게이트가 틀린 것**이다.
//   · handler 미적재 · 프롬프트 미포착 · 추출기 사망은 전부 **판정 불가 = FAIL**.
//
// 【환경】
//   · `CHUNWOON_FRONT_ROOT` 미지정이면 `SELF-0` FAIL.
//   · `process.env.ANTHROPIC_API_KEY` 스텁 필수 — 없으면 handler 가 500 을 낸다.
//   · 유료 type 은 `CW_PREMIUM_HMAC_SECRET` 를 게이트 비밀로 갈아끼우고 토큰을 발급한다.
//     ★**픽스처 결제 키를 발급마다 다르게** 한다 — 같으면 v7.67 RL L1(결제 1건당 40회)이
//       **429** 를 내서 판정을 RL 로 오염시킨다(★7).
//   · ★`_tmp.js`(`CWTMP.mk`)만 쓴다(I-62). 사본을 만드는 **유일한 이유는 ESM 적재**다
//     (결정 109) — 리포에 `type:module` 이 없어 `api/fortune.js` 를 그대로 import 할 수 없고,
//     뮤턴트/무변경 짝은 서로 다른 모듈 인스턴스여야 한다.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const CWTMP = require('./_tmp.js');   // ★I-62 — 임시 사본 자동 정리
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
function record(id, title, ok, detail) {
  total++;
  if (ok) { pass++; console.log('PASS ' + id + '  ' + title + (detail ? '   — ' + detail : '')); }
  else { fails.push({ id, title, detail }); console.log('FAIL ' + id + '  ' + title + (detail ? '   — ' + detail : '')); }
}
function check(id, title, fn) {
  let ok = false, detail = '';
  try { const r = fn(); if (r && typeof r === 'object') { ok = !!r.ok; detail = r.detail || ''; } else ok = !!r; }
  catch (e) { ok = false; detail = '예외: ' + ((e && e.message) || String(e)); }
  record(id, title, ok, detail);
}
async function checkA(id, title, fn) {
  let ok = false, detail = '';
  try { const r = await fn(); if (r && typeof r === 'object') { ok = !!r.ok; detail = r.detail || ''; } else ok = !!r; }
  catch (e) { ok = false; detail = '예외: ' + ((e && e.message) || String(e)); }
  record(id, title, ok, detail);
}
function done() {
  const fail = fails.length;
  if (fail) {
    console.log('\n[ctx_discard_surface] 실패 내역');
    for (const f of fails) console.log('  FAIL ' + f.id + ' ' + f.title + '  -> ' + f.detail);
  }
  console.log('[ctx_discard_surface] front_root=' + FR);
  console.log('[ctx_discard_surface] total=' + total + ' pass=' + pass + ' fail=' + fail);
  process.exit(fail ? 1 : 0);
}

// ── SELF-1 : 외부 pin 자기검사 ──────────────────────────────────────────────
//   ★`tools/regen_gate_pins.js --expand` 전에는 **정상 FAIL** 이다(계약 §1-6 · ★5).
//     사문화로 오해하지 말 것 — 미등재 게이트는 침식이 안 잡힌다.
const EXPECTED_TOTAL_MIN = 33;
check('SELF-1', '★_gate_pins.json 자기검사 — 자기 sha256 · 검사 수 하한', () => {
  const pinPath = path.join(__dirname, '_gate_pins.json');
  if (!fs.existsSync(pinPath)) return { ok: false, detail: '★pin 표 부재 — 판정 불가' };
  let pins = null;
  try { pins = JSON.parse(fs.readFileSync(pinPath, 'utf8')); } catch (e) { return { ok: false, detail: 'pin 판독 실패' }; }
  const spec = pins && pins.evals && pins.evals['eval_ctx_discard_surface.js'];
  if (!spec || !spec.sha256) return { ok: false, detail: '★pin 표에 자기 항목이 없다 — 미등재 게이트는 침식이 안 잡힌다 (regen 전에는 정상 FAIL)' };
  const self = crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex');
  if (self !== spec.sha256)
    return { ok: false, detail: '★자기 sha256 불일치 (실측 ' + self.slice(0, 16) + ' != pin ' + String(spec.sha256).slice(0, 16) + ') — 정당한 강화라면 node tools/regen_gate_pins.js' };
  if (typeof spec.checks_min === 'number' && spec.checks_min < EXPECTED_TOTAL_MIN)
    return { ok: false, detail: '★checks_min ' + spec.checks_min + ' < ' + EXPECTED_TOTAL_MIN };
  return { ok: true, detail: 'sha256 일치 · checks_min=' + spec.checks_min };
});

if (!FR) { record('SELF-0', 'front_root 해석', false, '★CHUNWOON_FRONT_ROOT 미지정 — 판정 불가'); done(); }

const FORTUNE_SRC = fs.readFileSync(path.join(FR, 'api', 'fortune.js'), 'utf8');
let CG = null, RC = null, ENGINE_ERR = null;
try {
  CG = require(path.join(FR, 'api', '_engine', 'ctxguard.js'));
  RC = require(path.join(FR, 'api', '_engine', 'recompute.js'));
} catch (e) { ENGINE_ERR = (e && e.message) || String(e); }

// ══════════════════════════════════════════════════════════════════════════
// ⑴ 빈 슬롯 판정기 — ★형태가 아니라 **관계**로 (결정 106) · 이 게이트가 정본이다
// ══════════════════════════════════════════════════════════════════════════
/** `a` 가 `b` 의 부분수열인가 (값만 빠지고 아무 글자도 덧붙지 않았다). */
function isSubsequence(a, b) {
  let i = 0;
  for (let j = 0; j < b.length && i < a.length; j++) if (a[i] === b[j]) i++;
  return i === a.length;
}

/**
 * 한 짝(① 정상 줄, ③ 폐기 줄)의 분류.
 * ★줄 단위 판정만으로는 「값이 빠졌다」와 「거짓을 말했다」를 구별하지 못한다.
 *   실측: `부족한 오행: 없음 / 강한 오행: ` — 앞 절은 폐기해 놓고 「없음」이라 **단언**하고
 *   뒤 절은 빈 슬롯이다. 줄 전체로 보면 「새 글자가 들어왔으니 명시」로 **오분류**된다.
 *   ⟹ `/` `,` 로 절을 쪼개 각각 판정하고, 섞이면 `mixed` 로 분류한다(★★더 나쁘다).
 * @returns {'empty'|'mixed'|'explicit'|'dropped'}
 */
function classifyPair(okLine, badLine) {
  if (badLine === null || badLine === undefined) return 'dropped';    // ③ 에서 줄이 사라졌다
  if (okLine === null || okLine === undefined) return 'explicit';     // ③ 에만 있는 줄 = 새 글자
  if (badLine.trim() === '') return 'dropped';                        // 줄이 통째로 비었다
  const split = (s) => s.split(/\s*[\/,]\s*/).filter((x) => x !== '');
  const bs = split(badLine), os = split(okLine);
  if (bs.length !== os.length) return isSubsequence(badLine, okLine) ? 'empty' : 'explicit';
  let emptyN = 0, addN = 0;
  for (let i = 0; i < bs.length; i++) (isSubsequence(bs[i], os[i]) ? emptyN++ : addN++);
  if (addN === 0) return 'empty';
  if (emptyN === 0) return 'explicit';
  return 'mixed';
}

/**
 * ★줄 짝짓기 — LCS 정렬. 줄 번호로 짝지으면 「줄이 통째로 지워지는」 상품에서
 *   그 뒤 줄이 전부 밀려 **엉뚱한 짝**이 생긴다(오탐의 원천).
 * @returns {Array<{ok:(string|null), bad:(string|null)}>} 달라진 짝만
 */
function alignChanged(okLines, badLines) {
  const n = okLines.length, m = badLines.length;
  const dp = [];
  for (let i = 0; i <= n; i++) dp.push(new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = (okLines[i] === badLines[j]) ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (okLines[i] === badLines[j]) { ops.push({ t: 'eq' }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ t: 'del', a: okLines[i] }); i++; }
    else { ops.push({ t: 'ins', b: badLines[j] }); j++; }
  }
  while (i < n) ops.push({ t: 'del', a: okLines[i++] });
  while (j < m) ops.push({ t: 'ins', b: badLines[j++] });
  // 연속한 비-eq 구간(hunk) 안에서 남은 것끼리 순서대로 짝짓는다.
  const out = [];
  let k = 0;
  while (k < ops.length) {
    if (ops[k].t === 'eq') { k++; continue; }
    const dels = [], inss = [];
    while (k < ops.length && ops[k].t !== 'eq') {
      if (ops[k].t === 'del') dels.push(ops[k].a); else inss.push(ops[k].b);
      k++;
    }
    const w = Math.max(dels.length, inss.length);
    for (let q = 0; q < w; q++) out.push({ ok: q < dels.length ? dels[q] : null, bad: q < inss.length ? inss[q] : null });
  }
  return out;
}

/** ① 정상 프롬프트와 ③ 폐기 프롬프트의 차이를 분류한다. */
function diffPrompts(okPrompt, badPrompt) {
  const pairs = alignChanged(okPrompt.split('\n'), badPrompt.split('\n'));
  const changed = pairs.map((p) => ({ ok: p.ok, bad: p.bad, cls: classifyPair(p.ok, p.bad) }));
  return { changed, bad: changed.filter((c) => c.cls === 'empty' || c.cls === 'mixed') };
}

check('SELF-3', '★판정기 자기검사 — 부분수열·절 분류·LCS 정렬이 살아 있다 (분류기가 죽으면 「0건 통과」다)', () => {
  const bad = [];
  const eq = (got, want, what) => { if (got !== want) bad.push(what + ': ' + got + ' (기대 ' + want + ')'); };
  // ★초판 정규식이 놓친 형태 — 「콜론 뒤」가 아니라 괄호 안이 빈다.
  eq(classifyPair('상괘(태세괘): 태(兌)☱ (태세수 10)', '상괘(태세괘):  (태세수 )'), 'empty', '괄호 안 빈 슬롯');
  eq(classifyPair('A님(남성): 기유 임신 계유 무오 / 일간 癸(음수(水))', 'A님(남성):  / 일간 '), 'empty', '절 전부 빔');
  eq(classifyPair('음력 생년월일: 1969년 7월 14일', '음력 생년월일: 년 월 일'), 'empty', '숫자만 빠짐');
  eq(classifyPair('부족한 오행: 목(木) / 강한 오행: 금(金)', '부족한 오행: 없음 / 강한 오행: '), 'mixed', '★★혼합(거짓 단언)');
  eq(classifyPair('일간: 癸(수(水)) / 강함: 금(金) / 부족: 목(木)', '일간: () / 강함:  / 부족: 없음'), 'mixed', '★★혼합 3절');
  eq(classifyPair('사주 일간: 癸(수(水)) / 강한 오행: 금(金)', '사주: 미입력'), 'explicit', '명시');
  eq(classifyPair('사장 사주: 기유 임신 계유 무오 / 일간 癸', ''), 'dropped', '절 삭제');
  eq(classifyPair('사장 사주: 기유 임신 계유 무오 / 일간 癸', null), 'dropped', '줄 소멸');
  eq(classifyPair(null, '오늘 날짜: 2026. 8. 10.'), 'explicit', '줄 추가');
  if (!isSubsequence('사장 사주: ', '사장 사주: 기유 임신 계유 무오')) bad.push('isSubsequence 참 케이스 실패');
  if (isSubsequence('사장 사주: 미입력', '사장 사주: 기유 임신 계유 무오')) bad.push('isSubsequence 거짓 케이스 실패');
  // ★LCS 정렬 — 줄이 지워져도 남은 줄이 밀리지 않는다(줄 번호 짝짓기의 오탐 차단).
  const al = alignChanged(['머리', '사주: 기유 임신', '꼬리1', '꼬리2'], ['머리', '꼬리1', '꼬리2']);
  if (al.length !== 1 || al[0].ok !== '사주: 기유 임신' || al[0].bad !== null) bad.push('LCS 정렬: 삭제 1줄을 못 짚었다 (' + JSON.stringify(al) + ')');
  const al2 = alignChanged(['머리', '사주: 기유 임신', '꼬리'], ['머리', '사주: ', '꼬리']);
  if (al2.length !== 1 || al2[0].bad !== '사주: ') bad.push('LCS 정렬: 치환 1줄 짝짓기 실패 (' + JSON.stringify(al2) + ')');
  return { ok: bad.length === 0, detail: bad.length ? '★' + bad.join(' / ') : '11개 성질 케이스 + LCS 정렬 2건 전부 기대대로' };
});

// ══════════════════════════════════════════════════════════════════════════
// ⑵ 검체 — 가드가 걸린 type 전건. ★분모는 E-0 이 소스에서 기계 추출해 대조한다.
// ══════════════════════════════════════════════════════════════════════════
const OK   = { cal: 'solar', y: 1969, m: 8,  d: 26, h: 6, leap: false };   // ① 재유도 성공
const OK2  = { cal: 'solar', y: 1990, m: 5,  d: 15, h: 5, leap: false };   // ①' 다른 생년월일
const BAD  = { cal: 'solar', y: 1899, m: 8,  d: 26, h: 6, leap: false };   // ③ 6키를 **주장**했으되 규격 밖 ⟹ 폐기

/** ★클라가 **주장**하는 원국. 서버 재유도값과 반드시 달라야 한다(안 그러면 E-2 가 자명 통과). */
function chartOf(b) {
  const got = CG.compatPersonInput(b, '');
  if (!got || !got.input) throw new Error('★compatPersonInput 실패 — 검체 구성 불가');
  const r = RC.recompute(got.input);
  if (!r || !r.ok) throw new Error('★recompute 실패 — 검체 구성 불가');
  return { pillar: RC.compatPillarLine(r), ilgan: RC.compatIlganLabel(r) };
}
let CLIENT = null, FIXERR = null;
try { CLIENT = ENGINE_ERR ? null : chartOf({ cal: 'solar', y: 1985, m: 3, d: 3, h: 2, leap: false }); }
catch (e) { FIXERR = (e && e.message) || String(e); }

const P1 = (b) => ({ cal1: b.cal, y1: b.y, m1: b.m, d1: b.d, h1: b.h, leap1: b.leap });
const P2 = (b) => ({ cal2: b.cal, y2: b.y, m2: b.m, d2: b.d, h2: b.h, leap2: b.leap });
const P0 = (b) => ({ cal: b.cal, y: b.y, m: b.m, d: b.d, h: b.h, leap: b.leap });
const PC = (b) => ({ ceoCal: b.cal, ceoY: b.y, ceoM: b.m, ceoD: b.d, ceoH: b.h, ceoLeap: b.leap });
const PT = (b) => ({ cal: b.cal, y: b.y, m: b.m, d: b.d, leap: b.leap });   // tojeong 은 5키

/** ★E-8 자유 입력 마커 — 서버 정답에도 위조 마커에도 나타나지 않는 문자열. */
const FREE_MARK = 'ZZQ자유780';
const FORGE_MARK = 'ZZQ위조780';
const F = (s) => s + ' ' + FREE_MARK;
/** 자유 서술로 취급하는 키 — 폐기는 이 키들을 **한 바이트도** 건드리면 안 된다. */
const FREE_KEYS = Object.freeze(['story', 'question', 'preferred', 'category', 'keyword',
  'region', 'industry', 'emotion', 'time', 'categories', 'nickVibe', 'nickPlatform', 'nickLang']);

const CARDS = [{ n: '바보', pos: '정방향' }, { n: '마법사', pos: '정방향' }, { n: '여사제', pos: '역방향' }];

const FAM = {
  compat: {
    types: ['compat', 'compat_premium_1', 'compat_premium_2'],
    birth: (b) => Object.assign(P1(b), P2(b)),
    base: () => ({ name1: 'A', gender1: '남성', pillar1: CLIENT.pillar, ilgan1: CLIENT.ilgan,
      name2: 'B', gender2: '여성', pillar2: CLIENT.pillar, ilgan2: CLIENT.ilgan,
      relType: '연인', relTypeKey: 'love' }),
  },
  tojeong: {
    types: ['tojeong', 'tojeong_premium_1', 'tojeong_premium_2'],
    birth: PT,
    base: () => ({ name: '홍길동', gender: 'male', targetYear: 2026,
      lunarYear: 1969, lunarMonth: 7, lunarDay: 14, zodiac: '닭띠(酉)', ganjiYear: '기유년',
      upperGua: '건(乾)☰', taeseNum: 8, middleGua: '태(兌)☱', wolNum: 7,
      lowerGua: '상(上)', ilNum: 14, guaCombination: '건(乾)☰ · 태(兌)☱ · 상(上)' }),
  },
  naming: {
    types: ['naming', 'naming_premium_1', 'naming_premium_2', 'naming_nickname'],
    birth: P0,
    base: () => ({ surname: '김', surnameHanja: '金', gender: 'male', style: '전통', length: '3자',
      preferred: F('宇'), keyword: F('하늘'), hangryeolHanja: '', hangryeolPos: 'none',
      nickPlatform: F('인스타'), nickVibe: F('신비'), nickLang: F('한글'),
      pillar: CLIENT.pillar, ilgan: CLIENT.ilgan, ilganElement: '금(金)',
      dominant: '금(金)', lacking: '목(木)' }),
  },
  tarot: {
    types: ['tarot', 'tarot_premium_1', 'tarot_premium_2'],
    birth: P0,
    base: () => ({ question: F('올해 이직해도 될까요'), spread: '3카드', category: F('love'), cards: CARDS,
      pillar: CLIENT.pillar, ilgan: CLIENT.ilgan, ilganElement: '금(金)',
      dominant: '금(金)', lacking: '목(木)' }),
  },
  dream: {
    types: ['dream', 'dream_premium_1', 'dream_premium_2'],
    birth: P0,
    base: () => ({ time: F('새벽'), categories: F('🐯동물'), emotion: F('두려움'), story: F('자유입력 줄거리'),
      sajuLinked: true,
      ilgan: CLIENT.ilgan, ilganElement: '금(金)', dayPillar: '신축', dominantElement: '금(金)',
      weakElement: '목(木)', lacking: '목(木)', birth: '1969년 8월 26일',
      hourBranch: '묘시 (05:00~06:59)' }),
  },
  daily: {
    types: ['daily_message'],
    birth: P0,
    base: () => ({ gender: 'male', personaName: '선녀', personaTone: '따뜻하고 친근한 운세 해설자',
      category: F('오늘의 한마디'), tarotSummary: '', faceSummary: '',
      ilgan: CLIENT.ilgan, ilganElement: '금(金)', dayPillar: '신축', dominantElement: '금(金)',
      weakElement: '목(木)', lacking: '목(木)', birth: '1969년 8월 26일',
      hourBranch: '묘시 (05:00~06:59)' }),
  },
  company: {
    types: ['naming_company', 'naming_company_premium_1', 'naming_company_premium_2'],
    birth: PC,
    base: () => ({ industry: F('IT'), keyword: F('하늘'), region: F('서울'), ceoName: '김대표',
      ceoPillar: CLIENT.pillar, ceoIlgan: CLIENT.ilgan, ceoIlganElement: '금(金)', ceoLacking: '목(木)' }),
  },
};
/** ★이 게이트가 도는 type 전건. E-0 이 fortune.js 의 `CW_*_TYPES` 와 **집합 일치**를 본다. */
const GATE_TYPES = Object.keys(FAM).reduce((a, k) => a.concat(FAM[k].types), []);
const FAM_OF = (() => { const o = {}; for (const k of Object.keys(FAM)) for (const t of FAM[k].types) o[t] = FAM[k]; return o; })();

// ★`saju` 3종은 **이 축의 대상이 아니다.** v7.72 관통 #2 수리로 「감시 키가 왔는데 재유도
//   불가」면 400 CONTEXT_UNVERIFIABLE 로 **차단**한다 — 폐기(빈 슬롯)가 아니라 fail-closed 다.
//   프롬프트 자체가 만들어지지 않으므로 빈 슬롯이 원리적으로 없다. E-4 가 그 성질을 본다.
const SAJU_TYPES = ['saju', 'saju_premium_1', 'saju_premium_2'];
const SAJU_CTX = () => ({ name: '홍길동', gender: 'male',
  yearPillar: '기유', monthPillar: '임신', dayPillar: '계유', hourPillar: '무오',
  ilgan: '癸', ilganElement: '수(水)', hourLabel: '묘시' });

/**
 * ★상품별 **서버가 교체하는 키** — 전부 `ctxguard.js` 의 **공개 표**에서 가져온다.
 *   손으로 적지 않는다(결정 99). 이 표가 E-2/E-3 의 「위조 대상」 정의다.
 */
const GUARDED = (function () {
  if (!CG) return {};
  const o = Object.assign({}, CG.NAMING_CTX_KEYS, CG.TAROT_CTX_KEYS,
    CG.DREAM_CTX_KEYS, CG.DAILY_CTX_KEYS, CG.COMPANY_CTX_KEYS);
  for (const t of FAM.compat.types) o[t] = CG.COMPAT_REPLACE_KEYS;
  for (const t of FAM.tojeong.types) o[t] = CG.TOJEONG_REPLACE_KEYS;
  return o;
})();

/** 클라가 주장하는 원국을 **전부 위조**한다. 서버가 지배하면 프롬프트가 바이트 동일하다. */
function forgeCtx(type, ctx) {
  const out = Object.assign({}, ctx);
  for (const k of (GUARDED[type] || [])) {
    const v = out[k];
    if (typeof v === 'number') out[k] = 987654;
    else if (typeof v === 'boolean') out[k] = !v;
    else out[k] = FORGE_MARK + '-' + k;
  }
  return out;
}

// ══════════════════════════════════════════════════════════════════════════
// ⑶ handler 실구동 — 상류 fetch 스텁으로 **프롬프트 바이트**를 직접 본다 (결정 84)
// ══════════════════════════════════════════════════════════════════════════
function mkRes() {
  const r = { statusCode: 200, headers: {}, body: null };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (o) => { r.body = o; return r; };
  r.end = (o) => { if (o !== undefined) r.body = o; return r; };
  return r;
}
const b64u = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const EVAL_SECRET = 'cw_gate_secret_discard_surface_v780';
let mintSeq = 0;
// ★`pay`(결제 키)를 **발급마다 다르게** 만든다 — v7.67 RL L1 의 버킷 키가 `pay|pk` 이고
//   결제 1건당 창당 40회다. 한 결제 키를 계속 쓰면 검사가 늘어난 순간 **429** 가 나서
//   판정이 RL 로 오염된다(★7). RL 은 이 게이트의 축이 아니다 — 완화가 아니라 **격리**다.
const mintToken = (pk, amt) => {
  const now = Date.now();
  const p = b64u(JSON.stringify({ v: 1, pk, ord: 'cw_' + pk + '_gate780', pay: 'tviva_gate780_' + pk + '_' + (++mintSeq),
    amt, iat: now, exp: now + 30 * 24 * 3600 * 1000, src: 'confirm' }));
  return 'cwp1.' + p + '.' + b64u(crypto.createHmac('sha256', EVAL_SECRET).update(p).digest());
};
/** ★상품 정가는 fortune.js 소스에서 **기계 추출**한다(손으로 적으면 값이 갈린다). */
const PRICE = (function () {
  const m = FORTUNE_SRC.match(/const CW_PRODUCT_PRICE\s*=\s*(\{[\s\S]*?\})\s*;/);
  if (!m) return null;
  try { return new Function('return ' + m[1] + ';')(); } catch (e) { return null; }
})();
/** 유료 type → 상품 키. ★조립이 아니라 접미 제거 — `naming_company_premium_1` → `naming_company`. */
const productKeyOf = (t) => {
  const pk = t.replace(/_premium_[12]$/, '');
  return (pk !== t && PRICE && PRICE[pk] !== undefined) ? pk : null;
};

async function runOn(handler, type, ctx) {
  const logs = [], sent = [];
  const origFetch = globalThis.fetch, origLog = console.log;
  globalThis.fetch = async (_u, init) => {
    try { sent.push(JSON.parse(String(init && init.body))); } catch (e) { sent.push(null); }
    return { ok: true, status: 200,
      json: async () => ({ content: [{ type: 'text', text: '{}' }], stop_reason: 'end_turn' }) };
  };
  console.log = function (...a) {
    try { if (String(a[0]) === '[cw:ctxguard]') logs.push(JSON.parse(String(a[1]))); } catch (e) { /* 판독 실패 무시 */ }
  };
  const pk = productKeyOf(type);
  const token = pk ? mintToken(pk, PRICE[pk]) : null;
  const prevSecret = process.env.CW_PREMIUM_HMAC_SECRET;
  if (token) process.env.CW_PREMIUM_HMAC_SECRET = EVAL_SECRET;
  const res = mkRes();
  try {
    await handler({ method: 'POST', headers: token ? { 'x-cw-premium-token': token } : {},
      body: { type, context: ctx } }, res);
  } catch (e) { /* 상류 예외는 아래 프롬프트 미포착으로 드러난다 */ }
  finally {
    globalThis.fetch = origFetch; console.log = origLog;
    if (token) { if (prevSecret === undefined) delete process.env.CW_PREMIUM_HMAC_SECRET; else process.env.CW_PREMIUM_HMAC_SECRET = prevSecret; }
  }
  const body = sent[0] || null;
  return { res, logs, ctx,
    status: res.statusCode,
    error: (res.body && res.body.error) || null,
    prompt: body && body.messages && body.messages[0] ? String(body.messages[0].content) : null };
}

/** 한 type 의 6벌 실구동. ① 정상 · ①' 다른 생년 · ①F 위조 · ③ 폐기 · ② legacy · ②F legacy 위조 */
async function runType(handler, type) {
  const Fm = FAM_OF[type];
  const mk = (patch) => Object.assign({}, Fm.base(), patch || {});
  const ok   = await runOn(handler, type, mk(Fm.birth(OK)));
  const ok2  = await runOn(handler, type, mk(Fm.birth(OK2)));
  const okF  = await runOn(handler, type, Object.assign(forgeCtx(type, Fm.base()), Fm.birth(OK)));
  const bad  = await runOn(handler, type, mk(Fm.birth(BAD)));
  const leg  = await runOn(handler, type, mk(null));
  const legF = await runOn(handler, type, forgeCtx(type, Fm.base()));
  return { type, ok, ok2, okF, bad, leg, legF };
}
const modeOf = (r) => (r.logs.length ? (r.logs[r.logs.length - 1].mode || null) : null);

// ══════════════════════════════════════════════════════════════════════════
(async function main() {
  if (ENGINE_ERR || FIXERR || !CLIENT) {
    record('SELF-2', '★엔진 적재 · 검체 구성', false, '★판정 불가(통과 아님): ' + (ENGINE_ERR || FIXERR || 'CLIENT 원국 미구성'));
    done();
  }
  if (!PRICE) { record('SELF-2', '★`CW_PRODUCT_PRICE` 기계 추출', false, '★fortune.js 에서 정가 표를 못 뽑았다 — 유료 토큰 발급 불가(판정 불가)'); done(); }

  // ── 사본 3벌 — 원본 / 뮤턴트(명시 문구 되돌림) / 무변경(긍정 짝) ────────────
  //   ★사본을 만드는 유일한 이유는 **ESM 적재**다(결정 109). 리포에 `type:module` 이
  //     없어 `api/fortune.js` 를 그대로 import 할 수 없고, 뮤턴트/무변경은 서로 다른
  //     모듈 인스턴스여야 한다.
  //   ★뮤턴트 = 이미 **옳은** 명시 문구 `'사장 사주: 미입력'` 의 값을 `''` 로 되돌린다.
  //     라벨은 남기고 값만 지운다 = 정확히 「빈 슬롯」의 형태다. (문구 전체를 지우면
  //     줄이 통째로 사라져 `dropped`(PASS) 가 되므로 **죽은 뮤턴트**가 된다.)
  const MUT_RX = /:'사장 사주: 미입력'\}/g;
  const MUT_TO = ":'사장 사주: '}";
  const MUT_TYPE = 'naming_company';
  let H = { orig: null, mut: null, ctl: null }, loadErr = null, mutApplied = 0;
  try {
    const base = CWTMP.mk('cw_ds780_');
    const copyTree = (s, d) => {
      fs.mkdirSync(d, { recursive: true });
      for (const nm of fs.readdirSync(s)) {
        const sp = path.join(s, nm); let st = null;
        try { st = fs.statSync(sp); } catch (e) { continue; }
        if (st.isDirectory()) { copyTree(sp, path.join(d, nm)); continue; }
        if (st.isFile()) fs.copyFileSync(sp, path.join(d, nm));
      }
    };
    // ★없으면 handler 가 500 을 낸다 — 프롬프트가 안 만들어지면 이 게이트는 판정 불가다.
    process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'sk-ant-gate-stub';
    for (const variant of ['orig', 'mut', 'ctl']) {
      const dir = path.join(base, variant);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ type: 'module' }) + '\n');
      copyTree(path.join(FR, 'api'), path.join(dir, 'api'));
      if (variant === 'mut') {
        const p = path.join(dir, 'api', 'fortune.js');
        const src = fs.readFileSync(p, 'utf8');
        fs.writeFileSync(p, src.replace(MUT_RX, () => { mutApplied++; return MUT_TO; }));
      }
      const mod = await import('file://' + path.join(dir, 'api', 'fortune.js').split(path.sep).join('/'));
      H[variant] = mod && (mod.default || mod.handler);
    }
  } catch (e) { loadErr = (e && e.stack ? String(e.stack).slice(0, 300) : String(e)); }

  // ── 본체 실구동 (원본) ──────────────────────────────────────────────────────
  const R = {};
  let runErr = null;
  if (typeof H.orig === 'function') {
    try { for (const t of GATE_TYPES) R[t] = await runType(H.orig, t); }
    catch (e) { runErr = (e && e.message) || String(e); }
  }
  const promptless = GATE_TYPES.filter((t) => !R[t] || !R[t].ok.prompt || !R[t].bad.prompt || !R[t].leg.prompt);

  await checkA('SELF-2', '★handler 3벌 적재 + 가드 ' + GATE_TYPES.length + '종 **전건** 프롬프트 포착 (미적재·미포착은 판정 불가 = FAIL)', async () => {
    if (loadErr) return { ok: false, detail: '★적재 실패: ' + loadErr };
    if (typeof H.orig !== 'function' || typeof H.mut !== 'function' || typeof H.ctl !== 'function')
      return { ok: false, detail: '★handler 미적재 (orig/mut/ctl)' };
    if (runErr) return { ok: false, detail: '★실구동 예외: ' + runErr };
    if (promptless.length)
      return { ok: false, detail: '★프롬프트 미포착 ' + promptless.length + '종: ' +
        promptless.map((t) => t + '(①' + (R[t] ? R[t].ok.status : '?') + '/③' + (R[t] ? R[t].bad.status : '?') + ')').join(' ') };
    if (mutApplied < 1) return { ok: false, detail: '★뮤턴트 앵커 미적중(' + mutApplied + ') — 죽은 뮤턴트는 판정 불가' };
    return { ok: true, detail: 'orig/mut/ctl 적재 · ' + GATE_TYPES.length + '종 × 6벌 = ' + (GATE_TYPES.length * 6) +
      '회 실구동 · 프롬프트 전건 포착 · 뮤턴트 치환 ' + mutApplied + '곳' };
  });
  if (typeof H.orig !== 'function' || promptless.length || runErr) done();

  // ── E-0 : ★커버리지 = 분모 (결정 105) — `CW_*_TYPES` 를 소스에서 **기계 추출** ──
  await checkA('E-0', '★★커버리지 = 분모 — `CW_*_TYPES` 상수를 fortune.js 소스에서 기계 추출해 **집합 일치**를 본다 (「0건 중 0건 통과」 차단)', async () => {
    const rx = /const (CW_[A-Z0-9_]*_TYPES)\s*=\s*\[([^\]]*)\]/g;
    const consts = {}; let m;
    while ((m = rx.exec(FORTUNE_SRC))) {
      consts[m[1]] = m[2].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
    }
    const names = Object.keys(consts).sort();
    if (names.length < 8) return { ok: false, detail: '★`CW_*_TYPES` 상수 ' + names.length + '개 < 8 — 추출기가 죽었거나 가드가 사라졌다(판정 불가)' };
    if (!consts.CW_ENGINE_TYPES) return { ok: false, detail: '★`CW_ENGINE_TYPES` 부재 — E-4 의 분모가 없다' };
    const eng = consts.CW_ENGINE_TYPES.slice().sort().join(',');
    if (eng !== SAJU_TYPES.slice().sort().join(','))
      return { ok: false, detail: '★`CW_ENGINE_TYPES` = [' + eng + '] 가 saju 3종과 다르다 — E-4 의 대상이 바뀌었다' };
    const srcAll = [...new Set(names.reduce((a, n) => a.concat(consts[n]), []))].sort();
    const want = [...new Set(GATE_TYPES.concat(SAJU_TYPES))].sort();
    const miss = want.filter((t) => srcAll.indexOf(t) === -1);
    const extra = srcAll.filter((t) => want.indexOf(t) === -1);
    if (miss.length || extra.length)
      return { ok: false, detail: '★집합 불일치 — 소스에만 [' + extra.join(',') + '] · 게이트에만 [' + miss.join(',') +
        '] : 가드 대상이 늘었는데 이 게이트가 안 돈다면 그 type 은 **무감시**다' };
    if (GATE_TYPES.length < 20) return { ok: false, detail: '★도는 type ' + GATE_TYPES.length + ' < 하한 20' };
    const noKeys = GATE_TYPES.filter((t) => !(GUARDED[t] && GUARDED[t].length));
    if (noKeys.length) return { ok: false, detail: '★ctxguard 교체 키 표가 없는 type: ' + noKeys.join(',') + ' — 위조 대상이 정의되지 않는다' };
    const covered = GATE_TYPES.filter((t) => R[t] && R[t].ok.prompt && R[t].bad.prompt);
    if (covered.length !== GATE_TYPES.length)
      return { ok: false, detail: '★실제로 돈 type ' + covered.length + '/' + GATE_TYPES.length };
    return { ok: true, detail: '상수 ' + names.length + '종(' + names.join(',') + ') · 분모 ' + GATE_TYPES.length +
      '종 전건 구동 + saju 3종은 E-4(400 fail-closed)' };
  });

  // ── E-1 : ★★본체 ───────────────────────────────────────────────────────────
  const DIFF = {};
  for (const t of GATE_TYPES) DIFF[t] = diffPrompts(R[t].ok.prompt, R[t].bad.prompt);
  const emptyTypes = GATE_TYPES.filter((t) => DIFF[t].bad.length);
  const emptyLines = GATE_TYPES.reduce((a, t) => a + DIFF[t].bad.length, 0);
  const mixedLines = GATE_TYPES.reduce((a, t) => a + DIFF[t].changed.filter((c) => c.cls === 'mixed').length, 0);
  const show = (c) => '①' + JSON.stringify(c.ok) + ' → ③' + JSON.stringify(c.bad) + (c.cls === 'mixed' ? ' ★★혼합' : ' ★빈슬롯');

  await checkA('E-1', '★★본체 — 가드 type **' + GATE_TYPES.length + '종 전건**에서 폐기 시 프롬프트의 `empty`+`mixed` 가 **0** 이다', async () => {
    if (emptyLines === 0)
      return { ok: true, detail: '0건 (분모 ' + GATE_TYPES.length + '종 · 미분 줄 ' +
        GATE_TYPES.reduce((a, t) => a + DIFF[t].changed.length, 0) + ')' };
    const ex = [];
    for (const t of emptyTypes) for (const c of DIFF[t].bad) if (ex.length < 6) ex.push(t + ' ' + show(c));
    return { ok: false, detail: '★빈 슬롯 ' + emptyLines + '줄 / ' + emptyTypes.length + '종 (그중 ★★혼합 ' + mixedLines +
      ' — 「없음」 등 **거짓 단언**) : ' + ex.join('  |  ') + (emptyLines > 6 ? '  … 이하 생략' : '') };
  });

  // 상품별 개별 판정 — 어느 상품인지 즉시 보이게 한다(계약 §4 의 수리 대상 표).
  for (const t of GATE_TYPES) {
    await checkA('E-1:' + t, '★`' + t + '` 폐기 시 빈 슬롯 0 (③ mode 확인 포함)', async () => {
      const d = DIFF[t];
      const mb = modeOf(R[t].bad);
      if (mb !== 'discarded' && mb !== 'undeducible')
        return { ok: false, detail: '★③ 검체가 폐기 경로를 안 탔다 (mode=' + mb + ') — 이 상품의 판정은 무효다' };
      if (!d.bad.length) return { ok: true, detail: 'mode=' + mb + ' · 미분 ' + d.changed.length + '줄 전부 명시/삭제' };
      return { ok: false, detail: '★' + d.bad.length + '줄 (mode=' + mb + ') : ' + d.bad.slice(0, 3).map(show).join('  |  ') };
    });
  }

  // ── E-2 : ★긍정 대조 — ① 에 **서버 재유도값**이 실제로 들어 있다 ─────────────
  //   「서버값이 들어 있다」를 문자열 목록으로 적으면 그 목록이 곧 미검증 주장이 된다.
  //   ⟹ **성질**로 본다: ㉠ 클라 원국을 전부 위조해도 프롬프트가 **바이트 동일**하고
  //     ㉡ 생년월일을 바꾸면 프롬프트가 **달라진다**. ㉠㉡ 이 동시에 성립하면
  //     그 자리를 채운 것은 클라값이 아니라 **6키에서 재유도한 서버값**뿐이다.
  await checkA('E-2', '★★긍정 대조 — ① 정상 경로의 원국 자리를 **서버 재유도값**이 지배한다 (클라 위조 무영향 + 생년월일 의존)', async () => {
    const bad = [];
    for (const t of GATE_TYPES) {
      const r = R[t];
      if (modeOf(r.ok) !== 'derived') { bad.push(t + ': ① mode=' + modeOf(r.ok) + ' (derived 기대)'); continue; }
      if (!r.okF.prompt) { bad.push(t + ': ①F 프롬프트 미포착(status=' + r.okF.status + ')'); continue; }
      if (r.okF.prompt !== r.ok.prompt) bad.push(t + ': ★클라 원국 위조가 프롬프트를 바꿨다 — 서버가 지배하지 않는다');
      if (r.okF.prompt.indexOf(FORGE_MARK) !== -1) bad.push(t + ': ★위조 마커가 프롬프트에 도달');
      if (!r.ok2.prompt) { bad.push(t + ': ①\' 프롬프트 미포착'); continue; }
      if (r.ok2.prompt === r.ok.prompt) bad.push(t + ': ★생년월일을 바꿔도 프롬프트가 같다 — 재유도가 실제로 안 돈다');
    }
    return { ok: bad.length === 0,
      detail: bad.length ? '★' + bad.slice(0, 5).join(' / ') + (bad.length > 5 ? ' … 총 ' + bad.length + '건' : '')
        : GATE_TYPES.length + '종 전건: 위조 무영향(바이트 동일) · 생년월일 의존 확인' };
  });

  // ── E-3 : ★음성 대조 — legacy 는 **클라값이 그대로** 남는다 ────────────────
  //   ★★분류기(`classifyPair`)를 ①과 ② 사이에 쓰지 **않는다.** 그 분류기는 「같은 요청의
  //     재유도 성공 vs 폐기」라는 **한 짝**에만 뜻이 있다. ①(서버값)과 ②(클라값)는 애초에
  //     서로 다른 사실이라, 우연히 같은 절이 하나 끼면 「부분수열 = 빈 슬롯」으로 **오분류**된다
  //     (실측: `띠: 닭띠(酉), 천간지지: 기유년` — 앞 절이 서버값과 우연히 같다).
  //     ⟹ legacy 는 **폐기가 아니라는 성질**로 직접 본다:
  //       ㉠ `mode:'legacy'` · 200 · 서버가 **한 키도 바꾸지 않는다**(replaced=discarded=0)
  //       ㉡ 클라가 보낸 원국 문자열이 ② 프롬프트에 **바이트 그대로** 남아 있고,
  //          같은 문자열이 ③(폐기) 에는 **없다** — 빈 슬롯의 반대쪽 사실이다.
  //       ㉢ 클라 원국을 바꾸면 ② 프롬프트가 **달라진다**(클라값이 지배한다).
  await checkA('E-3', '★★음성 대조 — 6키 미전송(legacy)에서는 **클라값이 그대로** 남는다 (빈 슬롯이 아니다 · 폐기하지 않는다)', async () => {
    const bad = [], sites = [];
    for (const t of GATE_TYPES) {
      const r = R[t];
      const lg = r.leg.logs.length ? r.leg.logs[r.leg.logs.length - 1] : null;
      const ml = lg ? (lg.mode || null) : null;
      if (ml !== 'legacy') { bad.push(t + ': ② mode=' + ml + ' (legacy 기대)'); continue; }
      if (r.leg.status !== 200) bad.push(t + ': ② status=' + r.leg.status);
      if (typeof lg.replaced === 'number' && lg.replaced !== 0) bad.push(t + ': ② replaced=' + lg.replaced + ' (무변경이어야 한다)');
      if (typeof lg.discarded === 'number' && lg.discarded !== 0) bad.push(t + ': ★② discarded=' + lg.discarded + ' — legacy 인데 폐기했다');
      const ctx = FAM_OF[t].base();
      const kept = (GUARDED[t] || []).filter((k) => {
        const v = ctx[k];
        return typeof v === 'string' && v.length >= 2
          && r.leg.prompt.indexOf(v) !== -1 && r.bad.prompt.indexOf(v) === -1;
      });
      if (!kept.length) bad.push(t + ': ★클라 원국값이 ② 에 원문으로 남은 자리가 0 — legacy 가 클라값을 안 쓴다');
      else sites.push(t + '.' + kept[0] + (kept.length > 1 ? '+' + (kept.length - 1) : ''));
      if (!r.legF.prompt) { bad.push(t + ': ②F 프롬프트 미포착'); continue; }
      if (r.legF.prompt === r.leg.prompt) bad.push(t + ': ★클라 원국을 바꿔도 프롬프트가 같다 — legacy 가 클라값을 안 쓴다');
    }
    return { ok: bad.length === 0,
      detail: bad.length ? '★' + bad.slice(0, 5).join(' / ') + (bad.length > 5 ? ' … 총 ' + bad.length + '건' : '')
        : GATE_TYPES.length + '종 전건 200 · mode=legacy · 무변경 · 클라값 원문 잔존 ' + sites.length + '자리 (' + sites.slice(0, 4).join(' ') + ' …)' };
  });

  // ── E-4 : ★역방향 대조 — saju 3종은 fail-closed 400 ────────────────────────
  //   ★여기가 붉으면 **게이트가 틀린 것**이다(계약 §3). saju 는 이미 옳다.
  await checkA('E-4', '★★역방향 대조 — `saju` 3종은 **400 `CONTEXT_UNVERIFIABLE`** 로 막고 프롬프트를 만들지 않는다 (v7.72 관통 #2 · 이 축의 대상 아님)', async () => {
    const bad = [], note = [];
    for (const t of SAJU_TYPES) {
      const r = await runOn(H.orig, t, SAJU_CTX());
      note.push(t + '=' + r.status + '/' + r.error + '/prompt' + (r.prompt ? '있음' : '없음'));
      if (r.status !== 400 || r.error !== 'CONTEXT_UNVERIFIABLE' || r.prompt)
        bad.push(t + ': status=' + r.status + ' error=' + r.error + ' prompt=' + (r.prompt ? '생성됨' : '없음'));
    }
    return { ok: bad.length === 0,
      detail: bad.length ? '★' + bad.join(' / ') + ' — ★이 검사가 붉으면 게이트가 틀린 것이다(saju 는 이미 옳다)'
        : '3종 전건 fail-closed: ' + note.join(' · ') };
  });

  // ── E-5 / E-6 : ★자기 뮤턴트와 긍정 짝 ────────────────────────────────────
  //   ★이 짝이 없으면 「본체가 아무것도 안 잡는데 녹색」이 가능하다(결정 103).
  const mutRun = await runType(H.mut, MUT_TYPE);
  const ctlRun = await runType(H.ctl, MUT_TYPE);
  await checkA('E-5', '★★자기 뮤턴트 — 사본에서 명시 문구(`사장 사주: 미입력`)의 값을 `\'\'` 로 되돌리면 E-1 이 **적발**한다', async () => {
    if (typeof H.mut !== 'function') return { ok: false, detail: '★뮤턴트 미적재 — 판정 불가' };
    if (mutApplied < 1) return { ok: false, detail: '★앵커 미적중 — 죽은 뮤턴트는 판정 불가(통과 아님)' };
    if (!mutRun.ok.prompt || !mutRun.bad.prompt) return { ok: false, detail: '★뮤턴트 프롬프트 미포착' };
    const d = diffPrompts(mutRun.ok.prompt, mutRun.bad.prompt);
    return { ok: d.bad.length > 0,
      detail: d.bad.length ? '치환 ' + mutApplied + '곳 · `' + MUT_TYPE + '` 에서 ' + d.bad.length + '줄 적발: ' + show(d.bad[0])
        : '★심은 빈 슬롯을 못 잡았다 — E-1 의 0건은 아무것도 증명하지 않는다' };
  });
  await checkA('E-6', '★★긍정 짝 — **무변경 사본**에서는 그 뮤턴트가 **안 잡힌다** (E-5 가 항상-적발인 위약 차단 · 결정 103)', async () => {
    if (typeof H.ctl !== 'function') return { ok: false, detail: '★무변경 사본 미적재 — 판정 불가' };
    if (!ctlRun.ok.prompt || !ctlRun.bad.prompt) return { ok: false, detail: '★무변경 사본 프롬프트 미포착' };
    const d = diffPrompts(ctlRun.ok.prompt, ctlRun.bad.prompt);
    return { ok: d.bad.length === 0,
      detail: d.bad.length ? '★무변경 사본에서도 `' + MUT_TYPE + '` 가 붉다 — E-5 는 위약이다: ' + show(d.bad[0])
        : '무변경본 `' + MUT_TYPE + '` 빈 슬롯 0 (미분 ' + d.changed.length + '줄) — 뮤턴트가 원인이다' };
  });

  // ── E-7 : ★400 금지 (계약 §1-1 · 관통 #8) ──────────────────────────────────
  await checkA('E-7', '★★폐기 검체 전건이 **200** 이다 — 이 축의 어떤 수리도 HTTP 차단률을 올리지 않는다 (관통 #8 재발 방지)', async () => {
    const bad = [];
    const scen = [['①정상', 'ok'], ['①\'다른생년', 'ok2'], ['①F위조', 'okF'], ['③폐기', 'bad'], ['②legacy', 'leg'], ['②F legacy위조', 'legF']];
    for (const t of GATE_TYPES) for (const [nm, k] of scen) {
      const r = R[t][k];
      if (r.status !== 200) bad.push(nm + '/' + t + ' → ' + r.status + ' ' + JSON.stringify(r.error));
    }
    return { ok: bad.length === 0,
      detail: bad.length ? '★' + bad.slice(0, 6).join(' / ') : scen.length + '시나리오 × ' + GATE_TYPES.length + '종 = ' +
        (scen.length * GATE_TYPES.length) + '건 전부 200' };
  });

  // ── E-8 : ★자유 입력 무손실 (파 D 와 교차) ────────────────────────────────
  //   ★어느 (type,key) 를 볼지 사람이 적지 않는다. legacy(②) 프롬프트에 마커가 **도달한
  //     자리**가 곧 분모이고, 그 자리 전건에서 ①·③ 도 **바이트 그대로**여야 한다.
  //     폐기는 원국만 폐기한다 — 자유 서술은 한 바이트도 건드리지 않는다.
  await checkA('E-8', '★★자유 입력 무손실 — `story` 등 자유 서술이 ①②③ 전부에 **바이트 그대로** 도달한다 (길이 상한·폐기가 아무것도 자르지 않는다)', async () => {
    const bad = []; const sites = [];
    for (const t of GATE_TYPES) {
      const ctx = FAM_OF[t].base();
      for (const k of FREE_KEYS) {
        const v = ctx[k];
        if (typeof v !== 'string' || v.indexOf(FREE_MARK) === -1) continue;
        if (R[t].leg.prompt.indexOf(v) === -1) continue;         // 그 상품이 안 읽는 키 — 대상 아님
        sites.push(t + '.' + k);
        if (R[t].ok.prompt.indexOf(v) === -1) bad.push(t + '.' + k + ': ① 에서 변형/소실');
        if (R[t].bad.prompt.indexOf(v) === -1) bad.push(t + '.' + k + ': ★③ 폐기가 자유 서술을 건드렸다');
      }
    }
    const SITES_MIN = 12;   // ★분모 하한 — 자리가 사라지면 「0건 중 0건 통과」다(결정 105)
    if (sites.length < SITES_MIN)
      return { ok: false, detail: '★검사 자리 ' + sites.length + ' < 하한 ' + SITES_MIN + ' [' + sites.join(',') + '] — 덜 보고 0건' };
    return { ok: bad.length === 0,
      detail: bad.length ? '★' + bad.slice(0, 6).join(' / ') : '자리 ' + sites.length + '개 × ①②③ 전부 원문 도달 (' +
        [...new Set(sites.map((s) => s.split('.')[1]))].sort().join(',') + ')' };
  });

  // ── E-9 : ★tojeong strict 스위치가 **실제로 동작**한다 (v7.80 §5 · 결정 108) ──
  //   【왜 필요한가】 `CW_TOJEONG_STRICT` 는 v7.80 에 신설된 코드인데 **아무 게이트도
  //     보지 않았다.** 스위치가 상수 `false` 로 바뀌어도(= legacy 우회로가 영영 안 닫혀도)
  //     리포 어디도 붉어지지 않는다. legacy 는 「구버전 호환」이 아니라 **가드 우회로**다.
  //   【판정 — 소스가 아니라 런타임】 「`process.env` 를 읽는 줄이 있다」로는 부족하다.
  //     환경변수를 실제로 켜고 **프롬프트 바이트와 로그**가 함께 바뀌는지 본다.
  //   【★스위치가 켜졌을 때도 빈 슬롯이면 안 된다】 — 그것이 §7 전환의 선결 조건이었다.
  //     그래서 E-1 과 **같은 분류기**로 판정한다(수리가 strict 경로에도 미쳤는가).
  await checkA('E-9', '★★`CW_TOJEONG_STRICT` 실동작 — 켜면 legacy 가 폐기로 전이하고, 그때도 빈 슬롯이 아니라 **명시**다', async () => {
    const prev = process.env.CW_TOJEONG_STRICT;
    const bad = [], seen = [];
    try {
      for (const t of FAM.tojeong.types) {
        const mk = () => Object.assign({}, FAM.tojeong.base());
        // ① 정상(6키 재유도 성공) — 미분의 기준선
        delete process.env.CW_TOJEONG_STRICT;
        const rOk = await runOn(H.orig, t, Object.assign(mk(), FAM.tojeong.birth(OK)));
        // ② strict OFF + 5키 미전송 ⟹ legacy (아무것도 안 바뀐다)
        const rOff = await runOn(H.orig, t, mk());
        // ③ strict ON + 5키 미전송 ⟹ discarded (폐기하되 명시)
        process.env.CW_TOJEONG_STRICT = '1';
        const rOn = await runOn(H.orig, t, mk());
        delete process.env.CW_TOJEONG_STRICT;

        const mOff = modeOf(rOff), mOn = modeOf(rOn);
        seen.push(t + ':' + mOff + '→' + mOn);
        if (!rOk.prompt || !rOff.prompt || !rOn.prompt) { bad.push(t + ': 프롬프트 미포착 — 판정 불가'); continue; }
        if (mOff !== 'legacy') bad.push(t + ': ★OFF 인데 mode=' + mOff + ' (legacy 기대 — 기본 동작이 바뀌었다)');
        if (mOn !== 'discarded') bad.push(t + ': ★★ON 인데 mode=' + mOn + ' — **스위치가 무력하다**(우회로가 안 닫힌다)');
        if (rOn.prompt === rOff.prompt) bad.push(t + ': ★★ON/OFF 프롬프트가 바이트 동일 — 스위치가 프롬프트에 아무 영향이 없다');
        if (rOn.res.statusCode !== 200) bad.push(t + ': ★strict 가 ' + rOn.res.statusCode + ' 를 냈다 (400 금지 · 관통 #8)');
        // ★strict 폐기 경로도 빈 슬롯이면 안 된다 — E-1 과 같은 분류기로 본다.
        for (const c of diffPrompts(rOk.prompt, rOn.prompt).bad) {
          bad.push(t + ': ★strict 폐기가 ' + c.cls + ' 를 남겼다 → ' + JSON.stringify(c.bad));
        }
      }
    } finally {
      if (prev === undefined) delete process.env.CW_TOJEONG_STRICT; else process.env.CW_TOJEONG_STRICT = prev;
    }
    return { ok: bad.length === 0,
      detail: bad.length ? '★' + bad.slice(0, 6).join(' / ') : 'tojeong 3종 ' + seen.join(' · ') + ' · 빈 슬롯 0' };
  });

  done();
})().catch((e) => {
  record('E-FATAL', '★게이트 자체가 죽었다 (판정 불가 ≠ 통과)', false, (e && e.stack) ? String(e.stack).slice(0, 400) : String(e));
  done();
});
