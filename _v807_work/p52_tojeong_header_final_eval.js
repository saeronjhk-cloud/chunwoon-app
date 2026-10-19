// ============================================================
//  _v807_work/p52_tojeong_header_final_eval.js — F3② 최종 괘 머리 표(AI 확정 + 제이 직접 판독) 검사
//  입력(IP): ../ChunWoon_IP/tojeong/read_f3/{adjudicated,human_check,headers_final}.json
//  ★기대값은 구조 상수(곱집합 순서 · 삼효괘 글자 집합)와 판독 파일만으로 만든다.
// ============================================================
'use strict';
const fs = require('fs'), path = require('path');
const RD = path.join(__dirname, '..', '..', 'ChunWoon_IP', 'tojeong', 'read_f3');
const J = (f) => { try { return JSON.parse(fs.readFileSync(path.join(RD, f), 'utf8')); } catch (e) { return null; } };
const res = []; const ok = (id, c, m) => res.push({ id, pass: !!c, msg: m });
const ADJ = J('adjudicated.json'), HUM = J('human_check.json'), FIN = J('headers_final.json');
const PAGES = Array.from({ length: 144 }, (_, i) => 'p' + String(i + 5).padStart(3, '0'));
const F = ['num', 'tri3', 'gua'];
const prod = []; for (let u = 1; u <= 8; u++) for (let m = 1; m <= 6; m++) for (let l = 1; l <= 3; l++) prod.push('' + u + m + l);
const P = FIN && FIN.pages;

ok('H1', P && PAGES.every(p => P[p] && F.every(f => P[p][f] && P[p][f].value && ['AI_VERIFIED', 'HUMAN'].includes(P[p][f].source))), '144쪽 × 3필드 모두 값 · 출처 ∈ {AI_VERIFIED, HUMAN}');
(() => { // 출처 정직성: AI_VERIFIED 는 adjudicated VERIFIED 값과 같고, HUMAN 은 human_check 답과 같으며 그 칸은 AI 미확정
  let bad = 0;
  for (const p of PAGES) for (const f of F) { const x = P && P[p] && P[p][f]; if (!x) { bad++; continue; }
    const a = ADJ.pages[p][f], h = HUM.answers[p] && HUM.answers[p][f];
    if (x.source === 'AI_VERIFIED' && !(a.status === 'VERIFIED' && a.value === x.value)) bad++;
    if (x.source === 'HUMAN' && !(a.status !== 'VERIFIED' && h === x.value)) bad++; }
  ok('H2', bad === 0, '출처 표기 = 실제 원천 (불일치 ' + bad + ')');
})();
ok('H3', P && JSON.stringify(PAGES.map(p => P[p].num.value)) === JSON.stringify(prod), 'num 144 = 곱집합(111→863) 쪽 순서 그대로 → D4(0→8·6·3) 원문 전수 재확인');
(() => {
  const UP = '天澤火雷風水山地';
  let bad = [];
  for (let i = 0; i < 144; i++) { const p = PAGES[i], n = prod[i], t = P && P[p].tri3.value; if (!t || t.length !== 3) { bad.push(p); continue; }
    const e0 = UP[+n[0] - 1], e1 = UP[+n[1] - 1];
    if (t[1] !== e1) bad.push(p + ':mid');
    if (t[0] !== e0 && !(P[p].note || HUM.notes[p])) bad.push(p + ':up(' + t[0] + ')'); }
  ok('H4', bad.length === 0, '삼효괘 첫 글자 = 상 숫자 · 둘째 = 중 숫자 (예외 ' + bad.join(',') + ' · 활자 이체는 note 가 붙은 쪽만 허용)');
})();
(() => { const L = new Set('天澤火雷風水山地'.split('')); const bad = PAGES.filter(p => P && !L.has(P[p].tri3.value[2]));
  ok('H5', bad.length === 0, '하괘(셋째 글자) 144 모두 8괘 글자 (' + bad.join(',') + ')'); })();
ok('H6', HUM && HUM.reader && /제이/.test(HUM.reader) && Object.keys(HUM.answers).length >= 1, 'human_check = 제이 직접 판독 기록');
for (const r of res) console.log((r.pass ? '  ok   ' : '  FAIL ') + r.id + ' ' + r.msg);
const pass = res.filter(r => r.pass).length; console.log('p52 ' + pass + '/' + res.length); process.exitCode = pass === res.length ? 0 : 1;
