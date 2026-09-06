// ============================================================
//  P-786-V · 배포용 관상 규칙 컴파일러
//  node _v786_diag/compile_face_rules.js
// ------------------------------------------------------------
//  IP 규칙(_v786_diag/IP_face/rules/face/*.json · 100건)
//     → 배포 산출물 api/_engine/face_rules.json
//
//  【이 파일이 하는 일 — 그리고 하지 않는 일】
//   하는 일  ① 고전 원문(한자) 일체를 **제거**한다.
//              citation.text_original · condition.predicate_original ·
//              condition.operational · condition.organ · verdict.text_original · notes
//              — 이 여섯 필드는 산출물에 **복사되지 않는다**(화이트리스트 방식).
//            ② 인용을 **서지 ID + 로마자/한글 locus** 로만 남긴다(CITATION_RULE 관행).
//            ③ 기계 판정용 condition.expr 을 붙인다 — ★아래 CONDITION_EXPR 표에
//              **명시적으로 열거된 규칙에만** 붙인다. 표에 없으면 expr=null 이고,
//              엔진은 expr 이 없는 규칙을 판정하지 않는다(추측 금지).
//            ④ 산출물을 스스로 검사한다 — 한자 연속 10자 이상 구간이 하나라도
//              남아 있으면 **파일을 쓰지 않고 종료한다**(fail-closed).
//
//   하지 않는 일
//            · gloss_ko · verdict_ko 를 **만들지 않는다.** IP 규칙에 있으면 쓰고
//              없으면 빈 문자열로 둔다(날조 금지).
//            · measurability · threshold_origin · user_exposure 를 **바꾸지 않는다.**
//              등급은 데이터가 정하고 엔진은 그 데이터를 읽을 뿐이다.
//
//  【제약 근거】
//   · 고전 원문은 IP 자산이며 _v786_diag/IP_face/ 는 .gitignore 대상이다.
//   · pre-commit 훅이 「한자 10자 이상 연속 구간의 합 200자」를 차단한다.
//     ⟹ 산출물은 연속 10자 구간이 **0건**이어야 한다(합 0자).
// ============================================================
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const IP = path.join(__dirname, 'IP_face');
const OUT = path.join(ROOT, 'api', '_engine', 'face_rules.json');
const CORE = path.join(__dirname, 'face_core_v786.js');

const ARTIFACT_VERSION = 'face_rules/1.0.0';

// ── 0. 한자 판별 ─────────────────────────────────────────────────────────────
// CJK 통합 한자 + 확장 A + 호환 한자. (한글·가나·괄호·숫자는 한자가 아니다)
const HANJA = /[㐀-䶿一-鿿豈-﫿]/;
const HANJA_RUN_LIMIT = 10;      // ★연속 10자 이상이면 훅이 잡는다

function hanjaRuns(s, limit) {
  const out = [];
  let run = '';
  for (const ch of String(s)) {
    if (HANJA.test(ch)) run += ch;
    else { if (run.length >= limit) out.push(run); run = ''; }
  }
  if (run.length >= limit) out.push(run);
  return out;
}
function maxHanjaRun(s) {
  let m = 0, c = 0;
  for (const ch of String(s)) { if (HANJA.test(ch)) { c++; if (c > m) m = c; } else c = 0; }
  return m;
}
function countHanja(s) {
  let n = 0;
  for (const ch of String(s)) if (HANJA.test(ch)) n++;
  return n;
}

