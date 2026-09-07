/* ★배포 사본 — 정본은 _v786_diag/sensor_color.js (sha256 9ac0e7c9727ba77a…). 직접 고치지 마라.
   _v786_diag/p09_bind_sensors.js 가 정본을 IIFE 로 감싸 생성한다. 이 파일을 고치면 p09 --check 가 드리프트로 FAIL 한다. */
(function () {
/* ============================================================================
   천운 v786 · 관상 색·기색(氣色) 계측축 — sensor_color.js   (P-786-G2)
   ---------------------------------------------------------------------------
   ★독립 모듈이다. index.html · api/* · face_core_v786.js 를 건드리지 않는다.
   ★통합은 별도 작업이며 이 파일은 통합되기 전까지 NOT_BOUND 다.

   왜 만들었나
     _v786_diag/IP_face/rules/face/ogwan.json  _AXIS_GAPS.no_color_axis
     _v786_diag/IP_face/rules/face/xlhz.json   _AXIS_GAPS.no_color_axis
       「太淸神鑑은 氣色이 본문에 36회 나올 만큼 색 비중이 큰 문헌인데
         우리 계측기는 색을 한 축도 재지 않는다.」
     ⟹ 색 축이 0개라서 UNMEASURABLE 로 떨어진 규칙이 100건 중 상당수다.

   ★★설계의 제1 원칙 — 조명 불변성
     이 앱은 앞서 「사진 종횡비가 얼굴형을 결정한다」는 결함을 실측당했다
     (같은 사람 5비율 → 판정 유지확률 0.18%). 색에서 같은 실패를 반복하지 않기 위해
     **모든 축을 「얼굴 전체 피부 기준 대비 상대값(z)」으로 정의한다.**
     부위 절대색은 축으로 삼지 않는다 — 원문도 「色黃」을 절대 색좌표로 말하지 않는다.

     불변성의 수학적 근거 (추측 아님 · p05 가 수치로 검증한다):
       ① 노출 k배     : R,G,B → kR,kG,kB.  log 대립색 a=logR-(logG+logB)/2 에서 log k 가 상쇄.
       ② 화이트밸런스 : R,G,B → gR·R, gG·G, gB·B.  a 에 상수 (log gR - …) 가 더해질 뿐 →
                        얼굴 피부 평균을 빼는 순간 상쇄.
       ③ 감마 γ       : v → v^γ.  모든 log 값이 γ배 → 얼굴 피부 표준편차로 나누면 상쇄.
       ④ 좌우 그라디언트: 조명은 곱셈이므로 log 에서 더해지는 공간장(場)이다.
                        ㉠ 대립색축은 같은 픽셀의 채널 차이라 무채색 그라디언트가 자동 상쇄.
                        ㉡ 밝기축은 얼굴 피부에서 저차 다항식을 최소자승으로 적합해 제거(detrend).
       ⑤ 채도 s배     : 대립색이 대략 s배 → ③과 같은 표준편차 나눗셈으로 상쇄(근사).
     ★상쇄되지 않는 것: 유색(有色) 그라디언트, 클리핑(포화·흑색뭉침), 8bit 양자화.
       ⟹ 그래서 G3(클리핑) 게이트가 있고, 걸리면 fail-closed 로 거부한다.

   랜드마크 인덱스의 출처 (★추측 없음)
     npm @mediapipe/face_mesh@0.4.1633559619 (index.html:56 이 CDN 으로 싣는 그 버전) 에서
       · face_mesh.js 를 평가해 FACEMESH_FACE_OVAL/LIPS/LEFT_EYE/RIGHT_EYE/
         LEFT_EYEBROW/RIGHT_EYEBROW/LEFT_IRIS/RIGHT_IRIS 상수를 그대로 꺼내 고리(ring)로 복원.
       · face_mesh_solution_packed_assets.data 안의
         face_geometry/data/geometry_pipeline_metadata_landmarks.binarypb 를 파싱해
         canonical face model 468정점의 (x,y,z,u,v) 를 실측.
         ⟹ 검산: LM1=(0,-1.126865,7.475604) LM2=(0,-2.089024,6.058267)
            — synth_face.js 주석 V2 의 값과 일치한다.
     부위 폴리곤은 그 정점표에서 **해부학적 좌표 조건으로 뽑아 볼록껍질**을 취한 것이고,
     좌우 대칭짝은 (-x,y,z) 최근접 정점으로 확인했다(오차 0.0000).

   좌표 규약
     landmarks[i].x 는 사진 **폭**으로, .y 는 사진 **높이**로 각각 정규화돼 있다.
     따라서 px = x*width, py = y*height 로 되돌리면 픽셀좌표가 정확히 복원된다.
     ★shape 트랙과 달리 색 축은 x/y 를 섞지 않으므로 종횡비 왜곡의 여지가 없다.
     aspect 는 API 호환·기록용으로만 받는다.

   입력 : imageData {data:Uint8ClampedArray(RGBA), width, height}  ← canvas.getImageData 그대로
          landmarks 468(또는 refineLandmarks:true 의 478) 정규화 좌표
          aspect    사진높이/사진폭 (기록용)
   출력 : { ok, reject, meta, norm, regions{...}, eye{...}, abs{...} }
   ========================================================================== */

'use strict';

/* ── 버전 ── */
var SENSOR_COLOR_VERSION = '0.1.0';

/* ============================================================================
   1. 부위 폴리곤 — canonical face model 실측 유래 (위 주석의 출처 참조)
   ========================================================================== */

/* FACEMESH_FACE_OVAL 을 고리로 복원한 순회순서 36점 (face_core_v786.js 주석 ②와 동일) */
var OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379,
  378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];

/* FACEMESH_LIPS 두 고리 — 바깥(脣 바깥선) / 안쪽(입 벌어짐) */
var LIP_OUTER = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185];
var LIP_INNER = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191];

