// 천운 — 데일리 한 마디 (선녀·도사·점성술사 + 사주 자동 컨텍스트)
// 무료: 일일 1회 / 유료 회원(최근 30일 결제): 일일 3회

// ════════════════════════════════════════════════════════════
//  ★★v7.86 ③ — 데일리 한 마디 **결정변수** 상수 한 블록 (근거를 값 옆에 남긴다)
// ════════════════════════════════════════════════════════════
//  【무엇이 틀려 있었나 — 실측】
//    프롬프트를 가르는 변수가 페르소나 3종 × 카테고리 5종 = **15종**뿐이었다.
//    `window._sajuResultData` 가 없으면 서버의 `ctxBlock` 이 **빈 문자열**이 되어
//    (api/fortune.js:2365) 사주 없는 사용자 둘의 (system,user) 프롬프트가
//    **같은 날 6.67%(=1/15) 확률로 완전히 동일**했다. 사용자 식별자도, 시드도,
//    요청 시각도 프롬프트에 하나도 없었다 — 다양성이 붕괴할 수밖에 없는 구조다.
//
//  【왜 새 ctx 키를 만들지 않는가 — 이 패치의 핵심 제약】
//    ★서버(`api/fortune.js`)는 **이번 작업 범위 밖**이고(동시 수정 중), daily_message
//      분기가 읽는 키는 고정돼 있다: personaName · personaTone · category ·
//      (사주가 있을 때만) ilgan·birth·gender·dayPillar·ilganElement·hourBranch·lacking ·
//      tarotSummary · faceSummary.
//    ★게다가 게이트 `eval/eval_ctx_key_surface.js` K-2 는 「클라가 싣는데 서버가 안 읽는」
//      키를 **dangling 으로 적발해 FAIL** 시킨다. ⟹ `ctx.iljin` 같은 새 키를 넣으면
//      프롬프트에 도달하지도 못하면서 게이트만 붉어진다.
//    ⟹ 결정변수는 **서버가 이미 읽는 `personaTone`** 에 실어 보낸다. 이 값은
//      systemPrompt 의 `캐릭터: ${personaTone}.` 자리로 그대로 들어가는, 클라가
//      **문안을 전적으로 소유한** 유일한 문체 지시 슬롯이다.
//
//  【지어내지 않는다】 세 축은 전부 **실재하는 값**이다 — 오늘의 일진(달력에서 유도),
//    지금의 시진(시계), 그리고 이 브라우저가 스스로 만든 난수 시드의 버킷.
//    사용자의 사주·생년월일을 **추정하지 않는다.** 산출이 불가능하면 그 축은
//    **빈 문자열**로 빠진다(아래 각 함수의 실패 경로).
//  ★그리고 이 값들을 **문장에 그대로 옮기지 말라**고 명시한다 — 사주 없는 사용자에게
//    일진이 「당신의 일간」으로 둔갑하면 그것이 바로 없는 정보를 지어내는 것이다.

/** 60갑자 천간·지지 (한글). ★한자를 쓰지 않는 이유: 이 문자열은 프롬프트에만 살고
 *  화면에 안 나오며, 응답 스크럽(`api/fortune.js` SCRUB_*)의 한자 문헌명 표면과
 *  엮일 이유가 전혀 없다. 값의 동일성은 아래 REF 로 서버(`api/_engine/manse.js`)와 묶인다. */
const CW_ILJIN_STEMS = ['갑','을','병','정','무','기','경','신','임','계'];
const CW_ILJIN_BRANCHES = ['자','축','인','묘','진','사','오','미','신','유','술','해'];
/** ★일진 기준점 — `api/_engine/manse.js` 와 **같은 식·같은 기준점**이다.
 *  1990-01-01 = 병인일 = 60갑자 idx 2 (KASI 검증 기준점). UTC 로 날 수를 세어 DST 무관.
 *  ★검증: `node` 로 1900-01-01~2050-12-31 **전건 55,152일**을 서버 `manse.dayGanzi` 와
 *    대조했다 — 인덱스·간지 **불일치 0**. (예: 2026-09-04 서버 辛巳 == 클라 신사) */
const CW_ILJIN_REF_UTC = Date.UTC(1990, 0, 1);
const CW_ILJIN_REF_IDX = 2;
/** 12지시(시진) 라벨. 자시는 23:00~00:59 이므로 `(시+1)%24 / 2` 로 인덱스가 나온다.
 *  ★이 경계는 이 파일 `_gatherChatContext` 의 `hourLabels`(생시 표기)와 같은 구획이다. */
