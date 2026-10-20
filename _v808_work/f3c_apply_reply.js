// P-808-F3c §5 반영 — F3c_답_제이.txt(정규화본) → F3c_applied.json (adjudicated 와 같은 모양)
'use strict';
const fs = require('fs'), path = require('path');
const D = process.argv[2], HD = path.join(D, 'human');
const norm = (s) => s == null ? null : String(s).normalize('NFC').replace(/\s+/g, '');
const ADJ = JSON.parse(fs.readFileSync(path.join(D, 'adjudicated.json'), 'utf8'));
const items = JSON.parse(fs.readFileSync(path.join(HD, 'F3c_items.json'), 'utf8'));
const ans = {}; for (const l of fs.readFileSync(path.join(HD, 'F3c_답_제이.txt'), 'utf8').split(/\r?\n/)) { const m = l.match(/^(\d{3})\s+(1|2|3|\?|=.+)\s*$/); if (m) ans[+m[1]] = m[2]; }
const cells = JSON.parse(JSON.stringify(ADJ.cells)); const st = { HUMAN_VERIFIED: 0, UNRESOLVED: 0, pick: 0, write: 0, write_eq_cand: 0, han_not4: [] };
for (const it of items) { const a = ans[it.no]; let v = null;
  if (/^[123]$/.test(a)) { v = it.cands[+a - 1]; st.pick++; } else if (a && a[0] === '=') { v = norm(a.slice(1)) || null; st.write++; if (it.cands.includes(v)) st.write_eq_cand++; }
  const prev = cells[it.cell][it.field];
  cells[it.cell][it.field] = v ? { status: 'HUMAN_VERIFIED', value: v, reads: prev.reads, human: { no: it.no, answer: a } } : { status: 'UNRESOLVED', value: null, reads: prev.reads, human: { no: it.no, answer: a } };
  st[v ? 'HUMAN_VERIFIED' : 'UNRESOLVED']++;
  if (v && it.field === 'han' && !it.cell.endsWith('_H') && [...v].length !== 4) st.han_not4.push(it.no); }
fs.writeFileSync(path.join(HD, 'F3c_applied.json'), JSON.stringify({ version: 'P-808-F3c', base: 'adjudicated.json', cells }, null, 0));
console.log(JSON.stringify(st));
