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

    } else if (type === 'dream') {
      // 꿈해몽 무료 — 한국 전통 + 융 심리학 통합 (사주 연계는 프리미엄)
      systemPrompt = `당신은 꿈 해석 전문가입니다. 한국 전통 해몽(주공해몽서) + 융(C.G. Jung) 심리학을 통합하여 풀이합니다.
한국어 해요체. 꿈의 줄거리·시점·정서·모티브를 직접 인용하며 풀이.
- 한국 전통: 주공해몽서 14대 분류 매핑 + 길흉 판정
- 융 심리학: archetype(페르소나·그림자·자기 등) 관점에서 무의식의 메시지
- 핵심 상징 3개 추출 (꿈에서 가장 중요한 것)
- 따뜻하지만 통찰력 있는 톤

반드시 아래 JSON 구조로만 응답:
{"summary":"종합 풀이 250자 내외 (전통+융 통합 톤)","traditionalReading":"한국 전통 해석 150자 내외 (주공해몽 분류 + 길흉 판정)","jungianReading":"융 심리학 해석 150자 내외 (archetype + 무의식 메시지)","fortuneType":"길몽 / 흉몽 / 계시몽 / 평몽 중 하나","fortuneScore":number(0-100),"keySymbols":[{"symbol":"상징명","meaning":"의미 한 줄"}],"luckyNumbers":[number,number,number,number],"luckyColor":"행운의 색","emotionalState":"꿈이 비추는 감정 상태 80자 내외","advice":"실생활 조언 100자 내외"}
keySymbols 배열에 꿈의 핵심 상징 3개.` + JSON_FORCE;

      const c = context || {};
      userPrompt = `꿈 해몽 의뢰
시점: ${c.time||'기억 안 남'}
핵심 모티브: ${c.categories||'미선택'}
정서: ${c.emotion||'미선택'}
줄거리: ${c.story||'(미입력)'}
${c.sajuLinked?`사주 연계 정보 — 일간: ${c.ilgan||''}(${c.ilganElement||''}), 일주: ${c.dayPillar||''}, 강한 오행: ${c.dominantElement||''}`:''}

이 꿈을 한국 전통 해몽 + 융 심리학 두 관점으로 풀이해주세요.`;

    } else if (type === 'dream_premium_1') {
      // 1단계: 한국 전통 심층 + 융 심층 + 사주 연계 풀이
      systemPrompt = `당신은 꿈 해석 대가입니다. 주공해몽서·몽점일지·융 분석심리학·프로이트 정신분석 통합.
한국어 해요체. 고전 한문 원문+번역 인용 가능.
- 한국 전통 심층: 주공해몽서 카테고리별 길흉 + 한국 민속 해몽 (예: 돼지꿈=재물)
- 융 심층: 집단 무의식·archetype·그림자·아니마/아니무스·자기(self) 통합 관점
- 사주 연계 (있을 시): 사용자 일간·강한 오행과 꿈의 오행/모티브 상관관계 — 같은 꿈도 일간 火/水에 따라 다른 의미
- 무의식 진단: 꿈이 비추는 현재 감정·욕구·갈등
간결하게: 각 섹션 150자 내외. 핵심만.

반드시 아래 정확한 JSON 구조로만 응답:
{"traditionalDeep":"한국 전통 심층 풀이 150자 내외","jungianDeep":"융 심리학 심층 풀이 150자 내외","sajuLink":"사주 연계 풀이 150자 내외 (사주 정보 없으면 빈 문자열)","unconsciousReading":"무의식 진단 (감정·욕구·갈등) 150자 내외","citation":{"book":"출전 (주공해몽/적천수/Jung 등)","original":"원문 또는 인용","translation":"번역 또는 풀이"}}` + JSON_FORCE;

      const c = context || {};
      userPrompt = `꿈해몽 프리미엄 1단계 (전통+융+사주+무의식)
시점: ${c.time||''}
핵심 모티브: ${c.categories||''}
정서: ${c.emotion||''}
줄거리: ${c.story||''}
${c.sajuLinked?`사주 일간: ${c.ilgan||''}(${c.ilganElement||''}), 일주: ${c.dayPillar||''}, 강한 오행: ${c.dominantElement||''}, 약한 오행: ${c.weakElement||''}`:'사주 연계: 없음'}

전통·융·사주(있을 시)·무의식 4관점 심층 풀이를 해주세요.`;

    } else if (type === 'dream_premium_2') {
      // 2단계: 상징별 정밀 분석 + 화몽법(길몽 강화/흉몽 해소) + 시기별 영향
      systemPrompt = `당신은 꿈 해석 대가입니다.
한국어 해요체. 1단계와 일관성 유지. 간결하게.
- 상징별 정밀: 꿈의 핵심 상징 4~5개 각각 상세 분석 (전통+심리)
- 화몽법(化夢法): 길몽 강화·흉몽 해소 의식·실천법 (한국 민속 + 현대 적용)
- 시기별 영향: 꿈이 향후 1주·1개월·3개월·1년에 미칠 영향
- 행운 정보: 색·숫자·방위·길일

반드시 아래 정확한 JSON 구조로만 응답:
{"symbolsDetail":[{"symbol":"상징명","traditional":"전통 의미 70자 내외","psychological":"심리 의미 70자 내외","action":"이 상징이 주는 메시지 60자 내외"}],"hwamongbup":{"strengthen":"길몽 강화법 100자 내외 (해당 시)","dissolve":"흉몽 해소법 100자 내외 (해당 시)","ritual":"민속 의식 한 줄 (예: 동쪽으로 돌아 절하기)"},"timelineImpact":{"week1":"1주 50자 내외","month1":"1개월 50자 내외","month3":"3개월 50자 내외","year1":"1년 50자 내외"},"luckyDetail":{"colors":["색1","색2"],"numbers":[0,0,0,0],"directions":["방위1","방위2"],"luckyDay":"길일 한 줄"}}
symbolsDetail 4~5개.` + JSON_FORCE;

      const c = context || {};
      userPrompt = `꿈해몽 프리미엄 2단계 (상징·화몽법·시기·행운)
시점: ${c.time||''}
모티브: ${c.categories||''}
정서: ${c.emotion||''}
줄거리: ${c.story||''}
${c.sajuLinked?`사주 일간: ${c.ilgan||''}(${c.ilganElement||''})`:'사주 연계: 없음'}

핵심 상징 4~5개 정밀 분석, 화몽법, 시기별 영향, 행운 정보를 풀이해주세요.`;

    } else if (type === 'compat') {
      // 궁합 무료 분석
      systemPrompt = `당신은 사주명리 궁합 전문가입니다. 자평진전·삼명통회 기반.
한국어 해요체. 두 사람의 사주 4기둥 + 합충 분석 데이터를 직접 인용하며 풀이.
- 일간(日干) 케미가 핵심 (合化·相沖·相生·相剋)
- 일지(日支)는 배우자궁이라 가장 중요
- 합·충·해 관계로 끌림과 갈등 진단
- 두 사주의 오행 보완성 평가
- 따뜻하고 희망적이지만 현실적인 톤
- autoScore는 자동 산출값. LLM은 명리적 판단으로 보정한 score 제시.

반드시 아래 JSON 구조로만 응답:
{"summary":"두 사주 종합 궁합 풀이 250자 내외","ilganChemistry":"일간 케미 풀이 150자 내외","habChungAnalysis":"합·충·해 풀이 100자 내외","elementBalance":"오행 보완성 100자 내외","score":number(55-99),"grade":"등급 (천생연분/좋은인연/노력하면좋은궁합/평범한인연/특별한인연 중)","scores":{"personality":number(0-100),"romance":number(0-100),"wealth":number(0-100),"life":number(0-100)},"luckyInfo":{"color":"공통 행운의 색","direction":"공통 행운의 방위","activity":"좋은 함께 활동"},"caution":"주의사항 80자 내외","advice":"종합 조언 100자 내외"}` + JSON_FORCE;

      const c = context || {};
      userPrompt = `궁합 분석 의뢰
${c.name1||'A'}님(${c.gender1||''}): ${c.pillar1||''} / 일간 ${c.ilgan1||''}
${c.name2||'B'}님(${c.gender2||''}): ${c.pillar2||''} / 일간 ${c.ilgan2||''}

일간 관계: ${c.ilganRelation||''}
일지(배우자궁) 관계: ${c.iljiRelation||''}
천간합: ${c.hsHabs||''}
천간충: ${c.hsChungs||''}
지지 육합: ${c.ebHabs||''}
지지 육충: ${c.ebChungs||''}
지지 육해: ${c.ebHaes||''}
오행 합산 분포: ${c.elsCombined||''}
부족한 오행: ${c.lacking||''}
과한 오행: ${c.excess||''}
자동 산출 점수: ${c.autoScore||''}점

이 두 사람의 궁합을 명리학적으로 풀이해주세요.`;

    } else if (type === 'compat_premium_1') {
      // 1단계: 일간/일지 정밀 매치 + 합충 상세 + 오행 보완 + 영역별 심층
      systemPrompt = `당신은 명리 궁합 대가입니다. 자평진전·삼명통회·연해자평 기반.
한국어 해요체. 고전 한문 원문+번역 인용 가능. 두 사주 데이터 직접 인용.
- 일간 정밀 매치: 合化(예: 갑기→토)의 의미와 실제 영향력
- 일지 매치: 배우자궁이 합인지 충인지에 따라 결혼 후 관계
- 합·충·형·해 8글자 단위 상세
- 오행 보완 — 부족·과한 오행을 두 사람이 어떻게 채워주거나 충돌하는지
- 영역별 심층 (성격·연애결혼·재물·자녀·생활)
간결하게: 4영역 deep은 각 130자 내외, 일간·일지·합충·오행 deep은 각 200자 내외. 핵심만.

반드시 아래 정확한 JSON 구조로만 응답:
{"ilganDeep":"일간 정밀 매치 200자 내외","iljiDeep":"일지(배우자궁) 정밀 매치 200자 내외","habChungDetail":"합·충·형·해 상세 200자 내외","elementBalance":"오행 보완성 정밀 200자 내외","areasDeep":{"personality":"성격 케미 130자 내외","romance":"연애·결혼 130자 내외","wealth":"재물 호흡 130자 내외","children":"자녀운 130자 내외","life":"생활 합 130자 내외"}}` + JSON_FORCE;

      const c = context || {};
      userPrompt = `궁합 프리미엄 1단계 (정밀 매치·합충·영역 심층)
${c.name1||'A'}님: ${c.pillar1||''} / 일간 ${c.ilgan1||''}
${c.name2||'B'}님: ${c.pillar2||''} / 일간 ${c.ilgan2||''}
일간 관계: ${c.ilganRelation||''} / 일지 관계: ${c.iljiRelation||''}
천간합: ${c.hsHabs||''} / 천간충: ${c.hsChungs||''}
지지 육합: ${c.ebHabs||''} / 육충: ${c.ebChungs||''} / 육해: ${c.ebHaes||''}
오행 합산: ${c.elsCombined||''} / 부족: ${c.lacking||''} / 과: ${c.excess||''}
이 두 사람의 정밀 매치·합충·오행·5영역을 풀이해주세요.`;

    } else if (type === 'compat_premium_2') {
      // 2단계: 대운 동행 + 갈등 시나리오 + 결혼 길흉일 + 개운법
      systemPrompt = `당신은 명리 궁합 대가입니다.
한국어 해요체. 1단계 해석과 일관성 유지. 간결하게 핵심만.
- 대운 동행: 두 사람 8단계 대운(0~80세)을 비교, 함께 좋은 시기·도전 시기
- 갈등 시나리오: 합충 관계로 발생할 수 있는 구체 상황 + 처방 3~4개
- 결혼 길흉: 두 사주에 좋은 달·피할 달
- 백년해로 개운법: 두 사람이 함께 실천할 보강법

반드시 아래 정확한 JSON 구조로만 응답:
{"daewoonAlignment":[{"period":"0~9세","fortune":"50자 내외"},{"period":"10~19세","fortune":""},{"period":"20~29세","fortune":""},{"period":"30~39세","fortune":""},{"period":"40~49세","fortune":""},{"period":"50~59세","fortune":""},{"period":"60~69세","fortune":""},{"period":"70~79세","fortune":""}],"scenarios":[{"situation":"갈등 상황 한 줄","trigger":"발생 원인 한 줄 (사주 근거)","solution":"화합 처방 80자 내외"}],"weddingDays":{"luckyMonths":"길월 예: 3월·9월","cautionMonths":"피할 달 예: 7월","advice":"택일 조언 80자 내외"},"gaeunbup":"백년해로 개운법 200자 내외"}
daewoonAlignment 8단계 모두, scenarios 3~4개.` + JSON_FORCE;

      const c = context || {};
      userPrompt = `궁합 프리미엄 2단계 (대운 동행·시나리오·결혼·개운)
${c.name1||'A'}님(${c.gender1||''}): ${c.pillar1||''}
${c.name2||'B'}님(${c.gender2||''}): ${c.pillar2||''}
일간/일지 관계: ${c.ilganRelation||''} / ${c.iljiRelation||''}
합충 요약: 합 ${c.hsHabs||''} ${c.ebHabs||''} / 충 ${c.hsChungs||''} ${c.ebChungs||''} / 해 ${c.ebHaes||''}
두 사람 8단계 대운 동행, 갈등 시나리오 3~4개, 결혼 길흉, 백년해로 개운법을 풀이해주세요.`;

    } else if (type === 'saju') {
      // 사주 무료 분석
      systemPrompt = `당신은 사주명리(四柱命理) 전문가입니다. 자평진전·적천수·궁통보감에 기반합니다.
한국어 해요체. 사주 8글자 + 오행 + 십성 데이터를 직접 인용하며 풀이.
- 일간(日干)을 중심으로 강약·성격·재능 판정
- 십성 분포로 재물·관·인복 분석
- 올해 세운(歲運)과 사주의 상호작용 해석
- 따뜻하고 희망적이지만 현실적인 톤

반드시 아래 JSON 구조로만 응답:
{"summary":"사주 8글자 종합 풀이 250자+","ilganReading":"일간 강약 + 본질 풀이 150자+","sipsungAnalysis":"십성 분포로 본 재물·관·인복 분석 120자+","yearFortune":"올해 세운 풀이 150자+","scores":{"overall":number(0-100),"wealth":number(0-100),"health":number(0-100),"love":number(0-100),"career":number(0-100)},"luckyInfo":{"color":"행운의 색","number":"행운의 숫자","direction":"행운의 방위"},"caution":"주의사항 80자+","advice":"종합 조언 120자+"}` + JSON_FORCE;

      const c = context || {};
      userPrompt = `사주 분석 의뢰
이름: ${c.name||'사용자'}, 성별: ${c.gender==='male'?'남성':'여성'}
생년월일: ${c.calType==='lunar'?'음력':'양력'} ${c.inputYear||''}년 ${c.inputMonth||''}월 ${c.inputDay||''}일${c.hourLabel?' '+c.hourLabel:''}${c.isAdjusted?` (입춘 보정 → 사주연 ${c.sajuYear})`:''}
사주 4기둥: 연주 ${c.yearPillar||''} | 월주 ${c.monthPillar||''} | 일주 ${c.dayPillar||''} | 시주 ${c.hourPillar||'-'}
일간: ${c.ilgan||''} (${c.ilganYinyang||''}${c.ilganElement||''})
오행 분포 (천간+지지 합산): 목 ${c.els?.[0]||0} · 화 ${c.els?.[1]||0} · 토 ${c.els?.[2]||0} · 금 ${c.els?.[3]||0} · 수 ${c.els?.[4]||0}
십성: 연주 ${c.sipsungYear||''} · 월주 ${c.sipsungMonth||''} · 시주 ${c.sipsungHour||''}
올해 세운: ${c.currentYear||new Date().getFullYear()}년 ${c.currentGanji||''}
이 사주를 분석해 주세요.`;

    } else if (type === 'saju_premium_1') {
      // 1단계: 격국 + 용신 + 십성 심층 + 4영역 심층
      systemPrompt = `당신은 사주명리 대가입니다. 자평진전·적천수·궁통보감 기반.
한국어 해요체. 고전 한문 원문+번역 인용. 사주 8글자와 십성 수치를 직접 인용.
- 격국(格局) 판정: 정격(정관·재격·인수·식신 등) 또는 외격(종격·화격) 자동 분류
- 용신(用神) 추천: 일간 강약 + 월령 + 오행 균형 종합
- 십성 위치별 의미 (연주=조부·초년, 월주=부모·청년, 일지=배우자, 시주=자식·말년)
- 재물·직업·건강·연애 4영역 심층 풀이
간결하게: 4영역 deep 분석은 각 130~150자 내외, 격국 description은 150자 내외. 핵심만.

반드시 아래 정확한 JSON 구조로만 응답:
{"gyeokguk":{"name":"격국명 예: 정관격","type":"정격 또는 외격","description":"격국 풀이 150자 내외"},"yongsin":{"element":"용신 오행 예: 금","reasoning":"선택 이유 80자 내외","method":"보강법 60자 내외"},"sipsungDetail":[{"name":"십성명","position":"연/월/일/시","meaning":"역할 풀이 60자 내외"}],"wealthDeep":"재물운 심층 130자 내외","careerDeep":"직업운 심층 130자 내외","healthDeep":"건강운 심층 130자 내외","loveDeep":"연애·인간관계 심층 130자 내외","citation":{"book":"출전","original":"한문 원문","translation":"번역"}}
sipsungDetail 배열에 4기둥 각 천간의 십성 4개 포함.` + JSON_FORCE;

      const c = context || {};
      userPrompt = `사주 프리미엄 1단계 (격국·용신·심층)
이름: ${c.name||'사용자'}, 성별: ${c.gender==='male'?'남성':'여성'}
4기둥: ${c.yearPillar||''} ${c.monthPillar||''} ${c.dayPillar||''} ${c.hourPillar||'-'}
일간: ${c.ilgan||''} (${c.ilganYinyang||''}${c.ilganElement||''})
오행 분포: 목${c.els?.[0]||0} 화${c.els?.[1]||0} 토${c.els?.[2]||0} 금${c.els?.[3]||0} 수${c.els?.[4]||0}
십성: 연 ${c.sipsungYear||''} / 월 ${c.sipsungMonth||''} / 시 ${c.sipsungHour||''}
이 사주의 격국·용신·4영역 심층 풀이를 해주세요.`;

    } else if (type === 'saju_premium_2') {
      // 2단계: 대운 + 합충 + 신살 + 12개월 세운 + 개운법
      systemPrompt = `당신은 사주명리 대가입니다. 자평진전·적천수 기반.
한국어 해요체. 1단계 해석과 일관성 유지. 간결하게 핵심만.
- 대운(大運): 10년 단위 8단계 (출생부터 80세까지)로 인생 흐름 (월주 천간지지 기준 순/역행, 양남음녀 순행·음남양녀 역행)
- 합·충·형·해: 4기둥 지지 간 관계 (寅卯辰 회국, 子午沖, 寅巳申 三刑 등)
- 신살(神煞): 천을귀인·도화살·역마살·공망 등 핵심 4~6개
- 12개월 세운: 올해 매달 운세 흐름

반드시 아래 정확한 JSON 구조로만 응답:
{"daewoon":[{"age":"0~9세","ganji":"천간지지","fortune":"50자 내외"},{"age":"10~19세","ganji":"","fortune":""},{"age":"20~29세","ganji":"","fortune":""},{"age":"30~39세","ganji":"","fortune":""},{"age":"40~49세","ganji":"","fortune":""},{"age":"50~59세","ganji":"","fortune":""},{"age":"60~69세","ganji":"","fortune":""},{"age":"70~79세","ganji":"","fortune":""}],"habChung":[{"type":"합/충/형/해","between":"위치-위치 예: 일지-월지","effect":"영향 한 줄"}],"sinsal":[{"name":"신살명","position":"위치","effect":"의미 한 줄"}],"monthlyFortune":[{"month":1,"fortune":"한 줄","wealth":"한 줄","health":"한 줄","love":"한 줄"},{"month":2,"fortune":"","wealth":"","health":"","love":""},{"month":3,"fortune":"","wealth":"","health":"","love":""},{"month":4,"fortune":"","wealth":"","health":"","love":""},{"month":5,"fortune":"","wealth":"","health":"","love":""},{"month":6,"fortune":"","wealth":"","health":"","love":""},{"month":7,"fortune":"","wealth":"","health":"","love":""},{"month":8,"fortune":"","wealth":"","health":"","love":""},{"month":9,"fortune":"","wealth":"","health":"","love":""},{"month":10,"fortune":"","wealth":"","health":"","love":""},{"month":11,"fortune":"","wealth":"","health":"","love":""},{"month":12,"fortune":"","wealth":"","health":"","love":""}],"remedies":[{"area":"영역","problem":"문제 한 줄","solution":"개운법 한 줄"}]}
daewoon 8단계 모두, monthlyFortune 12개월 모두, habChung 2~4개, sinsal 4~6개, remedies 2~3개.` + JSON_FORCE;

      const c = context || {};
      userPrompt = `사주 프리미엄 2단계 (대운·합충·신살·세운·개운법)
4기둥: ${c.yearPillar||''} ${c.monthPillar||''} ${c.dayPillar||''} ${c.hourPillar||'-'}
일간: ${c.ilgan||''} (${c.ilganYinyang||''}${c.ilganElement||''})
성별: ${c.gender==='male'?'남성':'여성'} (대운 순역 결정에 사용)
연주 천간 음양: ${c.yearStemYinyang||''} (양남음녀 순행, 음남양녀 역행)
월주: ${c.monthPillar||''}
올해: ${c.currentYear||new Date().getFullYear()}년 ${c.currentGanji||''}
8단계 대운, 지지 합충형해, 핵심 신살, 12개월 세운, 개운법을 풀이해주세요.`;

    } else if (type === 'tojeong') {
      systemPrompt = `당신은 토정비결(土亭秘訣) 전문가입니다. 조선 중기 대학자 토정 이지함(李之菡) 선생의 토정비결에 기반하여 한 해의 운세를 해석합니다.

규칙:
- 한국어, 해요체
- 전달받은 괘(卦) 조합에 맞는 전통적 해석을 기반으로 하되, 현대적으로 풀어서 설명
- 각 월별 운세는 구체적이고 실용적인 조언 포함
- 전체적으로 따뜻하고 희망적이면서도 현실적인 톤
- 띠와 괘 조합의 상호작용도 고려

반드시 아래 JSON 구조로만 응답:
{"yearReading":"올해 총운 요약 250자+","trigram":{"name":"괘 조합 이름","hanja":"한자 표기","meaning":"괘 해석 150자+"},"scores":{"overall":number(0-100),"wealth":number(0-100),"health":number(0-100),"love":number(0-100),"career":number(0-100)},"monthlyBrief":["1월 요약 40자+","2월 요약 40자+","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"],"monthlyScores":[number,number,number,number,number,number,number,number,number,number,number,number],"luckyInfo":{"color":"행운의 색","number":"행운의 숫자","direction":"행운의 방위"},"caution":"주의사항 100자+","advice":"종합 조언 150자+"}
monthlyScores는 1~12월 각 달의 종합 점수(0-100)로, 12개 정수 배열. monthlyBrief 분위기와 일관성 유지.` + JSON_FORCE;

      const c = context || {};
      userPrompt = `${c.targetYear||new Date().getFullYear()}년 토정비결 해석 요청
이름: ${c.name||'사용자'}, 성별: ${c.gender==='male'?'남성':'여성'}
음력 생년월일: ${c.lunarYear||''}년 ${c.lunarMonth||''}월 ${c.lunarDay||''}일
띠: ${c.zodiac||''}, 천간지지: ${c.ganjiYear||''}
상괘(태세괘): ${c.upperGua||''} (태세수 ${c.taeseNum||''})
중괘(월건괘): ${c.middleGua||''} (월건수 ${c.wolNum||''})
하괘(일진괘): ${c.lowerGua||''} (일진수 ${c.ilNum||''})
괘 조합: ${c.guaCombination||''}
이 괘 조합에 맞는 ${c.targetYear||new Date().getFullYear()}년 운세를 토정비결에 기반하여 해석해주세요.`;

    } else if (type === 'tojeong_premium_1') {
      // 1단계: 심층 총운 + 괘 분석 + 4영역 심층 + 인용
      systemPrompt = `당신은 토정비결(土亭秘訣) 대가입니다. 토정 이지함의 원문에 기반한 깊이 있는 해석을 제공합니다.
한국어 해요체. 고전 한문 원문+번역 인용.

반드시 아래 정확한 JSON 구조로만 응답:
{"detailedYear":"올해 심층 총운 400자+","guaAnalysis":{"upper":{"name":"상괘명","element":"오행","meaning":"해석 100자+"},"middle":{"name":"중괘명","element":"오행","meaning":"해석 100자+"},"lower":{"name":"하괘명","element":"오행","meaning":"해석 100자+"},"combination":"괘 조합 심층 해석 200자+","citation":{"book":"출전","original":"한문 원문","translation":"번역"}},"wealthAnalysis":"재물운 심층 분석 200자+","careerAnalysis":"직업운 심층 분석 200자+","healthAnalysis":"건강운 심층 분석 200자+","loveAnalysis":"연애·인간관계 심층 분석 200자+","citation":{"book":"출전","original":"한문 원문","translation":"번역"}}` + JSON_FORCE;

      const c = context || {};
      userPrompt = `${c.targetYear||new Date().getFullYear()}년 토정비결 프리미엄 1단계 (총운+괘+영역별)
이름: ${c.name||'사용자'}, 성별: ${c.gender==='male'?'남성':'여성'}
음력 생년월일: ${c.lunarYear||''}년 ${c.lunarMonth||''}월 ${c.lunarDay||''}일
띠: ${c.zodiac||''}, 천간지지: ${c.ganjiYear||''}
상괘: ${c.upperGua||''} (태세수 ${c.taeseNum||''})
중괘: ${c.middleGua||''} (월건수 ${c.wolNum||''})
하괘: ${c.lowerGua||''} (일진수 ${c.ilNum||''})
괘 조합: ${c.guaCombination||''}
이 괘 조합을 기준으로 한 해 총운, 괘 심층 풀이, 재물·직업·건강·연애 4영역 심층 분석을 해주세요.`;

    } else if (type === 'tojeong_premium_2') {
      // 2단계: 12개월 상세 + 개운법 + 행운 정보
      systemPrompt = `당신은 토정비결(土亭秘訣) 대가입니다. 토정 이지함의 원문에 기반합니다.
한국어 해요체. 1단계 해석과 일관성 있게.
간결하게: monthlyDetail의 fortune은 50자 내외, wealth/health/love/advice는 각 25자 이내 한 줄. 풀이를 늘리지 말고 핵심만.

반드시 아래 정확한 JSON 구조로만 응답:
{"monthlyDetail":[{"month":1,"fortune":"이번 달 흐름 50자 내외","wealth":"재물 한 줄","health":"건강 한 줄","love":"연애 한 줄","advice":"조언 한 줄","luckyDay":"길일 예: 5일·12일"},{"month":2,"fortune":"","wealth":"","health":"","love":"","advice":"","luckyDay":""},{"month":3,"fortune":"","wealth":"","health":"","love":"","advice":"","luckyDay":""},{"month":4,"fortune":"","wealth":"","health":"","love":"","advice":"","luckyDay":""},{"month":5,"fortune":"","wealth":"","health":"","love":"","advice":"","luckyDay":""},{"month":6,"fortune":"","wealth":"","health":"","love":"","advice":"","luckyDay":""},{"month":7,"fortune":"","wealth":"","health":"","love":"","advice":"","luckyDay":""},{"month":8,"fortune":"","wealth":"","health":"","love":"","advice":"","luckyDay":""},{"month":9,"fortune":"","wealth":"","health":"","love":"","advice":"","luckyDay":""},{"month":10,"fortune":"","wealth":"","health":"","love":"","advice":"","luckyDay":""},{"month":11,"fortune":"","wealth":"","health":"","love":"","advice":"","luckyDay":""},{"month":12,"fortune":"","wealth":"","health":"","love":"","advice":"","luckyDay":""}],"remedies":[{"area":"영역","problem":"문제 한 줄","solution":"개운법 한 줄"}],"luckyInfo":{"colors":["색1","색2"],"numbers":[0,0,0],"directions":["방위1","방위2"],"bestMonths":"가장 좋은 달 예: 3월·9월","cautionMonths":"주의할 달 예: 7월"}}
monthlyDetail 배열에 반드시 12개월 모두 포함. remedies는 2~3개. 불필요한 수식어 없이 짧게.` + JSON_FORCE;

      const c = context || {};
      userPrompt = `${c.targetYear||new Date().getFullYear()}년 토정비결 프리미엄 2단계 (12개월+개운법+행운)
이름: ${c.name||'사용자'}, 성별: ${c.gender==='male'?'남성':'여성'}
음력 생년월일: ${c.lunarYear||''}년 ${c.lunarMonth||''}월 ${c.lunarDay||''}일
띠: ${c.zodiac||''}, 천간지지: ${c.ganjiYear||''}
괘 조합: ${c.guaCombination||''}
1년 12개월 각 달의 흐름과 길일·주의일, 영역별 한 줄 풀이, 그리고 개운법 2~3개와 행운 정보를 알려주세요.`;

    } else {
      return res.status(400).json({ error: 'Invalid type' });
    }

    // 타입별 max_tokens 조정
    let maxTokens = 1500;
    if (type === 'tojeong') maxTokens = 2200;
    else if (type === 'tojeong_premium_1') maxTokens = 2500;
    else if (type === 'tojeong_premium_2') maxTokens = 4000;
    else if (type === 'saju') maxTokens = 2500;
    else if (type === 'saju_premium_1') maxTokens = 4500;
    else if (type === 'saju_premium_2') maxTokens = 4000;
    else if (type === 'compat') maxTokens = 2500;
    else if (type === 'compat_premium_1') maxTokens = 4500;
    else if (type === 'compat_premium_2') maxTokens = 4000;
    else if (type === 'dream') maxTokens = 2500;
    else if (type === 'dream_premium_1') maxTokens = 3500;
    else if (type === 'dream_premium_2') maxTokens = 4000;

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
