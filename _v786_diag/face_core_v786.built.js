/* ============================================================
   ★v786 관상 코어 — index.html 삽입용 정본 (이 파일이 원본)
   진단 근거: _v786_diag/p01_face_diversity.js · p02_face_v2_eval.js
   ------------------------------------------------------------
   고친 것 3가지
   ① 등방화 — MediaPipe 는 x 를 사진 폭, y 를 사진 높이로 각각 정규화한다.
      x/y 를 섞는 비율(가로세로비·눈 종횡비)은 사진 비율에 비례해 왜곡됐다.
      실측: 같은 사람을 5가지 사진 비율로 찍으면 4축 판정이 전부 같을 확률 0.30%.
   ② 랜드마크 정정 — FACEMESH_FACE_OVAL 순회순서 실측 결과
      127/356 은 '관자'이지 '턱'이 아니다. 실제 하악각은 172/397.
      기존 jawRatio 는 관자폭/광대폭이라 항상 ≈1.0 → '각진형'으로 고정됐다.
   ③ 고정임계 → 참조분위수 — 임계가 어떤 모집단으로도 보정된 적이 없어
      '매부리코'는 수학적으로 도달 불가, '작은 입'이 99.8%를 차지했다.
   ============================================================ */

/* 참조 분위수 레지스트리. ★TIER-C(합성 유래) — 실사진 캘리브레이션 전까지 잠정. */
var CW_FACE_REF = {"version":"REF-SYNTH-v792-CANON-20260929","tier":"C-SYNTHETIC","n":60000,"q":{"whRatio":[0.495475,0.738731,0.773488,0.794831,0.81024,0.822503,0.833159,0.842665,0.85144,0.86008,0.868328,0.876367,0.884972,0.893895,0.903584,0.914037,0.926383,0.941689,0.963041,0.998869,1.318317],"jawRatio":[0.208152,0.617704,0.659965,0.685652,0.703603,0.719196,0.731817,0.743559,0.75442,0.764661,0.774747,0.78475,0.795255,0.80613,0.817482,0.830159,0.844814,0.863373,0.888954,0.932478,1.259886],"foreheadRatio":[0.532741,0.803475,0.836205,0.855957,0.869781,0.881463,0.891153,0.89992,0.908018,0.915963,0.923974,0.931853,0.939892,0.948121,0.957338,0.967376,0.979115,0.993493,1.013632,1.04815,1.377285],"eyeAspect":[1.692144,3.191164,3.376867,3.488586,3.568962,3.632749,3.687595,3.737216,3.781734,3.824586,3.867235,3.909155,3.95303,3.999265,4.048248,4.103692,4.168712,4.249591,4.359185,4.53898,5.97954],"eyeSize":[0.09061,0.144441,0.151074,0.155003,0.157934,0.160291,0.162261,0.164016,0.165735,0.167323,0.168843,0.170419,0.172003,0.173669,0.175444,0.177468,0.179927,0.182735,0.186684,0.193442,0.251729],"eyeTilt":[-35.924521,-11.810846,-9.086316,-7.422216,-6.205311,-5.208482,-4.406214,-3.7003,-3.014785,-2.37967,-1.753206,-1.116052,-0.493494,0.197827,0.916334,1.725606,2.665066,3.804437,5.381542,8.193583,32.886451],"noseWRatio":[0.126265,0.19896,0.208303,0.213882,0.217843,0.221136,0.223904,0.226353,0.22865,0.230851,0.232988,0.2352,0.23746,0.239736,0.242197,0.244948,0.248229,0.252254,0.257689,0.266658,0.367475],"noseHRatio":[0.132092,0.212909,0.222726,0.228433,0.232736,0.236122,0.239148,0.24183,0.244354,0.246736,0.249076,0.251331,0.253708,0.25612,0.258781,0.261639,0.265236,0.269536,0.27529,0.284871,0.388503],"noseDorsum":[0,0.01032,0.015407,0.018427,0.020692,0.022522,0.024122,0.025545,0.026956,0.028312,0.029644,0.031018,0.032439,0.033949,0.035628,0.037435,0.039723,0.042464,0.046351,0.052706,0.11792],"mouthRatio":[0.174081,0.265768,0.279899,0.288724,0.295018,0.300111,0.304538,0.30862,0.312502,0.316153,0.319712,0.323382,0.327049,0.330891,0.334981,0.339653,0.344874,0.351401,0.36091,0.376348,0.552166],"lipThickness":[0.03095,0.064502,0.068681,0.071151,0.072963,0.074435,0.075703,0.076857,0.077905,0.078937,0.079941,0.080925,0.08194,0.082964,0.084107,0.085342,0.086873,0.088708,0.091281,0.095411,0.133165],"symmetry":[0.357927,0.770088,0.816731,0.846487,0.867668,0.884172,0.897546,0.908853,0.918804,0.927865,0.936266,0.943907,0.950972,0.957722,0.964076,0.97037,0.97649,0.982393,0.988496,0.99424,0.999996],"thirds":[0.262633,0.681098,0.730243,0.76035,0.782091,0.799285,0.813507,0.825843,0.837036,0.847682,0.857669,0.867119,0.876387,0.885709,0.895271,0.904974,0.915492,0.926805,0.940421,0.957744,0.999761],"myungGung":[0.056502,0.129266,0.137361,0.142304,0.145956,0.148808,0.15119,0.153439,0.155509,0.157475,0.159419,0.161381,0.163298,0.165323,0.167436,0.169908,0.17283,0.176303,0.181262,0.189292,0.260779],"cheonI":[0.591832,0.869036,0.896334,0.912967,0.924477,0.93359,0.941543,0.948035,0.953837,0.9588,0.963574,0.96801,0.972079,0.976014,0.979744,0.983331,0.986781,0.99016,0.993531,0.996799,0.999996],"jaNyeo":[0.028318,0.061811,0.065822,0.068173,0.069849,0.071208,0.07239,0.073454,0.074459,0.075378,0.076285,0.077189,0.078134,0.079118,0.080204,0.081386,0.082752,0.084408,0.086801,0.09089,0.131948],"jilAek":[0.045437,0.100119,0.106625,0.110402,0.113153,0.115386,0.117328,0.119038,0.12063,0.12209,0.123551,0.125041,0.126548,0.12811,0.129843,0.1318,0.134015,0.136781,0.140524,0.1468,0.197889],"jeonTaek":[0.027676,0.069683,0.07456,0.077432,0.079484,0.081127,0.082583,0.083902,0.085092,0.086242,0.087365,0.08846,0.089635,0.090851,0.09213,0.093605,0.095324,0.097492,0.100368,0.10516,0.145728],"browLength":[0.113506,0.221884,0.233115,0.2399,0.244844,0.248857,0.252239,0.255308,0.258199,0.2609,0.263485,0.26619,0.26894,0.2718,0.274968,0.278388,0.28234,0.287244,0.29395,0.305374,0.422719],"browAngle":[-42.912376,-10.510868,-8.549783,-7.407705,-6.595912,-5.971314,-5.427723,-4.947302,-4.505369,-4.071219,-3.663614,-3.243097,-2.826804,-2.393375,-1.925231,-1.414337,-0.800982,-0.05441,0.978291,2.756219,20.961842],"browThick":[0.009471,0.026565,0.028593,0.029824,0.030704,0.031416,0.032025,0.032572,0.033072,0.033549,0.034025,0.034495,0.03498,0.035496,0.03604,0.036629,0.037336,0.038202,0.039443,0.041463,0.056712],"gwanGol":[0.843128,0.935343,0.949459,0.958365,0.964629,0.969839,0.97431,0.978421,0.982256,0.985967,0.989588,0.993251,0.997057,1.001226,1.005664,1.010531,1.016238,1.023346,1.032971,1.051094,1.188786],"inJung":[0.000021,0.036034,0.046453,0.052634,0.057258,0.060989,0.064137,0.066973,0.069684,0.072222,0.074717,0.077175,0.079702,0.082376,0.085262,0.088551,0.092218,0.096861,0.103327,0.113582,0.207744],"chin":[0.192729,0.216076,0.219357,0.221454,0.2229,0.224114,0.225136,0.226067,0.226942,0.227818,0.228605,0.229401,0.230258,0.231147,0.232123,0.233231,0.234453,0.236013,0.238134,0.241826,0.277568],"upperOverRest":[0.175077,0.360357,0.384506,0.398752,0.409326,0.418247,0.425712,0.432508,0.438734,0.444795,0.450525,0.456298,0.462232,0.468598,0.475406,0.482718,0.491872,0.50235,0.517673,0.543977,0.74626],"midOverLow":[0.451919,0.746677,0.787327,0.813362,0.832666,0.849217,0.863269,0.876311,0.888441,0.899941,0.911097,0.922696,0.934799,0.948176,0.96219,0.977795,0.996404,1.019607,1.053571,1.113078,1.78648],"lowerUpperWidth":[0.212741,0.646521,0.696433,0.727483,0.749966,0.768313,0.784071,0.798731,0.812229,0.825473,0.838018,0.851123,0.864605,0.878702,0.894683,0.911612,0.931616,0.957308,0.993922,1.055989,1.929526],"cheonJiWidth":[0.518262,0.94698,1.006115,1.044595,1.073404,1.096958,1.117714,1.138042,1.156598,1.174918,1.193303,1.211427,1.23118,1.251985,1.275395,1.301553,1.333394,1.374602,1.435889,1.546741,4.700552],"cheonJiHeight":[0.306411,0.672436,0.721793,0.751385,0.774199,0.792341,0.807775,0.822469,0.835662,0.848598,0.861408,0.874202,0.887155,0.901083,0.916141,0.932878,0.952427,0.977526,1.011791,1.073576,1.743397]}};

