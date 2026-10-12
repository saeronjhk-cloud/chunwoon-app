// v801 d27 — 같은 사람 안 종합 점수 흔들림(SD 1.7점)의 원천 분해 (P-801-A Q3 = B, 제이 결정). ★수치 변경 없음.
// ① 흔들림 분해: 같은 조건 연속 촬영(사람×거리 묶음) 잡음 vs 조건 간 차이
// ② 항목별 몫 ③ 촬영 요인(거리·|yaw|·고개 상하·입 벌림·미소·눈썹) 상관과 설명력 ④ 사람별 극단 사진
'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib');const Lb=require('./persp_v2_lib.js');
const ROOT=path.join(__dirname,'..'),IP=path.join(ROOT,'..','ChunWoon_IP','face');const C=Lb.loadCore(path.join(ROOT,'index.html'));
function load(dir){const L=JSON.parse(fs.readFileSync(path.join(IP,dir,'cache','landmarks.json'),'utf8'));return [L,k=>{const d=L[k];const ai=d.lm.map(a=>({x:a[0],y:a[1],z:a[2]}));const mp=path.join(IP,dir,'cache',k+'.mask.gz');const hr=fs.existsSync(mp)?C._cwHairline(zlib.gunzipSync(fs.readFileSync(mp)),d.w,d.h,ai):null;return {d,ai,A:d.h/d.w,hr};}];}
const [LB,fL]=load('eval_labelset'),[SB,fS]=load('eval_selfie');const rows=[];
const P=['symmetry','thirds','cheonI','organProp'],W={symmetry:32,thirds:32,cheonI:18,organProp:18};
function feats(d){const w=d.w,h=d.h,p=d.lm.map(a=>[a[0]*w,a[1]*h,(a[2]||0)*w]);const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],nr=a=>{const l=Math.hypot(...a);return a.map(v=>v/l);};
 const ex=nr(sub(p[454],p[234])),u=sub(p[10],p[152]),k=dot(u,ex),ey=nr([u[0]-k*ex[0],u[1]-k*ex[1],u[2]-k*ex[2]]),ez=[ex[1]*ey[2]-ex[2]*ey[1],ex[2]*ey[0]-ex[0]*ey[2],ex[0]*ey[1]-ex[1]*ey[0]];
 const fh=Math.hypot(...sub(p[10],p[152])),fw=Math.hypot(...sub(p[454],p[234]));const dl=p[1][0]-p[234][0],dr=p[454][0]-p[1][0];
 return {yaw:Math.abs((dl-dr)/(dl+dr)),pitch:Math.asin(ez[1]),roll:Math.abs(Math.atan2(p[454][1]-p[234][1],p[454][0]-p[234][0])),mouthOpen:Math.hypot(...sub(p[13],p[14]))/fh,smile:Math.hypot(...sub(p[61],p[291]))/fw,brow:(Math.hypot(...sub(p[105],p[159]))+Math.hypot(...sub(p[334],p[386])))/2/fh};}
function add(g,cond,k,x,src){const c=C.classifyFaceFromLandmarks(x.ai,x.A,x.hr,src);if(c.pose&&c.pose.held)return;rows.push({g,cond,k,ov:c.overallScore,ovRaw:100*P.reduce((s,p)=>s+W[p]/100*c.harmonyParts[p],0),hp:c.harmonyParts,f:feats(x.d)});}
for(const k of Object.keys(LB))add(LB[k].pid,LB[k].kind,k,fL(k),LB[k].distCm<=60?'live':null);
for(const k of Object.keys(SB).filter(k=>/^p2_2026_nog/.test(k)))add('P2',/near/.test(k)?'near':'far',k,fS(k),/near/.test(k)?'live':null);
for(const k of Object.keys(SB).filter(k=>/^jay_2026_nog/.test(k)))add('J0',/guide/.test(k)?'near':'far',k,fS(k),/guide/.test(k)?'live':null);
const mean=a=>a.reduce((x,y)=>x+y,0)/a.length,f=(v,d=2)=>isFinite(v)?v.toFixed(d):'-';
const corr=(x,y)=>{const mx=mean(x),my=mean(y);let s=0,sx=0,sy=0;for(let i=0;i<x.length;i++){s+=(x[i]-mx)*(y[i]-my);sx+=(x[i]-mx)**2;sy+=(y[i]-my)**2;}return s/Math.sqrt(sx*sy);};
const grp=(a,key)=>{const o={};a.forEach(r=>(o[key(r)]=o[key(r)]||[]).push(r));return o;};
// 사람 안 편차(사람 평균을 뺀 값)
const byP=grp(rows,r=>r.g);for(const a of Object.values(byP)){const m=mean(a.map(r=>r.ovRaw));const mp={};P.forEach(p=>mp[p]=mean(a.map(r=>r.hp[p])));const mf={};Object.keys(a[0].f).forEach(k=>mf[k]=mean(a.map(r=>r.f[k])));
 a.forEach(r=>{r.dv=r.ovRaw-m;r.dp={};P.forEach(p=>r.dp[p]=W[p]*(r.hp[p]-mp[p]));r.df={};Object.keys(r.f).forEach(k=>r.df[k]=r.f[k]-mf[k]);});}