/* FACEMESH_RIGHT_EYE / LEFT_EYE 고리 16점 (R = MediaPipe 기준 오른쪽 = 사진에서 왼쪽) */
var EYE_R = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
var EYE_L = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466];

/* FACEMESH_*_EYEBROW 은 위·아래 두 개의 열린 선이다. 이어 붙여 폴리곤으로 만든다. */
var BROW_R = [70, 63, 105, 66, 107, 55, 65, 52, 53, 46];
var BROW_L = [300, 293, 334, 296, 336, 285, 295, 282, 283, 276];

/* FACEMESH_*_IRIS — refineLandmarks:true(478점) 일 때만 존재한다. index.html:4099 는 true. */
var IRIS_R = [469, 470, 471, 472];
var IRIS_L = [474, 475, 476, 477];

/* 코 밑(콧구멍·비주) 제외구역 — 어둡고 그림자가 져 피부 기준을 오염시킨다 */
var NOSTRIL = [165, 64, 219, 439, 294, 391];

/* ── 관상 부위 (氣色을 보는 자리) ──────────────────────────────────────────
   shrink : 중심 쪽으로 오므리는 비율. 눈썹털·머리카락·실루엣 경계가 섞이는 것을 막는다.        */
var REGIONS = {
  /* 印堂(命宮) — 兩眉之間 山根之上. 十二宮總訣 「命宮居兩眉之間、山根之上、印堂是也」 */
  INDANG: { ko: '印堂(명궁·미간)', ring: [107, 336, 285, 168, 55], shrink: 0.14, side: 'C' },
  /* 天庭 — 이마 윗부분(髪際 아래, 中正 위) */
  CHEONJEONG: { ko: '天庭(이마)', ring: [67, 109, 10, 338, 297, 299, 151, 69], shrink: 0.20, side: 'C' },
  /* 準頭 — 코끝 살(蘭台·廷尉 제외). z>6.85 로 콧방울·콧구멍을 배제했다 */
  JUNDU: { ko: '準頭(코끝)', ring: [220, 45, 4, 275, 440, 457, 461, 354, 19, 125, 241, 237], shrink: 0.10, side: 'C' },
  /* 地閣 — 아랫입술 아래 턱 중앙 */
  JIGAK: { ko: '地閣(턱)', ring: [211, 194, 418, 431, 400, 377, 152, 148, 176], shrink: 0.16, side: 'C' },
  /* 顴 — 광대. 六府의 兩顴骨 */
  GWAN_R: { ko: '顴(광대·右)', ring: [123, 101, 36, 206, 187, 147], shrink: 0.14, side: 'R' },
  GWAN_L: { ko: '顴(광대·左)', ring: [352, 330, 266, 426, 411, 376], shrink: 0.14, side: 'L' },
  /* 眼下(臥蠶·淚堂) — 十二宮 男女宮. 아래눈꺼풀 바로 아래 */
  ANHA_R: { ko: '眼下(와잠·右)', ring: [228, 24, 233, 121, 120, 229], shrink: 0.12, side: 'R' },
  ANHA_L: { ko: '眼下(와잠·左)', ring: [448, 254, 453, 350, 349, 449], shrink: 0.12, side: 'L' },
  /* 輔角 — 六府의 兩輔角(이마 옆). 天倉·遷移 자리와 인접 */
  BOGAK_R: { ko: '輔角(右)', ring: [21, 54, 103, 104, 68], shrink: 0.18, side: 'R' },
  BOGAK_L: { ko: '輔角(左)', ring: [251, 284, 332, 333, 298], shrink: 0.18, side: 'L' },
  /* 目上(田宅宮) — 六府의 兩目上. 눈썹 아래·윗눈꺼풀 위 */
  JEONTAEK_R: { ko: '目上(전택·右)', ring: [46, 222, 221, 56, 30, 113], shrink: 0.20, side: 'R' },
  JEONTAEK_L: { ko: '目上(전택·左)', ring: [276, 442, 441, 286, 260, 342], shrink: 0.20, side: 'L' },
  /* 耳門之前(外學堂) — 太淸神鑑 R038 의 자리. 귀 앞 관자 아래. 실루엣이 가까워 크게 오므린다 */
  MYEONGMUN_R: { ko: '耳門之前(右)', ring: [127, 143, 147, 177, 93, 234], shrink: 0.30, side: 'R' },
  MYEONGMUN_L: { ko: '耳門之前(左)', ring: [356, 372, 376, 401, 323, 454], shrink: 0.30, side: 'L' },
  /* 脣 — 바깥 입술선 안, 입 벌어짐(안쪽 고리)은 구멍으로 뺀다 */
  SEUNG: { ko: '脣(입술)', ring: LIP_OUTER, holes: [LIP_INNER], shrink: 0.10, side: 'C' }
};

/* 六府(兩目上·兩輔角·兩顴骨) 묶음 — 太淸神鑑 R008·R009 */
var YUKBU = ['JEONTAEK_R', 'JEONTAEK_L', 'BOGAK_R', 'BOGAK_L', 'GWAN_R', 'GWAN_L'];
/* 五嶽(額·左右顴·鼻·頦) 묶음 — 相理衡眞 R049 「山岳 不宜昏暗」 */
var OAK = ['CHEONJEONG', 'GWAN_R', 'GWAN_L', 'JUNDU', 'JIGAK'];