// ── 1. locus 음역 (한자 → 한글) ──────────────────────────────────────────────
// ★locus 는 「권/편」이라는 서지 좌표다. 원문이 아니다. 그래도 산출물에서 한자를
//   빼기 위해 음역한다. ★표에 없는 글자가 하나라도 나오면 **실패**시킨다(추측 금지).
const READING = {
  卷: '권', 葉: '엽',
  一: '일', 二: '이', 三: '삼', 四: '사', 五: '오',
  六: '육', 七: '칠', 八: '팔', 九: '구', 十: '십',
  官: '관', 府: '부', 瀆: '독', 嶽: '악', 論: '론', 靣: '면', 部: '부',
  眉: '미', 眼: '안', 極: '극', 小: '소', 大: '대', 行: '행', 相: '상',
  剋: '극', 歌: '가', 學: '학', 堂: '당', 位: '위', 儀: '의', 應: '응',
  賤: '천', 額: '액', 形: '형', 總: '총', 宮: '궁', 訣: '결',
  辨: '변', 訛: '와', 說: '설'
};
// 두음법칙 — 어두에서만 적용한다.
const DUEUM = { 론: '논', 량: '양', 력: '역', 렬: '열', 류: '유', 리: '이' };

const NUM = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
const NUMCHARS = '一二三四五六七八九十';

function cjkNumber(s) {
  // 「十」이 있으면 십진 표기(二十=20 · 十三=13), 없으면 자릿수 나열(二一=21).
  if (s.indexOf('十') === -1) {
    let v = '';
    for (const ch of s) { if (NUM[ch] === undefined) return null; v += String(NUM[ch]); }
    return Number(v);
  }
  const i = s.indexOf('十');
  const head = s.slice(0, i), tail = s.slice(i + 1);
  let n = head ? NUM[head] : 1;
  if (n === undefined) return null;
  n *= 10;
  if (tail) { const t = NUM[tail]; if (t === undefined) return null; n += t; }
  return n;
}

function readWord(s, missing) {
  let out = '';
  for (const ch of s) {
    if (READING[ch] === undefined) { missing.push(ch); out += '?'; continue; }
    out += READING[ch];
  }
  if (out && DUEUM[out[0]]) out = DUEUM[out[0]] + out.slice(1);
  return out;
}

/** 「卷六 五行形相論(葉二十a)」 → 「권6 오행형상론(엽20a)」 */
function romanizeLocus(locus, missing) {
  let s = String(locus || '').trim();
  let out = '';

  const mv = s.match(new RegExp('^卷([' + NUMCHARS + ']+)\\s*'));
  if (mv) {
    const n = cjkNumber(mv[1]);
    if (n === null) { missing.push(mv[1]); return null; }
    out += '권' + n + ' ';
    s = s.slice(mv[0].length);
  }

  let leaf = '';
  const ml = s.match(new RegExp('\\(葉([' + NUMCHARS + ']+)([ab]?)\\)\\s*$'));
  if (ml) {
    const n = cjkNumber(ml[1]);
    if (n === null) { missing.push(ml[1]); return null; }
    leaf = '(엽' + n + (ml[2] || '') + ')';
    s = s.slice(0, s.length - ml[0].length);
  }

  out += readWord(s.trim(), missing) + leaf;
  return out.trim();
}