const ssW=rows.reduce((s,r)=>s+r.dv**2,0),dfW=rows.length-Object.keys(byP).length;
console.log(`사진 ${rows.length}장 · ${Object.keys(byP).length}명 · 사람 안 SD(반올림 전 점수) ${f(Math.sqrt(ssW/dfW))}점`);
// ① 같은 조건 묶음 안(연속 촬영 = 순수 계측 잡음) vs 조건 간
{const byPC=grp(rows,r=>r.g+'|'+r.cond);let ss=0,n=0,k=0;for(const a of Object.values(byPC)){const m=mean(a.map(r=>r.ovRaw));a.forEach(r=>ss+=(r.ovRaw-m)**2);n+=a.length;k++;}
 const sdIn=Math.sqrt(ss/(n-k)),ssB=ssW-ss;console.log(`① 같은 사람·같은 거리 묶음 안 SD ${f(sdIn)}점 (묶음 ${k}개) · 사람 안 제곱합 중 묶음 안 몫 ${f(100*ss/ssW,0)}% · 거리 조건 간 몫 ${f(100*ssB/ssW,0)}%`);
 for(const p of P){let s2=0,t2=0;for(const a of Object.values(byPC)){const m=mean(a.map(r=>r.dp[p]));a.forEach(r=>s2+=(r.dp[p]-m)**2);}rows.forEach(r=>t2+=r.dp[p]**2);console.log(`   ${p.padEnd(9)} 사람 안 SD ${f(Math.sqrt(t2/dfW))}점 · 그중 묶음 안 몫 ${f(100*s2/t2,0)}%`);}
 const cm={};rows.forEach(r=>(cm[r.cond]=cm[r.cond]||[]).push(r.dv));console.log('   거리 조건별 사람 안 편차 평균: '+Object.entries(cm).map(([c,a])=>`${c} ${f(mean(a))} (n ${a.length})`).join(' · '));}
// ② 항목별 몫
{const dv=rows.map(r=>r.dv),vv=dv.reduce((s,x)=>s+x*x,0);console.log('② 사람 안 분산 기여: '+P.map(p=>{let c=0;rows.forEach(r=>c+=r.dp[p]*r.dv);return `${p} ${f(100*c/vv,0)}%`;}).join(' · '));}
// ③ 촬영 요인 상관 (사람 안 편차끼리)
const FK=Object.keys(rows[0].f);
console.log('③ 촬영 요인(사람 안 편차) 상관 — 행: 요인 / 열: 종합·'+P.join('·'));
for(const k of FK){const x=rows.map(r=>r.df[k]);console.log(`   ${k.padEnd(9)} 사람 안 SD ${f(Math.sqrt(x.reduce((s,v)=>s+v*v,0)/dfW),4)} · 종합 ${f(corr(x,rows.map(r=>r.dv)))} · `+P.map(p=>f(corr(x,rows.map(r=>r.dp[p])))).join(' · '));}
// 다중 회귀 R² (최소제곱, 정규방정식)
function ols(X,y){const n=X.length,m=X[0].length;const A=Array.from({length:m},()=>new Array(m+1).fill(0));for(let i=0;i<n;i++)for(let a=0;a<m;a++){for(let b=0;b<m;b++)A[a][b]+=X[i][a]*X[i][b];A[a][m]+=X[i][a]*y[i];}
 for(let c=0;c<m;c++){let pv=c;for(let r=c+1;r<m;r++)if(Math.abs(A[r][c])>Math.abs(A[pv][c]))pv=r;[A[c],A[pv]]=[A[pv],A[c]];for(let r=0;r<m;r++)if(r!==c){const t=A[r][c]/A[c][c];for(let q=c;q<=m;q++)A[r][q]-=t*A[c][q];}}
 const b=A.map((r,i)=>r[m]/r[i]);const yh=X.map(x=>x.reduce((s,v,i)=>s+v*b[i],0));const ym=mean(y);return 1-y.reduce((s,v,i)=>s+(v-yh[i])**2,0)/y.reduce((s,v)=>s+(v-ym)**2,0);}
{const X=rows.map(r=>FK.map(k=>r.df[k]));console.log(`   요인 ${FK.length}개 다중 회귀 R²: 종합 ${f(ols(X,rows.map(r=>r.dv)))} · `+P.map(p=>`${p} ${f(ols(X,rows.map(r=>r.dp[p])))}`).join(' · ')+` (n ${rows.length} · 과적합 주의)`);
 for(const k of FK){const X1=rows.map(r=>[r.df[k]]);}}
// ④ 사람별 최저·최고 사진과 그 차이의 항목 분해
console.log('④ 사람별 최고−최저 사진 차이 분해');
for(const [g,a] of Object.entries(byP)){const s=[...a].sort((x,y)=>x.ovRaw-y.ovRaw),lo=s[0],hi=s[s.length-1];
 console.log(`   ${g.padEnd(3)} ${f(hi.ovRaw-lo.ovRaw,1)}점 = `+P.map(p=>`${p.slice(0,4)} ${f(hi.dp[p]-lo.dp[p],1)}`).join(' ')+`  | 최저 ${lo.k}(${lo.cond}) · 최고 ${hi.k}(${hi.cond})`);}
