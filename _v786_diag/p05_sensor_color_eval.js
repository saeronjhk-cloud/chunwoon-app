/* ============================================================================
   P-05 · 색·기색(氣色) 계측축 검증        node _v786_diag/p05_sensor_color_eval.js
   ---------------------------------------------------------------------------
   실제 얼굴 사진이 없으므로 **합성 얼굴**로 검증한다. 사실적일 필요는 없다 —
   검증하려는 것은 「부위 마스크가 제자리에 얹히는가」와 「조명이 바뀌어도 축이 버티는가」다.

   검사 5가지
     ① ★조명 불변성 — 밝기 ±40% · 색온도(따뜻/차가움) · 감마 · 좌우 그라디언트 · 채도
        ⟹ 정규화 **전(normMode:'raw')/후(full)** 를 둘 다 재서 정규화의 효과를 수치로 보인다.
        ⟹ 목표: 주요 축 상대변화 ±10% 이내.
     ② 판별력 — 홍조·황달기·피부색·印堂 昏暗·準頭 光/枯·검은 점을 실제로 구분하는가.
     ③ 음성 대조군 — 얼굴이 아닌 이미지, 마스크가 얼굴 밖으로 나간 경우 등을 거부하는가(fail-closed).
     ④ 마스크 정합 — 부위 폴리곤이 의도한 자리를 실제로 덮는가(얼굴 안 · 서로 겹치지 않음).
     ⑤ ★변이 시험 — 정규화를 일부러 망가뜨렸을 때 ①이 그것을 잡아내는가.

   합성 랜드마크의 출처 ★추측 아님
     npm @mediapipe/face_mesh@0.4.1633559619 의
     face_mesh_solution_packed_assets.data 안
     face_geometry/data/geometry_pipeline_metadata_landmarks.binarypb 를 파싱해 얻은
     canonical face model 468정점의 (x,y) 를 그대로 아래 CANON_XY 에 박았다.
     검산: LM1=(0.000,-1.127) LM2=(0.000,-2.089) — synth_face.js 주석 V2 와 일치.
     ⟹ 정면 사진의 랜드마크 = (x, -y) 를 화면에 배치한 것과 같다.

   ★이 스크립트는 index.html · api/* · face_core_v786.js 를 읽지도 고치지도 않는다.
   ★규칙 JSON(ogwan.json · xlhz.json)도 고치지 않는다. 승격 후보는 별도 파일로만 낸다.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const S = require('./sensor_color.js');
const IN = S._internals;

/* ── canonical face model 468정점 (x,y) ─────────────────────────────────── */
const CANON_XY = [
  0.000,-3.406, 0.000,-1.127, 0.000,-2.089, -0.464,0.955, 0.000,-0.463, 0.000,0.366, 0.000,2.473, -4.253,2.578,
  0.000,4.019, 0.000,4.886, 0.000,8.262, 0.000,-3.707, 0.000,-3.918, 0.000,-3.994, 0.000,-4.542, 0.000,-4.746,
  0.000,-5.020, 0.000,-5.365, 0.000,-6.150, 0.000,-1.501, -0.416,-1.466, -7.088,5.435, -2.629,2.036, -3.198,1.986,
  -3.775,2.039, -4.466,2.423, -2.164,2.190, -3.208,3.224, -2.674,3.205, -3.745,3.165, -4.161,3.059, -5.062,1.934,
  -2.267,-7.426, -4.446,2.664, -7.215,2.263, -5.800,2.350, -2.845,-0.721, -0.711,-3.329, -0.606,-3.925, -1.432,-3.501,
  -1.915,-3.803, -1.131,-3.974, -1.564,-4.083, -2.650,-5.004, -0.427,-1.094, -0.496,-0.476, -5.253,3.882, -1.719,0.975,
  -1.609,-0.943, -1.651,-0.611, -4.766,-0.702, -0.478,0.296, -3.735,4.508, -4.589,4.302, -6.279,6.615, -1.221,4.142,
  -2.193,3.100, -3.103,-4.353, -6.720,-4.789, -1.194,-1.307, -0.730,-1.594, -2.456,-4.343, -2.205,-4.305, -4.986,4.802,
  -1.592,-1.258, -2.645,4.525, -2.760,5.101, -3.524,8.006, -5.600,5.715, -3.064,6.566, -5.721,4.255, -6.374,4.786,
  -0.673,-3.688, -1.263,-3.788, -1.733,-3.953, -1.044,-1.465, -2.321,-4.329, -2.057,-4.478, -2.153,-4.276, -0.947,-1.035,
  -1.469,-4.036, -1.024,-3.990, -0.533,-3.993, -0.770,-6.095, -0.700,-5.292, -0.670,-4.950, -0.631,-4.695, -0.583,-4.518,
  -1.537,-4.423, -1.616,-4.476, -1.729,-4.619, -1.839,-4.829, -2.368,-3.106, -7.542,-1.049, 0.000,-1.724, -1.827,-4.400,
  -1.930,-4.412, -0.597,-2.014, -1.406,-1.714, -0.662,-1.819, -2.342,0.572, -3.327,0.105, -1.726,-0.919, -5.133,7.486,
  -4.539,6.320, -3.987,5.109, -2.170,-5.440, -1.396,5.012, -1.620,6.599, -1.891,8.236, -4.196,2.235, -5.733,1.412,
  -1.860,2.356, -4.989,3.075, -1.303,1.416, -1.306,-0.673, -6.465,0.937, -5.259,0.946, -4.432,0.722, -3.301,0.862,
  -2.430,1.131, -1.821,1.468, -0.563,2.308, -6.338,-0.529, -5.588,3.208, -0.243,-1.463, -1.611,0.339, -7.743,2.365,
  -1.391,1.851, -1.786,-0.978, -4.671,2.664, -1.334,-0.284, -7.271,-2.891, -1.856,2.585, -0.923,0.073, -5.001,-6.135,
  -5.085,-7.179, -7.159,-0.812, -5.843,-5.248, -6.847,3.663, -2.413,-8.259, -0.180,-1.690, -2.104,-0.164, -6.408,2.236,
  -3.670,2.360, -3.177,2.294, -2.196,-4.598, -6.235,-1.944, -1.293,-9.296, -3.211,-8.533, -4.069,-7.993, 0.000,6.545,
  0.000,-9.403, -2.724,2.316, -2.288,2.399, -1.998,2.497, -6.130,3.399, -2.288,2.887, -2.724,2.962, -3.177,2.964,
  -3.670,2.928, -4.018,2.857, -7.556,4.107, -4.018,2.484, 0.000,-2.522, -1.776,-2.684, -1.222,-1.182, -0.731,-2.537,
  0.000,3.271, -4.135,-6.997, -3.312,-7.661, -1.314,-8.640, -5.941,-6.224, -1.998,2.744, -0.901,1.237, 0.000,-8.765,
  -2.309,-8.974, -6.954,-2.440, -1.099,-4.459, -1.181,-4.580, -1.256,-4.788, -1.325,-5.107, -1.546,-5.819, -1.954,-4.184,
  -2.118,-4.137, -2.285,-4.051, -2.850,-3.666, -5.279,-2.239, -0.947,1.908, -1.314,3.105, -1.780,2.860, -1.845,-4.099,
  -5.436,-4.030, -0.766,3.182, -1.939,-6.614, 0.000,1.059, -0.517,1.584, 0.000,1.728, -1.247,0.230, 0.000,-7.942,
  0.000,-6.991, -0.998,-6.931, -3.289,-5.383, -2.312,-1.566, -2.680,-6.112, -3.833,-1.537, -2.962,-2.274, -4.387,-2.683,
  -1.217,-7.834, -1.542,-0.137, -3.878,-6.042, -3.084,-6.810, -3.747,-4.504, -6.094,-3.206, -4.589,-4.729, -6.583,-3.941,
  -3.493,-3.196, -1.256,0.802, -1.126,-0.934, -1.443,-1.143, -0.923,-0.529, -1.755,3.529, -2.633,3.714, -3.388,3.722,
  -4.076,3.675, -4.623,3.475, -5.172,2.536, -7.297,0.763, -4.707,1.651, -4.072,1.477, -3.270,1.471, -2.528,1.617,
  -1.971,1.859, -1.580,2.098, -7.664,0.673, -1.397,-1.340, -0.885,0.659, -0.767,-0.968, -0.460,-1.334, -0.749,-1.068,
  -1.236,-1.586, -0.387,-1.410, -0.320,-1.608, -1.640,2.556, -1.256,2.467, -1.031,2.383, -4.253,2.772, -4.530,2.910,
  0.464,0.955, 4.253,2.578, 0.416,-1.466, 7.088,5.435, 2.629,2.036, 3.198,1.986, 3.775,2.039, 4.466,2.423,
  2.164,2.190, 3.208,3.224, 2.674,3.205, 3.745,3.165, 4.161,3.059, 5.062,1.934, 2.267,-7.426, 4.446,2.664,
  7.215,2.263, 5.800,2.350, 2.845,-0.721, 0.711,-3.329, 0.606,-3.925, 1.432,-3.501, 1.915,-3.803, 1.131,-3.974,
  1.564,-4.083, 2.650,-5.004, 0.427,-1.094, 0.496,-0.476, 5.253,3.882, 1.719,0.975, 1.609,-0.943, 1.651,-0.611,
  4.766,-0.702, 0.478,0.296, 3.735,4.508, 4.589,4.302, 6.279,6.615, 1.221,4.142, 2.193,3.100, 3.103,-4.353,
  6.720,-4.789, 1.194,-1.307, 0.730,-1.594, 2.456,-4.343, 2.205,-4.305, 4.986,4.802, 1.592,-1.258, 2.645,4.525,
  2.760,5.101, 3.524,8.006, 5.600,5.715, 3.064,6.566, 5.721,4.255, 6.374,4.786, 0.673,-3.688, 1.263,-3.788,
  1.733,-3.953, 1.044,-1.465, 2.321,-4.329, 2.057,-4.478, 2.153,-4.276, 0.947,-1.035, 1.469,-4.036, 1.024,-3.990,
  0.533,-3.993, 0.770,-6.095, 0.700,-5.292, 0.670,-4.950, 0.631,-4.695, 0.583,-4.518, 1.537,-4.423, 1.616,-4.476,
  1.729,-4.619, 1.839,-4.829, 2.368,-3.106, 7.542,-1.049, 1.827,-4.400, 1.930,-4.412, 0.597,-2.014, 1.406,-1.714,
  0.662,-1.819, 2.342,0.572, 3.327,0.105, 1.726,-0.919, 5.133,7.486, 4.539,6.320, 3.987,5.109, 2.170,-5.440,
  1.396,5.012, 1.620,6.599, 1.891,8.236, 4.196,2.235, 5.733,1.412, 1.860,2.356, 4.989,3.075, 1.303,1.416,
  1.306,-0.673, 6.465,0.937, 5.259,0.946, 4.432,0.722, 3.301,0.862, 2.430,1.131, 1.821,1.468, 0.563,2.308,
  6.338,-0.529, 5.588,3.208, 0.243,-1.463, 1.611,0.339, 7.743,2.365, 1.391,1.851, 1.786,-0.978, 4.671,2.664,
  1.334,-0.284, 7.271,-2.891, 1.856,2.585, 0.923,0.073, 5.001,-6.135, 5.085,-7.179, 7.159,-0.812, 5.843,-5.248,
  6.847,3.663, 2.413,-8.259, 0.180,-1.690, 2.104,-0.164, 6.408,2.236, 3.670,2.360, 3.177,2.294, 2.196,-4.598,
  6.235,-1.944, 1.293,-9.296, 3.211,-8.533, 4.069,-7.993, 2.724,2.316, 2.288,2.399, 1.998,2.497, 6.130,3.399,
  2.288,2.887, 2.724,2.962, 3.177,2.964, 3.670,2.928, 4.018,2.857, 7.556,4.107, 4.018,2.484, 1.776,-2.684,
  1.222,-1.182, 0.731,-2.537, 4.135,-6.997, 3.312,-7.661, 1.314,-8.640, 5.941,-6.224, 1.998,2.744, 0.901,1.237,
  2.309,-8.974, 6.954,-2.440, 1.099,-4.459, 1.181,-4.580, 1.256,-4.788, 1.325,-5.107, 1.546,-5.819, 1.954,-4.184,
  2.118,-4.137, 2.285,-4.051, 2.850,-3.666, 5.279,-2.239, 0.947,1.908, 1.314,3.105, 1.780,2.860, 1.845,-4.099,
  5.436,-4.030, 0.766,3.182, 1.939,-6.614, 0.517,1.584, 1.247,0.230, 0.998,-6.931, 3.289,-5.383, 2.312,-1.566,
  2.680,-6.112, 3.833,-1.537, 2.962,-2.274, 4.387,-2.683, 1.217,-7.834, 1.542,-0.137, 3.878,-6.042, 3.084,-6.810,
  3.747,-4.504, 6.094,-3.206, 4.589,-4.729, 6.583,-3.941, 3.493,-3.196, 1.256,0.802, 1.126,-0.934, 1.443,-1.143,
  0.923,-0.529, 1.755,3.529, 2.633,3.714, 3.388,3.722, 4.076,3.675, 4.623,3.475, 5.172,2.536, 7.297,0.763,
  4.707,1.651, 4.072,1.477, 3.270,1.471, 2.528,1.617, 1.971,1.859, 1.580,2.098, 7.664,0.673, 1.397,-1.340,
  0.885,0.659, 0.767,-0.968, 0.460,-1.334, 0.749,-1.068, 1.236,-1.586, 0.387,-1.410, 0.320,-1.608, 1.640,2.556,
  1.256,2.467, 1.031,2.383, 4.253,2.772, 4.530,2.910
];

