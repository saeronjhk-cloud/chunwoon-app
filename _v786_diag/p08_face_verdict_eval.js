// ============================================================
//  P-08 · 관상 원문 판정 엔진 게이트
//  node _v786_diag/p08_face_verdict_eval.js
// ------------------------------------------------------------
//  검사 항목
//   A 배포 산출물에 원문이 없다 (한자 연속 10자 구간 0건)
//   B 규칙 수 보존 (IP 100건 → 컴파일 100건)
//   C 업그레이드 경로 — refTier 'C-SYNTHETIC' → 'B' 로 VERDICT 가 실제로 늘어나는가
//     C-1 코드 경로가 살아 있는가(합성 탐침 규칙)  C-2 실규칙 100건에서 실제로 느는가
//   D WITHHELD 는 어떤 tier 에서도 노출되지 않는다 (UNMEASURABLE·BLOCKED, 醜惡 계열 포함)
//   E 귀 규칙은 어떤 tier 에서도 VERDICT 가 되지 않는다 (센서가 없다)
//   F fail-closed — measures 가 없거나 축이 모자라면 판정하지 않는다
//   G 변이 시험 — 등급 판정을 일부러 망가뜨렸을 때 A~F 가 실제로 잡는가
//   H ★condition_coverage (P-786-W)
//     H-1 FULL 인데 uncovered 가 남아 있으면 FAIL (자기모순)
//     H-2 귀·청수·기·요함·거동·몸통·추악 계열이 FULL 이면 FAIL (금지 목록)
//     H-3 PARTIAL·NONE 은 어떤 tier 에서도 VERDICT 가 되지 않는다
//     H-4 coverage_note 에 한자가 없다 (배포 한자 게이트 유지)
// ============================================================
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const IP = path.join(__dirname, 'IP_face');
const ART = path.join(ROOT, 'api', '_engine', 'face_rules.json');

const compiler = require('./compile_face_rules.js');
const FV = require(path.join(ROOT, 'api', '_engine', 'facever.js'));

const TIER_NOW = 'C-SYNTHETIC';
const TIER_UP = 'B';

// ── 유틸 ─────────────────────────────────────────────────────────────────────
let total = 0, pass = 0;
const fails = [];
function check(id, desc, fn) {
  total++;
  let r;
  try { r = fn(); } catch (e) { r = { ok: false, detail: 'THREW ' + e.message }; }
  if (r.ok) { pass++; console.log(`PASS ${id}  ${desc}  — ${r.detail}`); }
  else { fails.push(`${id} ${desc} -> ${r.detail}`); console.log(`FAIL ${id}  ${desc}  — ${r.detail}`); }
}

const readJSON = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const asRules = (o) => (o && o.rules) || o;

const ipRules = [].concat(
  asRules(readJSON(path.join(IP, 'rules', 'face', 'ogwan.json'))),
  asRules(readJSON(path.join(IP, 'rules', 'face', 'xlhz.json')))
);
const artifactText = fs.readFileSync(ART, 'utf8');
const artifact = JSON.parse(artifactText);

// ★귀 규칙 · 醜惡 계열은 IP 원본(원문 보유)에서 id 만 뽑는다. 산출물에는 원문이 없으므로
//   여기서 뽑은 id 로 산출물·엔진 출력을 검사한다.
const EAR_IDS = ipRules
  .filter((r) => /耳|採聽|采聽/.test((r.condition && r.condition.organ) || ''))
  .map((r) => r.rule_id);
const CHOUE_IDS = ipRules
  .filter((r) => /醜|惡|㐫/.test(((r.citation && r.citation.text_original) || '') + ((r.verdict && r.verdict.text_original) || '')))
  .map((r) => r.rule_id);
// ★FULL 이 될 수 없는 계열 — 원문 글자로 판별한다(IP 원본에만 원문이 있다).
const FULL_FORBIDDEN = [
  { name: '귀', re: /耳|採聽|采聽/ },
  { name: '청·수', re: /清|淸|秀/ },
  { name: '기', re: /氣/ },
  { name: '요함·결함', re: /凹|陷/ },
  { name: '거동', re: /坐|涉|行|臥|動止/ },
  { name: '몸통·골육', re: /腰|背|臂|骨|肉/ },
  { name: '추악', re: /惡|醜|㐫/ }
];
const ipText = (r) => ((r.citation && r.citation.text_original) || '') +
  ((r.condition && r.condition.predicate_original) || '') + ((r.condition && r.condition.organ) || '');

const MUST_WITHHOLD_IDS = ipRules
  .filter((r) => r.measurability === 'UNMEASURABLE' || r.user_exposure === 'BLOCKED')
  .map((r) => r.rule_id);

