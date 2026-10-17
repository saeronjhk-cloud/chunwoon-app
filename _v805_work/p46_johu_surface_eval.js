// ============================================================
//  v805 p46 — 트랙 E1b: 조후 VERIFIED_FLAT 80칸만 화면 노출(칸 단위 승격)
//  node _v805_work/p46_johu_surface_eval.js   (IP 필요 · 없으면 P46_SKIP_IP=1 → K1 은 FAIL)
//  ★구현 전 작성(Eval-First). 제이 승인 문구(2026-10-17 「진행」):
//    확정 칸  = 「🌡 조후(調候) — 태어난 계절의 기운을 고르게 하는 데 필요한 기운 / 丙(화) → 癸(수) / 📐 엔진 판정 · 기준: 일간 甲 · 월지 寅 · 고전 명리서 조견표 참고」
//    미확정 칸 = 「이 일간·계절 조합은 원문 판독이 확정되지 않아 판정을 보류합니다.」
//  K1 배포 데이터 api/_engine/johu_verified.json = IP 조견표 cell_status_v3 VERIFIED_FLAT 칸·순서와 정확히 같음(80칸) · 나머지 null
//  K2 배포 데이터에 원문·문헌명 0 · 값은 천간 글자만
//  K3 bind.johuFacts: 120칸 전수(한자·한글 기둥 · 3기둥 포함) → VERIFIED 면 order·elements·basis·source · 아니면 status HOLD(order 없음)
//  K4 authority: johu_cell VERIFIED·노출 · johu(축 전체)·yongsin·gyeok·sangsin·gisin·verdict·daewoon_start_age DENY · 두 authority 바이트 동일
//  K5 서버: 사주 3종에 johuBlock 주입(HOLD 면 「조후 언급 금지」) · 응답 johu = 엔진 값(saju·saju_premium_2) · premium_1 은 삭제 · LLM 스키마에 johu 요구 없음
//  K6 화면: _cwJohuHTML 정의 + 3곳 이상 사용(무료·프리미엄·PDF) · 기준 표기 · 보류 문구 · 길흉·점수 단어 없음
//  K7 서버면·화면 조후 코드 영역에 문헌명(궁통·窮通 등) 0
//  K8 패키지 게이트: CW_PROMOTED 에 johu_cell · 하드게이트 「조후 칸 승격 근거 재현」
//  K9 문법(index 스크립트 · bind · authority · fortune)
// ============================================================
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
const ROOT = path.join(__dirname, '..');
const PKG = [process.env.CHUNWOON_GATE_PKG, path.join(ROOT, '..', 'ChunWoon_IP', 'gate_pkg')].find(p => p && fs.existsSync(p));
let total = 0, pass = 0; const fails = [];
const check = (id, name, ok, d) => { total++; if (ok) pass++; else fails.push(id); console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${id} ${name}${d ? ' — ' + d : ''}`); };
const rd = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = p => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; } };
const ST = '甲乙丙丁戊己庚辛壬癸'.split(''), BR = '寅卯辰巳午未申酉戌亥子丑'.split('');
const KS = '갑을병정무기경신임계', KB = '자축인묘진사오미신유술해', BR12 = '子丑寅卯辰巳午未申酉戌亥';
const D = J(path.join(ROOT, 'api', '_engine', 'johu_verified.json'));
const T = PKG && process.env.P46_SKIP_IP !== '1' ? J(path.join(PKG, 'IP', 'rules', 'saju', 'johu_table.json')) : null;
// K1
{ const bad = []; let n = 0; if (!D || !D.cells) bad.push('배포 데이터 없음'); else if (!T || !T.cell_status_v3) bad.push('IP 표 없음');
  else for (const s of ST) for (const b of BR) { const v = T.cell_status_v3[s][b] === 'VERIFIED_FLAT', x = D.cells[s + b];
    if (v) { n++; if (JSON.stringify(x) !== JSON.stringify(T.table[s][b])) bad.push(s + b); } else if (x !== null) bad.push(s + b + ' 미확정인데 값'); }
  check('K1', '배포 데이터 = IP VERIFIED_FLAT 칸·순서(나머지 null)', bad.length === 0 && n === 80, `VERIFIED ${n}${bad.length ? ' · ' + bad.slice(0, 5).join(' ') : ''}`); }
// K2
{ const t = D ? fs.readFileSync(path.join(ROOT, 'api', '_engine', 'johu_verified.json'), 'utf8') : ''; const vals = D && D.cells ? Object.values(D.cells).filter(Boolean).flat() : [];
  const ok = !!D && vals.every(x => ST.includes(x)) && !/[一-鿿]{3,}/.test(t.replace(/"[甲乙丙丁戊己庚辛壬癸][寅卯辰巳午未申酉戌亥子丑]"/g, '')) && !/궁통|窮通|寶鑑|보감|評註|欄江/.test(t);
  check('K2', '배포 데이터 원문·문헌명 0 · 값은 천간만', ok, `값 ${vals.length}`); }
// K3
{ let B = null; try { B = require(path.join(ROOT, 'api', '_engine', 'bind.js')); } catch (e) {}
  const bad = []; let nv = 0;
  if (!B || typeof B.johuFacts !== 'function') bad.push('johuFacts 없음');
  else for (const s of ST) for (const b of BR) { const exp = D && D.cells ? D.cells[s + b] : undefined;
    const yb = '子', ctxH = { yearPillar: '甲' + yb, monthPillar: ST[(BR12.indexOf(b) % 2 === 0) ? 0 : 1] + b, dayPillar: s + BR12[ST.indexOf(s) % 2 === 0 ? 0 : 1], hourPillar: '甲子' };
    const ko = p => KS[ST.indexOf(p[0])] + KB[BR12.indexOf(p[1])];
    const ctxK = { yearPillar: ko(ctxH.yearPillar), monthPillar: ko(ctxH.monthPillar), dayPillar: ko(ctxH.dayPillar) };   // 한글 · 3기둥
    for (const c of [ctxH, ctxK]) { const f = B.johuFacts(c);
      if (!f) { bad.push(s + b + ' null'); continue; }
      if (exp) { if (f.status !== 'VERIFIED' || JSON.stringify(f.order) !== JSON.stringify(exp) || !Array.isArray(f.elements) || f.elements.length !== exp.length || !/일간 .* 월지 /.test(f.basis || '') || !f.source) bad.push(s + b); }
      else if (f.status !== 'HOLD' || f.order) bad.push(s + b + ' HOLD 아님'); }
    if (exp) nv++; }
  check('K3', 'johuFacts 120칸 전수(한자·한글·3기둥) · VERIFIED/HOLD', bad.length === 0 && nv === 80, bad.slice(0, 6).join(' ')); }
// K4
{ const AU = require(path.join(ROOT, 'api', '_engine', 'authority.js')); const deny = ['johu', 'yongsin', 'gyeok', 'sangsin', 'gisin', 'verdict', 'daewoon_start_age'];
  const okD = deny.every(a => AU.userSurfaceable(a) === false), okC = AU.userSurfaceable('johu_cell') === true;
  let okS = false; try { okS = fs.readFileSync(path.join(ROOT, 'api', '_engine', 'authority.js')).equals(fs.readFileSync(path.join(PKG, 'engine', 'authority.js'))); } catch (e) {}
  check('K4', 'authority johu_cell VERIFIED · 나머지 DENY · 두 authority 동일', okD && okC && okS, `DENY ${okD} · johu_cell ${okC} · SELF ${okS}`); }
// K5
{ const F = rd('api/fortune.js'); const okInj = /johuFacts\(/.test(F) && /johuBlock\(/.test(F);
  const okOut = /parsed\.johu\s*=/.test(F) && /type === 'saju_premium_1'[\s\S]{0,200}delete parsed\.johu/.test(F);
  const okNoAsk = !/"johu"\s*:\s*[\[{"]/.test(F);
  let okHold = false; try { const B = require(path.join(ROOT, 'api', '_engine', 'bind.js')); const h = B.johuBlock({ status: 'HOLD', basis: 'x' }); okHold = /언급하지 말 것/.test(h); } catch (e) {}
  check('K5', '서버: johuBlock 주입(HOLD=언급 금지) · 응답 johu=엔진 · premium_1 삭제 · 스키마 요구 없음', okInj && okOut && okNoAsk && okHold, `주입 ${okInj} · 출구 ${okOut} · 요구없음 ${okNoAsk} · 보류문구 ${okHold}`); }
// K6
{ const H = rd('index.html'); const i = H.indexOf('function _cwJohuHTML'); const seg = i >= 0 ? H.slice(i, i + 2500) : '';
  const uses = (H.match(/_cwJohuHTML\(/g) || []).length - (i >= 0 ? 1 : 0);
  const ok = !!seg && uses >= 3 && /기준/.test(seg) && /판정을 보류/.test(seg) && /고르게 하는 데 필요한 기운/.test(seg) && !/길하|흉하|좋은|나쁜|점수|부족/.test(seg);
  check('K6', '화면: _cwJohuHTML 3곳(무료·프리미엄·PDF) · 기준 · 보류 문구 · 길흉·점수 없음', ok, `정의 ${!!seg} · 사용 ${uses}`); }
// K7
{ const H = rd('index.html'); const i = H.indexOf('function _cwJohuHTML'); const seg = i >= 0 ? H.slice(i, i + 2500) : 'X';
  const B = rd('api/_engine/bind.js'); const j = B.indexOf('function johuFacts'); const segB = j >= 0 ? B.slice(Math.max(0, j - 2500), j + 2500) : 'X';
  const bad = /궁통|窮通|寶鑑|보감|評註|徐樂吾|欄江/; check('K7', '조후 코드 영역 문헌명 0', seg !== 'X' && segB !== 'X' && !bad.test(seg) && !bad.test(segB), ''); }
// K8
{ let ok = false, d = ''; try { const R = fs.readFileSync(path.join(PKG, 'eval', 'run_eval.js'), 'utf8'); const m = R.match(/CW_PROMOTED\s*=\s*CW_PROMOTED_V770\.concat\(\[([^\]]*)\]\)/);
    d = m ? m[1] : 'concat 없음'; ok = !!m && /johu_cell/.test(m[1]) && /조후 칸 승격 근거 재현/.test(R); } catch (e) { d = e.message; }
  check('K8', '패키지 게이트 CW_PROMOTED+johu_cell · 하드게이트', ok, d); }
// K9
{ const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'p46-')); const bad = []; const H = rd('index.html');
  [...H.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)].filter(m => !/src=|application\/ld\+json|type="module"/.test(m[1] || '')).forEach((m, i) => { const f = path.join(tmp, 'b' + i + '.js'); fs.writeFileSync(f, m[2]); try { cp.execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); } catch (e) { bad.push('index#' + i); } });
  for (const p of ['api/_engine/bind.js', 'api/_engine/authority.js']) { try { cp.execFileSync(process.execPath, ['--check', path.join(ROOT, p)], { stdio: 'pipe' }); } catch (e) { bad.push(p); } }
  { const f = path.join(tmp, 'f.mjs'); fs.writeFileSync(f, rd('api/fortune.js')); try { cp.execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); } catch (e) { bad.push('fortune'); } }
  check('K9', '문법', bad.length === 0, bad.join(' · ')); }
console.log(`[p46_johu_surface] total=${total} pass=${pass} fail=${total - pass}${fails.length ? ' · FAIL ' + fails.join(',') : ''}`);
process.exitCode = fails.length ? 1 : 0;
