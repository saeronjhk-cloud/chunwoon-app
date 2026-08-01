// 천운 — 산출물 단위 권위(authority). 4차 검토 반영: 세 차원을 직교 분리한다.
//  basis(산출 근거) × verification_status(검증 상태) × surface_policy(노출 정책).
//  기존 6-enum은 외부 표시용 alias로만 유지하고, 내부 권위 판정은 canSurface() 정책함수로 계산.
//  어떤 산출물도 real_world_prediction_authority=false.
'use strict';

const BASIS = { CALENDAR: 'CALENDAR', DOCTRINE: 'DOCTRINE', EXPERIMENTAL: 'EXPERIMENTAL' };
const VERIFICATION = {
  VERIFIED: 'VERIFIED',
  PENDING: 'PENDING',
  UNVERIFIED: 'UNVERIFIED',
  COMPILED_UNVERIFIED: 'COMPILED_UNVERIFIED',
  EXPERT_PENDING: 'EXPERT_PENDING',
  SOURCE_REVIEW_REQUIRED: 'SOURCE_REVIEW_REQUIRED'
};
// v1.0.1(LOCK 후 비차단 개선): 번역 '워크플로 상태'는 검증 상태와 별개 축으로 직교 분리.
// MACHINE_DRAFT 단계는 검증 상태와 무관하게 절대 노출·coverage 산입 금지.
const TRANSLATION_STAGE = {
  NONE: 'NONE',
  MACHINE_DRAFT: 'MACHINE_DRAFT',
  HUMAN_REVIEWED: 'HUMAN_REVIEWED',
  SOURCE_CROSSCHECKED: 'SOURCE_CROSSCHECKED',
  VERIFIED: 'VERIFIED'
};
const SURFACE_POLICY = {
  DENY: 'DENY',                             // 어떤 경로로도 노출 금지
  VERIFIED_ONLY: 'VERIFIED_ONLY',           // 기본 프로덕션: VERIFIED만 노출
  EXPLICIT_BETA_OPT_IN: 'EXPLICIT_BETA_OPT_IN' // 별도 승인된 공개베타 경로 + 명시 동의 시에만(비권위)
};

// 6-enum alias(하위호환·외부 표시용). 내부 판정에는 쓰지 않음.
const SCOPE = {
  CALENDAR_COMPUTATION_VERIFIED: 'CALENDAR_COMPUTATION_VERIFIED',
  CALENDAR_COMPUTATION_PENDING: 'CALENDAR_COMPUTATION_PENDING',
  DOCTRINE_BOUND_VERIFIED: 'DOCTRINE_BOUND_VERIFIED',
  DOCTRINE_BOUND_UNVERIFIED: 'DOCTRINE_BOUND_UNVERIFIED',
  EXPERIMENTAL_SHADOW: 'EXPERIMENTAL_SHADOW',
  EXPERIMENTAL_PUBLIC_BETA: 'EXPERIMENTAL_PUBLIC_BETA'
};

