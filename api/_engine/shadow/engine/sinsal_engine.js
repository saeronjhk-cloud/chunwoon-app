// 생성물(P-805-D build_shadow_dist) — 수정 금지. 원본은 IP.

'use strict';
const fs = require('fs'); const path = require('path');
const S = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'IP', 'rules', 'saju', 'sinsal.json'), 'utf8'));

function computeSinsal(pillars) {
  const dayStem = pillars[2].s;
  const yearBranch = pillars[0].b;
  const branches = pillars.map(p => p.b);
  const pos = ['연', '월', '일', '시'];
  const found = [];

  (S.cheoneulgwiin[dayStem] || []).forEach(tb => {
    branches.forEach((b, i) => { if (b === tb) found.push({ name: '천을귀인', at: pos[i], branch: b, doctrine: '통용', basis: 'day_stem' }); });
  });

  const yin = S.yangin[dayStem];
  if (yin) branches.forEach((b, i) => { if (b === yin) found.push({ name: '양인', at: pos[i], branch: b, doctrine: 'ZPJZ_PATTERN', target_scope: 'daymaster' }); });

  const yinS = S.yangin_smth_star[dayStem];
  if (yinS) branches.forEach((b, i) => { if (b === yinS) found.push({ name: '양인星', at: pos[i], branch: b, doctrine: 'SMTH_STAR', target_scope: 'daymaster' }); });

  const grp = S.samhap.find(g => g.members.includes(yearBranch));
  if (grp) {
    const map = { 도화: grp.dohwa, 역마: grp.yeokma, 화개: grp.hwagae };
    for (const [name, tb] of Object.entries(map)) {
      branches.forEach((b, i) => { if (b === tb) found.push({ name, at: pos[i], branch: b, doctrine: 'SMTH', basis: 'year_branch', target_scope: 'social_lineage' }); });
    }
  }
  return { citation_ids: [S.citation_span_id], list: found };
}

module.exports = { computeSinsal };
