// 천운 — 임시 사본 누수 게이트 · v7.75 신설 (I-62)
// ═══════════════════════════════════════════════════════════════════════════
// 【왜 신설하는가 — 실측된 사고】
//   게이트·뮤테이션 하네스는 `mkdtemp` 로 `api/` 트리와 `index.html` 을 통째로
//   복사한다(뮤턴트 1종당 1벌). 그런데 **한 번도 지우지 않았다.**
//   v7.75 세션 중 `/sessions` 가 **100% 포화**(9.3G/9.8G)됐고, 그 순간부터
//   **모든 게이트가 `ENOSPC` 로 실패**했다.
//   ★진짜 위험은 실패가 아니라 **오진**이었다 — 게이트가 느려지고 타임아웃처럼
//     보여서 「샌드박스 단일 명령 시간 상한」으로 원인을 잘못 짚었고, 그 상태로
//     뮤테이션 샤딩까지 만들었다. 디스크를 비우자 같은 게이트가 **0.27초**에 끝났다.
//   ⟹ 「게이트가 거짓으로 실패하는 환경」은 게이트 자신이 감시해야 한다.
//
// 【이 게이트가 검사하는 성질】
//   「게이트·프로브가 만든 임시 디렉터리는 **프로세스가 어떻게 끝나든** 남지 않는다.」
//   정상 종료 · 예외 종료 · 신호(SIGTERM) 전부.
//   ★판정 주체는 소스가 아니라 **자식 프로세스를 실제로 죽여 보고 남았는지 세는 것**이다.
//
// 【위약 방지】
//   · H-2 긍정 대조 — 살아 있는 동안에는 **존재해야** 한다(「아예 안 만든다」가 녹색이 되는 것 차단).
//   · H-6 ★대조군 — `fs.mkdtempSync` 를 **직접** 쓴 자식 프로세스는 **반드시 남아야** 한다.
//     남지 않으면 OS/샌드박스가 알아서 지우고 있다는 뜻이고, 그때 H-3~H-5 의 녹색은
//     아무것도 증명하지 않는다(결정 88·95 의 대조군 원칙).
//   · 자식 실행 실패·판정 불가는 전부 **FAIL**(통과 아님).
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const CWTMP = require('./_tmp.js');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const TMPD = os.tmpdir();

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
  try { const r = fn(); if (r && typeof r === 'object') { ok = !!r.ok; detail = r.detail || ''; } else ok = !!r; }
  catch (e) { ok = false; detail = '예외: ' + ((e && e.message) || String(e)); }
  if (ok) { pass++; console.log('PASS ' + id + '  ' + title + (detail ? '   — ' + detail : '')); }
  else { fails.push({ id, title, detail }); console.log('FAIL ' + id + '  ' + title + (detail ? '   — ' + detail : '')); }
}
function done() {
  const fail = fails.length;
  if (fail) {
    console.log('\n[tmp_hygiene] 실패 내역');
    for (const f of fails) console.log('  FAIL ' + f.id + ' ' + f.title + '  -> ' + f.detail);
  }
  console.log('[tmp_hygiene] tmpdir=' + TMPD);
  console.log('[tmp_hygiene] total=' + total + ' pass=' + pass + ' fail=' + fail);
  process.exit(fail ? 1 : 0);
}

// ── SELF-1 : 외부 pin 자기검사 ──────────────────────────────────────────────
const EXPECTED_TOTAL_MIN = 8;
check('SELF-1', '★_gate_pins.json 자기검사 — 자기 sha256 · 검사 수 하한', () => {
  const pinPath = path.join(__dirname, '_gate_pins.json');
  if (!fs.existsSync(pinPath)) return { ok: false, detail: '★pin 표 부재 — 판정 불가' };
  let pins = null;
  try { pins = JSON.parse(fs.readFileSync(pinPath, 'utf8')); } catch (e) { return { ok: false, detail: 'pin 판독 실패' }; }
  const spec = pins && pins.evals && pins.evals['eval_tmp_hygiene.js'];
  if (!spec || !spec.sha256) return { ok: false, detail: '★pin 표에 자기 항목이 없다' };
  const self = crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex');
  if (self !== spec.sha256)
    return { ok: false, detail: '★자기 sha256 불일치 (실측 ' + self.slice(0, 16) + ' != pin ' + String(spec.sha256).slice(0, 16) + ')' };
  if (typeof spec.checks_min === 'number' && spec.checks_min < EXPECTED_TOTAL_MIN)
    return { ok: false, detail: '★checks_min ' + spec.checks_min + ' < ' + EXPECTED_TOTAL_MIN };
  // ★헬퍼 자신도 pin 돼 있어야 한다 — 안 그러면 정리 코드를 지워도 아무도 모른다.
  if (!pins.evals['_tmp.js'] || !pins.evals['_tmp.js'].sha256)
    return { ok: false, detail: '★`_tmp.js` 가 pin 표에 없다 — 정리 헬퍼가 무감시다' };
  return { ok: true, detail: 'sha256 일치 · checks_min=' + spec.checks_min + ' · _tmp.js pin 확인' };
});

