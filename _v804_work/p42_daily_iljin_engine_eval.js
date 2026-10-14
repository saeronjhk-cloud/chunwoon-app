// ============================================================
//  v804 p42 — 트랙 B(원칙 41 단계 승격 ①): 데일리·홈 띠별 운세를 일진 엔진 사실 위에 세운다
//  node _v804_work/p42_daily_iljin_engine_eval.js   (repo 루트 기준)
//  ★구현 전 작성(Eval-First). 결과를 보고 기준을 바꾸지 않는다(바꾸면 「사후」 표시).
//  원칙: 엔진은 검증된 사실(일진 간지·십신·지지 관계)만 확정한다. POC 가중치 판정(verdict: 좋음/무난/주의)은
//        자작 가중치라 노출하지 않는다(authority verdict DENY 유지 · 원칙 32·40).
//
//  I1 일진 간지 두 독립 구현 일치 — manse.js(날짜 차 · 1990-01-01=丙寅) vs recompute.js(율리우스일) · 1900-01-01~2050-12-31 전 일
//  I2 클라 js/chat.js _cwTodayIljin 산식 = manse.js (같은 구간 전 일)
//  I3 외부 기준점 5건(위키독스 『남두성의 음양 만세력』 2000-01 · 1919-01 표) 일치
//  I4 authority: iljin_ganzi = VERIFIED·노출 허용 · verdict = DENY 유지
//  I5 bind.todayIljinFacts: 60 일주 × 60 일진 전수 — 십신 = myeongli.sipsin · 일지 관계 = myeongli.branchRelations · 시지 관계
//  I6 KST 날짜 경계(UTC 15:00 = KST 자정) · 판정·점수 키 없음 · 사주 없으면 일진만
//  I7 서버 daily_message: todayIljinFacts 사용 · 엔진 블록 주입 · 길흉 단정·점수 금지 지시 · 응답에 facts 동봉
//  I8 화면 데일리 카드: result.facts 로 근거 카드 렌더(판정 단어 없음)
//  I9 홈 띠별 운세: 난수·이름 해시 문구 없음 · 일진 지지 × 띠 지지 관계(엔진) · 클라 관계 함수 = myeongli 144쌍
//  I10 문법
// ============================================================
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const rd = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
let total = 0, pass = 0; const fails = [];
function check(id, name, ok, detail) { total++; if (ok) pass++; else fails.push(id); console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${id} ${name}${detail ? ' — ' + detail : ''}`); }
function fnBody(src, name) { const i = src.search(new RegExp('function\\s+' + name + '\\s*\\(')); if (i < 0) return null; let j = src.indexOf('{', i), d = 0; for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } return null; }
const E = path.join(ROOT, 'api', '_engine');
const MA = require(path.join(E, 'manse.js')), RC = require(path.join(E, 'recompute.js')), ML = require(path.join(E, 'myeongli.js')), AU = require(path.join(E, 'authority.js'));
let BI = null; try { BI = require(path.join(E, 'bind.js')); } catch (e) { BI = null; }
const HS_K = ['갑','을','병','정','무','기','경','신','임','계'], EB_K = ['자','축','인','묘','진','사','오','미','신','유','술','해'];
const toIdx = (g) => { if (!g) return -1; const s = [...String(g)]; let a = ML.STEMS.indexOf(s[0]); if (a < 0) a = HS_K.indexOf(s[0]); let b = ML.BRANCHES.indexOf(s[1]); if (b < 0) b = EB_K.indexOf(s[1]); if (a < 0 || b < 0) return -1; for (let i = 0; i < 60; i++) if (i % 10 === a && i % 12 === b) return i; return -1; };
const days = []; { let t = Date.UTC(1900, 0, 1); const end = Date.UTC(2050, 11, 31); for (; t <= end; t += 86400000) { const d = new Date(t); days.push([d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()]); } }
// I1
{ let bad = 0, first = ''; for (const [y, m, d] of days) { const a = MA.dayGanzi(y, m, d).index; const r = RC.recompute({ birth: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, calType: 'solar', hourIdx: null }); const g = r && r.pillarStrings ? r.pillarStrings.dayPillar : (r && r.pillars && r.pillars.day ? r.pillars.day.ganji : null); const b = toIdx(g); if (a !== b) { bad++; if (!first) first = `${y}-${m}-${d} manse ${a} recompute ${g}`; } }
  check('I1', `일진 두 독립 구현 일치(${days.length}일)`, bad === 0, bad ? `불일치 ${bad} · 첫 ${first}` : ''); }
// I2
{ const C = rd('js/chat.js'); const ref = (C.match(/CW_ILJIN_REF_UTC\s*=\s*Date\.UTC\((\d+),\s*(\d+),\s*(\d+)\)/) || []).slice(1).map(Number), refIdx = Number((C.match(/CW_ILJIN_REF_IDX\s*=\s*(\d+)/) || [])[1]);
  let bad = 0; if (ref.length === 3 && isFinite(refIdx)) { const R0 = Date.UTC(ref[0], ref[1], ref[2]); for (const [y, m, d] of days) { const idx = ((refIdx + Math.round((Date.UTC(y, m - 1, d) - R0) / 86400000)) % 60 + 60) % 60; if (idx !== MA.dayGanzi(y, m, d).index) bad++; } } else bad = -1;
  check('I2', '클라 _cwTodayIljin 산식 = manse.js', bad === 0, bad ? (bad < 0 ? '상수 판독 실패' : '불일치 ' + bad) : ''); }
// I3
{ const AN = [[2000, 1, 1, '戊午'], [2000, 1, 15, '壬申'], [2000, 1, 31, '戊子'], [1919, 1, 1, '癸丑'], [1919, 1, 31, '癸未']]; const bad = AN.filter(([y, m, d, g]) => MA.dayGanzi(y, m, d).ganji !== g);
  check('I3', '외부 기준점 5건 일치(위키독스 남두성의 음양 만세력)', bad.length === 0, bad.map(a => a.join('-') + '→' + MA.dayGanzi(a[0], a[1], a[2]).ganji).join(' · ')); }
// I4
{ const ok1 = AU.userSurfaceable('iljin_ganzi') === true, ok2 = AU.userSurfaceable('verdict') === false;
  check('I4', 'authority: iljin_ganzi 노출 허용(VERIFIED) · verdict DENY 유지', ok1 && ok2, `iljin_ganzi ${ok1} · verdict 차단 ${ok2}`); }
// I5 · I6
const has = BI && typeof BI.todayIljinFacts === 'function';
{ let bad = 0, n = 0, first = '';
  if (has) { const base = Date.UTC(2026, 0, 1, 3, 0, 0); // KST 12:00
    for (let dp = 0; dp < 60; dp++) { const dpStr = ML.STEMS[dp % 10] + ML.BRANCHES[dp % 12];
      for (let k = 0; k < 60; k++) { const now = base + k * 86400000; const kst = new Date(now + 9 * 3600000); const tg = MA.dayGanzi(kst.getUTCFullYear(), kst.getUTCMonth() + 1, kst.getUTCDate());
        const f = BI.todayIljinFacts({ ilgan: HS_K[dp % 10], dayPillar: HS_K[dp % 10] + EB_K[dp % 12], hourBranch: '자시' }, now); n++;
        const sip = ML.sipsin(dp % 10, tg.stemIdx), rIl = ML.branchRelations(tg.branchIdx, dp % 12), rHr = ML.branchRelations(tg.branchIdx, 0);
        const okG = f && toIdx(f.todayGanzi) === tg.index, okS = f && f.sipsin && f.sipsin.name === sip.name;
        const il = f && (f.relations || []).find(r => r.with === '일지'), hr = f && (f.relations || []).find(r => r.with === '시지');
        const okR = il && JSON.stringify((il.tags || []).slice().sort()) === JSON.stringify(rIl.slice().sort()) && hr && JSON.stringify((hr.tags || []).slice().sort()) === JSON.stringify(rHr.slice().sort());
        if (!(okG && okS && okR)) { bad++; if (!first) first = `${dpStr}×${tg.ganji} → ${JSON.stringify(f).slice(0, 160)}`; } } } }
  check('I5', 'todayIljinFacts 60 일주 × 60 일진 전수(십신·일지·시지 관계)', has && bad === 0, has ? `n ${n}${bad ? ' · 불일치 ' + bad + ' · ' + first : ''}` : 'bind.todayIljinFacts 없음'); }
{ let ok = false, det = 'bind.todayIljinFacts 없음';
  if (has) { const a = BI.todayIljinFacts({}, Date.UTC(2026, 9, 13, 15, 0, 0)), b = BI.todayIljinFacts({}, Date.UTC(2026, 9, 13, 14, 59, 0));
    const ks = JSON.stringify(a) + JSON.stringify(b);
    ok = !!a && !!b && a.date === '2026-10-14' && b.date === '2026-10-13' && !a.sipsin && !/verdict|score|good|caution|길흉/i.test(ks);
    det = `${a && a.date}/${b && b.date} · 사주 없음 sipsin ${a && a.sipsin ? '있음' : '없음'}`; }
  check('I6', 'KST 날짜 경계 · 판정·점수 키 없음 · 사주 없으면 일진만', ok, det); }
// I7
{ const F = rd('api/fortune.js'); const i = F.indexOf("} else if (type === 'daily_message') {"); const blk = i > 0 ? F.slice(i, F.indexOf('} else if (type', i + 20) > 0 ? F.indexOf('} else if (type', i + 20) : i + 6000) : '';
  const okUse = /todayIljinFacts\(/.test(blk) && /엔진 확정/.test(blk), okRule = /길흉 단정/.test(blk) && /점수/.test(blk);
  const ret = F.slice(F.indexOf("if (type === 'daily_message') {", F.indexOf('JSON 파싱 안 함') - 200), F.indexOf("if (type === 'daily_message') {", F.indexOf('JSON 파싱 안 함') - 200) + 1500);
  const okRet = /facts/.test(ret);
  check('I7', '서버 daily: 엔진 블록 주입 · 길흉 단정·점수 금지 · 응답에 facts', okUse && okRule && okRet, `사용 ${okUse} · 규칙 ${okRule} · 응답 ${okRet}`); }
// I8
{ const C = rd('js/chat.js'); const b = fnBody(C, '_cwIljinFactsCard') || ''; const ok = !!b && /\.facts\b/.test(C) && /일진/.test(b) && !/길한 날|흉한 날|좋은 날|나쁜 날|주의할 날|점수|행운/.test(b);
  check('I8', '데일리 근거 카드(_cwIljinFactsCard · result.facts · 판정 단어 없음)', ok, b ? '' : '함수 없음'); }
// I9
{ const H = rd('index.html'); const b = fnBody(H, 'selectZodiac') || ''; const okNo = !/sRng|nameHash|MSGS\[|Math\.random/.test(b); const okUse = /_cwBranchRelTags\(/.test(b) && /일진/.test(b);
  const fb = fnBody(H, '_cwBranchRelTags'); let bad = -1;
  if (fb) { try { const ctx = {}; const tables = ['EB_CHUNG', 'EB_HAB', 'EB_SAMHAB', 'EB_HAE', 'EB_SAMHYUNG', 'EB_HYUNG_BI'].map(n => (H.match(new RegExp('const ' + n + '=\\[[^;]*\\];')) || [''])[0]).join('\n'); vm.runInNewContext(tables + '\n' + fb + '\nthis.f=_cwBranchRelTags;', ctx); bad = 0;
      for (let a = 0; a < 12; a++) for (let c = 0; c < 12; c++) { const x = (ctx.f(a, c) || []).slice().sort().join(), y = ML.branchRelations(a, c).slice().sort().join(); if (x !== y) bad++; } } catch (e) { bad = -2; } }
  check('I9', '홈 띠별 운세: 난수·해시 문구 없음 · 일진×띠 관계 · 클라 관계 = myeongli 144쌍', okNo && okUse && bad === 0, `난수 없음 ${okNo} · 엔진 사용 ${okUse} · 144쌍 불일치 ${bad}`); }
// I10
{ const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'p42-')); const bad = []; const H = rd('index.html');
  [...H.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)].filter(m => !/src=|application\/ld\+json|type="module"/.test(m[1] || '')).forEach((m, i) => { const f = path.join(tmp, 'b' + i + '.js'); fs.writeFileSync(f, m[2]); try { cp.execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); } catch (e) { bad.push('index#' + i); } });
  for (const p of ['js/chat.js', 'api/_engine/bind.js', 'api/_engine/authority.js']) { try { cp.execFileSync(process.execPath, ['--check', path.join(ROOT, p)], { stdio: 'pipe' }); } catch (e) { bad.push(p); } }
  { const f = path.join(tmp, 'f.mjs'); fs.writeFileSync(f, rd('api/fortune.js')); try { cp.execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); } catch (e) { bad.push('fortune'); } }
  check('I10', '문법', bad.length === 0, bad.join(' · ')); }
console.log(`[p42_daily_iljin_engine] total=${total} pass=${pass} fail=${total - pass}${fails.length ? ' · FAIL ' + fails.join(',') : ''}`);
process.exitCode = fails.length ? 1 : 0;
