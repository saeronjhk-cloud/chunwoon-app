// 생성물(P-805-D build_shadow_dist) — 수정 금지. 원본은 IP.


'use strict';
const { rootProfile, hiddenStems } = require('./root_engine');

const CLASH = { 子:'午',午:'子',丑:'未',未:'丑',寅:'申',申:'寅',卯:'酉',酉:'卯',辰:'戌',戌:'辰',巳:'亥',亥:'巳' };
const BR_EL = { 子:'水',丑:'土',寅:'木',卯:'木',辰:'土',巳:'火',午:'火',未:'土',申:'金',酉:'金',戌:'土',亥:'水' };
const ST_EL = { 甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水' };
const GEN = { 木:'火',火:'土',土:'金',金:'水',水:'木' };
const CTRL = { 木:'土',土:'水',水:'火',火:'金',金:'木' };
const LIUHE = { 子:'丑',丑:'子',寅:'亥',亥:'寅',卯:'戌',戌:'卯',辰:'酉',酉:'辰',巳:'申',申:'巳',午:'未',未:'午' };
const SANHE = [['申','子','辰'],['寅','午','戌'],['巳','酉','丑'],['亥','卯','未']];
const SAGO = new Set(['辰','戌','丑','未']);

const B4IP = require('../IP/rules/saju/root_system.json').b4_wonmun_relation_anchors_v011 || {};
const B4_CASES = B4IP.cases || [];
const ROK = B4IP.rok_table || {};
const SANHE_EL = { '申子辰': '水', '寅午戌': '火', '巳酉丑': '金', '亥卯未': '木' };

const NATAL_LEN = 4;
const GAP_CLASS = g => (g <= 0 ? '無隔' : g === 1 ? '隔一位' : '隔二位以上');
function positionMetaFor(members, pillars) {
  const idxSets = members.map(m => {
    const nat = [], tr = [];
    pillars.forEach((p, i) => { if (p.b !== m) return; (i < NATAL_LEN ? nat : tr).push(i); });
    return { m, nat, tr };
  });
  const transit_involved = idxSets.some(s => s.nat.length === 0 && s.tr.length > 0);
  const absent = idxSets.some(s => s.nat.length === 0 && s.tr.length === 0);
  const base = { authority: 'DIAGNOSTIC_ONLY', diagnostic_only: true, judgment_effect: 'NONE',
    basis: "cite:931ce4b221d2",
    scope_note: '解 국면(p.24)에는 미적용 — 저본이 위치를 명시하지 않음(결정 30-1)' };
  if (absent) return { ...base, applicable: false, span_gap: null, gap_class: null,
    dong_condition_zpjz: null, note: '구성 지지 부재 — 위치 산출 불가' };
  if (transit_involved) return { ...base, applicable: false, span_gap: null, gap_class: null,
    dong_condition_zpjz: null, scope: 'transit_involved',
    note: '運/年 지지 포함 — 원국 柱(년월일시) 간격 개념 밖 · 저본 문면 부재(정직 보류)' };

  let best = null;
  const walk = (k, acc) => {
    if (k === idxSets.length) {
      const mx = Math.max(...acc), mn = Math.min(...acc);
      const gap = mx - mn - (acc.length - 1);
      if (!best || gap < best.span_gap) best = { span_gap: gap, chosen_idx: [...acc].sort((a, b) => a - b) };
      return;
    }
    for (const i of idxSets[k].nat) walk(k + 1, [...acc, i]);
  };
  walk(0, []);
  return { ...base, applicable: true, span_gap: best.span_gap, gap_class: GAP_CLASS(best.span_gap),
    chosen_idx: best.chosen_idx, pillar_names: best.chosen_idx.map(i => ['年', '月', '日', '時'][i]),
    dong_condition_zpjz: best.span_gap < 2,
    note: best.span_gap < 2
      ? '「不隔二位」 충족 — 動(火動類) 국면 위치 조건 통과(p.60)'
      : '「隔二位」 — 年↔時 상당 · 動 국면 위치 조건 미충족(p.60) · 干合 유비 시 「地則相違…半合也」(p.19)',
    known_gap: '지지 직접 명례 미확증 — p.60 예시(甲用酉官·逢午·遇寅遇戌)가 柱 위치를 명시하지 않음. 「位」=柱는 干 용법(p.19·p.48) 유비. 규칙화(판정 편입)는 지지 명례 확보 후(결정 30-2)' };
}
const chartKey = pillars => pillars.slice(0, 4).map(p => p.s + p.b).join('');
const anchorFor = pillars => B4_CASES.find(c => c.natal === chartKey(pillars)) || null;
function applyAnchorActivation(pillars, rels) {
  const anchor = anchorFor(pillars);
  if (!anchor) return;
  for (const rel of rels) { if (rel.activation !== 'unresolved') continue;
    const hit = (anchor.relations || []).find(a => a.kind === rel.kind
      && a.members.length === rel.members.length && a.members.every(m => rel.members.includes(m)));
    if (hit) { rel.activation = hit.activation; rel.anchor = hit.anchor;
      if (hit.direction) rel.direction = hit.direction; } }
}

const GIP = require('../IP/rules/saju/root_system.json').hoehap_g_anchors_v012 || {};
const G_CASES = GIP.cases || [];
const WANGJI = new Set(GIP.wangji || []);
const RB_DOMAIN = new Set(GIP.resolution_basis_domain || ['textual_anchor']);
const gAnchorFor = pillars => G_CASES.find(c => c.natal === chartKey(pillars)) || null;
const transitTokens = pillars => pillars.slice(4).map(p => `${p.scope || '運'}${p.s}${p.b}`);
const sealBasis = b => { if (!RB_DOMAIN.has(b)) throw new Error(`resolution_basis 정의역 위반: ${b} (결정 27-6 봉인)`); return b; };

function detectCombinations(pillars) {
  const branches = pillars.map(p => p.b);
  const out = [];
  for (const g of SANHE) if (g.every(x => branches.includes(x)))
    out.push({ kind: '三合會', members: [...g], el: SANHE_EL[g.join('')], activation: 'unresolved',
      grade: 'P0 기계 후보(완전 三合) — 활성은 원문 문면 호명 한정(결정 27-1)' });
  const seen = new Set();
  for (const b of branches) { const m = LIUHE[b];
    if (!m || !branches.includes(m)) continue;
    const k = [b, m].sort().join(''); if (seen.has(k)) continue; seen.add(k);
    out.push({ kind: '六合', members: [b, m], activation: 'unresolved',
      grade: 'P0 기계 후보 — 六合은 왕지 없는 1:1 결박·三合과 별도 축(결정 27-4) · 불활성 사유 추정 적용 금지' }); }
  for (const c of out) c.position_meta = positionMetaFor(c.members, pillars);
  const anchor = gAnchorFor(pillars);
  if (anchor) for (const c of out) {
    const hit = (anchor.combinations || []).find(a => a.kind === c.kind
      && a.members.length === c.members.length && a.members.every(m => c.members.includes(m)));
    if (hit) { c.activation = hit.activation;
      if (hit.anchor) c.anchor = hit.anchor; if (hit.note) c.note = hit.note; } }
  return out;
}

function buildGroupBreak(anchor, toks, target, attacker, base, combos) {
  if (!anchor) return null;
  const gb = (anchor.group_breaks || []).find(x => x.wangji === target && x.attacker === attacker
    && (!x.transit || toks.includes(x.transit)));
  if (!gb) return null;
  if (!WANGJI.has(target)) return null;
  const grp = combos.find(c => c.kind === '三合會' && c.members.length === gb.group.length
    && gb.group.every(m => c.members.includes(m)));
  if (!grp || grp.activation !== 'active') return null;
  if (!/沖破/.test(gb.anchor || '')) return null;
  const passed = 得令(base.attacker_status) || base.attacker_power >= base.target_power;
  return { status: passed ? 'broken' : 'ABSTAIN', group: gb.group.join(''), el: gb.el,
    wangji: target, attacker, anchor: gb.anchor, resolution_basis: sealBasis(gb.resolution_basis),
    effect: gb.effect,
    conditions: { group_active_textual: true, wangji_direct_clash: true, chungpa_named: true,
      grade: '결정 27-2 3조건 — 전부 문면 확정 · 일반 규칙화 보류(27-6)' },
    power_guard: { attacker_status: base.attacker_status, target_status: base.target_status,
      attacker_power: base.attacker_power, target_power: base.target_power, passed,
      grade: 'HOUSE(衰神沖旺 역리 방지 — 공격측 得令 또는 세력 우위 요구 · A·B 교차 확증 · 결정 27-2)' },
    state_transition: {
      pre: { group: gb.group.join(''), el: gb.el, status: 'active', anchor: grp.anchor },
      event: { kind: '沖破', attacker, target, wangji: true, anchor: gb.anchor },
      post: { status: 'broken', members_present: [...gb.group],
        note: '집단 기능 해제 — 구성 지지 존속(삭제 금지) · natal 불변 · transit 종료 후 원국 복원' } },
    grade: "cite:02593841b912" };
}

function fullSanheOf(ch, branches) {
  for (const g of SANHE) if (g.includes(ch) && g.every(x => branches.includes(x))) return g;
  return null;
}
function buildHaechung(idx, atkIdx, pillars) {
  const branches = pillars.map(p => p.b);
  const involvedIdx = [idx, ...atkIdx];
  const involvedBr = involvedIdx.map(i => branches[i]);
  let contention = null;
  for (const i of involvedIdx) {
    const x = branches[i];
    const z = LIUHE[x];
    if (z && branches.includes(z) && !involvedBr.includes(z)) {
      const g = fullSanheOf(z, branches);
      if (g) { contention = contention || { contended: z, group: g.join(''), el: SANHE_EL[g.join('')],
          sixhe: [x, z],
          anchor: "cite:46e0c2aa693e",
          note: '解 매개 지지가 완전 三合會에 선귀속 → 六合 무효 → 沖 재활(會合不能解) · 자원 경합(이중귀속 불가)' };
        continue; }
      return { resolved: true, via: '六合', pair: [x, z], basis: 'textual_rule',
        anchor: "cite:8ed236bc9f6e" };
    }
    const g2 = fullSanheOf(x, branches);
    if (g2) return { resolved: true, via: '三合會', group: g2.join(''), basis: 'textual_rule',
      anchor: "cite:a3c2538ce401" };
  }
  return contention ? { resolved: false, contention } : null;
}

const HYEONG_PAIRS = [['子', '卯']];

function buildHaehyeong(selfBranch, partnerBranch, pillars) {
  const branches = pillars.map(p => p.b);
  const parties = [selfBranch, partnerBranch];
  let contention = null;
  for (const x of parties) {
    const z = LIUHE[x];
    if (z && branches.includes(z) && !parties.includes(z)) {
      const gz = fullSanheOf(z, branches);
      if (gz) { contention = contention || { contended: z, group: gz.join(''), el: SANHE_EL[gz.join('')],
          sixhe: [x, z],
          anchor: "cite:e48c3d4029c4",
          note: '解 매개 지지가 완전 三合會에 선귀속 → 六合 무효 → 刑 재활(會合不能解刑) · 자원 경합(이중귀속 불가)' };
        continue; }
      return { resolved: true, via: '六合', pair: [x, z], basis: 'textual_rule',
        anchor: "cite:a9ee86266501" };
    }
    const g2 = fullSanheOf(x, branches);
    if (g2) return { resolved: true, via: '三合會', group: g2.join(''), basis: 'textual_rule',
      anchor: "cite:135a3ff8c9db" };
  }
  return contention ? { resolved: false, contention } : null;
}

const CNT_ANCHOR_BASE = "cite:b11acd31d212";
const CNT_ANCHOR_INDUCED = "cite:fc67f77f6e3b";

function resolveHyeongCount(partner, pillars) {
  const branches = pillars.map(p => p.b);
  const cntJa  = branches.filter(x => x === '子').length;
  const cntMyo = branches.filter(x => x === '卯').length;

  if (!(cntMyo === 2 && cntJa === 1)) return null;

  const hasSul = branches.includes('戌');
  const sulContendGroup = hasSul ? fullSanheOf('戌', branches) : null;
  const sulBinds = hasSul && !sulContendGroup;

  if (sulBinds) {

    return { type: '子卯', integrity: 'ACTIVE', activation: 'HYEONG', partner,
      count: { '子': cntJa, '卯': cntMyo },
      induced_by_resolution: { via: '六合', agent: '戌', removed: '卯',
        pair: ['卯', '戌'], basis: 'textual_rule', anchor: CNT_ANCHOR_INDUCED,
        note: '二卯 중 하나가 卯戌六合으로 合去 → 一卯一子 회복 → 刑 재발(因解反得 · 解가 刑을 유발)' },
      note: '因解反得 — 解(合)가 오히려 刑을 유발(卯戌合去其一)',
      grade: "cite:08509acd9824" };
  }

  const h = { type: '子卯', integrity: 'INACTIVE', activation: 'NULLIFIED_BY_COUNT', partner,
    count: { '子': cntJa, '卯': cntMyo },
    count_rule: { rule: '二卯不刑一子', basis: 'textual_rule', anchor: CNT_ANCHOR_BASE,
      note: '二卯:一子 = count 상쇄 → 刑 不成立(저본 문면)' },
    grade: "cite:aeed56b81ce8" };
  if (sulContendGroup) {
    h.contention = { contended: '戌', group: sulContendGroup.join(''), el: SANHE_EL[sulContendGroup.join('')],
      basis: 'textual_rule',
      anchor: '戌與寅午會 → 卯戌六合 무효(會合不能解 · SRC_ZPJZ_A_CH7)',
      note: '戌이 寅午戌 완전 三合會 선귀속 → 卯戌 六合 合去 불가 → 二卯 유지(因解反得 차단) · 자원경합' };
    h.note = '二卯不刑一子 유지 — 戌 자원경합(寅午戌會 선귀속)으로 合去 불가';
  }
  return h;
}

function g2HyeongOverlap(clash) {
  const gb = clash && clash.group_break;
  const hy = clash && clash.hyeong;
  if (!gb || gb.status !== 'broken') return null;
  if (!hy || hy.integrity !== 'ACTIVE') return null;
  const g2set = new Set([...(gb.group || []), gb.wangji, gb.attacker].filter(Boolean));
  const shared = ['子', '卯'].filter(x => g2set.has(x));
  return shared.length ? { shared, g2_targets: [...g2set], hyeong_parties: ['子', '卯'] } : null;
}

function attachHyeong(clash, idx, pillars) {
  const b = pillars[idx].b;
  const branches = pillars.map(p => p.b);
  for (const pair of HYEONG_PAIRS) {
    if (!pair.includes(b)) continue;
    const partner = pair[0] === b ? pair[1] : pair[0];
    if (!branches.includes(partner)) continue;

    const cntSelf = branches.filter(x => x === b).length;
    const cntPart = branches.filter(x => x === partner).length;
    if (cntSelf > 1 || cntPart > 1) {
      const hc = resolveHyeongCount(partner, pillars);
      if (hc) { clash.hyeong = hc; }
      else {

        clash.hyeong = { type: '子卯', integrity: 'SCOPE', partner,
          count: { '子': branches.filter(x => x === '子').length, '卯': branches.filter(x => x === '卯').length },
          note: '二子 대칭·2:2 등 저본 예시 밖 count 배열 — 정직 보류(결정 29-B는 二卯不刑一子 한정)',
          grade: 'SCOPE — 결정 29-B 범위 밖(count 축 · 저본 예시 부재)' };
      }
      break;
    }
    const hh = buildHaehyeong(b, partner, pillars);
    if (hh && hh.resolved) {
      clash.hyeong = { type: '子卯', integrity: 'INTACT', activation: 'RESOLVED_BY_COMBO', partner,
        resolution_basis: sealBasis(hh.basis), resolution_anchor: hh.anchor,
        haehyeong: { via: hh.via, ...(hh.pair ? { pair: hh.pair } : {}), ...(hh.group ? { group: hh.group } : {}) },
        grade: "cite:72d8a85c8d6d" };
    } else if (hh && hh.contention) {
      clash.hyeong = { type: '子卯', integrity: 'ACTIVE', activation: 'HYEONG', partner,
        resource_contention: { ...hh.contention, grade: 'textual_rule — 會合不能解刑(자원경합) · 결정 29' },
        note: '刑 발현 — 六合 解가 자원경합으로 무효(卯復刑子)',
        grade: "cite:76f082ea4b3d" };
    } else {
      clash.hyeong = { type: '子卯', integrity: 'ACTIVE', activation: 'HYEONG', partner,
        note: '子卯 相刑 성립 — 解 매개(六合/완전 三合會) 부재',
        grade: "cite:ba17a623a406" };
    }
    break;
  }

  const _ov = g2HyeongOverlap(clash);
  if (_ov) clash.hyeong = { type: '子卯', integrity: 'ABSTAIN', activation: 'UNKNOWN',
    abstain_reason: "cite:b5029c224605" + _ov.shared.join('') + ') — 두 계통 상반 판정 가능 → fail-closed 보류(설계미결(2) 안 A)',
    overlap: _ov,
    note: "cite:55390806edde",
    grade: 'fail-closed — 설계미결(2) 안 A(제이 결정 2026-07-24) · G2↔三刑 대상 겹침 ABSTAIN' };
  return clash;
}

function detectRelations(pillars) {
  const branches = pillars.map(p => p.b);
  const rels = [];
  for (const g of SANHE) { const present = [...new Set(g.filter(x => branches.includes(x)))];
    if (present.length === 2) rels.push({ kind: '拱', members: present, el: SANHE_EL[g.join('')],
      activation: 'unresolved', position_meta: positionMetaFor(present, pillars),
      grade: 'P0 기계 후보 — 활성은 원문 문면 호명 한정(결정 24-2 · 「巳酉無拱合之情」 p.496)' }); }
  const seen = new Set();
  pillars.forEach(p => { if (p._stem_inactive || seen.has(p.s)) return; seen.add(p.s);
    if (ROK[p.s] && branches.includes(ROK[p.s]))
      rels.push({ kind: '得祿', members: [p.s, ROK[p.s]], el: ST_EL[p.s], activation: 'unresolved',
        grade: 'P0 기계 후보(祿표=IP·DOCTRINE) — 활성은 문면 호명 한정' }); });
  applyAnchorActivation(pillars, rels);
  return rels;
}
function functionalStatusFor(branch, rels) {
  const hit = rels.find(r => r.kind === '拱' && r.members.includes(branch));
  if (!hit) return undefined;
  return { structural: '在位(nominal 불변 — root_exists 절대)',
    effective: hit.activation === 'active' ? '失勢' : (hit.activation === 'inactive' ? '在位' : 'unresolved'),
    via: `拱(${hit.members.join('')}→${hit.el})`,
    grade: 'HOUSE(결정 24-3 구조값/작동값 분리 — 하향 폭 비규정 · 세력 반영은 활성만)',
    ...(hit.anchor ? { anchor: hit.anchor } : {}) };
}

function seasonalStatus(el, monthEl) {
  if (el === monthEl) return '旺';
  if (GEN[monthEl] === el) return '相';
  if (GEN[el] === monthEl) return '休';
  if (CTRL[el] === monthEl) return '囚';
  return '死';
}
const SEASON_W = { 旺:2.0, 相:1.5, 休:1.0, 囚:0.7, 死:0.5 };
const TH = 1.5;
const TH_LOW = 1 / TH;
const 得令 = st => st === '旺' || st === '相';

function localPower(selfIdx, pillars, excludeIdx) {
  const branch = pillars[selfIdx].b;
  const el = BR_EL[branch];
  const monthEl = BR_EL[pillars[1].b];
  let w = SEASON_W[seasonalStatus(el, monthEl)];
  pillars.forEach((p, i) => {
    if (i === selfIdx || excludeIdx.includes(i)) return;
    const be = BR_EL[p.b];
    if (be === el) w += 0.6; else if (GEN[be] === el) w += 0.4;
  });
  pillars.forEach(p => { if (!p._stem_inactive && ST_EL[p.s] === el) w += 0.3; });
  return +w.toFixed(2);
}

function combinationInvolved(idx, atkIdx, pillars) {
  const branches = pillars.map(p => p.b);
  const involved = [idx, ...atkIdx];
  for (const i of involved) {
    const b = branches[i];
    for (let j = 0; j < branches.length; j++) {
      if (j === i) continue;
      if (LIUHE[b] === branches[j] && !(involved.includes(j) && CLASH[b] === branches[j])) return `六合(${b}${branches[j]})`;
    }
    for (const g of SANHE) if (g.includes(b)) {
      const others = g.filter(x => x !== b);
      if (others.every(x => branches.includes(x))) return `三合(${g.join('')})`;
    }
  }
  return null;
}

function clashState(idx, pillars, rootEl) {
  const b = pillars[idx].b;
  const foe = CLASH[b];
  const rels = detectRelations(pillars);
  const atkIdx = pillars.map((p, i) => (i !== idx && p.b === foe) ? i : -1).filter(i => i >= 0);
  if (!atkIdx.length) return { integrity: 'NO_CLASH', activation: 'DORMANT', ...(rels.length ? { relation_graph: rels } : {}) };
  const combo = combinationInvolved(idx, atkIdx, pillars);

  const tgtEl = BR_EL[b], atkEl = BR_EL[foe];
  const party = new Set([tgtEl, atkEl]);
  const tongwanRaw = Object.keys(GEN).find(e => GEN[atkEl] === e && GEN[e] === tgtEl) || null;
  const eokchungRaw = Object.keys(CTRL).find(e => CTRL[e] === atkEl) || null;

  const tongwan = tongwanRaw && !party.has(tongwanRaw) ? tongwanRaw : null;
  const eokchung = eokchungRaw && !party.has(eokchungRaw) ? eokchungRaw : null;

  const jochungEls = Object.keys(GEN).filter(e => (GEN[e] === atkEl || CTRL[e] === tgtEl) && !party.has(e));
  const haeguCands = [];
  pillars.forEach(pp => { if (pp._stem_inactive) return; const e = ST_EL[pp.s];
    if (tongwan && e === tongwan) haeguCands.push({ el: e, type: '通關', source: '천간', char: pp.s });
    else if (eokchung && e === eokchung) haeguCands.push({ el: e, type: '抑冲', source: '천간', char: pp.s });
    else if (jochungEls.includes(e)) haeguCands.push({ el: e, type: '助冲', source: '천간', char: pp.s }); });
  pillars.forEach((pp, pi) => { if (pi === idx || atkIdx.includes(pi)) return; const e = BR_EL[pp.b];
    if (tongwan && e === tongwan) haeguCands.push({ el: e, type: '通關', source: '지지', char: pp.b });
    else if (eokchung && e === eokchung) haeguCands.push({ el: e, type: '抑冲', source: '지지', char: pp.b });
    else if (jochungEls.includes(e)) haeguCands.push({ el: e, type: '助冲', source: '지지', char: pp.b }); });

  { const dangSet = new Set();
    pillars.forEach((pp, pi) => { if (pi === idx || atkIdx.includes(pi)) return; const e = BR_EL[pp.b];
      if (GEN[e] === atkEl && !party.has(e)) dangSet.add(pp.b); });
    pillars.forEach(pp => { if (pp._stem_inactive) return; const e = ST_EL[pp.s];
      if (GEN[e] === atkEl && !party.has(e)) dangSet.add(pp.s); });
    dangSet.forEach(ch => rels.push({ kind: '黨', members: [ch, foe], el: atkEl, activation: 'unresolved',
      grade: 'P0 기계 후보 — 黨 정의역 미확정(생조 결집 · 10차 §6-3)' }));
    applyAnchorActivation(pillars, rels); }
  const monthEl = BR_EL[pillars[1].b];
  const target_status = seasonalStatus(BR_EL[b], monthEl);
  const attacker_status = seasonalStatus(BR_EL[foe], monthEl);
  const target_power = localPower(idx, pillars, atkIdx);
  let attacker_power = 0;
  atkIdx.forEach((ai, k) => { attacker_power += localPower(ai, pillars, [idx]) * (k === 0 ? 1 : 0.6); });
  attacker_power = +attacker_power.toFixed(2);
  const base = { attacker_status, target_status, attacker_power, target_power,
                 ratio: +(attacker_power / target_power).toFixed(2) };
  if (rels.length) base.relation_graph = rels;
  { const anch = anchorFor(pillars);
    if (anch && anch.piggu && anch.piggu.physical_target === b)
      base.piggu = { ...anch.piggu, grade: 'ORIGINAL(문면 명시 — 결정 22-3 · 사례별 기능 식별)' }; }

  const combos = detectCombinations(pillars);
  if (combos.length) base.combination_graph = combos;
  if (combo) {
    const gAnc = gAnchorFor(pillars), toks = transitTokens(pillars);
    const res = gAnc && (gAnc.clash_resolutions || []).find(r => r.target === b && r.attacker === foe
      && (!r.transit || toks.includes(r.transit)));
    if (res) {
      const gb = buildGroupBreak(gAnc, toks, b, foe, base, combos);
      if (gb && gb.status === 'ABSTAIN') return { ...base, integrity: 'ABSTAIN', activation: 'UNKNOWN',
        abstain_reason: `沖破局 세력 가드 미달(衰神沖旺 역리 방지 · 결정 27-2): ${combo}`, group_break: gb };
      return { ...base, integrity: res.integrity, activation: 'ACTIVATED',
        resolution_basis: sealBasis(res.resolution_basis), resolution_anchor: res.anchor,
        wonmun_label: res.wonmun_label, resolution_note: res.note,
        resolution_grade: 'ORIGINAL 문면 앵커 한정(결정 27-1) — 합회 해충의 일반 규칙 아님 · 희기 층 미승격(27-3)',
        ...(gb ? { group_break: gb } : {}) };
    }

    const hc = buildHaechung(idx, atkIdx, pillars);
    if (hc && hc.resolved) return { ...base, integrity: 'INTACT', activation: 'RESOLVED_BY_COMBO',
      resolution_basis: sealBasis(hc.basis), resolution_anchor: hc.anchor, haechung: { via: hc.via, ...(hc.pair ? { pair: hc.pair } : {}), ...(hc.group ? { group: hc.group } : {}) },
      resolution_grade: "cite:7fddb113e421" };
    if (hc && hc.contention) { base.resource_contention = { ...hc.contention, grade: 'textual_rule — 會合不能解(자원경합) · 결정 28' };   }
    else return { ...base, integrity: 'ABSTAIN', activation: 'UNKNOWN',
      abstain_reason: `합회 개입 미해소: ${combo}`,
      fallback_grade: 'G1 fallback(결정 27-1) — 개별 앵커·會合解衝 규칙 모두 부적용 · 정직 보류' };
  }

  const joinedBr = new Set(rels.filter(r => r.kind === '拱' && r.activation === 'active' && r.el === atkEl)
    .flatMap(r => r.members.filter(m => m !== foe)));
  let attEff = attacker_power, tgtEff = target_power; const adjustments = [];
  joinedBr.forEach(m => { const be = BR_EL[m]; const prior = be === atkEl ? 0.6 : (GEN[be] === atkEl ? 0.4 : 0);
    attEff = +(attEff + (0.6 - prior)).toFixed(2); adjustments.push(`拱가담:${m}(+${(0.6 - prior).toFixed(1)})`); });
  rels.filter(r => r.kind === '拱' && r.activation === 'active' && r.el !== tgtEl && !r.members.includes(foe) && !r.members.includes(b))
    .forEach(r => r.members.forEach(m => { const be = BR_EL[m]; const prior = be === tgtEl ? 0.6 : (GEN[be] === tgtEl ? 0.4 : 0);
      if (prior > 0) { tgtEff = +(tgtEff - prior).toFixed(2); adjustments.push(`기능전환:${m}(-${prior})`); } }));
  const rEff = adjustments.length ? +(attEff / tgtEff).toFixed(2) : base.ratio;
  if (adjustments.length) { base.attacker_power_eff = attEff; base.target_power_eff = tgtEff; base.ratio_eff = rEff;
    base.b4_adjustments = adjustments; base.b4_grade = 'HOUSE(활성=원문 문면 호명 한정 · R4 재산정 1회 고정 — 결정 24-1)'; }
  const coalition = { anchor_branch: foe, members: [], grade: 'HOUSE(연합 후보 — 세력 반영은 문면 활성만 · 결정 24-4 원천 1회 계상)' };
  rels.forEach(r => {
    if (r.kind === '得祿' && r.members[1] === foe) coalition.members.push({ char: r.members[0], role: '得祿', activation: r.activation });
    else if (r.kind === '黨' && r.members[1] === foe) coalition.members.push({ char: r.members[0], role: '黨', activation: r.activation });
    else if (r.kind === '拱' && r.el === atkEl && r.members.includes(foe))
      r.members.filter(m => m !== foe).forEach(m => coalition.members.push({ char: m, role: '拱', activation: r.activation, ...(r.anchor ? { anchor: r.anchor } : {}) }));
  });
  if (coalition.members.length) base.coalition = coalition;
  const elementPower = el => { let w = SEASON_W[seasonalStatus(el, monthEl)];
    pillars.forEach(pp => { if (BR_EL[pp.b] === el && !joinedBr.has(pp.b)) w += 0.6; });
    pillars.forEach(pp => { if (!pp._stem_inactive && ST_EL[pp.s] === el) w += 0.3; });
    return +w.toFixed(2); };
  const uniqHG = new Map(); haeguCands.forEach(c => uniqHG.set(c.el + c.type + c.source, c));
  const hgCands = [...uniqHG.values()];

  const excluded = [];
  for (let i = hgCands.length - 1; i >= 0; i--) { const c = hgCands[i];
    if (c.source === '지지' && joinedBr.has(c.char)) { excluded.push({ ...c,
      reason: '문면 활성 귀속: 공격국 拱 가담 — 解救 후보에서 배제 (결정 24-4 · R6 후보/유효 분리)' }); hgCands.splice(i, 1); } }

  const conflicted = hgCands.filter(c => c.source === '지지' && c.type !== '助冲'
    && rels.some(r => r.kind === '拱' && r.activation === 'unresolved' && r.el === atkEl && r.members.includes(c.char)));
  const protEff = hgCands.some(c => c.type !== '助冲' && elementPower(c.el) / attEff >= TH_LOW);
  if (hgCands.length || excluded.length) base.haegu = { candidates: hgCands, party_excluded: excluded, status: 'CANDIDATES_ONLY',
    anchor: "cite:00d398eaa835",
    rule: 'HOUSE_LOCAL_PROXY: elementPower(보호해구)/공격세력 ≥ 1/TH — 국소 대용 지표(「觀其大勢」의 번역 아님 · 助冲은 라벨만 — 제이 결정 18-R2·R3 2026-07-22)',
    resolution: null };

  const edge_sources = rootEl ? hiddenStems(foe).filter(([st]) => CTRL[ST_EL[st]] === rootEl).map(([st]) => st) : null;
  const edge_incoming = edge_sources ? edge_sources.length > 0 : null;
  const edgeFields = { edge_incoming, edge_sources: edge_sources || undefined,
    edge_anchor: rootEl ? '各支中所藏互相冲尅 (任注·地支 p.89)' : undefined };

  if (SAGO.has(b) && SAGO.has(foe)) {
    const stored = [...hiddenStems(b), ...hiddenStems(foe)].map(([st]) => st);
    const stems4 = pillars.map(pp => pp.s);
    const inchul = [...new Set(stored.filter(st => stems4.includes(st)))];
    base.sago = { inchul,
      saryeong: "cite:ab0618bc7c32",
      classical_note: "cite:c17fa345f00b",
      beneficial_path_note: "cite:cb292f33c29d" };
    if (inchul.length === 0) {

      const mqh = hiddenStems(pillars[1].b);
      const mainQi = (mqh.find(([, g]) => g === '정기') || mqh[mqh.length - 1] || [])[0];
      const broad = mainQi && stored.includes(mainQi) ? [mainQi] : [];
      if (broad.length) {
        base.sago.inchul_broad = { via: '월지乘權(정기)', stems: broad,
          anchor: "cite:92e9b1075622",
          grade: 'HOUSE_HYPOTHESIS(HG3 p.88은 乘權引出 유형의 실재 근거 — 四庫 특례 탈락 규칙으로의 전용은 별도 유추 · 寅은 庫 아님. 월지 정기 한정 보수 축소 — 제이 결정 16-④·18-저비용② 2026-07-22)' };
      } else {

      return { ...base, integrity: 'ABSTAIN', activation: 'UNKNOWN',
        abstain_reason: '四庫충 특례 판정 불가: 司令 일수 미확보(월지 정기 proxy 폐기 — 乙木司令 p.82) ∧ 엄격 無引出 ∧ 광의 無引出(월지 정기 乘權 부재 — p.88 · 제이 결정 16-④)',
        ...edgeFields };
      }
    }

  }

  let reverseOk = null;
  if (edge_incoming === false) {
    const helper = Object.keys(GEN).find(e =>
      (GEN[atkEl] === e && CTRL[e] === tgtEl) || (GEN[e] === atkEl && GEN[tgtEl] === e)) || null;
    const defense = Object.keys(GEN).find(e => GEN[e] === tgtEl) || null;
    const els = new Set([...pillars.map(pp => ST_EL[pp.s]), ...pillars.map(pp => BR_EL[pp.b])]);
    reverseOk = attacker_status === '旺' && !!helper && els.has(helper) && !!defense && !els.has(defense);
    if (reverseOk) {
      base.reverse_gate = { helper, defense_checked: defense,
        anchor: '則卯亦能沖酉·則午能沖子 등 4쌍 (任注·地支 p.90)',
        grade: 'HOUSE(4쌍 예시의 기계 일반화 — 寅申·巳亥는 방어 조건 원문 미명시 · 방어 요구는 보수 확장)',
        jochung_axis: '助攻은 解救 助冲과 동일 계열 — 검출 커버리지(천간+지지) 공유 · 게이트 조건은 p.90 4쌍 문면 유도 유지 (제이 결정 16-② 보수 통합)' };
    } else if (base.ratio > TH_LOW) {
      return { ...base, integrity: 'ABSTAIN', activation: 'UNKNOWN',
        abstain_reason: `역방향 沖 성립조건 불충족(無尅邊·훼손 가능 구간): 旺提綱=${attacker_status === '旺'} · 助攻(${helper || '-'})=${helper ? els.has(helper) : '-'} · 防禦(${defense || '-'})무=${defense ? !els.has(defense) : '-'} — 원문 무답 구간 판정 보류`,
        ...edgeFields };
    }

  }
  let integrity, activation = 'DORMANT', classical_anchor = 'HOUSE(원문 미규정)';
  if (rEff >= TH) {
    if (!得令(target_status) && 得令(attacker_status)) { integrity = 'PULLED'; classical_anchor = '拔 (A2전단·A4전단)'; }
    else { integrity = 'DAMAGED'; base.doctrine_conflict = 'SEASON_FORCE_CONFLICT'; }

  }
  else if (rEff <= TH_LOW) { integrity = 'INTACT'; activation = 'ACTIVATED';
    classical_anchor = 得令(target_status) ? '發·反激 (A4후단·A3)' : '無傷·反激 (A2후단·A3)'; }
  else integrity = 'DISTURBED';

  if (base.haegu) {
    const ORDER = ['PULLED', 'DAMAGED', 'DISTURBED', 'INTACT'];
    const anchored = !classical_anchor.startsWith('HOUSE');
    if (protEff && anchored && integrity === 'PULLED') {
      return { ...base, integrity: 'ABSTAIN', activation: 'UNKNOWN',
        abstain_reason: `직접 앵커 구간(${classical_anchor}) ∧ 유효 보호 해구 존재 — 단정과 解救의 관계 원문 무답(p.91 정황만) · 판정 보류 (제이 결정 18-R1b 2026-07-22)`,
        ...edgeFields };
    }
    if (conflicted.length) {
      return { ...base, integrity: 'ABSTAIN', activation: 'UNKNOWN',
        abstain_reason: `당파 귀속 불안정: ${conflicted.map(c => c.char).join('·')} — 보호 후보(抑冲/通關) ∧ 공격국 拱 가담 가능(활성 미확정·문면 호명 무) → 상반 진영 순효과 불명 · 판정 보류 (결정 24-4 · R5)`,
        ...edgeFields };
    }
    const net = protEff ? 1 : 0;
    const bi = ORDER.indexOf(integrity);
    const after = net === 0 ? integrity : ORDER[Math.min(3, Math.max(0, bi + net))];
    base.haegu.status = 'RESOLVED';
    base.haegu.resolution = { protective_effective: protEff, jochung_label_only: true, net,
      before: integrity, after,
      note: !protEff ? '유효 보호 없음 — 존재만으로 불구제 (HOUSE_LOCAL_PROXY 미달 또는 무보호)' : undefined };
    integrity = after;
  }
  return { ...base, integrity, activation, classical_anchor, ...edgeFields };
}

const EFF = { NO_CLASH:1.0, INTACT:1.0, DISTURBED:0.75, DAMAGED:0.4, PULLED:0.0 };

const WG_ANCHOR_SOLVE = "cite:f2def7c653f5";
const WG_ANCHOR_BREAK = "cite:97cff59356ad";

function assessWolgwanProtection(pillars, wolgwan) {
  const branches = pillars.map(p => p.b);
  const wb = wolgwan && wolgwan.branch;
  const base = { wolgwan, authority: 'NON_AUTHORITATIVE', diagnostic_only: true };

  if (!(branches.includes('子') && branches.includes('卯')))
    return { ...base, applicable: false,
      note: '子卯 相刑 부재 — 以刑衝解刑衝 미적용(결정 29-C 범위 = 子卯刑 한정)',
      grade: 'N/A — 결정 29-C 범위 밖(子卯刑 부재)' };
  const hyeong = { parties: ['子', '卯'], aggressor: '卯', target: '子' };

  const scopeOut = (wb !== '子' && wb !== '酉');
  if (scopeOut)
    return { ...base, applicable: false, integrity: 'SCOPE', hyeong,
      note: '子卯 相刑 존재하나 月官 배치가 저본 2례(月官=子 or 酉) 밖 — 정직 보류(결정 29-C S-1)',
      grade: 'SCOPE — 결정 29-C 범위(S-1) 밖 · 저본 예시 부재' };

  const hasYouPuller = branches.includes('酉');
  if (hasYouPuller) {
    const role = wb === '子'
      ? '例1(月官=子 · 別位 卯酉冲으로 加害 卯 견인 → 不刑月之官)'
      : '例2(月官=酉 · 月官 官星이 直接 卯를 冲 → 卯無力 · 月官猶在)';
    return { ...base, applicable: true, hyeong,
      integrity: 'INTACT', activation: 'RESOLVED_BY_HYEONGCHUNG', gyeok_status: '不破',
      resolution: { via: '卯酉冲', pulled: '卯', puller: '酉', role,
        basis: 'textual_rule', anchor: WG_ANCHOR_SOLVE,
        note: '別位/月官의 刑冲(卯酉冲)이 加害 卯를 견인 → 用神(月官) 刑 解 → 格不破(以刑衝解刑衝)' },
      grade: "cite:7b3d106ac1dc" };
  }

  return { ...base, applicable: true, hyeong,
    integrity: 'ACTIVE', activation: 'HYEONG', gyeok_status: '破格',
    threat: { aggressor: '卯', on: wb, basis: 'textual_rule', anchor: WG_ANCHOR_BREAK,
      note: '加害 卯를 견인할 別位 刑冲(卯酉冲) 부재 → 刑冲用神 → 破格(以刑衝解刑衝 未成立)' },
    grade: "cite:779c808add2f" };
}

function forceAxisVerdict(idx, pillars) {
  const b = pillars[idx].b, foe = CLASH[b];
  const atkIdx = pillars.map((p, i) => (i !== idx && p.b === foe) ? i : -1).filter(i => i >= 0);
  if (!atkIdx.length) return { axis: 'dts_force', clash: false, band: 'NO_CLASH', basis: 'textual(任注·地支)' };
  const monthEl = BR_EL[pillars[1].b];
  const target_status = seasonalStatus(BR_EL[b], monthEl);
  const attacker_status = seasonalStatus(BR_EL[foe], monthEl);
  const target_power = localPower(idx, pillars, atkIdx);
  let attacker_power = 0;
  atkIdx.forEach((ai, k) => { attacker_power += localPower(ai, pillars, [idx]) * (k === 0 ? 1 : 0.6); });
  attacker_power = +attacker_power.toFixed(2);
  const ratio = target_power ? +(attacker_power / target_power).toFixed(2) : Infinity;
  let band, anchor;
  if (ratio >= TH) {
    if (!得令(target_status) && 得令(attacker_status)) { band = 'PULLED'; anchor = '拔 (A2전단·A4전단)'; }
    else { band = 'DAMAGED'; anchor = 'HOUSE(공격 失時 수량우세 or 피충 得令 열세 — 복합판단·SEASON_FORCE_CONFLICT)'; }
  } else if (ratio <= TH_LOW) { band = 'INTACT'; anchor = 得令(target_status) ? '發·反激 (A4후단)' : '無傷·反激 (A2후단)'; }
  else { band = 'DISTURBED'; anchor = 'HOUSE(중간 구간 — 원문 미규정)'; }
  return { axis: 'dts_force', clash: true, band, target_status, attacker_status, ratio, classical_anchor: anchor,
    basis: 'textual(任注 A2~A4 · 得令者冲衰則拔·衰神冲旺旺神發 · p.89~90)',
    note: '순수 세력축 — 문면 解(合)·解救·拱 재산정 미반영(프로덕션 clash.integrity 와 다를 수 있음·해석 유보)' };
}

function textualAxisVerdict(idx, pillars) {
  const b = pillars[idx].b, foe = CLASH[b];
  const atkIdx = pillars.map((p, i) => (i !== idx && p.b === foe) ? i : -1).filter(i => i >= 0);
  if (!atkIdx.length) return { axis: 'jcs_textual', clash: false, verdict: 'NO_CLASH', basis: "cite:6d287ec1cde0" };
  const hc = buildHaechung(idx, atkIdx, pillars);
  if (hc && hc.resolved) return { axis: 'jcs_textual', clash: true, verdict: 'INTACT', activation: 'RESOLVED_BY_COMBO',
    via: hc.via, basis: "cite:a9a4e7c64f10", note: '合/완전 三合會 결박 → 沖 解(문면·세력 무관)' };
  if (hc && hc.contention) return { axis: 'jcs_textual', clash: true, verdict: 'ACTIVE', resource_contention: true,
    basis: 'textual_rule(會合不能解 · 자원경합)', note: '解 매개가 자원경합으로 무효 → 沖 유지' };
  return { axis: 'jcs_textual', clash: true, verdict: 'ACTIVE', basis: 'textual_rule(會合解衝 미성립)',
    note: '解 매개(六合/완전 三合會) 부재 → 沖 유지' };
}

function crossDoctrineConflict(jcs, dts) {
  if (!jcs.clash || !dts.clash) return false;
  const jcsResolved = jcs.verdict === 'INTACT', jcsActive = jcs.verdict === 'ACTIVE';
  const dtsHarmed = dts.band === 'PULLED' || dts.band === 'DAMAGED', dtsIntact = dts.band === 'INTACT';
  return (jcsResolved && dtsHarmed) || (jcsActive && dtsIntact);
}

function huiSinCamp(el, hui_ji) {
  if (!hui_ji) return '중립';
  if ((hui_ji.xi || []).includes(el)) return '喜';
  if ((hui_ji.ji || []).includes(el)) return '忌';
  return '중립';
}
const _removedBand = band => band === 'PULLED' || band === 'DAMAGED';

function prescriptionFor(camp, target_status) {
  const deukryeong = target_status === '旺' || target_status === '相';
  if (camp === '忌' && deukryeong)
    return { rx: '沖去之', merit: '美', condition: `旺而有餘(忌神 得令·${target_status})`,
      basis: '旺而有餘者沖去之·爲美 (適天髓 任注 p.86 直讀)' };
  if (camp === '喜' && target_status && !deukryeong)
    return { rx: '會助之', merit: '美', condition: `衰而不足(喜神 失時·${target_status})`,
      basis: '衰而不足者會助之·爲美 (適天髓 任注 p.86 直讀)' };
  const condition = camp === '중립' ? '희기 무관(彼我 미해당) — 처방 대상 아님'
    : camp === '忌' ? `忌神 失時(衰·${target_status}) — 旺而有餘 미해당(沖으로 자연 제거·美-처방 불요)`
    : `喜神 得令(旺·${target_status}) — 衰而不足 미해당(자족·會助 불요)`;
  return { rx: null, merit: null, condition,
    basis: '適天髓 任注 p.86 「旺而有餘者沖去之·衰而不足者會助之·爲美」 — 조건 불충족',
    grade: 'interpretive_layer(처방 권고) — 세력축 target_status 재사용 · 구조 판정과 독립(권고는 규범·실제 구조 결과는 orientation)' };
}
function chungOrientation(idx, pillars, hui_ji) {
  const b = pillars[idx].b, foe = CLASH[b];
  const branches = pillars.map(p => p.b);
  if (!foe || !branches.includes(foe)) return null;
  const camp = huiSinCamp(BR_EL[b], hui_ji);
  const foeCamp = huiSinCamp(BR_EL[foe], hui_ji);
  const dts = forceAxisVerdict(idx, pillars);
  const band = dts && dts.band || null;
  const removed = _removedBand(band);
  let orientation, chung_qi, frame;
  if (camp === '중립') { orientation = '중립'; chung_qi = '중립'; frame = '희기 무관(彼我 미해당)'; }
  else if (camp === '忌') {
    orientation = removed ? '吉' : '미흡';
    chung_qi = removed ? '沖起(我去沖彼)' : '不起(忌 잔존)';
    frame = removed ? '彼(忌) 拔 — 我去沖彼로 忌 제거(吉)' : '忌 미제거 — 旺而有餘면 沖去 요망(p.86 처방)';
  } else {
    orientation = removed ? '凶' : '吉';
    chung_qi = removed ? '不起(彼來沖我)' : '沖起(我 보전)';
    frame = removed ? '我(喜) 拔 — 彼來沖我로 喜 손상(凶)' : '喜 보전 — 彼沖我면 會/合 보호가 吉(喜與…會爲吉)';
  }
  return { branch: b, el: BR_EL[b], camp, foe: { branch: foe, el: BR_EL[foe], camp: foeCamp },
    force_band: band, removed, chung_qi, orientation, frame,
    prescription: prescriptionFor(camp, dts && dts.target_status),
    basis: "cite:34394747fe20",
    grade: 'interpretive_layer(희기 해석) — 구조 축 미편입(p.86 결론) · 세력축 band 재사용 · 해석 유보' };
}
function gukPrescriptionFor(camp) {

  if (camp === '忌')
    return { rx: '沖去之', merit: '美',
      condition: '完全 三合局 有餘(結集·旺神) — 忌局(旺而有餘)',
      basis: "cite:08f2a0cf2797",
      grade: 'interpretive_layer(처방 권고) — 완전 三合局=有餘 결정론(p.87 旺神 근거·고정원칙4 준수) · 규범 권고(실제 구조 결과는 orientation)' };
  if (camp === '喜')
    return { rx: null, merit: null,
      condition: '完全 三合局 有餘(結集) — 喜局 자족(暗會喜神發 이미 실현·會助 불요). 衰而不足(會助之)은 미완전 三合(拱)·유년 결합 스코프(후속).',
      basis: '適天髓 任注 p.86 「衰而不足者會助之」 — 완전局 有餘로 조건 불충족(자족)',
      grade: 'interpretive_layer(처방 권고) — 완전 三合 한정(會助之는 미완전 三合 拱 스코프 후속)' };
  return { rx: null, merit: null,
    condition: '희기 무관(彼我 미해당) — 처방 대상 아님',
    basis: '適天髓 任注 p.86 「旺而有餘者沖去之·衰而不足者會助之」 — 희기 미해당',
    grade: 'interpretive_layer(처방 권고) — 중립 局' };
}

function gongPrescriptionFor(camp) {
  if (camp === '喜')
    return { rx: '會助之', merit: '美',
      condition: '衰而不足(喜神 拱·미완전 三合 유년/대운 결합) — 拱助로 근원 배양(培日主之根源)',
      basis: "cite:e38a185a1aa5",
      grade: 'interpretive_layer(처방 권고) — 미완전 三合(拱) 유년/대운 결합 = 衰而不足 會助之 실물(p.87 근거·고정원칙4 준수) · 규범 권고(실제 구조 결과는 orientation)' };
  if (camp === '忌')
    return { rx: null, merit: null,
      condition: 'SCOPE 정직 보류 — 忌 拱(미완전 三合)의 會助之/沖去 처방 저본 앵커 부재(p.87은 喜 拱만 실물 · 忌는 완전局 沖破만 「子運沖破火局」). 유년 결합 拱 忌 처방은 저본 예시 부재로 보류(제이 결정 2026-07-24).',
      basis: '適天髓 任注 p.86 「衰而不足者會助之」 — 忌 拱 처방 앵커 부재(정직 보류)',
      grade: 'SCOPE — 저본 예시 부재(제이 결정 2026-07-24 · 유년 결합 拱 忌 보류) · orientation(凶)은 拱 성립 가정 해석으로 별개 유지' };
  return { rx: null, merit: null,
    condition: '희기 무관(彼我 미해당) — 처방 대상 아님',
    basis: '適天髓 任注 p.86 「衰而不足者會助之」 — 희기 미해당',
    grade: 'interpretive_layer(처방 권고) — 중립 拱' };
}

function resolveGongActivation(pillars, gongMembers, transitList) {
  const gAnc = gAnchorFor(pillars);
  if (!gAnc || !Array.isArray(gAnc.annual_overlay)) return { activation: 'unresolved' };
  const toks = (Array.isArray(transitList) ? transitList : []).map(t => `${t.scope || '歲'}${t.s}${t.b}`);
  const ov = gAnc.annual_overlay.find(o => toks.includes(o.year) && (!o.transit || toks.includes(o.transit)));
  if (!ov) return { activation: 'unresolved' };
  const hit = (ov.relations || []).find(a => a.kind === '拱'
    && a.members.length === gongMembers.length && a.members.every(m => gongMembers.includes(m)));
  if (!hit) return { activation: 'unresolved' };
  return { activation: hit.activation, ...(hit.anchor ? { anchor: hit.anchor } : {}) };
}
function gukOrientation(pillars, hui_ji, transitList) {
  const branches = pillars.map(p => p.b), items = [];

  const combos = detectCombinations(pillars);

  const _tlGuk = Array.isArray(transitList) ? transitList : [];
  const _combinedP = _tlGuk.length ? [...pillars, ..._tlGuk.map(t => ({ s: t.s, b: t.b }))] : pillars;
  const _dayElGuk = ST_EL[pillars[2].s];
  for (const g of SANHE) {
    if (g.filter(x => branches.includes(x)).length < 3) continue;
    const el = SANHE_EL[g.join('')], camp = huiSinCamp(el, hui_ji);
    const wangji = g[1], foe = CLASH[wangji], natalChungpa = branches.includes(foe);

    let transitBreak = null;
    if (_tlGuk.length && !natalChungpa) {
      const wPos = pillars.findIndex(pp => pp.b === wangji);
      if (wPos >= 0) { const cs = clashState(wPos, _combinedP, _dayElGuk);
        if (cs && cs.group_break && cs.group_break.status === 'broken' && cs.group_break.wangji === wangji) transitBreak = cs.group_break; }
    }
    const chungpa = natalChungpa || !!transitBreak;
    const event = transitBreak ? '沖破(운래 왕지충·集團 기능해제)' : (natalChungpa ? '沖破(왕지 직충)' : '會(局 결집)');
    const orientation = chungpa
      ? (camp === '忌' ? '吉' : camp === '喜' ? '凶' : '중립')
      : (camp === '喜' ? '吉' : camp === '忌' ? '凶' : '중립');

    const combo = combos.find(c => c.kind === '三合會' && c.members.length === 3
      && g.every(x => c.members.includes(x)));
    const activation = combo ? combo.activation : 'unresolved';
    const active = activation === 'active';
    items.push({ guk: g.slice(), el, camp, wangji, event, orientation, prescription: gukPrescriptionFor(camp),
      ...(chungpa ? { chungpa_foe: foe } : {}),
      ...(transitBreak ? { group_break: { status: 'broken', attacker: transitBreak.attacker, wangji: transitBreak.wangji, anchor: transitBreak.anchor, transit_linked: true } } : {}),
      active, activation,
      ...(active && combo && combo.anchor ? { activation_anchor: combo.anchor } : {}),
      ...(active ? {} : { activation_caveat: 'P0 기계 후보(완전 三合) — 원문 문면 호명 미확정(활성 미해소). orientation 은 局 성립 가정하의 희기 해석(결정 27-1 candidate/active 분리 · 활성 확정 시 확정 해석). 세력 계상·구조 판정에는 미반영.' }),
      basis: transitBreak ? "cite:b4b977b7aa6e"
           : natalChungpa ? "cite:3abfe2765b2e"
                     : "cite:1bf25b883fc2",
      grade: transitBreak
        ? 'interpretive_layer(희기 해석) — 완전 三合局 transit 沖破 정합(group_break 조회·결정 27-2 broken·안A v0.26) · 局 성립 후 沖破(activation active 유지·去忌=吉) · orientation 값은 희기 해석'
        : 'interpretive_layer(희기 해석) — 완전 三合局 한정(1차) · 활성 정합(결정 27-1: 會 활성=원문 문면 호명 한정) · orientation 값은 활성 무관 희기 해석(해석 유보)' });
  }

  const tList = Array.isArray(transitList) ? transitList : [];
  if (tList.length) {
    const tbr = tList.map(t => t.b), allbr = [...branches, ...tbr];
    for (const g of SANHE) {
      const present = [...new Set(g.filter(x => allbr.includes(x)))];
      if (present.length !== 2) continue;
      if (!present.some(x => tbr.includes(x))) continue;
      const el = SANHE_EL[g.join('')], camp = huiSinCamp(el, hui_ji);
      const missing = g.find(x => !allbr.includes(x)), wangji = g[1];
      const orientation = camp === '喜' ? '吉' : camp === '忌' ? '凶' : '중립';
      const linked = present.filter(x => tbr.includes(x));
      const subj = present.find(m => !tbr.includes(m)) || present[0];

      const _act = resolveGongActivation(pillars, present, tList);
      const gActivation = _act.activation, gActive = gActivation === 'active';
      items.push({ guk: g.slice(), gong_members: present.slice(), missing, el, camp, wangji,
        event: '拱(미완전 三合·유년/대운 결합)', orientation, prescription: gongPrescriptionFor(camp),
        transit_linked: true, linked_transit: linked,
        active: gActive, activation: gActivation,
        ...(gActive && _act.anchor ? { activation_anchor: _act.anchor } : {}),
        ...(gActive ? {} : { activation_caveat: '拱 활성 = 원문 문면 호명 한정(결정 24-2 「巳酉無拱合之情」 p.496). 후보 검출은 P0 기계 · orientation 은 拱 성립 가정하의 희기 해석(활성 무관). 세력 계상·구조 판정 미반영.' }),
        direction_hint: { subject: subj, label: BR_EL[subj] === el ? '來(결집 후보)' : '去(이탈 후보)',
          basis: '국오행 대비 주체 글자 오행 비교(p.87 「會而來/會而去」 정황) — 주체 지정이 임의이므로 단정 불가',
          grade: "cite:0989179df1db" },
        basis: camp === '喜'
          ? "cite:342a6a73c920"
          : '適天髓 任注 「暗會其喜神。發」(p.88) · 「衰而不足者會助之」(p.86) — 拱(미완전 三合) 층',
        grade: 'interpretive_layer(희기 해석) — 미완전 三合(拱) 유년/대운 결합 한정(제이 결정 A1) · 활성 정합(결정 24-2·27-5 문면 앵커 조회 — annual_overlay 동형) · 세력 축 미편입 · 구조 판정 불변' });
    }
  }
  return items;
}
function assessHuiSinOrientation(pillars, hui_ji, prof, transitList) {
  const chung_items = prof.roots.map((r, i) => chungOrientation(i, pillars, hui_ji)).filter(Boolean);
  const guk_items = gukOrientation(pillars, hui_ji, transitList);
  const dual_doctrine_reading = prof.roots.map((r, i) => {
    const jcs = textualAxisVerdict(i, pillars), dts = forceAxisVerdict(i, pillars);
    if (!(jcs.clash || dts.clash)) return null;
    if (!crossDoctrineConflict(jcs, dts)) return null;
    const camp = huiSinCamp(BR_EL[r.branch], hui_ji);
    const favorable_axis = camp === '喜'
      ? '문면축(jcs_textual · 解·보호)이 吉方 — 彼沖我: 喜神을 會/合으로 保存함이 吉(p.86)'
      : camp === '忌'
      ? '세력축(dts_force · 拔·제거)이 吉方 — 我去沖彼: 忌神을 沖去함이 吉(p.86 처방 「旺而有餘者沖去之」)'
      : '미판정(희기 무관 — 彼我 미해당)';
    return { branch: r.branch, el: BR_EL[r.branch], camp,
      jcs_textual_verdict: jcs.verdict || (jcs.clash ? 'ACTIVE' : null),
      dts_force_band: dts.band || null, favorable_axis,
      note: 'dual_doctrine 충돌(문면 INTACT ↔ 세력 拔)의 희기 해석 — 어느 축 결과가 希忌상 吉方인지 병기(다수결 아님·해석 보조)' };
  }).filter(Boolean);
  return { hui_ji: { xi: (hui_ji.xi || []).slice(), ji: (hui_ji.ji || []).slice() },
    chung_items, guk_items, dual_doctrine_reading,
    doctrine: '適天髓 任注 「彼我去來」(p.86~88 直讀) — 彼我=희기 진영(喜=我·忌=彼). 沖: 我去沖彼=沖起(吉)/彼來沖我=不起(凶). 會/局: 暗會喜神=發/暗會忌神=禍·沖破忌局=去忌(吉).',
    note: '해석(희기) 층 — 沖起/不起·來去 최종 라벨은 구조 축에 편입하지 않음(p.86 결론). 프로덕션 판정(out.roots[].clash) 불변. 喜/忌 오행은 명시 주입(opts.hui_ji) — 용신 엔진 결선은 후속.',
    interpretive_layer: true, authority: 'NON_AUTHORITATIVE', diagnostic_only: true, user_output_enabled: false };
}

const _ELN = ['木', '火', '土', '金', '水'];
function deriveHuiJiFromYongsin(pillars) {
  const Y = require('./yongsin_engine');
  const res = Y.computeYongsin(pillars);
  const daily = Y.yongsinForDaily(res);
  const provenance = {
    type: 'auto_yongsin', engine: res.engine_id || 'yongsin_engine',
    yongsin_decision: res.decision,
    yongsin_confidence: (res.stages && res.stages.strength && res.stages.strength.confidence) || null,
    yongsin_el: daily.yongsin != null ? _ELN[daily.yongsin] : null,
    gisin_el: daily.gisin != null ? _ELN[daily.gisin] : null,
    authoritative: false,
    note: '喜/忌 = 용신 shadow 엔진 자동 결선(NON_AUTHORITATIVE · user_output_enabled=false). usable(resolved/contested)만 발화 · abstain/balanced 미발화(엔진 喜/忌 확정 불가 → 조작 금지). 소프트 신호.'
  };
  if (daily.yongsin == null) return { ok: false, provenance };
  const hui_ji = { xi: [_ELN[daily.yongsin]], ji: daily.gisin != null ? [_ELN[daily.gisin]] : [] };
  return { ok: true, hui_ji, provenance };
}
function assess(pillars, transits, opts) {
  const prof = rootProfile(pillars);
  const dayEl = ST_EL[pillars[2].s];
  const natRels = detectRelations(pillars);
  const roots = prof.roots.map((r, i) => {
    const clash = attachHyeong(clashState(i, pillars, dayEl), i, pillars);
    const w = r.weight || 0;
    const fs = functionalStatusFor(r.branch, natRels);

    return { ...r, clash, ...(fs ? { functional_status: fs } : {}), root_exists: w > 0,
      eff_conditional: clash.integrity === 'ABSTAIN' ? null : +(w * EFF[clash.integrity]).toFixed(2),
      eff_not_applied: +w.toFixed(2),
      eff_applied: clash.integrity === 'NO_CLASH' ? +w.toFixed(2) : 0 };
  });
  const sum = k => +roots.reduce((a, r) => a + (r[k] ?? 0), 0).toFixed(2);
  const abstained = roots.filter(r => r.eff_conditional === null);
  const condLow = sum('eff_conditional');
  const out = { roots,
    totals: { NOT_APPLIED: sum('eff_not_applied'), CONDITIONAL: condLow, APPLIED: sum('eff_applied'),

      CONDITIONAL_range: [condLow, +(condLow + abstained.reduce((a,r)=>a+(r.weight||0),0)).toFixed(2)] },
    abstained_count: abstained.length,
    abstained_weight: +abstained.reduce((a, r) => a + (r.weight || 0), 0).toFixed(2),
    doctrine_target: 'REN_COMMENTARY(任注)',
    authority: 'NON_AUTHORITATIVE', diagnostic_only: true, user_output_enabled: false };

  if (Array.isArray(transits) && transits.length) {
    const b4anchor = anchorFor(pillars);
    const anchorG = gAnchorFor(pillars);

    const deferred = transits.filter(t => (t.scope || '歲') === '月');
    const active_t = transits.filter(t => (t.scope || '歲') !== '月');
    const list = active_t.map(t => { const ent = { s: t.s, b: t.b, scope: t.scope || '歲' };
      const comp = b4anchor && (b4anchor.transit_components || []).find(c => c.pillar === t.s + t.b);
      if (comp && comp.inactive_stem === t.s) ent._stem_inactive = true;
      return ent; });
    const combined = [...pillars, ...list];
    const tRels = detectRelations(combined);
    const troots = prof.roots.map((r, i) => {
      const clash = attachHyeong(clashState(i, combined, dayEl), i, combined);
      const w = r.weight || 0;
      const fs = functionalStatusFor(r.branch, tRels);
      return { pos: r.pos, branch: r.branch, weight: w, clash, ...(fs ? { functional_status: fs } : {}), root_exists: w > 0,
        eff_conditional: clash.integrity === 'ABSTAIN' ? null : +(w * EFF[clash.integrity]).toFixed(2) };
    });
    const tAbst = troots.filter(r => r.eff_conditional === null);
    const tLow = +troots.reduce((a, r) => a + (r.eff_conditional ?? 0), 0).toFixed(2);
    out.transit_assessment = {
      scope: list.map(t => `${t.scope}:${t.s}${t.b}`),
      scope_anchor: "cite:a89ab1bd5f72",
      note: "cite:b97d64db2926",
      roots: troots,
      totals: { CONDITIONAL: tLow,
        CONDITIONAL_range: [tLow, +(tLow + tAbst.reduce((a, r) => a + (r.weight || 0), 0)).toFixed(2)] },
      abstained_count: tAbst.length,
      authority: 'NON_AUTHORITATIVE', diagnostic_only: true, user_output_enabled: false };
    if (deferred.length) out.transit_assessment.scope_deferred = {
      excluded: deferred.map(t => `${t.scope}${t.s}${t.b}`),
      note: '월운 SCOPE_DEFERRED — 결합 보류(결정 27-5). 「고전에 월운 결합 없음」이라는 부정 규칙 아님 — '
          + '原注 「歲月爲彼」 문면 실재(p.86) · 任注는 위치 기준 구분을 배격하고 희기 기준 사용(p.86 총결).' };

    const yearEnt = list.filter(e => e.scope === '年');
    if (yearEnt.length) {
      const gAnc = anchorG, toks = list.map(e => `${e.scope}${e.s}${e.b}`);
      const ov = gAnc && (gAnc.annual_overlay || []).find(o => toks.includes(o.year)
        && (!o.transit || toks.includes(o.transit)));
      const yb = yearEnt.map(e => e.b), allBr = combined.map(p => p.b);
      const cands = [];
      for (const g of SANHE) { const present = [...new Set(g.filter(x => allBr.includes(x)))];
        if (present.length === 2 && present.some(x => yb.includes(x)))
          cands.push({ kind: '拱', members: present, el: SANHE_EL[g.join('')], activation: 'unresolved',
            grade: 'P0 기계 후보 — 활성은 원문 문면 호명 한정(결정 27-5 후보/활성 분리)' }); }
      if (ov) for (const c of cands) {
        const hit = (ov.relations || []).find(a => a.kind === c.kind
          && a.members.length === c.members.length && a.members.every(m => c.members.includes(m)));
        if (hit) { c.activation = hit.activation; c.anchor = hit.anchor;
          if (hit.direction) c.direction = hit.direction; } }

      for (const c of cands) { const subj = c.members.find(m => !yb.includes(m)) || c.members[0];
        c.direction_hint = { subject: subj, label: BR_EL[subj] === c.el ? '來(결집 후보)' : '去(이탈 후보)',
          basis: '국오행 대비 주체 글자 오행 비교(p.87 「會而來/會而去」 정황) — 주체 지정이 임의이므로 단정 불가',
          grade: 'heuristic 한정(결정 27-3) — 활성 판정·최종 라벨 사용 불가 · 참 기준은 喜神 향배'
               + "cite:5b0935230a3f" }; }
      out.transit_assessment.annual_overlay = { scope: '年',
        year: yearEnt.map(e => `${e.scope}${e.s}${e.b}`).join(''),
        relations: cands, natal_invariant: true,
        candidate_active_separation: '후보 검출=P0 기계 · 활성=원문 문면 호명 한정(결정 27-5)',
        reversion: '연도 종료 시 overlay 소멸·원복 — natal 불변 · 대운 component 산출 불변',
        ...(ov ? { anchor: ov.anchor, multi_role_note: ov.multi_role_note } : {}),
        grade: 'ORIGINAL 앵커 한정(결정 27-5) — 일반 규칙화 보류' };
    }
    if (list.some(e => e._stem_inactive)) out.transit_assessment.s4_active_component = {
      note: '문면 호명 component만 활성(결정 24-5 S4) — 비활성 干은 해구 검출·원소 세력 계상 제외',
      inactive: list.filter(e => e._stem_inactive).map(e => `${e.scope}${e.s}${e.b}:干(${e.s}) 비활성`) };

    const transit_roots = list.map(t => {
      const via = hiddenStems(t.b).filter(([st]) => ST_EL[st] === dayEl).map(([st, r]) => `${st}(${r})`);
      return via.length ? { scope: t.scope, branch: t.b, via, weight: null,
        grade: 'HOUSE(가중 미정 — 존재만 표기 · natal 가중 체계와 미결합)',
        anchor: "cite:93482826badd" } : null;
    }).filter(Boolean);
    if (transit_roots.length) out.transit_assessment.transit_roots = transit_roots;
  }

  if (opts && opts.wolgwan) out.wolgwan_protection = assessWolgwanProtection(pillars, opts.wolgwan);

  if (opts && opts.dual_doctrine) {
    const items = prof.roots.map((r, i) => {
      const jcs = textualAxisVerdict(i, pillars), dts = forceAxisVerdict(i, pillars);
      if (!jcs.clash && !dts.clash) return null;
      const conflict = crossDoctrineConflict(jcs, dts);
      return { pos: r.pos, branch: r.branch, doctrine_axis: { jcs_textual: jcs, dts_force: dts },
        cross_doctrine_conflict: conflict,
        resolution_policy: conflict
          ? 'PRESERVE_BOTH — 다수결 금지·두 계통 판정 각각 보존·해석 유보(설계미결 안 B · concordance 동형)'
          : 'CONCORDANT — 두 계통 동일 방향' }; }).filter(Boolean);
    out.dual_doctrine = { items,
      doctrine_systems: { jcs_textual: "cite:09f81435e1ef",
        dts_force: "cite:26f976efac79" },
      note: '두 계통 각각 산출·병기(미결1 안 B). 다수결 금지·cross_doctrine_conflict 보존. 프로덕션 판정은 out.roots[].clash(순서 우선순위 rank1~4 · sehyeok_interaction_priority_v017) — 본 블록은 진단 병기(해석 유보). 刑 축은 이미 문면축 단독(29-A/B/C).',
      conflict_count: items.filter(x => x.cross_doctrine_conflict).length,
      authority: 'NON_AUTHORITATIVE', diagnostic_only: true, user_output_enabled: false };
  }

  const _huiT = (Array.isArray(transits) ? transits : []).filter(t => (t.scope || '歲') !== '月')
    .map(t => ({ s: t.s, b: t.b, scope: t.scope || '歲' }));
  if (opts && opts.hui_ji) out.hui_sin_orientation = assessHuiSinOrientation(pillars, opts.hui_ji, prof, _huiT);

  else if (opts && opts.hui_ji_auto) {
    const d = deriveHuiJiFromYongsin(pillars);
    if (d.ok) {
      const base = assessHuiSinOrientation(pillars, d.hui_ji, prof, _huiT);
      out.hui_sin_orientation = { ...base, hui_ji_source: d.provenance,
        note: base.note + ' [v0.20 자동 결선: 喜/忌를 용신 엔진에서 파생 — hui_ji_source 참조. 명시 opts.hui_ji 주입 시 그쪽 우선.]' };
    } else {
      out.hui_sin_orientation = { auto_derivation: 'ABSTAIN', hui_ji_source: d.provenance,
        hui_ji: { xi: [], ji: [] }, chung_items: [], guk_items: [], dual_doctrine_reading: [],
        doctrine: '適天髓 任注 「彼我去來」(p.86~88) — 자동 결선 대상이나 용신 엔진 abstain/balanced 로 喜/忌 미확정.',
        note: '용신 엔진이 喜/忌를 확정하지 못함(abstain/balanced) → 喜神 향배 미발화. 喜/忌 조작 금지(고정원칙 5). 명시 opts.hui_ji 주입 시 발화.',
        interpretive_layer: true, authority: 'NON_AUTHORITATIVE', diagnostic_only: true, user_output_enabled: false };
    }
  }
  return out;
}

module.exports = { assess, clashState, localPower, seasonalStatus,
  _internals: { positionMetaFor, detectCombinations, buildGroupBreak, sealBasis, WANGJI, RB_DOMAIN, g2HyeongOverlap, attachHyeong, forceAxisVerdict, textualAxisVerdict, crossDoctrineConflict, huiSinCamp, chungOrientation, gukOrientation, gongPrescriptionFor, deriveHuiJiFromYongsin } };
