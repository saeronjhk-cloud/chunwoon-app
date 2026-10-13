// p39b — P-803-B 브라우저 실측: index.html 의 「★P-803-B 시작~끝」 블록을 그대로 뽑아 앱과 같은 판·옵션의 FaceMesh 로 돌린다.
// 사용(클라우드): node p39b_browser.js <index.html> <사진 폴더>  → stdout 로그(block_sha · total=)
const {chromium}=require('/opt/npm-tools/node_modules/playwright');const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const [IDX,PH]=process.argv.slice(2);const html=fs.readFileSync(IDX,'utf8');
const i0=html.indexOf('// ★P-803-B 시작'),i1=html.indexOf('// ★P-803-B 끝');const blk=html.slice(i0,i1);
console.log('block_sha='+crypto.createHash('sha256').update(blk).digest('hex').slice(0,16));
const page=`<!doctype html><meta charset="utf-8"><script src="https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/face_mesh.js" crossorigin="anonymous"></script><script>
let _faceMeshModel;
${blk}
async function init(){_faceMeshModel=new FaceMesh({locateFile:f=>'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/'+f});
 _faceMeshModel.setOptions({maxNumFaces:1,refineLandmarks:false,minDetectionConfidence:0.5,minTrackingConfidence:0.5});
 const w=document.createElement('canvas');w.width=64;w.height=64;const c=w.getContext('2d');c.fillStyle='#c0a080';c.fillRect(10,10,44,44);
 await new Promise(r=>{_faceMeshModel.onResults(()=>r());_faceMeshModel.send({image:w});});}
async function load(src){const img=new Image();await new Promise((a,b)=>{img.onload=a;img.onerror=b;img.src=src});const s=Math.min(1,640/img.naturalWidth,640/img.naturalHeight);const cv=document.createElement('canvas');cv.width=img.naturalWidth*s;cv.height=img.naturalHeight*s;cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);return cv;}
const J=lm=>lm?lm.map(p=>[p.x,p.y]):null;
window.go=async function(){await init();const names=['lbl_01_near_1','lbl_03_far_1','lbl_05_rear1x_1','h03'];const C={};for(const n of names)C[n]=await load(n+'.jpg');
 const ref={};for(const n of names){_faceMeshModel.reset();ref[n]=J(await _cwFaceMeshSend(C[n]));}           // 기준: reset() 직후 검출
 _faceMeshModel.reset();
 const seq=['lbl_01_near_1','lbl_01_near_1','lbl_03_far_1','lbl_01_near_1','h03','lbl_05_rear1x_1','lbl_01_near_1','lbl_03_far_1'];const S=[];const t0=performance.now();
 for(const n of seq)S.push({n,lm:J(await detectFaceAI(C[n],{still:true}))});const ms=(performance.now()-t0)/seq.length;
 // 동시 호출: 측정(still) 2개 사이에 라이브식(추적) 1개를 끼워 동시에 던진다
 const [a1,b1,a2]=await Promise.all([detectFaceAI(C.lbl_01_near_1,{still:true}),detectFaceAI(C.lbl_03_far_1),detectFaceAI(C.lbl_01_near_1,{still:true})]);
 return {ref,S,ms,par:{a1:J(a1),b1:J(b1),a2:J(a2)}};};
</script>`;
fs.writeFileSync(path.join(PH,'p39b.html'),page);
const srv=http.createServer((q,r)=>{const u=decodeURIComponent(q.url.split('?')[0]);const f=path.join(PH,u==='/'?'p39b.html':u);fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return;}r.writeHead(200,{'Content-Type':f.endsWith('.html')?'text/html':'image/jpeg'});r.end(d);});}).listen(8770);
const mx=(a,b)=>(!a||!b)?Infinity:Math.max(...a.map((p,i)=>Math.max(Math.abs(p[0]-b[i][0]),Math.abs(p[1]-b[i][1]))))*640;
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage();p.on('pageerror',e=>console.log('pageerror',e.message));
 await p.goto('http://localhost:8770/');const R=await p.evaluate(()=>window.go());await b.close();srv.close();
 const res=[];const T=(id,ok,msg)=>{res.push(ok);console.log(`${ok?'PASS':'FAIL'} ${id} — ${msg}`);};
 const d=R.S.map(s=>mx(s.lm,R.ref[s.n]));
 T('W1',d.every(x=>x<1e-6),'측정 검출 = reset 기준(이력 무관) · 최대 '+Math.max(...d).toFixed(4)+'px · '+R.S.map((s,i)=>s.n.slice(0,6)+':'+d[i].toFixed(2)).join(' '));
 const rep={};let rmax=0;R.S.forEach(s=>{if(rep[s.n])rmax=Math.max(rmax,mx(s.lm,rep[s.n]));else rep[s.n]=s.lm;});T('W2',rmax<1e-6,'같은 사진 반복 최대 차 '+rmax.toFixed(4)+'px');
 T('W3',R.S.filter(s=>s.n==='h03').every(s=>s.lm),'h03(종전: 직전 얼굴 추적 때문에 못 찾음) 검출');
 const pa=Math.max(mx(R.par.a1,R.ref.lbl_01_near_1),mx(R.par.a2,R.ref.lbl_01_near_1)),pb=mx(R.par.b1,R.ref.lbl_03_far_1),pbx=mx(R.par.b1,R.ref.lbl_01_near_1);
 T('W4',pa<1e-6&&R.par.b1&&pb<pbx,`동시 호출 미혼선 — 측정 2건 기준 차 ${pa.toFixed(4)}px · 라이브식 1건은 자기 사진에 가까움(${pb.toFixed(1)} < ${pbx.toFixed(1)}px)`);
 T('W5',R.ms<1500,`측정 검출 1회(빈 프레임 포함) ${R.ms.toFixed(0)}ms — 헤드리스 CPU`);
 console.log(`total=${res.length} pass=${res.filter(x=>x).length} fail=${res.filter(x=>!x).length}`);})().catch(e=>{console.error(e);process.exit(1);});
