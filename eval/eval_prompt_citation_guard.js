/* eval_prompt_citation_guard.js — G축 프런트 인용·원문 격리 게이트 (본검사 28 + 공허통과 차단 pin 4 = 32검사)
 *
 * v2 (2026-07-28) — P0-1 반영:
 *   · 하드코딩 고전 인용 13건·131자 **제거 완료** ⟹ F3·F4 핀을 0으로 재고정
 *   · 인용 렌더러 5곳(citationHTML 1 + citBlock 4) 전부 서지 표기 전용으로 축약
 *   · ★G그룹 신설 — 결정 39(원문 격리는 파일명이 아니라 **내용**으로 판정한다)를
 *     패키지 밖 프런트 리포까지 확장. 전 파일을 열어 연속 고전 원문 함량을 재고,
 *     임계 초과 파일이 배포 제외 규칙에 걸리는지 검사한다.
 *
 * 검사 대상 (패키지 밖 프런트 리포):
 *   <front_root>/api/fortune.js · index.html · js/tarot.js · .vercelignore · .gitignore
 *
 * front_root 결정 순서 (fail-closed):
 *   1) 환경변수 CHUNWOON_FRONT_ROOT
 *   2) 이 파일 위치에서 상위로 올라가며 api/fortune.js + index.html 를 동시에 갖는 첫 디렉터리
 *   3) 못 찾으면 전건 FAIL (프로세스 중단 아님)
 *
 * ★결정 41 (fail-closed): 모든 검사는 지연 평가 + try/catch.
 *   예외는 프로세스 중단이 아니라 `EXCEPTION(fail-closed): …` FAIL 항목으로 계상한다.
 *
 * ★v7.60 (2026-07-28) 결정 41 패치 C — **공허 통과 차단**:
 *   이 게이트가 막는 것은 되돌릴 수 없는 고전 원문 노출이다. 따라서 최악의 실패는
 *   「스캔 대상이 0건인데 미차단 0건 = 이상 없음」으로 통과하는 것이다(거짓 녹색).
 *   실측: 디렉터리 열거가 0건을 돌려주도록만 해도 수리 전에는 total=28 pass=28 fail=0 · exit 0.
 *   → 스캔 파일 수·적발 건수·차단 실적·ignore 패턴 수에 각각 하한 pin(SELF1~4)을 걸고,
 *     G3 자신도 스캔 규모 하한을 만족하지 못하면 「판정 못함」으로 FAIL 한다.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { lazy, pinChecks } = require('./_failclosed');

// ──────────────────────────────────────────────────────────────
// 0. 대상 루트 해석
// ──────────────────────────────────────────────────────────────
function resolveFrontRoot() {
  const env = process.env.CHUNWOON_FRONT_ROOT;
  if (env && fs.existsSync(path.join(env, 'api', 'fortune.js'))) return env;
  let dir = __dirname;
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, 'api', 'fortune.js')) && fs.existsSync(path.join(dir, 'index.html'))) return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}
// ★결정 41 패치 B — 톱레벨 해석을 봉인한다. 어떤 이유로든 예외가 나면 null 로 떨어지고
//   (프로세스 중단이 아니라) 전 검사가 「front_root=null」 FAIL 로 계상된다.
const FRONT_ROOT = (() => { try { return resolveFrontRoot(); } catch (e) { return null; } })();

function readTarget(rel) {
  if (!FRONT_ROOT) throw new Error('front_root 미해석 — CHUNWOON_FRONT_ROOT 를 지정하거나 프런트 리포 하위에서 실행하십시오');
  const p = path.join(FRONT_ROOT, rel);
  if (!fs.existsSync(p)) throw new Error('대상 파일 부재: ' + p);
  const s = fs.readFileSync(p, 'utf8');
  if (typeof s !== 'string' || s.length < 2) throw new Error('대상 파일 내용 파손(len=' + (s ? s.length : 0) + '): ' + p);
  return s;
}

// ──────────────────────────────────────────────────────────────
// 1. 주석 배제 (초판의 fail-open 결함 수리분)
// ──────────────────────────────────────────────────────────────
// 2026-07-28 P0-A 수리 — 잠복 fail-open 제거.
//   종전판은 정규식 하나로 블록 주석을 통째로 지웠는데, 문자열 리터럴 안의 슬래시-별표
//   (예: accept="image/*")도 주석 시작으로 오인한다. 그러면 다음 종료 토큰까지 수만 자가
//   통째로 공백이 되어 그 구간의 위반이 영구 미탐지된다(적발 0건 = 이상 없음으로 위장).
//   ⟹ 「행의 첫 토큰이 블록 주석 시작인 진짜 주석」만 비운다. 덜 지우므로 fail-closed 방향이다.
function stripBlockComments(src) {
  const OPEN = '/' + '*', CLOSE = '*' + '/';
  const out = [];
  let inBlock = false;
  for (const line of src.split(/\r?\n/)) {
    if (inBlock) {
      const end = line.indexOf(CLOSE);
      if (end === -1) { out.push(''); continue; }
      inBlock = false;
      out.push(' '.repeat(end + 2) + line.slice(end + 2));
      continue;
    }
    const t = line.trimStart();
    if (t.startsWith(OPEN)) {
      const lead = line.length - t.length;
      const end = line.indexOf(CLOSE, lead);
      if (end === -1) { inBlock = true; out.push(''); continue; }
      out.push(' '.repeat(end + 2) + line.slice(end + 2));
      continue;
    }
    out.push(line);
  }
  return out.join('\n');
}
function codeLines(src) {
  return stripBlockComments(src).split(/\r?\n/).map(line => {
    let idx = -1;
    for (let i = 0; i + 1 < line.length; i++) {
      if (line[i] === '/' && line[i + 1] === '/') {
        if (i > 0 && line[i - 1] === ':') { i++; continue; }
        idx = i; break;
      }
    }
    return idx === -1 ? line : line.slice(0, idx);
  });
}
const linesWhere = (lines, pred) => lines.map((l, i) => [i + 1, l]).filter(([, l]) => pred(l)).map(([n]) => n);

// ──────────────────────────────────────────────────────────────
// 2. 상수
// ──────────────────────────────────────────────────────────────
const ALLOWED_IDS = ['SRC_ZPJZ_A', 'SRC_JCS_A', 'SRC_GTBG_A', 'SRC_YHZP_A'];
const EXCLUDED_IDS = ['SRC_TOJEONG_A', 'SRC_SMTH_A'];
const UNREGISTERED = ['마의상법', '유장상법', '신상전편', '달마상법', '오행상법', '면부백세유년도', '주공해몽', '몽점일지', '작명대전', '만성통보'];   // ★2026-07-29 v7.63 R7: 주공해몽서 -> 주공해몽 (IP BAN_U07 = 주공해몽|周公解夢. 종전 표기는 단독 주공해몽 을 놓쳤다)
const BAN_TOKENS = ['생성하지 마세요', '지어내지 마세요', '생성 금지', '만들지 마세요'];
const PROHIBITION_TOKENS = ['마세요', '금지', '말 것', '쓰지 마'];

const CITATION_RULE_ATTACH_PIN = 6;   // 2026-07-28 P0-A: compat_premium_1 주입 누락 보정으로 5 -> 6 (조이는 방향)
const CITATION_REF_PIN = 8;
// ★G-E5 수리 반영 — 관상 프리미엄 doFetch 2곳에 2층 가드를 보강해 14 → 16
const GUARD_PIN_INDEX = 16;
const GUARD_PIN_TAROT = 2;
// index.html 내 doFetch 정의 수. 전건이 2층 raw 가드를 가져야 한다.
const DOFETCH_PIN = 12;

// ★P0-1 반영 — 하드코딩 원문은 전량 제거됐다. 상한을 0으로 조인다(재유입 차단).
const HARDCODED_CITATION_PIN = 0;
const HARDCODED_ORIGINAL_CHARS_PIN = 0;
// 서지 표기는 유지돼야 한다 — 콘텐츠 통삭 방지 하한 핀
const BIBLIO_ONLY_PIN = 13;
// 인용 렌더러 총 개수 (citationHTML 1 + citBlock 4). 실측 고정.
const RENDERER_PIN = 5;

// 배포 원문 함량 임계 — 패키지 가드(eval/fixtures/classical_text_profile.json)와 동일 규약
const PIN_FLOOR = 200;
const CJK_G = /[一-鿿]/g;
const CLS_G = /[一-鿿][一-鿿、。，；：？！…]*/g;
const TEXTY = /\.(html|htm|js|mjs|cjs|json|css|md|txt|tsv|csv|svg|py|yml|yaml)$/i;
const MAX_SCAN_BYTES = 8 * 1024 * 1024;

