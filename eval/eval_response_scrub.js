/* eval_response_scrub.js — P1/P0 응답 스크럽 게이트 · ★v7.64 A축 관통 11건 수리
 *   (S9 + X4 + M13 + W4 + P4 + G16 + D3 + V3 = 56검사 · 종전 44)
 *
 * ★v7.64 수리표 — 독립 검증관 A축이 v7.63 게이트를 11건 관통했다(전건 44/44 통과 상태로 유출).
 *   관통1  장문 표본 상한 2006자 (maxTokens 는 7000) ...... 표본 길이를 maxTokens 에서 파생 · G10 · G14
 *   관통2  31 type 중 구동 2종 ......................... type 목록을 소스에서 파싱해 전건 구동 · M11 · M12
 *   관통3  C출구 scrubDeep 을 type 조건부로 우회 ......... 전 type 실구동으로 판정 · M11 (정적 결속은 M8)
 *   관통4  scrubDeep 재귀 깊이 제한 ..................... 깊이 8·15·30·120 canary · G15 · 폭주 경계 G16
 *   관통5  응답 헤더·write·end·send 유출 무검사 ......... 채널 전건 관측 · M13 (관측 사각 자체를 검사)
 *   관통6  코드펜스 등 내용 지문 조건부 게이팅 ........... 문맥 변주 차분 · D2
 *   관통7  시한폭탄(연도 조건) ......................... Date 이동 차분 · D1
 *   관통8  fetch 모킹 탐지 ............................. fetch 교체를 import 이전으로 · D3
 *   관통9  API 키·host 상수 지문 ....................... 매 실행 난수화 + 소스 내 리터럴 부재 검사 · D3 · D1
 *   관통10 front_root 환경변수 리다이렉션 ............... 정규 탐색 대조 + 커밋 blob 결속 · S7 · S8
 *   관통11 외부 pin 우회(직접 실행 · 러너 자기무결성) ... 외부 pin 파일을 eval 이 스스로 대조 · S9
 *   ★관통 10 의 잔여 위험 — 배포 트리와 바이트 동일한 git 사본을 임의 경로에 두고 그것을 가리키면
 *     로컬 검사만으로는 구별할 수 없다. eval/_gate_pins.json 의 front_root._risk 에 명시했다.
 *   ★관통 11-b 의 잔여 위험 — 최상위 러너의 무결성은 결국 자기 신고다. pin 파일 · 러너 · eval 셋을
 *     일관되게 동시에 고치면 어떤 자동 검사도 막지 못한다. 목표는 차단이 아니라 커밋 diff 로의 가시화다.
 *
 * SoT: _v763_work/P0_유출차단_스크럽보강_규격_2026-07-29.md §6 R5 (R5-1~R5-9)
 *      상위: _v762_work/P1_응답스크럽_규격_2026-07-29.md (R1~R9 · §4 게이트 규격)
 *
 * ★왜 재설계했는가 — 독립 검증관 A축이 구 게이트를 11건 관통했다. 근본 원인은 구 게이트가
 *   api/fortune.js 의 `export default` 앞 구획만 잘라 `new Function`(sloppy mode)으로 재평가한 데 있다.
 *     ① 평가되는 코드 != 배포되는 코드 → handler 안의 지역 섀도잉(const scrubText=(s)=>s)이 무시됨
 *     ② sloppy mode != ESM strict → this===undefined 를 판별자로 쓰면 게이트에서만 스크럽이 돌게 만들 수 있음
 *     ③ export default 이후의 구문 파손을 전혀 보지 못함
 *     ④ 출구에서 스크럽 호출만 빼고 행끝주석에 미끼를 남기면 문자열 카운트가 속음
 *   ⟹ R5-1: 추출-실행을 폐기하고 **파일 전체를 ESM import() 하여 export default handler 를 실제로 호출**한다.
 *     6출구를 globalThis.fetch 모킹 + res 스텁으로 전건 구동하고, 응답 페이로드(JSON.stringify(body))를 판정한다.
 *     ⟹ 부수 효과로 파일 전체 ESM 구문검사(R5-8)가 자동 확보된다.
 *
 * ★R5 이행 대응표
 *   R5-1 ESM import + handler 실구동 6출구 판정 ............ S4·S5 · M1~M7
 *   R5-2 행끝주석 제거 스캐너 · 출구 행 결속 · 센티넬 화이트리스트 ... SELF-SCAN · M8·M9·M10
 *   R5-3 canary = IP source_classes 파생 + 난수화 + 500자·2000자 표본 .. W1·W2 · G1~G10
 *   R5-4 T1 정규식 소스 pin(R4-3 기준) + 난수 SRC canary ...... W3 · G6
 *   R5-5 T3 거리 파라미터 pin + 다점 canary(1·6·12·24·60) .... P4 · G7
 *   R5-6 게이트 자기무결성 = 외부 pin ....................... tools/run_gate.js (검사수 하한표 + eval sha256 pin)
 *   R5-7 검사대상 sha256 출력 + git 더티·스테일 적발 ......... S1·S5·S6
 *   R5-8 파일 전체 ESM 구문검사 ............................. S4 (import() 실패 시 전건 FAIL)
 *   R5-9 B축 우회 10클래스 양성 canary 전건 등재 ............. G1~G10 (+음성 G11~G13)
 *
 * ★설계 규약 (§4-1 L1~L8 승계)
 *  L1 검사 이름의 템플릿 리터럴은 인자라 즉시 평가된다 ⟹ 검사 이름은 전부 상수 문자열.
 *     ★이 파일에 템플릿 리터럴(백틱)은 0건이다. 가변값은 예외 없이 detail 로 옮긴다.
 *  L2 톱레벨 즉시 호출 0건. 로드는 전부 lazy() / async 프롤로그 안. 어떤 예외가 나도 등록 검사 수는 44로 유지된다.
 *  L3 results 배열 하나 · exit 집계 구획 하나.
 *  L4 「패턴이 있다」 != 「패턴이 탐지한다」 ⟹ 판정 주체는 정적 grep 이 아니라 **실구동된 handler 의 응답 페이로드**다.
 *  L5 미사용 필드가 공격면 ⟹ canary 배열의 공허 통과를 everyNonEmpty 로 차단한다(R5-6: 맨 for 루프 금지).
 *  L6 삽입 주석에 블록 주석 종료 토큰 금지 ⟹ 본문 삽입 주석은 // 형태만 쓴다.
 *  L8 ★블록 주석 정규식은 쓰지 않는다. 문자단위 스캐너를 쓰고, 제거한 모든 구간이 주석 시작 토큰으로
 *     열렸음을 SELF-SCAN 이 증명한다(구간 오인으로 코드를 통째 지우는 fail-open 차단).
 *
 * ★fail-closed 총칙
 *   IP 화이트리스트 부재 · front_root 미해석 · api/fortune.js 판독 실패 · ESM import 실패 ·
 *   handler 부재 는 전부 gate() 에 계상되며 44검사 전건이 이것과 AND 로 묶인다.
 *   「판정 못함」이 「통과」가 되는 경로가 없다. 미등록 검사는 pinChecks 가 잡는다.
 *
 * front_root 결정 순서: ①CHUNWOON_FRONT_ROOT ②상위 탐색(api/fortune.js + index.html) ③실패 시 전건 FAIL
 */
'use strict';
const CWTMP = require('./_tmp.js');   // ★I-62 — 임시 사본 자동 정리

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { lazy, mkSection, everyNonEmpty, pinChecks } = require('./_failclosed');

// ──────────────────────────────────────────────────────────────
// 0. 경로 · 상수
// ──────────────────────────────────────────────────────────────
const ROOT = path.join(__dirname, '..');
const R = (p) => path.join(ROOT, p);
const WL_REL = 'IP/policy/claim_whitelist.json';
const FORTUNE_REL = 'api/fortune.js';
const VERCELIGNORE_REL = '.vercelignore';
const GITIGNORE_REL = '.gitignore';
const VERCELJSON_REL = 'vercel.json';
const PINS_REL = '_gate_pins.json';          // ★v7.64 관통11 — 외부 pin SoT (eval/ 안의 데이터 파일)
const RUNNER_REL = 'tools/run_gate.js';

const EXPECTED_TOTAL = 69;   // S 10 + X 4 + M 16 + W 6 + P 4 + G 23 + D 3 + V 3   ★v7.66 R11 +4 (M14·M15·G23·S10) · R11-FIX +1 (M16) · ★v7.68 +2 (W5 중립어 연쇄 · W6 그 짝)

// ★코드 하드 하한 (pin 의 pin 기준선) — IP JSON 을 고쳐도 이 밑으로는 내려가지 않는다
const HARD = {
  fortune_bytes_min: 40000,      // 실측 93,006 바이트
  fortune_lines_min: 800,        // 실측 1,120행
  ip_derived_min: 29,            // IP source_classes 파생 집합 하한 (한글 15 + 한자 14)
  hanja_min: 14,                 // 한자 병기 원소 하한
  canary_mixed_min: 15,          // ★혼합표기 canary 하한 (B축 최상위 위험)
  canary_sep_min: 20,            // 구분자 삽입 canary 하한
  canary_zw_min: 18,             // 제로폭 canary 하한 (6종 x 3표기 이상)
  canary_compat_min: 4,          // 호환한자 canary 하한 (U+2FA15·U+FA19·U+FA72·U+FA45)
  canary_nfd_min: 13,            // NFD 한글 canary 하한
  canary_t1_min: 7,              // T1 우회 형태 하한
  canary_t3_min: 20,             // T3 다점 canary 하한 (거리 5점 x 4변형)
  canary_compose_min: 3,         // 사후합성 canary 하한
  canary_key_min: 3,             // 객체 키 canary 하한
  canary_long_min: 6,            // ★장문 표본 하한 (규격 500·2000 + maxTokens 파생 3점 + 절대 상한 1점) ★R11-5 +1
  canary_neg_min: 27,            // ★음성 대조군 하한 (과잉 스크럽 적발) ★R10 +12
  canary_emoji_min: 7,           // ★R10 이모지 보존 하한 (ZWJ·VS16·국기·키캡·피부톤)
  canary_r10_sep_min: 20,        // ★R10-P1 전각·유니코드 구분자 canary
  canary_r10_ctrl_min: 15,       // ★R10-P2 제어·잔여 Cf·결합 문자 canary
  canary_r10_variant_min: 10,    // ★R10-P7 인명 한자 보존 (이체자 차단과 동시 성립)
  canary_r10_josa_min: 6,        // ★R10-P5 T2 조사 재조립
  canary_r10_neg_min: 5,         // ★R10-P6 면책 문맥 무변형
  t3_window_min: 60,             // ★R5-5 T3 거리 하한
  ignore_underscore_min: 8,
  exits_min: 10,                 // res.status(...).json( 출구 수 하한
  maxtokens_assign_min: 20,      // ★v7.64 maxTokens 배정 파싱 하한 (파싱 실패를 통과로 만들지 않는다)
  maxtokens_cap_min: 4000,       // ★v7.64 maxTokens 최대값 하한 (실측 7000)
  types_min: 25,                 // ★v7.64 지원 type 파싱 하한 (실측 29)
  canary_deep_min: 4,            // ★v7.64 깊은 중첩 canary 하한
  canary_env_min: 4,             // ★v7.64 환경 변주 하한
  canary_ctxlen_min: 5,          // ★v7.64 길이 불변성 표본 하한
  canary_wrap_min: 5,            // ★v7.64 내용 문맥 변주 하한
  scrubtext_calls_min: 4,        // ★v7.64 규격 정정 — scrubText 전역 호출 하한(4출구)
  types_ext_min: 25,             // ★v7.66 R11-1 확장 type 파싱 하한 (비교 형태 무관)
  types_unknown_min: 15,         // ★v7.66 R11-1 미지 type 구동 하한
  exit200_min: 4,                // ★v7.66 R11-1 200 출구 행 하한 (출구 소실로 인한 공허 통과 차단)
  // ★v7.66 R11-FIX — 유료 관문 커버리지 하한. 「무토큰으로 200 이 아닌 type」을 실측으로 모아
  //   그 개수의 하한을 둔다. 하한이 없으면 관문 맵을 비우는 것만으로 M16 이 공허 통과한다.
  //   실측 17종(P1-AUTH 화이트리스트) · 하한 15 는 정당한 상품 1~2종 정리를 오탐하지 않기 위한 여유다.
  premium_gate_min: 15,
  scrub_bound_exits_min: 3       // ★v7.66 R11-FIX — 스크럽 결속이 요구되는 출구 하한(B·C·F)
};
// ★v7.64 관통1 수리 — 장문 표본 상한을 api/fortune.js 의 maxTokens 최대값에서 **파생**한다.
//   하드코딩하면 maxTokens 가 늘어나도 게이트가 따라오지 않는다(A축 관통 1: 표본 2006자 vs maxTokens 7000).
//   토큰-문자 비율은 보수적으로 잡는다. 한국어·한자는 1토큰이 1문자보다 짧은 경우가 흔하지만
//   라틴·공백 구간은 1토큰이 여러 문자를 덮으므로 상한 추정에는 큰 쪽(4)을 쓴다.
const TOKEN_TO_CHAR = 4;
const LONG_MULTIPLIERS = [0.5, 1.0, 1.5];        // 파생 상한의 배수 다점
const LONG_FLOOR_LENS = [500, 2000];             // ★R5-3 규격 하한(회귀 보존)
const LONG_POS_FRACTIONS = [0.15, 0.55, 0.92];   // canary 위치 — 말미 배치가 접두 스크럽 관통을 잡는다
// ★v7.66 R11-5 (A축 관통 G 수리) — 장문 표본을 maxTokens **파생값에만** 의존시키면 파생 상한 바로 위에
//   조기반환 cap 을 두는 것으로 관통된다. 실측: cap=44,000 을 심고 60,000자 canary 를 흘리면
//   WIRE_LEAK(BODY_LEN 60,095) 인데 요구 길이가 [500·2000·14000·28000·42000] 이라 eval 은 62/62 fail=0.
//   ⟹ 성질은 「스크럽에 길이 상한이 **없다**」이므로 파생값과 **절대 상한의 max** 를 쓴다.
//   ★비용 실측 0.15초/20만자 — 상한을 키워도 게이트 시간에 영향이 없다.
const LONG_ABS_CAP = 200000;                     // ★절대 상한 표본 (파생값과 무관하게 항상 검사한다)
// ★스크럽 함수 안의 길이 기반 조기반환을 적발하는 정적 기준. 숫자 하한 100 은
//   정당한 짧은 가드(s.length > 0 · < 2 등)를 오탐하지 않기 위한 것이다.
const LEN_GUARD_RE = /\.\s*length\s*(?:>=|>|<=|<)\s*(\d{3,})|(\d{3,})\s*(?:>=|>|<=|<)\s*[A-Za-z_$][\w$]*\s*\.\s*length/;
const DEEP_DEPTHS = [8, 15, 30, 120];            // ★v7.64 관통4 — 재귀 깊이 제한 적발
const DEEP_EXTREME = 6000;                       // ★스택 한계 초과 구간 (fail-closed 경계 보존)

// ★R5-4 — T1 정규식 소스 동일성 pin. R4-3 이 확정한 형태다.
//   ★결정 49 주의: 이 pin 은 「능력 주장」이 아니라 「변경 감지기」다. 정규식을 더 강하게 바꿀 때는
//   pin 도 함께 갱신하는 것이 정상 절차이며, 능력 자체는 G6 의 난수 canary 가 실측으로 증명한다.
const T1_RE_SRC_PIN = '/[ \\t]*SRC[_\\-.＿][A-Za-z0-9_\\-.＿]+/gi';

// ★R5-2 — D출구 raw 값 화이트리스트. falsy 블랙리스트는 우회 가능하므로 허용 리터럴만 인정한다.
const D_EXIT_RAW_ALLOW = ["'[PARSE_FAILED]'", '"[PARSE_FAILED]"'];
const D_EXIT_SENTINEL = '[PARSE_FAILED]';

// ★R5-2 — 출구 행에서 LLM/상류 원문을 실어 나를 수 있는 오염 식별자.
//   숫자 상태코드(response.status · resp.status)는 오염이 아니다.
const TAINT_RE = /\btext\b|\bparsed\b|\braw\b|errText|\.\s*message\b|\bbody\b|\.\s*text\s*\(|\bdata\b/;
const SCRUB_CALL_RE = /scrubText\s*\(|scrubDeep\s*\(/;

// ──────────────────────────────────────────────────────────────
// 1. ★R5-2 문자단위 주석 스캐너 — 행 끝 주석까지 제거한다.
//    L8: 블록 주석 정규식은 문자열 안의 토큰을 오인해 구간을 통째로 지우는 fail-open 을 만든다.
//    문자열·템플릿·정규식 리터럴 상태를 추적하고, 제거 구간의 건전성을 SELF-SCAN 이 증명한다.
// ──────────────────────────────────────────────────────────────
const RX_KEYWORDS = ['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void',
  'throw', 'case', 'do', 'else', 'yield', 'await'];

function stripComments(src) {
  const s = String(src);
  const n = s.length;
  const keep = new Array(n).fill(true);
  const spans = [];
  let i = 0, prevSig = '', prevWord = '';
  const tstack = [];
  function regexAllowed() {
    if (prevSig === '') return true;
    if (prevSig === ')' || prevSig === ']') return false;
    if (/[A-Za-z0-9_$]/.test(prevSig)) return RX_KEYWORDS.indexOf(prevWord) !== -1;
    return true;
  }
  while (i < n) {
    const c = s[i], d = s[i + 1];
    if (c === '/' && d === '/') {
      let j = i; while (j < n && s[j] !== '\n') j++;
      spans.push([i, j]); for (let k = i; k < j; k++) keep[k] = false; i = j; continue;
    }
    if (c === '/' && d === '*') {
      let j = i + 2; while (j < n && !(s[j] === '*' && s[j + 1] === '/')) j++;
      j = Math.min(n, j + 2);
      spans.push([i, j]);
      for (let k = i; k < j; k++) if (s[k] !== '\n') keep[k] = false;   // 행 수 보존
      i = j; continue;
    }
    if (c === "'" || c === '"') {
      const q = c; let j = i + 1;
      while (j < n) { if (s[j] === '\\') { j += 2; continue; } if (s[j] === q || s[j] === '\n') break; j++; }
      i = Math.min(n, j + 1); prevSig = q; prevWord = ''; continue;
    }
    if (c === '`') {
      let j = i + 1, opened = false;
      while (j < n) {
        if (s[j] === '\\') { j += 2; continue; }
        if (s[j] === '`') break;
        if (s[j] === '$' && s[j + 1] === '{') { tstack.push(1); i = j + 2; prevSig = '{'; prevWord = ''; opened = true; break; }
        j++;
      }
      if (opened) continue;
      if (j < n && s[j] === '`') { i = j + 1; prevSig = '`'; prevWord = ''; continue; }
      i = n; continue;
    }
    if (c === '}' && tstack.length) {
      tstack.pop();
      let j = i + 1, opened = false;
      while (j < n) {
        if (s[j] === '\\') { j += 2; continue; }
        if (s[j] === '`') break;
        if (s[j] === '$' && s[j + 1] === '{') { tstack.push(1); j += 2; opened = true; break; }
        j++;
      }
      if (opened) { i = j; prevSig = '{'; prevWord = ''; continue; }
      if (j < n && s[j] === '`') { i = j + 1; prevSig = '`'; prevWord = ''; continue; }
      i = j; prevSig = '{'; prevWord = ''; continue;
    }
    if (c === '/' && regexAllowed()) {
      let j = i + 1, cls = false, ok = false;
      while (j < n) {
        const e = s[j];
        if (e === '\\') { j += 2; continue; }
        if (e === '\n') break;
        if (cls) { if (e === ']') cls = false; j++; continue; }
        if (e === '[') { cls = true; j++; continue; }
        if (e === '/') { ok = true; break; }
        j++;
      }
      if (ok) { j++; while (j < n && /[a-z]/.test(s[j])) j++; i = j; prevSig = '/'; prevWord = ''; continue; }
    }
    if (/\S/.test(c)) { prevSig = c; if (/[A-Za-z0-9_$]/.test(c)) prevWord += c; else prevWord = ''; }
    i++;
  }
  let out = '';
  for (let k = 0; k < n; k++) out += keep[k] ? s[k] : (s[k] === '\n' ? '\n' : ' ');
  return { out: out, spans: spans };
}

// ──────────────────────────────────────────────────────────────
// 2. 지연 로드 — 톱레벨 즉시 호출 0건 (L2)
// ──────────────────────────────────────────────────────────────
// ★v7.64 관통10 — 「환경변수 하나로 검사 대상이 정해진다」를 적발하려면 정규 탐색 결과와
//   환경변수 지정값을 **따로** 들고 있어야 한다. 둘이 어긋나면 리다이렉션이다(S7 이 판정).
const FRONT_DISCOVERED = lazy(() => {
  let dir = __dirname;
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, 'api', 'fortune.js')) && fs.existsSync(path.join(dir, 'index.html'))) return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
});
const FRONT_FROM_ENV = lazy(() => {
  const env = process.env.CHUNWOON_FRONT_ROOT;
  return (env && fs.existsSync(path.join(env, 'api', 'fortune.js'))) ? env : null;
});
const FRONT_ROOT = lazy(() => FRONT_FROM_ENV() || FRONT_DISCOVERED());

// ★v7.64 관통11 — 외부 pin 표. eval 이 스스로 읽는다(직접 실행 경로 방어).
const PINS = lazy(() => {
  const p = path.join(__dirname, PINS_REL);
  if (!fs.existsSync(p)) throw new Error('외부 pin 파일 부재: ' + p + ' — 판정 불가(통과 아님)');
  const buf = fs.readFileSync(p);
  const j = JSON.parse(buf.toString('utf8'));
  if (!j || typeof j !== 'object' || !j.evals) throw new Error('외부 pin 파일 파손: evals 부재');
  j.__sha256 = sha256(buf);
  return j;
});

const WL = lazy(() => {
  const p = R(WL_REL);
  if (!fs.existsSync(p)) throw new Error('화이트리스트 부재: ' + WL_REL + ' — 판정 불가(통과 아님)');
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!j || typeof j !== 'object') throw new Error('화이트리스트 파손: 객체가 아님');
  if (!j.source_classes || typeof j.source_classes !== 'object') throw new Error('화이트리스트 파손: source_classes 부재');
  return j;
});

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

const FORTUNE = lazy(() => {
  const root = FRONT_ROOT();
  if (!root) throw new Error('front_root 미해석 — CHUNWOON_FRONT_ROOT 를 지정하거나 프런트 리포 하위에서 실행하십시오');
  const p = path.join(root, 'api', 'fortune.js');
  if (!fs.existsSync(p)) throw new Error(FORTUNE_REL + ' 부재: ' + p);
  const buf = fs.readFileSync(p);
  const raw = buf.toString('utf8');
  if (typeof raw !== 'string' || raw.length < 2) throw new Error(FORTUNE_REL + ' 내용 파손');
  const st = stripComments(raw);
  return {
    path: p, raw: raw, buf: buf, sha256: sha256(buf),
    bytes: buf.length, lines: raw.split(/\r?\n/),
    cj: st.out, cjLines: st.out.split(/\r?\n/), spans: st.spans
  };
});

// ──────────────────────────────────────────────────────────────
// 2-b. ★v7.64 — 검사 파라미터를 검사 대상에서 파생시킨다 (하드코딩 금지)
//   관통 1: 표본 상한이 2000자로 못박혀 있어 maxTokens 7000(=수천 자) 응답 구간이 무검사였다.
//   관통 2: 게이트가 구동하는 type 이 2종뿐이라 나머지 27종이 무검사였다.
//   ⟹ 둘 다 api/fortune.js 소스에서 파생한다. 대상이 늘면 검사도 자동으로 늘어난다.
//   ⟹ 파싱이 실패하면 예외를 던진다(= 판정 불가 = FAIL). 「못 찾았으니 0건」은 통과가 아니다.
// ──────────────────────────────────────────────────────────────
const MAX_TOKENS = lazy(() => {
  const cj = FORTUNE().cj;
  const rx = /max_?[Tt]okens\s*[:=]\s*(\d+)/g;
  const vals = [];
  let m;
  while ((m = rx.exec(cj)) !== null) {
    const v = parseInt(m[1], 10);
    if (Number.isFinite(v) && v > 0) vals.push(v);
  }
  if (vals.length < HARD.maxtokens_assign_min) {
    throw new Error('maxTokens 배정 ' + vals.length + '건 < 하한 ' + HARD.maxtokens_assign_min + ' — 파싱 실패(판정 불가)');
  }
  const max = Math.max.apply(null, vals);
  if (!(max >= HARD.maxtokens_cap_min)) {
    throw new Error('maxTokens 최대값 ' + max + ' < 하한 ' + HARD.maxtokens_cap_min + ' — 파싱 신뢰 불가');
  }
  return { list: vals, max: max, chars: max * TOKEN_TO_CHAR };
});
// 장문 표본 길이 집합 = 규격 하한 2점 + 파생 상한의 0.5·1.0·1.5배
const LONG_SAMPLE_LENS = lazy(() => {
  const cap = MAX_TOKENS().chars;
  const out = [];
  const push = (n) => { const v = Math.round(n); if (v > 0 && out.indexOf(v) === -1) out.push(v); };
  for (const f of LONG_FLOOR_LENS) push(f);
  for (const k of LONG_MULTIPLIERS) push(cap * k);
  push(Math.max(LONG_ABS_CAP, Math.round(cap * 1.5)));   // ★R11-5 절대 상한과 파생값의 max
  out.sort((a, b) => a - b);
  return out;
});
// 지원 type 전건 — else-if 사슬의 type === '...' 비교에서 파생
const TYPES = lazy(() => {
  const cj = FORTUNE().cj;
  const rx = /type\s*===\s*['"]([A-Za-z0-9_]+)['"]/g;
  const out = [];
  let m;
  while ((m = rx.exec(cj)) !== null) if (out.indexOf(m[1]) === -1) out.push(m[1]);
  if (out.length < HARD.types_min) {
    throw new Error('지원 type 파싱 ' + out.length + '종 < 하한 ' + HARD.types_min + ' — 파싱 실패(판정 불가)');
  }
  return out;
});

// ★v7.66 R11-1 (A축 관통 A·B 수리) — 「type 을 소비하는 **모든** 실행 경로가 검사된다」
//   【실측된 문제】 구 TYPES() 는 /type\s*===\s*'x'/ 한 형태만 봤다. 그래서
//     ① `DEEP_TYPES.includes(type)` 배열 분기(관통 A)와 ② `'x' === type` 역순 비교(관통 B)가
//     **검사 대상 집합에 애초에 들어오지 않았다.** M11·M12 는 「파싱된 것」만 구동하므로
//     파서가 못 본 분기는 조용히 빠졌고 실제로 본문이 전건 유출되면서 62/62 fail=0 이었다.
//   【수리】 비교 **형태**를 열거하지 않고 「type 과 대조되는 문자열 리터럴 전건」이라는 성질로 모은다.
//     순서 무관 비교 · switch/case · 배열 집합 판별(식별자 경유 포함) · 접두/접미 판별을 덮는다.
//   ★그래도 계산된 문자열(런타임 조립)은 정적으로 알 수 없다. 그 구멍은 M15 의 **미지 type 구동**과
//     M14 의 **정적 오염-출구 화이트리스트**가 이중으로 막는다(어느 하나에 의존하지 않는다).
const TYPES_EXT = lazy(() => {
  const cj = FORTUNE().cj;
  const out = [];
  const add = (v) => { if (typeof v === 'string' && v.length > 0 && out.indexOf(v) === -1) out.push(v); };
  const strAll = (seg) => {
    const r = [];
    const rx = /'([^'\n]*)'|"([^"\n]*)"/g;
    let m;
    while ((m = rx.exec(String(seg))) !== null) r.push(m[1] !== undefined ? m[1] : m[2]);
    return r;
  };
  let m;
  // ①직접 비교 — 좌우 순서 무관 (=== 와 == 둘 다)
  const rxA = /\btype\s*===?\s*['"]([^'"\n]+)['"]/g;
  while ((m = rxA.exec(cj)) !== null) add(m[1]);
  const rxB = /['"]([^'"\n]+)['"]\s*===?\s*\btype\b/g;
  while ((m = rxB.exec(cj)) !== null) add(m[1]);
  // ②switch (type) { case 'x': }
  if (/switch\s*\([^)\n]*\btype\b[^)\n]*\)/.test(cj)) {
    const rxS = /\bcase\s+['"]([^'"\n]+)['"]\s*:/g;
    while ((m = rxS.exec(cj)) !== null) add(m[1]);
  }
  // ③집합 판별 — 인라인 배열 리터럴
  const rxD = /\[([^\]\n]*)\]\s*\.\s*(?:includes|indexOf)\s*\(\s*type\s*[,)]/g;
  while ((m = rxD.exec(cj)) !== null) for (const v of strAll(m[1])) add(v);
  // ③-b 집합 판별 — 식별자 경유(선언부의 문자열 리터럴을 되짚는다)
  const rxC = /([A-Za-z_$][\w$]*)\s*\.\s*(?:includes|indexOf|has)\s*\(\s*type\s*[,)]/g;
  while ((m = rxC.exec(cj)) !== null) {
    const nm = m[1];
    const dm = cj.match(new RegExp('(?:const|let|var)\\s+' + nm + '\\s*=\\s*([^;]*)'));
    if (dm) for (const v of strAll(dm[1])) add(v);
  }
  // ③-c 객체 맵 경유 — MAP[type] · MAP\u005Btype\u005D 의 키 전건
  const rxM = /([A-Za-z_$][\w$]*)\s*\[\s*type\s*\]/g;
  while ((m = rxM.exec(cj)) !== null) {
    const nm = m[1];
    const dm = cj.match(new RegExp('(?:const|let|var)\\s+' + nm + '\\s*=\\s*\\{([^}]*)'));
    if (dm) {
      const rxK = /(?:'([^'\n]+)'|"([^"\n]+)"|([A-Za-z_$][\w$]*))\s*:/g;
      let k;
      while ((k = rxK.exec(dm[1])) !== null) add(k[1] || k[2] || k[3]);
    }
  }
  // ④접두·접미 판별 — 완전 문자열을 알 수 없으므로 판별식을 만족하는 탐침을 만든다
  const rxP = /\btype\s*\.\s*(startsWith|endsWith|includes|indexOf)\s*\(\s*['"]([^'"\n]+)['"]/g;
  while ((m = rxP.exec(cj)) !== null) {
    const kind = m[1], lit = m[2];
    add(lit);
    if (kind === 'startsWith' || kind === 'includes' || kind === 'indexOf') add(lit + '_cwprobe');
    if (kind === 'endsWith' || kind === 'includes' || kind === 'indexOf') add('cwprobe_' + lit);
  }
  if (out.length < HARD.types_ext_min) {
    throw new Error('확장 type 파싱 ' + out.length + '종 < 하한 ' + HARD.types_ext_min + ' — 파싱 실패(판정 불가)');
  }
  return out;
});
// type 별 입력 스키마가 다르므로 전 필드를 합집합으로 채운 고정 fixture 를 쓴다.
// ★프롬프트 조립이 던지면 F출구(500)로 빠져 C출구가 무검사가 되므로, 배열·객체 필드를 반드시 채운다.
const TYPE_FEATURES = {
  shape: '계란형', measurements: { ratio: 0.82, width: 140, height: 170 },
  eyes: '큰 눈', nose: '곧은 코', mouth: '단정한 입', forehead: '넓은 이마', ratio: 0.82
};
const TYPE_CONTEXT = {
  cards: (function () {
    const a = [];
    for (let i = 0; i < 10; i++) a.push({ name: 'Card' + i, reversed: i % 2 === 0, kind: 'major', suit: 'cups', suitName: '컵', up: '상승', rev: '하강', theme: '주제', court: '' });
    return a;
  })(),
  // ★v7.72 (결정 83) — 실제 프런트가 보내는 원국 입력 계약을 픽스처에 반영한다.
  //   근거: index.html:1705 `inputYear=b.getFullYear(), inputMonth=..., inputDay=...`
  //         index.html:1763 payload 조립 · index.html:1764 `hourLabel`
  //   ★이 필드가 없으면 v7.72 의 ctxguard fail-closed 가 400(NO_BIRTH_FIELDS)을 낸다.
  //     종전 픽스처는 `ilgan`(원국 키)만 보내고 생년월일은 `birth` 문자열로만 줬는데,
  //     그것은 **어떤 클라이언트도 보내지 않는 조합**이었다 — 손으로 지어낸 픽스처였다.
  calType: 'solar', inputYear: 1990, inputMonth: 1, inputDay: 1, hourLabel: '오시',
  category: 'love', question: '올해 흐름은 어떤가요', ilgan: '甲', ilganElement: '木', dominant: '火', lacking: '水',
  surname: '김', gender: '남', birth: '1990-01-01', birthDate: '1990-01-01', birthTime: '12:00',
  dream: '용이 하늘로 오르는 꿈', keyword: '성장', companyName: '천운', businessType: 'IT',
  productName: '제품명', petType: '강아지', nickname: '별명', name: '홍길동', year: 2026, mode: 'a',
  person1: { name: 'A', birth: '1990-01-01' }, person2: { name: 'B', birth: '1992-02-02' },
  ilju: '甲子', saju: { year: '甲子', month: '乙丑', day: '丙寅', hour: '丁卯' },
  pillars: ['甲子', '乙丑', '丙寅', '丁卯'], candidates: [{ name: '가나', hanja: '佳娜' }]
};

