// p59 — P-809-R1 지연 적재 경합 평가 (수리 전 고정)
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const res = []; const ok = (id, pass, msg) => res.push({ id, pass: !!pass, msg });
(async () => {
  const load = async () => { const t = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'cw_p59_')); fs.writeFileSync(path.join(t, 'package.json'), JSON.stringify({ type: 'module' })); fs.cpSync(path.join(ROOT, 'api'), path.join(t, 'api'), { recursive: true }); return (await import('file://' + path.join(t, 'api', 'fortune.js').split(path.sep).join('/') + '?' + Date.now())).default; };
  process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'sk-ant-gate-stub';
  const rf = globalThis.fetch; let cap = []; globalThis.fetch = async (u, o) => { cap.push(o.body); throw new Error('p59 차단'); };
  const logs = []; const ol = console.log;
  const call = async (h, type, ctx) => { const r = { statusCode: 200 }; r.status = c => { r.statusCode = c; return r; }; r.json = o => { r.body = o; return r; }; r.setHeader = () => { }; r.end = () => r; try { await h({ method: 'POST', headers: {}, body: { type, context: ctx } }, r); } catch (e) { } return r; };
  const CASES = { tojeong: { name: '시험', gender: 'male', targetYear: 2005, cal: 'lunar', y: 1976, m: 8, d: 26, leap: false },
    saju: { name: '시험', gender: 'male', birth: '1976-09-19', calType: 'solar', isLeap: false, hourIdx: 4, birthDate: '1976-09-19', birthTime: '09:30', cal: 'solar', y: 1976, m: 9, d: 19, leap: false } };
  let bad = [], det = [];
  for (const [type, ctx] of Object.entries(CASES)) {
    console.log = (...a) => { if (String(a[0]) === '[cw:ctxguard]') { try { logs.push(JSON.parse(String(a[1]))); } catch (e) { } } };
    const h1 = await load(); cap = []; logs.length = 0; await call(h1, type, ctx); const solo = cap[0] || null;
    const h4 = await load(); cap = []; logs.length = 0; await Promise.all([0, 1, 2, 3].map(() => call(h4, type, ctx)));
    console.log = ol;
    const same = cap.length === 4 && solo && cap.every(b => b === solo);
    if (!same) bad.push(type + ' 동시 프롬프트 불일치(' + cap.filter(b => b === solo).length + '/4 · 상류 ' + cap.length + ')');
    if (type === 'tojeong') { const tj = logs.filter(l => l && l.tojeong); if (tj.length !== 4 || tj.some(l => !(l.layer1 === true && l.mode === 'derived'))) bad.push('tojeong 가드 ' + tj.filter(l => l.layer1 === true && l.mode === 'derived').length + '/4'); }
    det.push(type + ' 혼자 ' + (solo ? 'ok' : '상류 없음') + ' · 동시 같음 ' + cap.filter(b => b === solo).length + '/' + cap.length);
  }
  globalThis.fetch = rf;
  ok('R1', bad.length === 0, det.join(' · ') + (bad.length ? ' · ' + bad.join(' | ') : ''));
  const src = fs.readFileSync(path.join(ROOT, 'api', 'fortune.js'), 'utf8');
  const tried = (src.match(/__cw\w*Tried\s*=\s*true/g) || []).length;
  const prom = ['cwEngine', 'cwFaceVer', 'cwCtxguard'].filter(n => new RegExp('function ' + n + '\\(\\)\\s*\\{[^}]*\\bP\\b|function ' + n + '\\(\\)\\s*\\{\\s*if \\(!__' + n + 'P\\)').test(src)).length;
  ok('R2', tried === 0 && prom === 3, '「Tried = true」 ' + tried + ' · Promise 캐시 함수 ' + prom + '/3');
  if (process.argv.includes('--reg')) { const run = (c, env) => { try { return cp.execSync(c, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 170000, env: Object.assign({}, process.env, env || {}) }); } catch (e) { return (e.stdout || '') + (e.stderr || ''); } };
    const g = run('node tools/run_gate.js tools'); const ev = run('node ' + path.join(ROOT, '..', 'ChunWoon_IP', 'gate_pkg', 'eval', 'run_eval.js'), { CHUNWOON_FRONT_ROOT: ROOT, CHUNWOON_GATE_PKG: path.join(ROOT, '..', 'ChunWoon_IP', 'gate_pkg') });
    ok('R3', /total=3 fail=0/.test(g) && /pass 124 \/ fail 0/.test(ev), 'gate ' + /total=3 fail=0/.test(g) + ' · run_eval ' + ((ev.match(/pass \d+ \/ fail \d+/) || ['?'])[0]) + ' (p50 은 따로)'); }
  for (const r of res) console.log((r.pass ? '  ok   ' : '  FAIL ') + r.id + ' ' + r.msg);
  console.log('p59 ' + res.filter(r => r.pass).length + '/' + res.length); process.exit(0);
})();
