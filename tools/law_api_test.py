import json, os, urllib.request, urllib.parse
OC = open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'law_oc.txt')).read().strip()
def get(u):
    req = urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=30) as r: return r.read().decode('utf8', 'ignore')
s = json.loads(get(f'https://www.law.go.kr/DRF/lawSearch.do?OC={OC}&target=law&type=JSON&query=' + urllib.parse.quote('공인중개사법 시행령')))
for l in s['LawSearch']['law'][:3]: print(l['법령명한글'], l['법령일련번호'], l['현행연혁코드'])
mst = [l for l in s['LawSearch']['law'] if l['법령명한글'] == '공인중개사법 시행령'][0]['법령일련번호']
b = get(f'https://www.law.go.kr/DRF/lawService.do?OC={OC}&target=law&type=JSON&MST={mst}&JO=002400')
print(len(b)); print(b[:1500])
