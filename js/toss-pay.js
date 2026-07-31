// 천운 — Toss Payments 결제 통합
// 의존: window 전역, /api/confirm-payment 백엔드
// 사용: payWithToss('saju') 등 productKey로 결제창 호출

// ============================================================
//  설정
// ============================================================
// 클라이언트 키 (Toss Payments 발급, 새론 비즈 MID: fihubscj0k)
// 테스트 키 — 라이브 키 발급시 교체
const TOSS_CLIENT_KEY = window.__TOSS_CLIENT_KEY__ || 'test_ck_DpexMgkW36wKXn24okn4VGbR5ozO';

// 가격·상품명 매핑
const TOSS_PRICING = {
  saju:          { amount: 4900, orderName: '천운 사주 프리미엄 리포트' },
  compat:        { amount: 4900, orderName: '천운 궁합 프리미엄 리포트' },
  tojeong:       { amount: 4900, orderName: '천운 토정비결 프리미엄 리포트' },
  dream:         { amount: 4900, orderName: '천운 꿈해몽 프리미엄 리포트' },
  face:          { amount: 4900, orderName: '천운 관상 프리미엄 리포트' },
  tarot:         { amount: 4900, orderName: '천운 타로 프리미엄 리포트' },
  naming:        { amount: 29900, orderName: '천운 작명 프리미엄 리포트' },
  naming_company:{ amount: 29900, orderName: '천운 회사 작명 프리미엄 리포트' },
  naming_product:{ amount: 29900, orderName: '천운 제품 작명 프리미엄 리포트' }
};

const TOSS_SDK_URL = 'https://js.tosspayments.com/v2/standard';

// 매핑: productKey → 결과 element id / window 데이터 변수 / 탭 / unlock 함수
const _RESULT_EL_MAP = {
  saju:'sajuResult', compat:'compatResult', tojeong:'tojeongResult',
  dream:'dreamResult', face:'faceResult', tarot:'tarotResult',
  naming:'namingResult', naming_company:'namingResult', naming_product:'namingResult'
};
const _RESULT_DATA_MAP = {
  saju:'_sajuResultData', compat:'_compatResultData', tojeong:'_tojeongResultData',
  dream:'_dreamResultData', face:'_faceResultData', tarot:'_tarotResultData',
  naming:'_namingResultData', naming_company:'_namingResultData', naming_product:'_namingResultData'
};
const _TAB_MAP = {
  saju:'saju', compat:'compat', tojeong:'tojeong', dream:'dream',
  face:'face', tarot:'tarot',
  naming:'naming', naming_company:'naming', naming_product:'naming'
};
const _UNLOCK_FN_MAP = {
  saju:'unlockSajuPremium', compat:'unlockCompatPremium', tojeong:'unlockTojeongPremium',
  dream:'unlockDreamPremium', tarot:'unlockTarotPremium',
  naming:'unlockNamingPremium', naming_company:'unlockNamingPremium', naming_product:'unlockNamingPremium'
};

// ============================================================
//  v7.66 P1-AUTH 안 B — 프리미엄 서명 토큰 보관·전송
// ============================================================
// ★서버(api/fortune.js)는 프리미엄 type 요청에 HMAC 서명 토큰을 요구한다.
//   토큰은 /api/confirm-payment 가 Toss 검증에 성공했을 때만 발급된다.
//   localStorage 의 cw_entitlements 는 UI 표시용일 뿐 더 이상 서버 관문이 아니다.
// ★함정 주의 — naming·naming_company·naming_product 는 무료 type 이름이기도 하다.
//   아래 맵은 명시 화이트리스트이며 접두어 매칭을 절대 쓰지 않는다.
//   맵에 없는 type(무료 작명 포함)은 헤더를 붙이지 않고 그대로 나간다.
const CW_PREMIUM_TOKEN_STORE = 'cw_premium_tokens';
const CW_PREMIUM_TYPE_TO_PRODUCT = {
  saju_premium_1: 'saju',                     saju_premium_2: 'saju',
  compat_premium_1: 'compat',                 compat_premium_2: 'compat',
  tojeong_premium_1: 'tojeong',               tojeong_premium_2: 'tojeong',
  dream_premium_1: 'dream',                   dream_premium_2: 'dream',
  face_premium_1: 'face',                     face_premium_2: 'face',
  tarot_premium_1: 'tarot',                   tarot_premium_2: 'tarot',
  naming_premium_1: 'naming',                 naming_premium_2: 'naming',
  naming_company_premium_1: 'naming_company', naming_company_premium_2: 'naming_company',
  naming_product_premium_1: 'naming_product'
};

