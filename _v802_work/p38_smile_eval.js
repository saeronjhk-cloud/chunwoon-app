// ============================================================
//  P-38 · 미소(표정) 감지 2단계 — P-803-A(제이 결정: 보류선 위 = 재촬영 · 경고 구간 = 안내 + AI 축 제외)
//  node _v802_work/p38_smile_eval.js
// ------------------------------------------------------------
//  근거: d30 — 미소 사진은 같은 사람 무표정 평균 대비 입 크기 24 · 입술 두께 22 · 코 폭 22 · 인중 13 백분위점 벗어남
//   (무표정 사진 7.5 · 7.6 · 12 · 4). 판정기: CelebA 5특징 로지스틱(smile/x02) · 임계 검증셋 확정 · 시험 1회 AUC 0.963.
//  기준(수리 전에 정함):
//   S1 코어 CW_FACE_SMILE 계수 = smile_model.json(전 항목 |Δ|<1e-12) · _cwFaceSmile 존재 · built 가 index 에 1회
//   S2 JS·파이썬 일치 — 실사진 127 + CelebA 60 로짓 |Δ| < 1e-9
//   S3 classify 반환 smile{logit,warn,hold} = _cwFaceSmile 값
//   S4 analyzeFace: 보류(hold) 분기 — 고개 보류 뒤 · 분류 전 · 「입을 다물고 무표정」 카드 · 스캔 해제 · 버튼 복구 · return
//   S5 경고: window._cwSmileWarn 설정·초기화 · 결과 카드 「웃는 표정」 안내 · llmFeatures 3곳 smile 전달
//   S6 fortune.js: CW_FACE_SMILE_AXES(mouthRatio·lipThickness·inJung·noseWRatio) 백분위·실측 제외 + [촬영 조건] 문장
//   S7 라이브: detectFaceInFrame 이 smile 반환 · 정렬 루프 경고 시 카운트 멈춤(상한 CW_SMILE_WAIT_TICKS 뒤 촬영)
//   S8 실사진 관문(Claude 육안 라벨): 명확한 미소 11장 전부 경고 이상 · 무표정 보류 0 · 무표정 경고 ≤ 5%
//   S9 조화도 식 불변 · 고개 보류 카드 유지
//   S10 index.html 인라인 스크립트 문법
// ============================================================
'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),os=require('os');
const ROOT=path.join(__dirname,'..'),IP=path.join(ROOT,'..','ChunWoon_IP','face');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8'),fjs=fs.readFileSync(path.join(ROOT,'api','fortune.js'),'utf8');
const built=fs.readFileSync(path.join(ROOT,'_v786_diag','face_core_v786.built.js'),'utf8');
const M=require('./smile/smile_model.json'),FX=require('./smile/smile_fixture.json');
const res=[];const T=(id,ok,msg)=>{res.push({id,ok});console.log(`${ok?'PASS':'FAIL'} ${id} — ${msg}`);};
let C=null;try{C=require('../_v799_work/persp_v2_lib.js').loadCore(path.join(ROOT,'index.html'));}catch(e){}
const has=C&&typeof C._cwFaceSmile==='function';
{let ok=has&&typeof C.CW_FACE_SMILE==='object'&&html.split(built).length===2;
 if(ok){const S=C.CW_FACE_SMILE;ok=['b','warnT','holdT'].every(k=>Math.abs(S[k]-M[k])<1e-12)&&['w','mu','sd'].every(k=>S[k].length===M[k].length&&S[k].every((v,i)=>Math.abs(v-M[k][i])<1e-12))&&S.feats.join()===M.feats.join();}
 T('S1',ok,has?'계수·built':'_cwFaceSmile 없음');}
{let md=Infinity,n=0;if(has){md=0;for(const d of ['eval_labelset','eval_selfie','eval_hairline']){const L=JSON.parse(fs.readFileSync(path.join(IP,d,'cache','landmarks.json'),'utf8'));
  for(const [k,e] of Object.entries(L)){const v=C._cwFaceSmile(e.lm.map(a=>({x:a[0],y:a[1],z:a[2]})),e.h/e.w).logit;md=Math.max(md,Math.abs(v-FX.real[k]));n++;}}
  for(const e of FX.celeba){md=Math.max(md,Math.abs(C._cwFaceSmile(e.lm.map(a=>({x:a[0],y:a[1]})),e.h/e.w).logit-e.logit));n++;}}
 T('S2',md<1e-9,`n ${n} · 최대 |Δ| ${md}`);}
{let ok=false;if(has){const L=JSON.parse(fs.readFileSync(path.join(IP,'eval_labelset','cache','landmarks.json'),'utf8'));const e=L['lbl_02_rear1x_2'];const ai=e.lm.map(a=>({x:a[0],y:a[1],z:a[2]}));
  const c=C.classifyFaceFromLandmarks(ai,e.h/e.w,null,null),s=C._cwFaceSmile(ai,e.h/e.w);ok=!!c.smile&&c.smile.logit===s.logit&&c.smile.hold===s.hold&&c.smile.warn===s.warn;}
 T('S3',ok,'classify.smile');}
