// Vercel Serverless Function — LLM 운세 해석 API
// 환경 변수: ANTHROPIC_API_KEY (Vercel 대시보드 → Settings → Environment Variables 에서 설정)

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  // GET = 헬스 체크 (브라우저에서 직접 접근 가능)
  if (req.method === 'GET') {
    const hasKey = !!process.env.ANTHROPIC_API_KEY;
    return res.status(200).json({ status: 'ok', hasApiKey: hasKey, timestamp: new Date().toISOString() });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  try {
    const { type, features, context } = req.body;
    if (!type || !features) {
      return res.status(400).json({ error: 'Missing type or features' });
    }

    let systemPrompt, userPrompt;

    if (type === 'palm') {
      systemPrompt = `당신은 전통 수상학(手相學) 전문가입니다. 『마의신상(麻衣神相)』, 『수상대전(手相大全)』, 서양 cheirology 등 동서양 수상학의 전통에 기반하여 손금을 해석합니다.
주어진 손금 분석 데이터를 바탕으로 깊이 있고 매력적인 운세 해석을 생성하세요.
- 한국어로 작성
- 존댓말 사용 (해요체)
- 구체적이고 개인화된 해석 (일반적 문구 지양)
- 긍정적이면서도 현실적인 조언 포함
- 전통 고전의 인용이나 참고를 자연스럽게 녹여내기
- JSON 형식으로 응답: {"lines":{"life":"생명선 해석","head":"두뇌선 해석","heart":"감정선 해석","fate":"운명선 해석"},"summary":"종합 해석 (200자 이상)","advice":"천운의 조언"}`;

      userPrompt = `다음 AI 손금 분석 결과를 바탕으로 운세를 해석해주세요.

분석 대상: ${context?.gender === 'male' ? '남성' : '여성'}, ${context?.hand === 'left' ? '왼손' : '오른손'} (${context?.hand === (context?.gender === 'male' ? 'left' : 'right') ? '본명·선천운' : '후천·현재운'})

손금 특징:
${JSON.stringify(features, null, 2)}

각 손금선의 길이, 깊이, 곡률, 특이점을 고려하여 구체적으로 해석해주세요.`;

    } else if (type === 'face') {
      systemPrompt = `당신은 전통 관상학(觀相學) 전문가이자 AI 안면 분석 전문가입니다. 『마의상법(麻衣相法)』, 『유장상법(柳莊相法)』, 『신상전편(神相全編)』, 오행상법(五行相法) 등에 기반하여 관상을 해석합니다.
주어진 얼굴 분석 데이터를 바탕으로 깊이 있고 매력적인 운세 해석을 생성하세요.
- 한국어로 작성
- 존댓말 사용 (해요체)
- 얼굴형(오행), 눈(감찰관), 코(재백궁·질액궁), 입(출납관) 각각에 대한 해석
- 십이궁(十二宮) 관점에서 종합적 운세 분석
- 반드시 전달받은 measurements(수치 데이터)를 각 해석에 직접 언급하며 전문성을 드러내세요.
  예시: "가로세로비가 0.82로 金形에 가까워 강직한 의지가 돋보입니다", "코 너비가 얼굴 전체의 28%를 차지하여 재백궁이 넉넉한 편입니다", "삼정 균형도가 87%로 상·중·하정이 고르게 발달했습니다", "좌우 대칭도 93%는 상위권에 해당하며..."
- 뜬구름 잡는 일반론 대신, 구체적 수치 → 관상학적 의미 → 실생활 조언의 3단 논리로 서술하세요.
- measurements가 없는 경우(AI 감지 실패 시)에만 일반적 해석으로 대체하세요.
- JSON 형식으로 응답: {"shape":"얼굴형 해석","eyes":"눈 해석","nose":"코 해석","mouth":"입 해석","summary":"종합 관상 해석 (200자 이상)","advice":"천운의 조언"}`;

      const m = features.measurements;
      const measurementBlock = m ? `
AI 실측 데이터 (MediaPipe 468점 기반):
- 얼굴 가로세로비(whRatio): ${m.whRatio?.toFixed(3) || 'N/A'} (1.618 = 황금비)
- 턱너비 비율(jawRatio): ${m.jawRatio?.toFixed(3) || 'N/A'}
- 눈 가로세로비(eyeRatio): ${m.eyeRatio?.toFixed(2) || 'N/A'}
- 눈 크기비(eyeSizeRatio): ${((m.eyeSizeRatio||0)*100).toFixed(1)}%
- 코 너비/얼굴 비율(noseWRatio): ${((m.noseWRatio||0)*100).toFixed(1)}%
- 코 높이/얼굴 비율(noseHRatio): ${((m.noseHRatio||0)*100).toFixed(1)}%
- 입너비/동공간 비율(mouthFaceRatio): ${m.mouthFaceRatio?.toFixed(3) || 'N/A'}
- 입술 두께비(lipThicknessRatio): ${((m.lipThicknessRatio||0)*100).toFixed(1)}%
- 좌우 대칭도(symmetry): ${((m.symmetry||0)*100).toFixed(1)}%
- 삼정 균형도(thirdsScore): ${((m.thirdsScore||0)*100).toFixed(1)}%
- 황금비 근접도(goldenProximity): ${((m.goldenProximity||0)*100).toFixed(1)}%

★ 위 수치를 해석에 반드시 직접 인용하세요.` : '(AI 실측 데이터 없음 — 일반적 해석으로 대체)';

      userPrompt = `다음 AI 관상 분석 결과를 바탕으로 운세를 해석해주세요.

얼굴 특징:
- 얼굴형: ${features.shape?.label || ''} (${features.shape?.fiveElement || ''}, ${features.shape?.score || ''}점)
- 눈: ${features.eyes?.label || ''} (${features.eyes?.score || ''}점)
- 코: ${features.nose?.label || ''} (${features.nose?.score || ''}점)
- 입: ${features.mouth?.label || ''} (${features.mouth?.score || ''}점)
- 종합점수: ${features.overallScore || ''}점

${measurementBlock}

오행상법의 얼굴형 분류, 마의상법의 오관(五官) 해석, 십이궁 관점에서 구체적으로 분석해주세요. 각 항목마다 수치 데이터를 인용해서 근거를 제시하세요.`;

    } else if (type === 'face_premium_1') {
      // 프리미엄 1단계: 분석 과정 + 대운 그래프
      systemPrompt = `당신은 전통 관상학 원전에 정통한 대가이자 AI 안면 분석 전문가입니다.
핵심 고전: 마의상법, 유장상법, 신상전편, 달마상법, 빙감.
프리미엄 리포트 결제 고객용. 고전 원문(漢文) 인용 + 한글 번역 필수.
measurements 수치를 적극 인용하세요.

다음 2가지를 JSON으로 생성:

1. "analysisProcess" — AI 분석 과정 상세 공개
   features 배열(얼굴형,눈,코,입 4개): 각각 {part, measured(실측값 문자열), standard(기준), classification(분류명), confidence(0~100), reasoning(150자+ 판정 이유), citation:{book,chapter,original,pronunciation,translation}}

2. "fortuneGraph" — 면부백세유년도 기반 평생 대운 그래프
   decades 배열(10대~70대+, 7개): {age,wealth(0~100),love(0~100),health(0~100),keyword}
   analysis: 삼정 비율 기반 대운 해석(200자+)
   peakAge: 최고 운 시기 (예:"44~48세")
   citation: {book,chapter,original,pronunciation,translation}

문체: 한국어, 해요체, 수치 인용, 고전 원문 인용. 개인화된 서술.`;

      const m = features.measurements;
      const mStr = m ? `whR:${m.whRatio?.toFixed(3)||'?'},jawR:${m.jawRatio?.toFixed(3)||'?'},eyeR:${m.eyeRatio?.toFixed(2)||'?'},eyeS:${((m.eyeSizeRatio||0)*100).toFixed(1)}%,noseW:${((m.noseWRatio||0)*100).toFixed(1)}%,noseH:${((m.noseHRatio||0)*100).toFixed(1)}%,mouth:${m.mouthFaceRatio?.toFixed(3)||'?'},lip:${((m.lipThicknessRatio||0)*100).toFixed(1)}%,sym:${((m.symmetry||0)*100).toFixed(1)}%,thirds:${((m.thirdsScore||0)*100).toFixed(1)}%,upper:${m.upperThirdPct?.toFixed(1)||'?'}%,mid:${m.middleThirdPct?.toFixed(1)||'?'}%,lower:${m.lowerThirdPct?.toFixed(1)||'?'}%` : 'N/A';

      userPrompt = `얼굴형:${features.shape?.label||''}(${features.shape?.fiveElement||''}${features.shape?.score||''}점), 눈:${features.eyes?.label||''}(${features.eyes?.score||''}점), 코:${features.nose?.label||''}(${features.nose?.score||''}점), 입:${features.mouth?.label||''}(${features.mouth?.score||''}점), 종합:${features.overallScore||''}점. 실측:[${mStr}]. analysisProcess와 fortuneGraph 2개만 JSON 생성.`;

    } else if (type === 'face_premium_2') {
      // 프리미엄 2단계: 파상 + 상극상생
      systemPrompt = `당신은 전통 관상학 원전에 정통한 대가이자 AI 안면 분석 전문가입니다.
핵심 고전: 마의상법, 유장상법, 신상전편, 달마상법, 빙감.
프리미엄 리포트 결제 고객용. 고전 원문(漢文) 인용 + 한글 번역 필수.

다음 2가지를 JSON으로 생성:

1. "breakingPoint" — 파상(破相) 분석 + 개운법
   weaknesses 배열(2~3개): {part, problem(100자+), solution(메이크업/스타일링/습관 등 실용적 개운법 100자+), measurement(관련수치), citation:{book,chapter,original,pronunciation,translation}}
   summary: 종합 개운 전략(150자+)

2. "enemyFace" — 상극·상생 인연 분석
   enemies 배열(2개): {feature(어떤 관상), reason(100자+), risk, citation:{book,chapter,original,pronunciation,translation}}
   allies 배열(2개): {feature, reason(100자+), benefit}
   summary: 오행 궁합 종합(150자+)

문체: 한국어, 해요체, 수치 인용, 고전 원문 인용. 개인화된 서술.`;

      const m = features.measurements;
      const mStr = m ? `whR:${m.whRatio?.toFixed(3)||'?'},jawR:${m.jawRatio?.toFixed(3)||'?'},noseW:${((m.noseWRatio||0)*100).toFixed(1)}%,noseH:${((m.noseHRatio||0)*100).toFixed(1)}%,lip:${((m.lipThicknessRatio||0)*100).toFixed(1)}%,sym:${((m.symmetry||0)*100).toFixed(1)}%,thirds:${((m.thirdsScore||0)*100).toFixed(1)}%` : 'N/A';

      userPrompt = `얼굴형:${features.shape?.label||''}(${features.shape?.fiveElement||''}), 눈:${features.eyes?.label||''}, 코:${features.nose?.label||''}, 입:${features.mouth?.label||''}, 점수:${features.overallScore||''}점. 실측:[${mStr}]. breakingPoint와 enemyFace 2개만 JSON 생성.`;

    } else {
      return res.status(400).json({ error: 'Invalid type: use "palm", "face", "face_premium_1", or "face_premium_2"' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: (type === 'face_premium_1' || type === 'face_premium_2') ? 2000 : 1500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic API error:', err);
      return res.status(502).json({ error: 'LLM API error', detail: response.status });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    // Try to parse JSON from the response
    let parsed;
    try {
      // Extract JSON from possible markdown code block
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch {
      parsed = { raw: text };
    }

    return res.status(200).json({ success: true, result: parsed });

  } catch (err) {
    console.error('Fortune API error:', err);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
}
