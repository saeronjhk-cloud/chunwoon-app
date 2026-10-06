const fs=require('fs'),{_cwGlassesLogit}=require('./glasses_net.js');const N=+process.argv[3]||1e9;
const X=new Float32Array(fs.readFileSync(process.argv[2]+'.bin').buffer.slice(0));const n=Math.min(N,X.length/1248),o=[];
for(let i=0;i<n;i++)o.push(_cwGlassesLogit(X.subarray(i*1248,(i+1)*1248)));fs.writeFileSync(process.argv[2]+'.jslogit.json',JSON.stringify(o));console.log(n);
