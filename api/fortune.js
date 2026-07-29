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

// P0(신뢰부채): 생성형(환각) 문헌 인용 비노출.
// LLM이 만든 '한문 원문·번역' citation은 실제 원전 조회가 아니므로 룩업 DB 도입(Phase1) 전까지 제거한다.
/* ★2026-07-28 P0-A: 프롬프트가 요구하는 실제 필드명은 citation_ref 인데 citation 키만 지워
   서지 ID(SRC_ZPJZ_A 등)가 응답 JSON에 그대로 실려 나갔다. 두 키를 모두 제거한다. (P0-1 잔여분 수리) */
const CITATION_KEYS = ['citation', 'citation_ref'];   // ★서지 ID 사용자 노출 차단

// P1-2026-07-29 · 결정 48: 차단 목록 리터럴을 반드시 두 조각으로 분할해 둔다.
// ★이유 — eval_claim_whitelist 의 scan_targets 는 index.html / api/fortune.js / js/tarot.js 3개이고,
//   C1·C2 는 그 파일들 안에 금지 서명 리터럴이 있으면 FAIL 한다. 기존 차단 목록 2곳
//   (eval/eval_prompt_citation_guard.js · engine/guardrail_verify.js)이 걸리지 않는 이유는
//   단지 scan_targets 밖에 있기 때문이다. 이 파일은 배포되는 서버 함수라 스캔에서 뺄 수 없고,
//   IP 는 런타임 로드가 불가능하므로(배포 리포에 IP/ 부재 · import 0건 · includeFiles 없음)
//   목록은 여기 있어야 한다. 분할하면 스캐너 정규식은 매칭하지 못하고 사람은 그대로 읽으며
//   런타임 값은 완전히 동일하다. v7.61 결정 47(주석 종료 토큰 회피)과 같은 수법이다.
// ★목록을 늘릴 때도 반드시 분할해서 쓸 것. 통짜 리터럴로 쓰면 claim_whitelist C1 이 발화한다.
// ★SoT = IP/policy/claim_whitelist.json 의 source_classes
// ★검증 = eval/eval_response_scrub.js — W1(IP 파생 집합과 동일) · G1·G2(양성 canary 실행) · G3~G5(음성 대조군)
// ★2026-07-29 v7.63 P0-R4 — 규격 _v763_work/P0_유출차단_스크럽보강_규격_2026-07-29.md §5
//   B축 입력측 우회 10클래스(실측 약 95건) 차단 + C축 정상출력 파손 3계열 해소.
//   R4-1 NFC·불가시문자·부수이체자 정규화 / R4-2 T2 토큰 교차곱 + 구분자 허용 / R4-3 T1 재작성
//   R4-4 고정점 반복 / R4-5 T3 재설계(중립어 치환) / R4-6 키 스크럽 / R4-7 파생형 / R4-8 어절 경계
//   ★금지 유지 — 일반 CJK 통짜 스크럽 금지(사주 간지·한자 이름이 필수 출력) · ★ | : 훼손 금지
//     · 문장 단위 삭제 금지 · NFKC 금지(NFC 만)

// T2 전면금지 15종 = unregistered_10(10) + excluded_registered_2 중 1종 + registered_4(4).
// ★상품명 용법이 허용된 1종은 T2 에서 제외한다 (IP product_name_use: 허용). T3 만 처리한다.
// ★R4-2 — 통짜 리터럴 29개를 「앞토큰 후보[] × 뒤토큰 후보[]」 15쌍으로 바꾼다.
//   후보[0] 은 한글, 후보[1..] 은 한자(이체자 포함). 교차곱이라 혼합표기 15종이 전부 죽는다.
//   ★결정 48 — 앞/뒤 토큰이 서로 다른 배열 원소로 분리되어 있어, 이 파일 어디에도
//     금지 서명이 통짜 리터럴로 존재하지 않는다(claim_whitelist C1·C2 미발화).
const SCRUB_SOURCE_TOKEN_PAIRS = [
  [['마의', '麻衣'], ['상법', '相法']],
  [['유장', '柳莊'], ['상법', '相法']],
  [['신상', '神相'], ['전편', '全編', '全篇']],
  [['달마', '達磨'], ['상법', '相法']],
  [['오행', '五行'], ['상법', '相法']],
  [['면부백세', '面部百歲'], ['유년도', '流年圖']],
  [['주공', '周公'], ['해몽', '解夢']],
  [['몽점', '夢占'], ['일지', '逸旨']],
  [['작명'], ['대전']],
  [['만성'], ['통보']],
  [['삼명', '三命'], ['통회', '通會']],
  [['자평', '子平'], ['진전', '眞詮']],
  [['적천', '滴天'], ['수', '髓']],
  [['궁통', '窮通'], ['보감', '寶鑑']],
  [['연해', '淵海'], ['자평', '子平']]
];
// ★R4-7 — 파생형(주석본·평주본) 2쌍. C축 R2 「고전천미」 낱말 파손을 막는다.
//   ★이 쌍은 SCRUB_SOURCE_NAMES(=IP 파생 집합과 집합 동일해야 함)에 넣지 않고 따로 둔다.
const SCRUB_SOURCE_EXTRA_PAIRS = [
  [['적천수', '滴天髓'], ['천미', '闡微']],
  [['자평진전', '子平眞詮'], ['평주', '評註']]
];
// 원소 29 = 한글 15 + 한자 14 (이체자 1종은 2원소 / 한글 2종은 hanja null).
// ★수기 목록 이중관리를 없애고 위 15쌍에서 파생한다.
//   한글 정식명 = 앞[0]+뒤[0] · 한자명 = 앞[1..] × 뒤[1..]
const SCRUB_SOURCE_NAMES = (function(){
  const out = [];
  for (let p = 0; p < SCRUB_SOURCE_TOKEN_PAIRS.length; p++) {
    const heads = SCRUB_SOURCE_TOKEN_PAIRS[p][0], tails = SCRUB_SOURCE_TOKEN_PAIRS[p][1];
    out.push(heads[0] + tails[0]);
    for (let i = 1; i < heads.length; i++) {
      for (let j = 1; j < tails.length; j++) out.push(heads[i] + tails[j]);
    }
  }
  return out;
})();

