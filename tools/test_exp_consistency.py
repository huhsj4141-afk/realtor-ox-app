"""해설 일관성 검사: 해설의 정답 번호·보기별 O/X 가 공식 정답과 맞는지 (모순이면 실패)"""
import json, os, re, unittest
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def problems():
    mc = {q['id']: q for q in json.load(open(os.path.join(ROOT, 'data', 'mc.json'), encoding='utf8'))}
    ex = json.load(open(os.path.join(ROOT, 'gen', 'mc_exp.json'), encoding='utf8'))
    out = []
    for k, q in mc.items():
        if q.get('ocr') or not re.fullmatch(r'[1-5](,[1-5])*', str(q['a'])): continue
        e = ex.get(k)
        if not e: out.append((k, '해설 없음')); continue
        keys = set(map(int, str(q['a']).split(',')))
        m = re.findall(r'[①②③④⑤]', str(e.get('answer', ''))[:40])
        if m and '①②③④⑤'.index(m[0]) + 1 not in keys: out.append((k, '정답 번호 불일치'))
        ch = e.get('choices') or []
        if len(ch) == 5 and len(keys) == 1 and not re.search(r'모두\s*고른|묶인|옳은\s*것의\s*개수', q['x']) and '계산' not in (q.get('k') or ''):
            a = next(iter(keys)); O = [c.get('no') for c in ch if c.get('ox') == 'O']
            if O not in ([a], [i for i in range(1, 6) if i != a]): out.append((k, '보기 O/X 모순'))
    return out


class T(unittest.TestCase):
    def test_no_contradiction(self):
        p = problems()
        self.assertEqual(p, [], f'{len(p)}건: {p[:10]}')


if __name__ == '__main__':
    unittest.main()
