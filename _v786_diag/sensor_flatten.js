/* ============================================================================
   천운 v787 · 센서 출력 평탄화 + 센서 축 레지스트리 — sensor_flatten.js   (P-786-I)
   ---------------------------------------------------------------------------
   ★정본은 이 파일(_v786_diag/sensor_flatten.js)이다. js/sensor_flatten.js 는
     p09_bind_sensors.js 가 바이트 동일하게 복사한 배포 사본이다. 사본을 고치지 마라.

   왜 있는가
     api/_engine/facever.js 는 축 이름과 무관하게 `measures[axis]` 한 값만 읽는다.
     sensor_color.measureColor / sensor_texture.measureTexture 의 출력은 중첩 객체
     (regions.INDANG.lightness · eye.scleraLightness · indang.count …)라서
     그대로는 규칙의 measure_axis 가 될 수 없다.
     ⟹ 여기서 **평탄 키**로 편다. 규칙 JSON · compile_face_rules.js · facever.js ·
        index.html 이 전부 이 파일의 SENSOR_AXES 를 축 정본으로 삼는다.

   ★키 규약 (compile_face_rules.js 의 축 정규식 /[A-Za-z][A-Za-z0-9_]* / 를 지킨다 — 점 금지)
     col_<REGION>_<axis>          색 부위축   예) col_INDANG_lightness
     col_eye_<axis>               흰자·홍채   예) col_eye_scleraLightness
     col_abs_<axis>               ABS(흰자 기준) 예) col_abs_skinRedVsSclera   ★confidence LOW
     col_grp_<GROUP>_<axis>_<agg> 묶음 요약   예) col_grp_OAK_lightness_min
     tex_<REGION>_<axis>          텍스처 부위축 예) tex_CHEONJEONG_directionality
     tex_<REGION>_blob_<axis>     덩어리      예) tex_INDANG_blob_count
     tex_indang_verticalLineCount 印堂 세로선 개수 (懸針 1 · 川字 3)
     tex_grp_<GROUP>_<axis>_<agg> 묶음 요약

   ★fail-closed 규약
     · 센서가 ok=false 면 축을 **하나도** 내지 않는다 (reject 사유만 meta 에 남긴다).
     · 부위가 null(화면 밖·너무 작음)이면 그 부위의 축은 **키 자체를 만들지 않는다**.
     · 텍스처 부위가 textureReliable=false(모발·수염·안경테)면 그 부위의 텍스처 축을 내지 않는다.
       (occluderFrac·darkFrac 도 내지 않는다 — 「왜 못 냈나」는 meta.unreliableRegions 로 간다.)
     · 값이 유한한 number 가 아니면 키를 만들지 않는다. null 을 싣지 않는다.
     · ★랜드마크 30축과 키가 겹치면 안 된다 — 접두사 col_/tex_ 로 원천 차단하고,
       facever.evaluateFace 가 충돌 시 센서 쪽을 통째로 버린다.

   ★랭크(분위수)는 만들지 않는다
     센서 축에는 참조 모집단(CW_FACE_REF 같은 분위수표)이 **없다**.
     ⟹ ranks 에 센서 축이 없으므로 space=rank 조건식은 facever 에서 NO_MEASURE 로 떨어진다.
     ⟹ 센서 축 규칙은 결속 후에도 **REFERENCE(참고)** 까지만 간다. 이것이 정직한 상한이다.
        (p08 I-8 이 이 성질을 검사한다 — 센서 축 규칙이 어떤 tier 에서도 ranks 없이 VERDICT 가 되면 FAIL)
   ========================================================================== */

'use strict';

var SENSOR_FLATTEN_VERSION = '1.0.0';

/* ── 색 센서 축 (sensor_color.js AXES 와 1:1) ── */
var COLOR_REGION_AXES = ['lightness', 'redness', 'yellowness', 'gloss', 'chromaDispersion', 'darkSpotFrac'];
var COLOR_EYE_AXES = ['scleraLightness', 'irisDarkness', 'irisScleraContrast', 'scleraYellow'];
var COLOR_ABS_AXES = ['skinRedVsSclera', 'skinYellowVsSclera', 'skinLightVsSclera'];
var COLOR_GROUPS = { YUKBU_gloss: 'gloss', YUKBU_darkSpot: 'darkSpotFrac', OAK_lightness: 'lightness' };
var GROUP_AGGS = ['mean', 'min', 'max'];

/* ── 텍스처 센서 축 (sensor_texture.js AXES 와 1:1) ── */
var TEX_REGION_AXES = ['wrinkleEnergy', 'wrinkleOrientationDeg', 'orientationCoherence', 'orientationConcentration',
  'vertFrac', 'horizFrac', 'directionality', 'crossingIndex', 'ridgeValleyPurity', 'chromaEdgeRatio',
  'occluderFrac', 'darkFrac'];
