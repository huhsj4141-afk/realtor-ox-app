#!/usr/bin/env python3
"""Gemini로 해설 텍스트와 음성(지문·해설·안내)을 만들어 gen/ 에 저장한다.
이미 만든 파일은 건너뛰므로 여러 번 나눠 실행해도 이어서 만든다.
사용: python tools/gen.py samples | full
환경변수: GEMINI_API_KEY, (선택) VOICE, MINUTES
"""
def fixjson(t):
    """Gemini가 수식 역슬래시(\\frac 등)를 한 번만 써서 JSON이 깨지는 것 바로잡기"""
    t = re.sub(r'(?<!\\)\\(?=[A-Za-z]{2,})', r'\\\\', t)
    return re.sub(r'(?<!\\)\\(?![\\"/bfnrtu])', r'\\\\', t)

import sys as _s, os as _o; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); import jline
import base64, json, os, re, subprocess, sys, time, urllib.request, urllib.error, wave, math, struct

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEN = os.path.join(ROOT, 'gen')
KEY = os.environ.get('GEMINI_API_KEY', '').strip()
API = 'https://generativelanguage.googleapis.com/v1beta'
DEADLINE = time.time() + float(os.environ.get('MINUTES', '300')) * 60
SR = 24000


class DailyLimit(Exception):
    pass


def log(*a):
    print(*a, flush=True)


def call(path, body=None, tries=10):
    url = f'{API}/{path}{"&" if "?" in path else "?"}key={KEY}'
    for k in range(tries):
        req = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None,
                                     headers={'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=600) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            msg = e.read().decode('utf8', 'replace')
            if e.code == 429:
                if re.search(r'per ?day|PerDay|daily', msg, re.I):
                    raise DailyLimit(msg[:300])
                m = re.search(r'"retryDelay":\s*"(\d+)', msg)
                w = int(m.group(1)) + 2 if m else 30
                if w > 900:
                    raise DailyLimit(msg[:300])
                log(f'  429 → {w}s 대기')
                time.sleep(w)
                continue
            if e.code >= 500:
                log(f'  서버 오류 {e.code} → 다시 시도')
                time.sleep(10 * (k + 1))
                continue
            raise RuntimeError(f'HTTP {e.code}: {msg[:500]}')
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            log(f'  연결 문제({type(e).__name__}: {str(e)[:120]}) → 다시 시도')
            time.sleep(10 * (k + 1))
    raise RuntimeError('too many retries')


def ver(name):
    nums = re.findall(r'(\d+(?:\.\d+)?)', name)
    return float(nums[0]) if nums else 0


def pick_models():
    names = []
    tok = ''
    while True:
        r = call('models?pageSize=200' + (f'&pageToken={tok}' if tok else ''))
        for m in r.get('models', []):
            if 'generateContent' in m.get('supportedGenerationMethods', []):
                names.append(m['name'].split('/', 1)[1])
        tok = r.get('nextPageToken')
        if not tok:
            break
    tts = [n for n in names if 'tts' in n]
    tts.sort(key=lambda n: (('flash' in n) and ('lite' not in n), 'preview' not in n, ver(n)), reverse=True)
    txt = [n for n in names if 'flash' in n and not re.search(r'tts|image|live|audio|embed|vision|thinking|robotics|computer', n)]
    txt.sort(key=lambda n: ('lite' in n, 'preview' not in n and 'exp' not in n, ver(n)), reverse=True)  # 무료 한도가 넉넉한 lite 우선
    if not tts or not txt:
        raise RuntimeError(f'모델을 못 찾음: {names}')
    log('TTS 모델:', tts[0], '/ 글 모델:', txt[0])
    return tts[0], txt[0]


def clean(t):
    t = re.sub(r'\(([^()]*[一-鿿][^()]*)\)', '', t)          # 한자 괄호
    t = re.sub(r'\(\s*[A-Za-z][^()]*\)', '', t)                       # 영문 괄호
    t = t.replace('ㆍ', ', ').replace('·', ', ').replace('․', ', ')
    t = re.sub(r'[①②③④⑤]', '', t)
    t = re.sub(r'\s+', ' ', t).strip()
    return t


def tts(model, voice, text):
    body = {'contents': [{'parts': [{'text': text}]}],
            'generationConfig': {'responseModalities': ['AUDIO'],
                                 'speechConfig': {'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': voice}}}}}
    r = call(f'models/{model}:generateContent', body)
    part = r['candidates'][0]['content']['parts'][0]['inlineData']
    rate = int((re.search(r'rate=(\d+)', part.get('mimeType', '')) or [0, 24000])[1])
    return base64.b64decode(part['data']), rate


