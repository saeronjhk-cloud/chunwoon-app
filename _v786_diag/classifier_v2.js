// ============================================================
//  천운 v786 · 관상 분류기 v2 (제안본)
//  목표: 사진 종횡비 의존 제거 + 랜드마크 오지정 수정 +
//        고정임계 → 분위수 임계 + 미사용 계측축 12개 승격
// ============================================================
//  ★ 설계 원칙
//   1. 등방화: MediaPipe 는 x 를 폭, y 를 높이로 각각 정규화한다.
//      x/y 를 섞는 비율은 사진 종횡비에 비례해 왜곡되므로 y*=A 로 되돌린다.
//   2. 랜드마크 정정: FACE_OVAL 순서상 127/356 은 '관자', 172/397 이 '하악각'.
//      기존 코드의 jawW 는 턱이 아니었다.
//   3. 임계는 전부 REF(참조 분위수 레지스트리)에서만 읽는다. 코드에 상수 금지.
//      REF 미주입 시 fail-closed (UNCALIBRATED 반환).
//   4. 점수는 분위수 랭크 → 지정 범위를 균등하게 채운다.
// ============================================================

const AXES = [
  // key,           설명,               방향(+ 큰 값이 상위)
  ['whRatio', '얼굴 가로세로비', +1],
  ['jawRatio', '하악각폭/광대폭', +1],
  ['foreheadRatio', '이마폭/광대폭', +1],
  ['eyeAspect', '눈 가로/세로', +1],
  ['eyeSize', '눈 가로/얼굴폭', +1],
  ['eyeTilt', '외안각 경사도(°)', +1],
  ['noseWRatio', '비익폭/얼굴폭', +1],
  ['noseHRatio', '코길이/얼굴높이', +1],
  ['mouthRatio', '구각폭/얼굴폭', +1],
  ['lipThickness', '순적높이/얼굴높이', +1],
  ['symmetry', '좌우대칭', +1],
  ['thirds', '삼정균형', +1],
  ['myungGung', '명궁(미간폭)', +1],
  ['gwanRok', '관록궁(이마중앙폭)', +1],
  ['cheonI', '천이궁(관자균형)', +1],
  ['buCheo', '부처궁(눈꼬리각)', +1],
  ['jaNyeo', '자녀궁(와잠두께)', +1],
  ['jilAek', '질액궁(산근폭)', +1],
  ['jeonTaek', '전택궁(눈썹-눈거리)', +1],
  ['browLength', '보수관 길이', +1],
  ['browThick', '보수관 두께', +1],
  ['gwanGol', '관골 돌출도', +1],
  ['inJung', '인중 길이', +1],
  ['chin', '지각(턱) 길이', +1]
];

/** 등방 좌표 복원. aspect = 이미지높이/이미지폭 */
function isotropic(ai, aspect) {
  const A = (aspect && isFinite(aspect) && aspect > 0) ? aspect : 1;
  const out = new Array(ai.length);
  for (let i = 0; i < ai.length; i++) out[i] = { x: ai[i].x, y: ai[i].y * A, z: ai[i].z || 0 };
  return out;
}

/** 원계측 — 분류·점수 이전의 순수 측정값 24축 */
function measure(aiRaw, aspect) {
  const p = isotropic(aiRaw, aspect);
  const dx = (a, b) => Math.abs(p[a].x - p[b].x);
  const dy = (a, b) => Math.abs(p[a].y - p[b].y);

  const faceW = dx(234, 454);
  const faceH = dy(10, 152);
  const jawW = dx(172, 397);          // ★정정: 하악각 (FACE_OVAL 검증)
  const templeW = dx(127, 356);       // 관자 — 기존 코드가 jawW 라 부르던 것
  const foreheadW = dx(21, 251);

  const leW = dx(33, 133), leH = dy(159, 145);
  const reW = dx(362, 263), reH = dy(386, 374);
  const eyeW = (leW + reW) / 2, eyeH = (leH + reH) / 2;
  const lTilt = Math.atan2(p[133].y - p[33].y, dx(33, 133) || 1e-6) * 180 / Math.PI;
  const rTilt = Math.atan2(p[362].y - p[263].y, dx(362, 263) || 1e-6) * 180 / Math.PI;

  const noseW = dx(129, 358);
  const noseH = dy(1, 168);
  const mouthW = dx(61, 291);
  const lipH = dy(13, 0) + dy(17, 14);

  const lc = (p[33].x + p[133].x) / 2, rc = (p[362].x + p[263].x) / 2;
  const noseCx = p[1].x, faceCx = (p[234].x + p[454].x) / 2;
  const symmetry = 1 - Math.min(1, Math.abs(Math.abs(noseCx - lc) - Math.abs(rc - noseCx)) / (faceW || 1e-6) * 5);

  const t1 = p[168].y - p[10].y, t2 = p[1].y - p[168].y, t3 = p[152].y - p[1].y;
  const tot = t1 + t2 + t3, ideal = tot / 3;
  const thirds = 1 - Math.min(1, (Math.abs(t1 - ideal) + Math.abs(t2 - ideal) + Math.abs(t3 - ideal)) / (tot || 1e-6) * 2);

  const browLen = (Math.hypot(p[53].x - p[55].x, p[53].y - p[55].y) + Math.hypot(p[283].x - p[285].x, p[283].y - p[285].y)) / 2;

  return {
    whRatio: faceW / (faceH || 1e-6),
    jawRatio: jawW / (faceW || 1e-6),
    foreheadRatio: foreheadW / (faceW || 1e-6),
    eyeAspect: eyeW / (eyeH || 1e-6),
    eyeSize: eyeW / (faceW || 1e-6),
    eyeTilt: (lTilt + rTilt) / 2,
    noseWRatio: noseW / (faceW || 1e-6),
    noseHRatio: noseH / (faceH || 1e-6),
    mouthRatio: mouthW / (faceW || 1e-6),
    lipThickness: lipH / (faceH || 1e-6),
    symmetry, thirds,
    myungGung: dx(55, 285) / (faceW || 1e-6),
    gwanRok: foreheadW / (faceW || 1e-6),
    cheonI: 1 - Math.min(1, Math.abs(dx(21, 234) - dx(454, 251)) / (faceW || 1e-6) * 5),
    buCheo: (lTilt + rTilt) / 2,
    jaNyeo: (dy(117, 145) + dy(346, 374)) / 2 / (faceH || 1e-6),
    jilAek: dx(188, 412) / (faceW || 1e-6),
    jeonTaek: (dy(159, 66) + dy(386, 296)) / 2 / (faceH || 1e-6),
    browLength: browLen / (faceW || 1e-6),
    browThick: (dy(63, 66) + dy(293, 296)) / 2 / (faceH || 1e-6),
    gwanGol: faceW / (templeW || 1e-6),
    inJung: dy(0, 2) / (faceH || 1e-6),
    chin: dy(152, 17) / (faceH || 1e-6)
  };
}

