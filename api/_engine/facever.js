// 천운 — ★관상 원문 판정 엔진 (P-786-V · facever)
//
// 【무엇을 하는가】
//   계측 30축(measures) + 분위수 랭크(ranks) + 참조 모집단 등급(refTier) 을 받아
//   배포 규칙표(face_rules.json · 원문 제거본)를 **3층으로 갈라 낸다**.
//
//     VERDICT   원문이 기준을 주고 우리가 잰다 ⟹ **엔진이 판정한다**(LLM 이 못 바꾼다)
//     REFERENCE 「계측값은 이렇고, 전통 관상학은 이 부위를 이렇게 본다」 — 판정이 아니다
//     WITHHELD  화면·프롬프트에 **내보내지 않는다**
//
// 【★핵심 — 등급은 코드가 아니라 데이터가 정한다】
//   아래 tierOf() 는 규칙의 measurability · threshold_origin · condition_coverage ·
//   user_exposure 와 refTier 한 값만 본다. 규칙 id 를 분기하는 코드가 **하나도 없다.**
//
// 【★승격 규칙 (P-786-W)】
//   VERDICT   ⟸ (threshold_origin=TEXT 그리고 measurability=MEASURABLE)
//             또는 (condition_coverage=FULL 그리고 threshold_origin=POPULATION 그리고 모집단 tier∈{A,B})
//   REFERENCE ⟸ 그 밖에 축이 있는 것
//   WITHHELD  ⟸ UNMEASURABLE · BLOCKED · 조건식 부재 · 축 결손
//   ★condition_coverage=PARTIAL(부분만 덮음)은 **어떤 tier 에서도** VERDICT 가 되지 않는다.
//     부분으로 전체를 판정하는 것이 곧 원문 왜곡이기 때문이다. 필드가 없으면 PARTIAL 로 본다.
//   ⟹ 실사진 모집단(TIER-A/B)이 들어와 refTier 가 바뀌면, POPULATION 규칙은
//     **코드 수정 없이** VERDICT 로 올라간다. _v786_diag/p08_face_verdict_eval.js 가 이를 검사한다.
//
// 【fail-closed】
//   · measures 가 없거나 식이 쓰는 축이 하나라도 없으면 **판정하지 않는다.**
//   · condition.expr 이 없으면(= 원문이 컷오프를 주지 않았으면) 판정하지 않는다.
//   · UNMEASURABLE · user_exposure=BLOCKED 는 **어떤 tier 에서도** 나가지 않는다.
//     WITHHELD 레코드에는 gloss_ko · verdict_ko 를 **담지 않는다** — 담으면 새어나간다.
//
// 【인용】 서지 ID(source_edition_id · corpus_id) + 음역 locus 로만 한다. 원문은 없다.
'use strict';

const RULES = require('./face_rules.json');

const ENGINE_VERSION = 'facever/1.0.0';

const VERDICT_TIERS = Object.freeze({
  VERDICT: 'VERDICT',
  REFERENCE: 'REFERENCE',
  WITHHELD: 'WITHHELD'
});

// ★모집단 등급이 이 집합에 들면 POPULATION 임계를 판정 근거로 쓸 수 있다.
//   현재 배포 모집단은 'C-SYNTHETIC'(합성 유래)이라 들지 않는다.
const POPULATION_OK_TIERS = Object.freeze(['A', 'B']);

// ★조건 커버리지 — PARTIAL 이 뭉뚱그리던 두 성질을 가른다(P-786-W).
//   FULL    원문 조건의 **모든 어절**을 우리 축이 덮는다. 못 내는 이유가 오직 컷오프 부재뿐이다.
//           ⟹ 모집단 등급이 A·B 가 되면 정당하게 판정된다.
//   PARTIAL 조건의 일부만 덮는다. ★부분으로 전체를 판정하면 원문 왜곡이므로 **영원히 VERDICT 가 아니다.**
//   NONE    덮는 어절이 없다.
//   ★필드가 없으면 PARTIAL 로 간주한다(fail-closed).
const COVERAGE = Object.freeze({ FULL: 'FULL', PARTIAL: 'PARTIAL', NONE: 'NONE' });

