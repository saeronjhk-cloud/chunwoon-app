// ============================================================
//  P-04 · 관상 doctrine 파이프라인 평가
//  node _v786_diag/p04_face_doctrine_eval.js
//  node _v786_diag/p04_face_doctrine_eval.js --mutation   ← 게이트 변이 시험
//
//  검사하는 것 세 가지 (doctrine 마다 동일하게 돈다)
//   A) 인용 검증 — 규칙의 text_original 이 축자 원문 corpus 의 부분문자열인가.
//      ★「인용 없는 규칙 0건」을 사람 말이 아니라 기계로 증명하는 방법이다.
//   B) 집계·참조 무결성 — 손으로 적은 tally 와 코드가 센 값이 같은가.
//   C) 원문 명례 GT — 규칙 JSON 을 태워 원문이 말한 판정이 재현되는가.
//      ★음성 대조군 포함: 원문에 없는 조건이면 판정을 거부해야 한다(fail-closed).
//
//  ★2026-09-05 확장 — doctrine 2건을 같은 게이트로 검사한다.
//     FACE_OGWAN (太淸神鑑 四庫本 전자전사 · 영인 미확보 · 잠정)
//     FACE_XLHZ  (相理衡眞 1833 道光刻本 · ★영인 직독 · 정본 1순위)
//     기존 80검사는 그대로 유지되며 앞부분에서 먼저 돈다.
//
//  ★이 스크립트는 index.html · api/* 를 읽지도 고치지도 않는다.
// ============================================================
const fs = require('fs');
const path = require('path');

const IPR = require('./_ip_face_root.js')(); // ★v788 P-786-H — IP_face/ 접두는 정본(D:\ChunWoon_IP\face)으로 해석
const R  = (p) => JSON.parse(fs.readFileSync(p.startsWith('IP_face/') ? path.join(IPR, p.slice(8)) : path.join(__dirname, p), 'utf8'));
const RULES     = R('IP_face/rules/face/ogwan.json');
const GT        = R('IP_face/eval/ogwan_gt.json');
const XRULES    = R('IP_face/rules/face/xlhz.json');
const XGT       = R('IP_face/eval/xlhz_gt.json');
const EDITIONS  = R('IP_face/sources/source_editions.json');
const DOCTRINES = R('IP_face/doctrines.json');

const MUTATION_MODE = process.argv.indexOf('--mutation') >= 0;

const line = (c) => c.repeat(78);
let total = 0, pass = 0, fail = 0;
const fails = [];
function check(section, name, ok, detail) {
  total++;
  if (ok) { pass++; }
  else { fail++; fails.push(`[${section}] ${name} — ${detail || ''}`); }
}

// ───────────────────────────────────────────────────────────
// 판정 엔진. 규칙 JSON 만 보고 결정하며 어떤 임계도 내장하지 않는다.
//  populationCalibrated=false : 현재 유일한 모집단이 TIER-C(합성 60,000)라
//  「豐隆·清秀」류 조건의 참·거짓을 낼 자격이 없다. → DEFERRED 가 정답.
// ───────────────────────────────────────────────────────────
function makeJudge(rules) {
  const IDX = {};
  for (const r of rules) IDX[r.condition.key] = r;
  return function judge(conditionKey, opts) {
    const o = opts || {};
    const r = IDX[conditionKey];
    if (!r) return { status: 'NO_RULE' };                                  // ★fail-closed
    if (r.measurability === 'UNMEASURABLE') return { status: 'UNMEASURABLE', rule_id: r.rule_id };
    if (r.measure_axis === null)            return { status: 'AXIS_MISSING', rule_id: r.rule_id };
    if (r.threshold_origin === 'POPULATION' && !o.populationCalibrated)
      return { status: 'DEFERRED', rule_id: r.rule_id };
    if (r.threshold_origin === 'TEXT')
      return { status: 'VERDICT', rule_id: r.rule_id, verdict_code: r.verdict.code };
    return { status: 'DEFERRED', rule_id: r.rule_id };
  };
}

