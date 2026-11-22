import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lawsrc
for law, jo in [('공인중개사법 시행령', '제24조'), ('민법', '제280조'), ('국토의 계획 및 이용에 관한 법률', '제48조'), ('지방세법', '제20조'), ('주택임대차보호법', '제6조의3')]:
    a = lawsrc.article(law, jo); print(law, jo, '→', (a[0], a[1], a[2][:160].replace('\n', ' ')) if a else None, lawsrc.link(law, jo) if a else '')
