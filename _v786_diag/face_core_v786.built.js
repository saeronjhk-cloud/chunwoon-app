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
var CW_FACE_REF = {"version":"REF-SYNTH-v792-CANON-20260929","tier":"C-SYNTHETIC","n":60000,"q":{"whRatio":[0.445843,0.738381,0.772659,0.793848,0.809434,0.821744,0.83219,0.841474,0.850606,0.859178,0.867455,0.876121,0.884331,0.89333,0.903263,0.913836,0.92626,0.942047,0.963221,1.000119,1.348538],"jawRatio":[0.274685,0.616446,0.659573,0.686094,0.704639,0.719737,0.732518,0.743756,0.754579,0.764982,0.775233,0.785158,0.795327,0.806165,0.817936,0.830448,0.845336,0.863867,0.888772,0.932314,1.267339],"foreheadRatio":[0.547961,0.804306,0.836635,0.856259,0.870404,0.881932,0.89168,0.900513,0.908824,0.9167,0.924519,0.932431,0.940189,0.94835,0.957401,0.967751,0.979609,0.994742,1.014507,1.047552,1.376936],"eyeAspect":[1.699451,3.18995,3.374474,3.487639,3.566063,3.627464,3.681175,3.730303,3.77537,3.818989,3.863036,3.90561,3.949335,3.996352,4.046241,4.102267,4.165539,4.246565,4.355707,4.54303,6.248254],"eyeSize":[0.080662,0.144406,0.150977,0.154941,0.15781,0.160155,0.16224,0.164059,0.165735,0.167316,0.16888,0.170383,0.172006,0.173708,0.175527,0.177609,0.179913,0.182749,0.186649,0.193339,0.256877],"eyeTilt":[-36.21037,-11.760155,-9.02815,-7.338326,-6.139842,-5.191033,-4.382007,-3.661871,-2.994899,-2.349095,-1.727256,-1.093811,-0.435791,0.226241,0.966975,1.774853,2.734975,3.894811,5.530572,8.373454,33.406779],"noseWRatio":[0.118276,0.199263,0.208547,0.213987,0.217863,0.22108,0.223937,0.226465,0.228741,0.230943,0.233092,0.235192,0.237415,0.239693,0.242186,0.244911,0.248099,0.252172,0.257569,0.266708,0.346659],"noseHRatio":[0.125203,0.212595,0.222646,0.228493,0.23276,0.236192,0.239165,0.241829,0.244274,0.24661,0.248896,0.251206,0.253564,0.256036,0.258656,0.261484,0.265088,0.26945,0.275283,0.285336,0.365408],"noseDorsum":[0,0.010283,0.0154,0.018506,0.020627,0.022451,0.024029,0.025478,0.026887,0.028205,0.029521,0.030898,0.032329,0.033811,0.035457,0.037287,0.039545,0.042342,0.0462,0.05275,0.110453],"mouthRatio":[0.16431,0.265253,0.279451,0.288335,0.294928,0.300059,0.304639,0.308768,0.312468,0.316133,0.319689,0.323365,0.327054,0.330873,0.335074,0.339852,0.345291,0.352071,0.361237,0.377113,0.555692],"lipThickness":[0.029446,0.064536,0.06867,0.071136,0.072902,0.074378,0.075618,0.076763,0.077809,0.078807,0.079785,0.080757,0.081801,0.082865,0.083983,0.085233,0.086712,0.088523,0.091107,0.09545,0.132702],"symmetry":[0.389251,0.77096,0.8186,0.847601,0.867938,0.884529,0.897649,0.908637,0.91891,0.927956,0.936081,0.943614,0.950722,0.957684,0.964059,0.970505,0.976579,0.982428,0.98833,0.994202,1],"thirds":[0,0.26755,0.320419,0.351724,0.374433,0.392372,0.407356,0.421573,0.434216,0.446371,0.45812,0.469952,0.481889,0.495195,0.508766,0.523766,0.540979,0.562419,0.591551,0.641916,0.986069],"myungGung":[0.055637,0.12937,0.137524,0.142465,0.146008,0.148839,0.151285,0.153474,0.15544,0.157481,0.159399,0.161264,0.163143,0.165235,0.167384,0.169795,0.172623,0.176235,0.181092,0.189278,0.259468],"cheonI":[0.644268,0.869488,0.896846,0.913156,0.924714,0.933845,0.941407,0.947951,0.953759,0.958824,0.963612,0.968054,0.972194,0.976082,0.979742,0.983316,0.986838,0.990232,0.99362,0.99681,1],"jaNyeo":[0.027083,0.061703,0.065712,0.068107,0.069831,0.071226,0.072421,0.073498,0.074448,0.075396,0.076342,0.077246,0.078179,0.079167,0.080237,0.081441,0.082799,0.084533,0.086928,0.090679,0.12399],"jilAek":[0.049618,0.10035,0.106575,0.110335,0.11305,0.115264,0.117158,0.118866,0.120501,0.122013,0.12348,0.125018,0.126498,0.128031,0.129769,0.131726,0.13396,0.136761,0.140463,0.146689,0.203975],"jeonTaek":[0.028528,0.069688,0.074482,0.077342,0.079383,0.081123,0.082556,0.083874,0.085074,0.086224,0.087369,0.088478,0.089626,0.090879,0.092182,0.093644,0.095333,0.097432,0.100348,0.105204,0.145763],"browLength":[0.136021,0.222007,0.233279,0.239881,0.24469,0.248735,0.252214,0.255335,0.258189,0.260838,0.263538,0.266286,0.269022,0.271989,0.275015,0.278493,0.282537,0.287484,0.294315,0.305662,0.385106],"browAngle":[-33.005531,-10.544161,-8.553809,-7.420763,-6.612459,-5.988135,-5.444251,-4.962285,-4.513087,-4.102014,-3.705218,-3.293045,-2.881349,-2.43977,-1.966337,-1.454752,-0.847191,-0.087513,0.934267,2.713896,23.804512],"browThick":[0.009919,0.026579,0.028623,0.029843,0.030718,0.03142,0.03204,0.032585,0.033106,0.033597,0.034068,0.034531,0.035012,0.035516,0.036071,0.036702,0.037421,0.038279,0.039462,0.041502,0.062653],"gwanGol":[0.808554,0.935757,0.950081,0.958435,0.964976,0.970174,0.974862,0.978882,0.982634,0.986335,0.989746,0.993331,0.99705,1.001019,1.005411,1.010381,1.016314,1.023662,1.033844,1.051259,1.229483],"inJung":[0.000017,0.035995,0.046665,0.052866,0.057351,0.060947,0.064197,0.067024,0.069706,0.072253,0.07474,0.077169,0.079762,0.082425,0.085343,0.088591,0.09229,0.097005,0.103469,0.114277,0.206755],"chin":[0.190605,0.216199,0.219539,0.221521,0.222976,0.224157,0.22517,0.226108,0.22699,0.227822,0.22864,0.229464,0.230302,0.231195,0.232148,0.233232,0.234484,0.236056,0.238188,0.241743,0.277547],"upperThirdPct":[16.461925,25.171753,26.046062,26.555511,26.904518,27.199355,27.448931,27.667059,27.867943,28.061672,28.247034,28.435552,28.629634,28.826769,29.036199,29.269231,29.549792,29.884556,30.336014,31.07495,36.293198],"middleThirdPct":[12.520278,21.259467,22.264619,22.849274,23.276002,23.619199,23.91649,24.182921,24.427435,24.661002,24.889629,25.120623,25.35644,25.603641,25.865591,26.148352,26.508803,26.945049,27.528285,28.533602,36.540846],"lowerThirdPct":[31.745264,42.271489,43.540947,44.2705,44.807641,45.2387,45.613487,45.952966,46.285754,46.584042,46.880073,47.173743,47.477521,47.79366,48.149112,48.523582,48.972425,49.540233,50.322863,51.644573,63.120794],"lowerUpperWidth":[0.282955,0.64499,0.695952,0.726961,0.749777,0.768198,0.784496,0.798946,0.81244,0.825826,0.838306,0.851158,0.864324,0.878562,0.893846,0.910296,0.93103,0.956822,0.992537,1.056753,1.813736],"cheonJiWidth":[0.551348,0.946295,1.007519,1.045127,1.074079,1.098544,1.118761,1.138223,1.156974,1.17487,1.192886,1.210909,1.23086,1.25165,1.274704,1.301747,1.333731,1.375589,1.43688,1.550412,3.534125],"cheonJiHeight":[0.270352,0.497749,0.524932,0.541893,0.554224,0.56432,0.573006,0.581048,0.588489,0.595774,0.602744,0.609675,0.617125,0.62489,0.63323,0.642537,0.653757,0.667543,0.687347,0.720574,1.054984]}};

