// ============================================================
//  P-34 · 각진형 재정의 — 「方」 = 충분한 턱 폭 + 모서리 꺾임 (외부 자문 P-800-A R1 · C안)
//  node _v799_work/p34_square_corner_eval.js   (TMPDIR = $HOME/tmpcw)
// ------------------------------------------------------------
//  결함(d23·d24): 각진 = 턱 폭 백분위 > 0.62 만 봐서 한국인 라벨셋 72% 가 각진(인터넷 30%). 폭은 方이 아니다.
//  수리: raw.jawCorner(K) 추가 · 원근 보정 생성기(d15)에 K 후보 추가 · 실사진 기준 CW_FACE_JAWCORNER{q,k0,eps}
//   각진 = 긴형 아님 ∧ jr 백분위 > 0.62 ∧ K ≥ k0 · 넓지만 K<k0 → 둥근 「턱이 넓은 편 · 모서리는 둥근 편」 · |K−k0|<eps 병기
//  기준(구현 전에 고정 · 자문 결과 파일 §결정):
//   S1 raw.jawCorner = 기준 구현(jaw_corner_lib · 정면화 좌표) 과 같다(|Δ|<1e-9, 라벨셋 전부)
//   S2 CW_FACE_JAWCORNER: version·tier 표기 · k0 = q 중앙 · 풀 = 사람당 1표(라벨셋 사람 원거리 중앙 + 인터넷) ≥ 30명
//   S3 원근 보정: 기존 12축 계수 불변 · jawCorner 선택 결과 기록(emp 면 계수, 아니면 무보정)
//   S4 사람 단위 각진 비율: |라벨셋 10명 − 인터넷 23명| ≤ 20%p (수리 전 기록)
//   S5 사람 안 판정 일관: 중앙 ≥ 0.9 ∧ 최소 ≥ 0.75
//   S6 근접=원거리 다수 판정 ≥ 8/10 (보정 전·후 기록)
//   S7 K 재현성 ICC ≥ 0.7 (근접 보정 후)
//   S8 합성 민감도: 턱 폭 넓은 실사진에서 하악각점을 바깥으로(얼굴 폭 2%) → K 증가 ∧ 각진 · 안쪽으로 → K 감소 ∧ 각진 아님
//   S9 표시: 넓지만 둥근 사진의 근거에 「모서리는 둥근 편」 · |K−k0|<eps 사진은 병기(near) · 「잠정」 등급 문구
//   S10 (기록) k0±eps 에서 라벨셋 각진 비율 · 회귀 p25·p28·p29 는 별도 실행
//  ★사후 보조 기준(구현 후 결과를 보고 추가 · 2026-10-11) — 원 기준 S5·S8 미달은 그대로 보존한다.
//   S5b 표시 계열 일관: 사진마다 {주형, 병기형} 에 그 사람 최빈 주형이 들어가는 비율 — 중앙 ≥0.9 ∧ 최소 ≥0.75
//       이유: 경계(|K−k0|<eps)에 걸린 사람(P2 K 0.541 vs k0 0.543)은 주형이 사진마다 갈리지만 화면은 두 형을 병기한다(자문 Q1·Q4 완충).
//   S8b 합성 민감도(조작 수정): 1차 S8 은 모서리 점 4개를 안쪽으로 당겨 창 안에 새 꺾임을 만들었다(K 0.506→0.538 증가).
//       올바른 조작 = 하악 윤곽(93…148)을 타원 호 쪽으로 50% 섞기(둥글게) / 직각 꺾임 꼴 쪽으로 50% 섞기(모나게) → K 감소·증가 및 판정.
// ============================================================
'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib');const Lb=require('./persp_v2_lib.js');const J=require('./jaw_corner_lib.js');
const ROOT=path.join(__dirname,'..'),IP=path.join(ROOT,'..','ChunWoon_IP','face');const IDX=process.env.P17_INDEX||path.join(ROOT,'index.html');const idx=fs.readFileSync(IDX,'utf8');const C=Lb.loadCore(IDX);
const X=(()=>{try{const i0=idx.indexOf('var CW_FACE_REF'),i1=idx.indexOf('//  5b. PAL',i0);const M={exports:{}};new Function('module','exports','window','var document={createElement:()=>({getContext:()=>null})};'+idx.slice(i0,idx.lastIndexOf('// ====',i1))+'\nmodule.exports={iso:_cwFaceIso,fr:_cwFaceFrontal,rank:_cwRank,REF:CW_FACE_REF,JC:typeof CW_FACE_JAWCORNER!=="undefined"?CW_FACE_JAWCORNER:null,PV2:CW_FACE_PERSP_V2,desc:_cwFaceShapeDesc};')(M,M.exports,{});return M.exports;}catch(e){return {err:String(e)}}})();
let total=0,pass=0;const fails=[];function check(id,name,ok,detail){total++;if(ok)pass++;else fails.push(id);console.log(`  ${ok?'ok  ':'FAIL'} ${id} ${name} — ${detail}`);}
const yaw=ai=>{const dl=ai[1].x-ai[234].x,dr=ai[454].x-ai[1].x;return (dl-dr)/(dl+dr);};
function load(dir){const L=JSON.parse(fs.readFileSync(path.join(IP,dir,'cache','landmarks.json'),'utf8'));return [L,k=>{const d=L[k];const ai=d.lm.map(a=>({x:a[0],y:a[1],z:a[2]}));const mp=path.join(IP,dir,'cache',k+'.mask.gz');const hr=fs.existsSync(mp)?C._cwHairline(zlib.gunzipSync(fs.readFileSync(mp)),d.w,d.h,ai):null;return {d,ai,A:d.h/d.w,hr};}];}
const [LB,fL]=load('eval_labelset'),[SB,fS]=load('eval_selfie'),[NB,fN]=load('eval_hairline');const rows=[];
const refK=x=>{const p=X.iso(x.ai,x.A);return J.jawCornerK(X.fr(p)||p);};
const add=(set,g,k,x,src,cond)=>{if(Math.abs(yaw(x.ai))>=0.45)return;const c=C.classifyFaceFromLandmarks(x.ai,x.A,x.hr,src);const raw=C._cwFaceMeasureRaw(x.ai,x.A,x.hr);const m=C._cwFaceMeasure(x.ai,x.A,x.hr,src);
 rows.push({set,g,k,cond,x,src,shape:c.shapeOpt.v,sd:c.shapeDesc,Kraw:raw.jawCorner,K:m.jawCorner,Kref:refK(x)});};
