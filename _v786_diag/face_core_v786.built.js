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
var CW_FACE_REF = {"version":"REF-SYNTH-v786-20260904","tier":"C-SYNTHETIC","n":60000,"q":{"whRatio":[0.407848,0.692997,0.724158,0.743239,0.757152,0.768557,0.778104,0.786587,0.79474,0.802166,0.809638,0.817228,0.825056,0.832943,0.841829,0.851432,0.86258,0.876035,0.894773,0.926912,1.19032],"jawRatio":[0.247816,0.620421,0.663718,0.689715,0.708802,0.724414,0.737634,0.749428,0.760172,0.77032,0.78018,0.789616,0.799933,0.810473,0.821857,0.835249,0.850254,0.869365,0.894155,0.93769,1.391987],"foreheadRatio":[0.546503,0.807974,0.840449,0.860173,0.874599,0.886147,0.89602,0.905174,0.913643,0.921569,0.929283,0.937149,0.945143,0.953402,0.962724,0.972751,0.984256,0.998709,1.018995,1.052692,1.350376],"eyeAspect":[1.156242,2.559954,2.704639,2.791947,2.855123,2.906754,2.952674,2.992718,3.02963,3.064445,3.098879,3.131992,3.167727,3.205209,3.245255,3.291119,3.34185,3.404291,3.490173,3.637505,5.036655],"eyeSize":[0.110026,0.18344,0.192157,0.197195,0.200843,0.203816,0.206375,0.208701,0.210848,0.212835,0.214832,0.216896,0.218937,0.221098,0.223384,0.22587,0.228898,0.232497,0.237475,0.245765,0.317671],"eyeTilt":[-38.014736,-11.860404,-9.46983,-8.011624,-7.011827,-6.202656,-5.511137,-4.896721,-4.347158,-3.797396,-3.2747,-2.735884,-2.191682,-1.625298,-1.010543,-0.332416,0.481002,1.437842,2.843633,5.23174,24.67981],"noseWRatio":[0.148367,0.226966,0.237283,0.243295,0.247727,0.251465,0.254536,0.257365,0.260028,0.26266,0.265097,0.267543,0.270051,0.272636,0.275539,0.278677,0.282355,0.286914,0.293149,0.303602,0.392698],"noseHRatio":[0.126902,0.213796,0.223757,0.229594,0.233754,0.237205,0.240271,0.242982,0.245425,0.247788,0.250093,0.252346,0.254731,0.257176,0.259851,0.262775,0.266194,0.270565,0.276355,0.286161,0.371943],"noseDorsum":[0,0,0,0,0,0,0,0,0.000322,0.001816,0.003327,0.004874,0.006509,0.008219,0.010095,0.012181,0.014759,0.017939,0.022307,0.029788,0.09049],"mouthRatio":[0.163093,0.288393,0.303795,0.313331,0.32016,0.325968,0.330808,0.335247,0.339378,0.343331,0.347193,0.351033,0.355079,0.359214,0.363729,0.368664,0.374953,0.38231,0.392696,0.409921,0.563989],"lipThickness":[0.034763,0.076005,0.080691,0.083545,0.085641,0.087297,0.088738,0.09005,0.091282,0.092412,0.093541,0.094628,0.095757,0.097024,0.098286,0.099727,0.101382,0.10349,0.10634,0.111266,0.150819],"symmetry":[0.389251,0.77096,0.8186,0.847601,0.867938,0.884529,0.897649,0.908637,0.91891,0.927956,0.936081,0.943614,0.950722,0.957684,0.964059,0.970505,0.976579,0.982428,0.98833,0.994202,1],"thirds":[0.174276,0.521852,0.561696,0.585044,0.601682,0.615486,0.627749,0.638596,0.648368,0.657817,0.667035,0.676049,0.685591,0.695368,0.706062,0.71776,0.731422,0.748875,0.771964,0.810518,0.813333],"myungGung":[0.038418,0.08933,0.09496,0.098372,0.100819,0.102774,0.104463,0.105974,0.107332,0.108741,0.110065,0.111353,0.11265,0.114095,0.115578,0.117243,0.119196,0.12169,0.125044,0.130696,0.179163],"cheonI":[0.644268,0.86934,0.896915,0.913127,0.92476,0.933938,0.941515,0.948027,0.953892,0.958943,0.963712,0.968123,0.972248,0.97613,0.979836,0.983408,0.986914,0.990268,0.993642,0.99683,1],"jaNyeo":[0.02661,0.060624,0.064563,0.066916,0.068611,0.069981,0.071156,0.072213,0.073147,0.074078,0.075008,0.075896,0.076812,0.077783,0.078835,0.080017,0.081352,0.083055,0.085409,0.089095,0.121823],"jilAek":[0.028118,0.056868,0.060395,0.062526,0.064064,0.065319,0.066393,0.06736,0.068287,0.069144,0.069975,0.070847,0.071686,0.072554,0.073539,0.074648,0.075914,0.077501,0.079599,0.083127,0.115591],"jeonTaek":[0,0.000738,0.001453,0.002149,0.002826,0.003492,0.004138,0.004761,0.00539,0.006006,0.006669,0.007319,0.007997,0.008738,0.009547,0.010428,0.011523,0.012859,0.014832,0.018149,0.058426],"browLength":[0.112602,0.181943,0.191065,0.19642,0.200342,0.203629,0.206457,0.208992,0.211287,0.213472,0.215669,0.217882,0.2201,0.222519,0.224964,0.227816,0.23112,0.23513,0.240704,0.24998,0.314473],"browAngle":[-178.807364,-176.636824,-176.332553,-176.142279,-175.995438,-175.873546,-175.765099,-175.669093,-175.579868,-175.488434,-175.398031,-175.30694,-175.212948,-175.110383,-174.999566,-174.8754,-174.721944,-174.530625,-174.253827,-173.749682,-166.707612],"browThick":[0.008742,0.023427,0.025228,0.026304,0.027075,0.027694,0.02824,0.028721,0.02918,0.029613,0.030028,0.030436,0.03086,0.031304,0.031793,0.03235,0.032983,0.03374,0.034782,0.036581,0.055223],"gwanGol":[0.848385,0.945189,0.959365,0.968085,0.97458,0.980043,0.984594,0.988695,0.992563,0.996381,1.000098,1.003759,1.007595,1.011581,1.01592,1.020899,1.026799,1.033809,1.044093,1.061888,1.249721],"inJung":[0.000011,0.034933,0.045296,0.051294,0.055854,0.059547,0.062545,0.065301,0.067876,0.070326,0.0727,0.075097,0.077596,0.080222,0.08303,0.086159,0.089686,0.094301,0.100445,0.110707,0.186936],"chin":[0.127833,0.152004,0.155014,0.156756,0.158044,0.159055,0.159936,0.160708,0.161482,0.162172,0.162836,0.163526,0.164217,0.16497,0.165771,0.166652,0.167664,0.168945,0.170689,0.173552,0.198756],"upperThirdPct":[38,38,38,38,38,38,38,38,38,38,38,38,38,38,38,38,38,38,38,38,38],"middleThirdPct":[12.690246,21.379633,22.375741,22.959436,23.375389,23.720471,24.027066,24.29824,24.542522,24.77877,25.009293,25.234621,25.473116,25.717571,25.985051,26.277466,26.619437,27.056492,27.635499,28.616088,37.19435],"lowerThirdPct":[24.80565,33.383912,34.364501,34.943508,35.380563,35.722534,36.014949,36.282429,36.526884,36.765379,36.990781,37.22123,37.457478,37.70176,37.972934,38.279529,38.624611,39.040564,39.624259,40.620367,49.309754],"lowerUpperWidth":[0.275921,0.649997,0.698487,0.72836,0.751013,0.769116,0.784704,0.798935,0.812188,0.825284,0.838421,0.851002,0.864244,0.879035,0.894039,0.911828,0.932135,0.957766,0.995087,1.059272,1.780175],"cheonJiWidth":[0.561742,0.944045,1.004938,1.044096,1.072806,1.096698,1.11852,1.137611,1.157081,1.175085,1.192741,1.211703,1.231243,1.251666,1.274366,1.300194,1.331536,1.372948,1.431666,1.538468,3.624223],"cheonJiHeight":[0.770639,0.935491,0.959008,0.973347,0.983829,0.992698,1.000713,1.00791,1.014484,1.020923,1.027285,1.033581,1.04033,1.047339,1.055117,1.063754,1.074036,1.08747,1.105792,1.138273,1.531909]}};

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
  var browLen = (Math.sqrt(Math.pow(p[53].x - p[55].x, 2) + Math.pow(p[53].y - p[55].y, 2)) +
    Math.sqrt(Math.pow(p[283].x - p[285].x, 2) + Math.pow(p[283].y - p[285].y, 2))) / 2;
  var browAng = (Math.atan2(p[53].y - p[55].y, p[53].x - p[55].x) * 180 / Math.PI +
    Math.atan2(p[283].y - p[285].y, p[285].x - p[283].x) * 180 / Math.PI) / 2;

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
    jeonTaek: (dy(159, 66) + dy(386, 296)) / 2 / faceH,
    browLength: browLen / faceW,
    browAngle: browAng,
    browThick: (dy(63, 66) + dy(293, 296)) / 2 / faceH,
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
    jeonTaekRatio: (dy(159, 66) + dy(386, 296)) / 2 / faceH,
    browLengthRatio: browLen / faceW,
    browGapRatio: dx(55, 285) / faceW,
    browThicknessRatio: (dy(63, 66) + dy(293, 296)) / 2 / faceH,
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
