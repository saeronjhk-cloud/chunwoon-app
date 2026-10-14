// 생성물(P-805-D build_shadow_dist) — 수정 금지. 원본은 IP.


'use strict';
const fs = require('fs'), path = require('path');
const IP = path.join(__dirname, '..', 'IP');
const load = (p) => JSON.parse(fs.readFileSync(path.join(IP, p), 'utf8'));
const JJG = load('rules/saju/jijanggan.json');
const R = load('rules/saju/root_system.json');

const HSP = R.hidden_stem_policy_2026_07_20;
const SONG = JJG.hidden_stem_song;

function hiddenStems(br, policy) {
  const pol = policy || HSP.decision;
  const cmd = JJG.table[br];
  if (pol === 'COMMAND') return cmd;
  const song = new Set(SONG.table[br]);
  return cmd.filter(([st]) => song.has(st));
}

const STEM_EL = R.stem_element;
const BR = R.branch_order;
const ORD = R.unseong_order;
const START = R.unseong_start;
const YANG = new Set(R.yang_stems);

const EG = R.evidence_grades;
const L_ORIG = EG.ORIGINAL.ui_label;
const L_DOC = EG.DOCTRINE.ui_label;
const L_HOUSE = EG.HOUSE.ui_label;

const D2 = R.doctrine_layer_2026_07_17;
const D2_CELLS = D2.cells;

const D2_INDEX = {};
for (const [name, c] of Object.entries(D2_CELLS)) {
  (D2_INDEX[c.branch_type] ||= {})[c.role] = { name, weight: c.weight, strength: c.doctrine_strength, type: c.branch_type, role: c.role };
}

const BRANCH_TYPE = {};
for (const [type, list] of Object.entries(R.branch_type)) {
  if (Array.isArray(list)) list.forEach(b => { BRANCH_TYPE[b] = type; });
}

function unseong(stem, br) {
  const s = BR.indexOf(START[stem]), i = BR.indexOf(br);
  const d = YANG.has(stem) ? (i - s) : (s - i);
  return ORD[((d % 12) + 12) % 12];
}