function _cwReadTokenStore(){
  try {
    const raw = JSON.parse(localStorage.getItem(CW_PREMIUM_TOKEN_STORE) || '{}');
    return (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
  } catch(e){ return {}; }
}
function _cwSavePremiumToken(productKey, token, exp){
  if(!productKey || typeof token !== 'string' || !token) return;
  try {
    const store = _cwReadTokenStore();
    store[productKey] = { t: token, exp: (typeof exp === 'number' ? exp : 0) };
    localStorage.setItem(CW_PREMIUM_TOKEN_STORE, JSON.stringify(store));
  } catch(e){}
}
// 만료된 토큰은 반환하지 않는다(서버도 어차피 거부한다).
function cwGetPremiumToken(productKey){
  if(!productKey) return '';
  const e = _cwReadTokenStore()[productKey];
  if(!e || typeof e.t !== 'string' || !e.t) return '';
  if(typeof e.exp === 'number' && e.exp > 0 && Date.now() >= e.exp) return '';
  return e.t;
}

// ---- fetch 패치: 프리미엄 요청에만 토큰 헤더를 붙인다 -------------------------
// ★index.html 19곳 · js/tarot.js 2곳 등 호출부가 흩어져 있어 한 곳에서 가로챈다.
//   무료 요청은 손대지 않으므로 무료 경로 회귀가 발생할 수 없다.
(function(){
  if(typeof window === 'undefined' || !window.fetch || window.__cwFetchPatched) return;
  window.__cwFetchPatched = true;
  const _origFetch = window.fetch.bind(window);
  window.fetch = function(input, init){
    try {
      const url = (typeof input === 'string') ? input : ((input && input.url) || '');
      if(url.indexOf('/api/fortune') !== -1 && init && typeof init.body === 'string'){
        const parsed = JSON.parse(init.body);
        const pk = parsed && CW_PREMIUM_TYPE_TO_PRODUCT[parsed.type];
        if(pk){
          const tok = cwGetPremiumToken(pk);
          if(tok){
            const h = Object.assign({}, init.headers || {});
            h['x-cw-premium-token'] = tok;
            init = Object.assign({}, init, { headers: h });
          }
        }
      }
    } catch(e){ /* 파싱 실패 시 원본 그대로 통과 — 무료 경로 보호 */ }
    return _origFetch(input, init);
  };
})();

// ---- 구 결제자 부트스트랩 ---------------------------------------------------
// ★v7.66 이전 결제자는 cw_receipts 에 paymentKey·orderId 는 있으나 토큰이 없다.
//   서버에 원장이 없으므로 서버가 「진짜 영수증」을 스스로 판별할 수 없다.
//   따라서 Toss 에 1회 재조회를 시켜 검증받고 토큰을 받아 온다(결제당 1회, 이후 0회).
//   ★Toss 조회가 실패하면 토큰은 나오지 않는다(fail-closed).
let _cwBootstrapRan = false;
async function cwBootstrapLegacyReceipts(){
  if(_cwBootstrapRan) return;
  _cwBootstrapRan = true;
  let receipts = [];
  try { receipts = JSON.parse(localStorage.getItem('cw_receipts') || '[]') || []; } catch(e){ return; }
  if(!Array.isArray(receipts) || receipts.length === 0) return;
  const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
  const seen = {};
  for(const r of receipts){
    if(!r || typeof r.productKey !== 'string' || !r.productKey) continue;
    if(typeof r.paymentKey !== 'string' || !r.paymentKey) continue;
    if(typeof r.orderId !== 'string' || !r.orderId) continue;
    if(typeof r.amount !== 'number') continue;
    if(seen[r.productKey]) continue;                      // 상품당 1건이면 충분
    let t = Date.parse(r.approvedAt || '');
    if(!isNaN(t) && (Date.now() - t) >= WINDOW_MS) continue;   // 30일 지난 영수증은 제외
    if(cwGetPremiumToken(r.productKey)) { seen[r.productKey] = true; continue; }
    seen[r.productKey] = true;
    try {
      const resp = await fetch('/api/confirm-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bootstrap',
          paymentKey: r.paymentKey,
          orderId: r.orderId,
          amount: r.amount
        })
      });
      const data = await resp.json();
      if(resp.ok && data && data.success && data.premiumToken){
        _cwSavePremiumToken(data.productKey || r.productKey, data.premiumToken, data.premiumTokenExp);
      }
    } catch(e){ /* fail-closed — 토큰 없이 진행. 프리미엄은 서버가 거부한다. */ }
  }
}