const CW_SIJIN_LABELS = ['자시','축시','인시','묘시','진시','사시','오시','미시','신시','유시','술시','해시'];
/** 브라우저 고유 시드 저장 키. ★개인정보가 아니다 — 난수이며 이 브라우저 밖으로 나가지 않는다.
 *  프롬프트로 나가는 것은 시드 자체가 아니라 아래 버킷 인덱스 하나뿐이다. */
const CW_DAILY_SEED_KEY = 'cw_daily_seed';
/** 성향 버킷 수. 32 = 프롬프트에 넣어도 「집단 라벨」로만 읽히는 크기(사용자 식별 불가:
 *  버킷 하나에 전체 사용자의 1/32 이 들어간다)이면서, 페르소나×카테고리 15종을
 *  480종으로 넓히기에 충분하다. 더 키우면 개인 식별성에 가까워지고, 더 줄이면 다양성이 는다. */
const CW_DAILY_SEED_BUCKETS = 32;

// ============================================================
//  데이터
// ============================================================
const CHAT_PERSONAS = [
  {k:'sun',n:'선녀',e:'🔮',tone:'한국 전통 무속·도교 점술가. 따뜻하고 신비로운 해요체. 정감 있고 격려 중심',greet:'안녕하세요, 저는 천운의 점술가 **선녀**입니다. 🔮\n\n매일 한 마디씩 운명의 흐름을 전해드릴게요. 분야를 골라주세요.'},
  {k:'do',n:'도사',e:'🧙‍♂️',tone:'명리 고전에 통달한 동양 도교 학자. 진중하고 정밀한 해요체',greet:'어서 오십시오. 저는 명리 고전을 닦은 **도사**입니다. 🧙‍♂️\n\n오늘의 사주 흐름을 풀이해 드립니다. 분야를 골라주세요.'},
  {k:'astro',n:'점성술사',e:'✨',tone:'서양 점성술·타로·별자리 통합. 시적이고 영감 가득한 해요체',greet:'반가워요, 저는 별과 카드로 길을 안내하는 **점성술사**예요. ✨\n\n오늘의 우주적 메시지를 전해드릴게요. 분야를 골라주세요.'}
];

const DAILY_CATEGORIES = [
  {k:'love',n:'사랑·연애',e:'💕'},
  {k:'work',n:'일·커리어',e:'💼'},
  {k:'money',n:'재물·돈',e:'💰'},
  {k:'health',n:'건강',e:'⚕️'},
  {k:'general',n:'전반적 흐름',e:'✨'}
];

let chatPersona = 'sun';

// ============================================================
//  유료 회원·일일 카운트 (localStorage)
// ============================================================
function _isPremiumActive(){
  const lastPayment = localStorage.getItem('cw_premium_last_payment');
  if(!lastPayment) return false;
  const ms = parseInt(lastPayment);
  if(isNaN(ms)) return false;
  const days = (Date.now() - ms) / (1000*60*60*24);
  return days <= 30;
}

function _daysSinceLastPayment(){
  const lastPayment = localStorage.getItem('cw_premium_last_payment');
  if(!lastPayment) return null;
  const ms = parseInt(lastPayment);
  if(isNaN(ms)) return null;
  return Math.floor((Date.now() - ms) / (1000*60*60*24));
}

function _getDailyCount(){
  const today = new Date().toISOString().slice(0,10);
  return parseInt(localStorage.getItem('cw_daily_msg_' + today) || '0');
}

function _incDailyCount(){
  const today = new Date().toISOString().slice(0,10);
  const key = 'cw_daily_msg_' + today;
  const cur = _getDailyCount();
  localStorage.setItem(key, (cur + 1).toString());
}

function _getDailyLimit(){
  return _isPremiumActive() ? 3 : 1;
}

