@echo off
title SIHATUNA IRAQ ERP
color 0E
cls
echo.
echo  ============================================
echo   SIHATUNA IRAQ ERP - Starting System
echo  ============================================
echo.

REM Make sure backend\.env exists before doing anything
if not exist "%~dp0backend\.env" (
    echo  [!] backend\.env is missing.
    echo      Run setup.bat first ^(one time only^) before this file.
    pause
    exit /b 1
)

REM Make sure pm2 is installed - if not, install it automatically (first run only)
where pm2 >nul 2>nul
if errorlevel 1 (
    echo  [*] First run: installing PM2 ...
    echo      This happens once only, please wait a minute
    call npm install -g pm2
    echo  [OK] PM2 installed.
    echo.
)

REM ── Apply any pending database migrations automatically ────────────────────
REM This used to be a manual step (run a .sql file in pgAdmin before
REM starting), and forgetting it caused several "column does not exist"
REM crashes during development. Now it runs by itself every time, and
REM safely skips anything already applied - nothing to remember by hand.
echo  [*] Checking database migrations ...
cd /d "%~dp0backend"
call node run-migrations.js
if errorlevel 1 (
    echo.
    echo  [!] A database migration failed - see the message above.
    echo      Fix the issue, then run start.bat again.
    pause
    exit /b 1
)
echo.

echo  [*] Starting the system (backend + frontend) ...
cd /d "%~dp0"
call pm2 start ecosystem.config.js

echo.
echo  ============================================
echo   System is now running in the background
echo  ============================================
echo.
echo  [*] Waiting for the page to actually be ready (may take a minute on first run)...
echo      Do not close this window until you see the "ready" message
echo.

REM ── Real check instead of a fixed wait time ────────────────────────────────
REM Instead of waiting a fixed 8 seconds (not always enough if RAM is busy),
REM we actually try connecting to the page every 2 seconds, and only open the
REM browser once it truly responds - this prevents a "can't reach this page"
REM error from opening before the frontend has finished starting up.
set MAX_TRIES=150
set TRY=0
:CHECK_LOOP
set /a TRY+=1
powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:3000' -UseBasicParsing -TimeoutSec 3; exit 0 } catch { exit 1 }" >nul 2>nul
if %errorlevel% equ 0 goto READY
if %TRY% geq %MAX_TRIES% goto TIMEOUT
set /a REMAINING=MAX_TRIES-TRY
echo   Preparing... still waiting (up to %REMAINING% more checks, ~2 sec each)
timeout /t 2 /nobreak > nul
goto CHECK_LOOP

:READY
echo.
echo  [OK] Page is ready! Opening browser...
start http://localhost:3000
goto END

:TIMEOUT
echo.
echo  [!] The page is taking longer than usual (5 minutes).
echo      It is very likely still starting up in the background - try opening
echo      the browser manually now at: http://localhost:3000
echo      If it still doesn't load after another minute, run this in PowerShell:
echo      pm2 logs sihatuna-frontend --lines 30 --nostream

:END
echo.
echo  Press any key to close this window (the system keeps running in the background)
pause
