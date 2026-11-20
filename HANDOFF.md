# 공인중개사 기출 학습 앱 — 이어서 작업하기 (인수인계)

## 1. 한눈에
- 저장소: https://github.com/huhsj4141-afk/realtor-ox-app (공개)
- 안드로이드 앱(Kotlin, 패키지 `kr.realtor.ox`) + 안쪽은 WebView 웹 화면(HTML/JS)
- **main 에 push 하면 GitHub Actions 가 APK 를 만들어** `latest` 릴리스에 올림 → 앱의 업데이트 버튼으로 설치
  - APK: https://github.com/huhsj4141-afk/realtor-ox-app/releases/latest/download/realtor-ox.apk
  - 버전 = 빌드 번호(`version.txt`, run_number)

## 2. 파일 구조
| 위치 | 내용 |
|---|---|
| `web/index.html` | 기본 웹 앱(문제 데이터 RAW 포함, 매우 큼). 직접 고치지 말고 `tools/fixtext.py` 가 다시 만듦 |
| `web/ox-audio.js` | 화면(홈·문제·기록 탭) 덮어쓰기 층 |
| `web/app.js` | **최신 기능 대부분**: 오늘 코스, 학습 매니저, 성취/레벨/배지, 예상 점수, 필기장, 풀이 도식, 읽어 주기, 테마, 소음, 히스토리 등. 화면을 그린 뒤 `wrap()`·`setInterval` 로 꾸미는 방식 |
| `web/shim.js` | 웹 ↔ 앱 연결(NativeBridge), Gemini 호출, 음성(TTS) |
| `web/pron.json` | 읽을 때 발음 규칙(정규식). 앱(Kotlin)과 음성 생성(Python) 둘 다 씀 |
| `web/glossary.json` | 용어 풍선말 (약 1,080개) |
| `app/src/main/java/kr/realtor/ox/` | `MainActivity`(듣기 화면) `PlayerService`(듣기 재생) `WebActivity`(웹+NativeBridge) `Net`(Gemini·구글 음성) `Updater` `Study` `Data` `Haptic` |
| `data/` | 문제 원본(`mc.json`, `ox.json`, `raw.json` …) |
| `gen/` | AI가 만든 해설(`mc_exp.json` 한 줄에 한 항목), OX 변형, 미리 만든 음성 `gen/a/*.ogg` 등 |
| `tools/` | `gen.py`(해설·음성 생성) `fixtext.py`(띄어쓰기·머리글 정리→index.html·mc.json) `oxvar.py` `ocrfix.py` `glossgen.py` `oxctx.py` `report.py` |
| `.github/workflows/` | `build.yml`(해설 생성 + APK), `ocrfix.yml`(OCR·용어·OX 변형), `report.yml`(🚩신고 이슈 처리) |

## 3. 꼭 지킬 것 (사용자 요청)
1. **MP3 재생은 어떤 경우에도 쓰지 않음** (음성은 OGG/구글 TTS).
2. **API 키를 코드·채팅에 넣지 않음.** 키는 사용자가 앱 ⚙ 설정에서 직접 입력. GitHub Secrets: `GEMINI_API_KEY`, `GCLOUD_TTS_KEY` (있으면 `GEMINI_API_KEY_2`).
3. 사용자 대신 약관 동의·결제 설정·로그인 하지 않음.
4. 화면은 **단순·통일**. 같은 기능을 두 곳에 만들지 않기. 버튼은 늘 같은 자리.
5. 글은 쉬운 우리말. 오류는 영어 그대로 보여 주지 말고 알기 쉬운 말로.
6. 구글 클라우드 음성 무료 한도를 넘길 대량 재생성은 하지 않음(요금 위험).

## 4. 작업하는 법
- 웹만 고칠 때: `web/*.js` 수정 → `node -e "new Function(require('fs').readFileSync('web/app.js','utf8'))"` 로 문법 확인 → commit → push → 약 5~10분 뒤 새 APK.
- 커밋 메시지는 한국어로 무엇을 바꿨는지. push 는 `git pull --rebase` 후 (봇도 커밋함).
- **Actions 는 같은 그룹에 '대기' 1개만 둠** → 해설 생성이 도는 동안 push 를 여러 번 하면 앞의 대기 빌드는 취소됨(마지막 것만 빌드됨, 정상).
- GitHub 예약 실행(cron)이 11/16 이후 안 돌고 있음 → 매일 저녁 5시(KST) 이후 수동 실행 필요:
  - `gh api -X POST repos/huhsj4141-afk/realtor-ox-app/actions/workflows/build.yml/dispatches -f ref=main` (해설 만들기, 최대 2시간)
  - 끝난 뒤 `.../ocrfix.yml/dispatches -f ref=main -f 'inputs[step]=run'`
  - Gemini 무료 한도는 매일 오후 5시(KST)에 다시 참.

## 5. 지금 상태 (2026-11-20 밤)
- 문제 1,999개, 해설 약 1,940개(계산 그림판 v3 약 140개, 남은 것 매일 400개씩 생성 중), OX 변형 529개, 용어 1,079개.
- 마지막으로 넣은 기능(빌드 대기 중, v141 이후 버전에 들어감): 🚀 오늘 코스(시작 버튼 하나로 복습→약점→진도→마무리, 듣기 모드), 🧊 스트릭 보호권, 🏁 주간 리그, 📈 예상 점수 그래프, 🌳 집중 타이머, D-30 실전 모드, 용어 1,079개.

## 6. 남은 일 / 다음 후보
1. 새 버전이 나오면 폰에서 오늘 코스·듣기 코스(🧭 오늘 코스 목록) 실제 동작 확인.
2. 매일 해설 만들기 실행(위 4번) — 남은 해설 약 1,200개.
3. 🚩 신고 이슈 확인: https://github.com/huhsj4141-afk/realtor-ox-app/issues (report.yml 이 자동으로 다시 만들지만 듣기 지문은 사람이 확인).
4. 용어 풍선말 1,079개 중 뜻이 틀린 것 점검(`web/glossary.json`).
5. 듣기 탭 미리 만든 음성 1천여 개는 예전 설정(쉼표 쉬기·0.92배 속도 이전). 무료 한도 안에서 나눠 다시 만들지 사용자와 상의.
6. 아이디어: 오답 원인 분류(개념/계산/함정), 과목별 학습 시간 목표, 주간 리포트 알림.
