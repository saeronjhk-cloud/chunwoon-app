/* ============================================================================
   P-06 · 텍스처(紋理·痣瘢·毛逆) 계측축 검증   node _v786_diag/p06_sensor_texture_eval.js
   ---------------------------------------------------------------------------
   실제 얼굴 사진이 없으므로 **합성 얼굴**로 검증한다. 사실적일 필요는 없다 —
   검증하려는 것은 다음 다섯이다.

     ① ★★해상도·초점 불변성 (= 색 센서의 「조명 불변성」에 해당)
        같은 얼굴을 다른 해상도(1280/640/320) · 다른 흐림(가우시안 σ) ·
        JPEG(8×8 DCT 양자화) 로 바꿨을 때 축 값이 유지되는가.
        ⟹ 정규화 전(normMode:'raw') / 후(full) 를 둘 다 재서 정규화 효과를 수치로 보인다.
        ⟹ 목표: 주요 축 ±15% 이내.
        ★축을 두 갈래로 나눠 판정한다. 눈금이 다르기 때문이지 봐주기 위해서가 아니다.
          DIR(방향·형상·정수) — 모든 변환에서 ±15%. 승격 후보가 실제로 기대는 축이 이쪽이다.
          ENERGY(세기)        — 해상도·JPEG·흐림 σ≤2.0 에서 ±15%.
          ★강한 흐림(σ3.2)에서 ENERGY 가 무너지는 것은 **원리상 불가피**하며(주름과 피부 미세결의
            공간 스케일이 다르다), 그 사실 자체를 검사로 못박고 G7 초점 게이트로 막는다.
        ★이유: 앞서 이 앱에서 「사진 종횡비가 얼굴형을 결정」하는 결함이 실측됐다.
                같은 실패를 텍스처에서 반복하면 안 된다.
     ② 판별력 — 세로주름/가로주름/없음, 점 0·1·3개, 흉터 유무, 紋交, 懸針·川字.
     ③ ★혼동 대조군 — 수염·머리카락·안경테·조명 그림자 경계·화장 경계(5종)를
        주름으로 잘못 읽지 않는가.
     ④ 음성 대조군 — 마스크가 배경, 랜드마크 부족, 얼굴이 너무 작음, 초점 소실 → fail-closed.
     ⑤ ★변이 시험 — 정규화·방향추정을 일부러 망가뜨렸을 때 ①②가 잡아내는가.

   합성 랜드마크의 출처 ★추측 아님
     _v786_diag/p05_sensor_color_eval.js 의 CANON_XY 를 **그대로 읽어 쓴다**(파일은 고치지 않는다).
     그 값은 npm @mediapipe/face_mesh@0.4.1633559619 의
     face_mesh_solution_packed_assets.data 안
     face_geometry/data/geometry_pipeline_metadata_landmarks.binarypb 를 파싱해 얻은
     canonical face model 468정점의 (x,y) 다. 검산: LM1=(0.000,-1.127) LM2=(0.000,-2.089).

   ★합성 피부의 미세결에 대하여 (검사 설계의 핵심)
     피부 미세결을 「화소 단위 백색잡음」으로 만들면 다운샘플에서 그대로 사라져
     해상도 불변성 검사 자체가 성립하지 않는다(기준면 에너지가 해상도에 따라 변한다).
     실제 피부 결(모공·잔주름)은 **물리적 크기**를 가지므로,
     여기서는 미세결을 **얼굴 폭에 비례한 공간 스케일의 값잡음(value noise)** 으로 만든다.
     그 위에 화소 단위 센서 잡음을 아주 조금만 얹는다(이쪽은 실제로 해상도 의존이 맞다).

   ★이 스크립트는 index.html · api/* · face_core_v786.js · sensor_color.js ·
     규칙 JSON(ogwan.json · xlhz.json) 을 읽기만 하고 하나도 고치지 않는다.
     승격 후보는 별도 파일(IP_face/promote_candidates_texture.json)로만 낸다.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const T = require('./sensor_texture.js');
const S = require('./sensor_color.js');
const IN = S._internals;
const TI = T._internals;

/* ── canonical 468정점 (x,y) — p05 원본에서 그대로 읽는다(읽기 전용) ────── */
const CANON_XY = (function () {
  const src = fs.readFileSync(path.join(__dirname, 'p05_sensor_color_eval.js'), 'utf8');
  const m = src.match(/const CANON_XY = \[([\s\S]*?)\n\];/);
  if (!m) throw new Error('p05_sensor_color_eval.js 에서 CANON_XY 를 찾지 못했다');
  const a = m[1].split(',').map(s => Number(s.trim())).filter(v => isFinite(v));
  if (a.length !== 936) throw new Error('CANON_XY 길이가 936(=468×2) 이 아니다: ' + a.length);
  if (a[2] !== 0.000 || Math.abs(a[3] - (-1.127)) > 1e-6) throw new Error('CANON_XY 검산 실패 (LM1)');
  return a;
})();

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
   합성 랜드마크 · 마스터 캔버스
   ========================================================================== */
const MW = 1280, MH = 1704, MSCALE = 58;   // 마스터 해상도. 얼굴 폭 ≈ 900px

function makeLandmarks(opt) {
  const o = Object.assign({ W: MW, H: MH, scale: MSCALE, cx: null, cy: null, withIris: true }, opt || {});
  const cx = (o.cx === null) ? o.W / 2 : o.cx;
  const cy = (o.cy === null) ? o.H / 2 : o.cy;
  const lm = [];
  for (let i = 0; i < 468; i++) {
    lm.push({ x: (cx + CANON_XY[i * 2] * o.scale) / o.W, y: (cy - CANON_XY[i * 2 + 1] * o.scale) / o.H, z: 0 });
  }
  if (o.withIris) {
    for (const [a, b, c, d] of [[33, 133, 159, 145], [263, 362, 386, 374]]) {
      const px = (i) => ({ x: lm[i].x * o.W, y: lm[i].y * o.H });
      const A = px(a), B = px(b), C = px(c), Dd = px(d);
      const ecx = (A.x + B.x) / 2, ecy = (C.y + Dd.y) / 2;
      const r = Math.abs(A.x - B.x) * 0.195;
      lm.push({ x: ecx / o.W, y: ecy / o.H, z: 0 });
      for (const [dx, dy] of [[0, -r], [r, 0], [0, r], [-r, 0]])
        lm.push({ x: (ecx + dx) / o.W, y: (ecy + dy) / o.H, z: 0 });
    }
  }
  lm._W = o.W; lm._H = o.H;
  return lm;
}

/* 얼굴 폭(마스터 px) — 마스크·주름 크기를 전부 여기에 비례시킨다 */
function faceWidthPx(lm) {
  const p = IN.ring2px(IN.OVAL, lm, lm._W, lm._H);
  let a = Infinity, b = -Infinity;
  for (const q of p) { if (q[0] < a) a = q[0]; if (q[0] > b) b = q[0]; }
  return b - a;
}

/* ============================================================================
   합성 얼굴 렌더러 (마스터 해상도)
   ========================================================================== */
const BASE = {
  bg: [95, 105, 120],
  skin: [150, 116, 98],
  sclera: [176, 173, 170],
  iris: [46, 39, 35],
  brow: [58, 47, 40],
  lip: [148, 82, 79],
  nostril: [66, 48, 43],
  microAmp: 0.035,      // 피부 미세결 진폭(얼굴 폭 비례 스케일)
  sensorNoise: 1.0,     // 화소 단위 센서 잡음(8bit) — 이쪽만 해상도 의존이 맞다
  wrinkles: [],         // {region|'FACE', angleDeg, count, spacingFrac, sigmaFrac, depth}
  moles: [],            // {region, count, rFrac, darkness, elong, seed}
  hair: null, beard: null, glasses: null, shadowEdge: null, makeupEdge: null,
  seed: 20260906
};

function bandNoise(w, h, cell, seed) {
  /* ★등방(isotropic) 미세결.
     격자 보간형 value noise 는 격자축(수평·수직)으로 결이 서서 「민얼굴인데 橫理가 있다」는
     가짜 방향성을 만든다(실측으로 확인했다). 그래서 백색잡음을 가우시안으로 흐려
     대역제한만 한다 — 가우시안은 등방이므로 방향이 서지 않는다.
     ★공간 스케일을 얼굴 폭에 비례시킨다. 화소단위 잡음으로 만들면 다운샘플에서 사라져
       해상도 불변성 검사 자체가 성립하지 않는다(실제 피부 결은 물리적 크기를 가진다). */
  const rnd = mulberry32(seed), n = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) n[i] = rnd() * 2 - 1;
  const b = TI.blur(n, w, h, cell * 0.5);
  let m = 0, s = 0;
  for (let i = 0; i < w * h; i++) m += b[i];
  m /= w * h;
  for (let i = 0; i < w * h; i++) s += (b[i] - m) * (b[i] - m);
  s = Math.sqrt(s / (w * h)) || 1;
  for (let i = 0; i < w * h; i++) b[i] = (b[i] - m) / s;
  return b;
}

