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
var CW_FACE_REF = __REF__;

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
function _cwFaceMeasureRaw(aiRaw, A, hair) {
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

/* ★v797 P-795-A — 근접 셀카 원근 보정 (실시간 전면 카메라 촬영 src='live' 일 때만)
   진단: 근접 셀카는 얼굴 중앙(코·입·명궁·산근·눈)이 커지고 얼굴이 세로로 길게 잡힌다. 같은 사람 원거리(후면 3배 줌)
   대비 콧방울 폭 +6.5/+9.3% · 명궁 +9.5/+5.7% · 가로세로비 −7.6/−5.1%(두 사람) → 백분위 30~60%p 이동.
   참조표 앵커(인터넷 인물 사진)는 원거리 조건 쪽이므로 근접 축값을 원거리로 환산한 뒤 랭크한다.
   보정표: canonical_face_model 핀홀 투영 · 유효거리 48cm(두 사람 독립 적합 48·50cm) / 원거리 120cm 의 축 원시값 비.
   생성 _v797_work/d04_gen_persp_table.js · 평가 _v797_work/p21 · jawRatio 는 모형과 실측 방향이 반대라 제외.
   사진 선택(src='file')·미지정은 보정하지 않는다(촬영 조건을 모른다). */
/* ★v799 P-799-A — 원근 보정 v2: 라벨셋 9명(근접 전면 34~54cm / 원거리 후면 3배 101~114cm) 실측으로 축별 선택.
   chin·jawRatio·cheonJiWidth = 경험 계수(사람 70% 이상 개선 · LOPO) · 나머지 = v1 기하 모형 계수 유지. 생성기 _v799_work/d15 → fixtures/persp_v2.json · 평가 p28.
   (v798 원칙 4·5 「jawRatio·ABS 축 무보정」은 2명 근거였고 9명 자료로 대체) */
var CW_FACE_PERSP_V1 = {"version": "PERSP-v1-20261004", "dEff": 48, "dFar": 120, "f": {"whRatio": 0.9315, "foreheadRatio": 1.0253, "eyeSize": 1.0543, "noseWRatio": 1.0795, "mouthRatio": 1.0725, "myungGung": 1.0827, "jilAek": 1.0839, "browLength": 1.057, "chin": 0.9787, "midOverLow": 1.0205}};
var CW_FACE_PERSP_V2 = {"version": "PERSP-v2-20261009", "dEff": null, "dFar": null, "f": {"whRatio": 0.9315, "foreheadRatio": 1.0253, "eyeSize": 1.0543, "noseWRatio": 1.0795, "mouthRatio": 1.0725, "myungGung": 1.0827, "jilAek": 1.0839, "browLength": 1.057, "chin": 0.8954, "midOverLow": 1.0205, "jawRatio": 0.9822, "cheonJiWidth": 1.0333}};
// ★되돌리기 스위치(외부 자문 R1 · 2026-10-09): 'v2' → 'v1' 한 줄로 이전 보정표 복귀(코어 재빌드 → index 치환 → p21·p28)
var CW_FACE_PERSP_ACTIVE = 'v2';
var CW_FACE_PERSP = CW_FACE_PERSP_ACTIVE === 'v1' ? CW_FACE_PERSP_V1 : CW_FACE_PERSP_V2;
var CW_FACE_PERSP_ALIAS = { foreheadWidthRatio: 'foreheadRatio', myungGungRatio: 'myungGung', browGapRatio: 'myungGung', sanGeunRatio: 'jilAek', browLengthRatio: 'browLength', chinRatio: 'chin' };
function _cwFaceMeasure(aiRaw, A, hair, src) {
  var m = _cwFaceMeasureRaw(aiRaw, A, hair);
  if (src !== 'live') return m;
  var f = CW_FACE_PERSP.f, k, ax;
  for (k in CW_FACE_PERSP_ALIAS) {   // 구 명칭 별칭은 같은 값일 때만 함께 환산(식이 다르면 건드리지 않음)
    ax = CW_FACE_PERSP_ALIAS[k];
    if (f[ax] && m[k] != null && m[ax] != null && Math.abs(m[k] - m[ax]) < 1e-12) m[k] = m[ax] / f[ax];
  }
  for (k in f) if (m[k] != null && isFinite(m[k])) m[k] = m[k] / f[k];
  m.perspCorrected = true;
  return m;
}

/* ★v797 P-797-A — 다중 프레임 랜드마크 합성
   진단: 같은 조건 4초 안 셀카 5장에서 눈 크기 랭크 0.23~0.77 · 명궁 0.65~0.88 — 한 프레임 계측이 크게 흔들린다.
   frames[0] = 저장되는 사진 프레임(머리선·화면 표시 기준). 나머지 프레임을 frames[0] 에 닮음변환(이동·회전·배율,
   최소제곱 · 등방 좌표 y×A)으로 맞춘 뒤 점·좌표별 중앙값. 중앙값이라 깜빡임 등 소수 이상 프레임에 강하다.
   평가 _v797_work/p22. 비율 축은 닮음변환에 불변이므로 맞춤은 값이 아니라 정합(같은 사진 위 좌표)을 위한 것이다. */
function _cwFaceLmAggregate(frames, A) {
  var F = [], i, j, k;
  for (i = 0; i < (frames || []).length; i++) if (frames[i] && frames[i].length >= 468) F.push(frames[i]);
  if (!F.length) return null;
  if (F.length === 1) return F[0];
  if (!(A > 0)) A = 1;
  var R = F[0], N = R.length;
  var rx = 0, ry = 0;
  for (k = 0; k < N; k++) { rx += R[k].x; ry += R[k].y * A; }
  rx /= N; ry /= N;
  var X = [], Y = [], Z = [];
  for (k = 0; k < N; k++) { X.push([]); Y.push([]); Z.push([]); }
  for (i = 0; i < F.length; i++) {
    var P = F[i], px = 0, py = 0;
    for (k = 0; k < N; k++) { px += P[k].x; py += P[k].y * A; }
    px /= N; py /= N;
    var a = 0, b = 0, d = 0;   // 복소 최소제곱: q ≈ (a+bi)·p
    for (k = 0; k < N; k++) {
      var ux = P[k].x - px, uy = P[k].y * A - py, vx = R[k].x - rx, vy = R[k].y * A - ry;
      a += ux * vx + uy * vy; b += ux * vy - uy * vx; d += ux * ux + uy * uy;
    }
    a /= (d || 1e-12); b /= (d || 1e-12);
    var sc = Math.sqrt(a * a + b * b);
    for (k = 0; k < N; k++) {
      var wx = P[k].x - px, wy = P[k].y * A - py;
      X[k].push(a * wx - b * wy + rx);
      Y[k].push((b * wx + a * wy + ry) / A);
      Z[k].push((P[k].z || 0) * sc);
    }
  }
  var med = function (v) { v.sort(function (p, q) { return p - q; }); var n = v.length; return n % 2 ? v[(n - 1) >> 1] : (v[n / 2 - 1] + v[n / 2]) / 2; };
  var out = [];
  for (k = 0; k < N; k++) out.push({ x: med(X[k]), y: med(Y[k]), z: med(Z[k]) });
  return out;
}

/* ★v798 P-798-A — 안경 감지 v2(학습형 소형 CNN · 엔진 내 계산 · AI 호출 없음)
   v797 의 콧등 가로선 규칙은 외부 홀드아웃(CelebAMask-HQ p4·p5, 안경 385·무안경 5000)에서 재현 94.5%·오탐 3.26% 였다
   (콧등 주름·앞머리·모자 그림자를 안경으로 오인 · 저대비 옛 폰 사진의 얇은 금속테 놓침).
   v2: 두 눈 안쪽(133·362) 축으로 회전·크기 정렬한 52×24 패치 → 소형 CNN(파라미터 11,673 · int8) → logit ≥ CW_GLASSES_T.logit.
   시험(p4·p5 · 1회): 재현 368/385(95.6%) · 오탐 23/5000(0.46%) · 머리 위 안경 0/35 · 정면 부분집합 오탐 7/2904
   셀카셋(앱 조건) 재현 21/21 · 오탐 0/19 · 인터넷 23장 재현 5/5 · 오탐 0/18.
   임계: 검증 p3(원본+열화) 음성 오탐 0.2% 분위(정밀도 우선 · 시험 보기 전 결정). 학습·평가 _v798_work/t04~t06 · 평가 p27.
   패치: 가로 ±1.6ex(양쪽 렌즈 테) · 세로 −0.7ex(눈썹)~+0.8ex(아래 테) · 간격 ex/16 · ex<12px 이면 계측 불가(null). */
var CW_GLASSES_T = { logit: 0.5799 };
var CW_GLASSES_PW = 52, CW_GLASSES_PH = 24;
function _cwGlassesPatch(gray, w, h, ai, flip) {
  if (!gray || !ai || ai.length < 468 || !(w > 0) || !(h > 0)) return null;
  var ax = ai[133].x * w, ay = ai[133].y * h, bx = ai[362].x * w, by = ai[362].y * h;
  var ex = Math.sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay));
  if (!(ex >= 12)) return null;
  var ux = (bx - ax) / ex, uy = (by - ay) / ex, vx = -uy, vy = ux, cx = (ax + bx) / 2, cy = (ay + by) / 2;
  var s = ex / 16, q = s / 4, PW = CW_GLASSES_PW, PH = CW_GLASSES_PH, P = new Float32Array(PW * PH);
  var bil = function (x, y) {
    var xx = x < 0 ? 0 : (x > w - 1.001 ? w - 1.001 : x), yy = y < 0 ? 0 : (y > h - 1.001 ? h - 1.001 : y);
    var x0 = Math.floor(xx), y0 = Math.floor(yy), fx = xx - x0, fy = yy - y0, i = y0 * w + x0;
    return (gray[i] * (1 - fx) + gray[i + 1] * fx) * (1 - fy) + (gray[i + w] * (1 - fx) + gray[i + w + 1] * fx) * fy;
  };
  for (var j = 0; j < PH; j++) {
    var t = -0.7 * ex + (j + 0.5) * s;
    for (var i = 0; i < PW; i++) {
      var c = (i - (PW - 1) / 2) * s * (flip ? -1 : 1), x = cx + ux * c + vx * t, y = cy + uy * c + vy * t;
      P[j * PW + i] = (bil(x - q, y - q) + bil(x + q, y - q) + bil(x - q, y + q) + bil(x + q, y + q)) / 4;
    }
  }
  return P;
}
/* 소형 CNN(1→8→16→24 합성곱 3×3·ReLU·최대풀링2 → 432→16→1) · 학습 _v798_work/t04 · 가중치 int8(텐서별 배율) _v798_work/t05
   입력 패치 표준화: (P−평균)/(표준편차+4) */