function _cwRank(v, qs) {
  if (!qs || qs.length < 3 || v == null || !isFinite(v)) return 0.5;   // ★v792 null(계측 불가) → 중립
  if (v <= qs[0]) return 0;
  if (v >= qs[qs.length - 1]) return 1;
  var n = qs.length - 1;
  for (var i = 0; i < n; i++) {
    if (v <= qs[i + 1]) {
      var t = (v - qs[i]) / ((qs[i + 1] - qs[i]) || 1e-12);
      return (i + t) / n;
    }
  }
  return 1;
}

/* 등방 좌표 복원. A = 사진높이/사진폭 */
function _cwFaceIso(ai, A) {
  var a = (A && isFinite(A) && A > 0) ? A : 1, out = new Array(ai.length);
  for (var i = 0; i < ai.length; i++) out[i] = { x: ai[i].x, y: ai[i].y * a, z: ai[i].z || 0 };
  return out;
}

/* ★v792 P-792-A — 머리선(髮際) 탐지. 평가: _v792_work/p16 (실사진 23장 · D:\ChunWoon_IP\face\eval_hairline)
   입력 mask 는 머리카락 확률 0..255(hair_segmenter confidenceMasks[1]×255), 사진과 같은 종횡비·해상도.
   이마 가운데(LM10)에서 얼굴 위쪽(152→10 방향)으로 5개 열을 훑어 머리카락이 시작되는 지점을 찾는다.
   · 3열 이상이 LM10 에서 이미 머리카락 → BANGS(앞머리) · 3열 이상이 끝까지 없음/얇은 테두리뿐 → NO_HAIR(모자·민머리)
   · 머리선이 LM10 바로 위(얼굴길이 10% 미만)면 BANGS · 45% 초과면 NO_HAIR */