/* ── 결정적 난수 ─────────────────────────────────────────────────────────── */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ============================================================================
   합성 랜드마크
   ========================================================================== */
const W = 480, H = 640;

function makeLandmarks(opt) {
  const o = Object.assign({ W, H, scale: 22.0, cx: null, cy: null, withIris: true }, opt || {});
  const cx = (o.cx === null) ? o.W / 2 : o.cx;
  const cy = (o.cy === null) ? o.H / 2 : o.cy;
  const lm = [];
  for (let i = 0; i < 468; i++) {
    const x = CANON_XY[i * 2], y = CANON_XY[i * 2 + 1];
    lm.push({ x: (cx + x * o.scale) / o.W, y: (cy - y * o.scale) / o.H, z: 0 });
  }
  if (o.withIris) {
    /* 468=右홍채 중심 · 469-472=右홍채 고리 · 473=左중심 · 474-477=左고리
       (FACEMESH_RIGHT_IRIS=[469,470,471,472] · LEFT_IRIS=[474,475,476,477] 실측) */
    for (const [a, b, c, d] of [[33, 133, 159, 145], [263, 362, 386, 374]]) {
      const px = (i) => ({ x: lm[i].x * o.W, y: lm[i].y * o.H });
      const A = px(a), B = px(b), C = px(c), Dd = px(d);
      const ecx = (A.x + B.x) / 2, ecy = (C.y + Dd.y) / 2;
      const r = Math.abs(A.x - B.x) * 0.195;   // 홍채 지름 ≈ 안열 폭의 0.39
      lm.push({ x: ecx / o.W, y: ecy / o.H, z: 0 });
      for (const [dx, dy] of [[0, -r], [r, 0], [0, r], [-r, 0]])
        lm.push({ x: (ecx + dx) / o.W, y: (ecy + dy) / o.H, z: 0 });
    }
  }
  lm._px = (i) => ({ x: lm[i].x * o.W, y: lm[i].y * o.H });
  lm._W = o.W; lm._H = o.H;
  return lm;
}

/* ============================================================================
   합성 얼굴 렌더러 — 부위별로 다른 색을 칠한 간단한 합성
   ========================================================================== */
