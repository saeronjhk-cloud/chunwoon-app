// 천운 — Toss Payments 결제 승인 API + 프리미엄 서명 토큰 발급
// POST /api/confirm-payment
//   Body(승인):      { paymentKey, orderId, amount }
//   Body(부트스트랩): { action:'bootstrap', paymentKey, orderId, amount }
// 환경변수: TOSS_SECRET_KEY (기존) · CW_PREMIUM_HMAC_SECRET (v7.66 신규)
//
// ============================================================================
//  v7.66 P1-AUTH 안 B
// ============================================================================
// ★문제 — 종전에는 Toss 승인 결과가 서버에 전혀 남지 않았다. 서버 DB 가 없고
//   (api/ 2파일 · supabase|kv|redis 참조 0건) 권한은 전부 localStorage 에 있었다.
//   그래서 api/fortune.js 는 결제 여부를 알 방법이 없었고 무인증으로 열려 있었다.
// ★해법 — 여기서 Toss 검증에 성공한 사실을 HMAC 서명 토큰에 담아 클라이언트에 준다.
//   서버는 상태를 갖지 않고 서명만 검증하므로 fortune.js 는 ★호출당 외부 왕복 0 이다.
//   Toss 가 원장 역할을 하고(재조회 가능), 토큰은 그 조회 결과의 서명된 사본이다.
// ★잔여 위험 — 발급된 토큰의 리플레이·공유는 막지 못한다(서버 원장 부재). 안 C(KV) 필요.

const crypto = require('crypto');

// ---- 상품 카탈로그 (js/toss-pay.js 의 TOSS_PRICING 과 반드시 일치) --------------
// ★명시 화이트리스트. 접두어 매칭 금지 — naming 과 naming_company 를 혼동하면 안 된다.
const PRODUCT_CATALOG = {
  saju: 4900,
  compat: 4900,
  tojeong: 4900,
  dream: 4900,
  face: 4900,
  tarot: 4900,
  naming: 29900,
  naming_company: 29900,
  naming_product: 29900
};
// 긴 키 우선 — 'cw_naming_company_...' 가 'naming' 으로 잘못 잡히지 않게 한다.
const PRODUCT_KEYS_LONGEST_FIRST = Object.keys(PRODUCT_CATALOG).sort((a, b) => b.length - a.length);

// orderId 형식 = cw_<productKey>_<ts36>_<rnd36>  (js/toss-pay.js _genOrderId)
function productKeyFromOrderId(orderId) {
  for (const k of PRODUCT_KEYS_LONGEST_FIRST) {
    if (orderId.indexOf('cw_' + k + '_') === 0) return k;
  }
  return null;
}

const CW_TOKEN_PREFIX = 'cwp1';
const CW_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;   // 30일 — 프런트 엔티틀먼트 창과 동일