function _cwRank(v, qs) {
  if (!qs || qs.length < 3 || !isFinite(v)) return 0.5;
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

/* 순수 계측 26축 — 분류·점수 이전 단계 */
function _cwFaceMeasure(aiRaw, A) {
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
  var t1 = p[168].y - p[10].y, t2 = p[1].y - p[168].y, t3 = p[152].y - p[1].y;
  var tot = (t1 + t2 + t3) || 1e-6, id = tot / 3;
  var thirds = 1 - Math.min(1, (Math.abs(t1 - id) + Math.abs(t2 - id) + Math.abs(t3 - id)) / tot * 2);
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
    upperThirdPct: t1 / tot * 100,
    middleThirdPct: t2 / tot * 100,
    lowerThirdPct: t3 / tot * 100,
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
    cheonJiHeight: t1 / (t3 || 1e-6),              // 上停 / 下停 (높이) — 둘 다 세로라 정합

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
  'upperThirdPct', 'middleThirdPct', 'lowerThirdPct',
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
  upperThirdPct: 'REL', middleThirdPct: 'REL', lowerThirdPct: 'REL',
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
function classifyFaceFromLandmarks(ai, aspect) {
  var A = aspect;
  if (!(A > 0)) A = (typeof window !== 'undefined' && window._cwFaceAspect) || 1;
  var m = _cwFaceMeasure(ai, A);
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
