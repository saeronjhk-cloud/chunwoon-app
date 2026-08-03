'use strict';
/**
 * 천운 v7.71 — 서버 원국 재계산 (recompute.js)
 * ============================================================================
 * 결정 78 이행. 「클라이언트가 계산해서 보낸 값」은 검증된 값이 아니다.
 * 서버가 생년월일시로부터 4기둥을 **독립 재유도**하고, 클라이언트가 보낸
 * `context` 와 대조한다. 불일치 시 서버값이 이긴다.
 *
 * 동시에 닫히는 것:
 *   · 결정 78 — 임의 원국 주입(무료 saju 는 토큰조차 불필요했다)
 *   · 프롬프트 인젝션 표면 — context 문자열이 그대로 보간되던 경로
 *   · v7.69 §3-1 결함 3건 — 입춘 2/4 고정 · SOLAR_TERMS 죽은 상수 · (지장간은 §별도)
 *   · v7.71 신규 결함 A — 음력 변환 TZ 하루 밀림(한국 100%)
 *   · v7.71 신규 결함 C — LUNAR_INFO 표 데이터 오류 138건
 *
 * 설계 계약:
 *   · `Date` 객체 **전면 금지**. 서버 로컬 타임존에 의존하지 않는다.
 *   · 외부 npm 0 · 네이티브 0 · fs/JSON 0.
 *   · 판정 불가는 **거짓말이 아니라 flag** 로 낸다(ABSTAIN 계열).
 *   · 이 모듈은 **산출만** 한다. 무엇을 프롬프트에 넣을지는 bind.js 가 정한다.
 *     (결정 80 — 어댑터가 실질 권한을 쥐므로 경계를 명시한다)
 * ============================================================================
 */

const A = require('./astro.js');
const LU = require('./lunar.js');

// ── 기본 상수 (index.html 과 동일 규약) ────────────────────────────────────
const HS = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
const EB = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
const HS_CH = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const EB_CH = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const EL = ['목(木)', '화(火)', '토(土)', '금(金)', '수(水)'];
const HS_EL = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4];
const HS_YIN = [0, 1, 0, 1, 0, 1, 0, 1, 0, 1];
const EB_EL = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4];

// 일주 기준점: 1990-01-01 = 丙寅(idx 2). KASI 검증 이력 승계(index.html:1227~1229).
const DAY_REF_JDN = A.gregorianToJDN(1990, 1, 1);
const DAY_REF_IDX = 2;

/** 절입이 KST 자정에 이만큼 가까우면 날짜 판정이 알고리즘 오차에 민감하다(분). */
const TERM_EDGE_MIN = 30;

// ────────────────────────────────────────────────────────────────────────────
// 입력 정규화 — 문자열을 Date 없이 분해한다
// ────────────────────────────────────────────────────────────────────────────
/**
 * "YYYY-MM-DD" → {y,m,d} · 형식이 어긋나면 null.
 * ★index.html 은 `new Date(bs)` 를 쓴 뒤 로컬 게터로 읽어, UTC− 타임존에서
 *   하루가 밀렸다(v7.71 결함 B). 여기서는 문자열을 직접 분해한다.
 */
/**
 * @param {string} s        'YYYY-MM-DD'
 * @param {'solar'|'lunar'} calType
 *
 * ★★v7.72 수리 — 종전에는 **음력 입력에도 양력 달력 규칙**을 적용했다.
 *   음력 달은 대소월(30·29일)뿐이라 **2월 29일·30일이 정상적으로 존재**하는데,
 *   `jdnToGregorian(gregorianToJDN(y,2,29))` 왕복 검사가 평년 2/29·2/30 을
 *   거부해 `parseBirthDate` 가 null 을 냈다.
 *   ⟹ 음력 2월 29·30일생이 재계산에서 **전원 탈락**하고 있었다.
 *   종전에는 그것이 fail-open(무검증 통과)이라 **증상이 보이지 않았고**,
 *   v7.72 fail-closed 전환으로 400 이 되면서 비로소 드러났다.
 *   ★실측: 1930~2015 음력 조합에서 이 원인의 탈락이 **129건**이었다.
 *
 *   ⟹ 음력은 여기서 **범위만** 본다(1~30). 그 날이 실재하는지는
 *      `LU.lunarToSolar` 가 대소월·윤달을 보고 판정하며, 없으면
 *      `LUNAR_OUT_OF_RANGE` 로 귀결된다 — 판정 주체를 하나로 둔다.
 */