var TEX_BLOB_AXES = { count: 'count', elongation: 'meanElongation', edgeSharpness: 'meanEdgeSharpness', relief: 'maxRelief' };
var TEX_GROUPS = { FOREHEAD_directionality: 'directionality', FOREHEAD_wrinkleEnergy: 'wrinkleEnergy',
  YUKBU_occluderFrac: 'occluderFrac', BROW_coherence: 'orientationCoherence' };

/* 부위 목록은 센서 모듈에서 읽는다 — 여기서 다시 적지 않는다(두 벌 드리프트 방지) */
function _colorRegions(COLOR) { return Object.keys(COLOR.REGIONS); }
function _texRegions(TEX) { return Object.keys(TEX.TEXTURE_REGIONS); }

function _fin(v) { return typeof v === 'number' && isFinite(v); }

/**
 * 센서 축 레지스트리 — 컴파일러·게이트가 「이 축이 실재하는가」를 대조하는 정본.
 * @returns {Array<{axis:string, sensor:'color'|'texture', kind:string, confidence?:string, what:string}>}
 */
function buildRegistry(COLOR, TEX) {
  var out = [];
  var kindOf = function (list, ax) {
    for (var i = 0; i < list.length; i++) if (list[i].axis === ax || list[i].axis === 'abs.' + ax || list[i].axis === 'indang.' + ax) return list[i];
    return null;
  };
  var cr = _colorRegions(COLOR), tr = _texRegions(TEX), i, j, rn, ax, d;
  for (i = 0; i < cr.length; i++) {
    rn = cr[i];
    for (j = 0; j < COLOR_REGION_AXES.length; j++) {
      ax = COLOR_REGION_AXES[j]; d = kindOf(COLOR.AXES, ax);
      out.push({ axis: 'col_' + rn + '_' + ax, sensor: 'color', region: rn, base: ax, kind: d ? d.kind : 'REL',
        what: (COLOR.REGIONS[rn].ko || rn) + ' · ' + (d ? d.what : ax) });
    }
  }
  for (j = 0; j < COLOR_EYE_AXES.length; j++) {
    ax = COLOR_EYE_AXES[j]; d = kindOf(COLOR.AXES, ax);
    out.push({ axis: 'col_eye_' + ax, sensor: 'color', region: 'EYE', base: ax, kind: d ? d.kind : 'REL', what: d ? d.what : ax });
  }
  for (j = 0; j < COLOR_ABS_AXES.length; j++) {
    ax = COLOR_ABS_AXES[j]; d = kindOf(COLOR.AXES, ax);
    out.push({ axis: 'col_abs_' + ax, sensor: 'color', region: 'SKIN', base: ax, kind: 'ABS', confidence: 'LOW',
      what: d ? d.what : ax });
  }
  for (var g in COLOR_GROUPS) for (j = 0; j < GROUP_AGGS.length; j++) {
    out.push({ axis: 'col_grp_' + g + '_' + GROUP_AGGS[j], sensor: 'color', region: g.split('_')[0], base: COLOR_GROUPS[g],
      kind: 'REL', what: '묶음 ' + g + ' 의 ' + GROUP_AGGS[j] });
  }
  for (i = 0; i < tr.length; i++) {
    rn = tr[i];
    for (j = 0; j < TEX_REGION_AXES.length; j++) {
      ax = TEX_REGION_AXES[j]; d = kindOf(TEX.AXES, ax);
      out.push({ axis: 'tex_' + rn + '_' + ax, sensor: 'texture', region: rn, base: ax, kind: d ? d.kind : 'REL',
        what: (TEX.TEXTURE_REGIONS[rn].ko || rn) + ' · ' + (d ? d.what : ax) });
    }
    if (!TEX.TEXTURE_REGIONS[rn].hairIsSignal) {
      for (var b in TEX_BLOB_AXES) {
        d = kindOf(TEX.AXES, 'blob' + b.charAt(0).toUpperCase() + b.slice(1));
        out.push({ axis: 'tex_' + rn + '_blob_' + b, sensor: 'texture', region: rn, base: 'blob.' + TEX_BLOB_AXES[b],
          kind: b === 'count' ? 'COUNT' : 'REL', confidence: b === 'relief' ? 'LOW' : undefined,
          what: (TEX.TEXTURE_REGIONS[rn].ko || rn) + ' · 덩어리 ' + b });
      }
    }
  }
  out.push({ axis: 'tex_indang_verticalLineCount', sensor: 'texture', region: 'INDANG', base: 'indang.count', kind: 'COUNT',
    what: '印堂 세로선 개수 (懸針 1 · 川字 3). 신뢰조건 미달이면 값을 내지 않는다' });
  for (var tg in TEX_GROUPS) for (j = 0; j < GROUP_AGGS.length; j++) {
    out.push({ axis: 'tex_grp_' + tg + '_' + GROUP_AGGS[j], sensor: 'texture', region: tg.split('_')[0], base: TEX_GROUPS[tg],
      kind: 'REL', what: '묶음 ' + tg + ' 의 ' + GROUP_AGGS[j] });
  }
  out.push({ axis: 'tex_grp_YUKBU_blobCount_total', sensor: 'texture', region: 'YUKBU', base: 'blob.count', kind: 'COUNT',
    what: '六府 여섯 부위 덩어리 개수 합 (신뢰 불가 부위가 하나라도 있으면 내지 않는다)' });
  return out;
}

