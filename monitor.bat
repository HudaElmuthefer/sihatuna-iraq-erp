@echo off
REM SIHATUNA IRAQ ERP - Server Health Monitor
REM Runs one health check and alerts only if status changed since last check.
REM Meant to be scheduled (e.g. every 5 minutes) via Windows Task Scheduler -
REM see PRODUCTION.md for setup instructions. Safe to run manually anytime too.
cd /d "%~dp0backend"
node monitor.js
