// ============================================================
//  P-39 · 정지 이미지 검출의 추적 상태 오염 제거 — P-803-B(실기 10-13 「같은 사람 점수가 매번 달라」)
//  node _v802_work/p39_facemesh_still_eval.js      (브라우저 실측은 _v802_work/fmrepro/p39b_browser.js — 클라우드 크로미움)
// ------------------------------------------------------------
//  원인(재현 _v802_work/fmrepro/out_r1.json): 구형 @mediapipe/face_mesh JS 솔루션은 정지 이미지 모드가 없고 직전 프레임의
//   얼굴 위치로 다음 이미지를 추적한다 → 같은 사진을 다시 넣어도 랜드마크 최대 4px(다른 사진 뒤에는 10px) 차 ·
//   종합 92~93 · 눈 77~84 · 코 88~91 · 입 판정 small/thick/big 뒤바뀜 · 직전 얼굴 때문에 얼굴을 못 찾는 사진(h03)까지.
//  수리: 측정용 검출 전에 빈 프레임을 보내 추적을 끊는다(reset() 과 결과 동일 0.00px · 2.2초 → 0.37초) + 검출 직렬화(결과 뒤섞임 방지).
//  기준(수리 전에 정함):
//   B1 「P-803-B 시작/끝」 표지 사이에 직렬화 큐 · detectFaceAI(imageElement,opt) · opt.still 이면 빈 프레임 먼저 · 시간 초과 안전장치
//   B2 측정용 호출 4곳(업로드·자동 촬영·수동 촬영·다중 프레임 수집)이 {still:true} · 라이브 정렬 검출(detectFaceInFrame)은 추적 유지
//   B3 브라우저 실측 p39b 로그가 현재 표지 블록 sha 와 같고 total 통과(같은 사진 반복 0px · 다른 사진 뒤 0px · h03 검출 · 동시 호출 미혼선)
//   B4 index.html 인라인 스크립트 문법
// ============================================================
'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),os=require('os'),crypto=require('crypto');
const ROOT=path.join(__dirname,'..');const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const res=[];const T=(id,ok,msg)=>{res.push({id,ok});console.log(`${ok?'PASS':'FAIL'} ${id} — ${msg}`);};
const i0=html.indexOf('// ★P-803-B 시작'),i1=html.indexOf('// ★P-803-B 끝');const blk=i0>0&&i1>i0?html.slice(i0,i1):'';
T('B1',blk&&/let _cwFaceMeshQ=Promise\.resolve\(\)/.test(blk)&&/function detectFaceAI\(imageElement,opt\)/.test(blk)&&/opt&&opt\.still/.test(blk)&&/_cwFaceBlankCv/.test(blk)&&/setTimeout\(/.test(blk),`블록 ${blk.length}자`);
{const n=(html.match(/detectFaceAI\((c|cv|tmpCv),\{still:true\}\)/g)||[]).length,det=(html.match(/async function detectFaceInFrame\([\s\S]*?\n\}/)||[''])[0];
 T('B2',n===4&&/detectFaceAI\(safeCv\)/.test(det),`still 호출 ${n}/4 · 라이브 추적 유지 ${/detectFaceAI\(safeCv\)/.test(det)}`);}
{const lp=path.join(__dirname,'fmrepro','p39b.log');const sha=crypto.createHash('sha256').update(blk).digest('hex').slice(0,16);
 const log=fs.existsSync(lp)?fs.readFileSync(lp,'utf8'):'';const m=log.match(/block_sha=([0-9a-f]{16})/),t=log.match(/total=(\d+) pass=(\d+) fail=(\d+)/);
 T('B3',!!m&&m[1]===sha&&!!t&&t[3]==='0'&&+t[1]>0,`블록 sha ${sha} · 로그 ${m?m[1]:'없음'} · ${t?t[0]:'결과 없음'}`);}
{const blocks=[...html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)].filter(m=>!/src=|ld\+json|module/.test(m[1]||'')).map(m=>m[2]);
 const dir=fs.mkdtempSync(path.join(process.env.TMPDIR||os.tmpdir(),'p39_'));let bad=0;
 blocks.forEach((b,i)=>{const f=path.join(dir,`b${i}.js`);fs.writeFileSync(f,b);try{cp.execSync(`node --check "${f}"`,{stdio:'pipe'});}catch(e){bad++;}});
 T('B4',blocks.length>0&&bad===0,`스크립트 ${blocks.length}개 · 오류 ${bad}`);}
const fail=res.filter(r=>!r.ok).map(r=>r.id);console.log(`total=${res.length} pass=${res.length-fail.length} fail=${fail.length}${fail.length?' · FAIL '+fail.join(','):''}`);
