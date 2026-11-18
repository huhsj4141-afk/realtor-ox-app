"""앱의 🚩 신고(GitHub 이슈)를 받아 그 문항을 고치기
1) 시험지 원본(암호화된 PDF)에서 그 문제를 다시 옮겨 적고  2) 해설을 새로 만들고  3) 결과를 이슈에 답글로
사용: python3 tools/report.py <이슈 본문 파일> <PDF 폴더>   → 결과 요약을 /tmp/report_result.md 에, 종료 코드 0=고침, 3=사람 검토 필요"""
def fixjson(t):
    """Gemini가 수식 역슬래시(\\frac 등)를 한 번만 써서 JSON이 깨지는 것 바로잡기"""
    t = re.sub(r'(?<!\\)\\(?=[A-Za-z]{2,})', r'\\\\', t)
    return re.sub(r'(?<!\\)\\(?![\\"/bfnrtu])', r'\\\\', t)

import sys as _s, os as _o; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); import jline
import json, os, re, subprocess, sys, base64
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import ocrfix, gen   # 옮겨 적기 지시문·검사, 해설 지시문 재사용

def main(body_path, pdf_dir):
    body = open(body_path, encoding='utf8').read()
    m = re.search(r'문항:\s*(\d+-\d+-\d+)', body)
    if not m:
        open('/tmp/report_result.md', 'w').write('문항 번호를 찾지 못했어요.'); return 3
    qid = m.group(1)
    reasons = re.findall(r'- \[x\] (.+)', body)
    raw = {f'{r[0]}-{r[2]}-{r[3]}': r for r in json.load(open(os.path.join(ROOT, 'data', 'raw.json'), encoding='utf8'))}
    r = raw.get(qid)
    if not r:
        open('/tmp/report_result.md', 'w').write(f'{qid} 문항이 원본 목록에 없어요.'); return 3
    f, p, no = r[10], r[11], r[3]
    out = [f'**{qid}** (제{r[0]}회 {no}번) 처리 결과']
    # 1) 원본에서 다시 옮겨 적기
    imgs = []
    for q in (p, p + 1):
        base = f'/tmp/rp_{q}'
        if subprocess.run(['pdftoppm', '-r', '150', '-gray', '-jpeg', '-f', str(q), '-l', str(q), '-singlefile', f'{pdf_dir}/{f}.pdf', base]).returncode == 0 and os.path.exists(base + '.jpg'):
            imgs.append(base + '.jpg')
    parts = [{'text': ocrfix.PROMPT.format(nos=str(no))}] + [{'inline_data': {'mime_type': 'image/jpeg', 'data': base64.b64encode(open(i, 'rb').read()).decode()}} for i in imgs]
    fixed = None
    for model in ocrfix.MODELS:
        try:
            res = json.loads(re.search(r'\{.*\}', ocrfix.call(model, parts), re.S).group(0))
            x = re.sub(r'^\s*\d+\s*[.)]\s*', '', str(res.get(str(no), '')).strip())
            if ocrfix.ok(x): fixed = x; break
        except Exception as e:
            print('옮겨 적기 실패', model, str(e)[:80])
    fp = os.path.join(ROOT, 'gen', 'ocrfix.json')
    fx = json.load(open(fp, encoding='utf8')) if os.path.exists(fp) else {}
    if fixed:
        old = fx.get(qid) or r[8]
        fx[qid] = fixed; json.dump(fx, open(fp, 'w', encoding='utf8'), ensure_ascii=False, indent=0)
        out.append('- 문제 글: 시험지 원본에서 다시 옮겨 적었어요' + (' (바뀐 곳 없음)' if old.strip() == fixed.strip() else ''))
    else:
        out.append('- 문제 글: 원본에서 다시 옮겨 적지 못했어요 → 사람이 확인할게요')
    subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'fixtext.py')], check=True)
    # 2) 해설 새로 만들기
    mc = {q['id']: q for q in json.load(open(os.path.join(ROOT, 'data', 'mc.json'), encoding='utf8'))}
    ep = os.path.join(ROOT, 'gen', 'mc_exp.json'); exp = json.load(open(ep, encoding='utf8'))
    made = False
    if qid in mc:
        for model in ['gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite']:
            try:
                txt = ocrfix.call(model, [{'text': gen.ex_prompt(mc[qid])}])
                e = json.loads(fixjson(re.search(r'\{.*\}', txt, re.S).group(0))); e['v'] = 2; exp[qid] = e; made = True; break
            except Exception as er:
                print('해설 실패', model, str(er)[:80])
    jline.dump(exp, ep)
    out.append('- 해설: 새로 만들었어요' if made else '- 해설: 이번엔 못 만들었어요(무료 한도) → 다음 자동 생성 때 다시')
    need_human = (not fixed) or any('정답' in x for x in reasons)
    if any('정답' in x for x in reasons):
        out.append('- 정답이 틀렸다는 신고는 공식 정답과 다시 대조해 확인할게요')
    out.append('\n새 버전이 만들어지면 앱이 업데이트를 물어봐요.')
    open('/tmp/report_result.md', 'w', encoding='utf8').write('\n'.join(out))
    return 3 if need_human else 0

if __name__ == '__main__':
    sys.exit(main(sys.argv[1], sys.argv[2]))
