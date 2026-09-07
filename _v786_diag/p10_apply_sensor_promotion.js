// 천운 v787 · P-786-I — 센서 결속에 따른 규칙 재판정 적용기  (p10_apply_sensor_promotion.js)
// ═══════════════════════════════════════════════════════════════════════════
// 【무엇을 하는가】
//   색·텍스처 센서가 **결속된** 뒤(p09 20/20) IP 규칙 17건의 등급·축·커버리지를 아래 표대로 고쳐 쓴다.
//   ★표는 사람이 판단한 것이다(승격 후보 파일 promote_candidates_{color,texture}.json 을 근거로,
//     p07 의 T-5(귀)·T-6(清) 금지와 p08 H-2(FULL 금지 계열)를 지켜서). 코드가 등급을 추론하지 않는다.
//   ★멱등이다 — 두 번 돌려도 같은 결과. 표에 없는 규칙은 손대지 않는다.
//
// 【판정 원칙 — 틀린 FULL 이 0건인 것이 FULL 이 몇 건인가보다 중요하다】
//   FULL    원문 조건의 모든 어절을 센서 축이 덮는다.  ⟹ R046(要明潤) · R049(不宜昏暗) · R051(光明如鏡)
//                                                     · R048(懸針, BLOCKED) · R050(有川字)
//   PARTIAL 다음 중 하나라도 해당하면 FULL 로 올리지 않는다:
//     · ABS(흰자 기준) 축이 조건을 떠받친다 — 흰자는 완전한 중성이 아니다(sensor_color.js 주석) → R003·R016·R019·R024·R026
//     · 조건 어절에 3D(缺陷·平滿)·氣·거동·몸통이 남는다 → R009·R016·R026·R038
//     · 인용문에 耳 가 있다(p07 T-5b) → R027·R038
//     · 부위 마스크가 원문 자리와 어긋난다(眉上 ≠ 天庭·輔角) → R025
//     · 「惡」·「如絲」처럼 계측량이 아닌 어절이 남는다 → R054·R055
//     · 축 하나가 두 현상(교차 vs 어지러움)을 가르지 못한다 → R047
//   measurability 는 전부 PARTIAL 이다 — MEASURABLE 은 0건.
//     ★R048·R050(개수 축 · 컷오프는 원문 「懸針 1 · 川 3」) 은 원리상 MEASURABLE 후보지만,
//       센서가 **실사진 검증 0건**(p06 은 합성)이라 보류한다. 승격 요건은 notes 에 적었다.
//
// 【실행】 node _v786_diag/p10_apply_sensor_promotion.js
//         그 뒤 반드시: node _v786_diag/compile_face_rules.js → p04 · p07 · p08 · p09
'use strict';
const fs = require('fs');
const path = require('path');
const IP = path.join(__dirname, 'IP_face', 'rules', 'face');
const S = require('./sensor_color.js'), T = require('./sensor_texture.js'), F = require('./sensor_flatten.js');
const REG = new Set(F.buildRegistry(S, T).map((a) => a.axis));

const BOUND = 'BOUND(v787 · P-786-I) — 색·텍스처 센서 축(col_*/tex_*)이 index.html → api/fortune.js → api/_engine/facever.js 에 결속됐다. ' +
  '★센서 축에는 참조 모집단(분위수)이 없어 ranks 가 비므로, 센서 축 규칙은 결속 후에도 REFERENCE(참고)까지만 간다. ' +
  '판정(VERDICT)은 ①ADR-FACE-001 결재 ②센서 축 모집단(TIER-A/B) 확보 뒤에만 켜진다. 게이트: p09 M-6 · p08 I-8.';

