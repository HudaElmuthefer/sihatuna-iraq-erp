@echo off
REM ============================================================
REM  REBUILD_SIHATUNA.bat
REM  Dedicated rebuild/restart launcher for the SIHATUNA IRAQ
REM  frontend ONLY (Create React App). Lives beside package.json.
REM
REM  What this fixes: stale dev server, wrong project on port 3000
REM  (e.g. Ertiqaa/Irtiqaa), stale CRA build cache, and the black
REM  node.exe console window that used to pop up over the browser.
REM
REM  What this does NOT do: touch node_modules, run a production
REM  build, or blanket-kill node.exe. See rebuild-sihatuna.ps1 for
REM  the actual logic (kept in PowerShell, not more nested batch
REM  quoting, because this folder's own path contains a space).
REM ============================================================
title REBUILD_SIHATUNA
setlocal

cd /d "%~dp0"

if not exist "%~dp0package.json" (
  echo [FATAL] package.json not found next to this .bat file. Aborting.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0rebuild-sihatuna.ps1"
set EXIT_CODE=%errorlevel%

echo.
if %EXIT_CODE% neq 0 (
  echo [FAILED] See the messages above ^(and sihatuna-dev.log / sihatuna-dev.err.log^).
) else (
  echo [DONE] SIHATUNA IRAQ frontend is running at http://localhost:3000
  echo        This window can be closed - the server keeps running in the background.
  echo        Server output: %~dp0sihatuna-dev.log
)
echo.
pause
