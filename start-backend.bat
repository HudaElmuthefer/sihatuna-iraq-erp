@echo off
title Backend - Port 8000
color 0A
cls
echo.
echo  ============================================
echo   SIHATUNA IRAQ ERP
echo   Backend Server - http://localhost:8000
echo  ============================================
echo.

REM Check if port 8000 is already in use by a leftover process from a
REM previous run. Without this check, starting a second instance would
REM fail silently while the old (possibly stale) instance keeps answering
REM requests on localhost:8000, which is confusing to diagnose.
set FOUND_PID=
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:"LISTENING" ^| findstr :8000') do set FOUND_PID=%%P
if defined FOUND_PID (
    echo  [!] Port 8000 is already in use by another process ^(PID %FOUND_PID%^).
    echo      This usually means an old server instance is still running in the background.
    echo.
    choice /C YN /M "  Stop that process now and continue"
    if errorlevel 2 (
        echo.
        echo  Cancelled. Close the process manually via Task Manager, then re-run this file.
        pause
        exit /b 1
    )
    taskkill /PID %FOUND_PID% /F >nul 2>&1
    echo  [OK] Old process stopped. Continuing...
    echo.
)

cd /d "%~dp0backend"
echo [1/2] Installing packages...
call npm install
if %errorlevel% neq 0 (
    echo.
    echo  [X] npm install FAILED - see error above. Fix it then re-run this file.
    pause
    exit /b 1
)
echo [2/2] Starting server...
echo.
echo  Server running at: http://localhost:8000
echo  Keep this window open!
echo.
node server.js
pause
