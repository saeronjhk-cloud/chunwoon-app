# d29 — 입 측정점 후보 + 「오관 크기 상응(相應)」 후보 지표의 사람 안 일관성(ICC) 진단. 수치만(코드 변경 없음).
# 원문(太淸神鑑 卷二 五行相剋歌 C7: 鼻大眼小·眼大鼻小·眼大唇小·唇大眼小 = 剋)의 「크기가 서로 어긋남」을
# 얼굴폭 정규화 크기의 백분위 차로 옮긴 후보를 시험한다. 기준 모집단 = 사람당 1표(인터넷 23 + 라벨셋 사람별 중앙).
import json, os, statistics as st, sys
IP = sys.argv[1]
L = json.load(open(os.path.join(IP, 'eval_labelset/cache/landmarks.json'), encoding='utf-8'))
H = json.load(open(os.path.join(IP, 'eval_hairline/cache/landmarks.json'), encoding='utf-8'))
def meas(e):
    w, h = e['w'], e['h']; P = [(a[0]*w, a[1]*h) for a in e['lm']]
    dx = lambda a, b: abs(P[a][0]-P[b][0]); fw = dx(234, 454)
    return {'fw': fw, 'enen': dx(133, 362), 'eye': (dx(33,133)+dx(362,263))/2, 'nose': dx(129,358), 'nose98': dx(98,327),
            'm61': dx(61,291), 'm78': dx(78,308), 'm62': dx(62,292), 'm76': dx(76,306)}
print('[1] 입 후보 — 입/en-en 중앙 (문헌 한국인 ch-ch/en-en 1.24~1.30)')
allm = [meas(e) for e in list(L.values())+list(H.values())]
for k in ['m61','m62','m76','m78']:
    print(f"  {k}: {st.median([m[k]/m['enen'] for m in allm]):.3f}  · /얼굴폭 {st.median([m[k]/m['fw'] for m in allm]):.3f}")
# 크기(얼굴폭 정규화)
def sizes(m, nk='nose', mk='m61'): return {'eye': m['eye']/m['fw'], 'nose': m[nk]/m['fw'], 'mouth': m[mk]/m['fw']}
people = {}
for k, e in L.items(): people.setdefault(e['pid'], []).append(meas(e))
def ref_pop(nk, mk):
    ref = [sizes(meas(e), nk, mk) for e in H.values()]
    for pid, ms in people.items():
        S = [sizes(m, nk, mk) for m in ms]; ref.append({o: st.median([s[o] for s in S]) for o in ['eye','nose','mouth']})
    return ref
def rank(v, arr): return sum(1 for a in arr if a < v)/len(arr) + 0.5*sum(1 for a in arr if a == v)/len(arr)
def icc(groups):
    k = [len(g) for g in groups]; N = sum(k); g_m = [st.mean(g) for g in groups]; grand = st.mean([x for g in groups for x in g])
    ssb = sum(n*(m-grand)**2 for n, m in zip(k, g_m)); ssw = sum((x-m)**2 for g, m in zip(groups, g_m) for x in g)
    a = len(groups); msb = ssb/(a-1); msw = ssw/(N-a); n0 = (N - sum(n*n for n in k)/N)/(a-1)
    return (msb-msw)/(msb+(n0-1)*msw), (msb/n0)**0.5 if msb>0 else 0, msw**0.5
print('\n[2] 후보 지표 ICC(라벨셋 8명 · 사진 64장) — 사람 간 SD · 사람 안 SD')
for nk, mk in [('nose','m61'), ('nose98','m61')]:
    ref = ref_pop(nk, mk); R = {o: [r[o] for r in ref] for o in ['eye','nose','mouth']}
    out = {'현행 1.62 오관항': [], '상응(백분위차) 눈-코·눈-입': [], '상응 3쌍': [], '눈 크기 rank': [], '코 크기 rank': [], '입 크기 rank': []}
    for pid, ms in people.items():
        g = {kk: [] for kk in out}
        for m in ms:
            s = sizes(m, nk, mk); r = {o: rank(s[o], R[o]) for o in s}
            g['현행 1.62 오관항'].append(1 - min(1, (abs(2*m['eye']/m['nose']-1.62)/1.62 + abs(m['m61']/m['nose']-1.62)/1.62)/2))
            g['상응(백분위차) 눈-코·눈-입'].append(1 - (abs(r['eye']-r['nose']) + abs(r['eye']-r['mouth']))/2)
            g['상응 3쌍'].append(1 - (abs(r['eye']-r['nose']) + abs(r['eye']-r['mouth']) + abs(r['nose']-r['mouth']))/3)
            g['눈 크기 rank'].append(r['eye']); g['코 크기 rank'].append(r['nose']); g['입 크기 rank'].append(r['mouth'])
        for kk in out: out[kk].append(g[kk])
    print(f'  코={nk} 입={mk} · 기준 모집단 n={len(ref)}')
    for kk, groups in out.items():
        i, sb, sw = icc(groups); allv = [x for gg in groups for x in gg]
        print(f"    {kk:22s} ICC {i:5.2f} · 사람 간 SD {sb:.3f} · 사람 안 SD {sw:.3f} · 평균 {st.mean(allv):.3f}")