// ★★결정 41 패치 C — 공허 통과 차단 pin.
//   본 게이트는 「되돌릴 수 없는 고전 원문 노출」을 막는 통제다. 가장 위험한 실패는
//   **스캔 대상이 0건인데 「미차단 0건 = 이상 없음」으로 통과**하는 것이다(거짓 녹색).
//   그래서 ①스캔한 텍스트 파일 수 ②임계 초과(적발) 파일 수 ③실제로 배포 제외 규칙에
//   걸린 파일 수 — 셋 모두에 하한을 건다. 하나라도 무너지면 「판정 못함」으로 FAIL 한다.
const SCAN_FILES_PIN   = 1200;   // 실측 1,655 (프런트 리포 전체 텍스트 파일)
const HEAVY_FILES_PIN  = 300;    // 실측 424   (연속 고전 원문 200자 이상)
const BLOCKED_PIN      = 300;    // 실측 424   (그중 배포 제외 규칙에 실제로 걸린 수)
const IGNORE_PAT_PIN   = 20;     // 실측 26    (.vercelignore 유효 패턴 수)

/** 패키지 배포가드와 동일한 측정식: 한자(및 한자문장부호)가 10자 이상 연속된 구간의 한자 수 합 */
function measureClassical(text) {
  let cont = 0;
  for (const m of text.matchAll(CLS_G)) {
    const n = (m[0].match(CJK_G) || []).length;
    if (n >= 10) cont += n;
  }
  return cont;
}

