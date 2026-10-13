# x03 — 실사진(라벨셋·셀카·인터넷 127장)에 미소 판정기 적용. 사진별 점수와 묶음별 보류율.
import json, pickle, numpy as np
from smile_feat import feats, FEATS
M = pickle.load(open('models.pkl', 'rb')); mu, sd = np.array(M['_mu']), np.array(M['_sd'])
U = '/mnt/user-data/uploads/ChunWoon_IP/face/'
S = {'labelset': 'eval_labelset', 'selfie': 'eval_selfie', 'internet': 'eval_hairline'}
rows = []
for sname, d in S.items():
    for k, e in json.load(open(U + d + '/cache/landmarks.json')).items():
        f = feats(e['lm'], e['w'], e['h']); x = np.array([f[n] for n in FEATS]); r = {'set': sname, 'id': k, **{n: round(f[n], 3) for n in FEATS}}
        for name in ['5특징', 'wide 제외 4특징', 'lift+gap+lowcurve']:
            m, w, b, t = M[name]; m = np.array(m)
            r[name] = round(float(((x[m] - mu[m]) / sd[m]) @ np.array(w) + b - t), 2)   # >0 = 보류
        rows.append(r)
json.dump(rows, open('real_scores.json', 'w'), ensure_ascii=False, indent=0)
for name in ['5특징', 'wide 제외 4특징', 'lift+gap+lowcurve']:
    print(f'\n== {name} (임계 대비 여유, >0 보류)')
    for s in S:
        R = [r for r in rows if r['set'] == s]; fl = [r for r in R if r[name] > 0]
        print(f'  {s:9s} 보류 {len(fl)}/{len(R)} : ' + ', '.join(f"{r['id']}({r[name]:+.1f})" for r in sorted(fl, key=lambda r: -r[name])))
print('\n제이 미소 셀카:', [ (r['id'], r['5특징'], r['wide 제외 4특징'], r['lift+gap+lowcurve']) for r in rows if 'smile' in r['id']])
