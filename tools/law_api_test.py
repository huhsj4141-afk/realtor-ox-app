import json, os, urllib.request, urllib.parse
OC = os.environ.get('LAW_OC') or open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'law_oc.txt')).read().strip()
def get(u):
    req = urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=30) as r: return r.status, r.read().decode('utf8', 'ignore')
for u in [f'https://www.law.go.kr/DRF/lawSearch.do?OC={OC}&target=law&type=JSON&query=' + urllib.parse.quote('공인중개사법'),
          f'https://www.law.go.kr/DRF/lawService.do?OC={OC}&target=law&type=JSON&ID=' + '001946']:
    try:
        s, b = get(u); print(s, b[:600].replace('\n', ' '))
    except Exception as e:
        print('ERR', e, getattr(e, 'read', lambda: b'')().decode('utf8','ignore')[:300])
