// 천운 — 게이트·프로브 공용 임시 디렉터리 (v7.75 신설 · I-62)
// ═══════════════════════════════════════════════════════════════════════════
// 【왜 필요한가 — 실측된 사고】
//   게이트와 뮤테이션 하네스는 `fs.mkdtempSync` 로 `api/` 트리와 `index.html` 을
//   통째로 복사한다(뮤턴트 1종당 1벌, tojeong 게이트는 회차당 1벌). 그런데 **한 번도
//   지우지 않았다.** v7.75 세션 중 `/sessions` 가 **100% 포화**(9.3G/9.8G)됐고,
//   그 순간부터 **모든 게이트가 `ENOSPC` 로 실패**했다.
//   ★위험한 것은 실패 자체가 아니라 **오진**이다 — 게이트가 갑자기 느려지고
//     타임아웃처럼 보여서 「샌드박스 시간 상한」으로 원인을 잘못 짚었다.
//     디스크를 비우자 같은 게이트가 **0.27초**에 끝났다.
//
// 【이 헬퍼가 보장하는 성질】
//   「`mk()` 로 만든 디렉터리는 **프로세스가 어떻게 끝나든** 남지 않는다.」
//   정상 종료 · 예외 종료 · SIGINT/SIGTERM 전부 해당한다.
//
// 【왜 `_` 접두인가】
//   `tools/run_gate.js` 의 `NOT_A_GATE` 가 `^_` 를 게이트 목록에서 제외한다.
//   이 파일은 검사가 아니라 **공용 헬퍼**이므로 단독 실행 대상이 아니다.
//   ★단 그만큼 **자동 pin 확장(`--expand`)에서도 빠진다** — 그래서
//     `eval_gate_asset_commit.js` 의 `REQUIRED` 와 pin 표에 **명시적으로** 넣었다.
//     (v7.73 I-44 의 교훈: 목록에서 빠진 자산은 조용히 무감시가 된다.)
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

/** 이 프로세스가 만든 임시 디렉터리 전건. 정리 순서는 만든 역순. */
const MADE = [];
let hooked = false;

function rmrf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (e) { /* 정리 실패가 판정을 바꾸지 않는다 */ }
}

/** 등록된 임시 디렉터리를 전부 지운다. 여러 번 불려도 안전하다(멱등). */
function cleanup() {
  while (MADE.length) rmrf(MADE.pop());
}

function hook() {
  if (hooked) return;
  hooked = true;
  // ★`exit` 는 정상 종료 · `process.exit()` · 미처리 예외 뒤에도 발화한다.
  //   게이트는 전부 `process.exit(fail ? 1 : 0)` 로 끝나므로 이 한 줄이 본체다.
  process.on('exit', cleanup);
  // ★신호로 죽을 때는 `exit` 가 발화하지 않는다. 하네스를 Ctrl-C 로 끊거나
  //   `timeout` 이 SIGTERM 을 보내는 경우가 실제로 잦다(샌드박스 실측).
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    try { process.on(sig, () => { cleanup(); process.exit(130); }); } catch (e) { /* 신호 미지원 환경 */ }
  }
}

/**
 * `fs.mkdtempSync` 의 대체. **게이트·프로브는 이 함수만 쓴다.**
 * @param {string} prefix `cw_` 로 시작하는 접두사(예: 'cw_ctxg_')
 * @returns {string} 만들어진 디렉터리 절대경로
 */
function mk(prefix) {
  hook();
  const d = fs.mkdtempSync(path.join(os.tmpdir(), String(prefix || 'cw_tmp_')));
  MADE.push(d);
  return d;
}

module.exports = { mk, cleanup, MADE };
