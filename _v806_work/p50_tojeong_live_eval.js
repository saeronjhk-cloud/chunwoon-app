// ============================================================
//  v806 p50 — 트랙 F2: 토정 작괘식 운영 교체(1935 원문 확정 규칙) 검증
//  node _v806_work/p50_tojeong_live_eval.js   (IP 필요 · TMPDIR 설정)
//  ★구현 전 작성(Eval-First) · 기준 = _v806_work/사전등록_P-806-F2_토정작괘식_운영교체.md
//  ★기대값은 IP 판독 기록·IP 표·독립 일진식(JDN)으로 만든다 — 운영 코드를 기대값에 쓰지 않는다.
// ============================================================
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..');
const IPR = path.join(ROOT, '..', 'ChunWoon_IP');
const PKG = path.join(IPR, 'gate_pkg');
let total = 0, pass = 0; const fails = [];
const check = (id, name, ok, d) => { total++; if (ok) pass++; else fails.push(id); console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${id} ${name}${d ? ' — ' + d : ''}`); };
const J = p => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; } };
const T = s => { try { return fs.readFileSync(s, 'utf8'); } catch (e) { return ''; } };
const STEMS = '甲乙丙丁戊己庚辛壬癸', BR = '子丑寅卯辰巳午未申酉戌亥';
const PALGUA = ['건(乾)☰', '태(兌)☱', '리(離)☲', '진(震)☳', '손(巽)☴', '감(坎)☵', '간(艮)☶', '곤(坤)☷'];
const YUKGUA = PALGUA.slice(0, 6), HAGUA = ['상(上)', '중(中)', '하(下)'];
let seed = 20261017; const rnd = n => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };

const IPT_PATH = path.join(PKG, 'IP', 'rules', 'tojeong', 'tojeong_numtable_1935.json');
const IPT = J(IPT_PATH);
const SRV_T = path.join(ROOT, 'api', '_engine', 'tojeong_numtable_1935.json');
const SRV_M = path.join(ROOT, 'api', '_engine', 'tojeong1935.js');
let S = null; try { S = require(SRV_M); } catch (e) { }
let ENG = null; try { ENG = require(path.join(PKG, 'engine', 'tojeong_engine.js')); } catch (e) { }
let CG = null; try { CG = require(path.join(ROOT, 'api', '_engine', 'ctxguard.js')); } catch (e) { }
const LN = require(path.join(ROOT, 'api', '_engine', 'lunar.js'));

// Q1
{ const a = T(SRV_T), b = T(IPT_PATH), m = T(SRV_M); const sig = /土亭|秘訣|德興|朴建會|十八句/;
  check('Q1', '서버 모듈·표 존재 · 표 = IP 바이트 동일 · 서명 0', !!S && !!a && a === b && !sig.test(a) && !sig.test(m), !S ? '모듈 없음' : a !== b ? '표 불일치' : sig.test(a + m) ? '서명 있음' : ''); }

// Q2 서버 공유식 = IP 엔진
{ let ok = !!(S && ENG), mis = 0, n = 0, ex = '';
  if (ok) for (let i = 0; i < 3000; i++) {
    const ys = rnd(10), yb = (ys % 2) + 2 * rnd(6), ms = rnd(10), mb = (ms % 2) + 2 * rnd(6), ds = rnd(10), db = (ds % 2) + 2 * rnd(6);
    const x = { age: 1 + rnd(100), yearSB: [ys, yb], monthSize: rnd(2) ? 30 : 29, monthSB: [ms, mb], lunarDay: 1 + rnd(30), daySB: [ds, db] };
    const a = S.tjGua1935(S.TABLE, x);
    const b = ENG.computeGua1935({ age: x.age, yearGz: STEMS[ys] + BR[yb], monthSize: x.monthSize, monthGz: STEMS[ms] + BR[mb], lunarDay: x.lunarDay, dayGz: STEMS[ds] + BR[db] });
    n++; const ka = a.status === 'OK' ? a.gua : 'HOLD', kb = b.status === 'OK' ? b.gua : 'HOLD'; if (ka !== kb) { mis++; if (!ex) ex = JSON.stringify(x) + ' ' + ka + '≠' + kb; } }
  check('Q2', '서버 tjGua1935 = IP computeGua1935 (3,000건)', ok && mis === 0, ok ? `${n}건 · 불일치 ${mis} ${ex}` : '모듈/엔진 없음'); }

// 독립 기대값 도구
const RA = J(path.join(IPR, 'tojeong', 'read', 'readA.json'));
const YEONDU = {}; if (RA) for (const [k, v] of Object.entries(RA.yeondu)) { const p = k.replace(/[·\s]/g, ''); YEONDU[p[0]] = v.year_head; YEONDU[p[1]] = v.year_head; }
const jdn = (y, m, d) => { const a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3; return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045; };
const dayGzOf = (y, m, d) => { const i = ((jdn(y, m, d) + 49) % 60 + 60) % 60; return STEMS[i % 10] + BR[i % 12]; };
const gzIdx = g => GZ60.indexOf(g); const GZ60 = Array.from({ length: 60 }, (_, i) => STEMS[i % 10] + BR[i % 12]);
function expectOf(lunar, ty) {
  const age = ty - lunar.year + 1, yGz = GZ60[((ty - 4) % 60 + 60) % 60];
  // ★사후(2026-10-17): 보는 해가 출생 전(세는나이 < 1)이면 괘 대상이 아니다 — 첫 실행에서 기대 정의 누락 발견(구현은 HOLD 'AGE').
  if (!(age >= 1)) return { hold: 'AGE' };
  const m = lunar.month; if (!LN.lunarToSolar(ty, m, 1, false)) return { hold: 'NO_TARGET_MONTH' };
  const big = !!LN.lunarToSolar(ty, m, 30, false);
  const head = YEONDU[yGz[0]]; if (!head) return { hold: 'NO_YEONDU' };
  const mGz = STEMS[(STEMS.indexOf(head[0]) + m - 1) % 10] + BR[(BR.indexOf(head[1]) + m - 1) % 12];
  const sol = LN.lunarToSolar(ty, m, lunar.day, false); if (!sol) return { hold: 'NO_TARGET_DAY' };
  const sy = sol.y != null ? sol.y : sol.year, sm = sol.m != null ? sol.m : sol.month, sd = sol.d != null ? sol.d : sol.day;
  const dGz = dayGzOf(sy, sm, sd);
  const c = g => IPT.table60[gzIdx(g)];
  if (c(yGz).status !== 'VERIFIED') return { hold: 'CELL_YEAR' }; if (c(mGz).status !== 'VERIFIED') return { hold: 'CELL_MONTH' }; if (c(dGz).status !== 'VERIFIED') return { hold: 'CELL_DAY' };
  const tae = c(yGz).taese, wol = c(mGz).wolgeon, il = c(dGz).iljin;
  const u = ((age + tae) % 8) || 8, mi = (((big ? 30 : 29) + wol) % 6) || 6, lo = ((lunar.day + il) % 3) || 3;
  return { u, mi, lo, tae, wol, il, mGz, dGz };
}

// Q3 운영 재유도 = 독립 기대
{ let ok = !!(CG && CG.tojeongDerive && RA && IPT), n = 0, mis = 0, hold = 0, ex = ''; const MISC = {};
  if (ok) for (let i = 0; i < 2000; i++) {
    const y = 1930 + rnd(81), mo = 1 + rnd(12), d = 1 + rnd(28), ty = 2000 + rnd(36);
    const lunar = LN.solarToLunar(y, mo, d); if (!lunar) continue;
    const e = expectOf(lunar, ty); const r = CG.tojeongDerive({ cal: 'solar', y, m: mo, d, leap: false }, ty);
    n++; let same;
    if (e.hold) { hold++; same = !!r && r.hold === e.hold; }
    else same = !!r && !r.hold && r.upperGua === PALGUA[e.u - 1] && r.middleGua === YUKGUA[e.mi - 1] && r.lowerGua === HAGUA[e.lo - 1] && r.taeseNum === e.tae && r.wolNum === e.wol && r.ilNum === e.il;
    if (!same) { mis++; MISC[(e.hold || 'OK') + '→' + (r ? (r.hold || 'OK') : 'null')] = (MISC[(e.hold || 'OK') + '→' + (r ? (r.hold || 'OK') : 'null')] || 0) + 1; if (!ex) ex = `${y}-${mo}-${d}/${ty} exp ${JSON.stringify(e)} got ${JSON.stringify(r && { h: r.hold, u: r.upperGua, m: r.middleGua, l: r.lowerGua, t: r.taeseNum, w: r.wolNum, i: r.ilNum })}`; } }
  check('Q3', '운영 tojeongDerive = 독립 기대(年頭 판독·JDN 일진·IP 표)', ok && mis === 0 && n > 1500, ok ? `${n}건 · HOLD ${hold} · 불일치 ${mis} ${JSON.stringify(MISC)} ${ex}` : '모듈 없음'); }

// Q4 212
{ let d = '', ok = false;
  if (CG && CG.tojeongDerive) { const r = CG.tojeongDerive({ cal: 'lunar', y: 1976, m: 8, d: 26, leap: false }, 2005);
    ok = !!r && !r.hold && r.taeseNum === 20 && r.wolNum === 14 && r.ilNum === 18 && r.upperGua === PALGUA[1] && r.middleGua === YUKGUA[0] && r.lowerGua === HAGUA[1];
    d = JSON.stringify(r && { h: r.hold, t: r.taeseNum, w: r.wolNum, i: r.ilNum, u: r.upperGua, m: r.middleGua, l: r.lowerGua }); }
  check('Q4', '1976 음8/26생 · 2005 → 20·14·18 · 212', ok, d); }

// Q5 클라 사본
const IDX = T(path.join(ROOT, 'index.html'));
{ const blk = s => { const a = s.indexOf('// ===TJ1935-SHARED-BEGIN==='), b = s.indexOf('// ===TJ1935-SHARED-END==='); return a >= 0 && b > a ? s.slice(a, b).replace(/\r\n/g, '\n') : null; };
  const sb = blk(T(SRV_M)), cb = blk(IDX);
  let tblOk = false; const m = IDX.match(/const TJ1935_TABLE=(\{[^\n]*\});/);
  if (m && IPT) { try { const c = JSON.parse(m[1]); tblOk = JSON.stringify(c.method) === JSON.stringify(IPT.method) && JSON.stringify(c.table60) === JSON.stringify(IPT.table60) && c.method_status === IPT.method_status; } catch (e) { } }
  check('Q5', 'index 공유 구간 = 서버(글자 동일) · index 표 = IP 표', !!sb && sb === cb && tblOk, !sb ? '서버 구간 없음' : sb !== cb ? '구간 불일치' : !tblOk ? '표 불일치' : ''); }

// Q6 HOLD 실경로
(async () => {
  { let ok = false, d = '';
    try {
      // 2026(丙午) 음 3월 = 壬辰月(미확정 칸) → CELL_MONTH
      const g = CG.guardTojeongContext({ name: 'h', gender: 'male', targetYear: 2026, cal: 'lunar', y: 1990, m: 3, d: 10, leap: false, upperGua: 'x', guaCombination: 'x' });
      const okG = g && g.metrics && g.metrics.mode === 'discarded' && /^GUA_HOLD:/.test(g.metrics.reason || '');
      const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'cw_p50_'));
      fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ type: 'module' }));
      fs.cpSync(path.join(ROOT, 'api'), path.join(tmp, 'api'), { recursive: true });
      process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'sk-ant-gate-stub';
      let fetchN = 0; const realFetch = globalThis.fetch; globalThis.fetch = async () => { fetchN++; throw new Error('LLM 호출 금지'); };
      const mod = await import('file://' + path.join(tmp, 'api', 'fortune.js').split(path.sep).join('/'));
      const res = { statusCode: 0, headers: {}, body: null }; res.status = c => { res.statusCode = c; return res; }; res.json = o => { res.body = o; return res; }; res.setHeader = () => { }; res.end = () => res;
      try { await mod.default({ method: 'POST', headers: {}, body: { type: 'tojeong', context: { name: 'h', gender: 'male', targetYear: 2026, cal: 'lunar', y: 1990, m: 3, d: 10, leap: false } } }, res); } catch (e) { }
      globalThis.fetch = realFetch;
      const b = res.body || {};
      ok = okG && fetchN === 0 && b.success === false && b.code === 'TOJEONG_GUA_HOLD';
      d = `guard ${g && g.metrics && g.metrics.reason} · fetch ${fetchN} · ${res.statusCode} ${JSON.stringify(b).slice(0, 120)}`;
    } catch (e) { d = '예외 ' + e.message; }
    check('Q6', 'HOLD 실경로(guard GUA_HOLD · LLM 호출 0 · TOJEONG_GUA_HOLD)', ok, d); }

  // Q7 옛 식 제거
  { const cg = T(path.join(ROOT, 'api', '_engine', 'ctxguard.js'));
    const bad = [/tjGanjiNum\(monthPillar|tjGanjiNum\(dayPillar/.test(cg) && 'ctxguard tjGanjiNum 작괘', /tjGanjiNum\(monthPillar|tjGanjiNum\(dayPillar/.test(IDX) && 'index tjGanjiNum 작괘', /항상 짝수|모두 짝수/.test(cg) && 'ctxguard 짝수 주장', /항상 짝수|모두 짝수/.test(IDX) && 'index 짝수 주장'].filter(Boolean);
    check('Q7', '옛 작괘식 제거', bad.length === 0, bad.join(' · ')); }

  // Q8 index HOLD 분기
  { const a = IDX.indexOf('async function analyzeTojeong(){'); const body = a >= 0 ? IDX.slice(a, IDX.indexOf('\nfunction renderTojeongResult', a)) : '';
    const h = body.indexOf("status==='HOLD'"), f = body.indexOf("fetch('/api/fortune'"), msg = /원문 확정 전/.test(body);
    const ret = h >= 0 ? body.indexOf('return', h) : -1;
    check('Q8', 'index HOLD 분기 — 정직 문구 · 서버 호출 전 return', h >= 0 && msg && ret > h && ret < f, `HOLD@${h} return@${ret} fetch@${f} 문구 ${msg}`); }

  console.log(`\np50 ${pass}/${total}` + (fails.length ? ' · FAIL ' + fails.join(',') : ''));
  process.exit(fails.length ? 1 : 0);
})();
