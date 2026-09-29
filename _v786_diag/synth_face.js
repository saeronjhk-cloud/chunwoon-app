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

// ============================================================
//  ★v792 P-790-H — 표준 얼굴 앵커 생성기로 재작성 (구 막대 모형 폐기)
//  근본 원인(2026-09-29 실측 · _v790_work/p15): 구 생성기는 고정 비율 위치(눈 0.42·코뿌리 0.38·입 0.78 …)와
//    손으로 잡은 중심값을 썼는데, 이것이 MediaPipe 실제 기하와 어긋나 ★표준 얼굴이 참조표 30축 중 14축에서
//    양 끝(랭크<0.1·>0.9)에 놓였다(전택궁 1.00 · 눈 크기 0.04 · 입술 0.09 · 상정 38% 고정 …).
//    ⟹ 무료 화면에서 평균 얼굴이 「역삼각형 / 가늘고 긴 눈 / 얇은 입술」, 프리미엄 칸 9개가 90% 이상 한쪽.
//  새 방식: MediaPipe canonical_face_model(468 정점, Apache-2.0) 을 그대로 출발점으로 두고,
//    계측에 쓰이는 랜드마크만 파라미터 편차만큼 옮긴다. 중심값(MU)은 ★표준 얼굴에서 직접 계산한다.
//    ⟹ 무잡음(파라미터 = MU)이면 30축 전부가 표준 얼굴 계측과 일치한다(p15 A1).
//  ★좌표 부호: 모델 +y 위·+z 관찰자 쪽 → MediaPipe 정규화(+y 아래 · z 작을수록 카메라 쪽)로 y·z 둘 다 뒤집는다.
//  ★여전히 TIER-C(합성): 중심은 표준 얼굴, ★산포(REL)는 가정이다. 실사진 모집단(B-5) 확보 시 교체한다.
// ============================================================
const fs = require('fs'), path = require('path');
const CANON_OBJ = path.join(__dirname, '..', '_v789_work', 'fixtures', 'canonical_face_model.obj');
const CV0 = fs.readFileSync(CANON_OBJ, 'utf8').split('\n').filter(l => l.startsWith('v ')).map(l => l.split(/\s+/).slice(1, 4).map(Number));
if (CV0.length !== 468) throw new Error('canonical 468 정점 아님');
// 물리 좌표: 광대폭(234↔454)=1 · 원점 = 얼굴 중심 · +Y 아래 · Z 는 MediaPipe 부호(카메라 쪽 −)
const W0 = Math.abs(CV0[454][0] - CV0[234][0]), CY0 = (CV0[10][1] + CV0[152][1]) / 2;
const CAN = CV0.map(([x, y, z]) => ({ x: x / W0, y: -(y - CY0) / W0, z: -z / W0 }));
const cdx = (a, b) => Math.abs(CAN[a].x - CAN[b].x), cdy = (a, b) => Math.abs(CAN[a].y - CAN[b].y);
const H0 = cdy(10, 152);
const eyeC = (o, i) => (CAN[o].x + CAN[i].x) / 2;
const IP0 = Math.abs(eyeC(362, 263) - eyeC(33, 133));
const EW0 = (cdx(33, 133) + cdx(362, 263)) / 2, EH0 = (cdy(159, 145) + cdy(386, 374)) / 2;
// 콧대 볼록도(계측식과 동일한 부호 규약)
const NOSE_MIDS = [6, 197, 195, 5];
function dorsumOffsets(P) {
  const A = P[168], B = P[1], vy = B.y - A.y, vz = B.z - A.z, len = Math.hypot(vy, vz) || 1e-9;
  return NOSE_MIDS.map(i => ({ i, t: (P[i].y - A.y) / (vy || 1e-9), d: ((P[i].y - A.y) * vz - (P[i].z - A.z) * vy) / len }));
}
const DORS0 = dorsumOffsets(CAN);
const CONV0 = Math.max(0, ...DORS0.map(o => o.d)) / H0;
const BROW_L = [46, 53, 52, 65, 55, 70, 63, 105, 66, 107], BROW_R = [276, 283, 282, 295, 285, 300, 293, 334, 296, 336];
const TIP = [1, 2, 4, 94, 129, 358];

