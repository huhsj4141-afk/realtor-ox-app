"""법 개정 확인: 구글 검색을 붙인 Gemini로 기출문제·해설이 '오늘 기준' 법령과 맞는지 하루 몇십 문제씩 차례로 확인.
- 결과: gen/law_audit.json {id: {v: ok|changed|unsure, law, t, src, d, m}} → 앱에 넣어 문제 화면에 표시
- 순서: 개정이 잦은 과목(중개사법 → 공법 → 세법 → 공시법 → 민법) · 오래된 회차부터 · 180일 지나면 다시 확인
- LAW_MAX(기본 40)개 또는 MINUTES 안에서만, 하루 한도(429)면 다음 모델 → 다 막히면 그만"""
import json, os, re, sys, time, urllib.request, urllib.error
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lawsrc
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEY = os.environ['GEMINI_API_KEY']
OUT = os.path.join(ROOT, 'gen', 'law_audit.json')
DEADLINE = time.time() + int(os.environ.get('MINUTES', '10')) * 60
MAX = int(os.environ.get('LAW_MAX', '40'))
SUBS = ['부동산학개론', '민법·민사특별법', '공인중개사법·중개실무', '부동산공법', '부동산공시법', '부동산세법']
ORDER = [2, 3, 5, 4, 1]   # 학개론은 법령 문제가 거의 없어 뺌


def models():
    try:
        with urllib.request.urlopen(f'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key={KEY}', timeout=30) as r:
            names = [m['name'].split('/', 1)[1] for m in json.load(r).get('models', []) if 'generateContent' in m.get('supportedGenerationMethods', [])]
    except Exception:
        names = []
    ver = lambda n: [float(x) for x in re.findall(r'\d+(?:\.\d+)?', n)[:1]] or [0]
    fx = sorted([n for n in names if re.fullmatch(r'gemini-\d+(\.\d+)?-flash', n)], key=ver, reverse=True)
    fl = sorted([n for n in names if re.fullmatch(r'gemini-\d+(\.\d+)?-flash-lite', n)], key=ver, reverse=True)
    return (fx[:2] + fl[:2]) or ['gemini-2.5-flash', 'gemini-2.5-flash-lite']


SEARCH = {'ok': True}   # 무료 키는 구글 검색 붙이기가 막혀 있을 수 있음 → 한 번 막히면 그날은 검색 없이


def ask(model, text):
    if SEARCH['ok']:
        try:
            return _ask(model, text, True)
        except urllib.error.HTTPError as e:
            if e.code != 429: raise
            SEARCH['ok'] = False; print('  구글 검색 한도 없음 → 검색 없이 AI 지식으로 확인')
    t, _ = _ask(model, text + '\n(검색 없이 네가 아는 최신 법령 지식으로. 확실하지 않으면 [불확실])', False)
    return t, []


def ask_plain(model, text, as_json):
    body = json.dumps({'contents': [{'parts': [{'text': text}]}], 'generationConfig': {'temperature': 0.2, **({'responseMimeType': 'application/json'} if as_json else {})}}).encode()
    req = urllib.request.Request(f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={KEY}', body, {'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=120) as r:
        j = json.load(r)
    return ''.join(p.get('text', '') for p in j['candidates'][0]['content']['parts']), []


def _ask(model, text, search):
    body = json.dumps({'contents': [{'parts': [{'text': text}]}], **({'tools': [{'google_search': {}}]} if search else {}), 'generationConfig': {'temperature': 0.2}}).encode()
    req = urllib.request.Request(f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={KEY}', body, {'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=120) as r:
        j = json.load(r)
    c = j['candidates'][0]
    src = [x.get('web') for x in (c.get('groundingMetadata') or {}).get('groundingChunks', []) if x.get('web')]
    return ''.join(p.get('text', '') for p in c['content']['parts']), [{'uri': s.get('uri'), 'title': s.get('title')} for s in src][:4]


