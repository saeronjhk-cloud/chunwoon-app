// v799 d23 — 각진형 과다 진단 · 「方」(모남) 새 단서 후보의 재현성
//  현 규칙: jawRatio(하악각 폭/얼굴 폭) 랭크 > 0.62 → 각진. 「폭」은 方(모서리)이 아니다(d14: 사람 둥근 0.92·0.79 vs 각진 0.85).
//  후보(정면화 좌표 · 좌우 평균):
//   G  하악각 — 상행지(234·93·132·58) 직선과 하악체(136·150·149·176) 직선 사이 내각(°). 작을수록 모남.
//   K  꺾임 집중도 — 234→152 윤곽의 회전각 중 하악각 창(132·58·172·136) 몫. 클수록 모서리에 꺾임이 몰림.
//   P  모서리 돌출 — 하악각점(172)이 58–136 현에서 바깥으로 나온 거리 / 얼굴 폭. 클수록 모남(둥글면 현에 가까움).
'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib');const Lb=require('./persp_v2_lib.js');
const ROOT=path.join(__dirname,'..'),IP=path.join(ROOT,'..','ChunWoon_IP','face');const IDX=path.join(ROOT,'index.html');const idx=fs.readFileSync(IDX,'utf8');const C=Lb.loadCore(IDX);
const X=(()=>{const i0=idx.indexOf('var CW_FACE_REF'),i1=idx.indexOf('//  5b. PAL',i0);const M={exports:{}};new Function('module','exports','window','var document={createElement:()=>({getContext:()=>null})};'+idx.slice(i0,idx.lastIndexOf('// ====',i1))+'\nmodule.exports={iso:_cwFaceIso,fr:_cwFaceFrontal,rank:_cwRank,REF:CW_FACE_REF};')(M,M.exports,{});return M.exports;})();
const L1=[234,93,132,58,172,136,150,149,176,148,152],R1=[454,323,361,288,397,365,379,378,400,377,152];
function lineDir(q,ids){const n=ids.length;let mx=0,my=0;ids.forEach(i=>{mx+=q[i].x;my+=q[i].y});mx/=n;my/=n;let sxx=0,syy=0,sxy=0;ids.forEach(i=>{const a=q[i].x-mx,b=q[i].y-my;sxx+=a*a;syy+=b*b;sxy+=a*b});const t=0.5*Math.atan2(2*sxy,sxx-syy);return [Math.cos(t),Math.sin(t)];}
function side(q,S,fw){const up=lineDir(q,[S[0],S[1],S[2],S[3]]),lo=lineDir(q,[S[5],S[6],S[7],S[8]]);
 // 방향 정렬: up 은 위→아래(234→58), lo 는 하악각→턱(136→176)
 const u=[q[S[3]].x-q[S[0]].x,q[S[3]].y-q[S[0]].y],l=[q[S[8]].x-q[S[5]].x,q[S[8]].y-q[S[5]].y];const sg=(d,v)=>(d[0]*v[0]+d[1]*v[1])<0?[-d[0],-d[1]]:d;const a=sg(up,u),b=sg(lo,l);
 const G=180-Math.acos(Math.max(-1,Math.min(1,a[0]*b[0]+a[1]*b[1])))*180/Math.PI;   // 내각: 꺾임 0 이면 180
 let tot=0,win=0;for(let i=1;i<S.length-1;i++){const p0=q[S[i-1]],p1=q[S[i]],p2=q[S[i+1]];const v1=[p1.x-p0.x,p1.y-p0.y],v2=[p2.x-p1.x,p2.y-p1.y];const t=Math.abs(Math.atan2(v1[0]*v2[1]-v1[1]*v2[0],v1[0]*v2[0]+v1[1]*v2[1]));tot+=t;if([132,58,172,136,361,288,397,365].includes(S[i]))win+=t;}
 const A=q[S[3]],B=q[S[5]],Pt=q[S[4]];const cx=B.x-A.x,cy=B.y-A.y,cl=Math.hypot(cx,cy)||1e-9;const mid={x:(q[S[0]].x+q[152].x)/2,y:(q[S[0]].y+q[152].y)/2};
 let d=((Pt.x-A.x)*cy-(Pt.y-A.y)*cx)/cl;const dm=((mid.x-A.x)*cy-(mid.y-A.y)*cx)/cl;if(Math.sign(d)===Math.sign(dm))d=-d;   // 바깥(얼굴 중심 반대쪽)을 + 로
 return {G,K:win/(tot||1e-9),P:-d/fw};}