var CW_GLASSES_NET_SCALES = [0.004559304, 0.003175428, 0.006202256, 0.001978475, 0.007966617, 0.00243823, 0.005058426, 0.0005077412, 0.002768664, 0.0006038752];
var CW_GLASSES_NET_B64 = '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';
var _cwGlassesNetW = null;
function _cwGlassesNetLoad() {
  if (_cwGlassesNetW) return _cwGlassesNetW;
  var bin = (typeof atob === 'function') ? atob(CW_GLASSES_NET_B64) : Buffer.from(CW_GLASSES_NET_B64, 'base64').toString('binary');
  var n = [72, 8, 1152, 16, 3456, 24, 6912, 16, 16, 1], out = [], o = 0, t, i;
  for (t = 0; t < n.length; t++) {
    var a = new Float32Array(n[t]);
    for (i = 0; i < n[t]; i++) { var b = bin.charCodeAt(o++); a[i] = (b > 127 ? b - 256 : b) * CW_GLASSES_NET_SCALES[t]; }
    out.push(a);
  }
  _cwGlassesNetW = out; return out;
}
function _cwGlassesConv(x, ci, H, W, w, b, co) {   // 3×3 · 패딩1 · ReLU · 최대풀링2(내림)
  var y = new Float32Array(co * H * W), c, k, i, j, di, dj;
  for (c = 0; c < co; c++) for (i = 0; i < H; i++) for (j = 0; j < W; j++) {
    var s = b[c];
    for (k = 0; k < ci; k++) for (di = -1; di <= 1; di++) { var ii = i + di; if (ii < 0 || ii >= H) continue;
      for (dj = -1; dj <= 1; dj++) { var jj = j + dj; if (jj < 0 || jj >= W) continue;
        s += w[((c * ci + k) * 3 + di + 1) * 3 + dj + 1] * x[(k * H + ii) * W + jj]; } }
    y[(c * H + i) * W + j] = s > 0 ? s : 0;
  }
  var H2 = H >> 1, W2 = W >> 1, z = new Float32Array(co * H2 * W2);
  for (c = 0; c < co; c++) for (i = 0; i < H2; i++) for (j = 0; j < W2; j++) {
    var p = (c * H + 2 * i) * W + 2 * j;
    z[(c * H2 + i) * W2 + j] = Math.max(y[p], y[p + 1], y[p + W], y[p + W + 1]);
  }
  return z;
}
function _cwGlassesLogit(P) {
  var Wt = _cwGlassesNetLoad(), n = P.length, m = 0, v = 0, i, j;
  for (i = 0; i < n; i++) m += P[i]; m /= n;
  for (i = 0; i < n; i++) v += (P[i] - m) * (P[i] - m); v = Math.sqrt(v / n) + 4;
  var x = new Float32Array(n); for (i = 0; i < n; i++) x[i] = (P[i] - m) / v;
  x = _cwGlassesConv(x, 1, 24, 52, Wt[0], Wt[1], 8);
  x = _cwGlassesConv(x, 8, 12, 26, Wt[2], Wt[3], 16);
  x = _cwGlassesConv(x, 16, 6, 13, Wt[4], Wt[5], 24);
  var h = new Float32Array(16), out = Wt[9][0];
  for (j = 0; j < 16; j++) { var s = Wt[7][j]; for (i = 0; i < 432; i++) s += Wt[6][j * 432 + i] * x[i]; h[j] = s > 0 ? s : 0; out += Wt[8][j] * h[j]; }
  return out;
}