function classifyRoot(stem, br, opts) {
  const el = STEM_EL[stem];
  const u = unseong(stem, br);
  const same = hiddenStems(br, opts && opts.hidden_stem_policy).filter(([s]) => STEM_EL[s] === el);
  const base = { unseong: u, hidden_same: same.map(([s, r]) => `${s}(${r})`), citation: R.citation_span_id,
    hidden_stem_policy: (opts && opts.hidden_stem_policy) || HSP.decision };
  const type = BRANCH_TYPE[br];
  const roles = same.map(([, r]) => r);

  if (el === '土') {

    if (same.length === 0) {
      return { kind: '무근', grade: null, weight: 0, ...base,
        evidence_grade: 'ORIGINAL', evidence_label: L_ORIG,
        weight_evidence_grade: 'ORIGINAL', weight_evidence_label: L_ORIG,
        note: "cite:0b2c07397afb" };
    }

    const cell = D2_INDEX[type] && roles.map(r => D2_INDEX[type][r]).find(Boolean);
    if (cell) {
      return { kind: cell.name, grade: null, weight: cell.weight, ...base,
        evidence_grade: 'DOCTRINE', evidence_label: L_DOC,
        weight_evidence_grade: 'HOUSE', weight_evidence_label: L_HOUSE,
        doctrine_id: D2.doctrine_id, doctrine_strength: cell.strength,
        note: `현대 통설 「${cell.name}」(${cell.type}×${cell.role}). 원문 근거 없음 — 그래서 2층이다. 서열(본기>중기>여기)은 한중 통설 일치.` };
    }

    return { kind: '★미분류', grade: null, weight: null, ...base,
      evidence_grade: 'ENGINE_ERROR', evidence_label: null,
      note: '土 2층 3칸 매칭 실패 — 土 藏干 보유 지지는 3칸(四庫×정기·旺地×중기·生地×여기)을 벗어날 수 없다. 설계 점검 요망.' };
  }

  if (!YANG.has(stem) && u === '장생') {
    return { kind: '陰長生', grade: '輕根', weight: R.weights.陰長生, ...base,
      evidence_grade: 'ORIGINAL', evidence_label: L_ORIG,
      weight_evidence_grade: 'HOUSE', weight_evidence_label: L_HOUSE,
      note: "cite:09c12a5d90d6" };
  }

  if (same.length === 0) {
    return { kind: '무근', grade: null, weight: 0, ...base,
      evidence_grade: 'ORIGINAL', evidence_label: L_ORIG,
      weight_evidence_grade: 'ORIGINAL', weight_evidence_label: L_ORIG,
      note: "cite:093d5aabc954" };
  }

  const O = (kind, grade, weight, note) =>
    ({ kind, grade, weight, ...base, evidence_grade: 'ORIGINAL', evidence_label: L_ORIG,
       weight_evidence_grade: 'HOUSE', weight_evidence_label: L_HOUSE, note });
  if (type === '生地') {
    if (roles.includes('정기')) return O('祿', '重根', R.weights.重根, "cite:da17ae57deab");
    if (roles.includes('중기')) return O('長生', '重根', R.weights.重根, "cite:da17ae57deab");
  }
  if (type === '旺地') {
    if (roles.includes('정기')) return O('刃', '重根', R.weights.重根, "cite:da17ae57deab");
  }
  if (type === '四庫') {
    if (roles.includes('여기')) return O('餘氣', '輕根', R.weights.餘氣, "cite:2894c7562cdb");
    if (roles.includes('중기')) return O('墓庫', '輕根', R.weights.墓庫,
      "cite:cc8a08b7329b");
  }

  return { kind: '★미분류', grade: null, weight: null, ...base,
    evidence_grade: 'ENGINE_ERROR', evidence_label: null,
    note: '5등급 매칭 실패 — 木火金水는 藏干 보유 지지가 오행당 5개뿐이어야 한다. 설계 점검 요망.' };
}

function rootProfile(pillars) {
  const day = pillars[2].s;
  const roots = pillars.map((p, i) => {
    const r = classifyRoot(day, p.b);
    return { pos: ['년', '월', '일', '시'][i], branch: p.b, ...r };
  });
  const known = roots.filter(r => r.weight !== null);
  const unk = roots.filter(r => r.weight === null);
  const total = known.reduce((a, r) => a + r.weight, 0);
  const total_min = total + unk.length * 0;
  const total_max = total + unk.length * R.weights['重根'];
  const hasAny = roots.some(r => r.weight > 0 || r.has_root === true);
  const heavy = roots.filter(r => r.grade === '重根').length;

  const grades = [...new Set(roots.filter(r => r.weight > 0).map(r => r.evidence_grade))];
  const doctrineWeight = roots.filter(r => r.evidence_grade === 'DOCTRINE').reduce((a, r) => a + (r.weight || 0), 0);

  return {
    roots,
    total_known: +total.toFixed(2),
    total_range: unk.length ? [+total_min.toFixed(2), +total_max.toFixed(2)] : [+total.toFixed(2), +total.toFixed(2)],
    point_estimate_valid: unk.length === 0,
    unspecified_count: unk.length,
    has_root: hasAny, heavy_count: heavy,

    can_bear: hasAny,
    unspecified: unk.length > 0,
    evidence_grades: grades,
    doctrine_weight: +doctrineWeight.toFixed(2),
    doctrine_share: total > 0 ? +(doctrineWeight / total).toFixed(3) : 0,
    evidence_labels: [...new Set(roots.filter(r => r.weight > 0).map(r => r.evidence_label))],
    citation_ids: [R.citation_span_id],
    authority: 'NON_AUTHORITATIVE',
  };
}

module.exports = { classifyRoot, rootProfile, unseong, hiddenStems };
