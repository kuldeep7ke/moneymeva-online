@echo off
setlocal EnableExtensions
title Money Meva - Stop Server

set STOPPED=0
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /C:":3000 " ^| findstr LISTENING') do (
    taskkill /F /PID %%p >nul 2>nul
    if not errorlevel 1 (
        echo Stopped server process %%p
        set STOPPED=1
    )
)

if "%STOPPED%"=="0" echo No Money Meva server is currently running on port 3000.

if exist "%~dp0.server.pid" del /q "%~dp0.server.pid" >nul 2>nul

echo Done.
timeout /t 3 >nul
