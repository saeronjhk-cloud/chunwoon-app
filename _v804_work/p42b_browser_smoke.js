// v804 p42b — 트랙 B 브라우저 실측(클라우드 · playwright chromium) — 정적 평가 p42가 못 보는 범위 오류(예: EB_CH 미정의)를 잡는다
// 사용: node _v804_work/p42b_browser_smoke.js [repo 루트]   (/opt/npm-tools/node_modules/playwright · /opt/pw-browsers)
const {chromium}=require('/opt/npm-tools/node_modules/playwright');const http=require('http'),fs=require('fs'),path=require('path');
const R=process.argv[2]||path.join(__dirname,'..');const PORT=8795;let total=0,pass=0;const fails=[];const ck=(id,n,ok,d)=>{total++;if(ok)pass++;else fails.push(id);console.log(`  ${ok?'ok  ':'FAIL'} ${id} ${n}${d?' — '+d:''}`)};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';const f=path.join(R,u);fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return}r.writeHead(200,{'Content-Type':f.endsWith('.html')?'text/html':f.endsWith('.js')?'text/javascript':'application/octet-stream'});r.end(d)})}).listen(PORT);
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(`http://localhost:${PORT}/`,{waitUntil:'load'});await p.waitForTimeout(2500);
const outs=[];for(let i=0;i<12;i++)outs.push(await p.evaluate(i=>{try{selectZodiac(i);return document.getElementById('dailyMsg').innerText}catch(e){return 'ERR '+e.message}},i));
ck('B1','홈 띠별 운세 12띠 모두 렌더(오류 없음 · 일진·관계 문구)',outs.every(o=>!/^ERR/.test(o)&&/일이에요/.test(o)&&/관계/.test(o)),outs.find(o=>/^ERR/.test(o))||'');
ck('B2','홈 운세에 점수·행운·길흉 단정 없음',outs.every(o=>!/점\b|\d+점|행운|길한 날|흉한 날|좋은 날|나쁜 날/.test(o)),'');
const card=await p.evaluate(()=>{try{return _cwIljinFactsCard({date:'2026-10-14',todayGanzi:'辛酉',todayGanziKo:'신유',ilgan:'甲',sipsin:{name:'정관',group:'관성'},relations:[{with:'일지',branch:'卯',tags:['沖']}]})}catch(e){return 'ERR '+e.message}});
ck('B3','데일리 근거 카드 렌더',/오늘 일진/.test(card)&&/정관/.test(card)&&/충\(沖\)/.test(card),card.slice(0,80));
ck('B4','페이지 오류 0',errs.length===0,errs.slice(0,3).join(' · '));
console.log(`[p42b_browser_smoke] total=${total} pass=${pass} fail=${total-pass}${fails.length?' · FAIL '+fails.join(','):''}`);await b.close();srv.close();process.exitCode=fails.length?1:0;})().catch(e=>{console.error(e);process.exit(1)});
