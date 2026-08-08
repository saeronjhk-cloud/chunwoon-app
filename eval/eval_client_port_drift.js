// 천운 — 클라이언트 반입 블록(CW_ENGINE_PORT) 드리프트 게이트 · v7.73 신설
// ═══════════════════════════════════════════════════════════════════════════
// 【왜 신설하는가】
//   v7.73 관통 #7 수리는 에이전트 C 진단의 안 (가) — 「클라 알고리즘을 서버와 **동일한
//   코드**로 교체」다. 화면≠해석 불일치(양력 1.76% · 음력 5.05%)를 정의상 0 으로 만들지만,
//   ★유일한 구조적 약점이 **코드 2벌 드리프트**다: 다음 세션이 `api/_engine/*` 만 고치고
//   `index.html` 을 재생성하지 않으면 관통 #7 이 조용히 재발한다. 그때 증상은 다시
//   「화면과 해석이 다르다」이고, 이번처럼 전수 대조를 돌리기 전까지 아무도 모른다.
//   ⟹ C 가 「이것이 없으면 (가)는 『지금은 0, 다음 세션에 다시 벌어짐』이 된다」고 적은
//     **유일한 방어**를 게이트 1종으로 편입한다.
//
// 【검사하는 성질】
//   「`index.html` 의 `CW_ENGINE_PORT` 블록 == `api/_engine/{astro,lunar,recompute}.js`
//     에서 지금 기계 생성한 산출물」
//   판정 주체는 이 파일이 아니라 **생성기 자신**(`gen_client_astro.js --check`)이다.
//   생성 규칙을 두 곳에 쓰면 그 둘이 갈리는 새 드리프트가 생기기 때문이다.
//
// 【결정 88 — 위약 방지】
//   생성기를 `console.log('OK')` 로 갈아치우면 P-2 는 영원히 녹색이다. 그래서
//   ★P-3 에서 **엔진 1파일을 실제로 바꾼 사본**을 만들어 `--check` 가 FAIL 하는지 본다.
//   ★P-3b 긍정 대조 — 같은 사본을 무변경으로 두면 통과해야 한다(항상-FAIL 위약 차단).
//   ★P-6 — 반입 블록이 **실제로 산출에 쓰이는지**(죽은 코드가 아닌지)를 함께 못박는다.
//     아무도 안 쓰는 블록의 sha 를 지켜 봐야 화면은 여전히 옛 산출식으로 그려진다.
// 【판정 불가 ≠ 통과】 생성기·마커·핀이 없으면 그 자체를 FAIL 로 둔다.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const CWTMP = require('./_tmp.js');   // ★I-62 — 임시 사본 자동 정리
const fs = require('fs');
const path = require('path');
const os = require('os');
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
  console.log('[port_drift] total=0 pass=0 fail=1');
  process.exit(1);
}

const INDEX = path.join(FR, 'index.html');
const INDEX_SRC = fs.readFileSync(INDEX, 'utf8');
const BEGIN = '// ==== CW_ENGINE_PORT BEGIN';
const END = '// ==== CW_ENGINE_PORT END ====';

// ★생성기 위치 — 후보를 열거해 찾는다. 못 찾으면 판정 불가 = FAIL.
//   ★현행 정착지는 `_v773_work/` 인데 그 디렉터리는 `.gitignore` 의 `_v*/` 에 걸려
//     **커밋되지 않는다**. `tools/` 로 옮기면 이 후보 목록이 그대로 흡수한다.
const GEN_CANDIDATES = [
  'tools/gen_client_astro.js',
  '_v773_work/gen_client_astro.js',
  '_v774_work/gen_client_astro.js',
];
const GEN_REL = GEN_CANDIDATES.find((r) => fs.existsSync(path.join(FR, r.split('/').join(path.sep)))) || null;
const GEN_ABS = GEN_REL ? path.join(FR, GEN_REL.split('/').join(path.sep)) : null;

const PIN_CANDIDATES = ['_v773_work/cw_engine_port.pins.json', '_v774_work/cw_engine_port.pins.json', 'tools/cw_engine_port.pins.json'];
const PIN_REL = PIN_CANDIDATES.find((r) => fs.existsSync(path.join(FR, r.split('/').join(path.sep)))) || null;
const PINS = PIN_REL ? JSON.parse(fs.readFileSync(path.join(FR, PIN_REL.split('/').join(path.sep)), 'utf8')) : null;

const SRC_FILES = ['astro.js', 'lunar.js', 'recompute.js'];

function runCheck(genAbs) {
  const r = spawnSync(process.execPath, [genAbs, '--check'], { encoding: 'utf8', timeout: 120000, env: process.env });
  return { status: r.status, out: String(r.stdout || '') + String(r.stderr || '') };
}

