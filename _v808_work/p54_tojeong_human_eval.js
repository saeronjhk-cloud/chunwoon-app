// p54 — P-808-F3c 사람 확인지 평가 (회신 전 고정 · 사전 등록 §6)
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const IP = process.env.CW_IP || path.resolve(ROOT, '..', 'ChunWoon_IP');
const D = path.join(IP, 'tojeong', 'read_f3b'), HD = path.join(D, 'human');
const J = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const sha16 = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 16);
const norm = (s) => s == null ? null : String(s).normalize('NFC').replace(/\s+/g, '');
const MONTHS = ['寅卯', '辰巳', '午未', '申酉', '戌亥', '子丑'];
const res = []; const ok = (id, pass, msg) => res.push({ id, pass: !!pass, msg });
const tryJ = (p) => { try { return J(p); } catch (e) { return null; } };
const ADJ = tryJ(path.join(D, 'adjudicated.json')), SEG = tryJ(path.join(D, 'segment_report.json'));
const ITEMS = tryJ(path.join(HD, 'F3c_items.json')), MAN = tryJ(path.join(HD, 'manifest.json'));
const slotOrder = (s) => s === 'H' ? 999 : (s[0] === 'U' ? 0 : 100) + parseInt(s.slice(1), 10);
// 대상(독립 계산)
const target = [];
if (ADJ && SEG) {
  const cs = [...SEG.cells].sort((x, y) => x.slice(0, 4) < y.slice(0, 4) ? -1 : x.slice(0, 4) > y.slice(0, 4) ? 1 : slotOrder(x.slice(5)) - slotOrder(y.slice(5)));
  for (const c of cs) for (const f of ['han', 'kor']) { if (f === 'han' && c.endsWith('_H')) continue; if (ADJ.cells[c][f].status !== 'VERIFIED') target.push(c + ':' + f); }
}
const cands = (c, f) => { const s = new Set(); for (const r of Object.values(ADJ.cells[c][f].reads || {})) if (r && r.v) s.add(norm(r.v)); return [...s].sort(); };
// H1
ok('H1', ITEMS && ITEMS.length === target.length && ITEMS.every((it, i) => it.no === i + 1 && it.cell + ':' + it.field === target[i]), '대상 ' + target.length + ' · 확인지 ' + (ITEMS ? ITEMS.length : '없음'));
// H2
let bad2 = 0; if (ITEMS) for (const it of ITEMS) { const cc = cands(it.cell, it.field); if (JSON.stringify(it.cands) !== JSON.stringify(cc) || cc.length < 1 || cc.length > 3) bad2++; }
ok('H2', ITEMS && bad2 === 0, '후보 = A·B·C 판독값(중복 제거·정렬) · 위반 ' + bad2);
// H3
let h3 = false, h3m = '없음';
if (MAN && ITEMS) { const pdf = path.join(HD, MAN.pdf), tpl = path.join(HD, MAN.template);
  const tl = fs.existsSync(tpl) ? fs.readFileSync(tpl, 'utf8').split(/\r?\n/).filter(l => /^\d{3}\s/.test(l)) : [];
  const leak = ITEMS.some(it => 'reads' in it || 'conf' in it || 'reader' in it);
  h3 = fs.existsSync(pdf) && sha16(pdf) === MAN.pdf_sha16 && MAN.n === ITEMS.length && tl.length === ITEMS.length && !leak && MAN.shows_reader === false;
  h3m = 'pdf ' + (fs.existsSync(pdf) ? sha16(pdf) : '없음') + ' · 양식 ' + tl.length + '줄 · 판독자 노출 ' + (leak || MAN.shows_reader !== false); }