const af=(html.match(/async function analyzeFace\([\s\S]*?setupFaceResultContainer\(h,/)||[''])[0];
{const iPose=af.indexOf('_cwFacePose(ai).held'),iSm=af.indexOf('.hold'),iCls=af.indexOf('classifyFaceFromLandmarks(ai)');
 const blk=iSm>0?af.slice(iSm,af.indexOf('return;',iSm)+7):'';
 T('S4',iPose>0&&iSm>iPose&&iSm<iCls&&/_cwFaceSmile\(/.test(af)&&/입을 다물고 무표정/.test(blk)&&/scanning/.test(blk)&&/faceAnalyzeBtn['"]\)\.disabled=false/.test(blk)&&!/triggerFaceLLM/.test(blk),`위치 pose ${iPose} < smile ${iSm} < classify ${iCls}`);}
{const set=/window\._cwSmileWarn=/.test(af),reset=/window\._cwSmileWarn=null/.test(html),i0=html.indexOf('📐 AI 실측 데이터:'),line=i0>0?html.slice(i0,html.indexOf('</div>',i0)):'';
 const banner=/window\._cwSmileWarn\?[^]*?웃는 표정/.test(line),llm=(html.match(/smile:window\._cwSmileWarn===true/g)||[]).length;
 T('S5',set&&reset&&banner&&llm===3,`설정 ${set} · 초기화 ${reset} · 안내 ${banner} · llm ${llm}/3`);}
{const ax=(fjs.match(/const CW_FACE_SMILE_AXES = \[([^\]]*)\]/)||['',''])[1];const want=['mouthRatio','lipThickness','inJung','noseWRatio'];
 const okAx=want.every(a=>ax.includes(`'${a}'`)),ex=(fjs.match(/f\.smile === true && CW_FACE_SMILE_AXES\.indexOf\(k\) >= 0\) continue/g)||[]).length,ms=/smile === true && CW_FACE_SMILE_AXES\.indexOf\(k\) >= 0\) continue/.test((fjs.match(/function cwFaceMeasureStr[\s\S]*?\n    \}/)||[''])[0]);
 const cond=/if \(f\.smile === true\) out \+= '\\n\[촬영 조건\] [^']*웃/.test(fjs);
 T('S6',okAx&&ex>=1&&ms&&cond,`축 ${okAx} · 백분위 제외 ${ex} · 실측 제외 ${ms} · 촬영 조건 ${cond}`);}
{const det=(html.match(/async function detectFaceInFrame\([\s\S]*?\n\}/)||[''])[0],loop=(html.match(/function startFaceAlignLoop\([\s\S]*?\nfunction stopFaceAlignLoop/)||[''])[0];
 const r1=/smile:/.test(det)&&/_cwFaceSmile\(lm,/.test(det),r2=/det\.smile&&det\.smile\.warn&&_faceCountdownState\.smileWait<CW_SMILE_WAIT_TICKS/.test(loop)&&/smileWait\+\+/.test(loop),r3=/const CW_SMILE_WAIT_TICKS=\d+/.test(html);
 T('S7',r1&&r2&&r3,`반환 ${r1} · 루프 ${r2} · 상한 ${r3}`);}
{const L=FX.labels,R=FX.real;const cl=Object.keys(L).filter(k=>L[k]==='clear'),ne=Object.keys(L).filter(k=>L[k]==='neutral');
 const a=cl.filter(k=>R[k]>M.warnT).length,b=ne.filter(k=>R[k]>M.holdT).length,c=ne.filter(k=>R[k]>M.warnT).length;
 T('S8',a===cl.length&&b===0&&c/ne.length<=0.05,`명확 미소 경고 이상 ${a}/${cl.length} · 무표정 보류 ${b} · 무표정 경고 ${c}/${ne.length}`);}
T('S9',/0\.32 \* m\.symmetry \+ 0\.32 \* m\.thirds \+ 0\.18 \* m\.cheonI \+ 0\.18 \* organProp/.test(built)&&/📷 정면 사진이 필요해요/.test(af),'조화도 식 · 고개 보류 카드');
{const blocks=[...html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)].filter(m=>!/src=|ld\+json|module/.test(m[1]||'')).map(m=>m[2]);
 const dir=fs.mkdtempSync(path.join(process.env.TMPDIR||os.tmpdir(),'p38_'));let bad=0;
 blocks.forEach((b,i)=>{const f=path.join(dir,`b${i}.js`);fs.writeFileSync(f,b);try{cp.execSync(`node --check "${f}"`,{stdio:'pipe'});}catch(e){bad++;}});
 T('S10',blocks.length>0&&bad===0,`스크립트 ${blocks.length}개 · 오류 ${bad}`);}
const fail=res.filter(r=>!r.ok).map(r=>r.id);console.log(`total=${res.length} pass=${res.length-fail.length} fail=${fail.length}${fail.length?' · FAIL '+fail.join(','):''}`);
