# AlcheMix Development Server Startup Script
# Fixes Windows port permission issues

Write-Host "🚀 Starting AlcheMix Development Servers..." -ForegroundColor Cyan
Write-Host ""

# Check if MemMachine is running
Write-Host "🔍 Checking MemMachine status..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8080/health" -TimeoutSec 2
    Write-Host "✅ MemMachine is running and healthy" -ForegroundColor Green
} catch {
    Write-Host "⚠️  MemMachine not responding. Please start Docker Desktop and run MemMachine container." -ForegroundColor Red
    Write-Host "   Check: docker ps | grep memmachine" -ForegroundColor Gray
}
Write-Host ""

# Start backend
Write-Host "🔧 Starting Backend (API) on port 3000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\api'; npm run dev" -WindowStyle Normal

# Wait a moment for backend to start
Start-Sleep -Seconds 3

# Start frontend
Write-Host "🎨 Starting Frontend (Next.js) on port 3001..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\web'; npm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "✅ Both servers starting in separate windows!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 What to do next:" -ForegroundColor Cyan
Write-Host "   1. Wait for both servers to start (watch the new windows)" -ForegroundColor White
Write-Host "   2. Backend ready when you see: 'Server listening on port 3000'" -ForegroundColor White
Write-Host "   3. Frontend ready when you see: 'Ready on http://localhost:3001'" -ForegroundColor White
Write-Host "   4. Open browser: http://localhost:3001" -ForegroundColor White
Write-Host "   5. Login as: test@example.com" -ForegroundColor White
Write-Host "   6. Go to AI Bartender and ask: 'I want rum cocktails with lime'" -ForegroundColor White
Write-Host ""
Write-Host "👀 Watch the BACKEND window for MemMachine logs:" -ForegroundColor Cyan
Write-Host "   🔍 MemMachine: Found X episodic + Y profile results" -ForegroundColor Gray
Write-Host ""
