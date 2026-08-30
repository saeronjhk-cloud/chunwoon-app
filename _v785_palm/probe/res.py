import sys,os,glob,time; sys.path.insert(0,'/var/tmp/palm')
import numpy as np
from PIL import Image, ImageDraw
from pthread import load
from unet_np import forward
sys.path.insert(0,'/var/tmp/palm')
exec(open('/var/tmp/palm/run.py').read().split('fs = sorted')[0].split('sd = load')[0].replace('import sys, os, glob, time',''))
D="/sessions/friendly-dreamy-babbage/mnt/손금 사진"; O="/sessions/friendly-dreamy-babbage/mnt/outputs"
sd = load("palm-api/checkpoint_aug_epoch70.pth")
f = sorted(glob.glob(os.path.join(D,'*.jpg')))[12]
im = Image.open(f).crop((1104,240,3344,2480))
sizes=[192,256,384,512]
tiles=[]
print(f"{'size':>6}{'sec':>7}{'p>0.5 %':>10}{'logit max':>11}{'평균 선폭(px)':>14}")
for S in sizes:
    arr=np.asarray(im.resize((S,S),Image.LANCZOS),np.float32).transpose(2,0,1)/255.
    t=time.time(); lg=forward(np.ascontiguousarray(arr),sd); dt=time.time()-t
    pr=1/(1+np.exp(-lg)); m=pr>0.5
    # 선 폭 ≈ 면적 / 골격길이 근사(수평·수직 런 길이 평균)
    runs=[]
    for row in m:
        c=0
        for v in row:
            if v: c+=1
            elif c: runs.append(c); c=0
        if c: runs.append(c)
    print(f"{S:>6}{dt:>7.1f}{m.mean()*100:>10.2f}{lg.max():>11.2f}{np.mean(runs) if runs else 0:>14.2f}")
    tiles.append((S,im.resize((S,S)),pr))
sheet=Image.new('RGB',(512*2+8,(512+22)*len(tiles)),'white'); d=ImageDraw.Draw(sheet)
for i,(S,crop,pr) in enumerate(tiles):
    y=i*(512+22)+18
    sheet.paste(crop.resize((512,512)),(0,y))
    pm=Image.fromarray((pr*255).astype(np.uint8)).resize((512,512),Image.NEAREST).convert('RGB')
    sheet.paste(pm,(520,y)); d.text((2,y-14),f"입력 {S}x{S}  →  확률맵",fill='black')
sheet.save(os.path.join(O,'res_sweep.png')); print("saved")