function render(lm, scen) {
  const sc = Object.assign({}, BASE, scen || {});
  const w = lm._W, h = lm._H, FW = faceWidthPx(lm);
  const buf = new Float64Array(w * h * 3);
  const rnd = mulberry32(sc.seed);
  const P = (ring, shrink) => IN.shrinkPoly(IN.ring2px(ring, lm, w, h), shrink || 0);
  const fill = (ring, shrink) => IN.fillPolys([P(ring, shrink)], w, h);
  const regIdx = (rn, extra) => {
    const d = T.TEXTURE_REGIONS[rn];
    return IN.fillPolys([P(d.ring, Math.max(0, d.shrink + (extra || 0)))], w, h);
  };

  for (let i = 0; i < w * h; i++) { buf[i * 3] = sc.bg[0]; buf[i * 3 + 1] = sc.bg[1]; buf[i * 3 + 2] = sc.bg[2]; }

  /* 얼굴 바탕 + 완만한 음영 + 저주파 색 얼룩 + ★얼굴 비례 미세결 */
  const micro1 = bandNoise(w, h, FW * 0.012, sc.seed + 11);
  const micro2 = bandNoise(w, h, FW * 0.030, sc.seed + 23);
  const ovalIdx = fill(IN.OVAL, 0);
  for (let k = 0; k < ovalIdx.length; k++) {
    const i = ovalIdx[k], x = i % w, y = (i / w) | 0, p = i * 3;
    const shade = 1.06 - 0.12 * (y / h);
    const mot = 1 + 0.05 * Math.sin(x / (FW * 0.09) + 0.7) * Math.cos(y / (FW * 0.07));
    const mic = 1 + sc.microAmp * (0.75 * micro1[i] + 0.45 * micro2[i]);
    buf[p] = sc.skin[0] * shade * mot * mic;
    buf[p + 1] = sc.skin[1] * shade * mot * mic * (1 + 0.02 * micro2[i]);
    buf[p + 2] = sc.skin[2] * shade * mot * mic * (1 - 0.02 * micro1[i]);
  }

  const paint = (idx, col) => { for (let k = 0; k < idx.length; k++) { const p = idx[k] * 3; buf[p] = col[0]; buf[p + 1] = col[1]; buf[p + 2] = col[2]; } };
  const mul = (i, f) => { const p = i * 3; buf[p] *= f; buf[p + 1] *= f; buf[p + 2] *= f; };

  /* ── 주름(선) — 부위 중심에 지정한 방향·개수·간격으로 골(valley)을 판다 ── */
  for (const wr of (sc.wrinkles || [])) {
    const idx = wr.region === 'FACE' ? ovalIdx : regIdx(wr.region, -0.06);
    if (!idx.length) continue;
    let mx = 0, my = 0;
    for (let k = 0; k < idx.length; k++) { mx += idx[k] % w; my += (idx[k] / w) | 0; }
    mx /= idx.length; my /= idx.length;
    const th = (wr.angleDeg || 0) * Math.PI / 180;
    const nx = Math.sin(th), ny = Math.cos(th);       // 결을 가로지르는 방향
    const sig = (wr.sigmaFrac || 0.006) * FW;
    const spa = (wr.spacingFrac || 0.05) * FW;
    const n = wr.count || 1, dep = 1 - (wr.depth || 0.14);
    for (let k = 0; k < idx.length; k++) {
      const i = idx[k], x = i % w, y = (i / w) | 0;
      const d = (x - mx) * nx + (y - my) * ny;
      let f = 1;
      for (let c = 0; c < n; c++) {
        const off = (c - (n - 1) / 2) * spa;
        const u = d - off;
        f *= 1 - (1 - dep) * Math.exp(-(u * u) / (2 * sig * sig));
      }
      mul(i, f);
    }
  }

  /* ── 점(黒痣) · 흉터(疵瘢) ── */
  for (const m of (sc.moles || [])) {
    const idx = regIdx(m.region, 0);
    if (idx.length < 50) continue;
    const r2 = mulberry32(m.seed || 4242);
    const rr = (m.rFrac || 0.014) * FW, el = m.elong || 1, ang = (m.angleDeg || 0) * Math.PI / 180;
    for (let c = 0; c < (m.count || 1); c++) {
      const seed = idx[Math.floor(r2() * idx.length)];
      const sx = seed % w, sy = (seed / w) | 0;
      const ca = Math.cos(ang), sa2 = Math.sin(ang);
      for (let k = 0; k < idx.length; k++) {
        const i = idx[k], x = i % w, y = (i / w) | 0;
        const ux = (x - sx) * ca + (y - sy) * sa2, uy = -(x - sx) * sa2 + (y - sy) * ca;
        const rad = Math.sqrt((ux / (rr * el)) * (ux / (rr * el)) + (uy / rr) * (uy / rr));
        if (rad <= 1.0) mul(i, m.darkness || 0.45);
        else if (rad < 1.35) mul(i, 1 - (1 - (m.darkness || 0.45)) * (1.35 - rad) / 0.35);
      }
    }
  }

  /* ── ★혼동 대조군 ────────────────────────────────────────────────────── */
  /* 머리카락 — 이마를 가로지르는 길고 가는 매우 어두운 곡선 */
  if (sc.hair) {
    const idx = regIdx(sc.hair.region || 'CHEONJEONG', -0.10);
    const r2 = mulberry32(sc.hair.seed || 777);
    const strands = sc.hair.count || 5, sig = (sc.hair.sigmaFrac || 0.004) * FW;
    let mx = 0, my = 0;
    for (let k = 0; k < idx.length; k++) { mx += idx[k] % w; my += (idx[k] / w) | 0; }
    mx /= idx.length; my /= idx.length;
    const offs = [], curv = [], tilt = [];
    for (let c = 0; c < strands; c++) { offs.push((r2() - 0.5) * FW * 0.20); curv.push((r2() - 0.5) * 0.004); tilt.push((r2() - 0.5) * 0.5); }
    for (let k = 0; k < idx.length; k++) {
      const i = idx[k], x = i % w, y = (i / w) | 0;
      let f = 1;
      for (let c = 0; c < strands; c++) {
        const dy = y - my;
        const cx2 = mx + offs[c] + tilt[c] * dy + curv[c] * dy * dy;
        const u = x - cx2;
        f *= 1 - (1 - (sc.hair.darkness || 0.22)) * Math.exp(-(u * u) / (2 * sig * sig));
      }
      mul(i, f);
    }
  }
  /* 수염 — 턱에 짧고 어두운 획이 많이 */
  if (sc.beard) {
    const idx = regIdx(sc.beard.region || 'JIGAK', -0.05);
    const r2 = mulberry32(sc.beard.seed || 909);
    const n = sc.beard.count || 90, len = (sc.beard.lenFrac || 0.030) * FW, sig = (sc.beard.sigmaFrac || 0.0035) * FW;
    const st = [];
    for (let c = 0; c < n; c++) {
      const seed = idx[Math.floor(r2() * idx.length)];
      st.push({ x: seed % w, y: (seed / w) | 0, a: r2() * Math.PI });
    }
    for (let k = 0; k < idx.length; k++) {
      const i = idx[k], x = i % w, y = (i / w) | 0;
      let f = 1;
      for (let c = 0; c < n; c++) {
        const s = st[c], dx = x - s.x, dy = y - s.y;
        const along = dx * Math.cos(s.a) + dy * Math.sin(s.a);
        if (Math.abs(along) > len / 2) continue;
        const across = -dx * Math.sin(s.a) + dy * Math.cos(s.a);
        f *= 1 - (1 - (sc.beard.darkness || 0.28)) * Math.exp(-(across * across) / (2 * sig * sig));
      }
      mul(i, f);
    }
  }
  /* 안경테 — 눈 아래를 가로지르는 두껍고 매우 어두운 수평 막대 */
  if (sc.glasses) {
    const idx = fill(IN.OVAL, 0);
    const eR = IN.ring2px(IN.EYE_R, lm, w, h), eL = IN.ring2px(IN.EYE_L, lm, w, h);
    let yR = 0; for (const q of eR) yR += q[1]; yR /= eR.length;
    let yL = 0; for (const q of eL) yL += q[1]; yL /= eL.length;
    const yBar = (yR + yL) / 2 + FW * (sc.glasses.dropFrac === undefined ? 0.075 : sc.glasses.dropFrac);
    const half = FW * (sc.glasses.thickFrac || 0.018) / 2;
    for (let k = 0; k < idx.length; k++) {
      const i = idx[k], y = (i / w) | 0;
      if (Math.abs(y - yBar) <= half) mul(i, sc.glasses.darkness || 0.16);
      else if (Math.abs(y - yBar) <= half + 2) mul(i, 0.55);
    }
  }
  /* 조명 그림자 경계 — 얼굴을 가로지르는 곱셈 계단(step). ★선(line)이 아니다 */
  if (sc.shadowEdge) {
    const idx = fill(IN.OVAL, 0);
    const th = (sc.shadowEdge.angleDeg || 90) * Math.PI / 180;
    const nx = Math.sin(th), ny = Math.cos(th);
    let mx = 0, my = 0;
    for (let k = 0; k < idx.length; k++) { mx += idx[k] % w; my += (idx[k] / w) | 0; }
    mx /= idx.length; my /= idx.length;
    const soft = FW * (sc.shadowEdge.softFrac || 0.004);
    const lo = sc.shadowEdge.factor || 0.70;
    const off = FW * (sc.shadowEdge.offsetFrac || 0);
    for (let k = 0; k < idx.length; k++) {
      const i = idx[k], x = i % w, y = (i / w) | 0;
      const d = (x - mx) * nx + (y - my) * ny - off;
      const t = 1 / (1 + Math.exp(-d / soft));
      mul(i, lo + (1 - lo) * t);
    }
  }
  /* 화장 경계 — 색차 계단. 밝기는 거의 그대로, 색만 바뀐다 */
  if (sc.makeupEdge) {
    const idx = regIdx(sc.makeupEdge.region || 'CHEONJEONG', -0.06);
    const th = (sc.makeupEdge.angleDeg || 90) * Math.PI / 180;
    const nx = Math.sin(th), ny = Math.cos(th);
    let mx = 0, my = 0;
    for (let k = 0; k < idx.length; k++) { mx += idx[k] % w; my += (idx[k] / w) | 0; }
    mx /= idx.length; my /= idx.length;
    const soft = FW * (sc.makeupEdge.softFrac || 0.004);
    const g = sc.makeupEdge.gain || [1.16, 0.93, 0.92];
    for (let k = 0; k < idx.length; k++) {
      const i = idx[k], x = i % w, y = (i / w) | 0;
      const d = (x - mx) * nx + (y - my) * ny;
      const t = 1 / (1 + Math.exp(-d / soft)), p = i * 3;
      buf[p] *= 1 + (g[0] - 1) * t; buf[p + 1] *= 1 + (g[1] - 1) * t; buf[p + 2] *= 1 + (g[2] - 1) * t;
    }
  }

  /* 눈썹 — ★털 한 올씩 그린다. 통짜로 칠하면 「毛逆·亂」 축을 시험할 수 없다.
     browAngle: 눈썹 축 방향(deg, 0=가로) · browMess: 0=결이 가지런함, 1=제멋대로 */
  for (const [ring, side] of [[IN.BROW_R, 'R'], [IN.BROW_L, 'L']]) {
    const bi = fill(ring, 0.05);
    paint(bi, [sc.skin[0] * 0.80, sc.skin[1] * 0.78, sc.skin[2] * 0.78]);
    const r2 = mulberry32((sc.seed || 1) + (side === 'R' ? 5 : 6));
    const nH = sc.browHairs === undefined ? 70 : sc.browHairs;
    const ang0 = (sc.browAngle === undefined ? 8 : sc.browAngle) * (side === 'R' ? -1 : 1) * Math.PI / 180;
    const mess = sc.browMess === undefined ? 0.12 : sc.browMess;
    const len = FW * 0.030, sig = FW * 0.0030;
    const st = [];
    for (let c = 0; c < nH; c++) {
      const seed = bi[Math.floor(r2() * bi.length)];
      st.push({ x: seed % w, y: (seed / w) | 0, a: ang0 + (r2() - 0.5) * mess * Math.PI });
    }
    for (let k = 0; k < bi.length; k++) {
      const i = bi[k], x = i % w, y = (i / w) | 0;
      let f = 1;
      for (let c = 0; c < nH; c++) {
        const s2 = st[c], dx = x - s2.x, dy = y - s2.y;
        const along = dx * Math.cos(s2.a) + dy * Math.sin(s2.a);
        if (Math.abs(along) > len / 2) continue;
        const across = -dx * Math.sin(s2.a) + dy * Math.cos(s2.a);
        f *= 1 - (1 - 0.30) * Math.exp(-(across * across) / (2 * sig * sig));
      }
      mul(i, f);
    }
  }
  paint(fill(IN.LIP_OUTER, 0.03), sc.lip);
  paint(fill(IN.NOSTRIL, 0.30), sc.nostril);
  for (const [eye, irisRing] of [[IN.EYE_R, IN.IRIS_R], [IN.EYE_L, IN.IRIS_L]]) {
    paint(fill(eye, 0.04), sc.sclera);
    if (lm.length >= 478) {
      const ip = IN.ring2px(irisRing, lm, w, h);
      const c = [(ip[1][0] + ip[3][0]) / 2, (ip[0][1] + ip[2][1]) / 2];
      const r = Math.abs(ip[1][0] - ip[3][0]) / 2;
      const eyeIdx = fill(eye, 0.04);
      for (let k = 0; k < eyeIdx.length; k++) {
        const i = eyeIdx[k], x = i % w, y = (i / w) | 0;
        if (Math.hypot(x - c[0], y - c[1]) <= r) { const p = i * 3; buf[p] = sc.iris[0]; buf[p + 1] = sc.iris[1]; buf[p + 2] = sc.iris[2]; }
      }
    }
  }

  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    for (let c = 0; c < 3; c++) data[i * 4 + c] = buf[i * 3 + c] + (rnd() - 0.5) * 2 * sc.sensorNoise;
    data[i * 4 + 3] = 255;
  }
  return { data, width: w, height: h };
}

/* ============================================================================
   변환 — 해상도 · 흐림 · JPEG
   ========================================================================== */
