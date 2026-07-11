# 天運 (천운, ChunWoon) — 인수인계 문서

**작성일**: 2026-05-16  
**작성자**: 김재환 + Claude Sonnet 4  
**대상**: 미래의 나 / 신규 개발자 / 협업자

---

## 1. 프로젝트 한 줄 소개

한국형 종합 AI 운세 PWA. 사주·궁합·타로·꿈해몽·관상·토정비결·작명·데일리 한 마디 8종을 Claude Sonnet 4로 심층 풀이해서 무료 + 프리미엄(₩4,900~₩29,900) 리포트로 제공. Toss Payments 실 결제 통합 완료.

- **도메인**: https://chunwoon-app.vercel.app
- **GitHub**: `saeronjhk-cloud/chunwoon-app`
- **Vercel 프로젝트**: `chunwoon-app`
- **현재 버전**: Service Worker `v3.23.0`, 커밋 `ab0fb8a` 기준

---

## 2. 사업자 정보 (Footer 표시 · Toss 심사 대응)

| 항목 | 값 |
|------|-----|
| 상호 | **새론 비즈** |
| 대표자 | **김재환** |
| 사업자등록번호 | **470-54-00648** (일반과세자) |
| 개업연월일 | 2022-06-10 |
| 사업장 | 서울특별시 송파구 올림픽로 300, 월드타워동 64층 6402호 (신천동, 롯데월드타워앤드롯데월드몰) |
| 업태/종목 | 도매 및 소매업 / 기타 가공식품 도매업, **전자상거래 소매업** |
| 통신판매업 신고 | ⚠️ **준비 중** (송파구청 신고 필요, ₩7,500) |
| 고객문의 | privacy@chunwoon.app |
| 호스팅 | Vercel Inc. |

---

## 3. 아키텍처

### 파일 구조

```
D:\AI ChunWoon\
├── index.html                    (~8,900줄, 메인 SPA)
├── sw.js                         (Service Worker, PWA 캐시)
├── manifest.json                 (PWA 설정)
├── vercel.json                   (Vercel 배포 설정)
├── HANDOVER.md                   (← 이 파일)
├── 천운_종합검증용_문서.md         (외부 LLM 평가용)
├── api/
│   ├── fortune.js               (LLM 프롬프트 40+ 종, Claude API 호출)
│   └── confirm-payment.js       (Toss 결제 승인 백엔드)
├── js/
│   ├── tarot.js                 (타로 풀스택 - 외부 모듈)
│   ├── chat.js                  (데일리 한 마디 - 외부 모듈)
│   ├── toss-pay.js              (Toss Payments 통합)
│   └── disclaimer.js            (첫 진입 면책 배너 + 작명 상표 경고)
├── icons/                       (PWA 아이콘 SVG)
└── .env.local                   (⚠️ gitignore - 로컬 시크릿)
```

### 데이터 흐름 (예: 사주)

```
사용자 입력 (이름·양음력·생년월일·시·성별)
    ↓
analyzeSaju() [index.html]
    ↓ 로컬 계산 (24절기, 4기둥, 오행)
window._sajuResultData = {...}
    ↓
fetch('/api/fortune', {type:'saju', context:{...}})
    ↓ Claude Sonnet 4 (claude-sonnet-4-20250514)
JSON 응답 { summary, dayMaster, decades[8], ... }
    ↓
renderSajuResult() → 무료 카드 표시 + 페이월 카드
    ↓ [사용자가 페이월 클릭]
unlockSajuPremium()
    ↓
window.payWithToss('saju') → Toss 결제창 → successUrl
    ↓
_handleTossSuccessCallback() → /api/confirm-payment 승인
    ↓
markPremiumPayment() (30일 activation)
    ↓
자동 탭 이동 → 결과 카드 DOM 복원 → unlockSajuPremium 자동 호출
    ↓ Claude Sonnet 4 (max_tokens 2500~9500 종류별)
프리미엄 리포트 표시
```

---

## 4. 기능 목록 (v3.23.0 유지 8종)

| 기능 | 무료 | 프리미엄 | 가격 | 음/양력 |
|------|------|---------|-----|--------|
| 데일리 한 마디 | ✅ | 3/일 (프리미엄) | — | — |
| 타로 (라이더-웨이트) | ✅ | 켈틱크로스 10장 | ₩4,900 | — |
| 사주 (4기둥) | ✅ | 8단계 대운·격국 | ₩4,900 | ✅ |
| 궁합 (7가지 관계 유형) | ✅ | 5영역 심층·시나리오 | ₩4,900 | ✅ |
| 토정비결 (12개월) | ✅ | 사업·건강·개운법 | ₩4,900 | ✅ |
| 꿈해몽 (14대분류) | ✅ | 5구간 시점별 | ₩4,900 | — |
| 관상 (FaceMesh 468) | ✅ | 12궁·오관·명궁 | ₩4,900 | — |
| 작명 (5종: 사람·회사·제품·반려·닉네임) | ✅ | 사람/회사/제품 프리미엄 | ₩29,900 | ✅ |