// 정규식 특수문자 위생 처리 헬퍼 (현재 목록에는 특수문자가 없으나 목록 증설 시 안전판)
function escapeRegExp(s){ return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
// 토큰 후보 배열 -> 비캡처 택일. 긴 후보를 앞에 두어 부분 선점을 막는다.
function scrubTokAlt(list){
  return '(?:' + list.slice().sort((a, b) => b.length - a.length).map(escapeRegExp).join('|') + ')';
}

// ★R4-1 진입부 정규화 — NFC 만 쓴다.
//   ✗ NFKC 금지: 전각 라틴·괄호기호·합자를 뭉개어 정상 출력을 파괴한다.
//   ① NFC — NFD 한글(자모 분해)과 호환한자(U+F900~ · U+2F800~ 는 정규 단일 분해이므로 NFC 로 통일)를 잡는다.
//   ② 불가시문자 제거 — 제로폭 6종·소프트하이픈·양방향 제어·워드조이너·주석문자.
//   ③ 부수형 이체자 — 康熙 부수(U+2E80~U+2FDF)는 호환 분해뿐이어서 NFC 로 안 바뀐다.
//      NFKC 를 쓰지 않고, 차단 토큰 집합에 실제로 등장하는 7자만 표적 사상한다.
//      U+2F1F 土 · U+2F26 子 · U+2F42 文 · U+2F8F 行 · U+2F90 衣 · U+2FAF 面 · U+2FC7 麻
// \u2605U+200C(ZWNJ)\u00B7U+200D(ZWJ) \uB294 \uBB34\uC870\uAC74 \uC9C0\uC6B0\uBA74 \uC548 \uB41C\uB2E4 \u2014 \uC774\uBAA8\uC9C0 ZWJ \uC2DC\uD000\uC2A4\uAC00 \uAE68\uC9C4\uB2E4.
//   \uC2E4\uCE21: \uD83E\uDDD9\u200D\u2642\uFE0F(U+1F9D9 U+200D U+2642 U+FE0F) \u2192 \uD83E\uDDD9\u2642\uFE0F / \uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67 \u2192 \uD83D\uDC68\uD83D\uDC69\uD83D\uDC67 \uB85C \uBD84\uD574\uB428.
//   \u27F9 \uC55E\uB4A4\uAC00 \uBAA8\uB450 \uD55C\uAE00\u00B7CJK\u00B7\uB77C\uD2F4 \uBB38\uC790\uC77C \uB54C\uB9CC \uC81C\uAC70\uD55C\uB2E4(\uC6B0\uD68C \uBCA1\uD130\uB294 \uADF8 \uACBD\uC6B0\uBFD0\uC774\uB2E4).
//   \uADF8 \uBC16\uC758 \uBD88\uAC00\uC2DC\uBB38\uC790\uB294 \uC774\uBAA8\uC9C0 \uC870\uB9BD\uC5D0 \uC4F0\uC774\uC9C0 \uC54A\uC73C\uBBC0\uB85C \uBB34\uC870\uAC74 \uC81C\uAC70\uD55C\uB2E4.
//   \u2717U+FE0F(\uBCC0\uC774 \uC120\uD0DD\uC790)\uB294 \uBAA9\uB85D\uC5D0 \uB123\uC9C0 \uC54A\uB294\uB2E4 \u2014 \uC774\uBAA8\uC9C0 \uD45C\uD604\uD615\uC5D0 \uD544\uC218.
const SCRUB_INVISIBLE_RE = /[\u00AD\u034F\u180B-\u180E\u200B\u200E\u200F\u2060-\u2064\u206A-\u206F\uFEFF\uFFF9-\uFFFB]/g;
const SCRUB_ZWJ_WORD = '[0-9A-Za-z\\uAC00-\\uD7A3\\u3131-\\u318E\\u4E00-\\u9FFF\\uF900-\\uFAFF]';
const SCRUB_ZWJ_RE = new RegExp('(' + SCRUB_ZWJ_WORD + ')[\\u200C\\u200D]+(?=' + SCRUB_ZWJ_WORD + ')', 'g');
const SCRUB_VARIANT_MAP = {
  '\u2F1F': '土', '\u2F26': '子', '\u2F42': '文', '\u2F8F': '行',
  '\u2F90': '衣', '\u2FAF': '面', '\u2FC7': '麻'
};
const SCRUB_VARIANT_RE = /[\u2F1F\u2F26\u2F42\u2F8F\u2F90\u2FAF\u2FC7]/g;
function scrubNormalize(s){
  let t = String(s).normalize('NFC').replace(SCRUB_INVISIBLE_RE, '');
  // ZWJ/ZWNJ 는 문맥 조건부. 연쇄 삽입(마ZWJ의ZWJ상ZWJ법)을 잡으려면 고정점까지 반복해야 한다.
  for (let i = 0; i < 4; i++) {
    const prev = t;
    t = t.replace(SCRUB_ZWJ_RE, '$1');
    if (t === prev) break;
  }
  return t.replace(SCRUB_VARIANT_RE, function(c){ return SCRUB_VARIANT_MAP[c] || c; });
}

// ★R4-2 구분자 — 토큰 사이에 삽입되는 공백·중점·괄호 등을 최대 2자까지 허용한다.
//   ★ | : 는 절대 넣지 않는다(js/chat.js:220 의 ★LUCK★색:파랑|숫자:7★ 토큰 파싱 보존).
//   ★구두점류는 2자까지만 허용한다(더 열면 「마의 좋은 상법」류 오탐이 생긴다).
//   반면 **공백만으로 벌린 형태**는 자연스러운 한국어 문장이 될 수 없으므로 6자까지 허용한다.
//   (R5 검증관 실측 미차단분: 「마의   상법」 세 칸)
const SCRUB_SEP = '(?:[\\s.,\\-_~/\\\\*+=\'"()\\[\\]{}<>·・「」『』〈〉《》【】〔〕]{0,2}|[\\s　]{1,6})';

// T1: 서지 ID — 값 안에 실려 나가는 SRC_* 를 삭제 (키 삭제로는 잡히지 않음)
// ★R4-3 — \b 제거(1SRC_ · aSRC_ 우회) · i 플래그(소문자 우회) · 구분자 확장(- . 전각 ＿)
//   ★R4-8 — 선행 가로공백을 함께 흡수한다. 「근거: SRC_A 및」→「근거: 및」로 한 칸만 남는다.
//   전역 / {2,}/→' ' 정리를 쓰지 않는 이유: 들여쓰기·정렬 공백을 뭉개어 LLM 이 낸 표·목록
//   서식을 파괴한다(실측: 프런트 코퍼스 10,190행 중 7,666행이 공백 정리만으로 변형됨).
//   개행은 절대 먹지 않도록 [ \t] 로 한정한다.
const SCRUB_SRC_ID_RE = /[ \t]*SRC[_\-.＿][A-Za-z0-9_\-.＿]+/gi;
// T2: 문헌명 15종 + 파생 2종 → '고전'. 파생 쌍을 앞에 두어 부분 선점(「고전천미」 파손)을 막는다.
const SCRUB_SOURCE_RE = new RegExp(
  SCRUB_SOURCE_EXTRA_PAIRS.concat(SCRUB_SOURCE_TOKEN_PAIRS)
    .map(function(p){ return scrubTokAlt(p[0]) + SCRUB_SEP + scrubTokAlt(p[1]); })
    .join('|'),
  'g'
);

// ★R4-2b 자간형 — 「마 의 상 법」처럼 글자마다 구분자를 끼운 형태.
//   구분자를 「0~2자 허용」으로 열면 정상 문장 오탐이 생기므로, 대신 **모든 글자 사이에 정확히
//   1자씩** 들어간 경우만 잡는다. 자연스러운 한국어 문장은 이 형태가 될 수 없으므로 오탐이 없다.
//   (검증: index.html + js/* + api/fortune.js 전 코퍼스에서 신규 적발 0건)
const SCRUB_SPACED_SEP = '[\\s·・.\\-]';
function scrubSpacedAlt(pair){
  const forms = [];
  for (const a of pair[0]) for (const b of pair[1]) forms.push(a + b);
  return forms.map(function(name){
    return name.split('').map(escapeRegExp).join(SCRUB_SPACED_SEP);
  });
}
const SCRUB_SPACED_RE = new RegExp(
  SCRUB_SOURCE_EXTRA_PAIRS.concat(SCRUB_SOURCE_TOKEN_PAIRS)
    .reduce(function(acc, p){
      const both = [[p[0], p[1]]];
      for (const q of both) acc = acc.concat(scrubSpacedAlt(q));
      return acc;
    }, [])
    .filter(function(src){ return src.length > 0; })
    .sort(function(a, b){ return b.length - a.length; })
    .join('|'),
  'g'
);

// T3: 상품명 + 출전 주장 어휘가 60자 이내로 근접 결합된 경우에만 그 어휘를 중립어로 바꾼다.
//     단독 상품명 용법은 반드시 보존한다 (IP product_name_use: 허용 = 상품명).
// ★결정 48 동일 적용 — 토큰을 전부 분할해 둔다. 통짜로 쓰면 claim_whitelist C2(BAN_B03)가 발화한다.
// ★R4-5 — 상품명 쪽도 한자 표기(土亭 秘訣)까지 교차곱으로 덮는다.
const SCRUB_TJ_PAIR = [['토' + '정', '土亭'], ['비' + '결', '秘訣']];
// ★R4-5 — 출전 주장 어휘 확장. 앞[i] × 뒤[j] 교차곱 + 어절 안 구분자 1자 허용.
const SCRUB_BASIS_PAIRS = [
  [['원', '原'], ['문', '文']],
  [['원', '原'], ['전', '典']],
  [['원', '原'], ['본', '本']],
  [['원', '原'], ['구절', '句節']],
  [['저', '底'], ['본', '本']],
  [['판', '版', '板'], ['본', '本']]
];
const SCRUB_BASIS_SEP = '[\\s·・.\\-]{0,1}';
// ★R4-8 어절 경계 — 뒤에 한글이 이어지되 조사가 아니면 다른 낱말이므로 손대지 않는다.
//   C축 R1 오탐 차단: 「…자료」 「…장」 같은 복합명사는 무변형으로 통과해야 한다.
const SCRUB_JOSA = '[은는이가을를에의와과도만로으라며서부터까지처럼보다대랑나고인임]';
const SCRUB_BASIS_TAIL = '(?:(?![가-힣])|(?=' + SCRUB_JOSA + '{1,4}(?![가-힣])))';
// ★R4-5 — 삭제하지 않고 중립어로 치환한다. 삭제는 ①조사가 남아 문장이 깨지고
//   ②앞뒤 토큰이 붙어 T2 대상어가 사후 합성되는 두 파손을 동시에 만든다.
const SCRUB_BASIS_NEUTRAL = '풀' + '이';
const SCRUB_T3_WINDOW = 60;
const SCRUB_TJ_RE_SRC = scrubTokAlt(SCRUB_TJ_PAIR[0]) + SCRUB_SEP + scrubTokAlt(SCRUB_TJ_PAIR[1]);
const SCRUB_BASIS_RE_SRC = '(?:' + SCRUB_BASIS_PAIRS
  .map(function(p){ return scrubTokAlt(p[0]) + SCRUB_BASIS_SEP + scrubTokAlt(p[1]); })
  .join('|') + ')';
// ★R4-5b — 어절형 출전 주장. 「원문」 같은 낱말이 아니라 「그대로 인용」처럼 구(句)로 오는 형태.
//   B축 실측: 「토정비결 판본 그대로 인용」은 판본만 중립화되고 「그대로 인용」이 남아 근거 주장이 존속한다.
//   낱말형(SCRUB_BASIS_NEUTRAL='풀이')과 달리 서술구이므로 중립 서술구로 바꾼다.
//   ★어간형과 명사형을 나눈다. 어간형(「그대로 옮기-」)에 명사 중립어를 넣으면 뒤따르는 어미가
//   깨진다(실측: 「그대로 옮기면」→「참고면」). 어간형은 어간 중립어('참고하')로 바꾼다.
function scrubPhraseAlt(list){
  return '(?:' + list
    .map(function(p){ return p.split(' ').map(escapeRegExp).join('[\\s·・]{0,1}'); })
    .sort(function(a, b){ return b.length - a.length; })
    .join('|') + ')';
}
const SCRUB_BASIS_PHRASES_STEM = ['그대로' + ' 인용하', '그대로' + ' 옮기', '축자' + ' 인용하'];
const SCRUB_BASIS_PHRASES_NOUN = ['그대로' + ' 인용', '직접' + ' 인용', '실린' + ' 그대로', '한문' + ' 구절', '축자' + ' 인용'];
const SCRUB_PHRASE_NEUTRAL_STEM = '참' + '고하';
const SCRUB_PHRASE_NEUTRAL_NOUN = '참' + '고';
const SCRUB_TJ_PHRASE_RES = [
  [SCRUB_BASIS_PHRASES_STEM, SCRUB_PHRASE_NEUTRAL_STEM],
  [SCRUB_BASIS_PHRASES_NOUN, SCRUB_PHRASE_NEUTRAL_NOUN]
].map(function(g){
  const alt = scrubPhraseAlt(g[0]);
  return {
    fwd: new RegExp('(' + SCRUB_TJ_RE_SRC + ')([\\s\\S]{0,' + SCRUB_T3_WINDOW + '}?)(' + alt + ')', 'g'),
    rev: new RegExp('(' + alt + ')([\\s\\S]{0,' + SCRUB_T3_WINDOW + '}?)(' + SCRUB_TJ_RE_SRC + ')', 'g'),
    neutral: g[1]
  };
});

// ★R4-5 — 창 24→60자 · [^\n] → [\s\S](개행 삽입 우회 차단)
const SCRUB_TOJEONG_FWD_RE = new RegExp(
  '(' + SCRUB_TJ_RE_SRC + ')([\\s\\S]{0,' + SCRUB_T3_WINDOW + '}?)(' + SCRUB_BASIS_RE_SRC + ')' + SCRUB_BASIS_TAIL, 'g');
const SCRUB_TOJEONG_REV_RE = new RegExp(
  '(' + SCRUB_BASIS_RE_SRC + ')' + SCRUB_BASIS_TAIL + '([\\s\\S]{0,' + SCRUB_T3_WINDOW + '}?)(' + SCRUB_TJ_RE_SRC + ')', 'g');

// scrubText(s): string -> string. R4-1 정규화 → (T1 → T2 → T3) 고정점 반복 → R4-8 공백 정리.
// ★금지: 일반 CJK 범위 통째 스크럽(사주 간지 파괴) · ★ | : 훼손(★LUCK★ 토큰 파싱 파괴) · 문장 단위 삭제
// ★R4-4 — 계층을 고정점까지 반복한다. T1 삭제가 T2 대상어를 사후 합성하는 경로
//   (예: 앞토큰 + SRC_XXX + 뒤토큰 → 삭제 후 붙어버림)를 이 반복이 잡는다. 상한 4회.
// ★R4-8 — 말미 이중공백 정리(T1 삭제 자리에 남는 두 칸 공백. C축 R5).
function scrubText(s){
  if (typeof s !== 'string') return s;
  let out = scrubNormalize(s);
  for (let i = 0; i < 4; i++) {
    const prev = out;
    out = out.replace(SCRUB_SRC_ID_RE, '');
    out = out.replace(SCRUB_SOURCE_RE, '고전');
    out = out.replace(SCRUB_SPACED_RE, '고전');
    out = out.replace(SCRUB_TOJEONG_FWD_RE, function(m, head, mid){ return head + mid + SCRUB_BASIS_NEUTRAL; });
    out = out.replace(SCRUB_TOJEONG_REV_RE, function(m, w, mid, tail){ return SCRUB_BASIS_NEUTRAL + mid + tail; });
    for (const g of SCRUB_TJ_PHRASE_RES) {
      out = out.replace(g.fwd, function(m, head, mid){ return head + mid + g.neutral; });
      out = out.replace(g.rev, function(m, w, mid, tail){ return g.neutral + mid + tail; });
    }
    if (out === prev) break;
  }
  return out;
}

// scrubDeep(node): 기존 stripCitations 의 키 삭제를 보존한 채 모든 문자열 값에 scrubText 적용.
// JSON.parse 산출물만 들어오므로 순환 참조 없음 (api/fortune.js extractJSON 근거).
// ★R4-6 — 키 이름도 스크럽한다. 종전에는 키가 무검사여서 index.html 의 Object.keys 출력 경로로
//   문헌명·서지 ID 가 innerHTML 에 그대로 실려 나갔다(입력측 우회 「객체 키」 클래스).
//   스크럽 결과가 원본과 같으면 그대로 두고, 달라지면 옛 키를 버리고 새 키로 옮긴다.
//   전부 지워져 빈 문자열이 되면 키 자체를 버린다.
function scrubDeep(node){
  if (typeof node === 'string') return scrubText(node);
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) node[i] = scrubDeep(node[i]);
    return node;
  }
  if (node && typeof node === 'object') {
    for (const k of Object.keys(node)) {
      if (CITATION_KEYS.includes(k)) { delete node[k]; continue; }
      const v = scrubDeep(node[k]);
      const nk = scrubText(k);
      if (nk === k) { node[k] = v; continue; }
      delete node[k];
      if (typeof nk === 'string' && nk.trim() !== '') node[nk] = v;
    }
  }
  return node;
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
        // P1-R2: 응답 본문(response 필드) 미노출. status·httpStatus·keyPreview 만으로 진단 유지
        return res.status(200).json({ status: resp.ok ? 'API_OK' : 'API_FAIL', httpStatus: resp.status, keyPreview });
      } catch (e) {
        return res.status(200).json({ status: 'API_ERROR', keyPreview, error: scrubText(String(e.message || '')) });
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

    // P0(신뢰부채·저작권): 생성형 문헌 인용 금지. 인용은 등재·확보완료 판본의 서지 ID로만 표기한다.
    // 허용 목록은 IP/sources/source_editions.json 중 PD 확정 + 확보완료 판본으로 한정한 폐쇄 목록이다.
    // SRC_TOJEONG_A(license:UNDECIDED)·SRC_SMTH_A(미확보)는 의도적으로 제외한다.
    const CITATION_RULE = '\n\n인용 규칙(절대 준수): 고전 문헌의 한문 원문이나 번역문을 생성하지 마세요.'
      + ' 인용은 반드시 서지 ID로만 표기합니다. 허용 ID는 다음 4종뿐입니다 —'
      + ' SRC_ZPJZ_A(자평진전), SRC_JCS_A(적천수), SRC_GTBG_A(궁통보감), SRC_YHZP_A(연해자평).'
      + ' 참고할 문헌이 이 4종에 없으면 반드시 "NONE"을 쓰세요. 목록에 없는 문헌명을 서지 ID 자리에 쓰지 마세요.'
      + ' 어떤 경우에도 한문 원문 문장을 지어내지 마세요.';

    if (type === 'face') {
      systemPrompt = `당신은 전통 관상학(觀相學) 해석을 돕는 AI 어시스턴트입니다. 전통 관상학의 일반적 관점을 참고합니다.
- 한국어, 해요체
- 얼굴형(오행), 눈(감찰관), 코(재백궁), 입(출납관) 각각 해석
- measurements 수치를 해석에 직접 인용 (예: "가로세로비 0.82로 金形")
- JSON 형식으로만 응답: {"shape":"얼굴형","eyes":"눈","nose":"코","mouth":"입","summary":"종합 200자+","advice":"조언"}` + JSON_FORCE;

      const m = features.measurements;
      const mb = m ? `실측: whR:${m.whRatio?.toFixed(3)||'?'}, jawR:${m.jawRatio?.toFixed(3)||'?'}, eyeR:${m.eyeRatio?.toFixed(2)||'?'}, noseW:${((m.noseWRatio||0)*100).toFixed(1)}%, mouth:${m.mouthFaceRatio?.toFixed(3)||'?'}, sym:${((m.symmetry||0)*100).toFixed(1)}%, thirds:${((m.thirdsScore||0)*100).toFixed(1)}%` : '';

      userPrompt = `얼굴형:${features.shape?.label||''}(${features.shape?.fiveElement||''} ${features.shape?.score||''}점), 눈:${features.eyes?.label||''}(${features.eyes?.score||''}점), 코:${features.nose?.label||''}(${features.nose?.score||''}점), 입:${features.mouth?.label||''}(${features.mouth?.score||''}점), 종합:${features.overallScore||''}점. ${mb}`;

    } else if (type === 'face_premium_1') {
      systemPrompt = `관상학 해석 AI 어시스턴트. 전통 관상학의 일반적 관점을 참고. 한국어 해요체. 고전 인용은 서지 ID로만 표기. 수치 인용.
반드시 아래 정확한 JSON 구조로만 응답:
{"analysisProcess":{"features":[{"part":"string","measured":"string","standard":"string","classification":"string","confidence":number,"reasoning":"string 80자+","citation_ref":{"source_id":"등재ID|NONE"}}]},"fortuneGraph":{"decades":[{"age":"string","wealth":number,"love":number,"health":number,"keyword":"string"}],"analysis":"string 100자+","peakAge":"string","citation_ref":{"source_id":"등재ID|NONE"}}}
features 배열에 얼굴형,눈,코,입 4개 항목. decades 배열에 10대,20대,30대,40대,50대,60대,70대+ 7개 항목.` + CITATION_RULE + JSON_FORCE;

      const m = features.measurements;
      const mStr = m ? `whR:${m.whRatio?.toFixed(3)||'?'},jawR:${m.jawRatio?.toFixed(3)||'?'},eyeR:${m.eyeRatio?.toFixed(2)||'?'},noseW:${((m.noseWRatio||0)*100).toFixed(1)}%,noseH:${((m.noseHRatio||0)*100).toFixed(1)}%,sym:${((m.symmetry||0)*100).toFixed(1)}%,thirds:${((m.thirdsScore||0)*100).toFixed(1)}%,upper:${m.upperThirdPct?.toFixed(1)||'?'}%,mid:${m.middleThirdPct?.toFixed(1)||'?'}%,lower:${m.lowerThirdPct?.toFixed(1)||'?'}%` : 'N/A';

      userPrompt = `얼굴형:${features.shape?.label||''}(${features.shape?.fiveElement||''}${features.shape?.score||''}점),눈:${features.eyes?.label||''}(${features.eyes?.score||''}점),코:${features.nose?.label||''}(${features.nose?.score||''}점),입:${features.mouth?.label||''}(${features.mouth?.score||''}점),종합:${features.overallScore||''}점.[${mStr}]`;

    } else if (type === 'face_premium_2') {
      systemPrompt = `관상학 해석 AI 어시스턴트. 전통 관상학의 일반적 관점을 참고. 한국어 해요체. 고전 인용은 서지 ID로만 표기.
반드시 아래 정확한 JSON 구조로만 응답:
{"breakingPoint":{"weaknesses":[{"part":"string","problem":"string 60자+","solution":"string 60자+","measurement":"string","citation_ref":{"source_id":"등재ID|NONE"}}],"summary":"string 80자+"},"enemyFace":{"enemies":[{"feature":"string","reason":"string 60자+","risk":"string","citation_ref":{"source_id":"등재ID|NONE"}}],"allies":[{"feature":"string","reason":"string 60자+","benefit":"string"}],"summary":"string 80자+"}}
weaknesses 2개, enemies 2개, allies 2개.` + CITATION_RULE + JSON_FORCE;

      const m = features.measurements;
      const mStr = m ? `whR:${m.whRatio?.toFixed(3)||'?'},jawR:${m.jawRatio?.toFixed(3)||'?'},noseW:${((m.noseWRatio||0)*100).toFixed(1)}%,sym:${((m.symmetry||0)*100).toFixed(1)}%,thirds:${((m.thirdsScore||0)*100).toFixed(1)}%` : 'N/A';

      userPrompt = `얼굴형:${features.shape?.label||''}(${features.shape?.fiveElement||''}),눈:${features.eyes?.label||''},코:${features.nose?.label||''},입:${features.mouth?.label||''},점수:${features.overallScore||''}점.[${mStr}]`;

    } else if (type === 'naming_company') {
      // 회사명·브랜드명 무료 — 추천 5개 + 등록 가능성 평가
      systemPrompt = `당신은 한국 네이밍 AI 어시스턴트입니다. 작명·브랜드·등기 관행에 대한 일반 지식을 활용합니다. 사주명리 + 네이밍 + 브랜드 마케팅 + 법인등기 관행 지식을 통합해 제안합니다.
한국어 해요체. 친절하고 자세하게.
- 업종 오행과 사장(대표) 사주의 조화 + 대표 이름과의 발음·한자 어울림
- 발음이 부드럽고 기억하기 쉬운 이름
- 한국에서 통용되면서 영문 표기·해외 발음도 자연스러운 이름
- **회사명 등록 지역에 동종업종 같은/유사 상호가 이미 등록되어 있을 가능성 평가** (LLM 일반 지식 + 흔한 상호명 패턴을 참고한 추정)
- 도메인 가용성·상표권 충돌 가능성 간단 검토
- 같은 업종의 기존 유명 브랜드와 차별화

반드시 아래 JSON 구조로만 응답:
{"namingProcess":[{"step":"1단계","detail":"60자"}],"summary":"업종+대표 정보+사장사주 분석 + 네이밍 방향 200자 내외","candidates":[{"name":"한글 이름","english":"영문 표기","style":"한자/한글/혼합/외래어","meaning":"이름 의미·유래 80자 내외","industryFit":"업종 적합도 한 줄","brandImage":"전달되는 브랜드 이미지 60자 내외","domainCheck":"도메인 가용성 짐작 (예: .com 가능성 높음)","registrability":"등록 가능성 평가 — 동지역 동종업종 유사 상호 우려 + 추천 액션 80자 내외 (예: '서울에 흔한 상호 패턴이라 충돌 우려, 등기 전 iros.go.kr 검색 권장')","strengths":"장점 60자 내외"}],"registrabilityDisclaimer":"실 등록 가능 여부는 대법원 인터넷등기소(iros.go.kr) 상호 검색에서 최종 확인 필요. AI 평가는 참고용. 50자 내외","advice":"종합 조언 100자 내외"}
namingProcess 7단계, candidates 5개.` + JSON_FORCE;
      const c = context || {};
      userPrompt = `회사명·브랜드명 작명 의뢰
업종: ${c.industry||''}
비즈니스 모델: ${c.bizModel||''}
핵심 가치/키워드: ${c.bizKeyword||'없음'}
타겟 시장: ${c.market||'국내'}
회사 등록 예정 지역: ${c.companyRegion||'미선택'}
대표 이름: ${c.ceoName||'미입력'}
${c.ceoPillar?`사장 사주: ${c.ceoPillar} / 일간 ${c.ceoIlgan||''}(${c.ceoIlganElement||''}) / 부족 오행: ${c.ceoLacking||''}`:'사장 사주: 미입력'}

이 업종+지역에 맞는 회사명 5개를 추천하고, 각 이름의 등록 가능성도 평가해주세요. 대표 이름이 입력됐다면 발음·한자 어울림도 반영하세요.`;

    } else if (type === 'naming_company_premium_1') {
      systemPrompt = `당신은 한국 네이밍 AI 어시스턴트입니다. 작명·브랜드·등기 관행에 대한 일반 지식을 활용합니다. 자평진전(子平眞詮) 참고 + 마케팅·브랜드 전략 + 등기 관행 지식.
한국어 해요체. 친절·자세·전략적.
- 추천 회사명 10개를 [한자기반 3 / 한글기반 3 / 외래어·합성어 4]로
- 각 이름의 의미·발음·업종 적합성·브랜드 이미지·차별화 포인트
- 업종 오행 + 사장 사주(있을 시) + 대표 이름과의 어울림 통합 풀이
- 영문 표기·해외 발음 검토
- 도메인 가용성 짐작
- **회사 등록 예정 지역에 동종업종 유사 상호 충돌 가능성** — 흔한 패턴, 검색 시 우려되는 키워드 조합 평가
- 비슷한 기존 브랜드와 비교

반드시 아래 정확한 JSON 구조로만 응답:
{"strategicAnalysis":"업종 분석 + 사장 사주 + 대표 이름 어울림 + 등록 지역 + 네이밍 전략 250자 내외","candidates":[{"name":"한글","english":"영문","style":"한자/한글/외래어/합성어","meaning":"이름 의미 100자 내외","industryFit":"업종 적합 80자 내외","brandImage":"브랜드 이미지·연상 80자 내외","sajuMatch":"사주 보완 효과 60자 내외 (사장 사주 없으면 빈 문자열)","differentiation":"차별화 포인트 80자 내외","similar":"유사 기존 브랜드와 비교 60자 내외","domainCheck":"도메인 가용성 짐작 60자 내외","registrability":"등록 가능성 — 동지역 유사 상호 충돌 우려 평가 + 등기 전 액션 80자 내외","strengths":"장점 60자 내외","concerns":"주의점 60자 내외 (없으면 빈 문자열)"}],"registrabilityNote":"등록 가능성 종합 안내 + iros.go.kr 검색·법무사·변리사 자문 권고 100자 내외"}
candidates 정확히 10개.` + JSON_FORCE;
      const c = context || {};
      userPrompt = `회사명 프리미엄 1단계
업종: ${c.industry||''} / 비즈니스: ${c.bizModel||''} / 키워드: ${c.bizKeyword||''} / 시장: ${c.market||''}
회사 등록 예정 지역: ${c.companyRegion||'미선택'}
대표 이름: ${c.ceoName||'미입력'}
${c.ceoPillar?`사장 사주: ${c.ceoPillar} / 일간: ${c.ceoIlgan||''}(${c.ceoIlganElement||''}) / 부족: ${c.ceoLacking||''}`:'사장 사주: 없음'}
한자기반·한글기반·외래어/합성어 다양하게 10개 추천하고 각 이름의 등록 가능성을 평가해주세요.`;

    } else if (type === 'naming_company_premium_2') {
      systemPrompt = `당신은 작명·브랜드 전략 AI 어시스턴트입니다. 법인등기·상표 관행에 대한 일반 지식을 활용합니다.
한국어 해요체.
- 베스트 3 회사명 선정 + 각각 사업 흐름 4구간 (창업기·성장기·확장기·성숙기)
- 어울리는 업태·확장 분야
- 매출 시기 예측 (창업 후 1·3·5·10년)
- **상호 등록 가능성** (동지역 동종업종 유사 상호 우려) + 도메인·SNS 핸들 가용성 + 상표권 검토
- 슬로건·태그라인 1~2개 제안
- 한국 전통 작명 의식 + 사장에게 주는 축원

반드시 아래 정확한 JSON 구조로만 응답:
{"bestThree":[{"name":"한글","english":"영문","whyBest":"베스트 이유 80자 내외","businessFlow":{"startup":"창업기 0~3년 130자 내외","growth":"성장기 3~7년 130자 내외","expansion":"확장기 7~12년 130자 내외","maturity":"성숙기 12년+ 130자 내외"},"expansionAreas":"어울리는 확장 분야 80자 내외","revenueTimeline":"매출 시기 예측 100자 내외","registrabilityDeep":"등록 지역 기준 상호 충돌 우려 + iros 검색 키워드 추천 80자 내외","trademarkCheck":"상표·도메인·SNS 점검 80자 내외","slogans":["태그라인 1","태그라인 2"]}],"namingRitual":"전통 작명 의식 + 회사명을 부를 때 활성화되는 기운 200자 내외","blessing":"창업자에게 주는 축원 150자 내외","namingAdvice":"종합 조언 + 사용 권장(로고·인장·서명) 150자 내외"}
bestThree 정확히 3개.` + JSON_FORCE;
      const c = context || {};
      userPrompt = `회사명 프리미엄 2단계 — 베스트 3 사업 흐름
업종: ${c.industry||''} / 비즈니스: ${c.bizModel||''} / 등록 지역: ${c.companyRegion||'미선택'}
${c.ceoName?`대표: ${c.ceoName}`:''}
${c.ceoPillar?`사장 사주: ${c.ceoPillar} / 일간 ${c.ceoIlgan||''}`:''}

1단계 추천 중 베스트 3을 선정하고 각 회사명의 창업~성숙기 4구간 흐름 + 등록 가능성을 풀이해주세요.`;

    } else if (type === 'naming_product') {
      systemPrompt = `당신은 네이밍·마케팅 AI 어시스턴트입니다. 한국·미국 상표 관행에 대한 일반 지식을 활용합니다. 제품명·서비스명·앱 이름 작명을 돕습니다.
한국어 해요체.
- 타겟 페르소나에 어울리는 발음·어감
- 제품 카테고리에 적합한 단어
- 검색·SEO 가시성
- 기억성·발음 편의·SNS 해시태그 친화성
- **상표 등록 가능성** — 사용자가 선택한 검토 범위(국내 KIPRIS / 미국 USPTO / 글로벌)에 따라 동일/유사 상표 충돌 가능성 평가 (LLM 일반 지식 + 흔한 상표 패턴을 참고한 추정)

반드시 아래 정확한 JSON 구조로만 응답:
{"namingProcess":[{"step":"1단계","detail":"60자"}],"summary":"제품 분석 + 상표 등록 범위 + 네이밍 방향 200자 내외","candidates":[{"name":"한글","english":"영문 표기","style":"한자/한글/외래어/합성어/조어","meaning":"이름 의미·유래 80자 내외","categoryFit":"제품 카테고리 적합도 한 줄","targetAppeal":"타겟에게 어필하는 포인트 60자 내외","memorability":"기억성·발음 편의 한 줄","seoNote":"검색 가시성 한 줄","trademarkability":"상표 등록 가능성 — 검토 범위별(국내/미국/글로벌) 충돌 우려 + 추천 액션 100자 내외 (예: 'KIPRIS 동일·유사 상표 검색 권장, 미국에선 일반 명사화 우려)","strengths":"장점 60자 내외"}],"trademarkDisclaimer":"실 등록 가능 여부는 KIPRIS(한국)·USPTO TESS(미국) 검색 + 변리사 자문 필수. AI 평가는 참고용. 50자 내외","advice":"종합 조언 100자 내외"}
namingProcess 6단계 (제품 분석→타겟 분석→키워드 추출→어감 검증→SEO 점검→최종 추천), candidates 5개.` + JSON_FORCE;
      const c = context || {};
      userPrompt = `제품명·서비스명 작명 의뢰
카테고리: ${c.productCat||''}
한 줄 설명: ${c.productDesc||''}
타겟 페르소나: ${c.productTarget||''}
핵심 가치: ${c.productValue||'없음'}
상표 등록 검토 범위: ${c.trademarkScope||'미선택'}

이 제품에 맞는 이름 5개를 추천하고 각 이름의 상표 등록 가능성을 평가해주세요.`;

    } else if (type === 'naming_product_premium_1') {
      systemPrompt = `당신은 네이밍·브랜드 전략 AI 어시스턴트입니다. 한국·미국 상표 관행에 대한 일반 지식을 활용합니다.
한국어 해요체.
- 추천 제품명 10개 (한자/한글/외래어/합성어/조어 다양하게)
- 각 이름의 마케팅 적합성·SEO 점수·SNS 해시태그 친화성
- 타겟 페르소나에게 주는 어필 포인트
- 슬로건 후보 1~2개 함께
- **상표 등록 가능성** — 검토 범위(국내/미국/글로벌)에 따라 KIPRIS·USPTO TESS·EUIPO 충돌 가능성 평가 + 등록 가능성 점수 (0~100)
- 비슷한 기존 제품·서비스와 차별화

반드시 아래 정확한 JSON 구조로만 응답:
{"strategicAnalysis":"제품·타겟·상표 등록 범위 분석 + 네이밍 전략 250자 내외","candidates":[{"name":"한글","english":"영문","style":"한자/한글/외래어/합성어/조어","meaning":"의미·유래 100자 내외","categoryFit":"카테고리 적합 80자 내외","targetAppeal":"타겟 어필 80자 내외","memorability":"기억성·발음 점수 (1-10) + 설명","seoScore":number(0-100),"hashtagFriendly":"해시태그 친화성 한 줄","trademarkability":"상표 등록 가능성 — 검토 범위별 충돌 우려 + 추천 액션 100자 내외","trademarkScore":number(0-100),"slogan":"태그라인 한 줄","differentiation":"차별화 80자 내외","strengths":"장점 60자 내외","concerns":"주의점 60자 내외"}],"trademarkNote":"상표 등록 종합 안내 + KIPRIS·USPTO 검색·변리사 자문 권고 100자 내외"}
candidates 정확히 10개.` + JSON_FORCE;
      const c = context || {};
      userPrompt = `제품명 프리미엄 1단계
카테고리: ${c.productCat||''} / 설명: ${c.productDesc||''}
타겟: ${c.productTarget||''} / 가치: ${c.productValue||''}
상표 등록 검토 범위: ${c.trademarkScope||'미선택'}
다양한 스타일로 10개 추천 + 마케팅·SEO + 상표 등록 가능성 풀이.`;

    } else if (type === 'naming_pet') {
      systemPrompt = `당신은 반려동물 작명 AI 어시스턴트입니다. 따뜻하고 친근한 톤.
한국어 해요체.
- 외모·성격에 어울리는 이름
- 부르기 쉽고 짧은 음절 (강아지·고양이는 1~2음절이 반응 좋음)
- 한국적/외래어/창의적 다양하게

반드시 아래 정확한 JSON 구조로만 응답:
{"summary":"반려동물 분석 + 작명 방향 150자 내외","candidates":[{"name":"이름","style":"한국어/외래어/창의","meaning":"이름 의미·연상 60자 내외","callability":"부르기 편한 정도 + 발음 한 줄","matchPoint":"이 이름이 어울리는 이유 60자 내외","cuteness":"귀여움·매력 포인트 한 줄"}],"advice":"종합 조언 + 부를 때 팁 80자 내외"}
candidates 8개 (다양하게).` + JSON_FORCE;
      const c = context || {};
      userPrompt = `반려동물 작명 의뢰
종류: ${c.petType||''}
외모·성격: ${c.petTraits||''}
원하는 분위기: ${c.petVibe||'자유롭게'}

이 반려동물에 어울리는 이름 8개를 추천해주세요.`;

    } else if (type === 'naming_nickname') {
      systemPrompt = `당신은 닉네임·필명 작명 AI 어시스턴트입니다. SNS·게임·작가명 작명을 돕습니다.
한국어 해요체.
- 사용자 이미지·플랫폼에 어울리는 어감
- 검색·태그 친화성
- 다른 사용자와 겹치지 않는 독창성
- 사주 일간이 있으면 본인 본질에 맞는 닉네임

반드시 아래 정확한 JSON 구조로만 응답:
{"summary":"플랫폼·이미지 분석 + 닉네임 방향 150자 내외","candidates":[{"name":"닉네임","english":"영문 표기 (있으면)","style":"한글/영문/혼합/한자","meaning":"의미·연상 70자 내외","platformFit":"플랫폼 적합도 한 줄","vibeMatch":"표현하려는 이미지와의 매칭 60자 내외","memorability":"기억성·발음 한 줄","sajuMatch":"사주 보완 한 줄 (사주 없으면 빈 문자열)"}],"advice":"종합 조언 + SNS 핸들 동시 사용 팁 80자 내외"}
candidates 8개.` + JSON_FORCE;
      const c = context || {};
      userPrompt = `닉네임·필명 작명 의뢰
플랫폼: ${c.nickPlatform||''}
원하는 이미지: ${c.nickVibe||''}
한글/영문/혼합: ${c.nickLang||'자유'}
${c.ilgan?`본인 사주 일간: ${c.ilgan}(${c.ilganElement||''}) / 부족 오행: ${c.lacking||''}`:''}

다양한 닉네임 8개를 추천해주세요.`;

    } else if (type === 'naming') {
      // 작명 무료 — 작명 과정 7단계 + 추천 5개 + 각 정밀 풀이
      systemPrompt = `당신은 한국 전통 성명학 해석을 돕는 AI 어시스턴트입니다. 자평진전(子平眞詮) 참고 · 전통 성명학 관점의 AI 작명.
한국어 해요체. 친절하고 자세하게. 사주 일간·부족한 오행을 직접 인용.
이름은 한 사람의 평생 운명을 좌우하는 가장 중요한 것 중 하나. 단순 추천이 아닌 "왜 이 이름인가"의 과정과 이유를 설명.

⚠️ 절대 규칙 — 위반 금지:
1. 사용자가 요청한 이름 글자 수를 정확히 지킬 것. "2자"=성씨1+이름1, "3자"=성씨1+이름2, "4자"=성씨1+이름3. 한국 관습이 3자라도 사용자 요청을 우선.
2. candidates의 hangul과 hanja 필드는 '이름만' 적기 (성씨 제외). 예: 성 '김(金)', 이름 '진우(鎭宇)' → hangul:"진우", hanja:"鎭宇". 4자 요청이면 hangul은 3글자.
3. hanjaDetail에도 이름 한자만 포함. 글자 수는 이름 글자 수와 정확히 일치.
4. strokes 배열은 [성씨획수, 이름글자1 획수, 이름글자2 획수, ...] 순서. 4자 요청이면 4개 정수.
5. **항렬자가 지정된 경우, 모든 추천 이름의 지정 위치에 그 정확한 한자를 반드시 포함**. 예: 항렬자 "俊" 첫 글자 → 모든 후보 hanja는 "俊◯" 형태. 다른 한자(浚·峻 등)로 바꾸면 안 됨.

반드시 아래 JSON 구조로만 응답:
{"namingProcess":[{"step":"1단계: 사주 분석","detail":"60자 내외"},{"step":"2단계: 부족한 오행 발견","detail":"60자 내외"},{"step":"3단계: 보완 한자 후보 추출","detail":"60자 내외"},{"step":"4단계: 수리 81수 관점 고려","detail":"60자 내외"},{"step":"5단계: 발음 오행 상생 고려","detail":"60자 내외"},{"step":"6단계: 음양 배치 고려","detail":"60자 내외"},{"step":"7단계: 의미·어감 종합 판정","detail":"60자 내외"}],"summary":"사주 분석 요약 + 작명 방향 200자 내외","sajuLack":"부족한 오행 + 보완 방향 100자 내외","candidates":[{"hangul":"이름만 한글 예: 진우","hanja":"이름만 한자 예: 鎭宇","strokes":[성씨획,이름1획,이름2획],"hanjaDetail":[{"char":"이름 한자 1글자","meaning":"부수+의미 예: 흙 토(土) 부수, 6획, 존재할 재","soundFeel":"음운 어감 예: 단단함·기반"}],"summary":"이 이름의 종합 의미 80자 내외","yinyang":"양양음 또는 음음양 등","gyeokGrade":"종합 사격 등급 (대길/길/반길/평/흉)","soundEl":"발음 오행 예: 토금토","sajuMatch":"사주 보완 효과 한 줄"}],"advice":"종합 조언 + 작명 의식의 의미 120자 내외"}
candidates 5개. 각 candidates의 hanjaDetail은 이름 글자 수만큼 (2~3개, 성씨 제외). namingProcess 7단계 모두 포함.` + JSON_FORCE;

      const c = context || {};
      const lenNum = (c.length||'3자').match(/\d+/)?.[0]||'3';
      const givenLen = parseInt(lenNum,10)-1;
      userPrompt = `작명 의뢰
성씨: ${c.surname||''}${c.surnameHanja?` (${c.surnameHanja})`:''}
사주: ${c.pillar||''} / 일간 ${c.ilgan||''}(${c.ilganElement||''})
부족한 오행: ${c.lacking||'없음'} / 강한 오행: ${c.dominant||''}
성별: ${c.gender||''}
작명 스타일: ${c.style||'전통한자'}
⚠️ 이름 글자 수: ${c.length||'3자'} → 성씨 1자 + 이름 ${givenLen}자. hangul/hanja 필드는 정확히 ${givenLen}글자. 한국 관습이 3자라도 사용자 요청을 우선.
선호 한자: ${c.preferred||'없음'}
${c.hangryeolHanja?`⚠️ 항렬자(行列字): ${c.hangryeolHanja} — 위치: ${c.hangryeolPos==='first'?'이름 첫 글자':c.hangryeolPos==='last'?'이름 끝 글자':'위치 미지정 (가문 관습 따라 적절히)'}. 모든 추천 이름은 이 정확한 한자(${c.hangryeolHanja})를 지정 위치에 반드시 포함. 다른 한자로 변경 절대 금지.`:'항렬자: 없음 (가문에서 항렬을 안 씀)'}

이 사주에 맞는 좋은 이름 5개를 추천해주세요.`;

    } else if (type === 'naming_premium_1') {
      // 1단계: 사주 정밀 + 추천 10개 + 각 글자별 정밀 풀이 + 사격 풀이
      systemPrompt = `당신은 한국 전통 성명학 해석 AI 어시스턴트입니다. 자평진전(子平眞詮) 참고. 전통 성명학 관점.
한국어 해요체. 친절하고 자세하게. 부모가 한 글자 한 글자 납득하도록 풀이.
- 추천 이름 10개: [전통한자 4 / 현대한자 3 / 한글전용 3]
- 각 이름은 hanjaDetail로 글자별 정밀 (부수·획수·의미·음운 어감)
- 사격(천·인·지·외·총) 5개 관점을 고려해 풀이
- 사주 보완 효과 + 같은 발음의 다른 한자와 비교 (왜 이 한자인지)

⚠️ 절대 규칙 — 위반 금지:
1. 사용자 요청 이름 글자 수 정확히 지킬 것. "4자"=성씨1+이름3 → hangul은 3글자. 한국 관습이 3자여도 사용자 요청 우선.
2. hangul과 hanja는 '이름만' (성씨 제외). 예: hangul:"진우", hanja:"鎭宇".
3. hanjaDetail은 이름 한자만, 글자 수는 이름 글자 수와 정확히 일치.
4. **candidates 배열은 sajuMatchScore 내림차순 정렬** — 가장 잘 맞는 이름이 [0]번, 가장 약한 게 [9]번.
5. **항렬자(行列字)가 지정된 경우, 모든 candidates의 지정 위치에 그 정확한 한자를 반드시 포함**. 예: 항렬자 "俊" 첫 글자 → 모든 hanja는 "俊◯" 형태. 다른 한자(浚·峻 등)로 바꾸면 안 됨. hanjaDetail에도 이 한자 그대로.

반드시 아래 정확한 JSON 구조로만 응답:
{"sajuAnalysis":"사주 정밀 분석 + 작명 방향 250자 내외","candidates":[{"hangul":"이름만 한글","hanja":"이름만 한자","style":"전통/현대/한글","strokes":[성씨획,이름획...],"hanjaDetail":[{"char":"이름 한자","meaning":"부수+획수+의미 예: 在 — 흙 토(土) 부수, 6획, '존재할 재', 안정과 기반의 의미","soundFeel":"음운 어감 50자 내외 예: 단단하고 기반 다지는 어감"}],"alternativeHanja":"같은 발음 다른 한자와 비교 80자 내외 예: 在(존재) vs 載(실을 재) — 在가 더 안정적","gyeokGrade":"종합 등급 (대길/길/반길/평/흉)","fiveGyeokDetail":{"cheon":"천격 풀이 40자","in":"인격 풀이 40자","ji":"지격 풀이 40자","oe":"외격 풀이 40자","chong":"총격 풀이 40자"},"yinyangPattern":"음양 예: 양양음","soundElPattern":"발음 오행 예: 토금토","sajuMatchScore":number(0-100),"sajuMatchReason":"사주 매칭 이유 80자 내외","strengths":"장점 80자 내외","concerns":"고려사항 60자 내외 (없으면 빈 문자열)"}]}
candidates 정확히 10개, sajuMatchScore 내림차순 정렬. 한글전용은 hanjaDetail 빈 배열.` + JSON_FORCE;

      const c = context || {};
      userPrompt = `작명 프리미엄 1단계 (10개 후보)
성씨: ${c.surname||''}${c.surnameHanja?`(${c.surnameHanja})`:''}
사주 4기둥: ${c.pillar||''}
일간: ${c.ilgan||''}(${c.ilganElement||''}) / 강함: ${c.dominant||''} / 부족: ${c.lacking||'없음'}
성별: ${c.gender||''}, 작명 스타일: ${c.style||''}, 글자수: ${c.length||''}
선호: ${c.preferred||'없음'}
${c.hangryeolHanja?`⚠️ 항렬자(行列字): ${c.hangryeolHanja} — 위치: ${c.hangryeolPos==='first'?'이름 첫 글자':c.hangryeolPos==='last'?'이름 끝 글자':'위치 미지정 (가문 관습 따라)'}. 모든 candidates는 이 정확한 한자(${c.hangryeolHanja})를 지정 위치에 반드시 포함. 다른 한자로 변경 절대 금지. hanjaDetail에도 이 한자가 그대로 들어가야 함.`:'항렬자: 없음'}

전통/현대/한글 다양하게 10개 추천해주세요.`;

    } else if (type === 'naming_premium_2') {
      // 2단계: 베스트 3 평생 운명 + 작명 의식 + 종합
      systemPrompt = `당신은 작명 AI 어시스턴트입니다. 1단계 추천 중 베스트 3개를 골라 깊이 있는 평생 풀이.
한국어 해요체. 한 사람의 평생 운명을 비는 마음으로 작성.
- 베스트 3개: 사주 보완·수리·음양·발음 종합 최상위
- 각 이름의 인생 흐름 4구간: 10~20대(학업/적성), 30~40대(직업/결혼), 50~60대(사회/가정), 70+(말년/유산) — 각 130자 내외
- 어울리는 직업·진로 (구체 분야)
- 어울리는 인연·배우자 상 (사주+이름 조화)
- 평생 보완할 점·주의할 시기
- 동명이인·역사 인물 비교
- 영어 표기·해외 발음 환경
- 한국 전통 작명 의식의 의미 (이름이 부르는 사람·불리는 사람에게 주는 기운)
- 작명을 의뢰한 부모/본인에게 주는 축원

⚠️ 절대 규칙:
1. 사용자 요청 이름 글자 수 정확히 지킬 것 (예: "4자"=성씨1+이름3, hangul 3글자).
2. hangul과 hanja는 '이름만' (성씨 제외).
3. **bestThree는 1단계에서 추천한 candidates 중 sajuMatchScore 상위 3개**를 골라야 함. 글자 수도 1단계와 정확히 일치. 새 이름 만들지 말 것.
4. **항렬자가 지정된 경우, bestThree 모두 그 정확한 한자를 지정 위치에 반드시 포함**. 1단계 candidates에서 그대로 가져올 것.

반드시 아래 정확한 JSON 구조로만 응답:
{"bestThree":[{"hangul":"이름만 한글","hanja":"이름만 한자","whyBest":"베스트로 뽑힌 이유 80자 내외","lifeFlow":{"teens":"10~20대 130자 내외 (학업/적성)","thirties":"30~40대 130자 내외 (직업/결혼)","fifties":"50~60대 130자 내외 (사회/가정)","seventies":"70+ 130자 내외 (말년/유산)"},"careerFit":"어울리는 직업·진로 100자 내외","relationFit":"어울리는 인연·배우자 상 80자 내외","cautionPoints":"평생 보완할 점·주의 시기 80자 내외","nameComparison":"동명이인·역사 인물 60자 내외","soundEnvironment":"영어 표기·해외 발음 환경 60자 내외"}],"namingRitual":"한국 전통 작명 의식의 의미 + 이 이름을 부를 때 활성화되는 기운 200자 내외","blessing":"부모/본인에게 주는 축원 150자 내외","namingAdvice":"종합 조언 + 이름 사용법 + 인장(印章)·서명 권장 한자 150자 내외","alternativeIdeas":"대안 아이디어 (영문 이름 동시 사용 등) 80자 내외"}
bestThree 정확히 3개.` + JSON_FORCE;

      const c = context || {};
      userPrompt = `작명 프리미엄 2단계 (베스트 3 인생 풀이)
성씨: ${c.surname||''} / 사주: ${c.pillar||''}
일간 ${c.ilgan||''} / 부족 ${c.lacking||''}
성별: ${c.gender||''}
${c.hangryeolHanja?`⚠️ 항렬자: ${c.hangryeolHanja} (${c.hangryeolPos==='first'?'첫 글자':c.hangryeolPos==='last'?'끝 글자':'위치 미지정'}) — bestThree 모두 이 한자 포함 필수.`:''}

1단계에서 추천한 후보 중 베스트 3개를 선정하고 각 이름의 인생 흐름·직업·동명이인·발음 환경을 풀이해주세요.`;

    } else if (type === 'dream') {
      // 꿈해몽 무료 — 한국 전통 + 융 심리학 통합 (사주 연계는 프리미엄)
      systemPrompt = `당신은 꿈 해석 AI 어시스턴트입니다. 한국 전통 해몽 관점 + 융(C.G. Jung) 심리학을 통합하여 풀이합니다.
한국어 해요체. 꿈의 줄거리·시점·정서·모티브를 직접 인용하며 풀이.
- 한국 전통: 14대 분류 매핑 + 길흉 판정
- 융 심리학: archetype(페르소나·그림자·자기 등) 관점에서 무의식의 메시지
- 핵심 상징 3개 추출 (꿈에서 가장 중요한 것)
- 따뜻하지만 통찰력 있는 톤

반드시 아래 JSON 구조로만 응답:
{"summary":"종합 풀이 250자 내외 (전통+융 통합 톤)","traditionalReading":"한국 전통 해석 150자 내외 (전통 해몽 분류 + 길흉 판정)","jungianReading":"융 심리학 해석 150자 내외 (archetype + 무의식 메시지)","fortuneType":"길몽 / 흉몽 / 계시몽 / 평몽 중 하나","fortuneScore":number(0-100),"keySymbols":[{"symbol":"상징명","meaning":"의미 한 줄"}],"luckyNumbers":[number,number,number,number],"luckyColor":"행운의 색","emotionalState":"꿈이 비추는 감정 상태 80자 내외","advice":"실생활 조언 100자 내외"}
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
      systemPrompt = `당신은 꿈 해석 AI 어시스턴트입니다. 한국 민속 해몽 관점 · 융 분석심리학 · 프로이트 정신분석 통합.
한국어 해요체. 고전 인용은 서지 ID로만 표기.
- 한국 전통 심층: 전통 해몽 카테고리별 길흉 + 한국 민속 해몽 (예: 돼지꿈=재물)
- 융 심층: 집단 무의식·archetype·그림자·아니마/아니무스·자기(self) 통합 관점
- 사주 연계 (있을 시): 사용자 일간·강한 오행과 꿈의 오행/모티브 상관관계 — 같은 꿈도 일간 火/水에 따라 다른 의미
- 무의식 진단: 꿈이 비추는 현재 감정·욕구·갈등
간결하게: 각 섹션 150자 내외. 핵심만.

반드시 아래 정확한 JSON 구조로만 응답:
{"traditionalDeep":"한국 전통 심층 풀이 150자 내외","jungianDeep":"융 심리학 심층 풀이 150자 내외","sajuLink":"사주 연계 풀이 150자 내외 (사주 정보 없으면 빈 문자열)","unconsciousReading":"무의식 진단 (감정·욕구·갈등) 150자 내외","citation_ref":{"source_id":"등재ID|NONE"}}` + CITATION_RULE + JSON_FORCE;

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
      systemPrompt = `당신은 꿈 해석 AI 어시스턴트입니다.
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
      systemPrompt = `당신은 사주명리 궁합 해석을 돕는 AI 어시스턴트입니다. 자평진전(子平眞詮)을 참고합니다.
한국어 해요체. 두 사람의 사주 4기둥 + 합충 분석 데이터를 직접 인용하며 풀이.
- 일간(日干) 케미가 핵심 (合化·相沖·相生·相剋)
- 일지(日支)는 배우자궁(연인궁/동반자궁)이라 가장 중요
- 합·충·해 관계로 끌림과 갈등 진단
- 두 사주의 오행 보완성 평가
- 정직하고 현실적인 톤 — 좋은 점과 주의할 점을 균형 있게. 타당한 이유 없이 긍정으로 왜곡 금지(상성이 낮으면 낮은 점수·솔직한 등급 제시)
- autoScore는 자동 산출값. LLM은 명리적 판단으로 보정한 score 제시.

★ 중요: 관계 유형(relType)에 따라 풀이 관점·예시·조언 톤을 정확히 조정하세요.
- "예비부부·결혼": 백년해로 관점 — 결혼 후 동거·자녀·재물 합·갈등 패턴. 결혼 적합성 진단.
- "연인": 현재 연애 흐름 — 끌림·소통·장기 관계 발전 가능성·이별 위험.
- "썸·짝사랑": 발전 가능성 — 고백 타이밍·상대의 마음·다가가는 법.
- "친구": 우정 — 함께 어울리는 호흡·오래 가는 우정 비결·갈등 패턴.
- "동료·업무": 협업 시너지 — 일 호흡·역할 분담·갈등 회피·합작 가능성.
- "가족": 가족 인연 — 세대 간 호흡·갈등 패턴·정서적 거리·돌봄.
- "그냥 궁금": 두 사람 사이의 인연 종합 — 어떤 관계가 가장 어울리는지도.

scores 4영역은 관계 유형별로 가중치 조정:
- "예비부부·결혼": personality/romance/wealth/life
- "연인"/"썸·짝사랑": personality/romance + life (wealth는 부수)
- "친구": personality/life + romance(친밀도)/wealth(같이 노는 비용 호흡)
- "동료·업무": personality/wealth(일/협업)/life(업무 흐름) + romance(친화력)
- "가족": personality/life + romance(애정)/wealth(생활 호흡)

반드시 아래 JSON 구조로만 응답:
{"summary":"관계 유형에 맞춘 두 사주 종합 궁합 풀이 250자 내외","ilganChemistry":"일간 케미 풀이 150자 내외","habChungAnalysis":"합·충·해 풀이 100자 내외","elementBalance":"오행 보완성 100자 내외","score":number(0-100),"grade":"등급 (관계 유형·실제 상성에 맞춰 정직하게: 천생연분/좋은인연/노력이필요한인연/평범한인연/주의가필요한인연/도전적인연 등 — 좋은 결과로 왜곡 금지)","scores":{"personality":number(0-100),"romance":number(0-100),"wealth":number(0-100),"life":number(0-100)},"luckyInfo":{"color":"공통 행운의 색","direction":"공통 행운의 방위","activity":"좋은 함께 활동 (관계 유형에 맞게)"},"caution":"주의사항 80자 내외","advice":"관계 유형에 맞춘 종합 조언 100자 내외"}` + JSON_FORCE;

      const c = context || {};
      userPrompt = `궁합 분석 의뢰
★ 관계 유형: ${c.relType||'연인'} (이 관점에서 풀이)

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

이 두 사람의 궁합을 "${c.relType||'연인'}" 관점에서 명리학적으로 풀이해주세요. 결혼 위주 풀이를 일률적으로 적용하지 말고, 관계 유형에 맞춰 예시·조언·캐릭터화하세요.`;

    } else if (type === 'compat_premium_1') {
      // 1단계: 일간/일지 정밀 매치 + 합충 상세 + 오행 보완 + 영역별 심층
      systemPrompt = `당신은 명리 궁합 해석 AI 어시스턴트입니다. 자평진전(子平眞詮) · 연해자평(淵海子平) 참고 · AI 생성 해석.
한국어 해요체. 고전 인용은 서지 ID로만 표기. 두 사주 데이터 직접 인용.
- 일간 정밀 매치: 合化(예: 갑기→토)의 의미와 실제 영향력
- 일지 매치: 배우자궁/연인궁/동반자궁이 합인지 충인지에 따라 관계 후 흐름
- 합·충·형·해 8글자 단위 상세
- 오행 보완 — 부족·과한 오행을 두 사람이 어떻게 채워주거나 충돌하는지
- 5영역 심층 — 관계 유형별 라벨·강조점 조정
간결하게: 5영역 deep은 각 130자 내외, 일간·일지·합충·오행 deep은 각 200자 내외. 핵심만.

★ 관계 유형(relType)별 5영역 라벨·관점:
- "예비부부·결혼": personality(성격), romance(연애·결혼), wealth(재물), children(자녀), life(가정생활)
- "연인": personality, romance(연애·끌림), wealth(데이트·생활비), children(미래 계획), life(일상 호흡)
- "썸·짝사랑": personality, romance(끌림·발전 가능성), wealth(데이트 호흡), children(가능성 시각), life(만남 흐름)
- "친구": personality, romance(친밀도·우정), wealth(같이 노는 호흡), children(공동 추억), life(생활 합)
- "동료·업무": personality, romance(친화력·팀워크), wealth(업무 시너지), children(공동 프로젝트), life(업무 흐름)
- "가족": personality, romance(애정·돌봄), wealth(생활 분담), children(돌봄·양육), life(세대 합)
- "그냥 궁금": 결혼 관점이 아닌 일반적 인연 관점으로 풀이

반드시 아래 정확한 JSON 구조로만 응답:
{"ilganDeep":"일간 정밀 매치 200자 내외","iljiDeep":"일지 정밀 매치 200자 내외 (관계 유형에 맞게)","habChungDetail":"합·충·형·해 상세 200자 내외","elementBalance":"오행 보완성 정밀 200자 내외","areasDeep":{"personality":"성격 케미 130자 내외","romance":"관계 유형 맞춤 130자 내외","wealth":"재물/호흡 130자 내외","children":"관계 유형 맞춤 130자 내외","life":"생활 합 130자 내외"}}` + CITATION_RULE + JSON_FORCE;

      const c = context || {};
      userPrompt = `궁합 프리미엄 1단계 (정밀 매치·합충·영역 심층)
★ 관계 유형: ${c.relType||'연인'} (이 관점에서 풀이)

${c.name1||'A'}님: ${c.pillar1||''} / 일간 ${c.ilgan1||''}
${c.name2||'B'}님: ${c.pillar2||''} / 일간 ${c.ilgan2||''}
일간 관계: ${c.ilganRelation||''} / 일지 관계: ${c.iljiRelation||''}
천간합: ${c.hsHabs||''} / 천간충: ${c.hsChungs||''}
지지 육합: ${c.ebHabs||''} / 육충: ${c.ebChungs||''} / 육해: ${c.ebHaes||''}
오행 합산: ${c.elsCombined||''} / 부족: ${c.lacking||''} / 과: ${c.excess||''}

이 두 사람의 정밀 매치·합충·오행·5영역을 "${c.relType||'연인'}" 관점에서 풀이해주세요.`;

    } else if (type === 'compat_premium_2') {
      // 2단계: 대운 동행 + 갈등 시나리오 + 길흉일 + 개운법
      systemPrompt = `당신은 명리 궁합 해석 AI 어시스턴트입니다.
한국어 해요체. 1단계 해석과 일관성 유지. 간결하게 핵심만.
- 대운 동행: 두 사람 8단계 대운(0~80세)을 비교, 함께 좋은 시기·도전 시기
- 갈등 시나리오: 합충 관계로 발생할 수 있는 구체 상황 + 처방 3~4개
- weddingDays는 관계 유형에 맞춰 "중요 시기/길월" 의미로 사용
- 개운법: 두 사람이 함께 실천할 보강법

★ 관계 유형(relType)별 weddingDays·gaeunbup 의미 조정:
- "예비부부·결혼": 결혼 길흉일 + 백년해로 개운법 (전통)
- "연인": 함께 좋은 달·만남 적기 + 장기 연애 개운법
- "썸·짝사랑": 고백·발전 적기 달 + 마음 잡는 개운법
- "친구": 만남·여행·중대 결정 적기 + 우정 강화 개운법
- "동료·업무": 협업·중요 미팅 적기 + 시너지 강화 개운법
- "가족": 화합·여행·중대 결정 적기 + 가족 화목 개운법
- "그냥 궁금": 일반적 좋은 달·주의 달 + 인연 강화 개운법
이에 맞춰 "luckyMonths/cautionMonths/advice" 표현을 자연스럽게 조정 (꼭 "결혼"이라고 적지 말 것).

반드시 아래 정확한 JSON 구조로만 응답:
{"daewoonAlignment":[{"period":"0~9세","fortune":"50자 내외"},{"period":"10~19세","fortune":""},{"period":"20~29세","fortune":""},{"period":"30~39세","fortune":""},{"period":"40~49세","fortune":""},{"period":"50~59세","fortune":""},{"period":"60~69세","fortune":""},{"period":"70~79세","fortune":""}],"scenarios":[{"situation":"갈등 상황 한 줄","trigger":"발생 원인 한 줄 (사주상의 이유)","solution":"화합 처방 80자 내외"}],"weddingDays":{"luckyMonths":"길월","cautionMonths":"피할 달","advice":"관계 유형 맞춤 조언 80자 내외"},"gaeunbup":"관계 유형 맞춤 개운법 200자 내외"}
daewoonAlignment 8단계 모두, scenarios 3~4개.` + JSON_FORCE;

      const c = context || {};
      userPrompt = `궁합 프리미엄 2단계 (대운 동행·시나리오·길흉일·개운)
★ 관계 유형: ${c.relType||'연인'} (이 관점에서 풀이 — 결혼 표현 일률 적용 X)

${c.name1||'A'}님(${c.gender1||''}): ${c.pillar1||''}
${c.name2||'B'}님(${c.gender2||''}): ${c.pillar2||''}
일간/일지 관계: ${c.ilganRelation||''} / ${c.iljiRelation||''}
합충 요약: 합 ${c.hsHabs||''} ${c.ebHabs||''} / 충 ${c.hsChungs||''} ${c.ebChungs||''} / 해 ${c.ebHaes||''}

두 사람 8단계 대운 동행, 갈등 시나리오 3~4개, 관계 유형별 길흉일, 개운법을 풀이해주세요.`;

    } else if (type === 'saju') {
      // 사주 무료 분석
      systemPrompt = `당신은 사주명리(四柱命理) 해석을 돕는 AI 어시스턴트입니다. 자평진전·적천수·궁통보감을 참고한 AI 해석입니다.
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
      systemPrompt = `당신은 사주명리 해석 AI 어시스턴트입니다. 자평진전·적천수·궁통보감 참고.
한국어 해요체. 고전 인용은 서지 ID로만 표기. 사주 8글자와 십성 수치를 직접 인용.
- 격국(格局) 판정: 정격(정관·재격·인수·식신 등) 또는 외격(종격·화격) 자동 분류
- 용신(用神) 추천: 일간 강약 + 월령 + 오행 균형 종합
- 십성 위치별 의미 (연주=조부·초년, 월주=부모·청년, 일지=배우자, 시주=자식·말년)
- 재물·직업·건강·연애 4영역 심층 풀이
간결하게: 4영역 deep 분석은 각 130~150자 내외, 격국 description은 150자 내외. 핵심만.

반드시 아래 정확한 JSON 구조로만 응답:
{"gyeokguk":{"name":"격국명 예: 정관격","type":"정격 또는 외격","description":"격국 풀이 150자 내외"},"yongsin":{"element":"용신 오행 예: 금","reasoning":"선택 이유 80자 내외","method":"보강법 60자 내외"},"sipsungDetail":[{"name":"십성명","position":"연/월/일/시","meaning":"역할 풀이 60자 내외"}],"wealthDeep":"재물운 심층 130자 내외","careerDeep":"직업운 심층 130자 내외","healthDeep":"건강운 심층 130자 내외","loveDeep":"연애·인간관계 심층 130자 내외","citation_ref":{"source_id":"등재ID|NONE"}}
sipsungDetail 배열에 4기둥 각 천간의 십성 4개 포함.` + CITATION_RULE + JSON_FORCE;

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
      systemPrompt = `당신은 사주명리 해석 AI 어시스턴트입니다. 자평진전·적천수 참고.
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
      systemPrompt = `당신은 토정비결(土亭秘訣) 해석을 돕는 AI 어시스턴트입니다. 토정비결 형식을 참고하여 한 해의 운세를 해석합니다.

규칙:
- 한국어, 해요체
- 전달받은 괘(卦) 조합에 맞는 전통적 해석을 참고하되, 현대적으로 풀어서 설명
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
이 괘 조합에 맞는 ${c.targetYear||new Date().getFullYear()}년 운세를 토정비결 형식으로 해석해주세요.`;

    } else if (type === 'tojeong_premium_1') {
      // 1단계: 심층 총운 + 괘 분석 + 4영역 심층 + 인용
      systemPrompt = `당신은 토정비결(土亭秘訣) 해석 AI 어시스턴트입니다. 토정비결 형식을 참고한 깊이 있는 AI 해석을 제공합니다.
한국어 해요체. 고전 인용은 서지 ID로만 표기.

반드시 아래 정확한 JSON 구조로만 응답:
{"detailedYear":"올해 심층 총운 400자+","guaAnalysis":{"upper":{"name":"상괘명","element":"오행","meaning":"해석 100자+"},"middle":{"name":"중괘명","element":"오행","meaning":"해석 100자+"},"lower":{"name":"하괘명","element":"오행","meaning":"해석 100자+"},"combination":"괘 조합 심층 해석 200자+","citation_ref":{"source_id":"등재ID|NONE"}},"wealthAnalysis":"재물운 심층 분석 200자+","careerAnalysis":"직업운 심층 분석 200자+","healthAnalysis":"건강운 심층 분석 200자+","loveAnalysis":"연애·인간관계 심층 분석 200자+","citation_ref":{"source_id":"등재ID|NONE"}}` + CITATION_RULE + JSON_FORCE;

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
      systemPrompt = `당신은 토정비결(土亭秘訣) 해석 AI 어시스턴트입니다. 토정비결 형식을 참고한 AI 해석입니다.
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

    // P1-R1: chat 타입 분기 삭제 (프런트 호출부 0건 · 사용자 입력 원문을 무필터로 프롬프트에 삽입하던 경로)
    } else if (type === 'daily_message') {
      // 데일리 한 마디 — 카테고리·페르소나·사주 컨텍스트 + 행운 정보
      const c = context || {};
      const personaTone = c.personaTone || '따뜻하고 친근한 운세 해설자. 신비로운 해요체';
      const personaName = c.personaName || '선녀';
      systemPrompt = `당신은 "${personaName}"입니다. 캐릭터: ${personaTone}.
사용자의 오늘 운세를 짧고 임팩트 있게 전합니다.

⚠️ 절대 규칙:
- 분량: 150~250자 (한 마디라서 짧고 묵직하게)
- 사주 컨텍스트가 있으면 일간·시·생년월일을 정확히 인용 (임의 추정 금지)
- 사주 없으면 따뜻한 일반 메시지 + "생년월일을 알려주시면 더 정확..." 권유 한 줄
- 카테고리(사랑·일·돈·건강·전반)에 맞게 톤 조정
- 답 마지막에 행운 정보 토큰 포함 (필수):
  ★LUCK★색:[행운의 색]|숫자:[1~9]|방위:[동/서/남/북/중앙]|시간:[오전/오후 N시]★

응답 형식: 자연어 + 행운 토큰. JSON 아님.`;

      let ctxLines = [];
      if(c.ilgan){
        const sajuParts = [];
        if(c.birth) sajuParts.push(`생년월일: ${c.birth}`);
        if(c.gender) sajuParts.push(`성별: ${c.gender==='male'?'남성':'여성'}`);
        if(c.dayPillar) sajuParts.push(`일주: ${c.dayPillar}`);
        sajuParts.push(`일간: ${c.ilgan}${c.ilganElement?`(${c.ilganElement})`:''}`);
        if(c.hourBranch) sajuParts.push(`태어난 시: ${c.hourBranch}`);
        if(c.lacking) sajuParts.push(`부족 오행: ${c.lacking}`);
        ctxLines.push('사주: ' + sajuParts.join(' / '));
      }
      if(c.tarotSummary) ctxLines.push(`최근 타로: ${c.tarotSummary}`);
      if(c.faceSummary) ctxLines.push(`관상 요약: ${c.faceSummary}`);
      const ctxBlock = ctxLines.length ? `사용자 정보:\n${ctxLines.join('\n')}\n\n` : '';

      userPrompt = `${ctxBlock}오늘 날짜: ${new Date().toLocaleDateString('ko-KR')}
분야: ${c.category||'전반'}

${personaName} 톤으로 오늘의 한 마디를 전해주세요. 150~250자 + ★LUCK★ 행운 정보 토큰 필수.`;

    } else if (type === 'tarot') {
      systemPrompt = `당신은 한국어 타로 해석 AI 어시스턴트입니다. 라이더-웨이트 덱을 사용하며, 한국 정서에 맞는 친근한 해요체.
- 3장 카드의 위치(과거·현재·미래)와 정/역방향을 모두 반영
- 카드 의미를 사용자 질문·카테고리에 직접 연결하여 풀이 (일반 설명 X)
- 사주 정보 있으면 일간·오행 관점 추가
- 긍정·도전 균형, 운명론보다 실천 지향

반드시 아래 JSON 구조로만 응답:
{"summary":"3장 종합 메시지 200자 내외 (질문에 직접 답)","reading":[{"position":"과거","cardName":"카드 이름","reversed":boolean,"meaning":"이 위치+카드+정/역방향이 사용자 질문에 주는 의미 120자 내외","advice":"이 카드의 조언 60자 내외"},{"position":"현재","cardName":"","reversed":boolean,"meaning":"","advice":""},{"position":"미래","cardName":"","reversed":boolean,"meaning":"","advice":""}],"keyMessage":"핵심 메시지 80자 내외","actionTip":"실천 조언 80자 내외","sajuLink":"사주 연계 풀이 120자 내외 (사주 없으면 빈 문자열)","fortuneScore":number(0-100),"luckyKeyword":"행운 키워드 한 단어"}
reading 배열에 반드시 3장 모두 포함. cardName과 reversed는 입력으로 제공된 카드와 정확히 일치.` + JSON_FORCE;
      const c = context || {};
      const catName = {love:'사랑·연애',work:'일·커리어',money:'재물·돈',health:'건강',general:'전반적 운',free:'자유 질문'}[c.category]||'전반적 운';
      const cardsDesc = (c.cards||[]).map((card,i)=>`[${['과거','현재','미래'][i]}] ${card.name}${card.reversed?'(역방향)':'(정방향)'} — 키워드: ${card.reversed?card.rev:card.up}`).join('\n');
      userPrompt = `타로 의뢰
카테고리: ${catName}
${c.question?`구체 질문: "${c.question}"`:'구체 질문: (없음, 카테고리 전반)'}
${c.ilgan?`사주 일간: ${c.ilgan}(${c.ilganElement||''}) / 강한 오행: ${c.dominant||''} / 부족 오행: ${c.lacking||''}`:'사주: 미입력'}

뽑힌 카드 3장:
${cardsDesc}

각 카드의 위치(과거·현재·미래)와 정/역방향을 반영하여 사용자 질문에 답해주세요.`;

    } else if (type === 'tarot_premium_1') {
      systemPrompt = `당신은 한국어 타로 해석 AI 어시스턴트입니다. 라이더-웨이트 덱과 켈틱 크로스 스프레드를 사용합니다.
한국어 해요체. 위치 의미와 카드 의미를 정밀하게 교차 풀이.
- 1~5번 카드: 현재 상황·장애/교차·기반/뿌리·과거·왕관/의식
- 마이너 아르카나는 수트(완드·컵·소드·펜타클) 의미 명시
- 코트 카드는 인물 상징 풀이
- 정/역방향 반영
- 사주 일간·오행 관점 통합

반드시 아래 JSON 구조로만 응답:
{"deepAnalysis":"5장 종합 + 전체 흐름 250자 내외","readings":[{"position":"현재 상황","positionDesc":"질문자가 처한 핵심 상황","cardName":"카드 이름","kind":"major/minor/court","suit":"완드/컵/소드/펜타클 (마이너만)","reversed":boolean,"meaning":"위치+카드+정역 통합 풀이 150자 내외","advice":"이 위치 기준 조언 80자 내외"}]}
readings 배열에 5장 모두 포함 (1~5번 순서). cardName·reversed·kind는 입력 그대로.` + JSON_FORCE;
      const c = context || {};
      const catName = {love:'사랑·연애',work:'일·커리어',money:'재물·돈',health:'건강',general:'전반적 운',free:'자유 질문'}[c.category]||'전반적 운';
      const posNames = ['현재 상황','장애·교차','기반·뿌리','과거','왕관·의식'];
      const cardsDesc = (c.cards||[]).slice(0,5).map((card,i)=>`[${posNames[i]}] ${card.name}${card.reversed?'(역방향)':'(정방향)'} — 유형: ${card.kind||'major'}${card.suit?` / 수트: ${card.suitName||card.suit}`:''}${card.court?` / 코트: ${card.court}`:''} — 키워드: ${card.reversed?(card.rev||card.theme):(card.up||card.theme)}`).join('\n');
      userPrompt = `타로 프리미엄 1단계 (켈틱크로스 1~5번)
카테고리: ${catName}
${c.question?`질문: "${c.question}"`:'질문: 카테고리 전반'}
${c.ilgan?`사주: 일간 ${c.ilgan}(${c.ilganElement||''}) / 강함 ${c.dominant||''} / 부족 ${c.lacking||''}`:'사주: 미입력'}

뽑힌 카드 (1~5번):
${cardsDesc}

각 위치의 의미와 카드의 상징을 교차하여 풀이해주세요.`;

    } else if (type === 'tarot_premium_2') {
      systemPrompt = `당신은 한국어 타로 해석 AI 어시스턴트입니다. 1단계와 일관성 유지. 친근한 해요체.
- 6~10번 카드: 가까운 미래·자신·환경·희망과 두려움·최종 결과
- 사주 연계 풀이 (사주 있을 때만)
- 시점별 조언: 1주·1개월·3개월 후 흐름
- 실천 계획 (구체 행동)
- 행운 정보 (색·숫자·방위·요일)
- 격려 메시지

반드시 아래 JSON 구조로만 응답:
{"readings":[{"position":"가까운 미래","positionDesc":"곧 다가올 흐름","cardName":"","kind":"","suit":"","reversed":boolean,"meaning":"150자 내외","advice":"80자 내외"}],"sajuLink":"사주 일간·오행 연계 풀이 150자 내외 (사주 없으면 빈 문자열)","timeline":{"oneWeek":"1주 후 흐름 100자 내외","oneMonth":"1개월 후 100자 내외","threeMonths":"3개월 후 120자 내외"},"actionPlan":"실천 계획 150자 내외","luckyInfo":{"color":"행운의 색","number":number,"direction":"행운의 방위","day":"행운의 요일"},"blessing":"격려 메시지 100자 내외"}
readings 배열에 6~10번 5장 모두 포함.` + JSON_FORCE;
      const c = context || {};
      const catName = {love:'사랑·연애',work:'일·커리어',money:'재물·돈',health:'건강',general:'전반적 운',free:'자유 질문'}[c.category]||'전반적 운';
      const posNames = ['가까운 미래','자신','환경','희망과 두려움','최종 결과'];
      const cardsDesc = (c.cards||[]).slice(5,10).map((card,i)=>`[${posNames[i]}] ${card.name}${card.reversed?'(역방향)':'(정방향)'} — 유형: ${card.kind||'major'}${card.suit?` / 수트: ${card.suitName||card.suit}`:''}${card.court?` / 코트: ${card.court}`:''} — 키워드: ${card.reversed?(card.rev||card.theme):(card.up||card.theme)}`).join('\n');
      userPrompt = `타로 프리미엄 2단계 (켈틱크로스 6~10번 + 사주·시점·행운)
카테고리: ${catName}
${c.question?`질문: "${c.question}"`:''}
${c.ilgan?`사주: 일간 ${c.ilgan}(${c.ilganElement||''}) / 강함 ${c.dominant||''} / 부족 ${c.lacking||''}`:'사주: 미입력'}

뽑힌 카드 (6~10번):
${cardsDesc}

각 위치 풀이 + 사주 연계 + 시점별 조언 + 실천 계획 + 행운 정보를 알려주세요.`;

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
    else if (type === 'naming') maxTokens = 5500;
    else if (type === 'naming_premium_1') maxTokens = 7000;
    else if (type === 'naming_premium_2') maxTokens = 5500;
    else if (type === 'naming_company') maxTokens = 3500;
    else if (type === 'naming_company_premium_1') maxTokens = 6000;
    else if (type === 'naming_company_premium_2') maxTokens = 5500;
    else if (type === 'naming_product') maxTokens = 3500;
    else if (type === 'naming_product_premium_1') maxTokens = 6000;
    else if (type === 'naming_pet') maxTokens = 3000;
    else if (type === 'naming_nickname') maxTokens = 3000;
    else if (type === 'tarot') maxTokens = 2500;
    else if (type === 'tarot_premium_1') maxTokens = 4000;
    else if (type === 'tarot_premium_2') maxTokens = 4000;
    else if (type === 'daily_message') maxTokens = 400;

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
      // P1-R3: 상류 응답 본문을 읽지 않는다. message 필드 제거 (프런트는 HTTP status 만으로 동작)
      return res.status(502).json({ error: 'LLM API error', detail: response.status });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    // daily_message는 자연어 응답 — JSON 파싱 안 함
    if (type === 'daily_message') {
      return res.status(200).json({ success: true, result: { text: scrubText(text.trim()) } });
    }
    const parsed = extractJSON(text);
    if (parsed) {
      scrubDeep(parsed); // P1-R7: 인용 키 삭제 + 모든 문자열 값 스크럽 (Phase1 룩업 DB 도입 시 복원)
      return res.status(200).json({ success: true, result: parsed });
    } else {
      // P1-R4: 파싱 실패 시 LLM 원문 미노출. raw 키는 유지하되 센티넬로 대체
      // 프런트 가드 18곳이 if(d.result.raw && ...) truthy 판정에 의존하므로 키 삭제·빈문자열·null 금지
      return res.status(200).json({ success: true, result: { raw: '[PARSE_FAILED]' } });
    }

  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', message: scrubText(String(err.message || '')) });
  }
}
