#!/usr/bin/env node
/* tools/sync_gate_pkg.js — 게이트 패키지 동기화 (★v787 P-786-D · 2026-09-07)
 *
 * 【왜】 게이트 패키지(chunwoon_iljin_engine_poc v7.70 · git 밖 · _gate_pkg/ 또는 CHUNWOON_GATE_PKG)의
 *   eval/run_eval.js 는 **패키지 안의** eval_response_scrub.js 등을 자식 프로세스로 부른다.
 *   그런데 그 4종(response_scrub · prompt_citation_guard · token_roundtrip · engine_binding)은
 *   배포 리포 eval/ 이 더 새 버전(v7.7x~v787)이고 pin 표도 리포 것이 정본이다.
 *   ⟹ 리포 → 패키지 **한 방향** 복사. 패키지 고유 파일(51종 · engine/ · IP/)은 건드리지 않는다.
 *
 * 【무엇을】 리포 eval/*.js 중 패키지 eval/ 에도 **같은 이름이 있는** 파일 + eval/_gate_pins.json + tools/run_gate.js
 * 【검사】 --check : 복사 없이 드리프트만 보고(불일치 있으면 exit 1). tools/run_gate.js 가 시작 시 이 검사를 부른다.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHECK = process.argv.indexOf('--check') !== -1;

function resolvePkg() {
  for (const c of [process.env.CHUNWOON_GATE_PKG, path.join(ROOT, '_gate_pkg')]) {
    if (c && fs.existsSync(path.join(c, 'engine')) && fs.existsSync(path.join(c, 'eval'))) return path.resolve(c);
  }
  return null;
}
function plan(pkg) {
  const out = [];
  for (const f of fs.readdirSync(path.join(ROOT, 'eval'))) {
    if (!f.endsWith('.js') && f !== '_gate_pins.json') continue;
    const src = path.join(ROOT, 'eval', f), dst = path.join(pkg, 'eval', f);
    // 같은 이름이 패키지에 있는 파일 + pin 표 + 리포 헬퍼(_*.js — 리포 eval 이 require 한다. 예: _tmp.js)
    if (f === '_gate_pins.json' || f.startsWith('_') || fs.existsSync(dst)) out.push([src, dst, 'eval/' + f]);
  }
  out.push([path.join(ROOT, 'tools', 'run_gate.js'), path.join(pkg, 'tools', 'run_gate.js'), 'tools/run_gate.js']);
  return out;
}
function main() {
  const pkg = resolvePkg();
  if (!pkg) { console.log('[sync_gate_pkg] 게이트 패키지 없음 (CHUNWOON_GATE_PKG · _gate_pkg/) — 동기화 대상 없음'); return 0; }
  // 패키지 eval 이 쓰는 npm 의존(@vercel/routing-utils)은 패키지 자체의 node_modules 에 둔다.
  //   없으면 npm i --omit=dev 가 아니라 devDependencies 까지 설치한다(게이트는 dev 의존이다).
  if (!fs.existsSync(path.join(pkg, 'node_modules', '@vercel', 'routing-utils'))) {
    if (CHECK) console.log('  WARN 패키지 node_modules 에 @vercel/routing-utils 없음 — node tools/sync_gate_pkg.js 가 npm i 를 실행한다');
    else {
      const r = require('child_process').spawnSync('npm', ['i', '--no-audit', '--no-fund'], { cwd: pkg, encoding: 'utf8' });
      console.log('  npm i (pkg) exit=' + r.status + (r.status ? ' ' + String(r.stderr).slice(-300) : ''));
    }
  }
  // ★격리구역 _internal_only 조립 (v7.68 인수인계 §3-2 절차 그대로 · 패키지 zip 에는 없다)
  //   ① 정본 _v757_work/chunwoon_ip_poc/_internal_only  ② 영인본_직독_* 를 덮어 얹음  ③ 리포 _internal_only 를 「없는 것만」 보충
  //   eval_distribution_guard C1~C4 · eval_root_wonmun 등이 이 구역을 읽는다. 없으면 그 게이트들이 FAIL 한다(정상 fail-closed).
  const IO = path.join(pkg, '_internal_only');
  if (!fs.existsSync(path.join(IO, 'DO_NOT_DISTRIBUTE.md'))) {
    if (CHECK) console.log('  WARN 패키지 _internal_only 미조립 — node tools/sync_gate_pkg.js 가 조립한다');
    else {
      const cpr = (src, dst, noClobber) => {
        if (!fs.existsSync(src)) return;
        fs.mkdirSync(dst, { recursive: true });
        for (const f of fs.readdirSync(src)) {
          const a = path.join(src, f), b = path.join(dst, f);
          if (fs.statSync(a).isDirectory()) cpr(a, b, noClobber);
          else if (!(noClobber && fs.existsSync(b))) fs.copyFileSync(a, b);
        }
      };
      cpr(path.join(ROOT, '_v757_work', 'chunwoon_ip_poc', '_internal_only'), IO, false);
      for (const d of fs.readdirSync(ROOT).filter((f) => f.startsWith('영인본_직독_'))) cpr(path.join(ROOT, d), path.join(IO, d), false);
      cpr(path.join(ROOT, '_internal_only'), IO, true);
      console.log('  assemble _internal_only (정본 + 영인본_직독_* + 리포 보충)');
    }
  }
  let drift = 0, copied = 0;
  for (const [src, dst, rel] of plan(pkg)) {
    const same = fs.existsSync(dst) && fs.readFileSync(src).equals(fs.readFileSync(dst));
    if (same) continue;
    if (CHECK) { drift++; console.log('  DRIFT ' + rel + (fs.existsSync(dst) ? '' : ' (패키지에 없음)')); continue; }
    fs.copyFileSync(src, dst); copied++; console.log('  copy  ' + rel);
  }
  console.log('[sync_gate_pkg] pkg=' + pkg + (CHECK ? ' · drift=' + drift : ' · copied=' + copied));
  return CHECK && drift ? 1 : 0;
}
module.exports = { resolvePkg, plan };
if (require.main === module) process.exit(main());
