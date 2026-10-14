// 생성물(P-805-D build_shadow_dist) — 수정 금지. 원본은 IP.


'use strict';
const { computeYongsin } = require('./yongsin_engine');
const { computeGyeokguk } = require('./gyeokguk_engine');
const { assess } = require('./chung_conditional');
const { computeDaewoon } = require('./daewoon');
const { computeSinsal } = require('./sinsal_engine');
const { computeJohu } = require('./johu_engine');
const authority = require('./authority');

function computeSajuReading(pillars, opts = {}) {
  const gender = opts.gender || 'male';
  const bal = computeYongsin(pillars);
  const gyeok = computeGyeokguk(pillars);

  let gyeokProtection = null;
  const isGwanGyeok = (gyeok.sipsin === '정관' || gyeok.sipsin === '편관');
  if (isGwanGyeok && gyeok.decision !== 'special_pattern') {
    const wolgwan = { branch: pillars[1].b, pos: 1 };
    const wp = (assess(pillars, [], { wolgwan }) || {}).wolgwan_protection || null;
    if (wp && wp.applicable === true && (wp.integrity === 'INTACT' || wp.integrity === 'ACTIVE')) {
      const broken = wp.gyeok_status === '破格';
      gyeokProtection = {
        source: 'chung_conditional 以刑衝解刑衝(결정 29-C · C-2 안 A)',
        wolgwan, applicable: true,
        integrity: wp.integrity, gyeok_status: wp.gyeok_status,
        seong_pae_original: gyeok.seong_pae,
        seong_pae_corrected: broken ? '破格(刑冲用神 — 加害 卯 견인 부재)' : '格不破(用神 刑 解 — 以刑衝解刑衝)',
        correction_applied: true, basis: 'textual_rule',
        ...(wp.resolution ? { resolution: wp.resolution } : {}),
        ...(wp.threat ? { threat: wp.threat } : {}),
        anchor_grade: wp.grade,
        authority: 'NON_AUTHORITATIVE', diagnostic_only: true, user_output_enabled: false,
        note: '用神(月官) 刑冲 축 보정 — gyeokguk 상신/병 축(원 산출)과 독립. 안 A: 官星격·月官∈{子,酉}·子卯刑 한정.'
      };
    } else if (wp) {
      gyeokProtection = {
        source: 'chung_conditional 以刑衝解刑衝(결정 29-C · C-2 안 A)',
        wolgwan, applicable: false, integrity: wp.integrity || 'SCOPE', correction_applied: false,
        seong_pae_original: gyeok.seong_pae, seong_pae_corrected: gyeok.seong_pae, basis: 'textual_rule',
        note: wp.note || '以刑衝解刑衝 미적용(범위 밖) — seong_pae 보정 없음.',
        authority: 'NON_AUTHORITATIVE', diagnostic_only: true, user_output_enabled: false
      };
    }
  }
  const johu = computeJohu(pillars);
  const climateEl = johu.johu_element;
  const daewoon = computeDaewoon(pillars[0].s, pillars[1], gender,
    { startAge: opts.startAge, birth: opts.birth });
  const sinsal = computeSinsal(pillars);

  const balanceYong = bal.selected_yongsin ? bal.selected_yongsin.el : null;
  const structureSangsin = (gyeok.sangsin || []).map(s => s.el);
  const balanceAbstain = bal.decision === 'abstain';
  const structureSpecial = gyeok.decision === 'special_pattern';

  const agreements = [];
  let level;
  if (balanceAbstain || structureSpecial) {
    level = 'special_abstain';
    agreements.push('특수 구조(외격/양인) — 정식 판정 유보, 전문가/정답셋 필요');
  } else {

    const sameEl = balanceYong && structureSangsin.includes(balanceYong);
    if (sameEl) agreements.push(`억부 용신 元素(${balanceYong}) = 격국 상신 元素 — 단, 역할 동일 여부는 전문가 검토 필요(같은 오행이라도 생조/보호/조후 역할이 다를 수 있음)`);

    level = sameEl ? 'same_element_shared_pending_review' : 'divergent';
    if (level === 'divergent') agreements.push('세 축의 권장 오행이 갈림 — cross_doctrine_conflict 보존(다수결 금지)');
  }

  const citation_ids = Array.from(new Set([
    ...bal.citation_ids, ...gyeok.citation_ids, ...sinsal.citation_ids,
    ...johu.citation_ids, 'SRC_ZPJZ_A_DAEWOON'
  ]));

  return {
    decision_authority: 'NON_AUTHORITATIVE',
    user_output_enabled: false,

    authority_scopes: authority.tag(['pillars', 'daewoon_direction', 'daewoon_start_age', 'yongsin', 'gyeok', 'sangsin', 'johu', 'sipsin', 'sinsal', 'verdict']),
    real_world_prediction_authority: false,
    input: { pillars: pillars.map(p => p.s + p.b).join(' '), gender },
    axes: {
      balance: { state: bal.stages.strength.state, decision: bal.decision, yongsin: balanceYong, gisin: bal.stages.balance.gisin.map(x => x.el) },
      structure: { gyeok: gyeok.gyeok, use: gyeok.use || null, sangsin: structureSangsin, primary_sangsin_candidate: gyeok.primary_sangsin_candidate ? gyeok.primary_sangsin_candidate.el : null, selected_sangsin: gyeok.selected_sangsin ?? null, sangsin_verification: gyeok.verification || 'EXPERT_PENDING', seong_pae: gyeok.seong_pae || null, decision: gyeok.decision },
      climate: {
        johu_yongsin: johu.johu_yongsin, johu_element: climateEl, aux: johu.aux, present: johu.present,
        source: 'gtbg_table', status: johu.status,
        resolver_influence: false, source_review_required: true, review_flag: johu.review_flag,
        note: '조후 조견표 산출. 원문 대조 오류 다수 확인(외부검증) — 정식 판정 비영향, 전수 재컴파일 대기'
      }
    },

    daewoon: {
      direction: daewoon.direction,
      start_age_shadow: daewoon.startAge,
      start_age_user_surfaceable: false,
      start_age_reason: daewoon.user_surface ? daewoon.user_surface.start_age_reason : 'PRECISE_SOLAR_TERM_TIME_REQUIRED',
      daesu_meta: daewoon.daesu_meta,
      list: daewoon.list.map(d => (d.age != null ? d.age + '세 ' : '') + d.ganji)
    },
    sinsal: sinsal.list.map(s => `${s.name}(${s.at}지 ${s.branch})`),
    concordance: { level, balance_yongsin: balanceYong, structure_sangsin: structureSangsin, climate_johu: climateEl, agreements },
    uncertainty: { notes: ['3축 모두 shadow(비권위). 정식 사주 용신·격국 판정은 전문가 정답셋·원문 검증 이후.'] },
    ...(gyeokProtection ? { gyeok_protection: gyeokProtection } : {}),
    citation_ids
  };
}

module.exports = { computeSajuReading };
