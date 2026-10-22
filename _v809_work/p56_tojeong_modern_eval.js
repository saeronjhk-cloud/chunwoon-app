// p56 — P-809-F4b 현대어 풀이 평가 (생성 전 고정 · 사전 등록 §5)
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const IP = process.env.CW_IP || path.resolve(ROOT, '..', 'ChunWoon_IP');
const MD = path.join(IP, 'tojeong', 'modern');
const tryJ = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; } };
const res = []; const ok = (id, pass, msg) => res.push({ id, pass: !!pass, msg });
const U = tryJ(path.join(MD, 'units.json')), GOLD = tryJ(path.join(MD, 'gold_jay.json')), FIN = tryJ(path.join(MD, 'final.json'));
const JMAP = tryJ(path.join(MD, 'judge', 'SECRET_jid.json'));
const G = (s) => [...new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(s)].length;
const nos = (s) => s.replace(/\s+/g, '');
function mech(u, m) {
  if (typeof m !== 'string' || !m.trim()) return false;
  if (!/^[가-힣\s.,!?·…~'"‘’“”]+$/.test(m)) return false;
  const r = G(nos(m)) / G(nos(u.kor)); return u.kind === 'haewal' ? (r >= 0.6 && r <= 2.5) : (r >= 0.6 && r <= 3.0);
}
const byId = U ? Object.fromEntries(U.units.map(u => [u.id, u])) : {};
// V1
let v1 = false, v1m = 'final 없음';
if (U && FIN) { let bad = 0; for (const u of U.units) { const f = FIN.units[u.id]; if (!f) { bad++; continue; }
  if (f.status === 'PASS' && typeof f.modern !== 'string') bad++; if (f.status === 'HOLD' && f.modern !== null) bad++; if (!['PASS', 'HOLD'].includes(f.status)) bad++; }
  if (Object.keys(FIN.units).length !== U.units.length) bad++;
  const np = Object.values(FIN.units).filter(f => f.status === 'PASS').length;
  v1 = bad === 0; v1m = '단위 ' + Object.keys(FIN.units).length + '/' + U.units.length + ' · PASS ' + np + ' · HOLD ' + (U.units.length - np) + ' · 위반 ' + bad; }
ok('V1', v1, v1m);
// V2
let v2 = false, v2m = '사양 없음';
const specFiles = (dir) => { try { return fs.readdirSync(dir).filter(f => f.endsWith('.txt')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { return []; } };
const genS = [...specFiles(path.join(MD, 'gen', 'specs_G')), ...specFiles(path.join(MD, 'gen', 'specs_R'))];
const judS = [...specFiles(path.join(MD, 'judge', 'specs_J')), ...specFiles(path.join(MD, 'judge', 'specs_JR'))];
if (genS.length && judS.length && GOLD && U) { let leak = 0;
  /* ★사후 개정 1(10-22): 노출 = 그 단위 자기 kor(생성 사양) · 자기 kor+modern(검수 사양) 으로 설명되지 않는 출현만 셈.
     단위 ID 검사는 낱말 경계(탭·줄) 기준 — 6자 JID 속 5자 우연 일치 오탐 수리. 기준(노출 0)은 그대로. */
  const JM = JMAP ? JMAP.map : {};
  const lines = (arr) => arr.flatMap(t => t.split('\n'));
  const gL = lines(genS), jL = lines(judS);
  for (const g of GOLD.gold) { const u = byId[g.id]; for (const s of g.gloss) { if (G(nos(s)) < 6) continue; const k = nos(s);
    for (const l of gL) if (nos(l).includes(k)) { const c = l.split('\t'); if (!(byId[c[0]] && nos(c[3] || '').includes(k))) leak++; } /* 생성 사양: 어느 단위든 그 단위의 kor(원문) 칸 안이면 원문 일치 */
    for (const l of jL) if (nos(l).includes(k)) { const c = l.split('\t'), m = JM[c[0]]; const base = m && (m.kind === 'mut' ? m.base : m.id);
      if (!(m && (nos(c[2] || '').includes(k) || (nos(c[3] || '').includes(k) && nos(c[3] || '') === nos(m.modern || ''))))) leak++; } } } /* 검수 사양: kor 칸 또는 파이프라인이 만든 modern(대응표 값과 같음) 칸 안이면 노출 아님 */
  const uid = new Set(U.units.map(u => u.id)); let idLeak = 0; for (const l of jL) for (const tok of l.split(/[\t\s]+/)) if (uid.has(tok)) idLeak++;
  let verdictLeak = 0; for (const t of genS) if (/verdict|PASS|SWAP|ADD:/.test(t)) verdictLeak++;
  v2 = leak === 0 && idLeak === 0 && verdictLeak === 0; v2m = '정답 노출 ' + leak + ' · 검수 사양 단위ID ' + idLeak + ' · 생성 사양 판정정보 ' + verdictLeak + ' · 사양 G' + genS.length + '/J' + judS.length; }
ok('V2', v2, v2m);
// V3
let v3 = false, v3m = 'final 없음';
if (U && FIN) { let bad = 0; for (const [id, f] of Object.entries(FIN.units)) if (f.status === 'PASS' && !mech(byId[id], f.modern)) bad++; v3 = bad === 0; v3m = '기계 검사 위반 ' + bad; }
ok('V3', v3, v3m);
// V4
let v4 = false, v4m = '검수 없음';
if (FIN && JMAP) { let bad = 0; const cache = {};
  const jf = (sh) => cache[sh] || (cache[sh] = tryJ(path.join(MD, 'judge', 'out', 'judge_' + sh + '.json')));
  for (const [id, f] of Object.entries(FIN.units)) { if (f.status !== 'PASS') continue;
    const m = JMAP.map[f.jid]; const j = jf(f.judge_shard); const it = j && j.items && j.items[f.jid];
    if (!m || m.kind !== 'unit' || m.id !== id || m.modern !== f.modern || !it || it.verdict !== 'PASS' || !j.meta || j.meta.role !== 'judge' || f.judge_shard === f.gen_shard) bad++; }
  v4 = bad === 0; v4m = 'PASS 의 독립 검수 근거 없음 ' + bad; }
ok('V4', v4, v4m);
// V5
let v5 = false, v5m = '변이 없음';
if (JMAP && FIN) { const rnd = FIN.final_judge_round || 'J'; let n = 0, caught = 0; const cache = {};
  for (const [jid, m] of Object.entries(JMAP.map)) { if (m.kind !== 'mut' || m.round !== rnd) continue; n++;
    const j = cache[m.shard] || (cache[m.shard] = tryJ(path.join(MD, 'judge', 'out', 'judge_' + m.shard + '.json'))); const it = j && j.items && j.items[jid]; if (it && it.verdict === 'FAIL') caught++; }
  v5 = n === 40 && caught >= 38; v5m = '변이 탐지 ' + caught + '/' + n + ' (라운드 ' + rnd + ')'; }
ok('V5', v5, v5m);
// V6
const GR = tryJ(path.join(MD, 'gold', 'gold_result.json'));
let v6 = false, v6m = '정답 대조 없음';
if (GR && GOLD && FIN) { let same = 0, bad = 0; for (const g of GOLD.gold) { const f = FIN.units[g.id]; const r = GR.items && GR.items[g.id];
  if (f && f.status === 'PASS' && r && r.same === true && r.modern === f.modern) same++; if (r && r.modern !== (f && f.modern)) bad++; }
  v6 = same >= 17 && bad === 0; v6m = '같은 뜻 ' + same + '/' + GOLD.gold.length + ' · 대조값 불일치 ' + bad; }
ok('V6', v6, v6m);
// V7
let v7 = false, v7m = '묶음 없음';
const BODY = tryJ(path.join(IP, 'tojeong', 'body', 'tojeong_body_1935.json'));
if (BODY && FIN && U) { let bad = 0; const fm = {}, fh = {};
  for (const u of U.units) { const f = FIN.units[u.id]; if (!f || f.status !== 'PASS') continue; if (u.kind === 'haewal') fh[u.kor] = f.modern; else fm[u.han + '\u0001' + u.kor] = f.modern; }
  for (const r of Object.values(BODY.gua)) { const fl = r.segmented ? [...r.chongun, ...r.months.flatMap(m => m.lines)] : r.lines;
    const exp = {}; for (const L of fl) if (L.kor && fm[(L.han || '') + '\u0001' + L.kor] !== undefined) exp[(L.han || '') + '\u0001' + L.kor] = fm[(L.han || '') + '\u0001' + L.kor];
    if (JSON.stringify(r.modern || {}) !== JSON.stringify(exp)) bad++;
    const eh = r.haewal.kor && fh[r.haewal.kor] !== undefined ? fh[r.haewal.kor] : null; if ((r.modern_haewal === undefined ? null : r.modern_haewal) !== eh) bad++; }
  let p55 = ''; try { p55 = cp.execSync('node _v809_work/p55_tojeong_body_bundle_eval.js', { cwd: ROOT, encoding: 'utf8', timeout: 170000 }); } catch (e) { p55 = (e.stdout || '') + ''; }
  v7 = bad === 0 && /p55 6\/6/.test(p55); v7m = '묶음 modern 불일치 ' + bad + ' · ' + ((p55.match(/p55 \d+\/\d+/) || ['p55 ?'])[0]); }
ok('V7', v7, v7m);
// V8
let v8 = false, v8m = 'final 없음';
if (FIN) { const ms = Object.values(FIN.units).filter(f => f.status === 'PASS' && G(nos(f.modern)) >= 10).map(f => f.modern);
  const files = cp.execSync('git ls-files -co --exclude-standard -z', { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }).split('\0').filter(Boolean).filter(f => !/(^|\/)backup/.test(f) && /\.(js|json|html|md|txt|css)$/.test(f));
  const hits = []; for (const f of files) { const q = path.join(ROOT, f); if (!fs.existsSync(q) || fs.statSync(q).size > 3e6) continue; const t = fs.readFileSync(q, 'utf8'); for (const s of ms) if (t.includes(s)) { hits.push(f); break; } }
  v8 = hits.length === 0; v8m = '평문 현대어 ' + hits.length + (hits.length ? ' ' + hits.slice(0, 3).join(' | ') : ''); }
ok('V8', v8, v8m);
// V9
const HS = tryJ(path.join(MD, 'human', 'sample.json')); const HRp = path.join(MD, 'human', 'sample_reply.txt');
let v9 = false, v9m = '사람 표본 회신 없음(회신 전 FAIL 정상)';
if (HS && fs.existsSync(HRp)) { const ans = {}; for (const l of fs.readFileSync(HRp, 'utf8').split(/\r?\n/)) { const m = l.match(/^(\d{2})\s+(OK|NG)\b/i); if (m) ans[+m[1]] = m[2].toUpperCase(); }
  const n = HS.items.length, ng = Object.values(ans).filter(a => a === 'NG').length;
  v9 = n === 20 && Object.keys(ans).length === 20 && ng <= 2; v9m = '회신 ' + Object.keys(ans).length + '/' + n + ' · NG ' + ng; }
ok('V9', v9, v9m);
for (const r of res) console.log((r.pass ? '  ok   ' : '  FAIL ') + r.id + ' ' + r.msg);
console.log('p56 ' + res.filter(r => r.pass).length + '/' + res.length);
