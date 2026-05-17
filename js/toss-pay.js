// 천운 — Toss Payments 결제 통합
// 의존: window 전역, /api/confirm-payment 백엔드
// 사용: payWithToss('saju') 등 productKey로 결제창 호출

// ============================================================
//  설정 (실제 키는 빌드 시점 또는 환경에서 주입)
// ============================================================
// 클라이언트 키 (Toss Payments 발급, 새론 비즈 MID: fihubscj0k)
// 테스트 키 — 라이브 키 발급시 교체
const TOSS_CLIENT_KEY = window.__TOSS_CLIENT_KEY__ || 'test_ck_DpexMgkW36wKXn24okn4VGbR5ozO';

// 가격·상품명 매핑 (productKey → {amount, orderName, unlockFn})
const TOSS_PRICING = {
  // 일반 ₩4,900
  saju:          { amount: 4900, orderName: '천운 사주 프리미엄 리포트' },
  compat:        { amount: 4900, orderName: '천운 궁합 프리미엄 리포트' },
  tojeong:       { amount: 4900, orderName: '천운 토정비결 프리미엄 리포트' },
  dream:         { amount: 4900, orderName: '천운 꿈해몽 프리미엄 리포트' },
  face:          { amount: 4900, orderName: '천운 관상 프리미엄 리포트' },
  tarot:         { amount: 4900, orderName: '천운 타로 프리미엄 리포트' },
  // 작명 ₩29,900
  naming:        { amount: 29900, orderName: '천운 작명 프리미엄 리포트' },
  naming_company:{ amount: 29900, orderName: '천운 회사 작명 프리미엄 리포트' },
  naming_product:{ amount: 29900, orderName: '천운 제품 작명 프리미엄 리포트' }
};

// SDK URL
const TOSS_SDK_URL = 'https://js.tosspayments.com/v2/standard';

