'use strict';
/**
 * 천운 v7.71 — context 재계산 게이트 (ctxguard.js)
 * ============================================================================
 * 결정 78 이행. 「클라이언트가 계산해서 보낸 값」은 검증된 값이 아니다.
 * 서버가 생년월일시로부터 원국을 **독립 재유도**하고 context 를 교체한다.
 *
 * ★이 파일은 bind.js 와 같은 성질의 **고권한 어댑터**다 (결정 80).
 *   무엇을 덮어쓸지 정하는 유일한 곳이므로:
 *     · 교체 가능한 키는 **코드 상수**(`CTX_REPLACE_KEYS`)로 닫는다.
 *     · 그 밖의 키는 어떤 경로로도 서버가 손대지 않는다.
 *     · `_gate_pins.json` 의 sha256 봉인 대상이다(오류대장 I-17 재발 방지).
 *
 * ★결정 81 준수 — 이 함수의 실행 여부는 **클라이언트·LLM 이 만든 값에
 *   절대 의존하지 않는다.** 조건은 「생년월일을 파싱할 수 있는가」뿐이며,
 *   그것은 신뢰 경계 안쪽의 판정이다. 선두 조기 return 을 두지 않는다.
 *
 * 정책 (제이 확정 2026-08-02): **서버값 채택 + 메트릭**
 *   · 재계산이 성립하면 `CTX_REPLACE_KEYS` 를 서버값으로 교체한다.
 *   · 불일치 항목은 `metrics.diffs` 로 남긴다(차단하지 않는다).
 *     차단하지 않는 이유: 불일치의 주된 원인이 **공격이 아니라 클라이언트
 *     버그**(v7.71 결함 A·B·C·D)이므로, 400 을 내면 정상 사용자가 막힌다.
 *   · 재계산이 성립하지 않으면 **아무것도 손대지 않는다**.
 *     틀린 값을 주입하느니 종전 경로를 그대로 둔다.
 *
 * ★★v7.72 관통 #2 수리 — 위 「무변경」이 **fail-closed 가 아니라 fail-open** 이었다.
 *   재계산을 실패시키는 입력이 8종 이상 있었고(§4-2), 전부 클라이언트가 보낸
 *   원국이 무검증으로 프롬프트에 들어갔다. 특히 프리미엄 프롬프트에는 생년월일이
 *   아예 없으므로(`fortune.js:1550~1556 · 1572~1579`) `inputYear/Month/Day` 를
 *   **통째로 생략**하면 게이트만 꺼지고 프롬프트 품질은 완전히 동일했다 —
 *   위조 4기둥 `갑자 갑자 갑자 갑자` 가 200 으로 통과했다.
 *   ⟹ 「불일치는 막지 않는다」(클라 버그 배려)와 「재계산 자체가 불가능한 요청은
 *      막는다」는 **별개의 정책**이다. 후자를 `unverifiable()` 로 판정하고
 *      호출부가 `400 CONTEXT_UNVERIFIABLE` 를 낸다.
 * ============================================================================
 */

const RC = require('./recompute.js');

/** 시진 라벨 → 인덱스. 클라이언트는 `hourLabel` 로만 보낸다(index.html:1764). */
const HOUR_LABELS = ['자시', '축시', '인시', '묘시', '진시', '사시', '오시', '미시', '신시', '유시', '술시', '해시'];

/**
 * ★서버가 교체할 수 있는 context 키 — 전건 명시.
 *   여기 없는 키는 어떤 경로로도 서버가 덮어쓰지 않는다.
 *   `name`·`gender`·`currentYear`·`currentGanji` 등은 원국이 아니므로 제외한다.
 *   (`currentYear` 는 클라이언트 벽시계 값이며 서버가 재계산하면 안 된다 —
 *    v7.71 클라이언트 분석 §9-3 ⑤)
 */
const CTX_REPLACE_KEYS = Object.freeze([
  'yearPillar', 'monthPillar', 'dayPillar', 'hourPillar',
  'ilgan', 'ilganElement', 'ilganYinyang', 'yearStemYinyang',
  'sajuYear', 'isAdjusted',
  'els',
  'sipsungYear', 'sipsungMonth', 'sipsungHour',
  // ★v7.72-b 적대검증 관통 #3 — `currentYear`·`currentGanji` 를 편입한다.
  //   종전 주석은 「currentYear 는 클라이언트 벽시계 값이므로 서버가 재계산하면 안 된다」를
  //   근거로 둘 다 제외했다. 그 근거는 `currentYear` 에만 성립하고, **`currentGanji` 는
  //   `(year-4)%10 / (year-4)%12` 로 완전히 결정되는 파생 사실**이다(index.html:1142).
  //   즉 「벽시계 값」과 「벽시계 값에서 파생된 사실」을 구별하지 못해 후자가 함께
  //   화이트리스트 밖으로 밀려났고, 그 결과 `올해 세운: ${c.currentYear}년 ${c.currentGanji}`
  //   가 ⑴ 위조 세운 주입 ⑵ 무제한 자유 문자열 인젝션 표면으로 남아 있었다.
  //   ★`currentYear` 도 서버가 정한다 — KST 기준 현재 연도다. 벽시계는 서버도 안다.
  'currentYear', 'currentGanji',
  // ★v7.72-b 관통 #6 — 정규화한 값을 context 에 **되쓴다**. 종전에는 검사만 하고
  //   프롬프트는 원문 `${c.inputYear}` 를 보간해, `'\n\n\n1990'` 같은 값으로
  //   프롬프트 줄 구조를 깨뜨릴 수 있었다(관통 #4 수리의 원칙이 숫자 3키에 미적용).
  'inputYear', 'inputMonth', 'inputDay',
  // ★★v7.73-b 적대검증 E-1 — 음력 **윤달**. 계약 v7.73 §3 은 「윤달 체크박스 값은
  //   §2 의 leap1/leap2 **및 saju 의 isLeapMonth** 로 서버에 전달」이라 못박았는데,
  //   서버는 compat(`leap1`)만 읽고 saju(`isLeapMonth`)는 읽지 않았다. 그 결과
  //   윤달 출생 1,637건 중 1,627건(99.39%)에서 화면(윤달 원국)과 해석(평달 원국)이
  //   갈렸고, **서버값이 채택되므로 유료 사주 해석 본문 전체가 다른 사람의 것**이었다.
  //   ⟹ 이 키는 `inputYear/Month/Day` 와 동급의 **재계산 입력**이다. 같은 자격으로
  //     감시(400 판정)·정규화·되쓰기 대상에 넣는다. 감시 목록 밖에 두면 이 키만
  //     뒤집어 원국을 통째로 갈아치울 수 있는데 재유도는 성립하므로 400 도 안 난다.
  'isLeapMonth',
]);

/**
 * ★v7.72 관통 #2 — 「이 키가 왔는데 재계산이 안 됐으면 요청을 막는다」의 대상.
 *   `CTX_REPLACE_KEYS` 에 `hourLabel` 을 더한 집합이다.
 *   `hourLabel` 을 넣는 이유: 관통 #4 수리는 **applied 일 때만** 재작성하므로,
 *   applied=false 경로에서는 자유 문자열이 그대로 프롬프트에 보간된다.
 *   ⟹ 인젝션 표면이 「게이트를 끄면 되살아나는」 형태였다.
 */
const CTX_GUARDED_KEYS = Object.freeze(CTX_REPLACE_KEYS.concat(['hourLabel']));

/** 서버 산출 → context 키 매핑. CTX_REPLACE_KEYS 와 1:1 이어야 한다(SELF 검사 대상). */
const CTX_VALUE_OF = Object.freeze({
  yearPillar: (r) => r.pillarStrings.yearPillar,
  monthPillar: (r) => r.pillarStrings.monthPillar,
  dayPillar: (r) => r.pillarStrings.dayPillar,
  hourPillar: (r) => r.pillarStrings.hourPillar,
  ilgan: (r) => r.ilgan,
  ilganElement: (r) => r.ilganElement,
  ilganYinyang: (r) => r.ilganYinyang,
  yearStemYinyang: (r) => r.yearStemYinyang,
  sajuYear: (r) => r.sajuYear,
  isAdjusted: (r) => r.isAdjusted,
  els: (r) => r.els.slice(),
  sipsungYear: (r) => r.sipsung.year,
  sipsungMonth: (r) => r.sipsung.month,
  sipsungHour: (r) => r.sipsung.hour,
  // ★v7.72-b 관통 #3 — 세운은 서버가 정한다. 두 번째 인자는 정규화된 입력이다.
  currentYear: () => kstYear(),
  currentGanji: () => ganjiOf(kstYear()),
  // ★v7.72-b 관통 #6 — 정규화된 정수로 되쓴다.
  inputYear: (r, inp) => inp.y,
  inputMonth: (r, inp) => inp.m,
  inputDay: (r, inp) => inp.d,
  // ★v7.73-b E-1 — 정규화된 불리언으로 되쓴다. 양력이면 항상 false 다
  //   (index.html:2488·2813 이 `calType==='lunar'?…:false` 로 만드는 것과 동일 규약).
  isLeapMonth: (r, inp) => inp.isLeap,
});

/** 한글 60갑자 — index.html:1140~1142 `getGanji` 와 동일 규칙. */
const K_STEMS = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
const K_BRANCHES = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
function ganjiOf(y) {
  const n = ((y - 4) % 60 + 60) % 60;
  return K_STEMS[n % 10] + K_BRANCHES[n % 12];
}
/**
 * ★KST 기준 현재 연도. 서버(Vercel)는 UTC 로 도는데 제품은 한국 사용자 기준이므로,
 *   1월 1일 00:00~09:00 KST 구간에서 UTC 연도를 쓰면 세운이 한 해 밀린다.
 *   `Date` 를 쓰지만 여기서는 「지금이 언제인가」이므로 v7.71 의 `Date` 금지
 *   (날짜 산술에서 TZ 밀림이 났던 건) 대상이 아니다 — 산술이 아니라 현재 시각 판독이다.
 */
function kstYear() {
  return new Date(Date.now() + 9 * 3600 * 1000).getUTCFullYear();
}

