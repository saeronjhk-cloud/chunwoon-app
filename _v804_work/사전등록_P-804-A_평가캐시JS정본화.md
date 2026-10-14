# 사전 등록 P-804-A — 평가 캐시 JS 정본화 (결과를 보기 전에 고정)
작성 2026-10-14 · v804 세션 · 원칙 14·15·35 · 인수인계 v803 §6 ①

> 이 문서는 **JS 캐시로 평가를 한 번도 돌리기 전에** 커밋한다. 이후 규칙을 바꾸려면 「사후」 표시와 이유를 남긴다.

## 0. 이미 확인한 사실 (결과 아님 · v803 d31 재확인 수준)
- `parity/js_ref0.json` = 앱 엔진(face_mesh 0.4 JS · refine 끔 · still) 127장. 파이썬 캐시와 키·w·h 전부 일치 · 랜드마크 차 중앙 0.51% / 최대 1.32%(얼굴폭 대비).
- 캐시를 읽는 스크립트 45개(평가 p16~p40 · 진단 d01~d31 · 생성기 calib_real_anchor·d15·d25·x03).
- `eval_selfie/gray/hl_landmarks.json` = 인터넷 23장 캐시와 바이트 동일한 복제본 → 같이 교체.

## 1. 정본 전환 방식 (기술 · 판단 사항 아님)
- 도구 `_v804_work/cw_lm_engine.js` — `--init`(1회) · `--set js|py` · `--status`.
- 각 캐시 폴더에 `landmarks_py.json`(v803까지 · 보존) · `landmarks_js.json`(정본) · 활성 `landmarks.json` · 표지 `ENGINE.json`.
- 라벨셋 부가 필드(pid·kind·f35·**distCm·faceW_orig**)와 셀카 `orig_lm_frac.json`은 원본 프레임 기준 파이썬 값 유지(남은 차이로 기록 — near 34~57cm · far 101cm+ 라 src='live'(≤60cm) 판정이 바뀔 여지는 없음).
- 평가 스크립트는 고치지 않는다.

## 2. 측정 (1회 · JS 활성)
- 첫 10분 28종 전부 + 진단 d26·d27·d31(요약 수치만).
- 각 평가 항목을 아래로 분류해 표로 남긴다.
  - **F형(기록 대조)**: 「저장된 fixture == 캐시에서 다시 계산한 값」을 보는 항목. → fixture가 **기록용**이면 JS로 재생성(생성 스크립트만 · 수치 손수정 금지). fixture가 **운영 상수의 원천**이면 §3 규칙.
  - **P형(성질)**: 임계를 가진 성질 검사. → **임계 변경 금지**. PASS→FAIL은 「발견」으로 기록하고 §3 재생성 뒤 다시 본다. 재생성 뒤에도 FAIL이면 「FAIL 정상(JS)」 후보로 이유와 함께 제이에게 보고(기준 완화 아님).
  - 기존 「FAIL 정상」 7건(p16 T3 · p30 F3·F4 · p32 G4·G8·G9 · p34 S5·S8·S5b)은 상태만 기록.

## 3. 운영 상수 재생성 규칙 (생성기 무수정 · 입력만 JS)
| 상수 | 생성기 | 규칙 |
|---|---|---|
| **REF** (`REF-SYNTH-v794-REALANCHOR`) | `_v792_work/calib_real_anchor.js` → `real_anchor_v2.json` → `p03_build` | 재생성 후보 `REF-SYNTH-v804-JSANCHOR-…`. **채택 조건 = p17 전 항목 PASS**(JS 캐시 기준). 변화량(축별 랭크 이동 중앙·최대)은 보고만 하고 채택 판단에 쓰지 않는다. |
| **JAWCORNER** | `_v799_work/d25_gen_jawcorner_ref.js` | 후보 `JAWCORNER-REF-v2-…`. 채택 조건 = p34의 「FAIL 정상」 외 항목 전부 PASS. k0·eps 변화는 보고만. |
| **PERSP-v2** | `_v799_work/d15_gen_persp_v2.js` | **이번에는 채택하지 않는다**(원칙 20 「기존 계수 변경은 다른 기종 ≥3명 전향 검증 후」). d15를 JS로 진단 실행만 하고 결과는 아이폰 회차 입력으로 넘긴다. |
| **미소** (`SMILE-CELEBA-v1`) | x02 (CelebA 파이썬 특징) | 재학습하지 않는다. 단 p38이 JS에서 PASS→FAIL이 생기면 그때만 CelebA **검증셋** 600장을 JS 하네스로 재추출해 무표정 경고율 차 > 1.5%p 이면 재학습 안건으로 올린다. 시험셋 test-00000 재사용 금지. |
| **안경 v2** (CNN) | t04~t06 | 재학습하지 않는다. p23·p27이 JS에서 PASS→FAIL이 생길 때만 원인 진단. |

## 4. 운영 반영
- §3에서 채택된 REF·JAWCORNER는 빌드 → index 치환 → 28종 전수 → 커밋 → push → 운영 해시 확인.
- 반영 시점은 제이 결정(이 문서 커밋 직후 질문 1건).

## 5. 하지 말 것
- JS 결과를 본 뒤 §2·§3 규칙·임계 변경(바꾸면 「사후」 표시).
- 파이썬 캐시 삭제(보존본 `landmarks_py.json`).
- PERSP 계수 변경.