// ═══════════════════════════════════════════════════════════════════════════
check('P-0', '★index.html 에 `CW_ENGINE_PORT` 반입 블록이 정확히 1쌍 있다', () => {
  const b = (INDEX_SRC.match(/\/\/ ==== CW_ENGINE_PORT BEGIN/g) || []).length;
  const e = (INDEX_SRC.match(/\/\/ ==== CW_ENGINE_PORT END ====/g) || []).length;
  return { ok: b === 1 && e === 1, detail: 'BEGIN=' + b + ' END=' + e + (b === 1 && e === 1 ? '' : ' — ★마커 소실은 판정 불가(통과 아님)') };
});

check('P-1', '★생성기 `gen_client_astro.js` 가 front_root 에 있다 (없으면 드리프트를 아무도 못 본다)', () =>
  ({ ok: !!GEN_ABS, detail: GEN_ABS ? GEN_REL : '★후보 전건 부재: ' + GEN_CANDIDATES.join(' / ') }));

check('P-2', '★★`gen_client_astro.js --check` 가 통과한다 = 반입 블록 == 엔진 생성물 (드리프트 0)', () => {
  if (!GEN_ABS) return { ok: false, detail: '생성기 부재 — 판정 불가' };
  const r = runCheck(GEN_ABS);
  return { ok: r.status === 0, detail: (r.out.trim().split('\n').slice(-2).join(' | ') || '(무출력)') + ' · exit=' + r.status };
});

// ── ★결정 88 — 이 검사가 살아 있는가를 검사한다 ────────────────────────────
//   엔진을 고치고 index.html 을 재생성하지 않은 상태를 **실제로 만들어** 본다.
let MUT_DIR = null, MUT_GEN = null, mutErr = null;
try {
  MUT_DIR = CWTMP.mk('cw_drift_');
  const cpFile = (rel) => {
    const dst = path.join(MUT_DIR, rel.split('/').join(path.sep));
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(path.join(FR, rel.split('/').join(path.sep)), dst);
    return dst;
  };
  cpFile('index.html');
  for (const f of SRC_FILES) cpFile('api/_engine/' + f);
  // 생성기는 `path.resolve(__dirname,'..')` 를 ROOT 로 삼으므로 **같은 상대 경로**에 둔다.
  MUT_GEN = GEN_REL ? cpFile(GEN_REL) : null;
  if (PIN_REL) cpFile(PIN_REL);
} catch (e) { mutErr = (e && e.message) || String(e); }

check('P-3b', '★긍정 대조 — 무변경 사본에서는 `--check` 가 통과한다 (항상-FAIL 위약이 아님을 증명)', () => {
  if (!MUT_GEN) return { ok: false, detail: '사본 구성 실패: ' + mutErr };
  const r = runCheck(MUT_GEN);
  return { ok: r.status === 0, detail: 'exit=' + r.status + ' · ' + r.out.trim().split('\n').slice(-1)[0] };
});

check('P-3', '★★뮤턴트 — 엔진만 고치고 index.html 을 안 고치면 `--check` 가 **FAIL 한다** (C 가 지적한 코드 2벌 드리프트의 유일한 방어)', () => {
  if (!MUT_GEN) return { ok: false, detail: '사본 구성 실패: ' + mutErr };
  const lp = path.join(MUT_DIR, 'api', '_engine', 'lunar.js');
  const orig = fs.readFileSync(lp, 'utf8');
  try {
    // ★주석이 아니라 **코드**를 더한다. 생성기 R1 이 주석을 걷어내므로 주석 변경은
    //   블록을 바꾸지 않는다(그 경우는 정당하게 재생성 불요다).
    fs.writeFileSync(lp, orig + '\nvar __CW_DRIFT_PROBE__ = 1;\n');
    const r = runCheck(MUT_GEN);
    return { ok: r.status !== 0, detail: r.status !== 0 ? '적발 (exit=' + r.status + ') · ' + r.out.trim().split('\n')[0]
      : '★뮤턴트 생존 — 이 게이트는 위약이다 (exit=0)' };
  } finally { fs.writeFileSync(lp, orig); }
});

check('P-4', '★핀 파일의 엔진 sha256 이 실제 `api/_engine/*` 과 일치한다', () => {
  if (!PINS) return { ok: false, detail: '★핀 파일 부재: ' + PIN_CANDIDATES.join(' / ') };
  const bad = [];
  for (const f of SRC_FILES) {
    const h = sha256(fs.readFileSync(path.join(FR, 'api', '_engine', f)));
    if (!PINS.sources || PINS.sources[f] !== h) bad.push(f + '(핀 ' + String(PINS.sources && PINS.sources[f]).slice(0, 12) + ' != 실측 ' + h.slice(0, 12) + ')');
  }
  return { ok: bad.length === 0, detail: bad.length ? '★' + bad.join(' / ') : SRC_FILES.length + '파일 일치' };
});

