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
 *   · 재계산이 성립하지 않으면 **아무것도 손대지 않는다**(fail-closed).
 *     틀린 값을 주입하느니 종전 경로를 그대로 둔다.
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
]);

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
});

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
  return {
    birth,
    calType: ctx.calType === 'lunar' ? 'lunar' : 'solar',
    isLeap: false,                 // 클라이언트에 윤달 UI 가 없다(index.html:1715)
    hourIdx,
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
    const sv = get(r);
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
 * ★자기검사 — 상수 정합. 게이트와 별개로 런타임에서도 확인 가능하게 둔다.
 *   CTX_REPLACE_KEYS 와 CTX_VALUE_OF 의 키 집합이 어긋나면 교체가 조용히
 *   빠지므로(= 감시 구멍), 즉시 드러나야 한다.
 */
function selfCheck() {
  const a = CTX_REPLACE_KEYS.slice().sort();
  const b = Object.keys(CTX_VALUE_OF).sort();
  const ok = a.length === b.length && a.every((k, i) => k === b[i]);
  return { ok, replaceKeys: a, valueKeys: b };
}

module.exports = {
  guardContext, inputFromContext, selfCheck,
  CTX_REPLACE_KEYS, CTX_VALUE_OF, HOUR_LABELS,
};