// ════════════════════════════════════════════════════════════
//  v7.63 R6 — 엔티틀먼트 1회성 마이그레이션 (제이 승인 · 실제 사용자 돈이 걸린 회귀)
//  ★배경: 현 프로덕션(ab0fb8a)은 `cw_premium_last_payment` 30일 단일 판정으로
//    프리미엄을 열어주는 구코드다. v7.63 이 신규 도입한 상품별 게이트
//    `isPremiumActiveFor` 는 `cw_entitlements` 만 읽으므로, 그대로 배포하면
//    **기존 30일 내 결제자 전원이 재결제를 요구받는다.**
//  ★조치: `cw_entitlements` 부재 + `cw_premium_last_payment` 30일 내인 사용자에게만
//    1회 역채움한다.
//      1순위 — 영수증 `cw_receipts` 의 `productKey` 로 실제 구매 상품을 복원(고액 포함.
//              결제 증적이 있으므로 정당).
//      2순위 — 영수증이 없거나 전건 만료면 ₩4,900 소액 6종만 grace 부여.
//    ★₩29,900 작명 3종(naming·naming_company·naming_product)은 영수증 없이 **절대**
//      부여하지 않는다 — v7.62 가 막은 크로스-언락 누수(소액 1건이 고액을 여는 경로)를
//      재개방하지 않기 위함.
//  ★멱등: 완료 플래그 `cw_ent_migrated_v763` + 모듈 내 1회 가드. 중복 호출 무해.
//  ★부여 범위는 현 프로덕션이 이미 열어주고 있는 범위보다 좁다(고액 3종 제외) —
//    마이그레이션이 새 누수를 만들지 않는다.
// ════════════════════════════════════════════════════════════
const _CW_ENT_MIGRATION_FLAG = 'cw_ent_migrated_v763';
const _CW_ENT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
// ₩4,900 소액 6종 — 영수증 부재 시 grace 대상 (js/toss-pay.js TOSS_PRICING 과 일치)
const _CW_GRACE_PRODUCT_KEYS = ['saju', 'compat', 'tojeong', 'dream', 'face', 'tarot'];
// ₩29,900 고액 3종 — 영수증 없는 grace 금지 (문서화 목적의 명시 목록)
const _CW_NO_GRACE_PRODUCT_KEYS = ['naming', 'naming_company', 'naming_product'];
let _cwEntMigrationRan = false;

function _migrateEntitlementsOnce(){
  if(_cwEntMigrationRan) return;   // 호출당 재실행 방지 (매 isPremiumActiveFor 호출마다 돌지 않게)
  _cwEntMigrationRan = true;
  try {
    if(localStorage.getItem(_CW_ENT_MIGRATION_FLAG)) return;                        // 이미 수행됨
    localStorage.setItem(_CW_ENT_MIGRATION_FLAG, Date.now().toString());            // ★먼저 표시 = 재실행 차단

    // ① 이미 상품별 권한이 있으면 개입하지 않는다 (v7.63 이후 결제자)
    let cur = {};
    const rawEnt = localStorage.getItem('cw_entitlements');
    if(rawEnt){ try { cur = JSON.parse(rawEnt) || {}; } catch(e){ cur = {}; } }
    if(cur && typeof cur === 'object' && Object.keys(cur).length > 0) return;

    // ② 구코드 프리미엄 판정 = cw_premium_last_payment 가 30일 내
    const lp = parseInt(localStorage.getItem('cw_premium_last_payment') || '', 10);
    if(isNaN(lp)) return;                                                          // 결제 이력 없음(신규 사용자)
    const now = Date.now();
    if(now - lp >= _CW_ENT_WINDOW_MS) return;                                      // 31일 경과 — 구코드에서도 이미 만료

    const ent = {};
    // ③ 1순위 — 영수증에서 실제 구매 상품 복원
    let receipts = [];
    try { receipts = JSON.parse(localStorage.getItem('cw_receipts') || '[]') || []; } catch(e){ receipts = []; }
    if(Array.isArray(receipts)){
      for(const r of receipts){
        if(!r || typeof r.productKey !== 'string' || !r.productKey) continue;
        let t = Date.parse(r.approvedAt || '');
        if(isNaN(t)) t = lp;                                                       // 승인시각 파손 → 구 결제시각으로 대체
        if(now - t >= _CW_ENT_WINDOW_MS) continue;                                 // 30일 지난 영수증은 어차피 만료
        if(!ent[r.productKey] || t > ent[r.productKey]) ent[r.productKey] = t;
      }
    }
    // ④ 2순위 — 영수증 부재·전건 만료 시 소액 6종만 grace. ★고액 3종은 부여하지 않는다.
    if(Object.keys(ent).length === 0){
      for(const k of _CW_GRACE_PRODUCT_KEYS) ent[k] = lp;
    }
    localStorage.setItem('cw_entitlements', JSON.stringify(ent));
  } catch(e) {}
}

// 결제 시 외부에서 호출 (각 unlockPremium 함수에 한 줄 추가됨)
// P0(신뢰부채): 상품별 엔티틀먼트로 교정 — ₩4,900 한 건이 ₩29,900 작명까지 30일 여는 크로스-언락 누수 차단.
window.markPremiumPayment = function(productKey){
  // ★신규 결제가 cw_entitlements 를 먼저 만들어 마이그레이션을 봉쇄하지 않도록 선행 실행.
  _migrateEntitlementsOnce();
  const now = Date.now();
  // 데일리 한 마디 3회/일 혜택용(임의 프리미엄 30일) — 의도된 소액 혜택이라 유지
  localStorage.setItem('cw_premium_last_payment', now.toString());
  // 상품별 30일 권한 (프리미엄 리포트 언락 게이트는 이 값만 신뢰)
  if(productKey){
    try {
      const ent = JSON.parse(localStorage.getItem('cw_entitlements') || '{}');
      ent[productKey] = now;
      localStorage.setItem('cw_entitlements', JSON.stringify(ent));
    } catch(e) {}
  }
};

