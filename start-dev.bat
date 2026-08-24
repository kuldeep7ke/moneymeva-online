@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Money Meva - Dev Server

where node >nul 2>nul
if errorlevel 1 (
    echo [FIX NEEDED] Node.js is not installed or not in PATH.
    echo Install it from https://nodejs.org and run this file again.
    pause
    exit /b 1
)

if not exist node_modules (
    echo [AUTO-FIX] Dependencies missing - installing...
    call npm install
    if errorlevel 1 (
        echo [FAILED] npm install did not complete. Check your internet connection.
        pause
        exit /b 1
    )
)

for /f "tokens=5" %%p in ('netstat -ano ^| findstr /C:":3000 " ^| findstr LISTENING') do taskkill /F /PID %%p >nul 2>nul

echo Starting Money Meva dev server on http://localhost:3000 ...
start "MoneyMeva-Dev" /min cmd /c "npm run dev > .dev-server.log 2>&1"

powershell -NoProfile -Command "$u='http://localhost:3000'; for ($i=0; $i -lt 120; $i++) { try { $r=Invoke-WebRequest $u -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { Start-Process $u; exit 0 } } catch {}; Start-Sleep -Milliseconds 500 }; Start-Process $u"

echo.
echo   ================================================
echo    Dev server is running:  http://localhost:3000
echo    Stop it with:           stop-server.bat
echo   ================================================
echo.
pause