function coverageOf(rule) {
  const c = rule && rule.condition_coverage;
  if (c === COVERAGE.FULL) return COVERAGE.FULL;
  if (c === COVERAGE.NONE) return COVERAGE.NONE;
  return COVERAGE.PARTIAL;                 // ★미기재·오타·미상은 전부 PARTIAL
}

const WITHHELD_REASON = Object.freeze({
  UNMEASURABLE: 'UNMEASURABLE',                     // 축이 아예 없다
  BLOCKED: 'USER_EXPOSURE_BLOCKED',                 // 노출 봉인
  NO_EXPR: 'CONDITION_NOT_EVALUABLE',               // 원문이 컷오프를 주지 않았다
  NO_MEASURE: 'MEASURE_MISSING',                    // 축 값이 없다
  NO_INPUT: 'MEASURES_ABSENT',                      // 입력 자체가 없다
  NO_AXIS: 'MEASURE_AXIS_NULL'                      // 참고로 보여 줄 축이 없다
});

/** refTier 를 한 글자 등급으로 정규화한다. 'C-SYNTHETIC'→'C' · 'TIER-A'→'A' · 'b'→'B' */
function normTier(t) {
  let s = String(t == null ? '' : t).trim().toUpperCase();
  s = s.replace(/^TIER[-_ ]?/, '');          // 'TIER-A' · 'TIER_B' · 'TIER C' → 'A'·'B'·'C'
  const m = s.match(/^([A-Z])/);             // 'C-SYNTHETIC' → 'C'
  return m ? m[1] : '';
}

function populationUsable(refTier) {
  return POPULATION_OK_TIERS.indexOf(normTier(refTier)) !== -1;
}

/**
 * ★층 결정 — 데이터만 본다.
 * @returns {{tier:string, reason:(string|null)}}
 */
function tierOf(rule, refTier) {
  if (rule.measurability === 'UNMEASURABLE') return { tier: VERDICT_TIERS.WITHHELD, reason: WITHHELD_REASON.UNMEASURABLE };
  if (rule.user_exposure === 'BLOCKED') return { tier: VERDICT_TIERS.WITHHELD, reason: WITHHELD_REASON.BLOCKED };

  // ① 원문이 스스로 기준을 준 것 — 모집단이 필요 없다.
  if (rule.measurability === 'MEASURABLE' && rule.threshold_origin === 'TEXT') {
    return { tier: VERDICT_TIERS.VERDICT, reason: null };
  }

  // ② ★업그레이드 경로 — 조건 전부를 덮는데(FULL) 「얼마나」만 없던 것.
  //    참조 모집단이 A·B 등급이면 컷오프가 정당하게 생기므로 판정으로 올린다.
  //    ★condition_coverage 가 PARTIAL·NONE 이면 어떤 tier 에서도 여기 들어오지 못한다.
  if (coverageOf(rule) === COVERAGE.FULL && rule.threshold_origin === 'POPULATION') {
    return populationUsable(refTier)
      ? { tier: VERDICT_TIERS.VERDICT, reason: null }
      : { tier: VERDICT_TIERS.REFERENCE, reason: null };   // 모집단이 C — 판정으로 쓸 수 없다
  }

  // ③ 그 밖 — 축이 있으면 참고층
  return { tier: VERDICT_TIERS.REFERENCE, reason: null };
}

// ── 조건식 평가 ──────────────────────────────────────────────────────────────
const OPS = {
  gt: (a, b) => a > b,
  gte: (a, b) => a >= b,
  lt: (a, b) => a < b,
  lte: (a, b) => a <= b
};

function num(v) { return typeof v === 'number' && isFinite(v) ? v : null; }