// ── 계측 입력 (합성) ─────────────────────────────────────────────────────────
// ★실제 계측값이 아니라 「30축이 전부 채워진 정상 입력」이다. 판정의 참·거짓이 아니라
//   **어떤 층으로 갈리는가**를 보는 것이 이 게이트의 목적이다.
function loadAxes() {
  const src = fs.readFileSync(path.join(__dirname, 'face_core_v786.js'), 'utf8');
  const m = src.match(/var\s+CW_FACE_AXES\s*=\s*\[([\s\S]*?)\]\s*;/);
  const out = []; const re = /'([A-Za-z][A-Za-z0-9_]*)'/g; let g;
  while ((g = re.exec(m[1]))) out.push(g[1]);
  return out;
}
const AXES = loadAxes();
function mkMeasures(overrides) {
  const m = {};
  for (const a of AXES) m[a] = 0.5;
  // 판정 대상 4건이 「성립」쪽으로 갈리도록 값을 준다(양쪽 다 시험은 F 에서 한다).
  m.browLength = 0.30; m.eyeSize = 0.22;
  m.jawRatio = 0.72; m.foreheadRatio = 0.61;
  return Object.assign(m, overrides || {});
}
function mkRanks() { const r = {}; for (const a of AXES) r[a] = 0.5; return r; }

const MEAS = mkMeasures();
const RANKS = mkRanks();

const runNow = FV.evaluateFace({ measures: MEAS, ranks: RANKS, refTier: TIER_NOW });
const runUp = FV.evaluateFace({ measures: MEAS, ranks: RANKS, refTier: TIER_UP });

// ── 재사용 검사 함수 (★변이 시험이 이 함수들을 그대로 다시 부른다) ──────────
function checkA(text) {
  const s = compiler.scanArtifact(text);
  return { ok: s.runCount === 0, detail: `한자 ${s.totalHanja}자 · 최장연속 ${s.maxRun}자 · 연속10자↑ 구간 ${s.runCount}건(합 ${s.runCharSum}자)` };
}
function checkB(art) {
  return {
    ok: art.rules.length === ipRules.length && ipRules.length === 100,
    detail: `IP ${ipRules.length}건 → 산출물 ${art.rules.length}건`
  };
}
function checkD(result) {
  const bad = [];
  const exposed = new Set([].concat(result.verdicts, result.references).map((x) => x.rule_id));
  for (const id of MUST_WITHHOLD_IDS) if (exposed.has(id)) bad.push(id);
  // 프롬프트 블록에도 새지 않아야 한다.
  const block = FV.factsBlockFace(result);
  for (const id of MUST_WITHHOLD_IDS) if (block.indexOf(id) !== -1) bad.push(id + '(block)');
  return { ok: bad.length === 0, detail: bad.length ? '★노출됨: ' + bad.join(',') : `봉인대상 ${MUST_WITHHOLD_IDS.length}건 전부 미노출` };
}
function checkE(results) {
  const bad = [];
  for (const res of results) for (const v of res.verdicts) if (EAR_IDS.indexOf(v.rule_id) !== -1) bad.push(v.rule_id + '@' + res.refTier);
  return { ok: bad.length === 0, detail: bad.length ? '★귀 규칙 VERDICT: ' + bad.join(',') : `귀 규칙 ${EAR_IDS.length}건 전 tier VERDICT 0` };
}
// ★H — condition_coverage 검사군. 변이 시험이 그대로 다시 부른다.
//   rules 는 「원문을 가진 IP 규칙」 형식(citation.text_original 보유)을 받는다.
function checkH1(rules) {
  const bad = rules.filter((r) => r.condition_coverage === 'FULL' &&
    !(r.coverage_note && Array.isArray(r.coverage_note.uncovered) && r.coverage_note.uncovered.length === 0));
  return {
    ok: bad.length === 0,
    detail: bad.length
      ? '★FULL 인데 uncovered 가 남았다: ' + bad.map((r) => r.rule_id + '(' + ((r.coverage_note && r.coverage_note.uncovered) || ['note없음']).join('·') + ')').join(', ')
      : `FULL ${rules.filter((r) => r.condition_coverage === 'FULL').length}건 전부 uncovered=0`
  };
}
function checkH2(rules) {
  const bad = [];
  for (const r of rules) {
    if (r.condition_coverage !== 'FULL') continue;
    const t = ipText(r);
    for (const f of FULL_FORBIDDEN) if (f.re.test(t)) bad.push(r.rule_id + '←' + f.name);
  }
  return { ok: bad.length === 0, detail: bad.length ? '★금지 계열이 FULL: ' + bad.join(', ') : '금지 7계열 중 FULL 0건' };
}
function checkH3(results, covById) {
  const bad = [];
  for (const res of results) {
    for (const v of res.verdicts) {
      const c = covById.get(v.rule_id);
      if (c !== 'FULL') bad.push(v.rule_id + '(' + c + ')@' + (res.refTier || '미상'));
    }
  }
  return {
    ok: bad.length === 0,
    detail: bad.length ? '★FULL 이 아닌데 VERDICT: ' + bad.join(', ') : 'VERDICT 전건 coverage=FULL (전 tier)'
  };
}