/** context 를 재계산에 필요한 입력으로 환원한다. 실패하면 null. */
function inputFromContext(ctx) {
  if (!ctx || typeof ctx !== 'object') return null;
  // ★v7.71-b 적대적 검증 관통 #1 수리 (결정 81 재발이었다).
  //   종전에는 `Number.isInteger(ctx.inputYear)` 만 봤다. 클라이언트가
  //   `inputYear:"1990"`(문자열)을 보내면 null 이 되어 **재계산 전체가 스킵**됐고,
  //   위조 원국이 그대로 프롬프트에 들어갔다 — 무료 saju 는 토큰도 불필요하다.
  //   프롬프트 렌더링은 `${c.inputYear||''}년` 이라 문자열도 동일하게 보여 **흔적이 없었다**.
  //   ⟹ 「감시의 실행 여부가 감시 대상이 만든 값에 의존」 = 결정 81 위반.
  //   ⟹ 숫자로 **정규화한 뒤** 검사한다. 정규화 불가만 null 이다.
  const num = (v) => {
    if (typeof v === 'number') return Number.isInteger(v) ? v : null;
    if (typeof v === 'string' && /^\s*[+-]?\d+\s*$/.test(v)) return parseInt(v, 10);
    return null;                       // 배열·객체·불리언·NaN·실수·유니코드숫자 전부 거부
  };
  const y = num(ctx.inputYear), m = num(ctx.inputMonth), d = num(ctx.inputDay);
  if (y === null || m === null || d === null) return null;
  const birth = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  // 시진: hourLabel('자시'…'해시' | '시간 모름') 에서 역산.
  let hourIdx = null;
  if (typeof ctx.hourLabel === 'string') {
    const i = HOUR_LABELS.indexOf(ctx.hourLabel.trim());
    if (i !== -1) hourIdx = i;
  }
  const calType = ctx.calType === 'lunar' ? 'lunar' : 'solar';
  return {
    birth,
    calType,
    // ★★v7.73-b 적대검증 E-1 수리.
    //   종전에는 이 자리가 상수 false 였고, 근거 주석은 「클라이언트에 윤달 UI 가
    //   없다(index.html:1715)」였다.
    //   ★그 주석의 전제가 **같은 세션에 거짓이 됐다** — 관통 #10 수리로 윤달 UI 가
    //     신설됐고 index.html:2488(무료)·2813(유료)이 `isLeapMonth` 를 싣는다.
    //     과거의 근거 주석이 현재의 사실 확인을 대신한 사례다(v7.72 I-35 와 동형).
    //   ★compat 은 같은 세션에 `leap1` 을 정상 존중했다(아래 compatPersonInput).
    //     한쪽만 고쳐진 상태였다 — 계약 §3 이 두 파일에 걸친 항목이었기 때문이다.
    //   ★양력이면 윤달 개념이 없다. 클라이언트도 `calType==='lunar'?…:false` 로
    //     만들므로 **같은 규약**으로 정규화한다(판정 주체를 하나로 · v7.72 §2-A).
    isLeap: calType === 'lunar' && ctx.isLeapMonth === true,
    hourIdx,
    // ★v7.72-b 관통 #6 — 정규화된 정수를 그대로 내보내 context 되쓰기에 쓴다.
    y, m, d,
  };
}

const eq = (a, b) => {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => v === b[i]);
  return a === b;
};

/**
 * context 를 서버 재계산값으로 정제한다.
 *
 * ★부작용 없음 — 새 객체를 돌려준다. 호출부가 교체 여부를 정한다.
 *
 * @param {object} ctx  클라이언트가 보낸 context
 * @returns {{applied:boolean, context:object, metrics:object}}
 *   applied=false 면 `context` 는 입력과 동일 객체다(무변경 보장).
 */
function guardContext(ctx) {
  const metrics = {
    engine: 'ctxguard/v7.71',
    attempted: false,
    applied: false,
    reason: null,
    diffs: [],          // [{key, client, server}]
    notes: [],          // recompute 의 경계 flag
    mode: null,
  };

  const inp = inputFromContext(ctx);
  if (!inp) { metrics.reason = 'NO_BIRTH_FIELDS'; return { applied: false, context: ctx, metrics }; }
  metrics.attempted = true;
  // ★v7.73-b E-1 — `isLeap` 을 함께 실어야 `CTX_VALUE_OF.isLeapMonth` 가 되쓸 수 있다.
  const norm = { y: inp.y, m: inp.m, d: inp.d, isLeap: inp.isLeap };

  let r;
  try { r = RC.recompute(inp); } catch (e) { r = null; }
  if (!r) { metrics.reason = 'PARSE_REJECTED'; return { applied: false, context: ctx, metrics }; }
  if (!r.ok) { metrics.reason = r.reason || 'RECOMPUTE_FAILED'; return { applied: false, context: ctx, metrics }; }

  metrics.notes = Array.isArray(r.notes) ? r.notes.slice() : [];
  metrics.mode = r.mode;

  // 교체 — 화이트리스트 밖은 원본 그대로 복사한다.
  // ★v7.71-b 관통 #7 수리 — `out['__proto__'] = v` 는 setter 를 발화시켜
  //   프로토타입을 교체하고, 그 키는 own 이 아니게 되어 이후 Object.keys 기반
  //   감사·스크럽이 전부 놓친다. 프로토타입 없는 객체로 만들고 키도 건너뛴다.
  const out = Object.create(null);
  for (const k of Object.keys(ctx)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    out[k] = ctx[k];
  }
  // ★v7.71-b 관통 #4 부분 수리 — hourLabel 은 서버가 **재작성**한다.
  //   종전에는 파싱만 하고 클라이언트 원문을 프롬프트로 흘려보내
  //   자유 문자열 인젝션 표면이었다(`생년월일: … ${c.hourLabel}`).
  if ('hourLabel' in ctx) {
    const hi = inp.hourIdx;
    out.hourLabel = (hi === null) ? '시간 모름' : (HOUR_LABELS[hi] + '');
  }
  for (const k of CTX_REPLACE_KEYS) {
    const get = CTX_VALUE_OF[k];
    if (typeof get !== 'function') continue;          // 상수 불일치 시 조용히 건너뛰지 않도록 SELF 가 검사
    const sv = get(r, norm);
    if (k in ctx && !eq(ctx[k], sv)) {
      metrics.diffs.push({ key: k, client: ctx[k], server: sv });
    }
    out[k] = sv;
  }

  metrics.applied = true;
  metrics.diffCount = metrics.diffs.length;
  return { applied: true, context: out, metrics };
}

/**
 * ★v7.72 관통 #2 — 클라이언트가 감시 대상 키를 **하나라도** 보냈는가.
 *   own 속성만 본다(`in` 은 프로토타입 체인을 타므로 `{}` 만 보내도 `constructor`
 *   같은 키가 참이 되어 정상 요청을 막는 오탐이 난다).
 */
function hasGuardedKeys(ctx) {
  if (!ctx || typeof ctx !== 'object') return false;
  const has = Object.prototype.hasOwnProperty;
  for (const k of CTX_GUARDED_KEYS) if (has.call(ctx, k)) return true;
  return false;
}

/**
 * ★v7.72 관통 #2 — 「이 요청을 400 으로 막아야 하는가」의 **단일 판정점**.
 *
 *   막는다:   감시 대상 키가 왔는데 서버가 그것을 재유도하지 못했다.
 *             ⟹ 그 값이 맞는지 **원리적으로 알 수 없다**. 통과시키면 위조와
 *                구별이 불가능하다.
 *   막지 않는다: 재계산이 성립했고 값만 다르다(클라 버그 A·B·C·D) ⟹ 서버값 채택.
 *             감시 대상 키가 아예 안 왔다 ⟹ 위조할 것이 없다(품질만 저하).
 *
 *   ★결정 81 준수 확인 — 판정 입력은 ⑴ 서버가 계산한 `applied` ⑵ 「키의 존재
 *     여부」뿐이다. 클라이언트가 키를 숨기면 게이트가 아니라 **프롬프트 내용이**
 *     비므로, 숨겨서 얻는 이득이 없다(종전에는 게이트만 꺼지고 내용은 동일했다).
 *
 * @param {object} ctx 클라이언트가 보낸 원본 context
 * @param {{applied:boolean, metrics:object}|null} g guardContext 결과. null 이면
 *        가드 자체가 없었다는 뜻이다(모듈 삭제·로드 실패 = 관통 #5 계열).
 * @returns {{blocked:boolean, reason:string|null}}
 */
function unverifiable(ctx, g) {
  if (!hasGuardedKeys(ctx)) return { blocked: false, reason: null };
  if (g && g.applied === true) return { blocked: false, reason: null };
  const r = (g && g.metrics && g.metrics.reason) || (g ? 'GUARD_INCONCLUSIVE' : 'GUARD_MISSING');
  return { blocked: true, reason: r };
}

// ════════════════════════════════════════════════════════════════════════════
// ★★v7.73 관통 #4 — compat 3종(유료 2종 포함)이 가드 범위 밖이었다
// ════════════════════════════════════════════════════════════════════════════
// 【무엇이 뚫렸나 — v7.72 §4-2】
//   `CW_ENGINE_TYPES` 가 saju 3종뿐이라 `cwEng` 자체가 null 이 되어, compat 요청은
//   `guardContext` 도 `unverifiable` 도 **호출되지 않았다**. 그 결과
//     ⑴ 양측 위조 원국(`갑자 갑자 갑자 갑자`)
//     ⑵ `relType` 2회 보간을 통한 프롬프트 인젝션
//     ⑶ 자동 산출 점수 100
//   이 그대로 LLM 에 도달했다. `compat_premium_1/2` 는 각 ₩4,900 유료 상품이다.
//
// 【왜 saju 와 같은 방식으로 못 닫는가】
//   compat context 에는 `inputYear` 계열이 **아예 없어** 서버가 재유도할 수 없었다.
//   ⟹ v7.73 계약 §2 로 클라이언트가 12키(`cal1,y1,m1,d1,h1,leap1, cal2,…`)를 싣고,
//      서버가 `pillar1/pillar2/ilgan1/ilgan2` 를 재유도해 교체한다.
//
// 【★fail-closed 를 쓰지 않는 이유 — 결정 91 의 정량화】
//   compat 는 「12키가 없는 요청」(구버전 클라이언트·캐시된 페이지)을 **반드시**
//   통과시켜야 한다(계약 §2 · v7.72 관통 #8 의 재발 방지). 그런데 그 경로가 열려 있는
//   이상, 「12키가 왔는데 재유도 실패」를 400 으로 막아도 공격자는 **12키를 빼면**
//   그만이다. 즉 그 400 은 보안 이득이 0 이고 정상 사용자(음력 경계 등)만 막는다.
//   ⟹ compat 의 방어선은 차단이 아니라 **전 보간 키의 3분류 봉쇄**(결정 90)다:
//        ① 교체값       — 서버 재유도로 덮어쓴다        (pillar1·pillar2·ilgan1·ilgan2)
//        ② 열거 화이트리스트 — 벗어나면 기본값으로 무해화 (relType·gender·관계·합충·오행…)
//        ③ 정규화된 자유값 — 형상·길이로 정규화          (name1·name2)
//      셋 중 어디에도 자유 문자열이 남지 않으므로, 12키가 없어도 **인젝션 표면은 0** 이다.
//
// 【열거의 출처 — 추측 금지】
//   아래 상수는 전부 index.html 의 현행 소스에서 읽어 확정했다.
//     · `COMPAT_REL_TYPES`  (index.html:2382~2390)  — 7종 표시명
//     · `EL`                (index.html:1017)       — '목(木)' 처럼 한자 병기
//     · `HS_NAMES_FULL`·`EB_NAMES_FULL` (index.html:2251~2252)
//     · `compareCompatibility` (index.html:2258~)   — 관계·합충 문자열 생성식
//     · `analyzeCompat` 의 ctx 조립부 (index.html:2478~2503)
//   ★`_v773_work/probe_A/probe_compat_contract.js` 가 이 대응을 매번 기계 대조한다.
// ════════════════════════════════════════════════════════════════════════════