// 중심값 — ★전부 표준 얼굴에서 계산 (얼굴 물리 단위 faceW=1)
const MU = {
  whRatioPhys: 1 / H0,                                   // 광대폭/얼굴높이
  upperR: cdy(10, 168) / H0,                             // ★v792 신설 — 上停 대용(10→168)/얼굴높이. 구 생성기는 38% 고정(합성 결함)
  jawRatio: cdx(127, 356),                               // 관자폭/광대폭
  trueJawRatio: cdx(172, 397),                           // 하악각폭/광대폭
  fhOverJaw: cdx(21, 251) / cdx(127, 356),               // 이마폭/관자폭
  interPupil: IP0,                                       // 두 눈 중심 거리/광대폭
  eyeW: EW0,                                             // 눈 가로/광대폭
  eyeAspect: EW0 / EH0,                                  // 눈 가로/세로
  canthalTilt: (CAN[33].y - CAN[133].y) / H0,            // + = 외안각이 아래(처짐)
  noseWRatio: cdx(129, 358),                             // 비익폭/광대폭
  noseHRatio: cdy(168, 1) / H0,                          // 168→1 / 얼굴높이
  noseDorsum: CONV0,                                     // 콧대 볼록도
  myungGungW: cdx(55, 285),                              // 명궁(미간폭)
  sanGeunW: cdx(188, 412),                               // 질액궁(산근폭)
  browLenR: Math.hypot(CAN[46].x - CAN[55].x, CAN[46].y - CAN[55].y),   // 보수관 길이(머리 55 → 꼬리 46)
  browThickR: cdy(105, 52) / H0,                         // ★v792 눈썹 두께 = 윗윤곽 105 ↔ 아랫윤곽 52 (구 63↔66 은 둘 다 윗윤곽)
  browTiltR: (CAN[55].y - CAN[46].y) / H0,               // + = 꼬리가 위
  browEyeGap: cdy(159, 52) / H0,                         // ★v792 전택궁 = 눈썹 아랫윤곽 52 ↔ 상안검 159 (구 66 은 윗윤곽)
  underEyeR: cdy(117, 145) / H0,                         // 자녀궁
  mouthOverIP: cdx(61, 291) / IP0,                       // 구각폭/두 눈 중심 거리
  lipThick: (cdy(13, 0) + cdy(17, 14)) / H0,             // 상+하 순적 높이/얼굴높이
  asym: 0
};

// 각 파라미터의 상대 변동폭 배수 (CV = cv * REL) — ★가정. 구 생성기 값을 그대로 승계(신설 upperR 만 1.0)
const REL = {
  whRatioPhys: 1.0, upperR: 1.0, jawRatio: 0.4, trueJawRatio: 1.4, fhOverJaw: 0.8, interPupil: 0.8,
  eyeW: 1.0, eyeAspect: 1.2, canthalTilt: 0, noseWRatio: 1.0,
  noseHRatio: 1.0, noseDorsum: 0, myungGungW: 1.3, sanGeunW: 1.3, browLenR: 1.1, browThickR: 1.5, browTiltR: 11.9, browEyeGap: 1.4, underEyeR: 1.3, mouthOverIP: 0.9, lipThick: 1.3, asym: 0
};

// ★v789 browTiltR 의 REL 11.9 — 평균이 0 에 가까워 비례 CV 로는 부호가 바뀌지 않는다. canthalTilt 와 같은
//   절대 산포(cv 8% 에서 sd ≈ 0.014 faceH)가 되도록 잡았다.
function sampleParams(rnd, cv) {
  const p = {};
  for (const k of Object.keys(MU)) {
    const sd = Math.abs(MU[k]) * cv * REL[k];
    p[k] = MU[k] + gauss(rnd) * sd;
  }
  // 절대 스케일 축 (faceH 대비)
  p.canthalTilt = MU.canthalTilt + gauss(rnd) * (0.014 * (cv / 0.08));
  p.asym = gauss(rnd) * (0.010 * (cv / 0.08));
  // 콧대 볼록도: 표준 얼굴 값 중심 · 우측 꼬리(매부리)를 가진 비대칭 분포
  p.noseDorsum = MU.noseDorsum + gauss(rnd) * (0.012 * (cv / 0.08)) + Math.max(0, gauss(rnd)) * (0.010 * (cv / 0.08));
  // 천이궁(관자놀이 좌우 비대칭) — 절대 스케일
  p.templeAsym = gauss(rnd) * (0.012 * (cv / 0.08));
  return p;
}

/**
 * 물리 파라미터 → MediaPipe 정규화 랜드마크(468개)
 * @param p  sampleParams 결과 (파라미터 = MU 이면 표준 얼굴 그대로)
 * @param A  이미지 종횡비 = imgH / imgW  (정사각 사진이면 1.0)
 */
