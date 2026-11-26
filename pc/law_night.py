# -*- coding: utf-8 -*-
"""PC 밤 작업: 법 개정 확인 (하루 한 번, 오후 5시 한도가 풀린 뒤)
GitHub에서 최신 문제·해설과 검사 프로그램을 받아, 이 PC에서 국가법령정보센터 원문과 대조해요.
결과는 night/gen/law_audit.json 에 쌓이고, worker.py 가 답함.json 으로 앱에 보내요."""
import os, sys, json, time, runpy, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
N = os.path.join(HERE, 'night')
RAW = 'https://raw.githubusercontent.com/huhsj4141-afk/realtor-ox-app/main/'
FILES = ['law_oc.txt', 'tools/law_audit.py', 'tools/lawsrc.py', 'data/mc.json', 'gen/mc_exp.json']


def log(*a):
    with open(os.path.join(HERE, 'night.log'), 'a', encoding='utf-8') as f:
        f.write(time.strftime('%m-%d %H:%M:%S ') + ' '.join(str(x) for x in a) + '\n')


def get(path):
    with urllib.request.urlopen(RAW + urllib.request.quote(path), timeout=120) as r:
        return r.read()


def main():
    for p in FILES:
        dst = os.path.join(N, p); os.makedirs(os.path.dirname(dst), exist_ok=True)
        try: open(dst, 'wb').write(get(p))
        except Exception as e:
            log('받기 실패', p, e)
            if not os.path.exists(dst): return
    out = os.path.join(N, 'gen', 'law_audit.json')
    try:   # GitHub에서 예전에 확인한 것과 합치기(이 PC 결과가 우선)
        old = json.loads(get('gen/law_audit.json').decode('utf8'))
        mine = json.load(open(out, encoding='utf8')) if os.path.exists(out) else {}
        for k, v in old.items():
            if k not in mine or (v.get('d', '') > mine[k].get('d', '')): mine[k] = v
        json.dump(mine, open(out, 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))
    except Exception as e: log('기존 결과 합치기 실패', e)
    key = open(os.path.join(HERE, 'key.txt'), encoding='utf-8-sig').read().strip()
    os.environ.update(GEMINI_API_KEY=key, LAW_MAX=os.environ.get('LAW_MAX', '150'), MINUTES=os.environ.get('MINUTES', '180'))
    sys.stdout = open(os.path.join(HERE, 'night.log'), 'a', encoding='utf-8'); sys.stderr = sys.stdout
    log('법 개정 확인 시작')
    try: runpy.run_path(os.path.join(N, 'tools', 'law_audit.py'), run_name='__main__')
    except SystemExit: pass
    except Exception as e: log('오류', e)
    log('끝')


if __name__ == '__main__':
    main()
