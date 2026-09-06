/* ============================================================================
   천운 v786 · 관상 텍스처(紋理·痣瘢·毛逆) 계측축 — sensor_texture.js   (P-786-G3)
   ---------------------------------------------------------------------------
   ★독립 모듈이다. index.html · api/* · face_core_v786.js · sensor_color.js ·
     규칙 JSON(ogwan.json·xlhz.json) 을 **읽기만** 하고 하나도 고치지 않는다.
   ★통합은 별도 작업이며 이 파일은 통합되기 전까지 NOT_BOUND 다.

   왜 만들었나
     _v786_diag/IP_face/rules/face/ogwan.json  _AXIS_GAPS.no_texture_axis
       「直理·橫理(주름결)·疵瘢·黑痣·毛逆 계열은 텍스처 축이 0개다.」
     실측(본 파일 작성 전 grep): 원문 조건 100건 중 텍스처가 조건에 직접 들어간 것 13건.
       OGWAN R006 R009 R011 R018 R022 R023 R025 / XLHZ R047 R048 R050 R053 R054 R055
     ⟹ 그 중 UNMEASURABLE 로 떨어져 있는 것이 9건이다.

   ★★설계의 제1 원칙 — 해상도·초점 불변성
     이 앱은 앞서 「사진 종횡비가 얼굴형을 결정한다」는 결함을 실측당했다.
     텍스처에서 같은 실패를 반복하지 않기 위해 두 겹으로 막는다.

     ① **표준 얼굴 캔버스(face-normalized canvas)**
        얼굴 폭이 정확히 SREF(=256)px 가 되도록 원본을 등방(等方) 리샘플한 뒤
        그 위에서만 필터를 건다.
        ⟹ 320px 사진이든 1280px 사진이든 「얼굴 폭 256px」이라는 같은 자 위에서 잰다.
        ⟹ x·y 를 같은 배율로만 늘린다. 종횡비가 축에 들어갈 여지가 원천적으로 없다.
           (사진 종횡비는 landmarks.x*W, y*H 로 픽셀좌표를 복원하는 순간 이미 반영돼 있고,
            그 뒤로는 등방 스케일밖에 하지 않는다.)

     ② **얼굴 피부 기준 상대화(색 센서의 z 화에 대응하는 텍스처판)**
        주름 세기를 절대 밝기차로 두지 않고 **얼굴 피부 전체의 대역통과 에너지로 나눈다.**
        초점이 흐려지면 부위와 얼굴 기준이 **함께** 줄어들므로 비율이 상당 부분 상쇄된다.
        방향(orientation)·결의 뚜렷함(coherence)은 구조텐서 고유값의 **비(比)** 라서
        진폭 스케일에 원래 불변이다.

     ③ **계단(step) 제거를 필터 **전에** 한다**
        얼굴 실루엣·눈·입술·눈썹은 배경/자기 색과의 계단이다. 마스크에서 화소를 빼는 것만으로는
        사라지지 않는다 — DoG 지지폭(±3σ조대 ≈ 13px)만큼 곁잎이 안쪽으로 번진다.
        ⟹ 필터 전에 그 영역을 **최근접 유효 화소 값으로 외삽**해 계단 자체를 지운다.
        (지우기 전에는 주름이 하나도 없는 합성 얼굴에서 天庭 방향성이 −0.79, 印堂 세로결이 1.00 이었다.)

     실측 결과 (p06 이 낸 숫자, 얼굴 폭 449px 기준)
       · 해상도 320/640/1280 · JPEG q=20/50 · 흐림 σ≤2.0 : 전 축 ±15% 이내
       · 방향·형상 축(directionality·vertFrac·concentration·ridgeValleyPurity)
         및 정수 축(blobCount·verticalLineCount) : **모든** 변환에서 ±2.6% 이내 / 8·8 유지
       · ★세기 축(wrinkleEnergy) 은 강한 흐림(σ3.2)에서 −26~−31% 로 무너진다.
         원리적 이유: 주름(폭 ≈ 얼굴폭 0.6%)과 피부 미세결(≈1.2%)은 **공간 스케일이 다르다.**
         초점이 흐려지면 가는 쪽이 더 많이 죽으므로 두 스케일의 에너지 비는 초점에 불변일 수 없다.
         ⟹ 감추지 않는다. G7 초점 게이트로 작동 범위를 막고, 승격 후보는 세기 절대값이 아니라
            방향·개수·형상 축에 기대게 한다.
     ★상쇄되지 않는 것: 완전한 초점 소실(고주파가 물리적으로 사라지면 복구 불가 — G7 이 거부),
       얼굴이 너무 작은 사진(G3 가 거부), 강한 이물(모발·안경테 — occluder 로 분리하고 부위를 신뢰 불가로 내린다).

   ★★혼동 방어 — 「텍스처가 아닌 것을 주름으로 읽지 않는다」
     Ⓐ 이물(occluder) 분리 : 국소 log 대비가 occLogContrast(=0.35, 약 30% 국소 암화) 를
        넘는 화소는 피부 요철이 아니라 **모발·수염·안경테** 다.
        근거: 사람 모발 반사율 ≈0.05~0.15, 피부 ≈0.35 → log 대비 0.9~2.0.
              주름 그림자는 국소 0.10~0.25 log 를 넘지 않는다.
        ⟹ 그 화소를 빼는 것만으로는 부족하다. 매우 어두운 가는 선은 **자기보다 주변에 만드는
           DoG 곁잎(halo)이 더 크다** — 곁잎을 빼지 않으면 머리카락 한 올이 「주름 세기 0.97」
           (진짜 주름 0.29의 3배)로 읽혔다(실측). 그래서 반경 1.2·σ조대 만큼 팽창시켜 함께 뺀다.
        ⟹ 비율은 occluderFrac(이물 덩어리) / darkFrac(점 포함 전체) 으로 보고하고,
           한계를 넘으면 그 부위는 textureReliable=false 로 **판정을 포기**한다.
        ⟹ log 대비를 쓰므로 조명 밝기에 불변이다(곱셈 조명이 상쇄된다).
     Ⓑ 선(line) 대 계단(step) 분리 : 주름은 **골(valley)** 이고 그림자·화장 경계는 **계단** 이다.
        ★국소적으로는 구별이 원리적으로 불가능하다 — 계단의 DoG 응답에서 「어두운 곁잎」은
          골과 똑같이 생겼다. 구별되는 것은 「같은 크기의 밝은 곁잎이 **한쪽에만**」 있다는
          비국소 사실이고, 그것을 보려면 탐침이 곁잎 간격(≈2σ조대)까지 나가야 한다.
          (탐침을 0.8σ조대로 두었을 때 그림자의 선순도가 오히려 **더 높았다** — 실측 실패.)
        ⟹ sym = 1 − |b₊ − b₋| / (|b₊| + |b₋| + 0.15·|b₀|) 를 화소마다 매기고(ridgeValleyPurity),
           주름 에너지·방향 투표에 이 가중치를 곱한다.
        ⟹ 실측: 진짜 세로주름 선순도 0.58 / 조명 그림자 경계 0.28 / 머리카락 0.14.
           그림자가 주름 세기에 흘리는 몫(누출)은 1.6% 다.
     Ⓒ 색 경계 분리 : 화장 경계는 색차(chroma) 기울기가 크고 밝기 기울기는 작다.
        ⟹ chromaEdgeRatio 로 보고한다. (색 센서에 없는 양이다 — 색 센서는 기울기를 재지 않는다.)
        ⟹ 실측: 진짜 주름 0.48 / 화장 경계 1.17, 누출 0.8%.

   ★★sensor_color.js 와 중복하지 않는다
     색 센서에 이미 darkSpotFrac(어두운 화소 **비율**)이 있다.
     본 모듈은 그 비율을 다시 내지 않는다. 텍스처가 더할 수 있는 것만 낸다:
       · blobCount        점의 **개수** (비율이 아니다)
       · blobElongation   길쭉함 — 黒痣(둥긂) 대 疵瘢(흉터·길쭉함)
       · blobEdgeSharpness 경계 선명도 — 점(예리) 대 그림자(뭉툭)
       · blobRelief       융기 — 「起點麻(점·마가 **돋는다**)」  ★confidence LOW(조명 방향 의존)

   부위 마스크의 출처 ★새로 만들지 않았다
     sensor_color.js 의 REGIONS 15개를 **그대로 import** 해서 쓴다.
     눈썹(毛逆·亂)만 sensor_color.js 가 이미 내보내는 _internals.BROW_R / BROW_L
     (npm @mediapipe/face_mesh@0.4.1633559619 의 FACEMESH_LEFT/RIGHT_EYEBROW 실측 고리)
     를 계측 부위로 승격해 쓴다 — 이 역시 새로 그린 마스크가 아니다.
     ★그 때문에 분석 스택이 둘이다: 눈썹을 메운 스택(피부 부위용)과 남긴 스택(눈썹용).
       눈썹을 남긴 채 印堂을 재면 눈썹 계단이 印堂 안으로 번져 가짜 세로결이 생긴다(실측).
     ★「眉上(눈썹 위)」 전용 마스크는 sensor_color.js 에 없다. 만들지 않았다.
       OGWAN R025(眉上 直理·橫理)는 天庭+輔角(이마)으로 근사하며, 그 어긋남을
       AXES 의 caveat 와 승격 후보의 confidence 에 그대로 적는다.

   입력 : imageData {data:Uint8ClampedArray(RGBA), width, height}  ← canvas.getImageData 그대로
          landmarks 468(또는 478) 정규화 좌표
          aspect    사진높이/사진폭 (★기록용으로만 받는다. 어떤 축에도 들어가지 않는다)
   출력 : { ok, reject, meta, norm, regions{...}, indang{...}, groups{...} }
   ========================================================================== */

'use strict';

var SENSOR_TEXTURE_VERSION = '0.1.0';

/* ── sensor_color.js 를 부위 마스크 공급원으로 삼는다 (읽기만) ───────────── */
var COLOR = (typeof require === 'function' && typeof module !== 'undefined' && module.exports)
  ? require('./sensor_color.js')
  : ((typeof window !== 'undefined') ? window.CW_SENSOR_COLOR : null);
if (!COLOR || !COLOR._internals) {
  throw new Error('sensor_texture.js: sensor_color.js 가 먼저 실려 있어야 한다 (부위 마스크 출처).');
}
var IN = COLOR._internals;

/* ============================================================================
   1. 계측 부위 — ★sensor_color.REGIONS 를 그대로 쓴다. 다시 만들지 않는다.
   ========================================================================== */
