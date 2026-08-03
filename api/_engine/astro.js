'use strict';
/**
 * 천운 — 천문 계산 코어 (astro.js)
 * ============================================================================
 * 목적: 음력(태음태양력) 삭일과 24절기 절입 시각을 **직접 계산**한다.
 *
 * 왜 필요한가 (v7.71 §A):
 *   1. index.html 의 `LUNAR_INFO` 비트마스크 표에 데이터 결함이 있다.
 *      실측: 2023년 음력 3월/4월 대소월이 뒤바뀌어 2023-05-19~06-17 구간의
 *      음력 일자가 하루 어긋난다(부처님오신날 음4/8 = 2023-05-27 대조로 적발).
 *   2. index.html 의 절기 판정은 `boundaries` 하드코딩 고정일(입춘 2/4 등)이라
 *      연도별 실제 절입일(2/3~2/5)과 시각을 반영하지 못한다.
 *   3. 표는 검증이 불가능하지만 계산은 전수 검증이 가능하다(고정 원칙 4).
 *
 * 설계 원칙:
 *   · 외부 npm 0 · 네이티브 0 · fs/JSON 의존 0  (api/_engine/ 이식 조건)
 *   · `Date` 객체 **전면 금지**. 모든 날짜는 JDN(정수) 또는 JD(실수)로 다룬다.
 *     이유: index.html 의 결함 B(ISO 문자열 UTC 파싱 + 로컬 게터)와
 *           결함 A(LMT 오프셋 + Math.floor)가 전부 `Date` 에서 나왔다.
 *   · 시각 기준은 **KST(UTC+9) 고정**. 한국 역법의 공식 기준이다.
 *     ※ 1908 이전 LMT·1948~1961 서머타임은 의도적으로 무시한다 —
 *        KASI 공식 음양력 변환도 현행 KST 기준으로 발행된다.
 *
 * 출전:
 *   Jean Meeus, "Astronomical Algorithms", 2nd ed. (1998)
 *     ch.7  율리우스일        ch.10 ΔT
 *     ch.25 태양의 위치       ch.47 달의 위치
 *     ch.49 삭망(Moon phases)
 * ============================================================================
 */

// ────────────────────────────────────────────────────────────────────────────
// 1. 율리우스일 (Meeus ch.7) — 순수 정수/실수 산술, Date 미사용
// ────────────────────────────────────────────────────────────────────────────

/** 그레고리력 y-m-d(정수) → JDN(그날 정오의 율리우스일, 정수) */
function gregorianToJDN(y, m, d) {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy
    + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}

/** JDN(정수) → {y,m,d} 그레고리력 */
function jdnToGregorian(jdn) {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const dd = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * dd) / 4);
  const mm = Math.floor((5 * e + 2) / 153);
  return {
    y: 100 * b + dd - 4800 + Math.floor(mm / 10),
    m: mm + 3 - 12 * Math.floor(mm / 10),
    d: e - Math.floor((153 * mm + 2) / 5) + 1,
  };
}

/**
 * JD(실수, TT 기준) → 그 순간이 속하는 **KST 민용일**의 JDN(정수).
 * JD 는 UT 정오가 정수 경계이므로, KST(+9h) 자정 경계로 옮기려면
 *   JD + 0.5(정오→자정) + 9/24(UTC→KST)
 * 를 더한 뒤 내림한다.
 */
function jdToKstJdn(jd) {
  return Math.floor(jd + 0.5 + 9 / 24);
}

const J2000 = 2451545.0;

/** JD → 율리우스 세기(J2000.0 기준) */
const toT = (jd) => (jd - J2000) / 36525.0;

const RAD = Math.PI / 180;

// ────────────────────────────────────────────────────────────────────────────
// 2. ΔT = TT − UT  (Espenak & Meeus 다항 근사, NASA 공식판)
//    천문 계산은 TT, 민용시는 UT 이므로 반드시 보정해야 한다.
//    1900~2050 구간에서 ΔT 는 −3s ~ +70s 이며, 이는 삭·절입이
//    자정 경계에 놓일 때 날짜를 하루 바꾼다.
// ────────────────────────────────────────────────────────────────────────────
function deltaTSeconds(year, month) {
  const y = year + (month - 0.5) / 12;
  let u, t;
  if (y < 1900) {                       // 1800~1900
    t = y - 1860;
    return 7.62 + 0.5737 * t - 0.251754 * t * t + 0.01680668 * t ** 3
      - 0.0004473624 * t ** 4 + t ** 5 / 233174;
  }
  if (y < 1920) { t = y - 1900; return -2.79 + 1.494119 * t - 0.0598939 * t * t + 0.0061966 * t ** 3 - 0.000197 * t ** 4; }
  if (y < 1941) { t = y - 1920; return 21.20 + 0.84493 * t - 0.076100 * t * t + 0.0020936 * t ** 3; }
  if (y < 1961) { t = y - 1950; return 29.07 + 0.407 * t - t * t / 233 + t ** 3 / 2547; }
  if (y < 1986) { t = y - 1975; return 45.45 + 1.067 * t - t * t / 260 - t ** 3 / 718; }
  if (y < 2005) { t = y - 2000; return 63.86 + 0.3345 * t - 0.060374 * t * t + 0.0017275 * t ** 3 + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5; }
  if (y < 2050) { t = y - 2000; return 62.92 + 0.32217 * t + 0.005589 * t * t; }
  if (y < 2150) { u = (y - 1820) / 100; return -20 + 32 * u * u - 0.5628 * (2150 - y); }
  u = (y - 1820) / 100;
  return -20 + 32 * u * u;
}

