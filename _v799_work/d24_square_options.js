// v799 d24 — 각진형 재정의 선택지 시뮬레이션 (d23.json 사용 · 보류 사진 제외됨)
//  A 현행: 긴형 아님 ∧ jr 랭크>0.62 → 각진
//  B K 단독: 긴형 아님 ∧ K ≥ K0 → 각진 (K0 = 실사진 풀 중앙 · 사람 단위 중앙의 중앙)
//  C 결합: 긴형 아님 ∧ jr 랭크>0.62 ∧ K ≥ K0 → 각진 (넓기만 하고 모서리가 둥글면 둥근형 「턱이 넓은 편」)
//  D 표현만: 판정은 현행, 문구를 「턱이 넓은 편 계열」로(각진 이름 대신)
'use strict';
const fs=require('fs'),path=require('path');const Lb=require('./persp_v2_lib.js');
const R=JSON.parse(fs.readFileSync(path.join(__dirname,'d23.json'),'utf8'));
const by={};R.filter(r=>r.g).forEach(r=>(by[r.g]=by[r.g]||[]).push(r));
const perPerson=Object.values(by).map(a=>Lb.med(a.map(r=>r.K)));const netK=R.filter(r=>r.set==='net').map(r=>r.K),selK=R.filter(r=>r.set==='selfie').map(r=>r.K);
const K0=+Lb.med([...perPerson,...netK]).toFixed(3);console.log('K0(라벨셋 사람 10 + 인터넷 23 의 중앙) =',K0,'· 인터넷만',Lb.med(netK).toFixed(3),'· 라벨셋 사람 중앙',Lb.med(perPerson).toFixed(3));
const rule={A:r=>r.shape==='square',B:r=>r.shape!=='long'&&r.K>=K0,C:r=>r.shape==='square'&&r.K>=K0};
for(const [o,f] of Object.entries(rule)){
 const dist=s=>{const q=R.filter(r=>r.set===s);return (q.filter(f).length/q.length*100).toFixed(0)+'%';};
 const cons=Object.entries(by).map(([g,a])=>{const v=a.map(f);const t=v.filter(Boolean).length;return [g,Math.max(t,v.length-t)/v.length,t,v.length];});
 const nf=Object.entries(by).map(([g,a])=>{const n=a.filter(r=>r.cond==='near'),fa=a.filter(r=>r.cond==='far');if(!n.length||!fa.length)return null;const mn=n.filter(f).length/n.length>=0.5,mf=fa.filter(f).length/fa.length>=0.5;return mn===mf;}).filter(x=>x!==null);
 console.log(`${o} 각진 비율 라벨 ${dist('label')} · 셀카 ${dist('selfie')} · 인터넷 ${dist('net')} · 사람 다수 각진 ${cons.filter(c=>c[2]/c[3]>0.5).map(c=>c[0]).join(',')||'-'} · 사람 안 일관 중앙 ${Lb.med(cons.map(c=>c[1])).toFixed(2)} · 근접=원거리 다수 판정 ${nf.filter(Boolean).length}/${nf.length}`);}
console.log('(참고·튜닝 금지) 블라인드 사람 다수결: 6/7 둥근 · 각진 = 06 · 엔진↔사람 만장일치 불일치 01·P2');