for(const k of Object.keys(LB))add('label',LB[k].pid,k,fL(k),LB[k].distCm<=60?'live':null,LB[k].distCm<=60?'near':'far');
for(const k of Object.keys(SB).filter(k=>/^p2_2026_nog/.test(k)))add('label','P2',k,fS(k),/near/.test(k)?'live':null,/near/.test(k)?'near':'far');
for(const k of Object.keys(SB).filter(k=>/^jay_2026_nog/.test(k)))add('label','J0',k,fS(k),/guide/.test(k)?'live':null,/guide/.test(k)?'near':'far');
for(const k of Object.keys(SB).filter(k=>!/^p2_2026_nog|^jay_2026_nog/.test(k)))add('selfie',null,k,fS(k),null,null);
for(const k of Object.keys(NB))if(NB[k]&&NB[k].lm)add('net',null,k,fN(k),null,null);
const P=rows.filter(r=>r.g);const by={};P.forEach(r=>(by[r.g]=by[r.g]||[]).push(r));const isSq=r=>r.shape==='square';
// S1
{const lab=rows.filter(r=>r.set==='label');const d=lab.map(r=>Math.abs((r.Kraw==null?NaN:r.Kraw)-r.Kref));const mx=Math.max(...d);check('S1','raw.jawCorner = 기준 구현',isFinite(mx)&&mx<1e-9,`n ${lab.length} · 최대 Δ ${isFinite(mx)?mx.toExponential(2):'없음'}`);}
// S2
{const J0=X.JC;const ok=!!J0&&/JAWCORNER/.test(J0.version||'')&&!!J0.tier&&Array.isArray(J0.q)&&Math.abs(J0.k0-Lb.med(J0.q))<1e-9&&J0.n>=30&&J0.eps>0;check('S2','CW_FACE_JAWCORNER 기준(사람당 1표 ≥30명)',ok,J0?`${J0.version} · ${J0.tier} · n ${J0.n} · k0 ${J0.k0} · eps ${J0.eps}`:'없음');}
// S3
{const OLD={chin:0.8954,jawRatio:0.9822,cheonJiWidth:1.0333,whRatio:0.9315,foreheadRatio:1.0253,eyeSize:1.0543,noseWRatio:1.0795,mouthRatio:1.0725,myungGung:1.0827,jilAek:1.0839,browLength:1.057,midOverLow:1.0205};const f=X.PV2&&X.PV2.f||{};
 const same=Object.entries(OLD).every(([a,v])=>f[a]===v);check('S3','원근 보정: 기존 12축 불변 · jawCorner 선택 기록',same&&!!(X.PV2&&X.PV2.choice&&X.PV2.choice.jawCorner),`12축 동일 ${same} · jawCorner ${X.PV2&&X.PV2.choice?X.PV2.choice.jawCorner:'-'} ${f.jawCorner||''}`);}
