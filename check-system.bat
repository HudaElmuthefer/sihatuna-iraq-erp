@echo off
title SIHATUNA IRAQ ERP - System Check
color 0B
cls
echo.
echo  ============================================
echo   SIHATUNA IRAQ ERP - System Diagnostic
echo  ============================================
echo.

echo  [1/5] Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo    [X] Node.js NOT found in PATH.
) else (
    for /f "delims=" %%V in ('node --version') do echo    [OK] Node.js %%V
)
echo.

echo  [2/5] backend\.env
if exist "%~dp0backend\.env" (
    echo    [OK] File exists.
    findstr /C:"JWT_SECRET=غيّر-هذا-إلى-سر-قوي-عشوائي" "%~dp0backend\.env" >nul 2>&1
    if not errorlevel 1 (
        echo    [!] JWT_SECRET is still the default placeholder - run setup.bat to fix.
    )
) else (
    echo    [X] Missing! Run setup.bat first to create it.
)
echo.

echo  [3/5] Backend packages (node_modules)
if exist "%~dp0backend\node_modules" (
    echo    [OK] Installed.
) else (
    echo    [X] Not installed - run setup.bat or start-backend.bat first.
)
echo.

echo  [4/5] Frontend packages (node_modules)
if exist "%~dp0frontend\node_modules" (
    echo    [OK] Installed.
) else (
    echo    [X] Not installed - run setup.bat or start-frontend.bat first.
)
echo.

echo  [5/5] PostgreSQL connection
cd /d "%~dp0backend"
node -e "require('dotenv').config(); require('./config/database').testConnection().then(r => { if (r.ok) { console.log('    [OK] Connected successfully.'); } else { console.log('    [X] ' + r.error.message); console.log('        Check: is PostgreSQL running? Are PG_* values in backend\\.env correct?'); } process.exit(0); })" 2>nul
echo.

echo  [backup] External backup destination
findstr /R /C:"^EXTERNAL_BACKUP_DIR=.+" "%~dp0backend\.env" >nul 2>&1
if errorlevel 1 (
    echo    [!] Not configured - backups only exist on this machine's disk.
    echo        Add EXTERNAL_BACKUP_DIR to backend\.env to protect against disk failure.
) else (
    echo    [OK] Configured.
)
echo.

echo  [monitor] Server monitoring
if exist "%~dp0backend\data\monitor-state.json" (
    echo    [OK] Monitoring has run before - checking last known status...
    node -e "const s=require('%~dp0backend\data\monitor-state.json'); console.log('       Last check: ' + s.lastCheckedAt + ' | Status: ' + s.lastStatus);"
) else (
    echo    [i] Monitoring has not run yet. See PRODUCTION.md to schedule it, or run monitor.bat manually anytime.
)
echo.

echo  [ports] Checking if backend (8000) / frontend (3000) are currently running...
set BACKEND_PID=
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:"LISTENING" ^| findstr :8000') do set BACKEND_PID=%%P
if defined BACKEND_PID (echo    [OK] Backend is running (PID %BACKEND_PID%).) else (echo    [i] Backend is not currently running.)
set FRONTEND_PID=
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:"LISTENING" ^| findstr :3000') do set FRONTEND_PID=%%P
if defined FRONTEND_PID (echo    [OK] Frontend is running (PID %FRONTEND_PID%).) else (echo    [i] Frontend is not currently running.)
echo.

echo  ============================================
echo   Done. Fix any [X] items above, then re-run
echo   this check or launch start-all.bat.
echo  ============================================
echo.
pause