// ============================================================
//  customerKey 생성·보관 (UUID 유사, 비회원 식별용)
// ============================================================
function _getOrCreateCustomerKey(){
  try {
    let k = localStorage.getItem('cw_customer_key');
    if(!k){
      // UUID v4 유사 (2~50자, 영문대소문자·숫자·_-=. 허용)
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

// orderId 생성 (영문 대소문자·숫자·-_= 6~64자)
function _genOrderId(productKey){
  const rnd = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return ('cw_' + productKey + '_' + ts + '_' + rnd).substring(0, 64).replace(/[^A-Za-z0-9_=-]/g, '_');
}

// ============================================================
//  SDK 동적 로드
// ============================================================
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

// 이미 결제된 활성 회원인지 (30일 이내) — 이중 결제 방지
function _isPremiumPaidActive(){
  try {
    const ts = parseInt(localStorage.getItem('cw_premium_last_payment') || '0', 10);
    if(!ts) return false;
    const days30 = 30 * 24 * 60 * 60 * 1000;
    return (Date.now() - ts) < days30;
  } catch(e) { return false; }
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

  // 이미 30일 이내 결제 회원이면 결제 skip (이중 결제 방지)
  if(_isPremiumPaidActive()){
    if(typeof showToast === 'function') showToast('이미 결제하신 프리미엄 회원입니다 — 바로 분석을 받습니다');
    return true;
  }

  // 키 미설정 안내 (테스트 키 없을 때 fallback)
  if(TOSS_CLIENT_KEY.indexOf('PLACEHOLDER') >= 0){
    const useTestMode = confirm(
      '⚠️ Toss Payments API 키가 아직 설정되지 않았습니다.\n\n' +
      '테스트 모드로 진행하시겠습니까?\n(실제 결제 없이 콘텐츠 unlock)\n\n' +
      '※ 정식 출시 후 실제 결제로 전환됩니다.'
    );
    if(!useTestMode) return false;
    // 테스트 모드: 즉시 결제 마킹
    if(window.markPremiumPayment) window.markPremiumPayment();
    if(typeof showToast === 'function') showToast('테스트 모드 결제 완료');
    return true;
  }

  try {
    await _loadTossSDK();
    const tossPayments = TossPayments(TOSS_CLIENT_KEY);
    const customerKey = _getOrCreateCustomerKey();
    const payment = tossPayments.payment({ customerKey: customerKey });
    const orderId = _genOrderId(productKey);

    // 결제 요청 전 임시 정보 저장 (successUrl 콜백에서 검증)
    sessionStorage.setItem('cw_pending_payment', JSON.stringify({
      orderId: orderId,
      productKey: productKey,
      amount: p.amount,
      orderName: p.orderName,
      ts: Date.now()
    }));

    const origin = window.location.origin;
    // 결제 요청 — Redirect 방식 (모바일·PC 통합)
    await payment.requestPayment({
      method: 'CARD',
      amount: { currency: 'KRW', value: p.amount },
      orderId: orderId,
      orderName: p.orderName,
      successUrl: origin + '/?paymentResult=success',
      failUrl: origin + '/?paymentResult=fail',
      card: { flowMode: 'DEFAULT', useEscrow: false, useCardPoint: false, useAppCardOnly: false }
    });
    // 리다이렉트되므로 여기 도달 안 함
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
//  — 페이지 로드 시 자동 검증 → 결제 승인 API 호출 → 콘텐츠 unlock
// ============================================================
async function _handleTossSuccessCallback(){
  const params = new URLSearchParams(window.location.search);
  const result = params.get('paymentResult');
  if(!result) return;

  // 쿼리 파라미터 즉시 정리 (URL에 paymentKey 노출 안 함)
  const cleanUrl = window.location.origin + window.location.pathname;

  if(result === 'fail'){
    const code = params.get('code') || '';
    const message = params.get('message') || '결제가 실패했습니다.';
    if(code !== 'USER_CANCEL' && code !== 'PAY_PROCESS_CANCELED'){
      alert('결제 실패\n\n' + message + (code ? '\n\n코드: ' + code : ''));
    }
    sessionStorage.removeItem('cw_pending_payment');
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

  // 임시 저장 정보와 amount 일치 검증 (변조 방지)
  let pending = null;
  try { pending = JSON.parse(sessionStorage.getItem('cw_pending_payment') || 'null'); } catch(e){}
  if(!pending || pending.orderId !== orderId || pending.amount !== amount){
    alert('결제 정보가 일치하지 않습니다. 결제가 취소되었습니다.');
    window.history.replaceState(null, '', cleanUrl);
    return;
  }

  // 백엔드에 결제 승인 요청
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

    // 결제 영수증 저장 (localStorage)
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

    // 결제 마킹 → 프리미엄 활성화
    if(window.markPremiumPayment) window.markPremiumPayment();

    // URL 정리
    window.history.replaceState(null, '', cleanUrl);

    // 결제한 분석 탭으로 자동 이동
    const tabMap = {
      saju:'saju', compat:'compat', tojeong:'tojeong', dream:'dream',
      face:'face', tarot:'tarot',
      naming:'naming', naming_company:'naming', naming_product:'naming'
    };
    const targetTab = tabMap[pending.productKey];
    if(targetTab){
      setTimeout(function(){
        const btn = document.querySelector('[data-tab="'+targetTab+'"]');
        if(btn) btn.click();
      }, 600);
    }

    // 사용자에게 알림 + 명확한 다음 단계 안내
    if(typeof showToast === 'function') showToast('✓ 결제가 완료되었습니다');
    setTimeout(function(){
      alert(
        '✓ 결제 완료!\n\n' +
        pending.orderName + '\n금액: ₩' + amount.toLocaleString() + '\n\n' +
        '【프리미엄 리포트 받는 법】\n' +
        '결제하신 분석 페이지로 이동했습니다.\n' +
        '입력하신 정보를 동일하게 다시 입력하고 "분석" 버튼을 누르세요.\n' +
        '결제 완료 회원으로 자동 인식되어 프리미엄 리포트가 바로 표시됩니다.\n\n' +
        '※ 결제는 30일간 유효 — 이 기간 동안 모든 프리미엄 분석 무제한 이용'
      );
    }, 800);
  } catch(err) {
    console.error('[Toss] 승인 실패:', err);
    alert('결제 승인 중 오류가 발생했습니다.\n\n' + ((err && err.message) || '고객센터에 문의해주세요') + '\n\n주문번호: ' + orderId);
    window.history.replaceState(null, '', cleanUrl);
  }
}

// ============================================================
//  영수증 보관 (localStorage)
// ============================================================
function _saveReceipt(receipt){
  try {
    const list = JSON.parse(localStorage.getItem('cw_receipts') || '[]');
    list.unshift(receipt);
    // 최근 50건만 유지
    if(list.length > 50) list.length = 50;
    localStorage.setItem('cw_receipts', JSON.stringify(list));
  } catch(e) {}
}

function getReceipts(){
  try { return JSON.parse(localStorage.getItem('cw_receipts') || '[]'); }
  catch(e) { return []; }
}

// ============================================================
//  전역 노출 + 자동 콜백 처리
// ============================================================
if(typeof window !== 'undefined'){
  window.payWithToss = payWithToss;
  window.getTossReceipts = getReceipts;
  // 페이지 로드 시 successUrl 콜백 자동 처리
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', _handleTossSuccessCallback);
  } else {
    setTimeout(_handleTossSuccessCallback, 0);
  }
}