def pcm_to_wav(pcm, rate, path):
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate); w.writeframes(pcm)


def synth(path, notes, total):
    """notes: (freq, start, dur, vol) 벨 소리 합성"""
    n = int(total * SR)
    buf = [0.0] * n
    for f, st, du, vo in notes:
        s0 = int(st * SR)
        for i in range(int(du * SR)):
            if s0 + i >= n:
                break
            t = i / SR
            env = min(1, t / 0.004) * math.exp(-t * 3.2 / du)
            v = (math.sin(2 * math.pi * f * t) + .35 * math.sin(2 * math.pi * f * 2.0 * t) * math.exp(-t * 6)
                 + .18 * math.sin(2 * math.pi * f * 3.01 * t) * math.exp(-t * 9))
            buf[s0 + i] += v * env * vo
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, x)) * 30000)) for x in buf))


def sounds():
    d = os.path.join(GEN, 'snd'); os.makedirs(d, exist_ok=True)
    p = {k: os.path.join(d, k + '.wav') for k in ('chime', 'ding', 'ttaeng', 'gap')}
    if not os.path.exists(p['chime']):
        synth(p['chime'], [(1046.5, 0, 1.0, .22), (1318.5, .18, 1.1, .22)], 1.35)
        synth(p['ding'], [(783.99, 0, .7, .3), (987.77, .22, .7, .3), (1174.66, .44, 1.3, .32), (1567.98, .44, 1.3, .1)], 1.8)
        # 땡: 낮은 두 음이 부딪히는 소리
        synth(p['ttaeng'], [(196, 0, 1.0, .28), (207.65, 0, 1.0, .28), (392, 0, .5, .12)], 1.1)
        with wave.open(p['gap'], 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(b'\0\0' * int(SR * .35))
    return p


def ctx_audio(tmp):
    """사례 문제 지문 앞에 읽어 줄 '상황' 음성 (gen/ox_ctx.json → gen/a/t*_c.ogg)"""
    p = os.path.join(GEN, 'ox_ctx.json')
    if not os.path.exists(p) or not GKEY: return
    a = os.path.join(GEN, 'a'); os.makedirs(a, exist_ok=True); n = 0
    for k, t in json.load(open(p, encoding='utf8')).items():
        out = os.path.join(a, f't{k}_c.ogg')
        if os.path.exists(out): continue
        try:
            w = os.path.join(tmp, 'x.wav'); say_wav('', '', '상황입니다. ' + clean(t), w); encode([w], out); n += 1
        except Exception as e:
            log('상황 음성 실패', k, str(e)[:100])
    if n: log('상황 음성', n)


def encode(parts, out):
    """wav 여러 개를 이어 붙여 ogg(opus)로"""
    tmp = out + '.txt'
    with open(tmp, 'w') as f:
        for x in parts:
            f.write(f"file '{os.path.abspath(x)}'\n")
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', tmp, '-ar', '48000', '-ac', '1',
                    '-c:a', 'libopus', '-b:a', '32k', '-application', 'voip', out], check=True)
    os.remove(tmp)


GKEY = os.environ.get('GCLOUD_TTS_KEY', '').strip()
GVOICE = os.environ.get('CLOUD_VOICE', 'ko-KR-Chirp3-HD-Achernar')