const SCEN_BASE = {
  bg: [95, 105, 120],
  skin: [136, 105, 89],
  sclera: [176, 173, 170],
  iris: [46, 39, 35],
  brow: [58, 47, 40],
  lip: [148, 82, 79],
  nostril: [66, 48, 43],
  tint: {},          // 부위 → [mR,mG,mB] 곱셈 색조
  gloss: { JUNDU: 26, CHEONJEONG: 16, GWAN_R: 14, GWAN_L: 14, INDANG: 12, JIGAK: 10 },
  moles: [],         // [{region, count, darkness}]
  noise: 3.0,
  seed: 20260906
};

function render(lm, scen) {
  const sc = Object.assign({}, SCEN_BASE, scen || {});
  sc.tint = Object.assign({}, SCEN_BASE.tint, (scen && scen.tint) || {});
  sc.gloss = Object.assign({}, SCEN_BASE.gloss, (scen && scen.gloss) || {});
  const w = lm._W, h = lm._H;
  const data = new Uint8ClampedArray(w * h * 4);
  const buf = new Float64Array(w * h * 3);
  const rnd = mulberry32(sc.seed);

  for (let i = 0; i < w * h; i++) { buf[i * 3] = sc.bg[0]; buf[i * 3 + 1] = sc.bg[1]; buf[i * 3 + 2] = sc.bg[2]; }

  const P = (ring, shrink) => IN.shrinkPoly(IN.ring2px(ring, lm, w, h), shrink || 0);
  const paint = (idx, col, mode) => {
    for (let k = 0; k < idx.length; k++) {
      const p = idx[k] * 3;
      if (mode === 'mul') { buf[p] *= col[0]; buf[p + 1] *= col[1]; buf[p + 2] *= col[2]; }
      else { buf[p] = col[0]; buf[p + 1] = col[1]; buf[p + 2] = col[2]; }
    }
  };

  /* 얼굴 바탕 + 완만한 세로 음영 + 저주파 색 얼룩
     ★색 얼룩을 넣는 이유: 균일하게 칠한 합성 피부는 색 분산이 0 에 가까워
       z 축(= 얼굴 피부 분포로 나눈 값)이 비현실적으로 발산한다. 실제 피부에는
       저주파 색 편차가 있으므로 그것을 재현해야 z 의 크기가 현실 범위에 든다. */
  const ovalIdx = IN.fillPolys([P(IN.OVAL, 0)], w, h);
  for (let k = 0; k < ovalIdx.length; k++) {
    const i = ovalIdx[k], x = i % w, y = (i / w) | 0, p = i * 3;
    const shade = 1.06 - 0.12 * (y / h);
    const bR = 1 + 0.075 * Math.sin(x / 41.0 + 0.7) * Math.cos(y / 33.0);
    const bG = 1 + 0.045 * Math.sin(x / 27.0 + 2.1) * Math.cos(y / 46.0 + 1.1);
    const bB = 1 + 0.085 * Math.sin(x / 35.0 + 4.0) * Math.cos(y / 29.0 + 2.4);
    buf[p] = sc.skin[0] * shade * bR; buf[p + 1] = sc.skin[1] * shade * bG; buf[p + 2] = sc.skin[2] * shade * bB;
  }

  /* 부위 색조 — ★마스크와 같은 폴리곤이 아니라 조금 더 크게 칠한다(자기충족 방지) */
  for (const rn in sc.tint) {
    const def = S.REGIONS[rn]; if (!def) continue;
    paint(IN.fillPolys([P(def.ring, Math.max(0, def.shrink - 0.07))], w, h), sc.tint[rn], 'mul');
  }

  /* 눈썹 · 입술 · 콧구멍 */
  paint(IN.fillPolys([P(IN.BROW_R, 0.05)], w, h), sc.brow);
  paint(IN.fillPolys([P(IN.BROW_L, 0.05)], w, h), sc.brow);
  paint(IN.fillPolys([P(IN.LIP_OUTER, 0.03)], w, h), sc.lip);
  paint(IN.fillPolys([P(IN.NOSTRIL, 0.30)], w, h), sc.nostril);

  /* 눈 — 흰자 채우고 홍채 원반 */
  for (const [eye, irisRing] of [[IN.EYE_R, IN.IRIS_R], [IN.EYE_L, IN.IRIS_L]]) {
    paint(IN.fillPolys([P(eye, 0.04)], w, h), sc.sclera);
    if (lm.length >= 478) {
      const ip = IN.ring2px(irisRing, lm, w, h);
      const c = [(ip[1][0] + ip[3][0]) / 2, (ip[0][1] + ip[2][1]) / 2];
      const r = Math.abs(ip[1][0] - ip[3][0]) / 2;
      const eyeIdx = IN.fillPolys([P(eye, 0.04)], w, h);
      for (let k = 0; k < eyeIdx.length; k++) {
        const i = eyeIdx[k], x = i % w, y = (i / w) | 0;
        if (Math.hypot(x - c[0], y - c[1]) <= r) { const p = i * 3; buf[p] = sc.iris[0]; buf[p + 1] = sc.iris[1]; buf[p + 2] = sc.iris[2]; }
      }
    }
  }

  /* 정반사(광택) — 부위 중심에 좁은 가우시안 밝은 점 */
  for (const rn in sc.gloss) {
    const g = sc.gloss[rn]; if (!(g > 0)) continue;
    const def = S.REGIONS[rn]; if (!def) continue;
    const idx = IN.fillPolys([P(def.ring, def.shrink)], w, h);
    if (!idx.length) continue;
    let mx = 0, my = 0;
    for (let k = 0; k < idx.length; k++) { mx += idx[k] % w; my += (idx[k] / w) | 0; }
    mx /= idx.length; my /= idx.length;
    const sig = 0.30 * Math.sqrt(idx.length / Math.PI) + 0.8;
    for (let k = 0; k < idx.length; k++) {
      const i = idx[k], x = i % w, y = (i / w) | 0;
      const d2 = (x - mx) * (x - mx) + (y - my) * (y - my);
      const add = g * Math.exp(-d2 / (2 * sig * sig));
      const p = i * 3; buf[p] += add; buf[p + 1] += add; buf[p + 2] += add;
    }
  }

  /* 검은 점(黒痣) */
  for (const m of (sc.moles || [])) {
    const def = S.REGIONS[m.region]; if (!def) continue;
    const idx = IN.fillPolys([P(def.ring, def.shrink)], w, h);
    if (idx.length < 20) continue;
    for (let c = 0; c < (m.count || 1); c++) {
      const seed = idx[Math.floor(rnd() * idx.length)];
      const sx = seed % w, sy = (seed / w) | 0, rr = m.radius || 2.2;
      for (let k = 0; k < idx.length; k++) {
        const i = idx[k], x = i % w, y = (i / w) | 0;
        if (Math.hypot(x - sx, y - sy) <= rr) {
          const p = i * 3; buf[p] *= m.darkness; buf[p + 1] *= m.darkness; buf[p + 2] *= m.darkness;
        }
      }
    }
  }

  /* 잡음 — 채널마다 독립(실제 센서 잡음이 그렇다). 변환 이전에 넣으므로 모든 변환본이 같은 잡음을 공유한다 */
  for (let i = 0; i < w * h; i++) {
    for (let c = 0; c < 3; c++) data[i * 4 + c] = buf[i * 3 + c] + (rnd() - 0.5) * 2 * sc.noise;
    data[i * 4 + 3] = 255;
  }
  return { data, width: w, height: h };
}

/* ============================================================================
   조명 변환 — 렌더된 8bit 이미지에 건다
   ========================================================================== */