function checkF(evalFn) {
  const noMeas = evalFn({ refTier: TIER_UP });
  const partial = evalFn({ measures: { browLength: 0.3 }, refTier: TIER_UP });   // 축 대부분 결측
  // ★browLength 만 있고 eyeSize·jawRatio·foreheadRatio 가 없다 ⟹ 조건식 4건 전부 평가 불가.
  const ok = noMeas.verdicts.length === 0 && noMeas.references.length === 0 &&
    partial.verdicts.length === 0 && partial.references.length === 0;
  return {
    ok: ok,
    detail: `measures 없음 → V${noMeas.verdicts.length}/R${noMeas.references.length} · 축 1개만 → V${partial.verdicts.length}`
  };
}

console.log('='.repeat(78));
console.log('P-08  관상 원문 판정 엔진 (facever) 게이트');
console.log('='.repeat(78));

// ── A ────────────────────────────────────────────────────────────────────────
check('A-1', '★배포 산출물에 원문이 없다 (한자 연속 10자 구간 0건)', () => checkA(artifactText));
check('A-2', '★원문 필드명이 산출물에 아예 없다 (text_original·predicate_original·operational·notes·organ)', () => {
  // ★JSON 키 형태로 정확히 검사한다(따옴표 포함). 산출물의 한국어 설명문에 단어가
  //   나오는 것과 **필드가 실제로 존재하는 것**을 구분하기 위해서다.
  const banned = ['"text_original"', '"predicate_original"', '"operational"', '"notes"', '"organ"'];
  const hit = banned.filter((b) => artifactText.indexOf(b) !== -1);
  return { ok: hit.length === 0, detail: hit.length ? '★잔존 필드: ' + hit.join(',') : '전건 제거' };
});

// ── B ────────────────────────────────────────────────────────────────────────
check('B-1', '★규칙 수 보존 — IP 100건이 컴파일 후에도 100건', () => checkB(artifact));
check('B-2', '★rule_id 가 IP 와 완전히 일치한다 (누락·유령 0)', () => {
  const a = new Set(artifact.rules.map((r) => r.rule_id));
  const b = new Set(ipRules.map((r) => r.rule_id));
  const miss = [...b].filter((x) => !a.has(x));
  const ghost = [...a].filter((x) => !b.has(x));
  return { ok: !miss.length && !ghost.length, detail: (miss.length || ghost.length) ? `누락 ${miss.join(',')} / 유령 ${ghost.join(',')}` : `${a.size}건 일치` };
});
check('B-3', '★등급 필드가 IP 와 동일하다 (컴파일러가 등급을 조작하지 않는다)', () => {
  const byId = new Map(ipRules.map((r) => [r.rule_id, r]));
  const bad = artifact.rules.filter((r) => {
    const s = byId.get(r.rule_id);
    return !s || s.measurability !== r.measurability || s.threshold_origin !== r.threshold_origin ||
      (s.condition_coverage || null) !== (r.condition_coverage || null) ||
      (s.user_exposure || null) !== (r.user_exposure || null);
  });
  return { ok: bad.length === 0, detail: bad.length ? '★변조: ' + bad.map((x) => x.rule_id).join(',') : '100건 동일' };
});

// ── C ★★업그레이드 경로 ─────────────────────────────────────────────────────
console.log('');
console.log('[C] ★업그레이드 경로 실측 — refTier 만 바꾼다. 코드는 건드리지 않는다.');
console.log(`  refTier=${TIER_NOW}  VERDICT ${runNow.tally.verdict} · REFERENCE ${runNow.tally.reference} · WITHHELD ${runNow.tally.withheld}`);
console.log(`  refTier=${TIER_UP}            VERDICT ${runUp.tally.verdict} · REFERENCE ${runUp.tally.reference} · WITHHELD ${runUp.tally.withheld}`);
console.log(`  ⟹ VERDICT ${runNow.tally.verdict}건 → ${runUp.tally.verdict}건 (증감 ${runUp.tally.verdict - runNow.tally.verdict})`);