/* ============================================================================
   2. 축 정의표 — ★축마다 「무엇을 재는가」와 「어느 원문 조건(rule_id)에 대응하는가」.
      ★대응 rule 이 없는 축은 만들지 않는다. (지어낸 판정을 만들지 않기 위한 규율)
   ========================================================================== */
var AXES = [
  { axis: 'redness', kind: 'REL',
    what: '부위의 log 대립색 a=logR-(logG+logB)/2 를 얼굴 피부 분포로 z 화 — 「붉은 기」',
    rules: ['FACE_XLHZ_R016', 'FACE_XLHZ_R019', 'FACE_XLHZ_R026', 'FACE_XLHZ_R055'] },
  { axis: 'yellowness', kind: 'REL',
    what: '부위의 log 대립색 b=(logR+logG)/2-logB 를 얼굴 피부 분포로 z 화 — 「누런 기」',
    rules: ['FACE_XLHZ_R024'] },
  { axis: 'lightness', kind: 'REL',
    what: '조명장(場) 제거 후 log 휘도를 얼굴 피부 분포로 z 화 — 「밝다/어둡다(明·昏暗)」',
    rules: ['FACE_XLHZ_R046', 'FACE_XLHZ_R049', 'FACE_XLHZ_R051', 'FACE_XLHZ_R003'] },
  { axis: 'gloss', kind: 'REL',
    what: '부위 내 log 휘도 상위 90분위 − 중앙값 (정반사 성분) / 얼굴 피부 표준편차 — 「潤·瑩·光」 대 「枯·燥」',
    rules: ['FACE_OGWAN_R008', 'FACE_OGWAN_R038', 'FACE_XLHZ_R016', 'FACE_XLHZ_R019',
      'FACE_XLHZ_R026', 'FACE_XLHZ_R046', 'FACE_XLHZ_R051'] },
  { axis: 'chromaDispersion', kind: 'REL',
    what: '부위 내 대립색 a 의 표준편차 / 얼굴 피부 표준편차 — 색이 고른가 얼룩졌는가(「如絲」의 얼룩)',
    rules: ['FACE_XLHZ_R055'] },
  { axis: 'darkSpotFrac', kind: 'REL',
    what: '부위 내 log 휘도가 (부위 중앙값 − 2.5σ_skin) 미만인 픽셀 비율 — 검은 점(黒痣) 후보',
    rules: ['FACE_OGWAN_R009', 'FACE_XLHZ_R054'],
    caveat: '★그림자·모발·모공·痣·瘢을 구분하지 못한다. 「惡(나쁜)」 판정은 원천적으로 불가.' },
  { axis: 'scleraLightness', kind: 'REL',
    what: '흰자(눈 폴리곤 중 밝은 절반) 의 log 휘도 − 얼굴 피부 평균, σ_skin 단위 — 「白如玉」',
    rules: ['FACE_OGWAN_R027'] },
  { axis: 'irisDarkness', kind: 'REL',
    what: '얼굴 피부 평균 − 홍채 log 휘도, σ_skin 단위 — 「黑如漆」',
    rules: ['FACE_OGWAN_R027'] },
  { axis: 'irisScleraContrast', kind: 'REL',
    what: '흰자 − 홍채 log 휘도 차 / σ_skin — 「黑白分明」',
    rules: ['FACE_OGWAN_R027', 'FACE_OGWAN_R037'] },
  { axis: 'scleraYellow', kind: 'REL',
    what: '흰자의 대립색 b − 얼굴 피부 b, σ_skin,b 단위 — 흰자의 누런 기',
    rules: ['FACE_XLHZ_R024'] },
  /* ── ABS 계열 ★신뢰도 낮음. 얼굴 전체 색(色白·色赤·色黃)은 상대화하면 정의상 0이 되므로
        얼굴 안에서 가장 중성(neutral)에 가까운 면인 **흰자**를 화이트 레퍼런스로 삼는다.
        ★흰자는 완전한 중성이 아니고 나이·건강으로 변한다 — 바로 그것을 「白如玉」이 보는 것이다.
        ⟹ 이 계열은 confidence LOW 로 못박고, 규칙 승격도 PARTIAL 을 넘지 않는다. */
  { axis: 'abs.skinRedVsSclera', kind: 'ABS', confidence: 'LOW',
    what: '얼굴 피부 a − 흰자 a, σ_skin,a 단위 — 얼굴 전체의 「色赤」',
    rules: ['FACE_XLHZ_R016', 'FACE_XLHZ_R019', 'FACE_XLHZ_R026'] },
  { axis: 'abs.skinYellowVsSclera', kind: 'ABS', confidence: 'LOW',
    what: '얼굴 피부 b − 흰자 b, σ_skin,b 단위 — 얼굴 전체의 「色黃」',
    rules: ['FACE_XLHZ_R024'] },
  { axis: 'abs.skinLightVsSclera', kind: 'ABS', confidence: 'LOW',
    what: '얼굴 피부 log 휘도 − 흰자 log 휘도, σ_skin 단위 — 얼굴 전체의 「色白」(0 에 가까울수록 희다)',
    rules: ['FACE_XLHZ_R003'] }
];