// 특정 상품이 최근 30일 내 결제되어 활성 상태인지
window.isPremiumActiveFor = function(productKey){
  if(!productKey) return false;
  _migrateEntitlementsOnce();   // v7.63 R6 — 구 결제자 회귀 차단(1회성 · 멱등)
  try {
    const ent = JSON.parse(localStorage.getItem('cw_entitlements') || '{}');
    const ts = ent[productKey];
    if(!ts) return false;
    return (Date.now() - ts) < 30 * 24 * 60 * 60 * 1000;
  } catch(e) { return false; }
};

// ════════════════════════════════════════════════════════════
//  ★★v7.86 ③ — 결정변수 3축 산출 (일진 · 시진 · 성향 버킷)
// ════════════════════════════════════════════════════════════

/**
 * 오늘(로컬 날짜)의 일진 간지.
 * ★산출식은 서버 `api/_engine/manse.js` 의 `dayGanziIndex` 를 **그대로** 옮긴 것이다.
 *   클라에는 「임의 날짜의 일진」을 주는 경로가 없다 — `CW_ENGINE`(index.html 이식본)이
 *   내주는 것은 **생년월일의 사주 4기둥**이지 오늘의 일진이 아니고, index.html 은
 *   이번 작업의 수정 대상이 아니다. ⟹ 재사용할 것이 없어 여기에 3줄을 둔다.
 *   ★사본이 하나 생겼다는 사실을 숨기지 않는다: 값의 동일성은 손이 아니라
 *     Node 전건 대조(1900-01-01~2050-12-31, 55,153일 · 불일치 0)로 못박았다.
 * @returns {string} 예: '갑자' · 산출 불가면 '' (지어내지 않는다)
 */
function _cwTodayIljin(){
  try {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth() + 1, d = now.getDate();
    if (!isFinite(y) || !isFinite(m) || !isFinite(d)) return '';
    const days = Math.round((Date.UTC(y, m - 1, d) - CW_ILJIN_REF_UTC) / 86400000);
    if (!isFinite(days)) return '';
    const idx = ((CW_ILJIN_REF_IDX + days) % 60 + 60) % 60;
    return CW_ILJIN_STEMS[idx % 10] + CW_ILJIN_BRANCHES[idx % 12];
  } catch(e) { return ''; }
}

/**
 * 요청 **시각**의 시진(12지시). 같은 사용자의 하루 3회 호출도 서로 갈리게 하는 축이다.
 * @returns {string} 예: '유시' · 산출 불가면 ''
 */
function _cwNowSijin(){
  try {
    const h = new Date().getHours();
    if (!isFinite(h)) return '';
    return CW_SIJIN_LABELS[Math.floor(((h + 1) % 24) / 2)] || '';
  } catch(e) { return ''; }
}

/**
 * 이 브라우저의 고유 시드를 **버킷 인덱스**로 축약한다.
 * ★시드 원문은 프롬프트에 넣지 않는다 — 나가는 것은 0~31 정수 하나뿐이라 서버·모델
 *   어느 쪽도 사용자를 되짚을 수 없다(한 버킷 = 전체의 1/32).
 * ★localStorage 를 못 쓰는 환경(사생활 보호 모드 등)에서는 **세션 한정 시드**로
 *   물러난다 — 그 경우 새로고침마다 버킷이 바뀌지만, 다양성은 오히려 늘고 잃는 것은
 *   「같은 사람에게 일관된 톤」뿐이다. 여기서 실패해 축을 통째로 빼는 것보다 낫다.
 * @returns {number} 0 ~ CW_DAILY_SEED_BUCKETS-1
 */
let _cwSeedMemo = null;
function _cwSeedBucket(){
  let seed = _cwSeedMemo;
  if (!seed) {
    try {
      seed = localStorage.getItem(CW_DAILY_SEED_KEY);
      if (!seed) {
        // ★암호학적 난수를 먼저 쓴다. 없으면 Math.random 2회로 충분한 폭을 만든다.
        const c = (typeof crypto !== 'undefined' && crypto && crypto.getRandomValues) ? crypto : null;
        if (c) {
          const b = new Uint32Array(2); c.getRandomValues(b);
          seed = b[0].toString(36) + b[1].toString(36);
        } else {
          seed = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
        }
        localStorage.setItem(CW_DAILY_SEED_KEY, seed);
      }
    } catch(e) {
      seed = _cwSeedMemo || (Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2));
    }
    _cwSeedMemo = seed;
  }
  // FNV-1a 32bit — 시드 문자열을 버킷으로 고르게 흩는다(암호용이 아니라 분산용이다).
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % CW_DAILY_SEED_BUCKETS;
}

