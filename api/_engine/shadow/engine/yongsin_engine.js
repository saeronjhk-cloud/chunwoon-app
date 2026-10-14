// 생성물(P-805-D build_shadow_dist) — 수정 금지. 원본은 IP.


'use strict';
const fs = require('fs'); const path = require('path');
const M = require('./myeongli');
const IP = path.join(__dirname, '..', 'IP');
const load = (p) => JSON.parse(fs.readFileSync(path.join(IP, p), 'utf8'));
const Y = load('rules/saju/yongsin.json');
const JJG = load('rules/saju/jijanggan.json');
const RS = load('rules/saju/root_system.json');

const RE = require('./root_engine');
const EL = M.ELEMENT_NAME;

const stemEl = (s) => M.STEM_ELEMENT[M.stemIndex(s)];
const grps = (d) => ({ bi:d, sik:(d+1)%5, jae:(d+2)%5, gwan:(d+3)%5, in:(d+4)%5 });
const classify = (d, el) => { const g=grps(d); for(const k of Object.keys(g)) if(g[k]===el) return k; };
const isSupport = (k) => k==='bi' || k==='in';
const MECH = { bi:'support', in:'support', sik:'drain', jae:'consumption', gwan:'control' };
const FOLLOW = { gwan:'follow_killing(從殺)', jae:'follow_wealth(從財)', sik:'follow_output(從兒)' };

