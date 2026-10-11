// ============================================================
//  P-32 · 上停 점수 정책 B안 — v799 P-799-C 2단계 (외부 자문 R1 만장일치)
//  node _v799_work/p32_upper_policy_b_eval.js   (TMPDIR 은 세션 전용 폴더 — 함정 40)
// ------------------------------------------------------------
//  결함: 머리선이 보이면 삼정 3분, 가리면 2분 → 같은 얼굴도 앞머리 유무로 −4.5~−11.3점(d20).
//  B안: 조화도의 삼정 항 = 항상 中·下停 2분(정면화). 上停은 머리선이 보일 때만 3단계 말(점수 미반영).
//  기준(구현 전에 고정 · 자문 결과 파일 §결정):
//   G1 같은 사진에서 머리선 있음/없음 → 삼정 점수 동일(|Δ|<1e-9) · 라벨셋 전부
//   G2 같은 사람 종합 점수 범위 중앙 ≤ 5.1 (수리 전 8.5 의 60%)
//   G3 고개 큰 사진(|yaw|≥0.45, p33 보류 예정) 제외 → 사람별 범위 최대 ≤ 8 (자문 Q5 극단치 상한)
//   G4 머리선 보임·가림이 섞인 사람마다 |보임 평균 − 가림 평균| ≤ 1.5 · 짝비교 평균의 95% 신뢰구간 기록
//   G5 raw.upperLevel: 머리선 OK ⇔ 'short'|'even'|'long' · 가림 ⇔ null · CW_FACE_UPPER_BAND = 0.12
//   G6 index.html: 상정 % 숫자 비노출 · 「중·하정 균형」 표기(실측 줄·경고·도면) · 상정 3단계 문장
//   G7 api/fortune.js: thirds 이름 「중·하정 균형」 · 상정 % 미전달 · 「상정은 점수에 넣지 않은 참고」·「이마 길이로 길흉 단정 금지」 규칙
//   G8 순위 보존: 전체 사진 종합 점수 Spearman(수리 전, 후) ≥ 0.80 · 묶음별 평균 이동 ≤ +3
//   G9 셀카 40장 3분/2분 사진의 평균 차 |≤1.5| (현행 85.4 vs 92.5) · 전부 유한값
//  기준 「수리 전」 = 운영 배포본 c3b8eb3:index.html
//  ★사후 보조 기준(구현 후 결과를 보고 추가 · 2026-10-11 · 진단 d21) — 원 기준 G4·G8·G9 미달은 그대로 보존한다.
//   이유: G4·G9 는 「서로 다른 사진」의 평균 차라 사진 간 잡음(사람 안 범위 2~6점)이 섞인다(05·J0 은 보임 사진 1장).
//         G8 은 의도한 교정(보임 사진의 上停 감점 제거)까지 순위 훼손으로 센다 — 가림 사진 ρ 1.00 · 보임만 0.56.
//   G4b 같은 사진 짝비교: 머리선 있음/없음 → 종합 점수 차 0 (전 사진)
//   G8b 가림 사진(정책과 무관한 사진) ρ = 1 · 평균 이동 0  ·  G8c |ρ(종합, 머리선 보임 여부)| ≤ 0.2 (수리 전 −0.46)
// ============================================================
'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib'),os=require('os'),cp=require('child_process');const Lb=require('./persp_v2_lib.js');
const ROOT=path.join(__dirname,'..'),IP=path.join(ROOT,'..','ChunWoon_IP','face');
const IDX=process.env.P17_INDEX||path.join(ROOT,'index.html');const idx=fs.readFileSync(IDX,'utf8');const fj=fs.readFileSync(path.join(ROOT,'api','fortune.js'),'utf8');
const C=Lb.loadCore(IDX);
const basePath=path.join(os.tmpdir(),'p32_base_c3b8eb3.html');fs.writeFileSync(basePath,cp.execSync('git show c3b8eb3:index.html',{cwd:ROOT,maxBuffer:64<<20}));const C0=Lb.loadCore(basePath);
let total=0,pass=0;const fails=[];function check(id,name,ok,detail){total++;if(ok)pass++;else fails.push(id);console.log(`  ${ok?'ok  ':'FAIL'} ${id} ${name} — ${detail}`);}
const yaw=lm=>{const dl=lm[1][0]-lm[234][0],dr=lm[454][0]-lm[1][0];return (dl-dr)/(dl+dr);};
function load(dir){const L=JSON.parse(fs.readFileSync(path.join(IP,dir,'cache','landmarks.json'),'utf8'));return [L,k=>{const d=L[k];const ai=d.lm.map(a=>({x:a[0],y:a[1],z:a[2]}));const mp=path.join(IP,dir,'cache',k+'.mask.gz');const hr=fs.existsSync(mp)?C._cwHairline(zlib.gunzipSync(fs.readFileSync(mp)),d.w,d.h,ai):null;return {d,ai,A:d.h/d.w,hr};}];}
const [LB,fL]=load('eval_labelset'),[SB,fS]=load('eval_selfie'),[NB,fN]=load('eval_hairline');
const rows=[];
function add(set,g,x,src){const c=C.classifyFaceFromLandmarks(x.ai,x.A,x.hr,src),c0=C0.classifyFaceFromLandmarks(x.ai,x.A,x.hr,src);const raw=C._cwFaceMeasureRaw(x.ai,x.A,x.hr);
 rows.push({set,g,ov:c.overallScore,ov0:c0.overallScore,vis:!!(x.hr&&x.hr.status==='OK'&&raw.thirdsParts===3),lvl:raw.upperLevel,yaw:Math.abs(yaw(x.d.lm)),x,src,th:c.harmonyParts.thirds});}