// ───────────────────────────────────────────────────────────
// doctrine 1건에 대해 A · B · C 를 전부 돌린다.
// verbose=false 면 출력 없이 검사만 한다(변이 시험용).
// ───────────────────────────────────────────────────────────
function runDoctrine(tag, RS, G, verbose) {
  const say = (s) => { if (verbose) console.log(s); };

  // ── A) 인용 검증 ────────────────────────────────────────
  say(line('-'));
  say(`A) 인용 검증 — text_original ⊂ citation_corpus   [${tag}]`);
  say(line('-'));
  const corpus = RS.citation_corpus;
  let citeBad = 0;
  for (const r of RS.rules) {
    const c = r.citation || {};
    const block = corpus[c.corpus_id];
    let ok = false, why = '';
    if (!c.text_original || !c.text_original.length) { why = 'text_original 없음'; }
    else if (!block) { why = `corpus_id ${c.corpus_id} 미등재`; }
    else if (!c.url) { why = 'url 없음'; }
    else if (block.text.indexOf(c.text_original) < 0) { why = '축자 원문에 없는 문자열(개작·오전사 의심)'; }
    else if (block.locus !== c.locus) { why = `locus 불일치 corpus=${block.locus} rule=${c.locus}`; }
    else ok = true;
    if (!ok) citeBad++;
    check('A', r.rule_id, ok, why);
  }
  say(`  규칙 ${RS.rules.length}건 중 인용 불량 ${citeBad}건`);
  say('');

  // ── B) 집계·참조 무결성 ─────────────────────────────────
  say(line('-'));
  say(`B) 집계·참조 무결성   [${tag}]`);
  say(line('-'));
  const cnt = (f) => RS.rules.reduce((a, r) => (a[f(r)] = (a[f(r)] || 0) + 1, a), {});
  const TO = cnt(r => r.threshold_origin);
  const MS = cnt(r => r.measurability);
  const axisNull = RS.rules.filter(r => r.measure_axis === null).length;
  const blocked  = RS.rules.filter(r => r.user_exposure === 'BLOCKED').length;
  const ids      = RS.rules.map(r => r.rule_id);
  const keys     = RS.rules.map(r => r.condition.key);
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const T = RS.tally;

  check('B', 'rules_total',        RS.rules.length === T.rules_total, `실측 ${RS.rules.length} vs 기재 ${T.rules_total}`);
  check('B', 'threshold_origin',   eq({TEXT:TO.TEXT|0,POPULATION:TO.POPULATION|0,NONE:TO.NONE|0}, T.threshold_origin), JSON.stringify(TO));
  check('B', 'measurability',      eq({MEASURABLE:MS.MEASURABLE|0,PARTIAL:MS.PARTIAL|0,UNMEASURABLE:MS.UNMEASURABLE|0}, T.measurability), JSON.stringify(MS));
  check('B', 'measure_axis_null',  axisNull === T.measure_axis_null, `실측 ${axisNull} vs 기재 ${T.measure_axis_null}`);
  check('B', 'user_exposure_blocked', blocked === T.user_exposure_blocked, `실측 ${blocked} vs 기재 ${T.user_exposure_blocked}`);
  check('B', 'rules_without_citation_0', citeBad === 0 && T.rules_without_citation === 0, `실측 ${citeBad}`);
  check('B', 'rule_id_unique',     new Set(ids).size === ids.length, '중복 rule_id');
  check('B', 'condition_key_unique', new Set(keys).size === keys.length, '중복 condition.key');
  check('B', 'source_edition_resolves', RS.rules.every(r => EDITIONS.editions[r.source_edition_id]), '미등재 판본 참조');
  check('B', 'doctrine_resolves',  RS.rules.every(r => DOCTRINES.doctrines.some(d => d.doctrine_id === r.doctrine_id)), '미등재 doctrine 참조');
  // ★UNMEASURABLE 인데 축을 배당한 규칙이 있으면 억지 배당이다
  check('B', 'no_forced_axis',     RS.rules.every(r => !(r.measurability === 'UNMEASURABLE' && r.measure_axis !== null)), '계측 불가인데 축 배당됨');
  // ★threshold_origin=NONE 인데 measurability 가 UNMEASURABLE 이 아니면 모순
  check('B', 'none_iff_unmeasurable', RS.rules.every(r => (r.threshold_origin === 'NONE') === (r.measurability === 'UNMEASURABLE')), 'NONE↔UNMEASURABLE 불일치');

  say(`  threshold_origin : TEXT=${TO.TEXT|0}  POPULATION=${TO.POPULATION|0}  NONE=${TO.NONE|0}`);
  say(`  measurability    : MEASURABLE=${MS.MEASURABLE|0}  PARTIAL=${MS.PARTIAL|0}  UNMEASURABLE=${MS.UNMEASURABLE|0}`);
  say(`  measure_axis=null: ${axisNull}   사용자 노출 차단: ${blocked}`);
  const measurableWithAxis = RS.rules.filter(r => r.measurability === 'MEASURABLE' && r.measure_axis !== null).length;
  say(`  ★MEASURABLE + 축 배당: ${measurableWithAxis} / ${RS.rules.length}  (${(measurableWithAxis / RS.rules.length * 100).toFixed(1)}%)`);
  say('');

  // ── C) 원문 명례 GT ─────────────────────────────────────
  say(line('-'));
  say(`C) 원문 명례 GT — 조건 → 규칙 → 판정   [${tag}]`);
  say(line('-'));
  const judge = makeJudge(RS.rules);
  const byGroup = {};
  for (const c of G.cases) {
    const got = judge(c.condition_key, { populationCalibrated: false });
    const e = c.expect;
    let ok = got.status === e.status;
    if (ok && e.rule_id) ok = got.rule_id === e.rule_id;
    if (ok && e.verdict_code) ok = got.verdict_code === e.verdict_code;
    check('C', c.case_id, ok, `expect=${e.status}/${e.rule_id || '-'}/${e.verdict_code || '-'}  got=${got.status}/${got.rule_id || '-'}/${got.verdict_code || '-'}`);
    byGroup[c.group] = byGroup[c.group] || { n: 0, ok: 0 };
    byGroup[c.group].n++; if (ok) byGroup[c.group].ok++;
    const mark = ok ? 'ok  ' : 'FAIL';
    say(`  ${mark} ${c.case_id}  ${got.status.padEnd(12)} ${(got.rule_id || '').padEnd(20)} ${c.condition_ko}`);
  }
  say('');
  for (const g of Object.keys(byGroup)) say(`  · ${g.padEnd(28)} ${byGroup[g].ok}/${byGroup[g].n}`);

  // ★음성 대조군이 실제로 거부됐는지를 따로 한 번 더 못박는다.
  const negs = G.cases.filter(c => c.group === 'NEGATIVE_CONTROL');
  const negRejected = negs.filter(c => judge(c.condition_key, { populationCalibrated: false }).status === 'NO_RULE').length;
  say('');
  say(`  ★fail-closed : 원문에 없는 조건 ${negs.length}건 중 ${negRejected}건 판정 거부`);
  if (negRejected !== negs.length) say('  ★★경고 — 원문에 없는 조건에 판정이 붙었다. 이 게이트는 「항상 통과」다.');
  say('');
  return { citeBad: citeBad, negs: negs.length, negRejected: negRejected };
}

