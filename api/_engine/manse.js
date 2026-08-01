// 천운 — 만세력 일진(日辰) 계산. 앱(index.html)의 KASI 검증 기준점을 그대로 포팅.
// 기준: 1990-01-01 = 丙寅日 (60갑자 idx 2). @fullstackfamily/manseryeok(KASI) 8케이스 검증됨.
// ※ 여기서는 '일진(그날의 간지)'만 계산한다. 사용자 사주 4기둥은 앱의 검증 만세력을 사용.
'use strict';
const STEMS = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const BRANCHES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

// 양력 y-m-d → 60갑자 일진 인덱스 (UTC 기준, DST 무관)
function dayGanziIndex(y, m, d) {
  const REF = Date.UTC(1990, 0, 1);      // 1990-01-01 = idx 2 (丙寅)
  const days = Math.round((Date.UTC(y, m - 1, d) - REF) / 86400000);
  return ((2 + days) % 60 + 60) % 60;
}

function dayGanzi(y, m, d) {
  const idx = dayGanziIndex(y, m, d);
  const s = idx % 10, b = idx % 12;
  return { index: idx, stemIdx: s, branchIdx: b, stem: STEMS[s], branch: BRANCHES[b], ganji: STEMS[s] + BRANCHES[b] };
}

// 자체 검증(앱 기준점과 일치)
function selfTest() {
  const t = dayGanzi(1990, 1, 1);
  return { pass: t.ganji === '丙寅' && t.index === 2, got: t.ganji, idx: t.index };
}

module.exports = { STEMS, BRANCHES, dayGanziIndex, dayGanzi, selfTest };