/* _cwHairline — 머리선(髮際) 탐지 · 순수 함수(브라우저·node 공용)
   mask: 머리카락 확률 0..255 (Uint8Array, 길이 mw*mh, 사진과 같은 종횡비) · ai: FaceMesh 정규화 랜드마크
   반환 {status:'OK'|'BANGS'|'NO_HAIR', hairline:{x,y}(정규화)|null, rel:(LM10→머리선)/(LM152→LM10), per:[...]} */
function _cwHairline(mask, mw, mh, ai, opt) {
  opt = opt || {};
  var P = function (i) { return { x: ai[i].x * mw, y: ai[i].y * mh }; };
  var p10 = P(10), p152 = P(152), p234 = P(234), p454 = P(454);
  var ux = p10.x - p152.x, uy = p10.y - p152.y, fh = Math.sqrt(ux * ux + uy * uy) || 1e-6;
  ux /= fh; uy /= fh;
  var qx = -uy, qy = ux;
  var fw = Math.sqrt(Math.pow(p454.x - p234.x, 2) + Math.pow(p454.y - p234.y, 2));
  var THR = opt.thr != null ? opt.thr : 128;
  var RUN = Math.max(2, Math.round((opt.run != null ? opt.run : 0.02) * fh));
  var TMAX = (opt.tmax != null ? opt.tmax : 0.9) * fh;
  var LOW = opt.low != null ? opt.low : 0.10, HIGH = opt.high != null ? opt.high : 0.45;
  var OFF = opt.off || [-0.08, -0.04, 0, 0.04, 0.08];
  var THICK = (opt.thick != null ? opt.thick : 0.06) * fh;   // 머리카락 층 최소 두께 — 민머리 윤곽 테두리(가장자리 잡음) 배제
  var at = function (x, y) {
    var xi = Math.round(x), yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= mw || yi >= mh) return -1;
    return mask[yi * mw + xi];
  };
  var per = [], i, t;
  for (i = 0; i < OFF.length; i++) {
    var sx = p10.x + qx * OFF[i] * fw, sy = p10.y + qy * OFF[i] * fw;
    if (at(sx, sy) >= THR) { per.push({ k: 'covered' }); continue; }
    var cnt = 0, found = null;
    for (t = 1; t <= TMAX; t++) {
      var v = at(sx + ux * t, sy + uy * t);
      if (v < 0) break;
      if (v >= THR) { if (++cnt >= RUN) { found = t - RUN + 1; break; } } else cnt = 0;
    }
    if (found != null) {
      // 머리카락 층 두께: 찾은 지점부터 위로 머리카락이 이어지는 길이. 사진 위 경계에 닿으면 충분한 것으로 본다.
      var gap = 0, ext = 0, edge = false;
      for (t = found; ; t++) {
        var w2 = at(sx + ux * t, sy + uy * t);
        if (w2 < 0) { edge = true; break; }
        if (w2 >= THR) { ext = t - found + 1; gap = 0; } else if (++gap > RUN) break;
      }
      if (!edge && ext < THICK) { per.push({ k: 'none', thin: ext }); continue; }
    }
    per.push(found == null ? { k: 'none' } : { k: 'hair', t: found });
  }
  var nC = per.filter(function (p) { return p.k === 'covered'; }).length;
  var nN = per.filter(function (p) { return p.k === 'none'; }).length;
  var ts = per.filter(function (p) { return p.k === 'hair'; }).map(function (p) { return p.t; }).sort(function (a, b) { return a - b; });
  var out = { status: 'OK', hairline: null, rel: null, per: per };
  if (nC >= 3) { out.status = 'BANGS'; return out; }
  if (nN >= 3 || !ts.length) { out.status = 'NO_HAIR'; return out; }
  var med = ts[(ts.length - 1) >> 1];
  if (ts.length % 2 === 0) med = (ts[ts.length / 2 - 1] + ts[ts.length / 2]) / 2;
  out.rel = med / fh;
  if (out.rel < LOW) { out.status = 'BANGS'; return out; }
  if (out.rel > HIGH) { out.status = 'NO_HAIR'; return out; }
  out.hairline = { x: (p10.x + ux * med) / mw, y: (p10.y + uy * med) / mh };
  return out;
}

/* 순수 계측 26축 — 분류·점수 이전 단계
   ★v792 — 세 번째 인자 hair = _cwHairline 결과(선택). 없거나 OK 가 아니면 上停은 계측 불가(null). */
