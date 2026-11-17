"""OX 지문 중 X(틀린) 지문의 '틀린 부분'과 '바르게 고친 말' 만들기 → gen/ox_mark.json {"트랙_번호": {"bad":..., "fix":...}}
무료 Gemini Lite 사용, 이미 된 건 건너뜀. bad 는 지문 안에 글자 그대로 있어야 저장."""
import json, os, re, time, urllib.request, urllib.error
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'gen', 'ox_mark.json')
KEY = os.environ['GEMINI_API_KEY']
MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite', 'gemini-2.5-flash']
DEADLINE = time.time() + 25 * 60

def call(model, text):
    body = json.dumps({'contents': [{'parts': [{'text': text}]}], 'generationConfig': {'responseMimeType': 'application/json', 'temperature': 0}}).encode()
    req = urllib.request.Request(f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={KEY}', body, {'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=120) as r:
        j = json.load(r)
    return ''.join(p.get('text', '') for p in j['candidates'][0]['content']['parts'])

def main():
    ox = json.load(open(os.path.join(ROOT, 'data', 'ox.json'), encoding='utf8'))
    exp = json.load(open(os.path.join(ROOT, 'gen', 'exp.json'), encoding='utf8'))
    done = json.load(open(OUT, encoding='utf8')) if os.path.exists(OUT) else {}
    todo = [(f'{ti}_{i}', it) for ti, tr in enumerate(ox) for i, it in enumerate(tr['items']) if not it['o'] and f'{ti}_{i}' not in done]
    print('남은 X 지문', len(todo), flush=True)
    models = list(MODELS)
    for k in range(0, len(todo), 20):
        if time.time() > DEADLINE or not models: break
        batch = todo[k:k + 20]
        prompt = ('아래는 공인중개사 시험의 틀린(X) 지문과 해설이에요. 지문마다 틀린 부분을 지문 원문에서 글자 그대로 짧게(2~15자) 뽑고, '
                  '그 부분을 바르게 고친 말을 적어요. JSON 객체 하나만: {"키": {"bad": "지문 속 틀린 부분 그대로", "fix": "바른 말"}}\n\n' +
                  '\n'.join(f'[{key}] 지문: {it["s"]}\n해설: {exp.get(key, "")}' for key, it in batch))
        while models:
            try:
                res = json.loads(re.search(r'\{.*\}', call(models[0], prompt), re.S).group(0)); break
            except urllib.error.HTTPError as e:
                if e.code in (429, 404): print('한도 →', models.pop(0), flush=True)
                else: time.sleep(10)
            except Exception as e:
                print('오류', str(e)[:80], flush=True); time.sleep(5); res = {}; break
        else:
            break
        for key, it in batch:
            m = res.get(key) or {}
            bad, fix = str(m.get('bad', '')).strip(), str(m.get('fix', '')).strip()
            if bad and bad in it['s']:
                done[key] = {'bad': bad, 'fix': fix}
        json.dump(done, open(OUT, 'w', encoding='utf8'), ensure_ascii=False, indent=0)
        print('완료', len(done), flush=True)

if __name__ == '__main__':
    main()
