// 천운 엔진 — 명리 기초 결정적 유틸 (십신·오행 생극·지지 관계)
// 이 파일은 '규칙'이며 '원문 인용'이 아니다. 계산은 결정적이다.
'use strict';

// 천간(10) / 지지(12)
const STEMS = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const BRANCHES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

// 천간 오행/음양  (오행 인덱스: 木0 火1 土2 金3 水4)
const STEM_ELEMENT = [0,0,1,1,2,2,3,3,4,4]; // 甲乙木 丙丁火 戊己土 庚辛金 壬癸水
const STEM_YANG    = [1,0,1,0,1,0,1,0,1,0]; // 짝수 index = 양
// 지지 오행 (子水 丑土 寅木 卯木 辰土 巳火 午火 未土 申金 酉金 戌土 亥水)
const BRANCH_ELEMENT = [4,2,0,0,2,1,1,2,3,3,2,4];

const ELEMENT_NAME = ['木','火','土','金','水'];

// 오행 생/극 (인덱스 연산)
const gen = (i) => (i + 1) % 5;      // i 生 gen(i)
const ke  = (i) => (i + 2) % 5;      // i 克 ke(i)

function stemIndex(ch){ return STEMS.indexOf(ch); }
function branchIndex(ch){ return BRANCHES.indexOf(ch); }

// 십신: 일간(dayStem) 기준, 대상 천간(target)의 관계
// 반환: {code, name, group}  group ∈ 비겁/식상/재성/관성/인성
function sipsin(dayStem, targetStem){
  const d = typeof dayStem === 'number' ? dayStem : stemIndex(dayStem);
  const t = typeof targetStem === 'number' ? targetStem : stemIndex(targetStem);
  if (d < 0 || t < 0) throw new Error('잘못된 천간: ' + dayStem + '/' + targetStem);
  const dEl = STEM_ELEMENT[d], tEl = STEM_ELEMENT[t];
  const same = STEM_YANG[d] === STEM_YANG[t];
  let group, code, name;
  if (tEl === dEl)            { group = '비겁'; code = same ? 'BJ' : 'GJ'; name = same ? '비견' : '겁재'; }
  else if (tEl === gen(dEl))  { group = '식상'; code = same ? 'SS' : 'SG'; name = same ? '식신' : '상관'; } // 일간 生 대상
  else if (tEl === ke(dEl))   { group = '재성'; code = same ? 'PJ' : 'JJ'; name = same ? '편재' : '정재'; } // 일간 克 대상
  else if (dEl === ke(tEl))   { group = '관성'; code = same ? 'PG' : 'JG'; name = same ? '편관' : '정관'; } // 대상 克 일간
  else                        { group = '인성'; code = same ? 'PI' : 'JI'; name = same ? '편인' : '정인'; } // 대상 生 일간
  return { code, name, group };
}

// ── 지지 관계 ──
const CHUNG = [[0,6],[1,7],[2,8],[3,9],[4,10],[5,11]];            // 육충
const YUKHAP = [[0,1],[2,11],[3,10],[4,9],[5,8],[6,7]];          // 육합
const SAMHAP = [[8,0,4],[2,6,10],[5,9,1],[11,3,7]];              // 삼합(申子辰水/寅午戌火/巳酉丑金/亥卯未木)
const YUKHAE = [[0,7],[1,6],[2,5],[3,4],[8,11],[9,10]];          // 육해
const SAMHYUNG = [[2,5,8],[1,10,7]];                             // 삼형(寅巳申/丑戌未)
const JAHYUNG = [3,0]; // 子卯 상형 (쌍)

function pairIn(list, a, b){
  return list.some(p => (p[0]===a && p[1]===b) || (p[0]===b && p[1]===a));
}
function inSameGroup3(groups, a, b){
  return groups.some(g => g.includes(a) && g.includes(b) && a !== b);
}

// today 지지 vs 대상 지지 하나의 관계 태그 배열
function branchRelations(todayBranch, targetBranch){
  const a = typeof todayBranch === 'number' ? todayBranch : branchIndex(todayBranch);
  const b = typeof targetBranch === 'number' ? targetBranch : branchIndex(targetBranch);
  const tags = [];
  if (pairIn(CHUNG, a, b)) tags.push('沖');
  if (pairIn(YUKHAP, a, b)) tags.push('六合');
  if (inSameGroup3(SAMHAP, a, b)) tags.push('三合');
  if (pairIn(YUKHAE, a, b)) tags.push('六害');
  if (inSameGroup3(SAMHYUNG, a, b)) tags.push('刑');
  if ((a===JAHYUNG[0]&&b===JAHYUNG[1])||(a===JAHYUNG[1]&&b===JAHYUNG[0])) tags.push('刑');
  return tags;
}

module.exports = {
  STEMS, BRANCHES, STEM_ELEMENT, STEM_YANG, BRANCH_ELEMENT, ELEMENT_NAME,
  gen, ke, stemIndex, branchIndex, sipsin, branchRelations,
};
