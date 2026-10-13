const {chromium}=require('/opt/npm-tools/node_modules/playwright');const http=require('http'),fs=require('fs'),path=require('path');
const srv=http.createServer((q,r)=>{const u=decodeURIComponent(q.url.split('?')[0]);const f=path.join(__dirname,u==='/'?'index.html':u);fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return;}r.writeHead(200,{'Content-Type':f.endsWith('.html')?'text/html':'image/jpeg'});r.end(d);});}).listen(8768);
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage();await p.goto('http://localhost:8768/');await p.evaluate(()=>window.ready);
 const seq=['lbl_01_near_1','lbl_01_near_1','lbl_03_far_1','lbl_01_near_1','h03','lbl_05_rear1x_1','lbl_01_near_1','lbl_03_far_1'];
 const t0=Date.now();const A=await p.evaluate(s=>window.run(s,'blank'),seq);const ms=(Date.now()-t0)/seq.length;
 const R=await p.evaluate(s=>window.run(s,true),['lbl_01_near_1','lbl_03_far_1','h03','lbl_05_rear1x_1']);
 fs.writeFileSync('blank.json',JSON.stringify({seq,A,R,ms}));await b.close();srv.close();})();