// ── 2. ★기계 판정용 조건식 — 명시 열거표 ────────────────────────────────────
//
//  ★★이 표는 「우리가 새로 만든 조건」이 아니다. IP 규칙의 condition.operational 이
//    **이미 비교식을 문장으로 확정해 둔 것**을 기계가 읽을 형태로 옮겨 적은 것뿐이다.
//    그래서 표의 각 항목에는 근거(from)를 함께 남기고, 컴파일러가 다음을 검사한다:
//      ① rule_id 가 실재한다
//      ② 그 규칙이 MEASURABLE 이다        (PARTIAL/UNMEASURABLE 에 식을 붙이면 위조다)
//      ③ 그 규칙이 threshold_origin=TEXT 다 (raw 비교는 모집단을 쓰지 않는다)
//      ④ 식이 쓰는 축이 condition.axis_partial 안에 있다
//      ⑤ 식이 쓰는 축이 face_core_v786.js 의 계측 축 정본 안에 있다
//    하나라도 어긋나면 컴파일이 **실패**한다.
//
//  ★표에 없는 규칙은 expr=null 이다. 엔진은 expr 이 없으면 판정하지 않는다.
//    「三停皆稱」(FACE_OGWAN_R016)처럼 비교 대상은 있으나 **컷오프가 원문에 없는**
//    규칙이 여기 해당한다 — 컷오프를 지어내면 그 순간 원문 판정이 아니다.
//
//  【식 문법】
//    space: 'measure' — 원시 계측값끼리 비교(분모가 같아 약분되는 경우). 모집단 불필요.
//    space: 'rank'    — 분위수 랭크와 상수 비교. ★모집단이 필요하므로 POPULATION 전용.
//    op: 'gt' | 'gte' | 'lt' | 'lte'
//    left/right: { axis: '<축>' } 또는 { const: <수> }
const CONDITION_EXPR = {
  FACE_OGWAN_R020: {
    space: 'measure', op: 'gt', left: { axis: 'browLength' }, right: { axis: 'eyeSize' },
    from: 'operational 이 비교 대상을 명시한다 — 눈썹 길이 대 눈 너비. 두 축 모두 얼굴폭으로 나뉘어 있어 비를 취하면 분모가 약분된다.'
  },
  FACE_OGWAN_R021: {
    space: 'measure', op: 'lte', left: { axis: 'browLength' }, right: { axis: 'eyeSize' },
    from: 'operational 이 R020 의 여집합이라고 명시한다. 같은 비교의 반대 방향.'
  },
  FACE_XLHZ_R014: {
    space: 'measure', op: 'gt', left: { axis: 'jawRatio' }, right: { axis: 'foreheadRatio' },
    from: 'operational 이 조건식을 문장으로 확정해 둔다 — jawRatio > foreheadRatio. 두 축은 분모가 같다.'
  },
  FACE_XLHZ_R015: {
    space: 'measure', op: 'lt', left: { axis: 'foreheadRatio' }, right: { axis: 'jawRatio' },
    from: 'operational 이 조건식을 문장으로 확정해 둔다 — foreheadRatio < jawRatio.'
  },
  // ★P-786-W · condition_coverage=FULL + threshold_origin=POPULATION 의 첫 사례.
  //   원문은 「작다」의 컷오프를 주지 않는다 — 컷오프는 **참조 모집단**이 준다. 그래서 space=rank 다.
  //   ★엔진은 이 식을 모집단 등급이 A·B 일 때만 판정으로 쓴다(그 전에는 참고층).
  //   ★원문이 폭인지 길이인지 특정하지 않으므로 한 치수로 전체를 판정하지 않고 두 치수를
  //     모두 요구하는 보수적 결합(op=all)으로 읽는다.
  FACE_OGWAN_R030: {
    space: 'rank', op: 'all',
    terms: [
      { op: 'lt', left: { axis: 'noseWRatio' }, right: { const: 0.5 } },
      { op: 'lt', left: { axis: 'noseHRatio' }, right: { const: 0.5 } }
    ],
    from: 'coverage_note 가 조건 전부를 덮었음을 근거와 함께 남긴다(uncovered 0). 남은 것은 「얼마나 작은가」뿐이고 ' +
      '그 컷오프는 원문이 아니라 참조 모집단이 준다 — 모집단 중앙값 미만을 「작다」로 본다. ' +
      '치수 선택이 원문에 없으므로 두 치수를 모두 요구한다(부분으로 전체를 판정하지 않는다).'
  }
};

// expr 이 없는 MEASURABLE 규칙의 사유 — ★열거하지 않으면 컴파일 실패(침묵 누락 차단).
const EXPR_ABSENT = {
  FACE_OGWAN_R016:
    '비교 대상(세 구간)은 원문에 있으나 「걸맞다」의 컷오프가 원문에 없다. ' +
    'thirds 축은 0~1 균등도이지만 몇 이상이 「걸맞음」인지는 원문이 말하지 않는다. ' +
    '컷오프를 지어내면 원문 판정이 아니므로 식을 붙이지 않는다.'
};

