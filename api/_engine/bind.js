// 천운 — ★엔진 결속 어댑터 (v7.70 · 2026-08-01 · 결정 77 이행 1단계)
//
// 【무엇을 하는가】
//   클라이언트가 보낸 `context`(2자 문자열 4개)를 엔진 입력 형식으로 바꾸고,
//   **결정적 사실 3축**을 서버에서 산출한다.
//     ① 대운(大運) 8단계 간지 + 순역
//     ② 십성(十星) 4기둥 천간
//     ③ 지지 관계(六合·三合·沖·六害·刑)
//
// 【왜 필요한가 — 실측된 문제】
//   v7.69 §3 에서 확인: 이 3축을 **서버도 클라이언트도 계산하지 않는다.**
//   브라우저 전역에 calc* 함수가 10개 있으나 대운·십성분포·합충은 없고,
//   `api/fortune.js` 에도 없다. 즉 ₩29,900 프리미엄의 `daewoon[8]`·`habChung[]` 이
//   **전부 LLM 생성이며 검증 경로가 없었다.** 대운 간지는 순역 규칙 + 60갑자 산술이라
//   LLM 이 틀려도 아무도 알 수 없다.
//   ⟹ 고정 원칙 5(엔진 안에서 결과를 도출, 못 낼 때만 AI 추론)의 1단계 이행.
//
// 【승격 근거 — v7.70 전수 검증 (eval/eval_engine_binding.js 가 매번 재현한다)】
//   · 십성          10×10 = 100 전수 · 명리 정의(오행 생극 + 음양)로 독립 유도 후 대조 → 100/100
//   · 지지 관계      12×12 = 132 전수 · 전통표 독립 정의 → 132/132
//                    (六合 12 · 三合 24 · 沖 12 · 六害 12 · 刑 14 순서쌍 커버)
//   · 대운 순역·간지 10년간 × 2성별 × 60월주 = 1,200 전수 · 60갑자 산술 독립 유도 → 1,200/1,200
//   · 일진 만세력    1900-01-01~2050-12-31 55,152일 연속성 + 앵커 3건 → 위반 0
//   ★이 근거로 authority.js 의 sipsin·daewoon_direction 을 VERIFIED 로 승격했다(제이 승인 2026-08-01).
//
// 【★승격하지 않은 것 — 정직 기재】
//   · `sinsal`  : COMPILED_UNVERIFIED. 편집된 표라 원문 대조 없이는 독립 검증이 불가.
//   · `daewoon_start_age` : APPROX_FIXED_TERM(고정 절기일). surface_policy=DENY 유지.
//                 ⟹ 본 모듈은 **간지 시퀀스와 순역만** 내보내고 시작 나이는 내보내지 않는다.
//   · `gyeok`·`yongsin`·`sangsin`·`johu` : GT 132건 중 전문가 라벨 12건(9.1%)뿐,
//                 용신은 33.7%가 null, 상신은 전건 EXPERT_PENDING. **손대지 않는다.**
//
// 【fail-closed 원칙】
//   입력이 조금이라도 어긋나면 **부분 산출을 하지 않고 null 을 돌려준다.**
//   호출부는 null 이면 종전대로 LLM 에 맡긴다 — 잘못된 사실을 주입하느니 안 주입한다.
'use strict';

const M = require('./myeongli');
const daewoon = require('./daewoon');
const authority = require('./authority');

const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const POS = ['연', '월', '일', '시'];

// ── 1. 어댑터 ────────────────────────────────────────────────────────────────
// 클라이언트는 '戊辰' 처럼 **2자 문자열**로 보낸다(index.html:1766 / :2089).
// ★코드포인트 단위로 자른다 — 한자는 BMP 안이지만 [...str] 로 통일해 서로게이트 사고를 원천 차단.
function splitPillar(p) {
  if (typeof p !== 'string') return null;
  const ch = [...p.trim()];
  if (ch.length !== 2) return null;
  const s = ch[0], b = ch[1];
  const si = STEMS.indexOf(s), bi = BRANCHES.indexOf(b);
  if (si === -1 || bi === -1) return null;
  // ★v7.70-b — 60갑자에 **실재하는 조합**인지 본다(적대적 검증 관통 #5 수리).
  //   종전에는 천간·지지를 각각만 검사해 '甲丑' 같은 **120중 60개의 비실재 조합**이 통과했다.
  //   그러면 daewoon.js 의 ganziIndex 가 -1 을 돌려주고, 그것을 검사하지 않는 computeDaewoon 이
  //   월주와 무관한 甲子 기점 시퀀스를 만든다 — 십성·합충은 정상값이라
  //   **부분적으로 그럴듯한 오답**이 「서버 엔진 산출 확정값」으로 프롬프트에 들어갔다.
  //   60갑자는 천간·지지의 **음양이 같은 조합만** 존재한다(甲子·乙丑 … / 甲丑은 없음).
  if ((si % 2) !== (bi % 2)) return null;
  return { s: s, b: b };
}

