// P-808-F3c §8 사후 개정 2 — 제이 회신 형식 정규화 (판정 규칙 불변 · 후보 대조 전에 고정)
// 사용: node f3c_normalize_reply.js <IP human 폴더>
'use strict';
const fs = require('fs'), path = require('path');
const HD = process.argv[2];
const items = JSON.parse(fs.readFileSync(path.join(HD, 'F3c_items.json'), 'utf8'));
const raw = fs.readFileSync(path.join(HD, 'F3c_답_제이_원본.txt'), 'utf8').split(/\r?\n/).filter(l => /^\d{3}\s/.test(l));
const G = (s) => [...new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(s)].length;
// N0 「ㅅ+초성」 표기 → 합용병서 초성: ㅅㄱ=ᄭ(U+112D) ㅅㄷ=ᄯ(U+112F) ㅅㅂ=ᄲ(U+1132) ㅅㅈ=ᄶ(U+1136). 다른 초성 앞 ㅅ 은 바꾸지 않고 보고.
const SC = { 0: 'ᄭ', 3: 'ᄯ', 7: 'ᄲ', 12: 'ᄶ' };
const JUNG = 0x1161, JONG = 0x11A7;
let unconv = 0;
function conv(s) {
  const a = [...s.normalize('NFC').replace(/\s+/g, '')]; let o = '';
  for (let i = 0; i < a.length; i++) {
    if (a[i] === 'ㅅ' && i + 1 < a.length) { const x = a[i + 1].charCodeAt(0) - 0xAC00;
      if (x >= 0 && x < 11172 && SC[Math.floor(x / 588)] !== undefined) { const v = Math.floor((x % 588) / 28), t = x % 28;
        o += SC[Math.floor(x / 588)] + String.fromCharCode(JUNG + v) + (t ? String.fromCharCode(JONG + t) : ''); i++; continue; }
      unconv++; }
    o += a[i]; }
  return o;
}
const out = [], rep = { N1: [], N2: [], N3: [], N4: [], N5full: [], N5part: [], partial: [], rereq: [] };
const minLen = (it) => Math.min(...it.cands.map(G));
for (const l of raw) {
  const no = +l.slice(0, 3), r = l.slice(4).trim(), it = items[no - 1]; let a;
  let m;
  if ((m = r.match(/^([123])(\s.*)?$/))) { a = m[1]; rep[m[2] ? 'N2' : 'N1'].push(no); }          // N1 숫자 · N2 숫자+현대어 풀이(풀이는 기록만)
  else if (/^모르겠음/.test(r)) { a = '?'; rep.N3.push(no); }                                     // N3 모르겠음(괄호 추정 포함) → ?
  else if ((m = r.match(/^없음\s*\(([^)]*)\)/))) { const v = conv(m[1]);                          // N4 없음 (값) → =값(괄호 안만 · 뒤 현대어 풀이 무시)
    if (v && G(v) >= 0.5 * minLen(it)) { a = '=' + v; rep.N4.push(no); } else { a = '?'; rep.partial.push(no); rep.rereq.push(no); } }
  else if (/^없음/.test(r)) { a = '?'; rep.rereq.push(no); }
  else { const v = conv(r);                                                                     // N5 값만 → 후보 최단 길이의 절반 이상이면 =값, 아니면 부분값 → 재요청
    if (G(v) >= 0.5 * minLen(it)) { a = '=' + v; rep.N5full.push(no); } else { a = '?'; rep.N5part.push(no); rep.rereq.push(no); } }
  out.push({ no, a, raw: l });
}
fs.writeFileSync(path.join(HD, 'F3c_답_제이.txt'), '# P-808-F3c 제이 회신(정규화 · 사후 개정 2) — 원본 F3c_답_제이_원본.txt\n' + out.map(x => ('00' + x.no).slice(-3) + ' ' + x.a).join('\n') + '\n');
fs.writeFileSync(path.join(HD, 'F3c_norm_report.json'), JSON.stringify({ rule: 'P-808-F3c §8', unconverted_s: unconv, ...Object.fromEntries(Object.entries(rep).map(([k, v]) => [k, { n: v.length, no: v }])) }, null, 1));
console.log('lines', out.length, Object.entries(rep).map(([k, v]) => k + ' ' + v.length).join(' · '), '· ㅅ 미변환', unconv, '· 재요청', rep.rereq.join(','));