function _cwFaceMeasure(aiRaw, A, hair) {
  var p = _cwFaceIso(aiRaw, A);
  var dx = function (a, b) { return Math.abs(p[a].x - p[b].x); };
  var dy = function (a, b) { return Math.abs(p[a].y - p[b].y); };
  var faceW = dx(234, 454) || 1e-6, faceH = dy(10, 152) || 1e-6;
  var jawW = dx(172, 397);            // ★하악각 (정정)
  var templeW = dx(127, 356) || 1e-6; // 관자 (구 jawW)
  var foreheadW = dx(21, 251);
  var leW = dx(33, 133), leH = dy(159, 145), reW = dx(362, 263), reH = dy(386, 374);
  var eyeW = (leW + reW) / 2, eyeH = ((leH + reH) / 2) || 1e-6;
  var lT = Math.atan2(p[33].y - p[133].y, dx(33, 133) || 1e-6) * 180 / Math.PI;
  var rT = Math.atan2(p[263].y - p[362].y, dx(362, 263) || 1e-6) * 180 / Math.PI;
  var tilt = (lT + rT) / 2;           // + 면 외안각이 아래 = 처진 눈

  /* 콧대 볼록도 — LM168(콧부리)→LM1(코끝) 현(弦) 대비 중간점 돌출 (y,z 평면) */
  var conv = 0;
  (function () {
    var A0 = p[168], B0 = p[1];
    var vy = B0.y - A0.y, vz = (B0.z || 0) - (A0.z || 0);
    var len = Math.sqrt(vy * vy + vz * vz) || 1e-6;
    var mids = [6, 197, 195, 5].filter(function (i) { return p[i]; });
    var mx = 0;
    for (var k = 0; k < mids.length; k++) {
      var q = p[mids[k]];
      var d = ((q.y - A0.y) * vz - ((q.z || 0) - (A0.z || 0)) * vy) / len;
      if (d > mx) mx = d;
    }
    conv = mx / (faceH || 1e-6);
  })();

  var lc = (p[33].x + p[133].x) / 2, rc = (p[362].x + p[263].x) / 2;
  var noseCx = p[1].x, faceCx = (p[234].x + p[454].x) / 2;
  var symmetry = 1 - Math.min(1, Math.abs(Math.abs(noseCx - lc) - Math.abs(rc - noseCx)) / faceW * 5);
  /* ★v792 P-792-A — 삼정(三停) 재정의 (근거·평가: _v792_work/p16 · 실사진 23장)
     구 대용 10(메시 꼭대기·髮際 아님)→168(콧부리)→1(코끝)→152 는 표준 얼굴에서 28/25/47% · thirds 0.46 이라
     거의 전원이 「삼정 편차」를 받았다. 원문 「髮際~眉 · 眉~鼻 · 鼻~頦」에 맞춰
       上停 = 머리선(hair_segmenter 로 검출)→눈썹선 · 中停 = 눈썹선→코 밑(LM2) · 下停 = LM2→턱(LM152)
     눈썹선 = 눈썹 머리 윗·아랫점(107/55 · 336/285) 평균 높이. 길이는 얼굴 세로축(152→10) 위 투영이라 고개 기울기에 불변.
     머리선이 가려지면(앞머리·모자·민머리) 上停 = null, 균형은 中·下停 2분으로 낸다(thirdsParts=2). */
  var aux = p[10].x - p[152].x, auy = p[10].y - p[152].y, aun = Math.sqrt(aux * aux + auy * auy) || 1e-6;
  aux /= aun; auy /= aun;
  var sAx = function (q) { return (q.x - p[152].x) * aux + (q.y - p[152].y) * auy; };
  var browLv = (sAx(p[55]) + sAx(p[285]) + sAx(p[107]) + sAx(p[336])) / 4;
  var tMid = browLv - sAx(p[2]), tLow = sAx(p[2]), tUp = null;
  if (hair && hair.status === 'OK' && hair.hairline) {
    var hu = sAx({ x: hair.hairline.x, y: hair.hairline.y * (A && A > 0 ? A : 1) }) - browLv;
    if (hu > 0) tUp = hu;
  }
  var thirdsParts = tUp != null ? 3 : 2, thirds, tTot;
  if (tUp != null) {
    tTot = tUp + tMid + tLow;
    var tId = tTot / 3;
    thirds = 1 - Math.min(1, (Math.abs(tUp - tId) + Math.abs(tMid - tId) + Math.abs(tLow - tId)) / tTot * 2);
  } else {
    thirds = 1 - Math.min(1, Math.abs(tMid - tLow) / ((tMid + tLow) || 1e-6) * 2);
  }
  /* ★v789 P-789-A/B — 눈썹 축 정정 (근거: _v789_work/p13_brow_axis_eval.js · canonical_face_model 실측)
     A. 꼬리 끝은 LM46/276 이다(하단 윤곽 46→53→52→65→55). 구 식은 LM53 까지만 재서 길이의 83% 만 잡았다
        (표준 얼굴 눈썹/눈 폭 1.30 → 정정 1.56). 眉過眼(OGWAN R020/R021) 판정이 乏財 쪽으로 기울었다.
     B. 구 식 atan2(dy, 음수 dx) 는 ±180° 근처 값을 내고 꼬리가 머리보다 내려가면 +178↔−178 로 뒤집혔다
        (셀카 반전 −2.7° vs 업로드 −177.3°). ⟹ 수평 거리는 절댓값, 높이는 머리−꼬리.
        + = 꼬리가 머리보다 위(頭低尾高) · − = 아래(頭高尾低) · 0 = 수평. 좌우 반전·사진 비율 불변. */
  var bLen = function (t, h) { return Math.sqrt(Math.pow(p[t].x - p[h].x, 2) + Math.pow(p[t].y - p[h].y, 2)); };
  var bAng = function (t, h) { return Math.atan2(p[h].y - p[t].y, Math.abs(p[t].x - p[h].x) || 1e-6) * 180 / Math.PI; };
  var browLen = (bLen(46, 55) + bLen(276, 285)) / 2;
  var browAng = (bAng(46, 55) + bAng(276, 285)) / 2;

  return {
    whRatio: faceW / faceH,
    jawRatio: jawW / faceW,
    templeRatio: templeW / faceW,
    foreheadRatio: foreheadW / faceW,
    eyeAspect: eyeW / eyeH,
    eyeSize: eyeW / faceW,
    eyeTilt: tilt,
    eyeSymmetry: 1 - Math.min(1, Math.abs(leW - reW) / (eyeW || 1e-6)),
    noseWRatio: dx(129, 358) / faceW,
    noseHRatio: dy(1, 168) / faceH,
    noseDorsum: conv,
    noseCenter: 1 - Math.min(1, Math.abs(noseCx - faceCx) / faceW * 8),
    mouthRatio: dx(61, 291) / faceW,
    mouthOverIP: dx(61, 291) / (Math.abs(rc - lc) || 1e-6),
    lipThickness: (dy(13, 0) + dy(17, 14)) / faceH,
    mouthCenter: 1 - Math.min(1, Math.abs((p[61].x + p[291].x) / 2 - faceCx) / faceW * 8),
    symmetry: symmetry,
    thirds: thirds,
    thirdsParts: thirdsParts,                         // ★v792 3 = 上停 포함 · 2 = 上停 계측 불가
    upperThirdPct: tUp != null ? tUp / tTot * 100 : null,
    middleThirdPct: tUp != null ? tMid / tTot * 100 : null,
    lowerThirdPct: tUp != null ? tLow / tTot * 100 : null,
    upperOverRest: tUp != null ? tUp / ((tMid + tLow) || 1e-6) : null,   // ★v792 上停 / (中+下) — REL
    midOverLow: tMid / (tLow || 1e-6),                                   // ★v792 中停 / 下停 — REL · 항상 계측
    myungGung: dx(55, 285) / faceW,
    cheonI: 1 - Math.min(1, Math.abs(dx(21, 234) - dx(454, 251)) / faceW * 5),
    jaNyeo: (dy(117, 145) + dy(346, 374)) / 2 / faceH,
    jilAek: dx(188, 412) / faceW,
    /* ★v792 P-790-H — 눈썹 윤곽 정정(근거: canonical_face_model · _v790_work/p15 B1·B2)
       63/66(좌)·293/296(우)은 ★둘 다 윗윤곽(70→63→105→66→107)이다. 아랫윤곽은 46→53→52→65→55.
       구 전택궁 = 상안검↔눈썹 ★윗선(표준 0.121) · 구 두께 = 윗선 두 점의 높이차(표준 0.017, 두께 아님).
       ⟹ 전택궁 = 상안검 159 ↔ 눈썹 아랫선 52(우 386↔282) · 두께 = 윗선 105 ↔ 아랫선 52(우 334↔282), 눈썹 중앙. */
    jeonTaek: (dy(159, 52) + dy(386, 282)) / 2 / faceH,
    browLength: browLen / faceW,
    browAngle: browAng,
    browThick: (dy(105, 52) + dy(334, 282)) / 2 / faceH,
    gwanGol: faceW / templeW,
    inJung: dy(0, 2) / faceH,
    chin: dy(152, 17) / faceH,

    /* ── ★v786-c · G4 차원 정합 축 ──────────────────────────────
       相理衡眞 직독(2026-09-05)에서 드러난 결함: 「天庭·地角 上下相應」은
       원문이 비교 대상을 다 주는데(TEXT 등급), 우리 축은 foreheadRatio 가 폭(/faceW)이고
       chin 이 길이(/faceH)라 ★차원이 달라 비교 자체가 성립하지 않았다.
       ⟹ 같은 차원끼리 짝지은 비(比) 축을 신설한다. 1.0 = 「相應(서로 걸맞다)」.
       ★이 세 축은 분모가 같으므로 ★분위수 랭크가 아니라 원시값으로 비교해야 TEXT 등급이 유지된다. */
    lowerUpperWidth: jawW / (foreheadW || 1e-6),   // 하악각폭 / 이마폭 — 「上尖下豐」의 방향
    cheonJiWidth: foreheadW / (jawW || 1e-6),      // 天庭 / 地角 (폭)
    cheonJiHeight: tUp != null ? tUp / (tLow || 1e-6) : null,   // 上停 / 下停 (높이) · ★v792 머리선 기준 · 계측 불가면 null

    /* ── 구 명칭 별칭 (기존 화면·프리미엄 렌더러 호환) ──
       ★jawRatio 는 이제 진짜 하악각 폭이다. 화면의 '턱비율' 표기가 비로소 맞다. */
    eyeRatio: eyeW / eyeH,
    eyeSizeRatio: eyeH / faceH,
    mouthFaceRatio: dx(61, 291) / (Math.abs(rc - lc) || 1e-6),
    lipThicknessRatio: (dy(13, 0) + dy(17, 14)) / faceH,
    thirdsScore: thirds,
    goldenProximity: 1 - Math.min(1, Math.abs(faceH / faceW - 1.618) / 1.618),
    myungGungRatio: dx(55, 285) / faceW,
    foreheadWidthRatio: foreheadW / faceW,
    templeBalance: 1 - Math.min(1, Math.abs(dx(21, 234) - dx(454, 251)) / faceW * 5),
    eyeTailAngle: tilt,
    underEyeRatio: (dy(117, 145) + dy(346, 374)) / 2 / faceH,
    sanGeunRatio: dx(188, 412) / faceW,
    jeonTaekRatio: (dy(159, 52) + dy(386, 282)) / 2 / faceH,
    browLengthRatio: browLen / faceW,
    browGapRatio: dx(55, 285) / faceW,
    browThicknessRatio: (dy(105, 52) + dy(334, 282)) / 2 / faceH,
    gwanGolProminence: faceW / templeW,
    inJungRatio: dy(0, 2) / faceH,
    chinRatio: dy(152, 17) / faceH,
    jawAngle: (Math.atan2(p[152].y - p[172].y, Math.abs(p[172].x - p[152].x) || 1e-6) +
      Math.atan2(p[152].y - p[397].y, Math.abs(p[152].x - p[397].x) || 1e-6)) / 2 * 90 / Math.PI
  };
}