def cloud_tts(text, raw):
    body = {'input': {'text': text}, 'voice': {'languageCode': 'ko-KR', 'name': GVOICE},
            'audioConfig': {'audioEncoding': 'LINEAR16', 'sampleRateHertz': 24000}}
    for k in range(8):
        req = urllib.request.Request(f'https://texttospeech.googleapis.com/v1/text:synthesize?key={GKEY}',
                                     data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                open(raw, 'wb').write(base64.b64decode(json.loads(r.read())['audioContent'])); return
        except urllib.error.HTTPError as e:
            msg = e.read().decode('utf8', 'replace')
            if e.code in (429, 500, 503):
                log(f'  클라우드 TTS {e.code} → 대기'); time.sleep(20 * (k + 1)); continue
            raise RuntimeError(f'클라우드 TTS HTTP {e.code}: {msg[:400]}')
        except (urllib.error.URLError, TimeoutError, OSError):
            time.sleep(10 * (k + 1))
    raise RuntimeError('클라우드 TTS 재시도 초과')


def say_wav(model, voice, text, path):
    raw = path + '.raw.wav'
    if GKEY:
        cloud_tts(text, raw)
    else:
        pcm, rate = tts(model, voice, text)
        pcm_to_wav(pcm, rate, raw)
    # 앞뒤 무음 정리 + 24kHz
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', raw, '-af',
                    'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,apad=pad_dur=0.25',
                    '-ar', str(SR), '-ac', '1', path], check=True)
    os.remove(raw)


EXP_PROMPT = """너는 공인중개사 시험 강사야. 아래 OX 지문마다 정답이 왜 그런지 귀로 듣는 해설을 써 줘.
규칙:
- 지문마다 2~3문장, 120자 안팎. 부드러운 해요체.
- 첫 문장에 맞는 이유 또는 틀린 곳과 바른 내용을 바로 말해요. 근거 법령·개념은 이름만 짧게.
- 소리 내어 읽기 좋게: 괄호, 한자, 영어 약어, 특수기호, 번호 기호를 쓰지 않아요. 숫자는 그대로.
- 정답(O/X)은 이미 정해져 있으니 바꾸지 말아요. 원래 기출문제는 참고만 해요.
JSON으로만 답해: {"items":[{"n":번호,"exp":"해설"}]}

"""


def explanations(txt_model, data):
    path = os.path.join(GEN, 'exp.json')
    exp = json.load(open(path, encoding='utf8')) if os.path.exists(path) else {}
    todo = [(ti, i, it) for ti, t in enumerate(data) for i, it in enumerate(t['items']) if f'{ti}_{i}' not in exp]
    todo = todo + todo   # 한 번 더 돌며 빠진 것 채우기
    seen = set()
    for k in range(0, len(todo), 16):
        todo_k = [x for x in todo[k:k + 16] if f'{x[0]}_{x[1]}' not in exp]
        if not todo_k:
            continue
        if time.time() > DEADLINE:
            return exp, False
        chunk = todo_k
        t0 = time.time()
        lines = []
        for n, (ti, i, it) in enumerate(chunk, 1):
            lines.append(f"{n}. [{data[ti]['subName']} · {it['t']}] 지문: {it['s']}\n   정답: {'O (맞는 말)' if it['o'] else 'X (틀린 말)'}\n   원래 기출(정답 {it['a']}번): {it['q'][:500]}")
        body = {'contents': [{'parts': [{'text': EXP_PROMPT + '\n\n'.join(lines)}]}],
                'generationConfig': {'responseMimeType': 'application/json', 'temperature': .3}}
        r = call(f'models/{txt_model}:generateContent', body)
        txt = ''.join(p.get('text', '') for p in r['candidates'][0]['content']['parts'])
        try:
            items = json.loads(txt)['items']
        except Exception:
            try:
                m = re.search(r'\{.*\}', txt, re.S)
                items = json.loads(m.group(0))['items'] if m else []
            except Exception:
                log('  해설 응답 형식 오류 — 이 묶음은 다음에 다시'); items = []
        for x in items:
            n = int(x.get('n', 0))
            if 1 <= n <= len(chunk) and x.get('exp'):
                ti, i, _ = chunk[n - 1]
                exp[f'{ti}_{i}'] = clean(x['exp'])
        json.dump(exp, open(path, 'w', encoding='utf8'), ensure_ascii=False, indent=0)
        log(f'해설 {len(exp)}/{sum(len(t["items"]) for t in data)} ({time.time()-t0:.0f}초)')
    return exp, True


