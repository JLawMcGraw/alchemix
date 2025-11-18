# Windows/OneDrive Next.js Startup Fix

## Problem
Next.js development server hangs during startup when the project is located in a OneDrive-synced folder on Windows. This is caused by:
1. File system watching conflicts with OneDrive's file syncing
2. Symlink incompatibility issues
3. Webpack build worker conflicts

## Solutions Implemented

### 1. ✅ Turbo Mode (Fastest)
Added `--turbo` flag to the dev script for faster, more stable compilation.

**File:** `package.json`
```json
"dev": "next dev -p 3001 --turbo"
```

### 2. ✅ Disabled webpackBuildWorker
Prevents symlink errors on OneDrive.

**File:** `next.config.js`
```javascript
experimental: {
  webpackBuildWorker: false,
}
```

### 3. ✅ Custom Webpack Watch Options
Disables file polling that conflicts with OneDrive.

**File:** `next.config.js`
```javascript
webpack: (config, { isServer }) => {
  config.watchOptions = {
    poll: false,
    ignored: /node_modules/,
  };
  return config;
}
```

### 4. ✅ Port Cleanup Script
Automatically kills zombie processes on ports 3000 and 3001.

**File:** `kill-ports.bat`
```batch
@echo off
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill //F //PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do (
    taskkill //F //PID %%a >nul 2>&1
)
```

## How to Use

### Option 1: Clean Start (Recommended)
```bash
npm run dev:clean
```
This kills any existing processes and starts fresh.

### Option 2: Manual Cleanup + Start
```bash
# Kill zombie processes
.\kill-ports.bat

# Start servers
npm run dev:all
```

### Option 3: Clear Cache First (If Still Having Issues)
```bash
# Delete Next.js cache
rm -rf .next

# Kill ports
.\kill-ports.bat

# Start fresh
npm run dev:all
```

## Prevention Tips

1. **Always use `npm run dev:clean`** instead of `npm run dev:all` on first start
2. **Use Ctrl+C properly** to stop servers (don't force-close terminal)
3. **Clear .next cache** if you experience hanging: `rm -rf .next`
4. **Restart if OneDrive sync is active** during heavy file operations

## Alternative: Move Project Out of OneDrive

The most reliable solution is to move your project outside of OneDrive:

```bash
# Move project to a local folder
xcopy "C:\Users\Admin\OneDrive\Desktop\DEV Work\alchemix" "C:\Dev\alchemix" /E /I /H

# Update git remote (if needed)
cd C:\Dev\alchemix
git remote set-url origin <your-repo-url>
```

**Benefits:**
- No OneDrive sync conflicts
- Faster file operations
- More stable development experience
- No need for workarounds

**Drawback:**
- No automatic cloud backup (use Git instead)

## Troubleshooting

### If Next.js Still Hangs:
1. Check if OneDrive is actively syncing (pause it temporarily)
2. Clear the `.next` cache: `rm -rf .next`
3. Kill all Node processes:
   ```bash
   taskkill //F //IM node.exe
   ```
4. Restart your terminal/IDE
5. Try again with `npm run dev:clean`

### If Ports Are In Use:
```bash
# Check what's using the ports
netstat -ano | findstr :3000
netstat -ano | findstr :3001

# Kill specific PID
taskkill //F //PID <PID_NUMBER>
```

### If Build Is Slow:
Turbo mode is already enabled. If it's still slow:
1. Exclude `node_modules` from OneDrive sync
2. Exclude `.next` folder from OneDrive sync
3. Consider moving project out of OneDrive

## Summary

**Current fixes prevent:**
- ✅ Symlink errors (webpackBuildWorker disabled)
- ✅ File watching conflicts (custom webpack config)
- ✅ Port conflicts (kill-ports.bat script)
- ✅ Slow compilation (turbo mode enabled)

**Use this command going forward:**
```bash
npm run dev:clean
```

This ensures a clean start every time!