// ──────────────────────────────────────────────────────────────
// 3. ★R5-1 — 파일 전체 ESM import + handler 실구동
//    ★검사 대상은 반드시 front_root 의 실제 바이트다. .mjs 사본을 만드는 이유는 프런트 리포의
//      package.json 에 type:module 이 없어 .js 확장자가 CJS 로 해석되기 때문이며,
//      사본의 sha256 이 원본과 동일함을 S5 가 증명한다(사본 조작 경로 봉쇄).
// ──────────────────────────────────────────────────────────────
const RT = { loaded: false, error: null, handler: null, copyPath: null, copySha: null, srcSha: null, importMs: 0,
  fetchShim: null, fetchAtImport: null, fetchInstalledBeforeImport: false, fetchIdentityBroken: false, envKeyAtImport: null,
  bundleFiles: [], bundleDir: null, siblingsCopied: 0, localImports: [], bundleErr: null };

async function loadHandler() {
  if (RT.loaded) return RT;
  RT.loaded = true;
  // ★v7.64 관통 8·9 — fetch 교체와 환경변수 주입을 import **이전에** 끝낸다.
  //   그래야 모듈 톱레벨에서 잡은 fetch 참조·API 키가 호출 시점의 것과 같아진다(지문 소멸).
  try {
    installFetchShim();
    RT.fetchInstalledBeforeImport = true;
    process.env.ANTHROPIC_API_KEY = GATE_ENV().key;
    RT.envKeyAtImport = process.env.ANTHROPIC_API_KEY;
    // ★v7.66 R11-FIX — 프리미엄 시크릿도 import **이전에** 심는다(키와 같은 이유 · 모듈 톱레벨에서
    //   env 를 잡아 두는 구현이 나와도 「적재 시 != 호출 시」 판별자가 생기지 않게).
    process.env.CW_PREMIUM_HMAC_SECRET = GATE_ENV().premiumSecret;
    RT.envSecretAtImport = process.env.CW_PREMIUM_HMAC_SECRET;
  } catch (e) { RT.error = '환경 준비 실패(fail-closed): ' + ((e && e.message) || String(e)); return RT; }
  try {
    const f = FORTUNE();
    RT.srcSha = f.sha256;
    // ★v7.66 R11-4 (A축 관통 F 수리) — 「검사 대상은 **배포 번들 형상 그대로**」
    //   【실측된 문제】 구 로더는 fortune.js **단일 파일**만 .mjs 로 개명 복사해 import 했다.
    //     그래서 `await import('./policy_ext.js')` 로 형제 모듈의 정책을 읽어 스크럽을 통과 모드로
    //     돌리는 관통이 게이트에서는 **import 실패 → 기본 스크럽**으로 보였다. .vercelignore 는
    //     `!/api` 로 api/ 전체를 배포에 포함하므로 실서비스에는 그 형제가 존재한다.
    //   【수리】 api/ 디렉터리 전건을 임시 트리에 **같은 이름·같은 상대 경로**로 복사하고,
    //     type:module 인 package.json 을 심어 .js 그대로 ESM 으로 적재한다.
    //     ⟹ 형제 모듈 · 상대 import 가 배포와 동일하게 해석된다.
    //   ★부수 효과(R11-2): 개명이 사라져 import 경로에서 'fortune_under_test' 지문이 제거된다.
    const dir = CWTMP.mk('cw_scrub_');
    const bundle = path.join(dir, 'api');
    fs.mkdirSync(bundle);
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ type: 'module' }) + '\n');
    const apiDir = path.dirname(f.path);
    // ★v7.70 수리 — 종전 복사기는 **1단계 파일만** 옮기고 하위 디렉터리를 건너뛰었다.
    //   위 주석이 선언한 성질(「api/ 디렉터리 전건을 같은 상대 경로로」)과 실제가 어긋나 있었고,
    //   api/_engine/bind.js 를 도입하자 S10 이 그 괴리를 적발했다(실측 2026-08-01).
    //   ⟹ 선언대로 **재귀 복사**한다. 판정 성질은 그대로이며 검사 범위만 선언과 일치시킨다.
    //   ★bundleFiles 에는 api/ 기준 **상대 경로**를 넣는다(basename 충돌 회피).
    try {
      const walk = (srcDir, dstDir, prefix) => {
        fs.mkdirSync(dstDir, { recursive: true });
        for (const nm of fs.readdirSync(srcDir)) {
          if (nm === 'node_modules') continue;
          const src = path.join(srcDir, nm);
          let st = null;
          try { st = fs.statSync(src); } catch (e) { continue; }
          const rel = prefix ? prefix + '/' + nm : nm;
          if (st.isDirectory()) { walk(src, path.join(dstDir, nm), rel); continue; }
          if (!st.isFile()) continue;
          fs.copyFileSync(src, path.join(dstDir, nm));
          RT.bundleFiles.push(rel);
          if (rel !== path.basename(f.path)) RT.siblingsCopied++;
        }
      };
      walk(apiDir, bundle, '');
    } catch (e) { RT.bundleErr = 'api/ 번들 복사 실패: ' + ((e && e.message) || String(e)); }
    RT.bundleDir = bundle;
    const cp = path.join(bundle, path.basename(f.path));
    fs.writeFileSync(cp, f.buf);                      // ★바이트 사본 (변환 0)
    RT.copyPath = cp;
    RT.copySha = sha256(fs.readFileSync(cp));
    // ★fortune.js 가 실제로 끌어오는 로컬 모듈 목록 — S10 이 번들 포함 여부를 대조한다.
    const impRx = /(?:import\s*\(\s*|from\s+|import\s+)['"](\.[^'"\n]+)['"]/g;
    let im;
    while ((im = impRx.exec(f.cj)) !== null) if (RT.localImports.indexOf(im[1]) === -1) RT.localImports.push(im[1]);
    const t0 = Date.now();
    RT.fetchAtImport = globalThis.fetch;
    const mod = await import('file://' + cp.split(path.sep).join('/'));
    RT.importMs = Date.now() - t0;
    if (!mod || typeof mod.default !== 'function') {
      throw new Error('export default 가 함수가 아님: ' + (mod ? typeof mod.default : 'no module'));
    }
    RT.handler = mod.default;
  } catch (e) {
    RT.error = (e && e.message) ? e.message : String(e);
  }
  return RT;
}

// ──────────────────────────────────────────────────────────────
// 3-b. ★v7.64 관통5 — 반환 수단 전건 관측
//   구 스텁은 write() 를 버리고 판정에 JSON.stringify(body) 만 썼다. 헤더·write·end·send 로
//   원문을 실어 보내면 44/44 통과였다(A축 관통 5). 채널 전건을 dump 에 합친다.
//   ★깊은 중첩은 JSON.stringify 가 스택을 넘길 수 있으므로 반복형 평탄화로 대체한다(공허 통과 차단).
// ──────────────────────────────────────────────────────────────
const FLAT_SEP = '\u0001';   // ★제어문자는 이스케이프 표기 — 값 경계를 넘긴 오탐 차단
function flat(v) {
  const out = [];
  const stack = [v];
  let guard = 0;
  while (stack.length > 0 && guard < 400000) {
    guard++;
    const x = stack.pop();
    if (x === null || x === undefined) continue;
    const t = typeof x;
    if (t === 'string') { out.push(x); continue; }
    if (t === 'number' || t === 'boolean') { out.push(String(x)); continue; }
    if (Array.isArray(x)) { for (let i = x.length - 1; i >= 0; i--) stack.push(x[i]); continue; }
    if (t === 'object') { for (const k of Object.keys(x)) { out.push(k); stack.push(x[k]); } continue; }
  }
  return out.join(FLAT_SEP);
}
function bodyDump(b) {
  let j = null;
  try { j = JSON.stringify(b); } catch (e) { j = null; }
  return (typeof j === 'string') ? j : flat(b);
}
// ★v7.66 R11-3 (A축 관통 E 수리) — 「핸들러가 원문을 **어떤 사이드채널로도** 방출하지 않는다」
//   【실측된 문제】 구 dump 는 body·headers·writes·sent·endArgs·code 6종만 평탄화했다.
//     ⟹ ①stdout/stderr(console.log) 는 **관측 대상이 아니었고** ②mkRes 스텁에 statusMessage 필드가
//     없어 그 채널이 dump 에 실리지 않았다. 실측: `console.log('[fortune] upstream raw =', text)` 를
//     심으면 게이트 stdout 에 원문이 **496행 직접 출력**되면서 eval 은 62/62 fail=0.
//     프로덕션에서는 Vercel 로그로 원문이 그대로 나간다.
//   【수리】 반환 수단이 아니라 **방출 수단 전건**을 관측한다. 로그·상태문구·트레일러·소켓까지 합친다.
//   ★M13 의 관측 증명(probe)이 각 채널을 실제로 본다는 것을 매 실행 증명한다 — 관측 부재로 인한
//     공허 통과를 차단한다. 채널을 늘리기만 하고 증명하지 않으면 v7.65 와 같은 실패가 반복된다.
function channelDump(st) {
  return bodyDump(st.body) +
    FLAT_SEP + 'HEADERS' + FLAT_SEP + flat(st.headers) +
    FLAT_SEP + 'WRITE' + FLAT_SEP + flat(st.writes) +
    FLAT_SEP + 'SEND' + FLAT_SEP + flat(st.sent) +
    FLAT_SEP + 'END' + FLAT_SEP + flat(st.endArgs) +
    FLAT_SEP + 'CODE' + FLAT_SEP + String(st.code) +
    FLAT_SEP + 'STATUSMSG' + FLAT_SEP + String(st.statusMessage == null ? '' : st.statusMessage) +
    FLAT_SEP + 'TRAILERS' + FLAT_SEP + flat(st.trailers) +
    FLAT_SEP + 'SOCKET' + FLAT_SEP + flat(st.socketWrites) +
    FLAT_SEP + 'LOG' + FLAT_SEP + flat(st.logs);
}

// res 스텁 — status()/json()/setHeader()/writeHead()/end()/send()/write() 를 전부 기록한다.
function mkRes() {
  const st = { code: null, body: null, headers: {}, ended: false, calls: [], writes: [], sent: [], endArgs: [],
    statusMessage: null, trailers: {}, socketWrites: [], logs: [] };
  const r = {
    setHeader: (k, v) => { st.headers[String(k)] = v; st.calls.push('setHeader'); return r; },
    getHeader: (k) => st.headers[String(k)],
    getHeaders: () => { const o = {}; for (const k of Object.keys(st.headers)) o[k] = st.headers[k]; return o; },
    getHeaderNames: () => Object.keys(st.headers),
    hasHeader: (k) => Object.prototype.hasOwnProperty.call(st.headers, String(k)),
    flushHeaders: () => { st.calls.push('flushHeaders'); return r; },
    // ★R11-3 — 실제 ServerResponse 표면. 스텁에 없는 표면은 그대로 「무검사 채널」이 된다.
    addTrailers: (t) => {
      st.calls.push('addTrailers');
      if (t && typeof t === 'object') for (const k of Object.keys(t)) st.trailers[String(k)] = t[k];
      return r;
    },
    socket: {
      write: (c) => { if (c !== undefined) st.socketWrites.push(c); return true; },
      end: (c) => { if (c !== undefined) st.socketWrites.push(c); return true; },
      destroy: () => undefined
    },
    removeHeader: (k) => { delete st.headers[String(k)]; st.calls.push('removeHeader'); return r; },
    writeHead: (c, a, b) => {
      st.code = c; st.calls.push('writeHead');
      // ★Node 규격 writeHead(statusCode[, statusMessage][, headers]) — 3인자 형태의 2번째 인자가
      //   statusMessage 다. 구 스텁은 2번째를 무조건 헤더로 봐서 이 채널이 통째로 사각이었다.
      let h = b;
      if (typeof a === 'string') st.statusMessage = a;
      else if (a && typeof a === 'object') h = a;
      if (h && typeof h === 'object') for (const k of Object.keys(h)) st.headers[String(k)] = h[k];
      return r;
    },
    status: (c) => { st.code = c; st.calls.push('status'); return r; },
    json: (b) => { st.body = b; st.ended = true; st.calls.push('json'); return r; },
    send: (b) => { st.body = b; st.sent.push(b); st.ended = true; st.calls.push('send'); return r; },
    end: (b) => { if (b !== undefined) { st.body = b; st.endArgs.push(b); } st.ended = true; st.calls.push('end'); return r; },
    write: (c) => { if (c !== undefined) st.writes.push(c); st.calls.push('write'); return r; }
  };
  // ★res.statusMessage 는 필드가 아니라 접근자로 둔다 — 대입이 곧 관측이 된다.
  Object.defineProperty(r, 'statusMessage', {
    get: () => st.statusMessage,
    set: (v) => { st.statusMessage = v; st.calls.push('statusMessage'); },
    enumerable: true, configurable: true
  });
  Object.defineProperty(r, 'statusCode', {
    get: () => st.code,
    set: (v) => { st.code = v; st.calls.push('statusCode'); },
    enumerable: true, configurable: true
  });
  return { r: r, st: st };
}

// ★v7.66 R11-FIX — 상류 도달 횟수 계측기. 「관문이 LLM 호출 **앞**에 있는가」는
//   응답 본문만으로는 증명되지 않는다(비용은 이미 나갔는데 응답만 깨끗할 수 있다).
function counted(impl) {
  const box = { n: 0 };
  box.fn = async function () { box.n++; return impl.apply(null, Array.prototype.slice.call(arguments)); };
  return box;
}
// fetch 모킹 — Anthropic 응답 주입 (★교체는 slot 값만 바꾼다. globalThis.fetch 참조는 불변)
function fetchOk(text, status) {
  return async () => ({
    ok: true, status: status || 200,
    json: async () => ({ content: [{ type: 'text', text: String(text) }] }),
    text: async () => String(text)
  });
}
function fetchNotOk(status, upstreamText) {
  return async () => ({
    ok: false, status: status || 502,
    json: async () => ({ error: String(upstreamText) }),
    text: async () => String(upstreamText)
  });
}
function fetchThrow(msg) { return async () => { throw new Error(String(msg)); }; }

// ──────────────────────────────────────────────────────────────
// 3-c. ★v7.64 관통 6~9 — 게이트 환경 지문 제거
//   구 drive() 는 ①import 이후에 globalThis.fetch 를 교체하고 ②상수 API 키·상수 host 를 심었다.
//   그 결과 「적재 시 fetch != 호출 시 fetch」·「키 == 상수」가 **게이트에서만 성립하는 판별자**가 되어
//   조건부 게이팅으로 44/44 통과가 가능했다(v7.62 sloppy/strict 판별자의 재발).
//   ⟹ fetch 는 import **이전에** 고정 디스패처로 교체하고 이후 절대 바꾸지 않는다(참조 동일성 불변).
//   ⟹ API 키·host 는 매 실행 난수화한다(이 파일 어디에도 리터럴로 존재하지 않음 — D3 가 실측).
// ──────────────────────────────────────────────────────────────
const FETCH_SLOT = { impl: null };
// ★v7.66 R11-2 (A축 관통 C·D 부분 수리) — 게이트가 **자기 개명 사실**을 지문으로 남기지 않는다.
//   실측 지문: fetch.name === 'chunwoonGateFetch' · mkShiftedDate 의 .name === 'ShiftedDate'.
//   전자는 `if (fetch.name === 'fetch') return s;` 조건부 게이팅에, 후자는 시한폭탄
//   `Date.name === 'Date' && year >= 2027` 이 **절대 참이 되지 않게** 만드는 데 쓰였다.
//   ⟹ 이름과 toString 을 네이티브와 동형으로 맞춘다.
//   ★정직한 한계(§4-1): 지문 축은 이것뿐이 아니다(argv · import.meta · 스택 · cwd · 모듈 해석).
//     하나를 지우면 다른 축을 쓴다. 이것은 **개연성을 낮추는 조치**이지 닫는 조치가 아니다.
function nativeMask(fn, name) {
  try {
    Object.defineProperty(fn, 'name', { value: name, configurable: true });
    Object.defineProperty(fn, 'toString', {
      value: function () { return 'function ' + name + '() { [native code] }'; },
      writable: true, configurable: true
    });
  } catch (e) { /* 위장 실패 자체는 판정에 영향 없음 — D3 가 지문 부활을 따로 본다 */ }
  return fn;
}
function installFetchShim() {
  if (RT.fetchShim) return;
  const shim = function () {
    const f = FETCH_SLOT.impl;
    if (typeof f !== 'function') return Promise.reject(new Error('fetch 미구성(게이트 내부)'));
    return f.apply(null, Array.prototype.slice.call(arguments));
  };
  nativeMask(shim, 'fetch');
  RT.fetchShim = shim;
  globalThis.fetch = shim;
}
const GATE_ENV = lazy(() => ({
  key: 'sk-ant-api03-' + rtok(20, true) + '-' + rtok(14, false),
  host: rtok(9, true) + '.example.invalid',
  // ★v7.66 R11-FIX — 프리미엄 HMAC 시크릿도 매 실행 난수화한다(D3 의 「상수 지문 0건」 유지).
  //   64자 = 실배포 권장치(32바이트 hex)와 같은 자릿수.
  premiumSecret: rtok(32, true) + rtok(32, false)
}));

// ──────────────────────────────────────────────────────────────
// 3-c-2. ★v7.66 R11-FIX — 「정상 유료 사용자」 시뮬레이션
//
// 【실측된 문제】 P1-AUTH(안 B)가 api/fortune.js 에 프리미엄 HMAC 토큰 관문을 넣은 뒤,
//   게이트 하네스는 그 관문을 통과하지 못했다. 실측: 프리미엄 17종 전건 503(시크릿 부재) ·
//   `context:{}` 요청 전건 400(신규 hasContent 형상검사) ⟹ M2·M4·M7 이 200 응답을 전제로
//   `undefined.slice()` 를 하며 EXCEPTION · W1~G22 가 「반환형 오류(object)」로 무너졌다.
//   ★즉 「인증이 막아서 유출이 없다」는 상태였고, **유료 사용자 경로의 스크럽은 무검사**였다.
//
// 【수리 방침】 인증이 막아서 응답이 없으면 유출도 없다 — 그것은 이 게이트가 증명해야 할
//   성질이 아니다. 이 게이트의 존재 이유는 「**인증을 통과한 정상 결제 사용자 경로에서**
//   스크럽이 작동하는가」이다. 따라서 하네스가 결제 발급부(api/confirm-payment.js)와
//   **같은 규격**으로 토큰을 서명해 붙인다.
//
//   토큰 규격: cwp1.<b64url(payloadJSON)>.<b64url(HMAC-SHA256(b64url_payload, SECRET))>
//   페이로드 : { v:1, pk:<productKey>, ord, pay, amt, iat, exp, src }   TTL 30일
//   헤더     : x-cw-premium-token
//
// ★인증 **실패** 경로는 삭제하지 않는다 — M16 이 「무토큰 프리미엄은 차단되고 그 차단
//   응답에도 원문이 실리지 않는다」를 별도로 실측한다(P1-AUTH 무력화 탐지).
// ──────────────────────────────────────────────────────────────
const CW_TOKEN_TTL_MS = 30 * 24 * 3600 * 1000;
const b64u = (buf) => Buffer.from(buf).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
// 유료 type → productKey 결속 맵. ★검사 대상 소스에서 읽어 온다(하네스에 통짜로 적어두면
//   상품이 늘 때 게이트만 뒤처져 신규 프리미엄이 무검사로 남는다).
const PREMIUM_MAP = lazy(() => {
  const out = {};
  let cj = '';
  try { cj = FORTUNE().cj; } catch (e) { return out; }
  const m = cj.match(/PREMIUM_TYPE_TO_PRODUCT\s*=\s*\{([\s\S]{0,4000}?)\}\s*;/);
  if (!m) return out;
  const rx = /([A-Za-z_$][\w$]*)\s*:\s*['"]([^'"]+)['"]/g;
  let g;
  while ((g = rx.exec(m[1])) !== null) out[g[1]] = g[2];
  return out;
});
// ★맵 파싱이 실패해도 규약(<productKey>_premium_<n>)으로 유도한다. 틀린 pk 는 403 을 낳고
//   M11·M16 이 그것을 FAIL 로 계상하므로 어느 경로로도 조용한 통과가 되지 않는다(fail-closed).
function productKeyFor(type) {
  const mp = PREMIUM_MAP();
  if (Object.prototype.hasOwnProperty.call(mp, type)) return mp[type];
  const mm = /^(.+)_premium_\d+$/.exec(String(type));
  return mm ? mm[1] : null;
}
const isPremiumType = (t) => productKeyFor(t) !== null &&
  (Object.prototype.hasOwnProperty.call(PREMIUM_MAP(), t) || /_premium_\d+$/.test(String(t)));
// ★v7.67 — 상품 정가표도 검사 대상 소스에서 읽는다.
//   v7.66 하네스는 전 상품에 amt=4900 을 통짜로 박아, naming 계열 3종(정가 29900)에 대해
//   confirm-payment.js 가 원리적으로 발급할 수 없는 토큰을 만들고 있었다. 그 결과
//   M16 의 VALID_naming* 대조군은 유효 토큰을 넣었다고 믿으면서 실제로는 403 을 받고 있었다.
//   PREMIUM_MAP 과 동일 원칙으로 소스에서 유도한다. 파싱 실패 시 amt 가 어긋나 403 이 나고
//   M11·M16 이 FAIL 로 계상하므로 어느 경로로도 조용한 통과가 되지 않는다(fail-closed).
const PRODUCT_PRICE = lazy(() => {
  const out = {};
  let cj = '';
  try { cj = FORTUNE().cj; } catch (e) { return out; }
  const m = cj.match(/CW_PRODUCT_PRICE\s*=\s*\{([\s\S]{0,2000}?)\}\s*;/);
  if (!m) return out;
  const rx = /([A-Za-z_$][\w$]*)\s*:\s*(\d+)/g;
  let g;
  while ((g = rx.exec(m[1])) !== null) out[g[1]] = Number(g[2]);
  return out;
});
function priceFor(productKey) {
  const t = PRODUCT_PRICE();
  const k = String(productKey);
  return Object.prototype.hasOwnProperty.call(t, k) ? t[k] : 4900;
}
function mintPremiumToken(productKey, opts) {
  const o = opts || {};
  const now = (typeof o.now === 'number') ? o.now : Date.now();
  const payload = {
    v: (o.v === undefined) ? 1 : o.v,
    pk: (o.pk === undefined) ? String(productKey) : o.pk,
    ord: 'cwgate_' + rtok(10, true),
    pay: 'cwgate_' + rtok(12, true),
    amt: (o.amt === undefined) ? priceFor(productKey) : o.amt,
    iat: (o.iat === undefined) ? now - 1000 : o.iat,
    exp: (o.exp === undefined) ? now + CW_TOKEN_TTL_MS : o.exp,
    src: 'confirm'
  };
  const p = b64u(Buffer.from(JSON.stringify(payload), 'utf8'));
  const secret = o.secret || GATE_ENV().premiumSecret;
  const sig = b64u(crypto.createHmac('sha256', secret).update(p).digest());
  return (o.prefix === undefined ? 'cwp1' : o.prefix) + '.' + p + '.' + sig;
}
// 신규 hasContent() 는 「키 1개 이상인 plain object」를 요구한다. 빈 문맥으로 구동하던
// 구 하네스 호출부를 전부 고치는 대신, 요청 조립 지점 한 곳에서 형상을 맞춘다.
const DEFAULT_CONTEXT = { question: '올해 흐름은 어떤가요', mode: 'gate' };
function hasKeys(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 0;
}
// 시각 지문(시한폭탄) 제거용 — Date 를 통째로 이동시킨다.
function mkShiftedDate(RealDate, shiftMs) {
  class ShiftedDate extends RealDate {
    constructor() {
      if (arguments.length === 0) super(RealDate.now() + shiftMs);
      else super(...arguments);
    }
    static now() { return RealDate.now() + shiftMs; }
  }
  // ★R11-2 — 이동된 시계의 .name 이 'ShiftedDate' 이면 시한폭탄 조건이 절대 참이 안 된다(관통 D).
  //   D1 의 4환경 차분이 실제로 미래 시각을 **판별 불가하게** 흘려보내도록 네이티브와 동형화한다.
  return nativeMask(ShiftedDate, 'Date');
}

