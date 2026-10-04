// v797 P-797-B 진단 — 코어 _cwGlassesScore 로 평가셋 점수 덤프(임계 산출: 셀카셋만 학습, 인터넷 셋은 확인용)
'use strict';const fs=require('fs'),path=require('path'),zlib=require('zlib');
const ROOT=path.join(__dirname,'..'),EV=path.join(ROOT,'..','ChunWoon_IP','face','eval_selfie');
const STUB="const FACE_S=[{l:'a',v:'round'}];const FACE_E=[{l:'a',v:'big'}];const FACE_N=[{l:'a',v:'high'}];const FACE_M=[{l:'a',v:'big'}];";
const SRC=fs.readFileSync(path.join(ROOT,'_v786_diag','face_core_v786.js'),'utf8');
const M={exports:{}};new Function('module','exports','window',STUB+SRC.replace('__REF__','{"version":"tmp","tier":"tmp","q":{}}')+'\nmodule.exports={_cwGlassesScore};')(M,M.exports,undefined);
const GT=JSON.parse(fs.readFileSync(path.join(EV,'gray','glasses_gt.json'),'utf8')).gt;
const LS=JSON.parse(fs.readFileSync(path.join(EV,'cache','landmarks.json'),'utf8')),LH=JSON.parse(fs.readFileSync(path.join(EV,'gray','hl_landmarks.json'),'utf8'));
const rows=[];for(const [k,g] of Object.entries(GT)){const L=k.startsWith('hl_')?LH[k.slice(3)]:LS[k];const r=M.exports._cwGlassesScore(zlib.gunzipSync(fs.readFileSync(path.join(EV,'gray',k+'.gray.gz'))),g.w,g.h,L.lm.map(a=>({x:a[0],y:a[1]})));rows.push({k,set:g.set,gt:g.glasses,peak:r.peak,max:r.max});}
rows.sort((a,b)=>a.set.localeCompare(b.set)||a.max-b.max);for(const r of rows)console.log(r.set.padEnd(9),r.k.padEnd(26),r.gt?'G':'-',r.peak.toFixed(2).padStart(6),r.max.toFixed(1).padStart(6));
const S=rows.filter(r=>r.set==='selfie');const negMaxPeak=Math.max(...S.filter(r=>!r.gt).map(r=>r.peak)),negMaxMax=Math.max(...S.filter(r=>!r.gt).map(r=>r.max));
console.log('셀카셋 음성 최대: peak',negMaxPeak.toFixed(2),'max',negMaxMax.toFixed(1));
