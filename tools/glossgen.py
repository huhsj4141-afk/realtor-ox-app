"""용어 풍선말 늘리기 → web/glossary.json {용어: 쉬운 뜻}
앱의 문제·지문·해설에서 자주 나오는 낱말을 뽑아, Gemini가 '공인중개사 수험서 용어'만 골라 쉬운 말로 풀이.
이미 있는 용어는 그대로 두고 새 것만 더함. 한 번 본 후보는 gen/gloss_seen.json 에 적어 다시 묻지 않음."""
import json, os, re, sys, time, collections, urllib.error
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from oxvar import call, MODELS, ROOT
OUT = os.path.join(ROOT, 'web', 'glossary.json'); SEEN = os.path.join(ROOT, 'gen', 'gloss_seen.json')
DEADLINE = time.time() + int(os.environ.get('MINUTES', '12')) * 60
PART = r'(으로써|으로서|에서는|에게서|이라는|이라도|으로는|으로|에서|에게|까지|부터|이며|이고|이나|이다|라는|과의|와의|에는|에도|에의|의|은|는|이|가|을|를|에|과|와|도|로|만|상|등)$'
VERB = r'(한다|하는|하여|되는|된다|있는|없는|하지|않는|하고|해야|하며|이다|였다|있다|없다|하면|되어|하기|되지|하였|했다|었다|같은|대한|관한|위한|따른|의한|않은|않다|할|한|된|해요|돼요|어요|아요)$'

PROMPT = '''너는 공인중개사 시험 강사야. 아래 낱말은 공인중개사 기출문제·해설에 나온 말이야.
이 중 '공인중개사 수험서에 나오는 전문 용어'로, 처음 공부하는 사람이 뜻을 모를 만한 것만 골라 쉬운 뜻풀이를 달아.
- 고르지 말 것: 부동산·토지·건물·계약·가격·면적·기간처럼 누구나 아는 일상어, 동사·형용사, 숫자·단위, 잘린 말
- 뜻풀이: 중학생도 알아듣게 한두 문장, 60자 이내. 필요하면 '예: …'로 짧은 예. 해요체 말고 '~하는 것', '~인 사람'처럼 짧게.
- 법령에 정의가 있으면 그 뜻에 맞게. 틀린 내용 금지.
JSON 객체 하나만: {"용어": "뜻풀이", ...}
낱말: '''


def candidates(known, seen):
    mc = json.load(open(os.path.join(ROOT, 'data', 'mc.json'), encoding='utf8'))
    ox = json.load(open(os.path.join(ROOT, 'data', 'ox.json'), encoding='utf8'))
    ex = json.load(open(os.path.join(ROOT, 'gen', 'exp.json'), encoding='utf8'))
    T = [q['x'] for q in mc] + [it['s'] for t in ox for it in t['items']] + list(ex.values())
    c = collections.Counter()
    for t in T:
        for w in re.findall(r'[가-힣]{2,}', t):
            w = re.sub(PART, '', w)
            if len(w) >= 2 and not re.search(VERB, w): c[w] += 1
    return [w for w, n in c.most_common() if n >= 3 and w not in known and w not in seen]


def main():
    gl = json.load(open(OUT, encoding='utf8'))
    seen = set(json.load(open(SEEN, encoding='utf8'))) if os.path.exists(SEEN) else set()
    cand = candidates(gl, seen)
    print('후보', len(cand), '지금 용어', len(gl))
    mi, added = 0, 0
    for i in range(0, min(len(cand), 3000), 200):
        if time.time() > DEADLINE or mi >= len(MODELS): break
        part = cand[i:i + 200]
        while mi < len(MODELS):
            try:
                d = json.loads(call(MODELS[mi], PROMPT + ', '.join(part)))
                break
            except urllib.error.HTTPError as e:
                if e.code in (429, 404): mi += 1; print('모델 바꿈', e.code); continue
                print('오류', e.code); d = {}; break
            except Exception as e:
                print('오류', str(e)[:100]); d = {}; break
        else:
            break
        for k, v in (d or {}).items():
            k = str(k).strip(); v = str(v).strip()
            if 2 <= len(k) <= 15 and 5 <= len(v) <= 120 and k not in gl and re.fullmatch(r'[가-힣0-9·()]+', k):
                gl[k] = v; added += 1
        seen.update(part)
        json.dump(gl, open(OUT, 'w', encoding='utf8'), ensure_ascii=False, indent=0)
        json.dump(sorted(seen), open(SEEN, 'w', encoding='utf8'), ensure_ascii=False)
        print(f'{i + len(part)}개 봄 · 새 용어 {added}')
    print('용어', len(gl))


if __name__ == '__main__':
    main()
