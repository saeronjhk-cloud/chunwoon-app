// 천운 — ★엔진 결속 게이트 (v7.70 신설 · 2026-08-01 · 결정 77 이행 1단계)
//
// 【무엇을 못박는가】
//   결정적 사실 3축(대운 간지·십성·지지관계)이 **서버 엔진에서 나오고, LLM 이 바꿀 수 없다**는 성질.
//
// 【왜 필요한가 — 실측된 문제】
//   v7.69 §3: 이 3축을 서버도 클라이언트도 계산하지 않았다. 브라우저 전역 calc* 10개에 없고
//   api/fortune.js 에도 없었다. ₩29,900 프리미엄의 daewoon[8]·habChung[] 이 **전부 LLM 생성**이며
//   검증 경로가 없었다. 대운 간지는 순역 규칙 + 60갑자 산술이라 틀려도 아무도 모른다.
//
// 【이 게이트가 authority 승격의 근거다】
//   authority.js 에서 sipsin·daewoon_direction·branch_relation 을 VERIFIED 로 올렸다.
//   그 승격이 정당한 이유는 **여기서 매 실행마다 전수 재현되기 때문**이다.
//   전수가 깨지면 승격 근거가 사라지고 이 게이트가 FAIL 한다 — 근거와 승격이 결속돼 있다.
//
// 【fail-closed】 엔진 모듈 부재·판독 실패·authority 미승격은 전부 **FAIL** 이다(SKIP 아님).
//   런타임(api/fortune.js)은 모듈이 없으면 조용히 LLM 경로로 돌아가는데, 그것이 눈치채이지
//   않으면 고정 원칙 5가 조용히 무너진다. **런타임은 안전하게, 게이트는 엄격하게.**
'use strict';

const fs = require('fs');
const path = require('path');

// ── front_root 해석 (다른 eval 과 동일 규약) ────────────────────────────────
function resolveFrontRoot() {
  const env = process.env.CHUNWOON_FRONT_ROOT;
  if (env && fs.existsSync(path.join(env, 'api', 'fortune.js'))) return env;
  let dir = __dirname;
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, 'api', 'fortune.js')) && fs.existsSync(path.join(dir, 'index.html'))) return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}
const FRONT_ROOT = (() => { try { return resolveFrontRoot(); } catch (e) { return null; } })();
const ENG_DIR = FRONT_ROOT ? path.join(FRONT_ROOT, 'api', '_engine') : null;
// 패키지 정본(단일 출처 대조용) — 이 파일 기준 ../engine
const PKG_ENG_DIR = path.resolve(__dirname, '..', 'engine');

const OKCTX_EARLY = { yearPillar: '戊辰', monthPillar: '丙辰', dayPillar: '庚申', hourPillar: '壬午', gender: 'male' };
const results = [];
function check(id, fn) {
  let detail = null, ok = false;
  try { detail = fn(); ok = (detail === true || detail === null || detail === undefined); if (typeof detail === 'string') ok = false; }
  catch (e) { detail = 'EX ' + ((e && e.message) || String(e)); ok = false; }
  results.push({ id: id, pass: ok, detail: typeof detail === 'string' ? detail : '' });
}

// ── 지연 로드 ────────────────────────────────────────────────────────────────
let BIND = null, AUTH = null, MY = null, MANSE = null, LOAD_ERR = null;
function load() {
  if (BIND || LOAD_ERR) return;
  if (!ENG_DIR) { LOAD_ERR = 'front_root 미해석 — CHUNWOON_FRONT_ROOT 를 지정하십시오'; return; }
  try {
    BIND = require(path.join(ENG_DIR, 'bind.js'));
    AUTH = require(path.join(ENG_DIR, 'authority.js'));
    MY = require(path.join(ENG_DIR, 'myeongli.js'));
    MANSE = require(path.join(ENG_DIR, 'manse.js'));
  } catch (e) { LOAD_ERR = '엔진 모듈 적재 실패: ' + ((e && e.message) || String(e)); }
}

// ══ SELF 축 — 게이트 성립 전제 ═══════════════════════════════════════════════
check('SELF-0 엔진 모듈 5종 적재 (실패 시 이하 전 검사 FAIL)', () => {
  load();
  if (LOAD_ERR) return LOAD_ERR;
  const need = ['authority.js', 'bind.js', 'daewoon.js', 'manse.js', 'myeongli.js'];
  const have = fs.readdirSync(ENG_DIR).filter((n) => /\.js$/.test(n)).sort();
  const miss = need.filter((n) => have.indexOf(n) === -1);
  if (miss.length) return '누락 ' + miss.join(',') + ' (있는 것: ' + have.join(',') + ')';
  for (const fn of ['computeFacts', 'factsBlock', 'applyEngineFacts', 'toPillars', 'splitPillar'])
    if (typeof BIND[fn] !== 'function') return 'bind.' + fn + ' 부재';
  return true;
});
const blocked = () => (LOAD_ERR || !BIND);