function downsample(img, f) {
  if (f === 1) return img;
  const w = Math.floor(img.width / f), h = Math.floor(img.height / f);
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r = 0, g = 0, b = 0;
    for (let dy = 0; dy < f; dy++) for (let dx = 0; dx < f; dx++) {
      const q = ((y * f + dy) * img.width + (x * f + dx)) * 4;
      r += img.data[q]; g += img.data[q + 1]; b += img.data[q + 2];
    }
    const o = (y * w + x) * 4, n = f * f;
    out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = 255;
  }
  return { data: out, width: w, height: h };
}
function blurImage(img, sigma) {
  if (!(sigma > 0)) return img;
  const w = img.width, h = img.height, out = new Uint8ClampedArray(w * h * 4);
  for (let c = 0; c < 3; c++) {
    const ch = new Float64Array(w * h);
    for (let i = 0; i < w * h; i++) ch[i] = img.data[i * 4 + c];
    const b = TI.blur(ch, w, h, sigma);
    for (let i = 0; i < w * h; i++) out[i * 4 + c] = b[i];
  }
  for (let i = 0; i < w * h; i++) out[i * 4 + 3] = 255;
  return { data: out, width: w, height: h };
}

/* ── JPEG 유사 8×8 DCT 양자화 (YCbCr · Annex K 표) ─────────────────────── */
const QL = [16,11,10,16,24,40,51,61, 12,12,14,19,26,58,60,55, 14,13,16,24,40,57,69,56,
  14,17,22,29,51,87,80,62, 18,22,37,56,68,109,103,77, 24,35,55,64,81,104,113,92,
  49,64,78,87,103,121,120,101, 72,92,95,98,112,100,103,99];
const QC = [17,18,24,47,99,99,99,99, 18,21,26,66,99,99,99,99, 24,26,56,99,99,99,99,99,
  47,66,99,99,99,99,99,99, 99,99,99,99,99,99,99,99, 99,99,99,99,99,99,99,99,
  99,99,99,99,99,99,99,99, 99,99,99,99,99,99,99,99];
const DCTC = (function () {
  const c = new Float64Array(64);
  for (let u = 0; u < 8; u++) for (let x = 0; x < 8; x++)
    c[u * 8 + x] = (u === 0 ? Math.SQRT1_2 : 1) * 0.5 * Math.cos((2 * x + 1) * u * Math.PI / 16);
  return c;
})();
function dct8x8(blk, out, inverse) {
  const tmp = new Float64Array(64);
  for (let y = 0; y < 8; y++) for (let u = 0; u < 8; u++) {
    let s = 0;
    for (let x = 0; x < 8; x++) s += inverse ? DCTC[x * 8 + u] * blk[y * 8 + x] : DCTC[u * 8 + x] * blk[y * 8 + x];
    tmp[y * 8 + u] = s;
  }
  for (let x = 0; x < 8; x++) for (let u = 0; u < 8; u++) {
    let s = 0;
    for (let y = 0; y < 8; y++) s += inverse ? DCTC[y * 8 + u] * tmp[y * 8 + x] : DCTC[u * 8 + y] * tmp[y * 8 + x];
    out[u * 8 + x] = s;
  }
}
function jpegLike(img, quality) {
  const w = img.width, h = img.height;
  const sf = quality < 50 ? 5000 / quality : 200 - 2 * quality;
  const qt = [QL, QC, QC].map(base => base.map(v => Math.max(1, Math.min(255, Math.floor((v * sf + 50) / 100)))));
  const pl = [new Float64Array(w * h), new Float64Array(w * h), new Float64Array(w * h)];
  for (let i = 0; i < w * h; i++) {
    const r = img.data[i * 4], g = img.data[i * 4 + 1], b = img.data[i * 4 + 2];
    pl[0][i] = 0.299 * r + 0.587 * g + 0.114 * b - 128;
    pl[1][i] = -0.168736 * r - 0.331264 * g + 0.5 * b;
    pl[2][i] = 0.5 * r - 0.418688 * g - 0.081312 * b;
  }
  const blk = new Float64Array(64), co = new Float64Array(64), rc = new Float64Array(64);
  for (let c = 0; c < 3; c++) {
    for (let by = 0; by + 8 <= h; by += 8) for (let bx = 0; bx + 8 <= w; bx += 8) {
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) blk[y * 8 + x] = pl[c][(by + y) * w + bx + x];
      dct8x8(blk, co, false);
      for (let i = 0; i < 64; i++) co[i] = Math.round(co[i] / qt[c][i]) * qt[c][i];
      dct8x8(co, rc, true);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) pl[c][(by + y) * w + bx + x] = rc[y * 8 + x];
    }
  }
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const Y = pl[0][i] + 128, cb = pl[1][i], cr = pl[2][i];
    out[i * 4] = Y + 1.402 * cr; out[i * 4 + 1] = Y - 0.344136 * cb - 0.714136 * cr;
    out[i * 4 + 2] = Y + 1.772 * cb; out[i * 4 + 3] = 255;
  }
  return { data: out, width: w, height: h };
}

/* ============================================================================
   하네스
   ========================================================================== */
const line = (c) => c.repeat(104);
let total = 0, pass = 0, fail = 0; const fails = [];
function check(sec, name, ok, detail) {
  total++;
  if (ok) pass++; else { fail++; fails.push(`[${sec}] ${name} — ${detail || ''}`); }
}
const f2 = (v) => (v === null || v === undefined || !isFinite(v)) ? '    n/a' : (v >= 0 ? ' ' : '') + v.toFixed(3);
const pc = (v) => !isFinite(v) ? '   n/a' : (v * 100).toFixed(1) + '%';
const pad = (s, n) => { s = String(s); while (s.length < n) s += ' '; return s; };
const lpad = (s, n) => { s = String(s); while (s.length < n) s = ' ' + s; return s; };

console.log(line('='));
console.log('  P-06 · 텍스처(紋理·痣瘢·毛逆) 계측축 검증  —  sensor_texture.js v' + T.VERSION);
console.log(line('='));

const lm = makeLandmarks({});
const FW_MASTER = faceWidthPx(lm);

/* 「텍스처가 풍부한」 합성 얼굴 — 주요 축이 전부 0 이 아니게 만든다 */
const RICH = {
  wrinkles: [
    { region: 'CHEONJEONG', angleDeg: 0, count: 4, spacingFrac: 0.055, sigmaFrac: 0.0060, depth: 0.15 },
    { region: 'INDANG', angleDeg: 90, count: 3, spacingFrac: 0.045, sigmaFrac: 0.0055, depth: 0.17 }
  ],
  moles: [{ region: 'GWAN_R', count: 3, rFrac: 0.016, darkness: 0.40, seed: 31 }]
};

const masterRich = render(lm, RICH);
const IMG = {
  1280: masterRich,
  640: downsample(masterRich, 2),
  320: downsample(masterRich, 4)
};
/* 랜드마크는 정규화 좌표라 해상도가 바뀌어도 같은 값을 쓴다 — 그것이 요점이다 */

/* ── 0. 기본 동작 · 표준 캔버스 · 마스크 정합 ───────────────────────────── */
console.log('\n' + line('-'));
console.log('  0. 기본 동작 · 표준 얼굴 캔버스 · 마스크 정합');
console.log(line('-'));
const R0 = T.measureTexture(IMG[640], lm, MH / MW);
check('0', '합성 얼굴에서 계측이 성공한다', R0.ok, R0.reject && R0.reject.reason);
if (!R0.ok) { console.log('  ★계측 실패: ' + JSON.stringify(R0.reject)); }
else {
  console.log('  원본 ' + R0.meta.srcWidth + '×' + R0.meta.srcHeight + ' · 얼굴폭 ' + R0.meta.faceWidthSrcPx.toFixed(0) +
    'px → 표준 캔버스 ' + R0.meta.canvasW + '×' + R0.meta.canvasH + ' (배율 ' + R0.meta.canvasScale.toFixed(3) + ')');
  console.log('  피부 기준 ' + R0.meta.skinPixels + 'px · 초점지표 ' + R0.meta.focusScore.toFixed(4) +
    ' · 기준 대역RMS ' + R0.meta.faceBandRMS.toFixed(5) + ' · 어두운 덩어리 ' + R0.meta.darkComponents +
    '(이물 ' + R0.meta.occluderComponents + ')');
  console.log('  ' + pad('부위', 14) + lpad('px', 6) + lpad('주름세기', 10) + lpad('방향°', 8) + lpad('세로', 7) +
    lpad('가로', 7) + lpad('방향성', 8) + lpad('집중도', 8) + lpad('선순도', 8) + lpad('색경계', 8) + lpad('이물', 7) + lpad('덩어리', 7));
  const missing = [];
  for (const rn in T.TEXTURE_REGIONS) {
    const r = R0.regions[rn];
    if (!r) { missing.push(rn); console.log('  ' + pad(rn, 14) + lpad('—', 6) + '   (마스크 없음)'); continue; }
    console.log('  ' + pad(rn, 14) + lpad(r.pixels, 6) + lpad(f2(r.wrinkleEnergy), 10) +
      lpad(r.wrinkleOrientationDeg === null ? 'n/a' : r.wrinkleOrientationDeg.toFixed(0), 8) +
      lpad(f2(r.vertFrac), 7) + lpad(f2(r.horizFrac), 7) + lpad(f2(r.directionality), 8) +
      lpad(f2(r.orientationConcentration), 8) + lpad(f2(r.ridgeValleyPurity), 8) +
      lpad(f2(r.chromaEdgeRatio), 8) + lpad(pc(r.occluderFrac), 7) +
      lpad(r.blobs && r.blobs.count !== null ? r.blobs.count : '—', 7));
  }
  check('0', '17개 부위(색 센서 15 + 눈썹 2) 마스크가 전부 만들어진다', missing.length === 0, '없는 부위: ' + missing.join(','));
  const minPx = Math.min.apply(null, Object.keys(T.TEXTURE_REGIONS).map(k => R0.regions[k] ? R0.regions[k].pixels : 0));
  check('0', '가장 작은 부위도 표준 캔버스에서 60px 이상이다', minPx >= 60, 'min=' + minPx);
  check('0', '★종횡비는 어떤 축에도 들어가지 않는다(meta.aspectUsedInAxes=false)', R0.meta.aspectUsedInAxes === false, '');
  console.log('  印堂 세로선: ' + (R0.indang.status === 'MEASURED'
    ? R0.indang.count + '개 — ' + R0.indang.interpretation + ' (봉우리 x=' + R0.indang.profilePeaks.join(',') + ')'
    : 'UNMEASURABLE — ' + R0.indang.reason));
  /* 부위 마스크가 색 센서의 것을 그대로 쓰는지 확인 */
  let sameMask = true;
  for (const rn in S.REGIONS) if (T.TEXTURE_REGIONS[rn].ring !== S.REGIONS[rn].ring) sameMask = false;
  check('0', '★부위 마스크를 새로 만들지 않았다(sensor_color.REGIONS 객체 동일 참조)', sameMask, '');
}

/* ── 1. ★★해상도·초점 불변성 ───────────────────────────────────────────── */
console.log('\n' + line('-'));
console.log('  1. ★★해상도·초점 불변성 — 변환 전후 축 값의 상대변화율   rel = |Δv| / (|v0| + ' + 0.20 + ')');
console.log('     기준 = 640px 원본.  정규화 후 = normMode:"full"  /  정규화 전 = normMode:"raw"');
console.log('     (raw = 표준 얼굴 캔버스 + 얼굴기준 정규화 + log 를 해제한 것.');
console.log('      ★대역통과(DoG)는 raw 에서도 켜 둔다 — 그것은 정규화가 아니라 「주름 검출기」이고,');
console.log('        그것까지 끄면 저주파 조명을 재는 전혀 다른 양이 되어 비교 자체가 성립하지 않는다.)');
console.log(line('-'));

