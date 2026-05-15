// 천운 — Toss Payments 결제 승인 API
// POST /api/confirm-payment
// Body: { paymentKey, orderId, amount }
// 시크릿 키는 환경변수 TOSS_SECRET_KEY로 보관 (절대 클라이언트 노출 X)

module.exports = async (req, res) => {
  // CORS (같은 도메인이라 사실상 불필요하지만 안전망)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'POST only' } });

  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey) {
    return res.status(500).json({
      success: false,
      error: { code: 'CONFIG_MISSING', message: 'TOSS_SECRET_KEY 환경변수가 설정되지 않았습니다' }
    });
  }

  const { paymentKey, orderId, amount } = req.body || {};
  if (!paymentKey || !orderId || typeof amount !== 'number') {
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
  if (typeof orderId !== 'string' || !orderId.startsWith('cw_') || orderId.length < 10 || orderId.length > 64) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_ORDER_ID', message: '주문번호 형식이 올바르지 않습니다' }
    });
  }

  try {
    // Basic 인증 — secretKey + ':' base64
    const auth = Buffer.from(secretKey + ':').toString('base64');

    const tossResp = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ paymentKey, orderId, amount })
    });

    const tossData = await tossResp.json();

    if (!tossResp.ok) {
      return res.status(tossResp.status).json({
        success: false,
        error: {
          code: tossData.code || 'TOSS_API_ERROR',
          message: tossData.message || '결제 승인 실패',
          status: tossResp.status
        }
      });
    }

    // 결제 상태 확인
    if (tossData.status !== 'DONE') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'PAYMENT_NOT_DONE',
          message: '결제가 완료 상태가 아닙니다: ' + tossData.status,
          payment: tossData
        }
      });
    }

    // 결제 정보 검증
    if (tossData.totalAmount !== amount) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'AMOUNT_MISMATCH',
          message: '결제 금액이 일치하지 않습니다'
        }
      });
    }

    // 성공 — 영수증 정보 반환 (민감 정보 제외)
    return res.status(200).json({
      success: true,
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
    console.error('[confirm-payment] 예외:', err);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: err.message || '서버 내부 오류'
      }
    });
  }
};
