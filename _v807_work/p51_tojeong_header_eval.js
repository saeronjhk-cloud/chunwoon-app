// ============================================================
//  _v807_work/p51_tojeong_header_eval.js — 트랙 F3 ② 토정 1935본 괘 머리 144 블라인드 판독 평가
//  사전 등록: _v807_work/사전등록_P-807-F3a_토정괘머리판독.md  (판독 전 고정)
//  node _v807_work/p51_tojeong_header_eval.js   (IP 필요: ../ChunWoon_IP/tojeong/read_f3)
//  ★판정 규칙을 IP 의 판정 스크립트와 독립으로 다시 구현해 대조한다(Z3).
// ============================================================
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const RD = path.join(ROOT, '..', 'ChunWoon_IP', 'tojeong', 'read_f3');
const res = []; const ok = (id, cond, msg) => res.push({ id, pass: !!cond, msg });
const J = (f) => { try { return JSON.parse(fs.readFileSync(path.join(RD, f), 'utf8')); } catch (e) { return null; } };
const PAGES = []; for (let n = 5; n <= 148; n++) PAGES.push('p' + String(n).padStart(3, '0'));
const FIELDS = ['num', 'tri3', 'gua'];

const SEC = J('SECRET_id_to_page.json');
const R = { A: J('readA.json'), B: J('readB.json'), C: J('readC.json') };
const ADJ = J('adjudicated.json'); const PM = J('page_map.json');

// Z1
(() => {
  let good = !!SEC && !!R.A && !!R.B, why = '';
  for (const k of ['A', 'B']) {
    if (!good) break;
    const r = R[k], ids = Object.keys((SEC && SEC[k]) || {}).sort(), got = Object.keys((r && r.cells) || {}).sort();
    if (!(r.meta && r.meta.blind === true)) { good = false; why = k + ' blind'; }
    else if (ids.length !== 144 || JSON.stringify(ids) !== JSON.stringify(got)) { good = false; why = k + ' ids ' + got.length; }
  }
  ok('Z1', good, '판독 A·B 파일 · blind · 144 ID ' + why);
})();