CUES = {'next': '다음 지문', 'exp': '현재 지문 해설', 'restart': '현재 지문 처음부터', 'prev': '이전 지문',
        'stop': '정지', 'play': '재생', 'bookmark': '북마크', 'unbookmark': '북마크 해제', 'nextpart': '다음 과목',
        'ready': 'OX 듣기 준비됐어요. 가운데 버튼을 길게 누르면 시작해요.', 'busalert': '내리실 때가 됐어요. 하차 준비하세요.', 'buspre': '2분 뒤 내릴 시간이에요.', 'cur': '현재 지문', 'prevexp': '이전 해설', 'curexp': '현재 해설', 'first': '첫 지문이에요', 'last': '마지막 지문이에요', 'bmonly': '북마크만 들어요', 'all': '전체를 들어요'}


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else 'full'
    if mode == 'mc':
        os.makedirs(GEN, exist_ok=True)
        try:
            # 빠진 해설 → 계산 문제 그림판(v3) → 예전 해설 자세한 판(v2) 순서로 매일 이어서 (다 되면 할 일 없이 끝남)
            if mc_explanations(): log('객관식 해설 모두 최신')
        except DailyLimit as e:
            log('오늘 무료 한도 — 다음 실행에서 이어서:', str(e)[:150])
        finally:
            pass
        return
    if mode == 'cues':      # 빠진 안내 음성만 만들기
        c = os.path.join(GEN, 'cue'); tmp = os.path.join(GEN, 'tmp'); os.makedirs(c, exist_ok=True); os.makedirs(tmp, exist_ok=True)
        for k, t in CUES.items():
            out = os.path.join(c, k + '.ogg')
            if not os.path.exists(out):
                w = os.path.join(tmp, 'c.wav'); say_wav('', '', t, w); encode([w], out); log('안내', k)
        ctx_audio(tmp)
        return
    if mode == 'sounds':
        os.makedirs(GEN, exist_ok=True); print(sounds()); return
    if not KEY and not GKEY:
        sys.exit('GEMINI_API_KEY 가 없어요 (저장소 Settings > Secrets > Actions)')
    os.makedirs(GEN, exist_ok=True)
    data = json.load(open(os.path.join(ROOT, 'data', 'ox.json'), encoding='utf8'))
    tts_model, txt_model = pick_models() if KEY else ('', '')
    if GKEY: log('목소리(클라우드):', GVOICE)
    snd = sounds()
    voice = (open(os.path.join(ROOT, 'voice.txt')).read().strip() if os.path.exists(os.path.join(ROOT, 'voice.txt'))
             else os.environ.get('VOICE', 'Kore'))
    log('목소리:', voice)
    try:
        exp, ok = explanations(txt_model, data)
        if not ok:
            log('시간 초과 — 다음 실행에서 이어서'); return
        if not GKEY and os.environ.get('AUDIO', '0') != '1':      # 폰 음성(TTS)으로 읽으므로 녹음은 만들지 않음
            if len(exp) >= sum(len(t['items']) for t in data):
                open(os.path.join(GEN, 'DONE'), 'w').write('tts'); log('해설 전부 완료')
            return
        a = os.path.join(GEN, 'a'); c = os.path.join(GEN, 'cue'); os.makedirs(a, exist_ok=True); os.makedirs(c, exist_ok=True)
        tmp = os.path.join(GEN, 'tmp'); os.makedirs(tmp, exist_ok=True)
        for k, t in CUES.items():
            out = os.path.join(c, k + '.ogg')
            if not os.path.exists(out):
                w = os.path.join(tmp, 'c.wav'); say_wav(tts_model, voice, t, w); encode([w], out)
        total = sum(len(t['items']) for t in data); done = 0
        for ti, t in enumerate(data):
            for i, it in enumerate(t['items']):
                s_out = os.path.join(a, f't{ti}_{i}_s.ogg'); e_out = os.path.join(a, f't{ti}_{i}_e.ogg')
                if time.time() > DEADLINE:
                    log('시간 초과 — 다음 실행에서 이어서'); return
                if not os.path.exists(s_out):
                    w = os.path.join(tmp, 's.wav'); say_wav(tts_model, voice, clean(it['s']), w)
                    encode([snd['chime'], snd['gap'], w], s_out)
                if not os.path.exists(e_out) and os.path.exists(os.path.join(GEN, 'EXP_OK')):
                    ex = exp.get(f'{ti}_{i}', '')
                    parts = [snd['ding' if it['o'] else 'ttaeng'], snd['gap']]
                    if ex:
                        w = os.path.join(tmp, 'e.wav'); say_wav(tts_model, voice, ex, w); parts.append(w)
                    encode(parts, e_out)
                done += 1
                if done % 10 == 0:
                    log(f'음성 {done}/{total}')
        if os.path.exists(os.path.join(GEN, 'EXP_OK')):
            open(os.path.join(GEN, 'DONE'), 'w').write(voice)
        else:
            open(os.path.join(GEN, 'STMT_DONE'), 'w').write(voice)
        log('전부 완료')
    except DailyLimit as e:
        log('오늘 무료 한도 도달 — 다음 실행에서 이어서:', str(e)[:200])


