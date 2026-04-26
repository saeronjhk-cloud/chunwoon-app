// Vercel Serverless Function — LLM 운세 해석 API
// 환경 변수: ANTHROPIC_API_KEY (Vercel 대시보드 → Settings → Environment Variables 에서 설정)

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
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

    } else if (type === 'face_premium') {
      // 프리미엄 관상 리포트 — 결제 후 호출
      systemPrompt = `당신은 30년 경력의 전통 관상학(觀相學) 대가이자 AI 안면 분석 전문가입니다. 『마의상법(麻衣相法)』, 『유장상법(柳莊相法)』, 『신상전편(神相全編)』, 오행상법(五行相法), 『달마상법(達磨相法)』에 정통합니다.

고객이 프리미엄 리포트(₩4,900)를 결제했습니다. 무료 분석보다 훨씬 깊고, 구체적이며, 실행 가능한 조언을 제공해야 합니다.

반드시 전달된 measurements 수치를 적극 인용하면서 다음 3가지 프리미엄 콘텐츠를 JSON으로 생성하세요:

1. "fortuneGraph" — 평생 대운(大運) 그래프 데이터
   - 10대, 20대, 30대, 40대, 50대, 60대, 70대+ 각 시기별로 재물운(wealth), 애정운(love), 건강운(health) 점수를 0~100으로 산출
   - 각 시기별 핵심 키워드 1줄
   - 관상학적 근거: 상정(이마)→초년운, 중정(코)→중년운, 하정(턱)→말년운의 삼정 비율에서 도출
   - 반드시 measurements의 삼정균형(thirdsScore), 가로세로비(whRatio) 수치를 인용하여 근거 제시

2. "breakingPoint" — 파상(破相) 분석과 개운(開運) 메이크업/스타일링
   - 이 사람의 관상에서 운을 깎아먹는 약점 2~3가지를 구체적으로 지적
   - 각 약점에 대한 개운법(메이크업, 스타일링, 관상보완법) 제시
   - 예: "명궁(눈썹 사이)이 좁아 재물이 새어나갑니다 → 눈썹 사이 잔털을 정리하고 명궁을 밝게 하세요", "입술이 얇아 말년 인복이 약합니다 → 코랄톤 오버립으로 1~2mm 보완하세요"
   - measurements의 실측 수치를 반드시 인용

3. "enemyFace" — 상극(相克) 인연 분석
   - 이 사람의 오행 기운과 상극인 얼굴 특징 2~3가지
   - 동업, 결혼 등에서 피해야 할 구체적인 관상 특징
   - 반대로 상생(相生)하여 함께하면 좋은 얼굴 특징도 제시
   - 오행상법 근거를 반드시 인용

문체:
- 한국어, 존댓말(해요체)
- 격식있되 친근하고 매력적인 문체 (고급 사주카페 상담사 느낌)
- 수치 데이터를 자연스럽게 녹여서 "이 앱이 진짜 내 얼굴을 정밀하게 읽었구나" 느낌 극대화
- 각 항목 최소 150자 이상 상세 서술

JSON 형식:
{
  "fortuneGraph": {
    "decades": [
      {"age":"10대","wealth":점수,"love":점수,"health":점수,"keyword":"핵심키워드"},
      ... (7개 시기)
    ],
    "analysis": "삼정 비율 기반 대운 해석 (200자 이상)"
  },
  "breakingPoint": {
    "weaknesses": [
      {"part":"부위명","problem":"문제점","solution":"개운법","measurement":"관련 수치"}
    ],
    "summary": "종합 개운 조언 (150자 이상)"
  },
  "enemyFace": {
    "enemies": [
      {"feature":"얼굴 특징","reason":"상극 이유","risk":"구체적 위험"}
    ],
    "allies": [
      {"feature":"얼굴 특징","reason":"상생 이유","benefit":"구체적 이점"}
    ],
    "summary": "오행 궁합 종합 (150자 이상)"
  }
}`;

      const m = features.measurements;
      const measurementBlock = m ? `
AI 실측 데이터 (MediaPipe 468점 정밀 분석):
- 얼굴 가로세로비(whRatio): ${m.whRatio?.toFixed(3) || 'N/A'} (황금비 1.618 기준)
- 턱너비 비율(jawRatio): ${m.jawRatio?.toFixed(3) || 'N/A'}
- 눈 가로세로비(eyeRatio): ${m.eyeRatio?.toFixed(2) || 'N/A'}
- 눈 크기비(eyeSizeRatio): ${((m.eyeSizeRatio||0)*100).toFixed(1)}%
- 코 너비/얼굴 비율(noseWRatio): ${((m.noseWRatio||0)*100).toFixed(1)}%
- 코 높이/얼굴 비율(noseHRatio): ${((m.noseHRatio||0)*100).toFixed(1)}%
- 입너비/동공간 비율(mouthFaceRatio): ${m.mouthFaceRatio?.toFixed(3) || 'N/A'}
- 입술 두께비(lipThicknessRatio): ${((m.lipThicknessRatio||0)*100).toFixed(1)}%
- 좌우 대칭도(symmetry): ${((m.symmetry||0)*100).toFixed(1)}%
- 삼정 균형도(thirdsScore): ${((m.thirdsScore||0)*100).toFixed(1)}%
- 황금비 근접도(goldenProximity): ${((m.goldenProximity||0)*100).toFixed(1)}%` : '(실측 데이터 없음)';

      userPrompt = `프리미엄 관상 리포트를 생성해주세요.

고객의 관상 분석 결과:
- 얼굴형: ${features.shape?.label || ''} (${features.shape?.fiveElement || ''})
- 눈: ${features.eyes?.label || ''}
- 코: ${features.nose?.label || ''}
- 입: ${features.mouth?.label || ''}
- 종합점수: ${features.overallScore || ''}점

${measurementBlock}

위 데이터를 바탕으로, 평생 대운 그래프·파상 분석·상극 인연 분석을 수치 근거와 함께 최대한 구체적이고 전문적으로 작성하세요.`;

    } else {
      return res.status(400).json({ error: 'Invalid type: use "palm", "face", or "face_premium"' });
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
        max_tokens: type === 'face_premium' ? 4000 : 1500,
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