// ============================================================
//  헬퍼
// ============================================================
// P0(신뢰부채): 상품별 권한만 신뢰 — 크로스-언락 누수 차단.
// 상품키 없이 호출되면 결제를 스킵하지 않는다(누수 방지).
// ★v7.66 P1-AUTH — 로컬 엔티틀먼트만으로 결제를 건너뛰면, 서명 토큰이 없는 상태로
//   프리미엄 요청이 나가 서버에서 거부당한다(사용자에겐 「결제했는데 안 된다」로 보인다).
//   그래서 서버가 실제로 인정하는 조건(유효 토큰 보유)까지 함께 만족해야 스킵한다.
function _isPremiumPaidActive(productKey){
  try {
    if(productKey && typeof window.isPremiumActiveFor === 'function'){
      return window.isPremiumActiveFor(productKey) && !!cwGetPremiumToken(productKey);
    }
    return false;
  } catch(e) { return false; }
}

function _getOrCreateCustomerKey(){
  try {
    let k = localStorage.getItem('cw_customer_key');
    if(!k){
      const rnd = () => Math.random().toString(36).slice(2);
      k = 'cw_' + rnd() + rnd() + '_' + Date.now().toString(36);
      k = k.substring(0, 50);
      localStorage.setItem('cw_customer_key', k);
    }
    return k;
  } catch(e) {
    return 'cw_anonymous_' + Date.now();
  }
}

function _genOrderId(productKey){
  const rnd = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return ('cw_' + productKey + '_' + ts + '_' + rnd).substring(0, 64).replace(/[^A-Za-z0-9_=-]/g, '_');
}

let _tossSdkPromise = null;
function _loadTossSDK(){
  if(_tossSdkPromise) return _tossSdkPromise;
  _tossSdkPromise = new Promise(function(resolve, reject){
    if(typeof TossPayments !== 'undefined') return resolve();
    const s = document.createElement('script');
    s.src = TOSS_SDK_URL;
    s.async = true;
    s.onload = function(){ resolve(); };
    s.onerror = function(){ reject(new Error('Toss SDK 로드 실패')); };
    document.head.appendChild(s);
  });
  return _tossSdkPromise;
}

// ============================================================
//  결제 요청 (메인 API)
// ============================================================
async function payWithToss(productKey){
  const p = TOSS_PRICING[productKey];
  if(!p){
    alert('알 수 없는 상품: ' + productKey);
    return false;
  }

  // 이미 이 상품을 30일 이내 결제했으면 결제 skip (상품별)
  if(_isPremiumPaidActive(productKey)){
    if(typeof showToast === 'function') showToast('이미 결제하신 프리미엄입니다 — 바로 분석을 받습니다');
    return true;
  }

  // 키 미설정시 fallback
  if(TOSS_CLIENT_KEY.indexOf('PLACEHOLDER') >= 0){
    const useTestMode = confirm(
      '⚠️ Toss Payments API 키가 아직 설정되지 않았습니다.\n\n' +
      '테스트 모드로 진행하시겠습니까?\n(실제 결제 없이 콘텐츠 unlock)'
    );
    if(!useTestMode) return false;
    if(window.markPremiumPayment) window.markPremiumPayment(productKey);
    if(typeof showToast === 'function') showToast('테스트 모드 결제 완료');
    return true;
  }

  try {
    await _loadTossSDK();
    const tossPayments = TossPayments(TOSS_CLIENT_KEY);
    const customerKey = _getOrCreateCustomerKey();
    const payment = tossPayments.payment({ customerKey: customerKey });
    const orderId = _genOrderId(productKey);

    // 결제 요청 정보
    sessionStorage.setItem('cw_pending_payment', JSON.stringify({
      orderId: orderId,
      productKey: productKey,
      amount: p.amount,
      orderName: p.orderName,
      ts: Date.now()
    }));

    // 결제 후 자동 복원을 위해 — 결과 DOM + 데이터 저장
    try {
      const resultElId = _RESULT_EL_MAP[productKey];
      const dataKey = _RESULT_DATA_MAP[productKey];
      if(resultElId){
        const el = document.getElementById(resultElId);
        if(el && el.innerHTML){
          sessionStorage.setItem('cw_resume_result_html', el.innerHTML);
          sessionStorage.setItem('cw_resume_result_target', resultElId);
        }
      }
      if(dataKey && window[dataKey] !== undefined){
        try {
          const json = JSON.stringify(window[dataKey]);
          sessionStorage.setItem('cw_resume_data_key', dataKey);
          sessionStorage.setItem('cw_resume_data_value', json);
        } catch(serErr) { /* 직렬화 불가 — 결과 카드만 복원 */ }
      }
    } catch(e) { console.warn('[Toss] 결과 저장 실패:', e); }

    const origin = window.location.origin;
    await payment.requestPayment({
      method: 'CARD',
      amount: { currency: 'KRW', value: p.amount },
      orderId: orderId,
      orderName: p.orderName,
      successUrl: origin + '/?paymentResult=success',
      failUrl: origin + '/?paymentResult=fail',
      card: { flowMode: 'DEFAULT', useEscrow: false, useCardPoint: false, useAppCardOnly: false }
    });
    return true;
  } catch(err) {
    console.error('[Toss] 결제 요청 오류:', err);
    if(err && err.code === 'USER_CANCEL'){
      if(typeof showToast === 'function') showToast('결제가 취소되었습니다');
    } else {
      alert('결제 요청 중 오류가 발생했습니다.\n' + ((err && err.message) || '잠시 후 다시 시도해주세요'));
    }
    sessionStorage.removeItem('cw_pending_payment');
    return false;
  }
}

