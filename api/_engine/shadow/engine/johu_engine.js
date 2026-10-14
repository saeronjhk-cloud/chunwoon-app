// 생성물(P-805-D build_shadow_dist) — 수정 금지. 원본은 IP.


'use strict';
const fs = require('fs'); const path = require('path');
const M = require('./myeongli');
const JT = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'IP', 'rules', 'saju', 'johu_table.json'), 'utf8'));
const JJG = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'IP', 'rules', 'saju', 'jijanggan.json'), 'utf8'));
const EL = M.ELEMENT_NAME;
const stemEl = (s) => M.STEM_ELEMENT[M.stemIndex(s)];

const FLAGGED = new Set([
  ...(JT.external_review_flags?.ordering_conflict || []).map(x => x.cell),
  ...(JT.external_review_flags?.needs_term_segments || []).map(x => x.cell)
]);

const CS2 = (JT.cell_schema_v2 && JT.cell_schema_v2.cells) || {};
function getJohuDetailV2(cellKey) { return CS2[cellKey] || null; }

const EL_METAL = '金', EL_WATER = '水', EL_WOOD = '木', EL_FIRE = '火', EL_EARTH = '土';
function chartFeatures(pillars) {
  const stems = pillars.map(p => p.s);
  const branches = pillars.map(p => p.b);
  const els = [];
  stems.forEach(s => els.push(EL[stemEl(s)]));
  branches.forEach(b => els.push(EL[M.BRANCH_ELEMENT[M.branchIndex(b)]]));
  const cnt = (e) => els.filter(x => x === e).length;

  const has = (e) => cnt(e) > 0;
  const S = new Set(branches);
  const triad = (a, b, c) => [a, b, c].filter(x => S.has(x)).length >= 2;
  return {
    hasMetal: has(EL_METAL),
    manyMetalWater: (cnt(EL_METAL) + cnt(EL_WATER)) >= 4,
    manyWater: cnt(EL_WATER) >= 3 || triad('申', '子', '辰'),
    fireCluster: triad('寅', '午', '戌') || (S.has('午') && (S.has('巳') || S.has('未'))),
    manyWood: cnt(EL_WOOD) >= 3 || triad('亥', '卯', '未'),
    strongMetal: cnt(EL_METAL) >= 3 || triad('巳', '酉', '丑'),
    earthHeavy: cnt(EL_EARTH) >= 3 || ['辰', '戌', '丑', '未'].filter(x => S.has(x)).length >= 2,
    hasEarthStem: stems.some(s => EL[stemEl(s)] === EL_EARTH)
  };
}

function matchCondition(when, f) {
  const w = String(when || '');
  if (/見金/.test(w)) return f.hasMetal;
  if (/柱多金水/.test(w)) return f.manyMetalWater;
  if (/水局|水多/.test(w)) return f.manyWater;
  if (/火局/.test(w)) return f.fireCluster;
  if (/木盛|木多/.test(w)) return f.manyWood;
  if (/庚盛|金多|金重/.test(w)) return f.strongMetal;
  if (/土厚|土盛|四庫|季土|土重/.test(w)) return f.earthHeavy;
  if (/戊土|戊己|土가|土\b/.test(w)) return f.hasEarthStem;
  if (/上半月|下半月|清明|穀雨|白露|秋分|夏至|절기|建祿/.test(w)) return null;
  return null;
}

function getJohuV2Effective(pillars) {
  const cellKey = pillars[2].s + pillars[1].b;
  const d = CS2[cellKey];
  if (!d) return null;
  const f = chartFeatures(pillars);
  const base = (d.base_order || []).map(t => t.slice());
  const fired = [], undetermined = [], contra = [];
  (d.conditional_use || []).forEach(c => {
    const m = matchCondition(c.when, f);
    if (m === true) fired.push({ stem: c.stem, when: c.when, note: c.note });
    else if (m === null) undetermined.push({ type: 'conditional_use', stem: c.stem, when: c.when });
  });
  (d.conditional_reversal || []).forEach(r => {
    const m = matchCondition(r.when, f);
    if (m === true) fired.push({ reversal: true, when: r.when, order: r.order });
    else if (m === null) undetermined.push({ type: 'conditional_reversal', when: r.when });
  });
  if (d.solar_term_segment) d.solar_term_segment.forEach(seg =>
    undetermined.push({ type: 'solar_term_segment', segment: seg.segment, basis: seg.basis, reason: '절기·상하반월: 원국만으론 판별 불가(정밀 절입 필요)' }));
  (d.contraindicated || []).forEach(c => contra.push(c));

  let effective = base;
  const rev = fired.find(x => x.reversal);
  if (rev) effective = rev.order.map(t => t.slice());
  else fired.filter(x => x.stem).forEach(x => { if (!effective.flat().includes(x.stem)) effective = effective.concat([[x.stem]]); });
  return {
    cell: cellKey, experimental: true, resolver_influence: false,
    base_order: base, effective_order: effective,
    fired_conditions: fired, undetermined, contraindicated: contra,
    chart_features: f,
    note: 'v2 조건 활성화(shadow, experimental). 절기분기 미발동(판별불가 표기). 사용자 미노출.'
  };
}

function computeJohu(pillars) {
  const dayStem = pillars[2].s;
  const mB = pillars[1].b;
  const cellKey = dayStem + mB;
  const cell = (JT.table[dayStem] || {})[mB] || [];
  const primary = cell[0] || null;
  const primaryEl = primary ? EL[stemEl(primary)] : null;
  const detailV2 = getJohuDetailV2(cellKey);

  let present = false;
  if (primary) {
    const pel = stemEl(primary);
    present = pillars.some(p => stemEl(p.s) === pel) ||
      pillars.some(p => JJG.table[p.b].some(([s]) => stemEl(s) === pel));
  }
  return {
    doctrine_id: JT.doctrine_id,
    status: JT.status,
    resolver_influence: false,
    day_stem: dayStem, month_branch: mB,
    johu_yongsin: primary, johu_element: primaryEl, aux: cell.slice(1),
    present,
    table_status: JT.table_status,
    review_flag: FLAGGED.has(cellKey),
    citation_ids: [JT.citation_span_id],

    schema_v2_available: !!detailV2,
    detail_v2: detailV2,
    doctrine_status_v2: detailV2 ? detailV2.doctrine_status : null,
    v2_activation: detailV2 ? getJohuV2Effective(pillars) : null,

    note: '조후 조견표(SOURCE_REVIEW_REQUIRED) — 원문 대조 오류 다수 확인, 정식 판정 비영향. 전수 재컴파일 대기. v2 교리스키마는 shadow(사람 DOCTRINE 서명 전 미노출)'
  };
}

module.exports = { computeJohu, getJohuDetailV2, getJohuV2Effective };
