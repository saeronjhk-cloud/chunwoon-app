// Vercel Serverless Function — LLM 운세 해석 API
// 환경 변수: ANTHROPIC_API_KEY (Vercel 대시보드 → Settings → Environment Variables)

// JSON 추출 헬퍼: 마크다운 코드블록, 순수 JSON 모두 처리
function extractJSON(text) {
  // 1) ```json ... ``` 코드블록에서 추출
  const codeBlock = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlock) {
    try { return JSON.parse(codeBlock[1].trim()); } catch {}
  }
  // 2) 첫 번째 { 부터 마지막 } 까지 추출
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first !== -1 && last > first) {
    try { return JSON.parse(text.substring(first, last + 1)); } catch {}
  }
  // 3) 전체 텍스트를 JSON으로 시도
  try { return JSON.parse(text.trim()); } catch {}
  return null;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET = 헬스 체크 + API 키 테스트
  if (req.method === 'GET') {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const hasKey = !!apiKey;
    const keyPreview = apiKey ? apiKey.substring(0, 12) + '...' + apiKey.slice(-4) : 'none';
    // ?test=1 파라미터로 실제 API 호출 테스트
    const url = new URL(req.url, `https://${req.headers.host}`);
    if (url.searchParams.get('test') === '1' && apiKey) {
      try {
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 10, messages: [{ role: 'user', content: 'say ok' }] })
        });
        const body = await resp.text();
        return res.status(200).json({ status: resp.ok ? 'API_OK' : 'API_FAIL', httpStatus: resp.status, keyPreview, response: body.substring(0, 300) });
      } catch (e) {
        return res.status(200).json({ status: 'API_ERROR', keyPreview, error: e.message });
      }
    }
    return res.status(200).json({ status: 'ok', runtime: 'serverless', hasApiKey: hasKey, keyPreview, timestamp: new Date().toISOString() });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  try {
    const { type, features, context } = req.body;
    if (!type || (!features && !context)) return res.status(400).json({ error: 'Missing type, features, or context' });

    let systemPrompt, userPrompt;
    // 모든 프롬프트 끝에 추가할 JSON 강제 지시
    const JSON_FORCE = '\n\n중요: 반드시 순수 JSON만 출력하세요. 마크다운 코드블록(```)이나 설명 텍스트 없이 { 로 시작하여 } 로 끝나는 JSON만 응답하세요.';

    if (type === 'palm') {
      systemPrompt = `당신은 전통 수상학(手相學) 전문가입니다. 동서양 수상학의 전통에 기반하여 손금을 해석합니다.
- 한국어, 해요체, 구체적이고 개인화된 해석, 긍정적이면서도 현실적인 조언
- JSON 형식으로만 응답: {"lines":{"life":"생명선","head":"두뇌선","heart":"감정선","fate":"운명선"},"summary":"종합 해석 200자+","advice":"천운의 조언"}` + JSON_FORCE;

      userPrompt = `손금 분석 대상: ${context?.gender === 'male' ? '남성' : '여성'}, ${context?.hand === 'left' ? '왼손' : '오른손'}
손금 특징: ${JSON.stringify(features, null, 2)}
각 손금선의 길이, 깊이, 곡률, 특이점을 고려하여 구체적으로 해석해주세요.`;

    } else if (type === 'face') {
      systemPrompt = `당신은 전통 관상학(觀相學) 전문가입니다. 마의상법, 유장상법, 신상전편, 오행상법에 기반합니다.
- 한국어, 해요체
- 얼굴형(오행), 눈(감찰관), 코(재백궁), 입(출납관) 각각 해석
- measurements 수치를 해석에 직접 인용 (예: "가로세로비 0.82로 金形")
- JSON 형식으로만 응답: {"shape":"얼굴형","eyes":"눈","nose":"코","mouth":"입","summary":"종합 200자+","advice":"조언"}` + JSON_FORCE;

      const m = features.measurements;
      const mb = m ? `실측: whR:${m.whRatio?.toFixed(3)||'?'}, jawR:${m.jawRatio?.toFixed(3)||'?'}, eyeR:${m.eyeRatio?.toFixed(2)||'?'}, noseW:${((m.noseWRatio||0)*100).toFixed(1)}%, mouth:${m.mouthFaceRatio?.toFixed(3)||'?'}, sym:${((m.symmetry||0)*100).toFixed(1)}%, thirds:${((m.thirdsScore||0)*100).toFixed(1)}%` : '';

      userPrompt = `얼굴형:${features.shape?.label||''}(${features.shape?.fiveElement||''} ${features.shape?.score||''}점), 눈:${features.eyes?.label||''}(${features.eyes?.score||''}점), 코:${features.nose?.label||''}(${features.nose?.score||''}점), 입:${features.mouth?.label||''}(${features.mouth?.score||''}점), 종합:${features.overallScore||''}점. ${mb}`;

    } else if (type === 'face_premium_1') {
      systemPrompt = `관상학 대가. 마의상법·신상전편 기반. 한국어 해요체. 고전 한문 원문+번역 인용. 수치 인용.
반드시 아래 정확한 JSON 구조로만 응답:
{"analysisProcess":{"features":[{"part":"string","measured":"string","standard":"string","classification":"string","confidence":number,"reasoning":"string 80자+","citation":{"book":"string","original":"string","translation":"string"}}]},"fortuneGraph":{"decades":[{"age":"string","wealth":number,"love":number,"health":number,"keyword":"string"}],"analysis":"string 100자+","peakAge":"string","citation":{"book":"string","original":"string","translation":"string"}}}
features 배열에 얼굴형,눈,코,입 4개 항목. decades 배열에 10대,20대,30대,40대,50대,60대,70대+ 7개 항목.` + JSON_FORCE;

      const m = features.measurements;
      const mStr = m ? `whR:${m.whRatio?.toFixed(3)||'?'},jawR:${m.jawRatio?.toFixed(3)||'?'},eyeR:${m.eyeRatio?.toFixed(2)||'?'},noseW:${((m.noseWRatio||0)*100).toFixed(1)}%,noseH:${((m.noseHRatio||0)*100).toFixed(1)}%,sym:${((m.symmetry||0)*100).toFixed(1)}%,thirds:${((m.thirdsScore||0)*100).toFixed(1)}%,upper:${m.upperThirdPct?.toFixed(1)||'?'}%,mid:${m.middleThirdPct?.toFixed(1)||'?'}%,lower:${m.lowerThirdPct?.toFixed(1)||'?'}%` : 'N/A';

      userPrompt = `얼굴형:${features.shape?.label||''}(${features.shape?.fiveElement||''}${features.shape?.score||''}점),눈:${features.eyes?.label||''}(${features.eyes?.score||''}점),코:${features.nose?.label||''}(${features.nose?.score||''}점),입:${features.mouth?.label||''}(${features.mouth?.score||''}점),종합:${features.overallScore||''}점.[${mStr}]`;

    } else if (type === 'face_premium_2') {
      systemPrompt = `관상학 대가. 마의상법·신상전편 기반. 한국어 해요체. 고전 한문 원문+번역 인용.
반드시 아래 정확한 JSON 구조로만 응답:
{"breakingPoint":{"weaknesses":[{"part":"string","problem":"string 60자+","solution":"string 60자+","measurement":"string","citation":{"book":"string","original":"string","translation":"string"}}],"summary":"string 80자+"},"enemyFace":{"enemies":[{"feature":"string","reason":"string 60자+","risk":"string","citation":{"book":"string","original":"string","translation":"string"}}],"allies":[{"feature":"string","reason":"string 60자+","benefit":"string"}],"summary":"string 80자+"}}
weaknesses 2개, enemies 2개, allies 2개.` + JSON_FORCE;

      const m = features.measurements;
      const mStr = m ? `whR:${m.whRatio?.toFixed(3)||'?'},jawR:${m.jawRatio?.toFixed(3)||'?'},noseW:${((m.noseWRatio||0)*100).toFixed(1)}%,sym:${((m.symmetry||0)*100).toFixed(1)}%,thirds:${((m.thirdsScore||0)*100).toFixed(1)}%` : 'N/A';

      userPrompt = `얼굴형:${features.shape?.label||''}(${features.shape?.fiveElement||''}),눈:${features.eyes?.label||''},코:${features.nose?.label||''},입:${features.mouth?.label||''},점수:${features.overallScore||''}점.[${mStr}]`;

    } else if (type === 'tojeong') {
      systemPrompt = `당신은 토정비결(土亭秘訣) 전문가입니다. 조선 중기 대학자 토정 이지함(李之菡) 선생의 토정비결에 기반하여 한 해의 운세를 해석합니다.

규칙:
- 한국어, 해요체
- 전달받은 괘(卦) 조합에 맞는 전통적 해석을 기반으로 하되, 현대적으로 풀어서 설명
- 각 월별 운세는 구체적이고 실용적인 조언 포함
- 전체적으로 따뜻하고 희망적이면서도 현실적인 톤
- 띠와 괘 조합의 상호작용도 고려

반드시 아래 JSON 구조로만 응답:
{"yearReading":"올해 총운 요약 250자+","trigram":{"name":"괘 조합 이름","hanja":"한자 표기","meaning":"괘 해석 150자+"},"scores":{"overall":number(0-100),"wealth":number(0-100),"health":number(0-100),"love":number(0-100),"career":number(0-100)},"monthlyBrief":["1월 요약 40자+","2월 요약 40자+","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"],"luckyInfo":{"color":"행운의 색","number":"행운의 숫자","direction":"행운의 방위"},"caution":"주의사항 100자+","advice":"종합 조언 150자+"}` + JSON_FORCE;

      const c = context || {};
      userPrompt = `${c.targetYear||new Date().getFullYear()}년 토정비결 해석 요청
이름: ${c.name||'사용자'}, 성별: ${c.gender==='male'?'남성':'여성'}
음력 생년월일: ${c.lunarYear||''}년 ${c.lunarMonth||''}월 ${c.lunarDay||''}일
띠: ${c.zodiac||''}
천간지지: ${c.ganjiYear||''}
상괘(태세괘): ${c.upperGua||''} (태세수 ${c.taeseNum||''})
중괘(월건괘): ${c.middleGua||''} (월건수 ${c.wolNum||''})
하괘(일진괘): ${c.lowerGua||''} (일진수 ${c.ilNum||''})
괘 조합: ${c.guaCombination||''}
이 괘 조합에 맞는 ${c.targetYear||new Date().getFullYear()}년 운세를 토정비결에 기반하여 해석해주세요.`;

    } else if (type === 'tojeong_premium') {
      systemPrompt = `당신은 토정비결(土亭秘訣) 대가입니다. 토정 이지함의 원문에 기반한 깊이 있는 해석을 제공합니다.
한국어 해요체. 고전 한문 원문+번역 인용.

반드시 아래 JSON 구조로만 응답:
{"detailedYear":"올해 심층 총운 400자+","guaAnalysis":{"upper":{"name":"상괘명","element":"오행","meaning":"해석 100자+"},"middle":{"name":"중괘명","element":"오행","meaning":"해석 100자+"},"lower":{"name":"하괘명","element":"오행","meaning":"해석 100자+"},"combination":"괘 조합 심층 해석 200자+","citation":{"book":"출전","original":"한문 원문","translation":"번역"}},"monthlyDetail":[{"month":1,"fortune":"상세 운세 80자+","wealth":"재물","health":"건강","love":"연애","advice":"조언","luckyDay":"길일","cautionDay":"주의일"},{"month":2,"fortune":"","wealth":"","health":"","love":"","advice":"","luckyDay":"","cautionDay":""},{"month":3,"fortune":"","wealth":"","health":"","love":"","advice":"","luckyDay":"","cautionDay":""},{"month":4,"fortune":"","wealth":"","health":"","love":"","advice":"","luckyDay":"","cautionDay":""},{"month":5,"fortune":"","wealth":"","health":"","love":"","advice":"","luckyDay":"","cautionDay":""},{"month":6,"fortune":"","wealth":"","health":"","love":"","advice":"","luckyDay":"","cautionDay":""},{"month":7,"fortune":"","wealth":"","health":"","love":"","advice":"","luckyDay":"","cautionDay":""},{"month":8,"fortune":"","wealth":"","health":"","love":"","advice":"","luckyDay":"","cautionDay":""},{"month":9,"fortune":"","wealth":"","health":"","love":"","advice":"","luckyDay":"","cautionDay":""},{"month":10,"fortune":"","wealth":"","health":"","love":"","advice":"","luckyDay":"","cautionDay":""},{"month":11,"fortune":"","wealth":"","health":"","love":"","advice":"","luckyDay":"","cautionDay":""},{"month":12,"fortune":"","wealth":"","health":"","love":"","advice":"","luckyDay":"","cautionDay":""}],"wealthAnalysis":"재물운 심층 분석 200자+","careerAnalysis":"직업운 심층 분석 200자+","healthAnalysis":"건강운 심층 분석 200자+","loveAnalysis":"연애·인간관계 심층 분석 200자+","remedies":[{"area":"영역","problem":"문제점","solution":"개운법 80자+"}],"luckyInfo":{"colors":["색1","색2"],"numbers":[0,0,0],"directions":["방위1","방위2"],"bestMonths":"가장 좋은 달","cautionMonths":"주의할 달"},"citation":{"book":"출전","original":"한문 원문","translation":"번역"}}
monthlyDetail 배열에 반드시 12개월 모두 포함. remedies 2~3개.` + JSON_FORCE;

      const c = context || {};
      userPrompt = `${c.targetYear||new Date().getFullYear()}년 토정비결 프리미엄 해석
이름: ${c.name||'사용자'}, 성별: ${c.gender==='male'?'남성':'여성'}
음력 생년월일: ${c.lunarYear||''}년 ${c.lunarMonth||''}월 ${c.lunarDay||''}일
띠: ${c.zodiac||''}, 천간지지: ${c.ganjiYear||''}
상괘: ${c.upperGua||''} (태세수 ${c.taeseNum||''})
중괘: ${c.middleGua||''} (월건수 ${c.wolNum||''})
하괘: ${c.lowerGua||''} (일진수 ${c.ilNum||''})
괘 조합: ${c.guaCombination||''}
토정비결 원문에 기반한 깊이 있는 해석을 해주세요. 각 월별 상세 운세, 재물·직업·건강·연애 심층 분석, 개운법을 포함해주세요.`;

    } else {
      return res.status(400).json({ error: 'Invalid type' });
    }

    // 타입별 max_tokens 조정
    let maxTokens = 1500;
    if (type === 'tojeong') maxTokens = 2000;
    else if (type === 'tojeong_premium') maxTokens = 3500;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: 'LLM API error', detail: response.status, message: errText.substring(0, 300) });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    const parsed = extractJSON(text);
    if (parsed) {
      return res.status(200).json({ success: true, result: parsed });
    } else {
      // JSON 파싱 실패 — 디버그용으로 원본 텍스트 첫 500자 포함
      return res.status(200).json({ success: true, result: { raw: text.substring(0, 500) } });
    }

  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
}
