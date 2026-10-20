// p55 — P-809-F4a 토정 본문 묶음·암호화 평가 (구현 전 고정 · 사전 등록 §6)
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const IP = process.env.CW_IP || path.resolve(ROOT, '..', 'ChunWoon_IP');
const T = path.join(IP, 'tojeong');
const tryJ = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; } };
const res = []; const ok = (id, pass, msg) => res.push({ id, pass: !!pass, msg });
const APP = tryJ(path.join(T, 'read_f3b', 'human', 'F3c_applied.json')), SEG = tryJ(path.join(T, 'read_f3b', 'segment_report.json'));
const GI = tryJ(path.join(T, 'read_f3', 'gua_index_1935.json'));
const BODY = tryJ(path.join(T, 'body', 'tojeong_body_1935.json'));
const ENC = tryJ(path.join(ROOT, 'api', '_engine', 'tojeong_body_1935.enc.json'));
const KEYP = path.join(IP, 'secrets', 'cw_tj_body_key.txt');
const okS = (s) => s === 'VERIFIED' || s === 'HUMAN_VERIFIED';
const so = (s) => s === 'H' ? 999 : (s[0] === 'U' ? 0 : 100) + parseInt(s.slice(1), 10);
const lineOf = (c) => { const h = APP.cells[c].han, k = APP.cells[c].kor; return { han: okS(h.status) ? h.value : null, kor: okS(k.status) ? k.value : null, han_status: h.status, kor_status: k.status }; };
// 독립 분할(§3)
const FIRST = ['寅', '辰', '午', '申', '戌', '子'];
const KOR = [/^(정월이월|정이월|뎡이월|졍이월|정월과이월)/, /^(삼월사월|삼사월|상사월)/, /^(오월륙월|오월유월|오륙월|오뉴월)/, /^(칠월팔월|칠팔월)/, /^(구월시월|구월십월|구십월|구시월)/, /^(동지섯달|동지와섯달|동지셧달|십일월십이월)/];
const isMark = (L, k) => { const h = L.han || '', o = L.kor || '';
  const a = h[0] === FIRST[k] && (/之月|月之/.test(h) || /^..[之則]/.test(h)); return a || KOR[k].test(o); };
function seg(lines) { const pos = []; let from = 0;
  for (let k = 0; k < 6; k++) { let f = -1; for (let i = from; i < lines.length; i++) if (isMark(lines[i], k)) { f = i; break; } if (f < 0) return null; pos.push(f); from = f + 1; }
  if (pos[0] < 1) return null;
  return { chongun: lines.slice(0, pos[0]), months: pos.map((p, k) => ({ k, lines: lines.slice(p, k < 5 ? pos[k + 1] : lines.length) })) }; }
let expect = null, nseg = 0;
if (APP && SEG && GI) { expect = {};
  for (const [num, g] of Object.entries(GI.map)) { const p = g.page;
    const cs = SEG.cells.filter(c => c.startsWith(p + '_') && !c.endsWith('_H')).sort((a, b) => so(a.slice(5)) - so(b.slice(5)));
    const lines = cs.map(lineOf); const s = seg(lines); if (s) nseg++;
    const hk = APP.cells[p + '_H'].kor;
    expect[num] = { page: p, segmented: !!s, lines, s, haewal: { kor: okS(hk.status) ? hk.value : null, status: hk.status } }; } }
// B1
let b1 = false, b1m = '묶음 없음';
if (BODY && expect) { let bad = 0, nl = 0; const ks = Object.keys(BODY.gua || {});
  for (const [num, e] of Object.entries(expect)) { const r = BODY.gua[num]; if (!r || r.page !== e.page) { bad++; continue; }
    const flat = (r.segmented ? [...r.chongun, ...r.months.flatMap(m => m.lines)] : r.lines) || []; nl += flat.length;
    if (JSON.stringify(flat) !== JSON.stringify(e.lines)) bad++;
    if (JSON.stringify(r.haewal) !== JSON.stringify(e.haewal)) bad++;
    const h = GI.map[num]; if (!r.header || r.header.num !== num || r.header.tri3 !== h.tri3 || r.header.gua !== h.gua) bad++; }
  b1 = ks.length === 144 && bad === 0 && nl === SEG.cells.filter(c => !c.endsWith('_H')).length;
  b1m = '괘 ' + ks.length + ' · 줄 ' + nl + ' · 불일치 ' + bad; }
ok('B1', b1, b1m);
// B2·B3
let b2 = false, b2m = '묶음 없음', b3 = false, b3m = '묶음 없음';
if (BODY && expect) { let bad = 0, bad3 = 0;
  for (const [num, e] of Object.entries(expect)) { const r = BODY.gua[num]; if (!r) { bad++; continue; }
    if (r.segmented !== e.segmented) { bad++; continue; }
    if (e.segmented) { if (JSON.stringify(r.chongun) !== JSON.stringify(e.s.chongun) || JSON.stringify(r.months.map(m => [m.k, m.lines])) !== JSON.stringify(e.s.months.map(m => [m.k, m.lines]))) bad++;
      if (!(r.chongun.length >= 1) || r.months.length !== 6 || r.months.some((m, i) => m.k !== i)) bad3++; } }
  b2 = bad === 0; b2m = '독립 분할 불일치 ' + bad + ' · 분할 성공 ' + nseg + '/144';
  b3 = bad3 === 0; b3m = '표지 순서·총운 위반 ' + bad3; }