/** TT 기준 JD → UT 기준 JD */
function ttToUt(jdTT) {
  const g = jdnToGregorian(Math.floor(jdTT + 0.5));
  return jdTT - deltaTSeconds(g.y, g.m) / 86400.0;
}

// ────────────────────────────────────────────────────────────────────────────
// 3. 태양의 겉보기 황경 (Meeus ch.25) — 절기 판정용
//    정확도: 1900~2100 구간에서 약 ±0.01°(≈ 15분). 절입 시각 판정에 충분하다.
// ────────────────────────────────────────────────────────────────────────────
function solarApparentLongitude(jdTT) {
  const T = toT(jdTT);
  // 기하 평균 황경
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  // 평균 근점이각
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const Mr = M * RAD;
  // 중심차
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mr)
    + (0.019993 - 0.000101 * T) * Math.sin(2 * Mr)
    + 0.000289 * Math.sin(3 * Mr);
  const trueLong = L0 + C;
  // 장동 + 광행차 보정 → 겉보기 황경
  const omega = 125.04 - 1934.136 * T;
  const apparent = trueLong - 0.00569 - 0.00478 * Math.sin(omega * RAD);
  return ((apparent % 360) + 360) % 360;
}

/**
 * 태양 황경이 `targetDeg` 가 되는 순간의 JD(TT)를 이분·뉴턴 혼합으로 구한다.
 * @param {number} targetDeg 0~360 (0=춘분, 315=입춘)
 * @param {number} jdGuess   초기 추정 JD(TT)
 */
function solveSolarLongitude(targetDeg, jdGuess) {
  let jd = jdGuess;
  for (let i = 0; i < 60; i++) {
    const lon = solarApparentLongitude(jd);
    // 목표까지의 각거리를 (-180,180] 로 정규화
    let diff = targetDeg - lon;
    while (diff > 180) diff -= 360;
    while (diff <= -180) diff += 360;
    if (Math.abs(diff) < 1e-9) break;
    jd += diff * 365.2422 / 360.0;   // 태양은 하루 약 0.9856° 이동
  }
  return jd;
}

// ────────────────────────────────────────────────────────────────────────────
// 4. 삭(New Moon) 시각 (Meeus ch.49) — 음력 월 시작 판정용
//    정확도: 1900~2100 구간에서 약 ±3분.
// ────────────────────────────────────────────────────────────────────────────
/**
 * k 번째 삭의 JD(TT). k=0 은 2000-01-06 의 삭.
 * k 는 정수(삭), k+0.25(상현), +0.5(망), +0.75(하현).
 */
function newMoonJDE(k) {
  const T = k / 1236.85;
  const T2 = T * T, T3 = T2 * T, T4 = T3 * T;

  let jde = 2451550.09766 + 29.530588861 * k
    + 0.00015437 * T2 - 0.000000150 * T3 + 0.00000000073 * T4;

  // 태양의 평균 근점이각
  const M = 2.5534 + 29.10535670 * k - 0.0000014 * T2 - 0.00000011 * T3;
  // 달의 평균 근점이각
  const Mp = 201.5643 + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4;
  // 달의 위도 독립변수
  const F = 160.7108 + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4;
  // 달 궤도의 승교점 황경
  const Om = 124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T3;
  // 지구 궤도 이심률
  const E = 1 - 0.002516 * T - 0.0000074 * T2;

  const s = (deg) => Math.sin(deg * RAD);
  const Mr = M, Mpr = Mp, Fr = F, Omr = Om;

  // 주기항 (삭 전용 계수)
  jde += -0.40720 * s(Mpr)
    + 0.17241 * E * s(Mr)
    + 0.01608 * s(2 * Mpr)
    + 0.01039 * s(2 * Fr)
    + 0.00739 * E * s(Mpr - Mr)
    - 0.00514 * E * s(Mpr + Mr)
    + 0.00208 * E * E * s(2 * Mr)
    - 0.00111 * s(Mpr - 2 * Fr)
    - 0.00057 * s(Mpr + 2 * Fr)
    + 0.00056 * E * s(2 * Mpr + Mr)
    - 0.00042 * s(3 * Mpr)
    + 0.00042 * E * s(Mr + 2 * Fr)
    + 0.00038 * E * s(Mr - 2 * Fr)
    - 0.00024 * E * s(2 * Mpr - Mr)
    - 0.00017 * s(Omr)
    - 0.00007 * s(Mpr + 2 * Mr)
    + 0.00004 * s(2 * Mpr - 2 * Fr)
    + 0.00004 * s(3 * Mr)
    + 0.00003 * s(Mpr + Mr - 2 * Fr)
    + 0.00003 * s(2 * Mpr + 2 * Fr)
    - 0.00003 * s(Mpr + Mr + 2 * Fr)
    + 0.00003 * s(Mpr - Mr + 2 * Fr)
    - 0.00002 * s(Mpr - Mr - 2 * Fr)
    - 0.00002 * s(3 * Mpr + Mr)
    + 0.00002 * s(4 * Mpr);

  // 추가 보정항 (Meeus p.352)
  const A = [
    [299.77 + 0.107408 * k - 0.009173 * T2, 0.000325],
    [251.88 + 0.016321 * k, 0.000165],
    [251.83 + 26.651886 * k, 0.000164],
    [349.42 + 36.412478 * k, 0.000126],
    [84.66 + 18.206239 * k, 0.000110],
    [141.74 + 53.303771 * k, 0.000062],
    [207.14 + 2.453732 * k, 0.000060],
    [154.84 + 7.306860 * k, 0.000056],
    [34.52 + 27.261239 * k, 0.000047],
    [207.19 + 0.121824 * k, 0.000042],
    [291.34 + 1.844379 * k, 0.000040],
    [161.72 + 24.198154 * k, 0.000037],
    [239.56 + 25.513099 * k, 0.000035],
    [331.55 + 3.592518 * k, 0.000023],
  ];
  for (const [ang, coef] of A) jde += coef * s(ang);

  return jde;
}