// ══════════════════════════════════════════════════════════════════════════
// H-1 표면 열거 — `fs.mkdtempSync` 직접 호출이 `_tmp.js` 밖에 없다
// ══════════════════════════════════════════════════════════════════════════
// ★예외는 **표식 1개**로만 허용한다. 파일 단위로 면제하면 그 파일 전체가
//   정리 밖이 되고, 그것이 바로 I-62 가 생긴 방식이다.
//   현재 유일한 정당 사용처는 이 파일의 **H-6 대조군**(일부러 남겨야 하는 자식)이다.
const ALLOW_MARK = 'CW_TMP_ALLOW_RAW';
const ALLOW_MAX = 1;

/** 지정 루트의 eval/·tools/ 에서 정리 밖 `mkdtempSync` 를 열거한다. */
function scanRaw(root) {
  const bad = [];
  let marks = 0;
  for (const dir of ['eval', 'tools']) {
    const d = path.join(root, dir);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d)) {
      if (!/\.js$/.test(f) || /_MUTANT\.js$/.test(f)) continue;
      if (dir === 'eval' && f === '_tmp.js') continue;   // 헬퍼 본체 — 여기가 유일한 구현부다
      let src = '';
      try { src = fs.readFileSync(path.join(d, f), 'utf8'); } catch (e) { continue; }
      let n = 0;
      for (const l of src.split('\n')) {
        if (!/mkdtempSync\s*\(/.test(l)) continue;
        if (/^\s*(\/\/|\*)/.test(l)) continue;                 // 설명 주석은 정상
        if (l.indexOf(ALLOW_MARK) !== -1) { marks++; continue; } // ★표식 있는 줄만 면제
        n++;
      }
      if (n) bad.push(dir + '/' + f);
    }
  }
  return { bad, marks };
}

// ★H-1 은 **리포(front_root)** 를 본다 — 우리가 고치고 커밋할 수 있는 범위다.
check('H-1', '★리포의 게이트·툴에서 `fs.mkdtempSync` 직접 호출이 **`_tmp.js` 외 0건**이다 (정리 밖 경로 차단)', () => {
  if (!FR) return { ok: false, detail: '★front_root 미해석 — 판정 불가' };
  const { bad, marks } = scanRaw(FR);
  if (marks > ALLOW_MAX)
    return { ok: false, detail: '★면제 표식 ' + marks + '개 > 상한 ' + ALLOW_MAX + ' — 표식을 뿌려서 감시를 없앨 수 없다' };
  return { ok: bad.length === 0,
    detail: bad.length ? '★정리 밖에서 임시 디렉터리를 만든다: ' + bad.join(' / ')
      : '직접 호출 0건 (면제 표식 ' + marks + '/' + ALLOW_MAX + ' — H-6 대조군)' };
});

// ══════════════════════════════════════════════════════════════════════════
// H-1b — ★게이트 패키지(zip 전개본)에만 있는 누수원. **리포에 없어 커밋으로 고칠 수 없다.**
//   ⟹ 「고쳤다」고 말하지 않고 **알려진 집합으로 못박아 늘어나는 것만 막는다**(침식 래칫).
//   ★이 목록을 늘리는 것은 「누수를 허용한다」는 뜻이다. 늘릴 거면 그 파일을 리포로
//     편입해서 H-1 이 보게 만드는 쪽이 옳다.
// ══════════════════════════════════════════════════════════════════════════
const PKG_KNOWN_LEAKERS = Object.freeze([
  'eval/eval_scrub_token_policy.js',   // cw_tokpol_
  'tools/token_drift_probe.js',        // cw_drift_
]);

check('H-1b', '★게이트 패키지 전용 파일의 누수원이 **알려진 ' + PKG_KNOWN_LEAKERS.length + '건을 넘지 않는다** (리포 밖이라 수리 불가 — 증가만 막는다)', () => {
  const { bad } = scanRaw(ROOT);
  // 리포에도 있는 파일은 H-1 소관이므로 여기서 뺀다.
  const pkgOnly = FR ? bad.filter((rel) => !fs.existsSync(path.join(FR, rel.split('/').join(path.sep)))) : bad;
  const added = pkgOnly.filter((r) => PKG_KNOWN_LEAKERS.indexOf(r) === -1);
  const gone = PKG_KNOWN_LEAKERS.filter((r) => pkgOnly.indexOf(r) === -1);
  if (added.length)
    return { ok: false, detail: '★신규 누수원 ' + added.join(',') + ' — 리포로 편입해 H-1 이 보게 하십시오' };
  return { ok: true,
    detail: pkgOnly.length + '건(알려진 집합 이내)' + (gone.length ? ' · 해소됨: ' + gone.join(',') : '') };
});

// ══════════════════════════════════════════════════════════════════════════
// 자식 프로세스 실구동 — 실제로 만들고, 실제로 죽여 보고, 남았는지 센다
// ══════════════════════════════════════════════════════════════════════════
const HELPER = path.join(__dirname, '_tmp.js').split(path.sep).join('/');