def main():
    mc = json.load(open(os.path.join(ROOT, 'data', 'mc.json'), encoding='utf8'))
    ex = json.load(open(os.path.join(ROOT, 'gen', 'mc_exp.json'), encoding='utf8')) if os.path.exists(os.path.join(ROOT, 'gen', 'mc_exp.json')) else {}
    out = json.load(open(OUT, encoding='utf8')) if os.path.exists(OUT) else {}
    today = time.strftime('%Y-%m-%d'); old = time.strftime('%Y-%m-%d', time.localtime(time.time() - 180 * 86400))
    pool = [q for q in mc if not q.get('ocr') and q.get('s') in ORDER and re.fullmatch(r'[1-5](,[1-5])*', str(q.get('a')))]
    pool.sort(key=lambda q: (q['id'] in out and out[q['id']].get('d', '') >= old, ORDER.index(q['s']), q.get('n', 0), q.get('no', 0)))
    todo = [q for q in pool if not (q['id'] in out and out[q['id']].get('d', '') >= old)][:MAX]
    print('법 개정 확인할 것', len(todo), '/ 남은 전체', sum(1 for q in pool if q['id'] not in out))
    ms, mi, n = models(), 0, 0
    busy = [0]
    for q in todo:
        if time.time() > DEADLINE or mi >= len(ms): break
        e = ex.get(q['id'])
        base = f"""[출제] 제{q.get('n')}회 {SUBS[q['s']]}
[정답] {q['a']}번
[문제]
{q['x'][:1800]}
{('[해설]' + chr(10) + json.dumps(e, ensure_ascii=False)[:2000]) if e else ''}"""
        t = None; src = []
        try:
            # 1) 관련 조문 찾기 → 2) 국가법령정보센터에서 현행 원문 → 3) 원문과 대조
            refs_t, _ = ask_plain(ms[mi], '아래 공인중개사 기출문제를 판단하는 데 필요한 한국 법령 조문을 최대 4개 골라. 시행령·시행규칙 조문이 핵심이면 그것도. JSON만: {"refs":[{"law":"공인중개사법 시행령","jo":"제24조"}]}\n' + base, True)
            rj = json.loads(re.sub(r'^```(json)?|```$', '', refs_t.strip())); refs = (rj if isinstance(rj, list) else rj.get('refs') or [])[:4]
            arts = []
            for r_ in refs:
                try:
                    a_ = lawsrc.article(r_.get('law', ''), r_.get('jo', ''))
                    if a_: arts.append(a_); src.append({'uri': lawsrc.link(a_[0], a_[1]), 'title': f'{a_[0]} {a_[1]} (현행 원문)'})
                except Exception as er: print('  조문 실패', r_, er)
            if arts:
                law_txt = '\n\n'.join(f'■ {a_[0]} {a_[1]}\n{a_[2]}' for a_ in arts)
                t, _ = ask_plain(ms[mi], f"""오늘은 {today}이야. 아래 [현행 조문 원문](국가법령정보센터에서 방금 가져온 오늘 시행 중인 법)과 기출문제·해설을 대조해 줘.
- 원문과 문제·해설의 숫자·기간·금액·요건이 다르면 [바뀜], 같으면 [같음], 원문만으로 판단이 어려우면 [불확실].
- 첫 줄에 판정 하나만, 둘째 줄: 법령: ○○법
- 그 아래 쉬운 말로 3~6문장: 원문 어느 조문 기준으로 무엇이 같은지/다른지, 지금 법 기준으로 정답이 달라지는지. 해요체.
[현행 조문 원문]
{law_txt[:7000]}
{base}""", False)
        except urllib.error.HTTPError as err:
            print(' ', ms[mi], err.code)
            if err.code in (500, 502, 503, 504):   # 잠깐 붐빔: 같은 모델로 조금 뒤 다시 (3번까지), 그래도 안 되면 다음 모델
                busy[0] += 1; time.sleep(20)
                if busy[0] % 3 == 0: mi += 1
            else: mi += 1
            continue
        except Exception as err:
            print('  조문 대조 실패', err)
        if not t or not src: continue   # 원문 대조를 못 했으면 저장하지 않고 다음에 다시
        t = t.strip(); first = t.split('\n')[0]
        v = 'changed' if '바뀜' in first else 'ok' if '같음' in first else 'unsure'
        lm = re.search(r'법령\s*[:：]\s*([^\n]+)', t)
        body = '\n'.join(l for l in t.split('\n')[1:] if not re.match(r'^\s*법령\s*[:：]', l)).strip()
        out[q['id']] = {'v': v, 'law': lm.group(1).strip()[:40] if lm else '', 't': body[:900], 'src': src, 'd': today, 'm': ms[mi], 'web': bool(src), 'basis': 'law' if src else 'ai'}
        n += 1
        print(q['id'], v)
        json.dump(out, open(OUT, 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))
        time.sleep(4)
    print('확인함', n, '· 바뀜', sum(1 for x in out.values() if x['v'] == 'changed'), '· 전체 기록', len(out))


if __name__ == '__main__':
    main()