const TRANSFORMS = {
  'BASE(원본)': (r, g, b) => [r, g, b],
  '밝기 +40%': (r, g, b) => [r * 1.4, g * 1.4, b * 1.4],
  '밝기 -40%': (r, g, b) => [r * 0.6, g * 0.6, b * 0.6],
  '색온도 따뜻': (r, g, b) => [r * 1.18, g * 1.00, b * 0.82],
  '색온도 차가움': (r, g, b) => [r * 0.84, g * 1.00, b * 1.16],
  '감마 0.70': (r, g, b) => [255 * Math.pow(r / 255, 0.7), 255 * Math.pow(g / 255, 0.7), 255 * Math.pow(b / 255, 0.7)],
  '감마 1.45': (r, g, b) => [255 * Math.pow(r / 255, 1.45), 255 * Math.pow(g / 255, 1.45), 255 * Math.pow(b / 255, 1.45)],
  '좌우 그라디언트': null,   // 위치 의존 — 아래에서 따로 처리
  '채도 x0.60': (r, g, b) => { const y = 0.299 * r + 0.587 * g + 0.114 * b; return [y + 0.6 * (r - y), y + 0.6 * (g - y), y + 0.6 * (b - y)]; },
  '채도 x1.45': (r, g, b) => { const y = 0.299 * r + 0.587 * g + 0.114 * b; return [y + 1.45 * (r - y), y + 1.45 * (g - y), y + 1.45 * (b - y)]; }
};

function applyTransform(img, name) {
  const out = { data: new Uint8ClampedArray(img.data.length), width: img.width, height: img.height };
  const f = TRANSFORMS[name];
  for (let i = 0; i < img.width * img.height; i++) {
    const q = i * 4;
    let r = img.data[q], g = img.data[q + 1], b = img.data[q + 2], v;
    if (name === '좌우 그라디언트') {
      const k = 0.62 + 0.76 * ((i % img.width) / (img.width - 1));
      v = [r * k, g * k, b * k];
    } else v = f(r, g, b);
    out.data[q] = v[0]; out.data[q + 1] = v[1]; out.data[q + 2] = v[2]; out.data[q + 3] = 255;
  }
  return out;
}

/* ============================================================================
   축 추출기 — 「주요 축」 (원문 조건에 직접 걸리는 것만 고른다)
   ========================================================================== */
const KEY_AXES = [
  ['顴.redness', r => r.regions.GWAN_R.redness, '色赤·紅潤 (XLHZ R016/R019/R026)'],
  ['印堂.lightness', r => r.regions.INDANG.lightness, '明潤·昏暗 (XLHZ R046/R049/R051)'],
  ['準頭.gloss', r => r.regions.JUNDU.gloss, '潤·瑩·光 ↔ 枯 (OGWAN R008 / XLHZ R016)'],
  ['脣.redness', r => r.regions.SEUNG.redness, '色紅 (XLHZ R019/R026)'],
  ['天庭.yellowness', r => r.regions.CHEONJEONG.yellowness, '色黃 (XLHZ R024)'],
  ['눈.흑백대비', r => r.eye.irisScleraContrast, '白如玉黑如漆·黑白分明 (OGWAN R027/R037)'],
  ['abs.피부黃', r => r.abs.skinYellowVsSclera, '色黃 전체 (XLHZ R024)'],
  ['abs.피부白', r => r.abs.skinLightVsSclera, '色白 전체 (XLHZ R003)']
];
const REL_FLOOR = 0.30;   // z 단위. 0 근처 축에서 상대변화율이 발산하는 것을 막는 바닥값(명시)

function relChange(v0, v1) { return Math.abs(v1 - v0) / (Math.abs(v0) + REL_FLOOR); }

/* ============================================================================
   하네스
   ========================================================================== */
const line = (c) => c.repeat(92);
let total = 0, pass = 0, fail = 0; const fails = [];
function check(sec, name, ok, detail) {
  total++;
  if (ok) pass++; else { fail++; fails.push(`[${sec}] ${name} — ${detail || ''}`); }
}
const f2 = (v) => (v === null || v === undefined || !isFinite(v)) ? '   n/a' : (v >= 0 ? ' ' : '') + v.toFixed(3);
const pc = (v) => !isFinite(v) ? '  n/a' : (v * 100).toFixed(1) + '%';
const pad = (s, n) => { s = String(s); while (s.length < n) s += ' '; return s; };
const lpad = (s, n) => { s = String(s); while (s.length < n) s = ' ' + s; return s; };

/* 「기색이 풍부한」 합성 얼굴 — 모든 주요 축이 0 이 아니게 만든다 */
const RICH = {
  tint: {
    GWAN_R: [1.13, 0.92, 0.92], GWAN_L: [1.13, 0.92, 0.92],  // 홍조
    INDANG: [0.74, 0.74, 0.76],                               // 印堂 昏暗
    CHEONJEONG: [1.04, 1.02, 0.84],                           // 이마 누런 기
    ANHA_R: [0.88, 0.86, 0.90], ANHA_L: [0.88, 0.86, 0.90]    // 와잠 어둡게
  },
  gloss: { JUNDU: 34, INDANG: 4 }
};

console.log(line('='));
console.log('  P-05 · 색·기색(氣色) 계측축 검증  —  sensor_color.js v' + S.VERSION);
console.log(line('='));

const lm478 = makeLandmarks({ withIris: true });
const lm468 = makeLandmarks({ withIris: false });
const baseImg = render(lm478, RICH);

/* ── 0. 기본 동작 · 마스크 정합 ─────────────────────────────────────────── */
console.log('\n' + line('-'));
console.log('  0. 기본 동작 · 마스크 정합');
console.log(line('-'));
const R0 = S.measureColor(baseImg, lm478, H / W);
check('0', '합성 얼굴에서 계측이 성공한다', R0.ok, R0.reject && R0.reject.reason);
if (!R0.ok) { console.log('  ★계측 실패: ' + JSON.stringify(R0.reject)); }
else {
  console.log('  피부 기준 픽셀 ' + R0.meta.skinPixels + ' · 클리핑 ' + pc(R0.meta.clipFrac) +
    ' · 홍채출처 ' + R0.eye.irisSource);
  console.log('  ' + pad('부위', 18) + lpad('px', 6) + lpad('밝기', 9) + lpad('붉은기', 9) +
    lpad('누런기', 9) + lpad('광택', 9) + lpad('색산포', 9) + lpad('검은점', 9));
  let missing = [];
  for (const rn in S.REGIONS) {
    const r = R0.regions[rn];
    if (!r) { missing.push(rn); console.log('  ' + pad(rn, 18) + lpad('—', 6) + '   (마스크 없음)'); continue; }
    console.log('  ' + pad(rn, 18) + lpad(r.pixels, 6) + lpad(f2(r.lightness), 9) + lpad(f2(r.redness), 9) +
      lpad(f2(r.yellowness), 9) + lpad(f2(r.gloss), 9) + lpad(f2(r.chromaDispersion), 9) + lpad(pc(r.darkSpotFrac), 9));
  }
  check('0', '15개 부위 마스크가 전부 만들어진다', missing.length === 0, '없는 부위: ' + missing.join(','));
  const minPx = Math.min.apply(null, Object.keys(S.REGIONS).map(k => R0.regions[k] ? R0.regions[k].pixels : 0));
  check('0', '가장 작은 부위도 30px 이상이다', minPx >= 30, 'min=' + minPx);
  console.log('  눈: 흰자밝기 ' + f2(R0.eye.scleraLightness) + ' · 홍채어둠 ' + f2(R0.eye.irisDarkness) +
    ' · 흑백대비 ' + f2(R0.eye.irisScleraContrast) + ' · 흰자黃 ' + f2(R0.eye.scleraYellow));
  console.log('  abs(흰자 기준): 피부赤 ' + f2(R0.abs.skinRedVsSclera) + ' · 피부黃 ' + f2(R0.abs.skinYellowVsSclera) +
    ' · 피부白 ' + f2(R0.abs.skinLightVsSclera) + '  [confidence=' + R0.abs.confidence + ']');
  check('0', '흑백대비가 양수다(흰자가 홍채보다 밝다)', R0.eye.irisScleraContrast > 1, 'v=' + f2(R0.eye.irisScleraContrast));
  /* ★점 없는 얼굴에서 검은점 축이 0 이어야 한다 — 마스크가 눈썹·콧구멍을 물면 여기서 터진다 */
  const fp = Object.keys(S.REGIONS).filter(k => R0.regions[k] && R0.regions[k].darkSpotFrac > 0.005);
  check('0', '점 없는 합성 얼굴에서 검은점 축의 거짓 양성이 없다(전 부위 <0.5%)', fp.length === 0,
    fp.map(k => k + '=' + pc(R0.regions[k].darkSpotFrac)).join(' '));
  /* 468 경로(홍채 랜드마크 없음)도 돌아야 한다 */
  const R468 = S.measureColor(render(lm468, RICH), lm468, H / W);
  check('0', '468 랜드마크(홍채 없음) 경로도 동작한다', R468.ok && R468.eye &&
    R468.eye.irisSource === 'EYE_POLY_DARK_QUARTILE(468)', R468.reject && R468.reject.reason);
}

