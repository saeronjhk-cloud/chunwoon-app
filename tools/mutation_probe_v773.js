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
const CWTMP = require('../eval/_tmp.js');   // ★I-62 — 임시 사본 자동 정리
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
  const d = CWTMP.mk('cw_mut_fr_');
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
  const d = CWTMP.mk('cw_mut_gate_');
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

const NEW_EVALS = ['eval_ctxguard.js', 'eval_compat_guard.js', 'eval_client_port_drift.js', 'eval_lunar_ui_dom.js', 'eval_port_isolation.js', 'eval_tojeong_guard.js'];

// ══════════════════════════════════════════════════════════════════════════
// ★v7.75 T 군 — 「tojeong 2층 평탄화」 게이트(eval_tojeong_guard.js)의 유효성 증명
// ══════════════════════════════════════════════════════════════════════════
//   tojeong 은 400 차단 대상이 아니므로 이 층이 무력화돼도 **응답은 정상**이다.
//   즉 정상 경로에서 아무 증상이 없다 ⟹ 뮤턴트가 유일한 감시다(결정 96).
const T_MUTANTS = [
  {
    id: 'MT1', axis: '★관통 #9 — tojeong 평탄화 무력화',
    what: '`cwCompatFlatten` 호출을 tojeong 루프에서 뺀다 — 개행 주입이 프롬프트 줄을 위조할 수 있게 된다',
    expect: ['T-1'], evals: ['eval_tojeong_guard.js'],
    apply: (d) => sub1(path.join(d, 'api', 'fortune.js'),
      "        const after = cwCompatFlatten(before);\n        if (after !== before) { context[k] = after; cwTjFlattened.push(k); }",
      "        const after = before;\n        if (after !== before) { context[k] = after; cwTjFlattened.push(k); }"),
  },
  {
    id: 'MT2', axis: '★관통 #9 — 유료 2종을 범위에서 제거',
    what: '`CW_TOJEONG_TYPES` 에서 유료 2종(₩4,900 × 2)을 뺀다 — v7.72 M4·v7.73 M3 의 tojeong 판',
    expect: ['T-4', 'T-6'], evals: ['eval_tojeong_guard.js'],
    apply: (d) => sub1(path.join(d, 'api', 'fortune.js'),
      "const CW_TOJEONG_TYPES = ['tojeong', 'tojeong_premium_1', 'tojeong_premium_2'];",
      "const CW_TOJEONG_TYPES = ['tojeong'];"),
  },
  {
    id: 'MT4', axis: '★관통 #9 (1층) — 서버 재유도 호출 제거',
    what: '`guardTojeongContext` 호출을 없앤다 — 위조 원국이 그대로 프롬프트에 도달한다',
    expect: ['T-7', 'T-8'], evals: ['eval_tojeong_guard.js'],
    apply: (d) => sub1(path.join(d, 'api', 'fortune.js'),
      "        if (mod && typeof mod.guardTojeongContext === 'function') {",
      "        if (false && mod && typeof mod.guardTojeongContext === 'function') {"),
  },
  {
    id: 'MT5', axis: '★관통 #9 (1층) — 검증 불가 시 클라값 채택 (M16 의 tojeong 판)',
    what: '재유도 실패 시 파생 키를 **폐기하지 않고** 클라이언트 값을 그대로 쓰게 되돌린다',
    expect: ['T-10'], evals: ['eval_tojeong_guard.js'],
    apply: (d) => sub1(path.join(d, 'api', '_engine', 'ctxguard.js'),
      "    metrics.applied = true; metrics.mode = 'discarded'; metrics.reason = 'DERIVE_FAILED';",
      "    metrics.discarded = 0; metrics.applied = true; metrics.mode = 'legacy'; metrics.reason = 'DERIVE_FAILED';"),
  },
  {
    id: 'MT6', axis: '★★I-43 유형 — 「서버가 읽는데 클라가 안 싣는 키」',
    what: '클라이언트 무료 tojeong payload 에서 5키를 뺀다 — 서버는 계속 읽지만 영원히 `mode:legacy` 가 된다',
    expect: ['T-12'], evals: ['eval_tojeong_guard.js'],
    apply: (d) => sub1(path.join(d, 'index.html'),
      "          cal:br.calType,y:br.y,m:br.m,d:br.d,leap:!!br.leap,\n",
      ""),
  },
  {
    id: 'MH1', axis: '★I-62 — 임시 사본 정리 훅 제거',
    what: '`_tmp.js` 의 `process.on(\'exit\', cleanup)` 을 없앤다 — 게이트가 돌 때마다 사본이 쌓여 디스크가 찬다',
    expect: ['H-3', 'H-4', 'H-7'], evals: [], gateScope: 'eval', mutateGate: true,
    applyGate: (g) => sub1(path.join(g, 'eval', '_tmp.js'),
      "  process.on('exit', cleanup);",
      "  if (false) process.on('exit', cleanup);"),
  },
  {
    id: 'MT3', axis: '★신설 게이트 자기 약화',
    what: 'eval_tojeong_guard.js 의 T-1 을 무조건 통과로 바꾼다 (평탄화 관측 무력화)',
    expect: ['SELF 외부 pin'], evals: [], gateScope: 'eval', mutateGate: true,
    applyGate: (g) => sub1(path.join(g, 'eval', 'eval_tojeong_guard.js'),
      "    const miss = need.filter((k) => flat.indexOf(k) === -1);",
      "    const miss = [];"),
  },
];