/* 분류축 24개 — 시그니처·프롬프트 결정변수 */
var CW_FACE_AXES = ['whRatio', 'jawRatio', 'foreheadRatio', 'eyeAspect', 'eyeSize', 'eyeTilt',
  'noseWRatio', 'noseHRatio', 'noseDorsum', 'mouthRatio', 'lipThickness', 'symmetry',
  'thirds', 'myungGung', 'cheonI', 'jaNyeo', 'jilAek', 'jeonTaek',
  'browLength', 'browAngle', 'browThick', 'gwanGol', 'inJung', 'chin',
  /* ★v786-c · G5 — 재고 있으면서 분류에 안 쓰던 삼정 3축을 승격.
     「고른가(thirds)」만 묻고 「긴가」는 안 묻던 구조였다. */
  /* ★v792 P-792-A — 삼정 3축(비율 %)은 上停이 계측 불가면 셋 다 null 이 된다. 상대축은 항상 계측되는 비로 바꾼다. */
  'upperOverRest', 'midOverLow',
  /* ★v786-c · G4 — 차원 정합 비교축 */
  'lowerUpperWidth', 'cheonJiWidth', 'cheonJiHeight'];

/* ════════════════════════════════════════════════════════════════════
   ★v786-b — 축의 성질을 두 종류로 나눈다. 이걸 안 나눈 것이 v786-a 의 결함이었다.

   ABS  ★자기참조 절대축 — 관상학 원문이 **기준을 스스로 준다**.
        「三停均等」(삼정이 고르다) · 「左右均衡」 · 「五官相稱」(오관이 서로 걸맞다)
        ⟹ 모집단이 필요 없다. 1.0 = 원문이 말하는 「고르다」에 완전 부합.
        ⟹ ★분위수 랭크로 바꾸면 **절대 기준이 상대 순위로 바뀌어 교리가 사라진다.**
           v786-a 가 정확히 그 잘못을 했다. 여기서 되돌린다.

   REL  상대축 — 원문은 「準頭豐隆」(코끝이 도톰하다)처럼 **정량 기준을 주지 않는다**.
        ⟹ 「도톰하다」를 판정하려면 비교 모집단이 있어야 한다.
        ⟹ 그 모집단이 우리 몫이므로 ★TIER 표기가 반드시 따라붙는다.

   ★이 구분은 「다양성」과 「교리」가 충돌할 때 어느 쪽이 옳은지를 정해 준다:
     ABS 축은 사람마다 비슷하게 나오는 것이 **정상**이다. 억지로 벌리면 그게 왜곡이다.
     사람을 구분하는 일은 REL 축이 맡는다.
   ════════════════════════════════════════════════════════════════════ */