var TEXTURE_REGIONS = (function () {
  var t = {}, rn;
  for (rn in COLOR.REGIONS) {
    var d = COLOR.REGIONS[rn];
    t[rn] = { ko: d.ko, ring: d.ring, holes: d.holes || null, shrink: d.shrink,
      side: d.side, src: 'sensor_color.REGIONS', skipExcl: (rn === 'SEUNG') ? 'LIP' : null };
  }
  /* 눈썹 — 毛逆(털이 거스름)·亂(어지러움) 을 보려면 눈썹 자체를 재야 한다.
     sensor_color._internals.BROW_R/BROW_L = FACEMESH_*_EYEBROW 실측 고리. */
  /* ★hairIsSignal — 눈썹에서는 털이 「이물」이 아니라 **재려는 신호 자체**다.
     다른 부위에서는 occLogContrast 를 넘는 어두운 화소를 전부 배제하지만 눈썹만 배제하지 않는다. */
  t.BROW_R = { ko: '眉(눈썹·右)', ring: IN.BROW_R, holes: null, shrink: 0.10, side: 'R',
    src: 'sensor_color._internals.BROW_R (FACEMESH_RIGHT_EYEBROW)', skipExcl: 'BROW', hairIsSignal: true };
  t.BROW_L = { ko: '眉(눈썹·左)', ring: IN.BROW_L, holes: null, shrink: 0.10, side: 'L',
    src: 'sensor_color._internals.BROW_L (FACEMESH_LEFT_EYEBROW)', skipExcl: 'BROW', hairIsSignal: true };
  return t;
})();

/* 六府(兩目上·兩輔角·兩顴骨) — OGWAN R009 「有缺陷疵瘢黒痣」 */
var YUKBU = COLOR.YUKBU.slice();
/* 이마 묶음 — OGWAN R025 「眉上 直理/橫理」의 **근사** 자리.
   ★眉上 전용 마스크가 없다. 天庭·輔角은 眉上보다 위다. 이 어긋남이 R025 confidence 를 깎는다. */
var FOREHEAD = ['CHEONJEONG', 'BOGAK_R', 'BOGAK_L'];
/* 눈썹 묶음 — OGWAN R022 「疎」 · R023 「逆而亂」 */
var BROWS = ['BROW_R', 'BROW_L'];

/* ============================================================================
   2. 축 정의표 — ★축마다 「무엇을 재는가」와 「어느 원문 조건(rule_id)에 대응하는가」.
      ★대응 rule 이 없는 축은 만들지 않는다.
   ========================================================================== */
var AXES = [
  { axis: 'wrinkleEnergy', kind: 'REL',
    what: '부위의 선(line) 가중 대역통과 RMS / 얼굴 피부 대역통과 RMS — 「紋(주름)이 얼마나 있는가」',
    rules: ['FACE_OGWAN_R025', 'FACE_XLHZ_R047', 'FACE_XLHZ_R048', 'FACE_XLHZ_R050'] },
  { axis: 'wrinkleOrientationDeg', kind: 'ANGLE',
    what: '선 방향의 원형평균(0°=가로결 橫理, 90°=세로결 直理). 구조텐서 기울기방향 +90°',
    rules: ['FACE_OGWAN_R025'] },
  { axis: 'orientationCoherence', kind: 'REL',
    what: '구조텐서 (λ1−λ2)/(λ1+λ2) 의 가중평균 — 국소적으로 「결」이 뚜렷한가',
    rules: ['FACE_OGWAN_R025', 'FACE_OGWAN_R023'] },
  { axis: 'orientationConcentration', kind: 'REL',
    what: '부위 전체 방향 히스토그램의 원형집중도 |Σw·e^{i2φ}|/Σw — 결이 한 방향으로 모였는가',
    rules: ['FACE_OGWAN_R025', 'FACE_OGWAN_R023', 'FACE_XLHZ_R047'] },
  { axis: 'vertFrac', kind: 'REL',
    what: '선 에너지 중 세로(|φ−90°|≤30°) 비중 — 「直理(세로결)」',
    rules: ['FACE_OGWAN_R025', 'FACE_XLHZ_R048', 'FACE_XLHZ_R050'] },
  { axis: 'horizFrac', kind: 'REL',
    what: '선 에너지 중 가로(φ≤30° 또는 ≥150°) 비중 — 「橫理(가로결)」',
    rules: ['FACE_OGWAN_R025'] },
  { axis: 'directionality', kind: 'REL',
    what: 'vertFrac − horizFrac (+1 완전 세로 直理 ↔ −1 완전 가로 橫理)',
    rules: ['FACE_OGWAN_R025'] },
  { axis: 'crossingIndex', kind: 'REL',
    what: '2·√(vertFrac·horizFrac) — 세로·가로가 동시에 강한 정도. 「紋交(주름이 교차한다)」',
    rules: ['FACE_XLHZ_R047'],
    caveat: '★단독으로 읽으면 안 된다. wrinkleEnergy 가 낮으면 「주름이 없어서 방향이 고른 것」이다.' },
  { axis: 'ridgeValleyPurity', kind: 'REL',
    what: '대역통과 에너지 중 좌우대칭 곁잎(=골·선)이 차지하는 비 — 계단(그림자·화장 경계) 배제 지표',
    rules: ['FACE_OGWAN_R025', 'FACE_XLHZ_R047'],
    caveat: '혼동 방어용 게이트다. 원문 글자에 직접 대응하는 양이 아니라, 위 두 축이 거짓 양성이 아님을 보증하는 값이다.' },
  { axis: 'chromaEdgeRatio', kind: 'REL',
    what: '색차(a,b) 기울기 / 밝기 기울기 — 화장·색 경계를 주름과 가르는 지표',
    rules: ['FACE_OGWAN_R025', 'FACE_XLHZ_R047'],
    caveat: '혼동 방어용 게이트다. 색 센서의 어떤 축과도 겹치지 않는다(색 센서는 기울기를 재지 않는다).' },
  { axis: 'occluderFrac / darkFrac', kind: 'REL',
    what: '국소 log 대비가 occLogContrast 를 넘는 화소의 비율(후광 팽창 포함). ' +
      'occluderFrac=큰 덩어리(모발·수염·안경테)만, darkFrac=점까지 포함한 전체. 부위 신뢰도 게이트',
    rules: ['FACE_OGWAN_R009', 'FACE_XLHZ_R044'],
    caveat: '이물이 「무엇인지」는 모른다. 「피부 요철이 아니다」까지만 안다. ' +
      '한계를 넘으면 그 부위의 텍스처 판정을 포기한다(textureReliable=false).' },
  { axis: 'blobCount', kind: 'COUNT',
    what: '부위 안 어두운 소(小)덩어리 개수 — 「疵瘢黒痣」의 **개수**. ★비율은 sensor_color.darkSpotFrac 이 이미 낸다',
    rules: ['FACE_OGWAN_R009', 'FACE_XLHZ_R054', 'FACE_XLHZ_R055'] },
  { axis: 'blobElongation', kind: 'REL',
    what: '덩어리 2차모멘트 장축/단축 비의 평균 — 둥근 黒痣(≈1) 대 길쭉한 疵瘢(흉터, ≫1)',
    rules: ['FACE_OGWAN_R009'] },
  { axis: 'blobEdgeSharpness', kind: 'REL',
    what: '덩어리 경계 밝기기울기 × 등가반경 / 깊이 — 경계가 예리한가(痣·瘢) 뭉툭한가(그림자)',
    rules: ['FACE_OGWAN_R009', 'FACE_XLHZ_R054'] },
  { axis: 'blobRelief', kind: 'REL', confidence: 'LOW',
    what: '덩어리 내부 밝기의 1차 기울기 × 등가반경 / 깊이 — 융기(돋음). 「起點麻(점·마가 돋는다)」',
    rules: ['FACE_XLHZ_R055'],
    caveat: '★조명 방향에 의존한다. 정면 확산조명에서는 융기가 그림자를 만들지 않아 0 이 된다. confidence LOW.' },
  { axis: 'indang.verticalLineCount', kind: 'COUNT',
    what: '印堂 세로선 개수 — 1=懸針, 3=川字. ★신뢰조건 미달이면 값을 내지 않고 UNMEASURABLE 로 둔다',
    rules: ['FACE_XLHZ_R048', 'FACE_XLHZ_R050'],
    caveat: '★억지로 세지 않는다. 세로 주름 세기(wrinkleEnergy·vertFrac)가 임계 미만이면 status=UNMEASURABLE 이다.' }
];

/* ★원문에 텍스처 글자가 있어도 축을 만들지 않은 것 — 지어내지 않기 위해 명시한다 */
var NOT_MEASURED = [
  { text: '凹陷(우묵하게 꺼짐)',
    why: '★깊이(z)다. 2D 텍스처로는 원천적으로 불가하다. 2D 가 볼 수 있는 것은 「꺼짐이 만든 그림자」뿐이고, ' +
      '그 그림자는 조명 방향·세기에 따라 있다가 없어진다 — 우리 대역통과 정규화가 바로 그 저주파 조명을 지운다. ' +
      '지우지 않고 쓰면 그것은 형태가 아니라 조명을 재는 것이다. 억지 배당을 기각한다.',
    rules: ['FACE_XLHZ_R053', 'FACE_OGWAN_R006', 'FACE_OGWAN_R009', 'FACE_OGWAN_R011', 'FACE_OGWAN_R018'] },
  { text: '惡(나쁜) — 惡痣의 「惡」',
    why: '질적·길흉 판정이다. 점의 개수·모양·경계는 재지만 「나쁜 점」이라는 값은 계측량으로 존재하지 않는다.',
    rules: ['FACE_XLHZ_R054'] },
  { text: '缺陷(결함)·醜惡(추악)',
    why: '3D 결손 + 미적 판단. 텍스처 축과 무관하다.',
    rules: ['FACE_OGWAN_R006', 'FACE_OGWAN_R011'] },
  { text: '疎(성김) — 눈썹 털의 밀도',
    why: '털 한 올을 분해하려면 얼굴 폭 256px 표준 캔버스로는 부족하다(털 굵기 ≈ 얼굴 폭의 0.1%). ' +
      '눈썹 부위의 occluderFrac 은 「털이 덮은 면적」이지 「털의 개수」가 아니다. 밀도로 승격하지 않는다.',
    rules: ['FACE_OGWAN_R022'] },
  { text: '眉上(눈썹 위)이라는 자리',
    why: 'sensor_color.REGIONS 15개에 眉上 전용 마스크가 없다. 새 마스크를 만들지 않기로 했으므로 ' +
      '天庭(CHEONJEONG)+輔角(BOGAK)으로 근사한다 — 眉上보다 위다. 이 어긋남은 지워지지 않는다.',
    rules: ['FACE_OGWAN_R025'] },
  { text: '如絲(실 모양)의 「絲」',
    why: '가늘고 긴 구조라는 뜻까지는 blobElongation·orientationCoherence 에 닿지만, ' +
      '원문이 말하는 것은 **붉은 실핏줄**이고 그 붉음은 색 센서(redness)의 것이다. 텍스처 단독 판정이 아니다.',
    rules: ['FACE_XLHZ_R055'] },
  { text: '耳(귀)·眼毫·耳毫·鼻毫·鬍鬚',
    why: 'MediaPipe FaceMesh 468 에 귀 윤곽이 없고, 눈썹 밖 털(속눈썹·귀털·코털·수염)을 자를 마스크가 없다. ' +
      '텍스처 축이 있어도 자를 자리가 없다. occluderFrac 은 「털이 있다」까지만이고 그것은 판정이 아니다.',
    rules: ['FACE_OGWAN_R003', 'FACE_OGWAN_R029', 'FACE_OGWAN_R036', 'FACE_OGWAN_R041', 'FACE_XLHZ_R044'] },
  { text: '清(맑다)·秀(빼어나다)',
    why: '색 센서 작업에서 이미 기각했다. 텍스처 축이 생겨도 달라지지 않는다 — 비교 대상도 컷오프도 없다.',
    rules: ['FACE_OGWAN_R001', 'FACE_OGWAN_R002', 'FACE_OGWAN_R022', 'FACE_XLHZ_R008'] }
];

