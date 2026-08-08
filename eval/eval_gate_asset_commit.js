// 천운 — ★게이트 자산 **커밋 경로** 게이트 (v7.73-c 신설 · 에이전트 D2)
// ═══════════════════════════════════════════════════════════════════════════
// 【왜 신설하는가 — 3세션 연속 같은 형태】
//   v7.72 I-42 : `git add _v771_work/` 는 `.gitignore` 의 언더바-v 규칙 때문에 no-op 였다.
//   v7.73 E-3  : compat 수리를 지키는 검사 전부가 `_v773_work/` 안에 있어 **커밋되지 않았다**.
//                ⟹ 커밋되는 순간 v7.73 의 본체가 무감시 코드가 된다.
//   v7.73 E-4  : 반입 블록 드리프트 차단기(`gen_client_astro.js`)와 그 핀도 같은 이유로
//                커밋되지 않았다. 신선한 clone 에서는 방어가 **조용히 사라진다**.
//   세 번 다 「옮겼으니 될 것이다 · 넣었으니 될 것이다」라는 **추정**이 원인이었고,
//   그 추정을 깨뜨릴 검사가 리포에 하나도 없었다.
//   ⟹ 이 파일이 그 성질을 **git 에게 직접 물어서** 못박는다. 추정 0.
//
// 【무엇을 검사하는가】
//   ① 게이트 자산이 front_root 에 실재하는가                          (A-2)
//   ② 그 전건이 `.gitignore` 에 걸리지 않는가 = **커밋 가능한가**      (A-3) ← I-42·E-3·E-4 본체
//   ③ 그 전건이 실제로 커밋돼 있고 커밋 바이트 == 워킹 바이트인가      (A-4) ★커밋 전에는 정상 FAIL
//   ④ 게이트가 **실행하는 사본**과 리포에 **커밋되는 사본**이 같은가   (A-5) 스테일 사본 차단
//   ⑤ 그 전건이 `.vercelignore` 로 배포 번들에서 제외되는가            (A-6) 내부 검사 로직 노출 차단
//   ⑥ 그런데 배포 필수 자산은 제외되지 **않는가**                      (A-7) ★A-6 의 긍정 짝(결정 88)
//   ⑦ 두 배제목록이 서로 어긋나지 않는가(git 포함 ∧ vercel 제외)       (A-8)
//   ⑧ 신설 게이트가 pin 표에 등재됐는가 = 무감시 자산이 아닌가         (A-9)
//
// 【결정 88 이행 — 위약 차단】
//   · A-1 이 **대조군**이다. 「무시된다고 알려진 경로」가 실제로 무시된다고 보고되지
//     않으면 git 질의 하네스가 죽은 것이고, 그때 A-3 의 녹색은 아무것도 증명하지 않는다.
//   · A-7 이 A-6 의 긍정 짝이다. 「전부 배제」인 목록에서는 A-6 이 언제나 녹색이다.
//   · front_root 가 git 워크트리가 아니면 **판정 불가 = FAIL** 이다(통과 아님).
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');

function frontRoot() {
  const env = process.env.CHUNWOON_FRONT_ROOT;
  if (env && fs.existsSync(path.join(env, 'api', 'fortune.js'))) return env;
  let d = ROOT;
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(d, 'api', 'fortune.js')) && fs.existsSync(path.join(d, 'index.html'))) return d;
    const up = path.dirname(d);
    if (up === d) break;
    d = up;
  }
  return null;
}
const FR = frontRoot();

let total = 0, pass = 0;
const fails = [];
function check(id, title, fn) {
  total++;
  let ok = false, detail = '';
  try { const r = fn(); if (r && typeof r === 'object') { ok = !!r.ok; detail = r.detail || ''; } else { ok = !!r; } }
  catch (e) { ok = false; detail = '예외: ' + ((e && e.message) || String(e)); }
  if (ok) { pass++; console.log('PASS ' + id + '  ' + title + (detail ? '   — ' + detail : '')); }
  else { fails.push({ id, title, detail }); console.log('FAIL ' + id + '  ' + title + (detail ? '   — ' + detail : '')); }
}

