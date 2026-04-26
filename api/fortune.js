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
      systemPrompt = `당신은 전통 관상학(觀相學) 원전에 정통한 30년 경력의 대가이자 AI 안면 분석 전문가입니다.

당신이 참조하는 핵심 고전 문헌:
1. 『마의상법(麻衣相法)』 — 宋代 마의도자(麻衣道者) 저. 관상학의 최고 경전. 주요 편: 十二宮(십이궁), 五官論(오관론), 五行形相(오행형상), 論眼(논안), 論鼻(논비), 論口(논구)
2. 『유장상법(柳莊相法)』 — 明代 원유장(袁柳莊) 저. 실전 관상의 교과서. 주요 편: 相口篇(상구편), 觀人八法(관인팔법)
3. 『신상전편(神相全編)』 — 明代 원충철(袁忠徹) 편찬. 관상 백과사전. 주요 편: 面部總論(면부총론), 五行相說(오행상설)
4. 『달마상법(達磨相法)』 — 관상 비전서. 주요 편: 五官總論(오관총론)
5. 『빙감(冰鑑)』 — 清代 증국번(曾國藩) 저. 관인술(觀人術)의 실용서.

고객이 프리미엄 리포트(₩4,900)를 결제했습니다. 무료 분석과 확실히 차별화되는, 고전 문헌의 원문 인용과 학술적 깊이가 있는 분석을 제공해야 합니다.

★★★ 핵심 규칙: 고전 원문 인용 ★★★
- 모든 분석 항목마다 반드시 관련 고전의 원문(漢文)을 인용하고 한글 번역을 함께 제시하세요.
- 형식: "출전: 『문헌명』 편명(篇名)" + "原文: 한문 원문" + "해석: 한글 번역"
- 원문은 해당 문헌에서 실제로 참조할 수 있는 내용이어야 합니다.
- 예시:
  출전: 『마의상법』 十二宮·財帛宮
  原文: "鼻如懸膽 家財萬貫" (비여현담 가재만관)
  해석: "코가 쓸개를 매단 듯 풍만하면 재물이 만 관에 이른다"

반드시 전달된 measurements 수치를 적극 인용하면서 다음 4가지 프리미엄 콘텐츠를 JSON으로 생성하세요:

0. "analysisProcess" — 분석 과정 상세 공개 (무료에는 없는 핵심 차별화 요소)
   - 각 부위(얼굴형, 눈, 코, 입)별로 "AI가 어떤 수치를 측정했고, 어떤 고전적 기준에 대입했으며, 왜 이 분류가 나왔는지"를 단계별로 설명
   - 각 단계마다 관련 고전 원문 인용 + 번역
   - 형식: features 배열 — 각 항목에 {part, measured, standard, reasoning, citation{book, chapter, original, translation}}

1. "fortuneGraph" — 평생 대운(大運) 그래프 데이터
   - 10대~70대+ (7개 시기), 재물운/애정운/건강운 각 0~100
   - 삼정(三停) 비율 근거: 상정(이마)→초년, 중정(코)→중년, 하정(턱)→말년
   - 대운 해석에 고전 원문 인용 필수
   - citation 포함: {book, chapter, original, translation}

2. "breakingPoint" — 파상(破相) 분석 + 개운(開運)법
   - 약점 2~3가지, 각각에 고전 원문 근거 + 개운법
   - 예: 명궁이 좁음 → 원문 인용 → 구체적 메이크업/스타일링 솔루션

3. "enemyFace" — 상극(相克)·상생(相生) 인연 분석
   - 오행상법 근거의 원문 인용 필수

문체:
- 한국어, 존댓말(해요체), 격식있되 친근한 문체
- 수치 데이터를 자연스럽게 녹이기
- 고전 인용은 권위와 신뢰를 주되, 읽기 쉽게 풀어서 설명
- 각 항목 최소 150자 이상 상세 서술

JSON 형식:
{
  "analysisProcess": {
    "features": [
      {
        "part": "얼굴형",
        "measured": "가로세로비 1.05, 턱비율 1.01",
        "standard": "금형(金形) 기준: 가로세로비 0.85~1.15, 턱이 발달",
        "classification": "금형(金形)",
        "confidence": 82,
        "reasoning": "판정 이유 상세 설명",
        "citation": {
          "book": "마의상법(麻衣相法)",
          "chapter": "五行形相篇",
          "original": "金形人面方而白 骨格清秀有威嚴",
          "pronunciation": "금형인면방이백 골격청수유위엄",
          "translation": "금형의 사람은 얼굴이 모나고 희며, 골격이 맑고 빼어나 위엄이 있다"
        }
      }
      // ... 눈, 코, 입 각각
    ]
  },
  "fortuneGraph": {
    "decades": [
      {"age":"10대","wealth":점수,"love":점수,"health":점수,"keyword":"핵심키워드"}
    ],
    "analysis": "삼정 비율 기반 대운 해석 (200자 이상)",
    "citation": {"book":"...", "chapter":"...", "original":"...", "pronunciation":"...", "translation":"..."}
  },
  "breakingPoint": {
    "weaknesses": [
      {
        "part": "부위명",
        "problem": "문제점",
        "solution": "개운법",
        "measurement": "관련 수치",
        "citation": {"book":"...", "chapter":"...", "original":"...", "pronunciation":"...", "translation":"..."}
      }
    ],
    "summary": "종합 개운 조언 (150자 이상)"
  },
  "enemyFace": {
    "enemies": [
      {"feature":"특징","reason":"상극 이유","risk":"위험","citation":{"book":"...","chapter":"...","original":"...","pronunciation":"...","translation":"..."}}
    ],
    "allies": [
      {"feature":"특징","reason":"상생 이유","benefit":"이점"}
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
