// d10 — 안경 감지 특징 변형 비교(진단 · 앱 코드 아님)
// V0 현행 · V1 기울기(roll) 정렬 격자 · V2 V1+능선(2차차분) · R 아래 테(하단 림) 능선
'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib');
const EV=path.join(__dirname,'..','..','ChunWoon_IP','face','eval_selfie');
// HX=<dir> 이면 CelebAMask-HQ 홀드아웃(hx.json + gray/) 사용
const HXD=process.env.HX;let GT,LS={},LH={},GD=path.join(EV,'gray');
if(HXD){const J=JSON.parse(fs.readFileSync(path.join(HXD,'hx.json'),'utf8')).items;GT={};for(const [k,v] of Object.entries(J)){GT[k]={w:v.w,h:v.h,glasses:v.glasses,label:v.label};LS[k]={lm:v.lm};}GD=path.join(HXD,'gray');}
else{GT=JSON.parse(fs.readFileSync(path.join(EV,'gray','glasses_gt.json'),'utf8')).gt;
LS=JSON.parse(fs.readFileSync(path.join(EV,'cache','landmarks.json'),'utf8'));LH=JSON.parse(fs.readFileSync(path.join(EV,'gray','hl_landmarks.json'),'utf8'));}
function mk(gray,w,h){return (x,y)=>{const xx=Math.max(0,Math.min(w-1.001,x)),yy=Math.max(0,Math.min(h-1.001,y));const x0=Math.floor(xx),y0=Math.floor(yy),fx=xx-x0,fy=yy-y0,i=y0*w+x0;
 return (gray[i]*(1-fx)+gray[i+1]*fx)*(1-fy)+(gray[i+w]*(1-fx)+gray[i+w+1]*fx)*fy;};}
// 축 정렬 띠: 중심(cx,cy) · 단위벡터 u(가로)·v(세로) · 가로 ±hw · 세로 t0..t1 (모두 ex 배수)
function band(S,ex,cx,cy,u,v,hw,t0,t1,mode){const s=ex/64,box=(x,y)=>{const d=s/2;return (S(x-d,y-d)+S(x+d,y-d)+S(x-d,y+d)+S(x+d,y+d))/4;};
 const rows=[];for(let t=t0*ex;t<=t1*ex+1e-9;t+=s){const r=[];for(let c=-hw*ex;c<=hw*ex+1e-9;c+=s){r.push(box(cx+u[0]*c+v[0]*t,cy+u[1]*c+v[1]*t));}rows.push(r);}
 const prof=[];
 if(mode==='d1'){for(let i=1;i<rows.length;i++){let a=0;for(let c=0;c<rows[i].length;c++)a+=Math.abs(rows[i][c]-rows[i-1][c]);prof.push(a/rows[i].length);}}
 else if(mode==='s1'){for(let i=1;i<rows.length;i++){let a=0;for(let c=0;c<rows[i].length;c++)a+=rows[i][c]-rows[i-1][c];prof.push(Math.abs(a)/rows[i].length);}}
 else if(mode==='s2'){for(let i=2;i<rows.length-2;i++){let a=0;for(let c=0;c<rows[i].length;c++)a+=2*rows[i][c]-rows[i-2][c]-rows[i+2][c];prof.push(Math.abs(a)/rows[i].length/2);}}
 else{for(let i=2;i<rows.length-2;i++){let a=0;for(let c=0;c<rows[i].length;c++)a+=Math.abs(2*rows[i][c]-rows[i-2][c]-rows[i+2][c]);prof.push(a/rows[i].length/2);}}
 const srt=prof.slice().sort((p,q)=>p-q),n=srt.length,med=n%2?srt[(n-1)>>1]:(srt[n/2-1]+srt[n/2])/2,mx=srt[n-1];
 return {peak:mx/(med+1),max:mx,at:prof.indexOf(mx)/prof.length};}