/** 주어진 JD 직전(또는 같은) 삭의 근사 k 값 */
function kFromJD(jd) {
  return Math.floor((jd - 2451550.09766) / 29.530588861);
}

// ────────────────────────────────────────────────────────────────────────────
// 5. 절기 — 24절기 중 **12절(節)** 이 사주 월주 경계다.
//    황경 315°=입춘(寅월 시작), 345°=경칩(卯), 15°=청명(辰) …
//    (중기 12개는 월 경계가 아니라 음력 윤달 판정에 쓰인다)
// ────────────────────────────────────────────────────────────────────────────

/** 12절: [황경, 절기명, 월지지 인덱스] — 지지 인덱스는 子=0 규약 */
const MAJOR_TERMS = [
  [315, '입춘', 2],  // 寅
  [345, '경칩', 3],  // 卯
  [15, '청명', 4],  // 辰
  [45, '입하', 5],  // 巳
  [75, '망종', 6],  // 午
  [105, '소서', 7],  // 未
  [135, '입추', 8],  // 申
  [165, '백로', 9],  // 酉
  [195, '한로', 10], // 戌
  [225, '입동', 11], // 亥
  [255, '대설', 0],  // 子
  [285, '소한', 1],  // 丑
];

/**
 * `year` 연도에 속하는 12절의 절입 시각을 KST 기준으로 계산한다.
 * @returns {Array<{name,lonDeg,branch,jdUT,jdn}>} jdn = 절입이 일어나는 KST 민용일
 */
function majorTermsOfYear(year) {
  const out = [];
  for (const [lon, name, branch] of MAJOR_TERMS) {
    // 해당 황경이 나타나는 대략적 월 → 초기 추정치
    // 황경 315(입춘)=2월 초, 345(경칩)=3월 초, 15(청명)=4월 초 …
    let approxMonth = Math.round(((lon - 315 + 360) % 360) / 30) + 2;
    if (approxMonth > 12) approxMonth -= 12;
    const guess = gregorianToJDN(year, approxMonth, 5) - 0.5;
    const jdTT = solveSolarLongitude(lon, guess);
    const jdUT = ttToUt(jdTT);
    out.push({ name, lonDeg: lon, branch, jdUT, jdn: jdToKstJdn(jdUT) });
  }
  out.sort((a, b) => a.jdUT - b.jdUT);
  return out;
}

/** 중기(中氣) 12개: 황경 330(우수), 0(춘분), 30(곡우) … 270(동지) */
function minorTermJdn(year, lonDeg) {
  let approxMonth = Math.round(((lonDeg - 330 + 360) % 360) / 30) + 2;
  if (approxMonth > 12) approxMonth -= 12;
  const guess = gregorianToJDN(year, approxMonth, 20) - 0.5;
  return jdToKstJdn(ttToUt(solveSolarLongitude(lonDeg, guess)));
}

/** 동지(황경 270°)가 일어나는 KST 민용일의 JDN */
function winterSolsticeJdn(year) {
  const guess = gregorianToJDN(year, 12, 21) - 0.5;
  return jdToKstJdn(ttToUt(solveSolarLongitude(270, guess)));
}

/** 삭이 일어나는 KST 민용일의 JDN (= 음력 초하루) */
function newMoonJdn(k) {
  return jdToKstJdn(ttToUt(newMoonJDE(k)));
}

module.exports = {
  gregorianToJDN, jdnToGregorian, jdToKstJdn,
  deltaTSeconds, ttToUt,
  solarApparentLongitude, solveSolarLongitude,
  newMoonJDE, kFromJD, newMoonJdn,
  MAJOR_TERMS, majorTermsOfYear, minorTermJdn, winterSolsticeJdn,
};
