# HQ 전량 구축 — CelebAMask-HQ(v-xchen-v/celebamask_hq) parquet 1개 단위 처리
# 정답: eye_g 마스크의 '눈 상자' 안 비율 ≥0.6 → pos(눈 위 안경) · eye_g 0 → neg · <0.1 → head(머리 위 안경, 음성) · 사이 → amb(제외)
# 저장: 얼굴 상자(랜드마크 외곽 +12%) 로 자른 gray(77R+150G+29B>>8, 1024→640 축소 후) + 자른 좌표계 정규화 랜드마크
import pyarrow.parquet as pq,io,json,gzip,os,sys,numpy as np
from PIL import Image
import mediapipe as mp
pf=sys.argv[1];NNEG=int(sys.argv[2]) if len(sys.argv)>2 else 800
tag=os.path.splitext(pf)[0];os.makedirs(f'full/{tag}',exist_ok=True)
fm=mp.solutions.face_mesh.FaceMesh(static_image_mode=True,max_num_faces=1,refine_landmarks=False,min_detection_confidence=0.5)
f=pq.ParquetFile(pf);c={'pos':0,'neg':0,'head':0,'amb':0,'nodet':0};out={};idx=0
for rg in range(f.num_row_groups):
  for r in f.read_row_group(rg).to_pylist():
    idx+=1
    lab=np.array(Image.open(io.BytesIO(r['label']['bytes'])))
    if lab.ndim==3: lab=lab[...,0]
    eg=(lab==9);ng=int(eg.sum())
    if ng==0 and c['neg']>=NNEG: continue
    im=Image.open(io.BytesIO(r['image']['bytes'])).convert('RGB').resize((640,640),Image.BILINEAR)
    res=fm.process(np.asarray(im))
    if not res.multi_face_landmarks: c['nodet']+=1;continue
    L=res.multi_face_landmarks[0].landmark
    if ng==0: lab_='neg';ratio=None
    else:
      H,W=eg.shape;X=lambda i:L[i].x*W;Y=lambda i:L[i].y*H;ex=abs(X(362)-X(133))
      x0,x1=int(max(0,min(X(33),X(263))-0.5*ex)),int(min(W,max(X(33),X(263))+0.5*ex))
      y0,y1=int(max(0,min(Y(105),Y(334))-0.2*ex)),int(min(H,max(Y(118),Y(347))+0.5*ex))
      ratio=float(eg[y0:y1,x0:x1].sum())/ng
      lab_='pos' if ratio>=0.6 else ('head' if ratio<0.1 else 'amb')
    if lab_=='amb': c['amb']+=1;continue
    xs=[p.x*640 for p in L];ys=[p.y*640 for p in L];bw=max(xs)-min(xs);bh=max(ys)-min(ys)
    cx0=int(max(0,min(xs)-0.12*bw));cx1=int(min(640,max(xs)+0.12*bw));cy0=int(max(0,min(ys)-0.12*bh));cy1=int(min(640,max(ys)+0.12*bh))
    a=np.asarray(im).astype(np.uint32)[cy0:cy1,cx0:cx1];gr=((a[...,0]*77+a[...,1]*150+a[...,2]*29)>>8).astype(np.uint8)
    w,h=cx1-cx0,cy1-cy0
    lm=[[round((p.x*640-cx0)/w,5),round((p.y*640-cy0)/h,5)] for p in L]
    k=f'{tag}_{idx:04d}';gzip.open(f'full/{tag}/{k}.gray.gz','wb').write(gr.tobytes())
    out[k]={'w':w,'h':h,'label':lab_,'glasses':lab_=='pos','eyeg_ratio':None if ratio is None else round(ratio,3),'src':r['image'].get('path'),'lm':lm}
    c[lab_]+=1
json.dump({'parquet':pf,'scanned':idx,'counts':c,'items':out},open(f'full/{tag}.json','w'))
print(pf,'scanned',idx,c,flush=True)
