// eval/_failclosed.js — eval 공용 fail-closed 유틸 (결정 41 패치 B·C · 2026-07-28 v7.60)
// ────────────────────────────────────────────────────────────────────────────
// 【수리 대상 결함 2종】
//  (1) 톱레벨 즉사 — require/readFileSync/사전 assess() 가 톱레벨에 있어, 데이터가 한 건만
//      사라져도 검사가 0건 등록된 채 스택트레이스로 죽는다. 「판정 못함」이 기록되지 않는다.
//      (실측: eval_metamorphic_hoehap_g.js 는 IP 앵커 키만 지워도 정상 41줄 → stdout 0줄)
//  (2) ★공허 통과 — 배열이 비면 `.every()` 가 true 를 돌려주어 검사가 「통과」한다.
//      부호가 뒤집히지 않은 (1)과 달리 (2)는 **거짓 녹색**을 만든다. 가장 위험하다.
//      (실측: eval_distribution_guard.js 의 SCAN 이 비면 C9 가 공허 통과)
//
// 【사용법】
//   const { lazy, mkSection, pinCount, everyNonEmpty } = require('./_failclosed');
//   const CASES = lazy(() => require('./fixtures/x.json'));   // 최초 참조 시 1회 평가
//   const section = mkSection(results, ck);                    // 블록 예외를 FAIL 로 계상
//   section('§M', () => { ... });
//   pinCount(ck, 'CASES', () => Object.keys(CASES()).length, 16);
'use strict';

/** 지연 평가 — 최초 참조 시 1회 실행, 예외는 저장해 재던진다(호출부에서 FAIL 로 잡히도록). */
function lazy(fn) {
  let done = false, val, err;
  return () => {
    if (!done) { done = true; try { val = fn(); } catch (e) { err = e; } }
    if (err) throw err;
    return val;
  };
}

/**
 * 블록 단위 예외 봉인. body 가 던지면 FAIL 1건을 results 에 계상하고 계속 진행한다.
 * push 는 eval 마다 ck 시그니처가 달라(ck(id,cond,detail) / ck(sec,id,cond,detail))
 * 결과 레코드를 직접 넣는 함수를 받는다.
 */
function mkSection(pushFail) {
  return function section(id, body) {
    try { body(); }
    catch (e) { pushFail(`${id} [BLOCK]`, `EXCEPTION(fail-closed): ${e && e.message}`); }
  };
}

/** 데이터 건수 하한 pin — 데이터가 축소·소실되면 즉시 FAIL. */
function pinCount(ckFn, label, getN, min) {
  let n = null, msg = '';
  try { n = getN(); } catch (e) { msg = `EXCEPTION(fail-closed): ${e && e.message}`; }
  ckFn(`SELF ${label} 건수 하한 pin(${min})`, n !== null && n >= min, msg || `n=${n}`);
}

/** 공허참 차단 — 길이 하한과 짝지어야만 every 를 신뢰한다. */
function everyNonEmpty(arr, cond, min) {
  const a = Array.isArray(arr) ? arr : [];
  const floor = typeof min === 'number' ? min : 1;
  return a.length >= floor && a.every(cond);
}

/** 등록 검사 수 하한 pin — 검사가 조용히 사라지는 게이트 침식 차단. */
function pinChecks(results, min, pushFail) {
  if (results.length < min) {
    pushFail(`SELF 등록 검사 수 하한 pin(${min})`,
      `EXCEPTION(fail-closed): 등록 ${results.length} < 하한 ${min} — 게이트 침식`);
    return false;
  }
  return true;
}

module.exports = { lazy, mkSection, pinCount, everyNonEmpty, pinChecks };
