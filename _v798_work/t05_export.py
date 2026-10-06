# t05 — CNN 가중치 내보내기(텐서별 int8 + 배율) → JS 상수 문자열
import torch,numpy as np,base64,json
sd=torch.load('t04_cnn.pt');order=['c1.weight','c1.bias','c2.weight','c2.bias','c3.weight','c3.bias','f1.weight','f1.bias','f2.weight','f2.bias']
q=[];sc=[];shapes=[]
for n in order:
  w=sd[n].numpy().astype(np.float64).ravel();s=np.abs(w).max()/127 or 1.0;q.append(np.round(w/s).astype(np.int8));sc.append(float(f'{s:.6e}'));shapes.append(list(sd[n].shape))
blob=base64.b64encode(np.concatenate(q).tobytes()).decode()
json.dump({'order':order,'shapes':shapes,'scales':sc,'b64':blob},open('t05_weights.json','w'))
print(len(blob),sum(len(x) for x in q))