/* ============================================================================
   3. 기본 파라미터
   ========================================================================== */
var DEFAULTS = {
  /* ── 표준 얼굴 캔버스 ── */
  faceRefPx: 256,        // ★표준 캔버스에서의 얼굴 폭(px). 모든 필터 폭이 여기에 고정된다.
  margin: 0.18,          // 얼굴 bbox 바깥 여유 (얼굴 폭 대비)
  maxCanvas: 900,        // 표준 캔버스 한 변 상한(안전장치)

  /* ── 필터 (표준 캔버스 px = 얼굴 폭의 1/256) ── */
  sigmaFine: 1.1,        // DoG 미세 σ. 얼굴 폭의 0.43%
  sigmaCoarse: 4.4,      // DoG 조대 σ. 얼굴 폭의 1.72%
  //   ⟹ 통과 대역 ≈ 폭 3~11px = 얼굴 폭의 1.0~4.2%.
  //   ★이 대역은 「사람 얼굴 폭 ≈140mm, 이마 주름 폭 ≈1~5mm」라는 기하 비율에서 잡은 것이고
  //     합성 시험(p06)으로 실제로 그 대역이 주름을 잡는지 확인했다. 실제 얼굴 사진으로는 미검증이다.
  sigmaTensor: 3.0,      // 구조텐서 적분 창 σ
  probeK: 1.5,           // ★선/계단 판별 탐침 거리 = probeK·σ조대.
                         //   ★짧으면(≈0.8σ) 작동하지 않는다 — 계단의 「어두운 곁잎」은
                         //     국소적으로 골(valley)과 완전히 같아서, 가까이서는 구별이 원리적으로 불가능하다.
                         //     구별되는 것은 「같은 크기의 밝은 곁잎이 한쪽에만 있다」는 **비국소** 사실이고,
                         //     그것을 보려면 탐침이 곁잎 간격(≈2σ조대)까지 나가야 한다. (실측으로 확인)
  probeCenterK: 0.15,    // 대칭도 분모에 중심 진폭을 섞는 비중. 두 탐침이 모두 0 에 가까울 때
                         //   (=진짜 골) 대칭도가 1 로 안정되게 한다

  /* ── 이물(occluder) ── */
  occLogContrast: 0.35,  // 국소 log 대비 임계. 약 30% 국소 암화. 모발·안경테·눈썹은 이보다 훨씬 크다
  occMinArea: 250,       // 이 넓이(표준캔버스 px) 이상 어두운 덩어리 = 이물(모발·수염·안경)
  occMaxDim: 70,         // 또는 최대 변이 이보다 길면 이물 (긴 머리카락 한 올)
  haloDilateK: 1.2,      // ★어두운 화소를 뺄 때 그 「DoG 후광」까지 반경 haloDilateK·σ조대 만큼 함께 뺀다
  regionOccFracMax: 0.10,// 부위의 이 비율을 넘게 **이물**이 덮으면 그 부위는 신뢰 불가
  regionDarkFracMax: 0.25,// 이물이든 점이든 어두운 화소가 이 비율을 넘으면 신뢰 불가
  ovalInsetShrink: 0.02, // ★모든 부위 마스크를 얼굴 윤곽 안쪽으로 한 번 더 자른다(실루엣 계단 차단)
  energyRef: 'band',     // 주름 세기의 분모. 'band'=얼굴 기준을 대역 전체 RMS 로 잰다(운영값)
                         //                    'line'=얼굴 기준도 sym 가중으로 잰다(초점 변동에 더 민감했다)

  /* ── 점·흉터 덩어리 ── */
  blobMinArea: 6,        // 이보다 작으면 잡음
  maxBlobs: 12,          // 이보다 많으면 「점」이 아니다(수염·모공·잡티) → 덩어리 지표 무효

  /* ── 방향 ── */
  sectorHalf: 30,        // 세로/가로 섹터 반폭(deg). 세로·가로·대각 3섹터가 60°씩
  bandFloorK: 0.60,      // |band| 가 얼굴 기준 RMS 의 이 배 미만이면 투표하지 않는다

  /* ── 印堂 세로선 개수 ── */
  vlMinEnergy: 0.80,     // 印堂 wrinkleEnergy 가 이 미만이면 개수를 세지 않는다
  vlMinVertFrac: 0.45,   // 세로 비중이 이 미만이면 세지 않는다
  vlPeakRel: 0.35,       // 프로파일 최대치의 이 비율 이상만 봉우리로 친다
  vlMinSepPx: 9,         // 봉우리 최소 간격(표준캔버스 px) = 얼굴 폭의 3.5%
  vlMaxCount: 5,         // 이보다 많이 세지면 세로선이 아니라 결이다 → UNMEASURABLE
  vlMaxHorizFrac: 0.20,  // 가로결이 이보다 많으면 「세로선 몇 개」를 묻지 않는다(紋交 계열)
  vlMinColFrac: 0.05,    // 투영에 쓸 열의 최소 행 수(가장 높은 열 대비). 1행짜리 잡음 열만 뺀다
  vlRingShrink: 0.05,    // ★세로선 개수를 셀 때만 印堂 고리를 덜 오므린다.
                         //   운영 shrink(0.14)로는 印堂 오각형의 좌우 끝이 2~3행밖에 남지 않아
                         //   川字의 바깥 두 줄이 투영에서 사라진다(실측). 같은 고리·다른 오므림이지
                         //   새 마스크가 아니다.

  /* ── 게이트 ── */
  minFaceWidthPx: 64,    // ★원본 사진에서 얼굴 폭이 이보다 좁으면 텍스처를 잴 수 없다(G3)
  minSkinPx: 2500,       // 표준 캔버스에서의 피부 기준 최소 화소(G5)
  minRegionPx: 60,       // 부위 최소 화소. 이하면 그 부위는 null
  focusMin: 0.55,        // ★초점 게이트(G7) = 미세대역 RMS / 조대대역 RMS.
                         //   ★skinLogYsd 로 나누는 방식은 흐림에 대해 단조롭지 않았다(실측:
                         //     σ0→0.26, σ3.2→0.31, σ14→0.15). 두 대역의 비는 단조로 감소한다.
  focusCoarseK: 2.4,     // 조대대역 = blur(σ조대) − blur(focusCoarseK·σ조대)

  /* ── 진단 전용 ── */
  normMode: 'full'
  //   'full'             운영값
  //   'raw'              ★「정규화 전」 대조군 = no_resample + no_face_norm + no_log 를 동시에 켠 것.
  //                      ★대역통과(DoG)는 **끄지 않는다** — DoG 는 정규화가 아니라 「주름 검출기」이고,
  //                        그것까지 끄면 저주파 조명을 재는 전혀 다른 양이 되어 비교가 성립하지 않는다.
  //   'no_resample'      표준 얼굴 캔버스를 쓰지 않는다 (해상도 불변성 파괴)
  //   'no_face_norm'     얼굴 기준으로 나누지 않는다 (초점 불변성 파괴)
  //   'no_log'           log 를 쓰지 않는다 (곱셈 조명 불변성 파괴)
  //   'no_bandpass'      DoG 를 쓰지 않고 log 휘도 자체를 쓴다 (검출기 파괴 — 계단 방어도 무너진다)
  //   'bad_orientation'  선 방향을 기울기 방향 그대로 쓴다(+90° 보정 없음) → 直理/橫理 뒤집힘
};

/* ============================================================================
   4. 수치 유틸 (순수 JS · 외부 라이브러리 없음)
   ========================================================================== */
var LOG_FLOOR = 2.0;
function _llog(v) { return Math.log(v < LOG_FLOOR ? LOG_FLOOR : v); }

function _mean(a, n) { var s = 0, i; n = (n === undefined) ? a.length : n; for (i = 0; i < n; i++) s += a[i]; return n ? s / n : 0; }
function _sdOf(a, m, n) {
  n = (n === undefined) ? a.length : n;
  if (n < 2) return 0;
  var s = 0, i, d; for (i = 0; i < n; i++) { d = a[i] - m; s += d * d; }
  return Math.sqrt(s / (n - 1));
}
function _quant(sorted, q) {
  if (!sorted.length) return NaN;
  var t = (sorted.length - 1) * q, lo = Math.floor(t), hi = Math.ceil(t);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (t - lo);
}

/* 1D 가우시안 커널 */
function _gaussKernel(sigma) {
  var r = Math.max(1, Math.ceil(3 * sigma)), k = new Float64Array(2 * r + 1), s = 0, i;
  for (i = -r; i <= r; i++) { var v = Math.exp(-(i * i) / (2 * sigma * sigma)); k[i + r] = v; s += v; }
  for (i = 0; i < k.length; i++) k[i] /= s;
  k.radius = r;
  return k;
}
/* 분리형 가우시안 흐림. 가장자리는 클램프. */
function _blur(src, w, h, sigma) {
  if (!(sigma > 0)) return Float64Array.from(src);
  var k = _gaussKernel(sigma), r = k.radius;
  var tmp = new Float64Array(w * h), out = new Float64Array(w * h), x, y, i, s, xx;
  for (y = 0; y < h; y++) {
    var row = y * w;
    for (x = 0; x < w; x++) {
      s = 0;
      for (i = -r; i <= r; i++) {
        xx = x + i; if (xx < 0) xx = 0; else if (xx >= w) xx = w - 1;
        s += src[row + xx] * k[i + r];
      }
      tmp[row + x] = s;
    }
  }
  for (x = 0; x < w; x++) {
    for (y = 0; y < h; y++) {
      s = 0;
      for (i = -r; i <= r; i++) {
        var yy = y + i; if (yy < 0) yy = 0; else if (yy >= h) yy = h - 1;
        s += tmp[yy * w + x] * k[i + r];
      }
      out[y * w + x] = s;
    }
  }
  return out;
}