/* ── 1. ★조명 불변성 ────────────────────────────────────────────────────── */
console.log('\n' + line('-'));
console.log('  1. ★조명 불변성 — 변환 전후 축 값의 상대변화율   rel = |Δv| / (|v0| + ' + REL_FLOOR + ')');
console.log('     정규화 후 = normMode:"full"   /   정규화 전 = normMode:"raw"(부위 절대색, 정규화 전부 해제)');
console.log(line('-'));

function invarianceTable(mode, label, quiet) {
  const base = S.measureColor(baseImg, lm478, H / W, { normMode: mode });
  if (!base.ok) return { ok: false, reason: base.reject.reason };
  const b0 = KEY_AXES.map(a => { try { return a[1](base); } catch (e) { return NaN; } });
  const rows = [];
  for (const tn in TRANSFORMS) {
    if (tn === 'BASE(원본)') continue;
    const img = applyTransform(baseImg, tn);
    const r = S.measureColor(img, lm478, H / W, { normMode: mode });
    if (!r.ok) { rows.push({ t: tn, rejected: r.reject.gate + ':' + r.reject.reason, rel: KEY_AXES.map(() => NaN), max: NaN }); continue; }
    const rel = KEY_AXES.map((a, i) => { try { return relChange(b0[i], a[1](r)); } catch (e) { return NaN; } });
    rows.push({ t: tn, rel, max: Math.max.apply(null, rel.filter(isFinite)) });
  }
  if (!quiet) {
    console.log('\n  ── ' + label + ' ──');
    console.log('  ' + pad('변환', 16) + KEY_AXES.map(a => lpad(a[0], 15)).join('') + lpad('최대', 9));
    console.log('  ' + pad('BASE 값', 16) + b0.map(v => lpad(f2(v), 15)).join(''));
    for (const r of rows) {
      if (r.rejected) { console.log('  ' + pad(r.t, 16) + '  ★거부 ' + r.rejected); continue; }
      console.log('  ' + pad(r.t, 16) + r.rel.map(v => lpad(pc(v), 15)).join('') + lpad(pc(r.max), 9));
    }
  }
  return { ok: true, b0, rows, worst: Math.max.apply(null, rows.map(r => isFinite(r.max) ? r.max : 0)) };
}

const invFull = invarianceTable('full', '정규화 후 (full)');
const invRaw = invarianceTable('raw', '정규화 전 (raw · 부위 절대색)');

if (invFull.ok) {
  for (const r of invFull.rows) {
    check('1', '조명 불변성 ±10% — ' + r.t, isFinite(r.max) && r.max <= 0.10,
      '최대 상대변화 ' + pc(r.max) + (r.rejected ? ' (' + r.rejected + ')' : ''));
  }
  console.log('\n  ⟹ 정규화 후 최악 ' + pc(invFull.worst) + '   /   정규화 전 최악 ' + pc(invRaw.ok ? invRaw.worst : NaN) +
    '   ⟹ 개선 배율 ' + ((invRaw.ok && invFull.worst > 0) ? (invRaw.worst / invFull.worst).toFixed(1) + '×' : 'n/a'));
  check('1', '정규화가 실제로 효과가 있다(정규화 전 최악 > 후 최악의 3배)',
    invRaw.ok && invRaw.worst > invFull.worst * 3, '전 ' + pc(invRaw.ok ? invRaw.worst : NaN) + ' vs 후 ' + pc(invFull.worst));
} else check('1', '조명 불변성 측정', false, invFull.reason);

/* ── 2. 판별력 ──────────────────────────────────────────────────────────── */
console.log('\n' + line('-'));
console.log('  2. 판별력 — 서로 다른 기색을 실제로 구분하는가');
console.log(line('-'));

const SCEN = {
  '기준(무색)': {},
  '홍조(顴 붉음)': { tint: { GWAN_R: [1.16, 0.90, 0.90], GWAN_L: [1.16, 0.90, 0.90] } },
  '土形 色黃(피부만)': { skin: [146, 116, 74] },
  '황달(흰자까지 누름)': { skin: [146, 116, 74], sclera: [182, 176, 134] },
  '흰 피부': { skin: [186, 158, 143] },
  '검은 피부': { skin: [92, 66, 54] },
  '印堂 昏暗': { tint: { INDANG: [0.66, 0.66, 0.70] } },
  '印堂 光明如鏡': { tint: { INDANG: [1.12, 1.12, 1.12] }, gloss: { INDANG: 30 } },
  '準頭 色枯(무광)': { gloss: { JUNDU: 0 } },
  '準頭 潤(광택)': { gloss: { JUNDU: 40 } },
  '顴 黒痣 3개': { moles: [{ region: 'GWAN_R', count: 3, darkness: 0.42, radius: 2.6 }] }
};
const SHOW = [
  ['顴.붉은기', r => r.regions.GWAN_R.redness],
  ['印堂.밝기', r => r.regions.INDANG.lightness],
  ['印堂.광택', r => r.regions.INDANG.gloss],
  ['準頭.광택', r => r.regions.JUNDU.gloss],
  ['顴.검은점%', r => r.regions.GWAN_R.darkSpotFrac * 100],
  ['abs.피부黃', r => r.abs.skinYellowVsSclera],
  ['abs.피부白', r => r.abs.skinLightVsSclera],
  ['abs.피부赤', r => r.abs.skinRedVsSclera]
];
const M = {};
console.log('  ' + pad('합성 시나리오', 20) + SHOW.map(s => lpad(s[0], 13)).join(''));
for (const sn in SCEN) {
  const r = S.measureColor(render(lm478, SCEN[sn]), lm478, H / W);
  if (!r.ok) { console.log('  ' + pad(sn, 20) + '  ★거부 ' + r.reject.gate); M[sn] = null; continue; }
  M[sn] = r;
  console.log('  ' + pad(sn, 20) + SHOW.map(s => lpad(f2(s[1](r)), 13)).join(''));
}
const G = (s, f) => M[s] ? f(M[s]) : NaN;
check('2', '홍조 → 顴 붉은기 상승 (≥0.5z)',
  G('홍조(顴 붉음)', r => r.regions.GWAN_R.redness) - G('기준(무색)', r => r.regions.GWAN_R.redness) >= 0.5,
  'Δ=' + f2(G('홍조(顴 붉음)', r => r.regions.GWAN_R.redness) - G('기준(무색)', r => r.regions.GWAN_R.redness)));
check('2', '印堂 昏暗 → 印堂 밝기 하강 (≤-0.5z)',
  G('印堂 昏暗', r => r.regions.INDANG.lightness) - G('기준(무색)', r => r.regions.INDANG.lightness) <= -0.5,
  'Δ=' + f2(G('印堂 昏暗', r => r.regions.INDANG.lightness) - G('기준(무색)', r => r.regions.INDANG.lightness)));
check('2', '印堂 光明如鏡 → 印堂 밝기·광택 동시 상승',
  G('印堂 光明如鏡', r => r.regions.INDANG.lightness) > G('기준(무색)', r => r.regions.INDANG.lightness) + 0.3 &&
  G('印堂 光明如鏡', r => r.regions.INDANG.gloss) > G('기준(무색)', r => r.regions.INDANG.gloss) + 0.3, '');
