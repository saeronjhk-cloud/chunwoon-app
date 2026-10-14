// 생성물(P-805-D build_shadow_dist) — 수정 금지. 원본은 IP.


'use strict';
const M = require('./myeongli');

function ganziIndex(stemCh, branchCh) {
  const s = M.stemIndex(stemCh), b = M.branchIndex(branchCh);
  for (let i = 0; i < 60; i++) if (i % 10 === s && i % 12 === b) return i;
  return -1;
}
const idxToGanzi = (i) => M.STEMS[((i % 60) + 60) % 60 % 10] + M.BRANCHES[((i % 60) + 60) % 60 % 12];

const SOLAR_TERMS = [
  { m: 1, d: 6, name: '소한' }, { m: 2, d: 4, name: '입춘' }, { m: 3, d: 6, name: '경칩' },
  { m: 4, d: 5, name: '청명' }, { m: 5, d: 6, name: '입하' }, { m: 6, d: 6, name: '망종' },
  { m: 7, d: 7, name: '소서' }, { m: 8, d: 8, name: '입추' }, { m: 9, d: 8, name: '백로' },
  { m: 10, d: 8, name: '한로' }, { m: 11, d: 7, name: '입동' }, { m: 12, d: 7, name: '대설' }
];
const DAY_MS = 86400000;

function daewoonStartAge(birth, forward) {
  if (!birth || birth.y == null || birth.m == null || birth.d == null) return null;
  const bt = Date.UTC(birth.y, birth.m - 1, birth.d);
  const terms = [];
  for (const yr of [birth.y - 1, birth.y, birth.y + 1]) {
    for (const t of SOLAR_TERMS) terms.push({ ts: Date.UTC(yr, t.m - 1, t.d), name: t.name });
  }
  terms.sort((a, b) => a.ts - b.ts);
  let picked, days;
  if (forward) {
    picked = terms.find(t => t.ts > bt);
    days = Math.round((picked.ts - bt) / DAY_MS);
  } else {
    picked = [...terms].reverse().find(t => t.ts < bt);
    days = Math.round((bt - picked.ts) / DAY_MS);
  }
  const startAge = Math.max(1, Math.round(days / 3));
  return {
    start_age: startAge, days_to_term: days, term: picked.name,
    method: 'APPROX_FIXED_TERM',
    note: '절기 근사(고정일 테이블). 정밀 절입 시각은 만세력/전문가 검증 대상 — APPROX'
  };
}

function computeDaewoon(yearStemCh, monthPillar, gender, opts) {

  let startAge = null, birth = null;
  if (typeof opts === 'number') startAge = opts;
  else if (opts && typeof opts === 'object') { startAge = opts.startAge ?? null; birth = opts.birth ?? null; }

  const yangYear = M.STEM_YANG[M.stemIndex(yearStemCh)] === 1;
  const forward = (yangYear && gender === 'male') || (!yangYear && gender === 'female');

  let startAgeMeta = null;
  if (startAge == null && birth) {
    startAgeMeta = daewoonStartAge(birth, forward);
    if (startAgeMeta) startAge = startAgeMeta.start_age;
  }

  const mIdx = ganziIndex(monthPillar.s, monthPillar.b);
  const list = [];
  for (let i = 1; i <= 8; i++) {
    const idx = ((mIdx + (forward ? i : -i)) % 60 + 60) % 60;
    list.push({
      step: i,
      age: (startAge != null) ? (startAge + (i - 1) * 10) : null,
      ganji: idxToGanzi(idx),
      stem: M.STEMS[idx % 10], branch: M.BRANCHES[idx % 12]
    });
  }
  return {
    direction: forward ? '순행' : '역행',
    basis: '양남음녀 순행/음남양녀 역행',
    startAge: startAge ?? null,
    daesu_meta: startAgeMeta,

    user_surface: {
      direction: true,
      start_age: false,
      start_age_reason: 'PRECISE_SOLAR_TERM_TIME_REQUIRED',
      note: '대운수는 절입 시각(분 단위) 정밀 만세력 도입 전 사용자 확정 노출 불가(APPROX)'
    },
    list
  };
}

module.exports = { computeDaewoon, ganziIndex, daewoonStartAge };
