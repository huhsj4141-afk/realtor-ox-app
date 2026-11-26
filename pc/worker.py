# -*- coding: utf-8 -*-
"""공인중개사 앱 PC 일꾼
구글 드라이브 '공인중개사/앱' 폴더의 질문함.json을 1분마다 보고,
새 질문을 Gemini(무료 한도) + 국가법령정보센터로 처리해 답함.json에 써요.
- 질문함.json : 앱이 씀  {"jobs":[{"id","kind":"ask"|"law","prompt","refs":[{"law","jo"}],"at"}]}
- 답함.json   : PC가 씀  {"<id>":{"text","model","at","src"}, "_pc":{상태}}
AI 키는 이 폴더의 key.txt 에 직접 넣어 주세요(채팅으로 보내지 마세요).
"""
import json, os, re, sys, time, glob, subprocess, urllib.request, urllib.parse, urllib.error, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
OC = 'huhsj4141'                       # 국가법령정보센터 아이디(비밀 아님)
QUICK = ['gemini-3.5-flash-lite', 'gemini-2.5-flash-lite', 'gemini-3.5-flash', 'gemini-2.5-flash']
DEFAULT = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash-lite']
POLL = 60                               # 초
DAY_MAX = 300                           # PC가 하루에 쓰는 AI 요청 상한(앱 몫 남기기)


def log(*a):
    s = time.strftime('%m-%d %H:%M:%S ') + ' '.join(str(x) for x in a)
    print(s, flush=True)
    try:
        with open(os.path.join(HERE, 'worker.log'), 'a', encoding='utf-8') as f: f.write(s + '\n')
    except Exception: pass


def read_txt(name):
    p = os.path.join(HERE, name)
    return open(p, encoding='utf-8-sig').read().strip() if os.path.exists(p) else ''


def find_folder():
    p = read_txt('folder.txt')
    if p and os.path.isdir(p): return p
    cands = []
    for d in 'GHIJKLMNOPQRSTUVWXYZDEF':
        cands += [f'{d}:\\내 드라이브\\공인중개사\\앱', f'{d}:\\My Drive\\공인중개사\\앱']
    home = os.path.expanduser('~')
    cands += glob.glob(os.path.join(home, 'Google Drive*', '*', '공인중개사', '앱')) + glob.glob(os.path.join(home, 'Google Drive*', '공인중개사', '앱'))
    for c in cands:
        if os.path.isdir(c): return c
    for c in cands:   # 드라이브는 있는데 폴더가 없으면 만들어요
        base = os.path.dirname(os.path.dirname(c))
        if os.path.isdir(base) and base.rstrip('\\/')[-2:] != ':':
            os.makedirs(c, exist_ok=True); return c
    return None


def load(path, empty):
    try:
        with open(path, encoding='utf-8-sig') as f: return json.load(f)
    except Exception: return empty


def save(path, obj):
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f: json.dump(obj, f, ensure_ascii=False, indent=1)
    os.replace(tmp, path)


# ---------- 국가법령정보센터 (AI 아님, 한도 걱정 없음) ----------
_mst = {}
def _get(u):
    req = urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode('utf8', 'ignore'))


def _flat(x):
    if isinstance(x, str): return x
    if isinstance(x, list): return '\n'.join(_flat(i) for i in x)
    if isinstance(x, dict):
        out = [_flat(x[k]) for k in ('조문내용', '항내용', '호내용', '목내용') if k in x]
        out += [_flat(x[k]) for k in ('항', '호', '목') if k in x]
        return '\n'.join(o for o in out if o)
    return ''


def article(name, jo):
    nz = lambda s: re.sub(r'\s', '', s or '')
    if name not in _mst:
        j = _get(f'https://www.law.go.kr/DRF/lawSearch.do?OC={OC}&target=law&type=JSON&display=20&query=' + urllib.parse.quote(name))
        L = (j.get('LawSearch') or {}).get('law') or []
        L = L if isinstance(L, list) else [L]
        hit = [l for l in L if nz(l.get('법령명한글')) == nz(name)] or [l for l in L if nz(name) in nz(l.get('법령명한글'))]
        _mst[name] = (hit[0]['법령일련번호'], hit[0]['법령명한글']) if hit else (None, name)
    m, full = _mst[name]
    k = re.search(r'(\d+)\s*조(?:\s*의\s*(\d+))?', str(jo))
    if not m or not k: return None
    c = f'{int(k.group(1)):04d}{int(k.group(2) or 0):02d}'
    j = _get(f'https://www.law.go.kr/DRF/lawService.do?OC={OC}&target=law&type=JSON&MST={m}&JO={c}')
    u = ((j.get('법령') or {}).get('조문') or {}).get('조문단위')
    if not u: return None
    u = u if isinstance(u, list) else [u]
    txt = re.sub(r'<[^>]+>', '', '\n'.join(_flat(x) for x in u)).strip()[:3000]
    return {'law': full, 'jo': nz(jo), 'text': txt,
            'uri': 'https://www.law.go.kr/법령/' + urllib.parse.quote(full) + '/' + urllib.parse.quote(nz(jo))} if txt else None