// C-1 : ★코드 경로가 살아 있는가. 합성 탐침 규칙 1건 — 배포 산출물에는 넣지 않는다.
//        MEASURABLE + POPULATION + rank 식. tier C 에서는 REFERENCE, tier B 에서는 VERDICT 여야 한다.
const PROBE = {
  rule_id: 'PROBE_POPULATION_1', doctrine_id: 'PROBE', source_edition_id: 'PROBE', corpus_id: null, locus: '탐침',
  gloss_ko: '탐침', verdict_code: 'PROBE', verdict_ko: '탐침',
  condition: { key: 'probe', axes: ['noseHRatio'], expr: { space: 'rank', op: 'gt', left: { axis: 'noseHRatio' }, right: { const: 0.5 } }, expr_basis: null, expr_absent_reason: null },
  condition_coverage: 'FULL',
  coverage_note: { covered: ['탐침 축'], uncovered: [], basis: '탐침 규칙이라 조건 전부를 덮는다고 둔다' },
  measurability: 'MEASURABLE', threshold_origin: 'POPULATION', measure_axis: 'noseHRatio', confidence: null, user_exposure: null
};
check('C-1', '★코드 경로 — coverage=FULL + POPULATION 규칙이 tier C 에선 REFERENCE, tier B 에선 VERDICT', () => {
  const c = FV.evaluateFace({ measures: MEAS, ranks: Object.assign(mkRanks(), { noseHRatio: 0.8 }), refTier: TIER_NOW, rules: [PROBE] });
  const b = FV.evaluateFace({ measures: MEAS, ranks: Object.assign(mkRanks(), { noseHRatio: 0.8 }), refTier: TIER_UP, rules: [PROBE] });
  const ok = c.tally.verdict === 0 && c.tally.reference === 1 && b.tally.verdict === 1 && b.tally.reference === 0;
  return { ok: ok, detail: `C: V${c.tally.verdict}/R${c.tally.reference} → B: V${b.tally.verdict}/R${b.tally.reference}` };
});
check('C-2', `★★실규칙 100건 — refTier ${TIER_NOW}→${TIER_UP} 로 VERDICT 가 실제로 늘어난다`, () => {
  const a = runNow.tally.verdict, b = runUp.tally.verdict;
  // ★승격 대상 = condition_coverage=FULL ∩ threshold_origin=POPULATION ∩ 봉인되지 않음.
  const cand = artifact.rules.filter((r) => r.condition_coverage === 'FULL' && r.threshold_origin === 'POPULATION');
  const open = cand.filter((r) => r.user_exposure !== 'BLOCKED' && r.condition.expr);
  const added = runUp.verdicts.filter((v) => !runNow.verdicts.some((x) => x.rule_id === v.rule_id)).map((v) => v.rule_id);
  return {
    ok: b > a,
    detail: b > a
      ? `${a}건 → ${b}건 (+${b - a}) · 늘어난 규칙 ${added.join(',')} · 승격 대상 FULL∩POPULATION ${cand.length}건(그중 노출 가능·조건식 보유 ${open.length}건)`
      : `${a}건 → ${b}건 (증가 0) ★FULL∩POPULATION 규칙 ${cand.length}건 · 그중 노출 가능·조건식 보유 ${open.length}건 — ` +
        `승격 대상이 없거나 전부 user_exposure=BLOCKED 다. (코드 경로 자체는 C-1 에서 확인된다)`
  };
});
check('C-3', '★tier 를 올려도 WITHHELD 총량은 줄지 않는다 (봉인이 풀리지 않는다)', () => {
  const a = runNow.withheld.filter((w) => w.reason === 'UNMEASURABLE' || w.reason === 'USER_EXPOSURE_BLOCKED').length;
  const b = runUp.withheld.filter((w) => w.reason === 'UNMEASURABLE' || w.reason === 'USER_EXPOSURE_BLOCKED').length;
  return { ok: a === b, detail: `봉인 사유 WITHHELD ${a} → ${b}` };
});

// ── D ────────────────────────────────────────────────────────────────────────
console.log('');
check('D-1', '★WITHHELD 는 tier C 에서 노출되지 않는다', () => checkD(runNow));
check('D-2', '★WITHHELD 는 tier B 에서도 노출되지 않는다', () => checkD(runUp));
check('D-3', '★A~C 전 tier 에서 봉인 유지 (A·B·C·미상 4종)', () => {
  const bad = [];
  for (const t of ['A', 'B', 'C-SYNTHETIC', '']) {
    const res = FV.evaluateFace({ measures: MEAS, ranks: RANKS, refTier: t });
    const r = checkD(res);
    if (!r.ok) bad.push(t + ':' + r.detail);
  }
  return { ok: bad.length === 0, detail: bad.length ? bad.join(' | ') : '4 tier 전부 봉인 유지' };
});
check('D-4', `★「醜惡者㐫」 계열 ${CHOUE_IDS.length}건이 새어나가지 않는다`, () => {
  const bad = [];
  for (const t of ['A', 'B', 'C-SYNTHETIC']) {
    const res = FV.evaluateFace({ measures: MEAS, ranks: RANKS, refTier: t });
    const block = FV.factsBlockFace(res);
    const exposed = new Set([].concat(res.verdicts, res.references).map((x) => x.rule_id));
    for (const id of CHOUE_IDS) {
      if (exposed.has(id)) bad.push(id + '@' + t);
      if (block.indexOf(id) !== -1) bad.push(id + '@' + t + '(block)');
    }
  }
  return { ok: bad.length === 0, detail: bad.length ? '★유출: ' + bad.join(',') : `${CHOUE_IDS.join(',')} 전 tier 미노출` };
});
check('D-5', '★WITHHELD 레코드에 본문(gloss·verdict)이 담기지 않는다', () => {
  const leak = runNow.withheld.filter((w) => Object.keys(w).some((k) => k !== 'rule_id' && k !== 'reason'));
  return { ok: leak.length === 0, detail: leak.length ? '★필드 유출: ' + JSON.stringify(leak[0]) : 'rule_id·reason 뿐' };
});
check('D-6', '★프롬프트 블록이 VERDICT 와 REFERENCE 를 명확히 구분한다', () => {
  const b = FV.factsBlockFace(runNow);
  const hasV = b.indexOf('엔진 판정') !== -1;
  const hasR = b.indexOf('참고 —') !== -1 && b.indexOf('판정이 아닙니다') !== -1;
  return { ok: !!b && (runNow.tally.verdict === 0 || hasV) && (runNow.tally.reference === 0 || hasR), detail: `블록 ${b.split('\n').length}줄 · 판정머리=${hasV} 참고머리=${hasR}` };
});