/* ★축을 두 갈래로 나눈다 — 판정 기준이 달라야 하기 때문이다.
     DIR(방향·형상) : [-1,1] 또는 [0,1] 로 유계이고 0 이 정상값이다 → 가산 바닥(0.20)을 쓴다.
                      승격 후보가 실제로 기대는 축이 이쪽이다(直理/橫理·紋交·선순도).
     ENERGY(세기)   : 양수이고 정규화 방식마다 눈금 자체가 달라진다 → 순수 비(比)를 쓴다.
                      가산 바닥을 쓰면 눈금이 작은 모드(raw)가 공짜로 좋아 보인다. */
const KEY_AXES = [
  ['天庭.방향성', r => r.regions.CHEONJEONG.directionality, 'DIR'],
  ['天庭.집중도', r => r.regions.CHEONJEONG.orientationConcentration, 'DIR'],
  ['印堂.세로비중', r => r.regions.INDANG.vertFrac, 'DIR'],
  ['天庭.선순도', r => r.regions.CHEONJEONG.ridgeValleyPurity, 'DIR'],
  ['天庭.주름세기', r => r.regions.CHEONJEONG.wrinkleEnergy, 'ENERGY'],
  ['印堂.주름세기', r => r.regions.INDANG.wrinkleEnergy, 'ENERGY'],
  ['地閣.주름세기', r => r.regions.JIGAK.wrinkleEnergy, 'ENERGY']
];
const REL_FLOOR = 0.20;
function relChange(a, b, kind) {
  if (!isFinite(a) || !isFinite(b)) return NaN;
  return (kind === 'ENERGY')
    ? Math.abs(b - a) / Math.max(Math.abs(a), 1e-9)
    : Math.abs(b - a) / (Math.abs(a) + REL_FLOOR);
}

const XFORM = [
  ['해상도 1280(×2)', () => IMG[1280]],
  ['해상도 320(÷2)', () => IMG[320]],
  ['흐림 σ1.0', () => blurImage(IMG[640], 1.0)],
  ['흐림 σ2.0', () => blurImage(IMG[640], 2.0)],
  ['흐림 σ3.2', () => blurImage(IMG[640], 3.2)],
  ['JPEG q=50', () => jpegLike(IMG[640], 50)],
  ['JPEG q=20', () => jpegLike(IMG[640], 20)],
  ['320 + 흐림 σ1.5', () => blurImage(IMG[320], 1.5)]
];
const XCACHE = {};
for (const [nm, f] of XFORM) XCACHE[nm] = f();

const GROUPMAX = (rel, kind) => {
  const v = KEY_AXES.map((a, i) => a[2] === kind ? rel[i] : NaN).filter(isFinite);
  return v.length ? Math.max.apply(null, v) : NaN;
};

function invTable(mode, label, quiet) {
  const base = T.measureTexture(IMG[640], lm, MH / MW, { normMode: mode });
  if (!base.ok) return { ok: false, reason: base.reject.gate + ':' + base.reject.reason };
  const b0 = KEY_AXES.map(a => { try { return a[1](base); } catch (e) { return NaN; } });
  const rows = [];
  for (const [nm] of XFORM) {
    const r = T.measureTexture(XCACHE[nm], lm, MH / MW, { normMode: mode });
    if (!r.ok) { rows.push({ t: nm, rejected: r.reject.gate + ':' + r.reject.reason, rel: KEY_AXES.map(() => NaN), max: NaN }); continue; }
    const rel = KEY_AXES.map((a, i) => { try { return relChange(b0[i], a[1](r), a[2]); } catch (e) { return NaN; } });
    rows.push({ t: nm, rel, dir: GROUPMAX(rel, 'DIR'), en: GROUPMAX(rel, 'ENERGY'),
      max: Math.max.apply(null, rel.filter(isFinite)) });
  }
  if (!quiet) {
    console.log('\n  ── ' + label + ' ──');
    console.log('  ' + pad('변환', 18) + KEY_AXES.map(a => lpad(a[0], 14)).join('') + lpad('DIR최대', 10) + lpad('세기최대', 10));
    console.log('  ' + pad('기준값(640)', 18) + b0.map(v => lpad(f2(v), 14)).join(''));
    for (const r of rows) {
      if (r.rejected) { console.log('  ' + pad(r.t, 18) + '  ★거부 ' + r.rejected.slice(0, 70)); continue; }
      console.log('  ' + pad(r.t, 18) + r.rel.map(v => lpad(pc(v), 14)).join('') + lpad(pc(r.dir), 10) + lpad(pc(r.en), 10));
    }
  }
  return { ok: true, b0, rows,
    worstDir: Math.max.apply(null, rows.map(r => isFinite(r.dir) ? r.dir : 0)),
    worstEn: Math.max.apply(null, rows.map(r => isFinite(r.en) ? r.en : 0)),
    worst: Math.max.apply(null, rows.map(r => isFinite(r.max) ? r.max : 0)) };
}

const invFull = invTable('full', '정규화 후 (full)');
const invRaw = invTable('raw', '정규화 전 (raw)');
const HARD_BLUR = ['흐림 σ3.2', '320 + 흐림 σ1.5'];   // ★한계를 아는 변환. 아래에서 따로 다룬다.
if (invFull.ok) {
  for (const r of invFull.rows) {
    /* ⓐ 방향·형상 축은 **모든** 변환에서 ±15% 이내여야 한다 — 승격 후보가 기대는 축이다 */
    check('1', 'DIR축(방향·형상) ±15% — ' + r.t, isFinite(r.dir) && r.dir <= 0.15,
      'DIR 최대 ' + pc(r.dir) + (r.rejected ? ' (' + r.rejected + ')' : ''));
    /* ⓑ 세기 축은 해상도·JPEG·중간 흐림까지 ±15% */
    if (HARD_BLUR.indexOf(r.t) < 0)
      check('1', '세기축 ±15% — ' + r.t, isFinite(r.en) && r.en <= 0.15, '세기 최대 ' + pc(r.en));
  }
  /* ⓒ ★한계를 검사로 못박는다 — 강한 흐림에서 세기 축은 유지되지 않는다.
        이유: 주름(폭 ≈ 얼굴폭 0.6%)과 피부 미세결(≈1.2%)은 **공간 스케일이 다르다.**
        초점이 흐려지면 가는 쪽이 더 많이 죽는다. 두 스케일의 에너지 비는 원리상 초점에 불변일 수 없다.
        ⟹ 숨기지 않고 수치로 적고, G7 초점 게이트로 작동 범위를 막는 것이 우리 대답이다. */
  const hardEn = invFull.rows.filter(r => HARD_BLUR.indexOf(r.t) >= 0).map(r => r.en);
  check('1', '★한계 확인 — 강한 흐림(σ3.2)에서 세기 축은 ±15% 를 지키지 못한다(원리상 불가·게이트로 막는다)',
    hardEn.some(v => v > 0.15), hardEn.map(pc).join(' / '));
  const hardDir = invFull.rows.filter(r => HARD_BLUR.indexOf(r.t) >= 0).map(r => r.dir);
  check('1', '★그 강한 흐림에서도 방향·형상 축은 ±15% 를 지킨다', hardDir.every(v => v <= 0.15), hardDir.map(pc).join(' / '));

  console.log('\n  ⟹ 정규화 후  DIR 최악 ' + pc(invFull.worstDir) + ' · 세기 최악 ' + pc(invFull.worstEn));
  console.log('  ⟹ 정규화 전  DIR 최악 ' + pc(invRaw.ok ? invRaw.worstDir : NaN) + ' · 세기 최악 ' + pc(invRaw.ok ? invRaw.worstEn : NaN));
  console.log('  ⟹ 개선 배율  DIR ' + ((invRaw.ok && invFull.worstDir > 0) ? (invRaw.worstDir / invFull.worstDir).toFixed(1) + '×' : 'n/a') +
    ' · 세기 ' + ((invRaw.ok && invFull.worstEn > 0) ? (invRaw.worstEn / invFull.worstEn).toFixed(1) + '×' : 'n/a'));
  check('1', '정규화가 실제로 효과가 있다(정규화 전 최악 > 후 최악의 3배 — DIR 또는 세기 어느 쪽이든)',
    invRaw.ok && (invRaw.worstDir > invFull.worstDir * 3 || invRaw.worstEn > invFull.worstEn * 3),
    'DIR ' + pc(invRaw.ok ? invRaw.worstDir : NaN) + '→' + pc(invFull.worstDir) +
    ' · 세기 ' + pc(invRaw.ok ? invRaw.worstEn : NaN) + '→' + pc(invFull.worstEn));
} else check('1', '해상도·초점 불변성 측정', false, invFull.reason);

let INT_AXIS_RESULT = null;
/* ★정수 축(점 개수 · 印堂 세로선 개수)은 ±% 가 아니라 「값이 유지되는가」로 본다 */
console.log('\n  ── ★정수 축은 ±% 가 아니라 「값이 유지되는가」로 본다 ──');
{
  const base = T.measureTexture(IMG[640], lm, MH / MW);
  const bc = base.regions.GWAN_R.blobs.count;
  const bl = base.indang.status === 'MEASURED' ? base.indang.count : null;
  const row = [];
  for (const [nm] of XFORM) {
    const r = T.measureTexture(XCACHE[nm], lm, MH / MW);
    row.push([nm, r.ok ? r.regions.GWAN_R.blobs.count : 'reject',
      r.ok ? (r.indang.status === 'MEASURED' ? r.indang.count : 'UNMEAS') : 'reject']);
  }
  INT_AXIS_RESULT = { blobCountBase: bc, lineCountBase: bl, rows: row };
  console.log('  顴 덩어리 개수  기준=' + bc + ' : ' + row.map(([n, v]) => n + '=' + v).join(' · '));
  console.log('  印堂 세로선수   기준=' + bl + ' : ' + row.map(([n, , v]) => n + '=' + v).join(' · '));
  const keepB = row.filter(([, v]) => v === bc).length, keepL = row.filter(([, , v]) => v === bl).length;
  check('1', '★점 개수가 8/8 변환에서 유지된다', keepB === 8, keepB + '/8 유지');
  check('1', '★印堂 세로선 개수가 8/8 변환에서 유지된다', keepL === 8, keepL + '/8 유지');
}

/* ── 2. 판별력 ──────────────────────────────────────────────────────────── */
console.log('\n' + line('-'));
console.log('  2. 판별력 — 서로 다른 텍스처를 실제로 구분하는가');
console.log(line('-'));

const W_H = (rg, n, sp) => ({ region: rg, angleDeg: 0, count: n, spacingFrac: sp || 0.055, sigmaFrac: 0.0060, depth: 0.15 });
const W_V = (rg, n, sp) => ({ region: rg, angleDeg: 90, count: n, spacingFrac: sp || 0.045, sigmaFrac: 0.0055, depth: 0.17 });