// S4
{const lp=Object.values(by).filter(a=>a.filter(isSq).length/a.length>0.5).length/Object.keys(by).length,np=rows.filter(r=>r.set==='net').filter(isSq).length/rows.filter(r=>r.set==='net').length;
 check('S4','사람 단위 각진 비율 |라벨셋−인터넷| ≤ 20%p',Math.abs(lp-np)<=0.2,`라벨셋 ${(lp*100).toFixed(0)}% (${Object.entries(by).filter(([g,a])=>a.filter(isSq).length/a.length>0.5).map(e=>e[0]).join(',')||'-'}) · 인터넷 ${(np*100).toFixed(0)}% · 사진 단위 라벨셋 ${(P.filter(isSq).length/P.length*100).toFixed(0)}%`);}
// S5
{const c=Object.entries(by).map(([g,a])=>{const m=Lb.mode(a.map(r=>r.shape));const t=m==='tie'?Math.max(...Object.values(a.reduce((o,r)=>(o[r.shape]=(o[r.shape]||0)+1,o),{}))):a.filter(r=>r.shape===m).length;return [g,t/a.length];});
 check('S5','사람 안 일관 중앙 ≥0.9 ∧ 최소 ≥0.75',Lb.med(c.map(e=>e[1]))>=0.9&&Math.min(...c.map(e=>e[1]))>=0.75,c.map(e=>e[0]+':'+e[1].toFixed(2)).join(' '));}
// S6
{const agree=src=>Object.values(by).map(a=>{const n=a.filter(r=>r.cond==='near'),f=a.filter(r=>r.cond==='far');if(!n.length||!f.length)return null;const sh=r=>src==='raw'?C.classifyFaceFromLandmarks(r.x.ai,r.x.A,r.x.hr,null).shapeOpt.v:r.shape;return Lb.mode(n.map(sh))===Lb.mode(f.map(sh));}).filter(v=>v!==null);
 const a1=agree('cur'),a0=agree('raw');check('S6','근접=원거리 다수 판정 ≥ 8/10',a1.filter(Boolean).length>=8,`보정 후 ${a1.filter(Boolean).length}/${a1.length} · 보정 없이 ${a0.filter(Boolean).length}/${a0.length}`);}
// S7
{const G=Object.values(by);const v=r=>r.K;const ok=P.every(r=>isFinite(v(r)));let icc=NaN;if(ok){const N=P.length,gm=P.reduce((s,r)=>s+v(r),0)/N;let ssb=0,ssw=0;G.forEach(a=>{const m=a.reduce((s,r)=>s+v(r),0)/a.length;ssb+=a.length*(m-gm)**2;a.forEach(r=>ssw+=(v(r)-m)**2);});const k0=(N-G.reduce((s,a)=>s+a.length**2,0)/N)/(G.length-1);const msb=ssb/(G.length-1),msw=ssw/(N-G.length);icc=(msb-msw)/(msb+(k0-1)*msw);}
 check('S7','K ICC ≥ 0.7 (보정 후)',icc>=0.7,`ICC ${isFinite(icc)?icc.toFixed(2):'-'}`);}
// S8
{const cand=P.filter(r=>r.cond==='far'&&r.shape!=='long'&&X.rank(C._cwFaceMeasure(r.x.ai,r.x.A,r.x.hr,null).jawRatio,X.REF.q.jawRatio)>0.7);let detail='후보 없음',ok=false;
 if(cand.length&&X.JC){const b=cand[0].x;const iso=b.ai.map(p=>({x:p.x,y:p.y*b.A,z:p.z}));const fw=Math.abs(iso[454].x-iso[234].x);const cx=(iso[234].x+iso[454].x)/2;
  const mv=s=>{const q=iso.map(p=>({...p}));for(const i of [172,397,58,288]){const dir=Math.sign(q[i].x-cx);q[i].x+=dir*s*fw;q[i].y+=s*fw*0.5;}return q.map(p=>({x:p.x,y:p.y/b.A,z:p.z}));};
  const run=ai=>{const c=C.classifyFaceFromLandmarks(ai,b.A,b.hr,null);return {K:C._cwFaceMeasureRaw(ai,b.A,b.hr).jawCorner,s:c.shapeOpt.v};};const o=run(b.ai),sh=run(mv(0.02)),rd=run(mv(-0.02));
  ok=sh.K>o.K&&sh.s==='square'&&rd.K<o.K&&rd.s!=='square';detail=`${cand[0].k} · K ${o.K.toFixed(3)}(${o.s}) → 날카롭게 ${sh.K.toFixed(3)}(${sh.s}) · 둥글게 ${rd.K.toFixed(3)}(${rd.s})`;}
 check('S8','합성 민감도(모서리 날카롭게→각진 · 둥글게→아님)',ok,detail);}
