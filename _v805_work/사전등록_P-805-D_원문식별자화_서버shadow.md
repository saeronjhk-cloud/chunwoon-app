# 사전 등록 — P-805-D 트랙 D: 원문 식별자화 + 서버 shadow (2026-10-15 · 구현 전 · 결과 보기 전)

## 목적
POC 사주 엔진(v7.70 — `D:\ChunWoon_IP\gate_pkg\engine\saju_resolver.computeSajuReading`: 억부·월령격국·상신·조후·대운·신살·以刑衝解刑衝 보정)을
서버(api/fortune.js 사주 3종)에서 **계산만** 하고 결과는 Vercel 로그 한 줄로만 남긴다. 화면·LLM·응답 JSON에는 0건.
authority DENY 축(yongsin·gisin·gyeok·sangsin·johu·verdict·daewoon_start_age)은 그대로 DENY.

## 배포판 생성 규칙(고정)
- 생성기: `D:\ChunWoon_IP\gate_pkg\tools\build_shadow_dist.js` (IP 쪽) — 입력 = gate_pkg `engine/` 의 resolver 의존 폐포(실행 추적으로 결정) + 그것이 읽는 `IP/rules/saju/*.json`. 출력 = repo `api/_engine/shadow/{engine,IP/rules/saju}/`(상대경로 구조 보존 → 엔진 코드 경로 수정 0) + IP 쪽 대응표 `gate_pkg/dist/shadow_citation_map.json`(배포 금지).
- **원문 문자열** 정의: 문자열(JS 문자열 리터럴·JSON 값·JSON 키) 안에 한자 연속 구간(한자와 、。，；：？！… 로 이어진 구간, 한자 10자 이상 — pre-commit 「원문 검사」와 같은 정의)이 있고, 그 구간이 간지·오행 글자(甲~癸·子~亥·木火土金水)만으로 된 조회표가 아닌 것. 또는 문헌명 어휘(claim_whitelist 등재 4종·인용 제외 2종·미등재 10종의 한글명·한자명 + 변형 眞詮/真詮/闡微/評註)를 포함하는 것.
- 원문 문자열은 통째로 `cite:` + sha256(원 문자열 UTF-8) 앞 12자로 바꾼다(내용 주소 → 같은 원문은 같은 식별자, 엔진 비교 동작 보존). 대응표는 IP에만.
- JS 주석은 전부 제거한다. `${}` 가 있는 템플릿 리터럴이 원문 문자열이면 생성기 실패(fail-closed).
- POC 원본(IP)은 바이트 불변.

## 평가 p44 (`_v805_work/p44_shadow_engine_eval.js`) — 구현 전 작성, FAIL 확인 후 구현
| ID | 기준 |
|---|---|
| D1 | 번들(api/_engine/shadow) 파일 ≥ 16 · 각 파일 원문 문자열 측정 0 · 문헌명 어휘 0 |
| D2 | POC 폐포 파일의 원문 구간(10자 창) 이 api/ 전체 어디에도 0건(R1 root_system SRC_JCS_A 5,529자 · R2 chung_conditional basis 포함) |
| D3 | 번들의 cite 식별자 전부가 IP 대응표로 되돌려지고(id = sha12(원문)) · chung_conditional·root_system 각각 cite ≥ 1 |
| D4 | fortune.js: 사주 3종에서 shadow 호출 · 결과 변수는 `[shadow]` console.log 에만 쓰임(응답·프롬프트·parsed 0건) |
| D5 | 결정성: 고정 표본 600 명식에서 번들 출력 = POC 출력(원문 문자열을 같은 규칙으로 cite 치환) · 2회 실행 동일 |
| D6 | shadow 실패 = 로그만: 잘못된 입력(null·{}·깨진 간지·3기둥) → 예외 없이 null/skip · 600 명식 중앙 실행 시간 < 20ms |
| D7 | authority DENY 7축 불변 · 패키지 `CW_PROMOTED` 추가분 = [iljin_ganzi, sinsal] 그대로 · 번들 authority.js = api/_engine/authority.js 바이트 동일 |
| D8 | vercel.json functions["api/fortune.js"].includeFiles 가 `api/_engine/shadow/**` 포함 · .vercelignore 가 api/ 허용 |
| D9 | 로그 요약: 600 명식 모두 입력 간지 문자열·생년 없음 · 원문 문자열 0 · ≤ 700바이트 · 엔진 버전 표기 |
| D10 | 문법(번들 js 전부 · fortune.js) |

## 완료 조건
p44 10/10 · 기존 28종·p41~p43 · run_gate · 패키지 run_eval · 슬라이스 57 · 운영 배포 후 Vercel 로그 `[shadow]` 1건 이상(제이 확인).

## ★사후 기록 (구현 중 · 2026-10-15) — 기준 완화 없음
1. **원문 정의 강화**: D2(10자 창 가드)가 첫 생성본에서 root_system.json·root_engine.js 의 짧은 인용(「長生祿刃。根之重者也」 = 한자 9자 + 구두점)을 적발. 생성기와 p44 판정 함수 모두 「구두점이 든 구간은 전체 길이 10 이상이면 원문」을 추가(cite 431 → 447). D2 는 그대로.
2. **D9 판정기 결함 정정**: 입력 해시 `ih`(16진 8자)의 숫자가 연도 정규식(19[5-9]\d)에 오탐 → 연도 검사에서 `ih` 만 빼고 본다. 나머지 검사(입력 간지·원문·문헌명·크기·버전) 그대로.
- 결과: 구현 전 1/10 → 10/10 (`_v805_work/p44_prefix.log` → `p44.log`).
