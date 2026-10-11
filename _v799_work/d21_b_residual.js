// v799 d21 — B안 적용 후 남은 「보임−가림」 차와 순위 변화의 분해 (p32 G4·G8·G9 진단)
'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib'),os=require('os'),cp=require('child_process');const Lb=require('./persp_v2_lib.js');
const ROOT=path.join(__dirname,'..'),IP=path.join(ROOT,'..','ChunWoon_IP','face');const C=Lb.loadCore(path.join(ROOT,'index.html'));
const bp=path.join(os.tmpdir(),'d21_base.html');fs.writeFileSync(bp,cp.execSync('git show c3b8eb3:index.html',{cwd:ROOT,maxBuffer:64<<20}));const C0=Lb.loadCore(bp);
const yaw=lm=>{const dl=lm[1][0]-lm[234][0],dr=lm[454][0]-lm[1][0];return (dl-dr)/(dl+dr);};
function load(dir){const L=JSON.parse(fs.readFileSync(path.join(IP,dir,'cache','landmarks.json'),'utf8'));return [L,k=>{const d=L[k];const ai=d.lm.map(a=>({x:a[0],y:a[1],z:a[2]}));const mp=path.join(IP,dir,'cache',k+'.mask.gz');const hr=fs.existsSync(mp)?C._cwHairline(zlib.gunzipSync(fs.readFileSync(mp)),d.w,d.h,ai):null;return {d,ai,A:d.h/d.w,hr};}];}
const [LB,fL]=load('eval_labelset'),[SB,fS]=load('eval_selfie'),[NB,fN]=load('eval_hairline');const rows=[];
function add(set,g,k,x,src){const c=C.classifyFaceFromLandmarks(x.ai,x.A,x.hr,src),c0=C0.classifyFaceFromLandmarks(x.ai,x.A,x.hr,src);const c0n=C0.classifyFaceFromLandmarks(x.ai,x.A,null,src);const raw=C._cwFaceMeasureRaw(x.ai,x.A,x.hr);
 rows.push({set,g,k,vis:raw.thirdsParts===3,ov:c.overallScore,ov0:c0.overallScore,ov0n:c0n.overallScore,hp:c.harmonyParts,yaw:Math.abs(yaw(x.d.lm))});}
for(const k of Object.keys(LB))add('label',LB[k].pid,k,fL(k),LB[k].distCm<=60?'live':null);
for(const k of Object.keys(SB).filter(k=>/^p2_2026_nog/.test(k)))add('label','P2',k,fS(k),/near/.test(k)?'live':null);
for(const k of Object.keys(SB).filter(k=>/^jay_2026_nog/.test(k)))add('label','J0',k,fS(k),/guide/.test(k)?'live':null);
for(const k of Object.keys(SB))add('selfie',null,k,fS(k),null);
for(const k of Object.keys(NB))if(NB[k]&&NB[k].lm)add('net',null,k,fN(k),null);
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:NaN,f=v=>isFinite(v)?v.toFixed(2):'-';
// ① 같은 사진에서 「수리 전 코어 + 머리선 없음」(= 2분 공식) vs B안 — 차이가 0 에 가까우면 B안 = 기존 2분 공식 그대로
console.log('① B안 − (수리 전 코어·머리선 제거) 평균 |차|:',f(mean(rows.map(r=>Math.abs(r.ov-r.ov0n)))),'최대',Math.max(...rows.map(r=>Math.abs(r.ov-r.ov0n))));
// ② 보임−가림 차를 항목별로 분해(사람 안)
const parts=['symmetry','thirds','cheonI','organProp'],W={symmetry:32,thirds:32,cheonI:18,organProp:18};
const by={};rows.filter(r=>r.g).forEach(r=>(by[r.g]=by[r.g]||[]).push(r));
for(const [g,a] of Object.entries(by)){const v=a.filter(r=>r.vis),h=a.filter(r=>!r.vis);if(!v.length||!h.length)continue;
 console.log(`② ${g} 보임 ${v.length} · 가림 ${h.length} · 종합 차 ${f(mean(v.map(r=>r.ov))-mean(h.map(r=>r.ov)))} = `+parts.map(p=>p+' '+f(W[p]*(mean(v.map(r=>r.hp[p]))-mean(h.map(r=>r.hp[p]))))).join(' · ')+` · |yaw| 보임 ${f(mean(v.map(r=>r.yaw)))} 가림 ${f(mean(h.map(r=>r.yaw)))}`);
 console.log('    보임:',v.map(r=>r.k+' '+r.ov).join(', '),' | 가림:',h.map(r=>r.k+' '+r.ov).join(', '));}
{const q=rows.filter(r=>r.set==='selfie'),v=q.filter(r=>r.vis),h=q.filter(r=>!r.vis);console.log(`② 셀카 보임 ${v.length} 가림 ${h.length} · 차 ${f(mean(v.map(r=>r.ov))-mean(h.map(r=>r.ov)))} = `+parts.map(p=>p+' '+f(W[p]*(mean(v.map(r=>r.hp[p]))-mean(h.map(r=>r.hp[p]))))).join(' · '));
 const grp=k=>k.replace(/_\d+$/,'').replace(/_(near|far|guide)$/,'');const gs={};q.forEach(r=>(gs[grp(r.k)]=gs[grp(r.k)]||[]).push(r));console.log('    셀카 묶음별 보임/가림 장수:',Object.entries(gs).map(([g,a])=>g+' '+a.filter(r=>r.vis).length+'/'+a.filter(r=>!r.vis).length).join(' · '));}