// 산출물 → 세 축(직교). verification_status·surface_policy가 authority enum 밖의 독립 개념.
const OUTPUT = {
  pillars:      { basis: BASIS.CALENDAR, verification_status: VERIFICATION.PENDING, surface_policy: SURFACE_POLICY.VERIFIED_ONLY },
  iljin_ganzi:  { basis: BASIS.CALENDAR, verification_status: VERIFICATION.PENDING, surface_policy: SURFACE_POLICY.VERIFIED_ONLY },
  solar_term:   { basis: BASIS.CALENDAR, verification_status: VERIFICATION.PENDING, surface_policy: SURFACE_POLICY.VERIFIED_ONLY },
  timezone:     { basis: BASIS.CALENDAR, verification_status: VERIFICATION.PENDING, surface_policy: SURFACE_POLICY.VERIFIED_ONLY },
  // ★v7.70 승격 (제이 승인 2026-08-01) — PENDING → VERIFIED.
  //   【근거】eval/eval_engine_binding.js 가 **매 게이트 실행마다 전수 재현**한다.
  //     · daewoon_direction/간지 : 10년간 x 2성별 x 60월주 = 1,200 전수. 60갑자 산술로
  //       독립 유도한 기대값과 대조 → 1,200/1,200. 순행 600 / 역행 600.
  //     · sipsin                 : 10 x 10 = 100 전수. 오행 생극 + 음양으로 독립 유도 → 100/100.
  //   【왜 승격이 정당한가】두 산출물은 **판정이 아니라 산술**이다. 원문 해석 여지가 없고
  //     정답이 표로 닫혀 있어 전수 검증이 성립한다. 격국·용신(EXPERIMENTAL·DENY)과 성질이 다르다.
  //   【승격 전 상태의 모순】이 값들을 봉인해 둔 동안 프로덕션은 **같은 값을 LLM 이 생성**해
  //     검증 없이 노출하고 있었다(v7.69 §3). 정책이 더 정확한 쪽만 막고 있었다.
  //   ★되돌리려면 PENDING 으로 낮추면 된다 — bind.js 가 매 호출 authority 를 확인하므로
  //     값이 즉시 사라지고 LLM 경로로 돌아간다.
  daewoon_direction: { basis: BASIS.DOCTRINE, verification_status: VERIFICATION.VERIFIED, surface_policy: SURFACE_POLICY.VERIFIED_ONLY },
  sipsin:       { basis: BASIS.DOCTRINE, verification_status: VERIFICATION.VERIFIED, surface_policy: SURFACE_POLICY.VERIFIED_ONLY },
  // ★v7.70 신설 — 지지 관계(六合·三合·沖·六害·刑). 12 x 12 = 132 전수 검증 통과.
  //   미등록이면 fail-closed DENY 였으므로, 등록 자체가 노출 허용의 전제였다.
  branch_relation: { basis: BASIS.DOCTRINE, verification_status: VERIFICATION.VERIFIED, surface_policy: SURFACE_POLICY.VERIFIED_ONLY },
  // ★v7.70 — 승격하지 않았다. 편집된 표라 원문 대조 없이 독립 검증기를 만들 수 없다.
  //   대운·십성·지지관계와 달리 「정답이 산술로 닫혀 있지 않다」. 원문 직독 후 재검토.
  sinsal:       { basis: BASIS.DOCTRINE, verification_status: VERIFICATION.COMPILED_UNVERIFIED, surface_policy: SURFACE_POLICY.VERIFIED_ONLY },
  daewoon_start_age: { basis: BASIS.EXPERIMENTAL, verification_status: VERIFICATION.PENDING, surface_policy: SURFACE_POLICY.DENY },
  yongsin:      { basis: BASIS.EXPERIMENTAL, verification_status: VERIFICATION.UNVERIFIED, surface_policy: SURFACE_POLICY.DENY },
  gisin:        { basis: BASIS.EXPERIMENTAL, verification_status: VERIFICATION.UNVERIFIED, surface_policy: SURFACE_POLICY.DENY },
  gyeok:        { basis: BASIS.EXPERIMENTAL, verification_status: VERIFICATION.UNVERIFIED, surface_policy: SURFACE_POLICY.DENY },
  sangsin:      { basis: BASIS.EXPERIMENTAL, verification_status: VERIFICATION.EXPERT_PENDING, surface_policy: SURFACE_POLICY.DENY },
  johu:         { basis: BASIS.DOCTRINE, verification_status: VERIFICATION.SOURCE_REVIEW_REQUIRED, surface_policy: SURFACE_POLICY.DENY },
  verdict:      { basis: BASIS.EXPERIMENTAL, verification_status: VERIFICATION.UNVERIFIED, surface_policy: SURFACE_POLICY.DENY }
};

const record = (kind) => OUTPUT[kind] || { basis: BASIS.EXPERIMENTAL, verification_status: VERIFICATION.UNVERIFIED, surface_policy: SURFACE_POLICY.DENY }; // 미등록 fail-closed
const stageOf = (r) => r.translation_stage || TRANSLATION_STAGE.NONE;