var CW_FACE_AXIS_KIND = {
  symmetry: 'ABS',   // 左右均衡 — 코 중심 대비 좌우 눈 거리의 상칭
  thirds: 'ABS',     // 三停均等 — 상·중·하정이 고른가
  cheonI: 'ABS',     // 遷移宮 좌우 균형
  whRatio: 'REL', jawRatio: 'REL', foreheadRatio: 'REL', eyeAspect: 'REL', eyeSize: 'REL',
  eyeTilt: 'REL', noseWRatio: 'REL', noseHRatio: 'REL', noseDorsum: 'REL', mouthRatio: 'REL',
  lipThickness: 'REL', myungGung: 'REL', jaNyeo: 'REL', jilAek: 'REL', jeonTaek: 'REL',
  browLength: 'REL', browAngle: 'REL', browThick: 'REL', gwanGol: 'REL', inJung: 'REL', chin: 'REL',
  upperOverRest: 'REL', midOverLow: 'REL',
  /* ★G4 세 축은 ABS 다 — 원문이 「相應(서로 걸맞다)」이라는 기준을 스스로 주기 때문이다.
     1.0 에서 얼마나 벗어났는가가 곧 판정이고, 모집단이 필요 없다. */
  lowerUpperWidth: 'ABS', cheonJiWidth: 'ABS', cheonJiHeight: 'ABS'
};