/* ★원문에 색 글자가 있어도 축을 만들지 않은 것 — 지어내지 않기 위해 명시한다 */
var NOT_MEASURED = [
  { text: '清(맑다)', why: '비교 대상도 컷오프도 없다. 색좌표에 「맑다」에 대응하는 양이 없다. 채도·대비 어느 것으로 바꿔도 그것은 원문이 아니라 우리 창작이 된다.',
    rules: ['FACE_OGWAN_R001', 'FACE_OGWAN_R002', 'FACE_OGWAN_R004', 'FACE_OGWAN_R005', 'FACE_OGWAN_R010', 'FACE_OGWAN_R037', 'FACE_XLHZ_R008'] },
  { text: '氣(氣剛·氣秀·氣枯)', why: '「氣」는 색이 아니다. 光澤(枯)만 gloss 로 잡히고 나머지는 잡히지 않는다.',
    rules: ['FACE_XLHZ_R003', 'FACE_XLHZ_R008', 'FACE_XLHZ_R016'] },
  { text: '秀(빼어나다)·美·醜惡', why: '미적 판단. 계측량 없음.', rules: ['FACE_OGWAN_R006'] },
  { text: '紋(주름)·懸針·川字·直理·橫理', why: '텍스처·방향성 축이며 색 축이 아니다. 본 모듈 범위 밖.',
    rules: ['FACE_OGWAN_R025', 'FACE_XLHZ_R047', 'FACE_XLHZ_R048', 'FACE_XLHZ_R050'] },
  { text: '耳(귀) 일체', why: 'MediaPipe FaceMesh 468 랜드마크에 귀 윤곽이 없다. 색 축을 만들어도 자를 마스크가 없다.',
    rules: ['FACE_OGWAN_R003', 'FACE_OGWAN_R029', 'FACE_OGWAN_R036', 'FACE_OGWAN_R041'] },
  { text: '毫·鬍鬚(눈썹털 밖의 털)', why: '眼毫·耳毫·鼻毫·鬍鬚 를 분할하는 마스크가 없다. 색 축은 있으나 자를 자리가 없다.',
    rules: ['FACE_XLHZ_R044'] }
];

/* ============================================================================
   3. 픽셀 유틸
   ========================================================================== */

/* log 하한. 이 아래(흑색 뭉침)에서는 곱셈 불변성이 깨진다 — G3 가 걸러낸다. */
var LOG_FLOOR = 2.0;

function _llog(v) { return Math.log(v < LOG_FLOOR ? LOG_FLOOR : v); }

/* 폴리곤을 중심으로 오므리거나(음수면 부풀리거나) 한다 */
function _shrinkPoly(pts, s) {
  var cx = 0, cy = 0, i;
  for (i = 0; i < pts.length; i++) { cx += pts[i][0]; cy += pts[i][1]; }
  cx /= pts.length; cy /= pts.length;
  var out = new Array(pts.length), k = 1 - s;
  for (i = 0; i < pts.length; i++) out[i] = [cx + (pts[i][0] - cx) * k, cy + (pts[i][1] - cy) * k];
  return out;
}

/* 랜드마크 고리 → 픽셀 폴리곤 */
function _ring2px(ring, lm, W, H) {
  var out = new Array(ring.length);
  for (var i = 0; i < ring.length; i++) {
    var p = lm[ring[i]];
    if (!p || !isFinite(p.x) || !isFinite(p.y)) return null;
    out[i] = [p.x * W, p.y * H];
  }
  return out;
}

/* 짝수-홀수 규칙 스캔라인 채우기. polys = [바깥, 구멍…] 을 모두 합쳐 XOR 한다.
   반환: 픽셀 인덱스(Int32Array) */
function _fillPolys(polys, W, H) {
  var minY = Infinity, maxY = -Infinity, i, j, p;
  for (i = 0; i < polys.length; i++) for (j = 0; j < polys[i].length; j++) {
    p = polys[i][j];
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
  }
  var y0 = Math.max(0, Math.ceil(minY)), y1 = Math.min(H - 1, Math.floor(maxY));
  var idx = [], xs = [];
  for (var y = y0; y <= y1; y++) {
    xs.length = 0;
    var yc = y + 0.5;
    for (i = 0; i < polys.length; i++) {
      var poly = polys[i], n = poly.length;
      for (j = 0; j < n; j++) {
        var a = poly[j], b = poly[(j + 1) % n];
        if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) {
          xs.push(a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
        }
      }
    }
    if (xs.length < 2) continue;
    xs.sort(function (m, n2) { return m - n2; });
    for (i = 0; i + 1 < xs.length; i += 2) {
      var xa = Math.max(0, Math.ceil(xs[i] - 0.5)), xb = Math.min(W - 1, Math.floor(xs[i + 1] - 0.5));
      for (var x = xa; x <= xb; x++) idx.push(y * W + x);
    }
  }
  return Int32Array.from(idx);
}

function _quantile(sorted, q) {
  if (!sorted.length) return NaN;
  var t = (sorted.length - 1) * q, lo = Math.floor(t), hi = Math.ceil(t);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (t - lo);
}
function _mean(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s / a.length; }
function _sd(a, m) {
  if (a.length < 2) return 0;
  var s = 0; for (var i = 0; i < a.length; i++) { var d = a[i] - m; s += d * d; }
  return Math.sqrt(s / (a.length - 1));
}

