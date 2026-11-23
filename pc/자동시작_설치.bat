@echo off
chcp 65001 >nul
cd /d "%~dp0"
python --version >nul 2>&1 || (echo 파이썬이 없어요. python.org 에서 설치할 때 "Add python.exe to PATH"를 꼭 체크하세요. & pause & exit /b)
if not exist key.txt (echo key.txt 가 없어요. 메모장으로 key.txt를 만들고 AI 키 한 줄만 넣어 주세요. & pause & exit /b)
copy /y "%~dp0시작.bat" "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\중개사앱_일꾼.bat" >nul
powershell -NoProfile -Command "(Get-Content '%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\중개사앱_일꾼.bat') -replace '%%~dp0','%~dp0' | Set-Content '%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\중개사앱_일꾼.bat'"
call 시작.bat
echo 완료! PC를 켤 때마다 자동으로 시작돼요. 기록은 worker.log 에서 볼 수 있어요.
pause
