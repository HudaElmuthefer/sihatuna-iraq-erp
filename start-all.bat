@echo off
title SIHATUNA IRAQ ERP
color 0E
cls
echo.
echo  ============================================
echo   SIHATUNA IRAQ ERP
echo   Starting Backend + Frontend together...
echo  ============================================
echo.

REM Check if port 8000 is already in use by a leftover process before
REM starting a new backend instance.
set FOUND_PID=
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:"LISTENING" ^| findstr :8000') do set FOUND_PID=%%P
if defined FOUND_PID (
    echo  [!] Port 8000 is already in use by another process ^(PID %FOUND_PID%^).
    choice /C YN /M "  Stop that process now and continue"
    if errorlevel 2 (
        echo  Cancelled.
        pause
        exit /b 1
    )
    taskkill /PID %FOUND_PID% /F >nul 2>&1
    echo  [OK] Old process stopped.
    echo.
)

echo  Step 1: Starting Backend (port 8000)...
start "Backend - Port 8000" cmd /k "cd /d %~dp0backend && npm install && node server.js"
echo  Waiting 4 seconds...
timeout /t 4 /nobreak > nul
echo  Step 2: Starting Frontend (port 3000)...
start "Frontend - Port 3000" cmd /k "cd /d %~dp0frontend && npm install && set NODE_OPTIONS=--openssl-legacy-provider && npm start"
echo.
echo  Done!
echo  Backend  : http://localhost:8000
echo  Frontend : http://localhost:3000
echo.
pause
