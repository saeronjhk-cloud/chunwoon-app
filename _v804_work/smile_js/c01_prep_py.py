# v804 c01 — CelebA valid-00000 앞 N장: ×3 쌍선형(x01 규칙) → 앱처럼 ≤640 축소(PNG 무손실) · 파이썬 FaceMesh(static·refine 끔) 두 경로
#   py640 = 같은 PNG(엔진 차만 보기) · py3x = x01 원 경로(축소 전 · 임계를 정한 경로)
import sys, io, json, os
import numpy as np, pyarrow.parquet as pq
from PIL import Image
import mediapipe as mp
pf, od, N = sys.argv[1], sys.argv[2], int(sys.argv[3]); os.makedirs(od + '/img', exist_ok=True)
fm = mp.solutions.face_mesh.FaceMesh(static_image_mode=True, max_num_faces=1, refine_landmarks=False, min_detection_confidence=0.5)
f = pq.ParquetFile(pf); meta = {}; P640 = {}; P3 = {}; n = 0
cols = ['image', 'celeb_id', 'Smiling', 'Mouth_Slightly_Open', 'Eyeglasses', 'Male', 'Young']
lmj = lambda res: [[round(p.x, 6), round(p.y, 6), round(p.z, 6)] for p in res.multi_face_landmarks[0].landmark] if res.multi_face_landmarks else None
for rg in range(f.num_row_groups):
    for r in f.read_row_group(rg, columns=cols).to_pylist():
        if n >= N: break
        n += 1; k = f'{n:05d}'
        im = Image.open(io.BytesIO(r['image']['bytes'])).convert('RGB'); W, H = im.size; im3 = im.resize((W * 3, H * 3), Image.BILINEAR)
        s = min(1, 640 / im3.width, 640 / im3.height); im6 = im3.resize((round(im3.width * s), round(im3.height * s)), Image.BILINEAR) if s < 1 else im3
        im6.save(f'{od}/img/{k}.png')
        meta[k] = {'id': r['celeb_id'], 'smile': bool(r['Smiling']), 'open': bool(r['Mouth_Slightly_Open']), 'glasses': bool(r['Eyeglasses']), 'male': bool(r['Male'])}
        P3[k] = {'w': im3.width, 'h': im3.height, 'lm': lmj(fm.process(np.asarray(im3)))}
        P640[k] = {'w': im6.width, 'h': im6.height, 'lm': lmj(fm.process(np.asarray(im6)))}
    if n >= N: break
for nm, d in [('meta', meta), ('py3x', P3), ('py640', P640)]: json.dump(d, open(f'{od}/{nm}.json', 'w'))
print('n', n, 'nodet py3x', sum(v['lm'] is None for v in P3.values()), 'py640', sum(v['lm'] is None for v in P640.values()))