// context → pillars[3 또는 4].
// ★v7.70-b — **3기둥 모드**를 지원한다(적대적 검증 관통 #11 수리).
//   【실측된 문제】 index.html 의 시간 select 는 `<option value="-1">모름</option>` 이
//     **첫 항목이자 기본 선택값**이고(:441 · :471 · :499 · :520),
//     그때 클라이언트는 `hourPillar: ''` 를 보낸다(:1769 · :2092).
//     종전 설계는 그것을 「전체 포기」로 처리해 **시간을 고르지 않은 사용자 전원이
//     엔진 3축을 하나도 못 받고 LLM 환각 그대로**를 받았다. 기본값이 그러므로 다수다.
//   【수리】 연·월·일 3기둥만으로도 산출 가능한 것은 산출한다.
//     · 대운  : 월주 기준이라 시주와 **무관** — 완전 산출 가능
//     · 십성  : 연·월·일 3개 (시주 항목만 빠짐)
//     · 지지관계: 연·월·일 3쌍 (시지 관련 3쌍만 빠짐)
//   ★시주를 임의로 채우지는 않는다. 없는 것은 없다고 하고, 있는 것만 확정한다.
function toPillars(ctx) {
  if (!ctx || typeof ctx !== 'object' || Array.isArray(ctx)) return null;
  const head = [ctx.yearPillar, ctx.monthPillar, ctx.dayPillar];
  const out = [];
  for (const p of head) {
    const q = splitPillar(p);
    if (!q) return null;                                  // 연·월·일은 필수
  out.push(q);
  }
  const h = splitPillar(ctx.hourPillar);                   // 없거나 어긋나면 3기둥으로 간다
  if (h) out.push(h);
  return out;
}

// ── 2. 3축 산출 ──────────────────────────────────────────────────────────────

/** ① 십성 — 일간(pillars[2].s) 대비 4기둥 천간. */
function sipsungDetail(pillars) {
  const dayStem = pillars[2].s;
  const out = [];
  for (let i = 0; i < pillars.length; i++) {
    const r = M.sipsin(dayStem, pillars[i].s);
    if (!r || !r.name) return null;                    // fail-closed
    out.push({ position: POS[i], stem: pillars[i].s, name: r.name, code: r.code, group: r.group });
  }
  return out;
}

/** ② 지지 관계 — 4기둥 지지의 6개 순서 없는 쌍 전수. */
function branchRelations(pillars) {
  const out = [];
  for (let i = 0; i < pillars.length; i++) {
    for (let j = i + 1; j < pillars.length; j++) {
      const rel = M.branchRelations(pillars[i].b, pillars[j].b);
      if (!Array.isArray(rel)) return null;            // fail-closed
      for (const t of rel) {
        out.push({ type: t, between: POS[i] + '지-' + POS[j] + '지', branches: pillars[i].b + '-' + pillars[j].b });
      }
    }
  }
  return out;                                           // 관계가 하나도 없으면 빈 배열(정상)
}

/** ③ 대운 — 8단계 간지 + 순역. ★시작 나이는 내보내지 않는다(APPROX · surface DENY). */
function daewoonList(pillars, gender) {
  if (gender !== 'male' && gender !== 'female') return null;
  const r = daewoon.computeDaewoon(pillars[0].s, pillars[1], gender, { startAge: 5 });
  if (!r || !Array.isArray(r.list) || r.list.length !== 8) return null;
  const forward = /forward|순/.test(String(r.direction));
  const list = r.list.map((x, i) => {
    if (!x || typeof x.ganji !== 'string' || x.ganji.length !== 2) return null;
    return { step: i + 1, ganji: x.ganji, stem: x.stem, branch: x.branch };
  });
  if (list.some((x) => x === null)) return null;        // fail-closed
  return { direction: forward ? '순행' : '역행', list: list };
}

