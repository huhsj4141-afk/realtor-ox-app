#!/bin/bash
set -x
adb install -r app.apk
P=kr.realtor.ox; S=/tmp/out; mkdir -p $S
t() { echo "== $1"; sleep 3; adb shell dumpsys activity activities | grep -E "topResumedActivity|ResumedActivity" | head -2; adb shell dumpsys activity recents | grep -E "Recent #|realActivity|baseIntent" | head -12; }
tapRecent() { adb shell input keyevent KEYCODE_APP_SWITCH; sleep 3; adb exec-out screencap -p > $S/recents_$1.png; W=$(adb shell wm size | grep -o '[0-9]*x[0-9]*' | tail -1); X=$((${W%x*}/2)); Y=$((${W#*x}/2)); adb shell input tap $X $Y; sleep 4; adb exec-out screencap -p > $S/after_$1.png; }
adb logcat -c
echo "### 1) 앱 열기 → 홈 → 설정 → 최근 앱에서 우리 앱"
adb shell monkey -p $P -c android.intent.category.LAUNCHER 1; sleep 8; adb shell input keyevent KEYCODE_HOME; sleep 2
adb shell am start -a android.settings.SETTINGS; sleep 3
adb shell input keyevent KEYCODE_APP_SWITCH; sleep 3; adb shell input swipe 200 1200 1000 1200 300; sleep 2; adb shell input keyevent KEYCODE_BACK; sleep 1
tapRecent 1; t "after 1"
echo "### 2) 앱 프로세스가 정리된 뒤(메모리 부족 흉내) 최근 앱에서"
adb shell input keyevent KEYCODE_HOME; sleep 2; adb shell am kill $P; adb shell am force-stop com.android.settings; sleep 2
tapRecent 2; t "after 2"
echo "### 3) 듣기 화면(OX 듣기) 열고 → 홈 → 정리 → 최근 앱"
adb shell am start -n $P/.MainActivity || true; sleep 6; adb shell input keyevent KEYCODE_HOME; sleep 2; adb shell am kill $P; sleep 2
tapRecent 3; t "after 3"
echo "### 4) 업데이트 설치(같은 APK 다시 설치) 뒤 최근 앱"
adb shell input keyevent KEYCODE_HOME; adb install -r app.apk; sleep 3
tapRecent 4; t "after 4"
adb logcat -d | grep -iE "ActivityTaskManager|startActivityFromRecents|Recents|Unable|FATAL|AndroidRuntime|kr.realtor" | grep -vi "chatty" | tail -150 > $S/log.txt || true
echo "------ 로그"; cat $S/log.txt | tail -80