// ============================================================
//  본 실행
// ============================================================
console.log(line('='));
console.log('P-04  관상 doctrine 평가 — doctrine 2건');
console.log(line('='));
console.log(`[1] FACE_OGWAN  저본 ${EDITIONS.editions.SRC_TQSJ_A.status} / license_review=${EDITIONS.editions.SRC_TQSJ_A.license_review_status}`);
console.log('    太淸神鑑(四庫全書本) — ★영인 미확보 전자 전사. 출시 판정 근거 불가.');
console.log(`    코드 결속 : ${RULES.binding_status.split('—')[0].trim()}`);
console.log(`[2] FACE_XLHZ   저본 ${EDITIONS.editions.SRC_XLHZ_A.status} / license_review=${EDITIONS.editions.SRC_XLHZ_A.license_review_status}`);
console.log('    相理衡眞(淸 道光13년[1833] 刻本) — ★영인 직독 완료. scan_file_sha256 은 미수령이라 null.');
console.log(`    코드 결속 : ${XRULES.binding_status.split('—')[0].trim()}`);
console.log('');

console.log(line('='));
console.log('【1】 FACE_OGWAN — 太淸神鑑(SRC_TQSJ_A) → rules/face/ogwan.json');
console.log(line('='));
runDoctrine('FACE_OGWAN', RULES, GT, true);

