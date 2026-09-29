// eval 게이트 분할 실행기 (run_gate.js 의 listEvals/evalPath/evalCwd 규칙을 그대로 따름) — node _v790_work/run_eval_slice.js FROM TO
'use strict';
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..'), EVAL = path.join(ROOT, 'eval'), PKG = path.join(ROOT, '..', 'ChunWoon_IP', 'gate_pkg'), PE = path.join(PKG, 'eval');
const NOT = /^(_|run_eval\.js$|mutation_kill_)/;
const names = [...new Set([...fs.readdirSync(EVAL), ...fs.readdirSync(PE)].filter(f => f.endsWith('.js') && !NOT.test(f)))].sort();
const a = +process.argv[2] || 1, b = +process.argv[3] || names.length;
if (process.argv[2] === 'list') { names.forEach((n, i) => console.log(i + 1, n)); process.exit(0); }
for (let i = a; i <= Math.min(b, names.length); i++) {
  const f = names[i - 1], inPkg = fs.existsSync(path.join(PE, f)), fp = inPkg ? path.join(PE, f) : path.join(EVAL, f);
  const env = Object.assign({}, process.env); if (inPkg) env.CHUNWOON_FRONT_ROOT = ROOT;
  const t = Date.now(), r = spawnSync(process.execPath, [fp], { cwd: inPkg ? PKG : ROOT, env, encoding: 'utf8', timeout: 150000 });
  const last = String(r.stdout || '').trim().split('\n').filter(l => /total=|pass|fail/.test(l)).pop() || '';
  console.log(`${i} ${r.status === 0 ? 'ok  ' : 'FAIL'} ${((Date.now() - t) / 1000).toFixed(1)}s ${f} :: ${last.slice(0, 110)}`);
  if (r.status !== 0) console.log('   err| ' + String(r.stderr || r.stdout || '').trim().split('\n').slice(-4).join(' / ').slice(0, 400));
}