function computeYongsin(pillars, opts) {
  const day = pillars[2];
  const dayEl = stemEl(day.s);
  const g = grps(dayEl);
  const W = Y.strength.weights;
  const branches = pillars.map(p => p.b);

  const disrupted = branches.map((b, i) =>
    branches.some((c, j) => j !== i && M.branchRelations(b, c).includes('沖')));

  let score = 0; const rule_trace = [];
  const add = (v, label, grp) => { score += v; rule_trace.push({ label, delta: v, group: grp, mechanism: MECH[grp] }); };
  const mB = branches[1];
  const mJeong = JJG.table[mB][JJG.table[mB].length - 1][0];
  const mG = classify(dayEl, stemEl(mJeong));
  add(isSupport(mG) ? W.month_command : -W.month_command, `월령 ${mB}정기 ${mJeong}(${mG})`, mG);
  pillars.forEach((p, i) => { if (i === 1) return;
    const jeong = JJG.table[p.b][JJG.table[p.b].length - 1][0];
    const gg = classify(dayEl, stemEl(jeong));
    add(isSupport(gg) ? W.root_jeonggi : -W.root_jeonggi, `${p.b}정기 ${jeong}(${gg})`, gg);
  });
  pillars.forEach((p, i) => { if (i === 2) return;
    const gg = classify(dayEl, stemEl(p.s));
    add(isSupport(gg) ? W.stem_reveal : -W.stem_reveal, `투출 ${p.s}(${gg})`, gg);
  });

  const CHUNG = (opts && opts.chung_policy) || RS.chung_policy_2026_07_17.default;
  const chungApplied = CHUNG === 'APPLIED';
  const STRONG_MIN = RS.weights['餘氣'];

  const stemOfEl = (el) => Object.keys(RS.stem_element).find(k => EL[stemEl(k)] === EL[el]);
  const rootsOf = (el) => pillars.map((p, i) => {
    const r = RE.classifyRoot(stemOfEl(el), p.b);
    return { i, dis: disrupted[i], ...r };
  }).filter(x => x.weight > 0);

  const present = (el) => rootsOf(el).length > 0;
  const strongRoot = (el) => rootsOf(el).some(x => (!chungApplied || !x.dis) && x.weight >= STRONG_MIN);
  const visibleCount = (el) => pillars.filter(p => stemEl(p.s) === el).length;
  const functional = (el) => strongRoot(el) || visibleCount(el) >= 2;
  const dayRootEffective = strongRoot(dayEl);

  const dayRoots = rootsOf(dayEl);
  const root_evidence = {
    grades: [...new Set(dayRoots.map(r => r.evidence_grade))],
    labels: [...new Set(dayRoots.map(r => r.evidence_label))],
    detail: dayRoots.map(r => ({ branch: pillars[r.i].b, kind: r.kind, weight: r.weight,
      evidence_grade: r.evidence_grade, evidence_label: r.evidence_label, chung_disrupted: r.dis })),
    chung_policy: CHUNG,
    chung_policy_label: RS.chung_policy_2026_07_17.options[CHUNG].ui_label,
    chung_policy_status: RS.chung_policy_2026_07_17._status,
  };

  const T = Y.strength.thresholds; const abs = Math.abs(score);
  let state, confidence;
  if (abs <= T.ambiguous_abs_lte) { state = 'balanced'; confidence = 'low'; }
  else if (score >= T.strong_gte) { state = 'strong'; confidence = abs >= 6 ? 'low' : 'medium'; }
  else if (score <= T.weak_lte) { state = 'weak'; confidence = abs >= 6 ? 'low' : 'medium'; }
  else { state = score > 0 ? 'strong' : 'weak'; confidence = 'low'; }

  const reviewTrigger = abs >= Y.structure_gate.special_pattern_review_trigger_abs_gte;
  const followAbstain = !dayRootEffective && score <= -6;
  const oppForce = { sik: 0, jae: 0, gwan: 0 };
  pillars.forEach((p, i) => { const sg = classify(dayEl, stemEl(p.s)); if (oppForce[sg] != null) oppForce[sg] += 2;
    JJG.table[p.b].forEach(([s], ri) => { const rg = classify(dayEl, stemEl(s)); if (oppForce[rg] != null) oppForce[rg] += (ri === JJG.table[p.b].length - 1 ? 2 : 1); });
  });
  const oppPri = { gwan: 3, jae: 2, sik: 1 };
  const domOpp = Object.keys(oppForce).sort((a, b) => (oppForce[b] - oppForce[a]) || (oppPri[b] - oppPri[a]))[0];
  const structureGate = followAbstain ? 'abstain_normal_balance' : (reviewTrigger ? 'review_special_pattern' : 'normal');

  const sel = Y.select[state] || Y.select.balanced;
  const primary_need_ranked = (sel.need_priority || []).map(k => ({ el: EL[g[k]], elIndex: g[k], group: k }));
  let operative = null;
  for (const k of (sel.need_priority || [])) { if (functional(g[k])) { operative = { el: EL[g[k]], elIndex: g[k], group: k }; break; } }
  const gisin = (sel.gisin_group || []).map(k => ({ el: EL[g[k]], elIndex: g[k], group: k }));

  const climateEl = Y.climate.coarse_by_month_branch[mB];
  const johu = {
    climate_need: (climateEl && climateEl !== '-') ? climateEl : null,
    source: 'coarse_heuristic', full_table_status: Y.climate.full_table_status
  };

  let decision, selected_yongsin = null, special = null, conditional = null;
  const uncertainty = { alternatives: [], notes: [] };
  if (followAbstain) {
    decision = 'abstain';
    special = [FOLLOW[domOpp] || 'follow_?'];
    conditional = { strength: state, primary_need_ranked,
      operative_candidates: (sel.need_priority || []).filter(k => present(g[k])).map(k => ({ el: EL[g[k]], group: k })),
      confidence: 'low' };
    uncertainty.notes.push('일간 effective_root 없음(충 훼손 포함)+극약 → 종격 후보. 정상 억부 중단, selected=null');
  } else if (state === 'balanced') {
    decision = 'resolved_no_balance_yongsin';
    uncertainty.notes.push('중화 — 억부용신 없음도 정상');
  } else if (!operative) {
    decision = 'contested';
    uncertainty.notes.push('기능하는 용신 후보 없음');
  } else if (operative.elIndex !== (primary_need_ranked[0] && primary_need_ranked[0].elIndex)) {
    decision = 'contested'; selected_yongsin = operative; confidence = 'low';
    uncertainty.notes.push('primary_need과 operative 불일치');
  } else {
    decision = 'resolved'; selected_yongsin = operative;
  }
  if (reviewTrigger && decision !== 'abstain') {
    special = (special || []).concat('special_pattern_review_trigger'); confidence = 'low';
    uncertainty.notes.push('|score|≥6 — 구조검사 트리거(합충·근질·격국 미반영 주의)');
  }

  if (johu.climate_need && ['子','午'].includes(mB) && decision !== 'abstain') {
    uncertainty.alternatives.push({ axis: 'johu', need: johu.climate_need, note: 'critical 월령 — 조후 대안(정식표 PENDING)' });
  }

  const citation_ids = [Y.citation_span_id, Y.strength.citation_span_id, Y.climate.citation_span_id];

  return {
    engine_id: Y.engine_id, engine_version: Y.engine_version,
    decision_authority: Y.decision_authority, user_output_enabled: Y.user_output_enabled,
    input: { pillars: pillars.map(p => p.s + p.b).join(' '), dayGan: day.s, dayEl: EL[dayEl] },
    stages: {
      strength: { score, state, confidence, dayRootEffective, root_evidence },
      structure: { gate: structureGate, review_trigger: reviewTrigger, special_pattern_candidate: special },
      balance: { primary_need_ranked, operative_candidate: operative, gisin },
      johu
    },
    decision, selected_yongsin, conditional_normal_pattern_result: conditional,
    uncertainty, rule_trace, citation_ids
  };
}

function yongsinForDaily(res) {
  const usable = (res.decision === 'resolved' || res.decision === 'contested') && res.selected_yongsin;
  return {
    yongsin: usable ? res.selected_yongsin.elIndex : null,
    gisin: (usable && res.stages.balance.gisin[0]) ? res.stages.balance.gisin[0].elIndex : null,
    authoritative: false,
    decision: res.decision
  };
}

module.exports = { computeYongsin, yongsinForDaily };