# ---------- Gemini (무료 한도 아껴 쓰기) ----------
class Quota(Exception): pass

state = {'day': '', 'used': 0, 'skip': []}


def day_key():   # 무료 한도는 오후 5시(한국)쯤 새로 채워져요
    return (datetime.datetime.now() - datetime.timedelta(hours=17)).strftime('%Y-%m-%d')


def gemini(prompt, chain):
    if state['day'] != day_key(): state.update(day=day_key(), used=0, skip=[])
    if state['used'] >= DAY_MAX: raise Quota('PC 하루 몫 다 씀')
    key = read_txt('key.txt') or os.environ.get('GEMINI_API_KEY', '')
    if not key: raise Quota('key.txt 없음')
    body = json.dumps({'contents': [{'parts': [{'text': prompt}]}]}).encode()
    last = ''
    for rnd in range(2):
        busy = False
        for m in chain:
            if m in state['skip']: continue
            req = urllib.request.Request(f'https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent',
                                         data=body, headers={'Content-Type': 'application/json', 'x-goog-api-key': key})
            try:
                state['used'] += 1
                with urllib.request.urlopen(req, timeout=120) as r:
                    j = json.loads(r.read().decode('utf8'))
                t = ''.join(p.get('text', '') for p in (j.get('candidates') or [{}])[0].get('content', {}).get('parts', []))
                if t.strip(): return t.strip(), m
            except urllib.error.HTTPError as e:
                msg = e.read().decode('utf8', 'ignore')[:600]; last = f'{m} {e.code}'
                if e.code == 404: state['skip'].append(m)
                elif e.code == 429 and 'PerDay' in msg: state['skip'].append(m); log('오늘 한도 끝:', m)
                elif e.code >= 500 or e.code == 429: busy = True
            except Exception as e:
                last = f'{m} {e}'; busy = True
        if not busy: break
        time.sleep(4)
    if all(m in state['skip'] for m in chain): raise Quota('모든 모델 오늘 한도 끝')
    raise RuntimeError(last or '응답 없음')


def do_job(job):
    kind = job.get('kind', 'ask'); prompt = job.get('prompt', '')
    if kind == 'law':
        src = []
        refs = job.get('refs') or []
        if not refs and job.get('pick'):
            t, _ = gemini(job['pick'], QUICK)
            m = re.search(r'\{.*\}', t, re.S)
            try: refs = json.loads(m.group(0)).get('refs', []) if m else []
            except Exception: refs = []
        for r in refs[:4]:
            try:
                a = article(r.get('law', ''), r.get('jo', ''))
                if a: src.append(a)
            except Exception as e: log('법령 실패', r, e)
        if not src: return {'text': '현행 조문을 찾지 못했어요.', 'src': [], 'model': ''}
        ctx = '\n\n'.join(f"[{a['law']} {a['jo']} 현행 원문]\n{a['text']}" for a in src)
        text, m = gemini(prompt + '\n\n' + ctx, DEFAULT)
        return {'text': text, 'src': [{k: a[k] for k in ('law', 'jo', 'uri')} for a in src], 'model': m}
    text, m = gemini(prompt, QUICK if job.get('quick') else DEFAULT)
    return {'text': text, 'model': m}


# ---------- 밤 작업(법 개정 확인)을 하루 한 번 따로 돌리기 ----------
night = {'p': None}
def night_tick():
    st = os.path.join(HERE, 'night_day.txt')
    if night['p'] and night['p'].poll() is None: return          # 아직 도는 중
    now_f = os.path.join(HERE, 'night_now.txt')                   # 이 파일이 있으면 바로 한 번 돌리기
    if os.path.exists(now_f): os.remove(now_f)
    else:
        if read_txt('night_day.txt') == day_key(): return        # 오늘 몫은 했음
        if datetime.datetime.now().hour < 17 or datetime.datetime.now().minute < 10 and datetime.datetime.now().hour == 17: return
    open(st, 'w').write(day_key())
    exe = sys.executable.replace('python.exe', 'pythonw.exe') if os.name == 'nt' else sys.executable
    night['p'] = subprocess.Popen([exe, os.path.join(HERE, 'law_night.py')], cwd=HERE)
    log('밤 작업 시작(법 개정 확인)')