function parseBirthDate(s, calType) {
  if (typeof s !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (y < 1900 || y > 2050) return null;          // 음력·절기 계산 보증 구간
  if (mo < 1 || mo > 12 || d < 1) return null;
  if (calType === 'lunar') {
    if (d > 30) return null;                      // 음력 달은 최대 30일
    return { y, m: mo, d };
  }
  if (d > 31) return null;
  const g = A.jdnToGregorian(A.gregorianToJDN(y, mo, d));
  if (g.y !== y || g.m !== mo || g.d !== d) return null;  // 양력 2월 30일 등 차단
  return { y, m: mo, d };
}

/** 시진 인덱스 정규화: 0~11 만 유효. 그 외(−1·NaN·'모름'·null)는 전부 null. */
function normHourIdx(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') {
    const t = v.trim();
    if (t === '' || t === '-' || t === '모름' || t === '미상') return null;
    v = Number(t);
  }
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  if (!Number.isInteger(v)) return null;
  if (v < 0 || v > 11) return null;
  return v;
}

// ────────────────────────────────────────────────────────────────────────────
// 절기 기반 연주·월주
// ────────────────────────────────────────────────────────────────────────────
const _termCache = new Map();
function termsOf(year) {
  if (!_termCache.has(year)) {
    _termCache.set(year, A.majorTermsOfYear(year));
    if (_termCache.size > 40) _termCache.delete(_termCache.keys().next().value);
  }
  return _termCache.get(year);
}

/** 절입 순간을 「KST 기준 실수일」로 (자정 = 정수) */
function termKstDayFloat(t) { return t.jdUT + 9 / 24 + 0.5; }

/**
 * 출생 순간(KST 실수일)을 기준으로 사주 연도와 월지지를 정한다.
 * @param {number} birthDayFloat  jdn + 시각비율(0~1). 시각 미상이면 jdn+0.5(정오 가정).
 */
