// ============================================================
//  _v808_work/p53_tojeong_body_eval.js — 트랙 F3 ③ 토정 1935본 본문 144쪽 블라인드 판독 평가
//  사전 등록: _v808_work/사전등록_P-808-F3b_토정본문판독.md  (판독 전 고정)
//  node _v808_work/p53_tojeong_body_eval.js   (IP 필요: ../ChunWoon_IP/tojeong/read_f3b)
//  ★판정·강등 규칙을 IP 판정 스크립트와 독립으로 다시 구현해 대조한다(W5).
// ============================================================
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const RD = path.join(ROOT, '..', 'ChunWoon_IP', 'tojeong', 'read_f3b');
const res = []; const ok = (id, cond, msg) => res.push({ id, pass: !!cond, msg });
const J = (f) => { try { return JSON.parse(fs.readFileSync(path.join(RD, f), 'utf8')); } catch (e) { return null; } };
const PAGES = []; for (let n = 5; n <= 148; n++) PAGES.push('p' + String(n).padStart(3, '0'));
// ★판독 전 개정 1(사전 등록 §8): 칸 목록은 자르기 결과(segment_report.cells)가 정한다 — 기본 U01~U18 · L01~L18 · H.
const SEG0 = (() => { try { return JSON.parse(fs.readFileSync(path.join(RD, 'segment_report.json'), 'utf8')); } catch (e) { return null; } })();
const CELLS = (SEG0 && Array.isArray(SEG0.cells)) ? SEG0.cells.slice() : [];
const SLOTS_OF = (p) => CELLS.filter(c => c.startsWith(p + '_')).map(c => c.slice(5));
const SORDER = (s) => s === 'H' ? 999 : (s[0] === 'U' ? 0 : 100) + parseInt(s.slice(1), 10);
const FIELDS = ['han', 'kor'];
const MONTHS = ['寅卯', '辰巳', '午未', '申酉', '戌亥', '子丑'];

const SEG = SEG0;
const SEC = J('SECRET_id_to_cell.json');
const R = { A: J('readA.json'), B: J('readB.json'), C: J('readC.json') };
const ADJ = J('adjudicated.json');

// W1 자르기
(() => {
  let good = !!SEG && SEG.pages && CELLS.length > 0, miss = 0, unhandled = 0, base = 0, irr = [], dup = CELLS.length - new Set(CELLS).size;
  if (good) {
    for (const c of CELLS) if (!fs.existsSync(path.join(RD, 'cells', c + '.png'))) miss++;
    let extra = 0; try { for (const f of fs.readdirSync(path.join(RD, 'cells'))) if (!CELLS.includes(f.replace(/\.png$/, ''))) extra++; } catch (e) { extra = -1; }
    if (extra !== 0) good = false;
    for (const p of PAGES) {
      const s = SEG.pages[p]; if (!s || !['auto', 'manual', 'irregular'].includes(s.status)) { unhandled++; continue; }
      const sl = SLOTS_OF(p), u = sl.filter(x => x[0] === 'U').length, l = sl.filter(x => x[0] === 'L').length, h = sl.filter(x => x === 'H').length;
      if (u === 18 && l === 18 && h === 1) base++; else irr.push(p + ':' + u + '/' + l + '/' + h);
      if (u < 1 || l < 1 || h !== 1) unhandled++;
      if (s.status === 'irregular' && !(irr.length && irr[irr.length - 1].startsWith(p))) unhandled++;
    }
  }
  ok('W1', good && miss === 0 && unhandled === 0 && dup === 0, '자르기 ' + CELLS.length + '칸 · 없는 칸 ' + miss + ' · 미처리 ' + unhandled + ' · 기본 구조 ' + base + '쪽 · 기본 아님 ' + (irr.join(',') || '0'));
})();

// W2 블라인드 시트
(() => {
  let good = !!SEC, why = '';
  for (const k of ['A', 'B']) {
    if (!good) break;
    const m = SEC[k] || {}; const ids = Object.keys(m);
    const cellset = new Set(Object.values(m));
    if (!CELLS.length || ids.length !== CELLS.length || cellset.size !== CELLS.length || !CELLS.every(c => cellset.has(c))) { good = false; why = k + ' ' + ids.length; break; }
    if (ids.some(id => /p\d{3}|[UL]\d{2}/.test(id))) { good = false; why = k + ' ID 누설'; break; }
    const order = (SEC.order && SEC.order[k]) || [];
    if (order.length !== ids.length) { good = false; why = k + ' order'; break; }
    let same = 0; for (let i = 1; i < order.length; i++) if (m[order[i]].slice(0, 4) === m[order[i - 1]].slice(0, 4)) same++;
    if (same / order.length >= 0.05) { good = false; why = k + ' 연속 ' + same; }
  }
  ok('W2', good, '블라인드 시트 A·B ' + CELLS.length + ' · 섞음 · ID 무정보 ' + why);
})();