// ══════════════════════════════════════════════════════════════════════════
// ★v7.74 P 군 — 「반입 블록 폭발반경」 게이트(eval_port_isolation.js)의 유효성 증명
// ══════════════════════════════════════════════════════════════════════════
//   E-8 수리는 ⑴ 경계 2쌍 ⑵ `CW_PILLAR_RANGE_MSG` 의 typeof 가드 **둘 다**라야 효과가 있다.
//   어느 한쪽만 되돌리면 정상 경로에서는 **아무 증상도 없고**(V4 == V0), 사고가 났을 때만
//   폭발반경이 원상 복귀한다. 그러므로 각각을 되돌리는 뮤턴트를 둔다(결정 96).
const P_MUTANTS = [
  {
    id: 'MP1', axis: '★E-8 — typeof 가드 제거 (B3 §5-2 의 V2 로 회귀)',
    what: '`CW_PILLAR_RANGE_MSG` 를 v7.73 형상(무가드 최상위 CW_ENGINE 참조)으로 되돌린다 — 분리는 남지만 폭발반경은 원상복귀',
    expect: ['P-3', 'P-3b', 'P-3c'], evals: ['eval_port_isolation.js'],
    apply: (d) => sub1(path.join(d, 'index.html'),
      "const CW_PILLAR_RANGE_MSG=(typeof CW_ENGINE==='undefined')?'생년월일이 지원 범위를 벗어났습니다.'\n  :'생년월일이 지원 범위('+CW_ENGINE.RANGE.minY+'~'+CW_ENGINE.RANGE.maxY+'년)를 벗어났습니다.';",
      "const CW_PILLAR_RANGE_MSG='생년월일이 지원 범위('+CW_ENGINE.RANGE.minY+'~'+CW_ENGINE.RANGE.maxY+'년)를 벗어났습니다.';"),
  },
  {
    id: 'MP2', axis: '★E-8 — 스크립트 경계 재병합',
    what: '반입 블록의 <script> 경계를 걷어내 앱 코드와 같은 파싱 단위로 되돌린다 (분리 이전 형상)',
    expect: ['P-1', 'P-3', 'P-3b'], evals: ['eval_port_isolation.js'],
    apply: (d) => {
      const p = path.join(d, 'index.html');
      const L = rd(p).split('\n');
      const s = L.findIndex((l) => l.startsWith("const HS=['갑'"));
      const e = L.findIndex((l) => l.startsWith('function calcElementDistribution'));
      if (s < 0 || e < 0) throw new Error('경계 탐색 앵커 부재');
      const out = [];
      let removed = 0;
      for (let i = 0; i < L.length; i++) {
        if (i > s && i < e && /^\s*(<\/script>|<script>)\s*$/.test(L[i])) { removed++; continue; }
        out.push(L[i]);
      }
      if (removed !== 4) throw new Error('경계 줄 ' + removed + '건 (4여야 한다)');
      wr(p, out.join('\n'));
    },
  },
  {
    id: 'MP3', axis: '★신설 게이트 자기 약화',
    what: 'eval_port_isolation.js 의 P-3 을 무조건 통과로 바꾼다 (폭발반경 검사 무력화)',
    expect: ['SELF 외부 pin'], evals: [], gateScope: 'eval', mutateGate: true,
    applyGate: (g) => sub1(path.join(g, 'eval', 'eval_port_isolation.js'),
      "  const ok = /^PAYLOAD:/.test(dream) && face !== 'UNDEF' && face !== 'NOCALL';",
      "  const ok = true;"),
  },
];