console.log(line('='));
console.log('【2】 FACE_XLHZ — 相理衡眞(SRC_XLHZ_A) → rules/face/xlhz.json');
console.log(line('='));
runDoctrine('FACE_XLHZ', XRULES, XGT, true);

// ── D) doctrine 간 교차 무결성 ────────────────────────────
console.log(line('-'));
console.log('D) doctrine 간 교차 무결성');
console.log(line('-'));
const allIds  = RULES.rules.map(r => r.rule_id).concat(XRULES.rules.map(r => r.rule_id));
const allKeys = RULES.rules.map(r => r.condition.key).concat(XRULES.rules.map(r => r.condition.key));
check('D', 'rule_id_globally_unique', new Set(allIds).size === allIds.length, '두 doctrine 사이에 rule_id 중복');
check('D', 'condition_key_globally_unique', new Set(allKeys).size === allKeys.length, '두 doctrine 사이에 condition.key 중복');
// ★교리 우선순위 — 정본이 잠정본을 이겨야 한다(conflict_policy = priority_wins, 낮은 수가 우선)
const dOg = DOCTRINES.doctrines.find(d => d.doctrine_id === 'FACE_OGWAN');
const dXl = DOCTRINES.doctrines.find(d => d.doctrine_id === 'FACE_XLHZ');
check('D', 'xlhz_doctrine_registered', !!dXl, 'FACE_XLHZ 가 doctrines.json 에 없다');
check('D', 'xlhz_outranks_ogwan', !!dXl && !!dOg && dXl.priority_default < dOg.priority_default,
  `XLHZ=${dXl && dXl.priority_default} OGWAN=${dOg && dOg.priority_default} — 정본이 잠정본보다 우선해야 한다`);
// ★영인 직독한 판본만 SELECTED 일 수 있다
const eXl = EDITIONS.editions.SRC_XLHZ_A;
check('D', 'selected_requires_scan_read', !(eXl.status === 'SELECTED' && !eXl.scan_read_verified),
  'SELECTED 인데 scan_read_verified 가 없다 — 영인을 보지 않고 승격했다');
// ★license_review_status 는 UNREVIEWED 를 벗어나면 안 된다(등재자는 변호사가 아니다)
check('D', 'license_review_still_unreviewed',
  Object.values(EDITIONS.editions).every(e => e.license_review_status === 'UNREVIEWED'),
  'license_review_status 가 UNREVIEWED 를 벗어났다');
console.log(`  FACE_XLHZ priority=${dXl && dXl.priority_default} · FACE_OGWAN priority=${dOg && dOg.priority_default}`);
console.log(`  SRC_XLHZ_A status=${eXl.status} · scan_file_sha256=${eXl.scan_file_sha256} · commons_sha1=${(eXl.scan_file_commons_sha1 && eXl.scan_file_commons_sha1['第6冊']) || 'n/a'}`);
console.log('');