/**
 * ★★세 축을 **서버가 이미 읽는 `personaTone`** 에 실을 문자열로 만든다.
 *   서버는 이 값을 systemPrompt 의 `캐릭터: ${personaTone}.` 자리에 그대로 보간한다
 *   (api/fortune.js:2342). 새 ctx 키를 만들지 않는 이유는 파일 상단 상수 블록 참조.
 * ★산출 못 한 축은 **문장에서 빠진다**(빈 문자열) — 값을 지어내 채우지 않는다.
 * ★세 축을 「사용자의 사주」로 오독하지 못하도록 **공통 정보임을 명시**하고
 *   문장에 옮기지 말라고 지시한다. 이것이 없으면 사주 없는 사용자에게
 *   일진이 「당신의 일간」으로 둔갑할 수 있다.
 * @returns {string} ★v788 — 전용 ctx 키 `variance` 값 (붙일 것이 없으면 ''). 종전의 personaTone 접미가 아니다.
 */
function _cwDailyVariance(){
  const parts = [];
  const iljin = _cwTodayIljin();
  if (iljin) parts.push('오늘 일진 ' + iljin + '일');
  const sijin = _cwNowSijin();
  if (sijin) parts.push('지금 ' + sijin);
  parts.push('성향 버킷 ' + _cwSeedBucket() + '/' + CW_DAILY_SEED_BUCKETS);
  // ★4번째 축 — 오늘 **몇 번째** 요청인가(유료 회원은 하루 3회다). 시진은 2시간 구획이라
  //   연달아 두 번 받으면 세 축이 전부 같아진다 — 같은 사람이 같은 답을 받는 그 경로를
  //   이 축이 닫는다. 값은 이미 `_getDailyCount` 가 세고 있던 것이라 새로 만든 정보가 아니다.
  try { parts.push('오늘 ' + (_getDailyCount() + 1) + '번째 청'); } catch(e) {}
  if (!parts.length) return '';
  return '【오늘의 변주 씨앗】' + parts.join(' · ') +
    '. 이 값들은 사용자의 사주가 아니라 오늘·지금의 공통 정보와 무작위 버킷이며, ' +
    '어조·비유·소재·시작 문장을 남과 다르게 고르는 씨앗으로만 쓰십시오. ' +
    '값이나 숫자를 답변 문장에 그대로 옮기지 말고, 사용자 개인의 사주로 해석하지 마십시오.';
}