check('SELF-1 ★단일 출처 — api/_engine 이 패키지 engine/ 과 바이트 동일 (사본 표류 차단)', () => {
  if (blocked()) return '전제 미성립(SELF-0)';
  const crypto = require('crypto');
  const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  const bad = [];
  for (const nm of ['authority.js', 'daewoon.js', 'manse.js', 'myeongli.js']) {
    const a = path.join(ENG_DIR, nm), b = path.join(PKG_ENG_DIR, nm);
    if (!fs.existsSync(b)) { bad.push(nm + ': 패키지 정본 부재'); continue; }
    if (sha(a) !== sha(b)) bad.push(nm + ': 바이트 불일치(사본이 표류했다 — 한쪽만 고쳤는가?)');
  }
  // bind.js 는 어댑터라 api/ 전용이다(패키지에 없어야 정상).
  if (fs.existsSync(path.join(PKG_ENG_DIR, 'bind.js'))) bad.push('bind.js 가 패키지에도 있다 — 어댑터는 api/ 전용이어야 한다');
  return bad.length ? bad.join(' / ') : true;
});

check('SELF-2 ★_gate_pins.json 자기검사 — 직접 실행 경로에서도 자기 약화가 적발된다', () => {
  // ★v7.70-b 신설 (적대적 검증 관통 #7) — 종전에는 이 파일이 pin 을 **주석으로만** 언급하고
  //   자기검사를 하지 않았다. `node tools/run_gate.js` 로 돌리면 러너가 sha256 을 대조하지만,
  //   **직접 실행**(node eval/eval_engine_binding.js)은 무방비였다. 전수 하한(V2 양성 8 ·
  //   V3 1,200 · V4 55,000)과 A2 목록을 전부 낮춰도 0.1초에 17/17 이 나왔다.
  //   ⟹ eval_response_scrub.js·eval_token_roundtrip.js 와 같은 규약으로 자기 sha 를 대조한다.
  const crypto = require('crypto');
  const pinPath = path.join(__dirname, '_gate_pins.json');
  if (!fs.existsSync(pinPath)) return '★_gate_pins.json 부재 — 자기 약화를 검출할 수 없다(판정 불가)';
  let pins = null;
  try { pins = JSON.parse(fs.readFileSync(pinPath, 'utf8')); } catch (e) { return 'pin 판독 실패: ' + e.message; }
  const spec = pins && pins.evals && pins.evals['eval_engine_binding.js'];
  if (!spec || !spec.sha256) return '★pin 표에 자기 항목이 없다 — 등재되지 않은 게이트는 침식이 안 잡힌다';
  const self = crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex');
  if (self !== spec.sha256)
    return '★자기 소스 sha256 불일치 (실측 ' + self.slice(0, 16) + ' != pin ' + String(spec.sha256).slice(0, 16) +
      ') — 정당한 강화라면 node tools/regen_gate_pins.js --expand --measure 로 갱신하라';
  if (typeof spec.checks_min === 'number' && spec.checks_min < 17)
    return '★checks_min ' + spec.checks_min + ' < 17 — 검사 수 하한이 낮춰졌다';
  return true;
});

check('SELF-3 ★bind.js 봉인 — 산출 키·라벨이 코드 상수로 닫혀 있고 승격 목록과 일치한다', () => {
  if (blocked()) return '전제 미성립(SELF-0)';
  // ★v7.70-b 신설 (적대적 검증 관통 #1 — 가장 위험했다)
  //   【실측된 문제】 SELF-1 은 authority·daewoon·manse·myeongli 4파일만 해시 고정하고
  //     **bind.js 를 명시적으로 제외**했다("어댑터는 api/ 전용"). 그런데 ⑴무엇을 산출하고
  //     ⑵무엇을 「확정값」으로 프롬프트에 넣고 ⑶무엇을 응답에 덮어쓸지를 전부 정하는 것이
  //     bind.js 다. authority.js 를 한 글자도 안 고치고 bind.js 만으로 격국·용신·대운수
  //     (전부 surface_policy=DENY)를 주입해도 게이트가 17/17 이었다.
  //   【수리】 산출 키·프롬프트 라벨을 bind.js 의 코드 상수로 닫고, 그 상수가
  //     **authority 승격 목록과 정확히 일치**하는지 여기서 대조한다.
  const bad = [];
  if (!Array.isArray(BIND.FACT_KEYS) || !Array.isArray(BIND.FACT_LABELS) || !BIND.FACT_AUTHORITY)
    return '★bind.js 가 FACT_KEYS/FACT_LABELS/FACT_AUTHORITY 를 노출하지 않는다 — 봉인 불가';
  const PROMOTED = ['sipsin', 'daewoon_direction', 'branch_relation'];
  // ① 산출 키 ↔ authority 축이 1:1 이고, 그 축이 전부 승격 목록 안에 있다
  const mapped = BIND.FACT_KEYS.map((k) => BIND.FACT_AUTHORITY[k]);
  if (mapped.some((a) => !a)) bad.push('FACT_AUTHORITY 매핑 결손');
  for (const a of mapped) if (PROMOTED.indexOf(a) === -1) bad.push('★' + a + ' 는 승격 목록 밖인데 산출 키에 있다');
  if (BIND.FACT_KEYS.length !== PROMOTED.length) bad.push('산출 키 ' + BIND.FACT_KEYS.length + ' != 승격 ' + PROMOTED.length);
  if (BIND.FACT_LABELS.length !== PROMOTED.length) bad.push('프롬프트 라벨 ' + BIND.FACT_LABELS.length + ' != 승격 ' + PROMOTED.length);
  // ② ★실제 산출물에 목록 밖 사실 키가 없다
  const f = BIND.computeFacts(OKCTX_EARLY);
  const META = ['engine_version', 'pillars', 'authority', 'mode'];
  const extra = Object.keys(f || {}).filter((k) => BIND.FACT_KEYS.indexOf(k) === -1 && META.indexOf(k) === -1);
  if (extra.length) bad.push('★산출물에 목록 밖 키: ' + extra.join(','));
  // ③ ★프롬프트 블록의 모든 항목이 라벨 화이트리스트 안이다
  const block = BIND.factsBlock(f);
  if (!block) bad.push('factsBlock 이 비었다');
  else {
    for (const line of block.split('\n').slice(1)) {
      if (!BIND.FACT_LABELS.some((lab) => line.indexOf('\u00b7 ' + lab) === 0))
        bad.push('★프롬프트 블록에 미등재 라벨: ' + line.slice(0, 40));
    }
  }
  // ④ ★봉인축 이름이 블록에 등장하지 않는다 (격국·용신·대운수)
  for (const w of ['격국', '용신', '기신', '조후', '상신', '대운수'])
    if (block && block.indexOf(w) !== -1) bad.push('★봉인축 「' + w + '」 이 프롬프트 확정값에 들어갔다');
  return bad.length ? bad.join(' / ') : true;
});

