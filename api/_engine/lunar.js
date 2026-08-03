'use strict';
/**
 * 천운 — 음력(태음태양력) 산출 (lunar.js)
 * ============================================================================
 * `LUNAR_INFO` 비트마스크 표를 대체한다. 표는 검증이 불가능하지만
 * 계산은 전수 검증이 가능하다(고정 원칙 4).
 *
 * 역법 규칙 (한국·중국 태음태양력 · 시헌력 이래 현행):
 *   R1. 달의 시작 = 삭(朔, new moon)이 일어나는 날. 그 날이 음력 1일.
 *   R2. 음력 11월 = **동지(冬至, 황경 270°)를 포함하는 달**.
 *   R3. 동짓달(11월)부터 다음 동짓달 직전까지 달이 **13개**면 윤달을 1개 둔다.
 *   R4. 무중치윤법(無中置閏) — 윤달은 그 13개 중 **중기(中氣)를 포함하지 않는
 *       첫 번째 달**이며, 직전 달의 이름을 따 「윤O월」이 된다.
 *   R5. 중기 12개 = 황경 30°의 배수 (동지 270°, 대한 300°, 우수 330°,
 *       춘분 0°, 곡우 30°, 소만 60°, 하지 90°, 대서 120°, 처서 150°,
 *       추분 180°, 상강 210°, 소설 240°).
 *   R6. 시각 기준은 **KST(UTC+9)**. 삭·중기가 KST 자정 경계 어느 쪽에
 *       떨어지는지가 날짜를 가른다.
 *
 * 검증: `verify_lunar.js` 가 공식 GT(설날·추석·부처님오신날 등)와 대조하고,
 *       `LUNAR_INFO` 표와 1900~2050 전수 대조해 차이 지점을 열거한다.
 * ============================================================================
 */

const A = require('./astro.js');

// 중기 12개 (황경). 동지 270° 를 기준으로 30° 씩.
const MINOR_TERM_LONS = [270, 300, 330, 0, 30, 60, 90, 120, 150, 180, 210, 240];

/** 캐시 — 연 단위로 구성한 음력 달력을 재사용한다(콜드스타트 비용 절감). */
const _cache = new Map();

/**
 * `sui`(歲) 하나를 구성한다.
 * 定義: year 년 동지가 든 달(= 음력 11월) 부터 year+1 년 동지가 든 달 직전까지.
 * @returns {Array<{startJdn, monthNum, isLeap}>} 시간순 달 목록
 */
function buildSui(year) {
  // ① 두 동지의 JDN
  const ws0 = A.winterSolsticeJdn(year);
  const ws1 = A.winterSolsticeJdn(year + 1);

  // ② 각 동지를 포함하는 달의 삭일(= 그 달 1일)
  const nmOnOrBefore = (jdn) => {
    let k = A.kFromJD(jdn) + 2;             // 여유를 두고 뒤에서부터 내려온다
    while (A.newMoonJdn(k) > jdn) k--;
    return { k, jdn: A.newMoonJdn(k) };
  };
  const m0 = nmOnOrBefore(ws0);             // 음력 11월 삭
  const m1 = nmOnOrBefore(ws1);             // 다음 해 음력 11월 삭

  // ③ 그 사이의 삭을 전부 모은다
  const months = [];
  for (let k = m0.k; k < m1.k; k++) {
    months.push({ k, startJdn: A.newMoonJdn(k), endJdn: A.newMoonJdn(k + 1) - 1 });
  }
  const count = months.length;              // 12 또는 13

  // ④ 각 달이 중기를 포함하는지 판정
  //    중기는 태양 황경 30° 배수의 순간이며, 그 순간이 속한 KST 민용일이
  //    이 달의 [startJdn, endJdn] 안에 있으면 「중기를 품었다」.
  const termJdns = [];
  for (const lon of MINOR_TERM_LONS) {
    // year 와 year+1 양쪽에서 뽑아 sui 전 구간을 덮는다
    termJdns.push(A.minorTermJdn(year, lon), A.minorTermJdn(year + 1, lon));
  }
  const hasMinorTerm = (mo) =>
    termJdns.some((t) => t >= mo.startJdn && t <= mo.endJdn);

  // ⑤ 월 이름 부여. months[0] = 11월.
  let leapIdx = -1;
  if (count === 13) {
    for (let i = 1; i < months.length; i++) {   // 11월 자신은 윤달이 될 수 없다
      if (!hasMinorTerm(months[i])) { leapIdx = i; break; }
    }
    if (leapIdx === -1) leapIdx = 1;             // 이론상 도달 불가. 안전망.
  }

  const out = [];
  let num = 11;
  for (let i = 0; i < months.length; i++) {
    if (i === leapIdx) {
      out.push({ startJdn: months[i].startJdn, endJdn: months[i].endJdn, monthNum: num, isLeap: true });
    } else {
      num = i === 0 ? 11 : num + 1;
      if (num > 12) num -= 12;
      out.push({ startJdn: months[i].startJdn, endJdn: months[i].endJdn, monthNum: num, isLeap: false });
    }
  }
  return out;
}

