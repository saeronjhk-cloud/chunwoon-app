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

    } else if (type === 'face_premium') {
      // 프리미엄 관상 리포트 — 결제 후 호출 (십이궁/오관/삼정은 클라이언트에서 생성)
      systemPrompt = `당신은 전통 관상학(觀相學) 원전에 정통한 30년 경력의 대가이자 AI 안면 분석 전문가입니다.

당신이 참조하는 핵심 고전 문헌:
1. 『마의상법(麻衣相法)』 — 宋代 마의도자 저. 관상학의 최고 경전. 십이궁, 오관론, 오행형상, 논안, 논비, 논구
2. 『유장상법(柳莊相法)』 — 明代 원유장 저. 실전 관상의 교과서. 상구편, 관인팔법
3. 『신상전편(神相全編)』 — 明代 원충철 편찬. 관상 백과사전. 면부총론, 오행상설
4. 『달마상법(達磨相法)』 — 관상 비전서. 오관총론
5. 『빙감(冰鑑)』 — 清代 증국번 저. 관인술의 실용서.

고객이 프리미엄 리포트(₩4,900)를 결제했습니다. 무료 분석과 확실히 차별화되는, 고전 문헌의 원문 인용과 학술적 깊이가 있는 분석을 제공하세요.
(참고: 십이궁·오관·삼정 분석은 클라이언트에서 별도 생성됩니다. 아래 4가지만 집중해서 작성하세요.)

★★★ 핵심 규칙: 고전 원문 인용 ★★★
- 모든 분석 항목마다 반드시 관련 고전의 원문(漢文)을 인용하고 한글 번역을 함께 제시하세요.
- 원문은 해당 문헌에서 실제로 참조할 수 있는 내용이어야 합니다.
- measurements 수치를 적극 인용하여, "이 수치가 고전 기준에서 무엇을 의미하는지" 논증하세요.

다음 4가지 프리미엄 콘텐츠를 JSON으로 생성하세요:

1. "analysisProcess" — AI 분석 과정 상세 공개 (무료에는 없는 핵심 차별화 요소)
   - 각 부위(얼굴형, 눈썹, 눈, 코, 입)별로 "AI가 어떤 수치를 측정했고, 어떤 고전적 기준에 대입했으며, 왜 이 분류가 나왔는지"를 단계별로 설명
   - 각 단계마다 관련 고전 원문 인용 + 발음 + 번역
   - 형식: features 배열 — 각 항목에 {part, measured, standard, classification, confidence(0~100), reasoning(200자 이상 상세), citation:{book, chapter, original, pronunciation, translation}}
   - 단순한 기준 나열이 아니라, "왜 이 수치가 이 분류에 해당하는지" 논리적으로 설득하세요
   - 예: "가로세로비 1.05는 금형 기준(0.85~1.15) 범위 안에 있으며, 특히 1.0 이상인 점은 얼굴이 넓기보다 균형잡힌 것을 의미합니다..."

2. "fortuneGraph" — 면부백세유년도(面部百歲流年圖) 기반 평생 대운(大運) 그래프
   - 10대, 20대, 30대, 40대, 50대, 60대, 70대+ (7개 시기)
   - 각 시기별 재물운/애정운/건강운 0~100점 + 한 단어 키워드
   - 삼정(三停) 비율에 근거: 상정 비율→초년운, 중정→중년운, 하정→말년운
   - 각 시기별 점수의 이유를 수치로 뒷받침하세요
   - decades 배열: {age, wealth, love, health, keyword}
   - analysis: 삼정 비율 기반 대운 흐름 상세 해석 (300자 이상, 수치 인용)
   - peakAge: 가장 강한 운이 오는 나이대 (예: "44~48세")
   - peakReason: 그 시기가 왜 최고인지 (예: "코(심변관)의 높이 비율이 상위 15%에 해당하여...")
   - citation: {book, chapter, original, pronunciation, translation}

3. "breakingPoint" — 파상(破相) 분석 + 개운(開運)법
   - 약점 2~3가지, measurements 수치로 뒷받침
   - 각 약점마다: 고전 원문으로 왜 약점인지 근거 제시 + 구체적이고 실천 가능한 개운법
   - 개운법은 반드시 실용적이어야 함: 메이크업/스타일링, 표정 습관, 관상보완 액세서리, 생활습관 등
   - weaknesses 배열: {part, problem(150자+), solution(150자+), measurement, citation:{book,chapter,original,pronunciation,translation}}
   - summary: 종합 개운 전략 (200자 이상)

4. "enemyFace" — 상극(相克)·상생(相生) 인연 분석
   - 오행상법에 따라, 고객의 오행 타입과 충돌하는 얼굴형 + 시너지를 내는 얼굴형 분석
   - enemies 배열(2~3개): {feature(어떤 관상), reason(왜 상극인지 150자+), risk(구체적 위험), citation:{book,chapter,original,pronunciation,translation}}
   - allies 배열(2~3개): {feature(어떤 관상), reason(왜 상생인지 150자+), benefit(구체적 이점)}
   - summary: 오행 궁합 종합 해석 (200자 이상), 연애·사업·우정 각각에서의 인연론 포함

문체 규칙:
- 한국어, 존댓말(해요체), 격식 있되 친근한 문체
- 수치 데이터를 문장 안에 자연스럽게 녹이기 (표 형식 아닌 서술형)
- 고전 인용은 권위와 신뢰를 주되, 일반인도 읽기 쉽게 풀어서 설명
- 뻔한 일반론 금지, 반드시 해당 고객의 수치에 맞춘 개인화된 서술
- 무료 분석에서 절대 볼 수 없는 깊이와 디테일을 보여주세요`;

      const m = features.measurements;
      const measurementBlock = m ? `
AI 실측 데이터 (MediaPipe 468점 정밀 분석):
[기본 비율]
- 얼굴 가로세로비(whRatio): ${m.whRatio?.toFixed(3) || 'N/A'} (황금비 1.618 기준)
- 턱너비 비율(jawRatio): ${m.jawRatio?.toFixed(3) || 'N/A'}
- 눈 가로세로비(eyeRatio): ${m.eyeRatio?.toFixed(2) || 'N/A'}
- 눈 크기비(eyeSizeRatio): ${((m.eyeSizeRatio||0)*100).toFixed(1)}%
- 코 너비(noseWRatio): ${((m.noseWRatio||0)*100).toFixed(1)}%
- 코 높이(noseHRatio): ${((m.noseHRatio||0)*100).toFixed(1)}%
- 입너비(mouthFaceRatio): ${m.mouthFaceRatio?.toFixed(3) || 'N/A'}
- 입술두께(lipThicknessRatio): ${((m.lipThicknessRatio||0)*100).toFixed(1)}%
- 좌우 대칭(symmetry): ${((m.symmetry||0)*100).toFixed(1)}%
- 삼정 균형(thirdsScore): ${((m.thirdsScore||0)*100).toFixed(1)}%
- 황금비 근접도(goldenProximity): ${((m.goldenProximity||0)*100).toFixed(1)}%
[십이궁 관련]
- 명궁 미간비(myungGungRatio): ${m.myungGungRatio?.toFixed(4) || 'N/A'}
- 이마너비(foreheadWidthRatio): ${m.foreheadWidthRatio?.toFixed(3) || 'N/A'}
- 관자놀이균형(templeBalance): ${m.templeBalance?.toFixed(3) || 'N/A'}
- 눈꼬리각도(eyeTailAngle): ${m.eyeTailAngle?.toFixed(1) || 'N/A'}°
- 와잠두께(underEyeRatio): ${m.underEyeRatio?.toFixed(4) || 'N/A'}
- 산근너비(sanGeunRatio): ${m.sanGeunRatio?.toFixed(4) || 'N/A'}
- 전택궁(jeonTaekRatio): ${m.jeonTaekRatio?.toFixed(4) || 'N/A'}
[오관 관련]
- 눈썹길이(browLengthRatio): ${m.browLengthRatio?.toFixed(3) || 'N/A'}
- 눈썹각도(browAngle): ${m.browAngle?.toFixed(1) || 'N/A'}°
- 눈썹간격(browGapRatio): ${m.browGapRatio?.toFixed(3) || 'N/A'}
- 눈썹두께(browThicknessRatio): ${m.browThicknessRatio?.toFixed(4) || 'N/A'}
[관골·인중·턱]
- 관골돌출(gwanGolProminence): ${m.gwanGolProminence?.toFixed(4) || 'N/A'}
- 인중비율(inJungRatio): ${m.inJungRatio?.toFixed(4) || 'N/A'}
- 턱비율(chinRatio): ${m.chinRatio?.toFixed(3) || 'N/A'}
- 턱각도(jawAngle): ${m.jawAngle?.toFixed(1) || 'N/A'}°
[삼정]
- 상정(upperThirdPct): ${m.upperThirdPct?.toFixed(1) || 'N/A'}%
- 중정(middleThirdPct): ${m.middleThirdPct?.toFixed(1) || 'N/A'}%
- 하정(lowerThirdPct): ${m.lowerThirdPct?.toFixed(1) || 'N/A'}%` : '(실측 데이터 없음)';

      userPrompt = `프리미엄 관상 리포트를 생성해주세요.

고객의 관상 분석 결과:
- 얼굴형: ${features.shape?.label || ''} (${features.shape?.fiveElement || ''}, ${features.shape?.score || ''}점)
- 눈: ${features.eyes?.label || ''} (${features.eyes?.score || ''}점)
- 코: ${features.nose?.label || ''} (${features.nose?.score || ''}점)
- 입: ${features.mouth?.label || ''} (${features.mouth?.score || ''}점)
- 종합점수: ${features.overallScore || ''}점

${measurementBlock}

참고: 십이궁·오관·삼정 분석은 클라이언트에서 이미 생성 완료. 아래 4가지만 생성하세요:
1. analysisProcess (얼굴형·눈썹·눈·코·입 5개 부위 판정 과정)
2. fortuneGraph (면부백세유년도 기반 10대~70대 대운)
3. breakingPoint (파상 약점 + 개운법)
4. enemyFace (오행 상극·상생 인연)

위 30여 개 수치를 적극 인용하여, 이 고객에게만 해당하는 개인화된 분석을 작성하세요.`;

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