// ============================================================
//  컨텍스트 수집 (사주·관상·타로·꿈·궁합·토정)
// ============================================================
function _gatherChatContext(){
  const ctx = {};
  if(window._sajuResultData){
    const s = window._sajuResultData;
    if(s.pillars){
      try {
        const _hs = (typeof HS !== 'undefined' && HS) ? HS : null;
        const _eb = (typeof EB !== 'undefined' && EB) ? EB : null;
        ctx.ilgan = (typeof HS_CH !== 'undefined' && HS_CH) ? HS_CH[s.pillars.day.stem] : (_hs ? _hs[s.pillars.day.stem] : '');
        ctx.ilganElement = s.ilganElement || (s.pillars.day && (typeof EL !== 'undefined' && EL) && (typeof HS_EL !== 'undefined' && HS_EL) ? EL[HS_EL[s.pillars.day.stem]] : '');
        if(_hs && _eb){
          ctx.yearPillar  = s.pillars.year  ? _hs[s.pillars.year.stem]  + _eb[s.pillars.year.branch]  : '';
          ctx.monthPillar = s.pillars.month ? _hs[s.pillars.month.stem] + _eb[s.pillars.month.branch] : '';
          ctx.dayPillar   = s.pillars.day   ? _hs[s.pillars.day.stem]   + _eb[s.pillars.day.branch]   : '';
          ctx.hourPillar  = s.pillars.hour  ? _hs[s.pillars.hour.stem]  + _eb[s.pillars.hour.branch]  : '(시간 미입력)';
        }
        if(s.pillars.hour && _eb){
          const branch = _eb[s.pillars.hour.branch];
          const hourLabels = {'자':'자시 (23:00~00:59)','축':'축시 (01:00~02:59)','인':'인시 (03:00~04:59)','묘':'묘시 (05:00~06:59)','진':'진시 (07:00~08:59)','사':'사시 (09:00~10:59)','오':'오시 (11:00~12:59)','미':'미시 (13:00~14:59)','신':'신시 (15:00~16:59)','유':'유시 (17:00~18:59)','술':'술시 (19:00~20:59)','해':'해시 (21:00~22:59)'};
          ctx.hourBranch = hourLabels[branch] || branch;
        }
        ctx.birth = s.birth || (s.solarY ? (s.solarY + '년 ' + s.solarM + '월 ' + s.solarD + '일') : (s.inputYear ? (s.inputYear + '년 ' + s.inputMonth + '월 ' + s.inputDay + '일' + (s.calType==='lunar' ? ' (음력)' : '')) : ''));
        ctx.gender = s.gender || '';
      } catch(e) {}
    }
    // ★v7.79 파 ⓑ — `dominant` 는 서버가 **한 번도 읽지 않는다**(daily_message 분기의 `c.dominant` 0건).
    //   v7.77 I-68(`naming.hangryeol`)과 같은 형태의 dangling 키이므로 제거한다.
    //   바로 아래 `lacking` 은 서버가 쓴다 — 남긴다. 검증: `eval_ctx_key_surface.js` K-2.
    ctx.lacking = s.lacking || '';
    // ★v7.79 계약 §2-1 (파 ⓑ) — 생년월일 **원본 6키**. 서버가 원국을 재유도해 교체한다(§3).
    //   ★값 출처는 `window._sajuResultData` 하나뿐이다 — 데일리 한 마디는 UI 가 생년월일을 안 받는다.
    //   ★산출식은 `index.html` 의 `cwBirthKeys` **한 곳뿐**이다(결정 99·113). 여기에 사본을 만들지 않는다.
    //     `js/chat.js` 는 별도 파일이라 이 함수보다 늦게 로드될 수 있으므로 존재를 확인하고 부른다
    //     (이 파일이 `HS`·`EB` 를 다루는 방식과 같다). 못 부르면 **6키를 아예 안 싣는다** —
    //     그때 서버는 `mode:'legacy'` 로 아무것도 안 바꾼다(계약 §6). 부분 적재가 최악이다.
    //   ★★사주가 없으면(`window._sajuResultData` 부재) 이 블록 자체가 안 돌아 6키가 0개다.
    //     없는 생년월일을 지어내지 않는다.
    var _bkC = (typeof cwBirthKeys === 'function')
      ? (cwBirthKeys(s.calType, s.inputYear, s.inputMonth, s.inputDay, s.hi, s.leap) || {}) : {};
    // ★적재는 **명시 리터럴**로 한다(계약 §2-3). 대입 헬퍼로 감싸면
    //   `eval_ctx_key_surface.js` 의 표면 추출기가 못 읽어 이 상품 표면이 통째로 사라진다.
    //   ★값이 `undefined` 면 `JSON.stringify` 가 키째 떨어뜨린다 — 전부 또는 전무.
    Object.assign(ctx, {cal:_bkC.cal,y:_bkC.y,m:_bkC.m,d:_bkC.d,h:_bkC.h,leap:_bkC.leap});
  }
  if(window._tarotResultData){
    const t = window._tarotResultData;
    if(t.cards && t.cards.length){
      ctx.tarotSummary = t.cards.map(function(c){return c.n + (c.reversed?'(역)':'');}).join(', ');
    }
  }
  if(window._faceResultData){
    const f = window._faceResultData;
    ctx.faceSummary = (f.result && f.result.summary) ? String(f.result.summary).substring(0,120) : '';
  }
  return ctx;
}

// ============================================================
//  메시지 렌더링 (간단한 카드 누적)
// ============================================================
function _addDailyCard(text, category, persona, luck){
  const c = document.getElementById('chatMessages');
  if(!c) return;
  const cat = DAILY_CATEGORIES.find(function(x){return x.k === category;}) || {n:'전반',e:'✨'};
  const luckHTML = luck ? _renderLuckCard(luck) : '';
  const d = document.createElement('div');
  d.className = 'chat-msg bot';
  d.innerHTML = '<div class="chat-avatar">' + persona.e + '</div>' +
    '<div class="chat-bubble">' +
    '<div style="font-size:10.5px;color:var(--gold);margin-bottom:6px">' + cat.e + ' ' + cat.n + ' · ' + persona.n + '의 한 마디</div>' +
    '<div>' + text.replace(/\n/g,'<br>').replace(/\*\*(.*?)\*\*/g,'<strong style="color:var(--gold)">$1</strong>') + '</div>' +
    luckHTML +
    '</div>';
  c.appendChild(d);
  // 새 카드 상단 정렬
  setTimeout(function(){
    const off = d.offsetTop - c.offsetTop - 8;
    c.scrollTop = Math.max(0, off);
  }, 80);
}

