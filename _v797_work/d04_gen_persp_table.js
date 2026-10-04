// v797 P-795-A — 근접 셀카 원근 보정표 생성기
//  canonical_face_model(cm) 을 거리 d 에서 핀홀 투영해 축 원시값 비(근접 d_eff / 원거리 120cm)를 구한다.
//  d_eff=48cm: 실측 두 사람(제이·두번째 분, 근접 셀카 5 + 후면 3배 줌 원거리 5)에서 각각 48·50cm 로 독립 적합(d03.log)
//  ※ MediaPipe 메시는 3D 사전형으로 원근을 일부 흡수하므로 물리 거리(~30cm)보다 큰 「유효 거리」가 나온다.
//  제외: jawRatio(모형 +1.8% vs 실측 두 사람 모두 −0.6~−0.8% — 방향 반대) · eyeTilt·browAngle(각도) · |효과|<2% 축
//  node _v797_work/d04_gen_persp_table.js → _v797_work/fixtures/persp_v1.json
'use strict';
const fs=require('fs'),path=require('path');const ROOT=path.join(__dirname,'..');
const STUB="const FACE_S=[{l:'a',v:'round'}];const FACE_E=[{l:'a',v:'big'}];const FACE_N=[{l:'a',v:'high'}];const FACE_M=[{l:'a',v:'big'}];";
const SRC=fs.readFileSync(path.join(ROOT,'_v786_diag','face_core_v786.js'),'utf8');
const M={exports:{}};new Function('module','exports','window',STUB+SRC.replace('__REF__','{"version":"tmp","tier":"tmp","q":{}}')+'\nmodule.exports={_cwFaceMeasure,CW_FACE_AXES,CW_FACE_AXIS_KIND};')(M,M.exports,undefined);const C=M.exports;
const V=fs.readFileSync(path.join(ROOT,'_v789_work','fixtures','canonical_face_model.obj'),'utf8').split('\n').filter(l=>l.startsWith('v ')).map(l=>l.split(/\s+/).slice(1,4).map(Number));
const zmax=Math.max(...V.map(v=>v[2]));
function proj(d){const P=V.map(([x,y,z])=>{const s=d/(d+zmax-z);return [x*s,-y*s,z];});const xs=P.map(p=>p[0]),ys=P.map(p=>p[1]);const x0=Math.min(...xs)-5,x1=Math.max(...xs)+5,y0=Math.min(...ys)-8,y1=Math.max(...ys)+5;const W=x1-x0,H=y1-y0;return C._cwFaceMeasure(P.map(([x,y,z])=>({x:(x-x0)/W,y:(y-y0)/H,z:z/W})),H/W,null,null);}
const D_EFF=48,D_FAR=120,near=proj(D_EFF),far=proj(D_FAR),f={};
const EXCL={jawRatio:1,eyeTilt:1,browAngle:1};
for(const a of C.CW_FACE_AXES.filter(k=>C.CW_FACE_AXIS_KIND[k]==='REL')){if(EXCL[a]||near[a]==null||!far[a])continue;const r=near[a]/far[a];if(Math.abs(Math.log(r))>0.02)f[a]=+r.toFixed(4);}
const out={version:'PERSP-v1-20261004',dEff:D_EFF,dFar:D_FAR,f};
fs.writeFileSync(path.join(__dirname,'fixtures','persp_v1.json'),JSON.stringify(out,null,1));console.log(JSON.stringify(out));