if (!FR) {
  console.log('FATAL front_root 미해석 — CHUNWOON_FRONT_ROOT 를 지정하십시오');
  console.log('[gate_asset] total=0 pass=0 fail=1');
  process.exit(1);
}

// ── 게이트 자산 목록 (★하드 최소 집합 — 지워서 감시를 없애는 경로 차단) ─────
//   「이 세션이 만든 방어를 지키는 파일」 전건이다. 새 게이트 자산을 추가하면
//   여기에도 넣어야 한다(넣지 않으면 커밋 경로가 감시되지 않는다).
const REQUIRED = Object.freeze([
  'eval/eval_ctxguard.js',
  'eval/eval_compat_guard.js',
  'eval/eval_client_port_drift.js',
  'eval/eval_gate_asset_commit.js',
  'eval/eval_lunar_ui_dom.js',   // ★v7.74 F-1 — 「UI 조작 → 판독」 축. 미커밋이면 무감시다.
  'eval/eval_port_isolation.js', // ★v7.74 E-8 — 반입 블록 폭발반경 축. 미커밋이면 무감시다.
  // ★v7.74 A-10 이 적발한 누락 3종 — 리포 eval/ 에 실재하는데 이 목록에 없어
  //   커밋 경로가 **감시되지 않고 있었다**(I-44 계열의 네 번째 형태).
  'eval/eval_engine_binding.js',
  'eval/eval_response_scrub.js',
  'eval/eval_token_roundtrip.js',
  'eval/_gate_pins.json',
  'tools/run_gate.js',
  'tools/regen_gate_pins.js',
  'tools/gen_client_astro.js',
  'tools/cw_engine_port.pins.json',
  'tools/mutation_probe_v773.js',
]);
// 배포 필수 자산 — A-7 대조군. 이것들이 배제되면 앱이 죽는다.
const DEPLOY_MUST = Object.freeze(['index.html', 'api/fortune.js', 'js/chat.js', 'vercel.json', 'package.json']);
// 무시된다고 **알려진** 경로 — A-1 대조군(하네스 유효성).
const KNOWN_IGNORED = Object.freeze(['_v773_work/AGENT_D_REPORT.md', 'node_modules/x.js']);

const abs = (rel) => path.join(FR, rel.split('/').join(path.sep));
function git(args) {
  const r = spawnSync('git', ['-C', FR].concat(args), { encoding: 'utf8', timeout: 60000 });
  return { status: r.status, out: String(r.stdout || ''), err: String(r.stderr || '') };
}
/**
 * @returns {true|false|null} null = 판정 불가(통과 아님)
 * ★`--no-index` 가 **필수**다. 기본 `git check-ignore` 는 **이미 추적 중인 경로를
 *   무시로 보고하지 않는다.** 그래서 「자산을 커밋한 뒤 `.gitignore` 에 그 경로를
 *   넣는」 변경이 이 검사를 그대로 통과한다(D2 뮤테이션 MG2 로 실측 — 생존했다).
 *   우리가 묻는 것은 「지금 추적 중인가」가 아니라 **「규칙상 커밋될 수 있는 경로인가」**
 *   이므로 인덱스를 보지 않고 규칙만 본다.
 */
function gitIgnored(rel) {
  const r = git(['check-ignore', '-q', '--no-index', '--', rel]);
  if (r.status === 0) return true;
  if (r.status === 1) return false;
  return null;
}
const IN_REPO = git(['rev-parse', '--is-inside-work-tree']).out.trim() === 'true';