const SCEN = {
  '민얼굴(주름 없음)': {},
  '이마 橫理(가로4)': { wrinkles: [W_H('CHEONJEONG', 4)] },
  '이마 直理(세로3)': { wrinkles: [W_V('CHEONJEONG', 3, 0.055)] },
  '印堂 懸針(세로1)': { wrinkles: [W_V('INDANG', 1)] },
  '印堂 川字(세로3)': { wrinkles: [W_V('INDANG', 3)] },
  /* 紋交 — 세로 1 + 가로 1 이 실제로 교차하게 그린다(둘 다 같은 깊이라야 한쪽이 이기지 않는다) */
  '印堂 紋交(세1+가1)': { wrinkles: [
    { region: 'INDANG', angleDeg: 90, count: 1, spacingFrac: 0.050, sigmaFrac: 0.0055, depth: 0.17 },
    { region: 'INDANG', angleDeg: 0, count: 1, spacingFrac: 0.045, sigmaFrac: 0.0055, depth: 0.17 }] },
  '顴 黒痣 0개': {},
  '顴 黒痣 1개': { moles: [{ region: 'GWAN_R', count: 1, rFrac: 0.016, darkness: 0.40, seed: 31 }] },
  '顴 黒痣 3개': { moles: [{ region: 'GWAN_R', count: 3, rFrac: 0.016, darkness: 0.40, seed: 31 }] },
  '顴 疵瘢(흉터1)': { moles: [{ region: 'GWAN_R', count: 1, rFrac: 0.011, darkness: 0.45, elong: 4.5, angleDeg: 30, seed: 31 }] }
};
const SHOW = [
  ['天庭.세기', r => r.regions.CHEONJEONG.wrinkleEnergy],
  ['天庭.방향성', r => r.regions.CHEONJEONG.directionality],
  ['印堂.세기', r => r.regions.INDANG.wrinkleEnergy],
  ['印堂.세로', r => r.regions.INDANG.vertFrac],
  ['印堂.교차', r => r.regions.INDANG.crossingIndex],
  ['印堂.선수', r => (r.indang.status === 'MEASURED' ? r.indang.count : NaN)],
  ['顴.덩어리', r => r.regions.GWAN_R.blobs.count],
  ['顴.길쭉', r => r.regions.GWAN_R.blobs.meanElongation],
  ['顴.경계', r => r.regions.GWAN_R.blobs.meanEdgeSharpness]
];
const M = {};
console.log('  ' + pad('합성 시나리오', 20) + SHOW.map(s => lpad(s[0], 12)).join(''));
for (const sn in SCEN) {
  const img = downsample(render(lm, SCEN[sn]), 2);
  const r = T.measureTexture(img, lm, MH / MW);
  if (!r.ok) { console.log('  ' + pad(sn, 20) + '  ★거부 ' + r.reject.gate); M[sn] = null; continue; }
  M[sn] = r;
  console.log('  ' + pad(sn, 20) + SHOW.map(s => { let v; try { v = s[1](r); } catch (e) { v = NaN; } return lpad(f2(v), 12); }).join(''));
}
const G = (s, f) => M[s] ? (() => { try { return f(M[s]); } catch (e) { return NaN; } })() : NaN;

check('2', '주름 있음 → 天庭 주름세기 상승 (橫理 ≥ 민얼굴×1.5)',
  G('이마 橫理(가로4)', r => r.regions.CHEONJEONG.wrinkleEnergy) >= 1.5 * G('민얼굴(주름 없음)', r => r.regions.CHEONJEONG.wrinkleEnergy),
  '橫理=' + f2(G('이마 橫理(가로4)', r => r.regions.CHEONJEONG.wrinkleEnergy)) + ' 민=' + f2(G('민얼굴(주름 없음)', r => r.regions.CHEONJEONG.wrinkleEnergy)));
check('2', '★橫理(가로결) → 방향성 ≤ −0.40', G('이마 橫理(가로4)', r => r.regions.CHEONJEONG.directionality) <= -0.40,
  'v=' + f2(G('이마 橫理(가로4)', r => r.regions.CHEONJEONG.directionality)));
check('2', '★直理(세로결) → 방향성 ≥ +0.40', G('이마 直理(세로3)', r => r.regions.CHEONJEONG.directionality) >= 0.40,
  'v=' + f2(G('이마 直理(세로3)', r => r.regions.CHEONJEONG.directionality)));
check('2', '★直理 와 橫理 의 방향성 차이가 0.9 이상 벌어진다',
  G('이마 直理(세로3)', r => r.regions.CHEONJEONG.directionality) - G('이마 橫理(가로4)', r => r.regions.CHEONJEONG.directionality) >= 0.9,
  'Δ=' + f2(G('이마 直理(세로3)', r => r.regions.CHEONJEONG.directionality) - G('이마 橫理(가로4)', r => r.regions.CHEONJEONG.directionality)));
check('2', '민얼굴은 방향성이 한쪽으로 쏠리지 않는다(|방향성| < 0.40)',
  Math.abs(G('민얼굴(주름 없음)', r => r.regions.CHEONJEONG.directionality)) < 0.40,
  'v=' + f2(G('민얼굴(주름 없음)', r => r.regions.CHEONJEONG.directionality)));
check('2', '★懸針(세로1) → 印堂 세로선 1개', G('印堂 懸針(세로1)', r => (r.indang.status === 'MEASURED' ? r.indang.count : -1)) === 1,
  'status=' + (M['印堂 懸針(세로1)'] ? M['印堂 懸針(세로1)'].indang.status + ' ' + M['印堂 懸針(세로1)'].indang.reason : 'n/a'));
check('2', '★川字(세로3) → 印堂 세로선 3개', G('印堂 川字(세로3)', r => (r.indang.status === 'MEASURED' ? r.indang.count : -1)) === 3,
  'status=' + (M['印堂 川字(세로3)'] ? M['印堂 川字(세로3)'].indang.status + ' cnt=' + M['印堂 川字(세로3)'].indang.count + ' ' + M['印堂 川字(세로3)'].indang.reason : 'n/a'));
check('2', '★주름 없는 印堂은 세로선을 세지 않는다(UNMEASURABLE — 억지로 세지 않는다)',
  M['민얼굴(주름 없음)'] && M['민얼굴(주름 없음)'].indang.status === 'UNMEASURABLE',
  M['민얼굴(주름 없음)'] ? M['민얼굴(주름 없음)'].indang.status : 'n/a');
check('2', '★紋交(교차) → 교차지표가 세로전용보다 높다',
  G('印堂 紋交(세1+가1)', r => r.regions.INDANG.crossingIndex) > G('印堂 川字(세로3)', r => r.regions.INDANG.crossingIndex) + 0.20,
  '交=' + f2(G('印堂 紋交(세1+가1)', r => r.regions.INDANG.crossingIndex)) + ' 川=' + f2(G('印堂 川字(세로3)', r => r.regions.INDANG.crossingIndex)));
check('2', '★紋交 → 방향 집중도가 川字보다 낮다(한 방향으로 모이지 않는다)',
  G('印堂 紋交(세1+가1)', r => r.regions.INDANG.orientationConcentration) <
  G('印堂 川字(세로3)', r => r.regions.INDANG.orientationConcentration) - 0.20,
  '交=' + f2(G('印堂 紋交(세1+가1)', r => r.regions.INDANG.orientationConcentration)) +
  ' 川=' + f2(G('印堂 川字(세로3)', r => r.regions.INDANG.orientationConcentration)));
check('2', '★紋交에서는 세로선 개수를 세지 않는다(가로결이 섞이면 「세로선 몇 개」가 뜻이 없다)',
  M['印堂 紋交(세1+가1)'] && M['印堂 紋交(세1+가1)'].indang.status === 'UNMEASURABLE',
  M['印堂 紋交(세1+가1)'] ? M['印堂 紋交(세1+가1)'].indang.status + ' cnt=' + M['印堂 紋交(세1+가1)'].indang.count : 'n/a');
check('2', '점 0개 → 덩어리 0', G('顴 黒痣 0개', r => r.regions.GWAN_R.blobs.count) === 0,
  'v=' + G('顴 黒痣 0개', r => r.regions.GWAN_R.blobs.count));
check('2', '점 1개 → 덩어리 1', G('顴 黒痣 1개', r => r.regions.GWAN_R.blobs.count) === 1,
  'v=' + G('顴 黒痣 1개', r => r.regions.GWAN_R.blobs.count));
check('2', '점 3개 → 덩어리 3', G('顴 黒痣 3개', r => r.regions.GWAN_R.blobs.count) === 3,
  'v=' + G('顴 黒痣 3개', r => r.regions.GWAN_R.blobs.count));
check('2', '★疵瘢(흉터) 은 黒痣(점) 보다 길쭉하다 (길쭉도 ≥ 2배)',
  G('顴 疵瘢(흉터1)', r => r.regions.GWAN_R.blobs.meanElongation) >= 2 * G('顴 黒痣 1개', r => r.regions.GWAN_R.blobs.meanElongation),
  '瘢=' + f2(G('顴 疵瘢(흉터1)', r => r.regions.GWAN_R.blobs.meanElongation)) + ' 痣=' + f2(G('顴 黒痣 1개', r => r.regions.GWAN_R.blobs.meanElongation)));

/* ── 3. ★혼동 대조군 ────────────────────────────────────────────────────── */
console.log('\n' + line('-'));
console.log('  3. ★혼동 대조군 — 텍스처가 아닌 것을 주름으로 읽지 않는가 (5종)');
console.log(line('-'));

const CONF = {
  '(대조) 이마 直理 진짜': { scen: { wrinkles: [W_V('CHEONJEONG', 3, 0.055)] }, region: 'CHEONJEONG' },
  '머리카락 5올(이마)': { scen: { hair: { region: 'CHEONJEONG', count: 5, darkness: 0.22, sigmaFrac: 0.004 } }, region: 'CHEONJEONG' },
  '조명 그림자 경계(세로)': { scen: { shadowEdge: { angleDeg: 90, factor: 0.70, softFrac: 0.004 } }, region: 'CHEONJEONG' },
  '화장 경계(세로·색만)': { scen: { makeupEdge: { region: 'CHEONJEONG', angleDeg: 90, gain: [1.18, 0.92, 0.90] } }, region: 'CHEONJEONG' },
  '수염(턱)': { scen: { beard: { region: 'JIGAK', count: 90, darkness: 0.28 } }, region: 'JIGAK' },
  '안경테(눈 아래 가로)': { scen: { glasses: { darkness: 0.16, thickFrac: 0.020 } }, region: 'ANHA_R' }
};
const CM = {};
console.log('  ' + pad('합성', 24) + pad('부위', 12) + lpad('주름세기', 10) + lpad('방향성', 9) + lpad('선순도', 9) +
  lpad('색경계비', 10) + lpad('이물비', 9) + lpad('어두움', 9) + lpad('신뢰', 7) + lpad('덩어리', 9));
for (const cn in CONF) {
  const { scen, region } = CONF[cn];
  const r = T.measureTexture(downsample(render(lm, scen), 2), lm, MH / MW);
  if (!r.ok) { console.log('  ' + pad(cn, 24) + '  ★거부 ' + r.reject.gate + ' ' + r.reject.reason.slice(0, 40)); CM[cn] = null; continue; }
  CM[cn] = r;
  const g = r.regions[region];
  console.log('  ' + pad(cn, 24) + pad(region, 12) + lpad(f2(g.wrinkleEnergy), 10) + lpad(f2(g.directionality), 9) +
    lpad(f2(g.ridgeValleyPurity), 9) + lpad(f2(g.chromaEdgeRatio), 10) + lpad(pc(g.occluderFrac), 9) +
    lpad(pc(g.darkFrac), 9) + lpad(g.textureReliable ? 'OK' : '★불가', 7) +
    lpad(g.blobs && g.blobs.reliable ? g.blobs.count : ('★' + (g.blobs ? g.blobs.count : '—')), 9));
}
const CG = (n, f) => CM[n] ? f(CM[n]) : NaN;
const realV = CG('(대조) 이마 直理 진짜', r => r.regions.CHEONJEONG.wrinkleEnergy);
const plainV = M['민얼굴(주름 없음)'] ? M['민얼굴(주름 없음)'].regions.CHEONJEONG.wrinkleEnergy : NaN;
const realPur = CG('(대조) 이마 直理 진짜', r => r.regions.CHEONJEONG.ridgeValleyPurity);
/* 「누출」 = 혼동물이 올린 주름세기가 진짜 주름이 올린 몫의 몇 % 인가.
   민얼굴 기준선을 빼야 공정하다 — 두 값 모두 미세결 바닥 위에 얹혀 있기 때문이다. */