function b64uEncode(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// 페이로드 스키마 v1:
//   v   토큰 버전(1)
//   pk  productKey (상품 결속)
//   ord orderId    (Toss 원장 재조회 키)
//   pay paymentKey (Toss 원장 재조회 키)
//   amt 승인 금액
//   iat 발급시각(ms) · exp 만료시각(ms)
//   src 'confirm'(신규 결제) | 'bootstrap'(구 영수증 재검증)
function issuePremiumToken(fields) {
  const secret = process.env.CW_PREMIUM_HMAC_SECRET;
  if (!secret || String(secret).length < 16) return null;   // fail-closed
  const now = Date.now();
  const payload = {
    v: 1,
    pk: fields.productKey,
    ord: fields.orderId,
    pay: fields.paymentKey,
    amt: fields.amount,
    iat: now,
    exp: now + CW_TOKEN_TTL_MS,
    src: fields.src || 'confirm'
  };
  const p = b64uEncode(JSON.stringify(payload));
  const sig = b64uEncode(crypto.createHmac('sha256', secret).update(p).digest());
  return { token: CW_TOKEN_PREFIX + '.' + p + '.' + sig, exp: payload.exp, productKey: payload.pk };
}

// ---- CORS — 자기 오리진(+ 선택적 명시 허용 목록)만. 종전 '*' 폐기 ---------------
function resolveAllowedOrigin(req) {
  const origin = req.headers && req.headers.origin;
  if (!origin) return null;
  let u;
  try { u = new URL(origin); } catch (e) { return null; }
  const host = (req.headers && req.headers.host) || '';
  if (host && u.host === host) return origin;
  const extra = String(process.env.CW_ALLOWED_ORIGINS || '')
    .split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  if (extra.indexOf(origin) !== -1) return origin;
  return null;
}

function tossAuthHeader(secretKey) {
  return 'Basic ' + Buffer.from(secretKey + ':').toString('base64');
}

// Toss 응답 1건이 「이 주문의 완료된 결제」인지 검증한다.
// 반환: null(정상) | {status, code, message}
function validateTossPayment(tossData, expect) {
  if (!tossData || typeof tossData !== 'object') {
    return { status: 502, code: 'TOSS_BAD_RESPONSE', message: '결제 정보를 확인하지 못했습니다' };
  }
  if (tossData.status !== 'DONE') {
    return { status: 400, code: 'PAYMENT_NOT_DONE', message: '결제가 완료 상태가 아닙니다: ' + tossData.status };
  }
  if (tossData.orderId !== expect.orderId) {
    return { status: 400, code: 'ORDER_ID_MISMATCH', message: '주문번호가 일치하지 않습니다' };
  }
  if (tossData.totalAmount !== expect.amount) {
    return { status: 400, code: 'AMOUNT_MISMATCH', message: '결제 금액이 일치하지 않습니다' };
  }
  // 상품 정가 대조 — orderId 에 각인된 상품키의 카탈로그 가격과 승인 금액이 같아야 한다.
  // ₩4,900 을 결제해 놓고 ₩29,900 작명 토큰을 받아 가는 경로를 막는다.
  if (PRODUCT_CATALOG[expect.productKey] !== expect.amount) {
    return { status: 400, code: 'PRODUCT_PRICE_MISMATCH', message: '상품 가격이 일치하지 않습니다' };
  }
  return null;
}

module.exports = async (req, res) => {
  const allowedOrigin = resolveAllowedOrigin(req);
  res.setHeader('Vary', 'Origin');
  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '600');
  }
  if (req.method === 'OPTIONS') {
    if (!allowedOrigin) return res.status(403).end();
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'POST only' } });
  }

  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey) {
    return res.status(500).json({
      success: false,
      error: { code: 'CONFIG_MISSING', message: 'TOSS_SECRET_KEY 환경변수가 설정되지 않았습니다' }
    });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_PARAM', message: '요청 본문이 올바르지 않습니다' } });
  }

  const paymentKey = body.paymentKey;
  const orderId = body.orderId;
  const amount = body.amount;
  const isBootstrap = body.action === 'bootstrap';

  if (typeof paymentKey !== 'string' || !paymentKey || paymentKey.length > 200 ||
    !/^[A-Za-z0-9_=-]+$/.test(paymentKey) ||
    typeof orderId !== 'string' || typeof amount !== 'number' || !isFinite(amount)) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_PARAM', message: 'paymentKey·orderId·amount 모두 필수' }
    });
  }

  // amount 합리성 검증 (소액 결제 외 차단 — 변조 방지 1차)
  if (amount < 100 || amount > 1000000) {
    return res.status(400).json({
      success: false,
      error: { code: 'AMOUNT_OUT_OF_RANGE', message: '결제 금액이 허용 범위를 벗어났습니다' }
    });
  }

  // orderId 형식 검증 (천운 prefix)
  if (!orderId.startsWith('cw_') || orderId.length < 10 || orderId.length > 64 ||
    !/^[A-Za-z0-9_=-]+$/.test(orderId)) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_ORDER_ID', message: '주문번호 형식이 올바르지 않습니다' }
    });
  }

  // orderId 에 각인된 상품키 추출 (화이트리스트 · 긴 키 우선)
  const productKey = productKeyFromOrderId(orderId);
  if (!productKey) {
    return res.status(400).json({
      success: false,
      error: { code: 'UNKNOWN_PRODUCT', message: '주문번호에서 상품을 식별하지 못했습니다' }
    });
  }

  try {
    let tossResp, tossData;

    if (isBootstrap) {
      // ------------------------------------------------------------------
      //  부트스트랩 — 이미 승인이 끝난 구 영수증을 재검증해 토큰만 발급한다.
      //  신규 승인을 다시 시도하지 않는다(중복 승인 방지). 조회만 한다.
      //  ★[추정] GET /v1/payments/{paymentKey} 는 공식 문서 근거이며 실호출 미확인이다.
      //    이 경로가 실패하면 토큰은 발급되지 않는다(fail-closed) — 신규 결제 흐름은
      //    이 엔드포인트에 전혀 의존하지 않으므로 영향이 없다.
      // ------------------------------------------------------------------
      tossResp = await fetch('https://api.tosspayments.com/v1/payments/' + encodeURIComponent(paymentKey), {
        method: 'GET',
        headers: { 'Authorization': tossAuthHeader(secretKey) }
      });
    } else {
      tossResp = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
        method: 'POST',
        headers: {
          'Authorization': tossAuthHeader(secretKey),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ paymentKey: paymentKey, orderId: orderId, amount: amount })
      });
    }

    try { tossData = await tossResp.json(); } catch (e) { tossData = null; }

    if (!tossResp.ok) {
      const st = (tossResp.status >= 400 && tossResp.status < 500) ? tossResp.status : 502;
      return res.status(st).json({
        success: false,
        error: {
          code: (tossData && tossData.code) || 'TOSS_API_ERROR',
          message: (tossData && tossData.message) || (isBootstrap ? '결제 조회 실패' : '결제 승인 실패'),
          status: tossResp.status
        }
      });
    }

    const bad = validateTossPayment(tossData, { orderId: orderId, amount: amount, productKey: productKey });
    if (bad) {
      return res.status(bad.status).json({ success: false, error: { code: bad.code, message: bad.message } });
    }

    // ---- 프리미엄 토큰 발급 -------------------------------------------------
    const issued = issuePremiumToken({
      productKey: productKey,
      orderId: orderId,
      paymentKey: paymentKey,
      amount: amount,
      src: isBootstrap ? 'bootstrap' : 'confirm'
    });
    if (!issued) {
      // 시크릿 미설정 = 프리미엄 이용 불가. 결제는 이미 승인됐으므로 그 사실은 알린다.
      return res.status(500).json({
        success: false,
        error: {
          code: 'AUTH_NOT_CONFIGURED',
          message: 'CW_PREMIUM_HMAC_SECRET 환경변수가 설정되지 않아 이용권을 발급할 수 없습니다'
        }
      });
    }

    // 성공 — 영수증 정보 + 서명 토큰 반환 (민감 정보 제외)
    return res.status(200).json({
      success: true,
      premiumToken: issued.token,
      premiumTokenExp: issued.exp,
      productKey: issued.productKey,
      payment: {
        orderId: tossData.orderId,
        orderName: tossData.orderName,
        method: tossData.method,
        totalAmount: tossData.totalAmount,
        approvedAt: tossData.approvedAt,
        status: tossData.status,
        receiptUrl: tossData.receipt && tossData.receipt.url
      }
    });
  } catch (err) {
    // ★fail-closed — Toss 왕복이 실패하면(타임아웃·DNS·TLS 등) 토큰은 절대 나가지 않는다.
    console.error('[confirm-payment] 예외:', err && err.message);
    return res.status(502).json({
      success: false,
      error: {
        code: 'TOSS_UNREACHABLE',
        message: '결제사 확인에 실패했습니다. 잠시 후 다시 시도해주세요'
      }
    });
  }
};