def law_delta(la=''):   # 앱이 아직 못 받은 결과만(앱이 알려 준 날짜 이후, 없으면 최근 7일) — 파일을 가볍게
    p = os.path.join(HERE, 'night', 'gen', 'law_audit.json')
    try: d = json.load(open(p, encoding='utf8'))
    except Exception: return None, None
    cut = max(la or '', time.strftime('%Y-%m-%d', time.localtime(time.time() - 7 * 86400)))
    rec = sorted(((k, v) for k, v in d.items() if v.get('d', '') >= cut and v.get('m')), key=lambda kv: kv[1].get('d', ''), reverse=True)[:250]
    out = {k: {'v': v['v'], 'law': v.get('law', ''), 't': v.get('t', '')[:600], 'src': v.get('src', [])[:4], 'd': v.get('d', ''), 'basis': v.get('basis', '')} for k, v in rec}
    stat = {'all': len(d), 'changed': sum(1 for v in d.values() if v.get('v') == 'changed')}
    return out, stat


def main():
    folder = find_folder()
    while not folder:
        log('드라이브의 공인중개사\\앱 폴더를 못 찾았어요. folder.txt에 경로를 적어 주세요. 1분 뒤 다시 찾아요.')
        time.sleep(POLL); folder = find_folder()
    qp, ap = os.path.join(folder, '질문함.json'), os.path.join(folder, '답함.json')
    if not os.path.exists(qp): save(qp, {'jobs': []})
    if not os.path.exists(ap): save(ap, {})
    log('시작:', folder)
    me = os.path.getmtime(os.path.abspath(__file__))
    wait_until = 0; fails = {}; last = {'body': '', 't': 0}
    while True:
        try:
            qd = load(qp, {}); jobs = qd.get('jobs', [])
            if qd.get('bk') and qd['bk'].get('n'):   # 💾 앱 진도 백업을 날짜별로 남기기(최근 14개)
                bdir = os.path.join(folder, '백업'); os.makedirs(bdir, exist_ok=True)
                bp = os.path.join(bdir, '진도_' + time.strftime('%Y-%m-%d') + '.json')
                if not os.path.exists(bp) or os.path.getsize(bp) != len(json.dumps(qd['bk'], ensure_ascii=False).encode()):
                    with open(bp, 'w', encoding='utf-8') as f: f.write(json.dumps(qd['bk'], ensure_ascii=False))
                    for old in sorted(glob.glob(os.path.join(bdir, '진도_*.json')))[:-14]: os.remove(old)
            ans = load(ap, {})
            todo = [j for j in jobs if j.get('id') and j['id'] not in ans]
            ans['_pc'] = {'seen': int(time.time() * 1000), 'queue': len(todo), 'used': state['used'], 'skip': state['skip']}
            try: night_tick()
            except Exception as e: log('밤 작업 실행 실패', e)
            ld, ls = law_delta(qd.get('la', ''))
            if ld is not None: ans['_law'] = ld; ans['_pc']['law'] = ls
            ans['_pc']['night'] = bool(night['p'] and night['p'].poll() is None)
            if todo and time.time() >= wait_until:
                job = todo[0]
                try:
                    r = do_job(job); r['at'] = int(time.time() * 1000)
                    ans[job['id']] = r; log('완료', job['id'], r.get('model'))
                except Quota as e:
                    log('대기:', e, '- 오후 5시 이후 이어서 해요')
                    wait_until = time.time() + 30 * 60
                except Exception as e:
                    log('실패', job['id'], e)
                    fails[job['id']] = fails.get(job['id'], 0) + 1
                    if fails[job['id']] >= 3: ans[job['id']] = {'err': str(e)[:200], 'at': int(time.time() * 1000)}
                ans['_pc']['queue'] = len([j for j in jobs if j.get('id') and j['id'] not in ans])
            # 오래된 답 정리(30일)
            cut = (time.time() - 30 * 86400) * 1000
            for k in [k for k, v in ans.items() if k != '_pc' and isinstance(v, dict) and v.get('at', cut) < cut]: ans.pop(k)
            # 바뀐 게 있을 때만 저장(아니면 10분에 한 번 '살아 있음'만) → 드라이브 업로드·폰 데이터 절약
            body = json.dumps({k: v for k, v in ans.items() if k != '_pc'}, ensure_ascii=False, sort_keys=True) + json.dumps({k: v for k, v in ans['_pc'].items() if k != 'seen'}, sort_keys=True)
            if body != last['body'] or time.time() - last['t'] > 600:
                save(ap, ans); last['body'] = body; last['t'] = time.time()
            if todo and time.time() >= wait_until: time.sleep(5); continue   # 밀린 일 있으면 바로 다음
        except Exception as e:
            log('오류', e)
        if os.path.getmtime(os.path.abspath(__file__)) != me:   # 새 버전으로 바뀌면 스스로 다시 시작
            log('새 버전으로 다시 시작'); os.execv(sys.executable, [sys.executable, os.path.abspath(__file__)])
        time.sleep(POLL)


if __name__ == '__main__':
    main()