// ── .vercelignore 판정 — **실제 gitignore 엔진**으로 잰다 ────────────────────
//   Vercel 의 .vercelignore 는 gitignore 문법이다(`ignore` 패키지). 자체 구현한
//   「gitignore-lite」매처는 `/*` + `!` allowlist 구조를 잘못 읽으므로 쓰지 않는다.
//   ⟹ 임시 git 리포에 .vercelignore 를 .gitignore 로 놓고 git 에게 직접 묻는다.
const VI = (() => {
  const p = path.join(FR, '.vercelignore');
  if (!fs.existsSync(p)) return { err: '.vercelignore 부재 — 배포 배제 규칙 없음(판정 불가)' };
  let d = null;
  try {
    d = fs.mkdtempSync(path.join(os.tmpdir(), 'cw_vi_'));
    const init = spawnSync('git', ['init', '-q', d], { encoding: 'utf8', timeout: 60000 });
    if (init.status !== 0) return { err: 'git init 실패: ' + String(init.stderr || '').trim() };
    fs.copyFileSync(p, path.join(d, '.gitignore'));
  } catch (e) { return { err: '임시 리포 구성 실패: ' + ((e && e.message) || String(e)) }; }
  return {
    dir: d,
    excluded(rel) {
      const r = spawnSync('git', ['-C', d, 'check-ignore', '-q', '--no-index', '--', rel], { encoding: 'utf8', timeout: 60000 });
      if (r.status === 0) return true;
      if (r.status === 1) return false;
      return null;
    },
  };
})();

// ═══════════════════════════════════════════════════════════════════════════
check('A-0', '★front_root 가 git 워크트리다 (아니면 커밋 경로 판정 자체가 불가 = 통과 아님)', () =>
  ({ ok: IN_REPO, detail: 'front_root=' + FR + ' inRepo=' + IN_REPO }));

check('A-1', '★대조군 — 무시된다고 알려진 경로를 git 이 실제로 무시한다고 보고한다 (질의 하네스 유효성)', () => {
  if (!IN_REPO) return { ok: false, detail: 'git 워크트리 아님 — 판정 불가' };
  const bad = [], seen = [];
  for (const rel of KNOWN_IGNORED) {
    const v = gitIgnored(rel);
    seen.push(rel + '=' + (v === null ? '판정불가' : v));
    if (v !== true) bad.push(rel);
  }
  return { ok: bad.length === 0, detail: bad.length
    ? '★' + bad.join(',') + ' 가 무시로 보고되지 않는다 — 하네스가 죽었다면 A-3 의 녹색은 무의미하다'
    : seen.join(' · ') };
});

check('A-2', '★게이트 자산 ' + REQUIRED.length + '종이 front_root 에 실재한다', () => {
  const miss = REQUIRED.filter((r) => !fs.existsSync(abs(r)));
  return { ok: miss.length === 0, detail: miss.length ? '★부재 ' + miss.join(',') : REQUIRED.length + '종 전건 존재' };
});

check('A-3', '★★게이트 자산 전건이 `.gitignore` 에 걸리지 않는다 = **커밋 가능하다** (I-42·E-3·E-4)', () => {
  if (!IN_REPO) return { ok: false, detail: 'git 워크트리 아님 — 판정 불가' };
  const bad = [];
  for (const rel of REQUIRED) {
    const v = gitIgnored(rel);
    if (v === null) { bad.push(rel + '(판정불가)'); continue; }
    if (v === true) {
      const why = git(['check-ignore', '-v', '--no-index', '--', rel]).out.trim().split('\n')[0] || '';
      bad.push(rel + ' ← ' + why);
    }
  }
  return { ok: bad.length === 0, detail: bad.length
    ? '★커밋되지 않는 경로에 있다: ' + bad.join(' / ')
    : REQUIRED.length + '종 전건 커밋 가능(ignore 규칙 미해당)' };
});

check('A-4', '★게이트 자산 전건이 **커밋돼 있고** 커밋 blob == 워킹 바이트다', () => {
  if (!IN_REPO) return { ok: false, detail: 'git 워크트리 아님 — 판정 불가' };
  const bad = [];
  for (const rel of REQUIRED) {
    const tracked = git(['ls-files', '--error-unmatch', '--', rel]).status === 0;
    if (!tracked) { bad.push(rel + '(미추적)'); continue; }
    const r = spawnSync('git', ['-C', FR, 'show', 'HEAD:' + rel], { encoding: 'buffer', timeout: 60000 });
    if (r.status !== 0) { bad.push(rel + '(HEAD blob 부재)'); continue; }
    let cur = null;
    try { cur = fs.readFileSync(abs(rel)); } catch (e) { bad.push(rel + '(판독 실패)'); continue; }
    if (sha256(r.stdout) !== sha256(cur)) bad.push(rel + '(커밋 blob != 워킹)');
  }
  return { ok: bad.length === 0, detail: bad.length
    ? '★' + bad.length + '건: ' + bad.join(' / ') + '  ← 커밋 전이라면 정상 FAIL 이다(커밋 후 재실행하면 해소)'
    : REQUIRED.length + '종 전건 커밋 결속' };
});

