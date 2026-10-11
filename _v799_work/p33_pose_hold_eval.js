// ============================================================
//  P-33 · 큰 고개 돌림 — 점수 보류·재촬영 안내 (외부 자문 P-799-C R1 Q4 만장일치)
//  node _v799_work/p33_pose_hold_eval.js   (TMPDIR = $HOME/tmpcw · 함정 40)
// ------------------------------------------------------------
//  결함: 정면화 뒤에도 고개를 크게 돌린 사진은 대칭이 낮게 나온다(실사진 메시가 비강체로 맞춰짐 · d19).
//   B안 뒤 p30 F3 −0.38 · 사람별 범위 최대 12(02 rear1x_3). 가이드 촬영인데도 |yaw| 0.61·0.54 사진이 있다(d22).
//  수리: 코어 _cwFacePose(ai) → {yaw, held}. |yaw| ≥ CW_FACE_POSE_MAX.yaw(0.45 ≈ 17°)면 점수 보류·재촬영 안내.
//   라이브 정렬은 더 엄격한 CW_FACE_POSE_MAX.live(0.25 ≈ 10°)로 「정면을 바라봐 주세요」 안내 후 카운트다운.
//   yaw = (코끝−234 − 454−코끝)/합 (원칙 23 진단 지표 · 좌우 반전 불변 · 사진 비율 불변)
//  기준(구현 전에 고정 · 임계는 d22 진단에서 자문 임시값 0.45 를 검증):
//   Y1 _cwFacePose 존재 · classify 반환에 pose{yaw,held} · held ⇔ |yaw| ≥ 0.45 · 상수 {yaw:0.45, live:0.25}
//   Y2 보류율 ≤ 5% (라벨셋+셀카+인터넷 127장)
//   Y3 보류 뒤 같은 사람 범위 최대 ≤ 8 · 중앙 ≤ 5.1
//   Y4 보류 뒤 |상관(종합, |yaw|)| ≤ 0.3 (p30 F3 를 남는 사진에서 재평가)
//   Y5 합성 회전: 10° 보류 안 됨 · 20° 보류됨 · 라이브 안내는 15° 에서 걸림
//   Y6 analyzeFace: 분류 전에 보류 판정 → 「정면」·「다시」 안내 · 점수 카드(setupFaceResultContainer) 미호출 · 버튼 복구
//   Y7 라이브 정렬 루프: CW_FACE_POSE_MAX.live 검사 · 「정면」 안내 · alignedFrames 0 으로
//   Y8 좌우 반전(x→1−x) 입력에서 |yaw|·held 동일
// ============================================================
'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib');const Lb=require('./persp_v2_lib.js');
const ROOT=path.join(__dirname,'..'),IP=path.join(ROOT,'..','ChunWoon_IP','face');
const IDX=process.env.P17_INDEX||path.join(ROOT,'index.html');const idx=fs.readFileSync(IDX,'utf8');
const C=Lb.loadCore(IDX);
// loadCore 는 정해진 이름만 내보낸다 → _cwFacePose·CW_FACE_POSE_MAX 는 같은 구획을 따로 평가해 꺼낸다
let X={};try{const i0=idx.indexOf('var CW_FACE_REF'),i1=idx.indexOf('//  5b. PAL',i0);const M={exports:{}};
 new Function('module','exports','window','var document={createElement:()=>({getContext:()=>null})};'+idx.slice(i0,idx.lastIndexOf('// ====',i1))+'\nmodule.exports={P:typeof _cwFacePose!=="undefined"?_cwFacePose:null,T:typeof CW_FACE_POSE_MAX!=="undefined"?CW_FACE_POSE_MAX:null};')(M,M.exports,{});X=M.exports;}catch(e){X={err:String(e).slice(0,120)};}