// W3 판독 파일
(() => {
  let good = !!SEC && !!R.A && !!R.B, why = '';
  for (const k of ['A', 'B']) {
    if (!good) break;
    const r = R[k], ids = Object.keys(SEC[k] || {}).sort(), got = Object.keys((r && r.cells) || {}).sort();
    if (!(r.meta && r.meta.blind === true)) { good = false; why = k + ' blind'; }
    else if (!(Array.isArray(r.meta.shards) && r.meta.shards.length >= 2)) { good = false; why = k + ' shards'; }
    else if (JSON.stringify(ids) !== JSON.stringify(got)) { good = false; why = k + ' ids ' + got.length; }
  }
  ok('W3', good, '판독 A·B · blind · 묶음 ≥2 · ' + CELLS.length + ' ID ' + why);
})();

// 독립 판정
const norm = (s) => s == null ? null : String(s).normalize('NFC').replace(/\s+/g, '');
function val(r, id, f) {
  const c = r && r.cells && r.cells[id]; if (!c) return null;
  const v = norm(c[f]); let cf = (c.conf && c.conf[f]) || 'low';
  if (v && v.includes('□')) cf = 'low';
  return { v: v === '' ? null : v, conf: cf };
}
function judge(reads) {
  const ks = Object.keys(reads).filter(k => reads[k]);
  for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) {
    const a = reads[ks[i]], b = reads[ks[j]];
    if (a.v != null && a.v === b.v && a.conf !== 'low' && b.conf !== 'low') {
      if (ks[i] === 'A' && ks[j] === 'B') return { status: 'VERIFIED', value: a.v };
      if (ks.includes('C')) return { status: 'VERIFIED', value: a.v };
    }
  }
  return { status: 'UNRESOLVED', value: null };
}
const inv = {}; if (SEC) for (const k of ['A', 'B', 'C']) { inv[k] = {}; for (const [id, c] of Object.entries(SEC[k] || {})) inv[k][c] = id; }
const mine = {};
if (SEC && R.A && R.B) for (const c of CELLS) {
  mine[c] = {};
  for (const f of FIELDS) {
    const ab = { A: val(R.A, inv.A[c], f), B: val(R.B, inv.B[c], f) };
    let j = judge(ab);
    if (j.status !== 'VERIFIED' && R.C && inv.C[c]) j = judge({ ...ab, C: val(R.C, inv.C[c], f) });
    mine[c][f] = j;
  }
}
// 강등 ①: 월 표지 순서 (사전 등록 §4)
const monthOf = (v) => { if (!v || !/之月$/.test(v)) return -1; return MONTHS.indexOf(v.slice(0, 2)); };
function demote(tab) {
  for (const p of PAGES) {
    const marks = SLOTS_OF(p).sort((x, y) => SORDER(x) - SORDER(y)).map(s => ({ c: p + '_' + s, m: tab[p + '_' + s] && tab[p + '_' + s].han && tab[p + '_' + s].han.status === 'VERIFIED' ? monthOf(tab[p + '_' + s].han.value) : -1 })).filter(x => x.m >= 0);
    const bad = new Set();
    for (let i = 0; i < marks.length; i++) for (let j = i + 1; j < marks.length; j++) if (!(marks[i].m < marks[j].m)) { bad.add(marks[i].c); bad.add(marks[j].c); }
    for (const c of bad) tab[c].han = { status: 'UNRESOLVED', value: null, why: 'STRUCT_CONFLICT' };
  }
}
if (Object.keys(mine).length) demote(mine);

// W4 · W5
(() => {
  let good = !!ADJ && ADJ.cells && CELLS.length > 0 && CELLS.every(c => ADJ.cells[c]), diff = 0, badv = 0;
  if (good) for (const c of CELLS) for (const f of FIELDS) {
    const a = ADJ.cells[c][f];
    if (!a || !['VERIFIED', 'UNRESOLVED'].includes(a.status)) { good = false; continue; }
    if (a.status === 'VERIFIED') { const rv = Object.values(a.reads || {}).filter(Boolean).map(x => norm(x.v)); if (!rv.includes(a.value)) badv++; }
    const m = mine[c] && mine[c][f];
    if (!m || m.status !== a.status || (m.status === 'VERIFIED' && m.value !== a.value)) diff++;
  }
  ok('W4', good && badv === 0, 'adjudicated ' + CELLS.length + '칸 · status · VERIFIED ⊂ 판독값 (bad ' + badv + ')');
  ok('W5', good && diff === 0, '독립 재판정(강등 포함) = adjudicated (불일치 ' + diff + ')');
})();

