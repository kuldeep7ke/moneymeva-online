@echo off
cd /d "%~dp0"
echo Starting Money Meva dev server...
call cmd /c npm run dev
pause
