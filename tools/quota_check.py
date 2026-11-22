"""무료 AI 한도 확인: 모델마다 아주 짧은 요청 1번씩 보내서 되는지/어떤 한도에 걸렸는지 출력"""
import json, os, re, urllib.request, urllib.error
for envk in ('GEMINI_API_KEY', 'GEMINI_API_KEY_2'):
    KEY = os.environ.get(envk)
    if not KEY: print(envk, '없음'); continue
    try:
        with urllib.request.urlopen(f'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key={KEY}', timeout=30) as r:
            names = [m['name'].split('/', 1)[1] for m in json.load(r).get('models', []) if 'generateContent' in m.get('supportedGenerationMethods', [])]
    except urllib.error.HTTPError as e:
        print(envk, '모델 목록 실패', e.code, e.read().decode()[:300]); continue
    ms = [n for n in names if re.fullmatch(r'gemini-\d+(\.\d+)?-flash(-lite)?', n)]
    print(f'== {envk}: 쓸 수 있는 Flash 계열', ms)
    for m in ms[:6]:
        body = json.dumps({'contents': [{'parts': [{'text': '1+1=? 숫자만'}]}], 'generationConfig': {'maxOutputTokens': 5}}).encode()
        req = urllib.request.Request(f'https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={KEY}', body, {'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                print(f'  ✅ {m}: 됨')
        except urllib.error.HTTPError as e:
            b = e.read().decode('utf8', 'ignore')
            q = re.findall(r'"quotaId":\s*"([^"]+)"', b); lim = re.findall(r'"quotaValue":\s*"([^"]+)"', b); rd = re.findall(r'"retryDelay":\s*"([^"]+)"', b)
            print(f'  ❌ {m}: {e.code} 한도={q} 값={lim} 다시={rd} {re.sub(chr(10)," ",b)[:160]}')

    for m in ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.6-flash']:
        import time; t0 = time.time()
        body = json.dumps({'contents': [{'parts': [{'text': '공인중개사법 업무보증 설정 금액 현행 기준 한 줄'}]}], 'tools': [{'google_search': {}}]}).encode()
        req = urllib.request.Request(f'https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={KEY}', body, {'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                j = json.load(r); c = j['candidates'][0]
                print(f'  🔎 {m}: 검색 됨 {time.time()-t0:.0f}초, 출처 {len((c.get("groundingMetadata") or {}).get("groundingChunks", []))}개')
        except urllib.error.HTTPError as e:
            print(f'  🔎❌ {m}: {e.code} {re.sub(chr(10)," ",e.read().decode("utf8","ignore"))[:200]}')