check('SELF-4 ★applyEngineFacts 에 조기 return 백도어가 없다', () => {
  if (blocked()) return '전제 미성립(SELF-0)';
  // ★v7.70-b 신설 (적대적 검증 관통 #2) — 선두에 조건부 return 을 하나 넣으면 덮어쓰기
  //   전체가 꺼졌고, 그 조건을 **LLM 이 채우는 필드**(citation_ref.source_id — premium_1
  //   스키마가 LLM 에게 직접 요구한다)로 걸면 LLM 한 줄로 자기 감시를 끌 수 있었다.
  //   ⟹ 행위로 검사한다: LLM 이 무엇을 넣든 덮어쓰기가 작동해야 한다.
  const f = BIND.computeFacts(OKCTX_EARLY);
  const probes = [
    { label: 'citation_ref 백도어', extra: { citation_ref: { source_id: 'SRC_JCS_A' } } },
    { label: 'monthlyFortune 존재', extra: { monthlyFortune: [{ month: 1 }] } },
    { label: 'raw 센티넬', extra: { raw: '[PARSE_FAILED]' } },
    { label: '빈 객체 확장', extra: { __proto__: { skip: true } } },
    { label: 'engine_off 플래그', extra: { engine_off: true, skipEngine: 1, _bypass: 'yes' } }
  ];
  const bad = [];
  for (const pr of probes) {
    const parsed = Object.assign({
      daewoon: f.daewoon.list.map((e, i) => ({ age: 'X', ganji: '甲子', fortune: 'z' })),
      sipsungDetail: [{ name: '정인', position: '연', meaning: 'm' }],
      habChung: [{ type: '沖', between: '월지-시지', effect: '날조' }]
    }, pr.extra);
    BIND.applyEngineFacts('saju_premium_2', parsed, f);
    if (parsed.daewoon[1].ganji !== f.daewoon.list[1].ganji) bad.push(pr.label + ': 대운 덮어쓰기가 꺼졌다');
    if (parsed.sipsungDetail[0].name !== f.sipsungDetail[0].name) bad.push(pr.label + ': 십성 덮어쓰기가 꺼졌다');
    if (parsed.habChung.some((x) => x.effect === '날조')) bad.push(pr.label + ': 날조 합충이 남았다');
    if (parsed.daewoon[0].age !== BIND.AGE_BUCKETS[0]) bad.push(pr.label + ': age 가 엔진 버킷으로 고정되지 않았다');
  }
  return bad.length ? bad.join(' / ') : true;
});

// ══ A축 — authority 승격 상태 ════════════════════════════════════════════════
check('A1 ★승격 3축이 노출 가능 (sipsin · daewoon_direction · branch_relation)', () => {
  if (blocked()) return '전제 미성립(SELF-0)';
  const bad = [];
  for (const k of ['sipsin', 'daewoon_direction', 'branch_relation'])
    if (!AUTH.userSurfaceable(k)) bad.push(k + '=' + AUTH.canSurface(k).reason);
  return bad.length ? '미승격 → ' + bad.join(',') + ' (승격을 되돌렸다면 이 게이트도 함께 내려야 한다)' : true;
});
check('A2 ★미승격 축은 여전히 봉인 (근거 없는 승격 확산 차단)', () => {
  if (blocked()) return '전제 미성립(SELF-0)';
  // sinsal: COMPILED_UNVERIFIED — 편집표라 독립 검증기를 만들 수 없다.
  // daewoon_start_age: APPROX_FIXED_TERM — 절기 근사.
  // yongsin/gyeok/sangsin/johu: GT 전문가 라벨 12/132(9.1%) · 용신 33.7% null · 상신 EXPERT_PENDING.
  const mustDeny = ['sinsal', 'daewoon_start_age', 'yongsin', 'gisin', 'gyeok', 'sangsin', 'johu'];
  const leaked = mustDeny.filter((k) => AUTH.userSurfaceable(k));
  return leaked.length ? '★근거 없이 승격됨 → ' + leaked.join(',') : true;
});

