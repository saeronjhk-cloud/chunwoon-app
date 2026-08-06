#!/usr/bin/env node
/* 천운 v7.73 — 게이트 뮤테이션 검사 (결정 88: 게이트 유효성의 유일한 근거)
 * ══════════════════════════════════════════════════════════════════════════
 * 「보호를 없애는 **한 줄 변경**을 게이트가 잡는가」를 실제로 만들어 확인한다.
 * 생존한 뮤턴트가 있으면 그 검사는 위약(placebo)이다.
 *
 * ★리포는 **한 바이트도 건드리지 않는다.** front_root 사본을 /tmp 에 만들고
 *   `CHUNWOON_FRONT_ROOT` 를 그 사본으로 돌린다.
 * ★긍정 대조(M0)를 반드시 함께 돌린다 — 무변경 사본이 전건 통과하지 않으면
 *   이 하네스 자체가 「항상 FAIL」인 위약이다.
 *
 * 사용:
 *   CHUNWOON_FRONT_ROOT=<리포> CW_GATE_ROOT=/tmp/cw773g node mutation_probe_v773.js
 *   (CW_GATE_ROOT = 게이트 리포 전개 위치. eval/ · tools/ 가 있어야 한다)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const FR = process.env.CHUNWOON_FRONT_ROOT;
const GATE = process.env.CW_GATE_ROOT || '/tmp/cw773g';
if (!FR || !fs.existsSync(path.join(FR, 'api', 'fortune.js'))) {
  console.log('FATAL CHUNWOON_FRONT_ROOT 미지정/부정');
  process.exit(1);
}

function copyTree(s, d) {
  fs.mkdirSync(d, { recursive: true });
  for (const nm of fs.readdirSync(s)) {
    const sp = path.join(s, nm); let st = null;
    try { st = fs.statSync(sp); } catch (e) { continue; }
    if (st.isDirectory()) { copyTree(sp, path.join(d, nm)); continue; }
    if (st.isFile()) fs.copyFileSync(sp, path.join(d, nm));
  }
}
/** front_root 의 「게이트가 보는 표면」만 복제한다. */
function mkFront() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cw_mut_fr_'));
  copyTree(path.join(FR, 'api'), path.join(d, 'api'));
  fs.copyFileSync(path.join(FR, 'index.html'), path.join(d, 'index.html'));
  // ★v7.73-c(D2) — 드리프트 차단기가 `_v773_work/`(gitignore) 에서 `tools/`(커밋 경로)로 이동했다.
  for (const rel of ['tools/gen_client_astro.js', 'tools/cw_engine_port.pins.json']) {
    const src = path.join(FR, rel.split('/').join(path.sep));
    if (!fs.existsSync(src)) continue;
    const dst = path.join(d, rel.split('/').join(path.sep));
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
  return d;
}
/** 게이트 리포 사본 — eval/tools 를 고치는 뮤턴트(M-P1)용. */
function mkGate() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cw_mut_gate_'));
  copyTree(GATE, d);
  return d;
}
const rd = (p) => fs.readFileSync(p, 'utf8');
const wr = (p, s) => fs.writeFileSync(p, s);
/** 정확히 1건만 치환한다. 앵커가 1건이 아니면 예외 — 「못 바꿨는데 잡혔다」를 배제한다. */
function sub1(p, from, to) {
  const s = rd(p);
  const n = typeof from === 'string'
    ? s.split(from).length - 1
    : (s.match(new RegExp(from.source, from.flags.replace('g', '') + 'g')) || []).length;
  if (n !== 1) throw new Error('앵커 ' + n + '건 (1이어야 한다): ' + String(from).slice(0, 60));
  wr(p, s.replace(from, to));
}