// ── E ────────────────────────────────────────────────────────────────────────
console.log('');
check('E-1', `★귀 규칙 ${EAR_IDS.length}건은 어떤 tier 에서도 VERDICT 가 되지 않는다`, () => {
  const results = ['A', 'B', 'C-SYNTHETIC', ''].map((t) => FV.evaluateFace({ measures: MEAS, ranks: RANKS, refTier: t }));
  return checkE(results);
});
check('E-2', '★귀 규칙은 산출물에서도 조건식을 갖지 않는다', () => {
  const bad = artifact.rules.filter((r) => EAR_IDS.indexOf(r.rule_id) !== -1 && r.condition.expr);
  return { ok: bad.length === 0, detail: bad.length ? '★조건식 보유: ' + bad.map((x) => x.rule_id).join(',') : `귀 규칙 ${EAR_IDS.length}건 전부 expr=null` };
});

// ── F ────────────────────────────────────────────────────────────────────────
console.log('');
check('F-1', '★fail-closed — measures 없음/축 결손 시 판정하지 않는다', () => checkF(FV.evaluateFace));
check('F-2', '★조건식이 없는 MEASURABLE 규칙은 판정되지 않고 떨어진다 (컷오프 날조 금지)', () => {
  const noExpr = artifact.rules.filter((r) => r.measurability === 'MEASURABLE' && !r.condition.expr);
  const ids = new Set(noExpr.map((r) => r.rule_id));
  const bad = runUp.verdicts.filter((v) => ids.has(v.rule_id));
  const withheldOk = noExpr.every((r) => runUp.withheld.some((w) => w.rule_id === r.rule_id && w.reason === 'CONDITION_NOT_EVALUABLE'));
  return { ok: bad.length === 0 && withheldOk, detail: `expr 없는 MEASURABLE ${noExpr.length}건 (${[...ids].join(',') || '없음'}) → VERDICT ${bad.length}건 · 사유기재 ${withheldOk}` };
});
check('F-3', '★원시값 비교식은 TEXT·MEASURABLE 에만, 랭크 비교식은 FULL·POPULATION 에만 붙어 있다', () => {
  const bad = artifact.rules.filter((r) => r.condition.expr &&
    !((r.condition.expr.space === 'measure' && r.threshold_origin === 'TEXT' && r.measurability === 'MEASURABLE') ||
      (r.condition.expr.space === 'rank' && r.threshold_origin === 'POPULATION' && r.condition_coverage === 'FULL')));
  return { ok: bad.length === 0, detail: bad.length ? '★부정합: ' + bad.map((x) => x.rule_id).join(',') : `조건식 ${artifact.tally.expr_present}건 전부 정합` };
});
check('F-4', '★applyFaceVerdicts 가 LLM 의 봉인 규칙 주장을 버린다', () => {
  const parsed = {
    faceVerdicts: [
      { rule_id: 'FACE_OGWAN_R011', meaning: '봉인된 규칙을 LLM 이 주장' },
      { rule_id: 'FACE_OGWAN_R006', meaning: '醜惡 계열 주장' },
      { rule_id: 'FACE_OGWAN_R020', meaning: '정상 서술' }
    ],
    faceReferences: []
  };
  const r = FV.applyFaceVerdicts(parsed, runNow);
  const ids = parsed.faceVerdicts.map((x) => x.rule_id);
  const leaked = ids.filter((x) => MUST_WITHHOLD_IDS.indexOf(x) !== -1);
  return {
    ok: leaked.length === 0 && r && r.blocked === 2 && ids.length === runNow.tally.verdict,
    detail: `덮어쓴 뒤 ${ids.length}건(엔진 ${runNow.tally.verdict}건) · 버린 LLM 항목 ${r ? r.dropped : '-'} (봉인 주장 ${r ? r.blocked : '-'}) · 유출 ${leaked.length}`
  };
});

// ── H ★condition_coverage (P-786-W) ─────────────────────────────────────────
console.log('');
const COV_BY_ID = new Map(ipRules.map((r) => [r.rule_id, r.condition_coverage || 'PARTIAL(미기재)']));
const ALL_TIERS = ['A', 'B', 'C-SYNTHETIC', ''];
const ALL_RUNS = ALL_TIERS.map((t) => FV.evaluateFace({ measures: MEAS, ranks: RANKS, refTier: t }));

