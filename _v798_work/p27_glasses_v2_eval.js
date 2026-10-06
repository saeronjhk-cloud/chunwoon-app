// ============================================================
//  P-27 · 안경 감지 v2(학습형 소형 CNN) 평가 — v798 P-798-A
//  node _v798_work/p27_glasses_v2_eval.js
// ------------------------------------------------------------
//  결함(진단 d09·d10 · 10-06): v797 규칙(콧등 가로선 peak·max)은
//   ① 저대비 옛 폰 셀카의 얇은 금속테를 놓침(jay_2011_g_selfie_b·c, max 7.8·9.3 < 10)
//   ② 외부 홀드아웃(CelebAMask-HQ p4·p5)에서 재현 364/385(94.5%) · 오탐 163/5000(3.26%) — 콧등 주름·앞머리·모자 그림자.
//   임계 조정으로는 두 문제를 함께 풀 수 없음(d10: 변형 7종 모두 양·음성 겹침).
//  수리: 정렬 패치 52×24 → 소형 CNN(11,673 파라미터 · int8) · 임계는 검증 p3 에서 시험 전에 결정(logit 0.5799).
//  기준(수리 전에 정함):
//   E1 함수·상수 존재 · E2 앱 패치 추출 = 평가 패치(40장 최대차 <1e-3)
//   E3 시험(원본) 재현 ≥95% · 오탐 ≤0.6% · 머리 위 0 · E4 시험(열화) 재현 ≥94% · 오탐 ≤0.6%
//   E5 셀카셋(앱 조건 · 전 과정) 재현 21/21 · 오탐 0 · E6 인터넷 23장 오탐 0 · 재현 ≥60%
//   E7 앱 조건 제이 2026 가이드 안경 5/5 · E8 1회 판정 평균 <20ms(node)
//  자료: D:\ChunWoon_IP\face\eval_glasses_hq (git 밖 · README.json) · eval_selfie\gray
// ============================================================
'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib');
const ROOT=path.join(__dirname,'..'),IP=path.join(ROOT,'..','ChunWoon_IP','face'),HQ=path.join(IP,'eval_glasses_hq'),EV=path.join(IP,'eval_selfie');
const STUB="const FACE_S=[{l:'a',v:'round'}];const FACE_E=[{l:'a',v:'big'}];const FACE_N=[{l:'a',v:'high'}];const FACE_M=[{l:'a',v:'big'}];";
const idx=fs.readFileSync(process.env.P17_INDEX||path.join(ROOT,'index.html'),'utf8');
const i0=idx.indexOf('var CW_FACE_REF'),i1=idx.indexOf('//  5b. PAL',i0);
const M={exports:{}};
new Function('module','exports','window',STUB+idx.slice(i0,idx.lastIndexOf('// ====',i1))+
  "\nmodule.exports={gs:(typeof _cwGlassesScore!=='undefined'?_cwGlassesScore:null),T:(typeof CW_GLASSES_T!=='undefined'?CW_GLASSES_T:null),"+
  "patch:(typeof _cwGlassesPatch!=='undefined'?_cwGlassesPatch:null),logit:(typeof _cwGlassesLogit!=='undefined'?_cwGlassesLogit:null)};")(M,M.exports,{});
const C=M.exports;let total=0,pass=0;const fails=[];
function check(id,name,ok,detail){total++;if(ok)pass++;else fails.push(id);console.log(`  ${ok?'ok  ':'FAIL'} ${id} ${name} — ${detail}`);}
const ready=!!(C.gs&&C.T&&typeof C.T.logit==='number'&&C.patch&&C.logit);
check('E1','_cwGlassesPatch · _cwGlassesLogit · CW_GLASSES_T.logit',ready,C.T?JSON.stringify(C.T):'없음');
const ld=f=>new Float32Array(zlib.gunzipSync(fs.readFileSync(path.join(HQ,f))).buffer.slice(0));
const TE=ld('te_patch.bin.gz'),TED=ld('ted_patch.bin.gz'),TM=JSON.parse(fs.readFileSync(path.join(HQ,'te_meta.json'))),N=1248;
{let mx=ready?0:Infinity,n=0;if(ready){const PJ=JSON.parse(fs.readFileSync(path.join(HQ,'parity','parity.json')));
  for(const [k,v] of Object.entries(PJ)){const g=zlib.gunzipSync(fs.readFileSync(path.join(HQ,'parity',k+'.gray.gz')));const P=C.patch(g,v.w,v.h,v.lm.map(a=>({x:a[0],y:a[1]})),0);
   for(let i=0;i<N;i++)mx=Math.max(mx,Math.abs(P[i]-TE[v.row*N+i]));n++;}}
 check('E2','앱 패치 추출 = 평가 패치(40장)',ready&&n===40&&mx<1e-3,`n ${n} · 최대차 ${mx}`);}
