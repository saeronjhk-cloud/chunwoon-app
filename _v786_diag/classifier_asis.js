const FACE_S=[{l:'둥근형',v:'round'},{l:'각진형',v:'square'},{l:'긴 형',v:'long'},{l:'역삼각형',v:'inv'}];
const FACE_E=[{l:'큰 눈',v:'big'},{l:'가늘고 긴 눈',v:'narrow'},{l:'둥근 눈',v:'round'},{l:'처진 눈',v:'droopy'}];
const FACE_N=[{l:'높고 오똑한 코',v:'high'},{l:'넓고 둥근 코',v:'wide'},{l:'작고 낮은 코',v:'small'},{l:'매부리코',v:'hooked'}];
const FACE_M=[{l:'큰 입',v:'big'},{l:'작은 입',v:'small'},{l:'두꺼운 입술',v:'thick'},{l:'얇은 입술',v:'thin'}];
function classifyFaceFromLandmarks(ai){
  // ai = array of 468 MediaPipe FaceMesh landmarks, each {x, y, z}
  // Returns {shape, eyes, nose, mouth} each being an element from FACE_S/E/N/M
  // plus numeric ratios for score calculation

  // --- Face shape: width vs height ratio ---
  // LM 234 = right cheek, LM 454 = left cheek (face width)
  // LM 10 = forehead top, LM 152 = chin bottom (face height)
  // LM 127 = right jaw, LM 356 = left jaw (jaw width)
  const faceW = Math.abs(ai[454].x - ai[234].x);
  const faceH = Math.abs(ai[152].y - ai[10].y);
  const jawW = Math.abs(ai[356].x - ai[127].x);
  const whRatio = faceW / (faceH || 0.001);
  const jawRatio = jawW / (faceW || 0.001); // how wide jaw is relative to face

  let shapeOpt;
  if (whRatio > 0.85) {
    // Wide face
    if (jawRatio > 0.88) shapeOpt = FACE_S.find(s=>s.v==='square'); // wide jaw = square
    else shapeOpt = FACE_S.find(s=>s.v==='round'); // narrower jaw but wide = round
  } else if (whRatio < 0.68) {
    shapeOpt = FACE_S.find(s=>s.v==='long'); // narrow and long
  } else {
    // Medium ratio — check if forehead is wider than jaw (inverted triangle)
    const foreheadW = Math.abs(ai[251].x - ai[21].x); // approximate forehead width
    if (foreheadW > jawW * 1.15) shapeOpt = FACE_S.find(s=>s.v==='inv');
    else if (jawRatio > 0.85) shapeOpt = FACE_S.find(s=>s.v==='square');
    else shapeOpt = FACE_S.find(s=>s.v==='round');
  }
  if (!shapeOpt) shapeOpt = FACE_S[0];

  // --- Eyes: width/height ratio + droopiness ---
  // Left eye: outer corner 33, inner corner 133, top 159, bottom 145
  // Right eye: outer corner 362, inner corner 263, top 386, bottom 374
  const leW = Math.abs(ai[33].x - ai[133].x);
  const leH = Math.abs(ai[159].y - ai[145].y);
  const reW = Math.abs(ai[362].x - ai[263].x);
  const reH = Math.abs(ai[386].y - ai[374].y);
  const avgEyeW = (leW + reW) / 2;
  const avgEyeH = (leH + reH) / 2;
  const eyeRatio = avgEyeW / (avgEyeH || 0.001);
  // Check droopiness: outer corner lower than inner corner
  const lDroop = ai[33].y - ai[133].y; // positive = outer corner lower
  const rDroop = ai[263].y - ai[362].y; // for right eye, inner(263) vs outer(362)
  const avgDroop = (lDroop + rDroop) / 2;
  // Eye size relative to face
  const eyeSizeRatio = avgEyeH / (faceH || 0.001);

  let eyeOpt;
  if (avgDroop > 0.008) {
    eyeOpt = FACE_E.find(e=>e.v==='droopy');
  } else if (eyeRatio > 4.0) {
    eyeOpt = FACE_E.find(e=>e.v==='narrow'); // very wide relative to height
  } else if (eyeSizeRatio > 0.055) {
    eyeOpt = FACE_E.find(e=>e.v==='big'); // large eyes
  } else if (eyeRatio < 3.0) {
    eyeOpt = FACE_E.find(e=>e.v==='round'); // rounder eyes
  } else {
    eyeOpt = FACE_E.find(e=>e.v==='big'); // default
  }
  if (!eyeOpt) eyeOpt = FACE_E[0];

  // --- Nose: width vs face width ---
  // LM 129 = right nostril, LM 358 = left nostril
  // LM 168 = nose bridge top
  const noseW = Math.abs(ai[358].x - ai[129].x);
  const noseWRatio = noseW / (faceW || 0.001);
  // Nose height: bridge(168) to tip(1)
  const noseH = Math.abs(ai[1].y - ai[168].y);
  const noseHRatio = noseH / (faceH || 0.001);
  // Nose bridge prominence (z-depth if available, else use proportions)
  const noseBridgeZ = ai[6] ? Math.abs(ai[6].z || 0) : 0;

  let noseOpt;
  if (noseWRatio > 0.30) {
    noseOpt = FACE_N.find(n=>n.v==='wide'); // wide nose
  } else if (noseWRatio < 0.20 && noseHRatio < 0.25) {
    noseOpt = FACE_N.find(n=>n.v==='small'); // small nose
  } else if (noseHRatio > 0.30 || noseBridgeZ > 0.06) {
    noseOpt = FACE_N.find(n=>n.v==='high'); // tall/prominent nose
  } else {
    // Check for hooked nose: tip(1) extends below alar base(2)
    const tipToAlar = ai[1].y - ai[2].y;
    if (tipToAlar > 0.015) noseOpt = FACE_N.find(n=>n.v==='hooked');
    else noseOpt = FACE_N.find(n=>n.v==='high');
  }
  if (!noseOpt) noseOpt = FACE_N[0];

  // --- Mouth: width vs inter-pupil distance, lip thickness ---
  // LM 61 = left mouth corner, LM 291 = right mouth corner
  // LM 13 = upper lip top, LM 14 = lower lip bottom
  // LM 0 = upper lip outer, LM 17 = lower lip outer (for thickness)
  const mouthW = Math.abs(ai[291].x - ai[61].x);
  const lePupil = {x:(ai[33].x+ai[133].x)/2, y:(ai[33].y+ai[133].y)/2};
  const rePupil = {x:(ai[362].x+ai[263].x)/2, y:(ai[362].y+ai[263].y)/2};
  const interPupil = Math.abs(rePupil.x - lePupil.x);
  const mouthFaceRatio = mouthW / (interPupil || 0.001);
  // Lip thickness: distance from lip top edge to bottom edge
  const upperLipH = Math.abs(ai[13].y - ai[0].y);
  const lowerLipH = Math.abs(ai[17].y - ai[14].y);
  const totalLipH = upperLipH + lowerLipH;
  const lipThicknessRatio = totalLipH / (faceH || 0.001);

  let mouthOpt;
  if (mouthFaceRatio > 1.3) {
    mouthOpt = FACE_M.find(m=>m.v==='big'); // wide mouth
  } else if (mouthFaceRatio < 0.95) {
    mouthOpt = FACE_M.find(m=>m.v==='small'); // small mouth
  } else if (lipThicknessRatio > 0.06) {
    mouthOpt = FACE_M.find(m=>m.v==='thick'); // thick lips
  } else if (lipThicknessRatio < 0.035) {
    mouthOpt = FACE_M.find(m=>m.v==='thin'); // thin lips
  } else {
    mouthOpt = mouthFaceRatio > 1.1 ? FACE_M.find(m=>m.v==='big') : FACE_M.find(m=>m.v==='small');
  }
  if (!mouthOpt) mouthOpt = FACE_M[0];

  // --- Scores based on actual ratios (golden ratio proximity, symmetry, etc.) ---
  // Face symmetry score
  const leCenter = {x:(ai[33].x+ai[133].x)/2};
  const reCenter = {x:(ai[362].x+ai[263].x)/2};
  const noseCx = ai[1].x;
  const faceCx = (ai[234].x + ai[454].x) / 2;
  const symmetryL = Math.abs(noseCx - leCenter.x);
  const symmetryR = Math.abs(reCenter.x - noseCx);
  const symmetry = 1 - Math.min(1, Math.abs(symmetryL - symmetryR) / (faceW || 0.001) * 5);

  // Three-court proportion (삼정: forehead, mid-face, lower face should be ~equal)
  const foreheadH = ai[168].y - ai[10].y; // forehead to brow
  const midFaceH = ai[1].y - ai[168].y; // brow to nose tip
  const lowerFaceH = ai[152].y - ai[1].y; // nose tip to chin
  const totalThirds = foreheadH + midFaceH + lowerFaceH;
  const idealThird = totalThirds / 3;
  const thirdsDev = (Math.abs(foreheadH-idealThird) + Math.abs(midFaceH-idealThird) + Math.abs(lowerFaceH-idealThird)) / (totalThirds || 0.001);
  const thirdsScore = 1 - Math.min(1, thirdsDev * 2);

  // Overall face score: blend of symmetry, proportion, golden ratio proximity
  const goldenRatio = 1.618;
  const fhwRatio = faceH / (faceW || 0.001);
  const goldenProximity = 1 - Math.min(1, Math.abs(fhwRatio - goldenRatio) / goldenRatio);

  const baseScore = Math.round(60 + symmetry * 15 + thirdsScore * 12 + goldenProximity * 10);
  const overallScore = Math.min(99, Math.max(65, baseScore));

  // Per-feature scores
  const eyeSymmetry = 1 - Math.min(1, Math.abs(leW-reW)/(avgEyeW||0.001));
  const eyeScore = Math.min(95, Math.max(65, Math.round(68 + eyeSymmetry*12 + (eyeSizeRatio>0.04?10:5))));

  const noseSymScore = 1 - Math.min(1, Math.abs(noseCx - faceCx)/(faceW||0.001)*8);
  const noseScore = Math.min(95, Math.max(65, Math.round(66 + noseSymScore*14 + (noseHRatio>0.22?8:4))));

  const mouthSym = 1 - Math.min(1, Math.abs((ai[61].x+ai[291].x)/2 - faceCx)/(faceW||0.001)*8);
  const mouthScore = Math.min(95, Math.max(65, Math.round(64 + mouthSym*14 + (lipThicknessRatio>0.04?8:5))));

  // ── 십이궁·오관 추가 측정 (프리미엄용) ──

  // 명궁(命宮) — 미간 너비·평탄도 (LM 55=좌 눈썹 안쪽, 285=우 눈썹 안쪽)
  const myungGungW = Math.abs(ai[285].x - ai[55].x);
  const myungGungRatio = myungGungW / (faceW || 0.001);

  // 관록궁(官祿宮) — 이마 중앙 너비 (LM 21=좌이마, 251=우이마)
  const foreheadCenterW = Math.abs(ai[251].x - ai[21].x);
  const foreheadWidthRatio = foreheadCenterW / (faceW || 0.001);

  // 천이궁(遷移宮) — 이마 양측(관자놀이) 균형
  const templeWL = Math.abs(ai[21].x - ai[234].x);
  const templeWR = Math.abs(ai[454].x - ai[251].x);
  const templeBalance = 1 - Math.min(1, Math.abs(templeWL - templeWR) / (faceW || 0.001) * 5);

  // 부처궁(夫妻宮) — 눈꼬리 각도 (외안각 기울기)
  const eyeTailAngleL = (ai[33].y - ai[133].y) / (Math.abs(ai[33].x - ai[133].x) || 0.001);
  const eyeTailAngleR = (ai[263].y - ai[362].y) / (Math.abs(ai[362].x - ai[263].x) || 0.001);
  const eyeTailAngle = ((Math.atan(eyeTailAngleL) + Math.atan(eyeTailAngleR)) / 2) * (180/Math.PI);

  // 자녀궁(子女宮) — 와잠(눈 아래) 두께 (LM 145=하안검, 117=볼 상단)
  const underEyeL = Math.abs(ai[117].y - ai[145].y);
  const underEyeR = Math.abs(ai[346].y - ai[374].y);
  const underEyeRatio = ((underEyeL + underEyeR) / 2) / (faceH || 0.001);

  // 질액궁(疾厄宮) — 산근(코뿌리) 너비 (LM 188, 412)
  const sanGeunW = Math.abs(ai[188].x - ai[412].x);
  const sanGeunRatio = sanGeunW / (faceW || 0.001);

  // 전택궁(田宅宮) — 눈썹-눈 거리 (LM 66=좌 눈썹 하단, 159=좌 상안검)
  const browEyeL = Math.abs(ai[159].y - ai[66].y);
  const browEyeR = Math.abs(ai[386].y - ai[296].y);
  const jeonTaekRatio = ((browEyeL + browEyeR) / 2) / (faceH || 0.001);

  // ── 오관 추가: 보수관(눈썹) ──
  // 눈썹 길이 (LM 55→46→53 좌, 285→276→283 우)
  const browLenL = Math.sqrt(Math.pow(ai[53].x-ai[55].x,2)+Math.pow(ai[53].y-ai[55].y,2));
  const browLenR = Math.sqrt(Math.pow(ai[283].x-ai[285].x,2)+Math.pow(ai[283].y-ai[285].y,2));
  const browLengthRatio = ((browLenL+browLenR)/2) / (faceW || 0.001);
  // 눈썹 기울기
  const browAngleL = Math.atan2(ai[53].y-ai[55].y, ai[53].x-ai[55].x)*(180/Math.PI);
  const browAngleR = Math.atan2(ai[283].y-ai[285].y, ai[285].x-ai[283].x)*(180/Math.PI);
  const browAngle = (browAngleL + browAngleR) / 2;
  // 눈썹 간격 (= 명궁과 동일)
  const browGapRatio = myungGungRatio;
  // 눈썹 두께 (LM 63=좌 눈썹 상단, 66=좌 눈썹 하단)
  const browThickL = Math.abs(ai[63].y - ai[66].y);
  const browThickR = Math.abs(ai[293].y - ai[296].y);
  const browThicknessRatio = ((browThickL+browThickR)/2) / (faceH || 0.001);

  // ── 관골(觀骨) — 광대뼈 돌출도 ──
  const cheekboneW = faceW; // 광대 너비 = 얼굴 최대폭
  const gwanGolProminence = cheekboneW / (jawW || 0.001); // 광대/턱 비율 (높을수록 광대 돌출)

  // ── 인중(人中) ──
  const inJungLen = Math.abs(ai[0].y - ai[2].y); // 코 하단(2) → 윗입술 상단(0)
  const inJungRatio = inJungLen / (faceH || 0.001);

  // ── 턱(地閣) ──
  const chinLen = Math.abs(ai[152].y - ai[17].y); // 턱끝(152) → 하입술 하단(17)
  const chinRatio = chinLen / (faceH || 0.001);
  const jawAngleL2 = Math.atan2(ai[152].y - ai[127].y, ai[127].x - ai[152].x)*(180/Math.PI);
  const jawAngleR2 = Math.atan2(ai[152].y - ai[356].y, ai[152].x - ai[356].x)*(180/Math.PI);
  const jawAngle = (jawAngleL2 + jawAngleR2) / 2;

  // ── 삼정(三停) 개별 비율 ──
  const upperThirdPct = (foreheadH / (totalThirds || 0.001)) * 100;
  const middleThirdPct = (midFaceH / (totalThirds || 0.001)) * 100;
  const lowerThirdPct = (lowerFaceH / (totalThirds || 0.001)) * 100;

  return {
    shapeOpt, eyeOpt, noseOpt, mouthOpt,
    overallScore,
    eyeScore, noseScore, mouthScore,
    ratios: {
      whRatio, jawRatio, eyeRatio, eyeSizeRatio, noseWRatio, noseHRatio,
      mouthFaceRatio, lipThicknessRatio, symmetry, thirdsScore, goldenProximity,
      // 십이궁 추가 측정
      myungGungRatio, foreheadWidthRatio, templeBalance, eyeTailAngle,
      underEyeRatio, sanGeunRatio, jeonTaekRatio,
      // 오관 추가: 눈썹
      browLengthRatio, browAngle, browGapRatio, browThicknessRatio,
      // 관골·인중·턱
      gwanGolProminence, inJungRatio, chinRatio, jawAngle,
      // 삼정 개별
      upperThirdPct, middleThirdPct, lowerThirdPct
    }
  };
}
module.exports={classifyFaceFromLandmarks};