// ══════════════════════════════════════════════════════════════════════════
// ★v7.74 F 군 — 「음력 UI 조작 → 판독」 게이트(eval_lunar_ui_dom.js)의 유효성 증명
// ══════════════════════════════════════════════════════════════════════════
//   v7.73 은 게이트 45종·뮤테이션 26종 전건 통과 후 배포됐고, 그 직후 이 축에서 사고가 났다.
//   ⟹ 신설 게이트에 대해 **v7.73 의 결함을 한 줄로 되살리는** 뮤턴트를 둔다.
//     각 뮤턴트는 v7.73 소스에 실재했던 코드로의 **정확한 회귀**다(가상의 약화가 아니다).
const F_MUTANTS = [
  {
    id: 'MF1', axis: '★사고 본체 (윤달 의도 파괴)',
    what: 'cwSyncLunarDays 가 윤달 없는 년·월에서 체크박스를 다시 `disabled=true; checked=false` 로 되돌린다 (v7.73 원본)',
    expect: ['U-1', 'U-2', 'U-6', 'U-6b', 'U-8'], evals: ['eval_lunar_ui_dom.js'],
    apply: (d) => sub1(path.join(d, 'index.html'),
      "  if(lp)lp.disabled=false;\n  const wantLeap=!!(lp&&lp.checked);",
      "  if(lp){if(!(y&&m&&lunarLeapMonth(y)===m)){lp.checked=false;lp.disabled=true;}else{lp.disabled=false;}}\n  const wantLeap=!!(lp&&lp.checked&&!lp.disabled);"),
  },
  {
    id: 'MF2', axis: '★조용한 평달 대체',
    what: '판독에서 `LEAP_NA` 거부를 없앤다 — 윤달 없는 달에 윤달을 체크해도 조용히 평달로 계산한다',
    expect: ['U-4'], evals: ['eval_lunar_ui_dom.js'],
    apply: (d) => sub1(path.join(d, 'index.html'),
      "    if(wantLeap&&lunarLeapMonth(y)!==m)return{ok:false,err:'LEAP_NA',calType:calType,y:y,m:m,d:d};",
      "    if(wantLeap&&lunarLeapMonth(y)!==m)return{ok:true,calType:'lunar',y:y,m:m,d:d,leap:false};"),
  },
  {
    id: 'MF3', axis: '★「고르지 않음」 표현 소멸',
    what: '음력 select 의 초기값을 1990/1/1 로 되돌린다 — 미선택 제출이 조용히 1990-01-01 이 된다 (v7.73 원본)',
    expect: ['U-3', 'U-11'], evals: ['eval_lunar_ui_dom.js'],
    apply: (d) => sub1(path.join(d, 'index.html'),
      "  _cwFillSel(ys,CW_LUNAR_MAX_Y,CW_LUNAR_MIN_Y,'년');\n  _cwFillSel(ms,1,12,'월');\n  _cwFillSel(ds,1,30,'일');",
      "  _cwFillSel(ys,CW_LUNAR_MAX_Y,CW_LUNAR_MIN_Y,'년',1990);\n  _cwFillSel(ms,1,12,'월',1);\n  _cwFillSel(ds,1,30,'일',1);"),
  },
  {
    id: 'MF4', axis: '★조용한 값 대체 폴백',
    what: '`_cwFillSel` 의 「비운다」를 v7.73 의 「마지막 옵션으로 몰래 채운다」 폴백으로 되돌린다',
    expect: ['U-5', 'U-6b', 'U-11'], evals: ['eval_lunar_ui_dom.js'],
    apply: (d) => sub1(path.join(d, 'index.html'),
      "  sel.value='';          // ★조용히 다른 값으로 바꾸지 않는다\n  return !had;",
      "  sel.value='';\n  if(sel.value===''&&sel.options.length)sel.selectedIndex=sel.options.length-1;\n  return !had;"),
  },
  {
    id: 'MF5', axis: '★조용한 일자 클램프',
    what: '판독에서 `DAY_NA` 거부를 없앤다 — 그 달에 없는 일자가 조용히 통과한다',
    expect: ['U-5'], evals: ['eval_lunar_ui_dom.js'],
    apply: (d) => sub1(path.join(d, 'index.html'),
      "    if(!(d>=1&&d<=_dmax))return{ok:false,err:'DAY_NA',calType:calType,y:y,m:m,d:d,dmax:_dmax};",
      "    if(!(d>=1&&d<=_dmax))return{ok:true,calType:'lunar',y:y,m:m,d:Math.min(d,_dmax),leap:wantLeap};"),
  },
  {
    id: 'MF8', axis: '★일(日) 의도 파괴',
    what: '일 목록 재구성이 사용자 의도(`ds.dataset.cwWant`)를 잊게 한다 — 중간 단계에서 사라진 일자가 영영 안 돌아온다',
    expect: ['U-5c'], evals: ['eval_lunar_ui_dom.js'],
    apply: (d) => sub1(path.join(d, 'index.html'),
      "  const want=parseInt(ds.value,10)||parseInt(ds.dataset.cwWant||'',10)||null;",
      "  const want=parseInt(ds.value,10)||null;"),
  },
  {
    id: 'MF6', axis: '★양력→음력 이관 조용한 대체',
    what: '전환 시 지원 범위 밖 음력 연도를 **경계로 당겨** 옮긴다 — 사용자 입력이 조용히 다른 날짜가 된다',
    expect: ['U-9b'], evals: ['eval_lunar_ui_dom.js'],
    apply: (d) => sub1(path.join(d, 'index.html'),
      "      if(lun&&lun.year>=CW_LUNAR_MIN_Y&&lun.year<=CW_LUNAR_MAX_Y){\n        ys.value=String(lun.year);",
      "      if(lun){\n        ys.value=String(Math.min(Math.max(lun.year,CW_LUNAR_MIN_Y),CW_LUNAR_MAX_Y));"),
  },
];

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
    // ★v7.75 — 앵커를 **한 줄 위까지** 넓혔다. v7.75 에서 `tojeongBirthInput` 이
    //   같은 `if (!any) return { missing: true };` 줄을 갖게 되면서 앵커가 2건이 됐고,
    //   `sub1` 이 예외를 던져 이 뮤턴트가 **조용히 무력화**됐다(실측 — 생존으로 보고됨).
    //   ⟹ 뮤턴트 앵커는 「그 함수에서만 나오는 형태」여야 한다.
    apply: (d) => sub1(path.join(d, 'api', '_engine', 'ctxguard.js'),
      "  const any = has.call(ctx, kY) || has.call(ctx, kM) || has.call(ctx, kD);\n  if (!any) return { missing: true };",
      "  const any = has.call(ctx, kY) || has.call(ctx, kM) || has.call(ctx, kD);\n  if (true) return { missing: true };"),
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
  // ★v7.74 — 신설 게이트(eval_lunar_ui_dom.js) 자신을 약화시키는 뮤턴트.
  //   그 게이트의 sha256 이 외부 pin 표에 있으므로 러너가 적발해야 한다.
  {
    id: 'MF7', axis: '★신설 게이트 자기 약화',
    what: 'eval_lunar_ui_dom.js 의 U-1 을 무조건 통과로 바꾼다 (24 순열 검사 무력화)',
    expect: ['SELF 외부 pin'], evals: [], gateScope: 'eval', mutateGate: true,
    applyGate: (g) => sub1(path.join(g, 'eval', 'eval_lunar_ui_dom.js'),
      "  return { ok: bad.length === 0, detail: bad.length ? '★' + bad.length + '/72 불일치: '",
      "  return { ok: true, detail: 'MUTANT' } || { ok: bad.length === 0, detail: bad.length ? '★' + bad.length + '/72 불일치: '"),
  },
  ...F_MUTANTS,
  ...P_MUTANTS,
  ...T_MUTANTS,
];