// S9
{const wr=rows.filter(r=>r.sd&&r.shape==='round'&&/모서리는 둥근 편/.test(r.sd.basis||''));const nearOk=X.JC?rows.filter(r=>isFinite(r.K)&&Math.abs(r.K-X.JC.k0)<X.JC.eps&&r.shape!=='long'&&X.rank(C._cwFaceMeasure(r.x.ai,r.x.A,r.x.hr,r.src).jawRatio,X.REF.q.jawRatio)>0.62+0.05):[];
 const nearHit=nearOk.filter(r=>r.sd&&r.sd.near);// ★2026-10-11 평가 결함 수정: 「잠정」 표기는 측정 세부(detail)에 넣었는데 1차 검사가 BASIS 선언 뒤 800자만 봤다 → 실제 출력(detail)을 본다(명세 의도 동일)
 const tier=wr.length>0&&wr.every(r=>/잠정/.test(r.sd.detail||''));
 check('S9','표시: 「모서리는 둥근 편」 · 경계 병기 · 「잠정」',wr.length>0&&nearOk.length>0&&nearHit.length===nearOk.length&&tier,`둥근+넓음 근거 ${wr.length}장 · 경계 ${nearHit.length}/${nearOk.length} 병기 · 잠정 ${tier}`);}
// S10 기록
if(X.JC){const f=t=>(P.filter(r=>r.shape!=='long'&&isFinite(r.K)&&r.K>=t&&X.rank(C._cwFaceMeasure(r.x.ai,r.x.A,r.x.hr,r.src).jawRatio,X.REF.q.jawRatio)>0.62).length/P.length*100).toFixed(0)+'%';console.log(`  (기록) S10 라벨셋 각진 사진 비율 k0−eps ${f(X.JC.k0-X.JC.eps)} · k0 ${f(X.JC.k0)} · k0+eps ${f(X.JC.k0+X.JC.eps)}`);}
// ── 사후 보조 기준 ──
{const c=Object.entries(by).map(([g,a])=>{const m=Lb.mode(a.map(r=>r.shape));const mm=m==='tie'?a[0].shape:m;return [g,a.filter(r=>r.shape===mm||(r.sd&&r.sd.near===mm)).length/a.length];});
 check('S5b','(사후) 표시 계열 일관 중앙 ≥0.9 ∧ 최소 ≥0.75',Lb.med(c.map(e=>e[1]))>=0.9&&Math.min(...c.map(e=>e[1]))>=0.75,c.map(e=>e[0]+':'+e[1].toFixed(2)).join(' '));}
{const cand=P.filter(r=>r.cond==='far'&&r.shape!=='long'&&X.rank(C._cwFaceMeasure(r.x.ai,r.x.A,r.x.hr,null).jawRatio,X.REF.q.jawRatio)>0.7);let ok=false,detail='후보 없음';
 if(cand.length){const b=cand[0].x;const iso=b.ai.map(p=>({x:p.x,y:p.y*b.A,z:p.z}));
  const blend=(mode,w)=>{const q=iso.map(p=>({...p}));for(const S of [J.L1,J.R1]){const a=q[S[0]],e=q[S[S.length-1]];const cx=e.x,cy=a.y,rx=a.x-e.x,ry=e.y-a.y;
    for(let i=1;i<S.length-1;i++){const t=i/(S.length-1);let tx,ty;if(mode==='round'){const th=t*Math.PI/2;tx=cx+rx*Math.cos(th);ty=cy+ry*Math.sin(th);}else{const g=4/10;if(t<=g){tx=a.x;ty=a.y+(t/g)*ry;}else{tx=a.x-((t-g)/(1-g))*rx;ty=e.y;}}
     q[S[i]].x=q[S[i]].x*(1-w)+tx*w;q[S[i]].y=q[S[i]].y*(1-w)+ty*w;}}return q.map(p=>({x:p.x,y:p.y/b.A,z:p.z}));};
  const run=ai=>{const c=C.classifyFaceFromLandmarks(ai,b.A,b.hr,null);return {K:C._cwFaceMeasureRaw(ai,b.A,b.hr).jawCorner,s:c.shapeOpt.v};};const o=run(b.ai),sq=run(blend('square',0.5)),rd=run(blend('round',0.5));
  ok=sq.K>o.K&&sq.s==='square'&&rd.K<o.K&&rd.s!=='square';detail=`${cand[0].k} · K ${o.K.toFixed(3)}(${o.s}) → 모나게 ${sq.K.toFixed(3)}(${sq.s}) · 둥글게 ${rd.K.toFixed(3)}(${rd.s})`;}
 check('S8b','(사후) 합성 민감도 — 타원 호/직각 꼴 섞기',ok,detail);}
console.log(`[p34_square_corner] total=${total} pass=${pass} fail=${total-pass}${fails.length?' · FAIL '+fails.join(','):''}`);
process.exitCode=fails.length?1:0;