for(const k of Object.keys(LB))add('label',LB[k].pid,fL(k),LB[k].distCm<=60?'live':null);
for(const k of Object.keys(SB).filter(k=>/^p2_2026_nog/.test(k)))add('label','P2',fS(k),/near/.test(k)?'live':null);
for(const k of Object.keys(SB).filter(k=>/^jay_2026_nog/.test(k)))add('label','J0',fS(k),/guide/.test(k)?'live':null);
for(const k of Object.keys(SB))add('selfie',null,fS(k),null);
for(const k of Object.keys(NB)){if(NB[k]&&NB[k].lm)add('net',null,fN(k),null);}
const P=rows.filter(r=>r.g);const by={};P.forEach(r=>(by[r.g]=by[r.g]||[]).push(r));
const rng=a=>Math.max(...a)-Math.min(...a),mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
// G1
{let mx=0,n=0;for(const r of rows.filter(r=>r.set==='label')){const a=C._cwFaceMeasureRaw(r.x.ai,r.x.A,r.x.hr).thirds,b=C._cwFaceMeasureRaw(r.x.ai,r.x.A,null).thirds;mx=Math.max(mx,Math.abs(a-b));n++;}
 check('G1','머리선 있음/없음 → 삼정 점수 동일',mx<1e-9,`n ${n} · 최대 Δ ${mx.toExponential(2)}`);}
// G2
{const r=Object.values(by).map(a=>rng(a.map(x=>x.ov))),m=Lb.med(r);check('G2','같은 사람 범위 중앙 ≤ 5.1',m<=5.1,`수리 전(1단계 후) ${Lb.med(Object.values(by).map(a=>rng(a.map(x=>x.ov0))))} → ${m} · `+Object.entries(by).map(([g,a])=>g+':'+rng(a.map(x=>x.ov))).join(' '));}
// G3
{const r=Object.entries(by).map(([g,a])=>{const b=a.filter(x=>x.yaw<0.45);return [g,rng(b.map(x=>x.ov)),a.length-b.length];});const mx=Math.max(...r.map(v=>v[1]));const all=Math.max(...Object.values(by).map(a=>rng(a.map(x=>x.ov))));
 check('G3','고개 큰 사진 제외 사람별 범위 최대 ≤ 8',mx<=8,`최대 ${mx} (전부 포함 ${all}) · 제외 장수 `+r.filter(v=>v[2]).map(v=>v[0]+':'+v[2]).join(' '));}
