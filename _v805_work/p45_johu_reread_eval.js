// ============================================================
//  v805 p45 — 트랙 E1: 조후 120칸 원문 재판독(블라인드 2판독) → VERIFIED_FLAT 만 확정
//  node _v805_work/p45_johu_reread_eval.js   (IP 필요: ../ChunWoon_IP)
//  ★판독 전 작성(Eval-First) · 기준 = _v805_work/사전등록_P-805-E1_조후120칸_원문재판독.md
// ============================================================
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), cp = require('child_process'), os = require('os');
const ROOT = path.join(__dirname, '..');
const IPR = path.join(ROOT, '..', 'ChunWoon_IP');
const PKG = [process.env.CHUNWOON_GATE_PKG, path.join(IPR, 'gate_pkg')].find(p => p && fs.existsSync(p));
const RD = path.join(IPR, 'saju', 'johu_read');
let total = 0, pass = 0; const fails = [];
const check = (id, name, ok, d) => { total++; if (ok) pass++; else fails.push(id); console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${id} ${name}${d ? ' — ' + d : ''}`); };
const J = p => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; } };
const ST = '甲乙丙丁戊己庚辛壬癸'.split(''), BR = '寅卯辰巳午未申酉戌亥子丑'.split('');
const CELLS = []; for (const s of ST) for (const b of BR) CELLS.push(s + b);
const A = J(path.join(RD, 'readA.json')), B = J(path.join(RD, 'readB.json'));
const STEMS = new Set('甲乙丙丁戊己庚辛壬癸'.split(''));
const okOrder = o => Array.isArray(o) && o.length >= 1 && o.every(x => STEMS.has(x));
// J1
{ const miss = []; for (const [nm, R] of [['A', A], ['B', B]]) { if (!R || !R.cells) { miss.push(nm + ' 없음'); continue; }
    for (const c of CELLS) { const x = R.cells[c]; if (!x || !Array.isArray(x.pages) || !x.pages.length || !['FLAT', 'CONDITIONAL', 'UNRESOLVED'].includes(x.structure) || typeof x.quote !== 'string' || (x.structure === 'FLAT' && !okOrder(x.order))) miss.push(nm + ':' + c); } }
  check('J1', '판독 A·B 120칸 전부 기록(pages·structure·quote · FLAT 은 order)', miss.length === 0, miss.length ? `누락/형식 ${miss.length} · ${miss.slice(0, 6).join(' ')}` : ''); }
// J2
{ let ok = true, d = ''; const pf = path.join(RD, 'prompt_reader.md');
  const P = fs.existsSync(pf) ? fs.readFileSync(pf, 'utf8') : ''; const sha = crypto.createHash('sha256').update(P).digest('hex').slice(0, 16);
  if (!P) { ok = false; d = '판독 지시문 없음'; }
  if (/johu_table|"寅"\s*:\s*\[|丙火為尊|engine_order/.test(P)) { ok = false; d += ' · 지시문에 표/엔진 흔적'; }
  for (const [nm, R] of [['A', A], ['B', B]]) { if (!R || !R.meta || R.meta.blind !== true || R.meta.prompt_sha16 !== sha) { ok = false; d += ` · ${nm} meta(blind/prompt_sha) 불일치`; } }
  if (A && B && A.meta && B.meta && A.meta.reader_ids && B.meta.reader_ids && A.meta.reader_ids.some(r => B.meta.reader_ids.includes(r))) { ok = false; d += ' · A·B 판독자 중복'; }
  check('J2', '블라인드: 지시문에 표 값 없음 · meta blind · A·B 판독자 분리', ok, d || 'prompt ' + sha); }
// 판정 규칙(독립 재계산)
const verdict = {}; if (A && B && A.cells && B.cells) for (const c of CELLS) { const a = A.cells[c] || {}, b = B.cells[c] || {};
  // ★사후 강화(2026-10-15 · 완화 아님): 판독자 메모에 「先後 명시 없음·서열은 해석」이 적힌 칸이 일치 집합에 섞여 있어(辛巳·乙申 등),
  //   두 판독 모두 confidence=high 인 칸만 VERIFIED_FLAT 로 한다(106 → 80). 주용신이 기존과 다른 칸(乙申·丁寅)은 이 규칙으로 모두 강등됨.
  verdict[c] = (a.structure === 'FLAT' && b.structure === 'FLAT' && okOrder(a.order) && JSON.stringify(a.order) === JSON.stringify(b.order) && a.confidence === 'high' && b.confidence === 'high') ? 'VERIFIED_FLAT' : 'CONDITION_UNRESOLVED'; }
const RES = J(path.join(RD, 'johu_reread_result.json'));
// J3
{ let bad = []; if (!RES || !RES.verdict) bad.push('결과 파일 없음'); else for (const c of CELLS) if (RES.verdict[c] !== verdict[c]) bad.push(c);
  const nv = Object.values(verdict).filter(v => v === 'VERIFIED_FLAT').length;
  check('J3', '판정 재현(VERIFIED_FLAT = A·B FLAT ∧ order 일치 ∧ 사후: 둘 다 high)', bad.length === 0 && Object.keys(verdict).length === 120, `VERIFIED_FLAT ${nv}/120${bad.length ? ' · 불일치 ' + bad.slice(0, 6).join(' ') : ''}`); }
// J4
const T = PKG ? J(path.join(PKG, 'IP', 'rules', 'saju', 'johu_table.json')) : null;
{ const bad = []; if (!T || !T.table || !T.cell_status_v3) bad.push('표 cell_status_v3 없음');
  else for (const c of CELLS) { const s = c[0], b = c[1], st = (T.cell_status_v3[s] || {})[b];
    if (st !== verdict[c]) bad.push(c + ' 상태'); else if (st === 'VERIFIED_FLAT' && JSON.stringify(T.table[s][b]) !== JSON.stringify(A.cells[c].order)) bad.push(c + ' 순서'); }
  check('J4', '새 표: VERIFIED_FLAT 칸 순서 = 판독 order · 칸별 상태 표기(cell_status_v3)', bad.length === 0, bad.slice(0, 6).join(' ')); }
// J5
{ let bad = [], n = 0; try { const E = require(path.join(PKG, 'engine', 'johu_engine.js'));
    for (const c of CELLS) if (verdict[c] === 'VERIFIED_FLAT') { n++; const ord = A.cells[c].order; const P = [{ s: '甲', b: '子' }, { s: '甲', b: c[1] }, { s: c[0], b: '子' }, { s: '甲', b: '子' }];
      const o = E.computeJohu(P); const got = [o.johu_yongsin].concat(o.aux || []); if (JSON.stringify(got) !== JSON.stringify(ord) || o.cell_status !== 'VERIFIED_FLAT') bad.push(c); } } catch (e) { bad.push('엔진 ' + e.message.slice(0, 60)); }
  check('J5', '엔진이 VERIFIED_FLAT 칸에서 판독 순서·상태를 그대로 냄', n > 0 && bad.length === 0, `대상 ${n}${bad.length ? ' · ' + bad.slice(0, 6).join(' ') : ''}`); }
// J6
{ const AU = require(path.join(ROOT, 'api', '_engine', 'authority.js')); let okP = false; try { const R = fs.readFileSync(path.join(PKG, 'eval', 'run_eval.js'), 'utf8'); const m = R.match(/CW_PROMOTED\s*=\s*CW_PROMOTED_V770\.concat\(\[([^\]]*)\]\)/); okP = !!m && m[1].replace(/[\s'"]/g, '') === 'iljin_ganzi,sinsal'; } catch (e) {}
  check('J6', 'authority johu DENY · CW_PROMOTED 불변', AU.userSurfaceable('johu') === false && okP, ''); }
// J7
{ let out = ''; try { out = cp.execFileSync(process.execPath, [path.join(__dirname, 'p44_shadow_engine_eval.js')], { encoding: 'utf8', env: process.env }); } catch (e) { out = String(e.stdout || ''); }
  const m = out.match(/total=(\d+) pass=(\d+) fail=(\d+)/); const SB = path.join(ROOT, 'api', '_engine', 'shadow', 'IP', 'rules', 'saju', 'johu_table.json');
  let okS = false; try { okS = !!JSON.parse(fs.readFileSync(SB, 'utf8')).cell_status_v3; } catch (e) {}
  check('J7', 'shadow 배포판 재생성(cell_status_v3 포함) · p44 전부 통과', !!m && m[3] === '0' && okS, m ? m[0] + ` · 배포판 상태표 ${okS}` : 'p44 실행 실패'); }
// J8
{ const D = J(path.join(RD, 'johu_reread_diff.json')); const ok = !!D && Array.isArray(D.changed) && typeof D.summary === 'object' && D.changed.every(x => x.cell && x.old && x.new && x.reason);
  check('J8', '차이표(기존 대비 바뀐 칸·사유)', ok, D ? `바뀐 칸 ${(D.changed || []).length} · ${JSON.stringify(D.summary || {}).slice(0, 80)}` : '없음'); }
console.log(`[p45_johu_reread] total=${total} pass=${pass} fail=${total - pass}${fails.length ? ' · FAIL ' + fails.join(',') : ''}`);
process.exitCode = fails.length ? 1 : 0;
