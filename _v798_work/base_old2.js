const fs=require('fs'),path=require('path'),zlib=require('zlib'),{_cwGlassesScore}=require('./old_glasses.js');
const out={};for(const jf of process.argv.slice(2)){const J=JSON.parse(fs.readFileSync(jf,'utf8')).items;const gd=path.join(path.dirname(jf),path.basename(jf,'.json'));
 for(const [k,v] of Object.entries(J)){const g=zlib.gunzipSync(fs.readFileSync(path.join(gd,k+'.gray.gz')));const L=v.lm;const r=_cwGlassesScore(g,v.w,v.h,L.map(a=>({x:a[0],y:a[1]})));
 const dl=L[1][0]-L[234][0],dr=L[454][0]-L[1][0];out[k]={label:v.label,pred:!!(r&&r.glasses),front:Math.abs(dl-dr)/(dl+dr)<0.25};}}
const f=(fl)=>{const P=Object.values(out).filter(x=>x.label==='pos'&&fl(x)),N=Object.values(out).filter(x=>x.label==='neg'&&fl(x));return `재현 ${P.filter(x=>x.pred).length}/${P.length} 오탐 ${N.filter(x=>x.pred).length}/${N.length}`;};
console.log('현행 전체',f(()=>1),'| 정면',f(x=>x.front));
