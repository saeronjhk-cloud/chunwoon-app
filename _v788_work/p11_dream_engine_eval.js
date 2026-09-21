#!/usr/bin/env node
/* 천운 v788 · P-786-B 꿈 모티브 엔진 평가 (Eval-First · 20케이스)
   ---------------------------------------------------------------------------
   무엇을 못박는가
     ① index.html 의 DREAM_KEYS 12항목이 그대로 엔진에 들어가고(표 유출·복사본 없음)
     ② 12모티브 각각이 자연스러운 줄거리에서 잡히고(재현율)
     ③ 부분 문자열 오탐 8종(사용·동물·불안·계산·죽을 먹·불꽃·부산·선물)이 **안 잡히며**(정밀도)
     ④ 히트 0 이면 엔진이 침묵(빈 배열 · 지어내지 않음)
     ⑤ index.html 이 엔진을 실제로 **부른다**(선언만 하고 참조 0건 회귀 차단 — v786 §3 전례)
   실행:  node _v788_work/p11_dream_engine_eval.js        → total=N pass=N fail=0
   ★표(PATTERNS)를 고치면 이 파일을 다시 돌린다. 「느낌으로 더 좋다」 금지. */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const ENG = require(path.join(ROOT, 'js', 'dream_engine.js'));
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// DREAM_KEYS 를 index.html 에서 **그대로** 뽑는다 — 사본 금지.
const m = INDEX.match(/const DREAM_KEYS=\[([\s\S]*?)\n\];/);
if (!m) { console.log('[p11_dream_engine] ★DREAM_KEYS 를 index.html 에서 못 찾았다'); console.log('[p11_dream_engine] total=1 pass=0 fail=1'); process.exit(1); }
const DREAM_KEYS = new Function('return [' + m[1] + '\n];')();

let total = 0, pass = 0;
const fails = [];
function check(id, name, fn) {
  total++;
  let r;
  try { r = fn(); } catch (e) { r = { ok: false, detail: 'THREW ' + (e && e.message) }; }
  if (r.ok) pass++; else fails.push(id + ' ' + name + ' — ' + (r.detail || ''));
  console.log((r.ok ? '  ✓ ' : '  ✗ ') + id + ' ' + name + (r.detail ? '  [' + r.detail + ']' : ''));
}
const keysOf = (story) => ENG.matchDreamKeys(story, DREAM_KEYS).map((h) => h.k);
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── A. 표 결속 ───────────────────────────────────────────────────────────────
check('A-1', 'DREAM_KEYS 12항목 · 각 항목에 k/msg/num 이 있다', () => {
  const ok = DREAM_KEYS.length === 12 && DREAM_KEYS.every((d) => d.k && d.msg && Array.isArray(d.num) && d.num.length === 4);
  return { ok, detail: 'n=' + DREAM_KEYS.length };
});
check('A-2', 'PATTERNS 의 키가 DREAM_KEYS 의 k 와 1:1 (바이트 동일)', () => {
  const pk = ENG.PATTERNS.map((p) => p.k).sort(), dk = DREAM_KEYS.map((d) => d.k).sort();
  return { ok: eq(pk, dk), detail: eq(pk, dk) ? '12/12' : 'pat=' + pk.join(',') + ' keys=' + dk.join(',') };
});

// ── B. 재현율 — 12모티브 각각 ───────────────────────────────────────────────
const POS = [
  ['B-1', '돼지', '큰 돼지가 집 안으로 들어와서 품에 안겼어요'],
  ['B-2', '뱀', '검은 구렁이가 다리를 감고 놓아주지 않았다'],
  ['B-3', '용', '하늘에서 용이 내려와 나를 태우고 승천했다'],
  ['B-4', '물', '맑은 물이 발목까지 차오르는데 기분이 좋았어요'],
  ['B-5', '불', '집에 불이 나서 활활 타는데 아무도 안 다쳤다'],
  ['B-6', '하늘/비행', '팔을 벌리니 몸이 떠서 하늘을 날았다'],
  ['B-7', '시험', '시험장에 갔는데 연필이 없어서 당황했다'],
  ['B-8', '이(치아)', '앞니가 우수수 빠져서 손에 쥐고 울었다'],
  ['B-9', '죽음', '돌아가신 할머니 장례식에 다시 가는 꿈'],
  ['B-10', '꽃', '온 들판에 벚꽃이 흐드러지게 피어 있었다'],
  ['B-11', '산', '높은 산을 올라 정상에서 해가 뜨는 걸 봤다'],
  ['B-12', '바다', '잔잔한 바다 위에 배를 타고 있었어요']
];
POS.forEach(([id, k, story]) => check(id, '재현 「' + k + '」', () => {
  const got = keysOf(story); return { ok: got.indexOf(k) !== -1, detail: got.join(',') || '(없음)' };
}));