function _cwGlassesScore(gray, w, h, ai) {
  var P = _cwGlassesPatch(gray, w, h, ai, 0);
  if (!P) return null;
  var lg = _cwGlassesLogit(P);
  return { logit: lg, p: 1 / (1 + Math.exp(-lg)), glasses: lg >= CW_GLASSES_T.logit };
}

/* ★v797 P-792-B — 역삼각형 임계(★임시값 · 설정 상수로 분리)
   종전 1.06 은 실사진 63/63 에서 참이었다(진단 _v797_work/d07): LM21/251·LM172/397 은 MediaPipe FACE_OVAL 윤곽점일 뿐
   이마 경계·해부학적 하악각(gonion)이 아니다 → 「상부 윤곽폭 / 하부 윤곽폭」 proxy 이고, 구조상 늘 1 보다 크다(1.08~1.32).
   그래서 긴·각진이 아니면 무조건 역삼각형, 둥근형(水) 0/63 이었다.
   1.26 = 인터넷 인물 23장 분포 상위 15%(P85 1.262) — ★외부 자문 2건(2026-10-04) 결정 B: 임시 hotfix.
   같은 23장으로 성능을 판정하지 않는다. 사람 단위 블라인드 라벨셋으로 재보정할 것(P-792-B2). 평가 _v797_work/p25. */
