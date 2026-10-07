// v799 d14 — 블라인드 평가자 간 일치도 + 엔진 얼굴형(원거리) 대조 · 판정 입력(랭크) 위치
'use strict';
const fs=require('fs'),zlib=require('zlib'),path=require('path');const ROOT=path.join(__dirname,'..'),IP=path.join(ROOT,'..','ChunWoon_IP','face');
const key=JSON.parse(fs.readFileSync(IP+'/eval_labelset/rating_key.json')).key;
const STUB="const FACE_S=[{l:'둥근형',v:'round'},{l:'각진형',v:'square'},{l:'긴형',v:'long'},{l:'역삼각형',v:'inv'}];const FACE_E=[{l:'a',v:'big'}];const FACE_N=[{l:'a',v:'high'}];const FACE_M=[{l:'a',v:'big'}];";
const idx=fs.readFileSync(ROOT+'/index.html','utf8');const i0=idx.indexOf('var CW_FACE_REF'),i1=idx.indexOf('//  5b. PAL',i0);const M={exports:{}};
new Function('module','exports','window',STUB+idx.slice(i0,idx.lastIndexOf('// ====',i1))+'\nmodule.exports={classifyFaceFromLandmarks,_cwHairline,_cwFaceMeasureRaw};')(M,M.exports,{});const C=M.exports;
const lab={round:'둥근형',square:'각진형',long:'긴형',inv:'역삼각형'};const med=a=>{const s=[...a].sort((x,y)=>x-y);return s.length%2?s[(s.length-1)>>1]:(s[s.length/2-1]+s[s.length/2])/2;};
function far(p){const [dir,pfx]=p==='P2'?['eval_selfie','p2_2026_nog_far']:['eval_labelset','lbl_'+p+'_far'];const L=JSON.parse(fs.readFileSync(IP+'/'+dir+'/cache/landmarks.json'));
 return Object.keys(L).filter(k=>k.startsWith(pfx)).sort().map(k=>{const d=L[k],ai=d.lm.map(a=>({x:a[0],y:a[1],z:a[2]}));const hr=C._cwHairline(zlib.gunzipSync(fs.readFileSync(IP+'/'+dir+'/cache/'+k+'.mask.gz')),d.w,d.h,ai);const c=C.classifyFaceFromLandmarks(ai,d.h/d.w,hr,null);return {s:lab[c.shapeOpt.v],jaw:c.ranks.jawRatio,wh:c.ranks.whRatio,cjw:C._cwFaceMeasureRaw(ai,d.h/d.w,hr).cheonJiWidth};});}
const RD=fs.readdirSync(IP+'/images/labelset').filter(f=>/^ratings_.+\.csv$/.test(f)&&f!=='ratings_template.csv');
const R={};for(const f of RD){for(const l of fs.readFileSync(IP+'/images/labelset/'+f,'utf8').replace(/^﻿/,'').trim().split('\n').slice(1)){const [c,r,s,k]=l.split(',');(R[r]=R[r]||{})[c]={s,k:+k};}}
const raters=Object.keys(R),codes=Object.keys(key).sort();
const mode=a=>{const m={};a.forEach(x=>m[x]=(m[x]||0)+1);return Object.entries(m).sort((x,y)=>y[1]-x[1])[0][0];};
console.log('code pid | '+raters.join(' | ')+' | 엔진원거리(다수) | jaw랭크 wh랭크 천지폭');const rows=[];
for(const c of codes){const p=key[c].pid,F=far(p),e=mode(F.map(x=>x.s));rows.push({c,p,e,h:raters.map(r=>R[r][c].s)});
 console.log(c,p.padEnd(3),'|',raters.map(r=>R[r][c].s+'('+R[r][c].k+')').join(' | '),'|',e,'('+F.map(x=>x.s).join(',')+')','|',med(F.map(x=>x.jaw)).toFixed(2),med(F.map(x=>x.wh)).toFixed(2),med(F.map(x=>x.cjw)).toFixed(3));}
function kappa(a,b){const n=a.length,cats=[...new Set([...a,...b])];const po=a.filter((x,i)=>x===b[i]).length/n;let pe=0;for(const k of cats)pe+=(a.filter(x=>x===k).length/n)*(b.filter(x=>x===k).length/n);return {po,k:(po-pe)/(1-pe)};}
for(let i=0;i<raters.length;i++)for(let j=i+1;j<raters.length;j++){const x=kappa(rows.map(r=>r.h[i]),rows.map(r=>r.h[j]));console.log(`평가자 ${raters[i]}↔${raters[j]} 일치 ${(x.po*9).toFixed(0)}/9 · 카파 ${x.k.toFixed(2)}`);}
raters.forEach((r,i)=>{const x=kappa(rows.map(q=>q.h[i]),rows.map(q=>q.e));console.log(`엔진↔${r} 일치 ${Math.round(x.po*9)}/9 · 카파 ${x.k.toFixed(2)}`);});
const cons=rows.filter(r=>r.h.every(h=>h===r.h[0]));console.log(`평가자 전원 일치 ${cons.length}건: `+cons.map(r=>`${r.c}(${r.p}) 사람 ${r.h[0]} · 엔진 ${r.e}${r.h[0]===r.e?' ✓':' ✗'}`).join(' / '));
