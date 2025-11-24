@echo off
:: Check for admin rights
net session >nul 2>&1
if %errorLevel% == 0 (
    echo Running with Administrator privileges...
    goto :start
) else (
    echo.
    echo ============================================
    echo   Requesting Administrator Privileges...
    echo ============================================
    echo.
    echo This is needed to bind to ports 3000 and 3001
    echo A UAC prompt will appear - click "Yes"
    echo.
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

:start
cls
echo.
echo ========================================
echo   AlcheMix Development Servers
echo   Running as Administrator
echo ========================================
echo.

cd /d "%~dp0"

echo Starting Backend (API on port 3000)...
start "AlcheMix Backend" cmd /k "cd /d "%~dp0api" && npm run dev"

echo Waiting 5 seconds for backend to initialize...
timeout /t 5 /nobreak

echo.
echo Starting Frontend (Next.js on port 3001)...
start "AlcheMix Frontend" cmd /k "cd /d "%~dp0" && npm run dev"

echo.
echo ========================================
echo   SERVERS STARTED!
echo ========================================
echo.
echo Two windows opened:
echo   1. AlcheMix Backend (port 3000)
echo   2. AlcheMix Frontend (port 3001)
echo.
echo Watch the Backend window for:
echo   "Server listening on port 3000"
echo   "MemMachine Service initialized"
echo.
echo Then open: http://localhost:3001
echo.
echo Press any key to close this window...
pause >nul
