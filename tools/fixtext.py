"""객관식 문항 만들기: 원본(data/raw.json, data/mc_src.json) → 앱에 들어가는 web/index.html 의 RAW 와 data/mc.json
- PDF 줄바꿈 때문에 끊긴 단어 이어 붙이기, 깨진 글자·쪽 표시 지우기
- gen/ocrfix.json (시험지 이미지로 다시 옮겨 적은 본문) 반영
- 아직 다시 옮겨 적지 못한 OCR 문항(36·37회)은 숨김, data/drop.json 의 문항은 삭제
사용: python3 tools/fixtext.py   (원본은 건드리지 않아서 몇 번을 돌려도 같은 결과)"""
import json, os, re, collections
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML = os.path.join(ROOT, 'web', 'index.html')
MARK = re.compile(r'^\s*([①-⑳]|[ㄱ-ㅎ]\s*[.:]|[○●□■◦·•※\-<〈(\[]|\d+\s*[.)]|[가-하]\.\s|[A-E]\s*[.:]|[a-e]\s*[.:]|\|)')
JOSA = tuple('의은는이가을를에로와과도만께서며고및')

def load():
    s = open(HTML, encoding='utf8').read()
    i = s.find('const RAW='); j = s.find('];', i)
    return s, i, j, json.loads(s[i + 10:j + 1])

def corpus_counts(raw):
    """단어 수와 앞부분(접두) 수"""
    c = collections.Counter(); pc = collections.Counter()
    for r in raw:
        for w in re.findall(r'[가-힣]+', r[8].replace('\n', ' ')):
            c[w] += 1
            for k in range(2, min(len(w), 4) + 1): pc[w[:k]] += 1
    c.pc = pc
    return c

def join_lines(x, cnt):
    lines = x.split('\n'); out = []
    for ln in lines:
        if out and ln.strip() and out[-1].strip() and not MARK.match(ln) and not out[-1].rstrip().endswith(('?', ':')):
            a, b = out[-1].rstrip(), ln.strip()
            wa = re.search(r'([가-힣]+)$', a); wb = re.match(r'([가-힣]+)', b)
            glue = ' '
            if wa and wb:
                A, B = wa.group(1), wb.group(1)
                # 조사로 시작하거나, 붙인 단어가 다른 문제에 나오거나, 앞말+다음 첫 글자로 시작하는 단어가 앞말 단독보다 많으면 붙임
                short = len(A) <= 2 and (cnt.pc[A + B[0]] > cnt[A] or (len(A) == 1 and cnt[A] == 0))
                if (B[0] in JOSA and len(B) <= 2) or cnt[A + B] > 0 or short or (len(A) >= 3 and cnt[A] == 0):
                    glue = ''
            elif re.search(r'[(\[·ㆍ]$', a) or re.match(r'[)\],.·ㆍ%]', b):
                glue = ''
            out[-1] = a + glue + b
        else:
            out.append(ln)
    x = '\n'.join(l for l in out if l.strip())
    x = re.sub(r'[\ue000-\uf8ff]', '', x)   # 글꼴 전용 깨진 글자
    x = re.sub(r'\s*(사\s*)?\d차\s*\d교시\s*[A-Z]형?-\d+-\d+\s*', '\n', x)
    x = re.sub(r'\s*제\s*\d\s*과목\s*:.*$', '', x)
    x = re.sub(r"[ \t]*제\s*\d+\s*회\s*공인중개사\s*\d\b[ \t]*", " ", x).rstrip()   # 쪽 아래 머리글(제28회 공인중개사 1)
    x = re.sub(r"[ \t]*(?:\d{4}년\s*)?제\s*\d+\s*회\s*공인중개사(?:\s*\d\b)?[ \t]*(?=\n|$)", "", x).rstrip()   # 쪽 위 머리글(2018년 제29회 공인중개사)
    return x.strip()

STANDALONE = set('수 것 등 중 및 때 후 전 시 내 외 간 상 하 안 더 또 각 약 총 단 제 줄 바 데 뿐 만 원 명 개 년 월 일 층 호 동 번 항 조 회 점 장 곳 쪽 차 배 분 초 세 채 필 평 건 권 법 위 앞 뒤 옆 말 달 주 해 날 그 이 저 및 즉 곧 또는 매 각 본 당 해당 갑 을 병 정 무'.split())


