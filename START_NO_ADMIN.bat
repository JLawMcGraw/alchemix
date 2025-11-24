@echo off
cls
echo.
echo ========================================
echo   AlcheMix - No Admin Required
echo   Using Alternative Ports
echo ========================================
echo.
echo Backend will use port 5000 (instead of 3000)
echo Frontend will use port 5001 (instead of 3001)
echo.
echo Press any key to start servers...
pause >nul

cd /d "%~dp0"

echo.
echo Starting Backend on port 5000...
start "AlcheMix Backend (5000)" cmd /k "cd /d "%~dp0api" && set PORT=5000 && npm run dev"

echo Waiting 5 seconds...
timeout /t 5 /nobreak

echo.
echo Starting Frontend on port 5001...
start "AlcheMix Frontend (5001)" cmd /k "cd /d "%~dp0" && npm run dev -- -p 5001"

echo.
echo ========================================
echo   SERVERS STARTED!
echo ========================================
echo.
echo Backend: http://localhost:5000
echo Frontend: http://localhost:5001
echo.
echo IMPORTANT: Open http://localhost:5001 in browser
echo.
echo Press any key to close...
pause >nul