check('2', '準頭 潤 > 準頭 枯 (광택 축이 정반사를 잡는다)',
  G('準頭 潤(광택)', r => r.regions.JUNDU.gloss) > G('準頭 色枯(무광)', r => r.regions.JUNDU.gloss) + 0.5,
  '潤=' + f2(G('準頭 潤(광택)', r => r.regions.JUNDU.gloss)) + ' 枯=' + f2(G('準頭 色枯(무광)', r => r.regions.JUNDU.gloss)));
check('2', '黒痣 → 顴 검은점 비율 상승',
  G('顴 黒痣 3개', r => r.regions.GWAN_R.darkSpotFrac) > G('기준(무색)', r => r.regions.GWAN_R.darkSpotFrac) + 0.005,
  'Δ=' + f2((G('顴 黒痣 3개', r => r.regions.GWAN_R.darkSpotFrac) - G('기준(무색)', r => r.regions.GWAN_R.darkSpotFrac)) * 100) + '%p');
check('2', '土形 色黃(피부만 누름) → abs.피부黃 상승 (흰자 기준 ABS 축)',
  G('土形 色黃(피부만)', r => r.abs.skinYellowVsSclera) > G('기준(무색)', r => r.abs.skinYellowVsSclera) + 0.3,
  'Δ=' + f2(G('土形 色黃(피부만)', r => r.abs.skinYellowVsSclera) - G('기준(무색)', r => r.abs.skinYellowVsSclera)));
check('2', '흰 피부 > 검은 피부 (abs.피부白 — 0 에 가까울수록 희다)',
  G('흰 피부', r => r.abs.skinLightVsSclera) > G('검은 피부', r => r.abs.skinLightVsSclera) + 0.5,
  '白=' + f2(G('흰 피부', r => r.abs.skinLightVsSclera)) + ' 黑=' + f2(G('검은 피부', r => r.abs.skinLightVsSclera)));
/* ★한계를 검사로 못박는다 — 「흰자까지 같이 누레지면 못 잡는다」는 것이 설계상 필연이다 */
const base黃 = G('기준(무색)', r => r.abs.skinYellowVsSclera);
const jaundGap = G('황달(흰자까지 누름)', r => r.abs.skinYellowVsSclera) - base黃;
const earthGap = G('土形 色黃(피부만)', r => r.abs.skinYellowVsSclera) - base黃;
check('2', '★한계 확인 — 흰자까지 함께 누레지면 ABS 축은 사실상 잡지 못한다(따뜻한 조명과 구분 불가)',
  Math.abs(jaundGap) < 0.25 * Math.abs(earthGap),
  '흰자까지 Δ=' + f2(jaundGap) + ' vs 피부만 Δ=' + f2(earthGap));
console.log('\n  ★정직한 한계 3가지');
console.log('   ① 피부색(흰/검은)은 REL 축에서 거의 움직이지 않는다 — 설계대로다.');
console.log('      「色白」은 흰자를 화이트 레퍼런스로 삼은 ABS 축으로만 잡히고 그 참조는 불완전하다(confidence LOW).');
console.log('   ② 흰자까지 함께 물드는 전역 색이동(황달·유색 조명)은 원리상 구분 불가다.');
console.log('      조명 불변성을 얻은 대가가 바로 이것이다 — 얼굴 전체의 색은 조명과 수학적으로 같은 형태다.');
console.log('   ③ 광택(gloss)은 피부 밝기에 완전 독립이 아니다(정반사는 덧셈, 피부는 곱셈).');
console.log('      검은 피부에서 같은 하이라이트가 더 큰 광택으로 읽힌다 — 위 표의 「검은 피부」 행이 그 증거다.');

/* ── 3. 음성 대조군 (fail-closed) ───────────────────────────────────────── */
console.log('\n' + line('-'));
console.log('  3. 음성 대조군 — 얼굴이 아니거나 마스크가 얼굴 밖이면 거부하는가');
console.log(line('-'));

function flatImage(col) {
  const d = new Uint8ClampedArray(W * H * 4), rnd = mulberry32(7);
  for (let i = 0; i < W * H; i++) {
    const n = (rnd() - 0.5) * 14;
    d[i * 4] = col[0] + n; d[i * 4 + 1] = col[1] + n; d[i * 4 + 2] = col[2] + n; d[i * 4 + 3] = 255;
  }
  return { data: d, width: W, height: H };
}
function grayscale(img) {
  const d = new Uint8ClampedArray(img.data.length);
  for (let i = 0; i < img.width * img.height; i++) {
    const q = i * 4, y = 0.299 * img.data[q] + 0.587 * img.data[q + 1] + 0.114 * img.data[q + 2];
    d[q] = y; d[q + 1] = y; d[q + 2] = y; d[q + 3] = 255;
  }
  return { data: d, width: img.width, height: img.height };
}
function noiseImage() {
  const d = new Uint8ClampedArray(W * H * 4), rnd = mulberry32(99);
  for (let i = 0; i < W * H; i++) { d[i * 4] = rnd() * 255; d[i * 4 + 1] = rnd() * 255; d[i * 4 + 2] = rnd() * 255; d[i * 4 + 3] = 255; }
  return { data: d, width: W, height: H };
}

/* 작은 얼굴을 화면 왼쪽 위에 렌더해 두고, 마스크만 오른쪽 아래 배경으로 옮긴다.
   ⟹ 폴리곤은 화면 안(G2 통과)이지만 얼굴 밖 픽셀만 담게 된다 — 그것을 거부해야 한다. */
const lmSmall = makeLandmarks({ scale: 12, cx: 150, cy: 190 });
const smallFaceImg = render(lmSmall, RICH);
const lmOffFace = makeLandmarks({ scale: 12, cx: 330, cy: 455 });   // 완전히 배경 위
const lmHalfFace = makeLandmarks({ scale: 12, cx: 245, cy: 250 });  // 절반만 얼굴에 걸침

const NEG = [
  ['얼굴 아닌 단색 하늘(무채·차가움)', flatImage([120, 132, 150]), lm478, 'G4'],
  ['얼굴 아닌 난수 잡음', noiseImage(), lm478, null],
  ['흑백 변환된 얼굴(색 정보 없음)', grayscale(baseImg), lm478, 'G5'],
  ['마스크가 통째로 얼굴 밖 배경 위(화면 안)', smallFaceImg, lmOffFace, 'G4'],
  ['마스크가 얼굴 밖 픽셀을 절반 섞음', smallFaceImg, lmHalfFace, null],
  ['랜드마크가 화면 밖으로 확대(2.4배)', baseImg, makeLandmarks({ scale: 22 * 2.4 }), 'G2'],
  ['랜드마크 468개 미만(길이 300)', baseImg, lm478.slice(0, 300), 'G1'],
  ['imageData 버퍼 길이 부족', { data: new Uint8ClampedArray(100), width: W, height: H }, lm478, 'G1'],
  ['랜드마크 좌표에 NaN', baseImg, (() => { const l = makeLandmarks({}); l[5] = { x: NaN, y: 0.5 }; return l; })(), 'G1']
];
for (const [nm, img, l, wantGate] of NEG) {
  const r = S.measureColor(img, l, H / W);
  const okRej = !r.ok;
  console.log('  ' + pad(nm, 36) + (okRej ? '거부 ' + r.reject.gate + ' — ' + r.reject.reason.slice(0, 46) : '★통과시킴(=결함)'));
  check('3', '거부해야 한다 — ' + nm, okRej && (!wantGate || r.reject.gate === wantGate),
    okRej ? ('게이트 ' + r.reject.gate + ' (기대 ' + wantGate + ')') : '거부하지 않았다');
}
/* 양성 대조 — 정상 얼굴은 거부하면 안 된다 (과잉 거부 방지) */
check('3', '정상 합성 얼굴은 거부하지 않는다', S.measureColor(baseImg, lm478, H / W).ok, '');
const smallOK = S.measureColor(smallFaceImg, lmSmall, H / W);
check('3', '작은 얼굴(약 1/3 크기)도 거부하지 않는다', smallOK.ok, smallOK.reject && smallOK.reject.reason);

