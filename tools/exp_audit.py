"""해설 검수: AI(일반 Flash 우선)가 해설을 공식 정답·법령과 대조해 틀린 곳을 찾음.
- 결과는 gen/exp_audit.json 에만 저장하고 앱에는 바로 보여 주지 않음.
- 심각(정답 근거·수치·O/X 판정이 틀림)으로 2번 연속(서로 다른 날/모델) 지적되면 gen/exp_redo.json 에 올려
  다음 해설 만들기 때 그 지적을 붙여 다시 만들게 함. 다시 만든 해설은 다시 검수.
- 매번 이어서(검수 안 한 것 → 다시 만든 것 → 오래된 것 순), MINUTES 안에서만."""
import json, os, re, sys, time, hashlib, urllib.error
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from oxvar import call, ROOT
import jline
A = os.path.join(ROOT, 'gen', 'exp_audit.json'); R = os.path.join(ROOT, 'gen', 'exp_redo.json')
DEADLINE = time.time() + int(os.environ.get('MINUTES', '20')) * 60
def models():
    """쓸 수 있는 모델을 직접 물어봄: 일반 Flash(정확) 먼저, 그다음 Flash-Lite"""
    import urllib.request
    from oxvar import KEY
    try:
        with urllib.request.urlopen(f'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key={KEY}', timeout=30) as r:
            names = [m['name'].split('/', 1)[1] for m in json.load(r).get('models', []) if 'generateContent' in m.get('supportedGenerationMethods', [])]
    except Exception:
        names = []
    ver = lambda n: [float(x) for x in re.findall(r'\d+(?:\.\d+)?', n)[:1]] or [0]
    fx = sorted([n for n in names if re.fullmatch(r'gemini-\d+(\.\d+)?-flash', n)], key=ver, reverse=True)
    fl = sorted([n for n in names if re.fullmatch(r'gemini-\d+(\.\d+)?-flash-lite', n)], key=ver, reverse=True)
    return (fx[:2] + fl[:2]) or ['gemini-3.5-flash', 'gemini-3.5-flash-lite']


MODELS = models()
PROMPT = '''너는 공인중개사 시험 출제·검수 위원이야. 아래 기출문제의 해설이 맞는지 검수해.
공식 정답은 반드시 맞다고 보고, 해설이 그 정답과 법령·판례에 맞는지만 봐.
확인할 것: (1) 정답 이유가 맞나 (2) 보기별 O/X 판정과 이유가 맞나 (3) 법 조문 숫자(기간·금액·면적·비율)가 맞나 (4) 출제 뒤 법이 바뀐 걸 '지금 기준'으로만 써서 틀리게 만들지 않았나.
문제마다 JSON 한 줄. 사소한 표현·문체는 지적하지 마. 확실하지 않으면 ok:true.
출력: JSON 배열만 [{"id":"…","ok":true|false,"sev":"high|low","issues":["보기 ③: … 이 틀림, 맞는 내용: …"]}]
'''


def item(q, e):
    ch = '\n'.join(f"  {c.get('no')} {c.get('ox')} {str(c.get('why') or c.get('reason') or '')[:220]}" for c in (e.get('choices') or []))
    return f"[{q['id']}] 정답 {q['a']}\n문제: {q['x'][:1500]}\n해설 정답: {str(e.get('answer', ''))[:300]}\n보기 해설:\n{ch}"


def main():
    mc = {q['id']: q for q in json.load(open(os.path.join(ROOT, 'data', 'mc.json'), encoding='utf8'))}
    ex = json.load(open(os.path.join(ROOT, 'gen', 'mc_exp.json'), encoding='utf8'))
    au = json.load(open(A, encoding='utf8')) if os.path.exists(A) else {}
    redo = json.load(open(R, encoding='utf8')) if os.path.exists(R) else {}
    ids = [k for k, q in mc.items() if not q.get('ocr') and re.fullmatch(r'[1-5](,[1-5])*', str(q['a'])) and k in ex]
    sig = lambda k: hashlib.md5(json.dumps(ex[k], ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:10]   # 해설이 바뀌면 다시 검수
    today = time.strftime('%Y-%m-%d')
    again = [k for k in ids if k in au and au[k].get('h') == sig(k) and not au[k].get('ok') and au[k].get('hits', 0) < 2 and au[k].get('d') != today]   # 지적된 것은 다른 날 한 번 더 확인
    todo = again + [k for k in ids if k not in au] + [k for k in ids if k in au and au[k].get('h') != sig(k)]
    print('검수할 것', len(todo), '/ 전체', len(ids))
    mi, done, flagged = 0, 0, 0
    for i in range(0, len(todo), 4):
        if time.time() > DEADLINE or mi >= len(MODELS): break
        part = todo[i:i + 4]
        prompt = PROMPT + '\n\n'.join(item(mc[k], ex[k]) for k in part)
        res = None
        while mi < len(MODELS):
            try:
                t = call(MODELS[mi], prompt); res = json.loads(re.sub(r'^```(json)?|```$', '', t.strip())); break
            except urllib.error.HTTPError as e:
                if e.code in (429, 404, 400): mi += 1; print('모델 바꿈', e.code, MODELS[mi - 1]); continue
                print('오류', e.code); break
            except Exception as e:
                print('오류', str(e)[:120]); break
        if res is None: continue
        for r in res if isinstance(res, list) else []:
            k = str(r.get('id', '')).strip('[]')
            if k not in part: continue
            prev = au.get(k, {})
            bad = (not r.get('ok', True)) and r.get('sev') == 'high' and r.get('issues')
            hits = (prev.get('hits', 0) + 1) if bad and prev.get('h') == sig(k) else (1 if bad else 0)
            au[k] = {'ok': not bad, 'sev': r.get('sev', ''), 'issues': r.get('issues', [])[:4], 'm': MODELS[mi], 'd': time.strftime('%Y-%m-%d'), 'h': sig(k), 'hits': hits}
            if bad and hits >= 2:   # 두 번 연속 심각 지적 → 다시 만들기 목록
                redo[k] = au[k]['issues']; flagged += 1
            done += 1
        jline.dump(au, A); json.dump(redo, open(R, 'w', encoding='utf8'), ensure_ascii=False, indent=0)
    bad_now = sum(1 for v in au.values() if not v['ok'])
    print(f'검수 {done}개 · 지적 남은 것 {bad_now} · 다시 만들기 목록 {len(redo)} (이번 {flagged})')


if __name__ == '__main__':
    main()
