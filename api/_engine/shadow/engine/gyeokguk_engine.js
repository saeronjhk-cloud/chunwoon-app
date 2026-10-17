// 생성물(P-805-D build_shadow_dist) — 수정 금지. 원본은 IP.


'use strict';
const fs = require('fs'); const path = require('path');
const M = require('./myeongli');
const { computeYongsin } = require('./yongsin_engine');
const IP = path.join(__dirname, '..', 'IP');
const load = (p) => JSON.parse(fs.readFileSync(path.join(IP, p), 'utf8'));
const G = load('rules/saju/gyeokguk.json');
const JJG = load('rules/saju/jijanggan.json');
const SINSAL = load('rules/saju/sinsal.json');
const EL = M.ELEMENT_NAME;
const stemEl = (s) => M.STEM_ELEMENT[M.stemIndex(s)];
const grps = (d) => ({ bi: d, sik: (d+1)%5, jae: (d+2)%5, gwan: (d+3)%5, in: (d+4)%5 });
const classify = (d, el) => { const g = grps(d); for (const k of Object.keys(g)) if (g[k] === el) return k; };

function computeGyeokguk(pillars, opts = {}) {
  const day = pillars[2];
  const dayEl = stemEl(day.s);
  const g = grps(dayEl);
  const mB = pillars[1].b;
  const monthHidden = JJG.table[mB];
  const jeonggi = monthHidden[monthHidden.length - 1][0];
  const revealStems = [pillars[0].s, pillars[1].s, pillars[3].s];
  const revealEls = new Set(revealStems.map(stemEl));
  const branches = pillars.map(p => p.b);
  const citation_ids = [G.citation_span_id];

  let gyeokStem = null, via = '월령본기';
  for (const [stem] of [...monthHidden].reverse()) {
    if (revealStems.includes(stem)) { gyeokStem = stem; via = '투출'; break; }
  }
  if (!gyeokStem) gyeokStem = jeonggi;
  const sip = M.sipsin(day.s, gyeokStem);

  const ROK = { '甲':'寅','乙':'卯','丙':'巳','丁':'午','戊':'巳','己':'午','庚':'申','辛':'酉','壬':'亥','癸':'子' };
  const isYanginBranch = SINSAL.yangin[day.s] === mB && !!M.STEM_YANG[M.stemIndex(day.s)];
  const isRokBranch = ROK[day.s] === mB;

  const _jeonggiEl = stemEl(jeonggi);
  const isWolgeopBranch = !isRokBranch && _jeonggiEl === dayEl && jeonggi !== day.s && ROK[jeonggi] === mB;
  const gyeokIsPeer = G.special_when_peer.codes.includes(sip.code);
  if (isYanginBranch || isRokBranch || isWolgeopBranch || gyeokIsPeer) {
    const specialLabel = isYanginBranch ? '양인격' : (isRokBranch ? '건록격' : '월겁격');
    const gg = grps(dayEl);
    const revEl = new Set(revealStems.map(stemEl));
    const branchJeonggiEl = new Set(branches.map(b => stemEl(JJG.table[b][JJG.table[b].length - 1][0])));
    const shows = (k) => revEl.has(gg[k]) || branchJeonggiEl.has(gg[k]);
    let wonmun_sangsin;
    if (isYanginBranch) {
      const has = shows('gwan');
      wonmun_sangsin = {
        pattern: '양인격', wonmun_rule: "cite:2ffbbb1d0282",
        candidates: has ? [{ use: '官/煞', role: '制刃', boja: '財印' }] : [],
        note: has ? '관살로 양인을 제복' : '관살 미투 — 제인 상신 없음(억부 판단)'
      };
    } else {
      const c = [];
      if (shows('gwan')) c.push({ use: '官(또는 煞)', role: '別取', boja: '財印/制伏', desc: '用官逢財印 / 用煞遇制伏' });
      if (shows('jae')) c.push({ use: '財', role: '別取', need: '食傷', desc: '用財帶食傷(化劫生財)' });
      if (!shows('gwan') && !shows('jae') && shows('sik')) c.push({ use: '食傷', role: '泄', desc: '無財官 → 食傷 泄(春木秋金 貴)' });
      wonmun_sangsin = {
        pattern: specialLabel, wonmun_rule: "cite:cc6d635bde33",
        candidates: c, note: c.length ? '투출한 財官煞食으로 상신 택일' : '財官煞食 미투 — 상신 없음(억부 판단)'
      };
    }
    return {
      engine_id: G.engine_id, engine_version: G.engine_version,
      decision_authority: G.decision_authority, user_output_enabled: G.user_output_enabled,
      input: { pillars: pillars.map(p => p.s + p.b).join(' '), dayGan: day.s, month: mB },
      gyeok: specialLabel, gyeok_stem: gyeokStem, sipsin: sip.name, via,
      decision: 'special_pattern', use: null, sangsin: [], defer_to: 'balance(억부)',
      wonmun_sangsin,
      note: '비겁 월령 — 강약은 억부 축. 원문 상신 후보는 wonmun_sangsin(shadow) 참고', citation_ids,
      uncertainty: { notes: ["cite:35119dcc9599"] }
    };
  }

  const strength = opts.strength || computeYongsin(pillars).stages.strength.state;

  const disrupted = branches.map((b, i) => branches.some((c, j) => j !== i && M.branchRelations(b, c).includes('沖')));
  const rolesOf = (el) => pillars.map((p, i) => ({ i, dis: disrupted[i], roles: JJG.table[p.b].filter(([s]) => stemEl(s) === el).map(([, r]) => r) })).filter(x => x.roles.length);
  const strongRoot = (el) => rolesOf(el).some(x => !x.dis && x.roles.some(r => r === '정기' || r === '중기'));
  const visible = (el) => pillars.filter(p => stemEl(p.s) === el).length;
  const present = (el) => rolesOf(el).length > 0 || visible(el) > 0;
  const effective = (el) => strongRoot(el) || visible(el) >= 2;
  const positionOf = (el) => {
    const posN = ['연', '월', '일', '시'];
    for (let i = 0; i < 4; i++) if (stemEl(pillars[i].s) === el) return posN[i] + '간';
    for (let i = 0; i < 4; i++) if (rolesOf(el).some(x => x.i === i)) return posN[i] + '지';
    return null;
  };
  const damaged = (el) => { const r = rolesOf(el); return r.length > 0 && r.every(x => x.dis); };

  const rule = G.gyeok_by_sipsin[sip.code];
  const hasGroup = (k) => { const el = g[k]; return present(el); };
  const byeongPresent = (rule.byeong || []).some(k => hasGroup(k));
  const yanginBranch = SINSAL.yangin[day.s];
  const hasYangin = !!(yanginBranch && branches.includes(yanginBranch));

  const condMet = (cond) =>
    cond === 'default' ? true :
    (cond === 'has_byeong' || cond === 'has_byeong2') ? byeongPresent :
    cond === 'strong' ? strength === 'strong' :
    cond === 'weak' ? strength === 'weak' :
    cond === 'has_yangin' ? hasYangin : false;

  const seen = new Set(); const sangsin = [];
  for (const r of rule.sangsin_rules) {
    if (!condMet(r.cond) || seen.has(r.candidate)) continue;
    seen.add(r.candidate);
    const isYangin = r.candidate === 'yangin';
    const elIdx = isYangin ? dayEl : g[r.candidate];
    const el = EL[elIdx];
    const isPresent = isYangin ? hasYangin : present(elIdx);
    const isEff = isYangin ? hasYangin : effective(elIdx);
    sangsin.push({
      group: r.candidate, el,
      role_code: `${r.candidate}@${sip.code}/${rule.use}`,
      condition: r.desc,
      present: isPresent,
      effective: isEff === true ? 'UNKNOWN' : false,
      effective_signal: isEff,
      position: isYangin ? (hasYangin ? '지지' : null) : positionOf(elIdx),
      damaged: isYangin ? false : damaged(elIdx)
    });
  }

  const primaryCandidate = sangsin.find(s => s.effective_signal) || sangsin[0] || null;

  const anyEff = sangsin.some(s => s.effective_signal);
  let seong_pae;
  if (rule.use === '역용') seong_pae = anyEff ? 'seong(제복됨)' : 'pae(흉신 무제)';
  else seong_pae = byeongPresent ? (anyEff ? 'seong(구응 있음)' : 'pae(병존재·구응없음)') : (anyEff ? 'seong' : 'undetermined');

  const notes = [`상신은 조건부 baseline(${rule.use}) — 위치·합충·성상신 세부는 전문가 검증 전 비확정`];
  if (rule.byeong.length) notes.push(`병(病): ${rule.byeong_desc} — 존재:${byeongPresent}`);

  return {
    engine_id: G.engine_id, engine_version: G.engine_version,
    decision_authority: G.decision_authority, user_output_enabled: G.user_output_enabled,
    input: { pillars: pillars.map(p => p.s + p.b).join(' '), dayGan: day.s, month: mB },
    gyeok: rule.name, gyeok_stem: gyeokStem, sipsin: sip.name, via, use: rule.use,
    byeong: rule.byeong, byeong_present: byeongPresent, strength_input: strength,
    sangsin,
    primary_sangsin_candidate: primaryCandidate,
    selected_sangsin: null,
    verification: 'EXPERT_PENDING',
    seong_pae, seong_pae_status: 'baseline_unverified',
    decision: 'resolved_shadow', citation_ids,
    uncertainty: { notes }
  };
}

module.exports = { computeGyeokguk };