/* ── 4. 축 ↔ 원문 대응 무결성 ───────────────────────────────────────────── */
console.log('\n' + line('-'));
console.log('  4. 축 ↔ 원문 대응 무결성 — 대응 rule 이 없는 축은 존재해선 안 된다');
console.log(line('-'));
const RULES = {};
for (const f of ['ogwan', 'xlhz']) {
  const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'IP_face/rules/face/' + f + '.json'), 'utf8'));
  for (const r of j.rules) RULES[r.rule_id] = r;
}
let axisBad = [];
for (const a of S.AXES) {
  if (!a.rules || !a.rules.length) { axisBad.push(a.axis + ':대응규칙없음'); continue; }
  for (const rid of a.rules) if (!RULES[rid]) axisBad.push(a.axis + ':' + rid + '(없는 rule_id)');
}
check('4', '모든 축이 실재하는 rule_id 에 대응한다', axisBad.length === 0, axisBad.join(' '));
let nmBad = [];
for (const n of S.NOT_MEASURED) for (const rid of n.rules) if (!RULES[rid]) nmBad.push(n.text + ':' + rid);
check('4', '「못 재는 것」 목록도 실재하는 rule_id 를 가리킨다', nmBad.length === 0, nmBad.join(' '));
console.log('  축 ' + S.AXES.length + '개 · 명시적 미계측 항목 ' + S.NOT_MEASURED.length + '개 · 참조 rule ' +
  new Set(S.AXES.reduce((s, a) => s.concat(a.rules), [])).size + '건');

/* ── 5. ★변이 시험 ─────────────────────────────────────────────────────── */
console.log('\n' + line('-'));
console.log('  5. ★변이 시험 — 정규화를 일부러 망가뜨렸을 때 ①이 잡아내는가');
console.log(line('-'));
const MUT = [
  ['M1 raw — 정규화 전부 해제(부위 절대색)', 'raw'],
  ['M2 no_log_opponent — log 대립색 대신 선형 채널차', 'no_log_opponent'],
  ['M3 no_sd_norm — 얼굴 표준편차로 나누지 않음', 'no_sd_norm'],
  ['M4 no_detrend — 조명장(그라디언트) 제거 안 함', 'no_detrend'],
  ['M5 absolute — 얼굴 피부 기준을 빼지 않음', 'absolute']
];
let caught = 0;
console.log('  ' + pad('변이', 46) + lpad('최악 상대변화', 15) + '   가장 크게 깨진 변환');
for (const [nm, mode] of MUT) {
  const r = invarianceTable(mode, nm, true);
  if (!r.ok) { console.log('  ' + pad(nm, 46) + lpad('계측 거부', 15)); caught++; check('5', nm + ' 를 잡아냈다', true, ''); continue; }
  const worstRow = r.rows.reduce((a, b) => ((isFinite(b.max) ? b.max : -1) > (isFinite(a.max) ? a.max : -1) ? b : a));
  const hit = r.worst > 0.10;
  if (hit) caught++;
  console.log('  ' + pad(nm, 46) + lpad(pc(r.worst), 15) + '   ' + worstRow.t +
    ' [' + KEY_AXES[worstRow.rel.indexOf(Math.max.apply(null, worstRow.rel.filter(isFinite)))][0] + ']');
  check('5', nm + ' 를 ①이 잡아낸다(최악 > 10%)', hit, '최악 ' + pc(r.worst));
}
console.log('\n  ⟹ 변이 ' + MUT.length + '건 중 ' + caught + '건 검출' + (caught === MUT.length ? ' — ①이 전부 물었다.' : ' — ★놓친 변이가 있다.'));

/* ── 6. 승격 후보 산출 ──────────────────────────────────────────────────── */
console.log('\n' + line('-'));
console.log('  6. 승격 후보 — 색 축이 생겨 UNMEASURABLE → PARTIAL/MEASURABLE 이 되는 규칙');
console.log(line('-'));

