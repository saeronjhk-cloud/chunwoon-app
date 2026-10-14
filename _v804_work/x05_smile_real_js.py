# v804 ①-B — 미소 fixture 실사진 기록값(real)을 정본 캐시(JS)에서 파이썬 smile_feat 로 재생성 (P-804-A §2 F형 · 계수 무변경)
# 사용: python3 _v804_work/x05_smile_real_js.py   (cw_lm_engine.js --set js 상태에서)
import json, os, sys, math
R = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(R, '..', '_v802_work', 'smile'))
from smile_feat import feats, FEATS
IP = os.path.join(R, '..', '..', 'ChunWoon_IP', 'face')
M = json.load(open(os.path.join(R, '..', '_v802_work', 'smile', 'smile_model.json'), encoding='utf-8'))
assert M['feats'] == FEATS
for d in ['eval_labelset', 'eval_selfie', 'eval_hairline']:
    E = json.load(open(os.path.join(IP, d, 'cache', 'ENGINE.json'), encoding='utf-8'))
    assert E.get('landmarks.json') == 'js', d + ' 활성 캐시가 js 가 아님'
FP = os.path.join(R, '..', '_v802_work', 'smile', 'smile_fixture.json')
FX = json.load(open(FP, encoding='utf-8'))
real = {}
for d in ['eval_labelset', 'eval_selfie', 'eval_hairline']:
    for k, e in json.load(open(os.path.join(IP, d, 'cache', 'landmarks.json'), encoding='utf-8')).items():
        f = feats(e['lm'], e['w'], e['h'])
        real[k] = sum((f[n] - M['mu'][i]) / M['sd'][i] * M['w'][i] for i, n in enumerate(FEATS)) + M['b']
assert set(real) == set(FX['real'])
if 'real_py' not in FX: FX['real_py'] = FX['real']
FX['real'] = real
FX['note'] = FX['note'].split(' ★v804')[0] + ' ★v804: real = 정본 캐시(앱 엔진 JS · refine 끔) 기준 · real_py = v803 파이썬 캐시 기준(보존) — x05_smile_real_js.py'
json.dump(FX, open(FP, 'w', encoding='utf-8'), ensure_ascii=False)
dl = [abs(real[k] - FX['real_py'][k]) for k in real]
ch = [k for k in real if (real[k] > M['warnT']) != (FX['real_py'][k] > M['warnT']) or (real[k] > M['holdT']) != (FX['real_py'][k] > M['holdT'])]
print('n', len(real), 'py→js |Δlogit| 중앙 %.3f 최대 %.3f' % (sorted(dl)[len(dl)//2], max(dl)), '· 경고/보류 판정 바뀜', len(ch), ch)