function operand(side, space, measures, ranks) {
  if (!side || typeof side !== 'object') return null;
  if (Object.prototype.hasOwnProperty.call(side, 'const')) return num(side.const);
  if (!side.axis) return null;
  const src = space === 'rank' ? ranks : measures;
  if (!src || typeof src !== 'object') return null;
  return num(src[side.axis]);
}

/**
 * @returns {{ok:boolean, holds:(boolean|null), reason:(string|null), left:(number|null), right:(number|null)}}
 */
function evalExpr(expr, measures, ranks, inheritedSpace) {
  // ★'all' — 원문이 한 낱말로 말했으나 우리 축이 여럿인 경우의 **보수적 결합**.
  //   항이 하나라도 평가 불가면 전체가 평가 불가다(fail-closed).
  if (expr && expr.op === 'all') {
    const terms = Array.isArray(expr.terms) ? expr.terms : [];
    if (!terms.length) return { ok: false, holds: null, reason: WITHHELD_REASON.NO_EXPR, left: null, right: null };
    const sp = expr.space === 'rank' ? 'rank' : (expr.space === 'measure' ? 'measure' : inheritedSpace);
    let holds = true, l = null, r = null;
    for (const t of terms) {
      const e = evalExpr(t, measures, ranks, sp);
      if (!e.ok) return e;
      holds = holds && e.holds; l = e.left; r = e.right;
    }
    return { ok: true, holds: holds, reason: null, left: l, right: r };
  }
  if (!expr || !OPS[expr.op]) return { ok: false, holds: null, reason: WITHHELD_REASON.NO_EXPR, left: null, right: null };
  const space = expr.space === 'rank' ? 'rank' : (expr.space === 'measure' ? 'measure' : (inheritedSpace === 'rank' ? 'rank' : 'measure'));
  const l = operand(expr.left, space, measures, ranks);
  const r = operand(expr.right, space, measures, ranks);
  if (l === null || r === null) return { ok: false, holds: null, reason: WITHHELD_REASON.NO_MEASURE, left: l, right: r };
  return { ok: true, holds: OPS[expr.op](l, r), reason: null, left: l, right: r };
}

// ── 본체 ─────────────────────────────────────────────────────────────────────
function cite(r) {
  return {
    source_edition_id: r.source_edition_id || null,
    corpus_id: r.corpus_id || null,
    locus: r.locus || null
  };
}

/**
 * @param {{measures?:object, ranks?:object, refTier?:string, rules?:Array}} input
 * @returns {{engine_version:string, refTier:string, population_usable:boolean,
 *            verdicts:Array, references:Array, withheld:Array, tally:object}}
 */