/**
 * 어떤 JDN 이 속한 음력 날짜를 찾는다.
 * 음력 연도는 「음력 1월 1일이 시작하는 해」로 매긴다.
 */
function _monthsCovering(jdn) {
  const g = A.jdnToGregorian(jdn);
  const key = g.y;
  if (!_cache.has(key)) {
    // 전년·당년 두 sui 를 이어 붙여 경계를 안전하게 덮는다
    _cache.set(key, [].concat(buildSui(g.y - 2), buildSui(g.y - 1), buildSui(g.y)));
    if (_cache.size > 24) _cache.delete(_cache.keys().next().value);
  }
  return _cache.get(key);
}

/**
 * 양력 → 음력.
 * @returns {{year,month,day,isLeap}|null}
 */
function solarToLunar(y, m, d) {
  const jdn = A.gregorianToJDN(y, m, d);
  const months = _monthsCovering(jdn);
  const idx = months.findIndex((mo) => jdn >= mo.startJdn && jdn <= mo.endJdn);
  if (idx === -1) return null;
  const mo = months[idx];
  const day = jdn - mo.startJdn + 1;

  // 음력 연도 = 이 달 이전(포함)에서 가장 가까운 「1월(비윤달)」이 속한 해.
  // 1월 1일의 양력 연도를 그대로 음력 연도로 쓴다(설날 기준).
  let j = idx;
  while (j >= 0 && !(months[j].monthNum === 1 && !months[j].isLeap)) j--;
  if (j < 0) return null;
  const lunarYear = A.jdnToGregorian(months[j].startJdn).y;

  return { year: lunarYear, month: mo.monthNum, day, isLeap: mo.isLeap };
}

/**
 * 음력 → 양력.
 * @param {boolean} isLeap 윤달 여부
 * @returns {{year,month,day}|null}
 */
function lunarToSolar(ly, lm, ld, isLeap) {
  if (!Number.isInteger(ly) || !Number.isInteger(lm) || !Number.isInteger(ld)) return null;
  if (lm < 1 || lm > 12 || ld < 1 || ld > 30) return null;
  // 음력 ly년 1월 1일은 양력 ly년 1~2월에 있다. 그 해와 전년 sui 를 훑는다.
  const pool = [].concat(buildSui(ly - 2), buildSui(ly - 1), buildSui(ly));
  // 음력 ly년의 시작(1월 비윤달) 위치
  let start = -1;
  for (let i = 0; i < pool.length; i++) {
    if (pool[i].monthNum === 1 && !pool[i].isLeap
      && A.jdnToGregorian(pool[i].startJdn).y === ly) { start = i; break; }
  }
  if (start === -1) return null;
  for (let i = start; i < pool.length; i++) {
    const mo = pool[i];
    if (mo.monthNum === lm && !!mo.isLeap === !!isLeap) {
      const len = mo.endJdn - mo.startJdn + 1;
      if (ld > len) return null;                 // 그 달에 없는 날짜
      return A.jdnToGregorian(mo.startJdn + ld - 1);
    }
    // 다음 해 1월에 닿으면 중단
    if (i > start && mo.monthNum === 1 && !mo.isLeap) break;
  }
  return null;
}

/** 그 해의 윤달 번호(없으면 0) — 진단·UI 용 */
function leapMonthOf(ly) {
  const pool = [].concat(buildSui(ly - 1), buildSui(ly));
  let start = -1;
  for (let i = 0; i < pool.length; i++) {
    if (pool[i].monthNum === 1 && !pool[i].isLeap
      && A.jdnToGregorian(pool[i].startJdn).y === ly) { start = i; break; }
  }
  if (start === -1) return 0;
  for (let i = start; i < pool.length; i++) {
    if (i > start && pool[i].monthNum === 1 && !pool[i].isLeap) break;
    if (pool[i].isLeap) return pool[i].monthNum;
  }
  return 0;
}

module.exports = { solarToLunar, lunarToSolar, buildSui, leapMonthOf, MINOR_TERM_LONS };