// enum 접미사 검사 대신 정책 함수로 노출 여부 판정.
// context: { beta_opt_in, beta_policy_version, channel, authoritative_request }
function canSurface(kind, context = {}) {
  const r = record(kind);
  // LLM 초벌번역 단계는 검증 상태와 무관하게 어떤 경우에도 노출 금지(검증 입력일 뿐)
  if (stageOf(r) === TRANSLATION_STAGE.MACHINE_DRAFT) return { surface: false, authoritative: false, reason: 'MACHINE_DRAFT_TRANSLATION_NEVER_SURFACED' };
  // authoritative 결과 요청은 VERIFIED가 아니면 즉시 거부
  if (context.authoritative_request && r.verification_status !== VERIFICATION.VERIFIED) return { surface: false, authoritative: false, reason: 'AUTHORITATIVE_REQUIRES_VERIFIED' };
  switch (r.surface_policy) {
    case SURFACE_POLICY.DENY:
      return { surface: false, authoritative: false, reason: 'POLICY_DENY' };
    case SURFACE_POLICY.VERIFIED_ONLY: {
      const ok = r.verification_status === VERIFICATION.VERIFIED;
      return { surface: ok, authoritative: ok, reason: ok ? 'VERIFIED' : 'NOT_VERIFIED' };
    }
    case SURFACE_POLICY.EXPLICIT_BETA_OPT_IN: {
      // 별도 공개베타 경로 + 명시 동의 + 정책버전 + 허용채널. 절대 authoritative 아님.
      const ok = context.beta_opt_in === true && !!context.beta_policy_version &&
                 (context.channel ? ['app_beta_screen'].includes(context.channel) : false) &&
                 context.authoritative_request !== true;
      return { surface: ok, authoritative: false, reason: ok ? 'PUBLIC_BETA_OPT_IN' : 'BETA_GATES_UNMET' };
    }
    default:
      return { surface: false, authoritative: false, reason: 'UNKNOWN_POLICY' };
  }
}

// 6-enum alias 파생(외부 표시용)
function aliasScope(kind) {
  const r = record(kind);
  const v = r.verification_status === VERIFICATION.VERIFIED;
  if (r.basis === BASIS.CALENDAR) return v ? SCOPE.CALENDAR_COMPUTATION_VERIFIED : SCOPE.CALENDAR_COMPUTATION_PENDING;
  if (r.basis === BASIS.DOCTRINE) return v ? SCOPE.DOCTRINE_BOUND_VERIFIED : SCOPE.DOCTRINE_BOUND_UNVERIFIED;
  return r.surface_policy === SURFACE_POLICY.EXPLICIT_BETA_OPT_IN ? SCOPE.EXPERIMENTAL_PUBLIC_BETA : SCOPE.EXPERIMENTAL_SHADOW;
}

function classify(kind) {
  const r = record(kind);
  const prod = canSurface(kind, {}); // 기본 프로덕션 경로(베타 비활성)
  return {
    kind,
    basis: r.basis,
    verification_status: r.verification_status,
    translation_stage: stageOf(r),           // 번역 워크플로 상태(검증 상태와 별개 축)
    surface_policy: r.surface_policy,
    scope: aliasScope(kind),                 // 6-enum alias(하위호환)
    user_surfaceable: prod.surface,          // 기본 경로 노출 가능 여부
    authoritative: prod.authoritative,
    real_world_prediction_authority: false   // 항상 false
  };
}

const userSurfaceable = (kind) => canSurface(kind, {}).surface;

function tag(kinds) {
  const out = {};
  for (const k of kinds) out[k] = classify(k);
  return out;
}

module.exports = {
  BASIS, VERIFICATION, TRANSLATION_STAGE, SURFACE_POLICY, SCOPE, OUTPUT,
  classify, canSurface, userSurfaceable, aliasScope, tag
};