function hq(X,nm){const r={pos:[0,0],neg:[0,0],head:[0,0]};if(!ready)return r;for(let i=0;i<TM.length;i++){const lg=C.logit(X.subarray(i*N,(i+1)*N));const b=r[TM[i][1]];b[1]++;if(lg>=C.T.logit)b[0]++;}return r;}
{const r=hq(TE);check('E3','시험(원본) 재현 ≥95% · 오탐 ≤0.6% · 머리 위 0',ready&&r.pos[0]>=0.95*r.pos[1]&&r.neg[0]<=0.006*r.neg[1]&&r.head[0]===0,`재현 ${r.pos.join('/')} · 오탐 ${r.neg.join('/')} · 머리위 ${r.head.join('/')} (v797: 364/385 · 163/5000 · 2/35)`);}
{const r=hq(TED);check('E4','시험(열화) 재현 ≥94% · 오탐 ≤0.6%',ready&&r.pos[0]>=0.94*r.pos[1]&&r.neg[0]<=0.006*r.neg[1],`재현 ${r.pos.join('/')} · 오탐 ${r.neg.join('/')} · 머리위 ${r.head.join('/')}`);}
const GT=JSON.parse(fs.readFileSync(path.join(EV,'gray','glasses_gt.json'),'utf8')).gt;
const LS=JSON.parse(fs.readFileSync(path.join(EV,'cache','landmarks.json'),'utf8')),LH=JSON.parse(fs.readFileSync(path.join(EV,'gray','hl_landmarks.json'),'utf8'));
const R={};let ms=0,cnt=0;
if(C.gs)for(const [k,g] of Object.entries(GT)){const L=k.startsWith('hl_')?LH[k.slice(3)]:LS[k];const gray=zlib.gunzipSync(fs.readFileSync(path.join(EV,'gray',k+'.gray.gz')));
  const t0=process.hrtime.bigint();const r=C.gs(gray,g.w,g.h,L.lm.map(a=>({x:a[0],y:a[1]})));ms+=Number(process.hrtime.bigint()-t0)/1e6;cnt++;
  R[k]={gt:g.glasses,set:g.set,pred:!!(r&&r.glasses),lg:r&&r.logit};}
const stat=f=>{const ks=Object.keys(R).filter(f);return {n:ks.length,fp:ks.filter(k=>!R[k].gt&&R[k].pred),tp:ks.filter(k=>R[k].gt&&R[k].pred).length,pos:ks.filter(k=>R[k].gt).length,miss:ks.filter(k=>R[k].gt&&!R[k].pred)};};
{const s=stat(k=>R[k].set==='selfie');check('E5','셀카셋 재현 21/21 · 오탐 0',ready&&s.n===40&&s.fp.length===0&&s.tp===21&&s.pos===21,`n ${s.n} · 재현 ${s.tp}/${s.pos} · 오탐 ${s.fp.join(',')||0} · 놓침 ${s.miss.join(',')||'-'}`);}
{const s=stat(k=>R[k].set==='hairline');check('E6','인터넷 23장 오탐 0 · 재현 ≥60%',ready&&s.n===23&&s.fp.length===0&&s.tp>=0.6*s.pos,`재현 ${s.tp}/${s.pos} · 오탐 ${s.fp.join(',')||0}`);}
{const ks=Object.keys(R).filter(k=>k.startsWith('jay_2026_g_guide'));check('E7','앱 조건 제이 2026 가이드 안경 5/5',ready&&ks.length===5&&ks.every(k=>R[k].pred),ks.map(k=>`${k.slice(-1)}:${R[k].pred?1:0}`).join(' '));}
check('E8','1회 판정 평균 <20ms(node)',ready&&cnt>0&&ms/cnt<20,cnt?`${(ms/cnt).toFixed(2)}ms`:'');
if(process.argv[2]==='dump')for(const [k,v] of Object.entries(R))console.log('   ',k.padEnd(26),v.gt?'G':'-',v.pred?'P':'.',v.lg!=null?v.lg.toFixed(2):'');
console.log(`[p27_glasses_v2] total=${total} pass=${pass} fail=${total-pass}${fails.length?' · FAIL '+fails.join(','):''}`);
process.exitCode=fails.length?1:0;