/** 관계 유형 7종 표시명 — 클라이언트는 `relName`(표시명)을 보낸다(index.html:2456·2480). */
const COMPAT_REL_TYPE_NAMES = Object.freeze([
  '예비부부·결혼', '연인', '썸·짝사랑', '친구', '동료·업무', '가족', '그냥 궁금',
]);
/** 관계 유형 키 7종 — `relTypeKey` 로 함께 온다(프롬프트 보간은 안 되지만 함께 닫는다). */
const COMPAT_REL_TYPE_KEYS = Object.freeze([
  'marriage', 'couple', 'crush', 'friend', 'work', 'family', 'general',
]);
/** ★벗어나면 400 이 아니라 기본값으로 강제 치환한다(계약 §2 — 차단보다 무해화). */
const COMPAT_REL_TYPE_DEFAULT = '연인';
const COMPAT_REL_KEY_DEFAULT = 'couple';

const EL_NAMES = Object.freeze(['목(木)', '화(火)', '토(土)', '금(金)', '수(水)']);
const HS_FULL = Object.freeze(['갑(甲)', '을(乙)', '병(丙)', '정(丁)', '무(戊)', '기(己)', '경(庚)', '신(辛)', '임(壬)', '계(癸)']);
const EB_FULL = Object.freeze(['자(子)', '축(丑)', '인(寅)', '묘(卯)', '진(辰)', '사(巳)', '오(午)', '미(未)', '신(申)', '유(酉)', '술(戌)', '해(亥)']);
const GENDER_NAMES = Object.freeze(['남성', '여성']);

/** 자동 산출 점수의 정의역 — index.html `compareCompatibility`: `Math.min(99, Math.max(55, …))`. */
const COMPAT_SCORE_MIN = 55;
const COMPAT_SCORE_MAX = 99;
/** 합충 목록의 최대 항목 수 — 4기둥 × 4기둥 = 16. */
const COMPAT_LIST_MAX_ITEMS = 16;

const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const reAlt = (arr) => '(?:' + arr.map(reEsc).join('|') + ')';

const RE_GANJI = '[갑을병정무기경신임계][자축인묘진사오미신유술해]';
/** `"갑자 을축 병인 정묘"` · 시주 미상이면 4번째가 `(시간 모름)` (index.html analyzeCompat). */
const RE_PILLAR4 = new RegExp('^' + RE_GANJI + ' ' + RE_GANJI + ' ' + RE_GANJI + ' (?:' + RE_GANJI + '|\\(시간 모름\\))$');
/** 같은 형식의 **분해용** — `(시간 모름)` 에 공백이 있으므로 split 이 아니라 이것으로 자른다. */
const RE_PILLAR4_PARTS = new RegExp('^(' + RE_GANJI + ') (' + RE_GANJI + ') (' + RE_GANJI + ') (' + RE_GANJI + '|\\(시간 모름\\))$');
/** `"戊(양토(土))"` — 한자 일간 + 괄호 안 음양·오행(한자 병기). */
const RE_ILGAN = new RegExp('^[甲乙丙丁戊己庚辛壬癸]\\((?:음|양)' + reAlt(EL_NAMES) + '\\)$');
/** `"목(木)4 화(火)2 토(土)3 금(金)3 수(水)4"` — EL 순서 고정 + 0~16. */
const RE_ELS_COMBINED = new RegExp('^' + EL_NAMES.map((e) => reEsc(e) + '\\d{1,2}').join(' ') + '$');
/** 합충해 항목 — 어휘가 닫힌 집합이므로 자유 문자열이 끼어들 수 없다. */
const RE_HS_HAB_ITEM = new RegExp('^' + reAlt(HS_FULL) + '\\+' + reAlt(HS_FULL) + '→' + reAlt(EL_NAMES) + '$');
const RE_HS_CHUNG_ITEM = new RegExp('^' + reAlt(HS_FULL) + '↔' + reAlt(HS_FULL) + '$');
const RE_EB_HAB_ITEM = new RegExp('^' + reAlt(EB_FULL) + '\\+' + reAlt(EB_FULL) + '→' + reAlt(EL_NAMES) + '$');
const RE_EB_CHUNG_ITEM = new RegExp('^' + reAlt(EB_FULL) + '↔' + reAlt(EB_FULL) + '$');
const RE_EB_HAE_ITEM = new RegExp('^' + reAlt(EB_FULL) + '-' + reAlt(EB_FULL) + '$');

/** 일간 관계 — index.html `compareCompatibility` 의 생성식 전개(전 58종). */
const ILGAN_RELATIONS = (() => {
  const s = new Set(['무관', '상충(相沖)', '동일(同氣)']);
  for (const e of EL_NAMES) s.add('합화(合化) ' + e);
  for (const a of EL_NAMES) for (const b of EL_NAMES) {
    s.add('상생: ' + a + '이 ' + b + '을 도움');
    s.add('상극: ' + a + '이 ' + b + '을 극함');
  }
  return s;
})();
/** 일지 관계 — 전 7종. */
const ILJI_RELATIONS = (() => {
  const s = new Set(['무관', '육충(六沖)']);
  for (const e of EL_NAMES) s.add('육합(六合) → ' + e);
  return s;
})();

/**
 * ★compat 프롬프트가 보간하는 context 키 — **기계 열거 결과**(결정 90).
 *   `api/fortune.js` 의 `compat`·`compat_premium_1`·`compat_premium_2` 세 분기에서
 *   `${c.KEY}` 를 전수 추출한 합집합 20키다. `relTypeKey` 는 보간되지 않지만
 *   같은 성질이므로 함께 닫는다(21).
 *   ★probe_A/probe_compat_surface.js 가 fortune.js 소스에서 재추출해 이 목록과
 *     대조한다 — 프롬프트에 키가 추가되면 게이트가 즉시 어긋남을 알린다.
 */
const COMPAT_PROMPT_KEYS = Object.freeze([
  'relType', 'name1', 'name2', 'gender1', 'gender2',
  'pillar1', 'pillar2', 'ilgan1', 'ilgan2',
  'ilganRelation', 'iljiRelation',
  'hsHabs', 'hsChungs', 'ebHabs', 'ebChungs', 'ebHaes',
  'elsCombined', 'lacking', 'excess', 'autoScore',
]);
const COMPAT_GUARDED_KEYS = Object.freeze(COMPAT_PROMPT_KEYS.concat(['relTypeKey']));
/** ★서버가 재유도해 **교체**하는 키(계약 §2). */
const COMPAT_REPLACE_KEYS = Object.freeze(['pillar1', 'pillar2', 'ilgan1', 'ilgan2']);
/** 클라이언트가 실어야 하는 신규 12키(계약 §2). 사람별 6키 × 2. */
const COMPAT_BIRTH_KEYS = Object.freeze([
  'cal1', 'y1', 'm1', 'd1', 'h1', 'leap1',
  'cal2', 'y2', 'm2', 'd2', 'h2', 'leap2',
]);

/**
 * ★기둥 4개의 **구조 정합** 검사 — 생년월일 없이도 확인할 수 있는 명리 산술 제약.
 *
 * 형상(정규식)만 보면 `갑자 갑자 갑자 갑자` 처럼 **실재할 수 없는 원국**이 통과한다.
 * (v7.72 §4-2 관통 #4 의 위조 payload 가 정확히 그것이었다.) 그러나 4기둥에는
 * 생년월일과 무관하게 성립하는 세 가지 제약이 있다:
 *   ① 60갑자 조합    — 천간·지지 인덱스의 **홀짝이 같아야** 한다(갑축·을자 등은 없다)
 *   ② 五虎遁         — 월간은 **연간과 월지로 완전히 결정**된다
 *   ③ 五鼠遁         — 시간은 **일간과 시지로 완전히 결정**된다
 * 클라이언트도 같은 규칙으로 만들므로(index.html `calcMonthStem`·`calcHourStem`)
 * 정상값은 전건 통과하고(오탐 0 — probe_availability V-2 가 3,000건으로 실측),
 * 손으로 지어낸 원국은 대부분 여기서 걸린다.
 * ★이것은 「그 사람의 사주인가」를 보증하지 않는다. 그 축은 신규 12키 재유도가 담당한다.
 */
function pillarsStructurallyValid(s) {
  // ★`(시간 모름)` 안에 공백이 있으므로 split(' ') 로 자르면 5조각이 된다 —
  //   반드시 형식 정규식으로 분해한다(초기 구현의 실측 오탐 13.9% 원인).
  const m = RE_PILLAR4_PARTS.exec(s);
  if (!m) return false;
  const toks = [m[1], m[2], m[3], m[4]];
  const idx = [];
  for (let i = 0; i < 4; i++) {
    if (i === 3 && toks[3] === '(시간 모름)') { idx.push(null); break; }
    const st = K_STEMS.indexOf(toks[i][0]), br = K_BRANCHES.indexOf(toks[i][1]);
    if (st === -1 || br === -1) return false;
    if ((st % 2) !== (br % 2)) return false;                       // ① 60갑자 조합
    idx.push({ st, br });
  }
  const y = idx[0], mo = idx[1], d = idx[2], h = idx[3];
  if (!y || !mo || !d) return false;
  const expectMonthStem = ([2, 4, 6, 8, 0][y.st % 5] + ((mo.br - 2 + 12) % 12)) % 10;   // ② 五虎遁
  if (mo.st !== expectMonthStem) return false;
  if (h) {
    const expectHourStem = ([0, 2, 4, 6, 8][d.st % 5] + h.br) % 10;                      // ③ 五鼠遁
    if (h.st !== expectHourStem) return false;
  }
  return true;
}
const normPillar4 = (v) => (typeof v === 'string' && RE_PILLAR4.test(v) && pillarsStructurallyValid(v) ? v : '');

