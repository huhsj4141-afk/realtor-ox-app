"""OX 지문의 '상황'(사례 문제의 앞부분)을 뽑아 gen/ox_ctx.json {키: 상황} 으로.
甲·乙처럼 앞 상황을 알아야 풀 수 있는 지문이 들을 때·볼 때 빠지지 않게."""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fixtext
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
Q_END = re.compile(r'(다음|이에 관한|이 경우|위 사례|위 사안|그 설명|설명으로|옳은|틀린|옳지|않은|것은\?|것을 모두|고른 것|모두 고른|계산|얼마).*$', re.S)

def stem(x, cnt):
    s = fixtext.join_lines(x.split('①')[0], cnt)
    s = re.sub(r'\d{4}년\s*제\d+회\s*공인중개사', ' ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    # 끝의 묻는 문장(…옳은 것은?(다툼이 있으면 판례에 따름)) 떼기
    s = re.sub(r'\((?:다툼|단,|이하)[^)]*\)\s*$', '', s).strip()
    sents = re.split(r'(?<=[.다])\s+', s)
    while sents and re.search(r'\?$|것은$|고른 것|옳은|틀린|옳지 않은|설명으로|관한 설명', sents[-1]):
        sents.pop()
    s = ' '.join(sents).strip()
    return s

def main():
    mc = {q['id']: q for q in json.load(open(os.path.join(ROOT, 'data', 'mc.json'), encoding='utf8'))}
    data = json.load(open(os.path.join(ROOT, 'data', 'ox.json'), encoding='utf8'))
    cnt = fixtext.corpus_counts(json.load(open(os.path.join(ROOT, 'data', 'raw.json'), encoding='utf8')))
    out = {}
    for ti, t in enumerate(data):
        for i, it in enumerate(t['items']):
            q = mc.get(it.get('ref', ''))
            x = q['x'] if q else it.get('q', '')
            if not x: continue
            s = stem(x, cnt)
            if len(s) >= 20 and (re.search(r'[甲乙丙丁戊]|A|B|X|Y', it['s']) or len(s) >= 40):
                out[f'{ti}_{i}'] = s
    json.dump(out, open(os.path.join(ROOT, 'gen', 'ox_ctx.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=0)
    print('상황 붙은 지문', len(out))

if __name__ == '__main__':
    main()