const DRIVEN_TYPES = new Set();

async function drive(req, fetchImpl, opts) {
  const o = opts || {};
  const rt = await loadHandler();
  if (rt.error || typeof rt.handler !== 'function') throw new Error('handler 미로드: ' + rt.error);
  const prevImpl = FETCH_SLOT.impl;
  const prevKey = process.env.ANTHROPIC_API_KEY;
  const prevSecret = process.env.CW_PREMIUM_HMAC_SECRET;
  const RealDate = globalThis.Date;
  FETCH_SLOT.impl = fetchImpl || fetchThrow('no fetch configured');
  process.env.ANTHROPIC_API_KEY = o.apiKey || GATE_ENV().key;
  // ★R11-FIX — 시크릿 부재 시나리오(M16)만 명시적으로 지운다. 그 밖에는 항상 설정 상태다.
  if (o.noSecret) delete process.env.CW_PREMIUM_HMAC_SECRET;
  else process.env.CW_PREMIUM_HMAC_SECRET = o.premiumSecret || GATE_ENV().premiumSecret;
  if (o.dateShiftMs) globalThis.Date = mkShiftedDate(RealDate, o.dateShiftMs);
  try {
    if (req && req.body && typeof req.body.type === 'string') DRIVEN_TYPES.add(req.body.type);
  } catch (e) { /* 구동 기록 실패는 판정에 영향 없음 */ }
  const { r, st } = mkRes();
  let threw = null;
  // ★R11-3 — stdout/stderr 는 「반환 수단」이 아니지만 **방출 수단**이다. 전역 후킹으로 캡처한다.
  //   ①console.* ②process.stdout/stderr.write 를 구동 구간에만 가로채고 반드시 원복한다.
  //   ★재출력하지 않는다 — 원문이 게이트 stdout 으로 나가면 그 자체가 유출 경로다.
  const CON_KEYS = ['log', 'error', 'warn', 'info', 'debug', 'trace', 'dir'];
  const prevCon = {};
  const prevOut = process.stdout.write;
  const prevErr = process.stderr.write;
  const cap = (v) => { try { st.logs.push(typeof v === 'string' ? v : flat(v)); } catch (e) { st.logs.push('[log 캡처 실패]'); } };
  try {
    for (const k of CON_KEYS) {
      prevCon[k] = console[k];
      console[k] = function () { for (let i = 0; i < arguments.length; i++) cap(arguments[i]); };
    }
    process.stdout.write = function (c) { cap(c); return true; };
    process.stderr.write = function (c) { cap(c); return true; };
    try { await rt.handler(req, r); } catch (e) { threw = (e && e.message) ? e.message : String(e); }
  } finally {
    process.stdout.write = prevOut;
    process.stderr.write = prevErr;
    for (const k of CON_KEYS) if (prevCon[k]) console[k] = prevCon[k];
  }
  globalThis.Date = RealDate;
  FETCH_SLOT.impl = prevImpl;
  if (prevKey === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = prevKey;
  if (prevSecret === undefined) delete process.env.CW_PREMIUM_HMAC_SECRET; else process.env.CW_PREMIUM_HMAC_SECRET = prevSecret;
  // ★fetch 참조가 구동 도중 바뀌면 지문이 되살아난 것이다 — D3 가 FAIL 시킨다.
  if (globalThis.fetch !== RT.fetchShim) RT.fetchIdentityBroken = true;
  return { code: st.code, body: st.body, headers: st.headers, ended: st.ended, threw: threw, dump: channelDump(st), st: st };
}

function reqOf(method, body, q, host, opts) {
  const o = opts || {};
  const headers = { host: host || GATE_ENV().host };
  let b = body || {};
  if (method === 'POST' && b && typeof b === 'object' && !Array.isArray(b)) {
    b = Object.assign({}, b);
    // ①형상 — features·context 중 하나는 키가 1개 이상이어야 한다(신규 hasContent 관문).
    if (!hasKeys(b.features) && !hasKeys(b.context)) {
      b.context = Object.assign({}, b.context, DEFAULT_CONTEXT);
    }
    // ②인증 — 프리미엄 type 이면 결제 발급부와 같은 규격의 유효 토큰을 붙인다.
    //   ★opts.noToken 이면 붙이지 않는다(M16 의 차단 경로 실측).
    const pk = isPremiumType(b.type) ? productKeyFor(b.type) : null;
    if (pk && !o.noToken) {
      headers['x-cw-premium-token'] = (typeof o.token === 'string')
        ? o.token : mintPremiumToken(pk, o.tokenOpts);
    }
  }
  return {
    method: method,
    url: '/api/fortune' + (q || ''),
    headers: headers,
    body: b
  };
}
const POST = (body) => reqOf('POST', body, '', null);
const GET = (q) => reqOf('GET', {}, q || '', null);

// ★B출구 경유 스크럽 실측 — daily_message 자연어 응답. 문자열이 아니면 null(=FAIL 유발).
async function viaB(text, opts) {
  const r = await drive(POST({ type: 'daily_message', context: {} }), fetchOk(text), opts);
  const t = r.body && r.body.result ? r.body.result.text : undefined;
  return typeof t === 'string' ? t : null;
}
// ★C출구 경유 스크럽 실측 — parsed 객체(값 + 키). 객체가 아니면 null.
async function viaC(obj, opts) {
  const r = await drive(POST({ type: 'tojeong', context: {} }), fetchOk(JSON.stringify(obj)), opts);
  const v = r.body && r.body.result;
  return (v && typeof v === 'object') ? v : null;
}
// C출구 단일 문자열 값 — trim 이 개입하지 않으므로 공백·탭·이모지 정확 보존 판정에 쓴다.
async function viaCValue(s) {
  const o = await viaC({ v: String(s) });
  return o && typeof o.v === 'string' ? o.v : null;
}

// ──────────────────────────────────────────────────────────────
// 4. IP 파생 — 문헌 목록의 SoT 는 IP/policy/claim_whitelist.json source_classes 다.
//    ★canary 를 이 파일에 통짜로 적어두면 「목록을 지우면 canary 도 사라지는」 자기무력화가 된다.
//      전건 IP 에서 파생하고, 원소 수 하한은 HARD 로 이중 pin 한다.
// ──────────────────────────────────────────────────────────────
const IP_CLASSES = lazy(() => {
  const sc = WL().source_classes || {};
  const out = [];
  const add = (r, kind) => {
    if (!r || typeof r.name !== 'string' || r.name === '') return;
    const hj = (typeof r.hanja === 'string' && r.hanja) ? r.hanja.split('|').map((t) => t.trim()).filter((t) => t) : [];
    out.push({ name: r.name, hanja: hj, kind: kind, productOk: r.product_name_use === '허용' });
  };
  for (const r of (sc.unregistered_10 || [])) add(r, 'unregistered');
  for (const r of (sc.excluded_registered_2 || [])) add(r, 'excluded');
  for (const r of (sc.registered_4 || [])) add(r, 'registered');
  return out;
});
// T2 전면금지 대상 = product_name_use 가 허용이 아닌 전건 (=토정비결만 제외됨)
const IP_T2 = lazy(() => IP_CLASSES().filter((c) => !c.productOk));
const IP_PRODUCT_OK = lazy(() => IP_CLASSES().filter((c) => c.productOk));
const IP_DERIVED = lazy(() => {
  const out = [];
  for (const c of IP_T2()) { out.push(c.name); for (const h of c.hanja) out.push(h); }
  return out;
});
const IP_HANJA = lazy(() => {
  const out = [];
  for (const c of IP_T2()) for (const h of c.hanja) out.push(h);
  return out;
});

// ★토큰 분할 지점 — 「앞토큰|뒤토큰」 경계. 혼합표기·구분자 삽입 canary 를 이 경계에서 만든다.
//   ★IP 에 새 문헌이 추가되면 여기 등재가 없어 P3 이 FAIL 한다(fail-closed 방향).
const TOKEN_SPLIT = {
  '마의상법': 2, '유장상법': 2, '신상전편': 2, '달마상법': 2, '오행상법': 2,
  '면부백세유년도': 4, '주공해몽': 2, '몽점일지': 2, '작명대전': 2, '만성통보': 2,
  '삼명통회': 2, '자평진전': 2, '적천수': 2, '궁통보감': 2, '연해자평': 2, '토정비결': 2
};

// ──────────────────────────────────────────────────────────────
// 5. ★R5-3 난수화 — 어미·위치·서지 ID 접미를 난수화해 「canary 형태 allowlist」(관통 6)를 죽인다.
//    시드는 출력에 남긴다(재현용). CW_CANARY_SEED 로 고정 가능.
// ──────────────────────────────────────────────────────────────
const SEED = (function () {
  const e = parseInt(process.env.CW_CANARY_SEED || '', 10);
  return (Number.isFinite(e) && e > 0) ? e : ((Date.now() ^ (process.pid * 2654435761)) >>> 0) || 12345;
})();
let _rs = SEED >>> 0;
function rnd() { _rs ^= _rs << 13; _rs >>>= 0; _rs ^= _rs >>> 17; _rs ^= _rs << 5; _rs >>>= 0; return _rs / 4294967296; }
function pick(a) { return a[Math.floor(rnd() * a.length) % a.length]; }
function rtok(n, lower) {
  const AL = lower ? 'abcdefghijkmnpqrstuvwxyz23456789' : 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = ''; for (let i = 0; i < n; i++) s += AL.charAt(Math.floor(rnd() * AL.length) % AL.length);
  return s;
}
const CARRIER_HEAD = ['해석 근거는 ', '참고한 자료: ', '풀이에 쓰인 ', '', '아래 내용은 ', '오늘 안내드릴 '];
const CARRIER_TAIL = [' 를 대조했습니다.', ' 에 따랐어요.', ' 내용을 옮깁니다.', ' 기준으로 보았습니다.', ' 자료입니다.', ''];
function carry(tok) { return pick(CARRIER_HEAD) + tok + pick(CARRIER_TAIL); }

// 출력의 경량 정규화 — 「정규화 계층을 지운 우회」와 「T2 미탐지」를 모두 누출로 잡기 위한 이중 판정용.
const ZW_RE = /[­͏᠋-᠎​-‏⁠-⁤⁪-⁯﻿￹-￻]/g;
const KANGXI = { '⼟': '土', '⼦': '子', '⽂': '文', '⾏': '行', '⾐': '衣', '⾯': '面', '⿇': '麻' };
function normLight(s) {
  return String(s).normalize('NFC').replace(ZW_RE, '').replace(/[⺀-⿟]/g, (c) => KANGXI[c] || c);
}
// ★누출 판정 — ①변형 토큰이 그대로 남았거나 ②정규화하면 기준명이 드러나면 누출이다.
function leaks(out, tok, base) {
  if (typeof out !== 'string') return '반환형 오류(' + typeof out + ')';
  if (tok && out.indexOf(tok) !== -1) return '변형 토큰 잔존';
  if (base && normLight(out).indexOf(base) !== -1) return '정규화 후 기준명 잔존';
  return null;
}

// ──────────────────────────────────────────────────────────────
// 6. ★R5-9 — B축 우회 10클래스 canary 생성기 (전건 IP 파생)
// ──────────────────────────────────────────────────────────────
// ★구분자 후보는 전부 1자다 — R4-2 의 SCRUB_SEP 상한이 {0,2} 이므로 canary 도 2자까지만 만든다.
//   ★기지 한계(정직 기록): 구분자 3자 이상(예: 세 칸 공백) 삽입은 R4-2 규격 범위 밖이며 현행 스크럽이
//     잡지 못한다. 규격 SoT 를 넘어 게이트를 조이면 결정 49(구현 형태 고정) 재발이므로 여기 명시만 한다.
const SEP_FORMS = [' ', '·', '・', '(', ')', '「', '」', '-', '_', '〈', '〉'];
const ZW_FORMS = ['​', '‌', '‍', '﻿', '­', '⁠'];
const COMPAT_REQUIRED = [0x2FA15, 0xFA19, 0xFA72, 0xFA45];   // ★규격 명시 4종

// (1) 혼합표기 — 앞토큰 한자 + 뒤토큰 한글 / 그 반대. 토큰 경계에서만 만든다.
const CAN_MIXED = lazy(() => {
  const out = [];
  for (const c of IP_T2()) {
    const k = TOKEN_SPLIT[c.name];
    if (!k) continue;
    for (const h of c.hanja) {
      if (h.length !== c.name.length) continue;
      out.push({ id: 'MIX_H_' + c.name, base: c.name, tok: h.slice(0, k) + c.name.slice(k) });
      out.push({ id: 'MIX_K_' + c.name, base: c.name, tok: c.name.slice(0, k) + h.slice(k) });
    }
  }
  return out;
});
// (2) 구분자 삽입 — 토큰 경계 + 자간형(모든 글자 사이 1자)
const CAN_SEP = lazy(() => {
  const out = [];
  for (const c of IP_T2()) {
    const k = TOKEN_SPLIT[c.name];
    if (!k) continue;
    const forms = [c.name].concat(c.hanja);
    for (const f of forms) {
      if (f.length !== c.name.length) continue;
      const s1 = pick(SEP_FORMS), s2 = pick(SEP_FORMS);
      out.push({ id: 'SEP1_' + f, base: c.name, tok: f.slice(0, k) + s1 + f.slice(k) });
      out.push({ id: 'SEP2_' + f, base: c.name, tok: f.slice(0, k) + s1 + s2 + f.slice(k) });
      out.push({ id: 'SEPWS_' + f, base: c.name, tok: f.slice(0, k) + '  ' + f.slice(k) });
    }
    out.push({ id: 'SPACED_' + c.name, base: c.name, tok: c.name.split('').join(pick([' ', '·', '・', '.', '-'])) });
  }
  return out;
});
// (3) 제로폭 6종 — 토큰 경계 + 전 글자 사이 연쇄
const CAN_ZW = lazy(() => {
  const out = [];
  const targets = IP_T2().slice(0, 6);
  for (const c of targets) {
    const k = TOKEN_SPLIT[c.name] || 2;
    for (const z of ZW_FORMS) {
      out.push({ id: 'ZW_' + z.codePointAt(0).toString(16) + '_' + c.name, base: c.name, tok: c.name.slice(0, k) + z + c.name.slice(k) });
    }
    out.push({ id: 'ZWCHAIN_' + c.name, base: c.name, tok: c.name.split('').join('‍') });
  }
  return out;
});
// (4) 호환한자 — U+2FA15·U+FA19·U+FA72·U+FA45 는 필수. NFC 로 기준자를 얻어 한자명에 치환한다.
const CAN_COMPAT = lazy(() => {
  const out = [];
  const hanja = IP_HANJA();
  for (const cp of COMPAT_REQUIRED) {
    const ch = String.fromCodePoint(cp);
    const bs = ch.normalize('NFC');
    const host = hanja.filter((h) => h.indexOf(bs) !== -1)[0];
    if (!host) { out.push({ id: 'COMPAT_U' + cp.toString(16), base: null, tok: null, err: '기준자 ' + bs + ' 가 IP 한자명에 부재' }); continue; }
    out.push({ id: 'COMPAT_U' + cp.toString(16), base: host, tok: host.split(bs).join(ch) });
  }
  // 康熙 부수형(U+2E80~U+2FDF)도 같은 클래스다 — R4-1 의 표적 사상 7자를 IP 한자명에서 역파생.
  for (const k of Object.keys(KANGXI)) {
    const bs = KANGXI[k];
    const host = IP_HANJA().filter((h) => h.indexOf(bs) !== -1)[0];
    if (host) out.push({ id: 'KANGXI_U' + k.codePointAt(0).toString(16), base: host, tok: host.split(bs).join(k) });
  }
  return out;
});
// (5) NFD 한글 — 자모 분해
const CAN_NFD = lazy(() => IP_T2().map((c) => ({ id: 'NFD_' + c.name, base: c.name, tok: c.name.normalize('NFD') })));
// (6) T1 서지 ID 우회 — 1SRC_ · aSRC_ · SRC- · 소문자 · 전각＿ · SRC. · 정상형
const CAN_T1 = lazy(() => {
  const mk = (id, pre, sep, lower) => {
    const body = rtok(6, !!lower);
    const head = lower ? 'src' : 'SRC';
    return { id: id, base: body, tok: pre + head + sep + body };
  };
  return [
    mk('T1_PLAIN', '', '_', false),
    mk('T1_DIGIT_PREFIX', '1', '_', false),
    mk('T1_ALPHA_PREFIX', 'a', '_', false),
    mk('T1_HYPHEN', '', '-', false),
    mk('T1_DOT', '', '.', false),
    mk('T1_LOWER', '', '_', true),
    mk('T1_FULLWIDTH', '', '＿', false)
  ];
});
// (7) T3 다점 — 거리 1·6·12·24·60 x (한글/한자 상품명) x (낱말형/구형 근거어휘) + 개행 삽입
const T3_DISTANCES = [1, 6, 12, 24, 60];
const CAN_T3 = lazy(() => {
  const prod = IP_PRODUCT_OK()[0];
  if (!prod) return [];
  const prodForms = [prod.name].concat(prod.hanja);
  const basisForms = ['원문', '原文', '원전', '저본', '판본', '원구절', '그대로 인용'];
  const out = [];
  for (const d of T3_DISTANCES) {
    for (const pf of prodForms) {
      const b = pick(basisForms);
      const fillA = '가'.repeat(Math.max(0, d));
      const fillB = (d >= 2 ? '\n' + '나'.repeat(d - 1) : '\n'.repeat(d));
      out.push({ id: 'T3_FWD_d' + d + '_' + pf, prod: pf, basis: b, tok: pf + fillA + b + '에 따르면 좋습니다' });
      out.push({ id: 'T3_REV_d' + d + '_' + pf, prod: pf, basis: b, tok: b + fillB + pf + ' 풀이입니다' });
    }
  }
  return out;
});
// (8) 사후합성 — T1 삭제가 T2·T3 대상어를 붙여 만드는 경로 (R4-4 고정점 반복 검증)
const CAN_COMPOSE = lazy(() => {
  const out = [];
  const t2 = IP_T2().filter((c) => TOKEN_SPLIT[c.name]);
  for (const c of t2.slice(0, 3)) {
    const k = TOKEN_SPLIT[c.name];
    const body = rtok(5, false);
    out.push({ id: 'CMP_T2_' + c.name, base: c.name, tok: c.name.slice(0, k) + 'SRC_' + body + c.name.slice(k) });
  }
  const prod = IP_PRODUCT_OK()[0];
  if (prod) {
    const body = rtok(5, false);
    out.push({ id: 'CMP_T3', base: null, prod: prod.name, basis: '원문', tok: prod.name + 'SRC_' + body + '원문 근거입니다' });
  }
  return out;
});
// (9) 객체 키 — 키 이름 자체에 문헌명·서지 ID
const CAN_KEY = lazy(() => {
  const t2 = IP_T2();
  const out = [];
  if (t2[0]) out.push({ id: 'KEY_NAME', base: t2[0].name, key: t2[0].name + ' 근거' });
  if (t2[1]) out.push({ id: 'KEY_HANJA', base: (t2[1].hanja[0] || t2[1].name), key: '출전 ' + (t2[1].hanja[0] || t2[1].name) });
  out.push({ id: 'KEY_SRCID', base: rtok(6, false), key: null });   // key 는 생성 시점에 조립
  return out;
});
// (10) ★장문 표본 — 500자·2000자. s.length>200 조기반환 가드(관통 3b)를 죽인다.
const LONG_FILLER = '오늘은 마음을 차분히 두고 주변을 살피면 좋은 흐름이 이어집니다. 작은 선택이 큰 결과로 이어지니 서두르지 마세요. ';
function padTo(want) { let pad = ''; while (pad.length < want) pad += LONG_FILLER; return pad.slice(0, want); }
const CAN_LONG = lazy(() => {
  const t2 = IP_T2();
  const out = [];
  const lens = LONG_SAMPLE_LENS();
  for (let i = 0; i < lens.length; i++) {
    const want = lens[i];
    const c = t2[i % t2.length];
    const pad = padTo(want);
    // ★위치를 앞·중·말미로 순환시키고 소폭 난수화한다. 말미 배치가 「접두만 스크럽」 관통을 잡는다.
    const frac = LONG_POS_FRACTIONS[i % LONG_POS_FRACTIONS.length] + (rnd() * 0.04 - 0.02);
    const at = Math.min(want - 20, Math.max(20, Math.floor(want * frac)));
    const tok = c.name;
    const s = pad.slice(0, at) + ' ' + tok + ' ' + pad.slice(at, want);
    out.push({ id: 'LONG_' + want, base: c.name, tok: tok, len: s.length, text: s, want: want, at: at });
  }
  return out;
});

// ★음성 대조군 — 무변형이어야 하는 것. 과잉 스크럽은 사주·토정·데일리 기능을 조용히 깨뜨린다.
//   양성 canary 만으로는 절대 잡히지 않는다.
const CANARY_NEG = [
  { id: 'NEG_GANJI', text: '甲乙丙丁 庚午 壬癸', why: '사주 간지 — 일반 CJK 통짜 스크럽 금지' },
  { id: 'NEG_GYEOK', text: '정관격 편재 상관견관', why: '격국 용어' },
  { id: 'NEG_OHENG', text: '金木水火土', why: '오행 한자' },
  { id: 'NEG_NAME', text: '金在煥', why: '한자 이름' },
  { id: 'NEG_TRIGRAM', text: '乾坤 震巽', why: '괘 이름' },
  { id: 'NEG_TAROT', text: 'The Fool', why: '타로 카드명(라틴)' },
  { id: 'NEG_TOJEONG_PRODUCT', text: '토정비결 결과를 안내드립니다', why: '상품명 단독 용법(IP product_name_use: 허용)' },
  { id: 'NEG_GWANSANGBEOB', text: '관상법으로 보면 이마가 넓습니다', why: 'C축 오탐 — 상법 접미가 든 일반 낱말' },
  { id: 'NEG_JEONPYEON', text: '전편에 걸쳐 일관된 흐름입니다', why: 'C축 오탐 — 전편이 든 일반 낱말' },
  { id: 'NEG_ILJI', text: '일지(日支)가 寅이라 활동성이 높아요', why: 'C축 오탐 — 일지가 든 정상 술어' },
  { id: 'NEG_DONGUI', text: '동의보감 식이요법을 참고하세요', why: '보감 접미가 든 미등재 외 문헌' },
  { id: 'NEG_DAEJEON', text: '대전광역시 방면이 길합니다', why: '대전이 든 지명' },
  { id: 'NEG_LUCK_TOKEN', text: '★LUCK★색:파랑|숫자:7|방위:동★', why: 'js/chat.js:220 토큰 파싱 보존 — ★ | : 훼손 금지' },
  { id: 'NEG_WONMUN_NOUN', text: '토정비결 원문자료와 원문장을 함께 정리했습니다', why: '★C축 R1 — 상품명이 근접해 있어도 어절 경계(원문+한글)면 무변형이어야 한다' },
  { id: 'NEG_JEOKCHEON_WORD', text: '고전천미 항목을 확인하세요', why: 'C축 R2 — 파생형 부분 선점 파손 방지' },
  { id: 'NEG_LONG_BENIGN', text: null, why: '★2000자 정상 본문 무변형(과잉 스크럽 대량 파손 적발)' },
  // ★v7.65 R10 — 이번 수리가 새로 만들 수 있는 오탐의 대조군. 양성 canary 와 반드시 짝으로 둔다.
  { id: 'NEG_R10_OHAENG_SANGBEOP', text: '업종 오행, 상법상 회사 형태를 검토했습니다', why: '★R10-P3 — 회사작명 프리미엄(₩29,900) 프롬프트가 업종 오행과 법인등기·상표 관행을 동시에 요구한다' },
  { id: 'NEG_R10_OHAENG_LAW', text: '오행 상법 개정 내용을 반영했습니다', why: '★R10-P3 tail_context_exempt SANGBEOP' },
  { id: 'NEG_R10_SANGBEOP_JO', text: '상법 제1조 및 제2조 규정', why: '★R10-P3 — 법률 조문 표기' },
  { id: 'NEG_R10_ROMA', text: '로마의 상법에 따르면 그러합니다', why: '★R10-P4 headBoundary — -마 로 끝나는 어절 + 관형격 의' },
  { id: 'NEG_R10_AKMA', text: '악마의 상법 이야기입니다', why: '★R10-P4 headBoundary' },
  { id: 'NEG_R10_TEMA', text: '테마의 상법적 해석', why: '★R10-P4 headBoundary' },
  { id: 'NEG_R10_JAKMYEONG', text: '작명 대전 지역 방문 상담을 예약해 주세요', why: 'R6-1 tail_context_exempt 회귀' },
  { id: 'NEG_R10_JAKMYEONG_CORP', text: '(주)작명대전 컨설팅', why: 'R6-1 법인 표기 회귀' },
  { id: 'NEG_R10_JAPYEONG', text: '스스로 자평 진전이 더뎠다고 느낄 수 있습니다', why: 'R6-1 회귀' },
  { id: 'NEG_R10_MANSEONG', text: '만성 통보다 급성 통증에 유의하세요', why: 'R6-1 회귀' },
  { id: 'NEG_R10_DENY', text: '토정비결 원문은 제공하지 않습니다', why: '★R10-P6 — 면책 문구를 뒤집으면 ₩4,900 결제 직후 「산 것을 안 준다」가 된다' },
  { id: 'NEG_R10_HANJA_NAME', text: '아드님 이름은 真宇, 따님은 宝拉 로 정하셨습니다', why: '★R10-P7 — 작명 프리미엄 hanja·strokes 동기 보존(宝->寶 는 8획->20획)' },
  { id: 'NEG_R10_HANJA_WORD', text: '庄園 会長 図書 歳月 荘司 渊', why: '★R10-P7 — 사상표 좌변이 든 일상 한자' },
  { id: 'NEG_R10_LATIN_ACCENT', text: 'café bar 카페 · Nöel 노엘', why: '★R10-P2 — NFC 선행이라 결합 문자 제거의 영향을 받지 않아야 한다' }
];
const CANARY_NEG_EMOJI = [
  { id: 'NEG_EMOJI_ZWJ1', text: '🧙‍♂️ 도사님의 풀이', why: '★ZWJ 시퀀스 보존 — R4-1 이 문맥조건부로 처리' },
  { id: 'NEG_EMOJI_ZWJ2', text: '👨‍👩‍👧 가족운이 좋습니다', why: '★ZWJ 가족 이모지 보존' },
  // ★v7.65 R10-P2 — \\p{Cf} 범주 제거·결합 문자 제거가 이모지 조립을 깨뜨리지 않는지.
  //   U+FE0F 는 Mn, U+20E3(키캡)은 결합 문자 범위에 들어 둘 다 위험 지점이다.
  { id: 'NEG_EMOJI_VS16', text: '❤️', why: '★VS16(U+FE0F) 보존' },
  { id: 'NEG_EMOJI_FLAG', text: '🇰🇷', why: '★지역 표시 문자쌍 보존' },
  { id: 'NEG_EMOJI_KEYCAP', text: '1️⃣', why: '★키캡 결합(U+20E3)이 결합 문자 제거에 걸리지 않아야 한다' },
  { id: 'NEG_EMOJI_RAINBOW', text: '🏳️‍🌈', why: '★VS16 + ZWJ 복합' },
  { id: 'NEG_EMOJI_TONE', text: '👍🏽', why: '★피부톤 수정자 보존' }
];
const CANARY_NEG_LAYOUT = [
  { id: 'NEG_INDENT', text: '  - 첫째 항목\n\t- 둘째 항목\n    들여쓰기 네 칸\n  |표1|표2|\n', why: '★들여쓰기·탭 정렬 보존(전역 공백 정리 금지)' }
];
function longBenign() {
  const unit = '오늘의 흐름은 완만합니다. 甲木 일간에게 庚午 시기는 정관격 기운을 북돋우니 The Fool 카드처럼 가볍게 시작하세요. ';
  let s = ''; while (s.length < 2000) s += unit;
  return s.slice(0, 2000);
}

// ★v7.65 R10 — 신규 우회 클래스 canary. 전건 IP 파생 기준명 위에 만든다.
//   ★결정 49 — 「이 구현이 있는가」가 아니라 「이 성질이 보장되는가」로 판정한다.
//     구분자·불가시문자 목록을 코드에서 역파생하지 않고 **바깥에서 독립적으로** 만들어
//     실제 응답 바이트로만 본다. 구현이 어떤 형태든 성질이 서면 통과한다.
const R10_SEP_FORMS = ['！', '．', '，', '－', '＿', '／', '＼', '＊', '＋', '＝', '（', '）', '［', '］',
  '｛', '｝', '＜', '～', '｢', '\u2010', '\u2013', '\u2014', '\u2018', '\u201C', '\u2026',
  '\u00B4', '\u02D9', '\u2E31', '\u00AB', '\u2039', '!', '#', '%', '@', ';', '?'];
const R10_CTRL_FORMS = ['\u0001', '\u001F', '\u007F', '\u009F',
  '\u0600', '\u06DD', '\u070F', '\u08E2', '\u2064', '\u206A',
  '\u0301', '\u0489', '\u05B0', '\u0615', '\u064B', '\u0E31', '\u1DC0', '\uFE20'];
// ★R10-P7 — 사상표 좌변 글자가 든 인명·일상 한자. 무변형이어야 한다.
const R10_VARIANT_KEEP = ['真宇', '宝拉', '庄園', '会長', '図書', '歳月', '荘司', '渊',
  '金在煥', '鑒賞', '梦', '穷', '编', '诠', '逹', '寳', '岁', '髄', '祕', '诀'];
// ★R10-P7 — 이체 표기 문헌명. 차단되어야 한다(보존과 **동시** 성립을 요구한다).
const R10_VARIANT_BLOCK = ['子平真詮', '三命通会', '渊海子平', '神相全编', '达磨相法', '穷通宝鉴',
  '窮通寶鑒', '柳庄相法', '面部百岁流年图', '梦占逸旨', '滴天髄'];
const R10_T2_JOSA = [
  { in: '삼명통회를 보면', out: '고전을 보면' },
  { in: '몽점일지가 있습니다', out: '고전이 있습니다' },
  { in: '면부백세유년도와 대조했습니다', out: '고전과 대조했습니다' },
  { in: '적천수천미는 주석본입니다', out: '고전은 주석본입니다' },
  { in: '자평진전평주라 합니다', out: '고전이라 합니다' },
  { in: '적천수로 보았습니다', out: '고전으로 보았습니다' },
  { in: '마의상법을 보고', out: '고전을 보고' },
  { in: '주공해몽에 따르면', out: '고전에 따르면' }
];
const R10_T3_NEG_KEEP = [
  '토정비결 원문은 제공하지 않습니다.',
  '토정비결 원문을 제공하지 않습니다.',
  '토정비결 저본이 아닙니다.',
  '토정비결 판본은 따로 없습니다.',
  '토정비결 원전과 무관한 창작입니다.',
  '토정비결 원문 열람은 불가합니다.'
];
const R10_PAIR_FP = [
  '업종 오행, 상법상 회사 형태를 검토했습니다',
  '오행 상법 개정 내용을 반영했습니다',
  '상법 제1조 및 제2조 규정',
  '로마의 상법에 따르면 그러합니다',
  '악마의 상법 이야기입니다',
  '테마의 상법적 해석'
];
// ★대칭 — 오탐을 없애면서 차단까지 없애지 않았는지. 이 목록은 반드시 차단되어야 한다.
const R10_PAIR_BLOCK = [
  '오행상법 참조',
  '오행 상법에 따르면 그러합니다',
  '마의 상법에 따르면 그러합니다',
  '마의상법 참조',
  '자평 진전에 실린 구절'
];

// ──────────────────────────────────────────────────────────────
// 7. ★R5-7 — 검사 대상과 배포 산출물 결속 (git)
// ──────────────────────────────────────────────────────────────
function git(args) {
  const root = FRONT_ROOT();
  if (!root) throw new Error('front_root 미해석');
  return execFileSync('git', ['-C', root].concat(args), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
function gitBuf(args) {
  const root = FRONT_ROOT();
  if (!root) throw new Error('front_root 미해석');
  return execFileSync('git', ['-C', root].concat(args), { maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
}
const GIT = lazy(() => {
  const o = { inRepo: false, tracked: false, porcelain: null, headBlob: null, err: null };
  try { o.inRepo = git(['rev-parse', '--is-inside-work-tree']).trim() === 'true'; }
  catch (e) { o.err = 'rev-parse: ' + ((e && e.message) || 'git 실행 실패'); return o; }
  try { o.porcelain = git(['status', '--porcelain', '--', FORTUNE_REL]); } catch (e) { o.err = 'status: ' + (e && e.message); }
  try { o.tracked = git(['ls-files', '--', FORTUNE_REL]).trim() !== ''; } catch (e) { o.err = 'ls-files: ' + (e && e.message); }
  try { o.headBlob = git(['rev-parse', 'HEAD:' + FORTUNE_REL]).trim(); } catch (e) { o.headBlob = null; }
  // ★v7.64 관통10 — 커밋된 blob 바이트와 워킹 파일 바이트의 동일성.
  //   「커밋되지 않은 로컬본으로 녹색」을 막는다. porcelain 만으로는 판정에 반영되지 않았다.
  try { o.headBytesSha = o.headBlob ? sha256(gitBuf(['cat-file', 'blob', o.headBlob])) : null; }
  catch (e) { o.headBytesSha = null; o.err = (o.err ? o.err + ' / ' : '') + 'cat-file: ' + (e && e.message); }
  try { o.toplevel = git(['rev-parse', '--show-toplevel']).trim(); } catch (e) { o.toplevel = null; }
  return o;
});

// ──────────────────────────────────────────────────────────────
// 8. 보조 — 배제목록 · 집합 · 제어문자(★이스케이프로만 표기)
// ──────────────────────────────────────────────────────────────
const NUL_RE = new RegExp('\\u0000', 'g');
const REPL_RE = new RegExp('\\uFFFD', 'g');
function countIn(text, rx) { const m = String(text).match(rx); return m ? m.length : 0; }
function diffSets(a, b) { const sb = new Set(b); return a.filter((x) => !sb.has(x)); }
function linesWhere(lines, rx) { const o = []; for (let i = 0; i < lines.length; i++) if (rx.test(lines[i])) o.push(i + 1); return o; }

// ──────────────────────────────────────────────────────────────
// 8-b. ★v7.66 R11-1 (A축 관통 A·B 수리) — 200 출구 **화이트리스트** 판정기
//
// 【실측된 문제】 구 M10 은 오염 식별자 **블랙리스트**(text|parsed|raw|body|data)로 판정했다.
//   그래서 같은 원문을 `answer`·`note` 라는 **새 이름**에 담아 200 으로 내보내면 통과했다.
//   실측: 유출 3종(자평진전·子平眞詮·SRC_ZPJZ_A) 본문 실림 + eval 62/62 fail=0.
//   블랙리스트는 원리적으로 fail-open 이다 — 이름은 무한히 만들 수 있다.
//
// 【수리한 성질】 「200 을 반환하는 출구의 인자에 실리는 값은 **예외 없이** 스크럽/센티넬/무오염이다」
//   이름이 아니라 **출처(provenance)** 로 오염을 정한다.
//     ①씨앗: fetch 응답 · .json() · .text() · extractJSON() · JSON.parse() · .content · .message
//     ②전파: 오염 식별자를 포함한 식으로 선언·대입된 식별자는 오염이다(구조분해 포함).
//     ③정화: scrubText/scrubDeep 을 거치면 정화된다.
//   ⟹ 새 이름(`answer`·`note`·무엇이든)이 자동으로 걸린다. 목록을 뒤쫓지 않는다.
//
// 【의도적 예외 — 오탐 방지】 오염 객체의 `.ok` · `.status` 접근은 불리언·정수 상태 메타이지
//   원문 운반체가 아니다(구 TAINT_RE 주석도 같은 판단이다). 이 둘만 허용한다.
// ──────────────────────────────────────────────────────────────
const EXIT200_LINE_RE = /res\s*\.\s*status\s*\(\s*200\s*\)\s*\.\s*(?:json|send|end)\s*\(|res\s*\.\s*writeHead\s*\(\s*200\b/;
const TAINT_SEED_RE = /await\s+fetch\s*\(|\bfetch\s*\(|\.\s*json\s*\(\s*\)|\.\s*text\s*\(\s*\)|extractJSON\s*\(|JSON\s*\.\s*parse\s*\(|\.\s*content\b|\.\s*message\b/;
const SCRUB_SANITIZE_RE = /scrub(?:Text|Deep)\s*\(/;
const SAFE_MEMBER_SRC = '(?!\\s*\\.\\s*(?:ok|status)\\b)';
const SCRUB_LOOKBACK = 6;   // scrubDeep(X) 가 반환 직전 몇 행 안에 있어야 하는가 (M8 과 같은 성질)

// scrubText(...)/scrubDeep(...) 의 인자 구간을 균형 괄호로 도려낸다.
function stripScrubSpans(line) {
  let out = String(line);
  for (let guard = 0; guard < 20; guard++) {
    const m = out.match(SCRUB_SANITIZE_RE);
    if (!m) break;
    let i = m.index + m[0].length;
    let depth = 1;
    while (i < out.length && depth > 0) {
      const c = out.charAt(i);
      if (c === '(') depth++;
      else if (c === ')') depth--;
      i++;
    }
    out = out.slice(0, m.index) + ' CW_SCRUBBED ' + out.slice(i);
  }
  return out;
}
// 객체 리터럴의 **키** 위치는 값이 아니다. `{ text: SCRUBBED }` 의 text 를 값으로 오인하지 않는다.
function stripPropKeys(seg) { return String(seg).replace(/[A-Za-z_$][\w$]*\s*:/g, ' CW_KEY '); }

function isTaintedExpr(expr, tainted) {
  const e = String(expr);
  if (TAINT_SEED_RE.test(e)) return true;
  for (const id of tainted) {
    if (new RegExp('\\b' + id + '\\b' + SAFE_MEMBER_SRC).test(e)) return true;
  }
  return false;
}
// ★v7.68 — 컨테이너 **변이 호출**을 통한 세탁 (ADV-1d·1e 변종 봉쇄)
//   `arr.push(오염)` · `Object.assign(box, 오염)` · `map.set(k, 오염)` 은 좌변이 없어 대입 규칙에
//   걸리지 않는다. 그러나 컨테이너에는 오염값이 **들어간다**. 출처 기준으로는 오염이다.
//   ★반환형(concat·slice·map)은 제외한다 — 그쪽은 좌변이 있어 ③ 대입 규칙이 이미 덮는다.
const MUTATOR_CALL_SRC = '\\s*\\.\\s*(?:push|unshift|splice|set|add|fill)\\s*\\(';
const MUTATOR_CALL_RE = new RegExp('(?:^|[^\\w$.])([A-Za-z_$][\\w$]*)' + MUTATOR_CALL_SRC + '([\\s\\S]*)$');
const OBJ_ASSIGN_RE = /Object\s*\.\s*assign\s*\(\s*([A-Za-z_$][\w$]*)\s*,([\s\S]*)$/;
const MEMBER_LHS_SRC = '(?:\\s*\\.\\s*[A-Za-z_$][\\w$]*|\\s*\\[[^\\]]*\\])+';

// 한 행이 식별자 id 를 **다시 오염**시키는가 — 직접 대입 · 멤버 대입 · 변이 호출 · Object.assign 전부.
// ★인가(scrubDeep) 이후 이 판정이 참이면 그 인가는 무효다(ADV-2·2b·2c 봉쇄).
function reTaintsIdent(rawLine, id, tainted) {
  const seg = stripScrubSpans(rawLine);   // `x = scrubText(x)` 는 재오염이 아니다
  const direct = seg.match(new RegExp('(?:^|[^\\w$.])' + id + '\\s*=(?!=)([\\s\\S]*)$'));
  if (direct && isTaintedExpr(direct[1], tainted)) return true;
  const member = seg.match(new RegExp('(?:^|[^\\w$.])' + id + MEMBER_LHS_SRC + '\\s*=(?!=)([\\s\\S]*)$'));
  if (member && isTaintedExpr(member[1], tainted)) return true;
  const mut = seg.match(new RegExp('(?:^|[^\\w$.])' + id + MUTATOR_CALL_SRC + '([\\s\\S]*)$'));
  if (mut && isTaintedExpr(mut[1], tainted)) return true;
  const oa = seg.match(new RegExp('Object\\s*\\.\\s*assign\\s*\\(\\s*' + id + '\\s*,([\\s\\S]*)$'));
  if (oa && isTaintedExpr(oa[1], tainted)) return true;
  return false;
}
function computeTaint(L) {
  const tainted = new Set();
  const cleaned = new Set();
  for (let pass = 0; pass < 4; pass++) {
    for (const line of L) {
      // ①정화 — X = scrubText(...) · X = scrubDeep(...)
      const cm = line.match(/(?:const|let|var\s+)?\s*([A-Za-z_$][\w$]*)\s*=\s*scrub(?:Text|Deep)\s*\(/);
      if (cm) { cleaned.add(cm[1]); tainted.delete(cm[1]); continue; }
      // ②구조분해 선언
      const de = line.match(/(?:const|let|var)\s*\{([^}]*)\}\s*=\s*([\s\S]*)$/);
      if (de) {
        if (isTaintedExpr(de[2], tainted)) {
          for (const nm of de[1].split(',')) {
            const k = nm.split(':').pop().trim().replace(/=.*$/, '').trim();
            if (/^[A-Za-z_$][\w$]*$/.test(k) && !cleaned.has(k)) tainted.add(k);
          }
        }
        continue;
      }
      // ③선언·대입
      const dm = line.match(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([\s\S]*)$/) ||
                 line.match(/^\s*([A-Za-z_$][\w$]*)\s*=\s*([^=][\s\S]*)$/);
      if (dm && !cleaned.has(dm[1]) && isTaintedExpr(dm[2], tainted)) { tainted.add(dm[1]); continue; }
      // ④★v7.68 ADV-1 봉쇄 — **멤버 대입**을 통한 세탁을 추적한다.
      //   【실측된 관통】 `const box = {}; box.p = JSON.parse(JSON.stringify(parsed));`
      //     ③의 대입 정규식은 좌변이 식별자일 때만 매칭한다. 좌변이 `box.p`(멤버 표현식)면
      //     매칭되지 않아 `box` 가 끝까지 미오염으로 남고, 출구 `result: box.p` 가 무검출로 통과했다.
      //     (ADV_재검증보고 §3 ADV-1 · eval 36/36 fail=0 인 채로 원문 3종 유출 실측)
      //   【수리 성질】 「오염된 값을 담은 컨테이너는 컨테이너 자체가 오염이다」 —
      //     `x.y = 오염식` · `x['y'] = 오염식` · `x.y.z = 오염식` 전부 **루트 식별자** x 를 오염시킨다.
      //     이름이 아니라 **출처**로 정하는 M14 의 원래 성질을 컨테이너까지 확장한 것이다.
      const mm = line.match(/^\s*([A-Za-z_$][\w$]*)((?:\s*\.\s*[A-Za-z_$][\w$]*|\s*\[[^\]]*\])+)\s*=\s*([^=][\s\S]*)$/);
      if (mm && !cleaned.has(mm[1]) && isTaintedExpr(mm[3], tainted)) { tainted.add(mm[1]); continue; }
      // ⑤★v7.68 — 컨테이너 변이 호출 (`arr.push(오염)` · `Object.assign(box, 오염)`)
      const om = line.match(OBJ_ASSIGN_RE);
      if (om && !cleaned.has(om[1]) && isTaintedExpr(om[2], tainted)) { tainted.add(om[1]); continue; }
      const km = line.match(MUTATOR_CALL_RE);
      if (km && !cleaned.has(km[1]) && isTaintedExpr(km[2], tainted)) tainted.add(km[1]);
    }
  }
  for (const c of cleaned) tainted.delete(c);
  return tainted;
}
// 200 출구 전건에 대해 「오염값이 스크럽 없이 실렸는가」를 돌려준다.
function exit200Violations(L) {
  const tainted = computeTaint(L);
  const exits = linesWhere(L, EXIT200_LINE_RE);
  const bad = [];
  for (const n of exits) {
    const line = L[n - 1];
    const rest = stripPropKeys(stripScrubSpans(line));
    for (const id of tainted) {
      if (!new RegExp('\\b' + id + '\\b' + SAFE_MEMBER_SRC).test(rest)) continue;
      // 직전 SCRUB_LOOKBACK 행 안에서 그 식별자가 제자리 스크럽(scrubDeep(X))을 거쳤으면 정당하다.
      // ★v7.68 ADV-2 봉쇄 — 인가는 「호출이 텍스트로 존재하는가」가 아니라
      //   「인가 이후 출구까지 그 식별자에 오염값이 **재대입되지 않았는가**」로 판정한다.
      //   【실측된 관통】 `scrubDeep(safe); if (ctx.mode==='zz') { safe = extractJSON(text); }`
      //     구 판정은 6행 안에 `scrubDeep(safe)` 텍스트가 있다는 것만 보고 인가로 처리했고,
      //     그 뒤의 원문 재대입을 모델하지 않았다(제어흐름·순서 무시).
      //     (ADV_재검증보고 §3 ADV-2 · eval 36/36 fail=0 인 채로 원문 3종 유출 실측)
      //   ★가장 가까운 인가 지점만 본다 — 더 앞선 인가로 뒤의 재대입을 덮을 수 없다.
      let sanctioned = false;
      for (let k = n - 1; k >= Math.max(1, n - SCRUB_LOOKBACK); k--) {
        if (!new RegExp('scrub(?:Text|Deep)\\s*\\(\\s*' + id + '\\s*[,)]').test(L[k - 1])) continue;
        let reassigned = false;
        for (let j = k + 1; j < n; j++) {
          if (reTaintsIdent(L[j - 1], id, tainted)) { reassigned = true; break; }
        }
        sanctioned = !reassigned;
        break;
      }
      if (!sanctioned) bad.push('L' + n + ' 오염값 `' + id + '` 무스크럽: ' + String(line).trim().slice(0, 96));
    }
  }
  return { exits: exits, bad: bad, tainted: Array.from(tainted) };
}

function parseIgnore(p) {
  if (!fs.existsSync(p)) throw new Error('배제목록 부재: ' + p);
  const raw = fs.readFileSync(p, 'utf8');
  if (typeof raw !== 'string' || raw.length < 2) throw new Error('배제목록 내용 파손: ' + p);
  return { path: p, patterns: raw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== '' && l.charAt(0) !== '#') };
}
const IGN = lazy(() => {
  const root = FRONT_ROOT();
  if (!root) throw new Error('front_root 미해석 — 배제목록 판정 불가');
  return { v: parseIgnore(path.join(root, VERCELIGNORE_REL)), g: parseIgnore(path.join(root, GITIGNORE_REL)) };
});
function globRx(p) {
  let out = '';
  for (const ch of p) {
    if (ch === '*') out += '[^/]*';
    else if (ch === '?') out += '[^/]';
    else out += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp('^' + out + '$');
}
// ★v7.63 — gitignore 의미론 3점을 보강했다. 종전 구현은 이 셋이 없어서 R3 화이트리스트
//   전환(`/*` + `!` allowlist)을 「배포 필수 파일까지 과잉배제」로 오판했다(V3 FAIL).
//   ① `!` 부정 패턴 지원  ② first-match-wins → **last-match-wins**(gitignore 규격)
//   ③ 선행 `/` 앵커 — 내부 슬래시가 없으면 depth-1 만 대조(`/*` 가 하위까지 먹지 않게)
//   ★fail-closed 유지: 부정으로 되살아난 경우에만 null 을 돌려주고, 그 밖에는 매칭 패턴을 돌려준다.
// ★v7.64 S8 — vercel.json functions 키의 glob 대조. ** 는 경로 구분자를 넘고 * 는 넘지 않는다.
function fnGlobRx(p) {
  let out = '';
  let i = 0;
  const src = String(p);
  while (i < src.length) {
    const ch = src.charAt(i);
    if (ch === '*' && src.charAt(i + 1) === '*') { out += '.*'; i += 2; if (src.charAt(i) === '/') i++; continue; }
    if (ch === '*') { out += '[^/]*'; i++; continue; }
    if (ch === '?') { out += '[^/]'; i++; continue; }
    out += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    i++;
  }
  return new RegExp('^' + out + '$');
}
function ignoreHit(pats, rel) {
  const segs = String(rel).split('/').filter((s) => s !== '');
  let hit = null;
  for (const p0 of pats) {
    let p = p0;
    const neg = p.charAt(0) === '!';
    if (neg) p = p.slice(1);
    const dirOnly = p.charAt(p.length - 1) === '/';
    if (dirOnly) p = p.slice(0, -1);
    const anchored = p.charAt(0) === '/';
    if (anchored) p = p.slice(1);
    if (p === '') continue;
    let matched = false;
    if (anchored && p.indexOf('/') === -1) {
      // 선행 슬래시 + 내부 슬래시 없음 = 루트 직하만 대조 (`/*` · `/index.html`)
      const rx = globRx(p);
      if (segs.length >= 1 && rx.test(segs[0])) matched = dirOnly ? segs.length > 1 : true;
    } else if (p.indexOf('/') !== -1) {
      const rx = globRx(p);
      for (let i = 1; i <= segs.length; i++) {
        if (rx.test(segs.slice(0, i).join('/'))) { matched = dirOnly ? i < segs.length : true; break; }
      }
    } else {
      const rx = globRx(p);
      const limit = dirOnly ? segs.length - 1 : segs.length;
      for (let i = 0; i < limit; i++) if (rx.test(segs[i])) { matched = true; break; }
    }
    if (matched) hit = neg ? null : p0;
  }
  return hit;
}

// ──────────────────────────────────────────────────────────────
// 9. 검사 등록 기반 — ★results 배열은 하나뿐이다 (L3)
// ──────────────────────────────────────────────────────────────
const results = [];
const ck = (id, ok, detail) => results.push({ id: id, pass: !!ok, detail: detail == null ? '' : String(detail) });
const pushFail = (id, detail) => results.push({ id: id, pass: false, detail: String(detail) });
const section = mkSection(pushFail);
async function asec(id, body) {
  try { await body(); }
  catch (e) { pushFail(id + ' [BLOCK]', 'EXCEPTION(fail-closed): ' + ((e && e.message) || String(e))); }
}

const GATE = lazy(() => {
  const bad = [];
  try { WL(); } catch (e) { bad.push('IP 화이트리스트: ' + (e && e.message)); }
  try { if (!FRONT_ROOT()) bad.push('front_root 미해석(CHUNWOON_FRONT_ROOT 미설정 · 상위 탐색 실패)'); }
  catch (e) { bad.push('front_root 예외: ' + (e && e.message)); }
  try { FORTUNE(); } catch (e) { bad.push('api/fortune.js: ' + (e && e.message)); }
  if (!RT.loaded) bad.push('ESM import 미시도(내부 오류)');
  if (RT.error) bad.push('★ESM import/handler: ' + RT.error);
  else if (typeof RT.handler !== 'function') bad.push('★export default handler 부재');
  return bad;
});
function gate() { try { return GATE(); } catch (e) { return ['게이트 예외(fail-closed): ' + (e && e.message)]; } }
function gateNote(g) { return g.length ? ' · ★판정 전제 미성립: ' + g.join(' / ') : ''; }
function blocked(id) { const g = gate(); if (g.length) { ck(id, false, '판정 불가' + gateNote(g)); return true; } return false; }

// canary 배치 구동 — 판정은 everyNonEmpty 로만 한다(R5-6: 맨 for 루프로 판정 금지 · 공허 통과 차단).
async function runRows(list, fn) {
  const rows = [];
  const arr = Array.isArray(list) ? list : [];
  for (let i = 0; i < arr.length; i++) {
    let bad = null;
    try { bad = await fn(arr[i]); } catch (e) { bad = '예외 ' + ((e && e.message) || String(e)); }
    rows.push({ id: arr[i] && arr[i].id ? arr[i].id : ('#' + i), bad: bad });
  }
  return rows;
}
function rowsDetail(rows, min) {
  const bad = rows.filter((r) => r.bad !== null);
  return 'canary ' + rows.length + '건 (하한 ' + min + ') · 실패 ' + bad.length + '건' +
    (bad.length ? ' → ' + bad.slice(0, 8).map((r) => r.id + ': ' + r.bad).join(' / ') : '');
}
const rowsPass = (rows, min) => everyNonEmpty(rows, (r) => r.bad === null, min);

// ──────────────────────────────────────────────────────────────
// 10. main — 톱레벨 즉시 호출 없음. 어떤 예외도 FAIL 로 계상된다.
// ──────────────────────────────────────────────────────────────
async function main() {
  await loadHandler();

  /* ══ S축. 스캔 성립 · 결속 (6) ══════════════════════════════════════════ */
  const S1 = 'S1 api/fortune.js 실재·판독 가능·sha256 기록';
  section(S1, () => {
    if (blocked(S1)) return;
    const f = FORTUNE();
    ck(S1, f.raw.length > 0, 'path=' + f.path + ' · ' + f.bytes + ' 바이트 · ' + f.lines.length + '행 · sha256=' + f.sha256);
  });
  const S2 = 'S2 api/fortune.js 크기 하한 pin';
  section(S2, () => {
    if (blocked(S2)) return;
    const f = FORTUNE();
    ck(S2, f.bytes >= HARD.fortune_bytes_min && f.lines.length >= HARD.fortune_lines_min,
      f.bytes + ' 바이트 (pin >=' + HARD.fortune_bytes_min + ') · ' + f.lines.length + '행 (pin >=' + HARD.fortune_lines_min + ')');
  });
  const S3 = 'S3 NUL·치환문자 0건 · ★주석 스캐너 건전성 증명';
  section(S3, () => {
    if (blocked(S3)) return;
    const f = FORTUNE();
    const nul = countIn(f.raw, NUL_RE);
    const repl = countIn(f.raw, REPL_RE);
    // ★L8 fail-open 차단 — 제거한 모든 구간이 주석 시작 토큰으로 열렸음을 증명한다.
    const unsound = f.spans.filter((sp) => {
      const h = f.raw.slice(sp[0], sp[0] + 2);
      return !(h === '//' || (h.charAt(0) === '/' && h.charAt(1) === '*'));
    });
    const lineKept = f.cjLines.length === f.lines.length;
    const dens = f.raw.replace(/\s/g, '').length;
    const keptDens = f.cj.replace(/\s/g, '').length;
    const ratio = dens > 0 ? keptDens / dens : 0;
    const anchors = ['export default async function handler', 'scrubText', 'scrubDeep', D_EXIT_SENTINEL];
    const lostAnchor = anchors.filter((a) => f.cj.indexOf(a) === -1);
    ck(S3, nul === 0 && repl === 0 && unsound.length === 0 && lineKept && ratio >= 0.5 && lostAnchor.length === 0,
      'NUL ' + nul + '건 · U+FFFD ' + repl + '건 · 제거구간 ' + f.spans.length + '건/불건전 ' + unsound.length +
      '건 · 행수 보존=' + lineKept + ' · 비공백 잔존율 ' + ratio.toFixed(4) + ' · 소실 앵커 ' + lostAnchor.length + '건' +
      (lostAnchor.length ? '[' + lostAnchor.join(',') + ']' : ''));
  });
  const S4 = 'S4 ★파일 전체 ESM import 성공 · export default handler 실체 확인 (R5-1·R5-8)';
  section(S4, () => {
    const okImport = !RT.error && typeof RT.handler === 'function';
    ck(S4, okImport,
      'import=' + (RT.error ? 'FAIL(' + RT.error + ')' : 'OK') + ' · handler=' + typeof RT.handler +
      ' · ' + RT.importMs + 'ms · front_root=' + (function () { try { return String(FRONT_ROOT()); } catch (e) { return 'ERR'; } })());
  });
  const S5 = 'S5 ★평가된 코드 == 검사한 바이트 (사본 sha256 동일 · 스테일 루트 적발)';
  section(S5, () => {
    if (blocked(S5)) return;
    const f = FORTUNE();
    const same = RT.copySha && RT.srcSha && RT.copySha === RT.srcSha && RT.srcSha === f.sha256;
    const pkgCopy = R(FORTUNE_REL);
    let pkgNote = '패키지 트리 사본 없음(정상)';
    let pkgOk = true;
    if (fs.existsSync(pkgCopy)) {
      const s = sha256(fs.readFileSync(pkgCopy));
      pkgOk = s === f.sha256;
      pkgNote = '패키지 사본 sha256=' + s.slice(0, 12) + (pkgOk ? ' 동일' : ' ★불일치(스테일 루트)');
    }
    ck(S5, !!same && pkgOk,
      '원본 sha256=' + String(RT.srcSha).slice(0, 16) + ' · import 사본 sha256=' + String(RT.copySha).slice(0, 16) +
      ' · 동일=' + !!same + ' · ' + pkgNote);
  });
  const S6 = 'S6 ★검사대상이 git 추적 대상 (배포 산출물 결속 · 더티 보고)';
  section(S6, () => {
    if (blocked(S6)) return;
    let g;
    try { g = GIT(); } catch (e) { ck(S6, false, 'git 판정 예외(fail-closed): ' + (e && e.message)); return; }
    const porc = typeof g.porcelain === 'string' ? g.porcelain.trim() : null;
    const untracked = porc !== null && /^\?\?/.test(porc);
    const dirty = porc !== null && porc !== '';
    // ★v7.64 — 종전에는 dirty 가 detail 문자열에만 실리고 판정식에서 빠져 있었다(A축 실측).
    ck(S6, g.inRepo && g.tracked && porc !== null && !untracked && !dirty,
      'inRepo=' + g.inRepo + ' · tracked=' + g.tracked + ' · porcelain=' + JSON.stringify(porc) +
      ' · 더티=' + dirty + (dirty ? '(★푸시 전 상태 — 커밋 후 재실행 필수)' : '') +
      ' · HEAD blob=' + (g.headBlob ? g.headBlob.slice(0, 12) : 'none') + (g.err ? ' · err=' + g.err : ''));
  });

  const S7 = 'S7 ★배포 대상 결속 — front_root 가 git 워크트리 · 추적 중 · 커밋 blob == 워킹 바이트';
  section(S7, () => {
    if (blocked(S7)) return;
    let g;
    try { g = GIT(); } catch (e) { ck(S7, false, 'git 판정 예외(fail-closed): ' + (e && e.message)); return; }
    const f = FORTUNE();
    const bad = [];
    if (!g.inRepo) bad.push('front_root 가 git 워크트리가 아님(환경변수만으로 검사 대상이 정해짐)');
    if (!g.tracked) bad.push('api/fortune.js 가 git 추적 대상이 아님');
    if (!g.headBlob) bad.push('HEAD 에 api/fortune.js blob 부재(미커밋)');
    if (!g.headBytesSha) bad.push('HEAD blob 바이트 판독 실패');
    else if (g.headBytesSha !== f.sha256) bad.push('★커밋 blob != 워킹 파일 (커밋되지 않은 로컬본으로 녹색 시도)');
    // ★front_root 는 워크트리 루트여야 한다 — 하위 디렉터리에 청정 사본을 심는 경로 봉쇄
    let root = null;
    try { root = FRONT_ROOT(); } catch (e) { bad.push('front_root 해석 예외'); }
    // ★v7.64 관통10 — 환경변수 리다이렉션 적발.
    //   ①정규 탐색으로 배포 트리를 찾을 수 있는데 환경변수가 다른 곳을 가리키면 리다이렉션이다.
    //   ②정규 탐색이 불가능한 배치(게이트 패키지가 배포 리포 밖)에서만 환경변수를 허용하며,
    //     그 허용은 버전관리 데이터(eval/_gate_pins.json)에 명시돼 있어야 한다.
    const envRoot = FRONT_FROM_ENV();
    const discRoot = FRONT_DISCOVERED();
    if (envRoot) {
      if (discRoot && path.resolve(discRoot) !== path.resolve(envRoot)) {
        bad.push('★CHUNWOON_FRONT_ROOT 가 정규 탐색 결과와 다른 트리를 가리킴 (리다이렉션) env=' + envRoot + ' 탐색=' + discRoot);
      }
      if (!discRoot) {
        let allow = false;
        try { const j = PINS(); allow = !!(j.front_root && j.front_root.allow_env === true); }
        catch (e) { bad.push('외부 pin 판독 실패로 환경변수 허용 여부 판정 불가: ' + (e && e.message)); }
        if (!allow) bad.push('★환경변수로 검사 대상을 지정했으나 외부 pin 이 allow_env 를 허용하지 않음');
      }
    }
    if (root && g.toplevel && path.resolve(root) !== path.resolve(g.toplevel)) {
      bad.push('front_root 가 워크트리 루트가 아님(root=' + root + ' · toplevel=' + g.toplevel + ')');
    }
    ck(S7, bad.length === 0,
      'inRepo=' + g.inRepo + ' · tracked=' + g.tracked + ' · HEAD blob=' + (g.headBlob ? g.headBlob.slice(0, 12) : 'none') +
      ' · blob 바이트 sha=' + (g.headBytesSha ? g.headBytesSha.slice(0, 12) : 'none') +
      ' · 워킹 sha=' + f.sha256.slice(0, 12) + ' · 지정=' + (envRoot ? 'ENV' : '탐색') +
      ' · root=' + String(root) + ' · 위반 ' + bad.length + '건' +
      (bad.length ? ' → ' + bad.join(' / ') : ''));
  });
  const S8 = 'S8 ★vercel.json 이 api/fortune.js 를 서버리스 함수로 배포함 (검사 대상 == 배포 대상)';
  section(S8, () => {
    if (blocked(S8)) return;
    let root = null;
    try { root = FRONT_ROOT(); } catch (e) { ck(S8, false, 'front_root 해석 예외(fail-closed)'); return; }
    const vp = path.join(root, VERCELJSON_REL);
    if (!fs.existsSync(vp)) { ck(S8, false, VERCELJSON_REL + ' 부재 — 배포 결속 판정 불가(통과 아님): ' + vp); return; }
    let cfg = null;
    try { cfg = JSON.parse(fs.readFileSync(vp, 'utf8')); }
    catch (e) { ck(S8, false, VERCELJSON_REL + ' 파싱 실패(fail-closed): ' + (e && e.message)); return; }
    const bad = [];
    // ★성질 판정 — 「functions 키가 있어야 한다」가 아니라 「이 파일이 함수로 배포되는가」다.
    //   ①명시 매핑이 있으면 그 매핑이 api/fortune.js 를 덮어야 한다.
    //   ②명시 매핑이 없으면 Vercel 기본(api/ 하위 = 함수)에 의존하므로 배제목록에만 걸리지 않으면 된다.
    const fnKeys = (cfg && cfg.functions && typeof cfg.functions === 'object') ? Object.keys(cfg.functions) : [];
    if (fnKeys.length > 0) {
      const hit = fnKeys.filter((k) => k === FORTUNE_REL || fnGlobRx(k).test(FORTUNE_REL));
      if (hit.length === 0) bad.push('★functions 매핑 [' + fnKeys.join(',') + '] 어느 것도 ' + FORTUNE_REL + ' 을 덮지 않음');
    }
    // ②배제목록에 걸리면 배포되지 않는다
    let ig = null;
    try { ig = IGN(); } catch (e) { bad.push('배제목록 판독 실패: ' + (e && e.message)); }
    if (ig) {
      const hv = ignoreHit(ig.v.patterns, FORTUNE_REL);
      if (hv) bad.push('★.vercelignore 가 배포 대상을 배제: ' + hv);
    }
    // ③builds 를 쓰면 functions 는 무시된다 — 두 키 공존은 배포 형상 불명이므로 적발한다
    if (cfg && cfg.builds) bad.push('builds 키 존재 — functions 와 공존 시 배포 형상 불명(판정 불가)');
    ck(S8, bad.length === 0,
      VERCELJSON_REL + ' functions [' + fnKeys.join(',') + '] · 명시 매핑 ' + (fnKeys.length ? '있음' : '없음(기본 api/ 규칙)') +
      ' · 위반 ' + bad.length + '건' + (bad.length ? ' → ' + bad.join(' / ') : ''));
  });
  const S9 = 'S9 ★외부 pin 자기대조 — 직접 실행 경로에서도 자기 약화가 적발됨 (R5-6 확장)';
  section(S9, () => {
    // ★이 검사만은 blocked() 로 막지 않는다. front_root 가 없어도 게이트 자기무결성은 판정 가능하며,
    //   오히려 「전제 미성립」을 핑계로 자기 약화가 통과하는 경로를 만들면 안 된다.
    const bad = [];
    const runnerPath = R(RUNNER_REL);
    let pins = null, pinsSha = null;
    try { pins = PINS(); pinsSha = pins.__sha256; }
    catch (e) { bad.push('외부 pin 판독·파싱 실패: ' + (e && e.message)); }
    // ①자기 소스 sha256 이 외부 표와 일치하는가 (LONG_SAMPLE_LENS 하향·HARD 완화 등 전부 여기서 걸린다)
    const selfName = path.basename(__filename);
    let selfSha = null;
    try { selfSha = sha256(fs.readFileSync(__filename)); } catch (e) { bad.push('자기 소스 판독 실패: ' + (e && e.message)); }
    const spec = (pins && pins.evals) ? pins.evals[selfName] : null;
    if (!spec) bad.push('외부 pin 표에 ' + selfName + ' 항목 부재 — 자기 약화 무방비');
    else {
      if (spec.sha256 !== selfSha) {
        bad.push('★자기 소스 sha256 불일치 (실측 ' + String(selfSha).slice(0, 16) + ' != pin ' +
          String(spec.sha256).slice(0, 16) + ') — 정당한 강화라면 eval/' + PINS_REL + ' 을 함께 갱신하라');
      }
      if (typeof spec.checks_min === 'number' && EXPECTED_TOTAL < spec.checks_min) {
        bad.push('★EXPECTED_TOTAL ' + EXPECTED_TOTAL + ' < 외부 하한 ' + spec.checks_min);
      }
    }
    // ②러너(tools/run_gate.js)가 이 외부 pin 표를 실제로 읽는가 + pin 파일 sha 를 들고 있는가
    let runnerSrc = null;
    if (!fs.existsSync(runnerPath)) bad.push('게이트 러너 부재: ' + RUNNER_REL);
    else {
      try { runnerSrc = fs.readFileSync(runnerPath, 'utf8'); } catch (e) { bad.push('러너 판독 실패: ' + (e && e.message)); }
    }
    if (runnerSrc !== null) {
      if (runnerSrc.indexOf(PINS_REL) === -1) bad.push('★러너가 외부 pin 파일을 참조하지 않음 — pin 표가 러너에서 분리됨');
      const m = runnerSrc.match(/GATE_PINS_SHA256\s*=\s*'([0-9a-f]{64})'/);
      if (!m) bad.push('★러너에 GATE_PINS_SHA256(64자) 상수 부재 — pin 파일 변조 무방비');
      else if (pinsSha && m[1] !== pinsSha) {
        bad.push('★pin 파일 sha256 불일치 (실측 ' + pinsSha.slice(0, 16) + ' != 러너 상수 ' + m[1].slice(0, 16) + ')');
      }
    }
    // ③게이트 침식 — eval/ 열거 건수를 eval 쪽에서도 독립 검증한다(러너만 믿지 않는다)
    if (pins && pins.runner) {
      let files = [];
      try { files = fs.readdirSync(__dirname); } catch (e) { bad.push('eval 디렉터리 열거 실패'); }
      const evals = files.filter((f) => /\.js$/.test(f) && !/^(_|run_eval\.js$|mutation_kill_)/.test(f));
      const muts = files.filter((f) => /^mutation_kill_.*\.js$/.test(f));
      if (typeof pins.runner.eval_min === 'number' && evals.length < pins.runner.eval_min) {
        bad.push('★eval ' + evals.length + ' < 외부 하한 ' + pins.runner.eval_min + ' — 게이트 침식');
      }
      if (typeof pins.runner.mut_min === 'number' && muts.length < pins.runner.mut_min) {
        bad.push('★mutation ' + muts.length + ' < 외부 하한 ' + pins.runner.mut_min + ' — 게이트 침식');
      }
    }
    ck(S9, bad.length === 0,
      'pin 파일=' + (pinsSha ? pinsSha.slice(0, 16) : 'none') + ' · 자기 sha=' + String(selfSha).slice(0, 16) +
      ' · 러너=' + (runnerSrc === null ? '판독 실패' : 'OK') + ' · 위반 ' + bad.length + '건' +
      (bad.length ? ' → ' + bad.join(' / ') : ''));
  });

  const S10 = 'S10 ★배포 번들 형상 적재 — api/ 형제 모듈 동반 · 로컬 import 전건이 배포 포함 (R11-4)';
  section(S10, () => {
    if (blocked(S10)) return;
    const bad = [];
    if (RT.bundleErr) bad.push(RT.bundleErr);
    if (!RT.bundleDir) bad.push('★번들 임시 트리 미구성 — 단일 파일 적재로 회귀(관통 F 재개통)');
    if (RT.bundleFiles.indexOf(path.basename(FORTUNE().path)) === -1) bad.push('★번들에 검사 대상 파일 부재');
    // ①형제 모듈이 실제로 동반 적재됐는가 — 배포 트리의 api/ 파일 수와 대조한다.
    // ★v7.70 — 번들 복사기와 **같은 규약**(api/ 기준 상대 경로 · 재귀)으로 센다.
    //   한쪽만 재귀로 바꾸면 diffSets 가 영구 불일치가 되어 게이트가 상시 적색이 된다.
    let onDisk = [];
    try {
      const base = path.dirname(FORTUNE().path);
      const walkD = (d, prefix) => {
        for (const n of fs.readdirSync(d)) {
          if (n === 'node_modules') continue;
          const fp = path.join(d, n);
          let st = null;
          try { st = fs.statSync(fp); } catch (e) { continue; }
          const rel = prefix ? prefix + '/' + n : n;
          if (st.isDirectory()) { walkD(fp, rel); continue; }
          if (st.isFile()) onDisk.push(rel);
        }
      };
      walkD(base, '');
    } catch (e) { bad.push('배포 api/ 열거 실패: ' + (e && e.message)); }
    const missing = diffSets(onDisk, RT.bundleFiles);
    if (missing.length > 0) bad.push('★번들 누락 ' + missing.length + '건 [' + missing.slice(0, 5).join(',') + ']');
    // ②fortune.js 가 끌어오는 로컬 모듈이 전부 배포 대상인가 — 배제되면 실서비스에서만 깨지거나
    //   반대로 게이트에서만 없어서 무검사가 된다(관통 F 의 구조).
    let ig = null;
    try { ig = IGN(); } catch (e) { bad.push('배제목록 판독 실패: ' + (e && e.message)); }
    const notShipped = [];
    for (const rel of RT.localImports) {
      const norm = rel.replace(/^\.\//, '');
      const relPath = 'api/' + norm.replace(/^\.\.\//, '');
      if (ig && ignoreHit(ig.v.patterns, relPath)) notShipped.push(relPath);
      // ★v7.70 — basename 이 아니라 **상대 경로**로 대조한다. basename 대조는
      //   api/_engine/bind.js 와 api/bind.js 를 같은 것으로 보아 이관을 놓친다.
      if (RT.bundleFiles.indexOf(norm) === -1 && !/^\.\.\//.test(rel)) {
        notShipped.push(relPath + '(번들 부재)');
      }
    }
    if (notShipped.length > 0) bad.push('★로컬 import 가 배포/번들에서 빠짐: ' + notShipped.slice(0, 4).join(','));
    ck(S10, bad.length === 0,
      '번들 파일 ' + RT.bundleFiles.length + '건(형제 ' + RT.siblingsCopied + ') · 배포 api/ ' + onDisk.length +
      '건 · 로컬 import ' + RT.localImports.length + '건[' + RT.localImports.slice(0, 4).join(',') + ']' +
      ' · 적재 경로=' + String(RT.copyPath).split(path.sep).slice(-2).join('/') +
      ' · 위반 ' + bad.length + '건' + (bad.length ? ' → ' + bad.join(' / ') : ''));
  });

  /* ══ X축. 백도어 제거 확인 (R1~R4 · ★행끝주석 제거된 코드로 판정) ═════════ */
  const X1 = 'X1 chat 타입 분기 0건';
  section(X1, () => {
    if (blocked(X1)) return;
    const cj = FORTUNE().cj;
    const lit = countIn(cj, /['"]chat['"]/g);
    const branch = countIn(cj, /type\s*===\s*['"]chat['"]/g);
    ck(X1, lit === 0 && branch === 0, "'chat' 리터럴 " + lit + '건 · type===chat 분기 ' + branch + '건 (기대 0/0)');
  });
  const X2 = 'X2 GET 헬스체크 response 필드 0건';
  section(X2, () => {
    if (blocked(X2)) return;
    const cj = FORTUNE().cj;
    const n = countIn(cj, /\bresponse\s*:/g);
    const body = countIn(cj, /body\s*\.\s*substring/g);
    ck(X2, n === 0 && body === 0, 'response: 필드 ' + n + '건 · body.substring ' + body + '건 (기대 0/0)');
  });
  const X3 = 'X3 502 응답 message·errText 0건 · 상류 본문 미판독';
  section(X3, () => {
    if (blocked(X3)) return;
    const cj = FORTUNE().cj;
    const errText = countIn(cj, /errText/g);
    const respText = countIn(cj, /response\s*\.\s*text\s*\(/g);
    const m502 = countIn(cj, /status\s*\(\s*502\s*\)[^\n]{0,200}?message/g);
    ck(X3, errText === 0 && respText === 0 && m502 === 0,
      'errText ' + errText + '건 · response.text() ' + respText + '건 · 502 message ' + m502 + '건 (기대 0/0/0)');
  });
  const X4 = 'X4 LLM 원문 절단 노출 0건';
  section(X4, () => {
    if (blocked(X4)) return;
    const cj = FORTUNE().cj;
    const cut500 = countIn(cj, /text\s*\.\s*substring\s*\(\s*0\s*,\s*500\s*\)/g);
    const cut300 = countIn(cj, /substring\s*\(\s*0\s*,\s*300\s*\)/g);
    const rawText = countIn(cj, /raw\s*:\s*(text|String\s*\(|data|parsed)/g);
    ck(X4, cut500 === 0 && cut300 === 0 && rawText === 0,
      'text.substring(0,500) ' + cut500 + '건 · substring(0,300) ' + cut300 + '건 · raw:원문식 ' + rawText + '건 (기대 0/0/0)');
  });

  /* ══ M축. ★6출구 실측 구동 + 출구 결속 정적검사 (R5-1·R5-2) ═══════════════ */
  // 실측 판정용 토큰 — IP 파생 + 난수. 「canary 형태 allowlist」(관통 6)를 죽인다.
  let TK = null;
  try {
    const t2 = IP_T2();
    TK = {
      book: t2[0] ? t2[0].name : null,
      hanja: (function () { for (const c of t2) if (c.hanja[0]) return c.hanja[0]; return null; })(),
      src: 'SRC_' + rtok(6, false),
      mixed: (function () {
        for (const c of t2) { const k = TOKEN_SPLIT[c.name]; if (k && c.hanja[0] && c.hanja[0].length === c.name.length) return c.hanja[0].slice(0, k) + c.name.slice(k); }
        return null;
      })()
    };
  } catch (e) { TK = null; }
  function payloadText() {
    return '해석 근거: ' + TK.book + ' 및 ' + TK.hanja + ' (' + TK.mixed + ') 출전 ' + TK.src + ' 제3장을 대조했습니다.';
  }
  function leaked(dump) {
    if (typeof dump !== 'string') return '페이로드 직렬화 실패';
    const nl = normLight(dump);
    const hits = [];
    if (nl.indexOf(TK.book) !== -1) hits.push('문헌명(한글)');
    if (TK.hanja && nl.indexOf(TK.hanja) !== -1) hits.push('문헌명(한자)');
    if (TK.mixed && dump.indexOf(TK.mixed) !== -1) hits.push('혼합표기');
    if (dump.indexOf(TK.src) !== -1) hits.push('서지 ID');
    if (/SRC[_\-.＿][A-Za-z0-9]/i.test(dump)) hits.push('SRC_* 잔존');
    if (dump.indexOf('citation_ref') !== -1) hits.push('citation_ref 키');
    return hits.length ? hits.join('+') : null;
  }
  const tkNote = () => (TK ? '' : ' · ★IP 파생 토큰 조립 실패');

  const M1 = 'M1 ★E출구 실측 — GET 헬스체크 응답 필드가 화이트리스트뿐';
  await asec(M1, async () => {
    if (blocked(M1)) return;
    const r = await drive(GET(''), fetchThrow('fetch 호출되면 안 됨'));
    // ★v7.66 R11-FIX — 화이트리스트를 **좁힌다**.
    //   ①`keyPreview` 삭제 — P1-AUTH 가 이 필드를 제거했다. 허용 목록에 남겨 두면 API 키 말미
    //     4자를 다시 내보내도 게이트가 통과시킨다(수리를 되돌리는 경로를 열어 둔 셈).
    //   ②`premiumAuth` 를 **넣지 않는다** — 시크릿 설정 여부를 무인증 GET 으로 외부에 알리는 것은
    //     정보 노출이다. 화이트리스트를 넓히는 대신 api/fortune.js 에서 필드를 제거했다.
    //   성질: 「무인증 GET 응답은 상태 메타(불리언·문자열 상수·시각)뿐이며 비밀 파생값이 없다」
    const allow = ['status', 'runtime', 'hasApiKey', 'timestamp'];
    const keys = (r.body && typeof r.body === 'object') ? Object.keys(r.body) : [];
    const extra = diffSets(keys, allow);
    // ★비밀 파생 금지 — 키·시크릿의 어떤 조각도 응답에 실려선 안 된다(말미 4자 노출 재발 차단).
    const env = GATE_ENV();
    const dump = String(r.dump);
    const secretBits = [];
    if (env.key && dump.indexOf(env.key.slice(-4)) !== -1) secretBits.push('API 키 말미 4자');
    if (env.key && dump.indexOf(env.key.slice(0, 12)) !== -1) secretBits.push('API 키 앞 12자');
    if (env.premiumSecret && dump.indexOf(env.premiumSecret.slice(0, 8)) !== -1) secretBits.push('프리미엄 시크릿 조각');
    ck(M1, r.code === 200 && r.ended && keys.length > 0 && extra.length === 0 && secretBits.length === 0,
      'code=' + r.code + ' · 필드 [' + keys.join(',') + '] · 화이트리스트 외 ' + extra.length + '건' +
      (extra.length ? '[' + extra.join(',') + ']' : '') + ' · 비밀 파생 ' + secretBits.length + '건' +
      (secretBits.length ? '[' + secretBits.join(',') + ']' : '') + ' · dump=' + dump.slice(0, 120));
  });
  const M2 = "M2 ★E'출구 실측 — 무인증 GET 이 상류에 도달하지 않고 원문·키를 싣지 않음";
  await asec(M2, async () => {
    if (blocked(M2) || !TK) { if (TK) return; ck(M2, false, '판정 불가' + tkNote()); return; }
    // 【수리 전】 이 검사는 `GET ?test=1` 이 **무인증으로 Anthropic 을 실호출**하고 그 예외 문자열을
    //   200 + {status:'API_ERROR', error: scrubText(...)} 로 돌려주는 것을 전제로 「error 가 스크럽됐는가」만
    //   보았다. 실측: P1-AUTH 가 그 호출 분기를 **통째로 제거**해 r.body.error 가 undefined 가 되었고,
    //   JSON.stringify(undefined).slice() 가 EXCEPTION(fail-closed) 을 냈다.
    // 【수리 후】 기대값을 파손에 맞추는 대신 **성질을 상향**한다.
    //   구 성질: 「상류를 때린 뒤 그 원문이 스크럽되는가」(호출 자체는 허용)
    //   신 성질: 「무인증 GET 은 **어떤 쿼리로도 상류에 도달하지 않으며**(비용 0) 응답에 원문도
    //            API 키도 싣지 않는다」 ⟸ 구 성질을 함의한다(도달이 0 이면 원문 유출 경로가 없다).
    //   ★그럼에도 API_ERROR 형 200 출구가 **다시 생기면** M8 이 스크럽 결속을 요구하고
    //     M14 가 오염값 적재를 잡는다 — 이 검사가 「없어도 되는 검사」가 되지 않도록 겹쳐 둔다.
    const qs = ['?test=1', '', '?test=1&debug=1&raw=1'];
    const bad = [];
    let calls = 0, codes = [];
    for (const q of qs) {
      const c = counted(fetchOk(payloadText()));
      const r = await drive(GET(q), c.fn);
      calls += c.n;
      codes.push(String(r.code));
      if (c.n !== 0) bad.push('GET "' + q + '" 이 상류를 ' + c.n + '회 호출(무인증 비용 발생)');
      if (!r.ended) bad.push('GET "' + q + '" 응답 미종료');
      const lk = leaked(r.dump);
      if (lk) bad.push('GET "' + q + '" 누출 ' + lk);
      const d = String(r.dump);
      if (GATE_ENV().key && d.indexOf(GATE_ENV().key.slice(-4)) !== -1) bad.push('GET "' + q + '" 에 API 키 말미 4자 노출');
    }
    ck(M2, bad.length === 0 && qs.length >= 3,
      'GET ' + qs.length + '변주 · 상류 도달 ' + calls + '회(기대 0) · code=[' + codes.join(',') + '] · 위반 ' +
      bad.length + '건' + (bad.length ? ' → ' + bad.slice(0, 4).join(' / ') : ''));
  });
  const M3 = 'M3 ★A출구 실측 — 502 가 상류 본문을 싣지 않음';
  await asec(M3, async () => {
    if (blocked(M3) || !TK) { if (TK) return; ck(M3, false, '판정 불가' + tkNote()); return; }
    const r = await drive(POST({ type: 'tojeong', context: {} }), fetchNotOk(502, payloadText()));
    const keys = (r.body && typeof r.body === 'object') ? Object.keys(r.body) : [];
    const extra = diffSets(keys, ['error', 'detail']);
    const lk = leaked(r.dump);
    ck(M3, r.code === 502 && extra.length === 0 && lk === null && keys.indexOf('message') === -1,
      'code=' + r.code + ' · 필드 [' + keys.join(',') + '] · 허용 외 ' + extra.length + '건 · 누출=' + (lk || '없음') +
      ' · dump=' + String(r.dump).slice(0, 140));
  });
  const M4 = 'M4 ★B출구 실측 — daily_message 자연어 응답이 스크럽됨';
  await asec(M4, async () => {
    if (blocked(M4) || !TK) { if (TK) return; ck(M4, false, '판정 불가' + tkNote()); return; }
    const r = await drive(POST({ type: 'daily_message', context: {} }), fetchOk(payloadText()));
    const t = r.body && r.body.result ? r.body.result.text : undefined;
    const lk = leaked(r.dump);
    ck(M4, r.code === 200 && r.body && r.body.success === true && typeof t === 'string' && t.length > 0 && lk === null,
      'code=' + r.code + ' · text 형=' + typeof t + ' · 누출=' + (lk || '없음') + ' · out=' + JSON.stringify(t).slice(0, 180));
  });
  const M5 = 'M5 ★C출구 실측 — parsed 값·키 스크럽 + citation 키 부재';
  await asec(M5, async () => {
    if (blocked(M5) || !TK) { if (TK) return; ck(M5, false, '판정 불가' + tkNote()); return; }
    const obj = {
      yearReading: payloadText(),
      trigram: { name: '건곤', meaning: TK.hanja + ' 원문 대조' },
      list: ['참고 ' + TK.src, { t: TK.mixed + ' 근거' }],
      citation: { book: TK.book, text: '한문 원문' },
      citation_ref: TK.src
    };
    obj[TK.book + ' 출전'] = '키 이름에 실린 문헌명';
    const r = await drive(POST({ type: 'tojeong', context: {} }), fetchOk(JSON.stringify(obj)));
    const res = r.body && r.body.result;
    const lk = leaked(r.dump);
    const noCit = res && typeof res === 'object' && !('citation' in res) && !('citation_ref' in res);
    ck(M5, r.code === 200 && !!res && lk === null && !!noCit,
      'code=' + r.code + ' · 누출=' + (lk || '없음') + ' · citation 키 제거=' + !!noCit + ' · dump=' + String(r.dump).slice(0, 220));
  });
  const M6 = 'M6 ★D출구 실측 — 파싱 실패 시 raw 가 센티넬 정확 일치';
  await asec(M6, async () => {
    if (blocked(M6) || !TK) { if (TK) return; ck(M6, false, '판정 불가' + tkNote()); return; }
    const garbage = payloadText() + ' 이것은 JSON 이 아닙니다';
    const r = await drive(POST({ type: 'tojeong', context: {} }), fetchOk(garbage));
    const res = r.body && r.body.result;
    const exact = res && res.raw === D_EXIT_SENTINEL;
    const keys = res && typeof res === 'object' ? Object.keys(res) : [];
    const lk = leaked(r.dump);
    ck(M6, r.code === 200 && !!exact && lk === null && keys.length === 1,
      'code=' + r.code + ' · raw=' + JSON.stringify(res && res.raw) + ' · 센티넬 정확일치=' + !!exact +
      ' · result 필드수 ' + keys.length + ' · 누출=' + (lk || '없음'));
  });
  const M7 = 'M7 ★F출구 실측 — 500 message 가 스크럽됨';
  await asec(M7, async () => {
    if (blocked(M7) || !TK) { if (TK) return; ck(M7, false, '판정 불가' + tkNote()); return; }
    const r = await drive(POST({ type: 'tojeong', context: {} }), fetchThrow(payloadText()));
    const lk = leaked(r.dump);
    const m = r.body && r.body.message;
    ck(M7, r.code === 500 && typeof m === 'string' && lk === null,
      'code=' + r.code + ' · message 형=' + typeof m + ' · 누출=' + (lk || '없음') + ' · message=' + JSON.stringify(m).slice(0, 180));
  });
  const M8 = 'M8 ★출구 행 결속 — 스크럽 호출이 각 출구 행에 정확히 1회 (행끝주석 미끼 무효)';
  section(M8, () => {
    if (blocked(M8)) return;
    const L = FORTUNE().cjLines;
    const bad = [];
    let bound = 0;
    const one = (label, findRx, needRx) => {
      const at = linesWhere(L, findRx);
      if (at.length !== 1) { bad.push(label + ': 출구 행 ' + at.length + '건(기대 1) @' + at.join('·')); return; }
      if (!needRx.test(L[at[0] - 1])) bad.push(label + ': 출구 행 L' + at[0] + ' 에 스크럽 호출 부재');
      else bound++;
    };
    // ★v7.66 R11-FIX — 「존재하면 결속」. 출구가 **삭제**된 경우까지 FAIL 로 계상하면
    //   취약 경로를 제거한 정당한 수리가 게이트에 막힌다(P1-AUTH 는 E'출구를 만들던
    //   무인증 GET ?test=1 상류 호출 분기를 통째로 지웠다). 다만 **0 건 허용은 구멍**이므로
    //   ①아래 GET 분기 무호출 불변식 ②M2 런타임 실측 ③M14 오염 적재 판정으로 삼중으로 덮는다.
    const oneOrNone = (label, findRx, needRx) => {
      const at = linesWhere(L, findRx);
      if (at.length === 0) return;                       // 출구 부재 — 아래 불변식이 대신 구속한다
      if (at.length !== 1) { bad.push(label + ': 출구 행 ' + at.length + '건(기대 0 또는 1) @' + at.join('·')); return; }
      if (!needRx.test(L[at[0] - 1])) bad.push(label + ': 출구 행 L' + at[0] + ' 에 스크럽 호출 부재');
      else bound++;
    };
    // ★v7.64 결정 49 정합 — 종전에는 인자 형태까지 못박아(scrubText(text.trim()) · scrubDeep(parsed))
    //   변수명 변경 같은 무해 리팩터링이 FAIL 했다. 성질(「그 출구 값이 스크럽을 거치는가」)만 본다.
    oneOrNone("E'출구", /status\s*\(\s*200\s*\)\s*\.\s*json\s*\([^\n]*API_ERROR/, /error\s*:\s*scrubText\s*\(/);
    one('B출구', /result\s*:\s*\{\s*text\s*:/, /text\s*:\s*scrubText\s*\(/);
    one('F출구', /status\s*\(\s*500\s*\)[^\n]*message\s*:/, /message\s*:\s*scrubText\s*\(/);
    // ★신규 불변식 — 「무인증 GET 분기는 상류를 호출하지 않는다」.
    //   E'출구가 존재할 수 있었던 유일한 이유는 GET 이 상류를 때렸기 때문이다. 결속 검사 1건을
    //   조건부로 낮추는 대신 **그 원인 자체를 정적으로 금지**한다(교환이 아니라 상향).
    const gStart = linesWhere(L, /method\s*===\s*['"]GET['"]|['"]GET['"]\s*===\s*[\w.$]*\s*method/);
    const gEnd = linesWhere(L, /method\s*!==\s*['"]POST['"]|method\s*===\s*['"]POST['"]|['"]POST['"]\s*!==\s*[\w.$]*\s*method/);
    if (gStart.length !== 1) bad.push('GET 분기 경계 식별 실패(진입 ' + gStart.length + '건 · 기대 1)');
    else {
      const after = gEnd.filter((n) => n > gStart[0]);
      if (after.length === 0) bad.push('GET 분기 종료 경계(POST 가드) 식별 실패');
      else {
        const hits = [];
        for (let n = gStart[0]; n < after[0]; n++) {
          if (/\bfetch\s*\(/.test(L[n - 1]) || /api\.anthropic\.com/i.test(L[n - 1])) hits.push('L' + n);
        }
        if (hits.length) bad.push('★무인증 GET 분기에 상류 호출 ' + hits.length + '건 @' + hits.join('·'));
      }
    }
    // C출구 — 반환 행에서 result 로 넘기는 **식별자를 읽어내** 그 식별자에 대한 scrubDeep 호출을
    //   직전 3행 안에서 찾는다. 이름을 무엇으로 바꾸든 성질은 그대로 검사된다.
    const cRetRx = /return\s+res\s*\.\s*status\s*\(\s*200\s*\)\s*\.\s*json\s*\([^\n]*result\s*:\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*[,}\)]/;
    const cRet = linesWhere(L, cRetRx);
    if (cRet.length !== 1) bad.push('C출구: result 로 식별자를 넘기는 반환 행 ' + cRet.length + '건(기대 1)');
    else {
      const mm = L[cRet[0] - 1].match(cRetRx);
      const ident = mm ? mm[1] : null;
      if (!ident) bad.push('C출구: result 식별자 추출 실패');
      else {
        const deepRx = new RegExp('scrubDeep\\s*\\(\\s*' + ident + '\\s*[,\\)]');
        const cDeep = linesWhere(L, deepRx);
        if (cDeep.length !== 1) bad.push('C출구: scrubDeep(' + ident + ') ' + cDeep.length + '건(기대 정확히 1)');
        else if (!(cDeep[0] < cRet[0] && cRet[0] - cDeep[0] <= 3)) {
          bad.push('C출구: scrubDeep@L' + cDeep[0] + ' 이 반환@L' + cRet[0] + ' 직전 3행 안에 없음');
        } else bound++;
      }
    }
    // ★v7.64 규격 정합 — 종전에는 scrubText 전역 호출 수를 「출력만」 하고 단언하지 않았다.
    //   규격이 요구하는 것은 「출구별 1회」이며 전역 총량은 하한으로만 구속한다(내부 재사용은 정당).
    // ★결속 출구 수 하한 — 모든 결속 판정이 끝난 뒤에 센다(E' 부재를 이유로 하한이 무너지지 않게).
    if (bound < HARD.scrub_bound_exits_min) {
      bad.push('스크럽 결속 출구 ' + bound + '건 < 하한 ' + HARD.scrub_bound_exits_min);
    }
    const nText = countIn(FORTUNE().cj, /scrubText\s*\(/g);
    const nDeep = countIn(FORTUNE().cj, /scrubDeep\s*\(/g);
    if (nText < HARD.scrubtext_calls_min) bad.push('scrubText 전역 ' + nText + '회 < 하한 ' + HARD.scrubtext_calls_min);
    if (nDeep < 2) bad.push('scrubDeep 전역 ' + nDeep + '회 < 하한 2(정의 1 + 출구 1)');
    ck(M8, bad.length === 0,
      "결속 " + bound + "출구(E'는 존재 시 · B·C·F 필수 · 하한 " + HARD.scrub_bound_exits_min + ') + GET 분기 무호출 불변식 · 위반 ' +
      bad.length + '건' + (bad.length ? ' → ' + bad.join(' / ') : '') +
      ' · scrubText 전역 ' + nText + '회(하한 ' + HARD.scrubtext_calls_min + ') · scrubDeep 전역 ' + nDeep + '회');
  });
  const M9 = 'M9 ★D출구 센티넬 화이트리스트 — raw 값이 허용 리터럴뿐 (falsy 블랙리스트 폐기)';
  section(M9, () => {
    if (blocked(M9)) return;
    const cj = FORTUNE().cj;
    const rx = /\braw\s*:\s*([^,}\n]+)/g;
    const found = [];
    let m;
    while ((m = rx.exec(cj)) !== null) found.push(m[1].trim());
    const disallowed = found.filter((v) => D_EXIT_ROW_ALLOW_TEST(v));
    ck(M9, found.length === 1 && disallowed.length === 0,
      'raw: 출현 ' + found.length + '회(기대 정확히 1) · 값 [' + found.join(' | ') + '] · 화이트리스트 외 ' +
      disallowed.length + '건 · 허용=' + D_EXIT_RAW_ALLOW.join(' 또는 '));
  });
  const M10 = 'M10 ★전 출구 오염-스크럽 성질 — 출구 **인자**가 상수이거나 스크럽/센티넬 경유';
  section(M10, () => {
    if (blocked(M10)) return;
    const L = FORTUNE().cjLines;
    // ★v7.66 R11-FIX — 판정 범위를 「출구 **행 전체**」에서 「출구 **인자**」로 좁힌다.
    //   【실측된 오판】 P1-AUTH 가 넣은 관문 출구
    //       L702: if (!isPlainObject(body)) return res.status(400).json({ error: 'Invalid body' });
    //     는 인자가 순수 상수(`{ error: 'Invalid body' }`)인데, 구 판정은 **조건식에 있는** `body`
    //     라는 단어를 TAINT_RE 로 잡아 「무스크럽 오염 출구」로 계상했다. 유출 성질과 무관한 오탐이다.
    //   【결정 49 준수】 신규 출구를 **이름으로 면제(exempt)하지 않는다.** 판정 근거는 성질이다:
    //     「그 출구로 나가는 **값**이 (a)리터럴 상수이거나 (b)스크럽을 거쳤거나 (c)센티넬인가」.
    //     ⟹ `res.status(400).json({ error: 'Invalid body' })` 는 (a)로 정당하고,
    //        `res.status(200).json({ result: { text: text } })` 는 어느 것도 아니라 여전히 적발된다.
    //   ★범위를 좁혔으므로 **인자 안에서는 더 엄격하게** 본다 — 구 판정은 행 어디에든 스크럽 호출이
    //     있으면 통과였다(`if (scrubText(a)) return res.status(200).json({text: raw})` 가 통과).
    //     이제는 오염 토큰과 같은 인자 안에서 스크럽이 걸려 있어야 한다.
    const exitArgs = (line) => {
      const rx = /res\s*\.\s*status\s*\([^)]*\)\s*\.\s*(?:json|send|end)\s*\(/g;
      const out = [];
      let m;
      while ((m = rx.exec(line)) !== null) {
        let d = 1, i = m.index + m[0].length;
        const start = i;
        for (; i < line.length && d > 0; i++) {
          const c = line.charAt(i);
          if (c === '(') d++;
          else if (c === ')') d--;
        }
        out.push(line.slice(start, d === 0 ? i - 1 : line.length));
      }
      return out;
    };
    // ★문자열 리터럴 제거 — 리터럴은 정의상 **상수**이며 상류 원문 운반체가 아니다.
    //   실측 오탐: `{ error: 'Invalid body' }` 의 사람이 읽는 문구 안 'body' 가 TAINT_RE 에 걸렸다.
    //   ★백틱은 `${...}` 안이 진짜 식이므로 **보간부는 남기고** 리터럴 조각만 지운다
    //     (`{ text: `${raw}` }` 같은 실제 관통은 그대로 적발돼야 한다).
    const stripLits = (s) => String(s)
      .replace(/'(?:\\.|[^'\\])*'/g, "''")
      .replace(/"(?:\\.|[^"\\])*"/g, '""')
      .replace(/`(?:\\.|[^`\\$]|\$(?!\{))*`/g, '``');
    const violate = (lines) => {
      const out = [];
      const ex = linesWhere(lines, /res\s*\.\s*status\s*\([^)]*\)\s*\.\s*(json|send|end)\s*\(/);
      for (const n of ex) {
        const line = lines[n - 1];
        for (const arg0 of exitArgs(line)) {
          const arg = stripLits(arg0);
          if (!TAINT_RE.test(arg)) continue;                        // 인자에 오염 토큰 없음
          if (SCRUB_CALL_RE.test(arg)) continue;                    // 인자가 스크럽 경유
          // ★센티넬·C출구 예외는 **원문 인자**(리터럴 제거 전)로 대조한다 — 센티넬은 그 리터럴
          //   값 자체가 판정 근거이며, M9 가 raw 값 화이트리스트를 따로 pin 한다.
          if (/\braw\s*:\s*(['"])\[PARSE_FAILED\]\1/.test(arg0)) continue;   // D출구 센티넬
          if (/result\s*:\s*parsed/.test(arg0)) continue;            // C출구 — 직전 scrubDeep 은 M8 이 결속 검사
          out.push('L' + n + ' 인자 [' + arg0.trim().slice(0, 60) + ']: ' + line.trim().slice(0, 80));
        }
      }
      return { exits: ex, bad: out };
    };
    // ★판정기 자기증명 — 범위를 좁힌 판정기가 조용히 무력해지면 「위반 0건」으로 공허 통과한다.
    const SP_POS = ['    return res.status(200).json({ success: true, result: { text: text } });'];
    // ★리터럴 제거가 **과잉**이 아님을 증명한다 — 템플릿 보간으로 원문을 실으면 여전히 잡혀야 한다.
    const SP_POS2 = ['    return res.status(200).json({ success: true, note: `해석: ${text}` });'];
    const SP_NEG1 = ["    if (!isPlainObject(body)) return res.status(400).json({ error: 'Invalid body' });"];
    const SP_NEG2 = ['    return res.status(200).json({ success: true, result: { text: scrubText(text.trim()) } });'];
    const sPos = violate(SP_POS).bad.length;
    const sPos2 = violate(SP_POS2).bad.length;
    const sNeg1 = violate(SP_NEG1).bad.length;
    const sNeg2 = violate(SP_NEG2).bad.length;
    const proof = [];
    if (sPos < 1) proof.push('★양성 자기증명 실패 — 무스크럽 오염 인자를 적발하지 못함');
    if (sPos2 < 1) proof.push('★양성 자기증명 실패 — 템플릿 보간으로 실린 원문을 적발하지 못함(리터럴 제거 과잉)');
    if (sNeg1 !== 0) proof.push('★음성 자기증명 실패 — 상수 문구 안 단어를 오탐(' + sNeg1 + '건)');
    if (sNeg2 !== 0) proof.push('★음성 자기증명 실패 — 스크럽된 인자를 오탐(' + sNeg2 + '건)');
    const v = violate(L);
    ck(M10, proof.length === 0 && v.exits.length >= HARD.exits_min && v.bad.length === 0,
      '출구 ' + v.exits.length + '건 (하한 ' + HARD.exits_min + ') · 무스크럽 오염 인자 ' + v.bad.length + '건' +
      (v.bad.length ? ' → ' + v.bad.slice(0, 4).join(' / ') : '') +
      ' · 자기증명 양성=' + sPos + ',' + sPos2 + '/음성=' + sNeg1 + ',' + sNeg2 +
      (proof.length ? ' ★' + proof.join(' / ') : ''));
  });

  const M11 = 'M11 ★전 type 실구동 — 파싱된 지원 type 전건에서 canary 무유출 (type 조건부 우회 차단)';
  await asec(M11, async () => {
    if (blocked(M11) || !TK) { if (TK) return; ck(M11, false, '판정 불가' + tkNote()); return; }
    const types = TYPES();
    const rows = await runRows(types.map((t) => ({ id: 'TYPE_' + t, type: t })), async (c) => {
      const obj = { note: payloadText(), nested: { deep: TK.hanja + ' 원문 대조', arr: ['참고 ' + TK.src] } };
      obj[TK.book + ' 출전'] = '키 이름에 실린 문헌명';
      const r = await drive(reqOf('POST', { type: c.type, features: TYPE_FEATURES, context: TYPE_CONTEXT }, '', null),
        fetchOk(JSON.stringify(obj)));
      if (r.code !== 200) return '응답 코드 ' + r.code + (r.threw ? ' · 예외 ' + r.threw : '');
      if (!r.ended) return '응답 미종료';
      const lk = leaked(r.dump);
      if (lk) return '★누출 ' + lk;
      return null;
    });
    ck(M11, rowsPass(rows, HARD.types_min),
      '파싱 type ' + types.length + '종 (하한 ' + HARD.types_min + ') · ' + rowsDetail(rows, HARD.types_min));
  });
  const M12 = 'M12 ★구동 type 수 >= 파싱 type 수 (미구동 type 을 FAIL 로 계상)';
  section(M12, () => {
    if (blocked(M12)) return;
    let types = [];
    try { types = TYPES(); } catch (e) { ck(M12, false, 'type 파싱 실패(fail-closed): ' + (e && e.message)); return; }
    const driven = Array.from(DRIVEN_TYPES);
    const missing = diffSets(types, driven);
    ck(M12, types.length >= HARD.types_min && driven.length >= types.length && missing.length === 0,
      '파싱 ' + types.length + '종 · 구동 ' + driven.length + '종 · 미구동 ' + missing.length + '종' +
      (missing.length ? '[' + missing.slice(0, 8).join(',') + ']' : ''));
  });
  const M13 = 'M13 ★반환 수단 전건 관측 — 헤더·write·end·send 채널로도 원문이 나가지 않음';
  await asec(M13, async () => {
    if (blocked(M13) || !TK) { if (TK) return; ck(M13, false, '판정 불가' + tkNote()); return; }
    // ①관측기 자체가 그 채널을 본다는 것을 먼저 증명한다(관측 부재로 인한 공허 통과 차단)
    const probe = mkRes();
    probe.r.setHeader('X-Gate-Observe', 'PROBEHDR');
    probe.r.write('PROBEWRITE');
    probe.r.send('PROBESEND');
    probe.r.end('PROBEEND');
    // ★R11-3 — 새로 관측 대상에 넣은 채널도 **실제로 dump 에 실리는지** 매 실행 증명한다.
    probe.r.statusMessage = 'PROBESTATUSMSG';
    probe.r.writeHead(200, 'PROBEWH3MSG', { 'X-Gate-WH': 'PROBEWHHDR' });
    probe.r.addTrailers({ 'X-Gate-Trailer': 'PROBETRAILER' });
    probe.r.socket.write('PROBESOCKET');
    probe.st.logs.push('PROBELOG');
    const pd = channelDump(probe.st);
    const blind = ['PROBEHDR', 'PROBEWRITE', 'PROBESEND', 'PROBEEND',
      'PROBEWH3MSG', 'PROBEWHHDR', 'PROBETRAILER', 'PROBESOCKET', 'PROBELOG'].filter((t) => pd.indexOf(t) === -1);
    // ★로그 채널의 **실경로** 증명 — drive() 후킹이 실제로 console.log 를 가로채는가.
    const logProbe = await drive(POST({ type: 'daily_message', context: {} }), fetchOk('로그 경로 증명'));
    if (typeof logProbe.dump !== 'string' || logProbe.dump.indexOf('LOG') === -1) blind.push('LOG구획');
    // ②실구동 — 주요 4출구를 채널 전건으로 판정
    const runs = [];
    runs.push(['B', await drive(POST({ type: 'daily_message', context: {} }), fetchOk(payloadText()))]);
    runs.push(['C', await drive(POST({ type: 'tojeong', context: {} }), fetchOk(JSON.stringify({ v: payloadText() })))]);
    runs.push(['A', await drive(POST({ type: 'tojeong', context: {} }), fetchNotOk(502, payloadText()))]);
    runs.push(['F', await drive(POST({ type: 'tojeong', context: {} }), fetchThrow(payloadText()))]);
    runs.push(['E', await drive(GET('?test=1'), fetchThrow(payloadText()))]);
    const bad = [];
    for (const pair of runs) {
      const lk = leaked(pair[1].dump);
      if (lk) bad.push(pair[0] + '출구: ' + lk);
    }
    ck(M13, blind.length === 0 && bad.length === 0 && runs.length >= 5,
      '관측 사각 ' + blind.length + '채널' + (blind.length ? '[' + blind.join(',') + ']' : '') +
      ' · 실구동 ' + runs.length + '출구 · 누출 ' + bad.length + '건' + (bad.length ? ' → ' + bad.join(' / ') : ''));
  });

  const M14 = 'M14 ★200 출구 화이트리스트 — 출처 기반 오염값이 스크럽 없이 실린 200 출구 0건 (R11-1)';
  section(M14, () => {
    if (blocked(M14)) return;
    const L = FORTUNE().cjLines;
    // ①판정기 능력 증명 — 관통 형태를 실제로 적발하는가(양성) · 정당 형태를 오탐하지 않는가(음성).
    //   ★이 자기증명이 없으면 판정기가 조용히 무력해져도 「위반 0건」으로 통과한다(공허 통과).
    const POS = [
      "    const rr = await fetch('https://api.example.invalid/v1/messages', { method: 'POST' });",
      '    const dd = await rr.json();',
      "    const answer = dd.content?.[0]?.text || '';",
      '    return res.status(200).json({ success: true, result: { note: answer } });'
    ];
    const NEG = [
      "    const rr = await fetch('https://api.example.invalid/v1/messages', { method: 'POST' });",
      '    const dd = await rr.json();',
      "    const answer = dd.content?.[0]?.text || '';",
      '    return res.status(200).json({ success: true, result: { note: scrubText(answer) } });'
    ];
    const NEG2 = [
      "    const rr = await fetch('https://api.example.invalid/v1/messages', { method: 'POST' });",
      '    const dd = await rr.json();',
      '    const payload = extractJSON(dd);',
      '    scrubDeep(payload);',
      '    return res.status(200).json({ success: true, result: payload });'
    ];
    // ★v7.68 — 실측된 관통 2건(ADV-1·ADV-2)을 자기증명 양성 표본으로 고정한다.
    //   수리만 하고 표본을 남기지 않으면, 다음 리팩터에서 조용히 되돌아가도 아무도 모른다.
    const HEAD = ["    const rr = await fetch('https://api.example.invalid/v1', { method: 'POST' });",
                  '    const dd = await rr.json();', '    const parsed = extractJSON(dd);'];
    // ★v7.68 — 확장 변종 4종. 실측으로 「수리 직후에도 뚫리던」 형태만 남겼다(가상 표본 아님).
    const POS_EXT = {
      'ADV-1d 배열 push 세탁': HEAD.concat(['    const arr = [];', '    arr.push(parsed);',
        '    return res.status(200).json({ result: arr[0] });']),
      'ADV-1e Object.assign 세탁': HEAD.concat(['    const box = {};', '    Object.assign(box, parsed);',
        '    return res.status(200).json({ result: box });']),
      'ADV-2b 인가 후 멤버 재대입': HEAD.concat(['    let safe = parsed;', '    scrubDeep(safe);',
        "    if (c.mode === 'zz') { safe.v = extractJSON(dd); }",
        '    return res.status(200).json({ result: safe });']),
      'ADV-2c 인가 후 Object.assign': HEAD.concat(['    let safe = parsed;', '    scrubDeep(safe);',
        "    if (c.mode === 'zz') { Object.assign(safe, extractJSON(dd)); }",
        '    return res.status(200).json({ result: safe });'])
    };
    const POS_ADV1 = [                       // 멤버 대입 세탁 + 입력조건 게이팅
      "    const rr = await fetch('https://api.example.invalid/v1/messages', { method: 'POST' });",
      '    const dd = await rr.json();',
      '    const parsed = extractJSON(dd);',
      '    const box = {};',
      '    box.p = JSON.parse(JSON.stringify(parsed));',
      '    if (context && context.year === 9999) {',
      '      return res.status(200).json({ success: true, result: box.p });',
      '    }'
    ];
    const POS_ADV2 = [                       // 스크럽 인가 획득 후 재대입
      "    const rr = await fetch('https://api.example.invalid/v1/messages', { method: 'POST' });",
      '    const dd = await rr.json();',
      '    const parsed = extractJSON(dd);',
      '    scrubDeep(parsed);',
      '    let safe = parsed;',
      '    scrubDeep(safe);',
      "    if (context && context.mode === 'zz') { safe = extractJSON(dd); }",
      '    return res.status(200).json({ success: true, result: safe });'
    ];
    const NEG3 = [                           // 정당형 대조 — 인가 후 재대입이 **스크럽 결과**인 경우
      "    const rr = await fetch('https://api.example.invalid/v1/messages', { method: 'POST' });",
      '    const dd = await rr.json();',
      '    let safe = extractJSON(dd);',
      '    scrubDeep(safe);',
      '    safe = scrubText(safe);',
      '    return res.status(200).json({ success: true, result: safe });'
    ];
    const NEG4 = [                           // 정당형 대조 — 멤버 대입이지만 값이 스크럽을 거친 경우
      "    const rr = await fetch('https://api.example.invalid/v1/messages', { method: 'POST' });",
      '    const dd = await rr.json();',
      '    const out = {};',
      '    out.note = scrubText(dd.content);',
      '    return res.status(200).json({ success: true, result: out });'
    ];
    const selfPos = exit200Violations(POS).bad.length;
    const selfPosA1 = exit200Violations(POS_ADV1).bad.length;
    const selfPosA2 = exit200Violations(POS_ADV2).bad.length;
    const selfNeg = exit200Violations(NEG).bad.length;
    const selfNeg2 = exit200Violations(NEG2).bad.length;
    const selfNeg3 = exit200Violations(NEG3).bad.length;
    const selfNeg4 = exit200Violations(NEG4).bad.length;
    const proofBad = [];
    if (selfPos < 1) proofBad.push('★양성 자기증명 실패 — 관통 형태를 적발하지 못함(판정기 무력)');
    if (selfPosA1 < 1) proofBad.push('★양성 자기증명 실패 — ADV-1(멤버 대입 세탁)을 적발하지 못함');
    if (selfPosA2 < 1) proofBad.push('★양성 자기증명 실패 — ADV-2(인가 후 재대입)를 적발하지 못함');
    if (selfNeg !== 0) proofBad.push('★음성 자기증명 실패 — 스크럽된 정당 형태를 오탐(' + selfNeg + '건)');
    if (selfNeg2 !== 0) proofBad.push('★음성 자기증명 실패 — 제자리 scrubDeep 형태를 오탐(' + selfNeg2 + '건)');
    if (selfNeg3 !== 0) proofBad.push('★음성 자기증명 실패 — 인가 후 스크럽 재대입을 오탐(' + selfNeg3 + '건)');
    if (selfNeg4 !== 0) proofBad.push('★음성 자기증명 실패 — 스크럽된 멤버 대입을 오탐(' + selfNeg4 + '건)');
    let extOk = 0;
    for (const nm of Object.keys(POS_EXT)) {
      if (exit200Violations(POS_EXT[nm]).bad.length >= 1) extOk++;
      else proofBad.push('★양성 자기증명 실패 — ' + nm + ' 을 적발하지 못함');
    }
    // ②실제 대상 판정
    const v = exit200Violations(L);
    ck(M14, proofBad.length === 0 && v.exits.length >= HARD.exit200_min && v.bad.length === 0,
      '200 출구 ' + v.exits.length + '행 (하한 ' + HARD.exit200_min + ') · 오염 식별자 ' + v.tainted.length +
      '종[' + v.tainted.slice(0, 8).join(',') + '] · 위반 ' + v.bad.length + '건' +
      (v.bad.length ? ' → ' + v.bad.slice(0, 3).join(' / ') : '') +
      ' · 자기증명 양성=' + selfPos + ',' + selfPosA1 + ',' + selfPosA2 +
      '+확장' + extOk + '/' + Object.keys(POS_EXT).length +
      '/음성=' + selfNeg + ',' + selfNeg2 + ',' + selfNeg3 + ',' + selfNeg4 +
      (proofBad.length ? ' ★' + proofBad.join(' / ') : ''));
  });

  const M15 = 'M15 ★확장 type + 미지 type 실구동 — 200 응답 전건 canary 무유출 (R11-1 런타임 측)';
  await asec(M15, async () => {
    if (blocked(M15) || !TK) { if (TK) return; ck(M15, false, '판정 불가' + tkNote()); return; }
    let ext = [];
    try { ext = TYPES_EXT(); } catch (e) { ck(M15, false, '확장 type 파싱 실패(fail-closed): ' + (e && e.message)); return; }
    // ★미지 type — 파서가 원리적으로 볼 수 없는 경로(런타임 조립 문자열 등)를 확률적으로 두드린다.
    const unknown = ['saju_deep', 'tojeong_deep', 'face_deep', 'premium', 'admin', 'debug', 'internal', 'raw'];
    for (let i = 0; i < 12; i++) unknown.push('cwq_' + rtok(7, true));
    const list = ext.map((t) => ({ id: 'EXT_' + t, type: t }))
      .concat(unknown.map((t) => ({ id: 'UNK_' + t, type: t })));
    let code200 = 0;
    const rows = await runRows(list, async (c) => {
      const obj = { note: payloadText(), nested: { deep: TK.hanja + ' 원문 대조', arr: ['참고 ' + TK.src] } };
      obj[TK.book + ' 출전'] = '키 이름에 실린 문헌명';
      const r = await drive(reqOf('POST', { type: c.type, features: TYPE_FEATURES, context: TYPE_CONTEXT }, '', null),
        fetchOk(JSON.stringify(obj)));
      // ★성질: 「200 을 돌려준 모든 구동」에서 무유출. 400/500 은 그 자체로 정상 거절이다.
      if (r.code !== 200) return null;
      code200++;
      const lk = leaked(r.dump);
      if (lk) return '★누출(type=' + c.type + ') ' + lk;
      return null;
    });
    // ★확장 집합이 구 파서 집합을 포함해야 한다 — 파서 축소로 검사 집합이 줄어드는 경로 봉쇄
    let base = [];
    try { base = TYPES(); } catch (e) { /* TYPES 실패는 M11·M12 가 판정한다 */ }
    const lost = diffSets(base, ext);
    const okSet = ext.length >= HARD.types_ext_min && lost.length === 0 && unknown.length >= HARD.types_unknown_min;
    ck(M15, rowsPass(rows, HARD.types_ext_min + HARD.types_unknown_min) && okSet,
      '확장 type ' + ext.length + '종(하한 ' + HARD.types_ext_min + ') · 미지 ' + unknown.length +
      '종(하한 ' + HARD.types_unknown_min + ') · 구파서 집합 소실 ' + lost.length + '종' +
      (lost.length ? '[' + lost.slice(0, 6).join(',') + ']' : '') + ' · 200 응답 ' + code200 + '건 · ' +
      rowsDetail(rows, HARD.types_ext_min + HARD.types_unknown_min));
  });

  // ★v7.66 R11-FIX 신설 — 인증 **실패** 경로의 성질.
  //   M11·M15 는 「유효 토큰을 든 정상 결제 사용자」 경로를 봅니다. 그것만 보면 하네스가 토큰을
  //   붙이도록 고친 순간, **관문을 통째로 지워도 게이트가 녹색**이 됩니다(P1-AUTH 무력화 무탐지).
  //   ⟹ 무토큰·위조·만료·타상품 토큰이 **차단되는가**, 그리고 그 **차단 응답에도 원문이 실리지
  //     않는가**를 함께 실측합니다. ★토큰 없이 200 이 나오면 그것 자체가 FAIL 입니다.
  const M16 = 'M16 ★유료 관문 — 무토큰·위조·만료·타상품이 차단되고 차단 응답도 무유출 · 무료 type 무회귀';
  await asec(M16, async () => {
    if (blocked(M16) || !TK) { if (TK) return; ck(M16, false, '판정 불가' + tkNote()); return; }
    let types = [];
    try { types = TYPES(); } catch (e) { ck(M16, false, 'type 파싱 실패(fail-closed): ' + (e && e.message)); return; }
    const upstream = () => {
      const obj = { note: payloadText(), nested: { deep: TK.hanja + ' 원문 대조', arr: ['참고 ' + TK.src] } };
      obj[TK.book + ' 출전'] = '키 이름에 실린 문헌명';
      return JSON.stringify(obj);
    };
    // ① 유료/무료 집합을 **실측으로** 가른다 — 소스의 맵 형태에 의존하지 않는다.
    //    「무토큰으로 200 이 아닌 type」 = 서버가 유료로 취급하는 type.
    const paid = [], free = [];
    const bad = [];
    for (const t of types) {
      const c = counted(fetchOk(upstream()));
      const r = await drive(reqOf('POST', { type: t, features: TYPE_FEATURES, context: TYPE_CONTEXT }, '', null, { noToken: true }), c.fn);
      if (r.code === 200) { free.push(t); continue; }
      paid.push(t);
      // 차단 응답의 성질 — ⓐ상류에 도달하지 않았고(비용 0) ⓑ어떤 채널로도 원문이 실리지 않는다.
      if (c.n !== 0) bad.push('PAID_' + t + ': 차단인데 상류 ' + c.n + '회 도달(비용 발생)');
      const lk = leaked(r.dump);
      if (lk) bad.push('PAID_' + t + ': ★차단 응답에 누출 ' + lk);
      if (!r.ended) bad.push('PAID_' + t + ': 응답 미종료');
    }
    // ② 유료 집합이 비면 관문이 사라진 것이다 — 하한으로 공허 통과를 막는다.
    if (paid.length < HARD.premium_gate_min) {
      bad.push('★유료 관문 커버리지 ' + paid.length + '종 < 하한 ' + HARD.premium_gate_min +
        ' — 관문 무력화 또는 화이트리스트 비움');
    }
    // ③ ★무료 회귀 가드 — naming·naming_company·naming_product 가 접두어 매칭으로 막히면
    //    상품이 파손된다. 무료로 판정된 type 이 실제로 무토큰 200 인 것은 위에서 이미 성립했고,
    //    여기서는 「무료 집합이 비지 않았는가 · 유료+무료 == 전체」를 본다.
    if (free.length < 1) bad.push('★무료 type 0종 — 무료 경로 전면 차단 회귀');
    if (paid.length + free.length !== types.length) bad.push('집합 분할 불일치');
    // ④ 유료 type 표본에 대한 위조·만료·타상품 토큰 차단 (전건은 비용이 크므로 결정적 표본 3종)
    const sample = paid.slice(0, 3);
    for (const t of sample) {
      const pk = productKeyFor(t);
      const otherPk = pk === 'naming' ? 'saju' : 'naming';
      const variants = [
        { id: 'FORGED_' + t, tokenOpts: { secret: 'zzzz' + rtok(40, true) } },              // 타 시크릿 서명
        { id: 'EXPIRED_' + t, tokenOpts: { exp: Date.now() - 60000 } },                      // 만료
        { id: 'CROSS_' + t, tokenOpts: { pk: otherPk } },                                    // 타 상품 결속
        { id: 'GARBAGE_' + t, token: 'cwp1.' + rtok(30, true) + '.' + rtok(40, true) },      // 서명 불일치
        { id: 'EMPTY_' + t, token: '' }                                                       // 빈 토큰
      ];
      for (const v of variants) {
        const c = counted(fetchOk(upstream()));
        const opt = v.token !== undefined ? { token: v.token } : { tokenOpts: v.tokenOpts };
        const r = await drive(reqOf('POST', { type: t, features: TYPE_FEATURES, context: TYPE_CONTEXT }, '', null, opt), c.fn);
        if (r.code === 200) bad.push(v.id + ': ★무효 토큰으로 200 통과');
        if (c.n !== 0) bad.push(v.id + ': 무효 토큰인데 상류 ' + c.n + '회 도달');
        const lk = leaked(r.dump);
        if (lk) bad.push(v.id + ': ★차단 응답에 누출 ' + lk);
      }
      // ⑤ ★대조군(양성) — **유효** 토큰이면 200 이어야 한다. 이것이 없으면 「전부 막으면 통과」가 된다.
      const c2 = counted(fetchOk(upstream()));
      const r2 = await drive(reqOf('POST', { type: t, features: TYPE_FEATURES, context: TYPE_CONTEXT }, '', null), c2.fn);
      if (r2.code !== 200) bad.push('VALID_' + t + ': 유효 토큰인데 code=' + r2.code + ' (정상 결제 사용자가 막힘)');
      else {
        if (c2.n < 1) bad.push('VALID_' + t + ': 200 인데 상류 미도달 — 실경로 미검증');
        const lk2 = leaked(r2.dump);
        if (lk2) bad.push('VALID_' + t + ': ★유료 사용자 경로 누출 ' + lk2);
      }
    }
    // ⑥ 시크릿 미설정 시 fail-closed — 유료가 열리면 안 된다.
    if (sample.length) {
      const c3 = counted(fetchOk(upstream()));
      const r3 = await drive(reqOf('POST', { type: sample[0], features: TYPE_FEATURES, context: TYPE_CONTEXT }, '', null),
        c3.fn, { noSecret: true });
      if (r3.code === 200) bad.push('NOSECRET_' + sample[0] + ': ★시크릿 미설정인데 200 통과(fail-open)');
      if (c3.n !== 0) bad.push('NOSECRET_' + sample[0] + ': 시크릿 미설정인데 상류 도달');
    }
    ck(M16, bad.length === 0 && sample.length >= 1,
      '유료 ' + paid.length + '종(하한 ' + HARD.premium_gate_min + ') · 무료 ' + free.length + '종 · 무효토큰 변주 ' +
      (sample.length * 5) + '건 · 위반 ' + bad.length + '건' +
      (bad.length ? ' → ' + bad.slice(0, 5).join(' / ') : ''));
  });

  /* ══ W축. IP 대조 — ★정적 집합 비교가 아니라 「실제 응답에서 사라지는가」로 판정 ══════ */
  const W1 = 'W1 ★IP source_classes 파생 전건이 실제 응답에서 제거됨 (한글+한자)';
  await asec(W1, async () => {
    if (blocked(W1)) return;
    const derived = IP_DERIVED();
    const rows = await runRows(derived.map((x, i) => ({ id: 'IP' + i + '_' + x, base: x })), async (c) => {
      const out = await viaB(carry(c.base));
      return leaks(out, null, c.base);
    });
    ck(W1, rowsPass(rows, HARD.ip_derived_min),
      'IP 파생 ' + derived.length + '원소 (하한 ' + HARD.ip_derived_min + ') · ' + rowsDetail(rows, HARD.ip_derived_min));
  });
  const W2 = 'W2 ★한자 병기 전건이 C출구 값에서 제거됨';
  await asec(W2, async () => {
    if (blocked(W2)) return;
    const hj = IP_HANJA();
    const rows = await runRows(hj.map((x, i) => ({ id: 'HJ' + i + '_' + x, base: x })), async (c) => {
      const out = await viaCValue('출전 ' + c.base + ' 제1권');
      return leaks(out, null, c.base);
    });
    ck(W2, rowsPass(rows, HARD.hanja_min),
      '한자 원소 ' + hj.length + '건 (하한 ' + HARD.hanja_min + ') · ' + rowsDetail(rows, HARD.hanja_min));
  });
  // ★2026-08-01 v7.68 신설 — 「차단에 성공했는데 비문」 축. (인수인계 v7.67 §23-3 · 결정 67)
  //   프로덕션 실측에서 사용자가 실제로 본 문장이 「고전과 고전의 원리에 따라」·
  //   「고전·고전·고전의 이론에 기반해」였다. 문헌명 차단은 **정확히** 됐고 게이트는 67/67 녹색이었다.
  //   게이트가 「문헌명이 안 나오는가」만 보고 「사람이 읽을 문장인가」를 보지 않았기 때문이다.
  //   ⟹ 읽을 만함 전체를 정적으로 검사할 수는 없다. 그러나 **중립어가 연달아 남는 것**은 검사할 수 있다.
  //   ★W5-2 가 짝이다 — 축약이 차단력을 1비트라도 줄이면 즉시 FAIL 한다. 스크럽 약화는 금지다.
  const W5 = 'W5 ★중립어 연쇄 축약 — 문헌명 다중 나열이 「고전·고전·고전」 비문으로 남지 않음';
  await asec(W5, async () => {
    if (blocked(W5)) return;
    const names = IP_DERIVED().filter((x) => /^[가-힣]{3,}$/.test(x));
    if (names.length < 3) { ck(W5, false, 'IP 파생 한글 문헌명 ' + names.length + '종 < 3 — 판정 불가'); return; }
    const CONN = [['과 ', '의 원리에 따라'], ['·', '의 이론에 기반해'], [', ', '을 근거로'],
                  [' 및 ', '에 따르면'], [' 그리고 ', '에서'], ['이나 ', '에 나오는']];
    const list = [];
    for (let i = 0; i < CONN.length; i++) {
      for (const n of [2, 3, 4]) {
        const picked = [];
        for (let k = 0; k < n; k++) picked.push(names[(i * 3 + k) % names.length]);
        list.push({ id: 'DUP' + i + '_' + n, text: picked.join(CONN[i][0]) + CONN[i][1] + ' 해석합니다.', bases: picked });
      }
    }
    const rows = await runRows(list, async (c) => {
      const out = await viaB(carry(c.text));
      if (typeof out !== 'string') return '반환형 오류';
      for (const b of c.bases) { const lk = leaks(out, null, b); if (lk) return lk; }   // ★차단 우선
      const dup = out.match(/([가-힣]{2})(?:\s*(?:그리고|하고|또는|이나|및|와|과|랑|·|\u3395|\u30FB|\u3001|,|\/)\s*|\s+)\1(?![가-힣])/);
      if (dup) return '★중립어 연쇄 잔존: ' + dup[0];
      return null;
    });
    ck(W5, rowsPass(rows, list.length), '문헌 ' + names.length + '종 x 연결어 ' + CONN.length +
      '형 · ' + rowsDetail(rows, list.length));
  });
  const W6 = 'W6 ★축약이 차단을 약화시키지 않음 — 단일 문헌명·인접 반복 전건 무유출 (W5 의 짝)';
  await asec(W6, async () => {
    if (blocked(W6)) return;
    const names = IP_DERIVED();
    // ★같은 문헌명이 연달아 나오는 입력 — 축약 로직이 「접느라」 치환을 건너뛰면 여기서 새어나온다.
    const list = [];
    names.forEach((x, i) => {
      list.push({ id: 'S' + i, text: '근거는 ' + x + ' 입니다.', base: x });
      list.push({ id: 'R' + i, text: x + '·' + x + '·' + x + '의 관점', base: x });
      list.push({ id: 'M' + i, text: x + ' 와 ' + x + ' 및 ' + x + ' 에 따르면', base: x });
    });
    const rows = await runRows(list, async (c) => {
      const out = await viaB(carry(c.text));
      if (typeof out !== 'string') return '반환형 오류';
      return leaks(out, null, c.base);
    });
    ck(W6, rowsPass(rows, HARD.ip_derived_min * 3),
      '입력 ' + list.length + '건 (하한 ' + (HARD.ip_derived_min * 3) + ') · ' + rowsDetail(rows, HARD.ip_derived_min * 3));
  });
  const W3 = 'W3 ★T1 정규식 소스 pin (R4-3 기준) + 난수 서지 ID 실측 제거 + 과잉 제거 0';
  await asec(W3, async () => {
    if (blocked(W3)) return;
    const cj = FORTUNE().cj;
    const m = cj.match(/const\s+SCRUB_SRC_ID_RE\s*=\s*(\/(?:\\.|\[(?:\\.|[^\]])*\]|[^\/\n])+\/[a-z]*)/);
    const lit = m ? m[1] : null;
    const pinOk = lit === T1_RE_SRC_PIN;
    const flags = lit ? lit.slice(lit.lastIndexOf('/') + 1) : '';
    const flagOk = flags.indexOf('g') !== -1 && flags.indexOf('i') !== -1;
    const noWordBoundary = lit ? lit.indexOf('\\b') === -1 : false;
    // 실측 — 난수 서지 ID 가 실제 응답에서 사라지는가
    const body = rtok(7, false);
    const out = await viaB('출전 SRC_' + body + ' 제3장');
    const removed = typeof out === 'string' && out.indexOf(body) === -1 && out.indexOf('SRC_') === -1;
    // ★음성 — SRC 접두가 아닌 토큰을 지워버리는 과잉 제거 적발
    const negs = ['SRCX_ALPHA', 'RESOURCE_MAP', 'DESCRIPTION_A'];
    const over = [];
    for (const nv of negs) { const o = await viaCValue('식별자 ' + nv + ' 유지'); if (typeof o !== 'string' || o.indexOf(nv) === -1) over.push(nv); }
    ck(W3, pinOk && flagOk && noWordBoundary && removed && over.length === 0,
      'pin 일치=' + pinOk + ' · 실측 리터럴=' + JSON.stringify(lit) + ' · 플래그 gi=' + flagOk +
      ' · \\b 부재=' + noWordBoundary + ' · 난수 ID 제거=' + removed + ' · 과잉 제거 ' + over.length + '건' +
      (over.length ? '[' + over.join(',') + ']' : ''));
  });
  const W4 = 'W4 ★상품명 단독 보존 + T3 근거결합만 중립화 (양방향 실측)';
  await asec(W4, async () => {
    if (blocked(W4)) return;
    const prod = IP_PRODUCT_OK();
    if (!prod.length) { ck(W4, false, 'IP 에 product_name_use 허용 문헌 0건 — 판정 불가'); return; }
    const p = prod[0].name;
    const keepIn = p + ' 결과를 안내드립니다';
    const keepOut = await viaCValue(keepIn);
    const fwd = await viaB(p + ' 원문에 따르면 올해는 길합니다');
    const rev = await viaB('원문 그대로의 ' + p + ' 풀이입니다');
    const bad = [];
    if (keepOut !== keepIn) bad.push('상품명 단독 훼손 → ' + JSON.stringify(keepOut));
    if (typeof fwd !== 'string' || fwd.indexOf('원문') !== -1 || fwd.indexOf(p) === -1) bad.push('정방향 실패 → ' + JSON.stringify(fwd));
    if (typeof rev !== 'string' || rev.indexOf('원문') !== -1 || rev.indexOf(p) === -1) bad.push('역방향 실패 → ' + JSON.stringify(rev));
    ck(W4, bad.length === 0,
      '상품명 허용 ' + prod.length + '건[' + prod.map((x) => x.name).join(',') + '] · 위반 ' + bad.length + '건' +
      (bad.length ? ' → ' + bad.join(' / ') : '') + ' · fwd=' + JSON.stringify(fwd).slice(0, 90));
  });

  /* ══ P축. pin · 위생 ══════════════════════════════════════════════════════ */
  const P1 = 'P1 IP 파생 원소 수 하한 pin';
  section(P1, () => {
    if (blocked(P1)) return;
    const d = IP_DERIVED(), h = IP_HANJA();
    ck(P1, d.length >= HARD.ip_derived_min && h.length >= HARD.hanja_min,
      'IP 파생 ' + d.length + '원소 (pin >=' + HARD.ip_derived_min + ') · 한자 ' + h.length + '원소 (pin >=' + HARD.hanja_min + ')');
  });
  const P2 = 'P2 ★pin 의 pin — IP 클래스 축소·상품명 면제 남용 차단';
  section(P2, () => {
    if (blocked(P2)) return;
    const all = IP_CLASSES(), t2 = IP_T2(), ok = IP_PRODUCT_OK();
    // ★product_name_use: 허용 을 남발해 T2 대상을 빼내는 경로를 막는다(허용은 1종 초과 금지).
    ck(P2, all.length >= 16 && t2.length >= 15 && ok.length === 1,
      '전 클래스 ' + all.length + '종(pin >=16) · T2 대상 ' + t2.length + '종(pin >=15) · 상품명 면제 ' + ok.length +
      '종(pin ==1)[' + ok.map((x) => x.name).join(',') + ']');
  });
  const P3 = 'P3 IP 원소 형식 위생 + 토큰 경계 등재 완전성';
  section(P3, () => {
    if (blocked(P3)) return;
    const bad = [];
    const seen = new Set();
    const arr = IP_DERIVED();
    arr.forEach((x, i) => {
      if (typeof x !== 'string') { bad.push('#' + i + ': 비문자열'); return; }
      if (x.trim() === '') { bad.push('#' + i + ': ★빈 문자열(전건 매칭 유발)'); return; }
      if (x.length < 2) { bad.push('#' + i + ": 과단문 '" + x + "'"); return; }
      if (/[.*+?^${}()|[\]\\]/.test(x)) bad.push('#' + i + ": 정규식 메타문자 '" + x + "'");
      if (seen.has(x)) bad.push('#' + i + ": 중복 '" + x + "'");
      seen.add(x);
    });
    // ★IP 에 문헌이 추가되면 토큰 경계 등재가 없어 여기서 FAIL 한다(canary 누락 = fail-closed).
    const noSplit = IP_CLASSES().filter((c) => !TOKEN_SPLIT[c.name]).map((c) => c.name);
    ck(P3, everyNonEmpty(arr, (x) => typeof x === 'string' && x.trim() !== '', HARD.ip_derived_min) &&
      bad.length === 0 && noSplit.length === 0,
      'n=' + arr.length + ' · 형식 결함 ' + bad.length + '건' + (bad.length ? ' → ' + bad.slice(0, 5).join(' / ') : '') +
      ' · 토큰 경계 미등재 ' + noSplit.length + '건' + (noSplit.length ? '[' + noSplit.join(',') + ']' : ''));
  });
  const P4 = 'P4 ★T3 거리 파라미터 pin (R5-5) + 개행 관통 차단 형태 확인';
  section(P4, () => {
    if (blocked(P4)) return;
    const cj = FORTUNE().cj;
    const m = cj.match(/SCRUB_T3_WINDOW\s*=\s*(\d+)/);
    const win = m ? parseInt(m[1], 10) : null;
    const SS = '[' + '\\\\' + 's' + '\\\\' + 'S' + ']{0,';   // 파일 바이트: 대괄호 backslash s backslash S
    const OLD = '[^' + '\\\\' + 'n' + ']{0,';                // 구 형태(개행 관통 허용)
    const hasSS = cj.indexOf(SS) !== -1;
    const hasOld = cj.indexOf(OLD) !== -1;
    const loop = /for\s*\(\s*let\s+i\s*=\s*0\s*;\s*i\s*<\s*4\s*;/.test(cj);   // R4-4 고정점 반복
    ck(P4, win !== null && win >= HARD.t3_window_min && hasSS && !hasOld && loop,
      'SCRUB_T3_WINDOW=' + win + ' (pin >=' + HARD.t3_window_min + ') · 전문자 창=' + hasSS +
      ' · 구 개행배제 창 잔존=' + hasOld + ' · 고정점 반복(R4-4)=' + loop);
  });

  /* ══ G축. ★R5-9 B축 우회 10클래스 양성 canary + 음성 대조군 ═══════════════ */
  const G1 = 'G1 ★혼합표기 canary — 앞토큰 한자 + 뒤토큰 한글(및 역) 전건 제거';
  await asec(G1, async () => {
    if (blocked(G1)) return;
    const list = CAN_MIXED();
    const rows = await runRows(list, async (c) => leaks(await viaB(carry(c.tok)), c.tok, c.base));
    ck(G1, rowsPass(rows, HARD.canary_mixed_min), rowsDetail(rows, HARD.canary_mixed_min));
  });
  const G2 = 'G2 ★구분자 삽입 canary — 공백·중점·괄호 1~2자 + 자간형 전건 제거';
  await asec(G2, async () => {
    if (blocked(G2)) return;
    const list = CAN_SEP();
    const rows = await runRows(list, async (c) => leaks(await viaB(carry(c.tok)), c.tok, c.base));
    ck(G2, rowsPass(rows, HARD.canary_sep_min), rowsDetail(rows, HARD.canary_sep_min));
  });
  const G3 = 'G3 ★제로폭 6종 canary — 토큰 경계 삽입 + 전 글자 연쇄 삽입';
  await asec(G3, async () => {
    if (blocked(G3)) return;
    const list = CAN_ZW();
    const rows = await runRows(list, async (c) => leaks(await viaB(carry(c.tok)), c.tok, c.base));
    ck(G3, rowsPass(rows, HARD.canary_zw_min), rowsDetail(rows, HARD.canary_zw_min));
  });
  const G4 = 'G4 ★호환한자·부수이체자 canary (U+2FA15·U+FA19·U+FA72·U+FA45 필수)';
  await asec(G4, async () => {
    if (blocked(G4)) return;
    const list = CAN_COMPAT();
    const rows = await runRows(list, async (c) => {
      if (c.err) return c.err;
      return leaks(await viaB(carry(c.tok)), c.tok, c.base);
    });
    const req = COMPAT_REQUIRED.map((cp) => 'COMPAT_U' + cp.toString(16));
    const missing = diffSets(req, rows.map((r) => r.id));
    ck(G4, rowsPass(rows, HARD.canary_compat_min) && missing.length === 0,
      rowsDetail(rows, HARD.canary_compat_min) + ' · 필수 4종 누락 ' + missing.length + '건' +
      (missing.length ? '[' + missing.join(',') + ']' : ''));
  });
  const G5 = 'G5 ★NFD 한글 canary — 자모 분해 표기 전건 제거';
  await asec(G5, async () => {
    if (blocked(G5)) return;
    const list = CAN_NFD();
    const rows = await runRows(list, async (c) => leaks(await viaB(carry(c.tok)), null, c.base));
    ck(G5, rowsPass(rows, HARD.canary_nfd_min), rowsDetail(rows, HARD.canary_nfd_min));
  });
  const G6 = 'G6 ★T1 서지 ID 우회 canary — 1SRC_·aSRC_·SRC-·SRC.·소문자·전각＿ (난수 접미)';
  await asec(G6, async () => {
    if (blocked(G6)) return;
    const list = CAN_T1();
    const rows = await runRows(list, async (c) => {
      const out = await viaB('근거: ' + c.tok + ' 및 추가 설명');
      if (typeof out !== 'string') return '반환형 오류';
      if (out.indexOf(c.base) !== -1) return '★난수 ID 잔존';
      if (out.indexOf(c.tok) !== -1) return '★변형 토큰 잔존';
      return null;
    });
    ck(G6, rowsPass(rows, HARD.canary_t1_min), rowsDetail(rows, HARD.canary_t1_min));
  });
  const G7 = 'G7 ★T3 다점 canary — 거리 1·6·12·24·60 x 한글/한자 상품명 x 낱말형/구형 + 개행';
  await asec(G7, async () => {
    if (blocked(G7)) return;
    const list = CAN_T3();
    const rows = await runRows(list, async (c) => {
      const out = await viaB(c.tok);
      if (typeof out !== 'string') return '반환형 오류';
      if (out.indexOf(c.basis) !== -1) return '★근거어휘 잔존(' + c.basis + ')';
      if (normLight(out).indexOf(c.prod) === -1) return '상품명 소실(★과잉 스크럽)';
      return null;
    });
    ck(G7, rowsPass(rows, HARD.canary_t3_min),
      '거리 [' + T3_DISTANCES.join('·') + '] · ' + rowsDetail(rows, HARD.canary_t3_min));
  });
  const G8 = 'G8 ★사후합성 canary — T1 삭제가 T2·T3 대상어를 붙여 만드는 경로 (R4-4 고정점)';
  await asec(G8, async () => {
    if (blocked(G8)) return;
    const list = CAN_COMPOSE();
    const rows = await runRows(list, async (c) => {
      const out = await viaB(carry(c.tok));
      if (typeof out !== 'string') return '반환형 오류';
      if (c.base && normLight(out).indexOf(c.base) !== -1) return '★사후합성 문헌명 잔존';
      if (c.basis && out.indexOf(c.basis) !== -1) return '★사후합성 근거어휘 잔존';
      if (c.prod && normLight(out).indexOf(c.prod) === -1) return '상품명 소실(과잉)';
      return null;
    });
    ck(G8, rowsPass(rows, HARD.canary_compose_min), rowsDetail(rows, HARD.canary_compose_min));
  });
  const G9 = 'G9 ★객체 키 canary — 키 이름에 실린 문헌명·서지 ID 제거 (R4-6)';
  await asec(G9, async () => {
    if (blocked(G9)) return;
    const list = CAN_KEY();
    const rows = await runRows(list, async (c) => {
      const key = c.key || ('출전 SRC_' + c.base);
      const obj = { ok: '정상 필드' };
      obj[key] = '값';
      obj.nested = {};
      obj.nested[key] = '값2';
      const res = await viaC(obj);
      if (!res) return 'C출구 응답 없음';
      const dump = JSON.stringify(res);
      if (dump.indexOf(key) !== -1) return '★키 원형 잔존';
      if (normLight(dump).indexOf(c.base) !== -1) return '★키 속 금지어 잔존';
      if (dump.indexOf('정상 필드') === -1) return '정상 필드 소실(과잉)';
      return null;
    });
    ck(G9, rowsPass(rows, HARD.canary_key_min), rowsDetail(rows, HARD.canary_key_min));
  });
  const G10 = 'G10 ★장문 표본 canary — maxTokens 파생 상한 다점 (길이 조기반환 가드 관통 차단)';
  await asec(G10, async () => {
    if (blocked(G10)) return;
    const list = CAN_LONG();
    const lens = [];
    const rows = await runRows(list, async (c) => {
      lens.push(c.len);
      if (c.len < c.want) return '표본 길이 미달 ' + c.len + '<' + c.want;
      const out = await viaB(c.text);
      return leaks(out, null, c.base);
    });
    const want = LONG_SAMPLE_LENS();
    const covered = want.filter((w) => list.some((c) => c.want === w && c.len >= w));
    const mt = MAX_TOKENS();
    ck(G10, rowsPass(rows, HARD.canary_long_min) && covered.length === want.length,
      'maxTokens 최대 ' + mt.max + ' → 파생 상한 ' + mt.chars + '자 · 요구 길이 [' + want.join('·') +
      '] · 실제 [' + lens.join('·') + '] · 충족 ' + covered.length + '/' + want.length + ' · ' +
      rowsDetail(rows, HARD.canary_long_min));
  });
  const G11 = 'G11 ★음성 대조군 전건 무변형 — 과잉 스크럽 적발 (간지·격국·상품명·오탐어·★LUCK★)';
  await asec(G11, async () => {
    if (blocked(G11)) return;
    const list = CANARY_NEG.map((c) => ({ id: c.id, text: c.text === null ? longBenign() : c.text, why: c.why }));
    const rows = await runRows(list, async (c) => {
      const out = await viaCValue(c.text);
      if (typeof out !== 'string') return '반환형 오류';
      if (out !== c.text) return '★변형됨 → ' + JSON.stringify(out).slice(0, 100) + ' (근거: ' + c.why + ')';
      return null;
    });
    ck(G11, rowsPass(rows, HARD.canary_neg_min), rowsDetail(rows, HARD.canary_neg_min));
  });
  const G12 = 'G12 ★음성 대조군 이모지 ZWJ 시퀀스 보존 (R4-1 문맥조건부 ZWJ 처리)';
  await asec(G12, async () => {
    if (blocked(G12)) return;
    const rows = await runRows(CANARY_NEG_EMOJI, async (c) => {
      const out = await viaCValue(c.text);
      if (typeof out !== 'string') return '반환형 오류';
      if (out !== c.text) return '★ZWJ 시퀀스 파손 → ' + JSON.stringify(out);
      return null;
    });
    ck(G12, rowsPass(rows, HARD.canary_emoji_min), rowsDetail(rows, HARD.canary_emoji_min));
  });
  const G13 = 'G13 ★음성 대조군 들여쓰기·탭 정렬 보존 (전역 공백 정리 금지)';
  await asec(G13, async () => {
    if (blocked(G13)) return;
    const rows = await runRows(CANARY_NEG_LAYOUT, async (c) => {
      const out = await viaCValue(c.text);
      if (typeof out !== 'string') return '반환형 오류';
      if (out !== c.text) return '★서식 파손 → ' + JSON.stringify(out);
      return null;
    });
    ck(G13, rowsPass(rows, 1), rowsDetail(rows, 1));
  });

  const G14 = 'G14 ★길이 불변성 — 문맥 길이가 달라도 canary 처리량이 동일 (길이 임계 게이팅 금지)';
  await asec(G14, async () => {
    if (blocked(G14)) return;
    const t2 = IP_T2();
    if (!t2.length) { ck(G14, false, 'IP T2 0종 — 판정 불가'); return; }
    const base = t2[0].name;
    const cap = MAX_TOKENS().chars;
    const lens = [0, 300, 2500, Math.round(cap * 0.6), Math.round(cap * 1.2)];
    const deltas = [];
    const rows = await runRows(lens.map((L) => ({ id: 'CTXLEN_' + L, len: L })), async (c) => {
      const pad = padTo(c.len);
      const half = Math.floor(c.len / 2);
      // 같은 문맥 길이에서 canary 유무만 다른 두 표본의 「줄어든 글자 수」 차이를 잰다.
      const withTok = pad.slice(0, half) + ' 근거 ' + base + ' 대조 ' + pad.slice(half);
      const without = pad.slice(0, half) + ' 근거 ' + '가나다라'.slice(0, base.length) + ' 대조 ' + pad.slice(half);
      const o1 = await viaB(withTok);
      const o2 = await viaB(without);
      if (typeof o1 !== 'string' || typeof o2 !== 'string') return '반환형 오류';
      const lk = leaks(o1, null, base);
      if (lk) return '★' + lk;
      const d = (withTok.length - o1.length) - (without.length - o2.length);
      deltas.push(d);
      if (d <= 0) return '★스크럽 효과 0 (길이 ' + c.len + ' 에서 무처리)';
      return null;
    });
    const uniq = deltas.filter((v, i) => deltas.indexOf(v) === i);
    ck(G14, rowsPass(rows, HARD.canary_ctxlen_min) && uniq.length === 1,
      '문맥 길이 [' + lens.join('·') + '] · 처리량 델타 [' + deltas.join('·') + '] · 서로 다른 델타 ' +
      uniq.length + '종(기대 1) · ' + rowsDetail(rows, HARD.canary_ctxlen_min));
  });
  const G15 = 'G15 ★깊은 중첩 canary — 잎노드까지 스크럽 (scrubDeep 재귀 깊이 제한 관통 차단)';
  await asec(G15, async () => {
    if (blocked(G15) || !TK) { if (TK) return; ck(G15, false, '판정 불가' + tkNote()); return; }
    const rows = await runRows(DEEP_DEPTHS.map((d) => ({ id: 'DEEP_' + d, depth: d })), async (c) => {
      let node = { leaf: payloadText() };
      for (let i = 0; i < c.depth; i++) node = { ['lv' + i]: node };
      const r = await drive(POST({ type: 'tojeong', context: {} }), fetchOk(JSON.stringify(node)));
      if (r.code !== 200) return '응답 코드 ' + r.code;
      const lk = leaked(r.dump);
      if (lk) return '★깊이 ' + c.depth + ' 누출: ' + lk;
      // 잎이 실제로 도달됐는지 — flat 은 반복형이라 깊이에 무관하다
      const fl = flat(r.body);
      if (fl.indexOf('근거') === -1) return '잎노드 소실(과잉 또는 미도달)';
      return null;
    });
    ck(G15, rowsPass(rows, HARD.canary_deep_min),
      '깊이 [' + DEEP_DEPTHS.join('·') + '] · ' + rowsDetail(rows, HARD.canary_deep_min));
  });
  const G16 = 'G16 ★깊이 폭주 fail-closed 경계 — 스택 한계 초과 입력이 누출 없이 차단됨';
  await asec(G16, async () => {
    if (blocked(G16) || !TK) { if (TK) return; ck(G16, false, '판정 불가' + tkNote()); return; }
    // JSON.stringify 로는 만들 수 없는 깊이라 원문 텍스트를 직접 조립한다.
    const head = '{"lv":';
    const raw = head.repeat(DEEP_EXTREME) + JSON.stringify(payloadText()) + '}'.repeat(DEEP_EXTREME);
    let r = null, drvErr = null;
    try { r = await drive(POST({ type: 'tojeong', context: {} }), fetchOk(raw)); }
    catch (e) { drvErr = (e && e.message) ? e.message : String(e); }
    const dump = r ? r.dump : '';
    const lk = r ? leaked(dump) : null;
    // ★성질: 누출이 없을 것. 500(fail-closed) 이든 센티넬이든 스크럽된 200 이든 모두 정상이다.
    //   구현 형태(500 이어야 한다)를 고정하지 않는다 — 결정 49.
    const okCode = r && (r.code === 500 || r.code === 200) && r.ended;
    ck(G16, !!r && lk === null && okCode,
      '깊이 ' + DEEP_EXTREME + ' · 구동 예외=' + (drvErr || '없음') + ' · code=' + (r ? r.code : 'none') +
      ' · 종료=' + (r ? r.ended : false) + ' · 누출=' + (lk || '없음'));
  });

  /* ══ G축 확장. ★v7.65 R10 — 신규 우회 클래스 + 오탐 대조군 ════════════════ */
  const G17 = 'G17 ★R10-P1 구분자 우회 canary — 전각·유니코드·ASCII 미등재 구두점 전건 차단';
  await asec(G17, async () => {
    if (blocked(G17)) return;
    const t2 = IP_T2();
    if (!t2.length) { ck(G17, false, 'IP T2 0종 — 판정 불가'); return; }
    const c0 = t2[0], k = TOKEN_SPLIT[c0.name] || 2;
    const list = R10_SEP_FORMS.map((sp, i) => ({
      id: 'R10SEP' + i + '_U' + sp.codePointAt(0).toString(16), base: c0.name,
      tok: c0.name.slice(0, k) + sp + c0.name.slice(k)
    }));
    const rows = await runRows(list, async (c) => leaks(await viaB(carry(c.tok)), c.tok, c.base));
    ck(G17, rowsPass(rows, HARD.canary_r10_sep_min), rowsDetail(rows, HARD.canary_r10_sep_min));
  });
  const G18 = 'G18 ★R10-P2 제어·잔여 Cf·결합 문자 우회 canary — 전건 차단';
  await asec(G18, async () => {
    if (blocked(G18)) return;
    const t2 = IP_T2();
    if (!t2.length) { ck(G18, false, 'IP T2 0종 — 판정 불가'); return; }
    const c0 = t2[0], k = TOKEN_SPLIT[c0.name] || 2;
    const list = R10_CTRL_FORMS.map((z, i) => ({
      id: 'R10CTL' + i + '_U' + z.codePointAt(0).toString(16), base: c0.name,
      tok: c0.name.slice(0, k) + z + c0.name.slice(k)
    }));
    const rows = await runRows(list, async (c) => leaks(await viaB(carry(c.tok)), c.tok, c.base));
    ck(G18, rowsPass(rows, HARD.canary_r10_ctrl_min), rowsDetail(rows, HARD.canary_r10_ctrl_min));
  });
  const G19 = 'G19 ★R10-P7 이체자 — 인명 한자 보존 ∧ 이체 표기 문헌명 차단 (두 성질 동시)';
  await asec(G19, async () => {
    if (blocked(G19)) return;
    // ★둘 중 하나만 성립하면 FAIL 이다. 전역 사상(보존 실패)도, 사상 폐기(차단 실패)도 잡는다.
    const keep = await runRows(R10_VARIANT_KEEP.map((t, i) => ({ id: 'VKEEP' + i + '_' + t, text: t })),
      async (c) => {
        const out = await viaCValue(c.text);
        if (typeof out !== 'string') return '반환형 오류';
        if (out !== c.text) return '★인명·일상 한자 파손 → ' + JSON.stringify(out);
        return null;
      });
    const block = await runRows(R10_VARIANT_BLOCK.map((t, i) => ({ id: 'VBLK' + i + '_' + t, tok: t })),
      async (c) => leaks(await viaB(carry(c.tok)), c.tok, null));
    const kb = keep.filter((r) => r.bad !== null), bb = block.filter((r) => r.bad !== null);
    ck(G19, rowsPass(keep, HARD.canary_r10_variant_min) && rowsPass(block, 11),
      '보존 ' + keep.length + '건 중 실패 ' + kb.length + (kb.length ? '[' + kb.slice(0, 4).map((r) => r.id + ':' + r.bad).join(' / ') + ']' : '') +
      ' · 차단 ' + block.length + '건 중 실패 ' + bb.length + (bb.length ? '[' + bb.slice(0, 4).map((r) => r.id + ':' + r.bad).join(' / ') + ']' : ''));
  });
  const G20 = 'G20 ★R10-P5 T2 조사 재조립 — 차단 유지 + 비문 0 + 표식 문자 잔류 0';
  await asec(G20, async () => {
    if (blocked(G20)) return;
    const rows = await runRows(R10_T2_JOSA.map((c, i) => ({ id: 'T2J' + i, in: c.in, out: c.out })),
      async (c) => {
        const out = await viaCValue(c.in);
        if (typeof out !== 'string') return '반환형 오류';
        if (/[\uE000-\uF8FF]/.test(out)) return '★표식 문자 잔류 → ' + JSON.stringify(out);
        if (out !== c.out) return '기대 ' + JSON.stringify(c.out) + ' 실측 ' + JSON.stringify(out);
        return null;
      });
    ck(G20, rowsPass(rows, HARD.canary_r10_josa_min), rowsDetail(rows, HARD.canary_r10_josa_min));
  });
  const G21 = 'G21 ★R10-P6 면책 문맥 무변형 ∧ 부정 부재 시 차단 유지 (의미 반전 차단)';
  await asec(G21, async () => {
    if (blocked(G21)) return;
    const rows = await runRows(R10_T3_NEG_KEEP.map((t, i) => ({ id: 'T3NEG' + i, text: t })),
      async (c) => {
        const out = await viaCValue(c.text);
        if (typeof out !== 'string') return '반환형 오류';
        if (out !== c.text) return '★면책 문구 변형(의미 반전) → ' + JSON.stringify(out);
        return null;
      });
    const pos = ['토정비결 원문에 따르면 올해는 길합니다.', '토정비결 저본으로 삼았습니다.', '판본이 다른 토정비결'];
    const leak = [];
    for (const t of pos) {
      const o = await viaCValue(t);
      if (typeof o !== 'string' || /원문|저본|판본/.test(o)) leak.push(t);
    }
    ck(G21, rowsPass(rows, HARD.canary_r10_neg_min) && leak.length === 0,
      rowsDetail(rows, HARD.canary_r10_neg_min) + ' · 부정 부재 시 차단 유지 위반 ' + leak.length + '건' +
      (leak.length ? '[' + leak.join(' / ') + ']' : ''));
  });
  const G22 = 'G22 ★R10-P3·P4 쌍별 정책 — 오탐 대조군 무변형 ∧ 차단 대조군 전건 차단';
  await asec(G22, async () => {
    if (blocked(G22)) return;
    const fp = await runRows(R10_PAIR_FP.map((t, i) => ({ id: 'PFP' + i, text: t })), async (c) => {
      const out = await viaCValue(c.text);
      if (typeof out !== 'string') return '반환형 오류';
      if (out !== c.text) return '★파손 → ' + JSON.stringify(out);
      return null;
    });
    const bl = await runRows(R10_PAIR_BLOCK.map((t, i) => ({ id: 'PBLK' + i, text: t })), async (c) => {
      const out = await viaCValue(c.text);
      if (typeof out !== 'string') return '반환형 오류';
      if (out === c.text) return '★차단 실패(무변형) → ' + JSON.stringify(out);
      if (out.indexOf('고전') === -1) return '★중립어 미치환 → ' + JSON.stringify(out);
      return null;
    });
    const fb = fp.filter((r) => r.bad !== null), bb = bl.filter((r) => r.bad !== null);
    ck(G22, rowsPass(fp, 6) && rowsPass(bl, 5),
      '오탐 대조군 ' + fp.length + '건 중 실패 ' + fb.length + (fb.length ? '[' + fb.map((r) => r.id + ':' + r.bad).join(' / ') + ']' : '') +
      ' · 차단 대조군 ' + bl.length + '건 중 실패 ' + bb.length + (bb.length ? '[' + bb.map((r) => r.id + ':' + r.bad).join(' / ') + ']' : ''));
  });

  const G23 = 'G23 ★스크럽 길이 상한 부재 — 절대 상한 표본 도달 ∧ 길이 기반 조기반환 가드 0건 (R11-5)';
  section(G23, () => {
    if (blocked(G23)) return;
    const bad = [];
    // ①표본 측 — 요구 길이 집합이 절대 상한에 실제로 도달하는가.
    //   maxTokens 파생값만 쓰면 파생 상한 바로 위에 cap 을 두는 것으로 관통된다(관통 G 실측).
    let lens = [];
    try { lens = LONG_SAMPLE_LENS(); } catch (e) { bad.push('장문 표본 길이 산출 실패: ' + (e && e.message)); }
    const maxLen = lens.length ? Math.max.apply(null, lens) : 0;
    if (maxLen < LONG_ABS_CAP) bad.push('★요구 길이 최대 ' + maxLen + ' < 절대 상한 ' + LONG_ABS_CAP);
    // ②정적 측 — 스크럽 경로에 길이 기반 조기반환 가드가 존재하면 그 자체가 상한이다.
    //   ★성질 판정: 구현 형태(cap 상수명 등)를 못박지 않고 「길이 비교 + return 이 붙어 있는가」만 본다.
    //   ★오탐 방지: 숫자 3자리 이상(>=100)만 본다. s.length > 0 같은 정당한 짧은 가드는 대상이 아니다.
    const L = FORTUNE().cjLines;
    const hits = [];
    for (let i = 0; i < L.length; i++) {
      const line = L[i];
      if (!LEN_GUARD_RE.test(line)) continue;
      const win = [line, L[i + 1] || '', L[i + 2] || ''].join(' ');
      if (/\breturn\b/.test(win)) hits.push('L' + (i + 1) + ': ' + line.trim().slice(0, 90));
    }
    if (hits.length > 0) bad.push('★길이 기반 조기반환 가드 ' + hits.length + '건 → ' + hits.slice(0, 3).join(' / '));
    // ③판정기 능력 증명 — 관통 형태를 실제로 잡는가(공허 통과 차단).
    const probe = ['function scrubText(s){', '  if (typeof s === \'string\' && s.length > 44000) return s;', '  return s;'];
    let probeHit = 0;
    for (let i = 0; i < probe.length; i++) {
      if (!LEN_GUARD_RE.test(probe[i])) continue;
      if (/\breturn\b/.test([probe[i], probe[i + 1] || '', probe[i + 2] || ''].join(' '))) probeHit++;
    }
    if (probeHit < 1) bad.push('★자기증명 실패 — 판정기가 길이 조기반환 형태를 적발하지 못함');
    ck(G23, bad.length === 0,
      '요구 길이 [' + lens.join('·') + '] · 최대 ' + maxLen + ' (절대 상한 ' + LONG_ABS_CAP +
      ') · 길이 가드 ' + hits.length + '건 · 자기증명 ' + probeHit + '건 · 위반 ' + bad.length + '건' +
      (bad.length ? ' → ' + bad.join(' / ') : ''));
  });

  /* ══ D축. ★v7.64 — 조건부 게이팅 전 클래스 구조적 방어 (관통 3·6·7·8·9) ═══════ */
  const D1 = 'D1 ★다중 환경 차분 — 시각·API 키·host 가 달라도 스크럽 결과가 동일';
  await asec(D1, async () => {
    if (blocked(D1) || !TK) { if (TK) return; ck(D1, false, '판정 불가' + tkNote()); return; }
    const YEAR = 365 * 24 * 3600 * 1000;
    const envs = [
      { id: 'ENV_NOW', apiKey: null, host: null, dateShiftMs: 0 },
      { id: 'ENV_FUTURE_3Y', apiKey: 'sk-ant-' + rtok(22, true), host: rtok(7, true) + '.vercel.app', dateShiftMs: 3 * YEAR },
      { id: 'ENV_PAST_4Y', apiKey: 'sk-ant-' + rtok(22, true), host: rtok(7, true) + '.invalid', dateShiftMs: -4 * YEAR },
      { id: 'ENV_FAR_FUTURE', apiKey: 'sk-ant-api03-' + rtok(30, false), host: rtok(5, true) + '.app', dateShiftMs: 40 * YEAR }
    ];
    const probe = payloadText() + ' ' + carry(TK.book);
    const outs = [];
    const rows = await runRows(envs, async (e) => {
      const req = reqOf('POST', { type: 'daily_message', context: {} }, '', e.host);
      const r = await drive(req, fetchOk(probe), { apiKey: e.apiKey, dateShiftMs: e.dateShiftMs });
      const t = r.body && r.body.result ? r.body.result.text : null;
      outs.push(typeof t === 'string' ? t : ('<' + typeof t + '>'));
      const lk = leaked(r.dump);
      if (lk) return '★누출 ' + lk;
      return null;
    });
    const uniq = outs.filter((v, i) => outs.indexOf(v) === i);
    ck(D1, rowsPass(rows, HARD.canary_env_min) && uniq.length === 1,
      '환경 ' + envs.length + '종 · 서로 다른 출력 ' + uniq.length + '종(기대 1) · ' +
      rowsDetail(rows, HARD.canary_env_min) +
      (uniq.length > 1 ? ' · ★환경 판별 게이팅 → ' + uniq.map((x) => JSON.stringify(x).slice(0, 70)).join(' VS ') : ''));
  });
  const D2 = 'D2 ★내용 지문 차분 — 코드펜스·마크다운·개행·HTML 문맥에서도 동일하게 스크럽';
  await asec(D2, async () => {
    if (blocked(D2) || !TK) { if (TK) return; ck(D2, false, '판정 불가' + tkNote()); return; }
    const core = payloadText();
    const wraps = [
      { id: 'WRAP_PLAIN', f: (x) => x },
      { id: 'WRAP_FENCE', f: (x) => '```\n' + x + '\n```' },
      { id: 'WRAP_FENCE_JSON', f: (x) => '```json\n' + x + '\n```' },
      { id: 'WRAP_MD', f: (x) => '## 제목\n\n' + x + '\n\n- 항목 1\n- 항목 2\n' },
      { id: 'WRAP_CRLF', f: (x) => x.split(' ').join('\r\n') },
      { id: 'WRAP_HTML', f: (x) => '<p>' + x + '</p>' },
      { id: 'WRAP_TAB', f: (x) => '\t' + x + '\t' }
    ];
    const rows = await runRows(wraps, async (w) => {
      const r = await drive(POST({ type: 'daily_message', context: {} }), fetchOk(w.f(core)));
      const lk = leaked(r.dump);
      if (lk) return '★누출 ' + lk;
      return null;
    });
    ck(D2, rowsPass(rows, HARD.canary_wrap_min), rowsDetail(rows, HARD.canary_wrap_min));
  });
  const D3 = 'D3 ★환경 지문 부재 — 적재 시 fetch == 호출 시 fetch · 상수 키·상수 host 0건';
  section(D3, () => {
    if (blocked(D3)) return;
    const bad = [];
    if (!RT.fetchInstalledBeforeImport) bad.push('fetch 교체가 import 이전에 이뤄지지 않음');
    if (!RT.fetchShim) bad.push('fetch 디스패처 미설치');
    if (RT.fetchAtImport !== RT.fetchShim) bad.push('★적재 시 fetch != 디스패처 (판별자 부활)');
    if (globalThis.fetch !== RT.fetchShim) bad.push('★현재 fetch != 디스패처 (구동 중 교체됨)');
    if (RT.fetchIdentityBroken) bad.push('★구동 도중 fetch 참조가 바뀐 이력 있음');
    // ★키·host 가 이 파일에 리터럴로 존재하면 그것이 곧 상수 지문이다.
    let self = '';
    try { self = fs.readFileSync(__filename, 'utf8'); } catch (e) { bad.push('자기 소스 판독 실패: ' + (e && e.message)); }
    let env = null;
    try { env = GATE_ENV(); } catch (e) { bad.push('게이트 환경 조립 실패: ' + (e && e.message)); }
    if (env) {
      if (self.indexOf(env.key) !== -1) bad.push('★API 키가 소스에 리터럴로 존재(상수 지문)');
      if (self.indexOf(env.host) !== -1) bad.push('★host 가 소스에 리터럴로 존재(상수 지문)');
      if (env.key.length < 24) bad.push('API 키 난수 길이 부족');
      if (RT.envKeyAtImport !== env.key) bad.push('★적재 시 API 키 != 구동 시 API 키');
    }
    ck(D3, bad.length === 0,
      'import 이전 설치=' + RT.fetchInstalledBeforeImport + ' · 참조 동일=' + (RT.fetchAtImport === RT.fetchShim) +
      ' · 위반 ' + bad.length + '건' + (bad.length ? ' → ' + bad.join(' / ') : ''));
  });

  /* ══ V축. 배포 배제 목록 (R9) ═══════════════════════════════════════════ */
  const V1 = 'V1 .vercelignore·.gitignore 가 _v 접두 작업본·_mvtest 를 배제';
  section(V1, () => {
    if (blocked(V1)) return;
    const ig = IGN();
    const need = ['_v*/', '_mvtest/'];
    const missV = need.filter((n) => ig.v.patterns.indexOf(n) === -1);
    const missG = need.filter((n) => ig.g.patterns.indexOf(n) === -1);
    ck(V1, missV.length === 0 && missG.length === 0,
      '.vercelignore 패턴 ' + ig.v.patterns.length + '건/누락 ' + missV.length + (missV.length ? '[' + missV.join(',') + ']' : '') +
      ' · .gitignore 패턴 ' + ig.g.patterns.length + '건/누락 ' + missG.length + (missG.length ? '[' + missG.join(',') + ']' : ''));
  });
  const V2 = 'V2 두 배제목록의 작업본 배제 집합 동일';
  section(V2, () => {
    if (blocked(V2)) return;
    const ig = IGN();
    const pick2 = (a) => a.filter((p) => p.charAt(0) === '_').sort();
    const uv = pick2(ig.v.patterns), ug = pick2(ig.g.patterns);
    const onlyV = diffSets(uv, ug), onlyG = diffSets(ug, uv);
    ck(V2, uv.length >= HARD.ignore_underscore_min && ug.length >= HARD.ignore_underscore_min &&
      onlyV.length === 0 && onlyG.length === 0,
      'vercel ' + uv.length + '건 · git ' + ug.length + '건 (pin >=' + HARD.ignore_underscore_min + ') · vercel전용 ' +
      onlyV.length + (onlyV.length ? '[' + onlyV.join(',') + ']' : '') + ' · git전용 ' + onlyG.length +
      (onlyG.length ? '[' + onlyG.join(',') + ']' : ''));
  });
  const V3 = 'V3 ★backup_pre_* 경로가 양쪽에서 배제 판정 · 배포 필수 파일은 보존';
  section(V3, () => {
    if (blocked(V3)) return;
    const ig = IGN();
    const mustBlock = ['_v761_work/backup_pre_P0A/index.html', '_v762_work/backup_pre_P1/fortune.js',
      '_v763_work/backup_pre_P0/fortune.js', '_v760/index.html', '_mvtest/index.html'];
    const mustKeep = ['api/fortune.js', 'index.html', 'js/chat.js'];
    const bad = [];
    for (const rel of mustBlock) {
      if (!ignoreHit(ig.v.patterns, rel)) bad.push('vercel 미배제: ' + rel);
      if (!ignoreHit(ig.g.patterns, rel)) bad.push('git 미배제: ' + rel);
    }
    for (const rel of mustKeep) {
      const hv = ignoreHit(ig.v.patterns, rel);
      if (hv) bad.push('vercel ★과잉배제: ' + rel + ' ← ' + hv);
      const hg = ignoreHit(ig.g.patterns, rel);
      if (hg) bad.push('git ★과잉배제: ' + rel + ' ← ' + hg);
    }
    ck(V3, bad.length === 0,
      '배제 요구 ' + mustBlock.length + '경로 · 보존 요구 ' + mustKeep.length + '경로 · 위반 ' + bad.length + '건' +
      (bad.length ? ' → ' + bad.slice(0, 6).join(' / ') : ''));
  });

  return results;
}

// ★M9 보조 — 화이트리스트 밖이면 true(=적발). falsy 블랙리스트를 쓰지 않는 이유는 R5-2 참조.
function D_EXIT_ROW_ALLOW_TEST(v) { return D_EXIT_RAW_ALLOW.indexOf(String(v).trim()) === -1; }

// ──────────────────────────────────────────────────────────────
// 11. ★단일 exit 집계 구획 — 여기 하나뿐이다 (L3)
// ──────────────────────────────────────────────────────────────
function finalize() {
  pinChecks(results, EXPECTED_TOTAL, pushFail);
  if (results.length !== EXPECTED_TOTAL && results.length >= EXPECTED_TOTAL) {
    pushFail('SELF 등록 검사 수 불일치', '등록 ' + results.length + ' != 기대 ' + EXPECTED_TOTAL);
  }
  let pass = 0, fail = 0;
  const failLines = [];
  for (const r of results) {
    if (r.pass) pass++;
    else { fail++; failLines.push('  FAIL ' + r.id + '  -> ' + r.detail); }
  }
  // ★진단용 전체 목록 — 판정에는 영향이 없다. 공허 통과 의심 시 CW_SCRUB_VERBOSE=1 로 확인한다.
  if (process.env.CW_SCRUB_VERBOSE) {
    for (const r of results) console.log('  ' + (r.pass ? 'PASS ' : 'FAIL ') + r.id + '  -> ' + r.detail);
  }
  if (failLines.length) {
    console.log('[response_scrub] 실패 내역');
    failLines.forEach((l) => console.log(l));
  }
  // ★R5-7 — 검사 대상 sha256 기록. 배포 산출물과의 결속 증거다.
  console.log('[response_scrub] target=' + (RT.srcSha ? 'api/fortune.js sha256=' + RT.srcSha : 'MISSING') +
    ' · canary_seed=' + SEED);
  console.log('[response_scrub] total=' + results.length + ' pass=' + pass + ' fail=' + fail);
  try { if (RT.copyPath && fs.existsSync(RT.copyPath)) { fs.unlinkSync(RT.copyPath); fs.rmdirSync(path.dirname(RT.copyPath)); } } catch (e) { /* 임시파일 정리 실패는 판정에 영향 없음 */ }
  return fail === 0 ? 0 : 1;
}

process.on('unhandledRejection', (e) => {
  console.log('[response_scrub] FATAL(fail-closed) unhandledRejection: ' + ((e && e.message) || String(e)));
  process.exit(1);
});

main().then(() => { process.exit(finalize()); }).catch((e) => {
  pushFail('SELF main 예외', 'EXCEPTION(fail-closed): ' + ((e && e.message) || String(e)));
  process.exit(finalize() || 1);
});