// G4
{const d=Object.entries(by).filter(([g,a])=>a.some(x=>x.vis)&&a.some(x=>!x.vis)).map(([g,a])=>[g,mean(a.filter(x=>x.vis).map(x=>x.ov))-mean(a.filter(x=>!x.vis).map(x=>x.ov)),mean(a.filter(x=>x.vis).map(x=>x.ov0))-mean(a.filter(x=>!x.vis).map(x=>x.ov0))]);
 const v=d.map(e=>e[1]),m=mean(v),sd=v.length>1?Math.sqrt(v.reduce((s,x)=>s+(x-m)**2,0)/(v.length-1)):0,T={1:12.71,2:4.30,3:3.18,4:2.78,5:2.57,6:2.45,7:2.36,8:2.31,9:2.26};const h=v.length>1?T[Math.min(9,v.length-1)]*sd/Math.sqrt(v.length):NaN;
 check('G4','사람 안 |보임−가림| ≤ 1.5',d.length>0&&v.every(x=>Math.abs(x)<=1.5),d.map(e=>`${e[0]}:${e[1].toFixed(1)}(전 ${e[2].toFixed(1)})`).join(' ')+` · 평균 ${m.toFixed(2)} 95%CI [${(m-h).toFixed(2)}, ${(m+h).toFixed(2)}]`);}
// G5
{const bandOk=/var CW_FACE_UPPER_BAND\s*=\s*0\.12\b/.test(idx);let bad=0,cnt={short:0,even:0,long:0,null:0};
 for(const r of rows){const ok=r.vis?['short','even','long'].includes(r.lvl):r.lvl===null;if(!ok)bad++;{const kk=r.lvl==null?'null':r.lvl;cnt[kk]=(cnt[kk]||0)+1;}}
 const cons=Object.entries(by).map(([g,a])=>{const l=a.filter(x=>x.lvl).map(x=>x.lvl);if(!l.length)return null;const m=Lb.mode(l);return g+':'+m+' '+l.filter(x=>x===m).length+'/'+l.length;}).filter(Boolean).join(' ');
 check('G5','upperLevel ⇔ 머리선 · 구간 0.12',bandOk&&bad===0,`구간 상수 ${bandOk} · 불일치 ${bad} · 분포 ${JSON.stringify(cnt)} · 사람 안 일관 ${cons}`);}
