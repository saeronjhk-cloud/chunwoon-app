# d09 — 안경 놓침/오탐 근접 사례의 눈·콧등 영역 확대 시트(진단용)
import json,gzip,os,numpy as np
from PIL import Image,ImageDraw
EV=os.path.join('..','ChunWoon_IP','face','eval_selfie')
GT=json.load(open(f'{EV}/gray/glasses_gt.json'))['gt']
LS=json.load(open(f'{EV}/cache/landmarks.json'));LH=json.load(open(f'{EV}/gray/hl_landmarks.json'))
keys=['jay_2011_g_selfie_b','jay_2011_g_selfie_c','jay_2011_g_selfie_a','jay_2011_g_selfie_close_a','hl_h13','hl_h04','hl_h05','hl_h09']
tiles=[]
for k in keys:
  g=GT[k];L=(LH[k[3:]] if k.startswith('hl_') else LS[k])['lm'];w,h=g['w'],g['h']
  a=np.frombuffer(gzip.open(f'{EV}/gray/{k}.gray.gz').read(),np.uint8).reshape(h,w)
  X=lambda i:L[i][0]*w;Y=lambda i:L[i][1]*h
  ex=abs(X(362)-X(133));cx=(X(133)+X(362))/2;cy=(Y(168)+Y(6))/2
  box=(int(cx-1.6*ex),int(cy-0.9*ex),int(cx+1.6*ex),int(cy+0.9*ex))
  im=Image.fromarray(a).crop(box).resize((480,270))
  d=ImageDraw.Draw(im);d.text((4,4),k,fill=255)
  tiles.append(im)
sheet=Image.new('L',(960,270*4))
for i,t in enumerate(tiles):sheet.paste(t,((i%2)*480,(i//2)*270))
sheet.save('_v798_work/d09_contact.png')