let total=0,pass=0;const fails=[];function check(id,name,ok,detail){total++;if(ok)pass++;else fails.push(id);console.log(`  ${ok?'ok  ':'FAIL'} ${id} ${name} — ${detail}`);}
const yawOf=ai=>{const dl=ai[1].x-ai[234].x,dr=ai[454].x-ai[1].x;return (dl-dr)/(dl+dr);};
function load(dir){const L=JSON.parse(fs.readFileSync(path.join(IP,dir,'cache','landmarks.json'),'utf8'));return [L,k=>{const d=L[k];const ai=d.lm.map(a=>({x:a[0],y:a[1],z:a[2]}));const mp=path.join(IP,dir,'cache',k+'.mask.gz');const hr=fs.existsSync(mp)?C._cwHairline(zlib.gunzipSync(fs.readFileSync(mp)),d.w,d.h,ai):null;return {d,ai,A:d.h/d.w,hr};}];}
const [LB,fL]=load('eval_labelset'),[SB,fS]=load('eval_selfie'),[NB,fN]=load('eval_hairline');const rows=[];
const add=(g,k,x,src)=>{const c=C.classifyFaceFromLandmarks(x.ai,x.A,x.hr,src);rows.push({g,k,x,y:Math.abs(yawOf(x.ai)),ov:c.overallScore,pose:c.pose});};
for(const k of Object.keys(LB))add(LB[k].pid,k,fL(k),LB[k].distCm<=60?'live':null);
for(const k of Object.keys(SB).filter(k=>/^p2_2026_nog/.test(k)))add('P2',k,fS(k),/near/.test(k)?'live':null);
for(const k of Object.keys(SB).filter(k=>/^jay_2026_nog/.test(k)))add('J0',k,fS(k),/guide/.test(k)?'live':null);
for(const k of Object.keys(SB).filter(k=>!/^p2_2026_nog|^jay_2026_nog/.test(k)))add(null,k,fS(k),null);
for(const k of Object.keys(NB))if(NB[k]&&NB[k].lm)add(null,k,fN(k),null);
const held=r=>!!(r.pose&&r.pose.held);
// Y1
{const tOk=!!X.T&&X.T.yaw===0.45&&X.T.live===0.25;let bad=0;for(const r of rows){if(!r.pose||Math.abs(Math.abs(r.pose.yaw)-r.y)>1e-9||held(r)!==(r.y>=0.45))bad++;}
 check('Y1','_cwFacePose · classify.pose · held ⇔ |yaw|≥0.45 · 상수',!!X.P&&tOk&&bad===0,`함수 ${!!X.P} · 상수 ${JSON.stringify(X.T)} · 불일치 ${bad}/${rows.length}${X.err?' · '+X.err:''}`);}
// Y2
{const h=rows.filter(held);check('Y2','보류율 ≤ 5%',h.length/rows.length<=0.05,`${h.length}/${rows.length} (${(h.length/rows.length*100).toFixed(1)}%) · `+h.map(r=>r.k+' '+r.y.toFixed(2)).join(', '));}
// Y3·Y4
const keep=rows.filter(r=>r.g&&!held(r));const by={};keep.forEach(r=>(by[r.g]=by[r.g]||[]).push(r.ov));const rng=a=>Math.max(...a)-Math.min(...a);const R=Object.values(by).map(rng);
check('Y3','보류 뒤 같은 사람 범위 최대 ≤ 8 · 중앙 ≤ 5.1',R.length>0&&Math.max(...R)<=8&&Lb.med(R)<=5.1,`최대 ${Math.max(...R)} · 중앙 ${Lb.med(R)} · `+Object.entries(by).map(([g,a])=>g+':'+rng(a)).join(' '));
{const x=keep.map(r=>r.ov),y=keep.map(r=>r.y);const mx=x.reduce((a,b)=>a+b)/x.length,my=y.reduce((a,b)=>a+b)/y.length;let s=0,sx=0,sy=0;for(let i=0;i<x.length;i++){s+=(x[i]-mx)*(y[i]-my);sx+=(x[i]-mx)**2;sy+=(y[i]-my)**2;}const c=s/Math.sqrt(sx*sy);
 check('Y4','보류 뒤 |상관(종합, |yaw|)| ≤ 0.3',Math.abs(c)<=0.3,`${c.toFixed(2)} (보류 없이 −0.38 · n ${keep.length})`);}