// ──────────────────────────────────────────────────────────────
// 3. gitignore-lite 매처 (.vercelignore / .gitignore 공용)
// ──────────────────────────────────────────────────────────────
/**
 * ★★v7.83 I-126 수리 — 이 매처는 **v7.62 블랙리스트 시대의 모델**이었다.
 *
 * 【무엇이 틀렸나 — 두 방향】
 *   v7.63 R3 가 `.vercelignore` 를 「`/*` 로 전부 배제 + `!` 로 배포 자산만 되돌림」의
 *   **fail-closed 화이트리스트**로 전환했다. 그런데 이 매처는 그 전환을 따라가지 못했다.
 *
 *   ⑴ ★`parseIgnore` 가 `!` 로 시작하는 줄을 **전부 버렸다**.
 *      ⟹ 화이트리스트가 매처에게 **보이지 않는다**. 누가 `!/IP` 를 넣어 고전 원문을
 *        실제로 배포해도 **G3 판정이 한 글자도 바뀌지 않는다.** ★이것이 위험한 방향이다 —
 *        G3 가 막으라고 만들어진 바로 그 편집이 G3 에게 투명하다(fail-open).
 *   ⑵ ★`/*` 가 **죽은 패턴**이었다. 매처는 선행 `/` 를 벗기지 않고 `^\/[^/]*$` 를
 *      상대경로(선행 `/` 없음)에 댔다 ⟹ **어떤 경로와도 매칭되지 않는다**(실측 전건 null).
 *      ⟹ 지금껏 통과해 온 것은 화이트리스트 덕이 아니라, 전환 후에도 파일에 **남아 있던
 *        블랙리스트 줄들**(디렉터리 글롭 `_v` 계열 · `천운_` 접두 문서 · pdf 확장자 등)
 *        덕이었다. 새 최상위 디렉터리를 하나 만들면 그 순간 「미차단」으로 붉어진다
 *        (v7.83 H-1a 이관에서 실제 발생).
 *
 * 【수리 — gitignore 규약을 그대로 구현한다】
 *   ㉠ `!` 줄을 싣는다. **마지막에 매칭된 규칙이 이긴다**(순서가 의미를 갖는다).
 *   ㉡ 루트부터 경로 조각을 **한 단계씩 훑는다**. 상위 디렉터리가 제외된 채로 남으면
 *      하위는 `!` 로 되돌릴 수 없다 — git 이 애초에 그 디렉터리로 내려가지 않기 때문이다.
 *   ㉢ 각 단계에서는 **그 조각 자체**에만 패턴을 댄다(`$` 종단). 상위 매칭은 ㉡ 이 처리한다.
 *      ★종전처럼 `(/.*)?$` 로 늘리면 `/*` 가 `IP/policy` 까지 먹어 ㉡ 과 이중 계산된다.
 *
 * ★값을 하드코딩하지 않는다(결정 126) — 이 매처는 `.vercelignore` **파일이 말하는 것**만
 *   해석한다. 어떤 경로가 배포돼야 하는지의 목록은 여기 없다.
 */
function parseIgnore(text) {
  // ★`!` 줄을 버리지 않는다. 부호를 포함해 **원문 순서 그대로** 싣는다.
  return text.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
}
const toRx = (pat, tail) =>
  new RegExp('^' + pat.split('*').map(s => s.replace(/[.+^${}()|[\]\\?]/g, '\\$&')).join('[^/]*') + tail);

/** 단일 패턴이 **경로 조각 하나**(파일 또는 디렉터리)에 걸리는가. */
function patHits(raw, prefix, isDir) {
  let pat = raw.startsWith('!') ? raw.slice(1) : raw;
  const dirOnly = pat.endsWith('/');
  if (dirOnly) pat = pat.slice(0, -1);
  if (!pat) return false;
  if (dirOnly && !isDir) return false;          // `foo/` 는 디렉터리에만 걸린다
  const anchored = pat.startsWith('/');
  if (anchored) pat = pat.slice(1);
  // gitignore 규약: 슬래시가 **중간에** 있거나 선행 `/` 면 루트 기준 경로 매칭,
  //                 아니면 임의 위치의 **이름** 매칭.
  if (anchored || pat.includes('/')) return toRx(pat, '$').test(prefix);
  return toRx(pat, '$').test(prefix.split('/').pop());
}