// ── 재판정 표 ─────────────────────────────────────────────────────────────────
// axes: 첫 항목이 measure_axis. cov: condition_coverage. covered/uncovered: coverage_note.
const TABLE = {
  // ── 색 ──
  FACE_OGWAN_R009: { axes: ['col_grp_YUKBU_darkSpot_max', 'tex_grp_YUKBU_blobCount_total'], cov: 'PARTIAL', origin: 'POPULATION',
    covered: ['검은 점(비율·개수)'], uncovered: ['결함(꺼짐 — 3D)', '흉터(덩어리 형상은 재나 흉터 여부는 못 가른다)'],
    basis: '육부 여섯 부위의 검은점 비율 최대값(색)과 덩어리 개수 합(텍스처)을 잰다. 결함은 깊이라 2D 에서 불가. 흉터은 blobElongation 으로 길쭉함까지만 본다.',
    operational: 'col_grp_YUKBU_darkSpot_max · tex_grp_YUKBU_blobCount_total. ★「缺陷」은 3D 라 불가, 「疵瘢」은 길쭉함까지만.',
    // ★판정문이 「㐫也(흉하다)」다 — 점·흉터를 두고 사용자 얼굴을 흉하다고 말하는 규칙이다. R011·R054 와 같은 이유로 노출 차단.
    //   p08 D-4(醜惡 계열 미노출)가 실제로 잡았다. 축은 붙이되(계측은 한다) 사용자에겐 내보내지 않는다.
    block: '판정문 「㐫也(흉하다)」 — 점·흉터로 사용자 얼굴을 흉하다고 판정하는 문언. R011·R054 와 동일 사유로 노출 차단(v787).' },
  FACE_OGWAN_R027: { axes: ['col_eye_irisScleraContrast', 'col_eye_scleraLightness', 'col_eye_irisDarkness'], cov: 'PARTIAL', origin: 'POPULATION',
    covered: ['흰자 밝기', '검은자 어둡기', '흑백 대비'], uncovered: ['솟은 귀가 귀밑머리에 든다(인용문의 같은 조건절 — 귀 조건)'],
    basis: '「흰자 옥 · 검은자 옻」은 흰자·홍채 축 3개로 덮인다. 그러나 인용문이 「솟은 귀가 귀밑머리에 든다」을 같은 조건절로 잇고 있어 귀 없이는 FULL 이 아니다(p07 T-5b).',
    operational: 'col_eye_scleraLightness · col_eye_irisDarkness · col_eye_irisScleraContrast (refineLandmarks 478점의 홍채 고리). ★귀 조건은 잴 수 없다.' },
  FACE_OGWAN_R038: { axes: ['col_MYEONGMUN_R_gloss', 'col_MYEONGMUN_L_gloss', 'col_MYEONGMUN_R_lightness', 'col_MYEONGMUN_L_lightness'], cov: 'PARTIAL', origin: 'POPULATION',
    covered: ['빛남(광)', '맑음(영 — 광택으로 근사)'], uncovered: ['평평함(3D)', '그득함(3D)', '부위 위치의 정확성(귀 기준 정의 → 얼굴 윤곽 127/356/454 로 근사)'],
    basis: '이문지전(귀 앞) 을 FaceMesh 윤곽점으로 근사한 마스크(MYEONGMUN)에서 광택·밝기를 잰다. 위치가 근사이고 평만 은 깊이라 FULL 불가.',
    operational: 'col_MYEONGMUN_{R,L}_gloss · _lightness. ★자리는 귀 기준 근사, 平滿 은 불가.' },
  FACE_XLHZ_R003: { axes: ['col_abs_skinLightVsSclera'], cov: 'PARTIAL', origin: 'POPULATION',
    covered: ['색이 흼(흰자 기준 · confidence LOW)'], uncovered: ['기가 굳셈(기 — 계측량 아님)'],
    basis: '「색백」은 흰자를 화이트 레퍼런스로 삼은 ABS 축으로만 잡힌다. 흰자는 완전한 중성이 아니므로 LOW. 「기강」은 남는다.',
    operational: 'col_abs_skinLightVsSclera (0 에 가까울수록 희다). ★ABS 계열은 PARTIAL 을 넘지 않는다.' },
  FACE_XLHZ_R016: { axes: ['col_abs_skinRedVsSclera', 'col_grp_OAK_lightness_mean', 'col_GWAN_R_gloss', 'col_GWAN_L_gloss'], cov: 'PARTIAL', origin: 'POPULATION',
    covered: ['색이 붉음(흰자 기준 · LOW)', '마름(고 — 광택 낮음)'], uncovered: ['기(기운 — 기운은 계측량이 아니다)'],
    basis: '「색적」은 ABS 붉은기, 「고」는 관골 광택의 낮은 값. 「기」는 색이 아니다.',
    operational: 'col_abs_skinRedVsSclera · col_GWAN_{R,L}_gloss(낮음=枯). ★氣 는 불가.' },
  FACE_XLHZ_R019: { axes: ['col_abs_skinRedVsSclera', 'col_GWAN_R_gloss', 'col_GWAN_L_gloss'], cov: 'PARTIAL', origin: 'POPULATION',
    covered: ['붉게 핌(흰자 기준 · LOW)', '메마르지 않음·윤택함(광택)'], uncovered: ['ABS 붉은기의 신뢰도(흰자 기준이라 LOW — 어절은 덮였으나 축이 조건을 떠받치기에 약하다)'],
    basis: '어절은 전부 대응 축이 있으나 「발홍」이 ABS(흰자 기준) 축에 기대므로 FULL 로 올리지 않는다(sensor_color.js: ABS 계열은 PARTIAL 상한).',
    operational: 'col_abs_skinRedVsSclera · col_GWAN_{R,L}_gloss. ★ABS 상한 PARTIAL.' },
  FACE_XLHZ_R024: { axes: ['col_abs_skinYellowVsSclera'], cov: 'PARTIAL', origin: 'POPULATION',
    covered: ['색이 누름(흰자 기준 · LOW)'], uncovered: ['ABS 누런기의 신뢰도(흰자까지 함께 누레지는 황달·유색 조명과 구분 불가 — p05 실측 한계)'],
    basis: '「색황」 한 어절이고 축은 있으나 흰자 기준 ABS 라 PARTIAL 상한. 전역 색이동과 원리상 구분 못 한다.',
    operational: 'col_abs_skinYellowVsSclera. ★ABS 상한 PARTIAL.' },
  FACE_XLHZ_R026: { axes: ['col_abs_skinRedVsSclera', 'col_GWAN_R_gloss', 'col_GWAN_L_gloss'], cov: 'PARTIAL', origin: 'POPULATION',
    covered: ['색이 붉고 윤택함(LOW)', '마르지 않음(광택)'], uncovered: ['두텁고 무거움', '살짐(육비)', '흐르지도 막히지도 않음', '순정', '거동(활동)'],
    basis: '색·광택 어절만 덮인다. 부피·거동 어절이 다수 남는다.',
    operational: 'col_abs_skinRedVsSclera · col_GWAN_{R,L}_gloss 만. 나머지는 불가.' },
  FACE_XLHZ_R046: { axes: ['col_INDANG_lightness', 'col_INDANG_gloss'], cov: 'FULL', origin: 'POPULATION',
    covered: ['밝음(명) — col_INDANG_lightness', '윤택함(윤) — col_INDANG_gloss'], uncovered: [],
    basis: '「요명윤」 두 어절 모두 인당 마스크 위의 상대 밝기·광택 축이 정확히 대응한다. 남은 것은 「얼마나」뿐이고 그 컷오프는 원문이 아니라 모집단이 준다.',
    operational: 'col_INDANG_lightness(明) · col_INDANG_gloss(潤) — 印堂 폴리곤(107/336/285/168/55) 위 상대값. 컷오프는 모집단(POPULATION).' },
  FACE_XLHZ_R049: { axes: ['col_grp_OAK_lightness_min', 'col_CHEONJEONG_lightness', 'col_GWAN_R_lightness', 'col_GWAN_L_lightness', 'col_JUNDU_lightness', 'col_JIGAK_lightness'], cov: 'FULL', origin: 'POPULATION',
    covered: ['산악 다섯 자리(이마·좌우 관골·코·턱) 전부 마스크 있음', '혼암 — 얼굴 피부 기준 상대 밝기(조명장 제거 후)'], uncovered: [],
    basis: '오악 다섯 부위 모두 마스크가 있고 「혼암」은 조명장(저주파 밝기장)을 뺀 상대 밝기 축이 대응한다. 종전 notes 가 요구한 「촬영 조건 정규화」는 sensor_color 의 log·detrend·σ 정규화가 이행한다(p05 조명 불변성 최악 7.1%). 어느 한 자리라도 어두우면 「혼암」이므로 다섯 자리의 최소값을 대표축으로 둔다.',
    operational: 'col_grp_OAK_lightness_min (다섯 자리 중 최소). 컷오프는 모집단(POPULATION).' },
  FACE_XLHZ_R051: { axes: ['col_INDANG_gloss', 'col_INDANG_lightness'], cov: 'FULL', origin: 'POPULATION',
    covered: ['빛남(광) — col_INDANG_gloss', '밝음(명) — col_INDANG_lightness', '거울 같음(여경 — 정도 표현, 컷오프에 해당)'], uncovered: [],
    basis: '「광명여경」에서 광·명 은 축이 있고 「여경」은 정도(얼마나)를 말하는 직유다. 정도는 모집단이 준다.',
    operational: 'col_INDANG_gloss(光) · col_INDANG_lightness(明). 「如鏡」= 상위 컷오프(POPULATION).' },
  FACE_XLHZ_R054: { axes: ['tex_INDANG_blob_count', 'col_INDANG_darkSpotFrac', 'tex_INDANG_blob_edgeSharpness'], cov: 'PARTIAL', origin: 'POPULATION',
    covered: ['점(개수·비율·경계 선명도)'], uncovered: ['나쁨(악)의 판정 — 계측량이 아니다'],
    basis: '점의 존재·개수·모양까지 잰다. 「악」은 길흉 형용이라 원천적으로 불가. 노출 차단 유지.',
    operational: 'tex_INDANG_blob_count · col_INDANG_darkSpotFrac. ★「惡」 불가 · BLOCKED 유지.' },
  FACE_XLHZ_R055: { axes: ['col_INDANG_redness', 'col_INDANG_chromaDispersion', 'tex_INDANG_blob_count'], cov: 'PARTIAL', origin: 'POPULATION',
    covered: ['붉은 색(인당 붉은기)', '얼룩(색 산포)', '점(개수)'], uncovered: ['실 같음(여사 — 형상)', '돋음(기(돋음) — 융기, blobRelief 는 조명 의존 LOW)'],
    basis: '붉은기·산포·점 개수는 잰다. 「여사」의 선형 형상과 「기(돋음)」의 융기는 못 가른다.',
    operational: 'col_INDANG_redness · col_INDANG_chromaDispersion · tex_INDANG_blob_count. ★如絲·起 불가 · BLOCKED 유지.' },
  // ── 텍스처 ──
  FACE_OGWAN_R025: { axes: ['tex_grp_FOREHEAD_directionality_mean', 'tex_CHEONJEONG_directionality', 'tex_INDANG_vertFrac'], cov: 'PARTIAL', origin: 'POPULATION',
    covered: ['세로결/가로결의 구분(directionality: +세로 −가로)'], uncovered: ['자리(미상(눈썹 위)) — 전용 마스크가 없어 천정·보각(이마)으로 근사'],
    basis: '결의 방향 자체는 directionality 축이 정확히 대응한다(p06: 횡리 −1.000 / 직리 +0.940). 그러나 원문 자리 「미상(눈썹 위)」 마스크가 없어 이마로 근사한다 — 자리 어절이 안 덮인다.',
    operational: 'tex_grp_FOREHEAD_directionality_mean (>0 直理 · <0 橫理). ★眉上 전용 마스크 없음(근사).' },
  FACE_XLHZ_R047: { axes: ['tex_INDANG_crossingIndex', 'tex_INDANG_wrinkleEnergy', 'tex_INDANG_orientationConcentration'], cov: 'PARTIAL', origin: 'POPULATION',
    covered: ['주름(에너지)', '교차(세로·가로 동시 에너지 — crossingIndex)'], uncovered: ['「교차하는 두 주름」과 「방향이 어지러운 잔주름」의 구분'],
    basis: 'crossingIndex 는 세로·가로 에너지가 함께 클 때 커지므로 어지러운 잔주름도 같은 값을 낸다. 두 현상을 못 가르므로 FULL 아님. BLOCKED 유지.',
    operational: 'tex_INDANG_crossingIndex(+wrinkleEnergy·orientationConcentration 병독). ★교차 vs 어지러움 미구분.' },
  FACE_XLHZ_R048: { axes: ['tex_indang_verticalLineCount', 'tex_INDANG_vertFrac', 'tex_INDANG_wrinkleEnergy'], cov: 'FULL', origin: 'TEXT',
    covered: ['인당 세로선 1개 — tex_indang_verticalLineCount (신뢰조건 미달이면 값을 내지 않는다)'], uncovered: [],
    basis: '「현침」= 인당에 세로로 선 주름 하나. 개수 축이 어절을 전부 덮고 컷오프(1)는 원문이 준다(TEXT). ★MEASURABLE 보류: 개수 센서가 실사진 검증 0건(p06 합성만). BLOCKED 유지.',
    operational: 'tex_indang_verticalLineCount == 1. ★실사진 검증 전 MEASURABLE 보류 · BLOCKED.' },
  FACE_XLHZ_R050: { axes: ['tex_indang_verticalLineCount', 'tex_INDANG_vertFrac', 'tex_INDANG_wrinkleEnergy'], cov: 'FULL', origin: 'TEXT',
    covered: ['인당 세로선 3개(천) — tex_indang_verticalLineCount (신뢰조건 미달이면 값을 내지 않는다)'], uncovered: [],
    basis: '「천자」= 세로선 셋. 개수 축이 어절을 전부 덮고 컷오프(3)는 글자 자체가 준다(TEXT). ★MEASURABLE 승격 요건: 실사진(동의 확보분)에서 세로선 개수 정답률 실측 — 지금은 0건이라 보류한다.',
    operational: 'tex_indang_verticalLineCount == 3. ★실사진 검증 전 MEASURABLE 보류.' }
};
// R008 — 이미 PARTIAL(gwanGol). 광택 어절이 이제 덮이므로 축만 추가한다(등급 불변).
const AXIS_APPEND = {
  FACE_OGWAN_R008: { axes: ['col_grp_YUKBU_gloss_mean'], covered: ['빛남(광이영 — 육부 광택 평균)'],
    uncoveredDrop: ['빛남', '맑음'], basisAppend: ' v787: 광택 어절은 col_grp_YUKBU_gloss_mean 으로 덮인다. 평만(평평하고 그득함)은 여전히 불가.' }
};

