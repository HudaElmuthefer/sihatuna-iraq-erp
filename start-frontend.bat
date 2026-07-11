@echo off
title Frontend - Port 3000
color 0B
cls
echo.
echo  ============================================
echo   SIHATUNA IRAQ ERP
echo   Frontend App - http://localhost:3000
echo   Run start-backend.bat first!
echo  ============================================
echo.
cd /d "%~dp0frontend"
echo [1/2] Installing packages...
call npm install
if %errorlevel% neq 0 (
    echo.
    echo  [X] npm install FAILED - see error above. Fix it then re-run this file.
    pause
    exit /b 1
)
echo [2/2] Starting app...
echo.
echo  App running at: http://localhost:3000
echo.
set NODE_OPTIONS=--openssl-legacy-provider
npm start
pause