check('P-5', '★index.html 블록 헤더의 `block-sha256` == 핀의 `block_sha256` == 실측 블록 해시', () => {
  if (!PINS) return { ok: false, detail: '★핀 파일 부재' };
  const b = INDEX_SRC.indexOf(BEGIN), e = INDEX_SRC.indexOf(END);
  if (b === -1 || e === -1) return { ok: false, detail: '★마커 부재' };
  const seg = INDEX_SRC.slice(b, e + END.length + 1);
  const lines = seg.split('\n');
  const hdr = /block-sha256:\s*([0-9a-f]{64})/.exec(lines[2] || '');
  if (!hdr) return { ok: false, detail: '★헤더에 block-sha256 이 없다 (블록이 손으로 편집됐다)' };
  const body = lines.slice(3, lines.length - 2).join('\n') + '\n';
  const measured = sha256(Buffer.from(body, 'utf8'));
  const ok = hdr[1] === PINS.block_sha256 && measured === PINS.block_sha256;
  return { ok, detail: '헤더=' + hdr[1].slice(0, 12) + ' 핀=' + String(PINS.block_sha256).slice(0, 12) + ' 실측=' + measured.slice(0, 12) };
});

check('P-6', '★★반입 블록이 **실제 산출에 쓰인다** — 옛 클라 전용 산출식이 되살아나지 않았다 (죽은 코드에 핀을 걸면 무의미)', () => {
  const used = (INDEX_SRC.match(/CW_ENGINE\s*\.\s*recompute\s*\(/g) || []).length;
  // v7.73 이 삭제한 「두 번째 구현」들. 하나라도 되살아나면 화면이 다시 갈린다.
  const revived = [];
  if (/const\s+SOLAR_TERMS\s*=/.test(INDEX_SRC)) revived.push('SOLAR_TERMS(절기 고정일표)');
  if (/const\s+LUNAR_INFO\s*=/.test(INDEX_SRC)) revived.push('LUNAR_INFO(음양력 비트표)');
  if (/function\s+getSajuMonthBranch\s*\(/.test(INDEX_SRC)) revived.push('getSajuMonthBranch');
  if (/function\s+getSajuYear\s*\(/.test(INDEX_SRC)) revived.push('getSajuYear');
  if (/function\s+calcDayPillar\s*\(/.test(INDEX_SRC)) revived.push('calcDayPillar');
  return { ok: used >= 1 && revived.length === 0,
    detail: revived.length ? '★클라 전용 산출식 부활: ' + revived.join(', ')
      : 'CW_ENGINE.recompute 호출 ' + used + '곳 · 2벌째 구현 0' };
});

check('P-7', '★블록 크기 하한 — 블록을 비워서 「항상 일치」로 만드는 경로 차단', () => {
  if (!PINS) return { ok: false, detail: '★핀 파일 부재' };
  const b = INDEX_SRC.indexOf(BEGIN), e = INDEX_SRC.indexOf(END);
  const size = (b === -1 || e === -1) ? 0 : Buffer.byteLength(INDEX_SRC.slice(b, e), 'utf8');
  const min = Math.floor((PINS.block_bytes || 0) * 0.6);
  return { ok: min > 5000 && size >= min, detail: '블록 ' + size + 'B ≥ 하한 ' + min + 'B (핀 ' + PINS.block_bytes + 'B)' };
});

check('P-8', '★생성기가 산출물을 **엔진에서** 만든다 — 손으로 쓴 계산 코드가 아니다 (드리프트 표면 0)', () => {
  if (!GEN_ABS) return { ok: false, detail: '생성기 부재' };
  const g = fs.readFileSync(GEN_ABS, 'utf8');
  const reads = /SRC_FILES\s*=\s*\[\s*'astro\.js'\s*,\s*'lunar\.js'\s*,\s*'recompute\.js'\s*\]/.test(g);
  const fromEngine = /readFileSync\(path\.join\(ENGINE_DIR,\s*f\)/.test(g);
  return { ok: reads && fromEngine, detail: 'SRC_FILES 3종=' + reads + ' · 엔진 디렉터리 직독=' + fromEngine };
});

// ── 결과 ────────────────────────────────────────────────────────────────────
const fail = fails.length;
if (fail) {
  console.log('\n[port_drift] 실패 내역');
  for (const f of fails) console.log('  FAIL ' + f.id + ' ' + f.title + '  -> ' + f.detail);
}
console.log('[port_drift] front_root=' + FR + ' · 생성기=' + (GEN_REL || '부재') + ' · 핀=' + (PIN_REL || '부재'));
console.log('[port_drift] total=' + total + ' pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