check('A-5', '★게이트가 **실행하는 사본**과 리포에 **커밋되는 사본**이 바이트 동일하다 (스테일 사본 차단)', () => {
  const bad = [], seen = [];
  for (const rel of REQUIRED) {
    const g = path.join(ROOT, rel.split('/').join(path.sep));
    if (!fs.existsSync(g)) { seen.push(rel + '=게이트 패키지에 없음'); continue; }
    if (!fs.existsSync(abs(rel))) { bad.push(rel + '(front_root 부재)'); continue; }
    const a = sha256(fs.readFileSync(g)), b = sha256(fs.readFileSync(abs(rel)));
    if (a !== b) bad.push(rel + '(게이트 ' + a.slice(0, 12) + ' != 리포 ' + b.slice(0, 12) + ')');
  }
  // 게이트 패키지에 사본이 하나도 없으면 「비교할 게 없어서 녹색」이다 ⟹ 판정 불가 = FAIL.
  const compared = REQUIRED.filter((rel) => fs.existsSync(path.join(ROOT, rel.split('/').join(path.sep)))).length;
  if (compared === 0) return { ok: false, detail: '★대조 0건 — 게이트 패키지에 자산이 없다(판정 불가는 통과가 아니다)' };
  return { ok: bad.length === 0, detail: bad.length ? '★갈림 ' + bad.join(' / ') : compared + '종 바이트 동일' + (seen.length ? ' · ' + seen.join(',') : '') };
});

check('A-6', '★게이트 자산 전건이 `.vercelignore` 로 **배포 번들에서 제외**된다 (내부 검사 로직 노출 차단)', () => {
  if (VI.err) return { ok: false, detail: '★' + VI.err };
  const bad = [];
  for (const rel of REQUIRED) {
    const v = VI.excluded(rel);
    if (v !== true) bad.push(rel + '=' + (v === null ? '판정불가' : '배포됨'));
  }
  return { ok: bad.length === 0, detail: bad.length ? '★' + bad.join(' / ') : REQUIRED.length + '종 전건 배포 제외' };
});

check('A-7', '★긍정 짝 — 배포 **필수** 자산은 `.vercelignore` 에 걸리지 않는다 (「전부 제외」 위약 차단)', () => {
  if (VI.err) return { ok: false, detail: '★' + VI.err };
  const bad = [];
  for (const rel of DEPLOY_MUST) {
    const v = VI.excluded(rel);
    if (v !== false) bad.push(rel + '=' + (v === null ? '판정불가' : '★배제됨(앱이 죽는다)'));
  }
  return { ok: bad.length === 0, detail: bad.length ? '★' + bad.join(' / ') : DEPLOY_MUST.length + '종 전건 배포 포함' };
});

check('A-8', '★두 배제목록이 어긋나지 않는다 — 게이트 자산은 (git 포함) ∧ (vercel 제외)', () => {
  if (!IN_REPO) return { ok: false, detail: 'git 워크트리 아님 — 판정 불가' };
  if (VI.err) return { ok: false, detail: '★' + VI.err };
  const bad = [];
  for (const rel of REQUIRED) {
    const g = gitIgnored(rel), v = VI.excluded(rel);
    if (g === null || v === null) { bad.push(rel + '(판정불가)'); continue; }
    if (g === true) bad.push(rel + '(git 이 배제 — 커밋 불가)');
    if (v === false) bad.push(rel + '(vercel 이 포함 — 배포 노출)');
  }
  return { ok: bad.length === 0, detail: bad.length ? '★' + bad.join(' / ') : REQUIRED.length + '종 전건 정합' };
});

