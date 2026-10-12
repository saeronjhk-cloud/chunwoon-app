// ============================================================
//  P-37 · 「황금비 근접도」 표시 제거 — P-802-A Q1(자문 대기 · 승인 시 적용)
//  node _v802_work/p37_golden_display_eval.js
// ------------------------------------------------------------
//  근거: 오관비례_근거조사_R1 §6 — 1.618(얼굴 세로/가로)은 원문 근거 없는 황금비 주장 · 실사진 127장 전원 68~81% ·
//   점수·AI에는 쓰이지 않는 표시 전용 수치를 「AI 실측 데이터」로 보여 준다.
//  기준(수리 전에 정함 · 수리 전 4/6 = G1·G2 FAIL이 시작점):
//   G1 결과 카드 「📐 AI 실측 데이터」 줄에 「황금비」·goldenProximity 0건
//   G2 index.html·api/fortune.js 어디에도 「황금비」 사용자 노출 문자열 없음(코어 built 주석 제외)
//   G3 실측 줄의 나머지 항목 유지: 가로세로비 · 좌우대칭 · 중·하정 균형 · 프레임 평균 · 원근 보정 · 안경 경고
//   G4 코어(원본·built) HEAD와 동일 · built가 index.html에 정확히 1번 포함
//   G5 조화도 식(0.32·0.32·0.18·0.18 · 1.62) 그대로 — 점수 불변
//   G6 index.html 인라인 스크립트 문법(함정 48)
// ============================================================
'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),os=require('os');
const ROOT=path.join(__dirname,'..');const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const fjs=fs.readFileSync(path.join(ROOT,'api','fortune.js'),'utf8');
const built=fs.readFileSync(path.join(ROOT,'_v786_diag','face_core_v786.built.js'),'utf8');
const res=[];const T=(id,ok,msg)=>{res.push({id,ok});console.log(`${ok?'PASS':'FAIL'} ${id} — ${msg}`);};
const i0=html.indexOf('📐 AI 실측 데이터:');const line=i0>0?html.slice(i0,html.indexOf('</div>',i0)):'';
T('G1',line.length>0&&!/황금비|goldenProximity/.test(line),`실측 줄 길이 ${line.length}`);
const outside=html.split(built).join('');const n1=(outside.match(/황금비/g)||[]).length,n2=(fjs.match(/황금비/g)||[]).length;
T('G2',n1===0&&n2===0,`index(코어 밖) ${n1} · fortune.js ${n2}`);
const keep=[/가로세로비/,/좌우대칭/,/중·하정 균형/,/프레임 평균/,/원근 보정/,/안경 착용이 감지/];
T('G3',keep.every(r=>r.test(line)),keep.map(r=>r.test(line)?'○':'×').join(''));
{const d=cp.execSync('git diff HEAD --stat -- _v786_diag/face_core_v786.js _v786_diag/face_core_v786.built.js',{cwd:ROOT}).toString().trim();
 T('G4',d===''&&html.split(built).length===2,'코어 불변 · built 1회');}
T('G5',/0\.32 \* m\.symmetry \+ 0\.32 \* m\.thirds \+ 0\.18 \* m\.cheonI \+ 0\.18 \* organProp/.test(built)&&/- 1\.62\) \/ 1\.62/.test(built),'조화도 식');
{const blocks=[...html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)].filter(m=>!/src=|ld\+json|module/.test(m[1]||'')).map(m=>m[2]);
 const dir=fs.mkdtempSync(path.join(process.env.TMPDIR||os.tmpdir(),'p37_'));let bad=0;
 blocks.forEach((b,i)=>{const f=path.join(dir,`b${i}.js`);fs.writeFileSync(f,b);try{cp.execSync(`node --check "${f}"`,{stdio:'pipe'});}catch(e){bad++;}});
 T('G6',blocks.length>0&&bad===0,`스크립트 ${blocks.length}개 · 오류 ${bad}`);}
const fail=res.filter(r=>!r.ok).map(r=>r.id);console.log(`total=${res.length} pass=${res.length-fail.length} fail=${fail.length}${fail.length?' · FAIL '+fail.join(','):''}`);
