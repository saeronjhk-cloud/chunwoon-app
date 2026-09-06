// ============================================================
//  P-07 · 센서·신설축 통합 후 원문 규칙 재판정 집계 (성공 지표)
//  node _v786_diag/p07_promote_tally.js
// ------------------------------------------------------------
//  ★규칙 JSON 을 수정하지 않는다. 「승격 가능 건수」만 센다.
//    실제 승격은 각 축의 결속·검증이 끝난 뒤 별도 커밋으로 한다.
// ============================================================
const fs = require('fs'), path = require('path');
const D = path.join(__dirname, 'IP_face');
const rd = p => JSON.parse(fs.readFileSync(path.join(D, p), 'utf8'));
const arr = o => o.rules || o;

const rules = [].concat(arr(rd('rules/face/ogwan.json')), arr(rd('rules/face/xlhz.json')));
const byId = new Map(rules.map(r => [r.rule_id, r]));

function loadCand(f) {
  try { const j = rd(f); const a = j.candidates || j.rules || j; return Array.isArray(a) ? a : []; }
  catch (e) { return null; }
}
const colorC = loadCand('promote_candidates_color.json');
const texC = loadCand('promote_candidates_texture.json');

// ★G4/G5 신설축으로 승격 가능한 것 — 규칙 원문을 직접 대조해 손으로 확정한 목록.
//   근거를 함께 남긴다. 억지 승격을 막기 위해 rule_id 를 열거하고, 없는 id 는 실패시킨다.
const G45 = [
  { id: 'FACE_OGWAN_R039', to: 'PARTIAL', axis: 'cheonJiWidth,cheonJiHeight',
    why: '「上下相應」— 종전엔 foreheadRatio(폭)와 chin(길이)의 차원이 달라 비교 자체가 성립하지 않았다. 같은 차원 비 축 신설로 성립' },
  { id: 'FACE_XLHZ_R014', to: 'MEASURABLE', axis: 'lowerUpperWidth',
    why: '「其形銳而下豐」— 하악각폭/이마폭 비로 직역. 이미 MEASURABLE 이었고 축이 더 정확해짐' },
  { id: 'FACE_XLHZ_R015', to: 'MEASURABLE', axis: 'cheonJiWidth',
    why: '「上尖如火之炎」— 같음' }
];

const ORDER = { UNMEASURABLE: 0, PARTIAL: 1, MEASURABLE: 2 };
const pct = (a, b) => (a / b * 100).toFixed(1) + '%';

let total = 0, pass = 0; const fails = [];
const check = (id, desc, fn) => {
  total++;
  let r; try { r = fn(); } catch (e) { r = { ok: false, detail: 'THREW ' + e.message }; }
  if (r.ok) { pass++; console.log(`PASS ${id}  ${desc}  — ${r.detail}`); }
  else { fails.push(`${id} ${desc} -> ${r.detail}`); console.log(`FAIL ${id}  ${desc}  — ${r.detail}`); }
};

console.log('='.repeat(78));
console.log('P-07  센서·신설축 통합 후 원문 규칙 재판정');
console.log('='.repeat(78));

check('T-1', '규칙 파일 2건이 읽히고 rule_id 가 유일하다', () => {
  const ids = rules.map(r => r.rule_id);
  return { ok: new Set(ids).size === ids.length && rules.length > 90,
    detail: `규칙 ${rules.length}건 · 고유 id ${new Set(ids).size}` };
});
check('T-2', '승격 후보 파일 2건이 존재한다 (색·텍스처)', () => ({
  ok: Array.isArray(colorC) && Array.isArray(texC),
  detail: `color ${colorC ? colorC.length : 'MISSING'} · texture ${texC ? texC.length : 'MISSING'}`
}));
check('T-3', '★후보의 rule_id 가 전부 실재한다 (유령 승격 차단)', () => {
  const bad = [];
  for (const c of [].concat(colorC || [], texC || [], G45)) {
    const id = c.rule_id || c.id;
    if (!byId.has(id)) bad.push(id);
  }
  return { ok: bad.length === 0, detail: bad.length ? '★실재하지 않는 id: ' + bad.join(',') : '전건 실재' };
});
check('T-4', '★후보가 등급을 낮추지 않는다 (역행 차단)', () => {
  const bad = [];
  for (const c of [].concat(colorC || [], texC || [], G45)) {
    const id = c.rule_id || c.id, to = c.to || c.measurability_candidate;
    const cur = byId.get(id); if (!cur || !to) continue;
    if (ORDER[to] < ORDER[cur.measurability]) bad.push(`${id} ${cur.measurability}→${to}`);
  }
  return { ok: bad.length === 0, detail: bad.length ? '★역행: ' + bad.join(' / ') : '역행 0건' };
});