function evaluateFace(input) {
  const inp = input && typeof input === 'object' ? input : {};
  const rules = Array.isArray(inp.rules) ? inp.rules : (RULES.rules || []);
  const refTier = inp.refTier == null ? '' : String(inp.refTier);
  const coreMeasures = (inp.measures && typeof inp.measures === 'object' && !Array.isArray(inp.measures)) ? inp.measures : null;
  const ranks = (inp.ranks && typeof inp.ranks === 'object' && !Array.isArray(inp.ranks)) ? inp.ranks : null;

  // ★P-786-I — 센서 축(색·텍스처) 병합. 규약은 _v786_diag/sensor_flatten.js 가 정한다.
  //   · 접두사 col_/tex_ 가 아닌 키는 받지 않는다 (센서 채널로 랜드마크 축을 덮어쓰는 것을 막는다).
  //   · 랜드마크 축과 키가 겹치면 **센서 전체를 버린다**(fail-closed). 게이트 p08 I-7 이 검사한다.
  //   · 센서 축에는 ranks 가 없다 ⟹ space=rank 조건식은 NO_MEASURE 로 떨어진다. 참고층까지만 간다.
  const sensor = mergeSensorMeasures(coreMeasures, inp.sensorMeasures);
  const measures = sensor.measures;

  const verdicts = [], references = [], withheld = [];

  for (const r of rules) {
    const t = tierOf(r, refTier);

    // ① 봉인층 — 어떤 tier 에서도, 입력이 무엇이든 여기서 끝난다. 본문은 담지 않는다.
    if (t.tier === VERDICT_TIERS.WITHHELD) {
      withheld.push({ rule_id: r.rule_id, reason: t.reason });
      continue;
    }

    // ② 입력이 없으면 아무것도 내지 않는다 (fail-closed)
    if (!measures) {
      withheld.push({ rule_id: r.rule_id, reason: WITHHELD_REASON.NO_INPUT });
      continue;
    }

    if (t.tier === VERDICT_TIERS.VERDICT) {
      const expr = r.condition && r.condition.expr;
      const ev = evalExpr(expr, measures, ranks);
      if (!ev.ok) {
        // ★조건을 해석할 수 없으면 추측하지 않고 떨어뜨린다.
        withheld.push({ rule_id: r.rule_id, reason: ev.reason });
        continue;
      }
      verdicts.push({
        rule_id: r.rule_id,
        doctrine_id: r.doctrine_id || null,
        citation: cite(r),
        gloss_ko: r.gloss_ko || '',
        verdict_code: r.verdict_code || null,
        verdict_ko: r.verdict_ko || '',
        holds: ev.holds,
        basis: r.threshold_origin,
        coverage: coverageOf(r),
        space: (expr.space === 'rank' ? 'rank' : 'measure'),
        measure_axis: r.measure_axis || null,
        left: ev.left,
        right: ev.right,
        refTier: refTier
      });
      continue;
    }

    // ③ 참고층 — 계측값이 있어야 참고로서 뜻이 있다. 없으면 내보내지 않는다.
    const ax = r.measure_axis;
    if (!ax) { withheld.push({ rule_id: r.rule_id, reason: WITHHELD_REASON.NO_AXIS }); continue; }
    const val = num(measures[ax]);
    if (val === null) { withheld.push({ rule_id: r.rule_id, reason: WITHHELD_REASON.NO_MEASURE }); continue; }
    references.push({
      rule_id: r.rule_id,
      doctrine_id: r.doctrine_id || null,
      citation: cite(r),
      gloss_ko: r.gloss_ko || '',
      verdict_code: r.verdict_code || null,
      verdict_ko: r.verdict_ko || '',
      measure_axis: ax,
      value: val,
      rank: ranks ? num(ranks[ax]) : null,
      measurability: r.measurability,
      threshold_origin: r.threshold_origin,
      coverage: coverageOf(r),
      refTier: refTier
    });
  }

  const byReason = {};
  for (const w of withheld) byReason[w.reason] = (byReason[w.reason] || 0) + 1;

  return {
    engine_version: ENGINE_VERSION,
    artifact_version: RULES.artifact_version || null,
    refTier: refTier,
    population_usable: populationUsable(refTier),
    sensor: sensor.info,
    verdicts: verdicts,
    references: references,
    withheld: withheld,
    tally: {
      rules_total: rules.length,
      verdict: verdicts.length,
      verdict_holds: verdicts.filter((v) => v.holds === true).length,
      verdict_not_holds: verdicts.filter((v) => v.holds === false).length,
      reference: references.length,
      withheld: withheld.length,
      withheld_by_reason: byReason
    }
  };
}

// ── 센서 축 병합 (P-786-I) ───────────────────────────────────────────────────
const SENSOR_KEY_RE = /^(col|tex)_[A-Za-z0-9_]+$/;

/**
 * @returns {{measures:(object|null), info:{offered:number, accepted:number, rejected_prefix:number, collision:string[], dropped_all:boolean}}}
 */