/** 이 조각에 대한 최종 상태: null=미매칭 · true=제외 · false=재포함(`!`) */
function ignoreState(patterns, prefix, isDir) {
  let state = null;
  for (const raw of patterns) {
    if (patHits(raw, prefix, isDir)) state = !raw.startsWith('!');   // ★마지막 매칭이 이긴다
  }
  return state;
}

/**
 * 상대경로가 배포에서 **제외**되는가.
 * @returns {string|null} 제외면 근거 문자열, 배포되면 `null`(= 호출부의 「미차단」)
 */
function ignoreMatches(patterns, relPath) {
  const segs = relPath.split('/');
  let excluded = false, why = null;
  for (let i = 0; i < segs.length; i++) {
    const prefix = segs.slice(0, i + 1).join('/');
    const st = ignoreState(patterns, prefix, i < segs.length - 1);
    if (st === true) { excluded = true; why = prefix; }
    else if (st === false) { excluded = false; why = null; }
    // st === null 이면 상위에서 물려받은 상태를 그대로 유지한다.
  }
  return excluded ? ('제외@' + why) : null;
}
function walkFront(dir, base, acc) {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of ents) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkFront(full, base, acc);
    else if (e.isFile()) acc.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return acc;
}

// ──────────────────────────────────────────────────────────────
// 3b. 내용 스캔 (지연·1회 평가 — G3 와 SELF pin 이 같은 실측을 공유한다)
// ──────────────────────────────────────────────────────────────
const SCAN = lazy(() => {
  if (!FRONT_ROOT) throw new Error('front_root 미해석 — 스캔 불가');
  const vi = path.join(FRONT_ROOT, '.vercelignore');
  if (!fs.existsSync(vi)) throw new Error('.vercelignore 부재 — 배포 제외 규칙 없음');
  const pats = parseIgnore(fs.readFileSync(vi, 'utf8'));
  const leaked = []; let scanned = 0, heavy = 0, blocked = 0;
  for (const rel of walkFront(FRONT_ROOT, FRONT_ROOT, [])) {
    if (!TEXTY.test(rel)) continue;
    const full = path.join(FRONT_ROOT, rel);
    let st; try { st = fs.statSync(full); } catch { continue; }
    if (st.size > MAX_SCAN_BYTES) continue;
    let t; try { t = fs.readFileSync(full, 'utf8'); } catch { continue; }
    scanned++;
    const cont = measureClassical(t);
    if (cont < PIN_FLOOR) continue;
    heavy++;
    if (!ignoreMatches(pats, rel)) leaked.push(rel + '(' + cont + '자)'); else blocked++;
  }
  return { pats, scanned, heavy, blocked, leaked };
});

// ──────────────────────────────────────────────────────────────
// 4. 검사 등록 (지연 평가)
// ──────────────────────────────────────────────────────────────
const checks = [];
const check = (id, desc, fn) => checks.push({ id, desc, fn });
const FJS = path.join('api', 'fortune.js');

/* ── A. 대상 확보 ── */
check('A1', 'api/fortune.js 확보 (>=40,000 B)', () => {
  const s = readTarget(FJS);
  return { ok: s.length >= 40000, detail: 'len=' + s.length };
});
check('A2', 'index.html 확보 (>=100,000 B)', () => {
  const s = readTarget('index.html');
  return { ok: s.length >= 100000, detail: 'len=' + s.length };
});
check('A3', 'front_root 해석 + 코드행 추출 가능', () => {
  if (!FRONT_ROOT) return { ok: false, detail: 'front_root=null' };
  const f = codeLines(readTarget(FJS));
  const h = readTarget('index.html').split(/\r?\n/);
  return { ok: f.length >= 100 && h.length >= 100, detail: 'root=' + FRONT_ROOT + ' fortune=' + f.length + '행 index=' + h.length + '행' };
});

/* ── B. 구(舊) 생성형 인용 규약 소멸 ── */
check('B1', '프롬프트에 "citation":{…} 스키마 요구 0행', () => {
  const h = linesWhere(codeLines(readTarget(FJS)), l => l.includes('"citation":{'));
  return { ok: h.length === 0, detail: h.length + '행' + (h.length ? ' @' + h.join('·') : '') };
});
check('B2', '프롬프트에 "original" 생성 요구 0행', () => {
  const h = linesWhere(codeLines(readTarget(FJS)), l => l.includes('"original"'));
  return { ok: h.length === 0, detail: h.length + '행' + (h.length ? ' @' + h.join('·') : '') };
});
check('B3', '프롬프트에 「한문 원문」 요구 0행 (금지 문언 제외)', () => {
  const h = linesWhere(codeLines(readTarget(FJS)), l => l.includes('한문 원문') && !PROHIBITION_TOKENS.some(t => l.includes(t)));
  return { ok: h.length === 0, detail: h.length + '행' + (h.length ? ' @' + h.join('·') : '') };
});
check('B4', '프롬프트에 "translation" 요구 0행', () => {
  const h = linesWhere(codeLines(readTarget(FJS)), l => l.includes('"translation"'));
  return { ok: h.length === 0, detail: h.length + '행' + (h.length ? ' @' + h.join('·') : '') };
});
check('B5', '원문 생성 금지 지시 존재', () => {
  const f = BAN_TOKENS.filter(t => readTarget(FJS).includes(t));
  return { ok: f.length >= 1, detail: 'tokens=' + (f.join(',') || 'NONE') };
});