var CW_FACE_INV_T = 1.26;   // ★임시값(hotfix) — 라벨셋 재보정 전까지

/* ★v797 P-797-D — 사진 선택 경로의 근접 셀카 판별(EXIF)
   원근 보정(P-795-A)은 실시간 촬영에만 적용됐다. 갤러리에서 고른 근접 셀카도 같은 원근 왜곡이 있다.
   JPEG EXIF 35mm 환산 초점거리(0xA405)와 얼굴 폭(LM234↔454, 정규화)으로 촬영 거리를 추정한다:
     d ≈ f35 / (가로변 환산 mm: 세로 24 · 가로 36) × 14.5cm / 얼굴폭비
   d ≤ CW_SELFIE_NEAR_CM 이면 근접 셀카 → 'live' 와 같은 보정. f35 가 없으면 판정하지 않는다(종전대로 무보정).
   14.5cm 는 LM234↔454 실제 폭의 대략값 — 판정 경계용이지 거리 계측값이 아니다. 평가 _v797_work/p26.
   한계: 인쇄 사진을 폰으로 다시 찍은 사진은 근접으로 판정된다(구분 불가). */
var CW_SELFIE_NEAR_CM = 60;
var CW_SELFIE_FACE_CM = 14.5;
function _cwJpegExif(u8) {
  try {
    if (!u8 || u8.length < 4 || u8[0] !== 0xFF || u8[1] !== 0xD8) return null;
    var p = 2, n = u8.length;
    while (p + 4 <= n) {
      if (u8[p] !== 0xFF) return null;
      var mk = u8[p + 1];
      if (mk === 0xD9 || mk === 0xDA) return null;
      if (mk === 0xFF) { p++; continue; }
      if (mk >= 0xD0 && mk <= 0xD7) { p += 2; continue; }
      var len = (u8[p + 2] << 8) | u8[p + 3];
      if (len < 2) return null;
      if (mk === 0xE1 && p + 10 <= n && u8[p + 4] === 0x45 && u8[p + 5] === 0x78 && u8[p + 6] === 0x69 && u8[p + 7] === 0x66) {
        var t = p + 10, end = Math.min(n, p + 2 + len);
        if (t + 8 > end) return null;
        var le = u8[t] === 0x49 && u8[t + 1] === 0x49;
        if (!le && !(u8[t] === 0x4D && u8[t + 1] === 0x4D)) return null;
        var r16 = function (o) { if (t + o + 2 > end) throw 0; return le ? (u8[t + o] | (u8[t + o + 1] << 8)) : ((u8[t + o] << 8) | u8[t + o + 1]); };
        var r32 = function (o) { if (t + o + 4 > end) throw 0; return le ? ((u8[t + o] | (u8[t + o + 1] << 8) | (u8[t + o + 2] << 16)) + u8[t + o + 3] * 16777216) : (u8[t + o] * 16777216 + ((u8[t + o + 1] << 16) | (u8[t + o + 2] << 8) | u8[t + o + 3])); };
        var out = { f35: null, focal: null, orientation: null, model: null };
        var readIfd = function (off, cb) { var cnt = r16(off); if (cnt > 512) return; for (var i = 0; i < cnt; i++) { var e = off + 2 + i * 12; cb(r16(e), r16(e + 2), r32(e + 4), e + 8); } };
        var exifPtr = null;
        readIfd(r32(4), function (tag, typ, cnt, vo) {
          if (tag === 0x8769) exifPtr = r32(vo);
          else if (tag === 0x0112) out.orientation = r16(vo);
          else if (tag === 0x0110 && typ === 2) { var so = cnt > 4 ? r32(vo) : vo, s = ''; for (var k = 0; k < cnt && k < 64; k++) { var ch = u8[t + so + k]; if (!ch) break; s += String.fromCharCode(ch); } out.model = s || null; }
        });
        if (exifPtr) readIfd(exifPtr, function (tag, typ, cnt, vo) {
          if (tag === 0xA405) { var v = typ === 3 ? r16(vo) : r32(vo); out.f35 = v > 0 ? v : null; }
          else if (tag === 0x920A && typ === 5) { var o = r32(vo), d = r32(o + 4); out.focal = d ? r32(o) / d : null; }
        });
        return (out.f35 || out.focal || out.orientation || out.model) ? out : null;
      }
      p += 2 + len;
    }
    return null;
  } catch (e) { return null; }
}
function _cwSelfieDistanceCm(f35, ai, w, h) {
  if (!(f35 > 0) || !ai || !ai[234] || !ai[454] || !(w > 0) || !(h > 0)) return null;
  var fw = Math.abs(ai[454].x - ai[234].x);
  if (!(fw > 0.02)) return null;
  return f35 / (w < h ? 24 : 36) * CW_SELFIE_FACE_CM / fw;
}
function _cwFileSrcFromExif(exif, ai, w, h) {
  var d = exif && exif.f35 ? _cwSelfieDistanceCm(exif.f35, ai, w, h) : null;
  if (d == null || !isFinite(d)) return { src: 'file', distCm: null };
  return { src: d <= CW_SELFIE_NEAR_CM ? 'live' : 'file', distCm: d };
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

/* ★v799 P-799-B — 얼굴형 표시: 단정 대신 「~형 계열」 + 측정 근거(외부 자문 R1 · Gemini/ChatGPT B안 · 제이 승인 2026-10-09)
   배경: 사람 평가자 3명 일치도 Fleiss κ=−0.02(우연 수준) → 엔진은 자기가 잰 것만 말한다. 판정 규칙·임계는 ★동결(자문 Q5).
   경계 구간(★사전 고정 · 결과 보고 조정 금지): 랭크 변수 ±0.05 · cheonJiWidth ±0.02. 판정 경로에 실제로 쓰인 결정만,
   임계 양쪽 대칭으로 「○○형에 가까운 △△형 계열」. 근거 문구는 좋고 나쁨이 들리지 않는 말로 고정. 평가 _v799_work/p29. */
var CW_FACE_SHAPE_BAND = { rank: 0.05, cjw: 0.02 };
function _cwFaceShapeRule(wr, jr, cjw) {
  if (wr < 0.25) return 'long';
  if (jr > 0.62) return 'square';
  if (cjw > CW_FACE_INV_T) return 'inv';   // ★v797 P-792-B — 상부/하부 윤곽폭 비(CW_FACE_INV_T 설명)
  return 'round';
}
var CW_FACE_SHAPE_BASIS = { long: '세로 길이가 긴 편', square: '턱선이 또렷한 편', inv: '이마 쪽이 턱보다 넓은 편', round: '가로·세로 균형이 비슷하고 턱선이 부드러운 편' };
function _cwFaceShapeDesc(wr, jr, cjw) {
  var B = CW_FACE_SHAPE_BAND, T = CW_FACE_INV_T, p = _cwFaceShapeRule(wr, jr, cjw), near = null, alt;
  var lab = function (v) { for (var i = 0; i < FACE_S.length; i++) if (FACE_S[i].v === v) return FACE_S[i].l; return v; };
  if (isFinite(wr) && Math.abs(wr - 0.25) < B.rank) { alt = _cwFaceShapeRule(wr < 0.25 ? 1 : 0, jr, cjw); if (alt !== p) near = alt; }
  if (!near && p !== 'long' && isFinite(jr) && Math.abs(jr - 0.62) < B.rank) { alt = _cwFaceShapeRule(wr, jr > 0.62 ? 0 : 1, cjw); if (alt !== p) near = alt; }
  if (!near && (p === 'inv' || p === 'round') && isFinite(cjw) && Math.abs(cjw - T) < B.cjw) { alt = _cwFaceShapeRule(wr, jr, cjw > T ? 0 : 99); if (alt !== p) near = alt; }
  var pc = function (r) { return isFinite(r) ? Math.round(r * 100) + '백분위' : '계측 불가'; };
  return {
    primary: p, near: near,
    title: (near ? lab(near) + '에 가까운 ' : '') + lab(p) + ' 계열',
    basis: CW_FACE_SHAPE_BASIS[p],
    detail: '가로세로비 ' + pc(wr) + ' · 턱 폭 ' + pc(jr) + ' · 이마/턱 폭 비 ' + (isFinite(cjw) ? cjw.toFixed(2) : '계측 불가') + '(기준 ' + T + ') — 참조 사진 분포 기준 · 판정 기준: 가로세로비 25백분위 미만=긴 형 · 턱 폭 62백분위 초과=각진형 · 이마/턱 폭 비 ' + T + ' 초과=역삼각형'
  };
}
function classifyFaceFromLandmarks(ai, aspect, hair, src) {
  var A = aspect;
  if (!(A > 0)) A = (typeof window !== 'undefined' && window._cwFaceAspect) || 1;
  if (hair === undefined) hair = (typeof window !== 'undefined' && window._cwHair) || null;   // ★v792 머리선(선택)
  if (src === undefined) src = (typeof window !== 'undefined' && window && window._cwFaceSrc) || null;   // ★v797 촬영 경로
  var m = _cwFaceMeasure(ai, A, hair, src);
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
  var shapeV = _cwFaceShapeRule(R.whRatio, R.jawRatio, m.cheonJiWidth);   // ★v799 P-799-B — 규칙은 _cwFaceShapeRule 한 곳(판정·임계 동결)
  var shapeDesc = _cwFaceShapeDesc(R.whRatio, R.jawRatio, m.cheonJiWidth);

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
    shapeOpt: pick(FACE_S, shapeV), shapeDesc: shapeDesc, eyeOpt: pick(FACE_E, eyeV),
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