// ══════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════
// ★v7.75 — 샤딩(`CW_MUT_SHARD=k/n`) · 지정 실행(`CW_MUT_ONLY=MT1,MT2`)
// ══════════════════════════════════════════════════════════════════════════
//   【왜】 뮤턴트가 40종을 넘으면서 전체 실행이 샌드박스의 단일 명령 시간 상한을
//     넘겼다(백그라운드 프로세스는 세션 간 유지되지 않는다 — 실측).
//   【★위약 방지 — 이 기능은 「불편한 뮤턴트를 건너뛰는」 문으로 쓰일 수 있다】
//     · 필터가 걸린 회차는 **머리와 꼬리에 배너**를 찍고 종료 코드와 무관하게
//       `PARTIAL` 을 선언한다. 「부분 실행이 전체 통과로 읽히는」 경로를 막는다.
//     · `[mutation] total=` 줄은 **필터가 없을 때만** 출력한다. 부분 회차의 수치가
//       pin 표(`checks_min`)나 인수인계에 그대로 실리지 못하게 한다.
//     · 필터 문자열과 제외 건수를 항상 함께 찍는다.
const MUT_ONLY = (process.env.CW_MUT_ONLY || '').split(',').map((s) => s.trim()).filter(Boolean);
const MUT_SHARD = (() => {
  const m = String(process.env.CW_MUT_SHARD || '').match(/^(\d+)\s*\/\s*(\d+)$/);
  return m ? { k: parseInt(m[1], 10), n: parseInt(m[2], 10) } : null;
})();
const MUT_FILTERED = MUT_ONLY.length > 0 || !!MUT_SHARD;
function mutSelected(id, idx) {
  if (MUT_ONLY.length) return MUT_ONLY.indexOf(id) !== -1;
  if (MUT_SHARD) return (idx % MUT_SHARD.n) === (MUT_SHARD.k - 1);
  return true;
}