function apply(file) {
  const p = path.join(IP, file);
  const doc = JSON.parse(fs.readFileSync(p, 'utf8'));
  let changed = 0;
  for (const r of doc.rules) {
    const t = TABLE[r.rule_id];
    if (t) {
      for (const a of t.axes) if (!REG.has(a)) throw new Error(`${r.rule_id}: 축 ${a} 가 센서 레지스트리에 없다`);
      if (r.measurability === 'MEASURABLE') throw new Error(`${r.rule_id}: MEASURABLE 을 내리려 한다`);
      r.measurability = 'PARTIAL';
      r.measure_axis = t.axes[0];
      r.threshold_origin = t.origin;
      r.condition.axis_partial = t.axes.slice();
      r.condition.operational = t.operational;
      r.condition_coverage = t.cov;
      r.coverage_note = { covered: t.covered.slice(), uncovered: t.uncovered.slice(), basis: t.basis };
      if (t.block) { r.user_exposure = 'BLOCKED'; r.user_exposure_reason = t.block; }
      r.sensor_binding = { since: 'v787', sensors: [...new Set(t.axes.map((a) => a.slice(0, 3) === 'col' ? 'color' : 'texture'))], note: '센서 축에는 참조 모집단이 없다 — ranks 부재로 REFERENCE 상한' };
      changed++;
    }
    const ap = AXIS_APPEND[r.rule_id];
    if (ap) {
      for (const a of ap.axes) { if (!REG.has(a)) throw new Error(`${r.rule_id}: 축 ${a} 가 레지스트리에 없다`); if (r.condition.axis_partial.indexOf(a) === -1) r.condition.axis_partial.push(a); }
      // 같은 축을 가리키는 옛 항목(한자 표기 등)은 걷어내고 현재 표기로 한 건만 둔다(멱등)
      r.coverage_note.covered = r.coverage_note.covered.filter((c) => !/^빛남\(/.test(c));
      for (const c of ap.covered) if (r.coverage_note.covered.indexOf(c) === -1) r.coverage_note.covered.push(c);
      r.coverage_note.uncovered = r.coverage_note.uncovered.filter((u) => ap.uncoveredDrop.indexOf(u) === -1);
      if (r.coverage_note.basis.indexOf('v787:') === -1) r.coverage_note.basis += ap.basisAppend;
      r.sensor_binding = r.sensor_binding || { since: 'v787', sensors: ['color'], note: '광택 축 보조. 등급 불변(PARTIAL).' };
      changed++;
    }
  }
  // 집계 재계산 (p04 가 대조한다)
  const T2 = doc.tally;
  T2.threshold_origin = { TEXT: 0, POPULATION: 0, NONE: 0 };
  T2.measurability = { MEASURABLE: 0, PARTIAL: 0, UNMEASURABLE: 0 };
  T2.measure_axis_null = 0; T2.user_exposure_blocked = 0;
  for (const r of doc.rules) {
    T2.threshold_origin[r.threshold_origin]++; T2.measurability[r.measurability]++;
    if (r.measure_axis === null) T2.measure_axis_null++;
    if (r.user_exposure === 'BLOCKED') T2.user_exposure_blocked++;
  }
  doc.binding_status = BOUND;
  if (doc._AXIS_GAPS) {
    if (doc._AXIS_GAPS.no_color_axis) doc._AXIS_GAPS.no_color_axis = '(v787 해소 — sensor_color 13축 결속) ' + doc._AXIS_GAPS.no_color_axis.replace(/^\(v787 해소[^)]*\)\s*/, '');
    if (doc._AXIS_GAPS.no_texture_axis) doc._AXIS_GAPS.no_texture_axis = '(v787 해소 — sensor_texture 14축 결속) ' + doc._AXIS_GAPS.no_texture_axis.replace(/^\(v787 해소[^)]*\)\s*/, '');
    if (doc._AXIS_GAPS.no_wrinkle_mole_axis) doc._AXIS_GAPS.no_wrinkle_mole_axis = '(v787 부분 해소 — 주름 방향·개수·점 덩어리 축 결속. 惡·如絲 는 여전히 불가) ' + doc._AXIS_GAPS.no_wrinkle_mole_axis.replace(/^\(v787 부분 해소[^)]*\)\s*/, '');
  }
  fs.writeFileSync(p, JSON.stringify(doc, null, 2) + '\n');
  console.log(`${file}: ${changed}건 갱신 · tally ${JSON.stringify(T2.measurability)} ${JSON.stringify(T2.threshold_origin)} axis_null=${T2.measure_axis_null}`);
}
apply('ogwan.json');
apply('xlhz.json');
console.log('★다음: node _v786_diag/compile_face_rules.js → p04 · p07 · p08 · p09');
