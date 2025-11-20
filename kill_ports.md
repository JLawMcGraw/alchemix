  Run these commands to clean up stale processes:

  # Find what's using port 3001
  netstat -ano | findstr :3001

  # Find what's using port 3000
  netstat -ano | findstr :3000

  # Kill process (replace PID with actual process ID)
  taskkill //PID <PID> //F

  # Then restart servers
  npm run dev:all