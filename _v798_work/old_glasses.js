// v797 현행 _cwGlassesScore 원문 사본(비교용)
var CW_GLASSES_T = { peak: 1.85, max: 10 };
function _cwGlassesScore(gray, w, h, ai) {
  if (!gray || !ai || ai.length < 468 || !(w > 0) || !(h > 0)) return null;
  var X = function (i) { return ai[i].x * w; }, Y = function (i) { return ai[i].y * h; };
  var ex = Math.abs(X(362) - X(133));
  if (!(ex >= 8)) return null;
  var s = ex / 64, cx = (X(133) + X(362)) / 2, y0 = Y(168) - 0.3 * ex, y1 = Y(6) + 0.2 * ex;
  var smp = function (x, y) {
    var t = 0, d = s / 2, k, xs = [x - d, x + d, x - d, x + d], ys = [y - d, y - d, y + d, y + d];
    for (k = 0; k < 4; k++) {
      var xx = Math.max(0, Math.min(w - 1.001, xs[k])), yy = Math.max(0, Math.min(h - 1.001, ys[k]));
      var x0 = Math.floor(xx), y0b = Math.floor(yy), fx = xx - x0, fy = yy - y0b, i = y0b * w + x0;
      t += (gray[i] * (1 - fx) + gray[i + 1] * fx) * (1 - fy) + (gray[i + w] * (1 - fx) + gray[i + w + 1] * fx) * fy;
    }
    return t / 4;
  };
  var cols = [], c, prev = null, prof = [], y;
  for (c = cx - 0.15 * ex; c <= cx + 0.15 * ex + 1e-9; c += s) cols.push(c);
  for (y = y0; y <= y1 + 1e-9; y += s) {
    var row = [];
    for (c = 0; c < cols.length; c++) row.push(smp(cols[c], y));
    if (prev) { var a = 0; for (c = 0; c < row.length; c++) a += Math.abs(row[c] - prev[c]); prof.push(a / row.length); }
    prev = row;
  }
  if (prof.length < 5) return null;
  var srt = prof.slice().sort(function (p, q) { return p - q; }), n = srt.length;
  var med = n % 2 ? srt[(n - 1) >> 1] : (srt[n / 2 - 1] + srt[n / 2]) / 2, mx = srt[n - 1];
  var peak = mx / (med + 1);
  return { peak: peak, max: mx, glasses: peak >= CW_GLASSES_T.peak && mx >= CW_GLASSES_T.max };
}
module.exports={_cwGlassesScore};