EX_TPL = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ex_prompt.txt'), encoding='utf8').read()
SUBF = ['부동산학개론', '민법·민사특별법', '공인중개사법·중개실무', '부동산공법', '부동산공시법', '부동산세법']
CT = {11: '1차', 21: '2차 1교시', 22: '2차 2교시'}
MARK = '①②③④⑤'


def js_parts(tpl):
    """템플릿 문자열을 글자와 ${식} 조각으로 나눔"""
    out, i = [], 0
    while True:
        j = tpl.find('${', i)
        if j < 0:
            out.append(('s', tpl[i:])); return out
        out.append(('s', tpl[i:j]))
        k, q = j + 2, None
        while True:
            ch = tpl[k]
            if q:
                if ch == '\\': k += 1
                elif ch == q: q = None
            elif ch in "'\"": q = ch
            elif ch == '}': break
            k += 1
        out.append(('e', tpl[j + 2:k])); i = k + 1


def strs(e):
    return re.findall(r"'((?:[^'\\]|\\.)*)'", e)


def ex_prompt(q):
    """앱(Claude 해설)과 똑같은 해설 지시문을 만듦"""
    calc = '계산' in q['k']
    has = bool(re.fullmatch(r'[\d,]+', q['a']))
    ans = '전항정답(모두 정답)' if q['a'] == '전항정답' else (', '.join(MARK[int(d) - 1] for d in q['a'].split(',')) if has else '정답 미공개(12/2 발표 후 추가)')
    res = []
    for kind, v in js_parts(EX_TPL):
        if kind == 's': res.append(v); continue
        e = v.strip()
        val = {'q.n': q['n'], 'q.y': q['y'], 'CT[q.ct]': CT.get(q['ct'], ''), 'q.no': q['no'], 'SUB[q.s]': SUBF[q['s']],
               'q.u': q['u'], 'q.t': q['t'], "q.k||'일반'": q['k'] or '일반', 'ansText(q)': ans, 'q.x': q['x']}.get(e)
        if val is None:
            ss = strs(e)
            if e.startswith('q.ocr'): val = ss[0] if q.get('ocr') else ''
            elif e.startswith('calc'): val = ss[0] if calc else ss[1]
            else: val = '' if has else (ss[1] if len(ss) > 1 else '')
        res.append(str(val))
    return ''.join(res).replace('\\\\', '\\')


