// v804 d32 — REF 후보(JS 앵커) vs 현행 REF: 실사진 127장(JS 정본 캐시)에서 축 백분위·조화도·판정 변화 (보고용 · 채택 판단에 쓰지 않음 — P-804-A §3)
const fs=require('fs'),path=require('path');const L=require('../_v799_work/persp_v2_lib.js');
const ROOT=path.join(__dirname,'..'),IP=path.join(ROOT,'..','ChunWoon_IP','face');
const A=L.loadCore(path.join(ROOT,'index.html')),B=L.loadCore(process.argv[2]||path.join(__dirname,'ref_cand','index_cand.html'));
const ax={},hs=[];let n=0;const vd={shapeOpt:0,eyeOpt:0,noseOpt:0,mouthOpt:0};
for(const d of ['eval_labelset','eval_selfie','eval_hairline']){const C=JSON.parse(fs.readFileSync(path.join(IP,d,'cache','landmarks.json'),'utf8'));
 for(const [k,e] of Object.entries(C)){const ai=e.lm.map(a=>({x:a[0],y:a[1],z:a[2]}));const a=A.classifyFaceFromLandmarks(ai,e.h/e.w,null,null),b=B.classifyFaceFromLandmarks(ai,e.h/e.w,null,null);n++;
  const ra=a.ranks||{},rb=b.ranks||{};
  for(const q of Object.keys(ra)){if(ra[q]==null||rb[q]==null)continue;(ax[q]=ax[q]||[]).push(Math.abs(ra[q]-rb[q])*100);}
  if(a.harmonyScore!=null&&b.harmonyScore!=null)hs.push(Math.abs(a.harmonyScore-b.harmonyScore));
  for(const v of Object.keys(vd))if((a[v]&&a[v].v)!==(b[v]&&b[v].v))vd[v]++;}}
const med=x=>{const s=[...x].sort((p,q)=>p-q);return s.length?s[s.length>>1]:NaN};
console.log('n',n,'REF',A.CW_FACE_REF&&A.CW_FACE_REF.version,'→',B.CW_FACE_REF&&B.CW_FACE_REF.version);
console.log('축 백분위점 이동 |Δ| 중앙/최대:',Object.entries(ax).map(([q,v])=>`${q} ${med(v).toFixed(1)}/${Math.max(...v).toFixed(1)}`).join(' · '));
console.log('조화도 |Δ| 중앙/최대',hs.length?med(hs).toFixed(1)+'/'+Math.max(...hs).toFixed(1):'(키 없음)','· 판정 바뀜',JSON.stringify(vd),'/',n);