/**
 * 평탄화 — 두 센서 결과를 { measures, meta } 로 편다.
 * @param {object} color   sensor_color.measureColor 결과 (또는 null)
 * @param {object} texture sensor_texture.measureTexture 결과 (또는 null)
 */
function flattenSensors(color, texture) {
  var m = {}, meta = {
    version: SENSOR_FLATTEN_VERSION,
    color: { ran: !!color, ok: !!(color && color.ok), reject: (color && color.reject) || null,
      version: color && color.meta ? color.meta.version : null, rejectedRegions: (color && color.meta && color.meta.rejectedRegions) || [] },
    texture: { ran: !!texture, ok: !!(texture && texture.ok), reject: (texture && texture.reject) || null,
      version: texture && texture.meta ? texture.meta.version : null, rejectedRegions: (texture && texture.meta && texture.meta.rejectedRegions) || [],
      unreliableRegions: [], indangStatus: null, indangReason: null, focusScore: texture && texture.meta ? texture.meta.focusScore : null },
    axesEmitted: 0
  };
  var put = function (k, v) { if (_fin(v)) { m[k] = v; meta.axesEmitted++; } };
  var rn, j, ax, r;

  if (color && color.ok) {
    for (rn in color.regions) {
      r = color.regions[rn]; if (!r) continue;
      for (j = 0; j < COLOR_REGION_AXES.length; j++) { ax = COLOR_REGION_AXES[j]; put('col_' + rn + '_' + ax, r[ax]); }
    }
    if (color.eye) for (j = 0; j < COLOR_EYE_AXES.length; j++) { ax = COLOR_EYE_AXES[j]; put('col_eye_' + ax, color.eye[ax]); }
    if (color.abs) for (j = 0; j < COLOR_ABS_AXES.length; j++) { ax = COLOR_ABS_AXES[j]; put('col_abs_' + ax, color.abs[ax]); }
    if (color.groups) for (var g in COLOR_GROUPS) {
      var gv = color.groups[g]; if (!gv) continue;
      for (j = 0; j < GROUP_AGGS.length; j++) put('col_grp_' + g + '_' + GROUP_AGGS[j], gv[GROUP_AGGS[j]]);
    }
  }

  if (texture && texture.ok) {
    for (rn in texture.regions) {
      r = texture.regions[rn]; if (!r) continue;
      if (r.textureReliable === false) { meta.texture.unreliableRegions.push(rn + ':' + (r.unreliableReason || 'UNRELIABLE')); continue; }
      for (j = 0; j < TEX_REGION_AXES.length; j++) { ax = TEX_REGION_AXES[j]; put('tex_' + rn + '_' + ax, r[ax]); }
      if (r.blobs && r.blobs.reliable === true) {
        for (var b in TEX_BLOB_AXES) put('tex_' + rn + '_blob_' + b, r.blobs[TEX_BLOB_AXES[b]]);
      }
    }
    if (texture.indang) {
      meta.texture.indangStatus = texture.indang.status || null;
      meta.texture.indangReason = texture.indang.reason || null;
      if (texture.indang.status === 'MEASURED') put('tex_indang_verticalLineCount', texture.indang.count);
    }
    if (texture.groups) {
      for (var tg in TEX_GROUPS) {
        var tv = texture.groups[tg]; if (!tv) continue;
        for (j = 0; j < GROUP_AGGS.length; j++) put('tex_grp_' + tg + '_' + GROUP_AGGS[j], tv[GROUP_AGGS[j]]);
      }
      var bc = texture.groups.YUKBU_blobCount;
      if (bc && bc.unreliableRegions === 0 && bc.regions > 0) put('tex_grp_YUKBU_blobCount_total', bc.total);
    }
  }
  return { measures: m, meta: meta };
}

var _api = {
  flattenSensors: flattenSensors,
  buildRegistry: buildRegistry,
  VERSION: SENSOR_FLATTEN_VERSION,
  COLOR_REGION_AXES: COLOR_REGION_AXES, COLOR_EYE_AXES: COLOR_EYE_AXES, COLOR_ABS_AXES: COLOR_ABS_AXES,
  TEX_REGION_AXES: TEX_REGION_AXES, TEX_BLOB_AXES: TEX_BLOB_AXES, GROUP_AGGS: GROUP_AGGS
};

if (typeof module !== 'undefined' && module.exports) module.exports = _api;
if (typeof window !== 'undefined') window.CW_SENSOR_FLATTEN = _api;