check('A-9', '★신설 게이트가 외부 pin 표(eval/_gate_pins.json)에 등재돼 있다 (pin 없는 자산 = 무감시)', () => {
  const p = path.join(__dirname, '_gate_pins.json');
  if (!fs.existsSync(p)) return { ok: false, detail: '★pin 표 부재 — 판정 불가' };
  let j = null;
  try { j = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return { ok: false, detail: 'pin 표 파싱 실패' }; }
  const evals = (j && j.evals) || {};
  // ★v7.74 F-1 — eval_lunar_ui_dom.js 추가. 이 게이트가 사라지면 「UI 조작 → 판독」 축이
  //   통째로 무감시가 된다(v7.73 이 그 상태로 배포됐고 그것이 이번 사고의 자리였다).
  const need = ['eval_ctxguard.js', 'eval_compat_guard.js', 'eval_client_port_drift.js', 'eval_gate_asset_commit.js', 'eval_lunar_ui_dom.js', 'eval_port_isolation.js'];
  const miss = need.filter((f) => !Object.prototype.hasOwnProperty.call(evals, f));
  const noSha = need.filter((f) => evals[f] && (typeof evals[f].sha256 !== 'string' || evals[f].sha256.length !== 64));
  return { ok: miss.length === 0 && noSha.length === 0,
    detail: miss.length || noSha.length ? '★미등재 ' + miss.join(',') + ' · sha 결손 ' + noSha.join(',') : need.length + '종 등재 + sha256 pin' };
});

// ══════════════════════════════════════════════════════════════════════════
// ★A-9 (v7.74 신설) — REQUIRED 는 **손으로 유지하는 목록**이다. 새 게이트 자산을 만들고
//   목록에 넣는 것을 잊으면 그 파일의 커밋 경로가 감시되지 않는다 = I-44 의 네 번째 형태.
//   ⟹ front_root 의 `eval/` · `tools/` 에 **실재하는** 게이트 파일을 열거해 REQUIRED 와
//     대조한다. 목록을 사람이 아니라 파일 시스템이 유지하게 만든다.
//   ★게이트 패키지(zip 전개본)의 eval/ 이 아니라 **리포(front_root)의 eval/** 을 본다.
//     zip 쪽에는 리포에 없는 v7.70 자산이 다수 있어 열거 대상이 아니다.
// ══════════════════════════════════════════════════════════════════════════
check('A-10', '★★리포의 `eval/`·`tools/` 게이트 파일 **전건**이 REQUIRED 목록에 있다 (목록 갱신 누락 차단)', () => {
  const found = [];
  for (const dir of ['eval', 'tools']) {
    const d = path.join(FR, dir);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d)) {
      if (!/\.(js|json)$/.test(f)) continue;
      if (/_MUTANT\.js$/.test(f)) continue;              // 뮤테이션 실행 부산물
      found.push(dir + '/' + f);
    }
  }
  const missing = found.filter((r) => REQUIRED.indexOf(r) < 0);
  return { ok: missing.length === 0,
    detail: missing.length
      ? '★REQUIRED 누락 ' + missing.length + '건: ' + missing.join(' / ') + ' — 새 게이트 자산은 REQUIRED 에 넣어야 커밋 경로가 감시된다'
      : found.length + '종 전건 등재(리포 eval/ ' + found.filter((x) => x.startsWith('eval/')).length + ' · tools/ ' + found.filter((x) => x.startsWith('tools/')).length + ')' };
});

console.log('\n[gate_asset] front_root=' + FR + ' · 게이트 패키지=' + ROOT);
if (fails.length) {
  console.log('[gate_asset] 실패 내역');
  for (const f of fails) console.log('  FAIL ' + f.id + ' ' + f.title + '  -> ' + f.detail);
}
console.log('[gate_asset] total=' + total + ' pass=' + pass + ' fail=' + (total - pass));
process.exit(fails.length ? 1 : 0);
