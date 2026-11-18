"""OX 변형 만들기 → gen/ox_var.json {"문항id_보기번호": {"s": 새 문장, "o": 1|0, "bad": 바뀐 말, "fix": 원래 말, "w": 짧은 이유}}
기출 보기를 하나 골라 맞는 말은 '살짝 틀리게', 틀린 말은 '바르게 고친' 새 OX 문장으로 뒤집어요.
무료 Gemini Lite, 하루 정해진 시간만, 이미 만든 건 건너뜀. 과목·단원이 고르게 섞이도록 돌아가며 골라요.
해설(gen/mc_exp.json)의 O/X가 정답과 맞아떨어지는 문제만 써요(틀린 재료로 만들지 않게)."""
import json, os, re, time, random, urllib.request, urllib.error
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'gen', 'ox_var.json')
KEY = os.environ['GEMINI_API_KEY']
MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite']
DEADLINE = time.time() + int(os.environ.get('MINUTES', '20')) * 60
MAX = int(os.environ.get('OXV_MAX', '500'))


def call(model, text):
    body = json.dumps({'contents': [{'parts': [{'text': text}]}], 'generationConfig': {'responseMimeType': 'application/json', 'temperature': 0.4}}).encode()
    req = urllib.request.Request(f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={KEY}', body, {'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=120) as r:
        j = json.load(r)
    return ''.join(p.get('text', '') for p in j['candidates'][0]['content']['parts'])


def candidates():
    mc = json.load(open(os.path.join(ROOT, 'data', 'mc.json'), encoding='utf8'))
    ex = json.load(open(os.path.join(ROOT, 'gen', 'mc_exp.json'), encoding='utf8'))
    out = []
    for q in mc:
        k = q.get('k') or ''
        if q.get('ocr') or '계산' in k or '박스형' in k or '빈칸' in k: continue
        x = q['x']; idx = [x.find(m) for m in '①②③④⑤']
        if min(idx) < 0 or idx != sorted(idx): continue
        stem = re.sub(r'\s+', ' ', x[:idx[0]]).strip()
        neg = bool(re.search(r'틀린 것|옳지 않은 것|아닌 것|해당하지 않는|잘못된 것', stem)); pos = bool(re.search(r'옳은 것|맞는 것|해당하는 것', stem))
        if not (neg or pos) or not re.fullmatch(r'[1-5]', str(q.get('a', ''))): continue
        e = ex.get(q['id']); ch = {int(c.get('no', 0)): c for c in (e or {}).get('choices', []) if isinstance(c, dict)}
        if len(ch) != 5: continue
        ans = int(q['a'])
        oxs = {n: 1 if 'O' in str(c.get('ox', '')).upper() else 0 for n, c in ch.items()}
        if oxs != {n: (0 if n == ans else 1) if neg else (1 if n == ans else 0) for n in range(1, 6)}: continue
        for n in range(1, 6):
            s = re.sub(r'\s+', ' ', x[idx[n - 1] + 1: idx[n] if n < 5 else None]).strip()
            if 12 <= len(s) <= 220 and re.search(r'(다|음|함|됨|임)[.)]?$', s):
                out.append((f"{q['id']}_{n}", q, stem, s, oxs[n], ch[n].get('why', '')))
    return out


def main():
    done = json.load(open(OUT, encoding='utf8')) if os.path.exists(OUT) else {}
    cand = [c for c in candidates() if c[0] not in done]
    # 과목·단원을 돌아가며 고르게
    random.seed(int(time.time() // 86400))
    by = {}
    for c in cand: by.setdefault((c[1]['s'], c[1].get('t', '')), []).append(c)
    for v in by.values(): random.shuffle(v)
    keys = list(by); random.shuffle(keys); todo = []
    while len(todo) < MAX and any(by.values()):
        for k in keys:
            if by[k]: todo.append(by[k].pop())
    print('후보', len(cand), '오늘 목표', len(todo), '이미', len(done), flush=True)
    models = list(MODELS); made = 0
    for b in range(0, len(todo), 12):
        if time.time() > DEADLINE or not models: break
        batch = todo[b:b + 12]
        prompt = ('공인중개사 시험 공부용 OX 문제를 만들어요. 아래 기출 보기 문장마다 정답(O/X)을 뒤집은 새 문장을 하나씩 만들어요.\n'
                  '- 원래 O(맞는 말)이면: 핵심 낱말 하나만 바꿔 그럴듯하게 틀린 문장으로 (예: 할 수 있다→할 수 없다, 30일→60일, 시장·군수→시·도지사).\n'
                  '- 원래 X(틀린 말)이면: 해설을 근거로 틀린 부분만 고쳐 맞는 문장으로.\n'
                  '- 나머지 표현은 원래 문장 그대로. 법령·판례에 맞게. 확실하지 않으면 그 항목은 빼요.\n'
                  '- bad: 새 문장에서 바뀐 말(새 문장 안에 글자 그대로), fix: 원래 문장의 말, w: 왜 O/X인지 한 문장.\n'
                  'JSON 객체 하나만: {"키": {"s": "새 문장", "bad": "...", "fix": "...", "w": "..."}}\n\n' +
                  '\n'.join(f'[{key}] 문제: {stem}\n보기: {s}\n원래: {"O" if o else "X"} / 해설: {why}' for key, q, stem, s, o, why in batch))
        res = None
        while models:
            try:
                res = json.loads(re.search(r'\{.*\}', call(models[0], prompt), re.S).group(0)); break
            except urllib.error.HTTPError as e:
                if e.code in (429, 404): print('한도 →', models.pop(0), flush=True)
                else: time.sleep(10)
            except Exception as e:
                print('오류', str(e)[:80], flush=True); res = {}; break
        if res is None: break
        for key, q, stem, s, o, why in batch:
            m = res.get(key) or {}
            ns = str(m.get('s', '')).strip()
            if not ns or ns == s or len(ns) > 260: continue
            bad = str(m.get('bad', '')).strip()
            done[key] = {'s': ns, 'o': 0 if o else 1, 'bad': bad if bad and bad in ns else '', 'fix': str(m.get('fix', '')).strip(), 'w': str(m.get('w', '')).strip()[:200]}
            made += 1
        json.dump(done, open(OUT, 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))
        print('만듦', made, '전체', len(done), flush=True)


if __name__ == '__main__':
    main()
