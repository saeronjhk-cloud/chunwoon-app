import sys, os, glob, time
sys.path.insert(0,'/var/tmp/palm')
import numpy as np
from PIL import Image
from pthread import load
from unet_np import forward

D="/sessions/friendly-dreamy-babbage/mnt/손금 사진"
O="/sessions/friendly-dreamy-babbage/mnt/outputs"
sd = load("palm-api/checkpoint_aug_epoch70.pth")

def palm_crop(path, size=256):
    """살색 최대 덩어리의 중심을 잡아 정사각 크롭 (연막 시험용 간이 검출)"""
    im = Image.open(path); W,H = im.size
    sm = np.asarray(im.resize((W//16, H//16)), np.float32)
    r,g,b = sm[...,0], sm[...,1], sm[...,2]
    mx, mn = sm.max(-1), sm.min(-1)
    skin = (r>95)&(g>40)&(b>20)&((mx-mn)>15)&(np.abs(r-g)>15)&(r>g)&(r>b)
    ys,xs = np.nonzero(skin)
    if len(ys)<50: cy,cx = sm.shape[0]//2, sm.shape[1]//2; side=min(sm.shape[:2])
    else:
        cy,cx = int(np.median(ys)), int(np.median(xs))
        side = int(max(np.percentile(ys,90)-np.percentile(ys,10),
                       np.percentile(xs,90)-np.percentile(xs,10))*0.85)
    cy,cx,side = cy*16, cx*16, max(side*16, 400)
    x0,y0 = max(0,cx-side//2), max(0,cy-side//2)
    x1,y1 = min(W,x0+side), min(H,y0+side)
    crop = im.crop((x0,y0,x1,y1)).resize((size,size), Image.LANCZOS)
    return crop, (x0,y0,x1,y1)

fs = sorted(glob.glob(os.path.join(D,'*.jpg')))
picks = [fs[0], fs[7], fs[12], fs[19]]
S = 256
tiles=[]
for f in picks:
    crop, box = palm_crop(f, S)
    arr = np.asarray(crop, np.float32).transpose(2,0,1)/255.0
    t=time.time(); logit = forward(np.ascontiguousarray(arr), sd); dt=time.time()-t
    prob = 1/(1+np.exp(-logit))
    print(f"{os.path.basename(f)[-10:]} crop={box} {dt:5.1f}s  "
          f"logit[{logit.min():7.2f},{logit.max():7.2f}]  prob>0.5: {(prob>0.5).mean()*100:5.2f}%  "
          f"mean={prob.mean():.3f}")
    tiles.append((os.path.basename(f)[-10:], crop, prob))

# 시각화: 원본 | 확률맵 | 오버레이
sheet = Image.new('RGB',(S*3, S*len(tiles)+20*len(tiles)),'white')
from PIL import ImageDraw
d=ImageDraw.Draw(sheet)
for i,(n,crop,prob) in enumerate(tiles):
    y=i*(S+20)+18
    sheet.paste(crop,(0,y))
    pm = Image.fromarray((prob*255).astype(np.uint8)).convert('RGB')
    sheet.paste(pm,(S,y))
    ov = np.asarray(crop,np.float32).copy()
    ov[...,0] = np.where(prob>0.5, 255, ov[...,0])
    ov[...,1] = np.where(prob>0.5, 0,   ov[...,1])
    ov[...,2] = np.where(prob>0.5, 0,   ov[...,2])
    sheet.paste(Image.fromarray(ov.astype(np.uint8)),(S*2,y))
    d.text((2,y-14), f"{n}   |  원본 / 확률맵 / 오버레이(p>0.5)", fill='black')
sheet.save(os.path.join(O,'unet_infer.png'))
print("saved unet_infer.png")