function yearAndMonthBranch(birthDayFloat, gy) {
  // 전년·당년·다음해 절기를 이어 붙여 경계를 안전하게 덮는다
  const all = [].concat(termsOf(gy - 1), termsOf(gy), termsOf(gy + 1))
    .map((t) => ({ ...t, kst: termKstDayFloat(t) }))
    .sort((a, b) => a.kst - b.kst);

  // 출생 순간 이전(포함)의 마지막 절
  let idx = -1;
  for (let i = 0; i < all.length; i++) { if (all[i].kst <= birthDayFloat) idx = i; else break; }
  if (idx === -1) return null;
  const cur = all[idx];

  // 사주 연도 = 출생 순간 이전의 마지막 **입춘**이 속한 회귀년
  let ip = null;
  for (let i = idx; i >= 0; i--) { if (all[i].lonDeg === 315) { ip = all[i]; break; } }
  if (!ip) return null;
  const sajuYear = A.jdnToGregorian(Math.floor(ip.kst)).y;

  // 경계 민감도: 출생 순간이 절입에서 얼마나 떨어져 있나(분)
  const marginMin = (birthDayFloat - cur.kst) * 1440;
  const nextTerm = all[idx + 1];
  const marginNextMin = nextTerm ? (nextTerm.kst - birthDayFloat) * 1440 : Infinity;

  return {
    sajuYear,
    monthBranch: cur.branch,
    termName: cur.name,
    termJdn: Math.floor(cur.kst),
    marginMin, marginNextMin,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 본체
// ────────────────────────────────────────────────────────────────────────────
/**
 * 생년월일시로부터 원국을 재계산한다.
 *
 * @param {object} inp
 *   @param {string} inp.birth      "YYYY-MM-DD" (calType 에 따라 양력 또는 음력)
 *   @param {string} [inp.calType]  'solar' | 'lunar'   (기본 'solar')
 *   @param {boolean}[inp.isLeap]   음력 윤달 여부      (기본 false)
 *   @param {number|string} [inp.hourIdx]  0~11 시진 · 그 외는 시주 미상
 * @returns {object|null}
 */
function recompute(inp) {
  if (!inp || typeof inp !== 'object') return null;

  const calType = inp.calType === 'lunar' ? 'lunar' : 'solar';
  // ★v7.72 — calType 을 파싱보다 먼저 정한다. 음력·양력의 날짜 유효 규칙이 다르다.
  const parsed = parseBirthDate(inp.birth, calType);
  if (!parsed) return null;
  const hourIdx = normHourIdx(inp.hourIdx);
  const isLeap = !!inp.isLeap;

  const notes = [];

  // ── 1. 음력 입력이면 양력으로 ────────────────────────────────────────────
  let sy, sm, sd, lunarIn = null;
  if (calType === 'lunar') {
    const sol = LU.lunarToSolar(parsed.y, parsed.m, parsed.d, isLeap);
    if (!sol) return { ok: false, reason: 'LUNAR_OUT_OF_RANGE', input: parsed };
    sy = sol.y; sm = sol.m; sd = sol.d;
    lunarIn = { year: parsed.y, month: parsed.m, day: parsed.d, isLeap };
    if (!isLeap && LU.leapMonthOf(parsed.y) === parsed.m) {
      notes.push('LUNAR_LEAP_AMBIGUOUS');   // 그 해 그 달에 윤달이 있는데 평달로 왔다
    }
  } else {
    sy = parsed.y; sm = parsed.m; sd = parsed.d;
  }

  const jdn = A.gregorianToJDN(sy, sm, sd);

  // ── 2. 출생 순간(KST 실수일) ─────────────────────────────────────────────
  // 시진은 2시간 구간이다. 경계 판정에는 구간 중앙을 쓰고, 구간이 절입을
  // 걸치면 flag 한다. 자시(0)는 23~01 이므로 중앙이 00:00 이다.
  let dayFloat, hourKnown = hourIdx !== null;
  if (hourKnown) {
    const centerHour = hourIdx === 0 ? 0 : hourIdx * 2;   // 자시 중앙 00:00
    dayFloat = jdn + centerHour / 24;
  } else {
    dayFloat = jdn + 0.5;                                  // 정오 가정
    notes.push('HOUR_UNKNOWN');
  }

  // ── 3. 연주·월주 (정밀 절기) ─────────────────────────────────────────────
  const ym = yearAndMonthBranch(dayFloat, sy);
  if (!ym) return { ok: false, reason: 'TERM_RESOLVE_FAILED' };

  // 경계 민감도 flag
  if (Math.abs(ym.marginMin) < TERM_EDGE_MIN * 4 || ym.marginNextMin < TERM_EDGE_MIN * 4) {   // ★관통 #8 — 죽은 상수였다. 결속한다(TERM_EDGE_MIN=30 · 시진 폭 2시간을 덮도록 ×4)
    notes.push('TERM_BOUNDARY_NEAR');       // 절입 ±2시간 — 시진 구간이 절입을 걸칠 수 있음
  }
  if (!hourKnown && (ym.termJdn === jdn)) {
    notes.push('TERM_SAME_DAY_HOUR_UNKNOWN'); // 절입 당일인데 시각 미상 → 월주 확정 불가 위험
  }

  const yIdx = ((ym.sajuYear - 4) % 60 + 60) % 60;
  const yearStem = yIdx % 10, yearBranch = yIdx % 12;

  const monthBranch = ym.monthBranch;
  // 五虎遁 — 연간에 따라 寅월 천간이 정해진다
  const monthStem = ([2, 4, 6, 8, 0][yearStem % 5] + ((monthBranch - 2 + 12) % 12)) % 10;

  // ── 4. 일주 ──────────────────────────────────────────────────────────────
  const dIdx = ((DAY_REF_IDX + (jdn - DAY_REF_JDN)) % 60 + 60) % 60;
  const dayStem = dIdx % 10, dayBranch = dIdx % 12;

  // ── 5. 시주 (五鼠遁) ─────────────────────────────────────────────────────
  let hourStem = null;
  if (hourKnown) hourStem = ([0, 2, 4, 6, 8][dayStem % 5] + hourIdx) % 10;

  // ── 6. 파생 ──────────────────────────────────────────────────────────────
  const pill = (s, b) => ({
    stem: s, branch: b,
    ganji: HS[s] + EB[b], ganjiCh: HS_CH[s] + EB_CH[b],
    el: HS_EL[s],
  });
  const pillars = {
    year: pill(yearStem, yearBranch),
    month: pill(monthStem, monthBranch),
    day: pill(dayStem, dayBranch),
    hour: hourKnown ? pill(hourStem, hourIdx) : null,
  };

  const els = [0, 0, 0, 0, 0];
  for (const k of ['year', 'month', 'day', 'hour']) {
    const p = pillars[k]; if (!p) continue;
    els[p.el]++; els[EB_EL[p.branch]]++;
  }

  const sipsungOf = (other) => {
    if (other === null || other === undefined) return '';
    const dE = HS_EL[dayStem], oE = HS_EL[other];
    const same = HS_YIN[dayStem] === HS_YIN[other];
    if (dE === oE) return same ? '비견' : '겁재';
    if ((dE + 1) % 5 === oE) return same ? '식신' : '상관';
    if ((dE + 2) % 5 === oE) return same ? '편재' : '정재';
    if ((dE + 3) % 5 === oE) return same ? '편관' : '정관';
    if ((dE + 4) % 5 === oE) return same ? '편인' : '정인';
    return '';
  };

  // 양력 → 음력 (표시·토정비결용). 천문 계산이므로 LUNAR_INFO 결함과 무관.
  const lunarOut = LU.solarToLunar(sy, sm, sd);

  return {
    ok: true,
    input: { calType, birth: `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`, hourIdx, isLeap },
    solar: { y: sy, m: sm, d: sd },
    lunar: lunarOut,
    lunarInput: lunarIn,
    jdn,
    sajuYear: ym.sajuYear,
    isAdjusted: ym.sajuYear !== sy,
    term: { name: ym.termName, jdn: ym.termJdn, marginMin: Math.round(ym.marginMin) },
    pillars,
    pillarStrings: {
      yearPillar: pillars.year.ganji,
      monthPillar: pillars.month.ganji,
      dayPillar: pillars.day.ganji,
      hourPillar: pillars.hour ? pillars.hour.ganji : '',
    },
    ilgan: HS[dayStem],
    ilganElement: EL[HS_EL[dayStem]],
    ilganYinyang: HS_YIN[dayStem] ? '음' : '양',
    yearStemYinyang: HS_YIN[yearStem] ? '음' : '양',
    els,
    sipsung: {
      year: sipsungOf(yearStem),
      month: sipsungOf(monthStem),
      day: sipsungOf(dayStem),          // 항상 '비견'
      hour: hourKnown ? sipsungOf(hourStem) : '',
    },
    mode: hourKnown ? '4기둥' : '3기둥(시주 미상)',
    notes,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 대조 — 클라이언트가 보낸 context 와 서버 재계산을 비교한다
// ────────────────────────────────────────────────────────────────────────────
/** 대조 대상 키와 서버 산출값의 매핑. ★여기 없는 키는 대조하지 않는다(명시적 경계). */
const COMPARE_KEYS = [
  ['yearPillar', (r) => r.pillarStrings.yearPillar],
  ['monthPillar', (r) => r.pillarStrings.monthPillar],
  ['dayPillar', (r) => r.pillarStrings.dayPillar],
  ['hourPillar', (r) => r.pillarStrings.hourPillar],
  ['ilgan', (r) => r.ilgan],
  ['ilganElement', (r) => r.ilganElement],
  ['ilganYinyang', (r) => r.ilganYinyang],
  ['yearStemYinyang', (r) => r.yearStemYinyang],
  ['sajuYear', (r) => r.sajuYear],
  ['isAdjusted', (r) => r.isAdjusted],
  ['sipsungYear', (r) => r.sipsung.year],
  ['sipsungMonth', (r) => r.sipsung.month],
  ['sipsungHour', (r) => r.sipsung.hour],
  ['els', (r) => r.els],
];

const eq = (a, b) => {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => v === b[i]);
  return a === b;
};

/**
 * @returns {{match:boolean, diffs:Array<{key,client,server}>, server:object}}
 */
function compareWithContext(ctx, r) {
  const diffs = [];
  if (!ctx || typeof ctx !== 'object' || !r || !r.ok) return { match: false, diffs, server: r };
  for (const [key, get] of COMPARE_KEYS) {
    if (!(key in ctx)) continue;                 // 클라이언트가 안 보낸 키는 대조 대상 아님
    const sv = get(r);
    if (!eq(ctx[key], sv)) diffs.push({ key, client: ctx[key], server: sv });
  }
  return { match: diffs.length === 0, diffs, server: r };
}

module.exports = {
  recompute, compareWithContext, COMPARE_KEYS,
  parseBirthDate, normHourIdx,
  HS, EB, HS_CH, EB_CH, EL, HS_EL, HS_YIN, EB_EL,
  TERM_EDGE_MIN,
};