// ── 통합 집계 ──
const best = new Map();
const note = new Map();
for (const [src, list] of [['색', colorC || []], ['텍스처', texC || []], ['G4/G5', G45]]) {
  for (const c of list) {
    const id = c.rule_id || c.id, to = c.to || c.measurability_candidate;
    if (!byId.has(id) || !to) continue;
    if (!best.has(id) || ORDER[to] > ORDER[best.get(id)]) best.set(id, to);
    note.set(id, (note.get(id) ? note.get(id) + '+' : '') + src);
  }
}
const before = { UNMEASURABLE: 0, PARTIAL: 0, MEASURABLE: 0 };
const after = { UNMEASURABLE: 0, PARTIAL: 0, MEASURABLE: 0 };
let promoted = 0;
for (const r of rules) {
  before[r.measurability]++;
  const to = best.get(r.rule_id);
  const fin = (to && ORDER[to] > ORDER[r.measurability]) ? to : r.measurability;
  if (fin !== r.measurability) promoted++;
  after[fin]++;
}

console.log('\n[집계] 규칙 ' + rules.length + '건');
console.log('  등급         | 통합 전 | 통합 후');
console.log('  -------------+---------+--------');
for (const k of ['MEASURABLE', 'PARTIAL', 'UNMEASURABLE']) {
  console.log(`  ${k.padEnd(12)} | ${String(before[k]).padStart(6)}  | ${String(after[k]).padStart(6)}`);
}
console.log(`\n  ★승격 ${promoted}건  (UNMEASURABLE ${before.UNMEASURABLE} → ${after.UNMEASURABLE})`);
console.log(`  ★판정 가능(MEASURABLE) ${before.MEASURABLE} → ${after.MEASURABLE}  = ${pct(after.MEASURABLE, rules.length)}`);
console.log(`  ★무엇이든 잴 수 있는 것(MEASURABLE+PARTIAL) ${before.MEASURABLE + before.PARTIAL} → ${after.MEASURABLE + after.PARTIAL}  = ${pct(after.MEASURABLE + after.PARTIAL, rules.length)}`);

console.log('\n[승격 내역]');
for (const [id, to] of [...best.entries()].sort()) {
  const cur = byId.get(id);
  if (ORDER[to] <= ORDER[cur.measurability]) continue;
  console.log(`  ${id.padEnd(18)} ${cur.measurability} → ${to.padEnd(12)} [${note.get(id)}]  ${((cur.citation && cur.citation.text_original) || '').slice(0, 22)}`);
}

// ★등급은 그대로여도 「축이 없던 규칙에 축이 생긴」 것은 별개의 진전이다.
{
  const axisAdded = [];
  for (const c of [].concat(colorC || [], texC || [], G45)) {
    const id = c.rule_id || c.id, cur = byId.get(id);
    if (!cur) continue;
    if (!cur.measure_axis) axisAdded.push(id + ' ← ' + (c.axis || (c.color_axes || c.texture_axes || []).join(',')));
  }
  const uniq = [...new Set(axisAdded)];
  console.log(`\n[축 배당] measure_axis 가 null 이던 규칙 ${uniq.length}건에 축이 생겼다`);
  for (const a of uniq) console.log('  ' + a);
}

