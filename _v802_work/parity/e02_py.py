# e02 — 파이썬 mediapipe 0.10.14 solutions.face_mesh(static_image_mode) refine=True 로 같은 사진(평가 캐시는 refine=False).
import sys,json,os,numpy as np
from PIL import Image
import mediapipe as mp
PH,OUT=sys.argv[1],sys.argv[2]
fm=mp.solutions.face_mesh.FaceMesh(static_image_mode=True,max_num_faces=1,refine_landmarks=True,min_detection_confidence=0.5)
out={}
for f in sorted(os.listdir(PH)):
    if not f.endswith('.jpg'): continue
    im=Image.open(os.path.join(PH,f)).convert('RGB');r=fm.process(np.asarray(im))
    out[f[:-4]]={'w':im.size[0],'h':im.size[1],'lm':[[p.x,p.y,p.z] for p in r.multi_face_landmarks[0].landmark][:468] if r.multi_face_landmarks else None}
json.dump(out,open(OUT,'w'));print(OUT,len(out),sum(1 for v in out.values() if not v['lm']))