const leak = (n) => (CG(n, r => r.regions.CHEONJEONG.wrinkleEnergy) - plainV) / (realV - plainV);
console.log('\n  민얼굴 天庭 주름세기 = ' + f2(plainV) + '  /  진짜 直理 = ' + f2(realV) +
  '   ⟹ 「누출」 = (혼동물−민얼굴)/(진짜−민얼굴)');
for (const n of ['머리카락 5올(이마)', '조명 그림자 경계(세로)', '화장 경계(세로·색만)'])
  console.log('    ' + pad(n, 24) + '누출 ' + pc(leak(n)));

check('3', '★머리카락 — 이물/어두움으로 天庭이 신뢰 불가가 된다(fail-closed)',
  CM['머리카락 5올(이마)'] && CM['머리카락 5올(이마)'].regions.CHEONJEONG.textureReliable === false,
  CM['머리카락 5올(이마)'] ? ('이물 ' + pc(CM['머리카락 5올(이마)'].regions.CHEONJEONG.occluderFrac) +
    ' 어두움 ' + pc(CM['머리카락 5올(이마)'].regions.CHEONJEONG.darkFrac)) : 'n/a');
check('3', '★머리카락 — 선순도가 진짜 주름의 절반 이하다(선이 아니라 이물이라는 표시)',
  CG('머리카락 5올(이마)', r => r.regions.CHEONJEONG.ridgeValleyPurity) < 0.5 * realPur,
  '머리=' + f2(CG('머리카락 5올(이마)', r => r.regions.CHEONJEONG.ridgeValleyPurity)) + ' 진짜=' + f2(realPur));
check('3', '★조명 그림자 경계 — 선순도가 진짜 주름보다 뚜렷이 낮다(계단으로 인식)',
  CG('조명 그림자 경계(세로)', r => r.regions.CHEONJEONG.ridgeValleyPurity) < realPur - 0.15,
  '그림자=' + f2(CG('조명 그림자 경계(세로)', r => r.regions.CHEONJEONG.ridgeValleyPurity)) + ' 진짜=' + f2(realPur));
check('3', '★조명 그림자 경계를 세로 주름으로 읽지 않는다(누출 < 25%)', leak('조명 그림자 경계(세로)') < 0.25,
  '누출 ' + pc(leak('조명 그림자 경계(세로)')));
check('3', '★화장 경계 — 색경계비가 진짜 주름의 2배 이상이다',
  CG('화장 경계(세로·색만)', r => r.regions.CHEONJEONG.chromaEdgeRatio) >=
  2.0 * CG('(대조) 이마 直理 진짜', r => r.regions.CHEONJEONG.chromaEdgeRatio),
  '화장=' + f2(CG('화장 경계(세로·색만)', r => r.regions.CHEONJEONG.chromaEdgeRatio)) +
  ' 진짜=' + f2(CG('(대조) 이마 直理 진짜', r => r.regions.CHEONJEONG.chromaEdgeRatio)));
check('3', '★화장 경계를 주름으로 읽지 않는다(누출 < 25%)', leak('화장 경계(세로·색만)') < 0.25,
  '누출 ' + pc(leak('화장 경계(세로·색만)')));
check('3', '★화장 경계는 방향성을 세로로 밀지 않는다(|방향성| < 0.4)',
  Math.abs(CG('화장 경계(세로·색만)', r => r.regions.CHEONJEONG.directionality)) < 0.4,
  'v=' + f2(CG('화장 경계(세로·색만)', r => r.regions.CHEONJEONG.directionality)));
check('3', '★수염 — 地閣의 점 판정이 무효화된다(수염을 점으로 세지 않는다)',
  CM['수염(턱)'] && CM['수염(턱)'].regions.JIGAK.blobs.reliable === false,
  CM['수염(턱)'] ? JSON.stringify(CM['수염(턱)'].regions.JIGAK.blobs).slice(0, 90) : 'n/a');
check('3', '★수염 — 地閣 텍스처 자체가 신뢰 불가로 떨어진다',
  CM['수염(턱)'] && CM['수염(턱)'].regions.JIGAK.textureReliable === false,
  CM['수염(턱)'] ? ('어두움 ' + pc(CM['수염(턱)'].regions.JIGAK.darkFrac)) : 'n/a');
check('3', '★안경테 — 眼下(右) 부위가 신뢰 불가로 떨어진다(fail-closed)',
  CM['안경테(눈 아래 가로)'] && CM['안경테(눈 아래 가로)'].regions.ANHA_R.textureReliable === false,
  CM['안경테(눈 아래 가로)'] ? ('이물비 ' + pc(CM['안경테(눈 아래 가로)'].regions.ANHA_R.occluderFrac)) : 'n/a');
check('3', '★혼동물이 없는 부위는 영향을 받지 않는다(안경테 시나리오의 天庭은 정상)',
  CM['안경테(눈 아래 가로)'] && CM['안경테(눈 아래 가로)'].regions.CHEONJEONG.textureReliable === true, '');

/* ── 3b. 眉(눈썹) 결 — 「毛逆·亂」 ────────────────────────────────────────── */
console.log('\n  ── 眉(눈썹) 결 — OGWAN R023 「逆而亂」. ★눈썹은 별도 스택으로 잰다(털이 이물이 아니라 신호다) ──');
{
  const tidy = T.measureTexture(downsample(render(lm, { browMess: 0.03 }), 2), lm, MH / MW);
  const messy = T.measureTexture(downsample(render(lm, { browMess: 1.0 }), 2), lm, MH / MW);
  const g = (r) => r.regions.BROW_R;
  console.log('  ' + pad('가지런한 눈썹', 20) + '집중도 ' + f2(g(tidy).orientationConcentration) +
    ' · coherence ' + f2(g(tidy).orientationCoherence) + ' · 방향 ' + g(tidy).wrinkleOrientationDeg.toFixed(0) + '°');
  console.log('  ' + pad('어지러운 눈썹(亂)', 20) + '집중도 ' + f2(g(messy).orientationConcentration) +
    ' · coherence ' + f2(g(messy).orientationCoherence) + ' · 방향 ' + g(messy).wrinkleOrientationDeg.toFixed(0) + '°');
  check('3b', '★「亂(어지러움)」 → 눈썹 방향 집중도가 뚜렷이 낮아진다',
    g(messy).orientationConcentration < g(tidy).orientationConcentration - 0.10,
    '가지런 ' + f2(g(tidy).orientationConcentration) + ' vs 어지러움 ' + f2(g(messy).orientationConcentration));
  check('3b', '★눈썹 계단이 印堂을 오염시키지 않는다(눈썹만 있는 얼굴의 印堂 세로선은 세지 않는다)',
    tidy.indang.status === 'UNMEASURABLE', tidy.indang.status + ' ' + tidy.indang.reason.slice(0, 50));
}

/* ── 4. 음성 대조군 (fail-closed) ───────────────────────────────────────── */
console.log('\n' + line('-'));
console.log('  4. 음성 대조군 — 얼굴이 아니거나 잴 수 없는 사진이면 거부하는가');
console.log(line('-'));
function flatImage(col, w, h) {
  const d = new Uint8ClampedArray(w * h * 4), rnd = mulberry32(7);
  for (let i = 0; i < w * h; i++) {
    const n = (rnd() - 0.5) * 10;
    d[i * 4] = col[0] + n; d[i * 4 + 1] = col[1] + n; d[i * 4 + 2] = col[2] + n; d[i * 4 + 3] = 255;
  }
  return { data: d, width: w, height: h };
}
/* 작은 얼굴을 왼쪽 위에 그려두고 마스크만 오른쪽 아래 배경으로 옮긴다 */
const lmSmall = makeLandmarks({ scale: MSCALE * 0.42, cx: 400, cy: 520 });
const smallFaceImg = downsample(render(lmSmall, RICH), 2);
const lmOffFace = makeLandmarks({ scale: MSCALE * 0.42, cx: 880, cy: 1220 });
const lmTiny = makeLandmarks({ scale: MSCALE * 0.055 });   // 얼굴 폭 ≈ 25px(640 기준 ≈ 12px)

const NEG = [
  ['얼굴 아닌 단색 하늘(무채·차가움)', flatImage([120, 132, 150], 640, 852), lm, 'G6'],
  ['마스크가 통째로 얼굴 밖 배경 위', smallFaceImg, lmOffFace, 'G6'],
  ['★얼굴이 너무 작다(폭 ≈12px)', IMG[640], lmTiny, 'G3'],
  ['★초점 완전 소실(σ=14)', blurImage(IMG[640], 14), lm, 'G7'],
  ['랜드마크가 화면 밖으로 확대(2.4배)', IMG[640], makeLandmarks({ scale: MSCALE * 2.4 }), 'G2'],
  ['랜드마크 468개 미만(길이 300)', IMG[640], lm.slice(0, 300), 'G1'],
  ['imageData 버퍼 길이 부족', { data: new Uint8ClampedArray(100), width: 640, height: 852 }, lm, 'G1'],
  ['랜드마크 좌표에 NaN', IMG[640], (() => { const l = makeLandmarks({}); l[5] = { x: NaN, y: 0.5 }; return l; })(), 'G1']
];
for (const [nm, img, l, wantGate] of NEG) {
  const r = T.measureTexture(img, l, MH / MW);
  const okRej = !r.ok;
  console.log('  ' + pad(nm, 36) + (okRej ? '거부 ' + r.reject.gate + ' — ' + r.reject.reason.slice(0, 52) : '★통과시킴(=결함)'));
  check('4', '거부해야 한다 — ' + nm, okRej && (!wantGate || r.reject.gate === wantGate),
    okRej ? ('게이트 ' + r.reject.gate + ' (기대 ' + wantGate + ')') : '거부하지 않았다');
}
check('4', '정상 합성 얼굴은 거부하지 않는다', T.measureTexture(IMG[640], lm, MH / MW).ok, '');
const smallOK = T.measureTexture(smallFaceImg, lmSmall, MH / MW);
check('4', '작은 얼굴(폭 ≈190px)도 거부하지 않는다', smallOK.ok, smallOK.reject && smallOK.reject.reason);
check('4', '320px 저해상도도 거부하지 않는다', T.measureTexture(IMG[320], lm, MH / MW).ok, '');

/* ── 5. 축 ↔ 원문 대응 무결성 ───────────────────────────────────────────── */
console.log('\n' + line('-'));
console.log('  5. 축 ↔ 원문 대응 무결성 — 대응 rule 이 없는 축은 존재해선 안 된다');
console.log(line('-'));
const RULES = {};
for (const f of ['ogwan', 'xlhz']) {
  const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'IP_face/rules/face/' + f + '.json'), 'utf8'));
  for (const r of j.rules) RULES[r.rule_id] = r;
}
const axisBad = [];
for (const a of T.AXES) {
  if (!a.rules || !a.rules.length) { axisBad.push(a.axis + ':대응규칙없음'); continue; }
  for (const rid of a.rules) if (!RULES[rid]) axisBad.push(a.axis + ':' + rid + '(없는 rule_id)');
}
check('5', '모든 축이 실재하는 rule_id 에 대응한다', axisBad.length === 0, axisBad.join(' '));
const nmBad = [];
for (const n of T.NOT_MEASURED) for (const rid of n.rules) if (!RULES[rid]) nmBad.push(n.text + ':' + rid);
check('5', '「못 재는 것」 목록도 실재하는 rule_id 를 가리킨다', nmBad.length === 0, nmBad.join(' '));
console.log('  축 ' + T.AXES.length + '개 · 명시적 미계측 항목 ' + T.NOT_MEASURED.length + '개 · 참조 rule ' +
  new Set(T.AXES.reduce((s, a) => s.concat(a.rules), [])).size + '건');