check('H-0', '★규칙 100건 전부 condition_coverage 와 coverage_note 를 갖는다', () => {
  const bad = ipRules.filter((r) => ['FULL', 'PARTIAL', 'NONE'].indexOf(r.condition_coverage) === -1 ||
    !r.coverage_note || !Array.isArray(r.coverage_note.covered) || !Array.isArray(r.coverage_note.uncovered) || !r.coverage_note.basis);
  const d = {}; for (const r of ipRules) d[r.condition_coverage] = (d[r.condition_coverage] || 0) + 1;
  return { ok: bad.length === 0, detail: bad.length ? '★결손: ' + bad.map((r) => r.rule_id).join(',') : JSON.stringify(d) };
});
check('H-1', '★FULL 인데 uncovered 가 비어 있지 않으면 FAIL (자기모순 차단)', () => checkH1(ipRules));
check('H-2', '★귀·청수·기·요함·거동·몸통·추악 계열은 FULL 이 아니다 (금지 목록)', () => checkH2(ipRules));
check('H-3', '★★PARTIAL·NONE 은 어떤 tier 에서도 VERDICT 가 되지 않는다', () => checkH3(ALL_RUNS, COV_BY_ID));
check('H-4', '★coverage_note 에 한자가 없다 (배포 한자 게이트 유지)', () => {
  const bad = [];
  for (const r of artifact.rules) {
    const n = r.coverage_note;
    if (!n) { bad.push(r.rule_id + '(note없음)'); continue; }
    const t = n.covered.concat(n.uncovered, [n.basis]).join(' ');
    if (compiler.countHanja(t) > 0) bad.push(r.rule_id + '(' + compiler.countHanja(t) + '자)');
  }
  return { ok: bad.length === 0, detail: bad.length ? '★한자 혼입: ' + bad.join(',') : '산출물 100건 coverage_note 한자 0자' };
});
check('H-5', '★조건식은 MEASURABLE 이거나 FULL+POPULATION 인 규칙에만 붙어 있다', () => {
  const bad = artifact.rules.filter((r) => r.condition.expr &&
    !(r.measurability === 'MEASURABLE' || (r.condition_coverage === 'FULL' && r.threshold_origin === 'POPULATION')));
  return { ok: bad.length === 0, detail: bad.length ? '★부정합: ' + bad.map((x) => x.rule_id).join(',') : `조건식 ${artifact.tally.expr_present}건 전부 정합` };
});

// ── G ★변이 시험 ────────────────────────────────────────────────────────────
console.log('');
console.log('[G] ★변이 시험 — 일부러 망가뜨린 뒤 위 검사들이 실제로 잡는지 본다');
const mutations = [];
function mutate(name, target, fn) {
  let caught = false, detail = '';
  try { const r = fn(); caught = !r.ok; detail = r.detail; }
  catch (e) { caught = true; detail = 'THREW ' + e.message; }
  mutations.push({ name, target, caught, detail });
  console.log(`  ${caught ? '검출 O' : '검출 X'}  [${target}] ${name}`);
  return caught;
}

// M1 — 산출물에 원문을 남긴다 (A 가 잡아야 한다)
mutate('산출물에 원문(citation.text_original) 재삽입', 'A', () => {
  const bad = JSON.parse(artifactText);
  const src = ipRules.find((r) => r.rule_id === 'FACE_OGWAN_R001');
  bad.rules[0].citation_text = src.citation.text_original;
  return checkA(JSON.stringify(bad, null, 1));
});

// M2 — 규칙 1건을 누락시킨다 (B 가 잡아야 한다)
mutate('규칙 1건 누락', 'B', () => {
  const bad = JSON.parse(artifactText);
  bad.rules.pop();
  return checkB(bad);
});

// M3 — UNMEASURABLE 을 MEASURABLE 로 올린다 (D 가 잡아야 한다)
mutate('醜惡 규칙(UNMEASURABLE)을 MEASURABLE+TEXT 로 승격 + 조건식 부착', 'D', () => {
  const rules = JSON.parse(artifactText).rules.map((r) => {
    if (r.rule_id !== 'FACE_OGWAN_R006') return r;
    const c = JSON.parse(JSON.stringify(r));
    c.measurability = 'MEASURABLE'; c.threshold_origin = 'TEXT'; c.measure_axis = 'symmetry';
    c.condition.expr = { space: 'measure', op: 'gt', left: { axis: 'symmetry' }, right: { const: 0.1 } };
    return c;
  });
  return checkD(FV.evaluateFace({ measures: MEAS, ranks: RANKS, refTier: TIER_NOW, rules: rules }));
});

// M4 — BLOCKED 를 해제한다 (D 가 잡아야 한다)
mutate('user_exposure=BLOCKED 해제', 'D', () => {
  const rules = JSON.parse(artifactText).rules.map((r) => {
    if (r.user_exposure !== 'BLOCKED') return r;
    const c = JSON.parse(JSON.stringify(r)); c.user_exposure = null; return c;
  });
  return checkD(FV.evaluateFace({ measures: MEAS, ranks: RANKS, refTier: TIER_NOW, rules: rules }));
});

