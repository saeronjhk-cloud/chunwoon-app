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
//  헬퍼
// ============================================================
// P0(신뢰부채): 상품별 권한만 신뢰 — 크로스-언락 누수 차단.
// 상품키 없이 호출되면 결제를 스킵하지 않는다(누수 방지).
function _isPremiumPaidActive(productKey){
  try {
    if(productKey && typeof window.isPremiumActiveFor === 'function'){
      return window.isPremiumActiveFor(productKey);
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
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', _handleTossSuccessCallback);
  } else {
    setTimeout(_handleTossSuccessCallback, 0);
  }
}
