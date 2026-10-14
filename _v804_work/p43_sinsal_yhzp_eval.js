// ============================================================
//  v804 p43 — 트랙 C(원칙 41 단계 승격 ②): 신살을 연해자평 원문 직독으로 검증해 엔진이 확정한다
//  node _v804_work/p43_sinsal_yhzp_eval.js   (repo 루트 기준)
//  ★구현 전 작성(Eval-First). 결과를 보고 기준을 바꾸지 않는다(바꾸면 「사후」 표시).
//
//  【원문 직독(2026-10-14 · Claude 판독)】 『評註淵海子平』 卷一 (국가도서관 NLC416-15jh007754 · _internal_only · 배포 금지)
//    PDF p40(卷一 二二面) 論起玉堂天乙貴人: 甲戊庚牛羊 乙己鼠猴鄕 丙丁猪雞位 壬癸兔蛇藏 六辛逢馬虎 此是貴人方
//    PDF p44(卷一 二六面) 論驛馬: 申子辰馬在寅 寅午戌馬在申 巳酉丑馬在亥 亥卯未馬在巳
//                         論華蓋: 寅午戌見戌 巳酉丑見丑 申子辰見辰 亥卯未見未
//    PDF p50(卷一 三二面) 論羊刃: 甲卯 乙辰 丙午 丁未 戊午 己未 庚酉 辛戌 壬子 癸丑 (각 「○生人 羊刃在○」)
//    卷一 목차(PDF p6·p7)에 咸池(도화) 장 없음 — 도화는 이 원전으로 검증 불가 ⟹ 노출하지 않는다.
//    기록 정본: D:\ChunWoon_IP\saju\원문직독_신살4종_2026-10-14.md (원문 이미지 크롭 포함 · git 밖)
//  ★아래 YH 표는 위 직독에서 **엔진과 독립적으로** 옮긴 것이다(엔진 표를 복사하지 않는다).
//  ★기준 지지는 원문에 명시가 없어 앱이 정한다: 천을귀인·양인 = 일간 기준 · 역마·화개 = 연지 기준(연지 자신은 제외).
//
//  N1 천을귀인 10간 × 12지 전수 = YH      N2 양인 10간 × 12지 전수 = YH(己→未 포함 · POC 표 누락 수리)
//  N3 역마 12 연지 × 12지 전수 = YH       N4 화개 12 연지 × 12지 전수 = YH (연지 자신 제외)
//  N5 도화·공망 등 미검증 신살은 엔진 출력에 없음      N6 authority sinsal = VERIFIED·노출 허용 · 원문 기록 존재(IP)
//  N7 sinsalFacts: 4기둥 표본 전수(60 일주 × 12 연지 × 12 시지 · 월주 고정) = 위 규칙 합성 · 기준·출처 표기
//  N8 서버: saju 계열에 엔진 신살 블록 주입 · LLM 스키마에서 sinsal 요구 제거 · 응답 sinsal = 엔진 값
//  N9 화면: 무료 사주·프리미엄·PDF 신살이 응답 sinsal(엔진)만 그림 · 기준 표기 · 도화·공망 문구 없음
//  N10 문법
//  ★사후(v805 P-805-C2 · 2026-10-15 · 기준 완화 아님 — 누출 경로 추가 봉쇄):
//  N11 서버: saju_premium_1 응답의 sinsal 키는 항상 삭제(엔진 신살은 premium_2 몫)
//  N12 화면: 프리미엄 합치기(첫 시도·재시도)에서 1단계 응답 sinsal 을 받지 않음(delete r1.sinsal 후 합침)
// ============================================================
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
const ROOT = path.join(__dirname, '..');
const rd = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
let total = 0, pass = 0; const fails = [];
function check(id, name, ok, detail) { total++; if (ok) pass++; else fails.push(id); console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${id} ${name}${detail ? ' — ' + detail : ''}`); }
const ST = '甲乙丙丁戊己庚辛壬癸'.split(''), BR = '子丑寅卯辰巳午未申酉戌亥'.split('');
// ── 원문 직독 표(YH) — 독립 기술 ──
const YH_GWIIN = { 甲: '丑未', 戊: '丑未', 庚: '丑未', 乙: '子申', 己: '子申', 丙: '亥酉', 丁: '亥酉', 壬: '卯巳', 癸: '卯巳', 辛: '午寅' };   // 牛羊·鼠猴·猪雞·兔蛇·馬虎
const YH_YANGIN = { 甲: '卯', 乙: '辰', 丙: '午', 丁: '未', 戊: '午', 己: '未', 庚: '酉', 辛: '戌', 壬: '子', 癸: '丑' };
const GROUP = { 申: '申子辰', 子: '申子辰', 辰: '申子辰', 寅: '寅午戌', 午: '寅午戌', 戌: '寅午戌', 巳: '巳酉丑', 酉: '巳酉丑', 丑: '巳酉丑', 亥: '亥卯未', 卯: '亥卯未', 未: '亥卯未' };
const YH_MA = { 申子辰: '寅', 寅午戌: '申', 巳酉丑: '亥', 亥卯未: '巳' };
const YH_GAE = { 寅午戌: '戌', 巳酉丑: '丑', 申子辰: '辰', 亥卯未: '未' };
let BI = null; try { BI = require(path.join(ROOT, 'api', '_engine', 'bind.js')); } catch (e) { BI = null; }
const has = BI && typeof BI.sinsalFacts === 'function' && typeof BI.SINSAL_RULES === 'object';
const R = has ? BI.SINSAL_RULES : null;
{ let bad = 0; if (has) for (const s of ST) for (const b of BR) if (((R.gwiin[s] || '').indexOf(b) !== -1) !== (YH_GWIIN[s].indexOf(b) !== -1)) bad++;
  check('N1', '천을귀인 10×12 = 연해자평 卷一 22면', has && bad === 0, has ? (bad ? '불일치 ' + bad : '') : 'bind.sinsalFacts/SINSAL_RULES 없음'); }
{ let bad = 0; if (has) for (const s of ST) for (const b of BR) if ((R.yangin[s] === b) !== (YH_YANGIN[s] === b)) bad++;
  check('N2', '양인 10×12 = 연해자평 卷一 32면(己→未 포함)', has && bad === 0, has ? (bad ? '불일치 ' + bad : '') : '없음'); }
{ let bad = 0; if (has) for (const y of BR) for (const b of BR) if ((R.yeokma[GROUP[y]] === b) !== (YH_MA[GROUP[y]] === b)) bad++;
  check('N3', '역마 12×12 = 연해자평 卷一 26면', has && bad === 0, has ? (bad ? '불일치 ' + bad : '') : '없음'); }
{ let bad = 0; if (has) for (const y of BR) for (const b of BR) if ((R.hwagae[GROUP[y]] === b) !== (YH_GAE[GROUP[y]] === b)) bad++;
  check('N4', '화개 12×12 = 연해자평 卷一 26면', has && bad === 0, has ? (bad ? '불일치 ' + bad : '') : '없음'); }
{ const B = rd('api/_engine/bind.js'); const keys = has ? Object.keys(R).sort().join(',') : '';
  check('N5', '미검증 신살(도화·공망 등) 엔진 출력 없음', has && keys === 'gwiin,hwagae,yangin,yeokma' && !/도화|桃花|咸池|공망|空亡/.test((B.match(/function sinsalFacts[\s\S]*?\n}\n/) || [''])[0]), keys); }
{ const AU = require(path.join(ROOT, 'api', '_engine', 'authority.js')); const ok1 = AU.userSurfaceable('sinsal') === true;
  const rec = path.join(ROOT, '..', 'ChunWoon_IP', 'saju', '원문직독_신살4종_2026-10-14.md'); const ok2 = fs.existsSync(rec) || process.env.P43_SKIP_IP === '1';
  check('N6', 'authority sinsal VERIFIED·노출 · 원문 직독 기록(IP) 존재', ok1 && ok2, `sinsal ${ok1} · 기록 ${fs.existsSync(rec)}`); }
{ let bad = 0, n = 0, first = '', lab = true;
  if (has) for (let dp = 0; dp < 60; dp++) for (const y of BR) for (const h of BR) {
    const yPill = ST[BR.indexOf(y) % 2 === 0 ? 0 : 1] + y;   // 연주: 음양 맞춘 실재 간지
    const dPill = ST[dp % 10] + BR[dp % 12], hPill = ST[BR.indexOf(h) % 2 === 0 ? 0 : 1] + h, mPill = '丙寅';
    const f = BI.sinsalFacts({ yearPillar: yPill, monthPillar: mPill, dayPillar: dPill, hourPillar: hPill }); n++;
    const br = [y, '寅', BR[dp % 12], h], pos = ['연지', '월지', '일지', '시지'], ds = ST[dp % 10], exp = [];
    br.forEach((b, i) => { if (YH_GWIIN[ds].indexOf(b) !== -1) exp.push('천을귀인@' + pos[i]); });
    br.forEach((b, i) => { if (YH_YANGIN[ds] === b) exp.push('양인@' + pos[i]); });
    br.forEach((b, i) => { if (i !== 0 && YH_MA[GROUP[y]] === b) exp.push('역마@' + pos[i]); });
    br.forEach((b, i) => { if (i !== 0 && YH_GAE[GROUP[y]] === b) exp.push('화개@' + pos[i]); });
    const got = ((f && f.list) || []).map(x => x.name + '@' + x.position);
    if (got.slice().sort().join() !== exp.slice().sort().join()) { bad++; if (!first) first = `${yPill} ${mPill} ${dPill} ${hPill}: got ${got} exp ${exp}`; }
    if (f && (f.list || []).some(x => !x.basis || !x.source)) lab = false; }
  check('N7', `sinsalFacts 4기둥 표본 전수 = 원문 규칙 합성 · 기준·출처 표기`, has && bad === 0 && lab, has ? `n ${n}${bad ? ' · 불일치 ' + bad + ' · ' + first : ''}${lab ? '' : ' · 기준/출처 누락'}` : '없음'); }
{ const F = rd('api/fortune.js'); const okInj = /sinsalFacts\(/.test(F) && /sinsalBlock\(/.test(F); const okNoAsk = !/"sinsal"\s*:\s*\[/.test(F) && !/천을귀인·도화살·역마살·공망/.test(F); const okOut = /parsed\.sinsal\s*=/.test(F);
  check('N8', '서버: 엔진 신살 블록 주입 · LLM sinsal 요구 제거 · 응답 sinsal = 엔진', okInj && okNoAsk && okOut, `주입 ${okInj} · 요구 제거 ${okNoAsk} · 덮어쓰기 ${okOut}`); }
{ const H = rd('index.html'); const okR = /_cwSinsalHTML\(/.test(H) && (H.match(/_cwSinsalHTML\(/g) || []).length >= 3; const okB = /일간 기준|연지 기준/.test(H) || /\.basis/.test(H); const okNo = !/도화살|공망/.test(H.slice(H.indexOf('function _cwSinsalHTML'), H.indexOf('function _cwSinsalHTML') + 3000));
  check('N9', '화면: 무료·프리미엄·PDF 신살 = 엔진(_cwSinsalHTML) · 기준 표기', okR && okB && okNo, `렌더 ${okR} · 기준 ${okB} · 미검증 문구 없음 ${okNo}`); }
{ const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'p43-')); const bad = []; const H = rd('index.html');
  [...H.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)].filter(m => !/src=|application\/ld\+json|type="module"/.test(m[1] || '')).forEach((m, i) => { const f = path.join(tmp, 'b' + i + '.js'); fs.writeFileSync(f, m[2]); try { cp.execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); } catch (e) { bad.push('index#' + i); } });
  for (const p of ['api/_engine/bind.js', 'api/_engine/authority.js']) { try { cp.execFileSync(process.execPath, ['--check', path.join(ROOT, p)], { stdio: 'pipe' }); } catch (e) { bad.push(p); } }
  { const f = path.join(tmp, 'f.mjs'); fs.writeFileSync(f, rd('api/fortune.js')); try { cp.execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); } catch (e) { bad.push('fortune'); } }
  check('N10', '문법', bad.length === 0, bad.join(' · ')); }
{ const F = rd('api/fortune.js'); const i = F.indexOf('P-805-C — 신살은 엔진 값만'); const seg = i < 0 ? '' : F.slice(i, i + 1500);
  const ok = /type === 'saju_premium_1'[^\n]*\)\s*\{?[\s\S]{0,300}?delete parsed\.sinsal/.test(seg) && !/type === 'saju_premium_1'\s*&&\s*Object\.prototype\.hasOwnProperty/.test(seg.replace(/\(type === 'saju_premium_1' \|\| type === 'saju_premium_2'\)/, ''));
  check('N11', '(사후) 서버: saju_premium_1 응답 sinsal 항상 삭제', ok, i < 0 ? '신살 출구 블록 없음' : ''); }
{ const H = rd('index.html'); const calls = [...H.matchAll(/doFetch\('saju_premium_1'\)/g)].map(m => H.slice(m.index, m.index + 160));
  const okEach = calls.length >= 2 && calls.every(c => { const d = c.indexOf('delete r1.sinsal'), a = c.indexOf('Object.assign(merged,r1)'); return d !== -1 && a !== -1 && d < a; });
  check('N12', '(사후) 화면: 프리미엄 합치기 1단계 sinsal 미수용(첫 시도·재시도)', okEach, `호출 ${calls.length}`); }
console.log(`[p43_sinsal_yhzp] total=${total} pass=${pass} fail=${total - pass}${fails.length ? ' · FAIL ' + fails.join(',') : ''}`);
process.exitCode = fails.length ? 1 : 0;