// Y5
{let b=null;for(const k of Object.keys(LB)){const y=Math.abs(yawOf(fL(k).ai));if(!b||y<b.y)b={k,y};}const base=fL(b.k);
 const iso=base.ai.map(p=>({x:p.x,y:p.y*base.A,z:p.z}));const rot=d=>{const t=d*Math.PI/180,c=Math.cos(t),s=Math.sin(t);const cx=iso.reduce((a,p)=>a+p.x,0)/iso.length,cz=iso.reduce((a,p)=>a+p.z,0)/iso.length;return iso.map(p=>({x:cx+(p.x-cx)*c+(p.z-cz)*s,y:p.y/base.A,z:cz-(p.x-cx)*s+(p.z-cz)*c}));};
 const P=d=>X.P?X.P(rot(d)):null;const p10=P(10),p20=P(20),p15=P(15);
 check('Y5','합성 10° 통과 · 20° 보류 · 15° 라이브 안내',!!p10&&!p10.held&&p20.held&&Math.abs(p15.yaw)>=0.25,p10?`10° ${p10.yaw.toFixed(2)}/${p10.held} · 15° ${p15.yaw.toFixed(2)} · 20° ${p20.yaw.toFixed(2)}/${p20.held}`:'함수 없음');}
// Y6
{const a=idx.indexOf('async function analyzeFace(){'),b=idx.indexOf('\n}\n',a);const fn=a>=0?idx.slice(a,b):'';
 const ih=fn.indexOf('_cwFacePose(ai)'),ic=fn.indexOf('classifyFaceFromLandmarks(ai)'),is=fn.indexOf('setupFaceResultContainer(');
 const blk=ih>=0?fn.slice(ih,fn.indexOf('return',ih)+7):'';
 const ok=ih>=0&&ih<ic&&ih<is&&/정면/.test(blk)&&/다시/.test(blk)&&/faceAnalyzeBtn'\)\.disabled=false/.test(blk)&&/classList\.remove\('scanning'\)/.test(blk)&&/return/.test(blk);
 check('Y6','analyzeFace 분류 전 보류 · 안내 · 점수 카드 미호출 · 버튼 복구',ok,`보류 위치 ${ih} · 분류 ${ic} · 카드 ${is}`);}
// Y7
{const a=idx.indexOf('function startFaceAlignLoop(){'),b=idx.indexOf('function stopFaceAlignLoop(',a);const fn=a>=0?idx.slice(a,b):'';const i=fn.indexOf('CW_FACE_POSE_MAX.live');const blk=i>=0?fn.slice(i,i+600):'';
 check('Y7','라이브 정렬: live 임계 · 「정면」 안내 · alignedFrames=0',i>=0&&/정면/.test(blk)&&/alignedFrames=0/.test(blk),`위치 ${i}`);}
// Y8
{let bad=0,n=0;for(const r of rows.slice(0,40)){if(!X.P)break;const m=r.x.ai.map(p=>({x:1-p.x,y:p.y,z:-p.z}));const M=new Array(m.length);
  // 좌우 반전 시 MediaPipe 색인도 좌우가 바뀐다 → 234↔454 만 맞바꿔 대조(지표에 쓰는 점)
  for(let i=0;i<m.length;i++)M[i]=m[i];M[234]=m[454];M[454]=m[234];const a=X.P(r.x.ai),b=X.P(M);n++;if(Math.abs(Math.abs(a.yaw)-Math.abs(b.yaw))>1e-9||a.held!==b.held)bad++;}
 check('Y8','좌우 반전 불변',!!X.P&&bad===0,`불일치 ${bad}/${n}`);}
console.log(`[p33_pose_hold] total=${total} pass=${pass} fail=${total-pass}${fails.length?' · FAIL '+fails.join(','):''}`);
process.exitCode=fails.length?1:0;
