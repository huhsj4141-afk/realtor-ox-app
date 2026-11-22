"""국가법령정보센터 Open API: 법령 이름 + '제24조의2' → 현행 조문 원문"""
import json, os, re, urllib.request, urllib.parse
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OC = (os.environ.get('LAW_OC') or open(os.path.join(ROOT, 'law_oc.txt')).read()).strip()
_mst = {}


def _get(u):
    req = urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode('utf8', 'ignore'))


def mst(name):
    name = re.sub(r'\s+', ' ', name).strip()
    if name in _mst: return _mst[name]
    j = _get(f'https://www.law.go.kr/DRF/lawSearch.do?OC={OC}&target=law&type=JSON&display=20&query=' + urllib.parse.quote(name))
    L = (j.get('LawSearch') or {}).get('law') or []
    L = L if isinstance(L, list) else [L]
    nz = lambda s: re.sub(r'\s', '', s)
    hit = [l for l in L if nz(l.get('법령명한글', '')) == nz(name)] or [l for l in L if nz(name) in nz(l.get('법령명한글', ''))]
    _mst[name] = (hit[0]['법령일련번호'], hit[0]['법령명한글']) if hit else (None, name)
    return _mst[name]


def jo_code(jo):
    m = re.search(r'(\d+)\s*조(?:\s*의\s*(\d+))?', str(jo))
    return f'{int(m.group(1)):04d}{int(m.group(2) or 0):02d}' if m else None


def _flat(x):
    if isinstance(x, str): return x
    if isinstance(x, list): return '\n'.join(_flat(i) for i in x)
    if isinstance(x, dict):
        out = []
        for k in ('조문내용', '항내용', '호내용', '목내용'):
            if k in x: out.append(_flat(x[k]))
        for k in ('항', '호', '목'):
            if k in x: out.append(_flat(x[k]))
        return '\n'.join(o for o in out if o)
    return ''


def article(name, jo):
    """→ (법령 정식 이름, '제24조', 본문) 또는 None"""
    m, full = mst(name); c = jo_code(jo)
    if not m or not c: return None
    j = _get(f'https://www.law.go.kr/DRF/lawService.do?OC={OC}&target=law&type=JSON&MST={m}&JO={c}')
    u = ((j.get('법령') or {}).get('조문') or {}).get('조문단위')
    if not u: return None
    u = u if isinstance(u, list) else [u]
    txt = '\n'.join(_flat(x) for x in u).strip()
    return (full, re.sub(r'\s', '', str(jo)), re.sub(r'<[^>]+>', '', txt)[:3000]) if txt else None


def link(name, jo):
    return 'https://www.law.go.kr/법령/' + urllib.parse.quote(name) + '/' + urllib.parse.quote(re.sub(r'\s', '', jo))