// W6 · W7
(() => {
  if (!ADJ || !ADJ.cells) { ok('W6', false, 'adjudicated 없음'); ok('W7', false, 'adjudicated 없음'); return; }
  let viol = 0;
  for (const p of PAGES) {
    let last = -1;
    for (const s of SLOTS_OF(p).sort((x, y) => SORDER(x) - SORDER(y))) { const h = ADJ.cells[p + '_' + s] && ADJ.cells[p + '_' + s].han; const m = h && h.status === 'VERIFIED' ? monthOf(h.value) : -1; if (m >= 0) { if (m <= last) viol++; last = m; } }
  }
  ok('W6', viol === 0, 'VERIFIED 월 표지 순서 위반 ' + viol);
  const cnt = { han: 0, kor: 0 }; let not4 = 0;
  for (const c of CELLS) for (const f of FIELDS) if (ADJ.cells[c][f] && ADJ.cells[c][f].status === 'VERIFIED') { cnt[f]++; if (f === 'han' && !c.endsWith('_H') && [...ADJ.cells[c].han.value].length !== 4) not4++; }
  ok('W7', true, '보고: VERIFIED han ' + cnt.han + ' · kor ' + cnt.kor + ' / ' + CELLS.length + ' · 4자 아닌 han ' + not4);
})();

// W8 IP 격리
// ★사후 개정(2026-10-19 · 판독 뒤 · 사전 등록 §9): 검토한 우연 일치 1건만 예외 — 관상 인수인계 문서의 통용 4자 술어(토정 원문 사본 아님).
//  구절은 저장소에 쓰지 않고 sha256 앞 16자로만 지정한다. 판정 기준(어떤 VERIFIED 구절이든 1개면 FAIL)은 그대로.
const W8_EXEMPT = [{ file: '천운_인수인계_v790_눈썹계측정정_相理衡眞捷徑직독_2026-09-23.md', sha16: 'd05c1251c5d99f78' }];
(() => {
  const hits = []; const phr = new Set(); let exempted = 0;
  if (ADJ && ADJ.cells) for (const c of CELLS) { const h = ADJ.cells[c].han; if (h && h.status === 'VERIFIED' && h.value && monthOf(h.value) < 0 && [...h.value].length >= 4) phr.add(h.value); }
  const walk = (d, deep) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (['.git', 'node_modules'].includes(e.name) || e.name.startsWith('backup')) continue;
    const q = path.join(d, e.name);
    if (e.isDirectory()) { if (deep) walk(q, deep); continue; }
    if (/^(read[ABC]|adjudicated|SECRET_id_to_cell|segment_report)\.json$/.test(e.name)) hits.push(q);
    else if (phr.size && /\.(js|json|html|md|txt)$/.test(e.name) && fs.statSync(q).size < 3e6) {
      const t = fs.readFileSync(q, 'utf8');
      for (const s of phr) if (t.includes(s)) {
        const hs = require('crypto').createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 16);
        if (W8_EXEMPT.some(x => x.file === e.name && x.sha16 === hs)) { exempted++; continue; }
        hits.push(q + ':' + s.length); break;
      }
    }
  } };
  try {
    walk(ROOT, false);
    for (const d of ['api', 'js', 'eval', '_v808_work']) if (fs.existsSync(path.join(ROOT, d))) walk(path.join(ROOT, d), true);
    // 저장소 전체에서 판독 JSON 사본 이름만 확인
    const walkName = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (['.git', 'node_modules'].includes(e.name) || e.name.startsWith('backup')) continue; const q = path.join(d, e.name); if (e.isDirectory()) walkName(q); else if (/^(read[ABC]|adjudicated|SECRET_id_to_cell)\.json$/.test(e.name) && !hits.includes(q)) hits.push(q); } };
    walkName(ROOT);
  } catch (e) {}
  ok('W8', hits.length === 0, 'IP 격리: 사본·구절 ' + hits.length + ' · 검토 예외 ' + exempted + (hits.length ? ' ' + hits.slice(0, 3).join(' | ') : ''));
})();

for (const r of res) console.log((r.pass ? '  ok   ' : '  FAIL ') + r.id + ' ' + r.msg);
const pass = res.filter(r => r.pass).length;
console.log('p53 ' + pass + '/' + res.length);
process.exitCode = pass === res.length ? 0 : 1;