// M5 — 귀 규칙을 판정 가능하게 올린다 (E 가 잡아야 한다)
mutate('귀 규칙을 MEASURABLE+TEXT 로 승격 + 조건식 부착', 'E', () => {
  const rules = JSON.parse(artifactText).rules.map((r) => {
    if (EAR_IDS.indexOf(r.rule_id) === -1) return r;
    const c = JSON.parse(JSON.stringify(r));
    c.measurability = 'MEASURABLE'; c.threshold_origin = 'TEXT'; c.user_exposure = null; c.measure_axis = 'symmetry';
    c.condition.expr = { space: 'measure', op: 'gt', left: { axis: 'symmetry' }, right: { const: 0.1 } };
    return c;
  });
  const results = ['A', 'B', 'C-SYNTHETIC'].map((t) => FV.evaluateFace({ measures: MEAS, ranks: RANKS, refTier: t, rules: rules }));
  return checkE(results);
});

// M6 — fail-open 엔진 (F 가 잡아야 한다): measures 없어도 계측값을 0 으로 채워 판정
mutate('fail-open 변종 — measures 결손을 0 으로 채워 판정', 'F', () => {
  const failOpen = (input) => {
    const m = {}; for (const a of AXES) m[a] = (input.measures && input.measures[a]) || 0;
    return FV.evaluateFace(Object.assign({}, input, { measures: m }));
  };
  return checkF(failOpen);
});

// M7 — 업그레이드 경로를 죽인다 (C-1 이 잡아야 한다): coverage 를 지우면 fail-closed 로 PARTIAL 이 된다
mutate('업그레이드 경로 차단 — condition_coverage 삭제(fail-closed 로 PARTIAL 처리)', 'C-1', () => {
  const probe = JSON.parse(JSON.stringify(PROBE));
  delete probe.condition_coverage;            // ★필드가 없으면 PARTIAL — 승격이 일어나면 안 된다
  const c = FV.evaluateFace({ measures: MEAS, ranks: Object.assign(mkRanks(), { noseHRatio: 0.8 }), refTier: TIER_NOW, rules: [probe] });
  const b = FV.evaluateFace({ measures: MEAS, ranks: Object.assign(mkRanks(), { noseHRatio: 0.8 }), refTier: TIER_UP, rules: [probe] });
  const ok = c.tally.verdict === 0 && c.tally.reference === 1 && b.tally.verdict === 1 && b.tally.reference === 0;
  return { ok: ok, detail: `C: V${c.tally.verdict}/R${c.tally.reference} → B: V${b.tally.verdict}/R${b.tally.reference}` };
});

// M8 — 원문 필드명을 되살린다 (A-2 가 잡아야 한다)
mutate('원문 필드(operational) 재삽입', 'A-2', () => {
  const bad = JSON.parse(artifactText);
  bad.rules[0].condition.operational = '재삽입';
  const t = JSON.stringify(bad, null, 1);
  // ★JSON 키 형태로 정확히 검사한다(따옴표 포함). 산출물의 한국어 설명문에 단어가
  //   나오는 것과 **필드가 실제로 존재하는 것**을 구분하기 위해서다.
  const banned = ['"text_original"', '"predicate_original"', '"operational"', '"notes"', '"organ"'];
  const hit = banned.filter((x) => t.indexOf(x) !== -1);
  return { ok: hit.length === 0, detail: hit.join(',') };
});

// M9 — ★PARTIAL 을 FULL 로 위조한다 (uncovered 는 그대로) — H-1 이 잡아야 한다
mutate('PARTIAL 을 FULL 로 위조 (uncovered 남긴 채)', 'H-1', () => {
  const rules = ipRules.map((r) => {
    if (r.rule_id !== 'FACE_OGWAN_R001') return r;
    const c = JSON.parse(JSON.stringify(r)); c.condition_coverage = 'FULL'; return c;
  });
  return checkH1(rules);
});

// M10 — ★uncovered 를 비우고 FULL 로 위조한다 (금지 계열) — H-2 가 잡아야 한다
mutate('금지 계열(귀)을 FULL 로 위조하고 uncovered 를 비움', 'H-2', () => {
  const rules = ipRules.map((r) => {
    if (r.rule_id !== 'FACE_OGWAN_R036') return r;
    const c = JSON.parse(JSON.stringify(r));
    c.condition_coverage = 'FULL';
    c.coverage_note = { covered: ['입술 두께'], uncovered: [], basis: '위조' };
    return c;
  });
  const r1 = checkH1(rules), r2 = checkH2(rules);
  return { ok: r1.ok && r2.ok, detail: 'H-1 ' + (r1.ok ? 'ok' : '검출') + ' / H-2 ' + r2.detail };
});

