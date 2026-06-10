@echo off
chcp 65001 >nul
cd /d "%~dp0.."
python scripts\check_etf_plan.py
if %ERRORLEVEL% NEQ 0 exit /b %ERRORLEVEL%
echo.
echo 打开 资产总览.html#etf 查看提醒
pause
