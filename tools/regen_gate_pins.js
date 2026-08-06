#!/usr/bin/env node
/* tools/regen_gate_pins.js — 외부 pin 표(eval/_gate_pins.json) 재생성기 (v7.64 신설)
 *
 * 【왜 필요한가】
 *   pin 표를 손으로 고치다가 sha256 을 앞 16자만 치환하고 뒷부분을 구값으로 남긴 실패가 있었다.
 *   이 도구는 64자 전체를 항상 재계산해 넣는다. 사람이 sha 를 직접 타이핑하지 않게 한다.
 *
 * 【쓰는 때】
 *   eval 을 **정당하게** 강화한 직후. 강화 없이 이 도구를 돌리면 약화가 그대로 승인되므로
 *   실행 전후의 checks_min 변화를 반드시 커밋 diff 로 확인할 것.
 *
 * 사용: node tools/regen_gate_pins.js [--expand] [--measure[=k/n]] [--checks eval_response_scrub.js=56 ...]
 *   --expand      pin 표를 eval/ 의 게이트 파일 전건(eval + mutation_kill)으로 확장한다. (R11-6)
 *   --measure     각 게이트를 실행해 stdout 의 total= 로 checks_min 을 세운다. 상향만 허용한다.
 *   --measure=k/n 샌드박스 45초 제한 대응 — 전체를 n 등분해 k 번째 슬라이스만 계측한다.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const EVAL_DIR = path.join(ROOT, 'eval');
const PINS = path.join(EVAL_DIR, '_gate_pins.json');
const RUNNER = path.join(__dirname, 'run_gate.js');

const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

// ★R11-6 — 게이트가 stdout 에 **선언한 검사 수**를 읽는다.
//   구현 형태를 하나로 못박으면(total= 만 인정) 정당한 리포터 차이가 「대조 불가」로 뒤집힌다.
//   ⟹ 이 리포에 실재하는 3형태를 전부 받아들이고, 어느 것도 못 찾으면 null 을 돌려준다.
//   ★tools/regen_gate_pins.js 에 **동일 소스**가 있다. 한쪽만 고치면 pin 값과 대조값이 어긋난다.
function declaredChecks(stdout) {
  const s = String(stdout || '');
  let m = s.match(/\btotal=(\d+)/);
  if (m) return parseInt(m[1], 10);
  m = s.match(/\bpass\s+(\d+)\s*\/\s*fail\s+(\d+)/);
  if (m) return parseInt(m[1], 10) + parseInt(m[2], 10);
  m = s.match(/\bkilled\s+(\d+)\s*\/\s*(\d+)/);
  if (m) return parseInt(m[2], 10);
  return null;
}


const { spawnSync } = require('child_process');

const argv = process.argv.slice(2);
const over = {};
let doExpand = false;
let measure = null;      // null | { k: 1, n: 1 }  — 슬라이스 계측(45초 샌드박스 대응)
for (const a of argv) {
  const m = a.match(/^--checks=?(.+?)=(\d+)$/);
  if (m) { over[m[1]] = parseInt(m[2], 10); continue; }
  if (a === '--expand') { doExpand = true; continue; }
  const mm = a.match(/^--measure(?:=(\d+)\/(\d+))?$/);
  if (mm) { measure = mm[1] ? { k: parseInt(mm[1], 10), n: parseInt(mm[2], 10) } : { k: 1, n: 1 }; continue; }
}

// ★R11-6 — 게이트 파일 열거 규칙은 tools/run_gate.js 와 **같은 성질**이어야 한다.
//   run_gate 의 listEvals + listMutations 합집합. _MUTANT.js 는 mutation 실행 부산물이므로 제외한다.
const NOT_A_GATE = /^(_|run_eval\.js$|mutation_kill_)/;
function listGateFiles() {
  return fs.readdirSync(EVAL_DIR)
    .filter((f) => /\.js$/.test(f) && !/_MUTANT\.js$/.test(f))
    .filter((f) => !NOT_A_GATE.test(f) || /^mutation_kill_.*\.js$/.test(f))
    .sort();
}


// ══════════════════════════════════════════════════════════════════════════
// ★v7.72 관통 #6 — 소스 pin (api/_engine/*.js · api/fortune.js · IP 정책 파일)
// ══════════════════════════════════════════════════════════════════════════
//   【왜】 ctxguard.js 는 헤더에서 스스로를 「_gate_pins.json 의 sha256 봉인 대상」이라
//     선언했으나 **거짓이었다.** pin 표의 대상은 eval/mutation + tools/run_gate.js 뿐이고
//     `api/_engine/*.js` 는 단 한 건도 pin 되어 있지 않았다(v7.71 §4-2 관통 #6).
//     v7.70 I-15(`claim_whitelist.json` 무봉인)도 같은 결함이라 함께 닫는다.
//   【무엇을 막는가】 게이트 파일을 건드리지 않고 **프로덕션 소스만** 조용히 바꾸는 경로.
//     교체 화이트리스트(CTX_REPLACE_KEYS) 한 줄을 지우면 감시가 사라지지만 종전에는
//     어떤 pin 도 울리지 않았다.
//   【한계 — 정직하게】 소스는 정상적으로 자주 바뀌므로 이 pin 은 「변경 금지」가 아니라
//     **「변경의 가시화」**다. 갱신은 regen 으로만 하고, 그 diff 가 커밋에 남는다.
const SOURCE_PIN_TARGETS = [
  'api/fortune.js',
  'api/_engine/package.json',
  'api/_engine/bind.js',
  'api/_engine/ctxguard.js',
  'api/_engine/recompute.js',
  'api/_engine/astro.js',
  'api/_engine/lunar.js',
  'api/_engine/daewoon.js',
  'api/_engine/myeongli.js',
  'api/_engine/manse.js',
  'api/_engine/authority.js',
];
// IP 정책 파일은 게이트 패키지 안(ROOT)에 있다 — front_root 가 아니다.
const SOURCE_PIN_TARGETS_LOCAL = [
  'IP/policy/claim_whitelist.json',
];
function frontRootForPins() {
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

const j = JSON.parse(fs.readFileSync(PINS, 'utf8'));

// ★--expand — pin 표를 게이트 파일 전건으로 확장한다(관통 H 수리의 데이터 측).
//   기존 항목의 checks_min 은 절대 건드리지 않는다. 새 항목만 null 로 넣고 --measure 가 채운다.
if (doExpand) {
  let added = 0;
  for (const f of listGateFiles()) {
    if (!Object.prototype.hasOwnProperty.call(j.evals, f)) { j.evals[f] = { checks_min: null, sha256: null }; added++; }
  }
  console.log('[regen] --expand: 신규 pin 항목 ' + added + '건 (표 총 ' + Object.keys(j.evals).length + '항목)');
}

// ★--measure — 각 게이트를 실제로 실행해 stdout 의 total= 을 읽어 checks_min 을 세운다.
//   ★약화 승인 방지: 이미 세워진 checks_min 보다 **낮은** 값으로는 내리지 않는다(상향만 허용).
//     내리려면 --checks 로 명시해야 하며 그 의도는 커밋 diff 에 드러난다.
if (measure) {
  const keys = Object.keys(j.evals).sort();
  let done = 0, skipped = 0;
  for (let i = 0; i < keys.length; i++) {
    if (measure.n > 1 && (i % measure.n) !== (measure.k - 1)) { skipped++; continue; }
    const f = keys[i];
    const fp = path.join(EVAL_DIR, f);
    if (!fs.existsSync(fp)) continue;
    if (/^_/.test(f)) { j.evals[f].checks_min = null; continue; }   // 헬퍼는 단독 실행 대상이 아니다
    const r = spawnSync(process.execPath, [fp], { cwd: ROOT, env: process.env, encoding: 'utf8' });
    if (r.status !== 0) { console.log('  ★경고: ' + f + ' 실행 실패(exit=' + r.status + ') — checks_min 유지'); continue; }
    const v = declaredChecks(r.stdout);
    if (v === null) { console.log('  ★' + f + ': 검사 수 미선언 → checks_min 유지(' + j.evals[f].checks_min + ')'); done++; continue; }
    const cur = j.evals[f].checks_min;
    j.evals[f].checks_min = (typeof cur === 'number' && cur > v) ? cur : v;
    done++;
  }
  // mutation 실행 부산물 정리 — 남기면 다음 eval 열거가 오염된다.
  for (const f of fs.readdirSync(EVAL_DIR)) if (/_MUTANT\.js$/.test(f)) { try { fs.unlinkSync(path.join(EVAL_DIR, f)); } catch (e) {} }
  console.log('[regen] --measure: 계측 ' + done + '건 · 슬라이스 제외 ' + skipped + '건');
}

for (const f of Object.keys(j.evals)) {
  const p = path.join(EVAL_DIR, f);
  if (!fs.existsSync(p)) { console.log('  경고: ' + f + ' 부재 — pin 유지'); continue; }
  j.evals[f].sha256 = sha(p);
  // ★R11-6 침식 래칫 — 실측 크기의 60%를 하한으로 세우되 **내리지 않는다**(단조 상승).
  const sz = fs.statSync(p).size;
  const want = Math.floor(sz * 0.6);
  const curB = j.evals[f].bytes_min;
  j.evals[f].bytes_min = (typeof curB === 'number' && curB > want) ? curB : want;
  if (Object.prototype.hasOwnProperty.call(over, f)) j.evals[f].checks_min = over[f];
}
// ★v7.72 — 소스 pin 생성. front_root 를 못 찾으면 **기존 표를 지우지 않고 중단**한다
//   (빈 표를 써 버리면 run_gate 의 「공허 통과」 차단에 걸려 원인이 흐려진다).
{
  const FR = frontRootForPins();
  if (!FR) {
    console.log('  ★경고: front_root 미해석 — sources pin 을 건너뛴다(기존 표 유지). CHUNWOON_FRONT_ROOT 를 지정하라');
  } else {
    j.sources = j.sources || {};
    let n = 0, miss = 0;
    for (const rel of SOURCE_PIN_TARGETS) {
      const fp = path.join(FR, rel.split('/').join(path.sep));
      if (!fs.existsSync(fp)) { console.log('  ★경고: 소스 부재 ' + rel + ' — pin 유지'); miss++; continue; }
      const cur = j.sources[rel] || {};
      const sz = fs.statSync(fp).size;
      const want = Math.floor(sz * 0.6);
      j.sources[rel] = {
        sha256: sha(fp),
        bytes_min: (typeof cur.bytes_min === 'number' && cur.bytes_min > want) ? cur.bytes_min : want,
        root: 'front',
      };
      n++;
    }
    for (const rel of SOURCE_PIN_TARGETS_LOCAL) {
      const fp = path.join(ROOT, rel.split('/').join(path.sep));
      if (!fs.existsSync(fp)) { console.log('  ★경고: 소스 부재(local) ' + rel + ' — pin 유지'); miss++; continue; }
      const cur = j.sources[rel] || {};
      const sz = fs.statSync(fp).size;
      const want = Math.floor(sz * 0.6);
      j.sources[rel] = {
        sha256: sha(fp),
        bytes_min: (typeof cur.bytes_min === 'number' && cur.bytes_min > want) ? cur.bytes_min : want,
        root: 'gate',
      };
      n++;
    }
    console.log('[regen] sources pin ' + n + '건 (부재 ' + miss + '건) · front_root=' + FR);
  }
}

j.generated_at = new Date().toISOString();
fs.writeFileSync(PINS, JSON.stringify(j, null, 2) + '\n');

const pinsSha = sha(PINS);
let src = fs.readFileSync(RUNNER, 'utf8');
const rx = /(GATE_PINS_SHA256\s*=\s*')([0-9a-f]{64}|__PINS_SHA__)(')/;
if (!rx.test(src)) { console.log('FAIL: run_gate.js 에 GATE_PINS_SHA256 상수를 찾지 못했다'); process.exit(1); }
src = src.replace(rx, '$1' + pinsSha + '$3');   // ★64자 전체 치환
fs.writeFileSync(RUNNER, src);

console.log('[regen] eval/_gate_pins.json 갱신 · sha256=' + pinsSha);
const keysOut = Object.keys(j.evals);
console.log('[regen] pin 항목 ' + keysOut.length + '건 · checks_min 미설정 ' +
  keysOut.filter((f) => j.evals[f].checks_min === null || j.evals[f].checks_min === undefined).length + '건');
for (const f of keysOut) {
  console.log('  ' + f + '  checks_min=' + j.evals[f].checks_min + '  bytes_min=' + j.evals[f].bytes_min + '  sha=' + String(j.evals[f].sha256).slice(0, 16));
}