// 독립 판정
function val(r, id, f) {
  const c = r && r.cells && r.cells[id]; if (!c) return null;
  const v = c[f] == null ? null : String(c[f]).trim(); const cf = (c.conf && c.conf[f]) || 'low';
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
const inv = {}; if (SEC) for (const k of Object.keys(SEC)) { inv[k] = {}; for (const [id, p] of Object.entries(SEC[k])) inv[k][p] = id; }
const mine = {};
if (SEC && R.A && R.B) for (const p of PAGES) {
  mine[p] = {};
  for (const f of FIELDS) {
    const ab = { A: val(R.A, inv.A[p], f), B: val(R.B, inv.B[p], f) };
    let j = judge(ab);
    if (j.status !== 'VERIFIED' && R.C && inv.C && inv.C[p]) j = judge({ ...ab, C: val(R.C, inv.C[p], f) });
    mine[p][f] = j;
  }
}

// ★사후 일탈 1(사전 등록 사후 기록): num 중복 → A·B 둘 다 high 일치한 쪽만 남기고 강등(승격 없음)
(() => {
  const by = {};
  for (const p of PAGES) { const m = mine[p] && mine[p].num; if (m && m.status === 'VERIFIED') (by[m.value] = by[m.value] || []).push(p); }
  for (const ps of Object.values(by)) if (ps.length > 1) {
    const keep = ps.filter(p => { const a = val(R.A, inv.A[p], 'num'), b = val(R.B, inv.B[p], 'num'); return a && b && a.conf === 'high' && b.conf === 'high' && a.v === mine[p].num.value && b.v === mine[p].num.value; });
    for (const p of ps) if (!(keep.length === 1 && keep[0] === p)) mine[p].num = { status: 'UNRESOLVED', value: null };
  }
})();

// Z2 · Z3
(() => {
  let good = !!ADJ && ADJ.pages && PAGES.every(p => ADJ.pages[p]), diff = 0, badv = 0;
  if (good) for (const p of PAGES) for (const f of FIELDS) {
    const a = ADJ.pages[p][f];
    if (!a || !['VERIFIED', 'UNRESOLVED'].includes(a.status)) { good = false; continue; }
    if (a.status === 'VERIFIED') {
      const rv = Object.values(a.reads || {}).filter(Boolean).map(x => x.v);
      if (!rv.includes(a.value)) badv++;
    }
    const m = mine[p] && mine[p][f];
    if (!m || m.status !== a.status || m.value !== (a.status === 'VERIFIED' ? a.value : null)) diff++;
  }
  ok('Z2', good && badv === 0, 'adjudicated 144쪽 · status · VERIFIED 값 ⊂ 판독값 (bad ' + badv + ')');
  ok('Z3', good && diff === 0, '독립 재판정 = adjudicated (불일치 ' + diff + ')');
})();

// Z4 · Z5 · Z7
const vnum = ADJ && ADJ.pages ? PAGES.map(p => ({ p, n: ADJ.pages[p] && ADJ.pages[p].num && ADJ.pages[p].num.status === 'VERIFIED' ? ADJ.pages[p].num.value : null })).filter(x => x.n) : [];
const inRange = (n) => /^[1-8][1-6][1-3]$/.test(n);
ok('Z4', !!ADJ && vnum.every(x => inRange(x.n)), 'VERIFIED num 범위(상1~8·중1~6·하1~3 · 0 없음) · VERIFIED ' + vnum.length + '/144');
(() => { let inc = true; for (let i = 1; i < vnum.length; i++) if (!(vnum[i].n > vnum[i - 1].n)) inc = false;
  ok('Z5', !!ADJ && inc && new Set(vnum.map(x => x.n)).size === vnum.length, 'VERIFIED num 중복 없음 · 쪽 순서대로 증가'); })();
(() => {
  const prod = []; for (let u = 1; u <= 8; u++) for (let m = 1; m <= 6; m++) for (let l = 1; l <= 3; l++) prod.push('' + u + m + l);
  const full = vnum.length === 144;
  const same = full && JSON.stringify(vnum.map(x => x.n)) === JSON.stringify(prod);
  ok('Z7', !!ADJ && (full ? same : true), full ? ('144 VERIFIED = 곱집합 ' + (same ? '→ D4 재확인' : '아님')) : ('VERIFIED ' + vnum.length + '/144 — 전수 아님(D4 재확인 보류 · 실패 아님)'));
})();

// Z6
(() => {
  const want = {}; for (const x of vnum) want[x.n] = x.p;
  const good = !!PM && PM.map && JSON.stringify(Object.keys(PM.map).sort()) === JSON.stringify(Object.keys(want).sort()) && Object.keys(want).every(k => PM.map[k] === want[k]);
  ok('Z6', good, 'page_map = VERIFIED num → 쪽 1:1 (' + Object.keys(want).length + ')');
})();

// Z8
(() => {
  const hits = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (['.git', 'node_modules'].includes(e.name) || e.name.startsWith('backup')) continue;
    const q = path.join(d, e.name);
    if (e.isDirectory()) walk(q); else if (/^(read[ABC]|adjudicated|page_map|SECRET_id_to_page)\.json$/.test(e.name)) hits.push(q);
  } };
  try { walk(ROOT); } catch (e) {}
  ok('Z8', hits.length === 0, 'IP 격리: 저장소에 read_f3 JSON 사본 ' + hits.length);
})();

for (const r of res) console.log((r.pass ? '  ok   ' : '  FAIL ') + r.id + ' ' + r.msg);
const pass = res.filter(r => r.pass).length;
console.log('p51 ' + pass + '/' + res.length);
process.exitCode = pass === res.length ? 0 : 1;