def fix_spacing(x, cnt):
    """띄어쓰기 고치기: 「…법률」 에 → 법률」에, 면 적 → 면적, 신청인에 게 → 신청인에게 (낱말 사전에 붙인 꼴이 있을 때만)"""
    x = re.sub(r'(법|률|규칙|령|조례|법률」|법」|규칙」|령」)[ \t]+(에서|에게|에|의|을|를|은|는|으로|로|과|와|이|가|상)(?=[\s,.)」]|$)', r'\1\2', x)
    def j(m):
        a, b = m.group(1), m.group(2)
        if b in STANDALONE or len(b) > 1: return m.group(0)
        w = a + b
        return w if cnt.get(w, 0) >= 2 and cnt.get(w, 0) >= cnt.get(b, 0) * 0 else m.group(0)
    return re.sub(r'([가-힣]+)[ \t]([가-힣])(?![가-힣])', j, x)


def fix_runtime(s):
    """Keep session fixes when regenerating the embedded question data."""
    s = s.replace("if(can){EX.push({ts:Date.now(),n:S.exam.n,ct:S.exam.ct,sc,pass});touch('meta')}",
                  "if(can&&S.done&&!S.resultSaved){EX.push({ts:S.doneAt||Date.now(),n:S.exam.n,ct:S.exam.ct,sc,pass});S.resultSaved=true;touch('meta')}")
    s = s.replace("if(ex&&S.i<S.list.length-1)setTimeout(()=>{S.i++;quiz()},180)",
                  "if(ex&&S.i<S.list.length-1){const session=S,index=S.i;clearTimeout(session.advanceTimer);session.advanceTimer=setTimeout(()=>{if(S===session&&cur==='quiz'&&!session.done&&session.i===index){session.i++;quiz()}},180)}")
    s = s.replace("function renderEx(e){if(!e)return'';const A=x=>Array.isArray(x)?x:[];",
                  "function renderEx(e){if(!e)return'';const A=x=>Array.isArray(x)?x:[],O=c=>window.__choiceOx?window.__choiceOx(c):(/^[OX]$/.test(c.ox)?c.ox:null);")
    s = s.replace("String(c.ox).includes('O')?'o':'x'", "O(c)==='O'?'o':O(c)==='X'?'x':''")
    s = s.replace("String(c.ox).includes('O')?'O':'X'", "O(c)||'?'"
                  )
    s = s.replace("catch(err){const el=document.getElementById('aitxt');",
                  "catch(err){const el=box.isConnected&&S&&S.list[S.i]===q?box.querySelector('#aitxt'):null;")
    return s


def main():
    s, i, j, _ = load()
    raw = json.load(open(os.path.join(ROOT, 'data', 'raw.json'), encoding='utf8'))
    fix_p = os.path.join(ROOT, 'gen', 'ocrfix.json')
    fix = json.load(open(fix_p, encoding='utf8')) if os.path.exists(fix_p) else {}
    cnt = corpus_counts([r for r in raw if not (len(r) > 12 and r[12])])
    drop = set(json.load(open(os.path.join(ROOT, 'data', 'drop.json')))) if os.path.exists(os.path.join(ROOT, 'data', 'drop.json')) else set()
    keep, changed = [], []
    for r in raw:
        idd = f'{r[0]}-{r[2]}-{r[3]}'
        if idd in drop: changed.append(idd); continue
        old = r[8]
        if len(r) > 12 and r[12] and idd not in fix:
            changed.append(idd); continue          # 깨진 OCR 문항은 고칠 때까지 숨김
        if idd in fix:
            r[8] = re.sub(r'[ \t]*([①-⑤])', r'\n\1', fix[idd]).strip()
            if len(r) > 12: r[12] = 0
        else:
            r[8] = fix_spacing(join_lines(r[8], cnt), cnt)
        if r[8] != old: changed.append(idd)
        keep.append(r)
    s = s[:i + 10] + json.dumps(keep, ensure_ascii=False, separators=(',', ':')) + s[j + 1:]
    open(HTML, 'w', encoding='utf8').write(fix_runtime(s))
    mc_p = os.path.join(ROOT, 'data', 'mc.json'); mc = json.load(open(os.path.join(ROOT, 'data', 'mc_src.json'), encoding='utf8'))
    by = {f'{r[0]}-{r[2]}-{r[3]}': r for r in keep}
    mc = [dict(q, x=by[q['id']][8], ocr='0' if q['id'] in fix else q['ocr']) for q in mc if q['id'] in by]
    json.dump(mc, open(mc_p, 'w', encoding='utf8'), ensure_ascii=False)
    print('바뀐 문항', len(changed), '남은 문항', len(keep))
    return changed

if __name__ == '__main__':
    main()