function _renderLuckCard(luck){
  // luck = "색:빨강|숫자:7|방위:동쪽|음식:따뜻한 차" 형식
  const items = String(luck).split('|').map(function(s){return s.trim();}).filter(Boolean);
  if(!items.length) return '';
  const cells = items.map(function(it){
    const parts = it.split(':').map(function(s){return s.trim();});
    const k = parts[0], v = parts[1];
    if(!v) return '';
    return '<div style="flex:1;min-width:70px;padding:5px 8px;background:rgba(0,0,0,.2);border-radius:6px;text-align:center"><div style="font-size:9px;color:var(--text2)">' + k + '</div><div style="font-size:11px;color:var(--gold);font-weight:600;margin-top:1px">' + v + '</div></div>';
  }).join('');
  return '<div style="margin-top:8px;padding:8px;background:rgba(201,165,78,.06);border:1px solid rgba(201,165,78,.18);border-radius:8px"><div style="font-size:10px;color:var(--gold);margin-bottom:5px;text-align:center">🍀 오늘의 행운</div><div style="display:flex;gap:5px;flex-wrap:wrap">' + cells + '</div></div>';
}

function _addBotInfo(text){
  const c = document.getElementById('chatMessages');
  if(!c) return;
  const d = document.createElement('div');
  d.className = 'chat-msg bot';
  d.innerHTML = '<div class="chat-avatar">💬</div><div class="chat-bubble" style="background:rgba(201,165,78,.06);border:1px dashed rgba(201,165,78,.2)"><div style="font-size:12px;color:var(--text2)">' + text + '</div></div>';
  c.appendChild(d);
  setTimeout(function(){ c.scrollTop = c.scrollHeight; }, 50);
}

function _showLoading(category){
  const c = document.getElementById('chatMessages');
  if(!c) return;
  const persona = CHAT_PERSONAS.find(function(p){return p.k === chatPersona;}) || CHAT_PERSONAS[0];
  const cat = DAILY_CATEGORIES.find(function(x){return x.k === category;}) || {n:'전반'};
  const msgs = {sun:'🔮 수정구슬을 바라봅니다...',do:'📜 사주 8글자를 읽는 중...',astro:'✨ 별의 속삭임을 듣는 중...'};
  const d = document.createElement('div');
  d.className = 'chat-msg bot'; d.id = 'dailyLoading';
  d.innerHTML = '<div class="chat-avatar">' + persona.e + '</div><div class="chat-bubble"><span style="font-size:12px;color:var(--gold);font-style:italic">' + (msgs[chatPersona] || msgs.sun) + ' (' + cat.n + ')</span> <span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>';
  c.appendChild(d);
  c.scrollTop = c.scrollHeight;
}
function _removeLoading(){
  const t = document.getElementById('dailyLoading'); if(t) t.remove();
}

// ============================================================
//  메인: 한 마디 받기
// ============================================================
async function fetchDailyMessage(category){
  const limit = _getDailyLimit();
  const used = _getDailyCount();
  if(used >= limit){
    const remain = _isPremiumActive() ? '' : ' (유료 회원은 일일 3회)';
    _addBotInfo('오늘은 ' + limit + '회 다 받으셨어요. 내일 다시 와주세요' + remain + '.');
    return;
  }
  const persona = CHAT_PERSONAS.find(function(p){return p.k === chatPersona;}) || CHAT_PERSONAS[0];
  const ctxData = _gatherChatContext();
  // ★★v7.86 ③ — 결정변수 4축(일진·시진·버킷·회차)을 싣는다.
  //   ★v788 P-786-C — 종전엔 `personaTone` 에 **덧붙여** 반송했다(v7.86 당시 서버가 작업 범위 밖이라).
  //     이제 서버(`api/fortune.js` daily_message 분기)가 **전용 키 `variance`** 를 읽어 systemPrompt 에
  //     별도 줄로 보간한다. `personaTone` 은 다시 순수 캐릭터 문안이다.
  //     새 키가 dangling 이 아님은 eval_ctx_key_surface K-2 · eval_dream_daily_guard C-2(PROMPT_KEYS_KNOWN) 가 못박는다.
  //   ★사주가 있는 사용자도 동일하다 — 기존 `ctxData`(=`ctxBlock` 재료)는 그대로 두고
  //     이 축을 **추가**만 한다. 사주 유무로 코드 경로가 갈리지 않는다.
  const ctx = Object.assign({}, ctxData, {
    personaName: persona.n,
    personaTone: persona.tone,
    variance: _cwDailyVariance(),
    category: (DAILY_CATEGORIES.find(function(x){return x.k === category;}) || {n:'전반'}).n
  });
  _showLoading(category);
  try {
    const resp = await fetch('/api/fortune', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({type:'daily_message', context: ctx})});
    const data = await resp.json();
    _removeLoading();
    if(!data.success || !data.result) throw new Error(cwErrMsg(data) || 'API 응답 오류');
    let answer = data.result.text || data.result.raw || '메시지를 받지 못했어요.';
    // 행운 정보 파싱
    let luck = null;
    const luckMatch = answer.match(/★LUCK★([^★]+)★/);
    if(luckMatch){ luck = luckMatch[1]; answer = answer.replace(luckMatch[0], '').trim(); }
    _incDailyCount();
    _addDailyCard(answer, category, persona, luck);
    // 잔여 안내
    const remaining = limit - _getDailyCount();
    if(remaining === 0){
      _addBotInfo('오늘 받을 수 있는 ' + limit + '회를 모두 사용하셨어요. 내일 다시 와주세요.' + (_isPremiumActive() ? '' : ' 💡 유료 회원(최근 30일 내 어느 프리미엄이든 결제)은 일일 3회 받습니다.'));
    } else {
      _addBotInfo('남은 횟수: ' + remaining + '/' + limit + (_isPremiumActive() ? ' · ✓ 유료 회원' : ''));
    }
  } catch(err){
    _removeLoading();
    console.error('Daily message error:', err);
    _addBotInfo('잠시 연결이 어려워요. 다시 시도해주세요.');
  }
}