/**
 * @param {'exit'|'throw'|'signal'|'raw'} mode
 * @returns {{dir:string|null, alive:boolean, err:string|null}}
 *   `raw` 는 대조군 — 헬퍼를 쓰지 않고 `fs.mkdtempSync` 를 직접 부른다.
 */
function runChild(mode) {
  const script = mode === 'raw'
    ? "const fs=require('fs'),os=require('os'),p=require('path');" +
      "const d=fs.mkdtempSync(p.join(os.tmpdir(),'cw_hygraw_'));" +   // CW_TMP_ALLOW_RAW — H-6 대조군(일부러 남긴다)
      "fs.writeFileSync(p.join(d,'x'),'1');process.stdout.write('DIR'+d);process.exit(0);"
    : "const T=require('" + HELPER + "');const fs=require('fs'),p=require('path');" +
      "const d=T.mk('cw_hyg_');fs.writeFileSync(p.join(d,'x'),'1');process.stdout.write('DIR'+d);" +
      (mode === 'exit' ? "process.exit(0);"
        : mode === 'throw' ? "throw new Error('의도된 예외');"
          : "process.kill(process.pid,'SIGTERM');setTimeout(()=>{},3000);");
  const r = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8', timeout: 30000 });
  const out = String(r.stdout || '');
  const i = out.indexOf('DIR');
  if (i === -1) return { dir: null, alive: false, err: 'DIR 미출력 exit=' + r.status + ' ' + String(r.stderr || '').slice(0, 120) };
  const dir = out.slice(i + 3).trim();
  return { dir, alive: fs.existsSync(dir), err: null };
}

check('H-2', '★긍정 대조 — `mk()` 가 **실제로 디렉터리를 만든다** (「아예 안 만든다」가 녹색인 위약 차단)', () => {
  const d = CWTMP.mk('cw_hygself_');
  const made = fs.existsSync(d);
  fs.writeFileSync(path.join(d, 'probe'), '1');
  const usable = fs.existsSync(path.join(d, 'probe'));
  return { ok: made && usable, detail: made ? '생성·쓰기 가능' : '★생성 실패' };
});

check('H-3', '★★정상 종료(`process.exit`) 뒤에 임시 디렉터리가 **남지 않는다**', () => {
  const r = runChild('exit');
  if (r.err) return { ok: false, detail: '★판정 불가: ' + r.err };
  return { ok: !r.alive, detail: r.alive ? '★잔존: ' + r.dir : '정리됨' };
});

check('H-4', '★★미처리 예외로 죽어도 **남지 않는다** (게이트가 중간에 터지는 경우)', () => {
  const r = runChild('throw');
  if (r.err) return { ok: false, detail: '★판정 불가: ' + r.err };
  return { ok: !r.alive, detail: r.alive ? '★잔존: ' + r.dir : '정리됨' };
});

check('H-5', '★★`SIGTERM` 으로 죽어도 **남지 않는다** (`timeout` 명령이 보내는 신호 — 샌드박스에서 실제로 잦다)', () => {
  const r = runChild('signal');
  if (r.err) return { ok: false, detail: '★판정 불가: ' + r.err };
  return { ok: !r.alive, detail: r.alive ? '★잔존: ' + r.dir : '정리됨' };
});

check('H-6', '★★대조군 — `fs.mkdtempSync` 를 **직접** 쓴 자식은 반드시 **남는다** (OS 가 대신 지워 주는 환경이 아님을 증명)', () => {
  const r = runChild('raw');
  if (r.err) return { ok: false, detail: '★판정 불가: ' + r.err };
  const alive = r.alive;
  if (alive) { try { fs.rmSync(r.dir, { recursive: true, force: true }); } catch (e) { /* 뒷정리 실패는 판정과 무관 */ } }
  return { ok: alive,
    detail: alive ? '대조군 잔존 확인 → H-3~H-5 의 녹색이 의미를 갖는다'
      : '★대조군이 스스로 사라졌다 — 이 환경에서는 H-3~H-5 가 아무것도 증명하지 않는다' };
});

// ══════════════════════════════════════════════════════════════════════════
// H-7 — 실제 게이트 1회 실행이 잔여를 남기지 않는다 (종단)
// ══════════════════════════════════════════════════════════════════════════
check('H-7', '★★실제 게이트(`eval_client_port_drift.js`) 1회 실행이 **잔여 0**이다 (종단 실측)', () => {
  const target = path.join(__dirname, 'eval_client_port_drift.js');
  if (!fs.existsSync(target)) return { ok: false, detail: '★대상 게이트 부재 — 판정 불가' };
  const snap = () => new Set(fs.readdirSync(TMPD).filter((f) => /^cw_/.test(f)));
  const before = snap();
  const r = spawnSync(process.execPath, [target], { encoding: 'utf8', timeout: 120000, env: process.env });
  const after = snap();
  const leaked = [...after].filter((f) => !before.has(f));
  // ★게이트가 실패해도(예: front_root 미지정) **잔여 여부**는 판정할 수 있다.
  return { ok: leaked.length === 0,
    detail: leaked.length ? '★잔여 ' + leaked.length + '건: ' + leaked.slice(0, 4).join(',')
      : '잔여 0 (대상 게이트 exit=' + r.status + ')' };
});

done();
