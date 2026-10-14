// v800 P-800-A — 모서리 꺾임 K 의 실사진 기준표 생성기(★유일한 생성 경로 · 손수정 금지) → fixtures/jawcorner_ref.json
//  풀 = 사람당 1표: 라벨셋 사람별 「원거리」 사진 K 중앙(01·J0 같은 사람 → 한 표 · 원근 영향 없는 사진만) + 인터넷 23명(각 1장)
//  q = 21 분위(0·5·…·100%) · k0 = 중앙(q[10]) · eps = 원근 보정 뒤 같은 사람 안 K 표준편차 중앙(측정 잡음 1σ · 자문 결과 §결정 3)
//  node _v799_work/d25_gen_jawcorner_ref.js   (d15 로 jawCorner 계수를 만든 뒤 한 번 더 돌려 eps 를 확정)
'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib');const Lb=require('./persp_v2_lib.js');
const ROOT=path.join(__dirname,'..'),IP=path.join(ROOT,'..','ChunWoon_IP','face');const C=Lb.loadCore(path.join(ROOT,'index.html'));
const yaw=ai=>{const dl=ai[1].x-ai[234].x,dr=ai[454].x-ai[1].x;return (dl-dr)/(dl+dr);};
const P=Lb.loadPeople(C,IP);const grp={};for(const p of P){(grp[p.grp]=grp[p.grp]||[]).push(...p.far.filter(x=>Math.abs(yaw(x.ai))<0.45).map(x=>x.raw.jawCorner));}
const labelVotes=Object.entries(grp).map(([g,a])=>[g,Lb.med(a)]);
const NB=JSON.parse(fs.readFileSync(path.join(IP,'eval_hairline','cache','landmarks.json'),'utf8'));const netVotes=[];
for(const k of Object.keys(NB)){const d=NB[k];if(!d||!d.lm)continue;const ai=d.lm.map(a=>({x:a[0],y:a[1],z:a[2]}));if(Math.abs(yaw(ai))>=0.45)continue;netVotes.push([k,C._cwFaceMeasureRaw(ai,d.h/d.w,null).jawCorner]);}
const pool=[...labelVotes.map(v=>v[1]),...netVotes.map(v=>v[1])].sort((a,b)=>a-b);
const q=[];for(let i=0;i<=20;i++)q.push(+pool[Math.min(pool.length-1,Math.round(i/20*(pool.length-1)))].toFixed(6));
// eps: 근접은 현재 앱 보정표(CW_FACE_PERSP.f.jawCorner 가 있으면 그 값) 적용 · 같은 사람 안 표준편차 중앙
const f=C.CW_FACE_PERSP.f.jawCorner||1;const sds=Object.entries(grp).map(([g])=>{const ps=P.filter(p=>p.grp===g);const v=[];ps.forEach(p=>{p.near.forEach(x=>{if(Math.abs(yaw(x.ai))<0.45)v.push(x.raw.jawCorner/f)});p.far.forEach(x=>{if(Math.abs(yaw(x.ai))<0.45)v.push(x.raw.jawCorner)});});const m=v.reduce((a,b)=>a+b,0)/v.length;return Math.sqrt(v.reduce((s,x)=>s+(x-m)**2,0)/(v.length-1));});
const out={version:'JAWCORNER-REF-v2-JS-20261014',tier:'D-REAL(사람당 1표 · 라벨셋 '+labelVotes.length+'명 원거리 + 인터넷 '+netVotes.length+'명)',n:pool.length,q,k0:q[10],eps:+Lb.med(sds).toFixed(4),perspF:f,votes:{label:labelVotes,net:netVotes.map(v=>[v[0],+v[1].toFixed(4)])}};
fs.writeFileSync(path.join(__dirname,'fixtures','jawcorner_ref.json'),JSON.stringify(out,null,1));
console.log(out.version,'·',out.tier,'· n',out.n,'· k0',out.k0,'· eps',out.eps,'(보정계수',f,') · 사람별 표준편차',sds.map(v=>v.toFixed(3)).join(' '));
console.log('라벨셋 표:',labelVotes.map(v=>v[0]+' '+v[1].toFixed(3)).join(' · '));
