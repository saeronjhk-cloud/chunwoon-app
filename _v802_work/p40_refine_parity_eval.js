// ============================================================
//  P-40 · 앱 랜드마크 엔진 설정을 평가·기준표 엔진과 맞춤 — P-803-C (refineLandmarks:false)
//  node _v802_work/p40_refine_parity_eval.js
// ------------------------------------------------------------
//  근거 d31(_v802_work/parity/d31.log): 같은 사진 127장 · 같은 코어에서
//   평가 캐시(파이썬 0.10.14 · refine 끔) → 현행 앱(JS 0.4 · refine 켬): 눈 판정 일치 74/127 · 입 71/127 · 얼굴형 106/127 ·
//     편향 eyeTilt −24 · browThick −22 · noseDorsum −12 · eyeSize −11 백분위점. refine 이 눈·입술 윤곽점을 다시 계산하기 때문.
//   엔진 판만 다를 때(JS 0.4 · refine 끔): 눈 111 · 코 112 · 입 109 · 얼굴형 114 · 축 편향 |≤3.7|.
//  REF 기준표·안경 CNN(build_full.py)·미소 판정기(x01)·원근 보정(PERSP)이 모두 refine 끔 랜드마크로 만들어졌다 → 앱을 맞춘다.
//  앱은 홍채 점(468~477)을 어디에도 쓰지 않는다(grep 확인).
//  기준:
//   R1 index.html FaceMesh setOptions 가 refineLandmarks:false (1곳 · true 0곳)
//   R2 d31 로그의 「엔진 판만 다름(refine 끔)」 비교가 판정 일치 ≥ 85%(얼굴형·눈·코·입) ∧ 모든 축 |편향| ≤ 5점
//      ★사후 기준 — refine 끔 결과를 본 뒤 정함(참고용). 1차 기준은 R1 + R3.
//   R3 d31 로그의 현행(refine 켬) 비교가 기록돼 있다(수리 전 근거 보존)
// ============================================================
'use strict';
const fs=require('fs'),path=require('path');const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');const log=fs.readFileSync(path.join(__dirname,'parity','d31.log'),'utf8');
const res=[];const T=(id,ok,msg)=>{res.push({id,ok});console.log(`${ok?'PASS':'FAIL'} ${id} — ${msg}`);};
const nF=(html.match(/refineLandmarks:false/g)||[]).length,nT=(html.match(/refineLandmarks:true/g)||[]).length;
T('R1',nF===1&&nT===0,`false ${nF} · true ${nT}`);
{const sec=(log.split('== 엔진 판만 다름')[1]||'').split('\n== ')[0];const agr={};for(const nm of ['얼굴형','눈','코','입']){const m=sec.match(new RegExp(`(?:^|· |: )${nm} (\\d+)/(\\d+)`,'m'));if(m)agr[nm]=+m[1]/+m[2];}
 const bias=[...sec.matchAll(/편향\s+([+-][\d.]+)/g)].map(m=>Math.abs(+m[1]));
 const ok=Object.keys(agr).length===4&&Object.values(agr).every(v=>v>=0.85)&&bias.length>=25&&bias.every(v=>v<=5);
 T('R2',ok,'일치 '+Object.entries(agr).map(([k,v])=>`${k} ${(v*100).toFixed(0)}%`).join(' · ')+` · 최대 |편향| ${Math.max(...bias)} (축 ${bias.length}) · 사후 기준`);}
T('R3',/== ★평가 캐시\(py·refine 끔\) → 앱\(js·refine 켬\)/.test(log)&&/눈 74\/127/.test(log),'수리 전 비교 보존');
const fail=res.filter(r=>!r.ok).map(r=>r.id);console.log(`total=${res.length} pass=${res.length-fail.length} fail=${fail.length}${fail.length?' · FAIL '+fail.join(','):''}`);