// ── 3. 공개 진입점 ───────────────────────────────────────────────────────────
/**
 * context → 결정적 사실 3축. 하나라도 못 내면 그 축만 null.
 * 4기둥 자체를 못 읽으면 전체 null(호출부는 종전 LLM 경로로).
 *
 * ★authority 검사를 **매 호출** 통과시킨다. 승격이 되돌려지면 값이 즉시 사라진다 —
 *   봉인 정책과 산출 경로가 갈라지지 않게 하는 결속이다.
 */
// ★v7.70-b — 산출 키 화이트리스트 (적대적 검증 관통 #1 수리)
//   【실측된 문제】 게이트(SELF-1)는 authority·daewoon·manse·myeongli 4파일만 해시 고정하고
//     **bind.js 는 명시적으로 제외**했다("어댑터는 api/ 전용"). 그런데 ⑴무엇을 산출하고
//     ⑵무엇을 「확정값」으로 프롬프트에 넣고 ⑶무엇을 응답에 덮어쓸지를 전부 정하는 것이
//     bind.js 다. 그래서 authority.js 를 한 글자도 안 고치고 bind.js 만으로
//     격국·용신·대운수(전부 DENY)를 「서버 엔진 산출 확정값」으로 주입해도 게이트가 17/17 이었다.
//   【수리】 산출물·프롬프트 라벨을 **코드 상수로 닫는다.** 목록 밖 키는 여기서 걸러지고,
//     eval_engine_binding 이 이 상수와 authority 승격 목록의 **일치**를 검사한다.
const FACT_KEYS = ['sipsungDetail', 'habChung', 'daewoon'];          // 산출 가능한 사실
const FACT_AUTHORITY = { sipsungDetail: 'sipsin', habChung: 'branch_relation', daewoon: 'daewoon_direction' };
const FACT_LABELS = ['십성', '대운', '지지 관계'];                    // factsBlock 이 쓸 수 있는 라벨
const META_KEYS = ['engine_version', 'pillars', 'authority', 'mode']; // 사실이 아닌 메타

function computeFacts(ctx) {
  const pillars = toPillars(ctx);
  if (!pillars) return null;

  const okSipsin = authority.userSurfaceable('sipsin');
  const okDaewoon = authority.userSurfaceable('daewoon_direction');
  const okBranch = authority.userSurfaceable('branch_relation');

  const sipsung = okSipsin ? sipsungDetail(pillars) : null;
  const rel = okBranch ? branchRelations(pillars) : null;
  const dw = okDaewoon ? daewoonList(pillars, ctx.gender) : null;

  if (!sipsung && !rel && !dw) return null;

  const out = {
    engine_version: 'bind/1.1.0',
    mode: pillars.length === 4 ? '4기둥' : '3기둥(시주 미상)',
    pillars: pillars.map((p, i) => ({ position: POS[i], ganji: p.s + p.b })),
    sipsungDetail: sipsung,
    habChung: rel,
    daewoon: dw,
    // ★노출 정책을 산출물에 동봉한다 — 감사 가능하게.
    authority: {
      sipsin: okSipsin, daewoon_direction: okDaewoon, branch_relation: okBranch,
      sinsal: authority.userSurfaceable('sinsal'),                 // false — 미승격
      daewoon_start_age: authority.userSurfaceable('daewoon_start_age') // false — DENY
    }
  };
  // ★출구 화이트리스트 — 허용 목록 밖 키는 **여기서 삭제**한다. bind.js 를 고쳐
  //   봉인축을 끼워 넣어도 사실로 나가지 못한다.
  const allow = FACT_KEYS.concat(META_KEYS);
  for (const k of Object.keys(out)) if (allow.indexOf(k) === -1) delete out[k];
  return out;
}

/**
 * 엔진 사실을 **프롬프트에 넣을 한국어 블록**으로 직렬화한다.
 * ★LLM 에게 「이 값을 그대로 쓰라」고 지시하기 위한 것이며, 최종 응답은
 *   호출부가 엔진 값으로 **덮어쓴다**(LLM 이 바꿔도 무효화된다).
 */