/* ════════════════════════════════════════════════════════════════════
   ★v786-c — 五形(오형) 부합도. ★종전 「단일 라벨 + 오행 배당」을 폐기한다.

   ★★원문 직독으로 밝혀진 것 (相理衡眞 卷六 五行形相論, 2026-09-05 판독):
     「金方、木瘦、水圓、火尖、土厚」
     「火主明 … 其形銳而下豐 … 上尖如火之炎」
   ⟹ ★火形은 **위가 뾰족하고 아래가 풍만**한 형이다.
   ⟹ ★종전 코드는 火形을 **역삼각형(이마 넓고 턱 좁음)** 에 배당했다 — ★상하가 뒤집혀 있었다.

   ★★그리고 더 중요한 것: 원문의 五形 조건은 다섯 조 **전부에 거동 조항**(坐·涉·行·臥)과
     색(色黃·色赤氣枯)·몸통(露臂露背·腰)·살뼈(肉輕骨重) 조건이 붙어 있다.
   ⟹ ★**정면 사진 한 장으로 오형을 확정하는 것은 원문 절차가 아니다.**
   ⟹ 그래서 단일 라벨을 버리고 **부합도 벡터 + 커버리지**를 낸다. 확정하지 않는다.

   ★五常 배당도 원문으로 정정: 金為義·木為仁·水為智·火為禮·土為信.
     종전의 「水=원만·포용·재물복」류 문구는 ★이 원전에서 온 것이 아니다.
   ════════════════════════════════════════════════════════════════════ */
var CW_WUXING = {
  木: { form: '瘦(마름)·長', virtue: '仁', locus: '相理衡眞 卷六 五行形相論' },
  火: { form: '尖 — 上尖下豐(위가 뾰족하고 아래가 풍만)', virtue: '禮', locus: '同' },
  土: { form: '厚·肥', virtue: '信', locus: '同' },
  金: { form: '方(모남)', virtue: '義', locus: '同' },
  水: { form: '圓(둥긂)', virtue: '智', locus: '同' }
};