/* ── C. 신(新) 서지 ID 규약 ── */
check('C1', 'citation_ref 인스턴스 ' + CITATION_REF_PIN + '건 이상', () => {
  const n = (readTarget(FJS).match(/citation_ref/g) || []).length;
  return { ok: n >= CITATION_REF_PIN, detail: n + '건 (pin ' + CITATION_REF_PIN + ')' };
});
check('C2', '허용 서지 ID 4종 전건 명시', () => {
  const s = readTarget(FJS);
  const miss = ALLOWED_IDS.filter(id => !s.includes(id));
  return { ok: miss.length === 0, detail: miss.length ? '누락 ' + miss.join(',') : ALLOWED_IDS.join(',') };
});
check('C3', '사용 불가 판본 2종이 허용 목록에 잠입하지 않음', () => {
  const m = readTarget(FJS).match(/const CITATION_RULE[\s\S]*?;\r?\n/);
  if (!m) return { ok: false, detail: 'CITATION_RULE 블록 미검출' };
  const bad = EXCLUDED_IDS.filter(id => m[0].includes(id));
  return { ok: bad.length === 0, detail: bad.length ? '잠입 ' + bad.join(',') : 'clean' };
});
check('C4', 'CITATION_RULE 정의 1건 + 부착 ' + CITATION_RULE_ATTACH_PIN + '곳', () => {
  const src = codeLines(readTarget(FJS)).join('\n');
  const def = (src.match(/const CITATION_RULE\s*=/g) || []).length;
  const att = (src.match(/\+\s*CITATION_RULE\s*\+\s*JSON_FORCE/g) || []).length;
  return { ok: def === 1 && att === CITATION_RULE_ATTACH_PIN, detail: 'def=' + def + ' attach=' + att };
});

