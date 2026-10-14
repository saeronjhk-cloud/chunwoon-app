// ============================================================
//  v805 p44 — 트랙 D(원칙 41 ②단계): 원문 식별자화 + 서버 shadow
//  node _v805_work/p44_shadow_engine_eval.js   (repo 루트 기준 · IP = ../ChunWoon_IP/gate_pkg 또는 CHUNWOON_GATE_PKG)
//  ★구현 전 작성(Eval-First). 기준은 _v805_work/사전등록_P-805-D_원문식별자화_서버shadow.md 와 같다.
//    결과를 보고 기준을 바꾸지 않는다(바꾸면 「사후」 표시).
//  ★원문 판정·cite 치환 규칙은 생성기(IP tools/build_shadow_dist.js)와 **독립 구현**이다(생성기를 require 하지 않는다).
// ============================================================
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const PKG = [process.env.CHUNWOON_GATE_PKG, path.join(ROOT, '..', 'ChunWoon_IP', 'gate_pkg')].find(p => p && fs.existsSync(path.join(p, 'engine', 'saju_resolver.js')));
const BUNDLE = path.join(ROOT, 'api', '_engine', 'shadow');
let total = 0, pass = 0; const fails = [];
const check = (id, name, ok, d) => { total++; if (ok) pass++; else fails.push(id); console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${id} ${name}${d ? ' — ' + d : ''}`); };
const rd = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

// ── 원문 판정(독립 구현) ──
const CJK = /[一-鿿]/g, CLS = /[一-鿿][一-鿿、。，；：？！…]*/g, GANJI = /^[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥木火土金水]+$/;
function wonmunRuns(s) { const r = []; for (const m of String(s).matchAll(CLS)) { const h = (m[0].match(CJK) || []).join(''); if (h.length >= 10 && !GANJI.test(h)) r.push(m[0]); } return r; }
let TITLE_RX = null;
try {
  const wl = JSON.parse(fs.readFileSync(path.join(PKG, 'IP', 'policy', 'claim_whitelist.json'), 'utf8')).source_classes;
  const alt = ['眞詮', '真詮', '闡微', '評註'];
  for (const k of ['registered_4', 'excluded_registered_2', 'unregistered_10']) for (const r of (wl[k] || [])) { if (r.name) alt.push(r.name); if (r.hanja) alt.push(...String(r.hanja).split('|')); }
  TITLE_RX = new RegExp('(' + alt.map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')');
} catch (e) { TITLE_RX = null; }
const isWonmun = s => typeof s === 'string' && (wonmunRuns(s).length > 0 || (!!TITLE_RX && TITLE_RX.test(s)));
const cite = s => 'cite:' + crypto.createHash('sha256').update(String(s), 'utf8').digest('hex').slice(0, 12);
function norm(v) {
  if (typeof v === 'string') return isWonmun(v) ? cite(v) : v;
  if (Array.isArray(v)) return v.map(norm);
  if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[isWonmun(k) ? cite(k) : k] = norm(v[k]); return o; }
  return v;
}
function walk(d, out = []) { if (!fs.existsSync(d)) return out; for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p, out); else out.push(p); } return out; }

// ── POC 폐포(실행 추적) · 번들 적재 ──
const seen = new Set(); let POC = null, SH = null, loadErr = '';
if (PKG) {
  const o = fs.readFileSync; fs.readFileSync = function (p, ...a) { try { seen.add(path.resolve(String(p))); } catch (e) {} return o.call(fs, p, ...a); };
  const Mod = require('module'), oj = Mod._extensions['.json']; Mod._extensions['.json'] = function (m, f) { seen.add(path.resolve(f)); return oj(m, f); };
  try { POC = require(path.join(PKG, 'engine', 'saju_resolver.js')); } catch (e) { loadErr += 'POC ' + e.message; }
  fs.readFileSync = o; Mod._extensions['.json'] = oj;
  for (const f of Object.keys(require.cache)) if (f.startsWith(path.resolve(PKG))) seen.add(path.resolve(f));
}
const closure = [...seen].filter(f => PKG && f.startsWith(path.resolve(PKG)) && !f.includes('node_modules'));
try { SH = require(path.join(BUNDLE, 'index.js')); } catch (e) { loadErr += ' · 번들 ' + e.message.split('\n')[0]; }

// ── 고정 표본 600 ──
const ST = '甲乙丙丁戊己庚辛壬癸'.split(''), BR = '子丑寅卯辰巳午未申酉戌亥'.split('');
let seed = 20261015; const rnd = n => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
const gz = () => { const s = rnd(10); let b = rnd(12); if (b % 2 !== s % 2) b = (b + 1) % 12; return { s: ST[s], b: BR[b] }; };
const SAMPLES = []; for (let i = 0; i < 600; i++) SAMPLES.push({ p: [gz(), gz(), gz(), gz()], gender: i % 2 ? 'female' : 'male', birth: { y: 1950 + (i % 60), m: 1 + (i % 12), d: 1 + (i % 28) } });
const toCtx = x => ({ yearPillar: x.p[0].s + x.p[0].b, monthPillar: x.p[1].s + x.p[1].b, dayPillar: x.p[2].s + x.p[2].b, hourPillar: x.p[3].s + x.p[3].b, gender: x.gender });

// D1
{ const fsb = walk(BUNDLE); const bad = [];
  for (const f of fsb) { const t = fs.readFileSync(f, 'utf8'); const n = wonmunRuns(t).reduce((a, r) => a + (r.match(CJK) || []).length, 0); const tt = TITLE_RX && TITLE_RX.test(t); if (n || tt) bad.push(path.relative(ROOT, f) + (n ? ' 원문' + n : '') + (tt ? ' 문헌명' : '')); }
  check('D1', '번들 ≥16파일 · 원문 문자열 0 · 문헌명 0', fsb.length >= 16 && bad.length === 0 && !!TITLE_RX, `파일 ${fsb.length}${bad.length ? ' · ' + bad.slice(0, 4).join(' / ') : ''}${TITLE_RX ? '' : ' · 문헌명 어휘 적재 실패'}`); }
// D2
{ const win = new Set(); let srcChars = 0;
  for (const f of closure) for (const r of wonmunRuns(fs.readFileSync(f, 'utf8'))) { srcChars += r.length; for (let i = 0; i + 10 <= r.length; i++) win.add(r.slice(i, i + 10)); }
  const hits = [];
  for (const f of walk(path.join(ROOT, 'api'))) { const t = fs.readFileSync(f, 'utf8'); for (const m of t.matchAll(CLS)) { const r = m[0]; for (let i = 0; i + 10 <= r.length; i++) if (win.has(r.slice(i, i + 10))) { hits.push(path.relative(ROOT, f)); break; } } }
  check('D2', 'POC 원문 구간(10자 창)이 api/ 전체에 0건', closure.length >= 10 && win.size > 1000 && hits.length === 0, `폐포 ${closure.length}파일 · 원문 ${srcChars}자 · 창 ${win.size} · 적중 ${[...new Set(hits)].join(',')}`); }
// D3
{ let map = null; try { map = JSON.parse(fs.readFileSync(path.join(PKG, 'dist', 'shadow_citation_map.json'), 'utf8')); } catch (e) {}
  const ids = new Set(), per = {}; for (const f of walk(BUNDLE)) { const m = fs.readFileSync(f, 'utf8').match(/cite:[0-9a-f]{12}/g) || []; m.forEach(x => ids.add(x)); per[path.basename(f)] = m.length; }
  const unres = [...ids].filter(id => !map || !map[id] || cite(map[id].text) !== id);
  check('D3', 'cite 식별자 전부 IP 대응표로 복원 · chung_conditional·root_system 각 ≥1', ids.size > 0 && unres.length === 0 && (per['chung_conditional.js'] || 0) >= 1 && (per['root_system.json'] || 0) >= 1, `id ${ids.size} · 미복원 ${unres.length} · chung ${per['chung_conditional.js'] || 0} · root ${per['root_system.json'] || 0}${map ? '' : ' · 대응표 없음'}`); }
// D4
{ const F = rd('api/fortune.js'); const a = F.indexOf('// ★P-805-D shadow 시작'), b = F.indexOf('// ★P-805-D shadow 끝'); const blk = a >= 0 && b > a ? F.slice(a, b) : '';
  const outside = (F.slice(0, Math.max(a, 0)) + (b > a ? F.slice(b) : '')).match(/cwShadow\w*/g) || [];
  const ok = !!blk && /CW_ENGINE_TYPES/.test(blk) && /console\.log\('\[shadow\]'/.test(blk) && /\.run\(/.test(blk) && !/res\.|userPrompt|systemPrompt|parsed|return /.test(blk) && outside.length === 0 && /try\s*\{/.test(blk);
  check('D4', 'fortune.js: 사주 3종 shadow 호출 · 결과는 [shadow] 로그에만', ok, blk ? `블록 밖 참조 ${outside.length}` : '블록 없음'); }
// D5
{ let bad = 0, first = '', twice = true;
  if (POC && SH && SH.computeSajuReading) for (const x of SAMPLES) {
    let e, g, g2; try { e = JSON.stringify(norm(POC.computeSajuReading(x.p, { gender: x.gender, birth: x.birth }))); } catch (er) { e = 'ERR ' + er.message; }
    try { g = JSON.stringify(SH.computeSajuReading(x.p, { gender: x.gender, birth: x.birth })); g2 = JSON.stringify(SH.computeSajuReading(x.p, { gender: x.gender, birth: x.birth })); } catch (er) { g = 'ERR ' + er.message; }
    if (g !== g2) twice = false; if (e !== g) { bad++; if (!first) first = JSON.stringify(x.p) + ' ' + (e || '').slice(0, 60) + ' ≠ ' + (g || '').slice(0, 60); } }
  check('D5', '결정성: 표본 600 번들 = POC(cite 정규화) · 2회 동일', !!(POC && SH && SH.computeSajuReading) && bad === 0 && twice, (POC && SH) ? `불일치 ${bad}${first ? ' · ' + first : ''}${twice ? '' : ' · 2회 불일치'}` : '적재 실패 ' + loadErr); }
// D6
{ let ok = !!(SH && SH.run), d = ''; const ts = [];
  if (ok) { for (const c of [null, {}, { yearPillar: '??', monthPillar: 'x', dayPillar: '甲' }, { yearPillar: '甲子', monthPillar: '丙寅', dayPillar: '甲午' }, 42]) { try { const r = SH.run(c); if (r && r.summary && !r.summary.skip) { ok = false; d += ' 잘못된 입력에 결과'; } } catch (e) { ok = false; d += ' 예외 ' + e.message; } }
    for (const x of SAMPLES) { const t0 = process.hrtime.bigint(); SH.run(toCtx(x)); ts.push(Number(process.hrtime.bigint() - t0) / 1e6); }
    ts.sort((a, b) => a - b); const med = ts[ts.length >> 1]; if (!(med < 20)) { ok = false; } d += ` 중앙 ${med.toFixed(2)}ms`; }
  check('D6', 'shadow 실패 = 로그만(잘못된 입력 무예외) · 중앙 < 20ms', ok, d || '번들 run 없음'); }
// D7
{ const AU = require(path.join(ROOT, 'api', '_engine', 'authority.js')); const deny = ['yongsin', 'gisin', 'gyeok', 'sangsin', 'johu', 'verdict', 'daewoon_start_age'];
  const okD = deny.every(a => AU.userSurfaceable(a) === false);
  let okP = false; try { const R = fs.readFileSync(path.join(PKG, 'eval', 'run_eval.js'), 'utf8'); const m = R.match(/CW_PROMOTED\s*=\s*CW_PROMOTED_V770\.concat\(\[([^\]]*)\]\)/); okP = !!m && m[1].replace(/[\s'"]/g, '') === 'iljin_ganzi,sinsal'; } catch (e) {}
  const ba = path.join(BUNDLE, 'engine', 'authority.js'); const okB = fs.existsSync(ba) && fs.readFileSync(ba).equals(fs.readFileSync(path.join(ROOT, 'api', '_engine', 'authority.js')));
  check('D7', 'DENY 7축 불변 · CW_PROMOTED 불변 · 번들 authority = 운영 authority', okD && okP && okB, `DENY ${okD} · PROMOTED ${okP} · authority 동일 ${okB}`); }
// D8
{ let ok = false, d = ''; try { const V = JSON.parse(rd('vercel.json')); const inc = ((V.functions || {})['api/fortune.js'] || {}).includeFiles; ok = typeof inc === 'string' ? inc.includes('api/_engine/shadow/**') : false; d = 'includeFiles ' + inc; } catch (e) { d = e.message; }
  const VI = rd('.vercelignore'); const okI = /^!\/api\/?\s*$/m.test(VI) || /^!\/api\/\*\*/m.test(VI);
  check('D8', 'vercel includeFiles api/_engine/shadow/** · .vercelignore api/ 허용', ok && okI, d + ` · ignore ${okI}`); }
// D9
{ let bad = 0, first = '', ok = !!(SH && SH.run), maxB = 0;
  if (ok) for (const x of SAMPLES) { const c = toCtx(x); const r = SH.run(c); const s = JSON.stringify(r && r.summary || null); maxB = Math.max(maxB, Buffer.byteLength(s));
    const leak = [c.yearPillar, c.monthPillar, c.dayPillar, c.hourPillar].some(p => s.includes(p)) || /19[5-9]\d|20[01]\d/.test(s) || wonmunRuns(s).length > 0 || (TITLE_RX && TITLE_RX.test(s)) || !/"v":"shadow-/.test(s) || Buffer.byteLength(s) > 700;
    if (leak) { bad++; if (!first) first = s.slice(0, 120); } }
  check('D9', '로그 요약: 입력 간지·생년·원문·문헌명 없음 · ≤700B · 버전 표기', ok && bad === 0, ok ? `위반 ${bad} · 최대 ${maxB}B${first ? ' · ' + first : ''}` : '번들 run 없음'); }
// D10
{ const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'p44-')); const bad = [];
  const js = walk(BUNDLE).filter(f => f.endsWith('.js')); for (const f of js) { try { cp.execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); } catch (e) { bad.push(path.basename(f)); } }
  { const f = path.join(tmp, 'f.mjs'); fs.writeFileSync(f, rd('api/fortune.js')); try { cp.execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); } catch (e) { bad.push('fortune'); } }
  check('D10', '문법(번들 js · fortune.js)', js.length >= 10 && bad.length === 0, `번들 js ${js.length}${bad.length ? ' · ' + bad.join(',') : ''}`); }
console.log(`[p44_shadow_engine] total=${total} pass=${pass} fail=${total - pass}${fails.length ? ' · FAIL ' + fails.join(',') : ''}`);
process.exitCode = fails.length ? 1 : 0;
