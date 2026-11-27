import requests, time
from PIL import Image
import numpy as np
url='http://localhost:5000/api/cameras/a54b71bd-1acc-44ae-9f1d-83304d4e6e5f/stream'
r=requests.get(url, stream=True, timeout=10)
print('status', r.status_code, r.headers.get('content-type'))
buf=bytearray()
start=time.time()
frame=None
for chunk in r.iter_content(chunk_size=4096):
    buf.extend(chunk)
    s=buf.find(b'\xff\xd8')
    e=buf.find(b'\xff\xd9')
    if s!=-1 and e!=-1 and e>s:
        frame=bytes(buf[s:e+2])
        break
    if time.time()-start>8:
        break
print('frame len', len(frame) if frame else None)
if frame:
    open('d:/eldercare/eldercare/liveframe.jpg','wb').write(frame)
    im=Image.open('d:/eldercare/eldercare/liveframe.jpg'); a=np.array(im)
    print('shape', a.shape)
    print('mean RGB', a.reshape(-1,3).mean(0))
    print('std', a.reshape(-1,3).std(0))
r.close()
