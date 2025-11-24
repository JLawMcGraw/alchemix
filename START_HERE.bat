@echo off
cls
echo.
echo ========================================
echo   AlcheMix Development Server Launcher
echo ========================================
echo.
echo This will start BOTH servers in separate windows.
echo.
echo STEP 1: Starting Backend (API)...
echo.

start "AlcheMix Backend" cmd /k "cd /d "%~dp0api" && npm run dev"

echo Backend starting in separate window...
echo Waiting 5 seconds for backend to initialize...
timeout /t 5 /nobreak >nul

echo.
echo STEP 2: Starting Frontend (Web)...
echo.

start "AlcheMix Frontend" cmd /k "cd /d "%~dp0web" && npm run dev"

echo.
echo ========================================
echo   BOTH SERVERS STARTING!
echo ========================================
echo.
echo Two new windows have opened:
echo   1. "AlcheMix Backend" - API Server (port 3000)
echo   2. "AlcheMix Frontend" - Next.js (port 3001)
echo.
echo Watch the Backend window for MemMachine logs!
echo.
echo Once both show "Ready" or "Listening":
echo   1. Open browser: http://localhost:3001
echo   2. Login: test@example.com
echo   3. Go to AI Bartender
echo   4. Ask: "I want rum cocktails with lime"
echo.
echo Press any key to close this launcher window...
pause >nul
