@echo off
title SIHATUNA IRAQ ERP - First-Time Setup
color 0E
cls
echo.
echo  ============================================
echo   SIHATUNA IRAQ ERP - First-Time Setup
echo   (Run this ONCE before using start.bat)
echo  ============================================
echo.

REM ── Step 1: Check Node.js is installed ─────────────────────────────────────
where node >nul 2>&1
if errorlevel 1 (
    echo  [X] Node.js is not installed or not in PATH.
    echo      Download and install it from: https://nodejs.org
    pause
    exit /b 1
)
echo  [OK] Node.js found:
node --version
echo.

REM ── Step 2: Create backend\.env if missing, with auto-generated secrets ────
if exist "%~dp0backend\.env" (
    echo  [OK] backend\.env already exists - keeping it as is.
) else (
    echo  [i] backend\.env not found - creating it now from the template...
    copy "%~dp0backend\.env.example" "%~dp0backend\.env" >nul

    echo  [i] Generating a random JWT_SECRET...
    for /f "delims=" %%S in ('node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"') do set JWT_SECRET_VALUE=%%S

    echo  [i] Generating a random CREDENTIALS_ENCRYPTION_KEY...
    for /f "delims=" %%S in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set CRED_KEY_VALUE=%%S

    REM Replace the placeholder lines in the freshly copied .env file
    powershell -Command "(Get-Content -Encoding UTF8 '%~dp0backend\.env') -replace 'JWT_SECRET=.*', 'JWT_SECRET=%JWT_SECRET_VALUE%' -replace 'CREDENTIALS_ENCRYPTION_KEY=.*', 'CREDENTIALS_ENCRYPTION_KEY=%CRED_KEY_VALUE%' | Set-Content -Encoding UTF8 '%~dp0backend\.env'"

    echo  [OK] backend\.env created with random secrets already filled in.
    echo       (Payment gateway keys are still empty - fill them manually
    echo       if/when you activate real payment providers - see the file.)
)
echo.

REM ── Step 3: Install backend dependencies ────────────────────────────────────
echo  [i] Installing backend packages (this can take a minute)...
cd /d "%~dp0backend"
call npm install
if %errorlevel% neq 0 (
    echo  [X] Backend npm install FAILED - see error above.
    pause
    exit /b 1
)
echo  [OK] Backend packages installed.
echo.

REM ── Step 4: Install frontend dependencies ───────────────────────────────────
echo  [i] Installing frontend packages (this can take a minute)...
cd /d "%~dp0frontend"
call npm install
if %errorlevel% neq 0 (
    echo  [X] Frontend npm install FAILED - see error above.
    pause
    exit /b 1
)
echo  [OK] Frontend packages installed.
echo.

REM ── Step 5: Install PM2 globally if missing ─────────────────────────────────
where pm2 >nul 2>&1
if errorlevel 1 (
    echo  [i] Installing PM2 (process manager, keeps the system running
    echo      and auto-restarts it if it ever crashes)...
    call npm install -g pm2
    echo  [OK] PM2 installed.
) else (
    echo  [OK] PM2 already installed.
)
echo.

REM ── Step 6: Best-effort PostgreSQL reachability check ──────────────────────
echo  [i] Checking PostgreSQL connection (best effort)...
cd /d "%~dp0backend"
node -e "require('dotenv').config(); require('./config/database').testConnection().then(r => { if (r.ok) { console.log('  [OK] PostgreSQL connection works.'); } else { console.log('  [!] Could not connect to PostgreSQL: ' + r.error.message); console.log('      This is OK for now if you have not set it up yet -'); console.log('      just make sure it is ready before first real use.'); } process.exit(0); })"
echo.

echo  ============================================
echo   Setup complete!
echo   Next: run start.bat to launch the system.
echo  ============================================
echo.
pause