function mergeSensorMeasures(core, sensorIn) {
  const info = { offered: 0, accepted: 0, rejected_prefix: 0, collision: [], dropped_all: false };
  const s = (sensorIn && typeof sensorIn === 'object' && !Array.isArray(sensorIn)) ? sensorIn : null;
  if (!s) return { measures: core, info: info };
  const keys = Object.keys(s);
  info.offered = keys.length;
  const ok = {};
  for (const k of keys) {
    if (!SENSOR_KEY_RE.test(k)) { info.rejected_prefix++; continue; }
    if (core && Object.prototype.hasOwnProperty.call(core, k)) { info.collision.push(k); continue; }
    const v = s[k];
    if (typeof v !== 'number' || !isFinite(v)) continue;
    ok[k] = v;
  }
  if (info.collision.length) {
    // ★한 키라도 랜드마크 축과 겹치면 센서 입력 전체를 신뢰하지 않는다.
    info.dropped_all = true;
    return { measures: core, info: info };
  }
  info.accepted = Object.keys(ok).length;
  if (!info.accepted) return { measures: core, info: info };
  // ★센서만 있고 랜드마크 축이 없으면 판정하지 않는다 — 센서는 보조 채널이다.
  if (!core) { info.dropped_all = true; info.accepted = 0; return { measures: null, info: info }; }
  return { measures: Object.assign({}, core, ok), info: info };
}

// ── 프롬프트 블록 ────────────────────────────────────────────────────────────
// bind.js factsBlock 과 같은 성질: 라벨 화이트리스트를 벗어난 줄이 섞이면 **블록 전체를 버린다**.
const HEAD_VERDICT = '【관상 엔진 판정 — 확정값. 그대로 사용하고 바꾸거나 다시 판단하지 마세요.】';
const HEAD_REFERENCE = '【참고 — 계측값과 전통 관점. ★판정이 아닙니다. 단정하지 마세요.】';
const LINE_PREFIX = '· [';

function fmt(v) { return (Math.round(v * 1000) / 1000).toString(); }

function factsBlockFace(result) {
  if (!result || typeof result !== 'object') return '';
  const V = Array.isArray(result.verdicts) ? result.verdicts : [];
  const R = Array.isArray(result.references) ? result.references : [];
  if (!V.length && !R.length) return '';

  const lines = [];
  const body = [];

  if (V.length) {
    lines.push(HEAD_VERDICT);
    for (const v of V) {
      const l = LINE_PREFIX + v.rule_id + '] ' +
        (v.holds ? '성립' : '불성립') + ' — 조건: ' + (v.gloss_ko || '(뜻풀이 없음)') +
        (v.holds ? ' / 원문 결과: ' + (v.verdict_ko || '(요약 없음)') : ' / 이 조건에 해당하지 않음') +
        ' (근거 ' + (v.citation.source_edition_id || '?') + ' ' + (v.citation.locus || '?') + ')';
      lines.push(l); body.push(l);
    }
  }
  if (R.length) {
    lines.push(HEAD_REFERENCE);
    for (const r of R) {
      const l = LINE_PREFIX + r.rule_id + '] 계측 ' + r.measure_axis + '=' + fmt(r.value) +
        (r.rank == null ? '' : ' (분위 ' + Math.round(r.rank * 100) + '%)') +
        ' · 전통 관점: ' + (r.gloss_ko || '(뜻풀이 없음)') +
        (r.verdict_ko ? ' ⟹ ' + r.verdict_ko : '') +
        ' (근거 ' + (r.citation.source_edition_id || '?') + ' ' + (r.citation.locus || '?') + ' · 판정 아님)';
      lines.push(l); body.push(l);
    }
  }

  // ★출구 검사 — 본문 줄은 전부 '· [' 로 시작해야 한다(접두사 일치). 아니면 블록 전체를 버린다.
  for (const l of body) if (l.indexOf(LINE_PREFIX) !== 0) return '';
  return lines.join('\n');
}

