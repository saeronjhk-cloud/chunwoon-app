// v800 P-800-A — 모서리 꺾임 집중도 K 의 기준 구현(평가·생성기 공용 · 코어 구현과 대조용)
//  정의(d23): 정면화 좌표에서 귀밑(234/454)→턱끝(152) 윤곽 10구간의 회전각 합 중 하악각 창(132·58·172·136 / 361·288·397·365) 몫 · 좌우 평균
'use strict';
const L1=[234,93,132,58,172,136,150,149,176,148,152],R1=[454,323,361,288,397,365,379,378,400,377,152],WIN=[132,58,172,136,361,288,397,365];
function sideK(q,S){let tot=0,win=0;for(let i=1;i<S.length-1;i++){const p0=q[S[i-1]],p1=q[S[i]],p2=q[S[i+1]];const v1x=p1.x-p0.x,v1y=p1.y-p0.y,v2x=p2.x-p1.x,v2y=p2.y-p1.y;
 const t=Math.abs(Math.atan2(v1x*v2y-v1y*v2x,v1x*v2x+v1y*v2y));tot+=t;if(WIN.indexOf(S[i])>=0)win+=t;}return win/(tot||1e-9);}
function jawCornerK(q){return (sideK(q,L1)+sideK(q,R1))/2;}
module.exports={jawCornerK,L1,R1,WIN};
