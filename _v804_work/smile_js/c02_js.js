// e01 — 앱(JS) 엔진으로 평가 사진 재검출. @mediapipe/face_mesh 0.4.1633559619 · 앱과 같은 옵션 · ≤640 축소 · 빈 프레임으로 추적 끊기(P-803-B).
// 사용: node e01_js.js <사진폴더> <refine:true|false> <out.json>
const {chromium}=require('/opt/npm-tools/node_modules/playwright');const http=require('http'),fs=require('fs'),path=require('path');
const [PH,REF,OUT]=process.argv.slice(2);const names=fs.readdirSync(PH).filter(f=>f.endsWith('.png')).map(f=>f.slice(0,-4)).sort();
const page=`<!doctype html><meta charset="utf-8"><script src="https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/face_mesh.js" crossorigin="anonymous"></script><script>
let fm;const blank=document.createElement('canvas');blank.width=64;blank.height=64;{const b=blank.getContext('2d');b.fillStyle='#000';b.fillRect(0,0,64,64);}
function send(img){return new Promise(r=>{fm.onResults(x=>r(x.multiFaceLandmarks&&x.multiFaceLandmarks[0]||null));fm.send({image:img});});}
window.go=async function(names,refine){fm=new FaceMesh({locateFile:f=>'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/'+f});
 fm.setOptions({maxNumFaces:1,refineLandmarks:refine,minDetectionConfidence:0.5,minTrackingConfidence:0.5});
 const w=document.createElement('canvas');w.width=64;w.height=64;w.getContext('2d').fillStyle='#c0a080';w.getContext('2d').fillRect(10,10,44,44);await send(w);
 const out={};for(const n of names){const img=new Image();await new Promise((a,b)=>{img.onload=a;img.onerror=b;img.src=n+'.png'});
  const s=Math.min(1,640/img.naturalWidth,640/img.naturalHeight);const cv=document.createElement('canvas');cv.width=img.naturalWidth*s;cv.height=img.naturalHeight*s;cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
  await send(blank);const lm=await send(cv);out[n]={w:cv.width,h:cv.height,lm:lm?lm.slice(0,468).map(p=>[+p.x.toFixed(6),+p.y.toFixed(6),+p.z.toFixed(6)]):null};}
 return out;};</script>`;
fs.writeFileSync(path.join(PH,'_e01.html'),page);
const srv=http.createServer((q,r)=>{const u=decodeURIComponent(q.url.split('?')[0]);const f=path.join(PH,u==='/'?'_e01.html':u);fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return;}r.writeHead(200,{'Content-Type':f.endsWith('.html')?'text/html':'image/png'});r.end(d);});}).listen(8780+(REF==='true'?1:0));
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage();p.setDefaultTimeout(0);
 await p.goto('http://localhost:'+(8780+(REF==='true'?1:0))+'/');const R=await p.evaluate(([n,r])=>window.go(n,r),[names,REF==='true']);
 fs.writeFileSync(OUT,JSON.stringify(R));console.log(OUT,'n',Object.keys(R).length,'nodet',Object.values(R).filter(v=>!v.lm).length);await b.close();srv.close();})().catch(e=>{console.error(e);process.exit(1);});