def pick_flash():
    names = []
    r = call('models?pageSize=200')
    for m in r.get('models', []):
        if 'generateContent' in m.get('supportedGenerationMethods', []):
            names.append(m['name'].split('/', 1)[1])
    # 무료 등급 한도가 넉넉한 Flash-Lite를 씀 (정식판 우선, 최신 버전)
    fl = [n for n in names if 'flash-lite' in n and not re.search(r'tts|image|live|audio|embed|vision|thinking|robotics|computer', n)]
    fl.sort(key=lambda n: ('preview' not in n and 'exp' not in n, ver(n)), reverse=True)
    log('객관식 해설 모델 순서:', fl[:3]); return fl[:3]


def mc_explanations():
    data = json.load(open(os.path.join(ROOT, 'data', 'mc.json'), encoding='utf8'))
    path = os.path.join(GEN, 'mc_exp.json')
    exp = json.load(open(path, encoding='utf8')) if os.path.exists(path) else {}
    models = pick_flash(); model = models.pop(0)
    n0 = len(exp)
    # 해설 없는 문항 먼저, 그다음 예전(간단한) 해설을 자세한 판(v2)으로 다시
    made = 0
    # 계산 문제는 그림·계산표(v3)가 없으면 먼저 다시 — 관계도·식을 그림으로 보여 주기 위해
    calc3 = [q for q in data if '계산' in (q.get('k') or '') and exp.get(q['id'], {}).get('v') != 3]
    data = calc3 + [q for q in data if q['id'] not in exp and q not in calc3] + [q for q in data if q['id'] in exp and exp[q['id']].get('v') not in (2, 3) and q not in calc3]
    for q in data:
        want = 3 if '계산' in (q.get('k') or '') else 2
        if exp.get(q['id'], {}).get('v', 0) >= want: continue
        if time.time() > DEADLINE: return False
        if made >= int(os.environ.get('MC_MAX', '400')):   # 하루에 이만큼만 (폰에서 쓸 무료 한도 남겨 두기)
            log('오늘 몫 완료'); break
        body = {'contents': [{'parts': [{'text': ex_prompt(q)}]}],
                'generationConfig': {'responseMimeType': 'application/json', 'temperature': .3}}
        try:
            r = call(f'models/{model}:generateContent', body)
            txt = ''.join(p.get('text', '') for p in r['candidates'][0]['content']['parts'])
            exp[q['id']] = json.loads(fixjson(re.search(r'\{.*\}', txt, re.S).group(0))); exp[q['id']]['v'] = 3 if '계산' in (q.get('k') or '') else 2; made += 1
        except DailyLimit:
            jline.dump(exp, path)
            if not models: raise
            model = models.pop(0); log('한도 → 다음 모델', model); continue
        except Exception as e:
            log('  건너뜀', q['id'], str(e)[:100]); continue
        if made and made % 10 == 0:
            jline.dump(exp, path)
            log(f'객관식 해설 {len(exp)}개 · 오늘 만든 것 {made}')
    jline.dump(exp, path)
    return len(exp) >= len(data)


def mc_audio():
    data = json.load(open(os.path.join(ROOT, 'data', 'mc.json'), encoding='utf8'))
    exp = json.load(open(os.path.join(GEN, 'mc_exp.json'), encoding='utf8'))
    d = os.path.join(GEN, 'm'); os.makedirs(d, exist_ok=True)
    tmp = os.path.join(GEN, 'tmp'); os.makedirs(tmp, exist_ok=True)
    done = 0
    for x in data:
        out = os.path.join(d, x['id'] + '.ogg')
        if os.path.exists(out) or x['id'] not in exp:
            continue
        if time.time() > DEADLINE:
            return False
        w = os.path.join(tmp, 'm.wav'); say_wav('', '', exp[x['id']], w); encode([w], out)
        done += 1
        if done % 20 == 0:
            log(f'객관식 해설 녹음 +{done}')
    return all(os.path.exists(os.path.join(d, x['id'] + '.ogg')) for x in data)


if __name__ == '__main__':
    main()