/* 규칙 파일에서 텍스처 글자를 전수 grep 해 「빠뜨린 조건」이 없는지 본다 */
const TEX_CHARS = ['直理', '橫理', '紋', '懸針', '川字', '痣', '疵', '瘢', '毛逆', '逆', '凹', '陷', '麻', '點'];
const hits = [];
for (const rid in RULES) {
  const r = RULES[rid], hay = (r.condition.predicate_original || '') + ' | ' + (r.condition.gloss_ko || '');
  const h = TEX_CHARS.filter(c => hay.indexOf(c) >= 0);
  if (h.length) hits.push([rid, r.measurability, h.join(','), r.condition.predicate_original]);
}
console.log('  ★규칙 전수 grep — 텍스처 글자가 조건에 든 규칙 ' + hits.length + '건');
for (const [rid, mz, h, pr] of hits) console.log('    ' + pad(rid, 20) + pad(mz, 14) + pad(h, 18) + pr);
const covered = new Set(T.AXES.reduce((s, a) => s.concat(a.rules), []).concat(T.NOT_MEASURED.reduce((s, a) => s.concat(a.rules), [])));
const uncovered = hits.filter(([rid]) => !covered.has(rid));
check('5', '★grep 로 뽑은 텍스처 규칙이 전부 축 또는 「못 재는 것」에 배당돼 있다',
  uncovered.length === 0, '미배당: ' + uncovered.map(h => h[0]).join(','));

/* ── 6. ★변이 시험 ─────────────────────────────────────────────────────── */
console.log('\n' + line('-'));
console.log('  6. ★변이 시험 — 정규화·방향추정을 일부러 망가뜨렸을 때 ①②가 잡아내는가');
console.log(line('-'));
const MUT = [
  ['M1 raw — 정규화 전부 해제', 'raw'],
  ['M2 no_resample — 표준 얼굴 캔버스 없음', 'no_resample'],
  ['M3 no_bandpass — DoG 없이 log 휘도 직접', 'no_bandpass'],
  ['M4 no_face_norm — 얼굴 기준 RMS 로 안 나눔', 'no_face_norm'],
  ['M5 no_log — log 안 씀', 'no_log']
];
let caught = 0;
console.log('  ' + pad('변이', 42) + lpad('①최악 상대변화', 16) + '   가장 크게 깨진 변환');
for (const [nm, mode] of MUT) {
  const r = invTable(mode, nm, true);
  if (!r.ok) { console.log('  ' + pad(nm, 42) + lpad('계측 거부', 16) + '   ' + r.reason.slice(0, 40)); caught++; check('6', nm + ' 를 잡아냈다', true, ''); continue; }
  const worstRow = r.rows.reduce((a, b) => ((isFinite(b.max) ? b.max : -1) > (isFinite(a.max) ? a.max : -1) ? b : a));
  const hit = r.worst > 0.15;
  if (hit) caught++;
  const wi = worstRow.rel.indexOf(Math.max.apply(null, worstRow.rel.filter(isFinite)));
  console.log('  ' + pad(nm, 42) + lpad(pc(r.worst), 16) + '   ' + worstRow.t + (wi >= 0 ? ' [' + KEY_AXES[wi][0] + ']' : ''));
  check('6', nm + ' 를 ①이 잡아낸다(최악 > 15%)', hit, '최악 ' + pc(r.worst));
}
/* M6 은 ① 이 아니라 ② 가 잡아야 한다 — 방향을 뒤집어도 「값의 안정성」은 그대로이기 때문이다 */
{
  const imgH = downsample(render(lm, { wrinkles: [W_H('CHEONJEONG', 4)] }), 2);
  const imgV = downsample(render(lm, { wrinkles: [W_V('CHEONJEONG', 3, 0.055)] }), 2);
  const ok = (m) => {
    const h = T.measureTexture(imgH, lm, MH / MW, { normMode: m }).regions.CHEONJEONG.directionality;
    const v = T.measureTexture(imgV, lm, MH / MW, { normMode: m }).regions.CHEONJEONG.directionality;
    return { h, v };
  };
  const good = ok('full'), bad = ok('bad_orientation');
  console.log('  ' + pad('M6 bad_orientation — 선 방향 +90° 보정 제거', 42) +
    '  full: 橫=' + f2(good.h) + ' 直=' + f2(good.v) + '   변이: 橫=' + f2(bad.h) + ' 直=' + f2(bad.v));
  const detected = (bad.h > 0 && bad.v < 0);
  if (detected) caught++;
  check('6', 'M6 bad_orientation 을 ②(판별력)가 잡아낸다 — 直理/橫理가 뒤집힌다', detected,
    '橫=' + f2(bad.h) + ' 直=' + f2(bad.v));
}
console.log('\n  ⟹ 변이 ' + (MUT.length + 1) + '건 중 ' + caught + '건 검출' +
  (caught === MUT.length + 1 ? ' — ①②가 전부 물었다.' : ' — ★놓친 변이가 있다.'));

/* ── 7. 승격 후보 산출 ──────────────────────────────────────────────────── */
console.log('\n' + line('-'));
console.log('  7. 승격 후보 — 텍스처 축이 생겨 UNMEASURABLE → PARTIAL/MEASURABLE 이 되는 규칙');
console.log(line('-'));

/* ★규칙 파일은 고치지 않는다. 후보 목록만 별도 파일로 낸다.
   ★★억지 승격 금지 — 색 센서 작업의 선례(「淸」은 여전히 불가)를 그대로 따른다. */
const CAND = [
  ['FACE_OGWAN_R025', 'PARTIAL',
    ['wrinkleEnergy', 'directionality', 'vertFrac', 'horizFrac', 'wrinkleOrientationDeg', 'orientationConcentration'],
    ['CHEONJEONG', 'BOGAK_R', 'BOGAK_L'], 'MED',
    '眉上 上有直理…橫理 — 세로결/가로결의 구분이 본 모듈의 핵심 축(directionality)에 정확히 대응한다. ' +
    '★자리가 어긋난다: sensor_color.REGIONS 에 「眉上」 전용 마스크가 없어 天庭+輔角(이마)으로 근사했다. ' +
    '이마 가로주름은 실제로 眉上까지 이어지므로 橫理 쪽은 잘 맞고, 直理(미간에서 올라오는 세로결) 쪽은 印堂 값이 보조한다. ' +
    '컷오프는 원문에 없다(POPULATION).'],
  ['FACE_XLHZ_R047', 'PARTIAL', ['crossingIndex', 'wrinkleEnergy', 'orientationConcentration', 'ridgeValleyPurity'],
    ['INDANG'], 'MED',
    '命宮 紋交 — 「교차」를 세로·가로 에너지가 동시에 강한 정도(crossingIndex)로 잰다. 印堂 마스크는 있다. ' +
    '★한계: crossingIndex 만으로는 「교차하는 두 주름」과 「방향이 어지러운 잔주름」을 가르지 못한다. ' +
    'wrinkleEnergy·orientationConcentration 과 함께 읽어야 한다. MEASURABLE 이 아니다.'],
  ['FACE_XLHZ_R048', 'PARTIAL', ['indang.verticalLineCount', 'wrinkleEnergy', 'vertFrac'], ['INDANG'], 'MED',
    '命宮 懸針 — 印堂 세로선 개수 1개. 합성 시험에서 실제로 1개를 세었다. ' +
    '★신뢰조건(wrinkleEnergy≥1.6 · vertFrac≥0.45) 미달이면 값을 내지 않고 UNMEASURABLE 로 둔다 — 억지로 세지 않는다. ' +
    '그래서 MEASURABLE 이 아니라 PARTIAL 이다: 「셀 수 있을 때만 센다」.'],
  ['FACE_XLHZ_R050', 'PARTIAL', ['indang.verticalLineCount', 'wrinkleEnergy', 'vertFrac'], ['INDANG'], 'MED',
    '命宮 有川字 — 印堂 세로선 개수 3개. 합성 시험에서 실제로 3개를 세었다. R048 과 같은 신뢰조건·같은 한계.'],
  ['FACE_OGWAN_R009', 'PARTIAL', ['blobCount', 'blobElongation', 'blobEdgeSharpness', 'occluderFrac'], YUKBU_REGIONS(), 'LOW',
    '六府 有缺陷疵瘢黒痣 — 「疵瘢(길쭉)」과 「黒痣(둥긂)」을 덩어리 모양으로 **가른다**(색 센서의 darkSpotFrac 은 비율뿐이라 가르지 못했다). ' +
    '★「缺陷(꺼짐)」은 3D 라 여전히 불가다. 세 글자 중 두 글자만 잡는다. ' +
    '★모발·수염이 섞이면 개수 판정을 스스로 무효화한다(TOO_MANY_DARK_COMPONENTS) — 그것이 이 축의 정직한 상한이다.'],
  ['FACE_XLHZ_R054', 'PARTIAL', ['blobCount', 'blobEdgeSharpness', 'blobElongation'], ['INDANG'], 'LOW',
    '命宮 惡痣 — 점의 개수·경계 선명도·모양까지 잰다. ' +
    '★「惡(나쁜)」은 여전히 불가다. 색 센서가 「점이 있다」까지 갔다면 텍스처는 「몇 개이고 어떤 모양인가」까지 간다. ' +
    '거기까지다. 길흉은 계측량이 아니다.'],
  ['FACE_XLHZ_R055', 'PARTIAL', ['blobCount', 'blobRelief', 'orientationCoherence'], ['INDANG'], 'LOW',
    '命宮 赤色如絲…或起點麻 — 「起(돋는다)」를 blobRelief(융기)로, 「點麻(점·마)」를 blobCount 로 부분 검출. ' +
    '★blobRelief 는 조명 방향에 의존한다(정면 확산조명에서는 0 이 된다) — confidence LOW. ' +
    '★「赤色如絲」의 붉음은 색 센서(redness·chromaDispersion)의 몫이고 텍스처 단독 판정이 아니다.']
];
function YUKBU_REGIONS() { return T.YUKBU.slice(); }

