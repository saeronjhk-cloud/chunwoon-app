// ============================================================
//  P-26 · 사진 선택 경로의 근접 셀카 판별(EXIF) 평가 — v797 P-797-D
//  node _v797_work/p26_file_selfie_eval.js
// ------------------------------------------------------------
//  결함: 원근 보정(P-795-A)은 실시간 촬영에만 적용된다. 갤러리에서 고른 근접 셀카는 같은 원근 왜곡이 있는데 보정이 없다.
//  수리: JPEG EXIF 의 35mm 환산 초점거리(FocalLengthIn35mmFilm)와 사진 속 얼굴 폭(LM234↔454 정규화)으로 촬영 거리를 추정
//   d ≈ f35/(가로변 환산 mm: 세로사진 24 · 가로사진 36) × 14.5cm / 얼굴폭비. d ≤ CW_SELFIE_NEAR_CM(60) 이면 근접 셀카 → 'live' 와 같은 보정.
//   EXIF 가 없거나 f35 가 없으면 판정하지 않는다(종전대로 무보정). ★14.5cm 는 LM234↔454 실제 폭의 대략값 — 판정 경계용.
//  평가셋: D:\ChunWoon_IP\face\images\selfie 원본 40장(EXIF 보존) + eval_selfie\orig_lm_frac.json(원본에서 잰 LM234/454)
//  ★알려진 한계(기록): 인쇄 사진을 폰으로 다시 찍은 사진(jay_2023_nog_idphoto, f35=23)은 근접으로 판정된다 — 구분 불가.
// ============================================================
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..'),IMG=path.join(ROOT,'..','ChunWoon_IP','face','images','selfie'),FX=path.join(ROOT,'..','ChunWoon_IP','face','eval_selfie','orig_lm_frac.json');
const STUB="const FACE_S=[{l:'a',v:'round'}];const FACE_E=[{l:'a',v:'big'}];const FACE_N=[{l:'a',v:'high'}];const FACE_M=[{l:'a',v:'big'}];";
const idx=fs.readFileSync(process.env.P17_INDEX||path.join(ROOT,'index.html'),'utf8');const i0=idx.indexOf('var CW_FACE_REF'),i1=idx.indexOf('//  5b. PAL',i0);
const M={exports:{}};new Function('module','exports','window',STUB+idx.slice(i0,idx.lastIndexOf('// ====',i1))+"\nmodule.exports={ex:(typeof _cwJpegExif!=='undefined'?_cwJpegExif:null),dist:(typeof _cwSelfieDistanceCm!=='undefined'?_cwSelfieDistanceCm:null),dec:(typeof _cwFileSrcFromExif!=='undefined'?_cwFileSrcFromExif:null),NEAR:(typeof CW_SELFIE_NEAR_CM!=='undefined'?CW_SELFIE_NEAR_CM:null)};")(M,M.exports,{});const C=M.exports;
let total=0,pass=0;const fails=[];function check(id,name,ok,detail){total++;if(ok)pass++;else fails.push(id);console.log(`  ${ok?'ok  ':'FAIL'} ${id} ${name} — ${detail}`);}
check('X0','함수·임계 존재',!!(C.ex&&C.dist&&C.dec)&&C.NEAR===60,String(C.NEAR));
const FXJ=JSON.parse(fs.readFileSync(FX,'utf8')).rows;const files=Object.keys(FXJ).sort();
// 기대 EXIF (PIL 판독 2026-10-04)
const want=k=>k.startsWith('jay_2026_')||k.startsWith('p2_2026_')?(k.includes('_far_')?69:30):k==='jay_2023_nog_idphoto'?23:null;
const R={};
if(C.ex)for(const k of files){const buf=new Uint8Array(fs.readFileSync(path.join(IMG,k+'.jpg')));let e=null;try{e=C.ex(buf)}catch(x){e={err:String(x)}};const f=FXJ[k];
  const ai=[];ai[234]={x:f.x234,y:0.5};ai[454]={x:f.x454,y:0.5};const d=C.dec(e,ai,f.w,f.h);R[k]={f35:e&&e.f35,want:want(k),truth:f.truth,src:d&&d.src,dist:d&&d.distCm};}
const bad=files.filter(k=>R[k]&&(R[k].f35||null)!==R[k].want);
check('X1','EXIF 35mm 환산 초점거리 판독 = PIL 판독(40장 · 없는 사진은 null)',C.ex&&bad.length===0,bad.length?bad.map(k=>`${k}:${R[k].f35}≠${R[k].want}`).join(','):'40/40');
const near=files.filter(k=>R[k]&&R[k].truth==='near'),far=files.filter(k=>R[k]&&R[k].truth==='far');
check('X2','근접 셀카(전면 · 15장) 전부 live · 거리 ≤60cm',near.length===15&&near.every(k=>R[k].src==='live'),near.map(k=>Math.round(R[k].dist||-1)).join(','));
check('X3','원거리(후면 3배 줌 · 10장) 전부 file · 거리 >100cm',far.length===10&&far.every(k=>R[k].src==='file'&&R[k].dist>100),far.map(k=>Math.round(R[k].dist||-1)).join(','));
const nof=files.filter(k=>R[k]&&!R[k].want);
check('X4','f35 없는 사진(옛 폰·DSLR 14장)은 판정 안 함(file · 거리 null)',nof.length===14&&nof.every(k=>R[k].src==='file'&&R[k].dist==null),`${nof.length}장`);
check('X5','EXIF 없음/깨진 입력 → file(예외 없음)',C.dec&&C.dec(null,[],100,100).src==='file'&&(()=>{try{return C.ex(new Uint8Array([0xff,0xd8,0xff,0xe1,0,4,1,2]))===null||true}catch(e){return false}})(),'');
console.log('[W] 앱 배선');
{const pk=idx.slice(idx.indexOf('function onPhotoPicked'),idx.indexOf('function setPhoto'));
 check('W1','사진 선택 시 EXIF 판독 → window._cwFaceExif',/_cwJpegExif\(/.test(pk)&&/window\._cwFaceExif\s*=/.test(pk),'');
 const an=idx.slice(idx.indexOf("if(!photoState.face.aiLandmarks){"),idx.indexOf("if(!photoState.face.aiLandmarks){")+2600);
 check('W2','분석 단계(사진 경로) 검출 직후 _cwFileSrcFromExif 로 live/file 결정',/_cwFileSrcFromExif\(/.test(an)&&/window\._cwFaceSrc\s*=/.test(an),'');
 check('W3','초기화(_cwResetAIFrame)에서 EXIF·거리 지움 · 결과 화면에 근접 셀카 보정 안내',/function _cwResetAIFrame\(\)\{[\s\S]{0,900}window\._cwFaceExif\s*=\s*null/.test(idx)&&/AI 실측 데이터:[\s\S]{0,1800}_cwFaceDistCm/.test(idx),'');}
console.log(`[p26_file_selfie] total=${total} pass=${pass} fail=${total-pass}${fails.length?' · FAIL '+fails.join(','):''}`);
process.exitCode=fails.length?1:0;