/* 메인 — 반환 형상은 종전 코드와 호환 유지 (shapeOpt/eyeOpt/noseOpt/mouthOpt/…/ratios) */
function classifyFaceFromLandmarks(ai, aspect, hair) {
  var A = aspect;
  if (!(A > 0)) A = (typeof window !== 'undefined' && window._cwFaceAspect) || 1;
  if (hair === undefined) hair = (typeof window !== 'undefined' && window._cwHair) || null;   // ★v792 머리선(선택)
  var m = _cwFaceMeasure(ai, A, hair);
  var R = {}, i;
  for (i = 0; i < CW_FACE_AXES.length; i++) {
    var k = CW_FACE_AXES[i];
    R[k] = _cwRank(m[k], CW_FACE_REF.q[k]);
  }

  /* ── 얼굴형 (분위수 기반 · 4종 전부 도달) ──
     ★v786-c — 역삼각형 판정을 ★랭크 차가 아니라 원시값 비교로 바꾼다.
       foreheadRatio 와 jawRatio 는 분모가 둘 다 faceW 라 ★원시값 비교가 성립하고,
       그러면 이 판정은 TEXT 등급(모집단 불필요)을 유지한다.
       종전처럼 랭크를 빼면 TIER-C 합성 모집단에 의존하게 되어 POPULATION 으로 격하됐다. */
  var shapeV;
  if (R.whRatio < 0.25) shapeV = 'long';
  else if (R.jawRatio > 0.62) shapeV = 'square';
  else if (m.cheonJiWidth > 1.06) shapeV = 'inv';   // 이마폭이 하악각폭보다 6% 이상 넓다
  else shapeV = 'round';

  /* ── 눈 ── */
  var eyeV;
  if (R.eyeTilt > 0.78) eyeV = 'droopy';
  else if (R.eyeSize > 0.70) eyeV = 'big';
  else if (R.eyeAspect > 0.62) eyeV = 'narrow';
  else eyeV = 'round';

  /* ── 코 (매부리코는 콧대 볼록도로 판정 — 종전엔 도달 불가였다) ── */
  var noseV;
  if (R.noseDorsum > 0.93) noseV = 'hooked';
  else if (R.noseWRatio > 0.66) noseV = 'wide';
  else if (R.noseHRatio < 0.30 && R.noseWRatio < 0.45) noseV = 'small';
  else noseV = 'high';

  /* ── 입 ── */
  var mouthV;
  if (R.lipThickness > 0.76) mouthV = 'thick';
  else if (R.lipThickness < 0.24) mouthV = 'thin';
  else if (R.mouthRatio > 0.52) mouthV = 'big';
  else mouthV = 'small';

  var pick = function (arr, v) { for (var j = 0; j < arr.length; j++) if (arr[j].v === v) return arr[j]; return arr[0]; };
  var sc = function (r, lo, hi) { return Math.round(lo + Math.max(0, Math.min(1, r)) * (hi - lo)); };

  /* ── 조화도(和) — ★ABS 축만. 원문의 절대 기준을 그대로 쓴다.
        ★분위수 랭크를 쓰지 않는다. 「三停均等」은 순위가 아니라 상태다.
        ★대부분 사람이 비슷한 값을 받는 것이 정상이다 — 그것이 원문이 말하는 바다.
        오관상칭(五官相稱): 눈·코·입의 폭이 서로 걸맞은가를 자기참조로 잰다. */
  var organProp = 1 - Math.min(1, (
    Math.abs(m.eyeSize * 2 / (m.noseWRatio || 1e-6) - 1.62) / 1.62 +
    Math.abs(m.mouthRatio / (m.noseWRatio || 1e-6) - 1.62) / 1.62
  ) / 2);
  var harmony = Math.round(100 * (
    0.32 * m.symmetry + 0.32 * m.thirds + 0.18 * m.cheonI + 0.18 * organProp
  ));

  /* ── 특징(格) — ★REL 축만. 이 사람을 남과 구분하는 것은 여기다.
        중앙(0.5)에서 가장 멀리 떨어진 축을 뽑는다. */
  var dist = [];
  for (i = 0; i < CW_FACE_AXES.length; i++) {
    var ak = CW_FACE_AXES[i];
    if (CW_FACE_AXIS_KIND[ak] !== 'REL') continue;
    dist.push({ axis: ak, rank: R[ak], dev: Math.abs(R[ak] - 0.5) });
  }
  dist.sort(function (a, b) { return b.dev - a.dev; });
  var distinctAxes = dist.slice(0, 5);

  var overall = harmony;

  /* ── 五形 부합도 벡터 (★단일 라벨 확정을 하지 않는다) ──
     원문 네 글자(方·瘦·圓·尖)를 우리 축으로 직역한 것만 낸다.
     ★土(厚·肥)는 살집·몸통 조건이라 우리 센서로 잴 수 없다 ⟹ null. 억지로 배당하지 않는다.
     ★covered: 원문 조건 계열 4개(형태·색·몸통·거동) 중 우리가 잰 것은 형태 하나뿐이다. */
  var clamp01 = function (x) { return Math.max(0, Math.min(1, x)); };
  var wuxingFit = {
    木: { fit: clamp01(1 - R.whRatio), basis: '瘦·長 — 세로로 길고 마름', axes: ['whRatio'], confidence: 'MED' },
    // ★2축 이상은 기하평균을 쓴다 — 곱을 그대로 쓰면 단일축(木)과 스케일이 달라 top 비교가 불공정해진다.
    火: { fit: clamp01(Math.sqrt(R.jawRatio * (1 - R.foreheadRatio))), basis: '尖 — 上尖下豐(위 좁고 아래 넓음)', axes: ['jawRatio', 'foreheadRatio', 'lowerUpperWidth'], confidence: 'MED' },
    土: { fit: null, basis: '厚·肥 — 살집·몸통·거동 조건. ★센서 부재로 판정 불가', axes: [], confidence: 'NONE' },
    金: { fit: clamp01(Math.min(R.jawRatio, R.foreheadRatio)), basis: '方 — 위아래가 모두 넓어 모남', axes: ['jawRatio', 'foreheadRatio'], confidence: 'MED' },
    水: { fit: clamp01(Math.sqrt(R.whRatio * (1 - R.jawRatio))), basis: '圓 — 넓되 각지지 않음 ★「圓」의 해석이 들어감', axes: ['whRatio', 'jawRatio'], confidence: 'LOW' }
  };
  var wuxingTop = null, wuxingBest = -1;
  for (var wk in wuxingFit) {
    if (wuxingFit[wk].fit !== null && wuxingFit[wk].fit > wuxingBest) { wuxingBest = wuxingFit[wk].fit; wuxingTop = wk; }
  }

  var sig = '';
  for (i = 0; i < CW_FACE_AXES.length; i++) {
    var r = R[CW_FACE_AXES[i]];
    sig += (r < 0.10 ? 0 : r < 0.30 ? 1 : r < 0.70 ? 2 : r < 0.90 ? 3 : 4);
  }

  return {
    shapeOpt: pick(FACE_S, shapeV), eyeOpt: pick(FACE_E, eyeV),
    noseOpt: pick(FACE_N, noseV), mouthOpt: pick(FACE_M, mouthV),
    overallScore: overall,
    /* ★v786-b — 성질이 다른 두 값을 분리해 내보낸다. 화면·프롬프트가 섞어 쓰면 안 된다. */
    harmonyScore: harmony,          // ABS · 절대 기준 · 「대부분 여기 듭니다」를 함께 표기할 것
    harmonyParts: { symmetry: m.symmetry, thirds: m.thirds, cheonI: m.cheonI, organProp: organProp },
    distinctAxes: distinctAxes,     // REL · 이 사람을 구분하는 축 5개
    axisKind: CW_FACE_AXIS_KIND,
    /* ★v786-c — 五形은 ★확정하지 않고 부합도로만 낸다 (§원문 절차 근거는 CW_WUXING 주석) */
    wuxing: wuxingFit,
    wuxingTop: wuxingTop,
    wuxingTable: CW_WUXING,
    wuxingCoverage: {
      measured: ['형태(方·瘦·圓·尖)'],
      notMeasured: ['색(色黃·色赤氣枯)', '몸통(露臂露背·腰)', '살뼈(肉輕骨重)', '거동(坐·涉·行·臥)'],
      note: '원문은 五形마다 네 계열을 함께 본다. 정면 사진 한 장으로 확정하는 것은 원문 절차가 아니다.'
    },
    eyeScore: sc((R.eyeSize + R.jeonTaek + (1 - Math.abs(R.eyeTilt - 0.5) * 2)) / 3, 62, 97),
    noseScore: sc((R.noseWRatio + R.noseHRatio + R.jilAek) / 3, 62, 97),
    mouthScore: sc((R.mouthRatio + R.lipThickness + R.inJung) / 3, 62, 97),
    refVersion: CW_FACE_REF.version, refTier: CW_FACE_REF.tier,
    aspect: A,
    ranks: R,
    signature: sig,
    ratios: m
  };
}