/* 쌍선형 표본 (가장자리 클램프) */
function _bilerp(a, w, h, x, y) {
  if (x < 0) x = 0; else if (x > w - 1) x = w - 1;
  if (y < 0) y = 0; else if (y > h - 1) y = h - 1;
  var x0 = x | 0, y0 = y | 0, x1 = x0 + 1 < w ? x0 + 1 : x0, y1 = y0 + 1 < h ? y0 + 1 : y0;
  var fx = x - x0, fy = y - y0;
  var a00 = a[y0 * w + x0], a10 = a[y0 * w + x1], a01 = a[y1 * w + x0], a11 = a[y1 * w + x1];
  return a00 + (a10 - a00) * fx + (a01 - a00) * fy + (a11 - a10 - a01 + a00) * fx * fy;
}

/* ── ★표준 얼굴 캔버스 리샘플 ─────────────────────────────────────────────
   원본 RGBA 의 사각형 [bx0, bx0+bw) × [by0, by0+bh) 를 cw×ch 로 등방 리샘플한다.
   축소(scale<1)면 면적평균, 확대(scale>1)면 쌍선형. 가장자리는 클램프.
   ★x·y 를 같은 배율로만 다룬다 — 종횡비가 들어갈 자리가 없다. */
function _resampleRGB(D, W, H, bx0, by0, bw, bh, cw, ch) {
  var R = new Float64Array(cw * ch), G = new Float64Array(cw * ch), B = new Float64Array(cw * ch);
  var sx = bw / cw, sy = bh / ch;
  var X, Y;
  if (sx >= 1.0) {
    /* 면적평균 (정확한 부분 화소 가중) */
    for (Y = 0; Y < ch; Y++) {
      var v0 = by0 + Y * sy, v1 = v0 + sy;
      var iy0 = Math.floor(v0), iy1 = Math.ceil(v1) - 1;
      for (X = 0; X < cw; X++) {
        var u0 = bx0 + X * sx, u1 = u0 + sx;
        var ix0 = Math.floor(u0), ix1 = Math.ceil(u1) - 1;
        var ar = 0, ag = 0, ab = 0, aw = 0, py, px;
        for (py = iy0; py <= iy1; py++) {
          var wy = Math.min(py + 1, v1) - Math.max(py, v0); if (wy <= 0) continue;
          var cy = py < 0 ? 0 : (py >= H ? H - 1 : py);
          for (px = ix0; px <= ix1; px++) {
            var wx = Math.min(px + 1, u1) - Math.max(px, u0); if (wx <= 0) continue;
            var cxp = px < 0 ? 0 : (px >= W ? W - 1 : px);
            var ww = wx * wy, q = (cy * W + cxp) * 4;
            ar += D[q] * ww; ag += D[q + 1] * ww; ab += D[q + 2] * ww; aw += ww;
          }
        }
        var o = Y * cw + X;
        if (aw > 0) { R[o] = ar / aw; G[o] = ag / aw; B[o] = ab / aw; }
      }
    }
  } else {
    for (Y = 0; Y < ch; Y++) {
      var yy = by0 + (Y + 0.5) * sy - 0.5;
      for (X = 0; X < cw; X++) {
        var xx = bx0 + (X + 0.5) * sx - 0.5;
        var cxq = xx < 0 ? 0 : (xx > W - 1 ? W - 1 : xx);
        var cyq = yy < 0 ? 0 : (yy > H - 1 ? H - 1 : yy);
        var x0 = cxq | 0, y0 = cyq | 0;
        var x1 = x0 + 1 < W ? x0 + 1 : x0, y1 = y0 + 1 < H ? y0 + 1 : y0;
        var fx = cxq - x0, fy = cyq - y0;
        var o2 = Y * cw + X, c;
        for (c = 0; c < 3; c++) {
          var p00 = D[(y0 * W + x0) * 4 + c], p10 = D[(y0 * W + x1) * 4 + c];
          var p01 = D[(y1 * W + x0) * 4 + c], p11 = D[(y1 * W + x1) * 4 + c];
          var v = p00 + (p10 - p00) * fx + (p01 - p00) * fy + (p11 - p10 - p01 + p00) * fx * fy;
          if (c === 0) R[o2] = v; else if (c === 1) G[o2] = v; else B[o2] = v;
        }
      }
    }
  }
  return { R: R, G: G, B: B };
}

/* ── ★유효 영역 밖을 「가장 가까운 유효 화소 값」으로 채운다 ─────────────────
   왜 필요한가(실측으로 확인한 결함):
     얼굴 실루엣·눈·입술은 배경/자기 색과의 **계단**이다. 그 계단은 마스크에서 화소를
     빼는 것만으로는 사라지지 않는다 — DoG 의 지지폭이 ±3σ(조대) 이므로 경계에서
     10여 화소 안쪽까지 계단의 곁잎이 번져 들어와 「이마에 가로결이 있다」는
     가짜 방향성을 만든다. (天庭 민얼굴 방향성이 −0.79 로 나왔다.)
   그래서 필터를 걸기 **전에** 유효영역 밖을 가장 가까운 유효 화소 값으로 외삽해
   계단 자체를 없앤다. 2-pass 체임퍼 거리변환 + 최근접 인덱스 전파. */
function _nearestFill(src, valid, w, h) {
  var dist = new Float64Array(w * h), near = new Int32Array(w * h), i, x, y, j;
  for (i = 0; i < w * h; i++) { if (valid[i]) { dist[i] = 0; near[i] = i; } else { dist[i] = 1e12; near[i] = -1; } }
  var FW1 = [[-1, 0, 1], [0, -1, 1], [-1, -1, 1.41421356], [1, -1, 1.41421356]];
  var BW1 = [[1, 0, 1], [0, 1, 1], [1, 1, 1.41421356], [-1, 1, 1.41421356]];
  for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
    i = y * w + x;
    for (var k = 0; k < 4; k++) {
      var nx = x + FW1[k][0], ny = y + FW1[k][1];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      j = ny * w + nx;
      if (dist[j] + FW1[k][2] < dist[i]) { dist[i] = dist[j] + FW1[k][2]; near[i] = near[j]; }
    }
  }
  for (y = h - 1; y >= 0; y--) for (x = w - 1; x >= 0; x--) {
    i = y * w + x;
    for (var k2 = 0; k2 < 4; k2++) {
      var nx2 = x + BW1[k2][0], ny2 = y + BW1[k2][1];
      if (nx2 < 0 || ny2 < 0 || nx2 >= w || ny2 >= h) continue;
      j = ny2 * w + nx2;
      if (dist[j] + BW1[k2][2] < dist[i]) { dist[i] = dist[j] + BW1[k2][2]; near[i] = near[j]; }
    }
  }
  var out = new Float64Array(w * h);
  for (i = 0; i < w * h; i++) out[i] = (near[i] >= 0) ? src[near[i]] : src[i];
  return out;
}

/* 분리형 최대필터로 마스크를 반지름 r 만큼 팽창시킨다(정사각 근사) */
function _dilate(mask, w, h, r) {
  if (!(r > 0)) return mask;
  var t = new Uint8Array(w * h), o2 = new Uint8Array(w * h), x, y, i, v;
  for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
    v = 0;
    for (i = -r; i <= r; i++) { var xx = x + i; if (xx < 0 || xx >= w) continue; if (mask[y * w + xx]) { v = 1; break; } }
    t[y * w + x] = v;
  }
  for (x = 0; x < w; x++) for (y = 0; y < h; y++) {
    v = 0;
    for (i = -r; i <= r; i++) { var yy = y + i; if (yy < 0 || yy >= h) continue; if (t[yy * w + x]) { v = 1; break; } }
    o2[y * w + x] = v;
  }
  return o2;
}

/* 연결요소 라벨링 (8-이웃). mask 는 Uint8Array, 반환은 컴포넌트 배열. */
function _components(mask, w, h, limitMask) {
  var lab = new Int32Array(w * h), comps = [], id = 0;
  var stack = new Int32Array(w * h), sp;
  for (var i = 0; i < w * h; i++) {
    if (!mask[i] || lab[i] || (limitMask && !limitMask[i])) continue;
    id++;
    sp = 0; stack[sp++] = i; lab[i] = id;
    var px = [], minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
    while (sp > 0) {
      var p = stack[--sp]; px.push(p);
      var x = p % w, y = (p / w) | 0;
      if (x < minx) minx = x; if (x > maxx) maxx = x;
      if (y < miny) miny = y; if (y > maxy) maxy = y;
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        var nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        var np = ny * w + nx;
        if (mask[np] && !lab[np] && (!limitMask || limitMask[np])) { lab[np] = id; stack[sp++] = np; }
      }
    }
    comps.push({ id: id, px: px, area: px.length, minx: minx, maxx: maxx, miny: miny, maxy: maxy,
      maxDim: Math.max(maxx - minx + 1, maxy - miny + 1) });
  }
  return { labels: lab, comps: comps };
}

/* ============================================================================
   5. 메인
   ========================================================================== */
