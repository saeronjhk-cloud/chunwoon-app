// 천운 — Toss Payments 결제 통합
// 의존: window 전역, /api/confirm-payment 백엔드
// 사용: payWithToss('saju') 등 productKey로 결제창 호출

// ============================================================
//  설정
// ============================================================
// ★★v7.82 B-11 — **결제 계약 명의가 사이트 표기와 갈립니다.**
//   현재 값은 토스 **공용 테스트 키**(`test_ck_…`)라 실제 결제가 일어나지 않으므로
//   당장 문제는 없습니다. 그러나 종전 MID `fihubscj0k` 는 ★**개인사업자 「새론 비즈」
//   (470-54-00648)** 명의로 발급된 것이고, v7.82 에서 사이트 표기·처리방침·이용약관을
//   전부 ★**주식회사 새론미디어(606-86-65033)** 로 바꿨습니다.
//   ⟹ ★**라이브 키는 반드시 새론미디어 명의로 새로 발급**받으십시오. 구 명의 키로 열면
//     「사이트가 고지한 사업자」와 「실제 정산·환불 주체」가 달라져, 전자상거래법상
//     사업자 표시 위반이자 환불 분쟁 시 책임 주체가 불명확해집니다.
//   ★함께 바꿔야 하는 것: `TOSS_SECRET_KEY`(Vercel 환경변수) · 구매안전서비스 이용
//     확인증(통신판매업 신고에 필요) · 정산 계좌.
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
//  ★★v7.82 B-7 — 청약철회 제한 **사전 동의** (전자상거래법 §17②5)
// ============================================================
// 【왜 필요한가】
//   프리미엄 리포트는 「결과가 생성·열람되면 제공이 완료되는 디지털 콘텐츠」다.
//   전자상거래법 §17②5 는 그런 재화의 청약철회를 제한할 수 있게 하지만,
//   ★**그 사실을 사전에 고지하고 동의를 받은 경우에만** 제한이 유효하다.
//   동의 없이 이용약관에 「열람 후 환불 불가」라고만 적으면 **그 조항이 무효**이고,
//   7일 이내 청약철회를 전부 받아줘야 한다. ⟹ 약관 문구만으로는 닫히지 않는다.
//
// 【★단일 관문 — 호출부를 열거하지 않는다 (결정 127)】
//   `payWithToss` 는 결제로 가는 **유일한 경로**다(실측: index.html 6곳 + js/tarot.js 1곳,
//   전부 `window.payWithToss(...)`). ⟹ 여기 한 곳에 걸면 **전 상품이 자동으로 덮인다.**
//   상품별 결제 버튼에 각각 붙이면 새 상품을 추가할 때 조용히 빠진다(v7.73 관통 #4 의 형태).
//
// 【★거래마다 받는다 — 기억하지 않는다】
//   `localStorage` 에 「동의함」을 저장하면 **다음 결제는 동의 없이 지나간다.**
//   청약철회 제한은 **거래별 사전 동의**가 있어야 유효하므로 매번 묻는다.
//   ★이것은 UX 손해가 아니라 **조항을 유효하게 만드는 조건**이다.
//
// 【기본값】 체크박스는 **해제 상태**로 시작하고, 체크 전에는 결제 버튼이 비활성이다.
//   미리 체크해 두면 「동의를 받았다」고 보기 어렵다.
function _confirmPurchaseTerms(productKey, p){
  return new Promise(function(resolve){
    const prev = document.getElementById('cwPurchaseConsent');
    if(prev) prev.remove();
    const won = (p.amount || 0).toLocaleString('ko-KR');
    const ov = document.createElement('div');
    ov.id = 'cwPurchaseConsent';
    ov.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:20px';
    let done = false;
    const finish = function(v){ if(done) return; done = true; ov.remove(); resolve(v); };
    ov.onclick = function(e){ if(e.target === ov) finish(false); };
    ov.innerHTML =
      '<div style="width:100%;max-width:400px;max-height:86vh;overflow-y:auto;background:#12121e;border:1px solid rgba(201,165,78,.25);border-radius:16px;padding:22px">' +
        '<div style="font-size:15px;color:#c9a54e;font-family:\'Noto Serif KR\',serif;margin-bottom:14px">구매 확인</div>' +
        '<div style="background:rgba(201,165,78,.07);border:1px solid rgba(201,165,78,.15);border-radius:10px;padding:12px;margin-bottom:14px">' +
          '<div style="font-size:13px;color:#e8e6e0;margin-bottom:4px">' + _esc(p.orderName || productKey) + '</div>' +
          '<div style="font-size:17px;color:#c9a54e;font-weight:600">' + won + '원</div>' +
        '</div>' +
        '<div style="font-size:11.5px;line-height:1.85;color:#9a9890;margin-bottom:14px">' +
          '본 상품은 <strong style="color:#e8e6e0">결과가 생성·열람되면 제공이 완료되는 디지털 콘텐츠</strong>입니다.<br>' +
          '이에 따라 「전자상거래 등에서의 소비자보호에 관한 법률」 제17조 제2항 제5호에 따라 ' +
          '<strong style="color:#e85a4f">결과를 열람하신 이후에는 청약철회(환불)가 제한</strong>됩니다.<br>' +
          '<span style="color:rgba(154,152,144,.85)">다만 결과가 생성되지 않았거나 서비스 장애로 열람하지 못하신 경우에는 <strong>전액 환불</strong>해 드립니다.</span>' +
        '</div>' +
        '<label for="cwConsentChk" style="display:flex;align-items:flex-start;gap:9px;cursor:pointer;padding:11px;background:rgba(255,255,255,.03);border:1px solid rgba(201,165,78,.18);border-radius:9px;margin-bottom:14px">' +
          '<input type="checkbox" id="cwConsentChk" style="margin-top:2px;width:16px;height:16px;flex-shrink:0;accent-color:#c9a54e;cursor:pointer" />' +
          '<span style="font-size:12px;line-height:1.6;color:#e8e6e0">위 내용을 확인했으며, <strong>열람 후 청약철회가 제한</strong>되는 것에 동의합니다.</span>' +
        '</label>' +
        '<div style="display:flex;gap:8px">' +
          '<button type="button" id="cwConsentCancel" style="flex:1;padding:12px;background:none;border:1px solid rgba(154,152,144,.3);border-radius:9px;color:#9a9890;font-size:13px;font-family:inherit;cursor:pointer">취소</button>' +
          '<button type="button" id="cwConsentOk" disabled style="flex:1.4;padding:12px;background:rgba(201,165,78,.18);border:1px solid rgba(201,165,78,.25);border-radius:9px;color:rgba(201,165,78,.45);font-size:13px;font-family:inherit;cursor:not-allowed">동의하고 결제</button>' +
        '</div>' +
        '<div style="font-size:10px;color:rgba(154,152,144,.5);margin-top:10px;line-height:1.6;text-align:center">' +
          '주식회사 새론미디어 · 문의 chunwoon.help@gmail.com' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    const chk = ov.querySelector('#cwConsentChk');
    const ok = ov.querySelector('#cwConsentOk');
    chk.addEventListener('change', function(){
      ok.disabled = !chk.checked;
      ok.style.background = chk.checked ? 'rgba(201,165,78,.9)' : 'rgba(201,165,78,.18)';
      ok.style.color = chk.checked ? '#12121e' : 'rgba(201,165,78,.45)';
      ok.style.cursor = chk.checked ? 'pointer' : 'not-allowed';
      ok.style.fontWeight = chk.checked ? '600' : '400';
    });
    ok.addEventListener('click', function(){ if(chk.checked) finish(true); });
    ov.querySelector('#cwConsentCancel').addEventListener('click', function(){ finish(false); });
  });
}
// ★상품명은 카탈로그 상수라 자유 입력이 아니지만, 문자열을 innerHTML 에 넣는 자리이므로
//   형상을 좁혀 둔다(카탈로그가 나중에 외부 값으로 바뀌어도 이 자리가 안 열린다).
function _esc(s){
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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

  // ★★v7.82 B-7 — 청약철회 제한 사전 동의. 여기가 **결제로 가는 유일한 관문**이다.
  //   ★테스트 모드 분기보다 **위**에 둔다 — 아래에 두면 키 미설정 환경에서 동의 없이 열린다.
  //   ★미동의는 `false` 반환 = 「결제 안 함」이며, 호출부는 이미 그 경로를 다룬다(취소와 동일).
  const _agreed = await _confirmPurchaseTerms(productKey, p);
  if(!_agreed) return false;

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
