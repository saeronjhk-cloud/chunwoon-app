const {chromium}=require('/opt/npm-tools/node_modules/playwright');const http=require('http'),fs=require('fs'),path=require('path');
const srv=http.createServer((q,r)=>{const u=decodeURIComponent(q.url.split('?')[0]);const f=path.join(__dirname,u==='/'?'index.html':u);fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return;}r.writeHead(200,{'Content-Type':f.endsWith('.html')?'text/html':'image/jpeg'});r.end(d);});}).listen(8766);
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage();await p.goto('http://localhost:8766/');await p.evaluate(()=>window.ready);
 const t=await p.evaluate(async()=>{const r={};for(const reset of [false,true]){const ts=[];for(let i=0;i<6;i++){const t0=performance.now();await window.run(['lbl_01_near_1'],reset);ts.push(performance.now()-t0);}r[reset?'reset':'track']=ts.map(x=>Math.round(x));}return r;});
 console.log(JSON.stringify(t));await b.close();srv.close();})();
