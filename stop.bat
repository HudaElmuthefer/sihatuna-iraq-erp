@echo off
title SIHATUNA IRAQ ERP - Stop
color 0C
cls
echo.
echo  ============================================
echo   Stopping SIHATUNA IRAQ ERP
echo  ============================================
echo.
call pm2 stop all
echo.
echo  System stopped.
pause
