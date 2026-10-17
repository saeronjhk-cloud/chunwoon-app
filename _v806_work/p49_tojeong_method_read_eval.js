// ============================================================
//  v806 p49 — 트랙 F1: 토정비결(1935 德興書林) 작괘법·60갑자 수표 블라인드 2판독 → 확정 표·식으로 엔진 계산
//  node _v806_work/p49_tojeong_method_read_eval.js   (IP 필요)
//  ★판독 전 작성(Eval-First) · 기준 = _v806_work/사전등록_P-806-F1_토정작괘법_원문판독.md
//  ★기대값은 판독 확정 답만으로 만든다. 엔진(IP tojeong_engine.js)은 대조 대상 산출에만 require.
// ============================================================
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const IPR = path.join(ROOT, '..', 'ChunWoon_IP');
const PKG = [process.env.CHUNWOON_GATE_PKG, path.join(IPR, 'gate_pkg')].find(p => p && fs.existsSync(p));
const RD = path.join(IPR, 'tojeong', 'read');
let total = 0, pass = 0; const fails = [];
const check = (id, name, ok, d) => { total++; if (ok) pass++; else fails.push(id); console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${id} ${name}${d ? ' — ' + d : ''}`); };
const J = p => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; } };
const STEMS = '甲乙丙丁戊己庚辛壬癸', BR = '子丑寅卯辰巳午未申酉戌亥';
const GZ60 = Array.from({ length: 60 }, (_, i) => STEMS[i % 10] + BR[i % 12]);
const PAIRS = ['甲己', '乙庚', '丙辛', '丁壬', '戊癸'];
const A = J(path.join(RD, 'readA.json')), B = J(path.join(RD, 'readB.json'));
const ADJ = J(path.join(RD, 'method_adjudication.json'));   // Claude 정규화 기록(판독 A·B 각각의 식을 같은 형식으로 옮긴 것 + 근거 quote)
const isInt = v => Number.isInteger(v) && v > 0 && v < 100;

// T1 완결성
{ const bad = [];
  for (const [nm, R] of [['A', A], ['B', B]]) {
    if (!R) { bad.push(nm + ' 없음'); continue; }
    for (const g of ['upper', 'middle', 'lower']) if (!R.method || !R.method[g]) bad.push(nm + ':method.' + g);
    for (const p of PAIRS) { const y = (R.yeondu || {})[p] || (R.yeondu || {})[p[0] + '·' + p[1]]; if (!y) bad.push(nm + ':yeondu.' + p); }
    for (const gz of GZ60) { const c = (R.table || {})[gz]; if (!c || !('taese' in c) || !('wolgeon' in c) || !('iljin' in c) || !c.raw || !c.confidence) bad.push(nm + ':' + gz); }
  }
  check('T1', '판독 A·B method 3괘 · 年頭 5짝 · 수표 60칸 전부', bad.length === 0, bad.slice(0, 8).join(' ')); }

// T2 블라인드
{ let ok = true, d = ''; const pf = path.join(RD, 'prompt_reader_tojeong.md'); const P = fs.existsSync(pf) ? fs.readFileSync(pf, 'utf8') : '';
  const sha = crypto.createHash('sha256').update(P).digest('hex').slice(0, 16);
  if (!P) { ok = false; d = '지시문 없음'; }
  // 지시문에 한자 숫자 값·작괘식 흔적이 없어야 한다(간지 키 예시 "甲子"·"癸亥"는 허용)
  const P2 = P.replace(/十二朔運解釋|十八句土亭秘訣/g, '');  // 서명은 제외
  if (/[一二三四五六七八九十廿]{2,}|年齒|太歲數|月建數|日辰數|八除|六除|三除|tjGanjiNum|calcTojeongGua|tojeongGua/.test(P2)) { ok = false; d += ' · 지시문에 값/식 흔적'; }
  for (const [nm, R] of [['A', A], ['B', B]]) if (!R || !R.meta || R.meta.blind !== true || R.meta.prompt_sha16 !== sha) { ok = false; d += ` · ${nm} meta 불일치`; }
  if (A && B && A.meta && B.meta && A.meta.reader_id === B.meta.reader_id) { ok = false; d += ' · 판독자 동일'; }
  check('T2', '블라인드(지시문 sha · 값/식 흔적 없음 · 판독자 분리)', ok, d || 'prompt ' + sha); }

// T3 판정 재현
const VER = {};
if (A && B && A.table && B.table) for (const gz of GZ60) { const a = A.table[gz] || {}, b = B.table[gz] || {};
  const same = ['taese', 'wolgeon', 'iljin'].every(k => isInt(a[k]) && a[k] === b[k]);
  VER[gz] = (same && a.confidence === 'high' && b.confidence === 'high') ? { taese: a.taese, wolgeon: a.wolgeon, iljin: a.iljin } : null; }
// ★사후(2026-10-17 · 사전등록 F1c — 필사본 판독 전에 고정한 규칙을 독립 구현): 필사본(OAJ000006052 p063) 판독 MS-A·MS-B
//   항목 VERIFIED(같은 값 ∧ 둘 다 high) → 천간수+범주 지지수 파생. 1935 VERIFIED 칸과 하나라도 어긋나면 F1c 무효.
//   정합 통과 시 미확정 칸 = 파생 세 수가 1935 판독 A 또는 B 값과 같을 때만 VERIFIED.
const MA = J(path.join(IPR, 'tojeong', 'read_ms', 'readA.json')), MB = J(path.join(IPR, 'tojeong', 'read_ms', 'readB.json'));
let F1C = { valid: false, checks: 0, mis: [], added: [] };
if (MA && MB && A && B) {
  const it = R => { const d = {}; for (const e of R.stem_numbers || []) for (const s of e.stems) d['S' + s] = [e.value, e.confidence];
    for (const c of Object.keys(R.branch_numbers || {})) for (const e of R.branch_numbers[c].entries) for (const z of e.branches) d[c + z] = [e.value, e.confidence]; return d; };
  const ia = it(MA), ib = it(MB), MV = {};
  for (const k of Object.keys(ia)) if (ib[k] && ia[k][0] === ib[k][0] && ia[k][1] === 'high' && ib[k][1] === 'high') MV[k] = ia[k][0];
  const CAT = { taese: '太歲', wolgeon: '月建', iljin: '日辰' };
  const der = (g, k) => (MV['S' + g[0]] != null && MV[CAT[k] + g[1]] != null) ? MV['S' + g[0]] + MV[CAT[k] + g[1]] : null;
  for (const g of GZ60) if (VER[g]) for (const k of Object.keys(CAT)) { const d = der(g, k); if (d != null) { F1C.checks++; if (d !== VER[g][k]) F1C.mis.push(g + k); } }
  F1C.valid = F1C.mis.length === 0 && F1C.checks > 0;
  if (F1C.valid) for (const g of GZ60) if (!VER[g]) { const ds = Object.keys(CAT).map(k => der(g, k)); if (ds.some(x => x == null)) continue;
    if ([A.table[g], B.table[g]].some(c => c && c.taese === ds[0] && c.wolgeon === ds[1] && c.iljin === ds[2])) { VER[g] = { taese: ds[0], wolgeon: ds[1], iljin: ds[2] }; F1C.added.push(g); } }
}
// ★사후(2026-10-17 21시 · 사전등록 F1d — 판독 전에 고정한 규칙의 독립 구현): 원본해설(KOL201100130 p43) 판독 WB-A·WB-B
//   칸 VERIFIED(세 수 일치 ∧ 둘 다 high). 그때까지의 VERIFIED 칸과 하나라도 어긋나면 F1d 무효.
//   정합 통과 시 미확정 칸 = 원본해설 세 수가 1935 판독 A 또는 B 값과 같을 때만 VERIFIED.
const WA = J(path.join(IPR, 'tojeong', 'read_wb', 'readA.json')), WB = J(path.join(IPR, 'tojeong', 'read_wb', 'readB.json'));
let F1D = { valid: false, checks: 0, mis: [], added: [] };
if (WA && WB && A && B) {
  const K3 = ['taese', 'wolgeon', 'iljin'], WV = {};
  for (const g of GZ60) { const a = WA.table[g] || {}, b = WB.table[g] || {}; if (K3.every(k => isInt(a[k]) && a[k] === b[k]) && a.confidence === 'high' && b.confidence === 'high') WV[g] = a; }
  for (const g of GZ60) if (VER[g] && WV[g]) { F1D.checks++; if (K3.some(k => VER[g][k] !== WV[g][k])) F1D.mis.push(g); }
  F1D.valid = F1D.mis.length === 0 && F1D.checks > 0;
  if (F1D.valid) for (const g of GZ60) if (!VER[g] && WV[g] && [A.table[g], B.table[g]].some(c => c && K3.every(k => c[k] === WV[g][k]))) { VER[g] = { taese: WV[g].taese, wolgeon: WV[g].wolgeon, iljin: WV[g].iljin }; F1D.added.push(g); }
}
check('T3c', `F1c 필사본 정합(1935 VERIFIED 대조 ${F1C.checks}건 · 불일치 ${F1C.mis.length}) · 보강 ${F1C.added.length}칸`, F1C.valid, F1C.added.join(' ') + (F1C.mis.length ? ' · ' + F1C.mis.slice(0, 5).join(' ') : ''));
check('T3d', `F1d 원본해설 정합(대조 ${F1D.checks}칸 · 불일치 ${F1D.mis.length}) · 보강 ${F1D.added.length}칸`, F1D.valid, F1D.added.join(' ') + (F1D.mis.length ? ' · ' + F1D.mis.join(' ') : ''));
const nVer = Object.values(VER).filter(Boolean).length;
const TBL = J(path.join(PKG || '', 'IP', 'rules', 'tojeong', 'tojeong_numtable_1935.json'));
// ★사후(2026-10-17): IP 표는 순번 배열 table60(0=甲子) — 분배 가드 n-gram 오탐 회피(함정 79). 값 기준 불변.
{ let ok = !!TBL && Array.isArray(TBL.table60) && TBL.table60.length === 60; const bad = [];
  if (ok) for (const gz of GZ60) { const t = TBL.table60[GZ60.indexOf(gz)], v = VER[gz];
    if (v) { if (!t || t.status !== 'VERIFIED' || t.taese !== v.taese || t.wolgeon !== v.wolgeon || t.iljin !== v.iljin) bad.push(gz); }
    else if (!t || t.status !== 'UNRESOLVED' || t.taese !== null || t.wolgeon !== null || t.iljin !== null) bad.push(gz); }
  check('T3', `수표 판정 재현(VERIFIED ${nVer}/60 · A=B ∧ 둘 다 high)`, ok && bad.length === 0, ok ? bad.slice(0, 8).join(' ') : '표 파일 없음'); }

// 작괘법 판정: ADJ.A / ADJ.B 정규화가 같으면 VERIFIED
const MKEYS = ['operands', 'divisor', 'zero_to'];
let METHOD = null;
{ let ok = !!(ADJ && ADJ.A && ADJ.B), d = '';
  if (ok) { const same = ['upper', 'middle', 'lower'].every(g => JSON.stringify(MKEYS.map(k => ADJ.A[g] && ADJ.A[g][k])) === JSON.stringify(MKEYS.map(k => ADJ.B[g] && ADJ.B[g][k])));
    if (same) METHOD = ADJ.A; else d = '판독 A·B 식 불일치 → UNRESOLVED(외부 자문)';
    // 정규화 근거 quote 가 실제 판독 기록에 있는지(Claude 정규화가 판독을 벗어나지 않았는지)
    for (const [nm, R] of [['A', A], ['B', B]]) for (const g of ['upper', 'middle', 'lower']) { const q = ADJ[nm][g] && ADJ[nm][g].quote_from_reader;
      if (!q || !JSON.stringify(R.method[g]).includes(q)) { ok = false; d += ` · ${nm}.${g} 근거 quote 불일치`; } } }
  else d = '정규화 기록 없음';
  check('T3m', '작괘법 판정(A·B 정규화 식 일치 · 근거 quote 가 판독 기록에 실재)', ok && !!METHOD, d || JSON.stringify(METHOD && ['upper', 'middle', 'lower'].map(g => METHOD[g].operands.join('+') + ' mod ' + METHOD[g].divisor))); }

// T4 IP 표 메타
{ const ok = !!TBL && TBL.source && /KOL000021688/.test(TBL.source) && TBL.method_status && (METHOD ? TBL.method_status === 'VERIFIED' : TBL.method_status !== 'VERIFIED');
  check('T4', 'IP 수표 파일 출처(KOL000021688) · 작괘법 상태 기록', !!ok); }

// T5 엔진: 확정 표·식만으로 계산 · 필요한 칸 UNRESOLVED 면 HOLD
let ENG = null; try { ENG = require(path.join(PKG, 'engine', 'tojeong_engine.js')); } catch (e) { }
{ let ok = !!(ENG && ENG.computeGua1935), d = '';
  if (ok && METHOD) {
    // 독립 기대값: METHOD 정규화를 직접 해석
    const val = (op, inp) => ({ age: inp.age, taese: VER[inp.yearGz] && VER[inp.yearGz].taese, month_size: inp.monthSize, wolgeon: VER[inp.monthGz] && VER[inp.monthGz].wolgeon, lunar_day: inp.lunarDay, iljin: VER[inp.dayGz] && VER[inp.dayGz].iljin })[op];
    const expect = inp => { const out = []; for (const g of ['upper', 'middle', 'lower']) { const vs = METHOD[g].operands.map(o => val(o, inp)); if (vs.some(v => !Number.isInteger(v))) return 'HOLD'; const s = vs.reduce((x, y) => x + y, 0); out.push((s % METHOD[g].divisor) || METHOD[g].zero_to); } return out.join(''); };
    let n = 0, mis = [];
    for (let i = 0; i < 400; i++) { const inp = { age: 1 + (i * 7) % 90, yearGz: GZ60[(i * 13) % 60], monthSize: (i % 2) ? 30 : 29, monthGz: GZ60[(i * 17 + 2) % 60], lunarDay: 1 + (i * 11) % 30, dayGz: GZ60[(i * 31 + 5) % 60] };
      const e = expect(inp), r = ENG.computeGua1935(inp); const got = r && r.status === 'HOLD' ? 'HOLD' : (r && r.gua);
      n++; if (String(got) !== String(e)) mis.push(JSON.stringify(inp) + ' exp ' + e + ' got ' + got); }
    ok = mis.length === 0; d = `${n}건 · 불일치 ${mis.length}` + (mis.length ? ' · ' + mis[0] : '');
  } else if (!METHOD) { ok = false; d = '작괘법 미확정'; } else d = '엔진 없음';
  check('T5', '엔진 = 확정 표·식 독립 해석(400건 · HOLD 포함)', ok, d); }

// T6 외부 사례: 1976 음 8/26생 · 2005(乙酉)년 → 212괘 (계획서 기록: 2005 음8월 소월 · 월건 乙酉 · 일진 丙辰)
{ let d = '', ok = false;
  if (ENG && ENG.computeGua1935) { const r = ENG.computeGua1935({ age: 2005 - 1976 + 1, yearGz: '乙酉', monthSize: 29, monthGz: '乙酉', lunarDay: 26, dayGz: '丙辰' });
    ok = !!r && r.gua === '212'; d = 'got ' + (r && (r.gua || r.status)) + ' · 실패 시 표·식을 맞추지 않고 원인만 기록'; }
  else d = '엔진 없음';
  check('T6', '외부 사례 재현(1976 음8/26생 · 2005 → 212)', ok, d); }

// T7 운영 무변경: 운영 authority 에 tojeong 승격 흔적 없음 · ctxguard 작괘식 그대로(F2 전)
{ const au = fs.readFileSync(path.join(ROOT, 'api', '_engine', 'authority.js'), 'utf8'); const cg = fs.readFileSync(path.join(ROOT, 'api', '_engine', 'ctxguard.js'), 'utf8');
  const ok = !/tojeong_1935|computeGua1935/.test(au + cg);
  check('T7', '운영 코드 무변경(F2 전)', ok); }

console.log(`\np49 ${pass}/${total}` + (fails.length ? ' · FAIL ' + fails.join(',') : ''));
process.exit(fails.length ? 1 : 0);
