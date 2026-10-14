// 생성물(P-805-D build_shadow_dist) — 수정 금지. 원본은 IP.


'use strict';

const STEMS = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const BRANCHES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

const STEM_ELEMENT = [0,0,1,1,2,2,3,3,4,4];
const STEM_YANG    = [1,0,1,0,1,0,1,0,1,0];

const BRANCH_ELEMENT = [4,2,0,0,2,1,1,2,3,3,2,4];

const ELEMENT_NAME = ['木','火','土','金','水'];

const gen = (i) => (i + 1) % 5;
const ke  = (i) => (i + 2) % 5;

function stemIndex(ch){ return STEMS.indexOf(ch); }
function branchIndex(ch){ return BRANCHES.indexOf(ch); }

function sipsin(dayStem, targetStem){
  const d = typeof dayStem === 'number' ? dayStem : stemIndex(dayStem);
  const t = typeof targetStem === 'number' ? targetStem : stemIndex(targetStem);
  if (d < 0 || t < 0) throw new Error('잘못된 천간: ' + dayStem + '/' + targetStem);
  const dEl = STEM_ELEMENT[d], tEl = STEM_ELEMENT[t];
  const same = STEM_YANG[d] === STEM_YANG[t];
  let group, code, name;
  if (tEl === dEl)            { group = '비겁'; code = same ? 'BJ' : 'GJ'; name = same ? '비견' : '겁재'; }
  else if (tEl === gen(dEl))  { group = '식상'; code = same ? 'SS' : 'SG'; name = same ? '식신' : '상관'; }
  else if (tEl === ke(dEl))   { group = '재성'; code = same ? 'PJ' : 'JJ'; name = same ? '편재' : '정재'; }
  else if (dEl === ke(tEl))   { group = '관성'; code = same ? 'PG' : 'JG'; name = same ? '편관' : '정관'; }
  else                        { group = '인성'; code = same ? 'PI' : 'JI'; name = same ? '편인' : '정인'; }
  return { code, name, group };
}

const CHUNG = [[0,6],[1,7],[2,8],[3,9],[4,10],[5,11]];
const YUKHAP = [[0,1],[2,11],[3,10],[4,9],[5,8],[6,7]];
const SAMHAP = [[8,0,4],[2,6,10],[5,9,1],[11,3,7]];
const YUKHAE = [[0,7],[1,6],[2,5],[3,4],[8,11],[9,10]];
const SAMHYUNG = [[2,5,8],[1,10,7]];
const JAHYUNG = [3,0];

function pairIn(list, a, b){
  return list.some(p => (p[0]===a && p[1]===b) || (p[0]===b && p[1]===a));
}
function inSameGroup3(groups, a, b){
  return groups.some(g => g.includes(a) && g.includes(b) && a !== b);
}

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
