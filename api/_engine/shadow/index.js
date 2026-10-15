'use strict';
// ★v805 P-805-D — 사주 엔진 서버 shadow(원칙 41 ②단계). 계산 결과는 로그 요약으로만 남긴다.
//   화면·LLM·응답 JSON 에 쓰지 않는다(평가 p44 D4). authority DENY 축은 그대로 DENY.
//   engine/·IP/ 는 생성물(IP 쪽 생성기가 원문을 식별자로 바꾼 배포판) — 손수정 금지, 생성기로만 갱신.
//   실패는 언제나 「로그만」: 이 모듈은 예외를 밖으로 던지지 않는다.
const crypto = require('crypto');
const VERSION = 'shadow-poc-v7.70/1.0.1';
let E = null, loadFailed = false;
function engine() {
  if (E || loadFailed) return E;
  try { E = require('./engine/saju_resolver.js'); } catch (e) { loadFailed = true; E = null; }
  return E;
}
const ST = '甲乙丙丁戊己庚辛壬癸', BR = '子丑寅卯辰巳午未申酉戌亥';
const ST_KO = '갑을병정무기경신임계', BR_KO = '자축인묘진사오미신유술해';
// ★v805 사후 수리(p44 D11) — 서버 실경로의 context 는 ctxguard 가 기둥을 **한글**(「갑자」)로 다시 넣는다.
//   bind.js splitPillar 와 같은 규칙: 한자 2자 또는 한글 2자(혼용 불가) · 60갑자 실재 조합만.
function split(p) {
  if (typeof p !== 'string') return null;
  const t = [...p.trim()]; if (t.length !== 2) return null;
  let s = ST.indexOf(t[0]), b = BR.indexOf(t[1]);
  if (s < 0 && b < 0) { s = ST_KO.indexOf(t[0]); b = BR_KO.indexOf(t[1]); }
  if (s < 0 || b < 0 || s % 2 !== b % 2) return null;
  return { s: ST[s], b: BR[b] };
}
function pick(o, k) { return o && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined; }
function summarize(out, ms, ih) {
  const ax = (out && out.axes) || {};
  const bal = ax.balance || {}, st = ax.structure || {}, cl = ax.climate || {};
  return {
    v: VERSION, ih, ms,
    bal: { st: pick(bal, 'state'), d: pick(bal, 'decision'), y: pick(bal, 'yongsin'), g: pick(bal, 'gisin') },
    gy: { g: pick(st, 'gyeok'), d: pick(st, 'decision'), sp: pick(st, 'seong_pae'), ss: pick(st, 'selected_sangsin'), pc: pick(st, 'primary_sangsin_candidate') },
    jh: { y: pick(cl, 'johu_yongsin'), e: pick(cl, 'johu_element'), pr: pick(cl, 'present') },
    cc: out && out.concordance ? out.concordance.level : undefined,
    dw: out && out.daewoon ? out.daewoon.direction : undefined
  };
}
function run(ctx) {
  try {
    // ★v805 사후 수리(p44 D11) — 해석 불가 입력도 null 이 아니라 skip 요약을 돌려준다(로그 0건 = 관측 불가였다).
    if (!ctx || typeof ctx !== 'object' || Array.isArray(ctx)) return { summary: { v: VERSION, skip: 'no_ctx' } };
    const p = [split(ctx.yearPillar), split(ctx.monthPillar), split(ctx.dayPillar)];
    if (p.some(x => !x)) return { summary: { v: VERSION, skip: 'bad_pillars' } };
    const ih = crypto.createHash('sha256').update(JSON.stringify([ctx.yearPillar, ctx.monthPillar, ctx.dayPillar, ctx.hourPillar || '', ctx.gender || ''])).digest('hex').slice(0, 8);
    const h = split(ctx.hourPillar);
    if (!h) return { summary: { v: VERSION, ih, skip: 'no_hour' } };
    if (ctx.gender !== 'male' && ctx.gender !== 'female') return { summary: { v: VERSION, ih, skip: 'no_gender' } };
    const R = engine();
    if (!R || typeof R.computeSajuReading !== 'function') return { summary: { v: VERSION, ih, skip: 'load_error' } };
    const t0 = Date.now();
    const out = R.computeSajuReading([p[0], p[1], p[2], h], { gender: ctx.gender });
    return { summary: summarize(out, Date.now() - t0, ih) };
  } catch (e) {
    return { summary: { v: VERSION, skip: 'error', e: String((e && e.message) || e).slice(0, 60).replace(/[一-鿿]{4,}/g, '…') } };
  }
}
// 평가(p44 D5)용 — 배포판 엔진 직접 호출
function computeSajuReading(pillars, opts) { const R = engine(); if (!R) throw new Error('shadow engine load failed'); return R.computeSajuReading(pillars, opts); }
module.exports = { run, summarize, computeSajuReading, VERSION };