function factsBlock(facts) {
  if (!facts) return '';
  const L = [];
  // ★v7.70-b — 아래 push 는 FACT_LABELS 안의 라벨만 쓴다. 라벨을 늘리려면 상수를 먼저 늘려야 하고,
  //   eval_engine_binding 이 「블록의 모든 항목 라벨이 FACT_LABELS 에 있다」를 검사한다.
  L.push('【서버 엔진 산출 확정값 — 아래 값을 그대로 사용하세요. 임의로 바꾸거나 다시 계산하지 마세요.】');
  if (facts.sipsungDetail) {
    L.push('· 십성(일간 ' + facts.pillars[2].ganji[0] + ' 기준): ' +
      facts.sipsungDetail.map((x) => x.position + '주 ' + x.stem + '=' + x.name).join(' / '));
  }
  if (facts.daewoon) {
    L.push('· 대운 ' + facts.daewoon.direction + ' 8단계: ' +
      facts.daewoon.list.map((x) => x.step + ')' + x.ganji).join(' '));
  }
  if (facts.habChung) {
    L.push('· 지지 관계: ' + (facts.habChung.length
      ? facts.habChung.map((x) => x.between + ' ' + x.branches + ' ' + x.type).join(' / ')
      : '해당 없음(합·충·형·해 없음 — 없다고 쓰세요. 지어내지 마세요)'));
  }
  // ★출구 검사 — 라벨 화이트리스트 밖의 줄이 섞이면 **블록 전체를 버린다**(fail-closed).
  //   ★라벨 판정 = 「'· <라벨>' 로 시작하는가」. 부분 문자열 비교가 아니라 **접두사 일치**라
  //     '십성' 을 포함하는 임의 문자열이 통과하지 못한다.
  const body = L.slice(1);
  for (const line of body) {
    if (!FACT_LABELS.some((lab) => line.indexOf('· ' + lab) === 0)) return '';
  }
  return L.join('\n');
}

// ── 4. 응답 덮어쓰기 ─────────────────────────────────────────────────────────
// ★프롬프트로 「그대로 쓰라」고 지시하는 것만으로는 부족하다 — LLM 은 지시를 어긴다.
//   **응답을 받은 뒤 엔진 값으로 덮어써야** 환각이 사용자에게 도달하지 않는다.
//   ★scrubDeep **이후**에 부른다. 엔진 값은 스크럽 대상이 아니며(문헌명 아님),
//     스크럽 전에 넣으면 치환 규칙에 노출되어 조용히 훼손될 수 있다.
//
// 【버리는 것】 LLM 이 만든 합충 중 **엔진에 없는 관계는 버린다.** 그것이 이 작업의 목적이다.
// 【남기는 것】 서술(meaning · fortune · effect)은 LLM 이 계속 담당한다.

const AGE_BUCKETS = ['0~9세', '10~19세', '20~29세', '30~39세', '40~49세', '50~59세', '60~69세', '70~79세'];

function pickString(v) { return typeof v === 'string' ? v : ''; }

/**
 * 엔진 사실을 파싱된 응답에 적용한다. **제자리 수정**하고 적용 내역을 돌려준다.
 * @returns {{applied:string[], dropped:number, kept:number}|null}
 */
