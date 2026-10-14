# v804 c03 — CelebA valid 600: 미소 로짓 py3x(임계를 정한 경로) · py640(같은 PNG 파이썬) · js640(앱 엔진) 비교 (P-804-A §3 미소 조건)
import json, sys
sys.path.insert(0, sys.argv[1]); from smile_feat import feats, FEATS
M = json.load(open(sys.argv[1] + '/smile_model.json')); D = sys.argv[2]
meta = json.load(open(D + '/meta.json')); E = {e: json.load(open(f'{D}/{e}.json')) for e in ['py3x', 'py640', 'js640']}
lg = lambda v: None if not v['lm'] else sum((feats(v['lm'], v['w'], v['h'])[n] - M['mu'][i]) / M['sd'][i] * M['w'][i] for i, n in enumerate(FEATS)) + M['b']
L = {e: {k: lg(v) for k, v in E[e].items()} for e in E}
ks = [k for k in meta if all(L[e][k] is not None for e in E)]
neu = [k for k in ks if not meta[k]['smile']]; smi = [k for k in ks if meta[k]['smile']]
out = {'n': len(ks), 'neutral': len(neu), 'smile': len(smi), 'warnT': M['warnT'], 'holdT': M['holdT']}
for e in E:
    out[e] = {'neu_warn%': round(100 * sum(L[e][k] > M['warnT'] for k in neu) / len(neu), 2), 'neu_hold%': round(100 * sum(L[e][k] > M['holdT'] for k in neu) / len(neu), 2),
              'smile_warn%': round(100 * sum(L[e][k] > M['warnT'] for k in smi) / len(smi), 2), 'smile_hold%': round(100 * sum(L[e][k] > M['holdT'] for k in smi) / len(smi), 2)}
for a, b in [('js640', 'py3x'), ('js640', 'py640'), ('py640', 'py3x')]:
    d = sorted(abs(L[a][k] - L[b][k]) for k in ks)
    out[f'{a}_vs_{b}'] = {'|dlogit|_med': round(d[len(d) // 2], 3), '|dlogit|_p95': round(d[int(.95 * len(d))], 3), 'mean_dlogit': round(sum(L[a][k] - L[b][k] for k in ks) / len(ks), 3),
        'warn_agree%': round(100 * sum((L[a][k] > M['warnT']) == (L[b][k] > M['warnT']) for k in ks) / len(ks), 2), 'hold_agree%': round(100 * sum((L[a][k] > M['holdT']) == (L[b][k] > M['holdT']) for k in ks) / len(ks), 2)}
out['rule_neutral_warn_diff_pp(js640-py3x)'] = round(out['js640']['neu_warn%'] - out['py3x']['neu_warn%'], 2)
out['rule_triggered(>1.5pp)'] = abs(out['rule_neutral_warn_diff_pp(js640-py3x)']) > 1.5
print(json.dumps(out, ensure_ascii=False, indent=1))
