// v799 d16 — 같은 사람 사진 간 점수 편차 진단(종합=조화도 · 눈·코·입 점수) · 성분별 기여
//  자료: 라벨셋 8명(near·rear1x·far) + P2 · 앱과 같은 src 규칙(EXIF 거리 ≤60 → live)
'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib');const L=require('./persp_v2_lib.js');
const ROOT=path.join(__dirname,'..'),IP=path.join(ROOT,'..','ChunWoon_IP','face');const C=L.loadCore(path.join(ROOT,'index.html'));
const LB=JSON.parse(fs.readFileSync(path.join(IP,'eval_labelset','cache','landmarks.json'),'utf8'));
const SB=JSON.parse(fs.readFileSync(path.join(IP,'eval_selfie','cache','landmarks.json'),'utf8'));
function run(dir,L0,k){const d=L0[k],ai=d.lm.map(a=>({x:a[0],y:a[1],z:a[2]}));const hr=C._cwHairline(zlib.gunzipSync(fs.readFileSync(path.join(IP,dir,'cache',k+'.mask.gz'))),d.w,d.h,ai);
 const src=(d.distCm!=null?d.distCm<=60:/near|guide/.test(k))?'live':null;const c=C.classifyFaceFromLandmarks(ai,d.h/d.w,hr,src);
 const hp=c.harmonyParts;return {k,kind:d.kind||(/far/.test(k)?'far':'near'),ov:c.overallScore,eye:c.eyeScore,nose:c.noseScore,mouth:c.mouthScore,sym:hp.symmetry,thi:hp.thirds,ci:hp.cheonI,op:hp.organProp,yaw:yaw(d.lm),pitch:pitch(d.lm)};}
const yaw=lm=>{const dl=lm[1][0]-lm[234][0],dr=lm[454][0]-lm[1][0];return (dl-dr)/(dl+dr);};
const pitch=lm=>{const a=lm[1][1]-lm[168][1],b=lm[152][1]-lm[1][1];return a/(a+b);};
const P={};for(const k of Object.keys(LB))(P[LB[k].pid]=P[LB[k].pid]||[]).push(run('eval_labelset',LB,k));
P.P2=Object.keys(SB).filter(k=>/^p2_2026_nog/.test(k)).map(k=>run('eval_selfie',SB,k));
P.J0=Object.keys(SB).filter(k=>/^jay_2026_nog/.test(k)).map(k=>run('eval_selfie',SB,k));
const rng=a=>Math.max(...a)-Math.min(...a);const sd=a=>{const m=a.reduce((x,y)=>x+y,0)/a.length;return Math.sqrt(a.reduce((x,y)=>x+(y-m)**2,0)/a.length);};
console.log('사람 | 종합(조화도) 범위 [최소~최대] · 같은 조건 안 최대범위 | 눈·코·입 범위 | 성분 범위: 대칭·삼정·천이·오관');
const agg={ov:[],ovIn:[],eye:[],nose:[],mouth:[],sym:[],thi:[],ci:[],op:[]};
for(const [p,a] of Object.entries(P)){const by={};a.forEach(x=>(by[x.kind]=by[x.kind]||[]).push(x));const inMax=Math.max(...Object.values(by).map(g=>rng(g.map(x=>x.ov))));
 for(const f of ['ov','eye','nose','mouth','sym','thi','ci','op'])agg[f].push(rng(a.map(x=>x[f])));agg.ovIn.push(inMax);
 console.log(p.padEnd(3),'|',String(rng(a.map(x=>x.ov))).padStart(2),`[${Math.min(...a.map(x=>x.ov))}~${Math.max(...a.map(x=>x.ov))}]`,'· 같은조건',inMax,'|',['eye','nose','mouth'].map(f=>rng(a.map(x=>x[f]))).join('·'),'|',['sym','thi','ci','op'].map(f=>rng(a.map(x=>x[f])).toFixed(2)).join('·'));}
const med=L.med;console.log('\n중앙: 종합 범위',med(agg.ov),'· 같은 조건 안',med(agg.ovIn),'· 눈',med(agg.eye),'코',med(agg.nose),'입',med(agg.mouth),'· 성분 대칭',med(agg.sym).toFixed(2),'삼정',med(agg.thi).toFixed(2),'천이',med(agg.ci).toFixed(2),'오관',med(agg.op).toFixed(2));
// 종합 점수 변동에 대한 성분 기여(가중치 × 성분 편차) — 사람 안 표준편차 기준
const w={sym:32,thi:32,ci:18,op:18};const contrib={sym:[],thi:[],ci:[],op:[]};
for(const a of Object.values(P))for(const f of Object.keys(w))contrib[f].push(w[f]*sd(a.map(x=>x[f])));
console.log('종합 점수 표준편차 기여(점, 사람 중앙): '+Object.keys(w).map(f=>f+' '+med(contrib[f]).toFixed(1)).join(' · '));
// 대칭·삼정과 고개 각도 상관
const all=Object.values(P).flat();const corr=(x,y)=>{const mx=x.reduce((a,b)=>a+b)/x.length,my=y.reduce((a,b)=>a+b)/y.length;let s=0,sx=0,sy=0;for(let i=0;i<x.length;i++){s+=(x[i]-mx)*(y[i]-my);sx+=(x[i]-mx)**2;sy+=(y[i]-my)**2;}return s/Math.sqrt(sx*sy);};
console.log('상관: 대칭↔|좌우 고개|',corr(all.map(x=>x.sym),all.map(x=>Math.abs(x.yaw))).toFixed(2),'· 삼정↔상하 고개',corr(all.map(x=>x.thi),all.map(x=>x.pitch)).toFixed(2),'· 종합↔|좌우 고개|',corr(all.map(x=>x.ov),all.map(x=>Math.abs(x.yaw))).toFixed(2));
fs.writeFileSync(path.join(__dirname,'d16.json'),JSON.stringify(P));
