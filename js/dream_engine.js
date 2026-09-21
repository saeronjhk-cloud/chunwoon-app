/* ============================================================================
   천운 v788 · 꿈 모티브 엔진 — js/dream_engine.js   (P-786-B)
   ---------------------------------------------------------------------------
   왜 있는가
     index.html 의 `DREAM_KEYS`(12항목)는 v7.5x 부터 선언만 되고 **참조 0건**이었다
     (v786 §3 「엔진을 만들어 놓고 부르지 않은 전례」). 이 파일이 그 12항목을
     **결정론 엔진**으로 가동한다 — 줄거리 문자열에서 모티브를 찾아 사전 풀이·길흉·
     행운 숫자를 산출한다. LLM 이 없어도 답이 나오고, LLM 이 있으면 그 위에 얹힌다.

   원칙 (플레이북 ⑤) — 엔진이 답할 수 있는 것은 엔진이 답하고, 못 하는 것만 AI 로 넘긴다.
     · 줄거리에 12모티브 중 하나라도 있으면 → 엔진 히트(항상 화면에 실림 · LLM 실패 시 주 풀이)
     · 히트 0 → 엔진은 침묵(빈 배열). 지어내지 않는다. LLM 이 전담.

   ★매칭 규약 — 한국어엔 단어 경계가 없다. 한 글자 키(용·물·불·산)는 **조사·문맥으로만** 잡는다.
     · 「사용·동물·불안·계산·죽을 먹」같은 **부분 문자열 오탐**을 막는 것이 이 파일의 본체다.
     · 정답률은 _v788_work/p11_dream_engine_eval.js (20케이스) 로 못박는다 — 표를 고치면 그 평가를 다시 돈다.
     · 원문(DREAM_KEYS 의 msg·num)은 여기서 만들지 않는다. index.html 의 표를 **그대로 받아** 쓴다.

   노출 — 브라우저: window.CW_DREAM_ENGINE · Node: module.exports  (같은 객체)
   ============================================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  if (root) root.CW_DREAM_ENGINE = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function () {
  'use strict';

  var ENGINE_VERSION = 'dream_engine/v788';

  /** 한 글자 키 앞에 올 수 있는 것: 문장 시작·공백·구두점·여는 괄호. */
  var B = '(^|[\\s,.!?~·(\\[「"\'])';

  /**
   * 모티브별 정규식. `re` 가 본문, `mask` 는 검사 전에 **본문에서 지우는** 결합어
   * (예: 꽃 검사 전에 「불꽃」을 지운다 — 불꽃은 불이지 꽃이 아니다).
   * ★키 문자열은 index.html DREAM_KEYS 의 `k` 와 **바이트 동일**해야 한다(join 키).
   */
  var PATTERNS = [
    { k: '돼지',      re: /돼지|멧돼지|돈꿈/ },
    { k: '뱀',        re: /뱀|구렁이|이무기|살모사/ },
    { k: '용',        re: new RegExp(B + '용([이가을를과의은는에도]|\\s|$)|용꿈|청룡|황룡|흑룡|백룡|용왕|드래곤|용이 승천|용을 타'), },
    { k: '물',        re: new RegExp(B + '물([이가을를에서속의도]|\\s|$)|강물|샘물|냇물|시냇물|호수|폭포|맑은 물|물속|물살|우물|계곡'), mask: /동물|사물|건물|선물|식물|괴물|인물|보물|눈물|콧물|해물/g },
    { k: '불',        re: new RegExp(B + '불([이가을에도]|길|씨|꽃|덩이|바다|\\s|$)|화재|불타|불에 타|모닥불|장작불|산불|불이 나|불길|불꽃'), mask: /불안|불행|불편|불쾌|불쌍|불교|불상|불빛|불면/g },
    { k: '하늘/비행', re: /하늘을 날|하늘에서|하늘 위|하늘로|날아|날았|날고|비행기|비행|날개|공중에|공중을|떠다니|떠올라/ },
    { k: '시험',      re: /시험|수능|면접|자격증|모의고사|필기|시험지|답안/ },
    { k: '이(치아)',  re: /이가 빠|이빨|치아|어금니|앞니|송곳니|이가 흔들|이를 뽑|이가 부러|틀니|이빨이/ },
    { k: '죽음',      re: /죽었|죽는|죽음|죽어|죽인|죽이|죽고|죽을 것|장례|시체|시신|영정|무덤|사망|관 속|저승/ , mask: /죽을 먹|죽을 끓|죽집|팥죽|호박죽|전복죽/g },
    { k: '꽃',        re: /꽃|장미|벚꽃|국화|매화|연꽃|튤립|해바라기|목련|진달래/, mask: /불꽃/g },
    { k: '산',        re: new RegExp(B + '산([이을에서도]|을 오|에 오|을 타|꼭대기|정상|길|속|등성이|\\s|$)|등산|산꼭대기|산 정상|봉우리|산길|산속|산에서'), mask: /계산|부산|생산|산책|산업|산소|산책로|유산|재산|해산|산더미/g },
    { k: '바다',      re: /바다|파도|해변|바닷|해안|바닷물|해수욕/ }
  ];

  /**
   * 줄거리에서 모티브를 찾는다.
   * @param {string} story  사용자가 쓴 꿈 줄거리 (빈 문자열 허용)
   * @param {Array} keys    index.html 의 DREAM_KEYS ([{k,e,good,msg,num}])
   * @returns {Array} 히트한 keys 항목(원본 객체 그대로) — 순서는 PATTERNS 순 · 중복 없음
   */
  function matchDreamKeys(story, keys) {
    var text = String(story || '');
    if (!text.trim() || !Array.isArray(keys) || !keys.length) return [];
    var byK = {};
    for (var i = 0; i < keys.length; i++) if (keys[i] && keys[i].k) byK[keys[i].k] = keys[i];
    var hits = [];
    for (var j = 0; j < PATTERNS.length; j++) {
      var p = PATTERNS[j];
      if (!byK[p.k]) continue;                       // 표에 없는 키는 절대 만들지 않는다
      var t = p.mask ? text.replace(p.mask, ' ') : text;
      if (p.re.test(t)) hits.push(byK[p.k]);
    }
    return hits;
  }

  /**
   * 히트 집합으로 엔진 판정 요약을 만든다 — 길흉·행운 숫자.
   *   good: true 만 있으면 '길몽', false 만 있으면 '흉몽', 섞이거나 null 이면 '평몽'
   *   numbers: 히트별 num 을 합쳐 앞에서 4개(중복 제거). 히트 0 이면 []
   * @returns {{hits:Array, fortuneType:string|null, numbers:number[], engine:string}}
   */
  function summarize(hits) {
    var h = Array.isArray(hits) ? hits : [];
    var goods = 0, bads = 0, seen = {}, nums = [];
    for (var i = 0; i < h.length; i++) {
      if (h[i].good === true) goods++; else if (h[i].good === false) bads++;
      var ns = Array.isArray(h[i].num) ? h[i].num : [];
      for (var j = 0; j < ns.length && nums.length < 4; j++) { if (!seen[ns[j]]) { seen[ns[j]] = 1; nums.push(ns[j]); } }
    }
    var ft = null;
    if (h.length) ft = (goods && !bads) ? '길몽' : (bads && !goods) ? '흉몽' : '평몽';
    return { hits: h, fortuneType: ft, numbers: nums, engine: ENGINE_VERSION };
  }

  return { ENGINE_VERSION: ENGINE_VERSION, PATTERNS: PATTERNS, matchDreamKeys: matchDreamKeys, summarize: summarize };
});
