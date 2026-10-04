// v797 P-792-B 진단 — 얼굴형 판정 현황(실사진 23장 · 셀카셋 40장): 현 규칙 분포 · cheonJiWidth 분포 · 五形 부합도 top · 대안 규칙 분포
'use strict';const fs=require('fs'),path=require('path'),zlib=require('zlib');
const ROOT=path.join(__dirname,'..'),IP=path.join(ROOT,'..','ChunWoon_IP','face');
const STUB="const FACE_S=[{l:'둥근형',v:'round'},{l:'각진형',v:'square'},{l:'긴 형',v:'long'},{l:'역삼각형',v:'inv'}];const FACE_E=[{l:'a',v:'big'},{l:'b',v:'narrow'},{l:'c',v:'round'},{l:'d',v:'droopy'}];const FACE_N=[{l:'a',v:'high'},{l:'b',v:'wide'},{l:'c',v:'small'},{l:'d',v:'hooked'}];const FACE_M=[{l:'a',v:'big'},{l:'b',v:'small'},{l:'c',v:'thick'},{l:'d',v:'thin'}];";
const idx=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');const i0=idx.indexOf('var CW_FACE_REF'),i1=idx.indexOf('//  5b. PAL',i0);
const M={exports:{}};new Function('module','exports','window',STUB+idx.slice(i0,idx.lastIndexOf('// ====',i1))+'\nmodule.exports={classifyFaceFromLandmarks,_cwHairline,_cwRank,CW_FACE_REF};')(M,M.exports,{});const C=M.exports;
const sets=[['인터넷23',path.join(IP,'eval_hairline','cache'),k=>'file'],['셀카셋',path.join(IP,'eval_selfie','cache'),k=>/_near_|_guide_|_selfie_/.test(k)?'live':'file']];
const rows=[];
for(const [nm,dir,srcOf] of sets){const L=JSON.parse(fs.readFileSync(path.join(dir,'landmarks.json'),'utf8'));
 for(const k of Object.keys(L).sort()){const d=L[k];if(!d)continue;const ai=d.lm.map(a=>({x:a[0],y:a[1],z:a[2]}));const hr=C._cwHairline(zlib.gunzipSync(fs.readFileSync(path.join(dir,k+'.mask.gz'))),d.w,d.h,ai);
  const c=C.classifyFaceFromLandmarks(ai,d.h/d.w,hr,srcOf(k));const R=c.ranks||{};const m=c.ratios;
  rows.push({set:nm,k,shape:c.shapeOpt.v,cjw:m.cheonJiWidth,wh:R.whRatio,jaw:R.jawRatio,fh:R.foreheadRatio,wx:c.wuxingTop||(c.wuxing&&c.wuxing.top)||null,glasses:/_g_/.test(k)});}}
const cnt=(a,f)=>a.reduce((o,r)=>(o[f(r)]=(o[f(r)]||0)+1,o),{});
const q=(a,p)=>{const s=[...a].sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.floor(p*(s.length-1)))]};
for(const nm of ['인터넷23','셀카셋']){const a=rows.filter(r=>r.set===nm);
 console.log(`\n[${nm}] n=${a.length} 현 규칙 분포`,JSON.stringify(cnt(a,r=>r.shape)),' 五形 top',JSON.stringify(cnt(a,r=>r.wx)));
 const v=a.map(r=>r.cjw);console.log(`  cheonJiWidth(이마폭/하악각폭) 최소 ${q(v,0).toFixed(3)} · 10% ${q(v,.1).toFixed(3)} · 중앙 ${q(v,.5).toFixed(3)} · 90% ${q(v,.9).toFixed(3)} · 최대 ${q(v,1).toFixed(3)} · >1.06 ${v.filter(x=>x>1.06).length}/${v.length}`);
 // 대안: 실사진 분포 기준 상위 15% (P85) — 인터넷23 기준으로 고정
}
const P85=q(rows.filter(r=>r.set==='인터넷23').map(r=>r.cjw),0.85);
const alt=r=>r.wh<0.25?'long':r.jaw>0.62?'square':r.cjw>P85?'inv':'round';
for(const nm of ['인터넷23','셀카셋'])console.log(`  대안C(이마/하악 원시값 임계=인터넷23 상위15% ${P85.toFixed(3)}) [${nm}]`,JSON.stringify(cnt(rows.filter(r=>r.set===nm),alt)));
console.log('\n[제이 · 같은 사람 조건별]');for(const r of rows.filter(r=>r.k.startsWith('jay_2026')||r.k.startsWith('p2_')))console.log('  ',r.k.padEnd(24),r.shape.padEnd(7),'cjw',r.cjw.toFixed(3),'五形',r.wx);
console.log('\nJSON',JSON.stringify({P85}));