### 제거된 기능 (진정성 원칙)

- **부적** — 초기 제거 (미신적 과금)
- **운세 매칭** (v3.20에서 제거) — 궁합과 중복, 사용자 기대(데이팅) 불일치
- **손금** (v3.22에서 제거) — MediaPipe Hands 21 랜드마크로는 실제 손금 감지 X, 40%가 의사난수

---

## 5. 결제 시스템 (Toss Payments)

### 현재 상태

- **가맹점 MID**: `fihubscj0k`
- **심사 상태**: 신청 접수 완료 (2026-05-15), 1~7일 내 결과 통보
- **테스트 클라이언트 키**: `test_ck_DpexMgkW36wKXn24okn4VGbR5ozO`
- **테스트 시크릿 키**: Vercel 환경변수 `TOSS_SECRET_KEY` 등록 완료 (Production 환경)
- **테스트 카드**: `4330 1234 1234 1234` / 12/30 / 123 / 비밀번호 앞 2자리 `00`

### 결제 흐름 특징

- **Redirect 방식** (모바일·PC 통합)
- **successUrl 콜백에서 자동 복원**: 결제 전 결과 DOM + 데이터를 sessionStorage에 저장, 결제 후 자동 복원 + 자동 unlock 호출
- **30일 무제한**: 한 번 결제 = 30일간 모든 프리미엄 무료 (`cw_premium_last_payment` localStorage)
- **이중 결제 방지**: `_isPremiumPaidActive()` 체크로 30일 이내 결제 회원이면 결제창 skip

### 실 결제 전환 절차 (심사 통과 후)

1. Toss 개발자센터 → **라이브 API 키** 발급
2. `js/toss-pay.js` line 10 → `TOSS_CLIENT_KEY`를 `live_ck_xxx`로 교체
3. Vercel 대시보드 → Environments → `TOSS_SECRET_KEY`를 `live_sk_xxx`로 교체
4. `git push` → Vercel 자동 재배포

**주의**: 테스트 키에서 라이브 키로 넘어가면 실제 카드 청구 + 정산 시작. 첫 결제 시 신중히 검증.

---

## 6. 배포 & 환경변수

### 배포 흐름

- **git push** → GitHub `saeronjhk-cloud/chunwoon-app` main → Vercel 자동 빌드 (1~2분) → chunwoon-app.vercel.app 반영

### 환경변수 (Vercel Production)

| Key | 용도 |
|-----|------|
| `ANTHROPIC_API_KEY` | Claude Sonnet 4 API 호출 (api/fortune.js) |
| `TOSS_SECRET_KEY` | Toss 결제 승인 API (api/confirm-payment.js) |

### 로컬 개발 (선택)

`D:\AI ChunWoon\.env.local` (gitignore 자동):

```
ANTHROPIC_API_KEY=sk-ant-xxx
TOSS_SECRET_KEY=test_sk_xxx
```

`vercel dev` 실행 후 localhost:3000에서 테스트.

**주의**: PowerShell에서 `cd "D:\AI ChunWoon"` (공백 때문에 따옴표 필수).

---

## 7. 기술 스택

- **프론트엔드**: 순수 HTML + CSS + Vanilla JS (프레임워크 없음)
- **PWA**: Service Worker (chunwoon-v3.23.0), 오프라인 캐시
- **백엔드**: Vercel Serverless Functions (Node.js)
- **LLM**: Anthropic Claude Sonnet 4 (`claude-sonnet-4-20250514`)
- **결제**: Toss Payments SDK v2 (`https://js.tosspayments.com/v2/standard`)
- **얼굴 인식**: MediaPipe FaceMesh (468 랜드마크, 관상 전용)
- **이미지 처리**: OpenCV.js (관상 특징 강조)

---

## 8. 노션 개발 일지 (전 기록)

