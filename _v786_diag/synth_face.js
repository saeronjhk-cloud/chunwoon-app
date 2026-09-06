// ============================================================
//  천운 v786 진단 — 관상 분류 다양성 하네스
//  합성 랜드마크 생성기 (MediaPipe FaceMesh 정규화 좌표 재현)
// ============================================================
//  ★가정 명시 (assumption, NOT ground truth):
//   - 아래 mu 값은 (a) MediaPipe canonical_face_model 실측 앵커,
//     (b) 표준 안면계측 통상값에서 잡은 "중심"입니다.
//   - 분산(CV)은 미지이므로 sweep 으로 민감도를 검증합니다.
//   - 결론은 "CV 를 3%~18% 로 흔들어도 유지되는가"로만 주장합니다.
// ============================================================
//  ★검증된 사실 (verified, 가정 아님):
//   V1. FACEMESH_FACE_OVAL 순회 순서 (npm @mediapipe/face_mesh 0.4.1633559619 실측):
//       10→338→297→332→284→251→389→356→454→323→361→288→397→365→379→378→400→377→152→...
//       ⟹ 251(이마옆) 이 356(관자) 보다 위, 356 이 454(광대·최대폭) 보다 위.
//       ⟹ 코드의 jawW=|x356-x127| 는 턱이 아니라 **관자놀이 폭**이다.
//       ⟹ 볼록한 얼굴 윤곽에서 foreheadW(21↔251) < jawW(127↔356) 가 구조적으로 성립.
//   V2. canonical_face_model.obj 정점 1~3 (= LM0,LM1,LM2):
//       LM1(코끝) = (0, -1.126865, 7.475604), LM2 = (0, -2.089024, 6.058267)
//       모델은 +y 가 위 ⟹ 이미지좌표(+y 아래)에서 LM1.y < LM2.y 이므로
//       tipToAlar = ai[1].y - ai[2].y < 0 이 항상 성립.
//   V3. index.html:4941-4943 — FaceMesh 입력 캔버스가 사진의 종횡비를 보존한다.
//       MediaPipe 는 x 를 폭으로, y 를 높이로 각각 정규화하므로
//       x/y 를 섞는 비율(whRatio, eyeRatio)은 **사진 종횡비에 비례**한다.
// ============================================================