console.log('\n[★그래도 못 재는 것 — 남은 UNMEASURABLE 사유별]');
const reasons = new Map();
for (const r of rules) {
  const to = best.get(r.rule_id);
  const fin = (to && ORDER[to] > ORDER[r.measurability]) ? to : r.measurability;
  if (fin !== 'UNMEASURABLE') continue;
  const t = (r.citation && r.citation.text_original) || '';
  let why = '기타';
  if (/耳|採聽|采聽/.test(t)) why = '귀 — FaceMesh 468 에 귀 윤곽 없음';
  else if (/清|淸|秀/.test(t)) why = '清·秀 — 비교 대상도 컷오프도 원문에 없음';
  else if (/陷|凹/.test(t)) why = '凹陷 — 깊이(z). 2D 는 조명이 만든 그림자만 봄';
  else if (/氣/.test(t)) why = '氣 — 색이 아님';
  else if (/坐|行|臥|涉|動止/.test(t)) why = '거동 — 정지 사진 밖';
  else if (/骨|肉|腰|背|臂/.test(t)) why = '몸통·골육 — 얼굴 밖';
  else if (/惡|醜/.test(t)) why = '길흉 형용 — 계측량이 아님';
  reasons.set(why, (reasons.get(why) || 0) + 1);
}
for (const [k, v] of [...reasons.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(3)}건  ${k}`);

// ★T-5 재설계 (P-786-W) — 종전 T-5 는 「인용문에 耳 가 한 글자라도 있으면 승격 실패」였다.
//   그 결과 FACE_OGWAN_R027(눈의 흰자·검은자 색으로 승격)까지 실패시켰다 — 오탐이다.
//   같은 인용문 안의 「聳耳入鬢」은 여전히 미계측이지만, 승격된 것은 **눈 부분**이다.
//   ⟹ 두 가지를 가른다.
//     ① 조건이 통째로 귀인 규칙   — 승격 자체가 위조다. 어떤 승격도 허용하지 않는다.
//     ② 귀가 조건의 일부인 규칙   — 다른 부위로의 승격은 허용한다.
//        단 ★귀 어절이 덮이지 않으므로 condition_coverage 가 **FULL 일 수 없다.**
//        (①의 결과인 condition_coverage 와 자동으로 맞물린다)
const organOf = (r) => ((r.condition && r.condition.organ) || '').replace(/\([^)]*\)/g, '').trim();
const predOf = (r) => (r.condition && r.condition.predicate_original) || '';
const EAR_RE = /耳|採聽|采聽/;
const isEarWhole = (r) => organOf(r) === '耳' || /^耳[大小長短]?$/.test(predOf(r).trim());
const earAll = rules.filter(r => EAR_RE.test(((r.citation && r.citation.text_original) || '') + organOf(r) + predOf(r)));
const earWhole = earAll.filter(isEarWhole);
const earPart = earAll.filter(r => !isEarWhole(r));

check('T-5a', '★조건이 통째로 귀인 규칙은 승격되지 않았다 (센서가 없는데 승격되면 위조다)', () => {
  const bad = earWhole.filter(r => { const to = best.get(r.rule_id); return to && ORDER[to] > ORDER[r.measurability]; });
  return {
    ok: bad.length === 0,
    detail: bad.length ? '★귀 전용 규칙 승격됨: ' + bad.map(r => r.rule_id).join(',')
      : `귀 전용 ${earWhole.length}건(${earWhole.map(r => r.rule_id).join(',')}) 전부 미승격`
  };
});
check('T-5b', '★귀가 일부인 규칙은 다른 부위로 승격되어도 되나 condition_coverage 가 FULL 이면 안 된다', () => {
  const bad = earPart.filter(r => r.condition_coverage === 'FULL');
  const promoted = earPart.filter(r => { const to = best.get(r.rule_id); return to && ORDER[to] > ORDER[r.measurability]; });
  return {
    ok: bad.length === 0,
    detail: bad.length ? '★귀가 안 덮이는데 FULL: ' + bad.map(r => r.rule_id).join(',')
      : `귀 일부 ${earPart.length}건 중 승격 ${promoted.length}건(${promoted.map(r => r.rule_id).join(',') || '없음'}) · 전부 FULL 아님`
  };
});
check('T-6', '★「清」 규칙은 승격되지 않았다 (색 축이 생겨도 원문이 기준을 안 준다)', () => {
  const q = rules.filter(r => /清|淸/.test((r.citation && r.citation.text_original) || ''));
  const bad = q.filter(r => { const to = best.get(r.rule_id); return to && ORDER[to] > ORDER[r.measurability]; });
  return { ok: bad.length === 0, detail: bad.length ? '★清 규칙 승격됨: ' + bad.map(r => r.rule_id).join(',') : `清 규칙 ${q.length}건 전부 미승격` };
});
check('T-7', '★MEASURABLE 로 오른 규칙은 threshold_origin 이 TEXT 다', () => {
  const bad = [];
  for (const [id, to] of best) {
    if (to !== 'MEASURABLE') continue;
    const r = byId.get(id);
    if (r.threshold_origin !== 'TEXT') bad.push(`${id}(${r.threshold_origin})`);
  }
  return { ok: bad.length === 0, detail: bad.length ? '★POPULATION 인데 MEASURABLE: ' + bad.join(',') : 'MEASURABLE 전건 TEXT' };
});

console.log('\n' + '='.repeat(78));
if (fails.length) { console.log('실패 내역'); fails.forEach(f => console.log('  FAIL ' + f)); }
console.log(`[p07_promote_tally] total=${total} pass=${pass} fail=${total - pass}`);
process.exit(fails.length ? 1 : 0);
