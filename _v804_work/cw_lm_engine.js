#!/usr/bin/env node
// ============================================================
//  v804 ①-A — 평가 캐시 랜드마크 엔진 스위치 (평가 스크립트 45개를 고치지 않고 활성 캐시만 교체)
//  node _v804_work/cw_lm_engine.js --status
//  node _v804_work/cw_lm_engine.js --init      (최초 1회: landmarks_py.json 보존 + landmarks_js.json 생성)
//  node _v804_work/cw_lm_engine.js --set js|py (활성 landmarks.json 교체 · ENGINE.json 기록)
//
//  정본(★원칙 15·35): js = 앱과 같은 엔진(@mediapipe/face_mesh 0.4 JS · refine 끔 · 정지 이미지) — parity/js_ref0.json
//  보존: py = mediapipe 0.10.14 python static · refine 끔 (v803까지의 평가 캐시)
//  대상: eval_labelset/cache · eval_selfie/cache · eval_hairline/cache · eval_selfie/gray/hl_landmarks.json(인터넷 23장 복제본)
//  ★활성 파일의 키 구조는 건드리지 않는다(평가가 Object.keys로 순회 → 표지는 별도 ENGINE.json).
//  ★라벨셋 부가 필드(pid·kind·f35·distCm·faceW_orig)와 셀카 orig_lm_frac.json 은 원본 프레임 기준 파이썬 값 그대로(js_ref0 는 크롭 사진에서 잼).
//  ★D: 연결 폴더는 삭제 불가 → rename 없이 writeFileSync 로만 쓴다.
// ============================================================
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const IP = path.join(__dirname, '..', '..', 'ChunWoon_IP', 'face');
const SETS = [
  { name: 'labelset', file: path.join(IP, 'eval_labelset', 'cache', 'landmarks.json') },
  { name: 'selfie', file: path.join(IP, 'eval_selfie', 'cache', 'landmarks.json') },
  { name: 'hairline', file: path.join(IP, 'eval_hairline', 'cache', 'landmarks.json') },
  { name: 'hl_gray', file: path.join(IP, 'eval_selfie', 'gray', 'hl_landmarks.json'), mirrorOf: 'hairline' },
];
const JS_SRC = path.join(IP, 'parity', 'js_ref0.json');
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 16);
const alt = (f, e) => f.replace(/\.json$/, '_' + e + '.json');
const engFile = f => path.join(path.dirname(f), 'ENGINE.json');
const readEng = f => { try { return JSON.parse(fs.readFileSync(engFile(f), 'utf8')); } catch (e) { return {}; } };

function status() {
  for (const s of SETS) {
    const a = sha(s.file), p = fs.existsSync(alt(s.file, 'py')) ? sha(alt(s.file, 'py')) : '-', j = fs.existsSync(alt(s.file, 'js')) ? sha(alt(s.file, 'js')) : '-';
    const act = a === j ? 'js' : a === p ? 'py' : '??';
    console.log(`${s.name.padEnd(9)} active=${act} active_sha=${a} py=${p} js=${j} · ENGINE.json=${JSON.stringify(readEng(s.file)[path.basename(s.file)] || null)}`);
  }
}
function init() {
  const JS = JSON.parse(fs.readFileSync(JS_SRC, 'utf8'));
  for (const s of SETS) {
    const pyF = alt(s.file, 'py'), jsF = alt(s.file, 'js');
    if (!fs.existsSync(pyF)) { fs.writeFileSync(pyF, fs.readFileSync(s.file)); console.log('보존', path.relative(IP, pyF)); }
    else if (sha(pyF) !== sha(s.file) && readEng(s.file)[path.basename(s.file)] !== 'js') throw new Error('py 보존본과 활성본이 다른데 활성 표지가 js 가 아님: ' + s.file);
    const PY = JSON.parse(fs.readFileSync(pyF, 'utf8')), out = {};
    for (const k of Object.keys(PY)) {
      const j = JS[k]; if (!j) throw new Error('js_ref0 에 없음: ' + k);
      if (j.w !== PY[k].w || j.h !== PY[k].h || !Array.isArray(j.lm) || j.lm.length < 468) throw new Error('w·h·lm 불일치: ' + k);
      out[k] = Object.assign({}, PY[k], { lm: j.lm.slice(0, 468) }); // 부가 필드 보존 · 키 순서 보존
    }
    fs.writeFileSync(jsF, JSON.stringify(out));
    console.log('생성', path.relative(IP, jsF), Object.keys(out).length, '장', sha(jsF));
  }
}
function set(e) {
  if (e !== 'js' && e !== 'py') throw new Error('--set js|py');
  for (const s of SETS) {
    const src = alt(s.file, e); if (!fs.existsSync(src)) throw new Error('없음(먼저 --init): ' + src);
    fs.writeFileSync(s.file, fs.readFileSync(src));
    const ef = engFile(s.file), E = readEng(s.file); E[path.basename(s.file)] = e; E.updated = new Date().toISOString();
    E._desc = 'cw_lm_engine.js 표지 — js = 앱 엔진(face_mesh 0.4 JS · refine 끔 · still) 정본 · py = mediapipe 0.10.14 python(v803까지)';
    fs.writeFileSync(ef, JSON.stringify(E, null, 1));
  }
  status();
}
const a = process.argv[2];
if (a === '--status') status(); else if (a === '--init') { init(); status(); } else if (a === '--set') set(process.argv[3]);
else { console.log('사용: --status | --init | --set js|py'); process.exit(2); }
