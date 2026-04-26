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
      // 프리미엄 관상 리포트 — 결제 후 호출 (종합 분석)
      systemPrompt = `당신은 전통 관상학(觀相學) 원전에 정통한 30년 경력의 대가이자 AI 안면 분석 전문가입니다.

참조 핵심 고전:
1. 『마의상법(麻衣相法)』 — 宋代. 十二宮, 五官論, 五行形相, 面部百歲流年圖
2. 『유장상법(柳莊相法)』 — 明代. 相口篇, 觀人八法
3. 『신상전편(神相全編)』 — 明代. 面部總論, 五行相說, 十二宮歌
4. 『달마상법(達磨相法)』 — 五官總論, 三停論
5. 『빙감(冰鑑)』 — 清代 증국번. 觀人術 실용서

★ 고객이 ₩4,900 결제. 무료와 차원이 다른, 고전 원문 인용 + 학술적 깊이의 분석을 제공하세요.

★★★ 핵심 규칙 ★★★
1. 모든 항목에 고전 漢文 원문 인용 + 음독 + 한글 번역 필수
2. 전달된 measurements 수치를 적극 인용
3. 한국어, 해요체, 격식+친근한 문체
4. 각 항목 최소 100자 이상 상세 서술

아래 7가지 프리미엄 콘텐츠를 JSON으로 생성하세요:

━━ 0. "analysisProcess" ━━
AI 분석 과정 상세 공개. 얼굴형/눈썹/눈/코/입 5개 부위.
features 배열: {part, measured, standard, classification, confidence(0~100), reasoning, citation{book,chapter,original,pronunciation,translation}}

━━ 1. "twelvePalaces" ━━
십이궁(十二宮) 분석 — 측정 가능한 8개 궁 상세 분석.
palaces 배열 (8개): {
  name: "명궁(命宮)" 등,
  area: "미간" 등 해당 부위,
  measurement: "미간 너비 비율 X%" 등 실측값 인용,
  grade: "상/중/하",
  interpretation: "150자 이상 상세 해석. 이 궁이 좋으면/나쁘면 인생 어디에 영향을 미치는지",
  citation: {book,chapter,original,pronunciation,translation}
}
분석할 8궁:
① 명궁(命宮) — 미간: 전체 운명·성격 기질 (myungGungRatio 활용)
② 재백궁(財帛宮) — 코: 재물 축적 능력 (noseWRatio, noseHRatio)
③ 관록궁(官祿宮) — 이마 중앙: 사회적 성취·직장운 (foreheadWidthRatio)
④ 천이궁(遷移宮) — 이마 양측: 이사·여행·해외운 (templeBalance)
⑤ 부처궁(夫妻宮) — 눈꼬리: 배우자복·연애 (eyeTailAngle)
⑥ 자녀궁(子女宮) — 눈 아래 와잠: 자녀복·부하 (underEyeRatio)
⑦ 질액궁(疾厄宮) — 산근(코뿌리): 건강·41~43세 운 (sanGeunRatio)
⑧ 전택궁(田宅宮) — 눈썹-눈 사이: 부동산운·가정 (jeonTaekRatio)

━━ 2. "fiveOfficials" ━━
오관(五官) 중 4개(귀 제외) 상세 분석.
officials 배열: {
  name: "보수관(保壽官) — 눈썹" 등,
  measurement: 실측값,
  interpretation: "150자 이상. 해당 관이 좋으면/나쁘면의 구체적 의미",
  agePeriod: "35~40세" 등 주관하는 연령대,
  citation: {book,chapter,original,pronunciation,translation}
}
① 보수관(눈썹) — browLengthRatio, browAngle, browThicknessRatio → 형제복, 35~40세
② 감찰관(눈) — eyeRatio, eyeSizeRatio → 지혜·관찰력, 35~40세
③ 심관/審辨官(코) — noseWRatio, noseHRatio → 자존심·재물, 41~50세
④ 출납관(입) — mouthFaceRatio, lipThicknessRatio → 식복·언변, 56~70세

━━ 3. "threeCourtAnalysis" ━━
삼정(三停) 상세 분석. 각 정(停)의 비율 + 인생 시기 매핑.
{
  upper: {ratio: "XX.X%", period: "초년운 15~30세", interpretation: "100자+ 해석"},
  middle: {ratio: "XX.X%", period: "중년운 31~50세", interpretation: "100자+ 해석"},
  lower: {ratio: "XX.X%", period: "말년운 51세~", interpretation: "100자+ 해석"},
  balance: "전체 균형 종합 해석 100자+",
  citation: {book,chapter,original,pronunciation,translation}
}

━━ 4. "fortuneGraph" ━━
면부백세유년도(面部百歲流年圖) 기반 연령별 운세 그래프.
decades 배열 (10대~70대+, 7개): {age, wealth(0~100), love(0~100), health(0~100), keyword}
★ 면부백세유년도 매핑 근거:
- 28세(인당/미간) → myungGungRatio
- 31~34세(눈썹) → browLengthRatio, browAngle
- 35~40세(눈) → eyeRatio, eyeSizeRatio
- 41~43세(산근) → sanGeunRatio
- 44~50세(코 전체) → noseWRatio, noseHRatio
- 51~55세(인중·법령) → inJungRatio
- 56~70세(입·턱) → mouthFaceRatio, chinRatio
각 시기 점수는 해당 부위 측정값의 양호도에 비례해야 합니다.
analysis: "200자 이상 종합 해석"
citation: {book,chapter,original,pronunciation,translation}

━━ 5. "breakingPoint" ━━
파상(破相) 분석 + 개운(開運)법. 약점 2~3개.
weaknesses 배열: {part, problem, solution, measurement, citation}
solution은 반드시 구체적 실천법 포함:
- 메이크업/뷰티 팁 (예: "눈썹 끝을 2mm 연장 그리기")
- 스타일링 (예: "이마를 드러내는 헤어스타일 추천")
- 행동 습관 (예: "의식적으로 입꼬리 올리기")
- 풍수/색상 보완 (예: "서쪽 방향 책상, 흰색 소품")
summary: "종합 개운 조언 150자+"

━━ 6. "enemyFace" ━━
상극(相克)·상생(相生) 인연 분석. 오행 근거.
enemies 배열: {feature, reason, risk, citation}
allies 배열: {feature, reason, benefit}
summary: "오행 궁합 종합 150자+"

━━ JSON 구조 ━━
{
  "analysisProcess": {"features": [5개]},
  "twelvePalaces": {"palaces": [8개]},
  "fiveOfficials": {"officials": [4개]},
  "threeCourtAnalysis": {"upper":{...},"middle":{...},"lower":{...},"balance":"...","citation":{...}},
  "fortuneGraph": {"decades": [7개], "analysis":"...", "citation":{...}},
  "breakingPoint": {"weaknesses": [2~3개], "summary":"..."},
  "enemyFace": {"enemies":[2~3개], "allies":[2~3개], "summary":"..."}
}`;

      const m = features.measurements;
      const measurementBlock = m ? `
AI 실측 데이터 (MediaPipe 468점 정밀 분석):

[기본 비율]
- 얼굴 가로세로비(whRatio): ${m.whRatio?.toFixed(3) || 'N/A'} (황금비 1.618 기준)
- 턱너비 비율(jawRatio): ${m.jawRatio?.toFixed(3) || 'N/A'}
- 좌우 대칭도(symmetry): ${((m.symmetry||0)*100).toFixed(1)}%
- 황금비 근접도(goldenProximity): ${((m.goldenProximity||0)*100).toFixed(1)}%

[십이궁 관련 측정]
- 명궁 미간 너비(myungGungRatio): ${((m.myungGungRatio||0)*100).toFixed(1)}%
- 관록궁 이마 너비(foreheadWidthRatio): ${((m.foreheadWidthRatio||0)*100).toFixed(1)}%
- 천이궁 관자놀이 균형(templeBalance): ${((m.templeBalance||0)*100).toFixed(1)}%
- 부처궁 눈꼬리 각도(eyeTailAngle): ${m.eyeTailAngle?.toFixed(1) || 'N/A'}°
- 자녀궁 와잠 두께(underEyeRatio): ${((m.underEyeRatio||0)*100).toFixed(1)}%
- 질액궁 산근 너비(sanGeunRatio): ${((m.sanGeunRatio||0)*100).toFixed(1)}%
- 전택궁 눈썹-눈 거리(jeonTaekRatio): ${((m.jeonTaekRatio||0)*100).toFixed(1)}%
- 재백궁 코 너비(noseWRatio): ${((m.noseWRatio||0)*100).toFixed(1)}%
- 재백궁 코 높이(noseHRatio): ${((m.noseHRatio||0)*100).toFixed(1)}%

[오관(눈썹·눈·코·입)]
- 눈썹 길이(browLengthRatio): ${((m.browLengthRatio||0)*100).toFixed(1)}%
- 눈썹 기울기(browAngle): ${m.browAngle?.toFixed(1) || 'N/A'}°
- 눈썹 두께(browThicknessRatio): ${((m.browThicknessRatio||0)*100).toFixed(1)}%
- 눈썹 간격(browGapRatio): ${((m.browGapRatio||0)*100).toFixed(1)}%
- 눈 가로세로비(eyeRatio): ${m.eyeRatio?.toFixed(2) || 'N/A'}
- 눈 크기비(eyeSizeRatio): ${((m.eyeSizeRatio||0)*100).toFixed(1)}%
- 입너비/동공간 비율(mouthFaceRatio): ${m.mouthFaceRatio?.toFixed(3) || 'N/A'}
- 입술 두께비(lipThicknessRatio): ${((m.lipThicknessRatio||0)*100).toFixed(1)}%

[관골·인중·턱]
- 광대/턱 비율(gwanGolProminence): ${m.gwanGolProminence?.toFixed(3) || 'N/A'}
- 인중 길이(inJungRatio): ${((m.inJungRatio||0)*100).toFixed(1)}%
- 턱 길이(chinRatio): ${((m.chinRatio||0)*100).toFixed(1)}%
- 턱 각도(jawAngle): ${m.jawAngle?.toFixed(1) || 'N/A'}°

[삼정(三停) 개별 비율]
- 상정(이마→눈썹): ${m.upperThirdPct?.toFixed(1) || 'N/A'}%
- 중정(눈썹→코끝): ${m.middleThirdPct?.toFixed(1) || 'N/A'}%
- 하정(코끝→턱): ${m.lowerThirdPct?.toFixed(1) || 'N/A'}%
- 삼정 균형도(thirdsScore): ${((m.thirdsScore||0)*100).toFixed(1)}%` : '(실측 데이터 없음)';

      userPrompt = `프리미엄 관상 종합 리포트를 생성해주세요.

고객의 관상 분석 결과:
- 얼굴형: ${features.shape?.label || ''} (${features.shape?.fiveElement || ''})
- 눈: ${features.eyes?.label || ''}
- 코: ${features.nose?.label || ''}
- 입: ${features.mouth?.label || ''}
- 종합점수: ${features.overallScore || ''}점

${measurementBlock}

★ 위 수치 전체를 활용하여, 십이궁 8궁 + 오관 4관 + 삼정 + 면부백세유년도 기반 대운 그래프 + 파상·개운법 + 상극·상생 분석을 모두 포함한 종합 리포트를 작성하세요.
★ 각 항목마다 반드시 고전 원문(漢文) + 음독 + 번역을 인용하세요.
★ 면부백세유년도에서 각 연령대 점수는 해당 부위 측정값이 양호할수록 높게, 약할수록 낮게 반영하세요.`;

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
        max_tokens: type === 'face_premium' ? 8000 : 1500,
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