// ══ V축 — 전수 검증 (승격의 근거를 매번 재현한다) ═════════════════════════════
const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const EL = ['木', '木', '火', '火', '土', '土', '金', '金', '水', '水'];
const YIN = [false, true, false, true, false, true, false, true, false, true];
const ELS = ['木', '火', '土', '金', '水'];
const gen = (a, b) => ELS[(ELS.indexOf(a) + 1) % 5] === b;
const ke = (a, b) => ELS[(ELS.indexOf(a) + 2) % 5] === b;
const BR = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

check('V1 ★십성 10×10=100 전수 — 오행 생극 + 음양으로 독립 유도한 기대값과 일치', () => {
  if (blocked()) return '전제 미성립(SELF-0)';
  const want = (d, t) => {
    const de = EL[d], te = EL[t], same = (YIN[d] === YIN[t]);
    if (de === te) return same ? '비견' : '겁재';
    if (gen(de, te)) return same ? '식신' : '상관';
    if (ke(de, te)) return same ? '편재' : '정재';
    if (ke(te, de)) return same ? '편관' : '정관';
    if (gen(te, de)) return same ? '편인' : '정인';
    throw new Error('관계 미분류');
  };
  const bad = [];
  for (let d = 0; d < 10; d++) for (let t = 0; t < 10; t++) {
    const got = MY.sipsin(STEMS[d], STEMS[t]);
    if (!got || got.name !== want(d, t)) bad.push(STEMS[d] + '→' + STEMS[t] + ' ' + (got && got.name) + '≠' + want(d, t));
  }
  return bad.length ? '불일치 ' + bad.length + '/100 → ' + bad.slice(0, 4).join(' / ') : true;
});

check('V2 ★지지관계 12×12=132 전수 — 전통표(六合·三合·沖·六害·刑) 독립 정의와 일치', () => {
  if (blocked()) return '전제 미성립(SELF-0)';
  const YUKHAP = [['子', '丑'], ['寅', '亥'], ['卯', '戌'], ['辰', '酉'], ['巳', '申'], ['午', '未']];
  const SAMHAP = [['申', '子', '辰'], ['亥', '卯', '未'], ['寅', '午', '戌'], ['巳', '酉', '丑']];
  const CHUNG = [['子', '午'], ['丑', '未'], ['寅', '申'], ['卯', '酉'], ['辰', '戌'], ['巳', '亥']];
  const HAE = [['子', '未'], ['丑', '午'], ['寅', '巳'], ['卯', '辰'], ['申', '亥'], ['酉', '戌']];
  const HYEONG = [['寅', '巳', '申'], ['丑', '戌', '未'], ['子', '卯']];   // 자형은 i!==j 라 제외
  const has = (L, a, b) => L.some((p) => (p.length === 2
    ? ((p[0] === a && p[1] === b) || (p[0] === b && p[1] === a))
    : (p.indexOf(a) !== -1 && p.indexOf(b) !== -1 && a !== b)));
  const bad = [], cover = { '六合': 0, '三合': 0, '沖': 0, '六害': 0, '刑': 0 };
  let n = 0;
  for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) {
    if (i === j) continue;
    n++;
    const a = BR[i], b = BR[j];
    const w = [];
    if (has(YUKHAP, a, b)) w.push('六合');
    if (has(SAMHAP, a, b)) w.push('三合');
    if (has(CHUNG, a, b)) w.push('沖');
    if (has(HAE, a, b)) w.push('六害');
    if (has(HYEONG, a, b)) w.push('刑');
    for (const t of w) cover[t]++;
    const got = (MY.branchRelations(a, b) || []).slice().sort();
    if (JSON.stringify(got) !== JSON.stringify(w.slice().sort())) bad.push(a + '-' + b + ' ' + JSON.stringify(got) + '≠' + JSON.stringify(w));
  }
  // ★공허 통과 차단 — 양성 표본이 사라지면 「전건 일치」가 무의미해진다.
  const thin = Object.keys(cover).filter((k) => cover[k] < 8);
  if (thin.length) return '★양성 표본 부족: ' + thin.map((k) => k + '=' + cover[k]).join(',');
  return bad.length ? '불일치 ' + bad.length + '/' + n + ' → ' + bad.slice(0, 4).join(' / ') : true;
});

check('V3 ★대운 순역+간지 10년간×2성별×60월주=1,200 전수 — 60갑자 산술 독립 유도와 일치', () => {
  if (blocked()) return '전제 미성립(SELF-0)';
  const DW = require(path.join(ENG_DIR, 'daewoon.js'));
  const g60 = (i) => STEMS[((i % 10) + 10) % 10] + BR[((i % 12) + 12) % 12];
  const idx60 = (s, b) => { for (let i = 0; i < 60; i++) if (STEMS[i % 10] === s && BR[i % 12] === b) return i; return -1; };
  const bad = [], dir = { f: 0, b: 0 };
  let n = 0;
  for (let y = 0; y < 10; y++) for (const g of ['male', 'female']) for (let mi = 0; mi < 60; mi++) {
    n++;
    const mp = { s: STEMS[mi % 10], b: BR[mi % 12] };
    const wantFwd = ((y % 2 === 0) === (g === 'male'));         // 양년남·음년녀 순행
    const r = DW.computeDaewoon(STEMS[y], mp, g, { startAge: 5 });
    const gotFwd = /forward|순/.test(String(r && r.direction));
    if (gotFwd !== wantFwd) { bad.push('年' + STEMS[y] + '/' + g + '/月' + mp.s + mp.b + ' 방향'); continue; }
    dir[wantFwd ? 'f' : 'b']++;
    const base = idx60(mp.s, mp.b), w = [];
    for (let k = 1; k <= 8; k++) w.push(g60(base + (wantFwd ? k : -k)));
    const got = (r.list || []).map((x) => x && x.ganji);
    if (JSON.stringify(got) !== JSON.stringify(w)) bad.push('年' + STEMS[y] + '/' + g + '/月' + mp.s + mp.b + ' 간지');
  }
  if (dir.f < 500 || dir.b < 500) return '★방향 표본 편중 순행=' + dir.f + ' 역행=' + dir.b;
  return bad.length ? '불일치 ' + bad.length + '/' + n + ' → ' + bad.slice(0, 4).join(' / ') : true;
});

