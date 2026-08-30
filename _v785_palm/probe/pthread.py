"""torch 없이 .pth(state_dict) 를 numpy 로 읽는다."""
import zipfile, pickle, numpy as np, collections

DT = {'FloatStorage':np.float32,'DoubleStorage':np.float64,'HalfStorage':np.float16,
      'LongStorage':np.int64,'IntStorage':np.int32,'ByteStorage':np.uint8,
      'CharStorage':np.int8,'ShortStorage':np.int16,'BoolStorage':np.bool_}

def load(path):
    z = zipfile.ZipFile(path)
    root = z.namelist()[0].split('/')[0]
    class Storage:
        def __init__(self, key, dtype, numel): self.key, self.dtype, self.numel = key, dtype, numel
    def rebuild(storage, offset, size, stride, *rest):
        raw = z.read(f"{root}/data/{storage.key}")
        arr = np.frombuffer(raw, dtype=storage.dtype)
        n = int(np.prod(size)) if len(size) else 1
        return arr[offset:offset+n].reshape(size) if n else arr[offset:offset+1]
    class U(pickle.Unpickler):
        def find_class(self, mod, name):
            if name == '_rebuild_tensor_v2': return rebuild
            if name == 'OrderedDict': return collections.OrderedDict
            if name in DT: return name
            return lambda *a, **k: None
        def persistent_load(self, pid):
            _, st, key, _loc, numel = pid
            return Storage(key, DT[st if isinstance(st,str) else st.__name__], numel)
    return U(z.open(f"{root}/data.pkl")).load()