function makeLandmarks(p, A) {
  const P = CAN.map(q => ({ x: q.x, y: q.y, z: q.z }));
  const sgn = v => (v < 0 ? -1 : 1);
  const setX = (ids, cx) => ids.forEach(i => { P[i].x = cx(i); });
  const shift = (ids, dx, dy) => ids.forEach(i => { P[i].x += dx; P[i].y += dy; });

  // 1) 얼굴 세로 비 — 전체 y 를 중심 기준으로 늘인다
  const k = (1 / p.whRatioPhys) / H0;
  P.forEach(q => { q.y *= k; q.z *= 1; });
  let faceH = H0 * k;
  // 2) 上停(10→168) — 10 만 옮긴다(이마 높이). faceH 가 따라 바뀐다.
  P[10].y = P[168].y - p.upperR * faceH;
  faceH = Math.abs(P[152].y - P[10].y);

  // 3) 윤곽 폭
  setX([127, 356], i => sgn(CAN[i].x) * p.jawRatio / 2);
  setX([172, 397], i => sgn(CAN[i].x) * p.trueJawRatio / 2);
  const fhW = p.fhOverJaw * p.jawRatio;
  setX([21, 251], i => sgn(CAN[i].x) * fhW / 2);
  P[21].x -= p.templeAsym;                                  // 천이궁 비대칭

  // 4) 눈 — 중심 간격·폭·세로·기울기
  const ew = p.eyeW, eh = ew / p.eyeAspect;
  [[33, 133, 159, 145, -1], [263, 362, 386, 374, 1]].forEach(([o, i, up, dn, s]) => {
    const c = s * p.interPupil / 2;
    const cOld = (CAN[o].x + CAN[i].x) / 2;
    P[o].x = c + s * ew / 2; P[i].x = c - s * ew / 2;
    [up, dn].forEach(j => { P[j].x = c + (CAN[j].x - cOld); });
    const yc = (P[up].y + P[dn].y) / 2;
    P[up].y = yc - eh / 2; P[dn].y = yc + eh / 2;
    P[o].y = P[i].y + p.canthalTilt * faceH;
  });

  // 5) 코 — 길이(168→1)·폭·콧대·좌우 편차
  const dyTip = (P[168].y + p.noseHRatio * faceH) - P[1].y;
  shift(TIP, 0, dyTip);
  const ncx = P[1].x;
  setX([129, 358], i => ncx + sgn(CAN[i].x) * p.noseWRatio / 2);
  setX([188, 412], i => sgn(CAN[i].x) * p.sanGeunW / 2);
  {
    const A0 = P[168], B0 = P[1], vy = B0.y - A0.y, vz = B0.z - A0.z, len = Math.hypot(vy, vz) || 1e-9;
    const n = { y: vz / len, z: -vy / len };
    const dd = (p.noseDorsum - MU.noseDorsum) * faceH;
    DORS0.forEach(o => {
      const d = o.d * k + dd * Math.sin(Math.PI * Math.max(0, Math.min(1, o.t)));
      P[o.i].y = A0.y + o.t * vy + d * n.y;
      P[o.i].z = A0.z + o.t * vz + d * n.z;
    });
  }
  shift([168, 6, 197, 195, 5].concat(TIP), p.asym, 0);

  // 6) 눈썹 — 미간폭(명궁) · 눈썹-눈 거리(전택궁) · 두께 · 길이·기울기(꼬리 46/276)
  [[BROW_L, 55, 52, 105, 46, 159, -1], [BROW_R, 285, 282, 334, 276, 386, 1]].forEach(([G, h, lo, up, t, lid, s]) => {
    shift(G, s * p.myungGungW / 2 - P[h].x, (P[lid].y - p.browEyeGap * faceH) - P[lo].y);
    P[up].y = P[lo].y - p.browThickR * faceH;
    const dyT = -p.browTiltR * faceH;
    const dxT = Math.sqrt(Math.max(1e-12, p.browLenR * p.browLenR - dyT * dyT));
    P[t].x = P[h].x + s * dxT; P[t].y = P[h].y + dyT;
  });
  // 7) 자녀궁(와잠)
  [[117, 145], [346, 374]].forEach(([u, d]) => { P[u].y = P[d].y + p.underEyeR * faceH; });

  // 8) 입 — 폭·입술 두께(안쪽 13/14 고정, 바깥 0/17 을 비례 이동)
  const mw = p.mouthOverIP * p.interPupil;
  setX([61, 291], i => sgn(CAN[i].x) * mw / 2);
  const s0 = p.lipThick / MU.lipThick;
  P[0].y = P[13].y - (CAN[13].y - CAN[0].y) * k * s0;
  P[17].y = P[14].y + (CAN[17].y - CAN[14].y) * k * s0;

  return P.map(q => ({ x: 0.5 + q.x, y: 0.5 + q.y / A, z: q.z }));
}

module.exports = { MU, REL, sampleParams, makeLandmarks, mulberry32, CANON_OBJ };