check('V4 ★일진 만세력 1900-01-01~2050-12-31 연속성 + 앵커 3건', () => {
  if (blocked()) return '전제 미성립(SELF-0)';
  let prev = null, n = 0;
  const bad = [];
  for (let t = Date.UTC(1900, 0, 1); t <= Date.UTC(2050, 11, 31); t += 86400000) {
    const d = new Date(t);
    const r = MANSE.dayGanzi(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    n++;
    if (r.ganji !== STEMS[r.index % 10] + BR[r.index % 12]) { bad.push('내부 정합'); break; }
    if (prev !== null && r.index !== (prev + 1) % 60) { bad.push('연속성 ' + d.toISOString().slice(0, 10)); break; }
    prev = r.index;
  }
  for (const [y, m, dd, g] of [[1990, 1, 1, '丙寅'], [2000, 1, 1, '戊午'], [2026, 8, 1, '丁未']]) {
    const got = MANSE.dayGanzi(y, m, dd).ganji;
    if (got !== g) bad.push('앵커 ' + y + '-' + m + '-' + dd + ' ' + got + '≠' + g);
  }
  if (n < 55000) return '★검사일 ' + n + ' < 55,000 — 스윕이 축소됐다';
  return bad.length ? bad.join(' / ') : true;
});

// ══ B축 — 어댑터 정합 (fail-closed) ══════════════════════════════════════════
const OKCTX = { yearPillar: '戊辰', monthPillar: '丙辰', dayPillar: '庚申', hourPillar: '壬午', gender: 'male' };

check('B1 정상 입력에서 3축이 전부 나온다', () => {
  if (blocked()) return '전제 미성립(SELF-0)';
  const f = BIND.computeFacts(OKCTX);
  if (!f) return 'computeFacts=null';
  if (!f.sipsungDetail || f.sipsungDetail.length !== 4) return '십성 4건 아님';
  if (!f.daewoon || !f.daewoon.list || f.daewoon.list.length !== 8) return '대운 8건 아님';
  if (!Array.isArray(f.habChung)) return '합충 배열 아님';
  if (f.daewoon.direction !== '순행') return '방향 오판 ' + f.daewoon.direction;
  if (f.sipsungDetail.map((x) => x.name).join(',') !== '편인,편관,비견,식신') return '십성 오판 ' + f.sipsungDetail.map((x) => x.name).join(',');
  return true;
});

check('B2 ★fail-closed — 어긋난 입력에서 부분 산출을 하지 않는다', () => {
  if (blocked()) return '전제 미성립(SELF-0)';
  const bad = [];
  const nullCases = [
    ['연주 빈 문자열', Object.assign({}, OKCTX, { yearPillar: '' })],
    ['월주 빈 문자열', Object.assign({}, OKCTX, { monthPillar: '' })],
    ['일주 빈 문자열', Object.assign({}, OKCTX, { dayPillar: '' })],
    ['천간 자리에 지지', Object.assign({}, OKCTX, { dayPillar: '子申' })],
    ['3자', Object.assign({}, OKCTX, { monthPillar: '丙辰辰' })],
    // ★v7.71 — 「한글은 null 이어야 한다」를 **삭제**한다. 이 등재가 틀렸었다.
    //   index.html:1766 은 `HS[stem]+EB[branch]`(한글)로 보낸다. 즉 한글이 **실제 계약**인데
    //   게이트가 그 반대편을 정본으로 못박아, splitPillar 가 한자만 읽는 결함을
    //   21/21 로 통과시켰다 — v7.70 의 엔진 결속이 프로덕션에서 100% 죽어 있었다.
    //   ⟹ 정상 케이스는 B2b 로 옮기고, 여기에는 **진짜 무효 입력**만 남긴다.
    ['표기 혼용 갑子', Object.assign({}, OKCTX, { yearPillar: '갑子' })],
    ['표기 혼용 甲자', Object.assign({}, OKCTX, { yearPillar: '甲자' })],
    ['한글 비실재 갑축', Object.assign({}, OKCTX, { monthPillar: '갑축' })],
    // ★v7.70-b — 60갑자 비실재 조합(음양 불일치). 10x12=120 중 60개가 여기 해당한다.
    ['비실재 간지 甲丑', Object.assign({}, OKCTX, { monthPillar: '甲丑' })],
    ['비실재 간지 乙子', Object.assign({}, OKCTX, { yearPillar: '乙子' })],
    ['비실재 간지 庚亥', Object.assign({}, OKCTX, { dayPillar: '庚亥' })],
    ['null', null], ['배열', []], ['문자열', 'x']
  ];
  for (const [lab, c] of nullCases) if (BIND.computeFacts(c) !== null) bad.push(lab + ' → null 이어야 하는데 값이 나왔다');
  // ★v7.71 B2b — 프런트가 실제로 보내는 표기(한글)가 한자와 **동일 결과**를 내는지.
  //   이것이 「프런트 계약 ↔ 엔진 입력」 회귀 검사다. 이 검사가 없어서 v7.70 이 죽어 있었다.
  const KO = { gender: 'male', yearPillar: '무진', monthPillar: '병진', dayPillar: '경신', hourPillar: '임오' };
  const CH = { gender: 'male', yearPillar: '戊辰', monthPillar: '丙辰', dayPillar: '庚申', hourPillar: '壬午' };
  const fKo = BIND.computeFacts(KO), fCh = BIND.computeFacts(CH);
  if (!fKo) bad.push('★한글 표기에서 computeFacts 가 null — 프런트가 보내는 형식이다(index.html:1766)');
  else if (!fCh) bad.push('한자 표기에서 null');
  else if (JSON.stringify(fKo) !== JSON.stringify(fCh)) bad.push('★한글/한자 산출 불일치 — 정규화가 깨졌다');
  // 성별 없음: 대운만 null, 나머지는 유지되어야 한다(부분 실패의 국소화)
  const g = BIND.computeFacts(Object.assign({}, OKCTX, { gender: undefined }));
  if (!g) bad.push('성별 없음 → 전체 null (십성·합충은 성별과 무관하므로 유지되어야 한다)');
  else if (g.daewoon !== null) bad.push('성별 없음인데 대운이 산출됐다');
  return bad.length ? bad.join(' / ') : true;
});

check('B3 ★3기둥 모드 — 시주 미상(UI 기본값)에서도 3축이 나온다', () => {
  if (blocked()) return '전제 미성립(SELF-0)';
  // 【왜 이 검사가 있는가】index.html 의 시간 select 는 '모름' 이 **첫 항목이자 기본값**이고
  //   그때 hourPillar='' 가 온다(:441 · :471 · :1769 · :2092).
  //   종전 설계는 전체 포기였고, 그 결과 **시간을 고르지 않은 사용자 전원**이 엔진 3축을
  //   하나도 못 받고 LLM 환각을 그대로 받았다(적대적 검증 관통 #11).
  const bad = [];
  for (const empty of ['', '-', null, undefined, '모름']) {
    const f = BIND.computeFacts(Object.assign({}, OKCTX, { hourPillar: empty }));
    const lab = JSON.stringify(empty);
    if (!f) { bad.push(lab + ' → null (3기둥으로 산출되어야 한다)'); continue; }
    if (f.mode !== '3기둥(시주 미상)') bad.push(lab + ' mode=' + f.mode);
    if (!f.sipsungDetail || f.sipsungDetail.length !== 3) bad.push(lab + ' 십성 ' + (f.sipsungDetail || []).length + '건(3 이어야)');
    if (!f.daewoon || f.daewoon.list.length !== 8) bad.push(lab + ' 대운 미산출 — 대운은 월주 기준이라 시주와 무관하다');
    if (!Array.isArray(f.habChung)) bad.push(lab + ' 합충 배열 아님');
    // ★시주를 임의로 채우지 않았는가
    if (f.pillars.length !== 3) bad.push(lab + ' pillars ' + f.pillars.length + '건 — 시주를 지어냈다');
  }
  return bad.length ? bad.join(' / ') : true;
});

// ══ C축 — LLM 환각 덮어쓰기 (이 작업의 목적) ═════════════════════════════════
check('C1 ★LLM 오답을 엔진 값이 덮어쓴다 (대운 간지·십성)', () => {
  if (blocked()) return '전제 미성립(SELF-0)';
  const f = BIND.computeFacts(OKCTX);
  const parsed = {
    sipsungDetail: [{ name: '정인', position: '연', meaning: 'm1' }, { name: '편관', position: '월', meaning: 'm2' },
      { name: '비견', position: '일', meaning: 'm3' }, { name: '식신', position: '시', meaning: 'm4' }],
    daewoon: f.daewoon.list.map((e, i) => ({ age: 'a' + i, ganji: i % 2 ? '甲子' : e.ganji, fortune: 'f' + i })),
    habChung: [{ type: '沖', between: '월지-시지', effect: '★날조' }]
  };
  const r = BIND.applyEngineFacts('saju_premium_2', parsed, f);
  const bad = [];
  if (parsed.sipsungDetail[0].name !== '편인') bad.push('십성 오답이 안 고쳐졌다(' + parsed.sipsungDetail[0].name + ')');
  if (parsed.sipsungDetail[0].meaning !== 'm1') bad.push('LLM 서술이 유실됐다');
  const gj = parsed.daewoon.map((x) => x.ganji).join(',');
  if (gj !== f.daewoon.list.map((x) => x.ganji).join(',')) bad.push('대운 간지가 엔진 값이 아니다');
  if (parsed.daewoon[1].fortune !== 'f1') bad.push('대운 서술이 유실됐다');
  if (parsed.habChung.some((x) => x.effect === '★날조')) bad.push('★날조된 합충이 남았다');
  if (!r || r.dropped < 1) bad.push('dropped 계수가 0 — 환각 제거를 계측하지 못한다');
  return bad.length ? bad.join(' / ') : true;
});

check('C2 ★음성 대조 — 엔진 값과 일치하는 LLM 응답은 훼손하지 않는다', () => {
  if (blocked()) return '전제 미성립(SELF-0)';
  const f = BIND.computeFacts(OKCTX);
  const parsed = {
    sipsungDetail: f.sipsungDetail.map((e) => ({ name: e.name, position: e.position, meaning: 'M' })),
    daewoon: f.daewoon.list.map((e, i) => ({ age: BIND.AGE_BUCKETS[i], ganji: e.ganji, fortune: 'F' + i })),
    habChung: f.habChung.map((e) => ({ type: e.type, between: e.between, effect: 'E' }))
  };
  const before = JSON.stringify(parsed);
  const r = BIND.applyEngineFacts('saju_premium_2', parsed, f);
  const bad = [];
  if (JSON.stringify(parsed) !== before) bad.push('일치하는 응답이 변형됐다');
  if (r && r.dropped !== 0) bad.push('오탐 — dropped=' + r.dropped);
  return bad.length ? bad.join(' / ') : true;
});

check('C3 엔진이 만든 스키마가 클라이언트 렌더링 계약을 지킨다', () => {
  if (blocked()) return '전제 미성립(SELF-0)';
  // index.html:2106(sipsungDetail s.name/s.position/s.meaning) · :2114(dw.age/ganji/fortune)
  //           · :2138(hc.type/hc.between/hc.effect)
  const f = BIND.computeFacts(OKCTX);
  const parsed = { sipsungDetail: [], daewoon: [], habChung: [] };
  BIND.applyEngineFacts('saju_premium_2', parsed, f);
  const bad = [];
  for (const x of parsed.sipsungDetail) for (const k of ['name', 'position', 'meaning']) if (typeof x[k] !== 'string') bad.push('sipsungDetail.' + k);
  for (const x of parsed.daewoon) for (const k of ['age', 'ganji', 'fortune']) if (typeof x[k] !== 'string') bad.push('daewoon.' + k);
  for (const x of parsed.habChung) for (const k of ['type', 'between', 'effect']) if (typeof x[k] !== 'string') bad.push('habChung.' + k);
  if (parsed.daewoon.length && parsed.daewoon[0].age === '') bad.push('나이 버킷이 비었다(LLM 이 안 줬을 때 기본값이 필요)');
  return bad.length ? '필드 계약 위반: ' + Array.from(new Set(bad)).join(',') : true;
});

// ══ R축 — 런타임 결속 (fortune.js 가 실제로 쓰고 있는가) ══════════════════════
check('R1 ★api/fortune.js 가 엔진을 적재하고 적용한다', () => {
  if (!FRONT_ROOT) return 'front_root 미해석';
  const src = fs.readFileSync(path.join(FRONT_ROOT, 'api', 'fortune.js'), 'utf8');
  const bad = [];
  if (!/_engine\/bind\.js/.test(src)) bad.push('엔진 import 부재');
  if (!/computeFacts\s*\(/.test(src)) bad.push('computeFacts 호출 부재');
  if (!/applyEngineFacts\s*\(/.test(src)) bad.push('applyEngineFacts 호출 부재 — 프롬프트 지시만으로는 LLM 이 어긴다');
  if (!/factsBlock\s*\(/.test(src)) bad.push('factsBlock 호출 부재');
  return bad.length ? bad.join(' / ') : true;
});

check('R2 ★적용이 scrubDeep 보다 앞선다 (인가가 마지막이어야 한다 · M14 규약)', () => {
  if (!FRONT_ROOT) return 'front_root 미해석';
  // ★v7.70-b 수리 (적대적 검증 관통 #3) — 종전 판정은 세 군데가 취약했다.
  //   ⑴ `trim().indexOf('//')===0` 인 줄만 배제해 **꼬리주석**(코드 뒤의 //)이 코드로 계산됐다.
  //      앞줄에 `// … applyEngineFacts( …` 꼬리주석을 남기고 실제 호출을 scrubDeep 뒤로 옮기면
  //      apply < scrub 이 되어 통과했다(실측).
  //   ⑵ apply 는 **첫** 매칭, scrub 은 **마지막** 매칭이라 비대칭이었다.
  //   ⑶ 문자열이 등장하기만 하면 호출로 봤다.
  //   ⟹ 주석·문자열 리터럴을 먼저 **제거**한 뒤, 양쪽 다 **마지막 실행 지점**으로 비교한다.
  const raw = fs.readFileSync(path.join(FRONT_ROOT, 'api', 'fortune.js'), 'utf8');
  // 줄 단위 주석 제거(문자열 안의 // 는 보존) + 템플릿/따옴표 리터럴 비우기
  const stripped = raw.split(/\r?\n/).map((ln) => {
    let out = '', q = null;
    for (let i = 0; i < ln.length; i++) {
      const c = ln[i], p2 = ln[i + 1];
      if (q) { if (c === q && ln[i - 1] !== '\\') q = null; out += ' '; continue; }
      if (c === '"' || c === "'" || c === '`') { q = c; out += ' '; continue; }
      if (c === '/' && p2 === '/') break;                    // 꼬리주석 이후 절단
      if (c === '/' && p2 === '*') break;                    // 블록주석 시작 이후 절단(보수적)
      out += c;
    }
    return out;
  });
  let applyLast = -1, scrubLast = -1;
  for (let i = 0; i < stripped.length; i++) {
    if (/\bapplyEngineFacts\s*\(/.test(stripped[i]) && !/\bfunction\b/.test(stripped[i])) applyLast = i + 1;
    if (/\bscrubDeep\s*\(\s*parsed\s*\)/.test(stripped[i])) scrubLast = i + 1;
  }
  if (applyLast < 0) return 'applyEngineFacts 실행 호출을 찾지 못했다(주석·문자열 제외 후)';
  if (scrubLast < 0) return 'scrubDeep(parsed) 실행 호출을 찾지 못했다(주석·문자열 제외 후)';
  if (applyLast > scrubLast) return '★적용(L' + applyLast + ')이 scrubDeep(L' + scrubLast + ') 뒤에 있다 — 인가 이후 재대입(M14 위반 구조)';
  return true;
});

check('R3 ★배포 포함 — api/_engine 이 .vercelignore 로 배제되지 않는다', () => {
  if (!FRONT_ROOT) return 'front_root 미해석';
  const p = path.join(FRONT_ROOT, '.vercelignore');
  if (!fs.existsSync(p)) return '.vercelignore 부재';
  const pats = fs.readFileSync(p, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && l[0] !== '#');
  // ★v7.70-b 수리 (적대적 검증 관통 #4) — 종전 근사 매처는 6종 중 5종을 놓쳤다.
  //   놓친 형태: `_engine/` · `api/*` · `api/_*` · `**/_engine` · `api/_engine/*.js`
  //   ⟹ gitignore 규약을 제대로 구현한다: **슬래시 없는 패턴은 모든 깊이에 매칭**,
  //      선행 `/` 는 루트 고정, `**` 는 임의 깊이, 디렉터리 매칭은 하위 전건에 전파,
  //      마지막 매칭이 이긴다.
  const toRx = (q) => {
    let g = q.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    g = g.replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*').replace(/\?/g, '[^/]');
    return g;
  };
  const targets = ['api/_engine/bind.js', 'api/_engine', 'api'];
  const decide = (target) => {
    let state = null;
    for (const raw of pats) {
      const neg = raw[0] === '!';
      let q = (neg ? raw.slice(1) : raw).trim();
      const rooted = q[0] === '/' || (q.indexOf('/') !== -1 && q.indexOf('/') !== q.length - 1);
      const dirOnly = q[q.length - 1] === '/';
      q = q.replace(/^\//, '').replace(/\/$/, '');
      if (!q) continue;
      const body = toRx(q);
      // 루트 고정이면 처음부터, 아니면 임의 깊이에서 시작
      const rx = new RegExp('^' + (rooted ? '' : '(?:.*/)?') + body + '(?:/.*)?$');
      if (rx.test(target)) state = !neg;
      else if (dirOnly) { /* 디렉터리 전용 패턴이 파일에 안 걸리는 것은 정상 */ }
    }
    return state;
  };
  const excluded = targets.filter((t) => decide(t) === true);
  // ★조상이 배제되면 자손을 되살릴 수 없다(gitignore 규약). 어느 하나라도 배제면 위반.
  if (excluded.length) {
    // 단, 상위가 배제돼도 그 자신을 명시 부정(!)으로 되살린 경우는 통과다.
    if (decide('api/_engine/bind.js') === true || decide('api/_engine') === true)
      return '★api/_engine 이 배제된다(' + excluded.join(',') + ') — 실서비스에서 엔진이 사라지고 LLM 경로로 조용히 되돌아간다';
  }
  return true;
});

check('R4 ★함수 폭증 차단 — 엔진 디렉터리가 밑줄로 시작한다', () => {
  if (!FRONT_ROOT) return 'front_root 미해석';
  // Vercel: api/ 하위에서 밑줄로 시작하는 파일·디렉터리는 엔드포인트가 되지 않는다.
  //   'engine' 으로 두면 api/engine/bind 가 함수로 배포되어 슬롯을 먹고 500 을 낸다.
  if (!fs.existsSync(path.join(FRONT_ROOT, 'api', '_engine'))) return 'api/_engine 부재';
  if (fs.existsSync(path.join(FRONT_ROOT, 'api', 'engine'))) return '★api/engine (밑줄 없음)이 있다 — 엔드포인트로 배포된다';
  return true;
});

// ── 집계 ─────────────────────────────────────────────────────────────────────
const EXPECTED_TOTAL = 21;   // SELF 5 + A 2 + V 4 + B 3 + C 3 + R 4 = 21  ★변경 시 _gate_pins.json checks_min 도 갱신
let pass = 0, fail = 0;
const failLines = [];
for (const r of results) { if (r.pass) pass++; else { fail++; failLines.push('  FAIL ' + r.id + (r.detail ? '  -> ' + r.detail : '')); } }
if (results.length !== EXPECTED_TOTAL) { fail++; failLines.push('  FAIL SELF 등록 검사 수 불일치 — 등록 ' + results.length + ' != 기대 ' + EXPECTED_TOTAL); }
if (failLines.length) { console.log('[engine_binding] 실패 내역'); failLines.forEach((l) => console.log(l)); }
console.log('[engine_binding] total=' + results.length + ' pass=' + pass + ' fail=' + fail);
process.exit(fail === 0 ? 0 : 1);