// ③ 순위 변화: 가림 사진만 / 보임 사진만의 Spearman
const sp=(x,y)=>{const rk=a=>{const s=a.map((v,i)=>[v,i]).sort((p,q)=>p[0]-q[0]);const r=new Array(a.length);let i=0;while(i<s.length){let j=i;while(j+1<s.length&&s[j+1][0]===s[i][0])j++;for(let t=i;t<=j;t++)r[s[t][1]]=(i+j)/2;i=j+1;}return r;};const a=rk(x),b=rk(y),ma=mean(a),mb=mean(b);let s=0,sa=0,sb=0;for(let i=0;i<a.length;i++){s+=(a[i]-ma)*(b[i]-mb);sa+=(a[i]-ma)**2;sb+=(b[i]-mb)**2;}return s/Math.sqrt(sa*sb);};
for(const [n,q] of [['전체',rows],['가림만',rows.filter(r=>!r.vis)],['보임만',rows.filter(r=>r.vis)]])console.log(`③ ρ(수리 전, B) ${n} n ${q.length}: ${f(sp(q.map(r=>r.ov0),q.map(r=>r.ov)))} · 평균 이동 ${f(mean(q.map(r=>r.ov-r.ov0)))}`);
console.log('③ 수리 전 점수 분산 원천: 전체 ρ(수리 전 점수, 보임 여부)',f(sp(rows.map(r=>r.ov0),rows.map(r=>r.vis?1:0))),'· B안',f(sp(rows.map(r=>r.ov),rows.map(r=>r.vis?1:0))));
// ④ p30 F3 악화(−0.19 → −0.38) 원인: 기울기(고개 영향의 크기)가 커졌나, 다른 잡음이 줄어 상관만 커졌나
{const q=rows.filter(r=>r.g);const sl=(x,y)=>{const mx=mean(x),my=mean(y);let s=0,sx=0;for(let i=0;i<x.length;i++){s+=(x[i]-mx)*(y[i]-my);sx+=(x[i]-mx)**2;}return s/sx;};const sd=a=>{const m=mean(a);return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/(a.length-1));};
 const Y=q.map(r=>r.yaw);console.log(`④ 라벨셋+P2+J0 n ${q.length} · 종합~|yaw| 기울기 수리 전 ${f(sl(Y,q.map(r=>r.ov0)))} → B ${f(sl(Y,q.map(r=>r.ov)))} (점/단위) · 종합 표준편차 ${f(sd(q.map(r=>r.ov0)))} → ${f(sd(q.map(r=>r.ov)))}`);}
{const cr=(x,y)=>{const mx=mean(x),my=mean(y);let s=0,sx=0,sy=0;for(let i=0;i<x.length;i++){s+=(x[i]-mx)*(y[i]-my);sx+=(x[i]-mx)**2;sy+=(y[i]-my)**2;}return s/Math.sqrt(sx*sy);};
 for(const [n,q] of [['전체',rows.filter(r=>r.g)],['|yaw|<0.45',rows.filter(r=>r.g&&r.yaw<0.45)]])console.log(`④ ${n} n ${q.length} · 상관(종합,|yaw|) 수리 전 ${f(cr(q.map(r=>r.ov0),q.map(r=>r.yaw)))} → B ${f(cr(q.map(r=>r.ov),q.map(r=>r.yaw)))} · 상관(보임,|yaw|) ${f(cr(q.map(r=>r.vis?1:0),q.map(r=>r.yaw)))}`);}