/* 정규방정식 풀이 (n<=6) — 가우스 소거 */
function _solve(A, b, n) {
  var i, j, k;
  for (i = 0; i < n; i++) {
    var piv = i;
    for (j = i + 1; j < n; j++) if (Math.abs(A[j][i]) > Math.abs(A[piv][i])) piv = j;
    if (Math.abs(A[piv][i]) < 1e-12) return null;
    var tA = A[i]; A[i] = A[piv]; A[piv] = tA;
    var tb = b[i]; b[i] = b[piv]; b[piv] = tb;
    for (j = i + 1; j < n; j++) {
      var f = A[j][i] / A[i][i];
      for (k = i; k < n; k++) A[j][k] -= f * A[i][k];
      b[j] -= f * b[i];
    }
  }
  var x = new Array(n);
  for (i = n - 1; i >= 0; i--) {
    var s = b[i];
    for (j = i + 1; j < n; j++) s -= A[i][j] * x[j];
    x[i] = s / A[i][i];
  }
  return x;
}

/* 기저함수 — order 1: [1,u,v] / order 2: [1,u,v,u²,uv,v²]  (u,v 는 -1..1 로 정규화한 화면좌표) */
function _basis(u, v, order) {
  return order >= 2 ? [1, u, v, u * u, u * v, v * v] : [1, u, v];
}

/* ============================================================================
   4. 메인
   ========================================================================== */

var DEFAULTS = {
  detrendOrder: 1,      // 조명장 제거 차수. 1=평면. 2 는 실제 신호(부위 밝기차)까지 먹으므로 기본 아님
  minRegionPx: 12,      // 부위 최소 픽셀. 이하이면 그 부위는 null (거부 아님)
  minSkinPx: 400,       // 얼굴 피부 기준 최소 픽셀. 이하이면 전체 거부
  clipFracMax: 0.25,    // 피부에서 포화·흑색뭉침 허용 비율
  darkK: 2.5,           // 검은 점 임계 (부위 중앙값 − darkK·σ_skin)
  glossHi: 0.90,        // 광택 상위 분위
  normMode: 'full'      // ★진단 전용. 'raw'|'no_log_opponent'|'no_sd_norm'|'no_detrend'|'absolute'
                        //   p05 변이 시험이 정규화를 일부러 망가뜨릴 때 쓴다. 운영에서는 'full'.
                        //   'raw' = 정규화를 전부 끈 것(= 부위 절대색). 「정규화 전」 대조군.
};