// ============================================================
//  successUrl 콜백 처리
// ============================================================
async function _handleTossSuccessCallback(){
  const params = new URLSearchParams(window.location.search);
  const result = params.get('paymentResult');
  if(!result) return;

  const cleanUrl = window.location.origin + window.location.pathname;

  if(result === 'fail'){
    const code = params.get('code') || '';
    const message = params.get('message') || '결제가 실패했습니다.';
    if(code !== 'USER_CANCEL' && code !== 'PAY_PROCESS_CANCELED'){
      alert('결제 실패\n\n' + message + (code ? '\n\n코드: ' + code : ''));
    }
    sessionStorage.removeItem('cw_pending_payment');
    sessionStorage.removeItem('cw_resume_result_html');
    sessionStorage.removeItem('cw_resume_result_target');
    sessionStorage.removeItem('cw_resume_data_key');
    sessionStorage.removeItem('cw_resume_data_value');
    window.history.replaceState(null, '', cleanUrl);
    return;
  }

  if(result !== 'success') return;

  const paymentKey = params.get('paymentKey');
  const orderId = params.get('orderId');
  const amount = parseInt(params.get('amount'), 10);

  if(!paymentKey || !orderId || !amount){
    alert('결제 정보가 잘못되었습니다');
    window.history.replaceState(null, '', cleanUrl);
    return;
  }

  let pending = null;
  try { pending = JSON.parse(sessionStorage.getItem('cw_pending_payment') || 'null'); } catch(e){}
  if(!pending || pending.orderId !== orderId || pending.amount !== amount){
    alert('결제 정보가 일치하지 않습니다. 결제가 취소되었습니다.');
    window.history.replaceState(null, '', cleanUrl);
    return;
  }

  if(typeof showToast === 'function') showToast('결제를 승인하고 있습니다...');
  try {
    const resp = await fetch('/api/confirm-payment', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ paymentKey: paymentKey, orderId: orderId, amount: amount })
    });
    const data = await resp.json();
    if(!resp.ok || !data.success){
      throw new Error((data && data.error && data.error.message) || data.error || 'HTTP ' + resp.status);
    }
    // ★v7.66 P1-AUTH — 서명 토큰이 없으면 프리미엄을 열 수 없다(서버가 거부한다).
    //   토큰 없는 성공 응답은 서버 설정 사고이므로 조용히 넘기지 않고 실패로 처리한다.
    if(!data.premiumToken){
      throw new Error('이용권 발급에 실패했습니다 (서버 설정 확인 필요). 고객센터로 주문번호를 알려주세요');
    }
    _cwSavePremiumToken(data.productKey || pending.productKey, data.premiumToken, data.premiumTokenExp);

    _saveReceipt({
      productKey: pending.productKey,
      orderId: orderId,
      paymentKey: paymentKey,
      amount: amount,
      orderName: pending.orderName,
      approvedAt: (data.payment && data.payment.approvedAt) || new Date().toISOString(),
      method: (data.payment && data.payment.method) || '카드'
    });
    sessionStorage.removeItem('cw_pending_payment');

    if(window.markPremiumPayment) window.markPremiumPayment(pending.productKey);

    window.history.replaceState(null, '', cleanUrl);

    // 자동 복원·자동 unlock
    const productKey = pending.productKey;
    const targetTab = _TAB_MAP[productKey];
    const resumeHtml = sessionStorage.getItem('cw_resume_result_html');
    const resumeTarget = sessionStorage.getItem('cw_resume_result_target');
    const resumeDataKey = sessionStorage.getItem('cw_resume_data_key');
    const resumeDataValue = sessionStorage.getItem('cw_resume_data_value');

    if(resumeDataKey && resumeDataValue){
      try { window[resumeDataKey] = JSON.parse(resumeDataValue); } catch(e){}
    }

    if(typeof showToast === 'function') showToast('✓ 결제 완료 — 프리미엄 리포트 준비 중...');

    // 1) 탭 이동
    setTimeout(function(){
      if(targetTab){
        const btn = document.querySelector('[data-tab="'+targetTab+'"]');
        if(btn) btn.click();
      }
    }, 300);

    // 2) 결과 카드 DOM 복원
    setTimeout(function(){
      if(resumeHtml && resumeTarget){
        const el = document.getElementById(resumeTarget);
        if(el){
          el.innerHTML = resumeHtml;
          el.style.display = 'block';
          if(el.classList && !el.classList.contains('show')) el.classList.add('show');
          el.scrollIntoView({behavior:'smooth', block:'start'});
        }
      }
      sessionStorage.removeItem('cw_resume_result_html');
      sessionStorage.removeItem('cw_resume_result_target');
      sessionStorage.removeItem('cw_resume_data_key');
      sessionStorage.removeItem('cw_resume_data_value');
    }, 700);

    // 3) 자동 unlock
    setTimeout(function(){
      const unlockFnName = _UNLOCK_FN_MAP[productKey];
      if(unlockFnName && typeof window[unlockFnName] === 'function'){
        window[unlockFnName]();
      } else if(productKey === 'face' && typeof window.handlePremiumPurchase === 'function'){
        window.handlePremiumPurchase('face');
      } else {
        alert(
          '✓ 결제 완료!\n\n' + pending.orderName + '\n₩' + amount.toLocaleString() + '\n\n' +
          '프리미엄 분석 버튼을 다시 눌러주세요. 결제 회원으로 자동 인식됩니다.\n' +
          '※ 30일간 모든 프리미엄 무제한'
        );
      }
    }, 1500);
  } catch(err) {
    console.error('[Toss] 승인 실패:', err);
    alert('결제 승인 중 오류가 발생했습니다.\n\n' + ((err && err.message) || '고객센터에 문의해주세요') + '\n\n주문번호: ' + orderId);
    window.history.replaceState(null, '', cleanUrl);
  }
}

function _saveReceipt(receipt){
  try {
    const list = JSON.parse(localStorage.getItem('cw_receipts') || '[]');
    list.unshift(receipt);
    if(list.length > 50) list.length = 50;
    localStorage.setItem('cw_receipts', JSON.stringify(list));
  } catch(e) {}
}

function getReceipts(){
  try { return JSON.parse(localStorage.getItem('cw_receipts') || '[]'); }
  catch(e) { return []; }
}

if(typeof window !== 'undefined'){
  window.payWithToss = payWithToss;
  window.getTossReceipts = getReceipts;
  // v7.66 P1-AUTH — 토큰 접근자 공개(다른 모듈이 UI 판정에 쓸 수 있게)
  window.cwGetPremiumToken = cwGetPremiumToken;
  window.cwBootstrapLegacyReceipts = cwBootstrapLegacyReceipts;
  const _cwInit = function(){
    _handleTossSuccessCallback();
    // 결제 콜백 처리 뒤에 구 영수증 부트스트랩을 돌린다(신규 토큰을 덮어쓰지 않게).
    setTimeout(function(){ cwBootstrapLegacyReceipts(); }, 1200);
  };
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', _cwInit);
  } else {
    setTimeout(_cwInit, 0);
  }
}
