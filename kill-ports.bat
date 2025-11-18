@echo off
REM Kill processes on ports 3000 and 3001
echo Checking for processes on ports 3000 and 3001...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    echo Killing process on port 3000 (PID: %%a)
    taskkill //F //PID %%a >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do (
    echo Killing process on port 3001 (PID: %%a)
    taskkill //F //PID %%a >nul 2>&1
)

echo Ports cleared!