// ── C. 정밀도 — 부분 문자열 오탐 ────────────────────────────────────────────
const NEG = [
  ['C-1', '용', '휴대폰을 사용하다가 잠들었는데 내용이 기억 안 나요'],
  ['C-2', '물', '동물원에서 선물을 받았고 건물이 무너졌다'],
  ['C-3', '불', '불안한 마음으로 불행한 소식을 들었다'],
  ['C-4', '산', '계산기를 두드리며 부산에서 산책했다'],
  ['C-5', '죽음', '아침에 팥죽을 먹었는데 죽을 끓이는 냄새가 났다'],
  ['C-6', '꽃', '불꽃놀이를 보다가 잠에서 깼다']
];
NEG.forEach(([id, k, story]) => check(id, '오탐 없음 「' + k + '」', () => {
  const got = keysOf(story); return { ok: got.indexOf(k) === -1, detail: got.join(',') || '(없음)' };
}));
check('C-7', '「불꽃놀이」는 불로만 잡힌다 (꽃 아님)', () => { const got = keysOf('불꽃놀이를 봤다'); return { ok: eq(got, ['불']), detail: got.join(',') }; });

// ── D. 침묵 · 복합 · 요약 ──────────────────────────────────────────────────
check('D-1', '히트 0 → 빈 배열 (지어내지 않는다)', () => { const got = keysOf('회사에서 회의를 했다'); return { ok: got.length === 0, detail: got.join(',') || '[]' }; });
check('D-2', '빈 줄거리 → 빈 배열', () => ({ ok: keysOf('').length === 0 && keysOf(null).length === 0 }));
check('D-3', '복합 — 뱀과 물이 같이 있으면 둘 다 · 중복 없음', () => {
  const got = keysOf('강물 속에서 뱀이 헤엄치고 또 다른 뱀도 있었다');
  return { ok: eq(got, ['뱀', '물']), detail: got.join(',') };
});
check('D-4', 'summarize — 길몽만이면 길몽 · 숫자 4개 · 중복 제거', () => {
  const s = ENG.summarize(ENG.matchDreamKeys('돼지와 용이 나왔다', DREAM_KEYS));
  return { ok: s.fortuneType === '길몽' && s.numbers.length === 4 && new Set(s.numbers).size === 4, detail: s.fortuneType + ' ' + s.numbers.join(',') };
});
check('D-5', 'summarize — 흉몽(이빨)만이면 흉몽 · 섞이면 평몽', () => {
  const a = ENG.summarize(ENG.matchDreamKeys('이빨이 빠졌다', DREAM_KEYS)).fortuneType;
  const b = ENG.summarize(ENG.matchDreamKeys('이빨이 빠지고 돼지가 왔다', DREAM_KEYS)).fortuneType;
  return { ok: a === '흉몽' && b === '평몽', detail: a + '/' + b };
});

// ── E. 결속 — index.html 이 실제로 부른다 ──────────────────────────────────
check('E-1', 'index.html 이 js/dream_engine.js 를 싣고 CW_DREAM_ENGINE.matchDreamKeys 를 호출한다', () => {
  const loaded = /<script src="js\/dream_engine\.js"><\/script>/.test(INDEX);
  const calls = (INDEX.match(/CW_DREAM_ENGINE\.matchDreamKeys\(/g) || []).length;
  return { ok: loaded && calls >= 1, detail: 'script=' + loaded + ' calls=' + calls };
});
check('E-2', 'DREAM_KEYS 참조가 선언 외 1건 이상 (참조 0건 회귀 차단)', () => {
  // 주석 줄과 선언 줄은 세지 않는다 — 「참조 0건」은 코드 참조를 뜻한다.
  const refs = INDEX.split('\n').filter((l) => /\bDREAM_KEYS\b/.test(l) && !/^\s*\/\//.test(l) && !/const DREAM_KEYS=/.test(l)).length;
  return { ok: refs >= 1, detail: 'code refs=' + refs };
});
check('E-3', '엔진 히트가 화면에 실린다 — renderDreamResult · renderDreamFallback 둘 다 _cwDreamEngineBlock 을 부른다', () => {
  const fnStart = (name) => INDEX.indexOf('function ' + name + '(');
  const seg = (name, len) => INDEX.slice(fnStart(name), fnStart(name) + len);
  const a = /_cwDreamEngineBlock\(/.test(seg('renderDreamResult', 6000));
  const b = /_cwDreamEngineBlock\(/.test(seg('renderDreamFallback', 3000));
  return { ok: a && b, detail: 'result=' + a + ' fallback=' + b };
});

console.log('[p11_dream_engine] total=' + total + ' pass=' + pass + ' fail=' + (total - pass));
if (fails.length) { console.log('  FAILS:'); fails.forEach((f) => console.log('   - ' + f)); process.exit(1); }
