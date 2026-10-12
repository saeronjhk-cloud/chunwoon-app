// ============================================================
//  P-36 · 무표정 안내 + 계측 불가 시 점수 미표시 — v801 P-801-B
//  node _v799_work/p36_neutral_guide_nohash_eval.js
// ------------------------------------------------------------
//  근거: d27 — 사람 안 흔들림의 가장 큰 촬영 요인은 미소(r −0.37, 대칭 −0.42). 안내 문구로 줄인다(점수 계산 불변).
//  결함: 랜드마크가 없으면 analyzeFace 가 사진 해시로 얼굴형·눈·코·입을 고르고 종합·부위 점수를 해시로 만들어 보였다
//   (계측 없는 숫자 — 원칙 22 「점수는 얼굴을 잰다」 위반). → 「얼굴을 찾지 못했어요」 카드 · 점수·AI 호출 없음.
//  기준(수리 전에 정함):
//   N1 업로드 안내 문구에 「입을 다물고」「무표정」
//   N2 라이브 정렬 중·정렬 완료 상태 문구에 「무표정」
//   N3 analyzeFace: 랜드마크 없음 분기가 pickFromHash 를 부르지 않는다
//   N4 그 분기는 「얼굴을 찾지 못했」 카드를 띄우고 setupFaceResultContainer 전에 return 한다(스캔 해제·버튼 복구 포함)
//   N5 setupFaceResultContainer 호출 시점에 aiScores 가 항상 계측값 — 호출 앞 분기 구조 확인
//   N6 고개 보류 카드(P-33) 그대로 · 코어(원본·built) 무변경
// ============================================================
'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process');
const ROOT=path.join(__dirname,'..');const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const res=[];const T=(id,ok,msg)=>{res.push({id,ok});console.log(`${ok?'PASS':'FAIL'} ${id} — ${msg}`);};
const intro=(html.match(/<p[^>]*>정면을 바라본 얼굴 사진을 촬영하거나 업로드하세요[\s\S]*?<\/p>/)||[''])[0];
T('N1',/입을 다물고/.test(intro)&&/무표정/.test(intro),'업로드 안내');
const loop=(html.match(/function startFaceAlignLoop\([\s\S]*?\nfunction stopFaceAlignLoop/)||[''])[0];
const ing=(loop.match(/status\.textContent=`✓ 정렬 중[^`]*`/)||[''])[0],done=(loop.match(/status\.textContent='✓ 정렬 완료[^']*'/)||[''])[0];
T('N2',/무표정/.test(ing)&&/무표정/.test(done),`정렬 중 「${ing.slice(20,70)}」 · 완료 「${done.slice(20,60)}」`);
const af=(html.match(/async function analyzeFace\([\s\S]*?setupFaceResultContainer\(h,/)||[''])[0];
const iElse=af.lastIndexOf('} else {'),br=iElse>0?af.slice(iElse):'';
T('N3',af.length>0&&!/pickFromHash/.test(br),`분기 길이 ${br.length}`);
T('N4',/얼굴을 찾지 못했/.test(br)&&/return;/.test(br)&&/scanning/.test(br)&&/faceAnalyzeBtn['"]\)\.disabled=false/.test(br),'카드·return·스캔 해제·버튼 복구');
{const pre=af.slice(0,af.indexOf('setupFaceResultContainer(h,'));const ok=/if\(ai&&ai\.length>=468\)\{[\s\S]*?aiScores=cls;[\s\S]*?\} else \{[\s\S]*?return;\s*\}/.test(pre);T('N5',ok,'계측 분기 외에는 return');}
{const d1=cp.execSync('git diff HEAD --stat -- _v786_diag/face_core_v786.js _v786_diag/face_core_v786.built.js',{cwd:ROOT}).toString().trim();
 const built=fs.readFileSync(path.join(ROOT,'_v786_diag','face_core_v786.built.js'),'utf8');T('N6',d1===''&&html.split(built).length===2&&/📷 정면 사진이 필요해요/.test(af),'코어 불변·보류 카드 유지');}
const fail=res.filter(r=>!r.ok).map(r=>r.id);console.log(`total=${res.length} pass=${res.length-fail.length} fail=${fail.length}${fail.length?' · FAIL '+fail.join(','):''}`);