function measureColor(imageData, landmarks, aspect, opts) {
  var o = {}, k;
  for (k in DEFAULTS) o[k] = DEFAULTS[k];
  if (opts) for (k in opts) if (opts[k] !== undefined) o[k] = opts[k];

  var rej = function (gate, reason) {
    return { ok: false, reject: { gate: gate, reason: reason },
      meta: { version: SENSOR_COLOR_VERSION, normMode: o.normMode }, regions: null, eye: null, abs: null };
  };

  /* ── G1 입력 유효성 ───────────────────────────────────────── */
  if (!imageData || !imageData.data || !(imageData.width > 0) || !(imageData.height > 0))
    return rej('G1', 'imageData 가 없거나 폭·높이가 0 이다');
  var W = imageData.width | 0, H = imageData.height | 0, D = imageData.data;
  if (D.length < W * H * 4) return rej('G1', 'RGBA 버퍼 길이가 폭×높이×4 보다 짧다');
  if (!landmarks || landmarks.length < 468) return rej('G1', '랜드마크가 468개 미만이다 (len=' + (landmarks ? landmarks.length : 0) + ')');
  for (var t = 0; t < 468; t++) {
    var lp = landmarks[t];
    if (!lp || !isFinite(lp.x) || !isFinite(lp.y)) return rej('G1', 'LM' + t + ' 좌표가 유한하지 않다');
  }
  var irisAvailable = landmarks.length >= 478;

  /* ── 마스크 만들기 ────────────────────────────────────────── */
  function poly(ring, shrink) {
    var p = _ring2px(ring, landmarks, W, H);
    return p ? _shrinkPoly(p, shrink || 0) : null;
  }
  /* 폴리곤이 화면 밖으로 나가면 거부 (G2). 얼굴이 잘렸거나 랜드마크가 어긋난 것이다. */
  function inFrame(p, tolPx) {
    for (var i = 0; i < p.length; i++)
      if (p[i][0] < -tolPx || p[i][0] > W + tolPx || p[i][1] < -tolPx || p[i][1] > H + tolPx) return false;
    return true;
  }
  var tol = Math.max(2, Math.round(Math.min(W, H) * 0.01));

  var ovalP = poly(OVAL, 0.08);
  if (!ovalP) return rej('G1', '얼굴 윤곽 폴리곤을 만들 수 없다');
  if (!inFrame(ovalP, tol)) return rej('G2', '얼굴 윤곽이 화면 밖으로 나갔다 — 마스크 밖 픽셀이 섞인다');

  /* 피부 기준 = 얼굴 윤곽 − (눈·눈썹·입술·코밑) 을 살짝 부풀려 뺀 것
     ★제외 마스크 — 눈·눈썹·콧구멍은 어느 부위 계측에도 섞이면 안 된다.
     실측 근거: 準頭 마스크가 콧구멍 그늘에 6.1% 물려 「검은 점」이 거짓 양성으로 났었다.
     입술은 脣(SEUNG) 자신을 뺄 수 없으므로 별도로 둔다. */
  var exclNoLip = new Uint8Array(W * H);
  var exclWithLip = new Uint8Array(W * H);
  (function () {
    var parts = [
      [poly(EYE_R, -0.45), 0], [poly(EYE_L, -0.45), 0],
      [poly(BROW_R, -0.35), 0], [poly(BROW_L, -0.35), 0],
      [poly(NOSTRIL, -0.20), 0], [poly(LIP_OUTER, -0.25), 1]
    ];
    for (var e = 0; e < parts.length; e++) {
      if (!parts[e][0]) continue;
      var ex = _fillPolys([parts[e][0]], W, H);
      for (var i = 0; i < ex.length; i++) {
        exclWithLip[ex[i]] = 1;
        if (!parts[e][1]) exclNoLip[ex[i]] = 1;
      }
    }
  })();
  function subtractExcl(idx, keepLip) {
    var m = keepLip ? exclNoLip : exclWithLip, out = [], i;
    for (i = 0; i < idx.length; i++) if (!m[idx[i]]) out.push(idx[i]);
    return Int32Array.from(out);
  }

  var skinIdx = subtractExcl(_fillPolys([ovalP], W, H), false);
  if (skinIdx.length < o.minSkinPx)
    return rej('G2', '얼굴 피부 기준 픽셀이 ' + skinIdx.length + '개뿐이다 (최소 ' + o.minSkinPx + ')');

  /* ── 픽셀 → log 채널 / 대립색 ─────────────────────────────── */
  /* normMode 'no_log_opponent' : log 를 쓰지 않고 선형 채널비를 쓴다(불변성 파괴 변이) */
  var useLog = !(o.normMode === 'no_log_opponent' || o.normMode === 'raw');
  function chan(i) {
    var q = i * 4, R = D[q], G = D[q + 1], B = D[q + 2];
    if (useLog) {
      var lr = _llog(R), lg = _llog(G), lb = _llog(B);
      return { y: 0.299 * lr + 0.587 * lg + 0.114 * lb, a: lr - (lg + lb) / 2, b: (lr + lg) / 2 - lb };
    }
    return { y: 0.299 * R + 0.587 * G + 0.114 * B, a: R - (G + B) / 2, b: (R + G) / 2 - B };
  }

  /* ── G3 클리핑 검사 (피부 기준 위에서) ───────────────────── */
  var clipped = 0;
  for (var s = 0; s < skinIdx.length; s++) {
    var q = skinIdx[s] * 4;
    if (D[q] >= 250 || D[q + 1] >= 250 || D[q + 2] >= 250 || (D[q] <= 5 && D[q + 1] <= 5 && D[q + 2] <= 5)) clipped++;
  }
  var clipFrac = clipped / skinIdx.length;
  if (clipFrac > o.clipFracMax)
    return rej('G3', '피부 기준의 ' + (clipFrac * 100).toFixed(1) + '% 가 포화·흑색뭉침이다 — 색 불변성이 성립하지 않는다');

  /* ── 조명장(場) 제거 : 피부에서 log 휘도의 저차 다항식을 적합해 뺀다 ── */
  var nb = (o.detrendOrder >= 2 ? 6 : 3);
  var coef = null;
  var doDetrend = !(o.normMode === 'no_detrend' || o.normMode === 'raw');
  if (doDetrend) {
    var AtA = [], Atb = new Array(nb), ii, jj;
    for (ii = 0; ii < nb; ii++) { AtA.push(new Array(nb)); for (jj = 0; jj < nb; jj++) AtA[ii][jj] = 0; Atb[ii] = 0; }
    for (var si = 0; si < skinIdx.length; si++) {
      var pi = skinIdx[si], px = (pi % W), py = (pi / W) | 0;
      var u = (px / W) * 2 - 1, v = (py / H) * 2 - 1;
      var f = _basis(u, v, o.detrendOrder), yv = chan(pi).y;
      for (ii = 0; ii < nb; ii++) { Atb[ii] += f[ii] * yv; for (jj = 0; jj < nb; jj++) AtA[ii][jj] += f[ii] * f[jj]; }
    }
    coef = _solve(AtA, Atb, nb);
  }
  function trend(pi) {
    if (!coef) return 0;
    var px = (pi % W), py = (pi / W) | 0;
    var f = _basis((px / W) * 2 - 1, (py / H) * 2 - 1, o.detrendOrder), s2 = 0;
    for (var i = 0; i < nb; i++) s2 += f[i] * coef[i];
    return s2;
  }
  /* 추세를 뺀 뒤 피부 평균을 더해 원래 수준으로 되돌린다(절대 수준은 어차피 상쇄된다) */
  function Ydet(pi) { return chan(pi).y - trend(pi); }

  /* ── 피부 기준 통계 ───────────────────────────────────────── */
  var sy = new Float64Array(skinIdx.length), sa = new Float64Array(skinIdx.length), sb = new Float64Array(skinIdx.length);
  for (var z = 0; z < skinIdx.length; z++) {
    var c = chan(skinIdx[z]);
    sy[z] = c.y - trend(skinIdx[z]); sa[z] = c.a; sb[z] = c.b;
  }
  var mY = _mean(sy), dY = _sd(sy, mY);
  var mA = _mean(sa), dA = _sd(sa, mA);
  var mB = _mean(sb), dB = _sd(sb, mB);

  /* ── G5 퇴화 검사 — 색 정보가 없는 이미지(회색·단색)는 z 가 발산한다 ── */
  var eps = useLog ? 1e-3 : 0.25;
  if (!(dY > eps) || !(dA > eps) || !(dB > eps))
    return rej('G5', '얼굴 기준의 색·밝기 분산이 사실상 0 이다 (σY=' + dY.toFixed(4) + ' σa=' + dA.toFixed(4) + ' σb=' + dB.toFixed(4) + ') — 얼굴 사진이 아니거나 마스크가 얼굴에 얹히지 않았다');

  /* ── G4 피부 타당성 — 사람 피부는 R>G>B 로 따뜻하다. 아니면 마스크가 얼굴 밖이다. ── */
  var medA = _quantile(Float64Array.from(sa).sort(), 0.5);
  var medB = _quantile(Float64Array.from(sb).sort(), 0.5);
  var warmMin = useLog ? 0.02 : 4;
  if (!(medA > warmMin && medB > warmMin))
    return rej('G4', '기준면이 피부의 색 순서(R>G>B)를 만족하지 않는다 (a=' + medA.toFixed(3) + ' b=' + medB.toFixed(3) + ') — 얼굴이 아닌 화소가 섞였다');
  var spread = useLog ? dY : dY / 255;
  if (!(spread > 0.015 && spread < 0.95))
    return rej('G4', '기준면의 밝기 산포가 피부 범위를 벗어났다 (σ=' + spread.toFixed(4) + ')');

  /* ── 부위별 계측 ──────────────────────────────────────────── */
  /* normMode 'no_sd_norm' : σ 로 나누지 않는다(감마·채도 불변성 파괴 변이)
     normMode 'absolute'   : 얼굴 피부 기준을 빼지 않는다(노출·화이트밸런스 불변성 파괴 변이) */
  var noSd = (o.normMode === 'no_sd_norm' || o.normMode === 'raw');
  var noRef = (o.normMode === 'absolute' || o.normMode === 'raw');
  var divY = noSd ? 1 : dY, divA = noSd ? 1 : dA, divB = noSd ? 1 : dB;
  var refY = noRef ? 0 : mY, refA = noRef ? 0 : mA, refB = noRef ? 0 : mB;

  var regions = {}, rejectedRegions = [];
  for (var rn in REGIONS) {
    var def = REGIONS[rn];
    var outer = poly(def.ring, def.shrink);
    if (!outer) { regions[rn] = null; continue; }
    if (!inFrame(outer, tol)) { regions[rn] = null; rejectedRegions.push(rn + ':OUT_OF_FRAME'); continue; }
    var polys = [outer];
    if (def.holes) for (var hh = 0; hh < def.holes.length; hh++) {
      var hp = poly(def.holes[hh], 0); if (hp) polys.push(hp);
    }
    /* ★눈·눈썹·콧구멍(脣 계측일 때는 입술 제외 안 함)을 부위 마스크에서도 뺀다 */
    var idx = subtractExcl(_fillPolys(polys, W, H), rn === 'SEUNG');
    if (idx.length < o.minRegionPx) { regions[rn] = null; rejectedRegions.push(rn + ':TOO_SMALL(' + idx.length + ')'); continue; }

    var ry = new Float64Array(idx.length), ra = new Float64Array(idx.length);
    var rb = new Float64Array(idx.length);
    for (var g = 0; g < idx.length; g++) {
      var cc = chan(idx[g]);
      ry[g] = cc.y - trend(idx[g]); ra[g] = cc.a; rb[g] = cc.b;
    }
    var sortedY = Float64Array.from(ry).sort();
    var med = _quantile(sortedY, 0.5), hi = _quantile(sortedY, o.glossHi);
    var mAr = _mean(ra);
    /* ★검은 점 임계는 중앙값이 아니라 25분위 기준으로 잡는다.
       정반사(하이라이트)가 있는 부위는 중앙값이 위로 끌려가 어두운 테두리가 통째로
       거짓 양성이 된다 — 準頭 에서 실측으로 6.1% 오검출이 났다. 25분위는 그 영향을 받지 않는다. */
    var thr = _quantile(sortedY, 0.25) - o.darkK * dY;
    var dark = 0; for (var g2 = 0; g2 < ry.length; g2++) if (ry[g2] < thr) dark++;

    regions[rn] = {
      ko: def.ko, pixels: idx.length,
      lightness: (_mean(ry) - refY) / divY,   // 明·昏暗
      redness: (mAr - refA) / divA,           // 色赤·紅
      yellowness: (_mean(rb) - refB) / divB,  // 色黃
      gloss: (hi - med) / divY,               // 潤·瑩·光 ↔ 枯·燥
      chromaDispersion: _sd(ra, mAr) / divA,  // 색이 고른가
      darkSpotFrac: dark / ry.length          // 黒痣 후보
    };
  }

  /* ── 눈(흰자·홍채) ────────────────────────────────────────── */
  var eye = (function () {
    var scl = [], iri = [], sclB = [];
    var sides = [[EYE_R, IRIS_R], [EYE_L, IRIS_L]];
    for (var e = 0; e < 2; e++) {
      var ep = poly(sides[e][0], 0.10);
      if (!ep || !inFrame(ep, tol)) continue;
      var eidx = _fillPolys([ep], W, H);
      if (eidx.length < o.minRegionPx) continue;
      var ey = new Float64Array(eidx.length);
      for (var i = 0; i < eidx.length; i++) ey[i] = chan(eidx[i]).y - trend(eidx[i]);
      var srt = Float64Array.from(ey).sort();
      var mid = _quantile(srt, 0.55);
      /* 흰자 = 눈 폴리곤 중 밝은 쪽. 속눈썹·눈꺼풀 그늘을 뺀다. */
      for (var j = 0; j < eidx.length; j++) if (ey[j] >= mid) { scl.push(ey[j]); sclB.push(chan(eidx[j]).b); }
      /* 홍채 = 478점이면 IRIS 폴리곤, 아니면 눈 폴리곤 안 어두운 25% */
      if (irisAvailable) {
        var ip = poly(sides[e][1], 0);
        if (ip && inFrame(ip, tol)) {
          var iidx = _fillPolys([ip], W, H);
          for (var m = 0; m < iidx.length; m++) iri.push(chan(iidx[m]).y - trend(iidx[m]));
        }
      } else {
        var q25 = _quantile(srt, 0.25);
        for (var n2 = 0; n2 < eidx.length; n2++) if (ey[n2] <= q25) iri.push(ey[n2]);
      }
    }
    if (scl.length < o.minRegionPx || iri.length < o.minRegionPx) return null;
    var mS = _mean(scl), mI = _mean(iri), mSB = _mean(sclB);
    return {
      irisSource: irisAvailable ? 'FACEMESH_IRIS(478)' : 'EYE_POLY_DARK_QUARTILE(468)',
      scleraPixels: scl.length, irisPixels: iri.length,
      scleraLightness: (mS - refY) / divY,
      irisDarkness: (refY - mI) / divY,
      irisScleraContrast: (mS - mI) / divY,
      scleraYellow: (mSB - refB) / divB,
      _mS: mS, _mI: mI, _mSB: mSB, _mSA: _mean(scl.map(function () { return 0; }))
    };
  })();

  /* ── ABS 계열 (흰자를 화이트 레퍼런스로 삼은 얼굴 전체 색) ── */
  var abs = null;
  if (eye) {
    /* 흰자의 a 를 다시 계산 (위에서 b 만 모았다) */
    var sclA = [];
    var sidesA = [EYE_R, EYE_L];
    for (var e2 = 0; e2 < 2; e2++) {
      var ep2 = poly(sidesA[e2], 0.10);
      if (!ep2 || !inFrame(ep2, tol)) continue;
      var ei2 = _fillPolys([ep2], W, H);
      var ey2 = new Float64Array(ei2.length);
      for (var i2 = 0; i2 < ei2.length; i2++) ey2[i2] = chan(ei2[i2]).y - trend(ei2[i2]);
      var mid2 = _quantile(Float64Array.from(ey2).sort(), 0.55);
      for (var j2 = 0; j2 < ei2.length; j2++) if (ey2[j2] >= mid2) sclA.push(chan(ei2[j2]).a);
    }
    if (sclA.length >= o.minRegionPx) {
      abs = {
        reference: 'SCLERA_APPROX_NEUTRAL',
        confidence: 'LOW',
        caveat: '흰자는 완전한 중성이 아니며 나이·건강으로 변한다. 「色白/色赤/色黃」 판정은 PARTIAL 을 넘지 않는다.',
        skinRedVsSclera: (mA - _mean(sclA)) / divA,
        skinYellowVsSclera: (mB - eye._mSB) / divB,
        skinLightVsSclera: (mY - eye._mS) / divY
      };
    }
  }
  if (eye) { delete eye._mS; delete eye._mI; delete eye._mSB; delete eye._mSA; }

  /* ── 묶음 요약 (六府·五嶽) ────────────────────────────────── */
  function group(names, key) {
    var v = [], i;
    for (i = 0; i < names.length; i++) { var r = regions[names[i]]; if (r) v.push(r[key]); }
    return v.length ? { mean: _mean(v), min: Math.min.apply(null, v), max: Math.max.apply(null, v), n: v.length } : null;
  }

  return {
    ok: true,
    reject: null,
    meta: {
      version: SENSOR_COLOR_VERSION, normMode: o.normMode, detrendOrder: o.detrendOrder,
      width: W, height: H, aspect: (aspect && isFinite(aspect) && aspect > 0) ? aspect : (H / W),
      landmarkCount: landmarks.length, irisAvailable: irisAvailable,
      skinPixels: skinIdx.length, clipFrac: clipFrac,
      rejectedRegions: rejectedRegions
    },
    norm: { skinLogY: mY, sdLogY: dY, skinA: mA, sdA: dA, skinB: mB, sdB: dB, detrendCoef: coef },
    regions: regions,
    eye: eye,
    abs: abs,
    groups: {
      YUKBU_gloss: group(YUKBU, 'gloss'),           // 六府 平滿光而瑩 (R008)
      YUKBU_darkSpot: group(YUKBU, 'darkSpotFrac'), // 六府 疵瘢黒痣 (R009)
      OAK_lightness: group(OAK, 'lightness')        // 山岳 不宜昏暗 (XLHZ R049)
    }
  };
}

/* ============================================================================
   5. 내보내기 (Node/브라우저 공용)
   ========================================================================== */
var _api = {
  measureColor: measureColor,
  REGIONS: REGIONS,
  AXES: AXES,
  NOT_MEASURED: NOT_MEASURED,
  YUKBU: YUKBU,
  OAK: OAK,
  VERSION: SENSOR_COLOR_VERSION,
  DEFAULTS: DEFAULTS,
  /* 합성 검증기(p05)가 마스크를 그대로 쓰기 위한 내부 공개 */
  _internals: {
    OVAL: OVAL, LIP_OUTER: LIP_OUTER, LIP_INNER: LIP_INNER,
    EYE_R: EYE_R, EYE_L: EYE_L, BROW_R: BROW_R, BROW_L: BROW_L,
    IRIS_R: IRIS_R, IRIS_L: IRIS_L, NOSTRIL: NOSTRIL,
    fillPolys: _fillPolys, ring2px: _ring2px, shrinkPoly: _shrinkPoly, quantile: _quantile
  }
};

if (typeof module !== 'undefined' && module.exports) module.exports = _api;
if (typeof window !== 'undefined') window.CW_SENSOR_COLOR = _api;

})();