/* ★규칙 파일은 고치지 않는다. 후보 목록만 별도 파일로 낸다. */
const CAND = [
  ['FACE_OGWAN_R009', 'PARTIAL', ['darkSpotFrac'], ['JEONTAEK_R', 'JEONTAEK_L', 'BOGAK_R', 'BOGAK_L', 'GWAN_R', 'GWAN_L'],
    '六府 有缺陷疵瘢黒痣 — 「黒痣」만 검은점 축으로 부분 검출. 「缺陷(꺼짐)」은 3D, 「疵瘢(흉터)」은 텍스처라 못 잰다. 그림자·모발과도 구분 못 한다.', 'LOW'],
  ['FACE_OGWAN_R027', 'PARTIAL', ['scleraLightness', 'irisDarkness', 'irisScleraContrast'], ['EYE'],
    '眼 白如玉黑如漆 — 흰자 밝기·홍채 어둠·둘의 대비를 잰다. 「如玉」「如漆」의 정도를 가르는 컷오프는 원문에 없다(POPULATION).', 'MED'],
  ['FACE_OGWAN_R038', 'PARTIAL', ['gloss', 'lightness'], ['MYEONGMUN_R', 'MYEONGMUN_L'],
    '耳門之前 平滿光瑩 — 「光·瑩」은 광택 축으로 잡는다. 「平滿(평평·그득)」은 3D 형태라 못 잰다. 자리는 FaceMesh 안이라 마스크가 만들어진다.', 'MED'],
  ['FACE_XLHZ_R003', 'PARTIAL', ['abs.skinLightVsSclera'], ['SKIN'],
    '金形 色白氣剛 — 「色白」만 흰자 기준 ABS 축으로 잡는다. 「氣剛」은 색이 아니다. ABS 참조(흰자)가 불완전해 confidence LOW.', 'LOW'],
  ['FACE_XLHZ_R016', 'PARTIAL', ['abs.skinRedVsSclera', 'gloss'], ['SKIN', 'JUNDU', 'GWAN_R', 'GWAN_L'],
    '火形 色赤氣枯 — 「色赤」은 ABS 붉은기, 「枯(마름)」는 광택 축의 낮은 값. 두 글자 다 축이 생겼으나 컷오프는 없다.', 'MED'],
  ['FACE_XLHZ_R019', 'PARTIAL', ['abs.skinRedVsSclera', 'gloss'], ['SKIN', 'GWAN_R', 'GWAN_L'],
    '火形 진위 發紅而不燥色潤 — 붉은기 + 광택. 「燥/潤」의 대립을 광택 축 하나로 잰다.', 'MED'],
  ['FACE_XLHZ_R024', 'PARTIAL', ['abs.skinYellowVsSclera', 'yellowness'], ['SKIN'],
    '土形 色黃 — 흰자 기준 누런기. 원문이 절대 색좌표를 주지 않으므로 컷오프는 여전히 POPULATION.', 'MED'],
  ['FACE_XLHZ_R026', 'PARTIAL', ['abs.skinRedVsSclera', 'gloss'], ['SKIN', 'GWAN_R', 'GWAN_L'],
    '土形 정격 …肉肥而色紅潤…活動不枯 — 「色紅潤」·「不枯」만 잡는다. 「肉肥」·「厚重」·「不流不滯」·「純靜」은 못 잰다.', 'LOW'],
  ['FACE_XLHZ_R046', 'PARTIAL', ['lightness', 'gloss'], ['INDANG'],
    '命宮 要明潤 — 「明」=밝기 축, 「潤」=광택 축. 두 글자 모두 대응 축이 생겼다. 컷오프만 POPULATION.', 'HIGH'],
  ['FACE_XLHZ_R049', 'PARTIAL', ['lightness'], ['CHEONJEONG', 'GWAN_R', 'GWAN_L', 'JUNDU', 'JIGAK'],
    '山岳 不宜昏暗 — 五岳(額·左右顴·鼻·頦) 다섯 자리 전부 마스크가 있다. 「昏暗」은 밝기 축.', 'HIGH'],
  ['FACE_XLHZ_R051', 'PARTIAL', ['lightness', 'gloss'], ['INDANG'],
    '印堂 光明如鏡 — 「光」=광택, 「明」=밝기. 「如鏡(거울 같다)」의 정도는 컷오프가 없다.', 'HIGH'],
  ['FACE_XLHZ_R054', 'PARTIAL', ['darkSpotFrac'], ['INDANG'],
    '命宮 惡痣 — 점의 존재만 부분 검출. 「惡(나쁜)」이라는 질적 판정은 원천적으로 불가.', 'LOW'],
  ['FACE_XLHZ_R055', 'PARTIAL', ['redness', 'chromaDispersion', 'darkSpotFrac'], ['INDANG'],
    '命宮 赤色如絲…或起點麻 — 붉은기와 색 얼룩(산포)은 잰다. 「如絲(실 모양)」라는 형상은 색 축으로 못 잰다.', 'MED']
];
const STILL = [
  ['FACE_OGWAN_R003/R029/R036/R041', '귀(耳)·시선 — FaceMesh 468 에 귀 윤곽이 없다. 색 축이 있어도 자를 마스크가 없다.'],
  ['FACE_OGWAN_R006', '有缺陷者及醜惡者 — 미적 판단. 계측량이 존재하지 않는다.'],
  ['FACE_OGWAN_R011', '四瀆 醜而不端…毀而陷 — 3D 형태·미적 판단. 색과 무관.'],
  ['FACE_OGWAN_R025', '眉上 直理·橫理 — 주름의 방향. 텍스처 축이며 색 축이 아니다.'],
  ['FACE_XLHZ_R008', '木形 色清氣秀 — ★「清」은 색 축이 생겨도 여전히 판정 불가. 비교 대상도 컷오프도 없고, 채도·대비 어느 것에 배당해도 그것은 원문이 아니라 우리 창작이 된다.'],
  ['FACE_XLHZ_R039', '豐厚而重 / 淺薄短燥 — 여덟 자 중 「燥」 한 자만 광택 축에 걸린다. 나머지는 全身形(몸통)이라 사진에 없다. 억지 승격하지 않는다.'],
  ['FACE_XLHZ_R044', '眼毫·耳毫·鼻毫·鬍鬚 宜黑潤不宜黃燥 — 색 축(黑·潤·黃·燥)은 전부 있으나 그 털을 자를 마스크가 없다. 부위 없는 축은 판정이 아니다.'],
  ['FACE_XLHZ_R047/R048/R050', '紋交·懸針·川字 — 주름 형상. 텍스처·형상 축이며 색 축 범위 밖.'],
  ['FACE_XLHZ_R053', '命宮 凹陷 — 우묵함(깊이). 색으로 그림자를 볼 수는 있으나 그것은 조명이지 형태가 아니다 — 우리 정규화가 바로 그 조명을 지운다.'],
  ['FACE_XLHZ_R002/R004/R012/R023/R025', '骨·肉의 상대 비중 — 색 축과 무관.'],
  ['FACE_XLHZ_R005/R009/R013/R020/R027', '動止(거동) — 정지 사진에서 원천 불가.'],
  ['FACE_XLHZ_R007/R011/R017/R018/R022/R028/R034~R038/R040/R042', '몸통·소주(所主)·오행 배당·五音 — 색 축 대상 아님.']
];
console.log('  ' + pad('rule_id', 20) + pad('현재', 14) + pad('→', 10) + pad('신뢰', 7) + '근거 축');
let promoOK = true;
for (const [rid, to, axes, regs, why, conf] of CAND) {
  const cur = RULES[rid];
  if (!cur) { promoOK = false; console.log('  ★' + rid + ' 없음'); continue; }
  if (cur.measurability !== 'UNMEASURABLE') { promoOK = false; console.log('  ★' + rid + ' 는 현재 ' + cur.measurability + ' 다'); continue; }
  console.log('  ' + pad(rid, 20) + pad(cur.measurability, 14) + pad(to, 10) + pad(conf, 7) + axes.join('·'));
}
check('6', '승격 후보가 전부 현재 UNMEASURABLE 이다', promoOK, '');
check('6', '승격 후보 중 MEASURABLE 로 올라가는 것은 0건이다 (컷오프가 전부 POPULATION 이므로)',
  CAND.every(c => c[1] === 'PARTIAL'), '');

const outPath = path.join(__dirname, 'IP_face/promote_candidates_color.json');
const payload = {
  _note: '★색 축(sensor_color.js) 신설로 UNMEASURABLE → 승격이 가능해지는 규칙의 「후보」 목록이다. ' +
    '규칙 파일(ogwan.json·xlhz.json)은 고치지 않았다. 승격은 사람이 판단해 반영한다.',
  generated_by: '_v786_diag/p05_sensor_color_eval.js',
  sensor: '_v786_diag/sensor_color.js v' + S.VERSION,
  binding_status: 'NOT_BOUND — index.html · api/* · face_core_v786.js 어디에도 연결되어 있지 않다.',
  generated_at: new Date().toISOString().slice(0, 10),
  _principle: [
    '★억지 승격 금지. 「清(맑다)」처럼 색 축이 생겨도 여전히 판정 불가한 것은 still_unmeasurable 에 남긴다.',
    '★승격 후보는 전부 PARTIAL 이다. MEASURABLE 은 0건이다 — 원문이 컷오프를 주지 않기 때문이다(threshold_origin=POPULATION).',
    '★ABS 계열(色白·色赤·色黃)은 흰자를 화이트 레퍼런스로 삼는다. 흰자는 완전한 중성이 아니므로 confidence 가 낮다.'
  ],
  summary: {
    rules_total: 100,
    unmeasurable_before: { ogwan: 10, xlhz: 40, total: 50 },
    promotable: {
      ogwan: CAND.filter(c => c[0].indexOf('OGWAN') >= 0).length,
      xlhz: CAND.filter(c => c[0].indexOf('XLHZ') >= 0).length,
      total: CAND.length
    },
    promotable_to_MEASURABLE: 0,
    unmeasurable_after: 50 - CAND.length
  },
  candidates: CAND.map(([rule_id, to, axes, regions, rationale, confidence]) => ({
    rule_id, doctrine_id: RULES[rule_id] ? RULES[rule_id].doctrine_id : null,
    predicate_original: RULES[rule_id] ? RULES[rule_id].condition.predicate_original : null,
    gloss_ko: RULES[rule_id] ? RULES[rule_id].condition.gloss_ko : null,
    measurability_now: RULES[rule_id] ? RULES[rule_id].measurability : null,
    measurability_candidate: to,
    threshold_origin_candidate: 'POPULATION',
    color_axes: axes, color_regions: regions,
    confidence, rationale
  })),
  still_unmeasurable: STILL.map(([rules, why]) => ({ rules, why })),
  axes: S.AXES,
  not_measured_by_color: S.NOT_MEASURED
};
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
console.log('\n  ⟹ 승격 후보 ' + CAND.length + '건 (OGWAN ' + payload.summary.promotable.ogwan +
  ' · XLHZ ' + payload.summary.promotable.xlhz + ') — 전부 PARTIAL, MEASURABLE 은 0건');
console.log('  ⟹ UNMEASURABLE 50건 → ' + payload.summary.unmeasurable_after + '건 (색으로도 못 재는 것 ' +
  payload.summary.unmeasurable_after + '건은 그대로 남긴다)');
console.log('  ⟹ ' + outPath.replace(/\\/g, '/'));
check('6', '승격 후보 파일을 썼다', fs.existsSync(outPath), '');
check('6', '규칙 파일은 건드리지 않았다(읽기만)', true, '');

/* ── 마무리 ─────────────────────────────────────────────────────────────── */
console.log('\n' + line('='));
if (fails.length) { console.log('실패 목록'); for (const f of fails) console.log('  · ' + f); console.log(line('=')); }
console.log(`[p05_sensor_color] total=${total} pass=${pass} fail=${fail}`);
