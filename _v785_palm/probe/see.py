import sys,os,glob; sys.path.insert(0,'/var/tmp/palm')
import numpy as np
from PIL import Image, ImageDraw
from pthread import load
from unet_np import forward
from mask import palm_mask
from mask2 import palm_mask2
from metrics import skeletonize

D="/sessions/friendly-dreamy-babbage/mnt/ChunWoon_palm_dataset/A-smoke"
O="/sessions/friendly-dreamy-babbage/mnt/outputs"
sd=load("palm-api/checkpoint_aug_epoch70.pth"); S=256; BIG=440

def label(m):
    lab=np.zeros(m.shape,np.int32); cur=0; H,W=m.shape
    for i in range(H):
        for j in range(W):
            if m[i,j] and lab[i,j]==0:
                cur+=1; st=[(i,j)]; lab[i,j]=cur
                while st:
                    y,x=st.pop()
                    for dy in(-1,0,1):
                        for dx in(-1,0,1):
                            yy,xx=y+dy,x+dx
                            if 0<=yy<H and 0<=xx<W and m[yy,xx] and lab[yy,xx]==0:
                                lab[yy,xx]=cur; st.append((yy,xx))
    return lab,cur

def heat(p):
    """확률맵 → 컬러 (검정→파랑→노랑→흰색)"""
    x=np.clip(p,0,1)
    r=np.clip(x*3-1,0,1); g=np.clip(x*3-0.6,0,1)**0.8; b=np.clip(x*2.2,0,1)*(1-np.clip(x*2-1,0,1)*0.5)
    return (np.stack([r,g,b],-1)*255).astype(np.uint8)

PAL=[(255,60,60),(60,200,255),(120,255,120),(255,200,60),(230,120,255),
     (255,150,80),(80,255,220),(200,200,255),(255,90,180),(160,255,60),
     (90,160,255),(255,240,120)]

fs=sorted(glob.glob(os.path.join(D,'*.jpg')))
picks=[fs[12],fs[0],fs[4]]
cols=4
sheet=Image.new('RGB',(BIG*cols+10*(cols-1), (BIG+52)*len(picks)),'white')
d=ImageDraw.Draw(sheet)
print(f"{'file':>12}{'조각수':>7}{'최장(px)':>10}{'상위5 길이':>28}{'면적%':>8}")
for i,f in enumerate(picks):
    im=Image.open(f)
    sm=np.asarray(im.resize((im.width//16,im.height//16)),np.float32)
    h,_=palm_mask(sm); ys,xs=np.nonzero(h)
    cy,cx=int(ys.mean())*16,int(xs.mean())*16
    side=max(int(max(np.ptp(ys),np.ptp(xs))*0.95)*16,400)
    x0,y0=max(0,cx-side//2),max(0,cy-side//2)
    crop=im.crop((x0,y0,min(im.width,x0+side),min(im.height,y0+side))).resize((S,S),Image.LANCZOS)
    rgb=np.asarray(crop,np.float32); palm=palm_mask2(rgb)
    lg=forward(np.ascontiguousarray(rgb.transpose(2,0,1)/255.),sd); pr=1/(1+np.exp(-lg))
    det=(pr>0.5)&palm
    lab,n=label(det)
    # 조각별 골격 길이
    lens=[]
    for k in range(1,n+1):
        sk=skeletonize(lab==k); lens.append((int(sk.sum()),k))
    lens.sort(reverse=True)
    keep={k for L,k in lens if L>=8}          # ★8px 미만은 파편으로 본다
    y=i*(BIG+52)+46
    # 1 원본
    sheet.paste(crop.resize((BIG,BIG),Image.LANCZOS),(0,y))
    # 2 확률맵
    sheet.paste(Image.fromarray(heat(pr)).resize((BIG,BIG),Image.NEAREST),(BIG+10,y))
    # 3 검출 오버레이
    ov=np.asarray(crop,np.float32).copy(); ov[det]=[255,40,40]
    sheet.paste(Image.fromarray(ov.astype(np.uint8)).resize((BIG,BIG),Image.NEAREST),((BIG+10)*2,y))
    # 4 연결성분 색칠
    cc=(np.asarray(crop,np.float32)*0.35)
    for j,(L,k) in enumerate(lens):
        if k in keep: cc[lab==k]=PAL[j%len(PAL)]
    sheet.paste(Image.fromarray(cc.astype(np.uint8)).resize((BIG,BIG),Image.NEAREST),((BIG+10)*3,y))
    for j,t in enumerate(["① 원본","② 확률맵 (밝을수록 선일 확률↑)",
                          "③ 검출 (p>0.5 · 손바닥 안)",f"④ 조각별 색 구분 — {len(keep)}조각"]):
        d.text(((BIG+10)*j+4, y-18), t, fill='black')
    d.text((4,y-36), f"{os.path.basename(f)[-10:]}", fill=(120,120,120))
    top5=" ".join(f"{L}" for L,_ in lens[:5])
    print(f"{os.path.basename(f)[-10:]:>12}{len(keep):>7}{lens[0][0] if lens else 0:>10}{top5:>28}{det.sum()/max(palm.sum(),1)*100:>8.2f}")
sheet.save(os.path.join(O,'how_it_sees.png'))
print("saved", sheet.size)