const out={};
for(const [k,g] of Object.entries(GT)){const L=(k.startsWith('hl_')?LH[k.slice(3)]:LS[k]).lm;const gray=zlib.gunzipSync(fs.readFileSync(path.join(GD,k+'.gray.gz')));
 const S=mk(gray,g.w,g.h),X=i=>L[i][0]*g.w,Y=i=>L[i][1]*g.h;
 const dx=X(362)-X(133),dy=Y(362)-Y(133),ex=Math.hypot(dx,dy),u=[dx/ex,dy/ex],v=[-u[1],u[0]];
 const cx=(X(133)+X(362))/2,cy=(Y(133)+Y(362))/2;
 // 168·6 의 v축 위치(ex 배수)
 const pv=i=>((X(i)-cx)*v[0]+(Y(i)-cy)*v[1])/ex;
 const t168=pv(168),t6=pv(6);
 const V0={...band(S,ex,cx,(Y(168)+Y(6))/2*0+cy,[1,0],[0,1],0.15,(Y(168)-0.3*ex-cy)/ex,(Y(6)+0.2*ex-cy)/ex,'d1')};
 const V1=band(S,ex,cx,cy,u,v,0.15,t168-0.3,t6+0.2,'d1');
 const V2=band(S,ex,cx,cy,u,v,0.15,t168-0.3,t6+0.2,'d2');
 const B1=band(S,ex,cx,cy,u,v,0.15,t168-0.3,t6+0.2,'s1'),B2=band(S,ex,cx,cy,u,v,0.15,t168-0.3,t6+0.2,'s2');
 // 아래 테: 각 눈 아래(145·374) 기준, 눈 가로폭 중앙 ±0.25ex, 눈 아래 0.05ex ~ 0.75ex
 const rim=(lo,inn,out_)=>{const ecx=(X(inn)+X(out_))/2,ecy=(Y(inn)+Y(out_))/2,tb=((X(lo)-ecx)*v[0]+(Y(lo)-ecy)*v[1])/ex;return [band(S,ex,ecx,ecy,u,v,0.25,tb+0.05,tb+0.75,'d2'),band(S,ex,ecx,ecy,u,v,0.25,tb+0.05,tb+0.75,'s2')];};
 const [rL,rLs]=rim(145,133,33),[rR,rRs]=rim(374,362,263);
 out[k]={gt:g.glasses,ex:+ex.toFixed(0),V0,V1,V2,R:{peak:Math.min(rL.peak,rR.peak),max:Math.min(rL.max,rR.max)},B1,B2,Rs:{peak:Math.min(rLs.peak,rRs.peak),max:Math.min(rLs.max,rRs.max)}};}
fs.writeFileSync(HXD?path.join(HXD,'d10_hx.json'):path.join(__dirname,'d10.json'),JSON.stringify(out));
const f=(o)=>`${o.peak.toFixed(2).padStart(6)} ${o.max.toFixed(1).padStart(5)}`;
const VS=(process.argv[2]||'V0,B1,B2,Rs').split(',');console.log('key'.padEnd(28),'gt  ex |',VS.map(x=>x.padStart(6)+' peak max').join(' | '));
if(!HXD)for(const [k,o] of Object.entries(out).sort((a,b)=>b[1].gt-a[1].gt||b[1][VS[1]].max-a[1][VS[1]].max))console.log(k.padEnd(28),o.gt?'G':'-',String(o.ex).padStart(4),'|',VS.map(x=>f(o[x])).join(' | '));
for(const V of ['V0','V1','V2','R','B1','B2','Rs'])for(const m of ['peak','max']){const p=Object.values(out).filter(o=>o.gt).map(o=>o[V][m]),q=Object.values(out).filter(o=>!o.gt).map(o=>o[V][m]);
 const mp=Math.min(...p),mq=Math.max(...q);console.log(`${V}.${m}: 양성 최소 ${mp.toFixed(2)} · 음성 최대 ${mq.toFixed(2)} · 비 ${(mp/mq).toFixed(2)} · 음성최대 초과 양성 ${p.filter(x=>x>mq).length}/${p.length}`);}
