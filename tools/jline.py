"""큰 JSON 사전을 '한 항목 = 한 줄'(키 정렬)로 저장 — 여러 자동 작업이 서로 다른 문항을 고쳐도 git 이 알아서 합칠 수 있게."""
import json


def dump(d, path):
    with open(path, 'w', encoding='utf8') as f:
        f.write('{\n' + ',\n'.join(json.dumps(k, ensure_ascii=False) + ':' + json.dumps(d[k], ensure_ascii=False, separators=(',', ':')) for k in sorted(d)) + '\n}\n')
