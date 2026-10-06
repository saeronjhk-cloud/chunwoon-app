// 특징 덤프 v2: node dump_feats2.js out flips(0|1) degrade(none|deg) json...
// deg: 무작위(시드 고정) 축소(ex 32~60px 목표)·대비 0.5~1·가우스 잡음 σ2~6 — 옛 폰·저조도 모사
const fs=require('fs'),path=require('path'),zlib=require('zlib'),{_cwGlassesPatch,_cwGlassesHog}=require('./glasses_feat.js');
const [out,flips,deg,...jsons]=process.argv.slice(2);let seed=12345;const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;};
const gauss=()=>{let u=rnd()||1e-9,v=rnd();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);};
function degrade(g,w,h,lm){const ex=Math.hypot((lm[362].x-lm[133].x)*w,(lm[362].y-lm[133].y)*h);const tgt=32+rnd()*28,f=Math.min(1,tgt/ex);
 const W=Math.max(8,Math.round(w*f)),H=Math.max(8,Math.round(h*f)),o=new Uint8Array(W*H);const c=0.5+0.5*rnd(),sg=2+4*rnd();let mean=0;for(let i=0;i<g.length;i++)mean+=g[i];mean/=g.length;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const x0=Math.floor(x/f),x1=Math.max(x0+1,Math.floor((x+1)/f)),y0=Math.floor(y/f),y1=Math.max(y0+1,Math.floor((y+1)/f));let s=0,n=0;
  for(let yy=y0;yy<Math.min(h,y1);yy++)for(let xx=x0;xx<Math.min(w,x1);xx++){s+=g[yy*w+xx];n++;}let v=(s/n-mean)*c+mean+gauss()*sg;o[y*W+x]=v<0?0:v>255?255:v;}
 return [o,W,H];}
const meta=[],bufs=[];
for(const jf of jsons){const J=JSON.parse(fs.readFileSync(jf,'utf8'));const items=J.items||J;const gd=path.join(path.dirname(jf),path.basename(jf,'.json'));
 for(const [k,v] of Object.entries(items)){let g=zlib.gunzipSync(fs.readFileSync(path.join(gd,k+'.gray.gz'))),w=v.w,h=v.h;const lm=v.lm.map(a=>({x:a[0],y:a[1]}));
  if(deg==='deg')[g,w,h]=degrade(g,w,h,lm);
  const fl=flips==='1'?[0,1]:[0];let ok=1;for(const flip of fl){const P=_cwGlassesPatch(g,w,h,lm,flip);if(!P){ok=0;break;}bufs.push(Buffer.from(P.buffer));}
  meta.push({k,label:v.label,ok,n:ok?fl.length:0});}}
fs.writeFileSync(out+'.bin',Buffer.concat(bufs));fs.writeFileSync(out+'.meta.json',JSON.stringify(meta));console.log(out,meta.length,meta.filter(m=>m.ok).length);
