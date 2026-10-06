/* ★v798 P-798-A — 안경 감지 v2(학습형 · 엔진 내 계산)
   정렬 패치: 두 눈 안쪽(133·362) 축으로 회전 정렬 · ex(안쪽 눈 간격)로 크기 정규화 → 52×24 격자(간격 ex/16)
     가로 ±1.6ex(양쪽 렌즈 테 포함) · 세로 −0.7ex(눈썹)~+0.8ex(아래 테)
   특징: HOG(4×4 셀 · 9방향 · 2×2 블록 L2-Hys) 12×5 블록 × 36 = 2160 차원
   판정: 로지스틱 회귀 p = σ(b + w·f) ≥ CW_GLASSES_T.p  (가중치 CW_GLASSES_W · 학습 _v798_work/t01) */
var CW_GLASSES_BSTRIDE = (typeof process!=='undefined'&&process.env&&process.env.BSTRIDE)?+process.env.BSTRIDE:1;
var CW_GLASSES_PW = 52, CW_GLASSES_PH = 24, CW_GLASSES_CELL = 4, CW_GLASSES_BINS = 9;
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
function _cwGlassesHog(P) {
  var PW = CW_GLASSES_PW, PH = CW_GLASSES_PH, CS = CW_GLASSES_CELL, NB = CW_GLASSES_BINS;
  var CX = PW / CS | 0, CY = PH / CS | 0, H = new Float32Array(CX * CY * NB), i, j;
  for (j = 0; j < PH; j++) for (i = 0; i < PW; i++) {
    var gx = P[j * PW + Math.min(PW - 1, i + 1)] - P[j * PW + Math.max(0, i - 1)];
    var gy = P[Math.min(PH - 1, j + 1) * PW + i] - P[Math.max(0, j - 1) * PW + i];
    var m = Math.sqrt(gx * gx + gy * gy); if (!(m > 0)) continue;
    var a = Math.atan2(gy, gx); if (a < 0) a += Math.PI; if (a >= Math.PI) a -= Math.PI;
    var fb = a / Math.PI * NB - 0.5, b0 = Math.floor(fb), fr = fb - b0, b1 = b0 + 1;
    b0 = (b0 + NB) % NB; b1 = b1 % NB;
    var cell = ((j / CS | 0) * CX + (i / CS | 0)) * NB;
    H[cell + b0] += m * (1 - fr); H[cell + b1] += m * fr;
  }
  var BS = CW_GLASSES_BSTRIDE, BX = Math.floor((CX - 2) / BS) + 1, BY = Math.floor((CY - 2) / BS) + 1, F = new Float32Array(BX * BY * 4 * NB), o = 0;
  for (var by0 = 0; by0 < BY; by0++) for (var bx0 = 0; bx0 < BX; bx0++) { var by = by0 * BS, bx = bx0 * BS;
    var st = o, k, n = 0, dy, dx;
    for (dy = 0; dy < 2; dy++) for (dx = 0; dx < 2; dx++) { var cb = ((by + dy) * CX + bx + dx) * NB; for (k = 0; k < NB; k++) F[o++] = H[cb + k]; }
    for (k = st; k < o; k++) n += F[k] * F[k]; n = Math.sqrt(n + 1e-6);
    var n2 = 0; for (k = st; k < o; k++) { F[k] = Math.min(0.2, F[k] / n); n2 += F[k] * F[k]; }
    n2 = Math.sqrt(n2 + 1e-6); for (k = st; k < o; k++) F[k] /= n2;
  }
  return F;
}
if (typeof module !== 'undefined') module.exports = { _cwGlassesPatch: _cwGlassesPatch, _cwGlassesHog: _cwGlassesHog };