// ★I-62 — 뮤테이션 회차의 **자식 프로세스** 잔여를 쓸어 담는다.
//   자기 사본은 `CWTMP` 가 지우지만, 자식(게이트)은 자기 프로세스에서 지운다 —
//   그런데 `MH1` 은 **정리 훅을 일부러 제거한** 사본으로 게이트를 돌리므로 그 회차의
//   자식들은 정리하지 못한다(뮤턴트의 정의상 당연하다).
//   ⟹ 회차 **시작 시점 스냅샷**을 떠 두고, 그 뒤에 새로 생긴 `cw_*` 만 지운다.
//     ★기존 디렉터리는 절대 건드리지 않는다 — 다른 세션/동시 실행을 죽이지 않기 위해서다.
const TMP_ROOT = os.tmpdir();
const TMP_BEFORE = (() => {
  try { return new Set(fs.readdirSync(TMP_ROOT).filter((f) => /^cw_/.test(f))); }
  catch (e) { return null; }
})();
function sweepChildTmp() {
  if (!TMP_BEFORE) return 0;
  let n = 0;
  let now = [];
  try { now = fs.readdirSync(TMP_ROOT).filter((f) => /^cw_/.test(f)); } catch (e) { return 0; }
  for (const f of now) {
    if (TMP_BEFORE.has(f)) continue;
    try { fs.rmSync(path.join(TMP_ROOT, f), { recursive: true, force: true }); n++; } catch (e) { /* 무시 */ }
  }
  return n;
}
process.on('exit', () => { const n = sweepChildTmp(); if (n) console.log('[mutation] 자식 임시 사본 ' + n + '건 정리(I-62)'); });

