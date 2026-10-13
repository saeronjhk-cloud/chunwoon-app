# x01 — CelebA(flwrlabs/celeba, img_align+identity+attr) → MediaPipe 0.10.14 FaceMesh 468 랜드마크 + 라벨
# 사용: python x01_extract.py <parquet> <out.json> <max_rows>
# 이미지 178×218 정렬본 → ×3 쌍선형 확대(작은 얼굴 검출 안정화) · 랜드마크는 확대 이미지 픽셀 좌표 기준 정규화(0~1)로 저장.
import sys, io, json
import numpy as np, pyarrow.parquet as pq
from PIL import Image
import mediapipe as mp
pf, out, N = sys.argv[1], sys.argv[2], int(sys.argv[3])
fm = mp.solutions.face_mesh.FaceMesh(static_image_mode=True, max_num_faces=1, refine_landmarks=False, min_detection_confidence=0.5)
f = pq.ParquetFile(pf); items = {}; n = 0; nodet = 0
cols = ['image', 'celeb_id', 'Smiling', 'Mouth_Slightly_Open', 'Eyeglasses', 'Male', 'Young']
for rg in range(f.num_row_groups):
    for r in f.read_row_group(rg, columns=cols).to_pylist():
        if n >= N: break
        n += 1
        im = Image.open(io.BytesIO(r['image']['bytes'])).convert('RGB')
        W, H = im.size; im = im.resize((W * 3, H * 3), Image.BILINEAR)
        res = fm.process(np.asarray(im))
        if not res.multi_face_landmarks: nodet += 1; continue
        L = res.multi_face_landmarks[0].landmark
        items[f'{n:05d}'] = {'w': W * 3, 'h': H * 3, 'id': r['celeb_id'], 'smile': bool(r['Smiling']), 'open': bool(r['Mouth_Slightly_Open']),
                             'glasses': bool(r['Eyeglasses']), 'male': bool(r['Male']), 'young': bool(r['Young']),
                             'lm': [[round(p.x, 5), round(p.y, 5), round(p.z, 5)] for p in L]}
    if n >= N: break
json.dump({'parquet': pf, 'scanned': n, 'nodet': nodet, 'items': items}, open(out, 'w'))
print(pf, 'scanned', n, 'nodet', nodet, 'kept', len(items), flush=True)