/**
 * 이름 형상 정규화 — fortune.js `cwNormName` 과 **동일 규약**이어야 한다.
 * ★v7.73-b E-6 — 종전 규약(제어문자·개행 제거 + 40자)은 「단일 행 지시문」을 통과시켰다.
 *   이름의 **문자 집합과 토큰 구조**로 바꾼다. 규격 밖은 400 이 아니라 '' 로 무해화하고,
 *   프롬프트는 기존 기본값(`${c.name1||'A'}`)으로 떨어진다.
 * ★두 벌이 갈리면 「1층만 살아 있을 때 다른 값」이 되므로,
 *   `probe_A2/probe_name_surface.js` 가 두 구현을 **같은 코퍼스로 대조**한다.
 */
const NAME_DROP_RE = /[^A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ々〆\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF·'\u2019\-. ]/g;
const NAME_MAX = 20;
const NAME_TOKENS_MAX = 2;
const NAME_TOKEN_MAX = 12;
function normNameLike(v) {
  if (typeof v !== 'string') return '';
  let t = v.replace(/[\u0000-\u001F\u007F\u00A0\u2028\u2029\s]+/g, ' ');
  t = t.replace(NAME_DROP_RE, '');
  t = t.trim();
  if (t.length > NAME_MAX) t = t.slice(0, NAME_MAX);   // ★토큰 분해보다 먼저
  const toks = t.split(' ').filter(Boolean).slice(0, NAME_TOKENS_MAX)
    .map((x) => (x.length > NAME_TOKEN_MAX ? x.slice(0, NAME_TOKEN_MAX) : x));
  return toks.join(' ');
}

/** `', '` 로 이어진 목록의 항목 전건이 닫힌 어휘에 속하는가. 아니면 null. */
function normJoinedList(v, itemRe, fallback) {
  if (typeof v !== 'string') return fallback;
  if (v === '없음') return '없음';
  const items = v.split(', ');
  if (items.length === 0 || items.length > COMPAT_LIST_MAX_ITEMS) return fallback;
  for (const it of items) if (!itemRe.test(it)) return fallback;
  return v;
}

/** 오행 이름 목록(부족·과한 오행). 중복·미등재는 거부. */
function normElementList(v) {
  if (typeof v !== 'string') return '없음';
  if (v === '없음') return '없음';
  const items = v.split(', ');
  if (items.length > EL_NAMES.length) return '없음';
  const seen = new Set();
  for (const it of items) {
    if (EL_NAMES.indexOf(it) === -1 || seen.has(it)) return '없음';
    seen.add(it);
  }
  return v;
}

/**
 * ★compat context 의 **모든 프롬프트 보간 키**를 3분류로 닫는다.
 *   반환값은 「그 키의 확정값」이다. 원본이 규격을 벗어나면 무해한 기본값으로 바뀐다.
 *   ★여기서 `undefined` 를 돌려주면 「그 키는 손대지 않는다」는 뜻이다(키 부재 시).
 */
const COMPAT_NORMALIZE = Object.freeze({
  // ② 열거 화이트리스트
  relType: (v) => (COMPAT_REL_TYPE_NAMES.indexOf(v) !== -1 ? v : COMPAT_REL_TYPE_DEFAULT),
  relTypeKey: (v) => (COMPAT_REL_TYPE_KEYS.indexOf(v) !== -1 ? v : COMPAT_REL_KEY_DEFAULT),
  gender1: (v) => (GENDER_NAMES.indexOf(v) !== -1 ? v : ''),
  gender2: (v) => (GENDER_NAMES.indexOf(v) !== -1 ? v : ''),
  ilganRelation: (v) => (typeof v === 'string' && ILGAN_RELATIONS.has(v) ? v : '무관'),
  iljiRelation: (v) => (typeof v === 'string' && ILJI_RELATIONS.has(v) ? v : '무관'),
  hsHabs: (v) => normJoinedList(v, RE_HS_HAB_ITEM, '없음'),
  hsChungs: (v) => normJoinedList(v, RE_HS_CHUNG_ITEM, '없음'),
  ebHabs: (v) => normJoinedList(v, RE_EB_HAB_ITEM, '없음'),
  ebChungs: (v) => normJoinedList(v, RE_EB_CHUNG_ITEM, '없음'),
  ebHaes: (v) => normJoinedList(v, RE_EB_HAE_ITEM, '없음'),
  elsCombined: (v) => (typeof v === 'string' && RE_ELS_COMBINED.test(v) ? v : ''),
  lacking: (v) => normElementList(v),
  excess: (v) => normElementList(v),
  // ★자동 산출 점수 — 정의역 밖(예: 위조 100)은 **채택하지 않는다**.
  //   99 로 clamp 하면 공격자의 목적(만점)을 거의 그대로 내주므로 clamp 가 아니라 폐기다.
  autoScore: (v) => {
    const n = (typeof v === 'number') ? v
      : (typeof v === 'string' && /^\s*[+-]?\d+\s*$/.test(v)) ? parseInt(v, 10) : null;
    if (n === null || !Number.isInteger(n)) return '';
    return (n >= COMPAT_SCORE_MIN && n <= COMPAT_SCORE_MAX) ? n : '';
  },
  // ① 교체 대상이지만, 12키가 없으면 최소한 **형상 + 구조 정합**은 강제한다(하위호환 경로).
  pillar1: normPillar4,
  pillar2: normPillar4,
  ilgan1: (v) => (typeof v === 'string' && RE_ILGAN.test(v) ? v : ''),
  ilgan2: (v) => (typeof v === 'string' && RE_ILGAN.test(v) ? v : ''),
  // ③ 정규화된 자유값
  name1: (v) => normNameLike(v),
  name2: (v) => normNameLike(v),
});

/** 정수 정규화 — guardContext 의 `num` 과 같은 규약(문자열 정수 허용). */
function numOrNull(v) {
  if (typeof v === 'number') return Number.isInteger(v) ? v : null;
  if (typeof v === 'string' && /^\s*[+-]?\d+\s*$/.test(v)) return parseInt(v, 10);
  return null;
}

/**
 * 계약 §2 의 신규 6키(사람 1명분)를 recompute 입력으로 환원한다.
 * @returns {{input:object}|{missing:true}|{bad:string}}
 *   `missing` = 키가 안 왔다(구버전 클라이언트 · **정상 처리 대상**)
 *   `bad`     = 키는 왔는데 값이 규격 밖이다
 */
function compatPersonInput(ctx, i) {
  const has = Object.prototype.hasOwnProperty;
  const kY = 'y' + i, kM = 'm' + i, kD = 'd' + i, kC = 'cal' + i, kH = 'h' + i, kL = 'leap' + i;
  const any = has.call(ctx, kY) || has.call(ctx, kM) || has.call(ctx, kD);
  if (!any) return { missing: true };
  const y = numOrNull(ctx[kY]), m = numOrNull(ctx[kM]), d = numOrNull(ctx[kD]);
  if (y === null || m === null || d === null) return { bad: 'BIRTH_NOT_INTEGER' };
  if (m < 1 || m > 12 || d < 1 || d > 31) return { bad: 'BIRTH_OUT_OF_RANGE' };
  const h = numOrNull(ctx[kH]);
  return {
    input: {
      birth: `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      calType: ctx[kC] === 'lunar' ? 'lunar' : 'solar',
      isLeap: ctx[kL] === true,
      hourIdx: (h !== null && h >= 0 && h <= 11) ? h : null,
    },
  };
}

/**
 * ★v7.73-b E-5 — 하위호환(12키 **미전송**) 요청의 원국을 폐기할 것인가.
 *
 * 【지금 못 켜는 이유 — 원리적 한계이지 미봉책이 아니다】
 *   12키가 아예 없는 요청에서는 「정상 구버전 클라이언트가 보낸 진짜 원국」과
 *   「공격자가 심은 남의 진짜 원국」이 **바이트 수준에서 구별 불가능**하다.
 *   (E 자신의 프로브가 그 증거다 — `A-3`(위조 원국은 도달하면 안 된다)과
 *    `A-8`(정상 원국은 도달해야 한다)이 **같은 형상의 legacy 요청**이라 동시에
 *    만족시킬 수 없다. 서버가 볼 수 있는 입력에 차이가 없다.)
 *   ⟹ 이 축은 「검증」으로 닫을 수 없고 **12키가 오는 것**으로만 닫힌다.
 *
 * 【전환 조건 — 정량】
 *   B 배포 후 서버 로그의 `[cw:ctxguard] … "mode":"legacy"` 비율이 0 으로 수렴하면
 *   (= 캐시된 구버전 페이지가 사라지면) `CW_COMPAT_STRICT=1` 로 켠다. 그때의
 *   가용성 대가는 0 이고, 켜는 순간 legacy 위조 경로가 함께 닫힌다.
 *   ★코드 변경이 아니라 환경변수 1개로 전환되도록 **지금 구현해 둔다** —
 *     다음 세션이 「구현부터 다시」 하지 않게 하기 위한 것이다.
 */
function compatStrictLegacy() {
  return process.env.CW_COMPAT_STRICT === '1';
}

/**
 * ★compat 계열 context 가드 — 관통 #4 의 단일 판정점.
 *
 * @param {object} ctx 클라이언트가 보낸 context
 * @returns {{applied:boolean, context:object, metrics:object}}
 *   `applied` 는 「정규화를 수행했다」는 뜻이다. **차단 판정에는 쓰지 않는다** —
 *   compat 는 어떤 경우에도 400 을 내지 않는다(위 fail-closed 주석 참조).
 */
function guardCompatContext(ctx) {
  const metrics = {
    engine: 'ctxguard/v7.73-compat',
    applied: false,
    mode: null,              // 'derived' | 'partial' | 'legacy'
    derived: { p1: false, p2: false },
    reasons: { p1: null, p2: null },
    coerced: [],             // 규격 밖이라 기본값으로 바꾼 키
    diffs: [],               // 재유도 결과가 클라이언트 값과 달랐던 키
    replaced: [],
    discarded: [],           // ★E-5 — 「주장했으나 검증 불가」라 폐기한 키
    strictLegacy: false,
  };
  if (!ctx || typeof ctx !== 'object' || Array.isArray(ctx)) {
    metrics.mode = 'legacy';
    return { applied: false, context: ctx, metrics };
  }

  const has = Object.prototype.hasOwnProperty;
  const out = Object.create(null);
  for (const k of Object.keys(ctx)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    out[k] = ctx[k];
  }

  // ── ② ③ 전 보간 키 정규화 (12키 유무와 무관하게 **항상** 수행) ──────────
  for (const k of COMPAT_GUARDED_KEYS) {
    if (!has.call(ctx, k)) continue;
    const f = COMPAT_NORMALIZE[k];
    if (typeof f !== 'function') continue;     // selfCheck 가 정합을 못박는다
    const nv = f(ctx[k]);
    if (nv !== ctx[k]) metrics.coerced.push(k);
    out[k] = nv;
  }

  // ── ① 신규 12키로 pillar/ilgan 재유도 ────────────────────────────────────
  const strictLegacy = compatStrictLegacy();
  let derivedAny = false, missingAny = false;
  for (const i of [1, 2]) {
    const pk = 'p' + i;
    const kPil = 'pillar' + i, kIlg = 'ilgan' + i;
    const got = compatPersonInput(ctx, i);

    // ── ⓐ 생년월일을 **주장하지 않았다**(구버전 클라이언트) ────────────────
    //   계약 §2 의 하위호환 요구 대상이다. 서버는 검증할 대상 자체가 없다.
    //   ★기본값은 통과(형상 + 구조 정합만 강제). `CW_COMPAT_STRICT=1` 이면 폐기한다 —
    //     B 배포 후 로그의 `mode:legacy` 비율이 0 으로 수렴하면 그때 켠다(아래 주석).
    if (got.missing) {
      missingAny = true;
      metrics.reasons[pk] = 'NO_BIRTH_KEYS';
      if (strictLegacy) { out[kPil] = ''; out[kIlg] = ''; metrics.discarded.push(kPil, kIlg); }
      continue;
    }

    // ── ⓑ 생년월일을 **주장했다** ─────────────────────────────────────────
    //   ★★v7.73-b 적대검증 E-5 수리 — 종전에는 여기서 `continue` 해서, 재유도가
    //     실패하면 클라이언트가 보낸 `pillar_i`/`ilgan_i` 가 **형상 + 구조 정합만
    //     통과하면 그대로 채택**됐다. `y1:1899` 한 값으로 재유도만 죽이면 위조 원국이
    //     유료 2종 포함 3/3 도달했다(E 실측).
    //   ⟹ 이것은 v7.72 관통 #2 와 **같은 형태**다 — 「재계산 불가」가 통과로 귀결됐다.
    //     v7.72 §3-1 은 그 형태를 400 CONTEXT_UNVERIFIABLE 로 닫았다.
    //   ★compat 에서 400 을 쓰지 않는 이유(결정 91 · 정량화는 A2 보고 §실측):
    //     ⑴ 계약 §2 가 12키 없는 요청의 통과를 못박으므로 400 을 내도 공격자는
    //        12키를 빼면 그만이다 — 차단의 보안 이득이 작다.
    //     ⑵ 그런데 「주장했는데 검증 불가」인 값을 **채택할 근거는 0** 이다.
    //   ⟹ 차단(400)이 아니라 **폐기**로 닫는다. 프롬프트는 `${c.pillar1||''}` 라
    //     문장이 깨지지 않고, HTTP 차단률은 0% 그대로다(가용성 대가 = 그 요청의
    //     원국 4키 소실이며, 정상 사용자는 애초에 재유도가 성립한다).
    let reason = null, r = null;
    if (got.bad) reason = got.bad;
    else {
      try { r = RC.recompute(got.input); } catch (e) { r = null; }
      if (!r) reason = 'PARSE_REJECTED';
      else if (!r.ok) reason = r.reason || 'RECOMPUTE_FAILED';
    }
    let line = null, ilgan = null;
    if (!reason) {
      line = RC.compatPillarLine(r);
      ilgan = RC.compatIlganLabel(r);
      if (!line || !ilgan) reason = 'RENDER_FAILED';
    }
    if (reason) {
      metrics.reasons[pk] = reason;
      out[kPil] = '';
      out[kIlg] = '';
      metrics.discarded.push(kPil, kIlg);
      continue;
    }
    if (has.call(ctx, kPil) && ctx[kPil] !== line) metrics.diffs.push(kPil);
    if (has.call(ctx, kIlg) && ctx[kIlg] !== ilgan) metrics.diffs.push(kIlg);
    out[kPil] = line;
    out[kIlg] = ilgan;
    metrics.replaced.push(kPil, kIlg);
    metrics.derived[pk] = true;
    derivedAny = true;
  }

  metrics.mode = (metrics.derived.p1 && metrics.derived.p2) ? 'derived'
    : (derivedAny ? 'partial' : (missingAny ? 'legacy' : 'undeducible'));
  metrics.applied = true;
  metrics.strictLegacy = strictLegacy;
  metrics.coercedCount = metrics.coerced.length;
  return { applied: true, context: out, metrics };
}

/**
 * ★자기검사 — 상수 정합. 게이트와 별개로 런타임에서도 확인 가능하게 둔다.
 *   CTX_REPLACE_KEYS 와 CTX_VALUE_OF 의 키 집합이 어긋나면 교체가 조용히
 *   빠지므로(= 감시 구멍), 즉시 드러나야 한다.
 *
 * ★v7.72 관통 #6 수리 — 종전에는 정의·export 만 돼 있고 **호출하는 코드가
 *   리포 전체에 없었다.** 모듈 로드 시점에 1회 실행하고, 어긋나면 즉시 throw 한다.
 *   throw 하면 `cwEngine()` 이 null 을 돌려주고, 그러면 관통 #2 수리에 의해
 *   감시 대상 키가 온 요청이 400 으로 막힌다 ⟹ **정합 붕괴가 fail-closed 로 귀결**된다.
 */
function selfCheck() {
  const a = CTX_REPLACE_KEYS.slice().sort();
  const b = Object.keys(CTX_VALUE_OF).sort();
  const ok = a.length === b.length && a.every((k, i) => k === b[i]);
  // CTX_GUARDED_KEYS 는 REPLACE 를 진부분집합으로 포함해야 한다.
  const covers = CTX_REPLACE_KEYS.every((k) => CTX_GUARDED_KEYS.indexOf(k) !== -1);
  // ★v7.73 — compat 상수 정합. 「감시 목록에 있는데 정규화기가 없는 키」가 생기면
  //   그 키는 조용히 무검증으로 프롬프트에 들어간다(= 관통 #4 의 재발). 즉시 드러낸다.
  const compatUncovered = COMPAT_GUARDED_KEYS.filter((k) => typeof COMPAT_NORMALIZE[k] !== 'function');
  const compatOrphan = Object.keys(COMPAT_NORMALIZE).filter((k) => COMPAT_GUARDED_KEYS.indexOf(k) === -1);
  const compatReplaceIn = COMPAT_REPLACE_KEYS.every((k) => COMPAT_PROMPT_KEYS.indexOf(k) !== -1);
  const compatBirthOk = COMPAT_BIRTH_KEYS.length === 12;
  const compatOk = compatUncovered.length === 0 && compatOrphan.length === 0 && compatReplaceIn && compatBirthOk;
  return {
    ok: ok && covers && compatOk,
    replaceKeys: a, valueKeys: b, guardedKeys: CTX_GUARDED_KEYS.slice(),
    compatOk, compatUncovered, compatOrphan,
    compatGuardedKeys: COMPAT_GUARDED_KEYS.slice(), compatReplaceKeys: COMPAT_REPLACE_KEYS.slice(),
  };
}

// ★로드 시점 자기검사 — 상수가 어긋난 채로 서비스되지 않게 한다.
{
  const sc = selfCheck();
  if (!sc.ok) {
    throw new Error('[ctxguard] selfCheck failed: CTX_REPLACE_KEYS/CTX_VALUE_OF/CTX_GUARDED_KEYS mismatch');
  }
}

// ══════════════════════════════════════════════════════════════════════════
// ★★v7.75 관통 #9 (1층) — `tojeong` 원국 서버 재유도
// ══════════════════════════════════════════════════════════════════════════
//   【먼저 정정 — I-60】 v7.73·v7.74 인수인계는 「토정은 서버 재계산 대상 밖이라
//     화면과 해석이 함께 틀린다」고 적었으나 **값은 현재 옳다**(양력 전수 50,736건에서
//     클라 산출 == 서버 엔진 · 불일치 0). I-46 은 v7.73 관통 #7 반입으로 이미 해소됐다.
//     ⟹ 결정 94 재현. 진짜 결함은 「틀림」이 아니라 **「아무도 검증하지 않음」**이다.
//
//   【무엇을 닫는가】 종전 tojeong payload 에는 **생년월일 원본이 없었다** —
//     클라가 이미 변환한 `lunarYear/lunarMonth/lunarDay` 와 괘 이름만 왔다.
//     그래서 서버는 재유도할 재료조차 없었다(재유도 키 0/15).
//   ⟹ compat 12키와 같은 설계로 **5키(`cal`·`y`·`m`·`d`·`leap`)** 를 받아
//     음력·띠·간지·상중하괘를 **서버가 다시 만들어 교체**한다.
//
//   【정책 — 결정 88·E-5】
//     · 5키가 **없으면**(구버전 캐시) `mode:'legacy'` — 차단하지 않고 아무것도 바꾸지 않는다.
//       위조와 정상을 바이트로 구별할 수 없는 축이라 「검증」으로 닫을 수 없다(compat 과 동일).
//     · 5키가 **왔는데 재유도에 실패**하면 파생 12키를 **폐기**한다(빈 문자열).
//       「검증 불가 시 클라값 채택」은 v7.73 M16 이 적발한 회귀 경로다 — 반복하지 않는다.
//     · tojeong 은 **400 을 내지 않는다**(관통 #8 재발 방지 · 가용성).
const LN = require('./lunar.js');

const TJ_PALGUA = ['건(乾)☰', '태(兌)☱', '리(離)☲', '진(震)☳', '손(巽)☴', '감(坎)☵', '간(艮)☶', '곤(坤)☷'];
const TJ_YUKGUA = ['건(乾)☰', '태(兌)☱', '리(離)☲', '진(震)☳', '손(巽)☴', '감(坎)☵'];
const TJ_HAGUA = ['상(上)', '중(中)', '하(下)'];
const TJ_CHEONGAN = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
const TJ_JIJI = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
const TJ_ZODIAC = [
  { n: '쥐', h: '子' }, { n: '소', h: '丑' }, { n: '호랑이', h: '寅' }, { n: '토끼', h: '卯' },
  { n: '용', h: '辰' }, { n: '뱀', h: '巳' }, { n: '말', h: '午' }, { n: '양', h: '未' },
  { n: '원숭이', h: '申' }, { n: '닭', h: '酉' }, { n: '개', h: '戌' }, { n: '돼지', h: '亥' },
];
/** 서버가 다시 만들어 **교체**하는 키. 재유도 실패 시 이 키들을 폐기한다. */
const TOJEONG_REPLACE_KEYS = ['lunarYear', 'lunarMonth', 'lunarDay', 'zodiac', 'ganjiYear',
  'upperGua', 'taeseNum', 'middleGua', 'wolNum', 'lowerGua', 'ilNum', 'guaCombination'];
/** 클라이언트가 새로 실어야 하는 생년월일 원본 키 (계약). */
const TOJEONG_BIRTH_KEYS = ['cal', 'y', 'm', 'd', 'leap'];
const TOJEONG_YEAR_MIN = 1900, TOJEONG_YEAR_MAX = 2100;

/** 5키 판독. `{missing:true}` | `{bad:CODE}` | `{input:{...}}` */
function tojeongBirthInput(ctx) {
  const has = Object.prototype.hasOwnProperty;
  const any = has.call(ctx, 'y') || has.call(ctx, 'm') || has.call(ctx, 'd');
  if (!any) return { missing: true };
  const y = numOrNull(ctx.y), m = numOrNull(ctx.m), d = numOrNull(ctx.d);
  if (y === null || m === null || d === null) return { bad: 'BIRTH_NOT_INTEGER' };
  if (m < 1 || m > 12 || d < 1 || d > 31) return { bad: 'BIRTH_OUT_OF_RANGE' };
  if (y < TOJEONG_YEAR_MIN || y > TOJEONG_YEAR_MAX) return { bad: 'BIRTH_OUT_OF_RANGE' };
  return { input: { cal: ctx.cal === 'lunar' ? 'lunar' : 'solar', y, m, d, leap: ctx.leap === true } };
}

/** 상중하괘·띠·간지 재산출. 실패하면 null (판정 불가는 「클라값 채택」이 아니다). */
function tojeongDerive(inp, targetYear) {
  const ty = numOrNull(targetYear);
  if (ty === null || ty < TOJEONG_YEAR_MIN || ty > TOJEONG_YEAR_MAX) return null;
  let lunar = null;
  if (inp.cal === 'solar') {
    lunar = LN.solarToLunar(inp.y, inp.m, inp.d);
    if (!lunar) return null;
  } else {
    // 입력이 이미 음력이면 **실재하는 날짜인지** 양력 왕복으로 검증한다(클라와 같은 성질).
    if (!LN.lunarToSolar(inp.y, inp.m, inp.d, inp.leap)) return null;
    lunar = { year: inp.y, month: inp.m, day: inp.d, isLeap: inp.leap };
  }
  const ci = (ty - 4) % 10, ji = (ty - 4) % 12;
  const taeseNum = (ci + 1) + (ji + 1);
  const upper = TJ_PALGUA[(taeseNum % 8 || 8) - 1];
  const middle = TJ_YUKGUA[(lunar.month % 6 || 6) - 1];
  const lower = TJ_HAGUA[(lunar.day % 3 || 3) - 1];
  const z = TJ_ZODIAC[(lunar.year - 4) % 12];
  return {
    lunarYear: lunar.year, lunarMonth: lunar.month, lunarDay: lunar.day,
    zodiac: z.n + '띠(' + z.h + ')',
    ganjiYear: TJ_CHEONGAN[ci] + TJ_JIJI[ji] + '년',
    upperGua: upper, taeseNum,
    middleGua: middle, wolNum: lunar.month,
    lowerGua: lower, ilNum: lunar.day,
    guaCombination: upper + ' · ' + middle + ' · ' + lower,
  };
}

/**
 * ★tojeong 계열 context 가드 — 관통 #9 의 단일 판정점.
 * @returns {{applied:boolean, context:object, metrics:object}}
 *   ★`applied` 는 「정규화를 수행했다」는 뜻이며 **차단 판정에 쓰지 않는다**.
 */
function guardTojeongContext(ctx) {
  const metrics = {
    engine: 'ctxguard/v7.75-tojeong',
    applied: false,
    mode: null,          // 'derived' | 'legacy' | 'discarded'
    reason: null,
    diffs: [],           // 클라값 != 서버 재유도값 인 키 (관측용 — 조용한 갈림의 유일한 신호)
    replaced: 0,
    discarded: 0,
  };
  if (!ctx || typeof ctx !== 'object' || Array.isArray(ctx)) return { applied: false, context: ctx, metrics };
  const out = Object.assign({}, ctx);

  const got = tojeongBirthInput(ctx);
  if (got.missing) {
    metrics.applied = true; metrics.mode = 'legacy'; metrics.reason = 'NO_BIRTH_KEYS';
    return { applied: true, context: out, metrics };
  }
  if (got.bad) {
    // 5키를 **주장했는데** 형식이 틀렸다 ⟹ 클라값을 믿을 근거가 없다. 파생 키를 폐기한다.
    for (const k of TOJEONG_REPLACE_KEYS) {
      if (Object.prototype.hasOwnProperty.call(out, k)) { out[k] = ''; metrics.discarded++; }
    }
    metrics.applied = true; metrics.mode = 'discarded'; metrics.reason = got.bad;
    return { applied: true, context: out, metrics };
  }

  const derived = tojeongDerive(got.input, ctx.targetYear);
  if (!derived) {
    for (const k of TOJEONG_REPLACE_KEYS) {
      if (Object.prototype.hasOwnProperty.call(out, k)) { out[k] = ''; metrics.discarded++; }
    }
    metrics.applied = true; metrics.mode = 'discarded'; metrics.reason = 'DERIVE_FAILED';
    return { applied: true, context: out, metrics };
  }

  for (const k of TOJEONG_REPLACE_KEYS) {
    const before = Object.prototype.hasOwnProperty.call(out, k) ? out[k] : undefined;
    const after = derived[k];
    if (before !== undefined && String(before) !== String(after)) metrics.diffs.push(k);
    out[k] = after;
    metrics.replaced++;
  }
  metrics.applied = true; metrics.mode = 'derived';
  return { applied: true, context: out, metrics };
}

// ══════════════════════════════════════════════════════════════════════════
// ★★v7.79 파 ⓐ — `naming`(3)·`naming_nickname`·`tarot`(3) 원국 서버 재유도
// ══════════════════════════════════════════════════════════════════════════
//   【무엇을 닫는가 — 계약 v7.79 §0】 `saju`·`compat`·`tojeong` 밖 상품은 **클라가
//     산출한 원국을 서버가 무검증으로 프롬프트에 보간**한다. v7.78 실측 54/137.
//     이번 파는 그중 UI 가 생년월일을 직접 받는 7종을 닫는다(계약 §9 파 ⓐ).
//
//   【설계 — 새로 만들지 않는다】 v7.75 `guardTojeongContext` 를 본으로 삼는다.
//     · 판독기는 **`compatPersonInput(ctx, '')`** 를 그대로 쓴다. 그 함수의 키 조립이
//       `'y'+i` 이므로 `i=''` 이면 정확히 계약 §2-1 의 6키
//       (`cal`·`y`·`m`·`d`·`h`·`leap`)가 된다(계약 §2-1 이 명시). **새 판독기를
//       만들지 않는다** — 판독기가 두 벌이 되면 반드시 갈린다(결정 99).
//     · 재유도는 `RC.recompute(inp)` · `pillar` 는 `RC.compatPillarLine(r)`.
//
//   ★★`ilgan` 은 **한자**다(계약 §3). `r.ilgan` 은 한글(`계`)이고 이 상품군의
//     클라 산출은 `HS_CH[dayStem]`(`癸`)이다(index.html `_collectSajuFromUI`).
//     그대로 쓰면 프롬프트의 일간이 통째로 다른 표기가 된다 — 혼동 금지.
//
//   【정책 — 계약 §6. tojeong 과 **동일**하다】
//     · 6키 없음 → `mode:'legacy'` · 차단도 변경도 없다(구버전 캐시 하위호환).
//     · 6키 + 형식 불량/재유도 실패 → 파생 키 **폐기**. 「검증 불가 시 클라값
//       채택」은 v7.73 M16 이 적발한 회귀다 — 반복하지 않는다.
//     · **400 을 내지 않는다**(관통 #8 재발 방지 · 가용성).

/**
 * ★계약 §4 — `dominant`/`lacking` 산출식. **클라 `index.html:cwDomLack` 의 사본**이다.
 *
 * ★★두 벌이 되는 유일한 식이다(결정 99: 「사본은 반드시 갈린다」). 그래서
 *   `eval/eval_naming_tarot_guard.js` 의 D-2·D-3 이 **클라 소스에서 본문을 뽑아**
 *   `els` 전 조합(합 8 = 495 · 합 0~8 = 1,287)을 **전수 바이트 비교**한다.
 *   ⟹ 한쪽만 고치면 게이트가 즉시 붉어진다. 고칠 때는 반드시 양쪽을 함께 고칠 것.
 *
 * ★어휘는 `EL_NAMES`(이 파일이 이미 가진 상수)를 재사용한다 — 배열을 또 한 벌
 *   만들면 갈릴 표면이 하나 더 늘어난다. 값은 클라 `EL` 과 동일하며 D-1 이 대조한다.
 * ★구분자는 **가운뎃점 `·`(U+00B7)** 다. `', '` 가 아니다(D-5 가 못박는다).
 * ★`indexOf` 이므로 **동점이면 가장 앞 오행**이다(D-6).
 *
 * @param {number[]} els 목·화·토·금·수 개수 5칸
 * @returns {{dominant:string,lacking:string}}
 */
function domLack(els) {
  const a = (Array.isArray(els) && els.length === 5) ? els : [0, 0, 0, 0, 0];
  const max = Math.max.apply(null, a), min = Math.min.apply(null, a);
  const dominant = EL_NAMES[a.indexOf(max)];
  const lackingArr = [];
  for (let i = 0; i < 5; i++) { if (a[i] === 0) lackingArr.push(EL_NAMES[i]); }
  // 0인 오행이 하나도 없으면 「가장 적은 오행」을 부족으로 본다(클라와 동일).
  if (lackingArr.length === 0) lackingArr.push(EL_NAMES[a.indexOf(min)]);
  return { dominant, lacking: lackingArr.join('·') };
}

/**
 * ★★계약 §5-1 — dream 계열의 `dominantElement`·`weakElement`. **클라
 *   `index.html:analyzeDream()` 산출식의 사본**이다(정본):
 *   ```js
 *   const max=Math.max(...els),min=Math.min(...els);
 *   dominantElement=EL[els.indexOf(max)];   // ← EL 원소 1개
 *   weakElement=EL[els.indexOf(min)];       // ← EL 원소 1개
 *   ```
 *
 * ★★`domLack` 과 **다른 함수다.** 헷갈리면 해석이 통째로 깨진다:
 *   · `dominantElement` == `domLack(els).dominant`  — **항상 같다**(둘 다 indexOf(max))
 *   · `weakElement`     != `domLack(els).lacking`   — **0인 오행이 2개 이상이면 갈린다**
 *     실측 반례 `els=[0,2,1,3,0]` → weakElement `목(木)` vs lacking `목(木)·수(水)`.
 *     0인 오행이 1개일 때만 우연히 같으므로 **1표본 확인은 오판을 만든다**.
 *   ⟹ 그래서 `domLack` 을 재사용하지 않고 **별도 산출**로 둔다. 게이트
 *     `eval/eval_dream_daily_guard.js` 의 W-1(클·서버 전수 1,287조합 바이트 일치)·
 *     W-2(두 식이 갈리는 조합이 실재함을 분모와 함께)가 이 분리를 못박는다.
 *
 * ★어휘는 `EL_NAMES`(이 파일이 이미 가진 상수)를 재사용한다 — 배열 사본을 늘리지 않는다(결정 99).
 * ★`indexOf` 이므로 **동점이면 가장 앞 오행**이다(클라와 같은 성질).
 * ★클라는 `if(els.length)` 안에서만 산출하므로 빈 배열이면 둘 다 `''` 다. 같은 규약으로 맞춘다.
 *
 * @param {number[]} els 목·화·토·금·수 개수 5칸
 * @returns {{dominantElement:string,weakElement:string}}
 */
function elExtremes(els) {
  if (!Array.isArray(els) || els.length === 0) return { dominantElement: '', weakElement: '' };
  const a = (els.length === 5) ? els : [0, 0, 0, 0, 0];
  const max = Math.max.apply(null, a), min = Math.min.apply(null, a);
  return { dominantElement: EL_NAMES[a.indexOf(max)], weakElement: EL_NAMES[a.indexOf(min)] };
}

/**
 * ★★계약 §5-2 — `daily_message` 의 `hourBranch` 표시 문자열 12칸.
 *   정본은 클라 `js/chat.js:176` 의 `hourLabels` 리터럴이며, **인덱스는 지지 순서**
 *   (자·축·인·묘·진·사·오·미·신·유·술·해)로 시진 인덱스 `h`(0~11)와 1:1 이다.
 *   ★공백 1칸 · 반각 괄호 · `~`(U+007E) · 시각은 2자리 zero-pad. 바이트가 형식이다.
 *   ★두 벌이 되는 표이므로 게이트 H-0 이 클라 리터럴을 소스에서 뽑아 12칸 전수 대조한다.
 */
const HOUR_BRANCH_LABELS = Object.freeze([
  '자시 (23:00~00:59)', '축시 (01:00~02:59)', '인시 (03:00~04:59)', '묘시 (05:00~06:59)',
  '진시 (07:00~08:59)', '사시 (09:00~10:59)', '오시 (11:00~12:59)', '미시 (13:00~14:59)',
  '신시 (15:00~16:59)', '유시 (17:00~18:59)', '술시 (19:00~20:59)', '해시 (21:00~22:59)',
]);

/**
 * ★계약 §3 — 재유도 산출 `r` 에서 context 값을 만드는 표. **형식은 클라 현행을
 *   바이트로 지킨다**(형식이 바뀌면 프롬프트 문장이 깨진다).
 *   ★키 이름은 아래 상품별 표에 **명시**한다. 문자열 조립을 새로 만들지 않는다(계약 §2-3).
 */
const NT_VALUE_OF = Object.freeze({
  pillar: (r) => RC.compatPillarLine(r),
  // ★★한자다. `r.ilgan`(한글)이 아니다 — 계약 §3.
  ilgan: (r) => RC.HS_CH[r.pillars.day.stem],
  ilganElement: (r) => r.ilganElement,
  dominant: (r) => domLack(r.els).dominant,
  lacking: (r) => domLack(r.els).lacking,
  // ── ★v7.79 파 ⓑ — dream(3) · daily_message ────────────────────────────────
  //   ★형식은 계약 §5 의 **런타임 실측**이 정본이다. 아래 세 개가 함정이다.
  /** 일주 — 클라 `HS[dStem]+EB[dBranch]`(한글 2글자). `pillarStrings.dayPillar` 와 동일 형식. */
  dayPillar: (r) => r.pillarStrings.dayPillar,
  /** ★`EL` 원소 **1개**. `·` 로 잇지 않는다 — `dominant` 와 항상 같다(계약 §5-1). */
  dominantElement: (r) => elExtremes(r.els).dominantElement,
  /**
   * ★★`EL` 원소 **1개** = 「가장 적은 오행」. **`lacking` 이 아니다.**
   *   `lacking` 은 「0인 오행 **전부**를 `·` 로 이은 것」이므로 0인 오행이 2개 이상이면
   *   갈린다(계약 §5-1 실측 반례 `els=[0,2,1,3,0]` → `목(木)` vs `목(木)·수(水)`).
   *   0인 오행이 **1개일 때만 우연히 같다** — 1표본으로 「같다」고 결론내면 틀린다.
   *   ⟹ 절대 `domLack().lacking` 으로 대체하지 말 것. 게이트 W-1~W-4 가 전수로 못박는다.
   */
  weakElement: (r) => elExtremes(r.els).weakElement,
  /**
   * ★★「양력 변환 후」다(계약 §5-3). 음력 윤달 입력에서도 `(음력)` 접미가 **안 붙는다**
   *   (클라 `js/chat.js:179` 의 분기 ②가 항상 선점한다 — 분기 ③은 도달 불가).
   *   ⟹ 6키의 **원본** `y/m/d` 로 찍으면 형식이 깨진다. 반드시 `r.solar` 를 쓴다.
   *   ★zero-pad 없음 · `년`·`월` 뒤 공백 1칸 · 마지막 `일` 뒤 공백 없음.
   */
  birth: (r) => r.solar.y + '년 ' + r.solar.m + '월 ' + r.solar.d + '일',
  /**
   * ★★「시간 모름」이면 **`undefined` 를 돌려준다** = 「이 키를 만들지 않는다」.
   *   클라(`js/chat.js:174`)는 `if(s.pillars.hour)` 안에서만 `ctx.hourBranch` 를 만들므로
   *   시각 미상 payload 에는 **키 자체가 없다**(빈 문자열이 아니라 `hasOwnProperty`=false).
   *   ⟹ `h:-1` 인데 값을 만들어 넣으면 **없던 사실을 지어내는 것**이다.
   *   ★`hourIdx` 는 시주의 지지 인덱스와 같다(`recompute` 가 `pill(hourStem, hourIdx)`).
   */
  hourBranch: (r) => ((r.pillars && r.pillars.hour) ? HOUR_BRANCH_LABELS[r.pillars.hour.branch] : undefined),
});

/**
 * 상품별 **교체 키 표**. 계약 §3 의 「쓰는 상품」 열을 상품 기준으로 뒤집은 것이며,
 * 각 키는 그 상품의 프롬프트가 **실제로 보간하는** 키여야 한다
 * (`eval_naming_tarot_guard.js` C-3 이 fortune.js 소스와 1:1 대조한다).
 * ★여기 없는 키는 어떤 경로로도 서버가 손대지 않는다 — 명시 경계다.
 */
const NAMING_CTX_KEYS = Object.freeze({
  naming: Object.freeze(['pillar', 'ilgan', 'ilganElement', 'dominant', 'lacking']),
  naming_premium_1: Object.freeze(['pillar', 'ilgan', 'ilganElement', 'dominant', 'lacking']),
  naming_premium_2: Object.freeze(['pillar', 'ilgan', 'lacking']),
  naming_nickname: Object.freeze(['ilgan', 'ilganElement', 'lacking']),
});
const TAROT_CTX_KEYS = Object.freeze({
  tarot: Object.freeze(['ilgan', 'ilganElement', 'dominant', 'lacking']),
  tarot_premium_1: Object.freeze(['ilgan', 'ilganElement', 'dominant', 'lacking']),
  tarot_premium_2: Object.freeze(['ilgan', 'ilganElement', 'dominant', 'lacking']),
});
/**
 * ★v7.79 파 ⓑ — 꿈해몽 계열. 값 출처는 `window._sajuResultData`(클라 `analyzeDream`).
 *   ★`dream` 과 `dream_premium_1` 은 같은 `info` 를 공유하므로 값이 항상 같다(계약 §5-1).
 *   ★`dream_premium_2` 는 프롬프트가 `ilgan`·`ilganElement` 만 보간한다 —
 *     클라는 `dayPillar`·`dominantElement`·`weakElement` 도 싣지만(공용 빌더
 *     `_buildDreamContext`) 서버가 안 읽으므로 교체 표에 넣지 않는다. 여기 없는 키는
 *     어떤 경로로도 서버가 손대지 않는다(명시 경계 · C-3 이 프롬프트와 1:1 로 못박는다).
 */
const DREAM_CTX_KEYS = Object.freeze({
  dream: Object.freeze(['ilgan', 'ilganElement', 'dayPillar', 'dominantElement']),
  dream_premium_1: Object.freeze(['ilgan', 'ilganElement', 'dayPillar', 'dominantElement', 'weakElement']),
  dream_premium_2: Object.freeze(['ilgan', 'ilganElement']),
});
/**
 * ★v7.79 파 ⓑ — 데일리 한 마디. 값 출처는 `js/chat.js:_gatherChatContext()`.
 *   ★★`lacking` 은 계약 §3 표의 「쓰는 상품」 열에서 **빠져 있다**(표는 naming·nickname·
 *     tarot 만 적었다). 그러나 `api/fortune.js:2094` 가 `부족 오행: ${c.lacking}` 로
 *     **실제로 보간**하고 `js/chat.js:184` 가 **실제로 싣는다** ⟹ 계약 §3 의 누락으로
 *     판단해 편입한다. 빼면 그 키만 무검증으로 남는다(관통 #4 의 재발 형태).
 *   ★`dominant`(클라가 `js/chat.js:183` 에서 싣는 키)는 **서버가 한 번도 읽지 않는
 *     dangling** 이라 여기 없다. 서버가 안 읽는 키를 서버가 덮어쓰는 것은 죽은 코드이며,
 *     정리는 소유자(B · 클라)가 제거하는 쪽이 맞다. 게이트 K-1 이 「보간이 생기면
 *     즉시 붉어지도록」 래칫으로 잡아 둔다.
 */
const DAILY_CTX_KEYS = Object.freeze({
  daily_message: Object.freeze(['ilgan', 'ilganElement', 'dayPillar', 'lacking', 'birth', 'hourBranch']),
});
/**
 * ★★「값이 없는 것이 정답」인 키 (계약 §5-2).
 *   `hourBranch` 는 시각 미상이면 클라 payload 에 **키 자체가 없다**. 서버도 같아야 한다:
 *   빈 문자열로 두면 「빈 값이 왔다」가 되고, 값을 만들어 넣으면 **없던 사실을 지어내는 것**이다.
 *   ⟹ 산출기가 `undefined` 를 주면 그 키를 **삭제**한다(아래 `guardPersonContext`).
 *   ★이 목록에 없는 키의 `undefined`/`''` 는 종전대로 **렌더 실패 = 전건 폐기**다.
 */
const DAILY_OMITTABLE_KEYS = Object.freeze(['hourBranch']);
/** 클라이언트가 실어야 하는 생년월일 원본 키 (계약 §2-1). `compatPersonInput(ctx,'')` 가 읽는 6키. */
const PERSON_BIRTH_KEYS = Object.freeze(['cal', 'y', 'm', 'd', 'h', 'leap']);

/**
 * ★1인 상품 공용 가드 — naming/tarot 계열의 단일 판정점.
 * @param {object} ctx  클라이언트가 보낸 context
 * @param {string[]} keys 이 상품에서 교체할 §3 키 목록
 * @param {string} engineTag metrics.engine 라벨
 * @param {{omittable?:string[]}} [opts] ★`omittable` — 산출기가 `undefined` 를 주면
 *        「그 키는 **없는 것이 정답**」인 키(계약 §5-2 `hourBranch`). 그 경우 렌더 실패로
 *        보지 않고 키를 **삭제**한다. 넘기지 않으면 v7.79 파 ⓐ 와 **동작이 동일**하다.
 * @returns {{applied:boolean, context:object, metrics:object}}
 *   ★`applied` 는 「정규화를 수행했다」는 뜻이며 **차단 판정에 쓰지 않는다**(400 금지).
 */
function guardPersonContext(ctx, keys, engineTag, opts) {
  const metrics = {
    engine: engineTag,
    applied: false,
    mode: null,          // 'derived' | 'legacy' | 'discarded'
    reason: null,
    diffs: [],           // 클라값 != 서버 재유도값 인 키 (관측용 — 조용한 갈림의 유일한 신호)
    replaced: 0,
    discarded: 0,
  };
  if (!ctx || typeof ctx !== 'object' || Array.isArray(ctx)) return { applied: false, context: ctx, metrics };
  if (!Array.isArray(keys) || keys.length === 0) {
    // 표에 없는 type — 호출부(`CW_NAMING_TYPES`/`CW_TAROT_TYPES`)와 이 표가 어긋났다는 뜻이다.
    // ★조용히 통과시키지 않는다. 로그에 남겨 즉시 드러낸다.
    metrics.reason = 'NO_KEY_TABLE';
    return { applied: false, context: ctx, metrics };
  }
  const has = Object.prototype.hasOwnProperty;
  const omittable = (opts && Array.isArray(opts.omittable)) ? opts.omittable : [];
  const isOmittable = (k) => omittable.indexOf(k) !== -1;
  const out = Object.assign({}, ctx);

  // ── ① 6키 판독 — ★`compatPersonInput(ctx, '')` 재사용 (계약 §2-1) ──────────
  const got = compatPersonInput(ctx, '');
  if (got.missing) {
    metrics.applied = true; metrics.mode = 'legacy'; metrics.reason = 'NO_BIRTH_KEYS';
    return { applied: true, context: out, metrics };
  }
  const discardAll = (reason) => {
    for (const k of keys) {
      if (has.call(out, k)) { out[k] = ''; metrics.discarded++; }
    }
    metrics.applied = true; metrics.mode = 'discarded'; metrics.reason = reason;
    return { applied: true, context: out, metrics };
  };
  if (got.bad) return discardAll(got.bad);

  // ── ② 재유도 ────────────────────────────────────────────────────────────
  let r = null;
  try { r = RC.recompute(got.input); } catch (e) { r = null; }
  if (!r || !r.ok) return discardAll('DERIVE_FAILED');

  let vals = null;
  try {
    vals = {};
    for (const k of keys) vals[k] = NT_VALUE_OF[k](r);
  } catch (e) { vals = null; }
  // ★렌더가 하나라도 성립하지 않으면 **전부 폐기**한다. 절반만 서버값인 프롬프트는
  //   「검증됐다」고 말할 수 없다(M16 의 교훈 — 판정 못 하면 채택이 아니라 폐기다).
  //   ★단 `omittable` 키의 `undefined` 는 **실패가 아니라 「키 없음」이라는 산출**이다
  //     (계약 §5-2 — 시각 미상의 `hourBranch`). 그 밖의 빈 값('' · null)은 여전히 실패다.
  const renderFailed = !vals || keys.some((k) => (isOmittable(k)
    ? (vals[k] !== undefined && (vals[k] === null || vals[k] === ''))
    : (vals[k] === null || vals[k] === undefined || vals[k] === '')));
  if (renderFailed) return discardAll('DERIVE_FAILED');

  // ── ③ 교체 + 갈림 관측 ───────────────────────────────────────────────────
  for (const k of keys) {
    const before = has.call(out, k) ? out[k] : undefined;
    const after = vals[k];
    // ★「없으면 없는 대로」 — 값을 지어내지 않는다. 클라가 위조로 실어 보냈으면 **삭제**한다
    //   (빈 문자열로 두면 「빈 값이 왔다」가 되어 클라 payload 형상과 갈린다).
    if (after === undefined) {
      if (before !== undefined) { delete out[k]; metrics.discarded++; metrics.diffs.push(k); }
      continue;
    }
    if (before !== undefined && String(before) !== String(after)) metrics.diffs.push(k);
    out[k] = after;
    metrics.replaced++;
  }
  metrics.applied = true; metrics.mode = 'derived';
  return { applied: true, context: out, metrics };
}

/** 작명 계열(`naming`·`naming_premium_1/2`·`naming_nickname`) 가드. */
function guardNamingContext(ctx, type) {
  return guardPersonContext(ctx, NAMING_CTX_KEYS[type], 'ctxguard/v7.79-naming');
}
/** 타로 계열(`tarot`·`tarot_premium_1/2`) 가드. */
function guardTarotContext(ctx, type) {
  return guardPersonContext(ctx, TAROT_CTX_KEYS[type], 'ctxguard/v7.79-tarot');
}
/** ★v7.79 파 ⓑ — 꿈해몽 계열(`dream`·`dream_premium_1/2`) 가드. */
function guardDreamContext(ctx, type) {
  return guardPersonContext(ctx, DREAM_CTX_KEYS[type], 'ctxguard/v7.79-dream');
}
/**
 * ★v7.79 파 ⓑ — 데일리 한 마디(`daily_message`) 가드.
 *   ★`hourBranch` 만 `omittable` 이다 — 시각 미상이면 **키를 만들지 않는 것**이 정답이다.
 */
function guardDailyContext(ctx, type) {
  return guardPersonContext(ctx, DAILY_CTX_KEYS[type], 'ctxguard/v7.79-daily',
    { omittable: DAILY_OMITTABLE_KEYS });
}

// ★상수 정합 자기검사 — 상품별 표의 모든 키에 산출기가 있어야 한다. 없으면 그 키는
//   조용히 무검증으로 프롬프트에 들어간다(= 관통 #4 의 재발). 로드 시점에 즉시 드러낸다.
{
  const tables = [NAMING_CTX_KEYS, TAROT_CTX_KEYS, DREAM_CTX_KEYS, DAILY_CTX_KEYS];
  const uncovered = [];
  for (const t of tables) for (const ty of Object.keys(t)) {
    for (const k of t[ty]) if (typeof NT_VALUE_OF[k] !== 'function') uncovered.push(ty + '.' + k);
  }
  // ★`omittable` 은 실제 교체 표에 있는 키여야 한다. 표에 없는 키를 면제하면
  //   「면제한 줄 알았는데 아무 효과가 없는」 죽은 상수가 된다(I-43 유형).
  for (const k of DAILY_OMITTABLE_KEYS) {
    const inTable = Object.keys(DAILY_CTX_KEYS).some((ty) => DAILY_CTX_KEYS[ty].indexOf(k) !== -1);
    if (!inTable) uncovered.push('DAILY_OMITTABLE_KEYS.' + k + '(표에 없음)');
  }
  if (uncovered.length) {
    throw new Error('[ctxguard] selfCheck failed: NT_VALUE_OF 미정의 키 ' + uncovered.join(','));
  }
}

module.exports = {
  guardContext, inputFromContext, selfCheck, hasGuardedKeys, unverifiable,
  // ★v7.79 파 ⓐ — naming·tarot 1인 상품 가드
  guardNamingContext, guardTarotContext, guardPersonContext, domLack,
  NAMING_CTX_KEYS, TAROT_CTX_KEYS, PERSON_BIRTH_KEYS, NT_VALUE_OF,
  // ★v7.79 파 ⓑ — dream(3)·daily_message 가드
  guardDreamContext, guardDailyContext, elExtremes,
  DREAM_CTX_KEYS, DAILY_CTX_KEYS, DAILY_OMITTABLE_KEYS, HOUR_BRANCH_LABELS,
  // ★v7.75 관통 #9 — tojeong 가드
  guardTojeongContext, tojeongBirthInput, tojeongDerive,
  TOJEONG_REPLACE_KEYS, TOJEONG_BIRTH_KEYS,
  TJ_PALGUA, TJ_YUKGUA, TJ_HAGUA,
  CTX_REPLACE_KEYS, CTX_GUARDED_KEYS, CTX_VALUE_OF, HOUR_LABELS,
  // ★v7.73 관통 #4 — compat 가드
  guardCompatContext, compatPersonInput,
  COMPAT_PROMPT_KEYS, COMPAT_GUARDED_KEYS, COMPAT_REPLACE_KEYS, COMPAT_BIRTH_KEYS,
  COMPAT_NORMALIZE, COMPAT_REL_TYPE_NAMES, COMPAT_REL_TYPE_KEYS,
  COMPAT_REL_TYPE_DEFAULT, COMPAT_SCORE_MIN, COMPAT_SCORE_MAX,
  EL_NAMES, HS_FULL, EB_FULL, GENDER_NAMES,
};