// ── 응답 덮어쓰기 ────────────────────────────────────────────────────────────
// bind.js applyEngineFacts 와 같은 성질 — 프롬프트 지시만으로는 부족하다.
// LLM 이 만든 관상 판정 중 **엔진 VERDICT 에 없는 것은 버린다.**
// 서술(meaning)만 LLM 것을 위치(rule_id)로 매칭해 남긴다.
function pickString(v) { return typeof v === 'string' ? v : ''; }

/**
 * @returns {{applied:string[], kept:number, dropped:number, blocked:number}|null}
 */
function applyFaceVerdicts(parsed, result) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  if (!result || typeof result !== 'object') return null;

  const V = Array.isArray(result.verdicts) ? result.verdicts : [];
  const R = Array.isArray(result.references) ? result.references : [];
  const blockedIds = new Set((result.withheld || []).map((w) => w.rule_id));

  const applied = [];
  let kept = 0, dropped = 0, blocked = 0;

  if (Object.prototype.hasOwnProperty.call(parsed, 'faceVerdicts')) {
    const llm = Array.isArray(parsed.faceVerdicts) ? parsed.faceVerdicts : [];
    const used = new Set();
    parsed.faceVerdicts = V.map((v) => {
      let src = null;
      for (let i = 0; i < llm.length; i++) {
        if (used.has(i) || !llm[i]) continue;
        if (pickString(llm[i].rule_id) === v.rule_id) { src = llm[i]; used.add(i); break; }
      }
      if (src) kept++;
      return {
        rule_id: v.rule_id,
        holds: v.holds,
        condition: v.gloss_ko,
        verdict: v.verdict_ko,
        citation_ref: v.citation.source_edition_id + ' ' + v.citation.locus,
        meaning: pickString(src && src.meaning)
      };
    });
    for (let i = 0; i < llm.length; i++) {
      if (used.has(i)) { continue; }
      dropped++;
      if (llm[i] && blockedIds.has(pickString(llm[i].rule_id))) blocked++;
    }
    applied.push('faceVerdicts');
  }

  if (Object.prototype.hasOwnProperty.call(parsed, 'faceReferences')) {
    const llm = Array.isArray(parsed.faceReferences) ? parsed.faceReferences : [];
    const used = new Set();
    parsed.faceReferences = R.map((r) => {
      let src = null;
      for (let i = 0; i < llm.length; i++) {
        if (used.has(i) || !llm[i]) continue;
        if (pickString(llm[i].rule_id) === r.rule_id) { src = llm[i]; used.add(i); break; }
      }
      if (src) kept++;
      return {
        rule_id: r.rule_id,
        measure_axis: r.measure_axis,
        value: r.value,
        tradition: r.gloss_ko,
        citation_ref: r.citation.source_edition_id + ' ' + r.citation.locus,
        note: pickString(src && src.note)
      };
    });
    for (let i = 0; i < llm.length; i++) {
      if (used.has(i)) continue;
      dropped++;
      if (llm[i] && blockedIds.has(pickString(llm[i].rule_id))) blocked++;
    }
    applied.push('faceReferences');
  }

  return { applied: applied, kept: kept, dropped: dropped, blocked: blocked };
}

module.exports = {
  evaluateFace: evaluateFace,
  VERDICT_TIERS: VERDICT_TIERS,
  factsBlockFace: factsBlockFace,
  applyFaceVerdicts: applyFaceVerdicts,
  // 진단·게이트용 재노출
  POPULATION_OK_TIERS: POPULATION_OK_TIERS,
  WITHHELD_REASON: WITHHELD_REASON,
  ENGINE_VERSION: ENGINE_VERSION,
  tierOf: tierOf,
  mergeSensorMeasures: mergeSensorMeasures,
  SENSOR_KEY_RE: SENSOR_KEY_RE,
  COVERAGE: COVERAGE,
  coverageOf: coverageOf,
  normTier: normTier,
  populationUsable: populationUsable,
  RULES: RULES
};