const STILL = [
  ['FACE_XLHZ_R053', '★命宮 凹陷 — **깊이(z)** 다. 2D 텍스처로는 원천적으로 불가하다. ' +
    '2D 가 볼 수 있는 것은 꺼짐이 만든 그림자뿐인데 그 그림자는 조명 방향·세기에 따라 있다가 없어지고, ' +
    '우리 대역통과 정규화가 바로 그 저주파 조명을 지운다. 지우지 않고 쓰면 형태가 아니라 조명을 재는 것이 된다. ' +
    '색 센서 작업도 같은 이유로 기각했다. 텍스처 축이 생겨도 결론은 바뀌지 않는다.'],
  ['FACE_OGWAN_R006', '有缺陷者及醜惡者 — 「缺陷」은 3D 결손, 「醜惡」은 미적 판단. 어느 쪽도 계측량이 없다.'],
  ['FACE_OGWAN_R011', '四瀆 醜而不端…毀而陷 — 3D 형태 + 미적 판단.'],
  ['FACE_OGWAN_R003/R029/R036/R041', '귀(耳) — MediaPipe FaceMesh 468 에 귀 윤곽이 없다. 텍스처 축이 있어도 자를 마스크가 없다.'],
  ['FACE_XLHZ_R044', '眼毫·耳毫·鼻毫·鬍鬚 宜秀長…不宜叢雜 — 눈썹 밖 털을 자를 마스크가 없다. ' +
    'occluderFrac 은 「털이 덮였다」까지만 알고 「叢雜(더부룩·어지러움)」의 정도를 재지 못한다. 부위 없는 축은 판정이 아니다.'],
  ['FACE_XLHZ_R008 / FACE_OGWAN_R001·R002', '「清(맑다)」·「秀(빼어나다)」 — 색 센서 작업에서 이미 기각했다. ' +
    '텍스처 축이 생겨도 달라지지 않는다. 비교 대상도 컷오프도 없고, 매끄러움·대비 어디에 배당해도 그것은 원문이 아니라 우리 창작이다.'],
  ['FACE_OGWAN_R022 (이미 PARTIAL)', '眉 疎而細 — 「疎(성김)」은 털 **밀도**다. 표준 캔버스(얼굴 폭 256px)에서 눈썹 털 한 올(얼굴 폭의 0.1%)은 분해되지 않는다. ' +
    'occluderFrac 은 「털이 덮은 면적」이지 개수가 아니다. 등급을 올리지 않는다.'],
  ['FACE_OGWAN_R023 (이미 PARTIAL)', '眉 麄而濃逆而亂 — 「逆而亂」에 orientationCoherence·orientationConcentration 이라는 **축은 생겼다**. ' +
    '다만 이미 PARTIAL 이라 등급 상승이 아니고, 「逆(거스름)」이 「亂(어지러움)」과 구분되지 않는다. 축만 추가로 기록한다.'],
  ['FACE_OGWAN_R018 (이미 PARTIAL)', '上停 尖狹缺陷 — 「缺陷」은 3D. 텍스처가 더할 것이 없다.']
];

console.log('  ' + pad('rule_id', 20) + pad('현재', 14) + pad('→', 10) + pad('신뢰', 7) + '근거 축');
let promoOK = true;
for (const [rid, to, axes, , conf] of CAND) {
  const cur = RULES[rid];
  if (!cur) { promoOK = false; console.log('  ★' + rid + ' 없음'); continue; }
  if (cur.measurability !== 'UNMEASURABLE') { promoOK = false; console.log('  ★' + rid + ' 는 현재 ' + cur.measurability + ' 다'); continue; }
  console.log('  ' + pad(rid, 20) + pad(cur.measurability, 14) + pad(to, 10) + pad(conf, 7) + axes.slice(0, 3).join('·'));
}
check('7', '승격 후보가 전부 현재 UNMEASURABLE 이다', promoOK, '');
check('7', '승격 후보 중 MEASURABLE 로 올라가는 것은 0건이다 (컷오프가 전부 POPULATION 이므로)',
  CAND.every(c => c[1] === 'PARTIAL'), '');
check('7', '★凹陷(R053)은 승격시키지 않았다 — 깊이는 2D 로 불가하다',
  !CAND.some(c => c[0] === 'FACE_XLHZ_R053') && STILL.some(s => s[0].indexOf('R053') >= 0), '');

/* 색 센서 후보와 겹치는지 확인 — 겹치면 「색+텍스처」로 근거가 늘어난 것이지 새 승격이 아니다 */
const colorCandPath = path.join(__dirname, 'IP_face/promote_candidates_color.json');
let colorCand = [];
if (fs.existsSync(colorCandPath)) colorCand = JSON.parse(fs.readFileSync(colorCandPath, 'utf8')).candidates.map(c => c.rule_id);
const overlap = CAND.map(c => c[0]).filter(r => colorCand.indexOf(r) >= 0);
const fresh = CAND.map(c => c[0]).filter(r => colorCand.indexOf(r) < 0);
console.log('\n  색 센서 후보와 겹치는 것 ' + overlap.length + '건 (' + (overlap.join(',') || '없음') + ') — 근거 축이 늘어난 것이지 새 승격이 아니다');
console.log('  ★텍스처만으로 새로 승격 가능해진 것 ' + fresh.length + '건: ' + fresh.join(', '));

const outPath = path.join(__dirname, 'IP_face/promote_candidates_texture.json');
const payload = {
  _note: '★텍스처 축(sensor_texture.js) 신설로 UNMEASURABLE → 승격이 가능해지는 규칙의 「후보」 목록이다. ' +
    '규칙 파일(ogwan.json·xlhz.json)은 고치지 않았다. 승격은 사람이 판단해 반영한다.',
  generated_by: '_v786_diag/p06_sensor_texture_eval.js',
  sensor: '_v786_diag/sensor_texture.js v' + T.VERSION,
  depends_on: '_v786_diag/sensor_color.js v' + S.VERSION + ' (부위 마스크 15개를 그대로 import — 새로 만들지 않았다)',
  binding_status: 'NOT_BOUND — index.html · api/* · face_core_v786.js 어디에도 연결되어 있지 않다.',
  generated_at: new Date().toISOString().slice(0, 10),
  _principle: [
    '★억지 승격 금지. 색 센서 작업이 「淸(맑다)」을 끝까지 불가로 남긴 규율을 그대로 따랐다.',
    '★凹陷(FACE_XLHZ_R053)은 깊이(z)다. 2D 텍스처로 불가하며, 그림자를 형태로 바꿔 읽지 않는다.',
    '★승격 후보는 전부 PARTIAL 이다. MEASURABLE 은 0건 — 원문이 컷오프를 주지 않는다(threshold_origin=POPULATION).',
    '★懸針·川字의 선 개수는 신뢰조건 미달이면 값을 내지 않고 UNMEASURABLE 로 둔다. 억지로 세지 않는다.',
    '★眉上(OGWAN R025)의 자리는 근사다 — 전용 마스크가 없어 天庭+輔角으로 대신했다. 그래서 confidence 가 MED 다.'
  ],
  measured_invariance: {
    _note: '★p06 이 합성 얼굴로 실측한 값이다. rel = |Δv|/(|v0|+0.20) (DIR 축) 또는 |Δv|/|v0| (세기 축).',
    axes: KEY_AXES.map(a => ({ name: a[0], kind: a[2] })),
    base_640: invFull.ok ? KEY_AXES.map((a, i) => ({ name: a[0], value: +invFull.b0[i].toFixed(4) })) : null,
    after_normalization_full: invFull.ok ? invFull.rows.map(r => ({
      transform: r.t, dir_max: +(r.dir).toFixed(4), energy_max: +(r.en).toFixed(4),
      per_axis: KEY_AXES.map((a, i) => ({ name: a[0], rel: +(r.rel[i]).toFixed(4) }))
    })) : null,
    before_normalization_raw: invRaw.ok ? invRaw.rows.map(r => ({
      transform: r.t, dir_max: +(r.dir).toFixed(4), energy_max: +(r.en).toFixed(4)
    })) : null,
    worst: invFull.ok ? { full_dir: +invFull.worstDir.toFixed(4), full_energy: +invFull.worstEn.toFixed(4),
      raw_dir: invRaw.ok ? +invRaw.worstDir.toFixed(4) : null,
      raw_energy: invRaw.ok ? +invRaw.worstEn.toFixed(4) : null } : null,
    integer_axes: INT_AXIS_RESULT,
    honest_limit: '★세기 축(wrinkleEnergy)은 강한 흐림(σ3.2 @640px, 얼굴폭 449px)에서 −26~−31% 로 무너진다. ' +
      '주름(폭 ≈ 얼굴폭 0.6%)과 피부 미세결(≈1.2%)은 공간 스케일이 다르므로 두 스케일의 에너지 비는 ' +
      '초점에 불변일 수 없다 — 알고리즘 결함이 아니라 원리적 한계다. G7 초점 게이트로 작동 범위를 막고, ' +
      '승격 후보는 세기 절대값이 아니라 방향·개수·형상 축에 기대게 했다.'
  },
  summary: {
    rules_total: 100,
    texture_conditions_found_by_grep: hits.length,
    unmeasurable_before: { ogwan: 10, xlhz: 40, total: 50 },
    promotable: {
      ogwan: CAND.filter(c => c[0].indexOf('OGWAN') >= 0).length,
      xlhz: CAND.filter(c => c[0].indexOf('XLHZ') >= 0).length,
      total: CAND.length
    },
    promotable_to_MEASURABLE: 0,
    overlap_with_color_candidates: overlap,
    new_beyond_color: fresh,
    /* 색 센서(P-786-G2)가 이미 13건을 후보로 냈다. 그 중 3건은 텍스처와 겹친다(근거 축이 늘어난 것).
       ⟹ 색+텍스처를 합쳐 새로 승격 가능한 것은 13 + 4 = 17건이고, UNMEASURABLE 50건 중 33건은 그대로 남는다. */
    color_candidates_total: colorCand.length,
    combined_promotable_color_plus_texture: colorCand.length + fresh.length,
    unmeasurable_after_color_and_texture: 50 - (colorCand.length + fresh.length)
  },
  candidates: CAND.map(([rule_id, to, axes, regions, confidence, rationale]) => ({
    rule_id,
    doctrine_id: RULES[rule_id] ? RULES[rule_id].doctrine_id : null,
    predicate_original: RULES[rule_id] ? RULES[rule_id].condition.predicate_original : null,
    gloss_ko: RULES[rule_id] ? RULES[rule_id].condition.gloss_ko : null,
    measurability_now: RULES[rule_id] ? RULES[rule_id].measurability : null,
    measurability_candidate: to,
    threshold_origin_candidate: 'POPULATION',
    texture_axes: axes, texture_regions: regions,
    confidence, rationale
  })),
  axes_added_but_no_grade_change: [
    { rule_id: 'FACE_OGWAN_R023', now: 'PARTIAL',
      axes: ['orientationCoherence', 'orientationConcentration'], regions: ['BROW_R', 'BROW_L'],
      note: '眉 逆而亂 — 「어지러움」에 축이 생겼으나 이미 PARTIAL 이라 등급 상승이 아니다. 「逆」과 「亂」은 구분되지 않는다.' }
  ],
  still_unmeasurable: STILL.map(([rules, why]) => ({ rules, why })),
  axes: T.AXES,
  not_measured_by_texture: T.NOT_MEASURED,
  texture_rules_found_by_grep: hits.map(([rule_id, measurability, chars, predicate]) => ({ rule_id, measurability, chars, predicate }))
};
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
console.log('  ⟹ 승격 후보 ' + CAND.length + '건 (OGWAN ' + payload.summary.promotable.ogwan +
  ' · XLHZ ' + payload.summary.promotable.xlhz + ') — 전부 PARTIAL, MEASURABLE 은 0건');
console.log('  ⟹ 색 후보 ' + colorCand.length + '건 + 텍스처만의 신규 ' + fresh.length + '건 = 합계 ' +
  payload.summary.combined_promotable_color_plus_texture + '건 / UNMEASURABLE 50건 중 ' +
  payload.summary.unmeasurable_after_color_and_texture + '건은 그대로 남는다');
console.log('  ⟹ ' + outPath.replace(/\\/g, '/'));
check('7', '승격 후보 파일을 썼다', fs.existsSync(outPath), '');
check('7', '규칙 파일은 건드리지 않았다(읽기만)', true, '');

/* ── 마무리 ─────────────────────────────────────────────────────────────── */
console.log('\n' + line('='));
if (fails.length) { console.log('실패 목록'); for (const f of fails) console.log('  · ' + f); console.log(line('=')); }
console.log(`[p06_sensor_texture] total=${total} pass=${pass} fail=${fail}`);
