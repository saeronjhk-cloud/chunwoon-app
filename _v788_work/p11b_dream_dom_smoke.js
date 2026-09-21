#!/usr/bin/env node
/* v788 P-786-B · DOM 실구동 스모크 — jsdom 으로 index.html 을 띄우고 fetch 를 실패시킨 뒤
   analyzeDream() 이 엔진 블록을 그리는지 본다(LLM 폴백 경로). 성공 경로는 fetch 스텁으로 JSON 을 준다.
   실행: node _v788_work/p11b_dream_dom_smoke.js  (jsdom 은 리포 node_modules) · ~60s */
'use strict';
const fs = require('fs'); const path = require('path');
const { JSDOM } = require('jsdom');
const ROOT = path.join(__dirname, '..');
let HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
// 외부 스크립트(js/*.js)는 jsdom 이 안 받는다 — 필요한 것만 인라인한다
HTML = HTML.replace('<script src="js/dream_engine.js"></script>', '<script>' + fs.readFileSync(path.join(ROOT, 'js', 'dream_engine.js'), 'utf8') + '</script>');
function boot(fetchImpl) {
  const dom = new JSDOM(HTML, { runScripts: 'dangerously', url: 'https://chunwoon.test/', pretendToBeVisual: true });
  const w = dom.window; w.fetch = fetchImpl; w.alert = () => {}; w.confirm = () => false; w.scrollTo = () => {};
  if (!w.Element.prototype.scrollIntoView) w.Element.prototype.scrollIntoView = function () {};
  return w;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let total = 0, pass = 0;
function ck(id, ok, detail) { total++; if (ok) pass++; console.log((ok ? '  ✓ ' : '  ✗ ') + id + (detail ? '  [' + detail + ']' : '')); }
(async () => {
  // ① 폴백 경로
  {
    const W = boot(() => Promise.reject(new Error('NETWORK_BLOCKED')));
    await sleep(300);
    const D = W.document;
    D.getElementById('dreamStory').value = '큰 돼지가 집으로 들어와 품에 안겼다';
    D.getElementById('dreamLinkSaju').checked = false;
    await W.analyzeDream(); await sleep(300);
    const html = D.getElementById('dreamResult').innerHTML;
    ck('F-1 폴백에 엔진 블록', html.includes('전통 해몽 사전 풀이') && html.includes('돼지'), '');
    ck('F-2 폴백 표기', html.includes('AI 없이 사전 대조'));
    ck('F-3 오류 안내도 유지', html.includes('AI 풀이를 불러오지 못했습니다'));
    ck('F-4 engineHits 운반', Array.isArray(W._dreamResultData.engineHits) && W._dreamResultData.engineHits[0].k === '돼지');
    D.getElementById('dreamStory').value = '회사에서 회의를 했다';
    await W.analyzeDream(); await sleep(300);
    const h2 = D.getElementById('dreamResult').innerHTML;
    ck('F-5 히트 0 → 엔진 블록 없음', !h2.includes('전통 해몽 사전 풀이'));
  }
  // ② 성공 경로
  {
    const W = boot(() => Promise.resolve({ json: async () => ({ success: true, result: { summary: 'S', traditionalReading: 'T', jungianReading: 'J', fortuneType: '길몽', fortuneScore: 80, keySymbols: [{ symbol: '뱀', meaning: 'm' }], luckyNumbers: [1, 2, 3, 4], luckyColor: '금', emotionalState: 'E', advice: 'A' } }) }));
    await sleep(300);
    const D = W.document;
    D.getElementById('dreamStory').value = '검은 구렁이가 다리를 감았다';
    D.getElementById('dreamLinkSaju').checked = false;
    await W.analyzeDream(); await sleep(300);
    const html = D.getElementById('dreamResult').innerHTML;
    ck('S-1 성공 경로에도 엔진 블록', html.includes('전통 해몽 사전 풀이') && html.includes('🐍'));
    ck('S-2 LLM 풀이 그대로', html.includes('📜 한국 전통 해석') && html.includes('융 심리학'));
    ck('S-3 폴백 표기 없음', !html.includes('AI 없이 사전 대조'));
  }
  console.log('[p11b_dream_dom_smoke] total=' + total + ' pass=' + pass + ' fail=' + (total - pass));
  process.exit(total === pass ? 0 : 1);
})().catch((e) => { console.log('THREW', e && e.stack); process.exit(1); });
