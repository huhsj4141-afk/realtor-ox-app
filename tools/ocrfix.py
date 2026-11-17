"""OCR이 깨진 객관식 문항을 시험지 이미지에서 Gemini로 다시 옮겨 적기.
사용: python3 tools/ocrfix.py <이미지 폴더>   (폴더에 targets.json, {파일ID}_{쪽}.jpg)
결과: gen/ocrfix.json  {문항id: 새 본문}  — 이미 된 문항은 건너뜀(여러 번 나눠 실행 가능)
"""
import base64, json, os, re, sys, time, urllib.request, urllib.error
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'gen', 'ocrfix.json')
KEY = os.environ['GEMINI_API_KEY']
MODELS = ['gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite']
DEADLINE = time.time() + 130 * 60
C = '①②③④⑤'

PROMPT = """이 이미지는 공인중개사 시험 문제지 쪽이에요(첫 이미지가 해당 쪽, 둘째 이미지는 다음 쪽).
첫 이미지에서 시작하는 다음 번호의 문제를 원문 그대로 정확히 옮겨 적어 주세요: {nos}
문제가 다음 쪽으로 이어지면 둘째 이미지에서 이어서 적어요.

규칙
- 문제 문장, 보기 상자(○ 항목, ㄱ. ㄴ. 항목, 표, 조건)까지 빠짐없이.
- 선택지는 반드시 각각 새 줄에 ①②③④⑤ 기호로 시작.
- 문장 중간 줄바꿈은 붙여서 자연스럽게. 문제 번호("12.")는 빼요.
- 한자·영어·숫자·수식은 보이는 그대로(예: Qs = 30 + 2P). 표는 한 줄에 칸을 " | "로 구분.
- 갑·을·병 같은 사람 이름도 그대로. 추측해서 바꾸지 마세요.
JSON 객체 하나만 출력: {{"번호": "본문", ...}}"""


def call(model, parts):
    body = json.dumps({'contents': [{'parts': parts}],
                       'generationConfig': {'responseMimeType': 'application/json', 'temperature': 0}}).encode()
    url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={KEY}'
    req = urllib.request.Request(url, body, {'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=150) as r:
        j = json.load(r)
    return ''.join(p.get('text', '') for p in j['candidates'][0]['content']['parts'])


def ok(x):
    pos = [x.find(c) for c in C]
    return len(x) > 30 and all(p > 0 for p in pos) and pos == sorted(pos) and all(x.count(c) == 1 for c in C)


def main(folder):
    tg = json.load(open(os.path.join(folder, 'targets.json')))
    done = json.load(open(OUT, encoding='utf8')) if os.path.exists(OUT) else {}
    groups = defaultdict(list)
    for t in tg:
        if t['id'] not in done:
            groups[(t['f'], t['p'])].append(t)
    models = list(MODELS)
    print('남은 문항', sum(len(v) for v in groups.values()), '쪽', len(groups), flush=True)
    for (f, p), ts in sorted(groups.items()):
        if time.time() > DEADLINE or not models:
            break
        parts = [{'text': PROMPT.format(nos=', '.join(str(t['no']) for t in ts))}]
        for q in (p, p + 1):
            img = os.path.join(folder, f'{f}_{q}.jpg')
            if os.path.exists(img):
                parts.append({'inline_data': {'mime_type': 'image/jpeg', 'data': base64.b64encode(open(img, 'rb').read()).decode()}})
        for attempt in range(6):
            try:
                txt = call(models[0], parts)
                res = json.loads(re.search(r'\{.*\}', txt, re.S).group(0))
                break
            except urllib.error.HTTPError as e:
                if e.code == 429:
                    print('한도 →', models.pop(0), flush=True)
                    if not models: break
                elif e.code == 404:
                    models.pop(0)
                    if not models: break
                else:
                    time.sleep(10)
            except Exception as e:
                print('  오류', str(e)[:100], flush=True); time.sleep(5)
                if 'timed out' in str(e) and attempt >= 1 and len(models) > 1:
                    models.append(models.pop(0))      # 느린 모델은 뒤로
        else:
            continue
        if not models:
            break
        for t in ts:
            x = str(res.get(str(t['no']), '')).strip()
            x = re.sub(r'^\s*\d+\s*[.)]\s*', '', x)
            if ok(x):
                done[t['id']] = x
            else:
                done.setdefault('_fail', [])
                if t['id'] not in done['_fail']: done['_fail'].append(t['id'])
        json.dump(done, open(OUT, 'w', encoding='utf8'), ensure_ascii=False, indent=0)
        print(f'{f[:6]} p{p}: {len(ts)}문항 → 완료 {len(done) - 1 if "_fail" in done else len(done)}', flush=True)


if __name__ == '__main__':
    main(sys.argv[1])