function gauss(rnd) { // Box-Muller
  let u = 0, v = 0;
  while (u === 0) u = rnd();
  while (v === 0) v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 중심값 — 얼굴 물리 단위(faceW=1 기준)
const MU = {
  whRatioPhys: 0.810,  // V-anchor: canonical faceW 14.32 / faceH 17.665
  jawRatio: 1.000,     // V1: 관자폭/광대폭 ≈ 1.0 (canonical 14.60/14.32=1.019)
  trueJawRatio: 0.780, // ★실제 하악각폭(172↔397)/광대폭 — 개인차가 큰 축
  fhOverJaw: 0.930,    // V1: 이마폭 < 관자폭
  interPupil: 0.440,   // 동공간거리 / 얼굴폭
  eyeW: 0.215,         // 눈 가로 / 얼굴폭
  eyeAspect: 3.10,     // 눈 가로/세로 (물리)
  canthalTilt: -0.010, // 외안각이 내안각보다 '위'(-) = 몽골리안 상향 경사, faceH 대비
  noseWRatio: 0.265,   // 비익폭 / 얼굴폭
  noseHRatio: 0.250,   // LM168→LM1 / faceH
  bridgeZ: 0.035,      // |ai[6].z| (MediaPipe z 는 x 스케일과 유사)
  noseDorsum: 0.000,   // 콧대 볼록도(+ 면 매부리) — 개인차 축, 평균 0
  myungGungW: 0.110,   // 명궁(미간폭)/얼굴폭
  sanGeunW: 0.070,     // 질액궁(산근폭)/얼굴폭
  browLenR: 0.215,     // 보수관 길이/얼굴폭
  browThickR: 0.030,   // 보수관 두께/얼굴높이
  browTiltR: 0.014,    // 보수관 기울기(얼굴높이 대비 좌우 낙차)
  browEyeGap: 0.037,   // 전택궁(눈썹-눈 거리)/얼굴높이
  underEyeR: 0.075,    // 자녀궁(와잠)/얼굴높이
  mouthOverIP: 0.790,  // 구각폭 / 동공간거리
  lipThick: 0.104,     // (상+하 순적 높이) / faceH
  asym: 0.000          // 코 중심 좌우 편차 / 얼굴폭
};

// 각 파라미터의 상대 변동폭 배수 (CV = cv * REL)
const REL = {
  whRatioPhys: 1.0, jawRatio: 0.4, trueJawRatio: 1.4, fhOverJaw: 0.8, interPupil: 0.8,
  eyeW: 1.0, eyeAspect: 1.2, canthalTilt: 0, noseWRatio: 1.0,
  noseHRatio: 1.0, bridgeZ: 1.2, noseDorsum: 0, myungGungW: 1.3, sanGeunW: 1.3, browLenR: 1.1, browThickR: 1.5, browTiltR: 1.5, browEyeGap: 1.4, underEyeR: 1.3, mouthOverIP: 0.9, lipThick: 1.3, asym: 0
};

function sampleParams(rnd, cv) {
  const p = {};
  for (const k of Object.keys(MU)) {
    const sd = Math.abs(MU[k]) * cv * REL[k];
    p[k] = MU[k] + gauss(rnd) * sd;
  }
  // canthalTilt 는 절대 스케일 (faceH 대비), 별도 분포
  p.canthalTilt = MU.canthalTilt + gauss(rnd) * (0.014 * (cv / 0.08));
  p.asym = gauss(rnd) * (0.010 * (cv / 0.08));
  // 콧대 볼록도: 평균 0 · 우측 꼬리(매부리)를 가진 비대칭 분포
  p.noseDorsum = gauss(rnd) * (0.012 * (cv / 0.08)) + Math.max(0, gauss(rnd)) * (0.010 * (cv / 0.08));
  // 천이궁(관자놀이 좌우 비대칭) — 절대 스케일
  p.templeAsym = gauss(rnd) * (0.012 * (cv / 0.08));
  return p;
}

/**
 * 물리 파라미터 → MediaPipe 정규화 랜드마크(468개)
 * @param p  sampleParams 결과
 * @param A  이미지 종횡비 = imgH / imgW  (정사각 사진이면 1.0)
 */
function makeLandmarks(p, A) {
  const L = new Array(468);
  for (let i = 0; i < 468; i++) L[i] = { x: 0.5, y: 0.5, z: 0 };
  const set = (i, xp, yp, z) => { L[i] = { x: 0.5 + xp, y: 0.5 + yp / A, z: z || 0 }; };

  const faceW = 1.0;                      // 물리 폭 (x, 이미지 폭 대비 임의 스케일)
  const faceH = faceW / p.whRatioPhys;    // 물리 높이 (y)
  const halfW = faceW / 2;
  const jawW = p.jawRatio * faceW;
  const fhW = p.fhOverJaw * jawW;

  // 세로 기준선 (얼굴 상단 y=-0.5*faceH, 턱끝 y=+0.5*faceH)
  const yTop = -0.5 * faceH, yChin = 0.5 * faceH;
  set(10, 0, yTop);
  set(152, 0, yChin);
  // 광대(최대폭) — 얼굴 세로 중앙보다 약간 위
  set(234, -halfW, yTop + 0.46 * faceH);
  set(454, halfW, yTop + 0.46 * faceH);
  // 관자(V1: 광대보다 위)
  set(127, -jawW / 2, yTop + 0.36 * faceH);
  set(356, jawW / 2, yTop + 0.36 * faceH);
  // 이마 옆(V1: 관자보다 위)
  set(21, -fhW / 2, yTop + 0.22 * faceH);
  set(251, fhW / 2, yTop + 0.22 * faceH);
  // ★실제 하악각 (FACE_OVAL 상 광대보다 아래) — v2 분류기가 쓰는 축
  const tjW = p.trueJawRatio * faceW;
  set(172, -tjW / 2, yTop + 0.74 * faceH);
  set(397, tjW / 2, yTop + 0.74 * faceH);

  // ── 눈 ──
  const yEye = yTop + 0.42 * faceH;
  const ip = p.interPupil * faceW;
  const ew = p.eyeW * faceW;
  const eh = ew / p.eyeAspect;            // 물리 눈 세로
  const tilt = p.canthalTilt * faceH;     // + 면 외안각이 아래(처짐)
  // 좌안: 33=외안각(바깥=왼쪽), 133=내안각
  set(33, -(ip / 2 + ew / 2), yEye + tilt);
  set(133, -(ip / 2 - ew / 2), yEye);
  set(159, -ip / 2, yEye - eh / 2);
  set(145, -ip / 2, yEye + eh / 2);
  // 우안: 362=내안각, 263=외안각
  set(362, (ip / 2 - ew / 2), yEye);
  set(263, (ip / 2 + ew / 2), yEye + tilt);
  set(386, ip / 2, yEye - eh / 2);
  set(374, ip / 2, yEye + eh / 2);

  // ── 코 ──
  const yBridge = yTop + 0.38 * faceH;
  const noseH = p.noseHRatio * faceH;
  const yTip = yBridge + noseH;
  set(168, p.asym * faceW, yBridge);
  set(1, p.asym * faceW, yTip);
  set(2, p.asym * faceW, yTip + 0.020 * faceH);       // V2: LM2 는 LM1 보다 아래
  const nw = p.noseWRatio * faceW;
  set(129, p.asym * faceW - nw / 2, yTip);
  set(358, p.asym * faceW + nw / 2, yTip);
  set(6, 0, yBridge - 0.03 * faceH, p.bridgeZ);
  // 콧대 중간점 4개 (168→1 사이). z 에 볼록도(dorsum) 를 실어 매부리코를 표현
  [[197, 0.28], [195, 0.50], [5, 0.72], [4, 0.88]].forEach(([idx, t]) => {
    const bulge = p.noseDorsum * Math.sin(Math.PI * t) * faceH;
    set(idx, p.asym * faceW, yBridge + noseH * t, -bulge);
  });
  set(188, -0.035 * faceW, yBridge);
  set(412, 0.035 * faceW, yBridge);

  // ── 입 ──
  const yMouth = yTop + 0.78 * faceH;
  const mw = p.mouthOverIP * ip;
  set(61, -mw / 2, yMouth);
  set(291, mw / 2, yMouth);
  const lipTot = p.lipThick * faceH;
  set(0, 0, yMouth - lipTot * 0.55);   // 윗입술 바깥 위
  set(13, 0, yMouth - lipTot * 0.10);  // 윗입술 안쪽
  set(14, 0, yMouth + lipTot * 0.10);  // 아랫입술 안쪽
  set(17, 0, yMouth + lipTot * 0.55);  // 아랫입술 바깥 아래

  // ── 십이궁·오관 축 (v786 분류기가 실제로 사용) ──
  set(188, -p.sanGeunW / 2 * faceW, yBridge);
  set(412, p.sanGeunW / 2 * faceW, yBridge);
  const mg = p.myungGungW * faceW;                       // 명궁(미간폭)
  const yBrowIn = yEye - p.browEyeGap * faceH;
  set(55, -mg / 2, yBrowIn);
  set(285, mg / 2, yBrowIn);
  const bl = p.browLenR * faceW, bt = p.browThickR * faceH, btl = p.browTiltR * faceH;
  set(53, -(mg / 2 + bl), yBrowIn - btl);                // 좌 눈썹 끝(꼬리)
  set(283, (mg / 2 + bl), yBrowIn - btl);
  set(63, -(mg / 2 + bl * 0.5), yBrowIn - bt / 2);       // 좌 눈썹 상단
  set(66, -(mg / 2 + bl * 0.5), yBrowIn + bt / 2);       // 좌 눈썹 하단
  set(293, (mg / 2 + bl * 0.5), yBrowIn - bt / 2);
  set(296, (mg / 2 + bl * 0.5), yBrowIn + bt / 2);
  // 전택궁: 눈썹 하단(66) ↔ 상안검(159) 거리 = browEyeGap 이 지배
  set(117, -ip / 2, yEye + eh / 2 + p.underEyeR * faceH);  // 자녀궁(와잠)
  set(346, ip / 2, yEye + eh / 2 + p.underEyeR * faceH);
  // 천이궁: 좌우 관자 비대칭 (21/251 을 비대칭으로 이동)
  set(21, -fhW / 2 - p.templeAsym * faceW, yTop + 0.22 * faceH);
  set(251, fhW / 2, yTop + 0.22 * faceH);
  return L;
}

module.exports = { MU, REL, sampleParams, makeLandmarks, mulberry32 };