ok('B2', b2, b2m); ok('B3', b3, b3m);
// B4
let b4 = false, b4m = '암호문·키 없음';
if (ENC && BODY && fs.existsSync(KEYP)) { const key = Buffer.from(fs.readFileSync(KEYP, 'utf8').trim(), 'base64'); let bad = 0; const ivs = new Set();
  const dec = (rec, aad) => { const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(rec.iv, 'base64')); d.setAAD(Buffer.from(aad)); d.setAuthTag(Buffer.from(rec.tag, 'base64')); return Buffer.concat([d.update(Buffer.from(rec.ct, 'base64')), d.final()]).toString('utf8'); };
  const recs = ENC.records || {};
  for (const num of Object.keys(BODY.gua)) { const rec = recs[num]; if (!rec) { bad++; continue; } ivs.add(rec.iv);
    try { if (dec(rec, num) !== JSON.stringify(BODY.gua[num])) bad++; } catch (e) { bad++; } }
  let tamper = 0; const n0 = Object.keys(recs)[0], n1 = Object.keys(recs)[1];
  try { const r = Object.assign({}, recs[n0]); const b = Buffer.from(r.ct, 'base64'); b[0] ^= 1; r.ct = b.toString('base64'); dec(r, n0); } catch (e) { tamper++; }
  try { dec(recs[n0], n1); } catch (e) { tamper++; }
  const kid = crypto.createHash('sha256').update(key).digest('hex').slice(0, 8);
  b4 = Object.keys(recs).length === 144 && ivs.size === 144 && bad === 0 && tamper === 2 && ENC.kid === kid && ENC.alg === 'aes-256-gcm';
  b4m = '레코드 ' + Object.keys(recs).length + ' · IV ' + ivs.size + ' · 복호 불일치 ' + bad + ' · 변조 탐지 ' + tamper + '/2 · kid ' + (ENC.kid === kid); }
ok('B4', b4, b4m);
// B5 격리
let b5 = false, b5m = '묶음 없음';
if (BODY) { const han = new Set(), kor = new Set(); const G = (s) => [...new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(s)].length;
  for (const r of Object.values(BODY.gua)) { const fl = r.segmented ? [...r.chongun, ...r.months.flatMap(m => m.lines)] : r.lines;
    for (const L of fl) { if (L.han && [...L.han].length >= 4 && !/之月|月之/.test(L.han)) han.add(L.han); if (L.kor && G(L.kor) >= 8) kor.add(L.kor); }
    if (r.haewal.kor && G(r.haewal.kor) >= 8) kor.add(r.haewal.kor); }
  const EX = [{ file: '천운_인수인계_v790_눈썹계측정정_相理衡眞捷徑직독_2026-09-23.md', sha16: 'd05c1251c5d99f78' }];
  const keyS = fs.existsSync(KEYP) ? fs.readFileSync(KEYP, 'utf8').trim() : null;
  const hits = []; let exempt = 0;
  /* ★사후 개정 1(10-20): 범위 = git 추적·추적 가능 파일(ls-files -co --exclude-standard) — 배포 트리 = git 트리 */
  const files = cp.execSync('git ls-files -co --exclude-standard -z', { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }).split('\0').filter(Boolean).filter(f => !/(^|\/)backup/.test(f));
  const walk = () => { for (const f of files) { const q = path.join(ROOT, f), e = { name: path.basename(f) }; if (!fs.existsSync(q)) continue;
    if (!/\.(js|json|html|md|txt|css)$/.test(e.name) || fs.statSync(q).size > 3e6) continue;
    const t = fs.readFileSync(q, 'utf8'); if (keyS && t.includes(keyS)) { hits.push(q + ':KEY'); continue; }
    for (const s of han) if (t.includes(s)) { const hs = crypto.createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 16); if (EX.some(x => x.file === e.name && x.sha16 === hs)) { exempt++; continue; } hits.push(q + ':han'); break; }
    for (const s of kor) if (t.includes(s)) { hits.push(q + ':kor'); break; } } };
  walk();
  b5 = hits.length === 0 && !!keyS; b5m = '평문 구절·키 ' + hits.length + ' · 예외 ' + exempt + ' · 한자구절 ' + han.size + ' · 한글줄 ' + kor.size + (hits.length ? ' ' + hits.slice(0, 3).join(' | ') : '') + (keyS ? '' : ' · 키 파일 없음'); }
ok('B5', b5, b5m);
// B6 회귀
const run = (c) => { try { return cp.execSync(c, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 150000 }); } catch (e) { return (e.stdout || '') + (e.stderr || ''); } };
const g = run('node tools/run_gate.js tools'), a = run('node _v808_work/p53_tojeong_body_eval.js'), b = run('node _v808_work/p54_tojeong_human_eval.js');
ok('B6', /total=3 fail=0/.test(g) && /p53 8\/8/.test(a) && /p54 7\/7/.test(b), 'gate ' + (/total=3 fail=0/.test(g)) + ' · p53 ' + (a.match(/p53 \d+\/\d+/) || ['?'])[0] + ' · p54 ' + (b.match(/p54 \d+\/\d+/) || ['?'])[0]);
for (const r of res) console.log((r.pass ? '  ok   ' : '  FAIL ') + r.id + ' ' + r.msg);
console.log('p55 ' + res.filter(r => r.pass).length + '/' + res.length);
