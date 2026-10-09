// v799 원근 보정 v2 생성기 — 사람 10묶음(9명) 전체로 축별 선택·계수 → fixtures/persp_v2.json
//  node _v799_work/d15_gen_persp_v2.js   (계수 손수정 금지 · 이 생성기만 쓴다)
'use strict';
const path=require('path'),fs=require('fs');const L=require('./persp_v2_lib.js');
const ROOT=path.join(__dirname,'..'),IP=path.join(ROOT,'..','ChunWoon_IP','face');
const C=L.loadCore(path.join(ROOT,'index.html'));const P=L.loadPeople(C,IP);const s=L.select(C,P);
const out={version:'PERSP-v2-20261009',basis:'empirical-near-front(34~54cm)/far-rear3x(101~114cm) · 9명 · 축별 LOPO 선택(v1 기하 모형 vs 경험)',dEff:null,dFar:null,f:s.f,choice:s.choice};
fs.writeFileSync(path.join(__dirname,'fixtures','persp_v2.json'),JSON.stringify(out,null,1));
for(const [a,d] of Object.entries(s.detail))console.log(a.padEnd(14),'선택',s.choice[a].padEnd(5),'v1/무',d.base.toFixed(4),'경험',d.emp.toFixed(4),'LOPO랭크오차',(d.errBase).toFixed(3),'→',d.errEmp.toFixed(3),'개선비율',d.win.toFixed(2));
console.log(JSON.stringify(out.f));