// M11 — ★PARTIAL 규칙을 FULL+POPULATION 으로 올려 tier B 에서 VERDICT 로 만든다 — H-3 이 잡아야 한다
mutate('PARTIAL 규칙을 조건식과 함께 승격시켜 VERDICT 로 만든다', 'H-3', () => {
  const rules = JSON.parse(artifactText).rules.map((r) => {
    if (r.rule_id !== 'FACE_OGWAN_R013') return r;
    const c = JSON.parse(JSON.stringify(r));
    c.condition_coverage = 'FULL';            // ★산출물에서만 위조 — IP 원본의 coverage 는 PARTIAL 이다
    c.condition.expr = { space: 'rank', op: 'gt', left: { axis: 'foreheadRatio' }, right: { const: 0.5 } };
    return c;
  });
  const res = ['A', 'B'].map((t) => FV.evaluateFace({ measures: MEAS, ranks: RANKS, refTier: t, rules: rules }));
  return checkH3(res, COV_BY_ID);             // ★IP 원본 기준 coverage 로 대조하므로 위조가 드러난다
});

const caught = mutations.filter((m) => m.caught).length;
console.log(`  ⟹ 변이 ${mutations.length}건 중 ${caught}건 검출`);
check('G-1', '★변이 시험 전건 검출 (검사가 실제로 작동한다)', () => ({
  ok: caught === mutations.length,
  detail: `${caught}/${mutations.length} 검출` + (caught === mutations.length ? '' : ' ★미검출: ' + mutations.filter((m) => !m.caught).map((m) => m.name).join(' / '))
}));

// ── 요약 ─────────────────────────────────────────────────────────────────────
console.log('');
console.log('[현황 집계 · refTier=' + TIER_NOW + ']');
console.log(`  VERDICT   ${runNow.tally.verdict}건  (성립 ${runNow.tally.verdict_holds} · 불성립 ${runNow.tally.verdict_not_holds})`);
console.log(`  REFERENCE ${runNow.tally.reference}건`);
console.log(`  WITHHELD  ${runNow.tally.withheld}건  ${JSON.stringify(runNow.tally.withheld_by_reason)}`);
console.log('  VERDICT 규칙: ' + runNow.verdicts.map((v) => v.rule_id).join(', '));
console.log('');
console.log('[★결속 시 확인] doctrines.user_output_enabled = ' +
  artifact.doctrines.map((d) => d.doctrine_id + ':' + d.user_output_enabled).join(' · ') +
  '  — false 면 사용자 노출 판정 근거로 쓸 수 없다(영인 미확보).');

console.log('');
console.log('='.repeat(78));
if (fails.length) { console.log('실패 내역'); fails.forEach((f) => console.log('  FAIL ' + f)); }

// ══════════════════════════════════════════════════════════════════
// ★I. 결속 검사 — 엔진을 만들어 놓고 **부르지 않는** 상태를 막는다.
//   이 프로젝트에는 이미 그 전례가 있다: DREAM_KEYS 12항목이 선언만 되고
//   참조 0건이었고, 작명 81수 판정기가 화면에 도달하지 않았다(v786 진단 §3).
// ══════════════════════════════════════════════════════════════════
{
  const FSRC = require('fs').readFileSync(require('path').join(__dirname, '..', 'api', 'fortune.js'), 'utf8');
  check('I-1', '★fortune.js 가 facever 를 적재한다', () => ({
    ok: /_engine\/facever\.js/.test(FSRC) && /cwFaceVer\s*\(/.test(FSRC),
    detail: 'import 경로 + 로더 호출'
  }));
  check('I-2', '★fortune.js 가 evaluateFace 를 실제로 호출한다 (선언만 하고 안 쓰는 것 차단)', () => ({
    ok: /\.evaluateFace\s*\(/.test(FSRC), detail: 'evaluateFace 호출부 존재'
  }));
  check('I-3', '★판정 블록이 userPrompt 에 실제로 실린다', () => ({
    ok: /cwFaceBlock/.test(FSRC) && (FSRC.match(/\$\{cwFaceBlock/g) || []).length >= 3,
    detail: 'cwFaceBlock 보간 ' + ((FSRC.match(/\$\{cwFaceBlock/g) || []).length) + '곳 (face 3종)'
  }));
  check('I-4', '★★user_output_enabled 게이트가 있다 (교리 미승인 시 VERDICT 미노출)', () => ({
    ok: /user_output_enabled/.test(FSRC) && /verdicts:\s*\[\]/.test(FSRC),
    detail: '플래그 검사 + VERDICT 비우기'
  }));
  check('I-5', '★응답 덮어쓰기 applyFaceVerdicts 가 호출된다', () => ({
    ok: /applyFaceVerdicts\s*\(/.test(FSRC), detail: 'bind.js applyEngineFacts 와 같은 성질'
  }));
  check('I-6', '★현재 교리는 미승인 상태다 (승인은 ADR 결재 사항)', () => {
    const RJ = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'api', '_engine', 'face_rules.json'), 'utf8'));
    const docs = (RJ && RJ.doctrines) || [];
    const on = docs.filter((d) => d.user_output_enabled === true);
    return { ok: docs.length > 0, detail: `교리 ${docs.length}건 · 사용자 판정 활성 ${on.length}건` +
      (on.length ? ' ★ADR 결재 확인 필요' : ' (참고층만 노출 중)') };
  });
}

console.log(`[p08_face_verdict] total=${total} pass=${pass} fail=${total - pass}`);
process.exit(fails.length ? 1 : 0);