function cues(ai,A){const p=X.iso(ai,A);const q=X.fr(p)||p;const fw=Math.hypot(q[454].x-q[234].x,q[454].y-q[234].y);const l=side(q,L1,fw),r=side(q,R1,fw);return {G:(l.G+r.G)/2,K:(l.K+r.K)/2,P:(l.P+r.P)/2,dG:Math.abs(l.G-r.G)};}
const yaw=ai=>{const dl=ai[1].x-ai[234].x,dr=ai[454].x-ai[1].x;return (dl-dr)/(dl+dr);};
function load(dir){const L=JSON.parse(fs.readFileSync(path.join(IP,dir,'cache','landmarks.json'),'utf8'));return [L,k=>{const d=L[k];const ai=d.lm.map(a=>({x:a[0],y:a[1],z:a[2]}));const mp=path.join(IP,dir,'cache',k+'.mask.gz');const hr=fs.existsSync(mp)?C._cwHairline(zlib.gunzipSync(fs.readFileSync(mp)),d.w,d.h,ai):null;return {d,ai,A:d.h/d.w,hr};}];}
const [LB,fL]=load('eval_labelset'),[SB,fS]=load('eval_selfie'),[NB,fN]=load('eval_hairline');const rows=[];
const add=(set,g,k,x,src,cond)=>{if(Math.abs(yaw(x.ai))>=0.45)return;const c=C.classifyFaceFromLandmarks(x.ai,x.A,x.hr,src);const m=C._cwFaceMeasure(x.ai,x.A,x.hr,src);rows.push({set,g,k,cond,shape:c.shapeOpt.v,jr:m.jawRatio,jrk:X.rank(m.jawRatio,X.REF.q.jawRatio),...cues(x.ai,x.A)});};
for(const k of Object.keys(LB))add('label',LB[k].pid,k,fL(k),LB[k].distCm<=60?'live':null,LB[k].distCm<=60?'near':'far');
for(const k of Object.keys(SB).filter(k=>/^p2_2026_nog/.test(k)))add('label','P2',k,fS(k),/near/.test(k)?'live':null,/near/.test(k)?'near':'far');
for(const k of Object.keys(SB).filter(k=>/^jay_2026_nog/.test(k)))add('label','J0',k,fS(k),/guide/.test(k)?'live':null,/guide/.test(k)?'near':'far');
for(const k of Object.keys(SB).filter(k=>!/^p2_2026_nog|^jay_2026_nog/.test(k)))add('selfie',null,k,fS(k),null,null);
for(const k of Object.keys(NB))if(NB[k]&&NB[k].lm)add('net',null,k,fN(k),null,null);
const cnt=a=>{const o={};a.forEach(v=>o[v]=(o[v]||0)+1);return o;};
console.log('① 현 규칙 분포 —',['label','selfie','net'].map(s=>s+' '+JSON.stringify(cnt(rows.filter(r=>r.set===s).map(r=>r.shape)))).join(' · '));
const P=rows.filter(r=>r.g);const by={};P.forEach(r=>(by[r.g]=by[r.g]||[]).push(r));
console.log('① 사람별 현 판정(최빈/장수) ·',Object.entries(by).map(([g,a])=>{const m=Lb.mode(a.map(r=>r.shape));return g+':'+m+' '+a.filter(r=>r.shape===m).length+'/'+a.length+' jr랭크 '+Lb.med(a.map(r=>r.jrk)).toFixed(2);}).join(' · '));
// ② 재현성: 1원 ICC(1) = (MSB−MSW)/(MSB+(k−1)MSW) · 근접−원거리 평균차(사람 안 짝, 사람간 SD 대비)
function icc(key){const G=Object.values(by);const N=G.reduce((s,a)=>s+a.length,0),gm=P.reduce((s,r)=>s+r[key],0)/N;let ssb=0,ssw=0;G.forEach(a=>{const m=a.reduce((s,r)=>s+r[key],0)/a.length;ssb+=a.length*(m-gm)**2;a.forEach(r=>ssw+=(r[key]-m)**2);});const k0=(N-G.reduce((s,a)=>s+a.length**2,0)/N)/(G.length-1);const msb=ssb/(G.length-1),msw=ssw/(N-G.length);return (msb-msw)/(msb+(k0-1)*msw);}
function nf(key){const d=[];Object.values(by).forEach(a=>{const n=a.filter(r=>r.cond==='near'),f=a.filter(r=>r.cond==='far');if(n.length&&f.length)d.push(n.reduce((s,r)=>s+r[key],0)/n.length-f.reduce((s,r)=>s+r[key],0)/f.length);});const pm=Object.values(by).map(a=>a.reduce((s,r)=>s+r[key],0)/a.length);const m=pm.reduce((a,b)=>a+b)/pm.length,sd=Math.sqrt(pm.reduce((s,x)=>s+(x-m)**2,0)/(pm.length-1));return {d:d.reduce((a,b)=>a+b,0)/d.length,rel:(d.reduce((a,b)=>a+b,0)/d.length)/sd,sd};}
const cr=(x,y)=>{const mx=x.reduce((a,b)=>a+b)/x.length,my=y.reduce((a,b)=>a+b)/y.length;let s=0,sx=0,sy=0;for(let i=0;i<x.length;i++){s+=(x[i]-mx)*(y[i]-my);sx+=(x[i]-mx)**2;sy+=(y[i]-my)**2;}return s/Math.sqrt(sx*sy);};
for(const key of ['jr','G','K','P','dG']){const v=nf(key);console.log(`② ${key.padEnd(2)} ICC ${icc(key).toFixed(2)} · 근접−원거리 ${v.d.toFixed(4)} (사람간 SD 의 ${(v.rel*100).toFixed(0)}%) · 사람간 SD ${v.sd.toFixed(4)} · 상관(jr) ${cr(P.map(r=>r.jr),P.map(r=>r[key])).toFixed(2)}`);}
console.log('③ 사람별 평균 G/K/P ·',Object.entries(by).map(([g,a])=>`${g}:${(a.reduce((s,r)=>s+r.G,0)/a.length).toFixed(1)}°/${(a.reduce((s,r)=>s+r.K,0)/a.length).toFixed(2)}/${(a.reduce((s,r)=>s+r.P,0)/a.length*100).toFixed(2)}`).join(' · '));
const all=rows.map(r=>r.G);console.log('③ G 분포(전체) 중앙',Lb.med(all).toFixed(1),'· 범위',Math.min(...all).toFixed(1),'~',Math.max(...all).toFixed(1));
fs.writeFileSync(path.join(__dirname,'d23.json'),JSON.stringify(rows));
