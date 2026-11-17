# 중개사 공부 앱 (realtor-ox)

폰에 깔아 쓰는 공인중개사 공부 앱. main에 올리면 GitHub Actions가 APK를 만들어
[Releases › latest](../../releases/latest)에 `realtor-ox.apk`로 올린다.

## 구조

| 위치 | 하는 일 |
|---|---|
| `web/index.html`, `web/ox-audio.js` | 기출 풀이·학습 일지·수준 체크 등 앱 대부분의 화면 (원래 Claude 앱용 웹앱) |
| `web/shim.js` | 웹앱의 `window.claude` 기능을 폰에서 대신함: 저장(localStorage), AI(Gemini), 읽기(Achernar). "귀로 듣기"는 네이티브 화면으로 연결 |
| `app/.../WebActivity.kt` | 첫 화면. 웹앱을 띄우고 `NativeBridge`로 Gemini·음성 호출을 받아 줌 |
| `app/.../MainActivity.kt` | 🎧 OX 듣기 화면 (재생 버튼, 설정, 키, 사용량, 리모컨) |
| `app/.../PlayerService.kt` | 화면이 꺼져도 도는 재생기. 동작은 모두 `act("동작이름")` 하나로 모임 |
| `app/.../Data.kt` | OX 문항 불러오기(`Store`), 리모컨 칸·동작 목록(`Remote`) |
| `app/.../Net.kt` | Gemini, 구글 클라우드 음성(Achernar), 사용량 계산(`Usage`) |
| `data/ox.json` | OX 문항 (과목별) |
| `gen/` | 미리 만든 해설(`exp.json`)과 녹음(`a/`, `cue/`, `snd/`). 봇이 커밋함 |
| `tools/gen.py` | 해설·녹음 생성기. 모드: `full`, `cues`(빠진 안내 음성만), `mc`(객관식 해설, 멈춤), `sounds` |

## 자주 하는 수정

- **리모컨 버튼 동작 바꾸기**: `Data.kt`의 `Remote.SLOTS` 기본값. 새 동작은 `Remote.ACTIONS`에 이름을 넣고 `PlayerService.act()`에 `"이름" -> …`을 추가.
- **안내 음성 추가**: `tools/gen.py`의 `CUES`에 `'이름': '말할 문장'`을 넣고 올리면 다음 빌드에서 `gen/cue/이름.ogg`가 생긴다. 앱에서는 `say("이름", "화면 문구")`.
- **AI 모델 바꾸기**: 듣기 화면은 `Net.geminiText`의 모델 목록, 웹 화면은 `shim.js`의 `MODELS`.
- **요금 단가**: `Net.kt`의 `Usage` 상수.

## 키 (코드에 넣지 않음)

- 폰: 듣기 화면 🔑 키 설정에 Gemini 키, 구글 클라우드 음성 키를 넣는다.
- 빌드: 저장소 Secrets `GEMINI_API_KEY`, `GCLOUD_TTS_KEY`.
- 요금: Gemini는 결제 없는 무료 등급, 음성은 월 100만 자 무료. 결제 계정에 월 ₩1,000 예산 알림이 걸려 있다.
