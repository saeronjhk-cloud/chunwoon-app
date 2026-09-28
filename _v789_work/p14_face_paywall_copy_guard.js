// ============================================================
//  P-14 · 관상 결제 유도(paywall) 문구 가드 — v790 (제이 지시 2026-09-28)
//  node _v789_work/p14_face_paywall_copy_guard.js
//  배경: 무료 결과 화면에 「⚠️ AI가 당신의 얼굴에서 치명적인 특징을 발견했습니다」 · 계측값이 없어도
//        나가는 「40대 중반에 큰 금전적 위기」 · 「절대로 동업하면 안 되는 상극의 관상」 등 근거 없는
//        공포 문구가 있었다. 엔진은 흉사·가족가해 문언을 BLOCKED 하는데 화면이 그보다 강하게 말했다.
//  규칙: _showFacePaywall 본문에 금지 표현 0건 · 계측값 없을 때 특정 시기·재난 예언 0건 · 새 제목 존재.
// ============================================================
'use strict';
const fs = require('fs'), path = require('path');
const s = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const a = s.indexOf('function _showFacePaywall('); const m = /\n(?:async )?function /g; m.lastIndex = a + 10; const mm = m.exec(s), b = mm ? mm.index : -1;
const body = a >= 0 ? s.slice(a, b) : '';
let total = 0, pass = 0; const fails = [];
const ck = (id, name, ok, d) => { total++; if (ok) pass++; else fails.push(id); console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${id} ${name}${d ? ' — ' + d : ''}`); };
ck('W0', '_showFacePaywall 존재', body.length > 500, body.length + 'B');
const BANNED = ['치명적', '위기가 올', '금전적 위기', '절대로 동업', '손실의 위험', '새어나가', '약화'];  // 결제 버튼 「운명의 비밀 풀기」는 홍보 표현(공포 아님)이라 대상 밖
const hit = BANNED.filter(w => body.includes(w));
ck('W1', '금지 표현 0건(' + BANNED.join('·') + ')', hit.length === 0, hit.join(',') || '없음');
const def = (body.match(/let warningDetail='([^']*)'/) || [])[1] || '';
ck('W2', '계측값 없을 때 기본 문구에 연령·시기 예언 없음', def && !/\d+\s*대|세\b|년|위기|손실/.test(def), def);
ck('W3', '제목이 사실 서술형으로 바뀜', body.includes('AI가 더 자세히 살펴볼 부위를 찾았습니다') && !body.includes('⚠️ AI가'), '');
ck('W4', '경고색(#e85a4f) 제목·테두리 제거', !/border:1px solid rgba\(232,90,79/.test(body) && !/color:#e85a4f;font-weight:700;margin-bottom:8px/.test(body), '');
console.log(`[p14_face_paywall_copy] total=${total} pass=${pass} fail=${total - pass}${fails.length ? ' · FAIL ' + fails.join(',') : ''}`);
process.exitCode = fails.length ? 1 : 0;
