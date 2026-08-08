#!/usr/bin/env node
/* tools/run_gate.js — 게이트 목록 SoT (2026-07-28 v7.61 신설 · 인수인계 P1 해소)
 *
 * 【왜 필요한가】
 *   v7.60 까지 eval/ 의 standalone eval 34종 중 러너에 물린 것은 eval_metamorphic.js 1건뿐이었다.
 *   나머지는 「존재하지만 아무도 돌리지 않는 게이트」였다. 게이트 목록의 SoT 자체가 없었다.
 *   이 파일이 그 SoT 다.
 *
 * 【fail-closed 설계】
 *   ① 목록을 하드코딩하지 않고 eval/ 을 열거한다 — 새 eval 이 자동으로 물린다.
 *   ② 그러나 열거만 하면 「파일이 지워지면 0건 통과」가 된다. ⟹ 건수 하한 pin 을 건다.
 *   ③ 각 프로세스의 종료코드를 신뢰한다.
 *   ④ 자식에게 env 를 상속시킨다(CHUNWOON_FRONT_ROOT).
 *
 * ★2026-07-29 v7.63 R5-6 — 게이트 자기무결성 = 외부 pin
 *   【문제】 하한을 자기 파일에 두는 구조는 원리적으로 자기 약화를 잡지 못한다.
 *     eval 이 스스로 EXPECTED_TOTAL 을 44 -> 3 으로 낮추면 그 eval 안의 어떤 pin 도 발화하지 않는다
 *     (A축 관통 4a·4b = 공허 통과). 검증자와 피검증자가 같은 파일이면 무의미하다.
 *   【수리】 핵심 eval 4종의 **검사 수 하한**과 **소스 sha256** 을 이 파일(=외부)에 pin 한다.
 *     선례: eval/eval_distribution_guard.js:139 C8 의 md5 pin 방식을 그대로 차용한다.
 *     · sha256 pin — eval 소스가 한 바이트라도 바뀌면 적발한다(약화·무력화·통삭 전부).
 *       ★정당한 강화 시에는 이 표를 함께 갱신하는 것이 정상 절차다(변경 감지기이지 동결장치가 아니다).
 *     · checks_min — eval 이 stdout 에 선언한 total= 을 외부 하한과 대조한다.
 *       ★total= 패턴을 못 찾으면 FAIL 이다(패턴 소실로 검사를 회피하는 경로 봉쇄).
 *   ★sha256 검증은 scope 와 무관하게 항상 돈다(tools/eval/mut 3분할 어느 쪽으로도 우회 불가).
 *
 * 사용:  npm run gate            (전건)
 *        npm run gate -- eval    (eval 만)   npm run gate -- mut   (mutation 만)
 *        npm run gate -- tools   (validate_ip · verify_schema_v2 · run_eval 만)
 * ★샌드박스에서 bash 45초 제한에 걸리면 위 3분할로 나누어 실행할 것.
 *
 * ★2026-07-31 v7.67 — mut 분할 실행 (mut:1 · mut:2 · mut:3 · 일반형 mut:k/n)
 *   【문제】 `mut` 전건이 샌드박스에서 39~50초로 bash 45초 제한 경계에 있었다. 그래서
 *     「전건 1회 완주」가 환경에 따라 [미검증]으로 남았다 — 게이트가 있어도 돌릴 수 없으면 없는 것과 같다.
 *   【수리】 목록을 n 등분한 k 번째 슬라이스만 실행한다. 경계는 하드코딩 인덱스가 아니라
 *     정렬된 목록의 비율 슬라이스에서 유도하므로 mutation 파일이 늘어도 자동 반영된다.
 *   ★합집합 == 전건 을 매 실행 자기검증한다(아래 mutUnionOk). 분할로 검사를 빠뜨리는 경로 봉쇄.
 *   ★기존 `mut` 인자의 동작은 불변이다(분할 지정이 없으면 전건 실행 · 출력 형식 동일).
 *   ★침식 하한 pin(mut_min)은 **분할이어도 전체 목록**으로 검사한다 — 분할로 우회 불가.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const EVAL_DIR = path.join(ROOT, 'eval');

// ── ★v7.64 관통11 수리 — pin 표를 외부 데이터 파일로 옮긴다 ────────────────
//   【문제】 v7.63 은 pin 표를 이 파일 안에 두었다. 그래서
//     ① eval 을 `node eval/eval_response_scrub.js` 로 **직접 실행**하면 외부 pin 이 아예 안 돈다(관통 11-a).
//     ② 이 파일의 EVAL_PIN·MUT_PIN·EVAL_PIN_TABLE 을 낮춰도 적발자가 리포 전체에 0건이다(관통 11-b).
//   【수리】 pin 표를 eval/_gate_pins.json 으로 외부화한다.
//     · eval 이 **스스로** 그 파일을 읽어 자기 sha256·검사 수 하한을 대조한다(S9) ⟹ 직접 실행도 방어된다.
//     · 이 러너는 pin 파일의 sha256 을 상수로 들고 있어 pin 파일 변조를 적발한다.
//     · eval 은 이 러너가 pin 파일을 참조하는지, 그 상수가 pin 파일과 맞는지를 되짚어 검사한다(상호 대조).
//   【★정직한 한계】 최상위(이 러너 자신)는 결국 자기 신고다. pin 파일 · 이 러너 · eval 셋을
//     **일관되게 동시에** 고치면 어떤 자동 검사도 막지 못한다. 다만 그 변경은 반드시 세 파일의
//     커밋 diff 로 드러난다(pin 표가 버전관리 데이터이므로). 완전 차단이 아니라 **가시화**가 목표다.
//     ★러너 자신의 sha 를 pin 파일에 넣는 것은 상호 해시가 되어(각자가 상대의 해시를 담음) 정당한
//       갱신조차 불가능해지므로 의도적으로 하지 않는다. 그 한 칸이 남는 위험이다.
const GATE_PINS_FILE = path.join(EVAL_DIR, '_gate_pins.json');
const GATE_PINS_SHA256 = '7ad86fee33501c15d80fece0d47a3ee75c807e17de0dee514107b4486f513dbf';

function readPins() {
  if (!fs.existsSync(GATE_PINS_FILE)) return { err: '외부 pin 파일 부재: eval/_gate_pins.json — 판정 불가(통과 아님)' };
  let buf;
  try { buf = fs.readFileSync(GATE_PINS_FILE); } catch (e) { return { err: 'pin 파일 판독 실패: ' + (e && e.message) }; }
  const h = crypto.createHash('sha256').update(buf).digest('hex');
  if (h !== GATE_PINS_SHA256) {
    return { err: 'pin 파일 sha256 불일치 (실측 ' + h.slice(0, 16) + ' != 상수 ' + String(GATE_PINS_SHA256).slice(0, 16) +
      ') — 정당한 갱신이라면 tools/run_gate.js 의 GATE_PINS_SHA256 을 함께 갱신하라' };
  }
  try { return { pins: JSON.parse(buf.toString('utf8')), sha: h }; }
  catch (e) { return { err: 'pin 파일 파싱 실패: ' + (e && e.message) }; }
}

const PINS_R = readPins();
const PINS = PINS_R.pins || null;
const EVAL_PIN = PINS && PINS.runner && typeof PINS.runner.eval_min === 'number' ? PINS.runner.eval_min : Infinity;
const MUT_PIN  = PINS && PINS.runner && typeof PINS.runner.mut_min === 'number' ? PINS.runner.mut_min : Infinity;
const EVAL_PIN_TABLE = (PINS && PINS.evals) ? PINS.evals : {};
// 헬퍼·러너는 개별 실행 대상이 아니다(run_eval 은 tools 구획에서 별도 실행).
const NOT_A_GATE = /^(_|run_eval\.js$|mutation_kill_)/;

function sha256(p) { return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); }

function listEvals() {
  return fs.readdirSync(EVAL_DIR).filter(f => f.endsWith('.js') && !NOT_A_GATE.test(f)).sort();
}
function listMutations() {
  return fs.readdirSync(EVAL_DIR).filter(f => /^mutation_kill_.*\.js$/.test(f)).sort();
}

function run(label, file, cwd) {
  const r = spawnSync(process.execPath, [file], { cwd: cwd || ROOT, env: process.env, encoding: 'utf8' });
  const ok = r.status === 0;
  const out = String(r.stdout || '');
  if (!ok) {
    const tail = out.trim().split('\n').slice(-3).join('\n');
    const err  = String(r.stderr || '').trim().split('\n').slice(-3).join('\n');
    console.log('  FAIL ' + label + '  (exit=' + r.status + ')');
    if (tail) console.log('       out| ' + tail.replace(/\n/g, '\n       out| '));
    if (err)  console.log('       err| ' + err.replace(/\n/g, '\n       err| '));
  }
  return { ok: ok, stdout: out };
}

// ── ★v7.67 mut 분할 ────────────────────────────────────────────────────────
const MUT_SPLIT_DEFAULT = 3;                 // mut:k 로만 쓸 때의 기본 분할 수
// 비율 슬라이스 — 어떤 n 에 대해서도 slice(1..n) 의 합집합이 원본과 정확히 같다.
function sliceOf(files, k, n) {
  const s = Math.floor((k - 1) * files.length / n);
  const e = Math.floor(k * files.length / n);
  return files.slice(s, e);
}
function parseMutSlice(w) {
  const m = /^mut:(\d+)(?:\/(\d+))?$/.exec(w);
  if (!m) return null;
  return { k: parseInt(m[1], 10), n: m[2] ? parseInt(m[2], 10) : MUT_SPLIT_DEFAULT };
}

const which = (process.argv[2] || 'all').toLowerCase();
const MUT_SLICE = parseMutSlice(which);
let fail = 0, total = 0;
const pinFail = [];

// ★v7.67 — 미지의 scope 인자는 아무 것도 실행하지 않고 exit 0 이었다(total=0 fail=0).
//   오타 하나가 「전건 통과」로 보이는 fail-open 이므로 명시 화이트리스트로 닫는다.
if (['all', 'tools', 'eval', 'mut'].indexOf(which) === -1 && !MUT_SLICE) {
  pinFail.push('알 수 없는 scope 인자 "' + which + '" — 사용: all|tools|eval|mut|mut:k[/n] (판정 불가, 통과 아님)');
}
if (MUT_SLICE && !(MUT_SLICE.n >= 1 && MUT_SLICE.k >= 1 && MUT_SLICE.k <= MUT_SLICE.n)) {
  pinFail.push('mut 분할 지정 오류 k=' + MUT_SLICE.k + ' n=' + MUT_SLICE.n + ' — 1 <= k <= n 이어야 한다');
}

if (PINS_R.err) pinFail.push('외부 pin: ' + PINS_R.err);
if (PINS && (!PINS.evals || Object.keys(PINS.evals).length === 0)) pinFail.push('외부 pin: evals 표가 비었다 — 공허 통과');

// ══════════════════════════════════════════════════════════════════════════
// ★v7.72 관통 #6 — 소스 pin 검증 (api/_engine/*.js · api/fortune.js · IP 정책)
// ══════════════════════════════════════════════════════════════════════════
//   ctxguard.js 헤더가 스스로를 「pin 봉인 대상」이라 선언했지만 실제로는 어떤 pin 도
//   `api/_engine/*.js` 를 가리키지 않았다(v7.71 §4-2 #6 · v7.70 I-15 와 같은 계열).
//   ⟹ 여기서 실제로 대조한다. scope 와 무관하게 항상 돈다.
//   ★표가 비어 있으면 「공허 통과」이므로 그 자체를 FAIL 로 둔다.
function frontRootForGate() {
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
if (PINS) {
  const SRC_TABLE = PINS.sources || null;
  if (!SRC_TABLE || Object.keys(SRC_TABLE).length === 0) {
    pinFail.push('외부 pin: sources 표가 비었다 — api/_engine/*.js 가 무봉인이다(관통 #6 재발). node tools/regen_gate_pins.js 로 생성하라');
  } else {
    const FR = frontRootForGate();
    if (!FR) {
      pinFail.push('외부 pin: sources 검증 불가 — front_root 미해석(CHUNWOON_FRONT_ROOT 미설정). 판정 불가는 통과가 아니다');
    } else {
      // ★필수 대상 하한 — 표에서 항목을 지워 감시를 없애는 경로를 막는다.
      const MUST = ['api/fortune.js', 'api/_engine/bind.js', 'api/_engine/ctxguard.js', 'api/_engine/recompute.js'];
      for (const m of MUST) {
        if (!Object.prototype.hasOwnProperty.call(SRC_TABLE, m)) {
          pinFail.push('외부 pin: sources 표에 필수 항목 ' + m + ' 이(가) 없다 — 감시 삭제');
        }
      }
      for (const rel of Object.keys(SRC_TABLE)) {
        const spec = SRC_TABLE[rel] || {};
        const base = (spec.root === 'gate') ? ROOT : FR;
        const fp = path.join(base, rel.split('/').join(path.sep));
        if (!fs.existsSync(fp)) { pinFail.push('외부 pin(src): ' + rel + ' 파일 부재 — 소스 소멸'); continue; }
        let h = null, sz = 0;
        try { h = sha256(fp); sz = fs.statSync(fp).size; }
        catch (e) { pinFail.push('외부 pin(src): ' + rel + ' 판독 실패 ' + (e && e.message)); continue; }
        if (typeof spec.sha256 !== 'string' || spec.sha256.length !== 64) {
          pinFail.push('외부 pin(src): ' + rel + ' sha256 미설정 — 공허 통과');
        } else if (h !== spec.sha256) {
          pinFail.push('외부 pin(src): ' + rel + ' sha256 불일치 (실측 ' + h.slice(0, 16) + ' != pin ' + spec.sha256.slice(0, 16) +
            ') — ★프로덕션 소스가 변경됐다. 정당한 변경이라면 node tools/regen_gate_pins.js 로 갱신하고 그 diff 를 커밋에 남겨라');
        }
        if (typeof spec.bytes_min === 'number' && sz < spec.bytes_min) {
          pinFail.push('외부 pin(src): ' + rel + ' 크기 ' + sz + ' < 하한 ' + spec.bytes_min + ' — 내용 삭제 의심');
        }
      }
    }
  }
}

// ★R5-6 ①소스 sha256 pin — scope 무관하게 항상 검증한다.
for (const f of Object.keys(EVAL_PIN_TABLE)) {
  const spec = EVAL_PIN_TABLE[f];
  const p = path.join(EVAL_DIR, f);
  if (!fs.existsSync(p)) { pinFail.push('외부 pin: ' + f + ' 파일 소멸 — 게이트 침식'); continue; }
  let h = null;
  try { h = sha256(p); } catch (e) { pinFail.push('외부 pin: ' + f + ' 판독 실패 ' + (e && e.message)); continue; }
  if (h !== spec.sha256) {
    pinFail.push('외부 pin: ' + f + ' sha256 불일치 (실측 ' + h.slice(0, 16) + ' != pin ' + String(spec.sha256).slice(0, 16) +
      ') — eval 소스가 변경됐다. 정당한 강화라면 node tools/regen_gate_pins.js 로 외부 pin 을 갱신하라');
  }
  // ★R11-6 침식 래칫 — sha256 은 「바뀌었는가」만 본다. 바꾸면서 pin 도 함께 재생성하면(원리적 한계 2)
  //   sha 대조는 조용히 통과한다. bytes_min 은 regen 이 **내리지 않는** 값이라 그 세탁 경로를 좁힌다.
  //   ★결정 49 정합: 「이 구현이어야 한다」가 아니라 「게이트가 침식되지 않았는가」라는 성질이며,
  //     하한을 실측의 60%로 두어 정당한 리팩터링(공통 헬퍼 추출 등)의 축소를 허용한다.
  if (typeof spec.bytes_min === 'number') {
    let sz = 0;
    try { sz = fs.statSync(p).size; } catch (e) { sz = -1; }
    if (sz < spec.bytes_min) {
      pinFail.push('외부 pin: ' + f + ' ' + sz + '바이트 < 침식 하한 ' + spec.bytes_min + ' — 게이트 통삭·비우기 적발');
    }
  }
}

// ★R11-6 (A축 관통 H 수리) — pin 대상을 「핵심 4종」이 아니라 **게이트 파일 전건**으로 확장한다.
//   【실측된 문제】 v7.65 는 sha256 을 4종에만 걸었다. 나머지 eval 32종과 mutation 13종은
//     파일 **개수**만 채우면 내용이 비어도 통과였다. 실측: eval_scrub_token_policy.js(55,834B)를
//     3행 스텁(59B)으로, mutation_kill_position_meta.js 를 process.exit(0) 로 통삭한 상태에서
//     [gate] scope=eval total=36 fail=0 · scope=mut total=13 fail=0 이 그대로 나왔다.
//   【수리한 성질】 「게이트 파일은 **전부** 개수 + 내용 무결성이 pin 된다」
//     ① pin 표에 있는 파일은 sha256 대조 (위 루프)
//     ② 열거된 게이트 파일은 **예외 없이** pin 표에 있어야 한다 (아래 커버리지)
//     ③ 각 게이트가 stdout 에 선언한 total= 이 외부 하한 이상이어야 한다 (checksMin)
//   ★①②는 scope 와 무관하게 항상 돈다 — tools/eval/mut 3분할 어느 쪽으로도 우회 불가.
//   ★결정 49 정합: 「어떤 구현이어야 한다」가 아니라 「내용이 pin 돼 있는가」라는 성질만 본다.
//     정당한 강화 시에는 node tools/regen_gate_pins.js --expand --measure 로 표를 갱신하는 것이
//     정상 절차이며, 그 갱신은 pin 파일 + 러너 상수의 커밋 diff 로 드러난다.
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

function checksMin(f, stdout) {
  const spec = EVAL_PIN_TABLE[f];
  if (!spec || spec.checks_min === null || spec.checks_min === undefined) return;
  const n = declaredChecks(stdout);
  if (n === null) { pinFail.push('외부 pin: ' + f + ' stdout 에 검사 수 선언 부재 — 대조 불가(통과 아님)'); return; }
  if (n < spec.checks_min) {
    pinFail.push('외부 pin: ' + f + ' 검사 ' + n + ' < 외부 하한 ' + spec.checks_min + ' — 자기 약화 적발');
  }
}

(function pinCoverage() {
  if (PINS_R.err) return;                       // pin 표 자체가 없으면 위에서 이미 FAIL 이다
  let files = [];
  try { files = listEvals().concat(listMutations()); }
  catch (e) { pinFail.push('외부 pin: eval 디렉터리 열거 실패(판정 불가) — ' + (e && e.message)); return; }
  const miss = files.filter((f) => !Object.prototype.hasOwnProperty.call(EVAL_PIN_TABLE, f));
  if (miss.length > 0) {
    pinFail.push('외부 pin: 미핀 게이트 파일 ' + miss.length + '건 [' + miss.slice(0, 8).join(',') +
      (miss.length > 8 ? ',…' : '') + '] — 내용 무결성 무방비. node tools/regen_gate_pins.js --expand --measure 로 확장하라');
  }
  console.log('[gate] pin 커버리지 ' + (files.length - miss.length) + '/' + files.length +
    ' (pin 표 ' + Object.keys(EVAL_PIN_TABLE).length + '항목)');
})();

if (which === 'all' || which === 'tools') {
  console.log('[gate] tools');
  for (const t of ['tools/validate_ip.js', 'tools/verify_schema_v2.js', 'eval/run_eval.js']) {
    total++; if (!run(t, path.join(ROOT, t)).ok) fail++;
  }
}
if (which === 'all' || which === 'eval') {
  const files = listEvals();
  console.log('[gate] eval ' + files.length + '종');
  if (files.length < EVAL_PIN) pinFail.push('eval ' + files.length + ' < 하한 pin ' + EVAL_PIN + ' — 게이트 침식');
  for (const f of files) {
    total++;
    const r = run('eval/' + f, path.join(EVAL_DIR, f));
    if (!r.ok) fail++;
    // ★R5-6 ②검사 수 외부 하한 — eval 이 스스로 EXPECTED_TOTAL 을 낮추는 공허 통과를 잡는다.
    checksMin(f, r.stdout);
  }
}
if (which === 'all' || which === 'mut' || MUT_SLICE) {
  const all = listMutations();
  // ★침식 하한은 분할 여부와 무관하게 **전체 목록**으로 본다(분할로 우회 불가).
  if (all.length < MUT_PIN) pinFail.push('mutation ' + all.length + ' < 하한 pin ' + MUT_PIN + ' — 게이트 침식');
  let files = all;
  if (MUT_SLICE && MUT_SLICE.n >= 1 && MUT_SLICE.k >= 1 && MUT_SLICE.k <= MUT_SLICE.n) {
    // ★합집합 자기검증 — 분할 경계가 항목을 빠뜨리면 즉시 FAIL 한다(공허 통과 차단).
    let union = [];
    for (let i = 1; i <= MUT_SLICE.n; i++) union = union.concat(sliceOf(all, i, MUT_SLICE.n));
    const same = union.length === all.length && union.every((f, i) => f === all[i]);
    if (!same) {
      pinFail.push('★mut 분할 합집합(' + union.length + ') != 전건(' + all.length + ') — 분할 경계 오류로 검사 누락');
    }
    files = sliceOf(all, MUT_SLICE.k, MUT_SLICE.n);
    console.log('[gate] mutation ' + all.length + '종 · 분할 ' + MUT_SLICE.k + '/' + MUT_SLICE.n +
      ' = ' + files.length + '건 [' + (files[0] || '-') + ' … ' + (files[files.length - 1] || '-') + ']' +
      ' · 합집합 대조 ' + (same ? 'OK' : 'FAIL'));
  } else {
    console.log('[gate] mutation ' + files.length + '종');
  }
  for (const f of files) {
    total++;
    const r = run('eval/' + f, path.join(EVAL_DIR, f));
    if (!r.ok) fail++;
    checksMin(f, r.stdout);
  }
}

for (const m of pinFail) console.log('  FAIL SELF 외부 pin  -> ' + m);
console.log('[gate] scope=' + which + ' total=' + total + ' fail=' + (fail + pinFail.length));
process.exit(fail + pinFail.length === 0 ? 0 : 1);