(function main() {
  const rows = [];
  let survived = 0;
  if (MUT_FILTERED) {
    console.log('════════════════════════════════════════════════════════════════');
    console.log('★★ PARTIAL RUN — 필터가 걸려 있습니다. 이 회차는 전체 실행이 아닙니다.');
    console.log('   CW_MUT_ONLY=' + (MUT_ONLY.join(',') || '(없음)') + ' · CW_MUT_SHARD=' + (MUT_SHARD ? MUT_SHARD.k + '/' + MUT_SHARD.n : '(없음)'));
    console.log('   ★이 회차의 수치를 인수인계·pin 표에 그대로 쓰지 마십시오.');
    console.log('════════════════════════════════════════════════════════════════');
  }

  // ── M0 긍정 대조 ─────────────────────────────────────────────────────────
  const base = mkFront();
  const b0 = NEW_EVALS.map((f) => ({ f, r: runEval(GATE, base, f) }));
  const b0ok = b0.every((x) => x.r.status === 0);
  console.log('M0  [긍정 대조] 무변경 사본 — ' + b0.map((x) => x.f.replace('eval_', '').replace('.js', '') + '=' +
    (x.r.status === 0 ? 'PASS' : 'FAIL(' + x.r.failed.join(',') + ')')).join(' · '));
  if (!b0ok) console.log('    ★★하네스 자체가 위약이다 — 무변경 사본이 통과하지 않는다. 이하 결과는 무의미하다.');
  rows.push({ id: 'M0', axis: '긍정 대조', what: '무변경 사본', killed: b0ok, by: b0ok ? '전건 통과(정상)' : '★하네스 이상' });

  let skipped = 0;
  for (let mi = 0; mi < MUTANTS.length; mi++) {
    const m = MUTANTS[mi];
    if (!mutSelected(m.id, mi)) { skipped++; continue; }
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
    // ★v7.75 — 「적용 실패」와 「적발 실패(생존)」를 **절대 같은 라벨로 찍지 않는다**.
    //   실측 2건(MT3 들여쓰기 · M12 앵커 중복)에서 앵커가 어긋나 뮤턴트가 아예 적용되지
    //   않았는데 `★SURVIVED` 로 보고돼, 「게이트가 못 잡았다」와 구별되지 않았다.
    //   ★적용 실패는 **하네스 고장**이며 게이트 평가가 아니다 — 라벨을 분리한다.
    if (err) { by = '★뮤테이션 적용 실패(하네스 고장 — 게이트 평가 아님): ' + err; killed = false; }
    if (!killed) survived++;
    console.log((killed ? 'KILL' : (err ? '★APPLY-FAIL' : '★SURVIVED')) + ' ' + m.id + '  [' + m.axis + '] ' + m.what);
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
    const d = CWTMP.mk('cw_mut_git_');
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
  for (let gi = 0; gi < MG.length; gi++) {
    const m = MG[gi];
    if (!mutSelected(m.id, MUTANTS.length + gi)) { skipped++; continue; }
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
  const ran = N - skipped;
  if (MUT_FILTERED) {
    // ★부분 회차 — `total=` 을 찍지 않는다. 찍으면 pin 계측기(declaredChecks)와
    //   인수인계가 부분 수치를 전체로 오독한다.
    console.log('\n[mutation] ★PARTIAL — 전체 ' + N + '종 중 **' + ran + '종만** 실행 · 제외 ' + skipped + '종 · 실행분 생존 ' + survived);
    console.log('[mutation] ★이 회차는 전체 실행이 아닙니다. 커밋·인수인계 전에 필터 없이 전건을 돌리십시오.');
  } else {
    console.log('\n[mutation] 뮤턴트 ' + N + '종(자산 커밋 경로 ' + MG.length + '종 포함) · 적발/정상 ' + (N - survived) + ' · ★생존 ' + survived);
    console.log('[mutation] total=' + (N + 1) + ' pass=' + (N + 1 - survived - (b0ok ? 0 : 1)) + ' fail=' + (survived + (b0ok ? 0 : 1)));
  }
  process.exit(survived === 0 && b0ok ? 0 : 1);
})();