📑 **[천운 개발 일지 — 종합 인덱스 (날짜순)](https://www.notion.so/361e844981478137b507c78eb5b9576f)**

각 기능별 개발 배경·의사결정·문제·해결이 12개 페이지로 정리되어 있음. 명명 규칙 `[YYYY-MM-DD] 천운 — 기능명`.

주요 페이지:
- [2026-04-29] 관상
- [2026-05-06] 토정비결
- [2026-05-09] 사주·궁합·꿈해몽
- [2026-05-10] 작명
- [2026-05-12] 타로·데일리 한 마디
- [2026-05-13] Gemini 평가·면책
- [2026-05-15] 매칭·손금 제거·궁합 강화·음력 변환

---

## 9. 남은 작업 (우선순위)

### 🔴 출시 필수

- [ ] **통신판매업 신고** (송파구청, ₩7,500)
- [ ] **Toss 라이브 키 발급 + 교체** (심사 통과 후)
- [ ] **첫 실 결제 검증** — 본인 카드로 ₩4,900 결제 후 정상 청구·정산 확인

### 🟡 출시 전 권장

- [ ] `.palm-guide` 등 손금 CSS 잔재 정리
- [ ] Vercel dev assertion 에러 해결 (Task #83) — 로컬 개발 안정성
- [ ] 베타 테스터 5~10명 모집 (친구·지인)
- [ ] 인스타그램·블로그 마케팅 콘텐츠

### 🟢 v2 로드맵

- [ ] Supabase — 회원가입·결제 이력 서버 저장
- [ ] PWA 푸시 알림 — 데일리 한 마디 자동 발송 (VAPID 키 필요)
- [ ] 소셜 로그인 (카카오·구글)
- [ ] 결과 이미지 카드 (인스타 공유용)

---

## 10. 알려진 이슈

| 이슈 | 우회 방법 |
|------|----------|
| SW 캐시가 옛 버전 붙잡음 | F12 → Application → Storage → Clear site data + Unregister |
| Windows에서 폴더 경로 공백 문제 | 명령어에 따옴표: `cd "D:\AI ChunWoon"` |
| `vercel dev` 시작 assertion 에러 | 원인 미확인. 배포된 사이트 사용 권장 |
| 관상학·꿈해몽은 과학적 근거 없음 | Footer 면책 조항 + disclaimer.js 배너로 대응 |
| PowerShell git push에 인증 문제 | GitHub Personal Access Token 필요 (settings/tokens) |

---

## 11. 명령어 치트시트 (PowerShell)

```powershell
# 프로젝트 디렉토리 이동
cd "D:\AI ChunWoon"

# git 커밋·푸시
git status
git add -A
git commit -m "메시지"
git push

# 미푸시 커밋 확인
git log origin/main..HEAD --oneline

# 로컬 개발 서버
vercel dev

# 시크릿 창에서 테스트 접속
# Ctrl+Shift+N → https://chunwoon-app.vercel.app
```

---

## 12. 브랜딩·자산

- **이름**: 天運 (천운, ChunWoon), 영문 FORTUNE & DESTINY
- **컬러**: 골드 `#c9a54e`, 로열 브라운 `#8b6914`
- **폰트**: Noto Serif KR (제목), Noto Sans KR (본문)
- **아이콘**: `/icons/icon-192.svg`, `/icons/icon-512.svg`, `/icons/favicon.svg`
- **PWA 이름**: "천운 - 종합 운세"

---

## 13. 사용자 데이터 & 개인정보

- **회원 시스템 없음** (비회원 사용)
- **localStorage 저장**:
  - `cw_customer_key` — Toss 결제 식별용 UUID 유사값
  - `cw_premium_last_payment` — 마지막 결제 타임스탬프 (30일 프리미엄)
  - `cw_receipts` — 최근 50건 영수증
  - `cw_disclaimer_accepted` — 면책 배너 동의 여부
- **서버 저장 없음** — Vercel serverless는 stateless
- **개인정보처리방침 · 이용약관** — index.html 내 모달

---

## 14. 컨택 & 자원

- **개발자**: 김재환 (saeronjhk@gmail.com)
- **회사**: 새론 비즈
- **GitHub**: https://github.com/saeronjhk-cloud/chunwoon-app
- **Vercel**: https://vercel.com/saeronjhk-cloud
- **Toss 개발자센터**: https://developers.tosspayments.com
- **Anthropic Console**: https://console.anthropic.com
- **노션 인덱스**: https://www.notion.so/361e844981478137b507c78eb5b9576f

---

## 15. 30초 요약

천운은 8종 AI 운세 PWA. 순수 vanilla JS + Claude Sonnet 4로 돌아가고 Vercel에 배포됨. Toss Payments 통합 완료(테스트 키 상태). 매칭·손금은 진정성 원칙으로 제거. 사업자(새론 비즈) 등록 완료, Toss 심사 대기 중. 심사 통과 후 라이브 키만 교체하면 실 매출 시작 가능.

**첫 1분 온보딩 순서**:
1. https://chunwoon-app.vercel.app 접속 (시크릿 창)
2. 사주 → 이름·생년월일 입력 → 분석 → 프리미엄 결제 (테스트 카드)
3. Vercel 대시보드에서 배포 확인
4. 노션 인덱스에서 개발 히스토리 파악

문제 있으면 [노션 인덱스](https://www.notion.so/361e844981478137b507c78eb5b9576f)의 해당 기능 페이지 열고 개발 배경 확인.

---

*"모두는 각자의 운명을 손에 쥐고 있다. 이 프로젝트를 인수하는 그대도."*
