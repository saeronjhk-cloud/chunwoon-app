// ============================================================
//  P-30 · 고개 각도에 흔들리지 않는 조화도(종합 점수) — v799 P-799-C
//  node _v799_work/p30_pose_invariant_harmony_eval.js
// ------------------------------------------------------------
//  결함(진단 d16 · 2026-10-09 · 제이 「같은 사람인데 사진마다 점수 편차가 크다」):
//   종합 점수 = 조화도 = 0.32·좌우대칭 + 0.32·삼정 + 0.18·천이(遷移) + 0.18·오관.
//   같은 사람 10묶음에서 종합 점수 범위 중앙 8.5점(최대 31점: 57~88) · 종합↔|좌우 고개 돌림| 상관 −0.79 ·
//   좌우대칭↔|고개| −0.89. 「대칭」·「천이」가 2D 화면 좌표로 계산돼 얼굴의 비대칭이 아니라 고개 돌림을 재고 있었다.
//  수리: 3D 랜드마크(x·y·z)로 얼굴 좌표계(좌우=234→454 · 위아래=152→10 · 앞뒤=외적)를 세워 정면화한 뒤
//   좌우대칭·천이만 그 좌표에서 잰다(_cwFaceFrontal). 삼정·REL 축·참조표(REF)는 그대로.
//  기준(수리 전에 정함):
//   F1 _cwFaceFrontal 존재 · z 없으면 기존(2D) 계산으로 후퇴
//   F2 같은 사람 종합 점수 범위 중앙 ≤ 수리 전의 60%
//   F3 |상관(종합, |고개 좌우|)| ≤ 0.3   F4 |상관(대칭, |고개 좌우|)| ≤ 0.3
//   F5 합성 좌우 회전(±15°, 실제 정면 사진의 3D 점을 돌려 정사영) → 대칭 변화 ≤ 0.05(수리 전 값은 기록)
//   F6 민감도 보존: 합성 비대칭(코·인중·입·턱 중앙점을 얼굴폭 3% 옆으로) → 대칭이 0.10 이상 떨어짐
//   F7 인터넷 23장·셀카 40장 전부 유한값 · 종합 평균 이동 기록
//  자료: D:\ChunWoon_IP\face\eval_labelset · eval_selfie · eval_hairline (git 밖)
// ============================================================
'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib');const Lb=require('./persp_v2_lib.js');
const ROOT=path.join(__dirname,'..'),IP=path.join(ROOT,'..','ChunWoon_IP','face');
const idx=fs.readFileSync(process.env.P17_INDEX||path.join(ROOT,'index.html'),'utf8');
const C=Lb.loadCore(process.env.P17_INDEX||path.join(ROOT,'index.html'));
const has=/function _cwFaceFrontal\(/.test(idx);
let total=0,pass=0;const fails=[];function check(id,name,ok,detail){total++;if(ok)pass++;else fails.push(id);console.log(`  ${ok?'ok  ':'FAIL'} ${id} ${name} — ${detail}`);}
const BEFORE={rangeMed:8.5};   // d16(수리 전) 기록값
function load(dir){const L=JSON.parse(fs.readFileSync(path.join(IP,dir,'cache','landmarks.json'),'utf8'));return [L,k=>{const d=L[k];const ai=d.lm.map(a=>({x:a[0],y:a[1],z:a[2]}));const mp=path.join(IP,dir,'cache',k+'.mask.gz');const hr=fs.existsSync(mp)?C._cwHairline(zlib.gunzipSync(fs.readFileSync(mp)),d.w,d.h,ai):null;return {d,ai,A:d.h/d.w,hr};}];}
const yaw=lm=>{const dl=lm[1][0]-lm[234][0],dr=lm[454][0]-lm[1][0];return (dl-dr)/(dl+dr);};
const [LB,fL]=load('eval_labelset'),[SB,fS]=load('eval_selfie');
const groups={};const rows=[];
const add=(g,x,k,src)=>{const c=C.classifyFaceFromLandmarks(x.ai,x.A,x.hr,src);(groups[g]=groups[g]||[]).push(c.overallScore);rows.push({ov:c.overallScore,sym:c.harmonyParts.symmetry,yaw:Math.abs(yaw(x.d.lm))});};
for(const k of Object.keys(LB)){const x=fL(k);add(LB[k].pid,x,k,LB[k].distCm<=60?'live':null);}
for(const k of Object.keys(SB).filter(k=>/^p2_2026_nog/.test(k)))add('P2',fS(k),k,/near/.test(k)?'live':null);
for(const k of Object.keys(SB).filter(k=>/^jay_2026_nog/.test(k)))add('J0',fS(k),k,/guide/.test(k)?'live':null);
const rng=a=>Math.max(...a)-Math.min(...a);const corr=(x,y)=>{const mx=x.reduce((a,b)=>a+b)/x.length,my=y.reduce((a,b)=>a+b)/y.length;let s=0,sx=0,sy=0;for(let i=0;i<x.length;i++){s+=(x[i]-mx)*(y[i]-my);sx+=(x[i]-mx)**2;sy+=(y[i]-my)**2;}return s/Math.sqrt(sx*sy);};
check('F1','_cwFaceFrontal 존재(z 없으면 2D 후퇴)',has&&/_cwFaceFrontal\(p\)/.test(idx),String(has));
{const r=Object.values(groups).map(rng),m=Lb.med(r);check('F2','같은 사람 종합 점수 범위 중앙 ≤ 수리 전 60%',m<=0.6*BEFORE.rangeMed,`수리 전 ${BEFORE.rangeMed} → ${m} · 사람별 `+Object.entries(groups).map(([g,a])=>g+':'+rng(a)).join(' '));}
{const c=corr(rows.map(r=>r.ov),rows.map(r=>r.yaw));check('F3','|상관(종합, 고개 좌우)| ≤ 0.3',Math.abs(c)<=0.3,c.toFixed(2)+' (수리 전 −0.79)');}
{const c=corr(rows.map(r=>r.sym),rows.map(r=>r.yaw));check('F4','|상관(대칭, 고개 좌우)| ≤ 0.3',Math.abs(c)<=0.3,c.toFixed(2)+' (수리 전 −0.89)');}
// 합성: 정면에 가까운 실제 사진 하나의 3D 점을 돌리거나 비틀어 정사영
const base=(()=>{let best=null;for(const k of Object.keys(LB)){const y=Math.abs(yaw(LB[k].lm));if(!best||y<best.y)best={k,y};}return fL(best.k);})();
function isoPts(x){return x.ai.map(p=>({x:p.x,y:p.y*x.A,z:p.z}));}
function back(pts,A){return pts.map(p=>({x:p.x,y:p.y/A,z:p.z}));}
function rotY(pts,deg){const t=deg*Math.PI/180,c=Math.cos(t),s=Math.sin(t);const cx=pts.reduce((a,p)=>a+p.x,0)/pts.length,cz=pts.reduce((a,p)=>a+p.z,0)/pts.length;return pts.map(p=>({x:cx+(p.x-cx)*c+(p.z-cz)*s,y:p.y,z:cz-(p.x-cx)*s+(p.z-cz)*c}));}
const symOf=ai=>C._cwFaceMeasureRaw(ai,base.A,base.hr).symmetry;
{const P0=isoPts(base);const s0=symOf(back(P0,base.A));const d=[-15,15].map(a=>Math.abs(symOf(back(rotY(P0,a),base.A))-s0));
 check('F5','합성 좌우 회전 ±15° → 대칭 변화 ≤0.05',d.every(v=>v<=0.05),`기준 ${s0.toFixed(3)} · Δ ${d.map(v=>v.toFixed(3)).join(', ')}`);}
{const P0=isoPts(base);const fw=Math.abs(P0[454].x-P0[234].x);const MID=[1,2,4,5,6,195,197,0,11,12,13,14,15,16,17,18,200,199,175,152,164,94,19];const P1=P0.map((p,i)=>MID.includes(i)?{x:p.x+0.03*fw,y:p.y,z:p.z}:p);
 const s0=symOf(back(P0,base.A)),s1=symOf(back(P1,base.A));check('F6','합성 비대칭(중앙점 얼굴폭 3% 이동) → 대칭 ≥0.10 하락',s0-s1>=0.10,`${s0.toFixed(3)} → ${s1.toFixed(3)}`);}
{const [LH,fH]=load('eval_hairline');let ok=true,n=0,sum=0;for(const k of Object.keys(LH)){if(!LH[k]||!LH[k].lm)continue;const c=C.classifyFaceFromLandmarks(fH(k).ai,LH[k].h/LH[k].w,fH(k).hr,null);n++;sum+=c.overallScore;ok=ok&&isFinite(c.overallScore)&&isFinite(c.harmonyParts.symmetry);}
 for(const k of Object.keys(SB)){const c=C.classifyFaceFromLandmarks(fS(k).ai,fS(k).A,fS(k).hr,null);n++;ok=ok&&isFinite(c.overallScore);}
 check('F7','인터넷·셀카 전부 유한값',ok&&n>=60,`n ${n} · 인터넷 종합 평균 ${(sum/23).toFixed(1)}`);}
console.log(`[p30_pose_harmony] total=${total} pass=${pass} fail=${total-pass}${fails.length?' · FAIL '+fails.join(','):''}`);
process.exitCode=fails.length?1:0;