function measureTexture(imageData, landmarks, aspect, opts) {
  var o = {}, k;
  for (k in DEFAULTS) o[k] = DEFAULTS[k];
  if (opts) for (k in opts) if (opts[k] !== undefined) o[k] = opts[k];

  var mode = o.normMode;
  var mRaw = (mode === 'raw');
  var useResample = !(mRaw || mode === 'no_resample');
  var useBandpass = !(mode === 'no_bandpass');          // ★raw 에서도 DoG 는 유지한다(위 주석 참조)
  var useFaceNorm = !(mRaw || mode === 'no_face_norm');
  var useLog = !(mRaw || mode === 'no_log');
  var badOrient = (mode === 'bad_orientation');

  function rej(gate, reason) {
    return { ok: false, reject: { gate: gate, reason: reason },
      meta: { version: SENSOR_TEXTURE_VERSION, normMode: mode },
      norm: null, regions: null, indang: null, groups: null };
  }

  /* ── G1 입력 유효성 ─────────────────────────────────────────── */
  if (!imageData || !imageData.data || !(imageData.width > 0) || !(imageData.height > 0))
    return rej('G1', 'imageData 가 없거나 폭·높이가 0 이다');
  var W = imageData.width | 0, H = imageData.height | 0, D = imageData.data;
  if (D.length < W * H * 4) return rej('G1', 'RGBA 버퍼 길이가 폭×높이×4 보다 짧다');
  if (!landmarks || landmarks.length < 468)
    return rej('G1', '랜드마크가 468개 미만이다 (len=' + (landmarks ? landmarks.length : 0) + ')');
  for (var t0 = 0; t0 < 468; t0++) {
    var lp = landmarks[t0];
    if (!lp || !isFinite(lp.x) || !isFinite(lp.y)) return rej('G1', 'LM' + t0 + ' 좌표가 유한하지 않다');
  }

  /* ── 원본 픽셀좌표에서 얼굴 크기 ──────────────────────────── */
  var ovalSrc = IN.ring2px(IN.OVAL, landmarks, W, H);
  if (!ovalSrc) return rej('G1', '얼굴 윤곽 폴리곤을 만들 수 없다');
  var mnX = Infinity, mxX = -Infinity, mnY = Infinity, mxY = -Infinity;
  for (var i0 = 0; i0 < ovalSrc.length; i0++) {
    var p0 = ovalSrc[i0];
    if (p0[0] < mnX) mnX = p0[0]; if (p0[0] > mxX) mxX = p0[0];
    if (p0[1] < mnY) mnY = p0[1]; if (p0[1] > mxY) mxY = p0[1];
  }
  var faceW = mxX - mnX, faceH = mxY - mnY;
  if (!(faceW > 0) || !(faceH > 0)) return rej('G1', '얼굴 윤곽의 폭·높이가 0 이다');

  /* ── G2 얼굴이 화면 안에 있는가 ───────────────────────────── */
  var tolSrc = Math.max(2, Math.round(Math.min(W, H) * 0.01));
  if (mnX < -tolSrc || mxX > W + tolSrc || mnY < -tolSrc || mxY > H + tolSrc)
    return rej('G2', '얼굴 윤곽이 화면 밖으로 나갔다 — 마스크 밖 화소가 섞인다');

  /* ── G3 ★유효 해상도 게이트 ──────────────────────────────── */
  if (faceW < o.minFaceWidthPx)
    return rej('G3', '원본에서 얼굴 폭이 ' + faceW.toFixed(1) + 'px 뿐이다 (최소 ' + o.minFaceWidthPx +
      ') — 표준 캔버스로 확대해도 없는 고주파는 만들어지지 않는다');

  /* ── ★표준 얼굴 캔버스 ────────────────────────────────────── */
  var scale = useResample ? (o.faceRefPx / faceW) : 1.0;
  var mg = o.margin * faceW;
  var bx0 = mnX - mg, by0 = mnY - mg, bw = faceW + 2 * mg, bh = faceH + 2 * mg;
  var cw = Math.max(8, Math.round(bw * scale)), ch = Math.max(8, Math.round(bh * scale));
  if (cw > o.maxCanvas || ch > o.maxCanvas) {
    var sh = Math.min(o.maxCanvas / cw, o.maxCanvas / ch);
    scale *= sh; cw = Math.max(8, Math.round(bw * scale)); ch = Math.max(8, Math.round(bh * scale));
  }
  var RGB = _resampleRGB(D, W, H, bx0, by0, bw, bh, cw, ch);

  /* 표준 캔버스 좌표계의 유사 랜드마크 (정규화 좌표) */
  var lmStd = new Array(landmarks.length);
  for (var li = 0; li < landmarks.length; li++) {
    var q0 = landmarks[li];
    if (!q0 || !isFinite(q0.x) || !isFinite(q0.y)) { lmStd[li] = { x: 0.5, y: 0.5 }; continue; }
    lmStd[li] = { x: ((q0.x * W - bx0) * scale) / cw, y: ((q0.y * H - by0) * scale) / ch };
  }
  function poly(ring, shrink) {
    var p = IN.ring2px(ring, lmStd, cw, ch);
    return p ? IN.shrinkPoly(p, shrink || 0) : null;
  }

  /* ── 제외 마스크 (색 센서와 같은 원리·같은 고리) ──────────── */
  var exclFull = new Uint8Array(cw * ch);    // 눈·눈썹·콧구멍·입술
  var exclNoBrow = new Uint8Array(cw * ch);  // 눈썹을 재는 부위용
  var exclNoLip = new Uint8Array(cw * ch);   // 脣을 재는 부위용
  (function () {
    var parts = [
      [poly(IN.EYE_R, -0.45), 'EYE'], [poly(IN.EYE_L, -0.45), 'EYE'],
      [poly(IN.BROW_R, -0.35), 'BROW'], [poly(IN.BROW_L, -0.35), 'BROW'],
      [poly(IN.NOSTRIL, -0.20), 'NOSE'], [poly(IN.LIP_OUTER, -0.25), 'LIP']
    ];
    for (var e = 0; e < parts.length; e++) {
      if (!parts[e][0]) continue;
      var ex = IN.fillPolys([parts[e][0]], cw, ch);
      for (var j = 0; j < ex.length; j++) {
        exclFull[ex[j]] = 1;
        if (parts[e][1] !== 'BROW') exclNoBrow[ex[j]] = 1;
        if (parts[e][1] !== 'LIP') exclNoLip[ex[j]] = 1;
      }
    }
  })();
  function pickExcl(skip) { return skip === 'BROW' ? exclNoBrow : (skip === 'LIP' ? exclNoLip : exclFull); }
  function subExcl(idx, m) {
    var out = [], i;
    for (i = 0; i < idx.length; i++) if (!m[idx[i]]) out.push(idx[i]);
    return Int32Array.from(out);
  }
  function inFrame(p) {
    var tol = Math.max(2, Math.round(Math.min(cw, ch) * 0.01));
    for (var i = 0; i < p.length; i++)
      if (p[i][0] < -tol || p[i][0] > cw + tol || p[i][1] < -tol || p[i][1] > ch + tol) return false;
    return true;
  }

  /* ★해석 영역(analysis oval) — 얼굴 윤곽 바로 안쪽.
     모든 부위 마스크를 여기에 한 번 더 가둔다. 그러지 않으면 天庭·輔角·耳門之前 폴리곤이
     얼굴 실루엣을 넘어가 **배경과의 계단**을 주름으로 읽는다(실측으로 확인했다). */
  var ovalInsetP = poly(IN.OVAL, o.ovalInsetShrink);
  if (!ovalInsetP) return rej('G1', '표준 캔버스에서 얼굴 윤곽 폴리곤을 만들 수 없다');
  var ovalMask = new Uint8Array(cw * ch);
  (function () {
    var oi = IN.fillPolys([ovalInsetP], cw, ch);
    for (var i = 0; i < oi.length; i++) ovalMask[oi[i]] = 1;
  })();

  var ovalStd = poly(IN.OVAL, 0.08);
  if (!ovalStd) return rej('G1', '표준 캔버스에서 얼굴 윤곽 폴리곤을 만들 수 없다');
  var skinIdx = subExcl(IN.fillPolys([ovalStd], cw, ch), exclFull);
  if (skinIdx.length < o.minSkinPx)
    return rej('G5', '표준 캔버스의 피부 기준 화소가 ' + skinIdx.length + '개뿐이다 (최소 ' + o.minSkinPx + ')');
  var skinMask = new Uint8Array(cw * ch);
  for (var s0 = 0; s0 < skinIdx.length; s0++) skinMask[skinIdx[s0]] = 1;

  /* ── 채널 : log 휘도 + log 대립색 ─────────────────────────── */
  var N = cw * ch;
  var Y = new Float64Array(N), CA = new Float64Array(N), CB = new Float64Array(N);
  for (var pi = 0; pi < N; pi++) {
    var R1 = RGB.R[pi], G1 = RGB.G[pi], B1 = RGB.B[pi];
    if (useLog) {
      var lr = _llog(R1), lg = _llog(G1), lb = _llog(B1);
      Y[pi] = 0.299 * lr + 0.587 * lg + 0.114 * lb;
      CA[pi] = lr - (lg + lb) / 2; CB[pi] = (lr + lg) / 2 - lb;
    } else {
      Y[pi] = (0.299 * R1 + 0.587 * G1 + 0.114 * B1) / 255;
      CA[pi] = (R1 - (G1 + B1) / 2) / 255; CB[pi] = ((R1 + G1) / 2 - B1) / 255;
    }
  }

  /* ── G6 피부 타당성 — 사람 피부는 R>G>B 로 따뜻하다 ───────── */
  (function () { })();
  var sa = new Float64Array(skinIdx.length), sb = new Float64Array(skinIdx.length), syv = new Float64Array(skinIdx.length);
  for (var z0 = 0; z0 < skinIdx.length; z0++) { sa[z0] = CA[skinIdx[z0]]; sb[z0] = CB[skinIdx[z0]]; syv[z0] = Y[skinIdx[z0]]; }
  var medA = _quant(Float64Array.from(sa).sort(), 0.5), medB = _quant(Float64Array.from(sb).sort(), 0.5);
  var warmMin = useLog ? 0.02 : 0.016;
  if (!(medA > warmMin && medB > warmMin))
    return rej('G6', '기준면이 피부의 색 순서(R>G>B)를 만족하지 않는다 (a=' + medA.toFixed(3) + ' b=' + medB.toFixed(3) +
      ') — 마스크가 얼굴에 얹혀 있지 않다');
  var skinYmean = _mean(syv), skinYsd = _sdOf(syv, skinYmean);
  var skinYmed = _quant(Float64Array.from(syv).sort(), 0.5);
  if (!(skinYsd > 1e-4))
    return rej('G6', '기준면의 밝기 분산이 사실상 0 이다 (σ=' + skinYsd.toExponential(2) + ') — 얼굴 사진이 아니다');

  /* ── ★분석 스택 ───────────────────────────────────────────────────────────
     스택을 **둘** 만든다. 실측으로 확인한 결함 때문이다.

       ㉠ 눈썹은 印堂 바로 양옆에 있는 강한 계단이다. 눈썹을 그대로 둔 채 필터를 걸면
          그 계단의 곁잎(DoG 지지폭 ±3σ)이 印堂 안까지 들어와
          **주름이 하나도 없는 얼굴에서 印堂 세로결이 1.00** 으로 나온다.
       ㉡ 그렇다고 눈썹을 메워 버리면 眉의 털 결(毛逆·亂)을 잴 수 없다.

     ⟹ keepBrow=false 스택(피부 부위 전용) 과 keepBrow=true 스택(눈썹 전용) 을 따로 만든다.
        얼굴 기준값(faceBandRMS 등)은 **피부 스택의 것**을 공통으로 쓴다.

     스택 안에서 하는 일
       ① 유효영역 밖(배경·눈·입술·콧구멍[·눈썹])을 최근접 유효 화소 값으로 **외삽** — 계단 제거
       ② log 휘도 대역통과(DoG)
       ③ 이물/덩어리 분리 + ★후광(halo) 팽창 — 매우 어두운 선은 그 자체보다
          **주변에 만드는 DoG 곁잎**이 더 크다. 그 곁잎까지 빼지 않으면
          머리카락 한 올이 「주름 세기 0.97」(진짜 주름 0.29의 3배)로 읽힌다(실측).
       ④ 구조텐서 + 선/계단 대칭도(sym) */
  var DEG = 180 / Math.PI;
  var Y0 = Y, CA0 = CA, CB0 = CB;
  var eyeLipMask = new Uint8Array(N), browMask = new Uint8Array(N);
  (function () {
    var parts = [poly(IN.EYE_R, -0.45), poly(IN.EYE_L, -0.45), poly(IN.NOSTRIL, -0.20), poly(IN.LIP_OUTER, -0.25)];
    for (var e = 0; e < parts.length; e++) {
      if (!parts[e]) continue;
      var ex = IN.fillPolys([parts[e]], cw, ch);
      for (var j = 0; j < ex.length; j++) eyeLipMask[ex[j]] = 1;
    }
    var bp2 = [poly(IN.BROW_R, -0.30), poly(IN.BROW_L, -0.30)];
    for (var e2 = 0; e2 < bp2.length; e2++) {
      if (!bp2[e2]) continue;
      var bx = IN.fillPolys([bp2[e2]], cw, ch);
      for (var j2 = 0; j2 < bx.length; j2++) browMask[bx[j2]] = 1;
    }
  })();

  function buildStack(keepBrow) {
    var i, p;
    var valid = new Uint8Array(N), nValid = 0;
    for (i = 0; i < N; i++) {
      valid[i] = (ovalMask[i] && !eyeLipMask[i] && (keepBrow || !browMask[i])) ? 1 : 0;
      nValid += valid[i];
    }
    if (nValid < o.minSkinPx) return { fail: '외삽 유효영역이 ' + nValid + '화소뿐이다' };
    var Yv = _nearestFill(Y0, valid, cw, ch);
    var Av = _nearestFill(CA0, valid, cw, ch);
    var Bv = _nearestFill(CB0, valid, cw, ch);

    var Yf = _blur(Yv, cw, ch, o.sigmaFine);
    var band = new Float64Array(N), coarseBand = null;
    if (useBandpass) {
      var Yc = _blur(Yv, cw, ch, o.sigmaCoarse);
      for (i = 0; i < N; i++) band[i] = Yf[i] - Yc[i];
      if (!keepBrow) {
        /* ★초점 게이트용 조대대역 — 흐림에 대해 단조로운 기준을 얻기 위해 한 옥타브 위를 잰다 */
        var Ycc = _blur(Yv, cw, ch, o.focusCoarseK * o.sigmaCoarse);
        coarseBand = new Float64Array(N);
        for (i = 0; i < N; i++) coarseBand[i] = Yc[i] - Ycc[i];
      }
    } else {
      for (i = 0; i < N; i++) band[i] = Yv[i] - skinYmean;   // 변이: 저주파가 그대로 남는다
    }

    /* 이물·덩어리 ★혼동 방어 Ⓐ */
    var occThr = o.occLogContrast * (useLog ? 1 : 0.30);
    var darkMask = new Uint8Array(N);
    for (i = 0; i < N; i++) if (ovalMask[i] && band[i] < -occThr) darkMask[i] = 1;
    var CC = _components(darkMask, cw, ch, ovalMask);
    var occMask = new Uint8Array(N), blobComps = [];
    for (var ci = 0; ci < CC.comps.length; ci++) {
      var c0 = CC.comps[ci];
      if ((c0.area >= o.occMinArea) || (c0.maxDim >= o.occMaxDim)) {
        for (var cp = 0; cp < c0.px.length; cp++) occMask[c0.px[cp]] = 1;
      } else if (c0.area >= o.blobMinArea) blobComps.push(c0);
    }
    /* ★후광까지 뺀다 — 어두운 선이 주변에 만드는 DoG 곁잎이 주름으로 읽히지 않도록 */
    var haloR = Math.max(1, Math.round(o.haloDilateK * o.sigmaCoarse));
    var haloMask = _dilate(darkMask, cw, ch, haloR);
    var occHalo = _dilate(occMask, cw, ch, haloR);

    var accE = 0, accN = 0;
    for (var f0 = 0; f0 < skinIdx.length; f0++) {
      var sp0 = skinIdx[f0];
      if (haloMask[sp0]) continue;
      accE += band[sp0] * band[sp0]; accN++;
    }
    var faceBandRMS = accN ? Math.sqrt(accE / accN) : 0;
    if (!(faceBandRMS > 0)) return { fail: '얼굴 기준면의 대역통과 에너지가 0 이다 — 완전 평면 이미지다' };
    var faceCoarseRMS = 0;
    if (coarseBand) {
      var accC = 0, accCN = 0;
      for (var h0 = 0; h0 < skinIdx.length; h0++) {
        var sp2 = skinIdx[h0];
        if (haloMask[sp2]) continue;
        accC += coarseBand[sp2] * coarseBand[sp2]; accCN++;
      }
      faceCoarseRMS = accCN ? Math.sqrt(accC / accCN) : 0;
    }

    return { valid: valid, faceCoarseRMS: faceCoarseRMS, Yv: Yv, Yf: Yf, band: band, Av: Av, Bv: Bv,
      darkMask: darkMask, occMask: occMask, haloMask: haloMask, occHalo: occHalo,
      blobComps: blobComps, comps: CC.comps, faceBandRMS: faceBandRMS };
  }

  function finishStack(st, faceBandRMSRef) {
    var i;
    var gx = new Float64Array(N), gy = new Float64Array(N), band = st.band;
    for (var y = 0; y < ch; y++) for (var x = 0; x < cw; x++) {
      var xm = x > 0 ? x - 1 : 0, xp = x < cw - 1 ? x + 1 : cw - 1;
      var ym = y > 0 ? y - 1 : 0, yp = y < ch - 1 ? y + 1 : ch - 1;
      var a00 = band[ym * cw + xm], a01 = band[ym * cw + x], a02 = band[ym * cw + xp];
      var a10 = band[y * cw + xm], a12 = band[y * cw + xp];
      var a20 = band[yp * cw + xm], a21 = band[yp * cw + x], a22 = band[yp * cw + xp];
      var o1 = y * cw + x;
      gx[o1] = ((a02 + 2 * a12 + a22) - (a00 + 2 * a10 + a20)) / 8;
      gy[o1] = ((a20 + 2 * a21 + a22) - (a00 + 2 * a01 + a02)) / 8;
    }
    var gxx = new Float64Array(N), gyy = new Float64Array(N), gxy = new Float64Array(N);
    for (i = 0; i < N; i++) { gxx[i] = gx[i] * gx[i]; gyy[i] = gy[i] * gy[i]; gxy[i] = gx[i] * gy[i]; }
    var Jxx = _blur(gxx, cw, ch, o.sigmaTensor), Jyy = _blur(gyy, cw, ch, o.sigmaTensor), Jxy = _blur(gxy, cw, ch, o.sigmaTensor);
    st.Af = _blur(st.Av, cw, ch, o.sigmaFine);
    st.Bf = _blur(st.Bv, cw, ch, o.sigmaFine);

    var bandFloor = o.bandFloorK * faceBandRMSRef, symEps = 0.05 * faceBandRMSRef;
    var symArr = new Float64Array(N), cohArr = new Float64Array(N), degArr = new Float64Array(N);
    var voteArr = new Uint8Array(N);
    for (var p = 0; p < N; p++) {
      if (!ovalMask[p]) continue;
      var b = band[p], ab = b < 0 ? -b : b;
      var jxx = Jxx[p], jyy = Jyy[p], jxy = Jxy[p], tr = jxx + jyy;
      if (!(tr > 0)) continue;
      var dif = jxx - jyy, rad = Math.sqrt(dif * dif + 4 * jxy * jxy);
      var th = 0.5 * Math.atan2(2 * jxy, dif);
      var nx = Math.cos(th), ny = Math.sin(th);
      var xC = p % cw, yC = (p / cw) | 0;
      var pd = o.probeK * o.sigmaCoarse;
      var bp = _bilerp(band, cw, ch, xC + pd * nx, yC + pd * ny);
      var bm = _bilerp(band, cw, ch, xC - pd * nx, yC - pd * ny);
      var sym = 1 - Math.abs(bp - bm) /
        (Math.abs(bp) + Math.abs(bm) + o.probeCenterK * ab + symEps);
      if (sym < 0) sym = 0;
      var phi = badOrient ? th : (th + Math.PI / 2);
      symArr[p] = sym; cohArr[p] = rad / tr;
      degArr[p] = ((phi * DEG) % 180 + 180) % 180;
      /* ★하한(bandFloor)은 **방향 투표·선순도에만** 쓴다.
         에너지 계산에까지 하한을 쓰면 초점이 흐려질 때 통과 화소 수가 급변해
         값이 크게 흔들린다(실측: σ3.2 에서 31% 변동). 에너지는 sym 가중만으로 매끄럽게 잰다. */
      voteArr[p] = (ab >= bandFloor) ? 1 : 0;
    }
    st.symArr = symArr; st.cohArr = cohArr; st.degArr = degArr; st.voteArr = voteArr;
    st.bandFloor = bandFloor;
    return st;
  }

  var ST = buildStack(false);
  if (ST.fail) return rej('G5', ST.fail);
  var faceBandRMS = ST.faceBandRMS;

  /* ── G7 ★초점 게이트 ─────────────────────────────────────── */
  var focusScore = useBandpass ? (faceBandRMS / (ST.faceCoarseRMS > 0 ? ST.faceCoarseRMS : 1e-9))
                               : (faceBandRMS / (skinYsd > 0 ? skinYsd : 1e-9));
  if (focusScore < o.focusMin)
    return rej('G7', '초점 지표가 ' + focusScore.toFixed(4) + ' 로 하한 ' + o.focusMin +
      ' 미만이다 — 고주파가 물리적으로 사라졌다. 텍스처를 잴 수 없다');

  finishStack(ST, faceBandRMS);

  /* 눈썹 스택 — 눈썹을 남긴 채 같은 사슬을 한 번 더 지난다 */
  var STB = buildStack(true);
  if (STB.fail) STB = null; else finishStack(STB, faceBandRMS);

  function gradMagIn(a, idx) {
    var x = idx % cw, y = (idx / cw) | 0;
    var xm = x > 0 ? x - 1 : 0, xp = x < cw - 1 ? x + 1 : cw - 1;
    var ym = y > 0 ? y - 1 : 0, yp = y < ch - 1 ? y + 1 : ch - 1;
    var dx = (a[y * cw + xp] - a[y * cw + xm]) / 2, dy = (a[yp * cw + x] - a[ym * cw + x]) / 2;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /* 얼굴 기준 「선 에너지」 (energyRef='line' 일 때의 분모) */
  var accL = 0, accLN = 0;
  for (var g0 = 0; g0 < skinIdx.length; g0++) {
    var sp1 = skinIdx[g0];
    if (ST.haloMask[sp1]) continue;
    accLN++;
    accL += ST.band[sp1] * ST.band[sp1] * ST.symArr[sp1];
  }
  var faceLineRMS = accLN ? Math.sqrt(accL / accLN) : 0;
  var energyDenom = (o.energyRef === 'band') ? faceBandRMS : (faceLineRMS > 0 ? faceLineRMS : faceBandRMS);

  /* ── 부위별 계측 ──────────────────────────────────────────── */
  function measureRegion(idx, hairIsSignal) {
    var st = (hairIsSignal && STB) ? STB : ST;
    var band = st.band, symArr = st.symArr, cohArr = st.cohArr, degArr = st.degArr, voteArr = st.voteArr;
    var occMask = st.occHalo, darkMask = st.haloMask, excludeFromLine = st.haloMask;
    var Yf = st.Yf, Af = st.Af, Bf = st.Bf;
    var gradMag = gradMagIn;
    var nAll = idx.length;
    var occ = 0, drk = 0, i, p;
    for (i = 0; i < nAll; i++) {
      if (occMask[idx[i]]) occ++;
      if (darkMask[idx[i]]) drk++;
    }
    var occFrac = nAll ? occ / nAll : 1;
    var darkFrac = nAll ? drk / nAll : 1;

    var NB = 36, hist = new Float64Array(NB);          // 0..180deg, 5deg bins
    var sumW = 0, sumWC = 0, cos2 = 0, sin2 = 0;
    var lineE = 0, totE = 0, lineW = 0, stepW = 0;
    var chromaN = 0, chromaD = 0, nUsed = 0;

    for (i = 0; i < nAll; i++) {
      p = idx[i];
      if (!hairIsSignal && excludeFromLine[p]) continue;
      nUsed++;
      var b = band[p];
      var sym = symArr[p], coh = cohArr[p], deg = degArr[p];
      var w = b * b * sym;
      totE += b * b;
      lineE += w;                                   // ★에너지는 하한 없이 매끄럽게
      if (!voteArr[p]) continue;                    // ★방향 투표·선순도만 하한을 건다
      lineW += w; stepW += b * b * (1 - sym);

      var bi = Math.floor(deg / (180 / NB)); if (bi >= NB) bi = NB - 1;
      var wv = w * coh;
      hist[bi] += wv; sumW += wv; sumWC += coh * w;
      var dbl = 2 * deg / DEG;
      cos2 += wv * Math.cos(dbl); sin2 += wv * Math.sin(dbl);

      /* 색 경계 비 */
      var gl = gradMag(Yf, p);
      var gc = Math.sqrt(gradMag(Af, p) * gradMag(Af, p) + gradMag(Bf, p) * gradMag(Bf, p));
      chromaN += gc; chromaD += gl;
    }

    var denom = useFaceNorm ? energyDenom : 1;
    var wrinkleEnergy = nUsed ? Math.sqrt(lineE / nUsed) / denom : 0;

    var vf = 0, hf = 0, df = 0;
    for (i = 0; i < NB; i++) {
      var dc = (i + 0.5) * (180 / NB);
      var dv = Math.abs(dc - 90);
      var dh = Math.min(dc, 180 - dc);
      if (dv <= o.sectorHalf) vf += hist[i];
      else if (dh <= o.sectorHalf) hf += hist[i];
      else df += hist[i];
    }
    var tot3 = vf + hf + df;
    if (tot3 > 0) { vf /= tot3; hf /= tot3; df /= tot3; }

    var conc = sumW > 0 ? Math.sqrt(cos2 * cos2 + sin2 * sin2) / sumW : 0;
    var oriDeg = sumW > 0 ? (((0.5 * Math.atan2(sin2, cos2) * DEG) % 180) + 180) % 180 : null;

    return {
      pixels: nAll,
      occluderFrac: occFrac,
      darkFrac: darkFrac,
      wrinkleEnergy: wrinkleEnergy,
      wrinkleOrientationDeg: (tot3 > 0) ? oriDeg : null,
      orientationCoherence: (lineW > 0) ? sumWC / lineW : 0,
      orientationConcentration: conc,
      vertFrac: (tot3 > 0) ? vf : null,
      horizFrac: (tot3 > 0) ? hf : null,
      diagFrac: (tot3 > 0) ? df : null,
      directionality: (tot3 > 0) ? (vf - hf) : null,
      crossingIndex: (tot3 > 0) ? 2 * Math.sqrt(vf * hf) : null,
      ridgeValleyPurity: (lineW + stepW > 0) ? lineW / (lineW + stepW) : null,
      chromaEdgeRatio: (chromaD > 0) ? chromaN / chromaD : null,
      _lineEnergyAbs: nUsed ? Math.sqrt(lineE / nUsed) : 0,
      _totEnergyAbs: nUsed ? Math.sqrt(totE / nUsed) : 0
    };
  }

  /* 덩어리(점·흉터) 지표 — ★비율(frac)은 내지 않는다. sensor_color.darkSpotFrac 이 이미 낸다. */
  function measureBlobs(regionMaskSet, nAll) {
    var blobComps = ST.blobComps, darkMask = ST.darkMask, Yf = ST.Yf, gradMag = gradMagIn;
    var picked = [], i;
    for (i = 0; i < blobComps.length; i++) {
      var c = blobComps[i], inside = 0, j;
      for (j = 0; j < c.px.length; j++) if (regionMaskSet[c.px[j]]) inside++;
      if (inside >= 0.6 * c.area) picked.push(c);
    }
    if (!picked.length) return { count: 0, meanElongation: null, meanEdgeSharpness: null, maxRelief: null, reliable: true };
    if (picked.length > o.maxBlobs)
      return { count: picked.length, meanElongation: null, meanEdgeSharpness: null, maxRelief: null,
        reliable: false, reason: 'TOO_MANY_DARK_COMPONENTS(' + picked.length + '>' + o.maxBlobs + ') — 점이 아니라 수염·잡티·모공이다' };

    var elo = [], shp = [], rel = [];
    for (i = 0; i < picked.length; i++) {
      var cc = picked[i], px = cc.px, n = px.length;
      var mx = 0, my = 0, j2;
      for (j2 = 0; j2 < n; j2++) { mx += px[j2] % cw; my += (px[j2] / cw) | 0; }
      mx /= n; my /= n;
      var sxx = 0, syy = 0, sxy = 0, depth = 0, gsum = 0, gcnt = 0, dxsum = 0, dysum = 0, inMean = 0;
      for (j2 = 0; j2 < n; j2++) {
        var q = px[j2], qx = q % cw, qy = (q / cw) | 0, ux = qx - mx, uy = qy - my;
        sxx += ux * ux; syy += uy * uy; sxy += ux * uy;
        depth += (skinYmed - Yf[q]);
        inMean += Yf[q];
      }
      sxx /= n; syy /= n; sxy /= n; depth /= n; inMean /= n;
      var tr2 = sxx + syy, rd = Math.sqrt((sxx - syy) * (sxx - syy) + 4 * sxy * sxy);
      var l1 = (tr2 + rd) / 2, l2 = (tr2 - rd) / 2;
      elo.push(l2 > 1e-6 ? Math.sqrt(l1 / l2) : 6);
      var rEq = Math.sqrt(n / Math.PI);

      /* 경계 화소의 밝기 기울기 */
      for (j2 = 0; j2 < n; j2++) {
        var q2 = px[j2], x2 = q2 % cw, y2 = (q2 / cw) | 0, isB = false;
        if (x2 <= 0 || y2 <= 0 || x2 >= cw - 1 || y2 >= ch - 1) isB = true;
        else if (!darkMask[q2 - 1] || !darkMask[q2 + 1] || !darkMask[q2 - cw] || !darkMask[q2 + cw]) isB = true;
        if (isB) { gsum += gradMag(Yf, q2); gcnt++; }
      }
      shp.push((depth > 1e-6 && gcnt) ? (gsum / gcnt) * rEq / depth : 0);

      /* 융기(1차 기울기) */
      for (j2 = 0; j2 < n; j2++) {
        var q3 = px[j2], x3 = q3 % cw, y3 = (q3 / cw) | 0;
        var dv = Yf[q3] - inMean;
        dxsum += dv * (x3 - mx); dysum += dv * (y3 - my);
      }
      var mom = Math.sqrt(dxsum * dxsum + dysum * dysum) / n;
      var inertia = (sxx + syy) > 1e-6 ? (sxx + syy) / 2 : 1;
      rel.push(depth > 1e-6 ? (mom / inertia) * rEq / depth : 0);
    }
    return {
      count: picked.length,
      meanElongation: _mean(elo),
      meanEdgeSharpness: _mean(shp),
      maxRelief: Math.max.apply(null, rel),
      reliable: true
    };
  }

  var regions = {}, rejectedRegions = [];
  var regionIdxCache = {};
  for (var rn in TEXTURE_REGIONS) {
    var def = TEXTURE_REGIONS[rn];
    var outer = poly(def.ring, def.shrink);
    if (!outer) { regions[rn] = null; rejectedRegions.push(rn + ':NO_POLY'); continue; }
    if (!inFrame(outer)) { regions[rn] = null; rejectedRegions.push(rn + ':OUT_OF_FRAME'); continue; }
    var polys = [outer];
    if (def.holes) for (var hh = 0; hh < def.holes.length; hh++) {
      var hp = poly(def.holes[hh], 0); if (hp) polys.push(hp);
    }
    /* ★부위 마스크를 얼굴 윤곽 안쪽(ovalMask)으로 한 번 더 자른다 — 실루엣 계단 차단 */
    var idxRaw = subExcl(IN.fillPolys(polys, cw, ch), pickExcl(def.skipExcl));
    var keep = [];
    for (var ki = 0; ki < idxRaw.length; ki++) if (ovalMask[idxRaw[ki]]) keep.push(idxRaw[ki]);
    var idx = Int32Array.from(keep);
    if (idx.length < o.minRegionPx) { regions[rn] = null; rejectedRegions.push(rn + ':TOO_SMALL(' + idx.length + ')'); continue; }
    regionIdxCache[rn] = idx;

    var m = measureRegion(idx, !!def.hairIsSignal);
    m.ko = def.ko;
    m.maskSource = def.src;
    m.hairIsSignal = !!def.hairIsSignal;
    m.maskClippedFrac = 1 - idx.length / idxRaw.length;

    /* 부위 신뢰 게이트 — 이물이 너무 많으면 텍스처 판정 자체를 신뢰할 수 없다.
       ★눈썹은 예외다: 거기서는 털이 이물이 아니라 재려는 신호다. */
    if (def.hairIsSignal) { m.textureReliable = true; }
    else {
      m.textureReliable = (m.occluderFrac <= o.regionOccFracMax) && (m.darkFrac <= o.regionDarkFracMax);
      if (!m.textureReliable) m.unreliableReason = 'OCCLUDED(이물 ' + (m.occluderFrac * 100).toFixed(1) + '% · 어두움 ' +
        (m.darkFrac * 100).toFixed(1) + '%) — 모발·수염·안경테 등이 부위를 덮었다';
    }

    /* 덩어리 지표는 눈썹처럼 원래 털이 있는 부위에서는 내지 않는다 */
    if (def.skipExcl === 'BROW') {
      m.blobs = { count: null, reliable: false, reason: 'BROW_REGION — 눈썹은 원래 털이다. 점·흉터 판정 대상이 아니다' };
    } else {
      var rset = new Uint8Array(N);
      for (var ri = 0; ri < idx.length; ri++) rset[idx[ri]] = 1;
      m.blobs = measureBlobs(rset, idx.length);
    }
    regions[rn] = m;
  }

  /* ── 印堂 세로선 개수 (懸針 1 · 川字 3) ───────────────────── */
  var indang = (function () {
    var res = { count: null, status: 'UNMEASURABLE', reason: '', profilePeaks: null, profileWidthPx: null };
    var idx = regionIdxCache.INDANG;
    var rr = regions.INDANG;
    if (!idx || !rr) { res.reason = '印堂 마스크가 없다'; return res; }
    if (!rr.textureReliable) { res.reason = '印堂이 이물로 덮였다 — ' + rr.unreliableReason; return res; }
    if (!(rr.wrinkleEnergy >= o.vlMinEnergy)) {
      res.reason = '印堂 wrinkleEnergy=' + rr.wrinkleEnergy.toFixed(2) + ' 가 임계 ' + o.vlMinEnergy +
        ' 미만이다 — 셀 만한 세로선이 없다. ★억지로 세지 않는다';
      return res;
    }
    if (!(rr.vertFrac >= o.vlMinVertFrac)) {
      res.reason = '印堂 vertFrac=' + (rr.vertFrac === null ? 'n/a' : rr.vertFrac.toFixed(2)) +
        ' 가 임계 ' + o.vlMinVertFrac + ' 미만이다 — 세로결이 우세하지 않다';
      return res;
    }
    if (!(rr.horizFrac <= o.vlMaxHorizFrac)) {
      /* ★가로결이 섞이면 「세로선 몇 개」라는 물음 자체가 성립하지 않는다(紋交 쪽이다) */
      res.reason = '印堂 horizFrac=' + rr.horizFrac.toFixed(2) + ' 가 상한 ' + o.vlMaxHorizFrac +
        ' 을 넘는다 — 가로결이 섞였다(紋交 계열). 세로선만 세는 것은 뜻이 없다';
      return res;
    }
    /* 세로선 화소를 x 축으로 투영.
       ★열마다 마스크 행 수로 나눈다(합이 아니라 평균).
         印堂 폴리곤은 가운데가 훨씬 높은 오각형이라, 합으로 투영하면 가운데 열이
         행 수만으로 이겨 「川字(3줄)도 봉우리 1개」가 된다 — 실측으로 확인한 결함이다. */
    var vlp = poly(COLOR.REGIONS.INDANG.ring, o.vlRingShrink);
    if (vlp) {
      var vraw = subExcl(IN.fillPolys([vlp], cw, ch), exclFull), vkeep = [];
      for (var vi = 0; vi < vraw.length; vi++) if (ovalMask[vraw[vi]]) vkeep.push(vraw[vi]);
      if (vkeep.length >= o.minRegionPx) idx = Int32Array.from(vkeep);
    }
    var minx = 1e9, maxx = -1e9, i;
    for (i = 0; i < idx.length; i++) { var xq = idx[i] % cw; if (xq < minx) minx = xq; if (xq > maxx) maxx = xq; }
    var wpx = maxx - minx + 1;
    var prof = new Float64Array(wpx), cnt = new Float64Array(wpx);
    for (i = 0; i < idx.length; i++) {
      var p = idx[i], xC = p % cw;
      if (ST.haloMask[p]) continue;
      cnt[xC - minx]++;
      if (!ST.voteArr[p]) continue;
      if (Math.abs(ST.degArr[p] - 90) > 25) continue;        // 세로만
      var b = ST.band[p];
      prof[xC - minx] += b * b * ST.symArr[p] * ST.cohArr[p];
    }
    var cmax = 0;
    for (i = 0; i < wpx; i++) if (cnt[i] > cmax) cmax = cnt[i];
    for (i = 0; i < wpx; i++) prof[i] = (cnt[i] >= 2 && cnt[i] >= o.vlMinColFrac * cmax) ? prof[i] / cnt[i] : 0;
    /* 1D 평활 */
    var sm = _blur(prof, wpx, 1, 1.5);
    var mx = 0;
    for (i = 0; i < wpx; i++) if (sm[i] > mx) mx = sm[i];
    if (!(mx > 0)) { res.reason = '세로 방향 프로파일이 비었다'; return res; }
    var thr = o.vlPeakRel * mx, peaks = [];
    for (i = 1; i < wpx - 1; i++) {
      if (sm[i] >= thr && sm[i] >= sm[i - 1] && sm[i] > sm[i + 1]) {
        if (peaks.length && (i - peaks[peaks.length - 1]) < o.vlMinSepPx) {
          if (sm[i] > sm[peaks[peaks.length - 1]]) peaks[peaks.length - 1] = i;
        } else peaks.push(i);
      }
    }
    res.profilePeaks = peaks.map(function (v) { return v + minx; });
    res.profileWidthPx = wpx;
    if (!peaks.length) { res.reason = '봉우리가 없다'; return res; }
    if (peaks.length > o.vlMaxCount) {
      res.reason = '봉우리가 ' + peaks.length + '개다 — 세로「선」이 아니라 결(texture)이다. ★억지로 세지 않는다';
      return res;
    }
    res.count = peaks.length;
    res.status = 'MEASURED';
    res.reason = '';
    res.interpretation = (peaks.length === 1) ? '懸針 후보(세로선 1)' :
      (peaks.length === 3) ? '川字 후보(세로선 3)' : '세로선 ' + peaks.length + '개 — 원문 유형(懸針1·川字3)에 해당 없음';
    return res;
  })();

  /* ── 묶음 요약 ────────────────────────────────────────────── */
  function group(names, key) {
    var v = [], i;
    for (i = 0; i < names.length; i++) {
      var r = regions[names[i]];
      if (r && r.textureReliable && r[key] !== null && r[key] !== undefined && isFinite(r[key])) v.push(r[key]);
    }
    return v.length ? { mean: _mean(v), min: Math.min.apply(null, v), max: Math.max.apply(null, v), n: v.length } : null;
  }
  function groupBlobCount(names) {
    var s = 0, n = 0, unrel = 0;
    for (var i = 0; i < names.length; i++) {
      var r = regions[names[i]];
      if (!r || !r.blobs) continue;
      if (r.blobs.reliable) { s += r.blobs.count; n++; } else unrel++;
    }
    return { total: s, regions: n, unreliableRegions: unrel };
  }

  return {
    ok: true,
    reject: null,
    meta: {
      version: SENSOR_TEXTURE_VERSION,
      normMode: mode,
      srcWidth: W, srcHeight: H,
      aspect: (aspect && isFinite(aspect) && aspect > 0) ? aspect : (H / W),
      aspectUsedInAxes: false,        // ★어떤 축에도 종횡비가 들어가지 않는다
      faceWidthSrcPx: faceW, faceHeightSrcPx: faceH,
      canvasW: cw, canvasH: ch, canvasScale: scale, resampled: useResample,
      landmarkCount: landmarks.length,
      skinPixels: skinIdx.length,
      focusScore: focusScore,
      faceBandRMS: faceBandRMS,
      faceLineRMS: faceLineRMS,
      energyRef: o.energyRef,
      darkComponents: ST.comps.length,
      occluderComponents: ST.comps.filter(function (c) { return c.area >= o.occMinArea || c.maxDim >= o.occMaxDim; }).length,
      browStack: !!STB,
      rejectedRegions: rejectedRegions
    },
    norm: {
      faceRefPx: o.faceRefPx, sigmaFine: o.sigmaFine, sigmaCoarse: o.sigmaCoarse,
      sigmaTensor: o.sigmaTensor, bandFloor: ST.bandFloor, haloDilatePx: Math.max(1, Math.round(o.haloDilateK * o.sigmaCoarse)),
      skinLogYmean: skinYmean, skinLogYsd: skinYsd, occLogContrast: o.occLogContrast * (useLog ? 1 : 0.30)
    },
    regions: regions,
    indang: indang,
    groups: {
      FOREHEAD_directionality: group(FOREHEAD, 'directionality'),   // 眉上 直理/橫理 근사 (OGWAN R025)
      FOREHEAD_wrinkleEnergy: group(FOREHEAD, 'wrinkleEnergy'),
      YUKBU_blobCount: groupBlobCount(YUKBU),                       // 六府 疵瘢黒痣 (OGWAN R009)
      YUKBU_occluderFrac: group(YUKBU, 'occluderFrac'),
      BROW_coherence: group(BROWS, 'orientationCoherence')          // 眉 逆而亂 (OGWAN R023)
    }
  };
}

/* ============================================================================
   6. 내보내기 (Node/브라우저 공용)
   ========================================================================== */
var _api = {
  measureTexture: measureTexture,
  TEXTURE_REGIONS: TEXTURE_REGIONS,
  AXES: AXES,
  NOT_MEASURED: NOT_MEASURED,
  YUKBU: YUKBU,
  FOREHEAD: FOREHEAD,
  BROWS: BROWS,
  VERSION: SENSOR_TEXTURE_VERSION,
  DEFAULTS: DEFAULTS,
  /* 합성 검증기(p06)가 같은 유틸을 쓰기 위한 내부 공개 */
  _internals: {
    blur: _blur, gaussKernel: _gaussKernel, bilerp: _bilerp,
    components: _components, resampleRGB: _resampleRGB, quant: _quant,
    llog: _llog, color: COLOR
  }
};

if (typeof module !== 'undefined' && module.exports) module.exports = _api;
if (typeof window !== 'undefined') window.CW_SENSOR_TEXTURE = _api;
