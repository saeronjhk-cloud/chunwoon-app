// Vercel Serverless Function — LLM 운세 해석 API
// 환경 변수: ANTHROPIC_API_KEY (Vercel 대시보드 → Settings → Environment Variables)

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET = 헬스 체크
  if (req.method === 'GET') {
    const hasKey = !!process.env.ANTHROPIC_API_KEY;
    return res.status(200).json({ status: 'ok', runtime: 'serverless', hasApiKey: hasKey, timestamp: new Date().toISOString() });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  try {
    const { type, features, context } = req.body;
    if (!type || !features) return res.status(400).json({ error: 'Missing type or features' });

    let systemPrompt, userPrompt;

    if (type === 'palm') {
      systemPrompt = `당신은 전통 수상학(手相學) 전문가입니다. 동서양 수상학의 전통에 기반하여 손금을 해석합니다.
- 한국어, 해요체, 구체적이고 개인화된 해석, 긍정적이면서도 현실적인 조언
- JSON 응답: {"lines":{"life":"생명선","head":"두뇌선","heart":"감정선","fate":"운명선"},"summary":"종합 해석 200자+","advice":"천운의 조언"}`;

      userPrompt = `손금 분석 대상: ${context?.gender === 'male' ? '남성' : '여성'}, ${context?.hand === 'left' ? '왼손' : '오른손'}
손금 특징: ${JSON.stringify(features, null, 2)}
각 손금선의 길이, 깊이, 곡률, 특이점을 고려하여 구체적으로 해석해주세요.`;

    } else if (type === 'face') {
      systemPrompt = `당신은 전통 관상학(觀相學) 전문가입니다. 마의상법, 유장상법, 신상전편, 오행상법에 기반합니다.
- 한국어, 해요체
- 얼굴형(오행), 눈(감찰관), 코(재백궁), 입(출납관) 각각 해석
- measurements 수치를 해석에 직접 인용 (예: "가로세로비 0.82로 金形")
- JSON 응답: {"shape":"얼굴형","eyes":"눈","nose":"코","mouth":"입","summary":"종합 200자+","advice":"조언"}`;

      const m = features.measurements;
      const mb = m ? `실측: whR:${m.whRatio?.toFixed(3)||'?'}, jawR:${m.jawRatio?.toFixed(3)||'?'}, eyeR:${m.eyeRatio?.toFixed(2)||'?'}, noseW:${((m.noseWRatio||0)*100).toFixed(1)}%, mouth:${m.mouthFaceRatio?.toFixed(3)||'?'}, sym:${((m.symmetry||0)*100).toFixed(1)}%, thirds:${((m.thirdsScore||0)*100).toFixed(1)}%` : '';

      userPrompt = `얼굴형:${features.shape?.label||''}(${features.shape?.fiveElement||''} ${features.shape?.score||''}점), 눈:${features.eyes?.label||''}(${features.eyes?.score||''}점), 코:${features.nose?.label||''}(${features.nose?.score||''}점), 입:${features.mouth?.label||''}(${features.mouth?.score||''}점), 종합:${features.overallScore||''}점. ${mb}`;

    } else if (type === 'face_premium_1') {
      systemPrompt = `관상학 대가. 마의상법·신상전편 기반. 한국어 해요체. 고전 한문 원문+번역 인용. 수치 인용.
JSON 응답:
{"analysisProcess":{"features":[{"part":"얼굴형/눈/코/입","measured":"실측값","standard":"기준","classification":"분류명","confidence":0~100,"reasoning":"판정이유 80자+","citation":{"book":"출전","original":"한문원문","translation":"번역"}}]},"fortuneGraph":{"decades":[{"age":"10대~70대","wealth":0~100,"love":0~100,"health":0~100,"keyword":"한마디"}],"analysis":"삼정기반 대운해석 100자+","peakAge":"최고운시기","citation":{"book":"출전","original":"한문","translation":"번역"}}}
features 4개(얼굴형,눈,코,입). decades 7개(10대~70대).`;

      const m = features.measurements;
      const mStr = m ? `whR:${m.whRatio?.toFixed(3)||'?'},jawR:${m.jawRatio?.toFixed(3)||'?'},eyeR:${m.eyeRatio?.toFixed(2)||'?'},noseW:${((m.noseWRatio||0)*100).toFixed(1)}%,noseH:${((m.noseHRatio||0)*100).toFixed(1)}%,sym:${((m.symmetry||0)*100).toFixed(1)}%,thirds:${((m.thirdsScore||0)*100).toFixed(1)}%,upper:${m.upperThirdPct?.toFixed(1)||'?'}%,mid:${m.middleThirdPct?.toFixed(1)||'?'}%,lower:${m.lowerThirdPct?.toFixed(1)||'?'}%` : 'N/A';

      userPrompt = `얼굴형:${features.shape?.label||''}(${features.shape?.fiveElement||''}${features.shape?.score||''}점),눈:${features.eyes?.label||''}(${features.eyes?.score||''}점),코:${features.nose?.label||''}(${features.nose?.score||''}점),입:${features.mouth?.label||''}(${features.mouth?.score||''}점),종합:${features.overallScore||''}점.[${mStr}]`;

    } else if (type === 'face_premium_2') {
      systemPrompt = `관상학 대가. 마의상법·신상전편 기반. 한국어 해요체. 고전 한문 원문+번역 인용.
JSON 응답:
{"breakingPoint":{"weaknesses":[{"part":"부위","problem":"문제점 60자+","solution":"개운법 60자+","measurement":"수치","citation":{"book":"출전","original":"한문","translation":"번역"}}],"summary":"종합개운 80자+"},"enemyFace":{"enemies":[{"feature":"관상특징","reason":"이유 60자+","risk":"위험","citation":{"book":"출전","original":"한문","translation":"번역"}}],"allies":[{"feature":"관상특징","reason":"이유 60자+","benefit":"장점"}],"summary":"오행궁합 80자+"}}
weaknesses 2개, enemies 2개, allies 2개.`;

      const m = features.measurements;
      const mStr = m ? `whR:${m.whRatio?.toFixed(3)||'?'},jawR:${m.jawRatio?.toFixed(3)||'?'},noseW:${((m.noseWRatio||0)*100).toFixed(1)}%,sym:${((m.symmetry||0)*100).toFixed(1)}%,thirds:${((m.thirdsScore||0)*100).toFixed(1)}%` : 'N/A';

      userPrompt = `얼굴형:${features.shape?.label||''}(${features.shape?.fiveElement||''}),눈:${features.eyes?.label||''},코:${features.nose?.label||''},입:${features.mouth?.label||''},점수:${features.overallScore||''}점.[${mStr}]`;

    } else {
      return res.status(400).json({ error: 'Invalid type' });
    }

    const isPremium = type.startsWith('face_premium');
    const model = isPremium ? 'claude-haiku-4-5-20251001' : 'claude-sonnet-4-20250514';
    const maxTok = isPremium ? 1500 : 1500;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTok,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: 'LLM API error', detail: response.status, message: errText.substring(0, 200) });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    let parsed;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch {
      parsed = { raw: text };
    }

    return res.status(200).json({ success: true, result: parsed });

  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
}
