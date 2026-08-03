import json
from collections import Counter, defaultdict
from pathlib import Path

root = Path('/home/user/workspace/upload')

def extract_json_values(path):
    text = path.read_text(encoding='utf-8')
    decoder = json.JSONDecoder()
    values = []
    cursor = 0
    while True:
        start = text.find('{', cursor)
        if start < 0:
            break
        try:
            obj, consumed = decoder.raw_decode(text[start:])
            values.append(obj)
            cursor = start + consumed
        except json.JSONDecodeError:
            cursor = start + 1
    return values

def extract_list(path):
    values = extract_json_values(path)
    return next(value['data'] for value in values if isinstance(value.get('data'), list))

sets = extract_list(root / 'all sets extract.txt')
cards = extract_list(root / 'all cards extract.txt')

print('sets', len(sets))
print('cards', len(cards))
print('set codes missing', sum(not s.get('code') for s in sets))
print('card codes missing', sum(not c.get('code') for c in cards))
print('image counts', Counter(len(c.get('images') or []) for c in cards))
print('image sizes', Counter(tuple(sorted((c.get('images') or [{}])[0].keys())) for c in cards))
print('attribute keys')
print(Counter(k for c in cards for k in (c.get('attributes') or {})))
print('card types', Counter(str((c.get('attributes') or {}).get('CardType')) for c in cards))
print('rarities', Counter(str((c.get('attributes') or {}).get('Rarity')) for c in cards))
print('duplicate codes', sum(1 for _,n in Counter(c.get('code') for c in cards if c.get('code')).items() if n > 1))
for code, n in Counter(c.get('code') for c in cards if c.get('code')).most_common():
    if n > 1:
        rows = [c for c in cards if c.get('code') == code]
        print('DUP', code, n, [(r.get('_id'), r.get('name'), (r.get('set') or {}).get('code'), (r.get('set') or {}).get('slug')) for r in rows][:8])
print('sets')
for s in sets:
    print(s.get('_id'), '|', s.get('code'), '|', s.get('name'), '|', s.get('release_date'))
print('cards without set', sum(not c.get('set') for c in cards))
print('cards with absent set in sets', sorted({(c.get('set') or {}).get('_id') for c in cards if (c.get('set') or {}).get('_id') not in {s.get('_id') for s in sets}}))
