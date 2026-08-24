@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Money Meva - Production Server

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

set NEEDBUILD=0
if not exist out\index.html set NEEDBUILD=1
if %NEEDBUILD%==0 (
    for /f %%s in ('node scripts\fresh-check.cjs') do set FRESHNESS=%%s
    if not "%FRESHNESS%"=="FRESH" set NEEDBUILD=1
)

if %NEEDBUILD%==1 (
    echo [AUTO-FIX] Building production bundle ^(first run or source changed^)...
    call npx next build
    if errorlevel 1 (
        echo [FAILED] Build failed. Fix errors above and run again.
        pause
        exit /b 1
    )
)

echo Starting Money Meva on http://localhost:3000 ...
start "MoneyMeva-Server" /min cmd /c "node scripts\serve.cjs --port 3000 > .server.log 2>&1"

powershell -NoProfile -Command "$u='http://localhost:3000'; for ($i=0; $i -lt 40; $i++) { try { $r=Invoke-WebRequest $u -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { Start-Process $u; exit 0 } } catch {}; Start-Sleep -Milliseconds 500 }; Start-Process $u"

echo.
echo   ================================================
echo    Money Meva is running:  http://localhost:3000
echo    Stop it with:           stop-server.bat
echo   ================================================
echo.
pause