function runEval(gateRoot, frontRoot, file) {
  const r = spawnSync(process.execPath, [path.join(gateRoot, 'eval', file)],
    { cwd: gateRoot, encoding: 'utf8', timeout: 300000,
      env: Object.assign({}, process.env, { CHUNWOON_FRONT_ROOT: frontRoot }) });
  const out = String(r.stdout || '') + String(r.stderr || '');
  return { status: r.status, out, failed: (out.match(/^FAIL ([A-Za-z0-9-]+)/gm) || []).map((s) => s.slice(5)) };
}
function runGate(gateRoot, frontRoot, scope) {
  const r = spawnSync(process.execPath, [path.join(gateRoot, 'tools', 'run_gate.js'), scope || 'eval'],
    { cwd: gateRoot, encoding: 'utf8', timeout: 580000,
      env: Object.assign({}, process.env, { CHUNWOON_FRONT_ROOT: frontRoot }) });
  return { status: r.status, out: String(r.stdout || '') + String(r.stderr || '') };
}

const NEW_EVALS = ['eval_ctxguard.js', 'eval_compat_guard.js', 'eval_client_port_drift.js'];

// ══════════════════════════════════════════════════════════════════════════
// 뮤턴트 정의 — 전부 「보호를 없애는 한 줄 변경」
// ══════════════════════════════════════════════════════════════════════════
const MUTANTS = [
  {
    id: 'M1', axis: 'CT-1 (관통 #12)',
    what: 'index.html `cwReadBirth` 의 정본 파싱을 `new Date(bs)` 로 되돌린다',
    expect: ['CT-1'], evals: ['eval_ctxguard.js'],
    apply: (d) => sub1(path.join(d, 'index.html'),
      /const \[y,m,d\]=bs\.split\('-'\)\.map\(Number\);(\s*\n\s*)if\(y<CW_SOLAR_MIN_Y/,
      "const _mb=new Date(bs);const y=_mb.getFullYear(),m=_mb.getMonth()+1,d=_mb.getDate();$1if(y<CW_SOLAR_MIN_Y"),
  },
  {
    id: 'M2', axis: 'CT-1 (사주 외 계열)',
    what: '토정비결 경로에만 `new Date` 를 되돌린다 — CT-1 이 사주 1계열만 보는 검사인지 확인',
    expect: ['CT-1'], evals: ['eval_ctxguard.js'],
    apply: (d) => sub1(path.join(d, 'index.html'),
      "    lunar=solarToLunar(br.y,br.m,br.d);",
      "    const _mb=new Date(br.y+'-'+String(br.m).padStart(2,'0')+'-'+String(br.d).padStart(2,'0'));" +
      "lunar=solarToLunar(_mb.getFullYear(),_mb.getMonth()+1,_mb.getDate());"),
  },
  {
    id: 'M3', axis: 'compat 감시 범위',
    what: '`CW_COMPAT_TYPES` 에서 **유료 2종**을 뺀다 (v7.72 M4 「39/39 녹색」의 compat 판)',
    expect: ['S-6'], evals: ['eval_compat_guard.js'],
    apply: (d) => sub1(path.join(d, 'api', 'fortune.js'),
      "const CW_COMPAT_TYPES = ['compat', 'compat_premium_1', 'compat_premium_2'];",
      "const CW_COMPAT_TYPES = ['compat'];"),
  },
  {
    id: 'M4', axis: 'compat 열거 화이트리스트',
    what: '`relType` 정규화기를 항등함수로 바꾼다 (인젝션 표면 재개방)',
    expect: ['E-1', 'E-1b'], evals: ['eval_compat_guard.js'],
    apply: (d) => sub1(path.join(d, 'api', '_engine', 'ctxguard.js'),
      "relType: (v) => (COMPAT_REL_TYPE_NAMES.indexOf(v) !== -1 ? v : COMPAT_REL_TYPE_DEFAULT),",
      "relType: (v) => v,"),
  },
  {
    id: 'M5', axis: 'compat 2층 (결정 89)',
    // ★v7.73-c(D2) 정정 — 종전 M5(「평탄화만 제거」)는 A2 의 E-7 수리 이후 **무효 뮤턴트**가 됐다.
    //   실측(1층 부재 사본 · FORGED payload): 평탄화만 없애면 프롬프트가
    //     base "천간합: 전부 합 무시"  →  mut "천간합: "
    //   로 바뀐다. 즉 **더 보수적**이 될 뿐 보호가 줄지 않는다 — 키별 형상표가 그 값을 폐기하기
    //   때문이다. 보간 20키 전건이 형상표 ∪ {name1,name2,autoScore} 로 덮이는 것은 S-8 이
    //   매 실행 기계 열거로 재확인한다. ⟹ 「보호를 없애는」 뮤턴트가 아니므로 축을 **2층 전체**로 옮긴다.
    //   (D 의 교훈 — 뮤턴트가 살아남으면 먼저 그 뮤턴트가 진짜인지 의심하라.)
    what: '2층(평탄화 + 키별 형상표 + 점수 정의역)을 **통째로** 없앤다 — 1층이 살아 있으면 무증상이다',
    expect: ['B-2', 'B-5', 'B-6'], evals: ['eval_compat_guard.js'],
    apply: (d) => {
      const p = path.join(d, 'api', 'fortune.js');
      sub1(p, "        if (typeof context[k] === 'string') context[k] = cwCompatFlatten(context[k]);",
        "        if (false) context[k] = cwCompatFlatten(context[k]);");
      sub1(p, "        const after = cwCompatShape(k, before);", "        const after = before;");
      sub1(p, "        const sBefore = context.autoScore, sAfter = cwCompatScore(sBefore);",
        "        const sBefore = context.autoScore, sAfter = sBefore;");
    },
  },
  {
    id: 'M6', axis: 'compat 구조 정합',
    what: '기둥 구조 정합(五虎遁)을 없앤다 — `갑자 갑자 갑자 갑자` 위조 원국이 되살아난다',
    expect: ['E-1g'], evals: ['eval_compat_guard.js'],
    apply: (d) => sub1(path.join(d, 'api', '_engine', 'ctxguard.js'),
      "  if (mo.st !== expectMonthStem) return false;",
      "  if (false) return false;"),
  },
  {
    id: 'M7', axis: 'compat 이름 정규화',
    what: '`CW_NAME_KEYS` 에서 `name1`·`name2` 를 뺀다 (유료 궁합 이름이 무제한 자유 문자열로)',
    expect: ['S-5'], evals: ['eval_compat_guard.js'],
    apply: (d) => sub1(path.join(d, 'api', 'fortune.js'),
      ", 'personaName', 'name1', 'name2'];", ", 'personaName'];"),
  },
  {
    id: 'M8', axis: '반입 블록 드리프트',
    what: '엔진(`lunar.js`)만 고치고 `index.html` 을 재생성하지 않는다 (C 가 지적한 코드 2벌 드리프트)',
    expect: ['P-2', 'P-4'], evals: ['eval_client_port_drift.js'],
    apply: (d) => {
      const p = path.join(d, 'api', '_engine', 'lunar.js');
      wr(p, rd(p) + '\nvar __CW_DRIFT__ = 1;\n');
    },
  },
  {
    id: 'M9', axis: '반입 블록 손편집',
    what: 'index.html 반입 블록 안의 상수를 손으로 1글자 고친다 (생성기를 거치지 않은 변경)',
    expect: ['P-2', 'P-5'], evals: ['eval_client_port_drift.js'],
    apply: (d) => {
      const p = path.join(d, 'index.html');
      const s = rd(p);
      const b = s.indexOf('// ==== CW_ENGINE_PORT BEGIN'), e = s.indexOf('// ==== CW_ENGINE_PORT END ====');
      if (b === -1 || e === -1) throw new Error('마커 부재');
      const seg = s.slice(b, e);
      const m = /minY: 1900/.exec(seg);
      if (!m) throw new Error('블록 안에 minY: 1900 앵커가 없다');
      wr(p, s.slice(0, b) + seg.replace('minY: 1900', 'minY: 1901') + s.slice(e));
    },
  },
  {
    id: 'M12', axis: 'compat 12키 재유도',
    what: '`compatPersonInput` 이 항상 「12키 없음」을 반환하게 한다 — 서버 재유도가 사라져 위조 원국이 그대로 쓰인다',
    expect: ['E-3'], evals: ['eval_compat_guard.js'],
    apply: (d) => sub1(path.join(d, 'api', '_engine', 'ctxguard.js'),
      "  if (!any) return { missing: true };",
      "  if (true) return { missing: true };"),
  },
  {
    id: 'M13', axis: 'compat 점수 정의역',
    what: '`autoScore` 정의역 검사를 없앤다 — 위조 만점 100 이 프롬프트에 실린다',
    expect: ['E-1c'], evals: ['eval_compat_guard.js'],
    apply: (d) => sub1(path.join(d, 'api', '_engine', 'ctxguard.js'),
      "    return (n >= COMPAT_SCORE_MIN && n <= COMPAT_SCORE_MAX) ? n : '';",
      "    return n;"),
  },
  // ══════════════════════════════════════════════════════════════════════════
  // ★v7.73-c (D2) 신설 — **A2 의 수리 4건**(E-1·E-5·E-6·E-7)을 되돌리는 뮤턴트.
  //   A2 는 자기 프로브로 이것들을 잡았지만, 「내 프로브가 잡는다」와
  //   「게이트가 잡는다」는 다른 명제다(E 의 §E-3 지적). 여기서 게이트로 확인한다.
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'ME1', axis: '★E 의 M-E1 — compat 1층 가드 호출 자체',
    what: 'compat 1층 가드 호출을 통째로 없앤다 (E 가 게이트 48/48 녹색으로 생존시킨 뮤턴트)',
    expect: ['E-1', 'E-1b', 'E-3'], evals: ['eval_compat_guard.js'],
    apply: (d) => sub1(path.join(d, 'api', 'fortune.js'),
      "if (CW_COMPAT_TYPES.indexOf(type) !== -1 && context && typeof context === 'object' && !Array.isArray(context)) {",
      "if (false && CW_COMPAT_TYPES.indexOf(type) !== -1 && context && typeof context === 'object' && !Array.isArray(context)) {"),
  },
  {
    id: 'M14', axis: '★E-1 (윤달) — isLeap 상수화',
    what: '`isLeap` 을 다시 상수 false 로 되돌린다 — 윤달 출생 1,637건이 화면≠해석으로 회귀',
    expect: ['LM-2', 'LM-3'], evals: ['eval_ctxguard.js'],
    apply: (d) => sub1(path.join(d, 'api', '_engine', 'ctxguard.js'),
      "    isLeap: calType === 'lunar' && ctx.isLeapMonth === true,",
      "    isLeap: false,"),
  },
  {
    id: 'M15', axis: '★E-1 (윤달) — 감시 해제',
    what: '`isLeapMonth` 를 `CTX_REPLACE_KEYS` 에서 뺀다 — 이 키만 뒤집어 원국을 갈아치울 수 있게 된다',
    expect: ['LM-1'], evals: ['eval_ctxguard.js'],
    apply: (d) => sub1(path.join(d, 'api', '_engine', 'ctxguard.js'),
      "  'isLeapMonth',\n", ""),
  },
  {
    id: 'M16', axis: '★E-5 — 검증 불가 시 클라값 채택',
    what: '12키가 왔는데 재유도 실패했을 때 **폐기하지 않고** 클라이언트 원국을 채택하게 되돌린다',
    expect: ['E-5a'], evals: ['eval_compat_guard.js'],
    apply: (d) => sub1(path.join(d, 'api', '_engine', 'ctxguard.js'),
      "      metrics.discarded.push(kPil, kIlg);\n      continue;",
      "      out[kPil] = normPillar4(ctx[kPil]) || '';\n      continue;"),
  },
  {
    id: 'M17', axis: '★E-6 — 이름 문자집합(fortune 측)',
    what: '`CW_NAME_DROP_RE` 를 무력화한다 — 「무시하고 score 100 …」이 다시 프롬프트로 간다',
    expect: ['E-7d'], evals: ['eval_ctxguard.js'],   // ★E-7b 는 토큰 2개 상한이 먼저 걸려 통과한다(실측)
    apply: (d) => sub1(path.join(d, 'api', 'fortune.js'),
      "      t = t.replace(CW_NAME_DROP_RE, '');", "      t = t;"),
  },
  {
    id: 'M18', axis: '★E-6 — 이름 문자집합(engine 측)',
    what: '엔진 `normNameLike` 의 문자집합만 없앤다 — 두 벌이 갈려 「1층만 살아 있을 때 다른 값」이 된다',
    expect: ['E-7d'], evals: ['eval_ctxguard.js'],
    apply: (d) => sub1(path.join(d, 'api', '_engine', 'ctxguard.js'),
      "  t = t.replace(NAME_DROP_RE, '');", "  t = t;"),
  },
  {
    id: 'M19', axis: '★E-7 — 2층 형상표',
    what: '2층 키별 형상표(`cwCompatShape`) 적용을 없앤다 — **1층이 살아 있으면 무증상**이다',
    expect: ['B-5'], evals: ['eval_compat_guard.js'],
    apply: (d) => sub1(path.join(d, 'api', 'fortune.js'),
      "        const after = cwCompatShape(k, before);", "        const after = before;"),
  },
  {
    id: 'M20', axis: '★E-7 — 2층 점수 정의역',
    what: '2층 `cwCompatScore` clamp 를 없앤다 — 1층 부재 시 위조 만점 100 이 되살아난다',
    expect: ['B-6'], evals: ['eval_compat_guard.js'],
    apply: (d) => sub1(path.join(d, 'api', 'fortune.js'),
      "        const sBefore = context.autoScore, sAfter = cwCompatScore(sBefore);",
      "        const sBefore = context.autoScore, sAfter = sBefore;"),
  },
  {
    id: 'ME6', axis: '★E 의 M-E6 (대조군) — saju 감시 키 제거',
    what: '`CTX_GUARDED_KEYS` 를 5키로 잘라낸다 — 로드 시점 throw 로 적발돼야 정상(fail-closed 확인)',
    expect: ['로드 시점 throw'], evals: ['eval_ctxguard.js'],
    apply: (d) => sub1(path.join(d, 'api', '_engine', 'ctxguard.js'),
      "const CTX_GUARDED_KEYS = Object.freeze(CTX_REPLACE_KEYS.concat(['hourLabel']));",
      "const CTX_GUARDED_KEYS = Object.freeze(CTX_REPLACE_KEYS.slice(0, 5));"),
  },
  {
    id: 'M10', axis: '소스 pin (v7.72 관통 #6)',
    what: '프로덕션 소스(`api/fortune.js`)에 주석 1줄을 더한다 — pin 재생성 없이',
    expect: ['SELF 외부 pin(src)'], evals: [], gateScope: 'eval',
    apply: (d) => { const p = path.join(d, 'api', 'fortune.js'); wr(p, rd(p) + '\n// mutant\n'); },
  },
  {
    id: 'M11', axis: '게이트 자기무결성',
    what: '★게이트 파일 자체를 약화한다 — `eval_ctxguard.js` 의 CT-1 을 항상 통과로',
    expect: ['SELF 외부 pin'], evals: [], gateScope: 'eval', mutateGate: true,
    applyGate: (g) => sub1(path.join(g, 'eval', 'eval_ctxguard.js'),
      "  if (!CT1_MAIN) return { ok: false, detail: '★판정 불가(통과 아님): ' + CT1_ERR };\n  // ★지문이 비거나",
      "  return { ok: true, detail: 'MUTANT' };\n  // ★지문이 비거나"),
  },
];

