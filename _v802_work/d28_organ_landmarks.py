# d28 — 오관 비례 측정점 진단 (v802 이후 · 원칙 28 근거 조사)
# 실사진 랜드마크 캐시(라벨셋·셀카·인터넷)에서 코폭 후보 점쌍과 눈·입 폭을 2D 픽셀 수평거리로 재고,
# 인체계측 문헌(한국인 Kim SH 2008/2012 · Lee 2019)의 비율과 비교한다. 수치만 낸다(코드 변경 없음).
import json, os, statistics as st, sys
IP = sys.argv[1]
sets = {'labelset': 'eval_labelset/cache/landmarks.json', 'selfie': 'eval_selfie/cache/landmarks.json', 'internet': 'eval_hairline/cache/landmarks.json'}
NOSE = {'129-358': (129, 358), '48-278': (48, 278), '64-294': (64, 294), '102-331': (102, 331), '98-327': (98, 327),
        '49-279': (49, 279), '219-439': (219, 439), '115-344': (115, 344), '240-460': (240, 460), '235-455': (235, 455)}
rows = []
for name, rel in sets.items():
    d = json.load(open(os.path.join(IP, rel), encoding='utf-8'))
    for k, e in d.items():
        lm = e.get('lm') if isinstance(e, dict) else None
        if not lm or len(lm) < 468: continue
        w, h = e.get('w', 1), e.get('h', 1)
        P = [(a[0] * w, a[1] * h) for a in lm]
        dx = lambda a, b: abs(P[a][0] - P[b][0])
        r = {'set': name, 'id': k, 'pid': e.get('pid', k)}
        r['faceW'] = dx(234, 454)
        r['eyeL'] = dx(33, 133); r['eyeR'] = dx(362, 263); r['eye'] = (r['eyeL'] + r['eyeR']) / 2
        r['enen'] = dx(133, 362); r['exex'] = dx(33, 263)
        r['mouth'] = dx(61, 291)
        for nk, (a, b) in NOSE.items(): r['n' + nk] = dx(a, b)
        rows.append(r)
def med(v): return st.median(v)
def q(v, p): v = sorted(v); return v[int(p * (len(v) - 1))]
print('N =', len(rows), {s: sum(1 for r in rows if r['set'] == s) for s in sets})
print('\n[1] 코폭 후보 점쌍 — 폭/얼굴폭 중앙 · 코/내안각간(en-en) · 입/코 · 2눈/코  (문헌 한국인: 코/en-en 1.04~1.06 · 입/코 1.19~1.23 · 2눈/코 ≈1.55~1.60)')
for nk in NOSE:
    n = [r['n' + nk] for r in rows]
    print(f"  {nk:8s} 폭/얼굴폭 {med([r['n'+nk]/r['faceW'] for r in rows]):.3f} · 코/enen {med([r['n'+nk]/r['enen'] for r in rows]):.2f} · 입/코 {med([r['mouth']/r['n'+nk] for r in rows]):.2f} · 2눈/코 {med([2*r['eye']/r['n'+nk] for r in rows]):.2f}")
print('\n[2] 눈 — 눈폭(33-133)/en-en 중앙', round(med([r['eye'] / r['enen'] for r in rows]), 3), '(문헌 en-ex/en-en ≈ 0.81 · 신고전 규준 1.0)')
print('    exex/enen', round(med([r['exex'] / r['enen'] for r in rows]), 3), '(문헌 ≈ 2.6~2.7)')
print('    입/en-en', round(med([r['mouth'] / r['enen'] for r in rows]), 3), '(문헌 ≈ 1.24~1.30)')
print('\n[3] 묶음별 현행 공식 값(129-358) 중앙 [P10~P90]')
for s in sets:
    R = [r for r in rows if r['set'] == s]
    a = [2 * r['eye'] / r['n129-358'] for r in R]; b = [r['mouth'] / r['n129-358'] for r in R]
    print(f"  {s:9s} 2눈/코 {med(a):.2f} [{q(a,.1):.2f}~{q(a,.9):.2f}] · 입/코 {med(b):.2f} [{q(b,.1):.2f}~{q(b,.9):.2f}]")