// ============================================================
//  ★변이 시험 (--mutation) — 게이트가 실제로 무는지 확인
//  기본 실행에는 포함되지 않는다. 총계에도 반영하지 않는다.
// ============================================================
if (MUTATION_MODE) {
  console.log(line('='));
  console.log('★변이 시험 — 일부러 규칙을 훼손했을 때 게이트가 잡는가');
  console.log(line('='));
  const deep = (o) => JSON.parse(JSON.stringify(o));

  function trial(name, mutate, expectSection) {
    const rs = deep(XRULES), g = deep(XGT);
    mutate(rs, g);
    // 격리된 카운터로 돌린다
    const savedTotal = total, savedPass = pass, savedFail = fail, savedLen = fails.length;
    runDoctrine('MUT', rs, g, false);
    const caught = fails.slice(savedLen);
    // 원상복구
    total = savedTotal; pass = savedPass; fail = savedFail; fails.length = savedLen;
    const hit = caught.filter(f => f.startsWith(`[${expectSection}]`));
    const ok = hit.length > 0;
    console.log(`  ${ok ? 'CAUGHT' : '★MISSED'}  ${name}`);
    console.log(`           기대 게이트=${expectSection}  검출 ${caught.length}건 (그 중 ${expectSection}=${hit.length})`);
    if (caught.length) console.log(`           예: ${caught[0].slice(0, 110)}`);
    return ok;
  }

  const results = [];
  results.push(trial('M1 인용 개작 — R014 의 「其形銳而下豐」을 「其形銳而上豐」으로 바꾼다(火形 배당을 뒤집는 개작)',
    (rs) => { rs.rules.find(r => r.rule_id === 'FACE_XLHZ_R014').citation.text_original = '其形銳而上豐'; }, 'A'));

  results.push(trial('M2 locus 위조 — R015 의 인용 locus 를 다른 葉으로 바꾼다',
    (rs) => { rs.rules.find(r => r.rule_id === 'FACE_XLHZ_R015').citation.locus = '卷六 五行形相論(葉二二a)'; }, 'A'));

  results.push(trial('M3 축 억지 배당 — 계측 불가(R022 露臂露背)에 whRatio 를 붙인다',
    (rs) => { rs.rules.find(r => r.rule_id === 'FACE_XLHZ_R022').measure_axis = 'whRatio'; }, 'B'));

  results.push(trial('M4 축 억지 배당 2 — 命宮凹陷(R053, 깊이)에 myungGung(폭)을 붙인다',
    (rs) => { rs.rules.find(r => r.rule_id === 'FACE_XLHZ_R053').measure_axis = 'myungGung'; }, 'B'));

  results.push(trial('M5 등급 위조 — R024(色黃)를 UNMEASURABLE 인 채 threshold_origin 만 POPULATION 으로 올린다',
    (rs) => { rs.rules.find(r => r.rule_id === 'FACE_XLHZ_R024').threshold_origin = 'POPULATION'; }, 'B'));

  results.push(trial('M6 tally 조작 — rules_total 을 58 → 57 로 낮춘다',
    (rs) => { rs.tally.rules_total = 57; }, 'B'));

  results.push(trial('M7 음성 대조군 오염 — 「역삼각형이면 火形」 조건에 규칙을 만들어 붙인다',
    (rs) => {
      const r = JSON.parse(JSON.stringify(rs.rules.find(x => x.rule_id === 'FACE_XLHZ_R014')));
      r.rule_id = 'FACE_XLHZ_R999';
      r.condition.key = 'xlhz.hwa.yeoksamgak_inv';
      rs.rules.push(r);
    }, 'C'));

  results.push(trial('M8 인용 삭제 — R021(土主肥)의 text_original 을 비운다',
    (rs) => { rs.rules.find(r => r.rule_id === 'FACE_XLHZ_R021').citation.text_original = ''; }, 'A'));

  const caught = results.filter(Boolean).length;
  console.log('');
  console.log(`  ★변이 ${results.length}건 중 ${caught}건 검출` + (caught === results.length ? ' — 게이트가 전부 물었다.' : ' — ★★놓친 변이가 있다.'));
  console.log('');
}

// ───────────────────────────────────────────────────────────
console.log(line('='));
if (fails.length) { console.log('실패 목록'); for (const f of fails) console.log('  · ' + f); console.log(line('=')); }
console.log(`[p04_face_doctrine] total=${total} pass=${pass} fail=${fail}`);