// ══════════════════════════════════════════════════════════════════════════
(function main() {
  const rows = [];
  let survived = 0;

  // ── M0 긍정 대조 ─────────────────────────────────────────────────────────
  const base = mkFront();
  const b0 = NEW_EVALS.map((f) => ({ f, r: runEval(GATE, base, f) }));
  const b0ok = b0.every((x) => x.r.status === 0);
  console.log('M0  [긍정 대조] 무변경 사본 — ' + b0.map((x) => x.f.replace('eval_', '').replace('.js', '') + '=' +
    (x.r.status === 0 ? 'PASS' : 'FAIL(' + x.r.failed.join(',') + ')')).join(' · '));
  if (!b0ok) console.log('    ★★하네스 자체가 위약이다 — 무변경 사본이 통과하지 않는다. 이하 결과는 무의미하다.');
  rows.push({ id: 'M0', axis: '긍정 대조', what: '무변경 사본', killed: b0ok, by: b0ok ? '전건 통과(정상)' : '★하네스 이상' });

  for (const m of MUTANTS) {
    let killed = false, by = '', err = null;
    try {
      const d = mkFront();
      let gateRoot = GATE;
      if (m.mutateGate) { gateRoot = mkGate(); m.applyGate(gateRoot); }
      if (m.apply) m.apply(d);

      if (m.evals && m.evals.length) {
        const hits = [];
        for (const f of m.evals) {
          const r = runEval(gateRoot, d, f);
          if (r.status !== 0) hits.push(f.replace('eval_', '').replace('.js', '') + ':' + r.failed.join(','));
        }
        killed = hits.length > 0;
        by = hits.join(' | ') || '(전건 통과 — 생존)';
      } else {
        const r = runGate(gateRoot, d, m.gateScope || 'eval');
        const lines = r.out.split('\n').filter((l) => /FAIL SELF 외부 pin/.test(l));
        killed = r.status !== 0 && lines.length > 0;
        by = lines.length ? lines[0].trim().slice(0, 150) : '(pin 미발화 — 생존)';
      }
    } catch (e) { err = (e && e.message) || String(e); }
    if (err) { by = '★뮤테이션 적용 실패: ' + err; killed = false; }
    if (!killed) survived++;
    console.log((killed ? 'KILL' : '★SURVIVED') + ' ' + m.id + '  [' + m.axis + '] ' + m.what);
    console.log('       기대=' + (m.expect || []).join(',') + '  실제→ ' + by);
    rows.push({ id: m.id, axis: m.axis, what: m.what, killed, by });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ★★MG — 게이트 **자산 커밋 경로** 뮤테이션 (v7.73-c · D2 신설)
  // ══════════════════════════════════════════════════════════════════════════
  //   `eval_gate_asset_commit.js` 는 git 에 직접 묻는 검사라 위의 mkFront 사본
  //   (git 리포가 아님)으로는 판정할 수 없다. ⟹ **실제 git 리포 사본**을 만들어
  //   ① 커밋된 정상 상태에서 전건 통과하는가(긍정 대조 — 「항상 FAIL」 위약이 아님)
  //   ② 자산을 ignore 되는 경로로 되돌리면 적발하는가(I-42·E-3·E-4 재발 시나리오)
  //   를 확인한다.
  const GIT_ENV = Object.assign({}, process.env, {
    GIT_AUTHOR_NAME: 'gate', GIT_AUTHOR_EMAIL: 'gate@local',
    GIT_COMMITTER_NAME: 'gate', GIT_COMMITTER_EMAIL: 'gate@local',
  });
  const sh = (cwd, args) => spawnSync('git', args, { cwd, encoding: 'utf8', env: GIT_ENV, timeout: 120000 });
  function mkGitFront() {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cw_mut_git_'));
    copyTree(path.join(FR, 'api'), path.join(d, 'api'));
    copyTree(path.join(FR, 'eval'), path.join(d, 'eval'));
    copyTree(path.join(FR, 'tools'), path.join(d, 'tools'));
    for (const f of ['index.html', '.gitignore', '.vercelignore', 'package.json', 'vercel.json']) {
      const s = path.join(FR, f); if (fs.existsSync(s)) fs.copyFileSync(s, path.join(d, f));
    }
    fs.mkdirSync(path.join(d, 'js'), { recursive: true });
    const cj = path.join(FR, 'js', 'chat.js');
    if (fs.existsSync(cj)) fs.copyFileSync(cj, path.join(d, 'js', 'chat.js'));
    sh(d, ['init', '-q']);
    sh(d, ['add', '-A']);
    sh(d, ['commit', '-q', '-m', 'gate asset commit-path fixture']);
    return d;
  }
  const GATE_ASSET_EVAL = 'eval_gate_asset_commit.js';
  const MG = [
    { id: 'MG0', ctl: true, what: '(긍정 대조) 게이트 자산이 **커밋된** 리포 — 전건 통과해야 한다', apply: null },
    { id: 'MG1', what: '드리프트 차단기를 `_v773_work/`(gitignore 경로)로 되돌린다 — E-4 재발',
      apply: (d) => {
        fs.mkdirSync(path.join(d, '_v773_work'), { recursive: true });
        fs.renameSync(path.join(d, 'tools', 'gen_client_astro.js'), path.join(d, '_v773_work', 'gen_client_astro.js'));
        sh(d, ['add', '-A']); sh(d, ['commit', '-q', '-m', 'mutant MG1']);
      } },
    { id: 'MG2', what: '`.gitignore` 에 `eval/` 를 넣는다 — 게이트 검사가 커밋되지 않는 상태(I-42·E-3)',
      apply: (d) => {
        fs.appendFileSync(path.join(d, '.gitignore'), '\neval/\n');
        sh(d, ['add', '-A']); sh(d, ['commit', '-q', '-m', 'mutant MG2']);
      } },
    { id: 'MG3', what: '`.vercelignore` 에 `!/eval` 를 넣는다 — 내부 검사 로직이 배포 번들로 나간다',
      apply: (d) => {
        fs.appendFileSync(path.join(d, '.vercelignore'), '\n!/eval\n');
        sh(d, ['add', '-A']); sh(d, ['commit', '-q', '-m', 'mutant MG3']);
      } },
  ];
  console.log('');
  for (const m of MG) {
    let ok = null, by = '', err = null;
    try {
      const d = mkGitFront();
      if (m.apply) m.apply(d);
      const r = runEval(GATE, d, GATE_ASSET_EVAL);
      ok = r.status === 0;
      by = ok ? '전건 통과' : 'FAIL ' + r.failed.join(',');
    } catch (e) { err = (e && e.message) || String(e); }
    const good = err ? false : (m.ctl ? ok === true : ok === false);
    if (!good) survived++;
    console.log((good ? (m.ctl ? 'OK  ' : 'KILL') : '★SURVIVED') + ' ' + m.id + '  ' + m.what);
    console.log('       실제→ ' + (err ? '★예외: ' + err : by) +
      (m.ctl && !good ? '   ★긍정 대조가 실패하면 MG1~MG3 의 적발은 아무것도 증명하지 못한다' : ''));
    rows.push({ id: m.id, what: m.what, killed: good, by });
  }

  const N = MUTANTS.length + MG.length;
  console.log('\n[mutation] 뮤턴트 ' + N + '종(자산 커밋 경로 ' + MG.length + '종 포함) · 적발/정상 ' + (N - survived) + ' · ★생존 ' + survived);
  console.log('[mutation] total=' + (N + 1) + ' pass=' + (N + 1 - survived - (b0ok ? 0 : 1)) + ' fail=' + (survived + (b0ok ? 0 : 1)));
  process.exit(survived === 0 && b0ok ? 0 : 1);
})();
