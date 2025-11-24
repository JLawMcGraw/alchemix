@echo off
:: Run npm run dev:all as Administrator

:: Check for admin rights
net session >nul 2>&1
if %errorLevel% == 0 (
    goto :run
) else (
    echo Requesting Administrator privileges...
    echo A UAC prompt will appear - click "Yes"
    powershell -Command "Start-Process cmd -ArgumentList '/c cd /d \"%~dp0\" && npm run dev:all && pause' -Verb RunAs"
    exit /b
)

:run
cd /d "%~dp0"
npm run dev:all
pause