/** 값 → 참조분위수 랭크 [0,1] (선형보간) */
function rank(v, qs) {
  if (!qs || qs.length < 3) return null;
  if (v <= qs[0]) return 0;
  if (v >= qs[qs.length - 1]) return 1;
  const n = qs.length - 1;
  for (let i = 0; i < n; i++) {
    if (v <= qs[i + 1]) {
      const t = (v - qs[i]) / ((qs[i + 1] - qs[i]) || 1e-12);
      return (i + t) / n;
    }
  }
  return 1;
}

/**
 * @param aiRaw   MediaPipe 정규화 랜드마크 468
 * @param aspect  이미지높이/이미지폭
 * @param REF     {version, q:{axisKey:[분위수배열]}} — 없으면 fail-closed
 */
function classifyV2(aiRaw, aspect, REF) {
  if (!aiRaw || aiRaw.length < 468) return { status: 'NO_LANDMARKS' };
  const m = measure(aiRaw, aspect);
  if (!REF || !REF.q) return { status: 'UNCALIBRATED', measures: m };

  const ranks = {}, missing = [];
  for (const [k] of AXES) {
    const r = rank(m[k], REF.q[k]);
    if (r === null) { missing.push(k); continue; }
    ranks[k] = r;
  }
  if (missing.length) return { status: 'REF_INCOMPLETE', missing, measures: m };

  // 5분위 라벨 (매우낮음/낮음/보통/높음/매우높음)
  const b5 = r => r < 0.10 ? 0 : r < 0.30 ? 1 : r < 0.70 ? 2 : r < 0.90 ? 3 : 4;
  const bucket = {};
  for (const [k] of AXES) bucket[k] = b5(ranks[k]);

  // ── 얼굴형: 2축 결합 (세로비 × 하악각비) 9분면 ──
  const b3 = r => r < 0.30 ? 0 : r < 0.70 ? 1 : 2;
  const shapeKey = ['long', 'oval', 'wide'][b3(ranks.whRatio)] + '_' +
    ['taper', 'even', 'square'][b3(ranks.jawRatio)];

  // ── 눈/코/입도 2축 결합 ──
  const eyeKey = ['narrow', 'mid', 'round'][2 - b3(ranks.eyeAspect)] + '_' +
    ['small', 'mid', 'big'][b3(ranks.eyeSize)] + '_' +
    ['up', 'flat', 'droopy'][b3(ranks.eyeTilt)];
  const noseKey = ['slim', 'mid', 'wide'][b3(ranks.noseWRatio)] + '_' +
    ['short', 'mid', 'long'][b3(ranks.noseHRatio)];
  const mouthKey = ['small', 'mid', 'big'][b3(ranks.mouthRatio)] + '_' +
    ['thin', 'mid', 'thick'][b3(ranks.lipThickness)];

  // ── 점수: 분위수 랭크를 지정 범위에 균등 사상 ──
  const toScore = (r, lo, hi) => Math.round(lo + r * (hi - lo));
  const wSum = ranks.symmetry * 0.30 + ranks.thirds * 0.30 + ranks.gwanGol * 0.10 +
    ranks.myungGung * 0.10 + ranks.jeonTaek * 0.10 + ranks.cheonI * 0.10;

  return {
    status: 'OK',
    refVersion: REF.version,
    measures: m,
    ranks,
    bucket,
    shapeKey, eyeKey, noseKey, mouthKey,
    overallScore: toScore(wSum, 62, 97),
    eyeScore: toScore((ranks.eyeSize + ranks.eyeTilt + ranks.jeonTaek) / 3, 62, 97),
    noseScore: toScore((ranks.noseWRatio + ranks.noseHRatio + ranks.jilAek) / 3, 62, 97),
    mouthScore: toScore((ranks.mouthRatio + ranks.lipThickness + ranks.inJung) / 3, 62, 97),
    // 프롬프트/엔진 결합용 결정변수 시그니처
    signature: AXES.map(([k]) => bucket[k]).join('')
  };
}

module.exports = { AXES, measure, classifyV2, isotropic, rank };
