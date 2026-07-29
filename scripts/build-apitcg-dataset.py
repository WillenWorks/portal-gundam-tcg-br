import json
from pathlib import Path

project = Path('/home/user/workspace/portal-gundam-tcg-br-review')
upload = Path('/home/user/workspace/upload')
out_dir = project / 'data'
out_dir.mkdir(exist_ok=True)

def json_values(path):
    text = path.read_text(encoding='utf-8')
    decoder = json.JSONDecoder()
    values = []
    position = 0
    while True:
        start = text.find('{', position)
        if start < 0:
            break
        try:
            value, consumed = decoder.raw_decode(text[start:])
            values.append(value)
            position = start + consumed
        except json.JSONDecodeError:
            position = start + 1
    return values

def all_data_lists(path):
    return [value['data'] for value in json_values(path) if isinstance(value.get('data'), list)]

set_pages = all_data_lists(upload / 'all sets extract.txt')
card_pages = all_data_lists(upload / 'all cards extract.txt')
sets_by_id = {item['_id']: item for page in set_pages for item in page}
cards_by_id = {str(item['_id']): item for page in card_pages for item in page}

payload = {
    'source': 'API TCG user-provided extraction',
    'generatedAt': '2026-07-28',
    'sourcePageCounts': {'sets': len(set_pages), 'cards': len(card_pages)},
    'sets': list(sets_by_id.values()),
    'cards': list(cards_by_id.values()),
}
(out_dir / 'apitcg-gundam.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f"wrote {len(payload['sets'])} sets and {len(payload['cards'])} unique cards from {len(card_pages)} card pages")