ok('H3', h3, '확인지 ' + h3m);
// H4·H5·H6 (회신 후)
const RP = path.join(HD, 'F3c_답_제이.txt'); let ans = null, bad4 = -1;
if (fs.existsSync(RP) && ITEMS) { ans = {}; bad4 = 0; const seen = new Set();
  for (const l of fs.readFileSync(RP, 'utf8').split(/\r?\n/)) { if (!l.trim() || l.startsWith('#')) continue; /* ★사후(10-20): 양식 머리말 # 줄은 건너뜀(양식 자체에 있음 · 기준 불변) */ const m = l.match(/^(\d{3})\s+(1|2|3|\?|=.+)\s*$/); if (!m) { bad4++; continue; } const n = +m[1]; if (seen.has(n) || n < 1 || n > ITEMS.length) { bad4++; continue; } seen.add(n); ans[n] = m[2]; }
  if (seen.size !== ITEMS.length) bad4 += ITEMS.length - seen.size;
  for (const [n, a] of Object.entries(ans)) if (/^[123]$/.test(a) && +a > ITEMS[n - 1].cands.length) bad4++; }
ok('H4', bad4 === 0, '회신 ' + (ans ? Object.keys(ans).length + '줄 · 위반 ' + bad4 : '없음(회신 전 FAIL 정상)'));
const APP = tryJ(path.join(HD, 'F3c_applied.json'));
let bad5 = -1, fin = null;
if (ans && bad4 === 0 && APP && ADJ) { bad5 = 0; fin = JSON.parse(JSON.stringify(ADJ.cells));
  for (const it of ITEMS) { const a = ans[it.no]; let v = null; if (/^[123]$/.test(a)) v = it.cands[+a - 1]; else if (a[0] === '=') v = norm(a.slice(1)) || null;
    const exp = v ? { status: 'HUMAN_VERIFIED', value: v } : { status: 'UNRESOLVED', value: null };
    const got = APP.cells[it.cell] && APP.cells[it.cell][it.field];
    if (!got || got.status !== exp.status || (got.value || null) !== exp.value) bad5++;
    fin[it.cell][it.field] = exp; }
  for (const c in ADJ.cells) for (const f of ['han', 'kor']) if (!target.includes(c + ':' + f)) { const g = APP.cells[c] && APP.cells[c][f]; if (!g || g.status !== ADJ.cells[c][f].status || g.value !== ADJ.cells[c][f].value) bad5++; } }
ok('H5', bad5 === 0, '반영 독립 재계산 불일치 ' + (bad5 < 0 ? '(회신 전 FAIL 정상)' : bad5));
let h6 = false, h6m = '(회신 전 FAIL 정상)';
if (fin && SEG) { let viol = 0; const ok2 = (s) => s === 'VERIFIED' || s === 'HUMAN_VERIFIED';
  const monthOf = (v) => (!v || !/之月$/.test(v)) ? -1 : MONTHS.indexOf(v.slice(0, 2));
  for (const p of Object.keys(SEG.pages)) { const sl = SEG.cells.filter(c => c.startsWith(p + '_')).sort((x, y) => slotOrder(x.slice(5)) - slotOrder(y.slice(5)));
    const mk = sl.map(c => ok2(fin[c].han.status) ? monthOf(fin[c].han.value) : -1).filter(m => m >= 0); for (let i = 1; i < mk.length; i++) if (!(mk[i - 1] < mk[i])) viol++; }
  let hn = 0, kn = 0, hs = 0; for (const c of SEG.cells) { if (!c.endsWith('_H')) { hs++; if (ok2(fin[c].han.status)) hn++; } if (ok2(fin[c].kor.status)) kn++; }
  h6 = viol === 0; h6m = '월 순서 위반 ' + viol + ' · 최종 han ' + hn + '/' + hs + ' · kor ' + kn + '/' + SEG.cells.length; }
ok('H6', h6, h6m);
// H7 IP 격리
const hits = []; const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (['.git', 'node_modules'].includes(e.name) || e.name.startsWith('backup')) continue; const q = path.join(d, e.name); if (e.isDirectory()) walk(q); else if (/^F3c_(items|applied|답.*)\.(json|txt)$|^F3c_사람확인지\.pdf$/.test(e.name)) hits.push(q); } };
try { walk(ROOT); } catch (e) {}
ok('H7', hits.length === 0, 'IP 격리: 저장소 안 확인지·답 ' + hits.length);
for (const r of res) console.log((r.pass ? '  ok   ' : '  FAIL ') + r.id + ' ' + r.msg);
console.log('p54 ' + res.filter(r => r.pass).length + '/' + res.length);