// ============================================================
//  UI 헬퍼
// ============================================================
function _renderCategoryChips(){
  const w = document.getElementById('dailyCategoryChips');
  if(!w) return;
  w.innerHTML = '';
  DAILY_CATEGORIES.forEach(function(cat){
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.style.cssText = 'padding:10px 14px;background:rgba(201,165,78,.08);border:1px solid rgba(201,165,78,.3);border-radius:18px;color:var(--gold);font-size:12px;cursor:pointer;font-family:"Noto Sans KR",sans-serif;transition:all .2s';
    btn.innerHTML = cat.e + ' ' + cat.n;
    btn.onmouseover = function(){ btn.style.background = 'rgba(201,165,78,.2)'; };
    btn.onmouseout = function(){ btn.style.background = 'rgba(201,165,78,.08)'; };
    btn.onclick = function(){ fetchDailyMessage(cat.k); };
    w.appendChild(btn);
  });
}

function _renderStatusBadge(){
  const w = document.getElementById('dailyStatus');
  if(!w) return;
  const limit = _getDailyLimit();
  const used = _getDailyCount();
  const isPrem = _isPremiumActive();
  const days = _daysSinceLastPayment();
  const badge = isPrem ? '✓ 유료 회원' + (days != null ? ' (' + days + '일 전 결제)' : '') : '· 무료';
  w.innerHTML = '오늘 ' + used + '/' + limit + '회 받음 ' + badge;
}

function changeChatPersona(){
  const sel = document.getElementById('chatPersonaSelect');
  if(!sel) return;
  chatPersona = sel.value;
  const persona = CHAT_PERSONAS.find(function(p){return p.k === chatPersona;}) || CHAT_PERSONAS[0];
  const title = document.getElementById('chatTitle');
  if(title) title.textContent = persona.e + ' ' + persona.n + '의 데일리 한 마디';
  const msgs = document.getElementById('chatMessages');
  if(msgs) msgs.innerHTML = '';
  _addBotInfo(persona.greet);
  _renderStatusBadge();
}

function initChat(){
  // 옛 init이 남긴 인사·chip 지우고 새 UI 시작
  const msgs = document.getElementById('chatMessages');
  if(msgs) msgs.innerHTML = '';
  const sg = document.getElementById('chatSuggest');
  if(sg) sg.innerHTML = '';
  _renderCategoryChips();
  const persona = CHAT_PERSONAS.find(function(p){return p.k === chatPersona;}) || CHAT_PERSONAS[0];
  const title = document.getElementById('chatTitle');
  if(title) title.textContent = persona.e + ' ' + persona.n + '의 데일리 한 마디';
;
  _renderStatusBadge();
}

// 호환성 — 옛 채팅 함수 호출 시 안전
function sendChat(){
  _addBotInfo('이제 자유 채팅은 데일리 한 마디로 바뀌었어요. 위 분야 중 하나를 골라주세요.');
}

// 외부 chat.js 로드 완료 후 새 initChat 자동 호출
if(typeof window !== 'undefined'){
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(initChat, 100); });
  } else {
    setTimeout(initChat, 100);
  }
}
