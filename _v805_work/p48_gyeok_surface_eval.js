// ============================================================
//  v805 p48 — 트랙 E2b: 격국 명칭 노출(원문 확정 규칙으로 결정되는 명식만) + LLM 격국·용신 제거
//  node _v805_work/p48_gyeok_surface_eval.js   (IP 필요)
//  ★구현 전 작성(Eval-First). 확정 규칙 = P-805-E2·E2c(G1·G2·G5·G7·G9·G10 · 會支 HOLD · 雜氣/무투출/겸투/양인월/비겁투출 HOLD)
//  X1 bind.gyeokFacts = 독립 재구현 규칙(합성 60,000 + 실제 생년월일 3,000 · 한글 기둥) · 결정 가능하면 VERIFIED+이름+기준, 아니면 HOLD
//  X2 결정 가능 명식에서 POC 엔진(gyeokguk_engine) 격 이름과 일치
//  X3 authority gyeok_name VERIFIED · gyeok·yongsin·gisin·sangsin DENY · 두 authority 동일
//  X4 서버: 사주 스키마에 gyeokguk·yongsin 요구 없음 · 응답의 LLM gyeokguk·yongsin 삭제(사주 3종) · parsed.gyeok = 엔진(saju·premium_1) · gyeokBlock 주입(용신 단정 금지 문구)
//  X5 화면: LLM 격국·용신 렌더 0(prem.gyeokguk·prem.yongsin 미참조) · _cwGyeokHTML 3곳 · 보류 문구 · 상품 설명에 「용신(用神) 추천」 없음
//  X6 격국 코드 영역 문헌명 0
//  X7 bind 내장 지장간 표 = IP jijanggan.json
//  X8 패키지 게이트 CW_PROMOTED += gyeok_name · 하드게이트 「격국 명칭 승격 근거 재현」
//  X9 문법
// ============================================================
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
const ROOT = path.join(__dirname, '..');
const PKG = [process.env.CHUNWOON_GATE_PKG, path.join(ROOT, '..', 'ChunWoon_IP', 'gate_pkg')].find(p => p && fs.existsSync(p));
let total = 0, pass = 0; const fails = [];
const check = (id, name, ok, d) => { total++; if (ok) pass++; else fails.push(id); console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${id} ${name}${d ? ' — ' + d : ''}`); };
const rd = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const ST = '甲乙丙丁戊己庚辛壬癸', BR = '子丑寅卯辰巳午未申酉戌亥', KS = '갑을병정무기경신임계', KB = '자축인묘진사오미신유술해';
let JJG = null; try { JJG = JSON.parse(fs.readFileSync(path.join(PKG, 'IP', 'rules', 'saju', 'jijanggan.json'), 'utf8')).table; } catch (e) {}
const EL = s => Math.floor(ST.indexOf(s) / 2);
const ROK = { 甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子' };
const YY = { 甲: '卯', 丙: '午', 戊: '午', 庚: '酉', 壬: '子' };
const TR = b => ['申子辰', '寅午戌', '巳酉丑', '亥卯未'].find(g => g.includes(b));
const SIP = (d, x) => { const de = EL(d), xe = EL(x), same = (ST.indexOf(d) % 2) === (ST.indexOf(x) % 2); const r = (xe - de + 5) % 5;
  return [['비견', '겁재'], ['식신', '상관'], ['편재', '정재'], ['편관', '정관'], ['편인', '정인']][r][same ? 0 : 1]; };
const NAME = { 정관: '정관격', 편관: '칠살격', 정재: '정재격', 편재: '편재격', 정인: '정인격', 편인: '편인격', 식신: '식신격', 상관: '상관격' };
function ref(P) {   // P: [{s,b}×4] 한자 → 기대 이름 | null
  const D = P[2].s, Bm = P[1].b;
  if (YY[D] === Bm) return null;
  if (ROK[D] === Bm) return '건록격';
  const hid = JJG[Bm].map(x => x[0]), bg = hid[hid.length - 1];
  if (EL(bg) === EL(D) && bg !== D) return ROK[bg] === Bm ? '월겁격' : null;
  if ([P[0].b, P[2].b, P[3] && P[3].b].filter(Boolean).some(b => b !== Bm && TR(b) === TR(Bm))) return null;
  if ('辰戌丑未'.includes(Bm)) return null;
  const sh = hid.filter(h => [P[0].s, P[1].s, P[3] && P[3].s].includes(h));
  if (sh.length !== 1) return null;
  if (EL(sh[0]) === EL(D)) return null;
  return NAME[SIP(D, sh[0])];
}
let B = null; try { B = require(path.join(ROOT, 'api', '_engine', 'bind.js')); } catch (e) {}
const samples = [];
{ let seed = 48; const r = k => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % k; };
  for (let i = 0; i < 6000; i++) { const g = () => { const s = r(10); let b = r(12); if (b % 2 !== s % 2) b = (b + 1) % 12; return { s: ST[s], b: BR[b] }; }; samples.push([g(), g(), g(), g()]); }
  if (B && B.guardContext) { const HL = ['자시', '축시', '인시', '묘시', '진시', '사시', '오시', '미시', '신시', '유시', '술시', '해시'];
    for (let i = 0; i < 3000; i++) { const ctx = { gender: 'male', calType: 'solar', inputYear: 1950 + r(60), inputMonth: 1 + r(12), inputDay: 1 + r(28), isLeapMonth: false, hourLabel: HL[r(12)], yearPillar: '甲子', monthPillar: '丙寅', dayPillar: '甲子', hourPillar: '甲子' };
      const gg = B.guardContext(ctx); if (!gg.applied) continue; const c = gg.context; const P = [c.yearPillar, c.monthPillar, c.dayPillar, c.hourPillar].map(p => p && p.length === 2 ? { s: ST[KS.indexOf(p[0])], b: BR[KB.indexOf(p[1])] } : null);
      samples.push(P.filter(Boolean).length === 4 ? P : P.slice(0, 3)); } } }
const ctxOf = P => ({ yearPillar: KS[ST.indexOf(P[0].s)] + KB[BR.indexOf(P[0].b)], monthPillar: P[1].s + P[1].b, dayPillar: KS[ST.indexOf(P[2].s)] + KB[BR.indexOf(P[2].b)], hourPillar: P[3] ? P[3].s + P[3].b : '' });
// X1
{ const bad = []; let det = 0;
  if (!B || typeof B.gyeokFacts !== 'function' || !JJG) bad.push('gyeokFacts/JJG 없음');
  else for (const P of samples) { const e = ref(P), f = B.gyeokFacts(ctxOf(P));
    if (!f) { bad.push('null'); continue; }
    if (e) { det++; if (f.status !== 'VERIFIED' || f.name !== e || !/월지 /.test(f.basis || '') || !f.source) bad.push(P.map(p => p.s + p.b).join('') + ' ' + e + '≠' + f.name); }
    else if (f.status !== 'HOLD' || f.name) bad.push(P.map(p => p.s + p.b).join('') + ' HOLD 아님 ' + f.name); }
  check('X1', 'gyeokFacts = 확정 규칙(합성 6,000 + 실제 3,000 · 한글 기둥)', bad.length === 0 && det > 0, `표본 ${samples.length} · 결정 ${det}${bad.length ? ' · 불일치 ' + bad.length + ' ' + bad.slice(0, 3).join(' / ') : ''}`); }
// X2
{ let n = 0, bad = []; try { const E = require(path.join(PKG, 'engine', 'gyeokguk_engine.js'));
    for (const P of samples) { if (P.length !== 4) continue; const e = ref(P); if (!e) continue; n++; const o = E.computeGyeokguk(P); if (o.gyeok !== e) bad.push(P.map(p => p.s + p.b).join('') + ' ' + e + '≠' + o.gyeok); } } catch (e) { bad.push(e.message.slice(0, 60)); }
  check('X2', '결정 가능 명식 = POC 엔진 격 이름', n > 0 && bad.length === 0, `대상 ${n}${bad.length ? ' · ' + bad.slice(0, 3).join(' / ') : ''}`); }
// X3
{ const AU = require(path.join(ROOT, 'api', '_engine', 'authority.js')); const okD = ['gyeok', 'yongsin', 'gisin', 'sangsin', 'johu', 'verdict'].every(a => AU.userSurfaceable(a) === false);
  let okS = false; try { okS = fs.readFileSync(path.join(ROOT, 'api', '_engine', 'authority.js')).equals(fs.readFileSync(path.join(PKG, 'engine', 'authority.js'))); } catch (e) {}
  check('X3', 'authority gyeok_name VERIFIED · 해석축 DENY · 두 authority 동일', AU.userSurfaceable('gyeok_name') === true && okD && okS, ''); }
// X4
{ const F = rd('api/fortune.js'); const okSchema = !/"gyeokguk"\s*:\s*\{/.test(F) && !/"yongsin"\s*:\s*\{/.test(F);
  const okDel = /delete parsed\.gyeokguk/.test(F) && /delete parsed\.yongsin/.test(F) && /parsed\.gyeok\s*=/.test(F) && /gyeokFacts\(/.test(F) && /gyeokBlock\(/.test(F);
  let okBlk = false; try { okBlk = /용신/.test(B.gyeokBlock({ status: 'HOLD', basis: 'x' })) && /용신/.test(B.gyeokBlock({ status: 'VERIFIED', name: '정관격', basis: 'x', source: 'y' })); } catch (e) {}
  check('X4', '서버: 스키마 gyeokguk·yongsin 없음 · LLM 값 삭제 · 엔진 gyeok · 블록(용신 단정 금지)', okSchema && okDel && okBlk, `스키마 ${okSchema} · 출구 ${okDel} · 블록 ${okBlk}`); }
// X5
{ const H = rd('index.html'); const i = H.indexOf('function _cwGyeokHTML'); const seg = i >= 0 ? H.slice(i, i + 2500) : '';
  const uses = (H.match(/_cwGyeokHTML\(/g) || []).length - (i >= 0 ? 1 : 0);
  const okNoLLM = !/prem\.gyeokguk|prem\.yongsin|merged\.gyeokguk|merged\.yongsin|result\.gyeokguk/.test(H);
  const okPay = !/용신\(用神\) 추천/.test(H);
  check('X5', '화면: LLM 격국·용신 렌더 0 · _cwGyeokHTML 3곳 · 보류 문구 · 상품 설명 용신 추천 없음', !!seg && uses >= 3 && /판정을 보류/.test(seg) && okNoLLM && okPay && !/길하|흉하|점수/.test(seg), `사용 ${uses} · LLM 미참조 ${okNoLLM} · 상품 ${okPay}`); }
// X6
{ const H = rd('index.html'), Bs = rd('api/_engine/bind.js'); const i = H.indexOf('function _cwGyeokHTML'), j = Bs.indexOf('function gyeokFacts');
  const bad = /자평|子平|眞詮|真詮|沈孝瞻/; check('X6', '격국 코드 영역 문헌명 0', i >= 0 && j >= 0 && !bad.test(H.slice(i, i + 2500)) && !bad.test(Bs.slice(Math.max(0, j - 3000), j + 3000)), ''); }
// X7
{ let ok = false; try { ok = JSON.stringify(B.GYEOK_JJG) === JSON.stringify(Object.fromEntries(Object.entries(JJG).map(([k, v]) => [k, v.map(x => x[0])]))); } catch (e) {}
  check('X7', 'bind 내장 지장간 = IP jijanggan', ok, ''); }
// X8
{ let ok = false, d = ''; try { const R = fs.readFileSync(path.join(PKG, 'eval', 'run_eval.js'), 'utf8'); const m = R.match(/CW_PROMOTED\s*=\s*CW_PROMOTED_V770\.concat\(\[([^\]]*)\]\)/); d = m ? m[1] : ''; ok = !!m && /gyeok_name/.test(m[1]) && /격국 명칭 승격 근거 재현/.test(R); } catch (e) {}
  check('X8', '패키지 게이트 CW_PROMOTED+gyeok_name · 하드게이트', ok, d); }
// X9
{ const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'p48-')); const bad = []; const H = rd('index.html');
  [...H.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)].filter(m => !/src=|application\/ld\+json|type="module"/.test(m[1] || '')).forEach((m, i) => { const f = path.join(tmp, 'b' + i + '.js'); fs.writeFileSync(f, m[2]); try { cp.execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); } catch (e) { bad.push('index#' + i); } });
  for (const p of ['api/_engine/bind.js', 'api/_engine/authority.js']) { try { cp.execFileSync(process.execPath, ['--check', path.join(ROOT, p)], { stdio: 'pipe' }); } catch (e) { bad.push(p); } }
  { const f = path.join(tmp, 'f.mjs'); fs.writeFileSync(f, rd('api/fortune.js')); try { cp.execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); } catch (e) { bad.push('fortune'); } }
  check('X9', '문법', bad.length === 0, bad.join(' · ')); }
console.log(`[p48_gyeok_surface] total=${total} pass=${pass} fail=${total - pass}${fails.length ? ' · FAIL ' + fails.join(',') : ''}`);
process.exitCode = fails.length ? 1 : 0;
