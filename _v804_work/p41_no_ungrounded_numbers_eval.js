// ============================================================
//  v804 p41 — 원칙 40(제이 결정 2026-10-14 D1): 엔진 근거 없는 수치를 모든 기능에서 내린다
//  node _v804_work/p41_no_ungrounded_numbers_eval.js   (repo 루트 기준 · 정적 검사)
//  ★수리 전에 작성(Eval-First) — 수리 전 FAIL 다수가 정상. 기준을 결과 보고 바꾸지 않는다(바꾸면 「사후」 표시).
//  계획·인벤토리: _v804_work/천운_전기능_관상수준화_계획_2026-10-14.md §1 트랙 A · §4
//
//  N1 서버 스키마에 근거 없는 수치 필드 없음      N2 서버 지시문에 행운·점수 요구 없음
//  N3 궁합 서버 정의역 = 엔진(40~98) · 「LLM 보정 score」 지시 없음
//  N4 데일리 서버 날짜 KST · ★LUCK★ 토큰 요구 없음     N5 관상 프롬프트에 자작 부위 점수 없음
//  N6 사주 대운 「0~9세」 고정 구간 없음(bind.js)
//  U1 화면·PDF가 제거 필드를 읽지 않음(index.html · js/tarot.js · js/chat.js)
//  U2 사주·토정·궁합 LLM 점수(scores)·기본값(||75 ||70) 렌더 없음 · 궁합 총점은 엔진만
//  U3 토정 해시 가짜 결과 없음(renderTojeongFallback 이 sRng/난수 점수를 쓰지 않음) · [PARSE_FAILED] 정직 처리
//  U4 홈 띠별 운세: 난수 별점·행운 없음          U5 관상: 자작 부위 점수 막대·해시 폴백·p1 대운 그래프·확신도 없음
//  U6 꿈: 엔진 행운 숫자·LLM 길흉 배지 없음       U7 타로 프리미엄 재시도가 카드를 다시 뽑지 않음
//  U8 작명: 81수 획수·등급 수치 숨김(한자 획수 DB 전) · 사주 매칭·SEO·상표 점수 없음
//  U9 페이월·로딩 문구가 제거 항목을 약속하지 않음
//  U10 문법: index.html 인라인 스크립트 · js/tarot.js · js/chat.js · api/fortune.js · api/_engine/bind.js node --check
// ============================================================
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
const ROOT = path.join(__dirname, '..');
const rd = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const F = rd('api/fortune.js'), B = rd('api/_engine/bind.js'), H = rd('index.html'), T = rd('js/tarot.js'), C = rd('js/chat.js');
const CL = H + '\n' + T + '\n' + C;
let total = 0, pass = 0; const fails = [];
function check(id, name, ok, detail) { total++; if (ok) pass++; else fails.push(id); console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${id} ${name}${detail ? ' — ' + detail : ''}`); }
const hits = (s, re) => { const out = []; let m; const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'); while ((m = g.exec(s))) { out.push(s.slice(0, m.index).split('\n').length + ':' + m[0].slice(0, 40)); if (out.length > 8) break; } return out; };
// 함수 본문 추출(이름으로 · 중괄호 균형)
function fnBody(src, name) { const i = src.search(new RegExp('function\\s+' + name + '\\s*\\(')); if (i < 0) return null; let j = src.indexOf('{', i), d = 0; for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } return null; }

const FIELDS = ['luckyInfo', 'luckyNumbers', 'luckyColor', 'luckyDetail', 'luckyKeyword', 'luckyDay', 'luckyMonths', 'cautionMonths', 'bestMonths', 'cautionDay', 'fortuneScore', 'sajuMatchScore', 'seoScore', 'trademarkScore', 'monthlyScores', 'fortuneGraph', 'fortuneType'];
// ── 서버 ──
{ const h = hits(F, new RegExp('"(' + FIELDS.join('|') + ')"\\s*:')); check('N1a', '서버 JSON 스키마에 제거 필드 없음', h.length === 0, h.join(' · ')); }
{ const h = hits(F, /"scores"\s*:\s*\{|"score"\s*:\s*number|"confidence"\s*:\s*number|"decades"\s*:/); check('N1b', '서버 스키마에 LLM 점수(scores·score·confidence·decades) 없음', h.length === 0, h.join(' · ')); }
{ const h = hits(F, /행운 정보|행운의 색|행운 토큰|등록 가능성 점수|SEO 점수|점수 \(1-10\)|sajuMatchScore|monthlyScores|길일·주의일|길월|피할 달/); check('N2', '서버 지시문에 행운·점수·길일 요구 없음', h.length === 0, h.join(' · ')); }
check('N3a', '궁합 서버 정의역 = 엔진 40~98', /CW_COMPAT_SCORE_MIN\s*=\s*40\s*,\s*CW_COMPAT_SCORE_MAX\s*=\s*98/.test(F), (F.match(/CW_COMPAT_SCORE_MIN[^;]*;/) || [''])[0]);
check('N3b', '「LLM 보정 score」 지시 없음', !/보정한 score/.test(F));
{ const h = hits(F, /toLocaleDateString\('ko-KR'\)/); check('N4a', '데일리 서버 날짜에 KST 지정(timeZone 없는 ko-KR 날짜 없음)', h.length === 0, h.join(' · ')); }
check('N4b', '★LUCK★ 토큰 요구 없음', !/★LUCK★색|LUCK★ 행운|행운 정보 토큰/.test(F));
check('N5', '관상 프롬프트에 자작 부위 점수 없음', !/score\|\|''\}점/.test(F), hits(F, /score\|\|''\}점/).join(' · '));
check('N6', '사주 대운 「0~9세」 고정 구간 없음(bind.js)', !/0~9세/.test(B), hits(B, /0~9세/).join(' · '));
// ── 화면 ──
{ const h = hits(CL, new RegExp('\\.(' + FIELDS.join('|') + ')\\b')); check('U1', '화면·PDF가 제거 필드를 읽지 않음', h.length === 0, h.join(' · ')); }
{ const h = hits(H, /result\.scores|prem\.scores|sc\.(overall|wealth|career|love|health)|\|\|75\b|\|\|70\b|class="month-score"/); check('U2a', '사주·토정·궁합 LLM 점수·기본값 렌더 없음', h.length === 0, h.join(' · ')); }
{ const h = hits(H, /result\.score\b|result\.grade\b/); check('U2b', '궁합 총점·등급은 엔진만(LLM score/grade 폴백 없음)', h.length === 0, h.join(' · ')); }
{ const b = fnBody(H, 'renderTojeongFallback'); check('U3a', '토정 해시 가짜 결과 없음', !b || !/sRng|nameHash|Math\.random|TJ_YEAR|TJ_MON/.test(b), b ? '본문에 난수·해시 사용' : '함수 없음'); }
{ const k = H.indexOf('renderTojeongResult(data.result'); const pre = k > 0 ? H.slice(Math.max(0, k - 500), k) : ''; check('U3b', '토정 [PARSE_FAILED]·raw 응답을 정상 결과로 그리지 않음', /PARSE_FAILED|\.raw\b/.test(pre), k > 0 ? '' : '호출부 없음'); }
{ const b = fnBody(H, 'selectZodiac') || ''; check('U4', '홈 띠별 운세: 난수 별점·행운 없음', !/class="stars"|행운의 색|행운의 숫자|COLORS\[|DIRS\[/.test(b), hits(b, /class="stars"|행운의|COLORS\[|DIRS\[/).join(' · ')); }
{ const h = hits(H, /trait-meter-fill" data-w|h\.hash>>>|drawFortuneGraph|확신도|연령대별 대운 그래프/); check('U5', '관상: 자작 부위 점수 막대·해시 폴백·대운 그래프·확신도 없음', h.length === 0, h.join(' · ')); }
{ const b = fnBody(H, '_cwDreamEngineBlock') || ''; const h = hits(b, /\.num\b|numbers|행운 숫자/); check('U6', '꿈: 엔진 행운 숫자 없음 · LLM 길흉 배지 없음', h.length === 0 && !/result\.fortuneType/.test(H), h.join(' · ')); }
{ const b = fnBody(T, 'retryTarotPremiumAPI') || ''; check('U7', '타로 프리미엄 재시도가 카드를 다시 뽑지 않음', !!b && !/unlockTarotPremium\s*\(/.test(b), b ? '' : '함수 없음'); }
{ const h = hits(H, /totalLabel|'총 '\+totalEval|\$\{gradeLabel\}|사주 매칭 점수|nc-score/); check('U8', '작명: 81수 획수·등급 수치 숨김 · 매칭·SEO·상표 점수 없음', h.length === 0, h.join(' · ')); }
// ★사후 추가(2026-10-14 리뷰 · 수리 후 발견): 작명 프리미엄의 LLM 81수 등급·사격 풀이·획수 요구 — 기준을 완화하지 않고 범위만 넓힘
{ const h = hits(F + '\n' + CL, /gyeokGrade|fiveGyeokDetail|81수 풀이|부수\+획수|사격\(천·인·지·외·총\) 조합 확인|수리 81수 관점 고려/); check('U8b', '(사후) 작명: LLM 81수 등급·사격 풀이·획수 서술 요구 없음', h.length === 0, h.join(' · ')); }
// ★사후 주석: U1은 LLM 응답의 .fortuneType 을 막는다. 꿈 엔진 요약(js/dream_engine.js summarize)의 fortuneType 은 엔진 값이라 허용 —
//   index.html 은 구조분해(const {fortuneType:engFt}=…summarize(hits))로 읽는다. U6이 result.fortuneType(LLM)을 따로 막는다.
{ const h = hits(CL, /행운의 색·숫자|행운 정보|SEO 점수|기억성·발음 점수|결혼 길흉일|대운 그래프|수리 81수 길수 매핑|행운 정보 정리|🍀 행운 안내|🍀 오늘의 행운|행운 키워드/); check('U9', '페이월·로딩·렌더 문구가 제거 항목을 약속·표시하지 않음', h.length === 0, h.join(' · ')); }
// ── 문법 ──
{ const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'p41-')); const bad = [];
  const blocks = [...H.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)].filter(m => !/src=|application\/ld\+json|type="module"/.test(m[1] || ''));
  blocks.forEach((m, i) => { const f = path.join(tmp, 'b' + i + '.js'); fs.writeFileSync(f, m[2]); try { cp.execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); } catch (e) { bad.push('index#' + i); } });
  for (const p of ['js/tarot.js', 'js/chat.js', 'api/_engine/bind.js']) { try { cp.execFileSync(process.execPath, ['--check', path.join(ROOT, p)], { stdio: 'pipe' }); } catch (e) { bad.push(p); } }
  { const f = path.join(tmp, 'fortune.mjs'); fs.writeFileSync(f, F); try { cp.execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); } catch (e) { bad.push('api/fortune.js'); } }
  check('U10', '문법(index 인라인 ' + blocks.length + '블록 · tarot · chat · bind · fortune)', bad.length === 0, bad.join(' · ')); }
console.log(`[p41_no_ungrounded_numbers] total=${total} pass=${pass} fail=${total - pass}${fails.length ? ' · FAIL ' + fails.join(',') : ''}`);
process.exitCode = fails.length ? 1 : 0;