/* ── D. 서버 1층 방어 ── */
// ★2026-07-29 P1: D1·D2·D3·E2 를 강화형 단독 요구로 재작성했다.
//   ① 종전 D1·D2 는 stripCitations(키 삭제)의 「생존」을 요구했는데, P1 이 그것을 상위 호환인
//      scrubDeep(키 삭제 + 값 스크럽)으로 대체하자 강화를 「소실」로 오판해 FAIL 했다.
//   ② 종전 D3 는 legacy(옛 단일 키 비교) 분기를 인정하고 있었다. v7.61 인수인계 §11 이 지적한
//      「코드를 옛 형태로 통째 되돌리면 citation_ref 미삭제인데도 통과」 구멍이 그것이다.
//   ⟹ legacy 분기를 전건 폐기하고 강화형만 인정한다. 되돌리면 FAIL 한다 — fail-closed 방향이다.
check('D1', 'scrubDeep·scrubText 정의 생존 (강화형 단독 요구)', () => {
  const src = codeLines(readTarget(FJS)).join('\n');
  const deep = /function\s+scrubDeep\s*\(/.test(src);
  const text = /function\s+scrubText\s*\(/.test(src);
  return { ok: deep && text, detail: 'scrubDeep=' + deep + ' scrubText=' + text };
});
check('D2', 'scrubDeep(parsed) 살아 있는 호출 생존 (주석 배제)', () => {
  const h = linesWhere(codeLines(readTarget(FJS)), l => /scrubDeep\s*\(\s*parsed\s*\)/.test(l));
  return { ok: h.length >= 1, detail: h.length + '건' + (h.length ? ' @' + h.join('·') : '') };
});
check('D3', 'citation 키 재귀 삭제 + 값 스크럽 결합 생존', () => {
  const src = codeLines(readTarget(FJS)).join('\n');
  const keyDelete = /CITATION_KEYS\s*\.includes\s*\(\s*k\s*\)/.test(src)
    && /CITATION_KEYS\s*=\s*\[[^\]]*'citation_ref'/.test(src)
    && /delete\s+node\[k\]/.test(src);
  // ★키 삭제만으로는 값에 실린 서지 ID 를 못 잡는다 (실측 반례: {note:'출전 SRC_ZPJZ_A'}).
  //   scrubDeep 이 문자열 값에도 scrubText 를 태우는지를 함께 요구한다.
  // ★2026-07-29 v7.63 R5(결정 49) — 종전에는 T1 정규식의 **소스 문자열** SRC_[A-Z0-9_]+ 를 요구했다.
  //   R4-3 이 그것을 확장(\b 제거 + i 플래그 + 구분자 확대)하자 강화를 「소실」로 오판해 FAIL 했다.
  //   ⟹ 특정 리터럴이 아니라 **성질**을 요구한다: 서지 ID 정규식이 존재하고 · SRC 접두를 잡고 ·
  //     전역+대소문자무시이며 · 어절 경계(\b)로 1SRC_ · aSRC_ 우회를 허용하지 않는다.
  //     강화는 통과하고 약화는 FAIL 한다 — fail-closed 방향이다.
  //   ★실행 기반 판정(난수 canary)은 eval/eval_response_scrub.js W3·G6 이 담당한다. 여기는 정적 성질만 본다.
  const t1 = src.match(new RegExp('SCRUB_SRC_ID_RE\\s*=\\s*(/[^/\\n]*(?:\\[[^\\]\\n]*\\][^/\\n]*)*/[a-z]*)'));
  const t1lit = t1 ? t1[1] : '';
  const t1flags = t1lit ? t1lit.slice(t1lit.lastIndexOf('/') + 1) : '';
  const t1ok = !!t1lit && t1lit.indexOf('SRC') !== -1 && t1flags.indexOf('g') !== -1 &&
    t1flags.indexOf('i') !== -1 && t1lit.indexOf('\\b') === -1;
  const valueScrub = /scrubText\s*\(\s*node\s*\)/.test(src) && t1ok;
  const ok = keyDelete && valueScrub;
  return { ok, detail: 'keyDelete=' + keyDelete + ' valueScrub=' + valueScrub + ' T1=' + JSON.stringify(t1lit) + ' flags=' + JSON.stringify(t1flags) };
});

/* ── E. 클라이언트 2층 방어 ── */
check('E1', 'raw 가드 index.html >=' + GUARD_PIN_INDEX + ' · tarot.js >=' + GUARD_PIN_TAROT, () => {
  const i = (readTarget('index.html').match(/result\.raw/g) || []).length;
  const t = (readTarget(path.join('js', 'tarot.js')).match(/result\.raw/g) || []).length;
  return { ok: i >= GUARD_PIN_INDEX && t >= GUARD_PIN_TAROT, detail: 'index=' + i + ' tarot=' + t };
});
// ★2026-07-29 P1: 종전 E2 는 raw 폴백이 「500자로 절단되는가」를 요구했다. 그러나 500자든 50자든
//   LLM 원문이 사용자에게 나가는 것 자체가 유출이다(v7.61 §11 최우선 지적). P1 은 raw 값을
//   '[PARSE_FAILED]' 센티넬로 대체해 노출을 0자로 만들었다 — 절단보다 강한 형태다.
//   ★센티넬은 truthy 여야 한다. 프런트 18곳의 가드가 if(d.result.raw && !d.result.<필드>) throw
//     형태로 truthy 판정에 의존하므로, '' · null · 키 삭제로 바꾸면 파싱 실패 UI 가 통째로 무력화된다.
check('E2', '서버 raw 폴백이 LLM 원문 0자 (센티넬 고정)', () => {
  const src = codeLines(readTarget(FJS)).join('\n');
  const sentinel = /raw\s*:\s*'\[PARSE_FAILED\]'/.test(src);
  const noTruncatedText = !/raw\s*:\s*text\s*\.\s*substring/.test(src);
  const ok = sentinel && noTruncatedText;
  return { ok, detail: 'sentinel=' + sentinel + ' noRawText=' + noTruncatedText };
});

/* ── F. 미등재 문헌 · 하드코딩 원문 ── */
check('F1', '미등재 문헌명이 citation_ref 스키마 행에 0건', () => {
  const h = linesWhere(codeLines(readTarget(FJS)), l => l.includes('citation_ref') && UNREGISTERED.some(t => l.includes(t)));
  return { ok: h.length === 0, detail: h.length + '행' };
});
check('F2', '미등재 문헌 원문 요구 0행', () => {
  const h = linesWhere(codeLines(readTarget(FJS)),
    l => UNREGISTERED.some(t => l.includes(t)) && (l.includes('원문') || l.includes('"original"')) && !PROHIBITION_TOKENS.some(t => l.includes(t)));
  return { ok: h.length === 0, detail: h.length + '행' };
});
check('F3', 'index.html 하드코딩 고전 원문 인용 <=' + HARDCODED_CITATION_PIN + '건', () => {
  const s = readTarget('index.html');
  const re = /citation:\{book:'([^']*)'[^}]*original:'([^']*)'/g;
  let n = 0; while (re.exec(s) !== null) n++;
  return { ok: n <= HARDCODED_CITATION_PIN, detail: n + '건 (pin <=' + HARDCODED_CITATION_PIN + ')' };
});
check('F4', 'index.html 하드코딩 원문 총 글자수 <=' + HARDCODED_ORIGINAL_CHARS_PIN, () => {
  const s = readTarget('index.html');
  const re = /citation:\{book:'([^']*)'[^}]*original:'([^']*)'/g;
  let c = 0, m; while ((m = re.exec(s)) !== null) c += m[2].replace(/\s/g, '').length;
  return { ok: c <= HARDCODED_ORIGINAL_CHARS_PIN, detail: c + '자 (pin <=' + HARDCODED_ORIGINAL_CHARS_PIN + ')' };
});
check('F5', '서지 표기는 ' + BIBLIO_ONLY_PIN + '건 유지 (콘텐츠 통삭 방지 하한)', () => {
  const n = (readTarget('index.html').match(/citation:\{book:/g) || []).length;
  return { ok: n >= BIBLIO_ONLY_PIN, detail: n + '건 (pin >=' + BIBLIO_ONLY_PIN + ')' };
});

/* ── G. ★결정 39 프런트 확장 — 원문 렌더 경로 · 배포 격리 ── */
check('G1', '인용 렌더러가 원문·번역을 출력하지 않는다', () => {
  const s = readTarget('index.html');
  const bad = [];
  if (/class="cite-orig"/.test(s)) bad.push('cite-orig 템플릿 잔존');
  if (/class="cite-tl"/.test(s)) bad.push('cite-tl 템플릿 잔존');
  const gates = (s.match(/if\(!c\|\|!c\.original\)return''/g) || []).length;
  if (gates) bad.push('c.original 게이트 ' + gates + '건');
  if (/\$\{esc\(c\.original\)\}/.test(s) || /\$\{c\.original\}/.test(s)) bad.push('원문 보간 잔존');
  return { ok: bad.length === 0, detail: bad.length ? bad.join(' / ') : '원문 렌더 경로 0건' };
});
check('G2', '인용 렌더러 ' + RENDERER_PIN + '곳 전부 서지(c.book) 게이트', () => {
  const n = (readTarget('index.html').match(/if\(!c\|\|!c\.book\)return''/g) || []).length;
  return { ok: n === RENDERER_PIN, detail: n + '곳 (pin ' + RENDERER_PIN + ')' };
});
check('G3', '★내용 기준 — 연속 고전 원문 ' + PIN_FLOOR + '자 이상 파일은 전부 배포 제외 규칙에 걸린다', () => {
  if (!FRONT_ROOT) return { ok: false, detail: 'front_root=null' };
  const vi = path.join(FRONT_ROOT, '.vercelignore');
  if (!fs.existsSync(vi)) return { ok: false, detail: '.vercelignore 부재 — 배포 제외 규칙 없음' };
  const { scanned, heavy, leaked } = SCAN();
  // ★공허 통과 차단 — 스캔이 0건이면 「미차단 0건」은 이상 없음이 아니라 「판정 못함」이다.
  if (scanned < SCAN_FILES_PIN)
    return { ok: false, detail: '스캔 ' + scanned + '파일 < 하한 pin ' + SCAN_FILES_PIN + ' — 공허 통과 차단(스캔 자체가 성립하지 않음)' };
  if (heavy < HEAVY_FILES_PIN)
    return { ok: false, detail: '임계초과 ' + heavy + '건 < 하한 pin ' + HEAVY_FILES_PIN + ' — 공허 통과 차단(적발 표본 소실)' };
  return {
    ok: leaked.length === 0,
    detail: '스캔 ' + scanned + '파일 · 임계초과 ' + heavy + '건 · 미차단 ' + leaked.length + '건' +
      (leaked.length ? ' → ' + leaked.slice(0, 5).join(', ') + (leaked.length > 5 ? ' 외 ' + (leaked.length - 5) + '건' : '') : '')
  };
});
check('G4', '배포 제외 규칙이 .vercelignore·.gitignore 양쪽에 등재돼 있다', () => {
  if (!FRONT_ROOT) return { ok: false, detail: 'front_root=null' };
  const need = ['ocr_index_jcs/', 'ocr_index_yhzp/', '_internal_only/', '영인본_직독_*/', '_work_v*/'];
  const out = [];
  for (const f of ['.vercelignore', '.gitignore']) {
    const p = path.join(FRONT_ROOT, f);
    if (!fs.existsSync(p)) { out.push(f + ' 부재'); continue; }
    const pats = parseIgnore(fs.readFileSync(p, 'utf8'));
    const miss = need.filter(n => !pats.includes(n));
    if (miss.length) out.push(f + ' 누락:' + miss.join(','));
  }
  return { ok: out.length === 0, detail: out.length ? out.join(' / ') : '양쪽 등재 완료' };
});

check('G5', 'index.html 에 NUL 바이트 0 (텍스트 감사 사각지대 차단)', () => {
  if (!FRONT_ROOT) return { ok: false, detail: 'front_root=null' };
  const b = fs.readFileSync(path.join(FRONT_ROOT, 'index.html'));
  let n = 0; for (let i = 0; i < b.length; i++) if (b[i] === 0) n++;
  // NUL 이 있으면 grep 등 텍스트 도구가 파일을 binary 로 판정해 조용히 건너뛴다.
  // 내용 기준 감사를 무력화하므로 0을 강제한다.
  return { ok: n === 0, detail: n + '바이트 (pin 0)' };
});

check('G6', 'doFetch ' + DOFETCH_PIN + '곳 전부 2층 raw 가드 보유 (G-E5)', () => {
  const L = readTarget('index.html').split(/\r?\n/);
  const defs = [];
  L.forEach((l, i) => { if (/const doFetch=async/.test(l)) defs.push(i); });
  const naked = [];
  defs.forEach((s, k) => {
    const e = k + 1 < defs.length ? defs[k + 1] : s + 40;
    const body = L.slice(s, Math.min(e, s + 25)).join('\n');
    if (!/result\.raw/.test(body)) naked.push('L' + (s + 1));
  });
  return {
    ok: defs.length === DOFETCH_PIN && naked.length === 0,
    detail: 'doFetch ' + defs.length + '곳 (pin ' + DOFETCH_PIN + ') · 가드없음 ' + naked.length + '곳' + (naked.length ? ' @' + naked.join('·') : '')
  };
});

/* ── SELF. ★공허 통과 차단 pin (결정 41 패치 C) ──
 *  「스캔 대상이 0건인데 이상 없음」이 이 게이트의 최악 실패 양상이다.
 *  스캔 규모·적발 규모·차단 실적을 각각 독립 검사로 세워, 어느 하나라도 무너지면
 *  G3 의 결론(미차단 0건)을 신뢰하지 않는다.                                     */
check('SELF1', '★스캔 텍스트 파일 수 하한 pin(' + SCAN_FILES_PIN + ') — 공허 스캔 차단', () => {
  const { scanned } = SCAN();
  return { ok: scanned >= SCAN_FILES_PIN, detail: '스캔 ' + scanned + '파일 (pin >=' + SCAN_FILES_PIN + ')' };
});
check('SELF2', '★임계초과(적발) 파일 수 하한 pin(' + HEAVY_FILES_PIN + ') — 적발 표본 소실 차단', () => {
  const { heavy } = SCAN();
  return { ok: heavy >= HEAVY_FILES_PIN, detail: '임계초과 ' + heavy + '건 (pin >=' + HEAVY_FILES_PIN + ')' };
});
check('SELF3', '★배포 제외 규칙에 실제로 걸린 파일 수 하한 pin(' + BLOCKED_PIN + ') — 매처 무력화 차단', () => {
  const { blocked, heavy } = SCAN();
  return { ok: blocked >= BLOCKED_PIN, detail: '차단 ' + blocked + '/' + heavy + '건 (pin >=' + BLOCKED_PIN + ')' };
});
check('SELF4', '★.vercelignore 유효 패턴 수 하한 pin(' + IGNORE_PAT_PIN + ') — 규칙 통삭 차단', () => {
  const { pats } = SCAN();
  return { ok: pats.length >= IGNORE_PAT_PIN, detail: pats.length + '패턴 (pin >=' + IGNORE_PAT_PIN + ')' };
});

// ──────────────────────────────────────────────────────────────
// 5. 실행 — 예외는 프로세스 중단이 아니라 FAIL 계상
// ──────────────────────────────────────────────────────────────
const EXPECTED_TOTAL = 32;   // 본검사 28 + SELF 공허통과 차단 pin 4
let pass = 0, fail = 0;
const failLines = [];

for (const c of checks) {
  let r;
  try {
    r = c.fn();
    if (!r || typeof r.ok !== 'boolean') r = { ok: false, detail: 'EXCEPTION(fail-closed): 검사가 {ok:boolean}을 반환하지 않음' };
  } catch (e) {
    r = { ok: false, detail: 'EXCEPTION(fail-closed): ' + (e && e.message ? e.message : String(e)) };
  }
  if (r.ok) pass++;
  else { fail++; failLines.push('  FAIL ' + c.id + '  ' + c.desc + '  -> ' + r.detail); }
}
if (checks.length !== EXPECTED_TOTAL) {
  fail++;
  failLines.push('  FAIL SELF  등록 검사 수 불일치 -> ' + checks.length + ' != ' + EXPECTED_TOTAL);
}
// ★등록 검사 수 하한 pin(게이트 침식 차단) — 위 등호 검사와 이중으로 건다.
if (!pinChecks(checks, EXPECTED_TOTAL, (id, detail) => { fail++; failLines.push('  FAIL ' + id + '  -> ' + detail); })) { /* 계상 완료 */ }

if (failLines.length) {
  console.log('[prompt_citation_guard] 실패 내역');
  failLines.forEach(l => console.log(l));
}
console.log('[prompt_citation_guard] total=' + checks.length + ' pass=' + pass + ' fail=' + fail);
process.exit(fail === 0 ? 0 : 1);
