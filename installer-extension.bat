@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"

echo ========================================
echo  SnowAI — installer l'extension
echo ========================================
echo.
echo 1. Chrome/Edge s'ouvre sur la page Extensions.
echo 2. Activez le Mode developpeur.
echo 3. Charger l'extension non empackee
echo 4. Selectionnez ce dossier :
echo    %~dp0
echo.

set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if exist "%CHROME%" start "" "%CHROME%" chrome://extensions/
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" edge://extensions/
explorer "%~dp0"
pause
