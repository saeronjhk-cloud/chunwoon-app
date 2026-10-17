// ============================================================
//  v805 p47 — 트랙 E2: 격국 명칭 규칙(子平眞詮 원저 단독본) 블라인드 2판독 → 확정 규칙으로 엔진 전수 대조
//  node _v805_work/p47_gyeok_rule_reread_eval.js   (IP 필요)
//  ★판독 전 작성(Eval-First) · 기준 = _v805_work/사전등록_P-805-E2_격국명칭규칙_원문판독.md
//  ★검증기의 기대값은 판독 확정 답만으로 만든다(엔진 코드를 require 하는 것은 대조 대상 산출뿐).
//    지장간 구성은 판독 대상이 아니라 엔진 jijanggan 표를 쓴다(사전 등록의 한계).
// ============================================================
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const IPR = path.join(ROOT, '..', 'ChunWoon_IP');
const PKG = [process.env.CHUNWOON_GATE_PKG, path.join(IPR, 'gate_pkg')].find(p => p && fs.existsSync(p));
const RD = path.join(IPR, 'saju', 'gyeok_read');
let total = 0, pass = 0; const fails = [];
const check = (id, name, ok, d) => { total++; if (ok) pass++; else fails.push(id); console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${id} ${name}${d ? ' — ' + d : ''}`); };
const J = p => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; } };
const ENUM = { G1: ['YES', 'NO', 'NOT_STATED'], G2: ['YES', 'NO', 'CONDITIONAL', 'NOT_STATED'], G3: ['BENGI_FIRST', 'OTHER_FIRST', 'BY_STRENGTH', 'CONDITIONAL', 'NOT_STATED'],
  G4: ['BENGI', 'UNDETERMINED', 'CONDITIONAL', 'NOT_STATED'], G5: ['YES', 'NO', 'CONDITIONAL', 'NOT_STATED'], G6: ['REVEALED_ELSE_BENGI', 'REVEALED_ELSE_UNDETERMINED', 'CONDITIONAL', 'NOT_STATED'],
  G7: ['ROK_PATTERN_USE_OTHER', 'ROK_IS_USE', 'NOT_STATED'], G8: ['YANGIN_PATTERN', 'OTHER', 'NOT_STATED'], G9: ['YANG_ONLY', 'ALL_STEMS', 'NOT_STATED'], G10: ['SAME_AS_ROK', 'OTHER', 'NOT_STATED'] };
const IDS = Object.keys(ENUM);
const A = J(path.join(RD, 'readA.json')), B = J(path.join(RD, 'readB.json'));
// R1
{ const bad = []; for (const [nm, R] of [['A', A], ['B', B]]) { if (!R || !R.items) { bad.push(nm + ' 없음'); continue; }
    for (const g of IDS) { const x = R.items[g]; if (!x || !['FLAT', 'CONDITIONAL', 'UNRESOLVED'].includes(x.structure) || !ENUM[g].includes(x.answer) || !Array.isArray(x.pages) || !x.pages.length || typeof x.quote !== 'string' || !['high', 'mid', 'low'].includes(x.confidence)) bad.push(nm + ':' + g); } }
  check('R1', '판독 A·B G1~G10 전부(열거값·pages·quote·confidence)', bad.length === 0, bad.slice(0, 6).join(' ')); }
// R2
{ let ok = true, d = ''; const pf = path.join(RD, 'prompt_reader_gyeok.md'); const P = fs.existsSync(pf) ? fs.readFileSync(pf, 'utf8') : '';
  const sha = crypto.createHash('sha256').update(P).digest('hex').slice(0, 16);
  if (!P) { ok = false; d = '지시문 없음'; }
  if (/gyeok_by_sipsin|jeonggi|정기→중기→여기|computeGyeokguk|special_when_peer/.test(P)) { ok = false; d += ' · 지시문에 엔진 흔적'; }
  for (const [nm, R] of [['A', A], ['B', B]]) if (!R || !R.meta || R.meta.blind !== true || R.meta.prompt_sha16 !== sha) { ok = false; d += ` · ${nm} meta 불일치`; }
  if (A && B && A.meta && B.meta && A.meta.reader_ids && B.meta.reader_ids && A.meta.reader_ids.some(r => B.meta.reader_ids.includes(r))) { ok = false; d += ' · 판독자 중복'; }
  check('R2', '블라인드(지시문 sha · meta · 판독자 분리 · 엔진 흔적 없음)', ok, d || 'prompt ' + sha); }
// R3 확정 판정(독립 재계산)
const conf = {}; if (A && B && A.items && B.items) for (const g of IDS) { const a = A.items[g] || {}, b = B.items[g] || {};
  conf[g] = (a.structure === 'FLAT' && b.structure === 'FLAT' && a.answer === b.answer && a.confidence === 'high' && b.confidence === 'high') ? a.answer : null; }
// ★사후(2026-10-17 · 제이 결정 「사람 대신 외부 자문」): 외부 자문 R1(Gemini·ChatGPT) 확정분을 더한다 — 확정 규칙은 사전 고정
//   (둘 다 같은 답 = 두 판독 공통 답 ∧ 둘 다 high ∧ 인용 실재). conf 를 바꾸는 것은 외부 확정뿐이다(판독 확정 집합은 R3/R4 에서 따로 본다).
const EXT = J(path.join(RD, 'external_r1.json'));
const confReaders = Object.assign({}, conf);
if (EXT && EXT.items) for (const g of Object.keys(EXT.items)) { const x = EXT.items[g], ga = x.gemini, ca = x.chatgpt;
  if (!conf[g] && ga.answer === ca.answer && ga.answer === x.readers && ga.confidence === 'high' && ca.confidence === 'high' && ga.quote_ok === true && ca.quote_ok === true) conf[g] = x.readers; }
const RULES = J(path.join(RD, 'gyeok_rules_v1.json'));
{ const bad = []; if (!RULES || !RULES.confirmed) bad.push('규칙 파일 없음'); else for (const g of IDS) if ((RULES.confirmed[g] || null) !== confReaders[g]) bad.push(g);
  check('R3', '확정 판정 재현(두 판독 FLAT·같은 답·둘 다 high)', bad.length === 0, `확정 ${IDS.filter(g => conf[g]).map(g => g + '=' + conf[g]).join(' ')}${bad.length ? ' · 불일치 ' + bad.join(',') : ''}`); }
// R4
{ let ok = false; try { const exp = JSON.stringify({ version: 'gyeok-rules/1.0.0', source_sha16: '71402a780b0351b5', confirmed: confReaders }); ok = !!RULES && JSON.stringify({ version: RULES.version, source_sha16: RULES.source_sha16, confirmed: RULES.confirmed }) === exp; } catch (e) {}
  check('R4', '규칙 파일 = 확정 답에서 결정론적 생성', ok, ''); }
// R5 독립 검증기
const ST = '甲乙丙丁戊己庚辛壬癸'.split(''), BR = '子丑寅卯辰巳午未申酉戌亥'.split('');
const EL = s => Math.floor(ST.indexOf(s) / 2), YANG = s => ST.indexOf(s) % 2 === 0;
const ROK = { 甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子' };
const YANGIN_YANG = { 甲: '卯', 丙: '午', 戊: '午', 庚: '酉', 壬: '子' };
const ZAQI = new Set(['辰', '戌', '丑', '未']);
const TRIAD = b => ['申子辰', '寅午戌', '巳酉丑', '亥卯未'].find(g => g.indexOf(b) !== -1);
function expected(D, Bm, rev, JJG, others) {   // → {kind:'label',v} | {kind:'stem',v} | null(HOLD)
  const c = conf;
  if (c.G1 !== 'YES') return null;
  // ★사후 강화(원문 p31 「支全卯未則化為印」 · p41 「逢申與子會局則用水印」 — 會支도 격을 바꾼다. 엔진은 會局 미반영):
  //   월지와 같은 삼합 무리의 지지가 연·일·시지에 있으면 HOLD.
  if (others && others.some(b => b !== Bm && TRIAD(b) === TRIAD(Bm))) return null;
  if (YANGIN_YANG[D] === Bm) return c.G8 === 'YANGIN_PATTERN' ? { kind: 'label', v: '양인격' } : null;
  if (ROK[D] === Bm) return c.G7 === 'ROK_PATTERN_USE_OTHER' ? { kind: 'label', v: '건록격' } : null;
  const hid = JJG[Bm].map(x => x[0]), bengi = hid[hid.length - 1];
  if (!YANG(D) && c.G9 !== 'YANG_ONLY') { /* 음간 양인 성립 여부 미확정 → 음간에서 양인 후보 지지는 HOLD */ const YIN_YANGIN = { 乙: '辰', 丁: '未', 己: '未', 辛: '戌', 癸: '丑' }; if (YIN_YANGIN[D] === Bm) return null; }
  // ★사후 강화(2026-10-17 · 완화 아님): 질문지의 月劫 정의(월지 본기 = 겁재)와 「월지 = 겁재 천간의 祿」 정의가 둘 다 맞는 경우만 판정
  //   (乙寅·丁巳·辛申·癸亥). 두 정의가 갈리는 己辰·己戌·戊丑·戊未 등은 HOLD.
  if (EL(bengi) === EL(D) && bengi !== D) return (c.G10 === 'SAME_AS_ROK' && ROK[bengi] === Bm) ? { kind: 'label', v: '월겁격' } : null;
  const shown = hid.filter(h => rev.includes(h));
  let pick = null;
  if (ZAQI.has(Bm)) { if (c.G6 === 'REVEALED_ELSE_BENGI' || c.G6 === 'REVEALED_ELSE_UNDETERMINED') { if (!shown.length) { if (c.G6 === 'REVEALED_ELSE_BENGI') pick = bengi; else return null; } } else return null; }
  if (!pick) {
    if (!shown.length) { if (c.G4 === 'BENGI') pick = bengi; else return null; }
    else if (shown.includes(bengi)) { if (c.G2 !== 'YES') return null; if (shown.length > 1 && c.G3 !== 'BENGI_FIRST') return null; pick = bengi; }
    else { if (c.G5 !== 'YES' || c.G2 !== 'YES' || shown.length > 1) return null; pick = shown[0]; }
  }
  if (EL(pick) === EL(D)) return null;   // 비겁 투출로 격이 정해지는 경우는 질문지 범위 밖 → HOLD
  return { kind: 'stem', v: pick };
}
{ let det = 0, all = 0, mism = [], err = '';
  try { const E = require(path.join(PKG, 'engine', 'gyeokguk_engine.js')); const JJG = JSON.parse(fs.readFileSync(path.join(PKG, 'IP', 'rules', 'saju', 'jijanggan.json'), 'utf8')).table;
    if (A && B) for (const D of ST) for (const Bm of BR) { const db = BR.find(b => BR.indexOf(b) % 2 === ST.indexOf(D) % 2);
      for (const Y of ST) for (const M of ST.filter(s => ST.indexOf(s) % 2 === BR.indexOf(Bm) % 2)) for (const H of ST) { all++;
        const ex = expected(D, Bm, [Y, M, H], JJG, [BR[ST.indexOf(Y) % 2], db, BR[ST.indexOf(H) % 2]]); if (!ex) continue; det++;
        const P = [{ s: Y, b: BR[ST.indexOf(Y) % 2] }, { s: M, b: Bm }, { s: D, b: db }, { s: H, b: BR[ST.indexOf(H) % 2] }];
        const o = E.computeGyeokguk(P); const got = ex.kind === 'label' ? o.gyeok : o.gyeok_stem;
        if (got !== ex.v || (ex.kind === 'stem' && /건록|양인|월겁/.test(o.gyeok || ''))) { if (mism.length < 2000) mism.push(`${D}${Bm} ${Y}${M}${H} exp ${ex.v} got ${o.gyeok}/${o.gyeok_stem}`); } } } } catch (e) { err = e.message.slice(0, 80); }
  const R = J(path.join(RD, 'gyeok_verify_report.json'));
  const okRep = !!R && R.all === all && R.determinate === det && R.mismatch === mism.length;
  check('R5', '검증기 60,000 경우: 결정 가능 경우 불일치 0 · 보고서 수치 일치', !err && all > 0 && det > 0 && mism.length === 0 && okRep, err || `전체 ${all} · 결정 가능 ${det}(${all ? (100 * det / all).toFixed(1) : 0}%) · 불일치 ${mism.length}${mism.length ? ' · ' + mism.slice(0, 3).join(' / ') : ''}${okRep ? '' : ' · 보고서 불일치/없음'}`); }
// R6
{ const AU = require(path.join(ROOT, 'api', '_engine', 'authority.js')); let okP = false; try { const R = fs.readFileSync(path.join(PKG, 'eval', 'run_eval.js'), 'utf8'); const m = R.match(/CW_PROMOTED\s*=\s*CW_PROMOTED_V770\.concat\(\[([^\]]*)\]\)/); okP = !!m && m[1].replace(/[\s'"]/g, '') === 'iljin_ganzi,sinsal,johu_cell'; } catch (e) {}
  check('R6', 'authority gyeok DENY · CW_PROMOTED 불변', AU.userSurfaceable('gyeok') === false && okP, ''); }
// R7
{ const R = J(path.join(RD, 'gyeok_verify_report.json')); const ok = !!R && Array.isArray(R.confirmed_items) && Array.isArray(R.unconfirmed_items) && typeof R.coverage_pct === 'number' && typeof R.mismatch_handling === 'string';
  check('R7', '보고서(확정/미확정 질문 · 커버리지 · 불일치 처리)', ok, R ? `커버리지 ${R.coverage_pct}%` : '없음'); }
console.log(`[p47_gyeok_rule_reread] total=${total} pass=${pass} fail=${total - pass}${fails.length ? ' · FAIL ' + fails.join(',') : ''}`);
process.exitCode = fails.length ? 1 : 0;