// G6
{const noPct=!/upperThirdPct\|\|0\)\.toFixed\(1\)\+'%'/.test(idx)&&!/ra\.upperThirdPct/.test(idx.slice(idx.indexOf('const threeCourtAnalysis')));
 const lab=/중·하정 균형 \$\{\(aiScores\.ratios\.thirdsScore/.test(idx)&&/warningMsg='중·하정\(中·下停\)/.test(idx)&&/`중·하정 \$\{\(ra\.thirdsScore/.test(idx)&&!/삼정균형 \$\{/.test(idx);
 const lvl=/upperLevel==='short'/.test(idx)&&/upperLevel==='long'/.test(idx)&&/점수에는 넣지 않/.test(idx);
 check('G6','화면: 상정 % 비노출 · 중·하정 균형 표기 · 3단계 문장',noPct&&lab&&lvl,`% 비노출 ${noPct} · 표기 ${lab} · 3단계 ${lvl}`);}
// G7
{const nm=/thirds: '중·하정 균형'/.test(fj)&&/thirds: '중·하정 균형\(中·下停\)'/.test(fj);const noPct=!/'upperThirdPct','middleThirdPct','lowerThirdPct'/.test(fj);const rule=/상정은 점수에 넣지 않은 참고/.test(fj)&&/이마 길이로 길흉을 단정/.test(fj);
 check('G7','fortune.js: 명칭 · 상정 % 미전달 · 규칙',nm&&noPct&&rule,`명칭 ${nm} · % 미전달 ${noPct} · 규칙 ${rule}`);}
// G8
{const rk=a=>{const s=a.map((v,i)=>[v,i]).sort((x,y)=>x[0]-y[0]);const r=new Array(a.length);let i=0;while(i<s.length){let j=i;while(j+1<s.length&&s[j+1][0]===s[i][0])j++;for(let t=i;t<=j;t++)r[s[t][1]]=(i+j)/2;i=j+1;}return r;};
 const a=rk(rows.map(r=>r.ov0)),b=rk(rows.map(r=>r.ov));const ma=mean(a),mb=mean(b);let s=0,sa=0,sb=0;for(let i=0;i<a.length;i++){s+=(a[i]-ma)*(b[i]-mb);sa+=(a[i]-ma)**2;sb+=(b[i]-mb)**2;}const rho=s/Math.sqrt(sa*sb);
 const sh=['label','selfie','net'].map(t=>{const q=rows.filter(r=>r.set===t);return [t,mean(q.map(r=>r.ov-r.ov0))];});
 check('G8','순위 보존 ρ ≥ 0.80 · 평균 이동 ≤ +3',rho>=0.8&&sh.every(e=>e[1]<=3),`ρ ${rho.toFixed(3)} (n ${rows.length}) · 이동 `+sh.map(e=>e[0]+' '+(e[1]>=0?'+':'')+e[1].toFixed(1)).join(' · '));}
// G9
{const q=rows.filter(r=>r.set==='selfie');const g3=q.filter(r=>r.vis),g2=q.filter(r=>!r.vis);const fin=rows.every(r=>isFinite(r.ov)&&isFinite(r.th));const d=g3.length&&g2.length?mean(g3.map(r=>r.ov))-mean(g2.map(r=>r.ov)):NaN;
 check('G9','셀카 3분/2분 평균 차 |≤1.5| · 유한값',fin&&Math.abs(d)<=1.5,`보임 ${g3.length}장 ${g3.length?mean(g3.map(r=>r.ov)).toFixed(1):'-'} · 가림 ${g2.length}장 ${g2.length?mean(g2.map(r=>r.ov)).toFixed(1):'-'} · 차 ${d.toFixed(1)} (전 ${mean(g3.map(r=>r.ov0)).toFixed(1)} vs ${mean(g2.map(r=>r.ov0)).toFixed(1)})`);}
// ── 사후 보조 기준 (G4·G8·G9 원 기준은 위에 그대로) ──
{let mx=0;for(const r of rows){const a=C.classifyFaceFromLandmarks(r.x.ai,r.x.A,r.x.hr,r.src).overallScore,b=C.classifyFaceFromLandmarks(r.x.ai,r.x.A,null,r.src).overallScore;mx=Math.max(mx,Math.abs(a-b));}
 check('G4b','(사후) 같은 사진 머리선 있음/없음 → 종합 점수 차 0',mx===0,`n ${rows.length} · 최대 차 ${mx}`);}
{const sp=(x,y)=>{const rk=a=>{const s=a.map((v,i)=>[v,i]).sort((p,q)=>p[0]-q[0]);const r=new Array(a.length);let i=0;while(i<s.length){let j=i;while(j+1<s.length&&s[j+1][0]===s[i][0])j++;for(let t=i;t<=j;t++)r[s[t][1]]=(i+j)/2;i=j+1;}return r;};const a=rk(x),b=rk(y),ma=mean(a),mb=mean(b);let s=0,sa=0,sb=0;for(let i=0;i<a.length;i++){s+=(a[i]-ma)*(b[i]-mb);sa+=(a[i]-ma)**2;sb+=(b[i]-mb)**2;}return s/Math.sqrt(sa*sb);};
 const h=rows.filter(r=>!r.vis);const rh=sp(h.map(r=>r.ov0),h.map(r=>r.ov)),mh=mean(h.map(r=>r.ov-r.ov0));
 check('G8b','(사후) 가림 사진 ρ = 1 · 평균 이동 0',rh>0.9999&&Math.abs(mh)<1e-9,`n ${h.length} · ρ ${rh.toFixed(3)} · 이동 ${mh.toFixed(2)}`);
 const c0=sp(rows.map(r=>r.ov0),rows.map(r=>r.vis?1:0)),c1=sp(rows.map(r=>r.ov),rows.map(r=>r.vis?1:0));
 check('G8c','(사후) |ρ(종합, 머리선 보임)| ≤ 0.2',Math.abs(c1)<=0.2,`수리 전 ${c0.toFixed(2)} → ${c1.toFixed(2)}`);}
console.log(`[p32_upper_policy_b] total=${total} pass=${pass} fail=${total-pass}${fails.length?' · FAIL '+fails.join(','):''}`);
process.exitCode=fails.length?1:0;