// ── 3. 계측 축 정본 읽기 ─────────────────────────────────────────────────────
function loadAxes() {
  const src = fs.readFileSync(CORE, 'utf8');
  const m = src.match(/var\s+CW_FACE_AXES\s*=\s*\[([\s\S]*?)\]\s*;/);
  if (!m) throw new Error('CW_FACE_AXES 를 face_core_v786.js 에서 찾지 못했다');
  const axes = [];
  const re = /'([A-Za-z][A-Za-z0-9_]*)'/g;
  let g;
  while ((g = re.exec(m[1]))) axes.push(g[1]);
  if (!axes.length) throw new Error('CW_FACE_AXES 파싱 실패');
  return axes;
}

// ── 4. 컴파일 ────────────────────────────────────────────────────────────────
function readJSON(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
const asRules = (o) => (o && o.rules) || o;

// 조건식 산출 — 'all'(보수적 결합)은 terms 를 그대로 싣는다.
function exprOut(e) {
  if (e.op === 'all') {
    return {
      space: e.space,
      op: 'all',
      terms: (e.terms || []).map((t) => ({ op: t.op, left: t.left, right: t.right }))
    };
  }
  return { space: e.space, op: e.op, left: e.left, right: e.right };
}
// 조건식이 쓰는 축을 전부 모은다(중첩 terms 포함).
function exprAxes(e) {
  const out = [];
  const walk = (x) => {
    if (!x) return;
    if (Array.isArray(x.terms)) { x.terms.forEach(walk); return; }
    for (const s of [x.left, x.right]) if (s && s.axis) out.push(s.axis);
  };
  walk(e);
  return out;
}

// ★condition_coverage 유효값
const COVERAGE_VALUES = ['FULL', 'PARTIAL', 'NONE'];
// ★FULL 이 될 수 없는 계열 — 원문 글자로 판별한다(IP 원본에서만 가능하다).
const FULL_FORBIDDEN = [
  { re: /耳|採聽|采聽/, why: '귀 — 랜드마크가 없다' },
  { re: /清|淸|秀/, why: '청·수 — 비교 대상도 컷오프도 원문에 없다' },
  { re: /氣/, why: '기 — 색이 아니다' },
  { re: /凹|陷/, why: '요함·결함 — 깊이다' },
  { re: /坐|涉|行|臥|動止/, why: '거동 — 얼굴 사진 밖이다' },
  { re: /腰|背|臂|骨|肉/, why: '몸통·골육 — 얼굴 사진 밖이다' },
  { re: /惡|醜|㐫/, why: '길흉 형용 — 계측량이 아니다' }
];

/** IP 원본에서 배포 레코드를 만든다. 화이트리스트 복사 — 원문 필드는 **읽지도 쓰지도** 않는다. */
function compileRule(r, missing) {
  const cond = r.condition || {};
  const ver = r.verdict || {};
  const cit = r.citation || {};
  const expr = CONDITION_EXPR[r.rule_id] || null;

  return {
    rule_id: r.rule_id,
    doctrine_id: r.doctrine_id || null,
    source_edition_id: r.source_edition_id || null,
    corpus_id: cit.corpus_id || null,
    locus: cit.locus ? romanizeLocus(cit.locus, missing) : null,

    gloss_ko: typeof cond.gloss_ko === 'string' ? cond.gloss_ko : '',
    verdict_code: ver.code || null,
    verdict_ko: typeof ver.gloss_ko === 'string' ? ver.gloss_ko : '',

    condition: {
      key: cond.key || null,
      axes: Array.isArray(cond.axis_partial) ? cond.axis_partial.slice() : [],
      expr: expr ? exprOut(expr) : null,
      expr_basis: expr ? expr.from : null,
      expr_absent_reason: expr ? null : (EXPR_ABSENT[r.rule_id] || null)
    },

    // ★P-786-W — 승격 경로의 판단 근거. 엔진(tierOf)이 직접 읽는다.
    condition_coverage: r.condition_coverage || null,
    coverage_note: r.coverage_note
      ? {
        covered: Array.isArray(r.coverage_note.covered) ? r.coverage_note.covered.slice() : [],
        uncovered: Array.isArray(r.coverage_note.uncovered) ? r.coverage_note.uncovered.slice() : [],
        basis: typeof r.coverage_note.basis === 'string' ? r.coverage_note.basis : ''
      }
      : null,

    measurability: r.measurability,
    threshold_origin: r.threshold_origin,
    measure_axis: r.measure_axis || null,
    confidence: Object.prototype.hasOwnProperty.call(r, 'confidence') ? r.confidence : null,
    user_exposure: r.user_exposure || null
  };
}

function compile() {
  const AXES = loadAxes();
  const files = ['rules/face/ogwan.json', 'rules/face/xlhz.json'];
  const src = files.map((f) => readJSON(path.join(IP, f)));
  const rulesIn = [].concat.apply([], src.map(asRules));

  const errs = [];
  const missing = [];

  // ── 검증 ①~⑤ : 조건식 표 ──
  const byId = new Map(rulesIn.map((r) => [r.rule_id, r]));
  for (const [rid, e] of Object.entries(CONDITION_EXPR)) {
    const r = byId.get(rid);
    if (!r) { errs.push(`조건식 표의 ${rid} 이 IP 규칙에 없다`); continue; }
    // ★조건식을 붙일 수 있는 규칙 — ① MEASURABLE 이거나
    //   ② condition_coverage=FULL + threshold_origin=POPULATION (모집단이 컷오프를 주는 경로).
    const exprAllowed = r.measurability === 'MEASURABLE' ||
      (r.condition_coverage === 'FULL' && r.threshold_origin === 'POPULATION');
    if (!exprAllowed) {
      errs.push(`${rid}: 조건식을 붙일 수 없는 규칙이다 (measurability=${r.measurability} · coverage=${r.condition_coverage} · origin=${r.threshold_origin})`);
    }
    if (e.space === 'measure' && r.threshold_origin !== 'TEXT') {
      errs.push(`${rid}: space=measure 인데 threshold_origin=${r.threshold_origin} (raw 비교는 TEXT 전용)`);
    }
    if (e.space === 'rank' && r.threshold_origin !== 'POPULATION') {
      errs.push(`${rid}: space=rank 인데 threshold_origin=${r.threshold_origin} (랭크 비교는 POPULATION 전용)`);
    }
    const used = exprAxes(e);
    const declared = Array.isArray(r.condition && r.condition.axis_partial) ? r.condition.axis_partial : [];
    for (const a of used) {
      if (AXES.indexOf(a) === -1) errs.push(`${rid}: 축 ${a} 가 CW_FACE_AXES 정본에 없다`);
      if (declared.indexOf(a) === -1) errs.push(`${rid}: 축 ${a} 가 규칙의 axis_partial 에 없다 (${declared.join(',')})`);
    }
  }
  // MEASURABLE 인데 식도 없고 사유도 없으면 침묵 누락이다.
  for (const r of rulesIn) {
    if (r.measurability !== 'MEASURABLE') continue;
    if (CONDITION_EXPR[r.rule_id] || EXPR_ABSENT[r.rule_id]) continue;
    errs.push(`${r.rule_id}: MEASURABLE 인데 조건식도 없고 부재 사유도 없다 (침묵 누락)`);
  }

  // ── ★P-786-W 검증 : condition_coverage · coverage_note ──
  for (const r of rulesIn) {
    const cov = r.condition_coverage;
    const note = r.coverage_note;
    if (COVERAGE_VALUES.indexOf(cov) === -1) {
      errs.push(`${r.rule_id}: condition_coverage 가 없거나 유효하지 않다 (${cov})`); continue;
    }
    if (!note || !Array.isArray(note.covered) || !Array.isArray(note.uncovered) || typeof note.basis !== 'string' || !note.basis) {
      errs.push(`${r.rule_id}: coverage_note 형식 오류 (covered·uncovered 배열 + basis 문자열이 필요하다)`); continue;
    }
    // ★자기모순 차단 — FULL 인데 못 덮은 어절이 남아 있으면 근거 없는 FULL 이다.
    if (cov === 'FULL' && note.uncovered.length) {
      errs.push(`${r.rule_id}: FULL 인데 uncovered 가 ${note.uncovered.length}건이다 (자기모순)`);
    }
    if (cov === 'FULL' && !note.covered.length) errs.push(`${r.rule_id}: FULL 인데 covered 가 비어 있다`);
    if (cov === 'NONE' && note.covered.length) errs.push(`${r.rule_id}: NONE 인데 covered 가 있다`);
    if (cov === 'PARTIAL' && (!note.covered.length || !note.uncovered.length)) {
      errs.push(`${r.rule_id}: PARTIAL 인데 covered 또는 uncovered 가 비어 있다`);
    }
    // ★금지 계열이 FULL 이면 위조다.
    if (cov === 'FULL') {
      const t = ((r.citation && r.citation.text_original) || '') + ((r.condition && r.condition.predicate_original) || '') +
        ((r.condition && r.condition.organ) || '');
      for (const f of FULL_FORBIDDEN) {
        if (f.re.test(t)) errs.push(`${r.rule_id}: ★FULL 금지 계열인데 FULL 이다 — ${f.why}`);
      }
    }
    // ★배포 산출물의 한자 게이트를 통과해야 한다 — coverage_note 는 한국어만.
    const noteText = note.covered.concat(note.uncovered, [note.basis]).join(' ');
    if (countHanja(noteText) > 0) errs.push(`${r.rule_id}: coverage_note 에 한자가 ${countHanja(noteText)}자 있다 (한국어만 허용)`);
  }

  const rules = rulesIn.map((r) => compileRule(r, missing));

  if (missing.length) {
    errs.push('locus 음역표에 없는 글자: ' + [...new Set(missing)].join(' '));
  }
  if (rules.length !== rulesIn.length) errs.push('규칙 수 불일치');

  // ── 판본 메타 (서지 ID + 한글 서명만) ──
  let editions = [];
  try {
    const se = readJSON(path.join(IP, 'sources', 'source_editions.json'));
    editions = Object.values(se.editions || {}).map((e) => ({
      source_edition_id: e.source_edition_id,
      title_ko: String(e.title || '').split('(')[0].trim(),
      license: e.license || null,
      status: e.status || null
    }));
  } catch (e) { errs.push('source_editions.json 읽기 실패: ' + e.message); }

  let doctrines = [];
  try {
    const d = readJSON(path.join(IP, 'doctrines.json'));
    doctrines = (d.doctrines || []).map((x) => ({
      doctrine_id: x.doctrine_id,
      name_ko: String(x.name || '').split('—')[0].split('(')[0].trim(),
      priority_default: x.priority_default,
      decision_authority: x.decision_authority || null,
      // ★결속 시 반드시 볼 것 — 현재 두 교리 모두 false 다(영인 미확보).
      user_output_enabled: x.user_output_enabled === true
    }));
  } catch (e) { errs.push('doctrines.json 읽기 실패: ' + e.message); }

  const tally = { rules_total: rules.length, measurability: {}, threshold_origin: {}, condition_coverage: {}, user_exposure_blocked: 0, expr_present: 0, measure_axis_null: 0 };
  for (const r of rules) {
    tally.condition_coverage[r.condition_coverage] = (tally.condition_coverage[r.condition_coverage] || 0) + 1;
    tally.measurability[r.measurability] = (tally.measurability[r.measurability] || 0) + 1;
    tally.threshold_origin[r.threshold_origin] = (tally.threshold_origin[r.threshold_origin] || 0) + 1;
    if (r.user_exposure === 'BLOCKED') tally.user_exposure_blocked++;
    if (r.condition.expr) tally.expr_present++;
    if (!r.measure_axis) tally.measure_axis_null++;
  }

  const artifact = {
    _note: '★배포 산출물. 고전 원문(한자)은 들어 있지 않다. 인용은 서지 ID(source_edition_id · corpus_id)와 ' +
      '음역된 locus 로만 한다. 이 파일은 _v786_diag/compile_face_rules.js 가 생성한다 — 손으로 고치지 말 것.',
    _source: 'IP_face/rules/face/{ogwan,xlhz}.json (배포 제외 · .gitignore)',
    artifact_version: ARTIFACT_VERSION,
    axes_source: 'face_core_v786.js · CW_FACE_AXES (' + AXES.length + '축)',
    doctrines: doctrines,
    editions: editions,
    tally: tally,
    rules: rules
  };

  return { artifact, errs, srcCount: rulesIn.length };
}

// ── 5. ★산출물 자기검사 (fail-closed) ────────────────────────────────────────
function scanArtifact(text) {
  const runs = hanjaRuns(text, HANJA_RUN_LIMIT);
  return {
    runs: runs,
    runCount: runs.length,
    runCharSum: runs.reduce((a, b) => a + b.length, 0),
    maxRun: maxHanjaRun(text),
    totalHanja: countHanja(text)
  };
}

function main() {
  const { artifact, errs, srcCount } = compile();
  const text = JSON.stringify(artifact, null, 1);
  const scan = scanArtifact(text);

  console.log('='.repeat(78));
  console.log('P-786-V  배포용 관상 규칙 컴파일러');
  console.log('='.repeat(78));
  console.log(`IP 규칙 ${srcCount}건 → 컴파일 ${artifact.rules.length}건`);
  console.log(`  measurability   ${JSON.stringify(artifact.tally.measurability)}`);
  console.log(`  threshold_origin ${JSON.stringify(artifact.tally.threshold_origin)}`);
  console.log(`  ★condition_coverage ${JSON.stringify(artifact.tally.condition_coverage)}`);
  console.log(`  user_exposure=BLOCKED ${artifact.tally.user_exposure_blocked}건 · 조건식 보유 ${artifact.tally.expr_present}건`);
  console.log('');
  console.log('[한자 잔존 검사]');
  console.log(`  한자 총 ${scan.totalHanja}자 · 최장 연속 ${scan.maxRun}자 · 연속 ${HANJA_RUN_LIMIT}자 이상 구간 ${scan.runCount}건(합 ${scan.runCharSum}자)`);
  if (scan.runCount) scan.runs.slice(0, 5).forEach((r) => console.log('  ★잔존: ' + r));

  if (scan.runCount > 0) errs.push(`★원문 잔존 — 연속 ${HANJA_RUN_LIMIT}자 이상 구간 ${scan.runCount}건. 산출물을 쓰지 않는다.`);

  if (errs.length) {
    console.log('\n[FAIL] 아래 사유로 산출물을 쓰지 않는다 (fail-closed)');
    errs.forEach((e) => console.log('  · ' + e));
    console.log(`[compile_face_rules] wrote=0 rules=${artifact.rules.length} errors=${errs.length}`);
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, text + '\n', 'utf8');
  const bytes = fs.statSync(OUT).size;
  console.log(`\n[OK] ${path.relative(ROOT, OUT)} · ${bytes} bytes · 규칙 ${artifact.rules.length}건`);
  console.log(`[compile_face_rules] wrote=1 rules=${artifact.rules.length} errors=0`);
}

module.exports = {
  compile: compile,
  scanArtifact: scanArtifact,
  hanjaRuns: hanjaRuns,
  maxHanjaRun: maxHanjaRun,
  countHanja: countHanja,
  romanizeLocus: romanizeLocus,
  CONDITION_EXPR: CONDITION_EXPR,
  HANJA_RUN_LIMIT: HANJA_RUN_LIMIT,
  OUT: OUT
};

if (require.main === module) main();
