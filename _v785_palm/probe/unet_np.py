"""unet_model.py 의 forward 를 numpy 로 재현한다 (torch 불필요)."""
import numpy as np

def conv2d(x, w, b=None, pad=0, rows=64):
    # x:(C,H,W)  w:(O,C,kh,kw)
    C,H,W = x.shape; O,_,kh,kw = w.shape
    if pad: x = np.pad(x, ((0,0),(pad,pad),(pad,pad)))
    Hp,Wp = x.shape[1:]
    oh, ow = Hp-kh+1, Wp-kw+1
    out = np.empty((O,oh,ow), np.float32)
    wf = w.reshape(O,-1)
    for r0 in range(0, oh, rows):                 # 행 블록으로 나눠 메모리 절약
        r1 = min(r0+rows, oh)
        col = np.empty((C*kh*kw, (r1-r0)*ow), np.float32)
        i = 0
        for c in range(C):
            for a in range(kh):
                for bx in range(kw):
                    col[i] = x[c, r0+a:r0+a+(r1-r0), bx:bx+ow].reshape(-1); i += 1
        out[:, r0:r1, :] = (wf @ col).reshape(O, r1-r0, ow)
    if b is not None: out += b[:,None,None]
    return out

def bn(x, w, bias, mean, var, eps=1e-5):
    return (x-mean[:,None,None])/np.sqrt(var[:,None,None]+eps)*w[:,None,None]+bias[:,None,None]

relu = lambda x: np.maximum(x,0,out=x)
sig  = lambda x: 1/(1+np.exp(-x))

def maxpool2(x):
    C,H,W = x.shape; H-=H%2; W-=W%2
    return x[:,:H,:W].reshape(C,H//2,2,W//2,2).max(axis=(2,4))

def up_bilinear2(x):                               # align_corners=True, scale=2
    C,H,W = x.shape
    oh,ow = H*2, W*2
    sy = (H-1)/(oh-1) if oh>1 else 0.0
    sx = (W-1)/(ow-1) if ow>1 else 0.0
    yy = np.arange(oh)*sy; xx = np.arange(ow)*sx
    y0 = np.floor(yy).astype(int); x0 = np.floor(xx).astype(int)
    y1 = np.minimum(y0+1,H-1);     x1 = np.minimum(x0+1,W-1)
    wy = (yy-y0)[None,:,None].astype(np.float32);  wx = (xx-x0)[None,None,:].astype(np.float32)
    a = x[:,y0][:,:,x0]; b = x[:,y0][:,:,x1]; c = x[:,y1][:,:,x0]; d = x[:,y1][:,:,x1]
    return (a*(1-wy)*(1-wx) + b*(1-wy)*wx + c*wy*(1-wx) + d*wy*wx).astype(np.float32)

def softmax2d(x):                                  # 채널 방향
    e = np.exp(x - x.max(axis=0, keepdims=True))
    return e / e.sum(axis=0, keepdims=True)

def dconv(x, sd, p):                               # DoubleConv
    x = relu(bn(conv2d(x, sd[f'{p}.0.weight'], pad=1),
                sd[f'{p}.1.weight'], sd[f'{p}.1.bias'], sd[f'{p}.1.running_mean'], sd[f'{p}.1.running_var']))
    x = relu(bn(conv2d(x, sd[f'{p}.3.weight'], pad=1),
                sd[f'{p}.4.weight'], sd[f'{p}.4.bias'], sd[f'{p}.4.running_mean'], sd[f'{p}.4.running_var']))
    return x

def up(x1, x2, sd, p):                             # Up: upsample → pad → concat → DoubleConv
    x1 = up_bilinear2(x1)
    dy, dx = x2.shape[1]-x1.shape[1], x2.shape[2]-x1.shape[2]
    if dy or dx:
        x1 = np.pad(x1, ((0,0),(dy//2,dy-dy//2),(dx//2,dx-dx//2)))
    return dconv(np.concatenate([x2,x1],0), sd, f'{p}.conv.double_conv')

def forward(img, sd):
    """img: (3,H,W) float32, H·W 는 16의 배수. 반환: (H,W) logit"""
    x1 = dconv(img, sd, 'inc.double_conv')
    x2 = dconv(maxpool2(x1), sd, 'down1.maxpool_conv.1.double_conv')
    x3 = dconv(maxpool2(x2), sd, 'down2.maxpool_conv.1.double_conv')
    x4 = dconv(maxpool2(x3), sd, 'down3.maxpool_conv.1.double_conv')
    # ContextFusion
    p = maxpool2(x4)
    m = softmax2d(conv2d(p, sd['cfm.context_modeling.0.weight'], sd['cfm.context_modeling.0.bias'])) * p
    t1 = sig(conv2d(relu(conv2d(m, sd['cfm.context_transform1.0.weight'], sd['cfm.context_transform1.0.bias'])),
                    sd['cfm.context_transform1.2.weight'], sd['cfm.context_transform1.2.bias']))
    t2 = conv2d(relu(conv2d(m, sd['cfm.context_transform2.0.weight'], sd['cfm.context_transform2.0.bias'])),
                sd['cfm.context_transform2.2.weight'], sd['cfm.context_transform2.2.bias'])
    x5 = t1*p + t2
    x = up(x5, x4, sd, 'up1'); x = up(x, x3, sd, 'up2')
    x = up(x, x2, sd, 'up3');  x = up(x, x1, sd, 'up4')
    return conv2d(x, sd['outc.conv.weight'], sd['outc.conv.bias'])[0]
