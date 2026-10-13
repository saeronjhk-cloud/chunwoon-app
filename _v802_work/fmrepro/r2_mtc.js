const {chromium}=require('/opt/npm-tools/node_modules/playwright');const http=require('http'),fs=require('fs'),path=require('path');
const srv=http.createServer((q,r)=>{const u=decodeURIComponent(q.url.split('?')[0]);const f=path.join(__dirname,u==='/'?'index.html':u);fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return;}r.writeHead(200,{'Content-Type':f.endsWith('.html')?'text/html':'image/jpeg'});r.end(d);});}).listen(8767);
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const res={};
 const seq=['lbl_01_near_1','lbl_01_near_1','lbl_03_far_1','lbl_01_near_1','h03','lbl_05_rear1x_1','lbl_01_near_1','lbl_03_far_1'];
 for(const mtc of ['0.5','0.99','1.0']){const p=await b.newPage();await p.goto('http://localhost:8767/?mtc='+mtc);await p.evaluate(()=>window.ready);
  const t0=Date.now();const A=await p.evaluate(s=>window.run(s,false),seq);const dt=(Date.now()-t0)/seq.length;
  const R=await p.evaluate(s=>window.run(s,true),['lbl_01_near_1','lbl_03_far_1','h03']);  // reset 기준값
  res[mtc]={ms:Math.round(dt),A,R};await p.close();}
 fs.writeFileSync('mtc.json',JSON.stringify({seq,res}));await b.close();srv.close();})();
