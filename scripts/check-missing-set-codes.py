import json
from pathlib import Path

project = Path('/home/user/workspace/portal-gundam-tcg-br-review')
upload = Path('/home/user/workspace/upload')

def json_values(path):
    text = path.read_text(encoding='utf-8')
    decoder = json.JSONDecoder(); values=[]; pos=0
    while True:
        start=text.find('{',pos)
        if start < 0: break
        try:
            value, consumed=decoder.raw_decode(text[start:]); values.append(value); pos=start+consumed
        except json.JSONDecodeError: pos=start+1
    return values

def data_list(path):
    return next(value['data'] for value in json_values(path) if isinstance(value.get('data'),list))

sets=data_list(upload/'all sets extract.txt')
cards=data_list(upload/'all cards extract.txt')
set_codes={s['_id']:s.get('code') for s in sets}
for sid in [s['_id'] for s in sets if not s.get('code')]:
    rows=[c for c in cards if (c.get('set') or {}).get('_id')==sid]
    print(sid, [(c['code'], c['name']) for c in rows[:20]])