function applyEngineFacts(type, parsed, facts) {
  // ★v7.70-b — 이 함수에는 **조기 return 이 없다**(적대적 검증 관통 #2 수리).
  //   종전 구조에서는 선두에 조건부 return 을 하나 넣는 것만으로 덮어쓰기 전체를 끌 수 있었고,
  //   그 조건을 LLM 이 채우는 필드(citation_ref.source_id — premium_1 스키마가 LLM 에게
  //   직접 요구한다)로 걸면 **LLM 한 줄로 자기 감시를 끌 수 있었다.**
  //   ⟹ 아래 3블록은 무조건 실행된다. 조건은 「엔진이 그 축을 냈는가」뿐이다.
  if (!facts || !parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const applied = [];
  let dropped = 0, kept = 0;

  // ① 십성 — 엔진 4기둥으로 재구성. 서술(meaning)은 LLM 것을 위치로 매칭.
  if (facts.sipsungDetail && Object.prototype.hasOwnProperty.call(parsed, 'sipsungDetail')) {
    const llm = Array.isArray(parsed.sipsungDetail) ? parsed.sipsungDetail : [];
    parsed.sipsungDetail = facts.sipsungDetail.map((e, i) => {
      const byPos = llm.find((x) => x && typeof x.position === 'string' && x.position.indexOf(e.position) === 0);
      const src = byPos || llm[i] || {};
      if (byPos) kept++;
      return { name: e.name, position: e.position, meaning: pickString(src.meaning) };
    });
    dropped += Math.max(0, llm.length - facts.sipsungDetail.length);
    applied.push('sipsungDetail');
  }

  // ② 대운 — 간지를 엔진 값으로 덮어쓴다. 나이 버킷은 10년 고정(대운수는 미승격 · 노출 안 함).
  if (facts.daewoon && Object.prototype.hasOwnProperty.call(parsed, 'daewoon')) {
    const llm = Array.isArray(parsed.daewoon) ? parsed.daewoon : [];
    parsed.daewoon = facts.daewoon.list.map((e, i) => {
      const src = llm[i] || {};
      if (src && typeof src.ganji === 'string' && src.ganji !== e.ganji) dropped++;   // ★LLM 오답 계수
      else if (src && src.ganji) kept++;
      // ★v7.70-b — age 를 **엔진 버킷으로 고정**한다(적대적 검증 관통 #6 수리).
      //   종전에는 LLM 의 age 를 그대로 썼는데, 그 자리는 대운수(시작 나이)를 담는 자리다.
      //   `daewoon_start_age` 는 APPROX_FIXED_TERM 이라 surface_policy=DENY 인데,
      //   LLM 이 "3세~12세" 라고 쓰면 **봉인된 정보가 무방비로 사용자에게 나갔다.**
      //   ⟹ 10년 고정 버킷만 쓴다. 대운수는 정밀 절입 만세력 도입 후 별도 승격 대상.
      return { age: AGE_BUCKETS[i], ganji: e.ganji, fortune: pickString(src.fortune) };
    });
    applied.push('daewoon');
  }

  // ③ 합충 — 엔진 관계로 **전면 재구성**. 엔진에 없는 LLM 관계는 버린다.
  if (facts.habChung && Object.prototype.hasOwnProperty.call(parsed, 'habChung')) {
    const llm = Array.isArray(parsed.habChung) ? parsed.habChung : [];
    const used = new Set();
    parsed.habChung = facts.habChung.map((e) => {
      let src = null;
      for (let i = 0; i < llm.length; i++) {
        if (used.has(i) || !llm[i]) continue;
        const t = pickString(llm[i].type), bw = pickString(llm[i].between);
        if (t.indexOf(e.type) !== -1 && bw && e.between.indexOf(bw.slice(0, 2)) !== -1) { src = llm[i]; used.add(i); break; }
      }
      // ★v7.70-b — 2차 매칭(type 만 보는 느슨한 매칭)을 **제거**했다(적대적 검증 관통 #9 수리).
      //   「三合 [연지-일지]」 라벨에 「월지와 시지가 三合」 서술이 붙는 오배치가 정상 경로에서
      //   생성됐다. 위치가 다르면 서술도 다른 관계에 대한 것이므로 **가져오면 안 된다.**
      //   못 찾으면 effect 는 빈 문자열이고, 프롬프트가 엔진 관계를 이미 알려주므로
      //   정상 응답에서는 1차 매칭이 성립한다.
      if (src) kept++;
      return { type: e.type, between: e.between, effect: pickString(src && src.effect) };
    });
    dropped += llm.length - used.size;                                   // ★엔진에 없던 LLM 관계 = 환각
    applied.push('habChung');
  }

  return { applied: applied, dropped: dropped, kept: kept };
}

module.exports = {
  FACT_KEYS: FACT_KEYS,
  FACT_LABELS: FACT_LABELS,
  FACT_AUTHORITY: FACT_AUTHORITY,
  applyEngineFacts: applyEngineFacts,
  AGE_BUCKETS: AGE_BUCKETS,
  splitPillar: splitPillar,
  toPillars: toPillars,
  sipsungDetail: sipsungDetail,
  branchRelations: branchRelations,
  daewoonList: daewoonList,
  computeFacts: computeFacts,
  factsBlock: factsBlock,
  STEMS: STEMS, BRANCHES: BRANCHES, POS: POS
};
