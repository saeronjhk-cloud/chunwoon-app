// ============================================================
//  api/_engine/tojeong1935.js — 토정비결 작괘(1935 활자본 원문 확정 규칙) · 트랙 F2
//  ★수표·작괘법 정본 = IP gate_pkg/IP/rules/tojeong/tojeong_numtable_1935.json (이 폴더의 같은 이름 파일은 그 복사본)
//    생성기 IP gate_pkg/tools/build_tojeong_numtable.js · 규칙 _v806_work/사전등록_P-806-F1_…md · 평가 p49·p50
//  ★「TJ1935-SHARED」 구간은 index.html 에 **글자 그대로 같은 사본**이 있다(p50 Q5 가 대조한다).
//    한쪽만 고치면 화면과 서버 해석이 갈린다 — 반드시 두 곳을 함께 고친다.
//  ★정직성: 필요한 수표 칸이 미확정이거나 보는 해에 그 음력 날짜가 없으면 HOLD — 옛 식·추정값으로 메우지 않는다.
// ============================================================
'use strict';
const TABLE = require('./tojeong_numtable_1935.json');

// ===TJ1935-SHARED-BEGIN===
/** 60갑자 순번(0=甲子). s=천간 순번 0..9 · b=지지 순번 0..11 (같은 음양이어야 실재 간지) */
function tjGzIndex(s, b) { return ((6 * s - 5 * b) % 60 + 60) % 60; }
/**
 * 보는 해(當年) 기준 작괘 입력 — 제이 결정 D2(월 大小·월건·일진 모두 보는 해) · D3(윤달생은 같은 숫자 평달).
 * @param {number} ty 보는 해 · @param {{year,month,day}} lunar 음력 생년월일
 * @param {Function} l2s (y,m,d,isLeap) → 양력 {y,m,d}|null · @param {Function} daySB (양력) → [천간순번, 지지순번]|null
 */
function tjTargetInputs(ty, lunar, l2s, daySB) {
  if (!lunar || !(lunar.year > 0) || !(lunar.month >= 1 && lunar.month <= 12) || !(lunar.day >= 1 && lunar.day <= 30)) return { hold: 'BAD_LUNAR' };
  const age = ty - lunar.year + 1;
  if (!(age >= 1)) return { hold: 'AGE' };
  const ys = ((ty - 4) % 10 + 10) % 10, yb = ((ty - 4) % 12 + 12) % 12;
  const m = lunar.month;
  if (!l2s(ty, m, 1, false)) return { hold: 'NO_TARGET_MONTH' };
  const big = !!l2s(ty, m, 30, false);
  const head = [2, 4, 6, 8, 0][ys % 5];          // 年頭: 甲己→丙寅 · 乙庚→戊寅 · 丙辛→庚寅 · 丁壬→壬寅 · 戊癸→甲寅 (원문 p002)
  const ms = (head + m - 1) % 10, mb = (2 + m - 1) % 12;
  const sol = l2s(ty, m, lunar.day, false);
  if (!sol) return { hold: 'NO_TARGET_DAY' };     // 예: 30일생인데 보는 해 그 달이 작은달
  const d = daySB(sol);
  if (!d || d.length !== 2) return { hold: 'DAY_PILLAR' };
  return { age, yearSB: [ys, yb], monthSize: big ? 30 : 29, monthSB: [ms, mb], lunarDay: lunar.day, daySB: d };
}
/** 확정 수표·작괘법으로 상·중·하괘. HOLD 면 {status:'HOLD',reason}. */
function tjGua1935(T, x) {
  if (!T || T.method_status !== 'VERIFIED' || !Array.isArray(T.table60) || T.table60.length !== 60) return { status: 'HOLD', reason: 'TABLE' };
  if (!x || x.hold) return { status: 'HOLD', reason: (x && x.hold) || 'NO_INPUT' };
  const cy = T.table60[tjGzIndex(x.yearSB[0], x.yearSB[1])];
  const cm = T.table60[tjGzIndex(x.monthSB[0], x.monthSB[1])];
  const cd = T.table60[tjGzIndex(x.daySB[0], x.daySB[1])];
  if (!cy || cy.status !== 'VERIFIED') return { status: 'HOLD', reason: 'CELL_YEAR' };
  if (!cm || cm.status !== 'VERIFIED') return { status: 'HOLD', reason: 'CELL_MONTH' };
  if (!cd || cd.status !== 'VERIFIED') return { status: 'HOLD', reason: 'CELL_DAY' };
  const M = T.method;
  const v = { age: x.age, taese: cy.taese, month_size: x.monthSize, wolgeon: cm.wolgeon, lunar_day: x.lunarDay, iljin: cd.iljin };
  const part = (g) => { let s = 0; for (const o of M[g].operands) s += v[o]; return (s % M[g].divisor) || M[g].zero_to; };
  const u = part('upper'), mi = part('middle'), lo = part('lower');
  return { status: 'OK', gua: '' + u + mi + lo, upper: u, middle: mi, lower: lo, taese: v.taese, wolgeon: v.wolgeon, iljin: v.iljin };
}
// ===TJ1935-SHARED-END===

module.exports = { TABLE, tjGzIndex, tjTargetInputs, tjGua1935 };
