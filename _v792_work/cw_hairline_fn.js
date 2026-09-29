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
